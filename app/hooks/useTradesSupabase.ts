import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createDataClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContextSupabase';
import type { Trade, TradeInsert, TradeUpdate } from '@/types/database';

interface TradeFilters {
  symbol?: string;
  result?: Trade['result'];
  dateFrom?: string;
  dateTo?: string;
  sessionId?: string;
  marketType?: string;
  limit?: number;
}

export function useTradesSupabase(filters?: TradeFilters) {
  const { user, session } = useAuth();
  const db = useMemo(() => createDataClient(session?.access_token ?? null), [session?.access_token]);
  const queryClient = useQueryClient();

  // Get trades with filters
  const tradesQuery = useQuery({
    queryKey: ['trades', user?.id, filters],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      let query = db
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_time', { ascending: false });

      if (filters?.symbol) {
        query = query.eq('symbol', filters.symbol);
      }
      if (filters?.result) {
        query = query.eq('result', filters.result);
      }
      if (filters?.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }
      if (filters?.marketType) {
        query = query.eq('market_type', filters.marketType);
      }
      if (filters?.dateFrom) {
        query = query.gte('entry_time', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('entry_time', filters.dateTo);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!user,
  });

  // Get trade statistics
  const statsQuery = useQuery({
    queryKey: ['trade-stats', user?.id, filters],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const trades = tradesQuery.data ?? [];

      const totalTrades = trades.length;
      const wins = trades.filter((t) => t.result === 'win').length;
      const losses = trades.filter((t) => t.result === 'loss').length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const avgWin =
        wins > 0
          ? trades
              .filter((t) => t.result === 'win')
              .reduce((sum, t) => sum + (t.pnl ?? 0), 0) / wins
          : 0;
      const avgLoss =
        losses > 0
          ? Math.abs(
              trades
                .filter((t) => t.result === 'loss')
                .reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses
            )
          : 0;
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

      return {
        totalTrades,
        wins,
        losses,
        winRate,
        totalPnl,
        avgWin,
        avgLoss,
        profitFactor,
      };
    },
    enabled: !!user && !!tradesQuery.data,
  });

  // Create a new trade
  const createTrade = useMutation({
    mutationFn: async (trade: Omit<TradeInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await db
        .from('trades')
        .insert({
          ...trade,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
    },
  });

  // Update a trade
  const updateTrade = useMutation({
    mutationFn: async ({
      tradeId,
      updates,
    }: {
      tradeId: string;
      updates: TradeUpdate;
    }) => {
      const { data, error } = await db
        .from('trades')
        .update(updates)
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
    },
  });

  // Delete a trade
  const deleteTrade = useMutation({
    mutationFn: async (tradeId: string) => {
      const { error } = await db.from('trades').delete().eq('id', tradeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
    },
  });

  // Quick add trade (simplified for binary options)
  const quickAddBinaryTrade = useMutation({
    mutationFn: async (trade: {
      symbol: string;
      direction: 'call' | 'put';
      result: 'win' | 'loss';
      stake_amount: number;
      payout_percent: number;
      duration_seconds?: number;
      session_id?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const pnl =
        trade.result === 'win'
          ? trade.stake_amount * (trade.payout_percent / 100)
          : -trade.stake_amount;

      const { data, error } = await db
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: trade.symbol,
          asset_type: 'binary_option',
          direction: trade.direction,
          stake_amount: trade.stake_amount,
          payout_percent: trade.payout_percent,
          duration_seconds: trade.duration_seconds,
          result: trade.result,
          pnl,
          pnl_percent:
            trade.result === 'win' ? trade.payout_percent : -100,
          entry_time: new Date().toISOString(),
          exit_time: new Date().toISOString(),
          session_id: trade.session_id,
          notes: trade.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
    },
  });

  // Quick add futures trade
  const quickAddFuturesTrade = useMutation({
    mutationFn: async (trade: {
      symbol: string;
      direction: 'long' | 'short';
      entry_price: number;
      exit_price: number;
      quantity?: number;
      session_id?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const multiplier = trade.symbol === 'ES' ? 50 : trade.symbol === 'NQ' ? 20 : 1;
      const qty = trade.quantity ?? 1;
      const direction = trade.direction === 'long' ? 1 : -1;
      const pnl =
        (trade.exit_price - trade.entry_price) * direction * multiplier * qty;

      const { data, error } = await db
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: trade.symbol,
          asset_type: 'futures',
          direction: trade.direction,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          quantity: qty,
          result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
          pnl,
          pnl_percent:
            ((trade.exit_price - trade.entry_price) / trade.entry_price) *
            100 *
            direction,
          entry_time: new Date().toISOString(),
          exit_time: new Date().toISOString(),
          session_id: trade.session_id,
          notes: trade.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] });
    },
  });

  return {
    // Queries
    trades: tradesQuery.data ?? [],
    stats: statsQuery.data,
    isLoading: tradesQuery.isLoading,
    error: tradesQuery.error,

    // Mutations
    createTrade,
    updateTrade,
    deleteTrade,
    quickAddBinaryTrade,
    quickAddFuturesTrade,

    // Helpers
    refetch: tradesQuery.refetch,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { auth } from '../lib/firebase';

export interface Trade {
  id: string;
  userId: string;
  tradeId: string;
  asset: string;
  direction: 'call' | 'put';
  amount: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  timeframe: string;
  candleTime: string;
  refunded: number;
  executed: number;
  status: 'WIN' | 'LOSE';
  result: 'win' | 'loss' | 'tie';
  profit: number;
  payout: number;
  platform: string;
  strategy?: string;
  notes?: string;
  screenshots?: string[];
  createdAt: Date;
  updatedAt: Date;
  importedAt?: Date;
  importBatch?: string;
}

export interface TradeFilters {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  result?: 'win' | 'loss' | 'tie';
  asset?: string;
  strategy?: string;
}

export interface TradeStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  tieTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxDrawdown: number;
  avgStake: number;
  maxStake: number;
}

export interface TradesResponse {
  trades: Trade[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function useTrades(filters: TradeFilters = {}) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<TradesResponse['pagination'] | null>(null);

  const fetchTrades = useCallback(async (newFilters: TradeFilters = {}) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const queryParams = new URLSearchParams();

      if (newFilters.start) {
        queryParams.append('start', newFilters.start.toISOString());
      }
      if (newFilters.end) {
        queryParams.append('end', newFilters.end.toISOString());
      }
      if (newFilters.limit) {
        queryParams.append('limit', newFilters.limit.toString());
      }
      if (newFilters.offset) {
        queryParams.append('offset', newFilters.offset.toString());
      }
      if (newFilters.result) {
        queryParams.append('result', newFilters.result);
      }
      if (newFilters.asset) {
        queryParams.append('asset', newFilters.asset);
      }
      if (newFilters.strategy) {
        queryParams.append('strategy', newFilters.strategy);
      }

      const response = await fetch(`/api/v1/trades?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch trades');
      }

      const data: TradesResponse = await response.json();
      
      // Convert date strings to Date objects
      const tradesWithDates = data.trades.map(trade => ({
        ...trade,
        entryTime: new Date(trade.entryTime),
        exitTime: new Date(trade.exitTime),
        createdAt: new Date(trade.createdAt),
        updatedAt: new Date(trade.updatedAt),
        importedAt: trade.importedAt ? new Date(trade.importedAt) : undefined,
      }));

      setTrades(tradesWithDates);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTrade = useCallback(async (tradeData: Partial<Trade>) => {
    if (!user) throw new Error('User not authenticated');

    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/v1/trades', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tradeData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create trade');
    }

    const newTrade = await response.json();
    
    // Convert date strings to Date objects
    const tradeWithDates = {
      ...newTrade,
      entryTime: new Date(newTrade.entryTime),
      exitTime: new Date(newTrade.exitTime),
      createdAt: new Date(newTrade.createdAt),
      updatedAt: new Date(newTrade.updatedAt),
      importedAt: newTrade.importedAt ? new Date(newTrade.importedAt) : undefined,
    };

    setTrades(prev => [tradeWithDates, ...prev]);
    return tradeWithDates;
  }, [user]);

  const updateTrade = useCallback(async (tradeId: string, tradeData: Partial<Trade>) => {
    if (!user) throw new Error('User not authenticated');

    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch(`/api/v1/trades/${tradeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tradeData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update trade');
    }

    const updatedTrade = await response.json();
    
    // Convert date strings to Date objects
    const tradeWithDates = {
      ...updatedTrade,
      entryTime: new Date(updatedTrade.entryTime),
      exitTime: new Date(updatedTrade.exitTime),
      createdAt: new Date(updatedTrade.createdAt),
      updatedAt: new Date(updatedTrade.updatedAt),
      importedAt: updatedTrade.importedAt ? new Date(updatedTrade.importedAt) : undefined,
    };

    setTrades(prev => prev.map(trade => 
      trade.id === tradeId ? tradeWithDates : trade
    ));
    return tradeWithDates;
  }, [user]);

  const deleteTrade = useCallback(async (tradeId: string) => {
    if (!user) throw new Error('User not authenticated');

    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch(`/api/v1/trades/${tradeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete trade');
    }

    setTrades(prev => prev.filter(trade => trade.id !== tradeId));
  }, [user]);

  // Fetch trades on mount and when filters change
  useEffect(() => {
    fetchTrades(filters);
  }, [fetchTrades, filters]);

  return {
    trades,
    loading,
    error,
    pagination,
    fetchTrades,
    createTrade,
    updateTrade,
    deleteTrade,
  };
} 
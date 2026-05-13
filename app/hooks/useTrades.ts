// Lean rebuild shim - returns empty data without Firebase API calls
// For actual trade data, use useTradesSupabase instead

import { useState, useCallback, useEffect } from 'react';

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
  marketType?: 'binary' | 'forex' | 'crypto' | 'futures' | 'options';
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
  marketType?: 'binary' | 'forex' | 'crypto' | 'futures' | 'options';
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

export function useTrades(_filters: TradeFilters = {}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [pagination] = useState<TradesResponse['pagination']>({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });

  // Check localStorage for any imported data (from previous Firebase setup)
  useEffect(() => {
    const loadLocalData = () => {
      try {
        const hasImportedData = localStorage.getItem('binaryHub_hasData') === 'true';
        const importedTrades = localStorage.getItem('binaryHub_trades');

        if (hasImportedData && importedTrades) {
          const parsedTrades = JSON.parse(importedTrades);
          const formattedTrades: Trade[] = parsedTrades.map((trade: Record<string, unknown>, index: number) => ({
            id: (trade.id as string) || `imported-${index}`,
            userId: 'local-user',
            tradeId: (trade.id as string) || `TRADE-${String(index + 1).padStart(3, '0')}`,
            asset: (trade.asset as string) || 'UNKNOWN',
            direction: ((trade.direction as string)?.toLowerCase() === 'put' ? 'put' : 'call') as 'call' | 'put',
            amount: (trade.amount as number) || 0,
            entryPrice: (trade.entryPrice as number) || 0,
            exitPrice: (trade.exitPrice as number) || 0,
            entryTime: trade.entryTime ? new Date(trade.entryTime as string) : new Date(),
            exitTime: trade.exitTime ? new Date(trade.exitTime as string) : new Date(),
            timeframe: (trade.timeframe as string) || '1m',
            candleTime: (trade.candleTime as string) || '00:00',
            refunded: (trade.refunded as number) || 0,
            executed: (trade.executed as number) || 1,
            status: (trade.result === 'win' ? 'WIN' : 'LOSE') as 'WIN' | 'LOSE',
            result: ((trade.result as string) || 'tie') as 'win' | 'loss' | 'tie',
            profit: (trade.pnl as number) || (trade.profit as number) || 0,
            payout: trade.result === 'win' ? ((trade.amount as number) || 0) + ((trade.pnl as number) || (trade.profit as number) || 0) : 0,
            platform: 'Ebinex',
            marketType: 'binary' as const,
            strategy: 'Imported',
            notes: 'Imported from CSV',
            createdAt: new Date(),
            updatedAt: new Date(),
            importedAt: new Date(),
            importBatch: 'csv-import',
          }));
          setTrades(formattedTrades);
        }
      } catch (err) {
        console.warn('Error loading local trades:', err);
      } finally {
        setLoading(false);
      }
    };

    // Simulate async loading
    const timer = setTimeout(loadLocalData, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchTrades = useCallback(async () => {
    // No-op in lean rebuild - data is loaded from localStorage on mount
    console.log('useTrades: Lean rebuild mode - no Firebase API calls');
  }, []);

  const createTrade = useCallback(async (_trade: Partial<Trade>) => {
    console.warn('useTrades.createTrade: Use useTradesSupabase for new trades');
    return null;
  }, []);

  const updateTrade = useCallback(async (_id: string, _updates: Partial<Trade>) => {
    console.warn('useTrades.updateTrade: Use useTradesSupabase for updates');
    return null;
  }, []);

  const deleteTrade = useCallback(async (_id: string) => {
    console.warn('useTrades.deleteTrade: Use useTradesSupabase for deletions');
    return false;
  }, []);

  const bulkCreateTrades = useCallback(async (_trades: Partial<Trade>[], _importBatch?: string) => {
    console.warn('useTrades.bulkCreateTrades: Use useTradesSupabase for bulk operations');
    return { created: 0, failed: 0 };
  }, []);

  return {
    trades,
    loading,
    error,
    pagination,
    fetchTrades,
    createTrade,
    updateTrade,
    deleteTrade,
    bulkCreateTrades,
  };
}

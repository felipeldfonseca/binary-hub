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
      
      const response = await fetch(`http://localhost:5004/binary-hub/us-central1/api/v1/trades?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API endpoints not yet implemented. This feature will be available in Phase B.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch trades');
      }
      
      const data: TradesResponse = await response.json();
      setTrades(data.trades);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTrade = useCallback(async (tradeData: Partial<Trade>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5004/binary-hub/us-central1/api/v1/trades`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API endpoints not yet implemented. This feature will be available in Phase B.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create trade');
      }
      
      const newTrade: Trade = await response.json();
      
      // Add to local state
      setTrades(prev => [newTrade, ...prev]);
      
      return newTrade;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [user]);

  const updateTrade = useCallback(async (tradeId: string, updates: Partial<Trade>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5004/binary-hub/us-central1/api/v1/trades/${tradeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API endpoints not yet implemented. This feature will be available in Phase B.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update trade');
      }
      
      const updatedTrade: Trade = await response.json();
      
      // Update local state
      setTrades(prev => prev.map(trade => 
        trade.id === tradeId ? updatedTrade : trade
      ));
      
      return updatedTrade;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [user]);

  const deleteTrade = useCallback(async (tradeId: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5004/binary-hub/us-central1/api/v1/trades/${tradeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API endpoints not yet implemented. This feature will be available in Phase B.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete trade');
      }
      
      // Remove from local state
      setTrades(prev => prev.filter(trade => trade.id !== tradeId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [user]);

  const bulkCreateTrades = useCallback(async (trades: Partial<Trade>[], importBatch?: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5004/binary-hub/us-central1/api/v1/trades/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trades, importBatch }),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API endpoints not yet implemented. This feature will be available in Phase B.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk create trades');
      }
      
      const result = await response.json();
      
      // Refresh trades list
      await fetchTrades();
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [user, fetchTrades]);

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
    bulkCreateTrades,
  };
} 
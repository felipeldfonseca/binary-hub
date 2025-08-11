import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { auth } from '../lib/firebase';
import { useErrorHandler } from './useErrorHandler';
import { useToastHelpers } from '@/components/ui/Toast';

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
  const { handleApiError } = useErrorHandler();
  const { showSuccess } = useToastHelpers();
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
      
      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/trades?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('API endpoints not yet implemented. This feature will be available in Phase B.');
          return;
        }
        setError(`API Error: ${response.status} - ${response.statusText}`);
        return;
      }
      
      const data: TradesResponse = await response.json();
      
      // If no trades exist, check if user has imported data
      const hasImportedData = localStorage.getItem('binaryHub_hasData') === 'true';
      
      if (data.trades.length === 0 && hasImportedData) {
        const mockTrades: Trade[] = [
          {
            id: 'mock-1',
            userId: 'test-user',
            tradeId: 'TRADE-001',
            asset: 'EURUSD',
            direction: 'call',
            amount: 25,
            entryPrice: 1.0850,
            exitPrice: 1.0865,
            entryTime: new Date('2025-08-09T10:30:00Z'),
            exitTime: new Date('2025-08-09T10:31:00Z'),
            timeframe: '1m',
            candleTime: '10:30',
            refunded: 0,
            executed: 1,
            status: 'WIN',
            result: 'win',
            profit: 20.00,
            payout: 45.00,
            platform: 'Pocket Option',
            strategy: 'Trend Following',
            notes: 'Strong uptrend, good entry point',
            createdAt: new Date('2025-08-09T10:31:00Z'),
            updatedAt: new Date('2025-08-09T10:31:00Z'),
          },
          {
            id: 'mock-2',
            userId: 'test-user',
            tradeId: 'TRADE-002',
            asset: 'GBPUSD',
            direction: 'put',
            amount: 30,
            entryPrice: 1.2750,
            exitPrice: 1.2735,
            entryTime: new Date('2025-08-09T11:15:00Z'),
            exitTime: new Date('2025-08-09T11:16:00Z'),
            timeframe: '1m',
            candleTime: '11:15',
            refunded: 0,
            executed: 1,
            status: 'LOSE',
            result: 'loss',
            profit: -30.00,
            payout: 0,
            platform: 'Pocket Option',
            strategy: 'Support Resistance',
            notes: 'Expected bounce at resistance, but broke through',
            createdAt: new Date('2025-08-09T11:16:00Z'),
            updatedAt: new Date('2025-08-09T11:16:00Z'),
          },
          {
            id: 'mock-3',
            userId: 'test-user',
            tradeId: 'TRADE-003',
            asset: 'USDJPY',
            direction: 'call',
            amount: 35,
            entryPrice: 149.85,
            exitPrice: 149.92,
            entryTime: new Date('2025-08-09T12:00:00Z'),
            exitTime: new Date('2025-08-09T12:01:00Z'),
            timeframe: '1m',
            candleTime: '12:00',
            refunded: 0,
            executed: 1,
            status: 'WIN',
            result: 'win',
            profit: 28.00,
            payout: 63.00,
            platform: 'Pocket Option',
            strategy: 'News Trading',
            notes: 'USD strength after economic data',
            createdAt: new Date('2025-08-09T12:01:00Z'),
            updatedAt: new Date('2025-08-09T12:01:00Z'),
          },
          {
            id: 'mock-4',
            userId: 'test-user',
            tradeId: 'TRADE-004',
            asset: 'AUDUSD',
            direction: 'put',
            amount: 20,
            entryPrice: 0.6580,
            exitPrice: 0.6575,
            entryTime: new Date('2025-08-09T13:30:00Z'),
            exitTime: new Date('2025-08-09T13:31:00Z'),
            timeframe: '1m',
            candleTime: '13:30',
            refunded: 0,
            executed: 1,
            status: 'WIN',
            result: 'win',
            profit: 16.00,
            payout: 36.00,
            platform: 'Pocket Option',
            strategy: 'Pattern Trading',
            notes: 'Double top pattern confirmed',
            createdAt: new Date('2025-08-09T13:31:00Z'),
            updatedAt: new Date('2025-08-09T13:31:00Z'),
          },
          {
            id: 'mock-5',
            userId: 'test-user',
            tradeId: 'TRADE-005',
            asset: 'BTCUSD',
            direction: 'call',
            amount: 50,
            entryPrice: 45250.00,
            exitPrice: 45180.00,
            entryTime: new Date('2025-08-09T14:15:00Z'),
            exitTime: new Date('2025-08-09T14:16:00Z'),
            timeframe: '1m',
            candleTime: '14:15',
            refunded: 0,
            executed: 1,
            status: 'LOSE',
            result: 'loss',
            profit: -50.00,
            payout: 0,
            platform: 'Pocket Option',
            strategy: 'Crypto Momentum',
            notes: 'Unexpected pullback, stop loss triggered',
            createdAt: new Date('2025-08-09T14:16:00Z'),
            updatedAt: new Date('2025-08-09T14:16:00Z'),
          }
        ];
        
        setTrades(mockTrades);
        setPagination({ total: mockTrades.length, limit: 100, offset: 0, hasMore: false });
      } else {
        // No data imported, show empty state
        setTrades([]);
        setPagination({ total: 0, limit: 100, offset: 0, hasMore: false });
      }
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
      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/trades`, {
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
      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/trades/${tradeId}`, {
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
      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/trades/${tradeId}`, {
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
      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/trades/bulk`, {
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

  // Fetch trades on mount only (filters cause infinite loop)
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

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
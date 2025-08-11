import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { auth } from '../lib/firebase';

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

export interface DashboardStats {
  period: string;
  stats: TradeStats;
  performance: Array<{
    date: string;
    trades: number;
    pnl: number;
  }>;
}

export interface PerformanceMetrics {
  period: {
    start: string;
    end: string;
  };
  metrics: TradeStats;
  assetBreakdown: Array<{
    asset: string;
    trades: number;
    winRate: number;
    totalPnl: number;
  }>;
}

export function useTradeStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd' = 'weekly') {
  const { user } = useAuth();
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate period-specific mock data with unique values for each period
  const generateMockData = useCallback((period: string): TradeStats => {
    // Each period gets unique, realistic data
    const periodConfigs = {
      daily: {
        totalTrades: 1,
        winTrades: 1,
        lossTrades: 0,
        winRate: 100.0,
        totalPnl: 25,
        avgPnl: 25,
        maxDrawdown: -15
      },
      weekly: {
        totalTrades: 5,
        winTrades: 3,
        lossTrades: 2,
        winRate: 60.0,
        totalPnl: 34,
        avgPnl: 6.8,
        maxDrawdown: -80
      },
      monthly: {
        totalTrades: 22,
        winTrades: 14,
        lossTrades: 8,
        winRate: 63.6,
        totalPnl: 156,
        avgPnl: 7.1,
        maxDrawdown: -120
      },
      yearly: {
        totalTrades: 264,
        winTrades: 172,
        lossTrades: 92,
        winRate: 65.2,
        totalPnl: 2840,
        avgPnl: 10.8,
        maxDrawdown: -450
      },
      allTime: {
        totalTrades: 847,
        winTrades: 576,
        lossTrades: 271,
        winRate: 68.0,
        totalPnl: 8960,
        avgPnl: 10.6,
        maxDrawdown: -680
      },
      ytd: {
        totalTrades: 198,
        winTrades: 126,
        lossTrades: 72,
        winRate: 63.6,
        totalPnl: 2156,
        avgPnl: 10.9,
        maxDrawdown: -340
      }
    };
    
    const config = periodConfigs[period] || periodConfigs.weekly;
    
    return {
      totalTrades: config.totalTrades,
      winTrades: config.winTrades,
      lossTrades: config.lossTrades,
      tieTrades: 0,
      winRate: config.winRate,
      totalPnl: config.totalPnl,
      avgPnl: config.avgPnl,
      maxDrawdown: config.maxDrawdown,
      avgStake: 32.0,
      maxStake: 50.0
    };
  }, []);

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return;

    // For Phase A, use mock data with smooth loading transition
    setLoading(true);
    setError(null);

    // Simulate smooth loading synchronized with chart animation (800ms)
    setTimeout(() => {
      const mockStats = generateMockData(period);
      const mockDashboardStats: DashboardStats = {
        period: period,
        stats: mockStats,
        performance: [
          { date: '2025-08-09', pnl: 20.00, trades: 1 },
          { date: '2025-08-09', pnl: -30.00, trades: 1 },
          { date: '2025-08-09', pnl: 28.00, trades: 1 },
          { date: '2025-08-09', pnl: 16.00, trades: 1 },
          { date: '2025-08-09', pnl: -50.00, trades: 1 },
        ]
      };
      
      setDashboardStats(mockDashboardStats);
      setStats(mockStats);
      setLoading(false);
    }, 800); // Synchronized with chart animation duration

    // TODO: In Phase B, replace with actual API call:
    // try {
    //   const idToken = await auth.currentUser?.getIdToken();
    //   const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/analytics/dashboard?period=${period}`, {
    //     headers: {
    //       'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
    //       'Content-Type': 'application/json',
    //     },
    //   });
    //   // ... handle response
    // } catch (err) {
    //   setError(err instanceof Error ? err.message : 'An error occurred');
    // }
  }, [user, period, generateMockData]);

  const fetchPerformanceMetrics = useCallback(async (start?: Date, end?: Date) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const queryParams = new URLSearchParams();

      if (start) {
        queryParams.append('start', start.toISOString());
      }
      if (end) {
        queryParams.append('end', end.toISOString());
      }

      const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/analytics/performance?${queryParams.toString()}`, {
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
        throw new Error(errorData.error || 'Failed to fetch performance metrics');
      }

      const data: PerformanceMetrics = await response.json();
      setPerformanceMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const exportTrades = useCallback(async (format: 'csv' | 'json' = 'csv', start?: Date, end?: Date) => {
    if (!user) throw new Error('User not authenticated');

    const idToken = await auth.currentUser?.getIdToken();
    const queryParams = new URLSearchParams();

    queryParams.append('format', format);
    if (start) {
      queryParams.append('start', start.toISOString());
    }
    if (end) {
      queryParams.append('end', end.toISOString());
    }

    const response = await fetch(`http://localhost:5001/binary-hub/us-central1/api/v1/analytics/export?${queryParams.toString()}`, {
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
      throw new Error(errorData.error || 'Failed to export trades');
    }

    if (format === 'csv') {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trades-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      const data = await response.json();
      return data;
    }
  }, [user]);

  // Fetch dashboard stats on mount and when period changes
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  return {
    stats,
    dashboardStats,
    performanceMetrics,
    loading,
    error,
    fetchDashboardStats,
    fetchPerformanceMetrics,
    exportTrades,
  };
} 
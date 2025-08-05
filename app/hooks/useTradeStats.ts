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

export function useTradeStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly') {
  const { user } = useAuth();
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/v1/analytics/dashboard?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard stats');
      }

      const data: DashboardStats = await response.json();
      setDashboardStats(data);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user, period]);

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

      const response = await fetch(`/api/v1/analytics/performance?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
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

    const response = await fetch(`/api/v1/analytics/export?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
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
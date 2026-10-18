// Lean rebuild shim - returns mock/empty stats without Firebase API calls

import { useState, useEffect, useCallback } from 'react';

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

const emptyStats: TradeStats = {
  totalTrades: 0,
  winTrades: 0,
  lossTrades: 0,
  tieTrades: 0,
  winRate: 0,
  totalPnl: 0,
  avgPnl: 0,
  maxDrawdown: 0,
  avgStake: 0,
  maxStake: 0,
};

export function useTradeStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd' = 'weekly') {
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);

    // Check localStorage for imported data
    setTimeout(() => {
      try {
        const hasImportedData = typeof window !== 'undefined' && localStorage.getItem('binaryHub_hasData') === 'true';
        const importedTrades = typeof window !== 'undefined' ? localStorage.getItem('binaryHub_trades') : null;
        const importedStats = typeof window !== 'undefined' ? localStorage.getItem('binaryHub_stats') : null;

        if (hasImportedData && importedTrades && importedStats) {
          const trades = JSON.parse(importedTrades);
          const statsData = JSON.parse(importedStats);

          const realStats: TradeStats = {
            totalTrades: trades.length,
            winTrades: statsData.winTrades || trades.filter((t: Record<string, unknown>) => t.result === 'win').length,
            lossTrades: statsData.lossTrades || trades.filter((t: Record<string, unknown>) => t.result === 'loss').length,
            tieTrades: trades.filter((t: Record<string, unknown>) => t.result === 'tie').length,
            winRate: statsData.winRate || ((statsData.winTrades || 0) / trades.length * 100),
            totalPnl: statsData.totalProfit || trades.reduce((sum: number, t: Record<string, unknown>) => sum + ((t.pnl as number) || 0), 0),
            avgPnl: (statsData.totalProfit || 0) / trades.length,
            maxDrawdown: -Math.abs(Math.min(...trades.map((t: Record<string, unknown>) => (t.pnl as number) || 0))),
            avgStake: statsData.avgStake || trades.reduce((sum: number, t: Record<string, unknown>) => sum + ((t.amount as number) || 0), 0) / trades.length,
            maxStake: Math.max(...trades.map((t: Record<string, unknown>) => (t.amount as number) || 0)),
          };

          const performanceData = trades.map((trade: Record<string, unknown>) => ({
            date: (trade.entryTime as string) || new Date().toISOString().split('T')[0],
            pnl: (trade.pnl as number) || 0,
            trades: 1,
          }));

          setStats(realStats);
          setDashboardStats({
            period,
            stats: realStats,
            performance: performanceData,
          });
        } else {
          // Return empty stats
          setStats(emptyStats);
          setDashboardStats({
            period,
            stats: emptyStats,
            performance: [],
          });
        }
      } catch (err) {
        console.warn('Error loading stats from localStorage:', err);
        setStats(emptyStats);
        setDashboardStats({
          period,
          stats: emptyStats,
          performance: [],
        });
      } finally {
        setLoading(false);
      }
    }, 100);
  }, [period]);

  const fetchPerformanceMetrics = useCallback(async (_start?: Date, _end?: Date) => {
    // No-op in lean rebuild
    console.log('useTradeStats.fetchPerformanceMetrics: Lean rebuild mode');
    setPerformanceMetrics(null);
  }, []);

  const exportTrades = useCallback(async (_format: 'csv' | 'json' = 'csv', _start?: Date, _end?: Date) => {
    // No-op in lean rebuild
    console.warn('useTradeStats.exportTrades: Not available in lean rebuild');
    return null;
  }, []);

  // Fetch stats on mount and when period changes
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

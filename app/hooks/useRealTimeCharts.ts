import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRealTime } from './useRealTime';
import { useFirestoreTrades } from './useFirestoreTrades';
import { Trade } from './useTrades';

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  pnl: number;
  cumulativePnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface AssetPerformance {
  asset: string;
  trades: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export interface TimeAnalytics {
  hour: number;
  trades: number;
  totalPnl: number;
  winRate: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  bestDay: string;
  worstDay: string;
  maxDrawdown: number;
  maxRunup: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface RealTimeChartsData {
  chartData: ChartDataPoint[];
  assetPerformance: AssetPerformance[];
  timeAnalytics: TimeAnalytics[];
  metrics: PerformanceMetrics;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  connected: boolean;
}

export interface ChartOptions {
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  includeRunningTotal?: boolean;
  smoothing?: boolean;
}

export function useRealTimeCharts(options: ChartOptions = {}) {
  const {
    period = 'month',
    groupBy = 'day',
    includeRunningTotal = true,
    smoothing = false
  } = options;

  // Use Firestore real-time listener for immediate updates with error handling
  const { 
    trades, 
    loading: tradesLoading, 
    error: tradesError, 
    connected: tradesConnected,
    lastUpdate: tradesLastUpdate 
  } = useFirestoreTrades({
    realTimeUpdates: true,
    limit: 500, // Reduced limit to prevent performance issues
    orderByField: 'entryTime',
    orderDirection: 'desc'
  });

  // Use SSE for additional real-time events
  const { events, connected: sseConnected } = useRealTime({
    subscriptions: ['trades', 'analytics']
  });

  const [state, setState] = useState<RealTimeChartsData>({
    chartData: [],
    assetPerformance: [],
    timeAnalytics: [],
    metrics: {
      totalTrades: 0,
      totalPnl: 0,
      winRate: 0,
      avgPnl: 0,
      bestDay: '',
      worstDay: '',
      maxDrawdown: 0,
      maxRunup: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0
    },
    loading: false,
    error: null,
    lastUpdate: null,
    connected: false
  });

  // Filter trades by selected period with safety checks
  const filteredTrades = useMemo(() => {
    if (!trades || !Array.isArray(trades) || !trades.length) return [];

    // Filter out invalid trades
    const validTrades = trades.filter(trade => {
      return trade && 
             trade.entryTime && 
             trade.profit !== undefined && 
             trade.result && 
             typeof trade.profit === 'number' &&
             !isNaN(trade.profit);
    });

    if (!validTrades.length) return [];

    const now = new Date();
    const cutoffDate = new Date();

    switch (period) {
      case 'day':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
      default:
        cutoffDate.setFullYear(2000); // Include all trades
        break;
    }

    return validTrades
      .filter(trade => {
        try {
          const entryDate = new Date(trade.entryTime);
          return !isNaN(entryDate.getTime()) && entryDate >= cutoffDate;
        } catch (error) {
          console.warn('Invalid trade entry time:', trade.entryTime, error);
          return false;
        }
      })
      .sort((a, b) => {
        try {
          return new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime();
        } catch (error) {
          console.warn('Error sorting trades by time:', error);
          return 0;
        }
      });
  }, [trades, period]);

  // Calculate chart data points
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!filteredTrades.length) return [];

    const groupedTrades = new Map<string, Trade[]>();

    // Group trades by time period
    filteredTrades.forEach(trade => {
      const date = new Date(trade.entryTime);
      let key: string;

      switch (groupBy) {
        case 'hour':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
          break;
        case 'week':
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'day':
        default:
          key = date.toISOString().split('T')[0];
          break;
      }

      if (!groupedTrades.has(key)) {
        groupedTrades.set(key, []);
      }
      groupedTrades.get(key)!.push(trade);
    });

    // Convert to chart data points
    const points: ChartDataPoint[] = [];
    let cumulativePnl = 0;

    Array.from(groupedTrades.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, dayTrades]) => {
        const dayPnl = dayTrades.reduce((sum, trade) => sum + trade.profit, 0);
        const wins = dayTrades.filter(t => t.result === 'win').length;
        const losses = dayTrades.filter(t => t.result === 'loss').length;
        const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;

        cumulativePnl += dayPnl;

        points.push({
          date: dateKey,
          timestamp: new Date(dateKey).getTime(),
          pnl: dayPnl,
          cumulativePnl: includeRunningTotal ? cumulativePnl : dayPnl,
          trades: dayTrades.length,
          wins,
          losses,
          winRate
        });
      });

    return points;
  }, [filteredTrades, groupBy, includeRunningTotal]);

  // Calculate asset performance
  const assetPerformance = useMemo((): AssetPerformance[] => {
    if (!filteredTrades.length) return [];

    const assetMap = new Map<string, Trade[]>();

    filteredTrades.forEach(trade => {
      if (!assetMap.has(trade.asset)) {
        assetMap.set(trade.asset, []);
      }
      assetMap.get(trade.asset)!.push(trade);
    });

    return Array.from(assetMap.entries()).map(([asset, assetTrades]) => {
      const totalPnl = assetTrades.reduce((sum, t) => sum + t.profit, 0);
      const wins = assetTrades.filter(t => t.result === 'win').length;
      const winRate = (wins / assetTrades.length) * 100;
      const profits = assetTrades.map(t => t.profit);

      return {
        asset,
        trades: assetTrades.length,
        totalPnl,
        winRate,
        avgPnl: totalPnl / assetTrades.length,
        bestTrade: Math.max(...profits),
        worstTrade: Math.min(...profits)
      };
    }).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [filteredTrades]);

  // Calculate time-based analytics
  const timeAnalytics = useMemo((): TimeAnalytics[] => {
    if (!filteredTrades.length) return [];

    const hourMap = new Map<number, Trade[]>();

    filteredTrades.forEach(trade => {
      const hour = new Date(trade.entryTime).getHours();
      if (!hourMap.has(hour)) {
        hourMap.set(hour, []);
      }
      hourMap.get(hour)!.push(trade);
    });

    return Array.from({ length: 24 }, (_, hour) => {
      const hourTrades = hourMap.get(hour) || [];
      const totalPnl = hourTrades.reduce((sum, t) => sum + t.profit, 0);
      const wins = hourTrades.filter(t => t.result === 'win').length;
      const winRate = hourTrades.length > 0 ? (wins / hourTrades.length) * 100 : 0;

      return {
        hour,
        trades: hourTrades.length,
        totalPnl,
        winRate
      };
    });
  }, [filteredTrades]);

  // Calculate performance metrics
  const metrics = useMemo((): PerformanceMetrics => {
    if (!filteredTrades.length) {
      return {
        totalTrades: 0,
        totalPnl: 0,
        winRate: 0,
        avgPnl: 0,
        bestDay: '',
        worstDay: '',
        maxDrawdown: 0,
        maxRunup: 0,
        currentStreak: 0,
        longestWinStreak: 0,
        longestLossStreak: 0
      };
    }

    const totalTrades = filteredTrades.length;
    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.profit, 0);
    const wins = filteredTrades.filter(t => t.result === 'win').length;
    const winRate = (wins / totalTrades) * 100;
    const avgPnl = totalPnl / totalTrades;

    // Find best and worst days
    let bestDay = '';
    let worstDay = '';
    let bestDayPnl = -Infinity;
    let worstDayPnl = Infinity;

    chartData.forEach(point => {
      if (point.pnl > bestDayPnl) {
        bestDayPnl = point.pnl;
        bestDay = point.date;
      }
      if (point.pnl < worstDayPnl) {
        worstDayPnl = point.pnl;
        worstDay = point.date;
      }
    });

    // Calculate drawdown and runup
    let maxDrawdown = 0;
    let maxRunup = 0;
    let peak = 0;
    let trough = 0;

    chartData.forEach(point => {
      if (point.cumulativePnl > peak) {
        peak = point.cumulativePnl;
      }
      
      const drawdown = peak - point.cumulativePnl;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      if (point.cumulativePnl < trough) {
        trough = point.cumulativePnl;
      }

      const runup = point.cumulativePnl - trough;
      if (runup > maxRunup) {
        maxRunup = runup;
      }
    });

    // Calculate streaks
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    filteredTrades.forEach((trade, index) => {
      if (trade.result === 'win') {
        currentWinStreak++;
        currentLossStreak = 0;
        if (index === filteredTrades.length - 1) {
          currentStreak = currentWinStreak;
        }
      } else if (trade.result === 'loss') {
        currentLossStreak++;
        currentWinStreak = 0;
        if (index === filteredTrades.length - 1) {
          currentStreak = -currentLossStreak;
        }
      }

      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    });

    return {
      totalTrades,
      totalPnl,
      winRate,
      avgPnl,
      bestDay,
      worstDay,
      maxDrawdown,
      maxRunup,
      currentStreak,
      longestWinStreak,
      longestLossStreak
    };
  }, [filteredTrades, chartData]);

  // Update state when data changes
  useEffect(() => {
    setState({
      chartData,
      assetPerformance,
      timeAnalytics,
      metrics,
      loading: tradesLoading,
      error: tradesError,
      lastUpdate: tradesLastUpdate,
      connected: tradesConnected && sseConnected
    });
  }, [
    chartData, 
    assetPerformance, 
    timeAnalytics, 
    metrics,
    tradesLoading,
    tradesError,
    tradesLastUpdate,
    tradesConnected,
    sseConnected
  ]);

  // Smoothing function for chart data
  const getSmoothData = useCallback((data: ChartDataPoint[], field: keyof ChartDataPoint = 'cumulativePnl') => {
    if (!smoothing || data.length < 3) return data;

    return data.map((point, index) => {
      if (index === 0 || index === data.length - 1) {
        return point;
      }

      const prev = data[index - 1];
      const next = data[index + 1];
      const smoothedValue = (prev[field] as number + point[field] as number + next[field] as number) / 3;

      return {
        ...point,
        [field]: smoothedValue
      };
    });
  }, [smoothing]);

  return {
    ...state,
    
    // Processed data
    chartData: smoothing ? getSmoothData(state.chartData) : state.chartData,
    
    // Helper methods
    getSmoothData,
    
    // Meta information
    dataPoints: state.chartData.length,
    dateRange: state.chartData.length > 0 ? {
      start: state.chartData[0]?.date,
      end: state.chartData[state.chartData.length - 1]?.date
    } : null,
    
    // Connection status
    isHealthy: state.connected && !state.error,
    hasData: state.chartData.length > 0,
    
    // Performance indicators
    profitableAssets: state.assetPerformance.filter(a => a.totalPnl > 0).length,
    bestHour: state.timeAnalytics.reduce((best, current) => 
      current.totalPnl > best.totalPnl ? current : best, 
      state.timeAnalytics[0] || { hour: 0, trades: 0, totalPnl: 0, winRate: 0 }
    )
  };
}
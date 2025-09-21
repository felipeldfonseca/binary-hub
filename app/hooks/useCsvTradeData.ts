import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trade } from './useTrades';

interface CsvTradeStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalProfit: number;
  avgStake: number;
}

interface CalendarData {
  date: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface CsvTradeData {
  trades: Trade[];
  stats: CsvTradeStats;
  calendarData: CalendarData[];
  hasData: boolean;
  lastUpdated: Date | null;
}

/**
 * Hook to manage CSV imported trade data
 * This provides a unified interface for accessing CSV trade data across components
 */
export function useCsvTradeData(): CsvTradeData {
  const [data, setData] = useState<CsvTradeData>({
    trades: [],
    stats: {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0,
      totalProfit: 0,
      avgStake: 0
    },
    calendarData: [],
    hasData: false,
    lastUpdated: null
  });

  // Process raw CSV data into structured format
  const processRawCsvData = useCallback((rawTrades: any[], rawStats: any) => {
    // Transform raw trade data to Trade interface
    const formattedTrades: Trade[] = rawTrades.map((trade: any, index: number) => ({
      id: trade.id || `imported-${index}`,
      userId: 'csv-user',
      tradeId: trade.id || `TRADE-${String(index + 1).padStart(3, '0')}`,
      asset: trade.asset || 'UNKNOWN',
      direction: trade.direction?.toLowerCase() === 'put' ? 'put' : 'call',
      amount: parseFloat(trade.amount) || 0,
      entryPrice: parseFloat(trade.entryPrice) || 0,
      exitPrice: parseFloat(trade.exitPrice) || 0,
      entryTime: trade.entryTime ? new Date(trade.entryTime) : new Date(),
      exitTime: trade.exitTime ? new Date(trade.exitTime) : new Date(trade.entryTime || Date.now()),
      timeframe: trade.timeframe || '1m',
      candleTime: trade.entryTime ? new Date(trade.entryTime).toTimeString().slice(0, 5) : '00:00',
      refunded: 0,
      executed: 1,
      status: trade.result === 'win' ? 'WIN' : 'LOSE',
      result: trade.result || 'tie',
      profit: parseFloat(trade.pnl) || parseFloat(trade.profit) || 0,
      payout: trade.result === 'win' ? (parseFloat(trade.amount) || 0) + (parseFloat(trade.pnl) || 0) : 0,
      platform: 'Ebinex',
      strategy: 'Imported',
      notes: 'Imported from CSV',
      createdAt: new Date(trade.entryTime || Date.now()),
      updatedAt: new Date(),
      importedAt: new Date(),
      importBatch: 'csv-import'
    }));

    // Generate calendar data by grouping trades by date
    const calendarMap = new Map<string, { pnl: number; trades: number; wins: number }>();
    
    formattedTrades.forEach(trade => {
      const dateStr = trade.entryTime.toISOString().split('T')[0];
      const existing = calendarMap.get(dateStr) || { pnl: 0, trades: 0, wins: 0 };
      
      existing.pnl += trade.profit;
      existing.trades += 1;
      if (trade.result === 'win') existing.wins += 1;
      
      calendarMap.set(dateStr, existing);
    });

    const calendarData: CalendarData[] = Array.from(calendarMap.entries()).map(([date, data]) => ({
      date,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
    }));

    // Sort calendar data by date (newest first for trades, but keep all dates for calendar)
    calendarData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Sort trades by entry time (newest first)
    formattedTrades.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());

    return {
      trades: formattedTrades,
      stats: {
        totalTrades: rawStats.totalTrades || formattedTrades.length,
        winTrades: rawStats.winTrades || formattedTrades.filter(t => t.result === 'win').length,
        lossTrades: rawStats.lossTrades || formattedTrades.filter(t => t.result === 'loss').length,
        winRate: rawStats.winRate || (formattedTrades.length > 0 ? 
          (formattedTrades.filter(t => t.result === 'win').length / formattedTrades.length * 100) : 0),
        totalProfit: rawStats.totalProfit || formattedTrades.reduce((sum, t) => sum + t.profit, 0),
        avgStake: rawStats.avgStake || (formattedTrades.length > 0 ? 
          formattedTrades.reduce((sum, t) => sum + t.amount, 0) / formattedTrades.length : 0)
      },
      calendarData,
      hasData: true,
      lastUpdated: new Date()
    };
  }, []);

  // Load data from localStorage
  const loadData = useCallback(() => {
    try {
      const hasImportedData = localStorage.getItem('binaryHub_hasData') === 'true';
      
      if (!hasImportedData) {
        setData(prevData => ({
          ...prevData,
          hasData: false,
          trades: [],
          calendarData: []
        }));
        return;
      }

      const tradesJson = localStorage.getItem('binaryHub_trades');
      const statsJson = localStorage.getItem('binaryHub_stats');

      if (tradesJson && statsJson) {
        const rawTrades = JSON.parse(tradesJson);
        const rawStats = JSON.parse(statsJson);
        
        const processedData = processRawCsvData(rawTrades, rawStats);
        setData(processedData);
      } else {
        // Data marked as imported but no actual data found
        setData(prevData => ({
          ...prevData,
          hasData: false,
          trades: [],
          calendarData: []
        }));
      }
    } catch (error) {
      console.error('Error loading CSV trade data:', error);
      setData(prevData => ({
        ...prevData,
        hasData: false,
        trades: [],
        calendarData: []
      }));
    }
  }, [processRawCsvData]);

  // Load data on mount and when localStorage changes
  useEffect(() => {
    loadData();

    // Listen for localStorage changes (from CSV uploads)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'binaryHub_hasData' || e.key === 'binaryHub_trades' || e.key === 'binaryHub_stats') {
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (for same-window updates)
    const handleCustomEvent = () => loadData();
    window.addEventListener('csvDataUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('csvDataUpdated', handleCustomEvent);
    };
  }, [loadData]);

  return data;
}

// Helper function to trigger data reload (for same-window updates)
export function triggerCsvDataUpdate() {
  window.dispatchEvent(new CustomEvent('csvDataUpdated'));
}
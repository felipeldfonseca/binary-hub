// Lean rebuild shim - market accounts handled by MarketContextSupabase
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketAccount, MarketType } from '@/types/markets';

interface UseMarketAccountsReturn {
  marketAccounts: MarketAccount[];
  primaryMarket: MarketAccount | null;
  activeMarket: MarketAccount | null;
  isLoading: boolean;
  error: string | null;
  refreshAccounts: () => Promise<void>;
  setActiveMarket: (marketType: MarketType) => void;
  switchToPrimaryMarket: () => void;
}

// Default market account for lean rebuild
const defaultAccount: MarketAccount = {
  id: 'default',
  userId: 'default-user',
  marketType: 'binary',
  displayName: 'Binary Options',
  isPrimary: true,
  isActive: true,
  bankroll: {
    initial: 1000,
    current: 1000,
    currency: 'USD',
    history: [],
  },
  performance: {
    totalTrades: 0,
    winRate: 0,
    profitLoss: 0,
    roi: 0,
    bestTrade: 0,
    worstTrade: 0,
    averageTrade: 0,
    currentStreak: 0,
    bestStreak: 0,
    worstStreak: 0,
  },
  settings: {
    defaultStakeType: 'fixed',
    defaultStakeAmount: 10,
    defaultStakePercentage: 2,
    maxDailyTrades: 10,
    maxDailyLoss: 100,
    maxDailyLossPercentage: 10,
    stopLossEnabled: true,
    takeProfitEnabled: true,
    notifications: {
      tradeAlerts: true,
      dailySummary: true,
      weeklyReport: true,
      goalProgress: true,
    },
    display: {
      showProfitInPercentage: true,
      showPerformanceMetrics: true,
      theme: 'dark',
      timezone: 'America/New_York',
      chartType: 'candlestick',
      defaultTimeframe: '1h',
    },
  },
  brokerConnections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function useMarketAccounts(): UseMarketAccountsReturn {
  const [marketAccounts] = useState<MarketAccount[]>([defaultAccount]);
  const [activeMarket, setActiveMarketState] = useState<MarketAccount | null>(defaultAccount);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);

  const primaryMarket = defaultAccount;

  useEffect(() => {
    // Simulate loading completion
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const refreshAccounts = useCallback(async () => {
    console.log('useMarketAccounts: Lean rebuild mode - no API calls');
  }, []);

  const setActiveMarket = useCallback(
    (marketType: MarketType) => {
      const account = marketAccounts.find((acc) => acc.marketType === marketType);
      if (account) {
        setActiveMarketState(account);
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeMarketType', marketType);
        }
      }
    },
    [marketAccounts]
  );

  const switchToPrimaryMarket = useCallback(() => {
    setActiveMarketState(primaryMarket);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeMarketType', primaryMarket.marketType);
    }
  }, [primaryMarket]);

  return {
    marketAccounts,
    primaryMarket,
    activeMarket,
    isLoading,
    error,
    refreshAccounts,
    setActiveMarket,
    switchToPrimaryMarket,
  };
}

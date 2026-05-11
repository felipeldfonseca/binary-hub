'use client';

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { MarketAccount, MarketType, MarketSelectionData } from '@/types/markets';

interface MarketContextType {
  marketAccounts: MarketAccount[];
  primaryMarket: MarketAccount | null;
  activeMarket: MarketAccount | null;
  isLoading: boolean;
  error: string | null;
  setActiveMarket: (marketType: MarketType) => void;
  refreshAccounts: () => Promise<void>;
  updateAccountBalance: (marketType: MarketType, newInitialBankroll: number) => void;
}

const MarketContext = createContext<MarketContextType | null>(null);

export function useMarketContext() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarketContext must be used within a MarketProvider');
  }
  return context;
}

/** Build a full MarketAccount from the lean onboarding MarketSelectionData */
function buildAccount(market: MarketSelectionData): MarketAccount {
  return {
    id: market.marketType,
    userId: 'local-user',
    marketType: market.marketType,
    displayName: market.displayName,
    isPrimary: market.isPrimary,
    isActive: true,
    bankroll: {
      initial: market.initialBankroll,
      current: market.initialBankroll,
      currency: market.currency,
      deposits: market.initialBankroll,
      withdrawals: 0,
      realizedPnL: 0,
      lastUpdated: new Date(),
    },
    performance: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitLoss: 0,
      profitLossPercentage: 0,
      bestTrade: 0,
      worstTrade: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      totalVolume: 0,
      averageTradeSize: 0,
      tradingDays: 0,
      averageTradesPerDay: 0,
      lastUpdated: new Date(),
    },
    settings: {
      displayName: market.displayName,
      notifications: {
        tradeAlerts: true,
        performanceReports: true,
        aiInsights: true,
        socialUpdates: false,
      },
      privacy: {
        sharePerformance: false,
        shareTradeHistory: false,
        allowFollowers: true,
      },
      preferences: {
        timezone: 'America/New_York',
        chartType: 'candlestick',
        defaultTimeframe: '1h',
      },
    },
    brokerConnections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const FALLBACK_ACCOUNT: MarketAccount = buildAccount({
  marketType: 'binary',
  displayName: 'Binary Options',
  initialBankroll: 1000,
  currency: 'USD',
  experienceLevel: 'beginner',
  isPrimary: true,
});

function loadAccountsFromStorage(): MarketAccount[] {
  try {
    const raw = localStorage.getItem('binaryHub_onboardingData');
    if (!raw) return [FALLBACK_ACCOUNT];

    const data = JSON.parse(raw) as { selectedMarkets?: MarketSelectionData[] };
    if (!data.selectedMarkets || data.selectedMarkets.length === 0) return [FALLBACK_ACCOUNT];

    return data.selectedMarkets.map(buildAccount);
  } catch {
    return [FALLBACK_ACCOUNT];
  }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [marketAccounts, setMarketAccounts] = useState<MarketAccount[]>([FALLBACK_ACCOUNT]);
  const [activeMarketType, setActiveMarketType] = useState<MarketType>('binary');

  // Load saved onboarding data once on mount (client-side only)
  useEffect(() => {
    const accounts = loadAccountsFromStorage();
    setMarketAccounts(accounts);

    // Restore previously selected active market, or default to primary
    const savedType = localStorage.getItem('activeMarketType') as MarketType | null;
    const primary = accounts.find(a => a.isPrimary) ?? accounts[0];
    const restored = savedType && accounts.find(a => a.marketType === savedType);
    setActiveMarketType(restored ? (savedType as MarketType) : primary.marketType);
  }, []);

  const primaryMarket = marketAccounts.find(a => a.isPrimary) ?? marketAccounts[0] ?? null;
  const activeMarket = marketAccounts.find(a => a.marketType === activeMarketType) ?? primaryMarket;

  const setActiveMarket = useCallback((marketType: MarketType) => {
    setActiveMarketType(marketType);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeMarketType', marketType);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    const accounts = loadAccountsFromStorage();
    setMarketAccounts(accounts);
  }, []);

  const updateAccountBalance = useCallback((marketType: MarketType, newInitialBankroll: number) => {
    try {
      const raw = localStorage.getItem('binaryHub_onboardingData');
      if (!raw) return;
      const data = JSON.parse(raw) as { selectedMarkets?: Array<{ marketType: string; initialBankroll: number; [key: string]: unknown }> };
      if (!data.selectedMarkets) return;
      data.selectedMarkets = data.selectedMarkets.map(m =>
        m.marketType === marketType ? { ...m, initialBankroll: newInitialBankroll } : m
      );
      localStorage.setItem('binaryHub_onboardingData', JSON.stringify(data));
    } catch { /* ignore */ }
    // Reload accounts from updated storage
    const accounts = loadAccountsFromStorage();
    setMarketAccounts(accounts);
  }, []);

  const value: MarketContextType = {
    marketAccounts,
    primaryMarket,
    activeMarket,
    isLoading: false,
    error: null,
    setActiveMarket,
    refreshAccounts,
    updateAccountBalance,
  };

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
}

// Legacy hook for backward compatibility
export function useMarketAccounts() {
  return useMarketContext();
}

'use client';

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { MarketAccount, MarketType, MarketSelectionData } from '@/types/markets';
import { useAuth } from '@/lib/contexts/AuthContextSupabase';
import { createDataClient } from '@/lib/supabase';

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

export const FALLBACK_ACCOUNT: MarketAccount = buildAccount({
  marketType: 'binary',
  displayName: 'Binary Options',
  initialBankroll: 1000,
  currency: 'USD',
  experienceLevel: 'beginner',
  isPrimary: true,
});

function loadAccountsFromStorage(): MarketSelectionData[] | null {
  try {
    const raw = localStorage.getItem('binaryHub_onboardingData');
    if (!raw) return null;
    const data = JSON.parse(raw) as { selectedMarkets?: MarketSelectionData[] };
    if (!data.selectedMarkets || data.selectedMarkets.length === 0) return null;
    return data.selectedMarkets;
  } catch {
    return null;
  }
}

function saveAccountsToStorage(markets: MarketSelectionData[]) {
  try {
    const raw = localStorage.getItem('binaryHub_onboardingData');
    const data = raw ? JSON.parse(raw) : {};
    data.selectedMarkets = markets;
    localStorage.setItem('binaryHub_onboardingData', JSON.stringify(data));
  } catch { /* ignore */ }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [marketAccounts, setMarketAccounts] = useState<MarketAccount[]>([FALLBACK_ACCOUNT]);
  const [activeMarketType, setActiveMarketType] = useState<MarketType>('binary');
  const [isLoading, setIsLoading] = useState(true);

  // Load accounts: Supabase first, localStorage fallback
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try Supabase if authenticated
      if (user && session?.access_token) {
        const db = createDataClient(session.access_token);
        const { data } = await db
          .from('profiles')
          .select('market_accounts')
          .eq('id', user.id)
          .single();

        const remote = (data as { market_accounts?: MarketSelectionData[] } | null)?.market_accounts;
        if (remote && remote.length > 0) {
          // Sync back to localStorage so offline works
          saveAccountsToStorage(remote);
          const accounts = remote.map(buildAccount);
          setMarketAccounts(accounts);

          const savedType = localStorage.getItem('activeMarketType') as MarketType | null;
          const primary = accounts.find(a => a.isPrimary) ?? accounts[0];
          const restored = savedType && accounts.find(a => a.marketType === savedType);
          setActiveMarketType(restored ? (savedType as MarketType) : primary.marketType);
          return;
        }
      }

      // Fall back to localStorage
      const local = loadAccountsFromStorage();
      if (local) {
        const accounts = local.map(buildAccount);
        setMarketAccounts(accounts);

        const savedType = localStorage.getItem('activeMarketType') as MarketType | null;
        const primary = accounts.find(a => a.isPrimary) ?? accounts[0];
        const restored = savedType && accounts.find(a => a.marketType === savedType);
        setActiveMarketType(restored ? (savedType as MarketType) : primary.marketType);
      } else {
        setMarketAccounts([FALLBACK_ACCOUNT]);
        setActiveMarketType('binary');
      }
    } catch {
      const local = loadAccountsFromStorage();
      const accounts = local ? local.map(buildAccount) : [FALLBACK_ACCOUNT];
      setMarketAccounts(accounts);
    } finally {
      setIsLoading(false);
    }
  // Depend on user.id (stable string) not the user object, which is recreated
  // on every auth event even for the same user — avoiding unnecessary reloads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /** Persist markets array to both localStorage and Supabase */
  const persistMarkets = useCallback(async (markets: MarketSelectionData[]) => {
    saveAccountsToStorage(markets);
    if (user && session?.access_token) {
      try {
        const db = createDataClient(session.access_token);
        await db
          .from('profiles')
          .update({ market_accounts: markets as unknown[] } as Record<string, unknown>)
          .eq('id', user.id);
      } catch { /* non-fatal */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  const primaryMarket = marketAccounts.find(a => a.isPrimary) ?? marketAccounts[0] ?? null;
  const activeMarket = marketAccounts.find(a => a.marketType === activeMarketType) ?? primaryMarket;

  const setActiveMarket = useCallback((marketType: MarketType) => {
    setActiveMarketType(marketType);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeMarketType', marketType);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    await loadAccounts();
  }, [loadAccounts]);

  const updateAccountBalance = useCallback((marketType: MarketType, newInitialBankroll: number) => {
    // Update in-memory accounts immediately
    setMarketAccounts(prev => prev.map(acc =>
      acc.marketType === marketType
        ? { ...acc, bankroll: { ...acc.bankroll, initial: newInitialBankroll } }
        : acc
    ));

    // Persist: read current markets, update the matching one, save
    const current = loadAccountsFromStorage();
    if (current) {
      const updated = current.map(m =>
        m.marketType === marketType ? { ...m, initialBankroll: newInitialBankroll } : m
      );
      persistMarkets(updated);
    }
  }, [persistMarkets]);

  const value: MarketContextType = useMemo(() => ({
    marketAccounts,
    primaryMarket,
    activeMarket,
    isLoading,
    error: null,
    setActiveMarket,
    refreshAccounts,
    updateAccountBalance,
  }), [marketAccounts, primaryMarket, activeMarket, isLoading, setActiveMarket, refreshAccounts, updateAccountBalance]);

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

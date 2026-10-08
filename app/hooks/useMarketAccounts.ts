// Lean rebuild shim - market accounts handled by MarketContextSupabase
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketAccount, MarketType } from '@/types/markets';
import { FALLBACK_ACCOUNT } from '@/lib/contexts/MarketContextSupabase';

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
const defaultAccount: MarketAccount = FALLBACK_ACCOUNT;

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

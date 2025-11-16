'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { MarketAccount, MarketType } from '@/types/markets'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'

interface MarketContextType {
  marketAccounts: MarketAccount[]
  primaryMarket: MarketAccount | null
  activeMarket: MarketAccount | null
  isLoading: boolean
  error: string | null
  setActiveMarket: (marketType: MarketType) => void
  refreshAccounts: () => Promise<void>
}

const MarketContext = createContext<MarketContextType | null>(null)

export function useMarketContext() {
  const context = useContext(MarketContext)
  if (!context) {
    throw new Error('useMarketContext must be used within a MarketProvider')
  }
  return context
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [marketAccounts, setMarketAccounts] = useState<MarketAccount[]>([])
  const [activeMarket, setActiveMarketState] = useState<MarketAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const primaryMarket = marketAccounts.find(account => account.isPrimary) || null

  const fetchMarketAccounts = useCallback(async () => {
    if (!user) {
      setMarketAccounts([])
      setActiveMarketState(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const token = await auth.currentUser?.getIdToken()
      const response = await fetch('/api/v1/markets/setup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch market accounts')
      }

      const data = await response.json()
      
      if (data.success) {
        const accounts = data.marketAccounts as MarketAccount[]
        setMarketAccounts(accounts)
        
        // Restore active market from localStorage or use primary
        const savedMarketType = localStorage.getItem('activeMarketType') as MarketType
        if (savedMarketType) {
          const savedAccount = accounts.find(acc => acc.marketType === savedMarketType)
          if (savedAccount) {
            setActiveMarketState(savedAccount)
            return
          }
        }
        
        // Fallback to primary market
        const primary = accounts.find(account => account.isPrimary)
        setActiveMarketState(primary || accounts[0] || null)
      } else {
        throw new Error(data.error || 'Failed to fetch market accounts')
      }
    } catch (err) {
      console.error('Error fetching market accounts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const setActiveMarket = useCallback((marketType: MarketType) => {
    const account = marketAccounts.find(acc => acc.marketType === marketType)
    if (account) {
      setActiveMarketState(account)
      // Store preference in localStorage for persistence across pages
      localStorage.setItem('activeMarketType', marketType)
    }
  }, [marketAccounts])

  // Load accounts when user changes
  useEffect(() => {
    fetchMarketAccounts()
  }, [fetchMarketAccounts])

  const value: MarketContextType = {
    marketAccounts,
    primaryMarket,
    activeMarket,
    isLoading,
    error,
    setActiveMarket,
    refreshAccounts: fetchMarketAccounts,
  }

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  )
}

// Legacy hook for backward compatibility
export function useMarketAccounts() {
  return useMarketContext()
}
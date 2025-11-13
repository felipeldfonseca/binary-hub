'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { MarketAccount, MarketType } from '@/types/markets'

interface UseMarketAccountsReturn {
  marketAccounts: MarketAccount[]
  primaryMarket: MarketAccount | null
  activeMarket: MarketAccount | null
  isLoading: boolean
  error: string | null
  refreshAccounts: () => Promise<void>
  setActiveMarket: (marketType: MarketType) => void
  switchToPrimaryMarket: () => void
}

export function useMarketAccounts(): UseMarketAccountsReturn {
  const { user } = useAuth()
  const [marketAccounts, setMarketAccounts] = useState<MarketAccount[]>([])
  const [activeMarket, setActiveMarketState] = useState<MarketAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const primaryMarket = marketAccounts.find(account => account.isPrimary) || null

  const fetchMarketAccounts = async () => {
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
        
        // Set active market to primary or first account
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
  }

  const setActiveMarket = (marketType: MarketType) => {
    const account = marketAccounts.find(acc => acc.marketType === marketType)
    if (account) {
      setActiveMarketState(account)
      // Store preference in localStorage
      localStorage.setItem('activeMarketType', marketType)
    }
  }

  const switchToPrimaryMarket = () => {
    if (primaryMarket) {
      setActiveMarketState(primaryMarket)
      localStorage.setItem('activeMarketType', primaryMarket.marketType)
    }
  }

  // Load accounts when user changes
  useEffect(() => {
    fetchMarketAccounts()
  }, [user])

  // Restore active market from localStorage
  useEffect(() => {
    if (marketAccounts.length > 0 && !activeMarket) {
      const savedMarketType = localStorage.getItem('activeMarketType') as MarketType
      if (savedMarketType) {
        const savedAccount = marketAccounts.find(acc => acc.marketType === savedMarketType)
        if (savedAccount) {
          setActiveMarketState(savedAccount)
          return
        }
      }
      
      // Fallback to primary market
      const primary = marketAccounts.find(account => account.isPrimary)
      setActiveMarketState(primary || marketAccounts[0])
    }
  }, [marketAccounts])

  return {
    marketAccounts,
    primaryMarket,
    activeMarket,
    isLoading,
    error,
    refreshAccounts: fetchMarketAccounts,
    setActiveMarket,
    switchToPrimaryMarket
  }
}
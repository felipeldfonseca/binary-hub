'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import MarketTabs from '@/components/markets/MarketTabs'
import { DashboardV1Modern } from '@/components/lazy'
import LazyWrapper from '@/components/shared/LazyWrapper'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isPortuguese } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [hasMarketAccounts, setHasMarketAccounts] = useState(false)

  // Check if user has completed onboarding (has market accounts)
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      console.log('Dashboard: Checking onboarding status for user:', user?.uid)
      if (!user) return
      
      try {
        // Get Firebase auth token
        const token = await (await import('@/lib/firebase')).auth.currentUser?.getIdToken()
        const response = await fetch('/api/v1/markets/setup', {
          headers: {
            'Authorization': `Bearer ${token || 'mock-token-for-testing'}`
          }
        })
        
        console.log('Dashboard: API response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('Dashboard: API response data:', data)
          
          if (data.success && data.marketAccounts?.length > 0) {
            console.log(`Dashboard: Found ${data.marketAccounts.length} market accounts, showing dashboard`)
            setHasMarketAccounts(true)
          } else {
            console.log('Dashboard: No market accounts found, redirecting to onboarding')
            // No market accounts, redirect to onboarding
            router.push(isPortuguese ? '/onboarding?lang=pt' : '/onboarding')
            return
          }
        } else {
          console.log('Dashboard: API response not ok, redirecting to onboarding')
        }
      } catch (error) {
        console.error('Dashboard: Error checking onboarding status:', error)
        // On error, redirect to onboarding to be safe
        router.push(isPortuguese ? '/onboarding?lang=pt' : '/onboarding')
        return
      }
      
      setIsLoading(false)
    }

    checkOnboardingStatus()
  }, [user, router, isPortuguese])

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400">
              {isPortuguese ? 'Carregando...' : 'Loading...'}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Only render dashboard if user has market accounts
  if (!hasMarketAccounts) {
    return null // Will redirect to onboarding
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
        {/* Market Tabs */}
        <div className="pt-24">
          <MarketTabs />
        </div>
        
        <main className="relative pt-8 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto">
              <LazyWrapper
                threshold={0.1}
                rootMargin="100px"
                onLoad={() => {
                  // Preload other dashboard components
                  import('@/components/lazy').then(({ RecentTrades, TradingCalendar }) => {
                    // Components preloaded for faster navigation
                  })
                }}
              >
                <DashboardV1Modern />
              </LazyWrapper>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
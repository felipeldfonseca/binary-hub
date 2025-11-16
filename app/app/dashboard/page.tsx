'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import MarketTabs from '@/components/markets/MarketTabs'
import { DashboardV1Modern } from '@/components/lazy'
import LazyWrapper from '@/components/shared/LazyWrapper'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { isPortuguese } = useLanguage()
  const { marketAccounts, isLoading } = useMarketContext()
  const router = useRouter()

  // Redirect to onboarding if no market accounts
  React.useEffect(() => {
    if (!isLoading && marketAccounts.length === 0) {
      router.push(isPortuguese ? '/onboarding?lang=pt' : '/onboarding')
    }
  }, [isLoading, marketAccounts, router, isPortuguese])

  // Show loading while checking market accounts
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

  // Return null while redirecting to onboarding
  if (marketAccounts.length === 0) {
    return null
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
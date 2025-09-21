'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { TradesList, LoadingSkeletons } from '@/components/lazy'
import { ChartErrorBoundary } from '@/components/error/ErrorBoundary'
import LazyWrapper from '@/components/shared/LazyWrapper'

// Lazy load the professional trades component
const TradesV1Professional = React.lazy(() => import('@/components/trades/versions/TradesV1Professional'))

export default function TradesPage() {
  return (
    <ProtectedRoute>
      <ChartErrorBoundary>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="relative pt-32 pb-16">
            <div className="container mx-auto px-4 sm:px-8 lg:px-12">
              <div className="max-w-7xl mx-auto">
                <LazyWrapper
                  threshold={0.1}
                  rootMargin="50px"
                  fallback={<LoadingSkeletons.TradesList />}
                >
                  <React.Suspense fallback={<LoadingSkeletons.TradesList />}>
                    <TradesV1Professional />
                  </React.Suspense>
                </LazyWrapper>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </ChartErrorBoundary>
    </ProtectedRoute>
  )
}
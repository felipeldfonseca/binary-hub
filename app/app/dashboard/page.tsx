'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { DashboardV1Modern } from '@/components/lazy'
import LazyWrapper from '@/components/shared/LazyWrapper'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
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
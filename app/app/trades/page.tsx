'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import TradesV1Professional from '@/components/trades/versions/TradesV1Professional'
import { ChartErrorBoundary } from '@/components/error/ErrorBoundary'

export default function TradesPage() {
  return (
    <ProtectedRoute>
      <ChartErrorBoundary>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="relative pt-32 pb-16">
            <div className="container mx-auto px-4 sm:px-8 lg:px-12">
              <div className="max-w-7xl mx-auto">
                <TradesV1Professional />
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </ChartErrorBoundary>
    </ProtectedRoute>
  )
}
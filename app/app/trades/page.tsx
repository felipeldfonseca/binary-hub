'use client'
import React, { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import VersionSelector, { Version } from '@/components/ui/VersionSelector'
import TradesV1Professional from '@/components/trades/versions/TradesV1Professional'
import TradesV2VisualCards from '@/components/trades/versions/TradesV2VisualCards'
import TradesV3AnalyticsDashboard from '@/components/trades/versions/TradesV3AnalyticsDashboard'
import { ChartErrorBoundary } from '@/components/error/ErrorBoundary'

export default function TradesPage() {
  const [selectedVersion, setSelectedVersion] = useState<Version>('v1')

  const renderTradesVersion = () => {
    switch (selectedVersion) {
      case 'v1':
        return <TradesV1Professional />
      case 'v2':
        return <TradesV2VisualCards />
      case 'v3':
        return <TradesV3AnalyticsDashboard />
      default:
        return <TradesV1Professional />
    }
  }

  return (
    <ChartErrorBoundary>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto">
              <VersionSelector 
                currentVersion={selectedVersion}
                onVersionChange={setSelectedVersion}
                type="trades"
              />
              
              {renderTradesVersion()}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ChartErrorBoundary>
  )
}
'use client'
import React, { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import VersionSelector, { Version } from '@/components/ui/VersionSelector'
import DashboardV1Modern from '@/components/dashboard/versions/DashboardV1Modern'
import DashboardV2Gamified from '@/components/dashboard/versions/DashboardV2Gamified'
import DashboardV3AIAnalytics from '@/components/dashboard/versions/DashboardV3AIAnalytics'

export default function DashboardPage() {
  const [selectedVersion, setSelectedVersion] = useState<Version>('v1')

  const renderDashboardVersion = () => {
    switch (selectedVersion) {
      case 'v1':
        return <DashboardV1Modern />
      case 'v2':
        return <DashboardV2Gamified />
      case 'v3':
        return <DashboardV3AIAnalytics />
      default:
        return <DashboardV1Modern />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <VersionSelector 
              currentVersion={selectedVersion}
              onVersionChange={setSelectedVersion}
              type="dashboard"
            />
            
            {renderDashboardVersion()}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
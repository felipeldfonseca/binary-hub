'use client'

import React, { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import VersionSelector, { Version } from '@/components/ui/VersionSelector'
import AIV1Professional from './versions/AIV1Professional'
import AIV2Gamified from './versions/AIV2Gamified'
import AIV3Advanced from './versions/AIV3Advanced'

export default function AILayout() {
  const { isPortuguese } = useLanguage()
  const [currentVersion, setCurrentVersion] = useState<Version>('v1')

  const renderVersionComponent = () => {
    switch (currentVersion) {
      case 'v1':
        return <AIV1Professional />
      case 'v2':
        return <AIV2Gamified />
      case 'v3':
        return <AIV3Advanced />
      default:
        return <AIV1Professional />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Version Selector */}
            <VersionSelector
              currentVersion={currentVersion}
              onVersionChange={setCurrentVersion}
              type="ai"
            />
            
            {/* Version Component */}
            {renderVersionComponent()}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
'use client'

import React, { useState } from 'react'
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
    <div className="min-h-screen bg-dark-background">
      <div className="container mx-auto px-4 py-8">
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
  )
}
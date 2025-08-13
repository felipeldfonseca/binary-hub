'use client'
import React, { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import AnalyticsVersionSelector from './AnalyticsVersionSelector'
import AnalyticsV1Professional from './versions/AnalyticsV1Professional'
import AnalyticsV2Gamified from './versions/AnalyticsV2Gamified'
import AnalyticsV3AIPowered from './versions/AnalyticsV3AIPowered'
// import VersionSelector from '../ui/VersionSelector'

// Temporary version selector component
function VersionSelector({ 
  currentVersion, 
  versionOptions, 
  onVersionChange, 
  onShowSelector,
  featureType 
}: {
  currentVersion: string
  versionOptions: any[]
  onVersionChange: (version: string) => void
  onShowSelector: () => void
  featureType: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onShowSelector}
        className="bg-gray-800/90 backdrop-blur-sm border border-gray-600/50 rounded-lg px-4 py-2 text-white text-sm hover:bg-gray-700/90 transition-all shadow-lg"
      >
        📊 {currentVersion.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </button>
    </div>
  )
}

export default function AnalyticsLayout() {
  const { isPortuguese } = useLanguage()
  const [currentVersion, setCurrentVersion] = useState('v1-professional')
  const [showVersionSelector, setShowVersionSelector] = useState(false)

  const renderCurrentVersion = () => {
    switch (currentVersion) {
      case 'v1-professional':
        return <AnalyticsV1Professional />
      case 'v2-gamified':
        return <AnalyticsV2Gamified />
      case 'v2-visual':
        return (
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="card text-center py-16">
                <div className="text-6xl mb-6">📈</div>
                <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
                  {isPortuguese ? 'Analytics V2 Visual' : 'Analytics V2 Visual'}
                </h3>
                <p className="text-gray-300 mb-6">
                  {isPortuguese 
                    ? 'Interface visual com gráficos interativos e dashboards dinâmicos em desenvolvimento.'
                    : 'Visual interface with interactive charts and dynamic dashboards under development.'
                  }
                </p>
                <button 
                  onClick={() => setCurrentVersion('v1-professional')}
                  className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-6 py-3 rounded-lg hover:shadow-lg transition-all font-comfortaa"
                >
                  {isPortuguese ? '← Voltar para V1 Professional' : '← Back to V1 Professional'}
                </button>
              </div>
            </div>
          </div>
        )
      case 'v3-ai-powered':
        return <AnalyticsV3AIPowered />
      default:
        return <AnalyticsV1Professional />
    }
  }

  const versionOptions = [
    {
      id: 'v1-professional',
      name: isPortuguese ? 'V1 Professional' : 'V1 Professional',
      description: isPortuguese ? 'Estilo Bloomberg' : 'Bloomberg Style',
      available: true
    },
    {
      id: 'v2-gamified',
      name: isPortuguese ? 'V2 Gamificado' : 'V2 Gamified',
      description: isPortuguese ? 'Visual & Jogos' : 'Visual & Gaming',
      available: true
    },
    {
      id: 'v2-visual',
      name: isPortuguese ? 'V2 Visual' : 'V2 Visual', 
      description: isPortuguese ? 'Em Breve' : 'Coming Soon',
      available: false
    },
    {
      id: 'v3-ai-powered',
      name: isPortuguese ? 'V3 IA Avançada' : 'V3 AI-Powered',
      description: isPortuguese ? 'Machine Learning' : 'Machine Learning', 
      available: true
    }
  ]

  if (showVersionSelector) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <button
              onClick={() => setShowVersionSelector(false)}
              className="text-gray-400 hover:text-white transition-colors mb-4 font-comfortaa"
            >
              ← {isPortuguese ? 'Voltar para Analytics' : 'Back to Analytics'}
            </button>
            <h1 className="hero-title text-3xl md:text-4xl font-poly font-bold text-white mb-4">
              {isPortuguese ? 'Escolher Versão de Analytics' : 'Choose Analytics Version'}
            </h1>
            <p className="text-xl font-comfortaa font-normal text-white max-w-3xl mx-auto">
              {isPortuguese 
                ? 'Selecione a experiência de analytics que melhor atende às suas necessidades.'
                : 'Select the analytics experience that best fits your needs.'
              }
            </p>
          </div>

          <AnalyticsVersionSelector 
            currentVersion={currentVersion}
            onVersionChange={(version) => {
              setCurrentVersion(version)
              setShowVersionSelector(false)
            }}
          />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative pt-32 pb-16">
        {/* Floating Version Selector Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <VersionSelector
            currentVersion={currentVersion}
            versionOptions={versionOptions}
            onVersionChange={setCurrentVersion}
            onShowSelector={() => setShowVersionSelector(true)}
            featureType="Analytics"
          />
        </div>

        {/* Current Version Content */}
        {renderCurrentVersion()}
      </main>
      <Footer />
    </div>
  )
}
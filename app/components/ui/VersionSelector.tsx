'use client'
import React from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export type Version = 'v1' | 'v2' | 'v3'

interface VersionSelectorProps {
  currentVersion: Version
  onVersionChange: (version: Version) => void
  type: 'dashboard' | 'trades'
}

const versionInfo = {
  dashboard: {
    v1: {
      name: 'Modern Metrics',
      description: 'Bloomberg/TradingView style professional analytics',
      icon: '📊',
      color: 'from-blue-800/20 to-green-800/20',
      features: ['Interactive Charts', 'Real-time Metrics', 'Technical Analysis', 'Visual Calendar', 'Economic Events']
    },
    v2: {
      name: 'Gamified Dashboard', 
      description: 'Achievements, streaks, and gamification elements',
      icon: '🎮',
      color: 'from-purple-800/20 to-pink-800/20',
      features: ['Achievement System', 'Streak Tracking', 'Level Progression', 'Badges', 'Leaderboards']
    },
    v3: {
      name: 'AI Analytics',
      description: 'AI-powered insights and predictive analytics',
      icon: '🤖',
      color: 'from-orange-800/20 to-red-800/20',
      features: ['AI Insights', 'Predictive Models', 'Smart Recommendations', 'Pattern Recognition', 'Risk Analysis']
    }
  },
  trades: {
    v1: {
      name: 'Professional Table',
      description: 'Excel/Airtable-style advanced table interface',
      icon: '📋',
      color: 'from-indigo-800/20 to-blue-800/20',
      features: ['Advanced Table', 'Bulk Actions', 'Advanced Filters', 'CSV Export', 'Dynamic Sorting']
    },
    v2: {
      name: 'Visual Cards',
      description: 'Card-based visual interface with rich graphics',
      icon: '🎴',
      color: 'from-green-800/20 to-teal-800/20',
      features: ['Card Layout', 'Visual Stats', 'Drag & Drop', 'Quick Actions', 'Rich Graphics']
    },
    v3: {
      name: 'Analytics Dashboard',
      description: 'Advanced analytics with charts and insights',
      icon: '📈',
      color: 'from-yellow-800/20 to-orange-800/20',
      features: ['Advanced Charts', 'Performance Analytics', 'Trend Analysis', 'Risk Metrics', 'Profit Optimization']
    }
  }
}

export default function VersionSelector({ currentVersion, onVersionChange, type }: VersionSelectorProps) {
  const { isPortuguese } = useLanguage()
  
  const versions = versionInfo[type]

  return (
    <div className="mb-8">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">
          {isPortuguese ? `Escolha a Versão do ${type === 'dashboard' ? 'Dashboard' : 'Gerenciador de Trades'}` : `Choose ${type === 'dashboard' ? 'Dashboard' : 'Trades'} Version`}
        </h2>
        <p className="text-gray-400 text-sm">
          {isPortuguese ? 'Selecione a versão que melhor atende às suas necessidades' : 'Select the version that best fits your needs'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(versions).map(([version, info]) => (
          <button
            key={version}
            onClick={() => onVersionChange(version as Version)}
            className={`card p-6 text-left transition-all duration-300 transform hover:scale-105 ${
              currentVersion === version 
                ? `bg-gradient-to-r ${info.color} border-primary/50 shadow-glow` 
                : 'hover:bg-dark-card/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{info.icon}</span>
              <div>
                <h3 className="font-bold text-white">
                  V{version.charAt(1)} - {info.name}
                </h3>
                <p className="text-xs text-gray-400">{info.description}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {info.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  {feature}
                </div>
              ))}
            </div>

            {currentVersion === version && (
              <div className="mt-3 pt-3 border-t border-primary/20">
                <div className="flex items-center gap-2 text-primary text-sm font-medium">
                  <span>✓</span>
                  {isPortuguese ? 'Versão Ativa' : 'Active Version'}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
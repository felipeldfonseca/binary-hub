'use client'
import React from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface AnalyticsVersion {
  id: string
  name: string
  description: string
  icon: string
  badge?: string
  available: boolean
}

interface AnalyticsVersionSelectorProps {
  currentVersion: string
  onVersionChange: (version: string) => void
}

export default function AnalyticsVersionSelector({ 
  currentVersion, 
  onVersionChange 
}: AnalyticsVersionSelectorProps) {
  const { isPortuguese } = useLanguage()

  const versions: AnalyticsVersion[] = [
    {
      id: 'v1-professional',
      name: isPortuguese ? 'V1 Profissional' : 'V1 Professional',
      description: isPortuguese 
        ? 'Estilo Bloomberg com métricas avançadas, análise de risco e insights profissionais'
        : 'Bloomberg-style with advanced metrics, risk analysis and professional insights',
      icon: '📊',
      badge: isPortuguese ? 'PROFISSIONAL' : 'PROFESSIONAL',
      available: true
    },
    {
      id: 'v2-dashboard',
      name: isPortuguese ? 'V2 Dashboard' : 'V2 Dashboard',
      description: isPortuguese 
        ? 'Dashboard visual com gráficos interativos, análise temporal, distribuição de ativos e métricas de performance'
        : 'Visual dashboard with interactive charts, temporal analysis, asset distribution and performance metrics',
      icon: '📈',
      badge: isPortuguese ? 'NOVO' : 'NEW',
      available: true
    },
    {
      id: 'v2-gamified',
      name: isPortuguese ? 'V2 Gamificado' : 'V2 Gamified',
      description: isPortuguese 
        ? 'Interface visual Pinterest-style com sistema de níveis, conquistas, desafios e aprendizado gamificado'
        : 'Pinterest-style visual interface with level system, achievements, challenges and gamified learning',
      icon: '🎮',
      badge: isPortuguese ? 'GAMIFICADO' : 'GAMIFIED',
      available: true
    },
    {
      id: 'v2-visual',
      name: isPortuguese ? 'V2 Visual' : 'V2 Visual',
      description: isPortuguese 
        ? 'Interface visual com gráficos interativos e dashboards dinâmicos (Em Breve)'
        : 'Visual interface with interactive charts and dynamic dashboards (Coming Soon)',
      icon: '🎨',
      badge: isPortuguese ? 'EM BREVE' : 'COMING SOON',
      available: false
    },
    {
      id: 'v3-ai-powered',
      name: isPortuguese ? 'V3 IA Avançada' : 'V3 AI-Powered',
      description: isPortuguese 
        ? 'Analytics alimentado por IA com previsões e recomendações automatizadas'
        : 'AI-powered analytics with predictions and automated recommendations',
      icon: '🤖',
      badge: isPortuguese ? 'IA AVANÇADA' : 'AI-POWERED',
      available: true
    }
  ]

  return (
    <div className="card bg-gradient-to-br from-gray-900/40 to-gray-800/40 border-gray-600/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white font-comfortaa">
          {isPortuguese ? 'Versões de Analytics' : 'Analytics Versions'}
        </h3>
        <div className="text-sm text-gray-400">
          {isPortuguese ? 'Escolha sua experiência' : 'Choose your experience'}
        </div>
      </div>

      <div className="grid gap-4">
        {versions.map((version) => (
          <div
            key={version.id}
            onClick={() => version.available && onVersionChange(version.id)}
            className={`
              relative p-4 rounded-lg border transition-all duration-200 
              ${version.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${currentVersion === version.id 
                ? 'border-[#E1FFD9] bg-[#E1FFD9]/10 shadow-lg' 
                : version.available 
                  ? 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-700/30' 
                  : 'border-gray-700 bg-gray-800/20'
              }
            `}
          >
            {/* Badge */}
            {version.badge && (
              <div className={`
                absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold
                ${currentVersion === version.id 
                  ? 'bg-[#E1FFD9] text-[#2D3748]' 
                  : version.available 
                    ? 'bg-blue-500/20 text-blue-300' 
                    : 'bg-gray-600/20 text-gray-400'
                }
              `}>
                {version.badge}
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="text-3xl">{version.icon}</div>
              <div className="flex-1">
                <h4 className={`
                  font-bold font-comfortaa mb-2
                  ${currentVersion === version.id ? 'text-[#E1FFD9]' : 'text-white'}
                `}>
                  {version.name}
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {version.description}
                </p>
                
                {currentVersion === version.id && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#E1FFD9]">
                    <div className="w-2 h-2 bg-[#E1FFD9] rounded-full animate-pulse"></div>
                    {isPortuguese ? 'Versão Ativa' : 'Active Version'}
                  </div>
                )}
              </div>
            </div>

            {/* Features Preview for Available Versions */}
            {version.available && (
              <div className="mt-4 pt-4 border-t border-gray-600/30">
                <div className="flex flex-wrap gap-2">
                  {version.id === 'v1-professional' && (
                    <>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                        {isPortuguese ? 'Métricas Avançadas' : 'Advanced Metrics'}
                      </span>
                      <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                        {isPortuguese ? 'Análise de Risco' : 'Risk Analysis'}
                      </span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                        {isPortuguese ? 'Insights Profissionais' : 'Professional Insights'}
                      </span>
                    </>
                  )}
                  {version.id === 'v2-gamified' && (
                    <>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                        {isPortuguese ? 'Sistema de Níveis' : 'Level System'}
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                        {isPortuguese ? 'Conquistas' : 'Achievements'}
                      </span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                        {isPortuguese ? 'Desafios' : 'Challenges'}
                      </span>
                      <span className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded text-xs">
                        {isPortuguese ? 'Visual Pinterest' : 'Pinterest Style'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="text-blue-400 text-xl">💡</div>
          <div>
            <h4 className="font-bold text-blue-300 font-comfortaa">
              {isPortuguese ? 'Dica Profissional' : 'Pro Tip'}
            </h4>
            <p className="text-sm text-blue-200 mt-1">
              {isPortuguese 
                ? 'Use o V1 Professional para análises profundas de performance e identificação de oportunidades de melhoria.'
                : 'Use V1 Professional for deep performance analysis and identifying improvement opportunities.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
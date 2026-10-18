'use client'
import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Brain, TrendingUp, BarChart3, Zap, Calendar, Clock, DollarSign, Activity } from 'lucide-react'
import AIAnalysisCard from './AIAnalysisCard'
import AIAnalysisRequest from './AIAnalysisRequest'

interface AIAnalysis {
  id: string
  type: 'individual_trade' | 'daily_report' | 'weekly_report' | 'pattern_analysis'
  analysis: any
  model: string
  tokensUsed: number
  cost: number
  confidence: number
  createdAt: string
}

interface UsageStats {
  individual_trade: number
  daily_report: number
  weekly_report: number
  pattern_analysis: number
  totalCost: number
  totalTokens: number
}

interface UsageLimits {
  individual_trade: number
  daily_report: number
  weekly_report: number
  pattern_analysis: number
}

export default function AIDashboard() {
  const { isPortuguese } = useLanguage()
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null)
  const [subscription, setSubscription] = useState('free')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [newAnalysisId, setNewAnalysisId] = useState<string | null>(null)

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/v1/ai/usage', {
        headers: {
          'Authorization': `Bearer mock-token-for-testing`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setUsageStats(result.data.currentUsage)
        setUsageLimits(result.data.limits)
        setSubscription(result.data.subscription)
      }
    } catch (error) {
      console.error('Error fetching usage data:', error)
    }
  }

  const fetchAnalysisHistory = async () => {
    try {
      const queryParams = filterType !== 'all' ? `?type=${filterType}` : ''
      const response = await fetch(`/api/v1/ai/history${queryParams}`, {
        headers: {
          'Authorization': `Bearer mock-token-for-testing`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setAnalyses(result.data.analyses)
      }
    } catch (error) {
      console.error('Error fetching analysis history:', error)
    }
  }

  const pollForNewAnalysis = async (analysisId: string, maxAttempts = 30) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/v1/ai/analysis/${analysisId}`, {
          headers: {
            'Authorization': `Bearer mock-token-for-testing`
          }
        })

        if (response.ok) {
          const result = await response.json()
          // Update the analyses list
          setAnalyses(prev => [result.data, ...prev.filter(a => a.id !== analysisId)])
          setNewAnalysisId(null)
          return
        }
      } catch (error) {
        console.error('Error polling for analysis:', error)
      }

      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Timeout - refresh the list anyway
    setNewAnalysisId(null)
    fetchAnalysisHistory()
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchUsageData(), fetchAnalysisHistory()]).finally(() => {
      setLoading(false)
    })
  }, [filterType])

  const handleAnalysisRequested = (analysisId: string) => {
    setNewAnalysisId(analysisId)
    // Start polling for the new analysis
    pollForNewAnalysis(analysisId)
    // Refresh usage stats
    fetchUsageData()
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const analysisTypeNames = {
    individual_trade: isPortuguese ? 'Trade Individual' : 'Individual Trade',
    daily_report: isPortuguese ? 'Relatório Diário' : 'Daily Report',
    weekly_report: isPortuguese ? 'Relatório Semanal' : 'Weekly Report',
    pattern_analysis: isPortuguese ? 'Análise de Padrões' : 'Pattern Analysis'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeletons */}
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/2 mb-6"></div>
            <div className="h-32 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {isPortuguese ? 'Uso da IA este Mês' : 'AI Usage This Month'}
            </h2>
            <p className="text-gray-400">
              {isPortuguese ? 'Plano' : 'Plan'}: <span className="capitalize text-orange-400">{subscription}</span>
            </p>
          </div>
        </div>

        {usageStats && usageLimits && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(usageStats).map(([key, used]) => {
              if (!['individual_trade', 'daily_report', 'weekly_report', 'pattern_analysis'].includes(key)) return null
              
              const limit = usageLimits[key as keyof UsageLimits]
              const percentage = getUsagePercentage(used, limit)
              
              return (
                <div key={key} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-300">
                      {analysisTypeNames[key as keyof typeof analysisTypeNames]}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl font-bold text-white">{used}</span>
                    <span className="text-sm text-gray-400">/ {limit === 0 ? '∞' : limit}</span>
                  </div>
                  {limit > 0 && (
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${getUsageColor(percentage)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {usageStats && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <DollarSign className="h-4 w-4" />
              <span>
                {isPortuguese ? 'Custo Total' : 'Total Cost'}: 
                <span className="text-white ml-1">${usageStats.totalCost?.toFixed(4) || '0.0000'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Zap className="h-4 w-4" />
              <span>
                {isPortuguese ? 'Tokens Usados' : 'Tokens Used'}: 
                <span className="text-white ml-1">{usageStats.totalTokens?.toLocaleString() || '0'}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Request New Analysis */}
      <AIAnalysisRequest onAnalysisRequested={handleAnalysisRequested} />

      {/* Analysis History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {isPortuguese ? 'Histórico de Análises' : 'Analysis History'}
          </h2>
          
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-orange-500 outline-none"
          >
            <option value="all">{isPortuguese ? 'Todos os Tipos' : 'All Types'}</option>
            <option value="individual_trade">{analysisTypeNames.individual_trade}</option>
            <option value="daily_report">{analysisTypeNames.daily_report}</option>
            <option value="weekly_report">{analysisTypeNames.weekly_report}</option>
            <option value="pattern_analysis">{analysisTypeNames.pattern_analysis}</option>
          </select>
        </div>

        {/* Processing Indicator */}
        {newAnalysisId && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-medium text-blue-300">
                  {isPortuguese ? 'Processando Análise...' : 'Processing Analysis...'}
                </p>
                <p className="text-sm text-blue-400">
                  {isPortuguese ? 'Isso pode levar alguns minutos' : 'This may take a few minutes'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Analysis List */}
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">
                {isPortuguese ? 'Nenhuma Análise Encontrada' : 'No Analyses Found'}
              </h3>
              <p className="text-gray-500">
                {isPortuguese 
                  ? 'Solicite sua primeira análise IA para começar'
                  : 'Request your first AI analysis to get started'
                }
              </p>
            </div>
          ) : (
            analyses.map((analysis) => (
              <AIAnalysisCard 
                key={analysis.id} 
                analysis={analysis}
                onShare={() => {
                  // TODO: Implement sharing functionality
                  console.log('Share analysis:', analysis.id)
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
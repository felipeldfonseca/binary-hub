'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAI, AIInsight, AIRecommendation, ComprehensiveInsight, CoachingSession } from '@/hooks/useAI'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'

interface AIAnalysisState {
  insights: AIInsight[]
  recommendations: AIRecommendation[]
  comprehensiveAnalysis: ComprehensiveInsight | null
  coachingSessions: CoachingSession[]
  loading: boolean
  error: string | null
}

interface RiskMetric {
  label: string
  labelPT: string
  value: number
  status: 'low' | 'medium' | 'high'
  description: string
  descriptionPT: string
}

interface PatternRecognition {
  pattern: string
  patternPT: string
  confidence: number
  frequency: number
  impact: 'positive' | 'negative' | 'neutral'
  recommendation: string
  recommendationPT: string
}

export default function AIV1Professional() {
  const { isPortuguese } = useLanguage()
  const { 
    generateInsight, 
    generateComprehensiveAnalysis, 
    getCoachingSession, 
    getRecommendations,
    getInsightsHistory,
    getCoachingHistory,
    loading: aiLoading,
    error: aiError 
  } = useAI()
  
  const { stats, loading: statsLoading } = useTradeStats('monthly')
  const { trades, loading: tradesLoading } = useTrades({ limit: 100 })

  const [aiState, setAiState] = useState<AIAnalysisState>({
    insights: [],
    recommendations: [],
    comprehensiveAnalysis: null,
    coachingSessions: [],
    loading: false,
    error: null
  })

  const [activeSection, setActiveSection] = useState<'overview' | 'insights' | 'coaching' | 'recommendations' | 'patterns'>('overview')
  const [riskMetrics, setRiskMetrics] = useState<RiskMetric[]>([])
  const [patterns, setPatterns] = useState<PatternRecognition[]>([])
  const [coachingInput, setCoachingInput] = useState('')
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)

  // Calculate risk metrics based on trading data
  const calculateRiskMetrics = useCallback(() => {
    if (!stats || !trades) return []

    const metrics: RiskMetric[] = []

    // Win Rate Risk
    const winRateRisk = stats.winRate < 45 ? 'high' : stats.winRate < 60 ? 'medium' : 'low'
    metrics.push({
      label: 'Win Rate Risk',
      labelPT: 'Risco da Taxa de Acerto',
      value: stats.winRate,
      status: winRateRisk,
      description: `Current win rate: ${stats.winRate.toFixed(1)}%`,
      descriptionPT: `Taxa de acerto atual: ${stats.winRate.toFixed(1)}%`
    })

    // Drawdown Risk
    const maxDrawdown = Math.abs(stats.totalPnl - Math.max(...trades.map(t => t.profit || 0)))
    const drawdownPercent = stats.avgStake > 0 ? (maxDrawdown / stats.avgStake) * 100 : 0
    const drawdownRisk = drawdownPercent > 30 ? 'high' : drawdownPercent > 15 ? 'medium' : 'low'
    metrics.push({
      label: 'Drawdown Risk',
      labelPT: 'Risco de Drawdown',
      value: drawdownPercent,
      status: drawdownRisk,
      description: `Maximum drawdown: ${drawdownPercent.toFixed(1)}%`,
      descriptionPT: `Drawdown máximo: ${drawdownPercent.toFixed(1)}%`
    })

    // Position Size Risk
    const stakingRisk = stats.avgStake > stats.totalPnl * 0.1 ? 'high' : stats.avgStake > stats.totalPnl * 0.05 ? 'medium' : 'low'
    metrics.push({
      label: 'Position Size Risk',
      labelPT: 'Risco do Tamanho da Posição',
      value: (stats.avgStake / Math.abs(stats.totalPnl)) * 100,
      status: stakingRisk,
      description: `Average stake: $${stats.avgStake.toFixed(2)}`,
      descriptionPT: `Stake médio: $${stats.avgStake.toFixed(2)}`
    })

    // Emotional Trading Risk
    const recentLosses = trades.slice(0, 10).filter(t => t.result === 'loss').length
    const emotionalRisk = recentLosses > 7 ? 'high' : recentLosses > 4 ? 'medium' : 'low'
    metrics.push({
      label: 'Emotional Trading Risk',
      labelPT: 'Risco de Trading Emocional',
      value: (recentLosses / 10) * 100,
      status: emotionalRisk,
      description: `Recent losses: ${recentLosses}/10 trades`,
      descriptionPT: `Perdas recentes: ${recentLosses}/10 operações`
    })

    return metrics
  }, [stats, trades])

  // Analyze trading patterns
  const analyzePatterns = useCallback(() => {
    if (!trades || trades.length < 10) return []

    const patterns: PatternRecognition[] = []

    // Time-based patterns
    const hourAnalysis = trades.reduce((acc, trade) => {
      const hour = new Date(trade.createdAt).getHours()
      acc[hour] = acc[hour] || { wins: 0, total: 0 }
      acc[hour].total++
      if (trade.result === 'win') acc[hour].wins++
      return acc
    }, {} as Record<number, { wins: number; total: number }>)

    const bestHour = Object.entries(hourAnalysis)
      .map(([hour, data]) => ({ hour: parseInt(hour), winRate: data.wins / data.total, total: data.total }))
      .filter(h => h.total >= 3)
      .sort((a, b) => b.winRate - a.winRate)[0]

    if (bestHour) {
      patterns.push({
        pattern: `Best Performance: ${bestHour.hour}:00`,
        patternPT: `Melhor Performance: ${bestHour.hour}:00`,
        confidence: Math.min(95, bestHour.total * 10),
        frequency: bestHour.total,
        impact: bestHour.winRate > 0.6 ? 'positive' : 'neutral',
        recommendation: `Focus trading around ${bestHour.hour}:00 for better results`,
        recommendationPT: `Foque nas operações por volta das ${bestHour.hour}:00 para melhores resultados`
      })
    }

    // Asset performance patterns
    const assetAnalysis = trades.reduce((acc, trade) => {
      acc[trade.asset] = acc[trade.asset] || { wins: 0, total: 0, profit: 0 }
      acc[trade.asset].total++
      acc[trade.asset].profit += trade.profit || 0
      if (trade.result === 'win') acc[trade.asset].wins++
      return acc
    }, {} as Record<string, { wins: number; total: number; profit: number }>)

    const bestAsset = Object.entries(assetAnalysis)
      .map(([asset, data]) => ({ asset, winRate: data.wins / data.total, total: data.total, profit: data.profit }))
      .filter(a => a.total >= 3)
      .sort((a, b) => b.winRate - a.winRate)[0]

    if (bestAsset) {
      patterns.push({
        pattern: `Best Asset: ${bestAsset.asset}`,
        patternPT: `Melhor Ativo: ${bestAsset.asset}`,
        confidence: Math.min(90, bestAsset.total * 8),
        frequency: bestAsset.total,
        impact: bestAsset.winRate > 0.6 ? 'positive' : 'neutral',
        recommendation: `Consider increasing exposure to ${bestAsset.asset}`,
        recommendationPT: `Considere aumentar a exposição ao ${bestAsset.asset}`
      })
    }

    // Streak patterns
    let currentStreak = 0
    let maxWinStreak = 0
    let maxLossStreak = 0
    
    for (const trade of trades) {
      if (trade.result === 'win') {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1
        maxWinStreak = Math.max(maxWinStreak, currentStreak)
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak))
      }
    }

    if (maxLossStreak > 3) {
      patterns.push({
        pattern: `Streak Pattern: Max Loss Streak ${maxLossStreak}`,
        patternPT: `Padrão de Sequência: Max Sequência de Perdas ${maxLossStreak}`,
        confidence: 85,
        frequency: maxLossStreak,
        impact: 'negative',
        recommendation: 'Implement stricter risk management after 2 consecutive losses',
        recommendationPT: 'Implemente gestão de risco mais rigorosa após 2 perdas consecutivas'
      })
    }

    return patterns
  }, [trades])

  // Load AI data
  const loadAIData = useCallback(async () => {
    if (!stats || !trades) return

    setAiState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Load insights history
      const insights = await getInsightsHistory({ limit: 10 })
      
      // Load recommendations
      const recommendations = await getRecommendations()
      
      // Load coaching sessions
      const coachingSessions = await getCoachingHistory({ limit: 5 })

      setAiState(prev => ({
        ...prev,
        insights,
        recommendations,
        coachingSessions,
        loading: false
      }))

      // Calculate risk metrics and patterns
      setRiskMetrics(calculateRiskMetrics())
      setPatterns(analyzePatterns())

    } catch (error) {
      setAiState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load AI data'
      }))
    }
  }, [stats, trades, getInsightsHistory, getRecommendations, getCoachingHistory, calculateRiskMetrics, analyzePatterns])

  // Generate comprehensive analysis
  const handleGenerateAnalysis = async () => {
    setIsGeneratingAnalysis(true)
    try {
      const analysis = await generateComprehensiveAnalysis()
      setAiState(prev => ({ ...prev, comprehensiveAnalysis: analysis }))
    } catch (error) {
      console.error('Failed to generate comprehensive analysis:', error)
    } finally {
      setIsGeneratingAnalysis(false)
    }
  }

  // Generate coaching session
  const handleCoachingRequest = async () => {
    if (!coachingInput.trim()) return

    try {
      const session = await getCoachingSession(coachingInput, 'user_request')
      setAiState(prev => ({
        ...prev,
        coachingSessions: [session, ...prev.coachingSessions]
      }))
      setCoachingInput('')
    } catch (error) {
      console.error('Failed to get coaching session:', error)
    }
  }

  // Load data on mount
  useEffect(() => {
    if (!statsLoading && !tradesLoading && stats && trades) {
      loadAIData()
    }
  }, [statsLoading, tradesLoading, stats, trades, loadAIData])

  const getRiskColor = (status: RiskMetric['status']) => {
    switch (status) {
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20'
    }
  }

  const getImpactColor = (impact: PatternRecognition['impact']) => {
    switch (impact) {
      case 'positive': return 'text-green-400'
      case 'negative': return 'text-red-400'
      case 'neutral': return 'text-gray-400'
    }
  }

  if (statsLoading || tradesLoading) {
    return (
      <div className="min-h-screen bg-dark-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-white mb-2">
              <span className="text-primary">AI</span> Professional Analytics
            </h1>
            <p className="text-gray-400">
              {isPortuguese 
                ? 'Centro profissional de análise e coaching com IA - Estilo Bloomberg Terminal'
                : 'Professional AI Analysis & Coaching Center - Bloomberg Terminal Style'
              }
            </p>
          </div>
          
          <button
            onClick={handleGenerateAnalysis}
            disabled={isGeneratingAnalysis}
            className="bg-primary hover:bg-primary/80 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {isGeneratingAnalysis ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {isPortuguese ? 'Analisando...' : 'Analyzing...'}
              </div>
            ) : (
              isPortuguese ? 'Análise Completa' : 'Full Analysis'
            )}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', labelPT: 'Visão Geral', icon: '📊' },
            { id: 'insights', label: 'AI Insights', labelPT: 'Insights IA', icon: '🧠' },
            { id: 'coaching', label: 'AI Coach', labelPT: 'Coach IA', icon: '🎯' },
            { id: 'recommendations', label: 'Recommendations', labelPT: 'Recomendações', icon: '💡' },
            { id: 'patterns', label: 'Pattern Analysis', labelPT: 'Análise de Padrões', icon: '🔍' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === tab.id
                  ? 'bg-primary text-black font-semibold'
                  : 'bg-dark-card text-gray-300 hover:bg-dark-card/70'
              }`}
            >
              <span>{tab.icon}</span>
              {isPortuguese ? tab.labelPT : tab.label}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Risk Assessment */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-xl font-bold text-white">
                  {isPortuguese ? 'Avaliação de Risco' : 'Risk Assessment'}
                </h3>
              </div>
              
              <div className="space-y-3">
                {riskMetrics.slice(0, 3).map((metric, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getRiskColor(metric.status)}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-sm">
                        {isPortuguese ? metric.labelPT : metric.label}
                      </span>
                      <span className="text-sm">
                        {metric.value.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs opacity-80">
                      {isPortuguese ? metric.descriptionPT : metric.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Performance Prediction */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔮</span>
                <h3 className="text-xl font-bold text-white">
                  {isPortuguese ? 'Previsão de Performance' : 'Performance Prediction'}
                </h3>
              </div>
              
              {aiState.comprehensiveAnalysis?.predictions ? (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-300">
                        {isPortuguese ? 'Próxima Semana' : 'Next Week'}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {aiState.comprehensiveAnalysis.predictions.nextWeekPerformance.prediction.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${aiState.comprehensiveAnalysis.predictions.nextWeekPerformance.confidence}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      {isPortuguese ? 'Confiança:' : 'Confidence:'} {aiState.comprehensiveAnalysis.predictions.nextWeekPerformance.confidence}%
                    </p>
                    <p className="text-xs mt-2 text-gray-300">
                      {aiState.comprehensiveAnalysis.predictions.nextWeekPerformance.reasoning}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-200">
                      {isPortuguese ? 'Ajustes de Risco Recomendados' : 'Recommended Risk Adjustments'}
                    </h4>
                    {aiState.comprehensiveAnalysis.predictions.riskAdjustments.slice(0, 3).map((adjustment, index) => (
                      <div key={index} className="text-xs text-gray-400 flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {adjustment}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📈</div>
                  <p className="text-gray-400 text-sm">
                    {isPortuguese 
                      ? 'Execute uma análise completa para ver previsões'
                      : 'Run full analysis to see predictions'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Quick Coaching */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <h3 className="text-xl font-bold text-white">
                  {isPortuguese ? 'Coach Rápido' : 'Quick Coach'}
                </h3>
              </div>
              
              <div className="space-y-4">
                <textarea
                  value={coachingInput}
                  onChange={(e) => setCoachingInput(e.target.value)}
                  placeholder={isPortuguese 
                    ? 'Descreva sua situação ou pergunta...'
                    : 'Describe your situation or question...'
                  }
                  className="w-full p-3 bg-dark-background border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none h-24"
                />
                <button
                  onClick={handleCoachingRequest}
                  disabled={!coachingInput.trim() || aiLoading}
                  className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 py-2 rounded-lg font-semibold transition-colors"
                >
                  {aiLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      {isPortuguese ? 'Processando...' : 'Processing...'}
                    </div>
                  ) : (
                    isPortuguese ? 'Obter Coaching' : 'Get Coaching'
                  )}
                </button>
              </div>

              {aiState.coachingSessions.length > 0 && (
                <div className="mt-4 p-3 bg-blue-400/10 rounded-lg border border-blue-400/20">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2">
                    {isPortuguese ? 'Última Sessão' : 'Latest Session'}
                  </h4>
                  <p className="text-xs text-gray-300">
                    {aiState.coachingSessions[0].content.substring(0, 150)}...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'insights' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {aiState.insights.length > 0 ? (
              aiState.insights.map((insight) => (
                <div key={insight.id} className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">{insight.title}</h3>
                    <span className="text-xs text-gray-400">
                      {new Date(insight.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 mb-4">{insight.content}</p>
                  {insight.action && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <h4 className="text-sm font-semibold text-primary mb-1">
                        {isPortuguese ? 'Ação Recomendada' : 'Recommended Action'}
                      </h4>
                      <p className="text-xs text-gray-300">{insight.action}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-12">
                <div className="text-6xl mb-4">🧠</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPortuguese ? 'Nenhum Insight Disponível' : 'No Insights Available'}
                </h3>
                <p className="text-gray-400">
                  {isPortuguese 
                    ? 'Execute uma análise para gerar insights personalizados'
                    : 'Run an analysis to generate personalized insights'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'coaching' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  {isPortuguese ? 'Sessões de Coaching' : 'Coaching Sessions'}
                </h3>
                
                <div className="space-y-4">
                  {aiState.coachingSessions.length > 0 ? (
                    aiState.coachingSessions.map((session) => (
                      <div key={session.id} className="p-4 bg-dark-background rounded-lg border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-white">{session.title}</h4>
                          <span className="text-xs text-gray-400">
                            {new Date(session.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-300 mb-3">{session.content}</p>
                        {session.actionItems.length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold text-primary mb-2">
                              {isPortuguese ? 'Itens de Ação' : 'Action Items'}
                            </h5>
                            <ul className="space-y-1">
                              {session.actionItems.map((item, index) => (
                                <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">🎯</div>
                      <p className="text-gray-400">
                        {isPortuguese 
                          ? 'Nenhuma sessão de coaching ainda'
                          : 'No coaching sessions yet'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  {isPortuguese ? 'Solicitar Coaching' : 'Request Coaching'}
                </h3>
                
                <div className="space-y-4">
                  <textarea
                    value={coachingInput}
                    onChange={(e) => setCoachingInput(e.target.value)}
                    placeholder={isPortuguese 
                      ? 'Descreva sua situação, desafio ou pergunta...'
                      : 'Describe your situation, challenge, or question...'
                    }
                    className="w-full p-3 bg-dark-background border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none h-32"
                  />
                  <button
                    onClick={handleCoachingRequest}
                    disabled={!coachingInput.trim() || aiLoading}
                    className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {aiLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                        {isPortuguese ? 'Processando...' : 'Processing...'}
                      </div>
                    ) : (
                      isPortuguese ? 'Enviar Solicitação' : 'Submit Request'
                    )}
                  </button>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-bold text-white mb-4">
                  {isPortuguese ? 'Tópicos Sugeridos' : 'Suggested Topics'}
                </h3>
                
                <div className="space-y-2">
                  {[
                    { en: 'Risk management after losses', pt: 'Gestão de risco após perdas' },
                    { en: 'Emotional trading control', pt: 'Controle de trading emocional' },
                    { en: 'Position sizing strategy', pt: 'Estratégia de tamanho de posição' },
                    { en: 'Market timing improvement', pt: 'Melhoria do timing de mercado' }
                  ].map((topic, index) => (
                    <button
                      key={index}
                      onClick={() => setCoachingInput(isPortuguese ? topic.pt : topic.en)}
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-primary/10 hover:text-primary rounded transition-colors"
                    >
                      {isPortuguese ? topic.pt : topic.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'recommendations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {aiState.recommendations.length > 0 ? (
              aiState.recommendations.map((rec) => (
                <div key={rec.id} className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${
                      rec.priority === 'high' ? 'bg-red-400/20 text-red-400' :
                      rec.priority === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-green-400/20 text-green-400'
                    }`}>
                      {rec.priority.toUpperCase()} {isPortuguese ? 'PRIORIDADE' : 'PRIORITY'}
                    </div>
                    <span className="text-xs text-gray-400">{rec.confidence}% confident</span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2">{rec.title}</h3>
                  <p className="text-gray-300 text-sm mb-4">{rec.description}</p>
                  
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <h4 className="text-sm font-semibold text-primary mb-1">
                      {isPortuguese ? 'Ação' : 'Action'}
                    </h4>
                    <p className="text-xs text-gray-300">{rec.action}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 text-xs text-gray-400">
                    <span>{isPortuguese ? 'Impacto:' : 'Impact:'} {rec.impact}</span>
                    <span>{isPortuguese ? 'Prazo:' : 'Timeframe:'} {rec.timeframe}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <div className="text-6xl mb-4">💡</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPortuguese ? 'Nenhuma Recomendação Disponível' : 'No Recommendations Available'}
                </h3>
                <p className="text-gray-400">
                  {isPortuguese 
                    ? 'Execute uma análise para gerar recomendações estratégicas'
                    : 'Run an analysis to generate strategic recommendations'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'patterns' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {patterns.length > 0 ? (
                patterns.map((pattern, index) => (
                  <div key={index} className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">
                        {isPortuguese ? pattern.patternPT : pattern.pattern}
                      </h3>
                      <span className={`text-sm font-semibold ${getImpactColor(pattern.impact)}`}>
                        {pattern.impact.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm text-gray-400">
                          {isPortuguese ? 'Confiança' : 'Confidence'}
                        </span>
                        <div className="w-32 bg-gray-600 rounded-full h-2 mt-1">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pattern.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{pattern.confidence}%</div>
                        <div className="text-xs text-gray-400">
                          {pattern.frequency} {isPortuguese ? 'ocorrências' : 'occurrences'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-400/10 rounded-lg border border-blue-400/20">
                      <h4 className="text-sm font-semibold text-blue-400 mb-1">
                        {isPortuguese ? 'Recomendação' : 'Recommendation'}
                      </h4>
                      <p className="text-xs text-gray-300">
                        {isPortuguese ? pattern.recommendationPT : pattern.recommendation}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {isPortuguese ? 'Análise de Padrões' : 'Pattern Analysis'}
                  </h3>
                  <p className="text-gray-400">
                    {isPortuguese 
                      ? 'Colete mais dados de trading para análise de padrões'
                      : 'Collect more trading data for pattern analysis'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {(aiError || aiState.error) && (
          <div className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg max-w-md">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span className="text-sm">{aiError || aiState.error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
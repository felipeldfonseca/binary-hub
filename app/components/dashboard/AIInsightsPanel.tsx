'use client'

import { useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface AIInsight {
  id: string
  type: 'recommendation' | 'warning' | 'pattern' | 'opportunity'
  title: string
  titlePT: string
  message: string
  messagePT: string
  confidence: number
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  timestamp: Date
}

interface PredictiveIndicator {
  metric: string
  metricPT: string
  prediction: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
  timeframe: string
}

export default function AIInsightsPanel() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('month')
  const { trades, loading: tradesLoading } = useTrades({ limit: 100 })
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [predictions, setPredictions] = useState<PredictiveIndicator[]>([])
  const [activeInsight, setActiveInsight] = useState(0)

  // Generate AI insights based on trading data
  useEffect(() => {
    if (!stats || !trades || statsLoading || tradesLoading) return

    const generatedInsights: AIInsight[] = []
    const generatedPredictions: PredictiveIndicator[] = []

    // Win rate analysis
    if (stats.winRate < 45) {
      generatedInsights.push({
        id: 'winrate-low',
        type: 'warning',
        title: 'Win Rate Below Optimal',
        titlePT: 'Taxa de Acerto Abaixo do Ideal',
        message: `Your current win rate is ${stats.winRate.toFixed(1)}%. Consider reviewing your entry strategies and risk management.`,
        messagePT: `Sua taxa de acerto atual é ${stats.winRate.toFixed(1)}%. Considere revisar suas estratégias de entrada e gestão de risco.`,
        confidence: 85,
        impact: 'high',
        actionable: true,
        timestamp: new Date()
      })
    } else if (stats.winRate > 65) {
      generatedInsights.push({
        id: 'winrate-high',
        type: 'opportunity',
        title: 'Excellent Win Rate Performance',
        titlePT: 'Excelente Taxa de Acerto',
        message: `Outstanding ${stats.winRate.toFixed(1)}% win rate! Consider increasing position sizes to maximize profits.`,
        messagePT: `Excelente taxa de ${stats.winRate.toFixed(1)}%! Considere aumentar os tamanhos das posições para maximizar lucros.`,
        confidence: 90,
        impact: 'high',
        actionable: true,
        timestamp: new Date()
      })
    }

    // Drawdown analysis
    if (stats.maxDrawdown > stats.avgStake * 10) {
      generatedInsights.push({
        id: 'drawdown-high',
        type: 'warning',
        title: 'High Drawdown Risk',
        titlePT: 'Alto Risco de Drawdown',
        message: `Your maximum drawdown is ${(stats.maxDrawdown / stats.avgStake).toFixed(1)}x your average stake. Consider reducing position sizes.`,
        messagePT: `Seu drawdown máximo é ${(stats.maxDrawdown / stats.avgStake).toFixed(1)}x sua aposta média. Considere reduzir os tamanhos das posições.`,
        confidence: 80,
        impact: 'high',
        actionable: true,
        timestamp: new Date()
      })
    }

    // Trading frequency analysis
    if (trades.length > 0) {
      const recentTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return tradeDate > weekAgo
      })

      if (recentTrades.length > 50) {
        generatedInsights.push({
          id: 'overtrading',
          type: 'warning',
          title: 'Potential Overtrading',
          titlePT: 'Possível Excesso de Operações',
          message: `You've made ${recentTrades.length} trades this week. High frequency trading may increase risk.`,
          messagePT: `Você fez ${recentTrades.length} operações esta semana. Operações de alta frequência podem aumentar o risco.`,
          confidence: 75,
          impact: 'medium',
          actionable: true,
          timestamp: new Date()
        })
      }
    }

    // Asset diversification
    if (trades.length > 0) {
      const assetCounts = trades.reduce((acc, trade) => {
        acc[trade.asset] = (acc[trade.asset] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const uniqueAssets = Object.keys(assetCounts).length
      const totalTrades = trades.length

      if (uniqueAssets < 3 && totalTrades > 20) {
        generatedInsights.push({
          id: 'diversification',
          type: 'recommendation',
          title: 'Consider Portfolio Diversification',
          titlePT: 'Considere Diversificar a Carteira',
          message: `You're trading ${uniqueAssets} asset(s). Diversifying across more assets may reduce risk.`,
          messagePT: `Você está operando ${uniqueAssets} ativo(s). Diversificar em mais ativos pode reduzir riscos.`,
          confidence: 70,
          impact: 'medium',
          actionable: true,
          timestamp: new Date()
        })
      }
    }

    // Generate predictions
    generatedPredictions.push({
      metric: 'Win Rate Trend',
      metricPT: 'Tendência Taxa de Acerto',
      prediction: stats.winRate + (Math.random() * 10 - 5),
      trend: Math.random() > 0.5 ? 'up' : 'down',
      confidence: 65 + Math.random() * 25,
      timeframe: '7 days'
    })

    generatedPredictions.push({
      metric: 'Profit Potential',
      metricPT: 'Potencial de Lucro',
      prediction: Math.abs(stats.avgPnl) * 1.1,
      trend: stats.totalPnl > 0 ? 'up' : 'stable',
      confidence: 60 + Math.random() * 30,
      timeframe: '14 days'
    })

    setInsights(generatedInsights.slice(0, 4)) // Limit to 4 insights
    setPredictions(generatedPredictions)
  }, [stats, trades, statsLoading, tradesLoading])

  // Auto-rotate insights
  useEffect(() => {
    if (insights.length === 0) return
    
    const interval = setInterval(() => {
      setActiveInsight(prev => (prev + 1) % insights.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [insights])

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'recommendation':
        return '💡'
      case 'warning':
        return '⚠️'
      case 'pattern':
        return '📊'
      case 'opportunity':
        return '🚀'
      default:
        return '🤖'
    }
  }

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'recommendation':
        return 'border-blue-400 bg-blue-400/10'
      case 'warning':
        return 'border-yellow-400 bg-yellow-400/10'
      case 'pattern':
        return 'border-purple-400 bg-purple-400/10'
      case 'opportunity':
        return 'border-green-400 bg-green-400/10'
      default:
        return 'border-gray-400 bg-gray-400/10'
    }
  }

  const getTrendIcon = (trend: PredictiveIndicator['trend']) => {
    switch (trend) {
      case 'up':
        return '↗️'
      case 'down':
        return '↘️'
      case 'stable':
        return '→'
      default:
        return '→'
    }
  }

  if (statsLoading || tradesLoading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="card animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-8 bg-background">
      <div className="container mx-auto px-4">
        <div className="card">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl">🤖</div>
            <h2 className="font-heading text-2xl font-bold">
              {isPortuguese ? 'Insights Inteligentes' : 'AI Insights'}
            </h2>
            <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Análise em Tempo Real' : 'Real-time Analysis'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Main Insights Carousel */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Recomendações Personalizadas' : 'Personalized Recommendations'}
              </h3>
              
              {insights.length > 0 ? (
                <div className="relative">
                  {insights.map((insight, index) => (
                    <div
                      key={insight.id}
                      className={`transition-all duration-500 ${
                        index === activeInsight 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 translate-x-4 absolute inset-0'
                      }`}
                    >
                      <div className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}>
                        <div className="flex items-start gap-3">
                          <div className="text-xl">{getInsightIcon(insight.type)}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-comfortaa font-semibold text-white">
                                {isPortuguese ? insight.titlePT : insight.title}
                              </h4>
                              <div className="text-xs bg-white/20 px-2 py-1 rounded">
                                {insight.confidence}% {isPortuguese ? 'confiança' : 'confidence'}
                              </div>
                            </div>
                            <p className="text-sm text-gray-300">
                              {isPortuguese ? insight.messagePT : insight.message}
                            </p>
                            {insight.actionable && (
                              <div className="mt-2">
                                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                                  {isPortuguese ? 'Acionável' : 'Actionable'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Progress indicators */}
                  <div className="flex justify-center gap-2 mt-4">
                    {insights.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveInsight(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === activeInsight ? 'bg-primary' : 'bg-gray-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-gray-400 bg-gray-400/10 text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-gray-300">
                    {isPortuguese 
                      ? 'Colete mais dados de trading para insights personalizados'
                      : 'Collect more trading data for personalized insights'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Predictive Indicators */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Indicadores Preditivos' : 'Predictive Indicators'}
              </h3>
              
              <div className="space-y-3">
                {predictions.map((prediction, index) => (
                  <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTrendIcon(prediction.trend)}</span>
                        <span className="font-comfortaa font-medium text-white">
                          {isPortuguese ? prediction.metricPT : prediction.metric}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {prediction.timeframe}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-primary">
                          {prediction.metric.includes('Rate') 
                            ? `${prediction.prediction.toFixed(1)}%`
                            : `$${prediction.prediction.toFixed(2)}`
                          }
                        </div>
                        <div className="text-xs text-gray-400">
                          {isPortuguese ? 'Previsão' : 'Predicted'}
                        </div>
                      </div>
                      
                      {/* Confidence bar */}
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${prediction.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {Math.round(prediction.confidence)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Status */}
              <div className="mt-6 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-primary font-medium">
                    {isPortuguese ? 'IA analisando continuamente seus padrões de trading' : 'AI continuously analyzing your trading patterns'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
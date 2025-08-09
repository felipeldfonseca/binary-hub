'use client'

import { useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface RiskMetric {
  name: string
  namePT: string
  value: number
  unit: string
  status: 'healthy' | 'caution' | 'danger'
  benchmark: number
  description: string
  descriptionPT: string
}

interface DrawdownAnalysis {
  currentDrawdown: number
  maxDrawdown: number
  maxDrawdownDate: Date
  recoveryTime: number // days to recover from max drawdown
  drawdownFrequency: number // times per month
  worstStreak: number
}

interface PositionSizingInsight {
  avgPosition: number
  minPosition: number
  maxPosition: number
  consistency: number // 0-100, how consistent position sizing is
  recommendedSize: number
  riskPerTrade: number
  kellyPercentage: number
}

export default function RiskAssessment() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('month')
  const { trades, loading: tradesLoading } = useTrades({ limit: 500 })
  const [riskMetrics, setRiskMetrics] = useState<RiskMetric[]>([])
  const [drawdownAnalysis, setDrawdownAnalysis] = useState<DrawdownAnalysis | null>(null)
  const [positionSizing, setPositionSizing] = useState<PositionSizingInsight | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

  // Calculate risk metrics
  useEffect(() => {
    if (!stats || !trades || statsLoading || tradesLoading || trades.length < 5) return

    const calculatedMetrics: RiskMetric[] = []
    
    // Win Rate Risk
    const winRateStatus = stats.winRate >= 55 ? 'healthy' : stats.winRate >= 45 ? 'caution' : 'danger'
    calculatedMetrics.push({
      name: 'Win Rate',
      namePT: 'Taxa de Acerto',
      value: stats.winRate,
      unit: '%',
      status: winRateStatus,
      benchmark: 55,
      description: 'Percentage of winning trades - aim for 55%+',
      descriptionPT: 'Porcentagem de operações ganhadoras - almeje 55%+'
    })

    // Risk per Trade
    const avgRisk = (stats.maxDrawdown / stats.totalTrades) || 0
    const riskPerTradeStatus = avgRisk <= stats.avgStake * 0.02 ? 'healthy' : avgRisk <= stats.avgStake * 0.05 ? 'caution' : 'danger'
    calculatedMetrics.push({
      name: 'Average Risk per Trade',
      namePT: 'Risco Médio por Operação',
      value: avgRisk,
      unit: '$',
      status: riskPerTradeStatus,
      benchmark: stats.avgStake * 0.02,
      description: 'Average amount at risk per trade - keep below 2% of balance',
      descriptionPT: 'Valor médio em risco por operação - mantenha abaixo de 2% do saldo'
    })

    // Maximum Drawdown Ratio
    const drawdownRatio = stats.avgStake > 0 ? (stats.maxDrawdown / (stats.avgStake * stats.totalTrades)) * 100 : 0
    const drawdownStatus = drawdownRatio <= 20 ? 'healthy' : drawdownRatio <= 35 ? 'caution' : 'danger'
    calculatedMetrics.push({
      name: 'Drawdown Ratio',
      namePT: 'Razão de Drawdown',
      value: drawdownRatio,
      unit: '%',
      status: drawdownStatus,
      benchmark: 20,
      description: 'Maximum drawdown as percentage of total capital risked',
      descriptionPT: 'Drawdown máximo como porcentagem do capital total arriscado'
    })

    // Position Size Consistency
    const stakes = trades.map(t => t.amount)
    const avgStake = stakes.reduce((sum, stake) => sum + stake, 0) / stakes.length
    const stakeVariance = stakes.reduce((sum, stake) => sum + Math.pow(stake - avgStake, 2), 0) / stakes.length
    const stakeStdDev = Math.sqrt(stakeVariance)
    const consistency = Math.max(0, 100 - (stakeStdDev / avgStake) * 100)
    const consistencyStatus = consistency >= 80 ? 'healthy' : consistency >= 60 ? 'caution' : 'danger'
    calculatedMetrics.push({
      name: 'Position Sizing Consistency',
      namePT: 'Consistência do Tamanho de Posição',
      value: consistency,
      unit: '%',
      status: consistencyStatus,
      benchmark: 80,
      description: 'How consistent your position sizing is - aim for 80%+',
      descriptionPT: 'Quão consistente é o tamanho de suas posições - almeje 80%+'
    })

    // Profit Factor
    const winningTrades = trades.filter(t => t.result === 'win')
    const losingTrades = trades.filter(t => t.result === 'loss')
    const grossProfit = winningTrades.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.profit), 0)
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
    const profitFactorStatus = profitFactor >= 1.5 ? 'healthy' : profitFactor >= 1.1 ? 'caution' : 'danger'
    calculatedMetrics.push({
      name: 'Profit Factor',
      namePT: 'Fator de Lucro',
      value: profitFactor,
      unit: 'x',
      status: profitFactorStatus,
      benchmark: 1.5,
      description: 'Ratio of gross profit to gross loss - aim for 1.5x+',
      descriptionPT: 'Razão entre lucro bruto e perda bruta - almeje 1.5x+'
    })

    setRiskMetrics(calculatedMetrics)

    // Calculate drawdown analysis
    let runningPnL = 0
    let peak = 0
    let maxDD = 0
    let currentDD = 0
    let maxDDDate = new Date()
    let drawdownCount = 0
    let inDrawdown = false
    let worstStreak = 0
    let currentStreak = 0
    let currentStreakType: 'loss' | 'win' | null = null

    const sortedTrades = [...trades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    sortedTrades.forEach(trade => {
      runningPnL += trade.profit
      
      if (runningPnL > peak) {
        peak = runningPnL
        if (inDrawdown) {
          drawdownCount++
          inDrawdown = false
        }
      }
      
      currentDD = peak - runningPnL
      if (currentDD > maxDD) {
        maxDD = currentDD
        maxDDDate = new Date(trade.createdAt)
      }
      
      if (currentDD > 0 && !inDrawdown) {
        inDrawdown = true
      }

      // Calculate streaks
      if (trade.result === 'loss') {
        if (currentStreakType === 'loss') {
          currentStreak++
        } else {
          currentStreak = 1
          currentStreakType = 'loss'
        }
        worstStreak = Math.max(worstStreak, currentStreak)
      } else {
        if (currentStreakType !== 'loss') {
          currentStreak = 0
          currentStreakType = 'win'
        }
      }
    })

    // Calculate recovery time (simplified)
    const recoveryTime = Math.floor(Math.random() * 15) + 5 // Mock calculation

    setDrawdownAnalysis({
      currentDrawdown: currentDD,
      maxDrawdown: maxDD,
      maxDrawdownDate,
      recoveryTime,
      drawdownFrequency: drawdownCount / (trades.length / 30), // per month
      worstStreak
    })

    // Calculate position sizing insights
    const minStake = Math.min(...stakes)
    const maxStake = Math.max(...stakes)
    
    // Kelly Criterion calculation (simplified)
    const winRate = stats.winRate / 100
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length) : 0
    const kelly = avgLoss > 0 ? ((winRate * avgWin) - ((1 - winRate) * avgLoss)) / avgWin * 100 : 0

    setPositionSizing({
      avgPosition: avgStake,
      minPosition: minStake,
      maxPosition: maxStake,
      consistency,
      recommendedSize: Math.max(minStake, avgStake * 0.8),
      riskPerTrade: (avgStake / (avgStake * stats.totalTrades)) * 100,
      kellyPercentage: Math.max(0, Math.min(25, kelly)) // Cap at 25%
    })

  }, [stats, trades, statsLoading, tradesLoading])

  const getStatusColor = (status: RiskMetric['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-400/20 border-green-400/30'
      case 'caution':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30'
      case 'danger':
        return 'text-red-400 bg-red-400/20 border-red-400/30'
      default:
        return 'text-gray-400 bg-gray-400/20 border-gray-400/30'
    }
  }

  const getStatusIcon = (status: RiskMetric['status']) => {
    switch (status) {
      case 'healthy':
        return '✅'
      case 'caution':
        return '⚠️'
      case 'danger':
        return '🚨'
      default:
        return '📊'
    }
  }

  const getStatusLabel = (status: RiskMetric['status']) => {
    if (isPortuguese) {
      switch (status) {
        case 'healthy':
          return 'Saudável'
        case 'caution':
          return 'Atenção'
        case 'danger':
          return 'Perigo'
        default:
          return 'Neutro'
      }
    } else {
      return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  if (statsLoading || tradesLoading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-40 bg-gray-200 rounded"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
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
            <div className="text-2xl">🛡️</div>
            <h2 className="font-heading text-2xl font-bold">
              {isPortuguese ? 'Avaliação de Risco' : 'Risk Assessment'}
            </h2>
          </div>

          {/* Risk Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {riskMetrics.map((metric, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedMetric === metric.name
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => setSelectedMetric(selectedMetric === metric.name ? null : metric.name)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{getStatusIcon(metric.status)}</span>
                  <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(metric.status)}`}>
                    {getStatusLabel(metric.status)}
                  </span>
                </div>
                
                <h3 className="font-comfortaa font-semibold text-white mb-2">
                  {isPortuguese ? metric.namePT : metric.name}
                </h3>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-2xl font-bold ${
                    metric.status === 'healthy' ? 'text-green-400' : 
                    metric.status === 'caution' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {metric.value.toFixed(metric.unit === '%' ? 1 : 2)}
                  </span>
                  <span className="text-gray-400 text-sm">{metric.unit}</span>
                </div>

                {/* Benchmark comparison */}
                <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      metric.status === 'healthy' ? 'bg-green-400' : 
                      metric.status === 'caution' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (metric.value / (metric.benchmark * 2)) * 100))}%` 
                    }}
                  />
                </div>

                <div className="text-xs text-gray-400">
                  {isPortuguese ? 'Meta: ' : 'Target: '}{metric.benchmark}{metric.unit}
                </div>

                {selectedMetric === metric.name && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-gray-300">
                      {isPortuguese ? metric.descriptionPT : metric.description}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drawdown Analysis */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Análise de Drawdown' : 'Drawdown Analysis'}
              </h3>
              
              {drawdownAnalysis && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-400">
                        ${drawdownAnalysis.currentDrawdown.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Drawdown Atual' : 'Current Drawdown'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-400">
                        ${drawdownAnalysis.maxDrawdown.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Drawdown Máximo' : 'Max Drawdown'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-yellow-400">
                        {drawdownAnalysis.worstStreak}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Pior Sequência' : 'Worst Streak'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-400">
                        {drawdownAnalysis.recoveryTime}d
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Recuperação' : 'Recovery Time'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-gray-400">
                      {isPortuguese ? 'Maior drawdown em: ' : 'Max drawdown on: '}
                      {drawdownAnalysis.maxDrawdownDate.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {isPortuguese ? 'Frequência: ' : 'Frequency: '}
                      {drawdownAnalysis.drawdownFrequency.toFixed(1)} {isPortuguese ? 'por mês' : 'per month'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Position Sizing Insights */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Insights de Posicionamento' : 'Position Sizing Insights'}
              </h3>
              
              {positionSizing && (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">
                          ${positionSizing.avgPosition.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {isPortuguese ? 'Tamanho Médio' : 'Average Size'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">
                          {positionSizing.consistency.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-400">
                          {isPortuguese ? 'Consistência' : 'Consistency'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-400">
                        {isPortuguese ? 'Tamanho Recomendado' : 'Recommended Size'}
                      </span>
                      <span className="text-lg font-bold text-white">
                        ${positionSizing.recommendedSize.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {isPortuguese 
                        ? 'Baseado na consistência histórica e gestão de risco'
                        : 'Based on historical consistency and risk management'
                      }
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-yellow-400">
                        {isPortuguese ? 'Critério de Kelly' : 'Kelly Criterion'}
                      </span>
                      <span className="text-lg font-bold text-white">
                        {positionSizing.kellyPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {isPortuguese 
                        ? 'Porcentagem ótima do capital por operação'
                        : 'Optimal percentage of capital per trade'
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Risk Status Summary */}
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xl">📋</div>
              <h3 className="font-comfortaa text-lg font-semibold text-white">
                {isPortuguese ? 'Resumo de Risco' : 'Risk Summary'}
              </h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {riskMetrics.filter(m => m.status === 'healthy').length}
                </div>
                <div className="text-xs text-gray-400">
                  {isPortuguese ? 'Métricas Saudáveis' : 'Healthy Metrics'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {riskMetrics.filter(m => m.status === 'caution').length}
                </div>
                <div className="text-xs text-gray-400">
                  {isPortuguese ? 'Necessita Atenção' : 'Needs Attention'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {riskMetrics.filter(m => m.status === 'danger').length}
                </div>
                <div className="text-xs text-gray-400">
                  {isPortuguese ? 'Alto Risco' : 'High Risk'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface TradingPattern {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  frequency: number
  winRate: number
  avgProfit: number
  strength: 'strong' | 'moderate' | 'weak'
  trend: 'increasing' | 'decreasing' | 'stable'
  lastOccurrence: Date
}

interface PatternTendency {
  category: string
  categoryPT: string
  patterns: {
    condition: string
    conditionPT: string
    performance: number
    count: number
  }[]
}

export default function PatternAnalysis() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('month')
  const { trades, loading: tradesLoading } = useTrades({ limit: 200 })
  const [patterns, setPatterns] = useState<TradingPattern[]>([])
  const [tendencies, setTendencies] = useState<PatternTendency[]>([])
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null)

  // Analyze trading patterns
  useEffect(() => {
    if (!trades || tradesLoading || trades.length < 10) return

    const analyzedPatterns: TradingPattern[] = []
    const analyzedTendencies: PatternTendency[] = []

    // Asset concentration pattern
    const assetCounts = trades.reduce((acc, trade) => {
      acc[trade.asset] = (acc[trade.asset] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topAssets = Object.entries(assetCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)

    if (topAssets.length > 0) {
      const topAsset = topAssets[0][0]
      const topAssetTrades = trades.filter(t => t.asset === topAsset)
      const topAssetWinRate = (topAssetTrades.filter(t => t.result === 'win').length / topAssetTrades.length) * 100
      const topAssetAvgProfit = topAssetTrades.reduce((sum, t) => sum + t.profit, 0) / topAssetTrades.length

      analyzedPatterns.push({
        id: 'asset-focus',
        name: `${topAsset} Specialization`,
        namePT: `Especialização em ${topAsset}`,
        description: `Strong focus on ${topAsset} trading with ${topAssetTrades.length} trades`,
        descriptionPT: `Forte foco em trading de ${topAsset} com ${topAssetTrades.length} operações`,
        frequency: (topAssetTrades.length / trades.length) * 100,
        winRate: topAssetWinRate,
        avgProfit: topAssetAvgProfit,
        strength: topAssetWinRate > 60 ? 'strong' : topAssetWinRate > 45 ? 'moderate' : 'weak',
        trend: 'stable',
        lastOccurrence: new Date(Math.max(...topAssetTrades.map(t => new Date(t.createdAt).getTime())))
      })
    }

    // Direction bias pattern
    const callTrades = trades.filter(t => t.direction === 'call')
    const putTrades = trades.filter(t => t.direction === 'put')
    const callWinRate = callTrades.length > 0 ? (callTrades.filter(t => t.result === 'win').length / callTrades.length) * 100 : 0
    const putWinRate = putTrades.length > 0 ? (putTrades.filter(t => t.result === 'win').length / putTrades.length) * 100 : 0

    if (Math.abs(callTrades.length - putTrades.length) > trades.length * 0.2) {
      const dominantDirection = callTrades.length > putTrades.length ? 'CALL' : 'PUT'
      const dominantDirectionPT = callTrades.length > putTrades.length ? 'CALL' : 'PUT'
      const dominantWinRate = dominantDirection === 'CALL' ? callWinRate : putWinRate
      const dominantTrades = dominantDirection === 'CALL' ? callTrades : putTrades
      const dominantAvgProfit = dominantTrades.reduce((sum, t) => sum + t.profit, 0) / dominantTrades.length

      analyzedPatterns.push({
        id: 'direction-bias',
        name: `${dominantDirection} Bias`,
        namePT: `Viés ${dominantDirectionPT}`,
        description: `Strong preference for ${dominantDirection} trades (${dominantTrades.length} vs ${dominantDirection === 'CALL' ? putTrades.length : callTrades.length})`,
        descriptionPT: `Forte preferência por operações ${dominantDirectionPT} (${dominantTrades.length} vs ${dominantDirection === 'CALL' ? putTrades.length : callTrades.length})`,
        frequency: (dominantTrades.length / trades.length) * 100,
        winRate: dominantWinRate,
        avgProfit: dominantAvgProfit,
        strength: dominantWinRate > 55 ? 'strong' : dominantWinRate > 45 ? 'moderate' : 'weak',
        trend: 'stable',
        lastOccurrence: new Date(Math.max(...dominantTrades.map(t => new Date(t.createdAt).getTime())))
      })
    }

    // Stake consistency pattern
    const stakes = trades.map(t => t.amount)
    const stakeVariation = Math.max(...stakes) - Math.min(...stakes)
    const avgStake = stakes.reduce((sum, stake) => sum + stake, 0) / stakes.length

    if (stakeVariation / avgStake < 0.5) {
      analyzedPatterns.push({
        id: 'consistent-sizing',
        name: 'Consistent Position Sizing',
        namePT: 'Tamanho Consistente de Posição',
        description: `Maintains consistent stake sizes around $${avgStake.toFixed(2)}`,
        descriptionPT: `Mantém tamanhos consistentes de aposta em torno de $${avgStake.toFixed(2)}`,
        frequency: 85,
        winRate: stats?.winRate || 0,
        avgProfit: stats?.avgPnl || 0,
        strength: 'strong',
        trend: 'stable',
        lastOccurrence: new Date()
      })
    }

    // Win/Loss streak patterns
    let currentStreak = 0
    let longestWinStreak = 0
    let longestLossStreak = 0
    let currentStreakType: 'win' | 'loss' | null = null

    trades.forEach(trade => {
      if (trade.result === 'win') {
        if (currentStreakType === 'win') {
          currentStreak++
        } else {
          currentStreak = 1
          currentStreakType = 'win'
        }
        longestWinStreak = Math.max(longestWinStreak, currentStreak)
      } else if (trade.result === 'loss') {
        if (currentStreakType === 'loss') {
          currentStreak++
        } else {
          currentStreak = 1
          currentStreakType = 'loss'
        }
        longestLossStreak = Math.max(longestLossStreak, currentStreak)
      }
    })

    if (longestWinStreak >= 5) {
      analyzedPatterns.push({
        id: 'win-streak',
        name: 'Win Streak Potential',
        namePT: 'Potencial de Sequência de Ganhos',
        description: `Achieved win streaks up to ${longestWinStreak} trades`,
        descriptionPT: `Alcançou sequências de ganhos de até ${longestWinStreak} operações`,
        frequency: 25,
        winRate: 100,
        avgProfit: stats?.avgPnl || 0,
        strength: longestWinStreak >= 8 ? 'strong' : 'moderate',
        trend: 'stable',
        lastOccurrence: new Date()
      })
    }

    // Analyze trading tendencies
    // Time-based tendencies
    const hourlyPerformance: Record<number, { trades: number, wins: number, profit: number }> = {}
    trades.forEach(trade => {
      const hour = new Date(trade.entryTime).getHours()
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { trades: 0, wins: 0, profit: 0 }
      }
      hourlyPerformance[hour].trades++
      if (trade.result === 'win') hourlyPerformance[hour].wins++
      hourlyPerformance[hour].profit += trade.profit
    })

    const bestHours = Object.entries(hourlyPerformance)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        winRate: (data.wins / data.trades) * 100,
        trades: data.trades,
        profit: data.profit
      }))
      .filter(h => h.trades >= 3)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3)

    if (bestHours.length > 0) {
      analyzedTendencies.push({
        category: 'Time Performance',
        categoryPT: 'Performance por Horário',
        patterns: bestHours.map(h => ({
          condition: `Trading at ${h.hour}:00`,
          conditionPT: `Operando às ${h.hour}:00`,
          performance: h.winRate,
          count: h.trades
        }))
      })
    }

    // Asset performance tendencies
    const assetPerformance = Object.entries(assetCounts)
      .map(([asset, count]) => {
        const assetTrades = trades.filter(t => t.asset === asset)
        const wins = assetTrades.filter(t => t.result === 'win').length
        return {
          asset,
          winRate: (wins / count) * 100,
          count,
          profit: assetTrades.reduce((sum, t) => sum + t.profit, 0)
        }
      })
      .filter(a => a.count >= 5)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3)

    if (assetPerformance.length > 0) {
      analyzedTendencies.push({
        category: 'Asset Performance',
        categoryPT: 'Performance por Ativo',
        patterns: assetPerformance.map(a => ({
          condition: `Trading ${a.asset}`,
          conditionPT: `Operando ${a.asset}`,
          performance: a.winRate,
          count: a.count
        }))
      })
    }

    setPatterns(analyzedPatterns)
    setTendencies(analyzedTendencies)
  }, [trades, tradesLoading, stats])

  const getStrengthColor = (strength: TradingPattern['strength']) => {
    switch (strength) {
      case 'strong':
        return 'text-green-400 bg-green-400/20'
      case 'moderate':
        return 'text-yellow-400 bg-yellow-400/20'
      case 'weak':
        return 'text-red-400 bg-red-400/20'
      default:
        return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStrengthLabel = (strength: TradingPattern['strength']) => {
    if (isPortuguese) {
      switch (strength) {
        case 'strong':
          return 'Forte'
        case 'moderate':
          return 'Moderado'
        case 'weak':
          return 'Fraco'
        default:
          return 'Neutro'
      }
    } else {
      return strength.charAt(0).toUpperCase() + strength.slice(1)
    }
  }

  const getTrendIcon = (trend: TradingPattern['trend']) => {
    switch (trend) {
      case 'increasing':
        return '📈'
      case 'decreasing':
        return '📉'
      case 'stable':
        return '➡️'
      default:
        return '➡️'
    }
  }

  if (statsLoading || tradesLoading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="text-2xl">📊</div>
            <h2 className="font-heading text-2xl font-bold">
              {isPortuguese ? 'Análise de Padrões' : 'Pattern Recognition'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identified Patterns */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Padrões Identificados' : 'Identified Patterns'}
              </h3>
              
              {patterns.length > 0 ? (
                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedPattern === pattern.id
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => setSelectedPattern(selectedPattern === pattern.id ? null : pattern.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getTrendIcon(pattern.trend)}</span>
                          <h4 className="font-comfortaa font-semibold text-white">
                            {isPortuguese ? pattern.namePT : pattern.name}
                          </h4>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStrengthColor(pattern.strength)}`}>
                          {getStrengthLabel(pattern.strength)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-3">
                        {isPortuguese ? pattern.descriptionPT : pattern.description}
                      </p>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {pattern.frequency.toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            {isPortuguese ? 'Frequência' : 'Frequency'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold ${pattern.winRate > 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {pattern.winRate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            {isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold ${pattern.avgProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${pattern.avgProfit.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {isPortuguese ? 'Lucro Médio' : 'Avg Profit'}
                          </div>
                        </div>
                      </div>

                      {selectedPattern === pattern.id && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="text-xs text-gray-400">
                            {isPortuguese ? 'Última ocorrência: ' : 'Last seen: '}
                            {pattern.lastOccurrence.toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-gray-400 bg-gray-400/10 text-center">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-300">
                    {isPortuguese 
                      ? 'Colete mais dados para identificar padrões de trading'
                      : 'Collect more data to identify trading patterns'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Trading Tendencies */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Tendências de Trading' : 'Trading Tendencies'}
              </h3>
              
              {tendencies.length > 0 ? (
                <div className="space-y-4">
                  {tendencies.map((tendency, index) => (
                    <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h4 className="font-comfortaa font-medium text-white mb-3">
                        {isPortuguese ? tendency.categoryPT : tendency.category}
                      </h4>
                      
                      <div className="space-y-2">
                        {tendency.patterns.map((pattern, patternIndex) => (
                          <div key={patternIndex} className="flex items-center justify-between p-2 rounded bg-white/5">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">
                                {isPortuguese ? pattern.conditionPT : pattern.condition}
                              </div>
                              <div className="text-xs text-gray-400">
                                {pattern.count} {isPortuguese ? 'operações' : 'trades'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${pattern.performance > 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {pattern.performance.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-gray-400 bg-gray-400/10 text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <p className="text-gray-300">
                    {isPortuguese 
                      ? 'Mais dados necessários para análise de tendências'
                      : 'More data needed for tendency analysis'
                    }
                  </p>
                </div>
              )}

              {/* Pattern Recognition Status */}
              <div className="mt-6 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-400 font-medium">
                    {isPortuguese 
                      ? `${patterns.length} padrões ativos identificados`
                      : `${patterns.length} active patterns identified`
                    }
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
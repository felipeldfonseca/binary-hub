'use client'

import { useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface AssetPerformanceData {
  asset: string
  trades: number
  wins: number
  losses: number
  ties: number
  winRate: number
  totalProfit: number
  avgProfit: number
  totalVolume: number
  avgVolume: number
  maxProfit: number
  maxLoss: number
  profitFactor: number
  consistency: number
  lastTraded: Date
  trend: 'improving' | 'declining' | 'stable'
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid'
}

interface AssetComparison {
  metric: string
  metricPT: string
  bestAsset: string
  bestValue: number
  worstAsset: string
  worstValue: number
}

export default function AssetPerformance() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('month')
  const { trades, loading: tradesLoading } = useTrades({ limit: 500 })
  const [assetData, setAssetData] = useState<AssetPerformanceData[]>([])
  const [comparisons, setComparisons] = useState<AssetComparison[]>([])
  const [sortBy, setSortBy] = useState<'winRate' | 'totalProfit' | 'trades' | 'profitFactor'>('totalProfit')
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)

  // Analyze asset performance
  useEffect(() => {
    if (!trades || tradesLoading || trades.length < 5) return

    // Group trades by asset
    const assetGroups = trades.reduce((groups, trade) => {
      if (!groups[trade.asset]) {
        groups[trade.asset] = []
      }
      groups[trade.asset].push(trade)
      return groups
    }, {} as Record<string, typeof trades>)

    // Calculate performance metrics for each asset
    const assetPerformance: AssetPerformanceData[] = Object.entries(assetGroups)
      .filter(([_, trades]) => trades.length >= 3) // Minimum 3 trades for meaningful analysis
      .map(([asset, assetTrades]) => {
        const wins = assetTrades.filter(t => t.result === 'win').length
        const losses = assetTrades.filter(t => t.result === 'loss').length
        const ties = assetTrades.filter(t => t.result === 'tie').length
        const totalTrades = assetTrades.length

        const winRate = (wins / totalTrades) * 100
        const totalProfit = assetTrades.reduce((sum, t) => sum + t.profit, 0)
        const avgProfit = totalProfit / totalTrades
        const totalVolume = assetTrades.reduce((sum, t) => sum + t.amount, 0)
        const avgVolume = totalVolume / totalTrades

        const profits = assetTrades.map(t => t.profit)
        const maxProfit = Math.max(...profits)
        const maxLoss = Math.min(...profits)

        // Calculate profit factor
        const grossProfit = assetTrades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0)
        const grossLoss = Math.abs(assetTrades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0))
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

        // Calculate consistency (how stable the profits are)
        const profitVariance = profits.reduce((sum, profit) => sum + Math.pow(profit - avgProfit, 2), 0) / totalTrades
        const profitStdDev = Math.sqrt(profitVariance)
        const consistency = Math.max(0, 100 - (profitStdDev / Math.abs(avgProfit || 1)) * 100)

        // Calculate trend (simplified - comparing recent vs older trades)
        const midPoint = Math.floor(assetTrades.length / 2)
        const recentTrades = assetTrades.slice(0, midPoint)
        const olderTrades = assetTrades.slice(midPoint)
        
        const recentWinRate = recentTrades.length > 0 ? (recentTrades.filter(t => t.result === 'win').length / recentTrades.length) * 100 : 0
        const olderWinRate = olderTrades.length > 0 ? (olderTrades.filter(t => t.result === 'win').length / olderTrades.length) * 100 : 0
        
        let trend: AssetPerformanceData['trend'] = 'stable'
        if (recentWinRate > olderWinRate + 5) trend = 'improving'
        else if (recentWinRate < olderWinRate - 5) trend = 'declining'

        // Generate recommendation
        let recommendation: AssetPerformanceData['recommendation'] = 'hold'
        if (winRate >= 65 && profitFactor >= 1.5 && trend === 'improving') recommendation = 'strong_buy'
        else if (winRate >= 55 && profitFactor >= 1.2) recommendation = 'buy'
        else if (winRate < 40 || profitFactor < 0.8 || trend === 'declining') recommendation = 'avoid'

        const sortedTrades = assetTrades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        const lastTraded = new Date(sortedTrades[0].createdAt)

        return {
          asset,
          trades: totalTrades,
          wins,
          losses,
          ties,
          winRate,
          totalProfit,
          avgProfit,
          totalVolume,
          avgVolume,
          maxProfit,
          maxLoss,
          profitFactor,
          consistency,
          lastTraded,
          trend,
          recommendation
        }
      })

    // Sort by selected metric
    const sortedData = [...assetPerformance].sort((a, b) => {
      switch (sortBy) {
        case 'winRate':
          return b.winRate - a.winRate
        case 'totalProfit':
          return b.totalProfit - a.totalProfit
        case 'trades':
          return b.trades - a.trades
        case 'profitFactor':
          return b.profitFactor - a.profitFactor
        default:
          return b.totalProfit - a.totalProfit
      }
    })

    setAssetData(sortedData)

    // Generate comparisons
    if (sortedData.length >= 2) {
      const winRateBest = sortedData.reduce((best, current) => 
        current.winRate > best.winRate ? current : best
      )
      const winRateWorst = sortedData.reduce((worst, current) => 
        current.winRate < worst.winRate ? current : worst
      )

      const profitBest = sortedData.reduce((best, current) => 
        current.totalProfit > best.totalProfit ? current : best
      )
      const profitWorst = sortedData.reduce((worst, current) => 
        current.totalProfit < worst.totalProfit ? current : worst
      )

      const consistencyBest = sortedData.reduce((best, current) => 
        current.consistency > best.consistency ? current : best
      )
      const consistencyWorst = sortedData.reduce((worst, current) => 
        current.consistency < worst.consistency ? current : worst
      )

      setComparisons([
        {
          metric: 'Win Rate',
          metricPT: 'Taxa de Acerto',
          bestAsset: winRateBest.asset,
          bestValue: winRateBest.winRate,
          worstAsset: winRateWorst.asset,
          worstValue: winRateWorst.winRate
        },
        {
          metric: 'Total Profit',
          metricPT: 'Lucro Total',
          bestAsset: profitBest.asset,
          bestValue: profitBest.totalProfit,
          worstAsset: profitWorst.asset,
          worstValue: profitWorst.totalProfit
        },
        {
          metric: 'Consistency',
          metricPT: 'Consistência',
          bestAsset: consistencyBest.asset,
          bestValue: consistencyBest.consistency,
          worstAsset: consistencyWorst.asset,
          worstValue: consistencyWorst.consistency
        }
      ])
    }

  }, [trades, tradesLoading, sortBy])

  const getRecommendationColor = (recommendation: AssetPerformanceData['recommendation']) => {
    switch (recommendation) {
      case 'strong_buy':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'buy':
        return 'bg-green-400/20 text-green-300 border-green-400/30'
      case 'hold':
        return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
      case 'avoid':
        return 'bg-red-400/20 text-red-400 border-red-400/30'
      default:
        return 'bg-gray-400/20 text-gray-400 border-gray-400/30'
    }
  }

  const getRecommendationLabel = (recommendation: AssetPerformanceData['recommendation']) => {
    if (isPortuguese) {
      switch (recommendation) {
        case 'strong_buy':
          return 'Forte Compra'
        case 'buy':
          return 'Compra'
        case 'hold':
          return 'Manter'
        case 'avoid':
          return 'Evitar'
        default:
          return 'Neutro'
      }
    } else {
      switch (recommendation) {
        case 'strong_buy':
          return 'Strong Buy'
        case 'buy':
          return 'Buy'
        case 'hold':
          return 'Hold'
        case 'avoid':
          return 'Avoid'
        default:
          return 'Neutral'
      }
    }
  }

  const getTrendIcon = (trend: AssetPerformanceData['trend']) => {
    switch (trend) {
      case 'improving':
        return '📈'
      case 'declining':
        return '📉'
      case 'stable':
        return '➡️'
      default:
        return '➡️'
    }
  }

  const getTrendColor = (trend: AssetPerformanceData['trend']) => {
    switch (trend) {
      case 'improving':
        return 'text-green-400'
      case 'declining':
        return 'text-red-400'
      case 'stable':
        return 'text-yellow-400'
      default:
        return 'text-gray-400'
    }
  }

  if (statsLoading || tradesLoading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📊</div>
              <h2 className="font-heading text-2xl font-bold">
                {isPortuguese ? 'Performance por Ativo' : 'Asset Performance'}
              </h2>
            </div>
            
            {/* Sort Options */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSortBy('totalProfit')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortBy === 'totalProfit'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Lucro' : 'Profit'}
              </button>
              <button
                onClick={() => setSortBy('winRate')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortBy === 'winRate'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Taxa' : 'Rate'}
              </button>
              <button
                onClick={() => setSortBy('trades')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortBy === 'trades'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Volume' : 'Volume'}
              </button>
              <button
                onClick={() => setSortBy('profitFactor')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortBy === 'profitFactor'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Fator' : 'Factor'}
              </button>
            </div>
          </div>

          {assetData.length > 0 ? (
            <div className="space-y-6">
              {/* Asset Performance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assetData.map((asset) => (
                  <div
                    key={asset.asset}
                    className={`p-5 rounded-lg border cursor-pointer transition-all ${
                      selectedAsset === asset.asset
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedAsset(selectedAsset === asset.asset ? null : asset.asset)}
                  >
                    {/* Asset Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-comfortaa text-lg font-bold text-white">
                          {asset.asset}
                        </h3>
                        <span className={`text-lg ${getTrendColor(asset.trend)}`}>
                          {getTrendIcon(asset.trend)}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${getRecommendationColor(asset.recommendation)}`}>
                        {getRecommendationLabel(asset.recommendation)}
                      </span>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center">
                        <div className={`text-xl font-bold ${asset.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                          {asset.winRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-400">
                          {isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xl font-bold ${asset.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${asset.totalProfit.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {isPortuguese ? 'Lucro Total' : 'Total Profit'}
                        </div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{isPortuguese ? 'Operações' : 'Trades'}:</span>
                        <span className="text-sm text-white font-medium">{asset.trades}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{isPortuguese ? 'Fator de Lucro' : 'Profit Factor'}:</span>
                        <span className={`text-sm font-medium ${asset.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                          {asset.profitFactor.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{isPortuguese ? 'Consistência' : 'Consistency'}:</span>
                        <span className="text-sm text-primary font-medium">{asset.consistency.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Progress Bar for Win Rate */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{isPortuguese ? 'Performance' : 'Performance'}</span>
                        <span>{asset.wins}W/{asset.losses}L</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${asset.winRate >= 50 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(100, asset.winRate)}%` }}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedAsset === asset.asset && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-400">{isPortuguese ? 'Maior Ganho' : 'Max Profit'}:</span>
                          <span className="text-sm text-green-400 font-medium">${asset.maxProfit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-400">{isPortuguese ? 'Maior Perda' : 'Max Loss'}:</span>
                          <span className="text-sm text-red-400 font-medium">${asset.maxLoss.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-400">{isPortuguese ? 'Volume Médio' : 'Avg Volume'}:</span>
                          <span className="text-sm text-white font-medium">${asset.avgVolume.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-400">{isPortuguese ? 'Última Operação' : 'Last Traded'}:</span>
                          <span className="text-sm text-white font-medium">{asset.lastTraded.toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Asset Comparisons */}
              {comparisons.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-comfortaa text-lg font-semibold mb-4">
                    {isPortuguese ? 'Comparações de Ativos' : 'Asset Comparisons'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {comparisons.map((comparison, index) => (
                      <div key={index} className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <h4 className="font-comfortaa font-medium text-white mb-3">
                          {isPortuguese ? comparison.metricPT : comparison.metric}
                        </h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded bg-green-400/10">
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">🏆</span>
                              <span className="text-sm text-white font-medium">{comparison.bestAsset}</span>
                            </div>
                            <span className="text-sm text-green-400 font-bold">
                              {comparison.metric.includes('Rate') || comparison.metric.includes('Consistency')
                                ? `${comparison.bestValue.toFixed(1)}%`
                                : `$${comparison.bestValue.toFixed(2)}`
                              }
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between p-2 rounded bg-red-400/10">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400">📉</span>
                              <span className="text-sm text-white font-medium">{comparison.worstAsset}</span>
                            </div>
                            <span className="text-sm text-red-400 font-bold">
                              {comparison.metric.includes('Rate') || comparison.metric.includes('Consistency')
                                ? `${comparison.worstValue.toFixed(1)}%`
                                : `$${comparison.worstValue.toFixed(2)}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="font-comfortaa text-xl font-semibold text-white mb-2">
                {isPortuguese ? 'Dados Insuficientes' : 'Insufficient Data'}
              </h3>
              <p className="text-gray-400">
                {isPortuguese 
                  ? 'Você precisa de pelo menos 3 operações por ativo para análise de performance'
                  : 'You need at least 3 trades per asset for performance analysis'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
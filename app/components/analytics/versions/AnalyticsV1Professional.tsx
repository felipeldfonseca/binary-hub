'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades, Trade } from '@/hooks/useTrades'

// Type definitions for analytics
type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd'
type AnalyticsTab = 'overview' | 'trades' | 'assets' | 'periods' | 'risks' | 'streaks' | 'insights' | 'export'
type SortDirection = 'asc' | 'desc'

interface AnalyticsFilters {
  period: TimePeriod
  dateRange: { start: string; end: string }
  assets: string[]
  strategies: string[]
  minAmount: number
  maxAmount: number
  results: ('win' | 'loss' | 'tie')[]
}

interface RiskMetrics {
  maxDrawdown: number
  currentDrawdown: number
  volatility: number
  sharpeRatio: number
  profitFactor: number
  calmarRatio: number
  averageRisk: number
  maxRisk: number
  riskAdjustedReturn: number
}

interface StreakAnalysis {
  currentWinStreak: number
  currentLossStreak: number
  maxWinStreak: number
  maxLossStreak: number
  avgWinStreak: number
  avgLossStreak: number
  streakHistory: Array<{
    type: 'win' | 'loss'
    count: number
    startDate: string
    endDate: string
    totalPnl: number
  }>
}

interface AssetPerformance {
  asset: string
  trades: number
  winRate: number
  totalPnl: number
  avgPnl: number
  maxWin: number
  maxLoss: number
  totalVolume: number
  profitFactor: number
  sharpeRatio: number
}

interface PeriodPerformance {
  period: string
  trades: number
  winRate: number
  totalPnl: number
  avgPnl: number
  bestDay: number
  worstDay: number
  profitableDays: number
  unprofitableDays: number
  consistency: number
}

export default function AnalyticsV1Professional() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: 'allTime',
    dateRange: { start: '', end: '' },
    assets: [],
    strategies: [],
    minAmount: 0,
    maxAmount: 0,
    results: []
  })
  const [sortField, setSortField] = useState<string>('totalPnl')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Hooks
  const { stats, loading: statsLoading, error: statsError } = useTradeStats(filters.period)
  const { trades, loading: tradesLoading, error: tradesError } = useTrades()

  // Check if user has data
  const hasData = trades.length > 0
  const loading = statsLoading || tradesLoading
  const error = statsError || tradesError

  // Calculate advanced metrics
  const riskMetrics = useMemo((): RiskMetrics => {
    if (!hasData) return {
      maxDrawdown: 0, currentDrawdown: 0, volatility: 0, sharpeRatio: 0,
      profitFactor: 0, calmarRatio: 0, averageRisk: 0, maxRisk: 0, riskAdjustedReturn: 0
    }

    // Calculate daily returns for volatility
    const dailyReturns: number[] = []
    const groupedByDate = trades.reduce((acc, trade) => {
      const date = new Date(trade.entryTime).toDateString()
      if (!acc[date]) acc[date] = []
      acc[date].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)

    Object.values(groupedByDate).forEach(dayTrades => {
      const dayPnl = dayTrades.reduce((sum, trade) => sum + trade.profit, 0)
      const dayVolume = dayTrades.reduce((sum, trade) => sum + trade.amount, 0)
      if (dayVolume > 0) dailyReturns.push(dayPnl / dayVolume)
    })

    // Volatility calculation
    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
    const volatility = Math.sqrt(
      dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length
    ) * Math.sqrt(252) // Annualized

    // Drawdown calculation
    let runningPnl = 0
    let peak = 0
    let maxDrawdown = 0
    let currentDrawdown = 0

    trades.forEach(trade => {
      runningPnl += trade.profit
      if (runningPnl > peak) peak = runningPnl
      const drawdown = (peak - runningPnl) / peak * 100
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    })
    
    currentDrawdown = peak > 0 ? (peak - runningPnl) / peak * 100 : 0

    // Profit factor
    const winningTrades = trades.filter(t => t.profit > 0)
    const losingTrades = trades.filter(t => t.profit < 0)
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0)
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

    // Sharpe ratio
    const riskFreeRate = 0.02 // 2% annual risk-free rate
    const sharpeRatio = volatility > 0 ? (avgReturn * 252 - riskFreeRate) / volatility : 0

    // Calmar ratio
    const annualReturn = avgReturn * 252
    const calmarRatio = maxDrawdown > 0 ? annualReturn / (maxDrawdown / 100) : 0

    return {
      maxDrawdown,
      currentDrawdown,
      volatility: volatility * 100,
      sharpeRatio,
      profitFactor,
      calmarRatio,
      averageRisk: trades.reduce((sum, t) => sum + t.amount, 0) / trades.length,
      maxRisk: Math.max(...trades.map(t => t.amount)),
      riskAdjustedReturn: sharpeRatio
    }
  }, [trades, hasData])

  // Calculate streak analysis
  const streakAnalysis = useMemo((): StreakAnalysis => {
    if (!hasData) return {
      currentWinStreak: 0, currentLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0,
      avgWinStreak: 0, avgLossStreak: 0, streakHistory: []
    }

    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    )

    let currentStreak = { type: 'win' as 'win' | 'loss', count: 0, startDate: '', totalPnl: 0 }
    let maxWinStreak = 0
    let maxLossStreak = 0
    const streakHistory: StreakAnalysis['streakHistory'] = []
    const winStreaks: number[] = []
    const lossStreaks: number[] = []

    sortedTrades.forEach((trade, index) => {
      const isWin = trade.profit > 0
      const tradeDate = new Date(trade.entryTime).toISOString().split('T')[0]

      if (index === 0 || currentStreak.type !== (isWin ? 'win' : 'loss')) {
        // Start new streak
        if (currentStreak.count > 0) {
          streakHistory.push({
            ...currentStreak,
            endDate: sortedTrades[index - 1] ? 
              new Date(sortedTrades[index - 1].entryTime).toISOString().split('T')[0] : 
              currentStreak.startDate
          })

          if (currentStreak.type === 'win') {
            winStreaks.push(currentStreak.count)
            maxWinStreak = Math.max(maxWinStreak, currentStreak.count)
          } else {
            lossStreaks.push(currentStreak.count)
            maxLossStreak = Math.max(maxLossStreak, currentStreak.count)
          }
        }

        currentStreak = {
          type: isWin ? 'win' : 'loss',
          count: 1,
          startDate: tradeDate,
          totalPnl: trade.profit
        }
      } else {
        // Continue current streak
        currentStreak.count++
        currentStreak.totalPnl += trade.profit
      }
    })

    // Add final streak
    if (currentStreak.count > 0) {
      streakHistory.push({
        ...currentStreak,
        endDate: sortedTrades[sortedTrades.length - 1] ? 
          new Date(sortedTrades[sortedTrades.length - 1].entryTime).toISOString().split('T')[0] : 
          currentStreak.startDate
      })

      if (currentStreak.type === 'win') {
        winStreaks.push(currentStreak.count)
        maxWinStreak = Math.max(maxWinStreak, currentStreak.count)
      } else {
        lossStreaks.push(currentStreak.count)
        maxLossStreak = Math.max(maxLossStreak, currentStreak.count)
      }
    }

    return {
      currentWinStreak: currentStreak.type === 'win' ? currentStreak.count : 0,
      currentLossStreak: currentStreak.type === 'loss' ? currentStreak.count : 0,
      maxWinStreak,
      maxLossStreak,
      avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0,
      avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0,
      streakHistory
    }
  }, [trades, hasData])

  // Calculate asset performance
  const assetPerformance = useMemo((): AssetPerformance[] => {
    if (!hasData) return []

    const assetMap = trades.reduce((acc, trade) => {
      if (!acc[trade.asset]) {
        acc[trade.asset] = []
      }
      acc[trade.asset].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)

    return Object.entries(assetMap).map(([asset, assetTrades]): AssetPerformance => {
      const wins = assetTrades.filter(t => t.profit > 0)
      const losses = assetTrades.filter(t => t.profit < 0)
      const totalPnl = assetTrades.reduce((sum, t) => sum + t.profit, 0)
      const totalVolume = assetTrades.reduce((sum, t) => sum + t.amount, 0)
      
      const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0)
      const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0))
      
      return {
        asset,
        trades: assetTrades.length,
        winRate: (wins.length / assetTrades.length) * 100,
        totalPnl,
        avgPnl: totalPnl / assetTrades.length,
        maxWin: Math.max(...assetTrades.map(t => t.profit)),
        maxLoss: Math.min(...assetTrades.map(t => t.profit)),
        totalVolume,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
        sharpeRatio: 0 // Simplified for now
      }
    }).sort((a, b) => {
      if (sortField === 'asset') return sortDirection === 'asc' ? 
        a.asset.localeCompare(b.asset) : b.asset.localeCompare(a.asset)
      
      const aValue = a[sortField as keyof AssetPerformance] as number
      const bValue = b[sortField as keyof AssetPerformance] as number
      
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })
  }, [trades, hasData, sortField, sortDirection])

  // Export functionality
  const handleExport = useCallback(async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      if (format === 'csv') {
        // Create comprehensive CSV export
        const headers = [
          'Period', 'Total Trades', 'Win Rate (%)', 'Total P&L', 'Avg P&L',
          'Max Drawdown (%)', 'Volatility (%)', 'Sharpe Ratio', 'Profit Factor',
          'Max Win Streak', 'Max Loss Streak', 'Risk-Adjusted Return'
        ]

        const data = [
          filters.period.toUpperCase(),
          stats?.totalTrades || 0,
          stats?.winRate || 0,
          stats?.totalPnl || 0,
          stats?.avgPnl || 0,
          riskMetrics.maxDrawdown,
          riskMetrics.volatility,
          riskMetrics.sharpeRatio,
          riskMetrics.profitFactor,
          streakAnalysis.maxWinStreak,
          streakAnalysis.maxLossStreak,
          riskMetrics.riskAdjustedReturn
        ]

        const csvContent = [headers.join(','), data.join(',')].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }, [stats, riskMetrics, streakAnalysis, filters.period])

  // Tab configuration
  const tabs = [
    { 
      key: 'overview', 
      label: isPortuguese ? 'Visão Geral' : 'Overview',
      icon: '📊',
      description: isPortuguese ? 'Métricas principais' : 'Key metrics'
    },
    { 
      key: 'trades', 
      label: isPortuguese ? 'Análise de Trades' : 'Trade Analysis',
      icon: '📈',
      description: isPortuguese ? 'Detalhes das operações' : 'Trade details'
    },
    { 
      key: 'assets', 
      label: isPortuguese ? 'Ativos' : 'Assets',
      icon: '💰',
      description: isPortuguese ? 'Performance por ativo' : 'Asset performance'
    },
    { 
      key: 'periods', 
      label: isPortuguese ? 'Períodos' : 'Periods',
      icon: '📅',
      description: isPortuguese ? 'Análise temporal' : 'Time analysis'
    },
    { 
      key: 'risks', 
      label: isPortuguese ? 'Risco' : 'Risk',
      icon: '⚠️',
      description: isPortuguese ? 'Métricas de risco' : 'Risk metrics'
    },
    { 
      key: 'streaks', 
      label: isPortuguese ? 'Sequências' : 'Streaks',
      icon: '🔥',
      description: isPortuguese ? 'Análise de sequências' : 'Streak analysis'
    },
    { 
      key: 'insights', 
      label: isPortuguese ? 'Insights' : 'Insights',
      icon: '💡',
      description: isPortuguese ? 'Recomendações' : 'Recommendations'
    },
    { 
      key: 'export', 
      label: isPortuguese ? 'Exportar' : 'Export',
      icon: '📤',
      description: isPortuguese ? 'Exportar dados' : 'Export data'
    }
  ]

  if (!hasData && !loading) {
    return (
      <div className="min-h-screen bg-[#505050] px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
              {isPortuguese ? 'Analytics Profissional' : 'Professional Analytics'}
            </h1>
            <p className="text-xl font-comfortaa font-normal text-white max-w-4xl mx-auto">
              {isPortuguese 
                ? 'Centro de aprendizado abrangente para análise profunda de performance e insights acionáveis.'
                : 'Comprehensive learning center for deep performance analysis and actionable insights.'
              }
            </p>
          </div>

          {/* Empty State */}
          <div className="card bg-gradient-to-br from-blue-900/20 to-green-900/20 border-[#E1FFD9]/20 text-center py-16">
            <div className="text-6xl mb-6 opacity-60">📊</div>
            <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'Importe seus dados para começar' : 'Import your data to get started'}
            </h3>
            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Para acessar o centro de aprendizado analytics profissional, você precisa primeiro importar seus dados de trading. Todas as análises avançadas estarão disponíveis após a importação.'
                : 'To access the professional analytics learning center, you need to first import your trading data. All advanced analyses will be available after import.'
              }
            </p>
            
            {/* Feature Preview */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {tabs.slice(0, 4).map(tab => (
                <div key={tab.key} className="bg-gray-800/30 p-6 rounded-lg border border-gray-700/50">
                  <div className="text-3xl mb-3">{tab.icon}</div>
                  <h4 className="font-semibold text-white font-comfortaa mb-2">{tab.label}</h4>
                  <p className="text-sm text-gray-400">{tab.description}</p>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-8 py-3 rounded-lg hover:bg-gradient-to-r hover:from-[#C4F5A8] hover:to-[#E1FFD9] hover:shadow-xl transition-all duration-200 shadow-lg font-comfortaa transform hover:scale-105"
            >
              {isPortuguese ? '📂 Ir para Dashboard e Importar Dados' : '📂 Go to Dashboard and Import Data'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#505050] px-4 py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
            {isPortuguese ? 'Analytics Profissional' : 'Professional Analytics'}
          </h1>
          <p className="text-xl font-comfortaa font-normal text-white max-w-4xl mx-auto">
            {isPortuguese 
              ? 'Centro de aprendizado abrangente para análise profunda de performance e insights acionáveis.'
              : 'Comprehensive learning center for deep performance analysis and actionable insights.'
            }
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="card border-l-4 border-red-500 bg-red-500/10 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-red-400">⚠️</span>
              <div>
                <h4 className="font-bold text-white">
                  {isPortuguese ? 'Erro ao carregar dados' : 'Error loading data'}
                </h4>
                <p className="text-gray-300 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-600 pb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as AnalyticsTab)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all font-medium whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#E1FFD9] text-[#2D3748] shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-white/20 hover:text-white border border-gray-700/50'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-bold">{tab.label}</div>
                <div className="text-xs opacity-75">{tab.description}</div>
              </div>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card text-center py-16">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-[#E1FFD9] mb-4"></div>
            <p className="text-white font-comfortaa">
              {isPortuguese ? 'Carregando analytics...' : 'Loading analytics...'}
            </p>
          </div>
        )}

        {/* Tab Content */}
        {!loading && (
          <div className="space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="card text-center bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                    <div className="text-2xl font-bold text-blue-300">{stats?.totalTrades || 0}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Total Trades' : 'Total Trades'}
                    </div>
                  </div>
                  
                  <div className="card text-center bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                    <div className={`text-2xl font-bold ${(stats?.winRate || 0) >= 50 ? 'text-green-300' : 'text-red-300'}`}>
                      {(stats?.winRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
                    <div className={`text-2xl font-bold ${(stats?.totalPnl || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      ${(stats?.totalPnl || 0) >= 0 ? '+' : ''}{(stats?.totalPnl || 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      P&L Total
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/30">
                    <div className="text-2xl font-bold text-red-300">
                      {riskMetrics.maxDrawdown.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Drawdown Máx' : 'Max Drawdown'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 border-indigo-500/30">
                    <div className="text-2xl font-bold text-indigo-300">
                      {riskMetrics.sharpeRatio.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      Sharpe Ratio
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-orange-500/30">
                    <div className="text-2xl font-bold text-orange-300">
                      {riskMetrics.profitFactor.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Fator Lucro' : 'Profit Factor'}
                    </div>
                  </div>
                </div>

                {/* Quick Action Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="card cursor-pointer hover:bg-white/20 transition-colors"
                       onClick={() => setActiveTab('risks')}>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">⚠️</div>
                      <div>
                        <h3 className="font-bold text-white font-comfortaa">
                          {isPortuguese ? 'Análise de Risco' : 'Risk Analysis'}
                        </h3>
                        <p className="text-gray-300 text-sm">
                          {isPortuguese ? 'Métricas avançadas de gestão de risco' : 'Advanced risk management metrics'}
                        </p>
                        <div className="mt-2 text-sm">
                          <span className="text-red-300">Volatilidade: {riskMetrics.volatility.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card cursor-pointer hover:bg-white/20 transition-colors"
                       onClick={() => setActiveTab('streaks')}>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">🔥</div>
                      <div>
                        <h3 className="font-bold text-white font-comfortaa">
                          {isPortuguese ? 'Sequências' : 'Streaks'}
                        </h3>
                        <p className="text-gray-300 text-sm">
                          {isPortuguese ? 'Análise de sequências de ganhos e perdas' : 'Win/loss streak analysis'}
                        </p>
                        <div className="mt-2 text-sm">
                          <span className="text-green-300">Max Win: {streakAnalysis.maxWinStreak}</span>
                          <span className="mx-2">|</span>
                          <span className="text-red-300">Max Loss: {streakAnalysis.maxLossStreak}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card cursor-pointer hover:bg-white/20 transition-colors"
                       onClick={() => setActiveTab('assets')}>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">💰</div>
                      <div>
                        <h3 className="font-bold text-white font-comfortaa">
                          {isPortuguese ? 'Performance de Ativos' : 'Asset Performance'}
                        </h3>
                        <p className="text-gray-300 text-sm">
                          {isPortuguese ? 'Análise detalhada por ativo' : 'Detailed asset analysis'}
                        </p>
                        <div className="mt-2 text-sm text-gray-300">
                          {assetPerformance.length} {isPortuguese ? 'ativos analisados' : 'assets analyzed'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assets Tab */}
            {activeTab === 'assets' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white font-comfortaa">
                    {isPortuguese ? 'Performance por Ativo' : 'Asset Performance'}
                  </h2>
                  
                  {/* Sort Controls */}
                  <div className="flex gap-2">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value)}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="totalPnl">{isPortuguese ? 'P&L Total' : 'Total P&L'}</option>
                      <option value="winRate">{isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}</option>
                      <option value="trades">{isPortuguese ? 'Número de Trades' : 'Trade Count'}</option>
                      <option value="profitFactor">{isPortuguese ? 'Fator de Lucro' : 'Profit Factor'}</option>
                      <option value="asset">{isPortuguese ? 'Ativo' : 'Asset'}</option>
                    </select>
                    
                    <button
                      onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm hover:bg-gray-700/50"
                    >
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {/* Asset Performance Table */}
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Ativo' : 'Asset'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Trades' : 'Trades'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Taxa Acerto' : 'Win Rate'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          P&L Total
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          P&L Médio
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Maior Ganho' : 'Max Win'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Maior Perda' : 'Max Loss'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Fator Lucro' : 'Profit Factor'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetPerformance.map((asset, index) => (
                        <tr key={asset.asset} className={`border-b border-gray-700/50 ${
                          index % 2 === 0 ? 'bg-gray-800/20' : 'bg-transparent'
                        }`}>
                          <td className="p-3 font-medium text-white">{asset.asset}</td>
                          <td className="p-3 text-right text-gray-300">{asset.trades}</td>
                          <td className={`p-3 text-right font-medium ${
                            asset.winRate >= 50 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {asset.winRate.toFixed(1)}%
                          </td>
                          <td className={`p-3 text-right font-medium ${
                            asset.totalPnl >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            ${asset.totalPnl >= 0 ? '+' : ''}{asset.totalPnl.toFixed(2)}
                          </td>
                          <td className={`p-3 text-right ${
                            asset.avgPnl >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            ${asset.avgPnl >= 0 ? '+' : ''}{asset.avgPnl.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-green-300">
                            ${asset.maxWin.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-red-300">
                            ${asset.maxLoss.toFixed(2)}
                          </td>
                          <td className={`p-3 text-right font-medium ${
                            asset.profitFactor >= 1 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {asset.profitFactor.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Risk Tab */}
            {activeTab === 'risks' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white font-comfortaa">
                  {isPortuguese ? 'Análise de Risco' : 'Risk Analysis'}
                </h2>

                {/* Risk Metrics Grid */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="card bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Drawdown' : 'Drawdown'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">{isPortuguese ? 'Máximo:' : 'Maximum:'}</span>
                        <span className="text-red-300 font-bold">{riskMetrics.maxDrawdown.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">{isPortuguese ? 'Atual:' : 'Current:'}</span>
                        <span className="text-red-300">{riskMetrics.currentDrawdown.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="card bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-yellow-500/30">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Volatilidade' : 'Volatility'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">{isPortuguese ? 'Anualizada:' : 'Annualized:'}</span>
                        <span className="text-yellow-300 font-bold">{riskMetrics.volatility.toFixed(2)}%</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {isPortuguese ? 'Baseada em retornos diários' : 'Based on daily returns'}
                      </div>
                    </div>
                  </div>

                  <div className="card bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Ratios de Risco' : 'Risk Ratios'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Sharpe:</span>
                        <span className="text-blue-300 font-bold">{riskMetrics.sharpeRatio.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Calmar:</span>
                        <span className="text-blue-300">{riskMetrics.calmarRatio.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Management Insights */}
                <div className="card bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
                  <h3 className="font-bold text-white mb-4 font-comfortaa">
                    {isPortuguese ? 'Insights de Gestão de Risco' : 'Risk Management Insights'}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-purple-300 font-semibold mb-2">
                        {isPortuguese ? 'Pontos Fortes' : 'Strengths'}
                      </h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        {riskMetrics.sharpeRatio > 1 && (
                          <li>• {isPortuguese ? 'Excelente Sharpe ratio (>1.0)' : 'Excellent Sharpe ratio (>1.0)'}</li>
                        )}
                        {riskMetrics.maxDrawdown < 20 && (
                          <li>• {isPortuguese ? 'Drawdown controlado (<20%)' : 'Controlled drawdown (<20%)'}</li>
                        )}
                        {riskMetrics.profitFactor > 1.5 && (
                          <li>• {isPortuguese ? 'Alto fator de lucro (>1.5)' : 'High profit factor (>1.5)'}</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-red-300 font-semibold mb-2">
                        {isPortuguese ? 'Áreas de Melhoria' : 'Areas for Improvement'}
                      </h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        {riskMetrics.maxDrawdown > 30 && (
                          <li>• {isPortuguese ? 'Reduzir drawdown máximo' : 'Reduce maximum drawdown'}</li>
                        )}
                        {riskMetrics.volatility > 50 && (
                          <li>• {isPortuguese ? 'Diminuir volatilidade' : 'Lower volatility'}</li>
                        )}
                        {riskMetrics.sharpeRatio < 0.5 && (
                          <li>• {isPortuguese ? 'Melhorar retorno ajustado ao risco' : 'Improve risk-adjusted returns'}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white font-comfortaa">
                  {isPortuguese ? 'Exportar Dados' : 'Export Data'}
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Relatório Completo (CSV)' : 'Complete Report (CSV)'}
                    </h3>
                    <p className="text-gray-300 mb-4 text-sm">
                      {isPortuguese 
                        ? 'Exporta todas as métricas e análises em formato CSV para análise externa.'
                        : 'Export all metrics and analyses in CSV format for external analysis.'
                      }
                    </p>
                    <button
                      onClick={() => handleExport('csv')}
                      className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-6 py-2 rounded-lg hover:shadow-lg transition-all font-comfortaa"
                    >
                      📥 {isPortuguese ? 'Baixar CSV' : 'Download CSV'}
                    </button>
                  </div>

                  <div className="card opacity-50">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Relatório PDF (Em Breve)' : 'PDF Report (Coming Soon)'}
                    </h3>
                    <p className="text-gray-300 mb-4 text-sm">
                      {isPortuguese 
                        ? 'Relatório profissional em PDF com gráficos e análises visuais.'
                        : 'Professional PDF report with charts and visual analyses.'
                      }
                    </p>
                    <button
                      disabled
                      className="bg-gray-600 text-gray-400 font-semibold px-6 py-2 rounded-lg cursor-not-allowed font-comfortaa"
                    >
                      📄 {isPortuguese ? 'Em Desenvolvimento' : 'In Development'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trades Tab */}
            {activeTab === 'trades' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white font-comfortaa">
                    {isPortuguese ? 'Análise Detalhada de Trades' : 'Detailed Trade Analysis'}
                  </h2>
                  
                  {/* Filter Controls */}
                  <div className="flex gap-2">
                    <select
                      value={filters.period}
                      onChange={(e) => setFilters({...filters, period: e.target.value as TimePeriod})}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="daily">{isPortuguese ? 'Hoje' : 'Today'}</option>
                      <option value="weekly">{isPortuguese ? 'Esta Semana' : 'This Week'}</option>
                      <option value="monthly">{isPortuguese ? 'Este Mês' : 'This Month'}</option>
                      <option value="allTime">{isPortuguese ? 'Todo Período' : 'All Time'}</option>
                    </select>
                  </div>
                </div>

                {/* Trade Statistics Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="card text-center bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 border-emerald-500/30">
                    <div className="text-xl font-bold text-emerald-300">{trades.filter(t => t.profit > 0).length}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Trades Ganhos' : 'Winning Trades'}
                    </div>
                  </div>
                  
                  <div className="card text-center bg-gradient-to-br from-rose-900/20 to-rose-800/20 border-rose-500/30">
                    <div className="text-xl font-bold text-rose-300">{trades.filter(t => t.profit < 0).length}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Trades Perdidos' : 'Losing Trades'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-amber-900/20 to-amber-800/20 border-amber-500/30">
                    <div className="text-xl font-bold text-amber-300">
                      ${Math.max(...trades.map(t => t.profit)).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Melhor Trade' : 'Best Trade'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30">
                    <div className="text-xl font-bold text-red-300">
                      ${Math.min(...trades.map(t => t.profit)).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Pior Trade' : 'Worst Trade'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 border-cyan-500/30">
                    <div className="text-xl font-bold text-cyan-300">
                      ${(trades.reduce((sum, t) => sum + t.amount, 0) / trades.length).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Stake Médio' : 'Avg Stake'}
                    </div>
                  </div>
                </div>

                {/* Recent Trades Table */}
                <div className="card overflow-x-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white font-comfortaa">
                      {isPortuguese ? 'Trades Recentes' : 'Recent Trades'}
                    </h3>
                    <span className="text-sm text-gray-400">
                      {isPortuguese ? 'Últimos 50 trades' : 'Last 50 trades'}
                    </span>
                  </div>
                  
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Data/Hora' : 'Date/Time'}
                        </th>
                        <th className="text-left p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Ativo' : 'Asset'}
                        </th>
                        <th className="text-left p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Direção' : 'Direction'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          Stake
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Resultado' : 'Result'}
                        </th>
                        <th className="text-right p-3 text-gray-300 font-comfortaa">
                          P&L
                        </th>
                        <th className="text-left p-3 text-gray-300 font-comfortaa">
                          {isPortuguese ? 'Estratégia' : 'Strategy'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 50).map((trade, index) => (
                        <tr key={trade.id} className={`border-b border-gray-700/50 ${
                          index % 2 === 0 ? 'bg-gray-800/20' : 'bg-transparent'
                        }`}>
                          <td className="p-3 text-gray-300">
                            {new Date(trade.entryTime).toLocaleString(isPortuguese ? 'pt-BR' : 'en-US')}
                          </td>
                          <td className="p-3 font-medium text-white">{trade.asset}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              trade.direction === 'call' 
                                ? 'bg-green-500/20 text-green-300' 
                                : 'bg-red-500/20 text-red-300'
                            }`}>
                              {trade.direction === 'call' ? '↗' : '↘'} {trade.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right text-gray-300">${trade.amount.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              trade.result === 'win' 
                                ? 'bg-green-500/20 text-green-300' 
                                : 'bg-red-500/20 text-red-300'
                            }`}>
                              {trade.result === 'win' ? '✓' : '✗'} 
                              {isPortuguese ? (trade.result === 'win' ? 'GANHO' : 'PERDA') : trade.result.toUpperCase()}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-medium ${
                            trade.profit >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            ${trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                          </td>
                          <td className="p-3 text-gray-300">{trade.strategy || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Periods Tab */}
            {activeTab === 'periods' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white font-comfortaa">
                  {isPortuguese ? 'Análise por Período' : 'Period Analysis'}
                </h2>

                {/* Time Period Performance */}
                <div className="grid gap-6">
                  {/* Daily Performance */}
                  <div className="card">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Performance Diária' : 'Daily Performance'}
                    </h3>
                    <div className="grid md:grid-cols-4 gap-4">
                      {(() => {
                        const dailyData = trades.reduce((acc, trade) => {
                          const date = new Date(trade.entryTime).toDateString()
                          if (!acc[date]) {
                            acc[date] = { trades: 0, pnl: 0, wins: 0 }
                          }
                          acc[date].trades++
                          acc[date].pnl += trade.profit
                          if (trade.profit > 0) acc[date].wins++
                          return acc
                        }, {} as Record<string, {trades: number, pnl: number, wins: number}>)

                        const days = Object.entries(dailyData).slice(-7) // Last 7 days
                        
                        return days.map(([date, data]) => (
                          <div key={date} className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                            <div className="text-sm text-gray-400 mb-1">
                              {new Date(date).toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
                                weekday: 'short', month: 'short', day: 'numeric' 
                              })}
                            </div>
                            <div className={`text-lg font-bold mb-1 ${
                              data.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              ${data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-300">
                              {data.trades} trades • {((data.wins / data.trades) * 100).toFixed(0)}% win
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>

                  {/* Monthly Summary */}
                  <div className="card">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Resumo Mensal' : 'Monthly Summary'}
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {(() => {
                        const monthlyData = trades.reduce((acc, trade) => {
                          const month = new Date(trade.entryTime).toISOString().slice(0, 7) // YYYY-MM
                          if (!acc[month]) {
                            acc[month] = { trades: 0, pnl: 0, wins: 0 }
                          }
                          acc[month].trades++
                          acc[month].pnl += trade.profit
                          if (trade.profit > 0) acc[month].wins++
                          return acc
                        }, {} as Record<string, {trades: number, pnl: number, wins: number}>)

                        const months = Object.entries(monthlyData).slice(-3) // Last 3 months
                        
                        return months.map(([month, data]) => (
                          <div key={month} className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                            <div className="text-sm text-gray-400 mb-1">
                              {new Date(month + '-01').toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
                                year: 'numeric', month: 'long' 
                              })}
                            </div>
                            <div className={`text-xl font-bold mb-2 ${
                              data.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              ${data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-300">
                              {data.trades} trades • {((data.wins / data.trades) * 100).toFixed(1)}% win rate
                            </div>
                            <div className="text-sm text-gray-400">
                              Avg: ${(data.pnl / data.trades).toFixed(2)} per trade
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Streaks Tab */}
            {activeTab === 'streaks' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white font-comfortaa">
                  {isPortuguese ? 'Análise de Sequências' : 'Streak Analysis'}
                </h2>

                {/* Current Streaks */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="card text-center bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                    <div className="text-3xl font-bold text-green-300">{streakAnalysis.currentWinStreak}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Sequência Atual de Ganhos' : 'Current Win Streak'}
                    </div>
                  </div>
                  
                  <div className="card text-center bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30">
                    <div className="text-3xl font-bold text-red-300">{streakAnalysis.currentLossStreak}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Sequência Atual de Perdas' : 'Current Loss Streak'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 border-emerald-500/30">
                    <div className="text-3xl font-bold text-emerald-300">{streakAnalysis.maxWinStreak}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Melhor Sequência de Ganhos' : 'Best Win Streak'}
                    </div>
                  </div>

                  <div className="card text-center bg-gradient-to-br from-rose-900/20 to-rose-800/20 border-rose-500/30">
                    <div className="text-3xl font-bold text-rose-300">{streakAnalysis.maxLossStreak}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Pior Sequência de Perdas' : 'Worst Loss Streak'}
                    </div>
                  </div>
                </div>

                {/* Streak Statistics */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Estatísticas de Sequências' : 'Streak Statistics'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">
                          {isPortuguese ? 'Média de ganhos consecutivos:' : 'Average win streak:'}
                        </span>
                        <span className="text-green-300 font-bold">
                          {streakAnalysis.avgWinStreak.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">
                          {isPortuguese ? 'Média de perdas consecutivas:' : 'Average loss streak:'}
                        </span>
                        <span className="text-red-300 font-bold">
                          {streakAnalysis.avgLossStreak.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Análise de Consistência' : 'Consistency Analysis'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">
                          {isPortuguese ? 'Ratio Win/Loss:' : 'Win/Loss Ratio:'}
                        </span>
                        <span className="text-blue-300 font-bold">
                          {(streakAnalysis.avgWinStreak / (streakAnalysis.avgLossStreak || 1)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">
                          {isPortuguese ? 'Controle emocional:' : 'Emotional control:'}
                        </span>
                        <span className={`font-bold ${
                          streakAnalysis.maxLossStreak <= 5 ? 'text-green-300' : 
                          streakAnalysis.maxLossStreak <= 10 ? 'text-yellow-300' : 'text-red-300'
                        }`}>
                          {streakAnalysis.maxLossStreak <= 5 ? 
                            (isPortuguese ? 'Excelente' : 'Excellent') :
                            streakAnalysis.maxLossStreak <= 10 ?
                            (isPortuguese ? 'Bom' : 'Good') :
                            (isPortuguese ? 'Precisa melhorar' : 'Needs improvement')
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Streak History */}
                <div className="card">
                  <h3 className="font-bold text-white mb-4 font-comfortaa">
                    {isPortuguese ? 'Histórico de Sequências' : 'Streak History'}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left p-3 text-gray-300 font-comfortaa">
                            {isPortuguese ? 'Tipo' : 'Type'}
                          </th>
                          <th className="text-right p-3 text-gray-300 font-comfortaa">
                            {isPortuguese ? 'Duração' : 'Length'}
                          </th>
                          <th className="text-left p-3 text-gray-300 font-comfortaa">
                            {isPortuguese ? 'Período' : 'Period'}
                          </th>
                          <th className="text-right p-3 text-gray-300 font-comfortaa">
                            P&L Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {streakAnalysis.streakHistory.slice(-10).map((streak, index) => (
                          <tr key={index} className={`border-b border-gray-700/50 ${
                            index % 2 === 0 ? 'bg-gray-800/20' : 'bg-transparent'
                          }`}>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                streak.type === 'win' 
                                  ? 'bg-green-500/20 text-green-300' 
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                {streak.type === 'win' ? '🔥' : '❄️'} 
                                {isPortuguese ? (streak.type === 'win' ? 'GANHOS' : 'PERDAS') : streak.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-white">{streak.count}</td>
                            <td className="p-3 text-gray-300">
                              {new Date(streak.startDate).toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US')} - 
                              {new Date(streak.endDate).toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US')}
                            </td>
                            <td className={`p-3 text-right font-medium ${
                              streak.totalPnl >= 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              ${streak.totalPnl >= 0 ? '+' : ''}{streak.totalPnl.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Insights Tab */}
            {activeTab === 'insights' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white font-comfortaa">
                  {isPortuguese ? 'Insights e Recomendações' : 'Insights & Recommendations'}
                </h2>

                {/* Performance Insights */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30">
                    <h3 className="font-bold text-white mb-4 font-comfortaa flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      {isPortuguese ? 'Pontos Fortes' : 'Strengths'}
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {(stats?.winRate || 0) > 50 && (
                        <li className="text-green-300">
                          • {isPortuguese ? `Boa taxa de acerto: ${(stats?.winRate || 0).toFixed(1)}%` : `Good win rate: ${(stats?.winRate || 0).toFixed(1)}%`}
                        </li>
                      )}
                      {riskMetrics.maxDrawdown < 20 && (
                        <li className="text-green-300">
                          • {isPortuguese ? 'Drawdown controlado (< 20%)' : 'Controlled drawdown (< 20%)'}
                        </li>
                      )}
                      {streakAnalysis.maxLossStreak <= 5 && (
                        <li className="text-green-300">
                          • {isPortuguese ? 'Excelente controle emocional' : 'Excellent emotional control'}
                        </li>
                      )}
                      {riskMetrics.profitFactor > 1.2 && (
                        <li className="text-green-300">
                          • {isPortuguese ? `Bom fator de lucro: ${riskMetrics.profitFactor.toFixed(2)}` : `Good profit factor: ${riskMetrics.profitFactor.toFixed(2)}`}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="card bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30">
                    <h3 className="font-bold text-white mb-4 font-comfortaa flex items-center gap-2">
                      <span className="text-red-400">⚠️</span>
                      {isPortuguese ? 'Áreas de Melhoria' : 'Areas for Improvement'}
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {(stats?.winRate || 0) < 50 && (
                        <li className="text-red-300">
                          • {isPortuguese ? 'Taxa de acerto baixa - revisar estratégia' : 'Low win rate - review strategy'}
                        </li>
                      )}
                      {riskMetrics.maxDrawdown > 30 && (
                        <li className="text-red-300">
                          • {isPortuguese ? 'Drawdown alto - melhorar gestão de risco' : 'High drawdown - improve risk management'}
                        </li>
                      )}
                      {streakAnalysis.maxLossStreak > 10 && (
                        <li className="text-red-300">
                          • {isPortuguese ? 'Sequências de perda longas - controle emocional' : 'Long loss streaks - emotional control needed'}
                        </li>
                      )}
                      {riskMetrics.profitFactor < 1 && (
                        <li className="text-red-300">
                          • {isPortuguese ? 'Fator de lucro baixo - revisar estratégia' : 'Low profit factor - strategy review needed'}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Actionable Recommendations */}
                <div className="card bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30">
                  <h3 className="font-bold text-white mb-6 font-comfortaa flex items-center gap-2">
                    <span className="text-blue-400">💡</span>
                    {isPortuguese ? 'Recomendações Acionáveis' : 'Actionable Recommendations'}
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-blue-300 mb-3">
                        {isPortuguese ? 'Gestão de Risco' : 'Risk Management'}
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>
                          • {isPortuguese ? 
                            `Considere limitar o stake a ${Math.min(5, Math.round((stats?.avgStake || 0) * 0.8))}% do capital` :
                            `Consider limiting stake to ${Math.min(5, Math.round((stats?.avgStake || 0) * 0.8))}% of capital`
                          }
                        </li>
                        <li>
                          • {isPortuguese ? 'Estabeleça stop-loss diário de 10% do capital' : 'Set daily stop-loss at 10% of capital'}
                        </li>
                        <li>
                          • {isPortuguese ? 'Pare após 3 perdas consecutivas' : 'Stop trading after 3 consecutive losses'}
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-blue-300 mb-3">
                        {isPortuguese ? 'Otimização de Performance' : 'Performance Optimization'}
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>
                          • {isPortuguese ? 
                            `Foque em ${assetPerformance[0]?.asset || 'seus melhores'} ativos (maior winrate)` :
                            `Focus on ${assetPerformance[0]?.asset || 'your best performing'} assets (higher winrate)`
                          }
                        </li>
                        <li>
                          • {isPortuguese ? 'Analise padrões nos horários de melhor performance' : 'Analyze patterns in your best performing time periods'}
                        </li>
                        <li>
                          • {isPortuguese ? 'Mantenha registro das emoções em cada trade' : 'Keep emotion logs for each trade'}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Learning Resources */}
                <div className="card bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
                  <h3 className="font-bold text-white mb-4 font-comfortaa flex items-center gap-2">
                    <span className="text-purple-400">📚</span>
                    {isPortuguese ? 'Recursos de Aprendizado' : 'Learning Resources'}
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                      <h4 className="font-semibold text-purple-300 mb-2">
                        {isPortuguese ? 'Gestão de Risco' : 'Risk Management'}
                      </h4>
                      <p className="text-sm text-gray-300 mb-2">
                        {isPortuguese ? 
                          'Aprenda sobre position sizing e gestão de capital' :
                          'Learn about position sizing and capital management'
                        }
                      </p>
                      <button className="text-xs text-purple-400 hover:text-purple-300">
                        {isPortuguese ? 'Ver recursos →' : 'View resources →'}
                      </button>
                    </div>
                    
                    <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                      <h4 className="font-semibold text-purple-300 mb-2">
                        {isPortuguese ? 'Psicologia do Trading' : 'Trading Psychology'}
                      </h4>
                      <p className="text-sm text-gray-300 mb-2">
                        {isPortuguese ? 
                          'Controle emocional e disciplina no trading' :
                          'Emotional control and trading discipline'
                        }
                      </p>
                      <button className="text-xs text-purple-400 hover:text-purple-300">
                        {isPortuguese ? 'Ver recursos →' : 'View resources →'}
                      </button>
                    </div>
                    
                    <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                      <h4 className="font-semibold text-purple-300 mb-2">
                        {isPortuguese ? 'Análise Técnica' : 'Technical Analysis'}
                      </h4>
                      <p className="text-sm text-gray-300 mb-2">
                        {isPortuguese ? 
                          'Melhore suas habilidades de análise de mercado' :
                          'Improve your market analysis skills'
                        }
                      </p>
                      <button className="text-xs text-purple-400 hover:text-purple-300">
                        {isPortuguese ? 'Ver recursos →' : 'View resources →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Professional Analytics Summary */}
        <div className="mt-16 py-8">
          <div className="card bg-gradient-to-r from-indigo-800/20 to-purple-800/20 border-primary/20 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-3xl">📊</div>
              <h3 className="font-heading text-xl font-bold">
                {isPortuguese ? 'Analytics V1 - Professional Bloomberg Style' : 'Analytics V1 - Professional Bloomberg Style'}
              </h3>
            </div>
            <p className="text-gray-400 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'Centro de aprendizado analytics profissional com métricas avançadas, análise de risco, performance por ativo e insights acionáveis para melhorar sua estratégia de trading.'
                : 'Professional analytics learning center with advanced metrics, risk analysis, asset performance and actionable insights to improve your trading strategy.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Métricas Avançadas' : 'Advanced Metrics'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Análise de Risco' : 'Risk Analysis'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Performance de Ativos' : 'Asset Performance'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Exportação de Dados' : 'Data Export'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Insights Profissionais' : 'Professional Insights'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
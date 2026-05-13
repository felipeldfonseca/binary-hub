'use client'
import React, { useState, useMemo } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import type { Trade as SupabaseTrade } from '@/types/database'

interface Trade {
  asset: string
  amount: number
  entryTime: Date
  result: 'win' | 'loss' | 'tie'
  profit: number
}

function adaptTrade(t: SupabaseTrade): Trade {
  return {
    asset: t.symbol,
    amount: t.stake_amount ?? 0,
    entryTime: new Date(t.entry_time),
    result: t.result === 'breakeven' ? 'tie' : (t.result ?? 'loss') as 'win' | 'loss' | 'tie',
    profit: t.pnl ?? 0,
  }
}

export default function AnalyticsV2Dashboard() {
  const { isPortuguese } = useLanguage()
  const [analyticsView, setAnalyticsView] = useState<'performance' | 'assets' | 'time' | 'statistics'>('performance')
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly')

  const { activeMarket } = useMarketContext()
  const accountFilter = useMemo(
    () => (activeMarket?.marketType ? { marketType: activeMarket.marketType } : undefined),
    [activeMarket?.marketType]
  )
  const { trades: rawTrades, isLoading } = useTradesSupabase(accountFilter)

  const trades = useMemo(() => rawTrades.map(t => adaptTrade(t as SupabaseTrade)), [rawTrades])

  // Compute stats from Supabase trades (replaces useTradeStats)
  const stats = useMemo(() => {
    const totalTrades = trades.length
    const winTrades = trades.filter(t => t.profit > 0).length
    const lossTrades = trades.filter(t => t.profit < 0).length
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0)
    const avgStake = totalTrades > 0 ? trades.reduce((sum, t) => sum + t.amount, 0) / totalTrades : 0
    return { totalTrades, winTrades, lossTrades, winRate, totalProfit, avgStake }
  }, [trades])

  // Chart Error Wrapper
  const ChartWrapper = ({ children, title }: { children: React.ReactNode; title: string }) => {
    try {
      return <>{children}</>
    } catch (error) {
      return (
        <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm">
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
            📊 {title}
          </h4>
          <div className="h-48 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p>Chart loading...</p>
              <p className="text-xs mt-2">Using mock data for demo</p>
            </div>
          </div>
        </div>
      )
    }
  }

  // Performance data processing
  const performanceData = useMemo(() => {
    if (!trades.length) return []
    
    const monthlyData = trades.reduce((acc: any, trade) => {
      const month = trade.entryTime.toISOString().substring(0, 7) // YYYY-MM
      if (!acc[month]) {
        acc[month] = { month, profit: 0, trades: 0, wins: 0 }
      }
      acc[month].profit += trade.profit
      acc[month].trades += 1
      if (trade.result === 'win') acc[month].wins += 1
      return acc
    }, {})

    return Object.values(monthlyData).map((data: any) => ({
      ...data,
      winRate: data.trades > 0 ? (data.wins / data.trades * 100) : 0
    })).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [trades])

  // Asset distribution
  const assetData = useMemo(() => {
    if (!trades.length) return []
    
    const assetCounts = trades.reduce((acc: any, trade) => {
      acc[trade.asset] = (acc[trade.asset] || 0) + 1
      return acc
    }, {})

    return Object.entries(assetCounts).map(([asset, count]) => ({
      asset,
      count: count as number,
      percentage: ((count as number) / trades.length * 100).toFixed(1)
    })).sort((a, b) => (b.count as number) - (a.count as number))
  }, [trades])

  // Time analysis
  const timeData = useMemo(() => {
    if (!trades.length) return []
    
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      trades: 0,
      wins: 0,
      profit: 0
    }))

    trades.forEach(trade => {
      const hour = trade.entryTime.getHours()
      hourlyData[hour].trades += 1
      if (trade.result === 'win') hourlyData[hour].wins += 1
      hourlyData[hour].profit += trade.profit
    })

    return hourlyData.map(data => ({
      ...data,
      winRate: data.trades > 0 ? (data.wins / data.trades * 100) : 0
    })).filter(data => data.trades > 0)
  }, [trades])

  return (
    <div className="min-h-screen py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl font-bold mb-4 flex items-center justify-center gap-3">
          <span className="text-4xl">📊</span>
          {isPortuguese ? 'Análises V2 - Dashboard Visual' : 'Analytics V2 - Visual Dashboard'}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          {isPortuguese 
            ? 'Dashboard com gráficos interativos e visualizações avançadas para análise de performance detalhada.'
            : 'Dashboard with interactive charts and advanced visualizations for detailed performance analysis.'}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center mb-8">
        <div className="card p-2 bg-white/5 border-orange-500/20">
          <div className="flex gap-1">
            {[
              { key: 'performance', icon: '📈', label: isPortuguese ? 'Performance' : 'Performance' },
              { key: 'assets', icon: '🎯', label: isPortuguese ? 'Ativos' : 'Assets' },
              { key: 'time', icon: '⏰', label: isPortuguese ? 'Horários' : 'Time Analysis' },
              { key: 'statistics', icon: '📊', label: isPortuguese ? 'Estatísticas' : 'Statistics' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setAnalyticsView(tab.key as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  analyticsView === tab.key
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex justify-center mb-8">
        <div className="card p-2 bg-white/5 border-orange-500/20">
          <div className="flex gap-1">
            {[
              { key: 'daily', label: isPortuguese ? 'Diário' : 'Daily' },
              { key: 'weekly', label: isPortuguese ? 'Semanal' : 'Weekly' },
              { key: 'monthly', label: isPortuguese ? 'Mensal' : 'Monthly' },
              { key: 'yearly', label: isPortuguese ? 'Anual' : 'Yearly' }
            ].map(period => (
              <button
                key={period.key}
                onClick={() => setTimeframe(period.key as any)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  timeframe === period.key
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="space-y-8">
        {analyticsView === 'performance' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card bg-gradient-to-br from-green-800/30 to-green-600/30 border-green-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">
                      {isPortuguese ? 'Lucro Total' : 'Total Profit'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      ${stats.totalProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-3xl">💰</div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-blue-800/30 to-blue-600/30 border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm font-medium">
                      {isPortuguese ? 'Taxa de Vitória' : 'Win Rate'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.winRate?.toFixed(1) || '0.0'}%
                    </p>
                  </div>
                  <div className="text-3xl">🎯</div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-purple-800/30 to-purple-600/30 border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-sm font-medium">
                      {isPortuguese ? 'Total Trades' : 'Total Trades'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.totalTrades || 0}
                    </p>
                  </div>
                  <div className="text-3xl">📊</div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-orange-800/30 to-orange-600/30 border-orange-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 text-sm font-medium">
                      {isPortuguese ? 'Stake Médio' : 'Avg Stake'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      ${stats?.avgStake?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="text-3xl">💵</div>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="card">
              <ChartWrapper title={isPortuguese ? 'Performance ao Longo do Tempo' : 'Performance Over Time'}>
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-6xl mb-4">📈</div>
                    <h3 className="text-xl font-bold mb-2">
                      {isPortuguese ? 'Gráfico de Performance' : 'Performance Chart'}
                    </h3>
                    <p className="text-gray-500">
                      {isPortuguese ? 'Exibindo dados de' : 'Showing data for'} {performanceData.length} {isPortuguese ? 'períodos' : 'periods'}
                    </p>
                    <div className="mt-4 text-sm">
                      {performanceData.slice(0, 3).map((period: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1">
                          <span>{period.month}</span>
                          <span className={period.profit > 0 ? 'text-green-400' : 'text-red-400'}>
                            ${period.profit.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ChartWrapper>
            </div>
          </div>
        )}

        {analyticsView === 'assets' && (
          <div className="space-y-6">
            <div className="card">
              <ChartWrapper title={isPortuguese ? 'Distribuição de Ativos' : 'Asset Distribution'}>
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-400 w-full">
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="text-xl font-bold mb-4">
                      {isPortuguese ? 'Análise de Ativos' : 'Asset Analysis'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                      {assetData.slice(0, 6).map((asset, idx) => (
                        <div key={idx} className="bg-white/5 rounded-lg p-3">
                          <div className="font-medium text-white">{asset.asset}</div>
                          <div className="text-sm text-gray-400">{asset.count} trades</div>
                          <div className="text-orange-400 font-bold">{asset.percentage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ChartWrapper>
            </div>
          </div>
        )}

        {analyticsView === 'time' && (
          <div className="space-y-6">
            <div className="card">
              <ChartWrapper title={isPortuguese ? 'Análise de Horários' : 'Time Analysis'}>
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center text-gray-400 w-full">
                    <div className="text-6xl mb-4">⏰</div>
                    <h3 className="text-xl font-bold mb-4">
                      {isPortuguese ? 'Performance por Horário' : 'Performance by Hour'}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 max-w-2xl mx-auto text-sm">
                      {timeData.slice(0, 9).map((time, idx) => (
                        <div key={idx} className="bg-white/5 rounded p-2">
                          <div className="font-bold text-white">{time.hour}</div>
                          <div className="text-gray-400">{time.trades} trades</div>
                          <div className={`font-bold ${time.winRate > 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {time.winRate.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ChartWrapper>
            </div>
          </div>
        )}

        {analyticsView === 'statistics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  📊 {isPortuguese ? 'Estatísticas Gerais' : 'General Statistics'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Trades Vencedores' : 'Winning Trades'}</span>
                    <span className="text-green-400 font-bold">{stats?.winTrades || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Trades Perdedores' : 'Losing Trades'}</span>
                    <span className="text-red-400 font-bold">{stats?.lossTrades || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Maior Sequência' : 'Best Streak'}</span>
                    <span className="text-orange-400 font-bold">-</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">{isPortuguese ? 'Lucro Médio' : 'Avg Profit'}</span>
                    <span className="text-blue-400 font-bold">
                      ${stats.totalTrades > 0 ? (stats.totalProfit / stats.totalTrades).toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  🎯 {isPortuguese ? 'Análise de Risco' : 'Risk Analysis'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Risco por Trade' : 'Risk per Trade'}</span>
                    <span className="text-yellow-400 font-bold">${stats?.avgStake?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Drawdown Máximo' : 'Max Drawdown'}</span>
                    <span className="text-red-400 font-bold">-</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-gray-400">{isPortuguese ? 'Sharpe Ratio' : 'Sharpe Ratio'}</span>
                    <span className="text-purple-400 font-bold">-</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">{isPortuguese ? 'Kelly %' : 'Kelly %'}</span>
                    <span className="text-green-400 font-bold">-</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading States */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card bg-gradient-to-br from-orange-800/50 to-yellow-800/50 border-orange-500/30 border p-8 text-center">
            <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white font-comfortaa">
              {isPortuguese ? 'Carregando analytics...' : 'Loading analytics...'}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 py-8">
        <div className="card bg-gradient-to-r from-orange-800/20 via-yellow-800/20 to-amber-800/20 border-orange-500/20 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-3xl">📊</div>
            <h3 className="font-heading text-xl font-bold">
              {isPortuguese ? 'Analytics V2 - Dashboard Visual' : 'Analytics V2 - Visual Dashboard'}
            </h3>
          </div>
          <p className="text-gray-400 max-w-3xl mx-auto mb-6">
            {isPortuguese 
              ? 'Esta versão de análises oferece visualizações avançadas com gráficos interativos, análise de performance por período, distribuição de ativos, análise temporal e métricas de risco para otimização de estratégias.'
              : 'This analytics version offers advanced visualizations with interactive charts, performance analysis by period, asset distribution, temporal analysis and risk metrics for strategy optimization.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
'use client'

import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadialBarChart, RadialBar, Legend } from 'recharts'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade } from '@/hooks/useTrades'
import { TradeStats } from '@/hooks/useTradeStats'

interface PerformancePanelProps {
  trades: Trade[]
  stats: TradeStats | null
}

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'neutral'
  benchmark?: number
  description: string
}

interface MonthlyPerformance {
  month: string
  trades: number
  winRate: number
  pnl: number
  sharpeRatio: number
  maxDrawdown: number
}

export default function PerformancePanel({ trades, stats }: PerformancePanelProps) {
  const { isPortuguese } = useLanguage()
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'monthly' | 'detailed'>('overview')

  // Calculate advanced performance metrics
  const performanceMetrics = useMemo(() => {
    if (!trades.length || !stats) return []

    const recentTrades = trades.slice(-30) // Last 30 trades
    const profits = trades.map(t => t.profit)
    const winTrades = trades.filter(t => t.result === 'win')
    const lossTrades = trades.filter(t => t.result === 'loss')

    // Sharpe Ratio (simplified)
    const avgProfit = profits.reduce((sum, p) => sum + p, 0) / profits.length
    const stdDev = Math.sqrt(profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length)
    const sharpeRatio = stdDev !== 0 ? avgProfit / stdDev : 0

    // Profit Factor
    const grossProfit = winTrades.reduce((sum, t) => sum + t.profit, 0)
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.profit, 0))
    const profitFactor = grossLoss !== 0 ? grossProfit / grossLoss : 0

    // Average Win vs Average Loss
    const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0
    const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 0
    const winLossRatio = avgLoss !== 0 ? avgWin / avgLoss : 0

    // Largest Win and Loss
    const largestWin = Math.max(...profits)
    const largestLoss = Math.min(...profits)

    // Consecutive wins/losses
    let maxConsecutiveWins = 0
    let maxConsecutiveLosses = 0
    let currentWinStreak = 0
    let currentLossStreak = 0

    trades.forEach(trade => {
      if (trade.result === 'win') {
        currentWinStreak++
        currentLossStreak = 0
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak)
      } else {
        currentLossStreak++
        currentWinStreak = 0
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak)
      }
    })

    // Recovery Factor
    const recoveryFactor = stats.maxDrawdown !== 0 ? stats.totalPnl / Math.abs(stats.maxDrawdown) : 0

    // Recent performance trend
    const last10Trades = trades.slice(-10)
    const recent10Pnl = last10Trades.reduce((sum, t) => sum + t.profit, 0)
    const prev10Trades = trades.slice(-20, -10)
    const prev10Pnl = prev10Trades.length > 0 ? prev10Trades.reduce((sum, t) => sum + t.profit, 0) : 0
    
    const recentTrend = recent10Pnl > prev10Pnl ? 'up' : recent10Pnl < prev10Pnl ? 'down' : 'neutral'

    const metrics: PerformanceMetric[] = [
      {
        name: isPortuguese ? 'Taxa de Acerto' : 'Win Rate',
        value: stats.winRate,
        unit: '%',
        trend: stats.winRate >= 50 ? 'up' : 'down',
        benchmark: 50,
        description: isPortuguese ? 
          'Porcentagem de operações vencedoras' :
          'Percentage of winning trades'
      },
      {
        name: isPortuguese ? 'Fator de Lucro' : 'Profit Factor',
        value: profitFactor,
        unit: 'x',
        trend: profitFactor >= 1.5 ? 'up' : profitFactor >= 1.0 ? 'neutral' : 'down',
        benchmark: 1.5,
        description: isPortuguese ?
          'Lucro bruto dividido por perda bruta' :
          'Gross profit divided by gross loss'
      },
      {
        name: isPortuguese ? 'Índice de Sharpe' : 'Sharpe Ratio',
        value: sharpeRatio,
        unit: '',
        trend: sharpeRatio >= 1.0 ? 'up' : sharpeRatio >= 0 ? 'neutral' : 'down',
        benchmark: 1.0,
        description: isPortuguese ?
          'Retorno ajustado ao risco' :
          'Risk-adjusted return'
      },
      {
        name: isPortuguese ? 'Relação Ganho/Perda' : 'Win/Loss Ratio',
        value: winLossRatio,
        unit: 'x',
        trend: winLossRatio >= 1.0 ? 'up' : 'down',
        benchmark: 1.0,
        description: isPortuguese ?
          'Ganho médio dividido por perda média' :
          'Average win divided by average loss'
      },
      {
        name: isPortuguese ? 'Fator de Recuperação' : 'Recovery Factor',
        value: recoveryFactor,
        unit: 'x',
        trend: recoveryFactor >= 2.0 ? 'up' : recoveryFactor >= 1.0 ? 'neutral' : 'down',
        benchmark: 2.0,
        description: isPortuguese ?
          'Lucro total dividido pelo drawdown máximo' :
          'Total profit divided by maximum drawdown'
      },
      {
        name: isPortuguese ? 'Maior Ganho' : 'Largest Win',
        value: largestWin,
        unit: '$',
        trend: 'neutral',
        description: isPortuguese ?
          'Maior lucro em uma única operação' :
          'Largest profit in a single trade'
      },
      {
        name: isPortuguese ? 'Maior Perda' : 'Largest Loss',
        value: Math.abs(largestLoss),
        unit: '$',
        trend: 'neutral',
        description: isPortuguese ?
          'Maior perda em uma única operação' :
          'Largest loss in a single trade'
      },
      {
        name: isPortuguese ? 'Máx. Vitórias Consecutivas' : 'Max Consecutive Wins',
        value: maxConsecutiveWins,
        unit: '',
        trend: 'neutral',
        description: isPortuguese ?
          'Máximo de vitórias consecutivas' :
          'Maximum consecutive wins'
      },
      {
        name: isPortuguese ? 'Máx. Perdas Consecutivas' : 'Max Consecutive Losses',
        value: maxConsecutiveLosses,
        unit: '',
        trend: 'neutral',
        description: isPortuguese ?
          'Máximo de perdas consecutivas' :
          'Maximum consecutive losses'
      },
      {
        name: isPortuguese ? 'Tendência Recente' : 'Recent Trend',
        value: recent10Pnl,
        unit: '$',
        trend: recentTrend,
        description: isPortuguese ?
          'Performance das últimas 10 operações' :
          'Performance of last 10 trades'
      }
    ]

    return metrics
  }, [trades, stats, isPortuguese])

  // Calculate monthly performance
  const monthlyPerformance = useMemo(() => {
    if (!trades.length) return []

    const monthlyData = trades.reduce((acc, trade) => {
      const date = new Date(trade.entryTime)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          trades: [],
          totalPnl: 0
        }
      }
      
      acc[monthKey].trades.push(trade)
      acc[monthKey].totalPnl += trade.profit
      return acc
    }, {} as Record<string, { month: string; trades: Trade[]; totalPnl: number }>)

    return Object.values(monthlyData).map(data => {
      const wins = data.trades.filter(t => t.result === 'win').length
      const winRate = (wins / data.trades.length) * 100
      
      // Calculate monthly Sharpe ratio
      const profits = data.trades.map(t => t.profit)
      const avgProfit = profits.reduce((sum, p) => sum + p, 0) / profits.length
      const stdDev = Math.sqrt(profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length)
      const sharpeRatio = stdDev !== 0 ? avgProfit / stdDev : 0

      // Calculate monthly max drawdown
      let peak = 0
      let maxDrawdown = 0
      let runningPnl = 0
      
      data.trades.forEach(trade => {
        runningPnl += trade.profit
        if (runningPnl > peak) peak = runningPnl
        const currentDrawdown = peak - runningPnl
        if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown
      })

      return {
        month: new Date(data.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        trades: data.trades.length,
        winRate,
        pnl: data.totalPnl,
        sharpeRatio,
        maxDrawdown
      } as MonthlyPerformance
    }).sort((a, b) => a.month.localeCompare(b.month)).slice(-12) // Last 12 months
  }, [trades])

  // Performance score calculation
  const performanceScore = useMemo(() => {
    if (!stats) return 0

    let score = 0
    
    // Win rate (0-30 points)
    score += Math.min(30, (stats.winRate / 100) * 30)
    
    // Profit factor (0-25 points)
    const profitFactor = performanceMetrics.find(m => m.name.includes('Profit') || m.name.includes('Lucro'))?.value || 0
    score += Math.min(25, profitFactor * 12.5)
    
    // Sharpe ratio (0-25 points)
    const sharpe = performanceMetrics.find(m => m.name.includes('Sharpe'))?.value || 0
    score += Math.min(25, Math.max(0, sharpe * 12.5))
    
    // Recovery factor (0-20 points)
    const recovery = performanceMetrics.find(m => m.name.includes('Recovery') || m.name.includes('Recuperação'))?.value || 0
    score += Math.min(20, recovery * 10)

    return Math.min(100, Math.max(0, score))
  }, [stats, performanceMetrics])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-win'
    if (score >= 60) return 'text-primary'
    if (score >= 40) return 'text-warning'
    return 'text-loss'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return isPortuguese ? 'Excelente' : 'Excellent'
    if (score >= 60) return isPortuguese ? 'Bom' : 'Good'
    if (score >= 40) return isPortuguese ? 'Regular' : 'Fair'
    return isPortuguese ? 'Precisa Melhorar' : 'Needs Improvement'
  }

  const renderTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return <span className="text-win">↗</span>
      case 'down': return <span className="text-loss">↘</span>
      case 'neutral': return <span className="text-gray-400">→</span>
    }
  }

  if (!trades.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-400 font-comfortaa">
          {isPortuguese ? 
            'Nenhuma operação encontrada. Adicione operações para ver métricas de performance.' :
            'No trades found. Add trades to see performance metrics.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-poly font-bold text-white mb-2">
            {isPortuguese ? 'Painel de Performance' : 'Performance Panel'}
          </h2>
          <p className="text-gray-300 font-comfortaa">
            {isPortuguese ? 'Métricas avançadas e indicadores de performance' : 'Advanced metrics and performance indicators'}
          </p>
        </div>
        
        {/* Performance Score */}
        <div className="card text-center">
          <div className={`text-3xl font-bold ${getScoreColor(performanceScore)}`}>
            {performanceScore.toFixed(0)}
          </div>
          <div className="text-sm text-gray-300">
            {getScoreLabel(performanceScore)}
          </div>
          <div className="text-xs text-gray-400">
            {isPortuguese ? 'Score de Performance' : 'Performance Score'}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-600">
        {[
          { key: 'overview', label: isPortuguese ? 'Visão Geral' : 'Overview' },
          { key: 'monthly', label: isPortuguese ? 'Mensal' : 'Monthly' },
          { key: 'detailed', label: isPortuguese ? 'Detalhado' : 'Detailed' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedMetric(tab.key as any)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedMetric === tab.key
                ? 'text-primary border-primary'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedMetric === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {performanceMetrics.slice(0, 9).map((metric, index) => (
            <div key={index} className="card">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-gray-300">
                  {metric.name}
                </div>
                {renderTrendIcon(metric.trend)}
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                metric.trend === 'up' ? 'text-win' :
                metric.trend === 'down' ? 'text-loss' : 'text-primary'
              }`}>
                {metric.unit === '$' ? '$' : ''}{metric.value.toFixed(metric.unit === '$' ? 2 : 2)}
                {metric.unit !== '$' ? metric.unit : ''}
              </div>
              {metric.benchmark && (
                <div className="text-xs text-gray-400">
                  {isPortuguese ? 'Benchmark: ' : 'Benchmark: '}
                  {metric.unit === '$' ? '$' : ''}{metric.benchmark}
                  {metric.unit !== '$' ? metric.unit : ''}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedMetric === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly P&L Chart */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'P&L Mensal' : 'Monthly P&L'}
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#999"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#999"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                    contentStyle={{
                      backgroundColor: 'rgba(80, 80, 80, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    fill="#E1FFD9"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Performance Table */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'Detalhes Mensais' : 'Monthly Details'}
            </h3>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{isPortuguese ? 'Mês' : 'Month'}</th>
                    <th>{isPortuguese ? 'Operações' : 'Trades'}</th>
                    <th>{isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}</th>
                    <th>P&L</th>
                    <th>{isPortuguese ? 'Índice Sharpe' : 'Sharpe Ratio'}</th>
                    <th>{isPortuguese ? 'Max. Drawdown' : 'Max Drawdown'}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyPerformance.map((month, index) => (
                    <tr key={index}>
                      <td className="font-medium">{month.month}</td>
                      <td>{month.trades}</td>
                      <td>
                        <span className={month.winRate >= 50 ? 'text-win' : 'text-loss'}>
                          {month.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className={month.pnl >= 0 ? 'text-win' : 'text-loss'}>
                        ${month.pnl >= 0 ? '+' : ''}{month.pnl.toFixed(2)}
                      </td>
                      <td className={month.sharpeRatio >= 0 ? 'text-win' : 'text-loss'}>
                        {month.sharpeRatio.toFixed(2)}
                      </td>
                      <td className="text-loss">
                        ${month.maxDrawdown.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedMetric === 'detailed' && (
        <div className="space-y-6">
          {/* Detailed Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="card">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-white">{metric.name}</h4>
                  {renderTrendIcon(metric.trend)}
                </div>
                
                <div className={`text-3xl font-bold mb-2 ${
                  metric.trend === 'up' ? 'text-win' :
                  metric.trend === 'down' ? 'text-loss' : 'text-primary'
                }`}>
                  {metric.unit === '$' ? '$' : ''}{metric.value.toFixed(metric.unit === '$' ? 2 : 2)}
                  {metric.unit !== '$' ? metric.unit : ''}
                </div>
                
                {metric.benchmark && (
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-400">{isPortuguese ? 'Benchmark:' : 'Benchmark:'}</span>
                    <span className="text-gray-300">
                      {metric.unit === '$' ? '$' : ''}{metric.benchmark}
                      {metric.unit !== '$' ? metric.unit : ''}
                    </span>
                  </div>
                )}
                
                <p className="text-sm text-gray-300 mb-3">
                  {metric.description}
                </p>
                
                {/* Performance bar */}
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      metric.trend === 'up' ? 'bg-win' :
                      metric.trend === 'down' ? 'bg-loss' : 'bg-primary'
                    }`}
                    style={{ 
                      width: metric.benchmark ? 
                        `${Math.min(100, Math.max(0, (metric.value / metric.benchmark) * 50))}%` :
                        '50%'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
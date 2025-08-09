'use client'

import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade } from '@/hooks/useTrades'
import { TradeStats } from '@/hooks/useTradeStats'

interface TradingAnalyticsProps {
  trades: Trade[]
  stats: TradeStats | null
  loading: boolean
}

export default function TradingAnalytics({ trades, stats, loading }: TradingAnalyticsProps) {
  const { isPortuguese } = useLanguage()
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  // Process trades data for charts
  const chartData = useMemo(() => {
    if (!trades.length) return []

    const filteredTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.entryTime)
      const now = new Date()
      const cutoff = new Date()
      
      switch (selectedTimeframe) {
        case '7d': cutoff.setDate(now.getDate() - 7); break
        case '30d': cutoff.setDate(now.getDate() - 30); break
        case '90d': cutoff.setDate(now.getDate() - 90); break
        default: return true
      }
      
      return tradeDate >= cutoff
    })

    // Group trades by date and calculate cumulative P&L
    const tradesByDate = filteredTrades.reduce((acc, trade) => {
      const dateStr = new Date(trade.entryTime).toISOString().split('T')[0]
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, trades: [], pnl: 0 }
      }
      acc[dateStr].trades.push(trade)
      acc[dateStr].pnl += trade.profit
      return acc
    }, {} as Record<string, { date: string; trades: Trade[]; pnl: number }>)

    // Convert to array and calculate cumulative
    const dailyData = Object.values(tradesByDate).sort((a, b) => a.date.localeCompare(b.date))
    let cumulativePnl = 0
    
    return dailyData.map(day => {
      cumulativePnl += day.pnl
      return {
        date: new Date(day.date).toLocaleDateString(),
        dailyPnl: day.pnl,
        cumulativePnl,
        tradeCount: day.trades.length,
        winRate: (day.trades.filter(t => t.result === 'win').length / day.trades.length) * 100
      }
    })
  }, [trades, selectedTimeframe])

  // Asset breakdown
  const assetBreakdown = useMemo(() => {
    if (!trades.length) return []

    const assetStats = trades.reduce((acc, trade) => {
      if (!acc[trade.asset]) {
        acc[trade.asset] = { asset: trade.asset, trades: 0, wins: 0, totalPnl: 0 }
      }
      acc[trade.asset].trades++
      if (trade.result === 'win') acc[trade.asset].wins++
      acc[trade.asset].totalPnl += trade.profit
      return acc
    }, {} as Record<string, { asset: string; trades: number; wins: number; totalPnl: number }>)

    return Object.values(assetStats).map(asset => ({
      ...asset,
      winRate: (asset.wins / asset.trades) * 100
    })).sort((a, b) => b.trades - a.trades).slice(0, 8)
  }, [trades])

  // Hourly performance
  const hourlyPerformance = useMemo(() => {
    if (!trades.length) return []

    const hourlyStats = trades.reduce((acc, trade) => {
      const hour = new Date(trade.entryTime).getHours()
      if (!acc[hour]) {
        acc[hour] = { hour, trades: 0, wins: 0, totalPnl: 0 }
      }
      acc[hour].trades++
      if (trade.result === 'win') acc[hour].wins++
      acc[hour].totalPnl += trade.profit
      return acc
    }, {} as Record<number, { hour: number; trades: number; wins: number; totalPnl: number }>)

    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      trades: hourlyStats[hour]?.trades || 0,
      winRate: hourlyStats[hour] ? (hourlyStats[hour].wins / hourlyStats[hour].trades) * 100 : 0,
      avgPnl: hourlyStats[hour] ? hourlyStats[hour].totalPnl / hourlyStats[hour].trades : 0
    }))
  }, [trades])

  const COLORS = ['#E1FFD9', '#C8E6C0', '#B0D4A8', '#98C290', '#80B078', '#689E60', '#508C48', '#387A30']

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="spinner mx-auto mb-4"></div>
        <p className="text-white font-comfortaa">
          {isPortuguese ? 'Carregando análises...' : 'Loading analytics...'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with timeframe selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-poly font-bold text-white mb-2">
            {isPortuguese ? 'Análise de Trading' : 'Trading Analytics'}
          </h2>
          <p className="text-gray-300 font-comfortaa">
            {isPortuguese ? 'Visão detalhada da sua performance' : 'Detailed view of your performance'}
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-4 py-2 rounded-lg font-comfortaa font-medium transition-all ${
                selectedTimeframe === tf
                  ? 'bg-primary text-background'
                  : 'bg-dark-card text-white hover:bg-white/20'
              }`}
            >
              {tf === 'all' ? (isPortuguese ? 'Tudo' : 'All') : tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalTrades}</div>
            <div className="text-sm text-gray-300 font-comfortaa">
              {isPortuguese ? 'Total Operações' : 'Total Trades'}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary">{stats.winRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-300 font-comfortaa">
              {isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              ${stats.totalPnl.toFixed(2)}
            </div>
            <div className="text-sm text-gray-300 font-comfortaa">
              {isPortuguese ? 'P&L Total' : 'Total P&L'}
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${stats.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              ${stats.avgPnl.toFixed(2)}
            </div>
            <div className="text-sm text-gray-300 font-comfortaa">
              {isPortuguese ? 'P&L Médio' : 'Avg P&L'}
            </div>
          </div>
        </div>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L Chart */}
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'P&L Cumulativo' : 'Cumulative P&L'}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cumulativePnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E1FFD9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E1FFD9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
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
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P&L']}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(80, 80, 80, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulativePnl" 
                  stroke="#E1FFD9" 
                  fillOpacity={1}
                  fill="url(#cumulativePnl)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Win Rate */}
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'Taxa de Acerto Diária' : 'Daily Win Rate'}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#999"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#999"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                  contentStyle={{
                    backgroundColor: 'rgba(80, 80, 80, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="winRate" 
                  stroke="#E1FFD9" 
                  strokeWidth={2}
                  dot={{ fill: '#E1FFD9', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Breakdown */}
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'Performance por Ativo' : 'Asset Performance'}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="trades"
                >
                  {assetBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name, props: any) => [
                    `${value} trades (${props.payload.winRate.toFixed(1)}% win rate)`,
                    props.payload.asset
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(80, 80, 80, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Performance */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'Performance por Horário' : 'Hourly Performance'}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#999"
                  fontSize={12}
                  tickLine={false}
                  interval={1}
                />
                <YAxis 
                  stroke="#999"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number, name) => [
                    name === 'trades' ? `${value} trades` : `${value.toFixed(1)}%`,
                    name === 'trades' ? 'Trades' : 'Win Rate'
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(80, 80, 80, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="trades" fill="#E1FFD9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Asset Details Table */}
      {assetBreakdown.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'Detalhes por Ativo' : 'Asset Details'}
          </h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{isPortuguese ? 'Ativo' : 'Asset'}</th>
                  <th>{isPortuguese ? 'Operações' : 'Trades'}</th>
                  <th>{isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}</th>
                  <th>P&L Total</th>
                  <th>P&L Médio</th>
                </tr>
              </thead>
              <tbody>
                {assetBreakdown.map((asset, index) => (
                  <tr key={asset.asset}>
                    <td className="font-medium">{asset.asset}</td>
                    <td>{asset.trades}</td>
                    <td>
                      <span className={asset.winRate >= 50 ? 'text-win' : 'text-loss'}>
                        {asset.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={asset.totalPnl >= 0 ? 'text-win' : 'text-loss'}>
                      ${asset.totalPnl.toFixed(2)}
                    </td>
                    <td className={asset.totalPnl >= 0 ? 'text-win' : 'text-loss'}>
                      ${(asset.totalPnl / asset.trades).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
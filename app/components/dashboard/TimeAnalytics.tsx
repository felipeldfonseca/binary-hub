'use client'

import { useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface TimePerformance {
  hour: number
  trades: number
  wins: number
  losses: number
  winRate: number
  totalProfit: number
  avgProfit: number
  volume: number
}

interface DayPerformance {
  day: number
  dayName: string
  dayNamePT: string
  trades: number
  wins: number
  losses: number
  winRate: number
  totalProfit: number
  avgProfit: number
  volume: number
}

interface OptimalTradingWindow {
  start: number
  end: number
  description: string
  descriptionPT: string
  winRate: number
  trades: number
  avgProfit: number
}

export default function TimeAnalytics() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('month')
  const { trades, loading: tradesLoading } = useTrades({ limit: 500 })
  const [hourlyPerformance, setHourlyPerformance] = useState<TimePerformance[]>([])
  const [dailyPerformance, setDailyPerformance] = useState<DayPerformance[]>([])
  const [optimalWindows, setOptimalWindows] = useState<OptimalTradingWindow[]>([])
  const [selectedView, setSelectedView] = useState<'hours' | 'days'>('hours')

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayNamesPT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  // Analyze time-based performance
  useEffect(() => {
    if (!trades || tradesLoading || trades.length < 10) return

    // Hourly performance analysis
    const hourlyData: Record<number, { trades: any[], wins: number, totalProfit: number }> = {}
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { trades: [], wins: 0, totalProfit: 0 }
    }

    trades.forEach(trade => {
      const hour = new Date(trade.entryTime).getHours()
      hourlyData[hour].trades.push(trade)
      if (trade.result === 'win') {
        hourlyData[hour].wins++
      }
      hourlyData[hour].totalProfit += trade.profit
    })

    const hourlyPerf: TimePerformance[] = Object.entries(hourlyData).map(([hour, data]) => {
      const h = parseInt(hour)
      const trades = data.trades.length
      const wins = data.wins
      const losses = trades - wins
      const winRate = trades > 0 ? (wins / trades) * 100 : 0
      const totalProfit = data.totalProfit
      const avgProfit = trades > 0 ? totalProfit / trades : 0
      const volume = data.trades.reduce((sum, t) => sum + t.amount, 0)

      return {
        hour: h,
        trades,
        wins,
        losses,
        winRate,
        totalProfit,
        avgProfit,
        volume
      }
    })

    setHourlyPerformance(hourlyPerf)

    // Daily performance analysis
    const dailyData: Record<number, { trades: any[], wins: number, totalProfit: number }> = {}
    
    // Initialize all days
    for (let i = 0; i < 7; i++) {
      dailyData[i] = { trades: [], wins: 0, totalProfit: 0 }
    }

    trades.forEach(trade => {
      const day = new Date(trade.entryTime).getDay()
      dailyData[day].trades.push(trade)
      if (trade.result === 'win') {
        dailyData[day].wins++
      }
      dailyData[day].totalProfit += trade.profit
    })

    const dailyPerf: DayPerformance[] = Object.entries(dailyData).map(([day, data]) => {
      const d = parseInt(day)
      const trades = data.trades.length
      const wins = data.wins
      const losses = trades - wins
      const winRate = trades > 0 ? (wins / trades) * 100 : 0
      const totalProfit = data.totalProfit
      const avgProfit = trades > 0 ? totalProfit / trades : 0
      const volume = data.trades.reduce((sum, t) => sum + t.amount, 0)

      return {
        day: d,
        dayName: dayNames[d],
        dayNamePT: dayNamesPT[d],
        trades,
        wins,
        losses,
        winRate,
        totalProfit,
        avgProfit,
        volume
      }
    })

    setDailyPerformance(dailyPerf)

    // Find optimal trading windows
    const windows: OptimalTradingWindow[] = []

    // Find best 3-hour window
    let bestWindow = { start: 0, end: 2, winRate: 0, trades: 0, avgProfit: 0 }
    for (let start = 0; start < 24; start++) {
      const end = (start + 2) % 24
      const windowHours = start <= end ? 
        hourlyPerf.slice(start, end + 1) : 
        [...hourlyPerf.slice(start), ...hourlyPerf.slice(0, end + 1)]
      
      const windowTrades = windowHours.reduce((sum, h) => sum + h.trades, 0)
      const windowWins = windowHours.reduce((sum, h) => sum + h.wins, 0)
      const windowWinRate = windowTrades > 0 ? (windowWins / windowTrades) * 100 : 0
      const windowAvgProfit = windowHours.reduce((sum, h) => sum + (h.avgProfit * h.trades), 0) / Math.max(1, windowTrades)

      if (windowTrades >= 5 && windowWinRate > bestWindow.winRate) {
        bestWindow = { start, end, winRate: windowWinRate, trades: windowTrades, avgProfit: windowAvgProfit }
      }
    }

    if (bestWindow.trades > 0) {
      windows.push({
        start: bestWindow.start,
        end: bestWindow.end,
        description: `${bestWindow.start}:00 - ${bestWindow.end}:00 optimal window`,
        descriptionPT: `${bestWindow.start}:00 - ${bestWindow.end}:00 janela ótima`,
        winRate: bestWindow.winRate,
        trades: bestWindow.trades,
        avgProfit: bestWindow.avgProfit
      })
    }

    // Find worst 3-hour window
    let worstWindow = { start: 0, end: 2, winRate: 100, trades: 0, avgProfit: 0 }
    for (let start = 0; start < 24; start++) {
      const end = (start + 2) % 24
      const windowHours = start <= end ? 
        hourlyPerf.slice(start, end + 1) : 
        [...hourlyPerf.slice(start), ...hourlyPerf.slice(0, end + 1)]
      
      const windowTrades = windowHours.reduce((sum, h) => sum + h.trades, 0)
      const windowWins = windowHours.reduce((sum, h) => sum + h.wins, 0)
      const windowWinRate = windowTrades > 0 ? (windowWins / windowTrades) * 100 : 0
      const windowAvgProfit = windowHours.reduce((sum, h) => sum + (h.avgProfit * h.trades), 0) / Math.max(1, windowTrades)

      if (windowTrades >= 5 && windowWinRate < worstWindow.winRate) {
        worstWindow = { start, end, winRate: windowWinRate, trades: windowTrades, avgProfit: windowAvgProfit }
      }
    }

    if (worstWindow.trades > 0 && worstWindow.winRate < 100) {
      windows.push({
        start: worstWindow.start,
        end: worstWindow.end,
        description: `${worstWindow.start}:00 - ${worstWindow.end}:00 avoid window`,
        descriptionPT: `${worstWindow.start}:00 - ${worstWindow.end}:00 janela a evitar`,
        winRate: worstWindow.winRate,
        trades: worstWindow.trades,
        avgProfit: worstWindow.avgProfit
      })
    }

    setOptimalWindows(windows)

  }, [trades, tradesLoading])

  const getPerformanceColor = (winRate: number, avgProfit: number) => {
    if (winRate >= 60 && avgProfit > 0) return 'bg-green-400/20 border-green-400/30'
    if (winRate >= 50 && avgProfit >= 0) return 'bg-yellow-400/20 border-yellow-400/30'
    return 'bg-red-400/20 border-red-400/30'
  }

  const getPerformanceTextColor = (winRate: number, avgProfit: number) => {
    if (winRate >= 60 && avgProfit > 0) return 'text-green-400'
    if (winRate >= 50 && avgProfit >= 0) return 'text-yellow-400'
    return 'text-red-400'
  }

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  const getIntensity = (trades: number, maxTrades: number) => {
    if (maxTrades === 0) return 0
    return Math.min(100, (trades / maxTrades) * 100)
  }

  if (statsLoading || tradesLoading) {
    return (
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </section>
    )
  }

  const currentData = selectedView === 'hours' ? hourlyPerformance : dailyPerformance
  const maxTrades = Math.max(...currentData.map(d => d.trades))

  return (
    <section className="py-8 bg-background">
      <div className="container mx-auto px-4">
        <div className="card">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⏰</div>
              <h2 className="font-heading text-2xl font-bold">
                {isPortuguese ? 'Análise Temporal' : 'Time Analytics'}
              </h2>
            </div>
            
            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSelectedView('hours')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'hours'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Horário' : 'Hours'}
              </button>
              <button
                onClick={() => setSelectedView('days')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'days'
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {isPortuguese ? 'Dias' : 'Days'}
              </button>
            </div>
          </div>

          {/* Performance Heatmap */}
          <div className="mb-8">
            <h3 className="font-comfortaa text-lg font-semibold mb-4">
              {selectedView === 'hours'
                ? (isPortuguese ? 'Performance por Horário' : 'Hourly Performance')
                : (isPortuguese ? 'Performance por Dia da Semana' : 'Daily Performance')
              }
            </h3>
            
            {selectedView === 'hours' ? (
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                {hourlyPerformance.map((hourData) => (
                  <div
                    key={hourData.hour}
                    className={`p-3 rounded-lg border text-center cursor-pointer transition-all hover:scale-105 ${
                      getPerformanceColor(hourData.winRate, hourData.avgProfit)
                    }`}
                    title={`${formatHour(hourData.hour)}: ${hourData.winRate.toFixed(1)}% win rate, ${hourData.trades} trades`}
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {formatHour(hourData.hour)}
                    </div>
                    <div className={`text-sm font-bold ${getPerformanceTextColor(hourData.winRate, hourData.avgProfit)}`}>
                      {hourData.winRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {hourData.trades}
                    </div>
                    
                    {/* Volume indicator */}
                    <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                      <div
                        className="bg-primary h-1 rounded-full transition-all"
                        style={{ width: `${getIntensity(hourData.trades, maxTrades)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dailyPerformance.map((dayData) => (
                  <div
                    key={dayData.day}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                      getPerformanceColor(dayData.winRate, dayData.avgProfit)
                    }`}
                  >
                    <div className="text-center">
                      <h4 className="font-comfortaa font-semibold text-white mb-2">
                        {isPortuguese ? dayData.dayNamePT : dayData.dayName}
                      </h4>
                      <div className={`text-2xl font-bold mb-2 ${getPerformanceTextColor(dayData.winRate, dayData.avgProfit)}`}>
                        {dayData.winRate.toFixed(1)}%
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <div>
                          <div className="font-medium text-white">{dayData.trades}</div>
                          <div>{isPortuguese ? 'Operações' : 'Trades'}</div>
                        </div>
                        <div>
                          <div className={`font-medium ${dayData.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${dayData.avgProfit.toFixed(2)}
                          </div>
                          <div>{isPortuguese ? 'Lucro Médio' : 'Avg Profit'}</div>
                        </div>
                      </div>
                      
                      {/* Volume indicator */}
                      <div className="w-full bg-gray-600 rounded-full h-2 mt-3">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${getIntensity(dayData.trades, maxTrades)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insights and Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Insights */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Insights de Performance' : 'Performance Insights'}
              </h3>
              
              {selectedView === 'hours' ? (
                <div className="space-y-3">
                  {/* Best performing hour */}
                  {(() => {
                    const bestHour = hourlyPerformance
                      .filter(h => h.trades >= 3)
                      .sort((a, b) => b.winRate - a.winRate)[0]
                    
                    if (bestHour) {
                      return (
                        <div className="p-4 rounded-lg bg-green-400/10 border border-green-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🏆</span>
                            <span className="font-comfortaa font-semibold text-green-400">
                              {isPortuguese ? 'Melhor Horário' : 'Best Hour'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{formatHour(bestHour.hour)}</div>
                            <div className="text-sm text-gray-300">
                              {bestHour.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'} • {bestHour.trades} {isPortuguese ? 'operações' : 'trades'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Worst performing hour */}
                  {(() => {
                    const worstHour = hourlyPerformance
                      .filter(h => h.trades >= 3)
                      .sort((a, b) => a.winRate - b.winRate)[0]
                    
                    if (worstHour) {
                      return (
                        <div className="p-4 rounded-lg bg-red-400/10 border border-red-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⚠️</span>
                            <span className="font-comfortaa font-semibold text-red-400">
                              {isPortuguese ? 'Pior Horário' : 'Worst Hour'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{formatHour(worstHour.hour)}</div>
                            <div className="text-sm text-gray-300">
                              {worstHour.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'} • {worstHour.trades} {isPortuguese ? 'operações' : 'trades'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Most active hour */}
                  {(() => {
                    const mostActiveHour = hourlyPerformance
                      .sort((a, b) => b.trades - a.trades)[0]
                    
                    if (mostActiveHour && mostActiveHour.trades > 0) {
                      return (
                        <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📊</span>
                            <span className="font-comfortaa font-semibold text-blue-400">
                              {isPortuguese ? 'Horário Mais Ativo' : 'Most Active Hour'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{formatHour(mostActiveHour.hour)}</div>
                            <div className="text-sm text-gray-300">
                              {mostActiveHour.trades} {isPortuguese ? 'operações' : 'trades'} • {mostActiveHour.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Best performing day */}
                  {(() => {
                    const bestDay = dailyPerformance
                      .filter(d => d.trades >= 3)
                      .sort((a, b) => b.winRate - a.winRate)[0]
                    
                    if (bestDay) {
                      return (
                        <div className="p-4 rounded-lg bg-green-400/10 border border-green-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🏆</span>
                            <span className="font-comfortaa font-semibold text-green-400">
                              {isPortuguese ? 'Melhor Dia' : 'Best Day'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{isPortuguese ? bestDay.dayNamePT : bestDay.dayName}</div>
                            <div className="text-sm text-gray-300">
                              {bestDay.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'} • {bestDay.trades} {isPortuguese ? 'operações' : 'trades'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Worst performing day */}
                  {(() => {
                    const worstDay = dailyPerformance
                      .filter(d => d.trades >= 3)
                      .sort((a, b) => a.winRate - b.winRate)[0]
                    
                    if (worstDay) {
                      return (
                        <div className="p-4 rounded-lg bg-red-400/10 border border-red-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⚠️</span>
                            <span className="font-comfortaa font-semibold text-red-400">
                              {isPortuguese ? 'Pior Dia' : 'Worst Day'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{isPortuguese ? worstDay.dayNamePT : worstDay.dayName}</div>
                            <div className="text-sm text-gray-300">
                              {worstDay.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'} • {worstDay.trades} {isPortuguese ? 'operações' : 'trades'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Most active day */}
                  {(() => {
                    const mostActiveDay = dailyPerformance
                      .sort((a, b) => b.trades - a.trades)[0]
                    
                    if (mostActiveDay && mostActiveDay.trades > 0) {
                      return (
                        <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📊</span>
                            <span className="font-comfortaa font-semibold text-blue-400">
                              {isPortuguese ? 'Dia Mais Ativo' : 'Most Active Day'}
                            </span>
                          </div>
                          <div className="text-white">
                            <div className="text-xl font-bold">{isPortuguese ? mostActiveDay.dayNamePT : mostActiveDay.dayName}</div>
                            <div className="text-sm text-gray-300">
                              {mostActiveDay.trades} {isPortuguese ? 'operações' : 'trades'} • {mostActiveDay.winRate.toFixed(1)}% {isPortuguese ? 'taxa de acerto' : 'win rate'}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>

            {/* Optimal Trading Windows */}
            <div className="space-y-4">
              <h3 className="font-comfortaa text-lg font-semibold mb-4">
                {isPortuguese ? 'Janelas de Trading Ótimas' : 'Optimal Trading Windows'}
              </h3>
              
              {optimalWindows.length > 0 ? (
                <div className="space-y-3">
                  {optimalWindows.map((window, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${
                        window.description.includes('avoid') 
                          ? 'bg-red-400/10 border-red-400/20'
                          : 'bg-green-400/10 border-green-400/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {window.description.includes('avoid') ? '🚫' : '✨'}
                          </span>
                          <span className={`font-comfortaa font-semibold ${
                            window.description.includes('avoid') ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {formatHour(window.start)} - {formatHour(window.end)}
                          </span>
                        </div>
                        <span className={`text-sm px-2 py-1 rounded ${
                          window.description.includes('avoid')
                            ? 'bg-red-400/20 text-red-400'
                            : 'bg-green-400/20 text-green-400'
                        }`}>
                          {window.winRate.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        {window.trades} {isPortuguese ? 'operações' : 'trades'} • 
                        ${window.avgProfit.toFixed(2)} {isPortuguese ? 'lucro médio' : 'avg profit'}
                      </div>
                      
                      <div className="text-sm text-gray-300 mt-2">
                        {isPortuguese ? window.descriptionPT : window.description}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-gray-400 bg-gray-400/10 text-center">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-300">
                    {isPortuguese 
                      ? 'Mais dados necessários para identificar janelas ótimas'
                      : 'More data needed to identify optimal windows'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
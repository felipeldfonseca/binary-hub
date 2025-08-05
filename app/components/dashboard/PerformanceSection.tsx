'use client'

import { useState } from 'react'
import PerformanceChart from '@/components/charts/PerformanceChart'
import { useTradeStats } from '@/hooks/useTradeStats'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

export default function PerformanceSection() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('weekly')
  const { stats, dashboardStats, loading, error } = useTradeStats(selectedPeriod)

  const periods = [
    { value: 'daily' as Period, label: 'Day' },
    { value: 'weekly' as Period, label: 'Week' },
    { value: 'monthly' as Period, label: 'Month' },
    { value: 'yearly' as Period, label: 'Year' },
  ]

  const periodText = selectedPeriod === 'daily' ? 'on the day' : 
                   selectedPeriod === 'weekly' ? 'on the week' : 
                   selectedPeriod === 'monthly' ? 'on the month' : 'on the year'

  // Loading state
  if (loading) {
    return (
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">Performance</h2>
            
            {/* Period Filter */}
            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-primary text-text'
                      : 'text-gray-600 hover:text-text'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card text-center animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>

          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">Performance</h2>
          </div>
          
          <div className="card text-center">
            <p className="text-red-500">Error loading performance data: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-text rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Default values if no data
  const currentStats = stats || {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    tieTrades: 0,
    winRate: 0,
    totalPnl: 0,
    avgPnl: 0,
    maxDrawdown: 0,
    avgStake: 0,
    maxStake: 0,
  }

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">Performance</h2>
          
          {/* Period Filter */}
          <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Net P&L</h3>
            <p className={`text-2xl font-bold ${currentStats.totalPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              ${currentStats.totalPnl.toLocaleString()}
            </p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Win Rate</h3>
            <p className="text-2xl font-bold text-text">{currentStats.winRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">{periodText}</p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Trades</h3>
            <p className="text-2xl font-bold text-text">{currentStats.totalTrades}</p>
            <p className="text-xs text-gray-500 mt-1">{periodText}</p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Average P&L</h3>
            <p className={`text-2xl font-bold ${currentStats.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              ${currentStats.avgPnl.toFixed(2)}
            </p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Max Drawdown</h3>
            <p className="text-2xl font-bold text-loss">${currentStats.maxDrawdown.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">worst loss</p>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Cumulative Net P&L</h3>
          <PerformanceChart period={selectedPeriod} />
        </div>
      </div>
    </section>
  )
} 
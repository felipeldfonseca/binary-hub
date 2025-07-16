'use client'

import { useState } from 'react'
import PerformanceChart from '@/components/charts/PerformanceChart'
import { mockKPIData } from '@/lib/mockData'

type Period = 'day' | 'week' | 'month' | '3months' | '6months' | 'year'

export default function PerformanceSection() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('day')

  const periods = [
    { value: 'day' as Period, label: 'Day' },
    { value: 'week' as Period, label: 'Week' },
    { value: 'month' as Period, label: 'Month' },
    { value: '3months' as Period, label: '3 Months' },
    { value: '6months' as Period, label: '6 Months' },
    { value: 'year' as Period, label: 'Year' },
  ]

  const currentData = mockKPIData[selectedPeriod]
  const periodText = selectedPeriod === 'day' ? 'on the day' : 
                   selectedPeriod === 'week' ? 'on the week' : 
                   selectedPeriod === 'month' ? 'on the month' : 
                   selectedPeriod === '3months' ? 'on 3 months' : 
                   selectedPeriod === '6months' ? 'on 6 months' : 'on the year'

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
            <p className={`text-2xl font-bold ${currentData.netPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              ${currentData.netPnl.toLocaleString()}
            </p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Win Rate</h3>
            <p className="text-2xl font-bold text-text">{currentData.winRate}%</p>
            <p className="text-xs text-gray-500 mt-1">{periodText}</p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Result</h3>
            <p className={`text-2xl font-bold ${currentData.result >= 0 ? 'text-win' : 'text-loss'}`}>
              {currentData.result >= 0 ? '+' : ''}{currentData.result}%
            </p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Average Daily P&L</h3>
            <p className="text-2xl font-bold text-text">${currentData.avgDailyPnl}</p>
          </div>

          <div className="card text-center">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Daily Streak</h3>
            <p className="text-2xl font-bold text-win">{currentData.dailyStreak}</p>
            <p className="text-xs text-gray-500 mt-1">winning days</p>
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
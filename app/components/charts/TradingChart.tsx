'use client'

import React, { useState } from 'react'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  AreaChart,
  Legend
} from 'recharts'
import { useLanguage } from '@/lib/contexts/LanguageContext'

type ChartType = 'line' | 'area' | 'bar'
type Period = 'day' | 'week' | 'month' | '3months' | '6months' | 'year'

interface TradingChartProps {
  data: Array<{
    date: string
    amount: number
    trades: number
    wins?: number
    losses?: number
  }>
  period: Period
  height?: number
  showControls?: boolean
}

export default function TradingChart({ 
  data = [], 
  period, 
  height = 320, 
  showControls = true 
}: TradingChartProps) {
  const { isPortuguese } = useLanguage()
  const [chartType, setChartType] = useState<ChartType>('line')
  const [showTrades, setShowTrades] = useState(false)

  // Translations
  const texts = {
    cumulativePnL: isPortuguese ? 'P&L Cumulativo' : 'Cumulative P&L',
    dailyTrades: isPortuguese ? 'Trades Diários' : 'Daily Trades',
    line: isPortuguese ? 'Linha' : 'Line',
    area: isPortuguese ? 'Área' : 'Area',
    bar: isPortuguese ? 'Barra' : 'Bar',
    trades: isPortuguese ? 'Trades' : 'Trades',
    pnl: isPortuguese ? 'P&L' : 'P&L',
    date: isPortuguese ? 'Data' : 'Date',
    noData: isPortuguese ? 'Nenhum dado disponível' : 'No data available'
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-gray-800 bg-opacity-95 border border-gray-600 rounded-lg p-4 shadow-xl backdrop-blur-sm">
        <p className="text-gray-300 text-sm mb-2 font-comfortaa">
          {texts.date}: {new Date(label).toLocaleDateString()}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white font-semibold">
              {entry.dataKey === 'amount' ? `${texts.pnl}: $${entry.value?.toLocaleString()}` : 
               entry.dataKey === 'trades' ? `${texts.trades}: ${entry.value}` :
               `${entry.name}: ${entry.value}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Chart type controls
  const ChartTypeControls = () => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-300 font-comfortaa mr-2">
        {isPortuguese ? 'Tipo:' : 'Type:'}
      </span>
      {(['line', 'area', 'bar'] as ChartType[]).map((type) => (
        <button
          key={type}
          onClick={() => setChartType(type)}
          className={`px-3 py-1 rounded-md text-sm font-comfortaa transition-colors ${
            chartType === type
              ? 'bg-[#E1FFD9] text-[#505050] font-semibold'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {texts[type]}
        </button>
      ))}
    </div>
  )

  // Toggle switch for showing trades
  const TradesToggle = () => (
    <div className="flex items-center gap-2 ml-auto">
      <span className="text-sm text-gray-300 font-comfortaa">
        {texts.trades}
      </span>
      <button
        onClick={() => setShowTrades(!showTrades)}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          showTrades ? 'bg-[#E1FFD9]' : 'bg-gray-600'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
            showTrades ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center bg-gray-800 bg-opacity-30 rounded-lg" style={{ height }}>
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <p className="text-gray-400 font-comfortaa">{texts.noData}</p>
        </div>
      </div>
    )
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E1FFD9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#E1FFD9" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
            <Area 
              type="monotone" 
              dataKey="amount" 
              stroke="#E1FFD9" 
              strokeWidth={2}
              fill="url(#colorPnL)"
            />
            {showTrades && (
              <Bar dataKey="trades" fill="#E1FFD9" opacity={0.6} yAxisId="right" />
            )}
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
            <Bar 
              dataKey="amount" 
              fill="#E1FFD9"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        )

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis 
              stroke="#999"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
            <Line 
              type="monotone" 
              dataKey="amount" 
              stroke="#E1FFD9" 
              strokeWidth={3}
              dot={{ fill: '#E1FFD9', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#E1FFD9', strokeWidth: 2, fill: '#E1FFD9' }}
            />
            {showTrades && (
              <Line
                type="monotone"
                dataKey="trades"
                stroke="#888"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#888', strokeWidth: 2, r: 3 }}
                yAxisId="right"
              />
            )}
          </LineChart>
        )
    }
  }

  return (
    <div className="w-full">
      {showControls && (
        <div className="flex items-center justify-between mb-4">
          <ChartTypeControls />
          <TradesToggle />
        </div>
      )}
      
      <div className="w-full bg-gray-900 bg-opacity-20 rounded-lg p-4 border border-gray-700">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
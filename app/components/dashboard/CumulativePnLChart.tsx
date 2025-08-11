'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface CumulativePnLData {
  date: string
  cumulativePnL: number
  dailyPnL: number
  formattedDate: string
}

interface CumulativePnLChartProps {
  period?: string
  isLoading?: boolean
}

// Mock data generator for different time periods
const generateMockData = (period: string, isPortuguese: boolean): CumulativePnLData[] => {
  const data: CumulativePnLData[] = []
  let cumulative = 0
  
  // Determine data points based on period
  const getDataPoints = (period: string) => {
    switch (period) {
      case 'daily': return 7  // Last 7 days
      case 'weekly': return 12 // Last 12 weeks  
      case 'monthly': return 12 // Last 12 months
      case 'yearly': return 3   // Last 3 years
      case 'ytd': return 8      // Year to date (8 months)
      case 'allTime': return 24 // 2 years of data
      default: return 12
    }
  }
  
  const points = getDataPoints(period)
  
  // Format date labels based on period
  const formatDateLabel = (date: Date, period: string) => {
    switch (period) {
      case 'daily':
        return date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      case 'weekly':
        return date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      case 'monthly':
      case 'ytd':
        return date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
          year: '2-digit',
          month: 'short' 
        })
      case 'yearly':
      case 'allTime':
        return date.getFullYear().toString()
      default:
        return date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
    }
  }
  
  for (let i = 0; i < points; i++) {
    const date = new Date()
    
    // Calculate date based on period
    switch (period) {
      case 'daily':
        date.setDate(date.getDate() - (points - 1 - i))
        break
      case 'weekly':
        date.setDate(date.getDate() - (points - 1 - i) * 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() - (points - 1 - i))
        break
      case 'yearly':
        date.setFullYear(date.getFullYear() - (points - 1 - i))
        break
      case 'ytd':
        date.setMonth(i)
        date.setDate(1)
        break
      case 'allTime':
        date.setMonth(date.getMonth() - (points - 1 - i))
        break
    }
    
    // Generate realistic P&L data with some volatility
    const baseReturn = (Math.random() - 0.3) * 1000 // Slight positive bias
    const volatility = Math.random() * 500 - 250
    const dailyPnL = Math.round(baseReturn + volatility)
    cumulative += dailyPnL
    
    data.push({
      date: date.toISOString().split('T')[0],
      formattedDate: formatDateLabel(date, period),
      dailyPnL,
      cumulativePnL: cumulative
    })
  }
  
  return data
}

export default function CumulativePnLChart({ period = 'weekly', isLoading = false }: CumulativePnLChartProps) {
  const { isPortuguese } = useLanguage()
  
  // Generate mock data based on selected period
  const chartData = useMemo(() => generateMockData(period, isPortuguese), [period, isPortuguese])
  
  // Translations
  const texts = {
    title: isPortuguese ? 'P&L Cumulativo' : 'Cumulative Net P&L',
    description: isPortuguese ? 'Evolução do lucro/prejuízo acumulado ao longo do tempo' : 'Evolution of cumulative profit/loss over time',
    loading: isPortuguese ? 'Carregando dados...' : 'Loading data...',
    pnl: isPortuguese ? 'P&L' : 'P&L',
    date: isPortuguese ? 'Data' : 'Date',
    profit: isPortuguese ? 'Lucro' : 'Profit',
    loss: isPortuguese ? 'Prejuízo' : 'Loss'
  }
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 bg-opacity-90 border border-[#E1FFD9] rounded-lg p-3">
          <p className="text-[#E1FFD9] font-comfortaa font-semibold mb-1">{label}</p>
          <p className="text-white font-comfortaa">
            {texts.pnl}: <span className="font-semibold">${data.cumulativePnL.toLocaleString()}</span>
          </p>
          <p className="text-gray-300 font-comfortaa text-sm">
            Daily: <span className={`font-semibold ${data.dailyPnL >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
              ${data.dailyPnL >= 0 ? '+' : ''}{data.dailyPnL.toLocaleString()}
            </span>
          </p>
        </div>
      )
    }
    return null
  }
  
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 bg-opacity-20 rounded mb-2 w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 bg-opacity-10 rounded mb-6 w-2/3 animate-pulse"></div>
        <div className="h-64 bg-gray-200 bg-opacity-10 rounded animate-pulse"></div>
      </div>
    )
  }
  
  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-xl font-comfortaa font-semibold text-white mb-2">
          {texts.title}
        </h3>
        <p className="text-sm text-gray-400 font-comfortaa">
          {texts.description}
        </p>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E1FFD9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#E1FFD9" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.2)" />
            <XAxis 
              dataKey="formattedDate" 
              stroke="#9CA3AF"
              fontSize={12}
              fontFamily="Comfortaa, sans-serif"
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              fontFamily="Comfortaa, sans-serif"
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulativePnL"
              stroke="#E1FFD9"
              strokeWidth={3}
              fill="url(#colorPnL)"
              dot={{ fill: '#E1FFD9', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#E1FFD9', strokeWidth: 2, fill: '#E1FFD9' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Chart Summary */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <div className="text-sm">
          <div className="text-gray-400 font-comfortaa">{texts.title}</div>
          <div className={`text-lg font-semibold ${
            chartData[chartData.length - 1]?.cumulativePnL >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'
          }`}>
            ${chartData[chartData.length - 1]?.cumulativePnL.toLocaleString() || '0'}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#E1FFD9] rounded-full"></div>
            <span className="text-gray-400 font-comfortaa">{texts.pnl}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
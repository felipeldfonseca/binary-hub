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

// Stable mock data generator with consistent behavior
const generateMockData = (period: string, isPortuguese: boolean): CumulativePnLData[] => {
  const data: CumulativePnLData[] = []
  let cumulative = 1000 // Start with base value
  
  // ALWAYS use exactly 12 data points for consistency
  const points = 12
  
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
  
  // Create base date
  const baseDate = new Date()
  
  for (let i = 0; i < points; i++) {
    const date = new Date(baseDate)
    
    // Simplified date calculation - more predictable
    const offset = points - 1 - i
    switch (period) {
      case 'daily':
        date.setDate(date.getDate() - offset)
        break
      case 'weekly':
        date.setDate(date.getDate() - offset * 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() - offset)
        break
      case 'yearly':
        date.setFullYear(date.getFullYear() - offset)
        break
      case 'ytd':
        date.setMonth(date.getMonth() - offset)
        break
      case 'allTime':
        date.setMonth(date.getMonth() - offset * 2)
        break
    }
    
    // Generate realistic P&L data with seeded randomness for consistency
    // Use date-based seed to ensure same data for same dates across re-renders
    const seed = date.getTime() + i * 1000 // Simple seed based on date
    const seedRandom1 = Math.sin(seed * 0.0001) * 10000
    const seedRandom2 = Math.sin(seed * 0.0002) * 10000
    const random1 = seedRandom1 - Math.floor(seedRandom1) // Extract decimal part
    const random2 = seedRandom2 - Math.floor(seedRandom2)
    
    const baseReturn = (random1 - 0.3) * 1000 // Slight positive bias
    const volatility = random2 * 500 - 250
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
  
  // Generate mock data based on selected period with stable memoization
  const chartData = useMemo(() => {
    return generateMockData(period, isPortuguese)
  }, [period, isPortuguese])
  
  // Translations
  const texts = {
    title: isPortuguese ? 'P&L Cumulativo' : 'Cumulative Net P&L',
    description: isPortuguese ? 'Evolução do lucro/prejuízo acumulado ao longo do tempo' : 'Evolution of cumulative profit/loss over time',
    loading: isPortuguese ? 'Carregando dados...' : 'Loading data...',
    pnl: isPortuguese ? 'P&L' : 'P&L',
    date: isPortuguese ? 'Data' : 'Date',
    profit: isPortuguese ? 'Lucro' : 'Profit',
    loss: isPortuguese ? 'Prejuízo' : 'Loss',
    daily: isPortuguese ? 'Diário' : 'Daily',
    weekly: isPortuguese ? 'Semanal' : 'Weekly',
    monthly: isPortuguese ? 'Mensal' : 'Monthly',
    yearly: isPortuguese ? 'Anual' : 'Yearly',
    allTime: isPortuguese ? 'Todo Período' : 'All Time',
    ytd: isPortuguese ? 'Ano Atual' : 'YTD'
  }
  
  // Get period-specific label for tooltip
  const getPeriodLabel = (period: string): string => {
    switch (period) {
      case 'daily': return texts.daily
      case 'weekly': return texts.weekly
      case 'monthly': return texts.monthly
      case 'yearly': return texts.yearly
      case 'allTime': return texts.allTime
      case 'ytd': return texts.ytd
      default: return texts.daily
    }
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
            {getPeriodLabel(period)}: <span className={`font-semibold ${data.dailyPnL >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-comfortaa font-semibold text-white mb-2">
            {texts.title}
          </h3>
          <p className="text-sm text-gray-400 font-comfortaa">
            {texts.description}
          </p>
        </div>
        
        {/* Prominent Cumulative P&L Value */}
        <div className="text-right">
          <p className="text-sm text-gray-400 font-comfortaa mb-1 transition-all duration-800 ease-in-out">{texts.title}</p>
          <div className={`text-3xl font-bold font-comfortaa transition-all duration-800 ease-in-out transform ${
            chartData[chartData.length - 1]?.cumulativePnL >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'
          }`}>
            ${chartData[chartData.length - 1]?.cumulativePnL.toLocaleString() || '0'}
          </div>
          <div className="flex items-center gap-2 mt-1 transition-all duration-800 ease-in-out">
            <div className="w-2 h-2 bg-[#E1FFD9] rounded-full"></div>
            <span className="text-xs text-gray-400 font-comfortaa">{getPeriodLabel(period)}</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            key={period}
            data={chartData} 
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
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
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
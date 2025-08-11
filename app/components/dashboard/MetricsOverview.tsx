'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  isLoading?: boolean
}

function MetricCard({ title, value, subtitle, trend, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 bg-opacity-20 rounded mb-2"></div>
        <div className="h-8 bg-gray-200 bg-opacity-20 rounded mb-2"></div>
        {subtitle && <div className="h-3 bg-gray-200 bg-opacity-20 rounded w-2/3"></div>}
      </div>
    )
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-[#E1FFD9]'
      case 'down': return 'text-red-400'
      default: return 'text-white'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗'
      case 'down': return '↘'
      default: return null
    }
  }

  return (
    <div className="card group hover:scale-105 transition-all duration-300 cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-sm font-comfortaa font-medium text-gray-300 uppercase tracking-wide">
          {title}
        </h3>
        {getTrendIcon() && (
          <span className={`text-lg ${getTrendColor()} transition-all duration-800 ease-in-out`}>
            {getTrendIcon()}
          </span>
        )}
      </div>
      
      <div className={`text-3xl font-bold mb-1 ${getTrendColor()} transition-all duration-800 ease-in-out transform`}>
        {value}
      </div>
      
      {subtitle && (
        <p className="text-xs text-gray-400 font-comfortaa transition-all duration-800 ease-in-out">
          {subtitle}
        </p>
      )}
    </div>
  )
}

interface MetricsOverviewProps {
  selectedPeriod?: TimePeriod
  onPeriodChange?: (period: TimePeriod) => void
  isDemoMode?: boolean
}

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd'

export default function MetricsOverview({ 
  selectedPeriod: externalSelectedPeriod,
  onPeriodChange,
  isDemoMode = false
}: MetricsOverviewProps) {
  const { isPortuguese } = useLanguage()
  const [internalSelectedPeriod, setInternalSelectedPeriod] = useState<TimePeriod>('weekly')
  const [demoLoading, setDemoLoading] = useState(false)
  const [prevPeriod, setPrevPeriod] = useState(externalSelectedPeriod || internalSelectedPeriod)
  
  // Use external period if provided, otherwise use internal
  const selectedPeriod = externalSelectedPeriod || internalSelectedPeriod
  const setSelectedPeriod = onPeriodChange || setInternalSelectedPeriod
  
  // Handle demo mode loading animation when period changes
  useEffect(() => {
    if (isDemoMode && selectedPeriod !== prevPeriod) {
      setDemoLoading(true)
      // Sync with chart animation duration (800ms)
      const timer = setTimeout(() => {
        setDemoLoading(false)
        setPrevPeriod(selectedPeriod)
      }, 800)
      
      return () => clearTimeout(timer)
    } else if (!isDemoMode) {
      setPrevPeriod(selectedPeriod)
    }
  }, [isDemoMode, selectedPeriod, prevPeriod])
  
  // Map our UI periods to API periods - memoized to prevent recreation
  const periodMap: Record<TimePeriod, 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd'> = useMemo(() => ({
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    yearly: 'yearly',
    allTime: 'allTime', // Now properly mapped to distinct period
    ytd: 'ytd' // Now properly mapped to distinct period
  }), [])
  
  const { stats, loading: statsLoading, error: statsError } = useTradeStats(periodMap[selectedPeriod])
  
  // Memoize the filters to prevent infinite loop
  const tradesFilters = useMemo(() => ({ limit: 10 }), [])
  const { trades, loading: tradesLoading } = useTrades(tradesFilters)
  
  // Generate period-specific demo data
  const generateDemoStats = (period: string) => {
    const periodConfigs = {
      daily: {
        totalTrades: 1,
        winTrades: 1,
        lossTrades: 0,
        winRate: 100.0,
        totalPnl: 25,
        avgPnl: 25,
        maxDrawdown: -15
      },
      weekly: {
        totalTrades: 5,
        winTrades: 3,
        lossTrades: 2,
        winRate: 60.0,
        totalPnl: 34,
        avgPnl: 6.8,
        maxDrawdown: -80
      },
      monthly: {
        totalTrades: 22,
        winTrades: 14,
        lossTrades: 8,
        winRate: 63.6,
        totalPnl: 156,
        avgPnl: 7.1,
        maxDrawdown: -120
      },
      yearly: {
        totalTrades: 264,
        winTrades: 172,
        lossTrades: 92,
        winRate: 65.2,
        totalPnl: 2840,
        avgPnl: 10.8,
        maxDrawdown: -450
      },
      allTime: {
        totalTrades: 847,
        winTrades: 576,
        lossTrades: 271,
        winRate: 68.0,
        totalPnl: 8960,
        avgPnl: 10.6,
        maxDrawdown: -680
      },
      ytd: {
        totalTrades: 198,
        winTrades: 126,
        lossTrades: 72,
        winRate: 63.6,
        totalPnl: 2156,
        avgPnl: 10.9,
        maxDrawdown: -340
      }
    };
    
    const config = periodConfigs[periodMap[selectedPeriod]] || periodConfigs.weekly;
    
    return {
      totalTrades: config.totalTrades,
      winTrades: config.winTrades,
      lossTrades: config.lossTrades,
      tieTrades: 0,
      winRate: config.winRate,
      totalPnl: config.totalPnl,
      avgPnl: config.avgPnl,
      maxDrawdown: config.maxDrawdown,
      avgStake: 32.0,
      maxStake: 50.0
    };
  }

  // Override stats and trades for demo mode
  const displayStats = isDemoMode ? generateDemoStats(selectedPeriod) : stats
  
  // Generate period-specific demo trades for streak calculation
  const generateDemoTrades = (period: string) => {
    const tradePatterns = {
      daily: [{ result: 'win' }], // 1 win trade
      weekly: [
        { result: 'win' },
        { result: 'win' }, 
        { result: 'loss' },
        { result: 'win' },
        { result: 'loss' }
      ], // 3 wins, 2 losses - last trade was loss, so streak is 0
      monthly: [
        { result: 'win' },
        { result: 'win' },
        { result: 'win' }
      ], // Current 3-win streak
      yearly: [
        { result: 'loss' },
        { result: 'win' }
      ], // Current 1-win streak  
      allTime: [
        { result: 'win' },
        { result: 'win' },
        { result: 'win' },
        { result: 'win' },
        { result: 'win' }
      ], // Current 5-win streak
      ytd: [
        { result: 'loss' },
        { result: 'loss' }
      ] // Current 2-loss streak
    };
    
    return tradePatterns[periodMap[selectedPeriod]] || tradePatterns.weekly;
  }
  
  const displayTrades = isDemoMode ? generateDemoTrades(selectedPeriod) : trades

  // Calculate current streak from recent trades
  const calculateCurrentStreak = (trades: any[]) => {
    if (!trades || trades.length === 0) return { count: 0, type: 'neutral' as const }
    
    let currentStreak = 0
    let streakType = trades[0]?.result || 'neutral'
    
    for (const trade of trades) {
      if (trade.result === streakType) {
        currentStreak++
      } else {
        break
      }
    }
    
    return { count: currentStreak, type: streakType as 'win' | 'loss' | 'tie' }
  }

  const streak = calculateCurrentStreak(displayTrades)
  const isLoading = isDemoMode ? demoLoading : (statsLoading || tradesLoading)
  
  // Translations
  const texts = {
    winRate: isPortuguese ? 'Taxa de Vitória' : 'Win Rate',
    netPnL: isPortuguese ? 'P&L Líquido' : 'Net P&L',
    totalTrades: isPortuguese ? 'Total de Trades' : 'Total Trades',
    currentStreak: isPortuguese ? 'Sequência Atual' : 'Current Streak',
    thisPeriod: isPortuguese ? 'neste período' : 'this period',
    consecutive: isPortuguese ? 'consecutivos' : 'consecutive',
    wins: isPortuguese ? 'vitórias' : 'wins',
    losses: isPortuguese ? 'perdas' : 'losses',
    ties: isPortuguese ? 'empates' : 'ties',
    daily: isPortuguese ? 'Diário' : 'Daily',
    weekly: isPortuguese ? 'Semanal' : 'Weekly', 
    monthly: isPortuguese ? 'Mensal' : 'Monthly',
    yearly: isPortuguese ? 'Anual' : 'Yearly',
    allTime: isPortuguese ? 'Todo Período' : 'All Time',
    ytd: isPortuguese ? 'Ano Atual' : 'Year to Date'
  }
  
  const timePeriods: TimePeriod[] = useMemo(() => ['daily', 'weekly', 'monthly', 'yearly', 'ytd', 'allTime'], [])

  const getStreakText = (streak: { count: number, type: string }) => {
    if (streak.count === 0) return isPortuguese ? 'Nenhuma' : 'None'
    
    const typeText = streak.type === 'win' ? texts.wins : 
                    streak.type === 'loss' ? texts.losses : texts.ties
    
    return `${streak.count} ${texts.consecutive} ${typeText}`
  }

  // Error state
  if (statsError) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card text-center">
                <p className="text-red-400 text-sm">
                  {isPortuguese ? 'Erro ao carregar' : 'Error loading data'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Default values if no stats
  const currentStats = displayStats || {
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
    <section className="py-8">
      <div className="container mx-auto px-4">
        {/* Time Period Tabs - Always show when onPeriodChange is provided */}
        {onPeriodChange && (
          <div className="flex justify-center mb-8">
            <div className="flex bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
              {timePeriods.map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-comfortaa font-medium transition-all duration-200 ${
                    selectedPeriod === period
                      ? 'bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {texts[period]}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Win Rate */}
          <MetricCard
            title={texts.winRate}
            value={isLoading ? '...' : `${currentStats.winRate.toFixed(1)}%`}
            subtitle={texts.thisPeriod}
            trend={currentStats.winRate >= 60 ? 'up' : currentStats.winRate <= 40 ? 'down' : 'neutral'}
            isLoading={isLoading}
          />

          {/* Net P&L */}
          <MetricCard
            title={texts.netPnL}
            value={isLoading ? '...' : `$${currentStats.totalPnl.toLocaleString()}`}
            subtitle={`${currentStats.winTrades}W - ${currentStats.lossTrades}L`}
            trend={currentStats.totalPnl > 0 ? 'up' : currentStats.totalPnl < 0 ? 'down' : 'neutral'}
            isLoading={isLoading}
          />

          {/* Total Trades */}
          <MetricCard
            title={texts.totalTrades}
            value={isLoading ? '...' : currentStats.totalTrades}
            subtitle={texts.thisPeriod}
            trend={currentStats.totalTrades > 50 ? 'up' : currentStats.totalTrades < 20 ? 'down' : 'neutral'}
            isLoading={isLoading}
          />

          {/* Current Streak */}
          <MetricCard
            title={texts.currentStreak}
            value={isLoading ? '...' : streak.count}
            subtitle={getStreakText(streak)}
            trend={streak.type === 'win' && streak.count >= 3 ? 'up' : 
                  streak.type === 'loss' && streak.count >= 3 ? 'down' : 'neutral'}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  )
}
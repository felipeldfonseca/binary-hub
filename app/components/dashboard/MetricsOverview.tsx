'use client'

import React from 'react'
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
          <span className={`text-lg ${getTrendColor()}`}>
            {getTrendIcon()}
          </span>
        )}
      </div>
      
      <div className={`text-3xl font-bold mb-1 ${getTrendColor()}`}>
        {value}
      </div>
      
      {subtitle && (
        <p className="text-xs text-gray-400 font-comfortaa">
          {subtitle}
        </p>
      )}
    </div>
  )
}

interface MetricsOverviewProps {
  period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year'
}

export default function MetricsOverview({ period = 'week' }: MetricsOverviewProps) {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading, error: statsError } = useTradeStats(period)
  const { trades, loading: tradesLoading } = useTrades({ limit: 10 })

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

  const streak = calculateCurrentStreak(trades)
  const isLoading = statsLoading || tradesLoading
  
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
    ties: isPortuguese ? 'empates' : 'ties'
  }

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
    <section className="py-8">
      <div className="container mx-auto px-4">
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
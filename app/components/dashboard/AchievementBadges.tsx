'use client'

import React from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface Achievement {
  id: string
  name: string
  nameP: string // Portuguese name
  description: string
  descriptionPT: string // Portuguese description  
  icon: string
  unlocked: boolean
  progress?: number // 0-100 for progress towards achievement
  maxValue?: number // for achievements with thresholds
  currentValue?: number
}

interface AchievementBadgesProps {
  period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year'
}

export default function AchievementBadges({ period = 'week' }: AchievementBadgesProps) {
  const { stats, loading } = useTradeStats(period)
  const { trades } = useTrades()
  const { isPortuguese } = useLanguage()

  // Calculate streak information
  const calculateStreaks = () => {
    if (!trades || trades.length === 0) return { winStreak: 0, maxWinStreak: 0 }
    
    let currentStreak = 0
    let maxStreak = 0
    let tempStreak = 0
    
    // Sort trades by date (most recent first)
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
    )
    
    // Calculate current streak
    for (const trade of sortedTrades) {
      if (trade.result === 'win') {
        currentStreak++
      } else {
        break
      }
    }
    
    // Calculate max streak
    for (const trade of sortedTrades) {
      if (trade.result === 'win') {
        tempStreak++
        maxStreak = Math.max(maxStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }
    
    return { winStreak: currentStreak, maxWinStreak: maxStreak }
  }

  const { winStreak, maxWinStreak } = calculateStreaks()
  
  // Calculate profitable days/weeks
  const calculateProfitablePeriods = () => {
    if (!trades || trades.length === 0) return 0
    
    const periods = new Map<string, number>()
    
    trades.forEach(trade => {
      const date = new Date(trade.exitTime)
      const periodKey = period === 'day' 
        ? date.toDateString()
        : `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`
      
      periods.set(periodKey, (periods.get(periodKey) || 0) + trade.profit)
    })
    
    return Array.from(periods.values()).filter(profit => profit > 0).length
  }

  const profitablePeriods = calculateProfitablePeriods()

  const achievements: Achievement[] = [
    {
      id: 'first_win',
      name: 'First Victory',
      nameP: 'Primeira Vitória',
      description: 'Win your first trade',
      descriptionPT: 'Ganhe seu primeiro trade',
      icon: '🏆',
      unlocked: (stats?.winTrades || 0) > 0,
    },
    {
      id: 'ten_trades',
      name: '10 Trades Club',
      nameP: 'Clube dos 10 Trades',
      description: 'Complete 10 trades',
      descriptionPT: 'Complete 10 trades',
      icon: '📊',
      unlocked: (stats?.totalTrades || 0) >= 10,
      progress: Math.min(((stats?.totalTrades || 0) / 10) * 100, 100),
      currentValue: stats?.totalTrades || 0,
      maxValue: 10,
    },
    {
      id: 'win_streak_5',
      name: '5-Win Streak',
      nameP: 'Sequência de 5',
      description: 'Win 5 trades in a row',
      descriptionPT: 'Ganhe 5 trades seguidos',
      icon: '🔥',
      unlocked: maxWinStreak >= 5,
      progress: Math.min((maxWinStreak / 5) * 100, 100),
      currentValue: maxWinStreak,
      maxValue: 5,
    },
    {
      id: 'win_streak_10',
      name: '10-Win Streak',
      nameP: 'Sequência de 10',
      description: 'Win 10 trades in a row',
      descriptionPT: 'Ganhe 10 trades seguidos',
      icon: '🚀',
      unlocked: maxWinStreak >= 10,
      progress: Math.min((maxWinStreak / 10) * 100, 100),
      currentValue: maxWinStreak,
      maxValue: 10,
    },
    {
      id: 'profitable_week',
      name: 'Profitable Week',
      nameP: 'Semana Lucrativa',
      description: 'Have a profitable week',
      descriptionPT: 'Tenha uma semana lucrativa',
      icon: '💰',
      unlocked: profitablePeriods > 0,
    },
    {
      id: 'high_win_rate',
      name: 'Precision Trader',
      nameP: 'Trader Preciso',
      description: 'Achieve 70%+ win rate',
      descriptionPT: 'Alcance 70%+ de taxa de vitória',
      icon: '🎯',
      unlocked: (stats?.winRate || 0) >= 70,
      progress: Math.min(((stats?.winRate || 0) / 70) * 100, 100),
      currentValue: stats?.winRate || 0,
      maxValue: 70,
    },
    {
      id: 'big_profit',
      name: 'Big Winner',
      nameP: 'Grande Vencedor',
      description: 'Earn $1000+ profit',
      descriptionPT: 'Ganhe $1000+ de lucro',
      icon: '💎',
      unlocked: (stats?.totalPnl || 0) >= 1000,
      progress: Math.min(((stats?.totalPnl || 0) / 1000) * 100, 100),
      currentValue: stats?.totalPnl || 0,
      maxValue: 1000,
    },
    {
      id: 'hundred_trades',
      name: 'Century',
      nameP: 'Centenário',
      description: 'Complete 100 trades',
      descriptionPT: 'Complete 100 trades',
      icon: '💯',
      unlocked: (stats?.totalTrades || 0) >= 100,
      progress: Math.min(((stats?.totalTrades || 0) / 100) * 100, 100),
      currentValue: stats?.totalTrades || 0,
      maxValue: 100,
    },
  ]

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
            {isPortuguese ? 'Conquistas' : 'Achievements'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card text-center animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const unlockedAchievements = achievements.filter(a => a.unlocked)
  const lockedAchievements = achievements.filter(a => !a.unlocked)

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-comfortaa font-bold text-2xl text-primary">
            {isPortuguese ? 'Conquistas' : 'Achievements'}
          </h2>
          <div className="text-sm text-gray-300">
            <span className="font-medium text-primary">{unlockedAchievements.length}</span>
            <span className="text-gray-400">/{achievements.length}</span>
          </div>
        </div>

        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <div className="mb-8">
            <h3 className="font-comfortaa font-semibold text-lg mb-4 text-white">
              {isPortuguese ? 'Desbloqueadas' : 'Unlocked'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {unlockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="card text-center hover:scale-105 transition-transform duration-200 bg-gradient-to-br from-green-500/20 to-primary/20 border-primary/30"
                >
                  <div className="text-4xl mb-2">{achievement.icon}</div>
                  <h4 className="font-comfortaa font-semibold text-sm mb-1 text-primary">
                    {isPortuguese ? achievement.nameP : achievement.name}
                  </h4>
                  <p className="text-xs text-gray-300 leading-tight">
                    {isPortuguese ? achievement.descriptionPT : achievement.description}
                  </p>
                  {achievement.currentValue !== undefined && achievement.maxValue && (
                    <div className="mt-2 text-xs text-primary font-semibold">
                      {achievement.currentValue}/{achievement.maxValue}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <div>
            <h3 className="font-comfortaa font-semibold text-lg mb-4 text-gray-300">
              {isPortuguese ? 'Em Progresso' : 'In Progress'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {lockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="card text-center opacity-60 hover:opacity-80 transition-opacity duration-200"
                >
                  <div className="text-4xl mb-2 grayscale">{achievement.icon}</div>
                  <h4 className="font-comfortaa font-semibold text-sm mb-1 text-gray-300">
                    {isPortuguese ? achievement.nameP : achievement.name}
                  </h4>
                  <p className="text-xs text-gray-400 leading-tight mb-2">
                    {isPortuguese ? achievement.descriptionPT : achievement.description}
                  </p>
                  
                  {/* Progress bar for achievements with progress */}
                  {achievement.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-600 rounded-full h-2 mb-1">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${achievement.progress}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {achievement.currentValue}/{achievement.maxValue}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievement Summary */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 card">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{unlockedAchievements.length}</div>
              <div className="text-xs text-gray-400">{isPortuguese ? 'Desbloqueadas' : 'Unlocked'}</div>
            </div>
            <div className="w-px h-8 bg-gray-400"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300">{lockedAchievements.length}</div>
              <div className="text-xs text-gray-400">{isPortuguese ? 'Restantes' : 'Remaining'}</div>
            </div>
            <div className="w-px h-8 bg-gray-400"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.round((unlockedAchievements.length / achievements.length) * 100)}%</div>
              <div className="text-xs text-gray-400">{isPortuguese ? 'Completo' : 'Complete'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
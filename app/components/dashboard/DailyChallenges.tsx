'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface Challenge {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  icon: string
  type: 'daily' | 'weekly' | 'monthly'
  target: number
  current: number
  unit: string
  difficulty: 'easy' | 'medium' | 'hard'
  reward: string
  rewardPT: string
  completed: boolean
  points: number
}

export default function DailyChallenges() {
  const { stats, loading } = useTradeStats()
  const { trades } = useTrades()
  const { isPortuguese } = useLanguage()
  const [selectedType, setSelectedType] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  // Calculate current day/week/month trades
  const getCurrentPeriodStats = (period: 'day' | 'week' | 'month') => {
    if (!trades || trades.length === 0) return { trades: 0, wins: 0, profit: 0 }
    
    const now = new Date()
    const startDate = new Date()
    
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(now.getDate() - now.getDay())
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        break
    }
    
    const periodTrades = trades.filter(trade => 
      new Date(trade.exitTime) >= startDate
    )
    
    return {
      trades: periodTrades.length,
      wins: periodTrades.filter(t => t.result === 'win').length,
      profit: periodTrades.reduce((sum, t) => sum + t.profit, 0)
    }
  }

  const dailyStats = getCurrentPeriodStats('day')
  const weeklyStats = getCurrentPeriodStats('week')
  const monthlyStats = getCurrentPeriodStats('month')

  // Generate challenges based on current stats
  const generateChallenges = (): Challenge[] => {
    const challenges: Challenge[] = [
      // Daily Challenges
      {
        id: 'daily_trades',
        name: 'Daily Trader',
        namePT: 'Trader Diário',
        description: 'Complete 3 trades today',
        descriptionPT: 'Complete 3 trades hoje',
        icon: '📊',
        type: 'daily',
        target: 3,
        current: dailyStats.trades,
        unit: 'trades',
        difficulty: 'easy',
        reward: '10 XP',
        rewardPT: '10 XP',
        completed: dailyStats.trades >= 3,
        points: 10
      },
      {
        id: 'daily_profit',
        name: 'Daily Profit',
        namePT: 'Lucro Diário',
        description: 'Earn $50 profit today',
        descriptionPT: 'Ganhe $50 de lucro hoje',
        icon: '💰',
        type: 'daily',
        target: 50,
        current: dailyStats.profit,
        unit: '$',
        difficulty: 'medium',
        reward: '20 XP',
        rewardPT: '20 XP',
        completed: dailyStats.profit >= 50,
        points: 20
      },
      {
        id: 'daily_accuracy',
        name: 'Accuracy Master',
        namePT: 'Mestre da Precisão',
        description: 'Win 2 out of 3 trades today',
        descriptionPT: 'Ganhe 2 de 3 trades hoje',
        icon: '🎯',
        type: 'daily',
        target: 2,
        current: dailyStats.wins,
        unit: 'wins',
        difficulty: 'medium',
        reward: '15 XP',
        rewardPT: '15 XP',
        completed: dailyStats.wins >= 2 && dailyStats.trades >= 3,
        points: 15
      },
      {
        id: 'daily_perfect',
        name: 'Perfect Day',
        namePT: 'Dia Perfeito',
        description: 'Win all trades today (min. 3)',
        descriptionPT: 'Ganhe todos os trades hoje (mín. 3)',
        icon: '⭐',
        type: 'daily',
        target: 1,
        current: dailyStats.trades >= 3 && dailyStats.wins === dailyStats.trades ? 1 : 0,
        unit: 'goal',
        difficulty: 'hard',
        reward: '50 XP',
        rewardPT: '50 XP',
        completed: dailyStats.trades >= 3 && dailyStats.wins === dailyStats.trades,
        points: 50
      },

      // Weekly Challenges
      {
        id: 'weekly_volume',
        name: 'High Volume Week',
        namePT: 'Semana de Alto Volume',
        description: 'Complete 15 trades this week',
        descriptionPT: 'Complete 15 trades esta semana',
        icon: '📈',
        type: 'weekly',
        target: 15,
        current: weeklyStats.trades,
        unit: 'trades',
        difficulty: 'easy',
        reward: '30 XP',
        rewardPT: '30 XP',
        completed: weeklyStats.trades >= 15,
        points: 30
      },
      {
        id: 'weekly_profit',
        name: 'Profitable Week',
        namePT: 'Semana Lucrativa',
        description: 'Earn $200 profit this week',
        descriptionPT: 'Ganhe $200 de lucro esta semana',
        icon: '💎',
        type: 'weekly',
        target: 200,
        current: weeklyStats.profit,
        unit: '$',
        difficulty: 'medium',
        reward: '75 XP',
        rewardPT: '75 XP',
        completed: weeklyStats.profit >= 200,
        points: 75
      },
      {
        id: 'weekly_consistency',
        name: 'Consistent Trader',
        namePT: 'Trader Consistente',
        description: 'Trade at least 2 times each day this week',
        descriptionPT: 'Trade pelo menos 2 vezes cada dia desta semana',
        icon: '🔄',
        type: 'weekly',
        target: 1,
        current: 0, // This would need more complex calculation
        unit: 'goal',
        difficulty: 'hard',
        reward: '100 XP',
        rewardPT: '100 XP',
        completed: false,
        points: 100
      },

      // Monthly Challenges
      {
        id: 'monthly_volume',
        name: 'Monthly Milestone',
        namePT: 'Marco Mensal',
        description: 'Complete 50 trades this month',
        descriptionPT: 'Complete 50 trades este mês',
        icon: '🏆',
        type: 'monthly',
        target: 50,
        current: monthlyStats.trades,
        unit: 'trades',
        difficulty: 'easy',
        reward: '100 XP',
        rewardPT: '100 XP',
        completed: monthlyStats.trades >= 50,
        points: 100
      },
      {
        id: 'monthly_profit',
        name: 'Monthly Profit Goal',
        namePT: 'Meta de Lucro Mensal',
        description: 'Earn $1000 profit this month',
        descriptionPT: 'Ganhe $1000 de lucro este mês',
        icon: '💰',
        type: 'monthly',
        target: 1000,
        current: monthlyStats.profit,
        unit: '$',
        difficulty: 'hard',
        reward: '250 XP',
        rewardPT: '250 XP',
        completed: monthlyStats.profit >= 1000,
        points: 250
      },
      {
        id: 'monthly_winrate',
        name: 'Win Rate Champion',
        namePT: 'Campeão de Taxa de Vitória',
        description: 'Maintain 70%+ win rate with 30+ trades',
        descriptionPT: 'Mantenha 70%+ de taxa de vitória com 30+ trades',
        icon: '👑',
        type: 'monthly',
        target: 70,
        current: monthlyStats.trades >= 30 ? (monthlyStats.wins / monthlyStats.trades) * 100 : 0,
        unit: '%',
        difficulty: 'hard',
        reward: '300 XP',
        rewardPT: '300 XP',
        completed: monthlyStats.trades >= 30 && (monthlyStats.wins / monthlyStats.trades) >= 0.7,
        points: 300
      }
    ]

    return challenges.filter(c => c.type === selectedType)
  }

  const challenges = generateChallenges()
  const completedChallenges = challenges.filter(c => c.completed)
  const totalPoints = completedChallenges.reduce((sum, c) => sum + c.points, 0)

  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 border-green-400/30'
      case 'medium': return 'text-yellow-400 border-yellow-400/30'
      case 'hard': return 'text-red-400 border-red-400/30'
    }
  }

  const getDifficultyBg = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/10'
      case 'medium': return 'bg-yellow-500/10'
      case 'hard': return 'bg-red-500/10'
    }
  }

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
            {isPortuguese ? 'Desafios' : 'Challenges'}
          </h2>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-comfortaa font-bold text-2xl text-primary">
            {isPortuguese ? 'Desafios' : 'Challenges'}
          </h2>
          
          <div className="text-sm text-primary font-semibold">
            {totalPoints} XP {isPortuguese ? 'hoje' : 'today'}
          </div>
        </div>

        {/* Challenge Type Tabs */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg mb-6 w-fit">
          {[
            { key: 'daily' as const, label: isPortuguese ? 'Diário' : 'Daily' },
            { key: 'weekly' as const, label: isPortuguese ? 'Semanal' : 'Weekly' },
            { key: 'monthly' as const, label: isPortuguese ? 'Mensal' : 'Monthly' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedType(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedType === tab.key
                  ? 'bg-primary text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Challenge Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {completedChallenges.length}/{challenges.length}
            </div>
            <div className="text-sm text-gray-400">
              {isPortuguese ? 'Completos' : 'Completed'}
            </div>
          </div>
          
          <div className="card text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {challenges.filter(c => !c.completed && (c.current / c.target) > 0.5).length}
            </div>
            <div className="text-sm text-gray-400">
              {isPortuguese ? 'Em Progresso' : 'In Progress'}
            </div>
          </div>
          
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {totalPoints}
            </div>
            <div className="text-sm text-gray-400">
              {isPortuguese ? 'XP Ganho' : 'XP Earned'}
            </div>
          </div>
        </div>

        {/* Challenges List */}
        <div className="space-y-4">
          {challenges.map((challenge) => {
            const progress = Math.min((challenge.current / challenge.target) * 100, 100)
            
            return (
              <div
                key={challenge.id}
                className={`card transition-all duration-300 hover:scale-[1.02] ${
                  challenge.completed 
                    ? 'bg-gradient-to-br from-green-500/20 to-primary/20 border-primary/30' 
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-4xl">{challenge.icon}</div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-comfortaa font-semibold text-lg text-white">
                          {isPortuguese ? challenge.namePT : challenge.name}
                        </h3>
                        <span 
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(challenge.difficulty)} ${getDifficultyBg(challenge.difficulty)}`}
                        >
                          {challenge.difficulty.toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mb-3">
                        {isPortuguese ? challenge.descriptionPT : challenge.description}
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">
                            {challenge.unit === '$' ? '$' : ''}{Math.floor(challenge.current)}{challenge.unit !== '$' && challenge.unit !== '%' && challenge.unit !== 'goal' ? ' ' + challenge.unit : challenge.unit === '%' ? '%' : ''}
                            {' / '}
                            {challenge.unit === '$' ? '$' : ''}{challenge.target}{challenge.unit !== '$' && challenge.unit !== '%' && challenge.unit !== 'goal' ? ' ' + challenge.unit : challenge.unit === '%' ? '%' : ''}
                          </span>
                          <span className="text-xs text-primary font-semibold">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        
                        <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              challenge.completed 
                                ? 'bg-gradient-to-r from-primary to-green-400' 
                                : challenge.difficulty === 'easy' 
                                ? 'bg-green-500' 
                                : challenge.difficulty === 'medium' 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {challenge.completed ? (
                        <div className="flex items-center gap-2">
                          <div className="text-green-400 text-2xl">✓</div>
                          <div>
                            <div className="text-sm font-bold text-primary">
                              +{challenge.points} XP
                            </div>
                            <div className="text-xs text-gray-400">
                              {isPortuguese ? 'Completo!' : 'Complete!'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-gray-300 mb-1">
                            {isPortuguese ? challenge.rewardPT : challenge.reward}
                          </div>
                          <div className="text-xs text-gray-400">
                            {isPortuguese ? 'Recompensa' : 'Reward'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Motivational Message */}
        {completedChallenges.length > 0 && (
          <div className="mt-8 text-center">
            <div className="card bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-400/20">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="font-comfortaa font-bold text-lg text-primary mb-2">
                {isPortuguese ? 'Parabéns!' : 'Congratulations!'}
              </h3>
              <p className="text-gray-300 text-sm">
                {isPortuguese 
                  ? `Você completou ${completedChallenges.length} ${completedChallenges.length === 1 ? 'desafio' : 'desafios'} e ganhou ${totalPoints} XP!`
                  : `You completed ${completedChallenges.length} ${completedChallenges.length === 1 ? 'challenge' : 'challenges'} and earned ${totalPoints} XP!`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
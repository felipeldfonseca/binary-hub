'use client'

import React from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface ProgressGoal {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  current: number
  target: number
  unit: string
  color: string
  icon: string
  period: string
  periodPT: string
}

interface ProgressTrackingProps {
  period?: 'day' | 'week' | 'month' | '3months' | '6months' | 'year'
}

export default function ProgressTracking({ period = 'week' }: ProgressTrackingProps) {
  const { stats, loading } = useTradeStats(period)
  const { trades } = useTrades()
  const { isPortuguese } = useLanguage()

  // Calculate current period trades
  const getCurrentPeriodTrades = () => {
    if (!trades) return 0
    
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
      default:
        return stats?.totalTrades || 0
    }
    
    return trades.filter(trade => 
      new Date(trade.exitTime) >= startDate
    ).length
  }

  // Define progress goals based on current stats
  const goals: ProgressGoal[] = [
    {
      id: 'trades_target',
      name: 'Trading Volume',
      namePT: 'Volume de Trades',
      description: 'Complete your trading volume goal',
      descriptionPT: 'Complete sua meta de volume de trades',
      current: getCurrentPeriodTrades(),
      target: period === 'day' ? 5 : period === 'week' ? 20 : period === 'month' ? 80 : 200,
      unit: 'trades',
      color: 'bg-blue-500',
      icon: '📊',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    },
    {
      id: 'profit_target',
      name: 'Profit Goal',
      namePT: 'Meta de Lucro',
      description: `Hit your ${period} profit target`,
      descriptionPT: `Atinja sua meta de lucro ${period === 'week' ? 'semanal' : 'mensal'}`,
      current: stats?.totalPnl || 0,
      target: period === 'day' ? 100 : period === 'week' ? 500 : period === 'month' ? 2000 : 5000,
      unit: '$',
      color: 'bg-green-500',
      icon: '💰',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    },
    {
      id: 'winrate_target',
      name: 'Win Rate Target',
      namePT: 'Meta de Taxa de Vitória',
      description: 'Maintain a strong win rate',
      descriptionPT: 'Mantenha uma taxa de vitória forte',
      current: stats?.winRate || 0,
      target: 70,
      unit: '%',
      color: 'bg-purple-500',
      icon: '🎯',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    },
    {
      id: 'consistency_target',
      name: 'Consistency Score',
      namePT: 'Pontuação de Consistência',
      description: 'Maintain trading consistency',
      descriptionPT: 'Mantenha consistência nos trades',
      current: Math.min(((stats?.winTrades || 0) / Math.max(stats?.totalTrades || 1, 1)) * 100, 100),
      target: 60,
      unit: '%',
      color: 'bg-orange-500',
      icon: '⚡',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    },
    {
      id: 'risk_management',
      name: 'Risk Management',
      namePT: 'Gestão de Risco',
      description: 'Keep drawdown under control',
      descriptionPT: 'Mantenha o drawdown sob controle',
      current: 100 - Math.min((Math.abs(stats?.maxDrawdown || 0) / (stats?.totalPnl || 1)) * 100, 100),
      target: 80,
      unit: '%',
      color: 'bg-red-500',
      icon: '🛡️',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    },
    {
      id: 'streak_target',
      name: 'Win Streak',
      namePT: 'Sequência de Vitórias',
      description: 'Build your winning momentum',
      descriptionPT: 'Construa seu momentum vencedor',
      current: Math.min(stats?.winTrades || 0, 10),
      target: 10,
      unit: 'wins',
      color: 'bg-yellow-500',
      icon: '🔥',
      period: period,
      periodPT: period === 'day' ? 'diário' : period === 'week' ? 'semanal' : 'mensal'
    }
  ]

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
            {isPortuguese ? 'Progresso das Metas' : 'Goal Progress'}
          </h2>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
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
            {isPortuguese ? 'Progresso das Metas' : 'Goal Progress'}
          </h2>
          <div className="text-sm text-gray-300 capitalize">
            {isPortuguese 
              ? period === 'day' ? 'Diário' : period === 'week' ? 'Semanal' : 'Mensal'
              : period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'
            }
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const progress = Math.min((goal.current / goal.target) * 100, 100)
            const isCompleted = progress >= 100
            
            return (
              <div
                key={goal.id}
                className={`card transition-all duration-300 hover:scale-105 ${
                  isCompleted ? 'bg-gradient-to-br from-green-500/20 to-primary/20 border-primary/30' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{goal.icon}</div>
                    <div>
                      <h3 className="font-comfortaa font-semibold text-lg text-white">
                        {isPortuguese ? goal.namePT : goal.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {isPortuguese ? goal.descriptionPT : goal.description}
                      </p>
                    </div>
                  </div>
                  {isCompleted && (
                    <div className="text-primary text-xl">
                      ✓
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-300">
                      {progress.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-400">
                      {goal.unit === '$' ? '$' : ''}{Math.floor(goal.current)}{goal.unit !== '$' && goal.unit !== '%' ? ' ' + goal.unit : goal.unit === '%' ? '%' : ''} 
                      {' / '}
                      {goal.unit === '$' ? '$' : ''}{goal.target}{goal.unit !== '$' && goal.unit !== '%' ? ' ' + goal.unit : goal.unit === '%' ? '%' : ''}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-gradient-to-r from-primary to-green-400' : goal.color
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    >
                      {progress > 10 && (
                        <div className="h-full bg-white/20 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Message */}
                <div className="text-xs">
                  {isCompleted ? (
                    <div className="text-primary font-semibold flex items-center gap-1">
                      <span>🎉</span>
                      {isPortuguese ? 'Meta Atingida!' : 'Goal Achieved!'}
                    </div>
                  ) : progress > 50 ? (
                    <div className="text-yellow-400">
                      {isPortuguese ? 'Você está quase lá!' : 'You\'re almost there!'}
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      {isPortuguese 
                        ? `Faltam ${goal.unit === '$' ? '$' : ''}${Math.ceil(goal.target - goal.current)}${goal.unit !== '$' && goal.unit !== '%' ? ' ' + goal.unit : goal.unit === '%' ? '%' : ''}`
                        : `${goal.unit === '$' ? '$' : ''}${Math.ceil(goal.target - goal.current)}${goal.unit !== '$' && goal.unit !== '%' ? ' ' + goal.unit : goal.unit === '%' ? '%' : ''} to go`
                      }
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Overall Progress Summary */}
        <div className="mt-8">
          <div className="card">
            <h3 className="font-comfortaa font-semibold text-lg mb-4 text-center text-primary">
              {isPortuguese ? 'Resumo Geral' : 'Overall Progress'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-1">
                  {goals.filter(g => (g.current / g.target) * 100 >= 100).length}
                </div>
                <div className="text-sm text-gray-400">
                  {isPortuguese ? 'Metas Completas' : 'Goals Complete'}
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {goals.filter(g => {
                    const p = (g.current / g.target) * 100
                    return p >= 50 && p < 100
                  }).length}
                </div>
                <div className="text-sm text-gray-400">
                  {isPortuguese ? 'Em Progresso' : 'In Progress'}
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-white mb-1">
                  {Math.round(goals.reduce((acc, g) => acc + Math.min((g.current / g.target) * 100, 100), 0) / goals.length)}%
                </div>
                <div className="text-sm text-gray-400">
                  {isPortuguese ? 'Progresso Médio' : 'Average Progress'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
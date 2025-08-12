'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades, Trade } from '@/hooks/useTrades'

// Gaming-focused type definitions
type GamingTab = 'dashboard' | 'achievements' | 'challenges' | 'learning' | 'leaderboard' | 'rewards' | 'analytics'
type AchievementCategory = 'trades' | 'profit' | 'streak' | 'risk' | 'consistency' | 'special'
type ChallengeType = 'daily' | 'weekly' | 'monthly' | 'special'

interface PlayerLevel {
  currentLevel: number
  currentXP: number
  xpToNextLevel: number
  totalXP: number
  levelName: string
  unlockedFeatures: string[]
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockedAt?: Date
  progress: number
  maxProgress: number
  xpReward: number
  badge?: string
}

interface Challenge {
  id: string
  name: string
  description: string
  type: ChallengeType
  icon: string
  progress: number
  maxProgress: number
  xpReward: number
  coinReward: number
  deadline: Date
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  completed: boolean
}

interface LearningModule {
  id: string
  title: string
  description: string
  category: 'basics' | 'intermediate' | 'advanced' | 'psychology' | 'strategy'
  icon: string
  progress: number
  maxProgress: number
  xpReward: number
  estimatedTime: string
  completed: boolean
}

interface VisualCard {
  id: string
  title: string
  subtitle: string
  value: string | number
  change?: number
  icon: string
  gradient: string
  size: 'small' | 'medium' | 'large'
  animation?: 'pulse' | 'bounce' | 'glow'
}

export default function AnalyticsV2Gamified() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<GamingTab>('dashboard')
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null)

  // Hooks
  const { stats, loading: statsLoading, error: statsError } = useTradeStats('allTime')
  const { trades, loading: tradesLoading, error: tradesError } = useTrades()

  const hasData = trades.length > 0
  const loading = statsLoading || tradesLoading
  const error = statsError || tradesError

  // Calculate player level and XP based on trading metrics
  const playerLevel = useMemo((): PlayerLevel => {
    if (!hasData) return {
      currentLevel: 1,
      currentXP: 0,
      xpToNextLevel: 100,
      totalXP: 0,
      levelName: isPortuguese ? 'Novato' : 'Novice',
      unlockedFeatures: ['basic_analytics']
    }

    const totalTrades = stats?.totalTrades || 0
    const winRate = stats?.winRate || 0
    const totalPnl = stats?.totalPnl || 0
    
    // XP calculation based on performance
    let totalXP = 0
    totalXP += totalTrades * 10 // 10 XP per trade
    totalXP += Math.max(0, Math.floor((winRate - 50) * 5)) // Bonus XP for good win rate
    totalXP += Math.max(0, Math.floor(totalPnl / 10)) // XP for profit
    
    // Level calculation
    const currentLevel = Math.max(1, Math.floor(totalXP / 500) + 1)
    const currentXP = totalXP % 500
    const xpToNextLevel = 500 - currentXP
    
    // Level names
    const levelNames = [
      isPortuguese ? 'Novato' : 'Novice',
      isPortuguese ? 'Aprendiz' : 'Apprentice',
      isPortuguese ? 'Trader' : 'Trader',
      isPortuguese ? 'Experiente' : 'Experienced',
      isPortuguese ? 'Expert' : 'Expert',
      isPortuguese ? 'Mestre' : 'Master',
      isPortuguese ? 'Lenda' : 'Legend'
    ]
    
    const levelName = levelNames[Math.min(currentLevel - 1, levelNames.length - 1)]
    
    return {
      currentLevel,
      currentXP,
      xpToNextLevel,
      totalXP,
      levelName,
      unlockedFeatures: []
    }
  }, [stats, hasData, isPortuguese])

  // Generate achievements based on trading performance
  const achievements = useMemo((): Achievement[] => {
    const achievementsList: Achievement[] = [
      {
        id: 'first_trade',
        name: isPortuguese ? 'Primeira Operação' : 'First Trade',
        description: isPortuguese ? 'Execute sua primeira operação' : 'Execute your first trade',
        icon: '🎯',
        category: 'trades',
        rarity: 'common',
        progress: Math.min(trades.length, 1),
        maxProgress: 1,
        xpReward: 50,
        unlockedAt: trades.length > 0 ? trades[0].createdAt : undefined
      },
      {
        id: 'trade_veteran',
        name: isPortuguese ? 'Veterano' : 'Veteran Trader',
        description: isPortuguese ? 'Complete 100 operações' : 'Complete 100 trades',
        icon: '🏆',
        category: 'trades',
        rarity: 'rare',
        progress: Math.min(trades.length, 100),
        maxProgress: 100,
        xpReward: 500,
        unlockedAt: trades.length >= 100 ? new Date() : undefined
      },
      {
        id: 'profit_master',
        name: isPortuguese ? 'Mestre dos Lucros' : 'Profit Master',
        description: isPortuguese ? 'Alcance $1000 em lucros' : 'Reach $1000 in profits',
        icon: '💰',
        category: 'profit',
        rarity: 'epic',
        progress: Math.min(Math.max(0, stats?.totalPnl || 0), 1000),
        maxProgress: 1000,
        xpReward: 750,
        unlockedAt: (stats?.totalPnl || 0) >= 1000 ? new Date() : undefined
      },
      {
        id: 'win_streak_5',
        name: isPortuguese ? 'Sequência de Ouro' : 'Golden Streak',
        description: isPortuguese ? 'Ganhe 5 operações seguidas' : 'Win 5 trades in a row',
        icon: '🔥',
        category: 'streak',
        rarity: 'rare',
        progress: 0, // Would need streak calculation
        maxProgress: 5,
        xpReward: 300
      },
      {
        id: 'risk_manager',
        name: isPortuguese ? 'Gestor de Risco' : 'Risk Manager',
        description: isPortuguese ? 'Mantenha drawdown abaixo de 10%' : 'Keep drawdown below 10%',
        icon: '🛡️',
        category: 'risk',
        rarity: 'epic',
        progress: 0, // Would need drawdown calculation
        maxProgress: 1,
        xpReward: 400
      },
      {
        id: 'consistency_king',
        name: isPortuguese ? 'Rei da Consistência' : 'Consistency King',
        description: isPortuguese ? 'Taxa de acerto acima de 65%' : 'Win rate above 65%',
        icon: '👑',
        category: 'consistency',
        rarity: 'legendary',
        progress: Math.min(Math.max(0, (stats?.winRate || 0) - 50), 15),
        maxProgress: 15,
        xpReward: 1000,
        badge: 'ELITE',
        unlockedAt: (stats?.winRate || 0) >= 65 ? new Date() : undefined
      }
    ]

    return achievementsList
  }, [trades, stats, isPortuguese])

  // Generate daily/weekly challenges
  const challenges = useMemo((): Challenge[] => {
    const challengesList: Challenge[] = [
      {
        id: 'daily_trades',
        name: isPortuguese ? 'Operações Diárias' : 'Daily Trades',
        description: isPortuguese ? 'Complete 5 operações hoje' : 'Complete 5 trades today',
        type: 'daily',
        icon: '📈',
        progress: 0, // Would need today's trades
        maxProgress: 5,
        xpReward: 100,
        coinReward: 50,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        difficulty: 'easy',
        completed: false
      },
      {
        id: 'weekly_profit',
        name: isPortuguese ? 'Meta Semanal' : 'Weekly Goal',
        description: isPortuguese ? 'Lucre $200 esta semana' : 'Profit $200 this week',
        type: 'weekly',
        icon: '💎',
        progress: 0,
        maxProgress: 200,
        xpReward: 500,
        coinReward: 200,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        difficulty: 'medium',
        completed: false
      },
      {
        id: 'perfect_day',
        name: isPortuguese ? 'Dia Perfeito' : 'Perfect Day',
        description: isPortuguese ? '100% taxa de acerto por 1 dia' : '100% win rate for 1 day',
        type: 'daily',
        icon: '⭐',
        progress: 0,
        maxProgress: 1,
        xpReward: 300,
        coinReward: 150,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        difficulty: 'hard',
        completed: false
      }
    ]

    return challengesList
  }, [isPortuguese])

  // Learning modules
  const learningModules = useMemo((): LearningModule[] => [
    {
      id: 'basics_intro',
      title: isPortuguese ? 'Introdução às Opções Binárias' : 'Binary Options Basics',
      description: isPortuguese ? 'Conceitos fundamentais' : 'Fundamental concepts',
      category: 'basics',
      icon: '📚',
      progress: 3,
      maxProgress: 5,
      xpReward: 200,
      estimatedTime: '15 min',
      completed: false
    },
    {
      id: 'risk_management',
      title: isPortuguese ? 'Gestão de Risco' : 'Risk Management',
      description: isPortuguese ? 'Proteja seu capital' : 'Protect your capital',
      category: 'intermediate',
      icon: '🛡️',
      progress: 0,
      maxProgress: 8,
      xpReward: 400,
      estimatedTime: '25 min',
      completed: false
    },
    {
      id: 'psychology',
      title: isPortuguese ? 'Psicologia do Trading' : 'Trading Psychology',
      description: isPortuguese ? 'Controle suas emoções' : 'Control your emotions',
      category: 'psychology',
      icon: '🧠',
      progress: 1,
      maxProgress: 6,
      xpReward: 350,
      estimatedTime: '30 min',
      completed: false
    }
  ], [isPortuguese])

  // Visual cards for Pinterest-style layout
  const visualCards = useMemo((): VisualCard[] => {
    if (!hasData) return []

    return [
      {
        id: 'level',
        title: isPortuguese ? 'Nível' : 'Level',
        subtitle: playerLevel.levelName,
        value: playerLevel.currentLevel,
        icon: '⭐',
        gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
        size: 'large',
        animation: 'glow'
      },
      {
        id: 'xp',
        title: isPortuguese ? 'Experiência' : 'Experience',
        subtitle: `${playerLevel.xpToNextLevel} XP ${isPortuguese ? 'para próximo nível' : 'to next level'}`,
        value: `${playerLevel.currentXP}/500`,
        icon: '🚀',
        gradient: 'from-blue-400 via-purple-500 to-pink-500',
        size: 'medium'
      },
      {
        id: 'total_trades',
        title: isPortuguese ? 'Total de Trades' : 'Total Trades',
        subtitle: isPortuguese ? 'Operações realizadas' : 'Trades completed',
        value: stats?.totalTrades || 0,
        icon: '📊',
        gradient: 'from-green-400 via-teal-500 to-blue-500',
        size: 'medium',
        animation: 'pulse'
      },
      {
        id: 'win_rate',
        title: isPortuguese ? 'Taxa de Acerto' : 'Win Rate',
        subtitle: isPortuguese ? 'Precisão' : 'Accuracy',
        value: `${(stats?.winRate || 0).toFixed(1)}%`,
        change: (stats?.winRate || 0) - 50,
        icon: '🎯',
        gradient: (stats?.winRate || 0) >= 60 ? 'from-emerald-400 to-green-500' : 'from-orange-400 to-red-500',
        size: 'large'
      },
      {
        id: 'total_pnl',
        title: 'P&L Total',
        subtitle: isPortuguese ? 'Lucro/Prejuízo' : 'Profit/Loss',
        value: `$${(stats?.totalPnl || 0) >= 0 ? '+' : ''}${(stats?.totalPnl || 0).toFixed(0)}`,
        change: stats?.totalPnl || 0,
        icon: '💰',
        gradient: (stats?.totalPnl || 0) >= 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-pink-500',
        size: 'large',
        animation: 'bounce'
      },
      {
        id: 'achievements',
        title: isPortuguese ? 'Conquistas' : 'Achievements',
        subtitle: isPortuguese ? 'Desbloqueadas' : 'Unlocked',
        value: `${achievements.filter(a => a.unlockedAt).length}/${achievements.length}`,
        icon: '🏆',
        gradient: 'from-purple-400 via-pink-500 to-red-500',
        size: 'medium'
      }
    ]
  }, [stats, hasData, playerLevel, achievements, isPortuguese])

  // Tab configuration with gaming theme
  const tabs = [
    { 
      key: 'dashboard', 
      label: isPortuguese ? 'Dashboard' : 'Dashboard',
      icon: '🎮',
      color: 'from-blue-500 to-purple-600'
    },
    { 
      key: 'achievements', 
      label: isPortuguese ? 'Conquistas' : 'Achievements',
      icon: '🏆',
      color: 'from-yellow-500 to-orange-600'
    },
    { 
      key: 'challenges', 
      label: isPortuguese ? 'Desafios' : 'Challenges',
      icon: '⚡',
      color: 'from-green-500 to-teal-600'
    },
    { 
      key: 'learning', 
      label: isPortuguese ? 'Aprendizado' : 'Learning',
      icon: '📚',
      color: 'from-indigo-500 to-blue-600'
    },
    { 
      key: 'leaderboard', 
      label: isPortuguese ? 'Ranking' : 'Leaderboard',
      icon: '👑',
      color: 'from-purple-500 to-pink-600'
    },
    { 
      key: 'rewards', 
      label: isPortuguese ? 'Recompensas' : 'Rewards',
      icon: '🎁',
      color: 'from-pink-500 to-red-600'
    },
    { 
      key: 'analytics', 
      label: isPortuguese ? 'Analytics' : 'Analytics',
      icon: '📈',
      color: 'from-teal-500 to-cyan-600'
    }
  ]

  if (!hasData && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-poly font-bold text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text mb-6">
              {isPortuguese ? '🎮 Analytics Gamificado' : '🎮 Gamified Analytics'}
            </h1>
            <p className="text-xl font-comfortaa font-normal text-white/90 max-w-4xl mx-auto">
              {isPortuguese 
                ? 'Transforme seu trading em uma aventura épica! Ganhe XP, desbloqueie conquistas e suba de nível.'
                : 'Transform your trading into an epic adventure! Earn XP, unlock achievements and level up.'
              }
            </p>
          </div>

          {/* Empty State with Gaming Theme */}
          <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-white/20 rounded-3xl text-center py-16 shadow-2xl">
            <div className="text-8xl mb-8 animate-bounce">🎮</div>
            <h3 className="text-3xl font-bold text-white mb-6 font-comfortaa">
              {isPortuguese ? 'Sua Aventura Começa Aqui!' : 'Your Adventure Starts Here!'}
            </h3>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Importe seus dados de trading para começar a ganhar XP, desbloquear conquistas incríveis e competir no ranking global!'
                : 'Import your trading data to start earning XP, unlock amazing achievements and compete on the global leaderboard!'
              }
            </p>
            
            {/* Feature Preview */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { icon: '⭐', title: isPortuguese ? 'Sistema de Níveis' : 'Level System' },
                { icon: '🏆', title: isPortuguese ? 'Conquistas' : 'Achievements' },
                { icon: '⚡', title: isPortuguese ? 'Desafios' : 'Challenges' },
                { icon: '📚', title: isPortuguese ? 'Aprendizado' : 'Learning' }
              ].map((feature, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h4 className="font-semibold text-white font-comfortaa">{feature.title}</h4>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white font-bold px-8 py-4 rounded-2xl hover:shadow-2xl transition-all duration-300 font-comfortaa transform hover:scale-105 text-lg"
            >
              🚀 {isPortuguese ? 'Começar Aventura' : 'Start Adventure'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-4 py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header with Level and XP */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2 rounded-full">
              ⭐ Level {playerLevel.currentLevel}
            </div>
            <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white font-bold px-4 py-2 rounded-full">
              🚀 {playerLevel.currentXP} XP
            </div>
            <div className="bg-gradient-to-r from-pink-400 to-red-500 text-white font-bold px-4 py-2 rounded-full">
              👑 {playerLevel.levelName}
            </div>
          </div>
          
          <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text mb-4">
            {isPortuguese ? '🎮 Analytics Gamificado' : '🎮 Gamified Analytics'}
          </h1>
          
          {/* XP Progress Bar */}
          <div className="max-w-md mx-auto mb-6">
            <div className="flex justify-between text-white/80 text-sm mb-2">
              <span>{isPortuguese ? 'Próximo Nível' : 'Next Level'}</span>
              <span>{playerLevel.xpToNextLevel} XP</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
                style={{ width: `${(playerLevel.currentXP / 500) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-2xl">⚠️</span>
              <div>
                <h4 className="font-bold text-white">
                  {isPortuguese ? 'Erro ao carregar dados' : 'Error loading data'}
                </h4>
                <p className="text-white/80 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Gaming Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as GamingTab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-bold text-sm relative overflow-hidden group ${
                activeTab === tab.key
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-2xl scale-105`
                  : 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/20'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.key && (
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-2xl" />
              )}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl text-center py-16 border border-white/20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-yellow-400 mb-4"></div>
            <p className="text-white font-comfortaa text-lg">
              🎮 {isPortuguese ? 'Carregando sua aventura...' : 'Loading your adventure...'}
            </p>
          </div>
        )}

        {/* Tab Content */}
        {!loading && (
          <div className="space-y-8">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {/* Visual Cards Grid - Pinterest Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {visualCards.map(card => (
                    <div
                      key={card.id}
                      className={`bg-gradient-to-br ${card.gradient} rounded-3xl p-6 text-white shadow-2xl transform hover:scale-105 transition-all duration-300 ${
                        card.size === 'large' ? 'lg:col-span-2' : 
                        card.size === 'medium' ? 'md:col-span-1' : ''
                      } ${
                        card.animation === 'pulse' ? 'animate-pulse' :
                        card.animation === 'bounce' ? 'animate-bounce' :
                        card.animation === 'glow' ? 'hover:shadow-yellow-400/50 shadow-xl' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="text-4xl">{card.icon}</div>
                        {card.change !== undefined && (
                          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                            card.change >= 0 ? 'bg-green-500/30' : 'bg-red-500/30'
                          }`}>
                            {card.change >= 0 ? '↗' : '↘'} {Math.abs(card.change).toFixed(1)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-bold font-comfortaa mb-2">{card.title}</h3>
                      <p className="text-white/80 text-sm mb-3">{card.subtitle}</p>
                      <div className="text-3xl font-bold">{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Achievements */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                  <h2 className="text-2xl font-bold text-white font-comfortaa mb-6 flex items-center gap-3">
                    <span className="text-3xl">🏆</span>
                    {isPortuguese ? 'Conquistas Recentes' : 'Recent Achievements'}
                  </h2>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {achievements.filter(a => a.unlockedAt).slice(0, 6).map(achievement => (
                      <div
                        key={achievement.id}
                        className={`p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                          achievement.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400' :
                          achievement.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400' :
                          achievement.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500/20 to-teal-500/20 border-blue-400' :
                          'bg-white/10 border-white/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{achievement.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-white text-sm">{achievement.name}</h4>
                              {achievement.badge && (
                                <span className="px-2 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full">
                                  {achievement.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-white/70 text-xs mb-2">{achievement.description}</p>
                            <div className="text-yellow-400 text-xs font-bold">
                              +{achievement.xpReward} XP
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    🏆 {isPortuguese ? 'Suas Conquistas' : 'Your Achievements'}
                  </h2>
                  <p className="text-white/80">
                    {isPortuguese ? 
                      `${achievements.filter(a => a.unlockedAt).length} de ${achievements.length} conquistas desbloqueadas` :
                      `${achievements.filter(a => a.unlockedAt).length} of ${achievements.length} achievements unlocked`
                    }
                  </p>
                </div>

                {/* Achievement Categories */}
                <div className="grid gap-8">
                  {(['trades', 'profit', 'streak', 'risk', 'consistency'] as AchievementCategory[]).map(category => {
                    const categoryAchievements = achievements.filter(a => a.category === category)
                    const categoryNames = {
                      trades: isPortuguese ? 'Operações' : 'Trading',
                      profit: isPortuguese ? 'Lucros' : 'Profits',
                      streak: isPortuguese ? 'Sequências' : 'Streaks',
                      risk: isPortuguese ? 'Gestão de Risco' : 'Risk Management',
                      consistency: isPortuguese ? 'Consistência' : 'Consistency'
                    }
                    
                    return (
                      <div key={category} className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                        <h3 className="text-xl font-bold text-white font-comfortaa mb-6">
                          {categoryNames[category]}
                        </h3>
                        
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {categoryAchievements.map(achievement => (
                            <div
                              key={achievement.id}
                              className={`p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                                achievement.unlockedAt ? (
                                  achievement.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400' :
                                  achievement.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400' :
                                  achievement.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500/20 to-teal-500/20 border-blue-400' :
                                  'bg-gradient-to-r from-green-500/20 to-teal-500/20 border-green-400'
                                ) : 'bg-gray-800/30 border-gray-600 opacity-60'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-4xl mb-3">{achievement.icon}</div>
                                <h4 className="font-bold text-white mb-2">{achievement.name}</h4>
                                <p className="text-white/70 text-sm mb-4">{achievement.description}</p>
                                
                                {/* Progress Bar */}
                                <div className="mb-4">
                                  <div className="flex justify-between text-xs text-white/60 mb-1">
                                    <span>{achievement.progress}</span>
                                    <span>{achievement.maxProgress}</span>
                                  </div>
                                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-blue-400 to-teal-500 transition-all duration-1000"
                                      style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <span className="text-yellow-400 text-sm font-bold">
                                    +{achievement.xpReward} XP
                                  </span>
                                  {achievement.unlockedAt && (
                                    <span className="text-green-400 text-sm">
                                      ✓ {isPortuguese ? 'Desbloqueada' : 'Unlocked'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Challenges Tab */}
            {activeTab === 'challenges' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    ⚡ {isPortuguese ? 'Desafios Ativos' : 'Active Challenges'}
                  </h2>
                  <p className="text-white/80">
                    {isPortuguese ? 
                      'Complete desafios para ganhar XP e moedas extras!' :
                      'Complete challenges to earn extra XP and coins!'
                    }
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {challenges.map(challenge => (
                    <div
                      key={challenge.id}
                      className={`p-6 rounded-3xl border-2 transition-all duration-300 hover:scale-105 cursor-pointer ${
                        challenge.completed ? 'bg-green-500/20 border-green-400' :
                        challenge.difficulty === 'easy' ? 'bg-blue-500/20 border-blue-400' :
                        challenge.difficulty === 'medium' ? 'bg-yellow-500/20 border-yellow-400' :
                        challenge.difficulty === 'hard' ? 'bg-orange-500/20 border-orange-400' :
                        'bg-red-500/20 border-red-400'
                      }`}
                      onClick={() => setSelectedChallenge(challenge.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl">{challenge.icon}</span>
                        <div className="text-right">
                          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                            challenge.difficulty === 'easy' ? 'bg-blue-500 text-white' :
                            challenge.difficulty === 'medium' ? 'bg-yellow-500 text-black' :
                            challenge.difficulty === 'hard' ? 'bg-orange-500 text-white' :
                            'bg-red-500 text-white'
                          }`}>
                            {challenge.difficulty.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white mb-2">{challenge.name}</h3>
                      <p className="text-white/70 text-sm mb-4">{challenge.description}</p>
                      
                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                          <span>{challenge.progress}</span>
                          <span>{challenge.maxProgress}</span>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-400 to-teal-500 transition-all duration-1000"
                            style={{ width: `${(challenge.progress / challenge.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Rewards */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex gap-2">
                          <span className="text-yellow-400">🚀 {challenge.xpReward} XP</span>
                          <span className="text-yellow-400">🪙 {challenge.coinReward}</span>
                        </div>
                        <span className="text-white/60">
                          {new Date(challenge.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Tab */}
            {activeTab === 'learning' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    📚 {isPortuguese ? 'Centro de Aprendizado' : 'Learning Center'}
                  </h2>
                  <p className="text-white/80">
                    {isPortuguese ? 
                      'Aprenda novas estratégias e ganhe XP!' :
                      'Learn new strategies and earn XP!'
                    }
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {learningModules.map(module => (
                    <div
                      key={module.id}
                      className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl">{module.icon}</span>
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                          module.category === 'basics' ? 'bg-green-500 text-white' :
                          module.category === 'intermediate' ? 'bg-yellow-500 text-black' :
                          module.category === 'advanced' ? 'bg-orange-500 text-white' :
                          module.category === 'psychology' ? 'bg-purple-500 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {module.category.toUpperCase()}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white mb-2">{module.title}</h3>
                      <p className="text-white/70 text-sm mb-4">{module.description}</p>
                      
                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                          <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                          <span>{module.progress}/{module.maxProgress}</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-1000"
                            style={{ width: `${(module.progress / module.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-yellow-400">🚀 {module.xpReward} XP</span>
                        <span className="text-white/60">⏱️ {module.estimatedTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    👑 {isPortuguese ? 'Ranking Global' : 'Global Leaderboard'}
                  </h2>
                  <p className="text-white/80">
                    {isPortuguese ? 'Compete com traders do mundo todo!' : 'Compete with traders worldwide!'}
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                  <div className="text-center py-16">
                    <div className="text-6xl mb-6">🏆</div>
                    <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Ranking em Desenvolvimento' : 'Leaderboard in Development'}
                    </h3>
                    <p className="text-white/70 mb-6">
                      {isPortuguese ? 
                        'O sistema de ranking global estará disponível em breve. Continue trading para garantir sua posição!' :
                        'The global ranking system will be available soon. Keep trading to secure your position!'
                      }
                    </p>
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-6 py-3 rounded-2xl inline-block">
                      {isPortuguese ? 'Em Breve' : 'Coming Soon'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rewards Tab */}
            {activeTab === 'rewards' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    🎁 {isPortuguese ? 'Central de Recompensas' : 'Rewards Center'}
                  </h2>
                  <p className="text-white/80">
                    {isPortuguese ? 
                      'Troque suas conquistas por recompensas incríveis!' :
                      'Exchange your achievements for amazing rewards!'
                    }
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                  <div className="text-center py-16">
                    <div className="text-6xl mb-6">🎁</div>
                    <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
                      {isPortuguese ? 'Sistema de Recompensas' : 'Rewards System'}
                    </h3>
                    <p className="text-white/70 mb-6">
                      {isPortuguese ? 
                        'O sistema de troca de recompensas estará disponível em breve. Continue coletando XP e conquistas!' :
                        'The rewards exchange system will be available soon. Keep collecting XP and achievements!'
                      }
                    </p>
                    <div className="bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold px-6 py-3 rounded-2xl inline-block">
                      {isPortuguese ? 'Em Desenvolvimento' : 'In Development'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab - Simplified version with gaming theme */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white font-comfortaa mb-4">
                    📈 {isPortuguese ? 'Analytics Rápido' : 'Quick Analytics'}
                  </h2>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: isPortuguese ? 'Trades Hoje' : 'Trades Today',
                      value: '0',
                      icon: '📊',
                      color: 'from-blue-500 to-purple-600'
                    },
                    {
                      label: isPortuguese ? 'Win Rate' : 'Win Rate',
                      value: `${(stats?.winRate || 0).toFixed(1)}%`,
                      icon: '🎯',
                      color: 'from-green-500 to-teal-600'
                    },
                    {
                      label: isPortuguese ? 'Melhor Streak' : 'Best Streak',
                      value: '0', // Would need calculation
                      icon: '🔥',
                      color: 'from-orange-500 to-red-600'
                    },
                    {
                      label: 'P&L',
                      value: `$${(stats?.totalPnl || 0) >= 0 ? '+' : ''}${(stats?.totalPnl || 0).toFixed(0)}`,
                      icon: '💰',
                      color: (stats?.totalPnl || 0) >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-pink-600'
                    }
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className={`bg-gradient-to-br ${stat.color} rounded-2xl p-4 text-white transform hover:scale-105 transition-all duration-300`}
                    >
                      <div className="text-2xl mb-2">{stat.icon}</div>
                      <div className="text-xl font-bold">{stat.value}</div>
                      <div className="text-sm opacity-80">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
                  <p className="text-white/70 text-center">
                    {isPortuguese ? 
                      'Para análises detalhadas, acesse o Analytics V1 Professional através do seletor de versão.' :
                      'For detailed analytics, access Analytics V1 Professional through the version selector.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gamified Analytics Summary */}
        <div className="mt-16 py-8">
          <div className="bg-gradient-to-r from-purple-800/20 via-pink-800/20 to-indigo-800/20 backdrop-blur-xl border border-white/20 rounded-3xl text-center p-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-4xl">🎮</div>
              <h3 className="font-heading text-2xl font-bold text-white">
                {isPortuguese ? 'Analytics V2 - Gamificado/Visual' : 'Analytics V2 - Gamified/Visual'}
              </h3>
            </div>
            <p className="text-white/70 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'Transforme seu trading em uma aventura épica! Sistema de níveis, conquistas, desafios e aprendizado gamificado para manter você motivado e engajado.'
                : 'Transform your trading into an epic adventure! Level system, achievements, challenges and gamified learning to keep you motivated and engaged.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Sistema de Níveis XP' : 'XP Level System'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Conquistas Desbloqueáveis' : 'Unlockable Achievements'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Desafios Diários' : 'Daily Challenges'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Aprendizado Interativo' : 'Interactive Learning'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Visual Pinterest Style' : 'Pinterest Style Visual'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
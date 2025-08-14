'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// Simple & Fun Conquistas V2 - Game-like Journey Approach
export default function ConquistasV2Analytics() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('allTime')
  const { trades } = useTrades()
  const [activeTab, setActiveTab] = useState('journey')

  // Simple Metrics - No complex stats, just basic numbers
  const traderLevel = Math.floor((stats?.totalTrades || 0) / 50) + 1
  const currentStreak = 3 // Mock current winning streak
  const bestStreak = 7 // Mock best streak
  const daysTraded = 15 // Mock days traded
  const totalProfit = stats?.totalPnl || 0
  const winRate = Math.round(stats?.winRate || 0)

  // Journey Path Milestones - Story-driven achievements
  const journeyMilestones = [
    {
      id: 'first_steps',
      title: isPortuguese ? '🌱 Primeiros Passos' : '🌱 First Steps',
      story: isPortuguese ? 'Você deu o primeiro passo na jornada do trading!' : 'You took your first step in the trading journey!',
      requirement: isPortuguese ? 'Faça seu primeiro trade' : 'Make your first trade',
      completed: (stats?.totalTrades || 0) >= 1,
      progress: Math.min(((stats?.totalTrades || 0) / 1) * 100, 100),
      color: 'from-green-400 to-emerald-500',
      icon: '🌱',
      celebration: isPortuguese ? 'Parabéns! Você começou sua aventura!' : 'Congratulations! You started your adventure!'
    },
    {
      id: 'first_win',
      title: isPortuguese ? '🎯 Primeira Vitória' : '🎯 First Victory',
      story: isPortuguese ? 'O sabor da primeira vitória é inesquecível!' : 'The taste of first victory is unforgettable!',
      requirement: isPortuguese ? 'Ganhe seu primeiro trade' : 'Win your first trade',
      completed: (stats?.winTrades || 0) >= 1,
      progress: Math.min(((stats?.winTrades || 0) / 1) * 100, 100),
      color: 'from-blue-400 to-cyan-500',
      icon: '🎯',
      celebration: isPortuguese ? 'Incrível! Sua primeira vitória!' : 'Amazing! Your first victory!'
    },
    {
      id: 'ten_trades',
      title: isPortuguese ? '🚀 Aprendiz Ativo' : '🚀 Active Learner',
      story: isPortuguese ? 'Você está pegando o jeito! Continue assim!' : 'You\'re getting the hang of it! Keep going!',
      requirement: isPortuguese ? 'Complete 10 trades' : 'Complete 10 trades',
      completed: (stats?.totalTrades || 0) >= 10,
      progress: Math.min(((stats?.totalTrades || 0) / 10) * 100, 100),
      color: 'from-purple-400 to-pink-500',
      icon: '🚀',
      celebration: isPortuguese ? 'Você está evoluindo rapidamente!' : 'You\'re evolving quickly!'
    },
    {
      id: 'profitable_week',
      title: isPortuguese ? '💰 Semana Lucrativa' : '💰 Profitable Week',
      story: isPortuguese ? 'Uma semana inteira no lucro! Você está no caminho certo!' : 'A whole week in profit! You\'re on the right track!',
      requirement: isPortuguese ? 'Lucro positivo esta semana' : 'Positive profit this week',
      completed: totalProfit > 0,
      progress: totalProfit > 0 ? 100 : 0,
      color: 'from-yellow-400 to-orange-500',
      icon: '💰',
      celebration: isPortuguese ? 'Semana fantástica! Continue assim!' : 'Fantastic week! Keep it up!'
    },
    {
      id: 'fifty_trades',
      title: isPortuguese ? '⭐ Trader Dedicado' : '⭐ Dedicated Trader',
      story: isPortuguese ? 'Sua dedicação está dando frutos! Você é um verdadeiro trader!' : 'Your dedication is paying off! You\'re a true trader!',
      requirement: isPortuguese ? 'Complete 50 trades' : 'Complete 50 trades',
      completed: (stats?.totalTrades || 0) >= 50,
      progress: Math.min(((stats?.totalTrades || 0) / 50) * 100, 100),
      color: 'from-indigo-400 to-purple-500',
      icon: '⭐',
      celebration: isPortuguese ? 'Incrível! Você é um trader dedicado!' : 'Incredible! You\'re a dedicated trader!'
    },
    {
      id: 'streak_master',
      title: isPortuguese ? '🔥 Mestre das Sequências' : '🔥 Streak Master',
      story: isPortuguese ? 'Você dominou a arte das sequências vencedoras!' : 'You mastered the art of winning streaks!',
      requirement: isPortuguese ? 'Sequência de 5 vitórias' : 'Win streak of 5',
      completed: bestStreak >= 5,
      progress: Math.min((bestStreak / 5) * 100, 100),
      color: 'from-red-400 to-pink-500',
      icon: '🔥',
      celebration: isPortuguese ? 'Você está on fire! 🔥' : 'You\'re on fire! 🔥'
    },
    {
      id: 'hundred_trades',
      title: isPortuguese ? '👑 Trader Experiente' : '👑 Experienced Trader',
      story: isPortuguese ? 'Você alcançou um marco importante! Parabéns pela persistência!' : 'You reached an important milestone! Congratulations on your persistence!',
      requirement: isPortuguese ? 'Complete 100 trades' : 'Complete 100 trades',
      completed: (stats?.totalTrades || 0) >= 100,
      progress: Math.min(((stats?.totalTrades || 0) / 100) * 100, 100),
      color: 'from-amber-400 to-yellow-500',
      icon: '👑',
      celebration: isPortuguese ? 'Você é oficialmente experiente! 👑' : 'You\'re officially experienced! 👑'
    },
    {
      id: 'master_trader',
      title: isPortuguese ? '🏆 Mestre Trader' : '🏆 Master Trader',
      story: isPortuguese ? 'O pináculo do trading! Você chegou ao topo!' : 'The pinnacle of trading! You reached the top!',
      requirement: isPortuguese ? 'Complete 500 trades' : 'Complete 500 trades',
      completed: (stats?.totalTrades || 0) >= 500,
      progress: Math.min(((stats?.totalTrades || 0) / 500) * 100, 100),
      color: 'from-gradient-gold-start to-gradient-gold-end',
      icon: '🏆',
      celebration: isPortuguese ? 'LENDÁRIO! Você é um Mestre Trader! 🏆' : 'LEGENDARY! You are a Master Trader! 🏆'
    }
  ]

  // Simple Daily Challenges - Fun bite-sized goals
  const dailyChallenges = [
    {
      id: 'daily_trade',
      title: isPortuguese ? 'Trader do Dia' : 'Trader of the Day',
      description: isPortuguese ? 'Faça pelo menos 1 trade hoje' : 'Make at least 1 trade today',
      progress: 1, // Mock: completed
      target: 1,
      reward: isPortuguese ? '10 XP + Motivação' : '10 XP + Motivation',
      icon: '📈',
      completed: true
    },
    {
      id: 'win_streak',
      title: isPortuguese ? 'Sequência Vencedora' : 'Winning Streak',
      description: isPortuguese ? 'Ganhe 3 trades seguidos' : 'Win 3 trades in a row',
      progress: 3,
      target: 3,
      reward: isPortuguese ? '25 XP + Badge Especial' : '25 XP + Special Badge',
      icon: '🔥',
      completed: true
    },
    {
      id: 'profit_goal',
      title: isPortuguese ? 'Meta de Lucro' : 'Profit Target',
      description: isPortuguese ? 'Ganhe $50 hoje' : 'Earn $50 today',
      progress: 34,
      target: 50,
      reward: isPortuguese ? '50 XP + Título' : '50 XP + Title',
      icon: '💎',
      completed: false
    }
  ]

  // Fun Stats - Simple, big numbers that feel impressive
  const funStats = [
    {
      id: 'level',
      title: isPortuguese ? 'Nível Trader' : 'Trader Level',
      value: traderLevel,
      icon: '🎖️',
      color: 'from-purple-400 to-pink-500'
    },
    {
      id: 'total_trades',
      title: isPortuguese ? 'Trades Totais' : 'Total Trades',
      value: stats?.totalTrades || 0,
      icon: '📊',
      color: 'from-blue-400 to-cyan-500'
    },
    {
      id: 'win_rate',
      title: isPortuguese ? 'Taxa de Vitórias' : 'Win Rate',
      value: `${winRate}%`,
      icon: '🎯',
      color: 'from-green-400 to-emerald-500'
    },
    {
      id: 'best_streak',
      title: isPortuguese ? 'Melhor Sequência' : 'Best Streak',
      value: `${bestStreak}x`,
      icon: '🔥',
      color: 'from-red-400 to-orange-500'
    },
    {
      id: 'days_traded',
      title: isPortuguese ? 'Dias de Trading' : 'Days Traded',
      value: daysTraded,
      icon: '📅',
      color: 'from-yellow-400 to-amber-500'
    },
    {
      id: 'total_profit',
      title: isPortuguese ? 'Lucro Total' : 'Total Profit',
      value: totalProfit >= 0 ? `+$${Math.round(totalProfit)}` : `-$${Math.abs(Math.round(totalProfit))}`,
      icon: '💰',
      color: totalProfit >= 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-pink-500'
    }
  ]

  // Progress to next level
  const tradesForNextLevel = (traderLevel * 50) - (stats?.totalTrades || 0)
  const levelProgress = ((stats?.totalTrades || 0) % 50) / 50 * 100

  // Motivational messages
  const getMotivationalMessage = () => {
    if (winRate >= 70) {
      return isPortuguese 
        ? '🌟 Você está arrasando! Continue assim!'
        : '🌟 You\'re crushing it! Keep going!'
    } else if (winRate >= 60) {
      return isPortuguese 
        ? '🚀 Muito bem! Você está no caminho certo!'
        : '🚀 Well done! You\'re on the right track!'
    } else if (winRate >= 50) {
      return isPortuguese 
        ? '💪 Continue praticando! Você vai melhorar!'
        : '💪 Keep practicing! You\'ll improve!'
    } else {
      return isPortuguese 
        ? '🌱 Todo expert já foi iniciante! Continue tentando!'
        : '🌱 Every expert was once a beginner! Keep trying!'
    }
  }


  // Tab navigation
  const tabs = [
    { 
      id: 'journey', 
      label: isPortuguese ? '🗺️ Jornada' : '🗺️ Journey',
      description: isPortuguese ? 'Sua aventura no trading' : 'Your trading adventure'
    },
    { 
      id: 'challenges', 
      label: isPortuguese ? '🎯 Desafios' : '🎯 Challenges',
      description: isPortuguese ? 'Metas diárias divertidas' : 'Fun daily goals'
    },
    { 
      id: 'stats', 
      label: isPortuguese ? '📊 Números' : '📊 Numbers',
      description: isPortuguese ? 'Seus números impressionantes' : 'Your impressive numbers'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Fun Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center text-4xl animate-bounce">
              🏆
            </div>
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
              L{traderLevel}
            </div>
          </div>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
          {isPortuguese ? 'Sua Jornada de Trader' : 'Your Trading Journey'}
        </h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-6">
          {getMotivationalMessage()}
        </p>
        
        {/* Level Progress */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-400">
              {isPortuguese ? 'Nível' : 'Level'} {traderLevel}
            </span>
            <span className="text-sm font-medium text-gray-400">
              {isPortuguese ? 'Próximo' : 'Next'} {traderLevel + 1}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${levelProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500">
            {tradesForNextLevel > 0 
              ? (isPortuguese ? `${tradesForNextLevel} trades para o próximo nível` : `${tradesForNextLevel} trades to next level`)
              : (isPortuguese ? 'Parabéns! Nível máximo alcançado!' : 'Congratulations! Max level reached!')
            }
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">{tab.label}</span>
                <span className="text-xs opacity-75">{tab.description}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Journey Tab - Visual Path */}
      {activeTab === 'journey' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isPortuguese ? '🗺️ Mapa da Jornada' : '🗺️ Journey Map'}
            </h2>
            <p className="text-gray-400">
              {isPortuguese 
                ? 'Cada conquista conta sua história de crescimento!'
                : 'Each achievement tells your growth story!'
              }
            </p>
          </div>

          {/* Journey Path */}
          <div className="relative max-w-4xl mx-auto">
            {journeyMilestones.map((milestone, index) => (
              <div key={milestone.id} className="relative flex items-center mb-8 last:mb-0">
                {/* Connection Line */}
                {index < journeyMilestones.length - 1 && (
                  <div className="absolute left-12 top-20 w-0.5 h-16 bg-gradient-to-b from-gray-600 to-gray-700"></div>
                )}
                
                {/* Milestone Card */}
                <div className={`flex-1 flex items-start gap-6 p-6 rounded-xl border transition-all duration-300 ${
                  milestone.completed 
                    ? `bg-gradient-to-r ${milestone.color} bg-opacity-10 border-current shadow-lg transform hover:scale-105` 
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}>
                  {/* Milestone Icon */}
                  <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${
                    milestone.completed 
                      ? `bg-gradient-to-r ${milestone.color} border-white text-white shadow-lg` 
                      : 'bg-gray-700 border-gray-600 text-gray-400'
                  }`}>
                    {milestone.completed ? milestone.icon : '🔒'}
                  </div>

                  {/* Milestone Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className={`text-xl font-bold ${
                          milestone.completed ? 'text-white' : 'text-gray-400'
                        }`}>
                          {milestone.title}
                        </h3>
                        <p className={`text-sm ${
                          milestone.completed ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {milestone.story}
                        </p>
                      </div>
                      {milestone.completed && (
                        <div className="text-green-400 text-2xl animate-pulse">
                          ✅
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-3">{milestone.requirement}</p>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                        <span>{Math.round(milestone.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            milestone.completed 
                              ? `bg-gradient-to-r ${milestone.color}` 
                              : 'bg-gray-600'
                          }`}
                          style={{ width: `${Math.min(milestone.progress, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Celebration Message */}
                    {milestone.completed && (
                      <div className="p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
                        <p className="text-green-300 text-sm font-medium">
                          {milestone.celebration}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenges Tab - Fun Daily Goals */}
      {activeTab === 'challenges' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isPortuguese ? '🎯 Desafios Diários' : '🎯 Daily Challenges'}
            </h2>
            <p className="text-gray-400">
              {isPortuguese 
                ? 'Pequenas metas diárias para manter você motivado!'
                : 'Small daily goals to keep you motivated!'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dailyChallenges.map((challenge) => (
              <div key={challenge.id} className={`p-6 rounded-xl border transition-all duration-300 hover:scale-105 ${
                challenge.completed 
                  ? 'bg-green-900/20 border-green-500/30 shadow-lg shadow-green-500/20' 
                  : 'bg-gray-800/50 border-gray-700 hover:border-blue-500/50'
              }`}>
                <div className="flex items-start gap-4 mb-4">
                  <div className={`text-3xl p-3 rounded-full ${
                    challenge.completed ? 'bg-green-500/20' : 'bg-gray-700'
                  }`}>
                    {challenge.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{challenge.title}</h3>
                    <p className="text-sm text-gray-400">{challenge.description}</p>
                  </div>
                  {challenge.completed && (
                    <div className="text-green-400 text-xl animate-bounce">
                      ✅
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                    <span>{challenge.progress}/{challenge.target}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        challenge.completed ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min((challenge.progress / challenge.target) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Reward */}
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-300 text-sm font-medium">
                    🎁 {challenge.reward}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Tab - Big Impressive Numbers */}
      {activeTab === 'stats' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isPortuguese ? '📊 Seus Números Impressionantes' : '📊 Your Impressive Numbers'}
            </h2>
            <p className="text-gray-400">
              {isPortuguese 
                ? 'Veja como você está evoluindo com números simples e motivadores!'
                : 'See how you\'re evolving with simple and motivating numbers!'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {funStats.map((stat) => (
              <div key={stat.id} className={`p-8 rounded-xl bg-gradient-to-r ${stat.color} bg-opacity-10 border border-current shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="text-center">
                  <div className="text-4xl mb-4">{stat.icon}</div>
                  <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-lg font-medium text-gray-300">{stat.title}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fun Facts */}
          <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-8 border border-purple-500/30">
            <h3 className="text-xl font-bold text-white mb-6 text-center">
              {isPortuguese ? '🎉 Fatos Divertidos' : '🎉 Fun Facts'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-2">⚡</div>
                <div className="text-2xl font-bold text-yellow-400">{currentStreak}</div>
                <div className="text-sm text-gray-400">
                  {isPortuguese ? 'Sequência Atual' : 'Current Streak'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-2xl font-bold text-green-400">{Math.ceil(traderLevel * 1.5)}</div>
                <div className="text-sm text-gray-400">
                  {isPortuguese ? 'Conquistas Desbloqueadas' : 'Achievements Unlocked'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
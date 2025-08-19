'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// Simple & Fun Journey-focused Conquistas V2
export default function ConquistasV2Analytics() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()
  const [activeTab, setActiveTab] = useState('challenges')

  // Calculate simple trader level based on total trades
  const totalTrades = stats?.totalTrades || 0
  const traderLevel = Math.floor(totalTrades / 50) + 1 // Level up every 50 trades
  const currentLevelTrades = totalTrades % 50
  const tradesForNextLevel = 50 - currentLevelTrades
  const levelProgress = (currentLevelTrades / 50) * 100

  // Simple milestones for the journey
  const journeyMilestones = [
    {
      id: 'first_trade',
      title: isPortuguese ? 'Primeiros Passos' : 'First Steps',
      description: isPortuguese ? 'Fez seu primeiro trade!' : 'Made your first trade!',
      icon: (
        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a4 4 0 004 4h4V5z" />
        </svg>
      ),
      unlocked: totalTrades >= 1,
      celebration: isPortuguese ? 'Parabéns! Você começou sua aventura!' : 'Congratulations! You started your adventure!',
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'first_win',
      title: isPortuguese ? 'Primeira Vitória' : 'First Victory',
      description: isPortuguese ? 'Ganhou seu primeiro trade!' : 'Won your first trade!',
      icon: (
        <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      unlocked: (stats?.winTrades || 0) >= 1,
      celebration: isPortuguese ? 'Que sensação incrível! Você conseguiu!' : 'What an amazing feeling! You did it!',
      color: 'from-yellow-500 to-orange-600'
    },
    {
      id: 'ten_trades',
      title: isPortuguese ? 'Ganhando Experiência' : 'Getting Experience',
      description: isPortuguese ? 'Completou 10 trades!' : 'Completed 10 trades!',
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      unlocked: totalTrades >= 10,
      celebration: isPortuguese ? 'Você está pegando o jeito!' : 'You are getting the hang of it!',
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 'fifty_trades',
      title: isPortuguese ? 'Trader Experiente' : 'Experienced Trader',
      description: isPortuguese ? 'Completou 50 trades!' : 'Completed 50 trades!',
      icon: (
        <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      unlocked: totalTrades >= 50,
      celebration: isPortuguese ? 'Uau! Você já é um trader experiente!' : 'Wow! You are already an experienced trader!',
      color: 'from-purple-500 to-pink-600'
    },
    {
      id: 'hundred_trades',
      title: isPortuguese ? 'Mestre Trader' : 'Master Trader',
      description: isPortuguese ? 'Completou 100 trades!' : 'Completed 100 trades!',
      icon: (
        <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      unlocked: totalTrades >= 100,
      celebration: isPortuguese ? 'Incrível! Você é um verdadeiro mestre!' : 'Amazing! You are a true master!',
      color: 'from-yellow-400 to-yellow-600'
    },
    {
      id: 'win_streak_five',
      title: isPortuguese ? 'Sequência de Ouro' : 'Golden Streak',
      description: isPortuguese ? 'Ganhou 5 trades seguidos!' : 'Won 5 trades in a row!',
      icon: (
        <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ),
      unlocked: false, // We'd need to calculate this from trades array
      celebration: isPortuguese ? 'Você está em chamas!' : 'You are on fire!',
      color: 'from-red-500 to-orange-600'
    }
  ]

  // Simple daily challenges
  const dailyChallenges = [
    {
      id: 'trade_once',
      title: isPortuguese ? 'Faça 1 Trade Hoje' : 'Make 1 Trade Today',
      description: isPortuguese ? 'Simples assim! Apenas trade uma vez.' : 'Simple as that! Just trade once.',
      progress: 0, // Would need to check today's trades
      target: 1,
      reward: '50 XP',
      difficulty: 'easy',
      icon: (
        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    },
    {
      id: 'win_today',
      title: isPortuguese ? 'Ganhe 1 Trade Hoje' : 'Win 1 Trade Today',
      description: isPortuguese ? 'Termine o dia com pelo menos uma vitória!' : 'End the day with at least one win!',
      progress: 0,
      target: 1,
      reward: '100 XP',
      difficulty: 'medium',
      icon: (
        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    },
    {
      id: 'three_wins',
      title: isPortuguese ? 'Triple Vitória' : 'Triple Victory',
      description: isPortuguese ? 'Ganhe 3 trades hoje - você consegue!' : 'Win 3 trades today - you can do it!',
      progress: 0,
      target: 3,
      reward: '200 XP',
      difficulty: 'hard',
      icon: (
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      )
    }
  ]

  // Get motivational message based on performance
  const getMotivationalMessage = () => {
    const winRate = stats?.winRate || 0
    
    if (winRate >= 70) {
      return {
        message: isPortuguese ? 'Você está arrasando! Continue assim!' : 'You\'re crushing it! Keep going!',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        ),
        color: 'text-green-400'
      }
    } else if (winRate >= 50) {
      return {
        message: isPortuguese ? 'Bom trabalho! Você está no caminho certo!' : 'Good job! You\'re on the right track!',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M21 12c0 1.66-4 3-9 3s-9-1.34-9-3m18 0c0-1.66-4-3-9-3s-9 1.34-9 3m18 0v9c0 1.66-4 3-9 3s-9-1.34-9-3v-9" />
          </svg>
        ),
        color: 'text-blue-400'
      }
    } else {
      return {
        message: isPortuguese ? 'Todo especialista já foi iniciante! Continue!' : 'Every expert was once a beginner! Keep going!',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a4 4 0 004 4h4V5z" />
          </svg>
        ),
        color: 'text-yellow-400'
      }
    }
  }

  const motivationalMsg = getMotivationalMessage()

  // Tab navigation
  const tabs = [
    { 
      id: 'challenges', 
      label: isPortuguese ? 'Desafios' : 'Challenges',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    },
    { 
      id: 'journey', 
      label: isPortuguese ? 'Jornada' : 'Journey',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0V7" />
        </svg>
      )
    },
    { 
      id: 'stats', 
      label: isPortuguese ? 'Números' : 'Stats',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/10 border-green-400/30'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
      case 'hard': return 'text-red-400 bg-red-400/10 border-red-400/30'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30'
    }
  }

  return (
    <div className="space-y-8">
      {/* Fun Header with Level */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {traderLevel}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {isPortuguese ? 'Sua Jornada de Trader' : 'Your Trading Journey'}
            </h1>
            <p className={`text-lg font-medium ${motivationalMsg.color} flex items-center gap-2`}>
              {motivationalMsg.icon}
              {motivationalMsg.message}
            </p>
          </div>
        </div>

        {/* Level Progress */}
        <div className="max-w-md mx-auto mt-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{isPortuguese ? 'Nível' : 'Level'} {traderLevel}</span>
            <span>{tradesForNextLevel} {isPortuguese ? 'trades para próximo nível' : 'trades to next level'}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-700 flex items-center justify-center"
              style={{ width: `${levelProgress}%` }}
            >
              {levelProgress > 20 && (
                <span className="text-white text-xs font-bold">{Math.round(levelProgress)}%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-0 focus:shadow-none ${
                activeTab === tab.id
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
              }`}
              style={{ outline: 'none', boxShadow: 'none' }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'journey' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0V7" />
              </svg>
              <h3 className="text-2xl font-bold text-white">
                {isPortuguese ? 'Sua Jornada de Conquistas' : 'Your Achievement Journey'}
              </h3>
            </div>
          </div>
          
          <div className="relative max-w-4xl mx-auto">
            {/* Journey Path */}
            <div className="space-y-8">
              {journeyMilestones.map((milestone, index) => (
                <div key={milestone.id} className="relative">
                  {/* Connection Line */}
                  {index < journeyMilestones.length - 1 && (
                    <div className="absolute left-12 top-24 w-0.5 h-16 bg-gradient-to-b from-purple-500 to-gray-600 z-0"></div>
                  )}
                  
                  {/* Milestone Card */}
                  <div className={`relative flex items-center gap-6 p-6 rounded-2xl transition-all duration-300 ${
                    milestone.unlocked
                      ? `bg-gradient-to-r ${milestone.color}/20 border-2 border-white/20 shadow-lg`
                      : 'bg-gray-800/50 border-2 border-gray-700 opacity-60'
                  }`}>
                    {/* Icon */}
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                      milestone.unlocked
                        ? `bg-gradient-to-r ${milestone.color} shadow-lg transform hover:scale-110 transition-transform`
                        : 'bg-gray-700 grayscale'
                    }`}>
                      <div className={milestone.unlocked ? "animate-bounce" : ""}>
                        {milestone.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-2">{milestone.title}</h3>
                      <p className="text-gray-300 mb-3">{milestone.description}</p>
                      
                      {milestone.unlocked && (
                        <div className="flex items-center gap-2 text-green-400 font-medium">
                          <span>✨</span>
                          {milestone.celebration}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className={`px-4 py-2 rounded-full font-bold ${
                      milestone.unlocked
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {milestone.unlocked 
                        ? (isPortuguese ? 'Conquistado!' : 'Unlocked!')
                        : (isPortuguese ? 'Bloqueado' : 'Locked')
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="text-2xl font-bold text-white">
                {isPortuguese ? 'Desafios Diários' : 'Daily Challenges'}
              </h3>
            </div>
          </div>
          
          <div className="grid gap-6 max-w-4xl mx-auto">
            {dailyChallenges.map((challenge) => (
              <div key={challenge.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{challenge.icon}</div>
                    <div>
                      <h4 className="text-xl font-bold text-white">{challenge.title}</h4>
                      <p className="text-gray-400">{challenge.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty.toUpperCase()}
                    </div>
                    <div className="text-yellow-400 font-bold text-sm">
                      {challenge.reward}
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                    <span>{challenge.progress}/{challenge.target}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-700"
                      style={{ width: `${(challenge.progress / challenge.target) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-2xl font-bold text-white">
                {isPortuguese ? 'Seus Números Incríveis' : 'Your Amazing Numbers'}
              </h3>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Total Trades */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30 text-center">
              <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div className="text-3xl font-bold text-white mb-1">{totalTrades}</div>
              <div className="text-blue-400 text-sm">{isPortuguese ? 'Total de Trades' : 'Total Trades'}</div>
            </div>

            {/* Win Rate */}
            <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-xl p-6 border border-green-500/30 text-center">
              <svg className="w-12 h-12 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <div className="text-3xl font-bold text-white mb-1">{Math.round(stats?.winRate || 0)}%</div>
              <div className="text-green-400 text-sm">{isPortuguese ? 'Taxa de Vitórias' : 'Win Rate'}</div>
            </div>

            {/* Total Wins */}
            <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 rounded-xl p-6 border border-yellow-500/30 text-center">
              <svg className="w-12 h-12 text-yellow-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <div className="text-3xl font-bold text-white mb-1">{stats?.winTrades || 0}</div>
              <div className="text-yellow-400 text-sm">{isPortuguese ? 'Trades Vencedores' : 'Winning Trades'}</div>
            </div>

            {/* Profit */}
            <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 rounded-xl p-6 border border-green-500/30 text-center">
              <svg className="w-12 h-12 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-3xl font-bold text-white mb-1">${Math.round(stats?.totalPnl || 0)}</div>
              <div className="text-green-400 text-sm">{isPortuguese ? 'Lucro Total' : 'Total Profit'}</div>
            </div>
          </div>

          {/* Motivational Big Achievement */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl p-8 border border-purple-500/30 text-center max-w-2xl mx-auto">
            <svg className="w-16 h-16 text-purple-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <h4 className="text-2xl font-bold text-white mb-2">
              {isPortuguese ? 'Sua Maior Conquista' : 'Your Greatest Achievement'}
            </h4>
            <p className="text-lg text-purple-300">
              {totalTrades >= 100 
                ? (isPortuguese ? 'Você completou mais de 100 trades! Incrível!' : 'You completed over 100 trades! Amazing!')
                : totalTrades >= 50
                ? (isPortuguese ? 'Você é um trader experiente com 50+ trades!' : 'You are an experienced trader with 50+ trades!')
                : totalTrades >= 10
                ? (isPortuguese ? 'Você está ganhando experiência rapidamente!' : 'You are gaining experience quickly!')
                : (isPortuguese ? 'Sua jornada está começando - continue assim!' : 'Your journey is beginning - keep it up!')
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
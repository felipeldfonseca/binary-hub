'use client'

import React, { useState } from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ConquistasVersionSelector, { ConquistasVersion } from '@/components/achievements/ConquistasVersionSelector'
import ConquistasV2Analytics from '@/components/achievements/versions/ConquistasV2Analytics'
import ConquistasV3Social from '@/components/achievements/versions/ConquistasV3Social'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'

// Toggle view types for V2/V3 integration
export type ConquistasViewMode = 'personal' | 'community'

export default function AccomplishmentsPage() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()
  const [selectedVersion, setSelectedVersion] = useState<ConquistasVersion>('v2')
  const [viewMode, setViewMode] = useState<ConquistasViewMode>('personal')

  // Professional Trading Accomplishments Data
  const accomplishmentsData = {
    level: {
      current: 7,
      name: isPortuguese ? 'Trader Expert' : 'Expert Trader',
      xp: 2450,
      xpToNext: 3000,
      progress: (2450 / 3000) * 100
    },
    streaks: {
      win: 5,
      current: 5,
      best: 12,
      daily: 7
    },
    badges: {
      total: 12,
      recent: [
        { 
          id: 1, 
          name: isPortuguese ? 'Primeira Vitória' : 'First Victory', 
          description: isPortuguese ? 'Concluiu sua primeira operação lucrativa' : 'Completed your first profitable trade',
          earned: true,
          category: 'milestone'
        },
        { 
          id: 2, 
          name: isPortuguese ? '10 Vitórias' : '10 Wins', 
          description: isPortuguese ? 'Alcançou 10 operações vencedoras' : 'Reached 10 winning trades',
          earned: true,
          category: 'wins'
        },
        { 
          id: 3, 
          name: isPortuguese ? 'Semana Lucrativa' : 'Profitable Week', 
          description: isPortuguese ? 'Fechou a semana no positivo' : 'Closed the week in profit',
          earned: true,
          category: 'profitability'
        },
        { 
          id: 4, 
          name: isPortuguese ? 'Analista Profissional' : 'Professional Analyst', 
          description: isPortuguese ? 'Taxa de acerto acima de 60%' : 'Win rate above 60%',
          earned: true,
          category: 'strategy'
        },
        { 
          id: 5, 
          name: isPortuguese ? 'Mestre do Risco' : 'Risk Master', 
          description: isPortuguese ? 'Gerenciamento de risco exemplar' : 'Exemplary risk management',
          earned: false,
          category: 'risk'
        },
        { 
          id: 6, 
          name: isPortuguese ? 'Lenda Binary' : 'Binary Legend', 
          description: isPortuguese ? 'Status de elite no trading' : 'Elite trading status',
          earned: false,
          category: 'legend'
        }
      ]
    },
    leaderboard: {
      position: 3,
      total: 150,
      competitors: [
        { rank: 1, name: 'TraderPro99', score: 3850, tier: 'Diamond' },
        { rank: 2, name: 'BinaryMaster', score: 3200, tier: 'Platinum' },
        { rank: 3, name: isPortuguese ? 'Você' : 'You', score: 2450, tier: 'Gold' },
        { rank: 4, name: 'CryptoKing', score: 2100, tier: 'Silver' },
        { rank: 5, name: 'ForexNinja', score: 1950, tier: 'Silver' }
      ]
    },
    dailyChallenge: {
      title: isPortuguese ? 'Faça 3 trades lucrativos' : 'Make 3 profitable trades',
      progress: 2,
      target: 3,
      reward: '100 XP',
      timeLeft: '14h 32m'
    },
    achievements: [
      { title: isPortuguese ? 'Série de Vitórias' : 'Win Streak', value: '5 trades', category: 'streak', color: 'from-orange-500 to-red-500' },
      { title: isPortuguese ? 'Taxa de Acerto' : 'Win Rate', value: '60%', category: 'accuracy', color: 'from-green-500 to-emerald-500' },
      { title: isPortuguese ? 'Lucro Total' : 'Total Profit', value: '$34.00', category: 'profit', color: 'from-yellow-500 to-amber-500' },
      { title: isPortuguese ? 'Nível Atual' : 'Current Level', value: 'Expert', category: 'level', color: 'from-purple-500 to-pink-500' }
    ]
  }

  // Calculate win rate for progress rings
  const winRate = stats ? (stats.winTrades / stats.totalTrades) * 100 : 60
  const profitGoal = 100 // Monthly goal in dollars
  const currentProfit = stats?.totalPnl || 34
  const profitProgress = Math.min((Math.abs(currentProfit) / profitGoal) * 100, 100)

  // Get badge icon based on category
  const getBadgeIcon = (category: string) => {
    switch (category) {
      case 'milestone':
        return (
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'wins':
        return (
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'profitability':
        return (
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'strategy':
        return (
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      case 'risk':
        return (
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      case 'legend':
        return (
          <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  // Get achievement icon based on category
  const getAchievementIcon = (category: string) => {
    switch (category) {
      case 'streak':
        return (
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'accuracy':
        return (
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )
      case 'profit':
        return (
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'level':
        return (
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  // Get tier icon
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Diamond':
        return (
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      case 'Platinum':
        return (
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      case 'Gold':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      case 'Silver':
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )
    }
  }

  // Elegant toggle component for Personal vs Community views
  const renderViewModeToggle = () => (
    <div className="flex justify-center mb-8">
      <div className="bg-gray-800/50 p-2 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
        <div className="flex">
          <button
            onClick={() => setViewMode('personal')}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 font-medium focus:outline-none focus:ring-0 focus:shadow-none ${
              viewMode === 'personal'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
            style={{ outline: 'none', boxShadow: 'none' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {isPortuguese ? 'Pessoal' : 'Personal'}
          </button>
          <button
            onClick={() => setViewMode('community')}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 font-medium focus:outline-none focus:ring-0 focus:shadow-none ${
              viewMode === 'community'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
            style={{ outline: 'none', boxShadow: 'none' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {isPortuguese ? 'Comunidade' : 'Community'}
          </button>
        </div>
      </div>
    </div>
  )

  // Function to render the selected version content
  const renderVersionContent = () => {
    // For V2 and V3, we now use the toggle system
    if (selectedVersion === 'v2' || selectedVersion === 'v3') {
      return (
        <div>
          {renderViewModeToggle()}
          {viewMode === 'personal' ? <ConquistasV2Analytics /> : <ConquistasV3Social />}
        </div>
      )
    }
    
    // V1 keeps the original version selector
    switch (selectedVersion) {
      case 'v1':
        return renderV1Content()
      default:
        return renderV1Content()
    }
  }

  // V1 Content (original implementation)
  const renderV1Content = () => (
    <div className="space-y-16">
      {/* Header Section */}
      <section className="py-16">
      <div className="container mx-auto px-4 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <svg className="w-12 h-12 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h1 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] bg-clip-text text-transparent">
              {isPortuguese ? 'Conquistas' : 'Accomplishments'}
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            {isPortuguese 
              ? 'Acompanhe seu progresso, conquiste marcos importantes e compete com outros traders em uma jornada rumo à excelência.'
              : 'Track your progress, achieve important milestones, and compete with other traders on a journey towards excellence.'
            }
          </p>
        </div>
      </div>
    </section>
      
      {/* Level & XP Section */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Level & XP Card */}
              <div className="card bg-gradient-to-br from-purple-800/30 to-pink-800/30 border-purple-400/30">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <div>
                      <h3 className="font-heading text-2xl font-bold text-purple-300">
                        {isPortuguese ? 'Nível' : 'Level'} {accomplishmentsData.level.current}
                      </h3>
                      <p className="text-purple-400">{accomplishmentsData.level.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{accomplishmentsData.level.xp.toLocaleString()} XP</p>
                    <p className="text-sm text-purple-400">
                      {(accomplishmentsData.level.xpToNext - accomplishmentsData.level.xp).toLocaleString()} {isPortuguese ? 'para próximo' : 'to next'}
                    </p>
                  </div>
                </div>
                
                {/* XP Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-purple-300 mb-2">
                    <span>{accomplishmentsData.level.name}</span>
                    <span>{isPortuguese ? 'Próximo Nível' : 'Next Level'}</span>
                  </div>
                  <div className="w-full bg-purple-900/50 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${accomplishmentsData.level.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-center mt-2 text-sm text-purple-300">
                    {accomplishmentsData.level.progress.toFixed(1)}% {isPortuguese ? 'completo' : 'complete'}
                  </div>
                </div>
              </div>

              {/* Streak Tracker */}
              <div className="card bg-gradient-to-br from-orange-800/30 to-red-800/30 border-orange-400/30">
                <div className="text-center">
                  <svg className="w-16 h-16 text-orange-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="font-heading text-2xl font-bold text-orange-300 mb-2">
                    {isPortuguese ? 'Série de Vitórias' : 'Win Streak'}
                  </h3>
                  <div className="text-4xl font-bold text-white mb-2">
                    {accomplishmentsData.streaks.win}
                  </div>
                  <p className="text-orange-400 mb-4">
                    {isPortuguese ? 'trades consecutivos' : 'consecutive trades'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-orange-900/30 rounded-lg p-3">
                      <div className="text-lg font-bold text-white">{accomplishmentsData.streaks.best}</div>
                      <div className="text-xs text-orange-300">{isPortuguese ? 'Melhor Série' : 'Best Streak'}</div>
                    </div>
                    <div className="bg-orange-900/30 rounded-lg p-3">
                      <div className="text-lg font-bold text-white">{accomplishmentsData.streaks.daily}</div>
                      <div className="text-xs text-orange-300">{isPortuguese ? 'Dias Ativos' : 'Active Days'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Achievement Metrics */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {isPortuguese ? 'Conquistas Recentes' : 'Recent Achievements'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {accomplishmentsData.achievements.map((achievement, index) => (
                <div key={index} className={`card bg-gradient-to-br ${achievement.color}/20 border-white/10 hover:scale-105 transition-all duration-300`}>
                  <div className="text-center">
                    <div className="mb-3 flex justify-center">{getAchievementIcon(achievement.category)}</div>
                    <h3 className="font-heading text-lg font-bold mb-2">{achievement.title}</h3>
                    <div className="text-2xl font-bold text-white">{achievement.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Progress Rings & Daily Challenge */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Progress Rings */}
              <div className="card">
                <h3 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
                  <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {isPortuguese ? 'Metas de Progresso' : 'Progress Goals'}
                </h3>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* Win Rate Ring */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${winRate * 2.83} 283`}
                          className="text-green-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-green-400">{Math.round(winRate)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}</p>
                  </div>
                  
                  {/* Profit Goal Ring */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${profitProgress * 2.83} 283`}
                          className="text-yellow-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-yellow-400">{Math.round(profitProgress)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{isPortuguese ? 'Meta Mensal' : 'Monthly Goal'}</p>
                  </div>
                </div>
              </div>

              {/* Daily Challenge */}
              <div className="card bg-gradient-to-br from-blue-800/30 to-cyan-800/30 border-blue-400/30">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-heading text-2xl font-bold text-blue-300">
                    {isPortuguese ? 'Desafio Diário' : 'Daily Challenge'}
                  </h3>
                </div>
                
                <div className="mb-4">
                  <p className="text-lg text-white mb-2">{accomplishmentsData.dailyChallenge.title}</p>
                  <div className="flex items-center gap-2 text-blue-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{accomplishmentsData.dailyChallenge.timeLeft} {isPortuguese ? 'restantes' : 'left'}</span>
                  </div>
                </div>
                
                {/* Challenge Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-blue-300 mb-2">
                    <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                    <span>{accomplishmentsData.dailyChallenge.progress}/{accomplishmentsData.dailyChallenge.target}</span>
                  </div>
                  <div className="w-full bg-blue-900/50 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-700"
                      style={{ width: `${(accomplishmentsData.dailyChallenge.progress / accomplishmentsData.dailyChallenge.target) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="bg-blue-900/30 rounded-lg p-3 text-center">
                  <div className="text-sm text-blue-300 mb-1">{isPortuguese ? 'Recompensa' : 'Reward'}</div>
                  <div className="text-lg font-bold text-white">{accomplishmentsData.dailyChallenge.reward}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges & Achievements */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {isPortuguese ? 'Coleção de Conquistas' : 'Achievement Collection'}
              </h2>
              <p className="text-gray-400">
                {accomplishmentsData.badges.total} {isPortuguese ? 'conquistas desbloqueadas' : 'achievements unlocked'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accomplishmentsData.badges.recent.map((badge) => (
                <div key={badge.id} className={`card transition-all duration-300 hover:scale-105 ${
                  badge.earned 
                    ? 'bg-gradient-to-br from-yellow-800/30 to-amber-800/30 border-yellow-400/30' 
                    : 'bg-gray-800/30 border-gray-600/30 opacity-50'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 ${badge.earned ? '' : 'grayscale opacity-50'}`}>
                      {getBadgeIcon(badge.category)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{badge.name}</h4>
                      <p className="text-sm text-gray-400 mb-2">{badge.description}</p>
                      {badge.earned && (
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {isPortuguese ? 'Conquistado' : 'Achieved'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {isPortuguese ? 'Ranking de Traders' : 'Trader Leaderboard'}
              </h2>
              <p className="text-gray-400">
                {isPortuguese ? 'Você está em' : 'You are ranked'} #{accomplishmentsData.leaderboard.position} {isPortuguese ? 'de' : 'of'} {accomplishmentsData.leaderboard.total}
              </p>
            </div>
            
            <div className="card">
              <div className="space-y-4">
                {accomplishmentsData.leaderboard.competitors.map((competitor, index) => (
                  <div key={competitor.rank} className={`flex items-center justify-between p-4 rounded-lg transition-all duration-300 ${
                    competitor.rank === 3 
                      ? 'bg-gradient-to-r from-purple-800/30 to-pink-800/30 border border-purple-400/30' 
                      : 'bg-gray-800/30 hover:bg-gray-700/30'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl font-bold w-8 text-center ${
                        competitor.rank === 1 ? 'text-yellow-400' :
                        competitor.rank === 2 ? 'text-gray-300' :
                        competitor.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {competitor.rank <= 3 ? (
                          <svg className={`w-6 h-6 mx-auto ${
                            competitor.rank === 1 ? 'text-yellow-400' :
                            competitor.rank === 2 ? 'text-gray-300' :
                            'text-amber-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        ) : (
                          `#${competitor.rank}`
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getTierIcon(competitor.tier)}
                        <div>
                          <div className={`font-bold ${competitor.rank === 3 ? 'text-purple-300' : 'text-white'}`}>
                            {competitor.name}
                          </div>
                          <div className="text-sm text-gray-400 flex items-center gap-1">
                            <span>{competitor.score.toLocaleString()} XP</span>
                            <span>•</span>
                            <span>{competitor.tier}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {competitor.rank === 3 && (
                      <div className="text-purple-300 font-bold animate-pulse">
                        {isPortuguese ? 'Você!' : 'That\'s You!'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Summary */}
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="card bg-gradient-to-r from-purple-800/20 to-pink-800/20 border-purple-400/20 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="font-heading text-xl font-bold">
                {isPortuguese ? 'Sistema de Conquistas Profissional' : 'Professional Achievement System'}
              </h3>
            </div>
            <p className="text-gray-400 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'Transforme sua jornada de trading em uma experiência envolvente e motivadora. Ganhe XP, desbloqueie conquistas e compete com outros traders enquanto desenvolve suas habilidades profissionais.'
                : 'Transform your trading journey into an engaging and motivating experience. Earn XP, unlock achievements, and compete with other traders while developing your professional skills.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Sistema de Níveis XP' : 'XP Level System'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Conquistas Profissionais' : 'Professional Achievements'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Série de Vitórias' : 'Win Streaks'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Desafios Diários' : 'Daily Challenges'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Ranking Competitivo' : 'Competitive Ranking'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto">
              {/* Only show version selector for V1, V2 and V3 now use the integrated toggle */}
              {selectedVersion === 'v1' && (
                <ConquistasVersionSelector 
                  currentVersion={selectedVersion}
                  onVersionChange={setSelectedVersion}
                />
              )}
              
              
              {renderVersionContent()}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}
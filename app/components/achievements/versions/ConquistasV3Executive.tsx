'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// Social Community-focused Conquistas V3
export default function ConquistasV3Executive() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()
  const [activeTab, setActiveTab] = useState('community')

  // Mock data for social features (in real app, would come from API)
  const communityData = {
    userRank: 347,
    totalUsers: 2847,
    percentile: 88,
    tier: 'Gold',
    region: isPortuguese ? 'Brasil' : 'Brazil'
  }

  // Mock friends data
  const friends = [
    {
      id: 1,
      name: 'João Silva',
      avatar: (
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      winRate: 65,
      weeklyProfit: 45,
      currentStreak: 3,
      isOnline: true,
      level: 'Silver'
    },
    {
      id: 2,
      name: 'Maria Santos',
      avatar: (
        <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      winRate: 58,
      weeklyProfit: 23,
      currentStreak: 1,
      isOnline: false,
      level: 'Bronze'
    },
    {
      id: 3,
      name: 'Pedro Costa',
      avatar: (
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      winRate: 72,
      weeklyProfit: 89,
      currentStreak: 7,
      isOnline: true,
      level: 'Gold'
    }
  ]

  // Mock group challenges
  const groupChallenges = [
    {
      id: 1,
      title: isPortuguese ? 'Desafio da Comunidade' : 'Community Challenge',
      description: isPortuguese ? 'Ganhem 500 trades juntos esta semana!' : 'Win 500 trades together this week!',
      progress: 347,
      target: 500,
      participants: 156,
      timeLeft: '2d 14h',
      reward: isPortuguese ? 'Emblema Especial + 1000 XP' : 'Special Badge + 1000 XP',
      difficulty: 'medium'
    },
    {
      id: 2,
      title: isPortuguese ? 'Maratona de Fim de Semana' : 'Weekend Marathon',
      description: isPortuguese ? 'Façam 200 trades no fim de semana!' : 'Make 200 trades over the weekend!',
      progress: 89,
      target: 200,
      participants: 67,
      timeLeft: '5h 23m',
      reward: isPortuguese ? 'Título: Guerreiro do Fim de Semana' : 'Title: Weekend Warrior',
      difficulty: 'hard'
    }
  ]

  // Mock trending traders
  const trendingTraders = [
    { name: 'Carlos_Pro', region: 'SP', winRate: 78, badge: (
        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ), tier: 'Platinum' },
    { name: 'TradingQueen', region: 'RJ', winRate: 76, badge: (
        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ), tier: 'Gold' },
    { name: 'BinaryMaster', region: 'MG', winRate: 74, badge: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ), tier: 'Gold' },
    { name: 'LuckyTrader', region: 'RS', winRate: 73, badge: (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ), tier: 'Gold' }
  ]

  // Social achievements
  const socialAchievements = [
    {
      id: 'community_top10',
      title: isPortuguese ? 'Top 10 da Região' : 'Regional Top 10',
      description: isPortuguese ? 'Ficou entre os 10 melhores do Brasil!' : 'Ranked in top 10 in Brazil!',
      icon: (
        <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      rarity: 'Epic',
      unlocked: false,
      progress: 347,
      target: 10
    },
    {
      id: 'friend_challenger',
      title: isPortuguese ? 'Desafiador de Amigos' : 'Friend Challenger',
      description: isPortuguese ? 'Venceu 10 comparações com amigos!' : 'Won 10 comparisons with friends!',
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m13 0h-8m-8-9l3 3-3 3m13 0h-8" />
        </svg>
      ),
      rarity: 'Rare',
      unlocked: true,
      progress: 10,
      target: 10
    },
    {
      id: 'group_hero',
      title: isPortuguese ? 'Herói do Grupo' : 'Group Hero',
      description: isPortuguese ? 'Completou 5 desafios em grupo!' : 'Completed 5 group challenges!',
      icon: (
        <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      rarity: 'Legendary',
      unlocked: false,
      progress: 2,
      target: 5
    }
  ]

  // Helper functions
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze': return 'text-amber-600'
      case 'Silver': return 'text-gray-400'
      case 'Gold': return 'text-yellow-400'
      case 'Platinum': return 'text-cyan-400'
      case 'Diamond': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
      case 'Rare': return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
      case 'Epic': return 'text-purple-400 border-purple-400/30 bg-purple-400/10'
      case 'Legendary': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
      default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
    }
  }

  const tabs = [
    { 
      id: 'community', 
      label: isPortuguese ? 'Comunidade' : 'Community',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'friends', 
      label: isPortuguese ? 'Amigos' : 'Friends',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    { 
      id: 'challenges', 
      label: isPortuguese ? 'Desafios' : 'Challenges',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    },
    { 
      id: 'achievements', 
      label: isPortuguese ? 'Conquistas' : 'Achievements',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    }
  ]

  return (
    <div className="space-y-8">
      {/* Social Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="relative">
            <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="absolute -top-1 -right-1 bg-green-500 w-4 h-4 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {isPortuguese ? 'Comunidade de Traders' : 'Trading Community'}
            </h1>
            <p className="text-lg text-gray-400">
              {isPortuguese ? 'Conecte-se, compete e cresça junto!' : 'Connect, compete, and grow together!'}
            </p>
          </div>
        </div>

        {/* User Community Status */}
        <div className="max-w-md mx-auto bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">#{communityData.userRank}</div>
              <div className="text-sm text-blue-400">{isPortuguese ? 'Ranking' : 'Rank'}</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getTierColor(communityData.tier)}`}>{communityData.tier}</div>
              <div className="text-sm text-gray-400">{isPortuguese ? 'Nível' : 'Tier'}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{communityData.percentile}%</div>
              <div className="text-sm text-purple-400">{isPortuguese ? 'Melhor que' : 'Better than'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex justify-center space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'community' && (
        <div className="space-y-8">
          {/* Trending Traders */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              {isPortuguese ? 'Traders em Destaque' : 'Trending Traders'}
            </h3>
            
            <div className="grid gap-4">
              {trendingTraders.map((trader, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-blue-500/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1">{trader.badge}</div>
                      <div>
                        <div className="font-bold text-white">{trader.name}</div>
                        <div className="text-sm text-gray-400">{trader.region} • {trader.tier}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-400">{trader.winRate}%</div>
                      <div className="text-sm text-gray-400">{isPortuguese ? 'Taxa de Vitória' : 'Win Rate'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Community Stats */}
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-xl p-6 border border-green-500/30">
            <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {isPortuguese ? 'Estatísticas da Comunidade' : 'Community Stats'}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{communityData.totalUsers.toLocaleString()}</div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Traders Ativos' : 'Active Traders'}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">67%</div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Taxa Média' : 'Average Win Rate'}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">$1,247</div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Lucro Médio' : 'Average Profit'}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">23</div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Desafios Ativos' : 'Active Challenges'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'friends' && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            {isPortuguese ? 'Seus Amigos Traders' : 'Your Trading Friends'}
          </h3>
          
          <div className="grid gap-4">
            {friends.map((friend) => (
              <div key={friend.id} className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative p-2 bg-gray-700/50 rounded-full">
                      {friend.avatar}
                      {friend.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{friend.name}</h4>
                      <div className={`text-sm ${getTierColor(friend.level)}`}>{friend.level}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">
                      {friend.isOnline 
                        ? (isPortuguese ? 'Online agora' : 'Online now')
                        : (isPortuguese ? 'Offline' : 'Offline')
                      }
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-white">{friend.winRate}%</div>
                    <div className="text-xs text-gray-400">{isPortuguese ? 'Taxa de Vitória' : 'Win Rate'}</div>
                    <div className={`text-xs ${friend.winRate > (stats?.winRate || 0) ? 'text-red-400' : 'text-green-400'}`}>
                      {friend.winRate > (stats?.winRate || 0) 
                        ? `+${(friend.winRate - (stats?.winRate || 0)).toFixed(1)}% ${isPortuguese ? 'melhor' : 'better'}`
                        : `${(friend.winRate - (stats?.winRate || 0)).toFixed(1)}% ${isPortuguese ? 'pior' : 'worse'}`
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">${friend.weeklyProfit}</div>
                    <div className="text-xs text-gray-400">{isPortuguese ? 'Lucro Semanal' : 'Weekly Profit'}</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{friend.currentStreak}</div>
                    <div className="text-xs text-gray-400">{isPortuguese ? 'Sequência' : 'Streak'}</div>
                    {friend.currentStreak >= 5 && (
                      <div className="text-xs text-orange-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 716.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                        {isPortuguese ? 'Em chamas!' : 'On fire!'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center p-8 bg-gray-800/30 rounded-lg border border-gray-600">
            <svg className="w-12 h-12 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <h4 className="text-lg font-bold text-white mb-2">
              {isPortuguese ? 'Convide Amigos!' : 'Invite Friends!'}
            </h4>
            <p className="text-gray-400 text-sm">
              {isPortuguese ? 'Trading é mais divertido com amigos. Convide outros traders para competir!' : 'Trading is more fun with friends. Invite other traders to compete!'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {isPortuguese ? 'Desafios em Grupo' : 'Group Challenges'}
          </h3>
          
          <div className="grid gap-6">
            {groupChallenges.map((challenge) => (
              <div key={challenge.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{challenge.title}</h4>
                    <p className="text-gray-400 mb-2">{challenge.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        {challenge.participants} {isPortuguese ? 'participantes' : 'participants'}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {challenge.timeLeft} {isPortuguese ? 'restantes' : 'left'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="mb-2">
                      <svg className="w-8 h-8 text-yellow-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div className="text-sm text-yellow-400 font-medium">{challenge.reward}</div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>{isPortuguese ? 'Progresso da Comunidade' : 'Community Progress'}</span>
                    <span>{challenge.progress}/{challenge.target}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-700 flex items-center justify-center"
                      style={{ width: `${(challenge.progress / challenge.target) * 100}%` }}
                    >
                      <span className="text-white text-xs font-bold">
                        {Math.round((challenge.progress / challenge.target) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    {isPortuguese ? 'Sua contribuição: 5 trades' : 'Your contribution: 5 trades'}
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium transition-colors">
                    {isPortuguese ? 'Participar' : 'Join Challenge'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            {isPortuguese ? 'Conquistas Sociais' : 'Social Achievements'}
          </h3>
          
          <div className="grid gap-6">
            {socialAchievements.map((achievement) => (
              <div key={achievement.id} className={`rounded-xl p-6 border transition-all duration-300 ${
                achievement.unlocked
                  ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/30'
                  : 'bg-gray-800/50 border-gray-700 opacity-75'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={achievement.unlocked ? '' : 'grayscale opacity-50'}>
                      {achievement.icon}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-1">{achievement.title}</h4>
                      <p className="text-gray-400 mb-2">{achievement.description}</p>
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getRarityColor(achievement.rarity)}`}>
                    {achievement.rarity.toUpperCase()}
                  </div>
                </div>
                
                {!achievement.unlocked && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                      <span>{achievement.progress}/{achievement.target}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {achievement.unlocked && (
                  <div className="flex items-center gap-2 text-green-400 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isPortuguese ? 'Conquistado!' : 'Achieved!'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
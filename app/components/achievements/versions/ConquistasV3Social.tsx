'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// TypeScript interfaces for social features
interface CommunityRank {
  position: number
  total: number
  percentile: number
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
}

interface Friend {
  id: string
  name: string
  avatar?: string
  winRate: number
  weeklyProfit: number
  streak: number
  isOnline: boolean
  lastActive: string
}

interface GroupChallenge {
  id: string
  title: string
  description: string
  goal: number
  currentProgress: number
  participants: number
  timeLeft: string
  reward: string
  isJoined: boolean
  difficulty: 'Easy' | 'Medium' | 'Hard'
}

interface SocialAchievement {
  id: string
  title: string
  description: string
  icon: string
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  unlockedBy: number // number of people who have this
  earnedAt?: string
}

interface TrendingTrader {
  name: string
  profit: number
  winRate: number
  streak: number
  region: string
  trend: 'up' | 'down' | 'stable'
}

// Social Community-focused Conquistas V3
export default function ConquistasV3Social() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()
  const [activeTab, setActiveTab] = useState<'community' | 'friends' | 'challenges' | 'achievements'>('community')

  // Mock social data (in real app, this would come from backend)
  const communityRank: CommunityRank = {
    position: 347,
    total: 2847,
    percentile: 88,
    tier: 'Silver'
  }

  const friends: Friend[] = [
    {
      id: '1',
      name: 'João Silva',
      winRate: 72,
      weeklyProfit: 45.30,
      streak: 8,
      isOnline: true,
      lastActive: '2 min'
    },
    {
      id: '2', 
      name: 'Maria Santos',
      winRate: 68,
      weeklyProfit: 38.50,
      streak: 12,
      isOnline: false,
      lastActive: '1h'
    },
    {
      id: '3',
      name: 'Pedro Costa',
      winRate: 59,
      weeklyProfit: -12.40,
      streak: 0,
      isOnline: true,
      lastActive: 'agora'
    },
    {
      id: '4',
      name: 'Ana Oliveira',
      winRate: 81,
      weeklyProfit: 67.80,
      streak: 15,
      isOnline: false,
      lastActive: '3h'
    }
  ]

  const groupChallenges: GroupChallenge[] = [
    {
      id: '1',
      title: isPortuguese ? 'Dominadores da Semana' : 'Week Dominators',
      description: isPortuguese ? 'Ganhe 100 trades como comunidade esta semana' : 'Win 100 trades as a community this week',
      goal: 100,
      currentProgress: 73,
      participants: 156,
      timeLeft: '2d 14h',
      reward: '500 XP + Badge Especial',
      isJoined: true,
      difficulty: 'Medium'
    },
    {
      id: '2',
      title: isPortuguese ? 'Mega Lucro Coletivo' : 'Mega Collective Profit',
      description: isPortuguese ? 'Alcance $5.000 de lucro coletivo no mês' : 'Reach $5,000 collective profit this month',
      goal: 5000,
      currentProgress: 3247,
      participants: 89,
      timeLeft: '12d 6h',
      reward: '1000 XP + Título Exclusivo',
      isJoined: false,
      difficulty: 'Hard'
    },
    {
      id: '3',
      title: isPortuguese ? 'Novatos Unidos' : 'Newbies United',
      description: isPortuguese ? 'Ajude novos traders a fazer 50 trades lucrativos' : 'Help new traders make 50 profitable trades',
      goal: 50,
      currentProgress: 32,
      participants: 67,
      timeLeft: '4d 18h',
      reward: '300 XP + Badge Mentor',
      isJoined: true,
      difficulty: 'Easy'
    }
  ]

  const socialAchievements: SocialAchievement[] = [
    {
      id: '1',
      title: isPortuguese ? 'Influenciador da Comunidade' : 'Community Influencer',
      description: isPortuguese ? 'Suas estratégias inspiraram 50+ traders' : 'Your strategies inspired 50+ traders',
      icon: '👑',
      rarity: 'Epic',
      unlockedBy: 23,
      earnedAt: '2025-01-15'
    },
    {
      id: '2',
      title: isPortuguese ? 'Mentor dos Champions' : 'Champion Mentor',
      description: isPortuguese ? 'Ajudou 10 amigos a melhorar suas taxas de acerto' : 'Helped 10 friends improve their win rates',
      icon: '🏆',
      rarity: 'Legendary',
      unlockedBy: 7,
      earnedAt: '2025-01-20'
    },
    {
      id: '3',
      title: isPortuguese ? 'Quebra-Recordes Regional' : 'Regional Record Breaker',
      description: isPortuguese ? 'Top 10 na sua região esta semana' : 'Top 10 in your region this week',
      icon: '🚀',
      rarity: 'Rare',
      unlockedBy: 134,
      earnedAt: '2025-01-22'
    }
  ]

  const trendingTraders: TrendingTrader[] = [
    { name: 'CriptoKing_BR', profit: 234.50, winRate: 89, streak: 23, region: 'São Paulo', trend: 'up' },
    { name: 'TradeMaster2025', profit: 198.30, winRate: 84, streak: 18, region: 'Rio de Janeiro', trend: 'up' },
    { name: 'BinaryNinja', profit: 167.80, winRate: 76, streak: 15, region: 'Minas Gerais', trend: 'stable' },
    { name: 'ForexLegend', profit: 145.60, winRate: 82, streak: 12, region: 'Bahia', trend: 'down' }
  ]

  // Helper functions
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze': return 'text-amber-600 bg-amber-100/10 border-amber-400/30'
      case 'Silver': return 'text-gray-300 bg-gray-100/10 border-gray-400/30'
      case 'Gold': return 'text-yellow-400 bg-yellow-100/10 border-yellow-400/30'
      case 'Platinum': return 'text-blue-300 bg-blue-100/10 border-blue-400/30'
      case 'Diamond': return 'text-cyan-400 bg-cyan-100/10 border-cyan-400/30'
      default: return 'text-gray-400 bg-gray-100/10 border-gray-400/30'
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-400 bg-gray-500/20'
      case 'Rare': return 'text-blue-400 bg-blue-500/20'
      case 'Epic': return 'text-purple-400 bg-purple-500/20'
      case 'Legendary': return 'text-yellow-400 bg-gradient-to-r from-yellow-500/20 to-orange-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-400 bg-green-500/20'
      case 'Medium': return 'text-yellow-400 bg-yellow-500/20'
      case 'Hard': return 'text-red-400 bg-red-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header - Social Theme */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <svg className="w-12 h-12 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h1 className="text-4xl font-bold text-white">
            {isPortuguese ? 'Comunidade de Traders' : 'Trading Community'}
          </h1>
        </div>
        <p className="text-slate-400 max-w-3xl mx-auto">
          {isPortuguese 
            ? 'Conecte-se com outros traders, participe de desafios em grupo e veja como você se compara à comunidade!'
            : 'Connect with other traders, join group challenges, and see how you compare to the community!'
          }
        </p>
      </div>

      {/* Quick Social Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-xl p-6 border border-pink-400/30">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-pink-300 font-medium">{isPortuguese ? 'Seu Ranking' : 'Your Rank'}</span>
          </div>
          <div className="text-3xl font-bold text-white">#{communityRank.position}</div>
          <div className="text-sm text-pink-300">
            {isPortuguese ? `Melhor que ${communityRank.percentile}% dos traders` : `Better than ${communityRank.percentile}% of traders`}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-6 border border-blue-400/30">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-.5a2.121 2.121 0 013 3L9 19l-4 1 1-4 11.5-11.5z" />
            </svg>
            <span className="text-blue-300 font-medium">{isPortuguese ? 'Amigos' : 'Friends'}</span>
          </div>
          <div className="text-3xl font-bold text-white">{friends.length}</div>
          <div className="text-sm text-blue-300">
            {friends.filter(f => f.isOnline).length} {isPortuguese ? 'online agora' : 'online now'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-6 border border-orange-400/30">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-orange-300 font-medium">{isPortuguese ? 'Desafios Ativos' : 'Active Challenges'}</span>
          </div>
          <div className="text-3xl font-bold text-white">{groupChallenges.filter(c => c.isJoined).length}</div>
          <div className="text-sm text-orange-300">
            {isPortuguese ? 'participando' : 'participating'}
          </div>
        </div>

        <div className={`rounded-xl p-6 border ${getTierColor(communityRank.tier)}`}>
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="font-medium">{isPortuguese ? 'Nível' : 'Tier'}</span>
          </div>
          <div className="text-3xl font-bold text-white">{communityRank.tier}</div>
          <div className="text-sm opacity-80">
            {isPortuguese ? 'Sua classificação' : 'Your classification'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'community', label: isPortuguese ? 'Comunidade' : 'Community', icon: '👥' },
            { id: 'friends', label: isPortuguese ? 'Amigos' : 'Friends', icon: '👫' },
            { id: 'challenges', label: isPortuguese ? 'Desafios' : 'Challenges', icon: '🏆' },
            { id: 'achievements', label: isPortuguese ? 'Conquistas' : 'Achievements', icon: '🎖️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-pink-400 text-pink-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'community' && (
          <div className="space-y-8">
            {/* Community Leaderboard */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                {isPortuguese ? 'Traders em Destaque Esta Semana' : 'Trending Traders This Week'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {trendingTraders.map((trader, index) => (
                  <div key={trader.name} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`text-lg font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        #{index + 1}
                      </div>
                      <div className={`flex items-center gap-1 text-sm ${
                        trader.trend === 'up' ? 'text-green-400' :
                        trader.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {trader.trend === 'up' ? '↗️' : trader.trend === 'down' ? '↘️' : '➡️'}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-white mb-2">{trader.name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="text-green-400">💰 ${trader.profit.toFixed(2)}</div>
                      <div className="text-blue-400">🎯 {trader.winRate}% {isPortuguese ? 'acertos' : 'wins'}</div>
                      <div className="text-orange-400">🔥 {trader.streak} {isPortuguese ? 'seguidos' : 'streak'}</div>
                      <div className="text-slate-400">📍 {trader.region}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Your Community Position */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-2xl">📊</span>
                {isPortuguese ? 'Sua Posição na Comunidade' : 'Your Community Position'}
              </h2>

              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-8 border border-purple-400/30">
                <div className="text-center">
                  <div className="text-6xl font-bold text-white mb-2">#{communityRank.position}</div>
                  <div className="text-xl text-purple-300 mb-4">
                    {isPortuguese ? `de ${communityRank.total.toLocaleString()} traders` : `of ${communityRank.total.toLocaleString()} traders`}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-2xl mb-2">🏅</div>
                      <div className="text-lg font-bold text-white">{communityRank.percentile}%</div>
                      <div className="text-sm text-purple-300">
                        {isPortuguese ? 'Melhor que outros traders' : 'Better than other traders'}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-2xl mb-2">⭐</div>
                      <div className="text-lg font-bold text-white">{communityRank.tier}</div>
                      <div className="text-sm text-purple-300">
                        {isPortuguese ? 'Seu nível atual' : 'Your current tier'}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-2xl mb-2">🚀</div>
                      <div className="text-lg font-bold text-white">
                        {communityRank.tier === 'Diamond' ? 'MAX' : 
                         communityRank.tier === 'Platinum' ? 'Diamond' :
                         communityRank.tier === 'Gold' ? 'Platinum' :
                         communityRank.tier === 'Silver' ? 'Gold' : 'Silver'}
                      </div>
                      <div className="text-sm text-purple-300">
                        {isPortuguese ? 'Próximo nível' : 'Next tier'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-2xl">👫</span>
                {isPortuguese ? 'Seus Amigos Traders' : 'Your Trading Friends'}
              </h2>
              <button className="bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 px-4 py-2 rounded-lg transition-colors border border-pink-400/30">
                <span className="text-sm">➕ {isPortuguese ? 'Adicionar Amigo' : 'Add Friend'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {friends.map((friend) => (
                <div key={friend.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                          {friend.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        {friend.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-slate-900 rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{friend.name}</h3>
                        <p className="text-sm text-slate-400">
                          {friend.isOnline ? 
                            (isPortuguese ? `Online • ${friend.lastActive}` : `Online • ${friend.lastActive}`) :
                            (isPortuguese ? `Visto ${friend.lastActive}` : `Seen ${friend.lastActive}`)
                          }
                        </p>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-500/20 rounded-lg p-3">
                      <div className="text-lg font-bold text-blue-400">{friend.winRate}%</div>
                      <div className="text-xs text-blue-300">{isPortuguese ? 'Taxa' : 'Win Rate'}</div>
                    </div>
                    <div className={`rounded-lg p-3 ${friend.weeklyProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <div className={`text-lg font-bold ${friend.weeklyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${Math.abs(friend.weeklyProfit).toFixed(2)}
                      </div>
                      <div className={`text-xs ${friend.weeklyProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {isPortuguese ? 'Semana' : 'This Week'}
                      </div>
                    </div>
                    <div className="bg-orange-500/20 rounded-lg p-3">
                      <div className="text-lg font-bold text-orange-400">{friend.streak}</div>
                      <div className="text-xs text-orange-300">{isPortuguese ? 'Sequência' : 'Streak'}</div>
                    </div>
                  </div>

                  {/* Comparison with user */}
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      {friend.winRate > (stats?.winRate || 60) ? (
                        <>
                          <span className="text-red-400">📈</span>
                          <span className="text-slate-300">
                            {friend.name.split(' ')[0]} {isPortuguese ? 'está' : 'is'} {(friend.winRate - (stats?.winRate || 60)).toFixed(1)}% {isPortuguese ? 'melhor que você' : 'better than you'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-400">🎯</span>
                          <span className="text-slate-300">
                            {isPortuguese ? 'Você está' : 'You are'} {((stats?.winRate || 60) - friend.winRate).toFixed(1)}% {isPortuguese ? 'melhor!' : 'better!'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Friend Activity Feed */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-lg">📢</span>
                {isPortuguese ? 'Atividade dos Amigos' : 'Friends Activity'}
              </h3>
              
              <div className="space-y-3">
                {[
                  { friend: 'João Silva', action: isPortuguese ? 'conseguiu uma sequência de 8 vitórias!' : 'achieved an 8-win streak!', time: '10 min', type: 'streak' },
                  { friend: 'Ana Oliveira', action: isPortuguese ? 'subiu para o nível Ouro!' : 'advanced to Gold tier!', time: '23 min', type: 'level' },
                  { friend: 'Maria Santos', action: isPortuguese ? 'completou o desafio "Semana Perfeita"' : 'completed the "Perfect Week" challenge', time: '1h', type: 'challenge' },
                  { friend: 'Pedro Costa', action: isPortuguese ? 'fez um lucro de $45 hoje' : 'made $45 profit today', time: '2h', type: 'profit' }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-slate-700/50">
                    <div className="text-2xl">
                      {activity.type === 'streak' ? '🔥' :
                       activity.type === 'level' ? '⭐' :
                       activity.type === 'challenge' ? '🏆' : '💰'}
                    </div>
                    <div className="flex-1">
                      <div className="text-white">
                        <span className="font-semibold text-pink-400">{activity.friend}</span>
                        {' '}{activity.action}
                      </div>
                      <div className="text-xs text-slate-400">{activity.time} {isPortuguese ? 'atrás' : 'ago'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              {isPortuguese ? 'Desafios da Comunidade' : 'Community Challenges'}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {groupChallenges.map((challenge) => (
                <div key={challenge.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{challenge.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(challenge.difficulty)}`}>
                          {challenge.difficulty}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{challenge.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-300 mb-4">
                        <div className="flex items-center gap-1">
                          <span className="text-lg">👥</span>
                          {challenge.participants} {isPortuguese ? 'participantes' : 'participants'}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-lg">⏰</span>
                          {challenge.timeLeft} {isPortuguese ? 'restante' : 'left'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                      <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                      <span>{challenge.currentProgress}/{challenge.goal}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full transition-all duration-700"
                        style={{ width: `${(challenge.currentProgress / challenge.goal) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-center mt-2 text-sm text-slate-400">
                      {((challenge.currentProgress / challenge.goal) * 100).toFixed(1)}% {isPortuguese ? 'concluído' : 'complete'}
                    </div>
                  </div>

                  {/* Reward */}
                  <div className="bg-yellow-500/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <span className="text-lg">🎁</span>
                      <span className="font-medium">{isPortuguese ? 'Recompensa:' : 'Reward:'} {challenge.reward}</span>
                    </div>
                  </div>

                  {/* Join/Leave Button */}
                  <button 
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      challenge.isJoined
                        ? 'bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30'
                        : 'bg-pink-500/20 text-pink-400 border border-pink-400/30 hover:bg-pink-500/30'
                    }`}
                  >
                    {challenge.isJoined 
                      ? (isPortuguese ? '🚪 Sair do Desafio' : '🚪 Leave Challenge')
                      : (isPortuguese ? '🚀 Participar' : '🚀 Join Challenge')
                    }
                  </button>
                </div>
              ))}
            </div>

            {/* Challenge Leaderboard */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-lg">📊</span>
                {isPortuguese ? 'Ranking do Desafio Ativo' : 'Active Challenge Leaderboard'}
              </h3>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'TradeMaster', contribution: 12, icon: '🥇' },
                    { rank: 2, name: 'CriptoQueen', contribution: 11, icon: '🥈' },
                    { rank: 3, name: 'Você', contribution: 8, icon: '🥉' },
                    { rank: 4, name: 'BinaryNinja', contribution: 7, icon: '4️⃣' },
                    { rank: 5, name: 'ForexKing', contribution: 6, icon: '5️⃣' }
                  ].map((participant) => (
                    <div key={participant.rank} className={`flex items-center justify-between p-3 rounded-lg ${
                      participant.name === 'Você' ? 'bg-purple-500/20 border border-purple-400/30' : 'bg-slate-800/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{participant.icon}</span>
                        <span className={`font-semibold ${participant.name === 'Você' ? 'text-purple-300' : 'text-white'}`}>
                          {participant.name}
                        </span>
                        {participant.name === 'Você' && (
                          <span className="text-purple-400 text-sm animate-pulse">
                            ({isPortuguese ? 'Você!' : 'That\'s you!'})
                          </span>
                        )}
                      </div>
                      <div className="text-white font-medium">
                        {participant.contribution} {isPortuguese ? 'contribuições' : 'contributions'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-2xl">🎖️</span>
              {isPortuguese ? 'Conquistas Sociais' : 'Social Achievements'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialAchievements.map((achievement) => (
                <div key={achievement.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:scale-105 transition-all duration-300">
                  <div className="text-center">
                    <div className="text-6xl mb-4">{achievement.icon}</div>
                    <h3 className="font-bold text-white text-lg mb-2">{achievement.title}</h3>
                    <p className="text-slate-400 text-sm mb-4">{achievement.description}</p>
                    
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${getRarityColor(achievement.rarity)}`}>
                      {achievement.rarity.toUpperCase()}
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-2">
                      {isPortuguese ? 'Desbloqueado por' : 'Unlocked by'} {achievement.unlockedBy} {isPortuguese ? 'pessoas' : 'people'}
                    </div>
                    
                    {achievement.earnedAt && (
                      <div className="flex items-center justify-center gap-1 text-xs text-green-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isPortuguese ? 'Conquistado em' : 'Earned on'} {achievement.earnedAt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Achievement Categories */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-lg">📈</span>
                {isPortuguese ? 'Progresso das Conquistas' : 'Achievement Progress'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { category: isPortuguese ? 'Influência Social' : 'Social Influence', current: 3, total: 8, color: 'pink' },
                  { category: isPortuguese ? 'Mentoria' : 'Mentorship', current: 2, total: 5, color: 'blue' },
                  { category: isPortuguese ? 'Competição' : 'Competition', current: 5, total: 10, color: 'orange' },
                  { category: isPortuguese ? 'Comunidade' : 'Community', current: 1, total: 6, color: 'purple' }
                ].map((category) => (
                  <div key={category.category} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">{category.category}</h4>
                      <span className="text-sm text-slate-400">{category.current}/{category.total}</span>
                    </div>
                    
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-700 ${
                          category.color === 'pink' ? 'bg-gradient-to-r from-pink-500 to-purple-500' :
                          category.color === 'blue' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                          category.color === 'orange' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                          'bg-gradient-to-r from-purple-500 to-pink-500'
                        }`}
                        style={{ width: `${(category.current / category.total) * 100}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-center mt-2 text-sm text-slate-400">
                      {((category.current / category.total) * 100).toFixed(0)}% {isPortuguese ? 'completo' : 'complete'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Motivational Social Message */}
      <section className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl p-8 border border-pink-400/30 text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h3 className="text-2xl font-bold text-white mb-4">
          {isPortuguese ? 'Continue Crescendo na Comunidade!' : 'Keep Growing in the Community!'}
        </h3>
        <p className="text-slate-300 max-w-2xl mx-auto">
          {isPortuguese 
            ? 'Você está fazendo um ótimo trabalho! Continue participando de desafios, ajudando amigos e subindo no ranking. A comunidade está torcendo por você!'
            : 'You\'re doing great work! Keep participating in challenges, helping friends, and climbing the rankings. The community is cheering for you!'
          }
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Próxima Meta' : 'Next Goal'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Alcançar nível Ouro' : 'Reach Gold tier'}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Impacto Social' : 'Social Impact'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Inspire mais traders!' : 'Inspire more traders!'}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Desafios' : 'Challenges'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Participe de mais desafios' : 'Join more challenges'}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
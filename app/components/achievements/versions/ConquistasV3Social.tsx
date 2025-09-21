'use client'

import React, { useState } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useCommunityFeed, useLikeTrade, useAddComment } from '@/hooks/useCommunity'
import { SharedTrade } from '@/types/community'
import CreatePostModal from '@/components/community/CreatePostModal'

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
  const [activeTab, setActiveTab] = useState<'feed' | 'community' | 'friends' | 'challenges' | 'achievements'>('feed')
  
  // Community hooks
  const { feed, loading: feedLoading, refetch: refetchFeed } = useCommunityFeed({
    filters: { timeframe: '24h', sortBy: 'recent' }
  })
  const { toggleLike } = useLikeTrade()
  const { addComment } = useAddComment()
  
  // Comment state
  const [newComment, setNewComment] = useState('')
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  
  // Post creation modal state
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)

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
      icon: (
        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      rarity: 'Epic',
      unlockedBy: 23,
      earnedAt: '2025-01-15'
    },
    {
      id: '2',
      title: isPortuguese ? 'Mentor dos Champions' : 'Champion Mentor',
      description: isPortuguese ? 'Ajudou 10 amigos a melhorar suas taxas de acerto' : 'Helped 10 friends improve their win rates',
      icon: (
        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      rarity: 'Legendary',
      unlockedBy: 7,
      earnedAt: '2025-01-20'
    },
    {
      id: '3',
      title: isPortuguese ? 'Quebra-Recordes Regional' : 'Regional Record Breaker',
      description: isPortuguese ? 'Top 10 na sua região esta semana' : 'Top 10 in your region this week',
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
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

  // Trade interaction handlers
  const handleLikeTrade = async (tradeId: string) => {
    try {
      await toggleLike(tradeId)
      refetchFeed()
    } catch (error) {
      console.error('Error liking trade:', error)
    }
  }

  const handleAddComment = async (tradeId: string) => {
    if (!newComment.trim()) return

    try {
      await addComment(tradeId, newComment.trim())
      setNewComment('')
      setCommentingOn(null)
      refetchFeed()
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return isPortuguese ? 'agora' : 'now'
    if (diffInMinutes < 60) return `${diffInMinutes}${isPortuguese ? 'min' : 'min'}`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}${isPortuguese ? 'h' : 'h'}`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}${isPortuguese ? 'd' : 'd'}`
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
        <nav className="-mb-px flex">
          {[
            { id: 'feed', label: isPortuguese ? 'Feed' : 'Feed', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ) },
            { id: 'community', label: isPortuguese ? 'Comunidade' : 'Community', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) },
            { id: 'friends', label: isPortuguese ? 'Amigos' : 'Friends', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            ) },
            { id: 'challenges', label: isPortuguese ? 'Desafios' : 'Challenges', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ) },
            { id: 'achievements', label: isPortuguese ? 'Conquistas' : 'Achievements', icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ) }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-0 focus:shadow-none ${
                activeTab === tab.id
                  ? 'border-pink-400 text-pink-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
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
      <div className="mt-8">
        {activeTab === 'feed' && (
          <div className="space-y-6">
            {/* Feed Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {isPortuguese ? 'Feed da Comunidade' : 'Community Feed'}
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowCreatePostModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 shadow-lg focus:outline-none focus:ring-0 focus:shadow-none"
                  style={{ outline: 'none', boxShadow: 'none' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {isPortuguese ? 'Postar' : 'Post'}
                </button>
                <button 
                  onClick={refetchFeed}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors border border-gray-600"
                >
                  <span className="text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isPortuguese ? 'Atualizar' : 'Refresh'}
                  </span>
                </button>
              </div>
            </div>

            {/* Feed Posts */}
            {feedLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                <p className="text-gray-400 mt-2">{isPortuguese ? 'Carregando...' : 'Loading...'}</p>
              </div>
            ) : feed?.posts.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPortuguese ? 'Nenhum post ainda' : 'No posts yet'}
                </h3>
                <p className="text-gray-400">
                  {isPortuguese ? 'Seja o primeiro a compartilhar um trade!' : 'Be the first to share a trade!'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {feed?.posts.map((post) => (
                  <div key={post.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                    {/* Post Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                          {post.userDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{post.userDisplayName}</h3>
                          <p className="text-sm text-gray-400">
                            {formatTimeAgo(new Date(post.createdAt))} • {post.userTier}
                          </p>
                        </div>
                      </div>
                      {post.isVerified && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs">{isPortuguese ? 'Verificado' : 'Verified'}</span>
                        </div>
                      )}
                    </div>

                    {/* Post Title & Description */}
                    <div className="mb-4">
                      <h4 className="text-lg font-bold text-white mb-2">{post.title}</h4>
                      {post.description && (
                        <p className="text-gray-300">{post.description}</p>
                      )}
                    </div>

                    {/* Trade Info */}
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm text-gray-400">{isPortuguese ? 'Ativo' : 'Asset'}</div>
                          <div className="font-bold text-white">{post.asset}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">{isPortuguese ? 'Direção' : 'Direction'}</div>
                          <div className={`font-bold ${post.direction === 'call' ? 'text-green-400' : 'text-red-400'}`}>
                            {post.direction === 'call' ? 
                              (isPortuguese ? 'BULL' : 'CALL') : 
                              (isPortuguese ? 'BEAR' : 'PUT')
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">{isPortuguese ? 'Resultado' : 'Result'}</div>
                          <div className={`font-bold ${
                            post.result === 'win' ? 'text-green-400' : 
                            post.result === 'loss' ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {post.result === 'win' ? 
                              (isPortuguese ? 'VITÓRIA' : 'WIN') : 
                              post.result === 'loss' ? 
                                (isPortuguese ? 'DERROTA' : 'LOSS') : 
                                (isPortuguese ? 'EMPATE' : 'TIE')
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">{isPortuguese ? 'Lucro' : 'Profit'}</div>
                          <div className={`font-bold ${post.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${Math.abs(post.profit).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Post Actions */}
                    <div className="flex items-center justify-between border-t border-gray-700/50 pt-4">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleLikeTrade(post.id)}
                          className="flex items-center gap-2 text-gray-400 hover:text-pink-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          <span>{post.likes}</span>
                        </button>
                        
                        <button 
                          onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                          className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>{post.comments.length}</span>
                        </button>
                        
                        <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          <span>{post.shares}</span>
                        </button>
                      </div>
                      
                      <div className="text-gray-400 text-sm">
                        {post.views} {isPortuguese ? 'visualizações' : 'views'}
                      </div>
                    </div>

                    {/* Comment Box */}
                    {commentingOn === post.id && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            U
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder={isPortuguese ? 'Adicione um comentário...' : 'Add a comment...'}
                              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 resize-none"
                              rows={3}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button 
                                onClick={() => setCommentingOn(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                              >
                                {isPortuguese ? 'Cancelar' : 'Cancel'}
                              </button>
                              <button 
                                onClick={() => handleAddComment(post.id)}
                                disabled={!newComment.trim()}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                              >
                                {isPortuguese ? 'Comentar' : 'Comment'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'community' && (
          <div className="space-y-8">
            {/* Community Leaderboard */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
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
                        {trader.trend === 'up' ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                          </svg>
                        ) : trader.trend === 'down' ? (
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-white mb-2">{trader.name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="text-green-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${trader.profit.toFixed(2)}
                      </div>
                      <div className="text-blue-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        {trader.winRate}% {isPortuguese ? 'acertos' : 'wins'}
                      </div>
                      <div className="text-orange-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 716.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                        {trader.streak} {isPortuguese ? 'seguidos' : 'streak'}
                      </div>
                      <div className="text-slate-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 5.657a8 8 0 010 11.314m0 0a8 8 0 01-11.314 0m11.314 0a8 8 0 000-11.314m0 0a8 8 0 00-11.314 0" />
                        </svg>
                        {trader.region}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Your Community Position */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
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
                      <div className="mb-2">
                        <svg className="w-8 h-8 text-yellow-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-white">{communityRank.percentile}%</div>
                      <div className="text-sm text-purple-300">
                        {isPortuguese ? 'Melhor que outros traders' : 'Better than other traders'}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="mb-2">
                        <svg className="w-8 h-8 text-yellow-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-white">{communityRank.tier}</div>
                      <div className="text-sm text-purple-300">
                        {isPortuguese ? 'Seu nível atual' : 'Your current tier'}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="mb-2">
                        <svg className="w-8 h-8 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
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
                <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {isPortuguese ? 'Seus Amigos Traders' : 'Your Trading Friends'}
              </h2>
              <button className="bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 px-4 py-2 rounded-lg transition-colors border border-pink-400/30">
                <span className="text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  {isPortuguese ? 'Adicionar Amigo' : 'Add Friend'}
                </span>
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
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="text-slate-300">
                            {friend.name.split(' ')[0]} {isPortuguese ? 'está' : 'is'} {(friend.winRate - (stats?.winRate || 60)).toFixed(1)}% {isPortuguese ? 'melhor que você' : 'better than you'}
                          </span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
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
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
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
                      {activity.type === 'streak' ? (
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 716.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                      ) : activity.type === 'level' ? (
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      ) : activity.type === 'challenge' ? (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
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
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
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
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
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
                      <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
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
                      ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {isPortuguese ? 'Sair do Desafio' : 'Leave Challenge'}
                        </span>
                      )
                      : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          {isPortuguese ? 'Participar' : 'Join Challenge'}
                        </span>
                      )
                    }
                  </button>
                </div>
              ))}
            </div>

            {/* Challenge Leaderboard */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {isPortuguese ? 'Ranking do Desafio Ativo' : 'Active Challenge Leaderboard'}
              </h3>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'TradeMaster', contribution: 12, icon: (
                      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    ) },
                    { rank: 2, name: 'CriptoQueen', contribution: 11, icon: (
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    ) },
                    { rank: 3, name: 'Você', contribution: 8, icon: (
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    ) },
                    { rank: 4, name: 'BinaryNinja', contribution: 7, icon: (
                      <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
                    ) },
                    { rank: 5, name: 'ForexKing', contribution: 6, icon: (
                      <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold">5</div>
                    ) }
                  ].map((participant) => (
                    <div key={participant.rank} className={`flex items-center justify-between p-3 rounded-lg ${
                      participant.name === 'Você' ? 'bg-purple-500/20 border border-purple-400/30' : 'bg-slate-800/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center">{participant.icon}</div>
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
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
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
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
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
        <div className="mb-4">
          <svg className="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
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
            <div className="mb-2">
              <svg className="w-8 h-8 text-blue-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Próxima Meta' : 'Next Goal'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Alcançar nível Ouro' : 'Reach Gold tier'}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <div className="mb-2">
              <svg className="w-8 h-8 text-blue-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Impacto Social' : 'Social Impact'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Inspire mais traders!' : 'Inspire more traders!'}
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <div className="mb-2">
              <svg className="w-8 h-8 text-yellow-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div className="font-bold text-white">
              {isPortuguese ? 'Desafios' : 'Challenges'}
            </div>
            <div className="text-sm text-pink-300">
              {isPortuguese ? 'Participe de mais desafios' : 'Join more challenges'}
            </div>
          </div>
        </div>
      </section>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onSuccess={() => {
          refetchFeed()
          setShowCreatePostModal(false)
        }}
      />
    </div>
  )
}
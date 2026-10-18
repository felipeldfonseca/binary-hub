'use client'
import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import FollowButton from './FollowButton'
import SocialFeed from './SocialFeed'
import { MapPin, Calendar, TrendingUp, Users, MessageSquare, Settings, Share2 } from 'lucide-react'

interface PublicProfileProps {
  username: string
}

interface ProfileData {
  id: string
  displayName: string
  username?: string
  photoURL?: string
  bio?: string
  location?: string
  website?: string
  tradingSince?: string
  socialStats: {
    followersCount: number
    followingCount: number
    postsCount: number
    likesReceived: number
  }
  stats?: {
    totalTrades: number
    winRate: number
    totalProfit: number
    avgStake: number
    currentStreak: number
    bestStreak: number
  }
  recentAchievements: any[]
  relationship?: 'none' | 'following' | 'pending' | 'follower' | 'mutual' | 'self'
}

export default function PublicProfile({ username }: PublicProfileProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts')

  // Mock profile data
  const mockProfile: ProfileData = {
    id: 'user1',
    displayName: 'João Silva',
    username: 'joaotrader',
    photoURL: '',
    bio: 'Trader especializado em opções binárias há 3 anos. Focado em estratégias de breakout e análise técnica. Sempre compartilhando conhecimento! 📈',
    location: 'São Paulo, Brasil',
    website: 'https://joaotrader.com',
    tradingSince: 'Janeiro 2021',
    socialStats: {
      followersCount: 1250,
      followingCount: 180,
      postsCount: 89,
      likesReceived: 2430
    },
    stats: {
      totalTrades: 1456,
      winRate: 68.5,
      totalProfit: 5420.50,
      avgStake: 45.20,
      currentStreak: 3,
      bestStreak: 12
    },
    recentAchievements: [],
    relationship: 'none'
  }

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setProfile(mockProfile)
      setLoading(false)
    }, 1000)
  }, [username])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header Skeleton */}
          <div className="card p-8 mb-6">
            <div className="animate-pulse">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-700 rounded w-64 mb-4"></div>
                  <div className="h-4 bg-gray-700 rounded w-32 mb-4"></div>
                  <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-700 rounded w-16 mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            {isPortuguese ? 'Usuário não encontrado' : 'User not found'}
          </h1>
          <p className="text-gray-400">
            {isPortuguese ? 'O perfil que você está procurando não existe.' : 'The profile you are looking for does not exist.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        {/* Profile Header */}
        <div className="card p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar and Basic Info */}
            <div className="flex flex-col items-center md:items-start">
              <Avatar
                src={profile.photoURL}
                alt={profile.displayName}
                size="xl"
                className="mb-4"
              />
              {profile.relationship !== 'self' && (
                <div className="flex gap-2">
                  <FollowButton
                    userId={profile.id}
                    initialFollowState={profile.relationship}
                    size="md"
                  />
                  <button className="p-2 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg transition-colors">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <button className="p-2 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              {profile.relationship === 'self' && (
                <button className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                  <Settings className="h-4 w-4" />
                  {isPortuguese ? 'Editar Perfil' : 'Edit Profile'}
                </button>
              )}
            </div>

            {/* Profile Details */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-2">{profile.displayName}</h1>
              {profile.username && (
                <p className="text-gray-400 text-lg mb-4">@{profile.username}</p>
              )}
              
              {profile.bio && (
                <p className="text-gray-200 mb-4 leading-relaxed">{profile.bio}</p>
              )}

              {/* Meta Information */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                {profile.tradingSince && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {isPortuguese ? 'Negociando desde' : 'Trading since'} {profile.tradingSince}
                  </div>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>

              {/* Social Stats */}
              <div className="flex justify-center md:justify-start gap-6 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">
                    {formatNumber(profile.socialStats.followersCount)}
                  </p>
                  <p className="text-gray-400">
                    {isPortuguese ? 'Seguidores' : 'Followers'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">
                    {formatNumber(profile.socialStats.followingCount)}
                  </p>
                  <p className="text-gray-400">
                    {isPortuguese ? 'Seguindo' : 'Following'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">
                    {formatNumber(profile.socialStats.postsCount)}
                  </p>
                  <p className="text-gray-400">
                    {isPortuguese ? 'Posts' : 'Posts'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Stats */}
        {profile.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-white mb-1">
                {formatNumber(profile.stats.totalTrades)}
              </p>
              <p className="text-gray-400 text-sm">
                {isPortuguese ? 'Total Trades' : 'Total Trades'}
              </p>
            </div>
            
            <div className="card p-4 text-center">
              <p className={`text-2xl font-bold mb-1 ${
                profile.stats.winRate >= 60 
                  ? 'text-green-400' 
                  : profile.stats.winRate >= 50 
                    ? 'text-yellow-400' 
                    : 'text-red-400'
              }`}>
                {profile.stats.winRate.toFixed(1)}%
              </p>
              <p className="text-gray-400 text-sm">
                {isPortuguese ? 'Taxa de Vitória' : 'Win Rate'}
              </p>
            </div>
            
            <div className="card p-4 text-center">
              <p className={`text-2xl font-bold mb-1 ${
                profile.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(profile.stats.totalProfit)}
              </p>
              <p className="text-gray-400 text-sm">
                {isPortuguese ? 'Lucro Total' : 'Total Profit'}
              </p>
            </div>
            
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-orange-400 mb-1">
                {profile.stats.bestStreak}
              </p>
              <p className="text-gray-400 text-sm">
                {isPortuguese ? 'Melhor Sequência' : 'Best Streak'}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'posts'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {isPortuguese ? 'Posts' : 'Posts'} ({profile.socialStats.postsCount})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'about'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {isPortuguese ? 'Sobre' : 'About'}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          <SocialFeed feedType="user" userId={profile.id} />
        )}

        {activeTab === 'about' && (
          <div className="card p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {isPortuguese ? 'Sobre' : 'About'}
            </h3>
            
            <div className="space-y-6">
              {profile.bio && (
                <div>
                  <h4 className="text-gray-300 font-medium mb-2">
                    {isPortuguese ? 'Biografia' : 'Bio'}
                  </h4>
                  <p className="text-gray-200">{profile.bio}</p>
                </div>
              )}

              {profile.stats && (
                <div>
                  <h4 className="text-gray-300 font-medium mb-3">
                    {isPortuguese ? 'Estatísticas de Trading' : 'Trading Statistics'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{isPortuguese ? 'Trades Totais:' : 'Total Trades:'}</span>
                      <span className="text-white">{formatNumber(profile.stats.totalTrades)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{isPortuguese ? 'Taxa de Vitória:' : 'Win Rate:'}</span>
                      <span className="text-white">{profile.stats.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{isPortuguese ? 'Stake Médio:' : 'Avg Stake:'}</span>
                      <span className="text-white">{formatCurrency(profile.stats.avgStake)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{isPortuguese ? 'Sequência Atual:' : 'Current Streak:'}</span>
                      <span className="text-white">{profile.stats.currentStreak}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-gray-300 font-medium mb-3">
                  {isPortuguese ? 'Atividade Social' : 'Social Activity'}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{isPortuguese ? 'Posts:' : 'Posts:'}</span>
                    <span className="text-white">{profile.socialStats.postsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{isPortuguese ? 'Likes Recebidos:' : 'Likes Received:'}</span>
                    <span className="text-white">{formatNumber(profile.socialStats.likesReceived)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
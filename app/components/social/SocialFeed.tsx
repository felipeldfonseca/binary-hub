'use client'
import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import CreatePost from './CreatePost'
import { Heart, MessageCircle, Share2, TrendingUp, Clock, MoreHorizontal } from 'lucide-react'

interface Post {
  id: string
  userId: string
  userDisplayName: string
  userUsername?: string
  userPhotoURL?: string
  content: string
  tags: string[]
  visibility: 'public' | 'followers' | 'private'
  createdAt: string
  likes: number
  comments: number
  shares: number
  isLiked: boolean
  sharedTrade?: {
    tradeId: string
    asset: string
    result: 'win' | 'loss' | 'tie'
    profit: number
    amount: number
  }
}

interface SocialFeedProps {
  feedType?: 'home' | 'following' | 'user'
  userId?: string
}

export default function SocialFeed({ feedType = 'home', userId }: SocialFeedProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Mock data for demonstration
  const mockPosts: Post[] = [
    {
      id: '1',
      userId: 'user1',
      userDisplayName: 'João Silva',
      userUsername: 'joaotrader',
      userPhotoURL: '',
      content: 'Consegui uma sequência de 5 vitórias seguidas no EURUSD! A estratégia de breakout está funcionando muito bem hoje. 📈💪',
      tags: ['breakout', 'eurusd', 'estrategia'],
      visibility: 'public',
      createdAt: '2024-01-20T10:30:00Z',
      likes: 12,
      comments: 3,
      shares: 2,
      isLiked: false,
      sharedTrade: {
        tradeId: 'trade1',
        asset: 'EURUSD',
        result: 'win',
        profit: 85.50,
        amount: 50.00
      }
    },
    {
      id: '2',
      userId: 'user2',
      userDisplayName: 'Maria Santos',
      userUsername: 'mariatrader',
      userPhotoURL: '',
      content: 'Análise do mercado para semana que vem: vejo uma tendência de alta no GBPJPY. Quem mais está acompanhando esse par? 🤔',
      tags: ['analise', 'gbpjpy', 'tendencia'],
      visibility: 'public',
      createdAt: '2024-01-20T09:15:00Z',
      likes: 8,
      comments: 7,
      shares: 1,
      isLiked: true
    },
    {
      id: '3',
      userId: 'user3',
      userDisplayName: 'Carlos Mendes',
      userUsername: 'carlosfx',
      userPhotoURL: '',
      content: 'Lição aprendida hoje: nunca aumentar o stake depois de uma perda. Disciplina é tudo no trading! 💡',
      tags: ['disciplina', 'gerenciamento', 'licao'],
      visibility: 'followers',
      createdAt: '2024-01-20T08:45:00Z',
      likes: 15,
      comments: 5,
      shares: 3,
      isLiked: false
    }
  ]

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setPosts(mockPosts)
      setLoading(false)
    }, 1000)
  }, [])

  const handlePostCreated = (newPost: Post) => {
    setPosts(prev => [newPost, ...prev])
  }

  const handleLike = async (postId: string) => {
    // Optimistic update
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          }
        : post
    ))

    // TODO: API call
    try {
      await fetch(`/api/v1/social/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer mock-token-for-testing`
        }
      })
    } catch (error) {
      // Revert optimistic update on error
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes + 1 : post.likes - 1
            }
          : post
      ))
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return isPortuguese ? 'agora' : 'now'
    } else if (diffInMinutes < 60) {
      return isPortuguese ? `${diffInMinutes}m` : `${diffInMinutes}m`
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60)
      return isPortuguese ? `${hours}h` : `${hours}h`
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return isPortuguese ? `${days}d` : `${days}d`
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Create Post Skeleton */}
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
              <div className="h-4 bg-gray-700 rounded w-32"></div>
            </div>
            <div className="h-20 bg-gray-700 rounded mb-4"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
          </div>
        </div>

        {/* Post Skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6">
            <div className="animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                <div>
                  <div className="h-4 bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-24"></div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              </div>
              <div className="h-8 bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create Post */}
      {feedType === 'home' && (
        <CreatePost onPostCreated={handlePostCreated} />
      )}

      {/* Feed Posts */}
      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.id} className="card p-6">
            {/* Post Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={post.userPhotoURL}
                  alt={post.userDisplayName}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{post.userDisplayName}</h3>
                    {post.userUsername && (
                      <span className="text-gray-400 text-sm">@{post.userUsername}</span>
                    )}
                    <span className="text-gray-500 text-sm">·</span>
                    <span className="text-gray-500 text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(post.createdAt)}
                    </span>
                  </div>
                  {post.visibility !== 'public' && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      {post.visibility === 'followers' ? (
                        <span>{isPortuguese ? '👥 Seguidores' : '👥 Followers'}</span>
                      ) : (
                        <span>{isPortuguese ? '🔒 Privado' : '🔒 Private'}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Post Content */}
            <div className="mb-4">
              <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
              
              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-orange-400 text-sm hover:text-orange-300 cursor-pointer"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Shared Trade */}
            {post.sharedTrade && (
              <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  <span className="text-orange-400 font-medium text-sm">
                    {isPortuguese ? 'Trade Compartilhado' : 'Shared Trade'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400 block">{isPortuguese ? 'Ativo' : 'Asset'}</span>
                    <span className="text-white font-medium">{post.sharedTrade.asset}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{isPortuguese ? 'Resultado' : 'Result'}</span>
                    <span className={`font-medium ${
                      post.sharedTrade.result === 'win' 
                        ? 'text-green-400' 
                        : post.sharedTrade.result === 'loss' 
                          ? 'text-red-400' 
                          : 'text-yellow-400'
                    }`}>
                      {post.sharedTrade.result.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{isPortuguese ? 'Valor' : 'Amount'}</span>
                    <span className="text-white font-medium">${post.sharedTrade.amount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{isPortuguese ? 'Lucro' : 'Profit'}</span>
                    <span className={`font-medium ${
                      post.sharedTrade.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      ${post.sharedTrade.profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Post Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="flex items-center gap-6">
                {/* Like */}
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 transition-colors ${
                    post.isLiked 
                      ? 'text-red-400 hover:text-red-300' 
                      : 'text-gray-400 hover:text-red-400'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                  <span className="text-sm">{formatNumber(post.likes)}</span>
                </button>

                {/* Comment */}
                <button className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-sm">{formatNumber(post.comments)}</span>
                </button>

                {/* Share */}
                <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors">
                  <Share2 className="h-4 w-4" />
                  <span className="text-sm">{formatNumber(post.shares)}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center">
        <button className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors">
          {isPortuguese ? 'Carregar mais posts' : 'Load more posts'}
        </button>
      </div>
    </div>
  )
}
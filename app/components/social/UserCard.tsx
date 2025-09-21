'use client'
import React from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import Avatar from '@/components/ui/Avatar'
import FollowButton from './FollowButton'
import { MapPin, Calendar, Users, TrendingUp } from 'lucide-react'

interface UserCardProps {
  user: {
    id: string
    displayName: string
    username?: string
    photoURL?: string
    bio?: string
    location?: string
    tradingSince?: string
    socialStats?: {
      followersCount: number
      followingCount: number
      postsCount: number
    }
    stats?: {
      totalTrades: number
      winRate: number
    }
  }
  relationship?: 'none' | 'following' | 'pending' | 'follower' | 'mutual' | 'self'
  showFollowButton?: boolean
  variant?: 'compact' | 'detailed'
  onClick?: () => void
}

export default function UserCard({
  user,
  relationship = 'none',
  showFollowButton = true,
  variant = 'detailed',
  onClick
}: UserCardProps) {
  const { isPortuguese } = useLanguage()

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  const formatWinRate = (winRate: number) => {
    return `${winRate.toFixed(1)}%`
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on interactive elements
    if (e.target instanceof HTMLElement) {
      const isInteractive = e.target.closest('button, a')
      if (isInteractive) return
    }
    onClick?.()
  }

  if (variant === 'compact') {
    return (
      <div 
        className="card p-4 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.photoURL}
              alt={user.displayName}
              size="md"
            />
            <div>
              <h3 className="font-semibold text-white">{user.displayName}</h3>
              {user.username && (
                <p className="text-gray-400 text-sm">@{user.username}</p>
              )}
              {user.bio && (
                <p className="text-gray-300 text-sm line-clamp-1">{user.bio}</p>
              )}
            </div>
          </div>
          
          {showFollowButton && relationship !== 'self' && (
            <FollowButton
              userId={user.id}
              initialFollowState={relationship}
              size="sm"
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div 
      className="card p-6 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <Avatar
            src={user.photoURL}
            alt={user.displayName}
            size="lg"
          />
          <div>
            <Link
              href={user.username ? `/@${user.username}` : `/profile/${user.id}`}
              className="hover:text-orange-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-white text-lg">{user.displayName}</h3>
            </Link>
            {user.username && (
              <p className="text-gray-400 text-sm">@{user.username}</p>
            )}
          </div>
        </div>
        
        {showFollowButton && relationship !== 'self' && (
          <FollowButton
            userId={user.id}
            initialFollowState={relationship}
            size="md"
          />
        )}
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-gray-300 mb-4 line-clamp-2">{user.bio}</p>
      )}

      {/* Meta Information */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
        {user.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {user.location}
          </div>
        )}
        {user.tradingSince && (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {isPortuguese ? 'Negociando desde' : 'Trading since'} {user.tradingSince}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {/* Social Stats */}
        <div>
          <p className="text-white font-bold text-lg">
            {formatCount(user.socialStats?.followersCount || 0)}
          </p>
          <p className="text-gray-400 text-xs">
            {isPortuguese ? 'Seguidores' : 'Followers'}
          </p>
        </div>
        
        <div>
          <p className="text-white font-bold text-lg">
            {formatCount(user.socialStats?.followingCount || 0)}
          </p>
          <p className="text-gray-400 text-xs">
            {isPortuguese ? 'Seguindo' : 'Following'}
          </p>
        </div>

        {/* Trading Stats */}
        {user.stats && (
          <>
            <div>
              <p className="text-white font-bold text-lg">
                {formatCount(user.stats.totalTrades)}
              </p>
              <p className="text-gray-400 text-xs">
                {isPortuguese ? 'Trades' : 'Trades'}
              </p>
            </div>
            
            <div>
              <p className={`font-bold text-lg ${
                user.stats.winRate >= 60 
                  ? 'text-green-400' 
                  : user.stats.winRate >= 50 
                    ? 'text-yellow-400' 
                    : 'text-red-400'
              }`}>
                {formatWinRate(user.stats.winRate)}
              </p>
              <p className="text-gray-400 text-xs">
                {isPortuguese ? 'Taxa de Vitória' : 'Win Rate'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Performance Indicator */}
      {user.stats && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className={`h-4 w-4 ${
              user.stats.winRate >= 60 
                ? 'text-green-400' 
                : user.stats.winRate >= 50 
                  ? 'text-yellow-400' 
                  : 'text-red-400'
            }`} />
            <span className="text-gray-300">
              {user.stats.winRate >= 60 
                ? (isPortuguese ? 'Trader Experiente' : 'Experienced Trader')
                : user.stats.winRate >= 50 
                  ? (isPortuguese ? 'Trader Intermediário' : 'Intermediate Trader')
                  : (isPortuguese ? 'Trader Iniciante' : 'Beginner Trader')
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
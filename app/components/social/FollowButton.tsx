'use client'
import React, { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { UserPlus, UserMinus, Clock, Check, Loader } from 'lucide-react'

interface FollowButtonProps {
  userId: string
  initialFollowState?: 'none' | 'following' | 'pending' | 'follower' | 'mutual'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
  onFollowChange?: (newState: string) => void
}

export default function FollowButton({
  userId,
  initialFollowState = 'none',
  size = 'md',
  variant = 'primary',
  onFollowChange
}: FollowButtonProps) {
  const { isPortuguese } = useLanguage()
  const [followState, setFollowState] = useState(initialFollowState)
  const [loading, setLoading] = useState(false)

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const variantClasses = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: 'border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white'
  }

  const handleFollow = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/social/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing` // TODO: Use real token
        },
        body: JSON.stringify({ userId })
      })

      const result = await response.json()
      
      if (result.success) {
        const newState = result.requiresApproval ? 'pending' : 'following'
        setFollowState(newState)
        onFollowChange?.(newState)
      } else {
        throw new Error(result.error || 'Failed to follow user')
      }
    } catch (error) {
      console.error('Follow error:', error)
      // TODO: Show error toast
    }
    setLoading(false)
  }

  const handleUnfollow = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/social/unfollow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing` // TODO: Use real token
        },
        body: JSON.stringify({ userId })
      })

      const result = await response.json()
      
      if (result.success) {
        setFollowState('none')
        onFollowChange?.('none')
      } else {
        throw new Error(result.error || 'Failed to unfollow user')
      }
    } catch (error) {
      console.error('Unfollow error:', error)
      // TODO: Show error toast
    }
    setLoading(false)
  }

  const getButtonContent = () => {
    if (loading) {
      return (
        <span className="flex items-center gap-2">
          <Loader className="h-4 w-4 animate-spin" />
          {isPortuguese ? 'Carregando...' : 'Loading...'}
        </span>
      )
    }

    switch (followState) {
      case 'following':
        return (
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {isPortuguese ? 'Seguindo' : 'Following'}
          </span>
        )
      
      case 'pending':
        return (
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {isPortuguese ? 'Pendente' : 'Pending'}
          </span>
        )
      
      case 'mutual':
        return (
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {isPortuguese ? 'Seguindo' : 'Following'}
          </span>
        )
      
      case 'follower':
        return (
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {isPortuguese ? 'Seguir de Volta' : 'Follow Back'}
          </span>
        )
      
      default:
        return (
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {isPortuguese ? 'Seguir' : 'Follow'}
          </span>
        )
    }
  }

  const getButtonClass = () => {
    let classes = `font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]}`
    
    if (followState === 'following' || followState === 'mutual') {
      classes += ` ${variantClasses.secondary} hover:bg-red-600 hover:text-white group`
    } else {
      classes += ` ${variantClasses[variant]}`
    }
    
    return classes
  }

  const handleClick = () => {
    if (followState === 'following' || followState === 'mutual') {
      handleUnfollow()
    } else if (followState === 'pending') {
      // Could handle canceling request here
      return
    } else {
      handleFollow()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || followState === 'pending'}
      className={getButtonClass()}
    >
      <span className={followState === 'following' || followState === 'mutual' ? 'group-hover:hidden' : ''}>
        {getButtonContent()}
      </span>
      {(followState === 'following' || followState === 'mutual') && (
        <span className="hidden group-hover:flex items-center gap-2">
          <UserMinus className="h-4 w-4" />
          {isPortuguese ? 'Deixar de Seguir' : 'Unfollow'}
        </span>
      )}
    </button>
  )
}
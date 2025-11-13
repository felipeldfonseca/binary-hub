'use client'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import { Send, Image, TrendingUp, Globe, Users, Lock, X, Hash } from 'lucide-react'

const postSchema = z.object({
  content: z.string()
    .min(1, 'Post content is required')
    .max(500, 'Post must be less than 500 characters'),
  visibility: z.enum(['public', 'followers', 'private']),
  tags: z.array(z.string()).optional()
})

type PostFormData = z.infer<typeof postSchema>

interface CreatePostProps {
  onPostCreated?: (post: any) => void
  placeholder?: string
  autoFocus?: boolean
  tradeId?: string // For sharing specific trades
  tradeData?: {
    asset: string
    result: 'win' | 'loss' | 'tie'
    profit: number
    amount: number
  }
}

export default function CreatePost({
  onPostCreated,
  placeholder,
  autoFocus = false,
  tradeId,
  tradeData
}: CreatePostProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  // TODO: Get userProfile from context when available
  const userProfile = undefined
  const [loading, setLoading] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: '',
      visibility: 'public',
      tags: []
    }
  })

  const watchedContent = watch('content')
  const watchedVisibility = watch('visibility')
  const watchedTags = watch('tags') || []

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '')
    if (tag && !watchedTags.includes(tag) && watchedTags.length < 5) {
      setValue('tags', [...watchedTags, tag])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setValue('tags', watchedTags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(onSubmit)()
    }
  }

  const onSubmit = async (data: PostFormData) => {
    if (!user) return

    setLoading(true)
    try {
      const postData = {
        content: data.content,
        visibility: data.visibility,
        tags: data.tags || [],
        ...(tradeId && { 
          sharedTrade: {
            tradeId,
            ...tradeData
          }
        })
      }

      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/social/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        throw new Error('Failed to create post')
      }

      const result = await response.json()
      
      // Reset form
      reset()
      setShowTagInput(false)
      
      onPostCreated?.(result.data)
      
    } catch (error) {
      console.error('Create post error:', error)
      // TODO: Show error toast
    }
    setLoading(false)
  }

  const getVisibilityIcon = () => {
    switch (watchedVisibility) {
      case 'public':
        return <Globe className="h-4 w-4" />
      case 'followers':
        return <Users className="h-4 w-4" />
      case 'private':
        return <Lock className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getVisibilityLabel = () => {
    switch (watchedVisibility) {
      case 'public':
        return isPortuguese ? 'Público' : 'Public'
      case 'followers':
        return isPortuguese ? 'Seguidores' : 'Followers'
      case 'private':
        return isPortuguese ? 'Privado' : 'Private'
      default:
        return isPortuguese ? 'Público' : 'Public'
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <Avatar
          src={user?.photoURL || undefined}
          alt={user?.displayName || undefined}
          size="md"
        />
        <div className="flex-1">
          <h3 className="text-white font-medium">
            {user?.displayName || 'User'}
          </h3>
          {user?.email && (
            <p className="text-gray-400 text-sm">{user.email}</p>
          )}
        </div>
      </div>

      {/* Trade Attachment */}
      {tradeData && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <span className="text-orange-400 font-medium">
              {isPortuguese ? 'Compartilhando Trade' : 'Sharing Trade'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-gray-400">{isPortuguese ? 'Ativo:' : 'Asset:'}</span>
              <p className="text-white font-medium">{tradeData.asset}</p>
            </div>
            <div>
              <span className="text-gray-400">{isPortuguese ? 'Resultado:' : 'Result:'}</span>
              <p className={`font-medium ${
                tradeData.result === 'win' 
                  ? 'text-green-400' 
                  : tradeData.result === 'loss' 
                    ? 'text-red-400' 
                    : 'text-yellow-400'
              }`}>
                {tradeData.result.toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-gray-400">{isPortuguese ? 'Valor:' : 'Amount:'}</span>
              <p className="text-white font-medium">${tradeData.amount}</p>
            </div>
            <div>
              <span className="text-gray-400">{isPortuguese ? 'Lucro:' : 'Profit:'}</span>
              <p className={`font-medium ${tradeData.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradeData.profit.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content Input */}
      <div className="mb-4">
        <textarea
          {...register('content')}
          className="w-full bg-transparent text-white placeholder-gray-400 resize-none border-none outline-none text-lg"
          placeholder={placeholder || (isPortuguese 
            ? 'O que você está pensando sobre suas negociações...' 
            : 'What are you thinking about your trades...')}
          rows={3}
          autoFocus={autoFocus}
          onKeyDown={handleKeyPress}
        />
        {errors.content && (
          <p className="text-red-400 text-sm mt-1">{errors.content.message}</p>
        )}
      </div>

      {/* Tags */}
      {(showTagInput || watchedTags.length > 0) && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            {watchedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-orange-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          
          {showTagInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder={isPortuguese ? 'Adicionar tag...' : 'Add tag...'}
                className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-orange-500 outline-none"
                maxLength={20}
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPortuguese ? 'Adicionar' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          {/* Tag Button */}
          <button
            type="button"
            onClick={() => setShowTagInput(!showTagInput)}
            className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
            title={isPortuguese ? 'Adicionar tags' : 'Add tags'}
          >
            <Hash className="h-4 w-4" />
          </button>

          {/* Future: Image upload button */}
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors opacity-50 cursor-not-allowed"
            title={isPortuguese ? 'Adicionar imagem (em breve)' : 'Add image (coming soon)'}
            disabled
          >
            <Image className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Visibility Selector */}
          <select
            {...register('visibility')}
            className="bg-gray-800 text-white rounded-lg px-3 py-1 text-sm border border-gray-600 focus:border-orange-500 outline-none"
          >
            <option value="public">
              {isPortuguese ? '🌍 Público' : '🌍 Public'}
            </option>
            <option value="followers">
              {isPortuguese ? '👥 Seguidores' : '👥 Followers'}
            </option>
            <option value="private">
              {isPortuguese ? '🔒 Privado' : '🔒 Private'}
            </option>
          </select>

          {/* Character Count */}
          <span className={`text-sm ${
            watchedContent.length > 450 
              ? 'text-red-400' 
              : watchedContent.length > 400 
                ? 'text-yellow-400' 
                : 'text-gray-400'
          }`}>
            {watchedContent.length}/500
          </span>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !watchedContent.trim() || watchedContent.length > 500}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isPortuguese ? 'Postando...' : 'Posting...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {isPortuguese ? 'Postar' : 'Post'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
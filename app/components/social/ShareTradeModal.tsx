'use client'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { X, TrendingUp, Share2, Globe, Users, Lock, Hash } from 'lucide-react'

interface Trade {
  id: string
  asset: string
  direction: 'call' | 'put'
  amount: number
  result: 'win' | 'loss' | 'tie'
  profit: number
  entryPrice?: number
  exitPrice?: number
  entryTime: Date
  exitTime?: Date
}

interface ShareTradeModalProps {
  trade: Trade
  isOpen: boolean
  onClose: () => void
  onShared?: () => void
}

const shareSchema = z.object({
  content: z.string()
    .min(1, 'Post content is required')
    .max(500, 'Post must be less than 500 characters'),
  visibility: z.enum(['public', 'followers', 'private']),
  tags: z.array(z.string()).optional()
})

type ShareFormData = z.infer<typeof shareSchema>

export default function ShareTradeModal({
  trade,
  isOpen,
  onClose,
  onShared
}: ShareTradeModalProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  // TODO: Get userProfile from context when available
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<ShareFormData>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      content: '',
      visibility: 'public',
      tags: []
    }
  })

  const watchedContent = watch('content')
  const watchedVisibility = watch('visibility')
  const watchedTags = watch('tags') || []

  const generateSuggestedContent = () => {
    const resultText = trade.result === 'win' 
      ? (isPortuguese ? 'Vitória' : 'Win')
      : trade.result === 'loss'
        ? (isPortuguese ? 'Perda' : 'Loss')
        : (isPortuguese ? 'Empate' : 'Tie')

    const profitText = trade.profit >= 0 
      ? `+$${trade.profit.toFixed(2)}`
      : `-$${Math.abs(trade.profit).toFixed(2)}`

    const directionText = trade.direction === 'call'
      ? (isPortuguese ? 'CALL' : 'CALL')
      : (isPortuguese ? 'PUT' : 'PUT')

    const suggestedContent = isPortuguese
      ? `${resultText} no ${trade.asset}! Operação ${directionText} de $${trade.amount} resultou em ${profitText}. ${trade.result === 'win' ? '🎯💪' : trade.result === 'loss' ? '📚💡' : '🤝'}`
      : `${resultText} on ${trade.asset}! ${directionText} trade of $${trade.amount} resulted in ${profitText}. ${trade.result === 'win' ? '🎯💪' : trade.result === 'loss' ? '📚💡' : '🤝'}`

    setValue('content', suggestedContent)
  }

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

  const addSuggestedTags = () => {
    const suggestedTags = [
      trade.asset.toLowerCase(),
      trade.direction,
      trade.result,
      'trading',
      isPortuguese ? 'opcoesbinarias' : 'binaryoptions'
    ]

    const newTags = [...watchedTags]
    suggestedTags.forEach(tag => {
      if (!newTags.includes(tag) && newTags.length < 5) {
        newTags.push(tag)
      }
    })

    setValue('tags', newTags)
  }

  const onSubmit = async (data: ShareFormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/social/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify({
          content: data.content,
          visibility: data.visibility,
          tags: data.tags || [],
          sharedTrade: {
            tradeId: trade.id,
            asset: trade.asset,
            result: trade.result,
            profit: trade.profit,
            amount: trade.amount
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to share trade')
      }

      reset()
      onShared?.()
      onClose()
    } catch (error) {
      console.error('Share trade error:', error)
      // TODO: Show error toast
    }
    setLoading(false)
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Share2 className="h-5 w-5 text-orange-400" />
            <h2 className="text-xl font-bold text-white">
              {isPortuguese ? 'Compartilhar Trade' : 'Share Trade'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {/* Trade Summary */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400 font-medium">
                {isPortuguese ? 'Trade para Compartilhar' : 'Trade to Share'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-400 block">{isPortuguese ? 'Ativo' : 'Asset'}</span>
                <span className="text-white font-medium">{trade.asset}</span>
              </div>
              <div>
                <span className="text-gray-400 block">{isPortuguese ? 'Direção' : 'Direction'}</span>
                <span className="text-white font-medium">{trade.direction.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-gray-400 block">{isPortuguese ? 'Resultado' : 'Result'}</span>
                <span className={`font-medium ${
                  trade.result === 'win' 
                    ? 'text-green-400' 
                    : trade.result === 'loss' 
                      ? 'text-red-400' 
                      : 'text-yellow-400'
                }`}>
                  {trade.result.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">{isPortuguese ? 'Lucro' : 'Profit'}</span>
                <span className={`font-medium ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Content Input */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                {isPortuguese ? 'O que você quer compartilhar?' : 'What do you want to share?'}
              </label>
              <button
                type="button"
                onClick={generateSuggestedContent}
                className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                {isPortuguese ? 'Sugerir texto' : 'Suggest text'}
              </button>
            </div>
            <textarea
              {...register('content')}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-3 border border-gray-600 focus:border-orange-500 outline-none resize-none"
              placeholder={isPortuguese 
                ? 'Compartilhe sua experiência, estratégia ou insights...' 
                : 'Share your experience, strategy or insights...'}
              rows={4}
            />
            {errors.content && (
              <p className="text-red-400 text-sm mt-1">{errors.content.message}</p>
            )}
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-gray-400">
                {isPortuguese ? 'Dica: Compartilhe o que você aprendeu!' : 'Tip: Share what you learned!'}
              </span>
              <span className={`${
                watchedContent.length > 450 
                  ? 'text-red-400' 
                  : watchedContent.length > 400 
                    ? 'text-yellow-400' 
                    : 'text-gray-400'
              }`}>
                {watchedContent.length}/500
              </span>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Tags' : 'Tags'}
            </label>
            
            {/* Current Tags */}
            {watchedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
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
            )}

            {/* Add Tag Input */}
            <div className="flex gap-2 mb-3">
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
                disabled={!tagInput.trim() || watchedTags.length >= 5}
                className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isPortuguese ? 'Adicionar' : 'Add'}
              </button>
            </div>

            {/* Suggested Tags */}
            <button
              type="button"
              onClick={addSuggestedTags}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Hash className="h-3 w-3" />
              {isPortuguese ? 'Adicionar tags sugeridas' : 'Add suggested tags'}
            </button>
          </div>

          {/* Visibility */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Quem pode ver' : 'Who can see'}
            </label>
            <select
              {...register('visibility')}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-orange-500 outline-none"
            >
              <option value="public">
                🌍 {isPortuguese ? 'Público - Qualquer pessoa' : 'Public - Anyone'}
              </option>
              <option value="followers">
                👥 {isPortuguese ? 'Seguidores - Apenas quem me segue' : 'Followers - Only followers'}
              </option>
              <option value="private">
                🔒 {isPortuguese ? 'Privado - Apenas eu' : 'Private - Only me'}
              </option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {getVisibilityIcon(watchedVisibility)}
              <span>
                {watchedVisibility === 'public' 
                  ? (isPortuguese ? 'Público' : 'Public')
                  : watchedVisibility === 'followers'
                    ? (isPortuguese ? 'Seguidores' : 'Followers')
                    : (isPortuguese ? 'Privado' : 'Private')
                }
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                {isPortuguese ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading || !watchedContent.trim() || watchedContent.length > 500}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isPortuguese ? 'Compartilhando...' : 'Sharing...'}
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    {isPortuguese ? 'Compartilhar' : 'Share'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
'use client'

import React, { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useShareTrade } from '@/hooks/useCommunity'
import { Trade } from '@/types/database'

interface ShareTradeModalProps {
  trade: Trade
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ShareTradeModal({ trade, isOpen, onClose, onSuccess }: ShareTradeModalProps) {
  const { isPortuguese } = useLanguage()
  const { shareTrade, loading } = useShareTrade()
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: [] as string[],
    privacy: 'public' as 'public' | 'followers' | 'private',
    shareToFeed: true,
    notifyFollowers: false
  })
  
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Predefined popular tags
  const popularTags = [
    'scalping', 'swing', 'day-trading', 'breakout', 'support-resistance',
    'fibonacci', 'trend-following', 'reversal', 'momentum', 'news-trading'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.title.trim()) {
      setError(isPortuguese ? 'Título é obrigatório' : 'Title is required')
      return
    }

    try {
      const shareData = {
        tradeId: trade.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        tags: formData.tags,
        privacy: formData.privacy,
        shareToFeed: formData.shareToFeed,
        notifyFollowers: formData.notifyFollowers
      }

      const result = await shareTrade(shareData)
      if (result) {
        onSuccess?.()
        onClose()
        // Reset form
        setFormData({
          title: '',
          description: '',
          tags: [],
          privacy: 'public',
          shareToFeed: true,
          notifyFollowers: false
        })
      }
    } catch (err) {
      setError(isPortuguese ? 'Erro ao compartilhar trade' : 'Error sharing trade')
    }
  }

  const addTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase()
    if (cleanTag && !formData.tags.includes(cleanTag) && formData.tags.length < 10) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, cleanTag]
      }))
    }
    setTagInput('')
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <h2 className="text-xl font-bold text-white">
              {isPortuguese ? 'Compartilhar Trade' : 'Share Trade'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trade Preview */}
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            {isPortuguese ? 'Visualização do Trade' : 'Trade Preview'}
          </h3>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Ativo' : 'Asset'}</div>
                <div className="font-bold text-white">{trade.symbol}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Direção' : 'Direction'}</div>
                <div className={`font-bold ${trade.direction === 'call' || trade.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.direction === 'call' || trade.direction === 'long'
                    ? (isPortuguese ? 'BULL' : 'CALL')
                    : (isPortuguese ? 'BEAR' : 'PUT')
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Resultado' : 'Result'}</div>
                <div className={`font-bold ${
                  trade.result === 'win' ? 'text-green-400' :
                  trade.result === 'loss' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {trade.result === 'win' ?
                    (isPortuguese ? 'VITÓRIA' : 'WIN') :
                    trade.result === 'loss' ?
                      (isPortuguese ? 'DERROTA' : 'LOSS') :
                      (isPortuguese ? 'EMPATE' : 'TIE')
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">{isPortuguese ? 'Lucro' : 'Profit'}</div>
                <div className={`font-bold ${(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.abs(trade.pnl || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Share Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Título do Post' : 'Post Title'} *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={isPortuguese ? 'Ex: Grande oportunidade no EURUSD hoje!' : 'Ex: Great EURUSD opportunity today!'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              maxLength={200}
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {formData.title.length}/200
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Descrição (Opcional)' : 'Description (Optional)'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={isPortuguese ? 'Compartilhe sua estratégia, análise ou dicas...' : 'Share your strategy, analysis or tips...'}
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
              maxLength={1000}
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {formData.description.length}/1000
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Tags' : 'Tags'} ({formData.tags.length}/10)
            </label>
            
            {/* Current tags */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag) => (
                  <span key={tag} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    #{tag}
                    <button 
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                placeholder={isPortuguese ? 'Adicionar tag...' : 'Add tag...'}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                disabled={formData.tags.length >= 10}
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim() || formData.tags.length >= 10}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {isPortuguese ? 'Adicionar' : 'Add'}
              </button>
            </div>

            {/* Popular tags */}
            <div>
              <p className="text-xs text-gray-400 mb-2">{isPortuguese ? 'Tags populares:' : 'Popular tags:'}</p>
              <div className="flex flex-wrap gap-2">
                {popularTags.filter(tag => !formData.tags.includes(tag)).slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    disabled={formData.tags.length >= 10}
                    className="text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 px-2 py-1 rounded transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              {isPortuguese ? 'Configurações de Privacidade' : 'Privacy Settings'}
            </label>
            
            <div className="space-y-3">
              {/* Privacy Level */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {isPortuguese ? 'Quem pode ver' : 'Who can see'}
                </label>
                <select
                  value={formData.privacy}
                  onChange={(e) => setFormData(prev => ({ ...prev, privacy: e.target.value as any }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="public">{isPortuguese ? 'Público (todos)' : 'Public (everyone)'}</option>
                  <option value="followers">{isPortuguese ? 'Apenas seguidores' : 'Followers only'}</option>
                  <option value="private">{isPortuguese ? 'Privado (apenas você)' : 'Private (only you)'}</option>
                </select>
              </div>

              {/* Share to feed */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.shareToFeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, shareToFeed: e.target.checked }))}
                  className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm text-white">
                    {isPortuguese ? 'Mostrar no feed da comunidade' : 'Show in community feed'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {isPortuguese ? 'Outros traders poderão ver e interagir' : 'Other traders will be able to see and interact'}
                  </div>
                </div>
              </label>

              {/* Notify followers */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyFollowers}
                  onChange={(e) => setFormData(prev => ({ ...prev, notifyFollowers: e.target.checked }))}
                  className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm text-white">
                    {isPortuguese ? 'Notificar seguidores' : 'Notify followers'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {isPortuguese ? 'Enviar notificação para seus seguidores' : 'Send notification to your followers'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-400">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {isPortuguese ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isPortuguese ? 'Compartilhando...' : 'Sharing...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {isPortuguese ? 'Compartilhar' : 'Share'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
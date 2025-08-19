'use client'

import React, { useState, useRef } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useTrades } from '@/hooks/useTrades'
import { useCreatePost, CreatePostData } from '@/hooks/useCommunity'
import { Trade } from '@/types/trade'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type PostType = 'text' | 'trade-share' | 'poll' | 'ai-question' | 'market-analysis'

interface PollOption {
  id: string
  text: string
}

interface PostData {
  type: PostType
  content: string
  images: File[]
  trade?: Trade
  poll?: {
    question: string
    options: PollOption[]
    duration: number // hours
  }
  aiQuestion?: {
    question: string
    context: string
  }
  tags: string[]
  privacy: 'public' | 'followers' | 'private'
}

export default function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const { trades } = useTrades()
  const { createPost, loading: createLoading, error: createError } = useCreatePost()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [postType, setPostType] = useState<PostType>('text')
  const [postData, setPostData] = useState<PostData>({
    type: 'text',
    content: '',
    images: [],
    tags: [],
    privacy: 'public'
  })
  const [dragOver, setDragOver] = useState(false)

  // Character count limits
  const getCharLimit = () => {
    switch (postType) {
      case 'ai-question': return 500
      case 'poll': return 280
      default: return 500
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!postData.content.trim()) return

    try {
      // Build the create post data
      const createData: CreatePostData = {
        type: postType,
        content: postData.content.trim(),
        tags: postData.tags,
        privacy: postData.privacy,
        shareToFeed: true,
        notifyFollowers: false
      }

      // Add type-specific data
      if (postType === 'trade-share' && postData.trade) {
        createData.tradeId = postData.trade.id
      } else if (postType === 'poll' && postData.poll) {
        createData.poll = {
          question: postData.poll.question,
          options: postData.poll.options,
          duration: postData.poll.duration
        }
      } else if (postType === 'ai-question') {
        createData.aiQuestion = {
          question: postData.content.trim(),
          context: ''
        }
      }

      const result = await createPost(createData)
      if (result) {
        onSuccess?.()
        onClose()
        resetForm()
      }
    } catch (error) {
      console.error('Error creating post:', error)
    }
  }

  const resetForm = () => {
    setPostData({
      type: 'text',
      content: '',
      images: [],
      tags: [],
      privacy: 'public'
    })
    setPostType('text')
  }

  const handleImageUpload = (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length + postData.images.length <= 4) {
      setPostData(prev => ({
        ...prev,
        images: [...prev.images, ...imageFiles]
      }))
    }
  }

  const removeImage = (index: number) => {
    setPostData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const addPollOption = () => {
    if (!postData.poll) {
      setPostData(prev => ({
        ...prev,
        poll: {
          question: '',
          options: [
            { id: '1', text: '' },
            { id: '2', text: '' }
          ],
          duration: 24
        }
      }))
    } else if (postData.poll.options.length < 4) {
      setPostData(prev => ({
        ...prev,
        poll: {
          ...prev.poll!,
          options: [
            ...prev.poll!.options,
            { id: Date.now().toString(), text: '' }
          ]
        }
      }))
    }
  }

  const updatePollOption = (id: string, text: string) => {
    setPostData(prev => ({
      ...prev,
      poll: {
        ...prev.poll!,
        options: prev.poll!.options.map(opt => 
          opt.id === id ? { ...opt, text } : opt
        )
      }
    }))
  }

  const removePollOption = (id: string) => {
    if (postData.poll && postData.poll.options.length > 2) {
      setPostData(prev => ({
        ...prev,
        poll: {
          ...prev.poll!,
          options: prev.poll!.options.filter(opt => opt.id !== id)
        }
      }))
    }
  }

  // Get post type specific placeholder
  const getPlaceholder = () => {
    switch (postType) {
      case 'trade-share':
        return isPortuguese ? 'Compartilhe sua estratégia de trade...' : 'Share your trading strategy...'
      case 'poll':
        return isPortuguese ? 'Faça uma pergunta para a comunidade...' : 'Ask the community a question...'
      case 'ai-question':
        return isPortuguese ? 'Qual sua dúvida sobre trading? Nossa IA pode ajudar...' : 'What\'s your trading question? Our AI can help...'
      case 'market-analysis':
        return isPortuguese ? 'Compartilhe sua análise de mercado...' : 'Share your market analysis...'
      default:
        return isPortuguese ? 'O que está acontecendo no seu trading?' : 'What\'s happening in your trading?'
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      handleImageUpload(e.dataTransfer.files)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-0 focus:shadow-none"
              style={{ outline: 'none', boxShadow: 'none' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-white">
              {isPortuguese ? 'Criar Post' : 'Create Post'}
            </h2>
          </div>
          <button
            onClick={handleSubmit}
            disabled={createLoading || (!postData.content.trim() && postData.images.length === 0)}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white rounded-full font-medium transition-colors flex items-center gap-2 focus:outline-none focus:ring-0 focus:shadow-none"
            style={{ outline: 'none', boxShadow: 'none' }}
          >
            {createLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isPortuguese ? 'Postando...' : 'Posting...'}
              </>
            ) : (
              isPortuguese ? 'Postar' : 'Post'
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User Avatar and Text Area */}
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <textarea
                value={postData.content}
                onChange={(e) => setPostData(prev => ({ ...prev, content: e.target.value }))}
                placeholder={getPlaceholder()}
                className="w-full bg-transparent text-white placeholder-gray-400 text-xl resize-none border-none outline-none focus:outline-none focus:ring-0 focus:shadow-none min-h-[120px]"
                style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
                maxLength={getCharLimit()}
              />
              
              {/* Character count */}
              <div className="text-right text-sm text-gray-400 mt-2">
                {postData.content.length}/{getCharLimit()}
              </div>
            </div>
          </div>

          {/* Post Type Specific Content */}
          {postType === 'trade-share' && (
            <div className="border border-gray-700 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {isPortuguese ? 'Selecionar Trade' : 'Select Trade'}
              </h3>
              <select
                value={postData.trade?.id || ''}
                onChange={(e) => {
                  const selectedTrade = trades?.find(t => t.id === e.target.value)
                  setPostData(prev => ({ ...prev, trade: selectedTrade }))
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">{isPortuguese ? 'Escolha um trade...' : 'Choose a trade...'}</option>
                {trades?.slice(0, 10).map(trade => (
                  <option key={trade.id} value={trade.id}>
                    {trade.asset} • {trade.direction.toUpperCase()} • {trade.result?.toUpperCase()} • ${trade.amount}
                  </option>
                ))}
              </select>
            </div>
          )}

          {postType === 'poll' && (
            <div className="border border-gray-700 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {isPortuguese ? 'Enquete' : 'Poll'}
              </h3>
              
              {postData.poll?.options.map((option, index) => (
                <div key={option.id} className="flex gap-2">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updatePollOption(option.id, e.target.value)}
                    placeholder={`${isPortuguese ? 'Opção' : 'Option'} ${index + 1}`}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    maxLength={100}
                  />
                  {postData.poll!.options.length > 2 && (
                    <button
                      onClick={() => removePollOption(option.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              
              {postData.poll && postData.poll.options.length < 4 && (
                <button
                  onClick={addPollOption}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {isPortuguese ? 'Adicionar opção' : 'Add option'}
                </button>
              )}
              
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400">
                  {isPortuguese ? 'Duração:' : 'Duration:'}
                </label>
                <select
                  value={postData.poll?.duration || 24}
                  onChange={(e) => setPostData(prev => ({
                    ...prev,
                    poll: { ...prev.poll!, duration: parseInt(e.target.value) }
                  }))}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                >
                  <option value={1}>1 {isPortuguese ? 'hora' : 'hour'}</option>
                  <option value={6}>6 {isPortuguese ? 'horas' : 'hours'}</option>
                  <option value={12}>12 {isPortuguese ? 'horas' : 'hours'}</option>
                  <option value={24}>1 {isPortuguese ? 'dia' : 'day'}</option>
                  <option value={168}>7 {isPortuguese ? 'dias' : 'days'}</option>
                </select>
              </div>
            </div>
          )}

          {postType === 'ai-question' && (
            <div className="border border-purple-500/30 rounded-lg p-4 space-y-3 bg-purple-500/5">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {isPortuguese ? 'Perguntar para IA' : 'Ask AI'}
              </h3>
              <p className="text-sm text-purple-300">
                {isPortuguese 
                  ? 'Nossa IA especializada em trading analisará sua pergunta e fornecerá insights valiosos para a comunidade.'
                  : 'Our specialized trading AI will analyze your question and provide valuable insights for the community.'
                }
              </p>
            </div>
          )}

          {/* Image Upload Area */}
          {postData.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {postData.images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drag and Drop Zone */}
          {dragOver && (
            <div className="border-2 border-dashed border-blue-400 rounded-lg p-8 text-center bg-blue-500/5">
              <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-blue-400">
                {isPortuguese ? 'Solte as imagens aqui' : 'Drop images here'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-700 p-4 flex items-center justify-between flex-shrink-0">
          {/* Post Type Buttons */}
          <div className="flex items-center gap-1">
            {/* Image Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-full transition-colors focus:outline-none focus:ring-0 focus:shadow-none"
              style={{ outline: 'none', boxShadow: 'none' }}
              title={isPortuguese ? 'Adicionar imagens' : 'Add images'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Trade Share */}
            <button
              onClick={() => {
                setPostType(postType === 'trade-share' ? 'text' : 'trade-share')
                if (postType !== 'trade-share') {
                  setPostData(prev => ({ ...prev, trade: undefined }))
                }
              }}
              className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-0 focus:shadow-none ${
                postType === 'trade-share' 
                  ? 'text-green-400 bg-green-500/20' 
                  : 'text-green-400 hover:bg-green-500/20'
              }`}
              style={{ outline: 'none', boxShadow: 'none' }}
              title={isPortuguese ? 'Compartilhar trade' : 'Share trade'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </button>

            {/* Poll */}
            <button
              onClick={() => {
                setPostType(postType === 'poll' ? 'text' : 'poll')
                if (postType !== 'poll') {
                  addPollOption()
                } else {
                  setPostData(prev => ({ ...prev, poll: undefined }))
                }
              }}
              className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-0 focus:shadow-none ${
                postType === 'poll' 
                  ? 'text-blue-400 bg-blue-500/20' 
                  : 'text-blue-400 hover:bg-blue-500/20'
              }`}
              style={{ outline: 'none', boxShadow: 'none' }}
              title={isPortuguese ? 'Criar enquete' : 'Create poll'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* AI Question */}
            <button
              onClick={() => setPostType(postType === 'ai-question' ? 'text' : 'ai-question')}
              className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-0 focus:shadow-none ${
                postType === 'ai-question' 
                  ? 'text-purple-400 bg-purple-500/20' 
                  : 'text-purple-400 hover:bg-purple-500/20'
              }`}
              style={{ outline: 'none', boxShadow: 'none' }}
              title={isPortuguese ? 'Perguntar para IA' : 'Ask AI'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

          </div>

          {/* Privacy Settings */}
          <select
            value={postData.privacy}
            onChange={(e) => setPostData(prev => ({ ...prev, privacy: e.target.value as any }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white"
          >
            <option value="public">{isPortuguese ? 'Público' : 'Public'}</option>
            <option value="followers">{isPortuguese ? 'Seguidores' : 'Followers'}</option>
            <option value="private">{isPortuguese ? 'Privado' : 'Private'}</option>
          </select>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  )
}
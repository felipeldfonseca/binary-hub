'use client'
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { createUniqueUsername, usernameExists, updateUsername } from '@/lib/auth'
import { User, Check, X, Loader } from 'lucide-react'

const usernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
})

type UsernameFormData = z.infer<typeof usernameSchema>

interface UsernameSetupProps {
  onComplete: () => void
  onSkip?: () => void
  showSkip?: boolean
}

export default function UsernameSetup({ onComplete, onSkip, showSkip = false }: UsernameSetupProps) {
  const { isPortuguese } = useLanguage()
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [suggestedUsername, setSuggestedUsername] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<UsernameFormData>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: ''
    }
  })

  const watchedUsername = watch('username')

  // Generate suggested username on component mount
  useEffect(() => {
    const generateSuggestion = async () => {
      if (userProfile?.displayName) {
        try {
          const suggestion = await createUniqueUsername(userProfile.displayName)
          setSuggestedUsername(suggestion)
          setValue('username', suggestion)
        } catch (error) {
          console.error('Error generating username suggestion:', error)
        }
      }
    }

    generateSuggestion()
  }, [userProfile?.displayName, setValue])

  // Check username availability when it changes
  useEffect(() => {
    const checkUsername = async () => {
      if (!watchedUsername || watchedUsername.length < 3) {
        setUsernameAvailable(null)
        return
      }

      setCheckingUsername(true)
      try {
        const exists = await usernameExists(watchedUsername)
        setUsernameAvailable(!exists)
      } catch (error) {
        console.error('Error checking username:', error)
        setUsernameAvailable(null)
      }
      setCheckingUsername(false)
    }

    const timeoutId = setTimeout(checkUsername, 500)
    return () => clearTimeout(timeoutId)
  }, [watchedUsername])

  const onSubmit = async (data: UsernameFormData) => {
    if (!user) return

    setLoading(true)

    try {
      // Double-check username availability
      const exists = await usernameExists(data.username)
      if (exists) {
        setUsernameAvailable(false)
        setLoading(false)
        return
      }

      // Update username
      const result = await updateUsername(user.uid, data.username)
      if (!result.success) {
        throw new Error(result.error || 'Failed to update username')
      }

      onComplete()
    } catch (error: any) {
      console.error('Error setting username:', error)
      // Handle error (could show toast notification)
    }

    setLoading(false)
  }

  const handleUseSuggestion = () => {
    if (suggestedUsername) {
      setValue('username', suggestedUsername)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isPortuguese ? 'Escolha seu Nome de Usuário' : 'Choose Your Username'}
          </h1>
          <p className="text-gray-400">
            {isPortuguese 
              ? 'Seu nome de usuário será usado para @menções e compartilhamento de perfil'
              : 'Your username will be used for @mentions and profile sharing'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Username Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Nome de Usuário' : 'Username'}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                @
              </div>
              <input
                {...register('username')}
                type="text"
                className="input-field pl-8 pr-10"
                placeholder={isPortuguese ? 'seuusername' : 'yourusername'}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {checkingUsername && (
                  <Loader className="h-4 w-4 text-gray-400 animate-spin" />
                )}
                {!checkingUsername && usernameAvailable !== null && watchedUsername && watchedUsername.length >= 3 && (
                  <>
                    {usernameAvailable ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Error Messages */}
            {errors.username && (
              <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>
            )}
            {!checkingUsername && usernameAvailable === false && watchedUsername && (
              <p className="text-red-400 text-sm mt-1">
                {isPortuguese ? 'Nome de usuário não disponível' : 'Username not available'}
              </p>
            )}
            
            {/* Success Message */}
            {!checkingUsername && usernameAvailable === true && watchedUsername && (
              <p className="text-green-400 text-sm mt-1">
                {isPortuguese ? 'Nome de usuário disponível!' : 'Username available!'}
              </p>
            )}
          </div>

          {/* Suggestion */}
          {suggestedUsername && suggestedUsername !== watchedUsername && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-300 text-sm mb-2">
                {isPortuguese ? 'Sugestão:' : 'Suggestion:'}
              </p>
              <button
                type="button"
                onClick={handleUseSuggestion}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm text-white transition-colors"
              >
                @{suggestedUsername}
              </button>
            </div>
          )}

          {/* Username Rules */}
          <div className="bg-blue-800/20 rounded-lg p-4 border border-blue-500/30">
            <h4 className="text-blue-400 font-medium mb-2">
              {isPortuguese ? 'Regras do Nome de Usuário:' : 'Username Rules:'}
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• {isPortuguese ? '3-20 caracteres' : '3-20 characters'}</li>
              <li>• {isPortuguese ? 'Apenas letras, números e _' : 'Only letters, numbers, and _'}</li>
              <li>• {isPortuguese ? 'Deve ser único' : 'Must be unique'}</li>
              <li>• {isPortuguese ? 'Não pode ser alterado facilmente' : 'Cannot be changed easily'}</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {showSkip && onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="flex-1 btn btn-secondary"
              >
                {isPortuguese ? 'Pular' : 'Skip'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !usernameAvailable || checkingUsername}
              className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  {isPortuguese ? 'Salvando...' : 'Saving...'}
                </span>
              ) : (
                isPortuguese ? 'Confirmar' : 'Confirm'
              )}
            </button>
          </div>
        </form>

        {/* Additional Info */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            {isPortuguese 
              ? 'Você poderá alterar seu nome de usuário nas configurações, mas isso pode afetar links compartilhados.'
              : 'You can change your username in settings, but this may affect shared links.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
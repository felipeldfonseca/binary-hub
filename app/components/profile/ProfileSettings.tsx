'use client'
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { updateUsername, usernameExists } from '@/lib/auth'
import Avatar from '@/components/ui/Avatar'

// Validation schema for profile settings
const profileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
  bio: z.string().max(160, 'Bio must be at most 160 characters').optional(),
  location: z.string().max(50, 'Location must be at most 50 characters').optional(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tradingSince: z.string().optional(),
  allowsFollows: z.boolean(),
  requiresFollowApproval: z.boolean(),
  showsOnlineStatus: z.boolean(),
  allowsDirectMessages: z.boolean(),
  defaultPostVisibility: z.enum(['public', 'followers', 'private']),
  autoShareTrades: z.boolean(),
  notifyOnMentions: z.boolean(),
  notifyOnFollows: z.boolean()
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfileSettings() {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      username: '',
      bio: '',
      location: '',
      website: '',
      tradingSince: '',
      allowsFollows: true,
      requiresFollowApproval: false,
      showsOnlineStatus: true,
      allowsDirectMessages: true,
      defaultPostVisibility: 'public',
      autoShareTrades: false,
      notifyOnMentions: true,
      notifyOnFollows: true
    }
  })

  const watchedUsername = watch('username')

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


  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return

    setLoading(true)
    setMessage(null)

    try {
      // Check username availability one more time if changed
      if (data.username) {
        const exists = await usernameExists(data.username)
        if (exists) {
          setMessage({ type: 'error', text: isPortuguese ? 'Nome de usuário não disponível' : 'Username not available' })
          setLoading(false)
          return
        }
      }

      // Update username if changed
      if (data.username) {
        const result = await updateUsername(user.uid, data.username)
        if (!result.success) {
          setMessage({ type: 'error', text: result.error || 'Failed to update username' })
          setLoading(false)
          return
        }
      }

      // Prepare update data for API
      const updateData = {
        username: data.username,
        bio: data.bio,
        location: data.location,
        website: data.website,
        tradingSince: data.tradingSince,
        privacy: {
          allowsFollows: data.allowsFollows,
          requiresFollowApproval: data.requiresFollowApproval,
          showsOnlineStatus: data.showsOnlineStatus,
          allowsDirectMessages: data.allowsDirectMessages
        },
        socialPreferences: {
          defaultPostVisibility: data.defaultPostVisibility,
          autoShareTrades: data.autoShareTrades,
          notifyOnMentions: data.notifyOnMentions,
          notifyOnFollows: data.notifyOnFollows
        }
      }

      // Make API call to update profile
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing` // TODO: Use real token
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }

      setMessage({ 
        type: 'success', 
        text: isPortuguese ? 'Perfil atualizado com sucesso!' : 'Profile updated successfully!' 
      })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setMessage({ 
        type: 'error', 
        text: error.message || (isPortuguese ? 'Erro ao atualizar perfil' : 'Error updating profile')
      })
    }

    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {isPortuguese ? 'Configurações do Perfil' : 'Profile Settings'}
        </h1>
        <p className="text-gray-400">
          {isPortuguese 
            ? 'Gerencie suas informações pessoais e configurações sociais'
            : 'Manage your personal information and social settings'
          }
        </p>
      </div>

      {/* Avatar Section */}
      <div className="card mb-8">
        <div className="flex items-center gap-6">
          <Avatar 
            src={user?.photoURL || undefined} 
            alt={user?.displayName || undefined}
            size="xl"
          />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {isPortuguese ? 'Foto do Perfil' : 'Profile Picture'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {isPortuguese 
                ? 'Conecte com Google ou Apple para usar sua foto de perfil'
                : 'Connect with Google or Apple to use your profile picture'
              }
            </p>
            <button className="btn btn-secondary">
              {isPortuguese ? 'Alterar Foto' : 'Change Photo'}
            </button>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`card mb-6 ${
          message.type === 'success' 
            ? 'bg-green-800/20 border-green-500/30' 
            : 'bg-red-800/20 border-red-500/30'
        }`}>
          <p className={`${
            message.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isPortuguese ? 'Informações Básicas' : 'Basic Information'}
          </h3>
          
          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Nome de Exibição' : 'Display Name'}
              </label>
              <input
                {...register('displayName')}
                type="text"
                className="input-field"
                placeholder={isPortuguese ? 'Seu nome completo' : 'Your full name'}
              />
              {errors.displayName && (
                <p className="text-red-400 text-sm mt-1">{errors.displayName.message}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Nome de Usuário' : 'Username'}
              </label>
              <div className="relative">
                <input
                  {...register('username')}
                  type="text"
                  className="input-field pr-10"
                  placeholder={isPortuguese ? 'seuusername' : 'yourusername'}
                />
                {checkingUsername && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                  </div>
                )}
                {!checkingUsername && usernameAvailable !== null && watchedUsername && watchedUsername.length >= 3 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {usernameAvailable ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </div>
                )}
              </div>
              {errors.username && (
                <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>
              )}
              {!checkingUsername && usernameAvailable === false && watchedUsername && (
                <p className="text-red-400 text-sm mt-1">
                  {isPortuguese ? 'Nome de usuário não disponível' : 'Username not available'}
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Bio' : 'Bio'}
              </label>
              <textarea
                {...register('bio')}
                rows={3}
                className="input-field resize-none"
                placeholder={isPortuguese ? 'Conte um pouco sobre você...' : 'Tell us about yourself...'}
              />
              {errors.bio && (
                <p className="text-red-400 text-sm mt-1">{errors.bio.message}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Localização' : 'Location'}
              </label>
              <input
                {...register('location')}
                type="text"
                className="input-field"
                placeholder={isPortuguese ? 'São Paulo, Brasil' : 'New York, USA'}
              />
              {errors.location && (
                <p className="text-red-400 text-sm mt-1">{errors.location.message}</p>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Website' : 'Website'}
              </label>
              <input
                {...register('website')}
                type="url"
                className="input-field"
                placeholder="https://seusite.com"
              />
              {errors.website && (
                <p className="text-red-400 text-sm mt-1">{errors.website.message}</p>
              )}
            </div>

            {/* Trading Since */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Negociando Desde' : 'Trading Since'}
              </label>
              <input
                {...register('tradingSince')}
                type="text"
                className="input-field"
                placeholder={isPortuguese ? 'Janeiro 2023' : 'January 2023'}
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isPortuguese ? 'Configurações de Privacidade' : 'Privacy Settings'}
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Permitir Seguidores' : 'Allow Followers'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Outros usuários podem seguir seu perfil'
                    : 'Other users can follow your profile'
                  }
                </p>
              </div>
              <input
                {...register('allowsFollows')}
                type="checkbox"
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Aprovar Seguidores' : 'Approve Followers'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Aprovar manualmente novos seguidores'
                    : 'Manually approve new followers'
                  }
                </p>
              </div>
              <input
                {...register('requiresFollowApproval')}
                type="checkbox"
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Mostrar Status Online' : 'Show Online Status'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Outros podem ver quando você está online'
                    : 'Others can see when you are online'
                  }
                </p>
              </div>
              <input
                {...register('showsOnlineStatus')}
                type="checkbox"
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Mensagens Diretas' : 'Direct Messages'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Permitir receber mensagens diretas'
                    : 'Allow receiving direct messages'
                  }
                </p>
              </div>
              <input
                {...register('allowsDirectMessages')}
                type="checkbox"
                className="toggle"
              />
            </div>
          </div>
        </div>

        {/* Social Preferences */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isPortuguese ? 'Preferências Sociais' : 'Social Preferences'}
          </h3>
          
          <div className="space-y-4">
            {/* Default Post Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Visibilidade Padrão dos Posts' : 'Default Post Visibility'}
              </label>
              <select {...register('defaultPostVisibility')} className="input-field">
                <option value="public">
                  {isPortuguese ? 'Público' : 'Public'}
                </option>
                <option value="followers">
                  {isPortuguese ? 'Apenas Seguidores' : 'Followers Only'}
                </option>
                <option value="private">
                  {isPortuguese ? 'Privado' : 'Private'}
                </option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Compartilhar Trades Automaticamente' : 'Auto Share Trades'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Compartilhar automaticamente trades bem-sucedidos'
                    : 'Automatically share successful trades'
                  }
                </p>
              </div>
              <input
                {...register('autoShareTrades')}
                type="checkbox"
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Notificar Menções' : 'Notify on Mentions'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Receber notificações quando mencionado'
                    : 'Receive notifications when mentioned'
                  }
                </p>
              </div>
              <input
                {...register('notifyOnMentions')}
                type="checkbox"
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium">
                  {isPortuguese ? 'Notificar Novos Seguidores' : 'Notify on New Followers'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {isPortuguese 
                    ? 'Receber notificações de novos seguidores'
                    : 'Receive notifications for new followers'
                  }
                </p>
              </div>
              <input
                {...register('notifyOnFollows')}
                type="checkbox"
                className="toggle"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                {isPortuguese ? 'Salvando...' : 'Saving...'}
              </span>
            ) : (
              isPortuguese ? 'Salvar Alterações' : 'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
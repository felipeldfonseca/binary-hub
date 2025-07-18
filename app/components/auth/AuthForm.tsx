'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useSessionStorage } from '@/lib/hooks/useSessionStorage'
import { 
  XMarkIcon as X, 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
  EnvelopeIcon as Mail, 
  LockClosedIcon as Lock, 
  UserIcon as User, 
  ArrowRightIcon as ArrowRight 
} from '@heroicons/react/24/outline'

interface AuthFormProps {
  isOpen: boolean
  onClose: () => void
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
}

export default function AuthForm({ isOpen, onClose, mode, onModeChange }: AuthFormProps) {
  const { register, login, error, loading, clearError } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [persistedError, setPersistentError, removePersistentError, isClient] = useSessionStorage<string | null>('auth_error', null)

  // Set local error when persisted error is found
  useEffect(() => {
    if (persistedError && isClient) {
      console.log('Found persisted error, setting localError:', persistedError)
      setLocalError(persistedError)
      removePersistentError()
    }
  }, [persistedError, isClient, removePersistentError])

  // Clear errors when form opens or mode changes
  useEffect(() => {
    if (isOpen) {
      clearError()
      // Don't clear localError here if it's from sessionStorage
      if (!persistedError) {
        setLocalError(null)
      }
    }
  }, [isOpen, mode, clearError])

  // Debug: Log localError changes
  useEffect(() => {
    console.log('localError changed:', localError)
  }, [localError])

  // Debug: Log router changes
  useEffect(() => {
    console.log('Router pathname changed')
  }, [router])

  // Convert Firebase error messages to user-friendly messages
  const getErrorMessage = (error: string): string => {
    if (error.includes('auth/user-not-found') || error.includes('auth/wrong-password') || error.includes('auth/invalid-credential')) {
      return 'Invalid email or password.'
    }
    if (error.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists.'
    }
    if (error.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.'
    }
    if (error.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.'
    }
    if (error.includes('auth/too-many-requests')) {
      return 'Too many failed attempts. Please try again later.'
    }
    // Default fallback for any other errors
    return error.includes('Firebase:') ? 'Authentication failed. Please try again.' : error
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Name validation for signup
    if (mode === 'signup') {
      if (!formData.name.trim()) {
        errors.name = 'Name is required'
      } else if (formData.name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters'
      }
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    // Confirm password validation for signup
    if (mode === 'signup') {
      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password'
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    console.log('Form submitted')
    if (e) {
      e.preventDefault()
      console.log('Default prevented')
    }
    
    if (!validateForm()) {
      console.log('Form validation failed')
      return
    }

    console.log('Form validation passed')
    
    // Clear any previous local errors
    setLocalError(null)

    try {
      let result
      if (mode === 'signup') {
        console.log('Calling register...')
        result = await register(formData.email, formData.password, formData.name)
      } else {
        console.log('Calling login...')
        result = await login(formData.email, formData.password)
      }
      
      console.log('Auth result:', result)
      
      if (result.success) {
        console.log('Auth success - closing form')
        // Reset form and close modal on success
        setFormData({ name: '', email: '', password: '', confirmPassword: '' })
        setFormErrors({})
        setLocalError(null)
        onClose()
      } else {
        console.log('Auth failed - showing error')
        // Set local error and keep form open
        const errorMessage = result.error || 'Authentication failed'
        console.log('Auth error:', errorMessage)
        const friendlyError = getErrorMessage(errorMessage)
        console.log('Friendly error:', friendlyError)
        
        // Persist error message in sessionStorage for page reloads
        console.log('Persisting error to sessionStorage:', friendlyError)
        setPersistentError(friendlyError)
        setLocalError(friendlyError)
      }
    } catch (error) {
      console.error('Unexpected error in handleSubmit:', error)
      const errorMessage = 'An unexpected error occurred. Please try again.'
      // Persist error message in sessionStorage for page reloads
      setPersistentError(errorMessage)
      setLocalError(errorMessage)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
    // Clear local error when user starts typing
    if (localError) {
      setLocalError(null)
      // Also clear from sessionStorage
      removePersistentError()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', confirmPassword: '' })
    setFormErrors({})
    setLocalError(null)
    setShowPassword(false)
    setShowConfirmPassword(false)
    // Clear persisted error when resetting form
    removePersistentError()
  }

  const handleModeChange = (newMode: 'signin' | 'signup') => {
    resetForm()
    onModeChange(newMode)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Error Display */}
          {localError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{localError}</p>
            </div>
          )}

          {/* Name Field (Signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
                    formErrors.name
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                  placeholder="Enter your full name"
                />
              </div>
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.name}</p>
              )}
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
                         <div className="relative">
               <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
               <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
                  formErrors.email
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                placeholder="Enter your email"
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
                         <div className="relative">
               <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                               <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
                   formErrors.password
                     ? 'border-red-300 dark:border-red-600'
                     : 'border-gray-300 dark:border-gray-600'
                 } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                 placeholder="Enter your password"
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
               >
                 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
               </button>
            </div>
            {formErrors.password && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.password}</p>
            )}
          </div>

          {/* Confirm Password Field (Signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
                             <div className="relative">
                 <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                 <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
                     formErrors.confirmPassword
                       ? 'border-red-300 dark:border-red-600'
                       : 'border-gray-300 dark:border-gray-600'
                   } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                   placeholder="Confirm your password"
                 />
                 <button
                   type="button"
                   onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                   className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                 >
                   {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                 </button>
              </div>
              {formErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.confirmPassword}</p>
              )}
            </div>
          )}

                    {/* Forgot Password Link (Sign In only) */}
          {mode === 'signin' && (
            <div className="text-center">
              <a
                href="/auth/forgot-password"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Forgot your password?
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
             <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
           ) : (
             <>
               {mode === 'signup' ? 'Create Account' : 'Sign In'}
               <ArrowRight className="w-5 h-5" />
             </>
           )}
          </button>

          {/* Mode Toggle */}
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={() => handleModeChange(mode === 'signup' ? 'signin' : 'signup')}
                className="ml-1 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {mode === 'signup' ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 
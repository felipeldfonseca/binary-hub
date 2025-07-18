'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { 
  AuthUser, 
  formatUser, 
  createUserProfile,
  registerWithEmail,
  loginWithEmail,
  signInWithGoogle,
  signInWithApple,
  logout as authLogout,
  resetPassword
} from '../auth'

// Context Types
interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  error: string | null
  
  // Auth Methods
  register: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>
  loginWithApple: () => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>
  clearError: () => void
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider Props
interface AuthProviderProps {
  children: ReactNode
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const authUser = formatUser(firebaseUser)
          await createUserProfile(authUser)
          setUser(authUser)
        } else {
          setUser(null)
        }
      } catch (error: any) {
        console.error('Auth state change error:', error)
        setError(error.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  // Clear error
  const clearError = () => {
    setError(null)
  }

  // Register with email
  const register = async (email: string, password: string, displayName?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const { user: authUser, error: authError } = await registerWithEmail(email, password, displayName)
      
      if (authError) {
        setError(authError)
        return { success: false, error: authError }
      }
      
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Login with email
  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const { user: authUser, error: authError } = await loginWithEmail(email, password)
      
      if (authError) {
        setError(authError)
        return { success: false, error: authError }
      }
      
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { user: authUser, error: authError } = await signInWithGoogle()
      
      if (authError) {
        setError(authError)
        return { success: false, error: authError }
      }
      
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Google login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Login with Apple
  const loginWithApple = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { user: authUser, error: authError } = await signInWithApple()
      
      if (authError) {
        setError(authError)
        return { success: false, error: authError }
      }
      
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Apple login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const logout = async () => {
    try {
      setLoading(true)
      setError(null)
      
      await authLogout()
      setUser(null)
    } catch (error: any) {
      setError(error.message || 'Logout failed')
    } finally {
      setLoading(false)
    }
  }

  // Send password reset
  const sendPasswordReset = async (email: string) => {
    try {
      setError(null)
      
      const { error: resetError } = await resetPassword(email)
      
      if (resetError) {
        setError(resetError)
        return { success: false, error: resetError }
      }
      
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Password reset failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Context value
  const value: AuthContextType = {
    user,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    loginWithApple,
    logout,
    sendPasswordReset,
    clearError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 
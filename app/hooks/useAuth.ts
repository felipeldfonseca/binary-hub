import { useAuth as useAuthContext } from '../lib/contexts/AuthContextSupabase'

// Re-export the useAuth hook from context
export const useAuth = useAuthContext

// Additional auth utilities
export const useAuthState = () => {
  const { user, loading } = useAuthContext()

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isLoading: loading
  }
}

// Hook for checking if user is authenticated
export const useRequireAuth = () => {
  const { user, loading } = useAuthContext()

  return {
    user,
    loading,
    isAuthenticated: !!user,
    requireAuth: !loading && !user
  }
}

// Hook for auth actions only
export const useAuthActions = () => {
  const {
    signUp: register,
    signIn: login,
    signInWithGoogle: loginWithGoogle,
    signOut: logout,
    resetPassword: sendPasswordReset,
  } = useAuthContext()

  return {
    register: async (email: string, password: string, displayName?: string) => {
      const { error } = await register(email, password, displayName)
      if (error) throw error
    },
    login: async (email: string, password: string) => {
      const { error } = await login(email, password)
      if (error) throw error
    },
    loginWithGoogle: async () => {
      const { error } = await loginWithGoogle()
      if (error) throw error
    },
    loginWithApple: async () => {
      // Apple login not implemented yet in Supabase version
      console.warn('Apple login not yet implemented')
    },
    logout,
    sendPasswordReset: async (email: string) => {
      const { error } = await sendPasswordReset(email)
      if (error) throw error
    },
    clearError: () => {
      // No-op for compatibility
    }
  }
}

// Hook for auth error handling
export const useAuthError = () => {
  return {
    error: null,
    clearError: () => {},
    hasError: false
  }
}

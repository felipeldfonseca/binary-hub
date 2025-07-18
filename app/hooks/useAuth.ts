import { useAuth as useAuthContext } from '../lib/contexts/AuthContext'

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
    register, 
    login, 
    loginWithGoogle, 
    loginWithApple, 
    logout, 
    sendPasswordReset,
    clearError 
  } = useAuthContext()
  
  return {
    register,
    login,
    loginWithGoogle,
    loginWithApple,
    logout,
    sendPasswordReset,
    clearError
  }
}

// Hook for auth error handling
export const useAuthError = () => {
  const { error, clearError } = useAuthContext()
  
  return {
    error,
    clearError,
    hasError: !!error
  }
} 
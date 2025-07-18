'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface PublicRouteProps {
  children: React.ReactNode
  redirectTo?: string
  fallback?: React.ReactNode
}

export default function PublicRoute({ 
  children, 
  redirectTo = '/dashboard',
  fallback 
}: PublicRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  // Show loading state while checking authentication
  if (loading) {
    return (
      fallback || (
        <div className="min-h-screen bg-dark-background flex items-center justify-center">
          <div className="text-center">
            {/* Binary Hub Logo */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-1">
                <div className="logo-poly font-normal text-primary text-3xl">
                  binary
                </div>
                <div className="bg-primary text-dark-background px-2 py-1 rounded-15px font-poly text-dark-background font-normal text-3xl">
                  hub
                </div>
              </div>
            </div>
            
            {/* Loading Spinner */}
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white text-lg">Loading...</span>
            </div>
          </div>
        </div>
      )
    )
  }

  // Don't render children if user is authenticated (will be redirected)
  if (user) {
    return null
  }

  // Render children if user is not authenticated
  return <>{children}</>
} 
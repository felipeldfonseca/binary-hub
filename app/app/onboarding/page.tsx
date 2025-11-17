'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/hooks/useAuth'
import { onboardingService } from '@/lib/services/onboardingService'

export default function OnboardingPage() {
  const router = useRouter()
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [shouldShowWizard, setShouldShowWizard] = useState(false)

  // Check if user has already completed onboarding
  useEffect(() => {
    if (!user) {
      setIsCheckingStatus(false)
      return
    }

    const checkStatus = async () => {
      try {
        const status = await onboardingService.checkOnboardingStatus()
        
        if (status.completed) {
          console.log('✅ User already completed onboarding, redirecting to dashboard')
          const dashboardUrl = isPortuguese ? '/dashboard?lang=pt' : '/dashboard'
          router.replace(dashboardUrl)
        } else {
          console.log('👋 User needs to complete onboarding')
          setShouldShowWizard(true)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // On error, show the wizard to be safe
        setShouldShowWizard(true)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkStatus()
  }, [user, router, isPortuguese])

  const handleOnboardingComplete = async () => {
    console.log('🎉 Onboarding completed! Marking as done and redirecting...')
    
    try {
      // Mark onboarding as completed
      await onboardingService.markOnboardingCompleted()
      
      // Small delay to ensure everything is saved
      setTimeout(() => {
        const dashboardUrl = isPortuguese ? '/dashboard?lang=pt' : '/dashboard'
        console.log('Redirecting to:', dashboardUrl)
        router.replace(dashboardUrl)
      }, 1000)
    } catch (error) {
      console.error('Error completing onboarding:', error)
      // Still redirect, but user might need to go through onboarding again
      const dashboardUrl = isPortuguese ? '/dashboard?lang=pt' : '/dashboard'
      router.replace(dashboardUrl)
    }
  }

  // Show loading while checking status
  if (isCheckingStatus) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400">
              {isPortuguese ? 'Verificando status...' : 'Checking status...'}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Show wizard only if user needs onboarding
  if (!shouldShowWizard) {
    return null
  }

  return (
    <ProtectedRoute>
      <OnboardingWizard onComplete={handleOnboardingComplete} />
    </ProtectedRoute>
  )
}
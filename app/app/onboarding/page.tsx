'use client'

import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function OnboardingPage() {
  const router = useRouter()
  const { isPortuguese } = useLanguage()

  const handleOnboardingComplete = () => {
    console.log('Onboarding completed! Redirecting to dashboard...')
    
    // Small delay to ensure market accounts are saved before redirect
    setTimeout(() => {
      const dashboardUrl = isPortuguese ? '/dashboard?lang=pt' : '/dashboard'
      console.log('Redirecting to:', dashboardUrl)
      router.push(dashboardUrl)
    }, 500)
  }

  return (
    <ProtectedRoute>
      <OnboardingWizard onComplete={handleOnboardingComplete} />
    </ProtectedRoute>
  )
}
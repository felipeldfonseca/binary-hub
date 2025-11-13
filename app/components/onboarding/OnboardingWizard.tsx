'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/hooks/useAuth'
import WelcomeStep from './steps/WelcomeStep'
import PlatformOverviewStep from './steps/PlatformOverviewStep'
import MarketSelectionStep from './steps/MarketSelectionStep'
import PreferencesStep from './steps/PreferencesStep'
import CompleteStep from './steps/CompleteStep'
import { MarketSelectionData } from '@/types/markets'

interface OnboardingWizardProps {
  onComplete: () => void
}

export interface OnboardingData {
  selectedMarkets: MarketSelectionData[]
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  tradingStyle: string[]
  goals: string[]
  notifications: {
    tradeAlerts: boolean
    performanceReports: boolean
    aiInsights: boolean
    socialUpdates: boolean
  }
  privacy: {
    sharePerformance: boolean
    shareTradeHistory: boolean
    allowFollowers: boolean
  }
}

type OnboardingStep = 'welcome' | 'overview' | 'markets' | 'preferences' | 'complete'

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    selectedMarkets: [],
    experienceLevel: 'beginner',
    tradingStyle: [],
    goals: [],
    notifications: {
      tradeAlerts: true,
      performanceReports: true,
      aiInsights: true,
      socialUpdates: false
    },
    privacy: {
      sharePerformance: false,
      shareTradeHistory: false,
      allowFollowers: true
    }
  })

  const steps: OnboardingStep[] = ['welcome', 'overview', 'markets', 'preferences', 'complete']
  const currentStepIndex = steps.indexOf(currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const updateOnboardingData = (updates: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...updates }))
  }

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }

  const handleComplete = async () => {
    console.log('Starting onboarding completion...', onboardingData)
    
    if (onboardingData.selectedMarkets.length === 0) {
      setError(isPortuguese 
        ? 'Por favor, selecione pelo menos um mercado'
        : 'Please select at least one market'
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Sending market accounts to API:', onboardingData.selectedMarkets)
      
      // Create market accounts via API
      const response = await fetch('/api/v1/markets/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify({
          marketAccounts: onboardingData.selectedMarkets
        })
      })

      console.log('API Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to create market accounts')
      }

      const result = await response.json()
      console.log('API Success:', result)

      // Complete onboarding
      console.log('Calling onComplete callback...')
      onComplete()
    } catch (error: any) {
      console.error('Onboarding completion failed:', error)
      setError(error.message || (isPortuguese 
        ? 'Erro ao configurar conta. Tente novamente.'
        : 'Failed to setup account. Please try again.'
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <WelcomeStep
            user={user}
            onNext={goToNextStep}
          />
        )
      case 'overview':
        return (
          <PlatformOverviewStep
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )
      case 'markets':
        return (
          <MarketSelectionStep
            selectedMarkets={onboardingData.selectedMarkets}
            onMarketChange={(markets) => updateOnboardingData({ selectedMarkets: markets })}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )
      case 'preferences':
        return (
          <PreferencesStep
            data={onboardingData}
            onDataChange={updateOnboardingData}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )
      case 'complete':
        return (
          <CompleteStep
            data={onboardingData}
            onComplete={handleComplete}
            onBack={goToPreviousStep}
            isLoading={isLoading}
            error={error}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Progress Bar */}
      {currentStep !== 'welcome' && (
        <div className="fixed top-0 left-0 w-full z-50 bg-gray-900/80 backdrop-blur-sm">
          <div className="h-1 bg-gray-700">
            <div 
              className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="text-gray-300 text-sm font-medium">
              {isPortuguese ? 'Configuração Inicial' : 'Initial Setup'}
            </div>
            <div className="text-gray-400 text-sm">
              {currentStepIndex + 1} / {steps.length}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className={currentStep !== 'welcome' ? 'pt-16' : ''}>
        {renderStep()}
      </div>
    </div>
  )
}
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import AuthForm from '@/components/auth/AuthForm'
import MarketSelectionStep from '@/components/auth/MarketSelectionStep'
import { MarketSelectionData, MarketAccount, MarketType } from '@/types/markets'
import Link from 'next/link'

export interface RegistrationData {
  personalInfo: {
    email: string
    password: string
    displayName: string
    acceptedTerms: boolean
  } | null
  marketAccounts: MarketSelectionData[]
  currentStep: 'auth' | 'markets' | 'confirmation'
}

interface MultiStepRegistrationProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function MultiStepRegistration({ 
  isOpen, 
  onClose, 
  onComplete 
}: MultiStepRegistrationProps) {
  const { isPortuguese } = useLanguage()
  const router = useRouter()
  const { register } = useAuth()
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    personalInfo: null,
    marketAccounts: [],
    currentStep: 'auth'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuthComplete = (authData: any) => {
    console.log('Auth completed:', authData)
    setRegistrationData(prev => ({
      ...prev,
      personalInfo: authData,
      currentStep: 'markets'
    }))
  }

  const handleMarketSelectionComplete = () => {
    if (registrationData.marketAccounts.length === 0) {
      setError(isPortuguese 
        ? 'Por favor, selecione pelo menos um mercado'
        : 'Please select at least one market'
      )
      return
    }
    
    setRegistrationData(prev => ({
      ...prev,
      currentStep: 'confirmation'
    }))
  }

  const handleBackToMarkets = () => {
    setRegistrationData(prev => ({
      ...prev,
      currentStep: 'markets'
    }))
  }

  const handleBackToAuth = () => {
    setRegistrationData(prev => ({
      ...prev,
      currentStep: 'auth'
    }))
  }

  const handleCreateAccount = async () => {
    if (!registrationData.personalInfo || registrationData.marketAccounts.length === 0) {
      setError(isPortuguese 
        ? 'Dados de registro incompletos'
        : 'Incomplete registration data'
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Create Firebase user account
      const result = await register(
        registrationData.personalInfo.email,
        registrationData.personalInfo.password,
        registrationData.personalInfo.displayName
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create account')
      }

      // Create market accounts via API  
      const response = await fetch('/api/v1/markets/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify({
          marketAccounts: registrationData.marketAccounts
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create market accounts')
      }

      // Success - redirect to dashboard
      router.push('/dashboard')
      onComplete()
    } catch (error: any) {
      console.error('Registration failed:', error)
      setError(error.message || (isPortuguese 
        ? 'Erro ao criar conta. Tente novamente.'
        : 'Failed to create account. Please try again.'
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateMarkets = (markets: MarketSelectionData[]) => {
    setRegistrationData(prev => ({
      ...prev,
      marketAccounts: markets
    }))
  }

  if (!isOpen) return null

  // Step 1: Authentication
  if (registrationData.currentStep === 'auth') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {isPortuguese ? 'Criar Conta' : 'Create Account'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-6 h-6 bg-primary text-gray-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span>{isPortuguese ? 'Informações Pessoais' : 'Personal Information'}</span>
              <span>→</span>
              <span className="w-6 h-6 bg-gray-600 text-gray-300 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span>{isPortuguese ? 'Mercados' : 'Markets'}</span>
              <span>→</span>
              <span className="w-6 h-6 bg-gray-600 text-gray-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>{isPortuguese ? 'Confirmar' : 'Confirm'}</span>
            </div>
          </div>

          <AuthForm
            isOpen={true}
            onClose={onClose}
            mode="signup"
            onModeChange={() => {}}
            onSuccess={handleAuthComplete}
            isEmbedded={true}
          />
        </div>
      </div>
    )
  }

  // Step 2: Market Selection
  if (registrationData.currentStep === 'markets') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto">
        <div className="bg-gray-900 min-h-full w-full">
          <MarketSelectionStep
            selectedMarkets={registrationData.marketAccounts}
            onMarketChange={handleUpdateMarkets}
            onNext={handleMarketSelectionComplete}
            onBack={handleBackToAuth}
          />
        </div>
      </div>
    )
  }

  // Step 3: Confirmation
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-gray-900 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {isPortuguese ? 'Pronto para começar!' : 'Ready to get started!'}
          </h2>
          <p className="text-gray-400">
            {isPortuguese 
              ? 'Revise suas informações e crie sua conta'
              : 'Review your information and create your account'
            }
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8 justify-center">
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</span>
          <span>{isPortuguese ? 'Conta' : 'Account'}</span>
          <span>→</span>
          <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</span>
          <span>{isPortuguese ? 'Mercados' : 'Markets'}</span>
          <span>→</span>
          <span className="w-6 h-6 bg-primary text-gray-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
          <span>{isPortuguese ? 'Finalizar' : 'Finish'}</span>
        </div>

        {/* Account Summary */}
        <div className="mb-6">
          <h3 className="font-semibold text-white mb-3">
            {isPortuguese ? 'Informações da Conta' : 'Account Information'}
          </h3>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">{isPortuguese ? 'Email:' : 'Email:'}</span>
                <span className="text-white ml-2">{registrationData.personalInfo?.email}</span>
              </div>
              <div>
                <span className="text-gray-400">{isPortuguese ? 'Nome:' : 'Name:'}</span>
                <span className="text-white ml-2">{registrationData.personalInfo?.displayName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Accounts Summary */}
        <div className="mb-8">
          <h3 className="font-semibold text-white mb-3">
            {isPortuguese ? 'Contas de Trading' : 'Trading Accounts'}
          </h3>
          <div className="space-y-3">
            {registrationData.marketAccounts.map((market) => (
              <div key={market.marketType} className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-lg">
                      📊
                    </div>
                    <div>
                      <div className="font-medium text-white">{market.displayName}</div>
                      <div className="text-sm text-gray-400">{market.marketType}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {market.currency} {market.initialBankroll.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400">{market.experienceLevel}</div>
                    {market.isPrimary && (
                      <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full mt-1">
                        {isPortuguese ? 'Principal' : 'Primary'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Terms Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-400 text-sm">
            {isPortuguese 
              ? 'Ao criar sua conta, você concorda com nossos '
              : 'By creating your account, you agree to our '
            }
            <Link href="/terms" className="underline hover:text-blue-300">
              {isPortuguese ? 'Termos de Serviço' : 'Terms of Service'}
            </Link>
            {isPortuguese ? ' e ' : ' and '}
            <Link href="/privacy" className="underline hover:text-blue-300">
              {isPortuguese ? 'Política de Privacidade' : 'Privacy Policy'}
            </Link>
            .
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleBackToMarkets}
            disabled={isLoading}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {isPortuguese ? '← Editar Mercados' : '← Edit Markets'}
          </button>

          <button
            onClick={handleCreateAccount}
            disabled={isLoading}
            className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
            )}
            {isLoading 
              ? (isPortuguese ? 'Criando...' : 'Creating...')
              : (isPortuguese ? 'Criar Conta →' : 'Create Account →')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
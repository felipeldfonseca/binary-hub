'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AuthForm from '@/components/auth/AuthForm'
import PublicRoute from '@/components/auth/PublicRoute'
import { useSessionStorage } from '@/lib/hooks/useSessionStorage'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function SignInPage() {
  const router = useRouter()
  const { loginWithGoogle, loginWithApple } = useAuth()
  const { isPortuguese } = useLanguage()
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [persistedError, , , isClient] = useSessionStorage<string | null>('auth_error', null)

  // Check for persisted error and show form if it exists
  useEffect(() => {
    if (persistedError && isClient) {
      console.log('Login page found persisted error, showing form')
      setShowAuthForm(true)
    }
  }, [persistedError, isClient])

  const handleGoBack = () => {
    router.push(isPortuguese ? '/?lang=pt' : '/')
  }

  const handleEmailSignIn = () => {
    setAuthMode('signin')
    setShowAuthForm(true)
  }

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle()
      router.push(isPortuguese ? '/dashboard?lang=pt' : '/dashboard')
    } catch (error) {
      console.error('Google sign in failed:', error)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      await loginWithApple()
      router.push(isPortuguese ? '/dashboard?lang=pt' : '/dashboard')
    } catch (error) {
      console.error('Apple sign in failed:', error)
    }
  }

  return (
    <PublicRoute>
      <div className="min-h-screen bg-dark-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        {/* Logo */}
        <Link href={isPortuguese ? '/?lang=pt' : '/'} className="flex items-center">
          <div className="flex items-center space-x-1">
            <div className="logo-poly font-normal text-primary">
              binary
            </div>
            <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
              hub
            </div>
          </div>
        </Link>

        {/* Back Button */}
        <button
          onClick={handleGoBack}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Title */}
          <h1 className="text-white text-2xl font-medium text-center mb-12">
            {isPortuguese ? 'Entre na sua conta' : 'Log into your account'}
          </h1>

          {/* Auth Buttons */}
          <div className="space-y-4">
            {/* Email Button */}
            <button 
              onClick={handleEmailSignIn}
              className="w-full bg-primary text-dark-background font-medium py-3 px-6 rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{isPortuguese ? 'Entrar com email' : 'Login with email'}</span>
            </button>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-dark-background px-4 text-gray-400">{isPortuguese ? 'ou' : 'or'}</span>
              </div>
            </div>

            {/* Google Button */}
            <button 
              onClick={handleGoogleSignIn}
              className="w-full bg-white text-black font-medium py-3 px-6 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isPortuguese ? 'Entrar com Google' : 'Login with Google'}</span>
            </button>

            {/* Apple Button */}
            <button 
              onClick={handleAppleSignIn}
              className="w-full bg-white text-black font-medium py-3 px-6 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span>{isPortuguese ? 'Entrar com Apple' : 'Login with Apple'}</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-400 mt-8">
            {isPortuguese ? 'Não tem uma conta?' : "Don't have an account?"}{' '}
            <Link href={isPortuguese ? "/auth/register?lang=pt" : "/auth/register"} className="text-white font-bold hover:underline">
              {isPortuguese ? 'Cadastre-se' : 'Sign up'}
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-gray-400 text-sm">
          {isPortuguese 
            ? 'Ao continuar, você concorda com os '
            : "By continuing, you agree to Binary Hub's "
          }
          <Link href="/terms" className="text-white font-bold hover:underline">
            {isPortuguese ? 'Termos de Serviço' : 'Terms of Service'}
          </Link>
          {isPortuguese ? ' e ' : ' and '}
          <Link href="/privacy" className="text-white font-bold hover:underline">
            {isPortuguese ? 'Política de Privacidade' : 'Privacy Policy'}
          </Link>
          .
        </p>
      </footer>

      {/* Auth Form Modal */}
      <AuthForm 
        isOpen={showAuthForm}
        onClose={() => setShowAuthForm(false)}
        mode={authMode}
        onModeChange={setAuthMode}
      />
      </div>
    </PublicRoute>
  )
} 
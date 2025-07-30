'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../../lib/firebase'
import PublicRoute from '@/components/auth/PublicRoute'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { isPortuguese } = useLanguage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      await sendPasswordResetEmail(auth, email)
      setMessage(isPortuguese 
        ? 'Email de redefinição de senha enviado! Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.'
        : 'Password reset email sent! Check your inbox and follow the instructions to reset your password.'
      )
    } catch (error: any) {
      console.error('Password reset error:', error)
      
      // Handle specific Firebase errors
      switch (error.code) {
        case 'auth/user-not-found':
          setError(isPortuguese 
            ? 'Nenhuma conta encontrada com este endereço de email.'
            : 'No account found with this email address.'
          )
          break
        case 'auth/invalid-email':
          setError(isPortuguese 
            ? 'Por favor, insira um endereço de email válido.'
            : 'Please enter a valid email address.'
          )
          break
        case 'auth/too-many-requests':
          setError(isPortuguese 
            ? 'Muitas solicitações de redefinição. Tente novamente mais tarde.'
            : 'Too many reset requests. Please try again later.'
          )
          break
        default:
          setError(isPortuguese 
            ? 'Falha ao enviar email de redefinição. Tente novamente.'
            : 'Failed to send reset email. Please try again.'
          )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoBack = () => {
    router.push(isPortuguese ? '/auth/login?lang=pt' : '/auth/login')
  }

  return (
    <PublicRoute>
      <div className="min-h-screen bg-dark-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-6">
          {/* Logo */}
          <Link href={isPortuguese ? '/?lang=pt' : '/'} className="flex items-center">
            <div className="flex items-center space-x-1">
              <div className="logo-poly font-normal text-primary text-2xl">
                binary
              </div>
              <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal text-2xl">
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
              {isPortuguese ? 'Redefinir sua senha' : 'Reset your password'}
            </h1>

            {/* Success Message */}
            {message && (
              <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-400 text-sm">{message}</p>
                <Link 
                  href={isPortuguese ? "/auth/login?lang=pt" : "/auth/login"}
                  className="inline-block mt-2 text-primary hover:text-primary/80 text-sm underline"
                >
                  {isPortuguese ? 'Voltar ao login' : 'Return to login'}
                </Link>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Reset Form */}
            {!message && (
              <div className="space-y-6">
                <p className="text-gray-400 text-center text-sm mb-8">
                  {isPortuguese 
                    ? 'Digite seu endereço de email e enviaremos um link para redefinir sua senha.'
                    : 'Enter your email address and we\'ll send you a link to reset your password.'
                  }
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder={isPortuguese ? "Digite seu endereço de email" : "Enter your email address"}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full bg-primary text-dark-background font-medium py-3 px-6 rounded-full hover:bg-primary/90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-dark-background border-t-transparent rounded-full animate-spin"></div>
                        <span>{isPortuguese ? 'Enviando...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{isPortuguese ? 'Enviar email de redefinição' : 'Send reset email'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Footer Links */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm">
                {isPortuguese ? 'Lembra sua senha?' : 'Remember your password?'}{' '}
                <Link href={isPortuguese ? "/auth/login?lang=pt" : "/auth/login"} className="text-primary hover:text-primary/80 underline">
                  {isPortuguese ? 'Entrar' : 'Sign in'}
                </Link>
              </p>
            </div>
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
      </div>
    </PublicRoute>
  )
} 
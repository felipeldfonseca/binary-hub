'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Language = 'en' | 'pt'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  isPortuguese: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Inner component that uses useSearchParams (requires Suspense)
function LanguageProviderInner({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Mark as mounted after first render
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize language from localStorage, query params, or pathname
  useEffect(() => {
    if (!mounted) return

    try {
      const savedLanguage = localStorage.getItem('binary-hub-language') as Language
      const queryLang = searchParams?.get('lang') as Language

      let detectedLanguage: Language = 'en'

      if (queryLang && (queryLang === 'en' || queryLang === 'pt')) {
        // Priority 1: Query parameter
        detectedLanguage = queryLang
      } else if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'pt')) {
        // Priority 2: Saved preference
        detectedLanguage = savedLanguage
      } else if (pathname) {
        // Priority 3: Auto-detect from pathname (for legacy /pt routes)
        detectedLanguage = pathname.startsWith('/pt') ? 'pt' : 'en'
      }

      setLanguageState(detectedLanguage)
      localStorage.setItem('binary-hub-language', detectedLanguage)
    } catch (err) {
      console.warn('Error initializing language:', err)
    }
  }, [pathname, searchParams, mounted])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)

    try {
      localStorage.setItem('binary-hub-language', newLanguage)

      // Navigate to the same page with new language query parameter
      if (pathname && searchParams) {
        const currentSearchParams = new URLSearchParams(searchParams.toString())
        currentSearchParams.set('lang', newLanguage)
        const newPath = `${pathname}?${currentSearchParams.toString()}`

        if (newPath !== `${pathname}?${searchParams.toString()}`) {
          router.push(newPath)
        }
      }
    } catch (err) {
      console.warn('Error setting language:', err)
    }
  }

  const isPortuguese = language === 'pt'

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isPortuguese }}>
      {children}
    </LanguageContext.Provider>
  )
}

// Wrapper component with Suspense boundary for useSearchParams
export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <LanguageContext.Provider value={{ language: 'en', setLanguage: () => {}, isPortuguese: false }}>
        {children}
      </LanguageContext.Provider>
    }>
      <LanguageProviderInner>{children}</LanguageProviderInner>
    </Suspense>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
} 
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Language = 'en' | 'pt'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  isPortuguese: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize language from localStorage, query params, or pathname
  useEffect(() => {
    const savedLanguage = localStorage.getItem('binary-hub-language') as Language
    const queryLang = searchParams.get('lang') as Language
    
    let detectedLanguage: Language = 'en'
    
    if (queryLang && (queryLang === 'en' || queryLang === 'pt')) {
      // Priority 1: Query parameter
      detectedLanguage = queryLang
    } else if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'pt')) {
      // Priority 2: Saved preference
      detectedLanguage = savedLanguage
    } else {
      // Priority 3: Auto-detect from pathname (for legacy /pt routes)
      detectedLanguage = pathname.startsWith('/pt') ? 'pt' : 'en'
    }
    
    setLanguageState(detectedLanguage)
    localStorage.setItem('binary-hub-language', detectedLanguage)
  }, [pathname, searchParams])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem('binary-hub-language', newLanguage)
    
    // Navigate to the same page with new language query parameter
    const currentPath = pathname
    const currentSearchParams = new URLSearchParams(searchParams.toString())
    
    // Update or add the lang query parameter
    currentSearchParams.set('lang', newLanguage)
    
    const newPath = `${currentPath}?${currentSearchParams.toString()}`
    
    // Only navigate if the path actually changes
    if (newPath !== `${pathname}?${searchParams.toString()}`) {
      router.push(newPath)
    }
  }

  const isPortuguese = language === 'pt'

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isPortuguese }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
} 
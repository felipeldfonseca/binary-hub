'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

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
  const router = useRouter()

  // Initialize language from localStorage or pathname
  useEffect(() => {
    const savedLanguage = localStorage.getItem('binary-hub-language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'pt')) {
      setLanguageState(savedLanguage)
    } else {
      // Auto-detect from pathname
      const detectedLanguage = pathname.startsWith('/pt') ? 'pt' : 'en'
      setLanguageState(detectedLanguage)
      localStorage.setItem('binary-hub-language', detectedLanguage)
    }
  }, [pathname])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem('binary-hub-language', newLanguage)
    
    // Navigate to the equivalent page in the new language
    const currentPath = pathname
    let newPath = currentPath

    if (newLanguage === 'pt') {
      // Convert English routes to Portuguese
      if (currentPath === '/') {
        newPath = '/pt'
      } else if (currentPath === '/plans') {
        newPath = '/pt/plans'
      } else if (currentPath === '/about') {
        newPath = '/pt/about'
      } else if (currentPath.startsWith('/dashboard')) {
        // Keep dashboard routes as is for now (they're not translated yet)
        newPath = currentPath
      }
    } else {
      // Convert Portuguese routes to English
      if (currentPath === '/pt') {
        newPath = '/'
      } else if (currentPath === '/pt/plans') {
        newPath = '/plans'
      } else if (currentPath === '/pt/about') {
        newPath = '/about'
      } else if (currentPath.startsWith('/dashboard')) {
        // Keep dashboard routes as is for now
        newPath = currentPath
      }
    }

    if (newPath !== currentPath) {
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
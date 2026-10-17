'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME, THEME_SCRIPT, readTheme, saveTheme, type HubTheme } from '@/lib/hub/tema'

interface HubThemeContextValue {
  theme: HubTheme
  setTheme: (theme: HubTheme) => void
}

const HubThemeContext = createContext<HubThemeContextValue | null>(null)

// Reads the saved theme before the first paint on the client; on the server there is nothing to read
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The `.hub` element every new screen sits in. It carries the theme, so loading and
 * access messages are already in the right colours before the page itself appears.
 */
export default function HubRoot({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<HubTheme>(DEFAULT_THEME)

  useIsomorphicLayoutEffect(() => {
    setThemeState(readTheme())
  }, [])

  const setTheme = useCallback((next: HubTheme) => {
    setThemeState(next)
    saveTheme(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <HubThemeContext.Provider value={value}>
      {/* The inline script may already have set data-tema from storage before hydration */}
      <div className="hub" data-tema={theme} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </div>
    </HubThemeContext.Provider>
  )
}

export function useHubTheme(): HubThemeContextValue {
  const context = useContext(HubThemeContext)
  if (!context) throw new Error('useHubTheme must be used inside HubRoot')
  return context
}

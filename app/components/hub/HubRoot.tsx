'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_THEME, THEME_SCRIPT, readTheme, saveTheme, type HubTheme } from '@/lib/hub/tema'

interface HubThemeContextValue {
  theme: HubTheme
  /**
   * The user's choice («Modo escuro», Personalizar › Tema): applied at once, kept in this browser
   * and, once signed in, merged into the profile (the writer TemaDoPerfil registers).
   */
  setTheme: (theme: HubTheme) => void
  /** The profile's saved theme, applied once per load: kept in this browser, nothing written */
  adoptTheme: (theme: HubTheme) => void
  /** Whether the user changed the theme on this page load (then the profile's older value does not win) */
  themeChangedThisLoad: () => boolean
  /** Where setTheme writes the profile (null: nowhere, e.g. before sign-in) */
  registerThemeWriter: (write: ((theme: HubTheme) => void) | null) => void
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
  const changedRef = useRef(false)
  const writerRef = useRef<((theme: HubTheme) => void) | null>(null)

  useIsomorphicLayoutEffect(() => {
    setThemeState(readTheme())
  }, [])

  const setTheme = useCallback((next: HubTheme) => {
    changedRef.current = true
    setThemeState(next)
    saveTheme(next)
    writerRef.current?.(next)
  }, [])

  const adoptTheme = useCallback((next: HubTheme) => {
    setThemeState(next)
    saveTheme(next)
  }, [])

  const themeChangedThisLoad = useCallback(() => changedRef.current, [])

  const registerThemeWriter = useCallback((write: ((theme: HubTheme) => void) | null) => {
    writerRef.current = write
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, adoptTheme, themeChangedThisLoad, registerThemeWriter }),
    [theme, setTheme, adoptTheme, themeChangedThisLoad, registerThemeWriter],
  )

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

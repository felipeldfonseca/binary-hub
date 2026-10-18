'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import ImportSheet from './ImportSheet'

export type SheetMode = 'importar' | 'adicionar'

export interface OpenSheetOptions {
  /** "Importar arquivo" starts at the file; "+ Adicionar conta" at the market */
  mode: SheetMode
  /** The account in context (Diário's current account, or the Suas contas row) */
  accountId?: string | null
  /** Gets focus back when the sheet closes; defaults to whatever had focus */
  opener?: HTMLElement | null
  /**
   * Gets focus when the opener is gone after the sheet closes (an empty state replaced by the
   * account just added); defaults to the page's H1
   */
  fallback?: HTMLElement | null
}

interface SheetContextValue {
  open: (options: OpenSheetOptions) => void
  isOpen: boolean
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function useImportSheet(): SheetContextValue {
  const context = useContext(SheetContext)
  if (!context) throw new Error('useImportSheet must be used inside ImportSheetProvider')
  return context
}

interface Session {
  key: number
  mode: SheetMode
  accountId: string | null
}

interface FocusReturn {
  opener: HTMLElement | null
  fallback: HTMLElement | null
}

/**
 * Holds the import sheet for every hub screen. While it is open the page behind it is hidden
 * from assistive technology and made inert, the page does not scroll, and on close focus goes
 * back to the control that opened it (or, when that control is gone, to a heading of the page).
 */
export default function ImportSheetProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const focusRef = useRef<FocusReturn>({ opener: null, fallback: null })
  const returnFocus = useRef<FocusReturn | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const open = useCallback((options: OpenSheetOptions) => {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    focusRef.current = { opener: options.opener ?? active, fallback: options.fallback ?? null }
    setSession({ key: Date.now(), mode: options.mode, accountId: options.accountId ?? null })
  }, [])

  const close = useCallback(() => {
    returnFocus.current = focusRef.current
    focusRef.current = { opener: null, fallback: null }
    setSession(null)
  }, [])

  useEffect(() => {
    const page = pageRef.current
    if (page) {
      if (session) page.setAttribute('inert', '')
      else page.removeAttribute('inert')
    }
    const root = document.documentElement
    const previous = root.style.overflow
    if (session) root.style.overflow = 'hidden'
    if (!session && returnFocus.current) {
      const { opener, fallback } = returnFocus.current
      returnFocus.current = null
      const target = opener?.isConnected
        ? opener
        : fallback?.isConnected
          ? fallback
          : page?.querySelector<HTMLElement>('h1[tabindex="-1"]')
      target?.focus()
    }
    return () => {
      root.style.overflow = previous
    }
  }, [session])

  const value = useMemo(() => ({ open, isOpen: session !== null }), [open, session])

  return (
    <SheetContext.Provider value={value}>
      <div
        ref={pageRef}
        className={session ? 'hub-fundo-pagina hub-fundo-pagina--coberto' : 'hub-fundo-pagina'}
        aria-hidden={session ? true : undefined}
      >
        {children}
      </div>
      {session && <ImportSheet key={session.key} mode={session.mode} accountId={session.accountId} onClose={close} />}
    </SheetContext.Provider>
  )
}

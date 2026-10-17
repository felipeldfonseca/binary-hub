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

/**
 * Holds the import sheet for every hub screen. While it is open the page behind it is hidden
 * from assistive technology and made inert, the page does not scroll, and on close focus goes
 * back to the control that opened it.
 */
export default function ImportSheetProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const open = useCallback((options: OpenSheetOptions) => {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    openerRef.current = options.opener ?? active
    setSession({ key: Date.now(), mode: options.mode, accountId: options.accountId ?? null })
  }, [])

  const close = useCallback(() => {
    returnFocus.current = openerRef.current
    openerRef.current = null
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
      const target = returnFocus.current
      returnFocus.current = null
      if (target.isConnected) target.focus()
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

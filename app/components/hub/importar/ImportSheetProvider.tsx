'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import ImportSheet from './ImportSheet'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import {
  RegistrarSheetContext,
  type CloseRegistrarOptions,
  type OpenRegistrarOptions,
  type RegistrarSheetValue,
} from '@/components/hub/registrar/abrir'

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
  /** The import sheet is the sheet on screen */
  isOpen: boolean
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function useImportSheet(): SheetContextValue {
  const context = useContext(SheetContext)
  if (!context) throw new Error('useImportSheet must be used inside ImportSheetProvider')
  return context
}

/** How long a `focusId` on a page still loading is waited for, and how often it is looked for */
const FOCUS_WAIT_MS = 3000
const FOCUS_WAIT_STEP_MS = 50

type Session =
  | { key: number; kind: 'importar'; mode: SheetMode; accountId: string | null }
  | { key: number; kind: 'registrar'; accountId: string | null; tradeId: string | null }

interface FocusReturn {
  opener: HTMLElement | null
  fallback: HTMLElement | null
  /** An element id that takes the focus first («Ver no Diário» → «Operações do dia») */
  focusId?: string
}

/**
 * Holds the hub's sheets for every hub screen, one at a time (C25): the import sheet and
 * «Registrar operação» (useRegistrarSheet). While one is open the page behind it is hidden from
 * assistive technology and made inert, the page does not scroll, and on close focus goes back to
 * the control that opened it (or, when that control is gone, to a heading of the page). Opening
 * Registrar from the import sheet (the end of account creation) replaces it and keeps the first
 * opener.
 */
export default function ImportSheetProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const focusRef = useRef<FocusReturn>({ opener: null, fallback: null })
  const returnFocus = useRef<FocusReturn | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  /** Waiting for a `focusId` the next page has not drawn yet («Ver no Diário» from another page) */
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((next: Session, opener: HTMLElement | null | undefined, fallback: HTMLElement | null | undefined) => {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    // From another sheet, focus goes back to what opened the first one (unless an opener is given)
    if (!sessionRef.current || opener) focusRef.current = { opener: opener ?? active, fallback: fallback ?? null }
    sessionRef.current = next
    setSession(next)
  }, [])

  const open = useCallback(
    (options: OpenSheetOptions) =>
      start({ key: Date.now(), kind: 'importar', mode: options.mode, accountId: options.accountId ?? null }, options.opener, options.fallback),
    [start],
  )

  const openRegistrar = useCallback(
    (options: OpenRegistrarOptions) =>
      start({ key: Date.now(), kind: 'registrar', accountId: options.accountId ?? null, tradeId: options.tradeId ?? null }, options.opener, options.fallback),
    [start],
  )

  const close = useCallback((options?: CloseRegistrarOptions) => {
    returnFocus.current = { ...focusRef.current, focusId: options?.focusId }
    focusRef.current = { opener: null, fallback: null }
    sessionRef.current = null
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
    if (session && waitRef.current) {
      clearInterval(waitRef.current)
      waitRef.current = null
    }
    if (!session && returnFocus.current) {
      const { opener, fallback, focusId } = returnFocus.current
      returnFocus.current = null
      const others = (): HTMLElement | null | undefined =>
        opener?.isConnected ? opener : fallback?.isConnected ? fallback : pageRef.current?.querySelector<HTMLElement>('h1[tabindex="-1"]')
      const byId = focusId ? document.getElementById(focusId) : null
      if (!focusId || byId?.isConnected) (byId ?? others())?.focus()
      else {
        // The element is on a page still on its way (router.push('/diario') before closing): wait
        // for it a little, unless the person moves the focus first
        let waited = 0
        waitRef.current = setInterval(() => {
          const el = document.getElementById(focusId)
          waited += FOCUS_WAIT_STEP_MS
          if (!el?.isConnected && waited < FOCUS_WAIT_MS) return
          if (waitRef.current) clearInterval(waitRef.current)
          waitRef.current = null
          const free = !document.activeElement || document.activeElement === document.body
          if (free) (el?.isConnected ? el : others())?.focus()
        }, FOCUS_WAIT_STEP_MS)
      }
    }
    return () => {
      root.style.overflow = previous
    }
  }, [session])

  useEffect(
    () => () => {
      if (waitRef.current) clearInterval(waitRef.current)
    },
    [],
  )

  const importValue = useMemo(() => ({ open, isOpen: session?.kind === 'importar' }), [open, session])
  const registrarValue = useMemo<RegistrarSheetValue>(() => ({ open: openRegistrar, isOpen: session?.kind === 'registrar' }), [openRegistrar, session])

  return (
    <SheetContext.Provider value={importValue}>
      <RegistrarSheetContext.Provider value={registrarValue}>
        <div
          ref={pageRef}
          className={session ? 'hub-fundo-pagina hub-fundo-pagina--coberto' : 'hub-fundo-pagina'}
          aria-hidden={session ? true : undefined}
        >
          {children}
        </div>
        {session?.kind === 'importar' && <ImportSheet key={session.key} mode={session.mode} accountId={session.accountId} onClose={close} />}
        {session?.kind === 'registrar' && (
          <RegistrarSheet key={session.key} accountId={session.accountId} tradeId={session.tradeId} onClose={close} />
        )}
      </RegistrarSheetContext.Provider>
    </SheetContext.Provider>
  )
}

'use client'

import { createContext, useContext } from 'react'

/**
 * Opening «Registrar operação» from any hub screen (contract §2.5). The hub has one sheet at a time
 * (C25): ImportSheetProvider holds both the import sheet and this one, so opening Registrar from
 * the import's end screen («Registrar operação» after creating an account) replaces it, and focus
 * goes back to whatever opened the first sheet.
 *
 * The sheet decides where it starts: with `tradeId`, on that trade (open → «Operação aberta»,
 * closed → «Operação fechada»); without, on the account's open trades (one → that trade with «Nova
 * entrada»; several → «Operações abertas»; none → «Entrada»).
 */
export interface OpenRegistrarOptions {
  /** The account it opens on (the Diário's current one, a new account, a bridge row's) */
  accountId: string | null
  /** A trade of that account to open on */
  tradeId?: string | null
  /** Gets focus back when the sheet closes; defaults to whatever had focus */
  opener?: HTMLElement | null
  /** Gets focus when the opener is gone; defaults to the page's H1 */
  fallback?: HTMLElement | null
  /**
   * Phase 4 (D16): a past trading day of the account ('YYYY-MM-DD'), the Diário's open day when it is one: the sheet
   * opens «Já fechada» on that day, unless a draft is saved for the account (the draft wins: DEV-C3)
   */
  day?: string | null
}

/** How the sheet closes: `focusId` (e.g. «Ver no Diário» → the trade's row on the Diário) takes the focus instead of the opener */
export interface CloseRegistrarOptions {
  focusId?: string
}

export interface RegistrarSheetValue {
  open: (options: OpenRegistrarOptions) => void
  /** Registrar is the sheet on screen */
  isOpen: boolean
}

export const RegistrarSheetContext = createContext<RegistrarSheetValue | null>(null)

export function useRegistrarSheet(): RegistrarSheetValue {
  const context = useContext(RegistrarSheetContext)
  if (!context) throw new Error('useRegistrarSheet must be used inside ImportSheetProvider')
  return context
}

/** The id of the Diário's «Operações do dia» heading (tabIndex -1): a row gone after the sheet focuses it */
export const OPERACOES_DO_DIA_ID = 'operacoes-do-dia'

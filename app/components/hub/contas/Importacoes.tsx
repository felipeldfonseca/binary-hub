'use client'

import { useEffect, useRef, useState } from 'react'
import { MARKET_SPEC } from '@/lib/domain/markets'
import { utcToLocal } from '@/lib/domain/tempo'
import type { TradingAccount } from '@/lib/hub/contas'
import { importUndo, toHubError, type HubErrorCode, type ImportBatch } from '@/lib/hub/contasDb'
import { formatDayMonth } from '@/lib/hub/formato'
import { useBatchUndo, useHubDb, useImportBatches, useRefreshAfterWrite } from '@/hooks/useContas'
import { BUSY, CLOSE, CONTAS, ERROR_TEXT, IMPORTACOES, LOADING, TRY_AGAIN, ops } from './copy'

/**
 * When a batch was imported (or undone), on the account's clock: its market's window clock, the Diário's default
 * (contract §3.4: every hour on the window clock, never the device's zone; board dez 13: Top One's batch of 00:12Z is
 * «11 nov, 19:12», ET). '11 nov, 19:12', with the year when it is not the current one on that clock ('2 jan 2025,
 * 09:05'); `hora: false`, the day alone ('2 out'). Phase 1 wrote both on the device's clock (formato.formatWhen).
 */
export function quandoNoRelogio(timestamp: string, tz: string, { hora = true, agora = new Date() }: { hora?: boolean; agora?: Date } = {}): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return ''
  const local = utcToLocal(at, tz)
  const dia = formatDayMonth(local.date, local.year !== utcToLocal(agora, tz).year)
  return hora ? `${dia}, ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}` : dia
}

/**
 * "Importações" of an account (board dez 13 since Phase 4; no board before): its batches, newest first, each
 * undoable once, at their time on the account's clock (quandoNoRelogio). Undoing deletes the batch's trades and gives back the trades it completed (registered in the app,
 * Phase 3; imported earlier, Phase 3c); the confirmation says how many of each, in trades, read when it
 * opens (useBatchUndo: the batch's counts are the file's lines, and a position can take several). Phase 4 (D20, board
 * dez 13): under it, what the owner put in the Diário on the batch's own trades and leaves with them («Saem junto: 2
 * marcas e 1 nota que você pôs no Diário.»), when there is any.
 */
export default function Importacoes({ account, onClose }: { account: TradingAccount; onClose: () => void }) {
  const { db } = useHubDb()
  const refresh = useRefreshAfterWrite()
  const batches = useImportBatches(account.id)
  const [confirming, setConfirming] = useState<string | null>(null)
  const counts = useBatchUndo(account.id, confirming)
  const undoCounts = confirming ? counts.data : undefined
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<HubErrorCode | null>(null)
  const [done, setDone] = useState('')
  // "Manter" brings the batch's Desfazer back; it takes focus once it is on the page again
  const [refocus, setRefocus] = useState<string | null>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const undoRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const titleId = `importacoes-${account.id}`
  // The account's clock (the market's window clock): the batch's time and the day it was undone
  const relogio = MARKET_SPEC[account.market].windowTz

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (confirming) keepRef.current?.focus()
  }, [confirming])

  useEffect(() => {
    if (!refocus) return
    undoRefs.current[refocus]?.focus()
    setRefocus(null)
  }, [refocus])

  const undo = async (batch: ImportBatch, back: { registered: number; existing: number }) => {
    setBusy(true)
    setError(null)
    try {
      const { deleted } = await importUndo(db, batch.id)
      setConfirming(null)
      // import_undo answers only the deleted count; the trades it gave back are the confirmation's
      setDone(IMPORTACOES.undone(deleted, back))
      refresh()
      titleRef.current?.focus()
    } catch (e) {
      setError(toHubError(e).code)
    } finally {
      setBusy(false)
    }
  }

  const keep = (batchId: string) => {
    setConfirming(null)
    setRefocus(batchId)
  }

  let content: React.ReactNode
  if (batches.isLoading) {
    content = (
      <p role="status" className="hub-nota">
        {LOADING}
      </p>
    )
  } else if (batches.isError) {
    content = (
      <div className="hub-linha">
        <p role="alert" className="hub-nota">
          {CONTAS.loadError}
        </p>
        <button type="button" className="hub-btn" onClick={() => void batches.refetch()}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (!batches.data || batches.data.length === 0) {
    content = <p className="hub-nota">{IMPORTACOES.empty}</p>
  } else {
    content = (
      <ul className="hub-lotes">
        {batches.data.map((batch) => {
          const when = quandoNoRelogio(batch.created_at, relogio)
          if (batch.is_legacy) {
            return (
              <li key={batch.id} className="hub-lote">
                <div className="hub-lote__txt">
                  <strong>{IMPORTACOES.legacy}</strong>
                  <span className="hub-partes">
                    <span>{ops(batch.rows_inserted)}</span>
                    <span>{IMPORTACOES.legacyNote}</span>
                  </span>
                </div>
              </li>
            )
          }
          const linked = batch.rows_linked ?? 0
          const parts = [IMPORTACOES.inserted(batch.rows_inserted)]
          if (linked > 0) parts.push(IMPORTACOES.linked(linked))
          parts.push(IMPORTACOES.duplicate(batch.rows_duplicate))
          if (batch.rows_completed > 0) parts.push(IMPORTACOES.completed(batch.rows_completed))
          if (batch.rows_other_account > 0) parts.push(IMPORTACOES.other(batch.rows_other_account))
          parts.push(IMPORTACOES.errors(batch.rows_error))
          return (
            <li key={batch.id} className="hub-lote">
              <div className="hub-lote__txt">
                <strong>
                  {when} · {batch.file_name || IMPORTACOES.noName}
                </strong>
                <span className="hub-partes">
                  {parts.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </span>
              </div>
              {batch.status === 'undone' ? (
                <span className="hub-nota">{IMPORTACOES.undoneOn(batch.undone_at ? quandoNoRelogio(batch.undone_at, relogio, { hora: false }) : '')}</span>
              ) : (
                confirming !== batch.id && (
                  <button
                    ref={(el) => {
                      undoRefs.current[batch.id] = el
                    }}
                    type="button"
                    className="hub-btn"
                    aria-label={IMPORTACOES.undoAria(when)}
                    onClick={() => setConfirming(batch.id)}
                  >
                    {IMPORTACOES.undo}
                  </button>
                )
              )}
              {confirming === batch.id && (
                <div className="hub-bloco hub-bloco--atencao" role="group" aria-labelledby={`desfazer-${batch.id}`} style={{ flex: '1 1 100%' }}>
                  {/* Live: the counts arrive after «Manter» took focus. Phase 4 (D20): under them, the marks, images
                      and notes of the Diário that leave with the batch's own trades, when there are any, 8 px apart
                      (board `.atencao`'s gap, where both are its own children) */}
                  <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span id={`desfazer-${batch.id}`} style={{ fontWeight: 700 }}>
                      {undoCounts ? IMPORTACOES.confirm(undoCounts) : counts.isError ? IMPORTACOES.countError : LOADING}
                    </span>
                    {undoCounts && IMPORTACOES.saem(undoCounts.diario) && <span style={{ fontSize: 13 }}>{IMPORTACOES.saem(undoCounts.diario)}</span>}
                  </div>
                  <div className="hub-acoes">
                    {undoCounts && (
                      <button
                        type="button"
                        className="hub-btn hub-btn--pri"
                        aria-disabled={busy || undefined}
                        onClick={() => {
                          if (!busy) void undo(batch, { registered: undoCounts.registered, existing: undoCounts.existing })
                        }}
                      >
                        {IMPORTACOES.confirmYes(undoCounts.trades)}
                      </button>
                    )}
                    {!undoCounts && counts.isError && (
                      <button type="button" className="hub-btn" onClick={() => void counts.refetch()}>
                        {TRY_AGAIN}
                      </button>
                    )}
                    <button ref={keepRef} type="button" className="hub-btn" onClick={() => keep(batch.id)}>
                      {IMPORTACOES.confirmNo}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div
      className="hub-form-inline hub-cheia"
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation()
          if (confirming) keep(confirming)
          else onClose()
        }
      }}
    >
      <div ref={titleRef} id={titleId} className="hub-rotulo hub-alvo-foco" tabIndex={-1}>
        {IMPORTACOES.title(account.label)}
      </div>
      <div role="status">{done && <p className="hub-nota">{done}</p>}</div>
      {content}
      {error && (
        <p role="alert" className="hub-alerta">
          {ERROR_TEXT[error]}
        </p>
      )}
      {busy && (
        <p role="status" className="hub-nota">
          {BUSY}
        </p>
      )}
      <div className="hub-acoes">
        <button type="button" className="hub-btn" onClick={onClose}>
          {CLOSE}
        </button>
      </div>
    </div>
  )
}

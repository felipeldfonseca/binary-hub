'use client'

import { useEffect, useRef, useState } from 'react'
import { groupByMarket, type TradingAccount } from '@/lib/hub/contas'
import { toHubError, updateAccount, type AccountActivity, type HubErrorCode } from '@/lib/hub/contasDb'
import { formatDay } from '@/lib/hub/formato'
import { useAccountActivity, useAccounts, useHubDb, useRefreshAfterWrite } from '@/hooks/useContas'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import EditarConta from './EditarConta'
import Importacoes from './Importacoes'
import {
  ADD_ACCOUNT,
  CONTAS,
  ERROR_TEXT,
  IMPORT_FILE,
  LOADING,
  MARKET_LABEL,
  NEVER_SUMMED,
  PHASE_LABEL,
  TRY_AGAIN,
  UNDO,
  platformLabel,
  undoAria,
} from './copy'
import { Disclosure, InfoButton, InfoPanel, useToggle } from './ui'

type Panel = { id: string; kind: 'editar' | 'importacoes' }
type Toast = { text: string; undo?: () => Promise<void> }

function activityText(activity: AccountActivity | undefined): string {
  if (!activity) return ''
  if (activity.imported > 0) return CONTAS.onlyImported
  if (activity.total > 0) return CONTAS.registered(activity.total)
  return CONTAS.noTrades
}

/**
 * "Suas contas" (Personalizar #contas), Phase 1 cut: one row per active account grouped by
 * market, import, edit, the account's imports, archive with undo, and the closed accounts.
 * Actions apply at once.
 */
export default function SuasContas() {
  const { all, active, archived, isLoading, isError, refetch } = useAccounts()
  const activity = useAccountActivity(active)
  const sheet = useImportSheet()
  const { db } = useHubDb()
  const refresh = useRefreshAfterWrite()
  const [info, toggleInfo] = useToggle()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [closedOpen, toggleClosed] = useToggle()
  const [error, setError] = useState<HubErrorCode | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const closedRef = useRef<HTMLDivElement>(null)
  const toastUndoRef = useRef<HTMLButtonElement>(null)
  const moreRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [focusToast, setFocusToast] = useState(0)

  useEffect(() => {
    if (focusToast > 0) toastUndoRef.current?.focus()
  }, [focusToast])

  const primaryId = active.find((a) => a.is_primary)?.id ?? null

  const focusMore = (id: string) => setTimeout(() => moreRefs.current[id]?.focus(), 0)

  const openPanel = (id: string, kind: Panel['kind']) => {
    setMenuFor(null)
    setError(null)
    setPanel({ id, kind })
  }

  const closePanel = (id: string) => {
    setPanel(null)
    focusMore(id)
  }

  const archive = async (account: TradingAccount) => {
    setMenuFor(null)
    setPanel(null)
    setError(null)
    try {
      // The one-primary rule only counts active accounts; an archived one stops being primary
      await updateAccount(db, account.id, { archived_at: new Date().toISOString(), is_primary: false })
      refresh()
      const wasPrimary = account.is_primary
      setToast({
        text: CONTAS.archived(account.label),
        undo: async () => {
          const otherPrimary = active.some((a) => a.id !== account.id && a.is_primary)
          await updateAccount(db, account.id, { archived_at: null, ...(wasPrimary && !otherPrimary ? { is_primary: true } : {}) })
          refresh()
          setToast(null)
          headingRef.current?.focus()
        },
      })
      setFocusToast((n) => n + 1)
    } catch (e) {
      setError(toHubError(e).code)
    }
  }

  const reactivate = async (account: TradingAccount) => {
    setError(null)
    try {
      await updateAccount(db, account.id, { archived_at: null })
      refresh()
      closedRef.current?.querySelector<HTMLElement>('button')?.focus()
    } catch (e) {
      setError(toHubError(e).code)
    }
  }

  const runUndo = async () => {
    if (!toast?.undo) return
    setError(null)
    try {
      await toast.undo()
    } catch (e) {
      setError(toHubError(e).code)
    }
  }

  let list: React.ReactNode
  if (isLoading) {
    list = (
      <p role="status" className="hub-nota">
        {LOADING}
      </p>
    )
  } else if (isError) {
    list = (
      <div className="hub-linha">
        <p role="alert" className="hub-nota">
          {CONTAS.loadError}
        </p>
        <button type="button" className="hub-btn" onClick={() => void refetch()}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (active.length === 0) {
    list = (
      <div className="hub-vazio">
        <strong>{CONTAS.empty}</strong>
        <div className="hub-acoes">
          <button type="button" className="hub-btn hub-btn--pri" onClick={(event) => sheet.open({ mode: 'importar', opener: event.currentTarget })}>
            {IMPORT_FILE}
          </button>
          <button type="button" className="hub-btn" onClick={(event) => sheet.open({ mode: 'adicionar', opener: event.currentTarget })}>
            {ADD_ACCOUNT}
          </button>
        </div>
      </div>
    )
  } else {
    list = (
      <>
        {groupByMarket(active).map((group) => (
          <div key={group.market} className="hub-grupo">
            <h3 id={`g-${group.market}`}>{MARKET_LABEL[group.market]}</h3>
            <ul className="hub-lista" aria-labelledby={`g-${group.market}`}>
              {group.accounts.map((account) => {
                const parts = [
                  account.phase ? PHASE_LABEL[account.phase] : '',
                  account.firm ?? '',
                  platformLabel(account.platform),
                  activityText(activity.data?.[account.id]),
                ].filter(Boolean)
                const menuId = `menu-${account.id}`
                const menuOpen = menuFor === account.id
                return (
                  <li key={account.id} className="hub-conta">
                    <div style={{ minWidth: 0 }}>
                      <div className="hub-conta__cab">
                        <strong>{account.label}</strong>
                      </div>
                      {parts.length > 0 && (
                        <div className="hub-partes">
                          {parts.map((p) => (
                            <span key={p}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="hub-conta__acoes">
                      <button
                        type="button"
                        className="hub-btn"
                        aria-label={CONTAS.importAria(account.label)}
                        onClick={(event) => sheet.open({ mode: 'importar', accountId: account.id, opener: event.currentTarget })}
                      >
                        {CONTAS.importShort}
                      </button>
                      <button
                        ref={(el) => {
                          moreRefs.current[account.id] = el
                        }}
                        type="button"
                        className="hub-btn hub-btn--icone"
                        aria-label={CONTAS.moreAria(account.label)}
                        aria-expanded={menuOpen}
                        aria-controls={menuId}
                        onClick={() => setMenuFor(menuOpen ? null : account.id)}
                      >
                        <span aria-hidden="true">⋯</span>
                      </button>
                    </div>
                    {menuOpen && (
                      <div
                        id={menuId}
                        className="hub-menu-inline hub-cheia"
                        role="group"
                        aria-label={CONTAS.menuAria(account.label)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setMenuFor(null)
                            focusMore(account.id)
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="hub-btn"
                          onClick={() => {
                            setMenuFor(null)
                            sheet.open({ mode: 'importar', accountId: account.id, opener: moreRefs.current[account.id] })
                          }}
                        >
                          {CONTAS.menuImport}
                        </button>
                        <button type="button" className="hub-btn" onClick={() => openPanel(account.id, 'editar')}>
                          {CONTAS.menuEdit}
                        </button>
                        <button type="button" className="hub-btn" onClick={() => openPanel(account.id, 'importacoes')}>
                          {CONTAS.menuBatches}
                        </button>
                        <button type="button" className="hub-btn" onClick={() => void archive(account)}>
                          {CONTAS.menuArchive}
                        </button>
                      </div>
                    )}
                    {panel?.id === account.id && panel.kind === 'editar' && (
                      <EditarConta
                        account={account}
                        accounts={all}
                        primaryId={primaryId}
                        onCancel={() => closePanel(account.id)}
                        onSaved={(text) => {
                          setToast({ text })
                          closePanel(account.id)
                        }}
                      />
                    )}
                    {panel?.id === account.id && panel.kind === 'importacoes' && (
                      <Importacoes account={account} onClose={() => closePanel(account.id)} />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <div className="hub-acoes">
          <button type="button" className="hub-btn hub-btn--pri" onClick={(event) => sheet.open({ mode: 'adicionar', opener: event.currentTarget })}>
            {ADD_ACCOUNT}
          </button>
        </div>
      </>
    )
  }

  return (
    <section id="contas" aria-labelledby="t-contas" className="hub-card">
      <div className="hub-cab">
        <div className="hub-titulo-i">
          <h2 id="t-contas" ref={headingRef} tabIndex={-1}>
            {CONTAS.title}
          </h2>
          <InfoButton panelId="info-contas" label={CONTAS.infoAria} open={info} onToggle={toggleInfo} />
        </div>
      </div>
      <p className="hub-nota hub-card__sub">{CONTAS.sub}</p>
      {info && <InfoPanel id="info-contas">{CONTAS.info}</InfoPanel>}

      <div role="status">
        {toast && (
          <div className={toast.undo ? 'hub-toast-linha' : 'hub-toast-linha hub-toast-linha--so-texto'}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button ref={toastUndoRef} type="button" className="hub-btn" aria-label={undoAria(toast.text)} onClick={() => void runUndo()}>
                {UNDO}
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="hub-alerta">
          {ERROR_TEXT[error]}
        </p>
      )}

      {list}

      {!isLoading && !isError && (
        <div ref={closedRef}>
          <Disclosure open={closedOpen} controls="lista-encerradas" onToggle={toggleClosed}>
            {CONTAS.closed(archived.length)}
          </Disclosure>
          {closedOpen && (
            <div id="lista-encerradas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {archived.length === 0 ? (
                <p className="hub-nota">{CONTAS.closedNone}</p>
              ) : (
                <ul className="hub-lista">
                  {archived.map((account) => (
                    <li key={account.id} className="hub-conta">
                      <div style={{ minWidth: 0 }}>
                        <div className="hub-conta__cab">
                          <strong>{account.label}</strong>
                        </div>
                        <div className="hub-partes">
                          <span>{CONTAS.archivedOn(account.archived_at ? formatDay(account.archived_at) : '')}</span>
                          <span>{CONTAS.historyKept}</span>
                        </div>
                      </div>
                      <div className="hub-conta__acoes">
                        <button type="button" className="hub-btn" aria-label={CONTAS.reactivateAria(account.label)} onClick={() => void reactivate(account)}>
                          {CONTAS.reactivate}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <p className="hub-nota">{NEVER_SUMMED}</p>
    </section>
  )
}

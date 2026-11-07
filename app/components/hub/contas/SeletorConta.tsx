'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { groupByMarket, type TradingAccount } from '@/lib/hub/contas'
import { SELETOR_MUITAS } from '@/lib/hub/diario'
import { MANY_ACCOUNTS, selectorView } from '@/lib/hub/seletorContas'
import { ADD_ACCOUNT, MARKET_LABEL, NEVER_SUMMED, PHASE_LABEL, SELETOR } from './copy'

interface Props {
  accounts: readonly TradingAccount[]
  current: TradingAccount
  onChoose: (id: string) => void
  /** "+ Adicionar conta": the button gets focus back when the sheet closes */
  onAdd: (opener: HTMLElement | null) => void
  /** The line under the button: «Janela 10:00–11:00 ET», «Sem janela salva»; nothing when absent */
  janela?: string | null
  /** The «Conta: …» button, for a parent that gives it focus (the Diário header after «Tentar de novo») */
  buttonRef?: React.RefObject<HTMLButtonElement>
}

/**
 * "Conta: {label} ▾" and its list (Diário version of the boards): one account at a time, grouped
 * by market, never summed. Escape or a choice closes it and gives focus back to the button.
 * Under the button, the current account's window (`janela`), which also describes the button.
 *
 * Phase 4 (owner's request of 25 Oct, board dez 9b): from MANY_ACCOUNTS accounts the list opens on a search field
 * (the account's nickname or its firm, case and accents ignored: lib/hub/seletorContas selectorView), a market with
 * more than one account is split by firm («Futuros · 30», «Apex · 9»), each block a group named by its headers, and
 * the blocks scroll inside the popover (the focus ring is never cut). Typing never closes it; Escape closes it from
 * anywhere inside, the search included; the search empties when it closes. Below MANY_ACCOUNTS, as built.
 */
export default function SeletorConta({ accounts, current, onChoose, onAdd, janela, buttonRef: outerRef }: Props) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ownRef = useRef<HTMLButtonElement>(null)
  const buttonRef = outerRef ?? ownRef
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const many = accounts.length >= MANY_ACCOUNTS
  const view = useMemo(() => (many ? selectorView(accounts, busca) : null), [many, accounts, busca])

  // Focus goes into the list: on the search with many accounts (board 9b), else on the current account
  useEffect(() => {
    if (!open) return
    if (searchRef.current) {
      searchRef.current.focus()
      return
    }
    const list = listRef.current
    const target = list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector<HTMLElement>('button, a')
    target?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    // Tabbing out of the list closes it, so it never covers the control that has focus
    const onFocusIn = (event: FocusEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setBusca('')
      }
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])

  const close = () => {
    setOpen(false)
    setBusca('')
    buttonRef.current?.focus()
  }

  const option = (account: TradingAccount) => (
    <button
      key={account.id}
      type="button"
      className="hub-seletor__op"
      aria-current={account.id === current.id ? 'true' : undefined}
      onClick={() => {
        if (account.id !== current.id) onChoose(account.id)
        close()
      }}
    >
      <span className="hub-seletor__nome">{account.label}</span>
      {account.phase && <span className="hub-seletor__fase">{PHASE_LABEL[account.phase]}</span>}
    </button>
  )

  let blocks: React.ReactNode
  if (view) {
    // Each block is a group named by its headers (market, and firm when split), so a screen reader moving by Tab
    // hears «Futuros · 30 Apex · 9» on entering it; the market header's id serves every block of that market
    const marketIds: Record<string, string> = {}
    blocks = (
      <div className="hub-seletor__blocos hub-seletor__rolagem">
        {view.blocks.map((b, i) => {
          const marketId = (marketIds[b.market] ??= `conta-g-${b.market}`)
          const firmId = b.byFirm ? `${marketId}-m${i}` : null
          return (
            <div key={`${b.market}-${i}`} role="group" aria-labelledby={firmId ? `${marketId} ${firmId}` : marketId} className="hub-seletor__bloco">
              {b.firstOfMarket && (
                <span id={marketId} className="hub-seletor__grupo">
                  {SELETOR_MUITAS.grupo(MARKET_LABEL[b.market], b.marketCount)}
                </span>
              )}
              {firmId && (
                <span id={firmId} className="hub-seletor__mesa">
                  {SELETOR_MUITAS.grupo(b.firm ?? SELETOR_MUITAS.semMesa, b.accounts.length)}
                </span>
              )}
              {b.accounts.map(option)}
            </div>
          )
        })}
        {view.query && view.found === 0 && <p className="hub-seletor__nada">{SELETOR_MUITAS.nenhuma(busca)}</p>}
      </div>
    )
  } else {
    blocks = groupByMarket(accounts).map((group) => (
      <Fragment key={group.market}>
        <span className="hub-seletor__grupo">{MARKET_LABEL[group.market]}</span>
        {group.accounts.map(option)}
      </Fragment>
    ))
  }

  return (
    // Escape closes the list wherever focus is in it, the button and the search included
    <div
      ref={wrapRef}
      className="hub-seletor"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="hub-btn hub-seletor__botao"
        aria-expanded={open}
        aria-controls="lista-contas"
        aria-describedby={janela ? 'janela-conta' : undefined}
        onClick={() => {
          setOpen((v) => !v)
          setBusca('')
        }}
      >
        <span>
          {SELETOR.prefix}
          <strong>{current.label}</strong>
        </span>
        <span aria-hidden="true" style={{ fontSize: 11 }}>
          ▾
        </span>
      </button>
      {janela && (
        <span id="janela-conta" className="hub-seletor__janela">
          {janela}
        </span>
      )}
      {open && (
        <>
          <div className="hub-seletor__fundo" aria-hidden="true" onClick={close} />
          <div ref={listRef} id="lista-contas" className={view ? 'hub-seletor__lista hub-seletor__lista--muitas' : 'hub-seletor__lista'}>
            {view && (
              <div className="hub-seletor__busca">
                <label htmlFor="busca-conta" className="sr-only">
                  {SELETOR_MUITAS.buscar}
                </label>
                <input
                  ref={searchRef}
                  id="busca-conta"
                  type="search"
                  autoComplete="off"
                  className="hub-entrada"
                  placeholder={SELETOR_MUITAS.placeholder}
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                />
                {/* Only while a query is typed: «9 contas encontradas.», «Nenhuma conta encontrada.» */}
                <div role="status" className="sr-only">
                  {view.query ? SELETOR_MUITAS.achadas(view.found) : ''}
                </div>
              </div>
            )}
            {blocks}
            <div className="hub-seletor__rodape">
              <button
                type="button"
                className="hub-seletor__op"
                style={{ fontWeight: 700 }}
                onClick={() => {
                  setOpen(false)
                  setBusca('')
                  onAdd(buttonRef.current)
                }}
              >
                {ADD_ACCOUNT}
              </button>
              <Link href="/personalizar#contas" className="hub-seletor__op">
                {SELETOR.manage}
              </Link>
            </div>
            <span className="hub-seletor__nota">{NEVER_SUMMED}</span>
          </div>
        </>
      )}
    </div>
  )
}

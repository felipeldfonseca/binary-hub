'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { groupByMarket, type TradingAccount } from '@/lib/hub/contas'
import { ADD_ACCOUNT, MARKET_LABEL, NEVER_SUMMED, PHASE_LABEL, SELETOR } from './copy'

interface Props {
  accounts: readonly TradingAccount[]
  current: TradingAccount
  onChoose: (id: string) => void
  /** "+ Adicionar conta": the button gets focus back when the sheet closes */
  onAdd: (opener: HTMLElement | null) => void
}

/**
 * "Conta: {label} ▾" and its list (Diário version of the boards): one account at a time, grouped
 * by market, never summed. Escape or a choice closes it and gives focus back to the button.
 */
export default function SeletorConta({ accounts, current, onChoose, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus goes into the list, on the current account
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const target = list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector<HTMLElement>('button, a')
    target?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    // Tabbing out of the list closes it, so it never covers the control that has focus
    const onFocusIn = (event: FocusEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="hub-seletor">
      <button
        ref={buttonRef}
        type="button"
        className="hub-btn hub-seletor__botao"
        aria-expanded={open}
        aria-controls="lista-contas"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {SELETOR.prefix}
          <strong>{current.label}</strong>
        </span>
        <span aria-hidden="true" style={{ fontSize: 11 }}>
          ▾
        </span>
      </button>
      {open && (
        <>
          <div className="hub-seletor__fundo" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            ref={listRef}
            id="lista-contas"
            className="hub-seletor__lista"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                close()
              }
            }}
          >
            {groupByMarket(accounts).map((group) => (
              <Fragment key={group.market}>
                <span className="hub-seletor__grupo">{MARKET_LABEL[group.market]}</span>
                {group.accounts.map((account) => (
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
                ))}
              </Fragment>
            ))}
            <div className="hub-seletor__rodape">
              <button
                type="button"
                className="hub-seletor__op"
                style={{ fontWeight: 700 }}
                onClick={() => {
                  setOpen(false)
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

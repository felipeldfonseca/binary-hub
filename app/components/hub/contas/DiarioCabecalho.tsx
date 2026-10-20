'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MARKET_SPEC } from '@/lib/domain/markets'
import { useContaAtual } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import type { TradingAccount } from '@/lib/hub/contas'
import { janelaLinha } from '@/lib/hub/posso'
import { podeRegistrar } from '@/lib/hub/registrar'
import { rulesNowFailed } from '@/components/hub/posso/rulesNowRead'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import SeletorConta from './SeletorConta'
import { ADD_ACCOUNT, CONTAS, DIARIO, IMPORT_FILE, LOADING, TRY_AGAIN } from './copy'

/** The H1 row alone, while the account data is not there yet. */
export function DiarioTitulo() {
  return (
    <div className="hub-pg-topo">
      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        <h1 tabIndex={-1}>{DIARIO.title}</h1>
      </div>
    </div>
  )
}

/**
 * Where /diario?registrar=1 opens the Registrar sheet: the current account when it can register in
 * 3-3, else the first active one that can (the primary first); null: none can, nothing opens
 */
export function contaParaRegistrar(current: TradingAccount | null, active: readonly TradingAccount[]): TradingAccount | null {
  if (current && podeRegistrar(current.market)) return current
  const can = active.filter((a) => podeRegistrar(a.market))
  return can.find((a) => a.is_primary) ?? can[0] ?? null
}

/**
 * The Diário header of the boards: H1, «Registrar operação» (Phase 3), «Importar arquivo» and the
 * account selector, with the current account's window under it (from the rules in force,
 * rules_now). Opening /diario?importar=1 opens the import sheet for the current account;
 * /diario?registrar=1 (a home-screen shortcut, the old dashboard's button) opens the Registrar
 * sheet, and wins when both are asked (one sheet at a time).
 *
 * Fase 2b: no file of the new markets is read yet (MARKET_SPEC[m].reader), so with such an account
 * in context the sheet opens without an account («Escolha o arquivo»), never on that account.
 * Phase 3 (D36): «Registrar operação» only for an account that can register in 3-3 (Futuros,
 * binárias); hidden while the accounts load, after a failed read and in the empty state.
 */
export default function DiarioCabecalho() {
  const conta = useContaAtual()
  const sheet = useImportSheet()
  const registrar = useRegistrarSheet()
  const router = useRouter()
  const searchParams = useSearchParams()
  const importRef = useRef<HTMLButtonElement>(null)
  const registrarRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const selectorRef = useRef<HTMLButtonElement>(null)
  const pressedRetry = useRef<HTMLButtonElement | null>(null)
  const handled = useRef(false)
  const wantsImport = searchParams?.get('importar') === '1'
  const wantsRegistrar = searchParams?.get('registrar') === '1'
  const currentId = conta.current?.id ?? null
  const canRegister = !conta.isLoading && !conta.isError && !!conta.current && podeRegistrar(conta.current.market)
  // The account the import starts on: the current one, when a reader exists for its market
  const importId = conta.current && MARKET_SPEC[conta.current.market].reader ? conta.current.id : null
  const rulesNow = useRulesNow()
  const rulesFailed = rulesNowFailed(rulesNow)

  // «Janela 10:00–11:00 ET» / «Sem janela salva»; nothing while loading, after a failed read (also
  // while it is retried or waits offline, as the card), or for an account the answer does not have
  // (no placeholder text under the button)
  const janela = useMemo(() => {
    if (rulesFailed || !rulesNow.data || !currentId) return null
    const account = rulesNow.data.accounts.find((a) => a.accountId === currentId)
    return account ? janelaLinha(account.rules) : null
  }, [rulesFailed, rulesNow.data, currentId])

  useEffect(() => {
    if (!wantsImport || wantsRegistrar || handled.current || conta.isLoading) return
    handled.current = true
    sheet.open({ mode: 'importar', accountId: importId, opener: importRef.current })
    // A reload must not open it again
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('importar')
    const query = params.toString()
    router.replace(query ? `/diario?${query}` : '/diario')
  }, [wantsImport, wantsRegistrar, conta.isLoading, importId, sheet, router, searchParams])

  // ?registrar=1: once the accounts are known, the sheet on the account that can register (the
  // current one, else the first that can); none can → nothing opens. The URL loses it (and
  // ?importar=1, which it beats), keeping ?conta=
  const registrarTarget = conta.isLoading ? null : contaParaRegistrar(conta.current, conta.active)
  useEffect(() => {
    if (!wantsRegistrar || handled.current || conta.isLoading) return
    handled.current = true
    if (registrarTarget) {
      // Focus comes back to the header's button when it is on screen (the current account), else
      // to the H1
      const onCurrent = registrarTarget.id === currentId
      registrar.open({ accountId: registrarTarget.id, opener: (onCurrent ? registrarRef.current : null) ?? titleRef.current, fallback: titleRef.current })
    }
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('registrar')
    params.delete('importar')
    const query = params.toString()
    router.replace(query ? `/diario?${query}` : '/diario')
  }, [wantsRegistrar, conta.isLoading, registrarTarget, currentId, registrar, router, searchParams])

  // «Tentar de novo» stays, with its focus, while its read runs. When the accounts replace it, focus
  // would fall to the page's start; it goes to the account selector that took its place (the H1
  // when there is no account, as when the empty state that opened the sheet is gone). Left alone
  // if it moved on meanwhile.
  useEffect(() => {
    const pressed = pressedRetry.current
    if (!pressed || pressed.isConnected) return
    pressedRetry.current = null
    const active = document.activeElement
    if (!active || active === document.body) (selectorRef.current ?? titleRef.current)?.focus()
  })

  const openImport = (opener: HTMLElement | null) => sheet.open({ mode: 'importar', accountId: importId, opener })
  const openAdd = (opener: HTMLElement | null) => sheet.open({ mode: 'adicionar', opener })

  // «Operações do dia» resolves the current account on its own (useContaAtual), and this header's
  // choice lives in its own useContaAtual until merge_preferences saves it: when that save fails,
  // the next read of the preferences (after an import, on reconnect) would put the old account back
  // in the bridge only. So the choice goes into ?conta=, which both read first (useContaAtual
  // already moves a ?conta= that is there); choose() saves it as before, for the next visit
  const choose = (id: string) => {
    if (!searchParams?.get('conta')) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('conta', id)
      // Already handled once the selector is on screen (a reload must not open a sheet again)
      params.delete('importar')
      params.delete('registrar')
      router.replace(`/diario?${params.toString()}`, { scroll: false })
    }
    void conta.choose(id)
  }

  let selector: React.ReactNode
  if (conta.isLoading && !conta.isRetrying) {
    selector = (
      <p role="status" className="hub-nota">
        {LOADING}
      </p>
    )
  } else if (conta.isError || conta.isRetrying) {
    // While «Tentar de novo» reads again, «Carregando…» takes the error's place and the button stays
    selector = (
      <div className="hub-linha">
        {conta.isRetrying ? (
          <p key="carregando" role="status" className="hub-nota">
            {LOADING}
          </p>
        ) : (
          <p key="erro" role="alert" className="hub-nota">
            {CONTAS.loadError}
          </p>
        )}
        <button
          type="button"
          className="hub-btn"
          onClick={(event) => {
            pressedRetry.current = event.currentTarget
            void conta.refetch()
          }}
        >
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (conta.current) {
    selector = (
      <SeletorConta
        accounts={conta.active}
        current={conta.current}
        onChoose={choose}
        onAdd={openAdd}
        janela={janela}
        buttonRef={selectorRef}
      />
    )
  } else {
    selector = (
      <div className="hub-vazio" style={{ flex: '1 1 100%' }}>
        <strong>{CONTAS.empty}</strong>
        <div className="hub-acoes">
          <button type="button" className="hub-btn hub-btn--pri" onClick={(event) => openImport(event.currentTarget)}>
            {IMPORT_FILE}
          </button>
          <button type="button" className="hub-btn" onClick={(event) => openAdd(event.currentTarget)}>
            {ADD_ACCOUNT}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="hub-pg-topo">
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          {/* Takes focus when the control that opened the import sheet, or «Tentar de novo», is gone
              and no account selector took its place (the empty state) */}
          <h1 ref={titleRef} tabIndex={-1}>
            {DIARIO.title}
          </h1>
        </div>
        <div className="hub-acoes">
          {canRegister && conta.current && (
            <button
              ref={registrarRef}
              type="button"
              className="hub-btn hub-btn--pri"
              onClick={(event) => registrar.open({ accountId: (conta.current as TradingAccount).id, opener: event.currentTarget })}
            >
              {DIARIO.registrar}
            </button>
          )}
          <button ref={importRef} type="button" className="hub-btn" onClick={(event) => openImport(event.currentTarget)}>
            {DIARIO.importFile}
          </button>
        </div>
      </div>
      <div className="hub-linha">{selector}</div>
    </>
  )
}

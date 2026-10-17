'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useContaAtual } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import { janelaLinha } from '@/lib/hub/posso'
import { rulesNowFailed } from '@/components/hub/posso/rulesNowRead'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
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
 * The Diário header of the boards: H1, "Importar arquivo" and the account selector, with the
 * current account's window under it (from the rules in force, rules_now). Opening
 * /diario?importar=1 opens the import sheet for the current account.
 */
export default function DiarioCabecalho() {
  const conta = useContaAtual()
  const sheet = useImportSheet()
  const router = useRouter()
  const searchParams = useSearchParams()
  const importRef = useRef<HTMLButtonElement>(null)
  const handled = useRef(false)
  const wantsImport = searchParams?.get('importar') === '1'
  const currentId = conta.current?.id ?? null
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
    if (!wantsImport || handled.current || conta.isLoading) return
    handled.current = true
    sheet.open({ mode: 'importar', accountId: currentId, opener: importRef.current })
    // A reload must not open it again
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('importar')
    const query = params.toString()
    router.replace(query ? `/diario?${query}` : '/diario')
  }, [wantsImport, conta.isLoading, currentId, sheet, router, searchParams])

  const openImport = (opener: HTMLElement | null) => sheet.open({ mode: 'importar', accountId: currentId, opener })
  const openAdd = (opener: HTMLElement | null) => sheet.open({ mode: 'adicionar', opener })

  let selector: React.ReactNode
  if (conta.isLoading) {
    selector = (
      <p role="status" className="hub-nota">
        {LOADING}
      </p>
    )
  } else if (conta.isError) {
    selector = (
      <div className="hub-linha">
        <p role="alert" className="hub-nota">
          {CONTAS.loadError}
        </p>
        <button type="button" className="hub-btn" onClick={() => void conta.refetch()}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (conta.current) {
    selector = (
      <SeletorConta
        accounts={conta.active}
        current={conta.current}
        onChoose={(id) => void conta.choose(id)}
        onAdd={openAdd}
        janela={janela}
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
          {/* Takes focus when the control that opened the import sheet is gone (the empty state) */}
          <h1 tabIndex={-1}>{DIARIO.title}</h1>
        </div>
        <div className="hub-acoes">
          <button ref={importRef} type="button" className="hub-btn" onClick={(event) => openImport(event.currentTarget)}>
            {DIARIO.importFile}
          </button>
        </div>
      </div>
      <div className="hub-linha">{selector}</div>
    </>
  )
}

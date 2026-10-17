'use client'

import Link from 'next/link'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { groupByMarket } from '@/lib/hub/contas'
import { possoLinha, type PossoLinha } from '@/lib/hub/posso'
import type { AccountNow } from '@/lib/hub/regras'
import { LOADING, POSSO, TRY_AGAIN } from './copy'

/** What a line needs from one account of rules_now() */
export type PossoConta = Pick<AccountNow, 'accountId' | 'label' | 'market' | 'gate' | 'rules'>

export type PossoEstado =
  | { status: 'loading' }
  /** The last read failed: no line is shown, even an older one (it may be outdated) */
  | { status: 'error' }
  | { status: 'ready'; accounts: readonly PossoConta[] }

interface Props {
  state: PossoEstado
  /** «Tentar de novo»: read the answers again */
  onRetry: () => void
}

/**
 * «Posso operar hoje?» (Início board, on /diario in Phase 2): one line per active account, futures
 * before binaries, each answered by its own rules on the server (rules_now). The words are
 * lib/hub/posso's; nothing is computed on the device clock here. No aria-live: a window opening
 * must not interrupt a screen reader; the line's text is the state.
 */
export default function PossoOperarHoje({ state, onRetry }: Props) {
  const [infoOpen, toggleInfo] = useToggle()

  // No active account: the Diário header already shows the empty state
  if (state.status === 'ready' && state.accounts.length === 0) return null

  let body: React.ReactNode
  if (state.status === 'loading') {
    body = (
      <p role="status" className="hub-nota hub-posso__aviso">
        {LOADING}
      </p>
    )
  } else if (state.status === 'error') {
    body = (
      <div className="hub-posso__aviso">
        <p role="alert" className="hub-nota">
          {POSSO.loadError}
        </p>
        <button type="button" className="hub-btn" onClick={onRetry}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else {
    // Grouped by market (Futuros, then Opções binárias), the server's order inside a group
    const accounts = groupByMarket(state.accounts).flatMap((group) => group.accounts)
    body = (
      <ul aria-labelledby="t-posso" className="hub-posso__lista">
        {accounts.map((account) => (
          <LinhaConta key={account.accountId} label={account.label} linha={possoLinha(account.label, account.gate, account.rules)} onRetry={onRetry} />
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby="t-posso" className="hub-posso">
      <div className="hub-posso__cab">
        <h2 id="t-posso" className="hub-posso__titulo">
          {POSSO.title}
        </h2>
        <InfoButton panelId="info-posso" label={POSSO.infoLabel} open={infoOpen} onToggle={toggleInfo} />
      </div>
      {body}
      {infoOpen && <InfoPanel id="info-posso">{POSSO.info}</InfoPanel>}
    </section>
  )
}

function RetryLink({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" className="hub-posso__acao" onClick={onRetry}>
      {TRY_AGAIN}
    </button>
  )
}

/** `li.conta-hoje` of the board: {apelido} · state · sub or action · «Limite do dia US$ 0 de US$ 400» */
function LinhaConta({ label, linha, onRetry }: { label: string; linha: PossoLinha; onRetry: () => void }) {
  const unavailable = linha.limite?.indisponivel === true
  // «Limite do dia indisponível · Tentar de novo»; with a window answer, the retry sits by the limit
  const retryInState = unavailable && !linha.sub && !linha.acao

  let detail: React.ReactNode = null
  if (linha.sub) detail = <span className="hub-tom--muted">{linha.sub}</span>
  else if (linha.acao) {
    detail = (
      <Link href={linha.acao.href} aria-label={linha.acao.aria} className="hub-posso__acao">
        {linha.acao.texto}
      </Link>
    )
  } else if (retryInState) detail = <RetryLink onRetry={onRetry} />

  // The board writes the answers in bold and the muted ones («Sem janela salva») in plain text-2
  const Word = linha.tom === 'muted' ? 'span' : 'strong'

  return (
    <li className="hub-posso__conta">
      <strong className="hub-posso__nome">{label}</strong>
      <span className={linha.sub ? 'hub-posso__estado hub-posso__estado--empilha' : 'hub-posso__estado'}>
        <Word className={`hub-posso__palavra hub-tom--${linha.tom}`}>{linha.palavra}</Word>
        {detail && (
          <>
            <span className="hub-posso__sep" aria-hidden="true">
              {POSSO.separator}
            </span>
            {detail}
          </>
        )}
      </span>
      {linha.limite && (
        // Plain text in Phase 2 (no link, no aria-label): what a screen reader reads is what shows
        <span className="hub-posso__limite">
          <span className="hub-rotulo">{POSSO.limitLabel}</span>
          <span className="hub-posso__valores">
            <span className="hub-posso__usado">{linha.limite.usado}</span>
            <span className="hub-tom--muted">{linha.limite.de}</span>
          </span>
          {unavailable && !retryInState && <RetryLink onRetry={onRetry} />}
        </span>
      )}
    </li>
  )
}

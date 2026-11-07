'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { groupByMarket } from '@/lib/hub/contas'
import { POSSO_NO_DIARIO_INFO, possoLinha, possoNoDiario, type PossoLinha } from '@/lib/hub/posso'
import type { AccountNow } from '@/lib/hub/regras'
import { MANY_ACCOUNTS } from '@/lib/hub/seletorContas'
import { LOADING, POSSO, POSSO_DIARIO, TRY_AGAIN } from './copy'

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
  /**
   * Phase 4 (the Diário, owner's revision of 25 Oct): the account open in the Diário. With it the card shows only that
   * account's line («somando as contas de Futuros» under its limit when the limit sums them) and ONE line for the
   * others with «Ver todas» (lib/hub/posso possoNoDiario); without it, or when the answer does not have that account,
   * one line per account as before
   */
  selecionada?: string
}

/** A «Tentar de novo» was pressed: the button, so its removal can be noticed */
type RetryHandler = (event: React.MouseEvent<HTMLButtonElement>) => void

/**
 * «Posso operar hoje?» (Início board, on /diario since Phase 2): every active account's answer by its own rules on
 * the server (rules_now), grouped in ACCOUNT_MARKETS order (Futuros, binárias, Forex, Ações, Cripto, B3). On the
 * Diário (Phase 4, `selecionada`) only the open account's line, then one line counting the others' answers and «Ver
 * todas» / «Ocultar» opening theirs (closed when the page opens; focus stays on the button). The words are
 * lib/hub/posso's, money in the account's currency («US$ 0 de US$ 1.000», «R$ 0 de R$ 500»); nothing is computed on
 * the device clock here. No aria-live: a window opening must not interrupt a screen reader; the line's text is the
 * state.
 */
export default function PossoOperarHoje({ state, onRetry, selecionada }: Props) {
  const [infoOpen, toggleInfo] = useToggle()
  const [outrasAbertas, setOutrasAbertas] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const pressedRetry = useRef<HTMLButtonElement | null>(null)

  const retry: RetryHandler = (event) => {
    pressedRetry.current = event.currentTarget
    onRetry()
  }

  // When the answer replaces the «Tentar de novo» that had focus, focus would fall to the page's
  // start; it goes to the card's title instead, so the next Tab continues from the card
  useEffect(() => {
    const pressed = pressedRetry.current
    if (!pressed || pressed.isConnected) return
    pressedRetry.current = null
    const active = document.activeElement
    if (!active || active === document.body) titleRef.current?.focus()
  })

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
        <button type="button" className="hub-btn" onClick={retry}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else {
    const diario = selecionada ? possoNoDiario(state.accounts, selecionada) : null
    if (diario?.conta) {
      const { conta, outras } = diario
      // From MANY_ACCOUNTS accounts the name column widens (board `.posso-largo`: «Apex 50k #5», «My Funded 50k #3»)
      const largo = state.accounts.length >= MANY_ACCOUNTS
      body = (
        <div className={largo ? 'hub-posso__corpo hub-posso__corpo--largo' : 'hub-posso__corpo'}>
          <ul aria-labelledby="t-posso" className="hub-posso__lista">
            <LinhaConta label={conta.label} linha={conta.linha} somando={conta.somando} onRetry={retry} />
          </ul>
          {outras && (
            <div className="hub-posso__outras">
              <p className="hub-posso__resumo">
                <strong>{outras.titulo}</strong>
                {outras.partes.map((parte, i) => {
                  // The board writes the states in bold, the muted ones in plain text-2; the «·» ends the part
                  // before it, so a wrapped line never starts with it (board revision 25 Oct)
                  const Parte = parte.tom === 'muted' ? 'span' : 'strong'
                  return (
                    <Parte key={parte.texto} className={`hub-posso__parte hub-tom--${parte.tom}`}>
                      {parte.texto}
                      {i < outras.partes.length - 1 && (
                        <span className="hub-posso__sep" aria-hidden="true">
                          {POSSO.separator}
                        </span>
                      )}
                    </Parte>
                  )
                })}
              </p>
              <button
                type="button"
                className="hub-btn"
                aria-expanded={outrasAbertas}
                aria-controls="posso-outras-lista"
                onClick={() => setOutrasAbertas((v) => !v)}
              >
                {outrasAbertas ? outras.ocultar : outras.verTodas}
              </button>
            </div>
          )}
          {outras && outrasAbertas && (
            <ul id="posso-outras-lista" aria-label={POSSO_DIARIO.outrasLista} className="hub-posso__lista hub-posso__todas">
              {outras.contas.map((c) => (
                <LinhaConta key={c.accountId} label={c.label} linha={c.linha} onRetry={retry} />
              ))}
            </ul>
          )}
        </div>
      )
    } else {
      // Grouped by market in ACCOUNT_MARKETS order, the server's order inside a group (also the Diário's fallback
      // when the open account is missing from the answer: every account, B11)
      const accounts = groupByMarket(state.accounts).flatMap((group) => group.accounts)
      body = (
        <ul aria-labelledby="t-posso" className="hub-posso__lista">
          {accounts.map((account) => (
            <LinhaConta key={account.accountId} label={account.label} linha={possoLinha(account.label, account.gate, account.rules)} onRetry={retry} />
          ))}
        </ul>
      )
    }
  }

  return (
    <section aria-labelledby="t-posso" className="hub-posso">
      <div className="hub-posso__cab">
        {/* Takes focus when a pressed «Tentar de novo» is replaced by the answer */}
        <h2 ref={titleRef} id="t-posso" tabIndex={-1} className="hub-posso__titulo hub-alvo-foco">
          {POSSO.title}
        </h2>
        <InfoButton panelId="info-posso" label={POSSO.infoLabel} open={infoOpen} onToggle={toggleInfo} />
      </div>
      {body}
      {infoOpen && <InfoPanel id="info-posso">{selecionada ? `${POSSO_NO_DIARIO_INFO} ${POSSO.info}` : POSSO.info}</InfoPanel>}
    </section>
  )
}

function RetryLink({ onRetry }: { onRetry: RetryHandler }) {
  return (
    <button type="button" className="hub-posso__acao" onClick={onRetry}>
      {TRY_AGAIN}
    </button>
  )
}

/**
 * `li.posso-conta` of the board: {apelido} · state · sub or action · «Limite do dia US$ 0 de US$ 400» (R$ on B3).
 * `somando` (the Diário's open account whose limit sums the Futuros accounts): «somando as contas de Futuros» under
 * the limit; the limit then sits in a column (board `.posso-lim-col`)
 */
function LinhaConta({ label, linha, somando, onRetry }: { label: string; linha: PossoLinha; somando?: boolean; onRetry: RetryHandler }) {
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

  const limite = linha.limite && (
    // Plain text (no link, no aria-label): what a screen reader reads is what shows
    <>
      <span className="hub-rotulo">{POSSO.limitLabel}</span>
      <span className="hub-posso__valores">
        <span className="hub-posso__usado">{linha.limite.usado}</span>
        <span className="hub-tom--muted">{linha.limite.de}</span>
      </span>
      {unavailable && !retryInState && <RetryLink onRetry={onRetry} />}
    </>
  )

  return (
    <li className="hub-posso__conta">
      <strong className="hub-posso__nome">{label}</strong>
      <span className="hub-posso__estado">
        <Word className={`hub-posso__palavra hub-tom--${linha.tom}`}>
          {linha.palavra}
          {/* Board revision of 25 Oct: the «·» ends the answer's own part («Fora da sua janela ·»), so when the sub
              wraps it starts its line without it; only for the eye */}
          {detail && (
            <span className={linha.sub ? 'hub-posso__sep hub-posso__sep--esp' : 'hub-posso__sep'} aria-hidden="true">
              {linha.sub ? `${POSSO.separator} ` : POSSO.separator}
            </span>
          )}
        </Word>
        {detail}
      </span>
      {limite &&
        (somando !== undefined ? (
          <span className="hub-posso__limite hub-posso__limite--col">
            <span className="hub-posso__limite-linha">{limite}</span>
            {somando && <span className="hub-tom--muted">{POSSO_DIARIO.somando}</span>}
          </span>
        ) : (
          <span className="hub-posso__limite">{limite}</span>
        ))}
    </li>
  )
}

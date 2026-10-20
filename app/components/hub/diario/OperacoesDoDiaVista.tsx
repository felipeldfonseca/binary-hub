'use client'

import { useEffect, useRef } from 'react'
import { LOADING, TRY_AGAIN } from '@/components/hub/contas/copy'
import { OPERACOES_DO_DIA_ID } from '@/components/hub/registrar/abrir'
import { OPERACOES_DIA as T } from './copy'
import type { LinhaDoDia, PlanoDaLinha } from './linhas'

export type EstadoDoDia =
  | { status: 'loading' }
  | { status: 'error' }
  /** The read waits for the connection (React Query pauses it offline) */
  | { status: 'offline' }
  | { status: 'ready'; linhas: readonly LinhaDoDia[] }

interface Props {
  estado: EstadoDoDia
  /**
   * A row's button: the Registrar sheet on that trade; `opener` gets the focus back, `fallback`
   * (the block's title) when the row is gone (an entry undone in the sheet)
   */
  onAbrir: (tradeId: string, opener: HTMLElement, fallback: HTMLElement | null) => void
  /** «Tentar de novo» */
  onTentar: () => void
}

/**
 * «Operações do dia» (board RegistrarOperacao v57, RO l.268–285; D16): the trades registered in the
 * app on the account's trading day, plus earlier ones still open or closed today, until the
 * Diário of Phase 4. Presentational: the rows come built (linhas.ts). The H2 (OPERACOES_DO_DIA_ID,
 * tabIndex -1) takes the focus after the sheet's «Ver no Diário», and after a «Tentar de novo» that
 * the answer replaced.
 */
export default function OperacoesDoDiaVista({ estado, onAbrir, onTentar }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const pressedRetry = useRef<HTMLButtonElement | null>(null)

  // When the answer replaces the «Tentar de novo» that had focus, focus would fall to the page's
  // start; it goes to the block's title instead
  useEffect(() => {
    const pressed = pressedRetry.current
    if (!pressed || pressed.isConnected) return
    pressedRetry.current = null
    const active = document.activeElement
    if (!active || active === document.body) titleRef.current?.focus()
  })

  let body: React.ReactNode
  if (estado.status === 'loading') {
    body = (
      <p role="status" className="hub-nota">
        {LOADING}
      </p>
    )
  } else if (estado.status === 'error' || estado.status === 'offline') {
    body = (
      <div className="hub-linha">
        <p role="alert" className="hub-nota">
          {estado.status === 'offline' ? T.offline : T.loadError}
        </p>
        <button
          type="button"
          className="hub-btn"
          onClick={(event) => {
            pressedRetry.current = event.currentTarget
            onTentar()
          }}
        >
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (estado.linhas.length === 0) {
    body = <p className="hub-nota hub-ops-dia__vazio">{T.empty}</p>
  } else {
    body = (
      <div role="table" aria-labelledby={OPERACOES_DO_DIA_ID} className="hub-ops-dia__tab">
        <div role="row" className="hub-ops-dia__linha hub-ops-dia__cab">
          <span role="columnheader">{T.colHora}</span>
          <span role="columnheader">{T.colOperacao}</span>
          <span role="columnheader">{T.colResultado}</span>
          <span role="columnheader">{T.colPlano}</span>
          <span role="columnheader">
            <span className="sr-only">{T.colAcao}</span>
          </span>
        </div>
        {estado.linhas.map((linha) => (
          <Linha key={linha.tradeId} linha={linha} onAbrir={(tradeId, opener) => onAbrir(tradeId, opener, titleRef.current)} />
        ))}
      </div>
    )
  }

  return (
    <section aria-labelledby={OPERACOES_DO_DIA_ID} className="hub-ops-dia">
      <h2 ref={titleRef} id={OPERACOES_DO_DIA_ID} tabIndex={-1} className="hub-ops-dia__titulo">
        {T.title}
      </h2>
      {body}
    </section>
  )
}

/** The paperclip of the board (RO l.277): a picture with its own name */
function Clipe({ label }: { label: string }) {
  return (
    <svg className="hub-ops-dia__clipe" width="13" height="13" viewBox="0 0 24 24" role="img" aria-label={label} focusable="false">
      <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
    </svg>
  )
}

function Plano({ plano }: { plano: PlanoDaLinha }) {
  if (plano.tipo === 'ok') return <span className="hub-ops-dia__marca">{T.noPlano}</span>
  if (plano.tipo === 'fora') {
    return (
      <span className="hub-ops-dia__fora">
        <span aria-hidden="true">●&nbsp;</span>
        {plano.texto}
      </span>
    )
  }
  return (
    <span className="hub-tom--muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{T.planoNaoAvaliado}</span>
    </span>
  )
}

function Linha({ linha, onAbrir }: { linha: LinhaDoDia; onAbrir: (tradeId: string, opener: HTMLElement) => void }) {
  return (
    <div role="row" className={linha.plano.tipo === 'fora' ? 'hub-ops-dia__linha hub-ops-dia__linha--fora' : 'hub-ops-dia__linha'}>
      <span role="cell" className="hub-ops-dia__hora">
        {linha.hora}
      </span>
      <span role="cell" className="hub-ops-dia__op">
        {linha.operacao}
        {linha.clip && (
          <>
            {' '}
            <Clipe label={linha.clip} />
          </>
        )}
      </span>
      <span role="cell" className="hub-ops-dia__res">
        {linha.resultado ? (
          <span className={`hub-ops-dia__valor hub-tom--${linha.resultado.tom}`}>{linha.resultado.texto}</span>
        ) : (
          <span className="hub-tom--muted">{T.aberta}</span>
        )}
      </span>
      <span role="cell" className="hub-ops-dia__plano">
        <Plano plano={linha.plano} />
      </span>
      <span role="cell" className="hub-ops-dia__acao">
        <button type="button" className="hub-btn" aria-label={linha.acaoAria} onClick={(event) => onAbrir(linha.tradeId, event.currentTarget)}>
          {linha.acao}
        </button>
      </span>
    </div>
  )
}

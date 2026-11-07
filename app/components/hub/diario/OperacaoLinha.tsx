'use client'

import type { DiaryDayTrade } from '@/lib/hub/diarioDb'
import {
  acaoDaLinha,
  clipDaLinha,
  detalhesAria,
  horaDaLinha,
  operacaoDaLinha,
  origemDaOperacao,
  planoDaLinha,
  resultadoDaLinha,
  subDaLinha,
  type ContaDaOperacao,
} from '@/lib/hub/diarioOperacao'
import OperacaoDetalhe, { type GuardaDoDrill } from './OperacaoDetalhe'
import { OPERACOES } from './copyDia'
import { drillId, linhaId } from './ids'

/** The paperclip of the board: a picture with its own name («tem imagens e nota») */
function Clipe({ label }: { label: string }) {
  return (
    <svg className="hub-dr-op-clipe" width="13" height="13" viewBox="0 0 24 24" role="img" aria-label={label} focusable="false">
      <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
    </svg>
  )
}

function Seta({ aberta }: { aberta: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="hub-dr-op-seta">
      <path d={aberta ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

/**
 * One trade of «Operações do dia» (contract G4–G12; board `.op-linha`): its rowgroup holds the row (Hora, Operação
 * with the paperclip, the origin chip and the second line, Resultado, Plano with the action, ▾) and, when open, the
 * drill's row. The ▾ is `linhaId` (the focus target of «Ver no Diário» and a deep link).
 */
export default function OperacaoLinha({
  t,
  conta,
  accountId,
  aberta,
  limiteAtingidoAs,
  aoAlternar,
  aoAcao,
  aoPendente,
  guarda,
}: {
  t: DiaryDayTrade
  conta: ContaDaOperacao
  accountId: string
  aberta: boolean
  limiteAtingidoAs: Date | null
  aoAlternar: () => void
  aoAcao: (opener: HTMLElement) => void
  aoPendente: (pendente: boolean) => void
  guarda: GuardaDoDrill | null
}) {
  const tid = t.trade.id
  const plano = planoDaLinha(t)
  const res = resultadoDaLinha(t, conta.currency)
  const acao = acaoDaLinha(t, conta.market, conta.tz)
  const clip = clipDaLinha(t)
  const chip = origemDaOperacao(t)
  const sub = subDaLinha(t, conta.market, conta.tz)
  return (
    <div role="rowgroup" className={plano.tipo === 'fora' ? 'hub-dr-op-grupo hub-dr-op-grupo--fora' : 'hub-dr-op-grupo'}>
      <div role="row" className="hub-dr-op-linha">
        <span role="cell" className="hub-dr-op-hora">
          {horaDaLinha(t, conta.tz)}
        </span>
        <span role="cell" className="hub-dr-op-op">
          <span>{operacaoDaLinha(t, conta.market)}</span>
          {clip && (
            <>
              {' '}
              <Clipe label={clip} />
            </>
          )}
          {chip && (
            <>
              {' '}
              <span className="hub-dr-op-chip">{chip}</span>
            </>
          )}
          {sub && <span className="hub-dr-op-sub">{sub}</span>}
        </span>
        <span role="cell" className={res ? `hub-dr-op-res hub-tom--${res.tom}` : 'hub-dr-op-res hub-tom--muted'}>
          {res ? res.texto : OPERACOES.aberta}
        </span>
        <span role="cell" className="hub-dr-op-plano">
          {plano.tipo === 'ok' && <span className="hub-dr-plano-marca hub-dr-plano-marca--ok">{OPERACOES.noPlano}</span>}
          {plano.tipo === 'fora' && (
            <span className="hub-dr-op-fora">
              <span aria-hidden="true">● {plano.texto}</span>
              <span className="sr-only">{plano.aria}</span>
            </span>
          )}
          {plano.tipo === 'historico' && <span className="hub-dr-op-hist">{OPERACOES.historico}</span>}
          {plano.tipo === 'nada' && (
            <span className="hub-tom--muted">
              <span aria-hidden="true">—</span>
              <span className="sr-only">{OPERACOES.planoNaoAvaliado}</span>
            </span>
          )}
          {acao && (
            <button type="button" className="hub-btn hub-dr-op-acao" aria-label={acao.aria} onClick={(event) => aoAcao(event.currentTarget)}>
              {acao.texto}
            </button>
          )}
        </span>
        <span role="cell" className="hub-dr-op-abre">
          <button
            id={linhaId(tid)}
            type="button"
            className="hub-btn hub-btn--icone hub-dr-op-btn"
            aria-expanded={aberta}
            aria-controls={drillId(tid)}
            aria-label={detalhesAria(t, conta.market, conta.tz)}
            onClick={aoAlternar}
          >
            <Seta aberta={aberta} />
          </button>
        </span>
      </div>
      {aberta && (
        <div role="row" className="hub-dr-op-drill">
          <div role="cell" aria-colspan={5} id={drillId(tid)}>
            <OperacaoDetalhe t={t} conta={conta} accountId={accountId} limiteAtingidoAs={limiteAtingidoAs} aoPendente={aoPendente} guarda={guarda} />
          </div>
        </div>
      )}
    </div>
  )
}

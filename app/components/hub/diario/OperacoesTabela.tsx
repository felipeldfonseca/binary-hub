'use client'

import { forwardRef, useState } from 'react'
import type { Day } from '@/lib/domain/diario'
import { apagadasTexto } from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { abertasDeOutrosDias, type ContaDaOperacao } from '@/lib/hub/diarioOperacao'
import { DIARIO } from '@/components/hub/contas/copy'
import { InfoButton, InfoPanel } from '@/components/hub/contas/ui'
import OperacaoLinha from './OperacaoLinha'
import type { GuardaDoDrill } from './OperacaoDetalhe'
import { OPERACOES } from './copyDia'
import { OPERACOES_DO_DIA_ID } from './ids'

export interface OperacoesTabelaProps {
  d: DayRead
  conta: ContaDaOperacao
  accountId: string
  hoje: Day | null
  /** The trade whose drill is open */
  aberta: string | null
  aoAlternar: (tradeId: string) => void
  /** A row's «Registrar saída» / «Registrar resultado»: the sheet on that trade */
  aoAcao: (tradeId: string, opener: HTMLElement) => void
  /** «Registrar operação» of an empty today */
  aoRegistrar: (opener: HTMLElement) => void
  /** «Abrir 30 nov» */
  aoAbrirDia: (day: Day, tradeId: string) => void
  aoPendente: (pendente: boolean) => void
  guarda: GuardaDoDrill | null
}

/**
 * «Operações do dia» (contract G1–G14; board `.ops`): the H3 with its ⓘ, the table of the day's trades (rows by entry,
 * one drill open at a time), the empty states, the deleted line, and the open trades of other days with their link.
 * The H3 is OPERACOES_DO_DIA_ID (tabIndex −1): a row gone after the sheet gives the focus to it.
 */
const OperacoesTabela = forwardRef<HTMLHeadingElement, OperacoesTabelaProps>(function OperacoesTabela(
  { d, conta, accountId, hoje, aberta, aoAlternar, aoAcao, aoRegistrar, aoAbrirDia, aoPendente, guarda },
  tituloRef,
) {
  const [info, setInfo] = useState(false)
  const ehHoje = !!hoje && d.day === hoje
  const apagadas = apagadasTexto(d.deleted, conta.tz)
  const outros = abertasDeOutrosDias(d.openElsewhere, hoje, conta.market)
  const limite = d.facts.limit?.hitAt ?? null
  return (
    <div className="hub-dr-op-bloco">
      <div className="hub-dr-cab">
        <div className="hub-dr-titulo-i">
          <h3 ref={tituloRef} id={OPERACOES_DO_DIA_ID} tabIndex={-1} className="hub-dr-dia-h3">
            {OPERACOES.titulo}
          </h3>
          <InfoButton panelId="info-ops" label={OPERACOES.infoAria} open={info} onToggle={() => setInfo((v) => !v)} />
        </div>
      </div>
      {info && <InfoPanel id="info-ops">{OPERACOES.info}</InfoPanel>}
      {d.trades.length === 0 ? (
        <div className="hub-dr-op-vazio">
          <span className="hub-tom--muted">{ehHoje ? OPERACOES.vazioHoje : OPERACOES.vazio}</span>
          {ehHoje && (
            <button type="button" className="hub-btn hub-btn--pri" onClick={(event) => aoRegistrar(event.currentTarget)}>
              {DIARIO.registrar}
            </button>
          )}
        </div>
      ) : (
        <div role="table" aria-labelledby={OPERACOES_DO_DIA_ID} className="hub-dr-op-tabela">
          <div role="row" className="hub-dr-op-linha hub-dr-op-cab">
            <span role="columnheader">{OPERACOES.colHora}</span>
            <span role="columnheader">{OPERACOES.colOperacao}</span>
            <span role="columnheader">{OPERACOES.colResultado}</span>
            <span role="columnheader">{OPERACOES.colPlano}</span>
            <span role="columnheader">
              <span className="sr-only">{OPERACOES.colDetalhes}</span>
            </span>
          </div>
          {d.trades.map((t) => (
            <OperacaoLinha
              key={t.trade.id}
              t={t}
              conta={conta}
              accountId={accountId}
              aberta={aberta === t.trade.id}
              limiteAtingidoAs={limite}
              aoAlternar={() => aoAlternar(t.trade.id)}
              aoAcao={(opener) => aoAcao(t.trade.id, opener)}
              aoPendente={aoPendente}
              guarda={aberta === t.trade.id ? guarda : null}
            />
          ))}
        </div>
      )}
      {apagadas && <p className="hub-dr-op-apagadas">{apagadas}</p>}
      {outros.map((o) => (
        <div key={o.dia} className="hub-dr-op-outros">
          <span>{o.texto}</span>
          <button type="button" className="hub-dr-op-link" onClick={() => aoAbrirDia(o.dia, o.tradeId)}>
            {o.link}
          </button>
        </div>
      ))}
    </div>
  )
})

export default OperacoesTabela

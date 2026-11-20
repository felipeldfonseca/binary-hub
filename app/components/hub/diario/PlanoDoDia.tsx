'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Day } from '@/lib/domain/diario'
import {
  blocoDoDia,
  comoLerOPlano,
  doPregaoAnterior,
  entradasDosDados,
  linhaDosDadosDoPlano,
  linhasDoPlano,
  temLinhaDeDados,
  versaoAnterior,
  type ContaDiario,
  type LinhaDoPlano,
} from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { InfoButton, InfoPanel } from '@/components/hub/contas/ui'
import AntesDeOperar from './AntesDeOperar'
import { ANTERIOR, PLANO, TIMELINE } from './copyDia'
import { relogioDoDia, useAgendaDoDiaAberto } from './useDadosDoDia'

/** The plan cell, with each «09:55–10:10» of the data line kept on one line (Q27) */
function Plano({ l }: { l: LinhaDoPlano }) {
  if (l.item !== 'Dados econômicos') return <>{l.plano}</>
  const partes = l.plano.split(/(\d\d:\d\d–\d\d:\d\d)/)
  return (
    <>
      {partes.map((x, i) =>
        i % 2 ? (
          <span key={i} style={{ whiteSpace: 'nowrap' }}>
            {x}
          </span>
        ) : (
          x
        ),
      )}
    </>
  )
}

/**
 * «O plano do dia» (contract F1–F13; board `.ck`, `.notas-dia`, `.tl-vaga`): Janela, Limite and Breakeven against the
 * day's facts, the earlier versions in force during the day, «Antes de operar» and «Do pregão anterior», then the
 * timeline's place («chega na Fase 5»). Shown on a day of an account with rules that is not history. Futuros: the
 * «Dados econômicos» line between Janela and Limite (Phase 5-1), from the entries' gate answers, or, on a day without
 * entries, from the day's version and that day's agenda read (G6; the line waits for the read).
 */
export default function PlanoDoDia({ d, hoje, accountId, conta }: { d: DayRead; hoje: Day | null; accountId: string; conta: ContaDiario }) {
  const [info, setInfo] = useState(false)
  const rules = d.plan.rules
  const entradas = entradasDosDados(d.trades)
  const precisaLer = entradas.length === 0 && temLinhaDeDados(conta.market) && !!rules?.block?.on && rules.block.calendars.length > 0
  const agenda = useAgendaDoDiaAberto(conta.market, rules, d.day, { enabled: precisaLer })
  if (!rules) return null
  const daConta = { market: conta.market, dayClock: relogioDoDia(conta.market, rules) }
  const semEntrada = entradas.length
    ? undefined
    : !precisaLer
      ? blocoDoDia(rules, daConta, d.day, null)
      : agenda.data
        ? blocoDoDia(rules, daConta, d.day, agenda.data)
        : agenda.isError
          ? blocoDoDia(rules, daConta, d.day, null)
          : undefined
  const linhas = linhasDoPlano(rules, d.facts, conta, linhaDosDadosDoPlano(entradas, semEntrada, conta))
  return (
    <>
      <div className="hub-dr-plano-bloco">
        <div className="hub-dr-cab">
          <div className="hub-dr-titulo-i">
            <h3 id="t-plano-dia" className="hub-dr-dia-h3">
              {PLANO.titulo}
            </h3>
            <InfoButton panelId="info-plano" label={PLANO.infoAria} open={info} onToggle={() => setInfo((v) => !v)} />
          </div>
        </div>
        {info && <InfoPanel id="info-plano">{comoLerOPlano(conta.market, !!rules.breakeven)}</InfoPanel>}
        <ul className="hub-dr-plano-lista" aria-labelledby="t-plano-dia">
          {linhas.map((l) => (
            <li key={l.item} className="hub-dr-plano-linha">
              <strong>{l.item}</strong>
              <span className="hub-dr-plano-meio">
                <span className="hub-tom--muted">
                  <Plano l={l} />
                </span>
                {l.fato && <span>{l.fato}</span>}
                {l.link && (
                  <Link href={PLANO.definirHref} className="hub-dr-plano-link">
                    {l.link}
                  </Link>
                )}
              </span>
              {l.marca && <span className={`hub-dr-plano-marca hub-dr-plano-marca--${l.tipo}`}>{l.marca}</span>}
            </li>
          ))}
        </ul>
        {d.plan.changes.map((c) => (
          <p key={c.id} className="hub-dr-plano-versao">
            {versaoAnterior(c, rules, conta)}
          </p>
        ))}
        <div className="hub-dr-plano-notas">
          <AntesDeOperar d={d} hoje={hoje} accountId={accountId} conta={conta} />
          <div className="hub-dr-plano-nota">
            <div className="hub-dr-plano-rot">{ANTERIOR.rotulo}</div>
            <div className="hub-dr-plano-texto">{doPregaoAnterior(d.carryIn)}</div>
          </div>
        </div>
      </div>
      <div className="hub-dr-plano-vaga">
        <h3 className="hub-dr-dia-h3">{TIMELINE.titulo}</h3>
        <span className="hub-dr-plano-fase">{TIMELINE.chip}</span>
        <span className="hub-dr-plano-vaga-txt">{TIMELINE.texto}</span>
      </div>
    </>
  )
}

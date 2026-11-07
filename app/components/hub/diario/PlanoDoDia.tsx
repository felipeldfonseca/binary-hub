'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Day } from '@/lib/domain/diario'
import { comoLerOPlano, doPregaoAnterior, linhasDoPlano, versaoAnterior, type ContaDiario } from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { InfoButton, InfoPanel } from '@/components/hub/contas/ui'
import AntesDeOperar from './AntesDeOperar'
import { ANTERIOR, PLANO, TIMELINE } from './copyDia'

/**
 * «O plano do dia» (contract F1–F13; board `.ck`, `.notas-dia`, `.tl-vaga`): Janela, Limite and Breakeven against the
 * day's facts, the earlier versions in force during the day, «Antes de operar» and «Do pregão anterior», then the
 * timeline's place («chega na Fase 5»). Shown on a day of an account with rules that is not history.
 */
export default function PlanoDoDia({ d, hoje, accountId, conta }: { d: DayRead; hoje: Day | null; accountId: string; conta: ContaDiario }) {
  const [info, setInfo] = useState(false)
  const rules = d.plan.rules
  if (!rules) return null
  const linhas = linhasDoPlano(rules, d.facts, conta)
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
                <span className="hub-tom--muted">{l.plano}</span>
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

'use client'

import { useState } from 'react'
import { dayTiles, type CalendarDay } from '@/lib/domain/diario'
import {
  comoLerOHistorico,
  comoLerOsNumeros,
  numerosDoDia,
  numerosDoHistorico,
  numerosSemRegras,
  type ContaDiario,
  type NumerosTexto,
} from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { InfoButton, InfoPanel } from '@/components/hub/contas/ui'
import { NUMEROS } from './copyDia'

/** The tiles' words: a history day, an account without rules, or a diário/misto day (contract E4–E6) */
export function numerosDe(d: DayRead, calDay: CalendarDay | null, conta: ContaDiario): { n: NumerosTexto; info: string } {
  if (d.kind === 'historico' && calDay?.history) return { n: numerosDoHistorico(calDay.history, conta), info: comoLerOHistorico(calDay.history, conta) }
  const t = dayTiles(d.facts, conta.market)
  if (!d.desde) return { n: numerosSemRegras(conta), info: comoLerOsNumeros(t, conta, d.facts) }
  return { n: numerosDoDia(t, conta), info: comoLerOsNumeros(t, conta, d.facts) }
}

/**
 * The day's four tiles (contract E4–E8; board `.tiles`): «Resultado» and «Operações» mono 20, «Limite do dia» and
 * «Fora do plano» 15 px bold in the regular font, the limit's bar between its value and its line; under them «Como
 * ler os números do dia» with its ⓘ.
 */
export default function NumerosDoDia({ d, calDay, conta }: { d: DayRead; calDay: CalendarDay | null; conta: ContaDiario }) {
  const [info, setInfo] = useState(false)
  const { n, info: texto } = numerosDe(d, calDay, conta)
  return (
    <div className="hub-dr-dia-numeros">
      <div className="hub-dr-tiles">
        <div className="hub-dr-tile">
          <span className="hub-dr-rotulo">{NUMEROS.resultado}</span>
          <span className={`hub-dr-valor hub-tom--${n.resTom}`}>{n.res}</span>
        </div>
        <div className="hub-dr-tile">
          <span className="hub-dr-rotulo">{NUMEROS.operacoes}</span>
          <span className="hub-dr-valor">{n.ops}</span>
          <span className="hub-dr-dia-tsub">{n.opsSub}</span>
        </div>
        <div className="hub-dr-tile">
          <span className="hub-dr-rotulo">{NUMEROS.limite}</span>
          <span className="hub-dr-valor hub-dr-valor--texto">{n.lim}</span>
          {n.barra !== null && (
            <span className="hub-dr-barra" aria-hidden="true">
              <span className={`hub-dr-dia-barra hub-dr-dia-barra--${n.barraTom}`} style={{ width: `${Math.max(0, Math.min(100, n.barra))}%` }} />
            </span>
          )}
          <span className="hub-dr-dia-tsub">{n.limSub}</span>
        </div>
        <div className="hub-dr-tile">
          <span className="hub-dr-rotulo">{NUMEROS.fora}</span>
          <span className={`hub-dr-valor hub-dr-valor--texto hub-tom--${n.foraTom}`}>{n.fora}</span>
          <span className="hub-dr-dia-tsub">{n.foraSub}</span>
        </div>
      </div>
      <div className="hub-dr-dia-comoler">
        <InfoButton panelId="info-resumo" label={NUMEROS.comoLerAria} open={info} onToggle={() => setInfo((v) => !v)} />
        <span className="hub-dr-dia-tsub">{NUMEROS.comoLer}</span>
      </div>
      {info && <InfoPanel id="info-resumo">{texto}</InfoPanel>}
    </div>
  )
}

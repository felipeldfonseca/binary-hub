'use client'

import { forwardRef } from 'react'
import type { GridCell, GridWeek } from '@/lib/domain/diario'
import { rotuloSemana, tomDe, type CelulaTexto, type SemanaCelulaTexto } from '@/lib/hub/diario'

/** The cell's entrance delay (board `atraso`: 14 ms a cell, row by row, the «Semana» cell last in its row) */
const atraso = (ordem: number) => ({ animationDelay: `${ordem * 14}ms` })

/**
 * The cell's classes (board `cal-cel` + `classe` + `fundoDe`): the colour by level and sign (gains and losses apart;
 * the history on its own scale, hatched, white stripes from level 3), today's dot, a neighbouring month's dashed
 * border, and where the hover's tip anchors (left on the first column, right on the last two)
 */
function classes(cell: GridCell, coluna: number, colunas: number): string {
  const out = ['hub-dr-cal-cel']
  if (cell.hasTrades && cell.level > 0) out.push(`hub-dr-cal-cel--${cell.loss ? 'p' : 'g'}${cell.level}`)
  if (cell.historyOnly) out.push(cell.level >= 3 ? 'hub-dr-cal-cel--hist-forte' : 'hub-dr-cal-cel--hist')
  if (cell.today) out.push('hub-dr-cal-cel--hoje')
  if (!cell.inMonth) out.push('hub-dr-cal-cel--fora')
  if (coluna === 0) out.push('hub-dr-cal-cel--dica-e')
  else if (coluna >= colunas - 2) out.push('hub-dr-cal-cel--dica-d')
  return out.join(' ')
}

export interface CelulaDoDiaProps {
  cell: GridCell
  /** D celulaDoCalendario(cell, conta, mesDay) */
  texto: CelulaTexto
  /** Its column (0 = Seg) and the month's columns (5 or 7) */
  coluna: number
  colunas: number
  /** Its place in the grid, for the entrance */
  ordem: number
  /** The open day (2 px border, aria-pressed) */
  aberto: boolean
  /** The month's one tab stop (D14) */
  parada: boolean
  onAbrir: (day: string) => void
  onFocar: (day: string) => void
}

/**
 * One day of «Calendário» (contract D8–D16): a button when the day opens (a past or current day with trades, today,
 * a written review), labelled by the domain's words (every inner span aria-hidden), else a div with a visually hidden
 * label (a weekday without trades, the future, today in a neighbouring month); the neighbouring month's other days
 * have none. The marks ● ■ ✓ (fora do plano, limite atingido, revisão), the result and its short form (≤ 700 px), the
 * hover's tip (also on keyboard focus; none on touch screens and phones).
 */
export const CelulaDoDia = forwardRef<HTMLButtonElement, CelulaDoDiaProps>(function CelulaDoDia(
  { cell, texto, coluna, colunas, ordem, aberto, parada, onAbrir, onFocar },
  ref,
) {
  const num = String(Number(cell.day.slice(8, 10)))
  const fora = !!cell.fora?.n
  const limite = !!cell.limitHitAt
  const temMarcas = cell.inMonth && !cell.future && (fora || limite || cell.reviewed)
  const cabeca = (
    <span className="hub-dr-cal-cab" aria-hidden="true">
      <span className="hub-dr-cal-num">{num}</span>
      {temMarcas && (
        <span className="hub-dr-cal-marcas">
          {fora && <span className="hub-tom--amber">●</span>}
          {limite && <span className="hub-tom--red">■</span>}
          {cell.reviewed && <span className="hub-tom--mint">✓</span>}
        </span>
      )}
    </span>
  )
  const valor = cell.hasTrades ? 'hub-dr-cal-res hub-dr-cal-res--num' : 'hub-dr-cal-res'
  const corpo = (
    <>
      <span className={`${valor} hub-dr-cal-res--longo`} aria-hidden="true">
        {texto.res}
      </span>
      <span className={`${valor} hub-dr-cal-res--curto`} aria-hidden="true">
        {texto.resCurto}
      </span>
      {texto.dica && (
        <span className="hub-dr-cal-dica" aria-hidden="true">
          {texto.dica}
        </span>
      )}
    </>
  )

  if (cell.clickable) {
    return (
      <button
        ref={ref}
        type="button"
        className={`${classes(cell, coluna, colunas)} hub-dr-cal-cel--botao`}
        data-dia={cell.day}
        tabIndex={parada ? 0 : -1}
        aria-pressed={aberto}
        aria-label={texto.aria}
        onClick={() => onAbrir(cell.day)}
        onFocus={() => onFocar(cell.day)}
        style={atraso(ordem)}
      >
        {cabeca}
        {corpo}
      </button>
    )
  }
  return (
    <div className={`${classes(cell, coluna, colunas)} hub-dr-cal-cel--fixa`} style={atraso(ordem)}>
      {texto.aria && <span className="sr-only">{texto.aria}</span>}
      <span className="hub-dr-cal-cab" aria-hidden="true">
        <span className="hub-dr-cal-num">{num}</span>
      </span>
      {corpo}
    </div>
  )
})

export interface CelulaDaSemanaProps {
  w: GridWeek
  /** D celulaDaSemana(w, conta); null for a week without trades */
  texto: SemanaCelulaTexto | null
  ordem: number
  /** The week the card shows */
  aberta: boolean
  onAbrir: (week: string) => void
}

/**
 * The «Semana» column's cell (D18, D19): the week's label, its diário result in the diário's colour, «8 op. · ● 1»,
 * «▨ +163,29»; a week with only history is hatched, its result muted. A button (a regular tab stop, outside the roving
 * group) that opens the week in the card; a week without trades is a div with «—» once it started.
 */
export function CelulaDaSemana({ w, texto, ordem, aberta, onAbrir }: CelulaDaSemanaProps) {
  if (!texto) {
    return (
      <div className="hub-dr-cal-cel hub-dr-cal-sem" style={atraso(ordem)}>
        <span className="hub-dr-cal-sem-rot">{rotuloSemana(w.weekOf, w.lastShown)}</span>
        <span className="hub-dr-cal-sem-traco">{w.started ? '—' : ''}</span>
      </div>
    )
  }
  const tom = w.diario ? `hub-tom--${tomDe(w.diario.net)}` : 'hub-tom--muted'
  return (
    <button
      type="button"
      className={w.diario ? 'hub-dr-cal-cel hub-dr-cal-sem' : 'hub-dr-cal-cel hub-dr-cal-sem hub-dr-cal-cel--hist'}
      aria-pressed={aberta}
      aria-label={texto.aria}
      onClick={() => onAbrir(w.weekOf)}
      style={atraso(ordem)}
    >
      <span className="hub-dr-cal-sem-rot" aria-hidden="true">
        {texto.rotulo}
      </span>
      <span className={`hub-dr-cal-sem-res ${tom}`} aria-hidden="true">
        {texto.res}
      </span>
      <span className="hub-dr-cal-sem-n" aria-hidden="true">
        {texto.n}
        {texto.fora && (
          <>
            {' · '}
            <span className="hub-tom--amber">●</span> {texto.fora}
          </>
        )}
      </span>
      {texto.historia && (
        <span className="hub-dr-cal-sem-n" aria-hidden="true">
          ▨ {texto.historia}
        </span>
      )}
    </button>
  )
}

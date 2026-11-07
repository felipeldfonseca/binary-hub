/**
 * The Diário page's lane L1 «mês e semana» (Phase 4, telas): its pure rules, no React. The calendar's roving focus
 * (contract D14: one tab stop per month, arrows between the days that open, Home/End, PageUp/PageDown to the
 * neighbouring months), which day holds the tab stop, the legend's flags (D22), the screen-reader statuses of the
 * month, the day and the week opened from the calendar (D5, J3: said once, ended by another day), and which month read
 * feeds the week card (§5.6).
 * The words come from components/hub/diario/copyMes.ts (NEW) and lib/hub/diario.ts (D).
 */
import { addDays } from '@/lib/domain/tempo'
import { monthOf, type Day } from '@/lib/domain/diario'
import type { Rules } from '@/lib/domain/gate'
import { diaLongo, intervaloLongo, mesTitulo } from './diario'
import { CAL, SEMANA } from '@/components/hub/diario/copyMes'

/** Where a key takes the calendar's focus: another day of the month, or the previous / next month */
export type MovimentoDoFoco = { tipo: 'dia'; dia: Day } | { tipo: 'mes'; passo: -1 | 1 }

/** The keys the grid handles (every one calls preventDefault, D14) */
export const TECLAS_DO_CALENDARIO = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'] as const

/**
 * The calendar's roving focus (D14, the board's `teclaCal`), over the month's days that open (`clicaveis`, in date
 * order) from the focused one (`alvo`):
 * - ← / → the previous / next day that opens (none past the ends: the focus stays)
 * - ↓ the first that opens a week or more later, else the last; ↑ the last a week or more earlier, else the first
 * - Home / End the first / last
 * - PageUp / PageDown the previous / next month (the caller checks it is one the calendar pages through)
 * null: a key the grid does not handle (Tab, Enter and Space are the browser's).
 */
export function proximoFoco(clicaveis: readonly Day[], alvo: Day, tecla: string): MovimentoDoFoco | null {
  if (tecla === 'PageUp') return { tipo: 'mes', passo: -1 }
  if (tecla === 'PageDown') return { tipo: 'mes', passo: 1 }
  if (!(TECLAS_DO_CALENDARIO as readonly string[]).includes(tecla) || clicaveis.length === 0) return null
  const i = clicaveis.indexOf(alvo)
  const primeiro = clicaveis[0]
  const ultimo = clicaveis[clicaveis.length - 1]
  let dia: Day
  switch (tecla) {
    case 'ArrowRight':
      dia = i < 0 ? (clicaveis.find((d) => d > alvo) ?? ultimo) : clicaveis[Math.min(i + 1, clicaveis.length - 1)]
      break
    case 'ArrowLeft':
      dia = i < 0 ? (clicaveis.filter((d) => d < alvo).pop() ?? primeiro) : clicaveis[Math.max(i - 1, 0)]
      break
    case 'ArrowDown': {
      const alvoMais7 = addDays(alvo, 7)
      dia = clicaveis.find((d) => d >= alvoMais7) ?? ultimo
      break
    }
    case 'ArrowUp': {
      const alvoMenos7 = addDays(alvo, -7)
      dia = clicaveis.filter((d) => d <= alvoMenos7).pop() ?? primeiro
      break
    }
    case 'Home':
      dia = primeiro
      break
    default:
      dia = ultimo
  }
  return { tipo: 'dia', dia }
}

/**
 * The month's one tab stop (D14): the day the keyboard last focused when it still opens, else the open day when it
 * opens in this month, else the first day that opens; null in a month where no day opens
 */
export function paradaDoTab(clicaveis: readonly Day[], dia: Day | null, focado: Day | null): Day | null {
  if (focado && clicaveis.includes(focado)) return focado
  if (dia && clicaveis.includes(dia)) return dia
  return clicaveis[0] ?? null
}

/** The month before and after `mes` among the months the calendar pages through (calendarMonths); null at the ends */
export function mesesVizinhos(meses: readonly string[], mes: string): { anterior: string | null; proximo: string | null } {
  return {
    anterior: meses.filter((m) => m < mes).pop() ?? null,
    proximo: meses.find((m) => m > mes) ?? null,
  }
}

/** The legend's flags (D22): «■ limite atingido» only when the account's rules have a daily limit */
export function legendaDoCalendario(regras: Pick<Rules, 'limit'> | null): { limite: boolean } {
  return { limite: !!regras?.limit }
}

/** «Mês: Novembro de 2026.» (D5) */
export const statusDoMes = (mes: string): string => CAL.mesStatus(mesTitulo(mes))

/** «Aberto abaixo: Terça-feira, 10 de novembro.» (D5), once a day opened from the calendar; '' otherwise */
export const statusDoDia = (dia: Day | null, anunciado: Day | null): string => (dia && anunciado === dia ? CAL.abertoAbaixo(diaLongo(dia)) : '')

/**
 * «Semana aberta abaixo: 9 a 15 de novembro.» (J3, D20): the week as the calendar draws it, with the shown month's
 * columns (`monthGrid().columns`), so the range is the week cell's own label's (the board's `rangeTxt(s, s + cols − 1)`):
 * in a 7-column month a week without a weekend trade still runs to Sunday
 */
export function textoDaSemanaAberta(semana: Day, colunas: 5 | 7): string {
  return SEMANA.abertaAbaixo(intervaloLongo(semana, addDays(semana, colunas - 1)))
}

/** J3's announcement: the week opened from the calendar, the day open when it was, and its words */
export interface AnuncioDaSemana {
  semana: Day
  dia: Day | null
  texto: string
}

/** What the week card last saw of the page: the last week opened from the calendar (B0's semanaAnunciada), the open day */
export interface VistoDaSemana {
  semanaAnunciada: Day | null
  dia: Day | null
}

/**
 * J3 from one render to the next: a week opened from the calendar (semanaAnunciada changed) is said, in the shown month's
 * columns; it holds while that day stays open; another day opening ends it (the calendar's D5 «Aberto abaixo: …» says
 * that one), so a day opened later inside that week never says the week again. B0 never clears semanaAnunciada, and the
 * same week tapped again changes nothing the card sees: then nothing is said (as the board, whose text stays the same).
 */
export function proximoAnuncio(atual: AnuncioDaSemana | null, antes: VistoDaSemana, agora: VistoDaSemana, colunas: 5 | 7): AnuncioDaSemana | null {
  if (agora.semanaAnunciada && agora.semanaAnunciada !== antes.semanaAnunciada) {
    return { semana: agora.semanaAnunciada, dia: agora.dia, texto: textoDaSemanaAberta(agora.semanaAnunciada, colunas) }
  }
  if (atual && atual.dia === agora.dia && atual.semana === agora.semanaAnunciada) return atual
  return null
}

/** J3's status text for the week the card shows: the announcement's while it is that week; '' otherwise */
export function statusDaSemana(anuncio: AnuncioDaSemana | null, semanaMostrada: Day): string {
  return anuncio && anuncio.semana === semanaMostrada ? anuncio.texto : ''
}

/**
 * The month whose diario_mes feeds the week card (§5.6): the month shown when the week's Monday is in it, else the
 * week's own month (a straddling week such as 30 nov–4 dez with December shown, or a week left behind by ‹ ›)
 */
export function mesDaSemana(semana: Day, mes: string): { mes: string; proprio: boolean } {
  const proprio = monthOf(semana) !== mes
  return { mes: proprio ? monthOf(semana) : mes, proprio }
}

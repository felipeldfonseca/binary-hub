/**
 * Phase 5-1 · the pure parts of the «Dados econômicos» row in «Suas regras» (layout A, SPEC §7.1; c3 §3):
 * what the entity does as edited, the summary sentence, the list's groups with each release's next date,
 * the status line «Hoje: …» in c3 §3.10's order, and the old account's notice. No React; the words are
 * copy.ts's DADOS. Hours on the account's window clock (Futuros: New York, «ET»).
 */
import {
  AGENDA_RELEASES,
  LISTA_A_V1,
  agendaFor,
  blockIntervals,
  releaseOrd,
  type AgendaRead,
  type AgendaRow,
  type CalendarCode,
  type ReleaseCode,
  type ReleaseMode,
  type Rules,
} from '@/lib/domain/gate'
import { addDays, tradingDayBounds, tradingDayOn } from '@/lib/domain/tempo'
import type { BlockSetting, RulesSettings } from '@/lib/hub/regras'
import { atalhoDoMapa, dadosEfetivos, temProprio, type AtalhoDados, type Entidade } from '@/lib/hub/rascunho'
import { NOMES_DADOS } from '@/lib/hub/dadosEconomicos'
import { ENTREGA_DADOS_ECONOMICOS, contaAntigaDesde } from '@/lib/hub/avisoDados'
import { dataEm, diaComMes, hhmm, horaEt, relogioDe } from '@/lib/hub/comoFicaHoje'
import { DADOS, SEP, lista } from './copy'

/** What the row shows of the entity, as edited */
export interface EstadoDados {
  on: boolean
  beforeMin: number
  afterMin: number
  /** The account sets some key of the rule itself («só nesta conta») */
  propria: boolean
  /** Every code's behaviour (own, else the futures default's, else the app's) */
  modos: Record<ReleaseCode, ReleaseMode>
  /** The codes the account sets itself */
  proprios: readonly ReleaseCode[]
  /** The calendars followed (the draft's) */
  calendars: readonly CalendarCode[]
  /** The ready-made choice the list matches (SPEC §3.6: the screen looks at the map) */
  atalho: AtalhoDados | 'personalizado'
}

const DEFAULT_BLOCK = { on: true, beforeMin: 5, afterMin: 10 }

export function estadoDados(draft: RulesSettings, entidade: Entidade): EstadoDados {
  const mb = draft.markets.futures.block ?? DEFAULT_BLOCK
  const own: Partial<BlockSetting> = entidade.tipo === 'conta' ? (draft.accounts[entidade.conta.id]?.block ?? {}) : {}
  const { modos, proprios } = dadosEfetivos(draft, entidade)
  return {
    on: own.on ?? mb.on,
    beforeMin: own.beforeMin ?? mb.beforeMin,
    afterMin: own.afterMin ?? mb.afterMin,
    propria: entidade.tipo === 'conta' && temProprio(draft, entidade.conta.id, 'block'),
    modos,
    proprios,
    calendars: draft.calendars,
    atalho: atalhoDoMapa(modos, draft.calendars),
  }
}

/** The codes of the calendars followed, in list order */
export const codigosSeguidos = (calendars: readonly CalendarCode[]): ReleaseCode[] =>
  AGENDA_RELEASES.filter((r) => calendars.includes(r.calendar)).map((r) => r.code)

const ORDEM_MODOS: readonly ReleaseMode[] = ['dia', 'depois', 'volta', 'normal']

/**
 * The summary sentence (c3 l.477-479; boards Q01, Q04, Q05, Q42): from the strongest behaviour to the
 * weakest, the names when up to 3 releases, the count when more; «os 10 dados fortes dos EUA» when a
 * behaviour holds exactly the strong data of the calendars followed; a behaviour with no release is left out.
 */
export function resumoDados(modos: Record<ReleaseCode, ReleaseMode>, calendars: readonly CalendarCode[]): string {
  const codes = codigosSeguidos(calendars)
  const fortes = codes.filter((c) => LISTA_A_V1.includes(c))
  return ORDEM_MODOS.flatMap((m) => {
    const xs = codes.filter((c) => modos[c] === m)
    if (xs.length === 0) return []
    let itens: string
    if (xs.length > 3 && xs.length === fortes.length && xs.every((c) => fortes.includes(c))) {
      const porCal = (['us', 'eu', 'br'] as const)
        .map((cal) => ({ cal, n: xs.filter((c) => AGENDA_RELEASES.find((r) => r.code === c)?.calendar === cal).length }))
        .filter((x) => x.n > 0)
      itens = lista(porCal.map((x, k) => (k === 0 ? DADOS.fortesPrimeiro(x.n, DADOS.calendarioDe[x.cal]) : DADOS.fortesOutros(x.n, DADOS.calendarioDe[x.cal]))))
    } else if (xs.length > 3) itens = DADOS.contagem(xs.length)
    else itens = lista(xs.map((c) => NOMES_DADOS[c].nome))
    return [DADOS.resumoParte(DADOS.modo[m], itens)]
  }).join(SEP)
}

// ---------------------------------------------------------------------------------------------
// «Escolher dado por dado»: groups and next dates
// ---------------------------------------------------------------------------------------------

export type GrupoId = 'fortesUs' | 'outrosUs' | 'eu' | 'br'

export interface LinhaDado {
  code: ReleaseCode
  nome: string
  /** «hoje · 08:30 ET», «ter 15 dez · 08:30 ET», «próxima data ainda não publicada» */
  proxima: string
  modo: ReleaseMode
  propria: boolean
}

export interface GrupoDados {
  id: GrupoId
  titulo: string
  /** The trader follows this group's agenda (else one closed line with «Calendários ›») */
  segue: boolean
  linhas: LinhaDado[]
}

const GRUPOS: readonly { id: GrupoId; cal: CalendarCode; fortes?: boolean }[] = [
  { id: 'fortesUs', cal: 'us', fortes: true },
  { id: 'outrosUs', cal: 'us', fortes: false },
  { id: 'eu', cal: 'eu' },
  { id: 'br', cal: 'br' },
]

/**
 * The next date of a release (c3 l.481-483; c3 §12.5): the first row of the code from the start of
 * today's clock day; cancelled → «cancelado neste mês», postponed without a date → «adiado, sem data
 * nova»; none → «próxima data ainda não publicada». The day word compares dates on the window clock.
 */
export function proximaData(code: ReleaseCode, rows: readonly AgendaRow[] | null, now: Date, rules: Pick<Rules, 'windows' | 'day'>): { texto: string; at: Date | null } {
  const tz = relogioDe(rules)
  const desde = tradingDayBounds(tradingDayOn(now, rules.day), rules.day).start
  const r = (rows ?? [])
    .filter((x) => x.code === code && x.at >= desde)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
  if (!r) return { texto: DADOS.semData, at: null }
  if (r.status === 'cancelado') return { texto: DADOS.canceladoNoMes, at: r.at }
  if (r.status === 'adiado') return { texto: DADOS.adiadoSemData, at: r.at }
  const hoje = dataEm(now, tz)
  const data = dataEm(r.at, tz)
  const dia = data === hoje ? DADOS.hoje : data === addDays(hoje, 1) ? DADOS.amanha : diaComMes(data)
  return { texto: DADOS.proxima(dia, horaEt(r.at, tz)), at: r.at }
}

/** The list's four groups (SPEC §7.1 l.1110-1113), each in the order of the next date (c3 l.481) */
export function gruposDados(estado: EstadoDados, rows: readonly AgendaRow[] | null, now: Date, rules: Pick<Rules, 'windows' | 'day'>): GrupoDados[] {
  return GRUPOS.map((g) => {
    const codes = AGENDA_RELEASES.filter((r) => r.calendar === g.cal && (g.fortes === undefined || r.inListA === g.fortes)).map((r) => r.code)
    const n = codes.length
    const linhas = codes
      .map((code) => ({ code, p: proximaData(code, rows, now, rules) }))
      .sort((a, b) => {
        if (a.p.at && b.p.at) return a.p.at.getTime() - b.p.at.getTime() || releaseOrd(a.code) - releaseOrd(b.code)
        if (a.p.at) return -1
        if (b.p.at) return 1
        return releaseOrd(a.code) - releaseOrd(b.code)
      })
      .map(({ code, p }) => ({ code, nome: NOMES_DADOS[code].nome, proxima: p.texto, modo: estado.modos[code], propria: estado.proprios.includes(code) }))
    return { id: g.id, titulo: DADOS.grupo[g.id](n), segue: estado.calendars.includes(g.cal), linhas }
  })
}

// ---------------------------------------------------------------------------------------------
// The status line (c3 §3.10)
// ---------------------------------------------------------------------------------------------

/**
 * The first sentence that holds, in c3 §3.10's order (SPEC §5.1 rows 3–7: off, no calendar and no
 * release with a wait come before «a agenda de hoje não carregou»). `agenda`: the day's read (E5);
 * undefined while it loads (the line waits, empty), null when it failed. Follows the draft: `rules` is
 * what the draft resolves to.
 */
export function statusDados(estado: EstadoDados, rules: Rules, agenda: AgendaRead | null | undefined, now: Date): string {
  if (!estado.on) return DADOS.desligado
  if (estado.calendars.length === 0) return DADOS.semCalendario
  const codes = codigosSeguidos(estado.calendars)
  const espera = codes.filter((c) => estado.modos[c] !== 'normal')
  if (espera.length === 0) return DADOS.nenhumComEspera
  const zero = estado.beforeMin + estado.afterMin === 0
  if (zero && espera.every((c) => estado.modos[c] === 'volta')) return DADOS.zero
  if (agenda === undefined) return ''
  const entries = agenda ? agendaFor(rules, rules.day, now, agenda) : null
  if (!agenda || entries === null) return DADOS.semAgenda

  const tz = relogioDe(rules)
  const day = tradingDayOn(now, rules.day)
  const { start, end } = tradingDayBounds(day, rules.day)
  const hojeRows = agenda.rows
    .filter((r): r is AgendaRow & { code: ReleaseCode } => r.code !== null && codes.includes(r.code) && (r.status === 'agendado' || r.status === 'divulgado') && r.at >= start && r.at < end)
    .sort((a, b) => a.at.getTime() - b.at.getTime() || releaseOrd(a.code) - releaseOrd(b.code))
  const doDia = (code: ReleaseCode, at: Date) => hojeRows.some((r) => r.code === code && r.at.getTime() === at.getTime())
  // The day's intervals, also a wait carried over the turn of the day (a 17:55 release waits until 18:05 of
  // the new day), as «Como fica hoje» shows them (intervalosDoDia: every interval that meets the day)
  const ivs = blockIntervals(rules, rules.day, entries).filter((iv) => iv.releases.some((x) => doDia(x.code, x.at)) || (iv.start < end && iv.end > start))
  if (hojeRows.length === 0 && ivs.length === 0) return DADOS.nenhumHoje
  const rotulo = (rs: readonly { code: ReleaseCode; at: Date }[]) => {
    const grupos: { at: Date; codes: ReleaseCode[] }[] = []
    for (const r of rs) {
      const g = grupos.find((x) => x.at.getTime() === r.at.getTime())
      if (g) {
        if (!g.codes.includes(r.code)) g.codes.push(r.code)
      } else grupos.push({ at: r.at, codes: [r.code] })
    }
    return lista(grupos.map((g) => DADOS.rotulo(lista(g.codes.map((c) => NOMES_DADOS[c].frase)), horaEt(g.at, tz))))
  }
  const partes: { at: number; t: string }[] = ivs.map((iv) => {
    const rs = iv.releases.filter((x) => doDia(x.code, x.at) || iv.kind === 'espera')
    if (iv.kind === 'dia') {
      const forms = Array.from(new Set(rs.map((r) => NOMES_DADOS[r.code].diaDe)))
      const diaDe = `dia de ${lista(forms.map((f) => f.replace(/^dia de /, '')))}`
      return { at: iv.start.getTime(), t: DADOS.naoOpera(diaDe, horaEt(rs[0].at, tz)) }
    }
    if (rs.some((r) => r.mode === 'depois')) return { at: iv.start.getTime(), t: DADOS.soOperaDepois(rotulo(rs), hhmm(iv.end, tz)) }
    return { at: iv.start.getTime(), t: DADOS.aguarda(rotulo(rs), hhmm(iv.start, tz), hhmm(iv.end, tz)) }
  })
  // «Aguardo em volta do horário» with 0 and 0 makes no interval: the day's sentence changes its ending (c3 l.679)
  const naoCobertos = hojeRows.filter((r) => estado.modos[r.code] !== 'normal' && !ivs.some((iv) => iv.releases.some((x) => x.code === r.code && x.at.getTime() === r.at.getTime())))
  if (naoCobertos.length) partes.push({ at: naoCobertos[0].at.getTime(), t: DADOS.zeroFim(rotulo(naoCobertos)) })
  if (partes.length === 0) return DADOS.hoje_([DADOS.operaNormal(rotulo(hojeRows))])
  return DADOS.hoje_(partes.sort((a, b) => a.at - b.at).map((p) => p.t))
}

// ---------------------------------------------------------------------------------------------
// The old account, the first time (c3 §3.9; board Q41)
// ---------------------------------------------------------------------------------------------

/** The old account (c3 §3.9; Q41): a rules version took effect before the delivery (lib/hub/avisoDados) */
export function contaAntiga(versions: readonly { effectiveDay: string }[], entrega: string = ENTREGA_DADOS_ECONOMICOS): boolean {
  return versions.some((v) => contaAntigaDesde(v.effectiveDay, entrega))
}

/** The notice's sentence with the account's minutes (never 5 and 10 fixed) */
export function avisoContaAntiga(estado: Pick<EstadoDados, 'on' | 'beforeMin' | 'afterMin'>): string {
  if (!estado.on) return DADOS.avisoDesligada
  if (estado.beforeMin + estado.afterMin === 0) return DADOS.avisoZero
  return DADOS.avisoLigada(estado.beforeMin, estado.afterMin)
}

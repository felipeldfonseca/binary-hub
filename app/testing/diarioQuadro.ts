/**
 * The approved Diário boards' 21 scenarios (DiarioDezEnxuto «Diário · 1º dez» and DiarioHojeEnxuto «Diário · hoje»,
 * canvas version 84, approved 5 Nov 2026) as the database's answers, for the Diário's screen tests and visual specs.
 * Lives outside __tests__ so Jest does not run it as a suite. Every value is invented.
 *
 * fixtures/diario-quadro was written by the boards' exporter (.claude/backup-fase4/telas/gerador/exporta.py, outside
 * the repository) from the boards' own generator: the money and the counts are the generator's (the same arithmetic
 * that drew the boards), the shapes those of the recorded answers in fixtures/diario and fixtures/regras (every object
 * keeps its recorded key set). Ids are fixed uuid5s (ids.json). Per world (`<ag>`: the board's clock):
 *
 *   1dez   Tue 1º Dec 2026 11:35 ET: the «Diário · 1º dez» board (8 accounts)
 *   1dezM  the same instant with 35 accounts («Muitas contas», scenario 9b)
 *   12nov  Thu 12 Nov 10:42 ET; 11nov Wed 11 Nov 21:20 de Brasília; 14nov Sat 14 Nov 21:40 de Brasília;
 *   12b3   Thu 12 Nov 11:20 de Brasília: the «Diário · hoje» board
 *
 *   contas-<ag>            trading_accounts rows (fetchAccounts)
 *   rules-now-<ag>         rules_now()
 *   calendario-<c>-<ag>    diario_calendario of account <c> (top, lucid, ylos, ebx, ibkr, bin, clear, apx5)
 *   mes-<c>-<YYYY-MM>-<ag> diario_mes of every month of that calendar
 *   dia-<c>-<dia>-<ag>     diario_dia of the days the scenarios open (and dia-top-2026-11-19-1dez-avisar: scenario 3b,
 *                          the same day under rules that only warn)
 *   importacoes-top        Top One's import batches and what undoing each does (with «Saem junto»'s counts, `diario`)
 *   esperado-<cen>         the boards' strings of the scenario (exporter's esperado.js: the board engine's values, the
 *                          days a test opens from it, the clicks of the inventory)
 *   cenarios               scenario → world, account, open day, the trade whose drill is open, …
 *
 * quadro(cen) reads a scenario through the real parsers (parseCalendar, parseMonth, parseDay, parseRulesNow): a wrong
 * shape fails here, before any screen.
 */
import fs from 'fs'
import path from 'path'
import { parseCalendar, parseDay, parseMonth, type DayRead } from '@/lib/hub/diarioDb'
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras'
import type { TradingAccount } from '@/lib/hub/contas'
import type { BatchUndo, ImportBatch } from '@/lib/hub/contasDb'
import type { CalendarRead, Day, MonthRead } from '@/lib/domain/diario'

const DIR = path.join(__dirname, 'fixtures/diario-quadro')

export const CENARIOS = ['2', '3', '3b', '4', '5', '9', '9b', '11a', '11b', '13', '1', '6', '7', '8', '10a', '10b', '10c', '10d', '10e', '12a', '12b'] as const
export type Cenario = (typeof CENARIOS)[number]

/** The board's world (its clock) */
export type Mundo = '1dez' | '1dezM' | '12nov' | '11nov' | '14nov' | '12b3'

export interface CenarioInfo {
  ag: Mundo
  /** The open account, as the exporter names it (top, lucid, ylos, ebx, ibkr, bin, clear) */
  conta: string
  contaId: string
  /** The open day ('YYYY-MM-DD') */
  dia: Day
  /** The month the board shows when it is not the open day's */
  mes?: string
  /** The week the board shows (Monday) when it is not the open day's */
  semana?: Day
  /** The trade whose drill the board has open */
  aberta?: string
  /** 3b: the same day under rules that only warn */
  variante?: 'avisar'
  /** 10c–10e */
  estado?: 'carregando' | 'erro' | 'offline'
  /** Other days a test opens from the scenario (4: 21 and 23 Oct; 9: «Abrir 30 nov») */
  extras?: Day[]
  /** 9b: the accounts the selector chooses (label → id) */
  escolhas?: Record<string, string>
  importacoes?: boolean
  quadro: 'dez' | 'hoje'
  rotulo: string
}

/** One account's answers in the scenario's world */
export interface ContaDoQuadro {
  calendario: CalendarRead
  meses: Record<string, MonthRead>
  dias: Record<Day, DayRead>
}

/** What undoing a batch does, with the counts of «Saem junto» (fetchBatchUndo's answer from Phase 4 on) */
export type DesfazerDoQuadro = BatchUndo & { diario: { marks: number; images: number; notes: number } }

export interface Quadro extends ContaDoQuadro {
  cen: Cenario
  info: CenarioInfo
  /** The board's clock (the scenario's server_now) */
  agora: Date
  contas: TradingAccount[]
  rulesNow: RulesNow
  /** Every account of the world with answers (the open one and the selector's choices in 9b), by id */
  porConta: Record<string, ContaDoQuadro>
  /** Scenario 13: Top One's batches and what undoing each does */
  lotes?: { accountId: string; batches: ImportBatch[]; undo: Record<string, DesfazerDoQuadro> }
  /** The boards' strings (esperado-<cen>.json) */
  esperado: Esperado
}

/** A file of the folder as JSON (a fresh copy each call) */
export function quadroJson(nome: string): any {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${nome}.json`), 'utf8'))
}

/** Every file of the folder (without .json) */
export const ARQUIVOS_DO_QUADRO = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort()

export const cenarioInfo = (cen: Cenario): CenarioInfo => quadroJson('cenarios')[cen]

/** The ids of the invented world: the user, the accounts by the exporter's names, the batches */
export const idsQuadro = (): { user: string; accounts: Record<string, string>; batches: Record<string, string> } => quadroJson('ids')

/** The exporter's name of an account id */
export function nomeDaConta(id: string): string {
  const e = Object.entries(idsQuadro().accounts).find(([, v]) => v === id)
  if (!e) throw new Error(`quadro: account ${id} is not in ids.json`)
  return e[0]
}

/** One account's answers in a world: its calendar, every month of it, every exported day */
export function contaDoQuadro(conta: string, ag: Mundo, { variante }: { variante?: 'avisar' } = {}): ContaDoQuadro {
  const calendario = parseCalendar(quadroJson(`calendario-${conta}-${ag}`))
  const meses: Record<string, MonthRead> = {}
  const dias: Record<Day, DayRead> = {}
  const mesRe = new RegExp(`^mes-${conta}-(\\d{4}-\\d{2})-${ag}$`)
  const diaRe = new RegExp(`^dia-${conta}-(\\d{4}-\\d{2}-\\d{2})-${ag}$`)
  for (const nome of ARQUIVOS_DO_QUADRO) {
    const m = mesRe.exec(nome)
    if (m) meses[m[1]] = parseMonth(quadroJson(nome))
    const d = diaRe.exec(nome)
    if (d) dias[d[1]] = parseDay(quadroJson(nome))
  }
  if (variante) {
    for (const nome of ARQUIVOS_DO_QUADRO) {
      const d = new RegExp(`^dia-${conta}-(\\d{4}-\\d{2}-\\d{2})-${ag}-${variante}$`).exec(nome)
      if (d) dias[d[1]] = parseDay(quadroJson(nome))
    }
  }
  return { calendario, meses, dias }
}

/** A scenario as the screens read it: every answer through the real parsers */
export function quadro(cen: Cenario): Quadro {
  const info = cenarioInfo(cen)
  const aberta = contaDoQuadro(info.conta, info.ag, { variante: info.variante })
  const porConta: Record<string, ContaDoQuadro> = { [info.contaId]: aberta }
  for (const id of Object.values(info.escolhas ?? {})) {
    if (!porConta[id]) porConta[id] = contaDoQuadro(nomeDaConta(id), info.ag)
  }
  const out: Quadro = {
    cen,
    info,
    agora: aberta.calendario.serverNow,
    contas: quadroJson(`contas-${info.ag}`),
    rulesNow: parseRulesNow(quadroJson(`rules-now-${info.ag}`)),
    ...aberta,
    porConta,
    esperado: quadroJson(`esperado-${cen}`),
  }
  if (info.importacoes) {
    const l = quadroJson('importacoes-top')
    out.lotes = { accountId: l.account_id, batches: l.batches, undo: l.undo }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// The boards' strings (esperado-<cen>.json): the board engine's values for the scenario
// ---------------------------------------------------------------------------------------------

export interface EsperadoPosso {
  nome: string
  pal: string
  sub: string | null
  acao: string | null
  acaoAria: string | null
  /** «US$ 45 de US$ 400» */
  lim: string | null
  soma: boolean
  tom: string
}

export interface EsperadoCelula {
  id: Day
  clicavel: boolean
  tab: number | null
  aberto: boolean
  classe: string
  res: string
  curto: string
  marcas: { fora: boolean; limite: boolean; revisao: boolean } | null
  dica: string
  aria: string
}

export interface EsperadoSemanaCal {
  rotulo: string
  botao: boolean
  res: string | null
  n: string | null
  fora: string | null
  hist: string | null
  aria: string | null
  vazia: boolean
  traco: string | null
  dias: EsperadoCelula[]
}

export interface EsperadoDrill {
  op: string
  fatos: [string, string][]
  linhas: string[]
  tempo: { h: string; txt: string; sub: string | null }[] | null
  be: string | null
  ax: { quando: string; imgs: { nome: string; tam: string; aria: string }[]; nota: string; dialogo: string | null; editar: boolean } | null
  adicionar: boolean
  marcas: { rot: string; valor: string | null; tempo: string | null }[] | null
}

export interface EsperadoLinha {
  h: string
  op: string
  chip: string | null
  sub: string | null
  res: string
  plano: string
  planoAria: string | null
  acao: string | null
  acaoAria: string | null
  clip: string | null
  rot: string
  aberto: boolean
}

/** The open day's part of a scenario (also each day of `extras`) */
export interface EsperadoDia {
  dia: { titulo: string; tags: string[]; nota: string | null }
  rs: Record<string, string | boolean>
  infoResumo: string
  comPlano: boolean
  infoPlano?: string
  plano?: { item: string; plano: string; fato: string; marca: string; tipo: string; link: string | null }[]
  versao?: string[]
  antes?: { ver: boolean; txt: string; nota: string; editar: boolean; nada: boolean; campo: boolean }
  anterior?: string
  semOps: { texto: string; registrar: boolean } | null
  trades: EsperadoLinha[]
  drills: EsperadoDrill[]
  apagadas: string | null
  abertaOntem: { texto: string; link: string; dia: Day } | null
  revisao: Record<string, unknown>
  revisaoAtual: { fatos: string; funcionou: string; diferente: string; seguiu: string; levar: string } | null
  formulario: { fatos: string; rascunho: Record<string, string> } | null
  versoes: { titulo: string; fatos: string; funcionou: string; diferente: string; seguiu: string; levar: string }[] | null
}

export interface Esperado extends Partial<EsperadoDia> {
  cen: Cenario
  rotulo: string
  quadro: 'dez' | 'hoje'
  dataLinha: string
  conta: { nome: string; janela: string; valores: string }
  flags: Record<string, unknown>
  possoSel: EsperadoPosso[]
  outras: { titulo: string; partes: { texto: string; tom: string }[]; botao: string; abertas: boolean } | null
  possoOutras: EsperadoPosso[]
  linhaTopo: string | null
  aviso: string | null
  mes?: { titulo: string; status: string; colunas: string[]; anterior: boolean; proximo: boolean; noMesDeHoje: boolean }
  infoCal?: string
  semanas?: EsperadoSemanaCal[]
  legendaLimite?: boolean
  semana?: { titulo: string; info: string; numeros: [string, string][]; vazia: string | null; barras: [string, string, string][]; leitor: string; fora: string[] }
  lotes?: { titulo: string; partes: string[]; desfazer: boolean; confirmando: boolean; confirma: string; saem: string | null; sim: string; aria: string }[]
  /** Days a test opens from the scenario, as the board draws them */
  extras?: Record<Day, EsperadoDia>
  /** 9b: the selector's search and two choices */
  busca?: Record<string, { status: string | null; nenhuma: string | null; grupos: { mercado: string | null; mesa: string | null; contas: string[] }[] }>
  escolhas?: Record<string, { contaStatus: string | null; possoSel: EsperadoPosso[]; outras: { titulo: string; partes: { texto: string; tom: string }[] }; dia: string; res: string | null }>
  /** The inventory's clicks (12b, 1, 10e, 10d) */
  cliques?: Record<string, any>
}

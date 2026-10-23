/**
 * Phase 3b · telas (lane L2): the database's answers in the approved board's world (contract §6.10), for the sheet's
 * suites and the visual specs. Lives outside __tests__ so Jest does not run it as a suite. Invented data only.
 *
 *   regrasQuadro()        rules_config() of the board's accounts: rules «desde» 14 out for Top One, Ylos 50k and Apex A,
 *                         15 out for the others (DESDE_QUADRO), built like testing/regras.ts on the recorded shape
 *   ESTADOS_QUADRO        each board state of §2.2: its account, its file (B0's mapeadoTelas), the answers given on
 *                         «mapa» / «conferir» / hc and the zone
 *   arquivoDoEstado(e)    the MappedFile the sheet sends for it (B0's iniciarMapeamento + the answers + arquivoDoMapeamento)
 *   previaQuadro(e)       import_preview's answer, and commitQuadro(e) import_commit's: composed from what the real SQL
 *                         answered for that file in that world, and proven equal to it by
 *                         __tests__/lib/hubImportTelas.pg.test.ts (every key but the batch id and the server's dates)
 */
import {
  type DateOrder,
  type EndOfFileAnswer,
  type MappedFile,
  type SideWordAnswer,
  type Template,
} from '@/lib/domain/import'
import type { RulesConfig } from '@/lib/hub/regras'
import { parseRulesConfig } from '@/lib/hub/regras'
import type { ImportCommitResult, ImportPreviewResult } from '@/lib/hub/contasDb'
import { arquivoDoMapeamento, iniciarMapeamento, type ArquivoMapeavel, type Mapeamento } from '@/lib/hub/importMapeado'
import {
  ARQUIVOS_QUADRO,
  CONTAS_QUADRO,
  DESDE_QUADRO,
  contasQuadro,
  type ArquivoQuadroKey,
  type ContaQuadro,
} from '@/testing/mapeadoTelas'
import { regrasJson } from '@/testing/regras'

// ------------------------------------------------------------------------------------------------
// The rules
// ------------------------------------------------------------------------------------------------

/** Each account's first version starts at its trading day's turn (the market's day clock), the day DESDE_QUADRO names */
const DESDE_INSTANTE: Readonly<Record<string, string>> = {
  futures14: '2026-10-13T22:00:00Z',
  futures15: '2026-10-14T22:00:00Z',
  forex15: '2026-10-14T21:00:00Z',
  stocks15: '2026-10-15T00:00:00Z',
  crypto15: '2026-10-15T03:00:00Z',
  b315: '2026-10-15T03:00:00Z',
  binary15: '2026-10-15T03:00:00Z',
}

/**
 * rules_config() of the board's world: every account with one version (window 10:00–11:00 of its clock, no limit),
 * effective on DESDE_QUADRO's day. The shape is the recorded one (testing/fixtures/regras/config-mercados.json).
 */
export function regrasQuadro(): RulesConfig {
  const base = regrasJson('config-mercados') as { accounts: Record<string, unknown>[] } & Record<string, unknown>
  const modelo = (market: string) => {
    const a = base.accounts.find((x) => x.market === market) ?? base.accounts[0]
    return JSON.parse(JSON.stringify(a)) as Record<string, unknown> & { current: Record<string, unknown>; day: unknown }
  }
  const contas = contasQuadro().map((c, i) => {
    const conta = (Object.keys(CONTAS_QUADRO) as ContaQuadro[]).find((k) => CONTAS_QUADRO[k] === c) ?? 'topOne'
    const a = modelo(c.market)
    const dia = DESDE_QUADRO[conta]
    const instante = DESDE_INSTANTE[`${c.market}${dia.slice(8, 10)}`]
    const current = { ...a.current, market: c.market }
    return {
      ...a,
      account_id: c.id,
      label: c.label,
      market: c.market,
      window: null,
      settings: { rules: { v: 1 }, updated_at: instante },
      current,
      versions: [
        {
          id: `3b0c0a00-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
          origin: 'salvar',
          resolved: current,
          version_no: 1,
          copied_from: null,
          effective_day: dia,
          effective_from: instante,
        },
      ],
      is_example: false,
      archived_at: null,
    }
  })
  return parseRulesConfig({ ...base, accounts: contas, preferences: {} })
}

// ------------------------------------------------------------------------------------------------
// The board's states
// ------------------------------------------------------------------------------------------------

export type EstadoQuadro =
  | '8'
  | '8-de-novo'
  | '8g'
  | '8p'
  | '15'
  | '15b'
  | '16t'
  | '16t-de-novo'
  | '16ta-naosei'
  | '16ta-sim'
  | '16ta-nao'
  | '16b-naosei'
  | '16b-sim'
  | '16b-nao'
  | '16i'
  | '16c-sim'
  | '17'
  | '17-apx2'
  | '18'
  | '18-chicago'
  | '18-utc'
  | '19'
  | '19-pular'
  | '19p'

/** The answers given on «mapa», «conferir» and hc (over B0's pre-fill) */
export interface RespostasDoEstado {
  sideWords?: Record<string, SideWordAnswer>
  endOfFile?: Record<string, EndOfFileAnswer>
  resultIsNet?: boolean
  accountValue?: string
  dateOrder?: DateOrder
}

export interface EstadoDef {
  conta: ContaQuadro
  arquivo: ArquivoQuadroKey
  /** The zone the preview and the commit use (the step's choice, or the account's) */
  tz: string
  respostas: RespostasDoEstado
  /** The file is read by this saved model (15: «BlackArrow») */
  modelo?: 'blackarrow'
}

const NY = 'America/New_York'
const BR = 'America/Sao_Paulo'

export const ESTADOS_QUADRO: Readonly<Record<EstadoQuadro, EstadoDef>> = {
  '8': { conta: 'ylos', arquivo: 'f8', tz: NY, respostas: {} },
  '8-de-novo': { conta: 'ylosDepois', arquivo: 'f8', tz: NY, respostas: {} },
  '8g': { conta: 'topOne', arquivo: 'f8', tz: 'UTC', respostas: {} },
  '8p': { conta: 'lucid', arquivo: 'f8p', tz: NY, respostas: {} },
  '15': { conta: 'ylosDepois', arquivo: 'f15', tz: NY, respostas: {}, modelo: 'blackarrow' },
  '15b': { conta: 'ylosDepois', arquivo: 'f15b', tz: NY, respostas: {}, modelo: 'blackarrow' },
  '16t': { conta: 'lucid', arquivo: 'f16t', tz: NY, respostas: {} },
  '16t-de-novo': { conta: 'lucid', arquivo: 'f16t', tz: NY, respostas: {} },
  '16ta-naosei': { conta: 'lucid', arquivo: 'f16ta', tz: NY, respostas: {} },
  '16ta-sim': { conta: 'lucid', arquivo: 'f16ta', tz: NY, respostas: { endOfFile: { MESZ6: 'yes' } } },
  '16ta-nao': { conta: 'lucid', arquivo: 'f16ta', tz: NY, respostas: { endOfFile: { MESZ6: 'no' } } },
  '16b-naosei': { conta: 'binance', arquivo: 'f16b', tz: 'UTC', respostas: {} },
  '16b-sim': { conta: 'binance', arquivo: 'f16b', tz: 'UTC', respostas: { endOfFile: { ETHUSDT: 'yes' } } },
  '16b-nao': { conta: 'binance', arquivo: 'f16b', tz: 'UTC', respostas: { endOfFile: { ETHUSDT: 'no' } } },
  '16i': { conta: 'ibkr', arquivo: 'f16i', tz: NY, respostas: {} },
  '16c-sim': { conta: 'lucid', arquivo: 'f16c', tz: NY, respostas: { accountValue: 'LT50K-0193', endOfFile: { MESZ6: 'yes' } } },
  '17': { conta: 'apexA', arquivo: 'f17', tz: NY, respostas: { accountValue: 'APX-0001' } },
  '17-apx2': { conta: 'apexA', arquivo: 'f17', tz: NY, respostas: { accountValue: 'APX-0002' } },
  '18': { conta: 'e8', arquivo: 'f18', tz: NY, respostas: {} },
  '18-chicago': { conta: 'e8', arquivo: 'f18', tz: 'America/Chicago', respostas: {} },
  '18-utc': { conta: 'e8', arquivo: 'f18', tz: 'UTC', respostas: {} },
  '19': { conta: 'mini', arquivo: 'f19', tz: BR, respostas: { sideWords: { x: 'sell' } } },
  '19-pular': { conta: 'mini', arquivo: 'f19', tz: BR, respostas: { sideWords: { x: 'skip' } } },
  '19p': { conta: 'mini', arquivo: 'f19p', tz: BR, respostas: { sideWords: { x: 'sell' } } },
}

/** The board's file as the sheet holds it after reading it again */
export function arquivoMapeavelQuadro(key: ArquivoQuadroKey): ArquivoMapeavel {
  const a = ARQUIVOS_QUADRO[key]
  return { fileName: a.nome, size: a.texto.length, sha256: 'ab'.repeat(32), text: a.texto }
}

/** B0's mapping of the state's file with the state's answers */
export function mapeamentoDoEstado(e: EstadoQuadro, templates: readonly Template[] = []): Mapeamento {
  const d = ESTADOS_QUADRO[e]
  const conta = CONTAS_QUADRO[d.conta]
  const r = iniciarMapeamento(arquivoMapeavelQuadro(d.arquivo), { market: conta.market, templates, nomePadrao: 'Minha plataforma' })
  if (!r.ok) throw new Error(`sniff ${r.error}`)
  return { ...r.mapeamento, ...d.respostas }
}

/** The MappedFile the sheet sends for the state (on its zone) */
export function arquivoDoEstado(e: EstadoQuadro, templates: readonly Template[] = []): MappedFile {
  const d = ESTADOS_QUADRO[e]
  const f = arquivoDoMapeamento(mapeamentoDoEstado(e, templates), CONTAS_QUADRO[d.conta].market, d.tz)
  if (!f.ok) throw new Error(`file ${f.error}`)
  return f
}

// ------------------------------------------------------------------------------------------------
// The database's answers
// ------------------------------------------------------------------------------------------------

/** A state's answers: the preview's keys that differ from PREVIA_BASE, and the commit's (null: «Nada novo», no commit) */
interface Composta {
  previa: Partial<ImportPreviewResult>
  commit: Partial<ImportCommitResult> | null
}

/** What import_preview and import_commit answered for each state, over PREVIA_BASE (the batch id aside) */
const FIX: Readonly<Record<EstadoQuadro, Composta>> = {
  '8': {
    previa: { new: 18, linked: 0, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-13', account_tz: 'America/New_York', rows_total: 18 },
    commit: { batch_id: 'lote-8', inserted: 18, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '8-de-novo': {
    previa: { duplicate: 18, linked: 0, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-13', already_imported: true, account_tz: 'America/New_York', tz_confirmed: true, rows_total: 18 },
    commit: null,
  },
  '8g': {
    previa: { new: 18, linked: 0, linked_differs: 0, other_source: 18, first_day: '2026-10-01', last_day: '2026-10-13', tz_confirmed: true, rows_total: 18 },
    commit: { batch_id: 'lote-8g', inserted: 18, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '8p': {
    previa: { new: 6, linked: 0, linked_differs: 0, trades_new: 4, grouped: 2, attached: 0, first_day: '2026-10-13', last_day: '2026-10-13', account_tz: 'America/New_York', rows_total: 6 },
    commit: { batch_id: 'lote-8p', inserted: 6, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 4, grouped: 2, attached: 0, errors: [] },
  },
  '15': {
    previa: { new: 5, duplicate: 18, linked: 1, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-15', account_tz: 'America/New_York', tz_confirmed: true, rows_total: 24 },
    commit: { batch_id: 'lote-15', inserted: 5, duplicate: 18, completed: 0, other_account: 0, linked: 1, errors: [] },
  },
  '15b': {
    previa: { new: 5, duplicate: 18, linked: 1, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-15', account_tz: 'America/New_York', tz_confirmed: true, rows_total: 24 },
    commit: { batch_id: 'lote-15b', inserted: 5, duplicate: 18, completed: 0, other_account: 0, linked: 1, errors: [] },
  },
  '16t': {
    previa: { new: 6, linked: 0, linked_differs: 0, trades_new: 4, grouped: 2, attached: 0, first_day: '2026-10-13', last_day: '2026-10-13', account_tz: 'America/New_York', rows_total: 6 },
    commit: { batch_id: 'lote-16t', inserted: 6, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 4, grouped: 2, attached: 0, errors: [] },
  },
  '16t-de-novo': {
    previa: { duplicate: 6, linked: 0, linked_differs: 0, first_day: '2026-10-13', last_day: '2026-10-13', already_imported: true, account_tz: 'America/New_York', tz_confirmed: true, rows_total: 6 },
    commit: null,
  },
  '16ta-naosei': {
    previa: { new: 2, linked: 0, linked_differs: 0, first_day: '2026-10-13', last_day: '2026-10-13', errors: [{ code: 'unbalanced_symbol', line: 2 }, { code: 'unbalanced_symbol', line: 4 }, { code: 'unbalanced_symbol', line: 5 }, { code: 'unbalanced_symbol', line: 10 }, { code: 'unbalanced_symbol', line: 11 }, { code: 'unbalanced_symbol', line: 12 }, { code: 'unbalanced_symbol', line: 13 }], account_tz: 'America/New_York', rows_total: 9 },
    commit: { batch_id: 'lote-16ta-naosei', inserted: 2, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [{ code: 'unbalanced_symbol', line: 2 }, { code: 'unbalanced_symbol', line: 4 }, { code: 'unbalanced_symbol', line: 5 }, { code: 'unbalanced_symbol', line: 10 }, { code: 'unbalanced_symbol', line: 11 }, { code: 'unbalanced_symbol', line: 12 }, { code: 'unbalanced_symbol', line: 13 }] },
  },
  '16ta-sim': {
    previa: { new: 6, linked: 0, linked_differs: 0, trades_new: 4, grouped: 2, attached: 0, first_day: '2026-10-13', last_day: '2026-10-13', errors: [{ code: 'open_at_end', line: 13 }], account_tz: 'America/New_York', rows_total: 7 },
    commit: { batch_id: 'lote-16ta-sim', inserted: 6, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 4, grouped: 2, attached: 0, errors: [{ code: 'open_at_end', line: 13 }] },
  },
  '16ta-nao': {
    previa: { new: 6, linked: 0, linked_differs: 0, trades_new: 5, grouped: 1, attached: 0, first_day: '2026-10-13', last_day: '2026-10-13', errors: [{ code: 'opened_before_file', line: 4 }], account_tz: 'America/New_York', rows_total: 7 },
    commit: { batch_id: 'lote-16ta-nao', inserted: 6, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 5, grouped: 1, attached: 0, errors: [{ code: 'opened_before_file', line: 4 }] },
  },
  '16b-naosei': {
    previa: { new: 3, linked: 0, linked_differs: 0, trades_new: 2, grouped: 1, attached: 0, day_changes: 1, first_day: '2026-10-10', last_day: '2026-10-12', errors: [{ code: 'unbalanced_symbol', line: 3 }, { code: 'unbalanced_symbol', line: 5 }, { code: 'unbalanced_symbol', line: 6 }], rows_total: 6 },
    commit: { batch_id: 'lote-16b-naosei', inserted: 3, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 2, grouped: 1, attached: 0, errors: [{ code: 'unbalanced_symbol', line: 3 }, { code: 'unbalanced_symbol', line: 5 }, { code: 'unbalanced_symbol', line: 6 }] },
  },
  '16b-sim': {
    previa: { new: 4, linked: 0, linked_differs: 0, trades_new: 3, grouped: 1, attached: 0, day_changes: 2, first_day: '2026-10-10', last_day: '2026-10-12', errors: [{ code: 'open_at_end', line: 6 }], rows_total: 5 },
    commit: { batch_id: 'lote-16b-sim', inserted: 4, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 3, grouped: 1, attached: 0, errors: [{ code: 'open_at_end', line: 6 }] },
  },
  '16b-nao': {
    previa: { new: 4, linked: 0, linked_differs: 0, trades_new: 3, grouped: 1, attached: 0, day_changes: 2, first_day: '2026-10-10', last_day: '2026-10-12', errors: [{ code: 'opened_before_file', line: 3 }], rows_total: 5 },
    commit: { batch_id: 'lote-16b-nao', inserted: 4, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 3, grouped: 1, attached: 0, errors: [{ code: 'opened_before_file', line: 3 }] },
  },
  '16i': {
    previa: { new: 3, linked: 0, linked_differs: 0, trades_new: 2, grouped: 1, attached: 0, first_day: '2026-10-14', last_day: '2026-10-14', errors: [{ code: 'opened_before_file', line: 2 }, { code: 'bad_option', line: 7 }, { code: 'open_at_end', line: 9 }], account_tz: 'America/New_York', rows_total: 6 },
    commit: { batch_id: 'lote-16i', inserted: 3, duplicate: 0, completed: 0, other_account: 0, linked: 0, trades: 2, grouped: 1, attached: 0, errors: [{ code: 'opened_before_file', line: 2 }, { code: 'bad_option', line: 7 }, { code: 'open_at_end', line: 9 }] },
  },
  '16c-sim': {
    previa: { new: 1, linked: 0, linked_differs: 0, first_day: '2026-10-14', last_day: '2026-10-14', errors: [{ code: 'open_at_end', line: 7 }], account_tz: 'America/New_York', rows_total: 2 },
    commit: { batch_id: 'lote-16c-sim', inserted: 1, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [{ code: 'open_at_end', line: 7 }] },
  },
  '17': {
    previa: { new: 31, linked: 0, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-13', account_tz: 'America/New_York', rows_total: 31 },
    commit: { batch_id: 'lote-17', inserted: 31, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '17-apx2': {
    previa: { new: 26, linked: 0, linked_differs: 0, first_day: '2026-10-01', last_day: '2026-10-13', account_tz: 'America/New_York', rows_total: 26 },
    commit: { batch_id: 'lote-17-apx2', inserted: 26, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '18': {
    previa: { new: 14, linked: 0, linked_differs: 0, day_changes: 1, first_day: '2026-10-13', last_day: '2026-10-14', account_tz: 'America/New_York', rows_total: 14 },
    commit: { batch_id: 'lote-18', inserted: 14, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '18-chicago': {
    previa: { new: 14, linked: 0, linked_differs: 0, day_changes: 1, first_day: '2026-10-13', last_day: '2026-10-14', account_tz: 'America/New_York', rows_total: 14 },
    commit: { batch_id: 'lote-18-chicago', inserted: 14, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '18-utc': {
    previa: { new: 14, linked: 0, linked_differs: 0, first_day: '2026-10-13', last_day: '2026-10-14', account_tz: 'America/New_York', rows_total: 14 },
    commit: { batch_id: 'lote-18-utc', inserted: 14, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [] },
  },
  '19': {
    previa: { new: 16, linked: 0, linked_differs: 0, first_day: '2026-10-14', last_day: '2026-10-14', errors: [{ code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 15 }], account_tz: 'America/Sao_Paulo', rows_total: 18 },
    commit: { batch_id: 'lote-19', inserted: 16, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [{ code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 15 }] },
  },
  '19-pular': {
    previa: { new: 14, linked: 0, linked_differs: 0, first_day: '2026-10-14', last_day: '2026-10-14', errors: [{ code: 'bad_direction', line: 6 }, { code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 11 }, { code: 'bad_direction', line: 15 }], account_tz: 'America/Sao_Paulo', rows_total: 18 },
    commit: { batch_id: 'lote-19-pular', inserted: 14, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [{ code: 'bad_direction', line: 6 }, { code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 11 }, { code: 'bad_direction', line: 15 }] },
  },
  '19p': {
    previa: { new: 16, linked: 0, linked_differs: 0, first_day: '2026-10-14', last_day: '2026-10-14', errors: [{ code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 15 }], account_tz: 'America/Sao_Paulo', rows_total: 18 },
    commit: { batch_id: 'lote-19p', inserted: 16, duplicate: 0, completed: 0, other_account: 0, linked: 0, errors: [{ code: 'off_tick', line: 9 }, { code: 'bad_direction', line: 15 }] },
  },
}

const PREVIA_BASE: ImportPreviewResult = {
  new: 0,
  duplicate: 0,
  completable: 0,
  other_account: 0,
  day_changes: 0,
  first_day: null,
  last_day: null,
  errors: [],
  already_imported: false,
  tz_status: 'ok',
  account_tz: 'UTC',
  tz_confirmed: false,
  rows_total: 0,
}

/** import_preview's answer for the state, as the real SQL gives it (lines of `errors` included) */
export function previaQuadro(e: EstadoQuadro): ImportPreviewResult {
  return { ...PREVIA_BASE, ...JSON.parse(JSON.stringify(FIX[e].previa)) }
}

/** import_commit's answer for the state (batch_id `lote-{estado}`, or null when it made none) */
export function commitQuadro(e: EstadoQuadro): ImportCommitResult {
  const c = FIX[e].commit
  if (!c) throw new Error(`no commit for ${e}`)
  const out = { batch_id: null, inserted: 0, duplicate: 0, completed: 0, other_account: 0, errors: [], ...JSON.parse(JSON.stringify(c)) } as ImportCommitResult
  return out
}

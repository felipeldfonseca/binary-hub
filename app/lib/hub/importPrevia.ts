/**
 * Phase 3b · telas (lane L2): what the import sheet shows around the column mapping, as data. Pure: the file card
 * (E1), the steps still to come (E2), the zone step's rule and drawing for every market (E31–E33, G2), the preview's
 * lines (E35–E43), the «Linha n: …» reasons, «N contas neste arquivo» (E30) and the end's model line (E46). The file's
 * text, cells and header names stay in the browser: these functions only read them to say what the screen shows.
 */
import {
  accountKey,
  accountRouteHash,
  hasBuySellPair,
  minuteOfDay,
  readSymbol,
  sniffFile,
  totals,
  type ImportFile,
  type ImportRow,
  type MappedFile,
  type Notice,
  type RowErrorCode,
  type RowIssue,
} from '@/lib/domain/import'
import { currencyOf, type AccountMarket } from '@/lib/domain/markets'
import { tradeInstrument, tradeMatchKey } from '@/lib/domain/registro'
import { FILE_ZONES, OTHER_FILE_ZONES, fileDays, tzConfirmed, zoneKeyOf, type TradingAccount, type ZoneKey } from '@/lib/hub/contas'
import type { ImportPreviewResult } from '@/lib/hub/contasDb'
import { formatDateRange, formatMoney, formatOffset } from '@/lib/hub/formato'
import { arquivoDoMapeamento, escolhasDe, type ArquivoMapeavel, type Mapeamento } from '@/lib/hub/importMapeado'
import { ARQUIVO, FIM_MODELO, MARKET_LABEL, PASSO_C, PASSO_D, ops, rowErrorReason, type PalavraFuso } from '@/components/hub/contas/copy'
import type { Passo } from '@/components/hub/importar/flow'

/** useImportFormats' data: the platforms of each account's standing imports */
export type FormatosDasContas = Readonly<Record<string, readonly string[]>> | undefined

// ------------------------------------------------------------------------------------------------
// E1 · the file card
// ------------------------------------------------------------------------------------------------

/**
 * The card of a file no reader took, constant for the file (set when it is read and when its mapping starts, never by
 * «Mudar colunas»): a model taken as is → «Modelo “{nome}” · {mercado} · {n} operações · {dias}» (an execution file, or a
 * file whose rows are not its trades, «{n} linhas»); another model match → «Parecido com o modelo “{nome}” · {n} linhas»;
 * none → «Arquivo não reconhecido · {n} linhas». Without a mapping (a2, the binaries error): a market-free sniffFile, null
 * when it fails.
 */
export function linhaDoArquivoMapeado(
  arquivo: ArquivoMapeavel,
  inicial: Mapeamento | null,
  market: AccountMarket | null,
  anoAtual: number = new Date().getFullYear(),
): string | null {
  if (!inicial) {
    const s = sniffFile(arquivo.text)
    return s.ok ? ARQUIVO.naoReconhecido(s.records.length) : null
  }
  const n = inicial.lido.records.length
  if (inicial.match.kind === 'none') return ARQUIVO.naoReconhecido(n)
  const nome = inicial.match.template.name
  if (!inicial.porModelo || !market) return ARQUIVO.parecido(nome, n)
  const f = arquivoDoMapeamento(inicial, market, null)
  if (!f.ok) return ARQUIVO.doModelo(nome, MARKET_LABEL[market], ARQUIVO.rows(n), '')
  const porOperacao = f.rowKind === 'trade' && f.errors.length === 0 && f.positions.length === f.rows.length
  const dias = fileDays(f.rows)
  return ARQUIVO.doModelo(
    nome,
    MARKET_LABEL[market],
    porOperacao ? ops(f.rows.length) : ARQUIVO.rows(n),
    dias ? semQuebraNoTraco(formatDateRange(dias.first, dias.last, anoAtual)) : '',
  )
}

/**
 * A day range that never breaks at its dash («1–» / «15 out»): a word joiner (U+2060, zero-width, not read aloud) after
 * each en dash. The line may still break at a space («1–15» / «out», as the board's card wraps).
 */
export function semQuebraNoTraco(dias: string): string {
  return dias.replace(/–/g, '–\u2060')
}

// ------------------------------------------------------------------------------------------------
// E2 · the steps still to come
// ------------------------------------------------------------------------------------------------

/**
 * The steps after a2, mapa, conferir and hc (stepIndicator's `ahead`): after a2 ['mapa', 'conferir', 'c', 'd'] (an
 * estimate until the account is chosen), after mapa ['conferir', …hc?, …c?, 'd'], after conferir […hc?, …c?, 'd'], after
 * hc […c?, 'd']; hc when the file holds two «Conta» values or more, c when the zone step shows (mostrarFuso).
 */
export function planoMapeado(passo: Passo, m: Mapeamento | null, account: TradingAccount | null, formats: FormatosDasContas): Passo[] {
  if (passo === 'a2' || !m || !account) return ['mapa', 'conferir', 'c', 'd']
  const hc = contasDoArquivo(m, account.market).length >= 2
  // A «Conta» value chosen before «Voltar» that the column no longer holds reads no row: the file as a whole instead
  const f = arquivoDoMapeamento(valorImportado(m, account.market) === m.accountValue ? m : { ...m, accountValue: null }, account.market, null)
  const c = f.ok ? mostrarFuso(f, m, account, formats) : true
  const resto: Passo[] = [...(hc ? (['hc'] as Passo[]) : []), ...(c ? (['c'] as Passo[]) : []), 'd']
  switch (passo) {
    case 'mapa':
      return ['conferir', ...resto]
    case 'conferir':
      return resto
    case 'hc':
      return resto.filter((p) => p !== 'hc')
    default:
      return []
  }
}

// ------------------------------------------------------------------------------------------------
// E31–E33 · the zone step (G2)
// ------------------------------------------------------------------------------------------------

/** The account's import zone: its file zone once confirmed, or once it holds imported trades; null before that */
export function zonaDaConta(account: Pick<TradingAccount, 'id' | 'file_tz' | 'tz_applied_at'>, formats: FormatosDasContas): string | null {
  return tzConfirmed(account) || (formats?.[account.id]?.length ?? 0) > 0 ? account.file_tz : null
}

/**
 * Whether a mapped file asks its zone: some row without an offset, unless the model's zone is the account's import zone
 * (15: the model's file in its own account; 16 Binance: «Date(UTC)», every row with its offset)
 */
export function mostrarFuso(
  f: Pick<MappedFile, 'needsFileTz'>,
  m: Pick<Mapeamento, 'match'>,
  account: Pick<TradingAccount, 'id' | 'file_tz' | 'tz_applied_at'>,
  formats: FormatosDasContas,
): boolean {
  if (!f.needsFileTz) return false
  const tzHint = m.match.kind !== 'none' ? m.match.template.tzHint : null
  return !(tzHint !== null && tzHint === zonaDaConta(account, formats))
}

/** Platforms whose files are in UTC when they say nothing (crypto exchanges) */
const UTC_PLATFORMS: readonly string[] = ['binance', 'bybit']

/**
 * The zone pressed when the step opens: the account's import zone, else the file's hint (a header naming UTC, the
 * model's zone), else UTC for a crypto exchange; null (nothing pressed) otherwise or for a zone outside the five
 */
export function fusoPreSelecionado(
  f: Pick<MappedFile, 'fileTzHint'>,
  account: Pick<TradingAccount, 'id' | 'file_tz' | 'tz_applied_at' | 'platform'>,
  formats: FormatosDasContas,
): ZoneKey | null {
  const tz = zonaDaConta(account, formats) ?? f.fileTzHint ?? (account.platform && UTC_PLATFORMS.indexOf(account.platform) >= 0 ? 'UTC' : null)
  return tz ? zoneKeyOf(tz) : null
}

/** The zone step's choice for a zone key: one of the three radios, or «Outro» with it */
export function escolhaDaZona(key: ZoneKey | null): { key: ZoneKey | 'outro' | null; other: ZoneKey | null } {
  if (key === null) return { key: null, other: null }
  if (FILE_ZONES.some((z) => z.key === key)) return { key, other: null }
  return OTHER_FILE_ZONES.some((z) => z.key === key) ? { key: 'outro', other: key } : { key: null, other: null }
}

/** A zone the step refuses at once (G2): a confirmed account's other zones. An unconfirmed one refuses after the preview */
export function recusaLocal(account: Pick<TradingAccount, 'file_tz' | 'tz_applied_at'>, tz: string): boolean {
  return tzConfirmed(account) && tz !== account.file_tz
}

/** The clock a market's zone step draws on, its session band and its legend (board IC l.1166–1177) */
export interface RelogioDoMercado {
  tz: string
  relogio: 'ny' | 'br'
  /** The band's modifier: the US session (hub.css's own) or the B3's (hub-importar.css); null: none (24 h markets) */
  banda: 'us' | 'b3' | null
  bandaTxt: string
  legenda: string
}

const NY = 'America/New_York'
const BR = 'America/Sao_Paulo'

export function relogioDoMercado(market: AccountMarket): RelogioDoMercado {
  switch (market) {
    case 'futures':
      return { tz: NY, relogio: 'ny', banda: 'us', bandaTxt: PASSO_C.session, legenda: PASSO_C.legendFutures }
    case 'forex':
      return { tz: NY, relogio: 'ny', banda: null, bandaTxt: '', legenda: PASSO_C.legendForex }
    case 'stocks':
    case 'options':
      return { tz: NY, relogio: 'ny', banda: 'us', bandaTxt: PASSO_C.session, legenda: PASSO_C.legendFutures }
    case 'crypto':
      return { tz: BR, relogio: 'br', banda: null, bandaTxt: '', legenda: PASSO_C.legendCrypto }
    case 'b3':
      return { tz: BR, relogio: 'br', banda: 'b3', bandaTxt: PASSO_C.sessionB3, legenda: PASSO_C.legendBrasilia }
    case 'binary':
      return { tz: BR, relogio: 'br', banda: null, bandaTxt: '', legenda: PASSO_C.legendBinary }
  }
}

/** A row that only draws the zone step: its time and offset; every other field neutral, never sent */
function linhaDoFuso(line: number, local_entry: string, utc_offset: string | null): ImportRow {
  return {
    line,
    external_id: null,
    symbol: '',
    asset_type: null,
    direction: 'long',
    local_entry,
    local_exit: null,
    utc_offset,
    entry_price: null,
    exit_price: null,
    quantity: '0',
    stake_amount: null,
    payout_percent: null,
    duration_seconds: null,
    timeframe: null,
    result: 'breakeven',
    pnl: '0',
    commission: null,
    stop_price: null,
    target_price: null,
    pnl_basis: 'file',
  }
}

/**
 * What the zone step counts (D19): a reader's rows as they are; a trade file one row per trade (its positions: two exits of
 * one entry are one entry); an execution file one per execution (those the pairing leaves out too)
 */
export function linhasDoFuso(file: ImportFile): ImportRow[] {
  if (file.platform !== 'modelo') return file.rows
  if (file.rowKind === 'fill') return file.executionTimes.map((t) => linhaDoFuso(t.line, t.local, t.offset))
  return file.positions.map((p) => linhaDoFuso(p.exits[0]?.line ?? 0, p.local_entry, p.utc_offset))
}

/** What the step counts in its captions: a reader's and a trade file's entries, an execution file's executions */
export function palavraDoFuso(file: ImportFile): PalavraFuso {
  return file.platform === 'modelo' && file.rowKind === 'fill' ? 'execucoes' : 'entradas'
}

const MINUTES_PER_DAY = 24 * 60
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A mapped file's span on its clock (D19): the day cut at the largest gap between entries (as entrySpan, so a session
 * across midnight stays whole), then the first and the last minute. Rows with a stated offset are on another clock and
 * are left out.
 */
export function faixaToda(rows: readonly Pick<ImportRow, 'local_entry' | 'utc_offset'>[]): { from: string; to: string } | null {
  const minutes = rows
    .filter((r) => r.utc_offset === null)
    .map((r) => minuteOfDay(r.local_entry))
    .sort((a, b) => a - b)
  const n = minutes.length
  if (n === 0) return null
  let cut = 0
  let largest = -1
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? minutes[i + 1] : minutes[0] + MINUTES_PER_DAY
    if (next - minutes[i] > largest) {
      largest = next - minutes[i]
      cut = (i + 1) % n
    }
  }
  const day = minutes.slice(cut).concat(minutes.slice(0, cut).map((m) => m + MINUTES_PER_DAY))
  const hhmm = (m: number) => {
    const d = m % MINUTES_PER_DAY
    return `${pad(Math.floor(d / 60))}:${pad(d % 60)}`
  }
  return { from: hhmm(day[0]), to: hhmm(day[n - 1]) }
}

// ------------------------------------------------------------------------------------------------
// E30 · «N contas neste arquivo»
// ------------------------------------------------------------------------------------------------

export interface ContaDoArquivo {
  /** The value as the file first writes it */
  valor: string
  /** accountKey of it */
  chave: string
  /** Its rows (an execution file: its executions' rows) */
  n: number
}

/**
 * The «Conta» column's values (a column mapped to «Conta»): non-empty, by accountKey, the first spelling, the rows of
 * each (an execution file: the rows that are executions), in first-appearance order; [] without such a column
 */
export function contasDoArquivo(m: Mapeamento, market: AccountMarket = 'futures'): ContaDoArquivo[] {
  const i = escolhasDe(m).columns.indexOf('account')
  if (i < 0) return []
  let execucoes: Set<number> | null = null
  if (m.rowKind === 'fill') {
    const f = arquivoDoMapeamento({ ...m, accountValue: null }, market, null)
    execucoes = new Set<number>()
    if (f.ok) {
      for (const t of f.executionTimes) execucoes.add(t.line)
      for (const e of f.errors) execucoes.add(e.line)
    }
  }
  const out: ContaDoArquivo[] = []
  const porChave: Record<string, ContaDoArquivo> = {}
  for (const rec of m.lido.records) {
    const cell = (rec.cells[i] ?? '').trim()
    if (!cell) continue
    if (execucoes && !execucoes.has(rec.line)) continue
    const chave = accountKey(cell)
    const c = porChave[chave]
    if (c) c.n++
    else {
      const novo = { valor: cell, chave, n: 1 }
      porChave[chave] = novo
      out.push(novo)
    }
  }
  return out
}

/**
 * The «Conta» value the mapping imports, when it is still one of the file's values (contasDoArquivo); null when none is
 * chosen, or when the one chosen before «Voltar» is no longer in the «Conta» column (it moved, or went)
 */
export function valorImportado(m: Mapeamento, market: AccountMarket): string | null {
  if (m.accountValue === null) return null
  const chave = accountKey(m.accountValue)
  return contasDoArquivo(m, market).some((c) => c.chave === chave) ? m.accountValue : null
}

/**
 * The value hc imports at first: the one written as the account's «Número na plataforma»; else the one the model routes to
 * this account; else none («Não importar» everywhere: blocked)
 */
export function valorPreSelecionado(m: Mapeamento, account: Pick<TradingAccount, 'id' | 'external_ref' | 'market'>): string | null {
  const valores = contasDoArquivo(m, account.market)
  if (account.external_ref) {
    const chave = accountKey(account.external_ref)
    const v = valores.find((x) => x.chave === chave)
    if (v) return v.valor
  }
  const modelo = m.match.kind !== 'none' ? m.match.template : null
  if (modelo) {
    const v = valores.find((x) => modelo.accountRoutes[accountRouteHash(x.valor)] === account.id)
    if (v) return v.valor
  }
  return null
}

// ------------------------------------------------------------------------------------------------
// E35–E43 · the preview
// ------------------------------------------------------------------------------------------------

/** pt-BR digits of a decimal, without trailing zeros («5» for '5.00', «0,25» for '0.25') */
function passoEmTexto(tick: string): string {
  const t = tick.includes('.') ? tick.replace(/0+$/, '').replace(/\.$/, '') : tick
  return t.replace('.', ',')
}

/**
 * «Linha {n}: {motivo}»'s reason (§3.3): the readers' as built; a mapped file's side «lado desconhecido», its bad number by
 * the field's label, and an off-tick price with the instrument's root and tick, from that line's record (browser only)
 */
export function motivoDaLinha(
  e: { line: number; code: string },
  ctx: { issues: readonly RowIssue<RowErrorCode>[]; m: Mapeamento | null; market: AccountMarket },
): string {
  const local = ctx.issues.find((i) => i.line === e.line && i.code === e.code)
  if (!ctx.m) return rowErrorReason(e.code, { column: local?.column, firstLine: local?.firstLine })
  let raiz: string | undefined
  let passo: string | undefined
  if (e.code === 'off_tick') {
    const i = escolhasDe(ctx.m).columns.indexOf('symbol')
    const rec = ctx.m.lido.records.find((r) => r.line === e.line)
    const symbol = i >= 0 && rec ? (rec.cells[i] ?? '').trim() : ''
    const spec = symbol ? tradeInstrument(ctx.market, symbol) : null
    if (spec && spec.tick) {
      raiz = tradeMatchKey(ctx.market, symbol)
      passo = passoEmTexto(spec.tick)
    }
  }
  return rowErrorReason(e.code, { column: local?.column, firstLine: local?.firstLine, mapeado: true, raiz, passo })
}

/**
 * symbol_normalised's pairs: each spelling the file writes and the symbol it becomes, in the order the whole file first
 * writes them (the board's line is the same whichever «Conta» value is imported, IC l.1003); with a «Conta» value
 * imported, only the spellings of its rows (the others are not imported)
 */
export function paresDeAtivos(m: Mapeamento | null, file: ImportFile): { escrito: string; como: string }[] {
  const notice = file.notices.find((n): n is Extract<Notice, { code: 'symbol_normalised' }> => n.code === 'symbol_normalised')
  if (!notice || !m || file.platform !== 'modelo') return []
  const columns = escolhasDe(m).columns
  const i = columns.indexOf('symbol')
  if (i < 0) return []
  const c = columns.indexOf('account')
  const conta = c >= 0 && m.accountValue !== null ? accountKey(m.accountValue) : null
  const naOrdem: string[] = []
  const importados = new Set<string>()
  for (const rec of m.lido.records) {
    const escrito = (rec.cells[i] ?? '').trim()
    if (!escrito) continue
    if (naOrdem.indexOf(escrito) < 0) naOrdem.push(escrito)
    if (conta === null || accountKey(rec.cells[c] ?? '') === conta) importados.add(escrito)
  }
  const out: { escrito: string; como: string }[] = []
  for (const escrito of naOrdem) {
    if (!importados.has(escrito)) continue
    const s = readSymbol(escrito, file.market)
    if (s.ok && s.normalised && notice.symbols.indexOf(s.symbol) >= 0) out.push({ escrito, como: s.symbol })
  }
  return out
}

/**
 * How the database finds the file's rows again (the «já estavam» words): 'id' by each row's ID (a reader's file; a mapped
 * file with an ID column), 'hora' by its time and prices (a mapped file without an ID: the database derives each row's
 * key from them, owner's choice for Performance.csv, D11), 'misto' when some rows have an ID and others not
 */
export type ChaveDasLinhas = 'id' | 'hora' | 'misto'

export function chaveDasLinhas(file: Pick<ImportFile, 'platform' | 'rows'>): ChaveDasLinhas {
  if (file.platform !== 'modelo') return 'id'
  const comId = file.rows.filter((r) => r.external_id !== null).length
  if (comId === file.rows.length) return 'id'
  return comId === 0 ? 'hora' : 'misto'
}

/**
 * The «já estavam» words: none at 0; (mesma hora e preço) when every one was found by its time and prices (the rows have no
 * ID, or the database matched each across the two key methods: duplicate_same), (mesmo ID) when every one was found by its
 * ID; else none (some each way)
 */
export function palavraJaEstavam(p: Pick<ImportPreviewResult, 'duplicate' | 'duplicate_same'>, chave: ChaveDasLinhas = 'id'): string {
  const same = p.duplicate_same ?? 0
  if (p.duplicate === 0) return PASSO_D.already
  if (same === p.duplicate) return PASSO_D.alreadySame
  if (same > 0) return PASSO_D.already
  return chave === 'hora' ? PASSO_D.alreadySame : chave === 'id' ? PASSO_D.alreadyId : PASSO_D.already
}

export interface LinhaPulada {
  line: number
  motivo: string
}

/** The preview's lines in the board's order (D13); the step renders them */
export interface LinhasDaPrevia {
  /** E35: an execution file's executions; null for any other file */
  execucoes: number | null
  /** E36 */
  contagem: [number, string][]
  /**
   * E37: before the leftovers. `paragrafo`: a reader's file keeps its as-built paragraphs for the counts' notes (other
   * account, completed, linked, grouped, attached); the notices, and every line of a mapped file, are info lines
   */
  antes: { texto: string; paragrafo: boolean }[]
  /** E38: null when no line was left out */
  sobras: { titulo: string; linhas: LinhaPulada[] } | null
  /** E39: the gross and the costs, as money of the account's currency */
  comissao: { bruto: string; custo: string } | null
  /** The readers' «As colunas SL e TP vêm vazias…» (in the commission's ⓘ, or a line of its own) */
  slTpVazio: boolean
  /** E40: after the commission */
  depois: string[]
  /** E43: G1 */
  g1: string | null
}

/**
 * The preview's lines (§6.6) for a reader's file (as built) and a mapped one: counts in «linhas» or (an execution file)
 * «saídas», the notes before and after the commission, the lines left out and their reasons, G1. `m` is the file's mapping
 * (null for a reader's), `conta` the destination account.
 */
export function linhasDaPrevia(
  file: ImportFile,
  preview: ImportPreviewResult,
  m: Mapeamento | null,
  conta: Pick<TradingAccount, 'label' | 'market'>,
): LinhasDaPrevia {
  const mapeado = file.platform === 'modelo'
  const execucao = mapeado && file.rowKind === 'fill'
  const linked = preview.linked ?? 0
  const erros = preview.errors.length
  const jaEstavam = palavraJaEstavam(preview, chaveDasLinhas(file))

  // E36
  const contagem: [number, string][] = []
  if (execucao) {
    const saidas = preview.rows_total - erros
    contagem.push([saidas, PASSO_D.saidas(saidas)], [preview.new, PASSO_D.fresh])
    if (linked > 0) contagem.push([linked, PASSO_D.linkedCount(linked)])
    if (preview.other_account > 0) contagem.push([preview.other_account, PASSO_D.otherAccount])
    contagem.push([preview.duplicate, jaEstavam])
  } else {
    const naoImportadas = mapeado ? file.notImported : 0
    contagem.push([preview.rows_total + naoImportadas, PASSO_D.lines], [preview.new, PASSO_D.fresh])
    if (linked > 0) contagem.push([linked, PASSO_D.linkedCount(linked)])
    if (preview.other_account > 0) contagem.push([preview.other_account, PASSO_D.otherAccount])
    if (naoImportadas > 0 && m) {
      const chave = m.accountValue === null ? null : accountKey(m.accountValue)
      const outras = contasDoArquivo(m, conta.market)
        .filter((c) => c.chave !== chave)
        .map((c) => c.valor)
      contagem.push([naoImportadas, PASSO_D.naoImportadas(naoImportadas, outras)])
    }
    contagem.push([preview.duplicate, jaEstavam], [erros, PASSO_D.errors])
  }

  // E37
  const antes: { texto: string; paragrafo: boolean }[] = []
  const nota = (texto: string) => antes.push({ texto, paragrafo: !mapeado })
  const aviso = (texto: string) => antes.push({ texto, paragrafo: false })
  if (preview.other_account > 0) nota(PASSO_D.otherNote(preview.other_account))
  if (preview.completable > 0) nota(PASSO_D.completable(preview.completable))
  if (linked > 0) nota(PASSO_D.linked(linked))
  if ((preview.linked_differs ?? 0) > 0) nota(PASSO_D.linkedDiffers(preview.linked_differs ?? 0))
  if (execucao && file.rows.length > 0) nota(PASSO_D.saidasViram(file.rows.length, file.positions.length))
  if ((preview.grouped ?? 0) > 0) nota(PASSO_D.agrupadas(preview.grouped ?? 0))
  if ((preview.attached ?? 0) > 0) nota(PASSO_D.anexadas(preview.attached ?? 0))
  const notice = <C extends Notice['code']>(code: C) => file.notices.find((n): n is Extract<Notice, { code: C }> => n.code === code)
  const unfilled = notice('unfilled_orders')
  if (unfilled && unfilled.rows > 0) aviso(PASSO_D.ordensSemExecucao(unfilled.rows))
  const pares = paresDeAtivos(m, file)
  if (pares.length > 0) aviso(PASSO_D.ativosNormalizados(pares))
  const identical = notice('identical_rows')
  if (identical && identical.rows > 0) aviso(PASSO_D.linhasIguais(identical.rows))
  const offsets = notice('file_has_offset')
  if (offsets) aviso(PASSO_D.offsets(offsets.offsets.map((o) => (mapeado && o === '+00:00' ? 'UTC' : formatOffset(o))).join(', ')))
  const unsigned = notice('unsigned_losses_negated')
  if (unsigned) aviso(PASSO_D.unsignedLosses(unsigned.rows))
  const refunds = notice('refunds_as_breakeven')
  if (refunds) aviso(PASSO_D.refunds(refunds.rows))

  // E38
  let sobras: LinhasDaPrevia['sobras'] = null
  if (erros > 0) {
    const linhas = preview.errors.map((e) => ({ line: e.line, motivo: motivoDaLinha(e, { issues: file.errors, m: mapeado ? m : null, market: conta.market }) }))
    let titulo = PASSO_D.skipped(erros)
    if (execucao) {
      const codes = preview.errors.map((e) => e.code)
      const todas = (code: string) => codes.every((c) => c === code)
      const naoSei = file.endOfFile.filter((q) => q.answer === 'unknown')
      if (todas('unbalanced_symbol') && naoSei.length === 1) titulo = PASSO_D.sobrasNaoFecham(erros, naoSei[0].symbol)
      else if (todas('open_at_end')) titulo = PASSO_D.sobrasAbertas(erros)
      else if (todas('opened_before_file')) titulo = PASSO_D.sobrasAntes(erros)
      else titulo = PASSO_D.sobras(erros)
    }
    sobras = { titulo, linhas }
  }

  // E39
  const currency = currencyOf(conta.market)
  let comissao: LinhasDaPrevia['comissao'] = null
  const inFile = notice('commission_in_file')
  let bruto: string | null = inFile ? inFile.gross : null
  let custo: string | null = inFile ? inFile.commission : null
  if (!inFile && file.platform === 'topone') {
    // The notice carries the totals; a file where only some rows have commissions still shows them
    const t = totals(file.rows)
    if (t.commission !== null) {
      bruto = t.gross
      custo = t.commission
    }
  }
  if (bruto !== null && custo !== null) {
    comissao = {
      bruto: formatMoney(bruto, { signed: true, currency }),
      custo: formatMoney(custo === '0.00' ? '0' : `-${custo}`, { signed: true, currency }),
    }
  }

  // E40
  const depois: string[] = []
  if (mapeado) {
    const other = notice('commission_other_asset')
    if (!other && !file.rows.some((r) => r.commission !== null)) depois.push(PASSO_D.semComissao)
    if (other) depois.push(PASSO_D.taxaOutroAtivo(other.trades, other.assets))
    const differs = file.warnings.filter((w) => w.code === 'result_differs_from_prices').length
    if (differs > 0) depois.push(PASSO_D.difere(differs))
    const swap = notice('swap_in_result')
    if (swap && swap.rows > 0) depois.push(PASSO_D.comSwap(swap.rows))
  }
  if (preview.day_changes > 0) depois.push(PASSO_D.dayChanges(preview.day_changes, conta.market))
  if (mapeado && file.rowKind === 'trade') {
    const columns = m ? escolhasDe(m).columns : null
    const semSaida = columns ? columns.indexOf('exit_time') < 0 && !hasBuySellPair(columns) : file.rows.every((r) => r.local_exit === null)
    if (semSaida) depois.push(PASSO_D.semSaida)
  }

  return {
    execucoes: execucao ? file.executions : null,
    contagem,
    antes,
    sobras,
    comissao,
    slTpVazio: file.notices.some((n) => n.code === 'sl_tp_empty'),
    depois,
    g1: (preview.other_source ?? 0) > 0 ? PASSO_D.g1(preview.other_source ?? 0, conta.label) : null,
  }
}

// ------------------------------------------------------------------------------------------------
// E46 · the end's model line
// ------------------------------------------------------------------------------------------------

/** What happened to the model after the commit (§6.8) */
export interface ModeloDoFim {
  tipo: 'salvo' | 'atualizado' | 'tocado' | 'naoSalvo' | 'erro' | 'limite' | 'semLote'
  nome: string
}

/** The end's model line; null for a touch (a model taken as is) and with no mapped file */
export function linhaDoModelo(modelo: ModeloDoFim | null): string | null {
  if (!modelo) return null
  switch (modelo.tipo) {
    case 'salvo':
      return FIM_MODELO.salvo(modelo.nome)
    case 'atualizado':
      return FIM_MODELO.atualizado(modelo.nome)
    case 'naoSalvo':
      return FIM_MODELO.naoSalvo
    case 'erro':
      return FIM_MODELO.erro(modelo.nome)
    case 'limite':
      return FIM_MODELO.limite(modelo.nome)
    case 'semLote':
      return FIM_MODELO.semLote(modelo.nome)
    case 'tocado':
      return null
  }
}

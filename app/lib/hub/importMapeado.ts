/**
 * Phase 3b · telas: the column-mapping import's shared state, between the mapping steps (lane L1: «mapa»,
 * «conferir», the model chip) and the import sheet (lane L2). Pure but for lerArquivoMapeavel. The file's text,
 * cells and header names stay in the browser: never sent (only ImportRow and the model's names and choices are),
 * never stored, never logged.
 *
 * Lane L1 (contract §5): the pre-fill of «mapa» (§5.3: a field from the column's name, «Ignorar esta coluna» for a
 * twin, a known non-field or an ID that repeats), the edits of «mapa» and «conferir» (§5.2: each returns a new
 * Mapeamento), the reading checks the screens and the blocks share (the E10 notes, the tick note of the decimal
 * question, the check under each select) and the blocks of «Continuar» and «Usar estas colunas» (§5.6).
 */
import {
  accountKey,
  accountRouteHash,
  columnCheck,
  columnsFromTemplate,
  decodeCsvBytes,
  fieldsFor,
  headerClocks,
  mappedContext,
  mappingProblems,
  matchTemplate,
  missingRequirements,
  netAsked,
  netQuestion,
  parseMappedRecords,
  quantityIsSigned,
  readCsv,
  readSymbol,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  suggestColumns,
  suggestRowKind,
  synonymName,
  templateMisfits,
  templatePayload,
  unknownSideWords,
  CsvError,
  MAX_RECORDS,
  MAX_ROUTES,
  MAX_TEMPLATE_NAME,
  MAX_WORD_CHARS,
  MAX_WORDS,
  PLATFORM_MARKET,
  REPEATABLE_FIELD,
  type ColumnCheck,
  type ColumnMap,
  type CsvDelimiter,
  type DateOrder,
  type DateOrderDecision,
  type DecimalDecision,
  type DecimalMark,
  type EndOfFileAnswer,
  type FieldKey,
  type FileErrorCode,
  type MappedOutcome,
  type MappingChoices,
  type NetQuestion,
  type ReadImportFileResult,
  type RowKind,
  type SideWordAnswer,
  type SniffedFile,
  type Template,
  type TemplateMatch,
  type TemplatePayloadV1,
  type ValueContext,
} from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import { tradeInstrument, tradeMatchKey } from '@/lib/domain/registro'
import { CONFERIR, DICA_MAPA, LER, MODELO } from '@/components/hub/importar/copyMapa'
import { MARKET_LABEL, PLATFORM_LABEL } from '@/components/hub/contas/copy'

/** A file no reader took, read again as text */
export interface ArquivoMapeavel {
  fileName: string
  size: number
  /** readImportFile's, over the raw bytes */
  sha256: string
  text: string
}

/** One column on screen: a field, «Ignorar esta coluna» ('ignorar') or «Escolha…» (null); both last are null for the domain */
export type ColunaUi = FieldKey | 'ignorar' | null

export interface Mapeamento {
  /** The file read with `lido.delimiter` (sniffFile) */
  lido: SniffedFile
  /** The «Separador» pill pressed; differs from lido.delimiter while a re-read with it failed (E10) */
  separador: CsvDelimiter
  rowKind: RowKind
  /** Per row kind, so «Cada linha do arquivo é» keeps what each kind was given; indexed like lido.headers */
  colunas: Record<RowKind, ColunaUi[]>
  /** The pre-fill per row kind: «sugerida» while a column still holds it (origem 'nomes' only) */
  sugeridas: Record<RowKind, ColunaUi[]>
  /** Columns a changed model does not know («nova») */
  novas: boolean[]
  /** sniffDecimalMark over the mapped number columns of `rowKind` */
  decimal: DecimalDecision
  /** The «Decimal» pill or the question's pill pressed; null: the question is open with nothing pressed */
  decimalMark: DecimalMark | null
  /** sniffDateOrder over the mapped date columns */
  datas: DateOrderDecision
  /** The order in use (decided, a model's, the question's answer); null: none needed, or the question is open */
  dateOrder: DateOrder | null
  sideWords: Record<string, SideWordAnswer>
  openCloseWords: Record<string, 'open' | 'close'>
  /** The net question's answer (the prices' pre-answer, a model's, or a pill); null: not asked, or open */
  resultIsNet: boolean | null
  /** Only the answers the owner gave; a key absent is «Não sei» (pre-selected) */
  endOfFile: Record<string, EndOfFileAnswer>
  /** «N contas neste arquivo»: the «Conta» value imported now; null: every row. Written by the sheet (L2) only */
  accountValue: string | null
  match: TemplateMatch
  /**
   * An exact model whose facts fit the file and whose mapping passes «mapa» on it (bloqueioDoMapa null), taken as is: the
   * chip «Colunas do modelo “{nome}”» (E34), no model block, a touch after the commit
   */
  porModelo: boolean
  /**
   * Where the sheet starts the file (set by iniciarMapeamento, never changed after): 'previa' (porModelo and nothing to
   * ask: 15), 'conferir' (porModelo, but an execution file with an end-of-file question, or arquivoDoMapeamento fails:
   * owner decision 3, D20), 'mapa' (every other file)
   */
  inicio: 'mapa' | 'conferir' | 'previa'
  /** 'nomes': pre-filled from the column names; 'modelo': from the model (a changed match, or «Mudar colunas») */
  origem: 'nomes' | 'modelo'
  /** «Mudar colunas» was pressed (E7's «Mude as colunas do modelo …»); false everywhere else */
  mudando: boolean
  /** «Salvar como modelo» / «Atualizar o modelo “{nome}”» (checked by default) */
  salvar: boolean
  /** «Nome do modelo» as typed */
  nome: string
  /** The model's name, or the default name (D1): what an emptied «Nome do modelo» saves */
  nomePadrao: string
  /** L1: the owner pressed a «Decimal» pill or a pill of the decimal question (kept when the columns change) */
  decimalEscolhido?: boolean
  /** L1: the owner pressed a «Datas» pill or a pill of the date question (kept when the columns change) */
  datasEscolhidas?: boolean
  /** L1: the owner pressed a pill of the net question (no new pre-answer after that) */
  liquidoEscolhido?: boolean
  /**
   * Owner decision (23 Oct): the model matched was saved in another market than the account's: the markets of its batches
   * (empty when they could not be read). It is offered as any model, but «Atualizar o modelo» starts unchecked and, so
   * left, the import saves a new model (nome = «{model} · {market}»); a model with the file's very columns (exact) is
   * taken as is and never written (modeloSoParaLer). Absent: no model, or one of this market (or with no batch yet).
   */
  outroMercado?: AccountMarket[]
}

/**
 * Each model's markets (contasDb.fetchTemplateMarkets: its batches' accounts); a model absent has no batch yet and fits
 * every market
 */
export type MercadosDosModelos = Readonly<Record<string, readonly AccountMarket[]>>

// ------------------------------------------------------------------------------------------------
// Reading the file again
// ------------------------------------------------------------------------------------------------

/** The bytes of a Blob: Blob.arrayBuffer where the runtime has it, else FileReader (jsdom has only the latter) */
function bytesOf(file: Blob): Promise<ArrayBuffer> {
  const withBuffer = file as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }
  if (typeof withBuffer.arrayBuffer === 'function') return withBuffer.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsArrayBuffer(file)
  })
}

/** The text again (decodeCsvBytes over the bytes; Blob.arrayBuffer, else FileReader) */
export async function lerArquivoMapeavel(
  file: Blob,
  lido: Pick<ReadImportFileResult, 'fileName' | 'size' | 'sha256'>,
): Promise<ArquivoMapeavel> {
  const bytes = await bytesOf(file)
  return { fileName: lido.fileName, size: lido.size, sha256: lido.sha256, text: decodeCsvBytes(bytes) }
}

/** The platforms whose files a reader takes (Ebinex, Top One): their name says nothing about a mapped file */
const READER_PLATFORMS: readonly string[] = Object.keys(PLATFORM_MARKET)
/** «Não sei» and «Outra»: no name to give */
const NO_NAME_PLATFORMS: readonly string[] = ['naosei', 'outra']

/** The default «Nome do modelo» (D1): the platform's label; a reader's platform (topone, ebinex), naosei, outra or none → «Minha plataforma» */
export function nomePadraoDoModelo(platform: string | null): string {
  if (!platform || READER_PLATFORMS.indexOf(platform) >= 0 || NO_NAME_PLATFORMS.indexOf(platform) >= 0) return MODELO.nomePadrao
  return Object.prototype.hasOwnProperty.call(PLATFORM_LABEL, platform) ? PLATFORM_LABEL[platform] : MODELO.nomePadrao
}

/**
 * Owner decision (23 Oct): the markets of `modelo` when it was saved in another market than `market` (its batches' markets,
 * none of them `market`), or undefined when it fits: a model with no batch yet, or one used in `market`. `mercados`
 * undefined: not given (every model fits); null: their read failed, so every model counts as another market's (empty
 * list), and no import writes over a model it cannot place.
 */
export function mercadosDeOutroMercado(
  modelo: Pick<Template, 'id'>,
  market: AccountMarket,
  mercados: MercadosDosModelos | null | undefined,
): AccountMarket[] | undefined {
  if (mercados === undefined) return undefined
  if (mercados === null) return []
  const usados = mercados[modelo.id] ?? []
  return usados.length === 0 || usados.indexOf(market) >= 0 ? undefined : usados.slice()
}

/**
 * The name a model of another market's columns is saved under in `market` (owner decision, 23 Oct): «{model} · {market}»
 * («BlackArrow · B3»), a market suffix the model's name already ends with dropped first, the model's part cut so the whole
 * fits MAX_TEMPLATE_NAME characters (import_template_save: 1–60 after trim). Names need not be unique (the database keys
 * models by their header set).
 */
export function nomeNoMercado(nome: string, market: AccountMarket): string {
  const sufixo = ` · ${MARKET_LABEL[market]}`
  let base = nome.trim()
  for (const rotulo of Object.values(MARKET_LABEL)) {
    if (base.endsWith(` · ${rotulo}`)) {
      base = base.slice(0, base.length - rotulo.length - 3).trim()
      break
    }
  }
  const cabe = MAX_TEMPLATE_NAME - Array.from(sufixo).length
  const corte = Array.from(base).slice(0, cabe).join('').trim()
  return corte ? `${corte}${sufixo}` : MARKET_LABEL[market]
}

export type InicioMapeamento = { ok: true; mapeamento: Mapeamento } | { ok: false; error: FileErrorCode; line?: number }

/**
 * The header the readers saw (routeFile's input, §3.1): the first record of the comma read parseImportText made,
 * readCsv(arquivo.text, {maxRecords: MAX_RECORDS + 1})[0].cells (it cannot throw for a file readImportFile called
 * unknown_format / missing_columns / duplicate_columns: that same read succeeded)
 */
export function cabecalhoDoLeitor(arquivo: ArquivoMapeavel): string[] {
  try {
    const records = readCsv(arquivo.text, { maxRecords: MAX_RECORDS + 1 })
    return records.length > 0 ? records[0].cells.slice() : []
  } catch (e) {
    // Never for a file the readers already read (see above); an empty header routes as no reader's
    if (e instanceof CsvError) return []
    throw e
  }
}

// ------------------------------------------------------------------------------------------------
// The pre-fill (§5.3)
// ------------------------------------------------------------------------------------------------

/** «Escolha…» and «Ignorar esta coluna» are both «no field» for the domain */
const paraODominio = (colunas: readonly ColunaUi[]): (FieldKey | null)[] => colunas.map((c) => (c === 'ignorar' || c === null ? null : c))

/** Every column as one kind of value: the decimal mark and the date order of a file before any mapping */
const todasComo = (n: number, f: FieldKey): FieldKey[] => Array.from({ length: n }, () => f)

/** The header clocks as the domain's MappedContext takes them (an offset, or none) */
function relogios(headers: readonly string[], columns: ColumnMap): (string | null)[] {
  return headerClocks(headers, columns).map((c) => (c && 'offset' in c ? c.offset : null))
}

/** Known non-field columns, by synonymName (Tradovate's Status, Performance.csv's duration): «Ignorar» in both readings */
const IGNORAVEIS: readonly string[] = ['status', 'duration']
/**
 * An order's limit and stop prices (Tradovate's Limit Price): «Ignorar» in an execution file, where they are no execution's
 * field; in one trade per row they may be the trade's stop or target, so they stay «Escolha…» (the board's Tradovate read
 * as trades, IC l.865)
 */
const IGNORAVEIS_EXECUCAO: readonly string[] = ['limit price', 'stop price']

/**
 * What a field of one reading is in the other («Cada linha do arquivo é»): the entry ↔ the execution's time, the IDs, and
 * the fields both have; prices, results, the exit and the buy/sell pair have none (the board's other-kind columns, IC
 * l.797–1053: «Entry time» → «Data e hora», «Position ID» → «ID da execução», «Executed» → «Quantidade»)
 */
const NA_OUTRA: Record<RowKind, Partial<Record<FieldKey, FieldKey>>> = {
  trade: { entry_time: 'time', symbol: 'symbol', side: 'side', quantity: 'quantity', commission: 'commission', fee: 'fee', trade_id: 'fill_id', account: 'account' },
  fill: { time: 'entry_time', symbol: 'symbol', side: 'side', quantity: 'quantity', commission: 'commission', fee: 'fee', fill_id: 'trade_id', account: 'account' },
}

/** Why the pre-fill set a column to «Ignorar esta coluna» */
type MotivoIgnorar = 'gemea' | 'conhecida' | 'id'

/**
 * A field for a column the domain left empty in `kind`, from the column's name read as the other kind (NA_OUTRA), when
 * this kind offers it, no other column holds it yet and the cells fit it. An execution's own names («Fill Time», «Filled
 * Qty», «Avg Fill Price») never become a trade's field: in one trade per row the trade's columns are the entry (Tradovate's
 * Timestamp and Quantity, IC l.861–866)
 */
function daOutraLeitura(
  lido: SniffedFile,
  i: number,
  kind: RowKind,
  market: AccountMarket,
  values: ValueContext,
  ocupados: readonly ColunaUi[],
): FieldKey | null {
  const outra: RowKind = kind === 'trade' ? 'fill' : 'trade'
  if (kind === 'trade' && synonymName(lido.rawHeaders[i] ?? lido.headers[i]).indexOf('fill') >= 0) return null
  const la = suggestColumns([lido.headers[i]], outra, market)[0]
  const campo = la !== null ? NA_OUTRA[outra][la] ?? null : null
  if (campo === null || fieldsFor(kind, market).indexOf(campo) < 0) return null
  if (campo !== REPEATABLE_FIELD && ocupados.indexOf(campo) >= 0) return null
  return columnCheck(values, i, campo) === null ? campo : null
}

/**
 * The pre-fill from the names for one row kind (§5.3): the domain's suggestion; a column it leaves empty takes its
 * name's field in the other reading (daOutraLeitura), else is «Ignorar esta coluna» when its own name suggests a field
 * another column holds (a twin: Tradovate's avgPrice, filledQty, Timestamp, Quantity), when it is a known non-field, or
 * when it is an ID that repeats (Performance.csv's buyFillId, sellFillId); any other stays «Escolha…»
 */
function preenchimento(
  lido: SniffedFile,
  kind: RowKind,
  market: AccountMarket,
  values: ValueContext,
): { colunas: ColunaUi[]; motivos: (MotivoIgnorar | null)[] } {
  const f = suggestColumns(lido.headers, kind, market, values)
  const motivos: (MotivoIgnorar | null)[] = f.map(() => null)
  const colunas: ColunaUi[] = f.slice()
  const ignoraveis = kind === 'fill' ? [...IGNORAVEIS, ...IGNORAVEIS_EXECUCAO] : IGNORAVEIS
  f.forEach((campo, i) => {
    if (campo !== null) return
    colunas[i] = daOutraLeitura(lido, i, kind, market, values, colunas)
  })
  colunas.forEach((campo, i) => {
    if (campo !== null) return
    colunas[i] = ignorar(i)
  })
  return { colunas, motivos }

  function ignorar(i: number): ColunaUi {
    const sozinha = suggestColumns([lido.headers[i]], kind, market)[0]
    if (sozinha !== null && sozinha !== REPEATABLE_FIELD && colunas.indexOf(sozinha) >= 0) {
      motivos[i] = 'gemea'
      return 'ignorar'
    }
    const nome = synonymName(lido.rawHeaders[i] ?? lido.headers[i])
    if (ignoraveis.indexOf(nome) >= 0) {
      motivos[i] = 'conhecida'
      return 'ignorar'
    }
    if (/id$/.test(nome) && columnCheck(values, i, kind === 'trade' ? 'trade_id' : 'fill_id') === 'repeats') {
      motivos[i] = 'id'
      return 'ignorar'
    }
    return null
  }
}

/** The pre-fill from the column names, per row kind */
function colunasDosNomes(lido: SniffedFile, kind: RowKind, market: AccountMarket, values: ValueContext): ColunaUi[] {
  return preenchimento(lido, kind, market, values).colunas
}

/** What the file's cells decide before any mapping (§5.3 step 1): every column read as a number, as a date */
function valoresDoArquivo(lido: SniffedFile): ValueContext {
  const n = lido.headers.length
  const dec = sniffDecimalMark(lido.records, todasComo(n, 'quantity'), lido.delimiter)
  return {
    records: lido.records,
    decimalMark: dec.decided ?? dec.fallback,
    dateOrder: sniffDateOrder(lido.records, todasComo(n, 'time')).decided,
  }
}

/**
 * The columns the pre-fill set to «Ignorar esta coluna» because their IDs repeat (E15 note 7d: «buyFillId e sellFillId se
 * repetem …»), from the names' pre-fill of `m`'s row kind, while the column still holds that pre-fill's «Ignorar» or
 * not: the note stays when the owner changes the select. None for a model's own row kind.
 */
export function idsQueSeRepetem(m: Mapeamento, market: AccountMarket): number[] {
  const modelo = modeloDe(m.match)
  if (m.origem === 'modelo' && modelo && modelo.rowKind === m.rowKind) return []
  const { motivos } = preenchimento(m.lido, m.rowKind, market, valoresDoArquivo(m.lido))
  const out: number[] = []
  motivos.forEach((x, i) => {
    if (x === 'id' && m.sugeridas[m.rowKind][i] === 'ignorar') out.push(i)
  })
  return out
}

// ------------------------------------------------------------------------------------------------
// The mapping of a file
// ------------------------------------------------------------------------------------------------

/** The decimal and date decisions over the columns `m` maps for its row kind */
function decisoes(lido: SniffedFile, columns: ColumnMap): { decimal: DecimalDecision; datas: DateOrderDecision } {
  return { decimal: sniffDecimalMark(lido.records, columns, lido.delimiter), datas: sniffDateOrder(lido.records, columns) }
}

/** The model matched (exact or changed), or null */
const modeloDe = (match: TemplateMatch): Template | null => (match.kind === 'none' ? null : match.template)

/** sniffFile's success as the state keeps it */
function lidoDe(s: SniffedFile): SniffedFile {
  return {
    delimiter: s.delimiter,
    headerSkip: s.headerSkip,
    headerLine: s.headerLine,
    rawHeaders: s.rawHeaders,
    headers: s.headers,
    sig: s.sig,
    records: s.records,
  }
}

/** What iniciarMapeamento needs besides the file */
export interface ContextoDoMapeamento {
  market: AccountMarket
  templates: readonly Template[]
  nomePadrao: string
  /** Each model's markets (owner decision, 23 Oct); undefined: not given (every model fits); null: the read failed */
  mercados?: MercadosDosModelos | null
}

/** iniciarMapeamento's rules over a file already read (also «Separador»'s fresh mapping of a re-read file) */
function mapear(lido: SniffedFile, ctx: ContextoDoMapeamento): Mapeamento {
  const { market } = ctx
  const match = matchTemplate(lido.headers, ctx.templates)
  const values = valoresDoArquivo(lido)
  const doNome: Record<RowKind, ColunaUi[]> = {
    trade: colunasDosNomes(lido, 'trade', market, values),
    fill: colunasDosNomes(lido, 'fill', market, values),
  }
  const base = {
    lido,
    separador: lido.delimiter,
    endOfFile: {},
    accountValue: null,
    match,
    mudando: false,
    salvar: true,
  }

  const modelo = modeloDe(match)
  if (modelo) {
    const { colunas: doModelo, novas } = colunasDoModelo(lido.headers, modelo)
    const rowKind = modelo.rowKind
    const colunas: Record<RowKind, ColunaUi[]> = { ...doNome, [rowKind]: doModelo }
    const sugeridas: Record<RowKind, ColunaUi[]> = { trade: colunas.trade.slice(), fill: colunas.fill.slice() }
    const { decimal, datas } = decisoes(lido, paraODominio(doModelo))
    // Another market's model: offered, «Atualizar o modelo» unchecked, a new model's name ready (owner decision, 23 Oct)
    const outro = mercadosDeOutroMercado(modelo, market, ctx.mercados)
    const nome = outro ? nomeNoMercado(modelo.name, market) : modelo.name
    let m: Mapeamento = {
      ...base,
      ...(outro ? { outroMercado: outro, salvar: false } : {}),
      rowKind,
      colunas,
      sugeridas,
      novas,
      decimal,
      decimalMark: decimal.decided ?? modelo.decimalMark,
      datas,
      dateOrder: datas.decided ?? modelo.dateOrder,
      sideWords: { ...modelo.sideWords },
      openCloseWords: { ...modelo.openCloseWords },
      resultIsNet: null,
      porModelo: false,
      inicio: 'mapa',
      origem: 'modelo',
      nome,
      nomePadrao: nome,
    }
    m = { ...m, resultIsNet: modelo.resultIsNet ?? preResposta(m, market) }
    return m
  }

  const rowKind = suggestRowKind(lido.headers, market, values)
  const { decimal, datas } = decisoes(lido, paraODominio(doNome[rowKind]))
  const m: Mapeamento = {
    ...base,
    rowKind,
    colunas: doNome,
    sugeridas: { trade: doNome.trade.slice(), fill: doNome.fill.slice() },
    novas: lido.headers.map(() => false),
    decimal,
    decimalMark: decimal.decided ?? decimal.question?.preselect ?? (decimal.question ? null : decimal.fallback),
    datas,
    dateOrder: datas.decided,
    sideWords: {},
    openCloseWords: {},
    resultIsNet: null,
    porModelo: false,
    inicio: 'mapa',
    origem: 'nomes',
    nome: ctx.nomePadrao,
    nomePadrao: ctx.nomePadrao,
  }
  return { ...m, resultIsNet: preResposta(m, market) }
}

/** The model's fields on this file's names: a name it knows and ignores → 'ignorar'; a name it does not know → null and «nova» */
function colunasDoModelo(headers: readonly string[], template: Template): { colunas: ColunaUi[]; novas: boolean[] } {
  const fields = columnsFromTemplate(headers, template)
  const novas = headers.map((h) => template.headers.indexOf(h) < 0)
  return { colunas: fields.map((f, i) => (f !== null ? f : novas[i] ? null : 'ignorar')), novas }
}

/**
 * The mapping of a file whose account is known: sniffFile (its failures returned as they are), matchTemplate over the
 * user's models, then
 *   exact and templateMisfits(…) = []  → the model's choices, origem 'modelo', salvar true, nome = the model's; then
 *                                         bloqueioDoMapa(m) ≠ null (a new side word, a failing column check) → porModelo
 *                                         false, inicio 'mapa' («Atualizar o modelo»: the answer goes into the model);
 *                                         else porModelo true and inicio = 'conferir' when arquivoDoMapeamento(m, market,
 *                                         null) fails or is an execution file with endOfFile.length > 0, else 'previa';
 *   exact with misfits, or changed      → inicio 'mapa', the model's choices on the names it knows (columnsFromTemplate: a known name it
 *                                         ignores → 'ignorar', a new name → null + novas), the model's row kind, porModelo
 *                                         false, origem 'modelo', salvar true («Atualizar o modelo»), nome = the model's;
 *   none                                → rowKind = suggestRowKind; colunas[k] = the pre-fill of §5.3 for both kinds
 *                                         (suggestColumns, a name of the other reading, then «Ignorar esta coluna» for a
 *                                         twin, a known non-field or an ID that repeats); decimal over the mapped number
 *                                         columns, decimalMark = decided
 *                                         ?? question?.preselect ?? (question ? null : fallback); datas over the mapped
 *                                         date columns, dateOrder = decided (null while `ask`); resultIsNet =
 *                                         netQuestion(…)?.preanswer ?? null; origem 'nomes', salvar true, nome =
 *                                         nomePadrao = ctx.nomePadrao.
 * endOfFile {}, accountValue null, mudando false, sideWords/openCloseWords {} (or the model's), separador = lido.delimiter;
 * inicio 'mapa' and porModelo false but for the first case.
 * A model saved in another market (ctx.mercados, owner decision 23 Oct) is matched and taken the same way, with
 * `outroMercado` set, salvar false and nome = nomePadrao = nomeNoMercado(the model's name, market).
 */
export function iniciarMapeamento(arquivo: ArquivoMapeavel, ctx: ContextoDoMapeamento): InicioMapeamento {
  const s = sniffFile(arquivo.text)
  if (!s.ok) return s
  const lido = lidoDe(s)
  const { market } = ctx
  const m = mapear(lido, ctx)
  const modelo = modeloDe(m.match)
  if (!modelo || m.match.kind !== 'exact') return { ok: true, mapeamento: m }
  const misfits = templateMisfits(modelo, {
    delimiter: lido.delimiter,
    headerSkip: lido.headerSkip,
    decimalDecided: m.decimal.decided,
    dateOrderDecided: m.datas.decided,
  })
  if (misfits.length > 0 || bloqueioDoMapa(m, market) !== null) return { ok: true, mapeamento: m }
  const f = arquivoDoMapeamento(m, market, null)
  const pergunta = !f.ok || bloqueioDoConferir(m, market) !== null || (f.rowKind === 'fill' && f.endOfFile.length > 0)
  return { ok: true, mapeamento: { ...m, porModelo: true, inicio: pergunta ? 'conferir' : 'previa' } }
}

/**
 * «O resultado do arquivo já desconta a comissão?» of a trade file (E26): the domain's question over `m`'s mapping (its
 * form, the prices' pre-answer and the evidence row), or null when it is not asked or the file is an execution file
 */
export function perguntaDoLiquido(m: Mapeamento, market: AccountMarket): NetQuestion | null {
  if (m.rowKind !== 'trade') return null
  const choices = { ...escolhasDe(m), resultIsNet: null }
  if (!netAsked(choices.rowKind, choices.columns)) return null
  return netQuestion(m.lido.records, mappedContext(choices, market, relogios(choices.headers, choices.columns)))
}

/** The net question's pre-answer for `m`'s mapping (trade files: the prices settle it), or null */
function preResposta(m: Mapeamento, market: AccountMarket): boolean | null {
  return perguntaDoLiquido(m, market)?.preanswer ?? null
}

/** The domain's choices: 'ignorar' and null → null; decimalMark ?? decimal.fallback; resultIsNet only when netAsked */
export function escolhasDe(m: Mapeamento): MappingChoices {
  const columns = paraODominio(m.colunas[m.rowKind])
  return {
    rowKind: m.rowKind,
    headers: m.lido.headers.slice(),
    headerSkip: m.lido.headerSkip,
    delimiter: m.lido.delimiter,
    decimalMark: m.decimalMark ?? m.decimal.fallback,
    dateOrder: m.dateOrder,
    columns,
    resultIsNet: netAsked(m.rowKind, columns) ? m.resultIsNet : null,
    sideWords: { ...m.sideWords },
    openCloseWords: { ...m.openCloseWords },
  }
}

/** A composite end-of-file key (endOfFileKey with an account): JSON [accountKey, SYMBOL]; null for a plain key */
function chaveComposta(key: string): [string, string] | null {
  if (!key.startsWith('[')) return null
  try {
    const v: unknown = JSON.parse(key)
    return Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string' ? [v[0], v[1]] : null
  } catch {
    return null
  }
}

/** The end-of-file answers as the domain keys them for `accountValue` (§4.1, §6.7); m.endOfFile itself is never re-keyed */
function respostasDoFim(m: Mapeamento): Record<string, EndOfFileAnswer> {
  if (m.accountValue === null) return { ...m.endOfFile }
  const conta = accountKey(m.accountValue)
  const out: Record<string, EndOfFileAnswer> = {}
  const compostas: [string, EndOfFileAnswer][] = []
  for (const key of Object.keys(m.endOfFile)) {
    const c = chaveComposta(key)
    if (c === null) out[key] = m.endOfFile[key]
    else if (c[0] === conta) compostas.push([c[1], m.endOfFile[key]])
  }
  // The answer given for this account wins over a plain one
  for (const [simbolo, resposta] of compostas) out[simbolo] = resposta
  return out
}

/**
 * parseMappedRecords with m's records and choices, accountValue, endOfFile, the model's id and tz hint (exact or changed
 * match; null otherwise) and `fileTz` (null on «mapa» and «conferir»: wall clocks; the zone once the zone step has one).
 * endOfFile: «conferir» always reads every account's rows (accountValue null), so with two or more «Conta» values its
 * answers are stored under endOfFileKey(S, conta) = JSON [accountKey(conta), S]; once hc set accountValue, the domain
 * keys that account's questions by S alone (fills.ts accountKeys), so the answers passed are: each stored key whose
 * JSON [k, S] has k = accountKey(accountValue) → S; other accounts' composite keys dropped; plain keys (a file with one
 * «Conta» value or none) kept. m.endOfFile itself is never re-keyed (Voltar to conferir finds it intact).
 */
export function arquivoDoMapeamento(m: Mapeamento, market: AccountMarket, fileTz: string | null): MappedOutcome {
  const modelo = modeloDe(m.match)
  return parseMappedRecords({
    records: m.lido.records,
    choices: escolhasDe(m),
    market,
    accountValue: m.accountValue,
    endOfFile: respostasDoFim(m),
    templateId: modelo ? modelo.id : null,
    tzHint: fusoDoModelo(m),
    fileTz,
  })
}

/**
 * The model's zone as a hint for this file (the zone step's pre-selection, mostrarFuso): the zone its last import used,
 * unless the model is another market's (owner decision, 23 Oct: a futures model's New York is no hint for a B3 file)
 */
export function fusoDoModelo(m: Pick<Mapeamento, 'match' | 'outroMercado'>): string | null {
  const modelo = modeloDe(m.match)
  return modelo && !m.outroMercado ? modelo.tzHint : null
}

/**
 * Owner decision (23 Oct): another market's model with the file's very columns (an exact match) is only read: taken as is,
 * never touched nor updated, and no model is saved beside it (the database keeps one model per header set, so a «new»
 * one would overwrite it). The edits of «mapa» stay with this file.
 */
export function modeloSoParaLer(m: Pick<Mapeamento, 'match' | 'outroMercado'>): boolean {
  return !!m.outroMercado && m.match.kind === 'exact'
}

/** arquivoDeTodasAsContas's answer per state (a read of the whole file); a Mapeamento is never changed in place */
const lidoVisto = new WeakMap<Mapeamento, { market: AccountMarket; f: MappedOutcome }>()

/**
 * What «conferir» reads (§5.5, §6.7): arquivoDoMapeamento({...m, accountValue: null}, market, null), every account's rows
 * on their wall clocks, kept per state so the step and its block read the file once
 */
export function arquivoDeTodasAsContas(m: Mapeamento, market: AccountMarket): MappedOutcome {
  const visto = lidoVisto.get(m)
  if (visto && visto.market === market) return visto.f
  const f = arquivoDoMapeamento({ ...m, accountValue: null }, market, null)
  lidoVisto.set(m, { market, f })
  return f
}

/**
 * «Mudar colunas» (E34, on «Prévia» or «conferir»): porModelo false, origem 'modelo', mudando true (title «Mude as colunas
 * do modelo “{nome}”.»), the model block «Atualizar o modelo “{nome}”» checked; every answer kept
 */
export function mudarColunas(m: Mapeamento): Mapeamento {
  // Another market's model: «Atualizar o modelo» unchecked (owner decision, 23 Oct)
  return { ...m, porModelo: false, origem: 'modelo', mudando: true, salvar: !m.outroMercado }
}

// ------------------------------------------------------------------------------------------------
// The edits (§5.2): each returns a new Mapeamento
// ------------------------------------------------------------------------------------------------

/** The net pre-answer again, unless the owner pressed a net pill (a model's answer first, as iniciarMapeamento) */
function prerresponder(m: Mapeamento, market: AccountMarket): Mapeamento {
  if (m.liquidoEscolhido) return m
  const modelo = m.origem === 'modelo' ? modeloDe(m.match) : null
  const doModelo = modelo && modelo.rowKind === m.rowKind ? modelo.resultIsNet : null
  return { ...m, resultIsNet: doModelo ?? preResposta(m, market) }
}

/**
 * The decimal mark and the date order decided again over the columns `m` maps for its row kind; a pill the owner
 * pressed is kept; otherwise the file's decision, the model's, the question's pre-selection or the fallback (as
 * iniciarMapeamento); then the net pre-answer again
 */
function redecidir(m: Mapeamento, market: AccountMarket): Mapeamento {
  const { decimal, datas } = decisoes(m.lido, paraODominio(m.colunas[m.rowKind]))
  const modelo = m.origem === 'modelo' ? modeloDe(m.match) : null
  const decimalMark = m.decimalEscolhido
    ? m.decimalMark
    : decimal.decided ?? modelo?.decimalMark ?? decimal.question?.preselect ?? (decimal.question ? null : decimal.fallback)
  const dateOrder = m.datasEscolhidas ? m.dateOrder : datas.decided ?? modelo?.dateOrder ?? null
  return prerresponder({ ...m, decimal, decimalMark, datas, dateOrder }, market)
}

/** «Cada linha do arquivo é» (E13): the kind's own columns come back; decimal, dates and the net pre-answer decided again */
export function comModo(m: Mapeamento, rowKind: RowKind, market: AccountMarket): Mapeamento {
  if (m.rowKind === rowKind) return m
  return redecidir({ ...m, rowKind }, market)
}

/** A column's select (E17): decimal and dates decided again over the mapped columns, pressed pills kept */
export function comColuna(m: Mapeamento, index: number, valor: ColunaUi, market: AccountMarket): Mapeamento {
  const colunas = m.colunas[m.rowKind].slice()
  colunas[index] = valor
  return redecidir({ ...m, colunas: { ...m.colunas, [m.rowKind]: colunas } }, market)
}

/** A record as wide as the header (cells beyond it, all empty, allowed: the domain's widthOk) */
const temALargura = (cells: readonly string[], largura: number) =>
  cells.length === largura || (cells.length > largura && cells.slice(largura).every((c) => c.trim() === ''))

type Lida = Extract<ReturnType<typeof sniffFile>, { ok: true }>

/** A read «Separador» can take: a header of two cells or more, every record as wide */
const inteira = (s: ReturnType<typeof sniffFile>): s is Lida =>
  s.ok && s.headers.length >= 2 && s.records.every((r) => temALargura(r.cells, s.headers.length))

/**
 * «Separador» (E9): the file's own delimiter → back to it, every edit kept; another one re-reads the text: first a fresh
 * read with it (sniffFile finds the header again), taken when its header line is at or above the current one, so a wrong
 * first read that took a data row for the header is repaired (a «;» file whose data lines end in «;», read first with «,»);
 * else the same header line (sniffFile with headerSkip), so a «,» read of a «;» file never skips its one-cell header as a
 * title and takes a data row as the header (f8). A read with a header of two cells or more and every record as wide → a
 * fresh mapping of the re-read file (iniciarMapeamento's rules, the model matched before as the only candidate), keeping
 * «Salvar» and the name; otherwise the columns stay and `separador` = d (E10's note, the block).
 */
export function comSeparador(m: Mapeamento, arquivo: ArquivoMapeavel, d: CsvDelimiter, market: AccountMarket): Mapeamento {
  if (d === m.lido.delimiter) return { ...m, separador: d }
  const nova = sniffFile(arquivo.text, { delimiter: d })
  const s = inteira(nova) && nova.headerLine <= m.lido.headerLine ? nova : sniffFile(arquivo.text, { delimiter: d, headerSkip: m.lido.headerSkip })
  if (!inteira(s)) return { ...m, separador: d }
  const modelo = modeloDe(m.match)
  const novo = mapear(lidoDe(s), { market, templates: modelo ? [modelo] : [], nomePadrao: m.nomePadrao })
  // Another market's model stays another market's while the re-read file still matches it; a file it no longer matches
  // is a new model's (checked, under the name already given)
  const outro = novo.origem === 'modelo' ? m.outroMercado : undefined
  return {
    ...novo,
    outroMercado: outro,
    inicio: m.inicio,
    porModelo: false,
    mudando: m.mudando && novo.origem === 'modelo',
    salvar: m.outroMercado && !outro ? true : m.salvar,
    nome: m.nome,
    nomePadrao: m.nomePadrao,
  }
}

/** «Decimal» pills (E9) and the decimal question (E12) */
export function comDecimal(m: Mapeamento, mark: DecimalMark, market: AccountMarket): Mapeamento {
  return prerresponder({ ...m, decimalMark: mark, decimalEscolhido: true }, market)
}

/** «Datas» pills (E9) and the date question (E11): the net question is pre-answered again once the dates read */
export function comDatas(m: Mapeamento, order: DateOrder, market: AccountMarket): Mapeamento {
  return prerresponder({ ...m, dateOrder: order, datasEscolhidas: true }, market)
}

/** «O que quer dizer “X”?» (E18): «Compra», «Venda» or «Pular essas linhas» */
export function comPalavraDeLado(m: Mapeamento, word: string, answer: SideWordAnswer, market: AccountMarket): Mapeamento {
  return prerresponder({ ...m, sideWords: { ...m.sideWords, [word]: answer } }, market)
}

/** «No fim do arquivo, {ativo} ficou posicionado?» (E24), under the question's key */
export function comFimDoArquivo(m: Mapeamento, key: string, answer: EndOfFileAnswer): Mapeamento {
  return { ...m, endOfFile: { ...m.endOfFile, [key]: answer } }
}

/** «Sim, é líquido» / «Não, é bruto» (E26) */
export function comLiquido(m: Mapeamento, net: boolean): Mapeamento {
  return { ...m, resultIsNet: net, liquidoEscolhido: true }
}

/** «Salvar como modelo» / «Atualizar o modelo “{nome}”» (E27) */
export function comSalvar(m: Mapeamento, salvar: boolean): Mapeamento {
  return { ...m, salvar }
}

/** «Nome do modelo» (E27): at most MAX_TEMPLATE_NAME characters */
export function comNome(m: Mapeamento, text: string): Mapeamento {
  const chars = Array.from(text)
  return { ...m, nome: chars.length > MAX_TEMPLATE_NAME ? chars.slice(0, MAX_TEMPLATE_NAME).join('') : text }
}

// ------------------------------------------------------------------------------------------------
// What the model keeps
// ------------------------------------------------------------------------------------------------

/**
 * What to save after the commit (E46), or null when nothing is saved («Salvar …» unchecked: «Colunas usadas só neste
 * arquivo.»; another market's model only read, modeloSoParaLer: none, or no line when it was taken as is)
 */
export interface ModeloASalvar {
  payload: TemplatePayloadV1
  /** p_replaces: the model «Atualizar o modelo» re-keys; null for a new model and for a touch */
  replaces: string | null
  /**
   * 'salvo' (origem 'nomes', or another market's model left unchecked: a new model), 'atualizado' (origem 'modelo', not
   * porModelo, checked), 'tocado' (porModelo: no end line)
   */
  tipo: 'salvo' | 'atualizado' | 'tocado'
  nome: string
}

/**
 * The side words a model can keep (import_template_save: at most MAX_WORDS words of 1–MAX_WORD_CHARS characters, each
 * «Compra» or «Venda»): the «Lado» column's words in the file's order first, then the other answers (a model's own); a
 * word beyond them, a longer one and «Pular essas linhas» are answers for this file only (the import reads them all)
 */
function palavrasDoModelo(m: Mapeamento): Record<string, SideWordAnswer> {
  const lado = paraODominio(m.colunas[m.rowKind]).indexOf('side')
  const doArquivo = lado >= 0 ? unknownSideWords(m.lido.records, lado).map((w) => w.word) : []
  const tem = (w: string) => Object.prototype.hasOwnProperty.call(m.sideWords, w)
  const ordem = [...doArquivo.filter(tem), ...Object.keys(m.sideWords).filter((w) => doArquivo.indexOf(w) < 0)]
  const out: Record<string, SideWordAnswer> = {}
  let n = 0
  for (const w of ordem) {
    const a = m.sideWords[w]
    const tamanho = Array.from(w).length
    if ((a !== 'buy' && a !== 'sell') || tamanho < 1 || tamanho > MAX_WORD_CHARS || n >= MAX_WORDS) continue
    out[w] = a
    n++
  }
  return out
}

/**
 * templatePayload(escolhasDe(m) + name = m.nome.trim() || m.nomePadrao, sideWords = palavrasDoModelo(m), accountRoutes =
 * the model's routes + the one for `rota` (accountRouteHash(valor) → contaId; routes only when a column is «Conta», at
 * most 50: a 51st is not added), tzHint). checkTemplate(payload) must be null for any mapping bloqueioDoMapa /
 * bloqueioDoConferir let through (tested).
 * Another market's model (owner decision, 23 Oct): only read when exact (null); else unchecked → 'salvo', a new model
 * (no p_replaces: the file's header set differs from the model's, so the upsert creates one) under m.nome; checked →
 * 'atualizado' under the model's own name. Neither keeps that model's routes (another market's accounts).
 */
export function modeloASalvar(
  m: Mapeamento,
  ctx: { tzHint: string | null; rota: { valor: string; contaId: string } | null },
): ModeloASalvar | null {
  if (modeloSoParaLer(m)) return null
  // Another market's model (owner decision, 23 Oct): unchecked saves a new model under the name shown; checked updates it
  const novoNoMercado = !!m.outroMercado && !m.salvar
  if (!m.salvar && !novoNoMercado) return null
  const choices = escolhasDe(m)
  const modelo = modeloDe(m.match)
  const tipo: ModeloASalvar['tipo'] = m.porModelo ? 'tocado' : m.origem === 'nomes' || novoNoMercado ? 'salvo' : 'atualizado'
  // An update keeps the model's own name (the name field shows only for a new model)
  const name = m.outroMercado && !novoNoMercado && modelo ? modelo.name : m.nome.trim() || m.nomePadrao
  const routes: Record<string, string> = {}
  if (choices.columns.indexOf('account') >= 0) {
    // Another market's routes point at that market's accounts, which import_template_save refuses for this batch
    if (modelo && !m.outroMercado) Object.assign(routes, modelo.accountRoutes)
    if (ctx.rota) {
      const hash = accountRouteHash(ctx.rota.valor)
      if (Object.prototype.hasOwnProperty.call(routes, hash) || Object.keys(routes).length < MAX_ROUTES) routes[hash] = ctx.rota.contaId
    }
  }
  return {
    payload: templatePayload({ ...choices, sideWords: palavrasDoModelo(m), name, accountRoutes: routes, tzHint: ctx.tzHint }),
    replaces: tipo === 'atualizado' && modelo ? modelo.id : null,
    tipo,
    nome: name,
  }
}

// ------------------------------------------------------------------------------------------------
// The checks the screens show and the blocks share
// ------------------------------------------------------------------------------------------------

/** E10: the reading note shown under «Separador…» (one at a time, the separator first), or null */
export function notaDeLeitura(m: Mapeamento): string | null {
  if (m.separador !== m.lido.delimiter) return LER.notaSeparador
  if (m.decimal.decided !== null && m.decimalMark !== m.decimal.decided) return LER.notaDecimal
  if (m.datas.decided !== null && m.dateOrder !== m.datas.decided) return LER.notaDatas
  return null
}

/** A tick in pt-BR digits without trailing zeros ('5' → «5», '0.25' → «0,25») */
function passoEmTexto(tick: string): string {
  const t = tick.indexOf('.') >= 0 ? tick.replace(/0+$/, '').replace(/\.$/, '') : tick
  return t.replace('.', ',')
}

/** foraDoPasso's answer per state (two reads of the whole file); a Mapeamento is never changed in place */
const passoVisto = new WeakMap<Mapeamento, { market: AccountMarket; fora: { raiz: string; passo: string } | null }>()

/**
 * E12's tick note: the pressed reading of the decimal question puts a row of a tick instrument off its tick that the
 * other reading keeps on it («Com este decimal, o WIN fica fora do passo (de 5 em 5).»): the root and the tick of the
 * first such row (its record's symbol, browser only). Null without the question, or when no such row exists (19 · «Só
 * preços»: line 9 is off its tick in both readings, so the comma reading shows nothing).
 */
export function foraDoPasso(m: Mapeamento, market: AccountMarket): { raiz: string; passo: string } | null {
  if (!m.decimal.question || m.decimalMark === null) return null
  const visto = passoVisto.get(m)
  if (visto && visto.market === market) return visto.fora
  const fora = foraDoPassoLido(m, m.decimalMark, market)
  passoVisto.set(m, { market, fora })
  return fora
}


function foraDoPassoLido(m: Mapeamento, marca: DecimalMark, market: AccountMarket): { raiz: string; passo: string } | null {
  const outra: DecimalMark = marca === 'comma' ? 'point' : 'comma'
  const lida = arquivoDoMapeamento(m, market, null)
  const alternativa = arquivoDoMapeamento({ ...m, decimalMark: outra }, market, null)
  if (!lida.ok || !alternativa.ok) return null
  const fora: number[] = alternativa.errors.filter((e) => e.code === 'off_tick').map((e) => e.line)
  const nova = lida.errors.find((e) => e.code === 'off_tick' && fora.indexOf(e.line) < 0)
  if (!nova) return null
  const simbolo = paraODominio(m.colunas[m.rowKind]).indexOf('symbol')
  const rec = m.lido.records.find((r) => r.line === nova.line)
  if (!rec || simbolo < 0) return null
  const s = readSymbol(rec.cells[simbolo] ?? '', market)
  if (!s.ok) return null
  const spec = tradeInstrument(market, s.symbol)
  if (!spec || !spec.tick) return null
  return { raiz: tradeMatchKey(market, s.symbol), passo: passoEmTexto(spec.tick) }
}

/**
 * The mark «mapa» reads the cells with for its checks and chips: the file's own decision, else the one in use. A pill that
 * contradicts the file gives E10's note «Os números não fecharam com este decimal.» and the block, never a check under the
 * number columns (the board's checks depend only on the column, IC l.1421–1430, 1446)
 */
export function marcaDeLeitura(m: Mapeamento): DecimalMark {
  return m.decimal.decided ?? m.decimalMark ?? m.decimal.fallback
}

/** What a column's check reads (E17): the domain's value checks with the reading mark, the order and the side words */
function valoresDaChecagem(m: Mapeamento): ValueContext {
  return { records: m.lido.records, decimalMark: marcaDeLeitura(m), dateOrder: m.dateOrder, sideWords: m.sideWords }
}

/**
 * The check under a column's select (E17): the domain's value check of its field, then «Swap ou funding» without
 * «Resultado» ('swap'); null for «Escolha…», «Ignorar esta coluna» and a column that looks like its field
 */
export function checagemDaColuna(m: Mapeamento, index: number): ColumnCheck | 'swap' | null {
  const campo = m.colunas[m.rowKind][index]
  if (campo === null || campo === 'ignorar') return null
  const c = columnCheck(valoresDaChecagem(m), index, campo)
  if (c !== null) return c
  if (campo === 'swap' && m.colunas[m.rowKind].indexOf('pnl') < 0) return 'swap'
  return null
}

/** Whether the quantity column (the one mapped to «Quantidade») holds negative numbers: it gives the side */
export function quantidadeComSinal(m: Mapeamento): boolean {
  const columns = paraODominio(m.colunas[m.rowKind])
  const qtd = columns.indexOf('quantity')
  return qtd >= 0 && quantityIsSigned(m.lido.records, qtd, marcaDeLeitura(m))
}

/**
 * The column mapped to «Lado» whose unknown words E18 asks about, or -1: only a side column, one whose cells look like
 * sides (its check passes) or whose name says so (read alone, or the model's); another column set to «Lado» (Data/Hora,
 * Papel) gets its check «Esta coluna não parece compra e venda.» and no question (the board asks only about the file's own
 * side column, IC l.1440 `perguntaX`)
 */
export function colunaDoLado(m: Mapeamento, market: AccountMarket): number {
  const k = m.rowKind
  const i = paraODominio(m.colunas[k]).indexOf('side')
  if (i < 0) return -1
  if (checagemDaColuna(m, i) === null) return i
  if (suggestColumns([m.lido.headers[i]], k, market)[0] === 'side') return i
  return m.origem === 'modelo' && m.sugeridas[k][i] === 'side' ? i : -1
}

/** The first word of the «Lado» column nobody answered (E18), or null */
function palavraSemResposta(m: Mapeamento, market: AccountMarket): string | null {
  const lado = colunaDoLado(m, market)
  if (lado < 0) return null
  const palavra = unknownSideWords(m.lido.records, lado, m.sideWords)[0]
  return palavra ? palavra.text : null
}

/**
 * «Continuar» on «mapa» (E19): the first hint that blocks, or null (§5.6), in this order: a reading note (E10: another
 * separator than the file's, a decimal or a date order the file contradicts) or E12's tick note (DICA_MAPA.ler); the
 * date question unanswered (datas); the decimal question with nothing pressed (numeros); a requirement missing
 * (obrigatorias); a field in two columns (umaColuna); a column whose check fails, «Swap ou funding» without
 * «Resultado» or a field this row kind does not offer (marcadas); a word of the «Lado» column nobody answered
 * (lado(the first)).
 */
export function bloqueioDoMapa(m: Mapeamento, market: AccountMarket): string | null {
  if (notaDeLeitura(m) !== null || foraDoPasso(m, market) !== null) return DICA_MAPA.ler
  if (m.datas.ask && m.dateOrder === null) return DICA_MAPA.datas
  if (m.decimal.question && m.decimalMark === null) return DICA_MAPA.numeros
  const columns = paraODominio(m.colunas[m.rowKind])
  if (missingRequirements(m.rowKind, columns, quantidadeComSinal(m)).length > 0) return DICA_MAPA.obrigatorias
  const problems = mappingProblems(m.rowKind, market, columns)
  if (problems.some((p) => p.code === 'duplicate_field')) return DICA_MAPA.umaColuna
  if (problems.some((p) => p.code === 'swap_without_pnl' || p.code === 'not_a_field')) return DICA_MAPA.marcadas
  for (let i = 0; i < columns.length; i++) if (checagemDaColuna(m, i) !== null) return DICA_MAPA.marcadas
  const palavra = palavraSemResposta(m, market)
  if (palavra !== null) return DICA_MAPA.lado(palavra)
  return null
}

/**
 * «Usar estas colunas» on «conferir» (E28, E29), or null: the mapping cannot make the file (CONFERIR.falha of its
 * error); the net question asked with no answer (CONFERIR.responda)
 */
export function bloqueioDoConferir(m: Mapeamento, market: AccountMarket): string | null {
  const f = arquivoDeTodasAsContas(m, market)
  if (!f.ok) return CONFERIR.falha(f.error)
  const choices = escolhasDe(m)
  if (netAsked(choices.rowKind, choices.columns) && m.resultIsNet === null) return CONFERIR.responda
  return null
}

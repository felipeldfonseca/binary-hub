/**
 * Phase 3b · telas: the column-mapping import's shared state, between the mapping steps (lane L1: «mapa»,
 * «conferir», the model chip) and the import sheet (lane L2). Pure but for lerArquivoMapeavel. The file's text,
 * cells and header names stay in the browser: never sent (only ImportRow and the model's names and choices are),
 * never stored, never logged.
 */
import {
  accountKey,
  accountRouteHash,
  columnsFromTemplate,
  decodeCsvBytes,
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
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  suggestColumns,
  suggestRowKind,
  templateMisfits,
  templatePayload,
  unknownSideWords,
  CsvError,
  MAX_RECORDS,
  MAX_ROUTES,
  PLATFORM_MARKET,
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
import { DICA_MAPA, MODELO } from '@/components/hub/importar/copyMapa'
import { PLATFORM_LABEL } from '@/components/hub/contas/copy'

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
}

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
// The mapping of a file
// ------------------------------------------------------------------------------------------------

/** «Escolha…» and «Ignorar esta coluna» are both «no field» for the domain */
const paraODominio = (colunas: readonly ColunaUi[]): (FieldKey | null)[] => colunas.map((c) => (c === 'ignorar' || c === null ? null : c))

/** Every column as one kind of value: the decimal mark and the date order of a file before any mapping */
const todasComo = (n: number, f: FieldKey): FieldKey[] => Array.from({ length: n }, () => f)

/** The header clocks as the domain's MappedContext takes them (an offset, or none) */
function relogios(headers: readonly string[], columns: ColumnMap): (string | null)[] {
  return headerClocks(headers, columns).map((c) => (c && 'offset' in c ? c.offset : null))
}

/** The model's fields on this file's names: a name it knows and ignores → 'ignorar'; a name it does not know → null and «nova» */
function colunasDoModelo(headers: readonly string[], template: Template): { colunas: ColunaUi[]; novas: boolean[] } {
  const fields = columnsFromTemplate(headers, template)
  const novas = headers.map((h) => template.headers.indexOf(h) < 0)
  return { colunas: fields.map((f, i) => (f !== null ? f : novas[i] ? null : 'ignorar')), novas }
}

/** The pre-fill from the column names, per row kind (B0: null stays null; L1 adds the «Ignorar» pre-set, §5.3) */
function colunasDosNomes(lido: SniffedFile, kind: RowKind, market: AccountMarket, values: ValueContext): ColunaUi[] {
  return suggestColumns(lido.headers, kind, market, values)
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

/** The decimal and date decisions over the columns `m` maps for its row kind */
function decisoes(lido: SniffedFile, columns: ColumnMap): { decimal: DecimalDecision; datas: DateOrderDecision } {
  return { decimal: sniffDecimalMark(lido.records, columns, lido.delimiter), datas: sniffDateOrder(lido.records, columns) }
}

/** The model matched (exact or changed), or null */
const modeloDe = (match: TemplateMatch): Template | null => (match.kind === 'none' ? null : match.template)

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
 *   none                                → rowKind = suggestRowKind; colunas[k] = suggestColumns(headers, k, market, values) for
 *                                         both kinds (null stays null in B0: L1 adds the «Ignorar» pre-set, §5.3); decimal over
 *                                         the mapped number columns, decimalMark = decided ?? question?.preselect ?? (question ?
 *                                         null : fallback); datas over the mapped date columns, dateOrder = decided (null while
 *                                         `ask`); resultIsNet = netQuestion(…)?.preanswer ?? null; origem 'nomes', salvar true,
 *                                         nome = nomePadrao = ctx.nomePadrao.
 * endOfFile {}, accountValue null, mudando false, sideWords/openCloseWords {} (or the model's), separador = lido.delimiter;
 * inicio 'mapa' and porModelo false but for the first case.
 */
export function iniciarMapeamento(
  arquivo: ArquivoMapeavel,
  ctx: { market: AccountMarket; templates: readonly Template[]; nomePadrao: string },
): InicioMapeamento {
  const s = sniffFile(arquivo.text)
  if (!s.ok) return s
  const lido: SniffedFile = {
    delimiter: s.delimiter,
    headerSkip: s.headerSkip,
    headerLine: s.headerLine,
    rawHeaders: s.rawHeaders,
    headers: s.headers,
    sig: s.sig,
    records: s.records,
  }
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
    let m: Mapeamento = {
      ...base,
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
      nome: modelo.name,
      nomePadrao: modelo.name,
    }
    m = { ...m, resultIsNet: modelo.resultIsNet ?? preResposta(m, market) }
    const misfits =
      match.kind === 'exact'
        ? templateMisfits(modelo, {
            delimiter: lido.delimiter,
            headerSkip: lido.headerSkip,
            decimalDecided: decimal.decided,
            dateOrderDecided: datas.decided,
          })
        : ['changed']
    if (misfits.length > 0 || bloqueioDoMapa(m, market) !== null) return { ok: true, mapeamento: m }
    const f = arquivoDoMapeamento(m, market, null)
    const pergunta = !f.ok || bloqueioDoConferir(m, market) !== null || (f.rowKind === 'fill' && f.endOfFile.length > 0)
    return { ok: true, mapeamento: { ...m, porModelo: true, inicio: pergunta ? 'conferir' : 'previa' } }
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
  return { ok: true, mapeamento: { ...m, resultIsNet: preResposta(m, market) } }
}

/** The net question's pre-answer for `m`'s mapping (trade files: the prices settle it), or null */
function preResposta(m: Mapeamento, market: AccountMarket): boolean | null {
  if (m.rowKind !== 'trade') return null
  const choices = { ...escolhasDe(m), resultIsNet: null }
  if (!netAsked(choices.rowKind, choices.columns)) return null
  return netQuestion(m.lido.records, mappedContext(choices, market, relogios(choices.headers, choices.columns)))?.preanswer ?? null
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
    tzHint: modelo ? modelo.tzHint : null,
    fileTz,
  })
}

/**
 * «Mudar colunas» (E34, on «Prévia» or «conferir»): porModelo false, origem 'modelo', mudando true (title «Mude as colunas
 * do modelo “{nome}”.»), the model block «Atualizar o modelo “{nome}”» checked; every answer kept
 */
export function mudarColunas(m: Mapeamento): Mapeamento {
  return { ...m, porModelo: false, origem: 'modelo', mudando: true, salvar: true }
}

/** What to save after the commit (E46), or null when nothing is saved («Salvar …» unchecked: «Colunas usadas só neste arquivo.») */
export interface ModeloASalvar {
  payload: TemplatePayloadV1
  /** p_replaces: the model «Atualizar o modelo» re-keys; null for a new model and for a touch */
  replaces: string | null
  /** 'salvo' (origem 'nomes'), 'atualizado' (origem 'modelo', not porModelo), 'tocado' (porModelo: no end line) */
  tipo: 'salvo' | 'atualizado' | 'tocado'
  nome: string
}

/**
 * templatePayload(escolhasDe(m) + name = m.nome.trim() || m.nomePadrao, accountRoutes = the model's routes + the one for
 * `rota` (accountRouteHash(valor) → contaId; routes only when a column is «Conta», at most 50: a 51st is not added),
 * tzHint). checkTemplate(payload) must be null for any mapping bloqueioDoMapa / bloqueioDoConferir let through (tested).
 */
export function modeloASalvar(
  m: Mapeamento,
  ctx: { tzHint: string | null; rota: { valor: string; contaId: string } | null },
): ModeloASalvar | null {
  if (!m.salvar) return null
  const choices = escolhasDe(m)
  const modelo = modeloDe(m.match)
  const tipo: ModeloASalvar['tipo'] = m.porModelo ? 'tocado' : m.origem === 'nomes' ? 'salvo' : 'atualizado'
  const name = m.nome.trim() || m.nomePadrao
  const routes: Record<string, string> = {}
  if (choices.columns.indexOf('account') >= 0) {
    if (modelo) Object.assign(routes, modelo.accountRoutes)
    if (ctx.rota) {
      const hash = accountRouteHash(ctx.rota.valor)
      if (Object.prototype.hasOwnProperty.call(routes, hash) || Object.keys(routes).length < MAX_ROUTES) routes[hash] = ctx.rota.contaId
    }
  }
  return {
    payload: templatePayload({ ...choices, name, accountRoutes: routes, tzHint: ctx.tzHint }),
    replaces: tipo === 'atualizado' && modelo ? modelo.id : null,
    tipo,
    nome: name,
  }
}

/**
 * «Continuar» on «mapa» (E19): the first hint that blocks, or null. B0 checks, in this order: separador ≠ lido.delimiter
 * (DICA_MAPA.ler); datas.ask and dateOrder null (DICA_MAPA.datas); decimal.question and decimalMark null
 * (DICA_MAPA.numeros); missingRequirements (DICA_MAPA.obrigatorias); mappingProblems duplicate_field (DICA_MAPA.umaColuna);
 * swap_without_pnl (DICA_MAPA.marcadas); a word of the «Lado» column that unknownSideWords finds and m.sideWords does not
 * answer (DICA_MAPA.lado(the first)): iniciarMapeamento's `inicio` needs it at B0. L1 completes it (§5.6: the E17 checks,
 * the tick nota) without changing the order of these.
 */
export function bloqueioDoMapa(m: Mapeamento, market: AccountMarket): string | null {
  if (m.separador !== m.lido.delimiter) return DICA_MAPA.ler
  if (m.datas.ask && m.dateOrder === null) return DICA_MAPA.datas
  if (m.decimal.question && m.decimalMark === null) return DICA_MAPA.numeros
  const columns = paraODominio(m.colunas[m.rowKind])
  const mark = m.decimalMark ?? m.decimal.fallback
  const qtd = columns.indexOf('quantity')
  const signed = qtd >= 0 && quantityIsSigned(m.lido.records, qtd, mark)
  if (missingRequirements(m.rowKind, columns, signed).length > 0) return DICA_MAPA.obrigatorias
  const problems = mappingProblems(m.rowKind, market, columns)
  if (problems.some((p) => p.code === 'duplicate_field')) return DICA_MAPA.umaColuna
  if (problems.some((p) => p.code === 'swap_without_pnl')) return DICA_MAPA.marcadas
  const lado = columns.indexOf('side')
  if (lado >= 0) {
    const palavra = unknownSideWords(m.lido.records, lado, m.sideWords)[0]
    if (palavra) return DICA_MAPA.lado(palavra.text)
  }
  return null
}

/** «Usar estas colunas» on «conferir» (E28, E29). B0: null. L1: §5.6 */
export function bloqueioDoConferir(m: Mapeamento, market: AccountMarket): string | null {
  return null
}

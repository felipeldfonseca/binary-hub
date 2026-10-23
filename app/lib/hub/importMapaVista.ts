/**
 * Phase 3b · telas, lane L1: what «mapa» and «conferir» show (contract §5.4, §5.5), as data. Every text, chip, note,
 * check, question and row of elements E7–E29 of the approved board ImportarConta comes from here; PassoMapa and
 * PassoConferir only render it and call the edits of lib/hub/importMapeado. Pure: cells and header names are read in the
 * browser to be shown, never sent, stored or logged.
 */
import {
  FIELD_KIND,
  dateOrderEvidence,
  decimalEvidence,
  fieldsFor,
  hasBuySellPair,
  headerClock,
  mappingProblems,
  missingRequirements,
  parseAmountCell,
  quantityIsSigned,
  readDateTime,
  readSide,
  readSymbol,
  requirementsOf,
  toDecimal,
  unknownSideWords,
  accountKey,
  type CsvDelimiter,
  type CsvRecord,
  type DateOrder,
  type DecimalMark,
  type EndOfFileAnswer,
  type EndOfFileQuestion,
  type FieldKey,
  type MappedFile,
  type MappedPosition,
  type Num,
  type Requirement,
  type RowKind,
  type SideWordAnswer,
} from '@/lib/domain/import'
import { currencyOf, type AccountMarket } from '@/lib/domain/markets'
import { formatDayMonth, formatMoney } from '@/lib/hub/formato'
import {
  arquivoDeTodasAsContas,
  bloqueioDoConferir,
  bloqueioDoMapa,
  checagemDaColuna,
  escolhasDe,
  foraDoPasso,
  idsQueSeRepetem,
  notaDeLeitura,
  perguntaDoLiquido,
  quantidadeComSinal,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import {
  CAMPO,
  CHECAGEM,
  CONFERIR,
  FIM_ARQUIVO,
  LER,
  LIQUIDO,
  MAPA,
  MODELO,
  NOTA_MAPA,
  PAREAMENTO,
  PERGUNTA,
  REQ,
  type SobraTexto,
} from '@/components/hub/importar/copyMapa'

// ------------------------------------------------------------------------------------------------
// Shapes
// ------------------------------------------------------------------------------------------------

/** One pill of a group (aria-pressed) */
export interface PilulaVista<V> {
  valor: V
  rotulo: string
  /** The separator pills' names («Ponto e vírgula»); null elsewhere */
  aria: string | null
  pressionada: boolean
}

/** One question block (`.hub-bloco.hub-pergunta`, amber when `atencao`): title, sub, pills, nota */
export interface PerguntaVista<V> {
  /** The title's id, which the pill group is labelled by */
  id: string
  /** What the answer is given under: a side word's key, an end-of-file key; '' for the others */
  chave: string
  texto: string
  sub: string | null
  atencao: boolean
  opcoes: PilulaVista<V>[]
  nota: string | null
}

export interface ObrigatoriaVista {
  texto: string
  ok: boolean
}

export interface ColunaVista {
  indice: number
  /** The header as written */
  nome: string
  tag: string | null
  /** «ex.: …» */
  amostra: string
  /** The select's value: '' («Escolha…»), a field, or 'ignorar' */
  valor: string
  opcoes: { valor: string; rotulo: string }[]
  aria: string
  checagem: string | null
  checagemId: string
}

export interface VistaMapa {
  titulo: string
  /** «Separador: … · decimal …» */
  lerTexto: string
  /** «Datas: …», or null */
  datasTexto: string | null
  separadores: PilulaVista<CsvDelimiter>[]
  /** The panel's «Decimal» pills, only when the file decided the mark */
  decimais: PilulaVista<DecimalMark>[] | null
  /** The panel's «Datas» pills, only when the file decided the order */
  ordens: PilulaVista<DateOrder>[] | null
  /** E10 */
  notaLer: string | null
  /** E11 */
  perguntaDatas: PerguntaVista<DateOrder> | null
  /** E12 */
  perguntaDecimal: PerguntaVista<DecimalMark> | null
  /** E13 */
  modos: PilulaVista<RowKind>[]
  /** E14 */
  obrigatorias: ObrigatoriaVista[]
  opcionais: string
  /** E15, in the board's order */
  notas: string[]
  /** E16 */
  duplicadas: string | null
  /** E17 */
  colunas: ColunaVista[]
  /** E18 */
  perguntasLado: PerguntaVista<SideWordAnswer>[]
  /** E19's hint, or null */
  bloqueio: string | null
  /** What the sheet's live region says on «mapa» (E10, E12's nota, E16), or '' */
  anuncio: string
}

export interface PareamentoVista {
  /** «Viram 4 operações: …» */
  resumo: string
  /** «1ª operação: …», none without operations */
  primeira: string | null
  /** «1 posição com mais de uma entrada virou …» */
  entradas: string | null
  /** «Ver as 4 operações» / «Ver a operação», none without operations */
  ver: string | null
  operacoes: string[]
}

export interface ModeloVista {
  /** «Salvar como modelo» / «Atualizar o modelo “…”» */
  rotulo: string
  salvar: boolean
  /** «Nome do modelo» shown (a new model being saved) */
  comNome: boolean
  nome: string
  nota: string
}

export interface VistaConferir {
  titulo: string
  /** «Entrada · Ativo · Lado · Quantidade · Resultado» */
  ordem: string
  /** E29: the mapping cannot make the file (the alert in place of the rows) */
  falha: string | null
  /** E22: the items of each row shown */
  linhas: string[][]
  /** E23 */
  notas: string[]
  /** E24 */
  perguntasFim: PerguntaVista<EndOfFileAnswer>[]
  /** E25 (execution files) */
  pareamento: PareamentoVista | null
  /** E26 */
  liquido: PerguntaVista<'sim' | 'nao'> | null
  /** E27, none for a model taken as is */
  modelo: ModeloVista | null
  /** E34's model name when the file starts here with a model taken as is (the chip in place of E27) */
  chipModelo: string | null
  /** E28's hint, or null */
  bloqueio: string | null
}

// ------------------------------------------------------------------------------------------------
// Numbers, money and dates in pt-BR (§3.4)
// ------------------------------------------------------------------------------------------------

const MENOS = '−'
const ZERO = BigInt(0)
const DEZ = BigInt(10)

/** A decimal string ('-1234.50') in pt-BR digits: «−1.234,50» (grouped) or «−1234,50» */
function emPt(decimal: string, agrupar = true): string {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim())
  if (!m) return decimal
  const inteiro = agrupar ? m[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.') : m[2]
  const zero = /^0*$/.test(m[2]) && /^0*$/.test(m[3] ?? '')
  return `${m[1] === '-' && !zero ? MENOS : ''}${inteiro}${m[3] ? `,${m[3]}` : ''}`
}

/** A decimal with exactly `casas` decimals when its extra digits are zeros (trailing zeros dropped down to it), padded below it */
function comCasas(decimal: string, casas: number): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim())
  if (!m) return decimal
  let frac = m[3] ?? ''
  while (frac.length > casas && frac.charAt(frac.length - 1) === '0') frac = frac.slice(0, -1)
  while (frac.length < casas) frac += '0'
  return `${m[1]}${m[2]}${frac ? `.${frac}` : ''}`
}

/** A decimal without trailing zeros ('0.1000' → '0.1', '2.00' → '2') */
const semZeros = (decimal: string) => (decimal.indexOf('.') >= 0 ? decimal.replace(/0+$/, '').replace(/\.$/, '') : decimal)

/** |x| of a decimal string */
const absoluto = (decimal: string) => decimal.replace(/^[+-]/, '')

/** A cell's number with the file's mark, as a decimal string with the decimals it wrote; null when it is no number */
function numeroDaCelula(cell: string, mark: DecimalMark): { num: Num; decimal: string; ativo: string | null } | null {
  const { num, asset } = parseAmountCell(cell, mark)
  if (!num) return null
  return { num, decimal: toDecimal(num, num.scale), ativo: asset }
}

/** A Num's value equals 1 */
const ehUm = (n: Num) => n.units === pow10(n.scale)

function pow10(n: number): bigint {
  let r = BigInt(1)
  for (let i = 0; i < n; i++) r *= DEZ
  return r
}

/** A decimal string as integer units at `scale` (no rounding: callers pass the larger scale) */
function unidades(decimal: string, scale: number): bigint {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal)
  if (!m) return ZERO
  const frac = (m[3] ?? '').padEnd(scale, '0').slice(0, scale)
  const v = BigInt(m[2] + frac)
  return m[1] === '-' ? -v : v
}

const casasDe = (decimal: string) => (decimal.indexOf('.') >= 0 ? decimal.length - decimal.indexOf('.') - 1 : 0)

/** Money: «+US$ 57,50», «−R$ 31,00» (signed) or «US$ 2,48» */
const dinheiro = (decimal: string, market: AccountMarket, signed = true) => formatMoney(decimal, { signed, currency: currencyOf(market) })

/** A wall clock «2026-10-01T09:34:31» as «1 out, 09:34» (the file's own clock, §3.4.3) */
function quando(local: string): string {
  return `${formatDayMonth(local.slice(0, 10))}, ${local.slice(11, 16)}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// ------------------------------------------------------------------------------------------------
// Cells
// ------------------------------------------------------------------------------------------------

/** The column of a field in `m`'s mapping, or -1 */
const colunaDe = (m: Mapeamento, campo: FieldKey) => m.colunas[m.rowKind].indexOf(campo)

const celula = (rec: CsvRecord, i: number) => (i < 0 ? '' : (rec.cells[i] ?? '').trim())

/** The column's first non-empty cell among the data records, as written («ex.: —» when every cell is empty) */
function amostraDaColuna(m: Mapeamento, i: number): string {
  for (const r of m.lido.records) {
    const c = celula(r, i)
    if (c) return c
  }
  return CHECAGEM.vazia
}

/** The most decimals the column's cells were written with (the positions' quantities and prices show as many) */
function casasDaColuna(m: Mapeamento, campo: FieldKey, mark: DecimalMark): number {
  const i = colunaDe(m, campo)
  let casas = 0
  if (i < 0) return casas
  for (const r of m.lido.records) {
    const n = numeroDaCelula(celula(r, i), mark)
    if (n && n.num.scale > casas) casas = n.num.scale
  }
  return casas
}

// ------------------------------------------------------------------------------------------------
// «mapa»
// ------------------------------------------------------------------------------------------------

const NOME_SEPARADOR: Record<CsvDelimiter, string> = { ';': LER.nomePontoEVirgula, ',': LER.nomeVirgula, '\t': LER.nomeTabulacao }
const SEPARADORES: [CsvDelimiter, string, string][] = [
  [';', LER.pillPontoEVirgula, LER.ariaPontoEVirgula],
  [',', LER.pillVirgula, LER.ariaVirgula],
  ['\t', LER.pillTab, LER.ariaTabulacao],
]

/** The model's name (a matched model), or the name typed */
const nomeDoModelo = (m: Mapeamento) => (m.match.kind === 'none' ? m.nome : m.match.template.name)

/** E7 */
function tituloDoMapa(m: Mapeamento): string {
  if (m.origem === 'nomes') return MAPA.titulo
  return m.mudando ? MAPA.tituloMudar(nomeDoModelo(m)) : MAPA.tituloMudou(nomeDoModelo(m))
}

/** E11: the first mapped date cell both orders read («09.10.2026 …»), its day and month as written */
function perguntaDasDatas(m: Mapeamento): PerguntaVista<DateOrder> | null {
  if (!m.datas.ask) return null
  const datas: number[] = []
  m.colunas[m.rowKind].forEach((c, i) => {
    if (c !== null && c !== 'ignorar' && FIELD_KIND[c] === 'date') datas.push(i)
  })
  let ex: RegExpExecArray | null = null
  for (const r of m.lido.records) {
    for (const i of datas) {
      const c = celula(r, i)
      if (c && dateOrderEvidence(c) === 'either') ex = /^(\d{1,2})([-./])(\d{1,2})/.exec(c)
      if (ex) break
    }
    if (ex) break
  }
  const rotulo = (ordem: DateOrder): string => {
    if (!ex) return ordem === 'dmy' ? LER.diaMes : LER.mesDia
    const a = Number(ex[1])
    const b = Number(ex[3])
    const [dia, mes] = ordem === 'dmy' ? [a, b] : [b, a]
    const texto = `${ex[1]}${ex[2]}${ex[3]}`
    const data = `${dia} ${MESES[mes - 1] ?? ''}`
    return ordem === 'dmy' ? PERGUNTA.dataDiaMes(texto, data) : PERGUNTA.dataMesDia(texto, data)
  }
  return {
    id: 'q-datas',
    chave: '',
    texto: PERGUNTA.datas,
    sub: null,
    atencao: true,
    opcoes: (['dmy', 'mdy'] as DateOrder[]).map((o) => ({ valor: o, rotulo: rotulo(o), aria: null, pressionada: m.dateOrder === o })),
    nota: null,
  }
}

/** E12: the domain's sample read with each mark (comma first), the value in pt-BR digits without grouping */
function perguntaDoDecimal(m: Mapeamento, market: AccountMarket): PerguntaVista<DecimalMark> | null {
  const q = m.decimal.question
  if (!q) return null
  const ponto = q.sample.lastIndexOf('.') > q.sample.lastIndexOf(',')
  const parenteses = (mark: DecimalMark) =>
    ponto
      ? mark === 'comma'
        ? PERGUNTA.pontoMilhar
        : PERGUNTA.pontoDecimal
      : mark === 'comma'
        ? PERGUNTA.virgulaDecimal
        : PERGUNTA.virgulaMilhar
  const passo = foraDoPasso(m, market)
  return {
    id: 'q-dec',
    chave: '',
    texto: PERGUNTA.decimal,
    sub: null,
    atencao: true,
    opcoes: q.readings.map((r) => ({
      valor: r.mark,
      rotulo: r.value !== null ? PERGUNTA.leitura(q.sample, emPt(semZeros(r.value), false), parenteses(r.mark)) : PERGUNTA.leituraSo(q.sample, parenteses(r.mark)),
      aria: null,
      pressionada: m.decimalMark === r.mark,
    })),
    nota: passo ? PERGUNTA.decimalPasso(passo.raiz, passo.passo) : null,
  }
}

/** E14's labels */
function obrigatorias(m: Mapeamento): ObrigatoriaVista[] {
  const columns = escolhasDe(m).columns
  const faltam = missingRequirements(m.rowKind, columns, quantidadeComSinal(m))
  const par = m.rowKind === 'trade' && hasBuySellPair(columns)
  const mark = m.decimalMark ?? m.decimal.fallback
  const k = m.rowKind
  let colunaComSinal = false
  m.lido.headers.forEach((_, i) => {
    if ((m.sugeridas[k][i] === 'quantity' || m.colunas[k][i] === 'quantity') && quantityIsSigned(m.lido.records, i, mark)) colunaComSinal = true
  })
  const rotulo: Record<Requirement, string> = {
    entry: par && columns.indexOf('entry_time') < 0 ? REQ.entradaPar : REQ.entrada,
    time: REQ.dataHora,
    symbol: REQ.ativo,
    side: par ? REQ.ladoPar : colunaComSinal ? REQ.ladoSinal : REQ.lado,
    quantity: REQ.quantidade,
    result: REQ.resultado,
    price: REQ.preco,
  }
  return requirementsOf(m.rowKind).map((r) => {
    const ok = faltam.indexOf(r) < 0
    return { texto: ok ? REQ.ok(rotulo[r]) : REQ.falta(rotulo[r]), ok }
  })
}

/** An offset as the note names it: «UTC», «UTC+1», «UTC−3», «UTC+5:30» */
function nomeDoFuso(offset: string): string {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset)
  if (!m) return offset
  const h = Number(m[2])
  const mi = Number(m[3])
  if (h === 0 && mi === 0) return 'UTC'
  return `UTC${m[1] === '-' ? MENOS : '+'}${h}${mi ? `:${m[3]}` : ''}`
}

/** Accounting parentheses («$(13.75)», «(39,98)») */
const PARENTESES = /^(?:US\$|R\$|\$)?\((.+)\)$/i

/** E15's notes, in the board's order */
function notasDoMapa(m: Mapeamento, market: AccountMarket): string[] {
  const columns = escolhasDe(m).columns
  const tem = (f: FieldKey) => columns.indexOf(f) >= 0
  const trade = m.rowKind === 'trade'
  const par = trade && hasBuySellPair(columns)
  const notas: string[] = []
  if (!trade) notas.push(NOTA_MAPA.execucao)
  if (!tem('side') && quantidadeComSinal(m)) notas.push(NOTA_MAPA.semLado)
  if (trade && !tem('side') && par) notas.push(NOTA_MAPA.compraVenda)
  if ((trade && !tem('pnl')) || (!trade && !tem('realized'))) notas.push(NOTA_MAPA.semResultado[market])
  if (trade && !tem('exit_time') && !par) notas.push(NOTA_MAPA.semSaida)
  if (!tem('trade_id') && !tem('fill_id')) notas.push(NOTA_MAPA.semId)

  // 7 · the file's own: a time column whose header states the clock
  columns.forEach((f, i) => {
    if (f === null || FIELD_KIND[f] !== 'date') return
    const relogio = headerClock(m.lido.rawHeaders[i] ?? '')
    if (relogio && 'offset' in relogio) notas.push(NOTA_MAPA.fusoDaColuna(m.lido.rawHeaders[i], nomeDoFuso(relogio.offset)))
  })
  // 7b · the decimal mark the deciding cells set, with the first cell either mark reads
  if (m.decimal.decided !== null) {
    const numeros: number[] = []
    columns.forEach((f, i) => {
      if (f !== null && FIELD_KIND[f] === 'number') numeros.push(i)
    })
    let decide: string | null = null
    let ambigua: string | null = null
    for (const r of m.lido.records) {
      for (const i of numeros) {
        const c = celula(r, i)
        if (!c) continue
        const e = decimalEvidence(c)
        if (decide === null && e === m.decimal.decided) decide = c
        if (ambigua === null && e === 'ambiguous') ambigua = c
      }
      if (decide !== null && ambigua !== null) break
    }
    const lida = ambigua !== null ? numeroDaCelula(ambigua, m.decimal.decided) : null
    if (decide !== null && ambigua !== null && lida) {
      const marca = m.decimal.decided === 'comma' ? LER.decimalVirgula : LER.decimalPonto
      notas.push(NOTA_MAPA.decimalPelos(marca, decide, ambigua, emPt(lida.decimal, false)))
    }
  }
  // 7c · a loss written in parentheses in the result column
  const resultado = columns.indexOf(trade ? 'pnl' : 'realized')
  if (resultado >= 0) {
    const mark = m.decimalMark ?? m.decimal.fallback
    for (const r of m.lido.records) {
      const c = celula(r, resultado)
      if (!PARENTESES.test(c.replace(/\s+/g, ''))) continue
      const n = numeroDaCelula(c, mark)
      if (n) notas.push(NOTA_MAPA.perda(c, emPt(n.decimal)))
      break
    }
  }
  // 7d · the IDs the pre-fill left out because they repeat
  const repetidas = idsQueSeRepetem(m, market)
  if (repetidas.length > 0) notas.push(NOTA_MAPA.idsRepetem(repetidas.map((i) => m.lido.rawHeaders[i])))
  // 8
  if (m.origem === 'nomes' && m.sugeridas[m.rowKind].some((x) => x !== null)) notas.push(NOTA_MAPA.sugerimos)
  return notas
}

const TEXTO_CHECAGEM: Record<string, string> = {
  not_date: CHECAGEM.naoData,
  not_number: CHECAGEM.naoNumero,
  not_side: CHECAGEM.naoLado,
  repeats: CHECAGEM.repete,
  swap: CHECAGEM.swap,
}

/** E17 */
function colunasDoMapa(m: Mapeamento, market: AccountMarket): ColunaVista[] {
  const k = m.rowKind
  const oferecidos = fieldsFor(k, market)
  return m.lido.headers.map((_, i) => {
    const v = m.colunas[k][i]
    const nome = m.lido.rawHeaders[i] ?? m.lido.headers[i]
    const opcoes = [{ valor: '', rotulo: CHECAGEM.escolha }, ...oferecidos.map((f) => ({ valor: f as string, rotulo: CAMPO[f] }))]
    // A model's field this row kind or market does not offer still shows (and blocks: «Confira as colunas marcadas.»)
    if (v !== null && v !== 'ignorar' && oferecidos.indexOf(v) < 0) opcoes.push({ valor: v, rotulo: CAMPO[v] })
    opcoes.push({ valor: 'ignorar', rotulo: CHECAGEM.ignorar })
    const chk = checagemDaColuna(m, i)
    const tag = m.novas[i] ? CHECAGEM.nova : m.origem === 'nomes' && v !== null && v === m.sugeridas[k][i] ? CHECAGEM.sugerida : null
    return {
      indice: i,
      nome,
      tag,
      amostra: CHECAGEM.amostra(amostraDaColuna(m, i)),
      valor: v ?? '',
      opcoes,
      aria: CHECAGEM.aria(nome),
      checagem: chk ? TEXTO_CHECAGEM[chk] : null,
      checagemId: `chk-${i}`,
    }
  })
}

/** E18: one question per word of the «Lado» column the app does not know (an answered one stays, its pill pressed) */
function perguntasDoLado(m: Mapeamento): PerguntaVista<SideWordAnswer>[] {
  const lado = colunaDe(m, 'side')
  if (lado < 0) return []
  return unknownSideWords(m.lido.records, lado).map((w, j) => ({
    id: `q-lado-${j}`,
    chave: w.word,
    texto: PERGUNTA.lado(w.rows, w.text),
    sub: null,
    atencao: true,
    opcoes: ([
      ['buy', PERGUNTA.compra],
      ['sell', PERGUNTA.venda],
      ['skip', PERGUNTA.pular],
    ] as [SideWordAnswer, string][]).map(([valor, rotulo]) => ({ valor, rotulo, aria: null, pressionada: m.sideWords[w.word] === valor })),
    nota: null,
  }))
}

/** E16's text: the fields in two columns or more, in field order */
function duplicadasDe(m: Mapeamento, market: AccountMarket): string | null {
  const dups = mappingProblems(m.rowKind, market, escolhasDe(m).columns)
    .filter((p): p is { code: 'duplicate_field'; field: FieldKey } => p.code === 'duplicate_field')
    .map((p) => CAMPO[p.field])
  return dups.length > 0 ? CHECAGEM.duplicadas(dups) : null
}

/** What the sheet's live region says on «mapa» (§5.8): E10's note, else E12's tick nota, else E16's text; '' for none */
export function anuncioDoMapa(m: Mapeamento, market: AccountMarket): string {
  const passo = foraDoPasso(m, market)
  return notaDeLeitura(m) ?? (passo ? PERGUNTA.decimalPasso(passo.raiz, passo.passo) : null) ?? duplicadasDe(m, market) ?? ''
}

/**
 * «mapa» as data (§5.4): the title, the reading chips and the «Mudar» panel, the reading note, the date and decimal
 * questions, «Cada linha do arquivo é», «Obrigatórias», the notes, the duplicate block, one row per column, the side-word
 * questions, the hint and what the live region says. `arquivo` is the text «Separador» re-reads (PassoMapa's edit).
 */
export function vistaMapa(m: Mapeamento, arquivo: ArquivoMapeavel | null, market: AccountMarket): VistaMapa {
  void arquivo
  const separador = LER.separador(NOME_SEPARADOR[m.separador])
  const lerTexto =
    m.decimalMark !== null && m.decimal.question === null
      ? LER.comDecimal(separador, m.decimalMark === 'comma' ? LER.decimalVirgula : LER.decimalPonto)
      : separador
  const notaLer = notaDeLeitura(m)
  const perguntaDecimal = perguntaDoDecimal(m, market)
  const duplicadas = duplicadasDe(m, market)
  return {
    titulo: tituloDoMapa(m),
    lerTexto,
    datasTexto: m.dateOrder ? LER.datas(m.dateOrder === 'dmy' ? LER.diaMes : LER.mesDia) : null,
    separadores: SEPARADORES.map(([valor, rotulo, aria]) => ({ valor, rotulo, aria, pressionada: m.separador === valor })),
    decimais:
      m.decimal.decided !== null
        ? ([
            ['comma', LER.decimalVirgula],
            ['point', LER.decimalPonto],
          ] as [DecimalMark, string][]).map(([valor, rotulo]) => ({ valor, rotulo, aria: null, pressionada: m.decimalMark === valor }))
        : null,
    ordens:
      m.datas.decided !== null
        ? ([
            ['dmy', LER.diaMes],
            ['mdy', LER.mesDia],
          ] as [DateOrder, string][]).map(([valor, rotulo]) => ({ valor, rotulo, aria: null, pressionada: m.dateOrder === valor }))
        : null,
    notaLer,
    perguntaDatas: perguntaDasDatas(m),
    perguntaDecimal,
    modos: ([
      ['trade', MAPA.modoOperacao],
      ['fill', MAPA.modoExecucao],
    ] as [RowKind, string][]).map(([valor, rotulo]) => ({ valor, rotulo, aria: null, pressionada: m.rowKind === valor })),
    obrigatorias: obrigatorias(m),
    opcionais: m.rowKind === 'trade' ? REQ.opcionaisOperacao(fieldsFor('trade', market).indexOf('swap') >= 0) : REQ.opcionaisExecucao,
    notas: notasDoMapa(m, market),
    duplicadas,
    colunas: colunasDoMapa(m, market),
    perguntasLado: perguntasDoLado(m),
    bloqueio: bloqueioDoMapa(m, market),
    anuncio: notaLer ?? perguntaDecimal?.nota ?? duplicadas ?? '',
  }
}

// ------------------------------------------------------------------------------------------------
// «conferir»
// ------------------------------------------------------------------------------------------------

/** A quantity cell with its unit by market (D9): «2 contratos», «0,50 lote», «50 ações», «0,0125 BTC» */
function quantidadeDaCelula(cell: string, symbol: string, market: AccountMarket, mark: DecimalMark): string {
  if (!cell) return CONFERIR.vazio
  const n = numeroDaCelula(cell, mark)
  if (!n) return cell
  const abs = { ...n.num, neg: false, sign: null }
  if (market === 'forex') {
    const q = toDecimal(abs, 2)
    return Number(q) < 2 ? CONFERIR.lote(emPt(q)) : CONFERIR.lotes(emPt(q))
  }
  const q = emPt(toDecimal(abs, abs.scale))
  if (market === 'stocks' || market === 'options') return ehUm(abs) ? CONFERIR.acao(q) : CONFERIR.acoes(q)
  if (market === 'crypto') return CONFERIR.moeda(q, n.ativo ?? baseDoPar(symbol))
  return ehUm(abs) ? CONFERIR.contrato(q) : CONFERIR.contratos(q)
}

/** A crypto pair's base: the symbol without its dollar quote («ETHUSDT» → «ETH») */
const baseDoPar = (symbol: string) => symbol.toUpperCase().replace(/(USDT|USDC|USD)$/, '')

const ladoEmTexto = (s: SideWordAnswer | null): string | null => (s === 'buy' ? CONFERIR.compra : s === 'sell' ? CONFERIR.venda : null)

/** E22: one record read as the mapping reads it */
function itensDaLinha(m: Mapeamento, rec: CsvRecord, market: AccountMarket, f: MappedFile | null): string[] {
  const mark = m.decimalMark ?? m.decimal.fallback
  const cel = (campo: FieldKey) => celula(rec, colunaDe(m, campo))
  const trade = m.rowKind === 'trade'
  const columns = escolhasDe(m).columns
  const par = trade && hasBuySellPair(columns)
  const ler = (c: string) => (c ? readDateTime(c, m.dateOrder) : null)

  // Time: the entry (or the first of the buy and the sell), the execution's
  let hora: string | null = null
  let ladoDoPar: SideWordAnswer | null = null
  if (!trade) hora = cel('time')
  else if (colunaDe(m, 'entry_time') >= 0) hora = cel('entry_time')
  if (par) {
    const b = ler(cel('buy_time'))
    const s = ler(cel('sell_time'))
    if (b && s) {
      const compraAntes = b.local <= s.local
      ladoDoPar = compraAntes ? 'buy' : 'sell'
      if (hora === null) hora = compraAntes ? cel('buy_time') : cel('sell_time')
    }
  }
  const stamp = hora ? ler(hora) : null
  const quandoTxt = stamp ? quando(stamp.local) : CONFERIR.vazio

  const simbolo = cel('symbol') || CONFERIR.vazio

  // Side: the side column (a word nobody answered as written), the pair's first time, the quantity's sign
  let lado = CONFERIR.vazio
  const qtdCel = cel('quantity')
  if (colunaDe(m, 'side') >= 0) {
    const c = cel('side')
    lado = c ? ladoEmTexto(readSide(c, m.sideWords)) ?? c : CONFERIR.vazio
  } else if (par) {
    lado = ladoEmTexto(ladoDoPar) ?? CONFERIR.vazio
  } else if (quantidadeComSinal(m)) {
    const n = numeroDaCelula(qtdCel, mark)
    lado = n && n.num.units !== ZERO ? (n.num.neg ? CONFERIR.venda : CONFERIR.compra) : CONFERIR.vazio
  }

  const symbolRead = readSymbol(cel('symbol'), market)
  const quantidade = quantidadeDaCelula(qtdCel, symbolRead.ok ? symbolRead.symbol : cel('symbol'), market, mark)

  if (!trade) {
    const p = numeroDaCelula(cel('price'), mark)
    return [quandoTxt, simbolo, lado, quantidade, p ? emPt(p.decimal) : CONFERIR.vazio]
  }
  let resultado: string
  if (colunaDe(m, 'pnl') >= 0) {
    const r = numeroDaCelula(cel('pnl'), mark)
    resultado = r ? dinheiro(r.decimal, market) : CONFERIR.vazio
  } else {
    const row = f ? f.rows.find((x) => x.line === rec.line) : undefined
    resultado = row && (row.pnl_basis === 'prices' || row.pnl_basis === 'estimate') ? CONFERIR.comPelosPrecos(dinheiro(row.pnl, market)) : CONFERIR.pelosPrecos
  }
  return [quandoTxt, simbolo, lado, quantidade, resultado]
}

/** Whether an execution record has an executed quantity (a cancelled or unfilled order has none: D4) */
function executada(m: Mapeamento, rec: CsvRecord): boolean {
  const c = celula(rec, colunaDe(m, 'quantity'))
  if (!c) return false
  const n = numeroDaCelula(c, m.decimalMark ?? m.decimal.fallback)
  return !n || n.num.units !== ZERO
}

/** «MESZ6», «BTCUSDT e ETHUSDT», «A, B e C» */
const juntar = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** «A 1ª e a 2ª», «A 1ª, a 2ª e a 3ª» (the shown rows of one position) */
function ordinais(xs: number[]): string {
  const o = xs.map((x) => `${x}ª`)
  return `A ${o.length <= 1 ? o.join('') : `${o.slice(0, -1).join(', a ')} e a ${o[o.length - 1]}`}`
}

/** The quantity left at the end, as E24 writes it by market (`adjetivo`: «comprado» / «vendido»; null: the noun alone) */
function sobra(qAbs: string, market: AccountMarket, symbol: string, adjetivo: 'comprado' | 'vendido' | null): SobraTexto {
  const adj = (fem: boolean, plural: boolean) => (adjetivo === null ? '' : ` ${fem ? adjetivo.replace(/o$/, 'a') : adjetivo}${plural ? 's' : ''}`)
  if (market === 'forex') {
    const q = emPt(comCasas(qAbs, 2))
    const plural = Number(qAbs) >= 2
    return { texto: `${plural ? CONFERIR.lotes(q) : CONFERIR.lote(q)}${adj(false, plural)}`, plural, feminino: false }
  }
  const q = emPt(semZeros(qAbs))
  const um = semZeros(qAbs) === '1'
  if (market === 'stocks' || market === 'options') {
    return { texto: `${um ? CONFERIR.acao(q) : CONFERIR.acoes(q)}${adj(true, !um)}`, plural: !um, feminino: true }
  }
  if (market === 'crypto') return { texto: `${CONFERIR.moeda(q, baseDoPar(symbol))}${adj(false, true)}`, plural: true, feminino: false }
  return { texto: `${um ? CONFERIR.contrato(q) : CONFERIR.contratos(q)}${adj(false, !um)}`, plural: !um, feminino: false }
}

/** E24's nota for the question's current answer */
function notaDoFim(m: Mapeamento, q: EndOfFileQuestion, resposta: EndOfFileAnswer, f: MappedFile, market: AccountMarket): string {
  const qAbs = absoluto(q.net)
  const comprado = !q.net.startsWith('-')
  if (resposta === 'unknown') return FIM_ARQUIVO.notaNaoSei(q.fills, q.symbol)
  if (resposta === 'no') {
    return comprado
      ? FIM_ARQUIVO.notaNaoVendido(sobra(qAbs, market, q.symbol, 'vendido').texto)
      : FIM_ARQUIVO.notaNaoComprado(sobra(qAbs, market, q.symbol, 'comprado'))
  }
  // «Sim»: the executions left out as open at the end, when they are exactly what is left
  const mark = m.decimalMark ?? m.decimal.fallback
  const iSimbolo = colunaDe(m, 'symbol')
  const iConta = colunaDe(m, 'account')
  const linhas = f.errors.filter((e) => e.code === 'open_at_end').map((e) => e.line)
  const recs = m.lido.records.filter((r) => {
    if (linhas.indexOf(r.line) < 0) return false
    const s = readSymbol(celula(r, iSimbolo), market)
    if (!s.ok || s.symbol.toUpperCase() !== q.symbol.toUpperCase()) return false
    return q.account === null || iConta < 0 || accountKey(celula(r, iConta)) === accountKey(q.account)
  })
  const qtds = recs.map((r) => numeroDaCelula(celula(r, colunaDe(m, 'quantity')), mark))
  const escala = qtds.reduce((s, x) => Math.max(s, x ? x.num.scale : 0), casasDe(qAbs))
  const soma = qtds.reduce((s, x) => s + (x ? unidades(toDecimal({ ...x.num, neg: false }, x.num.scale), escala) : ZERO), ZERO)
  if (recs.length > 0 && soma === unidades(qAbs, escala)) return FIM_ARQUIVO.notaSim(recs.length)
  return FIM_ARQUIVO.notaSimParte(sobra(qAbs, market, q.symbol, null).texto)
}

/** E25 */
function pareamento(m: Mapeamento, f: MappedFile, market: AccountMarket): PareamentoVista {
  const mark = m.decimalMark ?? m.decimal.fallback
  const casasQtd = casasDaColuna(m, 'quantity', mark)
  const casasPreco = casasDaColuna(m, 'price', mark)
  const qtd = (d: string) => emPt(comCasas(d, casasQtd))
  const preco = (d: string | null) => (d === null ? CONFERIR.vazio : emPt(comCasas(d, casasPreco)))
  const partes = (p: MappedPosition) => {
    const abertura = PAREAMENTO.abertura(p.direction === 'long' ? CONFERIR.compra : CONFERIR.venda, qtd(p.quantity), preco(p.entry_price))
    const saidas =
      p.exits.length === 1
        ? PAREAMENTO.saida(qtd(p.exits[0].quantity), preco(p.exits[0].exit_price))
        : PAREAMENTO.saidas(p.exits.map((e) => PAREAMENTO.deA(qtd(e.quantity), preco(e.exit_price))))
    return { abertura, saidas, resultado: dinheiro(p.pnl, market) }
  }
  const ps = f.positions
  const uma = ps.filter((p) => p.exits.length === 1).length
  const split = f.notices.find((x): x is { code: 'split_entries'; positions: number; trades: number } => x.code === 'split_entries')
  const primeira = ps.length > 0 ? partes(ps[0]) : null
  return {
    resumo: PAREAMENTO.resumo(ps.length, uma, ps.length - uma),
    primeira: primeira ? PAREAMENTO.primeira(ps[0].symbol, primeira.abertura, primeira.saidas, primeira.resultado) : null,
    entradas: split ? PAREAMENTO.entradas(split.positions, split.trades) : null,
    ver: ps.length > 0 ? PAREAMENTO.ver(ps.length) : null,
    operacoes: ps.map((p) => {
      const x = partes(p)
      return PAREAMENTO.item(quando(p.local_entry), p.symbol, x.abertura, x.saidas, x.resultado)
    }),
  }
}

/** E26 */
function perguntaDoLiquidoVista(m: Mapeamento, market: AccountMarket): PerguntaVista<'sim' | 'nao'> | null {
  const choices = escolhasDe(m)
  const resultado = m.rowKind === 'trade' ? 'pnl' : 'realized'
  const custos = choices.columns.some((c) => c === 'commission' || c === 'fee')
  const swap = choices.columns.indexOf('swap') >= 0
  if (choices.columns.indexOf(resultado) < 0 || (!custos && !swap)) return null
  const q = perguntaDoLiquido(m, market)
  const forma = q ? q.form : 'commission'
  let nota: string | null = null
  if (q && q.evidence && q.preanswer !== null) {
    const e = q.evidence
    const k = e.line - m.lido.headerLine
    if (q.preanswer) {
      nota =
        Number(e.swap) !== 0
          ? LIQUIDO.conferidoLiquidoSwap(
              k,
              dinheiro(e.prices, market),
              dinheiro(e.costs, market, false),
              e.swap.startsWith('-'),
              dinheiro(absoluto(e.swap), market, false),
              dinheiro(e.file, market),
            )
          : LIQUIDO.conferidoLiquido(k, dinheiro(e.prices, market), dinheiro(e.costs, market, false), dinheiro(e.file, market))
    } else {
      nota = forma === 'swap' ? LIQUIDO.conferidoBrutoSwap(k, dinheiro(e.file, market)) : LIQUIDO.conferidoBruto(k, dinheiro(e.file, market), dinheiro(e.costs, market, false))
    }
  }
  return {
    id: 'q-liq',
    chave: '',
    texto: forma === 'commission_swap' ? LIQUIDO.comissaoSwap : forma === 'swap' ? LIQUIDO.swap : LIQUIDO.comissao,
    sub: null,
    atencao: false,
    opcoes: [
      { valor: 'sim', rotulo: LIQUIDO.sim, aria: null, pressionada: m.resultIsNet === true },
      { valor: 'nao', rotulo: LIQUIDO.nao, aria: null, pressionada: m.resultIsNet === false },
    ],
    nota,
  }
}

/**
 * «conferir» as data (§5.5), over arquivoDoMapeamento({...m, accountValue: null}, market, null): every account's rows, so
 * the end-of-file answers are given under the all-accounts keys (§6.7)
 */
export function vistaConferir(m: Mapeamento, market: AccountMarket): VistaConferir {
  const lido = arquivoDeTodasAsContas(m, market)
  const f = lido.ok ? lido : null
  const trade = m.rowKind === 'trade'
  const columns = escolhasDe(m).columns

  const registros = (trade ? m.lido.records : m.lido.records.filter((r) => executada(m, r))).slice(0, 3)
  const linhas = f ? registros.map((r) => itensDaLinha(m, r, market, f)) : []
  const titulo = registros.length === 2 ? CONFERIR.tituloDuas : registros.length === 1 ? CONFERIR.tituloUma : CONFERIR.titulo

  const notas: string[] = []
  if (!trade) notas.push(CONFERIR.executada)
  if (f) {
    const plano = f.notices.find((x): x is { code: 'flat_start_assumed'; symbols: string[] } => x.code === 'flat_start_assumed')
    if (plano) notas.push(f.endOfFile.length > 0 ? CONFERIR.semPosicaoEm(juntar(plano.symbols)) : CONFERIR.semPosicao)
    if (trade) {
      const mostradas = registros.map((r) => r.line)
      for (const p of f.positions) {
        const em = mostradas.map((l, j) => (p.exits.some((e) => e.line === l) ? j + 1 : 0)).filter((x) => x > 0)
        if (em.length >= 2) notas.push(CONFERIR.mesmaEntrada(ordinais(em), p.exits.length))
      }
    }
  }

  const perguntasFim: PerguntaVista<EndOfFileAnswer>[] = f
    ? f.endOfFile.map((q, j) => {
        const resposta: EndOfFileAnswer = m.endOfFile[q.key] ?? 'unknown'
        const net = absoluto(q.net)
        return {
          id: `q-fim-${j}`,
          chave: q.key,
          texto: q.account !== null ? FIM_ARQUIVO.tituloConta(q.symbol, q.account) : FIM_ARQUIVO.titulo(q.symbol),
          sub: FIM_ARQUIVO.sub(sobra(net, market, q.symbol, q.net.startsWith('-') ? 'vendido' : 'comprado')),
          atencao: true,
          opcoes: ([
            ['yes', FIM_ARQUIVO.sim],
            ['no', FIM_ARQUIVO.nao],
            ['unknown', FIM_ARQUIVO.naoSei],
          ] as [EndOfFileAnswer, string][]).map(([valor, rotulo]) => ({ valor, rotulo, aria: null, pressionada: resposta === valor })),
          nota: notaDoFim(m, q, resposta, f, market),
        }
      })
    : []

  return {
    titulo,
    ordem: !trade ? CONFERIR.ordemExecucao : columns.indexOf('pnl') >= 0 ? CONFERIR.ordemOperacao : CONFERIR.ordemPelosPrecos,
    falha: lido.ok ? null : CONFERIR.falha(lido.error),
    linhas,
    notas,
    perguntasFim,
    pareamento: f && !trade ? pareamento(m, f, market) : null,
    liquido: perguntaDoLiquidoVista(m, market),
    modelo: m.porModelo
      ? null
      : {
          rotulo: m.origem === 'nomes' ? MODELO.salvar : MODELO.atualizar(nomeDoModelo(m)),
          salvar: m.salvar,
          comNome: m.origem === 'nomes' && m.salvar,
          nome: m.nome,
          nota: MODELO.nota,
        },
    chipModelo: m.porModelo ? nomeDoModelo(m) : null,
    bloqueio: bloqueioDoConferir(m, market),
  }
}

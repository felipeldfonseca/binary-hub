/**
 * Phase 3b · telas, B0 (frozen): the board's world and files of testing/mapeadoTelas (contract §4.3) hold the numbers
 * the board draws. Every pin goes through the domain and lib/hub/importMapeado only (no React, no database).
 */
import {
  checkTemplate,
  columnCheck,
  columnsFromTemplate,
  dateOrderEvidence,
  endOfFileKey,
  matchTemplate,
  mappedContext,
  netQuestion,
  normaliseHeaders,
  routeFile,
  sniffFile,
  templateMisfits,
  templatePayload,
  type EndOfFileAnswer,
  type ImportRow,
  type MappedFile,
  type MappedPosition,
  type Notice,
  type SideWordAnswer,
} from '@/lib/domain/import'
import { MARKET_SPEC, type AccountMarket } from '@/lib/domain/markets'
import { localToUtc, tradingDayOn } from '@/lib/domain/tempo'
import { sortAccounts, tzConfirmed } from '@/lib/hub/contas'
import {
  arquivoDoMapeamento,
  cabecalhoDoLeitor,
  escolhasDe,
  iniciarMapeamento,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { BINANCE, BLACKARROW, BLACKARROW_FIELDS, IBKR, TRADOVATE, TRADOVATE_OPEN, TV_FIELDS } from '@/testing/mappedFiles'
import {
  ARQUIVOS_QUADRO,
  CONTAS_QUADRO,
  CONTA_DO_ARQUIVO,
  DESDE_QUADRO,
  HOJE_QUADRO,
  MODELO_BLACKARROW_LINHA,
  MODELO_TRADOVATE_LINHA,
  arquivoQuadro,
  contasQuadro,
  lidoQuadro,
  modeloBlackArrow,
  modeloTradovate,
  type ArquivoQuadroKey,
} from '@/testing/mapeadoTelas'

const CHAVES = Object.keys(ARQUIVOS_QUADRO) as ArquivoQuadroKey[]
const mercado = (k: ArquivoQuadroKey): AccountMarket => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]].market

const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})

function mapear(k: ArquivoQuadroKey, templates = [] as ReturnType<typeof modeloBlackArrow>[]): Mapeamento {
  const r = iniciarMapeamento(arquivo(k), { market: mercado(k), templates, nomePadrao: 'Minha plataforma' })
  if (!r.ok) throw new Error(`sniff ${r.error}`)
  return r.mapeamento
}

function ler(
  k: ArquivoQuadroKey,
  over: Partial<Pick<Mapeamento, 'resultIsNet' | 'accountValue'>> & {
    sideWords?: Record<string, SideWordAnswer>
    endOfFile?: Record<string, EndOfFileAnswer>
    decimalMark?: 'point' | 'comma'
  } = {},
  fileTz: string | null = null,
  m: Mapeamento = mapear(k),
): MappedFile {
  const f = arquivoDoMapeamento({ ...m, ...over }, mercado(k), fileTz)
  if (!f.ok) throw new Error(`file ${f.error}`)
  return f
}

const aviso = <C extends Notice['code']>(f: MappedFile, code: C) => f.notices.find((n) => n.code === code) as Extract<Notice, { code: C }> | undefined
const difere = (f: MappedFile) => f.warnings.filter((w) => w.code === 'result_differs_from_prices').length
const erros = (f: MappedFile) => f.errors.map((e) => `${e.line} ${e.code}`)
const hm = (local: string) => local.slice(11, 16)
const minuto = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16))
/** Entries per half hour of the wall clock, «HH:MM» of the half hour → count */
function porMeiaHora(locais: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of locais) {
    const m = Math.floor(minuto(l) / 30) * 30
    const k = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}
const primeiraEUltima = (locais: readonly string[]) => {
  const ms = locais.map(minuto)
  const f = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  return `${f(Math.min(...ms))}–${f(Math.max(...ms))}`
}
const soma = (xs: readonly string[]) => (xs.reduce((a, x) => a + Math.round(Number(x) * 100), 0) / 100).toFixed(2)
/** A position as the board lists it: symbol, side, size @ entry → exits (size@price), result */
const op = (p: MappedPosition) =>
  `${p.symbol} ${p.direction} ${p.quantity}@${p.entry_price} → ${p.exits.map((e) => `${e.quantity}@${e.exit_price}`).join(' + ')} = ${p.pnl}`
/** The trading day of a row's entry placed in `tz`, on the market's day clock */
function diaDeOperacao(r: Pick<ImportRow, 'local_entry'>, tz: string, market: AccountMarket): string {
  const [d, t] = r.local_entry.split('T')
  const [year, month, day] = d.split('-').map(Number)
  const [hour, minute, second] = t.split(':').map(Number)
  return tradingDayOn(localToUtc({ year, month, day, hour, minute, second }, tz), MARKET_SPEC[market].day)
}
/** The cells of one column of a file's data records */
const coluna = (k: ArquivoQuadroKey, i: number) => sniffOk(k).records.map((r) => r.cells[i] ?? '')
function sniffOk(k: ArquivoQuadroKey) {
  const s = sniffFile(ARQUIVOS_QUADRO[k].texto)
  if (!s.ok) throw new Error(s.error)
  return s
}

describe('the world', () => {
  it('«hoje» is Thursday 15 Oct 2026, 11:00 ET', () => {
    expect(HOJE_QUADRO.toISOString()).toBe('2026-10-15T15:00:00.000Z')
  })

  it('the accounts sort as the board lists them (Top One, Apex A, Ylos 50k, Lucid 50k, then the other markets)', () => {
    const ordem = ['Top One', 'Apex A', 'Ylos 50k', 'Lucid 50k', 'Ebinex', 'E8 50k', 'IBKR', 'Binance', 'Mini-índice']
    expect(sortAccounts(contasQuadro()).map((a) => a.label)).toEqual(ordem)
    expect(sortAccounts(contasQuadro(true)).map((a) => a.label)).toEqual(ordem)
    expect(new Set(contasQuadro().map((a) => a.created_at)).size).toBe(1)
  })

  it('each account is the board’s: market, platform, firm, number, zone and whether it is confirmed', () => {
    const c = CONTAS_QUADRO
    const linha = (a: (typeof c)[keyof typeof c]) => [a.market, a.label, a.platform, a.firm, a.external_ref, a.phase, a.file_tz, tzConfirmed(a)]
    expect(linha(c.topOne)).toEqual(['futures', 'Top One', 'topone', null, null, 'financiada', 'UTC', true])
    expect(c.topOne.is_primary).toBe(true)
    expect(linha(c.ylos)).toEqual(['futures', 'Ylos 50k', 'blackarrow', 'Ylos Trading', null, 'avaliacao', 'America/New_York', false])
    expect(linha(c.ylosDepois)).toEqual(['futures', 'Ylos 50k', 'blackarrow', 'Ylos Trading', null, 'avaliacao', 'America/New_York', true])
    expect(c.ylosDepois.id).toBe(c.ylos.id)
    expect(linha(c.lucid)).toEqual(['futures', 'Lucid 50k', 'tradovate', 'Lucid Trading', null, 'avaliacao', 'America/New_York', false])
    expect(linha(c.apexA)).toEqual(['futures', 'Apex A', 'ninja', 'Apex Trader Funding', 'APX-0001', 'avaliacao', 'America/New_York', false])
    expect(linha(c.e8)).toEqual(['forex', 'E8 50k', 'matchtrader', 'E8 Markets', null, 'avaliacao', 'America/New_York', false])
    expect(linha(c.ibkr)).toEqual(['stocks', 'IBKR', 'ibkr', null, null, 'pessoal', 'America/New_York', false])
    expect(linha(c.binance)).toEqual(['crypto', 'Binance', 'binance', null, null, 'pessoal', 'UTC', false])
    expect(linha(c.mini)).toEqual(['b3', 'Mini-índice', 'profit', null, null, 'pessoal', 'America/Sao_Paulo', false])
    expect(linha(c.ebinex)).toEqual(['binary', 'Ebinex', 'ebinex', null, null, 'pessoal', 'America/Sao_Paulo', false])
    // UUIDs (a model's routes need them), one per account
    const ids = contasQuadro().map((a) => a.id)
    expect(new Set(ids).size).toBe(9)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('rules start on 14 Oct for Top One, Ylos 50k and Apex A, on 15 Oct for the others', () => {
    expect(Object.entries(DESDE_QUADRO).filter(([, d]) => d === '2026-10-14').map(([k]) => k)).toEqual(['topOne', 'ylos', 'ylosDepois', 'apexA'])
  })
})

describe('every file', () => {
  it.each(CHAVES)('%s: no reader takes it, and in its account’s market it goes to the mapping', (k) => {
    const lido = lidoQuadro(k)
    expect(lido.fileName).toBe(ARQUIVOS_QUADRO[k].nome)
    expect(lido.sha256).toBe('ab'.repeat(32))
    expect(lido.outcome.ok).toBe(false)
    if (!lido.outcome.ok) expect(['unknown_format', 'missing_columns', 'duplicate_columns']).toContain(lido.outcome.error)
    expect(routeFile(cabecalhoDoLeitor(arquivo(k)), mercado(k))).toBe('mapping')
    const f = arquivoQuadro(k)
    expect([f.name, f.type, f.size]).toEqual([ARQUIVOS_QUADRO[k].nome, 'text/csv', lido.size])
  })

  it('9 · «Arquivo que não abre»: no line with the column names', () => {
    expect(sniffFile(ARQUIVOS_QUADRO.f9ilegivel.texto)).toEqual({ ok: false, error: 'header_not_found' })
  })
})

describe('8 · BlackArrow (18 linhas)', () => {
  const m = mapear('f8')

  it('starts with the board’s three rows; «;», decimal comma and day/month decided by the file', () => {
    const s = sniffOk('f8')
    expect(ARQUIVOS_QUADRO.f8.texto.startsWith(BLACKARROW + '\r\n')).toBe(true)
    expect(s.delimiter).toBe(';')
    expect(s.records).toHaveLength(18)
    expect(m.rowKind).toBe('trade')
    expect([m.decimal.decided, m.decimal.ambiguous, m.decimal.question]).toEqual(['comma', false, null])
    expect([m.datas.decided, m.datas.ask]).toEqual(['dmy', false])
  })

  it('the names suggest BLACKARROW_FIELDS', () => {
    expect(Object.fromEntries(m.lido.headers.map((h, i) => [h, m.colunas.trade[i]]))).toEqual(BLACKARROW_FIELDS)
  })

  it('every money and price cell has a comma part; the IDs are unique', () => {
    for (const i of [4, 5, 6, 7]) for (const c of coluna('f8', i)) expect(c).toMatch(/,\d{2}$/)
    expect(new Set(coluna('f8', 8)).size).toBe(18)
  })

  it('MESZ6 and MNQZ6 only, 21 contracts, Σ «Res. Líq.» 15,21, Σ «Corretagem» 26,04', () => {
    expect(new Set(coluna('f8', 1))).toEqual(new Set(['MESZ6', 'MNQZ6']))
    expect(coluna('f8', 3).reduce((a, q) => a + Number(q), 0)).toBe(21)
    expect(soma(coluna('f8', 6).map((c) => c.replace(',', '.')))).toBe('15.21')
    expect(soma(coluna('f8', 7).map((c) => c.replace(',', '.')))).toBe('26.04')
  })

  it('the net question is pre-answered «Sim, é líquido» by the 1ª linha: −37,50 − 2,48 = −39,98', () => {
    const c = escolhasDe(m)
    expect(netQuestion(m.lido.records, mappedContext({ ...c, resultIsNet: null }, 'futures', c.headers.map(() => null)))).toEqual({
      form: 'commission',
      preanswer: true,
      evidence: expect.objectContaining({ line: 2, file: '-39.98', prices: '-37.50', costs: '2.48' }),
    })
    expect(m.resultIsNet).toBe(true)
  })

  it('net: gross +41,25 and commissions 26,04; gross: +15,21 and 18 results differ from the prices', () => {
    const liquido = ler('f8', { resultIsNet: true })
    expect(aviso(liquido, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '41.25', commission: '26.04' })
    expect(difere(liquido)).toBe(0)
    const bruto = ler('f8', { resultIsNet: false })
    expect(aviso(bruto, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '15.21', commission: '26.04' })
    expect(difere(bruto)).toBe(18)
    expect([liquido.rows.length, liquido.errors]).toEqual([18, []])
  })

  it('entries 09:31–10:58: 8, 6 and 4 per half hour, one trade per row', () => {
    const f = ler('f8')
    const locais = f.positions.map((p) => p.local_entry)
    expect(f.positions).toHaveLength(18)
    expect(primeiraEUltima(locais)).toBe('09:31–10:58')
    expect(porMeiaHora(locais)).toEqual({ '09:30': 8, '10:00': 6, '10:30': 4 })
    expect([hm(f.rows[0].local_entry), f.rows[0].local_entry.slice(0, 10)]).toEqual(['09:34', '2026-10-01'])
  })

  it('every entry is before 14 Oct in New York, UTC and Brasília (dates 1–13 Oct)', () => {
    const f = ler('f8')
    const dias = f.rows.map((r) => r.local_entry.slice(0, 10)).sort()
    expect([dias[0], dias[dias.length - 1]]).toEqual(['2026-10-01', '2026-10-13'])
    for (const tz of ['America/New_York', 'UTC', 'America/Sao_Paulo']) {
      for (const r of f.rows) expect(diaDeOperacao(r, tz, 'futures') < '2026-10-14').toBe(true)
    }
  })
})

describe('8 · Performance.csv (6 linhas)', () => {
  const m = mapear('f8p')

  it('6 rows make 4 trades: +23,75 (37,50 and −13,75), +7,50, +17,00, +55,00 (18,75 and 36,25)', () => {
    const f = ler('f8p')
    expect(f.rows).toHaveLength(6)
    expect(f.positions.map(op)).toEqual([
      'MESZ6 long 2@6812.25 → 1@6816.00 + 1@6819.50 = 55.00',
      'MNQZ6 long 1@25240.75 → 1@25244.50 = 7.50',
      'MNQZ6 long 1@25236.00 → 1@25244.50 = 17.00',
      'MESZ6 short 3@6821.00 → 2@6817.25 + 1@6823.75 = 23.75',
    ])
    expect(f.positions[3].exits.map((e) => e.pnl)).toEqual(['37.50', '-13.75'])
    expect(f.positions[0].exits.map((e) => e.pnl)).toEqual(['18.75', '36.25'])
  })

  it('the trades’ entries 10:31, 11:02, 11:05, 11:20: 1 and 3 per half hour', () => {
    const locais = ler('f8p').positions.map((p) => p.local_entry)
    expect(locais.map(hm)).toEqual(['10:31', '11:02', '11:05', '11:20'])
    expect(porMeiaHora(locais)).toEqual({ '10:30': 1, '11:00': 3 })
  })

  it('buyFillId and sellFillId repeat: neither is an ID; no commission', () => {
    const values = { records: m.lido.records, decimalMark: 'point' as const, dateOrder: 'mdy' as const }
    expect(columnCheck(values, m.lido.headers.indexOf('buyfillid'), 'trade_id')).toBe('repeats')
    expect(columnCheck(values, m.lido.headers.indexOf('sellfillid'), 'trade_id')).toBe('repeats')
    const f = ler('f8p')
    expect(aviso(f, 'commission_in_file')).toBeUndefined()
    expect(f.rows.every((r) => r.commission === null)).toBe(true)
  })
})

describe('15 · BlackArrow with the model (24 linhas)', () => {
  it('«As mesmas colunas»: the model fits as is; gross +103,75, commissions 34,72; 1–15 Oct', () => {
    const modelo = modeloBlackArrow()
    const m = mapear('f15', [modelo])
    expect(m.match).toEqual({ kind: 'exact', template: modelo })
    expect(
      templateMisfits(modelo, { delimiter: m.lido.delimiter, headerSkip: m.lido.headerSkip, decimalDecided: m.decimal.decided, dateOrderDecided: m.datas.decided }),
    ).toEqual([])
    const f = ler('f15', {}, null, m)
    expect(f.rows).toHaveLength(24)
    expect(aviso(f, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '103.75', commission: '34.72' })
    const dias = f.rows.map((r) => r.local_entry.slice(0, 10)).sort()
    expect([dias[0], dias[dias.length - 1]]).toEqual(['2026-10-01', '2026-10-15'])
  })

  it('the 18 rows of scenario 8 first, then 6 rows on 14–15 Oct: 7 contracts, Σ 53,82 and 8,68, new IDs', () => {
    const linhas = ARQUIVOS_QUADRO.f15.texto.split('\r\n')
    expect(linhas.slice(0, 19).join('\r\n')).toBe(ARQUIVOS_QUADRO.f8.texto)
    const novas = sniffOk('f15').records.slice(18)
    expect(novas.map((r) => r.cells[0].slice(0, 10))).toEqual(['14/10/2026', '14/10/2026', '14/10/2026', '15/10/2026', '15/10/2026', '15/10/2026'])
    expect(novas.reduce((a, r) => a + Number(r.cells[3]), 0)).toBe(7)
    expect(soma(novas.map((r) => r.cells[6].replace(',', '.')))).toBe('53.82')
    expect(soma(novas.map((r) => r.cells[7].replace(',', '.')))).toBe('8.68')
    expect(new Set(coluna('f15', 8)).size).toBe(24)
  })

  it('«Uma coluna a mais»: a changed match sharing 9 names; «Estratégia» is new (none of the model’s fields)', () => {
    const modelo = modeloBlackArrow()
    const s = sniffOk('f15b')
    expect(matchTemplate(s.headers, [modelo])).toEqual({ kind: 'changed', template: modelo, shared: 9 })
    expect(columnsFromTemplate(s.headers, modelo)[9]).toBeNull()
    expect(s.rawHeaders[9]).toBe('Estratégia')
    expect(s.records.slice(0, 3).map((r) => r.cells[9])).toEqual(['Rompimento', 'Pullback', 'Rompimento'])
  })
})

describe('16 · execution files', () => {
  it('Tradovate: lines 2, 4 and 5 are the board’s (only «Timestamp» and «Limit Price» differ from the domain’s file)', () => {
    for (const [k, base] of [
      ['f16t', TRADOVATE],
      ['f16ta', TRADOVATE_OPEN],
    ] as const) {
      const a = ARQUIVOS_QUADRO[k].texto.split('\n')
      const b = base.split('\n')
      expect(a).toHaveLength(b.length)
      a.forEach((linha, i) => {
        const x = linha.split(',')
        const y = b[i].split(',')
        const diferentes = x.map((c, j) => (c === y[j] ? null : j)).filter((j) => j !== null)
        expect(diferentes.every((j) => j === 8 || j === 10)).toBe(true)
        if ([1, 3, 4].indexOf(i) < 0) expect(diferentes).toEqual([])
      })
      const s = sniffOk(k)
      const primeira = (h: string) => s.records.map((r) => r.cells[s.rawHeaders.indexOf(h)]).find((c) => c !== '')
      expect([primeira('Timestamp'), primeira('Limit Price')]).toEqual(['10/13/2026 10:31:04', '6816.00'])
    }
    expect(ARQUIVOS_QUADRO.f16b.texto).toBe(BINANCE)
    expect(ARQUIVOS_QUADRO.f16i.texto).toBe(IBKR)
  })

  it('executions 9 / 10 / 8 / 8, unfilled 2 / 3 / 0 / 0', () => {
    const conta = (k: ArquivoQuadroKey) => {
      const f = ler(k)
      return [f.rowKind, f.executions, f.unfilled]
    }
    expect(['f16t', 'f16ta', 'f16b', 'f16i'].map((k) => conta(k as ArquivoQuadroKey))).toEqual([
      ['fill', 9, 2],
      ['fill', 10, 3],
      ['fill', 8, 0],
      ['fill', 8, 0],
    ])
  })

  it('the end-of-file questions: MESZ6 1 contract sold over 7 executions; ETHUSDT 0,1 bought over 3; none in the others', () => {
    const q = (k: ArquivoQuadroKey) => ler(k).endOfFile.map((e) => [e.key, e.symbol, e.account, e.net, e.fills, e.answer])
    expect(q('f16t')).toEqual([])
    expect(q('f16ta')).toEqual([['MESZ6', 'MESZ6', null, '-1', 7, 'unknown']])
    expect(q('f16b')).toEqual([['ETHUSDT', 'ETHUSDT', null, '0.1000', 3, 'unknown']])
    expect(q('f16i')).toEqual([])
  })

  it('Tradovate (11 linhas): 4 trades (IC l.877–881); executions 3, 5, 1 per half hour, 10:31–11:31', () => {
    const f = ler('f16t')
    expect(f.positions.map(op)).toEqual([
      'MESZ6 long 2@6812.25 → 1@6816.00 + 1@6819.50 = 55.00',
      'MNQZ6 long 1@25240.75 → 1@25244.50 = 7.50',
      'MNQZ6 long 1@25236.00 → 1@25244.50 = 17.00',
      'MESZ6 short 3@6821.00 → 2@6817.25 + 1@6823.75 = 23.75',
    ])
    const horas = f.executionTimes.map((e) => e.local)
    expect(primeiraEUltima(horas)).toBe('10:31–11:31')
    expect(porMeiaHora(horas)).toEqual({ '10:30': 3, '11:00': 5, '11:30': 1 })
  })

  it('Tradovate ending positioned (13 linhas): the trades per answer (IC l.1140–1147); executions 3, 5, 2, 10:31–11:48', () => {
    const tv = (fim: EndOfFileAnswer) => ler('f16ta', { endOfFile: { MESZ6: fim } }).positions.map(op)
    expect(tv('unknown')).toEqual(['MNQZ6 long 1@25240.75 → 1@25244.50 = 7.50', 'MNQZ6 long 1@25236.00 → 1@25244.50 = 17.00'])
    expect(tv('yes')).toEqual([
      'MESZ6 long 2@6812.25 → 1@6816.00 + 1@6819.50 = 55.00',
      'MNQZ6 long 1@25240.75 → 1@25244.50 = 7.50',
      'MNQZ6 long 1@25236.00 → 1@25244.50 = 17.00',
      'MESZ6 short 3@6821.00 → 2@6817.25 + 1@6823.75 = 23.75',
    ])
    expect(tv('no')).toEqual([
      'MESZ6 long 2@6812.25 → 1@6819.50 + 1@6821.00 = 80.00',
      'MNQZ6 long 1@25240.75 → 1@25244.50 = 7.50',
      'MNQZ6 long 1@25236.00 → 1@25244.50 = 17.00',
      'MESZ6 short 2@6821.00 → 2@6817.25 = 37.50',
      'MESZ6 long 1@6823.75 → 1@6824.50 = 3.75',
    ])
    expect(erros(ler('f16ta', { endOfFile: { MESZ6: 'unknown' } }))).toEqual([2, 4, 5, 10, 11, 12, 13].map((n) => `${n} unbalanced_symbol`))
    expect(erros(ler('f16ta', { endOfFile: { MESZ6: 'yes' } }))).toEqual(['13 open_at_end'])
    expect(erros(ler('f16ta', { endOfFile: { MESZ6: 'no' } }))).toEqual(['4 opened_before_file'])
    const horas = ler('f16ta').executionTimes.map((e) => e.local)
    expect(primeiraEUltima(horas)).toBe('10:31–11:48')
    expect(porMeiaHora(horas)).toEqual({ '10:30': 3, '11:00': 5, '11:30': 2 })
  })

  it('Binance (8 linhas): the trades per answer (IC l.928–934, 1099–1103)', () => {
    const bn = (fim: EndOfFileAnswer) => ler('f16b', { endOfFile: { ETHUSDT: fim } }).positions.map(op)
    const btc = 'BTCUSDT long 0.0125@112400.00 → 0.0125@112952.00 = 6.90'
    const btc2 = 'BTCUSDT long 0.02@113180.00 → 0.0100@113420.00 + 0.0100@113005.00 = 0.65'
    expect(bn('unknown')).toEqual([btc, btc2])
    expect(bn('yes')).toEqual([btc, 'ETHUSDT long 0.1000@4120.50 → 0.1000@4135.00 = 1.45', btc2])
    expect(bn('no')).toEqual([btc, 'ETHUSDT short 0.1000@4135.00 → 0.1000@4108.00 = 2.70', btc2])
    expect(aviso(ler('f16b'), 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '7.55', commission: '2.82' })
  })

  it('Interactive Brokers (8 linhas): 2 trades; commissions 5,00 (the domain’s number, §11.1 #1)', () => {
    const f = ler('f16i')
    expect(f.positions.map(op)).toEqual(['NVDA long 300@187.42 → 300@188.10 = 204.00', 'AAPL short 100@247.80 → 60@246.95 + 40@247.10 = 79.00'])
    expect(aviso(f, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '283.00', commission: '5.00' })
    expect(erros(f)).toEqual(['2 opened_before_file', '7 bad_option', '9 open_at_end'])
  })

  it('two accounts (N): 2 «Account» values; every account read: one question each (+1); one account: one question by the symbol', () => {
    const s = sniffOk('f16c')
    const contas = s.records.filter((r) => r.cells[5] !== '0').map((r) => r.cells[1])
    expect(Array.from(new Set(contas))).toEqual(['LT50K-0193', 'LT50K-0194'])
    const todas = ler('f16c')
    expect(todas.endOfFile.map((q) => [q.key, q.account, q.net])).toEqual([
      [endOfFileKey('MESZ6', 'LT50K-0193'), 'LT50K-0193', '1'],
      [endOfFileKey('MESZ6', 'LT50K-0194'), 'LT50K-0194', '1'],
    ])
    expect(todas.unfilled).toBe(1)
    const uma = ler('f16c', { accountValue: 'LT50K-0193' })
    expect(uma.endOfFile.map((q) => [q.key, q.account, q.net])).toEqual([['MESZ6', null, '1']])
  })
})

describe('17 · NinjaTrader (57 linhas)', () => {
  const m = mapear('f17')

  it('APX-0001 31 rows and APX-0002 26, in first-appearance order; month/day decided by a day above 12', () => {
    const contas = coluna('f17', 2)
    expect(Array.from(new Set(contas))).toEqual(['APX-0001', 'APX-0002'])
    expect([contas.filter((c) => c === 'APX-0001').length, contas.filter((c) => c === 'APX-0002').length]).toEqual([31, 26])
    expect([m.datas.decided, m.datas.ask, m.decimal.decided]).toEqual(['mdy', false, 'point'])
    expect(ARQUIVOS_QUADRO.f17.texto.split('\n').slice(1, 4)).toEqual([
      '1,MNQ 12-26,APX-0001,Short,1,25140.25,25131.75,10/1/2026 9:31:05 AM,10/1/2026 9:38:40 AM,17.00,1.24',
      '2,MES 12-26,APX-0002,Long,2,6803.50,6809.75,10/1/2026 9:52:10 AM,10/1/2026 10:04:33 AM,62.50,2.48',
      '3,MNQ 12-26,APX-0001,Long,1,25160.00,25151.25,10/1/2026 10:15:02 AM,10/1/2026 10:21:47 AM,-17.50,1.24',
    ])
  })

  it('the net question is pre-answered «Não, é bruto» by the 1ª linha: +17,00 before a commission of 1,24', () => {
    const c = escolhasDe(m)
    expect(netQuestion(m.lido.records, mappedContext({ ...c, resultIsNet: null }, 'futures', c.headers.map(() => null)))).toEqual({
      form: 'commission',
      preanswer: false,
      evidence: expect.objectContaining({ line: 2, file: '17.00', prices: '17.00', costs: '1.24' }),
    })
    expect(m.resultIsNet).toBe(false)
  })

  it.each([
    ['APX-0001', 31, 26, '186.50', '231.14', '44.64', 36, ['MNQZ26', 'MESZ26']],
    ['APX-0002', 26, 31, '141.25', '178.45', '37.20', 30, ['MESZ26', 'MNQZ26']],
  ] as const)('%s: %i trades (%i not imported); gross %s («Não»), %s («Sim», every result differs); commissions %s; %i contracts', (valor, n, fora, bruto, liquido, comissao, contratos, simbolos) => {
    const g = ler('f17', { accountValue: valor, resultIsNet: false })
    expect([g.rows.length, g.notImported, difere(g)]).toEqual([n, fora, 0])
    expect(aviso(g, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: bruto, commission: comissao })
    const l = ler('f17', { accountValue: valor, resultIsNet: true })
    expect(aviso(l, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: liquido, commission: comissao })
    expect(difere(l)).toBe(n)
    expect(g.rows.reduce((a, r) => a + Number(r.quantity), 0)).toBe(contratos)
    expect(aviso(g, 'symbol_normalised')?.symbols).toEqual(simbolos)
    const locais = g.positions.map((p) => p.local_entry)
    expect(primeiraEUltima(locais)).toBe('09:31–11:58')
    for (const r of g.rows) expect(diaDeOperacao(r, 'America/New_York', 'futures') < '2026-10-14').toBe(true)
  })

  it('the whole file: «MNQ 12-26» and «MES 12-26» are read as MNQZ26 and MESZ26', () => {
    expect(aviso(ler('f17'), 'symbol_normalised')).toEqual({ code: 'symbol_normalised', rows: 57, symbols: ['MNQZ26', 'MESZ26'] })
  })

  it('APX-0001: 10, 8, 6, 4 and 3 trades per half hour from 09:30', () => {
    const locais = ler('f17', { accountValue: 'APX-0001' }).positions.map((p) => p.local_entry)
    expect(porMeiaHora(locais)).toEqual({ '09:30': 10, '10:00': 8, '10:30': 6, '11:00': 4, '11:30': 3 })
  })
})

describe('18 · Forex (14 linhas)', () => {
  const m = mapear('f18')

  it('2 EURGBP rows and 12 of exact pairs; Σ Profit 218,60, Σ Swap −6,20 (row 3 only), Σ |Commission| 40,25', () => {
    const pares = coluna('f18', 3)
    expect(pares.filter((p) => p === 'EURGBP')).toHaveLength(2)
    expect(pares.filter((p) => ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'].indexOf(p) >= 0)).toHaveLength(12)
    expect(soma(coluna('f18', 10))).toBe('218.60')
    expect(coluna('f18', 8).map((c, i) => (c === '0.00' ? null : `${i} ${c}`)).filter(Boolean)).toEqual(['2 -6.20'])
    expect(soma(coluna('f18', 9).map((c) => c.replace('-', '')))).toBe('40.25')
    expect([m.datas.decided, m.decimal.decided]).toEqual(['dmy', 'point'])
    expect(new Set(coluna('f18', 1).map((c) => c.slice(0, 5)))).toEqual(new Set(['13.10', '14.10']))
  })

  it('«Não, é bruto» pre-answered by the 1ª linha (+57,50 before 3,50): gross +212,40; «Sim»: +258,85 and 12 differences', () => {
    expect(m.resultIsNet).toBe(false)
    const c = escolhasDe(m)
    expect(netQuestion(m.lido.records, mappedContext({ ...c, resultIsNet: null }, 'forex', c.headers.map(() => null)))).toMatchObject({
      form: 'commission_swap',
      preanswer: false,
      evidence: { line: 2, file: '57.50', prices: '57.50', costs: '3.50' },
    })
    const bruto = ler('f18', { resultIsNet: false })
    expect(aviso(bruto, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '212.40', commission: '40.25' })
    expect(difere(bruto)).toBe(0)
    expect(aviso(bruto, 'swap_in_result')).toEqual({ code: 'swap_in_result', rows: 1 })
    const liquido = ler('f18', { resultIsNet: true })
    expect(aviso(liquido, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '258.85', commission: '40.25' })
    expect(difere(liquido)).toBe(12)
  })

  it('entries 06:05–17:48 (row 3 the last; every other one by 15:59), per half hour as the board but 16:00 at 15:30', () => {
    const f = ler('f18')
    const locais = f.rows.map((r) => r.local_entry)
    expect(primeiraEUltima(locais)).toBe('06:05–17:48')
    expect(f.rows.filter((r) => minuto(r.local_entry) > 15 * 60 + 59).map((r) => [r.line, r.local_entry])).toEqual([[4, '2026-10-13T17:48:55']])
    expect(porMeiaHora(locais)).toEqual({
      '06:00': 1,
      '08:30': 2,
      '09:00': 2,
      '09:30': 1,
      '10:00': 1,
      '10:30': 1,
      '12:00': 1,
      '13:00': 1,
      '14:30': 1,
      '15:00': 1,
      '15:30': 1,
      '17:30': 1,
    })
  })

  it('one trade on another day than the file’s in New York and in Chicago (§11.1 #2), none in UTC', () => {
    const outroDia = (tz: string) => ler('f18', {}, tz).rows.filter((r) => diaDeOperacao(r, tz, 'forex') !== r.local_entry.slice(0, 10)).length
    expect([outroDia('America/New_York'), outroDia('America/Chicago'), outroDia('UTC')]).toEqual([1, 1, 0])
  })

  it('«Datas ambíguas»: the same rows on 8–9 Oct: the order is asked; the first ambiguous cell is «09.10.2026 …»', () => {
    const a = mapear('f18a')
    expect([a.datas.decided, a.datas.ask, a.dateOrder]).toEqual([null, true, null])
    const datas = a.lido.records.flatMap((r) => [r.cells[1], r.cells[2]])
    expect(datas.find((c) => dateOrderEvidence(c) === 'either')).toBe('09.10.2026 08:40:12')
    expect(ARQUIVOS_QUADRO.f18a.texto.replace(/09\.10\.2026/g, '14.10.2026').replace(/08\.10\.2026/g, '13.10.2026')).toBe(ARQUIVOS_QUADRO.f18.texto)
  })
})

describe('19 · B3 (18 linhas)', () => {
  const m = mapear('f19')

  it('«X» on lines 6 and 11, an empty side on line 15, line 9 off the WIN tick; WIN «131.250»-like, WDO «5.412,5»-like', () => {
    const lado = m.lido.headers.indexOf('c/v')
    const linhas = (f: (c: string) => boolean) => m.lido.records.filter((r) => f(r.cells[lado])).map((r) => r.line)
    expect(linhas((c) => c === 'X')).toEqual([6, 11])
    expect(linhas((c) => c === '')).toEqual([15])
    for (const r of m.lido.records) {
      for (const i of [4, 5]) expect(r.cells[i]).toMatch(r.cells[1] === 'WINZ26' ? /^\d{3}\.\d{3}$/ : /^\d\.\d{3},\d$/)
      for (const i of [6, 7, 8]) expect(r.cells[i]).toMatch(/,\d{2}$/)
    }
    expect([m.decimal.decided, m.decimal.ambiguous, m.datas.decided]).toEqual(['comma', true, 'dmy'])
    expect(ARQUIVOS_QUADRO.f19.texto.split('\n').slice(1, 4)).toEqual([
      '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;88,50;0,90;0,60;77120',
      '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;-31,00;0,60;0,40;77134',
      '14/10/2026 11:20:05;WDOX26;C;1;5.412,5;5.419,0;64,25;0,50;0,25;77152',
    ])
  })

  it('«Sim, é líquido» pre-answered by the 1ª linha: +90,00 − 1,50 = +88,50', () => {
    expect(m.resultIsNet).toBe(true)
    const c = escolhasDe(m)
    expect(netQuestion(m.lido.records, mappedContext({ ...c, resultIsNet: null }, 'b3', c.headers.map(() => null)))).toEqual({
      form: 'commission',
      preanswer: true,
      evidence: expect.objectContaining({ line: 2, file: '88.50', prices: '90.00', costs: '1.50' }),
    })
  })

  it('«X» = Venda: 16 rows, gross +412,00 and costs 22,50 («Sim»), +389,50 with 16 differences («Não»); lines 9 and 15 refused', () => {
    const sim = ler('f19', { sideWords: { x: 'sell' }, resultIsNet: true })
    expect([sim.rows.length, erros(sim), difere(sim)]).toEqual([16, ['9 off_tick', '15 bad_direction'], 0])
    expect(aviso(sim, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '412.00', commission: '22.50' })
    const nao = ler('f19', { sideWords: { x: 'sell' }, resultIsNet: false })
    expect(aviso(nao, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '389.50', commission: '22.50' })
    expect(difere(nao)).toBe(16)
  })

  it('«Pular essas linhas»: 14 rows, +413,00 («Sim») or +391,40 («Não»), costs 21,60; lines 6 and 11 refused too', () => {
    const sim = ler('f19', { sideWords: { x: 'skip' }, resultIsNet: true })
    expect([sim.rows.length, erros(sim)]).toEqual([14, ['6 bad_direction', '9 off_tick', '11 bad_direction', '15 bad_direction']])
    expect(aviso(sim, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '413.00', commission: '21.60' })
    const nao = ler('f19', { sideWords: { x: 'skip' }, resultIsNet: false })
    expect(aviso(nao, 'commission_in_file')).toEqual({ code: 'commission_in_file', gross: '391.40', commission: '21.60' })
  })

  it('entries 10:02–16:40 (Brasília): the 18 lines 4, 3, 3, 2, 2, 2, 2 per half hour; the 16 trades 4, 3, 2, 2, 1, 2, 2', () => {
    const todas = m.lido.records.map((r) => `2026-10-14T${r.cells[0].slice(11)}`)
    expect(primeiraEUltima(todas)).toBe('10:02–16:40')
    expect(porMeiaHora(todas)).toEqual({ '10:00': 4, '10:30': 3, '11:00': 3, '13:00': 2, '14:00': 2, '14:30': 2, '16:30': 2 })
    const f = ler('f19', { sideWords: { x: 'sell' } })
    expect(porMeiaHora(f.positions.map((p) => p.local_entry))).toEqual({ '10:00': 4, '10:30': 3, '11:00': 2, '13:00': 2, '14:00': 1, '14:30': 2, '16:30': 2 })
  })

  it('«Só preços»: no deciding number cell (the question on «131.250», comma pre-selected); with the point every WIN price is off its tick', () => {
    const p = mapear('f19p')
    expect(p.lido.rawHeaders).toEqual(['Data/Hora', 'Papel', 'C/V', 'Qtd', 'Pr. Entrada', 'Pr. Saída', 'Nº Negócio'])
    expect(p.decimal.decided).toBeNull()
    expect(p.decimal.question).toMatchObject({ sample: '131.250', preselect: 'comma' })
    expect(p.decimalMark).toBe('comma')
    expect(p.lido.records.every((r) => r.cells[1] === 'WINZ26')).toBe(true)
    expect(ARQUIVOS_QUADRO.f19p.texto.split('\n').slice(1, 4)).toEqual([
      '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;77120',
      '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;77134',
      '14/10/2026 10:48:22;WINZ26;V;1;131.180;131.055;77141',
    ])
    const virgula = ler('f19p', { sideWords: { x: 'sell' } }, null, p)
    expect([virgula.rows.length, erros(virgula)]).toEqual([16, ['9 off_tick', '15 bad_direction']])
    expect([virgula.rows[0].pnl, virgula.rows[0].pnl_basis]).toEqual(['90.00', 'prices'])
    const ponto = ler('f19p', { sideWords: { x: 'sell' }, decimalMark: 'point' }, null, p)
    expect(ponto.rows).toHaveLength(0)
    expect(erros(ponto).filter((e) => !e.endsWith('off_tick'))).toEqual(['15 bad_direction'])
    expect(ponto.errors).toHaveLength(18)
  })
})

describe('the saved models', () => {
  it('«BlackArrow»: scenario 8’s mapping, «;», comma, day/month, net, New York; a valid payload', () => {
    const t = modeloBlackArrow()
    const m = mapear('f8')
    expect(t).toMatchObject({ id: MODELO_BLACKARROW_LINHA.id, name: 'BlackArrow', rowKind: 'trade', delimiter: ';', decimalMark: 'comma', dateOrder: 'dmy' })
    expect([t.resultIsNet, t.tzHint, t.sig, t.headers]).toEqual([true, 'America/New_York', m.lido.sig, m.lido.headers])
    expect(t.columns).toEqual(m.colunas.trade)
    expect(checkTemplate(templatePayload({ ...t }))).toBeNull()
  })

  it('«Tradovate»: scenario 16’s execution mapping, «,», point, month/day, New York; a valid payload', () => {
    const t = modeloTradovate()
    const s = sniffOk('f16t')
    expect(t).toMatchObject({ id: MODELO_TRADOVATE_LINHA.id, name: 'Tradovate', rowKind: 'fill', delimiter: ',', decimalMark: 'point', dateOrder: 'mdy' })
    expect([t.resultIsNet, t.tzHint, t.sig, t.headers]).toEqual([null, 'America/New_York', s.sig, normaliseHeaders(s.rawHeaders)])
    expect(Object.fromEntries(t.headers.map((h, i) => [h, t.columns[i]]).filter(([, f]) => f !== null))).toEqual(TV_FIELDS)
    expect(checkTemplate(templatePayload({ ...t }))).toBeNull()
  })
})

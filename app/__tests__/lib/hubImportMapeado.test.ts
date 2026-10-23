/**
 * Phase 3b · telas, B0: the column-mapping import's shared state (lib/hub/importMapeado) on the board's files
 * (testing/mapeadoTelas). Lane L1 adds the edits of contract §5.2 and the pre-fill of §5.3 here.
 */
import {
  accountRouteHash,
  checkTemplate,
  endOfFileKey,
  headerSignature,
  parseMappedRecords,
  sniffDateOrder,
  sniffDecimalMark,
  suggestColumns,
  templateFromRow,
  type FieldKey,
  type MappedFile,
  type RowKind,
  type Template,
} from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import {
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  cabecalhoDoLeitor,
  escolhasDe,
  iniciarMapeamento,
  lerArquivoMapeavel,
  modeloASalvar,
  mudarColunas,
  nomePadraoDoModelo,
  type ArquivoMapeavel,
  type ColunaUi,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { B3_FIELDS, BLACKARROW_FIELDS, BN_FIELDS, FOREX_FIELDS, IB_FIELDS, NINJA_FIELDS, PERFORMANCE_FIELDS, TV_FIELDS } from '@/testing/mappedFiles'
import {
  ARQUIVOS_QUADRO,
  CONTAS_QUADRO,
  CONTA_DO_ARQUIVO,
  modeloBlackArrow,
  modeloTradovate,
  type ArquivoQuadroKey,
  type ContaQuadro,
} from '@/testing/mapeadoTelas'

const ARQUIVOS = (Object.keys(ARQUIVOS_QUADRO) as ArquivoQuadroKey[]).filter((k) => k !== 'f9ilegivel')
const conta = (k: ArquivoQuadroKey) => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]]
const mercado = (k: ArquivoQuadroKey): AccountMarket => conta(k).market

const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})

function mapear(k: ArquivoQuadroKey, templates: readonly Template[] = [], contaKey: ContaQuadro = CONTA_DO_ARQUIVO[k]): Mapeamento {
  const c = CONTAS_QUADRO[contaKey]
  const r = iniciarMapeamento(arquivo(k), { market: c.market, templates, nomePadrao: nomePadraoDoModelo(c.platform) })
  if (!r.ok) throw new Error(`sniff ${r.error}`)
  return r.mapeamento
}

function ler(m: Mapeamento, k: ArquivoQuadroKey, fileTz: string | null = null): MappedFile {
  const f = arquivoDoMapeamento(m, mercado(k), fileTz)
  if (!f.ok) throw new Error(`file ${f.error}`)
  return f
}

/** A column map by the file's normalised names (the fields only) */
const porNome = (m: Mapeamento, kind: RowKind = m.rowKind) => {
  const out: Record<string, ColunaUi> = {}
  m.lido.headers.forEach((h, i) => {
    const c = m.colunas[kind][i]
    if (c !== null) out[h] = c
  })
  return out
}

/** A model saved from a mapping, as import_templates would hand it back (templateFromRow of the payload) */
function modeloDe(m: Mapeamento, tzHint: string, id: string): Template {
  const s = modeloASalvar(m, { tzHint, rota: null })
  if (!s) throw new Error('nothing to save')
  const t = templateFromRow({ ...s.payload, id, header_sig: headerSignature(s.payload.headers), last_used_at: null })
  if (!t) throw new Error('model row not usable')
  return t
}

const UUID_19 = '3b0c0a00-0000-4000-8000-0000000000b9'

// ------------------------------------------------------------------------------------------------

describe('nomePadraoDoModelo (D1)', () => {
  it('the platform’s label; a reader’s platform, «Não sei», «Outra», an unknown key or none → «Minha plataforma»', () => {
    expect(
      ['blackarrow', 'tradovate', 'ninja', 'matchtrader', 'profit', 'binance', 'ibkr'].map(nomePadraoDoModelo),
    ).toEqual(['BlackArrow', 'Tradovate', 'NinjaTrader', 'Match-Trader', 'Profit (Nelogica)', 'Binance', 'Interactive Brokers'])
    for (const p of ['topone', 'ebinex', 'naosei', 'outra', 'nenhuma', '', null]) expect(nomePadraoDoModelo(p)).toBe('Minha plataforma')
  })
})

describe('iniciarMapeamento', () => {
  const CAMPOS: Record<ArquivoQuadroKey, Record<string, FieldKey>> = {
    f8: BLACKARROW_FIELDS,
    f8p: PERFORMANCE_FIELDS,
    f15: BLACKARROW_FIELDS,
    f15b: BLACKARROW_FIELDS,
    f16t: TV_FIELDS,
    f16ta: TV_FIELDS,
    f16b: BN_FIELDS,
    f16i: IB_FIELDS,
    f16c: TV_FIELDS,
    f17: NINJA_FIELDS,
    f18: FOREX_FIELDS,
    f18a: FOREX_FIELDS,
    f19: B3_FIELDS,
    f19p: Object.fromEntries(Object.entries(B3_FIELDS).filter(([, f]) => ['pnl', 'commission', 'fee'].indexOf(f) < 0)),
    f9ilegivel: {},
  }
  const ESPERADO: Record<
    Exclude<ArquivoQuadroKey, 'f9ilegivel' | 'f15' | 'f15b'>,
    { kind: RowKind; decimal: string | null; mark: string | null; datas: string | null; ask: boolean; net: boolean | null; nome: string }
  > = {
    f8: { kind: 'trade', decimal: 'comma', mark: 'comma', datas: 'dmy', ask: false, net: true, nome: 'BlackArrow' },
    f8p: { kind: 'trade', decimal: 'point', mark: 'point', datas: 'mdy', ask: false, net: null, nome: 'Tradovate' },
    f16t: { kind: 'fill', decimal: 'point', mark: 'point', datas: 'mdy', ask: false, net: null, nome: 'Tradovate' },
    f16ta: { kind: 'fill', decimal: 'point', mark: 'point', datas: 'mdy', ask: false, net: null, nome: 'Tradovate' },
    f16b: { kind: 'fill', decimal: 'point', mark: 'point', datas: null, ask: false, net: null, nome: 'Binance' },
    f16i: { kind: 'fill', decimal: 'point', mark: 'point', datas: null, ask: false, net: null, nome: 'Interactive Brokers' },
    f16c: { kind: 'fill', decimal: 'point', mark: 'point', datas: 'mdy', ask: false, net: null, nome: 'Tradovate' },
    f17: { kind: 'trade', decimal: 'point', mark: 'point', datas: 'mdy', ask: false, net: false, nome: 'NinjaTrader' },
    f18: { kind: 'trade', decimal: 'point', mark: 'point', datas: 'dmy', ask: false, net: false, nome: 'Match-Trader' },
    f18a: { kind: 'trade', decimal: 'point', mark: 'point', datas: null, ask: true, net: null, nome: 'Match-Trader' },
    f19: { kind: 'trade', decimal: 'comma', mark: 'comma', datas: 'dmy', ask: false, net: true, nome: 'Profit (Nelogica)' },
    f19p: { kind: 'trade', decimal: null, mark: 'comma', datas: 'dmy', ask: false, net: null, nome: 'Profit (Nelogica)' },
  }

  it.each(Object.keys(ESPERADO) as (keyof typeof ESPERADO)[])(
    '%s from the names: the row kind, the board’s fields (suggestColumns per kind), the decimal and date decisions, the net pre-answer, the name',
    (k) => {
      const e = ESPERADO[k]
      const m = mapear(k)
      expect(m.match).toEqual({ kind: 'none' })
      expect([m.rowKind, m.decimal.decided, m.decimalMark, m.datas.decided, m.datas.ask, m.dateOrder, m.resultIsNet]).toEqual([
        e.kind,
        e.decimal,
        e.mark,
        e.datas,
        e.ask,
        e.ask ? null : e.datas,
        e.net,
      ])
      expect(porNome(m)).toEqual(CAMPOS[k])
      // Both kinds are the domain's pre-fill, with the file's own decimal mark and date order (§5.3 step 1)
      const n = m.lido.headers.length
      const dec = sniffDecimalMark(m.lido.records, Array(n).fill('quantity'), m.lido.delimiter)
      const values = { records: m.lido.records, decimalMark: dec.decided ?? dec.fallback, dateOrder: sniffDateOrder(m.lido.records, Array(n).fill('time')).decided }
      for (const kind of ['trade', 'fill'] as const) {
        expect(m.colunas[kind]).toEqual(suggestColumns(m.lido.headers, kind, mercado(k), values))
        expect(m.sugeridas[kind]).toEqual(m.colunas[kind])
      }
      expect([m.nome, m.nomePadrao, m.origem, m.salvar, m.porModelo, m.inicio, m.mudando]).toEqual([e.nome, e.nome, 'nomes', true, false, 'mapa', false])
      expect([m.separador, m.accountValue, m.endOfFile, m.sideWords, m.openCloseWords]).toEqual([m.lido.delimiter, null, {}, {}, {}])
      expect(m.novas.every((x) => !x)).toBe(true)
    },
  )

  it('8 in Top One (8 · «Conta que já recebe outro formato»): «Minha plataforma»', () => {
    expect([mapear('f8', [], 'topOne').nome, mapear('f8', [], 'topOne').nomePadrao]).toEqual(['Minha plataforma', 'Minha plataforma'])
  })

  it('the sniff’s failures come back as codes', () => {
    const ctx = { market: 'futures' as const, templates: [], nomePadrao: 'Minha plataforma' }
    expect(iniciarMapeamento(arquivo('f9ilegivel'), ctx)).toEqual({ ok: false, error: 'header_not_found' })
    const largo = Array.from({ length: 101 }, (_, i) => `c${i}`).join(',')
    expect(iniciarMapeamento({ ...arquivo('f8'), text: `${largo}\n${largo}` }, ctx)).toEqual({ ok: false, error: 'too_many_columns', line: 1 })
    expect(iniciarMapeamento({ ...arquivo('f8'), text: 'Data;Ativo;Qtd' }, ctx)).toEqual({ ok: false, error: 'empty_file' })
  })

  it('15 · «As mesmas colunas»: the model taken as is, straight to «Prévia»', () => {
    const modelo = modeloBlackArrow()
    const m = mapear('f15', [modelo])
    expect(m.match).toEqual({ kind: 'exact', template: modelo })
    expect([m.porModelo, m.inicio, m.origem, m.salvar, m.nome, m.nomePadrao, m.resultIsNet]).toEqual([true, 'previa', 'modelo', true, 'BlackArrow', 'BlackArrow', true])
    expect(porNome(m)).toEqual(BLACKARROW_FIELDS)
    expect([m.decimalMark, m.dateOrder, m.rowKind]).toEqual(['comma', 'dmy', 'trade'])
  })

  it('15 · «Uma coluna a mais»: a changed model pre-fills «mapa»; «Estratégia» is new («Escolha…», «nova»)', () => {
    const modelo = modeloBlackArrow()
    const m = mapear('f15b', [modelo])
    expect(m.match).toEqual({ kind: 'changed', template: modelo, shared: 9 })
    expect([m.porModelo, m.inicio, m.origem, m.salvar, m.nome]).toEqual([false, 'mapa', 'modelo', true, 'BlackArrow'])
    expect(m.colunas.trade).toEqual([...modelo.columns, null])
    expect(m.sugeridas.trade).toEqual(m.colunas.trade)
    expect(m.novas).toEqual([false, false, false, false, false, false, false, false, false, true])
    expect(bloqueioDoMapa(m, 'futures')).toBeNull()
  })

  it('a name the model knows and ignores is «Ignorar esta coluna»', () => {
    const modelo = modeloTradovate()
    const m = mapear('f16ta', [modelo])
    expect(m.colunas.fill.filter((c) => c === 'ignorar')).toHaveLength(6)
    expect(m.colunas.fill.filter((c) => c === null)).toHaveLength(0)
    expect(escolhasDe(m).columns).toEqual(modelo.columns)
  })

  it('16 · the saved «Tradovate»: a closing file goes to «Prévia»; one ending positioned starts on «conferir» (owner decision 3, D20)', () => {
    const modelo = modeloTradovate()
    const fecha = mapear('f16t', [modelo])
    expect([fecha.match.kind, fecha.porModelo, fecha.inicio]).toEqual(['exact', true, 'previa'])
    const posicionado = mapear('f16ta', [modelo])
    expect([posicionado.match.kind, posicionado.porModelo, posicionado.inicio, posicionado.origem]).toEqual(['exact', true, 'conferir', 'modelo'])
    expect(ler(posicionado, 'f16ta').endOfFile.map((q) => q.key)).toEqual(['MESZ6'])
  })

  it('19 · its own model saved without the «X» answer: «mapa» asks again (porModelo false); with «Venda» saved, «Prévia»', () => {
    const pulou = modeloDe({ ...mapear('f19'), sideWords: { x: 'skip' } }, 'America/Sao_Paulo', UUID_19)
    expect(pulou.sideWords).toEqual({})
    const m = mapear('f19', [pulou])
    expect([m.match.kind, m.porModelo, m.inicio, m.origem]).toEqual(['exact', false, 'mapa', 'modelo'])
    expect(bloqueioDoMapa(m, 'b3')).toBe('Diga o que quer dizer “X”.')
    const venda = modeloDe({ ...mapear('f19'), sideWords: { x: 'sell' } }, 'America/Sao_Paulo', UUID_19)
    const n = mapear('f19', [venda])
    expect([n.match.kind, n.porModelo, n.inicio, n.sideWords]).toEqual(['exact', true, 'previa', { x: 'sell' }])
  })

  it('an exact model whose facts the file contradicts (another decimal mark) goes to «mapa» with the file’s mark', () => {
    const modelo: Template = { ...modeloBlackArrow(), decimalMark: 'point' }
    const m = mapear('f15', [modelo])
    expect([m.match.kind, m.porModelo, m.inicio, m.decimalMark]).toEqual(['exact', false, 'mapa', 'comma'])
  })
})

describe('escolhasDe', () => {
  it('«Ignorar esta coluna» and «Escolha…» are both no field; the decimal falls back; resultIsNet only when it is asked', () => {
    const m = mapear('f8')
    const colunas = m.colunas.trade.slice()
    colunas[8] = 'ignorar'
    const c = escolhasDe({ ...m, colunas: { ...m.colunas, trade: colunas }, decimalMark: null })
    expect(c.columns[8]).toBeNull()
    expect(c.decimalMark).toBe(m.decimal.fallback)
    expect(c).toMatchObject({ rowKind: 'trade', headers: m.lido.headers, headerSkip: 0, delimiter: ';', dateOrder: 'dmy', resultIsNet: true })
    // Without a cost the net question is not asked: null whatever the state holds
    const semCusto = m.colunas.trade.map((f) => (f === 'commission' ? 'ignorar' : f))
    expect(escolhasDe({ ...m, colunas: { ...m.colunas, trade: semCusto } }).resultIsNet).toBeNull()
  })

  it('the row kind picks its own columns', () => {
    const m = mapear('f16t')
    expect(escolhasDe({ ...m, rowKind: 'trade' }).columns).toEqual(m.colunas.trade)
    expect(escolhasDe(m).columns).toEqual(m.colunas.fill)
  })
})

describe('arquivoDoMapeamento', () => {
  it('is parseMappedRecords on the same input (the zone given or not, the model’s id and hint)', () => {
    const m = mapear('f8')
    for (const tz of [null, 'America/New_York']) {
      expect(arquivoDoMapeamento(m, 'futures', tz)).toEqual(
        parseMappedRecords({ records: m.lido.records, choices: escolhasDe(m), market: 'futures', accountValue: null, endOfFile: {}, templateId: null, tzHint: null, fileTz: tz }),
      )
    }
    const modelo = modeloBlackArrow()
    const f = ler(mapear('f15', [modelo]), 'f15')
    expect(f.format.template).toBe(modelo.id)
    expect(f.fileTzHint).toBe('America/New_York')
    expect(f.needsFileTz).toBe(true)
  })

  it('the end-of-file answers given on «conferir» (every account) reach the chosen account’s read under its symbol (f16c)', () => {
    const m = mapear('f16c')
    const respostas = { [endOfFileKey('MESZ6', 'LT50K-0193')]: 'yes' as const }
    const dado = { ...m, endOfFile: { ...respostas } }
    // Every account: the answer under its composite key
    expect(ler(dado, 'f16c').endOfFile.map((q) => [q.key, q.answer])).toEqual([
      [endOfFileKey('MESZ6', 'LT50K-0193'), 'yes'],
      [endOfFileKey('MESZ6', 'LT50K-0194'), 'unknown'],
    ])
    // LT50K-0193 chosen: one question, keyed by the symbol, answered
    const uma = ler({ ...dado, accountValue: 'LT50K-0193' }, 'f16c')
    expect(uma.endOfFile.map((q) => [q.key, q.account, q.answer])).toEqual([['MESZ6', null, 'yes']])
    expect(uma.errors.map((e) => `${e.line} ${e.code}`)).toEqual(['7 open_at_end'])
    expect(uma.rows).toHaveLength(1)
    // The same value written another way still matches (accountKey)
    expect(ler({ ...dado, accountValue: ' lt50k-0193 ' }, 'f16c').endOfFile.map((q) => q.answer)).toEqual(['yes'])
    // The other account: that answer is dropped
    const outra = ler({ ...dado, accountValue: 'LT50K-0194' }, 'f16c')
    expect(outra.endOfFile.map((q) => [q.key, q.answer])).toEqual([['MESZ6', 'unknown']])
    expect(outra.errors.every((e) => e.code === 'unbalanced_symbol')).toBe(true)
    // The state itself is never re-keyed
    expect(dado.endOfFile).toEqual(respostas)
  })

  it('a plain key (a file with one «Conta» value) is kept when a value is chosen', () => {
    const m = { ...mapear('f16ta'), endOfFile: { MESZ6: 'no' as const }, accountValue: 'LT50K-0193' }
    expect(ler(m, 'f16ta').endOfFile.map((q) => [q.key, q.answer])).toEqual([['MESZ6', 'no']])
  })
})

describe('cabecalhoDoLeitor', () => {
  it('the first record of the comma read: one cell for a «;» file, every name for a «,» file', () => {
    expect(cabecalhoDoLeitor(arquivo('f8'))).toEqual(['Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Nº Negócio'])
    expect(cabecalhoDoLeitor(arquivo('f17'))).toEqual([
      'Trade number',
      'Instrument',
      'Account',
      'Market pos.',
      'Qty',
      'Entry price',
      'Exit price',
      'Entry time',
      'Exit time',
      'Profit',
      'Commission',
    ])
    expect(cabecalhoDoLeitor({ ...arquivo('f8'), text: '' })).toEqual([])
  })
})

describe('mudarColunas', () => {
  it('from «Prévia» (15) and from «conferir» (16 ending positioned): the model’s columns to change, every answer kept', () => {
    for (const [k, modelo] of [
      ['f15', modeloBlackArrow()],
      ['f16ta', modeloTradovate()],
    ] as const) {
      const m = { ...mapear(k, [modelo]), endOfFile: { MESZ6: 'yes' as const } }
      const n = mudarColunas(m)
      expect([n.porModelo, n.origem, n.mudando, n.salvar, n.inicio, n.nome]).toEqual([false, 'modelo', true, true, m.inicio, modelo.name])
      expect([n.colunas, n.endOfFile, n.decimalMark, n.dateOrder, n.resultIsNet]).toEqual([m.colunas, m.endOfFile, m.decimalMark, m.dateOrder, m.resultIsNet])
      expect(modeloASalvar(n, { tzHint: 'America/New_York', rota: null })).toMatchObject({ tipo: 'atualizado', replaces: modelo.id, nome: modelo.name })
    }
  })
})

describe('modeloASalvar', () => {
  it('from the names: «salvo», no p_replaces, the typed name (or the default when emptied), the model’s names and choices only', () => {
    const m = mapear('f8')
    const s = modeloASalvar(m, { tzHint: 'America/New_York', rota: null })
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'BlackArrow' })
    expect(s?.payload).toEqual({
      v: 1,
      name: 'BlackArrow',
      headers: m.lido.headers,
      header_skip: 0,
      delimiter: 'semicolon',
      decimal_mark: 'comma',
      date_order: 'dmy',
      row_kind: 'trade',
      columns: BLACKARROW_FIELDS,
      result_is_net: true,
      side_words: {},
      open_close_words: {},
      account_routes: {},
      tz_hint: 'America/New_York',
    })
    expect(modeloASalvar({ ...m, nome: '  Meu  ' }, { tzHint: null, rota: null })?.payload.name).toBe('Meu')
    expect(modeloASalvar({ ...m, nome: '   ' }, { tzHint: null, rota: null })?.nome).toBe('BlackArrow')
  })

  it('«Salvar como modelo» unchecked: nothing to save', () => {
    expect(modeloASalvar({ ...mapear('f8'), salvar: false }, { tzHint: null, rota: null })).toBeNull()
  })

  it('a changed model: «atualizado» re-keys it; a model taken as is: «tocado», no p_replaces', () => {
    const modelo = modeloBlackArrow()
    expect(modeloASalvar(mapear('f15b', [modelo]), { tzHint: 'America/New_York', rota: null })).toMatchObject({ tipo: 'atualizado', replaces: modelo.id, nome: 'BlackArrow' })
    expect(modeloASalvar(mapear('f15', [modelo]), { tzHint: 'America/New_York', rota: null })).toMatchObject({ tipo: 'tocado', replaces: null, nome: 'BlackArrow' })
  })

  it('a «Conta» column: the model’s routes plus the value imported now, as a hash; none without the column', () => {
    const apex = CONTAS_QUADRO.apexA
    const m = mapear('f17')
    const s = modeloASalvar(m, { tzHint: 'America/New_York', rota: { valor: 'APX-0001', contaId: apex.id } })
    expect(s?.payload.account_routes).toEqual({ [accountRouteHash('APX-0001')]: apex.id })
    expect(JSON.stringify(s?.payload)).not.toContain('APX-0001')
    expect(
      checkTemplate(s?.payload, {
        batch: { sig: m.lido.sig, market: 'futures' },
        accounts: [{ id: apex.id, market: 'futures', archived: false }],
      }),
    ).toBeNull()
    // No «Conta» column: never a route
    expect(modeloASalvar(mapear('f8'), { tzHint: null, rota: { valor: 'APX-0001', contaId: apex.id } })?.payload.account_routes).toEqual({})
  })

  it('keeps the model’s routes; at most 50 (a 51st is not added, a known one is updated)', () => {
    const apex = CONTAS_QUADRO.apexA
    const s0 = modeloASalvar(mapear('f17'), { tzHint: 'America/New_York', rota: null })
    if (!s0) throw new Error('nothing to save')
    const cheio: Record<string, string> = {}
    for (let i = 0; i < 50; i++) cheio[accountRouteHash(`APX-${1000 + i}`)] = apex.id
    const base = templateFromRow({ ...s0.payload, id: UUID_19, header_sig: headerSignature(s0.payload.headers), account_routes: cheio })
    if (!base) throw new Error('model row not usable')
    const m = mapear('f17', [base])
    expect(m.match.kind).toBe('exact')
    const novo = modeloASalvar(mudarColunas(m), { tzHint: null, rota: { valor: 'APX-0001', contaId: apex.id } })
    expect(Object.keys(novo?.payload.account_routes ?? {})).toHaveLength(50)
    expect(novo?.payload.account_routes[accountRouteHash('APX-0001')]).toBeUndefined()
    const outra = CONTAS_QUADRO.topOne.id
    const conhecido = modeloASalvar(mudarColunas(m), { tzHint: null, rota: { valor: 'APX-1000', contaId: outra } })
    expect(Object.keys(conhecido?.payload.account_routes ?? {})).toHaveLength(50)
    expect(conhecido?.payload.account_routes[accountRouteHash('APX-1000')]).toBe(outra)
  })

  it.each(ARQUIVOS)('%s: the payload the database would take (checkTemplate) with the board’s answers', (k) => {
    let m = mapear(k, k === 'f15' || k === 'f15b' ? [modeloBlackArrow()] : [])
    // 18 · «Datas ambíguas»: «dia/mês», then «Não, é bruto» (pre-answered once the dates read: L1's comDatas)
    if (k === 'f18a') m = { ...m, dateOrder: 'dmy', resultIsNet: false }
    if (k === 'f19' || k === 'f19p') m = { ...m, sideWords: { x: 'sell' } }
    expect(bloqueioDoMapa(m, mercado(k))).toBeNull()
    expect(bloqueioDoConferir(m, mercado(k))).toBeNull()
    const s = modeloASalvar(m, { tzHint: conta(k).file_tz, rota: null })
    expect(s).not.toBeNull()
    expect(checkTemplate(s?.payload)).toBeNull()
  })
})

describe('bloqueioDoMapa (B0 order)', () => {
  const com = (m: Mapeamento, i: number, c: ColunaUi): Mapeamento => {
    const colunas = m.colunas[m.rowKind].slice()
    colunas[i] = c
    return { ...m, colunas: { ...m.colunas, [m.rowKind]: colunas } }
  }

  it('8: nothing blocks; another separator than the file’s reads first («Confira como ler o arquivo.»)', () => {
    const m = mapear('f8')
    expect(bloqueioDoMapa(m, 'futures')).toBeNull()
    expect(bloqueioDoMapa({ ...com(m, 1, 'quantity'), separador: ',' }, 'futures')).toBe('Confira como ler o arquivo.')
  })

  it('then the date order, then the decimal question with nothing pressed', () => {
    const a = mapear('f18a')
    expect(bloqueioDoMapa(a, 'forex')).toBe('Escolha a ordem das datas.')
    expect(bloqueioDoMapa({ ...a, dateOrder: 'dmy' }, 'forex')).toBeNull()
    const p = mapear('f19p')
    expect(bloqueioDoMapa({ ...p, sideWords: { x: 'sell' } }, 'b3')).toBeNull()
    expect(bloqueioDoMapa({ ...p, decimalMark: null, sideWords: { x: 'sell' } }, 'b3')).toBe('Escolha como ler os números.')
    expect(bloqueioDoMapa({ ...p, decimalMark: null, datas: a.datas, dateOrder: null }, 'b3')).toBe('Escolha a ordem das datas.')
  })

  it('then a required field missing (8: Papel → «Quantidade»), then a field in two columns', () => {
    const m = mapear('f8')
    expect(bloqueioDoMapa(com(m, 1, 'quantity'), 'futures')).toBe('Marque as colunas obrigatórias.')
    expect(bloqueioDoMapa(com(m, 7, 'quantity'), 'futures')).toBe('Cada campo vai em uma coluna só.')
    // «Outra taxa» may take several columns
    expect(bloqueioDoMapa(com(mapear('f19'), 7, 'fee'), 'b3')).toBe('Diga o que quer dizer “X”.')
  })

  it('a signed quantity stands for «Lado» (IBKR); without «Quantidade» both are missing', () => {
    const m = mapear('f16i')
    expect(bloqueioDoMapa(m, 'stocks')).toBeNull()
    expect(bloqueioDoMapa(com(m, 2, null), 'stocks')).toBe('Marque as colunas obrigatórias.')
  })

  it('then «Swap ou funding» without «Resultado» («Confira as colunas marcadas.»)', () => {
    const m = mapear('f18')
    expect(bloqueioDoMapa(com(m, 10, 'ignorar'), 'forex')).toBe('Confira as colunas marcadas.')
  })

  it('then the first side word nobody answered (19: «X»); «Venda» or «Pular essas linhas» answers it', () => {
    const m = mapear('f19')
    expect(bloqueioDoMapa(m, 'b3')).toBe('Diga o que quer dizer “X”.')
    expect(bloqueioDoMapa({ ...m, sideWords: { x: 'sell' } }, 'b3')).toBeNull()
    expect(bloqueioDoMapa({ ...m, sideWords: { x: 'skip' } }, 'b3')).toBeNull()
  })
})

describe('lerArquivoMapeavel', () => {
  it('reads a File again as text: UTF-8 with its BOM dropped, CRLF kept; the name, size and hash are readImportFile’s', async () => {
    const texto = 'Data/Hora;Papel;Res. Líq.\r\n01/10/2026 09:34:31;MESZ6;-39,98\r\n'
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Array.from(Buffer.from(texto, 'utf8'))])
    const file = new File([bytes], 'blackarrow.csv', { type: 'text/csv' })
    const lido = { fileName: 'blackarrow.csv', size: bytes.length, sha256: 'cd'.repeat(32) }
    expect(await lerArquivoMapeavel(file, lido)).toEqual({ ...lido, text: texto })
  })

  it('a windows-1252 file (Excel on Windows) reads as the readers read it', async () => {
    const bytes = new Uint8Array([...Array.from(Buffer.from('Papel;Res. L', 'latin1')), 0xed, ...Array.from(Buffer.from('q.\n', 'latin1'))])
    const file = new File([bytes], 'b3.csv')
    expect((await lerArquivoMapeavel(file, { fileName: 'b3.csv', size: bytes.length, sha256: '' })).text).toBe('Papel;Res. Líq.\n')
  })

  it('uses Blob.arrayBuffer where the runtime has it', async () => {
    const bytes = Buffer.from('a,b\n1,2\n', 'utf8')
    const blob = { arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) } as unknown as Blob
    expect((await lerArquivoMapeavel(blob, { fileName: '', size: 8, sha256: '' })).text).toBe('a,b\n1,2\n')
  })
})

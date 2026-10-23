/**
 * Phase 3b · telas, B0: the column-mapping import's shared state (lib/hub/importMapeado) on the board's files
 * (testing/mapeadoTelas). Lane L1 adds the edits of contract §5.2 and the pre-fill of §5.3 here: the pre-fill gives the
 * board's columns and tags on every file, «Separador» re-reads the same header line, the decimal and the dates are
 * decided again on a column change with the pressed pills kept, each row kind keeps its own edits, the blocks of
 * «Continuar» and «Usar estas colunas» come in §5.6's order, and a mapping both let through always saves.
 */
import {
  MAX_TEMPLATE_NAME,
  accountRouteHash,
  checkTemplate,
  endOfFileKey,
  headerSignature,
  normaliseHeaders,
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
  arquivoDeTodasAsContas,
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  cabecalhoDoLeitor,
  checagemDaColuna,
  colunaDoLado,
  comColuna,
  comDatas,
  comDecimal,
  comFimDoArquivo,
  comLiquido,
  comModo,
  comNome,
  comPalavraDeLado,
  comSalvar,
  comSeparador,
  escolhasDe,
  foraDoPasso,
  idsQueSeRepetem,
  iniciarMapeamento,
  lerArquivoMapeavel,
  marcaDeLeitura,
  mercadosDeOutroMercado,
  modeloASalvar,
  modeloSoParaLer,
  mudarColunas,
  fusoDoModelo,
  nomeNoMercado,
  nomePadraoDoModelo,
  notaDeLeitura,
  sobrescreveModelo,
  type MercadosDosModelos,
  type ArquivoMapeavel,
  type ColunaUi,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { B3_FIELDS, BLACKARROW_FIELDS, BN_FIELDS, FOREX_FIELDS, IB_FIELDS, NINJA_FIELDS, PERFORMANCE_FIELDS, TV_FIELDS } from '@/testing/mappedFiles'
import {
  ARQUIVOS_QUADRO,
  CONTAS_QUADRO,
  CONTA_DO_ARQUIVO,
  MODELO_BLACKARROW_LINHA,
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

/** The fields only (no «Ignorar esta coluna»), by the file's normalised names */
const campos = (m: Mapeamento, kind: RowKind = m.rowKind) => {
  const out: Record<string, ColunaUi> = {}
  m.lido.headers.forEach((h, i) => {
    const c = m.colunas[kind][i]
    if (c !== null && c !== 'ignorar') out[h] = c
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
      expect(campos(m)).toEqual(CAMPOS[k])
      // Both kinds start from the domain's pre-fill, with the file's own decimal mark and date order (§5.3 step 1): its
      // suggestions are kept; in the file's own kind L1 adds only «Ignorar esta coluna» where the domain suggests nothing;
      // the other kind also reads a name of the other reading (the board's second COLS_* column, tested below)
      const n = m.lido.headers.length
      const dec = sniffDecimalMark(m.lido.records, Array(n).fill('quantity'), m.lido.delimiter)
      const values = { records: m.lido.records, decimalMark: dec.decided ?? dec.fallback, dateOrder: sniffDateOrder(m.lido.records, Array(n).fill('time')).decided }
      for (const kind of ['trade', 'fill'] as const) {
        const dominio = suggestColumns(m.lido.headers, kind, mercado(k), values)
        if (kind === m.rowKind) expect(m.colunas[kind].map((c) => (c === 'ignorar' ? null : c))).toEqual(dominio)
        m.colunas[kind].forEach((c, i) => {
          if (dominio[i] !== null) expect(c).toBe(dominio[i])
        })
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
    const dominio = (cs: ColunaUi[]) => cs.map((c) => (c === 'ignorar' ? null : c))
    expect(escolhasDe({ ...m, rowKind: 'trade' }).columns).toEqual(dominio(m.colunas.trade))
    expect(escolhasDe(m).columns).toEqual(dominio(m.colunas.fill))
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

describe('owner decision (23 Oct): a model saved in another market', () => {
  const BA = MODELO_BLACKARROW_LINHA.id
  const futuros: MercadosDosModelos = { [BA]: ['futures'] }

  /** b3.csv (BlackArrow’s columns + «Emolumentos») in Mini-índice (B3), with «X» = Venda */
  function naB3(mercados: MercadosDosModelos | null | undefined, templates: readonly Template[] = [modeloBlackArrow()]): Mapeamento {
    const c = CONTAS_QUADRO.mini
    const r = iniciarMapeamento(arquivo('f19'), { market: 'b3', templates, nomePadrao: nomePadraoDoModelo(c.platform), mercados })
    if (!r.ok) throw new Error(r.error)
    return comPalavraDeLado(r.mapeamento, 'x', 'sell', 'b3')
  }

  it('mercadosDeOutroMercado: the batches’ markets without this one; none for a model of this market or with no batch; unknown counts as another', () => {
    const t = modeloBlackArrow()
    expect(mercadosDeOutroMercado(t, 'b3', futuros)).toEqual(['futures'])
    expect(mercadosDeOutroMercado(t, 'b3', { [BA]: ['futures', 'forex'] })).toEqual(['futures', 'forex'])
    expect(mercadosDeOutroMercado(t, 'futures', futuros)).toBeUndefined()
    expect(mercadosDeOutroMercado(t, 'b3', { [BA]: ['futures', 'b3'] })).toBeUndefined()
    // No batch yet: fits every market
    expect(mercadosDeOutroMercado(t, 'b3', {})).toBeUndefined()
    expect(mercadosDeOutroMercado(t, 'b3', { [BA]: [] })).toBeUndefined()
    // Not given (as before the decision): fits; the read failed: another market's, markets unknown
    expect(mercadosDeOutroMercado(t, 'b3', undefined)).toBeUndefined()
    expect(mercadosDeOutroMercado(t, 'b3', null)).toEqual([])
  })

  it('nomeNoMercado: «{model} · {market}», never past 60 characters, a market suffix replaced', () => {
    expect(nomeNoMercado('BlackArrow', 'b3')).toBe('BlackArrow · B3')
    expect(nomeNoMercado('  Tradovate ', 'stocks')).toBe('Tradovate · Ações')
    expect(nomeNoMercado('BlackArrow · B3', 'futures')).toBe('BlackArrow · Futuros')
    const longo = 'M'.repeat(MAX_TEMPLATE_NAME)
    const n = nomeNoMercado(longo, 'forex')
    expect(Array.from(n)).toHaveLength(MAX_TEMPLATE_NAME)
    expect(n.endsWith(' · Forex')).toBe(true)
    expect(nomeNoMercado(`${'M'.repeat(40)}${'ã'.repeat(30)}`, 'crypto').length).toBeLessThanOrEqual(MAX_TEMPLATE_NAME)
  })

  it('a changed match (b3.csv after «BlackArrow» of Futuros): offered, «Atualizar» unchecked, the new model’s name ready', () => {
    const m = naB3(futuros)
    expect(m.match).toMatchObject({ kind: 'changed', template: { id: BA }, shared: 9 })
    expect([m.origem, m.inicio, m.porModelo, m.salvar, m.nome, m.nomePadrao, m.outroMercado]).toEqual([
      'modelo',
      'mapa',
      false,
      false,
      'BlackArrow · B3',
      'BlackArrow · B3',
      ['futures'],
    ])
    expect(modeloSoParaLer(m)).toBe(false)
    // The model’s columns as on the board (the same pre-fill)
    expect(m.colunas.trade).toEqual(naB3({}).colunas.trade)
    expect(bloqueioDoMapa(m, 'b3')).toBeNull()
    expect(bloqueioDoConferir(m, 'b3')).toBeNull()
  })

  it('the same file with the model of this market (or with no batch, or the markets not given): as on the board, «Atualizar» checked', () => {
    const casos: (MercadosDosModelos | undefined)[] = [{ [BA]: ['b3'] }, { [BA]: ['futures', 'b3'] }, {}, undefined]
    for (const mercados of casos) {
      const m = naB3(mercados)
      expect([m.salvar, m.nome, m.outroMercado]).toEqual([true, 'BlackArrow', undefined])
      expect(modeloASalvar(m, { tzHint: 'America/Sao_Paulo', rota: null })).toMatchObject({ tipo: 'atualizado', replaces: BA, nome: 'BlackArrow' })
    }
  })

  it('left unchecked, the import saves a NEW model: «salvo», no p_replaces, «BlackArrow · B3», the file’s own columns', () => {
    const m = naB3(futuros)
    const s = modeloASalvar(m, { tzHint: 'America/Sao_Paulo', rota: null })
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'BlackArrow · B3' })
    expect(s?.payload).toMatchObject({ name: 'BlackArrow · B3', headers: m.lido.headers, side_words: { x: 'sell' }, tz_hint: 'America/Sao_Paulo', account_routes: {} })
    expect(headerSignature(s?.payload.headers ?? [])).not.toBe(MODELO_BLACKARROW_LINHA.header_sig)
    expect(checkTemplate(s?.payload)).toBeNull()
    // A name typed in «Nome do modelo»; emptied, the default
    expect(modeloASalvar(comNome(m, 'Clear B3'), { tzHint: null, rota: null })?.payload.name).toBe('Clear B3')
    expect(modeloASalvar(comNome(m, '  '), { tzHint: null, rota: null })?.payload.name).toBe('BlackArrow · B3')
  })

  it('checked, it updates that model under its own name; neither way keeps that market’s «Conta» routes', () => {
    const m = comSalvar(naB3(futuros), true)
    expect(modeloASalvar(m, { tzHint: 'America/Sao_Paulo', rota: null })).toMatchObject({ tipo: 'atualizado', replaces: BA, nome: 'BlackArrow', payload: { name: 'BlackArrow' } })
    // NinjaTrader with a route to Apex A (Futuros), read in a Forex account: the routes go
    const apex = CONTAS_QUADRO.apexA
    const s0 = modeloASalvar(mapear('f17'), { tzHint: 'America/New_York', rota: { valor: 'APX-0001', contaId: apex.id } })
    if (!s0) throw new Error('nothing to save')
    const ninja = templateFromRow({ ...s0.payload, id: UUID_19, header_sig: headerSignature(s0.payload.headers) })
    if (!ninja) throw new Error('model row not usable')
    const r = iniciarMapeamento(arquivo('f17'), { market: 'forex', templates: [ninja], nomePadrao: 'x', mercados: { [UUID_19]: ['futures'] } })
    if (!r.ok) throw new Error(r.error)
    expect([r.mapeamento.match.kind, modeloSoParaLer(r.mapeamento)]).toEqual(['exact', true])
    const changed = { ...r.mapeamento, match: { kind: 'changed' as const, template: ninja, shared: 10 } }
    // A value the model has no route for (APX-0002): only its route is saved, never APX-0001's to Apex A
    expect(ninja.accountRoutes).toEqual({ [accountRouteHash('APX-0001')]: apex.id })
    for (const x of [changed, comSalvar(changed, true)]) {
      expect(modeloASalvar(x, { tzHint: null, rota: { valor: 'APX-0002', contaId: CONTAS_QUADRO.e8.id } })?.payload.account_routes).toEqual({
        [accountRouteHash('APX-0002')]: CONTAS_QUADRO.e8.id,
      })
    }
  })

  it('an exact match of another market is only read: taken as is (or through «mapa»), never touched, updated or saved again', () => {
    const t = modeloBlackArrow()
    const r = iniciarMapeamento(arquivo('f15'), { market: 'futures', templates: [t], nomePadrao: 'Ylos', mercados: { [BA]: ['b3'] } })
    if (!r.ok) throw new Error(r.error)
    const m = r.mapeamento
    expect([m.match.kind, m.porModelo, m.inicio, m.salvar, m.outroMercado]).toEqual(['exact', true, 'previa', false, ['b3']])
    expect(modeloSoParaLer(m)).toBe(true)
    expect(modeloASalvar(m, { tzHint: 'America/New_York', rota: null })).toBeNull()
    // «Mudar colunas»: still only read («Atualizar» unchecked, nothing saved)
    const mudou = mudarColunas(m)
    expect([mudou.salvar, mudou.porModelo, modeloSoParaLer(mudou)]).toEqual([false, false, true])
    expect(modeloASalvar(mudou, { tzHint: null, rota: null })).toBeNull()
    expect(modeloASalvar(comSalvar(mudou, true), { tzHint: null, rota: null })).toBeNull()
    // Its zone is no hint here; the same model of this market’s is
    expect([fusoDoModelo(m), ler(m, 'f15').fileTzHint]).toEqual([null, null])
    expect(fusoDoModelo(mapear('f15', [t]))).toBe('America/New_York')
    // The model’s id still names the file’s format (p_format.template)
    expect(ler(m, 'f15').format).toEqual({ sig: t.sig, template: BA })
  })

  it('«Mudar colunas» of a model of this market checks «Atualizar» as before; of another market’s changed one, unchecked', () => {
    expect(mudarColunas(mapear('f15', [modeloBlackArrow()])).salvar).toBe(true)
    expect(mudarColunas(naB3(futuros)).salvar).toBe(false)
  })

  it('«Separador» keeps another market’s model while the re-read file still matches it; one it no longer matches is a new model', () => {
    const r = iniciarMapeamento(arquivo('f15'), { market: 'futures', templates: [modeloBlackArrow()], nomePadrao: 'Ylos', mercados: { [BA]: ['b3'] } })
    if (!r.ok) throw new Error(r.error)
    const m = mudarColunas(r.mapeamento)
    expect([m.outroMercado, m.salvar, m.nome]).toEqual([['b3'], false, 'BlackArrow · Futuros'])
    const virgula = ARQUIVOS_QUADRO.f15.texto
      .split(/\r?\n/)
      .map((l) => l.replace(/\.(?=\d{3}[,;])/g, '').replace(/,/g, '.').replace(/;/g, ','))
      .join('\n')
    const igual = comSeparador(m, { ...arquivo('f15'), text: virgula }, ',', 'futures')
    expect([igual.lido.delimiter, igual.origem, igual.outroMercado, igual.salvar, igual.nome]).toEqual([',', 'modelo', ['b3'], false, 'BlackArrow · Futuros'])
    const outro = comSeparador(m, { ...arquivo('f15'), text: ['Data/Hora;Papel,C/V;Qtd', '01/10/2026 09:34:31;MESZ6,C;2'].join('\n') }, ',', 'futures')
    expect([outro.lido.delimiter, outro.origem, outro.outroMercado, outro.salvar, outro.nome]).toEqual([',', 'nomes', undefined, true, 'BlackArrow · Futuros'])
  })
})

describe('review (23 Oct): a new model never writes over a model the mapping did not match', () => {
  const BA = MODELO_BLACKARROW_LINHA.id
  const futuros: MercadosDosModelos = { [BA]: ['futures'] }
  const linhasDe = (texto: string) => texto.split(/\r?\n/)
  /** b3.csv (f19) without «Emolumentos»: BlackArrow’s very columns, B3 rows (invented) */
  const COLUNAS_BA = linhasDe(ARQUIVOS_QUADRO.f19.texto)
    .map((l) => l.split(';').filter((_, i) => i !== 8).join(';'))
    .join('\n')
  /** …each data line ending in «;», the header without it: the domain’s sniff reads it with «,» first */
  const ponto = (texto: string) =>
    linhasDe(texto)
      .map((l, i) => (i === 0 || l === '' ? l : `${l};`))
      .join('\n')
  const normalisedHeadersOf = (texto: string) => normaliseHeaders(linhasDe(texto)[0].split(';'))
  const a = (texto: string): ArquivoMapeavel => ({ fileName: 'b3-ba.csv', size: texto.length, sha256: 'ab'.repeat(32), text: texto })
  function iniciar(texto: string, market: AccountMarket, templates: readonly Template[] | null, mercados?: MercadosDosModelos | null): Mapeamento {
    const r = iniciarMapeamento(a(texto), { market, templates, nomePadrao: market === 'b3' ? 'Profit (Nelogica)' : 'Rithmic', mercados })
    if (!r.ok) throw new Error(r.error)
    return r.mapeamento
  }

  it('1 · «Separador» fixed in B3 on BlackArrow’s very columns: matched against every model, Futuros’ «BlackArrow» is only read', () => {
    expect(headerSignature(normalisedHeadersOf(COLUNAS_BA))).toBe(MODELO_BLACKARROW_LINHA.header_sig)
    const m = iniciar(ponto(COLUNAS_BA), 'b3', [modeloBlackArrow(), modeloTradovate()], futuros)
    // What the owner sees first: «,», «Não reconhecemos», «Salvar como modelo» checked under the platform’s name
    expect([m.lido.delimiter, m.match.kind, m.origem, m.salvar, m.nome]).toEqual([',', 'none', 'nomes', true, 'Profit (Nelogica)'])
    const n = comSeparador(m, a(ponto(COLUNAS_BA)), ';', 'b3')
    expect([n.separador, n.lido.delimiter, n.lido.headerSkip, n.lido.records.length]).toEqual([';', ';', 0, 18])
    expect(n.match).toMatchObject({ kind: 'exact', template: { id: BA } })
    expect([n.origem, n.outroMercado, n.salvar, n.porModelo, n.inicio, modeloSoParaLer(n)]).toEqual(['modelo', ['futures'], false, false, 'mapa', true])
    // Nothing saved (before: a «new» model with BlackArrow’s header set, which import_template_save wrote over it)
    const v = comPalavraDeLado(n, 'x', 'sell', 'b3')
    expect(modeloASalvar(v, { tzHint: 'America/Sao_Paulo', rota: null })).toBeNull()
    expect(modeloASalvar(comSalvar(v, true), { tzHint: 'America/Sao_Paulo', rota: null })).toBeNull()
    // Its New York is no hint for this file
    expect(fusoDoModelo(v)).toBeNull()
    expect(bloqueioDoMapa(v, 'b3')).toBeNull()
  })

  it('1 · …in BlackArrow’s own market: «Atualizar o modelo “BlackArrow”» under its own name, never renamed after a name typed before', () => {
    const m = comNome(iniciar(ponto(COLUNAS_BA), 'futures', [modeloBlackArrow()], futuros), 'Rithmic 2')
    const n = comSeparador(m, a(ponto(COLUNAS_BA)), ';', 'futures')
    expect([n.match.kind, n.origem, n.outroMercado, n.salvar, n.nome, n.nomePadrao]).toEqual(['exact', 'modelo', undefined, true, 'BlackArrow', 'BlackArrow'])
    const s = modeloASalvar(comPalavraDeLado(n, 'x', 'sell', 'futures'), { tzHint: 'America/New_York', rota: null })
    expect(s).toMatchObject({ tipo: 'atualizado', replaces: BA, nome: 'BlackArrow', payload: { name: 'BlackArrow' } })
    expect(sobrescreveModelo(s!, n.modelos)).toBe(false)
  })

  it('1 · a re-read that matches another market’s model with changed columns: unchecked, its new model’s name; that one writes over none', () => {
    const comEmol = ponto(ARQUIVOS_QUADRO.f19.texto)
    const m = iniciar(comEmol, 'b3', [modeloBlackArrow()], futuros)
    expect([m.lido.delimiter, m.match.kind]).toEqual([',', 'none'])
    const n = comPalavraDeLado(comSeparador(m, a(comEmol), ';', 'b3'), 'x', 'sell', 'b3')
    expect(n.match).toMatchObject({ kind: 'changed', template: { id: BA } })
    expect([n.outroMercado, n.salvar, n.nome, modeloSoParaLer(n)]).toEqual([['futures'], false, 'BlackArrow · B3', false])
    const s = modeloASalvar(comColuna(n, n.lido.headers.indexOf('emolumentos'), 'fee', 'b3'), { tzHint: 'America/Sao_Paulo', rota: null })
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'BlackArrow · B3' })
    expect(sobrescreveModelo(s!, n.modelos)).toBe(false)
  })

  it('a re-read with a model gone or still none keeps the owner’s «Salvar» and name, as before', () => {
    const m = comSalvar(comNome(iniciar(ponto(COLUNAS_BA), 'b3', [modeloTradovate()], futuros), 'Clear'), false)
    const n = comSeparador(m, a(ponto(COLUNAS_BA)), ';', 'b3')
    expect([n.match.kind, n.salvar, n.nome, n.nomePadrao, n.modelos]).toEqual(['none', false, 'Clear', 'Profit (Nelogica)', m.modelos])
  })

  it('2 · the models cannot be read (null): matched against none, and the «new» model counts as writing over one', () => {
    const m = iniciar(COLUNAS_BA, 'b3', null, futuros)
    expect([m.lido.delimiter, m.match.kind, m.origem, m.salvar, m.nome, m.modelos]).toEqual([';', 'none', 'nomes', true, 'Profit (Nelogica)', null])
    const s = modeloASalvar(comPalavraDeLado(m, 'x', 'sell', 'b3'), { tzHint: 'America/Sao_Paulo', rota: null })
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'Profit (Nelogica)' })
    // Unknown: not saved; read again at save time: BlackArrow has these very columns → not saved; none has them → saved
    expect(sobrescreveModelo(s!, null)).toBe(true)
    expect(sobrescreveModelo(s!, [modeloBlackArrow()])).toBe(true)
    expect(sobrescreveModelo(s!, [])).toBe(false)
    expect(sobrescreveModelo(s!, [modeloTradovate()])).toBe(false)
    // «Separador» on a mapping whose models are unknown matches none
    expect(comSeparador(iniciar(ponto(COLUNAS_BA), 'b3', null, futuros), a(ponto(COLUNAS_BA)), ';', 'b3').match.kind).toBe('none')
  })

  it('sobrescreveModelo never stops an update (the database refuses another model’s header set) or a touch', () => {
    const s = modeloASalvar(comSalvar(comPalavraDeLado(iniciar(ARQUIVOS_QUADRO.f19.texto, 'b3', [modeloBlackArrow()], futuros), 'x', 'sell', 'b3'), true), {
      tzHint: null,
      rota: null,
    })
    expect(s?.tipo).toBe('atualizado')
    expect(sobrescreveModelo(s!, null)).toBe(false)
    const tocado = modeloASalvar(mapear('f15', [modeloBlackArrow()]), { tzHint: null, rota: null })
    expect(tocado?.tipo).toBe('tocado')
    expect(sobrescreveModelo(tocado!, [modeloBlackArrow()])).toBe(false)
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

// ------------------------------------------------------------------------------------------------
// Lane L1 (contract §5.2, §5.3, §5.6)
// ------------------------------------------------------------------------------------------------

/** The headers as written whose select holds `valor` in `m`'s row kind */
const comValor = (m: Mapeamento, valor: ColunaUi, kind: RowKind = m.rowKind) => m.lido.rawHeaders.filter((_, i) => m.colunas[kind][i] === valor)

describe('the pre-fill (§5.3, E20): the board’s columns on every file', () => {
  /** §2.2: the columns pre-set to «Ignorar esta coluna» (tag «sugerida») and those left at «Escolha…», in the natural row kind */
  const QUADRO: Record<Exclude<ArquivoQuadroKey, 'f9ilegivel'>, { ignorar: string[]; escolha: string[] }> = {
    f8: { ignorar: [], escolha: [] },
    f8p: { ignorar: ['duration', 'buyFillId', 'sellFillId'], escolha: [] },
    f15: { ignorar: [], escolha: [] },
    f15b: { ignorar: [], escolha: ['Estratégia'] },
    f16t: { ignorar: ['avgPrice', 'filledQty', 'Status', 'Timestamp', 'Quantity', 'Limit Price'], escolha: [] },
    f16ta: { ignorar: ['avgPrice', 'filledQty', 'Status', 'Timestamp', 'Quantity', 'Limit Price'], escolha: [] },
    f16b: { ignorar: [], escolha: ['Amount'] },
    f16i: { ignorar: [], escolha: ['AssetClass'] },
    f16c: { ignorar: ['avgPrice', 'filledQty', 'Status', 'Timestamp', 'Quantity', 'Limit Price'], escolha: [] },
    f17: { ignorar: [], escolha: ['Trade number'] },
    f18: { ignorar: [], escolha: [] },
    f18a: { ignorar: [], escolha: [] },
    f19: { ignorar: [], escolha: [] },
    f19p: { ignorar: [], escolha: [] },
  }

  it.each(Object.keys(QUADRO) as (keyof typeof QUADRO)[])('%s', (k) => {
    const m = mapear(k)
    expect(comValor(m, 'ignorar')).toEqual(QUADRO[k].ignorar)
    expect(comValor(m, null)).toEqual(QUADRO[k].escolha)
    expect(m.sugeridas[m.rowKind]).toEqual(m.colunas[m.rowKind])
  })

  it('Performance.csv: the repeating IDs are the ones the note names; Tradovate’s twins and known names are not', () => {
    const p = mapear('f8p')
    expect(idsQueSeRepetem(p, 'futures').map((i) => p.lido.rawHeaders[i])).toEqual(['buyFillId', 'sellFillId'])
    expect(idsQueSeRepetem(mapear('f16t'), 'futures')).toEqual([])
    // The note stays when the owner changes the select (from the pre-fill, not the select)
    expect(idsQueSeRepetem(comColuna(p, 8, 'trade_id', 'futures'), 'futures')).toEqual([8, 9])
    // A model's own row kind has none
    expect(idsQueSeRepetem(mapear('f15b', [modeloBlackArrow()]), 'futures')).toEqual([])
  })

  it('the other row kind is pre-filled by the same rule (Tradovate as one trade per row)', () => {
    const m = mapear('f16t')
    expect(comValor(m, 'ignorar', 'trade')).toEqual(['Status'])
    expect(comValor(m, null, 'trade')).toEqual(['avgPrice', 'filledQty', 'Fill Time', 'Limit Price', 'Filled Qty', 'Avg Fill Price'])
    expect(comValor(m, 'entry_time', 'trade')).toEqual(['Timestamp'])
  })

  /**
   * Review 1, finding 4: both readings of every board file give the board's columns (IC l.797–1053, `col(nome, amostra,
   * tipo, op, ex)`: the op column read as one trade per row, the ex column as one execution per row), the other reading
   * included: a name of the other reading (Entry time → «Data e hora», Position ID → «ID da execução», Executed →
   * «Quantidade», Timestamp → «Entrada»), never an execution's own name as a trade's field, and an order's Limit Price
   * «Ignorar» only among executions
   */
  const B = (x: string): ColunaUi =>
    (({ '': null, ignorar: 'ignorar', entrada: 'entry_time', tempo: 'time', ativo: 'symbol', lado: 'side', qtd: 'quantity', pEntrada: 'entry_price', pSaida: 'exit_price', resultado: 'pnl', realizado: 'realized', comissao: 'commission', taxa: 'fee', id: 'trade_id', idExec: 'fill_id', conta: 'account', compraT: 'buy_time', vendaT: 'sell_time', pCompra: 'buy_price', pVenda: 'sell_price', saida: 'exit_time', swap: 'swap', preco: 'price', abreFecha: 'open_close' }) as Record<string, ColunaUi>)[x]
  const COLS: [ArquivoQuadroKey, [string, string, string][]][] = [
    ['f8', [['Data/Hora', 'entrada', 'tempo'], ['Papel', 'ativo', 'ativo'], ['C/V', 'lado', 'lado'], ['Qtd', 'qtd', 'qtd'], ['Pr. Entrada', 'pEntrada', ''], ['Pr. Saída', 'pSaida', ''], ['Res. Líq.', 'resultado', ''], ['Corretagem', 'comissao', 'comissao'], ['Nº Negócio', 'id', 'idExec']]],
    ['f8p', [['symbol', 'ativo', 'ativo'], ['qty', 'qtd', 'qtd'], ['buyPrice', 'pCompra', ''], ['sellPrice', 'pVenda', ''], ['pnl', 'resultado', 'realizado'], ['boughtTimestamp', 'compraT', ''], ['soldTimestamp', 'vendaT', ''], ['duration', 'ignorar', 'ignorar'], ['buyFillId', 'ignorar', 'ignorar'], ['sellFillId', 'ignorar', 'ignorar']]],
    ['f16t', [['orderId', 'id', 'idExec'], ['Account', 'conta', 'conta'], ['B/S', 'lado', 'lado'], ['Contract', 'ativo', 'ativo'], ['avgPrice', '', 'ignorar'], ['filledQty', '', 'ignorar'], ['Fill Time', '', 'tempo'], ['Status', 'ignorar', 'ignorar'], ['Timestamp', 'entrada', 'ignorar'], ['Quantity', 'qtd', 'ignorar'], ['Limit Price', '', 'ignorar'], ['Filled Qty', '', 'qtd'], ['Avg Fill Price', '', 'preco']]],
    ['f16b', [['Date(UTC)', 'entrada', 'tempo'], ['Pair', 'ativo', 'ativo'], ['Side', 'lado', 'lado'], ['Price', '', 'preco'], ['Executed', 'qtd', 'qtd'], ['Amount', '', ''], ['Fee', 'comissao', 'comissao'], ['Trade ID', 'id', 'idExec']]],
    ['f16i', [['Symbol', 'ativo', 'ativo'], ['DateTime', 'entrada', 'tempo'], ['Quantity', 'qtd', 'qtd'], ['TradePrice', '', 'preco'], ['IBCommission', 'comissao', 'comissao'], ['AssetClass', '', ''], ['Open/CloseIndicator', '', 'abreFecha'], ['TradeID', 'id', 'idExec']]],
    ['f17', [['Trade number', '', ''], ['Instrument', 'ativo', 'ativo'], ['Account', 'conta', 'conta'], ['Market pos.', 'lado', 'lado'], ['Qty', 'qtd', 'qtd'], ['Entry price', 'pEntrada', ''], ['Exit price', 'pSaida', ''], ['Entry time', 'entrada', 'tempo'], ['Exit time', 'saida', ''], ['Profit', 'resultado', 'realizado'], ['Commission', 'comissao', 'comissao']]],
    ['f18', [['Position ID', 'id', 'idExec'], ['Open Time', 'entrada', 'tempo'], ['Close Time', 'saida', ''], ['Symbol', 'ativo', 'ativo'], ['Side', 'lado', 'lado'], ['Volume', 'qtd', 'qtd'], ['Open Price', 'pEntrada', ''], ['Close Price', 'pSaida', ''], ['Swap', 'swap', ''], ['Commission', 'comissao', 'comissao'], ['Profit', 'resultado', 'realizado']]],
    ['f19', [['Data/Hora', 'entrada', 'tempo'], ['Papel', 'ativo', 'ativo'], ['C/V', 'lado', 'lado'], ['Qtd', 'qtd', 'qtd'], ['Pr. Entrada', 'pEntrada', ''], ['Pr. Saída', 'pSaida', ''], ['Res. Líq.', 'resultado', ''], ['Corretagem', 'comissao', 'comissao'], ['Emolumentos', 'taxa', 'taxa'], ['Nº Negócio', 'id', 'idExec']]],
  ]
  it.each(COLS)('both readings of %s are the board’s columns', (k, cols) => {
    const m = mapear(k)
    expect(m.lido.rawHeaders).toEqual(cols.map((c) => c[0]))
    expect(m.colunas.trade).toEqual(cols.map((c) => B(c[1])))
    expect(m.colunas.fill).toEqual(cols.map((c) => B(c[2])))
  })

  it('the other reading’s dates and numbers: the date order and the mark come back once its columns are mapped', () => {
    // Tradovate as trades: Timestamp is the entry, so «Datas: mês/dia»; Binance as trades: Executed and Fee decide the point
    const tv = comModo(mapear('f16t'), 'trade', 'futures')
    expect([tv.datas.decided, tv.dateOrder]).toEqual(['mdy', 'mdy'])
    const bn = comModo(mapear('f16b'), 'trade', 'crypto')
    expect([bn.decimal.decided, bn.decimalMark]).toEqual(['point', 'point'])
    // NinjaTrader and Forex as executions: the entry time is the execution's
    expect(comModo(mapear('f17'), 'fill', 'futures').dateOrder).toBe('mdy')
    expect(comModo(mapear('f18'), 'fill', 'forex').dateOrder).toBe('dmy')
  })

  it('an order’s limit and stop prices are «Ignorar» among executions, «Escolha…» among trades (they may be its stop or target)', () => {
    const texto = ['Fill Time,Contract,B/S,Filled Qty,Avg Fill Price,Stop Price,Limit Price', '2026-10-13 10:31:05,MESZ6,Buy,1,6812.25,6800.00,6830.00'].join('\n')
    const r = iniciarMapeamento({ ...arquivo('f16t'), text: texto }, { market: 'futures', templates: [], nomePadrao: 'Tradovate' })
    if (!r.ok) throw new Error(r.error)
    expect(comValor(r.mapeamento, 'ignorar', 'fill')).toEqual(['Stop Price', 'Limit Price'])
    expect(comValor(r.mapeamento, null, 'trade')).toEqual(['Fill Time', 'Filled Qty', 'Avg Fill Price', 'Stop Price', 'Limit Price'])
  })

  it('a column whose name a changed model does not know is «Escolha…» and «nova»', () => {
    const m = mapear('f15b', [modeloBlackArrow()])
    expect(comValor(m, null)).toEqual(['Estratégia'])
    expect(m.novas[9]).toBe(true)
  })
})

describe('comColuna (E17): decimal and dates decided again, pressed pills kept, the net question pre-answered again', () => {
  it('8 · Papel → «Quantidade»: the check, the missing «Ativo», the block; back as it was', () => {
    const m = comColuna(mapear('f8'), 1, 'quantity', 'futures')
    expect(m.colunas.trade[1]).toBe('quantity')
    expect(m.sugeridas.trade[1]).toBe('symbol')
    expect(checagemDaColuna(m, 1)).toBe('not_number')
    expect(bloqueioDoMapa(m, 'futures')).toBe('Marque as colunas obrigatórias.')
    const n = comColuna(m, 1, 'symbol', 'futures')
    expect(n.colunas).toEqual(mapear('f8').colunas)
    expect(bloqueioDoMapa(n, 'futures')).toBeNull()
  })

  it('a decimal mark decided again over the mapped number columns (19 · «Só preços» without its prices: no question)', () => {
    const m = mapear('f19p')
    expect(m.decimal.question).not.toBeNull()
    const sem = comColuna(comColuna(m, 4, 'ignorar', 'b3'), 5, 'ignorar', 'b3')
    expect(sem.decimal.question).toBeNull()
    expect(sem.decimalMark).toBe('comma')
    const de = comColuna(comColuna(sem, 4, 'entry_price', 'b3'), 5, 'exit_price', 'b3')
    expect([de.decimal.question?.sample, de.decimalMark]).toEqual(['131.250', 'comma'])
  })

  it('a pressed decimal pill is kept when a column changes', () => {
    const n = comColuna(comDecimal(mapear('f19p'), 'point', 'b3'), 6, 'ignorar', 'b3')
    expect([n.decimalMark, n.decimalEscolhido]).toEqual(['point', true])
  })

  it('a date order decided again over the mapped date columns; a pressed one is kept', () => {
    const sem = comColuna(comColuna(mapear('f18'), 1, 'ignorar', 'forex'), 2, 'ignorar', 'forex')
    expect([sem.datas.decided, sem.dateOrder]).toEqual([null, null])
    const a = comDatas(mapear('f18a'), 'mdy', 'forex')
    expect(comColuna(a, 0, 'ignorar', 'forex').dateOrder).toBe('mdy')
  })

  it('the net question pre-answered again until the owner presses a pill', () => {
    const m = mapear('f8')
    expect(m.resultIsNet).toBe(true)
    expect(comColuna(m, 7, 'ignorar', 'futures').resultIsNet).toBeNull()
    const bruto = comLiquido(m, false)
    expect(comColuna(comColuna(bruto, 7, 'ignorar', 'futures'), 7, 'commission', 'futures').resultIsNet).toBe(false)
  })
})

describe('comModo (E13): each row kind keeps its own edits', () => {
  it.each(ARQUIVOS)('%s: there and back', (k) => {
    const m = mapear(k)
    const outro: RowKind = m.rowKind === 'trade' ? 'fill' : 'trade'
    const editado = comColuna(m, 0, 'ignorar', mercado(k))
    const la = comModo(editado, outro, mercado(k))
    expect(la.rowKind).toBe(outro)
    expect(la.colunas[outro]).toEqual(m.colunas[outro])
    const volta = comModo(la, m.rowKind, mercado(k))
    expect(volta.colunas[m.rowKind][0]).toBe('ignorar')
    expect(volta.colunas).toEqual(editado.colunas)
    expect([volta.decimalMark, volta.dateOrder]).toEqual([editado.decimalMark, editado.dateOrder])
  })

  it('16 · Tradovate as one trade per row: the requirements missing; back to executions as it was', () => {
    const m = comModo(mapear('f16t'), 'trade', 'futures')
    expect(m.rowKind).toBe('trade')
    expect(bloqueioDoMapa(m, 'futures')).toBe('Marque as colunas obrigatórias.')
    expect(comModo(m, 'fill', 'futures')).toEqual(mapear('f16t'))
  })
})

describe('comSeparador (E9, E10): the same header line', () => {
  it('8 · «,»: the header is one cell (header_not_found), the columns stay, the note and the block; never a data row as names', () => {
    const m = mapear('f8')
    const n = comSeparador(m, arquivo('f8'), ',', 'futures')
    expect(n.separador).toBe(',')
    expect(n.lido).toBe(m.lido)
    expect(n.colunas).toEqual(m.colunas)
    expect(n.lido.rawHeaders[0]).toBe('Data/Hora')
    expect(notaDeLeitura(n)).toBe('Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.')
    expect(bloqueioDoMapa(n, 'futures')).toBe('Confira como ler o arquivo.')
    expect(comSeparador(m, arquivo('f8'), '\t', 'futures').colunas).toEqual(m.colunas)
    const volta = comSeparador(n, arquivo('f8'), ';', 'futures')
    expect([volta.separador, notaDeLeitura(volta), bloqueioDoMapa(volta, 'futures')]).toEqual([';', null, null])
  })

  it('a «,» file read with «;»: one cell, kept', () => {
    const m = mapear('f17')
    const n = comSeparador(m, arquivo('f17'), ';', 'futures')
    expect([n.separador, n.colunas]).toEqual([';', m.colunas])
  })

  it('a file whose other reading works: a fresh mapping of the re-read file, «Salvar» and the name kept', () => {
    const texto = ['Data/Hora;Papel,C/V;Qtd', '01/10/2026 09:34:31;MESZ6,C;2', '13/10/2026 10:58:21;MNQZ6,V;1'].join('\n')
    const a: ArquivoMapeavel = { fileName: 'x.csv', size: texto.length, sha256: 'ab'.repeat(32), text: texto }
    const r = iniciarMapeamento(a, { market: 'futures', templates: [], nomePadrao: 'BlackArrow' })
    if (!r.ok) throw new Error(r.error)
    expect(r.mapeamento.lido.delimiter).toBe(';')
    const m = comNome(comSalvar(r.mapeamento, false), 'Meu')
    const n = comSeparador(m, a, ',', 'futures')
    expect([n.separador, n.lido.delimiter, n.lido.rawHeaders]).toEqual([',', ',', ['Data/Hora;Papel', 'C/V;Qtd']])
    expect([n.salvar, n.nome, n.inicio, n.porModelo]).toEqual([false, 'Meu', 'mapa', false])
    expect(notaDeLeitura(n)).toBeNull()
  })
})

describe('the reading pills and questions (E9, E11, E12)', () => {
  it('8 · «Decimal» «ponto»: the decimal note; «Datas» «mês/dia»: the dates note; the separator’s note first', () => {
    const m = mapear('f8')
    expect(notaDeLeitura(comDecimal(m, 'point', 'futures'))).toBe('Os números não fecharam com este decimal. Confira.')
    expect(bloqueioDoMapa(comDecimal(m, 'point', 'futures'), 'futures')).toBe('Confira como ler o arquivo.')
    expect(notaDeLeitura(comDatas(m, 'mdy', 'futures'))).toBe('Com esta ordem, há datas que não existem. Confira.')
    expect(notaDeLeitura({ ...comDatas(m, 'mdy', 'futures'), separador: ',' })).toBe('Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.')
  })

  it('18 · «Datas ambíguas»: «dia/mês» answers it, and the net question is pre-answered once the dates read (gross)', () => {
    const m = mapear('f18a')
    expect([m.dateOrder, m.resultIsNet]).toEqual([null, null])
    const n = comDatas(m, 'dmy', 'forex')
    expect([n.dateOrder, n.datasEscolhidas, n.resultIsNet, bloqueioDoMapa(n, 'forex'), bloqueioDoConferir(n, 'forex')]).toEqual([
      'dmy',
      true,
      false,
      null,
      null,
    ])
  })

  it('19 · «Só preços»: the comma reading puts nothing new off the tick; the point reading puts the WIN off its tick (de 5 em 5)', () => {
    const m = comPalavraDeLado(mapear('f19p'), 'x', 'sell', 'b3')
    expect(foraDoPasso(m, 'b3')).toBeNull()
    expect(bloqueioDoMapa(m, 'b3')).toBeNull()
    const ponto = comDecimal(m, 'point', 'b3')
    expect(foraDoPasso(ponto, 'b3')).toEqual({ raiz: 'WIN', passo: '5' })
    expect(bloqueioDoMapa(ponto, 'b3')).toBe('Confira como ler o arquivo.')
    expect(bloqueioDoMapa({ ...m, decimalMark: null }, 'b3')).toBe('Escolha como ler os números.')
  })

  it('a file whose number cells decide (8) never asks: no tick note', () => {
    expect(foraDoPasso(mapear('f8'), 'futures')).toBeNull()
  })
})

describe('the other edits (E18, E24, E26, E27)', () => {
  it('a side word, an end-of-file answer, the net answer, «Salvar» and the name (at most 60 characters)', () => {
    const m = mapear('f19')
    expect(comPalavraDeLado(m, 'x', 'skip', 'b3').sideWords).toEqual({ x: 'skip' })
    const f = comFimDoArquivo(mapear('f16ta'), 'MESZ6', 'yes')
    expect(f.endOfFile).toEqual({ MESZ6: 'yes' })
    expect(ler(f, 'f16ta').endOfFile[0].answer).toBe('yes')
    expect(comLiquido(m, false)).toMatchObject({ resultIsNet: false, liquidoEscolhido: true })
    expect(comSalvar(m, false).salvar).toBe(false)
    expect(comNome(m, 'x'.repeat(70)).nome).toHaveLength(60)
    expect(Array.from(comNome(m, '\u{1F600}'.repeat(61)).nome)).toHaveLength(60)
  })
})

describe('the blocks (§5.6)', () => {
  it('«Continuar»: the reading, the dates, the decimal, the requirements, a field twice, a check, a side word', () => {
    const p = mapear('f19p')
    expect(bloqueioDoMapa({ ...p, separador: ',', datas: mapear('f18a').datas, dateOrder: null }, 'b3')).toBe('Confira como ler o arquivo.')
    expect(bloqueioDoMapa({ ...p, datas: mapear('f18a').datas, dateOrder: null, decimalMark: null }, 'b3')).toBe('Escolha a ordem das datas.')
    expect(bloqueioDoMapa({ ...p, decimalMark: null }, 'b3')).toBe('Escolha como ler os números.')
    const m = mapear('f17')
    expect(bloqueioDoMapa(comColuna(m, 1, 'ignorar', 'futures'), 'futures')).toBe('Marque as colunas obrigatórias.')
    expect(bloqueioDoMapa(comColuna(m, 0, 'quantity', 'futures'), 'futures')).toBe('Cada campo vai em uma coluna só.')
    // Account → «Stop»: not a number, nothing else wrong
    const stop = comColuna(m, 2, 'stop', 'futures')
    expect(checagemDaColuna(stop, 2)).toBe('not_number')
    expect(bloqueioDoMapa(stop, 'futures')).toBe('Confira as colunas marcadas.')
    // 8 · Performance: buyFillId → «ID da operação»
    const id = comColuna(mapear('f8p'), 8, 'trade_id', 'futures')
    expect([checagemDaColuna(id, 8), bloqueioDoMapa(id, 'futures')]).toEqual(['repeats', 'Confira as colunas marcadas.'])
    // 18 · «Swap ou funding» without «Resultado»: the swap check under it
    const swap = comColuna(mapear('f18'), 10, 'ignorar', 'forex')
    expect([checagemDaColuna(swap, 8), bloqueioDoMapa(swap, 'forex')]).toEqual(['swap', 'Confira as colunas marcadas.'])
    expect(bloqueioDoMapa(mapear('f19'), 'b3')).toBe('Diga o que quer dizer “X”.')
  })

  it('«Usar estas colunas»: a file the mapping cannot make (mixed clocks), then the net question with no answer', () => {
    const texto = ['Time,Symbol,Side,Qty,Price', '2026-10-11T00:05:12Z,BTCUSDT,BUY,0.01,112400.00', '2026-10-11 00:21:40,BTCUSDT,SELL,0.01,112952.00'].join('\n')
    const r = iniciarMapeamento({ fileName: 'x.csv', size: 1, sha256: '', text: texto }, { market: 'crypto', templates: [], nomePadrao: 'Binance' })
    if (!r.ok) throw new Error(r.error)
    expect(r.mapeamento.rowKind).toBe('fill')
    expect(bloqueioDoConferir(r.mapeamento, 'crypto')).toBe('Este arquivo mistura horários com e sem fuso: não dá para pôr as execuções em ordem.')
    expect(bloqueioDoConferir(mapear('f18a'), 'forex')).toBe('Responda a pergunta sobre o resultado do arquivo.')
    expect(bloqueioDoConferir(comLiquido(mapear('f18a'), true), 'forex')).toBeNull()
  })

  it('an exact model whose file starts on «conferir» (16 ending positioned) is not blocked there', () => {
    const m = mapear('f16ta', [modeloTradovate()])
    expect([m.inicio, bloqueioDoConferir(m, 'futures')]).toEqual(['conferir', null])
  })
})

describe('modeloASalvar is never refused once «mapa» and «conferir» let a mapping through', () => {
  type Caminho = (m: Mapeamento, mk: AccountMarket) => Mapeamento
  /** The board's answers and edit paths per file */
  const CAMINHOS: Record<Exclude<ArquivoQuadroKey, 'f9ilegivel'>, Caminho[]> = {
    f8: [(m) => m, (m) => comLiquido(m, false), (m, mk) => comColuna(comColuna(m, 1, 'quantity', mk), 1, 'symbol', mk), (m, mk) => comColuna(m, 8, 'ignorar', mk)],
    f8p: [(m) => m, (m, mk) => comModo(comModo(m, 'fill', mk), 'trade', mk)],
    f15: [(m) => m, (m) => comNome(m, '')],
    f15b: [(m) => m, (m, mk) => comColuna(m, 9, 'ignorar', mk)],
    f16t: [(m) => m, (m, mk) => comColuna(m, 1, 'ignorar', mk)],
    f16ta: [(m) => m, (m) => comFimDoArquivo(m, 'MESZ6', 'yes'), (m) => comFimDoArquivo(m, 'MESZ6', 'no')],
    f16b: [(m) => m, (m) => comFimDoArquivo(m, 'ETHUSDT', 'yes'), (m) => comFimDoArquivo(m, 'ETHUSDT', 'no')],
    f16i: [(m) => m, (m, mk) => comColuna(m, 5, 'ignorar', mk)],
    f16c: [(m) => m, (m) => comFimDoArquivo(m, endOfFileKey('MESZ6', 'LT50K-0193'), 'yes')],
    f17: [(m) => m, (m) => comLiquido(m, true), (m, mk) => comColuna(m, 0, 'ignorar', mk)],
    f18: [(m) => m, (m) => comLiquido(m, true)],
    f18a: [(m, mk) => comDatas(m, 'dmy', mk), (m, mk) => comLiquido(comDatas(m, 'dmy', mk), true)],
    f19: [
      (m, mk) => comPalavraDeLado(m, 'x', 'sell', mk),
      (m, mk) => comPalavraDeLado(m, 'x', 'skip', mk),
      (m, mk) => comLiquido(comPalavraDeLado(m, 'x', 'buy', mk), false),
    ],
    f19p: [(m, mk) => comPalavraDeLado(m, 'x', 'sell', mk), (m, mk) => comPalavraDeLado(m, 'x', 'skip', mk)],
  }
  it.each(Object.keys(CAMINHOS) as (keyof typeof CAMINHOS)[])('%s', (k) => {
    const mk = mercado(k)
    const modelos = k === 'f15' || k === 'f15b' ? [modeloBlackArrow()] : []
    for (const caminho of CAMINHOS[k]) {
      for (const inicial of [mapear(k, modelos), mudarColunas(mapear(k, modelos))]) {
        const m = caminho(inicial, mk)
        expect(bloqueioDoMapa(m, mk)).toBeNull()
        expect(bloqueioDoConferir(m, mk)).toBeNull()
        const s = modeloASalvar(m, { tzHint: conta(k).file_tz, rota: null })
        expect(s).not.toBeNull()
        expect(checkTemplate(s?.payload)).toBeNull()
      }
    }
  })
})

describe('arquivoDeTodasAsContas: what «conferir» reads, once per state', () => {
  it('every account’s rows on their wall clocks, whatever value hc chose; the same answer for the same state, a new read for a new one', () => {
    const m = { ...mapear('f16c'), accountValue: 'LT50K-0193' }
    const f = arquivoDeTodasAsContas(m, 'futures')
    if (!f.ok) throw new Error(f.error)
    expect(f.endOfFile).toHaveLength(2)
    expect(f).toEqual(arquivoDoMapeamento({ ...m, accountValue: null }, 'futures', null))
    expect(arquivoDeTodasAsContas(m, 'futures')).toBe(f)
    const n = comFimDoArquivo(m, endOfFileKey('MESZ6', 'LT50K-0193'), 'yes')
    const g = arquivoDeTodasAsContas(n, 'futures')
    expect(g).not.toBe(f)
    expect(g.ok && g.endOfFile.map((q) => q.answer)).toEqual(['yes', 'unknown'])
  })

  it('foraDoPasso gives the same answer read again (kept per state)', () => {
    const ponto = comDecimal(comPalavraDeLado(mapear('f19p'), 'x', 'sell', 'b3'), 'point', 'b3')
    expect(foraDoPasso(ponto, 'b3')).toEqual({ raiz: 'WIN', passo: '5' })
    expect(foraDoPasso(ponto, 'b3')).toBe(foraDoPasso(ponto, 'b3'))
  })
})

// ------------------------------------------------------------------------------------------------
// Reviews 1 and 2 of lane L1: each fix, and the edits the mutation review found untested
// ------------------------------------------------------------------------------------------------

/** An invented file mapped from the names */
function mapearTexto(texto: string, market: AccountMarket, nomePadrao = 'Minha plataforma'): { m: Mapeamento; a: ArquivoMapeavel } {
  const a: ArquivoMapeavel = { fileName: 'x.csv', size: texto.length, sha256: 'ab'.repeat(32), text: texto }
  const r = iniciarMapeamento(a, { market, templates: [], nomePadrao })
  if (!r.ok) throw new Error(r.error)
  return { m: r.mapeamento, a }
}

describe('review 2 · 1: «Separador» repairs a first read that took a data row for the header', () => {
  /** A «;» export whose header has no trailing «;» while every data line ends in one (invented) */
  const LINHAS = [
    '13/10/2026 09:30:00;MESZ6;C;1;6801,25;6802,50;6,25;',
    '13/10/2026 09:41:12;MESZ6;V;2;6803,00;6801,75;2,50;',
    '13/10/2026 10:02:45;MNQZ6;C;1;25140,25;25146,50;12,50;',
    '14/10/2026 09:35:10;MESZ6;C;1;6810,00;6808,75;-6,25;',
    '14/10/2026 10:11:30;MNQZ6;V;1;25160,00;25151,25;17,50;',
    '15/10/2026 09:48:02;MESZ6;V;3;6799,50;6797,00;37,50;',
    '15/10/2026 11:20:40;MNQZ6;C;2;25101,75;25099,00;-11,00;',
    '16/10/2026 09:31:05;MESZ6;C;1;6820,25;6825,00;23,75;',
  ]
  const TEXTO = ['Data;Ativo;Lado;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.', ...LINHAS].join('\n')

  it('the domain’s sniff reads it with «,» from its first trade; «;» finds the real header again, every trade kept', () => {
    const { m, a } = mapearTexto(TEXTO, 'futures', 'BlackArrow')
    // What the owner sees first: «Separador: vírgula», the first trade as the names
    expect([m.lido.delimiter, m.lido.headerSkip, m.lido.records.length]).toEqual([',', 1, 7])
    const n = comSeparador(m, a, ';', 'futures')
    expect([n.separador, n.lido.delimiter, n.lido.headerSkip, n.lido.headerLine, n.lido.records.length]).toEqual([';', ';', 0, 1, 8])
    expect(n.lido.rawHeaders).toEqual(['Data', 'Ativo', 'Lado', 'Qtd', 'Pr. Entrada', 'Pr. Saída', 'Res. Líq.'])
    expect(notaDeLeitura(n)).toBeNull()
    expect(campos(n)).toEqual({ data: 'entry_time', ativo: 'symbol', lado: 'side', qtd: 'quantity', 'pr. entrada': 'entry_price', 'pr. saida': 'exit_price', 'res. liq.': 'pnl' })
    expect([bloqueioDoMapa(n, 'futures'), bloqueioDoConferir(n, 'futures')]).toEqual([null, null])
    const f = arquivoDoMapeamento(n, 'futures', null)
    expect(f.ok && [f.rows.length, f.errors.length]).toEqual([8, 0])
    // The model it saves keeps the real names
    expect(modeloASalvar(n, { tzHint: null, rota: null })?.payload.headers).toEqual(n.lido.headers)
  })

  it('a fresh read whose header is below the current one is never taken: 8 · «,» keeps the note (never a data row as names)', () => {
    const m = mapear('f8')
    const n = comSeparador(m, arquivo('f8'), ',', 'futures')
    expect([n.lido, n.separador, notaDeLeitura(n)]).toEqual([m.lido, ',', 'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.'])
  })

  it('back to the file’s own separator after a failed try keeps every edit', () => {
    const m = comColuna(mapear('f8'), 8, 'ignorar', 'futures')
    const falhou = comSeparador(m, arquivo('f8'), ',', 'futures')
    const volta = comSeparador(falhou, arquivo('f8'), ';', 'futures')
    expect(volta.colunas).toEqual(m.colunas)
    expect(volta.colunas.trade[8]).toBe('ignorar')
    expect([volta.separador, notaDeLeitura(volta)]).toEqual([';', null])
  })

  it('a re-read whose records are not as wide as its header is refused (the note), on either line', () => {
    // «,» splits the header in two («Data;Preço», « R$;Qtd») and the second record in one
    const texto = ['Data;Preço, R$;Qtd', '01/10/2026 09:34:31;6801,25;2', '02/10/2026 09:41:12;6801;1'].join('\n')
    const { m, a } = mapearTexto(texto, 'futures')
    expect(m.lido.delimiter).toBe(';')
    const n = comSeparador(m, a, ',', 'futures')
    expect([n.lido, n.separador, notaDeLeitura(n)]).toEqual([m.lido, ',', 'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.'])
  })

  it('«Mude as colunas…» stays while the re-read file still matches the model; a re-read the model does not know drops it', () => {
    const m = mudarColunas(mapear('f15', [modeloBlackArrow()]))
    expect(m.mudando).toBe(true)
    // The same names written with «,» (and «.» decimals): the model's names, so still «Mude as colunas do modelo …»
    const virgula = ARQUIVOS_QUADRO.f15.texto
      .split(/\r?\n/)
      .map((l) => l.replace(/\.(?=\d{3}[,;])/g, '').replace(/,/g, '.').replace(/;/g, ','))
      .join('\n')
    const igual = comSeparador(m, { ...arquivo('f15'), text: virgula }, ',', 'futures')
    expect([igual.lido.delimiter, igual.origem, igual.mudando]).toEqual([',', 'modelo', true])
    const outro = comSeparador(m, { ...arquivo('f15'), text: ['Data/Hora;Papel,C/V;Qtd', '01/10/2026 09:34:31;MESZ6,C;2'].join('\n') }, ',', 'futures')
    expect([outro.lido.delimiter, outro.origem, outro.mudando]).toEqual([',', 'nomes', false])
  })
})

describe('review 1 · 1: a column set to «Lado» that is no side column asks nothing', () => {
  it('8 · Data/Hora or Papel → «Lado»: no side column to ask about; the file’s own C/V and 19’s «X» are', () => {
    const m = mapear('f8')
    expect(colunaDoLado(m, 'futures')).toBe(2)
    const data = comColuna(comColuna(m, 2, 'ignorar', 'futures'), 0, 'side', 'futures')
    expect([checagemDaColuna(data, 0), colunaDoLado(data, 'futures')]).toEqual(['not_side', -1])
    const papel = comColuna(comColuna(m, 2, 'ignorar', 'futures'), 1, 'side', 'futures')
    expect([checagemDaColuna(papel, 1), colunaDoLado(papel, 'futures')]).toEqual(['not_side', -1])
    expect(bloqueioDoMapa(papel, 'futures')).toBe('Marque as colunas obrigatórias.')
    expect(colunaDoLado(mapear('f19'), 'b3')).toBe(2)
    expect(bloqueioDoMapa(mapear('f19'), 'b3')).toBe('Diga o que quer dizer “X”.')
  })

  it('a side column whose words are all unknown is still asked about (its name says «Lado»), and the answers clear its check', () => {
    const texto = ['Entry Time,Symbol,Side,Qty,Profit', '2026-10-13 10:31:05,MESZ6,Kauf,1,5.00', '2026-10-13 10:41:05,MESZ6,Verkauf,1,-2.50'].join('\n')
    const { m } = mapearTexto(texto, 'futures')
    const lado = comColuna(m, 2, 'side', 'futures')
    expect([checagemDaColuna(lado, 2), colunaDoLado(lado, 'futures')]).toEqual(['not_side', 2])
    expect(bloqueioDoMapa(lado, 'futures')).toBe('Confira as colunas marcadas.')
    const respondida = comPalavraDeLado(comPalavraDeLado(lado, 'kauf', 'buy', 'futures'), 'verkauf', 'sell', 'futures')
    expect([checagemDaColuna(respondida, 2), bloqueioDoMapa(respondida, 'futures')]).toEqual([null, null])
  })
})

describe('review 1 · 2: a decimal pill that contradicts the file gives the note, never a check under the number columns', () => {
  it.each([
    ['f8', 'futures'],
    ['f19', 'b3'],
  ] as const)('%s · «Mudar» → «ponto»', (k, mk) => {
    const m = comDecimal(k === 'f19' ? comPalavraDeLado(mapear(k), 'x', 'sell', mk) : mapear(k), 'point', mk)
    expect(marcaDeLeitura(m)).toBe('comma')
    expect(m.colunas.trade.map((_, i) => checagemDaColuna(m, i))).toEqual(m.colunas.trade.map(() => null))
    expect([notaDeLeitura(m), bloqueioDoMapa(m, mk)]).toEqual(['Os números não fecharam com este decimal. Confira.', 'Confira como ler o arquivo.'])
    // The import would read with the pressed mark (blocked until it agrees)
    expect(escolhasDe(m).decimalMark).toBe('point')
  })

  it('without the file’s decision (19 · «Só preços»), the pressed reading is the one the checks read', () => {
    const p = comDecimal(mapear('f19p'), 'point', 'b3')
    expect([p.decimal.decided, marcaDeLeitura(p)]).toEqual([null, 'point'])
  })
})

describe('review 2 · 3: the model keeps only the side words import_template_save takes', () => {
  /** 60 trades: 39 «Buy»/«Sell» and 21 words of the file’s own (invented) */
  const palavras = Array.from({ length: 21 }, (_, i) => `w${String(i).padStart(2, '0')}`)
  const linhas = Array.from({ length: 60 }, (_, i) => {
    const lado = i < 39 ? (i % 2 === 0 ? 'Buy' : 'Sell') : palavras[i - 39]
    const min = String(i % 60).padStart(2, '0')
    return `2026-10-13 10:${min}:05,2026-10-13 10:${min}:45,MESZ6,${lado},1,5.00`
  })
  const texto = ['Entry Time,Exit Time,Symbol,Side,Qty,Profit', ...linhas].join('\n')

  it('21 words answered «Compra»: the first 20 in the file’s order go to the model, every row is read', () => {
    let { m } = mapearTexto(texto, 'futures')
    expect(checagemDaColuna(m, 3)).toBeNull()
    for (const w of palavras) m = comPalavraDeLado(m, w, 'buy', 'futures')
    expect([bloqueioDoMapa(m, 'futures'), bloqueioDoConferir(m, 'futures')]).toEqual([null, null])
    const s = modeloASalvar(m, { tzHint: null, rota: null })
    expect(Object.keys(s?.payload.side_words ?? {})).toEqual(palavras.slice(0, 20))
    expect(checkTemplate(s?.payload)).toBeNull()
    const f = arquivoDoMapeamento(m, 'futures', null)
    expect(f.ok && [f.rows.length, f.errors.length]).toEqual([60, 0])
  })

  it('a word over 40 characters stays this file’s answer; «Pular essas linhas» too', () => {
    const longa = 'compra a mercado com stop e alvo definidos'
    expect(Array.from(longa).length).toBeGreaterThan(40)
    const t = [
      'Entry Time,Exit Time,Symbol,Side,Qty,Profit',
      '2026-10-13 10:31:05,2026-10-13 10:32:05,MESZ6,Buy,1,5.00',
      '2026-10-13 10:41:05,2026-10-13 10:42:05,MESZ6,Sell,1,2.50',
      `2026-10-13 10:51:05,2026-10-13 10:52:05,MESZ6,${longa},1,1.25`,
      '2026-10-13 11:01:05,2026-10-13 11:02:05,MESZ6,y,1,1.25',
    ].join('\n')
    const { m: m0 } = mapearTexto(t, 'futures')
    const m = comPalavraDeLado(comPalavraDeLado(m0, longa, 'buy', 'futures'), 'y', 'skip', 'futures')
    expect([bloqueioDoMapa(m, 'futures'), bloqueioDoConferir(m, 'futures')]).toEqual([null, null])
    const s = modeloASalvar(m, { tzHint: null, rota: null })
    expect(s?.payload.side_words).toEqual({})
    expect(checkTemplate(s?.payload)).toBeNull()
    // A model's own words come after the file's, under the same limit
    const n = { ...comPalavraDeLado(m0, longa, 'buy', 'futures'), sideWords: { velha: 'sell' as const, [longa]: 'buy' as const } }
    expect(modeloASalvar(n, { tzHint: null, rota: null })?.payload.side_words).toEqual({ velha: 'sell' })
  })
})

describe('review 2 · 4: the edits the mutation review found untested', () => {
  it('comModo decides the dates again: 8 · Performance read as executions has no date column, so no order', () => {
    const m = mapear('f8p')
    expect(m.dateOrder).toBe('mdy')
    const n = comModo(m, 'fill', 'futures')
    expect([n.datas.decided, n.dateOrder]).toEqual([null, null])
    expect(comModo(n, 'trade', 'futures').dateOrder).toBe('mdy')
  })

  it('a column change keeps a model’s net answer (the prices would say net)', () => {
    const bruto = templateFromRow({ ...MODELO_BLACKARROW_LINHA, result_is_net: false })
    if (!bruto) throw new Error('model row not usable')
    const m = mapear('f15b', [bruto])
    expect([m.match.kind, m.resultIsNet]).toEqual(['changed', false])
    expect(comColuna(m, 9, 'ignorar', 'futures').resultIsNet).toBe(false)
    // From the names the prices pre-answer it
    expect(comColuna(mapear('f15b'), 9, 'ignorar', 'futures').resultIsNet).toBe(true)
  })

  it('E10: the separator’s note before the decimal’s', () => {
    const m = comDecimal(mapear('f8'), 'point', 'futures')
    expect(notaDeLeitura({ ...m, separador: ',' })).toBe('Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.')
  })

  it('an answer given for the chosen account wins over a plain one for the same symbol', () => {
    const m = { ...mapear('f16c'), endOfFile: { MESZ6: 'no' as const, [endOfFileKey('MESZ6', 'LT50K-0193')]: 'yes' as const }, accountValue: 'LT50K-0193' }
    expect(ler(m, 'f16c').endOfFile.map((q) => [q.key, q.answer])).toEqual([['MESZ6', 'yes']])
    // Another account: its plain answer
    expect(ler({ ...m, accountValue: 'LT50K-0194' }, 'f16c').endOfFile.map((q) => [q.key, q.answer])).toEqual([['MESZ6', 'no']])
  })

  it('a model’s own row kind never gets the repeating-ID note, even with the IDs it ignores (8 · Performance saved, read again)', () => {
    const modelo = modeloDe(mapear('f8p'), 'America/New_York', UUID_19)
    const m = mapear('f8p', [modelo])
    expect([m.match.kind, m.origem, m.colunas.trade[8], m.colunas.trade[9]]).toEqual(['exact', 'modelo', 'ignorar', 'ignorar'])
    expect(idsQueSeRepetem(m, 'futures')).toEqual([])
  })
})

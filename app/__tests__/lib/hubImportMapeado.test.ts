/**
 * Phase 3b · telas, B0: the column-mapping import's shared state (lib/hub/importMapeado) on the board's files
 * (testing/mapeadoTelas). Lane L1 adds the edits of contract §5.2 and the pre-fill of §5.3 here: the pre-fill gives the
 * board's columns and tags on every file, «Separador» re-reads the same header line, the decimal and the dates are
 * decided again on a column change with the pressed pills kept, each row kind keeps its own edits, the blocks of
 * «Continuar» and «Usar estas colunas» come in §5.6's order, and a mapping both let through always saves.
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
  arquivoDeTodasAsContas,
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  cabecalhoDoLeitor,
  checagemDaColuna,
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
  modeloASalvar,
  mudarColunas,
  nomePadraoDoModelo,
  notaDeLeitura,
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
      // Both kinds start from the domain's pre-fill, with the file's own decimal mark and date order (§5.3 step 1); L1 sets
      // «Ignorar esta coluna» only where the domain suggests nothing
      const n = m.lido.headers.length
      const dec = sniffDecimalMark(m.lido.records, Array(n).fill('quantity'), m.lido.delimiter)
      const values = { records: m.lido.records, decimalMark: dec.decided ?? dec.fallback, dateOrder: sniffDateOrder(m.lido.records, Array(n).fill('time')).decided }
      for (const kind of ['trade', 'fill'] as const) {
        const dominio = suggestColumns(m.lido.headers, kind, mercado(k), values)
        expect(m.colunas[kind].map((c) => (c === 'ignorar' ? null : c))).toEqual(dominio)
        m.colunas[kind].forEach((c, i) => {
          if (c === 'ignorar') expect(dominio[i]).toBeNull()
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
    expect(comValor(m, 'ignorar', 'trade')).toEqual(['Status', 'Limit Price'])
    expect(comValor(m, null, 'trade')).toEqual(['avgPrice', 'filledQty', 'Fill Time', 'Timestamp', 'Filled Qty', 'Avg Fill Price'])
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

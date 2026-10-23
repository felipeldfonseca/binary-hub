/**
 * Phase 3b · telas, lane L2: lib/hub/importPrevia on the board's files (testing/mapeadoTelas, B0) and the composed
 * database answers (testing/mapeadoRespostas): the file card, the steps ahead, the zone rule and its drawing, «N contas
 * neste arquivo», the preview's lines, the reasons of the lines left out and the end's model line. Also the lane's copy
 * checks (§8.3). Invented data only.
 */
import fs from 'fs'
import path from 'path'
import { accountRouteHash, endOfFileKey, type ImportRow, type MappedFile } from '@/lib/domain/import'
import { arquivoDoMapeamento, iniciarMapeamento, type Mapeamento } from '@/lib/hub/importMapeado'
import {
  chaveDasLinhas,
  contasDoArquivo,
  escolhaDaZona,
  faixaToda,
  fusoPreSelecionado,
  linhaDoArquivoMapeado,
  linhaDoModelo,
  linhasDaPrevia,
  linhasDoFuso,
  mostrarFuso,
  motivoDaLinha,
  palavraDoFuso,
  palavraJaEstavam,
  paresDeAtivos,
  planoMapeado,
  recusaLocal,
  relogioDoMercado,
  semQuebraNoTraco,
  valorImportado,
  valorPreSelecionado,
  zonaDaConta,
} from '@/lib/hub/importPrevia'
import { displaySpan } from '@/lib/hub/contas'
import { PASSO_D, rowErrorReason } from '@/components/hub/contas/copy'
import { BINANCE, NINJA, TV_HEADER, tv } from '@/testing/mappedFiles'
import { CONTAS_QUADRO, modeloBlackArrow, modeloTradovate, type ArquivoQuadroKey } from '@/testing/mapeadoTelas'
import { arquivoDoEstado, arquivoMapeavelQuadro, mapeamentoDoEstado, previaQuadro, type EstadoQuadro } from '@/testing/mapeadoRespostas'

const NY = 'America/New_York'

function mapear(key: ArquivoQuadroKey, market: Parameters<typeof iniciarMapeamento>[1]['market'], templates = [] as ReturnType<typeof modeloBlackArrow>[]): Mapeamento {
  const r = iniciarMapeamento(arquivoMapeavelQuadro(key), { market, templates, nomePadrao: 'Minha plataforma' })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}
/** An invented file read as the sheet reads it again (never a broker export) */
function mapearTexto(texto: string, market: Parameters<typeof iniciarMapeamento>[1]['market'], templates = [] as ReturnType<typeof modeloBlackArrow>[]): Mapeamento {
  const r = iniciarMapeamento({ fileName: 'inventado.csv', size: texto.length, sha256: 'cd'.repeat(32), text: texto }, { market, templates, nomePadrao: 'Minha plataforma' })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}
const naParede = (m: Mapeamento, market: Parameters<typeof arquivoDoMapeamento>[1]) => {
  const f = arquivoDoMapeamento(m, market, null)
  if (!f.ok) throw new Error(f.error)
  return f
}

// ------------------------------------------------------------------------------------------------

describe('linhaDoArquivoMapeado (E1)', () => {
  it('no model: «Arquivo não reconhecido · N linhas»; without a mapping, from a market-free sniff (null when it fails)', () => {
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f8'), mapear('f8', 'futures'), 'futures')).toBe('Arquivo não reconhecido · 18 linhas')
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f19'), null, null)).toBe('Arquivo não reconhecido · 18 linhas')
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f16t'), null, null)).toBe('Arquivo não reconhecido · 11 linhas')
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f16ta'), null, null)).toBe('Arquivo não reconhecido · 13 linhas')
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f9ilegivel'), null, null)).toBeNull()
  })

  it('a model taken as is: «Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out»; an execution file in lines', () => {
    const m15 = mapear('f15', 'futures', [modeloBlackArrow()])
    expect(m15.porModelo).toBe(true)
    // The days never break at their dash (review 1 #2): a word joiner after it
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f15'), m15, 'futures', 2026)).toBe('Modelo “BlackArrow” · Futuros · 24 operações · 1–\u206015 out')
    const m16 = mapear('f16ta', 'futures', [modeloTradovate()])
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f16ta'), m16, 'futures', 2026)).toBe('Modelo “Tradovate” · Futuros · 13 linhas · 13 out')
  })

  it('the days keep whole: a word joiner after each dash, no other change («1–15 out», «28 set–3 out»)', () => {
    expect(semQuebraNoTraco('1–15 out')).toBe('1–\u206015 out')
    expect(semQuebraNoTraco('28 set–3 out')).toBe('28 set–\u20603 out')
    expect(semQuebraNoTraco('13 out')).toBe('13 out')
  })

  it('a model taken as is whose file has a line with an error counts its lines, never «N operações» (its rows are not its trades)', () => {
    const { ARQUIVOS_QUADRO } = require('@/testing/mapeadoTelas')
    const linhas15 = (ARQUIVOS_QUADRO.f15.texto as string).split('\r\n')
    const cells = linhas15[2].split(';')
    cells[4] = '6.8x1,00'
    linhas15[2] = cells.join(';')
    const texto = linhas15.join('\r\n')
    const m = mapearTexto(texto, 'futures', [modeloBlackArrow()])
    expect([m.porModelo, (naParede(m, 'futures') as MappedFile).errors.length]).toEqual([true, 1])
    expect(linhaDoArquivoMapeado({ fileName: 'b.csv', size: texto.length, sha256: 'cd'.repeat(32), text: texto }, m, 'futures', 2026)).toBe(
      'Modelo “BlackArrow” · Futuros · 24 linhas · 1–\u206015 out',
    )
  })

  it('another match: «Parecido com o modelo “BlackArrow” · 24 linhas»', () => {
    const m = mapear('f15b', 'futures', [modeloBlackArrow()])
    expect(linhaDoArquivoMapeado(arquivoMapeavelQuadro('f15b'), m, 'futures')).toBe('Parecido com o modelo “BlackArrow” · 24 linhas')
  })
})

describe('planoMapeado (E2)', () => {
  it('after a2 an estimate; after mapa / conferir / hc the steps the file asks (hc, c), then d', () => {
    expect(planoMapeado('a2', null, null, undefined)).toEqual(['mapa', 'conferir', 'c', 'd'])
    expect(planoMapeado('mapa', mapear('f8', 'futures'), CONTAS_QUADRO.ylos, {})).toEqual(['conferir', 'c', 'd'])
    expect(planoMapeado('mapa', mapear('f17', 'futures'), CONTAS_QUADRO.apexA, {})).toEqual(['conferir', 'hc', 'c', 'd'])
    expect(planoMapeado('conferir', mapear('f17', 'futures'), CONTAS_QUADRO.apexA, {})).toEqual(['hc', 'c', 'd'])
    expect(planoMapeado('hc', mapear('f17', 'futures'), CONTAS_QUADRO.apexA, {})).toEqual(['c', 'd'])
    // Binance: every row with its offset, no zone step
    expect(planoMapeado('mapa', mapear('f16b', 'crypto'), CONTAS_QUADRO.binance, {})).toEqual(['conferir', 'd'])
    // 15 after «Mudar colunas»: the model's zone is the account's import zone
    expect(planoMapeado('mapa', mapear('f15', 'futures', [modeloBlackArrow()]), CONTAS_QUADRO.ylosDepois, {})).toEqual(['conferir', 'd'])
  })
})

describe('the zone rule (G2)', () => {
  it('zonaDaConta: confirmed, or holding imports; else none', () => {
    expect(zonaDaConta(CONTAS_QUADRO.topOne, {})).toBe('UTC')
    expect(zonaDaConta(CONTAS_QUADRO.ylos, {})).toBeNull()
    expect(zonaDaConta(CONTAS_QUADRO.ylos, { [CONTAS_QUADRO.ylos.id]: ['modelo'] })).toBe(NY)
    expect(zonaDaConta(CONTAS_QUADRO.ylosDepois, undefined)).toBe(NY)
  })

  it('mostrarFuso: rows without an offset ask, unless the model’s zone is the account’s; Binance never', () => {
    const m15 = mapear('f15', 'futures', [modeloBlackArrow()])
    expect(mostrarFuso(naParede(m15, 'futures'), m15, CONTAS_QUADRO.ylosDepois, {})).toBe(false)
    expect(mostrarFuso(naParede(m15, 'futures'), m15, CONTAS_QUADRO.ylos, {})).toBe(true)
    const m8 = mapear('f8', 'futures')
    expect(mostrarFuso(naParede(m8, 'futures'), m8, CONTAS_QUADRO.ylos, {})).toBe(true)
    const mb = mapear('f16b', 'crypto')
    expect(mostrarFuso(naParede(mb, 'crypto'), mb, CONTAS_QUADRO.binance, {})).toBe(false)
  })

  it('fusoPreSelecionado: the import zone, else the file’s hint, else UTC for an exchange; a zone outside the five: none', () => {
    const f8 = naParede(mapear('f8', 'futures'), 'futures')
    expect(fusoPreSelecionado(f8, CONTAS_QUADRO.ylos, {})).toBeNull()
    expect(fusoPreSelecionado(f8, CONTAS_QUADRO.topOne, {})).toBe('utc')
    expect(fusoPreSelecionado(f8, CONTAS_QUADRO.lucid, { [CONTAS_QUADRO.lucid.id]: ['modelo'] })).toBe('ny')
    expect(fusoPreSelecionado({ fileTzHint: null }, { ...CONTAS_QUADRO.binance, tz_applied_at: null, file_tz: 'UTC' }, {})).toBe('utc')
    expect(fusoPreSelecionado({ fileTzHint: 'Asia/Tokyo' }, CONTAS_QUADRO.ylos, {})).toBeNull()
    expect(escolhaDaZona('chi')).toEqual({ key: 'outro', other: 'chi' })
    expect(escolhaDaZona('utc')).toEqual({ key: 'utc', other: null })
    expect(escolhaDaZona(null)).toEqual({ key: null, other: null })
  })

  it('recusaLocal: a confirmed account refuses its other zones at once; an unconfirmed one never on the step', () => {
    expect(recusaLocal(CONTAS_QUADRO.topOne, 'America/Sao_Paulo')).toBe(true)
    expect(recusaLocal(CONTAS_QUADRO.topOne, 'UTC')).toBe(false)
    expect(recusaLocal(CONTAS_QUADRO.ylos, 'America/Sao_Paulo')).toBe(false)
  })

  it('relogioDoMercado: each market’s clock, band and legend (board IC l.1166–1177)', () => {
    expect(relogioDoMercado('futures')).toMatchObject({ tz: NY, relogio: 'ny', banda: 'us', bandaTxt: 'pregão regular 09:30–16:00 ET', legenda: 'Faixas no relógio de Nova York (ET).' })
    expect(relogioDoMercado('forex')).toMatchObject({ tz: NY, banda: null, legenda: 'Faixas no relógio de Nova York (ET). Forex abre 24 h: sem faixa de pregão.' })
    expect(relogioDoMercado('stocks')).toMatchObject({ tz: NY, banda: 'us' })
    expect(relogioDoMercado('crypto')).toMatchObject({ tz: 'America/Sao_Paulo', relogio: 'br', banda: null, legenda: 'Faixas no relógio de Brasília. Cripto abre 24 h: sem faixa de pregão.' })
    expect(relogioDoMercado('b3')).toMatchObject({ tz: 'America/Sao_Paulo', banda: 'b3', bandaTxt: 'pregão 09:00–18:30', legenda: 'Faixas no relógio de Brasília.' })
    expect(relogioDoMercado('binary')).toMatchObject({ banda: null, legenda: 'Faixas no relógio de Brasília. Binárias abrem 24 h: sem faixa de pregão.' })
  })

  it('linhasDoFuso: one row per trade (8 · Performance: 4 for its 6 rows) or per execution (16: 10 with those left out)', () => {
    const p = naParede(mapear('f8p', 'futures'), 'futures')
    expect(linhasDoFuso(p).map((r) => r.local_entry.slice(11, 16))).toEqual(['10:31', '11:02', '11:05', '11:20'])
    const t = naParede(mapear('f16ta', 'futures'), 'futures')
    expect(linhasDoFuso(t)).toHaveLength(10)
    expect(palavraDoFuso(t)).toBe('execucoes')
    expect(palavraDoFuso(p)).toBe('entradas')
    // Full rows: every key the RPCs know, neutral
    expect(Object.keys(linhasDoFuso(p)[0]).sort()).toEqual(Object.keys(p.rows[0]).sort())
  })

  it('faixaToda: the first to the last entry, the day cut at the largest gap (16ta 10:31–11:48; 18 06:05–17:48)', () => {
    expect(faixaToda(linhasDoFuso(naParede(mapear('f16ta', 'futures'), 'futures')))).toEqual({ from: '10:31', to: '11:48' })
    const f18 = naParede(mapear('f18', 'forex'), 'forex')
    expect(faixaToda(linhasDoFuso(f18))).toEqual({ from: '06:05', to: '17:48' })
    // Across midnight: the session stays whole
    const row = (local_entry: string) => ({ local_entry, utc_offset: null })
    expect(faixaToda([row('2026-10-01T23:10:00'), row('2026-10-02T00:20:00'), row('2026-10-02T01:05:00')])).toEqual({ from: '23:10', to: '01:05' })
    expect(faixaToda([{ local_entry: '2026-10-01T10:00:00', utc_offset: '+00:00' }])).toBeNull()
    // On another zone's clock (the caption of «Brasília» for an ET reference)
    expect(displaySpan(linhasDoFuso(f18) as ImportRow[], 'America/Sao_Paulo', NY, faixaToda)).toEqual({ from: '05:05', to: '16:48' })
  })
})

describe('«N contas neste arquivo» (E30)', () => {
  it('contasDoArquivo: the «Conta» values in first-appearance order with their rows; executions count only filled rows', () => {
    expect(contasDoArquivo(mapear('f17', 'futures'))).toEqual([
      { valor: 'APX-0001', chave: 'APX-0001', n: 31 },
      { valor: 'APX-0002', chave: 'APX-0002', n: 26 },
    ])
    expect(contasDoArquivo(mapear('f16c', 'futures'), 'futures').map((c) => [c.valor, c.n])).toEqual([
      ['LT50K-0193', 3],
      ['LT50K-0194', 3],
    ])
    expect(contasDoArquivo(mapear('f8', 'futures'))).toEqual([])
    expect(contasDoArquivo(mapear('f16t', 'futures'), 'futures')).toEqual([{ valor: 'LT50K-0193', chave: 'LT50K-0193', n: 9 }])
  })

  it('valorPreSelecionado: the account’s number, else the model’s route, else none', () => {
    const m = mapear('f17', 'futures')
    expect(valorPreSelecionado(m, CONTAS_QUADRO.apexA)).toBe('APX-0001')
    expect(valorPreSelecionado(m, { ...CONTAS_QUADRO.apexA, external_ref: ' apx-0002 ' })).toBe('APX-0002')
    expect(valorPreSelecionado(m, { ...CONTAS_QUADRO.apexA, external_ref: null })).toBeNull()
    const comRota: Mapeamento = {
      ...m,
      match: { kind: 'exact', template: { ...modeloBlackArrow(), accountRoutes: { [accountRouteHash('APX-0002')]: CONTAS_QUADRO.apexA.id } } },
    }
    expect(valorPreSelecionado(comRota, { ...CONTAS_QUADRO.apexA, external_ref: null })).toBe('APX-0002')
  })

  it('valorImportado: the chosen value while the «Conta» column holds it; none once the column moved or went (review 2 #4)', () => {
    const m = { ...mapear('f17', 'futures'), accountValue: 'APX-0002' }
    expect(valorImportado(m, 'futures')).toBe('APX-0002')
    expect(valorImportado({ ...m, accountValue: ' apx-0002 ' }, 'futures')).toBe(' apx-0002 ')
    expect(valorImportado({ ...m, accountValue: null }, 'futures')).toBeNull()
    const i = m.colunas.trade.indexOf('account')
    const movida: Mapeamento = { ...m, colunas: { ...m.colunas, trade: m.colunas.trade.map((c, k) => (k === 0 ? 'account' : k === i ? 'ignorar' : c)) } }
    expect(contasDoArquivo(movida).length).toBeGreaterThan(2)
    expect(valorImportado(movida, 'futures')).toBeNull()
    const sem: Mapeamento = { ...m, colunas: { ...m.colunas, trade: m.colunas.trade.map((c) => (c === 'account' ? 'ignorar' : c)) } }
    expect(valorImportado(sem, 'futures')).toBeNull()
    // The steps ahead of a stale value count on the whole file (its zone step still shows)
    expect(planoMapeado('conferir', movida, CONTAS_QUADRO.apexA, {})).toEqual(['hc', 'c', 'd'])
    expect(planoMapeado('conferir', sem, CONTAS_QUADRO.apexA, {})).toEqual(['c', 'd'])
  })
})

describe('the preview’s lines (E35–E43)', () => {
  const linhas = (e: EstadoQuadro, over: Partial<Mapeamento> = {}, conta = CONTAS_QUADRO[estadoConta(e)]) => {
    const m = { ...mapeamentoDoEstado(e, e.startsWith('15') ? [modeloBlackArrow()] : []), ...over }
    const f = arquivoDoMapeamento(m, conta.market, tzDe(e)) as MappedFile
    return linhasDaPrevia(f, previaQuadro(e), m, conta)
  }
  const estadoConta = (e: EstadoQuadro) => (require('@/testing/mapeadoRespostas').ESTADOS_QUADRO[e].conta as keyof typeof CONTAS_QUADRO)
  const tzDe = (e: EstadoQuadro) => require('@/testing/mapeadoRespostas').ESTADOS_QUADRO[e].tz as string

  it('8: lines, no execution count, the commission, «Sem hora de saída»', () => {
    const l = linhas('8')
    expect(l.execucoes).toBeNull()
    expect(l.contagem).toEqual([
      [18, 'linhas'],
      [18, 'novas'],
      [0, 'já estavam'],
      [0, 'com erro'],
    ])
    expect(l.antes).toEqual([])
    expect(l.sobras).toBeNull()
    expect(l.comissao).toEqual({ bruto: '+US$ 41,25', custo: '−US$ 26,04' })
    expect(l.depois).toEqual(['Sem hora de saída, o resultado conta no limite do dia na hora da entrada.'])
    expect(l.g1).toBeNull()
  })

  it('8 · Top One: G1 «18 operações caem em dias …»', () => {
    expect(linhas('8g').g1).toBe('18 operações caem em dias em que Top One já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.')
  })

  it('16ta «Não sei»: saídas, the leftover headline of one symbol and its reasons', () => {
    const l = linhas('16ta-naosei')
    expect(l.execucoes).toBe(10)
    expect(l.contagem).toEqual([
      [2, 'saídas'],
      [2, 'novas'],
      [0, 'já estavam'],
    ])
    expect(l.antes.map((a) => a.texto)).toEqual(['As 2 saídas viram 2 operações.', '3 ordens sem execução ficaram de fora.'])
    expect(l.antes.every((a) => !a.paragrafo)).toBe(true)
    expect(l.sobras?.titulo).toBe('As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.')
    expect(l.sobras?.linhas.map((x) => x.line)).toEqual([2, 4, 5, 10, 11, 12, 13])
    expect(l.depois).toEqual(['Sem comissão no arquivo: estas operações ficam sem comissão.'])
  })

  it('16i: a mixed headline «3 execuções ficaram de fora.» with each line’s reason', () => {
    const l = linhas('16i')
    expect(l.sobras).toEqual({
      titulo: '3 execuções ficaram de fora.',
      linhas: [
        { line: 2, motivo: 'fecha uma posição aberta antes do começo do arquivo' },
        { line: 7, motivo: 'opção, fica de fora (registre no Registrar)' },
        { line: 9, motivo: 'posição ainda aberta no fim do arquivo' },
      ],
    })
    expect(l.comissao).toEqual({ bruto: '+US$ 283,00', custo: '−US$ 5,00' })
  })

  it('16b: «Os horários já trazem o fuso (UTC).», the BNB fee, the Cripto day line', () => {
    const l = linhas('16b-sim')
    expect(l.antes.map((a) => a.texto)).toContain('Os horários já trazem o fuso (UTC).')
    expect(l.depois).toEqual([
      '2 operações ficam sem comissão: a taxa veio em BNB.',
      '2 operações ficam em outro dia que o do arquivo: o dia de Cripto vira à meia-noite de Brasília.',
    ])
  })

  it('17: «não importadas (APX-0002)»; the pairs in the file’s order whichever value is imported (IC l.1003, review 1 #1)', () => {
    const l = linhas('17')
    expect(l.contagem[2]).toEqual([26, 'não importadas (APX-0002)'])
    const l2 = linhas('17-apx2')
    expect(l2.contagem[2]).toEqual([31, 'não importadas (APX-0001)'])
    const quadro = [
      { escrito: 'MNQ 12-26', como: 'MNQZ26' },
      { escrito: 'MES 12-26', como: 'MESZ26' },
    ]
    // APX-0002's first row is MES (file line 2); the board's line still reads MNQ first
    expect(paresDeAtivos(mapeamentoDoEstado('17-apx2'), arquivoDoEstado('17-apx2'))).toEqual(quadro)
    expect(paresDeAtivos(mapeamentoDoEstado('17'), arquivoDoEstado('17'))).toEqual(quadro)
    expect(l2.antes.map((a) => a.texto)).toContain('Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.')
  })

  it('paresDeAtivos: a spelling only in the rows of a value not imported stays out, even when it becomes an imported symbol', () => {
    // NINJA's four rows (APX-0001: «MNQ 12-26»; APX-0002: «MES 12-26») and a fifth on APX-0002 that writes MNQ as «MNQ Dec26»
    const texto = [NINJA, '5,MNQ Dec26,APX-0002,Long,1,25100.00,25104.00,10/2/2026 9:40:00 AM,10/2/2026 9:45:00 AM,8.00,1.24'].join('\n')
    const m1 = { ...mapearTexto(texto, 'futures'), resultIsNet: false, accountValue: 'APX-0001' }
    const f1 = arquivoDoMapeamento(m1, 'futures', NY) as MappedFile
    expect(f1.ok).toBe(true)
    // APX-0001 imports MNQZ26, written «MNQ 12-26» on its rows; «MNQ Dec26» is only on APX-0002's
    expect(paresDeAtivos(m1, f1)).toEqual([{ escrito: 'MNQ 12-26', como: 'MNQZ26' }])
    const m2 = { ...m1, accountValue: 'APX-0002' }
    expect(paresDeAtivos(m2, arquivoDoMapeamento(m2, 'futures', NY) as MappedFile)).toEqual([
      { escrito: 'MES 12-26', como: 'MESZ26' },
      { escrito: 'MNQ Dec26', como: 'MNQZ26' },
    ])
  })

  it('«1 não importada (…)»: the count word agrees with one row of another «Conta» value (review 1 #3, review 2 #3)', () => {
    expect(PASSO_D.naoImportadas(1, ['APX-0002'])).toBe('não importada (APX-0002)')
    expect(PASSO_D.naoImportadas(26, ['APX-0002'])).toBe('não importadas (APX-0002)')
    const linhasNinja = NINJA.split('\n')
    // Three rows: APX-0001 twice, APX-0002 once
    const texto = [linhasNinja[0], linhasNinja[1], linhasNinja[2], linhasNinja[3]].join('\n')
    const m = { ...mapearTexto(texto, 'futures'), resultIsNet: false, accountValue: 'APX-0001' }
    const f = arquivoDoMapeamento(m, 'futures', NY) as MappedFile
    expect(f.notImported).toBe(1)
    const l = linhasDaPrevia(f, { ...previaQuadro('17'), new: 2, rows_total: 2 }, m, CONTAS_QUADRO.apexA)
    expect(l.contagem).toEqual([
      [3, 'linhas'],
      [2, 'novas'],
      [1, 'não importada (APX-0002)'],
      [0, 'já estavam'],
      [0, 'com erro'],
    ])
  })

  it('two symbols answered «Não sei»: the mixed headline «{n} execuções ficaram de fora.», never one symbol’s', () => {
    const texto = [
      TV_HEADER,
      tv('9901', 'Buy', 'MESZ6', '2', '2', '6812.25', '10/13/2026 10:31:05', 'Filled'),
      tv('9902', 'Sell', 'MESZ6', '1', '1', '6816.00', '10/13/2026 10:38:40', 'Filled'),
      tv('9903', 'Buy', 'MNQZ6', '1', '1', '25100.00', '10/13/2026 10:40:00', 'Filled'),
    ].join('\n')
    const m = mapearTexto(texto, 'futures')
    const f = arquivoDoMapeamento(m, 'futures', NY) as MappedFile
    expect(f.endOfFile.map((q) => [q.symbol, q.answer])).toEqual([
      ['MESZ6', 'unknown'],
      ['MNQZ6', 'unknown'],
    ])
    const errors = f.errors.map((e) => ({ line: e.line, code: e.code }))
    expect(errors.every((e) => e.code === 'unbalanced_symbol')).toBe(true)
    const l = linhasDaPrevia(f, { ...previaQuadro('16ta-naosei'), new: 0, errors, rows_total: errors.length }, m, CONTAS_QUADRO.lucid)
    expect(l.sobras?.titulo).toBe(`${errors.length} execuções ficaram de fora.`)
  })

  it('every fee in another asset: «… a taxa veio em BNB.» alone, never «Sem comissão no arquivo»', () => {
    const linhasBn = BINANCE.split('\n')
    // BTC bought and sold, both fees in BNB
    const texto = [linhasBn[0], linhasBn[1].replace('1.41USDT', '0.0003BNB'), linhasBn[3].replace('1.41USDT', '0.0003BNB')].join('\n')
    const m = mapearTexto(texto, 'crypto')
    const f = arquivoDoMapeamento(m, 'crypto', 'UTC') as MappedFile
    expect(f.rows.every((r) => r.commission === null)).toBe(true)
    const l = linhasDaPrevia(f, { ...previaQuadro('16b-sim'), day_changes: 0, errors: [] }, m, CONTAS_QUADRO.binance)
    expect(l.depois).toEqual(['1 operação fica sem comissão: a taxa veio em BNB.'])
  })

  it('18: the swap and the Forex day line; 19: R$, the off-tick reason with the WIN’s tick', () => {
    expect(linhas('18').depois).toEqual([
      '1 operação com swap: ele entra no resultado, antes da comissão.',
      '1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.',
    ])
    const l19 = linhas('19')
    expect(l19.comissao).toEqual({ bruto: '+R$ 412,00', custo: '−R$ 22,50' })
    expect(l19.sobras?.linhas).toEqual([
      { line: 9, motivo: 'preço fora do passo do WIN (de 5 em 5)' },
      { line: 15, motivo: 'lado desconhecido' },
    ])
  })

  it('palavraJaEstavam: «já estavam» at 0 or partly by time and price, «(mesma hora e preço)» all of them, «(mesmo ID)» otherwise', () => {
    expect(palavraJaEstavam({ duplicate: 0 })).toBe('já estavam')
    expect(palavraJaEstavam({ duplicate: 4, duplicate_same: 4 })).toBe('já estavam (mesma hora e preço)')
    expect(palavraJaEstavam({ duplicate: 4, duplicate_same: 1 })).toBe('já estavam')
    expect(palavraJaEstavam({ duplicate: 18 })).toBe('já estavam (mesmo ID)')
    // Rows without an ID are found by their time and prices (the database's '@…' key): never «(mesmo ID)» (review 2 #2, D11)
    expect(palavraJaEstavam({ duplicate: 6 }, 'hora')).toBe('já estavam (mesma hora e preço)')
    expect(palavraJaEstavam({ duplicate: 6 }, 'id')).toBe('já estavam (mesmo ID)')
    expect(palavraJaEstavam({ duplicate: 6 }, 'misto')).toBe('já estavam')
    expect(palavraJaEstavam({ duplicate: 0 }, 'hora')).toBe('já estavam')
    expect(palavraJaEstavam({ duplicate: 6, duplicate_same: 2 }, 'hora')).toBe('já estavam')
  })

  it('chaveDasLinhas: a reader’s file and a mapped file with an ID column by ID; Performance.csv and NinjaTrader by time and prices', () => {
    expect(chaveDasLinhas(arquivoDoEstado('8'))).toBe('id')
    expect(chaveDasLinhas(arquivoDoEstado('16t'))).toBe('id')
    expect(chaveDasLinhas(arquivoDoEstado('18'))).toBe('id')
    expect(chaveDasLinhas(arquivoDoEstado('8p'))).toBe('hora')
    expect(chaveDasLinhas(arquivoDoEstado('17'))).toBe('hora')
    const f8 = arquivoDoEstado('8')
    expect(chaveDasLinhas({ ...f8, rows: f8.rows.map((r, i) => (i === 0 ? { ...r, external_id: null } : r)) })).toBe('misto')
    const { parseImportText } = require('@/lib/domain/import')
    const text = fs.readFileSync(path.join(__dirname, '../domain/import/fixtures/topone_ok.csv'), 'utf8')
    expect(chaveDasLinhas(parseImportText(text))).toBe('id')
  })

  it('8 · Performance.csv again: «6 já estavam (mesma hora e preço)» (the database answers duplicate 6, no duplicate_same)', () => {
    const p = previaQuadro('8p-de-novo')
    expect(p).toMatchObject({ new: 0, duplicate: 6 })
    expect(p).not.toHaveProperty('duplicate_same')
    expect(linhas('8p-de-novo').contagem).toEqual([
      [6, 'linhas'],
      [0, 'novas'],
      [6, 'já estavam (mesma hora e preço)'],
      [0, 'com erro'],
    ])
  })

  it('a reader’s file keeps its as-built paragraphs and words', () => {
    const { parseImportText } = require('@/lib/domain/import')
    const fs2 = require('fs')
    const text = fs2.readFileSync(path.join(__dirname, '../domain/import/fixtures/topone_ok.csv'), 'utf8')
    const parsed = parseImportText(text)
    const l = linhasDaPrevia(parsed, { ...previaQuadro('8'), linked: 1, grouped: 1, duplicate: 2, new: 4 }, null, CONTAS_QUADRO.topOne)
    expect(l.antes.slice(0, 2)).toEqual([
      { texto: '1 já registrada por você: o arquivo completa a comissão.', paragrafo: true },
      { texto: '1 saída parcial juntada à sua operação.', paragrafo: true },
    ])
    expect(l.contagem.map((c) => c[1])).toEqual(['linhas', 'novas', 'já registrada por você', 'já estavam (mesmo ID)', 'com erro'])
    expect(l.depois).toEqual([])
  })
})

describe('motivoDaLinha and rowErrorReason (§3.3)', () => {
  it('a mapped file names the field’s label, its side «lado desconhecido»; a reader keeps its own words', () => {
    const m = mapear('f8', 'futures')
    const issues = [{ line: 3, code: 'bad_number' as const, column: 'entry_price' as const }]
    expect(motivoDaLinha({ line: 3, code: 'bad_number' }, { issues, m, market: 'futures' })).toBe('número inválido em Preço de entrada')
    expect(motivoDaLinha({ line: 4, code: 'bad_direction' }, { issues: [], m, market: 'futures' })).toBe('lado desconhecido')
    expect(motivoDaLinha({ line: 4, code: 'bad_direction' }, { issues: [], m: null, market: 'futures' })).toBe('direção desconhecida')
    expect(motivoDaLinha({ line: 3, code: 'bad_number' }, { issues: [{ line: 3, code: 'bad_number', column: 'PnL' }], m: null, market: 'futures' })).toBe('número inválido em PnL')
  })

  it('every new code has its words (N), the off tick without a known tick says «do ativo»', () => {
    expect(rowErrorReason('no_price_result')).toBe('sem resultado: este ativo não tem conta pelos preços')
    expect(rowErrorReason('not_dollar_quote')).toBe('par fora do dólar (USDT, USDC ou USD)')
    expect(rowErrorReason('missing_price')).toBe('execução sem preço')
    expect(rowErrorReason('symbol_has_error')).toBe('outra execução do ativo tem erro')
    expect(rowErrorReason('position_too_large')).toBe('operação grande demais para guardar')
    expect(rowErrorReason('pnl_mismatch')).toBe('resultado diferente do calculado pelos preços')
    expect(rowErrorReason('off_tick')).toBe('preço fora do passo do ativo')
    expect(rowErrorReason('off_tick', { raiz: 'WIN', passo: '5' })).toBe('preço fora do passo do WIN (de 5 em 5)')
  })
})

describe('linhaDoModelo (E46)', () => {
  it('each outcome’s line; none for a touch', () => {
    expect(linhaDoModelo({ tipo: 'salvo', nome: 'BlackArrow' })).toBe('Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.')
    expect(linhaDoModelo({ tipo: 'atualizado', nome: 'BlackArrow' })).toBe('Modelo “BlackArrow” atualizado: os próximos arquivos com estas colunas entram direto.')
    expect(linhaDoModelo({ tipo: 'naoSalvo', nome: 'X' })).toBe('Colunas usadas só neste arquivo.')
    expect(linhaDoModelo({ tipo: 'erro', nome: 'X' })).toBe('O modelo “X” não foi salvo. As operações já entraram; no próximo arquivo, diga de novo o que é cada coluna.')
    expect(linhaDoModelo({ tipo: 'limite', nome: 'X' })).toBe('O modelo “X” não foi salvo: já são 50 modelos. As operações já entraram.')
    expect(linhaDoModelo({ tipo: 'semLote', nome: 'X' })).toBe('O modelo “X” não foi atualizado: este arquivo não trouxe operações novas.')
    expect(linhaDoModelo({ tipo: 'tocado', nome: 'X' })).toBeNull()
    expect(linhaDoModelo(null)).toBeNull()
  })
})

describe('f16c: the end-of-file answer given on «conferir» survives hc (§6.7)', () => {
  it('«Sim» under the composite key reaches the one account’s rows as open_at_end', () => {
    const m = { ...mapear('f16c', 'futures'), endOfFile: { [endOfFileKey('MESZ6', 'LT50K-0193')]: 'yes' as const } }
    const f = arquivoDoMapeamento({ ...m, accountValue: 'LT50K-0193' }, 'futures', NY)
    expect(f.ok && f.errors.map((e) => e.code)).toEqual(['open_at_end'])
  })
})

// ------------------------------------------------------------------------------------------------
// §8.3: the lane's copy
// ------------------------------------------------------------------------------------------------

describe('lane L2’s copy (contract §8.3)', () => {
  const COPY = path.join(__dirname, '../../components/hub/contas/copy.ts')
  /** The file's string literals (its comments out): what can reach a screen */
  const strings = (file: string) =>
    (fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? []).map((x) => x.slice(1, -1))

  it('no prototype label, no «exemplo» and no stale board copy (E58) in the copy’s strings', () => {
    const { ERROS_PRECOS } = require('@/components/hub/registrar/copy')
    const textos = [...strings(COPY), ERROS_PRECOS.antesRegras('13 out')]
    expect(textos.length).toBeGreaterThan(300)
    for (const t of [
      'Cenário do protótipo',
      'fora do produto',
      'Recomeçar',
      'No protótipo',
      '(no protótipo)',
      'exemplo',
      'Informe por contrato',
      'Seguir bruto',
      'A conta fica marcada “bruto”',
      'CSV, Excel ou HTML',
      'Lembrar para os próximos arquivos deste modelo',
      'Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.',
    ]) {
      expect([t, textos.filter((x) => x.includes(t))]).toEqual([t, []])
    }
    expect(ERROS_PRECOS.antesRegras('13 out')).toBe('Antes de 13 out esta conta não tinha regras: essas operações entram pela importação de arquivo.')
  })

  it('each Phase 3b block’s string carries its marker (B with its IC line, A, N)', () => {
    const src = fs.readFileSync(COPY, 'utf8')
    for (const bloco of ['PASSO_A2', 'PASSO_HC', 'FIM_MODELO']) {
      const corpo = src.slice(src.indexOf(`export const ${bloco} = {`), src.indexOf('\n}\n', src.indexOf(`export const ${bloco} = {`)))
      const linhas = corpo.split('\n')
      const chaves = linhas.map((l, i) => [l, i] as const).filter(([l]) => /^\s{2}(\/\*\*.*\*\/\s*)?[a-zA-Z]+:/.test(l))
      expect(chaves.length).toBeGreaterThan(2)
      for (const [l, i] of chaves) {
        // The marker on the key's line, or in the doc comment right above it
        const comentario = /\/\*\*/.test(l) ? l : linhas[i - 1]?.trim().startsWith('/**') ? linhas[i - 1] : ''
        expect([bloco, l, comentario]).toEqual([bloco, l, expect.stringMatching(/\/\*\* (B IC l\.\d|A |N[: ])/)])
      }
    }
  })
})

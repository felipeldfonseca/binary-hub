/**
 * @jest-environment node
 *
 * lib/hub/registrarAtivos (3-4, lane D): what each instrument's form looks like (the board's
 * `specDe`) over the descriptors, the «Buscar ativo» search over the approved catalogs, the chips,
 * and the starting values (padroesDoRegistrar) of the new markets, from the recorded recent trades.
 */
import { tradeInstrument, type OptionContract } from '@/lib/domain/registro'
import { padroesDoRegistrar, cotacaoDoSimbolo } from '@/lib/hub/registrar'
import {
  ativoDoSimbolo,
  buscarAtivos,
  catalogoDe,
  chipsDoAtivo,
  formaDoAtivo,
  simboloRegistrado,
  statusBusca,
  type Cotacao,
  type FormaAtivo,
} from '@/lib/hub/registrarAtivos'
import type { AccountMarket } from '@/lib/domain/markets'
import { recentesMercados } from '@/testing/registrarMercados'

const OPTION: OptionContract = { right: 'call', strike: '790', expires_on: '2026-10-15' }

const resumo = (f: FormaAtivo) => ({
  tipo: f.tipo,
  simbolo: f.simbolo,
  raiz: f.raiz,
  modo: f.modo,
  unidade: f.unidadeStop,
  mostra: f.casasMostra,
  max: f.casasMax,
  ponto: f.pontoDecimal,
  exemplo: f.exemplo,
  q: f.quantidade.tipo,
  dif: f.diferenca,
  tick: f.tickTexto,
  passo: f.nomePasso,
})

type Caso = [AccountMarket, string, { opcao?: boolean; cotacao?: Cotacao } | undefined, ReturnType<typeof resumo>]

const casos: Caso[] = [
  ['futures', 'MES', undefined, { tipo: 'fut', simbolo: 'MES', raiz: 'MES', modo: 'exato', unidade: 'pts', mostra: 2, max: null, ponto: false, exemplo: '7.896,25', q: 'contratos', dif: 'ptsFut', tick: '0,25', passo: 'MES' }],
  ['futures', 'CL', undefined, { tipo: 'fut', simbolo: 'CL', raiz: 'CL', modo: 'exato', unidade: 'pts', mostra: 2, max: null, ponto: false, exemplo: '7.896,25', q: 'contratos', dif: 'ptsFut', tick: '0,01', passo: 'CL' }],
  ['futures', 'MCLZ6', undefined, { tipo: 'fut', simbolo: 'MCLZ6', raiz: 'MCL', modo: 'exato', unidade: 'pts', mostra: 2, max: null, ponto: false, exemplo: '7.896,25', q: 'contratos', dif: 'ptsFut', tick: '0,01', passo: 'MCL' }],
  ['futures', 'MESZ6', undefined, { tipo: 'fut', simbolo: 'MESZ6', raiz: 'MES', modo: 'exato', unidade: 'pts', mostra: 2, max: null, ponto: false, exemplo: '7.896,25', q: 'contratos', dif: 'ptsFut', tick: '0,25', passo: 'MES' }],
  ['futures', 'ZN', undefined, { tipo: 'futx', simbolo: 'ZN', raiz: 'ZN', modo: 'digitado', unidade: 'preco', mostra: 2, max: 8, ponto: false, exemplo: '110,50', q: 'contratos', dif: 'preco', tick: null, passo: 'ZN' }],
  ['futures', 'znz6', undefined, { tipo: 'futx', simbolo: 'ZNZ6', raiz: 'ZN', modo: 'digitado', unidade: 'preco', mostra: 2, max: 8, ponto: false, exemplo: '110,50', q: 'contratos', dif: 'preco', tick: null, passo: 'ZN' }],
  ['forex', 'EUR/USD', undefined, { tipo: 'fx', simbolo: 'EUR/USD', raiz: 'EURUSD', modo: 'exato', unidade: 'pips', mostra: 5, max: 5, ponto: true, exemplo: '1,08520', q: 'lotes', dif: 'pips', tick: null, passo: 'EURUSD' }],
  ['forex', 'USD/JPY', undefined, { tipo: 'fx', simbolo: 'USD/JPY', raiz: 'USDJPY', modo: 'estimativa', unidade: 'pips', mostra: 3, max: 5, ponto: true, exemplo: '151,240', q: 'lotes', dif: 'pips', tick: null, passo: 'USDJPY' }],
  ['forex', 'EUR/GBP', undefined, { tipo: 'fx', simbolo: 'EUR/GBP', raiz: 'EURGBP', modo: 'digitado', unidade: 'pips', mostra: 5, max: 5, ponto: true, exemplo: '1,08520', q: 'lotes', dif: 'pips', tick: null, passo: 'EURGBP' }],
  ['forex', 'USD/INR', undefined, { tipo: 'fx', simbolo: 'USD/INR', raiz: 'USDINR', modo: 'digitado', unidade: 'preco', mostra: 4, max: 5, ponto: true, exemplo: '88,1250', q: 'lotes', dif: 'preco', tick: null, passo: 'USDINR' }],
  ['forex', 'USD/KRW', undefined, { tipo: 'fx', simbolo: 'USD/KRW', raiz: 'USDKRW', modo: 'digitado', unidade: 'preco', mostra: 2, max: 5, ponto: false, exemplo: '1.385,50', q: 'lotes', dif: 'preco', tick: null, passo: 'USDKRW' }],
  ['forex', 'XAUUSD', undefined, { tipo: 'fx', simbolo: 'XAUUSD', raiz: 'XAUUSD', modo: 'digitado', unidade: 'preco', mostra: 2, max: 5, ponto: false, exemplo: '4.409,80', q: 'lotes', dif: 'preco', tick: null, passo: 'XAUUSD' }],
  ['stocks', 'AAPL', undefined, { tipo: 'acao', simbolo: 'AAPL', raiz: 'AAPL', modo: 'exato', unidade: 'preco', mostra: 2, max: 4, ponto: true, exemplo: '231,40', q: 'acoes', dif: 'acao', tick: null, passo: 'AAPL' }],
  ['stocks', 'BRK.B', undefined, { tipo: 'acao', simbolo: 'BRK.B', raiz: 'BRKB', modo: 'exato', unidade: 'preco', mostra: 2, max: 4, ponto: true, exemplo: '231,40', q: 'acoes', dif: 'acao', tick: null, passo: 'BRKB' }],
  ['stocks', 'SPY', { opcao: true }, { tipo: 'opcao', simbolo: 'SPY', raiz: 'SPY', modo: 'exato', unidade: 'premio', mostra: 2, max: 2, ponto: true, exemplo: '1,85', q: 'contratos', dif: 'premio', tick: null, passo: 'SPY' }],
  ['options', 'SPX', undefined, { tipo: 'opcao', simbolo: 'SPX', raiz: 'SPX', modo: 'exato', unidade: 'premio', mostra: 2, max: 2, ponto: true, exemplo: '1,85', q: 'contratos', dif: 'premio', tick: null, passo: 'SPX' }],
  ['crypto', 'BTC', { cotacao: 'USDT' }, { tipo: 'cri', simbolo: 'BTC/USDT', raiz: 'BTCUSDT', modo: 'exato', unidade: 'preco', mostra: 0, max: 8, ponto: false, exemplo: '112.400', q: 'moeda', dif: 'moeda', tick: null, passo: 'BTCUSDT' }],
  ['crypto', 'BTC', { cotacao: 'USDC' }, { tipo: 'cri', simbolo: 'BTC/USDC', raiz: 'BTCUSDC', modo: 'exato', unidade: 'preco', mostra: 0, max: 8, ponto: false, exemplo: '112.400', q: 'moeda', dif: 'moeda', tick: null, passo: 'BTCUSDC' }],
  ['crypto', 'BTC', { cotacao: 'USD' }, { tipo: 'cri', simbolo: 'BTC/USD', raiz: 'BTCUSD', modo: 'exato', unidade: 'preco', mostra: 0, max: 8, ponto: false, exemplo: '112.400', q: 'moeda', dif: 'moeda', tick: null, passo: 'BTCUSD' }],
  ['crypto', 'BTC', { cotacao: 'R$' }, { tipo: 'cri', simbolo: 'BTC/BRL', raiz: 'BTCBRL', modo: 'digitado', unidade: 'preco', mostra: 0, max: 8, ponto: false, exemplo: '112.400', q: 'moeda', dif: 'moeda', tick: null, passo: 'BTCBRL' }],
  ['b3', 'WIN', undefined, { tipo: 'b3f', simbolo: 'WIN', raiz: 'WIN', modo: 'exato', unidade: 'pts', mostra: 0, max: null, ponto: false, exemplo: '131.250', q: 'contratosB3', dif: 'pts', tick: '5', passo: 'WIN' }],
  ['b3', 'WINZ26', undefined, { tipo: 'b3f', simbolo: 'WINZ26', raiz: 'WIN', modo: 'exato', unidade: 'pts', mostra: 0, max: null, ponto: false, exemplo: '131.250', q: 'contratosB3', dif: 'pts', tick: '5', passo: 'WIN' }],
  ['b3', 'WDO', undefined, { tipo: 'b3f', simbolo: 'WDO', raiz: 'WDO', modo: 'exato', unidade: 'pts', mostra: 1, max: null, ponto: false, exemplo: '131.250', q: 'contratosB3', dif: 'pts', tick: '0,5', passo: 'WDO' }],
  ['b3', 'DI1F27', undefined, { tipo: 'di', simbolo: 'DI1F27', raiz: 'DI1', modo: 'digitado', unidade: 'preco', mostra: 3, max: 3, ponto: false, exemplo: '14,250', q: 'contratosB3', dif: 'preco', tick: null, passo: 'DI1' }],
  ['b3', 'PETR4', undefined, { tipo: 'b3a', simbolo: 'PETR4', raiz: 'PETR4', modo: 'exato', unidade: 'preco', mostra: 2, max: 4, ponto: false, exemplo: '38,42', q: 'acoesB3', dif: 'acao', tick: null, passo: 'PETR4' }],
  ['b3', 'PETR4F', undefined, { tipo: 'b3a', simbolo: 'PETR4F', raiz: 'PETR4', modo: 'exato', unidade: 'preco', mostra: 2, max: 4, ponto: false, exemplo: '38,42', q: 'acoesB3', dif: 'acao', tick: null, passo: 'PETR4' }],
  ['b3', 'BOVA11', undefined, { tipo: 'b3a', simbolo: 'BOVA11', raiz: 'BOVA11', modo: 'exato', unidade: 'preco', mostra: 2, max: 4, ponto: false, exemplo: '38,42', q: 'acoesB3', dif: 'acao', tick: null, passo: 'BOVA11' }],
  ['b3', 'BGIX26', undefined, { tipo: 'b3x', simbolo: 'BGIX26', raiz: 'BGIX26', modo: 'digitado', unidade: 'preco', mostra: 2, max: 8, ponto: false, exemplo: '131.250', q: 'unidades', dif: 'preco', tick: null, passo: 'BGIX26' }],
  ['b3', 'XPTO3', undefined, { tipo: 'b3x', simbolo: 'XPTO3', raiz: 'XPTO3', modo: 'digitado', unidade: 'preco', mostra: 2, max: 8, ponto: false, exemplo: '131.250', q: 'unidades', dif: 'preco', tick: null, passo: 'XPTO3' }],
]

describe('formaDoAtivo (the board’s specDe over the descriptors)', () => {
  it.each(casos.map((c) => [`${c[0]} ${c[1]}${c[2]?.opcao ? ' (opção)' : ''}${c[2]?.cotacao ? ` / ${c[2].cotacao}` : ''}`, c] as const))('%s', (_l, [market, simbolo, o, want]) => {
    const f = formaDoAtivo(market, simbolo, o)!
    expect(resumo(f)).toEqual(want)
    // Never a second copy of the money rules: the spec is the descriptors'
    const opcao = market === 'options' || !!o?.opcao
    expect(f.spec).toEqual(tradeInstrument(market, f.simbolo, opcao ? OPTION : null))
  })

  it('says nothing for an empty symbol or a binary account', () => {
    expect(formaDoAtivo('futures', '  ')).toBeNull()
    expect(formaDoAtivo('binary', 'EUR/USD')).toBeNull()
  })

  it('gives each quantity kind its label, chips and suffix (RO l.743–749, `qTxt`)', () => {
    const q = (m: AccountMarket, s: string, o?: { opcao?: boolean; cotacao?: Cotacao }) => formaDoAtivo(m, s, o)!.quantidade
    expect(q('futures', 'MES')).toMatchObject({ rotulo: 'Contratos', chips: ['1', '2', '3'], outroRotulo: 'Quantos contratos?', inteira: true, exemplo: '4' })
    expect(q('futures', 'MES').sufixo('2')).toBe('2 ct')
    expect(q('b3', 'WIN')).toMatchObject({ rotulo: 'Contratos', chips: ['1', '2', '3', '5', '10'] })
    expect(q('forex', 'EUR/USD')).toMatchObject({ rotulo: 'Lotes', chips: ['0.01', '0.1', '0.5', '1'], outroRotulo: 'Quantos lotes?', casas: 2, exemplo: '0,25' })
    expect(['0.5', '1', '2', '0.01'].map(q('forex', 'EUR/USD').sufixo)).toEqual(['0,50 lote', '1,00 lote', '2,00 lotes', '0,01 lote'])
    expect(q('stocks', 'AAPL')).toMatchObject({ rotulo: 'Ações', chips: null, inteira: false, casas: 6 })
    expect(['1', '300', '10.5'].map(q('stocks', 'AAPL').sufixo)).toEqual(['1 ação', '300 ações', '10,5 ações'])
    expect(q('stocks', 'SPY', { opcao: true }).sufixo('2')).toBe('2 ct')
    expect(q('crypto', 'BTC')).toMatchObject({ rotulo: 'Quantidade, em BTC', chips: null, casas: 8 })
    expect(q('crypto', 'BTC').sufixo('0.25')).toBe('0,25 BTC')
    expect(q('b3', 'PETR4')).toMatchObject({ rotulo: 'Ações', inteira: true, lote100: true })
    expect(q('b3', 'PETR4F').lote100).toBe(false)
    expect(q('b3', 'BGIX26')).toMatchObject({ rotulo: 'Quantidade', inteira: true })
    expect(q('b3', 'BGIX26').sufixo('2')).toBe('2 un.')
  })
})

describe('the registered symbol and the quote', () => {
  it('joins a coin and its quote; R$ is stored as BRL', () => {
    expect(simboloRegistrado('crypto', 'btc', 'USDT')).toBe('BTC/USDT')
    expect(simboloRegistrado('crypto', 'BTC', 'R$')).toBe('BTC/BRL')
    expect(simboloRegistrado('crypto', 'BTC')).toBe('BTC/USDT')
    expect(simboloRegistrado('crypto', 'ETH/BTC', 'USDT')).toBe('ETH/BTC')
    expect(simboloRegistrado('forex', ' eur/usd ')).toBe('EUR/USD')
    expect(simboloRegistrado('b3', 'winz26')).toBe('WINZ26')
  })

  it('splits a stored pair back (BTC/USDT, BTCUSDT, BTC/BRL, AVAX/BRL from «Usar»)', () => {
    expect(ativoDoSimbolo('crypto', 'BTC/USDT')).toEqual({ ativo: 'BTC', cotacao: 'USDT' })
    expect(ativoDoSimbolo('crypto', 'BTCUSDT')).toEqual({ ativo: 'BTC', cotacao: 'USDT' })
    expect(ativoDoSimbolo('crypto', 'ETHUSDC')).toEqual({ ativo: 'ETH', cotacao: 'USDC' })
    expect(ativoDoSimbolo('crypto', 'BTC/BRL')).toEqual({ ativo: 'BTC', cotacao: 'R$' })
    expect(ativoDoSimbolo('crypto', 'avax/brl')).toEqual({ ativo: 'AVAX', cotacao: 'R$' })
    expect(ativoDoSimbolo('crypto', 'ETH/BTC')).toEqual({ ativo: 'ETH/BTC', cotacao: null })
    expect(ativoDoSimbolo('stocks', 'spy')).toEqual({ ativo: 'SPY', cotacao: null })
    expect(cotacaoDoSimbolo('SOLUSD')).toEqual({ ativo: 'SOL', cotacao: 'USD' })
  })
})

describe('«Buscar ativo / par / moeda»', () => {
  it('finds in the catalog by code, in its order, at most six (RO l.1084)', () => {
    expect(buscarAtivos('forex', 'eurusd')).toEqual({ resultados: ['EUR/USD'], usar: null })
    expect(buscarAtivos('forex', 'usd').resultados).toEqual(['EUR/USD', 'USD/JPY', 'USD/CNH', 'GBP/USD', 'AUD/USD', 'USD/CAD'])
    expect(buscarAtivos('futures', 'mcl')).toEqual({ resultados: ['MCL'], usar: null })
    expect(buscarAtivos('futures', 'Z').resultados).toEqual(['ZN', 'ZF', 'ZT', 'ZB', 'ZQ', 'ZC'])
    expect(buscarAtivos('stocks', 'a').resultados).toHaveLength(6)
    expect(buscarAtivos('crypto', 'sol')).toEqual({ resultados: ['SOL'], usar: null })
    expect(buscarAtivos('b3', 'petr').resultados).toEqual(['PETR4', 'PETR3'])
  })

  it('finds a former B3 code by its new one (ELET3 → AXIA3)', () => {
    expect(buscarAtivos('b3', 'elet3')).toEqual({ resultados: ['AXIA3'], usar: null })
    expect(buscarAtivos('b3', 'BRFS3').resultados).toEqual(['MBRF3'])
  })

  it('offers «Usar “X”» only when nothing of the catalog matches and X can be a symbol', () => {
    expect(buscarAtivos('forex', 'xauusd')).toEqual({ resultados: [], usar: 'XAUUSD' })
    expect(buscarAtivos('b3', 'winz26')).toEqual({ resultados: [], usar: 'WINZ26' })
    expect(buscarAtivos('futures', 'MESZ6')).toEqual({ resultados: [], usar: 'MESZ6' })
    expect(buscarAtivos('crypto', 'AVAX/BRL')).toEqual({ resultados: [], usar: 'AVAX/BRL' })
    expect(buscarAtivos('stocks', '@@')).toEqual({ resultados: [], usar: null })
    expect(buscarAtivos('stocks', '')).toEqual({ resultados: [], usar: null })
    expect(buscarAtivos('b3', '-XPTO3').usar).toBeNull()
    expect(buscarAtivos('b3', 'X'.repeat(21)).usar).toBeNull()
    expect(buscarAtivos('b3', 'X'.repeat(20)).usar).toBe('X'.repeat(20))
  })

  it('searches the index options only for «Opção» (RO l.1084)', () => {
    expect(catalogoDe('stocks', { opcao: true })).toContain('SPX')
    expect(catalogoDe('stocks')).not.toContain('SPX')
    expect(buscarAtivos('stocks', 'ndx', { opcao: true })).toEqual({ resultados: ['NDX'], usar: null })
    expect(buscarAtivos('options', 'vix').resultados).toEqual(['VIX'])
    expect(buscarAtivos('stocks', 'ndx')).toEqual({ resultados: [], usar: 'NDX' })
  })

  it('tells the screen reader what came back', () => {
    expect(statusBusca('', [])).toBe('')
    expect(statusBusca('mcl', ['MCL'])).toBe('1 resultado.')
    expect(statusBusca('z', ['ZN', 'ZF', 'ZT'])).toBe('3 resultados.')
    expect(statusBusca('xauusd', [])).toBe('Nenhum ativo do catálogo com esse código.')
  })
})

describe('the chips and the starting values', () => {
  it('futures and B3 have fixed chips; the instrument in use is appended', () => {
    expect(chipsDoAtivo('futures', null)).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'])
    expect(chipsDoAtivo('futures', null, { atual: 'znz6' })).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC', 'ZNZ6'])
    expect(chipsDoAtivo('b3', null, { atual: 'PETR4' })).toEqual(['WIN', 'WDO', 'IND', 'DOL', 'PETR4'])
    expect(chipsDoAtivo('b3', null, { atual: 'WIN' })).toEqual(['WIN', 'WDO', 'IND', 'DOL'])
  })

  it('the new markets show the board’s examples without history (RO l.590–593)', () => {
    expect(chipsDoAtivo('forex', null)).toEqual(['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD'])
    expect(chipsDoAtivo('stocks', null)).toEqual(['SPY', 'AAPL', 'NVDA', 'TSLA', 'QQQ'])
    expect(chipsDoAtivo('stocks', null, { opcao: true })).toEqual(['SPY', 'QQQ', 'SPX', 'NVDA', 'TSLA'])
    expect(chipsDoAtivo('options', null)).toEqual(['SPY', 'QQQ', 'SPX', 'NVDA', 'TSLA'])
    expect(chipsDoAtivo('crypto', null)).toEqual(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'])
  })

  it('and the account’s last five of the kind once there is history (recorded recent trades)', () => {
    const fx = padroesDoRegistrar('forex', recentesMercados('ftmo'))
    expect(fx).toMatchObject({ symbol: 'XAUUSD', simbolos: ['XAUUSD', 'EUR/GBP', 'USD/JPY', 'EUR/USD'], quantidades: { lotes: '0.2' } })
    expect(chipsDoAtivo('forex', fx, { atual: 'GBP/USD' })).toEqual(['XAUUSD', 'EUR/GBP', 'USD/JPY', 'EUR/USD', 'GBP/USD'])
    const ib = padroesDoRegistrar('stocks', recentesMercados('ibkr'))
    expect(ib).toMatchObject({ simbolos: ['AAPL'], simbolosOpcao: ['SPY'], quantidades: { contratos: '2' } })
    expect(chipsDoAtivo('stocks', ib)).toEqual(['AAPL'])
    expect(chipsDoAtivo('stocks', ib, { opcao: true })).toEqual(['SPY'])
    const bn = padroesDoRegistrar('crypto', recentesMercados('binance'))
    expect(bn).toMatchObject({ symbol: 'BTC', simbolos: ['BTC'], cotacao: 'USDT' })
    const cl = padroesDoRegistrar('b3', recentesMercados('clear'))
    expect(cl).toMatchObject({ symbol: 'WIN', simbolos: ['WIN', 'BGIX26', 'WDO'], quantidades: { contratosB3: '3' } })
    // Futures and Ebinex keep 3-3's starting values (no new keys)
    const top = padroesDoRegistrar('futures', recentesMercados('top-one'))
    expect(top).toEqual({ symbol: 'MES', quantity: '1', pairs: [], payoutBySymbol: {}, stake: null })
  })

  it('reads every recorded recent trade’s asset type (option or stock; a B3 contract or a code)', () => {
    expect(recentesMercados('ibkr').map((t) => [t.symbol, t.assetType])).toEqual([
      ['SPY', 'option'],
      ['AAPL', 'stock'],
      ['SPY', 'option'],
      ['SPY', 'option'],
    ])
    expect(recentesMercados('clear').map((t) => t.assetType)).toEqual(['futures', 'b3', 'futures', 'futures', 'futures'])
  })
})

describe('a crypto pair whose quote is none of «Cotada em» (review of 3-4 lane A)', () => {
  it('ETH/BTC: the coin ETH, the quote BTC as the labels write it, no «Cotada em» value; the four quotes keep theirs', () => {
    const f = formaDoAtivo('crypto', 'ETH/BTC', { cotacao: 'USDT' })!
    expect([f.simbolo, f.moedaBase, f.cotacao, f.moedaCotacao, f.modo]).toEqual(['ETH/BTC', 'ETH', null, 'BTC', 'digitado'])
    expect(f.quantidade.rotulo).toBe('Quantidade, em ETH')
    expect(f.quantidade.sufixo('2')).toBe('2 ETH')
    expect(formaDoAtivo('crypto', 'BTC', { cotacao: 'USDT' })!.moedaCotacao).toBe('USDT')
    expect(formaDoAtivo('crypto', 'BTC', { cotacao: 'R$' })!.moedaCotacao).toBe('R$')
    expect(formaDoAtivo('crypto', 'ETHBTC', { cotacao: 'USDC' })).toMatchObject({ simbolo: 'ETHBTC/USDC', moedaBase: 'ETHBTC', cotacao: 'USDC', moedaCotacao: 'USDC' })
    expect(formaDoAtivo('forex', 'EUR/USD')!.moedaCotacao).toBeNull()
  })
})

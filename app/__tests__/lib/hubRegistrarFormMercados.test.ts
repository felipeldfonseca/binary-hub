/**
 * lib/hub/registrarForm for the new markets (3-4, lane D): the board's scenarios 6–9 and the futures
 * «Buscar ativo», on the answers recorded from the real SQL (testing/registrarMercados; invented
 * data) at fixed instants. Every amount the form previews is compared with what the server answered
 * for the same entry or exit (the dry runs and the registrations).
 */
import { resolveLocalHm } from '@/lib/domain/tempo'
import type { AccountNow } from '@/lib/hub/regras'
import { padroesDoRegistrar } from '@/lib/hub/registrar'
import {
  alternarCorrigir,
  alternarVsv,
  ativoCurto,
  avisoLimiteEntrada,
  cartaoFechada,
  contaReg,
  escolherAtivo,
  estadoVsv,
  lerRascunho,
  linhaEscolha,
  linhaGate,
  linhaLimite,
  modeloEntrada,
  modeloSaida,
  mudarCotacao,
  mudarTipoEua,
  mudarVencimento,
  opTexto,
  rascunhoInicial,
  rascunhoMexido,
  resumoAberta,
  textoDaRecusa,
  type ContaReg,
  type Rascunho,
} from '@/lib/hub/registrarForm'
import {
  agoraMercados,
  contasMercados,
  entradaMercados,
  fechadaMercados,
  fechadaPreviaMercados,
  idsMercados,
  previaMercados,
  refusalsMercados,
  saidaMercados,
  type MercadosAgora,
} from '@/testing/registrarMercados'

const ids = idsMercados()
const KEY = '0f8c2a6e-1b2c-4d3e-8f90-123456789abc'
const contas = contasMercados()
const at = (iso: string) => new Date(iso)
const NY = 'America/New_York'
const SP = 'America/Sao_Paulo'
const num = (x: string | null) => (x === null ? null : Number(x))

function agoraDe(n: MercadosAgora, id: string): AccountNow {
  return agoraMercados(n).accounts.find((a) => a.accountId === id)!
}
function contaDe(agora: AccountNow): ContaReg {
  const a = contas.find((c) => c.id === agora.accountId)!
  return contaReg(a, agora.rules, agora.desdeDay)
}

const ftmoAgora = agoraDe('ftmo-qui-0840', ids.accounts.ftmo)
const ftmo = contaDe(ftmoAgora)
const ibkrAgora = agoraDe('ibkr-qui-0952', ids.accounts.ibkr)
const ibkr = contaDe(ibkrAgora)
const binanceAgora = agoraDe('binance-sab-2035', ids.accounts.binance)
const binance = contaDe(binanceAgora)
const clearAgora = agoraDe('clear-qui-1020', ids.accounts.clear)
const clear = contaDe(clearAgora)
const topAgora = agoraDe('top-qui-1005', ids.accounts.topOne)
const top = contaDe(topAgora)

function rascunho(conta: ContaReg, patch: Partial<Rascunho> = {}): Rascunho {
  return { ...rascunhoInicial(conta, padroesDoRegistrar(conta.market, []), KEY), ...patch }
}

describe('the accounts', () => {
  it('reads every market’s clock, currency and limit (IBKR without a window: New York)', () => {
    expect(ftmo).toMatchObject({ market: 'forex', clock: NY, currency: 'USD', temLimite: true, desdeDay: '2026-10-13' })
    expect(ibkr).toMatchObject({ market: 'stocks', clock: NY, currency: 'USD', temLimite: false, windows: [] })
    expect(binance).toMatchObject({ market: 'crypto', clock: SP, temLimite: false })
    expect(clear).toMatchObject({ market: 'b3', clock: SP, currency: 'BRL', temLimite: true })
    expect(contaReg({ id: 'x', label: 'Opções', market: 'options', platform: null }, null, null)).toMatchObject({ market: 'options', clock: NY, currency: 'USD' })
  })

  it('the gate and limit lines (scenario 6, 7, 8, 9)', () => {
    expect(linhaGate(ftmo, ftmoAgora.gate, ftmoAgora.rules, { presente: true, outroDia: false })).toMatchObject({ palavra: 'Liberado', sub: 'até 10:00 ET', tom: 'mint' })
    expect(linhaLimite(ftmo, ftmoAgora.gate, ftmoAgora.rules)).toEqual({ usado: 'US$ 0', de: 'de US$ 1.000' })
    expect(linhaGate(ibkr, ibkrAgora.gate, ibkrAgora.rules, { presente: true, outroDia: false })).toEqual({
      palavra: 'Sem janela salva',
      sub: '',
      tom: 'muted',
      acao: { texto: 'Definir', href: '/personalizar#janelas', aria: 'Definir a janela da IBKR em Personalizar' },
    })
    expect(linhaLimite(ibkr, ibkrAgora.gate, ibkrAgora.rules)).toBeNull()
    expect(linhaGate(binance, binanceAgora.gate, binanceAgora.rules, { presente: true, outroDia: false })).toMatchObject({ palavra: 'Liberado', sub: 'até 22:00 de Brasília' })
    expect(linhaGate(clear, clearAgora.gate, clearAgora.rules, { presente: true, outroDia: false })).toMatchObject({
      palavra: 'Encerrado por hoje',
      sub: '· limite de R$ 500 atingido às 10:16 (pior momento −R$ 540)',
      tom: 'red',
    })
    expect(linhaLimite(clear, clearAgora.gate, clearAgora.rules)).toEqual({ usado: 'R$ 540', de: 'de R$ 500' })
  })
})

describe('the draft v2', () => {
  it('starts each market on its first chip or the account’s last instrument, quantity per kind', () => {
    expect(rascunho(ftmo)).toMatchObject({ v: 2, ativo: 'EUR/USD', qtd: '0.01', qtdOutro: false, cotacao: 'USDT', tipoEua: 'acao' })
    expect(rascunho(ibkr)).toMatchObject({ ativo: 'SPY', tipoEua: 'acao', qtd: '', qtdOutro: true })
    expect(rascunho(binance)).toMatchObject({ ativo: 'BTC', cotacao: 'USDT', qtd: '', qtdOutro: true })
    expect(rascunho(clear)).toMatchObject({ ativo: 'WIN', qtd: '1', qtdOutro: false })
    const fxPadroes = { symbol: 'USD/JPY', quantity: '1', pairs: [], payoutBySymbol: {}, stake: null, simbolos: ['USD/JPY'], quantidades: { lotes: '0.3' } }
    expect(rascunhoInicial(ftmo, fxPadroes, KEY)).toMatchObject({ ativo: 'USD/JPY', qtd: '0,3', qtdOutro: true })
    expect(rascunhoInicial(ftmo, { ...fxPadroes, quantidades: { lotes: '0.5' } }, KEY)).toMatchObject({ qtd: '0.5', qtdOutro: false })
    const opcoes = contaReg({ id: 'o', label: 'Opções', market: 'options', platform: null }, null, null)
    expect(rascunhoInicial(opcoes, null, KEY)).toMatchObject({ tipoEua: 'opcao', ativo: 'SPY', qtd: '1', qtdOutro: false })
  })

  it('reads a stored 3-3 draft (v1) as v2, keeping its clientKey; refuses a bad v2', () => {
    const r = rascunho(ftmo, { lado: 'long', preco: '1,0852' })
    const { tipoEua: _t, cotacao: _c, busca: _b, opTipo: _o, strike: _s, vencimento: _v, vsv: _x, res: _r, corrigir: _g, custos: _u, ...v1 } = r
    const lido = lerRascunho({ ...v1, v: 1 }, ftmo.id)
    expect(lido).toEqual({ ...r, v: 2 })
    expect(lido?.clientKey).toBe(KEY)
    expect(lerRascunho(JSON.parse(JSON.stringify(r)), ftmo.id)).toEqual(r)
    expect(lerRascunho({ ...r, cotacao: 'BRL' }, ftmo.id)).toBeNull()
    expect(lerRascunho({ ...r, vencimento: '15/10/2026' }, ftmo.id)).toBeNull()
    expect(lerRascunho({ ...r, v: 3 }, ftmo.id)).toBeNull()
  })

  it('knows a search typed as something typed', () => {
    const r = rascunho(ftmo)
    expect(rascunhoMexido({ ...r, busca: 'xau' }, r)).toBe(true)
  })
})

describe('scenario 6 · Forex (FTMO, Thu 15 Oct 08:40 ET)', () => {
  const now = at('2026-10-15T12:40:05Z')
  const hoje = '2026-10-15'
  const eur = (patch: Partial<Rascunho> = {}) => rascunho(ftmo, { lado: 'long', qtd: '0.5', preco: '1.08520', stop: '12', alvo: '24', ...patch })
  const m = (r: Rascunho, tentou = false, n = now) => modeloEntrada({ conta: ftmo, r, now: n, hoje, tentou })

  it('EUR/USD in pips: the risk line, the payloads, the server’s preview', () => {
    const e = m(eur())
    expect(e.linhaRisco).toBe('risco US$ 60,00 · alvo US$ 120,00 · 1 : 2')
    expect(e.payloadPrevia).toEqual({
      v: 1, symbol: 'EUR/USD', direction: 'long', quantity: '0.5', entry_price: '1.0852', stop_pips: '12', target_pips: '24',
      clock: NY, entry: '08:40', client_key: KEY,
    })
    expect(e.payload).not.toHaveProperty('entry')
    expect(num(e.risco)).toBe(num(previaMercados('eurusd').preview.risk))
    expect(e.ativo).toMatchObject({ rotulo: 'Par', busca: { rotulo: 'Buscar par', placeholder: 'Ex.: USD/CHF ou XAUUSD', resultados: [], usar: null, status: '' } })
    expect(e.ativo?.chips.map((c) => [c.rotulo, c.selecionado])).toEqual([
      ['EUR/USD', true], ['GBP/USD', false], ['USD/JPY', false], ['EUR/GBP', false], ['AUD/USD', false],
    ])
    expect(e.quantidade).toMatchObject({ rotulo: 'Lotes', outro: false, outroRotulo: 'Quantos lotes?', nota: null })
    expect(e.quantidade?.chips?.map((c) => [c.rotulo, c.selecionado])).toEqual([['0,01', false], ['0,10', false], ['0,50', true], ['1,00', false]])
    expect(e.rotulos).toEqual({ preco: 'Preço de entrada', precoSaida: 'Preço de saída', hora: 'Hora (ET)', horaSaida: 'Hora da saída (ET)', stopAlvo: 'Stop e alvo, em pips' })
    expect(e.tipoEua).toBeNull()
    expect(e.cotacao).toBeNull()
    expect(e.opcao).toBeNull()
    expect(e.resultado).toBeNull()
  })

  it('reads «1.085» with the dot as the decimal mark; lots: «Outro» and two decimals', () => {
    expect(m(eur({ preco: '1.085' })).payload?.entry_price).toBe('1.085')
    expect(m(eur({ qtdOutro: true, qtd: '0,255' }), true).erros.q).toBe('Use até 2 casas decimais.')
    expect(m(eur({ qtdOutro: true, qtd: 'abc' }), true).erros.q).toBe('Use só números, como 0,25.')
    expect(m(eur({ qtdOutro: true, qtd: '0,25' })).payload?.quantity).toBe('0.25')
    expect(m(eur({ preco: '1,085201' }), true).erros.preco).toBe('Use até 5 casas decimais.')
    expect(m(eur({ preco: 'x' }), true).erros.preco).toBe('Use só números, como 1,08520.')
    expect(m(eur({ stop: '0' })).visiveis.stop).toBe('Use pips maiores que zero.')
  })

  it('the 300-pip stop passes what is left of the limit (the warning, from the dry run and locally)', () => {
    const e = m(eur({ stop: '300' }))
    const aviso = 'Se o stop for atingido, o dia passa do limite: faltam US$ 1.000 e o stop arrisca US$ 1.500.'
    expect(avisoLimiteEntrada(ftmo, e, ftmoAgora.gate, previaMercados('eurusd-acima').limitRoom)).toBe(aviso)
    expect(avisoLimiteEntrada(ftmo, e, ftmoAgora.gate, undefined)).toBe(aviso)
    expect(avisoLimiteEntrada(ftmo, m(eur()), ftmoAgora.gate, previaMercados('eurusd').limitRoom)).toBeNull()
  })

  it('USD/JPY: an estimate («≈», divided by the stop’s price, as the server)', () => {
    let r = escolherAtivo(eur(), 'forex', 'USD/JPY')
    expect(r).toMatchObject({ ativo: 'USD/JPY', preco: '', stop: '', alvo: '', qtd: '0.5', qtdOutro: false })
    r = { ...r, lado: 'short', qtdOutro: true, qtd: '0,30', preco: '151.240', stop: '20', alvo: '40' }
    const e = m(r)
    expect(e.linhaRisco).toBe('risco ≈ US$ 39,62 · alvo ≈ US$ 79,55 · 1 : 2')
    expect(e.risco).toBe(previaMercados('usdjpy').preview.kind === 'prices' ? '39.62' : null)
    expect(num(e.risco)).toBe(num(previaMercados('usdjpy').preview.risk))
    expect(e.forma?.modo).toBe('estimativa')
    // Without a side the level is unknown: the pips only
    expect(m({ ...r, lado: null }).linhaRisco).toBe('risco 20 pips · alvo 40 pips · 1 : 2')
    expect(avisoLimiteEntrada(ftmo, m({ ...r, stop: '3500' }), ftmoAgora.gate, undefined)).toMatch(/e o stop arrisca ≈ US\$ /)
  })

  it('EUR/GBP: typed, the risk in pips; XAUUSD via «Usar», price stops, no dollar value', () => {
    const gbp = m({ ...escolherAtivo(eur(), 'forex', 'EUR/GBP'), lado: 'short', preco: '0.87120', stop: '10', alvo: '20' })
    expect(gbp.linhaRisco).toBe('risco 10 pips · alvo 20 pips · 1 : 2')
    expect(gbp.risco).toBeNull()
    const busca = m(eur({ busca: 'xauusd' }))
    expect(busca.ativo?.busca).toMatchObject({ resultados: [], usar: 'XAUUSD', status: 'Nenhum ativo do catálogo com esse código.' })
    const xr = { ...escolherAtivo(eur({ busca: 'xauusd' }), 'forex', 'XAUUSD'), lado: 'short' as const, qtdOutro: true, qtd: '0,20', preco: '4.409,80', stop: '4.413,30' }
    expect(xr.busca).toBe('')
    const x = m(xr)
    expect(x.rotulos?.stopAlvo).toBe('Stop e alvo, em preço')
    expect(x.linhaRisco).toBe('Sem valor em dólar para este ativo.')
    expect(m({ ...xr, alvo: '4.400,30' }).linhaRisco).toBe('1 : 2,71 · sem valor em dólar para este ativo')
    expect(m({ ...xr, alvo: '4.400,30' }).payload).toMatchObject({ symbol: 'XAUUSD', stop_price: '4413.3', target_price: '4400.3' })
    expect(m({ ...xr, stop: '4.400' }).visiveis.stop).toBe('Numa venda, o stop fica acima do preço de entrada.')
    expect(m({ ...xr, alvo: '4.420' }).visiveis.alvo).toBe('Numa venda, o alvo fica abaixo do preço de entrada.')
    expect(m({ ...xr, preco: '', stop: '4.413,30' }).linhaRisco).toBe('Sem preço de entrada, o risco não é calculado.')
    expect(x.ativo?.chips.map((c) => c.rotulo)).toEqual(['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD', 'XAUUSD'])
  })

  describe('«Já fechada» (09:01 ET): the result block', () => {
    const n = at('2026-10-15T13:01:05Z')
    const fechada = (patch: Partial<Rascunho> = {}) => eur({ modo: 'fechada', dia: hoje, hora: '08:40', precoSaida: '1.08635', horaSaida: '09:01', ...patch })

    it('EUR/USD computed, «Corrigir» offered, «Custos» optional', () => {
      const e = m(fechada(), false, n)
      expect(e.linhaResultado).toBe('Resultado: +11,5 pips · +US$ 57,50')
      expect(e.resultado).toEqual({
        linha: 'Resultado: +11,5 pips · +US$ 57,50',
        corrigir: { rotulo: 'Corrigir', aberto: false },
        calculado: '57,50',
        notaEstimativa: null,
        campo: null,
        custos: { rotulo: 'Custos, US$', nota: 'Comissão por lote da sua conta, ida e volta.', valor: '', erro: null },
      })
      expect(e.payloadFechada).toEqual({
        v: 1, client_key: KEY, symbol: 'EUR/USD', direction: 'long', quantity: '0.5', entry_price: '1.0852', stop_pips: '12', target_pips: '24',
        clock: NY, day: hoje, entry: '08:40', exit: '09:01', exit_price: '1.08635',
      })
      expect(saidaMercados('eurusd').exit?.pnl).toBe('57.5')
    })

    it('«Corrigir» opens with the computed value, sends it as the result; «Usar o calculado» discards it', () => {
      const aberto = alternarCorrigir(fechada(), m(fechada(), false, n).resultado!.calculado)
      expect(aberto).toMatchObject({ corrigir: true, res: '57,50' })
      const e = m({ ...aberto, res: '−55,10', custos: '3,50' }, false, n)
      expect(e.resultado).toMatchObject({
        corrigir: { rotulo: 'Usar o calculado', aberto: true },
        campo: { rotulo: 'Resultado na sua plataforma, US$', nota: 'Antes da comissão, com swap ou funding, se houver.', valor: '−55,10', erro: null },
      })
      expect(e.payloadFechada).toMatchObject({ pnl: '-55.1', costs: '3.5' })
      expect(alternarCorrigir(aberto, null)).toMatchObject({ corrigir: false, res: '' })
      expect(m({ ...aberto, res: '' }, true, n)).toMatchObject({ primeiro: 'res', visiveis: { res: 'Informe o resultado.' } })
      expect(m({ ...aberto, res: '12,345' }, true, n).visiveis.res).toBe('Use até 2 casas decimais.')
      expect(m({ ...aberto, res: 'doze' }, true, n).visiveis.res).toBe('Use só números, como −57,50.')
    })

    it('costs errors show before a tap', () => {
      expect(m(fechada({ custos: '7,001' }), false, n).visiveis).toEqual({ custos: 'Use até 2 casas decimais.' })
      expect(m(fechada({ custos: '-7' }), false, n).visiveis.custos).toBe('Use só números, como 7,00.')
      expect(m(fechada({ custos: '7' }), false, n).payloadFechada?.costs).toBe('7')
    })

    it('USD/JPY: «≈» and the estimate note; EUR/GBP: the typed result is required', () => {
      const jpy = { ...escolherAtivo(fechada(), 'forex', 'USD/JPY'), lado: 'short' as const, qtdOutro: true, qtd: '0,30', preco: '151.240', precoSaida: '150.980', hora: '08:40', horaSaida: '09:01' }
      const e = m(jpy, false, n)
      expect(e.linhaResultado).toBe('Resultado: +26,0 pips · ≈ +US$ 51,66')
      expect(e.resultado?.notaEstimativa).toBe(
        'Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.',
      )
      expect(e.resultado?.calculado).toBe(saidaMercados('usdjpy').exit?.pnl.replace('.', ','))
      expect(m(alternarCorrigir(jpy, '51,66'), false, n).resultado?.notaEstimativa).toBeNull()
      const gbp = { ...escolherAtivo(fechada(), 'forex', 'EUR/GBP'), lado: 'short' as const, preco: '0.87120', precoSaida: '0.87030', hora: '08:40', horaSaida: '09:01' }
      const g = m(gbp, true, n)
      expect(g.linhaResultado).toBe('Resultado: +9,0 pips · digite o valor em dólar')
      expect(g.resultado).toMatchObject({
        corrigir: null,
        campo: {
          rotulo: 'Resultado, US$',
          nota: 'Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão, com swap ou funding, se houver.',
          erro: 'Informe o resultado.',
        },
      })
      expect(g.primeiro).toBe('res')
      expect(g.payloadFechada).toBeNull()
      expect(m({ ...gbp, res: '58,60' }, true, n).payloadFechada).toMatchObject({ pnl: '58.6' })
    })

    it('before «desde»: the column import text', () => {
      expect(m(fechada({ dia: '2026-10-12' }), false, n).visiveis.dia).toBe(
        'Antes de 13 out esta conta não tinha regras: essas operações entram pela importação por colunas, logo depois da Fase 3.',
      )
    })
  })

  describe('steps 2 and 3', () => {
    const n = at('2026-10-15T13:01:05Z')
    it('the exit preview and its payload (computed; corrected with costs)', () => {
      const t = entradaMercados('eurusd').state.trade
      const s = modeloSaida(ftmo, t, { preco: '1,08635', hora: null }, n, false)
      expect(s.previa).toBe('Se sair a 1,08635: +11,5 pips · +US$ 57,50')
      expect(s.payload).toEqual({ v: 1, exit_price: '1.08635', clock: NY })
      expect(s.rotulos).toEqual({ precoSaida: 'Preço de saída', horaSaida: 'Hora da saída (ET)' })
      expect(s.bloco?.corrigir).toEqual({ rotulo: 'Corrigir', aberto: false })
      const j = entradaMercados('usdjpy-corrigida').state.trade
      const c = modeloSaida(ftmo, j, { preco: '150,980', hora: null, corrigir: true, resultado: '50,10', custos: '2,10' }, n, false)
      expect(c.payload).toEqual({ v: 1, exit_price: '150.98', clock: NY, pnl: '50.1', costs: '2.1' })
      expect(saidaMercados('usdjpy-corrigida').exit).toMatchObject({ pnl: '50.1', pnlBasis: 'typed', commission: '2.1' })
      const g = entradaMercados('eurgbp').state.trade
      const gs = modeloSaida(ftmo, g, { preco: '0,87030', hora: null }, n, true)
      expect(gs.erros.res).toBe('Informe o resultado.')
      expect(gs.payload).toBeNull()
      expect(refusalsMercados()['eurgbp-sem-pnl']).toEqual({ code: 'pnl_required', field: 'pnl' })
    })

    it('the summary, the chooser, the card', () => {
      const g = entradaMercados('eurgbp').state.trade
      expect(resumoAberta(ftmo, g, n)).toEqual({ op: 'EUR/GBP · Venda · 0,50 lote', entrada: '0,87120 às 08:40 ET', stop: 'stop 10 · alvo 20 pips', status: 'Entrada registrada às 08:40 ET.' })
      expect(linhaEscolha(ftmo, g, n)).toBe('EUR/GBP · Venda · 0,50 lote · desde 08:40 ET')
      expect(resumoAberta(ftmo, entradaMercados('usdjpy').state.trade, n).stop).toBe('stop 20 · alvo 40 pips · risco ≈ US$ 39,62')
      expect(resumoAberta(ftmo, entradaMercados('eurusd').state.trade, n).stop).toBe('stop 12 · alvo 24 pips · risco US$ 60,00')
      expect(cartaoFechada(ftmo, saidaMercados('eurusd').state.trade, n)).toEqual({
        valor: '+US$ 57,50',
        tom: 'mint',
        linha: 'EUR/USD · Compra · 0,50 lote · 1,08520 → 1,08635 · +11,5 pips · 08:40–09:01 ET',
        r: { valor: '+0,96 R', sub: 'com stop de 12 pips' },
      })
      expect(cartaoFechada(ftmo, saidaMercados('usdjpy').state.trade, n)).toMatchObject({ base: 'Valor estimado pela cotação de saída; confira com a sua corretora.' })
      expect(cartaoFechada(ftmo, saidaMercados('usdjpy-corrigida').state.trade, n)).toMatchObject({
        valor: '+US$ 50,10',
        base: 'Resultado digitado por você.',
        custos: 'Custos US$ 2,10 · líquido +US$ 48,00',
      })
      expect(cartaoFechada(ftmo, fechadaMercados('xauusd').state.trade, n)).toEqual({
        valor: '+US$ 105,00',
        tom: 'mint',
        linha: 'XAUUSD · Venda · 0,20 lote · 4.409,80 → 4.404,55 · +5,25 no preço · 08:45–08:58 ET',
        r: { valor: '+1,50 R', sub: 'com stop em 4.413,30' },
        base: 'Resultado digitado por você.',
        custos: 'Custos US$ 7,00 · líquido +US$ 98,00',
      })
    })
  })
})

describe('scenario 7 · Ações e opções (IBKR, no window, Thu 15 Oct 09:52 ET)', () => {
  const now = at('2026-10-15T13:52:05Z')
  const hoje = '2026-10-15'
  const m = (r: Rascunho, tentou = false, n = now) => modeloEntrada({ conta: ibkr, r, now: n, hoje, tentou })
  const aapl = () => ({ ...escolherAtivo(rascunho(ibkr), 'stocks', 'AAPL'), lado: 'long' as const, qtd: '100', preco: '231.40', stop: '230.90', alvo: '232.40' })
  const call = (patch: Partial<Rascunho> = {}): Rascunho => ({
    ...escolherAtivo(mudarTipoEua(rascunho(ibkr), 'opcao'), 'stocks', 'SPY'),
    opTipo: 'call',
    strike: '790',
    vencimento: hoje,
    lado: 'long',
    qtd: '2',
    preco: '1.85',
    stop: '1.10',
    alvo: '3.20',
    ...patch,
  })

  it('«Ação ou ETF»: AAPL computed; a stop above a long is refused as the server would', () => {
    const e = m(aapl())
    expect(e.tipoEua?.opcoes).toEqual([{ rotulo: 'Ação ou ETF', valor: 'acao' }, { rotulo: 'Opção', valor: 'opcao' }])
    expect(e.linhaRisco).toBe('risco US$ 50,00 · alvo US$ 100,00 · 1 : 2')
    expect(num(e.risco)).toBe(num(previaMercados('aapl').preview.risk))
    expect(e.quantidade).toMatchObject({ rotulo: 'Ações', chips: null, outro: true, valor: '100' })
    expect(e.payload).toMatchObject({ symbol: 'AAPL', quantity: '100', entry_price: '231.4', stop_price: '230.9', target_price: '232.4' })
    expect(e.ativo).toMatchObject({ rotulo: 'Ativo', busca: { rotulo: 'Buscar ativo', placeholder: 'Ex.: MSFT' } })
    const acima = m({ ...aapl(), stop: '232' })
    expect(acima.visiveis.stop).toBe('Numa compra, o stop fica abaixo do preço de entrada.')
    expect(refusalsMercados()['aapl-stop-acima']).toEqual({ code: 'bad_stop', field: 'stop' })
    expect(textoDaRecusa('bad_stop', 'stop', { forma: acima.forma, lado: 'long' })).toBe('Numa compra, o stop fica abaixo do preço de entrada.')
    expect(m({ ...aapl(), qtd: '10,1234567' }, true).erros.q).toBe('Use até 6 casas decimais.')
    expect(m({ ...aapl(), preco: '231,40001' }, true).erros.preco).toBe('Use até 4 casas decimais.')
  })

  it('«Opção»: the option block, the contracts line, the payload without a multiplier', () => {
    const e = m(call())
    expect(e.ativo).toMatchObject({ rotulo: 'Ativo-objeto', busca: { placeholder: 'Ex.: SPX' } })
    expect(e.opcao).toEqual({
      tipo: 'call',
      strike: '790',
      vencimento: hoje,
      chips: [{ rotulo: 'Hoje', valor: '2026-10-15' }, { rotulo: 'Sexta, 16 out', valor: '2026-10-16' }],
      min: hoje,
      erros: {},
    })
    expect(e.linhaRisco).toBe('2 contratos × 100 = 200 opções · risco US$ 150,00 · alvo US$ 270,00 · 1 : 1,8')
    expect(num(e.risco)).toBe(num(previaMercados('spy-call').preview.risk))
    expect(e.rotulos).toMatchObject({ preco: 'Prêmio de entrada, US$ por ação', stopAlvo: 'Stop e alvo do prêmio' })
    expect(e.payloadPrevia).toEqual({
      v: 1, client_key: KEY, symbol: 'SPY', direction: 'long', quantity: '2', entry_price: '1.85', stop_price: '1.1', target_price: '3.2',
      option: { right: 'call', strike: '790', expires_on: hoje }, clock: NY, entry: '09:52',
    })
    expect(m(call({ qtd: '1', stop: '', alvo: '' })).linhaRisco).toBe('1 contrato × 100 = 100 opções')
    expect(m(call({ stop: '' , alvo: ''})).linhaRisco).toBe('2 contratos × 100 = 200 opções')
  })

  it('the option block’s errors, in the board’s order and focus', () => {
    const e = m(call({ opTipo: null, strike: 'abc', vencimento: null }), true)
    expect(e.primeiro).toBe('opTipo')
    expect(e.opcao?.erros).toEqual({ opTipo: 'Escolha Call ou Put.', strike: 'Use só números, como 790.', venc: 'Escolha o vencimento.' })
    expect(m(call({ strike: '' }), true).erros.strike).toBe('Informe o strike.')
    expect(m(call({ strike: '0' }), true).erros.strike).toBe('Use um strike maior que zero.')
    expect(m(call({ strike: '790,1234' }), true).erros.strike).toBe('Use até 3 casas decimais.')
    expect(m(call({ strike: '200.5' })).payload?.option?.strike).toBe('200.5')
    expect(m(call({ vencimento: '2026-10-14' }), true).erros.venc).toBe('O vencimento não pode ser antes do dia da entrada.')
    expect(m(call({ vencimento: '2026-10-14' })).payload).toBeNull()
    expect(refusalsMercados()['spy-vencida']).toEqual({ code: 'bad_option', field: 'option.expires_on' })
    expect(textoDaRecusa('bad_option', 'option.expires_on', { forma: null, lado: null })).toBe('O vencimento não pode ser antes do dia da entrada.')
    expect(m(call({ opTipo: null }), false).opcao?.erros).toEqual({})
  })

  it('«Já fechada» 09:35–09:48: +US$ 110,00; «Venceu sem valor» waits for 16:00 ET', () => {
    const r = call({ modo: 'fechada', dia: hoje, hora: '09:35', precoSaida: '2.40', horaSaida: '09:48' })
    const e = m(r)
    expect(e.linhaResultado).toBe('Resultado: +0,55 no prêmio · +US$ 110,00')
    expect(e.vsv).toEqual({ ligado: false, disponivel: false, nota: 'Vence hoje às 16:00 ET.', hora: '16:00' })
    expect(e.payloadFechada).toMatchObject({ exit: '09:48', exit_price: '2.4', option: { right: 'call', strike: '790', expires_on: hoje } })
    expect(fechadaPreviaMercados('spy-call').exit.pnl).toBe('110')
    expect(m({ ...r, precoSaida: '' }).linhaResultado).toBe('Resultado: preencha os dois prêmios.')
    expect(m({ ...r, vencimento: '2026-10-16' }).vsv?.nota).toBe('Vence em 16 out, às 16:00 ET.')
    expect(m({ ...r, vencimento: null }).vsv?.nota).toBe('Escolha o vencimento primeiro.')
    expect(m({ ...r, dia: '2026-10-14', hora: '09:35' }).opcao?.chips).toEqual([
      { rotulo: '14 out', valor: '2026-10-14' },
      { rotulo: 'Sexta, 16 out', valor: '2026-10-16' },
    ])
  })

  it('«Ontem», expiry 14 out: «Venceu sem valor» fills premium 0 at 16:00 ET (−US$ 370,00)', () => {
    const r = call({ modo: 'fechada', dia: '2026-10-14', vencimento: '2026-10-14', hora: '09:35', precoSaida: '', horaSaida: null })
    expect(m(r).vsv).toEqual({ ligado: false, disponivel: true, nota: '', hora: '16:00' })
    const v = alternarVsv(r)
    const e = m(v)
    expect(e.vsv?.ligado).toBe(true)
    expect([e.precoSaidaCampo, e.horaSaidaCampo]).toEqual(['0', '16:00'])
    expect(e.linhaResultado).toBe('Resultado: −1,85 no prêmio · −US$ 370,00')
    expect(e.payloadFechada).toMatchObject({ day: '2026-10-14', entry: '09:35', exit: '16:00', exit_price: '0' })
    expect(fechadaPreviaMercados('spy-vsv-ontem').exit).toMatchObject({ pnl: '-370', exitPrice: '0' })
    expect(mudarVencimento(v, '2026-10-16')).toMatchObject({ vsv: false, precoSaida: '', horaSaida: null, vencimento: '2026-10-16' })
  })

  it('16:00 ET on a Brasília clock is 17:00 in October and 18:00 in November', () => {
    expect(estadoVsv({ clock: SP }, '2026-10-14', '2026-10-14', '2026-10-15', true, now).hora).toBe('17:00')
    expect(estadoVsv({ clock: SP }, '2026-11-06', '2026-11-06', '2026-11-09', true, at('2026-11-09T12:00:00Z')).hora).toBe('18:00')
    expect(estadoVsv({ clock: NY }, '2026-10-15', '2026-10-15', '2026-10-15', true, at('2026-10-15T19:59:59Z')).disponivel).toBe(false)
    expect(estadoVsv({ clock: NY }, '2026-10-15', '2026-10-15', '2026-10-15', true, at('2026-10-15T20:00:00Z')).disponivel).toBe(true)
  })

  it('step 2 of the open call: «Venceu sem valor» after 16:00 ET; the summary and the card', () => {
    const t = entradaMercados('spy-call-aberta').state.trade
    const antes = modeloSaida(ibkr, t, { preco: '', hora: null, vsv: true }, now, false)
    expect(antes.vsv).toMatchObject({ disponivel: false, ligado: false, nota: 'Vence hoje às 16:00 ET.' })
    expect(antes.previa).toBe('Resultado: informe o prêmio de saída.')
    const n = at('2026-10-15T20:05:05Z')
    const s = modeloSaida(ibkr, t, { preco: '', hora: null, vsv: true }, n, false)
    expect([s.precoCampo, s.horaCampo]).toEqual(['0', '16:00'])
    expect(s.previa).toBe('Se sair a 0,00: −1,85 no prêmio · −US$ 370,00')
    expect(s.payload).toEqual({ v: 1, exit_price: '0', exit: '16:00', clock: NY })
    expect(s.rotulos).toEqual({ precoSaida: 'Prêmio de saída, US$ por ação', horaSaida: 'Hora da saída (ET)' })
    expect(saidaMercados('spy-vsv').exit?.pnl).toBe('-370')
    expect(resumoAberta(ibkr, t, now)).toEqual({
      op: 'SPY Call 790 · vence 15 out · Compra · 2 ct',
      entrada: 'prêmio 1,85 às 09:52 ET',
      stop: 'stop do prêmio 1,10 · alvo 3,20 · risco US$ 150,00',
      status: 'Entrada registrada às 09:52 ET.',
    })
    expect(cartaoFechada(ibkr, saidaMercados('spy-vsv').state.trade, n)).toEqual({
      valor: '−US$ 370,00',
      tom: 'red',
      linha: 'SPY Call 790 · vence 15 out · Compra · 2 ct · 1,85 → 0,00 · −1,85 no prêmio · 09:52–16:00 ET',
      r: { valor: '−2,47 R', sub: 'com stop do prêmio em 1,10' },
    })
    expect(ativoCurto(t, 'stocks')).toBe('SPY Call 790')
    expect(opTexto(saidaMercados('aapl').state.trade, 'stocks')).toBe('AAPL · Compra · 100 ações')
    expect(cartaoFechada(ibkr, saidaMercados('aapl').state.trade, n).linha).toBe('AAPL · Compra · 100 ações · 231,40 → 232,15 · +0,75 por ação · 09:52–10:00 ET')
  })

  it('step 2 the next day: «Venceu sem valor» only while 16:00 still names the expiry’s close (until 04:00:00 ET)', () => {
    // register_exit reads the hour against now (trade_hm_resolve): today's, or yesterday's while
    // today's is more than 12 hours ahead. On Fri 10:00 «16:00» is Friday's (ahead: exit_in_future);
    // on Fri 17:00 or Mon it is that day's, a day or more after the expiry.
    const t = entradaMercados('spy-call-aberta').state.trade
    const fim = '2026-10-15T20:00:00.000Z'
    const tarde = 'Venceu em 15 out, às 16:00 ET: essa saída só pode ser registrada até as 04:00 ET do dia seguinte.'
    const saida = (iso: string, clock = ibkr) => modeloSaida(clock, t, { preco: '', hora: null, vsv: true }, at(iso), false)
    // In the close's own minute the exit is now (no hour sent), as on the server
    expect(saida('2026-10-15T20:00:30Z').vsv).toMatchObject({ ligado: true, disponivel: true })
    expect(saida('2026-10-15T20:00:30Z').payload).toEqual({ v: 1, exit_price: '0', clock: NY })
    for (const iso of ['2026-10-15T20:05:05Z', '2026-10-16T03:59:05Z', '2026-10-16T04:30:05Z', '2026-10-16T08:00:00Z']) {
      const s = saida(iso)
      expect([iso, s.vsv]).toEqual([iso, { ligado: true, disponivel: true, nota: '', hora: '16:00' }])
      expect(s.payload).toEqual({ v: 1, exit_price: '0', exit: '16:00', clock: NY })
      expect(s.erros).toEqual({})
      // What the server makes of the hour, by its own rule
      expect(resolveLocalHm('16:00', NY, at(iso)).toISOString()).toBe(fim)
    }
    for (const iso of ['2026-10-16T08:00:01Z', '2026-10-16T08:00:59Z', '2026-10-16T14:00:05Z', '2026-10-16T21:00:05Z', '2026-10-19T14:00:05Z', '2026-10-19T21:00:05Z']) {
      const s = saida(iso)
      expect([iso, s.vsv]).toEqual([iso, { ligado: false, disponivel: false, nota: tarde, hora: '16:00' }])
      expect([s.precoCampo, s.payload]).toEqual(['', null])
      expect(resolveLocalHm('16:00', NY, at(iso)).toISOString()).not.toBe(fim)
    }
    // A Brasília clock: 17:00 (October), the same instants
    const sp: ContaReg = { ...ibkr, clock: SP }
    expect(saida('2026-10-16T08:00:00Z', sp).vsv).toEqual({ ligado: true, disponivel: true, nota: '', hora: '17:00' })
    expect(saida('2026-10-16T08:00:00Z', sp).payload).toEqual({ v: 1, exit_price: '0', exit: '17:00', clock: SP })
    expect(saida('2026-10-16T08:00:01Z', sp).vsv).toMatchObject({ disponivel: false, nota: tarde })
    // «Já fechada» sends the «Dia» with the hour: still available days later
    expect(estadoVsv(ibkr, '2026-10-15', '2026-10-15', '2026-10-19', true, at('2026-10-19T21:00:05Z'))).toEqual({ ligado: true, disponivel: true, nota: '', hora: '16:00' })
  })

  it('an `options` account: «Opção» fixed, no «O que você operou?»', () => {
    const opcoes = contaReg({ id: 'o', label: 'Opções', market: 'options', platform: null }, null, null)
    const r = { ...rascunhoInicial(opcoes, null, KEY), opTipo: 'put' as const, strike: '5800', vencimento: hoje, lado: 'long' as const, preco: '12.40', stop: '9' }
    const e = modeloEntrada({ conta: opcoes, r, now, hoje, tentou: false })
    expect(e.tipoEua).toBeNull()
    expect(e.forma?.tipo).toBe('opcao')
    expect(e.payload).toMatchObject({ symbol: 'SPY', option: { right: 'put', strike: '5800', expires_on: hoje }, stop_price: '9' })
  })
})

describe('scenario 8 · Cripto (Binance, Sat 17 Oct 20:35 de Brasília)', () => {
  const now = at('2026-10-17T23:35:05Z')
  const hoje = '2026-10-17'
  const m = (r: Rascunho, tentou = false, n = now) => modeloEntrada({ conta: binance, r, now: n, hoje, tentou })
  const btc = (patch: Partial<Rascunho> = {}) => rascunho(binance, { lado: 'short', qtd: '0,25', preco: '112.400', stop: '112.800', alvo: '111.600', ...patch })

  it('BTC/USDT: «Cotada em», the coin’s quantity, the position, the payload', () => {
    const e = m(btc())
    expect(e.cotacao).toEqual({ valor: 'USDT', opcoes: ['USDT', 'USDC', 'USD', 'R$'], nota: 'USDT e USDC contam como dólar.' })
    expect(e.ativo).toMatchObject({ rotulo: 'Moeda', busca: { rotulo: 'Buscar moeda', placeholder: 'Ex.: AVAX' } })
    expect(e.quantidade).toMatchObject({ rotulo: 'Quantidade, em BTC', chips: null })
    expect(e.rotulos).toMatchObject({ preco: 'Preço de entrada, USDT', precoSaida: 'Preço de saída, USDT', hora: 'Hora (Brasília)', stopAlvo: 'Stop e alvo, em preço' })
    expect(e.linhaRisco).toBe('risco US$ 100,00 · alvo US$ 200,00 · 1 : 2')
    expect(num(e.risco)).toBe(num(previaMercados('btc').preview.risk))
    expect(e.linhaPosicao).toBe('Posição de US$ 28.100')
    expect(e.payload).toMatchObject({ symbol: 'BTC/USDT', direction: 'short', quantity: '0.25', entry_price: '112400', stop_price: '112800', target_price: '111600', clock: SP })
    expect(m(btc({ qtd: '0,123456789' }), true).erros.q).toBe('Use até 8 casas decimais.')
  })

  it('«R$»: BTC/BRL, a typed result in dollars, the position in reais; the quote change clears the prices', () => {
    const r = mudarCotacao(btc(), 'R$')
    expect(r).toMatchObject({ cotacao: 'R$', preco: '', stop: '', alvo: '', qtd: '0,25' })
    const e = m({ ...r, preco: '612.000', stop: '614.000', alvo: '608.000' })
    expect(e.payload?.symbol).toBe('BTC/BRL')
    expect(e.linhaRisco).toBe('1 : 2 · sem valor em dólar para este ativo')
    expect(e.linhaPosicao).toBe('Posição de R$ 153.000')
    expect(e.rotulos?.preco).toBe('Preço de entrada, R$')
    const f = m({ ...r, preco: '612.000', modo: 'fechada', dia: hoje, hora: '20:30', precoSaida: '611.000', horaSaida: '20:34' })
    expect(f.resultado?.campo?.rotulo).toBe('Resultado, US$')
    expect(f.linhaResultado).toBe('Resultado: +1.000 por BTC · digite o valor em dólar')
  })

  it('«Usar “AVAX/BRL”» splits the coin and the quote', () => {
    const e = m(btc({ busca: 'avax/brl' }))
    expect(e.ativo?.busca.usar).toBe('AVAX/BRL')
    expect(escolherAtivo(btc({ busca: 'avax/brl' }), 'crypto', 'AVAX/BRL')).toMatchObject({ ativo: 'AVAX', cotacao: 'R$', busca: '', preco: '' })
  })

  it('step 2 with costs, and the card', () => {
    const n = at('2026-10-18T00:02:05Z')
    const t = entradaMercados('btc').state.trade
    const s = modeloSaida(binance, t, { preco: '111.950', hora: null, custos: '11,24' }, n, false)
    expect(s.previa).toBe('Se sair a 111.950: +450 por BTC · +US$ 112,50')
    expect(s.payload).toEqual({ v: 1, exit_price: '111950', clock: SP, costs: '11.24' })
    expect(s.bloco?.custos).toMatchObject({ rotulo: 'Custos, US$', nota: 'Taxas da corretora, em dólar.' })
    expect(resumoAberta(binance, t, now)).toMatchObject({ op: 'BTC/USDT · Venda · 0,25 BTC', entrada: '112.400 às 20:35 de Brasília', stop: 'stop 112.800 · alvo 111.600 · risco US$ 100,00' })
    expect(cartaoFechada(binance, saidaMercados('btc').state.trade, n)).toEqual({
      valor: '+US$ 112,50',
      tom: 'mint',
      linha: 'BTC/USDT · Venda · 0,25 BTC · 112.400 → 111.950 · +450 por BTC · 20:35–21:02 de Brasília',
      r: { valor: '+1,13 R', sub: 'com stop em 112.800' },
      custos: 'Custos US$ 11,24 · líquido +US$ 101,26',
    })
  })
})

describe('scenario 9 · B3 (Clear, Thu 15 Oct 10:20 de Brasília)', () => {
  const now = at('2026-10-15T13:20:05Z')
  const hoje = '2026-10-15'
  const m = (r: Rascunho, tentou = false) => modeloEntrada({ conta: clear, r, now, hoje, tentou })
  const win = (patch: Partial<Rascunho> = {}) => rascunho(clear, { lado: 'short', qtd: '3', preco: '131.250', stop: '100', alvo: '200', ...patch })

  it('WIN: contracts 1 2 3 5 10, points in 5, reais', () => {
    const e = m(win())
    expect(e.quantidade?.chips?.map((c) => c.rotulo)).toEqual(['1', '2', '3', '5', '10'])
    expect(e.linhaRisco).toBe('risco R$ 60,00 · alvo R$ 120,00 · 1 : 2')
    expect(num(e.risco)).toBe(num(previaMercados('win').preview.risk))
    expect(m(win({ preco: '131.252' }), true).erros.preco).toBe('O WIN anda de 5 em 5; confira o preço.')
    expect(m(win({ stop: '102' })).visiveis.stop).toBe('Use pontos de 5 em 5 no WIN.')
    expect(m(win({ qtdOutro: true, qtd: '2,5' }), true).erros.q).toBe('Use um número inteiro de contratos.')
    expect(e.ativo?.chips.map((c) => c.rotulo)).toEqual(['WIN', 'WDO', 'IND', 'DOL'])
  })

  it('10:06 with a 600-point stop: «faltam R$ 320 e o stop arrisca R$ 360»', () => {
    const e = m(win({ hora: '10:06', stop: '600' }))
    expect(num(e.risco)).toBe(360)
    expect(avisoLimiteEntrada(clear, e, null, previaMercados('win-1006').limitRoom)).toBe(
      'Se o stop for atingido, o dia passa do limite: faltam R$ 320 e o stop arrisca R$ 360.',
    )
    // At 10:20 the limit is reached: «Encerrado por hoje» says it, no warning
    expect(avisoLimiteEntrada(clear, m(win({ stop: '600' })), clearAgora.gate, previaMercados('win').limitRoom)).toBeNull()
  })

  it('«Usar “WINZ26”» behaves as WIN, stored as typed', () => {
    const r = { ...escolherAtivo(win({ busca: 'winz26' }), 'b3', 'WINZ26'), preco: '131.250', stop: '100', alvo: '200' }
    expect(r.qtd).toBe('3')
    const e = m(r)
    expect(e.forma).toMatchObject({ tipo: 'b3f', raiz: 'WIN', simbolo: 'WINZ26' })
    expect(e.payload).toMatchObject({ symbol: 'WINZ26', stop_pts: '100', target_pts: '200' })
    expect(e.linhaRisco).toBe('risco R$ 60,00 · alvo R$ 120,00 · 1 : 2')
    expect(m({ ...r, preco: '131.252' }, true).erros.preco).toBe('O WIN anda de 5 em 5; confira o preço.')
  })

  it('PETR4: shares (whole), up to 4 decimals, the lot note; PETR4F without it', () => {
    const r = { ...escolherAtivo(win(), 'b3', 'PETR4'), lado: 'long' as const, preco: '38,42', stop: '38,20', alvo: '38,90' }
    expect(r).toMatchObject({ qtd: '', qtdOutro: true })
    expect(m({ ...r, qtd: '300' }).linhaRisco).toBe('risco R$ 66,00 · alvo R$ 144,00 · 1 : 2,18')
    expect(num(m({ ...r, qtd: '300' }).risco)).toBe(num(previaMercados('petr4').preview.risk))
    expect(m({ ...r, qtd: '150' }).quantidade?.nota).toBe('Fora do lote de 100, a B3 negocia no fracionário (código com F).')
    expect(m({ ...r, qtd: '150' }).erros.q).toBeUndefined()
    expect(m({ ...r, qtd: '300' }).quantidade?.nota).toBeNull()
    expect(m({ ...escolherAtivo(r, 'b3', 'PETR4F'), qtd: '150' }).quantidade?.nota).toBeNull()
    expect(m({ ...r, qtd: '150,5' }, true).erros.q).toBe('Use um número inteiro de ações.')
    expect(m({ ...r, qtd: '300', preco: '38,4250', alvo: '' }).payload).toMatchObject({ entry_price: '38.425', stop_price: '38.2' })
    expect(num(m({ ...r, qtd: '300', preco: '38,4250', alvo: '' }).risco)).toBe(num(previaMercados('petr4-4dp').preview.risk))
    expect(m({ ...r, qtd: '300', preco: '38,42501' }, true).erros.preco).toBe('Use até 4 casas decimais.')
    expect(refusalsMercados()['petr4-5dp']).toEqual({ code: 'bad_price', field: 'entry_price' })
  })

  it('DI1 and a code outside the catalog: the typed result in reais', () => {
    const di = { ...escolherAtivo(win(), 'b3', 'DI1F27'), lado: 'long' as const, qtd: '5', preco: '14,250', stop: '14,200' }
    expect(m(di).linhaRisco).toBe('Sem valor em reais para este ativo.')
    const f = m({ ...di, modo: 'fechada', dia: hoje, hora: '10:10', precoSaida: '14,300', horaSaida: '10:15' }, true)
    expect(f.resultado).toMatchObject({
      corrigir: null,
      campo: { rotulo: 'Resultado, R$', nota: 'Pelos preços não dá para saber o valor em reais: digite o resultado da sua plataforma, antes da comissão.', erro: 'Informe o resultado.' },
      custos: { rotulo: 'Custos, R$', nota: 'Corretagem, emolumentos e registro. O imposto não entra.' },
    })
    expect(f.linhaResultado).toBe('Resultado: +0,05 no preço · digite o valor em reais')
    const bgi = { ...escolherAtivo(win(), 'b3', 'BGIX26'), lado: 'long' as const, qtd: '2', preco: '310,55' }
    expect(m(bgi).quantidade).toMatchObject({ rotulo: 'Quantidade', chips: null })
    expect(m({ ...bgi, qtd: '2,5' }, true).erros.q).toBe('Use um número inteiro.')
    const fb = m({ ...bgi, modo: 'fechada', dia: hoje, hora: '10:17', precoSaida: '311,30', horaSaida: '10:19' }, true)
    expect(fb.erros.res).toBe('Informe o resultado.')
    expect(refusalsMercados()['bgix26-sem-pnl']).toEqual({ code: 'pnl_required', field: 'pnl' })
    expect(textoDaRecusa('pnl_required', 'pnl', { forma: fb.forma, lado: 'long' })).toBe('Informe o resultado.')
    const ok = m({ ...bgi, modo: 'fechada', dia: hoje, hora: '10:17', precoSaida: '311,30', horaSaida: '10:19', res: '150', custos: '3,50' })
    expect(ok.payloadFechada).toMatchObject({ symbol: 'BGIX26', quantity: '2', entry_price: '310.55', exit_price: '311.3', pnl: '150', costs: '3.5' })
    expect(fechadaPreviaMercados('bgix26').exit).toMatchObject({ pnl: '150', pnlBasis: 'typed', commission: '3.5' })
    expect(m({ ...bgi, preco: '310,123456789' }, true).erros.preco).toBe('Use até 8 casas decimais.')
  })

  it('the bridge’s and step 3’s lines in reais', () => {
    const n = at('2026-10-15T13:31:05Z')
    expect(cartaoFechada(clear, saidaMercados('win').state.trade, n)).toEqual({
      valor: '+R$ 90,00',
      tom: 'mint',
      linha: 'WIN · Venda · 3 ct · 131.250 → 131.100 · +150 pts · 10:20–10:31 de Brasília',
      r: { valor: '+1,50 R', sub: 'com stop de 100 pts' },
      custos: 'Custos R$ 3,50 · líquido +R$ 86,50',
    })
    expect(opTexto(fechadaMercados('bgix26').state.trade, 'b3')).toBe('BGIX26 · Compra · 2 un.')
    expect(opTexto(fechadaMercados('clear-s9c').state.trade, 'b3')).toBe('WDO · Compra · 3 ct')
    expect(cartaoFechada(clear, fechadaMercados('clear-s9c').state.trade, n).linha).toBe('WDO · Compra · 3 ct · 5.441,5 → 5.436,5 · −5 pts · 10:13–10:16 de Brasília')
  })
})

describe('the futures «Buscar ativo» (Top One, Thu 15 Oct 10:05 ET)', () => {
  const now = at('2026-10-15T14:05:05Z')
  const hoje = '2026-10-15'
  const m = (r: Rascunho, tentou = false) => modeloEntrada({ conta: top, r, now, hoje, tentou })
  const base = () => rascunho(top, { lado: 'long', qtd: '1' })

  it('«mcl» finds MCL; CL is computed in points of 0,01', () => {
    expect(m({ ...base(), busca: 'mcl' }).ativo?.busca).toMatchObject({ resultados: ['MCL'], usar: null, status: '1 resultado.' })
    const cl = { ...escolherAtivo(base(), 'futures', 'CL'), preco: '70,45', stop: '0,50', alvo: '1' }
    expect(cl.qtd).toBe('1')
    const e = m(cl)
    expect(e.linhaRisco).toBe('risco US$ 500,00 · alvo US$ 1.000,00 · 1 : 2')
    expect(num(e.risco)).toBe(num(previaMercados('cl').preview.risk))
    expect(m({ ...cl, preco: '70,455' }, true).erros.preco).toBe('O CL anda de 0,01 em 0,01; confira o preço.')
    expect(m({ ...cl, stop: '0,505' }).visiveis.stop).toBe('Use pontos de 0,01 em 0,01 no CL.')
    expect(e.ativo?.chips.map((c) => c.rotulo)).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC', 'CL'])
  })

  it('ZN (outside the table): price stops, no dollar value, the typed result without «Corrigir» or «Custos»', () => {
    const zn = { ...escolherAtivo(base(), 'futures', 'ZNZ6'), preco: '112,5', stop: '112' }
    const e = m(zn)
    expect(e.rotulos?.stopAlvo).toBe('Stop e alvo, em preço')
    expect(e.linhaRisco).toBe('Sem valor em dólar para este ativo.')
    expect(m({ ...zn, alvo: '113,25' }).linhaRisco).toBe('1 : 1,5 · sem valor em dólar para este ativo')
    expect(m({ ...zn, alvo: '113,25' }).payload).toMatchObject({ symbol: 'ZNZ6', stop_price: '112', target_price: '113.25' })
    expect(m({ ...zn, stop: '113' }).visiveis.stop).toBe('Numa compra, o stop fica abaixo do preço de entrada.')
    expect(refusalsMercados()['zn-pontos']).toEqual({ code: 'bad_stop', field: 'stop' })
    const f = m({ ...zn, modo: 'fechada', dia: hoje, hora: '10:00', precoSaida: '112,75', horaSaida: '10:04' }, true)
    expect(f.resultado).toEqual({
      linha: 'Resultado: +0,25 no preço · digite o valor em dólar',
      corrigir: null,
      calculado: null,
      notaEstimativa: null,
      campo: { rotulo: 'Resultado, US$', nota: 'Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão.', valor: '', erro: 'Informe o resultado.' },
      custos: null,
    })
    expect(m({ ...zn, modo: 'fechada', dia: hoje, hora: '10:00', precoSaida: '112,75', horaSaida: '10:04', res: '250' }).payloadFechada).toMatchObject({ pnl: '250' })
    expect(m({ ...zn, modo: 'fechada', dia: hoje, hora: '10:00', precoSaida: '112,75', horaSaida: '10:04', res: '250' }).payloadFechada).not.toHaveProperty('costs')
  })

  it('«Usar “MESZ6”» registers the series code, computed as MES', () => {
    const e = m({ ...escolherAtivo(base(), 'futures', 'MESZ6'), qtd: '2', preco: '6650,25', stop: '10', alvo: '20' })
    expect(e.payload).toMatchObject({ symbol: 'MESZ6', stop_pts: '10', target_pts: '20' })
    expect(num(e.risco)).toBe(num(previaMercados('mesz6').preview.risk))
  })

  it('ZN’s step 2 and card: the typed result', () => {
    const n = at('2026-10-15T14:20:05Z')
    const t = entradaMercados('zn').state.trade
    const s = modeloSaida(top, t, { preco: '112,75', hora: null }, n, true)
    expect(s.erros.res).toBe('Informe o resultado.')
    expect(s.previa).toBe('Se sair a 112,75: +0,25 no preço · digite o valor em dólar')
    expect(modeloSaida(top, t, { preco: '112,75', hora: null, resultado: '250' }, n, false).payload).toEqual({ v: 1, exit_price: '112.75', clock: NY, pnl: '250' })
    expect(resumoAberta(top, t, n).stop).toBe('stop 112,00 · alvo 113,25')
    expect(cartaoFechada(top, saidaMercados('zn').state.trade, n)).toEqual({
      valor: '+US$ 250,00',
      tom: 'mint',
      linha: 'ZNZ6 · Compra · 1 ct · 112,50 → 112,75 · +0,25 no preço · 10:05–10:20 ET',
      r: { valor: '+0,50 R', sub: 'com stop em 112,00' },
      base: 'Resultado digitado por você.',
    })
  })
})

describe('review fixes of 3-4 lane A (the engine’s part)', () => {
  it('another instrument, quote or kind keeps the exit hour typed in «Já fechada» (3-3 and RO `limpar`, l.1081)', () => {
    const fechada = rascunho(top, { modo: 'fechada', lado: 'long', preco: '6650,25', hora: '10:00', precoSaida: '6652,25', horaSaida: '10:04' })
    expect(escolherAtivo(fechada, 'futures', 'MCL')).toMatchObject({ ativo: 'MCL', precoSaida: '', horaSaida: '10:04', hora: '10:00' })
    const btc = rascunho(binance, { modo: 'fechada', precoSaida: '111.950', horaSaida: '21:02' })
    expect(mudarCotacao(btc, 'USDC')).toMatchObject({ cotacao: 'USDC', precoSaida: '', horaSaida: '21:02' })
    const acao = rascunho(ibkr, { modo: 'fechada', precoSaida: '232.15', horaSaida: '10:00' })
    expect(mudarTipoEua(acao, 'opcao')).toMatchObject({ tipoEua: 'opcao', precoSaida: '', horaSaida: '10:00' })
    // «Venceu sem valor» and «Vencimento» still clear the exit they wrote
    expect(mudarVencimento({ ...acao, vsv: true }, '2026-10-16')).toMatchObject({ precoSaida: '', horaSaida: null, vsv: false })
  })

  it('ETH/BTC (a quote none of «Cotada em»): ETH quoted in BTC, no pill pressed, no position line; a pill quotes ETH instead', () => {
    const n = at('2026-10-17T23:35:05Z')
    const hoje = '2026-10-17'
    const r = { ...escolherAtivo(rascunho(binance), 'crypto', 'ETH/BTC'), lado: 'long' as const, qtd: '2', preco: '0,0365', stop: '0,0360' }
    expect(r).toMatchObject({ ativo: 'ETH/BTC', cotacao: 'USDT' })
    const e = modeloEntrada({ conta: binance, r, now: n, hoje, tentou: false })
    expect(e.cotacao?.valor).toBeNull()
    expect(e.quantidade?.rotulo).toBe('Quantidade, em ETH')
    expect(e.rotulos).toMatchObject({ preco: 'Preço de entrada, BTC', precoSaida: 'Preço de saída, BTC' })
    expect(e.linhaPosicao).toBeNull()
    expect(e.linhaRisco).toBe('Sem valor em dólar para este ativo.')
    expect(e.payload).toMatchObject({ symbol: 'ETH/BTC', quantity: '2', entry_price: '0.0365', stop_price: '0.036' })
    const f = modeloEntrada({ conta: binance, r: { ...r, modo: 'fechada', dia: hoje, hora: '20:30', precoSaida: '0,0371', horaSaida: '20:34' }, now: n, hoje, tentou: false })
    expect(f.linhaResultado).toBe('Resultado: +0,0006 por ETH · digite o valor em dólar')
    // «Cotada em» on the pair: the coin keeps its quantity, the pill is its quote
    const usdt = mudarCotacao(r, 'USDT')
    expect(usdt).toMatchObject({ ativo: 'ETH', cotacao: 'USDT', preco: '', qtd: '2' })
    const g = modeloEntrada({ conta: binance, r: { ...usdt, preco: '4.100' }, now: n, hoje, tentou: false })
    expect(g.cotacao?.valor).toBe('USDT')
    expect(g.rotulos?.preco).toBe('Preço de entrada, USDT')
    expect(g.linhaPosicao).toBe('Posição de US$ 8.200')
    // A stored ETH/BTC on step 2 and in the op text: the coin and its quote
    expect(opTexto({ symbol: 'ETH/BTC', direction: 'long', quantity: '2' } as Parameters<typeof opTexto>[0], 'crypto')).toBe('ETH/BTC · Compra · 2 ETH')
  })
})

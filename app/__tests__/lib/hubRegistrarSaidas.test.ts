/**
 * Phase 3c · lane C2 · lib/hub/registrarSaidas (telas contract §6.3–6.4, §8.2): «Já fechada» in
 * several exits and «Movi o stop para o breakeven», pure, on the domain's recorded answers
 * (testing/fixtures/parciais: Fri 23 Oct 2026 ET; testing/fixtures/registrar-mercados for the markets
 * without a 3c recording; invented data) at fixed instants (never the device clock).
 */
import fs from 'fs'
import path from 'path'
import { afterBreakeven, afterPayload, canSplit, lastExitPnl, pnlFromPrices, tradeInstrument, validateAfter } from '@/lib/domain/registro'
import type { Rules } from '@/lib/domain/gate'
import { padroesDoRegistrar } from '@/lib/hub/registrar'
import { alternarVsv, contaReg, diaDe, modeloEntrada, rascunhoInicial, type ContaReg, type Rascunho, type SaidaRascunho } from '@/lib/hub/registrarForm'
import { formaDoAtivo } from '@/lib/hub/registrarAtivos'
import {
  comSaidas,
  lerPrecoQuando,
  mudarSaida,
  ordemComSaidas,
  outraSaida,
  removerSaida,
  saidaDoLimite,
  textoRecusaBreakeven,
  type ModeloSaidas,
} from '@/lib/hub/registrarSaidas'
import { idsParciais } from '@/testing/parciais'
import { agoraParciais, contasParciais, fechadaEs12, fechadaMgc, previaMgc } from '@/testing/saidasTelas'
import { agoraMercados, contasMercados, idsMercados } from '@/testing/registrarMercados'

const KEY = '0f8c2a6e-1b2c-4d3e-8f90-123456789abc'
const ids = idsParciais()
const at = (iso: string) => new Date(iso)
/** formatMoney's no-break space between the symbol and the amount */
const NB = '\u00a0'

// Scenario 15's clock: Fri 23 Oct 10:45 ET
const NOW = at('2026-10-23T14:45:05Z')
const HOJE = '2026-10-23'
const agora = agoraParciais('2026-10-23T14:45:05.000Z')
const contaParciais = (id: string): { conta: ContaReg; rules: Rules } => {
  const a = agora.accounts.find((x) => x.accountId === id)!
  const row = contasParciais().find((c) => c.id === id)!
  return { conta: contaReg(row, a.rules, a.desdeDay), rules: a.rules! }
}
const { conta: top, rules: topRules } = contaParciais(ids.accounts.topOne)

/** A row as typed; `preco` null = never typed (VSV's 0 on the last row), '' = typed and cleared */
const saida = (id: number, qtd: string, preco: string | null, hora: string | null, res = ''): SaidaRascunho => ({ id, qtd, preco, hora, res })

function rascunho(conta: ContaReg, patch: Partial<Rascunho> = {}): Rascunho {
  return { ...rascunhoInicial(conta, padroesDoRegistrar(conta.market, []), KEY), modo: 'fechada', ...patch }
}

function modelo(conta: ContaReg, r: Rascunho, o: { now?: Date; hoje?: string; tentou?: boolean; rules?: Rules | null } = {}): ModeloSaidas {
  const now = o.now ?? NOW
  const hoje = o.hoje ?? HOJE
  const m0 = modeloEntrada({ conta, r, now, hoje, tentou: o.tentou ?? false })
  return comSaidas(m0, r, { conta, now, tentou: o.tentou ?? false, rules: o.rules === undefined ? topRules : o.rules })
}

/** Scenario 15's draft: MGC Venda 2 ct a 4.421,30 às 10:24, stop 15, alvo 30, in two rows */
const mgc = (patch: Partial<Rascunho> = {}): Rascunho =>
  rascunho(top, {
    ativo: 'MGC',
    lado: 'short',
    qtd: '2',
    qtdOutro: false,
    preco: '4.421,30',
    hora: '10:24',
    stop: '15',
    alvo: '30',
    saidas: [saida(1, '1', '4.409,30', '10:31'), saida(2, '1', '4.421,30', '10:38')],
    ...patch,
  })

describe('the rows’ transitions («+ Outra saída», «Remover»)', () => {
  it('the first press makes rows 1 and 2 (row 1 keeps the single exit’s price and hour); later ones add at the end; 20 at most', () => {
    const r = rascunho(top, { precoSaida: '4.409,30', horaSaida: '10:31' })
    const a = outraSaida(r)!
    expect(a.foco).toBe('f-s1q')
    expect(a.r.saidas).toEqual([saida(1, '', '4.409,30', '10:31'), saida(2, '', null, null)])
    // A single exit never typed: row 1's price is not typed either
    expect(outraSaida(rascunho(top))!.r.saidas).toEqual([saida(1, '', null, null), saida(2, '', null, null)])
    const b = outraSaida(a.r)!
    expect(b.foco).toBe('f-s3q')
    expect(b.r.saidas?.map((s) => s.id)).toEqual([1, 2, 3])
    const vinte = { ...r, saidas: Array.from({ length: 20 }, (_, k) => saida(k + 1, '1', '', null)) }
    expect(outraSaida(vinte)).toBeNull()
  })

  it('«Remover»: two rows → one exit with the other row’s price and hour (focus «Preço de saída»); else the next row, or the previous one', () => {
    const r = mgc()
    expect(removerSaida(r, 1)).toEqual({ r: { ...r, saidas: null, precoSaida: '4.421,30', horaSaida: '10:38' }, foco: 'f-spreco' })
    const tres = { ...r, saidas: [...(r.saidas as SaidaRascunho[]), saida(5, '', '', null)] }
    expect(removerSaida(tres, 2)).toMatchObject({ foco: 'f-s5q' })
    expect(removerSaida(tres, 5)).toMatchObject({ foco: 'f-s2q' })
    expect(removerSaida(tres, 5).r.saidas?.map((s) => s.id)).toEqual([1, 2])
    expect(mudarSaida(r, 2, 'qtd', '')).toMatchObject({ saidas: [saida(1, '1', '4.409,30', '10:31'), saida(2, '', '4.421,30', '10:38')] })
  })

  it('«+ Outra saída» shows only when the entry quantity can be split (or rows exist)', () => {
    expect(modelo(top, rascunho(top, { ativo: 'MGC', qtd: '2' })).outra).toEqual({ desabilitada: false })
    expect(modelo(top, rascunho(top, { ativo: 'MGC', qtd: '1' })).outra).toBeNull()
    expect(modelo(top, rascunho(top, { ativo: 'MGC', qtd: '', qtdOutro: true })).outra).toBeNull()
    expect(modelo(top, rascunho(top, { modo: 'aberta', ativo: 'MGC', qtd: '2' })).outra).toBeNull()
    const vinte = mgc({ qtd: '20', qtdOutro: true, saidas: Array.from({ length: 20 }, (_, k) => saida(k + 1, '1', '4.409,30', '10:31')) })
    expect(modelo(top, vinte).outra).toEqual({ desabilitada: true })
    // 0,01 lote cannot be split; 0,02 can (the domain's canSplit)
    expect(canSplit(tradeInstrument('forex', 'EUR/USD', null)!, '0.01')).toBe(false)
    expect(canSplit(tradeInstrument('forex', 'EUR/USD', null)!, '0.02')).toBe(true)
  })
})

describe('scenario 15 · MGC Venda 2 ct in two exits, «Movi o stop para o breakeven» at 4.409,30', () => {
  it('the sum, the result line «… em média», the order with the rows’ fields', () => {
    const m = modelo(top, mgc())
    expect(m.saidas).toMatchObject({ qRotulo: 'Contratos', res: null, soma: 'Saídas: 2 de 2 ct.', somaErro: null })
    expect(m.saidas?.linhas.map((l) => [l.rotulo, l.removerAria, l.qtd, l.preco, l.hora])).toEqual([
      ['1ª saída', 'Remover a 1ª saída', '1', '4.409,30', '10:31'],
      ['2ª saída', 'Remover a 2ª saída', '1', '4.421,30', '10:38'],
    ])
    expect(m.linhaResultado).toBe(`Resultado: +6,00 pts em média · +US$${NB}120,00`)
    expect(m.resultado).toMatchObject({ linha: `Resultado: +6,00 pts em média · +US$${NB}120,00`, corrigir: null, custos: null, campo: null })
    expect(m.ordem).toEqual(['dia', 'opTipo', 'strike', 'venc', 'lado', 'q', 'preco', 'hora', 'spreco', 'shora', 's1q', 's1p', 's1h', 's1r', 's2q', 's2p', 's2h', 's2r', 'soma', 'stop', 'alvo', 'bePreco', 'res', 'custos'])
    expect(ordemComSaidas(null)).not.toContain('s1q')
  })

  it('the payload: afterPayload with the rows by hour and breakeven.price_then; the dry run’s exits and breakeven are the domain’s for it (after-dry-mgc)', () => {
    const m = modelo(top, mgc({ be: true, bePreco: '4.409,30' }))
    const esperado = afterPayload('futures', {
      clientKey: KEY,
      symbol: 'MGC',
      direction: 'short',
      quantity: '2',
      entryPrice: '4421.3',
      stop: '15',
      target: '30',
      clock: 'America/New_York',
      day: HOJE,
      entry: '10:24',
      exits: [
        { quantity: '1', exitPrice: '4409.3', exit: '10:31' },
        { quantity: '1', exitPrice: '4421.3', exit: '10:38' },
      ],
      breakevenPriceThen: '4409.3',
    })
    expect(m.payloadFechada).toEqual(esperado)
    expect(m.payloadFechada?.breakeven).toEqual({ price_then: '4409.3' })
    const previa = previaMgc()
    const v = validateAfter('futures', m.payloadFechada, { now: previa.serverNow, dry: true, dayOf: (i) => diaDe(top, i), inRules: () => true })
    if (!v.ok) throw new Error(v.code)
    expect(v.exits).toEqual(previa.exits)
    expect(v.breakeven).toEqual(previa.breakeven)
    expect(previa.exit).toMatchObject({ pnl: '120', exitPrice: '4415.3', points: '6' })
    // The pill’s status, with the rule of the version the trade will carry (MGC +5)
    expect(m.be).toEqual({ ligado: true, rotulo: 'Preço quando moveu', valor: '4.409,30', status: 'com +12,00 pts a favor · Sua regra: com +5 pts.', erro: null })
  })

  it('rows typed out of order are sent by hour; ties keep the rows’ order', () => {
    const fora = modelo(top, mgc({ saidas: [saida(1, '1', '4.421,30', '10:38'), saida(2, '1', '4.409,30', '10:31')] }))
    expect(fora.payloadFechada?.exits?.map((x) => [x.exit, x.exit_price])).toEqual([
      ['10:31', '4409.3'],
      ['10:38', '4421.3'],
    ])
    const empate = modelo(top, mgc({ saidas: [saida(1, '1', '4.421,30', '10:31'), saida(2, '1', '4.409,30', '10:31')] }))
    expect(empate.payloadFechada?.exits?.map((x) => x.exit_price)).toEqual(['4421.3', '4409.3'])
  })

  it('the error state: the 2nd quantity emptied → «Informe a quantidade.» and «As saídas somam 1 ct; a entrada tem 2 ct.» after a tap', () => {
    const r = mgc({ saidas: [saida(1, '1', '4.409,30', '10:31'), saida(2, '', '4.421,30', '10:38')] })
    const antes = modelo(top, r)
    expect(antes.saidas?.somaErro).toBeNull()
    expect(antes.saidas?.linhas[1].erros).toEqual({})
    expect(antes.linhaResultado).toBe('Resultado: confira as quantidades das saídas.')
    expect(antes.saidas?.soma).toBe('Saídas: 1 de 2 ct.')
    expect(antes.payloadFechada).toBeNull()
    const m = modelo(top, r, { tentou: true })
    expect(m.saidas?.linhas[1].erros).toEqual({ q: 'Informe a quantidade.' })
    expect(m.saidas?.somaErro).toBe('As saídas somam 1 ct; a entrada tem 2 ct.')
    expect(m.primeiro).toBe('s2q')
    expect(m.visiveis).toMatchObject({ s2q: 'Informe a quantidade.', soma: 'As saídas somam 1 ct; a entrada tem 2 ct.' })
    // A quantity written wrong keeps only its row's error; readable ones that do not add up: the sum's
    expect(modelo(top, mgc({ saidas: [saida(1, '1', '4.409,30', '10:31'), saida(2, 'abc', '4.421,30', '10:38')] }), { tentou: true }).visiveis).toEqual({ s2q: 'Use só números, como 4.' })
    const tres = modelo(top, mgc({ saidas: [saida(1, '1', '4.409,30', '10:31'), saida(2, '2', '4.421,30', '10:38')] }), { tentou: true })
    expect(tres.visiveis).toEqual({ soma: 'As saídas somam 3 ct; a entrada tem 2 ct.' })
    expect(tres.primeiro).toBe('soma')
  })

  it('the rows’ field errors, verbatim, under each field (after a tap)', () => {
    const m = modelo(
      top,
      mgc({
        saidas: [saida(1, '1,5', '4.409,35', '10:20'), saida(2, '0', '', '10:50'), saida(3, '', 'abc', '')],
      }),
      { tentou: true },
    )
    expect(m.saidas?.linhas.map((l) => l.erros)).toEqual([
      { q: 'Use um número inteiro de contratos.', p: 'O MGC anda de 0,10 em 0,10; confira o preço.', h: 'A saída não pode ser antes da entrada (10:24).' },
      { q: 'Use uma quantidade maior que zero.', p: 'Informe o preço de saída.', h: 'A saída não pode ser depois de agora (10:45 ET).' },
      { q: 'Informe a quantidade.', p: 'Use só números, como 7.896,25.', h: 'Informe a hora.' },
    ])
    expect(m.linhaResultado).toBe('Resultado: preencha os preços das saídas.')
    expect(modelo(top, mgc({ lado: null })).linhaResultado).toBe('Resultado: escolha o lado.')
  })

  it('a row at the entry’s minute is no error and is sent (register_after takes it); one minute before is refused', () => {
    const igual = modelo(top, mgc({ saidas: [saida(1, '1', '4.409,30', '10:24'), saida(2, '1', '4.421,30', '10:38')] }), { tentou: true })
    expect(igual.saidas?.linhas[0].erros).toEqual({})
    expect(igual.primeiro).toBeNull()
    expect(igual.payloadFechada?.exits?.map((x) => x.exit)).toEqual(['10:24', '10:38'])
    const antes = modelo(top, mgc({ saidas: [saida(1, '1', '4.409,30', '10:23'), saida(2, '1', '4.421,30', '10:38')] }), { tentou: true })
    expect(antes.saidas?.linhas[0].erros).toEqual({ h: 'A saída não pode ser antes da entrada (10:24).' })
  })

  it('«em média» in futures points keeps two decimals (contract §3.4.3): MES 3 ct at 7.913 / 7.920,50 / 7.926 against 7.912,50', () => {
    const r = rascunho(top, {
      ativo: 'MES',
      lado: 'long',
      qtd: '3',
      qtdOutro: false,
      preco: '7.912,50',
      hora: '10:12',
      saidas: [saida(1, '1', '7.913', '10:20'), saida(2, '1', '7.920,50', '10:25'), saida(3, '1', '7.926', '10:31')],
    })
    // (7.913 + 7.920,50 + 7.926) / 3 − 7.912,50 = 7,3333…; 0,5 + 8 + 13,5 pts × US$ 5
    expect(modelo(top, r).linhaResultado).toBe(`Resultado: +7,33 pts em média · +US$${NB}110,00`)
  })
})

describe('«Movi o stop para o breakeven»', () => {
  it('rendered only with a valid stop; not rendered = off (no check, no focus target, no breakeven sent), `be` kept in the draft', () => {
    expect(modelo(top, mgc({ stop: '' })).be).toBeNull()
    expect(modelo(top, mgc({ stop: '15,05' })).be).toBeNull()
    expect(modelo(top, mgc({ modo: 'aberta', saidas: null })).be).toBeNull()
    const sem = modelo(top, mgc({ stop: '', be: true, bePreco: '' }), { tentou: true })
    expect(sem.be).toBeNull()
    expect(sem.erros.bePreco).toBeUndefined()
    expect(sem.primeiro).toBeNull()
    expect(sem.payloadFechada).not.toBeNull()
    expect(sem.payloadFechada).not.toHaveProperty('breakeven')
    // The stop typed back: the pill comes back pressed
    expect(modelo(top, mgc({ be: true, bePreco: '' })).be).toMatchObject({ ligado: true, erro: null })
    // Off: nothing checked, nothing sent
    const off = modelo(top, mgc({ be: false, bePreco: 'abc' }), { tentou: true })
    expect(off.be).toMatchObject({ ligado: false, erro: null })
    expect(off.payloadFechada).not.toHaveProperty('breakeven')
  })

  it('the status: «Sua regra» from the rules in force at the entry instant, on any day; left out while unknown or without a value for the asset', () => {
    const r = mgc({ be: true, bePreco: '4.409,30' })
    expect(modelo(top, r).be?.status).toBe('com +12,00 pts a favor · Sua regra: com +5 pts.')
    expect(modelo(top, r, { rules: null }).be?.status).toBe('com +12,00 pts a favor.')
    // «Ontem»: the rule is the one PassoEntrada passes (gate_at's answer for that instant)
    const ontem = { ...r, dia: '2026-10-22' }
    expect(modelo(top, ontem, { rules: topRules }).be?.status).toBe('com +12,00 pts a favor · Sua regra: com +5 pts.')
    const semMgc: Rules = { ...topRules, breakeven: { by: { MES: { n: '8', un: 'pts' } } } }
    expect(modelo(top, r, { rules: semMgc }).be?.status).toBe('com +12,00 pts a favor.')
    // Typed but not yet valid: no status; the error at once
    const lado = modelo(top, mgc({ be: true, bePreco: '4.425,30' }))
    expect(lado.be).toMatchObject({ status: '', erro: 'Para o breakeven, o preço precisava estar a favor.' })
    // Empty: only after a tap
    expect(modelo(top, mgc({ be: true, bePreco: '' })).be?.erro).toBeNull()
    expect(modelo(top, mgc({ be: true, bePreco: '' }), { tentou: true }).be?.erro).toBe('Informe o preço quando moveu.')
  })

  it('«Preço quando moveu» in afterBreakeven’s order (format, points that do not fit, tick, decimals, side); every local refusal is the domain’s', () => {
    const MGC = formaDoAtivo('futures', 'MGC')!
    const EUR = formaDoAtivo('forex', 'EUR/USD')!
    const SPY = formaDoAtivo('stocks', 'SPY', { opcao: true })!
    expect(lerPrecoQuando(MGC, '', 'short', '4421.3').erro).toBe('Informe o preço quando moveu.')
    expect(lerPrecoQuando(SPY, '', 'long', '1.85').erro).toBe('Informe o prêmio quando moveu.')
    expect(lerPrecoQuando(MGC, 'abc', 'short', '4421.3').erro).toBe('Use só números, como 7.896,25.')
    expect(lerPrecoQuando(MGC, '0', 'short', '4421.3').erro).toBe('O preço precisa ser maior que zero.')
    expect(lerPrecoQuando(SPY, '0', 'long', '1.85').erro).toBe('O prêmio precisa ser maior que zero.')
    expect(lerPrecoQuando(MGC, '4.409,35', 'short', '4421.3').erro).toBe('O MGC anda de 0,10 em 0,10; confira o preço.')
    expect(lerPrecoQuando(MGC, '4.421,30', 'short', '4421.3').erro).toBe('Para o breakeven, o preço precisava estar a favor.')
    // Pips: a typo far from the entry (2.000.000 on EUR/USD: 2 × 10^10 pips) before the tick text (c7d38cd)
    expect(lerPrecoQuando(EUR, '2.000.000', 'long', '1.0852').erro).toBe('Confira o preço quando moveu.')
    expect(lerPrecoQuando(EUR, '1,08650', 'long', '1.0852')).toEqual({ value: '1.0865' })
    // The same inputs through the domain: refused exactly when the screen refuses, with the code the text names
    const casos: [typeof MGC, string, 'long' | 'short', string][] = [
      [MGC, '0', 'short', '4421.3'],
      [MGC, '4409.35', 'short', '4421.3'],
      [MGC, '4421.3', 'short', '4421.3'],
      [MGC, '4425.3', 'short', '4421.3'],
      [MGC, '4409.3', 'short', '4421.3'],
      [EUR, '2000000', 'long', '1.0852'],
      [EUR, '1.0865', 'long', '1.0852'],
      [EUR, '1.0840', 'long', '1.0852'],
    ]
    const codigo: Record<string, string> = {
      'O preço precisa ser maior que zero.': 'bad_price',
      'Confira o preço quando moveu.': 'bad_price',
      'O MGC anda de 0,10 em 0,10; confira o preço.': 'off_tick',
      'Para o breakeven, o preço precisava estar a favor.': 'bad_stop',
    }
    for (const [forma, preco, lado, entrada] of casos) {
      const local = lerPrecoQuando(forma, preco.replace('.', ','), lado, entrada)
      const dom = afterBreakeven(forma.spec, lado === 'long' ? 1 : -1, entrada, preco)
      expect([preco, local.erro ? codigo[local.erro] : null]).toEqual([preco, dom.ok ? null : dom.code])
    }
  })

  it('a server refusal of «Preço quando moveu» (field "breakeven") reads the E11 texts', () => {
    const MGC = formaDoAtivo('futures', 'MGC')!
    expect(textoRecusaBreakeven('bad_price', MGC)).toBe('Confira o preço quando moveu.')
    expect(textoRecusaBreakeven('off_tick', MGC)).toBe('O MGC anda de 0,10 em 0,10; confira o preço.')
    expect(textoRecusaBreakeven('bad_stop', MGC)).toBe('Para o breakeven, o preço precisava estar a favor.')
    expect(textoRecusaBreakeven('exits_mismatch', MGC)).toBeNull()
  })

  it('labels by kind: «Prêmio quando moveu, US$ por ação», «Preço quando moveu, USDT»', () => {
    const im = idsMercados()
    const contaM = (id: string, nome: Parameters<typeof agoraMercados>[0]) => {
      const a = agoraMercados(nome).accounts.find((x) => x.accountId === id)!
      return contaReg(contasMercados().find((c) => c.id === id)!, a.rules, a.desdeDay)
    }
    const ibkr = contaM(im.accounts.ibkr, 'ibkr-qui-0952')
    const spy = rascunho(ibkr, { tipoEua: 'opcao', ativo: 'SPY', opTipo: 'call', strike: '790', vencimento: '2026-10-15', lado: 'long', qtd: '2', qtdOutro: false, preco: '1.85', hora: '09:35', stop: '1.10' })
    expect(modelo(ibkr, spy, { now: at('2026-10-15T13:52:05Z'), hoje: '2026-10-15', rules: null }).be?.rotulo).toBe('Prêmio quando moveu, US$ por ação')
    const binance = contaM(im.accounts.binance, 'binance-sab-2035')
    const btc = rascunho(binance, { ativo: 'BTC', cotacao: 'USDT', lado: 'short', qtd: '0.25', qtdOutro: true, preco: '112.400', hora: '20:10', stop: '113.000' })
    expect(modelo(binance, btc, { now: at('2026-10-17T23:35:05Z'), hoje: '2026-10-17', rules: null }).be?.rotulo).toBe('Preço quando moveu, USDT')
  })
})

describe('the new markets: units, typed rows, «Corrigir» on the total, «Custos», «Venceu sem valor»', () => {
  const im = idsMercados()
  const contaM = (id: string, nome: Parameters<typeof agoraMercados>[0]) => {
    const a = agoraMercados(nome).accounts.find((x) => x.accountId === id)!
    return { conta: contaReg(contasMercados().find((c) => c.id === id)!, a.rules, a.desdeDay), rules: a.rules }
  }
  const FX_NOW = at('2026-10-15T12:40:05Z')
  const { conta: ftmo } = contaM(im.accounts.ftmo, 'ftmo-qui-0840')
  const fx = (ativo: string, patch: Partial<Rascunho>) =>
    rascunho(ftmo, { ativo, lado: 'long', qtd: '1', qtdOutro: true, preco: '1,08520', hora: '08:10', ...patch })
  const mfx = (r: Rascunho, tentou = false) => modelo(ftmo, r, { now: FX_NOW, hoje: '2026-10-15', rules: null, tentou })

  it('lots: «Saídas: 0,50 de 1,00 lote.»; «As saídas somam 0,50 lote; a entrada tem 1,00 lote.»; pips «em média»', () => {
    const r = fx('EUR/USD', { saidas: [saida(1, '0,25', '1,08650', '08:20'), saida(2, '0,25', '', '08:30')] })
    expect(mfx(r).saidas?.soma).toBe('Saídas: 0,50 de 1,00 lote.')
    expect(mfx(r, true).saidas?.somaErro).toBe('As saídas somam 0,50 lote; a entrada tem 1,00 lote.')
    const ok = mfx(fx('EUR/USD', { saidas: [saida(1, '0,50', '1,08650', '08:20'), saida(2, '0,50', '1,08580', '08:30')] }))
    // average 1,08615 − 1,08520 = 9,5 pips; 0,50 × 13 pips × US$ 10 + 0,50 × 6 pips × US$ 10
    expect(ok.linhaResultado).toBe(`Resultado: +9,5 pips em média · +US$${NB}95,00`)
    expect(ok.resultado?.corrigir).toEqual({ rotulo: 'Corrigir', aberto: false })
    expect(ok.resultado?.calculado).toBe('95,00')
    expect(ok.resultado?.custos).toMatchObject({ rotulo: 'Custos, US$', nota: 'Comissão por lote da sua conta, ida e volta. Da operação toda.' })
  })

  it('USD/JPY: each row estimated by its own price («≈»); «Corrigir» on the total gives the last row the difference', () => {
    const r = rascunho(ftmo, {
      ativo: 'USD/JPY',
      lado: 'long',
      qtd: '0.3',
      qtdOutro: true,
      preco: '150.800',
      hora: '08:10',
      saidas: [saida(1, '0,15', '151,020', '08:20'), saida(2, '0,15', '151,100', '08:30')],
    })
    const m = mfx(r)
    expect(m.linhaResultado).toMatch(/^Resultado: \+26,0 pips em média · ≈ \+US\$\u00a0/)
    expect(m.resultado?.notaEstimativa).not.toBeNull()
    const spec = tradeInstrument('forex', 'USD/JPY', null)!
    const p1 = pnlFromPrices(spec, 1, '0.15', '150.8', '151.02') as string
    const corr = mfx({ ...r, corrigir: true, res: '50,00', custos: '4,20' })
    expect(corr.resultado?.campo).toMatchObject({ rotulo: 'Resultado na sua plataforma, US$', nota: 'Antes da comissão, com swap ou funding, se houver.' })
    expect(corr.resultado?.notaEstimativa).toBeNull()
    expect(corr.payloadFechada?.exits).toEqual([
      { quantity: '0.15', exit_price: '151.02', exit: '08:20' },
      { quantity: '0.15', exit_price: '151.1', exit: '08:30', pnl: lastExitPnl('50', [p1]), costs: '4.2' },
    ])
    expect(mfx({ ...r, corrigir: true, res: '' }, true).visiveis.res).toBe('Informe o resultado.')
  })

  it('typed rows (EUR/GBP): «Resultado desta saída, US$» per row, «… · digite o resultado de cada saída», then the typed sum; each sent on its row', () => {
    const r = rascunho(ftmo, {
      ativo: 'EUR/GBP',
      lado: 'long',
      qtd: '0.5',
      qtdOutro: true,
      preco: '0,87020',
      hora: '08:10',
      saidas: [saida(1, '0,25', '0,87070', '08:20', '16,28'), saida(2, '0,25', '0,87120', '08:30')],
    })
    const m = mfx(r)
    expect(m.saidas?.res).toEqual({
      rotulo: 'Resultado desta saída, US$',
      nota: 'Pelos preços não dá para saber o valor em dólar: digite o resultado desta saída na sua plataforma, antes da comissão, com swap ou funding, se houver.',
    })
    expect(m.linhaResultado).toBe('Resultado: +7,5 pips em média · digite o resultado de cada saída')
    expect(m.resultado?.corrigir).toBeNull()
    expect(mfx(r, true).saidas?.linhas[1].erros).toEqual({ r: 'Informe o resultado.' })
    const ok = mfx({ ...r, saidas: [saida(1, '0,25', '0,87070', '08:20', '16,28'), saida(2, '0,25', '0,87120', '08:30', '29,30')] })
    expect(ok.linhaResultado).toBe(`Resultado: +7,5 pips em média · +US$${NB}45,58`)
    expect(ok.payloadFechada?.exits?.map((x) => x.pnl)).toEqual(['16.28', '29.3'])
  })

  it('shares and coins: «Saídas: 200 de 300 ações.», «Saídas: 0,1 de 0,25 BTC.»', () => {
    const ibkr = contaM(im.accounts.ibkr, 'ibkr-qui-0952').conta
    const aapl = rascunho(ibkr, { ativo: 'AAPL', lado: 'long', qtd: '300', qtdOutro: true, preco: '231.40', hora: '09:35', saidas: [saida(1, '100', '', null), saida(2, '100', '', null)] })
    expect(modelo(ibkr, aapl, { now: at('2026-10-15T13:52:05Z'), hoje: '2026-10-15', rules: null }).saidas?.soma).toBe('Saídas: 200 de 300 ações.')
    const binance = contaM(im.accounts.binance, 'binance-sab-2035').conta
    const btc = rascunho(binance, { ativo: 'BTC', cotacao: 'USDT', lado: 'short', qtd: '0,25', qtdOutro: true, preco: '112.400', hora: '20:10', saidas: [saida(1, '0,1', '', null), saida(2, '', '', null)] })
    expect(modelo(binance, btc, { now: at('2026-10-17T23:35:05Z'), hoje: '2026-10-17', rules: null }).saidas?.soma).toBe('Saídas: 0,1 de 0,25 BTC.')
  })

  it('«Venceu sem valor» applies to the last row: premium 0 at 16:00 ET while nothing is typed there, and its note gains a sentence', () => {
    const ibkr = contaM(im.accounts.ibkr, 'ibkr-qui-0952').conta
    const NOW_TARDE = at('2026-10-15T20:30:05Z')
    const spy = rascunho(ibkr, {
      tipoEua: 'opcao',
      ativo: 'SPY',
      opTipo: 'call',
      strike: '790',
      vencimento: '2026-10-15',
      lado: 'long',
      qtd: '2',
      qtdOutro: false,
      preco: '1.85',
      hora: '09:35',
      vsv: true,
      saidas: [saida(1, '1', '2.40', '10:10'), saida(2, '1', null, null)],
    })
    const m = modelo(ibkr, spy, { now: NOW_TARDE, hoje: '2026-10-15', rules: null })
    expect(m.vsv).toMatchObject({ ligado: true, nota: 'Vale para a última saída.' })
    expect(m.saidas?.linhas[1]).toMatchObject({ preco: '0', hora: '16:00' })
    expect(m.payloadFechada?.exits?.[1]).toEqual({ quantity: '1', exit_price: '0', exit: '16:00' })
    const antes = modelo(ibkr, { ...spy, vsv: false }, { now: at('2026-10-15T13:52:05Z'), hoje: '2026-10-15', rules: null })
    expect(antes.vsv?.nota).toBe('Vence hoje às 16:00 ET. Vale para a última saída.')
  })

  it('«Venceu sem valor» never fills an earlier row; a last row typed and cleared stays empty (asked on the tap), until «Venceu sem valor» is pressed again (RO js l.1216, 1257)', () => {
    const ibkr = contaM(im.accounts.ibkr, 'ibkr-qui-0952').conta
    const NOW_TARDE = at('2026-10-15T20:30:05Z')
    const spy = (saidas: SaidaRascunho[], vsv = true) =>
      rascunho(ibkr, { tipoEua: 'opcao', ativo: 'SPY', opTipo: 'call', strike: '790', vencimento: '2026-10-15', lado: 'long', qtd: '3', qtdOutro: true, preco: '1.85', hora: '09:35', vsv, saidas })
    const m = (r: Rascunho, tentou = false) => modelo(ibkr, r, { now: NOW_TARDE, hoje: '2026-10-15', rules: null, tentou })
    // Rows 1 and 2 never typed: empty, at the clock's minute (16:30); only the last one is 0 at 16:00
    const tres = m(spy([saida(1, '1', null, null), saida(2, '1', null, null), saida(3, '1', null, null)]))
    expect(tres.saidas?.linhas.map((l) => [l.preco, l.hora])).toEqual([
      ['', '16:30'],
      ['', '16:30'],
      ['0', '16:00'],
    ])
    // The last row's premium typed and cleared: empty, and «Registrar operação» asks for it
    const limpo = spy([saida(1, '1', '2.40', '10:10'), saida(2, '2', '', null)])
    expect(m(limpo).saidas?.linhas[1]).toMatchObject({ preco: '', hora: '16:00' })
    expect(m(limpo, true).saidas?.linhas[1].erros).toEqual({ p: 'Informe o prêmio de saída.' })
    expect(m(limpo).payloadFechada).toBeNull()
    // «Venceu sem valor» off and on again: the last row starts over (0 at 16:00 ET)
    const denovo = alternarVsv(alternarVsv(limpo))
    expect(denovo.saidas?.[1]).toEqual(saida(2, '2', null, null))
    expect(m(denovo).saidas?.linhas[1]).toMatchObject({ preco: '0', hora: '16:00' })
    expect(denovo.saidas?.[0]).toEqual(saida(1, '1', '2.40', '10:10'))
  })

  it('«Corrigir» shows once the rows’ total is computed (board `temCorrigir`), or while open; the estimate note only beside a «≈» total (`temEst`)', () => {
    const eur = (saidas: SaidaRascunho[], patch: Partial<Rascunho> = {}) => fx('EUR/USD', { saidas, ...patch })
    const semPreco = mfx(eur([saida(1, '0,50', '1,08650', '08:20'), saida(2, '0,50', null, '08:30')]))
    expect(semPreco.linhaResultado).toBe('Resultado: preencha os preços das saídas.')
    expect(semPreco.resultado?.corrigir).toBeNull()
    expect(semPreco.resultado?.custos).not.toBeNull()
    const semSoma = mfx(eur([saida(1, '0,50', '1,08650', '08:20'), saida(2, '0,25', '1,08580', '08:30')]))
    expect(semSoma.linhaResultado).toBe('Resultado: confira as quantidades das saídas.')
    expect(semSoma.resultado?.corrigir).toBeNull()
    // Open («Usar o calculado») while a price is missing: it stays, with its field
    const aberto = mfx(eur([saida(1, '0,50', '1,08650', '08:20'), saida(2, '0,50', null, '08:30')], { corrigir: true, res: '90' }))
    expect(aberto.resultado?.corrigir).toEqual({ rotulo: 'Usar o calculado', aberto: true })
    // USD/JPY (an estimate): no note while the line asks for prices or quantities
    const jpy = (saidas: SaidaRascunho[]) => rascunho(ftmo, { ativo: 'USD/JPY', lado: 'long', qtd: '0.3', qtdOutro: true, preco: '150.800', hora: '08:10', saidas })
    const jpySem = mfx(jpy([saida(1, '0,15', '151,020', '08:20'), saida(2, '0,15', null, '08:30')]))
    expect(jpySem.linhaResultado).toBe('Resultado: preencha os preços das saídas.')
    expect(jpySem.resultado?.notaEstimativa).toBeNull()
    expect(mfx(jpy([saida(1, '0,15', '151,020', '08:20'), saida(2, '0,10', '151,100', '08:30')])).resultado?.notaEstimativa).toBeNull()
    expect(mfx(jpy([saida(1, '0,15', '151,020', '08:20'), saida(2, '0,15', '151,100', '08:30')])).resultado?.notaEstimativa).not.toBeNull()
  })
})

describe('the step-3 banner’s exit instant (scenario 12)', () => {
  it('the counting exit at the limit’s hitAt (10:12), not the trade’s last exit (10:20); one exit: the trade’s', () => {
    const es = fechadaEs12()
    expect(es.state.trade.exitTime?.toISOString()).toBe('2026-10-23T14:20:00.000Z')
    expect(saidaDoLimite(es.state, es.gateNow)?.toISOString()).toBe('2026-10-23T14:12:00.000Z')
    const mgcA = fechadaMgc()
    expect(saidaDoLimite(mgcA.state, mgcA.gateNow)).toEqual(mgcA.state.trade.exitTime)
    expect(saidaDoLimite(es.state, null)).toEqual(es.state.trade.exitTime)
  })
})

describe('layering (contract §6.1)', () => {
  it('registrarForm imports none of registrarRegra, registrarSaidas, registrarParciais', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../lib/hub/registrarForm.ts'), 'utf8')
    const imports = src.split('\n').filter((l) => /^\s*(import|export)\b.*from\s+['"]/.test(l) || /^\}\s*from\s+['"]/.test(l))
    for (const l of imports) expect(l).not.toMatch(/registrarRegra|registrarSaidas|registrarParciais/)
    expect(src).not.toMatch(/from ['"][^'"]*(registrarRegra|registrarSaidas|registrarParciais)['"]/)
  })
})

/**
 * Phase 3c, commit C1-0 (telas contract §4): the breakeven rule's words shared by step 1 and steps
 * 2–3. The rules are rules_now()'s recorded answer (testing/fixtures/parciais/agora-sex-0900:
 * «Padrão Futuros» MES +8, MNQ +30, MGC +5 for Top One #1 and Apex A; FTMO its own EUR/USD +7,5 pips),
 * the prices the boards' scenarios use (invented data).
 */
import type { Rules } from '@/lib/domain/gate'
import { breakevenOf } from '@/lib/domain/registro'
import { REGRA_BE } from '@/components/hub/registrar/copyRegra'
import { parseRulesNow } from '@/lib/hub/regras'
import { formaDoAtivo, type FormaAtivo } from '@/lib/hub/registrarAtivos'
import { linhaRegra, regraDoAtivo, textoAFavor, textoN } from '@/lib/hub/registrarRegra'
import { idsParciais, parciaisJson } from '@/testing/parciais'

const ids = idsParciais()
const agora = parseRulesNow(parciaisJson('agora-sex-0900'))
const rulesOf = (accountId: string): Rules => agora.accounts.find((a) => a.accountId === accountId)!.rules!
const topOne = rulesOf(ids.accounts.topOne)
const ftmo = rulesOf(ids.accounts.ftmo)
const forma = (...a: Parameters<typeof formaDoAtivo>): FormaAtivo => formaDoAtivo(...a)!

const MES = forma('futures', 'MES')
const MGC = forma('futures', 'MGC')
const ZN = forma('futures', 'ZN')
const EURUSD = forma('forex', 'EUR/USD')
const SPY_CALL = forma('stocks', 'SPY', { opcao: true })
const AAPL = forma('stocks', 'AAPL')
const BTC = forma('crypto', 'BTC', { cotacao: 'USDT' })
const WIN = forma('b3', 'WIN')

const semLado = { option: false, direction: null, entryPrice: null } as const

describe('regraDoAtivo', () => {
  it('names the price of the rule with a side and an entry price (MES +8: 7.912,50 → 7.920,50)', () => {
    expect(regraDoAtivo(topOne, 'MES', { option: false, direction: 'long', entryPrice: '7912.5' })).toEqual({ key: 'MES', n: '8', un: 'pts', level: '7920.5' })
    expect(regraDoAtivo(topOne, 'MES', { option: false, direction: 'short', entryPrice: '7912.5' })).toEqual({ key: 'MES', n: '8', un: 'pts', level: '7904.5' })
  })

  it('has no price without a side or an entry price', () => {
    expect(regraDoAtivo(topOne, 'MES', semLado)).toEqual({ key: 'MES', n: '8', un: 'pts', level: null })
    expect(regraDoAtivo(topOne, 'MES', { option: false, direction: 'long', entryPrice: null })).toEqual({ key: 'MES', n: '8', un: 'pts', level: null })
    expect(regraDoAtivo(topOne, 'MES', { option: false, direction: null, entryPrice: '7912.5' })).toEqual({ key: 'MES', n: '8', un: 'pts', level: null })
  })

  it('keys the asset as the rule does (MNQ, MGC, a contract code)', () => {
    expect(regraDoAtivo(topOne, 'MNQ', { option: false, direction: 'long', entryPrice: '30880' })).toEqual({ key: 'MNQ', n: '30', un: 'pts', level: '30910' })
    expect(regraDoAtivo(topOne, 'MGC', { option: false, direction: 'short', entryPrice: '4421.3' })).toEqual({ key: 'MGC', n: '5', un: 'pts', level: '4416.3' })
    expect(regraDoAtivo(topOne, 'MESZ6', semLado)).toEqual({ key: 'MES', n: '8', un: 'pts', level: null })
  })

  it('is the trade_state rule (breakevenOf) whenever both name a price', () => {
    for (const [symbol, direction, entryPrice] of [
      ['MES', 'long', '7912.5'],
      ['MNQ', 'short', '30880'],
      ['MGC', 'short', '4421.3'],
    ] as const) {
      expect(regraDoAtivo(topOne, symbol, { option: false, direction, entryPrice })).toEqual(
        breakevenOf(topOne.breakeven, 'futures', symbol, false, direction, entryPrice),
      )
    }
  })

  it('is null for an asset not in the rule, an option, no rule or no rules', () => {
    expect(regraDoAtivo(topOne, 'ES', semLado)).toBeNull()
    expect(regraDoAtivo(topOne, 'ZN', semLado)).toBeNull()
    expect(regraDoAtivo(topOne, 'MES', { option: true, direction: 'long', entryPrice: '7912.5' })).toBeNull()
    expect(regraDoAtivo({ market: 'futures' }, 'MES', semLado)).toBeNull()
    expect(regraDoAtivo(null, 'MES', semLado)).toBeNull()
    expect(regraDoAtivo(undefined, 'MES', semLado)).toBeNull()
    expect(regraDoAtivo(ftmo, 'GBP/USD', semLado)).toBeNull()
  })

  it('is null on a binary account even with a rule', () => {
    expect(regraDoAtivo({ market: 'binary', breakeven: { by: { EURUSD: { n: '5', un: 'pips' } } } }, 'EUR/USD', semLado)).toBeNull()
  })

  it('reads pips on FTMO (EUR/USD +7,5 pips: 1,08520 → 1,08595)', () => {
    expect(regraDoAtivo(ftmo, 'EUR/USD', { option: false, direction: 'long', entryPrice: '1.0852' })).toEqual({ key: 'EURUSD', n: '7.5', un: 'pips', level: '1.08595' })
    expect(regraDoAtivo(ftmo, 'EUR/USD', semLado)).toEqual({ key: 'EURUSD', n: '7.5', un: 'pips', level: null })
  })
})

describe('textoN', () => {
  it('writes +N in the rule’s unit', () => {
    expect(textoN({ n: '8', un: 'pts' })).toBe('+8 pts')
    expect(textoN({ n: '7.5', un: 'pips' })).toBe('+7,5 pips')
    expect(textoN({ n: '0.5', un: 'price' })).toBe('+0,5 no preço')
    expect(textoN({ n: '1500', un: 'pts' })).toBe('+1.500 pts')
  })
})

describe('linhaRegra', () => {
  it('names the price when the rule has one, with the asset’s decimals', () => {
    expect(linhaRegra(MES, { key: 'MES', n: '8', un: 'pts', level: '7920.5' })).toBe('Sua regra: breakeven com +8 pts, em 7.920,50.')
    expect(linhaRegra(EURUSD, { key: 'EURUSD', n: '7.5', un: 'pips', level: '1.08595' })).toBe('Sua regra: breakeven com +7,5 pips, em 1,08595.')
  })

  it('stops at the rule without a price', () => {
    expect(linhaRegra(MES, { key: 'MES', n: '8', un: 'pts', level: null })).toBe('Sua regra: breakeven com +8 pts.')
    expect(linhaRegra(null, { key: 'MES', n: '8', un: 'pts', level: null })).toBe('Sua regra: breakeven com +8 pts.')
  })

  it('is the line the step-1 rule gives for the board’s MES entry', () => {
    const r = regraDoAtivo(topOne, 'MES', { option: false, direction: 'long', entryPrice: '7912.5' })!
    expect(linhaRegra(MES, r)).toBe('Sua regra: breakeven com +8 pts, em 7.920,50.')
    expect(linhaRegra(MES, regraDoAtivo(topOne, 'MES', semLado)!)).toBe('Sua regra: breakeven com +8 pts.')
  })
})

describe('textoAFavor', () => {
  it('futures points, in favour, against and at the entry (both sides)', () => {
    expect(textoAFavor(MES, '7912.5', '7920.5', 'long', true)).toBe('Com +8,00 pts a favor')
    expect(textoAFavor(MES, '7912.5', '7923.5', 'long', false)).toBe('com +11,00 pts a favor')
    expect(textoAFavor(MES, '7912.5', '7909.5', 'long', true)).toBe('Com 3,00 pts contra')
    expect(textoAFavor(MES, '7912.5', '7912.5', 'long', true)).toBe('Com o preço na entrada')
    expect(textoAFavor(MES, '7912.5', '7912.50', 'long', false)).toBe('com o preço na entrada')
    expect(textoAFavor(MGC, '4421.3', '4409.3', 'short', false)).toBe('com +12,00 pts a favor')
    expect(textoAFavor(MGC, '4421.3', '4425.3', 'short', false)).toBe('com 4,00 pts contra')
  })

  it('pips, premium, per share, per coin, B3 points and a price', () => {
    expect(textoAFavor(EURUSD, '1.0852', '1.0865', 'long', true)).toBe('Com +13,0 pips a favor')
    expect(textoAFavor(EURUSD, '1.0852', '1.0840', 'long', true)).toBe('Com 12,0 pips contra')
    expect(textoAFavor(SPY_CALL, '1.85', '2.40', 'long', true)).toBe('Com +0,55 no prêmio a favor')
    expect(textoAFavor(AAPL, '182.5', '183.25', 'long', true)).toBe('Com +0,75 por ação a favor')
    expect(textoAFavor(BTC, '112400', '111950', 'short', true)).toBe('Com +450 por BTC a favor')
    expect(textoAFavor(WIN, '131250', '131100', 'short', true)).toBe('Com +150 pts a favor')
    expect(textoAFavor(WIN, '131250', '131300', 'short', false)).toBe('com 50 pts contra')
    expect(textoAFavor(ZN, '110.5', '111', 'long', true)).toBe('Com +0,50 no preço a favor')
    expect(textoAFavor(ZN, '110.5', '110.5', 'short', true)).toBe('Com o preço na entrada')
  })
})

describe('REGRA_BE', () => {
  it('has the board’s words and no prototype control', () => {
    expect(REGRA_BE.linha('+8 pts', '7.920,50')).toBe('Sua regra: breakeven com +8 pts, em 7.920,50.')
    expect(REGRA_BE.aFavor('+8,00 pts', true)).toBe('Com +8,00 pts a favor')
    expect(REGRA_BE.contra('3,00 pts', false)).toBe('com 3,00 pts contra')
    expect(REGRA_BE.naEntrada(true)).toBe('Com o preço na entrada')
    const all = [REGRA_BE.n('8', 'pts'), REGRA_BE.n('8', 'pips'), REGRA_BE.n('8', 'price'), REGRA_BE.linha('x', null), REGRA_BE.naEntrada(false)].join(' ')
    for (const proto of ['Preencher exemplo', 'Avançar o relógio', 'Recomeçar', 'Cenário do protótipo', 'só no protótipo']) expect(all).not.toContain(proto)
  })
})

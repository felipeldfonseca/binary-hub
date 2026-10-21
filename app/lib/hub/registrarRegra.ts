import type { Rules } from '@/lib/domain/gate'
import { breakevenOf, tradeMatchKey, type TradeBreakeven } from '@/lib/domain/registro'
import { fromInt, mul, numeric, numericText, sub } from '@/lib/domain/registro/numeric'
import { REGRA_BE } from '@/components/hub/registrar/copyRegra'
import { formatDecimal } from './numero'
import type { FormaAtivo } from './registrarAtivos'
import { diferencaTexto, precoDe } from './registrarForm'

/**
 * The rule of an asset in a Rules value (rules_now's for step 1, a version's), with the price it
 * names when the side and a valid entry price are known; null when the rules have no value for it
 * (no rule, a binary, an option, an asset not in the rule)
 */
export function regraDoAtivo(
  rules: Pick<Rules, 'market' | 'breakeven'> | null | undefined,
  symbol: string,
  o: { option: boolean; direction: 'long' | 'short' | null; entryPrice: string | null },
): TradeBreakeven | null {
  if (!rules?.breakeven || rules.market === 'binary' || o.option) return null
  const key = tradeMatchKey(rules.market, symbol)
  const r = Object.prototype.hasOwnProperty.call(rules.breakeven.by, key) ? rules.breakeven.by[key] : null
  if (!r) return null
  const full = o.direction && o.entryPrice ? breakevenOf(rules.breakeven, rules.market, symbol, false, o.direction, o.entryPrice) : null
  return { key, n: r.n, un: r.un, level: full?.level ?? null }
}

/** «+8 pts» · «+7,5 pips» · «+0,50 no preço» */
export const textoN = (rule: Pick<TradeBreakeven, 'n' | 'un'>): string => REGRA_BE.n(formatDecimal(rule.n), rule.un)

/** «Sua regra: breakeven com +8 pts, em 7.920,50.» (with `rule.level`), else «Sua regra: breakeven com +8 pts.» */
export const linhaRegra = (forma: FormaAtivo | null, rule: TradeBreakeven): string =>
  REGRA_BE.linha(textoN(rule), rule.level === null ? null : precoDe(forma, rule.level))

/** «Com +8,00 pts a favor» / «com 3,00 pts contra» / «com o preço na entrada» (no final period) */
export function textoAFavor(forma: FormaAtivo, entryPrice: string, price: string, side: 'long' | 'short', maiuscula: boolean): string {
  const dif = numericText(mul(sub(numeric(price), numeric(entryPrice)), fromInt(side === 'long' ? 1 : -1)))
  const n = Number(dif)
  if (n > 0) return REGRA_BE.aFavor(diferencaTexto(forma, dif), maiuscula)
  if (n < 0) return REGRA_BE.contra(diferencaTexto(forma, dif).replace(/^[−-]/, ''), maiuscula)
  return REGRA_BE.naEntrada(maiuscula)
}

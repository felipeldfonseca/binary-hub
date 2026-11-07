/**
 * The Diário page's pure rules (Phase 4, telas B0): who the page's words are for, the open day read
 * from the URL, and when «Registrar operação» opens on the open day instead of today. No React; the
 * page's provider (components/hub/diario/useDiarioPagina) and the header use them.
 */
import { MARKET_SPEC, currencyOf, type AccountMarket } from '@/lib/domain/markets'
import type { Rules } from '@/lib/domain/gate'
import type { Day } from '@/lib/domain/diario'
import type { ContaDiario } from './diario'

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The Diário's words are for the account's currency and market, and every hour is written on the
 * window's clock (rules_now's windows[0].tz), else the market's window clock (ET on Futuros, Forex
 * and Ações; Brasília on binárias, Cripto and B3)
 */
export function contaDiarioDe(account: { market: AccountMarket }, rules: Pick<Rules, 'windows'> | null): ContaDiario {
  return {
    currency: currencyOf(account.market),
    market: account.market,
    tz: rules?.windows[0]?.tz ?? MARKET_SPEC[account.market].windowTz,
  }
}

/** A real calendar day written 'YYYY-MM-DD' (no 2026-02-30) */
function isDay(text: string): boolean {
  const m = DAY_RE.exec(text)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/**
 * The open day asked by `?dia=`: a valid 'YYYY-MM-DD' not after today (the account's trading day,
 * the calendar's answer); null otherwise (the page opens today)
 */
export function diaDaUrl(param: string | null | undefined, hoje: Day): Day | null {
  if (!param || !isDay(param)) return null
  return param <= hoje ? param : null
}

/**
 * D16: «Registrar operação» opens «Já fechada» on the open day when it is a past day of the diário:
 * on or after the day the rules began («desde»'s day) and before today
 */
export function diaPassadoDoDiario(dia: Day | null, hoje: Day | null, desdeDay: Day | null): boolean {
  if (!dia || !hoje || !desdeDay) return false
  return dia >= desdeDay && dia < hoje
}

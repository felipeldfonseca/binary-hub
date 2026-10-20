/**
 * «Registrar operação» (Phase 3, PR 3-3): what both screen lanes need besides the database calls
 * (registrarDb) and the hooks (hooks/useRegistrar). Pure: no React, no client.
 *
 *   podeRegistrar        which accounts get the button and the sheet in 3-3 (Futuros and Ebinex;
 *                        the new markets keep their interim state until 3-4, D36)
 *   padroesDoRegistrar   the form's starting values from the account's recent trades (D5, D6)
 *   diaDeHoje            the account's trading day now (rules_now's, else its day clock's)
 *   inicioDoDia          the instant today's trading day began (the bridge's «fechadas hoje»)
 *   avisoDoLimite        the exit banner: the limit reached (always) or 80 % of it (with the
 *                        preference on), only when this exit crossed it (D9, registrar §11.4)
 */
import { tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain';
import { MARKET_SPEC, type AccountMarket, type Currency } from '@/lib/domain/markets';
import { currencyOf, type LimitCheck } from '@/lib/domain/gate';
import { tradeMatchKey, type Direction } from '@/lib/domain/registro';

// ---------------------------------------------------------------------------------------------
// Which accounts
// ---------------------------------------------------------------------------------------------

/**
 * The markets whose Registrar form PR 3-3 builds. Forex, Ações e opções, Cripto and B3 accounts get
 * no «Registrar operação» (header, end of account creation, the sheet's account list) and keep
 * their «… na Fase 3» texts until PR 3-4 ships their variants (D36).
 */
export const REGISTRAR_MARKETS: readonly AccountMarket[] = ['futures', 'binary'];

export function podeRegistrar(market: AccountMarket | null | undefined): boolean {
  return !!market && (REGISTRAR_MARKETS as readonly string[]).includes(market);
}

/** The futures shortcuts of the approved board (RO `D.futChips`; D5): the six roots, in this order */
export const FUTURES_CHIPS = ['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'] as const;

/** «Contratos» shortcuts (RO `QF.chips`); anything else is «Outro» */
export const CONTRACT_CHIPS = ['1', '2', '3'] as const;

// ---------------------------------------------------------------------------------------------
// Starting values
// ---------------------------------------------------------------------------------------------

/** One of the account's recent trades, as registrarDb.fetchRecentTrades reads it (newest first) */
export interface RecentTrade {
  symbol: string;
  /**
   * trades.asset_type ('option' tells an option from a stock on Ações e opções; 'futures' a B3
   * contract from a B3 stock); null when not read (3-3's recorded rows)
   */
  assetType?: string | null;
  direction: Direction;
  quantity: string | null;
  stake: string | null;
  payout: string | null;
  durationS: number | null;
  source: 'live' | 'after' | 'import' | null;
  entryTime: Date;
}

export interface RegistrarDefaults {
  /**
   * Futures: the root preselected in «Ativo» (D5): the last trade registered in the app whose root
   * is one of FUTURES_CHIPS, else the last imported one's (MESZ6 → MES), else the first chip.
   * Binary: the most used pair (or null when the account has no trade: «Outro par» is the way in).
   */
  symbol: string | null;
  /** Futures: the last quantity used in the account (a whole number ≥ 1, as text), else '1' */
  quantity: string;
  /**
   * Binary: the pairs of the account's history in the file's spelling («BTC/USDT»), most used
   * first, ties by the latest (D6: «pares do histórico da conta» + «Outro par»)
   */
  pairs: string[];
  /** Binary: the last payout used with each pair (registrar Q7 a); absent = the field starts empty */
  payoutBySymbol: Record<string, string>;
  /** Binary: the last stake used in the account; null = the field starts empty */
  stake: string | null;
}

const WHOLE = /^[1-9][0-9]{0,5}$/;
/** '2.00000000' → '2'; '20.50' → '20.5' (what a field shows before the pt-BR formatting) */
const plainDecimal = (x: string) => (x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x);

/**
 * The form's starting values (D5, D6), from the account's recent trades, newest first. Nothing here
 * is sent unless the owner keeps it; prices always start empty (sintese: «preços começam vazios»).
 */
export function padroesDoRegistrar(market: AccountMarket, recent: readonly RecentTrade[]): RegistrarDefaults {
  const out: RegistrarDefaults = { symbol: null, quantity: '1', pairs: [], payoutBySymbol: {}, stake: null };
  if (market === 'futures') {
    const chips = FUTURES_CHIPS as readonly string[];
    const rootOf = (t: RecentTrade) => tradeMatchKey('futures', t.symbol);
    const app = recent.find((t) => (t.source === 'live' || t.source === 'after') && chips.includes(rootOf(t)));
    const any = app ?? recent.find((t) => chips.includes(rootOf(t)));
    out.symbol = any ? rootOf(any) : FUTURES_CHIPS[0];
    const q = recent.find((t) => t.quantity !== null && WHOLE.test(plainDecimal(t.quantity)));
    if (q && q.quantity !== null) out.quantity = plainDecimal(q.quantity);
    return out;
  }
  if (market === 'binary') {
    const count = new Map<string, { n: number; last: number }>();
    recent.forEach((t, i) => {
      const s = t.symbol.trim();
      if (!s) return;
      const c = count.get(s);
      if (c) c.n += 1;
      else count.set(s, { n: 1, last: i });
      if (t.payout !== null && !(s in out.payoutBySymbol)) out.payoutBySymbol[s] = plainDecimal(t.payout);
    });
    out.pairs = Array.from(count.entries())
      .sort((a, b) => b[1].n - a[1].n || a[1].last - b[1].last)
      .map(([s]) => s);
    out.symbol = out.pairs[0] ?? null;
    const st = recent.find((t) => t.stake !== null);
    out.stake = st && st.stake !== null ? plainDecimal(st.stake) : null;
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Today's trading day
// ---------------------------------------------------------------------------------------------

/**
 * When today's trading day began on the account's day clock (MARKET_SPEC[market].day, which the
 * database's insert trigger gives every account): the bridge also lists a trade of an earlier day
 * that closed today («ontem, 10:52 → 10:42»), i.e. whose exit is at or after this instant.
 */
export function inicioDoDia(day: string, market: AccountMarket, clock: DayClock = MARKET_SPEC[market].day): Date {
  return tradingDayBounds(day, clock).start;
}

/**
 * The account's trading day now: rules_now's (the gate's trading day, which places an overnight
 * window on the day it opened); without that answer, the day clock's on the server's now.
 */
export function diaDeHoje(
  rulesNow: { accounts: readonly { accountId: string; gate: { tradingDay: string } }[] } | null | undefined,
  account: { id: string; market: AccountMarket },
  serverNow: Date,
): string {
  const a = rulesNow?.accounts.find((x) => x.accountId === account.id);
  return a ? a.gate.tradingDay : tradingDayOn(serverNow, MARKET_SPEC[account.market].day);
}

// ---------------------------------------------------------------------------------------------
// The exit banner
// ---------------------------------------------------------------------------------------------

export type AvisoDoLimite =
  | {
      /** «Limite do dia atingido às {10:40}: {−US$ 505} de {US$ 400}. Pelas suas regras, …» */
      tipo: 'atingido';
      /** When the day's running net reached the limit (the gate's hitAt); null when not known */
      hitAt: Date | null;
      /** The day's lowest running net, ≤ 0, cents of `currency` (the board shows it signed: «−US$ 505») */
      worstCents: number;
      limitCents: number;
      currency: Currency;
      /** «… o dia está encerrado.» (encerrar) or «… é só um aviso.» (avisar) */
      atLimit: 'encerrar' | 'avisar';
    }
  | {
      /** «Você chegou a 80% do limite do dia: {−US$ 345} de {US$ 400}.» */
      tipo: 'oitenta';
      worstCents: number;
      limitCents: number;
      currency: Currency;
    };

export interface AvisoInput {
  market: AccountMarket;
  /** The trading day the trade counts on (trades.trading_day) */
  tradeDay: string | null;
  /** The account's limit check before this exit (the cached rules_now; null when not known) */
  before: { tradingDay: string; limit: LimitCheck } | null;
  /** The answer's gate_now (null on a repeated tap: nothing new happened) */
  after: { tradingDay: string; limit: LimitCheck } | null;
  /** The exit instant this registration stored (register_exit's exit_at) */
  exitAt: Date | null;
  /** profiles.preferences.alerts.limit_80 («Avisar ao chegar em 80% do limite do dia») */
  pref80: boolean;
}

/**
 * The banner of step 3 after «Registrar saída» / «Registrar resultado» / «Registrar operação»: only
 * when this registration made the day cross the limit (always shown) or 80 % of it (only with the
 * preference on). A trade that counts on another trading day (open since yesterday) never moves
 * today's limit: no banner. Without the state before the exit, the limit counts as crossed by this
 * exit only when the gate's hitAt is this exit, and 80 % is never claimed (no false «Você chegou»).
 */
export function avisoDoLimite(x: AvisoInput): AvisoDoLimite | null {
  const after = x.after;
  if (!after || !after.limit.evaluated || x.tradeDay === null || after.tradingDay !== x.tradeDay) return null;
  const lim = after.limit;
  const currency = currencyOf(x.market);
  const before = x.before && x.before.tradingDay === after.tradingDay && x.before.limit.evaluated ? x.before.limit : null;
  if (lim.state === 'atingido') {
    const crossed = before
      ? before.state !== 'atingido'
      : !!(lim.hitAt && x.exitAt && lim.hitAt.getTime() === x.exitAt.getTime());
    if (!crossed) return null;
    return { tipo: 'atingido', hitAt: lim.hitAt, worstCents: lim.worstCents, limitCents: lim.cents, currency, atLimit: lim.atLimit };
  }
  if (x.pref80 && lim.near && before && before.state === 'ok' && !before.near) {
    return { tipo: 'oitenta', worstCents: lim.worstCents, limitCents: lim.cents, currency };
  }
  return null;
}

/**
 * «Registrar operação» (Phase 3, PR 3-3): what both screen lanes need besides the database calls
 * (registrarDb) and the hooks (hooks/useRegistrar). Pure: no React, no client.
 *
 *   podeRegistrar        which accounts get the button and the sheet: every market since 3-4 (the
 *                        end of D36)
 *   padroesDoRegistrar   the form's starting values from the account's recent trades (D5, D6)
 *   diaDeHoje            the account's trading day now (rules_now's, else its day clock's)
 *   inicioDoDia          the instant today's trading day began (the bridge's «fechadas hoje»)
 *   avisoDoLimite        the exit banner: the limit reached (always) or 80 % of it (with the
 *                        preference on), only when this exit crossed it (D9, registrar §11.4)
 *
 * 3-4 adds the new markets' starting values (padroesDoRegistrar: the last instruments, the quote,
 * the quantities per kind), their chips (LOT_CHIPS, B3_CONTRACT_CHIPS, B3_CHIPS, EXEMPLOS_ATIVO) and
 * «Cotada em» (COTACOES, cotacaoDoSimbolo). What each instrument's form looks like is
 * lib/hub/registrarAtivos'.
 */
import { tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain';
import { ACCOUNT_MARKETS, MARKET_SPEC, type AccountMarket, type Currency } from '@/lib/domain/markets';
import { currencyOf, type LimitCheck } from '@/lib/domain/gate';
import { tradeMatchKey, type Direction } from '@/lib/domain/registro';

// ---------------------------------------------------------------------------------------------
// Which accounts
// ---------------------------------------------------------------------------------------------

/**
 * The markets whose accounts register: every one since PR 3-4 (Futuros and binárias in 3-3; Forex,
 * Ações e opções, Cripto and B3 in 3-4, and a backfilled `options` account with «Opção» fixed). The
 * header button, /diario?registrar=1, the end of account creation, the sheet's account list and
 * «Operações do dia» follow it; the interim «… na Fase 3» texts of D36 are gone.
 */
export const REGISTRAR_MARKETS: readonly AccountMarket[] = ACCOUNT_MARKETS;

export function podeRegistrar(market: AccountMarket | null | undefined): boolean {
  return !!market && (REGISTRAR_MARKETS as readonly string[]).includes(market);
}

/** The futures shortcuts of the approved board (RO `D.futChips`; D5): the six roots, in this order */
export const FUTURES_CHIPS = ['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'] as const;

/** «Contratos» shortcuts (RO `QF.chips`); anything else is «Outro» */
export const CONTRACT_CHIPS = ['1', '2', '3'] as const;

/** B3 futures «Contratos» shortcuts (RO `QB.chips`, 3-4) */
export const B3_CONTRACT_CHIPS = ['1', '2', '3', '5', '10'] as const;

/** Forex «Lotes» shortcuts as decimal text (RO `QL.chips`: «0,01» «0,10» «0,50» «1,00»; 3-4) */
export const LOT_CHIPS = ['0.01', '0.1', '0.5', '1'] as const;

/** The B3 instrument shortcuts (RO `conta.recentes` of Clear; 3-4) */
export const B3_CHIPS = ['WIN', 'WDO', 'IND', 'DOL'] as const;

/**
 * The board's instrument examples when the account has no trade of that kind yet (RO l.590–593):
 * forex, ações, opções (the underlying) and cripto (the coin). 3-4.
 */
export const EXEMPLOS_ATIVO = {
  forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD'],
  acao: ['SPY', 'AAPL', 'NVDA', 'TSLA', 'QQQ'],
  opcao: ['SPY', 'QQQ', 'SPX', 'NVDA', 'TSLA'],
  crypto: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
} as const;

/** «Cotada em» (cripto): the quote coins the form offers; «R$» is stored as BRL. 3-4 */
export type Cotacao = 'USDT' | 'USDC' | 'USD' | 'R$';
export const COTACOES: readonly Cotacao[] = ['USDT', 'USDC', 'USD', 'R$'];

/**
 * A crypto symbol as the form shows it: the coin and its quote («BTC/USDT» → BTC, USDT; «BTCUSDT»
 * splits by the known quote suffix; «BTC/BRL» → R$). A pair quoted in anything else keeps the whole
 * symbol as the coin, with no quote. 3-4.
 */
export function cotacaoDoSimbolo(symbol: string): { ativo: string; cotacao: Cotacao | null } {
  const s = String(symbol ?? '').trim().toUpperCase();
  const of = (q: string): Cotacao | null => (q === 'BRL' ? 'R$' : q === 'USDT' || q === 'USDC' || q === 'USD' ? q : null);
  const slash = s.indexOf('/');
  if (slash > 0) {
    const q = of(s.slice(slash + 1).trim());
    return q ? { ativo: s.slice(0, slash).trim(), cotacao: q } : { ativo: s, cotacao: null };
  }
  for (const q of ['USDT', 'USDC', 'BRL', 'USD']) {
    if (s.length > q.length && s.endsWith(q)) return { ativo: s.slice(0, -q.length), cotacao: of(q) };
  }
  return { ativo: s, cotacao: null };
}

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
  /**
   * 3-4 (forex, stocks, options, crypto, b3): the account's last five distinct instruments of the
   * kind, newest first (a forex pair, a stock or ETF, a crypto coin without its quote, a B3 code);
   * absent on futures and binary
   */
  simbolos?: string[];
  /** 3-4 (stocks, options): the last five distinct option underlyings, newest first */
  simbolosOpcao?: string[];
  /** 3-4 (stocks): what the last trade was, «Ação ou ETF» or «Opção» */
  tipoEua?: 'acao' | 'opcao';
  /** 3-4 (crypto): the quote of the last trade quoted in one the form offers, else USDT */
  cotacao?: Cotacao;
  /**
   * 3-4: the last quantity used per quantity kind that has chips (lots on forex, contracts of an
   * option, B3 contracts), decimal text; the form starts on that chip, or «Outro» with it
   */
  quantidades?: Partial<Record<'contratos' | 'contratosB3' | 'lotes', string>>;
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
  if (market === 'forex' || market === 'stocks' || market === 'options' || market === 'crypto' || market === 'b3') {
    return padroesNovos(market, recent, out);
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

/** The first `n` distinct values, in order */
function distintos(values: readonly string[], n: number): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (v && !out.includes(v)) out.push(v);
    if (out.length === n) break;
  }
  return out;
}

const isOption = (t: RecentTrade) => t.assetType === 'option';

/** 3-4: the starting values of a new market's form (the chips of recent instruments, the quote, the quantities) */
function padroesNovos(market: 'forex' | 'stocks' | 'options' | 'crypto' | 'b3', recent: readonly RecentTrade[], out: RegistrarDefaults): RegistrarDefaults {
  const sym = (t: RecentTrade) => t.symbol.trim().toUpperCase();
  const qtd = (t: RecentTrade | undefined) => (t && t.quantity !== null ? plainDecimal(t.quantity) : undefined);
  const quantidades: NonNullable<RegistrarDefaults['quantidades']> = {};
  if (market === 'forex') {
    out.simbolos = distintos(recent.map(sym), 5);
    const q = qtd(recent.find((t) => t.quantity !== null));
    if (q) quantidades.lotes = q;
  } else if (market === 'stocks' || market === 'options') {
    out.simbolos = market === 'stocks' ? distintos(recent.filter((t) => !isOption(t)).map(sym), 5) : [];
    out.simbolosOpcao = distintos(recent.filter((t) => market === 'options' || isOption(t)).map(sym), 5);
    out.tipoEua = market === 'options' || (recent[0] && isOption(recent[0])) ? 'opcao' : 'acao';
    const q = qtd(recent.find((t) => (market === 'options' || isOption(t)) && t.quantity !== null && WHOLE.test(plainDecimal(t.quantity))));
    if (q) quantidades.contratos = q;
  } else if (market === 'crypto') {
    const split = recent.map((t) => cotacaoDoSimbolo(t.symbol));
    out.simbolos = distintos(split.map((x) => x.ativo), 5);
    out.cotacao = split.find((x) => x.cotacao !== null)?.cotacao ?? 'USDT';
  } else {
    out.simbolos = distintos(recent.map(sym), 5);
    const q = qtd(recent.find((t) => t.assetType === 'futures' && t.quantity !== null && WHOLE.test(plainDecimal(t.quantity))));
    if (q) quantidades.contratosB3 = q;
  }
  out.symbol = (market === 'options' || out.tipoEua === 'opcao' ? out.simbolosOpcao?.[0] : out.simbolos?.[0]) ?? null;
  out.quantidades = quantidades;
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

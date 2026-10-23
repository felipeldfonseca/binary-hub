import sys
p = sys.argv[1]
s = open(p).read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep(""" * Every market of ACCOUNT_MARKETS has a window rule, windows and a daily limit; the data block,
 * the state rule and «somando» exist where MARKET_SPEC[m].rules says (futures only until Phase 5).
 * The limit's amount is in the market's currency, under its key: `brl` on B3, `usd` elsewhere.
 */""", """ * Every market of ACCOUNT_MARKETS has a window rule, windows and a daily limit; the data block,
 * the state rule and «somando» exist where MARKET_SPEC[m].rules says (futures only until Phase 5).
 * The limit's amount is in the market's currency, under its key: `brl` on B3, `usd` elsewhere.
 *
 * Phase 3c (20261023000001_regra_breakeven.sql): «Mover para o breakeven com +N» per asset, on
 * every market but binaries (MARKET_SPEC[m].rules.breakeven), as a market default and «só nesta
 * conta» (the whole setting, like the window). Absent everywhere until set, so the settings, the
 * payloads and what they resolve to are byte for byte the ones before; Rules get the key only
 * when the rule acts (on, with an asset whose unit is known).
 */""")

rep("""  usdToCents,
  type AccountMarket,
  type AtLimit,
  type CalendarCode,""", """  usdToCents,
  type AccountMarket,
  type AtLimit,
  type BreakevenRule,
  type CalendarCode,""")
rep("""import { tradingDayFor, type DayClock } from '@/lib/domain/tempo';
import type { HubPreferences } from './contasDb';""", """import { tradingDayFor, type DayClock } from '@/lib/domain/tempo';
import { decimalFromJson, parseNumeric, plainText, tradeInstrument } from '@/lib/domain/registro';
import { BREAKEVEN_N_DP, MAX_BREAKEVEN_ASSETS, MAX_BREAKEVEN_N, isBreakevenKey } from '@/lib/domain/gate';
import type { HubPreferences } from './contasDb';
import { lerNumero } from './numero';""")

rep("""/**
 * A market's default («Padrão Futuros», and the defaults of the other markets the boards never
 * name): market_rule_defaults + its windows
 */
export interface MarketSettings {""", """/**
 * «Mover para o breakeven com +N» as edited (Phase 3c): the switch and «+N» per asset, keyed by
 * tradeMatchKey (MES, EURUSD, PETR4), as decimal text ('10', '7.5') in the asset's unit of stops.
 * `on: false` keeps the values and resolves like no rule; on with no asset does not act either.
 */
export interface BreakevenSetting {
  on: boolean;
  by: Record<string, string>;
}

/**
 * A market's default («Padrão Futuros», and the defaults of the other markets the boards never
 * name): market_rule_defaults + its windows
 */
export interface MarketSettings {""")
rep("""  /** 0–2 windows on one clock; [] = «Sem janela» */
  windows: WindowSetting[];
}

/** «Limite do dia» of one account""", """  /** 0–2 windows on one clock; [] = «Sem janela» */
  windows: WindowSetting[];
  /**
   * «Mover para o breakeven» (Phase 3c), where the market has it (every market but binaries);
   * absent = never set (no rule)
   */
  breakeven?: BreakevenSetting;
}

/** «Limite do dia» of one account""")
rep("""  /** «Ajustar só nesta conta»: one window, on the market's clock; null = uses the market's */
  window: WindowSetting | null;
}""", """  /** «Ajustar só nesta conta»: one window, on the market's clock; null = uses the market's */
  window: WindowSetting | null;
  /**
   * «Mover para o breakeven» «só nesta conta» (Phase 3c): the whole setting replaces the market's;
   * absent = the market's («padrão de Futuros»)
   */
  breakeven?: BreakevenSetting;
}""")

rep("""/** market_rule_defaults.rules (MarketRules v1) */
export interface MarketRulesJson {
  v: 1;
  window_rule: { on: boolean; outside: OutsideShows };
  /** where the market has the data block (futures) */
  block?: { on: boolean; before_min: number; after_min: number };
  /** where the market has the state rule (futures) */
  states?: Partial<Record<StateName, { choice: StateChoice | null; text?: string }>>;
}""", """/** The stored «Mover para o breakeven» (MarketRules and AccountRules): «+N» as JSON numbers */
export interface BreakevenJson {
  on: boolean;
  by: Record<string, number>;
}

/** market_rule_defaults.rules (MarketRules v1) */
export interface MarketRulesJson {
  v: 1;
  window_rule: { on: boolean; outside: OutsideShows };
  /** where the market has the data block (futures) */
  block?: { on: boolean; before_min: number; after_min: number };
  /** where the market has the state rule (futures) */
  states?: Partial<Record<StateName, { choice: StateChoice | null; text?: string }>>;
  /** Phase 3c, only once set (every market but binaries) */
  breakeven?: BreakevenJson;
}""")
rep("""  block?: Partial<{ on: boolean; before_min: number; after_min: number }>;
  limit?: LimitJson | null;
}""", """  block?: Partial<{ on: boolean; before_min: number; after_min: number }>;
  limit?: LimitJson | null;
  /** Phase 3c: «só nesta conta» (the whole setting); absent = the market's */
  breakeven?: BreakevenJson;
}""")

rep("""export const toWindowSpec = (w: WindowSetting): WindowSpecJson => ({""", """/** The stored form of a setting: «+N» as JSON numbers ('7.5' → 7.5) */
export function breakevenJson(b: BreakevenSetting): BreakevenJson {
  return { on: b.on, by: Object.fromEntries(Object.entries(b.by).map(([k, n]) => [k, Number(n)])) };
}

/** A stored setting → the editor's form («+N» as decimal text); any other shape is not the as-built one */
function breakevenFromJson(x: unknown): BreakevenSetting {
  const b = obj(x);
  const by = obj(b.by);
  return {
    on: bool(b.on),
    by: Object.fromEntries(
      Object.entries(by).map(([k, v]) => {
        const n = typeof v === 'number' ? decimalFromJson(v, BREAKEVEN_N_DP) : null;
        return [k, n === null ? bad() : n];
      }),
    ),
  };
}

export const toWindowSpec = (w: WindowSetting): WindowSpecJson => ({""")

rep("""  const caps = MARKET_SPEC[m].rules;
  return {
    windowRule: { on: bool(wr.on), outside: outside(wr.outside) },
    block: caps.block ? (blockFromJson(r.block ?? b.block, false) as BlockSetting) : null,
    states: caps.states ? statesFromJson(r.states) : {},
    windows: (Array.isArray(windowsJson) ? windowsJson : windowsJson == null ? [] : bad()).map(windowFromJson),
  };
}""", """  const caps = MARKET_SPEC[m].rules;
  const out: MarketSettings = {
    windowRule: { on: bool(wr.on), outside: outside(wr.outside) },
    block: caps.block ? (blockFromJson(r.block ?? b.block, false) as BlockSetting) : null,
    states: caps.states ? statesFromJson(r.states) : {},
    windows: (Array.isArray(windowsJson) ? windowsJson : windowsJson == null ? [] : bad()).map(windowFromJson),
  };
  if (caps.breakeven && r.breakeven !== undefined) out.breakeven = breakevenFromJson(r.breakeven);
  return out;
}""")

rep("""    out.limit = { cents: cents(l[key]), mode, atLimit };
  }
  return out;
}""", """    out.limit = { cents: cents(l[key]), mode, atLimit };
  }
  if (r.breakeven !== undefined) out.breakeven = breakevenFromJson(r.breakeven);
  return out;
}""")

rep("""    out.states = states;
  }
  return out;
}""", """    out.states = states;
  }
  if (caps.breakeven && s.breakeven) out.breakeven = breakevenJson(s.breakeven);
  return out;
}""")
rep("""  out.limit = s.limit && limitJson(m, s.limit);
  return out;
}""", """  out.limit = s.limit && limitJson(m, s.limit);
  if (MARKET_SPEC[m].rules.breakeven && s.breakeven) out.breakeven = breakevenJson(s.breakeven);
  return out;
}""")

rep("""  const mb = m.block ?? { on: true, beforeMin: 5, afterMin: 10 };
  return {
    market: account.market,""", """  const mb = m.block ?? { on: true, beforeMin: 5, afterMin: 10 };
  const breakeven = resolveBreakeven(account.market, effectiveBreakeven(s, account));
  return {
    market: account.market,""")
rep("""      : null,
    day: { tz: account.day.tz, startMin: account.day.startMin },
  };
}

/** Two rule values compare as the database compares two `resolved` jsonb values */""", """      : null,
    day: { tz: account.day.tz, startMin: account.day.startMin },
    ...(breakeven ? { breakeven } : {}),
  };
}

/**
 * The «Mover para o breakeven» an account uses: its own («só nesta conta», the whole setting),
 * else its market's; undefined when neither was ever set
 */
export function effectiveBreakeven(s: RulesSettings, account: Pick<RulesAccount, 'id' | 'market'>): BreakevenSetting | undefined {
  const own = s.accounts[account.id]?.breakeven;
  return own !== undefined ? own : s.markets[account.market].breakeven;
}

/**
 * What a setting resolves to in a version (SQL rules_resolve, Phase 3c): null unless the market
 * has the rule and the setting is on; each asset with the unit of stops trade_instrument gives it
 * now (frozen in the version) and «+N» without trailing zeros; an asset without a unit, or a value
 * that is not a number, is left out, and none left = null (no key).
 */
export function resolveBreakeven(market: AccountMarket, b: BreakevenSetting | undefined | null): BreakevenRule | null {
  if (!MARKET_SPEC[market].rules.breakeven || !b || b.on !== true) return null;
  const by: BreakevenRule['by'] = {};
  for (const [k, text] of Object.entries(b.by)) {
    const un = tradeInstrument(market, k, null)?.stops ?? null;
    const n = typeof text === 'string' ? parseNumeric(text) : null;
    if (un === null || !n) continue;
    by[k] = { n: plainText(n), un };
  }
  return Object.keys(by).length ? { by } : null;
}

/** The same setting, as the database compares two settings: «+N» by value ('10.0' = '10') */
export const sameBreakeven = (a: BreakevenSetting | undefined | null, b: BreakevenSetting | undefined | null) =>
  canon(a ? breakevenJson(a) : null) === canon(b ? breakevenJson(b) : null);

/** Two rule values compare as the database compares two `resolved` jsonb values */""")

rep("""export function withAccountRule(
  s: RulesSettings,
  account: Pick<RulesAccount, 'id' | 'market'>,
  patch: { windowRule?: Partial<WindowRuleSetting>; block?: Partial<BlockSetting> },
): RulesSettings {""", """export function withAccountRule(
  s: RulesSettings,
  account: Pick<RulesAccount, 'id' | 'market'>,
  patch: {
    windowRule?: Partial<WindowRuleSetting>;
    block?: Partial<BlockSetting>;
    /**
     * «Mover para o breakeven» «só nesta conta» (Phase 3c), the whole setting; null = back to the
     * market's. A setting that is the market's (a market never set counts as off with no asset)
     * is not kept as the account's own.
     */
    breakeven?: BreakevenSetting | null;
  },
): RulesSettings {""")
rep("""    if (v === undefined || (m.block && v === m.block[k])) delete block[k];
    else (block as Obj)[k] = v;
  }
  return { ...s, accounts: { ...s.accounts, [account.id]: { ...cur, windowRule, block } } };
}""", """    if (v === undefined || (m.block && v === m.block[k])) delete block[k];
    else (block as Obj)[k] = v;
  }
  const next: AccountSettings = { ...cur, windowRule, block };
  if (patch.breakeven !== undefined) {
    if (patch.breakeven === null || sameBreakeven(patch.breakeven, m.breakeven ?? BREAKEVEN_OFF)) delete next.breakeven;
    else next.breakeven = { on: patch.breakeven.on, by: { ...patch.breakeven.by } };
  }
  return { ...s, accounts: { ...s.accounts, [account.id]: next } };
}

/** A market whose «Mover para o breakeven» was never set reads as off, with no asset */
export const BREAKEVEN_OFF: Readonly<BreakevenSetting> = Object.freeze({ on: false, by: Object.freeze({}) as Record<string, string> });

/** Why a typed «+N» is refused: «Digite um número maior que zero, como 10 ou 7,5.» */
export type BreakevenNError = 'empty' | 'invalid' | 'not_positive' | 'too_large' | 'too_many_decimals';

/**
 * «+N» as typed (pt-BR, «7,5» or «7.5»; a threshold, not a price: no tick) → decimal text, as the
 * database takes it (rules_is_dist: above zero, at most 1 000 000, at most 8 decimals)
 */
export function readBreakevenN(text: string): { ok: true; n: string } | { ok: false; reason: BreakevenNError } {
  const r = lerNumero(text, { ponto: true });
  if (!r.ok) return { ok: false, reason: r.reason };
  const n = parseNumeric(r.value);
  if (!n || n.units <= BigInt(0)) return { ok: false, reason: 'not_positive' };
  if (n.scale > BREAKEVEN_N_DP) return { ok: false, reason: 'too_many_decimals' };
  if (Number(r.value) > MAX_BREAKEVEN_N) return { ok: false, reason: 'too_large' };
  return { ok: true, n: plainText(n) };
}

/** Why an asset cannot join the rule: «Escolha um ativo.», «Use só letras e números…», «Este ativo já está na regra.», «Use até 20 ativos.» */
export type BreakevenKeyError = 'empty' | 'invalid' | 'repeated' | 'too_many';

/**
 * The asset an «Adicionar ativo» names, as the rule keys it (tradeMatchKey: MESZ5 → MES, EUR/USD →
 * EURUSD, PETR4F → PETR4), with the refusals of the form; `current` is the rule's assets now
 */
export function breakevenKeyOf(
  market: AccountMarket,
  code: string,
  current: Readonly<Record<string, unknown>>,
): { ok: true; key: string } | { ok: false; reason: BreakevenKeyError } {
  const typed = String(code ?? '').trim();
  if (typed === '') return { ok: false, reason: 'empty' };
  if (!/^[A-Za-z0-9][A-Za-z0-9./:() _-]*$/.test(typed)) return { ok: false, reason: 'invalid' };
  const key = tradeInstrument(market, typed, null)?.key ?? '';
  if (!isBreakevenKey(market, key)) return { ok: false, reason: 'invalid' };
  if (Object.prototype.hasOwnProperty.call(current, key)) return { ok: false, reason: 'repeated' };
  if (Object.keys(current).length >= MAX_BREAKEVEN_ASSETS) return { ok: false, reason: 'too_many' };
  return { ok: true, key };
}""")
open(p, 'w').write(s)
print('ok')

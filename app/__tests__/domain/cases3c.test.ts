/**
 * @jest-environment node
 *
 * The shared cases of Phase 3c: every "expected" in cases3c.json was computed by the functions of
 * migrations 20261023000001..3 (fase-3c/banco) on a throwaway PG15 cluster, with the generator kept
 * outside the repo (it also re-asked the 3c trade_check_payload every Phase 3 shape case of
 * registro/cases.json: none changed). The TypeScript domain must give the same answer for the same
 * inputs: «+N» of the rule, the breakeven rule in a version and in the settings, what a setting
 * resolves to, the points in favour at a price, a trade's rule and its price, R over several
 * exits, a quantity with the instrument's decimals, and the payloads of «Registrar parcial» and
 * «Já fechada» in several exits, and the import's links of one file's new rows when a broker
 * position has several rows (import_stage; the generator also re-asked the 3c import_stage every
 * Phase 3 matching scenario: none changed). Sums, the limit per exit, «Desfazer» and the stop moves
 * need a database's rows: hubParciais.pg.test.ts and its recorded answers (hubParciais.test.ts).
 */
import raw from './cases3c.json';
import {
  ACCOUNT_MARKETS,
  checkBreakevenSetting,
  checkRules,
  isBreakevenN,
  parseRules,
  toResolvedJson,
  type AccountMarket,
} from '@/lib/domain/gate';
import {
  assignImportLinks,
  breakevenOf,
  checkPayload,
  decimalFromJson,
  favorOf,
  numericText,
  rOfExits,
  tradeInstrument,
  tradeQty,
  type Direction,
  type EntryOrigin,
  type MatchRow,
  type MatchTrade,
  type OptionContract,
  type PayloadMode,
} from '@/lib/domain/registro';
import { accountSettingsFromJson, marketSettingsFromJson, resolveRules, type MarketSettings, type RulesSettings } from '@/lib/hub/regras';

type Obj = Record<string, unknown>;
interface Group<C> {
  about: string;
  cases: C[];
}
interface Cases {
  builtin: Record<AccountMarket, unknown>;
  dist: Group<{ x: unknown; expected: boolean }>;
  qty: Group<{ market: string; symbol: string; option: OptionContract | null; x: unknown; expected: string | null }>;
  resolved: Group<{ label: string; json: unknown; expected: string | null }>;
  setting: Group<{ market: string; p: unknown; expected: string | null }>;
  resolve: Group<{ label: string; market: AccountMarket; day: { tz: string; start_min: number }; market_rules: unknown; own: unknown; expected: Obj }>;
  favor: Group<{ market: string; symbol: string; option: OptionContract | null; sgn: 1 | -1; entry: string; price: string; expected: string }>;
  tradeBreakeven: Group<{
    resolved: unknown;
    market: string | null;
    symbol: string;
    option: boolean;
    direction: Direction;
    entry: string | null;
    expected: { key: string; n: number; un: string; level: number | null } | null;
  }>;
  rOf: Group<{ label: string; entry: string; stop: string | null; sgn: 1 | -1; position: string; exits: { quantity: string; exit_price: string | null }[]; expected: string | null }>;
  shape: Group<{ label: string; mode: PayloadMode; market: string; dry: boolean; payload: unknown; platform: string | null; expected: { code: string; field: string | null } | null }>;
  positions: {
    about: string;
    scenarios: {
      label: string;
      market: string;
      trades: {
        id: string;
        symbol: string;
        direction: Direction;
        entry_time: string;
        origin: EntryOrigin | null;
        expires_at: string | null;
        quantity: string | null;
        stake: string | null;
        entry_price: string;
        eligible: boolean;
      }[];
      rows: {
        rn: number;
        line: number;
        symbol: string;
        direction: Direction;
        entry_time: string;
        exit_time: string | null;
        quantity: string | null;
        stake: string | null;
        entry_price: string;
        code: null;
      }[];
      expected: Record<string, string>;
    }[];
  };
}
const cases = raw as unknown as Cases;

describe('rules_is_dist (SQL) = isBreakevenN (TS): «+N»', () => {
  it.each(cases.dist.cases.map((c) => [JSON.stringify(c.x), c] as const))('%s', (_label, c) => {
    expect(isBreakevenN(c.x)).toBe(c.expected);
  });
});

describe('rules_check_resolved (SQL) = checkRules (TS): the optional tenth key', () => {
  it.each(cases.resolved.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    expect(checkRules(c.json)).toBe(c.expected);
    if (c.expected === null) expect(toResolvedJson(parseRules(c.json))).toEqual(c.json);
    else expect(() => parseRules(c.json)).toThrow(expect.objectContaining({ code: c.expected }));
  });
});

describe('rules_check_breakeven (SQL) = checkBreakevenSetting (TS)', () => {
  it.each(cases.setting.cases.map((c, i) => [`${i + 1} ${c.market} ${JSON.stringify(c.p)?.slice(0, 60)}`, c] as const))('%s', (_label, c) => {
    expect(checkBreakevenSetting(c.market, c.p)).toBe(c.expected);
  });
});

describe('rules_resolve (SQL) = resolveRules (TS), with the breakeven setting', () => {
  it.each(cases.resolve.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const markets = Object.fromEntries(
      ACCOUNT_MARKETS.map((m) => [m, marketSettingsFromJson(m, m === c.market ? c.market_rules : null, [], cases.builtin[m])]),
    ) as Record<AccountMarket, MarketSettings>;
    const settings: RulesSettings = {
      markets,
      accounts: { a: accountSettingsFromJson(c.market, c.own, null) },
      displayTz: 'et',
      calendars: ['us'],
    };
    const r = resolveRules({ id: 'a', market: c.market, day: { tz: c.day.tz, startMin: c.day.start_min } }, settings);
    expect(toResolvedJson(r)).toEqual(c.expected);
    // And the version it would store reads back as these rules
    expect(checkRules(c.expected)).toBeNull();
  });
});

describe('trade_favor (SQL) = favorOf (TS)', () => {
  it.each(cases.favor.cases.map((c) => [`${c.market} ${c.symbol} ${c.sgn > 0 ? 'long' : 'short'} ${c.entry} → ${c.price}`, c] as const))('%s', (_label, c) => {
    const spec = tradeInstrument(c.market, c.symbol, c.option);
    expect(favorOf(spec!, c.sgn, c.entry, c.price)).toBe(c.expected);
  });
});

describe('trade_breakeven (SQL) = breakevenOf (TS)', () => {
  it.each(cases.tradeBreakeven.cases.map((c, i) => [`${i + 1} ${c.market} ${c.symbol} ${c.direction}`, c] as const))('%s', (_label, c) => {
    const rules = parseRules(c.resolved);
    const want =
      c.expected && { key: c.expected.key, n: decimalFromJson(c.expected.n, 8), un: c.expected.un, level: c.expected.level === null ? null : decimalFromJson(c.expected.level, 8) };
    expect(breakevenOf(rules.breakeven, c.market, c.symbol, c.option, c.direction, c.entry)).toEqual(want);
  });
});

describe('trade_r_of (SQL) = rOfExits (TS)', () => {
  it.each(cases.rOf.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const exits = c.exits.map((x) => ({ quantity: x.quantity, exitPrice: x.exit_price }));
    expect(rOfExits(c.entry, c.stop, c.sgn, c.position, exits)).toBe(c.expected);
  });
});

describe("trade_check_payload (SQL) = checkPayload (TS): mode 'partial', «Já fechada» in several exits", () => {
  it('covers the new keys and refusals', () => {
    const codes = new Set(cases.shape.cases.map((c) => c.expected && `${c.expected.code}:${c.expected.field}`));
    for (const k of ['bad_payload:exits', 'unknown_key:exits', 'not_for_market:exits', 'bad_quantity:exits', 'bad_price:exits', 'bad_time:exits',
      'bad_pnl:exits', 'bad_costs:exits', 'bad_payload:breakeven', 'bad_price:breakeven', 'not_for_market:breakeven', 'bad_quantity:quantity',
      'unknown_key:null', null]) {
      expect(codes).toContain(k);
    }
  });

  it.each(cases.shape.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    expect(checkPayload(c.mode, c.market, c.payload, c.dry, c.platform)).toEqual(c.expected);
  });
});

describe('trade_qty (SQL) = tradeQty (TS): a quantity with the instrument\'s decimals', () => {
  it.each(cases.qty.cases.map((c) => [`${c.market} ${c.symbol} ${JSON.stringify(c.x)}`, c] as const))('%s', (_label, c) => {
    const q = tradeQty(tradeInstrument(c.market, c.symbol, c.option)!, c.x);
    expect(q && numericText(q)).toBe(c.expected);
  });
});

describe('import_stage (SQL) = assignImportLinks (TS): a broker position in several rows', () => {
  it('covers whole links, rows again and rows of their own', () => {
    const kinds = cases.positions.scenarios.map((s) => {
      const ids = Object.values(s.expected);
      return ids.length === 0 ? 'none' : new Set(ids).size < ids.length ? 'whole' : 'rows';
    });
    expect(new Set(kinds)).toEqual(new Set(['none', 'whole', 'rows']));
    expect(cases.positions.scenarios.some((s) => Object.keys(s.expected).length < s.rows.length && Object.keys(s.expected).length > 0)).toBe(true);
  });

  it.each(cases.positions.scenarios.map((s) => [s.label, s] as const))('%s', (_l, s) => {
    const rows: MatchRow[] = s.rows.map((r) => ({
      rn: r.rn,
      line: r.line,
      symbol: r.symbol,
      direction: r.direction,
      entryTime: new Date(r.entry_time),
      exitTime: r.exit_time === null ? null : new Date(r.exit_time),
      quantity: r.quantity,
      stake: r.stake,
      entryPrice: r.entry_price,
    }));
    const trades: MatchTrade[] = s.trades
      .filter((t) => t.eligible)
      .map((t) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryTime: new Date(t.entry_time),
        origin: t.origin!,
        expiresAt: t.expires_at === null ? null : new Date(t.expires_at),
        quantity: t.quantity,
        stake: t.stake,
        entryPrice: t.entry_price,
      }));
    const links = assignImportLinks(s.market, rows, trades);
    expect(Object.fromEntries(Array.from(links.entries()).map(([rn, id]) => [String(rn), id]))).toEqual(s.expected);
    // The input order never matters
    expect(assignImportLinks(s.market, [...rows].reverse(), [...trades].reverse())).toEqual(links);
  });
});

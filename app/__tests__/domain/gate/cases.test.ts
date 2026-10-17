/**
 * @jest-environment node
 *
 * The shared cases: every "expected" in cases.json was computed by the Phase 2 SQL (gate_eval,
 * limit_usage, trading_day_on, trading_day_for, rules_check_resolved). The TypeScript domain must
 * give the same answer for the same inputs. The rows marked "sql" are the inputs that
 * supabase/tests/30_phase2.test.sql asserts (§12 tests.gate_cases and tests.owner_cases; §13 for
 * the limit, with dates relative to now() there).
 */
import cases from './cases.json';
import {
  answerOf,
  checkRules,
  dayUsage,
  evaluateGate,
  gateTradingDay,
  parseRules,
  parseServerGate,
  toResolvedJson,
  usdToCents,
  type DayResult,
  type DayTrade,
  type GateAccount,
  type RuleVersion,
} from '@/lib/domain/gate';
import { tradingDay, tradingDayFor, tradingDayOn, type TradingWindow } from '@/lib/domain';

type Clock = { tz: string; start_min: number };
type WindowJson = { tz: string; start_min: number; end_min: number; weekdays: number };

const clockOf = (c: Clock) => ({ tz: c.tz, startMin: c.start_min });
const windowsOf = (ws: WindowJson[]): TradingWindow[] =>
  ws.map((w) => ({ tz: w.tz, startMin: w.start_min, endMin: w.end_min, weekdays: w.weekdays }));
const cents = (x: unknown) => {
  const c = usdToCents(x);
  if (c === null) throw new Error(`not money: ${String(x)}`);
  return c;
};

const trades: (DayTrade & { account: string })[] = cases.trades.rows.map((t) => ({
  id: t.id,
  account: t.account,
  tradingDay: t.trading_day,
  entryAt: new Date(t.entry_at),
  exitAt: t.exit_at === null ? null : new Date(t.exit_at),
  pnlCents: t.pnl === null ? null : cents(t.pnl),
  commissionCents: t.commission === null ? null : cents(t.commission),
  result: t.result,
}));
const FUTURES_ACCOUNTS = ['F1', 'F2'];
/**
 * With a version, gate_eval ignores the account clock it is given and uses the version's `day`.
 * The TS account then gets this clock, unlike any version's, so reading the account's clock where
 * the version's belongs changes the answer and fails the case.
 */
const DECOY_CLOCK = { tz: 'America/Sao_Paulo', startMin: 720 };

describe('gate_eval (SQL) = evaluateGate (TS)', () => {
  it('has the 46 rows the database test asserts', () => {
    expect(cases.gate.cases.filter((c) => c.sql).length).toBe(46);
  });

  it.each(cases.gate.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const at = new Date(c.at);
    const version: RuleVersion | null = c.resolved ? { rules: parseRules(c.resolved) } : null;
    // gate_eval reads p_clock only without a version (the SQL test passes '{}' with one)
    const clock = c.clock as Clock;
    const account: GateAccount = version
      ? { market: version.rules.market, dayClock: DECOY_CLOCK }
      : { market: clock.tz === 'America/Sao_Paulo' ? 'binary' : 'futures', dayClock: clockOf(clock) };
    const limit = version?.rules.limit ?? null;
    const usage = c.usage as { trades: number; net_usd: number; worst_usd: number; hit_at: string | null };
    // The usage was summed for this rule's limit, as gate_at does
    const day: DayResult = {
      tradingDay: gateTradingDay(at, account, version),
      until: at,
      trades: usage.trades,
      netCents: cents(usage.net_usd),
      worstCents: cents(usage.worst_usd),
      hit: usage.hit_at && limit ? { limitCents: limit.cents, at: new Date(usage.hit_at) } : null,
    };
    const ts = evaluateGate(at, account, version, day);
    expect(ts).toEqual(parseServerGate(c.expected));
    expect(() => answerOf(ts)).not.toThrow();
  });
});

describe('trading_day_on / trading_day_for (SQL) = tradingDayOn / tradingDayFor (TS)', () => {
  it.each(cases.tradingDay.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const at = new Date(c.at);
    const clock = clockOf(c.clock);
    if (c.fn === 'trading_day_on') {
      expect(tradingDayOn(at, clock)).toBe(c.expected);
      expect(tradingDay(at, c.clock.tz, { dayStartMin: c.clock.start_min })).toBe(c.expected);
      // With no window the unified day is the account's
      expect(tradingDayFor(at, clock, [])).toBe(c.expected);
    } else {
      expect(tradingDayFor(at, clock, windowsOf(c.windows as WindowJson[]))).toBe(c.expected);
    }
  });
});

describe('limit_usage (SQL) = dayUsage (TS)', () => {
  it.each(cases.limit.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const scope = trades.filter((t) => (c.soma ? FUTURES_ACCOUNTS.includes(t.account) : t.account === c.account));
    const until = new Date(c.until);
    const limitCents = c.usd === null ? null : cents(c.usd);
    const e = c.expected as { trades: number; net_usd: number; worst_usd: number; hit_at: string | null };
    const want = {
      tradingDay: c.day,
      until,
      trades: e.trades,
      netCents: cents(e.net_usd),
      worstCents: cents(e.worst_usd),
      hit: e.hit_at && limitCents ? { limitCents, at: new Date(e.hit_at) } : null,
    };
    // The rows come in id order: reversed, a tie left to the input order would come out wrong
    expect(dayUsage(scope, { tradingDay: c.day, until, limitCents })).toEqual(want);
    expect(dayUsage([...scope].reverse(), { tradingDay: c.day, until, limitCents })).toEqual(want);
  });
});

describe("gate_at's composition (SQL) = gateTradingDay + dayUsage + evaluateGate (TS)", () => {
  it.each(cases.gateAt.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const at = new Date(c.at);
    const rules = parseRules(c.resolved);
    const account: GateAccount = { market: rules.market, dayClock: DECOY_CLOCK };
    const version: RuleVersion = { rules };
    const scope = trades.filter((t) =>
      rules.limit?.mode === 'soma' ? FUTURES_ACCOUNTS.includes(t.account) : t.account === c.account,
    );
    const day = dayUsage(scope, {
      tradingDay: gateTradingDay(at, account, version),
      until: at,
      limitCents: rules.limit?.cents ?? null,
    });
    expect(evaluateGate(at, account, version, day)).toEqual(parseServerGate(c.expected));
  });
});

describe('rules_check_resolved (SQL) = checkRules (TS)', () => {
  it.each(cases.resolved.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const want = 'tsOnly' in c && c.tsOnly ? c.tsOnly : c.expected;
    expect(checkRules(c.json)).toBe(want);
    if (want === null) {
      // The parsed form goes back to the same jsonb
      expect(toResolvedJson(parseRules(c.json))).toEqual(c.json);
    } else {
      expect(() => parseRules(c.json)).toThrow(expect.objectContaining({ code: want }));
    }
  });
});

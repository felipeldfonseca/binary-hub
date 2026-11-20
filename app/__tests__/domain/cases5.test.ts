/**
 * @jest-environment node
 *
 * The shared cases of Phase 5-1 («Dados econômicos»): every "expected" in cases5.json was computed
 * by the functions of migration 20261120000001_dados_economicos.sql (fase-5/banco) on a throwaway
 * PG15 cluster, with the generator kept outside the repo (.claude/backup-fase5/gen5: `bash
 * gerar.sh <worktree with the migration> <out-dir>`, then copy <out-dir>/cases5.json here and
 * <out-dir>/gate-cases.json to gate/cases.json; BH_PORT a free port; deterministic, so an
 * unchanged SQL re-records the same files). Change the SQL and the TypeScript together, then
 * re-record.
 *
 * The TypeScript twins must give the same answer for the same inputs: the release list
 * (AGENDA_RELEASES = agenda_releases()), a block's effective map (releasesOf = block_releases),
 * the resolved `releases` (resolveBlockReleases = rules_resolve's releases part), the agenda read
 * for an instant (agendaFor = gate_agenda), the intervals, today, active and free_at of the
 * evaluated block (evaluateGate / blockIntervals / freeAtOf = the 5-argument gate_eval), the
 * whole answer with its agenda input (§5.1's rows and the §5.4 cells) and the entry context of a
 * gate answer (toEntryContext + entryPlanOf = trade_context_from_gate + trade_entry_plan).
 */
import raw from './cases5.json';
import {
  AGENDA_RELEASES,
  agendaFor,
  answerOf,
  blockIntervals,
  checkRules,
  evaluateGate,
  freeAtHorizon,
  freeAtOf,
  gateTradingDay,
  MARKET_SPEC,
  parseRules,
  parseServerGate,
  releasesOf,
  resolveBlockReleases,
  usdToCents,
  type AccountMarket,
  type AgendaEntry,
  type AgendaRow,
  type BlockCheck,
  type BlockInterval,
  type CalendarCode,
  type DayResult,
  type GateAccount,
  type GateResult,
  type ReleaseCode,
  type ReleaseMode,
  type RuleVersion,
  type Rules,
  type WaitMode,
} from '@/lib/domain/gate';
import { toEntryContext, type PlanResult } from '@/lib/domain/gate/plan';
import { entryPlanOf } from '@/lib/domain/registro/marcas';
import { tradingDayBounds, tradingDayOn } from '@/lib/domain/tempo';

type Json = Record<string, unknown>;
type Clock = { tz: string; start_min: number };
type Usage = { trades: number; net_usd: number; worst_usd: number; hit_at: string | null };
type ReleasesJson = Partial<Record<ReleaseCode, ReleaseMode>>;

/* The JSON is read through loose shapes: each group's keys are those the generator writes */
const cases = raw as unknown as {
  releases: { list: { code: string; calendar: string; in_list_a: boolean; ord: number }[]; cases: { label: string; block: Json | null; expected: Json | null }[] };
  resolve: { cases: { label: string; market: string; market_rules: Json | null; own: Json; calendars: string[] | null; expected: Json | null }[] };
  agenda: {
    fixture: {
      events: { code: string | null; calendar: string; at: string; was_at: string | null; status: string; day: string; local_tz: string }[];
      coverage: { calendar: string; day: string }[];
    };
    cases: { label: string; at: string; resolved: Json | null; clock: Clock; expected: { code: string; at: string }[] | null }[];
  };
  intervalos: { cases: { label: string; at: string; resolved: Json; agenda: { code: string; at: string }[]; expected: Json }[] };
  gate: { cases: { label: string; at: string; resolved: Json | null; clock: Clock | Json; usage: Usage | null; agenda: { code: string; at: string }[] | null; expected: Json }[] };
  free_at: { cases: { label: string; at: string; resolved: Json; agenda: { code: string; at: string }[]; expected: { block: Json; changes_at: string | null } }[] };
  contexto: { cases: { label: string; gate: Json; expected: { context: Json; plan: Json } }[] };
};

/** Postgres writes a timestamptz in UTC as "2027-01-13T13:30:00+00:00" (the cases have no fractions) */
const pg = (d: Date | null) => (d === null ? null : d.toISOString().replace(/\.000Z$/, '+00:00'));
const agendaOf = (xs: { code: string; at: string }[]): AgendaEntry[] => xs.map((x) => ({ code: x.code as ReleaseCode, at: new Date(x.at) }));
const intervalJson = (iv: BlockInterval) => ({
  kind: iv.kind,
  start: pg(iv.start),
  end: pg(iv.end),
  releases: iv.releases.map((r) => ({ code: r.code, at: pg(r.at), mode: r.mode })),
});
/** The block as gate_eval writes it */
function blockJson(b: BlockCheck): Json {
  if (!b.evaluated) return { state: b.state, reason: b.reason };
  return { state: b.state, active: b.active && intervalJson(b.active), today: b.today.map(intervalJson), free_at: pg(b.freeAt) };
}
const cents = (x: unknown) => {
  const c = usdToCents(x);
  if (c === null) throw new Error(`not money: ${String(x)}`);
  return c;
};
/**
 * With a version, gate_eval ignores the clock it is given and uses the version's `day`; the TS
 * account then gets a clock unlike any version's, so reading it where the version's belongs fails.
 */
const DECOY_CLOCK = { tz: 'America/Sao_Paulo', startMin: 720 };

/**
 * gate_eval is pure and does not validate its input: a few cases hand it a block no version could
 * store (row 3: `on` false with a code of a calendar not followed, which rules_check_resolved
 * refuses with bad_releases). Those are parsed without their map, which is then put back as given.
 */
function rulesOf(resolved: Json): Rules {
  if (checkRules(resolved) === null) return parseRules(resolved);
  const block = resolved.block as Json;
  const rest: Json = { ...block };
  delete rest.releases;
  const rules = parseRules({ ...resolved, block: rest });
  return { ...rules, block: { ...rules.block!, releases: block.releases as Partial<Record<ReleaseCode, WaitMode>> } };
}

/** gate_eval(resolved, clock, at, usage, agenda) through evaluateGate */
function gate(at: Date, resolved: Json | null, clock: Clock | Json, usage: Usage | null, agenda: AgendaEntry[] | null): GateResult {
  const version: RuleVersion | null = resolved ? { rules: rulesOf(resolved) } : null;
  const c = clock as Clock;
  const account: GateAccount = version
    ? { market: version.rules.market, dayClock: DECOY_CLOCK }
    : { market: 'futures', dayClock: { tz: c.tz, startMin: c.start_min } };
  const limit = version?.rules.limit ?? null;
  const day: DayResult | null = usage && {
    tradingDay: gateTradingDay(at, account, version),
    until: at,
    trades: usage.trades,
    netCents: cents(usage.net_usd),
    worstCents: cents(usage.worst_usd),
    hit: usage.hit_at && limit ? { limitCents: limit.cents, at: new Date(usage.hit_at) } : null,
  };
  return evaluateGate(at, account, version, day, { agenda });
}

describe('releases: agenda_releases() = AGENDA_RELEASES, block_releases = releasesOf', () => {
  it('the 20 codes in ord order, with their calendar and LISTA_A_V1', () => {
    expect(AGENDA_RELEASES.map((r) => ({ code: r.code, calendar: r.calendar, in_list_a: r.inListA, ord: r.ord }))).toEqual(
      cases.releases.list,
    );
  });

  it.each(cases.releases.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const block =
      c.block === null
        ? null
        : {
            on: c.block.on as boolean,
            beforeMin: c.block.before_min as number,
            afterMin: c.block.after_min as number,
            calendars: c.block.calendars as CalendarCode[],
            ...(c.block.releases ? { releases: c.block.releases as Partial<Record<ReleaseCode, 'volta' | 'depois' | 'dia'>> } : {}),
          };
    expect(releasesOf(block)).toEqual(c.expected);
  });
});

describe("resolve: rules_resolve's releases = resolveBlockReleases", () => {
  it.each(cases.resolve.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    if (c.expected === null) {
      // No block outside futures: nothing to resolve
      expect(MARKET_SPEC[c.market as AccountMarket].rules.block).toBe(false);
      return;
    }
    const releasesIn = (j: Json | null) => ((j?.block as Json | null | undefined)?.releases as ReleasesJson | undefined) ?? undefined;
    // The calendars as rules_resolve normalised them (null → ["us"]) are the expected block's
    const calendars = c.expected.calendars as CalendarCode[];
    expect(resolveBlockReleases(releasesIn(c.market_rules), releasesIn(c.own), calendars)).toEqual(c.expected.releases);
  });
});

describe('agenda: gate_agenda = agendaFor', () => {
  const { fixture } = cases.agenda;
  const read = {
    rows: fixture.events.map(
      (e): AgendaRow => ({
        code: e.code as ReleaseCode | null,
        calendar: e.calendar as CalendarCode,
        at: new Date(e.at),
        wasAt: e.was_at === null ? null : new Date(e.was_at),
        status: e.status as AgendaRow['status'],
        day: e.day,
        localTz: e.local_tz,
      }),
    ),
    covered: fixture.coverage.map((c) => ({ calendar: c.calendar as CalendarCode, day: c.day })),
  };

  it.each(cases.agenda.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const resolved = c.resolved ? parseRules(c.resolved) : null;
    const got = agendaFor(resolved, { tz: c.clock.tz, startMin: c.clock.start_min }, new Date(c.at), read);
    expect(got && got.map((e) => ({ code: e.code, at: pg(e.at) }))).toEqual(c.expected);
    // The rows' order does not matter
    const reversed = agendaFor(resolved, { tz: c.clock.tz, startMin: c.clock.start_min }, new Date(c.at), {
      rows: [...read.rows].reverse(),
      covered: [...read.covered].reverse(),
    });
    expect(reversed).toEqual(got);
  });
});

describe("intervalos: gate_eval's block (R1–R17) = evaluateGate / blockIntervals / freeAtOf", () => {
  it.each(cases.intervalos.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const at = new Date(c.at);
    const agenda = agendaOf(c.agenda);
    const g = gate(at, c.resolved, {}, null, agenda);
    expect(blockJson(g.block)).toEqual(c.expected);
    // The exported pieces give the same block
    if (g.block.evaluated) {
      const rules = parseRules(c.resolved);
      const all = blockIntervals(rules, rules.day, [...agenda].reverse(), at);
      const day = tradingDayBounds(tradingDayOn(at, rules.day), rules.day);
      expect(all.filter((iv) => iv.start < day.end && iv.end > day.start)).toEqual(g.block.today);
      const horizon = freeAtHorizon(at, rules.day, rules.block!.beforeMin);
      expect(freeAtOf(all, at, horizon)).toEqual(g.block.freeAt);
    }
  });
});

describe('gate: the whole gate_eval answer (§5.1 rows, §5.4 cells) = evaluateGate', () => {
  it.each(cases.gate.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const g = gate(new Date(c.at), c.resolved, c.clock, c.usage, c.agenda === null ? null : agendaOf(c.agenda));
    expect(g).toEqual(parseServerGate(c.expected));
    expect(answerOf(g)).toEqual(answerOf(parseServerGate(c.expected)));
  });

  it('never answers fase5 for the block', () => {
    for (const c of cases.gate.cases) {
      const g = gate(new Date(c.at), c.resolved, c.clock, c.usage, c.agenda === null ? null : agendaOf(c.agenda));
      expect(!g.block.evaluated && g.block.reason === 'fase5').toBe(false);
    }
  });
});

describe('free_at: the walk to the horizon, and changes_at = evaluateGate', () => {
  it.each(cases.free_at.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const g = gate(new Date(c.at), c.resolved, {}, null, agendaOf(c.agenda));
    expect({ block: blockJson(g.block), changes_at: pg(g.changesAt) }).toEqual(c.expected);
  });
});

describe('contexto: trade_context_from_gate + trade_entry_plan = toEntryContext + entryPlanOf', () => {
  it.each(cases.contexto.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const g = parseServerGate(c.gate);
    const plan = { gate: g, stateRule: { evaluated: false, state: 'nao_avaliado', reason: 'fase5' }, checksEvaluated: g.checksEvaluated } as unknown as PlanResult;
    const ctx = toEntryContext(plan);
    const day = (x: number | null) => (x === null ? null : x / 100);
    expect({
      gate_status: ctx.gate,
      in_window: ctx.in_window,
      in_block: ctx.in_block,
      after_limit: ctx.after_limit,
      day_pnl_at_entry: day(ctx.day_pnl_at_entry_cents),
      day_worst_at_entry: day(ctx.day_worst_at_entry_cents),
      state_choice: ctx.state_choice,
      rule_ok: ctx.rule_ok,
      checks_evaluated: ctx.checks_evaluated,
      warnings: g.warnings,
    }).toEqual(c.expected.context);
    const p = entryPlanOf({
      inWindow: ctx.in_window,
      inBlock: ctx.in_block,
      afterLimit: ctx.after_limit,
      ruleOk: ctx.rule_ok,
      checksEvaluated: ctx.checks_evaluated,
    });
    expect({ breaks: p.breaks, verdict: p.verdict, checks_evaluated: p.checksEvaluated }).toEqual(c.expected.plan);
  });
});

describe('the inputs', () => {
  it('every version handed to gate_eval is storable (rules_check_resolved = null), but §5.1 row 3', () => {
    const all = [...cases.intervalos.cases, ...cases.gate.cases, ...cases.free_at.cases];
    const bad = all.filter((c) => c.resolved !== null && checkRules(c.resolved) !== null).map((c) => c.label);
    expect(bad).toEqual(['§5.1 row 3: off → regra_desligada']);
  });
});

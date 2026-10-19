/**
 * @jest-environment node
 *
 * The shared cases: every "expected" in cases.json was computed by the functions and views of the
 * Phase 3 migrations (20261020000001..4 of fase-3/banco) on a throwaway PG15 cluster, with the
 * generator kept outside the repo. The TypeScript domain must give the same answer for the same
 * inputs, to the code and field of a refusal and to the scale of an amount.
 */
import raw from './cases.json';
import {
  INSTRUMENT_SPEC,
  TRADE_CAPS,
  assignImportLinks,
  binaryExpiry,
  binaryResult,
  checkPayload,
  entryPreview,
  instrumentJson,
  instrumentSpecsJson,
  isClean,
  linkPatch,
  marksNow,
  parseEntry,
  parseExit,
  rMultiple,
  resultKnownAt,
  similarImports,
  tradeCapsJson,
  tradeInstrument,
  tradeMatchKey,
  type Direction,
  type EntryOrigin,
  type EntryPayload,
  type LinkRow,
  type LinkTrade,
  type MarkEvent,
  type MarkKind,
  type MarkTiming,
  type MatchRow,
  type MatchTrade,
  type Outcome,
  type PayloadMode,
} from '@/lib/domain/registro';
import { div, numeric, numericText, round } from '@/lib/domain/registro/numeric';
import { ACCOUNT_MARKETS, MARKET_SPEC, firstLocalHmAtOrAfter, localHmInTradingDay, resolveLocalHm, tradingDayOn, type AccountMarket } from '@/lib/domain';

type Obj = Record<string, unknown>;
interface Group<C> {
  about: string;
  cases: C[];
}
interface Cases {
  descriptors: { trade_caps_all: Obj; instrument_specs: Obj };
  matchKey: Group<{ market: string; symbol: string | null; expected: string }>;
  instrument: Group<{ market: string; symbol: string; option?: Obj; expected: Obj | null }>;
  shape: Group<{ label: string; mode: PayloadMode; market: string; dry: boolean; payload: unknown; expected: { code: string; field: string | null } | null }>;
  entry: Group<{ label: string; market: string; payload: Obj; expected: Obj & { ok: boolean } }>;
  exit: Group<{
    label: string;
    market: string;
    symbol: string;
    direction: Direction;
    quantity: string;
    entry_price: string | null;
    commission: string | null;
    stop_price: string | null;
    option?: Obj;
    stake?: string;
    payout?: string;
    payload: Obj;
    expected: Obj & { ok: boolean };
  }>;
  division: Group<{ a: string; b: string; expected: { q: string; r2: string; r4: string } }>;
  expiry: Group<{ platform: string | null; entry: string; duration: number; expected: string }>;
  hmResolve: Group<{ hm: string; tz: string; at: string; expected: string }>;
  exitAfter: Group<{ entry: string; hm: string; tz: string; expected: string }>;
  localInDay: Group<{ market: AccountMarket; day: string; hm: string; tz: string; expected: string | null }>;
  limpa: {
    trades: { id: string; label: string; origin: 'live' | 'reconstructed' | null; entry: string; exit: string | null; expires: string | null; exitReg: string | null }[];
    marks: { id: number; trade: string; kind: MarkKind; value: string | null; at: string; expected: { id: number; limpa: boolean; result_known_at: string | null } }[];
    now: {
      trade: string;
      kind: MarkKind;
      current_value: string | null;
      current_at: string;
      current_limpa: boolean;
      clean_value: string | null;
      clean_at: string | null;
      changed_after: boolean;
    }[];
  };
  matching: {
    scenarios: {
      label: string;
      market: string;
      trades: {
        id: string;
        symbol: string;
        direction: Direction;
        entry_time: string;
        origin: EntryOrigin;
        expires_at: string | null;
        quantity: string | null;
        stake: string | null;
        eligible: boolean;
      }[];
      rows: { rn: number; line: number; symbol: string; direction: Direction; entry_time: string; exit_time: string | null; quantity: string | null; stake: string | null; code: string | null }[];
      expected: Record<string, string>;
    }[];
  };
  similar: {
    trades: { market: string; id: string; symbol: string; direction: Direction; entry_time: string; imported: boolean }[];
    cases: { market: string; symbol: string; direction: Direction; entry: string; reconstructed: boolean; expected: string[] }[];
  };
  linkPatch: {
    now: string;
    cases: {
      label: string;
      platform: string;
      trade: Record<keyof LinkValuesJson, string | null> & { external_id: string | null; status: 'open' | 'closed'; entry_time: string };
      row: Record<keyof LinkValuesJson, string | null> & { external_id: string; exit_time: string | null };
      expected: { set: Record<string, string | null>; differs: string[]; closes: boolean; set_key: boolean };
    }[];
  };
}
type LinkValuesJson = Omit<LinkTrade, 'externalId' | 'status' | 'entryTime'>;
const cases = raw as unknown as Cases;

const iso = (x: string | null) => (x === null ? null : new Date(x).toISOString());
const date = (x: string | null) => (x === null ? null : new Date(x));

describe('the descriptors (trade_caps_all, instrument_specs) = TRADE_CAPS, INSTRUMENT_SPEC', () => {
  it('holds the same markets and values', () => {
    expect(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])]))).toEqual(cases.descriptors.trade_caps_all);
    expect(instrumentSpecsJson()).toEqual(cases.descriptors.instrument_specs);
    expect(Object.keys(INSTRUMENT_SPEC).sort()).toEqual(['b3', 'forex', 'futures']);
  });
});

describe('trade_match_key (SQL) = tradeMatchKey (TS)', () => {
  it.each(cases.matchKey.cases.map((c) => [c.market, c.symbol, c.expected] as const))('%s %j → %j', (market, symbol, expected) => {
    expect(tradeMatchKey(market, symbol)).toBe(expected);
  });
});

describe('trade_instrument (SQL) = tradeInstrument (TS)', () => {
  it.each(cases.instrument.cases.map((c) => [`${c.market} ${c.symbol}${c.option ? ' + option' : ''}`, c] as const))('%s', (_l, c) => {
    const spec = tradeInstrument(c.market, c.symbol, (c.option as never) ?? null);
    expect(spec === null ? null : instrumentJson(spec)).toEqual(c.expected);
  });
});

describe('trade_check_payload (SQL) = checkPayload (TS)', () => {
  it('covers every refusal of the shape', () => {
    const codes = new Set(cases.shape.cases.map((c) => c.expected?.code ?? null));
    for (const code of ['not_for_market', 'bad_payload', 'payload_too_large', 'bad_rules_version', 'unknown_key', 'bad_client_key', 'bad_symbol',
      'bad_direction', 'bad_stake', 'bad_payout', 'bad_duration', 'bad_quantity', 'bad_price', 'bad_stop', 'bad_target', 'bad_option',
      'bad_time', 'bad_day', 'bad_clock', 'bad_outcome', 'bad_pnl', 'bad_costs', 'bad_mark', null]) {
      expect(codes).toContain(code);
    }
  });

  it.each(cases.shape.cases.map((c) => [`${c.mode} · ${c.market} · ${c.label}`, c] as const))('%s', (_l, c) => {
    expect(checkPayload(c.mode, c.market, c.payload, c.dry)).toEqual(c.expected);
  });
});

describe('trade_parse_entry and trade_preview (SQL) = parseEntry and entryPreview (TS)', () => {
  it.each(cases.entry.cases.map((c) => [`${c.market} · ${c.label}`, c] as const))('%s', (_l, c) => {
    const shape = checkPayload('entry', c.market, c.payload, true);
    if (shape) {
      expect({ ok: false, ...shape }).toEqual(c.expected);
      return;
    }
    const r = parseEntry(c.market, c.payload as unknown as EntryPayload);
    if (!r.ok) {
      expect({ ok: false, code: r.code, field: r.field }).toEqual(c.expected);
      return;
    }
    const e = r.entry;
    const p = entryPreview(e);
    const want = c.expected;
    expect({
      ok: true,
      symbol: e.symbol,
      direction: e.direction,
      sgn: e.sgn,
      quantity: e.quantity,
      entry_price: e.entryPrice,
      stop_price: e.stopPrice,
      target_price: e.targetPrice,
      stake: e.stake,
      payout: e.payout,
      duration: e.durationS,
      option: e.option && { right: e.option.right, strike: e.option.strike, expires_on: e.option.expiresOn, multiplier: e.option.multiplier },
      instrument: instrumentJson(e.spec),
      preview:
        p.kind === 'outcome'
          ? { if_win: p.ifWin, if_loss: p.ifLoss }
          : { risk: p.risk, reward: p.reward, stop_points: p.stopPoints, target_points: p.targetPoints },
    }).toEqual(want);
  });
});

describe('trade_parse_exit / trade_binary_result (SQL) = parseExit / binaryResult (TS)', () => {
  it.each(cases.exit.cases.map((c) => [`${c.market} · ${c.label}`, c] as const))('%s', (_l, c) => {
    const shape = checkPayload('exit', c.market, c.payload, false);
    if (shape) {
      expect({ ok: false, ...shape }).toEqual(c.expected);
      return;
    }
    if (c.market === 'binary') {
      const b = binaryResult(c.stake as string, c.payout as string, c.payload.outcome as Outcome);
      expect({ ok: true, pnl: b.pnl, result: b.result }).toEqual(c.expected);
      return;
    }
    const spec = tradeInstrument(c.market, c.symbol, (c.option as never) ?? null)!;
    const sgn = c.direction === 'long' || c.direction === 'call' ? 1 : -1;
    const x = parseExit(spec, c.payload, sgn, c.quantity, c.entry_price as string, c.commission);
    if (!x.ok) {
      expect({ ok: false, code: x.code, field: x.field }).toEqual(c.expected);
      return;
    }
    expect({
      ok: true,
      exit_price: x.exitPrice,
      pnl: x.pnl,
      pnl_basis: x.pnlBasis,
      result: x.result,
      commission: x.commission,
      points: x.points,
      r: rMultiple(x.points, c.entry_price, c.stop_price),
    }).toEqual(c.expected);
  });
});

describe('numeric division (SQL) = div (TS): the scale Postgres picks, then round', () => {
  it.each(cases.division.cases.map((c) => [c.a, c.b, c.expected] as const))('%s / %s', (a, b, want) => {
    const q = div(numeric(a), numeric(b));
    expect({ q: numericText(q), r2: numericText(round(q, 2)), r4: numericText(round(q, 4)) }).toEqual(want);
  });
});

describe('trade_expiry (SQL) = binaryExpiry (TS)', () => {
  it.each(cases.expiry.cases.map((c) => [c.platform, c.entry, c.duration, c.expected] as const))('%j, %s, %i s', (platform, entry, duration, want) => {
    expect(binaryExpiry(platform, new Date(entry), duration).toISOString()).toBe(iso(want));
  });
});

describe('trade_hm_resolve / trade_exit_after / trade_local_in_day (SQL) = tempo (TS)', () => {
  it.each(cases.hmResolve.cases.map((c) => [c.hm, c.tz, c.at, c.expected] as const))('%s on %s near %s', (hm, tz, at, want) => {
    expect(resolveLocalHm(hm, tz, new Date(at)).toISOString()).toBe(iso(want));
  });

  it.each(cases.exitAfter.cases.map((c) => [c.hm, c.tz, c.entry, c.expected] as const))('%s on %s at or after %s', (hm, tz, entry, want) => {
    expect(firstLocalHmAtOrAfter(new Date(entry), hm, tz).toISOString()).toBe(iso(want));
  });

  it.each(cases.localInDay.cases.map((c) => [c.market, c.day, c.hm, c.tz, c.expected] as const))('%s: day %s, %s on %s', (market, day, hm, tz, want) => {
    const at = localHmInTradingDay(day, hm, tz, (d) => tradingDayOn(d, MARKET_SPEC[market].day));
    expect(at && at.toISOString()).toBe(iso(want));
  });
});

describe('trade_marks_v / trade_marks_now_v (SQL) = isClean / marksNow (TS)', () => {
  const timing = (id: string): MarkTiming => {
    const t = cases.limpa.trades.find((x) => x.id === id)!;
    return { origin: t.origin, exitTime: date(t.exit), expiresAt: date(t.expires), exitRegisteredAt: date(t.exitReg) };
  };

  it.each(cases.limpa.marks.map((m) => [cases.limpa.trades.find((t) => t.id === m.trade)!.label, m] as const))('%s: %j', (_l, m) => {
    const t = timing(m.trade);
    expect(isClean(new Date(m.at), t)).toBe(m.expected.limpa);
    const known = resultKnownAt(t.exitTime, t.expiresAt);
    expect(known && known.toISOString()).toBe(iso(m.expected.result_known_at));
  });

  it.each(cases.limpa.trades.map((t) => [t.label, t] as const))('%s: the current mark and the one that counts', (_l, t) => {
    const events: MarkEvent[] = cases.limpa.marks
      .filter((m) => m.trade === t.id)
      .map((m) => ({ id: m.id, kind: m.kind, value: m.value, markedAt: new Date(m.at), limpa: m.expected.limpa }));
    const want = cases.limpa.now
      .filter((n) => n.trade === t.id)
      .map((n) => ({
        kind: n.kind,
        currentValue: n.current_value,
        currentAt: new Date(n.current_at),
        currentLimpa: n.current_limpa,
        cleanValue: n.clean_value,
        cleanAt: date(n.clean_at),
        changedAfter: n.changed_after,
      }));
    // trade_state lists them by kind; the view's own order is per trade and kind
    expect(marksNow(events)).toEqual([...want].sort((a, b) => (a.kind < b.kind ? -1 : 1)));
    expect(marksNow([...events].reverse())).toEqual(marksNow(events));
  });
});

describe('import_stage (SQL) = assignImportLinks (TS)', () => {
  it.each(cases.matching.scenarios.map((s) => [s.label, s] as const))('%s', (_l, s) => {
    const rows: MatchRow[] = s.rows
      .filter((r) => r.code === null)
      .map((r) => ({
        rn: r.rn,
        line: r.line,
        symbol: r.symbol,
        direction: r.direction,
        entryTime: new Date(r.entry_time),
        exitTime: date(r.exit_time),
        quantity: r.quantity,
        stake: r.stake,
      }));
    const trades: MatchTrade[] = s.trades
      .filter((t) => t.eligible)
      .map((t) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryTime: new Date(t.entry_time),
        origin: t.origin,
        expiresAt: date(t.expires_at),
        quantity: t.quantity,
        stake: t.stake,
      }));
    const links = assignImportLinks(s.market, rows, trades);
    expect(Object.fromEntries(Array.from(links.entries()).map(([rn, id]) => [String(rn), id]))).toEqual(s.expected);
    // The input order never matters
    expect(assignImportLinks(s.market, [...rows].reverse(), [...trades].reverse())).toEqual(links);
  });
});

describe('trade_similar (SQL) = similarImports (TS)', () => {
  const importedOf = (market: string) =>
    cases.similar.trades
      .filter((t) => t.imported && t.market === market)
      .map((t) => ({ id: t.id, symbol: t.symbol, direction: t.direction, entryTime: new Date(t.entry_time) }));

  it.each(cases.similar.cases.map((c) => [`${c.market} ${c.symbol} ${c.direction} at ${c.entry}${c.reconstructed ? ' («Já fechada»)' : ''}`, c] as const))(
    '%s',
    (_l, c) => {
      const entry = { symbol: c.symbol, direction: c.direction, entryTime: new Date(c.entry) };
      const imported = importedOf(c.market);
      expect(similarImports(c.market, entry, imported, c.reconstructed)).toEqual(c.expected);
      expect(similarImports(c.market, entry, [...imported].reverse(), c.reconstructed)).toEqual(c.expected);
    },
  );
});

describe('import_link_patch (SQL) = linkPatch (TS)', () => {
  const now = new Date(cases.linkPatch.now);
  const values = (x: Record<keyof LinkValuesJson, string | null>) => ({
    entry_price: x.entry_price,
    quantity: x.quantity,
    stake_amount: x.stake_amount,
    payout_percent: x.payout_percent,
    commission: x.commission,
    exit_price: x.exit_price,
    pnl: x.pnl,
    result: x.result,
  });

  it.each(cases.linkPatch.cases.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    const trade: LinkTrade = { ...values(c.trade), externalId: c.trade.external_id, status: c.trade.status, entryTime: new Date(c.trade.entry_time) };
    const row: LinkRow = { ...values(c.row), externalId: c.row.external_id, exitTime: date(c.row.exit_time) };
    const p = linkPatch(trade, row, c.platform, now);
    const { exit_time: exitTime, ...set } = p.set;
    const { exit_time: wantExit, ...wantSet } = c.expected.set;
    expect({ set, differs: p.differs, closes: p.closes, set_key: p.setKey }).toEqual({ ...c.expected, set: wantSet });
    expect(exitTime === undefined ? undefined : exitTime.toISOString()).toBe(wantExit === undefined ? undefined : iso(wantExit));
  });
});

/**
 * @jest-environment node
 *
 * «Registrar operação» against the real SQL (migrations 20261020000001..4, fase-3/banco), on a
 * throwaway local Postgres. Skipped unless BH_PG_URL points at one: never the hosted project.
 *
 *   # a cluster with the Supabase stub and every migration, as supabase/tests/run.sh builds it
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres npx jest --ci __tests__/lib/hubRegistrar.pg.test.ts
 *
 * The wrappers of lib/hub/registrarDb run through a stand-in client that sends each rpc to the
 * database as the signed-in user (PostgREST's named arguments), so the payload builders, the
 * answer parsers and the error mapping meet the real functions. Every answer is compared with what
 * the domain (lib/domain/registro) computes on the server's own clock (the answer's server_now):
 * the same instants, levels, results and refusals.
 *
 * The fixtures in testing/fixtures/registrar are recorded here (BH_PG_RECORD=<dir>).
 */
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INSTRUMENT_SPEC,
  TRADE_CAPS,
  afterPayload,
  binaryExpiry,
  entryPayload,
  entryPreview,
  exitPayload,
  extrasPayload,
  imageSlotsRequest,
  instrumentJson,
  instrumentSpecsJson,
  isClean,
  marksNow,
  marksPayload,
  tradeCapsJson,
  undoRefusal,
  validateAfter,
  validateEntry,
  validateExit,
  type EntryFields,
  type OpenTrade,
} from '@/lib/domain/registro';
import { ACCOUNT_MARKETS, MARKET_SPEC, formatHhMm, tradingDayFor, utcToLocal, type AccountMarket } from '@/lib/domain';
import {
  addMarks,
  fetchOpenTrades,
  fetchTradeState,
  imageSlots,
  imageTrashDone,
  newClientKey,
  previewAfter,
  previewEntry,
  previewExit,
  registerAfter,
  registerEntry,
  registerExit,
  saveExtras,
  undoEntry,
  RegistrarDataError,
  type TradeState,
} from '@/lib/hub/registrarDb';
import { PG_URL, asUser, asUserExec, createAccountAsUser, lit, psql } from '@/testing/pg';

const PSQL = process.env.BH_PSQL || '/opt/homebrew/opt/postgresql@15/bin/psql';
const RECORD = process.env.BH_PG_RECORD;
const NY = 'America/New_York' as const;
const SP = 'America/Sao_Paulo' as const;

const describePg = PG_URL ? describe : describe.skip;

type Answer = { data: unknown; error: unknown };

/** One statement as the signed-in user: { data } or { error } with the message and HINT, as PostgREST gives them */
function callAs(uid: string, expr: string): Answer {
  try {
    const out = execFileSync(PSQL, [PG_URL as string, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'], {
      input: `begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
select 'json:' || coalesce((${expr})::text, 'null');
commit;`,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C', PGOPTIONS: '-c timezone=UTC' },
    }).toString();
    const line = out.split('\n').find((l) => l.startsWith('json:'));
    return { data: line ? JSON.parse(line.slice(5)) : null, error: null };
  } catch (e) {
    const stderr = String((e as { stderr?: Buffer }).stderr ?? '');
    const m = /ERROR:\s+(.+)/.exec(stderr);
    const h = /HINT:\s+(.+)/.exec(stderr);
    return { data: null, error: { message: m ? m[1].trim() : stderr, hint: h ? h[1].trim() : null, details: null, code: 'P0001' } };
  }
}

function sqlArg(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return `array[${v.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
  if (typeof v === 'object') return lit(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** PostgREST's table reads (select, eq, order, limit, maybeSingle) as the user, under row-level security */
function pgFrom(uid: string) {
  return (table: string) => {
    let cols = '*';
    let single = false;
    let limit: number | null = null;
    const where: string[] = [];
    const order: string[] = [];
    const chain: Record<string, unknown> = {
      select: (c: string) => ((cols = c), chain),
      eq: (c: string, v: unknown) => (where.push(`${c} = ${sqlArg(v)}`), chain),
      order: (c: string, o?: { ascending?: boolean }) => (order.push(`${c}${o?.ascending === false ? ' desc' : ''}`), chain),
      limit: (n: number) => ((limit = n), chain),
      maybeSingle: () => ((single = true), chain),
      then: (resolve: (v: Answer) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const sql =
              `(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select ${cols} from public.${table}` +
              `${where.length ? ` where ${where.join(' and ')}` : ''}${order.length ? ` order by ${order.join(', ')}` : ''}` +
              `${limit !== null ? ` limit ${limit}` : ''}) t)`;
            const r = callAs(uid, sql);
            if (r.error) return r;
            const rows = r.data as unknown[];
            return { data: single ? rows[0] ?? null : rows, error: null };
          })
          .then(resolve, reject),
    };
    return chain;
  };
}

/** A stand-in for the Supabase client: each rpc runs as `uid`; `log` keeps every raw answer */
function pgClient(uid: string, log: { name: string; args: Record<string, unknown>; answer: Answer }[] = []): SupabaseClient {
  return {
    from: pgFrom(uid),
    rpc: (name: string, args: Record<string, unknown>) => {
      const run = () => {
        const answer = callAs(uid, `public.${name}(${Object.entries(args).map(([k, v]) => `${k} => ${sqlArg(v)}`).join(', ')})`);
        log.push({ name, args, answer });
        return answer;
      };
      const call = {
        abortSignal: () => call,
        then: (resolve: (v: Answer) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
      };
      return call;
    },
  } as unknown as SupabaseClient;
}

const at = (d: Date) => d.getTime();
const hmAgo = (tz: string, minutes: number) => formatHhMm(utcToLocal(new Date(Date.now() - minutes * 60000), tz).minuteOfDay);

/** The code and field a call failed with */
async function refusal(p: Promise<unknown>): Promise<{ code: string; field: string | null }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RegistrarDataError) return { code: e.code, field: e.field };
    throw e;
  }
  throw new Error('expected a refusal');
}

describePg('«Registrar operação» × the real SQL', () => {
  const uid = randomUUID();
  const log: { name: string; args: Record<string, unknown>; answer: Answer }[] = [];
  const db = pgClient(uid, log);
  const acc: Record<string, string> = {};
  const clockOf: Record<string, typeof NY | typeof SP> = { futures: NY, binary: SP, forex: NY, stocks: NY, crypto: SP, b3: SP };
  const windows: Record<string, { tz: string; startMin: number; endMin: number; weekdays: number }> = {};
  const write = (name: string, json: unknown) => {
    if (RECORD) fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
  };
  const lastAnswer = () => log[log.length - 1].answer.data;

  beforeAll(async () => {
    psql(`insert into auth.users (id, email) values ('${uid}', 'registrar-${uid}@example.test');`);
    const labels: [string, AccountMarket, string][] = [
      ['futures', 'futures', 'topone'],
      ['binary', 'binary', 'ebinex'],
      ['forex', 'forex', 'mt5'],
      ['stocks', 'stocks', 'ibkr'],
      ['crypto', 'crypto', 'binance'],
      ['b3', 'b3', 'profit'],
      ['semRegras', 'futures', 'topone'],
    ];
    for (const [key, market, platform] of labels) {
      acc[key] = await createAccountAsUser(uid, {
        market,
        label: `Registrar ${key}`,
        platform,
        firm: null,
        external_ref: null,
        phase: null,
        size: null,
        is_primary: false,
      });
    }
    // A window around now on each account's clock, every day; «desde» a month ago
    const accounts: Record<string, unknown> = {};
    for (const key of ['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3']) {
      const tz = clockOf[key];
      const m = utcToLocal(new Date(), tz).minuteOfDay;
      const w = { tz, startMin: (m - 90 + 1440) % 1440, endMin: (m + 90) % 1440, weekdays: 127 };
      windows[key] = w;
      accounts[acc[key]] = {
        rules: key === 'futures' ? { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } } : { v: 1 },
        window: { tz: w.tz, start_min: w.startMin, end_min: w.endMin, weekdays: w.weekdays },
        version: 'force',
      };
    }
    asUser(uid, `public.save_rules(${lit({ v: 1, accounts })})`);
    psql(`alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions set effective_from = effective_from - interval '30 days' where user_id = '${uid}';
alter table public.account_rule_versions enable trigger account_rule_versions_guard;
insert into public.hub_members (user_id) values ('${uid}');`);
  });

  afterAll(() => {
    if (!PG_URL) return;
    // The trades, marks, contexts, images and logs go with the user (auth cascade)
    psql(`set storage.allow_delete_query = 'true';
delete from storage.objects where owner_id = '${uid}';
delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  /** The account's trading day of an instant (compute_trading_day with the version's window) */
  const dayOf = (market: string) => (d: Date) => tradingDayFor(d, MARKET_SPEC[market as AccountMarket].day, [windows[market]]);

  it('trade_caps_all() and instrument_specs() hold TRADE_CAPS and INSTRUMENT_SPEC', () => {
    expect(asUser(uid, 'public.trade_caps_all()')).toEqual(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])])));
    expect(asUser(uid, 'public.instrument_specs()')).toEqual(instrumentSpecsJson());
    expect(Object.keys(INSTRUMENT_SPEC)).toHaveLength(3);
  });

  const option = { right: 'call' as const, strike: '200', expires_on: '2027-01-15' };
  const entries: [string, AccountMarket, Omit<EntryFields, 'clock'>][] = [
    ['MES long 2, stop 11, target 22', 'futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', stop: '11', target: '22' }],
    ['MESM6 short 1, typed 5 minutes back', 'futures', { symbol: 'MESM6', direction: 'short', quantity: '1', entryPrice: '7957', stop: '9', entry: hmAgo(NY, 5) }],
    ['RTY (typed result)', 'futures', { symbol: 'RTY', direction: 'long', quantity: '1', entryPrice: '2250.1', stop: '5.5' }],
    ['EUR/USD in pips', 'forex', { symbol: 'EUR/USD', direction: 'long', quantity: '0.25', entryPrice: '1.08520', stop: '15', target: '30' }],
    ['USD/JPY short', 'forex', { symbol: 'USD/JPY', direction: 'short', quantity: '1', entryPrice: '151.240', stop: '20', target: '35' }],
    ['AAPL shares', 'stocks', { symbol: 'AAPL', direction: 'long', quantity: '10.5', entryPrice: '231.4', stop: '225', target: '240' }],
    ['AAPL call', 'stocks', { symbol: 'AAPL', direction: 'long', quantity: '2', entryPrice: '1.85', stop: '1.20', option }],
    ['BTC/USDT', 'crypto', { symbol: 'BTC/USDT', direction: 'long', quantity: '0.015', entryPrice: '112400', stop: '111000' }],
    ['WINZ26', 'b3', { symbol: 'WINZ26', direction: 'long', quantity: '2', entryPrice: '131250', stop: '150', target: '300' }],
    ['PETR4', 'b3', { symbol: 'PETR4', direction: 'long', quantity: '100', entryPrice: '38.42', stop: '37.90' }],
    ['Ebinex M1', 'binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 60 }],
    ['Ebinex M5, typed a minute back', 'binary', { symbol: 'EUR/USD', direction: 'put', stake: '20.50', payout: '87.5', durationS: 300, entry: hmAgo(SP, 1) }],
  ];

  it.each(entries)('previews %s as the domain computes it', async (_l, market, fields) => {
    const payload = entryPayload(market, { ...fields, clock: clockOf[market] });
    const dry = await previewEntry(db, acc[market], payload);
    const ts = validateEntry(market, payload, { now: dry.serverNow, dry: true, platform: market === 'binary' ? 'ebinex' : null, inRules: () => true });
    if (!ts.ok) throw new Error(`refused: ${ts.code}`);
    expect(at(dry.entryAt)).toBe(at(ts.entryAt));
    expect(dry.expiresAt && at(dry.expiresAt)).toBe(ts.expiresAt && at(ts.expiresAt));
    expect(dry.stopPrice).toBe(ts.entry.stopPrice && plain(ts.entry.stopPrice));
    expect(dry.targetPrice).toBe(ts.entry.targetPrice && plain(ts.entry.targetPrice));
    expect(instrumentJson(dry.instrument)).toEqual(instrumentJson(ts.entry.spec));
    expect(normalizePreview(dry.preview)).toEqual(normalizePreview(entryPreview(ts.entry)));
    expect(dry.tradingDay).toBe(dayOf(market)(dry.entryAt));
    expect(dry.similar).toEqual([]);
    expect(dry.plan.verdict).toBe('no_plano');
    if (market === 'futures' && _l.startsWith('MES long')) write('entry-dry-mes', lastAnswer());
    if (market === 'binary' && _l === 'Ebinex M1') write('entry-dry-ebinex', lastAnswer());
  });

  const refusals: [string, AccountMarket, () => object, boolean][] = [
    ['a price off the tick', 'futures', () => entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.30', clock: NY }), true],
    ['points off the tick', 'futures', () => entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', stop: '7.3', clock: NY }), true],
    ['an hour ahead of now', 'futures', () => entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', clock: NY, entry: hmAgo(NY, -2) }), true],
    ['an hour 16 minutes back', 'futures', () => entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', clock: NY, entry: hmAgo(NY, 17) }), true],
    ['an unknown key', 'futures', () => ({ ...entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', clock: NY }), extra: 1 }), true],
    ['no client_key', 'futures', () => entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7896.25', clock: NY }), false],
    ['a stop on the wrong side', 'stocks', () => entryPayload('stocks', { symbol: 'AAPL', direction: 'long', quantity: '1', entryPrice: '231.4', stop: '232', clock: NY }), true],
    ['an expired option', 'stocks', () => entryPayload('stocks', { symbol: 'AAPL', direction: 'long', quantity: '1', entryPrice: '1.85', option: { ...option, expires_on: '2026-01-02' }, clock: NY }), true],
    ['a stake of zero', 'binary', () => entryPayload('binary', { symbol: 'EUR/USD', direction: 'call', stake: '0', payout: '88', durationS: 60, clock: SP }), true],
    ['an expiration of 90 s', 'binary', () => entryPayload('binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 90, clock: SP }), true],
    ['a clock the account does not use', 'binary', () => ({ ...entryPayload('binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 60, clock: SP }), clock: 'UTC' }), true],
  ];

  it.each(refusals)('refuses %s with the code and field the domain gives', async (_l, market, payload, dry) => {
    const p = payload();
    const server = await refusal(dry ? previewEntry(db, acc[market], p as never) : registerEntry(db, acc[market], p as never));
    const ts = validateEntry(market, p, { now: new Date(), dry, inRules: () => true });
    expect(ts.ok).toBe(false);
    if (!ts.ok) expect(server).toEqual({ code: ts.code, field: ts.field });
  });

  it('refuses an account without rules first, whatever the payload', async () => {
    const server = await refusal(previewEntry(db, acc.semRegras, { v: 2 } as never));
    expect(server).toEqual({ code: 'no_rules', field: null });
    const ts = validateEntry('futures', { v: 2 }, { now: new Date(), hasRules: false });
    expect(ts).toEqual({ ok: false, code: 'no_rules', field: null });
  });

  it('a live futures trade: entry, marks, exit, the marks after it, and a repeated tap', async () => {
    const fields = { symbol: 'MES', direction: 'long' as const, quantity: '2', entryPrice: '7896.25', stop: '11', target: '22', clock: NY };
    const clientKey = newClientKey();
    const payload = entryPayload('futures', { ...fields, clientKey, marks: { setup: 'A', execucao: 'no_ponto' } });
    const reg = await registerEntry(db, acc.futures, payload);
    write('entry-mes', lastAnswer());
    expect(reg.repeated).toBe(false);
    const s = reg.state;
    expect(s.trade).toMatchObject({ status: 'open', source: 'live', symbol: 'MES', result: 'pending', pnl: null, stopPrice: '7885.25', targetPrice: '7918.25' });
    expect(s.context).toMatchObject({ origin: 'live', inWindow: true, afterLimit: false });
    expect(s.plan).toEqual({ breaks: [], verdict: 'no_plano', checksEvaluated: ['janela', 'limite'] });
    expect(s.version?.versionNo).toBe(1);
    expect(s.marks.map((m) => [m.kind, m.value, m.limpa])).toEqual([
      ['setup', 'A', true],
      ['execucao', 'no_ponto', true],
    ]);
    expect(at(s.marks[0].markedAt)).toBe(at(s.trade.registeredAt!));
    expect(undoRefusal({ origin: 'live', status: 'open', registeredAt: s.trade.registeredAt }, s.serverNow)).toBeNull();

    // A retried tap: the same trade, nothing written
    const again = await registerEntry(db, acc.futures, payload);
    expect(again.repeated).toBe(true);
    expect(again.state.trade.id).toBe(s.trade.id);
    expect(again.state.marks).toHaveLength(2);

    const marked = await addMarks(db, s.trade.id, marksPayload({ emocao: 'ansioso' }));
    expect(marked.marks.map((m) => m.limpa)).toEqual([true, true, true]);

    const open = openTrade(marked);
    const exit = exitPayload('futures', { exitPrice: '7903.75', clock: NY });
    const dry = await previewExit(db, s.trade.id, exit);
    write('exit-dry-mes', lastAnswer());
    if (dry.repeated) throw new Error('repeated');
    const ts = validateExit(open, exit, { now: dry.serverNow, dry: true });
    if (!ts.ok) throw new Error(ts.code);
    expect({ pnl: dry.pnl, result: dry.result, basis: dry.pnlBasis, points: dry.points, r: dry.r, commission: dry.commission }).toEqual({
      pnl: plain(ts.exit.pnl),
      result: ts.exit.result,
      basis: ts.exit.pnlBasis,
      points: ts.exit.points && plain(ts.exit.points),
      r: ts.r && plain(ts.r),
      commission: null,
    });
    expect(at(dry.exitAt)).toBe(at(ts.exitAt));

    const closed = await registerExit(db, s.trade.id, exit);
    write('exit-mes', lastAnswer());
    expect(closed.repeated).toBe(false);
    expect(closed.exit).toMatchObject({ pnl: '75', result: 'win', pnlBasis: 'prices', points: '7.5', r: '0.6818' });
    expect(closed.state.trade).toMatchObject({ status: 'closed', pnl: '75', result: 'win', pnlBasis: 'prices', commission: null });
    expect(closed.gateNow?.limit).toMatchObject({ evaluated: true, state: 'ok' });

    // After the exit: «depois do resultado», and the setup changed after it is kept apart
    const after = await addMarks(db, s.trade.id, marksPayload({ setup: 'C' }));
    write('marks-after-exit', lastAnswer());
    const timing = {
      origin: after.context!.origin,
      exitTime: after.trade.exitTime,
      expiresAt: after.trade.expiresAt,
      exitRegisteredAt: after.trade.exitRegisteredAt,
    };
    for (const m of after.marks) expect(isClean(m.markedAt, timing)).toBe(m.limpa);
    expect(after.marks.map((m) => m.limpa)).toEqual([true, true, true, false]);
    expect(marksNow(after.marks)).toEqual(after.marksNow);
    expect(after.marksNow.find((n) => n.kind === 'setup')).toMatchObject({ currentValue: 'C', cleanValue: 'A', changedAfter: true });

    // Read back from the tables, it is the same trade
    const { serverNow: _now, ...view } = after;
    expect(_now).toBeInstanceOf(Date);
    expect(await fetchTradeState(db, s.trade.id)).toEqual(view);
    expect(await fetchTradeState(db, randomUUID())).toBeNull();

    // A retried «Registrar saída»: what was registered
    const twice = await registerExit(db, s.trade.id, exit);
    expect(twice.repeated).toBe(true);
    expect(twice.exit).toBeNull();
    const dryTwice = await previewExit(db, s.trade.id, exit);
    expect(dryTwice.repeated).toBe(true);
    expect(await refusal(undoEntry(db, s.trade.id))).toEqual({ code: 'not_open', field: null });
  });

  it('«Desfazer entrada» takes an open trade away and logs it', async () => {
    const reg = await registerEntry(
      db,
      acc.futures,
      entryPayload('futures', { clientKey: newClientKey(), symbol: 'MNQ', direction: 'short', quantity: '1', entryPrice: '30702.5', clock: NY }),
    );
    const undone = await undoEntry(db, reg.state.trade.id);
    write('undo', lastAnswer());
    expect(undone).toMatchObject({ tradeId: reg.state.trade.id, trash: [] });
    expect(psql(`select count(*) from public.trades where id = '${reg.state.trade.id}';`).trim()).toBe('0');
    expect(psql(`select via from public.trade_deletions where trade_id = '${reg.state.trade.id}';`).trim()).toBe('desfazer_entrada');
    expect(await refusal(undoEntry(db, reg.state.trade.id))).toEqual({ code: 'unknown_trade', field: null });
  });

  it('«Já fechada» on today’s trading day, as the domain places and computes it', async () => {
    const now = new Date();
    const fields = {
      clientKey: newClientKey(),
      symbol: 'MES',
      direction: 'short' as const,
      quantity: '2',
      entryPrice: '7938.50',
      stop: '12',
      clock: NY,
      day: dayOf('futures')(now),
      entry: hmAgo(NY, 40),
      exit: hmAgo(NY, 25),
      exitPrice: '7929.00',
      marks: { setup: 'B' as const },
    };
    const payload = afterPayload('futures', fields);
    const dry = await previewAfter(db, acc.futures, payload);
    write('after-dry-mes', lastAnswer());
    const ts = validateAfter('futures', payload, { now: dry.serverNow, dry: true, dayOf: dayOf('futures'), inRules: () => true });
    if (!ts.ok) throw new Error(ts.code);
    expect(at(dry.entryAt)).toBe(at(ts.entryAt));
    expect(at(dry.exit.exitAt)).toBe(at(ts.exitAt));
    expect([dry.exit.pnl, dry.exit.points, dry.exit.r]).toEqual([plain(ts.exit.pnl), plain(ts.exit.points!), plain(ts.r!)]);
    const reg = await registerAfter(db, acc.futures, payload);
    write('after-mes', lastAnswer());
    expect(reg.state.context?.origin).toBe('reconstructed');
    expect(reg.state.trade).toMatchObject({ source: 'after', status: 'closed', pnl: '95', result: 'win' });
    expect(reg.state.marks.map((m) => m.limpa)).toEqual([false]);
    expect(reg.r).toBe('0.7917');

    // A binary already expired, and one not yet
    const bin = afterPayload('binary', {
      clientKey: newClientKey(),
      symbol: 'EUR/USD',
      direction: 'call',
      stake: '20',
      payout: '88',
      durationS: 60,
      clock: SP,
      day: dayOf('binary')(now),
      entry: hmAgo(SP, 10),
      outcome: 'perda',
    });
    const b = await registerAfter(db, acc.binary, bin);
    const tb = validateAfter('binary', bin, { now: b.state.serverNow, dayOf: dayOf('binary'), platform: 'ebinex' });
    if (!tb.ok) throw new Error(tb.code);
    expect(at(b.state.trade.expiresAt!)).toBe(at(tb.expiresAt!));
    expect(b.state.trade).toMatchObject({ pnl: '-20', result: 'loss', pnlBasis: 'outcome', commission: '0' });
    const notYet = { ...bin, client_key: newClientKey(), entry: hmAgo(SP, 0) };
    expect(await refusal(previewAfter(db, acc.binary, notYet))).toEqual({ code: 'not_expired', field: 'outcome' });
  });

  it('an Ebinex result only after the expiry (next candle)', async () => {
    const payload = entryPayload('binary', { clientKey: newClientKey(), symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 60, clock: SP });
    const reg = await registerEntry(db, acc.binary, payload);
    write('entry-ebinex', lastAnswer());
    const t = reg.state.trade;
    expect(at(t.expiresAt!)).toBe(at(binaryExpiry('ebinex', t.entryTime, 60)));
    expect(await refusal(registerExit(db, t.id, { v: 1, outcome: 'ganho' }))).toEqual({ code: 'not_expired', field: 'outcome' });
    // Two minutes pass (the stored expiry moved back, the guard off for it)
    psql(`alter table public.trades disable trigger trades_guard;
update public.trades set entry_time = entry_time - interval '3 minutes', expires_at = expires_at - interval '3 minutes' where id = '${t.id}';
alter table public.trades enable trigger trades_guard;`);
    const closed = await registerExit(db, t.id, exitPayload('binary', { outcome: 'ganho' }));
    write('exit-ebinex', lastAnswer());
    expect(closed.exit).toMatchObject({ pnl: '17.6', result: 'win', pnlBasis: 'outcome', exitPrice: null, points: null, r: null });
    expect(at(closed.state.trade.exitTime!)).toBe(at(closed.state.trade.expiresAt!));
  });

  it('images and the note: four at most, saved as uploaded, the removed ones queued for Storage', async () => {
    const reg = await registerEntry(
      db,
      acc.futures,
      entryPayload('futures', { clientKey: newClientKey(), symbol: 'MGC', direction: 'long', quantity: '1', entryPrice: '4409.8', clock: NY }),
    );
    const id = reg.state.trade.id;
    const slots = await imageSlots(db, id, imageSlotsRequest([], [
      { mime: 'image/webp', bytes: 860160, name: 'MGC_entrada.webp' },
      { mime: 'image/png', bytes: 1200, name: 'MGC_saida.png' },
    ]));
    write('slots', lastAnswer());
    expect(slots.bucket).toBe('trade-images');
    expect(slots.slots.map((x) => x.path.startsWith(`${uid}/${id}/`))).toEqual([true, true]);
    // The browser uploads them (the Storage API inserts the rows as the user)
    slots.slots.forEach((slot, i) => {
      asUserExec(uid, `insert into storage.objects (bucket_id, name, owner_id, metadata) values ('trade-images', '${slot.path}', '${uid}', '{"size": ${1000 + i}, "mimetype": "${slot.mime}"}');`);
    });
    for (const slot of slots.slots) expect(psql(`select count(*) from storage.objects where name = '${slot.path}';`).trim()).toBe('1');
    const saved = await saveExtras(db, id, extrasPayload({ note: 'Entrei no rompimento.', images: slots.slots.map((x) => x.id).reverse() }));
    write('extras', lastAnswer());
    expect(saved.state.images.map((x) => [x.name, x.position, x.bytes])).toEqual([
      ['MGC_saida.png', 1, 1001],
      ['MGC_entrada.webp', 2, 1000],
    ]);
    expect(saved.state.trade.note).toBe('Entrei no rompimento.');
    const { serverNow: _saved, ...view } = saved.state;
    expect(_saved).toBeInstanceOf(Date);
    expect(await fetchTradeState(db, id)).toEqual(view);
    const open = await fetchOpenTrades(db, acc.futures);
    expect(open.map((t) => t.id)).toContain(id);
    expect(open.every((t) => t.status === 'open' && t.accountId === acc.futures)).toBe(true);
    expect((await fetchOpenTrades(db)).length).toBeGreaterThanOrEqual(open.length);
    expect(await refusal(imageSlots(db, id, imageSlotsRequest(slots.slots.map((x) => x.id), [
      { mime: 'image/png', bytes: 1, name: 'a.png' },
      { mime: 'image/png', bytes: 1, name: 'b.png' },
      { mime: 'image/png', bytes: 1, name: 'c.png' },
    ])))).toEqual({ code: 'too_many_images', field: 'new' });
    expect(await refusal(imageSlots(db, id, imageSlotsRequest([], [{ mime: 'image/gif' as never, bytes: 1, name: 'a.gif' }])))).toEqual({ code: 'bad_mime', field: 'new' });

    // One taken out: its file goes to the trash, which the browser empties through Storage
    const kept = await saveExtras(db, id, extrasPayload({ images: [slots.slots[0].id], note: null }));
    expect(kept.state.images).toHaveLength(1);
    expect(kept.state.trade.note).toBeNull();
    expect(kept.trash).toEqual([slots.slots[1].path]);
    expect(await imageTrashDone(db, kept.trash)).toEqual({ cleared: 0, remaining: 1 });
    psql(`set storage.allow_delete_query = 'true'; delete from storage.objects where name = '${slots.slots[1].path}';`);
    expect(await imageTrashDone(db, kept.trash)).toEqual({ cleared: 1, remaining: 0 });
    write('trash-done', lastAnswer());
  });
});

/** Decimal text without trailing zeros, as the answers' JSON numbers read back */
function plain(x: string): string {
  return x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x;
}

function normalizePreview(p: ReturnType<typeof entryPreview>) {
  const n = (x: string | null) => (x === null ? null : plain(x));
  return p.kind === 'outcome'
    ? { kind: p.kind, ifWin: plain(p.ifWin), ifLoss: plain(p.ifLoss) }
    : { kind: p.kind, risk: n(p.risk), reward: n(p.reward), stopPoints: n(p.stopPoints), targetPoints: n(p.targetPoints) };
}

/** An open trade of a state, as register_exit reads it */
function openTrade(s: TradeState): OpenTrade {
  const t = s.trade;
  return {
    market: 'futures',
    symbol: t.symbol,
    direction: t.direction,
    quantity: t.quantity,
    entryPrice: t.entryPrice,
    stopPrice: t.stopPrice,
    commission: t.commission,
    entryTime: t.entryTime,
    expiresAt: t.expiresAt,
    stake: t.stakeAmount,
    payout: t.payoutPercent,
    option: null,
    status: t.status,
    registeredInApp: s.context !== null,
  };
}

/**
 * @jest-environment node
 *
 * Phase 3c (partial exits, «Mover stop», «Desfazer», «Já fechada» in several exits, the breakeven
 * rule on a trade) against the real SQL of migrations 20261023000001..3, on a throwaway local
 * Postgres whose clock the suite moves between steps. Skipped unless both are set (never the hosted
 * project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds)
 *                                                           from this file (an interposed clock)
 *   BH_PG_RECORD=<dir>                                      writes the fixtures there (testing/parciais.ts)
 *
 * Every write goes through lib/hub/registrarDb (the stand-in client of testing/pg runs it as the
 * user), and every answer is checked against the domain's twins: validatePartial, validateMove,
 * validateExit and validateAfter give the server's dry runs and refusals; positionOf, breakevenOf,
 * exitsSum and isClean give trade_state's position, rule, sums and marks; dayUsage with the exits
 * gives the day the limit sees; a trade read back from the tables is the trade the write answered.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import { MON_TO_FRI } from '@/lib/domain';
import { dayUsage, usdToCents, type DayTrade } from '@/lib/domain/gate';
import {
  afterPayload,
  breakevenOf,
  breakevenSuggestion,
  countingExits,
  entryPayload,
  exitPayload,
  exitsSum,
  firstExitCut,
  ifStopped,
  isClean,
  marksPayload,
  movePayload,
  partialPayload,
  plainExit,
  positionOf,
  stopNowStatus,
  tradeInstrument,
  undoEventPayload,
  undoEventRefusal,
  validateAfter,
  validateExit,
  validateMove,
  validatePartial,
  type OpenTrade,
  type TradeExit,
} from '@/lib/domain/registro';
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras';
import {
  EXIT_COLUMNS,
  RegistrarDataError,
  TRADE_COLUMNS,
  addMarks,
  moveStop,
  previewAfter,
  previewExit,
  previewPartial,
  readTradeViewRows,
  registerAfter,
  registerEntry,
  registerExit,
  registerPartial,
  newClientKey,
  tradeViewOfRows,
  undoEvent,
  type TradeState,
} from '@/lib/hub/registrarDb';
import { PG_URL, asUser, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const RECORD = process.env.BH_PG_RECORD;
const NY = 'America/New_York' as const;

const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

/** Moves the server's clock to `iso` (the real time plus a shift, read by the interposed clock) */
function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

async function refusal(p: Promise<unknown>): Promise<{ code: string; field: string | null }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RegistrarDataError) return { code: e.code, field: e.field };
    throw e;
  }
  throw new Error('expected a refusal');
}

/** What the domain's register_exit / register_partial checks read of a trade's state */
const openTradeOf = (s: TradeState, market: OpenTrade['market'] = 'futures'): OpenTrade => ({
  market,
  symbol: s.trade.symbol,
  direction: s.trade.direction,
  quantity: s.trade.quantity,
  entryPrice: s.trade.entryPrice,
  stopPrice: s.trade.stopPrice,
  commission: s.trade.commission,
  entryTime: s.trade.entryTime,
  expiresAt: s.trade.expiresAt,
  stake: null,
  payout: null,
  option: s.trade.option && { right: s.trade.option.right, strike: s.trade.option.strike, expires_on: s.trade.option.expiresOn, multiplier: s.trade.option.multiplier },
  status: s.trade.status,
  registeredInApp: s.context !== null,
  exits: s.exits,
});

describePg('Phase 3c × the real SQL: partials, «Mover stop», «Desfazer» and the breakeven rule', () => {
  const uid = randomUUID();
  const log: { name: string; args: Record<string, unknown>; answer: { data: unknown; error: unknown } }[] = [];
  const db = pgClient(uid, log);
  const acc = { topOne: '', apex: '', ftmo: '' };
  const trades: Record<string, string> = {};
  const recorded: string[] = [];
  const write = (name: string, json: unknown) => {
    recorded.push(name);
    if (RECORD) fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
  };
  const lastAnswer = () => log[log.length - 1].answer.data;
  const rulesNow = (): { json: unknown; parsed: RulesNow } => {
    const json = asUser(uid, 'public.rules_now()');
    return { json, parsed: parseRulesNow(json) };
  };
  const rows = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await q;
    if (r.error) throw new Error(JSON.stringify(r.error));
    return r.data as Record<string, unknown>[];
  };

  /** The state the write answered = the twins on its own rows; the tables read back the same trade */
  async function checkState(s: TradeState, market: string) {
    const origin = s.context?.origin ?? null;
    expect(s.position).toEqual(positionOf(s.trade, s.exits, s.stopMoves, origin, s.serverNow));
    const rules = rulesNow().parsed.accounts.find((a) => a.accountId === s.trade.accountId)!.rules!;
    expect(s.breakeven).toEqual(breakevenOf(rules.breakeven, market, s.trade.symbol, s.trade.option !== null, s.trade.direction, s.trade.entryPrice));
    if (s.trade.status === 'closed' && s.position.exits > 0) {
      const sum = exitsSum(countingExits(s.exits))!;
      expect([sum.quantity, sum.pnl, sum.exitPrice, sum.commission, sum.lastAt]).toEqual([
        s.trade.quantity,
        s.trade.pnl,
        s.trade.exitPrice,
        s.trade.commission,
        s.trade.exitTime,
      ]);
    }
    for (const m of s.marks) {
      expect(isClean(m.markedAt, { origin, exitTime: s.trade.exitTime, expiresAt: s.trade.expiresAt, exitRegisteredAt: s.trade.exitRegisteredAt, firstExit: firstExitCut(s.exits) })).toBe(m.limpa);
    }
    const view = tradeViewOfRows((await readTradeViewRows(db, s.trade.id))!);
    const { serverNow: _now, ...answered } = s;
    // Read from the tables there is no server clock: «Desfazer» names the newest event whatever its age
    expect({ ...view, position: { ...view.position, undo: answered.position.undo } }).toEqual(answered);
    if (answered.position.undo) expect(view.position.undo).toEqual(answered.position.undo);
  }

  /** The account's day as the limit sees it (rules_now today) = dayUsage over its trades and their counting exits */
  async function checkDay(accountId: string, day: string, name: string) {
    const now = rulesNow();
    const a = now.parsed.accounts.find((x) => x.accountId === accountId)!;
    const tRows = await rows(db.from('trades').select(TRADE_COLUMNS).eq('account_id', accountId).eq('trading_day', day).order('entry_time') as never);
    const ids = tRows.map((t) => t.id as string);
    const eRows = ids.length ? await rows(db.from('trade_exits_v').select(`trade_id, ${EXIT_COLUMNS}`).in('trade_id', ids).order('exit_time').order('id') as never) : [];
    write(`dia-${name}`, { trades: tRows, exits: eRows, agora: now.json });
    const cents = (x: unknown) => usdToCents(x) as number;
    const dayTrades: DayTrade[] = tRows.map((t) => ({
      id: t.id as string,
      tradingDay: t.trading_day as string,
      entryAt: new Date(t.entry_time as string),
      exitAt: t.exit_time ? new Date(t.exit_time as string) : null,
      pnlCents: t.pnl === null ? null : cents(t.pnl),
      commissionCents: t.commission === null ? null : cents(t.commission),
      result: t.result as string | null,
      exits: eRows
        .filter((e) => e.trade_id === t.id && e.counts === true)
        .map((e) => ({ id: e.id as number, at: new Date(e.exit_time as string), pnlCents: cents(e.pnl), commissionCents: e.commission === null ? null : cents(e.commission) })),
    }));
    const d = dayUsage(dayTrades, { tradingDay: day, until: now.parsed.serverNow });
    expect({ trades: d.trades, netCents: d.netCents, worstCents: d.worstCents }).toEqual(a.today);
    return a;
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Fri 23 Oct 09:00 ET: Top One and Apex under «Padrão Futuros» MES +8, MNQ +30, MGC +5; FTMO with its own EUR/USD +7,5 pips', async () => {
    setClock('2026-10-23T13:00:05Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'parciais-${uid.slice(0, 8)}@example.test');`);
    acc.topOne = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #1', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
    acc.apex = await createAccountAsUser(uid, { market: 'futures', label: 'Apex A', platform: 'topone', firm: null, external_ref: null, phase: 'avaliacao', size: null, is_primary: false });
    acc.ftmo = await createAccountAsUser(uid, { market: 'forex', label: 'FTMO', platform: 'mt5', firm: 'FTMO', external_ref: null, phase: 'avaliacao', size: null, is_primary: false });
    const window = { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI };
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        defaults: {
          futures: {
            rules: { v: 1, window_rule: { on: true, outside: 'fora' }, block: { on: true, before_min: 5, after_min: 10 }, states: {}, breakeven: { on: true, by: { MES: 8, MNQ: 30, MGC: 5 } } },
            windows: [window],
          },
        },
        accounts: {
          [acc.topOne]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null, version: 'force' },
          [acc.apex]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null, version: 'force' },
          [acc.ftmo]: {
            rules: { v: 1, limit: { usd: 1000, mode: 'conta', at_limit: 'encerrar' }, breakeven: { on: true, by: { EURUSD: 7.5 } } },
            window: { tz: NY, start_min: 480, end_min: 900, weekdays: MON_TO_FRI },
            version: 'force',
          },
        },
      })})`,
    );
    const now = rulesNow();
    write('agora-sex-0900', now.json);
    const top = now.parsed.accounts.find((a) => a.accountId === acc.topOne)!;
    expect(top.rules!.breakeven).toEqual({ by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' }, MGC: { n: '5', un: 'pts' } } });
    expect(now.parsed.accounts.find((a) => a.accountId === acc.ftmo)!.rules!.breakeven).toEqual({ by: { EURUSD: { n: '7.5', un: 'pips' } } });
  });

  it('scenario 14 · 10:12 ET: MES 3 ct at 7.912,50, stop 10 · alvo 20: «Sua regra: breakeven com +8 pts, em 7.920,50.»', async () => {
    setClock('2026-10-23T14:12:05Z');
    const r = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '3', entryPrice: '7912.50', stop: '10', target: '20', clock: NY, marks: { setup: 'A' } }));
    write('entry-mes', lastAnswer());
    trades.mes = r.state.trade.id;
    expect(r.state.breakeven).toEqual({ key: 'MES', n: '8', un: 'pts', level: '7920.5' });
    expect(r.state.position).toMatchObject({ quantity: '3', open: '3', closed: '0', exits: 0, partials: 0, stopInitial: '7902.5', stopNow: '7902.5', stopKind: null, undo: null, realizedPnl: null });
    expect(r.state.exits).toEqual([]);
    expect(r.state.stopMoves).toEqual([]);
    await checkState(r.state, 'futures');
  });

  it('10:18: «Parcial» 1 ct a 7.920,50 (dry run = the domain; refusals = the domain\'s), then registered; a retry is «repeated»', async () => {
    setClock('2026-10-23T14:18:05Z');
    const before = tradeViewOfRows((await readTradeViewRows(db, trades.mes))!);
    const state = { ...before, serverNow: new Date() } as TradeState;
    const p = partialPayload({ quantity: '1', exitPrice: '7920.50', exit: '10:18', clock: NY });
    const dry = await previewPartial(db, trades.mes, p);
    write('partial-dry-mes', lastAnswer());
    const ts = validatePartial({ ...openTradeOf(state), market: 'futures' }, before.exits, p, { now: dry.serverNow, dry: true });
    expect(ts).toEqual({ ok: true, quantity: dry.quantity, openAfter: dry.openAfter, exitAt: dry.exitAt, exit: { exitPrice: dry.exitPrice, pnl: dry.pnl, pnlBasis: dry.pnlBasis, result: 'win', commission: dry.commission, points: dry.points } });
    expect(dry).toMatchObject({ quantity: '1', openAfter: '2', pnl: '40', points: '8', pnlBasis: 'prices' });

    // Each refusal as the server gives it, and the domain before sending
    const bad: [string, Record<string, unknown>][] = [
      ['all of it', { quantity: '3' }],
      ['more than open', { quantity: '4' }],
      ['a fraction of a contract', { quantity: '1.5' }],
      ['off the tick', { exit_price: '7920.30' }],
      ['before the entry', { exit: '10:00' }],
      ['in the future', { exit: '10:30' }],
      ['«Custos»', { costs: '1.20' }],
      ['no client_key', { client_key: undefined }],
    ];
    for (const [label, patch] of bad) {
      const payload = { ...partialPayload({ clientKey: newClientKey(), quantity: '1', exitPrice: '7920.50', exit: '10:18', clock: NY }), ...patch };
      const server = await refusal(registerPartial(db, trades.mes, payload as never));
      const domain = validatePartial(openTradeOf(state), before.exits, payload, { now: new Date('2026-10-23T14:18:05Z') });
      expect([label, domain.ok ? null : { code: domain.code, field: domain.field }]).toEqual([label, server]);
    }

    const key = newClientKey();
    const reg = await registerPartial(db, trades.mes, partialPayload({ ...{ quantity: '1', exitPrice: '7920.50', exit: '10:18', clock: NY }, clientKey: key }));
    write('partial-mes', lastAnswer());
    expect(reg.repeated).toBe(false);
    expect(reg.partial).toMatchObject({ pnl: '40', points: '8' });
    expect(reg.state.position).toMatchObject({ open: '2', closed: '1', realizedPnl: '40', exits: 1, partials: 1, undo: { kind: 'parcial', id: reg.exitId } });
    expect(reg.state.exits).toEqual([expect.objectContaining({ id: reg.exitId, origin: 'app', kind: 'parcial', quantity: '1', exitPrice: '7920.5', pnl: '40', counts: true, voidedAt: null })]);
    // The trade stays open, with Phase 3's open shape
    expect(reg.state.trade).toMatchObject({ status: 'open', pnl: null, result: 'pending', exitTime: null });
    // «Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.»
    const spec = tradeInstrument('futures', 'MES')!;
    expect(breakevenSuggestion(spec, reg.state.breakeven, 1, '7912.5', '7920.5', reg.state.position.stopNow)).toEqual({ favor: '8', n: '8', un: 'pts' });
    await checkState(reg.state, 'futures');
    // The limit counts the partial at its own minute
    const day = await checkDay(acc.topOne, '2026-10-23', 'top-1018');
    expect(day.today).toEqual({ trades: 1, netCents: 4000, worstCents: 0 });

    const again = await registerPartial(db, trades.mes, partialPayload({ quantity: '1', exitPrice: '7920.50', exit: '10:18', clock: NY, clientKey: key }));
    expect(again).toMatchObject({ repeated: true, exitId: reg.exitId, partial: null, gateNow: null });
  });

  it('10:19: «Mover stop» to the breakeven with «Preço agora» 7.920,50 (= the domain), its refusals, «Desfazer» the newest only', async () => {
    setClock('2026-10-23T14:19:05Z');
    const view = tradeViewOfRows((await readTradeViewRows(db, trades.mes))!);
    const mt = { market: 'futures', symbol: 'MES', direction: 'long' as const, entryPrice: view.trade.entryPrice, stopPrice: view.trade.stopPrice, status: view.trade.status, option: null, origin: view.context!.origin };
    const bad: [string, Record<string, unknown>][] = [
      ['breakeven without the price', { kind: 'breakeven' }],
      ['breakeven with a level', { kind: 'breakeven', stop_price: '7912.50', price_now: '7920.50' }],
      ['breakeven while against', { kind: 'breakeven', price_now: '7910.00' }],
      ['a level past the price', { kind: 'ajuste', stop_price: '7921.00', price_now: '7920.50' }],
      ['off the tick', { kind: 'ajuste', stop_price: '7913.10' }],
      ['price off the tick', { kind: 'ajuste', stop_price: '7905.00', price_now: '7920.60' }],
      ['the stop it has', { kind: 'ajuste', stop_price: '7902.50' }],
      ['no level', { kind: 'ajuste' }],
      ['a kind it does not know', { kind: 'trailing' }],
    ];
    for (const [label, patch] of bad) {
      const payload = { v: 1, client_key: newClientKey(), ...patch };
      const server = await refusal(moveStop(db, trades.mes, payload as never));
      const domain = validateMove(mt, view.stopMoves, payload);
      expect([label, domain.ok ? null : { code: domain.code, field: domain.field }]).toEqual([label, server]);
    }
    const p = movePayload({ clientKey: newClientKey(), kind: 'breakeven', priceNow: '7920.50' });
    const want = validateMove(mt, view.stopMoves, p);
    const moved = await moveStop(db, trades.mes, p);
    write('stop-mes-breakeven', lastAnswer());
    expect(moved.repeated).toBe(false);
    expect(want).toEqual({ ok: true, kind: 'breakeven', stopPrice: '7912.5', prevStop: '7902.5', priceNow: '7920.5', favor: '8', unit: 'pts' });
    expect(moved.state.stopMoves).toEqual([
      expect.objectContaining({ id: moved.moveId, origin: 'live', kind: want.ok && want.kind, stopPrice: '7912.5', prevStop: '7902.5', priceNow: '7920.5', favor: '8', unit: 'pts', voidedAt: null, aoVivo: true }),
    ]);
    expect(moved.state.position).toMatchObject({ stopInitial: '7902.5', stopNow: '7912.5', stopKind: 'breakeven', undo: { kind: 'stop', id: moved.moveId } });
    expect(stopNowStatus(tradeInstrument('futures', 'MES')!, 1, '7912.5', moved.state.position.stopNow, moved.state.position.stopKind)).toEqual({ state: 'breakeven' });
    // «Se o stop for atingido: +US$ 40,00 no total.»
    expect(ifStopped(tradeInstrument('futures', 'MES')!, 1, '7912.5', moved.state.position.open, moved.state.position.stopNow, moved.state.position.realizedPnl)).toEqual({ total: '40', atStop: '0', estimate: false });
    await checkState(moved.state, 'futures');
    expect(await moveStop(db, trades.mes, p)).toMatchObject({ repeated: true, moveId: moved.moveId });

    // «Desfazer»: the partial is not the newest; the move is (then undone again: «repeated»)
    const s = moved.state;
    const exitId = s.exits[0].id;
    for (const ev of [{ kind: 'parcial' as const, id: exitId }, { kind: 'parcial' as const, id: 999999999 }]) {
      const server = await refusal(undoEvent(db, trades.mes, undoEventPayload(ev.kind, ev.id)));
      expect(server.code).toBe(undoEventRefusal({ status: 'open', origin: 'live' }, s.exits, s.stopMoves, ev, new Date('2026-10-23T14:19:06Z')));
    }
    setClock('2026-10-23T14:20:05Z');
    expect(undoEventRefusal({ status: 'open', origin: 'live' }, s.exits, s.stopMoves, { kind: 'stop', id: moved.moveId }, new Date('2026-10-23T14:20:05Z'))).toBeNull();
    const undone = await undoEvent(db, trades.mes, undoEventPayload('stop', moved.moveId));
    write('stop-mes-desfeito', lastAnswer());
    expect(undone).toMatchObject({ repeated: false, undone: { kind: 'stop', id: moved.moveId } });
    expect(undone.state.position).toMatchObject({ stopNow: '7902.5', stopKind: null, undo: { kind: 'parcial', id: exitId } });
    expect(undone.state.stopMoves[0].voidedAt).not.toBeNull();
    await checkState(undone.state, 'futures');
    expect(await undoEvent(db, trades.mes, undoEventPayload('stop', moved.moveId))).toMatchObject({ repeated: true });

    // The move again, for good; then a mark after the partial (not «limpa»)
    setClock('2026-10-23T14:21:05Z');
    const again = await moveStop(db, trades.mes, movePayload({ clientKey: newClientKey(), kind: 'breakeven', priceNow: '7920.50' }));
    expect(again.state.position.stopNow).toBe('7912.5');
    const marked = await addMarks(db, trades.mes, marksPayload({ execucao: 'no_ponto' }));
    expect(marked.marks.map((m) => [m.kind, m.limpa])).toEqual([
      ['setup', true],
      ['execucao', false],
    ]);
    await checkState(marked, 'futures');
  });

  it('10:31: «Saída» 7.926,00 closes the rest (2 ct): +US$ 175,00, 7.924,17 em média, +1,17 R com o stop inicial', async () => {
    setClock('2026-10-23T14:31:05Z');
    const view = tradeViewOfRows((await readTradeViewRows(db, trades.mes))!);
    const s = { ...view, serverNow: new Date() } as TradeState;
    const early = exitPayload('futures', { exitPrice: '7926.00', exit: '10:17', clock: NY });
    expect(await refusal(previewExit(db, trades.mes, early))).toEqual({ code: 'exit_before_partial', field: 'exit' });
    expect(validateExit(openTradeOf(s), early, { now: new Date('2026-10-23T14:31:05Z'), dry: true })).toEqual({ ok: false, code: 'exit_before_partial', field: 'exit' });

    const p = exitPayload('futures', { exitPrice: '7926.00', exit: '10:31', clock: NY });
    const dry = await previewExit(db, trades.mes, p);
    write('exit-dry-mes', lastAnswer());
    if (dry.repeated) throw new Error('repeated');
    expect(dry).toMatchObject({ pnl: '135', points: '13.5', r: '1.1667', rest: { quantity: '2', totalPnl: '175' } });
    const v = validateExit(openTradeOf(s), p, { now: dry.serverNow, dry: true });
    // validateExit keeps Phase 3's Postgres text ('135.00'); the answer reads without trailing zeros
    expect(v.ok && { ...v, exit: plainExit(v.exit) }).toEqual({
      ok: true,
      exit: { exitPrice: dry.exitPrice, pnl: dry.pnl, pnlBasis: dry.pnlBasis, result: dry.result, commission: dry.commission, points: dry.points },
      exitAt: dry.exitAt,
      r: dry.r,
      rest: dry.rest,
    });
    const reg = await registerExit(db, trades.mes, p);
    write('exit-mes', lastAnswer());
    expect(reg.exit).toMatchObject({ pnl: '135', r: '1.1667', rest: { quantity: '2', totalPnl: '175' } });
    expect(reg.state.trade).toMatchObject({ status: 'closed', quantity: '3', pnl: '175', exitPrice: '7924.16666667', result: 'win', pnlBasis: 'prices' });
    expect(reg.state.position).toMatchObject({ open: '0', closed: '3', realizedPnl: '175', exits: 2, partials: 1, r: '1.1667', undo: null });
    expect(reg.state.exits.map((e) => [e.kind, e.quantity, e.pnl])).toEqual([
      ['parcial', '1', '40'],
      ['final', '2', '135'],
    ]);
    await checkState(reg.state, 'futures');
    await checkDay(acc.topOne, '2026-10-23', 'top-1031');
  });

  it('scenario 15 · 10:45: «Já fechada» MGC Venda 2 ct in two exits, «Movi o stop para o breakeven» at 4.409,30 (= the domain)', async () => {
    setClock('2026-10-23T14:45:05Z');
    const fields = {
      clientKey: newClientKey(),
      symbol: 'MGC',
      direction: 'short' as const,
      quantity: '2',
      entryPrice: '4421.30',
      stop: '15',
      target: '30',
      clock: NY,
      day: '2026-10-23',
      entry: '10:24',
      exits: [
        { quantity: '1', exitPrice: '4409.30', exit: '10:31' },
        { quantity: '1', exitPrice: '4421.30', exit: '10:38' },
      ],
      breakevenPriceThen: '4409.30',
    };
    const p = afterPayload('futures', fields);
    const dry = await previewAfter(db, acc.topOne, p);
    write('after-dry-mgc', lastAnswer());
    const dayOf = (at: Date) => (JSON.parse(psql(`select to_jsonb(public.compute_trading_day('${acc.topOne}', '${at.toISOString()}'))::text;`).trim()) as string);
    const ts = validateAfter('futures', p, { now: dry.serverNow, dry: true, dayOf, inRules: () => true });
    if (!ts.ok) throw new Error(ts.code);
    expect(ts.exit).toEqual({ exitPrice: dry.exit.exitPrice, pnl: dry.exit.pnl, pnlBasis: dry.exit.pnlBasis, result: dry.exit.result, commission: dry.exit.commission, points: dry.exit.points });
    expect([ts.entryAt, ts.exitAt, ts.r]).toEqual([dry.entryAt, dry.exit.exitAt, dry.exit.r]);
    expect(ts.exits).toEqual(dry.exits);
    expect(ts.breakeven).toEqual(dry.breakeven);
    expect(dry.exit).toMatchObject({ pnl: '120', exitPrice: '4415.3', points: '6', r: '0.4' });
    expect(dry.breakeven).toEqual({ stopPrice: '4421.3', priceThen: '4409.3', favor: '12', unit: 'pts' });

    // Out of order, not adding up, a price then not in favour: the server's refusals = the domain's
    const bad: [string, Partial<typeof fields>][] = [
      ['out of order', { exits: [fields.exits[1], fields.exits[0]] }],
      ['not adding up', { exits: [fields.exits[0], { ...fields.exits[1], quantity: '2' }] }],
      ['off the tick', { exits: [fields.exits[0], { ...fields.exits[1], exitPrice: '4421.35' }] }],
      ['an exit after now', { exits: [fields.exits[0], { ...fields.exits[1], exit: '10:50' }] }],
      ['the price then against', { breakevenPriceThen: '4425.30' }],
      ['the price then off the tick', { breakevenPriceThen: '4409.35' }],
    ];
    for (const [label, patch] of bad) {
      const payload = afterPayload('futures', { ...fields, ...patch });
      const server = await refusal(previewAfter(db, acc.topOne, payload));
      const domain = validateAfter('futures', payload, { now: new Date('2026-10-23T14:45:05Z'), dry: true, dayOf, inRules: () => true });
      expect([label, domain.ok ? null : { code: domain.code, field: domain.field }]).toEqual([label, server]);
    }

    const reg = await registerAfter(db, acc.topOne, p);
    write('after-mgc', lastAnswer());
    trades.mgc = reg.state.trade.id;
    expect(reg.r).toBe('0.4');
    expect(reg.state.trade).toMatchObject({ status: 'closed', quantity: '2', pnl: '120', exitPrice: '4415.3' });
    expect(reg.state.exits.map((e) => [e.kind, e.quantity, e.pnl])).toEqual([
      ['parcial', '1', '120'],
      ['final', '1', '0'],
    ]);
    expect(reg.state.stopMoves).toEqual([
      expect.objectContaining({ origin: 'reconstructed', kind: 'breakeven', stopPrice: '4421.3', prevStop: '4436.3', priceNow: '4409.3', favor: '12', aoVivo: false }),
    ]);
    expect(reg.state.breakeven).toEqual({ key: 'MGC', n: '5', un: 'pts', level: '4416.3' });
    await checkState(reg.state, 'futures');
    await checkDay(acc.topOne, '2026-10-23', 'top-1045');
  });

  it('scenario 16 · Apex: ES −US$ 300, then MNQ 3 ct whose partial reaches the limit at 10:53; «Desfazer» gives it back', async () => {
    setClock('2026-10-23T14:46:05Z');
    await registerAfter(db, acc.apex, afterPayload('futures', { clientKey: newClientKey(), symbol: 'ES', direction: 'long', quantity: '1', entryPrice: '7921.50', stop: '8', clock: NY, day: '2026-10-23', entry: '10:30', exit: '10:40', exitPrice: '7915.50' }));
    const e = await registerEntry(db, acc.apex, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MNQ', direction: 'long', quantity: '3', entryPrice: '30880.00', stop: '40', clock: NY }));
    trades.mnq = e.state.trade.id;
    expect(e.state.breakeven).toEqual({ key: 'MNQ', n: '30', un: 'pts', level: '30910' });

    setClock('2026-10-23T14:53:05Z');
    const reg = await registerPartial(db, trades.mnq, partialPayload({ clientKey: newClientKey(), quantity: '2', exitPrice: '30855.00', exit: '10:53', clock: NY }));
    write('partial-mnq-limite', lastAnswer());
    expect(reg.partial).toMatchObject({ pnl: '-100', points: '-25' });
    expect(reg.gateNow).toMatchObject({ status: 'encerrado' });
    // No suggestion: the partial was against
    expect(breakevenSuggestion(tradeInstrument('futures', 'MNQ')!, reg.state.breakeven, 1, '30880', '30855', reg.state.position.stopNow)).toBeNull();
    // «Se o stop for atingido: −US$ 180,00 no total.»
    expect(ifStopped(tradeInstrument('futures', 'MNQ')!, 1, '30880', reg.state.position.open, reg.state.position.stopNow, reg.state.position.realizedPnl)).toEqual({ total: '-180', atStop: '-80', estimate: false });
    await checkState(reg.state, 'futures');
    const day = await checkDay(acc.apex, '2026-10-23', 'apex-1053');
    expect(day.today).toEqual({ trades: 2, netCents: -40000, worstCents: -40000 });
    expect(day.gate.status).toBe('encerrado');

    setClock('2026-10-23T14:55:05Z');
    const undone = await undoEvent(db, trades.mnq, undoEventPayload('parcial', reg.exitId));
    write('partial-mnq-desfeita', lastAnswer());
    expect(undone.state.position).toMatchObject({ open: '3', closed: '0', realizedPnl: null, exits: 0, partials: 0, undo: null });
    expect(undone.state.exits).toEqual([expect.objectContaining({ id: reg.exitId, voidedAt: expect.any(Date), counts: false })]);
    await checkState(undone.state, 'futures');
    const after = await checkDay(acc.apex, '2026-10-23', 'apex-1055');
    expect(after.today).toEqual({ trades: 1, netCents: -30000, worstCents: -30000 });

    // 15 minutes after its registration, a partial can no longer be undone
    const p2 = await registerPartial(db, trades.mnq, partialPayload({ clientKey: newClientKey(), quantity: '1', exitPrice: '30900.00', exit: '10:55', clock: NY }));
    setClock('2026-10-23T15:11:05Z');
    expect(await refusal(undoEvent(db, trades.mnq, undoEventPayload('parcial', p2.exitId)))).toEqual({ code: 'undo_too_late', field: null });
    expect(undoEventRefusal({ status: 'open', origin: 'live' }, p2.state.exits, p2.state.stopMoves, { kind: 'parcial', id: p2.exitId }, new Date('2026-10-23T15:11:05Z'))).toBe('undo_too_late');
  });

  it('FTMO · 11:15: EUR/USD 1,00 lote, a partial in pips, the rule in pips and a stop moved past the entry', async () => {
    setClock('2026-10-23T15:15:05Z');
    const e = await registerEntry(db, acc.ftmo, entryPayload('forex', { clientKey: newClientKey(), symbol: 'EUR/USD', direction: 'long', quantity: '1', entryPrice: '1.08520', stop: '12', clock: NY }));
    trades.eur = e.state.trade.id;
    expect(e.state.breakeven).toEqual({ key: 'EURUSD', n: '7.5', un: 'pips', level: '1.08595' });
    setClock('2026-10-23T15:17:05Z');
    const reg = await registerPartial(db, trades.eur, partialPayload({ clientKey: newClientKey(), quantity: '0.5', exitPrice: '1.08650', clock: NY }));
    write('partial-eurusd', lastAnswer());
    expect(reg.partial).toMatchObject({ pnl: '65', points: '0.0013' });
    const spec = tradeInstrument('forex', 'EUR/USD')!;
    expect(breakevenSuggestion(spec, reg.state.breakeven, 1, '1.0852', '1.0865', reg.state.position.stopNow)).toEqual({ favor: '13', n: '7.5', un: 'pips' });
    const mv = await moveStop(db, trades.eur, movePayload({ clientKey: newClientKey(), kind: 'ajuste', stopPrice: '1.08560', priceNow: '1.08650' }));
    write('stop-eurusd-ajuste', lastAnswer());
    expect(mv.state.stopMoves[0]).toMatchObject({ kind: 'ajuste', stopPrice: '1.0856', favor: '13', unit: 'pips' });
    expect(stopNowStatus(spec, 1, '1.0852', mv.state.position.stopNow, mv.state.position.stopKind)).toEqual({ state: 'garante', distance: '4', unit: 'pips' });
    await checkState(mv.state, 'forex');
  });

  it('every price market: a partial (dry run, refusals, result), the exit after it and «Já fechada» in two exits = the domain', async () => {
    setClock('2026-10-23T15:20:05Z');
    const SP = 'America/Sao_Paulo' as const;
    const ibkr = await createAccountAsUser(uid, { market: 'stocks', label: 'IBKR', platform: 'ibkr', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    const binance = await createAccountAsUser(uid, { market: 'crypto', label: 'Binance', platform: 'binance', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    const clear = await createAccountAsUser(uid, { market: 'b3', label: 'Clear', platform: 'profit', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: Object.fromEntries([ibkr, binance, clear].map((id) => [id, { rules: { v: 1 }, window: null, version: 'force' }])),
      })})`,
    );
    setClock('2026-10-23T15:21:05Z');
    const OPTION = { right: 'call' as const, strike: '790', expires_on: '2026-11-20' };
    const cases: { label: string; account: string; market: 'futures' | 'forex' | 'stocks' | 'crypto' | 'b3'; entry: Record<string, unknown>; partial: { quantity: string; exitPrice: string; pnl?: string } }[] = [
      { label: 'MGC (points; no «Corrigir» on futures)', account: acc.topOne, market: 'futures', entry: { symbol: 'MGCZ6', direction: 'short', quantity: '2', entryPrice: '4421.3', stop: '15', clock: NY }, partial: { quantity: '1', exitPrice: '4409.3' } },
      { label: 'ZN (a typed result)', account: acc.topOne, market: 'futures', entry: { symbol: 'ZNZ6', direction: 'long', quantity: '3', entryPrice: '112.5', stop: '112', clock: NY }, partial: { quantity: '1', exitPrice: '112.75', pnl: '234.38' } },
      { label: 'USD/JPY (an estimate)', account: acc.ftmo, market: 'forex', entry: { symbol: 'USD/JPY', direction: 'short', quantity: '0.3', entryPrice: '151.240', stop: '20', clock: NY }, partial: { quantity: '0.1', exitPrice: '151.020' } },
      { label: 'AAPL (fractional shares)', account: ibkr, market: 'stocks', entry: { symbol: 'AAPL', direction: 'long', quantity: '10.5', entryPrice: '231.40', stop: '230.90', clock: NY }, partial: { quantity: '2.25', exitPrice: '232.15' } },
      { label: 'a SPY call (× 100)', account: ibkr, market: 'stocks', entry: { symbol: 'SPY', direction: 'long', quantity: '3', entryPrice: '1.85', stop: '1.10', clock: NY, option: OPTION }, partial: { quantity: '1', exitPrice: '2.40' } },
      { label: 'BTC/USDT', account: binance, market: 'crypto', entry: { symbol: 'BTC/USDT', direction: 'short', quantity: '0.015', entryPrice: '112400', stop: '112800', clock: SP }, partial: { quantity: '0.005', exitPrice: '112150.5' } },
      { label: 'WIN (R$)', account: clear, market: 'b3', entry: { symbol: 'WINZ26', direction: 'short', quantity: '3', entryPrice: '131250', stop: '100', clock: SP }, partial: { quantity: '1', exitPrice: '131100' } },
      { label: 'PETR4 (R$)', account: clear, market: 'b3', entry: { symbol: 'PETR4', direction: 'long', quantity: '300', entryPrice: '38.42', stop: '38.20', clock: SP }, partial: { quantity: '100', exitPrice: '38.71' } },
    ];
    const refused = new Set<string>();
    for (const c of cases) {
      const e = await registerEntry(db, c.account, entryPayload(c.market, { clientKey: newClientKey(), ...c.entry } as never));
      const s0 = e.state;
      const tr = { ...openTradeOf(s0, c.market) };
      const p = partialPayload({ ...c.partial, clock: c.entry.clock as typeof NY });
      const dry = await previewPartial(db, s0.trade.id, p);
      const ts = validatePartial(tr, [], p, { now: dry.serverNow, dry: true });
      expect([c.label, ts]).toEqual([
        c.label,
        { ok: true, quantity: dry.quantity, openAfter: dry.openAfter, exitAt: dry.exitAt, exit: { exitPrice: dry.exitPrice, pnl: dry.pnl, pnlBasis: dry.pnlBasis, result: expect.any(String), commission: dry.commission, points: dry.points } },
      ]);
      // The quantity's decimals, the whole position, the price's decimals, the typed result: the
      // server's answer to each (a dry run, so nothing is written) = the domain's
      for (const patch of [{ quantity: '0.0000000001' }, { quantity: s0.trade.quantity }, { exit_price: '0.000000001' }, { pnl: undefined }, { pnl: '12.345' }, { pnl: '12.34' }]) {
        const payload = { ...p, ...patch };
        const server = await refusal(previewPartial(db, s0.trade.id, payload as never)).catch(() => null);
        const domain = validatePartial(tr, [], payload, { now: dry.serverNow, dry: true });
        expect([c.label, patch, domain.ok ? null : { code: domain.code, field: domain.field }]).toEqual([c.label, patch, server]);
        if (server) refused.add(`${server.code}:${server.field}`);
      }
      const reg = await registerPartial(db, s0.trade.id, partialPayload({ ...c.partial, clientKey: newClientKey(), clock: c.entry.clock as typeof NY }));
      expect(reg.state.exits).toEqual([expect.objectContaining({ quantity: dry.quantity, pnl: dry.pnl, pnlBasis: dry.pnlBasis, counts: true })]);
      await checkState(reg.state, c.market);
      // The rest at the entry price (a typed result names its own)
      const ex = exitPayload(c.market, { exitPrice: c.entry.entryPrice as string, clock: c.entry.clock as typeof NY, ...(c.partial.pnl ? { pnl: '0' } : {}) });
      const dEx = await previewExit(db, s0.trade.id, ex);
      if (dEx.repeated) throw new Error('repeated');
      const vEx = validateExit(openTradeOf(reg.state, c.market), ex, { now: dEx.serverNow, dry: true });
      expect([c.label, vEx.ok && { ...vEx, exit: plainExit(vEx.exit) }]).toEqual([
        c.label,
        { ok: true, exit: { exitPrice: dEx.exitPrice, pnl: dEx.pnl, pnlBasis: dEx.pnlBasis, result: dEx.result, commission: dEx.commission, points: dEx.points }, exitAt: dEx.exitAt, r: dEx.r, rest: dEx.rest },
      ]);
      const closed = await registerExit(db, s0.trade.id, ex);
      expect(closed.state.position).toMatchObject({ open: '0', exits: 2, partials: 1, r: dEx.r });
      await checkState(closed.state, c.market);
    }

    expect(Array.from(refused).sort()).toEqual(['bad_pnl:pnl', 'bad_price:exit_price', 'bad_quantity:quantity', 'not_for_market:pnl', 'partial_too_large:quantity', 'pnl_required:pnl']);

    // FTMO «Já fechada» EUR/USD 1 lote in two exits, «Custos» on the last, the breakeven told in pips
    const fields = {
      clientKey: newClientKey(), symbol: 'EUR/USD', direction: 'long' as const, quantity: '1', entryPrice: '1.08520', stop: '12', clock: NY, day: '2026-10-23', entry: '10:02',
      exits: [{ quantity: '0.4', exitPrice: '1.08650', exit: '10:20' }, { quantity: '0.6', exitPrice: '1.08560', exit: '10:41', costs: '7.00' }],
      breakevenPriceThen: '1.08610',
    };
    const p = afterPayload('forex', fields);
    const dry = await previewAfter(db, acc.ftmo, p);
    const dayOf = (at: Date) => (JSON.parse(psql(`select to_jsonb(public.compute_trading_day('${acc.ftmo}', '${at.toISOString()}'))::text;`).trim()) as string);
    const ts = validateAfter('forex', p, { now: dry.serverNow, dry: true, dayOf, inRules: () => true });
    if (!ts.ok) throw new Error(ts.code);
    expect([ts.exit, ts.exitAt, ts.r, ts.exits, ts.breakeven]).toEqual([
      { exitPrice: dry.exit.exitPrice, pnl: dry.exit.pnl, pnlBasis: dry.exit.pnlBasis, result: dry.exit.result, commission: dry.exit.commission, points: dry.exit.points },
      dry.exit.exitAt,
      dry.exit.r,
      dry.exits,
      dry.breakeven,
    ]);
    expect(dry.breakeven).toEqual({ stopPrice: '1.0852', priceThen: '1.0861', favor: '9', unit: 'pips' });
    const reg = await registerAfter(db, acc.ftmo, p);
    expect(reg.state.trade).toMatchObject({ commission: '7', pnl: dry.exit.pnl });
    await checkState(reg.state, 'forex');
  });

  it('11:30: «Outro preço» exactly at the entry is an «ajuste» without «Preço agora», a breakeven with it (= the domain)', async () => {
    setClock('2026-10-23T15:30:05Z');
    const e = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7930.00', stop: '10', clock: NY }));
    trades.mesEntrada = e.state.trade.id;
    const mtOf = (s: { trade: TradeState['trade']; context: TradeState['context'] }) => ({
      market: 'futures',
      symbol: 'MES',
      direction: 'long' as const,
      entryPrice: s.trade.entryPrice,
      stopPrice: s.trade.stopPrice,
      status: s.trade.status,
      option: null,
      origin: s.context!.origin,
    });

    // No price: the move keeps no points, so it is no breakeven (a breakeven always carries them)
    setClock('2026-10-23T15:31:05Z');
    const p1 = movePayload({ clientKey: newClientKey(), kind: 'ajuste', stopPrice: '7930.00' });
    const want1 = validateMove(mtOf(e.state), e.state.stopMoves, p1);
    expect(want1).toEqual({ ok: true, kind: 'ajuste', stopPrice: '7930', prevStop: '7920', priceNow: null, favor: null, unit: 'pts' });
    const m1 = await moveStop(db, trades.mesEntrada, p1);
    write('stop-mes-entrada-ajuste', lastAnswer());
    expect(m1.state.stopMoves.find((m) => m.id === m1.moveId)).toMatchObject({ kind: 'ajuste', stopPrice: '7930', prevStop: '7920', priceNow: null, favor: null, unit: 'pts', voidedAt: null });
    expect(m1.state.position).toMatchObject({ stopNow: '7930', stopKind: 'ajuste', undo: { kind: 'stop', id: m1.moveId } });
    // «Stop … · no breakeven» is where the stop is, whatever the move was called
    expect(stopNowStatus(tradeInstrument('futures', 'MES')!, 1, '7930', m1.state.position.stopNow, m1.state.position.stopKind)).toEqual({ state: 'breakeven' });
    await checkState(m1.state, 'futures');

    // «Desfazer», then the same level with «Preço agora» 7.934,25: a breakeven with +4,25 pts
    setClock('2026-10-23T15:32:05Z');
    const undone = await undoEvent(db, trades.mesEntrada, undoEventPayload('stop', m1.moveId));
    expect(undone.state.position).toMatchObject({ stopNow: '7920', stopKind: null });
    const p2 = movePayload({ clientKey: newClientKey(), kind: 'ajuste', stopPrice: '7930.00', priceNow: '7934.25' });
    const want2 = validateMove(mtOf(undone.state), undone.state.stopMoves, p2);
    expect(want2).toEqual({ ok: true, kind: 'breakeven', stopPrice: '7930', prevStop: '7920', priceNow: '7934.25', favor: '4.25', unit: 'pts' });
    const m2 = await moveStop(db, trades.mesEntrada, p2);
    write('stop-mes-entrada-breakeven', lastAnswer());
    expect(m2.state.stopMoves.find((m) => m.id === m2.moveId)).toMatchObject({ kind: 'breakeven', stopPrice: '7930', prevStop: '7920', priceNow: '7934.25', favor: '4.25', unit: 'pts' });
    expect(m2.state.position).toMatchObject({ stopNow: '7930', stopKind: 'breakeven' });
    await checkState(m2.state, 'futures');
  });

  it('records the ids the fixtures refer to', () => {
    write('ids', { user: uid, accounts: acc, trades });
    expect(recorded.length).toBeGreaterThan(10);
  });
});

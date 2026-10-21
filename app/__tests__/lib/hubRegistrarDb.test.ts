/**
 * @jest-environment node
 *
 * The Registrar's data layer (lib/hub/registrarDb) on the answers the real functions gave
 * (testing/fixtures/registrar, recorded by hubRegistrar.pg.test.ts): each call by name with its
 * argument names, each answer read into its type, every failure a code (and field), never the
 * database's text.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { HubDataError } from '@/lib/hub/contasDb';
import {
  IMAGE_BUCKET,
  REGISTRAR_ERROR_CODES,
  REGISTRAR_FIELDS,
  RegistrarDataError,
  SIGNED_URL_SECONDS,
  TRADE_COLUMNS,
  addMarks,
  drainImageTrash,
  fetchOpenTrades,
  fetchTradeState,
  imageSlots,
  imageTrashDone,
  newClientKey,
  parseTradeState,
  previewAfter,
  previewEntry,
  previewExit,
  registerAfter,
  registerEntry,
  registerExit,
  saveExtras,
  signedImageUrl,
  toRegistrarError,
  undoEntry,
  uploadImage,
} from '@/lib/hub/registrarDb';
import { PNL_BASES, REGISTRO_CODES, dayLimitOf, isClean, marksNow, riskBeyondLimit } from '@/lib/domain/registro';
import { registrarJson, type RegistrarFixture } from '@/testing/registrar';

type Answer = { data?: unknown; error?: unknown };

/** A stand-in for the Supabase client: records each rpc call and answers it with `answer(name, args)` */
function fakeDb(answer: (name: string, args: unknown) => Answer | Promise<never>) {
  const log: { name: string; args: unknown; signal: boolean }[] = [];
  const db = {
    rpc: (name: string, args?: unknown) => {
      const entry = { name, args, signal: false };
      log.push(entry);
      const call = {
        abortSignal: () => {
          entry.signal = true;
          return call;
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          const a = answer(name, args);
          return (a instanceof Promise ? a : Promise.resolve({ data: null, error: null, ...a })).then(resolve, reject);
        },
      };
      return call;
    },
  } as unknown as SupabaseClient;
  return { db, log };
}

const answering = (fixture: RegistrarFixture) => fakeDb(() => ({ data: registrarJson(fixture) }));
const ID = '00000000-0000-4000-8000-000000000001';

describe('the Registrar calls', () => {
  it('previews and registers an entry', async () => {
    const dry = answering('entry-dry-mes');
    const payload = { v: 1 as const, symbol: 'MES', direction: 'long' as const, quantity: '2', entry_price: '7896.25', stop_pts: '11', target_pts: '22', clock: 'America/New_York' as const };
    const p = await previewEntry(dry.db, ID, payload);
    expect(dry.log).toEqual([{ name: 'register_entry', args: { p_account: ID, p_entry: payload, p_dry_run: true }, signal: true }]);
    expect(p).toMatchObject({ stopPrice: '7885.25', targetPrice: '7918.25', expiresAt: null, similar: [], version: { versionNo: 1 } });
    expect(p.instrument).toMatchObject({ key: 'MES', tick: '0.25', mult: '5', pnl: 'prices', stops: 'pts', known: true });
    expect(p.preview).toEqual({ kind: 'prices', risk: '110', reward: '220', stopPoints: '11', targetPoints: '22' });
    // US$ 110 at risk, the whole US$ 400 left: no warning
    expect(p.limitRoom).toEqual({ limit: '400', net: '0', reached: false, left: '400', risk: '110', above: false });
    expect(p.plan).toEqual({ breaks: [], verdict: 'no_plano', checksEvaluated: ['janela', 'limite'] });
    expect(p.context).toMatchObject({ gateStatus: 'liberado', inWindow: true, afterLimit: false, dayPnlAtEntry: '0', dayWorstAtEntry: '0' });
    expect(p.gate.status).toBe('liberado');
    expect(p.entryAt.getTime()).toBe(p.serverNow.getTime());

    const real = answering('entry-mes');
    const r = await registerEntry(real.db, ID, { ...payload, client_key: ID });
    expect(real.log[0]).toMatchObject({ name: 'register_entry', args: { p_dry_run: false } });
    expect(r.repeated).toBe(false);
    expect(r.state.trade).toMatchObject({ status: 'open', source: 'live', result: 'pending', pnl: null, quantity: '2', entryPrice: '7896.25', commission: null });
    expect(r.state.context).toMatchObject({ origin: 'live', inWindow: true });
    expect(r.state.marks.map((m) => [m.kind, m.value, m.limpa])).toEqual([
      ['setup', 'A', true],
      ['execucao', 'no_ponto', true],
    ]);
    expect(r.state.images).toEqual([]);
  });

  it('reads prices, quantities and points with all 8 decimals (crypto: qty_dp and price_dp 8)', async () => {
    // The database answers numeric as JSON numbers; each one is read at 8 decimals, no fewer, no more
    const state = registrarJson('entry-mes');
    const trade = { ...(state.trade as object), quantity: 0.12345678, entry_price: 0.00012345, stop_price: 0.00012001, target_price: 98765.43210987 };
    expect(parseTradeState({ ...state, trade }).trade).toMatchObject({
      quantity: '0.12345678',
      entryPrice: '0.00012345',
      stopPrice: '0.00012001',
      targetPrice: '98765.43210987',
    });
    const dry = registrarJson('entry-dry-mes');
    const answer = { ...dry, stop_price: 0.00012001, target_price: 0.00013, preview: { risk: 0.01, reward: 0.02, stop_points: 0.00000344, target_points: 0.00000655 } };
    const p = await previewEntry(fakeDb(() => ({ data: answer })).db, ID, {} as never);
    expect([p.stopPrice, p.targetPrice, p.preview]).toEqual([
      '0.00012001',
      '0.00013',
      { kind: 'prices', risk: '0.01', reward: '0.02', stopPoints: '0.00000344', targetPoints: '0.00000655' },
    ]);
  });

  it('previews an Ebinex entry with its expiry on the next candle', async () => {
    const { db } = answering('entry-dry-ebinex');
    const p = await previewEntry(db, ID, { v: 1, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60, clock: 'America/Sao_Paulo' });
    // The stake is all a binary can lose; the Ebinex account has no limit
    expect(p.preview).toEqual({ kind: 'outcome', risk: '20', ifWin: '17.6', ifLoss: '-20' });
    expect(p.limitRoom).toBeNull();
    expect(p.instrument).toMatchObject({ assetType: 'binary_option', pnl: 'outcome', stops: null, qtyDp: null });
    expect(p.expiresAt!.getUTCSeconds()).toBe(0);
    const ms = p.expiresAt!.getTime() - p.entryAt.getTime();
    expect(ms).toBeGreaterThan(60000);
    expect(ms).toBeLessThanOrEqual(120000);
    const r = await registerEntry(answering('entry-ebinex').db, ID, { v: 1, client_key: ID, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60 });
    expect(r.state.trade).toMatchObject({ assetType: 'binary_option', stakeAmount: '20', payoutPercent: '88', durationSeconds: 60, timeframe: 'M1', commission: '0' });
    const x = await registerExit(answering('exit-ebinex').db, ID, { v: 1, outcome: 'ganho' });
    expect(x.exit).toMatchObject({ pnl: '17.6', result: 'win', pnlBasis: 'outcome', exitPrice: null, points: null, r: null });
    expect(x.state.trade.exitTime!.getTime()).toBe(x.state.trade.expiresAt!.getTime());
  });

  it('previews a stop that risks more than the day’s limit has left (the owner’s test: US$ 400, US$ 300 lost, ES stop US$ 125)', async () => {
    const { db } = answering('entry-dry-above');
    const p = await previewEntry(db, ID, { v: 1, symbol: 'ES', direction: 'long', quantity: '1', entry_price: '6650.25', stop_pts: '2.5', clock: 'America/New_York' });
    expect(p.preview).toMatchObject({ kind: 'prices', risk: '125', stopPoints: '2.5' });
    expect(p.limitRoom).toEqual({ limit: '400', net: '-300', reached: false, left: '100', risk: '125', above: true });
    // A warning, never a block: the gate still lets the trade in
    expect(p.gate.status).toBe('liberado');
    expect(p.gate.limit).toMatchObject({ evaluated: true, state: 'ok', cents: 40000, netCents: -30000 });
    // The domain says the same from the gate and the preview
    expect(riskBeyondLimit(dayLimitOf(p.gate.limit, 'USD'), p.preview.risk)).toEqual({ currency: 'USD', left: '100.00', risk: '125', over: '25.00' });
  });

  it('reads the room of «Já fechada» at its own entry, and an account without a limit as none', async () => {
    const after = await previewAfter(answering('after-dry-mes').db, ID, {} as never);
    expect(after.limitRoom).toEqual({ limit: '400', net: '0', reached: false, left: '400', risk: '120', above: false });
    const similar = await previewEntry(answering('entry-dry-similar').db, ID, {} as never);
    expect([similar.limitRoom, similar.preview]).toEqual([null, { kind: 'outcome', risk: '20', ifWin: '17.6', ifLoss: '-20' }]);
  });

  it('refuses a dry run without the room or the binary’s risk, or with a room of another shape', async () => {
    const dry = registrarJson('entry-dry-above');
    const room = dry.limit_room as Record<string, unknown>;
    const { limit_room: _room, ...withoutRoom } = dry;
    expect(_room).not.toBeUndefined();
    const ebinex = registrarJson('entry-dry-ebinex');
    const { risk: _risk, ...withoutRisk } = ebinex.preview as Record<string, unknown>;
    expect(_risk).toBe(20);
    for (const data of [
      withoutRoom,
      { ...dry, limit_room: { ...room, above: 'sim' } },
      { ...dry, limit_room: { ...room, left: '100,00' } },
      { ...dry, limit_room: { ...room, reached: null } },
      { ...dry, limit_room: { ...room, usd: undefined } },
      { ...dry, limit_room: [room] },
      { ...ebinex, preview: withoutRisk },
    ]) {
      await expect(previewEntry(fakeDb(() => ({ data })).db, ID, {} as never)).rejects.toMatchObject({ code: 'bad_answer' });
    }
    // A room without a risk to compare (no stop) reads as one
    const noStop = await previewEntry(fakeDb(() => ({ data: { ...dry, limit_room: { ...room, risk: null, above: false } } })).db, ID, {} as never);
    expect(noStop.limitRoom).toMatchObject({ risk: null, above: false, left: '100' });
  });

  it('previews and registers an exit, and the marks after it', async () => {
    const dry = answering('exit-dry-mes');
    const payload = { v: 1 as const, exit_price: '7903.75' };
    const p = await previewExit(dry.db, ID, payload);
    expect(dry.log[0]).toMatchObject({ name: 'register_exit', args: { p_trade: ID, p_exit: payload, p_dry_run: true } });
    expect(p).toMatchObject({ repeated: false, pnl: '75', result: 'win', pnlBasis: 'prices', points: '7.5', r: '0.6818', commission: null, exitPrice: '7903.75' });

    const real = answering('exit-mes');
    const x = await registerExit(real.db, ID, payload);
    expect(x.repeated).toBe(false);
    expect(x.exit).toMatchObject({ pnl: '75', r: '0.6818' });
    expect(x.state.trade).toMatchObject({ status: 'closed', pnl: '75', result: 'win', pnlBasis: 'prices' });
    expect(x.state.trade.exitRegisteredAt).not.toBeNull();
    expect(x.gateNow?.limit).toMatchObject({ evaluated: true, state: 'ok', cents: 40000, netCents: 7500 });

    const marks = await addMarks(answering('marks-after-exit').db, ID, { v: 1, marks: { setup: 'C' } });
    expect(marks.marks.map((m) => m.limpa)).toEqual([true, true, true, false]);
    // The domain's «limpa» and current marks agree with the server's
    const t = marks.trade;
    for (const m of marks.marks) {
      expect(isClean(m.markedAt, { origin: marks.context!.origin, exitTime: t.exitTime, expiresAt: t.expiresAt, exitRegisteredAt: t.exitRegisteredAt })).toBe(m.limpa);
    }
    expect(marksNow(marks.marks)).toEqual(marks.marksNow);
    expect(marks.marksNow.find((n) => n.kind === 'setup')).toMatchObject({ currentValue: 'C', cleanValue: 'A', changedAfter: true });
  });

  it('reads a pair with the dollar as base: the exit is saved as an estimate, and reads as one', async () => {
    const x = await registerExit(answering('exit-usdjpy').db, ID, { v: 1, exit_price: '151.440' });
    expect(x.exit).toMatchObject({ pnl: '-132.07', result: 'loss', pnlBasis: 'estimate', points: '-0.2', r: '-1', exitPrice: '151.44' });
    expect(x.state.trade).toMatchObject({ symbol: 'USD/JPY', assetType: 'forex', status: 'closed', pnlBasis: 'estimate' });
  });

  it('reads every pnl_basis the database stores (trades_pnl_basis_ok), and nothing else', async () => {
    expect([...PNL_BASES]).toEqual(['prices', 'estimate', 'typed', 'outcome', 'file']);
    const json = registrarJson('exit-usdjpy');
    for (const basis of PNL_BASES) {
      const answer = { ...json, pnl_basis: basis, trade: { ...(json.trade as object), pnl_basis: basis } };
      const x = await registerExit(fakeDb(() => ({ data: answer })).db, ID, { v: 1 });
      expect([x.exit?.pnlBasis, x.state.trade.pnlBasis]).toEqual([basis, basis]);
    }
    expect(parseTradeState({ ...json, trade: { ...(json.trade as object), pnl_basis: null } }).trade.pnlBasis).toBeNull();
    for (const basis of ['exact', 'Estimate', '']) {
      await expect(registerExit(fakeDb(() => ({ data: { ...json, pnl_basis: basis } })).db, ID, { v: 1 })).rejects.toMatchObject({ code: 'bad_answer' });
      expect(() => parseTradeState({ ...json, trade: { ...(json.trade as object), pnl_basis: basis } })).toThrow('bad_answer');
    }
  });

  it('previews an entry that looks like an imported trade (similar)', async () => {
    const { db } = answering('entry-dry-similar');
    const p = await previewEntry(db, ID, { v: 1, symbol: 'GBP/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60, clock: 'America/Sao_Paulo' });
    expect(p.similar).toHaveLength(1);
    expect(p.similar[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(p.instrument).toMatchObject({ key: 'GBPUSD', pnl: 'outcome' });
  });

  it('reads a repeated «Registrar saída»: the state, no exit', async () => {
    const json = { ...registrarJson('exit-mes'), repeated: true, dry_run: false };
    const x = await registerExit(fakeDb(() => ({ data: json })).db, ID, { v: 1 });
    expect(x).toMatchObject({ repeated: true, exit: null, gateNow: null });
    const dry = await previewExit(fakeDb(() => ({ data: { ...json, dry_run: true } })).db, ID, { v: 1 });
    expect(dry).toMatchObject({ repeated: true, tradeId: x.state.trade.id });
  });

  it('previews and registers «Já fechada»', async () => {
    const dry = await previewAfter(answering('after-dry-mes').db, ID, {} as never);
    expect(dry.exit).toMatchObject({ pnl: '95', result: 'win', points: '9.5', r: '0.7917', pnlBasis: 'prices' });
    expect(dry.exit.exitAt.getTime()).toBeGreaterThan(dry.entryAt.getTime());
    const real = fakeDb(() => ({ data: registrarJson('after-mes') }));
    const r = await registerAfter(real.db, ID, {} as never);
    expect(real.log[0]).toMatchObject({ name: 'register_after', args: { p_account: ID, p_dry_run: false } });
    expect(r).toMatchObject({ repeated: false, points: '9.5', r: '0.7917' });
    expect(r.state.trade).toMatchObject({ source: 'after', status: 'closed', pnl: '95' });
    expect(r.state.context?.origin).toBe('reconstructed');
    expect(r.state.marks.map((m) => m.limpa)).toEqual([false]);
  });

  it('undoes an entry, reserves image paths, saves images and the note, clears the trash', async () => {
    const u = fakeDb(() => ({ data: registrarJson('undo') }));
    expect(await undoEntry(u.db, ID)).toMatchObject({ trash: [] });
    expect(u.log[0]).toMatchObject({ name: 'undo_entry', args: { p_trade: ID } });

    const s = fakeDb(() => ({ data: registrarJson('slots') }));
    const req = { v: 1 as const, keep: [], new: [{ mime: 'image/webp' as const, bytes: 860160, name: 'MGC_entrada.webp' }] };
    const slots = await imageSlots(s.db, ID, req);
    expect(s.log[0]).toMatchObject({ name: 'image_slots', args: { p_trade: ID, p_req: req } });
    expect(slots.bucket).toBe(IMAGE_BUCKET);
    expect(slots.slots.map((x) => [x.mime, x.name])).toEqual([
      ['image/webp', 'MGC_entrada.webp'],
      ['image/png', 'MGC_saida.png'],
    ]);
    expect(slots.slots[0].path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);

    const e = fakeDb(() => ({ data: registrarJson('extras') }));
    const saved = await saveExtras(e.db, ID, { v: 1, note: 'Entrei no rompimento.', images: [] });
    expect(saved.state.trade.note).toBe('Entrei no rompimento.');
    expect(saved.noteSavedAt).not.toBeNull();
    expect(saved.state.images.map((x) => [x.name, x.position, x.bytes])).toEqual([
      ['MGC_saida.png', 1, 1001],
      ['MGC_entrada.webp', 2, 1000],
    ]);

    const t = fakeDb(() => ({ data: registrarJson('trash-done') }));
    expect(await imageTrashDone(t.db, ['a/b/c.png'])).toEqual({ cleared: 1, remaining: 0 });
    expect(t.log[0]).toMatchObject({ name: 'image_trash_done', args: { p_paths: ['a/b/c.png'] } });
  });
});

describe('reading a trade back from the tables', () => {
  type Obj = Record<string, unknown>;
  /** The rows the tables hold for a recorded trade_state */
  function tablesOf(fixture: RegistrarFixture): Record<string, Obj[]> {
    const s = registrarJson(fixture);
    const t = s.trade as Obj;
    const o = t.option as Obj | null;
    const { option: _o, ...rest } = t;
    expect(_o === null || typeof _o === 'object').toBe(true);
    return {
      trades: [{ ...rest, option_right: o?.right ?? null, strike: o?.strike ?? null, expires_on: o?.expires_on ?? null, multiplier: o?.multiplier ?? null, rule_version_id: (s.version as Obj | null)?.id ?? null }],
      trade_entry_context: s.context ? [{ ...(s.context as Obj), gate: s.gate }] : [],
      trade_marks_v: s.marks as Obj[],
      trade_marks_now_v: s.marks_now as Obj[],
      trade_attachments: s.images as Obj[],
      account_rule_versions: s.version ? [s.version as Obj] : [],
    };
  }

  function fakeTables(tables: Record<string, Obj[]>) {
    const calls: unknown[][] = [];
    const db = {
      from: (table: string) => {
        const log: unknown[] = [table];
        calls.push(log);
        let single = false;
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'order']) chain[m] = (...args: unknown[]) => (log.push([m, ...args]), chain);
        chain.maybeSingle = () => ((single = true), chain);
        chain.then = (resolve: (v: unknown) => unknown) => {
          const rows = tables[table] ?? [];
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        };
        return chain;
      },
    } as unknown as SupabaseClient;
    return { db, calls };
  }

  it.each(['marks-after-exit', 'extras', 'after-mes', 'entry-ebinex'] as const)('reads %s as the write answered it', async (fixture) => {
    const { db, calls } = fakeTables(tablesOf(fixture));
    const { serverNow: _now, ...view } = parseTradeState(registrarJson(fixture));
    expect(_now).toBeInstanceOf(Date);
    expect(await fetchTradeState(db, ID)).toEqual(view);
    expect(calls[0]).toEqual(['trades', ['select', TRADE_COLUMNS], ['eq', 'id', ID]]);
    // Phase 3c: the trade's exits and stop moves too (none in these Phase 3 answers)
    expect(calls.map((c) => c[0])).toEqual([
      'trades',
      'trade_entry_context',
      'trade_marks_v',
      'trade_marks_now_v',
      'trade_attachments',
      'account_rule_versions',
      'trade_exits_v',
      'trade_stop_moves_v',
    ]);
  });

  it('answers null for a trade the caller cannot see, and lists the open ones', async () => {
    expect(await fetchTradeState(fakeTables({}).db, ID)).toBeNull();
    const rows = tablesOf('entry-mes').trades;
    const { db, calls } = fakeTables({ trades: [...rows, { ...rows[0], id: '00000000-0000-4000-8000-000000000009' }] });
    const open = await fetchOpenTrades(db, ID);
    expect(open.map((t) => t.status)).toEqual(['open', 'open']);
    expect(calls[0]).toEqual(['trades', ['select', TRADE_COLUMNS], ['eq', 'status', 'open'], ['eq', 'account_id', ID], ['order', 'entry_time']]);
    await expect(fetchOpenTrades(fakeTables({ trades: [{ id: 1 }] }).db)).rejects.toMatchObject({ code: 'bad_answer' });
  });
});

describe('errors', () => {
  it('turns the database’s bare codes into typed errors, with the field of its HINT', async () => {
    for (const [message, hint, field] of [
      ['off_tick', 'stop', 'stop'],
      ['entry_too_old', 'entry', 'entry'],
      ['bad_mark', 'marks.setup', 'marks.setup'],
      ['not_for_market', 'stop_price', 'stop_price'],
      ['similar_trade', null, null],
      ['too_many_images', 'new', 'new'],
      // A hint that is not one of the fields is dropped
      ['bad_price', 'valor 7.896,25', null],
    ] as const) {
      const { db } = fakeDb(() => ({ error: { code: '22023', message, hint, details: 'segredo' } }));
      const e = await registerEntry(db, ID, { v: 1 } as never).catch((x) => x);
      expect(e).toBeInstanceOf(RegistrarDataError);
      expect([e.code, e.field]).toEqual([message, field]);
      expect(JSON.stringify(e) + e.message).not.toContain('segredo');
    }
  });

  it('never keeps the database’s text, and calls a malformed answer bad_answer', async () => {
    const leak = fakeDb(() => ({ error: { code: 'P0001', message: 'value "feedface" is wrong', hint: 'entry', details: 'feedface' } }));
    const e = await previewEntry(leak.db, ID, {} as never).catch((x) => x);
    expect([e.code, e.field, e.message]).toEqual(['unknown', null, 'unknown']);
    for (const data of [null, [], 'texto', { dry_run: true }, { ...registrarJson('entry-dry-mes'), entry_at: 'ontem' }]) {
      await expect(previewEntry(fakeDb(() => ({ data })).db, ID, {} as never)).rejects.toMatchObject({ code: 'bad_answer' });
    }
    // A real registration's answer is not a dry run's
    await expect(previewEntry(answering('entry-mes').db, ID, {} as never)).rejects.toMatchObject({ code: 'bad_answer' });
    await expect(registerEntry(answering('entry-dry-mes').db, ID, {} as never)).rejects.toMatchObject({ code: 'bad_answer' });
    const state = registrarJson('entry-mes');
    expect(() => parseTradeState({ ...state, trade: { ...(state.trade as object), status: 'aberta' } })).toThrow('bad_answer');
  });

  it('maps expired sessions and failed requests', async () => {
    await expect(addMarks(fakeDb(() => ({ error: { code: 'PGRST301', message: 'JWT expired' } })).db, ID, { v: 1, marks: {} })).rejects.toMatchObject({
      code: 'not_authenticated',
    });
    await expect(addMarks(fakeDb(() => Promise.reject(new TypeError('Failed to fetch'))).db, ID, { v: 1, marks: {} })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('knows every code and field it can give', () => {
    expect(toRegistrarError({ message: 'undo_too_late' }).code).toBe('undo_too_late');
    expect(toRegistrarError(new HubDataError('network')).code).toBe('network');
    expect(toRegistrarError(new RegistrarDataError('frozen')).code).toBe('frozen');
    expect(toRegistrarError(null).code).toBe('unknown');
    expect(new Set(REGISTRAR_ERROR_CODES).size).toBe(REGISTRAR_ERROR_CODES.length);
    expect(new Set(REGISTRAR_FIELDS).size).toBe(REGISTRAR_FIELDS.length);
    expect(REGISTRAR_ERROR_CODES.slice(0, REGISTRO_CODES.length)).toEqual([...REGISTRO_CODES]);
  });
});

describe('newClientKey', () => {
  it('is a lower-case version-4 UUID, from getRandomValues', () => {
    const k = newClientKey();
    expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newClientKey()).not.toBe(k);
    expect(newClientKey((b) => b.fill(255))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(newClientKey((b) => b.fill(0))).toBe('00000000-0000-4000-8000-000000000000');
  });
});

describe('the image bucket', () => {
  function fakeStorage(result: (op: string, args: unknown[]) => { data: unknown; error: unknown }) {
    const calls: unknown[][] = [];
    const rpcs: unknown[] = [];
    const bucket = (name: string) => ({
      upload: async (...args: unknown[]) => (calls.push([name, 'upload', ...args]), result('upload', args)),
      createSignedUrl: async (...args: unknown[]) => (calls.push([name, 'sign', ...args]), result('sign', args)),
      remove: async (...args: unknown[]) => (calls.push([name, 'remove', ...args]), result('remove', args)),
    });
    const db = {
      storage: { from: bucket },
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'order', 'limit']) chain[m] = (...args: unknown[]) => (calls.push([table, m, ...args]), chain);
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result('trash', [])).then(resolve);
        return chain;
      },
      rpc: (name: string, args: { p_paths: string[] }) => {
        rpcs.push([name, args]);
        const done = { data: { server_now: '2026-10-18T23:40:00Z', cleared: args.p_paths.length, remaining: 0 }, error: null };
        return { abortSignal: () => ({ then: (r: (v: unknown) => unknown) => Promise.resolve(done).then(r) }), then: (r: (v: unknown) => unknown) => Promise.resolve(done).then(r) };
      },
    } as unknown as SupabaseClient;
    return { db, calls, rpcs };
  }

  it('uploads a reserved path without overwriting, and signs a 10-minute URL', async () => {
    const { db, calls } = fakeStorage((op) => ({ data: op === 'sign' ? { signedUrl: 'https://x/assinada' } : {}, error: null }));
    const blob = new Blob(['x'], { type: 'image/webp' });
    await uploadImage(db, { path: 'u/t/a.webp', mime: 'image/webp' }, blob);
    expect(await signedImageUrl(db, 'u/t/a.webp')).toBe('https://x/assinada');
    expect(calls).toEqual([
      [IMAGE_BUCKET, 'upload', 'u/t/a.webp', blob, { contentType: 'image/webp', upsert: false }],
      [IMAGE_BUCKET, 'sign', 'u/t/a.webp', SIGNED_URL_SECONDS],
    ]);
    expect(SIGNED_URL_SECONDS).toBe(600);
  });

  it('sends the bytes typed as reserved (the Storage client types a Blob’s form part by the Blob, never by contentType)', async () => {
    const { db, calls } = fakeStorage(() => ({ data: {}, error: null }));
    await uploadImage(db, { path: 'u/t/a.png', mime: 'image/png' }, new Blob([new Uint8Array([1, 2, 3])]));
    const sent = calls[0][3] as Blob;
    expect(sent.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await sent.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it('turns a Storage failure into a code', async () => {
    const { db } = fakeStorage(() => ({ data: null, error: { message: 'The resource already exists', statusCode: '409' } }));
    await expect(uploadImage(db, { path: 'u/t/a.webp', mime: 'image/webp' }, new Blob(['x']))).rejects.toMatchObject({ code: 'unknown' });
  });

  it('drains the trash: the paths given, or the queue it reads, a hundred at a time', async () => {
    const paths = Array.from({ length: 150 }, (_, i) => `u/t/${i}.png`);
    const given = fakeStorage(() => ({ data: [], error: null }));
    expect(await drainImageTrash(given.db, paths)).toEqual({ cleared: 150, remaining: 0 });
    expect(given.calls.map((c) => [c[1], (c[2] as string[]).length])).toEqual([
      ['remove', 100],
      ['remove', 50],
    ]);
    expect(given.rpcs.map((r) => (r as [string, { p_paths: string[] }])[1].p_paths.length)).toEqual([100, 50]);

    const queued = fakeStorage((op) => ({ data: op === 'trash' ? [{ path: 'u/t/1.png' }, { path: 'u/t/2.png' }] : [], error: null }));
    expect(await drainImageTrash(queued.db)).toEqual({ cleared: 2, remaining: 0 });
    expect(queued.calls.slice(0, 3)).toEqual([
      ['trade_image_trash', 'select', 'path'],
      ['trade_image_trash', 'order', 'queued_at'],
      ['trade_image_trash', 'limit', 100],
    ]);

    const empty = fakeStorage(() => ({ data: [], error: null }));
    expect(await drainImageTrash(empty.db)).toEqual({ cleared: 0, remaining: 0 });
    expect(empty.rpcs).toEqual([]);
  });
});

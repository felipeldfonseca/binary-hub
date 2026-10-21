/**
 * @jest-environment node
 *
 * The Phase 3c calls of lib/hub/registrarDb (register_partial, move_stop, undo_event) as PostgREST
 * gets them, each answer (recorded from the real SQL, testing/fixtures/parciais) read strictly, and
 * the refusals' codes and fields.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { movePayload, partialPayload, undoEventPayload } from '@/lib/domain/registro';
import { REGISTRAR_ERROR_CODES, moveStop, previewPartial, registerPartial, undoEvent } from '@/lib/hub/registrarDb';
import { idsParciais, parciaisJson } from '@/testing/parciais';

type Answer = { data?: unknown; error?: unknown };

function fakeRpc(answer: Answer) {
  const calls: { name: string; args: unknown }[] = [];
  const db = {
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args });
      const call = { abortSignal: () => call, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...answer }).then(resolve) };
      return call;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const ids = idsParciais();
const KEY = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';

describe('register_partial', () => {
  it('a dry run and a real one', async () => {
    const p = partialPayload({ quantity: '1', exitPrice: '7920.50', exit: '10:18', clock: 'America/New_York' });
    const d = fakeRpc({ data: parciaisJson('partial-dry-mes') });
    expect(await previewPartial(d.db, ids.trades.mes, p)).toMatchObject({ tradeId: ids.trades.mes, quantity: '1', openAfter: '2', pnl: '40' });
    expect(d.calls).toEqual([{ name: 'register_partial', args: { p_trade: ids.trades.mes, p_exit: p, p_dry_run: true } }]);

    const r = fakeRpc({ data: parciaisJson('partial-mes') });
    const reg = await registerPartial(r.db, ids.trades.mes, { ...p, client_key: KEY });
    expect(r.calls[0]).toEqual({ name: 'register_partial', args: { p_trade: ids.trades.mes, p_exit: { ...p, client_key: KEY }, p_dry_run: false } });
    expect(reg).toMatchObject({ repeated: false, partial: { pnl: '40' }, state: { position: { open: '2' } } });
  });

  it('a refusal is its code and field; a wrong shape is bad_answer', async () => {
    const p = partialPayload({ clientKey: KEY, quantity: '3', exitPrice: '7920.50' });
    await expect(registerPartial(fakeRpc({ error: { message: 'partial_too_large', hint: 'quantity' } }).db, 'x', p)).rejects.toMatchObject({ code: 'partial_too_large', field: 'quantity' });
    await expect(registerPartial(fakeRpc({ error: { message: 'too_many_exits', hint: null } }).db, 'x', p)).rejects.toMatchObject({ code: 'too_many_exits', field: null });
    await expect(registerPartial(fakeRpc({ data: { dry_run: false, repeated: false } }).db, 'x', p)).rejects.toMatchObject({ code: 'bad_answer' });
    await expect(previewPartial(fakeRpc({ data: parciaisJson('partial-mes') }).db, 'x', p)).rejects.toMatchObject({ code: 'bad_answer' });
  });
});

describe('move_stop and undo_event', () => {
  it('«Mover stop»', async () => {
    const p = movePayload({ clientKey: KEY, kind: 'breakeven', priceNow: '7920.50' });
    const f = fakeRpc({ data: parciaisJson('stop-mes-breakeven') });
    const r = await moveStop(f.db, ids.trades.mes, p);
    expect(f.calls).toEqual([{ name: 'move_stop', args: { p_trade: ids.trades.mes, p_move: p } }]);
    expect(r).toMatchObject({ repeated: false, state: { position: { stopNow: '7912.5', stopKind: 'breakeven' } } });
    expect(r.moveId).toBe(r.state.stopMoves[0].id);
    for (const [message, hint] of [['bad_stop', 'price_now'], ['same_stop', 'stop_price'], ['off_tick', 'price_now'], ['bad_payload', 'kind']] as const) {
      await expect(moveStop(fakeRpc({ error: { message, hint } }).db, 'x', p)).rejects.toMatchObject({ code: message, field: hint });
    }
  });

  it('«Desfazer»', async () => {
    const f = fakeRpc({ data: parciaisJson('stop-mes-desfeito') });
    const r = await undoEvent(f.db, ids.trades.mes, undoEventPayload('stop', 5));
    expect(f.calls).toEqual([{ name: 'undo_event', args: { p_trade: ids.trades.mes, p_event: { v: 1, kind: 'stop', id: 5 } } }]);
    expect(r).toMatchObject({ repeated: false, undone: { kind: 'stop' }, state: { position: { stopNow: '7902.5', stopKind: null } } });
    for (const message of ['not_newest', 'nothing_to_undo', 'undo_too_late', 'not_open']) {
      await expect(undoEvent(fakeRpc({ error: { message } }).db, 'x', undoEventPayload('parcial', 1))).rejects.toMatchObject({ code: message });
    }
    await expect(undoEvent(fakeRpc({ error: { message: 'bad_payload', hint: 'id' } }).db, 'x', undoEventPayload('parcial', 1))).rejects.toMatchObject({ code: 'bad_payload', field: 'id' });
  });

  it('knows every Phase 3c code', () => {
    for (const c of ['partial_too_large', 'exit_before_partial', 'too_many_exits', 'too_many_moves', 'same_stop', 'nothing_to_undo', 'not_newest', 'exits_mismatch']) {
      expect(REGISTRAR_ERROR_CODES).toContain(c);
    }
  });
});

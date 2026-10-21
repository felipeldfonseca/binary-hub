/**
 * @jest-environment node
 *
 * Phase 3c · lane C1: the exits and stop moves of several trades (the chooser's «2 ct em aberto»,
 * the bridge's second line): readTradeEventsRows reads trade_exits_v and trade_stop_moves_v for the
 * listed trades (nothing for none), tradeEventsOfRows groups them by trade in trade_state's order
 * with the module's own row parsers, and another shape is bad_answer. Rows: the recorded dia-*
 * exits (they carry trade_id) and the recorded stop moves with their trade_id
 * (testing/parciaisTelas.eventosRows).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EXIT_COLUMNS,
  MOVE_COLUMNS,
  fetchTradeEvents,
  parseExitRegistered,
  readTradeEventsRows,
  tradeEventsOfRows,
} from '@/lib/hub/registrarDb';
import { idsParciais, parciaisJson } from '@/testing/parciais';
import { eventosRows, estadoJson } from '@/testing/parciaisTelas';

type Call = { table: string; steps: [string, ...unknown[]][] };

/** A Supabase stand-in for table reads: records each chain and answers `answer(call)` */
function fakeDb(answer: (c: Call) => { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const db = {
    from: (table: string) => {
      const call: Call = { table, steps: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order']) {
        chain[m] = (...args: unknown[]) => {
          call.steps.push([m, ...args]);
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...answer(call) }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const ids = idsParciais();

describe('readTradeEventsRows', () => {
  it('reads the exits and the stop moves of the listed trades, each with its trade_id, in trade_state’s order', async () => {
    const rows = eventosRows({ json: estadoJson('exit-mes') }, { json: estadoJson('after-mgc') });
    const f = fakeDb((c) => ({ data: c.table === 'trade_exits_v' ? rows.exits : rows.stopMoves }));
    const out = await fetchTradeEvents(f.db, [ids.trades.mes, ids.trades.mgc]);
    expect(f.calls).toEqual([
      {
        table: 'trade_exits_v',
        steps: [
          ['select', `trade_id, ${EXIT_COLUMNS}`],
          ['in', 'trade_id', [ids.trades.mes, ids.trades.mgc]],
          ['order', 'exit_time'],
          ['order', 'id'],
        ],
      },
      {
        table: 'trade_stop_moves_v',
        steps: [
          ['select', `trade_id, ${MOVE_COLUMNS}`],
          ['in', 'trade_id', [ids.trades.mes, ids.trades.mgc]],
          ['order', 'moved_at'],
          ['order', 'id'],
        ],
      },
    ]);
    // The same rows trade_state answered for each trade
    const mes = parseExitRegistered(estadoJson('exit-mes')).state;
    expect(out[ids.trades.mes]).toEqual({ exits: mes.exits, stopMoves: mes.stopMoves });
    expect(out[ids.trades.mgc].exits.map((e) => e.exitPrice)).toEqual(['4409.3', '4421.3']);
    expect(out[ids.trades.mgc].stopMoves[0]).toMatchObject({ origin: 'reconstructed', kind: 'breakeven', priceNow: '4409.3' });
  });

  it('nothing to ask for: no read', async () => {
    const f = fakeDb(() => ({ data: [] }));
    expect(await readTradeEventsRows(f.db, [])).toEqual({ exits: [], stopMoves: [] });
    expect(f.calls).toHaveLength(0);
  });

  it('the day’s exits as recorded (dia-top-1045): every trade gets its own, sorted', () => {
    const dia = parciaisJson('dia-top-1045') as { exits: unknown[] };
    const out = tradeEventsOfRows({ exits: dia.exits, stopMoves: [] });
    expect(Object.keys(out).sort()).toEqual([ids.trades.mes, ids.trades.mgc].sort());
    expect(out[ids.trades.mes].exits.map((e) => [e.kind, e.quantity])).toEqual([
      ['parcial', '1'],
      ['final', '2'],
    ]);
    expect(out[ids.trades.mes].stopMoves).toEqual([]);
  });

  it('a failure is a code, another shape is bad_answer', async () => {
    const f = fakeDb(() => ({ error: { message: 'Failed to fetch' } }));
    await expect(fetchTradeEvents(f.db, ['x'])).rejects.toMatchObject({ code: 'network' });
    expect(() => tradeEventsOfRows({ exits: [{ id: 1 }], stopMoves: [] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
    // A row without its trade_id
    const sem = (estadoJson('exit-mes').exits as unknown[])[0];
    expect(() => tradeEventsOfRows({ exits: [sem], stopMoves: [] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
    expect(() => tradeEventsOfRows({ exits: null, stopMoves: [] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
  });
});

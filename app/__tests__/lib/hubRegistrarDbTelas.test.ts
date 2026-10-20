/**
 * @jest-environment node
 *
 * The reads PR 3-3 added to lib/hub/registrarDb («Operações do dia», the form's starting values,
 * the trade's rows apart from their parsing) on the recorded rows: each query as PostgREST gets it,
 * each answer read strictly into its type.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  REGISTRAR_ERROR_CODES,
  RECENT_COLUMNS,
  TRADE_COLUMNS,
  dayTradesOfRows,
  fetchDayTrades,
  fetchGateAt,
  fetchRecentTrades,
  fetchTradeState,
  readDayTradesRows,
  recentTradesOfRows,
  tradeViewOfRows,
} from '@/lib/hub/registrarDb';
import { diaRowsTelas, idsTelas, operacaoRowsTelas, telasJson } from '@/testing/registrarTelas';

type Call = { table: string; steps: [string, ...unknown[]][] };

/** A Supabase stand-in for table reads: records each chain and answers `answer(table, steps)` */
function fakeDb(answer: (c: Call) => { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const db = {
    from: (table: string) => {
      const call: Call = { table, steps: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'maybeSingle', 'gte']) {
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

const ids = idsTelas();

describe('«Operações do dia»', () => {
  it('reads the app’s trades of the day, the open ones and those closed since the day began; then their contexts and images', async () => {
    const rows = diaRowsTelas('dia-qui-1042');
    const f = fakeDb((c) => ({ data: c.table === 'trades' ? rows.trades : c.table === 'trade_entry_context' ? rows.contexts : rows.images }));
    const since = new Date('2026-10-21T22:00:00.000Z');
    const out = await fetchDayTrades(f.db, ids.accounts.topOne, '2026-10-22', since);
    expect(f.calls[0]).toEqual({
      table: 'trades',
      steps: [
        ['select', TRADE_COLUMNS],
        ['eq', 'account_id', ids.accounts.topOne],
        ['in', 'source', ['live', 'after']],
        ['or', 'trading_day.eq.2026-10-22,status.eq.open,exit_time.gte."2026-10-21T22:00:00.000Z"'],
        ['order', 'entry_time'],
      ],
    });
    const tradeIds = (rows.trades as { id: string }[]).map((t) => t.id);
    expect(f.calls[1].table).toBe('trade_entry_context');
    expect(f.calls[1].steps[1]).toEqual(['in', 'trade_id', tradeIds]);
    expect(f.calls[2]).toEqual({ table: 'trade_attachments', steps: [['select', 'trade_id'], ['in', 'trade_id', tradeIds], ['eq', 'status', 'ok']] });
    expect(out).toEqual(dayTradesOfRows(rows));
    expect(out.map((d) => d.images)).toEqual([0, 0, 2, 0]);
  });

  it('no trade: one read', async () => {
    const f = fakeDb(() => ({ data: [] }));
    expect(await readDayTradesRows(f.db, 'a', '2026-10-22', new Date(0))).toEqual({ trades: [], contexts: [], images: [] });
    expect(f.calls).toHaveLength(1);
  });

  it('a failure is a code, a wrong shape is bad_answer', async () => {
    const f = fakeDb(() => ({ error: { message: 'Failed to fetch' } }));
    await expect(fetchDayTrades(f.db, 'a', '2026-10-22', new Date(0))).rejects.toMatchObject({ code: 'network' });
    expect(() => dayTradesOfRows({ trades: [{ id: 'x' }], contexts: [], images: [] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
    expect(() => dayTradesOfRows({ ...diaRowsTelas('dia-qui-1031'), images: [{}] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
  });
});

describe('the form’s starting values', () => {
  it('reads the account’s last 200 trades, newest first', async () => {
    const rows = telasJson('recentes-ebinex');
    const f = fakeDb(() => ({ data: rows }));
    const out = await fetchRecentTrades(f.db, ids.accounts.ebinex);
    expect(f.calls[0]).toEqual({
      table: 'trades',
      steps: [
        ['select', RECENT_COLUMNS],
        ['eq', 'account_id', ids.accounts.ebinex],
        ['order', 'entry_time', { ascending: false }],
        ['limit', 200],
      ],
    });
    expect(out).toEqual(recentTradesOfRows(rows));
    expect(out[0]).toMatchObject({ symbol: 'EUR/USD', source: 'import', payout: '87', stake: '20' });
    expect(() => recentTradesOfRows([{ symbol: 'X' }])).toThrow(expect.objectContaining({ code: 'bad_answer' }));
  });
});

describe('a trade’s rows', () => {
  it('fetchTradeState is tradeViewOfRows of what the reads return', async () => {
    const rows = operacaoRowsTelas('operacao-mes-fechada');
    const f = fakeDb((c) => ({
      data:
        c.table === 'trades'
          ? rows.trade
          : c.table === 'trade_entry_context'
            ? rows.context
            : c.table === 'trade_marks_v'
              ? rows.marks
              : c.table === 'trade_marks_now_v'
                ? rows.marksNow
                : c.table === 'trade_attachments'
                  ? rows.images
                  : rows.version,
    }));
    expect(await fetchTradeState(f.db, ids.trades.mes)).toEqual(tradeViewOfRows(rows));
    expect(() => tradeViewOfRows({ ...rows, images: [{ id: 1 }] })).toThrow(expect.objectContaining({ code: 'bad_answer' }));
  });
});

describe('gate_at at a typed hour', () => {
  it('reads one account’s answer as rules_now gives it (an entry of the recorded rules_now is gate_at’s answer)', async () => {
    const entry = (telasJson('agora-qui-1031-et') as { accounts: unknown[] }).accounts[0];
    const calls: { name: string; args: unknown }[] = [];
    const db = {
      rpc: (name: string, args: unknown) => {
        calls.push({ name, args });
        const call = { abortSignal: () => call, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: entry, error: null }).then(resolve) };
        return call;
      },
    } as unknown as SupabaseClient;
    const at = new Date('2026-10-22T14:20:00.000Z');
    const answer = await fetchGateAt(db, ids.accounts.topOne, at);
    expect(calls).toEqual([{ name: 'gate_at', args: { p_account: ids.accounts.topOne, p_at: '2026-10-22T14:20:00.000Z' } }]);
    expect(answer).toMatchObject({ accountId: ids.accounts.topOne, label: 'Top One #1', gate: { status: 'liberado' }, today: { netCents: -24500 } });
    const call = { abortSignal: () => call, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: { account_id: 1 }, error: null }).then(r) };
    const bad = { rpc: () => call } as unknown as SupabaseClient;
    await expect(fetchGateAt(bad, 'a', at)).rejects.toMatchObject({ code: 'bad_answer' });
  });
});

describe('codes', () => {
  it('«offline» is the device’s, never the database’s', () => {
    expect(REGISTRAR_ERROR_CODES).toContain('offline');
  });
});

/**
 * The screens' reads of the agenda (contract §3.8): the filters each read sends (a row by `at` OR
 * `was_at`; the coverage of D − 1..D + 1), strict parsing, the error codes, and a row brought in by
 * its `was_at` only: present for display, absent from agendaFor.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { agendaFor } from '@/lib/domain/gate';
import {
  AGENDA_COLUMNS,
  AGENDA_RPC_ERROR_CODES,
  AgendaDataError,
  agendaRange,
  fetchAgendaDoDia,
  fetchDadosDaSemana,
  fetchProximosDados,
  parseAgendaRow,
} from '@/lib/hub/agendaDb';
import { TOP_CLOCK, blockRules, et } from '@/testing/gate';

type Call = { table: string; ops: [string, ...unknown[]][] };

/** A Supabase client that records each read and answers from `answers[table]` */
function fakeDb(answers: Record<string, { data?: unknown; error?: unknown } | (() => never)>) {
  const calls: Call[] = [];
  const db = {
    from: (table: string) => {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'or', 'in', 'eq', 'gte', 'lt', 'order']) {
        chain[op] = (...args: unknown[]) => (call.ops.push([op, ...args]), chain);
      }
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        const a = answers[table];
        return Promise.resolve()
          .then(() => (typeof a === 'function' ? a() : { data: a?.data ?? [], error: a?.error ?? null }))
          .then(resolve, reject);
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  code: 'cpi',
  calendar: 'us',
  at: '2026-12-10T13:30:00+00:00',
  was_at: null,
  status: 'agendado',
  day: '2026-12-10',
  local_tz: 'America/New_York',
  ...over,
});

const covered = (days: string[]) => days.map((day) => ({ calendar: 'us', day }));

describe('fetchAgendaDoDia (E5)', () => {
  // Thu 10 Dec 2026 09:00 ET: the Top One clock day is 10 Dec; S(D) = Wed 9 Dec 18:00 ET
  const at = et('2026-12-10 09:00');

  it('the range: [S(D) − 120 min, E(D + 1)) by at or was_at, the calendars, and the coverage of D − 1..D + 1', async () => {
    const { db, calls } = fakeDb({ economic_events: { data: [] }, economic_calendar_days: { data: [] } });
    await fetchAgendaDoDia(db, { calendars: ['us', 'eu'], clock: TOP_CLOCK, at });
    const r = agendaRange(TOP_CLOCK, at);
    expect(r.day).toBe('2026-12-10');
    expect(r.from.toISOString()).toBe('2026-12-09T21:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-12-11T23:00:00.000Z');
    const ev = calls.find((c) => c.table === 'economic_events')!;
    expect(ev.ops).toEqual([
      ['select', AGENDA_COLUMNS],
      [
        'or',
        'and(at.gte."2026-12-09T21:00:00.000Z",at.lt."2026-12-11T23:00:00.000Z"),and(was_at.gte."2026-12-09T21:00:00.000Z",was_at.lt."2026-12-11T23:00:00.000Z")',
      ],
      ['in', 'calendar', ['us', 'eu']],
      ['order', 'at', { ascending: true }],
    ]);
    const cov = calls.find((c) => c.table === 'economic_calendar_days')!;
    expect(cov.ops).toEqual([
      ['select', 'calendar, day'],
      ['in', 'calendar', ['us', 'eu']],
      ['in', 'day', ['2026-12-09', '2026-12-10', '2026-12-11']],
    ]);
  });

  it('no calendar: nothing is read (agendaFor answers [] without coverage)', async () => {
    const { db, calls } = fakeDb({});
    await expect(fetchAgendaDoDia(db, { calendars: [], clock: TOP_CLOCK, at })).resolves.toEqual({ rows: [], covered: [] });
    expect(calls).toEqual([]);
  });

  it('parses the rows and the coverage; a row with only its was_at in range shows but never waits', async () => {
    const moved = row({ code: 'ppi', at: '2026-12-18T13:30:00+00:00', was_at: '2026-12-10T13:30:00+00:00', day: '2026-12-18' });
    const { db } = fakeDb({
      economic_events: { data: [moved, row(), row({ code: null, calendar: 'us', at: '2026-12-10T15:00:00+00:00', status: 'divulgado' })] },
      economic_calendar_days: { data: covered(['2026-12-09', '2026-12-10', '2026-12-11']) },
    });
    const read = await fetchAgendaDoDia(db, { calendars: ['us'], clock: TOP_CLOCK, at });
    expect(read.rows.map((r) => [r.code, r.at.toISOString(), r.wasAt?.toISOString() ?? null])).toEqual([
      ['cpi', '2026-12-10T13:30:00.000Z', null],
      [null, '2026-12-10T15:00:00.000Z', null],
      ['ppi', '2026-12-18T13:30:00.000Z', '2026-12-10T13:30:00.000Z'],
    ]);
    expect(read.covered).toEqual(covered(['2026-12-09', '2026-12-10', '2026-12-11']));
    const entries = agendaFor(blockRules(), TOP_CLOCK, at, read)!;
    expect(entries.map((e) => e.code)).toEqual(['cpi']);
  });

  it('one date missing in the coverage: agendaFor says not checked (null)', async () => {
    const { db } = fakeDb({ economic_events: { data: [row()] }, economic_calendar_days: { data: covered(['2026-12-10', '2026-12-11']) } });
    const read = await fetchAgendaDoDia(db, { calendars: ['us'], clock: TOP_CLOCK, at });
    expect(agendaFor(blockRules(), TOP_CLOCK, at, read)).toBeNull();
  });

  it('errors are codes: any other shape → bad_answer; an error or no answer → network', async () => {
    expect(AGENDA_RPC_ERROR_CODES).toEqual(['bad_answer', 'network']);
    const shape = fakeDb({ economic_events: { data: [row({ code: 'CPI' })] }, economic_calendar_days: { data: [] } });
    await expect(fetchAgendaDoDia(shape.db, { calendars: ['us'], clock: TOP_CLOCK, at })).rejects.toMatchObject({ code: 'bad_answer' });
    const cov = fakeDb({ economic_events: { data: [] }, economic_calendar_days: { data: [{ calendar: 'xx', day: '2026-12-10' }] } });
    await expect(fetchAgendaDoDia(cov.db, { calendars: ['us'], clock: TOP_CLOCK, at })).rejects.toMatchObject({ code: 'bad_answer' });
    const err = fakeDb({ economic_events: { error: { message: 'permission denied for table economic_events', code: '42501' } }, economic_calendar_days: { data: [] } });
    const e = await fetchAgendaDoDia(err.db, { calendars: ['us'], clock: TOP_CLOCK, at }).catch((x) => x);
    expect(e).toBeInstanceOf(AgendaDataError);
    expect(e.code).toBe('network');
    expect(e.message).toBe('network');
    const thrown = fakeDb({
      economic_events: () => {
        throw new TypeError('Failed to fetch');
      },
      economic_calendar_days: { data: [] },
    });
    await expect(fetchAgendaDoDia(thrown.db, { calendars: ['us'], clock: TOP_CLOCK, at })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('parseAgendaRow (strict)', () => {
  it.each([
    ['an unknown code', { code: 'nfp' }],
    ['a calendar outside us/eu/br', { calendar: 'jp' }],
    ['a status outside the four', { status: 'remarcado' }],
    ['an instant that is not one', { at: 'amanhã' }],
    ['a was_at missing (undefined)', { was_at: undefined }],
    ['a day not YYYY-MM-DD', { day: '10/12/2026' }],
    ['no local_tz', { local_tz: '' }],
  ])('%s → bad_answer', (_l, over) => {
    expect(() => parseAgendaRow(row(over))).toThrow(AgendaDataError);
  });

  it('a postponed row keeps both instants and its status', () => {
    const r = parseAgendaRow(row({ status: 'adiado', was_at: '2026-12-09T13:30:00+00:00' }));
    expect(r).toEqual({
      code: 'cpi',
      calendar: 'us',
      at: new Date('2026-12-10T13:30:00Z'),
      wasAt: new Date('2026-12-09T13:30:00Z'),
      status: 'adiado',
      day: '2026-12-10',
      localTz: 'America/New_York',
    });
  });
});

describe('fetchProximosDados (E6) and fetchDadosDaSemana (L6)', () => {
  it('«Próximos dados»: 14 days from the server\'s now, by at or was_at, every calendar', async () => {
    const { db, calls } = fakeDb({ economic_events: { data: [row()] } });
    const rows = await fetchProximosDados(db, { from: new Date('2026-12-03T14:00:00Z'), days: 14 });
    expect(rows).toHaveLength(1);
    expect(calls[0].ops).toEqual([
      ['select', AGENDA_COLUMNS],
      [
        'or',
        'and(at.gte."2026-12-03T14:00:00.000Z",at.lt."2026-12-17T14:00:00.000Z"),and(was_at.gte."2026-12-03T14:00:00.000Z",was_at.lt."2026-12-17T14:00:00.000Z")',
      ],
      ['order', 'at', { ascending: true }],
    ]);
  });

  it('the Diário\'s week: [start, end), by at or was_at', async () => {
    const { db, calls } = fakeDb({ economic_events: { data: [] } });
    await fetchDadosDaSemana(db, { start: new Date('2026-12-06T23:00:00Z'), end: new Date('2026-12-13T23:00:00Z') });
    expect(calls[0].ops[1]).toEqual([
      'or',
      'and(at.gte."2026-12-06T23:00:00.000Z",at.lt."2026-12-13T23:00:00.000Z"),and(was_at.gte."2026-12-06T23:00:00.000Z",was_at.lt."2026-12-13T23:00:00.000Z")',
    ]);
  });
});

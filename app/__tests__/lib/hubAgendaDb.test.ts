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
import fs from 'fs';
import path from 'path';
import { answerOf, blockIntervals, parseRules } from '@/lib/domain/gate';
import { tradingDayBounds, tradingDayOn } from '@/lib/domain/tempo';
import { parseDay } from '@/lib/hub/diarioDb';
import { parseRulesNow } from '@/lib/hub/regras';
import { parseEntryDryRun } from '@/lib/hub/registrarDb';
import {
  ESTADOS_DADOS,
  RELOGIO_TOP,
  agendaDoEstado,
  agendaJson,
  diaDoEstado,
  agoraDoEstado,
  configDoQuadro,
  entradaDoEstado,
  et as etQ,
  leituraDoDia,
  proximosDoEstado,
  type EstadoDados,
} from '@/testing/agenda';

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

// ---------------------------------------------------------------------------------------------------------------
// The answers recorded from the real SQL (hubAgenda.pg.test.ts → testing/fixtures/agenda), read back
// ---------------------------------------------------------------------------------------------------------------

describe('the boards\' world: recorded answers and the screen reads agree', () => {
  const estados = Object.keys(ESTADOS_DADOS) as EstadoDados[];

  it('every file a state names was recorded and parses as the screens read it', () => {
    for (const e of estados) {
      const f = ESTADOS_DADOS[e].fixtures;
      if (f.agora) expect(parseRulesNow(agoraDoEstado(e)).accounts).toHaveLength(1);
      if (f.entrada) expect(parseEntryDryRun(entradaDoEstado(e)).gate.status === null || typeof parseEntryDryRun(entradaDoEstado(e)).gate.status === 'string').toBe(true);
      if (f.dia) expect(fs.existsSync(path.join(__dirname, '../../testing/fixtures/agenda', `${f.dia}.json`))).toBe(true);
    }
  });

  it.each([
    ['q06-posso-espera-ism', 'aguardar'],
    ['q07-posso-depois-cpi', 'aguardar'],
    ['q08-posso-dia-cpi', 'dia'],
    ['q09-posso-pce-pib', 'aguardar'],
    ['q10-posso-liberado', 'liberado'],
    ['q11-posso-mais-tarde', 'fora_janela'],
    ['q12-posso-sem-agenda', 'liberado'],
    ['q15-posso-espera-acabou', 'fora_janela'],
    ['q16-posso-sem-agenda-fora', 'fora_janela'],
    ['q17-posso-encerrado-na-espera', 'encerrado'],
    ['q18-posso-primeira-espera', 'aguardar'],
    ['q37-aviso-10min-diario', 'fora_janela'],
  ] as [EstadoDados, string][])('%s answers %s', (e, kind) => {
    const a = answerOf(parseRulesNow(agoraDoEstado(e)).accounts[0].gate);
    expect(a.kind).toBe(kind);
    if (e === 'q12-posso-sem-agenda') expect(a).toMatchObject({ semAgenda: true });
    if (e === 'q10-posso-liberado') expect(a).toMatchObject({ semAgenda: false });
  });

  it('the screen\'s twin on the world\'s read gives the SQL\'s `today` (E5 + agendaFor + blockIntervals)', () => {
    for (const e of ['q06-posso-espera-ism', 'q07-posso-depois-cpi', 'q08-posso-dia-cpi', 'q09-posso-pce-pib', 'q11-posso-mais-tarde', 'q37-aviso-10min-diario'] as EstadoDados[]) {
      const s = ESTADOS_DADOS[e];
      const block = parseRulesNow(agoraDoEstado(e)).accounts[0].gate.block;
      if (!block.evaluated) throw new Error(`${e}: block not evaluated`);
      const cfg = configDoQuadro(s.config) as { accounts: { versions: { resolved: unknown }[] }[] };
      const rules = parseRules(cfg.accounts[0].versions[0].resolved);
      const agenda = agendaFor(rules, RELOGIO_TOP, s.agora, agendaDoEstado(e))!;
      const d = tradingDayBounds(tradingDayOn(s.agora, RELOGIO_TOP), RELOGIO_TOP);
      const today = blockIntervals(rules, RELOGIO_TOP, agenda, s.agora).filter((i) => i.start < d.end && i.end > d.start);
      const show = (xs: { kind: string; start: Date; end: Date; releases: { code: string }[] }[]) =>
        xs.map((i) => [i.kind, i.start.toISOString(), i.end.toISOString(), i.releases.map((r) => r.code)]);
      expect(show(today)).toEqual(show(block.today));
    }
  });

  it('without the day\'s agenda the read has no coverage (agendaFor → null); Q29 in November too', () => {
    expect(agendaDoEstado('q12-posso-sem-agenda').covered).toEqual([]);
    expect(agendaDoEstado('q29-plano-nao-conferido').covered).toEqual([]);
    expect(proximosDoEstado('q43-personalizar-sem-agenda')).toEqual([]);
    expect(leituraDoDia(etQ('2026-12-03 10:05')).covered.map((c) => c.day)).toEqual(['2026-12-02', '2026-12-03', '2026-12-04']);
  });

  it('«Próximos dados» on Thu 3 Dec: the rows of the 14 days (Q23 draws the first five)', () => {
    expect(proximosDoEstado('q23-como-fica-ism-proximos').map((r) => [r.code, r.day])).toEqual([
      ['ism_serv', '2026-12-03'],
      ['payroll', '2026-12-04'],
      ['casas_usadas', '2026-12-09'],
      ['fomc_decisao', '2026-12-09'],
      ['fomc_entrevista', '2026-12-09'],
      ['cpi', '2026-12-10'],
    ]);
    expect(parseDay(diaDoEstado('q24-marca-espera')).trades).toHaveLength(2);
    expect(parseDay(diaDoEstado('q26-marca-dia')).trades).toHaveLength(2);
    expect(agendaJson('dia-inteiro')).toHaveProperty('trades');
  });
});

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
  fetchCoberturaProxima,
  fetchDadosDaSemana,
  fetchProximasDatas,
  fetchProximosDados,
  parseAgendaRow,
} from '@/lib/hub/agendaDb';
import { ultimoDiaCoberto } from '@/lib/hub/comoFicaHoje';
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

/** A client whose economic_events answer pages: `rows` cut by each request's range(from, to), up to `cap` rows */
function pagedDb(rows: unknown[], cap = 1000) {
  const calls: Call[] = [];
  const db = {
    from: (table: string) => {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'or', 'in', 'gte', 'lte', 'order', 'range']) {
        chain[op] = (...args: unknown[]) => (call.ops.push([op, ...args]), chain);
      }
      chain.then = (resolve: (v: unknown) => unknown) => {
        const range = call.ops.find((o) => o[0] === 'range') as [string, number, number] | undefined;
        const [lo, hi] = range ? [range[1], Math.min(range[2], range[1] + cap - 1)] : [0, cap - 1];
        return Promise.resolve({ data: rows.slice(lo, hi + 1), error: null }).then(resolve);
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe('fetchProximasDatas (Personalizar\'s «Próxima» column, paged)', () => {
  const from = new Date('2026-12-03T23:00:00Z');
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => row({ at: new Date(Date.UTC(2026, 11, 4) + i * 3_600_000).toISOString(), day: '2026-12-04' }));

  it('400 days from the start of the clock day, by at or was_at, every calendar, ordered by (at, id), in pages', async () => {
    const { db, calls } = pagedDb([row()]);
    const rows = await fetchProximasDatas(db, { from });
    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].ops).toEqual([
      ['select', AGENDA_COLUMNS],
      ['or', 'and(at.gte."2026-12-03T23:00:00.000Z",at.lt."2028-01-07T23:00:00.000Z"),and(was_at.gte."2026-12-03T23:00:00.000Z",was_at.lt."2028-01-07T23:00:00.000Z")'],
      ['order', 'at', { ascending: true }],
      ['order', 'id', { ascending: true }],
      ['range', 0, 999],
    ]);
  });

  it('past PostgREST\'s 1,000 rows: reads the next page until one comes back short', async () => {
    const { db, calls } = pagedDb(many(2300));
    const rows = await fetchProximasDatas(db, { from });
    expect(rows).toHaveLength(2300);
    expect(calls.map((c) => c.ops.find((o) => o[0] === 'range'))).toEqual([
      ['range', 0, 999],
      ['range', 1000, 1999],
      ['range', 2000, 2999],
    ]);
  });

  it('exactly a page: one more read, empty', async () => {
    const { db, calls } = pagedDb(many(6));
    await expect(fetchProximasDatas(db, { from, pageSize: 3 })).resolves.toHaveLength(6);
    expect(calls).toHaveLength(3);
  });

  it('still full after the last page: the rows of the last instant read are dropped, never a wrong next date', async () => {
    const { db, calls } = pagedDb(many(30), 1);
    const rows = await fetchProximasDatas(db, { from, pageSize: 1 });
    expect(calls).toHaveLength(20);
    expect(rows).toHaveLength(19);
  });

  it('a second page that fails → network (never half a list); a bad row → bad_answer', async () => {
    const { db } = pagedDb(many(1500));
    const from0 = db.from.bind(db);
    let n = 0;
    (db as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      const chain = from0(t) as unknown as Record<string, unknown>;
      if (++n === 2) chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'x' } }).then(resolve);
      return chain;
    };
    await expect(fetchProximasDatas(db, { from })).rejects.toMatchObject({ code: 'network' });
    const { db: bad } = pagedDb([row({ status: 'remarcado' })]);
    await expect(fetchProximasDatas(bad, { from })).rejects.toMatchObject({ code: 'bad_answer' });
  });
});

describe('fetchCoberturaProxima and «Depois de {dia}»', () => {
  it('the coverage of the calendars from today over 14 days: one request', async () => {
    const { db, calls } = pagedDb([{ calendar: 'us', day: '2026-12-03' }]);
    await expect(fetchCoberturaProxima(db, { calendars: ['us', 'eu'], from: '2026-12-03' })).resolves.toEqual({
      covered: [{ calendar: 'us', day: '2026-12-03' }],
      ate: '2026-12-17',
    });
    expect(calls[0].table).toBe('economic_calendar_days');
    expect(calls[0].ops).toEqual([
      ['select', 'calendar, day'],
      ['in', 'calendar', ['us', 'eu']],
      ['gte', 'day', '2026-12-03'],
      ['lte', 'day', '2026-12-17'],
      ['order', 'day', { ascending: true }],
    ]);
  });

  it('no calendar: nothing read; a bad row → bad_answer', async () => {
    const { db, calls } = pagedDb([]);
    await expect(fetchCoberturaProxima(db, { calendars: [], from: '2026-12-03' })).resolves.toEqual({ covered: [], ate: '2026-12-17' });
    expect(calls).toEqual([]);
    const bad = pagedDb([{ calendar: 'us', day: '3/12' }]);
    await expect(fetchCoberturaProxima(bad.db, { calendars: ['us'], from: '2026-12-03' })).rejects.toMatchObject({ code: 'bad_answer' });
  });

  const dias = (cal: 'us' | 'eu', de: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ calendar: cal, day: new Date(Date.parse(`${de}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10) }));

  it('the real end of the coverage: the last day of the unbroken run of every calendar followed', () => {
    // us covered through 31 Dec, eu through 8 Dec: the run ends on 8 Dec
    const covered = [...dias('us', '2026-12-03', 29), ...dias('eu', '2026-12-03', 6)];
    expect(ultimoDiaCoberto(['us'], '2026-12-03', null, { covered, ate: '2026-12-17' })).toBe('2026-12-17');
    expect(ultimoDiaCoberto(['eu', 'us'], '2026-12-03', null, { covered, ate: '2026-12-17' })).toBe('2026-12-08');
    // A hole (5 Dec) ends the run on the 4th; today not covered → yesterday
    const furo = dias('us', '2026-12-03', 15).filter((x) => x.day !== '2026-12-05');
    expect(ultimoDiaCoberto(['us'], '2026-12-03', null, { covered: furo, ate: '2026-12-17' })).toBe('2026-12-04');
    expect(ultimoDiaCoberto(['us'], '2026-12-03', null, { covered: dias('us', '2026-12-04', 5), ate: '2026-12-17' })).toBe('2026-12-02');
  });

  it('after 18:00 ET the read starts on the account\'s day (NY + 1) and still ends on the load\'s last New York date (review)', () => {
    // The daily load of Thu 3 Dec covers the NY dates 2..6 Dec; at 18:30 ET the futures day is already Fri 4 Dec
    const covered = dias('us', '2026-12-02', 5);
    const morning = tradingDayOn(et('2026-12-03 09:00'), TOP_CLOCK);
    const evening = tradingDayOn(et('2026-12-03 18:30'), TOP_CLOCK);
    expect([morning, evening]).toEqual(['2026-12-03', '2026-12-04']);
    expect(ultimoDiaCoberto(['us'], morning, null, { covered, ate: '2026-12-17' })).toBe('2026-12-06');
    expect(ultimoDiaCoberto(['us'], evening, null, { covered, ate: '2026-12-18' })).toBe('2026-12-06');
  });

  it('without the coverage read: E5\'s three days and board Q23\'s today + 3', () => {
    expect(ultimoDiaCoberto(['us'], '2026-12-03', dias('us', '2026-12-02', 3))).toBe('2026-12-06');
    expect(ultimoDiaCoberto(['us'], '2026-12-03', dias('us', '2026-12-02', 2))).toBe('2026-12-03');
    expect(ultimoDiaCoberto(['us'], '2026-12-03', undefined, null)).toBe('2026-12-06');
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
      if (f.entrada) expect(parseEntryDryRun(entradaDoEstado(e))).toBeTruthy();
      if (f.dia) expect(fs.existsSync(path.join(__dirname, '../../testing/fixtures/agenda', `${f.dia}.json`))).toBe(true);
    }
  });

  it.each([
    ['q33-registrar-espera', 'aguardar', 'espera'],
    ['q34-registrar-depois', 'aguardar', 'espera'],
    ['q35-registrar-dia', 'aguardar', 'dia'],
    ['q36-registrar-dois-avisos', 'aguardar', 'espera'],
    ['q38-aviso-10min-registrar', 'fora_janela', 'espera'],
  ] as [EstadoDados, string, string][])('the Registrar dry run of %s: status %s, its block\'s first interval %s', (e, status, kind) => {
    const json = entradaDoEstado(e) as { gate: { status: string; block: { today: { kind: string }[] } } };
    expect(parseEntryDryRun(json).gate.status).toBe(status);
    expect(json.gate.block.today[0].kind).toBe(kind);
  });

  it.each([
    ['q04-personalizar-0830', { releases: { cpi: 'depois', ppi: 'depois', payroll: 'depois', pce: 'depois', pib_us: 'depois', varejo_us: 'depois' } }],
    ['q40-personalizar-desligada', { on: false }],
    ['q41-personalizar-conta-antiga', { before_min: 3, after_min: 15 }],
    ['q42-personalizar-etiquetas', { releases: { fomc_decisao: 'dia', fomc_entrevista: 'dia' } }],
  ] as [EstadoDados, Record<string, unknown>][])('%s: the choice the frame shows as saved is on the account (no «não salvo» from a draft)', (e, block) => {
    const cfg = configDoQuadro(ESTADOS_DADOS[e].config) as { accounts: { settings: { rules: { block?: unknown } } }[] };
    expect(cfg.accounts[0].settings.rules.block).toEqual(block);
  });

  it('Q41 is Thu 3 Dec (ISM de serviços) before its 09:57 wait; Q17\'s limit is hit at 10:38 ET', () => {
    const q41 = ESTADOS_DADOS['q41-personalizar-conta-antiga'].agora;
    expect(tradingDayOn(q41, RELOGIO_TOP)).toBe('2026-12-03');
    expect(q41.getTime()).toBeLessThan(etQ('2026-12-03 09:57').getTime());
    expect(JSON.stringify(agoraDoEstado('q17-posso-encerrado-na-espera'))).toContain('"hit_at":"2026-12-09T15:38:00+00:00"');
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

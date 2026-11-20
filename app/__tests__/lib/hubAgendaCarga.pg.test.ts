/**
 * @jest-environment node
 *
 * The daily load (lib/domain/agenda/carga.ts runLoad, contract §3.7) against the real tables of 20261120000001, through
 * testing/pg's pgServiceClient() (every statement under `set role service_role`, as the route's client meets the
 * grants): run twice → the same rows; a moved release (was_at once); a status-only change moves updated_at; the
 * coverage rows; `authenticated` cannot write; without the tables nothing is written and the answer is sem_tabelas.
 * The table CHECK runs agenda_release_calendar as service_role, so these inserts also prove that grant. Skipped
 * unless BH_PG_URL is set (a throwaway cluster; never the hosted project). Invented lists only.
 */
import { randomUUID } from 'crypto';
import { parseBea } from '@/lib/domain/agenda/bea';
import { runLoad } from '@/lib/domain/agenda/carga';
import { BEA_CODES, type AgendaLists, type ListBlock, type ListCode } from '@/lib/domain/agenda/listas';
import { AGENDA_RELEASES } from '@/lib/domain/gate';
import { PG_URL, asUserExec, codeOf, pgServiceClient, psql } from '@/testing/pg';

const describePg = PG_URL ? describe : describe.skip;

// Invented lists (as carga.test.ts): every list code, whole years, one release a month on day 10 + ord % 10
const LIST_CODES = AGENDA_RELEASES.filter((r) => !(BEA_CODES as readonly string[]).includes(r.code));
const fakeBlock = (year: number, day: number): ListBlock => ({
  year,
  from: `${year}-01-01`,
  through: `${year}-12-31`,
  source: 'invented',
  read: '2026-11-20',
  entries: Array.from({ length: 12 }, (_, m) => ({ date: `${year}-${String(m + 1).padStart(2, '0')}-${day}` })),
});
const fakeLists = (): Record<ListCode, ListBlock[]> =>
  Object.fromEntries(LIST_CODES.map((r) => [r.code, [2026, 2027].map((y) => fakeBlock(y, 10 + (r.ord % 10)))])) as Record<ListCode, ListBlock[]>;
const listsWith = (code: ListCode, entries: ListBlock['entries']): AgendaLists => {
  const lists = fakeLists();
  lists[code] = [{ ...lists[code][0], entries }, lists[code][1]];
  return lists;
};
const monthlyBea = (year: number) => Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, '0')}-25T13:30:00+00:00`);
const BEA_OK = parseBea(
  { 'Gross Domestic Product': { release_dates: [...monthlyBea(2026), ...monthlyBea(2027)] }, 'Personal Income and Outlays': { release_dates: [...monthlyBea(2026), ...monthlyBea(2027)] } },
  '2026-11-20',
);
const NOW = new Date('2026-11-20T14:00:00Z');

type Row = { id: number; source: string; source_key: string; code: string | null; local_at: string; at: string; day: string; status: string; was_at: string | null; updated_at: string };
const rows = (): Row[] =>
  JSON.parse(
    psql(`select coalesce(jsonb_agg(to_jsonb(e) - 'first_seen_at' order by id), '[]')::text from (select id, source, source_key, code, local_at, at, day, status, was_at, updated_at, first_seen_at from public.economic_events) e;`).trim(),
  );
const row = (key: string) => rows().find((r) => r.source_key === key)!;

describePg('the daily load on the real tables (service role)', () => {
  beforeAll(() => {
    psql('truncate public.economic_events, public.economic_calendar_days;');
  });
  afterAll(() => {
    psql('truncate public.economic_events, public.economic_calendar_days;');
  });

  it('twice → the same rows; the coverage of now − 1 .. now + 3 written with source «rota»', async () => {
    const first = await runLoad(pgServiceClient(), NOW, { lists: fakeLists(), bea: BEA_OK });
    expect(first.ok).toBe(true);
    const before = rows();
    expect(first.ok && first.events.inserted).toBe(before.length);
    expect(before.length).toBeGreaterThan(200);
    const second = await runLoad(pgServiceClient(), NOW, { lists: fakeLists(), bea: BEA_OK });
    expect(second).toMatchObject({ ok: true, events: { inserted: 0, updated: 0, unchanged: before.length } });
    expect(rows()).toEqual(before);
    // the instant comes from Postgres (local_at AT TIME ZONE local_tz), never from the writer
    expect([row('cpi:2026-12-11').local_at, row('cpi:2026-12-11').at, row('cpi:2026-12-11').day]).toEqual(['2026-12-11T08:30:00', '2026-12-11T13:30:00+00:00', '2026-12-11']);
    const cov = JSON.parse(psql(`select jsonb_agg(jsonb_build_array(calendar, day, source) order by calendar, day)::text from public.economic_calendar_days;`).trim());
    const days = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'];
    expect(cov).toEqual(['br', 'eu', 'us'].flatMap((c) => days.map((d) => [c, d, 'rota'])));
  });

  it('a moved release moves its row: was_at written once, kept on a second move', async () => {
    await runLoad(pgServiceClient(), NOW, { lists: listsWith('cpi', [{ date: '2026-12-10' }]), bea: BEA_OK });
    expect(row('cpi:2026-12-10').was_at).toBeNull();
    const moved = await runLoad(pgServiceClient(), NOW, { lists: listsWith('cpi', [{ date: '2026-12-18', original: '2026-12-10' }]), bea: BEA_OK });
    expect(moved.ok && moved.events.updated).toBeGreaterThanOrEqual(1);
    const r = row('cpi:2026-12-10');
    expect([r.local_at, r.day, r.at, r.was_at]).toEqual(['2026-12-18T08:30:00', '2026-12-18', '2026-12-18T13:30:00+00:00', '2026-12-10T13:30:00+00:00']);
    await runLoad(pgServiceClient(), NOW, { lists: listsWith('cpi', [{ date: '2026-12-22', time: '10:00', original: '2026-12-10' }]), bea: BEA_OK });
    expect([row('cpi:2026-12-10').at, row('cpi:2026-12-10').was_at]).toEqual(['2026-12-22T15:00:00+00:00', '2026-12-10T13:30:00+00:00']);
  });

  it('a status-only change (cancelado) moves updated_at and keeps the instant', async () => {
    await runLoad(pgServiceClient(), NOW, { lists: listsWith('payroll', [{ date: '2026-12-04' }]), bea: BEA_OK });
    const before = row('payroll:2026-12-04');
    await new Promise((r) => setTimeout(r, 20));
    const r = await runLoad(pgServiceClient(), NOW, { lists: listsWith('payroll', [{ date: '2026-12-04', status: 'cancelado' }]), bea: BEA_OK });
    expect(r.ok && r.events.updated).toBe(1);
    const after = row('payroll:2026-12-04');
    expect([after.status, after.at, after.was_at]).toEqual(['cancelado', before.at, null]);
    expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse(before.updated_at));
  });

  it('`authenticated` cannot write either table (no browser write path)', () => {
    const uid = randomUUID();
    psql(`insert into auth.users (id, email) values ('${uid}', 'carga-${uid.slice(0, 8)}@example.test'); insert into public.hub_members (user_id) values ('${uid}');`);
    try {
      expect(
        codeOf(() =>
          asUserExec(uid, `insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz) values ('lista', 'cpi:2027-01-13', 'cpi', 'us', 'x', '2027-01-13 08:30', 'America/New_York');`),
        ),
      ).toBe('permission');
      expect(codeOf(() => asUserExec(uid, `insert into public.economic_calendar_days (calendar, day, source) values ('us', '2027-01-13', 'rota');`))).toBe('permission');
      expect(codeOf(() => asUserExec(uid, `update public.economic_events set status = 'cancelado';`))).toBe('permission');
    } finally {
      psql(`delete from auth.users where id = '${uid}';`);
    }
  });

  it('without the tables: sem_tabelas, and nothing written', async () => {
    const coverage = () => psql('select count(*) from public.economic_calendar_days;').trim();
    const n = coverage();
    psql('alter table public.economic_events rename to economic_events_fora;');
    try {
      expect(await runLoad(pgServiceClient(), new Date('2026-12-01T14:00:00Z'), { lists: fakeLists(), bea: BEA_OK })).toEqual({ ok: false, error: 'sem_tabelas' });
    } finally {
      psql('alter table public.economic_events_fora rename to economic_events;');
    }
    expect(coverage()).toBe(n);
    psql('alter table public.economic_calendar_days rename to economic_calendar_days_fora;');
    const events = rows().length;
    try {
      expect(await runLoad(pgServiceClient(), new Date('2026-12-01T14:00:00Z'), { lists: fakeLists(), bea: BEA_OK })).toEqual({ ok: false, error: 'sem_tabelas' });
    } finally {
      psql('alter table public.economic_calendar_days_fora rename to economic_calendar_days;');
    }
    expect(rows().length).toBe(events);
  });
});

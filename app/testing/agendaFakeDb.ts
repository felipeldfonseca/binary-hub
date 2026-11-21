/**
 * An in-memory stand-in for the two agenda tables behind the Supabase client, for the daily load's tests
 * (carga.test.ts, cronAgenda.test.ts). It does what the migration does for the writer (contract §3.2): the
 * trigger computes `at` and `day` from `local_at` AT TIME ZONE `local_tz` (here with tempo.localToUtc, the twin of
 * that conversion), `(source, source_key)` is unique (upsert = on conflict do update of the sent columns) and one
 * live row per (code, day). PostgREST's answers are imitated: `timestamp` as 'YYYY-MM-DDTHH:MM:SS', `timestamptz`
 * with '+00:00', and a missing table as PGRST205. The real tables are proven by the data lane's PG test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { localToUtc } from '@/lib/domain/tempo';

export interface FakeEventRow {
  id: number;
  source: string;
  source_key: string;
  code: string | null;
  calendar: string;
  title: string;
  local_at: string;
  local_tz: string;
  at: string;
  day: string;
  status: string;
  was_at: string | null;
}

export interface FakeDayRow {
  calendar: string;
  day: string;
  source: string;
  fetched_at: string;
}

export interface FakeAgendaDb {
  client: SupabaseClient;
  events: FakeEventRow[];
  days: FakeDayRow[];
  /** Every write: 'upsert economic_events (n)', 'update economic_events #id', … */
  writes: string[];
  /** Makes the next matching call answer with this error code */
  failNext: (table: string, op: 'select' | 'upsert' | 'update', code: string) => void;
}

const pgTimestamptz = (d: Date) => d.toISOString().replace('.000Z', '+00:00');

function instantOf(localAt: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(localAt);
  if (!m) throw new Error(`fake db: bad local_at ${localAt}`);
  return localToUtc(
    { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5], second: +m[6] },
    tz,
  );
}

export function fakeAgendaDb(options: { missing?: readonly ('economic_events' | 'economic_calendar_days')[] } = {}): FakeAgendaDb {
  const events: FakeEventRow[] = [];
  const days: FakeDayRow[] = [];
  const writes: string[] = [];
  const failures: { table: string; op: string; code: string }[] = [];
  let nextId = 1;

  const failure = (table: string, op: string) => {
    if ((options.missing ?? []).includes(table as never)) return { code: 'PGRST205', message: 'not found' };
    const i = failures.findIndex((f) => f.table === table && f.op === op);
    if (i < 0) return null;
    const [f] = failures.splice(i, 1);
    return { code: f.code, message: 'failure' };
  };

  const liveClash = (row: FakeEventRow) =>
    row.code !== null &&
    row.status !== 'cancelado' &&
    events.some((e) => e !== row && e.code === row.code && e.day === row.day && e.status !== 'cancelado');

  const applyTrigger = (row: FakeEventRow) => {
    row.at = pgTimestamptz(instantOf(row.local_at, row.local_tz));
    row.day = row.local_at.slice(0, 10);
  };

  const strip = (row: FakeEventRow, columns: string) => {
    const cols = columns.split(',').map((c) => c.trim());
    return Object.fromEntries(cols.map((c) => [c, (row as unknown as Record<string, unknown>)[c]]));
  };

  function selectBuilder(table: string, columns: string) {
    let from = 0;
    let to = Number.POSITIVE_INFINITY;
    const builder = {
      order: () => builder,
      range: (a: number, b: number) => {
        from = a;
        to = b;
        return builder;
      },
      limit: (n: number) => {
        to = n - 1;
        return builder;
      },
      then: (resolve: (v: unknown) => void) => {
        const error = failure(table, 'select');
        if (error) return resolve({ data: null, error });
        const source = table === 'economic_events' ? events.map((e) => strip(e, columns)) : days.map((d) => ({ ...d }));
        resolve({ data: source.slice(from, to + 1), error: null });
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select: (columns: string) => selectBuilder(table, columns),
        upsert: async (rows: Record<string, unknown>[], opts: { onConflict: string }) => {
          const error = failure(table, 'upsert');
          if (error) return { error };
          writes.push(`upsert ${table} (${rows.length})`);
          if (table === 'economic_calendar_days') {
            if (opts.onConflict !== 'calendar,day') throw new Error('fake db: conflict target');
            for (const r of rows) {
              const found = days.find((d) => d.calendar === r.calendar && d.day === r.day);
              if (found) Object.assign(found, r);
              else days.push({ ...(r as unknown as FakeDayRow) });
            }
            return { error: null };
          }
          if (opts.onConflict !== 'source,source_key') throw new Error('fake db: conflict target');
          for (const r of rows) {
            if ('at' in r || 'day' in r || 'id' in r) throw new Error('fake db: the writer sent at/day/id');
            const found = events.find((e) => e.source === r.source && e.source_key === r.source_key);
            if (found) {
              Object.assign(found, r);
              applyTrigger(found);
              if (liveClash(found)) return { error: { code: '23505', message: 'duplicate' } };
            } else {
              const row = { was_at: null, status: 'agendado', ...r, id: nextId++ } as FakeEventRow;
              applyTrigger(row);
              if (liveClash(row)) return { error: { code: '23505', message: 'duplicate' } };
              events.push(row);
            }
          }
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (column: string, value: unknown) => {
            const error = failure(table, 'update');
            if (error) return { error };
            if (column !== 'id') throw new Error('fake db: update by id only');
            if ('at' in patch || 'day' in patch) throw new Error('fake db: the writer sent at/day');
            writes.push(`update ${table} #${String(value)}`);
            const row = events.find((e) => e.id === value);
            if (row) {
              const before = { ...row };
              Object.assign(row, patch);
              applyTrigger(row);
              // the unique index economic_events_code_day: Postgres refuses the update and keeps the row
              if (liveClash(row)) {
                Object.assign(row, before);
                return { error: { code: '23505', message: 'duplicate' } };
              }
            }
            return { error: null };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    events,
    days,
    writes,
    failNext: (table, op, code) => failures.push({ table, op, code }),
  };
}

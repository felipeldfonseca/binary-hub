/**
 * Helpers for the suites that run the data layer against the real SQL on a throwaway local
 * Postgres (BH_PG_URL; never the hosted project): __tests__/lib/hubRegras.pg.test.ts and
 * hubMercados.pg.test.ts. Lives outside __tests__ so Jest does not run it as a suite.
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it
 *   BH_PSQL                                                 the psql binary (PG 15+)
 */
import { execFileSync } from 'child_process';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAccount, type NewAccount } from '@/lib/hub/contasDb';

export const PG_URL = process.env.BH_PG_URL;
const PSQL = process.env.BH_PSQL || '/opt/homebrew/opt/postgresql@15/bin/psql';

/** Runs SQL as the cluster's superuser; a failure throws an Error whose `code` is the database's bare message */
export function psql(sql: string): string {
  try {
    return execFileSync(PSQL, [PG_URL as string, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'], {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C', PGOPTIONS: '-c timezone=UTC' },
    }).toString();
  } catch (e) {
    const stderr = String((e as { stderr?: Buffer }).stderr ?? '');
    const m = /ERROR:\s+(\S+)/.exec(stderr);
    const h = /HINT:\s+(\S+)/.exec(stderr);
    const err = new Error(m ? m[1] : stderr);
    (err as Error & { code?: string }).code = m ? m[1] : 'psql';
    (err as Error & { hint?: string | null }).hint = h ? h[1] : null;
    throw err;
  }
}

export const lastLine = (out: string) => out.trim().split('\n').filter(Boolean).pop() ?? '';

/** A call as the signed-in user, in its own transaction, returning the JSON answer */
export function asUser(uid: string, expr: string): unknown {
  return JSON.parse(
    lastLine(
      psql(`begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
select (${expr})::text;
commit;`),
    ),
  );
}

/** Statements as the signed-in user (an insert through the API's row-level security); returns the last output line */
export function asUserExec(uid: string, sql: string): string {
  return lastLine(
    psql(`begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
${sql}
commit;`),
  );
}

/** A jsonb literal */
export const lit = (json: unknown) => `$bh$${JSON.stringify(json)}$bh$::jsonb`;

/** A SQL literal of a JSON scalar (what PostgREST would bind) */
export function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** The database's code a call failed with, or null */
export function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'thrown';
  }
}

/**
 * The row lib/hub/contasDb.createAccount inserts for `input` (through a client that only records
 * it): exactly what the hub sends to trading_accounts.
 */
export async function createAccountRow(userId: string, input: NewAccount): Promise<Record<string, unknown>> {
  let row: Record<string, unknown> | null = null;
  const db = {
    from: () => ({
      insert: (r: Record<string, unknown>) => {
        row = r;
        return { select: () => ({ single: async () => ({ data: { id: 'recorded' }, error: null }) }) };
      },
    }),
  } as unknown as SupabaseClient;
  await createAccount(db, userId, input);
  return row as unknown as Record<string, unknown>;
}

/**
 * Creates an account as the hub does: createAccount's row, inserted as the signed-in user under
 * row-level security (the REST insert). Returns the new id.
 */
export async function createAccountAsUser(uid: string, input: NewAccount): Promise<string> {
  const row = await createAccountRow(uid, input);
  const cols = Object.keys(row);
  return asUserExec(
    uid,
    `insert into public.trading_accounts (${cols.join(', ')}) values (${cols.map((c) => sqlValue(row[c])).join(', ')}) returning id;`,
  );
}

// ---------------------------------------------------------------------------------------------
// A stand-in Supabase client on the real SQL (Phase 3 screens' recorder)
// ---------------------------------------------------------------------------------------------

type PgAnswer = { data: unknown; error: unknown };

/** One expression as the signed-in user: { data } or { error } with the message and HINT, as PostgREST gives them */
export function callAs(uid: string, expr: string): PgAnswer {
  try {
    const out = psql(`begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
select 'json:' || coalesce((${expr})::text, 'null');
commit;`);
    const line = out.split('\n').find((l) => l.startsWith('json:'));
    return { data: line ? JSON.parse(line.slice(5)) : null, error: null };
  } catch (e) {
    return { data: null, error: { message: (e as { code?: string }).code ?? 'psql', hint: (e as { hint?: string | null }).hint ?? null, details: null, code: 'P0001' } };
  }
}

/** A SQL literal of a PostgREST argument (strings, numbers, booleans, text arrays, jsonb) */
export function sqlArg(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return `array[${v.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
  if (typeof v === 'object') return lit(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const OPS: Record<string, string> = { eq: '=', gte: '>=', gt: '>', lte: '<=', lt: '<', neq: '<>' };

/** PostgREST's or=(…) logic tree, flat: «col.op.value» items, a value in double quotes when it holds reserved characters */
function orFilter(expr: string): string {
  const items: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '\\' && quoted) {
      cur += expr[++i];
      continue;
    }
    if (c === '"') {
      quoted = !quoted;
      continue;
    }
    if (c === ',' && !quoted) {
      items.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  items.push(cur);
  return `(${items
    .map((item) => {
      const m = /^([a-z_]+)\.([a-z]+)\.(.*)$/.exec(item);
      if (!m || !OPS[m[2]]) throw new Error(`or(): ${item}`);
      return `${m[1]} ${OPS[m[2]]} ${sqlArg(m[3])}`;
    })
    .join(' or ')})`;
}

/** PostgREST's table reads (select, eq, in, or, gte, order, limit, maybeSingle) as the user, under row-level security */
export function pgFrom(uid: string) {
  return (table: string) => {
    let cols = '*';
    let single = false;
    let limit: number | null = null;
    const where: string[] = [];
    const order: string[] = [];
    const chain: Record<string, unknown> = {
      select: (c: string) => ((cols = c), chain),
      eq: (c: string, v: unknown) => (where.push(`${c} = ${sqlArg(v)}`), chain),
      gte: (c: string, v: unknown) => (where.push(`${c} >= ${sqlArg(v)}`), chain),
      in: (c: string, v: unknown[]) => (where.push(`${c} in (${v.map(sqlArg).join(', ')})`), chain),
      or: (expr: string) => (where.push(orFilter(expr)), chain),
      order: (c: string, o?: { ascending?: boolean }) => (order.push(`${c}${o?.ascending === false ? ' desc' : ''}`), chain),
      limit: (n: number) => ((limit = n), chain),
      maybeSingle: () => ((single = true), chain),
      then: (resolve: (v: PgAnswer) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const sql =
              `(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select ${cols} from public.${table}` +
              `${where.length ? ` where ${where.join(' and ')}` : ''}${order.length ? ` order by ${order.join(', ')}` : ''}` +
              `${limit !== null ? ` limit ${limit}` : ''}) t)`;
            const r = callAs(uid, sql);
            if (r.error) return r;
            const rows = r.data as unknown[];
            return { data: single ? (rows[0] ?? null) : rows, error: null };
          })
          .then(resolve, reject),
    };
    return chain;
  };
}

/**
 * A stand-in for the Supabase client on the real SQL: each rpc and table read runs as `uid`
 * (PostgREST's named arguments); Storage uploads insert the object row as the Storage API does
 * (owner, size, mimetype), removes delete it. `log` keeps every rpc's raw answer.
 */
export function pgClient(uid: string, log: { name: string; args: Record<string, unknown>; answer: PgAnswer }[] = []): SupabaseClient {
  return {
    from: pgFrom(uid),
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      const run = () => {
        const answer = callAs(uid, `public.${name}(${Object.entries(args).map(([k, v]) => `${k} => ${sqlArg(v)}`).join(', ')})`);
        log.push({ name, args, answer });
        return answer;
      };
      const call = {
        abortSignal: () => call,
        then: (resolve: (v: PgAnswer) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
      };
      return call;
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (p: string, file: Blob, o: { contentType: string }) => {
          try {
            asUserExec(
              uid,
              // As the Storage API records a Blob's form part: its own type (the contentType option is not sent)
              `insert into storage.objects (bucket_id, name, owner_id, metadata) values (${sqlArg(bucket)}, ${sqlArg(p)}, '${uid}', ${lit({ size: file.size, mimetype: file.type || o.contentType })});`,
            );
            return { data: { path: p }, error: null };
          } catch (e) {
            return { data: null, error: { message: (e as Error).message, statusCode: '403' } };
          }
        },
        remove: async (paths: string[]) => {
          psql(`set storage.allow_delete_query = 'true'; delete from storage.objects where bucket_id = ${sqlArg(bucket)} and owner_id = '${uid}' and name in (${paths.map(sqlArg).join(', ')});`);
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

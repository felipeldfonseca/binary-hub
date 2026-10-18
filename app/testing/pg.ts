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
    const err = new Error(m ? m[1] : stderr);
    (err as Error & { code?: string }).code = m ? m[1] : 'psql';
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

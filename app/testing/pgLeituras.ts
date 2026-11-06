/**
 * Fase 4 · telas, lane L1: testing/pg's stand-in Supabase client on the real SQL, with the table reads lib/hub/contasDb's
 * fetchBatchUndo makes since Phase 4 («Saem junto», D20): PostgREST's `not(column, 'is', null)` and several `in`
 * filters on one read, beside what testing/pg's reads already take (select with { count: 'exact', head }, eq, gte, in,
 * order, range). Each read runs as the user, under row-level security, through testing/pg's callAs; rpc and Storage are
 * testing/pg's own. Lives outside __tests__ so Jest does not run it as a suite. Never the hosted project.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { callAs, pgClient, sqlArg } from './pg'

type Resposta = { data: unknown; error: unknown; count?: number | null }

/** One table read as `uid`, with `not … is null` */
function ler(uid: string) {
  return (table: string) => {
    let cols = '*'
    let count = false
    let head = false
    let limit: number | null = null
    let offset = 0
    const where: string[] = []
    const order: string[] = []
    const chain: Record<string, unknown> = {
      select: (c: string, o?: { count?: 'exact'; head?: boolean }) => ((cols = c), (count = o?.count === 'exact'), (head = !!o?.head), chain),
      eq: (c: string, v: unknown) => (where.push(`${c} = ${sqlArg(v)}`), chain),
      gte: (c: string, v: unknown) => (where.push(`${c} >= ${sqlArg(v)}`), chain),
      in: (c: string, v: unknown[]) => (where.push(v.length ? `${c} in (${v.map(sqlArg).join(', ')})` : 'false'), chain),
      not: (c: string, op: string, v: unknown) => {
        if (op !== 'is' || v !== null) throw new Error(`not(): only «is null» (${c} ${op})`)
        where.push(`${c} is not null`)
        return chain
      },
      order: (c: string, o?: { ascending?: boolean }) => (order.push(`${c}${o?.ascending === false ? ' desc' : ''}`), chain),
      range: (from: number, to: number) => ((offset = from), (limit = to - from + 1), chain),
      then: (resolve: (v: Resposta) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve()
          .then((): Resposta => {
            const filter = where.length ? ` where ${where.join(' and ')}` : ''
            const rowsSql = head
              ? `'[]'::jsonb`
              : `(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select ${cols} from public.${table}${filter}` +
                `${order.length ? ` order by ${order.join(', ')}` : ''}${limit !== null ? ` limit ${limit}` : ''}${offset ? ` offset ${offset}` : ''}) t)`
            const countSql = count ? `(select count(*) from public.${table}${filter})` : 'null'
            const r = callAs(uid, `jsonb_build_object('rows', ${rowsSql}, 'count', ${countSql})`)
            if (r.error) return r
            const { rows, count: n } = r.data as { rows: unknown[]; count: number | null }
            return { data: head ? null : rows, error: null, ...(count ? { count: n } : {}) }
          })
          .then(resolve, reject),
    }
    return chain
  }
}

/** testing/pg's pgClient, its table reads able to say `not(column, 'is', null)` */
export function pgClientComNot(uid: string, log?: Parameters<typeof pgClient>[1]): SupabaseClient {
  const base = pgClient(uid, log) as unknown as Record<string, unknown>
  return { ...base, from: ler(uid) } as unknown as SupabaseClient
}

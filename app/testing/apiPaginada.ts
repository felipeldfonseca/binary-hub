/**
 * A stand-in Supabase client whose table reads answer as PostgREST does past its row limit (supabase/config.toml
 * max_rows = 1000): at most `maxRows` rows per request, whatever the range asked, in the order asked, with the exact
 * count of every matching row when { count: 'exact' } is asked. For the reads the hub makes whole (contasDb's readAll).
 * Lives outside __tests__ so Jest does not run it as a suite. Invented data only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>

export interface LeituraPaginada {
  table: string
  select: string
  count: boolean
  eq: [string, unknown][]
  order: string[]
  range: [number, number] | null
}

export interface ApiPaginada {
  db: SupabaseClient
  /** Every request, in the order made */
  calls: LeituraPaginada[]
}

/**
 * `tables`: each table's rows; `maxRows`: the API's row limit; `falha`: an error the request gets instead of its rows
 * (its message is a database error's, as PostgREST gives it), or undefined to answer it
 */
export function apiPaginada(
  tables: Readonly<Record<string, readonly Linha[]>>,
  maxRows = 1000,
  falha: (call: LeituraPaginada) => { message: string; code?: string } | undefined = () => undefined,
): ApiPaginada {
  const calls: LeituraPaginada[] = []
  const from = (table: string) => {
    const call: LeituraPaginada = { table, select: '', count: false, eq: [], order: [], range: null }
    calls.push(call)
    const chain = {
      select: (cols: string, o?: { count?: 'exact' }) => ((call.select = cols), (call.count = o?.count === 'exact'), chain),
      eq: (c: string, v: unknown) => (call.eq.push([c, v]), chain),
      order: (c: string) => (call.order.push(c), chain),
      range: (a: number, b: number) => ((call.range = [a, b]), chain),
      then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => {
        const error = falha(call)
        if (error) return Promise.resolve({ data: null, error, count: null }).then(ok, ko)
        let rows = (tables[table] ?? []).filter((r) => call.eq.every(([c, v]) => r[c] === v))
        const count = call.count ? rows.length : null
        for (const c of call.order.slice().reverse()) rows = rows.slice().sort((a, b) => String(a[c]).localeCompare(String(b[c])))
        if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
        const cols = call.select.split(',').map((c) => c.trim())
        const data = rows.slice(0, maxRows).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))
        return Promise.resolve({ data, error: null, count }).then(ok, ko)
      },
    }
    return chain
  }
  return { db: { from } as unknown as SupabaseClient, calls }
}

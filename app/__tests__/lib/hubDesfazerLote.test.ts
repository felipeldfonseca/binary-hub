/**
 * @jest-environment node
 *
 * fetchBatchUndo (Personalizar › Suas contas › Importações, «Desfazer»): what undoing a batch does, in trades, read
 * with the user's session (no database change). Here its reads on a recording client: the head count of the batch's
 * trades, the links and the file exits read whole past the API's row limit, the trades they are on asked in short
 * `in` lists. The real SQL's answers are in hubImportDesfazer.pg.test.ts.
 */
import { fetchBatchUndo, HubDataError } from '@/lib/hub/contasDb'

type Call = { table: string; select: string; opts?: { count?: string; head?: boolean }; eq: [string, unknown][]; in?: [string, string[]]; range?: [number, number]; order?: string }

/** A client whose reads answer from `tables`, `limit` rows at most per request (the API's max rows) */
function client(tables: Record<string, Record<string, unknown>[]>, limit = 1000, calls: Call[] = []) {
  return {
    calls,
    db: {
      from: (table: string) => {
        const call: Call = { table, select: '', eq: [] }
        calls.push(call)
        const chain = {
          select: (c: string, o?: Call['opts']) => ((call.select = c), (call.opts = o), chain),
          eq: (c: string, v: unknown) => (call.eq.push([c, v]), chain),
          in: (c: string, v: string[]) => ((call.in = [c, v]), chain),
          order: (c: string) => ((call.order = c), chain),
          range: (a: number, b: number) => ((call.range = [a, b]), chain),
          then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => {
            let rows = (tables[table] ?? []).filter((r) => call.eq.every(([c, v]) => r[c] === v))
            if (call.in) rows = rows.filter((r) => (call.in as [string, string[]])[1].includes(r[(call.in as [string, string[]])[0]] as string))
            const count = call.opts?.count === 'exact' ? rows.length : null
            if (call.order) rows = [...rows].sort((a, b) => String(a[call.order as string]).localeCompare(String(b[call.order as string])))
            if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
            rows = rows.slice(0, limit)
            const pick = (r: Record<string, unknown>) => Object.fromEntries(call.select.split(', ').map((k) => [k, r[k]]))
            return Promise.resolve({ data: call.opts?.head ? null : rows.map(pick), error: null, count }).then(ok, ko)
          },
        }
        return chain
      },
    } as never,
  }
}

const id = (p: string, i: number) => `${p}-${String(i).padStart(5, '0')}`

describe('fetchBatchUndo', () => {
  it('counts the trades it deletes, their lines, and the trades it gives back, past the row limit', async () => {
    const B = 'lote-1'
    // 1 200 trades of the batch: 1 196 of one row, 4 positions of 2, 3, 2 and 2 rows (file exits of this batch)
    const trades: Record<string, unknown>[] = Array.from({ length: 1200 }, (_, i) => ({ id: id('t', i), import_batch_id: B, source: 'import' }))
    const exits: Record<string, unknown>[] = []
    let e = 0
    for (const [t, n] of [[0, 2], [1, 3], [2, 2], [3, 2]] as const) for (let k = 0; k < n; k++) exits.push({ id: id('e', e++), trade_id: id('t', t), batch_id: B })
    // 1 100 registered trades it completed (more links than one page), one with two exits of this batch
    for (let i = 0; i < 1100; i++) trades.push({ id: id('r', i), import_batch_id: null, source: i % 2 ? 'live' : 'after' })
    exits.push({ id: id('e', e++), trade_id: id('r', 0), batch_id: B }, { id: id('e', e++), trade_id: id('r', 0), batch_id: B })
    // 2 imported trades of an earlier batch that its rows joined; another batch's exit and link (never counted)
    trades.push({ id: id('x', 0), import_batch_id: 'lote-0', source: 'import' }, { id: id('x', 1), import_batch_id: 'lote-0', source: 'import' })
    exits.push({ id: id('e', e++), trade_id: id('x', 0), batch_id: B }, { id: id('e', e++), trade_id: id('x', 1), batch_id: B })
    exits.push({ id: id('e', e++), trade_id: id('t', 9), batch_id: 'lote-2' })
    const links = [
      ...Array.from({ length: 1100 }, (_, i) => ({ trade_id: id('r', i), batch_id: B })),
      { trade_id: id('x', 0), batch_id: B },
      { trade_id: id('x', 1), batch_id: B },
      { trade_id: id('t', 9), batch_id: 'lote-2' },
    ]
    // The API's row limit lower than a page: every read still comes whole
    const { db, calls } = client({ trades, trade_exits: exits, trade_import_links: links }, 400)

    expect(await fetchBatchUndo(db, B)).toEqual({ trades: 1200, exits: 1196 + 9, registered: 1100, existing: 2 })

    const head = calls.filter((c) => c.opts?.head)
    expect(head).toEqual([expect.objectContaining({ table: 'trades', eq: [['import_batch_id', B]], opts: { count: 'exact', head: true } })])
    // Pages from what came: 400 rows per answer
    expect(calls.filter((c) => c.table === 'trade_import_links').map((c) => c.range)).toEqual([[0, 999], [400, 1399], [800, 1799]])
    expect(calls.filter((c) => c.table === 'trade_exits').map((c) => c.range)).toEqual([[0, 999]])
    // The trades those rows are on, 100 ids per request (1 100 links + 4 positions + 2 joined)
    const lists = calls.filter((c) => c.in)
    expect(lists.map((c) => c.in?.[1].length)).toEqual([...Array(11).fill(100), 6])
  })

  it('a batch whose rows were all new single trades: no further read', async () => {
    const { db, calls } = client({ trades: [{ id: 't1', import_batch_id: 'b' }, { id: 't2', import_batch_id: 'b' }] })
    expect(await fetchBatchUndo(db, 'b')).toEqual({ trades: 2, exits: 2, registered: 0, existing: 0 })
    expect(calls.map((c) => c.table)).toEqual(['trades', 'trade_import_links', 'trade_exits'])
  })

  it('a failed read is a HubDataError (never the database text)', async () => {
    const db = {
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          range: () => chain,
          then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'permission denied for table trades', code: '42501' } }).then(ok),
        }
        return chain
      },
    } as never
    await expect(fetchBatchUndo(db, 'b')).rejects.toEqual(new HubDataError('unknown'))
  })
})

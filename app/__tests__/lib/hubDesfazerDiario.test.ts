/**
 * @jest-environment node
 *
 * Fase 4 · telas, lane L1 (D20): fetchBatchUndo also counts what the owner put in the Diário on the batch's OWN trades
 * («Saem junto: 2 marcas e 1 nota que você pôs no Diário.»): the batch's trade ids read whole past the API's row limit,
 * then, per short `in` list, three head counts: the marks in force (trade_marks_now_v with a value, setup / execução /
 * emoção), the saved images (trade_attachments 'ok'), the trades with a note. A trade the batch only completed keeps
 * its own. No count is asked without own trades. Here on a recording client; the real SQL in hubDiarioDesfazer.pg.
 */
import { fetchBatchUndo, HubDataError } from '@/lib/hub/contasDb'

type Linha = Record<string, unknown>
interface Chamada {
  table: string
  select: string
  opts?: { count?: string; head?: boolean }
  eq: [string, unknown][]
  ins: [string, string[]][]
  notNull: string[]
  range?: [number, number]
  order?: string
}

/** A client whose reads answer from `tables` (at most `limit` rows a request), recording every call */
function cliente(tables: Record<string, Linha[]>, limit = 1000, falhar?: (c: Chamada) => boolean) {
  const calls: Chamada[] = []
  const db = {
    from: (table: string) => {
      const call: Chamada = { table, select: '', eq: [], ins: [], notNull: [] }
      calls.push(call)
      const chain = {
        select: (c: string, o?: Chamada['opts']) => ((call.select = c), (call.opts = o), chain),
        eq: (c: string, v: unknown) => (call.eq.push([c, v]), chain),
        in: (c: string, v: string[]) => (call.ins.push([c, v]), chain),
        not: (c: string, op: string, v: unknown) => {
          if (op !== 'is' || v !== null) throw new Error(`not ${c} ${op}`)
          call.notNull.push(c)
          return chain
        },
        order: (c: string) => ((call.order = c), chain),
        range: (a: number, b: number) => ((call.range = [a, b]), chain),
        then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => {
          if (falhar?.(call)) return Promise.resolve({ data: null, error: { message: 'relation "trade_marks_now_v" does not exist', code: '42P01' }, count: null }).then(ok, ko)
          let rows = (tables[table] ?? []).filter((r) => call.eq.every(([c, v]) => r[c] === v))
          for (const [c, v] of call.ins) rows = rows.filter((r) => v.includes(r[c] as string))
          for (const c of call.notNull) rows = rows.filter((r) => r[c] !== null && r[c] !== undefined)
          const count = call.opts?.count === 'exact' ? rows.length : null
          if (call.order) rows = [...rows].sort((a, b) => String(a[call.order as string]).localeCompare(String(b[call.order as string])))
          if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
          rows = rows.slice(0, limit)
          const pick = (r: Linha) => Object.fromEntries(call.select.split(', ').map((k) => [k, r[k]]))
          return Promise.resolve({ data: call.opts?.head ? null : rows.map(pick), error: null, count }).then(ok, ko)
        },
      }
      return chain
    },
  } as never
  return { db, calls }
}

const id = (p: string, i: number) => `${p}-${String(i).padStart(5, '0')}`

describe('fetchBatchUndo · «Saem junto»', () => {
  it('counts the marks in force, the saved images and the notes on the batch’s own trades only', async () => {
    const B = 'lote-11nov'
    const trades: Linha[] = [
      // 5 trades of the batch: two with marks, one with a note, one with an image
      ...Array.from({ length: 5 }, (_, i) => ({ id: id('t', i), import_batch_id: B, source: 'import', note: i === 1 ? 'Entrei cedo.' : null })),
      // a trade registered in the app that the batch completed: its marks and note stay
      { id: 'reg-1', import_batch_id: null, source: 'live', note: 'Minha nota' },
    ]
    const marks: Linha[] = [
      { trade_id: id('t', 0), kind: 'setup', current_value: 'B' },
      { trade_id: id('t', 2), kind: 'emocao', current_value: 'calmo' },
      // a mark taken back (no value now) and a kind the Diário never sets
      { trade_id: id('t', 3), kind: 'execucao', current_value: null },
      { trade_id: id('t', 4), kind: 'seguiu_texto', current_value: 'sim' },
      { trade_id: 'reg-1', kind: 'setup', current_value: 'A' },
    ]
    const images: Linha[] = [
      { id: 'img-1', trade_id: id('t', 2), status: 'ok' },
      // a reserved slot whose upload never finished
      { id: 'img-2', trade_id: id('t', 2), status: 'pendente' },
      { id: 'img-3', trade_id: 'reg-1', status: 'ok' },
    ]
    const links = [{ trade_id: 'reg-1', batch_id: B }]
    const { db, calls } = cliente({ trades, trade_marks_now_v: marks, trade_attachments: images, trade_import_links: links, trade_exits: [] })

    const undo = await fetchBatchUndo(db, B)
    expect(undo).toEqual({ trades: 5, exits: 5, registered: 1, existing: 0, diario: { marks: 2, images: 1, notes: 1 } })

    // The reads: the own ids in a stable order, then one list of 5 ids for each count
    const proprias = calls.find((c) => c.table === 'trades' && c.range)
    expect(proprias).toEqual(expect.objectContaining({ select: 'id', eq: [['import_batch_id', B]], order: 'id', opts: { count: 'exact' } }))
    expect(calls.find((c) => c.table === 'trade_marks_now_v')).toEqual(
      expect.objectContaining({
        select: 'trade_id',
        opts: { count: 'exact', head: true },
        ins: [
          ['trade_id', Array.from({ length: 5 }, (_, i) => id('t', i))],
          ['kind', ['setup', 'execucao', 'emocao']],
        ],
        notNull: ['current_value'],
      }),
    )
    expect(calls.find((c) => c.table === 'trade_attachments')).toEqual(
      expect.objectContaining({ select: 'id', opts: { count: 'exact', head: true }, eq: [['status', 'ok']], ins: [['trade_id', expect.any(Array)]] }),
    )
    expect(calls.find((c) => c.table === 'trades' && c.notNull.length)).toEqual(
      expect.objectContaining({ select: 'id', opts: { count: 'exact', head: true }, notNull: ['note'], ins: [['id', expect.any(Array)]] }),
    )
  })

  it('past the API’s row limit: every own id read, the counts asked 100 ids at a time and summed', async () => {
    const B = 'lote-grande'
    const trades: Linha[] = Array.from({ length: 1250 }, (_, i) => ({ id: id('t', i), import_batch_id: B, source: 'import', note: i % 100 === 0 ? 'n' : null }))
    const marks: Linha[] = Array.from({ length: 1250 }, (_, i) => ({ trade_id: id('t', i), kind: 'setup', current_value: 'A' }))
    const { db, calls } = cliente({ trades, trade_marks_now_v: marks }, 500)

    const undo = await fetchBatchUndo(db, B)
    expect(undo.diario).toEqual({ marks: 1250, images: 0, notes: 13 })
    expect(calls.filter((c) => c.table === 'trades' && c.range).map((c) => c.range)).toEqual([[0, 999], [500, 1499], [1000, 1999]])
    const listas = calls.filter((c) => c.table === 'trade_marks_now_v').map((c) => c.ins[0][1].length)
    expect(listas).toEqual([...Array(12).fill(100), 50])
    expect(calls.filter((c) => c.table === 'trade_attachments')).toHaveLength(13)
  })

  it('a batch without trades of its own (it only completed registered ones): no count is asked, all zero', async () => {
    const B = 'lote-25nov'
    const { db, calls } = cliente({
      trades: [{ id: 'reg-1', import_batch_id: null, source: 'live', note: 'x' }],
      trade_import_links: [{ trade_id: 'reg-1', batch_id: B }],
      trade_marks_now_v: [{ trade_id: 'reg-1', kind: 'setup', current_value: 'A' }],
    })
    expect(await fetchBatchUndo(db, B)).toEqual({ trades: 0, exits: 0, registered: 1, existing: 0, diario: { marks: 0, images: 0, notes: 0 } })
    expect(calls.some((c) => c.table === 'trade_marks_now_v' || c.table === 'trade_attachments')).toBe(false)
  })

  it('a failed count fails the whole read as a HubDataError (never the database text)', async () => {
    const { db } = cliente({ trades: [{ id: 't1', import_batch_id: 'b', source: 'import', note: null }] }, 1000, (c) => c.table === 'trade_marks_now_v')
    await expect(fetchBatchUndo(db, 'b')).rejects.toBeInstanceOf(HubDataError)
  })
})

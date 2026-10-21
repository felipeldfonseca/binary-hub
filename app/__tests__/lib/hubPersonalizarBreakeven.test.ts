/**
 * @jest-environment node
 *
 * Fase 3c · lane C2 · lib/hub/personalizarBreakeven (telas contract §6.5, §8.2): the table's roots,
 * the lines' order, the first switch-on's roots, a version's items (invented data).
 */
import { tradeInstrument } from '@/lib/domain/registro'
import { resolveBreakeven } from '@/lib/hub/regras'
import { RAIZES_BREAKEVEN, itensBreakeven, linhasBreakeven, raizesLivres, raizesMaisOperadas } from '@/lib/hub/personalizarBreakeven'

const em = (iso: string) => new Date(iso)
const op = (symbol: string, iso: string) => ({ symbol, entryTime: em(iso) })

describe('the futures table’s roots', () => {
  it('are the board’s eight, each a futures instrument whose stops are points, so each resolves with unit «pts»', () => {
    expect(RAIZES_BREAKEVEN).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC', 'MCL', 'CL'])
    for (const k of RAIZES_BREAKEVEN) expect(tradeInstrument('futures', k, null)?.stops).toBe('pts')
    const by = Object.fromEntries(RAIZES_BREAKEVEN.map((k, i) => [k, String(i + 1)]))
    const r = resolveBreakeven('futures', { on: true, by })
    expect(Object.keys(r?.by ?? {})).toEqual([...RAIZES_BREAKEVEN])
    for (const k of RAIZES_BREAKEVEN) expect(r?.by[k].un).toBe('pts')
  })

  it('«Adicionar ativo» offers every root not listed, in the table’s order (a removed one comes back)', () => {
    expect(raizesLivres(['MES', 'MNQ', 'MGC'])).toEqual(['ES', 'NQ', 'GC', 'MCL', 'CL'])
    expect(raizesLivres(['MNQ', 'MGC'])).toEqual(['MES', 'ES', 'NQ', 'GC', 'MCL', 'CL'])
    expect(raizesLivres([...RAIZES_BREAKEVEN])).toEqual([])
  })
})

describe('the lines’ order', () => {
  it('the saved assets in the table’s order, then those added in this session in the order added (with a value or pending)', () => {
    expect(linhasBreakeven({ MGC: '5', MES: '8', MNQ: '30' }, [])).toEqual(['MES', 'MNQ', 'MGC'])
    expect(linhasBreakeven({ MGC: '5', MES: '8', CL: '1' }, ['CL', 'ES'])).toEqual(['MES', 'MGC', 'CL', 'ES'])
    // Other keys after the table's, alphabetically
    expect(linhasBreakeven({ ZN: '1', MES: '8', NG: '2' }, [])).toEqual(['MES', 'NG', 'ZN'])
    expect(linhasBreakeven({}, ['MES', 'MNQ', 'MGC'])).toEqual(['MES', 'MNQ', 'MGC'])
  })
})

describe('the first switch-on’s roots (E51)', () => {
  it('the table roots most traded, up to 3, by count; ties by the most recent; contract codes count as their root', () => {
    const trades = [
      op('MNQZ6', '2026-10-20T14:00:00Z'),
      op('MNQ', '2026-10-21T14:00:00Z'),
      op('MES', '2026-10-22T14:00:00Z'),
      op('MESZ6', '2026-10-19T14:00:00Z'),
      op('MGC', '2026-10-18T14:00:00Z'),
      op('ES', '2026-10-23T14:00:00Z'),
      op('ZN', '2026-10-23T15:00:00Z'),
      op('ZN', '2026-10-23T16:00:00Z'),
      op('ZN', '2026-10-23T17:00:00Z'),
    ]
    // MNQ 2 (last 21 Oct), MES 2 (last 22 Oct) → MES first; then ES 1 (23 Oct) before MGC 1 (18 Oct); ZN is not a table root
    expect(raizesMaisOperadas(trades)).toEqual(['MES', 'MNQ', 'ES'])
  })

  it('no history (or none of the table’s roots): MES', () => {
    expect(raizesMaisOperadas([])).toEqual(['MES'])
    expect(raizesMaisOperadas([op('ZN', '2026-10-23T15:00:00Z')])).toEqual(['MES'])
  })
})

describe('a version’s items', () => {
  it('the table’s order, «+N» pt-BR; none without a rule', () => {
    expect(itensBreakeven({ by: { MGC: { n: '5', un: 'pts' }, MES: { n: '8', un: 'pts' }, MNQ: { n: '7.5', un: 'pts' } } })).toEqual([
      { ativo: 'MES', n: '8' },
      { ativo: 'MNQ', n: '7,5' },
      { ativo: 'MGC', n: '5' },
    ])
    expect(itensBreakeven(undefined)).toEqual([])
  })
})

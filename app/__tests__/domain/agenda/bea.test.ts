/**
 * @jest-environment node
 */
import { BEA_URL, fetchBea, parseBea } from '@/lib/domain/agenda/bea'

// Invented file in the BEA's shape (12 dates in 2027 so the year counts as whole)
const monthly2027 = Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, '0')}-20T13:30:00+00:00`)
const file = (gdp: unknown, pio: unknown = gdp) => ({
  'U.S. International Trade in Goods and Services': { release_dates: ['2026-01-07T13:30:00+00:00'] },
  'Gross Domestic Product': { release_dates: gdp },
  'Personal Income and Outlays': { release_dates: pio },
  file_last_updated: '2026-10-22T00:00:00+00:00',
})

describe('parseBea', () => {
  it('turns offset instants into the New York wall clock on both sides of the DST change', () => {
    const r = parseBea(file(['2026-10-29T12:30:00+00:00', '2026-11-25T13:30:00+00:00', '2026-11-03T09:30:00-05:00']), '2026-11-20')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.blocks.pib_us[0].entries).toEqual([
      { date: '2026-10-29', time: '08:30' }, // EDT (UTC−4)
      { date: '2026-11-03', time: '09:30' }, // EST (UTC−5), offset given in the string
      { date: '2026-11-25', time: '08:30' }, // EST
    ])
    // spring: 14 Mar 2027 is the first day of EDT
    const s = parseBea(file(['2027-03-05T13:30:00Z', '2027-03-16T12:30:00Z']), '2026-11-20')
    expect(s.ok && s.blocks.pce[0].entries.map((e) => e.time)).toEqual(['08:30', '08:30'])
  })

  it('keeps 2026 on; a year of 12+ dates or followed by another is whole; the last short year ends at its last date', () => {
    const r = parseBea(file(['2025-12-23T13:30:00+00:00', '2026-12-23T13:30:00+00:00', ...monthly2027]), '2026-11-20')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.blocks.pce.map((b) => [b.year, b.from, b.through, b.entries.length])).toEqual([
      [2026, '2026-01-01', '2026-12-31', 1], // followed by 2027 in the file: whole
      [2027, '2027-01-01', '2027-12-31', 12],
    ])
    const short = parseBea(file([...monthly2027, '2028-01-27T13:30:00+00:00']), '2026-11-20')
    expect(short.ok && short.blocks.pib_us.map((b) => [b.year, b.through])).toEqual([
      [2027, '2027-12-31'],
      [2028, '2028-01-27'], // the file's last year, just started
    ])
    expect(r.blocks.pce[0].source).toBe(BEA_URL)
    expect(r.blocks.pce[0].read).toBe('2026-11-20')
  })

  it('collapses the same instant listed twice', () => {
    const r = parseBea(file(['2026-06-05T12:30:00+00:00', '2026-06-05T12:30:00+00:00']), '2026-11-20')
    expect(r.ok && r.blocks.pib_us[0].entries).toEqual([{ date: '2026-06-05', time: '08:30' }])
  })

  it.each([
    ['not an object', []],
    ['null', null],
    ['an entry missing', { 'Gross Domestic Product': { release_dates: ['2026-11-25T13:30:00+00:00'] } }],
    ['an extra key in an entry', { ...file(['2026-11-25T13:30:00+00:00']), 'Gross Domestic Product': { release_dates: ['2026-11-25T13:30:00+00:00'], x: 1 } }],
    ['dates not an array', file('2026-11-25T13:30:00+00:00')],
    ['a date without an offset', file(['2026-11-25T08:30:00'])],
    ['a bare date', file(['2026-11-25'])],
    ['a number', file([20261125])],
    ['an impossible hour', file(['2026-11-25T24:30:00+00:00'])],
    ['a second off the minute', file(['2026-11-25T13:30:15+00:00'])],
    ['two instants on one New York date', file(['2026-11-25T13:30:00+00:00', '2026-11-25T15:00:00+00:00'])],
    ['nothing from 2026 on', file(['2025-11-25T13:30:00+00:00'])],
    ['an empty list', file([])],
  ])('fails on %s', (_name, json) => {
    expect(parseBea(json, '2026-11-20')).toEqual({ ok: false })
  })
})

describe('fetchBea', () => {
  const okJson = file(['2026-11-25T13:30:00+00:00'])
  it('GETs the public file and reads it', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => okJson })
    const r = await fetchBea(fetcher as unknown as typeof fetch, '2026-11-20')
    expect(r.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(BEA_URL)
    expect(fetcher.mock.calls[0][1].method).toBe('GET')
  })

  it('fails on a status, a bad body or a network error', async () => {
    const status = jest.fn().mockResolvedValue({ ok: false, json: async () => okJson })
    const body = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('x') } })
    const network = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    for (const f of [status, body, network]) {
      expect(await fetchBea(f as unknown as typeof fetch, '2026-11-20')).toEqual({ ok: false })
    }
  })
})

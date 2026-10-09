import { importTrades } from '@/lib/utils/importTrades'
import type { TradeInsert } from '@/types/database'

const mockFetch = jest.fn()

const trades: Omit<TradeInsert, 'user_id'>[] = [
  {
    symbol: 'BTC/USDT',
    asset_type: 'binary_option',
    direction: 'put',
    entry_time: '2026-10-07T21:02:49.000Z',
    notes: 'ebinex:aaa111',
  },
  {
    symbol: 'IDX/USDT',
    asset_type: 'binary_option',
    direction: 'call',
    entry_time: '2026-10-07T20:39:16.000Z',
    notes: 'ebinex:bbb222',
  },
]

const params = { trades, userId: 'user-1', marketType: 'binary', accessToken: 'user-jwt' }

describe('importTrades', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: '1' }, { id: '2' }] })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  it('tags every row with the user and the account', async () => {
    await importTrades(params)

    const rows = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(rows).toHaveLength(2)
    rows.forEach((row: Record<string, unknown>) => {
      expect(row.user_id).toBe('user-1')
      expect(row.market_type).toBe('binary')
    })
    expect(rows[0].notes).toBe('ebinex:aaa111')
  })

  it('skips trades that were already imported', async () => {
    await importTrades(params)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/rest/v1/trades?on_conflict=user_id%2Cnotes')
    expect(init.method).toBe('POST')
    expect(init.headers.Prefer).toContain('resolution=ignore-duplicates')
    expect(init.headers.Authorization).toBe('Bearer user-jwt')
  })

  it('returns how many rows were inserted', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: '1' }] })

    await expect(importTrades(params)).resolves.toBe(1)
  })

  it('refuses to import without an account', async () => {
    await expect(importTrades({ ...params, marketType: '' })).rejects.toThrow('No account selected')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'permission denied' })

    await expect(importTrades(params)).rejects.toThrow('HTTP 403: permission denied')
  })
})

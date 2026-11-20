/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/market/quote/route'

// Market data reaches a third party: the route checks HUB_USERS right after the session (Phase 5 · base)
const mockGetUser = jest.fn()

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } }),
}))

const signedIn = () =>
  new NextRequest('http://localhost/api/market/quote?symbol=ES%3DF', { headers: { Authorization: 'Bearer user-jwt' } })

describe('GET /api/market/quote and HUB_USERS', () => {
  const original = process.env.HUB_USERS
  const fetchSpy = jest.fn()

  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'owner@example.com' } }, error: null })
    fetchSpy.mockReset()
    fetchSpy.mockRejectedValue(new Error('no network in tests'))
    global.fetch = fetchSpy as unknown as typeof fetch
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (original === undefined) delete process.env.HUB_USERS
    else process.env.HUB_USERS = original
  })

  it('turns away a signed-in account that is not on the list, before any request to the provider', async () => {
    process.env.HUB_USERS = 'someone@example.com'

    const response = await GET(signedIn())

    expect(response.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('turns everyone away when the list is not configured', async () => {
    delete process.env.HUB_USERS

    const response = await GET(signedIn())

    expect(response.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('lets a listed account through to the provider', async () => {
    process.env.HUB_USERS = 'owner@example.com'

    const response = await GET(signedIn())

    expect(response.status).not.toBe(403)
    expect(fetchSpy).toHaveBeenCalled()
  })
})

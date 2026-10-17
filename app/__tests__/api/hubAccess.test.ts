/**
 * @jest-environment node
 */
import { GET } from '@/app/api/hub/acesso/route'

const mockGetUser = jest.fn()

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } }),
}))

const signedIn = () => new Request('http://localhost/api/hub/acesso', { headers: { Authorization: 'Bearer user-jwt' } })

describe('GET /api/hub/acesso', () => {
  const original = process.env.HUB_USERS

  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'owner@example.com' } }, error: null })
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (original === undefined) delete process.env.HUB_USERS
    else process.env.HUB_USERS = original
  })

  it('lets a listed account in, and the answer is never cached', async () => {
    process.env.HUB_USERS = 'owner@example.com'

    const response = await GET(signedIn())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ access: true })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mockGetUser).toHaveBeenCalledWith('user-jwt')
  })

  it('turns away a signed-in account that is not on the list', async () => {
    process.env.HUB_USERS = 'someone@example.com'

    const response = await GET(signedIn())

    expect(response.status).toBe(403)
  })

  it('turns everyone away when the list is not configured', async () => {
    delete process.env.HUB_USERS

    const response = await GET(signedIn())

    expect(response.status).toBe(403)
  })
})

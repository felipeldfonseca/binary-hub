/**
 * @jest-environment node
 */
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { canUsePaidAi, denyPaidAi, requireUser } from '@/lib/apiAuth'

const mockGetUser = jest.fn()
const mockCreateServerClient = jest.fn((..._args: unknown[]) => ({ auth: { getUser: mockGetUser } }))

jest.mock('@/lib/supabase', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))

const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/anything', { headers })

const owner = { id: 'user-1', email: 'Owner@Example.com' } as User

describe('requireUser', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockCreateServerClient.mockClear()
    mockGetUser.mockResolvedValue({ data: { user: owner }, error: null })
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('rejects a request without a token, without asking Supabase', async () => {
    const result = await requireUser(request())

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('rejects a header that is not a bearer token', async () => {
    const result = await requireUser(request({ Authorization: 'Basic dXNlcjpwYXNz' }))

    expect((result as NextResponse).status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('rejects a token Supabase does not recognise', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT', status: 403 } })

    const result = await requireUser(request({ Authorization: 'Bearer forged' }))

    expect((result as NextResponse).status).toBe(401)
    expect(mockGetUser).toHaveBeenCalledWith('forged')
  })

  it('returns the signed-in user for a valid token', async () => {
    const result = await requireUser(request({ Authorization: 'Bearer user-jwt' }))

    expect(result).toEqual({ user: owner, accessToken: 'user-jwt' })
  })

  it.each([
    ['the network call fails', { name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 }],
    ['Supabase is rate limiting', { message: 'too many requests', status: 429 }],
    ['Supabase is down', { message: 'bad gateway', status: 502 }],
    ['the error carries no status', { message: 'unknown' }],
  ])('answers 503, not "sign in again", when %s', async (_case, error) => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error })

    const result = await requireUser(request({ Authorization: 'Bearer user-jwt' }))

    expect((result as NextResponse).status).toBe(503)
  })

  it('rejects a response that carries neither a user nor an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await requireUser(request({ Authorization: 'Bearer user-jwt' }))

    expect((result as NextResponse).status).toBe(401)
  })

  it('fails closed when authentication cannot be checked', async () => {
    mockCreateServerClient.mockImplementationOnce(() => {
      throw new Error('supabaseUrl is required.')
    })

    const result = await requireUser(request({ Authorization: 'Bearer user-jwt' }))

    expect((result as NextResponse).status).toBe(503)
  })
})

describe('canUsePaidAi', () => {
  const original = process.env.AI_ALLOWED_USERS

  afterEach(() => {
    if (original === undefined) delete process.env.AI_ALLOWED_USERS
    else process.env.AI_ALLOWED_USERS = original
  })

  it('allows nobody when the list is not configured', () => {
    delete process.env.AI_ALLOWED_USERS

    expect(canUsePaidAi(owner)).toBe(false)
  })

  it('allows an account listed by email, ignoring case and spaces', () => {
    process.env.AI_ALLOWED_USERS = 'someone@example.com , owner@example.com'

    expect(canUsePaidAi(owner)).toBe(true)
  })

  it('allows an account listed by user id', () => {
    process.env.AI_ALLOWED_USERS = 'user-1'

    expect(canUsePaidAi(owner)).toBe(true)
  })

  it('refuses an account that is not on the list', () => {
    process.env.AI_ALLOWED_USERS = 'someone@example.com'

    expect(canUsePaidAi(owner)).toBe(false)
  })

  it('does not treat a partial match as a match', () => {
    process.env.AI_ALLOWED_USERS = 'not-owner@example.com,owner@example.com.evil.test'

    expect(canUsePaidAi(owner)).toBe(false)
  })

  it('does not allow an account whose email or id merely contains an allowed entry', () => {
    process.env.AI_ALLOWED_USERS = 'owner@example.com,user-1'

    expect(canUsePaidAi({ id: 'user-2', email: 'xowner@example.com' } as User)).toBe(false)
    expect(canUsePaidAi({ id: 'user-2', email: 'owner@example.com.evil.test' } as User)).toBe(false)
    expect(canUsePaidAi({ id: 'user-10', email: 'visitor@example.com' } as User)).toBe(false)
  })

  it('does not allow an account without an email through an empty entry', () => {
    process.env.AI_ALLOWED_USERS = ' , ,'

    expect(canUsePaidAi({ id: 'user-3' } as User)).toBe(false)
  })
})

describe('denyPaidAi', () => {
  const original = process.env.AI_ALLOWED_USERS

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (original === undefined) delete process.env.AI_ALLOWED_USERS
    else process.env.AI_ALLOWED_USERS = original
  })

  it('lets an allowed account through', () => {
    process.env.AI_ALLOWED_USERS = 'owner@example.com'

    expect(denyPaidAi(owner)).toBeNull()
  })

  it('tells an account that is not on the list that it is not allowed', async () => {
    process.env.AI_ALLOWED_USERS = 'someone@example.com'

    const response = denyPaidAi(owner) as NextResponse

    expect(response.status).toBe(403)
    expect((await response.json()).message).toBe('This account is not allowed to use AI features.')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('says the server is not configured, and logs it, when the list is unset', async () => {
    delete process.env.AI_ALLOWED_USERS

    const response = denyPaidAi(owner) as NextResponse

    expect(response.status).toBe(403)
    expect((await response.json()).message).toBe('AI access is not configured on this server.')
    expect(console.warn).toHaveBeenCalled()
  })
})

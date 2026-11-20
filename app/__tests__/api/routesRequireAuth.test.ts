/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'

// Every route handler in the app must turn away a request that carries no
// valid session. Handlers are discovered from disk and compared with the list
// below, so adding or removing one is a deliberate edit to this file.
const EXPECTED_HANDLERS = [
  'GET /api/hub/acesso',
  'GET /api/market/analysis',
  'POST /api/market/analysis',
  'GET /api/market/quote',
]

// Routes that check only a shared secret instead of a session: Vercel's daily cron (CRON_SECRET). They never
// call getUser, so the two session tests below skip them; their own 401 tests are at the end of this file and in
// cronAgenda.test.ts.
const CRON_HANDLERS = ['GET /api/cron/agenda']

const mockGetUser = jest.fn()

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } }),
}))

jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  const Anthropic = jest.fn(() => ({ messages: { stream: jest.fn() } }))
  return { __esModule: true, default: Object.assign(Anthropic, { APIError }) }
})

const APP_DIR = path.join(__dirname, '../../app')
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

type Handler = (request: NextRequest, context: { params: Record<string, string> }) => Promise<Response>

function findRouteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findRouteFiles(full)
    return /^route\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })
}

const handlers = findRouteFiles(APP_DIR).flatMap((file) => {
  const routeModule = require(file) as Record<string, Handler | undefined>
  const route = '/' + path.relative(APP_DIR, path.dirname(file))
  return METHODS.filter((method) => typeof routeModule[method] === 'function').map((method) => ({
    name: `${method} ${route}`,
    method,
    route,
    handler: routeModule[method] as Handler,
  }))
})

const sessionHandlers = handlers.filter((entry) => !CRON_HANDLERS.includes(entry.name))

const call = (entry: (typeof handlers)[number], headers: Record<string, string> = {}) => {
  // Give every [segment] in the path a placeholder value
  const params = Object.fromEntries(
    Array.from(entry.route.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g), (match) => [match[1], 'placeholder'])
  )
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(entry.method)
  return entry.handler(
    new NextRequest(`http://localhost${entry.route}?symbol=ES%3DF`, {
      method: entry.method,
      headers,
      body: hasBody ? '{}' : undefined,
    }),
    { params }
  )
}

describe('route handlers require a session', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT', status: 403 } })
  })

  it('covers exactly the handlers that exist on disk', () => {
    expect(handlers.map((entry) => entry.name).sort()).toEqual([...EXPECTED_HANDLERS, ...CRON_HANDLERS].sort())
  })

  it.each(sessionHandlers)('$name turns away a request without a token', async (entry) => {
    const response = await call(entry)

    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it.each(sessionHandlers)('$name turns away a token Supabase does not recognise', async (entry) => {
    const response = await call(entry, { Authorization: 'Bearer forged' })

    expect(response.status).toBe(401)
    expect(mockGetUser).toHaveBeenCalledWith('forged')
  })
})

describe('cron handlers require their secret', () => {
  const env = { ...process.env }
  beforeEach(() => mockGetUser.mockReset())
  afterEach(() => {
    process.env = env
  })
  const cron = () => handlers.filter((entry) => CRON_HANDLERS.includes(entry.name))

  it('lists only handlers that exist', () => {
    expect(cron().map((entry) => entry.name).sort()).toEqual([...CRON_HANDLERS].sort())
  })

  it.each(CRON_HANDLERS)('%s turns away a request without the header', async (name) => {
    process.env = { ...env, CRON_SECRET: 'invented-cron-secret' }
    const response = await call(cron().find((entry) => entry.name === name)!)
    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it.each(CRON_HANDLERS)('%s turns away a wrong secret', async (name) => {
    process.env = { ...env, CRON_SECRET: 'invented-cron-secret' }
    const response = await call(cron().find((entry) => entry.name === name)!, { Authorization: 'Bearer forged' })
    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it.each(CRON_HANDLERS)('%s turns away everyone while CRON_SECRET is unset', async (name) => {
    process.env = { ...env }
    delete process.env.CRON_SECRET
    const response = await call(cron().find((entry) => entry.name === name)!, { Authorization: 'Bearer ' })
    expect(response.status).toBe(401)
  })
})

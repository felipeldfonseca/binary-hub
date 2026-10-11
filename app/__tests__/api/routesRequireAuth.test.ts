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
  'GET /api/market/analysis',
  'POST /api/market/analysis',
  'GET /api/market/quote',
  'GET /api/test',
  'POST /api/test',
  'GET /api/v1/analytics/dashboard',
  'POST /api/v1/import/upload',
  'GET /api/v1/trades',
  'POST /api/v1/trades',
]

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
    expect(handlers.map((entry) => entry.name).sort()).toEqual([...EXPECTED_HANDLERS].sort())
  })

  it.each(handlers)('$name turns away a request without a token', async (entry) => {
    const response = await call(entry)

    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it.each(handlers)('$name turns away a token Supabase does not recognise', async (entry) => {
    const response = await call(entry, { Authorization: 'Bearer forged' })

    expect(response.status).toBe(401)
    expect(mockGetUser).toHaveBeenCalledWith('forged')
  })
})

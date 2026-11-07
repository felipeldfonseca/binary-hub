/**
 * @jest-environment node
 *
 * Step 4-4 (owner decision 5, contract §7.5): /trades opens the Diário with a 307, and the old list
 * stays at /trades?antiga=1 (the Diário footer's «Página antiga de operações») until Phase 9.
 *
 * The matching is proved with Next's own code from node_modules/next (14.2.x), the same steps its
 * router takes for a redirect: `loadCustomRoutes` reads redirects() (and puts the internal
 * trailing-slash redirect first), `buildCustomRoute` compiles each source, `resolve-routes` walks
 * them in order with `route.match(pathname)` and `matchHas(req, query, has, missing)` on the query
 * that `url.parse(req.url, true)` gives (`querystring.parse` of the search), then `prepareDestination` builds the target (carrying the request's
 * query over) and `getRedirectStatus` gives the status. The dev server answered the same (curl).
 */
import { parse as parseQuery } from 'querystring'
import type { NextConfig } from 'next'
import loadCustomRoutes from 'next/dist/lib/load-custom-routes'
import { buildCustomRoute } from 'next/dist/server/lib/router-utils/filesystem'
import { matchHas, prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination'
import { getRedirectStatus } from 'next/dist/lib/redirect-status'
import { stringifyQuery } from 'next/dist/server/server-route-utils'

const nextConfig = require('../../next.config.js') as NextConfig

const TRADES_REDIRECT = {
  source: '/trades',
  missing: [{ type: 'query', key: 'antiga' }],
  destination: '/diario',
  permanent: false,
}

/** Where Next's router sends a GET for `url`: null when no redirect matches (the page renders) */
async function redirectFor(url: string): Promise<{ status: number; location: string } | null> {
  // basePath '' is Next's default, which the server merges in before reading the custom routes
  const routes = await loadCustomRoutes({ ...nextConfig, basePath: '' } as NextConfig)
  const redirects = routes.redirects.map((item) => buildCustomRoute('redirect', item, '', undefined))
  const { pathname, search } = new URL(url, 'http://localhost')
  const query = parseQuery(search.slice(1))
  const req = { headers: {} } as never
  for (const route of redirects) {
    let params = route.match(pathname)
    if ((route.has || route.missing) && params) {
      const hasParams = matchHas(req, query, route.has, route.missing)
      params = hasParams ? Object.assign(params, hasParams) : false
    }
    if (!params) continue
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: false,
      destination: route.destination,
      params,
      query,
    })
    const search = stringifyQuery(req, parsedDestination.query)
    return { status: getRedirectStatus(route), location: parsedDestination.pathname + (search ? `?${search}` : '') }
  }
  return null
}

describe('next.config.js redirects()', () => {
  it('holds exactly the contract\'s entry', async () => {
    expect(typeof nextConfig.redirects).toBe('function')
    await expect(nextConfig.redirects!()).resolves.toEqual([TRADES_REDIRECT])
  })

  it('/trades opens the Diário with a 307', async () => {
    await expect(redirectFor('/trades')).resolves.toEqual({ status: 307, location: '/diario' })
  })

  it('the footer\'s link keeps the old list', async () => {
    await expect(redirectFor('/trades?antiga=1')).resolves.toBeNull()
    await expect(redirectFor('/trades?conta=abc&antiga=1')).resolves.toBeNull()
  })

  it('an empty «antiga» counts as missing in Next (matchHas needs a value), so it redirects', async () => {
    // The Diário only links '?antiga=1'; '/trades?antiga=' and '/trades?antiga' go to the Diário
    await expect(redirectFor('/trades?antiga=')).resolves.toEqual({ status: 307, location: '/diario?antiga=' })
    await expect(redirectFor('/trades?antiga')).resolves.toEqual({ status: 307, location: '/diario?antiga=' })
  })

  it('carries any other query over to the Diário', async () => {
    await expect(redirectFor('/trades?conta=abc')).resolves.toEqual({ status: 307, location: '/diario?conta=abc' })
  })

  it('/trades/ first loses its slash (Next\'s own 308), then lands on /trades', async () => {
    await expect(redirectFor('/trades/')).resolves.toEqual({ status: 308, location: '/trades' })
  })

  it.each(['/trades/123', '/tradesx', '/api/trades', '/diario', '/dashboard'])('%s is not matched', async (url) => {
    await expect(redirectFor(url)).resolves.toBeNull()
  })
})

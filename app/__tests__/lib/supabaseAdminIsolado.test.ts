/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

// The service-role client bypasses row-level security: only server code may import it (today only the cron
// route). Nothing the browser loads may reach it, directly or through another module.
const APP = path.join(__dirname, '../..')
const ADMIN = path.join(APP, 'lib', 'server', 'supabaseAdmin.ts')
const BROWSER_DIRS = ['components', 'hooks', path.join('app', '(hub)'), path.join('lib', 'hub')]
// every static import or export … from, side-effect import, dynamic import and require (comments stripped first)
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']

function sources(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(full)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })
}

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** The files a source imports, resolved (relative paths against its folder, '@/' against app/); packages skipped */
function importsOf(file: string, text: string): string[] {
  const out: string[] = []
  for (const m of Array.from(stripComments(text).matchAll(SPECIFIER))) {
    const spec = m[1]
    const base = spec.startsWith('@/')
      ? path.join(APP, spec.slice(2))
      : spec.startsWith('.')
        ? path.resolve(path.dirname(file), spec)
        : null
    if (!base) continue
    const hit = [base, ...EXTENSIONS.map((e) => base + e)].find((f) => /\.(ts|tsx|js|jsx)$/.test(f) && fs.existsSync(f))
    out.push(hit ?? base)
  }
  return out
}

const cache = new Map<string, string[]>()
const edges = (file: string) => {
  if (!cache.has(file)) cache.set(file, fs.existsSync(file) ? importsOf(file, fs.readFileSync(file, 'utf8')) : [])
  return cache.get(file)!
}

/** Does `file` reach the service client, directly or through the modules it imports? */
function reachesAdmin(file: string): boolean {
  const seen = new Set<string>()
  const queue = [file]
  while (queue.length > 0) {
    const f = queue.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    for (const next of edges(f)) {
      if (next === ADMIN) return true
      if (next.startsWith(APP) && !next.includes(`${path.sep}node_modules${path.sep}`)) queue.push(next)
    }
  }
  return false
}

describe('lib/server/supabaseAdmin stays on the server', () => {
  it('the resolver sees every way to name the module (and not a comment)', () => {
    const hub = path.join(APP, 'lib', 'hub', 'x.ts')
    const comp = path.join(APP, 'components', 'hub', 'x.tsx')
    expect(importsOf(hub, "import { createServiceClient } from '../server/supabaseAdmin'")).toEqual([ADMIN])
    expect(importsOf(hub, "export { createServiceClient } from '@/lib/server/supabaseAdmin'")).toEqual([ADMIN])
    expect(importsOf(comp, "const m = await import('../../lib/server/supabaseAdmin.ts')")).toEqual([ADMIN])
    expect(importsOf(comp, "require('@/lib/server/supabaseAdmin')")).toEqual([ADMIN])
    expect(importsOf(hub, "import '../server/supabaseAdmin'")).toEqual([ADMIN])
    expect(importsOf(hub, "// see '../server/supabaseAdmin'\n/* from '../server/supabaseAdmin' */")).toEqual([])
  })

  it.each(BROWSER_DIRS)('no file under %s reaches it, directly or through another module', (dir) => {
    const files = sources(path.join(APP, dir))
    expect(files.length).toBeGreaterThan(0)
    const offenders = files.filter(reachesAdmin)
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([])
  })

  it('is imported only by the cron route', () => {
    const roots = ['app', 'components', 'hooks', 'lib'].flatMap((d) => sources(path.join(APP, d)))
    const importers = roots.filter((file) => file !== ADMIN && edges(file).includes(ADMIN))
    expect(importers.map((f) => path.relative(APP, f))).toEqual([path.join('app', 'api', 'cron', 'agenda', 'route.ts')])
  })

  it('builds nothing at import and refuses to run in a browser', async () => {
    const env = { ...process.env }
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createServiceClient } = await import('@/lib/server/supabaseAdmin')
    expect(createServiceClient()).toBeNull()
    ;(globalThis as { window?: unknown }).window = {}
    try {
      expect(() => createServiceClient()).toThrow('server only')
    } finally {
      delete (globalThis as { window?: unknown }).window
      process.env = env
    }
  })
})

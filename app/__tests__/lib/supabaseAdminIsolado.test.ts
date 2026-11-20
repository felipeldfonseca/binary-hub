/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

// The service-role client bypasses row-level security: only server code may import it (today only the cron
// route). Nothing the browser loads may reach it.
const APP = path.join(__dirname, '../..')
const BROWSER_DIRS = ['components', 'hooks', path.join('app', '(hub)'), path.join('lib', 'hub')]
// an import, a dynamic import or a require of the module (a mention in a comment is not one)
const IMPORT = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"][^'"]*lib\/server\/supabaseAdmin(?:\.ts)?['"]/

function sources(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(full)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })
}

describe('lib/server/supabaseAdmin stays on the server', () => {
  it.each(BROWSER_DIRS)('no file under %s imports it', (dir) => {
    const files = sources(path.join(APP, dir))
    expect(files.length).toBeGreaterThan(0)
    const offenders = files.filter((file) => IMPORT.test(fs.readFileSync(file, 'utf8')))
    expect(offenders.map((f) => path.relative(APP, f))).toEqual([])
  })

  it('is imported only by the cron route', () => {
    const roots = ['app', 'components', 'hooks', 'lib'].flatMap((d) => sources(path.join(APP, d)))
    const importers = roots
      .filter((file) => !file.endsWith(path.join('lib', 'server', 'supabaseAdmin.ts')))
      .filter((file) => IMPORT.test(fs.readFileSync(file, 'utf8')))
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

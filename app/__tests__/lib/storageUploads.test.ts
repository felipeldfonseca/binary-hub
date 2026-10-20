/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

// Trade images go to the private bucket with the Storage API's plain upload (as the signed-in
// user, no upsert). Storage checks the bucket's insert policy only when a signed upload URL is
// created, and the upload through that URL then runs above the policies for up to two hours,
// upsert included: it could write a reservation after its 30 minutes, after it was trashed, or
// over a saved image (supabase/migrations/20261020000002_trade_images.sql).
const FORBIDDEN = ['createSignedUploadUrl', 'uploadToSignedUrl']
const APP = path.join(__dirname, '../..')
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib']

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })
}

describe('trade image uploads', () => {
  it('never use signed upload URLs', () => {
    const files = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(APP, d)))
    expect(files.length).toBeGreaterThan(0)
    const uses = files.flatMap((f) => {
      const text = fs.readFileSync(f, 'utf8')
      return FORBIDDEN.filter((name) => text.includes(name)).map((name) => `${path.relative(APP, f)}: ${name}`)
    })
    expect(uses).toEqual([])
  })
})

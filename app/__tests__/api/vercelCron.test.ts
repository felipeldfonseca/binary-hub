/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

// The daily agenda load is scheduled by app/vercel.json (contract §3.7): 09:00 UTC, Hobby fires within the hour.
describe('app/vercel.json', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8'))

  it('keeps the Next.js framework pin', () => {
    expect(config.framework).toBe('nextjs')
  })

  it('declares exactly the agenda cron', () => {
    expect(config.crons).toEqual([{ path: '/api/cron/agenda', schedule: '0 9 * * *' }])
  })

  it('the cron path is a route on disk', () => {
    expect(fs.existsSync(path.join(__dirname, '../../app/api/cron/agenda/route.ts'))).toBe(true)
  })
})

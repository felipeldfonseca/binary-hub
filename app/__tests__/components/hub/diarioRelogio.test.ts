import { relogioDoDia, semanaDoDia } from '@/components/hub/diario/useDadosDoDia'

// The open day's clock (review 2026-11-20, finding 10): the version's day clock, else the account's own stored clock
// (trading_accounts.day_tz/day_start_min, every Diário answer's account.day), never the market's spec
describe('relogioDoDia', () => {
  const daConta = { day: { tz: 'America/Chicago', startMin: 17 * 60 } }

  it('before the first version: the account\'s stored clock, even when it differs from the market\'s', () => {
    expect(relogioDoDia(daConta, null)).toEqual({ tz: 'America/Chicago', startMin: 17 * 60 })
    // The week on that clock: Monday's start is Sunday 17:00 Chicago (23:00 UTC in December)
    expect(semanaDoDia('2026-12-02', relogioDoDia(daConta, null)).start.toISOString()).toBe('2026-11-29T23:00:00.000Z')
  })

  it('with a version: the version\'s clock', () => {
    const rules = { day: { tz: 'America/New_York', startMin: 18 * 60 } } as any
    expect(relogioDoDia(daConta, rules)).toEqual({ tz: 'America/New_York', startMin: 18 * 60 })
  })
})

/**
 * @jest-environment node
 *
 * Open point O2 (decided YES): the app never fails on a stored rule that carries the long form of
 * «Dados econômicos» (contract §3.4: `releases`), before the Phase 5 screens reach it. Read-only
 * tolerance: the version's checker and parser accept the map (SPEC §3.7's checks of
 * rules_check_resolved, in its order, with its code `bad_releases`; the SQL-computed cases come with
 * the Phase 5 SQL, lane L2) and keep it as read; the market default and the account settings keep reading their
 * keys and leave `releases` alone. No writer, no evaluation here. Invented rules.
 */
import { AGENDA_RELEASES, RulesError, checkRules, parseRules, toResolvedJson } from '@/lib/domain/gate'
import { parseRulesConfig, parseRulesNow } from '@/lib/hub/regras'
import { regrasJson } from '@/testing/regras'
import { topOneRules } from '@/testing/gate'

type J = Record<string, any>

/** The contract's example of a frozen long form (CPI in «Não opero no dia», the other nine US list-A codes in «volta») */
const LONG = {
  cpi: 'dia',
  ppi: 'volta',
  payroll: 'volta',
  pce: 'volta',
  pib_us: 'volta',
  varejo_us: 'volta',
  ism_ind: 'volta',
  ism_serv: 'volta',
  fomc_decisao: 'volta',
  fomc_entrevista: 'volta',
}

const resolved = (releases?: unknown): J => {
  const j = JSON.parse(JSON.stringify(toResolvedJson(topOneRules()))) as J
  if (releases !== undefined) j.block.releases = releases
  return j
}

describe('a version (resolved.block) in the long form', () => {
  it('is accepted and parsed, the map kept as read', () => {
    expect(checkRules(resolved(LONG))).toBeNull()
    const r = parseRules(resolved(LONG))
    expect(r.block).toMatchObject({ on: true, beforeMin: 5, afterMin: 10, calendars: ['us'], releases: LONG })
  })

  it('round-trips: toResolvedJson gives back the stored bytes, long and short', () => {
    expect(toResolvedJson(parseRules(resolved(LONG)))).toEqual(resolved(LONG))
    expect(toResolvedJson(parseRules(resolved()))).toEqual(resolved())
    expect(parseRules(resolved()).block).not.toHaveProperty('releases')
  })

  it('`"releases": {}` (no release waits) differs from no key', () => {
    expect(parseRules(resolved({})).block?.releases).toEqual({})
  })

  /** The app default for these calendars: every list-A code of them in «volta», nothing else (SPEC §3.4) */
  const appDefault = (calendars: string[]) =>
    Object.fromEntries(AGENDA_RELEASES.filter((r) => r.inListA && calendars.includes(r.calendar)).map((r) => [r.code, 'volta']))

  it.each<[string, unknown]>([
    // rules_check_block rows 7–9
    ['a list (row 7)', ['cpi']],
    ['null (row 7)', null],
    ['an unknown code (row 8)', { fed: 'volta' }],
    ['an unknown mode (row 9)', { cpi: 'sempre' }],
    // rules_check_resolved rows 4–6
    ['«normal» (row 4: never stored in a version)', { cpi: 'normal' }],
    ['a code whose calendar is not followed (row 5)', { ...LONG, hicp_eu: 'volta' }],
    ['the app default, which belongs in the short form (row 6)', appDefault(['us'])],
  ])('refuses %s with bad_releases', (_label, releases) => {
    expect(checkRules(resolved(releases))).toBe('bad_releases')
    expect(() => parseRules(resolved(releases))).toThrow(RulesError)
  })

  it('accepts a followed calendar\'s code, and `{}` is the default only without calendars', () => {
    const j = resolved({ ...LONG, hicp_eu: 'dia' })
    j.block.calendars = ['us', 'eu']
    expect(checkRules(j)).toBeNull()
    const none = resolved({})
    none.block.calendars = []
    expect(checkRules(none)).toBe('bad_releases')
  })

  it('in SPEC §3.7\'s order: the calendars, then unknown_key, then on/before/after, then the map', () => {
    const badCal = resolved(null)
    badCal.block.calendars = ['xx']
    expect(checkRules(badCal)).toBe('bad_block')
    const extra = resolved(null)
    extra.block.x = 1
    expect(checkRules(extra)).toBe('unknown_key')
    const noOn = resolved(null)
    delete noOn.block.on
    expect(checkRules(noOn)).toBe('bad_block')
    const badMin = resolved({ cpi: 'normal' })
    badMin.block.before_min = 61
    expect(checkRules(badMin)).toBe('bad_block')
  })
})

describe('Personalizar and «Posso operar hoje?» read a saved long form', () => {
  it('rules_config(): the market default, the account settings and a version with `releases`', () => {
    const j = regrasJson('config-depois') as J
    j.defaults.futures.rules.block = { ...j.defaults.futures.rules.block, releases: { cpi: 'dia', jolts: 'volta' } }
    const futures = (j.accounts as J[]).find((a) => a.market === 'futures')!
    futures.settings.rules.block = { releases: { cpi: 'normal' } }
    futures.versions[futures.versions.length - 1].resolved.block.releases = LONG
    const c = parseRulesConfig(j)
    const before = parseRulesConfig(regrasJson('config-depois'))
    // The minutes and the switch read as before; since L4 (D1) the map is part of the settings, read as stored
    expect(c.settings.markets.futures.block).toEqual({ ...before.settings.markets.futures.block, releases: { cpi: 'dia', jolts: 'volta' } })
    const id = futures.account_id as string
    expect(c.settings.accounts[id].block).toEqual({ ...before.settings.accounts[id].block, releases: { cpi: 'normal' } })
    const v = c.accounts.find((a) => a.id === id)!.versions
    expect(v[v.length - 1].rules.block?.releases).toEqual(LONG)
  })

  it('rules_now(): an account whose version carries `releases`', () => {
    const j = regrasJson('agora-mercados-seg-0830-et') as J
    const a = (j.accounts as J[]).find((x) => x.market === 'futures')!
    a.rules.block.releases = LONG
    expect(parseRulesNow(j).accounts.find((x) => x.accountId === a.account_id)?.rules?.block?.releases).toEqual(LONG)
  })
})

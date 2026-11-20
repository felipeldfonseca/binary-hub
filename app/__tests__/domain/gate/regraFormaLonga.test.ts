/**
 * @jest-environment node
 *
 * Open point O2 (decided YES): the app never fails on a stored rule that carries the long form of
 * «Dados econômicos» (contract §3.4: `releases`), before the Phase 5 screens reach it. Read-only
 * tolerance: the version's checker and parser accept the map (twin of rules_check_resolved after
 * Phase 5-1) and keep it as read; the market default and the account settings keep reading their
 * keys and leave `releases` alone. No writer, no evaluation here. Invented rules.
 */
import { RulesError, checkRules, parseRules, toResolvedJson } from '@/lib/domain/gate'
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

  it.each<[string, unknown]>([
    ['an unknown code', { fed: 'volta' }],
    ['«normal» (never stored in a version)', { cpi: 'normal' }],
    ['an unknown mode', { cpi: 'sempre' }],
    ['a list', ['cpi']],
    ['null', null],
  ])('refuses %s with bad_block', (_label, releases) => {
    expect(checkRules(resolved(releases))).toBe('bad_block')
    expect(() => parseRules(resolved(releases))).toThrow(RulesError)
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
    // The minutes and the switch read as before; the map is not part of the settings yet
    expect(c.settings.markets.futures.block).toEqual(before.settings.markets.futures.block)
    const id = futures.account_id as string
    expect(c.settings.accounts[id].block).toEqual(before.settings.accounts[id].block)
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

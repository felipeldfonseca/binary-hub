/**
 * @jest-environment node
 *
 * The stored entry context and the frozen gate answer are read tolerantly of what Phase 5 adds
 * (Phase 5 · base; levantamento/sintese.md l.498): keys the reader does not know are ignored, the
 * columns of a later delivery may be absent (absent = null), and a frozen answer with the evaluated
 * block (contract §3.5) is read. Invented answers, on a recorded fixture.
 */
import { parseTradeState } from '@/lib/hub/registrarDb'
import { parciaisJson } from '@/testing/parciais'

type J = Record<string, any>
const base = () => JSON.parse(JSON.stringify(parciaisJson('partial-mes'))) as J

describe('StoredContext (trade_state.context)', () => {
  it('ignores keys it does not know (a later delivery\'s columns)', () => {
    const j = base()
    j.context = { ...j.context, state_symbol: 'MES', state_as_of: '2026-12-03T15:00:00+00:00', state_provisional: false, state_origin: 'motor' }
    const s = parseTradeState(j)
    expect(s.context).toEqual(parseTradeState(base()).context)
  })

  it('reads an absent optional column as null', () => {
    const j = base()
    delete j.context.state_choice
    delete j.context.rule_ok
    delete j.context.in_block
    const s = parseTradeState(j)
    expect(s.context).toMatchObject({ stateChoice: null, ruleOk: null, inBlock: null })
  })

  it('still refuses a known column of the wrong type', () => {
    const j = base()
    j.context.in_block = 'sim'
    expect(() => parseTradeState(j)).toThrow('bad_answer')
  })
})

describe('the frozen gate answer of an entry inside a wait (contract §3.5)', () => {
  it('reads the evaluated block and in_block = true', () => {
    const j = base()
    const ism = {
      kind: 'espera',
      start: '2026-12-03T14:55:00+00:00',
      end: '2026-12-03T15:10:00+00:00',
      releases: [{ code: 'ism_serv', at: '2026-12-03T15:00:00+00:00', mode: 'volta' }],
    }
    j.gate = {
      ...j.gate,
      status: 'aguardar',
      checks_evaluated: ['janela', 'bloqueio', 'limite', 'estado'].filter((k) => k === 'bloqueio' || (j.gate.checks_evaluated as string[]).includes(k)),
      block: { state: 'no_bloqueio', active: ism, today: [ism], free_at: '2026-12-03T15:10:00+00:00' },
    }
    j.context = { ...j.context, in_block: true, gate_status: 'aguardar' }
    const s = parseTradeState(j)
    expect(s.gate?.block).toMatchObject({ evaluated: true, state: 'no_bloqueio', active: { kind: 'espera', releases: [{ code: 'ism_serv' }] } })
    expect(s.context).toMatchObject({ inBlock: true, gateStatus: 'aguardar' })
  })
})

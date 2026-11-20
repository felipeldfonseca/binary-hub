/**
 * @jest-environment node
 */
import { MON_TO_FRI } from '@/lib/domain/tempo'
import type { Rules } from '@/lib/domain/gate'
import { BIN_CLOCK, brt, ebinexRules, et, topOneRules } from '@/testing/gate'
import { configAntes, configDepois, idsDono } from '@/testing/regras'
import { pendingVersions, resolveRules, type ConfigVersion, type RulesConfig, type WindowSetting } from '@/lib/hub/regras'
import { PADRAO_FUTUROS_CONTA, comBreakeven, comLimite, comRegraJanela } from '@/lib/hub/rascunho'
import { aoSalvarConta, aoSalvarPadrao, comoFicaHoje, notaVersao, partesVersao, quandoVersao, type ComoFicaHoje } from '@/lib/hub/comoFicaHoje'

/** « · » with a no-break space on each side (personalizar/copy.ts SEP): it never starts or ends a line */
const SEP = '\u00a0·\u00a0'

const ids = idsDono()

/** Each line as «left → state · sub», with the tone */
const linhas = (h: ComoFicaHoje) =>
  h.linhas.map((l) => `${l.esquerda.map((t) => t.t).join('')} → ${l.estado}${l.sub ? ` · ${l.sub}` : ''} [${l.tom}${l.forte ? '' : ', leve'}]`)

const win = (r: Rules) => r.windows as WindowSetting[]
const ny = (start: number, end: number, weekdays = MON_TO_FRI): WindowSetting => ({ tz: 'America/New_York', startMin: start, endMin: end, weekdays })
const sp = (start: number, end: number, weekdays = MON_TO_FRI): WindowSetting => ({ tz: 'America/Sao_Paulo', startMin: start, endMin: end, weekdays })

describe('«Como fica hoje» (contrato §4.7)', () => {
  it('the owner’s Top One on a Thursday', () => {
    const r = topOneRules()
    const h = comoFicaHoje(r, et('2026-10-22 12:00'), win(r))
    expect(linhas(h)).toEqual([
      `10:00–11:00 ET${SEP}sua janela → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      'Se a perda do dia chegar a US$\u00a0400 → Encerrado por hoje [red]',
    ])
    expect(h.sub).toBe('no relógio de Nova York')
    expect(h.aviso).toBeNull()
    expect(h.linhas[0].esquerda[0]).toEqual({ t: '10:00–11:00 ET', mono: true })
    expect(h.linhas[2].esquerda[1]).toEqual({ t: 'US$\u00a0400', mono: true })
  })

  it('the owner’s Ebinex', () => {
    const r = ebinexRules()
    const h = comoFicaHoje(r, brt('2026-10-22 12:00'), win(r))
    expect(linhas(h)).toEqual([`20:00–21:00 Brasília${SEP}sua janela → Liberado [mint]`, 'No resto do dia → Fora da sua janela [amber]'])
    expect(h.sub).toBe('no relógio de Brasília')
  })

  it('after 18:00 ET the futures day is already the next one (Friday’s window)', () => {
    const r = topOneRules()
    expect(linhas(comoFicaHoje(r, et('2026-10-22 19:30'), win(r)))[0]).toBe(`10:00–11:00 ET${SEP}sua janela → Liberado [mint]`)
    // Friday after 18:00 is Saturday's day: no window
    expect(linhas(comoFicaHoje(r, et('2026-10-23 18:30'), win(r)))[0]).toBe('O dia todo → Fora da sua janela · hoje não é dia da janela [amber]')
  })

  it('«Liberado», com aviso, outside the window', () => {
    const r: Rules = { ...ebinexRules(), windowRule: { on: true, outside: 'aviso' } }
    expect(linhas(comoFicaHoje(r, brt('2026-10-22 12:00'), win(r)))[1]).toBe('No resto do dia → Liberado · com aviso: fora da janela [neutral]')
  })

  it('a day the window does not open', () => {
    const r = ebinexRules()
    const sat = brt('2026-10-24 12:00')
    expect(linhas(comoFicaHoje(r, sat, win(r)))).toEqual(['O dia todo → Fora da sua janela · hoje não é dia da janela [amber]'])
    const aviso: Rules = { ...r, windowRule: { on: true, outside: 'aviso' } }
    expect(linhas(comoFicaHoje(aviso, sat, win(aviso)))).toEqual(['O dia todo → Liberado · com aviso: hoje não é dia da janela [neutral]'])
  })

  it('rule off with a limit: the window still shows, the rest is «Liberado»', () => {
    const r: Rules = { ...topOneRules(), windowRule: { on: false, outside: 'fora' } }
    expect(linhas(comoFicaHoje(r, et('2026-10-22 12:00'), win(r))).slice(0, 3)).toEqual([
      `10:00–11:00 ET${SEP}sua janela → Liberado [mint]`,
      'No resto do dia → Liberado [mint]',
      'Se a perda do dia chegar a US$\u00a0400 → Encerrado por hoje [red]',
    ])
  })

  it('rule off and no limit: nothing is checked, one line «Sem regra ativa»', () => {
    const r: Rules = { ...topOneRules(), windowRule: { on: false, outside: 'fora' }, limit: null }
    const h = comoFicaHoje(r, et('2026-10-22 12:00'), win(r))
    expect(linhas(h)).toEqual(['O dia todo → Sem regra ativa [muted, leve]'])
    expect(h.aviso).toBeNull()
  })

  it('rule on without a valid window: «Sem janela salva», never «Liberado», with or without a limit', () => {
    const r: Rules = { ...topOneRules(), windows: [], windowsFrom: null, limit: null }
    const h = comoFicaHoje(r, et('2026-10-22 12:00'), [])
    expect(linhas(h)).toEqual(['O dia todo → Sem janela salva [muted, leve]'])
    expect(h.aviso).toBe('Sem janela: a regra da janela não age. Defina em Quando você opera.')
    expect(h.sub).toBe('')
    const withLimit: Rules = { ...r, limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } }
    expect(linhas(comoFicaHoje(withLimit, et('2026-10-22 12:00'), [])).slice(0, 2)).toEqual([
      'O dia todo → Sem janela salva [muted, leve]',
      'Se a perda do dia chegar a US$\u00a0400 → Encerrado por hoje [red]',
    ])
  })

  it('a window with an error does not act, and the warning says to fix it', () => {
    const r: Rules = { ...ebinexRules(), windows: [], windowsFrom: null }
    const h = comoFicaHoje(r, brt('2026-10-22 12:00'), [sp(1200, 1200)])
    expect(linhas(h)).toEqual(['O dia todo → Sem janela salva [muted, leve]'])
    expect(h.aviso).toBe('Corrija a janela em Quando você opera.')
    expect(h.sub).toBe('no relógio de Brasília')
  })

  it('two windows, from the start of the day', () => {
    const r: Rules = { ...topOneRules(), windows: [ny(840, 900), ny(600, 660)] }
    expect(linhas(comoFicaHoje(r, et('2026-10-22 12:00'), win(r))).slice(0, 3)).toEqual([
      `10:00–11:00 ET${SEP}uma das suas janelas → Liberado [mint]`,
      `14:00–15:00 ET${SEP}uma das suas janelas → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
    ])
  })

  it('«somando» and «Só avisar»', () => {
    const r: Rules = { ...topOneRules(), limit: { cents: 40050, mode: 'soma', atLimit: 'avisar' } }
    expect(linhas(comoFicaHoje(r, et('2026-10-22 12:00'), win(r)))[2]).toBe(
      'Se a perda do dia chegar a US$\u00a0400,50 (somando Futuros) → Liberado · com aviso do limite [neutral]',
    )
  })

  it('without the day\'s agenda (not a data screen), the data rule adds no line', () => {
    const zero: Rules = { ...topOneRules(), block: { on: true, beforeMin: 0, afterMin: 0, calendars: ['us'] } }
    const off: Rules = { ...topOneRules(), block: { on: false, beforeMin: 5, afterMin: 10, calendars: ['us'] } }
    for (const r of [zero, off]) expect(linhas(comoFicaHoje(r, et('2026-10-22 12:00'), win(r)))).toHaveLength(3)
  })

  it('«Padrão Futuros» has no limit line', () => {
    const c = configDepois()
    const r = resolveRules(PADRAO_FUTUROS_CONTA, c.settings)
    expect(linhas(comoFicaHoje(r, et('2026-10-22 12:00'), c.settings.markets.futures.windows))).toEqual([
      `10:00–11:00 ET${SEP}sua janela → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
    ])
  })

  it('inside an overnight binary window at 01:00 de Brasília, today is the day the window opened', () => {
    // Opens on segunda only: at 01:00 on terça the day is still segunda's
    const r: Rules = { ...ebinexRules(), windows: [sp(1320, 120, 0b0000001)] }
    expect(linhas(comoFicaHoje(r, brt('2026-10-20 01:00'), win(r)))).toEqual([
      `22:00–02:00 Brasília${SEP}sua janela → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
    ])
    expect(r.day).toEqual(BIN_CLOCK)
  })
})

/** A saved version for the notes, with its «desde» day */
let seq = 0
function versao(rules: Rules, effectiveDay: string, extra: Partial<ConfigVersion> = {}): ConfigVersion {
  seq += 1
  return {
    id: `v-${seq}`,
    versionNo: seq,
    effectiveFrom: new Date(`${effectiveDay}T15:00:00Z`),
    effectiveDay,
    origin: 'salvar',
    copiedFrom: null,
    rules,
    ...extra,
  }
}
const labelOf = (id: string) => (id === ids.topOne ? 'Top One #1' : null)

describe('version notes (board partesSig, contrato §4.8)', () => {
  it('writes every part of the owner’s rules', () => {
    expect(partesVersao(topOneRules())).toEqual({
      janela: `janela 10:00–11:00 ET${SEP}seg–sex`,
      gate: 'só dentro da janela',
      fora: 'fora da janela: “Fora da sua janela”',
      bloq: 'dados: aguardo nos fortes, 5 min antes e 10 depois',
      lim: 'limite US$\u00a0400 por conta',
      est: 'regra por estado: nenhuma escolha',
      // Fase 3c: futures only; «sem breakeven» while the rule does not act
      be: 'sem breakeven',
      cal: 'calendários: EUA',
    })
    expect(partesVersao(ebinexRules())).toEqual({
      janela: `janela 20:00–21:00 de Brasília${SEP}seg–sex`,
      gate: 'só dentro da janela',
      fora: 'fora da janela: “Fora da sua janela”',
      lim: 'sem limite',
    })
  })

  it('v1: «{janela} · {limite}», or «copiadas de …»', () => {
    expect(notaVersao([versao(topOneRules(), '2026-10-17')], 0, labelOf)).toBe(`janela 10:00–11:00 ET${SEP}seg–sex${SEP}limite US$\u00a0400 por conta`)
    expect(notaVersao([versao(ebinexRules(), '2026-10-17')], 0, labelOf)).toBe(`janela 20:00–21:00 de Brasília${SEP}seg–sex${SEP}sem limite`)
    expect(notaVersao([versao(topOneRules(), '2026-10-17', { origin: 'copiar', copiedFrom: ids.topOne })], 0, labelOf)).toBe('copiadas de Top One #1')
  })

  it('later versions list only what changed', () => {
    const v1 = topOneRules()
    const note = (r: Rules) => notaVersao([versao(v1, '2026-10-17'), versao(r, '2026-10-20')], 1, labelOf)
    expect(note({ ...v1, windows: [ny(570, 660)] })).toBe(`janela 09:30–11:00 ET${SEP}seg–sex`)
    expect(note({ ...v1, windows: [ny(570, 660)], windowsFrom: 'account' })).toBe(`janela 09:30–11:00 ET${SEP}seg–sex (só nesta conta)`)
    expect(note({ ...v1, windows: [ny(600, 660), ny(840, 900)] })).toBe(`janela 10:00–11:00 ET${SEP}seg–sex; 14:00–15:00 ET${SEP}seg–sex`)
    expect(note({ ...v1, windows: [], windowsFrom: null })).toBe('sem janela')
    // The «fora da janela» part exists only while the rule is on
    expect(note({ ...v1, windowRule: { on: false, outside: 'fora' } })).toBe('pode operar fora da janela')
    expect(note({ ...v1, windowRule: { on: true, outside: 'aviso' } })).toBe('fora da janela: “Liberado”, com aviso')
    expect(note({ ...v1, block: { on: true, beforeMin: 0, afterMin: 0, calendars: ['us'] } })).toBe('dados: aguardo nos fortes, 0 min antes e 0 depois')
    expect(note({ ...v1, block: { on: false, beforeMin: 5, afterMin: 10, calendars: ['us'] } })).toBe('dados econômicos desligados')
    expect(note({ ...v1, block: { on: true, beforeMin: 10, afterMin: 15, calendars: ['us'] } })).toBe('dados: aguardo nos fortes, 10 min antes e 15 depois')
    expect(note({ ...v1, limit: { cents: 40000, mode: 'soma', atLimit: 'avisar' } })).toBe('limite US$\u00a0400 somando as contas de Futuros, só avisa')
    expect(note({ ...v1, limit: null })).toBe('sem limite')
    expect(note({ ...v1, states: { ...v1.states!, alinhadas: 'so_a_favor', em_conflito: 'opero' } })).toBe(
      `regra por estado: Alinhadas: Só a favor${SEP}Em conflito: Opero`,
    )
    expect(note({ ...v1, block: { ...v1.block!, calendars: ['us', 'eu'] } })).toBe('calendários: EUA e Zona do euro')
    expect(note({ ...v1, block: { ...v1.block!, calendars: [] } })).toBe('calendários: nenhum')
    expect(notaVersao([versao(ebinexRules(), '2026-10-17'), versao({ ...ebinexRules(), limit: { cents: 5000, mode: 'conta', atLimit: 'encerrar' } }, '2026-10-18')], 1, labelOf)).toBe(
      'limite US$\u00a050',
    )
  })
})

describe('when each version held', () => {
  const r = topOneRules()

  it('the latest: «desde {d}», with « (hoje)» on its own day', () => {
    const vs = [versao(r, '2026-10-17')]
    expect(quandoVersao(vs, 0, et('2026-10-17 12:00'))).toBe('desde 17 out (hoje)')
    expect(quandoVersao(vs, 0, et('2026-10-17 18:30'))).toBe('desde 17 out')
    expect(quandoVersao(vs, 0, et('2026-10-20 12:00'))).toBe('desde 17 out')
  })

  it('replaced the same day, the next day, or after a range (same month and across months)', () => {
    const now = et('2026-11-10 12:00')
    expect(quandoVersao([versao(r, '2026-10-17'), versao(r, '2026-10-17')], 0, now)).toBe('17 out, trocada no mesmo dia')
    expect(quandoVersao([versao(r, '2026-10-17'), versao(r, '2026-10-18')], 0, now)).toBe('17 out')
    expect(quandoVersao([versao(r, '2026-10-14'), versao(r, '2026-10-21')], 0, now)).toBe('14 a 20 out')
    expect(quandoVersao([versao(r, '2026-10-28'), versao(r, '2026-11-04')], 0, now)).toBe('28 out a 3 nov')
    expect(quandoVersao([versao(r, '2026-11-01'), versao(r, '2026-11-06')], 0, now)).toBe('1º a 5 nov')
  })
})

describe('«Ao salvar …» from pendingVersions', () => {
  function comMudanca(c: RulesConfig) {
    return comLimite(c.settings, ids.topOne, 50000)
  }

  it('one account: the next version and the day it would carry', () => {
    const c = configDepois()
    const p = pendingVersions(c, comMudanca(c))
    expect(aoSalvarConta(p, ids.topOne, et('2026-10-22 12:00'))).toBe('Ao salvar: Regras v2 desde 22 out.')
    expect(aoSalvarConta(p, ids.ebinex, et('2026-10-22 12:00'))).toBeNull()
  })

  it('a futures save at 18:05 ET lands on the next day', () => {
    const c = configDepois()
    expect(aoSalvarConta(pendingVersions(c, comMudanca(c)), ids.topOne, et('2026-10-22 18:05'))).toBe('Ao salvar: Regras v2 desde 23 out.')
  })

  it('«Padrão Futuros»: the active futures accounts that would get a version', () => {
    const c = configDepois()
    const d = comRegraJanela(c.settings, { tipo: 'padrao' }, { outside: 'aviso' })
    const futuros = c.accounts.filter((a) => a.market === 'futures')
    expect(aoSalvarPadrao(pendingVersions(c, d), futuros, et('2026-10-22 12:00'))).toBe('Ao salvar: versão nova desde 22 out em Top One #1.')
    expect(aoSalvarPadrao(pendingVersions(c, c.settings), futuros, et('2026-10-22 12:00'))).toBeNull()
  })

  it('inside an overnight window, the day a save would carry is the day the window opened', () => {
    const c = configDepois()
    // Ebinex 22:00–02:00 de Brasília; saved at 01:00 on Fri 23 Oct, inside Thursday's window
    const d = { ...c.settings, accounts: { ...c.settings.accounts, [ids.ebinex]: { ...c.settings.accounts[ids.ebinex], window: sp(1320, 120) } } }
    expect(aoSalvarConta(pendingVersions(c, d), ids.ebinex, brt('2026-10-23 01:00'))).toBe('Ao salvar: Regras v2 desde 22 out.')
    expect(aoSalvarConta(pendingVersions(c, d), ids.ebinex, brt('2026-10-23 03:00'))).toBe('Ao salvar: Regras v2 desde 23 out.')
  })

  it('an account without versions: v1 when forced', () => {
    const c = configAntes()
    expect(aoSalvarConta(pendingVersions(c, c.settings), ids.ebinex, brt('2026-10-22 12:00'))).toBeNull()
    expect(aoSalvarConta(pendingVersions(c, c.settings, { force: [ids.ebinex] }), ids.ebinex, brt('2026-10-22 12:00'))).toBe(
      'Ao salvar: Regras v1 desde 22 out.',
    )
  })
})

describe('the new markets (Fase 2b)', () => {
  const clear = (): Rules => ({
    market: 'b3',
    windows: [sp(600, 660)],
    windowsFrom: 'market',
    windowRule: { on: true, outside: 'fora' },
    block: null,
    limit: { cents: 50000, mode: 'conta', atLimit: 'encerrar' },
    states: null,
    day: { tz: 'America/Sao_Paulo', startMin: 0 },
  })
  const ftmo = (): Rules => ({ ...clear(), market: 'forex', windows: [ny(480, 600)], limit: { cents: 100000, mode: 'conta', atLimit: 'avisar' }, day: { tz: 'America/New_York', startMin: 1020 } })

  it('«Se a perda do dia chegar a R$ 500» on B3; no block line, no «somando»', () => {
    const r = clear()
    const h = comoFicaHoje(r, brt('2026-10-22 12:00'), win(r))
    expect(linhas(h)).toEqual([
      `10:00–11:00 Brasília${SEP}sua janela → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      'Se a perda do dia chegar a R$\u00a0500 → Encerrado por hoje [red]',
    ])
    expect(h.sub).toBe('no relógio de Brasília')
    // «somando» is futures only, even on a value the database would refuse
    const soma = comoFicaHoje({ ...r, limit: { ...r.limit!, mode: 'soma' } }, brt('2026-10-22 12:00'), win(r))
    expect(soma.linhas[2].esquerda.map((t) => t.t)).toEqual(['Se a perda do dia chegar a ', 'R$\u00a0500'])
  })

  it('writes the notes of a forex or B3 version: window and limit only, money in the market’s currency', () => {
    expect(partesVersao(clear())).toEqual({
      janela: `janela 10:00–11:00 de Brasília${SEP}seg–sex`,
      gate: 'só dentro da janela',
      fora: 'fora da janela: “Fora da sua janela”',
      lim: 'limite R$\u00a0500',
    })
    expect(partesVersao(ftmo())).toEqual({
      janela: `janela 08:00–10:00 ET${SEP}seg–sex`,
      gate: 'só dentro da janela',
      fora: 'fora da janela: “Fora da sua janela”',
      lim: 'limite US$\u00a01.000, só avisa',
    })
    expect(notaVersao([versao(clear(), '2026-10-17')], 0, labelOf)).toBe(`janela 10:00–11:00 de Brasília${SEP}seg–sex${SEP}limite R$\u00a0500`)
    expect(notaVersao([versao(clear(), '2026-10-17'), versao({ ...clear(), limit: { cents: 75050, mode: 'conta', atLimit: 'encerrar' } }, '2026-10-18')], 1, labelOf)).toBe(
      'limite R$\u00a0750,50',
    )
  })
})

describe('Fase 3c \u00b7 \u00abMover para o breakeven\u00bb in the version notes (board partesSig `be`, contract \u00a76.5 E49)', () => {
  const comBe = (by: Record<string, string>): Rules => ({
    ...topOneRules(),
    breakeven: { by: Object.fromEntries(Object.entries(by).map(([k, n]) => [k, { n, un: 'pts' as const }])) },
  })

  it('\u00abbreakeven com +8 pts no MES, +30 no MNQ e +5 no MGC\u00bb, in the futures table\u2019s order whatever the keys\u2019 order', () => {
    expect(partesVersao(comBe({ MGC: '5', MES: '8', MNQ: '30' })).be).toBe('breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC')
    expect(partesVersao(comBe({ CL: '0.5', ES: '2.25' })).be).toBe('breakeven com +2,25 pts no ES e +0,5 no CL')
    expect(partesVersao(comBe({ MES: '8' })).be).toBe('breakeven com +8 pts no MES')
    // A key outside the table goes after it, alphabetically
    expect(partesVersao(comBe({ ZN: '1', MES: '8', NG: '2' })).be).toBe('breakeven com +8 pts no MES, +2 no NG e +1 no ZN')
  })

  it('\u00absem breakeven\u00bb without the rule; futures only; the first version\u2019s note stays \u00ab{janela} \u00b7 {limite}\u00bb', () => {
    expect(partesVersao(topOneRules()).be).toBe('sem breakeven')
    expect(partesVersao(ebinexRules())).not.toHaveProperty('be')
    expect(notaVersao([versao(comBe({ MES: '8' }), '2026-10-17')], 0, labelOf)).toBe(`janela 10:00\u201311:00 ET${SEP}seg\u2013sex${SEP}limite US$\u00a0400 por conta`)
    // A later version that only adds the rule says only that
    expect(notaVersao([versao(topOneRules(), '2026-10-17'), versao(comBe({ MES: '8', MNQ: '30' }), '2026-10-21')], 1, labelOf)).toBe(
      'breakeven com +8 pts no MES e +30 no MNQ',
    )
    expect(notaVersao([versao(comBe({ MES: '8' }), '2026-10-17'), versao(topOneRules(), '2026-10-21')], 1, labelOf)).toBe('sem breakeven')
  })

  it('no version when the rule is off, or on without an asset (pendingVersions); a value makes one in every futures account that inherits it', () => {
    const c = configDepois()
    const padrao = { tipo: 'padrao' } as const
    expect(pendingVersions(c, comBreakeven(c.settings, padrao, { on: false, by: { MES: '8' } }))).toEqual([])
    expect(pendingVersions(c, comBreakeven(c.settings, padrao, { on: true, by: {} }))).toEqual([])
    const p = pendingVersions(c, comBreakeven(c.settings, padrao, { on: true, by: { MES: '8', MNQ: '30', MGC: '5' } }))
    expect(p.map((x) => x.accountId)).toEqual([ids.topOne])
    expect(partesVersao(p[0].rules).be).toBe('breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC')
  })
})

// ---------------------------------------------------------------------------------------------
// Phase 5-1 · «Dados econômicos» in «Como fica hoje» (c3 §4.2; boards Q19–Q23), the version notes
// (c3 §3.10) and «Próximos dados» (c3 §4.3): the boards' world (testing/agenda), limit US$ 500
// ---------------------------------------------------------------------------------------------
import { releasesOf, type AgendaRead, type AgendaRow, type ReleaseCode, type ReleaseMode } from '@/lib/domain/gate'
import { et as etQ, leituraDoDia, proximosDoQuadro } from '@/testing/agenda'
import { proximosDados } from '@/lib/hub/comoFicaHoje'

/** The world's Top One (limit US$ 500) with these behaviours over the app's default (the long form) */
function quadro(patch: Partial<Record<ReleaseCode, ReleaseMode>> = {}, block: Partial<NonNullable<Rules['block']>> = {}): Rules {
  const r = topOneRules()
  const b = { ...r.block!, ...block }
  const map: Record<string, ReleaseMode> = { ...releasesOf(b), ...patch }
  const releases = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== 'normal')) as NonNullable<Rules['block']>['releases']
  return { ...r, limit: { cents: 50000, mode: 'conta', atLimit: 'encerrar' }, block: { ...b, releases } }
}
const hojeQ = (r: Rules, when: string, semAgenda = false) => linhas(comoFicaHoje(r, etQ(when), win(r), leituraDoDia(etQ(when), { semAgenda })))
const JANELA = `10:00–11:00 ET${SEP}sua janela`
const LIMITE = 'Se a perda do dia chegar a US$ 500 → Encerrado por hoje [red]'

describe('«Como fica hoje» with the day\'s releases (Phase 5-1, c3 §4.2)', () => {
  it('Q19: CPI in «Opero normalmente» is a muted line, before the window', () => {
    const h = comoFicaHoje(quadro({ cpi: 'normal' }), etQ('2026-12-10 09:00'), win(topOneRules()), leituraDoDia(etQ('2026-12-10 09:00')))
    expect(linhas(h)).toEqual([
      'CPI às 08:30 ET → Opero normalmente [muted, leve]',
      `${JANELA} → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      LIMITE,
    ])
    expect(h.linhas[0].esquerda).toEqual([
      { t: 'CPI às ', fraco: true },
      { t: '08:30 ET', mono: true, fraco: true },
    ])
  })

  it('Q20: «Aguardo em volta do horário» waits 08:25–08:40, amber; the window keeps no second line', () => {
    expect(hojeQ(quadro(), '2026-12-10 09:00')).toEqual([
      `08:25–08:40 ET${SEP}espera do CPI → Aguardar até 08:40 [amber]`,
      `${JANELA} → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      LIMITE,
    ])
  })

  it('Q21: «Só opero depois do dado» waits from 18:00 of yesterday', () => {
    expect(hojeQ(quadro({ cpi: 'depois' }), '2026-12-10 09:00')[0]).toBe(`Até 08:40 ET${SEP}só depois do CPI → Aguardar até 08:40 · desde as 18:00 de ontem [amber]`)
  })

  it('Q22: «Não opero no dia» takes the whole day: the window muted, no «No resto do dia», never green', () => {
    expect(hojeQ(quadro({ cpi: 'dia' }), '2026-12-10 09:00')).toEqual([
      `O dia inteiro${SEP}dia de CPI (08:30 ET) → Não opero hoje [amber]`,
      `${JANELA} →  · a sua janela de hoje fica de fora [muted, leve]`,
      LIMITE,
    ])
  })

  it('Q23: the ISM wait cuts the window: «a partir das 10:10, depois da espera»', () => {
    expect(hojeQ(quadro(), '2026-12-03 09:00')).toEqual([
      `09:55–10:10 ET${SEP}espera do ISM de serviços → Aguardar até 10:10 [amber]`,
      `${JANELA} → Liberado · a partir das 10:10, depois da espera [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      LIMITE,
    ])
  })

  it('rule off: the day\'s releases still show as information, without colour (SPEC §7.3 item 14)', () => {
    expect(hojeQ(quadro({}, { on: false }), '2026-12-10 09:00')[0]).toBe('CPI às 08:30 ET → Opero normalmente [muted, leve]')
    expect(hojeQ(quadro({}, { on: false }), '2026-12-03 09:00')[0]).toBe('ISM de serviços às 10:00 ET → Opero normalmente [muted, leve]')
  })

  it('no release today: «Dados econômicos · nenhum dado hoje»', () => {
    expect(hojeQ(quadro(), '2026-12-08 09:00')).toContain('Dados econômicos → nenhum dado hoje [muted, leve]')
    // with the rule off nothing is waited for: nothing to say when the agenda is missing
    expect(hojeQ(quadro({}, { on: false }), '2026-12-10 09:00', true)).not.toContain('Dados econômicos → não conferido: sem a agenda de hoje [muted, leve]')
  })

  describe('the agenda missing: «não conferido», never a green «Liberado» (c3 §4.2 l.761-762; answerOf\'s semAgenda)', () => {
    const NAO_CONFERIDO = 'Dados econômicos → não conferido: sem a agenda de hoje [muted, leve]'
    const semVerde = (ls: string[]) => expect(ls.some((l) => /Liberado.*\[mint/.test(l))).toBe(false)
    const desligada = (r: Rules, limit: Rules['limit']): Rules => ({ ...r, windowRule: { on: false, outside: 'fora' }, limit })
    it('window rule on, with the limit: the window\'s «Liberado» muted', () => {
      for (const ls of [hojeQ(quadro(), '2026-12-10 09:00', true), linhas(comoFicaHoje(quadro(), etQ('2026-12-10 09:00'), win(quadro()), null))]) {
        expect(ls).toEqual([`${JANELA} → Liberado [muted]`, 'No resto do dia → Fora da sua janela [amber]', LIMITE, NAO_CONFERIDO])
        semVerde(ls)
      }
    })
    it('window rule off, with the limit: «Liberado» muted, as the gate\'s «Liberado» semAgenda', () => {
      const r = desligada(quadro(), { cents: 50000, mode: 'conta', atLimit: 'encerrar' })
      const ls = linhas(comoFicaHoje(r, etQ('2026-12-10 07:00'), win(r), null))
      expect(ls).toEqual([`${JANELA} → Liberado [muted]`, 'No resto do dia → Liberado [muted]', LIMITE, NAO_CONFERIDO])
      semVerde(ls)
    })
    it('window rule off and no limit: nothing else is checked, the gate\'s «Dados econômicos não conferidos»', () => {
      const r = desligada(quadro(), null)
      for (const agenda of [null, leituraDoDia(etQ('2026-12-10 07:00'), { semAgenda: true })]) {
        const ls = linhas(comoFicaHoje(r, etQ('2026-12-10 07:00'), win(r), agenda))
        expect(ls).toEqual(['O dia todo → Dados econômicos não conferidos [muted, leve]'])
        semVerde(ls)
      }
    })
  })

  describe('a release of today cancelled or moved (c3 §12.5, caso 17)', () => {
    const AGORA = '2026-12-10 07:00'
    /** The world's day with the CPI of 10 Dec changed */
    const comCpi = (patch: Partial<AgendaRow>): AgendaRead => {
      const read = leituraDoDia(etQ(AGORA))
      return { ...read, rows: read.rows.map((r) => (r.code === 'cpi' && r.day === '2026-12-10' ? { ...r, ...patch } : r)) }
    }
    const dia = (read: AgendaRead) => linhas(comoFicaHoje(quadro(), etQ(AGORA), win(quadro()), read))
    const RESTO = ['No resto do dia → Fora da sua janela [amber]', LIMITE]
    it('cancelled: no wait, the grey line', () => {
      expect(dia(comCpi({ status: 'cancelado' }))).toEqual(['CPI de hoje cancelado: sem espera hoje. →  [muted, leve]', `${JANELA} → Liberado [mint]`, ...RESTO])
    })
    it('postponed without a new date: no wait, never «adiado para» today', () => {
      expect(dia(comCpi({ status: 'adiado' }))).toEqual(['CPI adiado, sem data nova: sem espera hoje. →  [muted, leve]', `${JANELA} → Liberado [mint]`, ...RESTO])
    })
    it('moved out of today: one grey line with the new date', () => {
      expect(dia(comCpi({ at: etQ('2026-12-11 08:30'), wasAt: etQ('2026-12-10 08:30') }))).toEqual([
        'CPI adiado para sex 11 dez: sem espera hoje. →  [muted, leve]',
        `${JANELA} → Liberado [mint]`,
        ...RESTO,
      ])
    })
    it('moved into today, or within today: the wait only, no «adiado» line', () => {
      expect(dia(comCpi({ wasAt: etQ('2026-12-08 08:30') }))).toEqual([`08:25–08:40 ET${SEP}espera do CPI → Aguardar até 08:40 [amber]`, `${JANELA} → Liberado [mint]`, ...RESTO])
      expect(dia(comCpi({ at: etQ('2026-12-10 10:30'), wasAt: etQ('2026-12-10 08:30') }))).toEqual([
        `${JANELA} → Liberado [mint]`,
        `10:25–10:40 ET${SEP}espera do CPI → Aguardar até 10:40 [amber]`,
        ...RESTO,
      ])
    })
  })

  it('a market without the rule never gets a data line', () => {
    const r = ebinexRules()
    expect(linhas(comoFicaHoje(r, brt('2026-12-10 12:00'), win(r), leituraDoDia(etQ('2026-12-10 09:00'))))).toEqual(
      linhas(comoFicaHoje(r, brt('2026-12-10 12:00'), win(r))),
    )
  })
})

describe('«Próximos dados» and «Como fica hoje» agree (c3 §4.2, §4.3)', () => {
  /** «head hour / behaviour wait / não toca» */
  const prox = (r: Rules, when: string, covered?: AgendaRead['covered'] | null) => {
    const p = proximosDados(r, etQ(when), proximosDoQuadro(etQ(when)), covered)
    return { depoisDe: p.depoisDe, linhas: p.linhas.map((l) => [`${l.cabeca}${l.hora}`, `${l.comportamento ?? l.texto ?? ''}${l.espera ?? ''}`, l.naoToca ? 'não toca' : ''].filter(Boolean).join(' / ')) }
  }

  it('two releases at one instant with different behaviours: each line its own wait, in both lists', () => {
    const r = quadro({ pce: 'depois', pib_us: 'volta' })
    expect(prox(r, '2026-12-22 07:00').linhas.filter((l) => l.startsWith('Amanhã'))).toEqual([
      `Amanhã${SEP}PCE${SEP}08:30 ET / Só opero depois do dado${SEP}espera até 08:40 / não toca`,
      `Amanhã${SEP}PIB dos EUA${SEP}08:30 ET / Aguardo em volta do horário${SEP}08:25–08:40 / não toca`,
    ])
    expect(hojeQ(r, '2026-12-23 07:00')).toEqual([
      `Até 08:40 ET${SEP}só depois do PCE → Aguardar até 08:40 · desde as 18:00 de ontem [amber]`,
      `08:25–08:40 ET${SEP}espera do PIB dos EUA → Aguardar até 08:40 [amber]`,
      `${JANELA} → Liberado [mint]`,
      'No resto do dia → Fora da sua janela [amber]',
      LIMITE,
    ])
  })

  it('after 18:00 New York «Hoje» is the trading day that has turned, as «Como fica hoje»', () => {
    const p = prox(quadro(), '2026-12-09 19:00')
    expect(p.linhas[0]).toBe(`Hoje${SEP}CPI${SEP}08:30 ET / Aguardo em volta do horário${SEP}08:25–08:40 / não toca`)
    expect(p.depoisDe).toBe('Depois de dom 13: datas previstas, podem mudar.')
    expect(hojeQ(quadro(), '2026-12-09 19:00')[0]).toBe(`08:25–08:40 ET${SEP}espera do CPI → Aguardar até 08:40 [amber]`)
    // before 18:00 the CPI is still tomorrow's
    expect(prox(quadro(), '2026-12-09 17:00').linhas.find((l) => l.includes('CPI'))).toMatch(/^Amanhã/)
  })

  it('«Depois de {dia}»: the last day the day\'s read (E5) shows covered, never past today + 3', () => {
    const us = (...days: string[]) => days.map((day) => ({ calendar: 'us' as const, day }))
    expect(prox(quadro(), '2026-12-10 09:00', us('2026-12-09', '2026-12-10', '2026-12-11')).depoisDe).toBe('Depois de dom 13: datas previstas, podem mudar.')
    expect(prox(quadro(), '2026-12-10 09:00', us('2026-12-09', '2026-12-10')).depoisDe).toBe('Depois de qui 10: datas previstas, podem mudar.')
    expect(prox(quadro(), '2026-12-10 09:00', []).depoisDe).toBe('Depois de qua 9: datas previstas, podem mudar.')
    // the world's read: covered D − 1..D + 1
    expect(prox(quadro(), '2026-12-10 09:00', leituraDoDia(etQ('2026-12-10 09:00')).covered).depoisDe).toBe('Depois de dom 13: datas previstas, podem mudar.')
  })
})

describe('the data rule\'s version note names the ready-made choice (c3 §3.10)', () => {
  const bloq = (r: Rules) => partesVersao(r).bloq
  it('the four choices and the rule off', () => {
    expect(bloq(quadro())).toBe('dados: aguardo nos fortes, 5 min antes e 10 depois')
    expect(bloq(quadro({ cpi: 'depois', ppi: 'depois', payroll: 'depois', pce: 'depois', pib_us: 'depois', varejo_us: 'depois' }))).toBe(
      'dados: só depois dos das 08:30, 10 min depois; nos outros fortes, 5 min antes e 10 depois',
    )
    expect(bloq(quadro({ cpi: 'dia', payroll: 'dia', fomc_decisao: 'dia', fomc_entrevista: 'dia' }))).toBe(
      'dados: sem operar em dia de CPI, Payroll e Fed; nos outros, 5 min antes e 10 depois',
    )
    expect(bloq(quadro({ cpi: 'dia' }))).toBe('dados: escolha por dado, 5 min antes e 10 depois')
    expect(bloq(quadro({}, { on: false }))).toBe('dados econômicos desligados')
  })
})

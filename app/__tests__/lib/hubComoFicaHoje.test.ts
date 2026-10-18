/**
 * @jest-environment node
 */
import { MON_TO_FRI } from '@/lib/domain/tempo'
import type { Rules } from '@/lib/domain/gate'
import { BIN_CLOCK, brt, ebinexRules, et, topOneRules } from '@/testing/gate'
import { configAntes, configDepois, idsDono } from '@/testing/regras'
import { pendingVersions, resolveRules, type ConfigVersion, type RulesConfig, type WindowSetting } from '@/lib/hub/regras'
import { PADRAO_FUTUROS_CONTA, comLimite, comRegraJanela } from '@/lib/hub/rascunho'
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
      'Bloqueio de dados → ativo na Fase 5 [muted, leve]',
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
    expect(linhas(h)).toEqual(['O dia todo → Sem janela salva [muted, leve]', 'Bloqueio de dados → ativo na Fase 5 [muted, leve]'])
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

  it('a block of 0 + 0 minutes, or off, has no block line', () => {
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
      'Bloqueio de dados → ativo na Fase 5 [muted, leve]',
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
      bloq: 'bloqueio 5 min antes e 10 depois',
      lim: 'limite US$\u00a0400 por conta',
      est: 'regra por estado: nenhuma escolha',
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
    expect(note({ ...v1, block: { on: true, beforeMin: 0, afterMin: 0, calendars: ['us'] } })).toBe('sem bloqueio')
    expect(note({ ...v1, block: { on: true, beforeMin: 10, afterMin: 15, calendars: ['us'] } })).toBe('bloqueio 10 min antes e 15 depois')
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

/**
 * @jest-environment node
 */
import { MON_TO_FRI, EVERY_DAY } from '@/lib/domain/tempo'
import { brt, et } from '@/testing/gate'
import { configDepois, idsDono } from '@/testing/regras'
import type { WindowSetting } from '@/lib/hub/regras'
import { ACCOUNT_MARKETS, MARKET_SPEC } from '@/lib/domain/markets'
import {
  BR,
  JANELA_SUGERIDA,
  NY,
  RELOGIO_PADRAO,
  SEGUNDA_SUGERIDA,
  captionJanela,
  converterJanela,
  faixaJanela,
  legendaJanela,
  proximaMudancaNY,
  relogioDoMercado,
  resumoDias,
  trocarRelogio,
  viraODia,
} from '@/lib/hub/janelas'

/** « · » with a no-break space on each side (personalizar/copy.ts SEP): it never starts or ends a line */
const SEP = '\u00a0·\u00a0'

const topOne: WindowSetting = { tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI }
const ebinex: WindowSetting = { tz: BR, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }
const w = (tz: WindowSetting['tz'], start: number, end: number, weekdays = MON_TO_FRI): WindowSetting => ({ tz, startMin: start, endMin: end, weekdays })

describe('faixaJanela and the days', () => {
  it('writes a range on the window clock', () => {
    expect(faixaJanela(600, 660)).toBe('10:00–11:00')
    expect(faixaJanela(1320, 120)).toBe('22:00–02:00')
  })

  it('summarises the days as the board does', () => {
    expect(resumoDias(MON_TO_FRI)).toBe('seg–sex')
    expect(resumoDias(0b0000111)).toBe('seg–qua')
    expect(resumoDias(0b0000101)).toBe('seg, qua')
    expect(resumoDias(0b1100000)).toBe('sáb, dom')
    // Three days that are not consecutive are listed, never a range
    expect(resumoDias(0b0010101)).toBe('seg, qua, sex')
    expect(resumoDias(EVERY_DAY)).toBe('todos os dias')
    expect(resumoDias(0)).toBe('nenhum dia marcado')
  })

  it('knows a window that ends the next day', () => {
    expect(viraODia(w(BR, 1320, 120))).toBe(true)
    expect(viraODia(topOne)).toBe(false)
  })

  it('suggests the owner’s windows', () => {
    expect(JANELA_SUGERIDA.futures).toEqual(topOne)
    expect(JANELA_SUGERIDA.binary).toEqual(ebinex)
  })

  it('suggests each market’s window and clock from MARKET_SPEC (Fase 2b; crypto every day)', () => {
    expect(JANELA_SUGERIDA.forex).toEqual(w(NY, 480, 600))
    expect(JANELA_SUGERIDA.stocks).toEqual(w(NY, 570, 630))
    expect(JANELA_SUGERIDA.crypto).toEqual(w(BR, 1200, 1320, EVERY_DAY))
    expect(JANELA_SUGERIDA.b3).toEqual(w(BR, 600, 660))
    expect(JANELA_SUGERIDA.options).toEqual(JANELA_SUGERIDA.stocks)
    expect(RELOGIO_PADRAO).toEqual({ futures: NY, binary: BR, forex: NY, stocks: NY, crypto: BR, b3: BR, options: NY })
    expect(SEGUNDA_SUGERIDA).toEqual({
      futures: { startMin: 840, endMin: 900 },
      binary: { startMin: 540, endMin: 600 },
      forex: { startMin: 180, endMin: 300 },
      stocks: { startMin: 900, endMin: 960 },
      crypto: { startMin: 540, endMin: 660 },
      b3: { startMin: 840, endMin: 900 },
      options: { startMin: 900, endMin: 960 },
    })
    for (const m of ACCOUNT_MARKETS) expect(MARKET_SPEC[m].windowTzs).toContain(JANELA_SUGERIDA[m].tz)
    // A market without a window is on its default clock
    expect(relogioDoMercado(configDepois().settings, 'crypto')).toBe(BR)
    expect(relogioDoMercado(configDepois().settings, 'stocks')).toBe(NY)
  })
})

describe('captions on the other clock', () => {
  it('Sat 17 Oct: today’s offsets only (1 Nov is more than 14 days away)', () => {
    const now = et('2026-10-17 12:00')
    expect(captionJanela(topOne, now)).toBe(`11:00–12:00 em Brasília${SEP}seg–sex`)
    expect(captionJanela(ebinex, now)).toBe(`19:00–20:00 ET${SEP}seg–sex`)
  })

  it('Sun 18 Oct and Sat 31 Oct: the new time from 1º nov too', () => {
    for (const now of [et('2026-10-18 12:00'), et('2026-10-31 12:00')]) {
      expect(captionJanela(topOne, now)).toBe(`11:00–12:00 em Brasília; a partir de 1º nov: 12:00–13:00 em Brasília${SEP}seg–sex`)
      expect(captionJanela(ebinex, now)).toBe(`19:00–20:00 ET; a partir de 1º nov: 18:00–19:00 ET${SEP}seg–sex`)
    }
  })

  it('Mon 2 Nov: back to one clock, with the winter offsets', () => {
    const now = et('2026-11-02 10:00')
    expect(now.toISOString()).toBe('2026-11-02T15:00:00.000Z')
    expect(captionJanela(topOne, now)).toBe(`12:00–13:00 em Brasília${SEP}seg–sex`)
    expect(captionJanela(ebinex, now)).toBe(`18:00–19:00 ET${SEP}seg–sex`)
  })

  it('says when the other clock crosses midnight', () => {
    const now = et('2026-10-17 12:00')
    expect(legendaJanela(w(NY, 1350, 1410), now)).toBe('23:30–00:30 em Brasília, até o dia seguinte')
    expect(legendaJanela(w(NY, 1410, 30), now)).toBe('00:30–01:30 em Brasília, já no dia seguinte')
    expect(legendaJanela(w(BR, 30, 90), now)).toBe('23:30–00:30 ET, ainda no dia anterior')
    // Exactly at midnight: a start at 00:00 on the other clock is already the next day; an end at
    // 00:00 does not reach into it
    expect(legendaJanela(w(NY, 1380, 1410), now)).toBe('00:00–00:30 em Brasília, já no dia seguinte')
    expect(legendaJanela(w(NY, 1320, 1380), now)).toBe('23:00–00:00 em Brasília')
  })

  it('start = end: no other clock, the days only', () => {
    const now = et('2026-10-17 12:00')
    expect(legendaJanela(w(NY, 600, 600), now)).toBe('')
    expect(captionJanela(w(NY, 600, 600), now)).toBe('seg–sex')
  })

  it('names New York’s next change for the info panel', () => {
    expect(proximaMudancaNY(et('2026-10-17 12:00'))).toBe('1º nov')
    expect(proximaMudancaNY(et('2026-11-02 10:00'))).toBe('14 mar')
  })
})

describe('switching the clock', () => {
  it('keeps the instants at today’s offsets: 10:00–11:00 ET → 11:00–12:00 Brasília in October', () => {
    const now = et('2026-10-19 12:00')
    expect(converterJanela(topOne, BR, now)).toEqual(w(BR, 660, 720))
    expect(converterJanela(w(BR, 660, 720), NY, now)).toEqual(topOne)
    expect(converterJanela(topOne, BR, et('2026-11-02 10:00'))).toEqual(w(BR, 720, 780))
  })

  it('moves the days with a start that crosses midnight (00:30 Brasília on seg = 23:30 ET on dom)', () => {
    const now = brt('2026-10-19 12:00')
    expect(converterJanela(w(BR, 30, 90, 0b0000001), NY, now)).toEqual(w(NY, 1410, 30, 0b1000000))
    expect(converterJanela(w(NY, 1410, 30, 0b1000000), BR, now)).toEqual(w(BR, 30, 90, 0b0000001))
  })

  it('converts the market’s windows and the own windows of its accounts only', () => {
    const { topOne: top, ebinex: bin } = idsDono()
    const c = configDepois()
    const s = {
      ...c.settings,
      accounts: {
        ...c.settings.accounts,
        [top]: { ...c.settings.accounts[top], window: w(NY, 540, 600) },
        [bin]: { ...c.settings.accounts[bin], window: w(BR, 1080, 1140) },
      },
    }
    const out = trocarRelogio(s, 'futures', BR, et('2026-10-19 12:00'), [top])
    expect(out.markets.futures.windows).toEqual([w(BR, 660, 720)])
    expect(out.accounts[top].window).toEqual(w(BR, 600, 660))
    expect(out.accounts[bin].window).toEqual(w(BR, 1080, 1140))
    expect(out.markets.binary).toBe(s.markets.binary)
    expect(relogioDoMercado(out, 'futures')).toBe(BR)
    expect(relogioDoMercado({ ...out, markets: { ...out.markets, binary: { ...out.markets.binary, windows: [] } } }, 'binary')).toBe(BR)
  })
})

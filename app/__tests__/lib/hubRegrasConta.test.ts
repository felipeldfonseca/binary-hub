/**
 * @jest-environment node
 */
import { MON_TO_FRI } from '@/lib/domain/tempo'
import type { ImportRow } from '@/lib/domain/import'
import { brt, et, topOneRules } from '@/testing/gate'
import { configAntes, configDepois, configMercados, idsDono, idsMercados } from '@/testing/regras'
import { MARKET_SPEC, type AccountMarket } from '@/lib/domain/markets'
import { resolveRules, type AccountSettings, type RulesConfig, type WindowSetting } from '@/lib/hub/regras'
import { REGRAS_CONTA } from '@/components/hub/contas/copyRegras'
import { FIM_CONTA, PASSO_B } from '@/components/hub/contas/copy'
import {
  NAO_COPIAR,
  REGRAS_FORM_VAZIO,
  comCopiar,
  contarAntesDasRegras,
  desdeDaNovaConta,
  faixaResumo,
  linhaAntesDasRegras,
  linhaImportadas,
  linhaResumo,
  moedaEViradaDoDia,
  notaCopiar,
  mesmaJanela,
  novaContaNaConfig,
  opcoesCopiar,
  outrasContasComVersao,
  partesRegras,
  perguntaJanela,
  regrasDaNovaConta,
  regrasEditadas,
  regrasResolvidas,
  textoLimite,
  viradaEmBrasilia,
  type RegrasForm,
} from '@/lib/hub/regrasConta'

const NBSP = ' '
const NY = 'America/New_York'
const SP = 'America/Sao_Paulo'
const ids = idsDono()
const w = (tz: WindowSetting['tz'], startMin: number, endMin: number, weekdays = MON_TO_FRI): WindowSetting => ({ tz, startMin, endMin, weekdays })

/** configDepois with some saved account settings changed */
function comConta(base: RulesConfig, id: string, patch: Partial<AccountSettings>): RulesConfig {
  const cur = base.settings.accounts[id]
  return { ...base, settings: { ...base.settings, accounts: { ...base.settings.accounts, [id]: { ...cur, ...patch } } } }
}

const form = (f: Partial<RegrasForm> = {}): RegrasForm => ({ ...REGRAS_FORM_VAZIO, ...f })
const resumo = (config: RulesConfig, market: AccountMarket, f: RegrasForm = form()) => linhaResumo(regrasDaNovaConta(config, market, f), f)

describe('«Copiar regras de»', () => {
  it('offers the active accounts of the same market only, never across markets', () => {
    const c = configDepois()
    expect(opcoesCopiar(c, 'futures')).toEqual([{ id: ids.topOne, label: 'Top One #1' }])
    expect(opcoesCopiar(c, 'binary')).toEqual([{ id: ids.ebinex, label: 'Ebinex' }])
  })

  it('leaves archived and example accounts out', () => {
    const c = configDepois()
    const archived = { ...c, accounts: c.accounts.map((a) => (a.id === ids.topOne ? { ...a, archivedAt: '2026-10-18T12:00:00Z' } : a)) }
    expect(opcoesCopiar(archived, 'futures')).toEqual([])
    const example = { ...c, accounts: c.accounts.map((a) => (a.id === ids.ebinex ? { ...a, isExample: true } : a)) }
    expect(opcoesCopiar(example, 'binary')).toEqual([])
  })

  it('a chosen source that is no longer offered (archived meanwhile) falls back to the first account of the market', () => {
    const c = configDepois()
    const apex = { ...c.accounts[0], id: 'acc-apex', label: 'Apex A', archivedAt: '2026-10-18T12:00:00Z' }
    const comApex = { ...c, accounts: [...c.accounts, apex], settings: { ...c.settings, accounts: { ...c.settings.accounts, 'acc-apex': c.settings.accounts[ids.topOne] } } }
    expect(regrasDaNovaConta(comApex, 'futures', form({ copiar: 'acc-apex' })).copiar).toBe(ids.topOne)
    expect(regrasDaNovaConta(comApex, 'futures', form({ copiar: ids.ebinex })).copiar).toBe(ids.topOne)
  })

  it('starts on the first account of the market, and «Não copiar» starts from the market default', () => {
    const c = configDepois()
    const copia = regrasDaNovaConta(c, 'futures', form())
    expect(copia.copiar).toBe(ids.topOne)
    expect(notaCopiar(copia)).toBe('Copia janela, limite do dia, bloqueio de dados e regra do estado.')
    expect(notaCopiar(regrasDaNovaConta(c, 'binary', form()))).toBe('Copia janela e limite do dia.')
    const nao = regrasDaNovaConta(c, 'futures', form({ copiar: NAO_COPIAR }))
    expect(nao.copiar).toBeNull()
    expect(notaCopiar(nao)).toBe('Começa com o padrão do mercado.')
    // No account of the market: nothing to copy
    expect(regrasDaNovaConta({ ...c, accounts: [] }, 'futures', form()).copiar).toBeNull()
  })

  it('copies the source’s saved settings: limit, mode and «Ao chegar»', () => {
    const c = comConta(configDepois(), ids.topOne, {
      windowRule: { outside: 'aviso' },
      block: { beforeMin: 15 },
      limit: { cents: 40050, mode: 'soma', atLimit: 'avisar' },
    })
    const r = regrasDaNovaConta(c, 'futures', form())
    expect(r.limiteTexto).toBe('400,50')
    expect(r.modo).toBe('soma')
    expect(r.settings).toEqual({
      windowRule: { outside: 'aviso' },
      block: { beforeMin: 15 },
      limit: { cents: 40050, mode: 'soma', atLimit: 'avisar' },
      window: null,
    })
    expect(r.marketWindows).toBeUndefined()
  })

  it('changing the source starts the window choice, the limit and its mode again', () => {
    const f = form({ copiar: ids.topOne, janela: 'propria', propria: w(NY, 540, 600), limite: '900', modo: 'soma', aberto: true })
    expect(comCopiar(f, NAO_COPIAR)).toEqual({ aberto: true, copiar: NAO_COPIAR })
    expect(regrasEditadas(REGRAS_FORM_VAZIO)).toBe(false)
    expect(regrasEditadas(form({ aberto: true }))).toBe(false)
    expect(regrasEditadas(form({ limite: '' }))).toBe(true)
  })
})

describe('the summary line', () => {
  it('copying the Top One: the market window and its limit per account', () => {
    expect(resumo(configDepois(), 'futures')).toBe(`Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: US$${NBSP}400 por conta`)
  })

  it('copying the Ebinex, which has no limit: «sem limite»; «Não copiar» and empty: «definir»', () => {
    expect(resumo(configDepois(), 'binary')).toBe('Janela 20:00–21:00 (Brasília) · padrão de Binárias · limite do dia: sem limite')
    expect(resumo(configDepois(), 'binary', form({ copiar: NAO_COPIAR }))).toBe(
      'Janela 20:00–21:00 (Brasília) · padrão de Binárias · limite do dia: definir',
    )
    // Typed and cleared again: «definir», as on the board
    expect(resumo(configDepois(), 'binary', form({ limite: '' }))).toMatch(/limite do dia: definir$/)
  })

  it('an own window («Outra»): «só nesta conta», starting from the market’s first window', () => {
    const f = form({ janela: 'propria' })
    const r = regrasDaNovaConta(configDepois(), 'futures', f)
    expect(r.usarPadrao).toBe(false)
    expect(r.janela).toEqual(w(NY, 600, 660))
    expect(r.settings.window).toEqual(w(NY, 600, 660))
    expect(linhaResumo(r, f)).toBe(`Janela 10:00–11:00 (Nova York) · só nesta conta · limite do dia: US$${NBSP}400 por conta`)
  })

  it('a window that ends the next day, and one that cannot be saved', () => {
    const noite = form({ janela: 'propria', propria: w(SP, 1320, 120) })
    expect(resumo(configDepois(), 'binary', noite)).toBe(
      'Janela 22:00 → 02:00 do dia seguinte (Brasília) · só nesta conta · limite do dia: sem limite',
    )
    const igual = form({ janela: 'propria', propria: w(NY, 600, 600) })
    const r = regrasDaNovaConta(configDepois(), 'futures', igual)
    expect(linhaResumo(r, igual)).toBe(`Janela a definir (Nova York) · só nesta conta · limite do dia: US$${NBSP}400 por conta`)
    expect(r.janelaErro).toBe('same_start_end')
    expect(r.bloqueado).toBe(true)
    expect(regrasDaNovaConta(configDepois(), 'futures', form({ janela: 'propria', propria: w(NY, 600, 660, 0) })).janelaErro).toBe('no_days')
    expect(faixaResumo(w(NY, 600, 660, 0))).toBe('a definir')
  })

  it('a source with its own window starts on «Outra» with that window', () => {
    const c = comConta(configDepois(), ids.topOne, { window: w(NY, 570, 690) })
    const r = regrasDaNovaConta(c, 'futures', form())
    expect(r.usarPadrao).toBe(false)
    expect(r.janela).toEqual(w(NY, 570, 690))
    expect(linhaResumo(r, form())).toMatch(/^Janela 09:30–11:30 \(Nova York\) · só nesta conta · /)
    // «Sim» goes back to the market's window
    expect(regrasDaNovaConta(c, 'futures', form({ janela: 'padrao' })).settings.window).toBeNull()
  })

  it('no market window: «sem janela» until the form sets one, which becomes the market’s', () => {
    const c = configAntes()
    expect(resumo(c, 'futures', form({ copiar: NAO_COPIAR }))).toBe('Janela: sem janela · limite do dia: definir')
    expect(resumo(c, 'futures')).toBe('Janela: sem janela · limite do dia: sem limite')
    const f = form({ definir: true })
    const r = regrasDaNovaConta(c, 'futures', f)
    expect(r.janela).toEqual(w(NY, 600, 660))
    expect(r.marketWindows).toEqual([w(NY, 600, 660)])
    expect(r.settings.window).toBeNull()
    expect(linhaResumo(r, f)).toBe('Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: sem limite')
    expect(regrasDaNovaConta(c, 'binary', f).marketWindows).toEqual([w(SP, 1200, 1260)])
    expect(perguntaJanela(r)).toBeNull()
  })

  it('the limit: «somando», binaries without a mode, and what was typed when it is not a number', () => {
    const c = configDepois()
    expect(resumo(c, 'futures', form({ modo: 'soma' }))).toMatch(new RegExp(`limite do dia: US\\$${NBSP}400 somando as contas de Futuros$`))
    const bin = regrasDaNovaConta(c, 'binary', form({ limite: '1.000' }))
    expect(bin.temModo).toBe(false)
    expect(bin.settings.limit).toEqual({ cents: 100000, mode: 'conta', atLimit: 'encerrar' })
    expect(linhaResumo(bin, form({ limite: '1.000' }))).toMatch(new RegExp(`limite do dia: US\\$${NBSP}1\\.000$`))
    const letras = form({ limite: 'abc' })
    const r = regrasDaNovaConta(c, 'futures', letras)
    expect(r.limiteErro).toBe('invalid')
    expect(r.settings.limit).toBeNull()
    expect(r.bloqueado).toBe(true)
    expect(linhaResumo(r, letras)).toMatch(new RegExp(`limite do dia: US\\$${NBSP}abc por conta$`))
    expect(regrasDaNovaConta(c, 'futures', form({ limite: '0' })).limiteErro).toBe('not_positive')
    expect(regrasDaNovaConta(c, 'futures', form({ limite: '2.000.000' })).limiteErro).toBe('too_large')
    expect(regrasDaNovaConta(c, 'futures', form({ limite: '' })).limiteErro).toBeNull()
  })

  it('shows the mode only to futures with another futures account', () => {
    expect(regrasDaNovaConta(configDepois(), 'futures', form()).temModo).toBe(true)
    const semFuturos = { ...configDepois(), accounts: configDepois().accounts.filter((a) => a.market !== 'futures') }
    expect(regrasDaNovaConta(semFuturos, 'futures', form()).temModo).toBe(false)
  })

  it('writes the limit field as typed in pt-BR', () => {
    expect(textoLimite(40000)).toBe('400')
    expect(textoLimite(40050)).toBe('400,50')
    expect(textoLimite(5)).toBe('0,05')
  })
})

describe('the «Usar a janela» question', () => {
  it('names the market’s window on its clock', () => {
    expect(perguntaJanela(regrasDaNovaConta(configDepois(), 'futures', form()))).toBe('Usar a janela de Futuros (10:00–11:00 ET)?')
    expect(perguntaJanela(regrasDaNovaConta(configDepois(), 'binary', form()))).toBe('Usar a janela de Binárias (20:00–21:00 de Brasília)?')
    const c = configDepois()
    c.settings.markets.futures.windows = [w(NY, 600, 660), w(NY, 840, 900)]
    expect(perguntaJanela(regrasDaNovaConta(c, 'futures', form()))).toBe('Usar a janela de Futuros (10:00–11:00 e 14:00–15:00 ET)?')
    expect(resumo(c, 'futures')).toMatch(/^Janela 10:00–11:00 e 14:00–15:00 \(Nova York\) · padrão de Futuros · /)
  })
})

// Fase 2b foundation: the creation form names the market with copyMercados' short form
// (MERCADO[m].deCurto). Moved here from copyMercados.test.ts: these keys are lane A's.
describe('the market’s name in the creation form', () => {
  it('names the creation form’s market with its short form', () => {
    expect(REGRAS_CONTA.padraoDe('futures')).toBe('padrão de Futuros')
    expect(REGRAS_CONTA.padraoDe('binary')).toBe('padrão de Binárias')
    expect(REGRAS_CONTA.padraoDe('b3')).toBe('padrão da B3')
    expect(REGRAS_CONTA.pergunta('futures', ['10:00–11:00'], 'America/New_York')).toBe('Usar a janela de Futuros (10:00–11:00 ET)?')
    expect(REGRAS_CONTA.pergunta('b3', ['10:00–11:00'], 'America/Sao_Paulo')).toBe('Usar a janela da B3 (10:00–11:00 de Brasília)?')
    expect(REGRAS_CONTA.outrasContas('binary', '17 out', ['Pocket'])).toBe(
      'Ao criar, esta janela passa a ser a de Binárias: Pocket também ganha versão nova das regras desde 17 out.',
    )
  })

  it('passes the market to Personalizar’s window labels', () => {
    expect(REGRAS_CONTA.inicioMercadoAria('binary', 'America/Sao_Paulo')).toBe('Início da janela de Opções binárias, horário de Brasília')
    expect(REGRAS_CONTA.cancelarJanelaAria('futures')).toBe('Cancelar a janela nova de Futuros')
  })
})

// Fase 2b: Forex, Ações e opções (EUA), Cripto and B3 in the creation form (board ImportarConta
// scenarios 11–14): window and daily limit only, in the market's money, on the market's day clock
describe('the Fase 2b markets in the creation form', () => {
  const NOVOS = ['forex', 'stocks', 'crypto', 'b3'] as const

  it('a market’s first account: nothing to copy, «sem janela» and «definir» until the form sets them', () => {
    const c = configAntes()
    for (const m of NOVOS) {
      const r = regrasDaNovaConta(c, m, form())
      expect(r.opcoes).toEqual([])
      expect(r.copiar).toBeNull()
      expect(notaCopiar(r)).toBe('Começa com o padrão do mercado.')
      expect(perguntaJanela(r)).toBeNull()
      expect(r.janela).toBeNull()
      expect(linhaResumo(r, form())).toBe('Janela: sem janela · limite do dia: definir')
    }
  })

  it('«+ Definir janela» brings the market’s suggested window, which becomes the market’s (board `X.MK[*].sug`)', () => {
    const c = configAntes()
    const def = form({ definir: true, limite: '500' })
    const forex = regrasDaNovaConta(c, 'forex', def)
    expect(forex.janela).toEqual(w(NY, 480, 600))
    expect(forex.marketWindows).toEqual([w(NY, 480, 600)])
    expect(linhaResumo(forex, def)).toBe(`Janela 08:00–10:00 (Nova York) · padrão de Forex · limite do dia: US$${NBSP}500`)
    expect(resumo(c, 'stocks', def)).toBe(`Janela 09:30–10:30 (Nova York) · padrão de Ações · limite do dia: US$${NBSP}500`)
    // Crypto opens every day: Saturday and Sunday come marked
    const cripto = regrasDaNovaConta(c, 'crypto', def)
    expect(cripto.janela).toEqual(w(SP, 1200, 1320, 127))
    expect(linhaResumo(cripto, def)).toBe(`Janela 20:00–22:00 (Brasília) · padrão de Cripto · limite do dia: US$${NBSP}500`)
    // B3 is in reais
    const b3form = form({ definir: true, limite: '400' })
    const b3 = regrasDaNovaConta(c, 'b3', b3form)
    expect(b3.janela).toEqual(w(SP, 600, 660))
    expect(linhaResumo(b3, b3form)).toBe(`Janela 10:00–11:00 (Brasília) · padrão da B3 · limite do dia: R$${NBSP}400`)
    // «Cancelar esta janela» goes back to none
    expect(regrasDaNovaConta(c, 'b3', form({ definir: false })).janela).toBeNull()
  })

  it('the crypto note goes under the days of the crypto window only', () => {
    expect(REGRAS_CONTA.diasNota.crypto).toBe('Cripto abre todos os dias: sábado e domingo já vêm marcados.')
    for (const m of ['futures', 'binary', 'forex', 'stocks', 'b3'] as const) expect(REGRAS_CONTA.diasNota[m]).toBeUndefined()
  })

  it('the limit in the market’s money, and what was typed when it is not a number: «R$ abc» on B3', () => {
    const c = configAntes()
    expect(REGRAS_CONTA.limite('US$')).toBe('Limite do dia, US$')
    expect(REGRAS_CONTA.limite('R$')).toBe('Limite do dia, R$')
    const letras = form({ limite: 'abc' })
    const r = regrasDaNovaConta(c, 'b3', letras)
    expect(r.limiteErro).toBe('invalid')
    expect(r.bloqueado).toBe(true)
    expect(linhaResumo(r, letras)).toBe(`Janela: sem janela · limite do dia: R$${NBSP}abc`)
    // «R$» typed in front is read, as «US$» is
    expect(regrasDaNovaConta(c, 'b3', form({ limite: 'R$ 1.000,50' })).settings.limit).toEqual({ cents: 100050, mode: 'conta', atLimit: 'encerrar' })
    expect(resumo(c, 'b3', form({ limite: '1.000,50' }))).toBe(`Janela: sem janela · limite do dia: R$${NBSP}1.000,50`)
  })

  it('never «por conta / somando» outside Futuros, even with another account of the market', () => {
    const c = configMercados()
    const ids = idsMercados()
    for (const m of NOVOS) {
      const r = regrasDaNovaConta(c, m, form({ modo: 'soma', limite: '300' }))
      expect(r.temModo).toBe(false)
      expect(r.modo).toBe('conta')
      expect(r.settings.limit?.mode).toBe('conta')
      expect(linhaResumo(r, form({ limite: '300' }))).not.toMatch(/por conta|somando/)
    }
    // A second forex account: FTMO to copy from, its window to answer «Usar a janela de Forex …?»
    const forex = regrasDaNovaConta(c, 'forex', form())
    expect(forex.opcoes).toEqual([{ id: ids.ftmo, label: 'FTMO' }])
    expect(notaCopiar(forex)).toBe('Copia janela e limite do dia.')
    expect(perguntaJanela(forex)).toBe('Usar a janela de Forex (08:00–10:00 ET)?')
    expect(linhaResumo(forex, form())).toBe(`Janela 08:00–10:00 (Nova York) · padrão de Forex · limite do dia: US$${NBSP}1.000`)
    const b3 = regrasDaNovaConta(c, 'b3', form())
    expect(perguntaJanela(b3)).toBe('Usar a janela da B3 (10:00–11:00 de Brasília)?')
    expect(linhaResumo(b3, form())).toBe(`Janela 10:00–11:00 (Brasília) · padrão da B3 · limite do dia: R$${NBSP}500`)
    // IBKR has no version and no window: a second stocks account starts with none to answer
    expect(perguntaJanela(regrasDaNovaConta(c, 'stocks', form()))).toBeNull()
  })

  it('v1 on the market’s day clock: Forex turns at 17:00 ET, Ações at 20:00 ET, Cripto and B3 at Brasília midnight', () => {
    const c = configAntes()
    const day = (m: AccountMarket) => regrasResolvidas(c, regrasDaNovaConta(c, m, form({ definir: true }))).day
    expect(day('forex')).toEqual({ tz: NY, startMin: 1020 })
    expect(day('stocks')).toEqual({ tz: NY, startMin: 1200 })
    expect(day('crypto')).toEqual({ tz: SP, startMin: 0 })
    expect(day('b3')).toEqual({ tz: SP, startMin: 0 })
    const forex = regrasDaNovaConta(c, 'forex', form())
    expect(desdeDaNovaConta(c, forex, et('2026-10-19 16:59'))).toBe('19 out')
    expect(desdeDaNovaConta(c, forex, et('2026-10-19 17:00'))).toBe('20 out')
    const stocks = regrasDaNovaConta(c, 'stocks', form())
    expect(desdeDaNovaConta(c, stocks, et('2026-10-19 19:59'))).toBe('19 out')
    expect(desdeDaNovaConta(c, stocks, et('2026-10-19 20:00'))).toBe('20 out')
    // Crypto on a Saturday stays on Saturday
    expect(desdeDaNovaConta(c, regrasDaNovaConta(c, 'crypto', form()), brt('2026-10-24 23:59'))).toBe('24 out')
    // No block or state rule outside Futuros
    const rules = regrasResolvidas(c, regrasDaNovaConta(c, 'b3', form({ definir: true, limite: '500' })))
    expect(rules.block).toBeNull()
    expect(rules.states).toBeNull()
    expect(rules.limit).toEqual({ cents: 50000, mode: 'conta', atLimit: 'encerrar' })
  })
})

describe('«Moeda e virada do dia» (board `B.moedaDia`, `B.infoMoeda`)', () => {
  it('Forex and Ações: the turn on New York’s clock and, in Brasília, today’s time', () => {
    const seg = et('2026-10-19 12:00')
    expect(moedaEViradaDoDia('forex', seg)).toBe('US$ · o dia vira às 17:00 ET (18:00 em Brasília hoje)')
    expect(moedaEViradaDoDia('stocks', seg)).toBe('US$ · o dia vira às 20:00 ET (21:00 em Brasília hoje)')
    // The US clocks go back on Sun 1 Nov: one hour later in Brasília from that day on
    const segNov = et('2026-11-02 12:00')
    expect(moedaEViradaDoDia('forex', segNov)).toBe('US$ · o dia vira às 17:00 ET (19:00 em Brasília hoje)')
    expect(moedaEViradaDoDia('stocks', segNov)).toBe('US$ · o dia vira às 20:00 ET (22:00 em Brasília hoje)')
    expect(viradaEmBrasilia(MARKET_SPEC.forex.day, et('2026-10-31 23:30'))).toBe('18:00')
    expect(viradaEmBrasilia(MARKET_SPEC.forex.day, et('2026-11-01 00:30'))).toBe('19:00')
    // «Today» is the date on the day's clock: 22:30 in Brasília on 25 Oct is still the 25th in New York
    expect(viradaEmBrasilia(MARKET_SPEC.stocks.day, brt('2026-10-25 22:30'))).toBe('21:00')
  })

  it('Cripto and B3: Brasília midnight, with no second clock; B3 in reais', () => {
    const seg = et('2026-10-19 12:00')
    expect(moedaEViradaDoDia('crypto', seg)).toBe('US$ · o dia vira à meia-noite de Brasília')
    expect(moedaEViradaDoDia('b3', seg)).toBe('R$ · o dia vira à meia-noite de Brasília')
    expect(viradaEmBrasilia(MARKET_SPEC.b3.day, seg)).toBeNull()
  })

  it('the ⓘ: USDT only for crypto; the firm’s own reset only with a firm', () => {
    expect(PASSO_B.moedaDiaInfo('crypto', false)).toBe('USDT e USDC contam como dólar. A moeda e a virada do dia ficam fixas nesta conta.')
    expect(PASSO_B.moedaDiaInfo('forex', true)).toBe(
      'A moeda e a virada do dia ficam fixas nesta conta. O limite do dia é a sua regra: a mesa pode zerar o dela em outro horário.',
    )
    expect(PASSO_B.moedaDiaInfo('forex', false)).toBe('A moeda e a virada do dia ficam fixas nesta conta.')
    expect(PASSO_B.moedaDiaInfo('crypto', true)).toBe(
      'USDT e USDC contam como dólar. A moeda e a virada do dia ficam fixas nesta conta. O limite do dia é a sua regra: a mesa pode zerar o dela em outro horário.',
    )
    for (const m of ['forex', 'stocks', 'b3'] as const) expect(PASSO_B.moedaDiaInfo(m, true)).not.toContain('USDT')
  })

  it('«Tamanho» and the end screen in each market’s words', () => {
    expect(PASSO_B.size('US$')).toBe('Tamanho US$')
    expect(PASSO_B.size('R$')).toBe('Tamanho R$')
    expect(FIM_CONTA.semLeitorArquivo('forex', 'mt5')).toBe(
      'Ainda não lemos arquivos de Forex. O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.',
    )
    expect(FIM_CONTA.semLeitorArquivo('forex', 'mt4')).toBe(
      'Ainda não lemos arquivos de Forex. O relatório do MetaTrader 4 sai em HTML e vai precisar de um leitor próprio, que vem depois.',
    )
    expect(FIM_CONTA.semLeitorArquivo('crypto', 'binance')).toBe(
      'Ainda não lemos arquivos de Cripto. Depois vem a importação de CSV em que você diz o que é cada coluna.',
    )
    expect(FIM_CONTA.semLeitorArquivo('b3', null)).toBe('Ainda não lemos arquivos da B3. Depois vem a importação de CSV em que você diz o que é cada coluna.')
  })
})

describe('«Regras valem desde hoje, {d}»', () => {
  it('futures: the trading day turns at 18:00 ET', () => {
    const r = regrasDaNovaConta(configDepois(), 'futures', form())
    expect(desdeDaNovaConta(configDepois(), r, et('2026-10-19 17:59'))).toBe('19 out')
    expect(desdeDaNovaConta(configDepois(), r, et('2026-10-19 18:05'))).toBe('20 out')
    expect(regrasResolvidas(configDepois(), r).day).toEqual({ tz: NY, startMin: 1080 })
  })

  it('binaries inside an overnight window: the day the window opened', () => {
    const c = configDepois()
    const noite = regrasDaNovaConta(c, 'binary', form({ janela: 'propria', propria: w(SP, 1320, 120) }))
    expect(desdeDaNovaConta(c, noite, brt('2026-10-20 01:00'))).toBe('19 out')
    // The market's 20:00–21:00 window: 01:00 is already the 20th
    expect(desdeDaNovaConta(c, regrasDaNovaConta(c, 'binary', form()), brt('2026-10-20 01:00'))).toBe('20 out')
    // A new market window does the same
    const nova = regrasDaNovaConta(configAntes(), 'binary', form({ definir: true, propria: w(SP, 1320, 120) }))
    expect(desdeDaNovaConta(configAntes(), nova, brt('2026-10-20 01:00'))).toBe('19 out')
  })

  it('freezes the copied source’s rules with the form’s changes', () => {
    const r = regrasDaNovaConta(configDepois(), 'futures', form())
    expect(regrasResolvidas(configDepois(), r)).toEqual(topOneRules())
  })
})

describe('the market’s other accounts when the form gives it its first window', () => {
  it('names the active accounts that use the market’s window, with the day', () => {
    const c = configAntes()
    const r = regrasDaNovaConta(c, 'futures', form({ definir: true }))
    expect(outrasContasComVersao(c, r, et('2026-10-19 12:00'))).toBe(
      'Ao criar, esta janela passa a ser a de Futuros: Top One #1 também ganha versão nova das regras desde 19 out.',
    )
    const b = regrasDaNovaConta(c, 'binary', form({ definir: true }))
    expect(outrasContasComVersao(c, b, brt('2026-10-19 12:00'))).toBe(
      'Ao criar, esta janela passa a ser a de Binárias: Ebinex também ganha versão nova das regras desde 19 out.',
    )
  })

  it('nothing when the market already has a window, the form sets none, or the others have their own', () => {
    expect(outrasContasComVersao(configDepois(), regrasDaNovaConta(configDepois(), 'futures', form()), et('2026-10-19 12:00'))).toBeNull()
    const c = configAntes()
    expect(outrasContasComVersao(c, regrasDaNovaConta(c, 'futures', form()), et('2026-10-19 12:00'))).toBeNull()
    // Top One with its own window (rules_config's `current` resolves it so)
    const comPropria = comConta(c, ids.topOne, { window: w(NY, 570, 660) })
    const propria = { ...comPropria, accounts: comPropria.accounts.map((a) => ({ ...a, current: resolveRules(a, comPropria.settings) })) }
    expect(outrasContasComVersao(propria, regrasDaNovaConta(propria, 'futures', form({ definir: true })), et('2026-10-19 12:00'))).toBeNull()
    const arquivada = { ...c, accounts: c.accounts.map((a) => (a.id === ids.topOne ? { ...a, archivedAt: '2026-10-18T12:00:00Z' } : a)) }
    expect(outrasContasComVersao(arquivada, regrasDaNovaConta(arquivada, 'futures', form({ definir: true })), et('2026-10-19 12:00'))).toBeNull()
  })
})

describe('v1 again after rules_changed', () => {
  const input = {
    accountId: 'nova',
    market: 'futures' as const,
    settings: { windowRule: {}, block: {}, limit: null, window: null },
    marketWindows: [w(NY, 600, 660)],
  }

  it('keeps the form’s window as the market’s while the market still has none', () => {
    expect(novaContaNaConfig(configAntes(), input)).toBe(input)
  })

  it('the market got the same window meanwhile: the account just uses it', () => {
    const out = novaContaNaConfig(configDepois(), input)
    expect(out.marketWindows).toBeUndefined()
    expect(out.settings.window).toBeNull()
  })

  it('the market got another window meanwhile: the form’s becomes the account’s own', () => {
    const c = configDepois()
    c.settings.markets.futures.windows = [w(NY, 540, 600)]
    const out = novaContaNaConfig(c, input)
    expect(out.marketWindows).toBeUndefined()
    expect(out.settings.window).toEqual(w(NY, 600, 660))
  })

  it('the same times but other days, another clock, or a market with two windows: the form’s becomes the account’s own', () => {
    const c = configDepois()
    // seg–sáb in the form, seg–sex in the market: Saturday must not be lost
    const segSab = { ...input, marketWindows: [w(NY, 600, 660, 0b0111111)] }
    expect(novaContaNaConfig(c, segSab).settings.window).toEqual(w(NY, 600, 660, 0b0111111))
    // 10:00–11:00 on Brasília's clock is another window than 10:00–11:00 ET
    const br = { ...input, marketWindows: [w(SP, 600, 660)] }
    expect(novaContaNaConfig(c, br).settings.window).toEqual(w(SP, 600, 660))
    // The market got two windows, the first equal to the form's: the account keeps only its own
    const dois = configDepois()
    dois.settings.markets.futures.windows = [w(NY, 600, 660), w(NY, 840, 900)]
    expect(novaContaNaConfig(dois, input).settings.window).toEqual(w(NY, 600, 660))
    expect(mesmaJanela(w(NY, 600, 660), w(NY, 600, 660))).toBe(true)
  })

  it('an account that used the market’s window keeps doing so', () => {
    const usa = { ...input, marketWindows: undefined }
    expect(novaContaNaConfig(configDepois(), usa)).toBe(usa)
  })
})

describe('the rule parts of a Suas contas row', () => {
  const texto = (partes: ReturnType<typeof partesRegras>) => partes?.map((p) => p.map((t) => t.t).join('')).join(' · ')

  it('the owner’s accounts after the Phase 2 save', () => {
    const [top, ebx] = configDepois().accounts
    const partes = partesRegras(top, 3, 'só histórico importado')
    expect(texto(partes)).toBe('10:00–11:00 ET · regras desde 17 out · 3 op. desde então')
    expect(partes?.[0][0]).toEqual({ t: '10:00–11:00', mono: true })
    expect(texto(partesRegras(ebx, 0, ''))).toBe('20:00–21:00 de Brasília · regras desde 17 out · 0 op. desde então')
  })

  it('before any save: «sem janela», «sem regras salvas» and the Phase 1 activity', () => {
    const [top] = configAntes().accounts
    expect(texto(partesRegras(top, undefined, 'só histórico importado'))).toBe('sem janela · sem regras salvas · só histórico importado')
    expect(texto(partesRegras(top, undefined, ''))).toBe('sem janela · sem regras salvas')
  })

  it('an own window, two windows, and a later version', () => {
    const [top] = configDepois().accounts
    const v1 = top.versions[0]
    const own = {
      current: { ...top.current, windows: [w(NY, 600, 660), w(NY, 840, 900)], windowsFrom: 'account' as const },
      versions: [v1, { ...v1, id: 'v2', versionNo: 2, effectiveDay: '2026-10-22' }],
    }
    expect(texto(partesRegras(own, 12, ''))).toBe('10:00–11:00 e 14:00–15:00 ET (própria) · regras desde 17 out · v2 · 12 op. desde então')
  })

  it('with a version and no count yet: nothing (the row keeps its Phase 1 parts)', () => {
    expect(partesRegras(configDepois().accounts[0], undefined, 'só histórico importado')).toBeNull()
  })
})

describe('rows before the rules started (import preview, «Importação feita»)', () => {
  // v1 of both accounts: Sat 17 Oct 2026 20:06:02Z = 16:06 ET = 17:06 de Brasília
  const config = configDepois()
  const row = (local_entry: string, utc_offset: string | null = null): Pick<ImportRow, 'local_entry' | 'utc_offset'> => ({ local_entry, utc_offset })
  // An Ebinex file on the Brasília clock
  const antesBr = row('2026-10-17T17:00:00')
  const depoisBr = row('2026-10-17T17:10:00')
  // A Top One file in UTC, and the same instants on New York's clock
  const antesUtc = row('2026-10-17T20:00:00')
  const depoisUtc = row('2026-10-17T20:10:00')
  const antesNy = row('2026-10-17T16:00:00')
  const depoisNy = row('2026-10-17T16:10:00')

  it('counts each row by its entry instant on the file’s clock, or by its own offset', () => {
    const since = config.accounts[0].versions[0].effectiveFrom
    expect(contarAntesDasRegras([antesBr, depoisBr, depoisBr], SP, since)).toEqual({ antes: 1, depois: 2 })
    expect(contarAntesDasRegras([antesUtc, depoisUtc], 'UTC', since)).toEqual({ antes: 1, depois: 1 })
    expect(contarAntesDasRegras([antesNy, depoisNy], NY, since)).toEqual({ antes: 1, depois: 1 })
    // The old Ebinex format names the instant itself: 20:10 at −03:00 is after; 20:00 at +00:00 is before
    expect(contarAntesDasRegras([row('2026-10-17T17:10:00', '-03:00'), row('2026-10-17T20:00:00', '+00:00')], 'UTC', since)).toEqual({ antes: 1, depois: 1 })
    // Read on the wrong clock, the same wall time is another instant
    expect(contarAntesDasRegras([antesBr], 'UTC', since)).toEqual({ antes: 1, depois: 0 })
    expect(contarAntesDasRegras([row('2026-10-17T19:00:00')], SP, since)).toEqual({ antes: 0, depois: 1 })
  })

  it('a row exactly at «desde» is judged by the rules (at or after counts as after)', () => {
    const since = new Date('2026-10-17T20:06:02Z')
    expect(contarAntesDasRegras([row('2026-10-17T17:06:02'), row('2026-10-17T17:06:01')], SP, since)).toEqual({ antes: 1, depois: 1 })
  })

  it('every row before: «Antes de 17 out (início das regras): {novas} vão …»', () => {
    expect(linhaAntesDasRegras(config, ids.ebinex, [antesBr, antesBr, antesBr], SP, 3)).toBe(
      'Antes de 17 out (início das regras): 3 vão para Histórico importado · só resultado.',
    )
    expect(linhaAntesDasRegras(config, ids.topOne, [antesUtc, antesUtc], 'UTC', 1)).toBe(
      'Antes de 17 out (início das regras): 1 vai para Histórico importado · só resultado.',
    )
  })

  it('rows on both sides: «até {min(antes, novas)}»', () => {
    expect(linhaAntesDasRegras(config, ids.ebinex, [antesBr, antesBr, depoisBr], SP, 3)).toBe(
      'Antes de 17 out (início das regras): até 2 vão para Histórico importado · só resultado.',
    )
    expect(linhaAntesDasRegras(config, ids.topOne, [antesNy, antesNy, depoisNy], NY, 1)).toBe(
      'Antes de 17 out (início das regras): até 1 vai para Histórico importado · só resultado.',
    )
  })

  it('no line when every row is after, nothing is new, or the account has no version', () => {
    expect(linhaAntesDasRegras(config, ids.ebinex, [depoisBr, depoisBr], SP, 2)).toBeNull()
    expect(linhaAntesDasRegras(config, ids.ebinex, [antesBr], SP, 0)).toBeNull()
    expect(linhaAntesDasRegras(configAntes(), ids.ebinex, [antesBr], SP, 1)).toBeNull()
    expect(linhaAntesDasRegras(undefined, ids.ebinex, [antesBr], SP, 1)).toBeNull()
    expect(linhaAntesDasRegras(config, 'outra-conta', [antesBr], SP, 1)).toBeNull()
  })

  it('«Importação feita»: Phase 1’s line unless some rows are judged by the rules', () => {
    expect(linhaImportadas(configAntes(), ids.ebinex, [depoisBr], SP, 1)).toBeNull()
    expect(linhaImportadas(config, ids.ebinex, [antesBr, antesBr], SP, 2)).toBeNull()
    expect(linhaImportadas(config, ids.ebinex, [antesBr, depoisBr], SP, 2)).toBe(
      '2 operações importadas. As de antes de 17 out ficam em Histórico importado · só resultado, à parte do Diário.',
    )
    expect(linhaImportadas(config, ids.topOne, [depoisUtc], 'UTC', 1)).toBe('1 operação importada.')
  })
})

/**
 * @jest-environment node
 */
import { MON_TO_FRI } from '@/lib/domain/tempo'
import { configAntes, configDepois, idsDono, saveDono } from '@/testing/regras'
import { activeAccounts, emptyAccountSettings, type AccountConfig, type RulesConfig, type RulesSettings } from '@/lib/hub/regras'
import {
  PADRAO_FUTUROS,
  ajustarSoNestaConta,
  aposSalvar,
  alternarDia,
  cancelarJanela,
  comAoChegar,
  comBloqueio,
  comCalendario,
  comEscolhaEstado,
  comHorarios,
  comJanelaDoMercado,
  comLimite,
  comModoLimite,
  comRegraJanela,
  comTextoEstado,
  definirJanela,
  iniciarRascunho,
  janelasDoMercadoMudaram,
  janelasEfetivas,
  mudancasDaEntidade,
  problemasDoRascunho,
  rascunhoSujo,
  receberConfig,
  removerSegunda,
  restaurarMinutos,
  segundaJanela,
  semOcultos,
  statusSalvar,
  temProprio,
  textoSalvo,
  voltarAoPadrao,
  type Entidade,
  type Rascunho,
} from '@/lib/hub/rascunho'

const ids = idsDono()
const conta = (c: RulesConfig, id: string) => c.accounts.find((a) => a.id === id) as AccountConfig
const comDraft = (r: Rascunho, fn: (d: RulesSettings) => RulesSettings): Rascunho => ({ ...r, draft: fn(r.draft) })
const top = (c: RulesConfig): Entidade => ({ tipo: 'conta', conta: conta(c, ids.topOne) })
const bin = (c: RulesConfig): Entidade => ({ tipo: 'conta', conta: conta(c, ids.ebinex) })

/** The same config with one account archived */
function arquivada(c: RulesConfig, id: string): RulesConfig {
  return { ...c, accounts: c.accounts.map((a) => (a.id === id ? { ...a, archivedAt: '2026-10-18T12:00:00Z' } : a)) }
}

describe('dirty, issues', () => {
  it('starts clean; an edit makes it dirty and editing it back makes it clean again', () => {
    const r = iniciarRascunho(configDepois())
    expect(rascunhoSujo(r)).toBe(false)
    const edited = comDraft(r, (d) => comJanelaDoMercado(d, 'futures', 0, { startMin: 570 }))
    expect(rascunhoSujo(edited)).toBe(true)
    expect(rascunhoSujo(comDraft(edited, (d) => comJanelaDoMercado(d, 'futures', 0, { startMin: 600 })))).toBe(false)
  })

  it('counts «Horários na tela», the calendars and a v1 asked for as changes', () => {
    const r = iniciarRascunho(configDepois())
    expect(rascunhoSujo(comDraft(r, (d) => comHorarios(d, 'both')))).toBe(true)
    expect(rascunhoSujo(comDraft(r, (d) => comCalendario(d, 'eu', true)))).toBe(true)
    expect(rascunhoSujo({ ...r, force: [ids.topOne] })).toBe(true)
  })

  it('ignores edits of an account that is not active', () => {
    const c = arquivada(configDepois(), ids.ebinex)
    const r = comDraft(iniciarRascunho(c), (d) => comLimite(d, ids.ebinex, 5000))
    expect(rascunhoSujo(r)).toBe(false)
  })

  it('lists the window errors that block the save', () => {
    const r = iniciarRascunho(configDepois())
    expect(problemasDoRascunho(comDraft(r, (d) => comJanelaDoMercado(d, 'binary', 0, { endMin: 1200 })))).toEqual([
      { place: { market: 'binary', index: 0 }, error: 'same_start_end' },
    ])
    expect(problemasDoRascunho(comDraft(r, (d) => comJanelaDoMercado(d, 'futures', 0, { weekdays: 0 })))).toEqual([
      { place: { market: 'futures', index: 0 }, error: 'no_days' },
    ])
  })
})

describe('a new rules_config while the page is open (contrato §4.2)', () => {
  it('the same rev (an import, an archive): the draft is carried over part by part', () => {
    const c = configDepois()
    const r = comDraft(iniciarRascunho(c), (d) => comLimite(d, ids.topOne, 50000))
    const again = configDepois()
    const out = receberConfig(r, again, true)
    expect(out.base).toBe(again)
    expect(out.draft.accounts[ids.topOne].limit?.cents).toBe(50000)
    expect(rascunhoSujo(out)).toBe(true)
  })

  it('another tab saved: a dirty draft keeps its old base; a clean one adopts the new answer', () => {
    const c = configDepois()
    const outra = { ...configDepois(), rev: 'rev-de-outra-aba' }
    const sujo = comDraft(iniciarRascunho(c), (d) => comLimite(d, ids.topOne, 50000))
    expect(receberConfig(sujo, outra, false)).toBe(sujo)
    const limpo = iniciarRascunho(c)
    expect(receberConfig(limpo, outra, false).base).toBe(outra)
  })

  it('reverts the entries of an account that was archived, and a market left without an active account', () => {
    const c = configDepois()
    const r = comDraft(iniciarRascunho(c), (d) =>
      comLimite(comJanelaDoMercado(comRegraJanela(d, { tipo: 'padrao' }, { on: false }), 'futures', 0, { startMin: 540 }), ids.topOne, 1000),
    )
    const out = receberConfig(r, arquivada(configDepois(), ids.topOne), true)
    expect(out.draft.accounts[ids.topOne]).toEqual(c.settings.accounts[ids.topOne])
    expect(out.draft.markets.futures).toEqual(c.settings.markets.futures)
    expect(rascunhoSujo(out)).toBe(false)
  })

  it('drops from «force» the accounts that now have versions', () => {
    const r: Rascunho = { ...iniciarRascunho(configAntes()), force: [ids.topOne, ids.ebinex] }
    const depois = configDepois()
    const semVersaoEbinex = { ...depois, accounts: depois.accounts.map((a) => (a.id === ids.ebinex ? { ...a, versions: [] } : a)) }
    expect(receberConfig(r, semVersaoEbinex, true).force).toEqual([ids.ebinex])
  })

  it('after this tab’s save: the sent draft is the old side of the rebase, so a part set back while it ran stays set back', () => {
    const c = configDepois()
    const enviado = comHorarios(c.settings, 'br')
    const r: Rascunho = { base: c, draft: enviado, force: [] }
    // While the save ran, «Horários na tela» went back to what was saved before it
    const durante = comDraft(r, (d) => comHorarios(d, c.settings.displayTz))
    const salvo = aposSalvar(durante, { baseRev: c.rev, draft: enviado, force: [] }, 'rev-2')
    expect(salvo.salvo).toEqual({ rev: 'rev-2', draft: enviado })
    expect(rascunhoSujo(salvo)).toBe(true)

    const novo = { ...configDepois(), rev: 'rev-2', settings: enviado }
    const out = receberConfig(salvo, novo, true)
    expect(out.base).toBe(novo)
    expect(out.salvo).toBeUndefined()
    expect(out.draft.displayTz).toBe(c.settings.displayTz)
    expect(rascunhoSujo(out)).toBe(true)
    // Untouched since the save: clean on the new rules
    const limpo = receberConfig(aposSalvar(r, { baseRev: c.rev, draft: enviado, force: [] }, 'rev-2'), novo, true)
    expect(limpo.draft).toEqual(enviado)
    expect(rascunhoSujo(limpo)).toBe(false)
  })

  it('after this tab’s save: only the v1s it sent leave «force»; one asked for while it ran stays', () => {
    const c = configAntes()
    const r: Rascunho = { ...iniciarRascunho(c), force: [ids.topOne, ids.ebinex] }
    const out = aposSalvar(r, { baseRev: c.rev, draft: c.settings, force: [ids.topOne] }, 'rev-2')
    expect(out.force).toEqual([ids.ebinex])
  })

  it('after this tab’s save: an answer still on the old revision is not the save’s, and the page keeps waiting', () => {
    const c = configDepois()
    const enviado = comLimite(c.settings, ids.topOne, 50000)
    const salvo = aposSalvar({ base: c, draft: enviado, force: [] }, { baseRev: c.rev, draft: enviado, force: [] }, 'rev-2')
    expect(receberConfig(salvo, { ...configDepois() }, true)).toBe(salvo)
    // A save that did not move the revision waits for nothing
    expect(aposSalvar({ base: c, draft: enviado, force: [] }, { baseRev: c.rev, draft: enviado, force: [] }, c.rev).salvo).toBeUndefined()
  })

  it('after this tab’s save, another tab saved too: untouched, the draft adopts the newest rules; edited since, it keeps its old base and waits for nothing', () => {
    const c = configDepois()
    const enviado = comLimite(c.settings, ids.topOne, 50000)
    const salvo = aposSalvar({ base: c, draft: enviado, force: [] }, { baseRev: c.rev, draft: enviado, force: [] }, 'rev-2')
    const outra = { ...configDepois(), rev: 'rev-3', settings: comHorarios(enviado, 'both') }

    const adotado = receberConfig(salvo, outra, false)
    expect(adotado.base).toBe(outra)
    expect(adotado.salvo).toBeUndefined()
    expect(rascunhoSujo(adotado)).toBe(false)

    const editado = comDraft(salvo, (d) => comCalendario(d, 'eu', true))
    const mantido = receberConfig(editado, outra, false)
    expect(mantido.base).toBe(c)
    expect(mantido.salvo).toBeUndefined()
    expect(mantido.draft).toBe(editado.draft)
  })

  it('semOcultos leaves active accounts alone', () => {
    const c = configDepois()
    const d = comLimite(c.settings, ids.topOne, 1000)
    expect(semOcultos(c, d)).toEqual(d)
  })
})

describe('edits of «Quando você opera»', () => {
  const salvo = configDepois()

  it('«+ Definir janela» and «Cancelar esta janela» (which also drops the market’s own account windows)', () => {
    const s = configAntes().settings
    const d = definirJanela(s, 'futures')
    expect(d.markets.futures.windows).toEqual([{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }])
    const withOwn = ajustarSoNestaConta(d, { id: ids.topOne, market: 'futures' })
    expect(withOwn.accounts[ids.topOne].window).toEqual(d.markets.futures.windows[0])
    const cancelled = cancelarJanela(withOwn, 'futures', [ids.topOne])
    expect(cancelled.markets.futures.windows).toEqual([])
    expect(cancelled.accounts[ids.topOne].window).toBeNull()
  })

  it('«+ Segunda janela» takes the first window’s days; at most two', () => {
    const s = alternarDia(salvo.settings, 'futures', 0, 5)
    const two = segundaJanela(s, 'futures')
    expect(two.markets.futures.windows[1]).toEqual({ tz: 'America/New_York', startMin: 840, endMin: 900, weekdays: MON_TO_FRI | (1 << 5) })
    expect(segundaJanela(two, 'futures')).toBe(two)
    expect(removerSegunda(two, 'futures').markets.futures.windows).toHaveLength(1)
    expect(segundaJanela(salvo.settings, 'binary').markets.binary.windows[1]).toMatchObject({ startMin: 540, endMin: 600, tz: 'America/Sao_Paulo' })
  })

  it('«Ajustar só nesta conta» copies the first window (seg–sex when it has no day); «Voltar ao padrão» removes it', () => {
    const noDays = comJanelaDoMercado(salvo.settings, 'futures', 0, { weekdays: 0 })
    const own = ajustarSoNestaConta(noDays, { id: ids.topOne, market: 'futures' })
    expect(own.accounts[ids.topOne].window).toEqual({ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI })
    expect(voltarAoPadrao(own, ids.topOne).accounts[ids.topOne].window).toBeNull()
    expect(janelasEfetivas(own, top(salvo))).toEqual({ windows: [own.accounts[ids.topOne].window], propria: true })
    // The market's own days are copied (seg–sáb here), not seg–sex
    const segSab = ajustarSoNestaConta(comJanelaDoMercado(salvo.settings, 'futures', 0, { weekdays: 0b0111111 }), { id: ids.topOne, market: 'futures' })
    expect(segSab.accounts[ids.topOne].window?.weekdays).toBe(0b0111111)
  })

  it('«não salvo» on a market card: its windows or an own window of one of its accounts', () => {
    const s = salvo.settings
    expect(janelasDoMercadoMudaram(s, s, 'futures', [ids.topOne])).toBe(false)
    expect(janelasDoMercadoMudaram(s, alternarDia(s, 'futures', 0, 6), 'futures', [ids.topOne])).toBe(true)
    expect(janelasDoMercadoMudaram(s, ajustarSoNestaConta(s, { id: ids.topOne, market: 'futures' }), 'futures', [ids.topOne])).toBe(true)
    expect(janelasDoMercadoMudaram(s, alternarDia(s, 'futures', 0, 6), 'binary', [ids.ebinex])).toBe(false)
  })
})

describe('edits of «Suas regras»', () => {
  const c = configDepois()

  it('an account rule equal to the default is not stored (back to «padrão de Futuros»)', () => {
    const off = comRegraJanela(c.settings, top(c), { on: false })
    expect(off.accounts[ids.topOne].windowRule).toEqual({ on: false })
    expect(temProprio(off, ids.topOne, 'windowRule')).toBe(true)
    const back = comRegraJanela(off, top(c), { on: true })
    expect(back.accounts[ids.topOne].windowRule).toEqual({})
    expect(temProprio(back, ids.topOne, 'windowRule')).toBe(false)
  })

  it('binary accounts go through the same rule (their default is the binary market’s)', () => {
    const aviso = comRegraJanela(c.settings, bin(c), { outside: 'aviso' })
    expect(aviso.accounts[ids.ebinex].windowRule).toEqual({ outside: 'aviso' })
    expect(aviso.markets.binary).toEqual(c.settings.markets.binary)
  })

  it('«Padrão Futuros» edits the futures default', () => {
    const s = comRegraJanela(c.settings, { tipo: 'padrao' }, { outside: 'aviso' })
    expect(s.markets.futures.windowRule).toEqual({ on: true, outside: 'aviso' })
  })

  it('block minutes are clamped, and an emptied field goes back to the saved value', () => {
    const s = comBloqueio(c.settings, { tipo: 'padrao' }, { beforeMin: 99, afterMin: -3 })
    expect(s.markets.futures.block).toEqual({ on: true, beforeMin: 60, afterMin: 0 })
    expect(restaurarMinutos(s, c.settings, { tipo: 'padrao' }, 'beforeMin').markets.futures.block).toEqual({ on: true, beforeMin: 5, afterMin: 0 })
    const own = comBloqueio(c.settings, top(c), { afterMin: 30 })
    expect(own.accounts[ids.topOne].block).toEqual({ afterMin: 30 })
    expect(restaurarMinutos(own, c.settings, top(c), 'afterMin').accounts[ids.topOne].block).toEqual({})
    // The saved value, not the built-in one (saved 20 before the field was emptied)
    const saved20 = comBloqueio(c.settings, { tipo: 'padrao' }, { beforeMin: 20 })
    const emptied = comBloqueio(saved20, { tipo: 'padrao' }, { beforeMin: 0 })
    expect(restaurarMinutos(emptied, saved20, { tipo: 'padrao' }, 'beforeMin').markets.futures.block?.beforeMin).toBe(20)
    const ownSaved = comBloqueio(c.settings, top(c), { beforeMin: 15 })
    expect(restaurarMinutos(comBloqueio(ownSaved, top(c), { beforeMin: 0 }), ownSaved, top(c), 'beforeMin').accounts[ids.topOne].block).toEqual({ beforeMin: 15 })
  })

  it('the limit keeps its mode and «Ao chegar» when the amount changes; null = «Sem limite»', () => {
    const soma = comModoLimite(c.settings, ids.topOne, 'soma')
    const s = comLimite(soma, ids.topOne, 45050)
    expect(s.accounts[ids.topOne].limit).toEqual({ cents: 45050, mode: 'soma', atLimit: 'encerrar' })
    expect(comLimite(s, ids.topOne, null).accounts[ids.topOne].limit).toBeNull()
    expect(comLimite(c.settings, ids.ebinex, 5000).accounts[ids.ebinex].limit).toEqual({ cents: 5000, mode: 'conta', atLimit: 'encerrar' })
    // «Só avisar» stays when the amount changes
    const avisar = comAoChegar(c.settings, ids.topOne, 'avisar')
    expect(comLimite(avisar, ids.topOne, 30000).accounts[ids.topOne].limit).toEqual({ cents: 30000, mode: 'conta', atLimit: 'avisar' })
  })

  it('a state choice toggles; texts are cut at 500; empty states are dropped', () => {
    const s = comEscolhaEstado(c.settings, 'alinhadas', 'so_a_favor')
    expect(s.markets.futures.states.alinhadas).toEqual({ choice: 'so_a_favor', text: '' })
    expect(comEscolhaEstado(s, 'alinhadas', 'so_a_favor').markets.futures.states).toEqual({})
    expect(comTextoEstado(c.settings, 'em_conflito', 'x'.repeat(600)).markets.futures.states.em_conflito?.text).toHaveLength(500)
  })

  it('calendars stay in the order us, eu, br', () => {
    const s = comCalendario(comCalendario(c.settings, 'br', true), 'eu', true)
    expect(s.calendars).toEqual(['us', 'eu', 'br'])
    expect(comCalendario(s, 'us', false).calendars).toEqual(['eu', 'br'])
  })

  it('«não salvo» per row, whatever entity is selected; toggling back clears it', () => {
    const none = { janela: false, regraJanela: false, bloqueio: false, limite: false, estados: false }
    expect(mudancasDaEntidade(c.settings, c.settings, top(c))).toEqual(none)
    expect(mudancasDaEntidade(c.settings, comLimite(c.settings, ids.topOne, 1), top(c))).toEqual({ ...none, limite: true })
    expect(mudancasDaEntidade(c.settings, comRegraJanela(c.settings, bin(c), { on: false }), bin(c))).toEqual({ ...none, regraJanela: true })
    expect(mudancasDaEntidade(c.settings, comBloqueio(c.settings, { tipo: 'padrao' }, { on: false }), { tipo: 'padrao' })).toEqual({ ...none, bloqueio: true })
    expect(mudancasDaEntidade(c.settings, comTextoEstado(c.settings, 'alinhadas', 'só com tendência'), top(c))).toEqual({ ...none, estados: true })
    expect(mudancasDaEntidade(c.settings, alternarDia(c.settings, 'futures', 0, 6), top(c))).toEqual({ ...none, janela: true })
    const back = comRegraJanela(comRegraJanela(c.settings, bin(c), { on: false }), bin(c), { on: true })
    expect(mudancasDaEntidade(c.settings, back, bin(c))).toEqual(none)
  })
})

describe('the save status (contrato §4.3)', () => {
  const base = { salvando: false, aguardando: false, sujo: false, temProblema: false, mensagem: null }

  it('has a text for every state', () => {
    expect(statusSalvar(base)).toEqual({ texto: 'Tudo salvo', tom: 'ok' })
    expect(statusSalvar({ ...base, sujo: true })).toEqual({ texto: 'Alterações não salvas', tom: 'mudou' })
    expect(statusSalvar({ ...base, sujo: true, temProblema: true })).toEqual({ texto: 'Corrija a janela marcada para salvar.', tom: 'mudou' })
    expect(statusSalvar({ ...base, sujo: true, salvando: true })).toEqual({ texto: 'Salvando…', tom: 'ok' })
    expect(statusSalvar({ ...base, mensagem: { tipo: 'salvo', texto: 'Salvo.' } })).toEqual({ texto: 'Salvo.', tom: 'ok' })
    expect(statusSalvar({ ...base, mensagem: { tipo: 'descartado' } })).toEqual({ texto: 'Alterações descartadas.', tom: 'ok' })
    expect(statusSalvar({ ...base, sujo: true, mensagem: { tipo: 'erro', code: 'rules_changed' } })).toEqual({
      texto: 'As regras foram salvas em outra aba. Recarregue para ver a versão salva.',
      tom: 'mudou',
    })
    expect(statusSalvar({ ...base, sujo: true, mensagem: { tipo: 'erro', code: 'bad_window' } }).texto).toBe('Não foi possível salvar. Nada foi alterado.')
    // A save whose rules have not come back yet keeps its «Salvo…»
    expect(statusSalvar({ ...base, sujo: true, aguardando: true, mensagem: { tipo: 'salvo', texto: 'Salvo.' } }).texto).toBe('Salvo.')
  })

  it('«Salvo.» names the new versions of active accounts, on one day or on several', () => {
    const c = configAntes()
    expect(textoSalvo(saveDono(), c)).toBe('Salvo. Regras novas desde 17 out: Top One #1 v1 e Ebinex v1.')
    expect(textoSalvo({ versions: [] }, c)).toBe('Salvo.')
    const r = saveDono()
    const versions = r.versions.map((v) => (v.accountId === ids.topOne ? { ...v, versionNo: 2, effectiveDay: '2026-10-18' } : { ...v, versionNo: 2 }))
    expect(textoSalvo({ versions }, c)).toBe('Salvo. Regras novas: Top One #1 v2 desde 18 out e Ebinex v2 desde 17 out.')
    // An archived account is versioned too, silently
    expect(textoSalvo(r, arquivada(c, ids.ebinex))).toBe('Salvo. Regras novas desde 17 out: Top One #1 v1.')
  })
})

it('PADRAO_FUTUROS is not an account id of the fixtures', () => {
  expect(activeAccounts(configDepois()).map((a) => a.id)).not.toContain(PADRAO_FUTUROS)
  expect(emptyAccountSettings()).toEqual({ windowRule: {}, block: {}, limit: null, window: null })
})

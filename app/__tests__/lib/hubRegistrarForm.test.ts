/**
 * lib/hub/registrarForm (PR 3-3, lane A): the Registrar sheet's pure logic, on the answers recorded
 * from the real SQL (testing/registrarTelas; invented data) and on hand-made states at fixed
 * instants (never the device clock).
 */
import { parseRulesNow, type AccountNow } from '@/lib/hub/regras'
import { padroesDoRegistrar } from '@/lib/hub/registrar'
import {
  avisoLimiteEntrada,
  cartaoFechada,
  contaReg,
  desdeTexto,
  faixaJanelas,
  lerRascunho,
  linhaDepois,
  linhaGate,
  linhaLimite,
  marcasDivididas,
  modeloEntrada,
  modeloResultado,
  modeloSaida,
  opTexto,
  periodo,
  quebrasDoGate,
  rascunhoInicial,
  rascunhoMexido,
  resumoAberta,
  textoAviso,
  textoQuebras,
  type ContaReg,
  type Rascunho,
} from '@/lib/hub/registrarForm'
import type { MarkEvent } from '@/lib/domain/registro'
import { agoraTelas, contasTelas, entradaTelas, estadoTelas, idsTelas, recentesTelas, saidaTelas, telasJson } from '@/testing/registrarTelas'

const ids = idsTelas()
const KEY = '0f8c2a6e-1b2c-4d3e-8f90-123456789abc'
const contas = contasTelas()

function contaDe(agora: AccountNow): ContaReg {
  const a = contas.find((c) => c.id === agora.accountId)!
  return contaReg(a, agora.rules, agora.desdeDay)
}
const at = (iso: string) => new Date(iso)

const qui1031 = agoraTelas('agora-qui-1031-et')
const top1031 = qui1031.accounts.find((a) => a.accountId === ids.accounts.topOne)!
const top = contaDe(top1031)
const ebx2024 = agoraTelas('agora-qui-2024-brt').accounts.find((a) => a.accountId === ids.accounts.ebinex)!
const ebx = contaDe(ebx2024)

function rascunhoTop(patch: Partial<Rascunho> = {}): Rascunho {
  return { ...rascunhoInicial(top, padroesDoRegistrar('futures', recentesTelas('recentes-top-one')), KEY), ...patch }
}
function rascunhoEbx(patch: Partial<Rascunho> = {}): Rascunho {
  return { ...rascunhoInicial(ebx, padroesDoRegistrar('binary', recentesTelas('recentes-ebinex')), KEY), ...patch }
}

describe('the account', () => {
  it('reads its clocks, «desde», currency and limit from rules_now', () => {
    expect(top).toMatchObject({ market: 'futures', clock: 'America/New_York', desdeDay: '2026-10-14', currency: 'USD', temLimite: true })
    expect(ebx).toMatchObject({ market: 'binary', clock: 'America/Sao_Paulo', platform: 'ebinex', temLimite: false })
    expect(faixaJanelas(top.windows)).toBe('10:00–11:00 ET')
    expect(faixaJanelas(ebx.windows)).toBe('20:00–21:00 de Brasília')
  })
})

describe('the draft', () => {
  it('starts from the account’s history (D5, D6)', () => {
    expect(rascunhoTop()).toMatchObject({ modo: 'aberta', ativo: 'MGC', qtd: '1', qtdOutro: false, lado: null, preco: '', hora: null })
    expect(rascunhoEbx()).toMatchObject({ par: 'EUR/USD', parOutro: false, payout: '87', stake: '20', duracao: null })
    // No history: «Outro par» is the way in
    expect(rascunhoInicial(ebx, padroesDoRegistrar('binary', []), KEY)).toMatchObject({ par: null, parOutro: true, payout: '', stake: '' })
    // A quantity outside the chips opens «Outro» with it
    expect(rascunhoInicial(top, { symbol: 'MES', quantity: '5', pairs: [], payoutBySymbol: {}, stake: null }, KEY)).toMatchObject({ qtd: '5', qtdOutro: true })
  })

  it('knows when something was typed (not the client_key, not a disclosure)', () => {
    const r = rascunhoTop()
    expect(rascunhoMexido({ ...r, clientKey: '1f8c2a6e-1b2c-4d3e-8f90-123456789abc', maisAberto: true }, r)).toBe(false)
    expect(rascunhoMexido({ ...r, lado: 'long' }, r)).toBe(true)
  })

  it('reads back only a stored draft of this account with the right shape', () => {
    const r = rascunhoTop({ lado: 'short', preco: '4421,3', marcas: { setup: 'B' } })
    expect(lerRascunho(JSON.parse(JSON.stringify(r)), ids.accounts.topOne)).toEqual(r)
    expect(lerRascunho(JSON.parse(JSON.stringify(r)), ids.accounts.ebinex)).toBeNull()
    expect(lerRascunho({ ...r, clientKey: 'x' }, ids.accounts.topOne)).toBeNull()
    expect(lerRascunho({ ...r, duracao: 120 }, ids.accounts.topOne)).toBeNull()
    expect(lerRascunho({ ...r, marcas: { setup: 'Z', emocao: 'calmo' } }, ids.accounts.topOne)?.marcas).toEqual({ emocao: 'calmo' })
    expect(lerRascunho('nada', ids.accounts.topOne)).toBeNull()
  })
})

describe('step 1', () => {
  const now = at('2026-10-22T14:31:05Z')
  const hoje = '2026-10-22'

  it('builds the entry payload only when the form is complete, with the hour left out on the current minute', () => {
    const incompleto = modeloEntrada({ conta: top, r: rascunhoTop(), now, hoje, tentou: false })
    expect(incompleto.payload).toBeNull()
    expect(incompleto.visiveis).toEqual({})
    expect(incompleto.primeiro).toBe('lado')
    const m = modeloEntrada({ conta: top, r: rascunhoTop({ lado: 'short', preco: '4.421,30', stop: '16' }), now, hoje, tentou: true })
    expect(m.payload).toEqual({ v: 1, client_key: KEY, symbol: 'MGC', direction: 'short', quantity: '1', entry_price: '4421.3', stop_pts: '16', clock: 'America/New_York' })
    expect(m.linhaRisco).toBe('risco US$ 160,00')
    const digitada = modeloEntrada({ conta: top, r: rascunhoTop({ lado: 'short', preco: '4421,3', hora: '10:20' }), now, hoje, tentou: true })
    expect(digitada.payload?.entry).toBe('10:20')
    expect(digitada.noMinutoAtual).toBe(false)
    expect(digitada.entradaEm?.toISOString()).toBe('2026-10-22T14:20:00.000Z')
  })

  it('says the board’s errors, in its order', () => {
    const m = modeloEntrada({ conta: top, r: rascunhoTop({ qtdOutro: true, qtd: '', preco: 'abc', hora: '10:40', stop: '0', alvo: '1,05' }), now, hoje, tentou: true })
    expect(m.visiveis).toEqual({
      lado: 'Escolha Compra ou Venda.',
      q: 'Informe a quantidade.',
      preco: 'Use só números, como 7.896,25.',
      hora: 'A entrada não pode ser depois de agora (10:31 ET).',
      stop: 'Use pontos maiores que zero.',
      alvo: 'Use pontos de 0,10 em 0,10 no MGC.',
    })
    expect(Object.keys(m.visiveis)).toEqual(['lado', 'q', 'preco', 'hora', 'stop', 'alvo'])
    // Before a tap only the stop, the target and the day are said
    const antes = modeloEntrada({ conta: top, r: rascunhoTop({ stop: '0' }), now, hoje, tentou: false })
    expect(antes.visiveis).toEqual({ stop: 'Use pontos maiores que zero.' })
  })

  it('«Já fechada»: the day, the instants and register_after’s payload', () => {
    const r = rascunhoTop({ modo: 'fechada', dia: '2026-10-21', ativo: 'MES', lado: 'short', qtd: '2', preco: '7938,50', hora: '10:33', precoSaida: '7929', horaSaida: '10:49' })
    const m = modeloEntrada({ conta: top, r, now, hoje, tentou: false })
    expect(m.linhaResultado).toBe('Resultado: +9,50 pts · +US$ 95,00')
    expect(m.entradaEm?.toISOString()).toBe('2026-10-21T14:33:00.000Z')
    expect(m.payloadFechada).toEqual({
      v: 1,
      client_key: KEY,
      symbol: 'MES',
      direction: 'short',
      quantity: '2',
      entry_price: '7938.5',
      clock: 'America/New_York',
      day: '2026-10-21',
      entry: '10:33',
      exit: '10:49',
      exit_price: '7929',
    })
    expect(m.jaFoi).toBe(true)
    const futuro = modeloEntrada({ conta: top, r: { ...r, dia: '2026-10-23' }, now, hoje, tentou: false })
    expect(futuro.visiveis.dia).toBe('O dia não pode ser depois de hoje.')
    expect(futuro.diaRecusado).toBe(true)
    const antes = modeloEntrada({ conta: top, r: { ...r, dia: '2026-10-13' }, now, hoje, tentou: false })
    expect(antes.visiveis.dia).toBe('Antes de 14 out esta conta não tinha regras: essas operações entram pelo arquivo da corretora.')
  })

  it('Ebinex: «Vence às» on the next candle of 1, 5 and 15 min (v55)', () => {
    const now2010 = at('2026-10-22T23:10:20Z')
    const vence = (duracao: number, hora: string | null = null) =>
      modeloEntrada({ conta: ebx, r: rascunhoEbx({ duracao, hora }), now: now2010, hoje, tentou: false }).venceTxt
    expect(vence(60)).toBe('Vence às 20:12 de Brasília.')
    expect(vence(300)).toBe('Vence às 20:20 de Brasília.')
    expect(vence(900)).toBe('Vence às 20:30 de Brasília.')
    expect(vence(300, '20:13')).toBe('Vence às 20:20 de Brasília.')
    // The owner's examples at 20:24: M5 at 20:13 → 20:20 (over), M15 → 20:30
    const now2024 = at('2026-10-22T23:24:04Z')
    expect(modeloEntrada({ conta: ebx, r: rascunhoEbx({ duracao: 300, hora: '20:13' }), now: now2024, hoje, tentou: false }).venceTxt).toBe('Venceu às 20:20 de Brasília.')
    expect(modeloEntrada({ conta: ebx, r: rascunhoEbx({ duracao: 900, hora: '20:13' }), now: now2024, hoje, tentou: false }).venceTxt).toBe('Vence às 20:30 de Brasília.')
  })

  it('Ebinex payloads: the entry and «Já fechada»', () => {
    const now2010 = at('2026-10-22T23:10:20Z')
    const m = modeloEntrada({ conta: ebx, r: rascunhoEbx({ direcao: 'put', duracao: 60, payout: '88' }), now: now2010, hoje, tentou: false })
    expect(m.payload).toEqual({ v: 1, client_key: KEY, symbol: 'EUR/USD', direction: 'put', stake: '20', payout: '88', duration_s: 60, clock: 'America/Sao_Paulo' })
    expect(m.linhaBinaria).toBe('Se acertar: +US$ 17,60 · se errar: −US$ 20,00')
    const now2024 = at('2026-10-22T23:24:04Z')
    const f = modeloEntrada({
      conta: ebx,
      r: rascunhoEbx({ modo: 'fechada', parOutro: true, parTexto: 'gbp/usd', direcao: 'call', duracao: 300, payout: '87', hora: '20:13', resultado: 'ganho' }),
      now: now2024,
      hoje,
      tentou: false,
    })
    expect(f.linhaResultado).toBe('Resultado: +US$ 17,40')
    expect(f.payloadFechada).toEqual({
      v: 1,
      client_key: KEY,
      symbol: 'GBP/USD',
      direction: 'call',
      stake: '20',
      payout: '87',
      duration_s: 300,
      clock: 'America/Sao_Paulo',
      day: '2026-10-22',
      entry: '20:13',
      outcome: 'ganho',
    })
  })
})

describe('the gate line, the limit line, the plan', () => {
  it('at 11:05 ET: «Fora da sua janela · 10:00–11:00 ET» and «fora da janela» (the owner’s test)', () => {
    const a = agoraTelas('agora-qua-1105-et').accounts.find((x) => x.accountId === ids.accounts.topOne)!
    expect(linhaGate(top, a.gate, a.rules, { presente: true, outroDia: false })).toEqual({ palavra: 'Fora da sua janela', sub: '· 10:00–11:00 ET', tom: 'amber', acao: null })
    expect(textoQuebras(quebrasDoGate(a.gate))).toBe('fora da janela')
  })

  it('«Liberado até 11:00 ET» only on the current minute; «US$ 245 de US$ 400»', () => {
    expect(linhaGate(top, top1031.gate, top1031.rules, { presente: true, outroDia: false }).sub).toBe('até 11:00 ET')
    expect(linhaGate(top, top1031.gate, top1031.rules, { presente: false, outroDia: false }).sub).toBe('')
    expect(linhaLimite(top, top1031.gate, top1031.rules)).toEqual({ usado: 'US$ 245', de: 'de US$ 400' })
    expect(linhaLimite(ebx, ebx2024.gate, ebx2024.rules)).toBeNull()
  })

  it('«Encerrado por hoje · limite de US$ 400 atingido às 10:40 (pior momento −US$ 505)» and «depois do limite»', () => {
    const a = agoraTelas('agora-qui-1042-et').accounts.find((x) => x.accountId === ids.accounts.topOne)!
    expect(linhaGate(top, a.gate, a.rules, { presente: true, outroDia: false })).toMatchObject({
      palavra: 'Encerrado por hoje',
      sub: '· limite de US$ 400 atingido às 10:40 (pior momento −US$ 505)',
      tom: 'red',
    })
    expect(textoQuebras(quebrasDoGate(a.gate))).toBe('depois do limite')
  })

  it('«Sem janela salva · Definir» for an account without a window', () => {
    const gate = {
      ...top1031.gate,
      status: null,
      warnings: [],
      checksEvaluated: [],
      window: { evaluated: false as const, state: 'nao_avaliado' as const, reason: 'sem_janela' as const },
      limit: { evaluated: false as const, state: 'nao_avaliado' as const, reason: 'sem_limite' as const },
    }
    const rules = { ...top1031.rules!, windows: [], limit: null }
    expect(linhaGate(top, gate, rules, { presente: true, outroDia: false })).toEqual({
      palavra: 'Sem janela salva',
      sub: '',
      tom: 'muted',
      acao: { texto: 'Definir', href: '/personalizar#janelas', aria: 'Definir a janela da Top One #1 em Personalizar' },
    })
  })

  it('the warning: his example, equal risk, Ebinex without a limit, the result already known', () => {
    const json = telasJson('agora-qui-1031-et') as { accounts: Record<string, any>[] }
    json.accounts[0].limit = { ...json.accounts[0].limit, net_usd: -300, worst_usd: -300, used: 0.75 }
    const gate = parseRulesNow(json).accounts[0].gate
    const aviso = (risco: string, jaFoi = false) => avisoLimiteEntrada(top, { jaFoi, risco, diaRecusado: false }, gate, undefined)
    expect(aviso('125')).toBe('Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 125.')
    expect(aviso('120')).toBe('Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 120.')
    expect(aviso('112.5')).toBe('Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 112,50.')
    expect(aviso('100')).toBeNull()
    expect(aviso('125', true)).toBeNull()
    expect(avisoLimiteEntrada(ebx, { jaFoi: false, risco: '5000', diaRecusado: false }, ebx2024.gate, undefined)).toBeNull()
    // A binary on an account with a limit
    const ebxLim = { ...ebx, temLimite: true }
    expect(avisoLimiteEntrada(ebxLim, { jaFoi: false, risco: '30', diaRecusado: false }, null, { limit: '100', net: '-80', reached: false, left: '20', risk: '30', above: true })).toBe(
      'Se perder, o dia passa do limite: faltam US$ 20 e o stake é US$ 30.',
    )
    // The dry run's answer wins over the local rule
    expect(avisoLimiteEntrada(top, { jaFoi: false, risco: '125', diaRecusado: false }, gate, { limit: '400', net: '-300', reached: false, left: '100', risk: '125', above: false })).toBeNull()
  })
})

describe('a registered trade', () => {
  const now1031 = at('2026-10-22T14:31:05Z')

  it('the chooser’s rows and step 2’s summary', () => {
    const mnq = entradaTelas('entry-mnq-qua').state.trade
    const mes = entradaTelas('entry-mes').state.trade
    expect(opTexto(mes)).toBe('MES · Compra · 2 ct')
    expect(desdeTexto(top, mnq, now1031)).toBe('ontem, 10:52 ET')
    expect(desdeTexto(top, mes, now1031)).toBe('10:12 ET')
    expect(desdeTexto(top, mes, at('2026-10-24T14:31:05Z'))).toBe('22 out, 10:12 ET')
    expect(resumoAberta(top, mes, now1031)).toEqual({
      op: 'MES · Compra · 2 ct',
      entrada: '7.912,50 às 10:12 ET',
      stop: 'stop 10 · alvo 20 pts · risco US$ 100,00',
      status: 'Entrada registrada às 10:12 ET.',
    })
    const typed = { ...mes, entryTime: at('2026-10-22T14:10:00Z'), registeredAt: at('2026-10-22T14:12:04Z') }
    expect(resumoAberta(top, typed, now1031).status).toBe('Entrada das 10:10 ET registrada às 10:12.')
    expect(resumoAberta(top, mnq, now1031).status).toBe('Entrada de ontem, às 10:52 ET.')
    const ebxT = entradaTelas('entry-ebinex-put').state.trade
    expect(resumoAberta(ebx, ebxT, at('2026-10-22T23:11:00Z'))).toMatchObject({ op: 'EUR/USD · Baixa · 1 min', entrada: 'US$ 20 · payout 88% · 20:10–20:12 de Brasília', stop: null })
  })

  it('the exit’s checks and preview', () => {
    const mes = entradaTelas('entry-mes').state.trade
    expect(modeloSaida(top, mes, { preco: '', hora: null }, now1031, false)).toMatchObject({ previa: 'Resultado: informe o preço de saída.', payload: null })
    expect(modeloSaida(top, mes, { preco: '7903,8', hora: null }, now1031, false).previa).toBe('Resultado: confira o preço de saída (o MES anda de 0,25 em 0,25).')
    expect(modeloSaida(top, mes, { preco: '7903,8', hora: null }, now1031, true).previa).toBe('Resultado: confira o preço de saída.')
    const ok = modeloSaida(top, mes, { preco: '7903,75', hora: null }, now1031, false)
    expect(ok.previa).toBe('Se sair a 7.903,75: −8,75 pts · −US$ 87,50')
    expect(ok.payload).toEqual({ v: 1, exit_price: '7903.75', clock: 'America/New_York' })
    expect(modeloSaida(top, mes, { preco: '7903,75', hora: '10:30' }, now1031, false).payload).toEqual({ v: 1, exit_price: '7903.75', exit: '10:30', clock: 'America/New_York' })
    expect(modeloSaida(top, mes, { preco: '7903,75', hora: '10:40' }, now1031, false).erros.shora).toBe('A saída não pode ser depois de agora (10:31 ET).')
    expect(modeloSaida(top, mes, { preco: '7903,75', hora: '10:05' }, now1031, false).erros.shora).toBe('A saída não pode ser antes da entrada (10:12).')
  })

  it('the binary’s result waits for the expiry', () => {
    const t = entradaTelas('entry-ebinex-put').state.trade
    const antes = modeloResultado(ebx, t, 'perda', at('2026-10-22T23:11:59Z'))
    expect(antes).toMatchObject({ vencida: false, erro: 'Ainda não venceu.', payload: null, vence: 'Vence às 20:12 de Brasília.' })
    const depois = modeloResultado(ebx, t, 'perda', at('2026-10-22T23:12:00Z'))
    expect(depois).toMatchObject({ vencida: true, erro: null, payload: { v: 1, outcome: 'perda' }, previa: 'Resultado: −US$ 20,00', vence: 'Venceu às 20:12 de Brasília.' })
  })

  it('step 3’s card, its periods and R', () => {
    const now = at('2026-10-22T14:42:05Z')
    expect(cartaoFechada(top, saidaTelas('exit-mes-oitenta').state.trade, now)).toEqual({
      valor: '−US$ 100,00',
      tom: 'red',
      linha: 'MES · Compra · 2 ct · 7.912,50 → 7.902,50 · −10,00 pts · 10:12–10:38 ET',
      r: { valor: '−1,00 R', sub: 'com stop de 10 pts' },
    })
    expect(cartaoFechada(top, saidaTelas('exit-mnq-ontem').state.trade, now).linha).toBe(
      'MNQ · Compra · 1 ct · 30.880,50 → 30.912,75 · +32,25 pts · 21 out, 10:52 → 22 out, 10:42 ET',
    )
    expect(cartaoFechada(top, saidaTelas('exit-mnq-ontem').state.trade, now).r?.valor).toBe('+0,81 R')
    expect(periodo(top, at('2026-10-21T14:33:00Z'), at('2026-10-21T14:49:00Z'), now)).toBe('21 out, 10:33–10:49 ET')
    expect(cartaoFechada(ebx, saidaTelas('exit-ebinex-perda').state.trade, at('2026-10-22T23:13:00Z'))).toEqual({
      valor: '−US$ 20,00',
      tom: 'red',
      linha: 'EUR/USD · Baixa · 1 min · perda · 20:10–20:12 de Brasília',
      r: null,
    })
  })

  it('the exit banners', () => {
    expect(textoAviso(top, { tipo: 'atingido', hitAt: at('2026-10-22T14:40:05Z'), worstCents: -50500, limitCents: 40000, currency: 'USD', atLimit: 'encerrar' }, null)).toEqual({
      texto: 'Limite do dia atingido às 10:40: −US$ 505 de US$ 400. Pelas suas regras, o dia está encerrado.',
      atingido: true,
    })
    expect(textoAviso(top, { tipo: 'atingido', hitAt: null, worstCents: -41550, limitCents: 40000, currency: 'USD', atLimit: 'avisar' }, at('2026-10-22T14:38:00Z')).texto).toBe(
      'Limite do dia atingido às 10:38: −US$ 415,50 de US$ 400. Pelas suas regras, é só um aviso.',
    )
    expect(textoAviso(top, { tipo: 'oitenta', worstCents: -34500, limitCents: 40000, currency: 'USD' }, null)).toEqual({
      texto: 'Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.',
      atingido: false,
    })
  })
})

describe('the marks split on step 3', () => {
  const now = at('2026-10-22T23:13:00Z')

  it('a mark changed after the result keeps the one before in «antes da saída»', () => {
    const s = estadoTelas('marks-ebinex-depois')
    expect(marcasDivididas(ebx, s.marks, now)).toEqual({
      antes: [{ texto: 'Setup B', quando: 'às 20:10 (trocada às 20:12)', historico: null }],
      depois: [{ texto: 'Setup C', quando: 'às 20:12', historico: 'antes: B às 20:10 · agora: C às 20:12' }],
    })
    expect(linhaDepois(ebx, s.trade, s.marks, 'live')).toBe('Marcas feitas a partir de agora contam como depois do resultado.')
  })

  it('«desmarcada», a mark only after the result, and «(o vencimento)»', () => {
    const m = (id: number, kind: MarkEvent['kind'], value: string | null, iso: string, limpa: boolean): MarkEvent => ({ id, kind, value, markedAt: at(iso), limpa })
    const events = [
      m(1, 'setup', 'A', '2026-10-22T23:10:20Z', true),
      m(2, 'setup', null, '2026-10-22T23:12:40Z', false),
      m(3, 'emocao', 'frustrado', '2026-10-22T23:12:10Z', false),
      m(4, 'execucao', 'no_ponto', '2026-10-22T23:10:20Z', true),
    ]
    expect(marcasDivididas(ebx, events, now)).toEqual({
      antes: [
        { texto: 'Setup A', quando: 'às 20:10 (desmarcada às 20:12)', historico: null },
        { texto: 'Execução: no ponto', quando: 'às 20:10', historico: null },
      ],
      depois: [
        { texto: 'Setup: sem marca', quando: 'às 20:12', historico: 'antes: A às 20:10 · agora: sem marca às 20:12' },
        { texto: 'Emoção: Frustrado', quando: 'às 20:12', historico: null },
      ],
    })
    const t = saidaTelas('exit-ebinex-perda').state.trade
    expect(linhaDepois(ebx, t, events, 'live')).toBe('Marcas feitas a partir das 20:12 (o vencimento) contam como depois do resultado.')
    expect(linhaDepois(ebx, t, events, 'reconstructed')).toBe('Marcas feitas a partir de agora contam como depois do resultado.')
  })
})

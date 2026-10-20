/**
 * «Registrar operação» on an Ações e opções account (3-4, lane B; board scenario 7 · IBKR), with the
 * answers recorded from the real SQL (testing/registrarMercados; invented data) on Thu 15 Oct 2026:
 * no window and no limit («Sem janela salva» + «Definir», nothing evaluated), «O que você operou?»,
 * a stock (AAPL, computed ×1, price stops), an option (SPY Call 790: «Tipo», «Strike», «Vencimento»,
 * premiums ×100, the contracts line), «Venceu sem valor» on step 1 («Ontem», expiry 14 out) and on
 * step 2 (after 16:00 ET), the expiry before the day, and a backfilled `options` account with
 * «Opção» fixed. The sheet is lane A's; the option pieces are lane B's.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import { parseRulesNow } from '@/lib/hub/regras'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import {
  agoraMercados,
  contasMercados,
  entradaMercados,
  fechadaMercados,
  fechadaPreviaMercados,
  idsMercados,
  mercadosJson,
  previaMercados,
  saidaMercados,
} from '@/testing/registrarMercados'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewExit: jest.fn(),
  previewAfter: jest.fn(),
  registerEntry: jest.fn(),
  registerExit: jest.fn(),
  registerAfter: jest.fn(),
  addMarks: jest.fn(),
  undoEntry: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsMercados()
const NY = 'America/New_York'
const OPCOES = 'conta-opcoes'

type Json = Record<string, any>

/** rules_now of 09:52 ET as if the server had answered it at `iso`; with an `options` account beside IBKR (a Phase 1 backfill) */
function agoraAs(iso = '2026-10-15T13:52:05Z') {
  const json = mercadosJson('agora-ibkr-qui-0952') as Json
  json.server_now = iso
  const ibkr = (json.accounts as Json[]).find((a) => a.account_id === ids.accounts.ibkr) as Json
  json.accounts.push({ ...JSON.parse(JSON.stringify(ibkr)), account_id: OPCOES, label: 'Opções', market: 'options' })
  return parseRulesNow(json)
}
const contas = () => {
  const ibkr = contasMercados().find((c) => c.id === ids.accounts.ibkr)!
  return [...contasMercados(), { ...ibkr, id: OPCOES, label: 'Opções', market: 'options' as const, is_primary: false, sort_order: 9 }]
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraAs())
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  // A fresh account: the board's examples (SPY first)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraAs().accounts.find((a) => a.accountId === id)!)
})

function abrir({ accountId = ids.accounts.ibkr, tradeId = null }: { accountId?: string; tradeId?: string | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const pill = (g: string, nome: string) => within(grupo(g)).getByRole('button', { name: nome })
const rotulos = (g: string) => within(grupo(g)).getAllByRole('button').map((b) => b.textContent)
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
async function digitar(rotulo: string, texto: string) {
  await userEvent.clear(campo(rotulo))
  await userEvent.type(campo(rotulo), texto)
}
const linhaDoGate = () => screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement as HTMLElement

async function entrada(accountId?: string) {
  abrir({ accountId })
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
}

/** «Opção», SPY Call 790, the expiry chip, «Compra», 2 contracts, premium 1,85 */
async function opcaoSpy(vencimento = 'Hoje') {
  await userEvent.click(pill('O que você operou?', 'Opção'))
  await userEvent.click(pill('Tipo', 'Call'))
  await userEvent.type(campo('Strike, US$'), '790')
  await userEvent.click(pill('Vencimento', vencimento))
  await userEvent.click(pill('Lado', 'Compra'))
  await userEvent.click(pill('Contratos', '2'))
  await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
}

describe('step 1 on IBKR at 09:52 ET (no window, no limit)', () => {
  it('«Sem janela salva» with «Definir», no limit line, «O que você operou?» with «Ação ou ETF»', async () => {
    await entrada()
    expect(linhaDoGate()).toHaveTextContent('Sem janela salva')
    expect(screen.getByRole('link', { name: 'Definir a janela da IBKR em Personalizar' })).toHaveAttribute('href', '/personalizar#janelas')
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
    expect(rotulos('O que você operou?')).toEqual(['Ação ou ETF', 'Opção'])
    expect(pill('O que você operou?', 'Ação ou ETF')).toHaveAttribute('aria-pressed', 'true')
    expect(rotulos('Ativo')).toEqual(['SPY', 'AAPL', 'NVDA', 'TSLA', 'QQQ'])
    const busca = screen.getByRole('searchbox', { name: 'Buscar ativo' })
    expect(busca).toHaveAttribute('placeholder', 'Ex.: MSFT')
    // Shares: a field, no chips
    expect(campo('Ações')).toHaveValue('')
    expect(screen.queryByRole('group', { name: 'Ações' })).not.toBeInTheDocument()
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
    // No option block for a stock
    expect(screen.queryByRole('group', { name: 'Tipo' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Strike, US$')).not.toBeInTheDocument()
  })

  it('«Ação ou ETF» AAPL: computed ×1 («risco US$ 50,00 · alvo US$ 100,00 · 1 : 2»), the entry sent with price stops', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('aapl'))
    db.registerEntry.mockResolvedValue(entradaMercados('aapl'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('aapl').state)
    await entrada()
    await userEvent.click(pill('Ativo', 'AAPL'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Ações'), '100')
    // A single dot is the decimal mark on Ações e opções
    await userEvent.type(campo('Preço de entrada'), '231.40')
    await userEvent.type(campo('Stop'), '230.90')
    await userEvent.type(campo('Alvo'), '232.40')
    expect(screen.getByText('risco US$ 50,00 · alvo US$ 100,00 · 1 : 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const [, accountId, payload] = db.registerEntry.mock.calls[0]
    expect(accountId).toBe(ids.accounts.ibkr)
    expect(payload).toMatchObject({ symbol: 'AAPL', direction: 'long', quantity: '100', entry_price: '231.4', stop_price: '230.9', target_price: '232.4', clock: NY })
    expect(payload).not.toHaveProperty('option')
    expect(payload).not.toHaveProperty('stop_pts')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
  })

  it('«Opção»: «Ativo-objeto», the option block before «Lado», contracts, premiums and the contracts line', async () => {
    await entrada()
    await userEvent.click(pill('O que você operou?', 'Opção'))
    expect(pill('O que você operou?', 'Opção')).toHaveAttribute('aria-pressed', 'true')
    expect(rotulos('Ativo-objeto')).toEqual(['SPY', 'QQQ', 'SPX', 'NVDA', 'TSLA'])
    expect(screen.getByRole('searchbox', { name: 'Buscar ativo' })).toHaveAttribute('placeholder', 'Ex.: SPX')
    expect(rotulos('Tipo')).toEqual(['Call', 'Put'])
    expect(rotulos('Vencimento')).toEqual(['Hoje', 'Sexta, 16 out'])
    expect(campo('Outra data')).toHaveAttribute('min', '2026-10-15')
    // The block sits between the instrument and «Lado» (the board's order)
    const tipo = grupo('Tipo')
    const lado = grupo('Lado')
    expect(grupo('Ativo-objeto').compareDocumentPosition(tipo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tipo.compareDocumentPosition(lado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rotulos('Contratos')).toEqual(['1', '2', '3', 'Outro'])
    expect(campo('Prêmio de entrada, US$ por ação')).toBeInTheDocument()
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo do prêmio · opcional')

    await userEvent.click(pill('Contratos', '2'))
    expect(screen.getByText('2 contratos × 100 = 200 opções')).toBeInTheDocument()
    await userEvent.click(pill('Contratos', '1'))
    expect(screen.getByText('1 contrato × 100 = 100 opções')).toBeInTheDocument()
  })

  it('SPY Call 790: «2 contratos × 100 = 200 opções · risco US$ 150,00 · alvo US$ 270,00 · 1 : 1,8», sent without a multiplier', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('spy-call'))
    db.registerEntry.mockResolvedValue(entradaMercados('spy-call-aberta'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('spy-call-aberta').state)
    await entrada()
    await opcaoSpy()
    await userEvent.type(campo('Stop'), '1.10')
    await userEvent.type(campo('Alvo'), '3.20')
    expect(screen.getByText('2 contratos × 100 = 200 opções · risco US$ 150,00 · alvo US$ 270,00 · 1 : 1,8')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const payload = db.registerEntry.mock.calls[0][2]
    expect(payload).toMatchObject({
      symbol: 'SPY', direction: 'long', quantity: '2', entry_price: '1.85', stop_price: '1.1', target_price: '3.2',
      option: { right: 'call', strike: '790', expires_on: '2026-10-15' },
    })
    expect(payload.option).not.toHaveProperty('multiplier')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
  })

  it('switching back to «Ação ou ETF» clears the premium and the contracts', async () => {
    await entrada()
    await opcaoSpy()
    await userEvent.click(pill('O que você operou?', 'Ação ou ETF'))
    expect(screen.queryByRole('group', { name: 'Tipo' })).not.toBeInTheDocument()
    expect(campo('Preço de entrada')).toHaveValue('')
    expect(campo('Ações')).toHaveValue('')
  })

  it('after «Registrar entrada», the block’s missing answers in order; the focus on «Call»', async () => {
    await entrada()
    await userEvent.click(pill('O que você operou?', 'Opção'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '1'))
    await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(pill('Tipo', 'Call')).toHaveFocus()
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Escolha Call ou Put.', 'Informe o strike.', 'Escolha o vencimento.'])
    expect(grupo('Tipo')).toHaveAccessibleDescription('Escolha Call ou Put.')
    expect(campo('Strike, US$')).toHaveAttribute('aria-invalid', 'true')
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('an expiry before the day of the entry: the error, the focus on «Vencimento», nothing sent', async () => {
    await entrada()
    await userEvent.click(pill('O que você operou?', 'Opção'))
    await userEvent.click(pill('Tipo', 'Call'))
    await userEvent.type(campo('Strike, US$'), '790')
    await userEvent.type(campo('Outra data'), '2026-10-14')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByRole('alert')).toHaveTextContent('O vencimento não pode ser antes do dia da entrada.')
    expect([document.getElementById('g-venc-0'), document.getElementById('f-venc')]).toContain(document.activeElement)
    expect(campo('Outra data')).toHaveAttribute('aria-invalid', 'true')
    expect(db.registerEntry).not.toHaveBeenCalled()
  })
})

describe('«Já fechada» on IBKR', () => {
  async function fechada() {
    await entrada()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
  }

  it('SPY Call 790 09:35–09:48, 1,85 → 2,40: «+0,55 no prêmio · +US$ 110,00», «Venceu sem valor» waits for 16:00 ET', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaMercados('spy-call'))
    const after = fechadaMercados('spy-call')
    db.registerAfter.mockResolvedValue(after)
    db.fetchTradeState.mockResolvedValue(after.state)
    await fechada()
    await opcaoSpy()
    await digitar('Hora da entrada (ET)', '09:35')
    const vsv = screen.getByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).toHaveAttribute('aria-disabled', 'true')
    expect(vsv).toHaveAccessibleDescription('Vence hoje às 16:00 ET.')
    expect(screen.getByText('Resultado: preencha os dois prêmios.')).toBeInTheDocument()
    await userEvent.type(campo('Prêmio de saída, US$ por ação'), '2.40')
    await digitar('Hora da saída (ET)', '09:48')
    expect(screen.getByText('Resultado: +0,55 no prêmio · +US$ 110,00')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('button', { name: 'Corrigir' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Comissão e taxas da corretora (SEC, FINRA).')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    const payload = db.registerAfter.mock.calls[0][2]
    expect(payload).toMatchObject({
      symbol: 'SPY', direction: 'long', quantity: '2', entry_price: '1.85', exit_price: '2.4', entry: '09:35', exit: '09:48', day: '2026-10-15',
      option: { right: 'call', strike: '790', expires_on: '2026-10-15' },
    })
    expect(payload.option).not.toHaveProperty('multiplier')
    expect(payload).not.toHaveProperty('pnl')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('+US$ 110,00')).toBeInTheDocument()
    expect(screen.getByText('SPY Call 790 · vence 15 out · Compra · 2 ct · 1,85 → 2,40 · +0,55 no prêmio · 09:35–09:48 ET')).toBeInTheDocument()
  })

  it('«Ontem» with expiry 14 out: «Venceu sem valor» writes premium 0 at 16:00 ET and sends it (−US$ 370,00)', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaMercados('spy-vsv-ontem'))
    const after = fechadaMercados('spy-vsv-ontem')
    db.registerAfter.mockResolvedValue(after)
    db.fetchTradeState.mockResolvedValue(after.state)
    await fechada()
    await userEvent.click(pill('Dia', 'Ontem'))
    await userEvent.click(pill('O que você operou?', 'Opção'))
    expect(rotulos('Vencimento')).toEqual(['14 out', 'Sexta, 16 out'])
    await opcaoSpy('14 out')
    await digitar('Hora da entrada (ET)', '09:35')
    const vsv = screen.getByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).not.toHaveAttribute('aria-disabled')
    expect(vsv).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(vsv)
    expect(screen.getByRole('button', { name: 'Venceu sem valor' })).toHaveAttribute('aria-pressed', 'true')
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('0')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    expect(screen.getByText('Resultado: −1,85 no prêmio · −US$ 370,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({
      day: '2026-10-14', entry: '09:35', exit: '16:00', exit_price: '0', option: { right: 'call', strike: '790', expires_on: '2026-10-14' },
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('−US$ 370,00')).toBeInTheDocument()
  })

  it('changing the expiry turns «Venceu sem valor» off and says when it expires', async () => {
    await fechada()
    await userEvent.click(pill('Dia', 'Ontem'))
    await opcaoSpy('14 out')
    await userEvent.click(screen.getByRole('button', { name: 'Venceu sem valor' }))
    await userEvent.click(pill('Vencimento', 'Sexta, 16 out'))
    const vsv = screen.getByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).toHaveAttribute('aria-pressed', 'false')
    expect(vsv).toHaveAttribute('aria-disabled', 'true')
    expect(vsv).toHaveAccessibleDescription('Vence em 16 out, às 16:00 ET.')
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
  })
})

describe('step 2 of the open SPY call: «Venceu sem valor» after 16:00 ET', () => {
  const aberta = () => entradaMercados('spy-call-aberta')

  it('at 09:52 it waits («Vence hoje às 16:00 ET.»); at 16:05 it writes 0 at 16:00 and the exit is sent', async () => {
    db.fetchTradeState.mockResolvedValue(aberta().state)
    db.fetchOpenTrades.mockResolvedValue([aberta().state.trade])
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-15T20:05:05Z'))
    db.registerExit.mockResolvedValue(saidaMercados('spy-vsv'))
    abrir({ tradeId: aberta().state.trade.id })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
    expect(screen.getByText('SPY Call 790 · vence 15 out · Compra · 2 ct')).toBeInTheDocument()
    const vsv = await screen.findByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).not.toHaveAttribute('aria-disabled')
    await userEvent.click(vsv)
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('0')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    expect(screen.getByText('Se sair a 0,00: −1,85 no prêmio · −US$ 370,00')).toBeInTheDocument()
    db.fetchTradeState.mockResolvedValue(saidaMercados('spy-vsv').state)
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toMatchObject({ exit_price: '0', exit: '16:00', clock: NY })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('−US$ 370,00')).toBeInTheDocument()
  })

  it('the next day at 00:30 ET «16:00» is still Thursday’s close: the pill writes it and the exit is sent', async () => {
    db.fetchTradeState.mockResolvedValue(aberta().state)
    db.fetchOpenTrades.mockResolvedValue([aberta().state.trade])
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-16T04:30:05Z'))
    db.registerExit.mockResolvedValue(saidaMercados('spy-vsv'))
    abrir({ tradeId: aberta().state.trade.id })
    const vsv = await screen.findByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).not.toHaveAttribute('aria-disabled')
    await userEvent.click(vsv)
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    db.fetchTradeState.mockResolvedValue(saidaMercados('spy-vsv').state)
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toMatchObject({ exit_price: '0', exit: '16:00', clock: NY })
  })

  it.each([
    ['Fri 10:00 ET («16:00» would be Friday’s, ahead of now)', '2026-10-16T14:00:05Z', '10:00'],
    ['Fri 17:00 ET («16:00» would be Friday’s, a day after the expiry)', '2026-10-16T21:00:05Z', '17:00'],
    ['Mon 17:00 ET', '2026-10-19T21:00:05Z', '17:00'],
  ])('%s: the pill is aria-disabled with the late note, a press writes nothing and no exit at 16:00 is sent', async (_q, iso, agora) => {
    db.fetchTradeState.mockResolvedValue(aberta().state)
    db.fetchOpenTrades.mockResolvedValue([aberta().state.trade])
    fetchRulesNow.mockResolvedValue(agoraAs(iso))
    abrir({ tradeId: aberta().state.trade.id })
    const vsv = await screen.findByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).toHaveAttribute('aria-disabled', 'true')
    expect(vsv).toHaveAccessibleDescription('Venceu em 15 out, às 16:00 ET: essa saída só pode ser registrada até as 04:00 ET do dia seguinte.')
    await userEvent.click(vsv)
    expect(vsv).toHaveAttribute('aria-pressed', 'false')
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
    expect(campo('Hora da saída (ET)')).toHaveValue(agora)
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(db.registerExit).not.toHaveBeenCalled()
  })

  it('before 16:00 ET the pill is aria-disabled with its note, and a press does nothing', async () => {
    db.fetchTradeState.mockResolvedValue(aberta().state)
    db.fetchOpenTrades.mockResolvedValue([aberta().state.trade])
    abrir({ tradeId: aberta().state.trade.id })
    const vsv = await screen.findByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).toHaveAttribute('aria-disabled', 'true')
    expect(vsv).toHaveAccessibleDescription('Vence hoje às 16:00 ET.')
    await userEvent.click(vsv)
    expect(vsv).toHaveAttribute('aria-pressed', 'false')
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
  })
})

describe('an `options` account (a Phase 1 backfill)', () => {
  it('«Opção» is fixed: no «O que você operou?», the option block and «Ativo-objeto» from the start', async () => {
    await entrada(OPCOES)
    expect(screen.queryByRole('group', { name: 'O que você operou?' })).not.toBeInTheDocument()
    expect(rotulos('Ativo-objeto')).toEqual(['SPY', 'QQQ', 'SPX', 'NVDA', 'TSLA'])
    expect(rotulos('Tipo')).toEqual(['Call', 'Put'])
    expect(campo('Strike, US$')).toBeInTheDocument()
    expect(rotulos('Vencimento')).toEqual(['Hoje', 'Sexta, 16 out'])
    expect(campo('Prêmio de entrada, US$ por ação')).toBeInTheDocument()
  })
})

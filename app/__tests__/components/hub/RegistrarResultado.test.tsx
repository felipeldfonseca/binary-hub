/**
 * The generic pieces of the price markets' sheet (3-4, lane A), with the answers recorded from the
 * real SQL (testing/registrarMercados; invented data): a server refusal under its field, «Corrigir»
 * opened when the server asks for the result the form computed, and lane B's three pieces
 * (OQueOperou, BlocoOpcao, VenceuSemValor) rendered in their places with the props of contract
 * §6.3. Lane B's components are stubs here (they render what they are given), so this checks the
 * sheet, not them.
 *
 * The form checks every field by the server's own rules before sending, so a field refusal reaches
 * the sheet only when the two disagree. One input here is refused by the real SQL as sent (an entry
 * at 08:30 of the day the rules were saved at 09:00: before_rules). The others make the server
 * refuse what it would accept (its descriptors out of step with the app's, say a catalog revised on
 * one side only), with the code and field its functions raise (20261020000003: trade_check_payload,
 * trade_parse_entry, register_after), to check where the sheet puts them; their names say so.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  idsMercados,
  mercadosJson,
  operacaoMercados,
  saidaMercados,
  type MercadosAgora,
} from '@/testing/registrarMercados'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
// Every market registers once lane B flips REGISTRAR_MARKETS (contract 3-4 §5.9); until then the sheet's list is opened here
jest.mock('@/lib/hub/registrar', () => ({ ...jest.requireActual('@/lib/hub/registrar'), podeRegistrar: (m: string | null | undefined) => !!m }))
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

// Lane B's pieces as stubs that show their props and call their callbacks (with the ids the focus order needs)
jest.mock('@/components/hub/registrar/OQueOperou', () => {
  const R = jest.requireActual('react')
  return {
    __esModule: true,
    default: ({ valor, aoMudar }: { valor: string; aoMudar: (v: 'acao' | 'opcao') => void }) =>
      R.createElement(
        'div',
        { 'data-testid': 'o-que-operou', 'data-valor': valor },
        R.createElement('button', { type: 'button', onClick: () => aoMudar('opcao') }, 'stub: Opção'),
        R.createElement('button', { type: 'button', onClick: () => aoMudar('acao') }, 'stub: Ação ou ETF'),
      ),
  }
})
jest.mock('@/components/hub/registrar/BlocoOpcao', () => {
  const R = jest.requireActual('react')
  return {
    __esModule: true,
    default: ({ m, aoMudar }: { m: { chips: { valor: string }[] }; aoMudar: (p: Record<string, string>) => void }) =>
      R.createElement(
        'div',
        { 'data-testid': 'bloco-opcao', 'data-m': JSON.stringify(m) },
        R.createElement('button', { id: 'g-opTipo-0', type: 'button', onClick: () => aoMudar({ opTipo: 'call' }) }, 'stub: Call'),
        R.createElement('input', { id: 'f-strike', 'aria-label': 'stub: Strike', readOnly: true, value: '' }),
        R.createElement('button', { type: 'button', onClick: () => aoMudar({ strike: '790' }) }, 'stub: Strike 790'),
        R.createElement('button', { id: 'g-venc-0', type: 'button', onClick: () => aoMudar({ vencimento: m.chips[0].valor }) }, 'stub: vencimento do dia'),
        R.createElement('button', { id: 'g-venc-1', type: 'button', onClick: () => aoMudar({ vencimento: m.chips[1].valor }) }, 'stub: vencimento na sexta'),
        R.createElement('input', { id: 'f-venc', 'aria-label': 'stub: Outra data', readOnly: true, value: '' }),
        R.createElement('button', { type: 'button', onClick: () => aoMudar({ vencimento: '2026-10-23' }) }, 'stub: Outra data 23 out'),
      ),
  }
})
jest.mock('@/components/hub/registrar/VenceuSemValor', () => {
  const R = jest.requireActual('react')
  return {
    __esModule: true,
    default: ({ estado, aoAlternar }: { estado: unknown; aoAlternar: () => void }) =>
      R.createElement(
        'div',
        { 'data-testid': 'vsv', 'data-estado': JSON.stringify(estado) },
        R.createElement('button', { type: 'button', onClick: aoAlternar }, 'stub: Venceu sem valor'),
      ),
  }
})

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsMercados()
const NY = 'America/New_York'
/** A refusal with the code and field the SQL raises (registrarDb's error, as the client builds it) */
const recusa = (code: registrarDb.RegistrarErrorCode, field: registrarDb.RegistrarField) => new registrarDb.RegistrarDataError(code, field)

function agoraAs(name: MercadosAgora, iso: string) {
  const json = mercadosJson(`agora-${name}`) as Record<string, unknown>
  json.server_now = iso
  return parseRulesNow(json)
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasMercados())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraMercados('ftmo-qui-0840'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => {
    const now = await fetchRulesNow.mock.results[0]?.value
    return (now ?? agoraMercados('ftmo-qui-0840')).accounts.find((a: { accountId: string }) => a.accountId === id)
  })
})

function abrir(accountId: string, tradeId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const alertas = () => screen.queryAllByRole('alert').map((a) => a.textContent)
const modeloOpcao = () => JSON.parse(screen.getByTestId('bloco-opcao').getAttribute('data-m') as string)
const estadoVsv = () => JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)
/** A search result chosen: its chip takes the focus a frame later (wait, or the next keystrokes land on it) */
async function escolherNaBusca(rotuloBusca: string, grupoAtivo: string, texto: string, resultado: string) {
  await userEvent.type(screen.getByRole('searchbox', { name: rotuloBusca }), texto)
  await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: resultado }))
  await waitFor(() => expect(within(grupo(grupoAtivo)).getByRole('button', { name: resultado.replace(/^Usar “(.*)”$/, '$1') })).toHaveFocus())
}
const pill = (g: string, nome: string) => within(grupo(g)).getByRole('button', { name: nome })
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
async function digitar(rotulo: string, texto: string) {
  await userEvent.clear(campo(rotulo))
  await userEvent.type(campo(rotulo), texto)
}
/** a comes before b in the page */
const antes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('a server refusal under its field (FTMO, «Já fechada» at 09:01 ET)', () => {
  beforeEach(() => {
    fetchRulesNow.mockResolvedValue(agoraAs('ftmo-qui-0840', '2026-10-15T13:01:05Z'))
  })

  async function fechada(par: string, lado: 'Compra' | 'Venda', entrada: string, saida: string) {
    abrir(ids.accounts.ftmo)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    if (par !== 'EUR/USD') await userEvent.click(pill('Par', par))
    await userEvent.click(pill('Lado', lado))
    await userEvent.type(campo('Preço de entrada'), entrada)
    await digitar('Hora da entrada (ET)', '08:40')
    await userEvent.type(campo('Preço de saída'), saida)
  }

  it('before_rules, as the real SQL refuses it (13 out at 08:30, before the rules saved at 09:00): the new markets’ text under «Dia», focused', async () => {
    // register_after: the «Dia» is not before «desde» (the form's check), the instant is (rule_version_at)
    db.registerAfter.mockRejectedValue(recusa('before_rules', 'day'))
    abrir(ids.accounts.ftmo)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    fireEvent.change(campo('Outro dia'), { target: { value: '2026-10-13' } })
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await digitar('Hora da entrada (ET)', '08:30')
    await userEvent.type(campo('Preço de saída'), '1.08635')
    await digitar('Hora da saída (ET)', '08:50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(campo('Outro dia')).toHaveFocus())
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({ day: '2026-10-13', entry: '08:30', exit: '08:50' })
    expect(screen.getByText('Antes de 13 out esta conta não tinha regras: essas operações entram pela importação de arquivo.')).toHaveAttribute(
      'id',
      'e-dia',
    )
  })

  it('pnl_required on a typed result, should the server ask again (out of step): «Informe o resultado.» under «Resultado, US$», focused', async () => {
    db.registerAfter.mockRejectedValue(recusa('pnl_required', 'pnl'))
    await fechada('EUR/GBP', 'Venda', '0.87120', '0.87030')
    await userEvent.type(campo('Resultado, US$'), '58,60')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(campo('Resultado, US$')).toHaveFocus())
    expect(screen.getByText('Informe o resultado.')).toHaveAttribute('id', 'e-res')
    expect(campo('Resultado, US$')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Algo deu errado. Tente de novo.')).not.toBeInTheDocument()
  })

  it('pnl_required where the form computed the result (out of step): «Corrigir» opens the field, empty, with the error', async () => {
    db.registerAfter.mockRejectedValue(recusa('pnl_required', 'pnl'))
    await fechada('EUR/USD', 'Compra', '1.08520', '1.08635')
    expect(screen.queryByLabelText('Resultado na sua plataforma, US$')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(campo('Resultado na sua plataforma, US$')).toHaveFocus())
    expect(db.registerAfter.mock.calls[0][2]).not.toHaveProperty('pnl')
    expect(campo('Resultado na sua plataforma, US$')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Usar o calculado' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Informe o resultado.')).toBeInTheDocument()
  })

  it('bad_costs on costs the form accepted (out of step): under «Custos, US$», focused', async () => {
    db.registerAfter.mockRejectedValue(recusa('bad_costs', 'costs'))
    await fechada('EUR/USD', 'Compra', '1.08520', '1.08635')
    await userEvent.type(campo('Custos, US$ · opcional'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(campo('Custos, US$ · opcional')).toHaveFocus())
    expect(screen.getByText('Use só números, como 7,00.')).toHaveAttribute('id', 'e-custos')
  })

  it('bad_stop on a price stop the form let through (out of step): the side’s text (N), under «Stop», focused', async () => {
    db.registerEntry.mockRejectedValue(recusa('bad_stop', 'stop'))
    fetchRulesNow.mockResolvedValue(agoraMercados('ftmo-qui-0840'))
    abrir(ids.accounts.ftmo)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await escolherNaBusca('Buscar par', 'Par', 'xauusd', 'Usar “XAUUSD”')
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Preço de entrada'), '4.409,80')
    await userEvent.type(campo('Stop'), '4.413,30')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(campo('Stop')).toHaveFocus())
    expect(screen.getByText('Numa venda, o stop fica acima do preço de entrada.')).toHaveAttribute('id', 'e-stop')
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'XAUUSD', stop_price: '4413.3' })
  })

  it('a refusal of a field the form does not show (MES has no result field; out of step): the sheet’s alert says it', async () => {
    db.registerAfter.mockRejectedValue(recusa('pnl_required', 'pnl'))
    fetchRulesNow.mockResolvedValue(agoraMercados('top-qui-1005'))
    abrir(ids.accounts.topOne)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '6650,25')
    await digitar('Hora da entrada (ET)', '10:00')
    await userEvent.type(campo('Preço de saída'), '6652,25')
    await digitar('Hora da saída (ET)', '10:04')
    expect(screen.queryByLabelText(/^Resultado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado. Tente de novo.')
    expect(screen.queryByLabelText(/^Resultado/)).not.toBeInTheDocument()
  })

  it('bad_stop on points the form let through (out of step) keeps 3-3’s text', async () => {
    db.registerEntry.mockRejectedValue(recusa('bad_stop', 'stop'))
    fetchRulesNow.mockResolvedValue(agoraMercados('top-qui-1005'))
    abrir(ids.accounts.topOne)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '6650,25')
    await userEvent.type(campo('Stop'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(campo('Stop')).toHaveFocus())
    expect(screen.getByText('Use pontos maiores que zero.')).toBeInTheDocument()
  })
})

describe('a server refusal on step 2 (FTMO, 09:01 ET)', () => {
  beforeEach(() => {
    fetchRulesNow.mockResolvedValue(agoraAs('ftmo-qui-0840', '2026-10-15T13:01:05Z'))
  })

  it('pnl_required on a computed exit (out of step): «Corrigir» opens the field with the error; bad_costs under «Custos»; then the recorded correction', async () => {
    db.fetchTradeState.mockResolvedValue(entradaMercados('usdjpy-corrigida').state)
    db.registerExit.mockRejectedValueOnce(recusa('pnl_required', 'pnl'))
    db.registerExit.mockRejectedValueOnce(recusa('bad_costs', 'costs'))
    db.registerExit.mockResolvedValueOnce(saidaMercados('usdjpy-corrigida'))
    abrir(ids.accounts.ftmo, ids.trades.usdjpyCorrigida)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(campo('Preço de saída'), '150,980')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(campo('Resultado na sua plataforma, US$')).toHaveFocus())
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '150.98', clock: NY })
    expect(screen.getByText('Informe o resultado.')).toHaveAttribute('id', 'e-res')
    await userEvent.type(campo('Resultado na sua plataforma, US$'), '50,10')
    await userEvent.type(campo('Custos, US$ · opcional'), '2,10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(campo('Custos, US$ · opcional')).toHaveFocus())
    expect(screen.getByText('Use só números, como 7,00.')).toHaveAttribute('id', 'e-custos')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(db.registerExit.mock.calls[2][2]).toEqual({ v: 1, exit_price: '150.98', clock: NY, pnl: '50.1', costs: '2.1' })
    expect(screen.getByText('+US$ 50,10')).toBeInTheDocument()
    expect(screen.getByText('Resultado digitado por você.')).toBeInTheDocument()
    expect(screen.getByText('Custos US$ 2,10 · líquido +US$ 48,00')).toBeInTheDocument()
  })

  it('a refusal of a field this exit does not show (costs on ZN, never sent; out of step): the sheet’s alert says it', async () => {
    fetchRulesNow.mockResolvedValue(agoraMercados('top-qui-1005'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('zn').state)
    // not_for_market on `costs`: what trade_check_payload raises for costs on futures
    db.registerExit.mockRejectedValue(recusa('not_for_market', 'costs'))
    abrir(ids.accounts.topOne, ids.trades.zn)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.queryByLabelText(/^Custos/)).not.toBeInTheDocument()
    await userEvent.type(campo('Preço de saída'), '112,75')
    await userEvent.type(campo('Resultado, US$'), '250')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta conta ainda não registra operações aqui.')
    expect(alertas()).toEqual(['Esta conta ainda não registra operações aqui.'])
  })
})

describe('lane B’s pieces in their places (IBKR, no window, Thu 09:52 ET)', () => {
  beforeEach(() => {
    fetchRulesNow.mockResolvedValue(agoraMercados('ibkr-qui-0952'))
  })

  it('«O que você operou?» above the instrument; «Opção»: the option block between the underlying and «Lado», with its model', async () => {
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement).toHaveTextContent('Sem janela salva')
    expect(screen.getByRole('link', { name: 'Definir a janela da IBKR em Personalizar' })).toBeInTheDocument()
    const oQue = screen.getByTestId('o-que-operou')
    expect(oQue).toHaveAttribute('data-valor', 'acao')
    expect(antes(oQue, grupo('Ativo'))).toBe(true)
    expect(screen.getByRole('searchbox', { name: 'Buscar ativo' })).toHaveAttribute('placeholder', 'Ex.: MSFT')
    expect(campo('Ações')).toHaveValue('')
    expect(screen.queryByTestId('bloco-opcao')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    expect(screen.getByTestId('o-que-operou')).toHaveAttribute('data-valor', 'opcao')
    const bloco = screen.getByTestId('bloco-opcao')
    expect(JSON.parse(bloco.getAttribute('data-m') as string)).toEqual({
      tipo: null,
      strike: '',
      vencimento: null,
      chips: [{ rotulo: 'Hoje', valor: '2026-10-15' }, { rotulo: 'Sexta, 16 out', valor: '2026-10-16' }],
      min: '2026-10-15',
      erros: {},
    })
    expect(antes(grupo('Ativo-objeto'), bloco)).toBe(true)
    expect(antes(bloco, grupo('Lado'))).toBe(true)
    expect(screen.getByRole('searchbox', { name: 'Buscar ativo' })).toHaveAttribute('placeholder', 'Ex.: SPX')
    expect(pill('Contratos', '1')).toHaveAttribute('aria-pressed', 'true')
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo do prêmio · opcional')
  })

  it('the option block’s errors reach it after a tap, the focus goes to «Tipo»; then the option is sent without a multiplier', async () => {
    db.registerEntry.mockResolvedValue(entradaMercados('spy-call-aberta'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('spy-call-aberta').state)
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByRole('button', { name: 'stub: Call' })).toHaveFocus()
    expect(JSON.parse(screen.getByTestId('bloco-opcao').getAttribute('data-m') as string).erros).toEqual({
      opTipo: 'Escolha Call ou Put.',
      strike: 'Informe o strike.',
      venc: 'Escolha o vencimento.',
    })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Call' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Strike 790' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: vencimento do dia' }))
    await userEvent.type(campo('Stop'), '1.10')
    await userEvent.type(campo('Alvo'), '3.20')
    expect(screen.getByText('2 contratos × 100 = 200 opções · risco US$ 150,00 · alvo US$ 270,00 · 1 : 1,8')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const payload = db.registerEntry.mock.calls[0][2]
    expect(payload).toMatchObject({ symbol: 'SPY', quantity: '2', entry_price: '1.85', stop_price: '1.1', target_price: '3.2', option: { right: 'call', strike: '790', expires_on: '2026-10-15' } })
    expect(payload.option).not.toHaveProperty('multiplier')
  })

  /** «Opção», Call, strike 790, Compra, prêmio 1.85, the expiry chosen by `venc` */
  async function opcao(venc: string) {
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Call' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Strike 790' }))
    await userEvent.click(screen.getByRole('button', { name: venc }))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
  }

  it('bad_option on the expiry (out of step: the form refuses an expiry before the day first): the error reaches the block, the focus the chosen expiry', async () => {
    // register_entry raises bad_option on `option.expires_on` for an expiry before the entry's New York date
    db.registerEntry.mockRejectedValue(recusa('bad_option', 'option.expires_on'))
    await opcao('stub: vencimento do dia')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'stub: vencimento do dia' })).toHaveFocus())
    expect(modeloOpcao().erros).toEqual({ venc: 'O vencimento não pode ser antes do dia da entrada.' })
  })

  it('bad_option on the expiry: the focus goes to the chip chosen (the second), or to «Outra data» for a date of no chip', async () => {
    db.registerEntry.mockRejectedValue(recusa('bad_option', 'option.expires_on'))
    await opcao('stub: vencimento na sexta')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'stub: vencimento na sexta' })).toHaveFocus())
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ option: { expires_on: '2026-10-16' } })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Outra data 23 out' }))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(screen.getByLabelText('stub: Outra data')).toHaveFocus())
    expect(db.registerEntry.mock.calls[1][2]).toMatchObject({ option: { expires_on: '2026-10-23' } })
    expect(modeloOpcao().erros).toEqual({ venc: 'O vencimento não pode ser antes do dia da entrada.' })
  })

  it('only the expiry missing: «Escolha o vencimento.» reaches the block, the focus its first pill', async () => {
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Call' }))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Strike 790' }))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Prêmio de entrada, US$ por ação'), '1.85')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByRole('button', { name: 'stub: vencimento do dia' })).toHaveFocus()
    expect(modeloOpcao().erros).toEqual({ venc: 'Escolha o vencimento.' })
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('bad_option on the strike or the right (out of step): the error reaches the block, the focus its field', async () => {
    db.registerEntry.mockRejectedValueOnce(recusa('bad_option', 'option.strike'))
    db.registerEntry.mockRejectedValueOnce(recusa('bad_option', 'option.right'))
    await opcao('stub: vencimento do dia')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(screen.getByLabelText('stub: Strike')).toHaveFocus())
    expect(modeloOpcao().erros).toEqual({ strike: 'Use só números, como 790.' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'stub: Call' })).toHaveFocus())
    expect(modeloOpcao().erros).toEqual({ opTipo: 'Escolha Call ou Put.' })
    expect(alertas()).toEqual([])
  })

  it('«O que você operou?»: the kind pressed, tapped again, changes nothing; the other kind clears and quiets the errors a tap turned on', async () => {
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.type(campo('Preço de entrada'), '231.40')
    await userEvent.click(screen.getByRole('button', { name: 'stub: Ação ou ETF' }))
    expect(campo('Preço de entrada')).toHaveValue('231.40')
    await userEvent.clear(campo('Preço de entrada'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(alertas()).toEqual(['Escolha Compra ou Venda.', 'Informe a quantidade.', 'Informe o preço de entrada.'])
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    expect(alertas()).toEqual([])
    expect(modeloOpcao().erros).toEqual({})
  })

  it('«Venceu sem valor» above the exit fields of «Já fechada»: not before 16:00 ET; on «Ontem» it writes 0 at 16:00', async () => {
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(screen.getByRole('button', { name: 'stub: Opção' }))
    expect(JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)).toEqual({
      ligado: false,
      disponivel: false,
      nota: 'Escolha o vencimento primeiro.',
      hora: null,
    })
    expect(antes(screen.getByTestId('vsv'), campo('Prêmio de saída, US$ por ação'))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'stub: vencimento do dia' }))
    expect(JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)).toMatchObject({ disponivel: false, nota: 'Vence hoje às 16:00 ET.' })
    // Not available: the tap changes nothing
    await userEvent.click(screen.getByRole('button', { name: 'stub: Venceu sem valor' }))
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
    await userEvent.click(pill('Dia', 'Ontem'))
    await userEvent.click(screen.getByRole('button', { name: 'stub: vencimento do dia' }))
    expect(JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)).toEqual({ ligado: false, disponivel: true, nota: '', hora: '16:00' })
    await userEvent.click(screen.getByRole('button', { name: 'stub: Venceu sem valor' }))
    expect(JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)).toMatchObject({ ligado: true })
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('0')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    // Another expiry turns it off and clears the exit it wrote (RO l.1158); back to the first, it stays off
    await userEvent.click(screen.getByRole('button', { name: 'stub: vencimento na sexta' }))
    expect(estadoVsv()).toMatchObject({ ligado: false, disponivel: false })
    await userEvent.click(screen.getByRole('button', { name: 'stub: vencimento do dia' }))
    expect(estadoVsv()).toEqual({ ligado: false, disponivel: true, nota: '', hora: '16:00' })
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
    expect(campo('Hora da saída (ET)')).toHaveValue('09:52')
  })

  it('step 2 of the open SPY call at 16:05 ET: «Venceu sem valor» sends premium 0 at 16:00; step 3 shows −US$ 370,00', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('ibkr-qui-0952', '2026-10-15T20:05:05Z'))
    db.fetchTradeState.mockResolvedValue(operacaoMercados('spy-aberta'))
    db.registerExit.mockResolvedValue(saidaMercados('spy-vsv'))
    abrir(ids.accounts.ibkr, ids.trades.spyCall)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('SPY Call 790 · vence 15 out · Compra · 2 ct').parentElement).toHaveTextContent('prêmio 1,85 às 09:52 ET')
    expect(JSON.parse(screen.getByTestId('vsv').getAttribute('data-estado') as string)).toEqual({ ligado: false, disponivel: true, nota: '', hora: '16:00' })
    expect(antes(screen.getByTestId('vsv'), campo('Prêmio de saída, US$ por ação'))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'stub: Venceu sem valor' }))
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('0')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    expect(screen.getByText('Se sair a 0,00: −1,85 no prêmio · −US$ 370,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '0', exit: '16:00', clock: NY })
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('−US$ 370,00')).toBeInTheDocument()
    expect(screen.getByText('com stop do prêmio em 1,10', { exact: false })).toBeInTheDocument()
  })

  it('step 2 at 16:05 ET: «Venceu sem valor» over a typed premium writes 0; off again, the field is empty', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('ibkr-qui-0952', '2026-10-15T20:05:05Z'))
    db.fetchTradeState.mockResolvedValue(operacaoMercados('spy-aberta'))
    abrir(ids.accounts.ibkr, ids.trades.spyCall)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(campo('Prêmio de saída, US$ por ação'), '0,50')
    await userEvent.click(screen.getByRole('button', { name: 'stub: Venceu sem valor' }))
    expect(estadoVsv()).toMatchObject({ ligado: true })
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('0')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:00')
    await userEvent.click(screen.getByRole('button', { name: 'stub: Venceu sem valor' }))
    expect(estadoVsv()).toMatchObject({ ligado: false })
    expect(campo('Prêmio de saída, US$ por ação')).toHaveValue('')
    expect(campo('Hora da saída (ET)')).toHaveValue('16:05')
  })

  it('an `options` account: no «O que você operou?», the option block always there', async () => {
    fetchAccounts.mockResolvedValue(contasMercados().map((a) => (a.id === ids.accounts.ibkr ? { ...a, market: 'options' as const } : a)))
    abrir(ids.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.queryByTestId('o-que-operou')).not.toBeInTheDocument()
    expect(screen.getByTestId('bloco-opcao')).toBeInTheDocument()
    expect(grupo('Ativo-objeto')).toBeInTheDocument()
  })
})

describe('the B3 account renders through the generic fields (R$)', () => {
  it('Clear at 10:20: «Encerrado por hoje», the WIN chips, contracts 1 2 3 5 10, the typed result of BGIX26 in reais', async () => {
    fetchRulesNow.mockResolvedValue(agoraMercados('clear-qui-1020'))
    db.registerAfter.mockResolvedValue(fechadaMercados('bgix26'))
    db.fetchTradeState.mockResolvedValue(fechadaMercados('bgix26').state)
    abrir(ids.accounts.clear)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement).toHaveTextContent(
      'Encerrado por hoje· limite de R$ 500 atingido às 10:16 (pior momento −R$ 540)',
    )
    expect(within(grupo('Ativo')).getAllByRole('button').map((b) => b.textContent)).toEqual(['WIN', 'WDO', 'IND', 'DOL'])
    expect(within(grupo('Contratos')).getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3', '5', '10', 'Outro'])
    expect(campo('Hora (Brasília)')).toHaveValue('10:20')
    // A catalog stock: whole shares in a field, the lot note under it (a note, never an error)
    await escolherNaBusca('Buscar ativo', 'Ativo', 'petr4', 'PETR4')
    await userEvent.type(campo('Ações'), '150')
    const nota = screen.getByText('Fora do lote de 100, a B3 negocia no fracionário (código com F).')
    expect(nota).toHaveAttribute('id', 'n-q')
    expect(campo('Ações')).toHaveAttribute('aria-describedby', 'n-q')
    expect(campo('Ações')).not.toHaveAttribute('aria-invalid')
    await digitar('Ações', '300')
    expect(screen.queryByText('Fora do lote de 100, a B3 negocia no fracionário (código com F).')).not.toBeInTheDocument()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await escolherNaBusca('Buscar ativo', 'Ativo', 'bgix26', 'Usar “BGIX26”')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Quantidade'), '2')
    await userEvent.type(campo('Preço de entrada'), '310,55')
    await digitar('Hora da entrada (Brasília)', '10:17')
    await userEvent.type(campo('Preço de saída'), '311,30')
    await digitar('Hora da saída (Brasília)', '10:19')
    // The stop the recorded registration (after-bgix26) was sent with
    await userEvent.type(campo('Stop'), '309,80')
    expect(screen.getByText('Resultado: +0,75 no preço · digite o valor em reais')).toBeInTheDocument()
    await userEvent.type(campo('Resultado, R$'), '150')
    await userEvent.type(campo('Custos, R$ · opcional'), '3,50')
    expect(screen.getByText('Corretagem, emolumentos e registro. O imposto não entra.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({ symbol: 'BGIX26', quantity: '2', entry_price: '310.55', exit_price: '311.3', stop_price: '309.8', pnl: '150', costs: '3.5' })
    expect(db.registerAfter.mock.calls[0][2]).not.toHaveProperty('target_price')
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('+R$ 150,00')).toBeInTheDocument()
    expect(screen.getByText('Custos R$ 3,50 · líquido +R$ 146,50')).toBeInTheDocument()
  })
})

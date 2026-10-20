/**
 * «Registrar operação» on a crypto account (3-4, lane A; board scenario 8 · Binance), with the
 * answers recorded from the real SQL (testing/registrarMercados; invented data) on Sat 17 Oct 2026,
 * 20:35 de Brasília (a window of every day): «Moeda» and «Buscar moeda», «Cotada em» (USDT, USDC,
 * USD, R$) and its note, the coin's quantity, price stops, «Posição de …», R$ → BTC/BRL with a typed
 * result, step 2 with «Custos» and step 3's net.
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
  idsMercados,
  mercadosJson,
  previaMercados,
  recentesMercados,
  saidaMercados,
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

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsMercados()
const SP = 'America/Sao_Paulo'

function agoraAs(iso: string) {
  const json = mercadosJson('agora-binance-sab-2035') as Record<string, unknown>
  json.server_now = iso
  return parseRulesNow(json)
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasMercados())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraMercados('binance-sab-2035'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraMercados('binance-sab-2035').accounts.find((a) => a.accountId === id)!)
})

function abrir(tradeId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.binance} tradeId={tradeId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const pill = (g: string, nome: string) => within(grupo(g)).getByRole('button', { name: nome })
const rotulos = (g: string) => within(grupo(g)).getAllByRole('button').map((b) => b.textContent)
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const linhaDoGate = () => screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement as HTMLElement

async function entrada() {
  abrir()
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
}

/** BTC/USDT short 0,25 @ 112.400, stop 112.800, alvo 111.600 (the board's scenario 8) */
async function btcVenda() {
  await userEvent.click(pill('Lado', 'Venda'))
  await userEvent.type(campo('Quantidade, em BTC'), '0,25')
  await userEvent.type(campo('Preço de entrada, USDT'), '112.400')
  await userEvent.type(campo('Stop'), '112.800')
  await userEvent.type(campo('Alvo'), '111.600')
}

describe('step 1 on Binance, Saturday 20:35 de Brasília', () => {
  it('a window of every day: «Liberado até 22:00 de Brasília», no limit line; «Moeda», «Buscar moeda», «Cotada em»', async () => {
    await entrada()
    expect(linhaDoGate()).toHaveTextContent('Posso operar hoje?Liberadoaté 22:00 de Brasília')
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
    expect(rotulos('Moeda')).toEqual(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'])
    expect(pill('Moeda', 'BTC')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox', { name: 'Buscar moeda' })).toHaveAttribute('placeholder', 'Ex.: AVAX')
    const cotada = grupo('Cotada em')
    expect(rotulos('Cotada em')).toEqual(['USDT', 'USDC', 'USD', 'R$'])
    expect(pill('Cotada em', 'USDT')).toHaveAttribute('aria-pressed', 'true')
    expect(cotada).toHaveAttribute('aria-describedby', 'n-cot')
    expect(document.getElementById('n-cot')).toHaveTextContent('USDT e USDC contam como dólar.')
    // The coin's quantity is a field (8 decimals), never chips
    expect(campo('Quantidade, em BTC')).toHaveValue('')
    expect(screen.queryByRole('group', { name: 'Quantidade, em BTC' })).not.toBeInTheDocument()
    expect(campo('Preço de entrada, USDT')).toHaveValue('')
    expect(campo('Hora (Brasília)')).toHaveValue('20:35')
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
  })

  it('BTC/USDT: the risk in dollars, «Posição de US$ 28.100», the dry run and the entry sent', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('btc'))
    db.registerEntry.mockResolvedValue(entradaMercados('btc'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('btc').state)
    await entrada()
    await btcVenda()
    expect(screen.getByText('risco US$ 100,00 · alvo US$ 200,00 · 1 : 2')).toBeInTheDocument()
    expect(screen.getByText('Posição de US$ 28.100')).toBeInTheDocument()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({
      symbol: 'BTC/USDT', direction: 'short', quantity: '0.25', entry_price: '112400', stop_price: '112800', target_price: '111600', clock: SP,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'BTC/USDT', quantity: '0.25', stop_price: '112800' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
  })

  it('more than 8 decimals in the coin’s quantity is refused, focused', async () => {
    await entrada()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Quantidade, em BTC'), '0,123456789')
    await userEvent.type(campo('Preço de entrada, USDT'), '112.400')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(campo('Quantidade, em BTC')).toHaveFocus()
    expect(screen.getByText('Use até 8 casas decimais.')).toBeInTheDocument()
  })

  it('another quote clears the prices and keeps the quantity; «R$» registers BTC/BRL, the position in reais, no dollar value', async () => {
    db.registerEntry.mockResolvedValue(entradaMercados('btc'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('btc').state)
    await entrada()
    await btcVenda()
    await userEvent.click(pill('Cotada em', 'USDC'))
    expect(pill('Cotada em', 'USDC')).toHaveAttribute('aria-pressed', 'true')
    expect(campo('Preço de entrada, USDC')).toHaveValue('')
    expect(campo('Stop')).toHaveValue('')
    expect(campo('Alvo')).toHaveValue('')
    expect(campo('Quantidade, em BTC')).toHaveValue('0,25')
    await userEvent.click(pill('Cotada em', 'R$'))
    await userEvent.type(campo('Preço de entrada, R$'), '612.000')
    await userEvent.type(campo('Stop'), '614.000')
    await userEvent.type(campo('Alvo'), '608.000')
    expect(screen.getByText('1 : 2 · sem valor em dólar para este ativo')).toBeInTheDocument()
    expect(screen.getByText('Posição de R$ 153.000')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'BTC/BRL', entry_price: '612000', stop_price: '614000', target_price: '608000' })
  })

  it('«R$» in «Já fechada»: the result is typed in dollars, with the funding note', async () => {
    await entrada()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Cotada em', 'R$'))
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Quantidade, em BTC'), '0,25')
    await userEvent.type(campo('Preço de entrada, R$'), '612.000')
    await userEvent.type(campo('Preço de saída, R$'), '611.000')
    expect(screen.getByText('Resultado: +1.000 por BTC · digite o valor em dólar')).toBeInTheDocument()
    expect(campo('Resultado, US$')).toHaveValue('')
    expect(
      screen.getByText('Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão, com swap ou funding, se houver.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Taxas da corretora, em dólar.')).toBeInTheDocument()
  })

  it('«Buscar moeda»: «avax» finds AVAX; «Usar “AVAX/BRL”» chooses the coin and its quote', async () => {
    await entrada()
    const busca = screen.getByRole('searchbox', { name: 'Buscar moeda' })
    await userEvent.type(busca, 'avax')
    expect(within(grupo('Resultados da busca')).getAllByRole('button').map((b) => b.textContent)).toEqual(['AVAX'])
    await userEvent.clear(busca)
    await userEvent.type(busca, 'avax/brl')
    await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: 'Usar “AVAX/BRL”' }))
    await waitFor(() => expect(pill('Moeda', 'AVAX')).toHaveFocus())
    expect(pill('Moeda', 'AVAX')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Cotada em', 'R$')).toHaveAttribute('aria-pressed', 'true')
    expect(campo('Quantidade, em AVAX')).toHaveValue('')
    expect(campo('Preço de entrada, R$')).toBeInTheDocument()
  })

  it('the account’s history: its coins as chips, its last quote', async () => {
    db.fetchRecentTrades.mockResolvedValue(recentesMercados('binance'))
    await entrada()
    expect(rotulos('Moeda')).toEqual(['BTC'])
    expect(pill('Cotada em', 'USDT')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('steps 2 and 3 on Binance (21:02 de Brasília)', () => {
  it('BTC/USDT: «Se sair a 111.950: +450 por BTC · +US$ 112,50», the costs sent, the net on step 3', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-18T00:02:05Z'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('btc').state)
    db.registerExit.mockResolvedValue(saidaMercados('btc'))
    abrir(ids.trades.btc)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const resumo = screen.getByText('BTC/USDT · Venda · 0,25 BTC').parentElement as HTMLElement
    expect(resumo).toHaveTextContent('BTC/USDT · Venda · 0,25 BTC112.400 às 20:35 de Brasíliastop 112.800 · alvo 111.600 · risco US$ 100,00')
    expect(campo('Hora da saída (Brasília)')).toHaveValue('21:02')
    await userEvent.type(campo('Preço de saída, USDT'), '111.950')
    expect(screen.getByText('Se sair a 111.950: +450 por BTC · +US$ 112,50')).toBeInTheDocument()
    expect(screen.getByText('Taxas da corretora, em dólar.')).toHaveAttribute('id', 'n-custos')
    await userEvent.type(campo('Custos, US$ · opcional'), '11,24')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '111950', clock: SP, costs: '11.24' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('+US$ 112,50')).toBeInTheDocument()
    expect(screen.getByText('BTC/USDT · Venda · 0,25 BTC · 112.400 → 111.950 · +450 por BTC · 20:35–21:02 de Brasília')).toBeInTheDocument()
    expect(screen.getByText('Custos US$ 11,24 · líquido +US$ 101,26')).toBeInTheDocument()
    expect(screen.getByText('com stop em 112.800', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Resultado digitado por você.')).not.toBeInTheDocument()
  })

  it('a costs error stays on screen and keeps the exit from being sent', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-18T00:02:05Z'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('btc').state)
    abrir(ids.trades.btc)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(campo('Preço de saída, USDT'), '111.950')
    await userEvent.type(campo('Custos, US$ · opcional'), '11,245')
    expect(screen.getByText('Use até 2 casas decimais.')).toHaveAttribute('role', 'alert')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(campo('Custos, US$ · opcional')).toHaveFocus()
    expect(db.registerExit).not.toHaveBeenCalled()
  })
})

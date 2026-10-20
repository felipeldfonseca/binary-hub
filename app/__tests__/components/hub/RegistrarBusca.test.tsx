/**
 * «Buscar ativo» on a futures account (3-4, lane A; board choice 13), with the answers recorded from
 * the real SQL (testing/registrarMercados; invented data) on Thu 15 Oct 2026, 10:05 ET on Top One:
 * the six chips of 3-3 unchanged, the catalog search and its status, the chosen result as a chip
 * with the focus, CL/MCL computed in points of 0,01, a root outside the table (ZN) with price stops
 * and a typed result (no «Corrigir», no «Custos»), and a series code (MESZ6) computed as its root.
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
import { agoraMercados, contasMercados, entradaMercados, idsMercados, mercadosJson, previaMercados, saidaMercados } from '@/testing/registrarMercados'

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

function agoraAs(iso: string) {
  const json = mercadosJson('agora-top-qui-1005') as Record<string, unknown>
  json.server_now = iso
  return parseRulesNow(json)
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasMercados())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraMercados('top-qui-1005'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraMercados('top-qui-1005').accounts.find((a) => a.accountId === id)!)
})

function abrir(tradeId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.topOne} tradeId={tradeId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const pill = (g: string, nome: string) => within(grupo(g)).getByRole('button', { name: nome })
const rotulos = (g: string) => within(grupo(g)).getAllByRole('button').map((b) => b.textContent)
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const busca = () => screen.getByRole('searchbox', { name: 'Buscar ativo' })
const resultados = () => within(grupo('Resultados da busca')).getAllByRole('button').map((b) => b.textContent)

async function entrada() {
  abrir()
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
}

/** A search result chosen: its chip takes the focus a frame later (wait, or the next keystrokes land on it) */
async function escolher(texto: string, resultado: string) {
  await userEvent.type(busca(), texto)
  await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: resultado }))
  await waitFor(() => expect(pill('Ativo', resultado.replace(/^Usar “(.*)”$/, '$1'))).toHaveFocus())
}
const alertas = () => screen.queryAllByRole('alert').map((a) => a.textContent)

describe('«Buscar ativo» on Top One (10:05 ET)', () => {
  it('under the six chips of 3-3: «mcl» finds MCL, which joins the chips, chosen and focused; the search empties', async () => {
    await entrada()
    expect(rotulos('Ativo')).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'])
    expect(pill('Ativo', 'MES')).toHaveAttribute('aria-pressed', 'true')
    expect(busca()).toHaveAttribute('placeholder', 'Ex.: MCL ou ZN')
    expect(busca()).toHaveAttribute('type', 'search')
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(busca(), 'mcl')
    expect(resultados()).toEqual(['MCL'])
    expect(screen.getByText('1 resultado.')).toHaveAttribute('role', 'status')
    await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: 'MCL' }))
    await waitFor(() => expect(pill('Ativo', 'MCL')).toHaveFocus())
    expect(rotulos('Ativo')).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC', 'MCL'])
    expect(pill('Ativo', 'MCL')).toHaveAttribute('aria-pressed', 'true')
    expect(busca()).toHaveValue('')
    expect(screen.queryByRole('group', { name: 'Resultados da busca' })).not.toBeInTheDocument()
    // Contracts stay contracts: the quantity is kept
    expect(pill('Contratos', '2')).toHaveAttribute('aria-pressed', 'true')
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em pontos · opcional')
  })

  it('«cl» finds MCL and CL in the catalog’s order; nothing found: «Usar “…”» and the status; «@@» is no symbol', async () => {
    await entrada()
    await userEvent.type(busca(), 'cl')
    expect(resultados()).toEqual(['MCL', 'CL'])
    expect(screen.getByText('2 resultados.')).toBeInTheDocument()
    await userEvent.clear(busca())
    await userEvent.type(busca(), 'xpto9')
    expect(resultados()).toEqual(['Usar “XPTO9”'])
    expect(screen.getByText('Nenhum ativo do catálogo com esse código.')).toBeInTheDocument()
    await userEvent.clear(busca())
    await userEvent.type(busca(), '@@')
    expect(screen.queryByRole('group', { name: 'Resultados da busca' })).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhum ativo do catálogo com esse código.')).not.toBeInTheDocument()
  })

  it('CL: computed in points of 0,01; its tick texts; the risk passes what is left of the limit (the dry run)', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('cl'))
    await entrada()
    await escolher('cl', 'CL')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '70,455')
    await userEvent.type(campo('Stop'), '0,505')
    expect(screen.getByText('Use pontos de 0,01 em 0,01 no CL.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(campo('Preço de entrada')).toHaveFocus()
    expect(screen.getByText('O CL anda de 0,01 em 0,01; confira o preço.')).toBeInTheDocument()
    await userEvent.clear(campo('Preço de entrada'))
    await userEvent.type(campo('Preço de entrada'), '70,45')
    await userEvent.clear(campo('Stop'))
    await userEvent.type(campo('Stop'), '0,50')
    await userEvent.type(campo('Alvo'), '1')
    expect(screen.getByText('risco US$ 500,00 · alvo US$ 1.000,00 · 1 : 2')).toBeInTheDocument()
    expect(await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 400 e o stop arrisca US$ 500.')).toBeInTheDocument()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({ symbol: 'CL', quantity: '1', entry_price: '70.45', stop_pts: '0.5', target_pts: '1' })
  })

  it('ZNZ6 (outside the table) through «Usar»: price stops, no dollar value, the entry sent in price', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('zn'))
    db.registerEntry.mockResolvedValue(entradaMercados('zn'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('zn').state)
    await entrada()
    await escolher('znz6', 'Usar “ZNZ6”')
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '112,5')
    await userEvent.type(campo('Stop'), '112')
    expect(screen.getByText('Sem valor em dólar para este ativo.')).toBeInTheDocument()
    await userEvent.type(campo('Alvo'), '113,25')
    expect(screen.getByText('1 : 1,5 · sem valor em dólar para este ativo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const payload = db.registerEntry.mock.calls[0][2]
    expect(payload).toMatchObject({ symbol: 'ZNZ6', entry_price: '112.5', stop_price: '112', target_price: '113.25' })
    expect(payload).not.toHaveProperty('stop_pts')
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
  })

  it('ZN in «Já fechada»: «Resultado, US$» without the funding phrase, no «Corrigir», no «Custos»', async () => {
    await entrada()
    await userEvent.click(screen.getByRole('button', { name: 'Já fechada' }))
    await escolher('zn', 'ZN')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '112,5')
    await userEvent.clear(campo('Hora da entrada (ET)'))
    await userEvent.type(campo('Hora da entrada (ET)'), '10:00')
    await userEvent.type(campo('Preço de saída'), '112,75')
    await userEvent.clear(campo('Hora da saída (ET)'))
    await userEvent.type(campo('Hora da saída (ET)'), '10:04')
    expect(screen.getByText('Resultado: +0,25 no preço · digite o valor em dólar')).toBeInTheDocument()
    expect(screen.getByText('Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Custos/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(campo('Resultado, US$')).toHaveFocus()
    expect(screen.getByText('Informe o resultado.')).toBeInTheDocument()
  })

  it('another instrument in «Já fechada» keeps the exit hour typed (3-3 and RO `limpar`); the exit price clears', async () => {
    await entrada()
    await userEvent.click(screen.getByRole('button', { name: 'Já fechada' }))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.clear(campo('Hora da entrada (ET)'))
    await userEvent.type(campo('Hora da entrada (ET)'), '10:00')
    await userEvent.type(campo('Preço de saída'), '6652,25')
    await userEvent.clear(campo('Hora da saída (ET)'))
    await userEvent.type(campo('Hora da saída (ET)'), '10:04')
    await userEvent.click(pill('Ativo', 'ES'))
    expect(campo('Preço de saída')).toHaveValue('')
    expect(campo('Hora da saída (ET)')).toHaveValue('10:04')
    await escolher('mcl', 'MCL')
    expect(campo('Hora da saída (ET)')).toHaveValue('10:04')
    expect(campo('Hora da entrada (ET)')).toHaveValue('10:00')
  })

  it('another instrument after a refused «Registrar entrada»: the errors it turned on go quiet (RO `limpar`)', async () => {
    await entrada()
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(alertas()).toEqual(['Informe o preço de entrada.'])
    await userEvent.click(pill('Ativo', 'NQ'))
    expect(alertas()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(alertas()).toEqual(['Informe o preço de entrada.'])
    await escolher('zn', 'ZN')
    expect(alertas()).toEqual([])
    expect(campo('Preço de entrada')).not.toHaveAttribute('aria-invalid')
  })

  it('«Usar “MESZ6”» registers the series code, computed as MES (points, its tick, the risk)', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('mesz6'))
    await entrada()
    await escolher('mesz6', 'Usar “MESZ6”')
    expect(pill('Ativo', 'MESZ6')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(campo('Preço de entrada'), '6650,30')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    // The root names the tick
    expect(screen.getByText('O MES anda de 0,25 em 0,25; confira o preço.')).toBeInTheDocument()
    await userEvent.clear(campo('Preço de entrada'))
    await userEvent.type(campo('Preço de entrada'), '6650,25')
    await userEvent.type(campo('Stop'), '10')
    await userEvent.type(campo('Alvo'), '20')
    expect(screen.getByText('risco US$ 100,00 · alvo US$ 200,00 · 1 : 2')).toBeInTheDocument()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({ symbol: 'MESZ6', quantity: '2', stop_pts: '10', target_pts: '20' })
  })
})

describe('ZN’s exit (10:20 ET): the typed result on step 2, step 3 says so', () => {
  it('requires «Resultado, US$», sends it, and the card shows the typed base', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-15T14:20:05Z'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('zn').state)
    db.registerExit.mockResolvedValue(saidaMercados('zn'))
    abrir(ids.trades.zn)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('ZNZ6 · Compra · 1 ct').parentElement).toHaveTextContent('112,50 às 10:05 ETstop 112,00 · alvo 113,25')
    await userEvent.type(campo('Preço de saída'), '112,75')
    expect(screen.getByText('Se sair a 112,75: +0,25 no preço · digite o valor em dólar')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Custos/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(campo('Resultado, US$')).toHaveFocus()
    expect(db.registerExit).not.toHaveBeenCalled()
    await userEvent.type(campo('Resultado, US$'), '250')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '112.75', clock: NY, pnl: '250' })
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('+US$ 250,00')).toBeInTheDocument()
    expect(screen.getByText('ZNZ6 · Compra · 1 ct · 112,50 → 112,75 · +0,25 no preço · 10:05–10:20 ET')).toBeInTheDocument()
    expect(screen.getByText('Resultado digitado por você.')).toBeInTheDocument()
    expect(screen.getByText('com stop em 112,00', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(/^Custos /)).not.toBeInTheDocument()
  })
})

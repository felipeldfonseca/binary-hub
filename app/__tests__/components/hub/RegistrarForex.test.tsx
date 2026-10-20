/**
 * «Registrar operação» on a Forex account (3-4, lane A; board scenario 6 · FTMO), with the answers
 * recorded from the real SQL (testing/registrarMercados; invented data) on Thu 15 Oct 2026: the gate
 * and the limit at 08:40 ET, «Par» chips and «Buscar par», lots, pips and price stops, the computed
 * (EUR/USD), estimated (USD/JPY) and typed (EUR/GBP, XAUUSD) results with «Corrigir» and «Custos»,
 * steps 2 and 3, and the payloads sent.
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
const NY = 'America/New_York'

/** rules_now of 08:40 ET as if the server had answered it at `iso` */
function agoraAs(iso: string) {
  const json = mercadosJson('agora-ftmo-qui-0840') as Record<string, unknown>
  json.server_now = iso
  return parseRulesNow(json)
}
const ftmoAgora = () => agoraMercados('ftmo-qui-0840').accounts.find((a) => a.accountId === ids.accounts.ftmo)!

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasMercados())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraMercados('ftmo-qui-0840'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  // A fresh account: the board's examples (EUR/USD first, 0,01 lote)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async () => ftmoAgora())
})

function abrir(tradeId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.ftmo} tradeId={tradeId} onClose={jest.fn()} />
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

async function entrada() {
  abrir()
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
}

describe('step 1 on FTMO at 08:40 ET', () => {
  it('the gate, the limit, «Par» with «Buscar par», lots and pips', async () => {
    await entrada()
    expect(linhaDoGate()).toHaveTextContent('Posso operar hoje?Liberadoaté 10:00 ET')
    expect(screen.getByText('Limite do dia').parentElement).toHaveTextContent('Limite do diaUS$ 0de US$ 1.000')
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }))
    expect(screen.getByText(/^Calculado pelas regras desta conta, na hora da entrada: janela e limite do dia\. Ele nunca/)).toBeInTheDocument()
    expect(rotulos('Par')).toEqual(['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD'])
    expect(pill('Par', 'EUR/USD')).toHaveAttribute('aria-pressed', 'true')
    const busca = screen.getByRole('searchbox', { name: 'Buscar par' })
    expect(busca).toHaveAttribute('placeholder', 'Ex.: USD/CHF ou XAUUSD')
    expect(busca).toHaveAttribute('autocomplete', 'off')
    expect(busca).toHaveValue('')
    expect(rotulos('Lotes')).toEqual(['0,01', '0,10', '0,50', '1,00', 'Outro'])
    expect(pill('Lotes', '0,01')).toHaveAttribute('aria-pressed', 'true')
    expect(campo('Preço de entrada')).toHaveValue('')
    expect(campo('Hora (ET)')).toHaveValue('08:40')
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em pips · opcional')
    expect(screen.getByText('Sem stop e alvo, o R não é calculado.')).toBeInTheDocument()
  })

  it('«Outro» lots: «Quantos lotes?» takes the focus; two decimals at most', async () => {
    await entrada()
    await userEvent.click(pill('Lotes', 'Outro'))
    await waitFor(() => expect(campo('Quantos lotes?')).toHaveFocus())
    await userEvent.type(campo('Quantos lotes?'), '0,255')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(campo('Quantos lotes?')).toHaveFocus()
    expect(campo('Quantos lotes?')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Use até 2 casas decimais.')).toHaveAttribute('role', 'alert')
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('EUR/USD in pips: «risco US$ 60,00 · alvo US$ 120,00 · 1 : 2», the dry run and the entry sent', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('eurusd'))
    db.registerEntry.mockResolvedValue(entradaMercados('eurusd'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('eurusd').state)
    await entrada()
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Lotes', '0,50'))
    // A single dot is the decimal mark on forex: «1.08520» = 1,0852
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await userEvent.type(campo('Stop'), '12')
    await userEvent.type(campo('Alvo'), '24')
    expect(screen.getByText('risco US$ 60,00 · alvo US$ 120,00 · 1 : 2')).toBeInTheDocument()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({
      symbol: 'EUR/USD', direction: 'long', quantity: '0.5', entry_price: '1.0852', stop_pips: '12', target_pips: '24', clock: NY, entry: '08:40',
    })
    expect(screen.queryByText('fora da janela')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const [, accountId, payload] = db.registerEntry.mock.calls[0]
    expect(accountId).toBe(ids.accounts.ftmo)
    expect(payload).toMatchObject({ symbol: 'EUR/USD', quantity: '0.5', entry_price: '1.0852', stop_pips: '12', target_pips: '24' })
    expect(payload).not.toHaveProperty('entry')
    expect(payload).not.toHaveProperty('stop_pts')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toHaveFocus()
  })

  it('a 300-pip stop passes what is left of the limit: the warning, never a block', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('eurusd-acima'))
    await entrada()
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Lotes', '0,50'))
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await userEvent.type(campo('Stop'), '300')
    const aviso = await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 1.000 e o stop arrisca US$ 1.500.')
    expect(aviso).toHaveAttribute('role', 'status')
    expect(campo('Stop')).toHaveAttribute('aria-describedby', 'n-risco a-lim')
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).not.toHaveAttribute('aria-disabled')
  })

  it('USD/JPY: an estimate, «≈» on the risk and on the warning', async () => {
    await entrada()
    await userEvent.click(pill('Par', 'USD/JPY'))
    expect(pill('Par', 'USD/JPY')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Lotes', 'Outro'))
    await userEvent.type(campo('Quantos lotes?'), '0,30')
    await userEvent.type(campo('Preço de entrada'), '151.240')
    await userEvent.type(campo('Stop'), '20')
    await userEvent.type(campo('Alvo'), '40')
    expect(screen.getByText('risco ≈ US$ 39,62 · alvo ≈ US$ 79,55 · 1 : 2')).toBeInTheDocument()
    await digitar('Stop', '3500')
    expect(await screen.findByText(/^Se o stop for atingido, o dia passa do limite: faltam US\$ 1\.000 e o stop arrisca ≈ US\$ /)).toBeInTheDocument()
  })

  it('EUR/GBP (typed): the risk in pips only', async () => {
    await entrada()
    await userEvent.click(pill('Par', 'EUR/GBP'))
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Preço de entrada'), '0.87120')
    await userEvent.type(campo('Stop'), '10')
    await userEvent.type(campo('Alvo'), '20')
    expect(screen.getByText('risco 10 pips · alvo 20 pips · 1 : 2')).toBeInTheDocument()
  })

  it('XAUUSD through «Usar “XAUUSD”»: the chip is added, chosen and focused; price stops without a dollar value', async () => {
    await entrada()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar par' }), 'xauusd')
    const resultados = grupo('Resultados da busca')
    expect(within(resultados).getAllByRole('button').map((b) => b.textContent)).toEqual(['Usar “XAUUSD”'])
    expect(screen.getByText('Nenhum ativo do catálogo com esse código.')).toHaveAttribute('role', 'status')
    await userEvent.click(within(resultados).getByRole('button', { name: 'Usar “XAUUSD”' }))
    await waitFor(() => expect(pill('Par', 'XAUUSD')).toHaveFocus())
    expect(pill('Par', 'XAUUSD')).toHaveAttribute('aria-pressed', 'true')
    expect(rotulos('Par')).toEqual(['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD', 'XAUUSD'])
    expect(screen.getByRole('searchbox', { name: 'Buscar par' })).toHaveValue('')
    expect(screen.queryByRole('group', { name: 'Resultados da busca' })).not.toBeInTheDocument()
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Preço de entrada'), '4.409,80')
    await userEvent.type(campo('Stop'), '4.413,30')
    expect(screen.getByText('Sem valor em dólar para este ativo.')).toBeInTheDocument()
    await userEvent.type(campo('Alvo'), '4.400,30')
    expect(screen.getByText('1 : 2,71 · sem valor em dólar para este ativo')).toBeInTheDocument()
    // The side of a price stop is checked before sending (the server would refuse it)
    await digitar('Stop', '4.400')
    expect(screen.getByText('Numa venda, o stop fica acima do preço de entrada.')).toHaveAttribute('role', 'alert')
    expect(campo('Stop')).toHaveAttribute('aria-invalid', 'true')
  })

  it('the search finds a pair without its slash, and a pair of the catalog is chosen as a chip', async () => {
    await entrada()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar par' }), 'usdchf')
    expect(within(grupo('Resultados da busca')).getAllByRole('button').map((b) => b.textContent)).toEqual(['USD/CHF'])
    expect(screen.getByText('1 resultado.')).toBeInTheDocument()
    await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: 'USD/CHF' }))
    await waitFor(() => expect(pill('Par', 'USD/CHF')).toHaveFocus())
    expect(screen.getByRole('searchbox', { name: 'Buscar par' })).toHaveValue('')
    expect(screen.queryByText('1 resultado.')).not.toBeInTheDocument()
  })
})

describe('«Já fechada» on FTMO (09:01 ET)', () => {
  beforeEach(() => {
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-15T13:01:05Z'))
  })

  async function fechada(par: string, lado: 'Compra' | 'Venda') {
    await entrada()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    if (par !== 'EUR/USD') await userEvent.click(pill('Par', par))
    await userEvent.click(pill('Lado', lado))
    await digitar('Hora da entrada (ET)', '08:40')
  }

  it('EUR/USD: the computed result, «Corrigir» ↔ «Usar o calculado», «Custos» and the payload', async () => {
    const after = fechadaMercados('xauusd')
    db.registerAfter.mockResolvedValue(after)
    db.fetchTradeState.mockResolvedValue(after.state)
    await fechada('EUR/USD', 'Compra')
    await userEvent.click(pill('Lotes', '0,50'))
    expect(screen.getByText('Resultado: preencha os dois preços.')).toBeInTheDocument()
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await userEvent.type(campo('Preço de saída'), '1.08635')
    expect(campo('Hora da saída (ET)')).toHaveValue('09:01')
    const linha = screen.getByText('Resultado: +11,5 pips · +US$ 57,50')
    expect(linha).toHaveAttribute('role', 'status')
    expect(screen.queryByLabelText(/^Resultado/)).not.toBeInTheDocument()
    // «Custos, US$ · opcional» with forex's note
    const custos = campo('Custos, US$ · opcional')
    expect(custos).toHaveAttribute('aria-describedby', 'n-custos')
    expect(screen.getByText('Comissão por lote da sua conta, ida e volta.')).toHaveAttribute('id', 'n-custos')
    // «Corrigir»: the computed value in the field, focused
    const corrigir = screen.getByRole('button', { name: 'Corrigir' })
    expect(corrigir).toHaveAttribute('aria-expanded', 'false')
    expect(corrigir).toHaveAttribute('aria-controls', 'caixa-res')
    await userEvent.click(corrigir)
    const res = campo('Resultado na sua plataforma, US$')
    await waitFor(() => expect(res).toHaveFocus())
    expect(res).toHaveValue('57,50')
    expect(document.getElementById('caixa-res')).toContainElement(res)
    expect(screen.getByText('Antes da comissão, com swap ou funding, se houver.')).toHaveAttribute('id', 'n-res')
    const usar = screen.getByRole('button', { name: 'Usar o calculado' })
    expect(usar).toHaveAttribute('aria-expanded', 'true')
    await digitar('Resultado na sua plataforma, US$', '−55,10')
    // Costs: always checked, before a tap
    await userEvent.type(custos, '7,001')
    expect(screen.getByText('Use até 2 casas decimais.')).toHaveAttribute('role', 'alert')
    expect(custos).toHaveAttribute('aria-describedby', 'n-custos e-custos')
    await digitar('Custos, US$ · opcional', '3,50')
    expect(screen.queryByText('Use até 2 casas decimais.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({
      symbol: 'EUR/USD', quantity: '0.5', entry_price: '1.0852', exit_price: '1.08635', entry: '08:40', exit: '09:01', day: '2026-10-15', pnl: '-55.1', costs: '3.5',
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
  })

  it('«Usar o calculado» discards the correction: nothing typed is sent', async () => {
    db.registerAfter.mockResolvedValue(fechadaMercados('xauusd'))
    await fechada('EUR/USD', 'Compra')
    await userEvent.type(campo('Preço de entrada'), '1.08520')
    await userEvent.type(campo('Preço de saída'), '1.08635')
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir' }))
    await digitar('Resultado na sua plataforma, US$', '50')
    await userEvent.click(screen.getByRole('button', { name: 'Usar o calculado' }))
    expect(screen.queryByLabelText('Resultado na sua plataforma, US$')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Corrigir' })).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).not.toHaveProperty('pnl')
    expect(db.registerAfter.mock.calls[0][2]).not.toHaveProperty('costs')
  })

  it('USD/JPY: «≈» on the result and the estimate note until it is corrected', async () => {
    await fechada('USD/JPY', 'Venda')
    await userEvent.click(pill('Lotes', 'Outro'))
    await userEvent.type(campo('Quantos lotes?'), '0,30')
    await userEvent.type(campo('Preço de entrada'), '151.240')
    await userEvent.type(campo('Preço de saída'), '150.980')
    expect(screen.getByText('Resultado: +26,0 pips · ≈ +US$ 51,66')).toBeInTheDocument()
    const nota =
      'Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.'
    expect(screen.getByText(nota)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir' }))
    expect(screen.queryByText(nota)).not.toBeInTheDocument()
    expect(campo('Resultado na sua plataforma, US$')).toHaveValue('51,66')
  })

  it('EUR/GBP: «digite o valor em dólar», the required «Resultado, US$» and its focus', async () => {
    db.registerAfter.mockResolvedValue(fechadaMercados('xauusd'))
    await fechada('EUR/GBP', 'Venda')
    await userEvent.type(campo('Preço de entrada'), '0.87120')
    await userEvent.type(campo('Preço de saída'), '0.87030')
    expect(screen.getByText('Resultado: +9,0 pips · digite o valor em dólar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(
      screen.getByText('Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão, com swap ou funding, se houver.'),
    ).toHaveAttribute('id', 'n-res')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    const res = campo('Resultado, US$')
    expect(res).toHaveFocus()
    expect(res).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Informe o resultado.')).toHaveAttribute('role', 'alert')
    expect(db.registerAfter).not.toHaveBeenCalled()
    await userEvent.type(res, '58,60')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({ symbol: 'EUR/GBP', direction: 'short', entry_price: '0.8712', exit_price: '0.8703', pnl: '58.6' })
  })

  it('XAUUSD +105 typed with costs 7: step 3 says it was typed, the costs and the net', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaMercados('xauusd'))
    const after = fechadaMercados('xauusd')
    db.registerAfter.mockResolvedValue(after)
    db.fetchTradeState.mockResolvedValue(after.state)
    await entrada()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar par' }), 'XAUUSD')
    await userEvent.click(screen.getByRole('button', { name: 'Usar “XAUUSD”' }))
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Lotes', 'Outro'))
    await userEvent.type(campo('Quantos lotes?'), '0,20')
    await userEvent.type(campo('Preço de entrada'), '4.409,80')
    await digitar('Hora da entrada (ET)', '08:45')
    await userEvent.type(campo('Preço de saída'), '4.404,55')
    await digitar('Hora da saída (ET)', '08:58')
    await userEvent.type(campo('Stop'), '4.413,30')
    await userEvent.type(campo('Alvo'), '4.400,30')
    expect(screen.getByText('Resultado: +5,25 no preço · digite o valor em dólar')).toBeInTheDocument()
    await userEvent.type(campo('Resultado, US$'), '105')
    await userEvent.type(campo('Custos, US$ · opcional'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({
      symbol: 'XAUUSD', direction: 'short', quantity: '0.2', entry_price: '4409.8', exit_price: '4404.55', stop_price: '4413.3', target_price: '4400.3',
      entry: '08:45', exit: '08:58', pnl: '105', costs: '7',
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('+US$ 105,00')).toBeInTheDocument()
    expect(screen.getByText('XAUUSD · Venda · 0,20 lote · 4.409,80 → 4.404,55 · +5,25 no preço · 08:45–08:58 ET')).toBeInTheDocument()
    expect(screen.getByText('Resultado digitado por você.')).toBeInTheDocument()
    expect(screen.getByText('Custos US$ 7,00 · líquido +US$ 98,00')).toBeInTheDocument()
    expect(screen.getByText('com stop em 4.413,30', { exact: false })).toBeInTheDocument()
  })
})

describe('steps 2 and 3 on FTMO (09:01 ET)', () => {
  beforeEach(() => {
    fetchRulesNow.mockResolvedValue(agoraAs('2026-10-15T13:01:05Z'))
  })

  it('EUR/USD open: the summary, «Se sair a 1,08635: +11,5 pips · +US$ 57,50», the exit sent, the card', async () => {
    db.fetchTradeState.mockResolvedValue(entradaMercados('eurusd').state)
    db.registerExit.mockResolvedValue(saidaMercados('eurusd'))
    abrir(ids.trades.eurusd)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const resumo = screen.getByText('EUR/USD · Compra · 0,50 lote').parentElement as HTMLElement
    expect(resumo).toHaveTextContent('EUR/USD · Compra · 0,50 lote1,08520 às 08:40 ETstop 12 · alvo 24 pips · risco US$ 60,00')
    expect(screen.getByText('Resultado: informe o preço de saída.')).toBeInTheDocument()
    expect(campo('Hora da saída (ET)')).toHaveValue('09:01')
    await userEvent.type(campo('Preço de saída'), '1,08635')
    expect(screen.getByText('Se sair a 1,08635: +11,5 pips · +US$ 57,50')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Corrigir' })).toBeInTheDocument()
    expect(screen.getByText('Comissão por lote da sua conta, ida e volta.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    const [, tradeId, payload] = db.registerExit.mock.calls[0]
    expect(tradeId).toBe(ids.trades.eurusd)
    expect(payload).toEqual({ v: 1, exit_price: '1.08635', clock: NY })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('+US$ 57,50')).toBeInTheDocument()
    expect(screen.getByText('EUR/USD · Compra · 0,50 lote · 1,08520 → 1,08635 · +11,5 pips · 08:40–09:01 ET')).toBeInTheDocument()
    expect(screen.getByText('+0,96 R')).toBeInTheDocument()
    expect(screen.getByText('com stop de 12 pips', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Resultado digitado por você.')).not.toBeInTheDocument()
  })

  it('USD/JPY corrected with costs: the payload, and step 3 says it was typed, with the net', async () => {
    db.fetchTradeState.mockResolvedValue(entradaMercados('usdjpy-corrigida').state)
    db.registerExit.mockResolvedValue(saidaMercados('usdjpy-corrigida'))
    abrir(ids.trades.usdjpyCorrigida)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('USD/JPY · Venda · 0,30 lote').parentElement).toHaveTextContent('stop 20 · alvo 40 pips · risco ≈ US$ 39,62')
    await userEvent.type(campo('Preço de saída'), '150,980')
    expect(screen.getByText('Se sair a 150,980: +26,0 pips · ≈ +US$ 51,66')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir' }))
    await waitFor(() => expect(campo('Resultado na sua plataforma, US$')).toHaveFocus())
    expect(campo('Resultado na sua plataforma, US$')).toHaveValue('51,66')
    await digitar('Resultado na sua plataforma, US$', '50,10')
    await userEvent.type(campo('Custos, US$ · opcional'), '2,10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '150.98', clock: NY, pnl: '50.1', costs: '2.1' })
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('+US$ 50,10')).toBeInTheDocument()
    expect(screen.getByText('Resultado digitado por você.')).toBeInTheDocument()
    expect(screen.getByText('Custos US$ 2,10 · líquido +US$ 48,00')).toBeInTheDocument()
  })

  it('USD/JPY as computed: step 3 says the value is an estimate', async () => {
    db.fetchTradeState.mockResolvedValue(entradaMercados('usdjpy').state)
    db.registerExit.mockResolvedValue(saidaMercados('usdjpy'))
    abrir(ids.trades.usdjpy)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(campo('Preço de saída'), '150,980')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('Valor estimado pela cotação de saída; confira com a sua corretora.')).toBeInTheDocument()
    expect(screen.queryByText(/^Custos /)).not.toBeInTheDocument()
  })

  it('EUR/GBP open (typed): «Resultado, US$» is required on the exit, then sent', async () => {
    db.fetchTradeState.mockResolvedValue(entradaMercados('eurgbp').state)
    db.registerExit.mockResolvedValue(saidaMercados('eurusd'))
    abrir(ids.trades.eurgbp)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('EUR/GBP · Venda · 0,50 lote').parentElement).toHaveTextContent('stop 10 · alvo 20 pips')
    await userEvent.type(campo('Preço de saída'), '0,87030')
    expect(screen.getByText('Se sair a 0,87030: +9,0 pips · digite o valor em dólar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(campo('Resultado, US$')).toHaveFocus()
    expect(screen.getByText('Informe o resultado.')).toBeInTheDocument()
    expect(db.registerExit).not.toHaveBeenCalled()
    await userEvent.type(campo('Resultado, US$'), '58,60')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, exit_price: '0.8703', clock: NY, pnl: '58.6' })
  })
})

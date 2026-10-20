/**
 * «Registrar operação» step 1 (PR 3-3, lane A): «Entrada» / «Entrada e saída» for Futures and
 * Ebinex, at the recorded instants of the owner's day (testing/registrarTelas; invented data): the
 * gate line («Às 11:05 aparece "Fora da sua janela"»), the limit line and the stop-above-limit
 * warning (his example: US$ 400, US$ 300 lost, a stop of about US$ 120), the fields and their errors
 * in the board's order, Ebinex's 1/5/15 min and «Vence às», the payloads sent.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import { parseRulesNow } from '@/lib/hub/regras'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import {
  agoraTelas,
  contasTelas,
  entradaTelas,
  fechadaPreviaTelas,
  idsTelas,
  operacaoTelas,
  previaTelas,
  recentesTelas,
  saidaTelas,
  telasJson,
  type TelasAgora,
} from '@/testing/registrarTelas'

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
const ids = idsTelas()
let online = true

type Json = Record<string, any>

/** A recorded rules_now answer, edited, as if the server had answered it at `serverNow` */
function agoraEditado(name: TelasAgora, edit: (json: Json) => void = () => undefined) {
  const json = telasJson(name) as Json
  edit(json)
  return parseRulesNow(json)
}

beforeAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
})

beforeEach(() => {
  jest.clearAllMocks()
  online = true
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasTelas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1031-et'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockImplementation(async (_db, id) => recentesTelas(id === ids.accounts.ebinex ? 'recentes-ebinex' : 'recentes-top-one'))
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  // A dry run that answers nothing useful unless a test says otherwise
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraTelas('agora-qui-1031-et').accounts.find((a) => a.accountId === id)!)
})

afterEach(() => {
  jest.useRealTimers()
})

function abrir(accountId: string = ids.accounts.topOne) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={null} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...view, onClose, queryClient }
}

const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
const linhaDoGate = () => screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement as HTMLElement

describe('«Posso operar hoje?» on step 1', () => {
  it('the owner’s test: at 11:05 ET, «Fora da sua janela · 10:00–11:00 ET» and «● fora da janela», before registering', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qua-1105-et'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const linha = linhaDoGate()
    expect(linha).toHaveTextContent('Posso operar hoje?Fora da sua janela· 10:00–11:00 ET')
    expect(within(linha).getByText('Fora da sua janela').tagName).toBe('B')
    expect(screen.getByText('fora da janela')).toBeInTheDocument()
    expect(screen.getByText('Fora do plano, conferido pelo hub. Você pode registrar.')).toBeInTheDocument()
    // «Hora (ET)» starts on the server's minute
    expect(screen.getByLabelText('Hora (ET)')).toHaveValue('11:05')
    // Nothing was registered or asked of gate_at: the cached rules_now answers the current minute
    expect(db.registerEntry).not.toHaveBeenCalled()
    expect(db.fetchGateAt).not.toHaveBeenCalled()
    // The ⓘ (v57)
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }))
    expect(screen.getByText(/o bloqueio de dados fica ativo na Fase 5/)).toBeInTheDocument()
  })

  it('at 10:31 ET: «Liberado até 11:00 ET» and «Limite do dia US$ 245 de US$ 400», no plan line', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(linhaDoGate()).toHaveTextContent('Posso operar hoje?Liberadoaté 11:00 ET')
    const limite = screen.getByText('Limite do dia').parentElement as HTMLElement
    expect(limite).toHaveTextContent('Limite do diaUS$ 245de US$ 400')
    expect(screen.queryByText('Fora do plano, conferido pelo hub. Você pode registrar.')).not.toBeInTheDocument()
    expect(screen.getByText('Conta').parentElement).toHaveTextContent('Janela 10:00–11:00 ET')
  })

  it('a typed hour: «Posso operar hoje? Na entrada:» from gate_at at that instant', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const hora = screen.getByLabelText('Hora (ET)')
    await userEvent.clear(hora)
    await userEvent.type(hora, '10:20')
    await waitFor(() => expect(db.fetchGateAt).toHaveBeenCalled())
    const at = db.fetchGateAt.mock.calls[db.fetchGateAt.mock.calls.length - 1][2] as Date
    expect(at.toISOString()).toBe('2026-10-22T14:20:00.000Z')
    expect(db.fetchGateAt.mock.calls[0][1]).toBe(ids.accounts.topOne)
    await waitFor(() => expect(linhaDoGate()).toHaveTextContent('Posso operar hoje? Na entrada:'))
    // At the entry it is not «até 11:00 ET» (only the current minute says when it ends)
    expect(linhaDoGate()).toHaveTextContent('Na entrada:Liberado')
    expect(linhaDoGate()).not.toHaveTextContent('até')
  })

  it('«Já fechada» on «Ontem»: «Posso operar hoje? Na entrada, em 21 out:»', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    expect(screen.getByRole('heading', { level: 3, name: 'Entrada e saída' })).toBeInTheDocument()
    expect(screen.getByText('Passo 1 de 2 · Entrada e saída')).toBeInTheDocument()
    await userEvent.click(pill('Dia', 'Ontem'))
    await waitFor(() => expect(linhaDoGate()).toHaveTextContent('Posso operar hoje? Na entrada, em 21 out:'))
    await waitFor(() => expect(db.fetchGateAt).toHaveBeenCalled())
    const at = db.fetchGateAt.mock.calls[db.fetchGateAt.mock.calls.length - 1][2] as Date
    expect(at.toISOString()).toBe('2026-10-21T14:31:00.000Z')
  })

  it('a day before «desde»: the before_rules text, and no gate, limit or plan (board choice 11)', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    const dia = screen.getByLabelText('Outro dia')
    expect(dia).toHaveAttribute('max', '2026-10-22')
    fireEvent.change(dia, { target: { value: '2026-10-13' } })
    expect(await screen.findByText('Antes de 14 out esta conta não tinha regras: essas operações entram pelo arquivo da corretora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Como ler: Posso operar hoje?' })).not.toBeInTheDocument()
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
    expect(screen.queryByText('Fora do plano, conferido pelo hub. Você pode registrar.')).not.toBeInTheDocument()
  })
})

describe('the stop above what is left of the day’s limit (a warning, never a block)', () => {
  it('ES 1 ct, stop 4: the dry run’s limit_room says «faltam US$ 155 e o stop arrisca US$ 200»', async () => {
    db.previewEntry.mockImplementation(async (_db, _id, p) => previaTelas(p.symbol === 'ES' ? 'entry-dry-es-acima' : 'entry-dry-mes-digitada'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'ES'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '1'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7.912,25')
    await userEvent.type(screen.getByLabelText('Stop'), '4')
    const aviso = await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 155 e o stop arrisca US$ 200.')
    expect(aviso).toHaveAttribute('role', 'status')
    expect(screen.getByText('risco US$ 200,00')).toBeInTheDocument()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    // «Registrar entrada» stays available
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).not.toHaveAttribute('aria-disabled')
  })

  it('MES 2 ct, stop 10 (US$ 100 of the US$ 155 left): no warning; the region stays, empty', async () => {
    db.previewEntry.mockResolvedValue(previaTelas('entry-dry-mes-digitada'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'MES'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7912,50')
    await userEvent.type(screen.getByLabelText('Stop'), '10')
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(screen.getByText('risco US$ 100,00')).toBeInTheDocument()
    expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument()
    const regiao = document.getElementById('a-lim') as HTMLElement
    expect(regiao).toHaveAttribute('role', 'status')
    expect(regiao).toBeEmptyDOMElement()
  })

  it('his example (US$ 400 limit, US$ 300 lost): ES stop 2,5 warns, stop 2 (equal) does not; MES 2 ct × 12 warns', async () => {
    fetchRulesNow.mockResolvedValue(
      agoraEditado('agora-qui-1031-et', (json) => {
        const top = json.accounts[0]
        top.limit = { ...top.limit, net_usd: -300, worst_usd: -300, used: 0.75 }
        top.today = { trades: 2, net_usd: -300, worst_usd: -300 }
      }),
    )
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.getByText('Limite do dia').parentElement).toHaveTextContent('US$ 300de US$ 400')
    await userEvent.click(pill('Ativo', 'ES'))
    await userEvent.click(pill('Contratos', '1'))
    const stop = screen.getByLabelText('Stop')
    await userEvent.type(stop, '2,5')
    expect(await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 125.')).toBeInTheDocument()
    expect(stop).toHaveAccessibleDescription(/risco US\$\s125,00.*Se o stop for atingido/)
    await userEvent.clear(stop)
    await userEvent.type(stop, '2')
    await waitFor(() => expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument())
    await userEvent.click(pill('Ativo', 'MES'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(screen.getByLabelText('Stop'), '12')
    expect(await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 120.')).toBeInTheDocument()
    // «Já fechada»: the result is known, no warning
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument()
  })

  it('never on the owner’s Ebinex (no limit), whatever the stake', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const stake = screen.getByLabelText('Stake, US$')
    await userEvent.clear(stake)
    await userEvent.type(stake, '5000')
    expect(screen.getByText('Se acertar: +US$ 4.350,00 · se errar: −US$ 5.000,00')).toBeInTheDocument()
    expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument()
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
  })
})

describe('the futures fields', () => {
  it('start from the account’s history: MGC and 1 contract preselected, prices empty, no side', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(within(screen.getByRole('group', { name: 'Ativo' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'])
    expect(pill('Ativo', 'MGC')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Contratos', '1')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Lado', 'Compra')).toHaveAttribute('aria-pressed', 'false')
    expect(pill('Lado', 'Venda')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Preço de entrada')).toHaveValue('')
    expect(screen.getByText('Sem stop e alvo, o R não é calculado.')).toBeInTheDocument()
    expect(screen.queryByText('Buscar ativo')).not.toBeInTheDocument()
  })

  it('refuse in the board’s order and put the focus on the first refused field', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('Escolha Compra ou Venda.')).toBeInTheDocument()
    expect(screen.getByText('Informe o preço de entrada.')).toBeInTheDocument()
    expect(pill('Lado', 'Compra')).toHaveFocus()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,35')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('O MGC anda de 0,10 em 0,10; confira o preço.')).toBeInTheDocument()
    expect(screen.getByLabelText('Preço de entrada')).toHaveFocus()
    expect(screen.getByLabelText('Preço de entrada')).toHaveAttribute('aria-invalid', 'true')
    // Stop and target say their errors as they are typed (v57)
    await userEvent.type(screen.getByLabelText('Stop'), '1,05')
    expect(screen.getByText('Use pontos de 0,10 em 0,10 no MGC.')).toBeInTheDocument()
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('a typed hour more than 15 minutes back, or ahead of now', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,30')
    const hora = screen.getByLabelText('Hora (ET)')
    await userEvent.clear(hora)
    await userEvent.type(hora, '10:10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('A entrada ao vivo pode ser de até 15 minutos atrás. Para uma mais antiga, use “Já fechada”.')).toBeInTheDocument()
    await userEvent.clear(hora)
    await userEvent.type(hora, '10:40')
    expect(screen.getByText('A entrada não pode ser depois de agora (10:31 ET).')).toBeInTheDocument()
  })

  it('«Outro» contracts: «Quantos contratos?», whole numbers only', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Contratos', 'Outro'))
    const campo = await screen.findByLabelText('Quantos contratos?')
    await waitFor(() => expect(campo).toHaveFocus())
    await userEvent.type(campo, '2,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('Use um número inteiro de contratos.')).toBeInTheDocument()
    await userEvent.clear(campo)
    await userEvent.type(campo, '0')
    expect(screen.getByText('Use uma quantidade maior que zero.')).toBeInTheDocument()
  })

  it('«Registrar entrada» sends the payload’s exact keys (stop and target in points, marks held)', async () => {
    db.registerEntry.mockResolvedValue(entradaTelas('entry-mgc'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4.421,30')
    await userEvent.type(screen.getByLabelText('Stop'), '16')
    await userEvent.type(screen.getByLabelText('Alvo'), '24')
    expect(screen.getByText('risco US$ 160,00 · alvo US$ 240,00 · 1 : 1,5')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Setup B' }))
    expect(screen.getByText('agora conta como antes da saída')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    const [, accountId, payload] = db.registerEntry.mock.calls[0]
    expect(accountId).toBe(ids.accounts.topOne)
    expect(Object.keys(payload).sort()).toEqual(['client_key', 'clock', 'direction', 'entry_price', 'marks', 'quantity', 'stop_pts', 'symbol', 'target_pts', 'v'])
    expect(payload).toMatchObject({
      v: 1,
      symbol: 'MGC',
      direction: 'short',
      quantity: '1',
      entry_price: '4421.3',
      stop_pts: '16',
      target_pts: '24',
      clock: 'America/New_York',
      marks: { setup: 'B' },
    })
    expect(payload.client_key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toHaveFocus()
  })

  it('a lost answer: the same tap sends the same client_key again (C5, C23)', async () => {
    db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network')).mockResolvedValueOnce(entradaTelas('entry-mgc'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(db.registerEntry).toHaveBeenCalledTimes(2)
    expect(db.registerEntry.mock.calls[1][2].client_key).toBe(db.registerEntry.mock.calls[0][2].client_key)
  })

  it('offline: nothing is sent and the form stays (D14)', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    online = false
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando a conexão voltar.')
    expect(db.registerEntry).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Preço de entrada')).toHaveValue('4421,3')
  })

  it('looks like an imported trade (D30): asks, then sends again with allow_similar and the same key', async () => {
    db.registerEntry
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('similar_trade'))
      .mockResolvedValueOnce(entradaTelas('entry-mgc'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Esta operação parece já ter vindo do arquivo: Venda de MGC às 10:31. Registrar mesmo assim?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar mesmo assim' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const [first, second] = db.registerEntry.mock.calls.map((c) => c[2])
    expect(first.allow_similar).toBeUndefined()
    expect(second).toMatchObject({ allow_similar: true, client_key: first.client_key })
  })
})

describe('«Já fechada» (futures)', () => {
  it('«Ontem» MES short 2, 10:33–10:49: «Resultado: +9,50 pts · +US$ 95,00» and register_after', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaTelas('after-dry-ontem'))
    const after = saidaTelas('exit-mes-oitenta') // any closed state will do for the next step
    db.registerAfter.mockResolvedValue({ state: after.state, repeated: false, similar: [], points: '9.5', r: null, gateNow: null })
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Dia', 'Ontem'))
    await userEvent.click(pill('Ativo', 'MES'))
    expect(screen.getByText('Resultado: escolha o lado.')).toBeInTheDocument()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Contratos', '2'))
    expect(screen.getByText('Resultado: preencha os dois preços.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7.938,50')
    const horaEntrada = screen.getByLabelText('Hora da entrada (ET)')
    await userEvent.clear(horaEntrada)
    await userEvent.type(horaEntrada, '10:33')
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7929,1')
    expect(screen.getByText('Resultado: confira os preços (o MES anda de 0,25 em 0,25).')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Preço de saída'))
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7929')
    const horaSaida = screen.getByLabelText('Hora da saída (ET)')
    await userEvent.clear(horaSaida)
    await userEvent.type(horaSaida, '10:49')
    expect(screen.getByText('Resultado: +9,50 pts · +US$ 95,00')).toBeInTheDocument()
    expect(screen.getByText('Como estava o setup?')).toBeInTheDocument()
    expect(screen.getByText('depois do resultado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    const payload = db.registerAfter.mock.calls[0][2]
    expect(Object.keys(payload).sort()).toEqual(['client_key', 'clock', 'day', 'direction', 'entry', 'entry_price', 'exit', 'exit_price', 'quantity', 'symbol', 'v'])
    expect(payload).toMatchObject({ day: '2026-10-21', entry: '10:33', exit: '10:49', entry_price: '7938.5', exit_price: '7929', direction: 'short', quantity: '2', symbol: 'MES' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
  })

  it('an exit before the entry, or after now', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    const entrada = screen.getByLabelText('Hora da entrada (ET)')
    await userEvent.clear(entrada)
    await userEvent.type(entrada, '10:20')
    const saida = screen.getByLabelText('Hora da saída (ET)')
    await userEvent.clear(saida)
    await userEvent.type(saida, '10:10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(screen.getByText('A saída não pode ser antes da entrada (10:20).')).toBeInTheDocument()
    await userEvent.clear(saida)
    await userEvent.type(saida, '10:45')
    expect(screen.getByText('A saída não pode ser depois de agora (10:31 ET).')).toBeInTheDocument()
  })
})

describe('Ebinex', () => {
  /** rules_now of the Ebinex session, answered at `iso` */
  const ebinexAs = (iso: string) => agoraEditado('agora-qui-2024-brt', (json) => (json.server_now = iso))

  it('starts from the account’s pairs (by use) and the pair’s last payout; «Expiração» is 1, 5 and 15 min only', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:10:20.000Z'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(within(screen.getByRole('group', { name: 'Par' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['EUR/USD', 'BTC/USDT', 'Outro par'])
    expect(pill('Par', 'EUR/USD')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Payout, %')).toHaveValue('87')
    expect(screen.getByLabelText('Stake, US$')).toHaveValue('20')
    expect(within(screen.getByRole('group', { name: 'Expiração' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['1 min', '5 min', '15 min'])
    expect(screen.getByLabelText('Hora (Brasília)')).toHaveValue('20:10')
    await userEvent.click(pill('Par', 'BTC/USDT'))
    expect(screen.getByLabelText('Payout, %')).toHaveValue('85')
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: expiração na Ebinex' }))
    expect(screen.getByText(/Na Ebinex, as ordens se casam num livro de ofertas/)).toBeInTheDocument()
  })

  it('at 20:10, «Vence às 20:12 / 20:20 / 20:30 de Brasília» (the next candle)', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:10:20.000Z'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Expiração', '1 min'))
    expect(screen.getByText('Vence às 20:12 de Brasília.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Expiração' })).toHaveAccessibleDescription('Vence às 20:12 de Brasília.')
    await userEvent.click(pill('Expiração', '5 min'))
    expect(screen.getByText('Vence às 20:20 de Brasília.')).toBeInTheDocument()
    await userEvent.click(pill('Expiração', '15 min'))
    expect(screen.getByText('Vence às 20:30 de Brasília.')).toBeInTheDocument()
    // A typed hour already over: «Venceu às …», and the setup counts as after the result
    const hora = screen.getByLabelText('Hora (Brasília)')
    await userEvent.click(pill('Expiração', '1 min'))
    await userEvent.clear(hora)
    await userEvent.type(hora, '20:08')
    expect(screen.getByText('Venceu às 20:10 de Brasília.')).toBeInTheDocument()
    expect(screen.getByText('Como estava o setup?')).toBeInTheDocument()
  })

  it('«Vence às» turns into «Venceu às» when the server’s clock passes it', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-22T23:11:50.000Z'), doNotFake: ['queueMicrotask'] })
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:11:50.000Z'))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await user.click(pill('Expiração', '1 min'))
    expect(screen.getByText('Vence às 20:13 de Brasília.')).toBeInTheDocument()
    // The hour follows the clock while untouched: at 20:12:00 the entry is the 20:12 candle
    await act(async () => {
      jest.advanceTimersByTime(11_000)
    })
    expect(screen.getByLabelText('Hora (Brasília)')).toHaveValue('20:12')
    expect(screen.getByText('Vence às 20:14 de Brasília.')).toBeInTheDocument()
    // Typed back to 20:11, the 20:13 expiry passes on the server's clock
    const hora = screen.getByLabelText('Hora (Brasília)')
    await user.clear(hora)
    await user.type(hora, '20:11')
    expect(screen.getByText('Vence às 20:13 de Brasília.')).toBeInTheDocument()
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Venceu às 20:13 de Brasília.')).toBeInTheDocument()
  })

  it('«Outro par»: «Informe o par.», then the pair in capitals; the payload of a binary', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:10:20.000Z'))
    db.registerEntry.mockResolvedValue(entradaTelas('entry-ebinex-put'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Par', 'Outro par'))
    const campo = screen.getByLabelText('Outro par')
    expect(campo).toHaveAttribute('placeholder', 'Ex.: AUD/CAD')
    expect(screen.getByLabelText('Payout, %')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('Informe o par.')).toBeInTheDocument()
    expect(campo).toHaveFocus()
    expect(screen.getByText('Escolha Alta ou Baixa.')).toBeInTheDocument()
    expect(screen.getByText('Escolha a expiração.')).toBeInTheDocument()
    expect(screen.getByText('Informe o payout.')).toBeInTheDocument()
    await userEvent.type(campo, 'aud/cad')
    await userEvent.click(pill('Direção', 'Baixa'))
    await userEvent.click(pill('Expiração', '1 min'))
    await userEvent.type(screen.getByLabelText('Payout, %'), '101')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('O payout vai de 1 a 100%.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Payout, %'))
    await userEvent.type(screen.getByLabelText('Payout, %'), '88')
    expect(screen.getByText('Se acertar: +US$ 17,60 · se errar: −US$ 20,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalled())
    const payload = db.registerEntry.mock.calls[0][2]
    expect(Object.keys(payload).sort()).toEqual(['client_key', 'clock', 'direction', 'duration_s', 'payout', 'stake', 'symbol', 'v'])
    expect(payload).toMatchObject({ symbol: 'AUD/CAD', direction: 'put', stake: '20', payout: '88', duration_s: 60, clock: 'America/Sao_Paulo' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
  })

  it('«Já fechada»: «Como terminou?» waits for the expiry; «Ganho» gives «Resultado: +US$ 17,40»', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:24:04.000Z'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Par', 'Outro par'))
    await userEvent.type(screen.getByLabelText('Outro par'), 'GBP/USD')
    await userEvent.type(screen.getByLabelText('Payout, %'), '87')
    await userEvent.click(pill('Direção', 'Alta'))
    await userEvent.click(pill('Expiração', '15 min'))
    expect(screen.getByText('Vence às 20:45 de Brasília.')).toBeInTheDocument()
    expect(pill('Como terminou?', 'Ganho')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(screen.getByText('Ainda não venceu.')).toBeInTheDocument()
    await userEvent.click(pill('Expiração', '5 min'))
    const hora = screen.getByLabelText('Hora da entrada (Brasília)')
    await userEvent.clear(hora)
    await userEvent.type(hora, '20:13')
    expect(screen.getByText('Venceu às 20:20 de Brasília.')).toBeInTheDocument()
    expect(screen.getByText('Resultado: escolha como terminou.')).toBeInTheDocument()
    await userEvent.click(pill('Como terminou?', 'Ganho'))
    expect(screen.getByText('Resultado: +US$ 17,40')).toBeInTheDocument()
  })
})

// ------------------------------------------------------------------------------------------------
// Review fixes (lane A reviews)
// ------------------------------------------------------------------------------------------------

describe('«Posso operar hoje?» at a typed moment never shows another moment’s answer (D8)', () => {
  it('gate_at failing at a typed hour: «Não foi possível conferir agora.», never the current minute’s «Liberado»', async () => {
    db.fetchGateAt.mockRejectedValue(new registrarDb.RegistrarDataError('unknown'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(linhaDoGate()).toHaveTextContent('Liberado')
    const hora = screen.getByLabelText('Hora (ET)')
    await userEvent.clear(hora)
    await userEvent.type(hora, '10:20')
    await waitFor(() => expect(db.fetchGateAt).toHaveBeenCalled())
    await waitFor(() => expect(linhaDoGate()).toHaveTextContent('Não foi possível conferir agora.'))
    expect(linhaDoGate()).not.toHaveTextContent('Liberado')
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
  })

  it('«Ontem» while gate_at answers, and when it fails: never today’s «Encerrado por hoje» labelled as the 21st', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1042-et'))
    let falhar: (e: unknown) => void = () => undefined
    db.fetchGateAt.mockImplementation(() => new Promise((_resolve, reject) => (falhar = reject)))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(linhaDoGate()).toHaveTextContent('Encerrado por hoje')
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Dia', 'Ontem'))
    await waitFor(() => expect(db.fetchGateAt).toHaveBeenCalled())
    // Asking: the question alone, no answer and no «Limite do dia» of another day
    expect(linhaDoGate()).toHaveTextContent('Posso operar hoje? Na entrada, em 21 out:')
    expect(linhaDoGate()).not.toHaveTextContent('Encerrado por hoje')
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
    expect(screen.queryByText('Fora do plano, conferido pelo hub. Você pode registrar.')).not.toBeInTheDocument()
    await act(async () => falhar(new registrarDb.RegistrarDataError('unknown')))
    await waitFor(() => expect(linhaDoGate()).toHaveTextContent('Não foi possível conferir agora.'))
    expect(linhaDoGate()).not.toHaveTextContent('Encerrado por hoje')
    expect(screen.queryByText('Limite do dia')).not.toBeInTheDocument()
  })

  it('the account line never says «Sem janela salva» when rules_now failed (not evaluated is not false)', async () => {
    fetchRulesNow.mockRejectedValue(new Error('network'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await screen.findByText('Não foi possível conferir agora.')
    expect(screen.queryByText('Sem janela salva')).not.toBeInTheDocument()
    expect(screen.getByText('Conta').parentElement).toHaveTextContent(/^ContaTop One #1/)
  })
})

describe('the plan line on the current minute follows the clock (the owner’s 11:05 test, opened before 11:00)', () => {
  it('filled at 10:59:40: at 11:00 the dry run is asked again for 11:00 and says «● fora da janela»', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-22T14:59:40.000Z'), doNotFake: ['queueMicrotask'] })
    fetchRulesNow.mockImplementation(async () => agoraEditado('agora-qui-1031-et', (json) => (json.server_now = new Date().toISOString())))
    db.previewEntry.mockImplementation(async (_db, _id, p) => previaTelas(p.entry === '11:00' ? 'entry-dry-fora-janela' : 'entry-dry-mes-digitada'))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await user.click(pill('Ativo', 'MES'))
    await user.click(pill('Lado', 'Compra'))
    await user.click(pill('Contratos', '2'))
    await user.type(screen.getByLabelText('Preço de entrada'), '7912,50')
    await user.type(screen.getByLabelText('Stop'), '10')
    await act(async () => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({ entry: '10:59' })
    expect(screen.queryByText('Fora do plano, conferido pelo hub. Você pode registrar.')).not.toBeInTheDocument()
    await act(async () => {
      jest.advanceTimersByTime(21_000)
    })
    expect(screen.getByLabelText('Hora (ET)')).toHaveValue('11:00')
    await waitFor(() => expect(db.previewEntry.mock.calls.some((c) => c[2].entry === '11:00')).toBe(true))
    expect(await screen.findByText('Fora do plano, conferido pelo hub. Você pode registrar.')).toBeInTheDocument()
    expect(screen.getByText('fora da janela')).toBeInTheDocument()
    // The registration itself still leaves the hour to the server's clock
    db.registerEntry.mockResolvedValue(entradaTelas('entry-mes'))
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalled())
    expect(db.registerEntry.mock.calls[0][2]).not.toHaveProperty('entry')
  })
})

describe('a lost answer, then the other mode with the same client_key (C5)', () => {
  it('lost «Registrar entrada», then «Já fechada»: the repeated open trade goes to step 2, not «Carregando…» forever', async () => {
    const aberta = entradaTelas('entry-mgc').state
    db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    db.registerAfter.mockResolvedValue({ state: aberta, repeated: true, similar: [], points: null, r: null, gateNow: null })
    db.fetchTradeState.mockResolvedValue(aberta)
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await screen.findByText('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.type(screen.getByLabelText('Preço de saída'), '4420')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalled())
    expect(db.registerAfter.mock.calls[0][2].client_key).toBe(db.registerEntry.mock.calls[0][2].client_key)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toHaveFocus()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    expect(screen.getByText('MGC · Venda · 1 ct')).toBeInTheDocument()
  })

  it('lost «Já fechada», then «Aberta»: the repeated closed trade is step 3, never «… fechada em outro lugar.»', async () => {
    const fechada = saidaTelas('exit-mes-oitenta').state
    db.previewAfter.mockResolvedValue(fechadaPreviaTelas('after-dry-ontem'))
    db.registerAfter.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    db.registerEntry.mockResolvedValue({ state: fechada, repeated: true, similar: [] })
    db.fetchTradeState.mockResolvedValue(fechada)
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    await userEvent.type(screen.getByLabelText('Preço de saída'), '4425')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await screen.findByText('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')
    await userEvent.click(pill('Como está a operação?', 'Aberta'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalled())
    expect(db.registerEntry.mock.calls[0][2].client_key).toBe(db.registerAfter.mock.calls[0][2].client_key)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.queryByText('Esta operação já foi fechada em outro lugar.')).not.toBeInTheDocument()
  })
})

describe('D30’s question and the sheet’s alert are seen where they appear', () => {
  it('the question takes the focus; «Cancelar» gives it back to «Registrar entrada»', async () => {
    db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('similar_trade'))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    const pergunta = await screen.findByText('Esta operação parece já ter vindo do arquivo: Venda de MGC às 10:31. Registrar mesmo assim?')
    await waitFor(() => expect(pergunta).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/parece já ter vindo do arquivo/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar entrada' })).toHaveFocus())
  })

  it('the alert is scrolled into view (on a phone it appears below the screen, above the sticky footer)', async () => {
    const scroll = jest.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
      abrir()
      await screen.findByRole('heading', { level: 3, name: 'Entrada' })
      await userEvent.click(pill('Lado', 'Venda'))
      await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
      await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
      const alerta = await screen.findByRole('alert')
      await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'nearest' }))
      expect(scroll.mock.contexts[0]).toBe(alerta)
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})

describe('Ebinex «Expiração» and «Como terminou?» (board)', () => {
  const ebinexAs = (iso: string) => agoraEditado('agora-qui-2024-brt', (json) => (json.server_now = iso))

  it('the ⓘ panel sits between the label row and the pills (RO l.395–397)', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:10:20.000Z'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Expiração', '1 min'))
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: expiração na Ebinex' }))
    const painel = document.getElementById('info-exp') as HTMLElement
    const pills = screen.getByRole('group', { name: 'Expiração' })
    const vence = screen.getByText('Vence às 20:12 de Brasília.')
    expect(painel.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pills.compareDocumentPosition(vence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(painel.previousElementSibling).toHaveTextContent('Expiração')
  })

  it('«Ganho» chosen, then an entry hour that has not expired: stays pressed (and disabled), drawn by the pressed rule', async () => {
    fetchRulesNow.mockResolvedValue(ebinexAs('2026-10-22T23:24:04.000Z'))
    abrir(ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Expiração', '5 min'))
    const hora = screen.getByLabelText('Hora da entrada (Brasília)')
    await userEvent.clear(hora)
    await userEvent.type(hora, '20:13')
    await userEvent.click(pill('Como terminou?', 'Ganho'))
    expect(pill('Como terminou?', 'Ganho')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.clear(hora)
    await userEvent.type(hora, '20:23')
    const ganho = pill('Como terminou?', 'Ganho')
    expect(ganho).toHaveAttribute('aria-pressed', 'true')
    expect(ganho).toHaveAttribute('aria-disabled', 'true')
    // RegistrarCss.test.tsx checks that the pressed rule wins over the disabled one (#26301F on mint)
  })
})

describe('step 1: double taps and the server’s answers (review gaps)', () => {
  const preencher = async () => {
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
  }

  it('a double tap on «Registrar entrada» sends one entry (C11)', async () => {
    let answer: (r: registrarDb.Registered) => void = () => undefined
    db.registerEntry.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    abrir()
    await preencher()
    const botao = screen.getByRole('button', { name: 'Registrar entrada' })
    await userEvent.dblClick(botao)
    expect(db.registerEntry).toHaveBeenCalledTimes(1)
    expect(botao).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Um momento…')).toBeInTheDocument()
    await act(async () => answer(entradaTelas('entry-mgc')))
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(db.registerEntry).toHaveBeenCalledTimes(1)
  })

  it('a server refusal of a field the form let through goes under that field, with the focus', async () => {
    db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('off_tick', 'entry_price'))
    abrir()
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    const preco = screen.getByLabelText('Preço de entrada')
    expect(await screen.findByText('Confira o preço: ele não anda nesse passo.')).toBeInTheDocument()
    expect(preco).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(preco).toHaveFocus())
    expect(screen.queryByRole('alert', { name: /servidor/ })).not.toBeInTheDocument()
    // Typing again clears it
    await userEvent.type(preco, '0')
    expect(screen.queryByText('Confira o preço: ele não anda nesse passo.')).not.toBeInTheDocument()
  })

  it('no_rules from the server: D18’s text and «Definir em Personalizar»', async () => {
    db.registerEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('no_rules'))
    abrir()
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Definir em Personalizar' })).toBeInTheDocument()
  })

  it('D30 from the dry run: the question comes before anything is sent', async () => {
    db.previewEntry.mockResolvedValue({ ...previaTelas('entry-dry-mes-digitada'), similar: ['b6c4e1a0-0000-4000-8000-000000000001'] })
    abrir()
    await preencher()
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalled())
    await act(async () => undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Esta operação parece já ter vindo do arquivo: Venda de MGC às 10:31. Registrar mesmo assim?')).toBeInTheDocument()
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('the last dry run’s answer is never used for the next form (placeholder): the limit warning follows the stop typed', async () => {
    // The dry run of stop 4 answers «above» (risk US$ 200 of the US$ 155 left); the next one never answers
    db.previewEntry.mockResolvedValueOnce(previaTelas('entry-dry-es-acima')).mockImplementation(() => new Promise(() => undefined))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'ES'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7.912,25')
    await userEvent.type(screen.getByLabelText('Stop'), '4')
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalledTimes(1))
    expect(db.previewEntry.mock.calls[0][2]).toMatchObject({ stop_pts: '4' })
    expect(await screen.findByText('Se o stop for atingido, o dia passa do limite: faltam US$ 155 e o stop arrisca US$ 200.')).toBeInTheDocument()
    const stop = screen.getByLabelText('Stop')
    await userEvent.clear(stop)
    await userEvent.type(stop, '1')
    await waitFor(() => expect(db.previewEntry.mock.calls[db.previewEntry.mock.calls.length - 1][2]).toMatchObject({ stop_pts: '1' }))
    // Stop 1 risks US$ 50: the local rule says nothing; the «above» of stop 4 is not this form's
    expect(screen.getByText('risco US$ 50,00')).toBeInTheDocument()
    expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument()
  })
})

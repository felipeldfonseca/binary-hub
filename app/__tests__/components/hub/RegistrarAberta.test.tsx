/**
 * «Registrar operação» step 2 (PR 3-3, lane A): «Operação aberta» / «Opção vencida» with the
 * recorded answers of the owner's day (testing/registrarTelas; invented data): the summary, the
 * marks on the server's clock, the exit and its banner (80 % with the preference, the limit
 * reached always, nothing for yesterday's trade), the binary's expiry, «Desfazer entrada», a trade
 * closed elsewhere and the retries.
 */
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
  estadoTelas,
  idsTelas,
  operacaoTelas,
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

type Json = Record<string, any>

/** A recorded rules_now answer as if the server had answered it at `iso` */
const agoraAs = (name: TelasAgora, iso: string) => {
  const json = telasJson(name) as Json
  json.server_now = iso
  return parseRulesNow(json)
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasTelas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1031-et'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockImplementation(async (_db, id) => recentesTelas(id === ids.accounts.ebinex ? 'recentes-ebinex' : 'recentes-top-one'))
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraTelas('agora-qui-1031-et').accounts.find((a) => a.accountId === id)!)
})

afterEach(() => {
  jest.useRealTimers()
})

function abrir(tradeId: string, accountId: string = ids.accounts.topOne) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...view, onClose, queryClient }
}

const mesAberta = () => operacaoTelas('operacao-mes-aberta')

describe('the open futures trade', () => {
  it('shows its summary, its plan and its marks with the server’s times', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    abrir(ids.trades.mes)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
    expect(screen.getByText('Entrada registrada às 10:12 ET.')).toBeInTheDocument()
    const resumo = screen.getByText('MES · Compra · 2 ct').parentElement as HTMLElement
    expect(resumo).toHaveTextContent('MES · Compra · 2 ct7.912,50 às 10:12 ETstop 10 · alvo 20 pts · risco US$ 100,00')
    expect(screen.getByText('No plano')).toBeInTheDocument()
    expect(screen.getByText('Conferidos: janela e limite.')).toBeInTheDocument()
    const marcas = screen.getByText('Suas marcas').parentElement as HTMLElement
    expect(within(marcas).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Setup A às 10:12 · antes da saída',
      'Execução: no ponto às 10:12 · antes da saída',
    ])
    expect(within(screen.getByRole('group', { name: 'Como você está?' })).getByRole('button', { name: 'Calmo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('às 10:31 · antes da saída')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar saída' })).toBeInTheDocument()
  })

  it('one tap = one mark: «salvando…» until the answer, the tap again is «desmarcar», a failure puts it back', async () => {
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    let answer: (s: registrarDb.TradeState) => void = () => undefined
    db.addMarks.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const calmo = within(screen.getByRole('group', { name: 'Como você está?' })).getByRole('button', { name: 'Calmo' })
    expect(calmo).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(calmo)
    expect(calmo).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('salvando…')).toBeInTheDocument()
    expect(db.addMarks).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { v: 1, marks: { emocao: 'calmo' } })
    await act(async () => answer(estadoTelas('marks-mes-aberta')))
    expect(await screen.findByText('às 10:31 · antes da saída')).toBeInTheDocument()
    expect(screen.getByText('Emoção: Calmo, às 10:31, antes da saída.')).toBeInTheDocument()
    // Tapping it again clears it (null)
    db.addMarks.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    await userEvent.click(calmo)
    await waitFor(() => expect(db.addMarks).toHaveBeenLastCalledWith(expect.anything(), ids.trades.mes, { v: 1, marks: { emocao: null } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A marca não foi salva. Tente de novo.')
    expect(calmo).toHaveAttribute('aria-pressed', 'true')
  })

  it('the exit: preview, the payload, step 3 with the 80 % banner when the preference is on', async () => {
    fetchPreferences.mockResolvedValue({ alerts: { limit_80: true } })
    db.fetchTradeState.mockResolvedValue(mesAberta())
    db.registerExit.mockResolvedValue(saidaTelas('exit-mes-oitenta'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('Resultado: informe o preço de saída.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora da saída (ET)')).toHaveValue('10:31')
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7903,8')
    expect(screen.getByText('Resultado: confira o preço de saída (o MES anda de 0,25 em 0,25).')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Preço de saída'))
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7.902,50')
    expect(screen.getByText('Se sair a 7.902,50: −10,00 pts · −US$ 100,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    const [, tradeId, payload] = db.registerExit.mock.calls[0]
    expect(tradeId).toBe(ids.trades.mes)
    expect(payload).toEqual({ v: 1, exit_price: '7902.5', clock: 'America/New_York' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.')).toBeInTheDocument()
    expect(screen.getByText('−US$ 100,00')).toBeInTheDocument()
    expect(screen.getByText('MES · Compra · 2 ct · 7.912,50 → 7.902,50 · −10,00 pts · 10:12–10:38 ET')).toBeInTheDocument()
    expect(screen.getByText('−1,00 R')).toBeInTheDocument()
    expect(screen.getByText('com stop de 10 pts', { exact: false })).toBeInTheDocument()
  })

  it('the 80 % banner needs the preference', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    db.registerExit.mockResolvedValue(saidaTelas('exit-mes-oitenta'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.queryByText(/Você chegou a 80%/)).not.toBeInTheDocument()
  })

  it('the limit reached: «Limite do dia atingido às 10:40: −US$ 505 de US$ 400. Pelas suas regras, o dia está encerrado.»', async () => {
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mgc').state)
    db.registerExit.mockResolvedValue(saidaTelas('exit-mgc-atingido'))
    abrir(ids.trades.mgc)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '4437,3')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    const banner = screen.getByText('Limite do dia atingido às 10:40: −US$ 505 de US$ 400. Pelas suas regras, o dia está encerrado.')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveClass('hub-reg-aviso-lim--atingido')
  })

  it('yesterday’s open MNQ closed today: no banner, and the period across the two days', async () => {
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mnq-qua').state)
    db.registerExit.mockResolvedValue(saidaTelas('exit-mnq-ontem'))
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1042-et'))
    abrir(ids.trades.mnqQua)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('Entrada de ontem, às 10:52 ET.')).toBeInTheDocument()
    expect(screen.getByText('30.880,50 ontem, às 10:52 ET')).toBeInTheDocument()
    expect(screen.getByText('Setup A', { exact: false }).textContent).toBe('Setup A ontem às 10:52 · antes da saída')
    await userEvent.type(screen.getByLabelText('Preço de saída'), '30912,75')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.queryByText(/Limite do dia atingido|Você chegou a 80%/)).not.toBeInTheDocument()
    expect(screen.getByText('+US$ 64,50')).toBeInTheDocument()
    expect(screen.getByText('MNQ · Compra · 1 ct · 30.880,50 → 30.912,75 · +32,25 pts · 21 out, 10:52 → 22 out, 10:42 ET')).toBeInTheDocument()
  })

  it('a lost answer: the retried exit answers «repeated», which is success without a banner and never «outro lugar» (C5)', async () => {
    fetchPreferences.mockResolvedValue({ alerts: { limit_80: true } })
    db.fetchTradeState.mockResolvedValue(mesAberta())
    const done = saidaTelas('exit-mes-oitenta')
    db.registerExit.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network')).mockResolvedValueOnce({ ...done, repeated: true, exit: null, gateNow: null })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByText('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.queryByText(/Você chegou a 80%/)).not.toBeInTheDocument()
    expect(screen.queryByText('Esta operação já foi fechada em outro lugar.')).not.toBeInTheDocument()
    expect(screen.getByText('−US$ 100,00')).toBeInTheDocument()
  })

  it('closed on another device: the exit’s dry run says so → step 3 with «Esta operação já foi fechada em outro lugar.»', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    const fechada = saidaTelas('exit-mes-oitenta').state
    db.previewExit.mockResolvedValue({ repeated: true, serverNow: fechada.serverNow, tradeId: ids.trades.mes, state: fechada })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('Esta operação já foi fechada em outro lugar.')).toBeInTheDocument()
    expect(db.registerExit).not.toHaveBeenCalled()
  })
})

describe('the whole futures flow', () => {
  it('step 1 → 2 → 3: MES long 2 at 7.912,50 (stop 10, alvo 20, setup A), then out at 7.902,50 with the 80 % banner', async () => {
    fetchPreferences.mockResolvedValue({ alerts: { limit_80: true } })
    db.registerEntry.mockResolvedValue(entradaTelas('entry-mes'))
    db.registerExit.mockResolvedValue(saidaTelas('exit-mes-oitenta'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    const onClose = jest.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    render(
      <QueryClientProvider client={queryClient}>
        <RegistrarSheet accountId={ids.accounts.topOne} tradeId={null} onClose={onClose} />
      </QueryClientProvider>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const grupo = (nome: string) => screen.getByRole('group', { name: nome })
    await userEvent.click(within(grupo('Ativo')).getByRole('button', { name: 'MES' }))
    await userEvent.click(within(grupo('Lado')).getByRole('button', { name: 'Compra' }))
    await userEvent.click(within(grupo('Contratos')).getByRole('button', { name: '2' }))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7912,50')
    await userEvent.type(screen.getByLabelText('Stop'), '10')
    await userEvent.type(screen.getByLabelText('Alvo'), '20')
    expect(screen.getByText('risco US$ 100,00 · alvo US$ 200,00 · 1 : 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Setup A' }))
    await userEvent.click(screen.getByRole('button', { name: 'Execução da entrada' }))
    await userEvent.click(within(grupo('Execução')).getByRole('button', { name: 'no ponto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toHaveFocus()
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'MES', direction: 'long', quantity: '2', entry_price: '7912.5', stop_pts: '10', target_pts: '20', marks: { setup: 'A', execucao: 'no_ponto' } })
    expect(screen.getByText('Passo 2 de 3 · Aberta')).toBeInTheDocument()
    expect(screen.getAllByText('às 10:12 · antes da saída')).toHaveLength(2)
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('Passo 3 de 3 · Fechada')).toBeInTheDocument()
    expect(screen.getByText('Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.')).toBeInTheDocument()
  })
})

describe('«Desfazer entrada» (Q3 a)', () => {
  it('within 15 minutes: the link, its confirmation, «Manter» and «Sim, desfazer»', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('agora-qui-1031-et', '2026-10-22T14:13:00.000Z'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    db.undoEntry.mockResolvedValue({ serverNow: new Date('2026-10-22T14:13:10Z'), tradeId: ids.trades.mes, trash: [] })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.getByText('Até 10:27, 15 minutos depois do registro.')).toBeInTheDocument()
    const link = screen.getByRole('button', { name: 'Desfazer entrada' })
    await userEvent.click(link)
    const grupo = screen.getByRole('group', {
      name: 'Desfazer a entrada das 10:12 (MES · Compra · 2 ct)? A operação e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.',
    })
    expect(within(grupo).getByRole('button', { name: 'Sim, desfazer' })).toHaveFocus()
    await userEvent.click(within(grupo).getByRole('button', { name: 'Manter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desfazer entrada' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer entrada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(screen.getByText('Entrada das 10:12 desfeita às 10:13.')).toBeInTheDocument()
    expect(db.undoEntry).toHaveBeenCalledWith(expect.anything(), ids.trades.mes)
  })

  it('after the limit, the link is gone', async () => {
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(screen.queryByRole('button', { name: 'Desfazer entrada' })).not.toBeInTheDocument()
  })

  it('an undo retried after a lost answer comes back unknown_trade: it was done (C5)', async () => {
    fetchRulesNow.mockResolvedValue(agoraAs('agora-qui-1031-et', '2026-10-22T14:13:00.000Z'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    db.undoEntry.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network')).mockRejectedValueOnce(new registrarDb.RegistrarDataError('unknown_trade'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer entrada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByText('Não foi possível falar com o servidor. Confira sua conexão e tente de novo.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer entrada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(screen.getByText(/^Entrada das 10:12 desfeita às 10:1\d\.$/)).toBeInTheDocument()
  })
})

describe('the Ebinex option', () => {
  it('waits for the expiry, becomes «Opção vencida», then «Registrar resultado» sends the outcome', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-22T23:11:30.000Z'), doNotFake: ['queueMicrotask'] })
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    fetchRulesNow.mockResolvedValue(agoraAs('agora-qui-2024-brt', '2026-10-22T23:11:30.000Z'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-ebinex-put').state)
    db.registerExit.mockResolvedValue(saidaTelas('exit-ebinex-perda'))
    abrir(ids.trades.ebx, ids.accounts.ebinex)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
    expect(screen.getByText('EUR/USD · Baixa · 1 min')).toBeInTheDocument()
    expect(screen.getByText('US$ 20 · payout 88% · 20:10–20:12 de Brasília')).toBeInTheDocument()
    expect(screen.getByText('Vence às 20:12 de Brasília.')).toBeInTheDocument()
    expect(screen.getByText('Se acertar: +US$ 17,60 · se errar: −US$ 20,00')).toBeInTheDocument()
    const perda = within(screen.getByRole('group', { name: 'Como terminou?' })).getByRole('button', { name: 'Perda' })
    expect(perda).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    expect(screen.getByText('Ainda não venceu.')).toBeInTheDocument()
    expect(db.registerExit).not.toHaveBeenCalled()
    await act(async () => {
      jest.advanceTimersByTime(31_000)
    })
    expect(screen.getByRole('heading', { level: 3, name: 'Opção vencida' })).toBeInTheDocument()
    expect(screen.getByText('Passo 2 de 3 · Vencida')).toBeInTheDocument()
    expect(screen.getByText('Venceu às 20:12 de Brasília.')).toBeInTheDocument()
    expect(screen.getByText('Marcas feitas agora contam como depois do resultado.')).toBeInTheDocument()
    expect(perda).not.toHaveAttribute('aria-disabled')
    await user.click(perda)
    expect(screen.getByText('Resultado: −US$ 20,00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    await waitFor(() => expect(db.registerExit).toHaveBeenCalledTimes(1))
    expect(db.registerExit.mock.calls[0][2]).toEqual({ v: 1, outcome: 'perda' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('EUR/USD · Baixa · 1 min · perda · 20:10–20:12 de Brasília')).toBeInTheDocument()
    expect(screen.queryByText(/Limite do dia atingido/)).not.toBeInTheDocument()
  })
})

// ------------------------------------------------------------------------------------------------
// Review fixes (lane A reviews)
// ------------------------------------------------------------------------------------------------

describe('a server refusal of the exit goes under its own field', () => {
  it('the hour (exit_in_future, exit_before_entry) under «Hora da saída», with its values; the price under «Preço de saída»', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    db.registerExit
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('exit_in_future', 'exit'))
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('exit_before_entry', 'exit'))
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('off_tick', 'exit_price'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const preco = screen.getByLabelText('Preço de saída')
    const hora = screen.getByLabelText('Hora da saída (ET)')
    await userEvent.type(preco, '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByText('A saída não pode ser depois de agora (10:31 ET).')).toBeInTheDocument()
    expect(hora).toHaveAttribute('aria-invalid', 'true')
    expect(hora).toHaveAccessibleDescription('A saída não pode ser depois de agora (10:31 ET).')
    expect(preco).not.toHaveAttribute('aria-invalid')
    await waitFor(() => expect(hora).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByText('A saída não pode ser antes da entrada (10:12).')).toBeInTheDocument()
    expect(hora).toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByText('Confira o preço: ele não anda nesse passo.')).toBeInTheDocument()
    expect(preco).toHaveAttribute('aria-invalid', 'true')
    expect(hora).not.toHaveAttribute('aria-invalid')
    await waitFor(() => expect(preco).toHaveFocus())
  })
})

describe('«Nova entrada» after a registration (D5: the last used)', () => {
  it('starts from the trade just registered (MES, 2 contracts), not from the values before it', async () => {
    const base = recentesTelas('recentes-top-one')
    const mes2 = { ...base[0], symbol: 'MES', quantity: '2', direction: 'long' as const, source: 'live' as const, entryTime: new Date('2026-10-22T14:31:00Z') }
    db.fetchRecentTrades.mockImplementation(async () => (db.registerEntry.mock.calls.length > 0 ? [mes2, ...base] : base))
    db.registerEntry.mockResolvedValue(entradaTelas('entry-mes'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    render(
      <QueryClientProvider client={queryClient}>
        <RegistrarSheet accountId={ids.accounts.topOne} tradeId={null} onClose={jest.fn()} />
      </QueryClientProvider>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
    expect(pill('Ativo', 'MGC')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Ativo', 'MES'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7912,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await waitFor(() => expect(db.fetchRecentTrades).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('button', { name: 'Nova entrada' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toHaveFocus()
    expect(pill('Ativo', 'MES')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Contratos', '2')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Lado', 'Compra')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Preço de entrada')).toHaveValue('')
    // Nothing typed yet: closing asks nothing
    expect(sessionStorage.getItem(`hub:registrar:rascunho:${ids.accounts.topOne}`)).toBeNull()
  })

  it('never replaces a form the owner already started', async () => {
    // On Ebinex the reload is visible: «Par» lists the account's pairs straight from its recent
    // trades, so a new pair there means the new starting values reached the form
    fetchRulesNow.mockResolvedValue(agoraAs('agora-qui-2024-brt', '2026-10-22T23:10:20.000Z'))
    const base = recentesTelas('recentes-ebinex')
    const gbp = { ...base[0], symbol: 'GBP/USD', payout: '86', source: 'live' as const, entryTime: new Date('2026-10-22T23:05:00Z') }
    let tarde = false
    // GBP/USD becomes the most used pair: an untouched form would start on it
    db.fetchRecentTrades.mockImplementation(async () => (tarde ? [gbp, gbp, gbp, gbp, ...base] : base))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    render(
      <QueryClientProvider client={queryClient}>
        <RegistrarSheet accountId={ids.accounts.ebinex} tradeId={null} onClose={jest.fn()} />
      </QueryClientProvider>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
    expect(pill('Par', 'EUR/USD')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Par', 'BTC/USDT'))
    await userEvent.click(pill('Direção', 'Baixa'))
    tarde = true
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['hub', 'user-1', 'registrar', 'recentes'] })
    })
    expect(await within(screen.getByRole('group', { name: 'Par' })).findByRole('button', { name: 'GBP/USD' })).toBeInTheDocument()
    // The owner's choices stay
    expect(pill('Par', 'BTC/USDT')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Par', 'GBP/USD')).toHaveAttribute('aria-pressed', 'false')
    expect(pill('Direção', 'Baixa')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Payout, %')).toHaveValue('85')
  })
})

describe('step 2: double taps and the server’s other answers (review gaps)', () => {
  it('a double tap on «Registrar saída» sends one exit (C11)', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    let answer: (s: registrarDb.ExitRegistered) => void = () => undefined
    db.registerExit.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    const botao = screen.getByRole('button', { name: 'Registrar saída' })
    await userEvent.dblClick(botao)
    await userEvent.click(botao)
    expect(db.registerExit).toHaveBeenCalledTimes(1)
    await act(async () => answer(saidaTelas('exit-mes-oitenta')))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(db.registerExit).toHaveBeenCalledTimes(1)
  })

  it('a double tap on a mark sends one mark, not a mark and its «desmarcar» (C11)', async () => {
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-mes').state)
    let answer: (s: registrarDb.TradeState) => void = () => undefined
    db.addMarks.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    const calmo = within(screen.getByRole('group', { name: 'Como você está?' })).getByRole('button', { name: 'Calmo' })
    await userEvent.dblClick(calmo)
    expect(db.addMarks).toHaveBeenCalledTimes(1)
    expect(db.addMarks).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { v: 1, marks: { emocao: 'calmo' } })
    await act(async () => answer(estadoTelas('marks-mes-aberta')))
    // The answer reaches the sheet's view of the trade on the cache's own tick, after «salvando…» is
    // gone: wait for the saved mark's time, which only that view has, before reading the pill
    expect(await screen.findByText('às 10:31 · antes da saída')).toBeInTheDocument()
    expect(screen.queryByText('salvando…')).not.toBeInTheDocument()
    expect(calmo).toHaveAttribute('aria-pressed', 'true')
    expect(db.addMarks).toHaveBeenCalledTimes(1)
  })

  it('not_open: the trade is read again → step 3 with «Esta operação já foi fechada em outro lugar.»', async () => {
    const fechada = saidaTelas('exit-mes-oitenta').state
    db.fetchTradeState.mockResolvedValueOnce(mesAberta()).mockResolvedValue(fechada)
    db.registerExit.mockRejectedValueOnce(new registrarDb.RegistrarDataError('not_open'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('Esta operação já foi fechada em outro lugar.')).toBeInTheDocument()
  })

  it('not_open while the trade still reads open: back to step 2, never «Carregando…» waiting for a close', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    db.registerExit.mockRejectedValueOnce(new registrarDb.RegistrarDataError('not_open'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    // The trade was read again (still open) and the sheet went to step 3 with it…
    await waitFor(() => expect(db.fetchTradeState.mock.calls.length).toBeGreaterThanOrEqual(2))
    // …which sends a trade that is open to its step 2: a new step, whose heading takes the focus
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Operação aberta' })).toHaveFocus())
    expect(screen.getByText('Passo 2 de 3 · Aberta')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    expect(screen.queryByText('Esta operação já foi fechada em outro lugar.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar saída' })).toBeInTheDocument()
  })

  it('a lost exit: the alert is scrolled into view (it appears above the sticky footer, below the screen on a phone)', async () => {
    const scroll = jest.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      db.fetchTradeState.mockResolvedValue(mesAberta())
      db.registerExit.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
      abrir(ids.trades.mes)
      await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
      await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
      await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Não foi possível falar com o servidor.')
      await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'nearest' }))
      expect(scroll.mock.contexts[0]).toBe(alerta)
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('unknown_trade on the exit: step 1 with «Esta operação não foi encontrada.»', async () => {
    db.fetchTradeState.mockResolvedValue(mesAberta())
    db.registerExit.mockRejectedValueOnce(new registrarDb.RegistrarDataError('unknown_trade'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7902,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toHaveFocus()
    expect(screen.getByText('Esta operação não foi encontrada.')).toBeInTheDocument()
  })
})

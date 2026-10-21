/**
 * Phase 3c · lane C2 (telas contract §6.3–6.4, §8.2): «Já fechada» in several exits and «Movi o stop
 * para o breakeven» on the sheet, with the domain's recorded answers (testing/fixtures/parciais,
 * Fri 23 Oct 2026 ET, invented data): scenario 15 (MGC Venda 2 ct in two exits, the breakeven told at
 * 4.409,30), its error state, the focus moves, the draft kept across a remount, scenario 7's option
 * rows and scenario 12's limit banner from the answer's gate_now (with and without a cached rules_now).
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { idsParciais } from '@/testing/parciais'
import { agoraEs12, agoraParciais, contasParciais, fechadaEs12, fechadaMgc, gateAtParciais, previaMgc } from '@/testing/saidasTelas'
import { agoraMercados, contasMercados, idsMercados } from '@/testing/registrarMercados'

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
  previewAfter: jest.fn(),
  registerAfter: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsParciais()
let online = true

beforeAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
})

beforeEach(() => {
  jest.clearAllMocks()
  online = true
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasParciais())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraParciais('2026-10-23T14:45:05.000Z'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id, at) => gateAtParciais(id, at.toISOString()))
})

afterEach(() => {
  jest.useRealTimers()
})

function abrir(accountId: string = ids.accounts.topOne, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={null} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
const linha = (k: number) => screen.getByRole('group', { name: `${k}ª saída` })

async function digitar(campo: HTMLElement, texto: string) {
  await userEvent.clear(campo)
  if (texto) await userEvent.type(campo, texto)
}

/** Scenario 15's entry: «Já fechada», «Hoje», MGC Venda 2 ct a 4.421,30 às 10:24, stop 15, alvo 30 */
async function entradaMgc() {
  abrir()
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
  await userEvent.click(pill('Como está a operação?', 'Já fechada'))
  await userEvent.click(pill('Ativo', 'MGC'))
  await userEvent.click(pill('Lado', 'Venda'))
  await userEvent.click(pill('Contratos', '2'))
  await digitar(screen.getByLabelText('Preço de entrada'), '4.421,30')
  await digitar(screen.getByLabelText('Hora da entrada (ET)'), '10:24')
  await digitar(screen.getByLabelText('Stop'), '15')
  await digitar(screen.getByLabelText('Alvo'), '30')
}

/** The two rows of scenario 15 (1 ct a 4.409,30 às 10:31 and 1 ct a 4.421,30 às 10:38) */
async function duasSaidas() {
  await userEvent.click(screen.getByRole('button', { name: '+ Outra saída' }))
  await waitFor(() => expect(screen.getByLabelText('Contratos', { selector: '#f-s1q' })).toHaveFocus())
  await digitar(within(linha(1)).getByLabelText('Contratos'), '1')
  await digitar(within(linha(1)).getByLabelText('Preço de saída'), '4.409,30')
  await digitar(within(linha(1)).getByLabelText('Hora da saída (ET)'), '10:31')
  await digitar(within(linha(2)).getByLabelText('Contratos'), '1')
  await digitar(within(linha(2)).getByLabelText('Preço de saída'), '4.421,30')
  await digitar(within(linha(2)).getByLabelText('Hora da saída (ET)'), '10:38')
}

describe('scenario 15 · «Já fechada» em duas saídas (MGC, 10:45 ET)', () => {
  it('rows, sum, result line, the pill and its status; «Registrar operação» sends the rows by hour and the breakeven; the dry run gets the same', async () => {
    db.previewAfter.mockResolvedValue(previaMgc())
    db.registerAfter.mockResolvedValue(fechadaMgc())
    db.fetchTradeState.mockResolvedValue(fechadaMgc().state)
    await entradaMgc()
    // One exit: the single fields, «+ Outra saída» (2 ct can be split), the pill (a valid stop)
    expect(screen.getByLabelText('Preço de saída')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Outra saída' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Movi o stop para o breakeven' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('opcional')).toBeInTheDocument()

    await duasSaidas()
    expect(screen.queryByLabelText('Preço de saída', { selector: '#f-spreco' })).not.toBeInTheDocument()
    expect(within(linha(1)).getByRole('button', { name: 'Remover a 1ª saída' })).toHaveTextContent('Remover')
    expect(screen.getByText('Saídas: 2 de 2 ct.')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Resultado: +6,00 pts em média · +US$ 120,00')).toBeInTheDocument()

    // The pill on: the focus goes to «Preço quando moveu»; the status with the rule of the entry's version
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    expect(screen.getByRole('button', { name: 'Movi o stop para o breakeven' })).toHaveAttribute('aria-pressed', 'true')
    const bePreco = screen.getByLabelText('Preço quando moveu')
    await waitFor(() => expect(bePreco).toHaveFocus())
    await userEvent.type(bePreco, '4.409,30')
    await waitFor(() => expect(screen.getByText('com +12,00 pts a favor · Sua regra: com +5 pts.')).toBeInTheDocument())
    expect(screen.getByText('com +12,00 pts a favor · Sua regra: com +5 pts.')).toHaveAttribute('role', 'status')
    expect(bePreco).toHaveAttribute('aria-describedby', 'n-bePreco')

    // DOM order: the rows → «+ Outra saída» → the sum → the stop
    const ordem = [linha(1), linha(2), screen.getByRole('button', { name: '+ Outra saída' }), screen.getByText('Saídas: 2 de 2 ct.'), screen.getByLabelText('Stop')]
    for (let i = 1; i < ordem.length; i++) expect(ordem[i - 1].compareDocumentPosition(ordem[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const esperado = {
      v: 1,
      symbol: 'MGC',
      direction: 'short',
      quantity: '2',
      entry_price: '4421.3',
      stop_pts: '15',
      target_pts: '30',
      clock: 'America/New_York',
      day: '2026-10-23',
      entry: '10:24',
      exits: [
        { quantity: '1', exit_price: '4409.3', exit: '10:31' },
        { quantity: '1', exit_price: '4421.3', exit: '10:38' },
      ],
      breakeven: { price_then: '4409.3' },
    }
    await waitFor(() => expect(db.previewAfter).toHaveBeenCalled())
    expect(db.previewAfter.mock.calls[db.previewAfter.mock.calls.length - 1][2]).toEqual(esperado)

    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    const payload = db.registerAfter.mock.calls[0][2]
    expect(payload).toEqual({ ...esperado, client_key: expect.any(String) })
    expect(payload).not.toHaveProperty('exit')
    expect(payload).not.toHaveProperty('exit_price')
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
  })

  it('rows typed out of order go by hour (ties keep the rows’ order)', async () => {
    db.previewAfter.mockResolvedValue(previaMgc())
    await entradaMgc()
    await userEvent.click(screen.getByRole('button', { name: '+ Outra saída' }))
    await digitar(within(linha(1)).getByLabelText('Contratos'), '1')
    await digitar(within(linha(1)).getByLabelText('Preço de saída'), '4.421,30')
    await digitar(within(linha(1)).getByLabelText('Hora da saída (ET)'), '10:38')
    await digitar(within(linha(2)).getByLabelText('Contratos'), '1')
    await digitar(within(linha(2)).getByLabelText('Preço de saída'), '4.409,30')
    await digitar(within(linha(2)).getByLabelText('Hora da saída (ET)'), '10:31')
    await waitFor(() => expect(db.previewAfter).toHaveBeenCalled())
    const p = db.previewAfter.mock.calls[db.previewAfter.mock.calls.length - 1][2]
    expect(p.exits?.map((x) => x.exit)).toEqual(['10:31', '10:38'])
    expect(p).not.toHaveProperty('breakeven')
  })

  it('the error state: the 2nd quantity emptied → «Informe a quantidade.» on the row and «As saídas somam 1 ct; a entrada tem 2 ct.»; focus on that row', async () => {
    await entradaMgc()
    await duasSaidas()
    await userEvent.clear(within(linha(2)).getByLabelText('Contratos'))
    // Before a tap: no error shown, the result line says to check the quantities
    expect(screen.queryByText('As saídas somam 1 ct; a entrada tem 2 ct.')).not.toBeInTheDocument()
    expect(screen.getByText('Resultado: confira as quantidades das saídas.')).toBeInTheDocument()
    expect(screen.getByText('Saídas: 1 de 2 ct.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    const campo = within(linha(2)).getByLabelText('Contratos')
    expect(campo).toHaveFocus()
    expect(within(linha(2)).getByText('Informe a quantidade.')).toHaveAttribute('role', 'alert')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo.getAttribute('aria-describedby')).toContain(`e-${campo.id.slice(2)}`)
    const soma = screen.getByText('As saídas somam 1 ct; a entrada tem 2 ct.')
    expect(soma).toHaveAttribute('role', 'alert')
    expect(soma).toHaveAttribute('id', 'e-soma')
    expect(db.registerAfter).not.toHaveBeenCalled()
    // A quantity written wrong keeps only its row's error (no sum error)
    await userEvent.type(campo, 'abc')
    expect(within(linha(2)).getByText('Use só números, como 4.')).toBeInTheDocument()
    expect(screen.queryByText(/As saídas somam/)).not.toBeInTheDocument()
    // The sum wrong with readable quantities: the focus goes to the first row's quantity
    await digitar(campo, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(screen.getByText('As saídas somam 3 ct; a entrada tem 2 ct.')).toBeInTheDocument()
    expect(within(linha(1)).getByLabelText('Contratos')).toHaveFocus()
  })

  it('the pill’s field: the error as soon as something is typed (side, tick), «Informe o preço quando moveu.» only after a tap', async () => {
    await entradaMgc()
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    const campo = screen.getByLabelText('Preço quando moveu')
    expect(screen.queryByText('Informe o preço quando moveu.')).not.toBeInTheDocument()
    await userEvent.type(campo, '4.425,30')
    expect(screen.getByText('Para o breakeven, o preço precisava estar a favor.')).toHaveAttribute('role', 'alert')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAttribute('aria-describedby', 'n-bePreco e-bePreco')
    await digitar(campo, '4.409,35')
    expect(screen.getByText('O MGC anda de 0,10 em 0,10; confira o preço.')).toBeInTheDocument()
    await userEvent.clear(campo)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(screen.getByText('Informe o preço quando moveu.')).toBeInTheDocument()
  })

  it('not rendered = off: the stop cleared hides the pill (no error, no focus, no breakeven sent); typed back, the pill is back pressed', async () => {
    db.previewAfter.mockResolvedValue(previaMgc())
    await entradaMgc()
    await digitar(screen.getByLabelText('Preço de saída'), '4.409,30')
    await digitar(screen.getByLabelText('Hora da saída (ET)'), '10:38')
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    await userEvent.clear(screen.getByLabelText('Stop'))
    expect(screen.queryByRole('button', { name: 'Movi o stop para o breakeven' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Preço quando moveu')).not.toBeInTheDocument()
    await waitFor(() => expect(db.previewAfter).toHaveBeenCalled())
    expect(db.previewAfter.mock.calls[db.previewAfter.mock.calls.length - 1][2]).not.toHaveProperty('breakeven')
    await userEvent.type(screen.getByLabelText('Stop'), '15')
    expect(screen.getByRole('button', { name: 'Movi o stop para o breakeven' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Preço quando moveu')).toHaveValue('')
  })

  it('«Remover»: of three rows, the focus goes to the next row’s quantity (or the previous one’s); of two, back to one exit with the row’s price and hour', async () => {
    await entradaMgc()
    await duasSaidas()
    await userEvent.click(screen.getByRole('button', { name: '+ Outra saída' }))
    expect(screen.getByRole('group', { name: '3ª saída' })).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('group', { name: '3ª saída' })).getByLabelText('Contratos')).toHaveFocus())
    // The last row removed: the focus goes to the row above
    await userEvent.click(screen.getByRole('button', { name: 'Remover a 3ª saída' }))
    await waitFor(() => expect(within(linha(2)).getByLabelText('Contratos')).toHaveFocus())
    // The first of two removed: back to one exit with the 2nd row's price and hour
    await userEvent.click(screen.getByRole('button', { name: 'Remover a 1ª saída' }))
    await waitFor(() => expect(screen.getByLabelText('Preço de saída')).toHaveFocus())
    expect(screen.getByLabelText('Preço de saída')).toHaveValue('4.421,30')
    expect(screen.getByLabelText('Hora da saída (ET)')).toHaveValue('10:38')
    expect(screen.queryByRole('group', { name: '1ª saída' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Saídas:/)).not.toBeInTheDocument()
  })

  it('the cap: at 20 rows «+ Outra saída» is aria-disabled with «Até 20 saídas por operação.» and adds nothing', async () => {
    await entradaMgc()
    await userEvent.click(pill('Contratos', 'Outro'))
    await userEvent.type(screen.getByLabelText('Quantos contratos?'), '20')
    const outra = () => screen.getByRole('button', { name: '+ Outra saída' })
    await userEvent.click(outra())
    for (let i = 3; i <= 20; i++) await userEvent.click(outra())
    expect(screen.getAllByRole('group', { name: /ª saída$/ })).toHaveLength(20)
    expect(outra()).toHaveAttribute('aria-disabled', 'true')
    expect(outra()).toHaveAttribute('aria-describedby', 'n-max')
    expect(screen.getByText('Até 20 saídas por operação.')).toHaveAttribute('id', 'n-max')
    await userEvent.click(outra())
    expect(screen.getAllByRole('group', { name: /ª saída$/ })).toHaveLength(20)
  })

  it('1 contract: no «+ Outra saída»', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Contratos', '1'))
    expect(screen.queryByRole('button', { name: '+ Outra saída' })).not.toBeInTheDocument()
  })

  it('the draft keeps the rows and the pill across a remount (sessionStorage, v3)', async () => {
    await entradaMgc()
    await duasSaidas()
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    await userEvent.type(screen.getByLabelText('Preço quando moveu'), '4.409,30')
    await waitFor(() => expect(sessionStorage.getItem(`hub:registrar:rascunho:${ids.accounts.topOne}`)).toContain('"v":3'))
    const salvo = JSON.parse(sessionStorage.getItem(`hub:registrar:rascunho:${ids.accounts.topOne}`) as string)
    expect(salvo.saidas).toEqual([
      { id: 1, qtd: '1', preco: '4.409,30', hora: '10:31', res: '' },
      { id: 2, qtd: '1', preco: '4.421,30', hora: '10:38', res: '' },
    ])
    expect(salvo).toMatchObject({ be: true, bePreco: '4.409,30' })
    // A new sheet on the same account reads it back
    const { unmount } = abrir()
    unmount()
    document.body.innerHTML = ''
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada e saída' })
    expect(within(linha(2)).getByLabelText('Preço de saída')).toHaveValue('4.421,30')
    expect(screen.getByRole('button', { name: 'Movi o stop para o breakeven' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Preço quando moveu')).toHaveValue('4.409,30')
  })

  it('a server refusal of the rows («exits»): the sheet’s alert, the focus on the first row’s quantity; of «Preço quando moveu»: under its field', async () => {
    await entradaMgc()
    await duasSaidas()
    db.registerAfter.mockRejectedValueOnce(new registrarDb.RegistrarDataError('bad_costs', 'exits'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(await screen.findByRole('alert')).toHaveClass('hub-alerta')
    await waitFor(() => expect(within(linha(1)).getByLabelText('Contratos')).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    await userEvent.type(screen.getByLabelText('Preço quando moveu'), '4.409,30')
    db.registerAfter.mockRejectedValueOnce(new registrarDb.RegistrarDataError('bad_stop', 'breakeven'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(await screen.findByText('Para o breakeven, o preço precisava estar a favor.')).toHaveAttribute('id', 'e-bePreco')
    await waitFor(() => expect(screen.getByLabelText('Preço quando moveu')).toHaveFocus())
  })
})

describe('scenario 12 · ES em duas saídas: the banner «Limite do dia atingido às 10:12» from gate_now', () => {
  async function es12() {
    db.registerAfter.mockResolvedValue(fechadaEs12())
    db.fetchTradeState.mockResolvedValue(fechadaEs12().state)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('Ativo', 'ES'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await digitar(screen.getByLabelText('Preço de entrada'), '7.912,25')
    await digitar(screen.getByLabelText('Hora da entrada (ET)'), '10:05')
    await digitar(screen.getByLabelText('Stop'), '2,5')
    await userEvent.click(screen.getByRole('button', { name: '+ Outra saída' }))
    for (const [k, h] of [
      [1, '10:12'],
      [2, '10:20'],
    ] as const) {
      await digitar(within(linha(k)).getByLabelText('Contratos'), '1')
      await digitar(within(linha(k)).getByLabelText('Preço de saída'), '7.909,75')
      await digitar(within(linha(k)).getByLabelText('Hora da saída (ET)'), h)
    }
    expect(screen.getByText('Resultado: −2,50 pts em média · −US$ 250,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2].exits).toEqual([
      { quantity: '1', exit_price: '7909.75', exit: '10:12' },
      { quantity: '1', exit_price: '7909.75', exit: '10:20' },
    ])
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
  }

  it('with rules_now cached (the day at −US$ 300 before)', async () => {
    fetchRulesNow.mockResolvedValue(agoraEs12())
    abrir()
    await es12()
    expect(await screen.findByText(/^Limite do dia atingido às 10:12: −US\$ 550 de US\$ 400\./)).toBeInTheDocument()
  })

  it('without it (rules_now failed): the counting exit at hitAt is the one compared, not the last (10:20)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-23T14:24:05.000Z'), doNotFake: ['queueMicrotask'], advanceTimers: true })
    fetchRulesNow.mockRejectedValue(new Error('offline'))
    abrir()
    await es12()
    expect(await screen.findByText(/^Limite do dia atingido às 10:12: −US\$ 550 de US\$ 400\./)).toBeInTheDocument()
  })
})

describe('scenario 7 · IBKR in «Já fechada»: option rows, «Venceu sem valor» on the last row, «Prêmio quando moveu»', () => {
  const im = idsMercados()

  it('SPY Call 790, 2 ct: rows in «Prêmio de saída, US$ por ação»; the VSV note gains «Vale para a última saída.»; the pill’s field by kind', async () => {
    fetchAccounts.mockResolvedValue(contasMercados())
    fetchRulesNow.mockResolvedValue(agoraMercados('ibkr-qui-0952'))
    db.fetchGateAt.mockImplementation(async (_db, id) => agoraMercados('ibkr-qui-0952').accounts.find((a) => a.accountId === id)!)
    abrir(im.accounts.ibkr)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    await userEvent.click(pill('O que você operou?', 'Opção'))
    await userEvent.click(pill('Tipo', 'Call'))
    await userEvent.type(screen.getByLabelText('Strike, US$'), '790')
    await userEvent.click(pill('Vencimento', 'Hoje'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '2'))
    await userEvent.type(screen.getByLabelText('Prêmio de entrada, US$ por ação'), '1.85')
    await userEvent.click(screen.getByRole('button', { name: '+ Outra saída' }))
    expect(within(linha(1)).getByLabelText('Prêmio de saída, US$ por ação')).toBeInTheDocument()
    expect(within(linha(2)).getByLabelText('Contratos')).toBeInTheDocument()
    const vsv = screen.getByRole('button', { name: 'Venceu sem valor' })
    expect(vsv).toHaveAccessibleDescription('Vence hoje às 16:00 ET. Vale para a última saída.')
    await userEvent.type(screen.getByLabelText('Stop'), '1.10')
    await userEvent.click(screen.getByRole('button', { name: 'Movi o stop para o breakeven' }))
    expect(screen.getByLabelText('Prêmio quando moveu, US$ por ação')).toBeInTheDocument()
    expect(screen.queryByText(/Sua regra/)).not.toBeInTheDocument()
  })
})

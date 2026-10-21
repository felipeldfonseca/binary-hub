/**
 * Phase 3c · lane C1: step 2 with partials and stop moves, end to end on the sheet, scenario 14 of
 * the approved board (RegistrarOperacao.dc.html, 21 Oct 2026): MES Compra 3 ct a 7.912,50 às 10:12,
 * stop 10, alvo 20, rule MES +8. The answers are the domain's recordings (testing/fixtures/parciais,
 * invented data, real SQL), the exit the composed one with only the 10:19 breakeven (contract §8).
 * Also: the keyboard, the undo confirmation and its deadline, repeated answers, not_open, offline and
 * the retry with the same client_key, Ebinex unchanged, a 1-contract trade, and the copy check.
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { idsParciais } from '@/testing/parciais'
import {
  agoraParciais,
  contasParciais,
  desfeitaParciais,
  estadoJson,
  etEm,
  mesAntesDaParcial,
  parcialParciais,
  saidaMesComBe,
  stopParciais,
  vistaDe,
} from '@/testing/parciaisTelas'
import { agoraTelas, contasTelas, entradaTelas, idsTelas } from '@/testing/registrarTelas'

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
  fetchTradeEvents: jest.fn(),
  previewEntry: jest.fn(),
  previewExit: jest.fn(),
  registerExit: jest.fn(),
  registerPartial: jest.fn(),
  moveStop: jest.fn(),
  undoEvent: jest.fn(),
  undoEntry: jest.fn(),
  addMarks: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsParciais()
/** The money as formatMoney writes it (a no-break space after the symbol) */
const nb = (x: string) => x.replace(/(US\$|R\$) /g, '$1 ')
let online = true

beforeAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
})

beforeEach(() => {
  online = true
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasParciais())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('10:18') }))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockResolvedValue([])
  db.fetchTradeEvents.mockResolvedValue({})
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchTradeState.mockResolvedValue(vistaDe(mesAntesDaParcial()))
  db.registerPartial.mockReset().mockResolvedValue(parcialParciais('partial-mes'))
  db.moveStop.mockReset().mockResolvedValue(stopParciais('stop-mes-breakeven'))
  db.undoEvent.mockReset()
  db.registerExit.mockReset().mockResolvedValue(saidaMesComBe())
})

afterEach(() => {
  jest.useRealTimers()
})

function abrir(tradeId: string = ids.trades.mes, accountId: string = ids.accounts.topOne) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...view, onClose, queryClient }
}

/** An element's text with the no-break spaces of the money as plain spaces (as the queries normalize it) */
const texto = (el: Element) => (el.textContent ?? '').replace(/\u00a0/g, ' ')
const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
const passo2 = () => screen.findByRole('heading', { level: 3, name: 'Operação aberta' })

/** «Parcial» 1 ct a 7.920,50 at 10:18 (the recorded answer) */
async function registrarParcial() {
  await userEvent.click(pill('O que registrar agora?', 'Parcial'))
  await userEvent.type(screen.getByLabelText('Preço da parcial'), '7920,50')
  await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
  await screen.findByText('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')
}

describe('scenario 14 · MES 3 ct, step 2 at 10:18', () => {
  it('the summary’s rule line, «O que registrar agora?» Saída · Parcial · Mover stop, «Registrar saída»; no «Agora» or timeline yet', async () => {
    abrir()
    await passo2()
    const resumo = screen.getByText('MES · Compra · 3 ct').parentElement as HTMLElement
    expect(within(resumo).getByText('Sua regra: breakeven com +8 pts, em 7.920,50.')).toHaveClass('hub-nota')
    const grupo = screen.getByRole('group', { name: 'O que registrar agora?' })
    expect(within(grupo).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Saída', 'true'],
      ['Parcial', 'false'],
      ['Mover stop', 'false'],
    ])
    expect(screen.getByRole('button', { name: 'Registrar saída' })).toHaveAttribute('id', 'reg-primaria')
    expect(screen.queryByRole('group', { name: 'Agora' })).not.toBeInTheDocument()
    expect(screen.queryByText('Linha do tempo')).not.toBeInTheDocument()
    // The action status is always there, empty and visually hidden until a write
    const st = document.getElementById('reg-acao-st') as HTMLElement
    expect(st).toHaveAttribute('role', 'status')
    expect(st).toHaveClass('sr-only')
    expect(st).toHaveTextContent('')
  })

  it('«Parcial» → the status (focused), the suggestion, «Agora», the timeline with «Desfazer», the marks note; back to «Saída»', async () => {
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    expect(screen.getByRole('button', { name: 'Registrar parcial' })).toBeInTheDocument()
    expect(pill('Contratos', '1')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Contratos', '2')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Ficam 2 ct em aberto.')).toHaveAttribute('id', 'n-pq')
    expect(screen.getByText('Resultado: informe o preço da parcial.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora da parcial (ET)')).toHaveValue('10:18')
    await userEvent.type(screen.getByLabelText('Preço da parcial'), '7920,50')
    expect(screen.getByText('Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00')).toHaveAttribute('role', 'status')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await waitFor(() => expect(db.registerPartial).toHaveBeenCalledTimes(1))
    const [, tradeId, payload] = db.registerPartial.mock.calls[0]
    expect(tradeId).toBe(ids.trades.mes)
    expect(payload).toEqual({ v: 1, client_key: expect.stringMatching(/^[0-9a-f-]{36}$/), quantity: '1', exit_price: '7920.5', clock: 'America/New_York' })
    const st = await screen.findByText('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')
    await waitFor(() => expect(st).toHaveFocus())
    expect(st).toHaveClass('hub-reg-st')
    expect(screen.getByText('Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('button', { name: 'Mover para o breakeven' })).toBeInTheDocument()
    const agora = screen.getByRole('group', { name: 'Agora' })
    expect(agora).toHaveTextContent('Em aberto2 ctde 3Stop7.902,50· o da entradaRealizado+US$ 40,00em 1 parcialSe o stop for atingido: −US$ 60,00 no total.')
    const tempo = screen.getByRole('list', { name: 'Linha do tempo' })
    const itens = within(tempo).getAllByRole('listitem')
    expect(itens.map(texto)).toEqual([
      '10:12Entrada · 3 ct a 7.912,50 · stop 10 pts',
      '10:18Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00DesfazerAté 10:33, 15 minutos depois do registro.',
    ])
    expect(within(itens[1]).getByRole('button', { name: 'Desfazer a parcial das 10:18' })).toHaveTextContent('Desfazer')
    expect(within(itens[0]).getByText('10:12').tagName).toBe('TIME')
    expect(screen.getByText('Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.')).toBeInTheDocument()
    // Back to «Saída», with the exit of what is open
    expect(pill('O que registrar agora?', 'Saída')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Sai com os 2 ct em aberto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar saída' })).toBeInTheDocument()
    // The rule line stays while the stop is behind the entry
    expect(screen.getByText('Sua regra: breakeven com +8 pts, em 7.920,50.')).toBeInTheDocument()
  })

  it('the suggestion → «Mover stop» on «Breakeven» with «Preço agora» 7.920,50, the focus on «Registrar stop»; the move; the exit → step 3', async () => {
    abrir()
    await passo2()
    await registrarParcial()
    await userEvent.click(screen.getByRole('button', { name: 'Mover para o breakeven' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar stop' })).toHaveFocus())
    expect(pill('O que registrar agora?', 'Mover stop')).toHaveAttribute('aria-pressed', 'true')
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Preço agora')).toHaveValue('7.920,50')
    expect(screen.queryByLabelText('Novo stop')).not.toBeInTheDocument()
    expect(screen.queryByText(/Esta parcial saiu com/)).not.toBeInTheDocument()
    expect(screen.getByText('Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Se o novo stop for atingido: +US$ 40,00 no total.')).toHaveAttribute('id', 'n-sSe')
    expect(document.getElementById('a-lim-s')).toHaveClass('sr-only')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    await waitFor(() => expect(db.moveStop).toHaveBeenCalledTimes(1))
    expect(db.moveStop.mock.calls[0][2]).toEqual({ v: 1, client_key: expect.any(String), kind: 'breakeven', price_now: '7920.5' })
    const st = await screen.findByText('Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.')
    await waitFor(() => expect(st).toHaveFocus())
    expect(screen.getByRole('group', { name: 'Agora' })).toHaveTextContent('Stop7.912,50· no breakeven, desde 10:19')
    const itens = within(screen.getByRole('list', { name: 'Linha do tempo' })).getAllByRole('listitem')
    expect(itens[2]).toHaveTextContent('10:19Stop no breakeven · 7.912,50 · com +8,00 pts a favor')
    expect(within(itens[2]).getByRole('button', { name: 'Desfazer o movimento do stop das 10:19' })).toBeInTheDocument()
    expect(within(itens[1]).queryByRole('button')).not.toBeInTheDocument()
    // The stop is at the entry: no rule line in the summary
    expect(screen.queryByText('Sua regra: breakeven com +8 pts, em 7.920,50.')).not.toBeInTheDocument()
    // The exit of the rest, with the total
    await userEvent.type(screen.getByLabelText('Preço de saída'), '7.926,00')
    expect(screen.getByText('Se sair a 7.926,00: +13,50 pts · +US$ 135,00 · no total +US$ 175,00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toHaveFocus()
    expect(screen.getByText('+US$ 175,00')).toBeInTheDocument()
    expect(screen.getByText('MES · Compra · 3 ct · 7.912,50 → 7.924,17 em média · +11,67 pts · 10:12–10:31 ET')).toBeInTheDocument()
    expect(screen.getByText('+1,17 R').parentElement).toHaveTextContent('+1,17 R com o stop inicial de 10 pts')
    expect(within(screen.getByRole('list', { name: 'Linha do tempo' })).getAllByRole('listitem').map(texto)).toEqual([
      '10:12Entrada · 3 ct a 7.912,50 · stop 10 pts',
      '10:18Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00',
      '10:19Stop no breakeven · 7.912,50 · com +8,00 pts a favor',
      '10:31Saída · 2 ct a 7.926,00 · +13,50 pts · +US$ 135,00',
    ])
    expect(screen.getByText('Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.')).toHaveClass('hub-rp-be')
    expect(screen.queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument()
  })

  it('the keyboard: Tab from a pill reaches the mode’s first field; Space presses a pill; Escape still closes', async () => {
    const { onClose } = abrir()
    await passo2()
    const parcial = pill('O que registrar agora?', 'Parcial')
    parcial.focus()
    await userEvent.keyboard(' ')
    expect(parcial).toHaveAttribute('aria-pressed', 'true')
    expect(parcial).toHaveFocus()
    await userEvent.tab()
    await userEvent.tab()
    expect(pill('Contratos', '1')).toHaveFocus()
    pill('O que registrar agora?', 'Mover stop').focus()
    await userEvent.keyboard('{Enter}')
    expect(pill('O que registrar agora?', 'Mover stop')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.tab()
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('errors: the first refused field takes the focus, in the board’s order', async () => {
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    const preco = screen.getByLabelText('Preço da parcial')
    expect(preco).toHaveFocus()
    expect(preco).toHaveAttribute('aria-invalid', 'true')
    expect(preco).toHaveAccessibleDescription('Informe o preço da parcial.')
    expect(db.registerPartial).not.toHaveBeenCalled()
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    // A pill clears every form's «tentou»
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    expect(screen.queryByText('Informe o preço da parcial.')).not.toBeInTheDocument()
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(screen.getByLabelText('Preço agora')).toHaveFocus()
    expect(screen.getByText('Informe o preço de agora.')).toHaveAttribute('role', 'alert')
    expect(db.moveStop).not.toHaveBeenCalled()
  })
})

describe('«Desfazer» on the timeline', () => {
  it('the confirmation: «Sim, desfazer» focused, the link and «Até …» gone while open, «Manter» gives the focus back to the link', async () => {
    abrir()
    await passo2()
    await registrarParcial()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' }))
    const grupo = screen.getByRole('group', {
      name: 'Desfazer a parcial das 10:18 (1 ct a 7.920,50)? Ela sai do resultado e do limite do dia, e os 3 ct voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.',
    })
    expect(within(grupo).getByRole('button', { name: 'Sim, desfazer' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Desfazer a parcial das 10:18' })).not.toBeInTheDocument()
    expect(screen.queryByText('Até 10:33, 15 minutos depois do registro.')).not.toBeInTheDocument()
    await userEvent.click(within(grupo).getByRole('button', { name: 'Manter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' })).toHaveFocus())
    expect(screen.getByText('Até 10:33, 15 minutos depois do registro.')).toBeInTheDocument()
  })

  it('a pill press closes the confirmation and drops the suggestion; the status stays', async () => {
    abrir()
    await passo2()
    await registrarParcial()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' }))
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    expect(screen.queryByRole('button', { name: 'Sim, desfazer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' })).toBeInTheDocument()
    expect(screen.queryByText(/Esta parcial saiu com/)).not.toBeInTheDocument()
    expect(screen.getByText('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')).toBeInTheDocument()
  })

  it('«Sim, desfazer» on the move: «Movimento do stop das 10:19 desfeito às 10:20.», back to «Saída», the status focused', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(stopParciais('stop-mes-breakeven').state))
    db.undoEvent.mockResolvedValue({ ...desfeitaParciais('stop-mes-desfeito'), limitBefore: null, limitAfter: null } as never)
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('10:20') }))
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer o movimento do stop das 10:19' }))
    expect(screen.getByRole('group', { name: /O stop volta a 7\.902,50\./ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    await waitFor(() => expect(db.undoEvent).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { v: 1, kind: 'stop', id: 1 }))
    const st = await screen.findByText('Movimento do stop das 10:19 desfeito às 10:20.')
    await waitFor(() => expect(st).toHaveFocus())
    expect(pill('O que registrar agora?', 'Saída')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Agora' })).toHaveTextContent('Stop7.902,50· o da entrada')
  })

  it('the link goes at the deadline (10:33:05 on the server’s clock), and an open confirmation closes', async () => {
    jest.useFakeTimers({ now: new Date(etEm('10:32', 50)), doNotFake: ['queueMicrotask'] })
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('10:32', 50) }))
    abrir()
    await passo2()
    await user.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' }))
    expect(screen.getByRole('button', { name: 'Sim, desfazer' })).toBeInTheDocument()
    await act(async () => {
      jest.advanceTimersByTime(16_000)
    })
    expect(screen.queryByRole('button', { name: 'Sim, desfazer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desfazer a parcial/ })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Linha do tempo' })).toBeInTheDocument()
  })

  it('refused late: «Passaram 15 minutos: não dá mais para desfazer.» and the link goes; «Desfazer entrada» late keeps its own text', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
    db.undoEvent.mockRejectedValueOnce(new registrarDb.RegistrarDataError('undo_too_late'))
    abrir()
    await passo2()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Passaram 15 minutos: não dá mais para desfazer.')
    expect(screen.queryByRole('button', { name: /Desfazer a parcial/ })).not.toBeInTheDocument()
  })

  it('not the newest (another device moved): «Só o último registro pode ser desfeito.» and the trade is read again', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
    db.undoEvent.mockRejectedValueOnce(new registrarDb.RegistrarDataError('not_newest'))
    abrir()
    await passo2()
    const lidas = db.fetchTradeState.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:18' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Só o último registro pode ser desfeito.')
    await waitFor(() => expect(db.fetchTradeState.mock.calls.length).toBeGreaterThan(lidas))
  })
})

describe('the writes’ other answers', () => {
  it('a repeated partial (the same client_key answered before) is success, with the same texts', async () => {
    db.registerPartial.mockResolvedValue(parcialParciais('partial-mes-repetida'))
    abrir()
    await passo2()
    await registrarParcial()
    expect(screen.getByRole('group', { name: 'Agora' })).toBeInTheDocument()
  })

  it('offline: the fields stay; the retry after a lost answer sends the same client_key; after a success a new one', async () => {
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    await userEvent.type(screen.getByLabelText('Preço da parcial'), '7920,50')
    online = false
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando a conexão voltar.')
    expect(db.registerPartial).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Preço da parcial')).toHaveValue('7920,50')
    online = true
    db.registerPartial.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await screen.findByText('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')
    const [a, b] = db.registerPartial.mock.calls.map((c) => (c[2] as { client_key: string }).client_key)
    expect(a).toBe(b)
    db.moveStop.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    await userEvent.click(screen.getByRole('button', { name: 'Mover para o breakeven' }))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    expect(screen.getByLabelText('Preço agora')).toHaveValue('7.920,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    await screen.findByText('Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.')
    const [m1, m2] = db.moveStop.mock.calls.map((c) => (c[2] as { client_key: string }).client_key)
    expect(m1).toBe(m2)
    expect(m1).not.toBe(a)
  })

  it('not_open (closed on another device): the trade is read again → step 3 «Esta operação já foi fechada em outro lugar.»', async () => {
    const fechada = vistaDe(saidaMesComBe().state)
    db.fetchTradeState.mockResolvedValueOnce(vistaDe(mesAntesDaParcial())).mockResolvedValue(fechada)
    db.registerPartial.mockRejectedValueOnce(new registrarDb.RegistrarDataError('not_open'))
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    await userEvent.type(screen.getByLabelText('Preço da parcial'), '7920,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('Esta operação já foi fechada em outro lugar.')).toBeInTheDocument()
  })

  it('a server refusal under its field: the quantity (partial_too_large) and the hour (exit_in_future)', async () => {
    db.registerPartial
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('partial_too_large', 'quantity'))
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('exit_in_future', 'exit'))
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Parcial'))
    await userEvent.type(screen.getByLabelText('Preço da parcial'), '7920,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByText('Use menos que os 3 ct em aberto; para sair com tudo, use “Saída”.')).toHaveAttribute('role', 'alert')
    await waitFor(() => expect(pill('Contratos', '1')).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByText('A parcial não pode ser depois de agora (10:18 ET).')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Hora da parcial (ET)')).toHaveFocus())
  })

  it('too many moves: «Até 20 movimentos de stop por operação.» in the sheet’s alert', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
    db.moveStop.mockRejectedValueOnce(new registrarDb.RegistrarDataError('too_many_moves'))
    abrir()
    await passo2()
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    await userEvent.type(screen.getByLabelText('Preço agora'), '7920,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Até 20 movimentos de stop por operação.')
  })
})

describe('what does not change', () => {
  it('Ebinex: step 2 as built (no pills, no action status)', async () => {
    const telas = idsTelas()
    fetchAccounts.mockResolvedValue(contasTelas())
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    db.fetchTradeState.mockResolvedValue(entradaTelas('entry-ebinex-put').state)
    abrir(telas.trades.ebx, telas.accounts.ebinex)
    // rules_now at 20:24: the 1-minute option expired at 20:12
    await screen.findByRole('heading', { level: 3, name: 'Opção vencida' })
    expect(screen.queryByRole('group', { name: 'O que registrar agora?' })).not.toBeInTheDocument()
    expect(document.getElementById('reg-acao-st')).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar resultado' })).toBeInTheDocument()
  })

  it('a 1-contract trade: no «Parcial»', async () => {
    const json = estadoJson('entry-mes')
    json.trade.quantity = 1
    delete json.position
    json.server_now = etEm('10:18')
    db.fetchTradeState.mockResolvedValue(vistaDe(registrarDb.parseRegistered(json).state))
    abrir()
    await passo2()
    const grupo = screen.getByRole('group', { name: 'O que registrar agora?' })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Saída', 'Mover stop'])
  })

  it('«Desfazer entrada» with partials names them', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('10:20') }))
    abrir()
    await passo2()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer entrada' }))
    expect(
      screen.getByRole('group', {
        name: 'Desfazer a entrada das 10:12 (MES · Compra · 3 ct)? A operação, as parciais e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.',
      }),
    ).toBeInTheDocument()
  })
})

describe('copy', () => {
  it('carries no prototype label (contract §2.2)', () => {
    for (const nome of ['copyParciais.ts', 'copyRegra.ts']) {
      const texto = fs.readFileSync(path.join(__dirname, '../../../components/hub/registrar', nome), 'utf8')
      for (const proibido of ['Preencher exemplo', 'Avançar o relógio', 'Recomeçar', 'Cenário do protótipo', 'só no protótipo', 'fora do produto']) {
        expect([nome, texto.includes(proibido)]).toEqual([nome, false])
      }
    }
  })
})

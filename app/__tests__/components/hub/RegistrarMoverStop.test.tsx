/**
 * Phase 3c · lane C1: «Mover stop» (E25) on the sheet: the default («Breakeven», or «Outro preço»
 * once the stop is at the entry), «Preço agora» required with «Breakeven» and optional with «Outro
 * preço» (P1: «Outro preço» exactly at the entry without it is sent as typed and answered as an
 * «ajuste» with no points, read «Stop no breakeven (7.930,00) às 11:31 ET.»), the board's errors
 * under the right field, «Confira o preço de agora.» on EUR/USD, the server's refusals (§3.3), the
 * payloads and the day's limit warning (`#a-lim-s`, `aria-describedby` on «Novo stop»).
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
import {
  agoraParciais,
  contasParciais,
  estadoJson,
  etEm,
  mnqAntesDaParcial,
  parcialParciais,
  stopParciais,
  vistaDe,
} from '@/testing/parciaisTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewExit: jest.fn(),
  moveStop: jest.fn(),
  drainImageTrash: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const ids = idsParciais()

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  ;(contasDb.fetchAccounts as jest.Mock).mockResolvedValue(contasParciais())
  ;(contasDb.fetchPreferences as jest.Mock).mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('10:19') }))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-mes').state))
  db.moveStop.mockReset()
})

function abrir(tradeId: string = ids.trades.mes, accountId: string = ids.accounts.topOne) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
  return { queryClient }
}

const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })

async function moverStop() {
  await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
  await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
}

/** The MES 2 ct a 7.930,00 (stop 7.920,00) of the P1 recordings, before its move (11:31) */
function mesEntradaAntes(): registrarDb.TradeView {
  const json = estadoJson('stop-mes-entrada-ajuste')
  json.stop_moves = []
  delete json.position
  return vistaDe(registrarDb.parseTradeState(json))
}

describe('«Para onde?»', () => {
  it('«Breakeven · 7.912,50» pressed while the stop is behind the entry; «Outro preço» opens «Novo stop» and focuses it', async () => {
    abrir()
    await moverStop()
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Para onde?' }).querySelector('#g-sModo-0')).toBe(pill('Para onde?', 'Breakeven · 7.912,50'))
    expect(screen.getByText('Preço agora')).not.toHaveTextContent('opcional')
    expect(screen.getByRole('button', { name: 'Registrar stop' })).toBeInTheDocument()
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await waitFor(() => expect(screen.getByLabelText('Novo stop')).toHaveFocus())
    expect(screen.getByText('· opcional')).toHaveClass('hub-opc')
  })

  it('the stop already at the entry: «Outro preço» pressed; «Breakeven» then says «O stop já está em 7.912,50.» under the group', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(stopParciais('stop-mes-breakeven').state))
    abrir()
    await moverStop()
    expect(pill('Para onde?', 'Outro preço')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Para onde?', 'Breakeven · 7.912,50'))
    await userEvent.type(screen.getByLabelText('Preço agora'), '7925')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    const erro = screen.getByText('O stop já está em 7.912,50.')
    expect(erro).toHaveAttribute('id', 'e-sModo')
    expect(screen.getByRole('group', { name: 'Para onde?' })).toHaveAttribute('aria-describedby', 'e-sModo')
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveFocus()
    expect(db.moveStop).not.toHaveBeenCalled()
  })
})

describe('P1 · «Outro preço» exactly at the entry', () => {
  it('without «Preço agora»: no error, sent as typed (an «ajuste», no price_now), read «Stop no breakeven (7.930,00) às 11:31 ET.»', async () => {
    db.fetchTradeState.mockResolvedValue(mesEntradaAntes())
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('11:31') }))
    db.moveStop.mockResolvedValue(stopParciais('stop-mes-entrada-ajuste'))
    abrir(ids.trades.mesEntrada)
    await moverStop()
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await userEvent.type(screen.getByLabelText(/^Novo stop/), '7.930,00')
    expect(screen.getByLabelText(/Preço agora/)).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    await waitFor(() => expect(db.moveStop).toHaveBeenCalledTimes(1))
    expect(db.moveStop.mock.calls[0][2]).toEqual({ v: 1, client_key: expect.any(String), kind: 'ajuste', stop_price: '7930' })
    expect(await screen.findByText('Stop no breakeven (7.930,00) às 11:31 ET.')).toHaveAttribute('id', 'reg-acao-st')
    expect(screen.getByRole('group', { name: 'Agora' })).toHaveTextContent('Stop7.930,00· no breakeven, desde 11:31')
    expect(within(screen.getByRole('list', { name: 'Linha do tempo' })).getAllByRole('listitem')[1]).toHaveTextContent(/^11:31Stop no breakeven · 7\.930,00Desfazer/)
  })

  it('with «Preço agora» 7.934,25 (after «Desfazer»): «Stop no breakeven (7.930,00) às 11:32 ET, com +4,25 pts a favor.»', async () => {
    const json = estadoJson('stop-mes-entrada-breakeven')
    json.stop_moves = (json.stop_moves as { voided_at: string | null }[]).filter((m) => m.voided_at !== null)
    delete json.position
    db.fetchTradeState.mockResolvedValue(vistaDe(registrarDb.parseTradeState(json)))
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('11:32') }))
    db.moveStop.mockResolvedValue(stopParciais('stop-mes-entrada-breakeven'))
    abrir(ids.trades.mesEntrada)
    await moverStop()
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await userEvent.type(screen.getByLabelText(/^Novo stop/), '7.930,00')
    await userEvent.type(screen.getByLabelText(/Preço agora/), '7.934,25')
    expect(screen.getByText('Com +4,25 pts a favor. Sua regra: breakeven com +8 pts.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    await waitFor(() => expect(db.moveStop).toHaveBeenCalledTimes(1))
    expect(db.moveStop.mock.calls[0][2]).toEqual({ v: 1, client_key: expect.any(String), kind: 'ajuste', stop_price: '7930', price_now: '7934.25' })
    expect(await screen.findByText('Stop no breakeven (7.930,00) às 11:32 ET, com +4,25 pts a favor.')).toBeInTheDocument()
  })
})

describe('the board’s checks, under the right field', () => {
  it('the side: under «Preço agora» with «Breakeven», under «Novo stop» with «Outro preço»; the same stop; the tick', async () => {
    abrir()
    await moverStop()
    await userEvent.type(screen.getByLabelText('Preço agora'), '7.909,50')
    expect(screen.getByText('Com 3,00 pts contra. Sua regra: breakeven com +8 pts.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(screen.getByLabelText('Preço agora')).toHaveAccessibleDescription('Numa compra, o stop fica abaixo do preço de agora.')
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '7.902,50')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(screen.getByLabelText('Novo stop')).toHaveAccessibleDescription('O stop já está em 7.902,50.')
    await userEvent.clear(screen.getByLabelText('Novo stop'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '7915,3')
    expect(screen.getByLabelText('Novo stop')).toHaveAccessibleDescription('O MES anda de 0,25 em 0,25; confira o preço.')
    await userEvent.clear(screen.getByLabelText('Novo stop'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '7925')
    await userEvent.clear(screen.getByLabelText(/Preço agora/))
    await userEvent.type(screen.getByLabelText(/Preço agora/), '7920,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(screen.getByLabelText('Novo stop')).toHaveAccessibleDescription('Numa compra, o stop fica abaixo do preço de agora.')
    expect(screen.getByLabelText('Novo stop')).toHaveFocus()
    expect(db.moveStop).not.toHaveBeenCalled()
  })

  it('EUR/USD: «Confira o preço de agora.» for a price whose pips do not fit a stop move', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(parcialParciais('partial-eurusd').state))
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-top-1018', { iso: etEm('11:17', 30) }))
    abrir(ids.trades.eur, ids.accounts.ftmo)
    await moverStop()
    expect(pill('Para onde?', 'Breakeven · 1,08520')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Preço agora'), '2.000.000')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(screen.getByLabelText('Preço agora')).toHaveAccessibleDescription('Confira o preço de agora.')
    expect(db.moveStop).not.toHaveBeenCalled()
    await userEvent.clear(screen.getByLabelText('Preço agora'))
    await userEvent.type(screen.getByLabelText('Preço agora'), '1,08650')
    expect(screen.getByText('Com +13,0 pips a favor. Sua regra: breakeven com +7,5 pips.')).toBeInTheDocument()
  })
})

describe('the server’s refusals (§3.3)', () => {
  it('bad_stop on «Preço agora», same_stop on «Novo stop»: under their fields with the local texts; off_tick: its own text', async () => {
    db.moveStop
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('bad_stop', 'price_now'))
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('same_stop', 'stop_price'))
      .mockRejectedValueOnce(new registrarDb.RegistrarDataError('off_tick', 'stop_price'))
    abrir()
    await moverStop()
    await userEvent.type(screen.getByLabelText('Preço agora'), '7920,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByText('Numa compra, o stop fica abaixo do preço de agora.')).toHaveAttribute('id', 'e-sAgora')
    await waitFor(() => expect(screen.getByLabelText('Preço agora')).toHaveFocus())
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '7905')
    const lidas = db.fetchTradeState.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    // same_stop: the stop is already where it was sent (moved there elsewhere): that level, and the trade read again
    expect(await screen.findByText('O stop já está em 7.905,00.')).toHaveAttribute('id', 'e-sNovo')
    expect(db.fetchTradeState.mock.calls.length).toBe(lidas + 1)
    await userEvent.clear(screen.getByLabelText('Novo stop'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '7904')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByText('Confira o preço: ele não anda nesse passo.')).toHaveAttribute('id', 'e-sNovo')
    expect(db.moveStop).toHaveBeenCalledTimes(3)
  })

  it('same_stop on «Breakeven» (moved to the entry elsewhere): under «Para onde?», «Breakeven» still pressed, the fresh «Agora»', async () => {
    db.fetchTradeState.mockResolvedValueOnce(vistaDe(parcialParciais('partial-mes').state)).mockResolvedValue(vistaDe(stopParciais('stop-mes-breakeven').state))
    db.moveStop.mockRejectedValueOnce(new registrarDb.RegistrarDataError('same_stop', 'stop_price'))
    abrir()
    await moverStop()
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Preço agora'), '7920,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByText('O stop já está em 7.912,50.')).toHaveAttribute('id', 'e-sModo')
    expect(screen.getByRole('group', { name: 'Para onde?' })).toHaveAttribute('aria-describedby', 'e-sModo')
    expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(pill('Para onde?', 'Breakeven · 7.912,50')).toHaveFocus())
    expect(screen.getByRole('group', { name: 'Agora' })).toHaveTextContent('Stop7.912,50· no breakeven, desde 10:19')
    expect(db.fetchTradeState).toHaveBeenCalledTimes(2)
  })

  it('not_app_trade and the like: the sheet’s alert', async () => {
    db.moveStop.mockRejectedValueOnce(new registrarDb.RegistrarDataError('not_app_trade'))
    abrir()
    await moverStop()
    await userEvent.type(screen.getByLabelText('Preço agora'), '7920,5')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar stop' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta operação veio do arquivo e não pode ser mudada aqui.')
  })
})

describe('the day’s limit (scenario 16 before its partial: −US$ 300 of US$ 400)', () => {
  it('a new stop whose loss passes what is left: the warning in #a-lim-s, described by «Novo stop»; a closer stop: none', async () => {
    db.fetchTradeState.mockResolvedValue(vistaDe(mnqAntesDaParcial()))
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-apex-1055', { min: -28 }))
    abrir(ids.trades.mnq, ids.accounts.apex)
    await moverStop()
    await userEvent.click(pill('Para onde?', 'Outro preço'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '30.820,00')
    const aviso = screen.getByText('Se o novo stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 360.')
    expect(aviso).toHaveAttribute('id', 'a-lim-s')
    expect(aviso).toHaveClass('hub-reg-aviso-lim')
    expect(aviso).toHaveAttribute('role', 'status')
    expect(screen.getByLabelText('Novo stop')).toHaveAttribute('aria-describedby', 'a-lim-s')
    await userEvent.clear(screen.getByLabelText('Novo stop'))
    await userEvent.type(screen.getByLabelText('Novo stop'), '30.865,00')
    expect(document.getElementById('a-lim-s')).toHaveClass('sr-only')
    expect(document.getElementById('a-lim-s')).toHaveTextContent('')
    expect(screen.getByLabelText('Novo stop')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByText('Se o novo stop for atingido: −US$ 90,00 no total.')).toBeInTheDocument()
  })
})

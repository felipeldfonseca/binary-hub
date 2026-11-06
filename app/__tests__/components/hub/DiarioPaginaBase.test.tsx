/**
 * Fase 4 · telas (B0): the Diário page's frame and shared state (DiarioPagina, useDiarioPagina; contract §4.2–§4.4,
 * §4.10) on the approved boards' scenarios (testing/diarioTelas, invented data). The regions are B0's stubs; a probe
 * in the top region's place reads the shared state. Covers the URL ↔ state rules on load and while mounted, the reset
 * on an account change, the leave guard, «Registrar operação» on a past day, the open day's region in its slot (lane
 * L2's «o dia», which retired the Phase 3 bridge), C7 when the Phase 4 SQL is missing, and the page following the selector at once (moved from
 * OperacoesDoDia.test).
 */
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import { hubKeys } from '@/hooks/useContas'
import { RegrasDataError } from '@/lib/hub/regrasDb'
import type { DiarioPaginaValor } from '@/components/hub/diario/useDiarioPagina'
import { contaDiarioDe, diaDaUrl, diaPassadoDoDiario } from '@/lib/hub/diarioPagina'
import { mocks, renderDiario } from '@/testing/diarioTelas'
import { navegacao, USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import { idsQuadro } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

// The probe: the top region's stub, replaced by one that keeps the shared state for the test
let mockPagina: DiarioPaginaValor | null = null
jest.mock('@/components/hub/diario/TopoDoDiario', () => ({
  __esModule: true,
  default: function SondaDaPagina() {
    const p = require('@/components/hub/diario/useDiarioPagina').useDiarioPagina()
    mockPagina = p
    return (
      <p data-testid="sonda" data-conta={p.conta.id} data-dia={p.dia ?? ''} data-mes={p.mes ?? ''} data-semana={p.semana ?? ''} data-op={p.opPedida ?? ''}>
        {p.conta.label}
      </p>
    )
  },
}))

// «Registrar operação»: what the header asks the sheet (the sheet itself is lane L2's)
const mockAbrirRegistrar = jest.fn()
jest.mock('@/components/hub/registrar/abrir', () => ({
  ...jest.requireActual('@/components/hub/registrar/abrir'),
  useRegistrarSheet: () => ({ open: mockAbrirRegistrar, isOpen: false }),
}))

const ids = idsQuadro()
const pagina = () => mockPagina as DiarioPaginaValor
const sonda = () => screen.getByTestId('sonda')

async function carregada() {
  await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)))
}

beforeEach(() => {
  mockPagina = null
  mockAbrirRegistrar.mockReset()
})

describe('the frame: the boards’ order, the open day in its slot', () => {
  it('H1 → selector → «Posso operar hoje?» → the open day’s region (lane L2’s «o dia»), one read of rules_now', async () => {
    await renderDiario('2')
    await carregada()
    const h1 = screen.getByRole('heading', { level: 1, name: 'Diário' })
    const selector = await screen.findByRole('button', { name: /^Conta: Top One/ })
    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    const dia = await screen.findByRole('region', { name: 'Terça-feira, 10 de novembro' })
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(h1, selector)).toBe(true)
    expect(follows(selector, card)).toBe(true)
    expect(follows(card, dia)).toBe(true)
    expect(await within(dia).findByRole('heading', { level: 3, name: 'Operações do dia' })).toBeInTheDocument()
    expect(screen.queryByText('O Diário chega na Fase 4.')).toBeNull()
    expect(mocks.fetchRulesNow).toHaveBeenCalledTimes(1)
  })

  it('reads the calendar, the open day’s month and the open day of the open account', async () => {
    const { q } = await renderDiario('2')
    await carregada()
    await waitFor(() => expect(mocks.fetchDia).toHaveBeenCalledWith(expect.anything(), q.info.contaId, '2026-11-10'))
    expect(mocks.fetchCalendario).toHaveBeenCalledWith(expect.anything(), q.info.contaId)
    expect(mocks.fetchMes).toHaveBeenCalledWith(expect.anything(), q.info.contaId, '2026-11')
    expect(pagina().hoje).toBe('2026-12-01')
    expect(pagina().desdeDay).toBe('2026-10-14')
    expect(pagina().contaDiario).toEqual({ currency: 'USD', market: 'futures', tz: 'America/New_York' })
    expect(pagina().contaReg.id).toBe(q.info.contaId)
    expect(pagina().regras?.limit?.atLimit).toBe('encerrar')
  })

  it('C7 when the Phase 4 SQL is missing: «Não foi possível carregar o Diário.» (role and text)', async () => {
    await renderDiario('10d', { estado: 'erro' })
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar o Diário.')
    expect(document.getElementById('dia')).toBeNull()
  })

  it('nothing below the card while the calendar is read', async () => {
    await renderDiario('10c', { estado: 'carregando' })
    await screen.findByRole('region', { name: 'Posso operar hoje?' })
    expect(sonda()).toHaveAttribute('data-dia', '')
    expect(document.getElementById('dia')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the URL and the shared state', () => {
  it('on load: ?dia= is the open day, its month and its week are shown', async () => {
    await renderDiario('2')
    await carregada()
    expect(sonda()).toHaveAttribute('data-dia', '2026-11-10')
    expect(sonda()).toHaveAttribute('data-mes', '2026-11')
    expect(sonda()).toHaveAttribute('data-semana', '2026-11-09')
  })

  it('a ?dia= after today, or not a day, opens today', async () => {
    const { q } = await renderDiario('2')
    await carregada()
    act(() => navegacao.definir(`/diario?conta=${q.info.contaId}&dia=2026-12-02`))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-12-01'))
    act(() => navegacao.definir(`/diario?conta=${q.info.contaId}&dia=2026-02-30`))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-12-01'))
  })

  it('a ?op= on load is the trade asked for, and leaves the URL; consumirOp clears it', async () => {
    const { q } = await renderDiario('2')
    act(() => navegacao.definir(`/diario?conta=${q.info.contaId}&dia=2026-11-10&op=abc`))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-op', 'abc'))
    expect(navegacao.params().get('op')).toBeNull()
    expect(navegacao.params().get('dia')).toBe('2026-11-10')
    expect(navegacao.replace).toHaveBeenLastCalledWith(`/diario?conta=${q.info.contaId}&dia=2026-11-10`, { scroll: false })
    act(() => pagina().consumirOp())
    await waitFor(() => expect(sonda()).toHaveAttribute('data-op', ''))
  })

  it('a URL pushed while mounted (Ver no Diário, back and forward): the day, its month and week, and the trade', async () => {
    const { q } = await renderDiario('2')
    await carregada()
    act(() => pagina().mostrarMes('2026-10'))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-mes', '2026-10'))
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=2026-11-24&op=t-24`))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-11-24'))
    expect(sonda()).toHaveAttribute('data-mes', '2026-11')
    expect(sonda()).toHaveAttribute('data-semana', '2026-11-23')
    await waitFor(() => expect(sonda()).toHaveAttribute('data-op', 't-24'))
    expect(navegacao.params().get('op')).toBeNull()
    await waitFor(() => expect(mocks.fetchDia).toHaveBeenCalledWith(expect.anything(), q.info.contaId, '2026-11-24'))
  })

  it('abrirDia: ?dia= by replace without scrolling, the day’s month, the week reset, «Aberto abaixo» when asked; today drops ?dia=', async () => {
    const { q } = await renderDiario('2')
    await carregada()
    act(() => pagina().abrirSemana('2026-11-02'))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-semana', '2026-11-02'))
    expect(pagina().semanaAnunciada).toBe('2026-11-02')
    act(() => pagina().mostrarMes('2026-09'))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-mes', '2026-09'))

    act(() => pagina().abrirDia('2026-10-14', { anunciar: true }))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-10-14'))
    expect(navegacao.replace).toHaveBeenLastCalledWith(`/diario?conta=${q.info.contaId}&dia=2026-10-14`, { scroll: false })
    expect(sonda()).toHaveAttribute('data-mes', '2026-10')
    expect(sonda()).toHaveAttribute('data-semana', '2026-10-12')
    expect(pagina().diaAnunciado).toBe('2026-10-14')

    act(() => pagina().abrirDia('2026-12-01', { op: 'x' }))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-12-01'))
    expect(navegacao.params().has('dia')).toBe(false)
    expect(sonda()).toHaveAttribute('data-op', 'x')
    // not asked to announce: the last announced day stays
    expect(pagina().diaAnunciado).toBe('2026-10-14')
  })

  it('another account (the URL’s ?conta=): every state starts again, without remounting the header', async () => {
    const { q } = await renderDiario('2')
    await carregada()
    const selector = screen.getByRole('button', { name: /^Conta: Top One/ })
    act(() => {
      pagina().abrirSemana('2026-11-02')
      pagina().mostrarMes('2026-10')
    })
    await waitFor(() => expect(sonda()).toHaveAttribute('data-mes', '2026-10'))
    act(() => navegacao.definir(`/diario?conta=${ids.accounts.lucid}`))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-conta', ids.accounts.lucid))
    // Lucid's calendar is not exported in scenario 2's world: no day until it answers
    expect(pagina().semanaAnunciada).toBeNull()
    expect(pagina().diaAnunciado).toBeNull()
    expect(screen.getByRole('button', { name: /^Conta: Lucid 50k/ })).toBe(selector)
    expect(q.info.contaId).not.toBe(ids.accounts.lucid)
  })
})

describe('the account selector and the leave guard', () => {
  it('choosing another account drops ?dia= and ?op= (a day of another account means nothing)', async () => {
    const { user, q } = await renderDiario('2')
    await carregada()
    await user.click(screen.getByRole('button', { name: /^Conta: Top One/ }))
    await user.click(screen.getByRole('button', { name: /^Lucid 50k/ }))
    await waitFor(() => expect(navegacao.params().get('conta')).toBe(ids.accounts.lucid))
    expect(navegacao.params().has('dia')).toBe(false)
    expect(navegacao.params().has('op')).toBe(false)
    expect(q.info.contaId).toBe(ids.accounts.top)
  })

  it('confirmarSaida: true without a guard; a guard that says no keeps the URL and the account, and abrirDia does nothing', async () => {
    const { user, q } = await renderDiario('2')
    await carregada()
    await expect(pagina().confirmarSaida()).resolves.toBe(true)
    const guarda = jest.fn(async () => false)
    act(() => pagina().registrarGuarda(guarda))
    await expect(pagina().confirmarSaida()).resolves.toBe(false)

    const antes = navegacao.url()
    await user.click(screen.getByRole('button', { name: /^Conta: Top One/ }))
    await user.click(screen.getByRole('button', { name: /^Lucid 50k/ }))
    await waitFor(() => expect(guarda).toHaveBeenCalledTimes(2))
    expect(navegacao.url()).toBe(antes)
    expect(sonda()).toHaveAttribute('data-conta', q.info.contaId)
    expect(mocks.mergePreferences).not.toHaveBeenCalled()

    await act(async () => {
      pagina().abrirDia('2026-11-24')
      await Promise.resolve()
    })
    await waitFor(() => expect(guarda).toHaveBeenCalledTimes(3))
    expect(sonda()).toHaveAttribute('data-dia', '2026-11-10')

    // The guard says yes: both go on
    guarda.mockResolvedValue(true)
    act(() => pagina().abrirDia('2026-11-24'))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-11-24'))
    await user.click(screen.getByRole('button', { name: /^Conta: Top One/ }))
    await user.click(screen.getByRole('button', { name: /^Lucid 50k/ }))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-conta', ids.accounts.lucid))
    act(() => pagina().registrarGuarda(null))
  })

  it('follows the account chosen in the selector at once, even when the choice cannot be saved', async () => {
    const { user } = await renderDiario('6')
    mocks.mergePreferences.mockRejectedValue(new RegrasDataError('network'))
    await carregada()
    await user.click(screen.getByRole('button', { name: /^Conta: Ebinex/ }))
    await user.click(screen.getByRole('button', { name: /^Top One/ }))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-conta', ids.accounts.top))
    expect(screen.getByRole('button', { name: /^Conta: Top One/ })).toBeInTheDocument()
    await waitFor(() => expect(mocks.mergePreferences).toHaveBeenCalled())
  })

  it('keeps the header and the page on the same account when the preferences are read again after a failed save', async () => {
    const view = await renderDiario('6')
    mocks.mergePreferences.mockRejectedValue(new RegrasDataError('network'))
    await carregada()
    await view.user.click(screen.getByRole('button', { name: /^Conta: Ebinex/ }))
    await view.user.click(screen.getByRole('button', { name: /^Top One/ }))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-conta', ids.accounts.top))
    await waitFor(() => expect(mocks.mergePreferences).toHaveBeenCalled())

    // An import's refresh (or a reconnect) reads the preferences again: still without the choice
    await act(() => view.queryClient.invalidateQueries({ queryKey: hubKeys.preferencias(USUARIO_DO_QUADRO) }))
    await waitFor(() => expect(mocks.fetchPreferences).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /^Conta: Top One/ })).toBeInTheDocument()
    expect(sonda()).toHaveAttribute('data-conta', ids.accounts.top)
    // The choice is in the URL, which the header and the page read first
    expect(navegacao.params().get('conta')).toBe(ids.accounts.top)
  })
})

describe('lib/hub/diarioPagina (pure)', () => {
  it('contaDiarioDe: the currency and market, hours on the window’s clock, else the market’s', () => {
    const futuros = { market: 'futures' as const }
    expect(contaDiarioDe(futuros, null)).toEqual({ currency: 'USD', market: 'futures', tz: 'America/New_York' })
    expect(contaDiarioDe(futuros, { windows: [{ tz: 'America/Sao_Paulo', startMin: 600, endMin: 660, weekdays: 31 }] }).tz).toBe('America/Sao_Paulo')
    expect(contaDiarioDe({ market: 'b3' }, null)).toEqual({ currency: 'BRL', market: 'b3', tz: 'America/Sao_Paulo' })
    expect(contaDiarioDe({ market: 'crypto' }, { windows: [] }).tz).toBe('America/Sao_Paulo')
  })

  it('diaDaUrl: a real day not after today, else null', () => {
    expect(diaDaUrl('2026-11-10', '2026-12-01')).toBe('2026-11-10')
    expect(diaDaUrl('2026-12-01', '2026-12-01')).toBe('2026-12-01')
    expect(diaDaUrl('2026-12-02', '2026-12-01')).toBeNull()
    expect(diaDaUrl('2026-02-30', '2026-12-01')).toBeNull()
    expect(diaDaUrl('2026-11-1', '2026-12-01')).toBeNull()
    expect(diaDaUrl('', '2026-12-01')).toBeNull()
    expect(diaDaUrl(null, '2026-12-01')).toBeNull()
  })

  it('diaPassadoDoDiario: from the rules’ first day to yesterday', () => {
    expect(diaPassadoDoDiario('2026-11-10', '2026-12-01', '2026-10-14')).toBe(true)
    expect(diaPassadoDoDiario('2026-10-14', '2026-12-01', '2026-10-14')).toBe(true)
    expect(diaPassadoDoDiario('2026-10-13', '2026-12-01', '2026-10-14')).toBe(false)
    expect(diaPassadoDoDiario('2026-12-01', '2026-12-01', '2026-10-14')).toBe(false)
    expect(diaPassadoDoDiario('2026-11-10', '2026-12-01', null)).toBe(false)
    expect(diaPassadoDoDiario(null, '2026-12-01', '2026-10-14')).toBe(false)
  })
})

describe('«Registrar operação» on the open day (D16)', () => {
  it('a past day of the diário: the sheet is asked to open on it', async () => {
    const { user, q } = await renderDiario('2')
    await carregada()
    await user.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(mockAbrirRegistrar).toHaveBeenCalledWith(expect.objectContaining({ accountId: q.info.contaId, day: '2026-11-10' }))
  })

  it('today, or a day before the rules: no day', async () => {
    const { user, q } = await renderDiario('11b')
    await carregada()
    await user.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(mockAbrirRegistrar.mock.calls[0][0]).not.toHaveProperty('day')
    act(() => pagina().abrirDia('2026-10-08'))
    await waitFor(() => expect(sonda()).toHaveAttribute('data-dia', '2026-10-08'))
    await user.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(mockAbrirRegistrar.mock.calls[1][0]).not.toHaveProperty('day')
    expect(mockAbrirRegistrar.mock.calls[1][0].accountId).toBe(q.info.contaId)
  })
})

/**
 * «Registrar operação» on a B3 account (3-4, lane B; board scenario 9 · Clear), with the answers
 * recorded from the real SQL (testing/registrarMercados; invented data) on Thu 15 Oct 2026, on
 * Brasília's clock: the morning that reached the R$ 500 limit at 10:16 («Encerrado por hoje»: the
 * form still registers), WIN in points of 5 with the money in reais, the stop above what was left at
 * 10:06, PETR4 (whole shares, up to 4 decimals, the odd-lot note), DI1 and a code outside the catalog
 * (BGIX26) with the typed «Resultado, R$», «Usar “WINZ26”» computed as WIN (decision of 20 Oct), and
 * the B3 «Custos» note. The sheet is lane A's generic price fields; what B3 shows is the engine's.
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
} from '@/testing/registrarMercados'

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
const SP = 'America/Sao_Paulo'

type Json = Record<string, any>

const clearAgora = () => agoraMercados('clear-qui-1020').accounts.find((a) => a.accountId === ids.accounts.clear)!

/** Clear at 10:06, from the recorded 10:20 answer with the gate the 10:06 dry run evaluated (WIN −180 so far, R$ 320 left) */
function clearAs1006() {
  const json = mercadosJson('agora-clear-qui-1020') as Json
  const gate = (mercadosJson('entry-dry-win-1006') as Json).gate as Json
  const conta = (json.accounts as Json[]).find((a) => a.account_id === ids.accounts.clear) as Json
  Object.assign(conta, { at: gate.at, limit: gate.limit, today: gate.today, status: gate.status })
  return parseRulesNow(json).accounts.find((a) => a.accountId === ids.accounts.clear)!
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasMercados())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraMercados('clear-qui-1020'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async () => clearAgora())
})

function abrir() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.clear} tradeId={null} onClose={jest.fn()} />
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
const busca = () => screen.getByRole('searchbox', { name: 'Buscar ativo' })
const AVISO_1006 = 'Se o stop for atingido, o dia passa do limite: faltam R$ 320 e o stop arrisca R$ 360.'
/** The plan pill under the fields («● depois do limite»), from the dry run once it answers */
const plano = () => document.querySelector('.hub-reg-plano-linha')

/**
 * The dry run the sheet asked once the form was quiet for 300 ms (useEntryPreview / useAfterPreview):
 * its last payload, after its answer was read. The recorded answers were asked with these payloads
 * (__tests__/lib/hubRegistrarMercados.pg.test.ts), so what the screen shows from them is the server's.
 */
async function previaPedida(fn: { mock: { calls: unknown[][]; results: { value: unknown }[] } }) {
  await waitFor(() => expect(fn).toHaveBeenCalled())
  const r = fn.mock.results[fn.mock.results.length - 1]
  await (r.value as Promise<unknown>).catch(() => undefined)
  return fn.mock.calls[fn.mock.calls.length - 1][2]
}
/** A registration this test does not follow (none was recorded for it): it never answers */
const semResposta = () => new Promise<never>(() => undefined)

async function entrada() {
  abrir()
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
}

/** A search result or «Usar “…”»: its chip is added, pressed and focused */
async function buscar(texto: string, escolha: string, chip = escolha) {
  await userEvent.type(busca(), texto)
  await userEvent.click(within(grupo('Resultados da busca')).getByRole('button', { name: escolha }))
  await waitFor(() => expect(pill('Ativo', chip)).toHaveFocus())
  expect(pill('Ativo', chip)).toHaveAttribute('aria-pressed', 'true')
}

describe('step 1 on Clear at 10:20 de Brasília (the limit reached at 10:16)', () => {
  it('«Encerrado por hoje» with the R$ limit, and the form still registers (plan «● depois do limite»)', async () => {
    await entrada()
    expect(linhaDoGate()).toHaveTextContent('Encerrado por hoje')
    expect(linhaDoGate()).toHaveTextContent('· limite de R$ 500 atingido às 10:16 (pior momento −R$ 540)')
    expect(screen.getByText('Limite do dia').parentElement).toHaveTextContent('Limite do diaR$ 540de R$ 500')
    expect(screen.getByText('depois do limite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).not.toHaveAttribute('aria-disabled')
    expect(campo('Hora (Brasília)')).toHaveValue('10:20')
  })

  it('«Ativo» WIN WDO IND DOL and «Buscar ativo»; B3 futures contracts 1 2 3 5 10; points', async () => {
    await entrada()
    expect(rotulos('Ativo')).toEqual(['WIN', 'WDO', 'IND', 'DOL'])
    expect(pill('Ativo', 'WIN')).toHaveAttribute('aria-pressed', 'true')
    expect(busca()).toHaveAttribute('placeholder', 'Ex.: PETR4 ou DI1')
    expect(rotulos('Contratos')).toEqual(['1', '2', '3', '5', '10', 'Outro'])
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em pontos · opcional')
  })

  it('WIN short 3 at 131.250, 100 / 200 points: «risco R$ 60,00 · alvo R$ 120,00 · 1 : 2», the entry sent in points', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('win'))
    db.registerEntry.mockResolvedValue(entradaMercados('win'))
    db.fetchTradeState.mockResolvedValue(entradaMercados('win').state)
    await entrada()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Contratos', '3'))
    await userEvent.type(campo('Preço de entrada'), '131.250')
    await userEvent.type(campo('Stop'), '100')
    await userEvent.type(campo('Alvo'), '200')
    expect(screen.getByText('risco R$ 60,00 · alvo R$ 120,00 · 1 : 2')).toBeInTheDocument()
    // The dry run of this form: the server's risk is the screen's; its plan «depois do limite» shows,
    // and no warning (the limit is already reached: nothing left to pass)
    expect(await previaPedida(db.previewEntry)).toMatchObject({
      symbol: 'WIN', direction: 'short', quantity: '3', entry_price: '131250', stop_pts: '100', target_pts: '200', clock: SP,
    })
    expect(previaMercados('win').preview).toMatchObject({ risk: '60', reward: '120' })
    expect(previaMercados('win').limitRoom).toMatchObject({ reached: true, above: false })
    expect(plano()).toHaveTextContent('depois do limite')
    expect(screen.queryByText(/o dia passa do limite/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({
      symbol: 'WIN', direction: 'short', quantity: '3', entry_price: '131250', stop_pts: '100', target_pts: '200', clock: SP,
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
  })

  it('WIN in 5s: a stop of 102 says so at once; a price of 131.252 after «Registrar», with the focus', async () => {
    await entrada()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Preço de entrada'), '131.252')
    await userEvent.type(campo('Stop'), '102')
    expect(screen.getByText('Use pontos de 5 em 5 no WIN.')).toHaveAttribute('role', 'alert')
    await digitar('Stop', '100')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('O WIN anda de 5 em 5; confira o preço.')).toHaveAttribute('role', 'alert')
    expect(campo('Preço de entrada')).toHaveFocus()
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('«Hora» 10:06 with a 600-point stop: «faltam R$ 320 e o stop arrisca R$ 360» (a warning, never a block)', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('win-1006'))
    db.fetchGateAt.mockImplementation(async () => clearAs1006())
    await entrada()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Contratos', '3'))
    await userEvent.type(campo('Preço de entrada'), '131.250')
    await digitar('Hora (Brasília)', '10:06')
    await userEvent.type(campo('Stop'), '600')
    expect(screen.getByText('risco R$ 360,00')).toBeInTheDocument()
    expect(await previaPedida(db.previewEntry)).toMatchObject({ symbol: 'WIN', direction: 'short', quantity: '3', stop_pts: '600', entry: '10:06', clock: SP })
    expect(previaMercados('win-1006').limitRoom).toMatchObject({ left: '320', risk: '360', above: true })
    const aviso = await screen.findByText(AVISO_1006)
    expect(aviso).toHaveAttribute('role', 'status')
    // At 10:06 the plan had no break yet (in the window, the limit not reached)
    expect(plano()).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).not.toHaveAttribute('aria-disabled')
  })

  it('the 10:06 warning is the dry run’s `limit_room`: it shows even when the gate at 10:06 could not be read', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('win-1006'))
    db.fetchGateAt.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
    await entrada()
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.click(pill('Contratos', '3'))
    await userEvent.type(campo('Preço de entrada'), '131.250')
    await digitar('Hora (Brasília)', '10:06')
    await userEvent.type(campo('Stop'), '600')
    // Without the gate nothing local can say what is left of the limit
    expect(screen.queryByText(AVISO_1006)).not.toBeInTheDocument()
    expect(await previaPedida(db.previewEntry)).toMatchObject({ stop_pts: '600', entry: '10:06' })
    expect(await screen.findByText(AVISO_1006)).toHaveAttribute('role', 'status')
  })

  it('«Usar “WINZ26”»: computed as WIN (contracts, points, the tick named by its root), sent as typed', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('winz26'))
    db.registerEntry.mockImplementation(semResposta)
    await entrada()
    await userEvent.click(pill('Contratos', '3'))
    await buscar('winz26', 'Usar “WINZ26”', 'WINZ26')
    expect(rotulos('Ativo')).toEqual(['WIN', 'WDO', 'IND', 'DOL', 'WINZ26'])
    expect(pill('Contratos', '3')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pill('Lado', 'Venda'))
    await userEvent.type(campo('Preço de entrada'), '131.252')
    await userEvent.type(campo('Stop'), '100')
    await userEvent.type(campo('Alvo'), '200')
    expect(screen.getByText('risco R$ 60,00 · alvo R$ 120,00 · 1 : 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('O WIN anda de 5 em 5; confira o preço.')).toBeInTheDocument()
    await digitar('Preço de entrada', '131.250')
    // The server read WINZ26 as WIN too: its risk is the screen's
    expect(await previaPedida(db.previewEntry)).toMatchObject({
      symbol: 'WINZ26', direction: 'short', quantity: '3', entry_price: '131250', stop_pts: '100', target_pts: '200', clock: SP,
    })
    expect(previaMercados('winz26').instrument).toMatchObject({ key: 'WIN', stops: 'pts', tick: '5' })
    expect(previaMercados('winz26').preview).toMatchObject({ risk: '60', reward: '120' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'WINZ26', quantity: '3', stop_pts: '100', target_pts: '200' })
  })
})

describe('B3 stocks of the catalog: PETR4', () => {
  it('whole shares, the odd-lot note under the field (a note, never an error), up to 4 decimals', async () => {
    db.previewEntry.mockResolvedValue(previaMercados('petr4-4dp'))
    db.registerEntry.mockImplementation(semResposta)
    await entrada()
    await buscar('petr', 'PETR4')
    expect(busca()).toHaveValue('')
    await userEvent.click(pill('Lado', 'Compra'))
    expect(screen.queryByRole('group', { name: 'Ações' })).not.toBeInTheDocument()
    await userEvent.type(campo('Ações'), '150')
    const nota = screen.getByText('Fora do lote de 100, a B3 negocia no fracionário (código com F).')
    expect(nota).not.toHaveAttribute('role', 'alert')
    expect(campo('Ações').getAttribute('aria-describedby')).toContain(nota.id)
    expect(campo('Ações')).not.toHaveAttribute('aria-invalid')
    await digitar('Ações', '300')
    expect(screen.queryByText('Fora do lote de 100, a B3 negocia no fracionário (código com F).')).not.toBeInTheDocument()
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
    await userEvent.type(campo('Preço de entrada'), '38,4250')
    await userEvent.type(campo('Stop'), '38,20')
    expect(screen.getByText('risco R$ 67,50')).toBeInTheDocument()
    expect(await previaPedida(db.previewEntry)).toMatchObject({ symbol: 'PETR4', direction: 'long', quantity: '300', entry_price: '38.425', stop_price: '38.2', clock: SP })
    expect(previaMercados('petr4-4dp').preview).toMatchObject({ risk: '67.5' })
    expect(plano()).toHaveTextContent('depois do limite')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalledTimes(1))
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ symbol: 'PETR4', direction: 'long', quantity: '300', entry_price: '38.425', stop_price: '38.2' })
  })

  it('a 5th decimal is refused; a fraction of a share too', async () => {
    await entrada()
    await buscar('petr4', 'PETR4')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Ações'), '150,5')
    await userEvent.type(campo('Preço de entrada'), '38,42501')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(screen.getByText('Use um número inteiro de ações.')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Use até 4 casas decimais.')).toHaveAttribute('role', 'alert')
    expect(campo('Ações')).toHaveFocus()
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('«Usar “PETR4F”» (the fractional code) counts as PETR4, without the note', async () => {
    await entrada()
    await buscar('petr4f', 'Usar “PETR4F”', 'PETR4F')
    await userEvent.type(campo('Ações'), '150')
    expect(screen.queryByText('Fora do lote de 100, a B3 negocia no fracionário (código com F).')).not.toBeInTheDocument()
  })

  it('a former code finds the current one: «elet3» → AXIA3', async () => {
    await entrada()
    await userEvent.type(busca(), 'elet3')
    expect(within(grupo('Resultados da busca')).getAllByRole('button').map((b) => b.textContent)).toEqual(['AXIA3'])
  })
})

describe('«Já fechada» on Clear: the typed «Resultado, R$»', () => {
  async function fechada() {
    await entrada()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
  }

  it('DI1 (rate): price stops with 3 decimals, «digite o valor em reais», no «Corrigir», the B3 «Custos» note', async () => {
    await fechada()
    await buscar('di1', 'DI1')
    expect(rotulos('Contratos')).toEqual(['1', '2', '3', '5', '10', 'Outro'])
    expect(document.getElementById('l-stop')).toHaveTextContent('Stop e alvo, em preço · opcional')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.click(pill('Contratos', '5'))
    await userEvent.type(campo('Preço de entrada'), '14,250')
    await digitar('Hora da entrada (Brasília)', '10:10')
    await userEvent.type(campo('Preço de saída'), '14,300')
    await digitar('Hora da saída (Brasília)', '10:15')
    await userEvent.type(campo('Stop'), '14,200')
    expect(screen.getByText('Sem valor em reais para este ativo.')).toBeInTheDocument()
    expect(screen.getByText('Resultado: +0,05 no preço · digite o valor em reais')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(campo('Resultado, R$')).toBeInTheDocument()
    expect(screen.getByText('Pelos preços não dá para saber o valor em reais: digite o resultado da sua plataforma, antes da comissão.')).toBeInTheDocument()
    expect(campo('Custos, R$ · opcional')).toBeInTheDocument()
    expect(screen.getByText('Corretagem, emolumentos e registro. O imposto não entra.')).toBeInTheDocument()
  })

  it('BGIX26 (outside the catalog): «Quantidade», the result required (focus), then sent with the costs; step 3 says it was typed', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaMercados('bgix26'))
    const after = fechadaMercados('bgix26')
    db.registerAfter.mockResolvedValue(after)
    db.fetchTradeState.mockResolvedValue(after.state)
    await fechada()
    await buscar('bgix26', 'Usar “BGIX26”', 'BGIX26')
    expect(screen.queryByRole('group', { name: 'Contratos' })).not.toBeInTheDocument()
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Quantidade'), '2')
    await userEvent.type(campo('Preço de entrada'), '310,55')
    await digitar('Hora da entrada (Brasília)', '10:17')
    await userEvent.type(campo('Preço de saída'), '311,30')
    await digitar('Hora da saída (Brasília)', '10:19')
    expect(screen.getByText('Resultado: +0,75 no preço · digite o valor em reais')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    const res = campo('Resultado, R$')
    expect(res).toHaveFocus()
    expect(res).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Informe o resultado.')).toHaveAttribute('role', 'alert')
    expect(db.registerAfter).not.toHaveBeenCalled()
    await userEvent.type(res, '150')
    await userEvent.type(campo('Custos, R$ · opcional'), '3,50')
    // Only a complete form is asked: the dry run of this one, with the typed result and the costs
    expect(await previaPedida(db.previewAfter)).toMatchObject({
      symbol: 'BGIX26', direction: 'long', quantity: '2', entry_price: '310.55', exit_price: '311.3', entry: '10:17', exit: '10:19', day: '2026-10-15', pnl: '150', costs: '3.5',
    })
    expect(fechadaPreviaMercados('bgix26').exit).toMatchObject({ pnl: '150', pnlBasis: 'typed', commission: '3.5' })
    expect(plano()).toHaveTextContent('depois do limite')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    await waitFor(() => expect(db.registerAfter).toHaveBeenCalledTimes(1))
    expect(db.registerAfter.mock.calls[0][2]).toMatchObject({
      symbol: 'BGIX26', direction: 'long', quantity: '2', entry_price: '310.55', exit_price: '311.3', entry: '10:17', exit: '10:19', day: '2026-10-15', pnl: '150', costs: '3.5', clock: SP,
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('+R$ 150,00')).toBeInTheDocument()
    expect(screen.getByText('Resultado digitado por você.')).toBeInTheDocument()
    expect(screen.getByText('Custos R$ 3,50 · líquido +R$ 146,50')).toBeInTheDocument()
  })

  it('the plan is the dry run’s: with the gate at 10:17 unread, «depois do limite» appears once the complete form is asked', async () => {
    db.previewAfter.mockResolvedValue(fechadaPreviaMercados('bgix26'))
    db.fetchGateAt.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
    await fechada()
    await buscar('bgix26', 'Usar “BGIX26”', 'BGIX26')
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(campo('Quantidade'), '2')
    await userEvent.type(campo('Preço de entrada'), '310,55')
    await digitar('Hora da entrada (Brasília)', '10:17')
    await userEvent.type(campo('Preço de saída'), '311,30')
    await digitar('Hora da saída (Brasília)', '10:19')
    // Without the result the form is not complete: nothing is asked, and without the gate no plan shows
    expect(plano()).toBeNull()
    await userEvent.type(campo('Resultado, R$'), '150')
    await userEvent.type(campo('Custos, R$ · opcional'), '3,50')
    expect(await previaPedida(db.previewAfter)).toMatchObject({ symbol: 'BGIX26', pnl: '150', costs: '3.5', entry: '10:17', exit: '10:19' })
    expect(fechadaPreviaMercados('bgix26').plan).toMatchObject({ breaks: ['depois_do_limite'] })
    await waitFor(() => expect(plano()).toHaveTextContent('depois do limite'))
  })
})

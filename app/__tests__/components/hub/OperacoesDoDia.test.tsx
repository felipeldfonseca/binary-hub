/**
 * «Operações do dia» on /diario (Phase 3, lane B; D16): the rows of the approved board from the
 * recorded fixtures of the board's scenario 10 (invented data, real SQL answers), its states, the
 * row's action (the Registrar sheet, stubbed: lane A's), and /diario around it at the owner's test
 * instants. Since 3-4 (the end of D36) every market has it: the board's FTMO, IBKR, Binance and Clear
 * rows from the 3-4 recordings (testing/registrarMercados).
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import { RegistrarDataError, dayTradesOfRows, type DayTrade, type DayTradesRows } from '@/lib/hub/registrarDb'
import OperacoesDoDia, { diaDaPonte } from '@/components/hub/diario/OperacoesDoDia'
import OperacoesDoDiaVista from '@/components/hub/diario/OperacoesDoDiaVista'
import { linhaDoDia, linhasDoDia } from '@/components/hub/diario/linhas'
import DiarioCabecalho from '@/components/hub/contas/DiarioCabecalho'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import DiarioPage from '@/app/(hub)/diario/page'
import { OPERACOES_DO_DIA_ID } from '@/components/hub/registrar/abrir'
import { renderHub } from '@/testing/hubHarness'
import { hubKeys } from '@/hooks/useContas'
import { regrasKeys } from '@/hooks/useRegras'
import { registrarKeys } from '@/hooks/useRegistrar'
import type { RulesNow } from '@/lib/hub/regras'
import { agoraTelas, contasTelas, diaRowsTelas, diaTelas, idsTelas } from '@/testing/registrarTelas'
import { agoraMercados, contasMercados, diaMercados, diaRowsMercados, idsMercados } from '@/testing/registrarMercados'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

// The URL as Next keeps it: router.replace changes it and every component reading it draws again
let mockSearch = ''
const mockUrlListeners = new Set<() => void>()
const mockReplace = jest.fn()
function mockNavigate(url: string) {
  mockSearch = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  mockUrlListeners.forEach((listener) => listener())
}
jest.mock('next/navigation', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  const subscribe = (listener: () => void) => {
    mockUrlListeners.add(listener)
    return () => mockUrlListeners.delete(listener)
  }
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => mockSearch)),
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    usePathname: () => '/diario',
  }
})

jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchPreferences: jest.fn(),
  fetchImportFormats: jest.fn(),
}))

jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesNow: jest.fn(),
  mergePreferences: jest.fn(),
}))

jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchDayTrades: jest.fn(),
}))

// The Registrar sheet is lane A's (contract §6.2, C9): a stand-in that shows the props it got
const mockSheet = jest.fn()
jest.mock('@/components/hub/registrar/RegistrarSheet', () => {
  const { OPERACOES_DO_DIA_ID: FOCO } = jest.requireActual('@/components/hub/registrar/abrir')
  return {
    __esModule: true,
    default: function RegistrarSheetStub(props: { accountId: string | null; tradeId: string | null; onClose: (o?: { focusId?: string }) => void }) {
      mockSheet({ accountId: props.accountId, tradeId: props.tradeId })
      return (
        <section role="dialog" aria-label="Registrar operação">
          <p>
            conta {props.accountId ?? '—'} · operação {props.tradeId ?? '—'}
          </p>
          <button type="button" onClick={() => props.onClose()}>
            Fechar
          </button>
          <button type="button" onClick={() => props.onClose({ focusId: FOCO })}>
            Ver no Diário
          </button>
        </section>
      )
    },
  }
})

const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const fetchImportFormats = contasDb.fetchImportFormats as jest.MockedFunction<typeof contasDb.fetchImportFormats>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>
const fetchDayTrades = registrarDb.fetchDayTrades as jest.MockedFunction<typeof registrarDb.fetchDayTrades>

const ids = idsTelas()

beforeEach(() => {
  mockSearch = ''
  mockReplace.mockReset().mockImplementation(mockNavigate)
  mockSheet.mockReset()
  fetchAccounts.mockReset().mockResolvedValue(contasTelas())
  fetchPreferences.mockReset().mockResolvedValue({})
  fetchImportFormats.mockReset().mockResolvedValue({})
  fetchRulesNow.mockReset().mockResolvedValue(agoraTelas('agora-qui-1031-et'))
  mergePreferences.mockReset().mockImplementation(async (_db, patch) => ({ ...patch }) as contasDb.HubPreferences)
  fetchDayTrades.mockReset().mockResolvedValue(diaTelas('dia-qui-1031'))
})

afterEach(() => {
  onlineManager.setOnline(true)
})

const ponte = () => screen.findByRole('region', { name: 'Operações do dia' })

/** rules_now at Thu 10:31 ET with Top One #1's answer changed (its trading day, changes_at, window clock) */
function agoraTopOne(change: { tradingDay?: string; changesAt?: Date | null; tz?: string }): RulesNow {
  const now = agoraTelas('agora-qui-1031-et')
  return {
    ...now,
    accounts: now.accounts.map((a) => {
      if (a.accountId !== ids.accounts.topOne) return a
      const gate = { ...a.gate, ...(change.tradingDay ? { tradingDay: change.tradingDay } : {}), ...('changesAt' in change ? { changesAt: change.changesAt ?? null } : {}) }
      const rules = a.rules && change.tz ? { ...a.rules, windows: a.rules.windows.map((w) => ({ ...w, tz: change.tz as typeof w.tz })) } : a.rules
      return { ...a, gate, rules }
    }),
  }
}

/** The table's rows (the header row first) as their cells' text */
function linhas(region: HTMLElement): string[][] {
  return within(region)
    .getAllByRole('row')
    .map((row) => Array.from(row.querySelectorAll('[role="cell"], [role="columnheader"]')).map((c) => (c.textContent ?? '').replace(/\u00a0/g, ' ')))
}

/** The plain rows of the bridge: [Hora, Operação, Resultado, Plano, Ação] */
async function rowsOf(): Promise<string[][]> {
  const region = await ponte()
  await within(region).findByRole('table')
  return linhas(region).slice(1)
}

describe('«Operações do dia» · the rows of the board', () => {
  it('10:31 on Thursday: the open trades ask for the exit, yesterday’s open MNQ says «ontem», the closed one has its note', async () => {
    renderHub(<OperacoesDoDia />)

    const region = await ponte()
    expect(within(region).getByRole('heading', { level: 2, name: 'Operações do dia' })).toHaveAttribute('id', OPERACOES_DO_DIA_ID)
    const table = await within(region).findByRole('table', { name: 'Operações do dia' })
    expect(linhas(region)[0]).toEqual(['Hora', 'Operação', 'Resultado', 'Plano', 'Ação'])
    expect(within(table).getAllByRole('columnheader')[4].querySelector('.sr-only')).toHaveTextContent('Ação')

    expect(await rowsOf()).toEqual([
      ['ontem, 10:52', 'MNQ · Compra · 1 ct', 'aberta', 'No plano', 'Registrar saída'],
      ['10:01–10:08', 'MNQ · Venda · 2 ct ', '−US$ 245,00', 'No plano', 'Abrir'],
      ['10:12', 'MES · Compra · 2 ct', 'aberta', 'No plano', 'Registrar saída'],
      ['10:24', 'MGC · Venda · 1 ct', 'aberta', 'No plano', 'Registrar saída'],
    ])
    // The trading day and the start of it (18:00 ET the evening before) asked for the account
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), ids.accounts.topOne, '2026-10-22', new Date('2026-10-21T22:00:00Z'))
    expect(within(table).getByRole('img', { name: 'tem nota' })).toBeInTheDocument()
    expect(within(table).getAllByRole('img')).toHaveLength(1)
    expect(within(table).getByRole('button', { name: 'Registrar saída: Compra de MNQ de ontem, às 10:52' })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Abrir no Registrar: Venda de MNQ às 10:01' })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Registrar saída: Compra de MES às 10:12' })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Registrar saída: Venda de MGC às 10:24' })).toBeInTheDocument()
    // The result's colour: red for a loss, the muted «aberta»
    expect(within(table).getByText('−US$ 245,00')).toHaveClass('hub-tom--red')
    expect(within(table).getAllByText('aberta')[0]).toHaveClass('hub-tom--muted')
  })

  it('10:42: four closed, «ontem, 10:52 → 10:42» with its gain, MES with images and a note, each «Abrir»', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1042-et'))
    fetchDayTrades.mockResolvedValue(diaTelas('dia-qui-1042'))
    renderHub(<OperacoesDoDia />)

    expect(await rowsOf()).toEqual([
      ['ontem, 10:52 → 10:42', 'MNQ · Compra · 1 ct', '+US$ 64,50', 'No plano', 'Abrir'],
      ['10:01–10:08', 'MNQ · Venda · 2 ct ', '−US$ 245,00', 'No plano', 'Abrir'],
      ['10:12–10:38', 'MES · Compra · 2 ct ', '−US$ 100,00', 'No plano', 'Abrir'],
      ['10:24–10:40', 'MGC · Venda · 1 ct', '−US$ 160,00', 'No plano', 'Abrir'],
    ])
    const region = await ponte()
    expect(within(region).getByRole('img', { name: 'tem imagens e nota' })).toBeInTheDocument()
    expect(within(region).getByText('+US$ 64,50')).toHaveClass('hub-tom--mint')
    expect(within(region).getByRole('button', { name: 'Abrir no Registrar: Compra de MNQ de ontem, às 10:52' })).toBeInTheDocument()
    expect(within(region).queryByRole('button', { name: /^Registrar/ })).not.toBeInTheDocument()
  })

  it('Ebinex: «EUR/USD · Baixa · 1 min» on Brasília’s clock, the «Já fechada» too; «Registrar resultado» only while open', async () => {
    fetchPreferences.mockResolvedValue({ conta_atual: ids.accounts.ebinex })
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    fetchDayTrades.mockResolvedValue(diaTelas('dia-ebinex'))
    renderHub(<OperacoesDoDia />)

    expect(await rowsOf()).toEqual([
      ['20:10–20:12', 'EUR/USD · Baixa · 1 min', '−US$ 20,00', 'No plano', 'Abrir'],
      ['20:13–20:20', 'GBP/USD · Alta · 5 min', '+US$ 17,40', 'No plano', 'Abrir'],
    ])
    // Ebinex's day starts at midnight of Brasília
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), ids.accounts.ebinex, '2026-10-22', new Date('2026-10-22T03:00:00Z'))
    const region = await ponte()
    expect(within(region).queryByRole('button', { name: /^Registrar resultado/ })).not.toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Abrir no Registrar: Baixa de EUR/USD às 20:10' })).toBeInTheDocument()
  })

  it('an open Ebinex trade asks for «Registrar resultado»', () => {
    const rows = diaRowsTelas('dia-ebinex') as { trades: Record<string, unknown>[] } & DayTradesRows
    rows.trades[0] = { ...rows.trades[0], status: 'open', exit_time: null, exit_price: null, pnl: null, result: 'pending' }
    const [aberta] = dayTradesOfRows(rows)
    const linha = linhaDoDia(aberta, { market: 'binary', day: '2026-10-22', tz: 'America/Sao_Paulo' })
    expect(linha).toMatchObject({
      hora: '20:10',
      operacao: 'EUR/USD · Baixa · 1\u00a0min',
      resultado: null,
      acao: 'Registrar resultado',
      acaoAria: 'Registrar resultado: Baixa de EUR/USD às 20:10',
    })
  })

  it('outside the plan: the amber «● fora da janela · depois do limite» and the row’s outline; «—» when nothing was evaluated', async () => {
    const rows = diaRowsTelas('dia-qui-1031') as { contexts: Record<string, unknown>[] } & DayTradesRows
    // MES entered outside the window after the limit; MGC with no context (nothing evaluated)
    rows.contexts = rows.contexts
      .map((c) => (c.trade_id === ids.trades.mes ? { ...c, in_window: false, after_limit: true } : c))
      .filter((c) => c.trade_id !== ids.trades.mgc)
    fetchDayTrades.mockResolvedValue(dayTradesOfRows(rows))
    renderHub(<OperacoesDoDia />)

    const rowsText = await rowsOf()
    expect(rowsText[2]).toEqual(['10:12', 'MES · Compra · 2 ct', 'aberta', '● fora da janela · depois do limite', 'Registrar saída'])
    expect(rowsText[3]).toEqual(['10:24', 'MGC · Venda · 1 ct', 'aberta', '—plano não avaliado', 'Registrar saída'])
    const region = await ponte()
    const [, , mes, mgc] = within(region).getAllByRole('row').slice(1)
    expect(mes).toHaveClass('hub-ops-dia__linha--fora')
    expect(mgc).not.toHaveClass('hub-ops-dia__linha--fora')
    // «●» and «—» are not read; «plano não avaliado» is
    expect(within(mes).getByText('●\u00a0', { normalizer: (t) => t })).toHaveAttribute('aria-hidden', 'true')
    expect(within(mgc).getByText('plano não avaliado')).toHaveClass('sr-only')
  })

  it('a day with nothing registered: «Nenhuma operação registrada hoje.»', async () => {
    fetchDayTrades.mockResolvedValue([])
    renderHub(<OperacoesDoDia />)

    const region = await ponte()
    expect(await within(region).findByText('Nenhuma operação registrada hoje.')).toBeInTheDocument()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('«Operações do dia» · the new markets (3-4; RO l.1649–1662)', () => {
  const m = idsMercados()

  /** /diario's bridge on one of the board's 3-4 accounts, at the recorded instant */
  async function rowsDe(conta: string, agora: Parameters<typeof agoraMercados>[0], dia: Parameters<typeof diaMercados>[0]) {
    fetchAccounts.mockResolvedValue(contasMercados())
    fetchPreferences.mockResolvedValue({ conta_atual: conta })
    fetchRulesNow.mockResolvedValue(agoraMercados(agora))
    fetchDayTrades.mockResolvedValue(diaMercados(dia))
    renderHub(<OperacoesDoDia />)
    return rowsOf()
  }

  it('FTMO (forex): lots, the estimate and the corrected USD/JPY, the open EUR/GBP asking for its exit, XAUUSD typed', async () => {
    expect(await rowsDe(m.accounts.ftmo, 'ftmo-qui-0840', 'ftmo')).toEqual([
      ['08:40–09:01', 'EUR/USD · Compra · 0,50 lote', '+US$ 57,50', 'No plano', 'Abrir'],
      ['08:40–09:01', 'USD/JPY · Venda · 0,30 lote', '+US$ 51,66', 'No plano', 'Abrir'],
      ['08:40–09:01', 'USD/JPY · Venda · 0,30 lote', '+US$ 50,10', 'No plano', 'Abrir'],
      ['08:40', 'EUR/GBP · Venda · 0,50 lote', 'aberta', 'No plano', 'Registrar saída'],
      ['08:45–08:58', 'XAUUSD · Venda · 0,20 lote', '+US$ 105,00', 'No plano', 'Abrir'],
    ])
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), m.accounts.ftmo, '2026-10-15', expect.any(Date))
    const region = await ponte()
    expect(within(region).getByRole('button', { name: 'Registrar saída: Venda de EUR/GBP às 08:40' })).toBeInTheDocument()
  })

  it('IBKR (stocks): the option as «SPY Call 790 · vence 15 out», shares, «Venceu sem valor» at 16:00; plan «—» without a window', async () => {
    expect(await rowsDe(m.accounts.ibkr, 'ibkr-qui-0952', 'ibkr')).toEqual([
      ['09:35–09:48', 'SPY Call 790 · vence 15 out · Compra · 2 ct', '+US$ 110,00', '—plano não avaliado', 'Abrir'],
      ['09:52–10:00', 'AAPL · Compra · 100 ações', '+US$ 75,00', '—plano não avaliado', 'Abrir'],
      ['09:52–16:00', 'SPY Call 790 · vence 15 out · Compra · 2 ct', '−US$ 370,00', '—plano não avaliado', 'Abrir'],
    ])
    const region = await ponte()
    expect(within(region).getByRole('button', { name: 'Abrir no Registrar: Compra de SPY Call 790 às 09:35' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Abrir no Registrar: Compra de AAPL às 09:52' })).toBeInTheDocument()
  })

  it('an open option asks for its exit: «Registrar saída: Compra de SPY Call 790 às 09:35» (RO l.1661)', () => {
    const rows = diaRowsMercados('ibkr') as { trades: Record<string, unknown>[] } & DayTradesRows
    rows.trades[0] = { ...rows.trades[0], status: 'open', exit_time: null, exit_price: null, pnl: null, result: 'pending' }
    const [aberta] = dayTradesOfRows(rows)
    expect(linhaDoDia(aberta, { market: 'stocks', day: '2026-10-15', tz: 'America/New_York' })).toMatchObject({
      hora: '09:35',
      operacao: 'SPY Call 790 · vence 15 out · Compra · 2\u00a0ct',
      resultado: null,
      acao: 'Registrar saída',
      acaoAria: 'Registrar saída: Compra de SPY Call 790 às 09:35',
    })
  })

  it('Binance (crypto) on Brasília’s clock on a Saturday: «BTC/USDT · Venda · 0,25 BTC»', async () => {
    expect(await rowsDe(m.accounts.binance, 'binance-sab-2035', 'binance')).toEqual([
      ['20:35–21:02', 'BTC/USDT · Venda · 0,25 BTC', '+US$ 112,50', 'No plano', 'Abrir'],
    ])
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), m.accounts.binance, '2026-10-17', new Date('2026-10-17T03:00:00Z'))
    const region = await ponte()
    expect(within(region).getByRole('button', { name: 'Abrir no Registrar: Venda de BTC/USDT às 20:35' })).toBeInTheDocument()
  })

  it('Clear (B3): every amount in R$, contracts, «2 un.» outside the catalog, «● depois do limite» after 10:16', async () => {
    const rows = await rowsDe(m.accounts.clear, 'clear-qui-1020', 'clear')
    expect(rows).toEqual([
      ['10:01–10:05', 'WIN · Compra · 3 ct', '−R$ 180,00', 'No plano', 'Abrir'],
      ['10:07–10:11', 'WIN · Venda · 5 ct', '−R$ 210,00', 'No plano', 'Abrir'],
      ['10:13–10:16', 'WDO · Compra · 3 ct', '−R$ 150,00', 'No plano', 'Abrir'],
      ['10:17–10:19', 'BGIX26 · Compra · 2 un.', '+R$ 150,00', '● depois do limite', 'Abrir'],
      ['10:20–10:31', 'WIN · Venda · 3 ct', '+R$ 90,00', '● depois do limite', 'Abrir'],
    ])
    const region = await ponte()
    expect(within(region).getByText('−R$ 180,00')).toHaveClass('hub-tom--red')
    expect(within(region).getByText('+R$ 90,00')).toHaveClass('hub-tom--mint')
    expect(within(region).queryByText(/US\$/)).not.toBeInTheDocument()
  })

  it('keeps the amount with its unit (no-break space) in every market', () => {
    const ops = (['ftmo', 'ibkr', 'binance', 'clear'] as const).flatMap((n) =>
      linhasDoDia(diaMercados(n), { market: contasMercados().find((c) => c.id === m.accounts[n])!.market, day: '2026-10-15', tz: 'America/New_York' }).map(
        (l) => l.operacao.split(' · ').pop()!,
      ),
    )
    expect(ops).toEqual(['0,50\u00a0lote', '0,30\u00a0lote', '0,30\u00a0lote', '0,50\u00a0lote', '0,20\u00a0lote', '2\u00a0ct', '100\u00a0ações', '2\u00a0ct', '0,25\u00a0BTC', '3\u00a0ct', '5\u00a0ct', '3\u00a0ct', '2\u00a0un.', '3\u00a0ct'])
  })
})

describe('«Operações do dia» · states', () => {
  it('«Carregando…» while the day is read', async () => {
    fetchDayTrades.mockReturnValue(new Promise(() => {}))
    renderHub(<OperacoesDoDia />)

    const region = await ponte()
    expect(within(region).getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('waits for rules_now’s trading day; when it fails, the day clock’s day on the server’s now', async () => {
    fetchRulesNow.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    renderHub(<OperacoesDoDia />)

    await rowsOf()
    expect(fetchDayTrades).toHaveBeenCalledTimes(1)
    expect(fetchDayTrades.mock.calls[0][1]).toBe(ids.accounts.topOne)
  })

  it('keeps rules_now’s trading day while a later read fails or waits offline, until its changes_at', async () => {
    // An overnight window placed on the day it opened (21 Oct) while the day clock says 22 Oct;
    // the answer holds until 11:00 ET (15:00Z)
    fetchRulesNow.mockResolvedValue(agoraTopOne({ tradingDay: '2026-10-21', changesAt: new Date('2026-10-22T15:00:00Z') }))
    const view = renderHub(<OperacoesDoDia />)
    await rowsOf()
    expect(fetchDayTrades).toHaveBeenCalledTimes(1)
    expect(fetchDayTrades.mock.calls[0][2]).toBe('2026-10-21')

    // The next read fails: the day stays
    fetchRulesNow.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    await act(() => view.queryClient.refetchQueries({ queryKey: regrasKeys.agora('user-1') }))
    await waitFor(() => expect(view.queryClient.getQueryState(regrasKeys.agora('user-1'))?.status).toBe('error'))
    // Offline, the read waits (paused): the table stays instead of «Sem conexão»
    act(() => onlineManager.setOnline(false))
    void view.queryClient.refetchQueries({ queryKey: regrasKeys.agora('user-1') })
    await waitFor(() => expect(view.queryClient.getQueryState(regrasKeys.agora('user-1'))?.fetchStatus).toBe('paused'))

    const region = await ponte()
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(within(region).queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchDayTrades).toHaveBeenCalledTimes(1)
  })

  it('a failed read after the answer’s changes_at: the day clock’s day', () => {
    const topOne = { id: ids.accounts.topOne, market: 'futures' as const }
    const now = agoraTopOne({ tradingDay: '2026-10-21', changesAt: new Date('2026-10-22T15:00:00Z') })
    expect(diaDaPonte(now, false, topOne, new Date('2026-10-22T14:31:00Z'))).toBe('2026-10-21')
    expect(diaDaPonte(now, true, topOne, new Date('2026-10-22T14:59:00Z'))).toBe('2026-10-21')
    // Due: what it said may have changed, and the read that would say it failed
    expect(diaDaPonte(now, true, topOne, new Date('2026-10-22T15:00:00Z'))).toBe('2026-10-22')
    // No answer yet: wait, unless the read failed
    expect(diaDaPonte(undefined, false, topOne, new Date('2026-10-22T14:31:00Z'))).toBeNull()
    expect(diaDaPonte(undefined, true, topOne, new Date('2026-10-22T14:31:00Z'))).toBe('2026-10-22')
    // An answer without this account (just created): the day clock's
    expect(diaDaPonte({ ...now, accounts: [] }, true, topOne, new Date('2026-10-22T14:31:00Z'))).toBe('2026-10-22')
  })

  it('keeps the table when a later read of the day fails (the error copy only without rows)', async () => {
    const view = renderHub(<OperacoesDoDia />)
    await rowsOf()

    fetchDayTrades.mockRejectedValue(new RegistrarDataError('network'))
    await act(() => view.queryClient.refetchQueries({ queryKey: registrarKeys.all('user-1') }))
    await waitFor(() => expect(fetchDayTrades).toHaveBeenCalledTimes(2))

    const region = await ponte()
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(within(region).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('writes the hours on the clock of the account’s window: a Futuros window set on Brasília’s time', async () => {
    fetchRulesNow.mockResolvedValue(agoraTopOne({ tz: 'America/Sao_Paulo' }))
    renderHub(<OperacoesDoDia />)

    expect((await rowsOf()).map((r) => r[0])).toEqual(['ontem, 11:52', '11:01–11:08', '11:12', '11:24'])
  })

  it('a failed read: its own copy and «Tentar de novo», which reads again and gives the focus to the title', async () => {
    fetchDayTrades.mockRejectedValueOnce(new RegistrarDataError('network'))
    renderHub(<OperacoesDoDia />)

    const region = await ponte()
    expect(await within(region).findByRole('alert')).toHaveTextContent('Não foi possível carregar as operações do dia.')
    await userEvent.click(within(region).getByRole('button', { name: 'Tentar de novo' }))

    expect(await within(region).findByRole('table')).toBeInTheDocument()
    expect(fetchDayTrades).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(within(region).getByRole('heading', { name: 'Operações do dia' })).toHaveFocus())
  })

  it('offline: the read waits, and says so instead of «Carregando…» (C10)', async () => {
    // The accounts are read; the connection drops while rules_now answers
    let answer!: (r: ReturnType<typeof agoraTelas>) => void
    fetchRulesNow.mockReturnValue(new Promise((r) => (answer = r)))
    renderHub(<OperacoesDoDia />)
    const region = await ponte()
    expect(within(region).getByRole('status')).toHaveTextContent('Carregando…')

    act(() => onlineManager.setOnline(false))
    await act(async () => answer(agoraTelas('agora-qui-1031-et')))

    expect(await within(region).findByRole('alert')).toHaveTextContent('Sem conexão. Tente de novo quando a conexão voltar.')
    expect(within(region).queryByText('Carregando…')).not.toBeInTheDocument()
    expect(fetchDayTrades).not.toHaveBeenCalled()

    act(() => onlineManager.setOnline(true))
    expect(await within(region).findByRole('table')).toBeInTheDocument()
  })

  it('every market registers since 3-4 (the end of D36): FTMO (forex) reads its day; nothing without an account', async () => {
    fetchPreferences.mockResolvedValue({ conta_atual: ids.accounts.ftmo })
    fetchDayTrades.mockResolvedValue([])
    const view = renderHub(
      <>
        <DiarioCabecalho />
        <OperacoesDoDia />
      </>,
    )
    // The accounts are there: the selector shows FTMO, and the bridge reads FTMO's day
    expect(await screen.findByRole('button', { name: /^Conta: FTMO/ })).toBeInTheDocument()
    expect(await within(await ponte()).findByText('Nenhuma operação registrada hoje.')).toBeInTheDocument()
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), ids.accounts.ftmo, '2026-10-22', expect.any(Date))
    view.unmount()
    fetchDayTrades.mockClear()

    fetchAccounts.mockResolvedValue([])
    renderHub(
      <>
        <DiarioCabecalho />
        <OperacoesDoDia />
      </>,
    )
    // The empty state of the header
    expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Operações do dia' })).not.toBeInTheDocument()
    expect(fetchDayTrades).not.toHaveBeenCalled()
  })
})

describe('«Operações do dia» · the row opens the Registrar sheet', () => {
  it('on that trade of that account; «Fechar» gives the focus back to the row’s button', async () => {
    renderHub(<OperacoesDoDia />)
    const region = await ponte()
    const exit = await within(region).findByRole('button', { name: 'Registrar saída: Compra de MES às 10:12' })

    await userEvent.click(exit)

    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: ids.accounts.topOne, tradeId: ids.trades.mes })
    expect(screen.getByRole('dialog', { name: 'Registrar operação' })).toHaveTextContent(`conta ${ids.accounts.topOne} · operação ${ids.trades.mes}`)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(exit).toHaveFocus()
  })

  it('when the row is gone after the sheet (an entry undone), «Fechar» gives the focus to the block’s title, not the page’s start', async () => {
    const view = renderHub(<OperacoesDoDia />)
    const region = await ponte()
    await userEvent.click(await within(region).findByRole('button', { name: 'Registrar saída: Compra de MES às 10:12' }))
    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: ids.accounts.topOne, tradeId: ids.trades.mes })

    // «Desfazer entrada» in the sheet: the day is read again without MES
    fetchDayTrades.mockResolvedValue(diaTelas('dia-qui-1031').filter((d) => d.trade.id !== ids.trades.mes))
    await act(() => view.queryClient.invalidateQueries({ queryKey: registrarKeys.all('user-1') }))
    await waitFor(() => expect(within(region).queryByRole('button', { name: 'Registrar saída: Compra de MES às 10:12' })).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(within(region).getByRole('heading', { level: 2, name: 'Operações do dia' })).toHaveFocus()
  })

  it('«Ver no Diário» puts the focus on the title of «Operações do dia»', async () => {
    renderHub(<OperacoesDoDia />)
    const region = await ponte()
    await userEvent.click(await within(region).findByRole('button', { name: 'Abrir no Registrar: Venda de MNQ às 10:01' }))
    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: ids.accounts.topOne, tradeId: ids.trades.mnqQui })

    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))

    expect(within(region).getByRole('heading', { name: 'Operações do dia' })).toHaveFocus()
  })
})

describe('«Operações do dia» · presentational', () => {
  it('takes built rows and calls back with the trade and the pressed button', async () => {
    const onAbrir = jest.fn()
    const rows = linhasDoDia(diaTelas('dia-qui-1031'), { market: 'futures', day: '2026-10-22', tz: 'America/New_York' })
    render(
      <div className="hub">
        <OperacoesDoDiaVista estado={{ status: 'ready', linhas: rows }} onAbrir={onAbrir} onTentar={() => {}} />
      </div>,
    )
    const button = screen.getByRole('button', { name: 'Registrar saída: Venda de MGC às 10:24' })
    await userEvent.click(button)
    // The block's title is the focus's fallback (the row is gone after an entry undone)
    expect(onAbrir).toHaveBeenCalledWith(ids.trades.mgc, button, screen.getByRole('heading', { level: 2, name: 'Operações do dia' }))
  })

  it('writes «21 out» for an older trading day and a dash for a closed trade with no result', () => {
    const [mnq] = diaTelas('dia-qui-1042')
    expect(linhaDoDia(mnq, { market: 'futures', day: '2026-10-23', tz: 'America/New_York' })).toMatchObject({
      hora: '21 out, 10:52 → 10:42',
      acaoAria: 'Abrir no Registrar: Compra de MNQ de 21 out, às 10:52',
    })
    // A zero result (an Ebinex refund) is neither a gain nor a loss: the text colour
    const zero: DayTrade = { ...mnq, trade: { ...mnq.trade, pnl: '0.00' } }
    expect(linhaDoDia(zero, { market: 'futures', day: '2026-10-22', tz: 'America/New_York' }).resultado).toEqual({ texto: 'US$\u00a00,00', tom: 'neutral' })
    const semResultado: DayTrade = { ...mnq, trade: { ...mnq.trade, pnl: null } }
    expect(linhaDoDia(semResultado, { market: 'futures', day: '2026-10-22', tz: 'America/New_York' }).resultado).toEqual({ texto: '—', tom: 'neutral' })
  })
})

describe('/diario with «Operações do dia»', () => {
  it('orders H1 → selector → card → «Operações do dia» → the placeholder, with one read of rules_now', async () => {
    renderHub(<DiarioPage />)

    const selector = await screen.findByRole('button', { name: /^Conta: / })
    const h1 = screen.getByRole('heading', { level: 1, name: 'Diário' })
    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    const bridge = await ponte()
    const placeholder = screen.getByText('O Diário chega na Fase 4.')
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(h1, selector)).toBe(true)
    expect(follows(selector, card)).toBe(true)
    expect(follows(card, bridge)).toBe(true)
    expect(follows(bridge, placeholder)).toBe(true)
    await within(bridge).findByRole('table')
    // One read of rules_now serves the card, the window line and the bridge's day
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
  })

  it('follows the account chosen in the selector at once, even when the choice cannot be saved', async () => {
    mergePreferences.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    fetchDayTrades.mockImplementation(async (_db, accountId) => (accountId === ids.accounts.ebinex ? diaTelas('dia-ebinex') : []))
    renderHub(
      <>
        <DiarioCabecalho />
        <PossoOperarHojeDiario />
        <OperacoesDoDia />
      </>,
    )
    expect(await within(await ponte()).findByText('Nenhuma operação registrada hoje.')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^Conta: Top One #1/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Ebinex/ }))

    expect(await within(await ponte()).findByRole('table')).toBeInTheDocument()
    expect(fetchDayTrades).toHaveBeenLastCalledWith(expect.anything(), ids.accounts.ebinex, '2026-10-22', expect.any(Date))
    expect(screen.getByRole('button', { name: /^Conta: Ebinex/ })).toBeInTheDocument()
  })

  it('keeps the header and the bridge on the same account when the preferences are read again after a failed save', async () => {
    mergePreferences.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    fetchDayTrades.mockImplementation(async (_db, accountId) => (accountId === ids.accounts.ebinex ? diaTelas('dia-ebinex') : []))
    const view = renderHub(
      <>
        <DiarioCabecalho />
        <OperacoesDoDia />
      </>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /^Conta: Top One #1/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Ebinex/ }))
    expect(await within(await ponte()).findByRole('table')).toBeInTheDocument()
    await waitFor(() => expect(mergePreferences).toHaveBeenCalled())

    // An import's refresh (or a reconnect) reads the preferences again: still without the choice
    fetchDayTrades.mockClear()
    await act(() => view.queryClient.invalidateQueries({ queryKey: hubKeys.preferencias('user-1') }))
    await waitFor(() => expect(fetchPreferences).toHaveBeenCalledTimes(2))

    expect(screen.getByRole('button', { name: /^Conta: Ebinex/ })).toBeInTheDocument()
    expect(await within(await ponte()).findByRole('button', { name: 'Abrir no Registrar: Baixa de EUR/USD às 20:10' })).toBeInTheDocument()
    expect(fetchDayTrades).not.toHaveBeenCalledWith(expect.anything(), ids.accounts.topOne, expect.anything(), expect.anything())
    // The choice is in the URL, which both blocks read first
    expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${ids.accounts.ebinex}`, { scroll: false })
  })
})

describe('the owner’s test on /diario', () => {
  /** Wednesday 21 Oct: only the MNQ entered at 10:52, still open */
  function quarta(): DayTrade[] {
    const rows = diaRowsTelas('dia-qui-1031') as { trades: Record<string, unknown>[]; contexts: Record<string, unknown>[] } & DayTradesRows
    rows.trades = rows.trades.filter((t) => t.id === ids.trades.mnqQua)
    rows.contexts = rows.contexts.filter((c) => c.trade_id === ids.trades.mnqQua)
    return dayTradesOfRows(rows)
  }

  it('«Às 11:05 aparece “Fora da sua janela”»: the card says it, and the open MNQ asks for its exit', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qua-1105-et'))
    fetchDayTrades.mockResolvedValue(quarta())
    renderHub(<DiarioPage />)

    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    const topOne = (await within(card).findAllByRole('listitem')).find((li) => li.textContent?.startsWith('Top One #1')) as HTMLElement
    expect(within(topOne).getByText('Fora da sua janela')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar operação' })).toHaveClass('hub-btn--pri')

    expect(await rowsOf()).toEqual([['10:52', 'MNQ · Compra · 1 ct', 'aberta', 'No plano', 'Registrar saída']])
    expect(fetchDayTrades).toHaveBeenCalledWith(expect.anything(), ids.accounts.topOne, '2026-10-21', new Date('2026-10-20T22:00:00Z'))
  })

  it('10:42 on Thursday: «Encerrado por hoje» on the card, and the four closed trades with their results', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1042-et'))
    fetchDayTrades.mockResolvedValue(diaTelas('dia-qui-1042'))
    renderHub(<DiarioPage />)

    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    await waitFor(() => expect(within(card).getByText('Encerrado por hoje')).toBeInTheDocument())
    expect((await rowsOf()).map((r) => r[2])).toEqual(['+US$ 64,50', '−US$ 245,00', '−US$ 100,00', '−US$ 160,00'])
  })
})

describe('hub-operacoes-dia.css', () => {
  // jsdom does no layout: these check the rules the browser relies on (the screenshots at 375, 768
  // and 1280 px show the result)
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-operacoes-dia.css'), 'utf8')
  function rules(): { media: string; rule: CSSStyleRule }[] {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    const out: { media: string; rule: CSSStyleRule }[] = []
    for (const r of Array.from((style.sheet as CSSStyleSheet).cssRules)) {
      if (r instanceof CSSMediaRule) {
        for (const inner of Array.from(r.cssRules)) if ('selectorText' in inner) out.push({ media: r.conditionText, rule: inner as CSSStyleRule })
      } else if ('selectorText' in r) out.push({ media: '', rule: r as CSSStyleRule })
    }
    style.remove()
    return out
  }
  const value = (media: string, selector: string, property: string) =>
    rules()
      .find((r) => r.media === media && r.rule.selectorText === selector)
      ?.rule.style.getPropertyValue(property)
      .trim()

  it('scopes every rule to .hub', () => {
    for (const { rule } of rules()) for (const sel of rule.selectorText.split(',')) expect(sel.trim()).toMatch(/^\.hub /)
  })

  it('lays a row on the board’s five columns, and on two from 860 px down with the header row only read', () => {
    expect(value('', '.hub .hub-ops-dia__linha', 'grid-template-columns')).toBe('96px minmax(0, 1.5fr) 120px minmax(0, 1fr) 170px')
    expect(value('(max-width: 860px)', '.hub .hub-ops-dia__linha', 'grid-template-columns')).toBe('minmax(0, 1fr) auto')
    expect(value('(max-width: 860px)', '.hub .hub-ops-dia__cab', 'position')).toBe('absolute')
    expect(value('(max-width: 860px)', '.hub .hub-ops-dia__cab', 'width')).toBe('1px')
    expect(value('(max-width: 860px)', '.hub .hub-ops-dia__linha > :nth-child(3)', 'grid-row')).toBe('1 / 3')
  })

  it('gives the 80 % switch the board’s 56 × 44 hit area, and drops its motion when asked', () => {
    expect(value('', '.hub .hub-pz-chave', 'width')).toBe('56px')
    expect(value('', '.hub .hub-pz-chave', 'min-height')).toBe('44px')
    expect(value('(prefers-reduced-motion: reduce)', '.hub .hub-pz-chave__tr::after', 'transition')).toBe('none')
  })
})

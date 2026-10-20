/**
 * D38 (Phase 3 · 3-4, sintese §1.2, contract 2b l.409): since 3-4 the Registrar writes rows of every
 * market, and the old pages read the same table. /trades and the old dashboard must survive them,
 * in Portuguese and in English.
 *
 * Which rows reach them: both pages ask useTradesSupabase for the active old account's market
 * (`.eq('market_type', …)`), and the old accounts (profiles.market_accounts, types/markets.ts) are
 * binary, forex, crypto, futures or options: never `stocks` or `b3`. So `stocks` rows (a stock, an
 * option with its contract, `pnl_basis` and `commission`, an open one) and `b3` rows (a WIN future,
 * a catalog stock, a code outside the catalog with a typed result) never show; only the dashboard's
 * two unfiltered reads get them (the first-visit check counts them; the balance cards keep each old
 * account's own market). The rows that do show are `forex` (FTMO: prices, estimate, typed with
 * costs, an open one), `crypto` (Binance) and `options` (an `options` account), under an old
 * account of the same market.
 *
 * What they show today is pinned (accepted until the switch-over of Phase 9, sintese §7): the
 * market column shows the old badge («FOREX», «CRYPTO», «OPTIONS»), every amount is formatted as dollars, an option is its
 * underlying alone («SPY»), the open row's result badge falls to its last case («EMPATE» / «TIE»)
 * and the dashboard prints its raw result («pending»). Rows as trades_bridge writes them (the
 * columns PostgREST returns, `market_type` set from the account; invented data only).
 */
import React from 'react'
import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createDataClient } from '@/lib/supabase'
import DashboardV1Modern from '@/components/dashboard/versions/DashboardV1Modern'
import TradesV1Professional from '@/components/trades/versions/TradesV1Professional'

let mockPortuguese = true
let mockTrades: unknown[] = []

jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => ({ isPortuguese: mockPortuguese, language: mockPortuguese ? 'pt' : 'en', setLanguage: jest.fn() }),
}))

// The old accounts (profiles.market_accounts): one of them is active while the new markets' rows come in
let mockConta = 'futures'
let mockContas = ['futures']
jest.mock('@/lib/contexts/MarketContext', () => {
  const conta = (marketType: string, i: number) => ({
    id: `mkt-${marketType}`,
    marketType,
    displayName: { binary: 'Binary Options', forex: 'Forex', crypto: 'Cripto', futures: 'Futuros', options: 'Opções' }[marketType],
    isPrimary: i === 0,
    bankroll: { initial: 10000, current: 10000, currency: 'USD', deposits: 0, withdrawals: 0, realizedPnL: 0 },
  })
  return {
    useMarketContext: () => {
      const marketAccounts = mockContas.map(conta)
      return {
        activeMarket: marketAccounts.find((a) => a.marketType === mockConta),
        marketAccounts,
        setActiveMarket: jest.fn(),
        updateAccountBalance: jest.fn(),
      }
    },
  }
})

// As the hook's query: `.eq('market_type', …)` when the page names a market, every row of the user
// (row-level security) when it does not
let mockFiltros: unknown[] = []
jest.mock('@/hooks/useTradesSupabase', () => ({
  useTradesSupabase: (filters?: { marketType?: string }) => {
    mockFiltros.push(filters)
    return {
      trades: filters?.marketType ? (mockTrades as { market_type: string }[]).filter((t) => t.market_type === filters.marketType) : mockTrades,
      stats: undefined,
      isLoading: false,
      error: null,
      deleteTrade: { mutateAsync: jest.fn() },
    }
  },
}))

jest.mock('@/hooks/useAccountTransactions', () => ({
  useAccountTransactions: () => ({ transactions: [], isLoading: false, addTransaction: { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false } }),
}))

jest.mock('@/components/ui/Toast', () => ({
  useToastHelpers: () => ({ showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn(), showWarning: jest.fn() }),
}))

jest.mock('@/lib/supabase', () => ({ supabase: {}, createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'dono@example.com', user_metadata: {} }, session: null }),
}))
// The real useTradesSupabase reads it (the test of its filter below)
jest.mock('@/lib/contexts/AuthContextSupabase', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'dono@example.com', user_metadata: {} }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Reads the network on mount; it has nothing to do with trades
jest.mock('@/components/dashboard/EconomicCalendar', () => () => null)

/** Every column a Registrar row has (trades_bridge, 3-4), at rest */
const base = {
  user_id: 'user-1',
  session_id: null,
  source: 'live',
  status: 'closed',
  stake_amount: null,
  payout_percent: null,
  duration_seconds: null,
  pnl_percent: null,
  strategy: null,
  setup_type: null,
  timeframe: null,
  entry_reason: null,
  exit_reason: null,
  notes: null,
  screenshot_entry: null,
  screenshot_exit: null,
  stop_price: null,
  target_price: null,
  option_right: null,
  strike: null,
  expires_on: null,
  multiplier: null,
  pnl_basis: 'prices',
  commission: null,
}

/** IBKR (stocks), Thu 15 Oct 2026: AAPL long 100, +75 */
const aapl = {
  ...base,
  id: 'trade-aapl',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  symbol: 'AAPL',
  asset_type: 'stock',
  direction: 'long',
  entry_price: 231.4,
  exit_price: 232.15,
  quantity: 100,
  stop_price: 230.9,
  target_price: 232.4,
  result: 'win',
  pnl: 75,
  entry_time: '2026-10-15T13:52:00Z',
  exit_time: '2026-10-15T14:00:00Z',
  created_at: '2026-10-15T13:52:00Z',
  updated_at: '2026-10-15T14:00:00Z',
}

/** IBKR: SPY Call 790 vence 15 out, 2 contracts, 1.85 → 2.40, +110, costs 2.60 («Já fechada») */
const spyCall = {
  ...base,
  id: 'trade-spy-call',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  source: 'after',
  symbol: 'SPY',
  asset_type: 'option',
  direction: 'long',
  entry_price: 1.85,
  exit_price: 2.4,
  quantity: 2,
  option_right: 'call',
  strike: 790,
  expires_on: '2026-10-15',
  multiplier: 100,
  pnl_basis: 'prices',
  commission: 2.6,
  result: 'win',
  pnl: 110,
  entry_time: '2026-10-15T13:35:00Z',
  exit_time: '2026-10-15T13:48:00Z',
  created_at: '2026-10-15T13:49:00Z',
  updated_at: '2026-10-15T13:49:00Z',
}

/** IBKR: an open SPY Put 780 vence 16 out, 1 contract at 2.10 */
const spyPutAberta = {
  ...base,
  id: 'trade-spy-put-open',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  symbol: 'SPY',
  asset_type: 'option',
  direction: 'long',
  entry_price: 2.1,
  exit_price: null,
  quantity: 1,
  option_right: 'put',
  strike: 780,
  expires_on: '2026-10-16',
  multiplier: 100,
  pnl_basis: null,
  status: 'open',
  result: 'pending',
  pnl: null,
  entry_time: '2026-10-15T14:05:00Z',
  exit_time: null,
  created_at: '2026-10-15T14:05:00Z',
  updated_at: '2026-10-15T14:05:00Z',
}

/** Clear (b3), de Brasília: WIN short 3, 131250 → 131100, +R$ 90, costs 3.50 */
const win = {
  ...base,
  id: 'trade-win',
  account_id: 'acc-clear',
  market_type: 'b3',
  symbol: 'WINZ26',
  asset_type: 'futures',
  direction: 'short',
  entry_price: 131250,
  exit_price: 131100,
  quantity: 3,
  stop_price: 131350,
  target_price: 131050,
  commission: 3.5,
  result: 'win',
  pnl: 90,
  entry_time: '2026-10-15T13:20:00Z',
  exit_time: '2026-10-15T13:31:00Z',
  created_at: '2026-10-15T13:20:00Z',
  updated_at: '2026-10-15T13:31:00Z',
}

/** Clear: PETR4 long 300 at 38.4250 → 38.20, −R$ 67,50 */
const petr4 = {
  ...base,
  id: 'trade-petr4',
  account_id: 'acc-clear',
  market_type: 'b3',
  source: 'after',
  symbol: 'PETR4',
  asset_type: 'b3',
  direction: 'long',
  entry_price: 38.425,
  exit_price: 38.2,
  quantity: 300,
  result: 'loss',
  pnl: -67.5,
  entry_time: '2026-10-15T12:40:00Z',
  exit_time: '2026-10-15T12:55:00Z',
  created_at: '2026-10-15T12:56:00Z',
  updated_at: '2026-10-15T12:56:00Z',
}

/** Clear: BGIX26 (outside the catalog), 2 un., result typed +R$ 150, costs 3.50 */
const bgix26 = {
  ...base,
  id: 'trade-bgix26',
  account_id: 'acc-clear',
  market_type: 'b3',
  source: 'after',
  symbol: 'BGIX26',
  asset_type: 'b3',
  direction: 'long',
  entry_price: 310.55,
  exit_price: 311.3,
  quantity: 2,
  pnl_basis: 'typed',
  commission: 3.5,
  result: 'win',
  pnl: 150,
  entry_time: '2026-10-15T13:17:00Z',
  exit_time: '2026-10-15T13:19:00Z',
  created_at: '2026-10-15T13:20:00Z',
  updated_at: '2026-10-15T13:20:00Z',
}

/** FTMO (forex), Thu 15 Oct 2026: EUR/USD long 0,50 lot, 1.08520 → 1.08635, +57.50 (prices) */
const eurusd = {
  ...base,
  id: 'trade-eurusd',
  account_id: 'acc-ftmo',
  market_type: 'forex',
  symbol: 'EUR/USD',
  asset_type: 'forex',
  direction: 'long',
  entry_price: 1.0852,
  exit_price: 1.08635,
  quantity: 0.5,
  stop_price: 1.0842,
  target_price: 1.0872,
  result: 'win',
  pnl: 57.5,
  entry_time: '2026-10-15T12:40:00Z',
  exit_time: '2026-10-15T13:01:00Z',
  created_at: '2026-10-15T12:40:00Z',
  updated_at: '2026-10-15T13:01:00Z',
}

/** FTMO: USD/JPY short 0,30 lot, 151.240 → 150.980, ≈ +51.66 (an estimate) */
const usdjpy = {
  ...base,
  id: 'trade-usdjpy',
  account_id: 'acc-ftmo',
  market_type: 'forex',
  symbol: 'USD/JPY',
  asset_type: 'forex',
  direction: 'short',
  entry_price: 151.24,
  exit_price: 150.98,
  quantity: 0.3,
  pnl_basis: 'estimate',
  result: 'win',
  pnl: 51.66,
  entry_time: '2026-10-15T12:41:00Z',
  exit_time: '2026-10-15T13:02:00Z',
  created_at: '2026-10-15T12:41:00Z',
  updated_at: '2026-10-15T13:02:00Z',
}

/** FTMO: XAUUSD short 0,20, the result typed +105, costs 7 («Já fechada») */
const xauusd = {
  ...base,
  id: 'trade-xauusd',
  account_id: 'acc-ftmo',
  market_type: 'forex',
  source: 'after',
  symbol: 'XAUUSD',
  asset_type: 'forex',
  direction: 'short',
  entry_price: 4409.8,
  exit_price: 4404.55,
  quantity: 0.2,
  pnl_basis: 'typed',
  commission: 7,
  result: 'win',
  pnl: 105,
  entry_time: '2026-10-15T12:45:00Z',
  exit_time: '2026-10-15T12:58:00Z',
  created_at: '2026-10-15T12:59:00Z',
  updated_at: '2026-10-15T12:59:00Z',
}

/** FTMO: an open EUR/GBP long 0,50 lot at 0.87120 */
const eurgbpAberta = {
  ...base,
  id: 'trade-eurgbp-open',
  account_id: 'acc-ftmo',
  market_type: 'forex',
  symbol: 'EUR/GBP',
  asset_type: 'forex',
  direction: 'long',
  entry_price: 0.8712,
  exit_price: null,
  quantity: 0.5,
  pnl_basis: null,
  status: 'open',
  result: 'pending',
  pnl: null,
  entry_time: '2026-10-15T13:10:00Z',
  exit_time: null,
  created_at: '2026-10-15T13:10:00Z',
  updated_at: '2026-10-15T13:10:00Z',
}

/** Binance (crypto), Sat 17 Oct: BTC/USDT short 0,25, 112400 → 111950, +112.50, costs 11.24 */
const btc = {
  ...base,
  id: 'trade-btc',
  account_id: 'acc-binance',
  market_type: 'crypto',
  symbol: 'BTC/USDT',
  asset_type: 'crypto',
  direction: 'short',
  entry_price: 112400,
  exit_price: 111950,
  quantity: 0.25,
  commission: 11.24,
  result: 'win',
  pnl: 112.5,
  entry_time: '2026-10-17T23:35:00Z',
  exit_time: '2026-10-18T00:02:00Z',
  created_at: '2026-10-17T23:35:00Z',
  updated_at: '2026-10-18T00:02:00Z',
}

/** An `options` account (a Phase 1 backfill): SPY Put 780 vence 16 out, 1 contract, 2.10 → 1.60, −50 */
const spyPutOpcoes = {
  ...base,
  id: 'trade-spy-put-opcoes',
  account_id: 'acc-opcoes',
  market_type: 'options',
  symbol: 'SPY',
  asset_type: 'option',
  direction: 'long',
  entry_price: 2.1,
  exit_price: 1.6,
  quantity: 1,
  option_right: 'put',
  strike: 780,
  expires_on: '2026-10-16',
  multiplier: 100,
  result: 'loss',
  pnl: -50,
  entry_time: '2026-10-15T14:20:00Z',
  exit_time: '2026-10-15T14:40:00Z',
  created_at: '2026-10-15T14:20:00Z',
  updated_at: '2026-10-15T14:40:00Z',
}

/** The rows no old account can ask for (`stocks`, `b3`) */
const SEM_CONTA_ANTIGA = [aapl, spyCall, spyPutAberta, win, petr4, bgix26]
const FOREX = [eurusd, usdjpy, xauusd, eurgbpAberta]
const TODAS = [...SEM_CONTA_ANTIGA, ...FOREX, btc, spyPutOpcoes]
const SIMBOLOS_SEM_CONTA = ['AAPL', 'WINZ26', 'PETR4', 'BGIX26']

beforeEach(() => {
  mockPortuguese = true
  mockTrades = TODAS
  mockConta = 'forex'
  mockContas = ['forex']
  mockFiltros = []
})

/** /trades' rows of a symbol: each row's cells' text (the checkbox's first) */
function linhas(texto: string): string[][] {
  return screen.getAllByText(texto, { selector: 'td' }).map((td) =>
    within(td.closest('tr') as HTMLElement)
      .getAllByRole('cell')
      .map((c) => (c.textContent ?? '').replace(/ /g, ' ').trim()),
  )
}
const linha = (texto: string) => linhas(texto)[0]
const semSimbolosSemConta = () => {
  for (const s of SIMBOLOS_SEM_CONTA) expect(screen.queryByText(s)).not.toBeInTheDocument()
}

describe('which rows reach the old pages (D38, 3-4)', () => {
  it('the mock filters as the real hook queries: `.eq(\'market_type\', …)` when a market is named, every row otherwise', async () => {
    const { useTradesSupabase: real } = jest.requireActual('@/hooks/useTradesSupabase') as typeof import('@/hooks/useTradesSupabase')
    const eqs: [string, unknown][][] = []
    ;(createDataClient as jest.Mock).mockImplementation(() => {
      const mine: [string, unknown][] = []
      eqs.push(mine)
      const q: Record<string, unknown> = {}
      const self = () => q
      Object.assign(q, {
        from: self,
        select: self,
        order: self,
        gte: self,
        lte: self,
        limit: self,
        eq: (col: string, v: unknown) => {
          mine.push([col, v])
          return q
        },
        then: (ok: (r: unknown) => unknown) =>
          ok({ data: (TODAS as Record<string, unknown>[]).filter((t) => mine.every(([c, v]) => c === 'user_id' || t[c] === v)), error: null }),
      })
      return q
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
    )
    const forex = renderHook(() => real({ marketType: 'forex' }), { wrapper })
    await waitFor(() => expect(forex.result.current.trades).toHaveLength(FOREX.length))
    const todas = renderHook(() => real(), { wrapper })
    await waitFor(() => expect(todas.result.current.trades).toHaveLength(TODAS.length))
    expect(eqs.flat()).toContainEqual(['market_type', 'forex'])
    for (const f of [{ marketType: 'forex' }, undefined]) {
      mockFiltros = []
      const { useTradesSupabase: mock } = jest.requireMock('@/hooks/useTradesSupabase') as typeof import('@/hooks/useTradesSupabase')
      const viaMock = mock(f).trades.map((t) => t.id)
      const viaReal = (f ? forex : todas).result.current.trades.map((t) => t.id)
      expect(new Set(viaMock)).toEqual(new Set(viaReal))
    }
    ;(createDataClient as jest.Mock).mockImplementation(() => ({}))
  })

  it.each(['binary', 'forex', 'crypto', 'futures', 'options'])(
    '/trades on an old %s account asks for that market only: no `stocks` or `b3` row ever shows',
    (mercado) => {
      mockConta = mercado
      mockContas = [mercado]
      render(<TradesV1Professional />)

      expect(mockFiltros.length).toBeGreaterThan(0)
      expect(mockFiltros.every((f) => (f as { marketType?: string } | undefined)?.marketType === mercado)).toBe(true)
      semSimbolosSemConta()
      const delas = TODAS.filter((t) => t.market_type === mercado).length
      if (delas === 0) {
        expect(screen.getAllByText('Nenhuma operação encontrada').length).toBeGreaterThan(0)
        expect(screen.queryByRole('row')).not.toBeInTheDocument()
      } else expect(screen.getAllByRole('row')).toHaveLength(delas + 1)
    },
  )
})

describe('/trades with the rows of the new markets (D38, 3-4)', () => {
  it('an old Forex account: FTMO’s rows (the «FOREX» badge, amounts in dollars, the open one «EMPATE»)', () => {
    render(<TradesV1Professional />)

    expect(screen.getAllByRole('row')).toHaveLength(FOREX.length + 1)
    const eur = linha('EUR/USD')
    expect(eur.slice(2, 4)).toEqual(['EUR/USD', 'FOREX'])
    expect(eur).toContain('GANHO')
    expect(eur).toContain('US$ 57,50')
    // The estimate and the typed result show as any amount
    expect(linha('USD/JPY')).toContain('US$ 51,66')
    expect(linha('XAUUSD')).toContain('US$ 105,00')
    const aberta = linha('EUR/GBP')
    expect(aberta).toContain('EMPATE')
    expect(aberta).toContain('US$ 0,00')
    expect(aberta).not.toContain('GANHO')
    semSimbolosSemConta()
  })

  it('an old Cripto account: BTC/USDT; an old Opções account: the `options` account’s SPY, not the IBKR ones', () => {
    mockConta = 'crypto'
    mockContas = ['crypto']
    const { unmount } = render(<TradesV1Professional />)
    expect(screen.getAllByRole('row')).toHaveLength(2)
    const b = linha('BTC/USDT')
    expect(b.slice(2, 4)).toEqual(['BTC/USDT', 'CRYPTO'])
    expect(b).toContain('GANHO')
    expect(b).toContain('US$ 112,50')
    unmount()

    mockConta = 'options'
    mockContas = ['options']
    render(<TradesV1Professional />)
    const spy = linhas('SPY')
    expect(spy).toHaveLength(1)
    expect(spy[0].slice(2, 4)).toEqual(['SPY', 'OPTIONS'])
    expect(spy[0]).toContain('PERDA')
    expect(spy[0]).toContain('-US$ 50,00')
  })

  it('and in English', () => {
    mockPortuguese = false
    render(<TradesV1Professional />)

    expect(linha('EUR/USD')).toContain('WIN')
    expect(linha('EUR/USD')).toContain('$57.50')
    expect(linha('XAUUSD')).toContain('$105.00')
    expect(screen.getAllByText('TIE')).toHaveLength(1)
    semSimbolosSemConta()
  })
})

describe('the old dashboard with the rows of the new markets (D38, 3-4)', () => {
  it('an old Forex account: «Operações recentes» lists FTMO’s rows with «$» amounts and the open one «pending»', () => {
    render(<DashboardV1Modern />)

    // The account's market, plus the two unfiltered reads (the first-visit check, the balance cards)
    expect(new Set(mockFiltros.map((f) => (f as { marketType?: string } | undefined)?.marketType ?? null))).toEqual(new Set(['forex', null]))
    expect(screen.getByRole('button', { name: 'Adicionar novas operações' })).toBeInTheDocument()
    expect(screen.queryByText('Bem-vindo ao Binary Hub!')).not.toBeInTheDocument()
    const recentes = screen.getByRole('heading', { level: 3, name: 'Operações Recentes' }).closest('.card') as HTMLElement
    expect(within(recentes).getAllByText(/^(EUR\/GBP|XAUUSD|USD\/JPY|EUR\/USD)$/, { selector: 'span.truncate' }).map((e) => e.textContent)).toEqual([
      'EUR/GBP',
      'XAUUSD',
      'USD/JPY',
      'EUR/USD',
    ])
    expect(within(recentes).getByText('pending')).toBeInTheDocument()
    expect(within(recentes).getByText('+$57.50')).toBeInTheDocument()
    expect(within(recentes).getByText('+$105.00')).toBeInTheDocument()
    expect(within(recentes).queryByText(/R\$/)).not.toBeInTheDocument()
    // The balance card sums the account's own market (57.50 + 51.66 + 105): the stocks and b3 rows it reads are left out
    expect(screen.getByText('↗ +$214.16')).toBeInTheDocument()
    semSimbolosSemConta()
  })

  it('two old accounts, Forex and Cripto: each card keeps its market', () => {
    mockContas = ['forex', 'crypto']
    render(<DashboardV1Modern />)

    expect(screen.getByText('↗ +$214.16')).toBeInTheDocument()
    expect(screen.getByText('↗ +$112.50')).toBeInTheDocument()
    semSimbolosSemConta()
  })

  it('only `stocks` and `b3` rows, on the fallback binary account: not a first visit, the account’s own empty prompt', () => {
    mockTrades = SEM_CONTA_ANTIGA
    mockConta = 'binary'
    mockContas = ['binary']
    render(<DashboardV1Modern />)

    expect(screen.queryByText('Bem-vindo ao Binary Hub!')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma operação importada para Binary Options ainda.')).toBeInTheDocument()
    expect(screen.getByText('↗ +$0.00')).toBeInTheDocument()
    semSimbolosSemConta()
  })

  it('also in English', () => {
    mockPortuguese = false
    mockTrades = SEM_CONTA_ANTIGA
    mockConta = 'binary'
    mockContas = ['binary']
    const { unmount } = render(<DashboardV1Modern />)

    expect(screen.getByRole('button', { name: 'Add new trades' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome to Binary Hub!')).not.toBeInTheDocument()
    expect(screen.getByText('No trades imported for Binary Options yet.')).toBeInTheDocument()
    unmount()

    mockTrades = TODAS
    mockConta = 'forex'
    mockContas = ['forex']
    render(<DashboardV1Modern />)
    expect(screen.getByText('pending')).toBeInTheDocument()
    semSimbolosSemConta()
  })
})

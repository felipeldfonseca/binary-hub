/**
 * «Operações do dia» on /diario (Phase 3, lane B; D16): the rows of the approved board from the
 * recorded fixtures of the board's scenario 10 (invented data, real SQL answers), its states, the
 * row's action (the Registrar sheet, stubbed: lane A's), and /diario around it at the owner's test
 * instants.
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
import OperacoesDoDia from '@/components/hub/diario/OperacoesDoDia'
import OperacoesDoDiaVista from '@/components/hub/diario/OperacoesDoDiaVista'
import { linhaDoDia, linhasDoDia } from '@/components/hub/diario/linhas'
import DiarioCabecalho from '@/components/hub/contas/DiarioCabecalho'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import DiarioPage from '@/app/(hub)/diario/page'
import { OPERACOES_DO_DIA_ID } from '@/components/hub/registrar/abrir'
import { renderHub } from '@/testing/hubHarness'
import { agoraTelas, contasTelas, diaRowsTelas, diaTelas, idsTelas } from '@/testing/registrarTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

let mockSearch = ''
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/diario',
}))

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
  mockReplace.mockReset()
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

  it('nothing for an account without a Registrar in 3-3 (FTMO, forex), nor without an account', async () => {
    fetchPreferences.mockResolvedValue({ conta_atual: ids.accounts.ftmo })
    const view = renderHub(
      <>
        <DiarioCabecalho />
        <OperacoesDoDia />
      </>,
    )
    // The accounts are there: the selector shows FTMO
    expect(await screen.findByRole('button', { name: /^Conta: FTMO/ })).toBeInTheDocument()
    await waitFor(() => expect(fetchRulesNow).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Operações do dia' })).not.toBeInTheDocument()
    expect(fetchDayTrades).not.toHaveBeenCalled()
    view.unmount()

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
    expect(onAbrir).toHaveBeenCalledWith(ids.trades.mgc, button)
  })

  it('writes «21 out» for an older trading day and a dash for a closed trade with no result', () => {
    const [mnq] = diaTelas('dia-qui-1042')
    expect(linhaDoDia(mnq, { market: 'futures', day: '2026-10-23', tz: 'America/New_York' })).toMatchObject({
      hora: '21 out, 10:52 → 10:42',
      acaoAria: 'Abrir no Registrar: Compra de MNQ de 21 out, às 10:52',
    })
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

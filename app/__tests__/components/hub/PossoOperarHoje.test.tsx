/**
 * «Posso operar hoje?» on /diario (Phase 2, lane B): the card's lines from rules_now() (fixtures
 * recorded from the real SQL, invented data), its states, and the page that places it.
 */
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { focusManager, onlineManager } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import { parseRulesNow } from '@/lib/hub/regras'
import PossoOperarHoje, { type PossoEstado } from '@/components/hub/posso/PossoOperarHoje'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import { rulesNowFailed } from '@/components/hub/posso/rulesNowRead'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import DiarioPage from '@/app/(hub)/diario/page'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { agora, idsDono, regrasJson, type AgoraFixture } from '@/testing/regras'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
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

const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const fetchImportFormats = contasDb.fetchImportFormats as jest.MockedFunction<typeof contasDb.fetchImportFormats>

beforeEach(() => {
  fetchRulesNow.mockReset().mockResolvedValue(agora('agora-seg-0930-et'))
  mergePreferences.mockReset().mockResolvedValue({})
  fetchAccounts.mockReset().mockResolvedValue([])
  fetchPreferences.mockReset().mockResolvedValue({})
  fetchImportFormats.mockReset().mockResolvedValue({})
})

afterEach(() => {
  jest.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

/** Recorded JSON, edited field by field */
type Json = Record<string, any>

/** A recorded rules_now() answer with some fields changed, parsed as the app parses it */
function edited(name: AgoraFixture, edit: (accounts: Json[]) => Json[]) {
  const json = regrasJson(name)
  json.accounts = edit(json.accounts as Json[])
  return parseRulesNow(json)
}

/** A recorded rules_now() answer, as if the server had answered it at `serverNow` */
function answeredAt(name: AgoraFixture, serverNow: string) {
  const json = regrasJson(name)
  json.server_now = serverNow
  return parseRulesNow(json)
}

/**
 * Renders inside the app's own QueryClient (lib/providers/QueryProvider: staleTime 60 s, three
 * retries), not the harness's (no retry, staleTime 0), which hid how the card behaves in production
 */
function renderApp(ui: React.ReactElement) {
  const view = render(<QueryProvider>{ui}</QueryProvider>)
  return { ...view, rerender: (next: React.ReactElement) => view.rerender(<QueryProvider>{next}</QueryProvider>) }
}

/** The card, mounted or not (leaving /diario and coming back, with the same query cache) */
function CardOn({ shown }: { shown: boolean }) {
  return shown ? <PossoOperarHojeDiario /> : null
}

/** Moves the fake clock (and the timers due on the way) */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

function ready(name: AgoraFixture): PossoEstado {
  return { status: 'ready', accounts: agora(name).accounts }
}

interface Line {
  conta: string
  texto: string
  tom: string
  limite: string | null
}

/** One `li`: «{apelido}», «{state} · {sub or action}», its tone, «US$ 0 de US$ 400» */
function readLine(li: HTMLElement): Line {
  const estado = li.querySelector('.hub-posso__estado') as HTMLElement
  const word = li.querySelector('.hub-posso__palavra') as HTMLElement
  const limit = li.querySelector('.hub-posso__limite')
  return {
    conta: li.querySelector('.hub-posso__nome')?.textContent ?? '',
    texto: Array.from(estado.children)
      .filter((el) => el.getAttribute('aria-hidden') !== 'true')
      .map((el) => el.textContent)
      .join(' · '),
    tom: Array.from(word.classList).find((c) => c.startsWith('hub-tom--'))?.slice('hub-tom--'.length) ?? '',
    limite: limit ? Array.from((limit.querySelector('.hub-posso__valores') as HTMLElement).children).map((el) => el.textContent).join(' ') : null,
  }
}

/** «US$ 0 de US$ 400» as shown: a no-break space inside each amount, so it never wraps */
const usd = (amount: string) => `US$\u00a0${amount}`
const limite = (used: string, of: string) => `${used === '—' ? used : usd(used)} de ${usd(of)}`

const list = () => screen.getByRole('list', { name: 'Posso operar hoje?' })
const title = () => screen.getByRole('heading', { level: 2, name: 'Posso operar hoje?' })
const items = () => within(list()).getAllByRole('listitem')
const lines = () => items().map(readLine)

const TOP_FORA = { conta: 'Top One #1', texto: 'Fora da sua janela · abre às 10:00 ET', tom: 'amber', limite: limite('0', '400') }
const EBX_FORA = { conta: 'Ebinex', texto: 'Fora da sua janela · abre às 20:00 de Brasília', tom: 'amber', limite: null }

describe('PossoOperarHoje (the card, from props)', () => {
  it.each<[AgoraFixture, Line[]]>([
    ['agora-seg-0930-et', [TOP_FORA, EBX_FORA]],
    ['agora-seg-1005-et', [{ conta: 'Top One #1', texto: 'Liberado · até 11:00 ET', tom: 'mint', limite: limite('0', '400') }, EBX_FORA]],
    [
      'agora-seg-1045-et',
      [{ conta: 'Top One #1', texto: 'Encerrado por hoje · limite atingido às 10:31', tom: 'red', limite: limite('430', '400') }, EBX_FORA],
    ],
    [
      'agora-seg-2030-brt',
      [
        { conta: 'Top One #1', texto: 'Fora da sua janela · abre amanhã às 10:00 ET', tom: 'amber', limite: limite('0', '400') },
        { conta: 'Ebinex', texto: 'Liberado · até 21:00 de Brasília', tom: 'mint', limite: null },
      ],
    ],
    [
      'agora-sab-1200-et',
      [
        { conta: 'Top One #1', texto: 'Fora da sua janela · hoje não é dia da janela', tom: 'amber', limite: limite('0', '400') },
        { conta: 'Ebinex', texto: 'Fora da sua janela · hoje não é dia da janela', tom: 'amber', limite: null },
      ],
    ],
    [
      'agora-antes-seg-0930-et',
      [
        { conta: 'Top One #1', texto: 'Sem janela salva · Definir', tom: 'muted', limite: null },
        { conta: 'Ebinex', texto: 'Sem janela salva · Definir', tom: 'muted', limite: null },
      ],
    ],
  ])('%s: one line per account, in the words of lib/hub/posso', (name, expected) => {
    render(<PossoOperarHoje state={ready(name)} onRetry={jest.fn()} />)

    expect(lines()).toEqual(expected)
  })

  it('writes the answer in bold and the separator only for the eye, as the board does', () => {
    render(<PossoOperarHoje state={ready('agora-seg-0930-et')} onRetry={jest.fn()} />)

    const [top] = items()
    expect(within(top).getByText('Fora da sua janela').tagName).toBe('STRONG')
    expect(within(top).getByText('Top One #1').tagName).toBe('STRONG')
    expect(top.querySelector('.hub-posso__sep')).toHaveAttribute('aria-hidden', 'true')
    expect(top.querySelector('.hub-posso__estado')).toHaveClass('hub-posso__estado--empilha')
  })

  it('draws the sub and «de US$ 400» in text-2, the amount used in text, and gives the limit no title', () => {
    render(<PossoOperarHoje state={ready('agora-seg-0930-et')} onRetry={jest.fn()} />)

    const [top] = items()
    const sub = top.querySelector('.hub-posso__estado')?.lastElementChild as HTMLElement
    expect(sub).toHaveTextContent('abre às 10:00 ET')
    expect(sub).toHaveClass('hub-tom--muted')
    const [used, of] = Array.from((top.querySelector('.hub-posso__valores') as HTMLElement).children)
    expect(used.textContent).toBe(usd('0'))
    expect(used).not.toHaveClass('hub-tom--muted')
    expect(of.textContent).toBe(`de ${usd('400')}`)
    expect(of).toHaveClass('hub-tom--muted')
    expect(top.querySelector('[title]')).toBeNull()
  })

  it('shows the limit as plain text: «Limite do dia» and the amounts, no link and no aria-label', () => {
    render(<PossoOperarHoje state={ready('agora-seg-1045-et')} onRetry={jest.fn()} />)

    const [top, ebinex] = items()
    const limit = top.querySelector('.hub-posso__limite') as HTMLElement
    expect(limit).toHaveTextContent('Limite do diaUS$ 430de US$ 400')
    expect(limit.querySelector('.hub-posso__usado')?.textContent).toBe(usd('430'))
    expect(limit).not.toHaveAttribute('aria-label')
    expect(limit.querySelector('[aria-label]')).toBeNull()
    expect(within(top).queryByRole('link')).not.toBeInTheDocument()
    // Ebinex has no limit
    expect(ebinex.querySelector('.hub-posso__limite')).toBeNull()
    expect(within(ebinex).queryByText('Limite do dia')).not.toBeInTheDocument()
  })

  it('links «Definir» to Personalizar’s windows, named for the account, before any rule is saved', () => {
    render(<PossoOperarHoje state={ready('agora-antes-seg-0930-et')} onRetry={jest.fn()} />)

    const [top, ebinex] = items()
    const definir = within(top).getByRole('link', { name: 'Definir a janela da Top One #1 em Personalizar' })
    expect(definir).toHaveAttribute('href', '/personalizar#janelas')
    expect(definir).toHaveTextContent('Definir')
    expect(within(ebinex).getByRole('link', { name: 'Definir a janela da Ebinex em Personalizar' })).toHaveAttribute(
      'href',
      '/personalizar#janelas',
    )
    // «Sem janela salva» is not an answer: plain text-2, never «Liberado»
    expect(within(top).getByText('Sem janela salva').tagName).toBe('SPAN')
    expect(top.querySelector('.hub-posso__estado')).not.toHaveClass('hub-posso__estado--empilha')
    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()
  })

  it('lists futures before binaries even when the server lists a binary first, keeping its order inside a market', () => {
    const now = edited('agora-seg-0930-et', ([top, ebinex]) => [
      ebinex,
      top,
      { ...top, account_id: '00000000-0000-4000-8000-000000000001', label: 'Apex A' },
    ])

    render(<PossoOperarHoje state={{ status: 'ready', accounts: now.accounts }} onRetry={jest.fn()} />)

    expect(lines().map((l) => l.conta)).toEqual(['Top One #1', 'Apex A', 'Ebinex'])
  })

  it('names the list by its heading and never makes it live: a window opening must not interrupt a screen reader', () => {
    const { container } = render(<PossoOperarHoje state={ready('agora-seg-1005-et')} onRetry={jest.fn()} />)

    expect(screen.getByRole('region', { name: 'Posso operar hoje?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Posso operar hoje?' })).toHaveAttribute('id', 't-posso')
    expect(list()).toHaveAttribute('aria-labelledby', 't-posso')
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('«Liberado» with a warning is neutral, not mint', () => {
    const now = edited('agora-seg-0930-et', ([top, ebinex]) => [
      {
        ...top,
        status: 'liberado',
        warnings: ['fora_janela'],
        rules: { ...top.rules, window_rule: { on: true, outside: 'aviso' } },
      },
      ebinex,
    ])

    render(<PossoOperarHoje state={{ status: 'ready', accounts: now.accounts }} onRetry={jest.fn()} />)

    expect(lines()[0]).toEqual({ conta: 'Top One #1', texto: 'Liberado · com aviso: fora da janela', tom: 'neutral', limite: limite('0', '400') })
    expect(within(items()[0]).getByText('Liberado').tagName).toBe('STRONG')
  })

  it('«Sem regra ativa · Ajustar» when the window rule is off and there is no limit', () => {
    const now = edited('agora-seg-0930-et', ([top, ebinex]) => [
      top,
      {
        ...ebinex,
        status: null,
        checks_evaluated: [],
        changes_at: null,
        window: { state: 'nao_avaliado', reason: 'regra_desligada' },
        rules: { ...ebinex.rules, window_rule: { on: false, outside: 'fora' } },
      },
    ])

    render(<PossoOperarHoje state={{ status: 'ready', accounts: now.accounts }} onRetry={jest.fn()} />)

    const ebinex = items()[1]
    expect(readLine(ebinex)).toEqual({ conta: 'Ebinex', texto: 'Sem regra ativa · Ajustar', tom: 'muted', limite: null })
    expect(within(ebinex).getByRole('link', { name: 'Ajustar as regras da Ebinex em Personalizar' })).toHaveAttribute(
      'href',
      '/personalizar#regras',
    )
  })

  it('«Limite do dia indisponível · Tentar de novo» when the limit is the only rule and its result did not load', async () => {
    const now = edited('agora-seg-0930-et', ([top, ebinex]) => [
      {
        ...top,
        status: null,
        checks_evaluated: [],
        window: { state: 'nao_avaliado', reason: 'regra_desligada' },
        limit: { state: 'nao_avaliado', reason: 'sem_dados' },
        rules: { ...top.rules, window_rule: { on: false, outside: 'fora' } },
      },
      ebinex,
    ])
    const onRetry = jest.fn()

    render(<PossoOperarHoje state={{ status: 'ready', accounts: now.accounts }} onRetry={onRetry} />)

    const top = items()[0]
    expect(readLine(top)).toEqual({ conta: 'Top One #1', texto: 'Limite do dia indisponível · Tentar de novo', tom: 'muted', limite: limite('—', '400') })
    expect(within(top).getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1)
    await userEvent.click(within(top).getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers «Tentar de novo» by the limit when the window answered but the limit did not load', async () => {
    const now = edited('agora-seg-0930-et', ([top, ebinex]) => [{ ...top, limit: { state: 'nao_avaliado', reason: 'sem_dados' } }, ebinex])
    const onRetry = jest.fn()

    render(<PossoOperarHoje state={{ status: 'ready', accounts: now.accounts }} onRetry={onRetry} />)

    const top = items()[0]
    expect(readLine(top)).toEqual({ ...TOP_FORA, limite: limite('—', '400') })
    const limit = top.querySelector('.hub-posso__limite') as HTMLElement
    await userEvent.click(within(limit).getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('gives focus to the title when the answer replaces the «Tentar de novo» that had it', async () => {
    const unavailable = edited('agora-seg-0930-et', ([top, ebinex]) => [
      {
        ...top,
        status: null,
        checks_evaluated: [],
        window: { state: 'nao_avaliado', reason: 'regra_desligada' },
        limit: { state: 'nao_avaliado', reason: 'sem_dados' },
        rules: { ...top.rules, window_rule: { on: false, outside: 'fora' } },
      },
      ebinex,
    ])
    const onRetry = jest.fn()
    const { rerender } = render(<PossoOperarHoje state={{ status: 'ready', accounts: unavailable.accounts }} onRetry={onRetry} />)

    // The title takes focus from the page only, never from Tab, and shows its ring only from the keyboard
    expect(title()).toHaveAttribute('tabindex', '-1')
    expect(title()).toHaveClass('hub-alvo-foco')

    const retry = within(items()[0]).getByRole('button', { name: 'Tentar de novo' })
    retry.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledTimes(1)

    // The limit still did not load: «Tentar de novo» stays, and keeps focus
    rerender(<PossoOperarHoje state={{ status: 'ready', accounts: [...unavailable.accounts] }} onRetry={onRetry} />)
    expect(retry).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    rerender(<PossoOperarHoje state={ready('agora-seg-0930-et')} onRetry={onRetry} />)

    expect(retry).not.toBeInTheDocument()
    expect(title()).toHaveFocus()
    // The next Tab goes on from the card: the «i» button
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' })).toHaveFocus()
  })

  it('leaves focus alone when it moved on before the answer came', async () => {
    const onRetry = jest.fn()
    const { rerender } = render(<PossoOperarHoje state={{ status: 'error' }} onRetry={onRetry} />)

    screen.getByRole('button', { name: 'Tentar de novo' }).focus()
    await userEvent.keyboard('{Enter}')
    const info = screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' })
    info.focus()
    rerender(<PossoOperarHoje state={ready('agora-seg-0930-et')} onRetry={onRetry} />)

    expect(info).toHaveFocus()
  })

  it('says «Carregando…» in the card’s frame while the answers load', () => {
    render(<PossoOperarHoje state={{ status: 'loading' }} onRetry={jest.fn()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Posso operar hoje?' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('says the answers could not be read, with «Tentar de novo», and shows no line', async () => {
    const onRetry = jest.fn()
    render(<PossoOperarHoje state={{ status: 'error' }} onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders nothing without an active account (the header shows the empty state)', () => {
    const { container } = render(<PossoOperarHoje state={{ status: 'ready', accounts: [] }} onRetry={jest.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('explains how to read it in the «i» panel (Phase 2 text)', async () => {
    render(<PossoOperarHoje state={ready('agora-seg-0930-et')} onRetry={jest.fn()} />)

    const info = screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' })
    expect(info).toHaveAttribute('aria-expanded', 'false')
    expect(info).toHaveAttribute('aria-controls', 'info-posso')
    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('info-posso')).toHaveTextContent(
      'Cada conta responde pelas regras dela: janela e limite do dia. O bloqueio de dados fica ativo na Fase 5. ' +
        'Limite do dia: a maior perda do dia, no pior momento, contra o limite da conta. ' +
        'Futuros e binárias nunca são somados. Vem das suas regras, nunca da IA.',
    )
    await userEvent.click(info)
    expect(document.getElementById('info-posso')).toBeNull()
  })
})

describe('PossoOperarHojeDiario (the card, from rules_now)', () => {
  it('shows «Carregando…», then the server’s lines', async () => {
    renderHub(<PossoOperarHojeDiario />)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(await screen.findByRole('list', { name: 'Posso operar hoje?' })).toBeInTheDocument()
    expect(lines()).toEqual([TOP_FORA, EBX_FORA])
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
  })

  it('changes the line when the window opens, without a reload (asked again at changes_at)', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-19T13:30:00Z'))
    focusManager.setFocused(true)
    fetchRulesNow.mockReset().mockResolvedValueOnce(agora('agora-seg-0930-et')).mockResolvedValue(agora('agora-seg-1005-et'))
    renderHub(<PossoOperarHojeDiario />)
    await waitFor(() => expect(lines()[0].texto).toBe('Fora da sua janela · abre às 10:00 ET'))

    // 10:00 ET is 30 min after the answer (on the server's clock); it asks one second later
    await act(async () => {
      jest.advanceTimersByTime(30 * 60_000)
    })
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))
    expect(lines()[0].tom).toBe('mint')
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)
  })

  it('asks again when the tab gets focus back', async () => {
    fetchRulesNow.mockReset().mockResolvedValueOnce(agora('agora-seg-1005-et')).mockResolvedValue(agora('agora-seg-1045-et'))
    renderHub(<PossoOperarHojeDiario />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(lines()[0].limite).toBe(limite('430', '400'))
  })

  it('shows the error, not the older lines, when a later read fails; «Tentar de novo» reads again', async () => {
    fetchRulesNow
      .mockReset()
      .mockResolvedValueOnce(agora('agora-seg-1005-et'))
      .mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))
      .mockResolvedValue(agora('agora-seg-1045-et'))
    renderHub(<PossoOperarHojeDiario />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('gives focus to the title when «Tentar de novo» brings the answer, so the next Tab does not restart the page', async () => {
    fetchRulesNow.mockReset().mockRejectedValueOnce(new regrasDb.RegrasDataError('network')).mockResolvedValue(agora('agora-seg-1005-et'))
    renderHub(<PossoOperarHojeDiario />)
    await screen.findByRole('alert')

    screen.getByRole('button', { name: 'Tentar de novo' }).focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))
    expect(title()).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('shows the error when the first read fails', async () => {
    fetchRulesNow.mockReset().mockRejectedValue(new regrasDb.RegrasDataError('bad_answer'))
    renderHub(<PossoOperarHojeDiario />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
  })

  it('renders nothing when rules_now has no futures or binary account', async () => {
    fetchRulesNow.mockReset().mockResolvedValue(edited('agora-seg-0930-et', () => []))
    renderHub(<PossoOperarHojeDiario />)
    expect(screen.getByRole('region', { name: 'Posso operar hoje?' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Posso operar hoje?' })).not.toBeInTheDocument())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('rulesNowFailed', () => {
  it.each([
    [{ isError: false, isPaused: false, failureCount: 0 }, false],
    [{ isError: true, isPaused: false, failureCount: 1 }, true],
    // Status still 'success' while the app's default retries run
    [{ isError: false, isPaused: false, failureCount: 1 }, true],
    // Offline: the read waits, it never fails
    [{ isError: false, isPaused: true, failureCount: 0 }, true],
  ])('%o → %s', (read, failed) => {
    expect(rulesNowFailed(read)).toBe(failed)
  })
})

describe('PossoOperarHojeDiario with the app’s query defaults (QueryProvider)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    focusManager.setFocused(true)
  })

  it('shows the error as soon as the read at changes_at fails, not after the retries; the retry brings the new line', async () => {
    jest.setSystemTime(new Date('2026-10-19T14:05:00Z'))
    fetchRulesNow
      .mockReset()
      .mockResolvedValueOnce(agora('agora-seg-1005-et'))
      .mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))
      .mockResolvedValue(agora('agora-seg-1045-et'))
    renderApp(<PossoOperarHojeDiario />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    // 11:00:01 ET: the read fails; the default retry waits 1 s
    await advance(55 * 60_000 + 1000)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)

    await advance(1000)
    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchRulesNow).toHaveBeenCalledTimes(3)
  })

  it('shows the error when the read at changes_at waits offline, and the new line once back online', async () => {
    jest.setSystemTime(new Date('2026-10-19T14:05:00Z'))
    fetchRulesNow.mockReset().mockResolvedValueOnce(agora('agora-seg-1005-et')).mockResolvedValue(agora('agora-seg-1045-et'))
    renderApp(<PossoOperarHojeDiario />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    act(() => onlineManager.setOnline(false))
    // Still before 11:00: the answer holds
    await advance(25 * 60_000)
    expect(lines()[0].texto).toBe('Liberado · até 11:00 ET')

    // 11:10 ET, offline since 10:30: the read at 11:00:01 is paused, never failed
    await advance(40 * 60_000)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error, not «Carregando…» for ever, when the first read waits offline', async () => {
    onlineManager.setOnline(false)
    renderApp(<PossoOperarHojeDiario />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o “Posso operar hoje?”.')
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    expect(fetchRulesNow).not.toHaveBeenCalled()

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(lines()).toEqual([TOP_FORA, EBX_FORA]))
  })

  it('does not show an answer that was due before the card came back (left at 10:59:40, back at 11:00:20)', async () => {
    jest.setSystemTime(new Date('2026-10-19T14:59:30Z'))
    fetchRulesNow
      .mockReset()
      .mockResolvedValueOnce(answeredAt('agora-seg-1005-et', '2026-10-19T14:59:30+00:00'))
      .mockResolvedValue(answeredAt('agora-seg-1045-et', '2026-10-19T15:00:20+00:00'))
    const view = renderApp(<CardOn shown />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    await advance(10_000)
    view.rerender(<CardOn shown={false} />)
    await advance(40_000)
    // 50 s old: still fresh for the app's staleTime (60 s), but past its 11:00
    view.rerender(<CardOn shown />)

    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)
  })

  it('asks when the cached answer is due, counted from its arrival, not from the card’s return', async () => {
    jest.setSystemTime(new Date('2026-10-19T14:59:30Z'))
    fetchRulesNow
      .mockReset()
      .mockResolvedValueOnce(answeredAt('agora-seg-1005-et', '2026-10-19T14:59:30+00:00'))
      .mockResolvedValue(answeredAt('agora-seg-1045-et', '2026-10-19T15:00:01+00:00'))
    const view = renderApp(<CardOn shown />)
    await waitFor(() => expect(lines()[0].texto).toBe('Liberado · até 11:00 ET'))

    await advance(5000)
    view.rerender(<CardOn shown={false} />)
    await advance(15_000)
    // Back at 10:59:50 ET: the answer still holds until 11:00
    view.rerender(<CardOn shown />)
    expect(lines()[0].texto).toBe('Liberado · até 11:00 ET')

    await advance(10_000)
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
    // 11:00:01, one second after changes_at as the hook does (it would wait until 11:00:21)
    await advance(1000)
    await waitFor(() => expect(lines()[0].texto).toBe('Encerrado por hoje · limite atingido às 10:31'))
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)
  })
})

describe('/diario', () => {
  it('places the card between the Diário header and the placeholder, and the window under the selector', async () => {
    const ids = idsDono()
    fetchAccounts.mockResolvedValue([
      makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures' }),
      makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary', is_primary: true }),
    ])
    renderHub(<DiarioPage />)

    const selector = await screen.findByRole('button', { name: /^Conta: / })
    const h1 = screen.getByRole('heading', { level: 1, name: 'Diário' })
    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    const placeholder = screen.getByText('O Diário chega na Fase 4.')
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(h1, selector)).toBe(true)
    expect(follows(selector, card)).toBe(true)
    expect(follows(card, placeholder)).toBe(true)

    expect(await within(card).findAllByRole('listitem')).toHaveLength(2)
    await waitFor(() => expect(selector).toHaveAccessibleDescription('Janela 20:00–21:00 · Brasília'))
    // One read of rules_now serves the card and the window line
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
  })
})

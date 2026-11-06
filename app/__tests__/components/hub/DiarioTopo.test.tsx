/**
 * Fase 4 · telas, lane L1: the top of the Diário page and its states (contract §2.2 A2, A15, C1–C8) on the approved
 * boards' scenarios (testing/diarioTelas, invented data): the date line under the H1 on each market's clock, the section
 * links, «Diário desde …», the banner of an account without rules (10a), the pending-reviews banner («Ver no
 * calendário», × for the session, both focusing «Calendário»), the offline band over a loaded page (10e, and from the
 * browser's own word) and on a first load (C6b, not drawn), «Carregando…» (10c), «Não foi possível carregar o Diário.»
 * (10d, the Phase 4 SQL missing; the month shown failing) and its retry, the account chosen for a screen reader (never
 * on the first load), no account. Also the copy check of copyMes.ts (no prototype label of the boards).
 */
import React from 'react'
import fs from 'fs'
import path from 'path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { diarioKeys } from '@/hooks/useDiario'
import { hubKeys } from '@/hooks/useContas'
import { DiarioDataError, parseCalendar, parseDay, parseMonth } from '@/lib/hub/diarioDb'
import type { HubPreferences } from '@/lib/hub/contasDb'
import DiarioPage from '@/app/(hub)/diario/page'
import { mocks, renderDiario } from '@/testing/diarioTelas'
import { renderHub } from '@/testing/hubHarness'
import { navegacao, USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import type { Cenario } from '@/testing/diarioQuadro'
import * as copyMes from '@/components/hub/diario/copyMes'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const OFFLINE = 'Sem conexão. Tente de novo quando a conexão voltar.'
const diario = () => screen.queryByRole('region', { name: 'Diário' })

beforeEach(() => {
  window.sessionStorage.clear()
})

/** The visually hidden statuses' texts (the account chosen, the calendar's, the week's) */
const statuses = () => Array.from(document.querySelectorAll('[role="status"].sr-only')).map((el) => el.textContent)

describe('the date line under the H1 (A2)', () => {
  it.each<[Cenario, string]>([
    ['2', 'terça-feira, 1º de dezembro, 11:35 ET'],
    ['1', 'quinta-feira, 12 de novembro, 10:42 ET'],
    ['6', 'quarta-feira, 11 de novembro, 21:20 de Brasília'],
    ['7', 'sábado, 14 de novembro, 21:40 de Brasília'],
    ['8', 'quinta-feira, 12 de novembro, 11:20 de Brasília'],
  ])('%s: «%s», on the open account’s clock at the server’s now', async (cen, linha) => {
    const { q } = await renderDiario(cen)
    await screen.findByRole('region', { name: 'Calendário' })
    expect(q.esperado.dataLinha).toBe(linha)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Diário' })
    const data = h1.nextElementSibling as HTMLElement
    expect(data).toHaveClass('hub-dr-topo-data')
    expect(data.textContent).toBe(linha)
  })
})

describe('the section links and the top line (C1, C2)', () => {
  it('three links to the regions, 44 px targets (hub-diario-mes.css), in a named nav; «Diário desde …» once the calendar answered', async () => {
    const { q } = await renderDiario('2')
    const nav = await screen.findByRole('navigation', { name: 'Seções da página' })
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Calendário', '#calendario'],
      ['O dia', '#dia'],
      ['Semana', '#semana'],
    ])
    expect(await screen.findByText(q.esperado.linhaTopo!)).toBeInTheDocument()
  })

  it.each<[Cenario, string | null]>([
    ['10b', 'Diário desde 13 out: nenhuma operação ainda.'],
    ['7', 'Diário desde 13 out: 24 operações em 16 pregões'],
    ['10a', null],
  ])('%s: %s', async (cen, linha) => {
    await renderDiario(cen)
    await screen.findByRole('region', { name: 'Calendário' })
    if (linha) expect(screen.getByText(linha)).toBeInTheDocument()
    else expect(screen.queryByText(/^Diário desde/)).toBeNull()
  })
})

describe('the account without rules (C3, hoje 10a)', () => {
  it('the amber banner with its heading and «Definir as regras» → Personalizar’s rules; above the pending banner’s place', async () => {
    await renderDiario('10a')
    const banner = await screen.findByRole('region', { name: 'Esta conta ainda não tem regras.' })
    expect(within(banner).getByRole('heading', { level: 2 })).toHaveTextContent('Esta conta ainda não tem regras.')
    expect(banner).toHaveTextContent('Até você salvar as regras em Personalizar, as operações importadas ficam em Histórico importado · só resultado.')
    expect(within(banner).getByRole('link', { name: 'Definir as regras' })).toHaveAttribute('href', '/personalizar#regras')
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
  })

  it('an account with rules has no such banner', async () => {
    await renderDiario('2')
    await screen.findByRole('region', { name: 'Calendário' })
    expect(screen.queryByText('Esta conta ainda não tem regras.')).toBeNull()
  })
})

describe('the pending-reviews banner (C4)', () => {
  it.each<Cenario>(['2', '1', '7', '8'])('%s: the board’s count and sub', async (cen) => {
    const { q } = await renderDiario(cen)
    const banner = await screen.findByRole('region', { name: 'Revisões pendentes' })
    expect(banner).toHaveTextContent(q.esperado.aviso!)
    expect(banner).toHaveTextContent('No calendário, são os pregões com operação registrada no app e sem ✓.')
    expect(within(banner).getByRole('button', { name: 'Fechar o aviso de revisões' })).toBeInTheDocument()
  })

  it('«Ver no calendário» shows the newest pending day’s month and focuses «Calendário»; the open day stays', async () => {
    const { user } = await renderDiario('11b')
    const banner = await screen.findByRole('region', { name: 'Revisões pendentes' })
    const cal = await screen.findByRole('region', { name: 'Calendário' })
    expect(within(cal).getByRole('heading', { level: 3 })).toHaveTextContent('Dezembro de 2026')
    await user.click(within(banner).getByRole('link', { name: 'Ver no calendário' }))
    await waitFor(() => expect(within(cal).getByRole('heading', { level: 3 })).toHaveTextContent('Novembro de 2026'))
    expect(within(cal).getByRole('heading', { level: 2, name: 'Calendário' })).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Revisões pendentes' })).toBeInTheDocument()
  })

  it('× closes it for the session (this account only) and focuses «Calendário»; a new visit of the page keeps it closed', async () => {
    const { user, q, unmount } = await renderDiario('2')
    const banner = await screen.findByRole('region', { name: 'Revisões pendentes' })
    await user.click(within(banner).getByRole('button', { name: 'Fechar o aviso de revisões' }))
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Calendário' })).toHaveFocus()
    expect(window.sessionStorage.getItem(`bh-diario-aviso-fechado:${q.info.contaId}`)).toBe('1')
    unmount()
    await renderDiario('2')
    await screen.findByRole('region', { name: 'Calendário' })
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
  })

  it('shows when storage throws (closed then only until the page is left)', async () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      const { user } = await renderDiario('2')
      const banner = await screen.findByRole('region', { name: 'Revisões pendentes' })
      await user.click(within(banner).getByRole('button', { name: 'Fechar o aviso de revisões' }))
      expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('10a and 10b: no pending day, no banner', async () => {
    await renderDiario('10b')
    await screen.findByRole('region', { name: 'Calendário' })
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
  })
})

describe('offline (C5, C6b)', () => {
  it('10e: the band over the page that is still drawn; gone once the connection is back', async () => {
    await renderDiario('10e', { estado: 'offline' })
    const banda = await screen.findByText(OFFLINE)
    expect(banda.closest('[role="status"]')).not.toBeNull()
    expect(screen.getByRole('region', { name: 'Calendário' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Semana' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    // The band sits above «Calendário»
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(banda, screen.getByRole('region', { name: 'Calendário' }))).toBe(true)
    await act(async () => {
      onlineManager.setOnline(true)
    })
    await waitFor(() => expect(screen.queryByText(OFFLINE)).toBeNull())
    expect(screen.getByRole('region', { name: 'Calendário' })).toBeInTheDocument()
  })

  it('the browser’s own word (navigator.onLine false) shows the band while React Query still says online; back online, gone', async () => {
    const onLine = jest.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false)
    try {
      await renderDiario('2')
      expect(await screen.findByRole('region', { name: 'Calendário' })).toBeInTheDocument()
      expect(onlineManager.isOnline()).toBe(true)
      expect(screen.getByText(OFFLINE).closest('[role="status"]')).not.toBeNull()
      onLine.mockReturnValue(true)
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      await waitFor(() => expect(screen.queryByText(OFFLINE)).toBeNull())
    } finally {
      onLine.mockRestore()
    }
  })

  it('first load offline (not drawn): the band and an empty busy card, never «Carregando…» nor the error; online → the calendar draws', async () => {
    const { q, cru, queryClient } = await renderDiario('2', { estado: 'carregando' })
    await screen.findByRole('button', { name: /^Conta: Top One/ })
    expect(await within(diario() as HTMLElement).findByText('Carregando…')).toHaveAttribute('role', 'status')
    // The calendar's read starts again while offline: it waits paused
    mocks.fetchCalendario.mockImplementation(async (_db, id) => parseCalendar(cru[id].calendario))
    const chave = diarioKeys.calendario(USUARIO_DO_QUADRO, q.info.contaId)
    await act(async () => {
      await queryClient.cancelQueries({ queryKey: chave })
      onlineManager.setOnline(false)
      void queryClient.invalidateQueries({ queryKey: chave })
    })
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
    const card = diario() as HTMLElement
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Calendário' })).toBeNull()
    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(await screen.findByRole('region', { name: 'Calendário' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(OFFLINE)).toBeNull())
  })
})

describe('loading and error (C6, C7; hoje 10c, 10d)', () => {
  it('10c: «Carregando…» in a card in the regions’ place; the links, no line, no banner, no error', async () => {
    await renderDiario('10c', { estado: 'carregando' })
    await waitFor(() => expect(diario()).not.toBeNull())
    const card = diario() as HTMLElement
    expect(within(card).getByText('Carregando…')).toHaveAttribute('role', 'status')
    expect(card).toHaveClass('hub-dr-topo-estado')
    expect(screen.getByRole('navigation', { name: 'Seções da página' })).toBeInTheDocument()
    expect(screen.queryByText(/^Diário desde/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Calendário' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    // The footer stays
    expect(screen.getByRole('region', { name: 'Sobre os dados' })).toBeInTheDocument()
  })

  it('10d (every read: the function does not exist yet): the alert and «Tentar de novo»; the retry draws the page and focuses «Calendário»', async () => {
    const { user, cru } = await renderDiario('10d', { estado: 'erro' })
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar o Diário.')
    expect(alerta.closest('section')).toHaveAttribute('aria-label', 'Diário')
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
    mocks.fetchCalendario.mockImplementation(async (_db, id) => parseCalendar(cru[id].calendario))
    mocks.fetchMes.mockImplementation(async (_db, id, month) => parseMonth(cru[id].meses[month]))
    mocks.fetchDia.mockImplementation(async (_db, id, day) => parseDay(cru[id].dias[day]))
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    const cal = await screen.findByRole('region', { name: 'Calendário' })
    await waitFor(() => expect(within(cal).getByRole('heading', { level: 2, name: 'Calendário' })).toHaveFocus())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the month shown fails after the calendar answered (C7): no top line, no banner; «Tentar de novo» reads the month again', async () => {
    const { user, cru, q } = await renderDiario('2')
    const cal = await screen.findByRole('region', { name: 'Calendário' })
    expect(screen.getByText(q.esperado.linhaTopo!)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Revisões pendentes' })).toBeInTheDocument()
    // October has not been read yet: its read fails without data
    mocks.fetchMes.mockRejectedValue(new DiarioDataError('unknown'))
    await user.click(within(cal).getByRole('button', { name: 'Mês anterior' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o Diário.')
    expect(screen.queryByText(q.esperado.linhaTopo!)).toBeNull()
    expect(screen.queryByText(/^Diário desde/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Revisões pendentes' })).toBeNull()
    // The retry reads the month shown again (not only the calendar and the day)
    const lidas = mocks.fetchMes.mock.calls.length
    mocks.fetchMes.mockImplementation(async (_db, id, month) => parseMonth(cru[id].meses[month]))
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Calendário' })).toBeInTheDocument()
    expect(mocks.fetchMes.mock.calls.slice(lidas).map((c) => c[2])).toContain('2026-10')
    expect(within(screen.getByRole('region', { name: 'Calendário' })).getByRole('heading', { level: 3 })).toHaveTextContent('Outubro de 2026')
    expect(screen.getByText(q.esperado.linhaTopo!)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a later failed read of a calendar that answered keeps the page drawn, without an alert', async () => {
    const { q, queryClient } = await renderDiario('2')
    await screen.findByRole('region', { name: 'Calendário' })
    mocks.fetchCalendario.mockRejectedValue(new Error('network'))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: diarioKeys.calendario(USUARIO_DO_QUADRO, q.info.contaId) })
    })
    expect(screen.getByRole('region', { name: 'Calendário' })).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar o Diário.')).toBeNull()
  })
})

describe('the account (A15, C8)', () => {
  it('nothing on the first load; after a choice in the selector «Conta Lucid 50k.», the selector keeps the focus', async () => {
    const { user } = await renderDiario('9b')
    await screen.findByRole('region', { name: 'Calendário' })
    const status = statuses
    expect(status()).not.toContain('Conta Top One.')
    const botao = screen.getByRole('button', { name: /^Conta: Top One/ })
    await user.click(botao)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar conta' }), 'lucid')
    await user.click(screen.getByRole('button', { name: 'Lucid 50k Avaliação' }))
    await waitFor(() => expect(status()).toContain('Conta Lucid 50k.'))
    expect(screen.getByRole('button', { name: /^Conta: Lucid 50k/ })).toHaveFocus()
  })

  it('nothing on the first load when the saved account comes after the primary one was drawn (the preferences read later)', async () => {
    const r = await renderDiario('9b')
    await screen.findByRole('region', { name: 'Calendário' })
    r.unmount()
    const lucid = r.q.contas.find((c) => c.label === 'Lucid 50k')!
    const primaria = r.q.contas.find((c) => c.is_primary)!
    expect(primaria.label).toBe('Top One')
    let responder: (p: HubPreferences) => void = () => {}
    mocks.fetchPreferences.mockImplementation(() => new Promise<HubPreferences>((ok) => (responder = ok)))
    mocks.fetchCalendario.mockClear()
    // The menu's link: /diario without ?conta=
    navegacao.definir('/diario')
    renderHub(<DiarioPage />)
    // While the preferences are read the page draws the primary account (B0's frame)
    await waitFor(() => expect(mocks.fetchCalendario).toHaveBeenCalledWith(expect.anything(), primaria.id))
    await screen.findByRole('region', { name: 'Calendário' })
    await act(async () => {
      responder({ conta_atual: lucid.id } as HubPreferences)
    })
    expect(await screen.findByRole('button', { name: /^Conta: Lucid 50k/ })).toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchCalendario).toHaveBeenCalledWith(expect.anything(), lucid.id))
    await act(async () => {
      await new Promise((ok) => setTimeout(ok, 20))
    })
    expect(statuses()).not.toContain('Conta Lucid 50k.')
    expect(statuses()).not.toContain('Conta Top One.')
  })

  it('without an account: the header’s empty state and nothing below the card', async () => {
    const { queryClient } = await renderDiario('2')
    await screen.findByRole('region', { name: 'Calendário' })
    mocks.fetchAccounts.mockResolvedValue([])
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: hubKeys.contas(USUARIO_DO_QUADRO) })
    })
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Calendário' })).toBeNull())
    expect(screen.queryByRole('navigation', { name: 'Seções da página' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Sobre os dados' })).toBeNull()
  })
})

describe('copyMes.ts', () => {
  /** Every string the module exports, its templates called with a sample */
  function textos(x: unknown): string[] {
    if (typeof x === 'string') return [x]
    if (typeof x === 'function') return textos((x as (s: string) => unknown)('X'))
    if (x && typeof x === 'object') return Object.values(x).flatMap(textos)
    return []
  }

  it('holds no label of the boards’ prototype band, in its strings or its code', () => {
    const strings = textos(copyMes)
    expect(strings.length).toBeGreaterThan(30)
    const codigo = fs
      .readFileSync(path.join(__dirname, '../../../components/hub/diario/copyMes.ts'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\*\*|\*|\/\/)/.test(l))
      .join('\n')
    for (const rotulo of ['Cenário do protótipo', 'Recomeçar', 'fora do produto', 'No protótipo']) {
      expect(strings.some((s) => s.includes(rotulo))).toBe(false)
      expect(codigo.includes(rotulo)).toBe(false)
    }
  })
})

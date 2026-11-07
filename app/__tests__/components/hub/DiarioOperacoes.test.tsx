/**
 * Fase 4 · telas, lane L2: «Operações do dia» on the approved boards' scenarios (contract G1–G14; testing/diarioTelas,
 * invented data): the rows (Hora, Operação with the paperclip, the origin chip and the second line, Resultado, Plano
 * with its screen-reader words, the action), one drill at a time with its ▾, the deleted line, the open trades of other
 * days («Abrir 30 nov»), the deep link and a push of `?dia=&op=` while the page is open, the hours on the window's
 * clock, the row's action opening the Registrar sheet (stubbed) and the focus after it (the Phase 3 bridge's cases).
 */
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import { regrasKeys } from '@/hooks/useRegras'
import { diarioKeys } from '@/hooks/useDiario'
import { abrirDrill, mocks, renderDiario } from '@/testing/diarioTelas'
import { navegacao, USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import type { EsperadoDia } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

// The Registrar sheet (its own tests): a stand-in that shows what it was opened on and closes
const mockSheet = jest.fn()
jest.mock('@/components/hub/registrar/RegistrarSheet', () => ({
  __esModule: true,
  default: function RegistrarSheetStub(props: { accountId: string | null; tradeId: string | null; dia?: string | null; onClose: (o?: { focusId?: string }) => void }) {
    mockSheet({ accountId: props.accountId, tradeId: props.tradeId, dia: props.dia ?? null })
    return (
      <section role="dialog" aria-label="Registrar operação">
        <button type="button" onClick={() => props.onClose()}>
          Fechar
        </button>
      </section>
    )
  },
}))

beforeEach(() => mockSheet.mockReset())

const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

async function tabela() {
  return screen.findByRole('table', { name: 'Operações do dia' })
}

/** A row's cells: [Hora, Operação (with chip and second line), Resultado, Plano] as the screen reader reads them */
function linhasDe(t: HTMLElement) {
  return within(t)
    .getAllByRole('row')
    .filter((r) => r.querySelector('[role="cell"]') && !r.classList.contains('hub-dr-op-drill'))
    .map((r) => {
      const cells = Array.from(r.querySelectorAll(':scope > [role="cell"]'))
      const op = cells[1]
      return {
        h: sem(cells[0].textContent),
        op: sem(op.querySelector(':scope > span')?.textContent),
        clip: op.querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? null,
        chip: sem(op.querySelector('.hub-dr-op-chip')?.textContent) || null,
        sub: sem(op.querySelector('.hub-dr-op-sub')?.textContent) || null,
        res: sem(cells[2].textContent),
        plano: sem(Array.from(cells[3].querySelectorAll('[aria-hidden="true"], .hub-dr-plano-marca, .hub-dr-op-hist')).map((x) => x.textContent).join('')),
        planoAria: sem(cells[3].querySelector('.sr-only')?.textContent) || null,
        acao: cells[3].querySelector('button')?.getAttribute('aria-label') ?? null,
        rot: cells[4].querySelector('button')?.getAttribute('aria-label') ?? null,
      }
    })
}

function esperadas(e: EsperadoDia) {
  return e.trades.map((t) => ({
    h: t.h,
    op: sem(t.op),
    clip: t.clip,
    chip: t.chip,
    sub: t.sub ? sem(t.sub) : null,
    res: t.res,
    plano: t.plano === 'hist' ? 'Histórico importado · só resultado' : sem(t.plano),
    planoAria: t.planoAria ?? (t.plano === '—' ? 'plano não avaliado' : null),
    acao: t.acaoAria,
    rot: t.rot,
  }))
}

describe('G · the rows of the board', () => {
  it.each(['2', '3', '3b', '4', '5', '9', '11a', '11b', '1', '6', '7', '8'] as const)('%s: every row as the board draws it', async (cen) => {
    const { q } = await renderDiario(cen)
    const t = await tabela()
    expect(linhasDe(t)).toEqual(esperadas(q.esperado as EsperadoDia))
  })

  it('the header row: «Hora», «Operação», «Resultado», «Plano» and «Detalhes» for a screen reader; the table named by the H3', async () => {
    await renderDiario('2')
    const t = await tabela()
    expect(within(t).getAllByRole('columnheader').map((c) => sem(c.textContent))).toEqual(['Hora', 'Operação', 'Resultado', 'Plano', 'Detalhes'])
    const h3 = screen.getByRole('heading', { level: 3, name: 'Operações do dia' })
    expect(h3).toHaveAttribute('id', 'operacoes-do-dia')
    expect(h3).toHaveAttribute('tabindex', '-1')
  })

  it('the ⓘ opens the board’s text', async () => {
    const { user } = await renderDiario('2')
    await tabela()
    await user.click(screen.getByRole('button', { name: 'Como ler: Operações do dia' }))
    expect(document.getElementById('info-ops')).toHaveTextContent('Abra ▾ para ver as saídas')
  })

  it('a row outside the plan has the amber border; the deleted line under the table', async () => {
    await renderDiario('2')
    const t = await tabela()
    const grupos = within(t).getAllByRole('rowgroup')
    expect(grupos.map((g) => g.classList.contains('hub-dr-op-grupo--fora'))).toEqual([false, false, false, false, true])
    expect(screen.getByText('1 operação registrada foi apagada às 10:20.')).toBeInTheDocument()
  })

  it('an empty today: «Nenhuma operação registrada hoje.» + «Registrar operação» (the sheet on the account); a past day: «Nenhuma operação neste dia.»', async () => {
    const { q, user } = await renderDiario('10b')
    const vazio = await screen.findByText('Nenhuma operação registrada hoje.')
    const botao = within(vazio.parentElement as HTMLElement).getByRole('button', { name: 'Registrar operação' })
    expect(botao).toHaveClass('hub-btn--pri')
    await user.click(botao)
    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: q.info.contaId, tradeId: null, dia: null })
  })

  it('a past day without trades: «Nenhuma operação neste dia.» and no «Registrar operação» (G2)', async () => {
    const { q, cru, queryClient } = await renderDiario('2')
    await tabela()
    cru[q.info.contaId].dias[q.info.dia].trades = []
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: diarioKeys.dia(USUARIO_DO_QUADRO, q.info.contaId, q.info.dia) })
    })
    const vazio = await screen.findByText('Nenhuma operação neste dia.')
    expect(within(vazio.parentElement as HTMLElement).queryByRole('button', { name: 'Registrar operação' })).toBeNull()
    expect(screen.queryByText('Nenhuma operação registrada hoje.')).toBeNull()
  })
})

describe('G · one drill at a time, its ▾', () => {
  it('▾ opens the drill after its row (aria-expanded, aria-controls), another ▾ closes it; the focus stays on the ▾', async () => {
    const { q, user } = await renderDiario('2')
    await tabela()
    const t1 = q.dias[q.info.dia].trades[0].trade.id
    const t2 = q.dias[q.info.dia].trades[1].trade.id
    const b1 = document.getElementById(`op-${t1}`) as HTMLButtonElement
    expect(b1).toHaveAttribute('aria-expanded', 'false')
    expect(b1).toHaveAttribute('aria-controls', `drill-${t1}`)
    await user.click(b1)
    await waitFor(() => expect(document.getElementById(`drill-${t1}`)).toBeInTheDocument())
    expect(b1).toHaveAttribute('aria-expanded', 'true')
    expect(b1).toHaveFocus()
    expect(document.getElementById(`drill-${t1}`)).toHaveAttribute('aria-colspan', '5')
    await user.click(document.getElementById(`op-${t2}`)!)
    await waitFor(() => expect(document.getElementById(`drill-${t2}`)).toBeInTheDocument())
    expect(document.getElementById(`drill-${t1}`)).toBeNull()
    await user.click(document.getElementById(`op-${t2}`)!)
    await waitFor(() => expect(document.getElementById(`drill-${t2}`)).toBeNull())
  })
})

describe('G11 · the row’s action opens the Registrar sheet', () => {
  it('1: «Registrar saída: Compra de MES às 10:18» opens the sheet on that trade; closing gives the focus back to it', async () => {
    const { q, user } = await renderDiario('1')
    await tabela()
    const acao = screen.getByRole('button', { name: 'Registrar saída: Compra de MES às 10:18' })
    await user.click(acao)
    const aberta = q.dias[q.info.dia].trades.find((t) => t.trade.status === 'open')!
    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: q.info.contaId, tradeId: aberta.trade.id, dia: null })
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar saída: Compra de MES às 10:18' })).toHaveFocus())
  })

  it('1: when the row is gone after the sheet (an entry undone), the focus goes to «Operações do dia», not the page’s start', async () => {
    const { q, user, cru, queryClient } = await renderDiario('1')
    await tabela()
    await user.click(screen.getByRole('button', { name: 'Registrar saída: Compra de MES às 10:18' }))
    const aberta = q.dias[q.info.dia].trades.find((t) => t.trade.status === 'open')!
    const raw = cru[q.info.contaId].dias[q.info.dia]
    raw.trades = raw.trades.filter((t: { trade_id: string }) => t.trade_id !== aberta.trade.id)
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: diarioKeys.dia(USUARIO_DO_QUADRO, q.info.contaId, q.info.dia) })
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Registrar saída: Compra de MES às 10:18', hidden: true })).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Operações do dia' })).toHaveFocus())
  })

  it('6: the open binary asks «Registrar resultado: Baixa de EUR/USD às 21:12»; «Vence às 21:30 de Brasília.» on its second line', async () => {
    await renderDiario('6')
    await tabela()
    expect(screen.getByRole('button', { name: 'Registrar resultado: Baixa de EUR/USD às 21:12' })).toHaveTextContent('Registrar resultado')
    expect(screen.getByText('Vence às 21:30 de Brasília.', { selector: '.hub-dr-op-sub' })).toBeInTheDocument()
    expect(screen.getByText('devolvida', { selector: '.hub-dr-op-sub' })).toBeInTheDocument()
  })
})

describe('G14 · open trades of other days; the deep link', () => {
  it('9: «1 operação aberta de ontem: MNQ · Compra · 1 ct.» + «Abrir 30 nov»: 30 nov opens with the MNQ’s drill and its ▾ focused; its action has no day', async () => {
    const { q, user } = await renderDiario('9')
    await tabela()
    expect(sem(screen.getByText(/^1 operação aberta de ontem:/).textContent)).toBe('1 operação aberta de ontem: MNQ · Compra · 1 ct.')
    await user.click(screen.getByRole('button', { name: 'Abrir 30 nov' }))
    await waitFor(() => expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Segunda-feira, 30 de novembro'))
    const mnq = q.dias['2026-11-30'].trades.find((t) => t.trade.status === 'open')!
    await waitFor(() => expect(document.getElementById(`op-${mnq.trade.id}`)).toHaveFocus())
    expect(document.getElementById(`op-${mnq.trade.id}`)).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(`drill-${mnq.trade.id}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar saída: Compra de MNQ às 10:52' })).toBeInTheDocument()
    expect(navegacao.params().get('dia')).toBe('2026-11-30')
    expect(navegacao.params().get('op')).toBeNull()
  })

  it('`?dia=&op=` pushed while the page is open («Ver no Diário» from the Diário itself): that day, that drill, its ▾ focused, `op` dropped', async () => {
    const { q } = await renderDiario('2')
    await tabela()
    const t = q.dias['2026-11-19'].trades[4]
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=2026-11-19&op=${t.trade.id}`))
    await waitFor(() => expect(document.getElementById(`op-${t.trade.id}`)).toHaveFocus())
    expect(document.getElementById(`drill-${t.trade.id}`)).toBeInTheDocument()
    expect(navegacao.params().get('op')).toBeNull()
  })

  it('«Ver no Diário» to a day read earlier in the session: the new trade comes with the read again, its drill opens and its ▾ takes the focus', async () => {
    const { q, cru, queryClient } = await renderDiario('2')
    await tabela()
    // 19 nov read once, then back to the scenario's day: 19 nov stays in the cache
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=2026-11-19`))
    await waitFor(() => expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Quinta-feira, 19 de novembro'))
    await tabela()
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=${q.info.dia}`))
    await waitFor(() => expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Terça-feira, 10 de novembro'))
    // the Registrar writes a trade on 19 nov and marks the Diário's reads stale (the inactive 19 nov is not read now)
    const dia = cru[q.info.contaId].dias['2026-11-19']
    const novo = '0f1e2d3c-4b5a-4968-8776-655443322110'
    dia.trades = [...dia.trades, { ...JSON.parse(JSON.stringify(dia.trades[4])), trade_id: novo, trade: { ...dia.trades[4].trade, id: novo } }]
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: diarioKeys.all(USUARIO_DO_QUADRO) })
    })
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=2026-11-19&op=${novo}`))
    await waitFor(() => expect(document.getElementById(`op-${novo}`)).toHaveFocus())
    expect(document.getElementById(`op-${novo}`)).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(`drill-${novo}`)).toBeInTheDocument()
    expect(navegacao.params().get('op')).toBeNull()
  })

  it('an `op` that is not a trade of the day (deleted since) is dropped without opening anything', async () => {
    const { q } = await renderDiario('2')
    await tabela()
    act(() => navegacao.push(`/diario?conta=${q.info.contaId}&dia=2026-11-10&op=00000000-0000-4000-8000-000000000000`))
    await waitFor(() => expect(navegacao.params().get('op')).toBeNull())
    expect(document.querySelector('[id^="drill-"]')).toBeNull()
  })
})

describe('the hours on the window’s clock (the bridge’s case)', () => {
  it('a Top One window set on Brasília’s time writes the rows on Brasília’s clock', async () => {
    const { q, queryClient } = await renderDiario('2')
    await tabela()
    const agora = {
      ...q.rulesNow,
      accounts: q.rulesNow.accounts.map((a) =>
        a.accountId === q.info.contaId && a.rules ? { ...a, rules: { ...a.rules, windows: a.rules.windows.map((w) => ({ ...w, tz: 'America/Sao_Paulo' as const })) } } : a,
      ),
    }
    mocks.fetchRulesNow.mockResolvedValue(agora)
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: regrasKeys.agora(USUARIO_DO_QUADRO) })
    })
    await waitFor(() => expect(linhasDe(screen.getByRole('table', { name: 'Operações do dia' }))[0].h).toBe('12:03–12:09'))
  })
})

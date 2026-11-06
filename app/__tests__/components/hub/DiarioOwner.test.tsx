/**
 * Fase 4 · telas, lane L2: the Phase 3 bridge's two owner-test cases on the Diário's open day (contract §6.7), on the
 * approved boards' world (testing/diarioTelas, invented data; the 3-3 recordings have no diario_dia answer):
 *   «Às 11:05 aparece “Fora da sua janela”»: outside the window the card says so, and the open MNQ of the day before
 *     asks for its exit (Lucid 50k at 11:35 on 1º dez, its 10:52 MNQ of 30 nov through «Abrir 30 nov»);
 *   «10:42 … Encerrado por hoje»: the day the limit was hit, the trade after it carries «Encerrado por hoje» at its
 *     entry, and the four closed trades before it show their results (Top One, 19 nov).
 */
import { screen, waitFor, within } from '@testing-library/react'
import { abrirDrill, renderDiario } from '@/testing/diarioTelas'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

describe('the owner’s test on the Diário', () => {
  it('«Fora da sua janela» on the card, and the open MNQ asks for its exit', async () => {
    const { user } = await renderDiario('9')
    const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
    await waitFor(() => expect(within(card).getAllByText(/Fora da sua janela/).length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: 'Registrar operação' })[0]).toHaveClass('hub-btn--pri')
    await user.click(await screen.findByRole('button', { name: 'Abrir 30 nov' }))
    const acao = await screen.findByRole('button', { name: 'Registrar saída: Compra de MNQ às 10:52' })
    const linha = acao.closest('[role="row"]') as HTMLElement
    expect(Array.from(linha.querySelectorAll(':scope > [role="cell"]')).map((c) => sem(c.textContent)).slice(0, 3)).toEqual(['10:52', 'MNQ · Compra · 1 ct', 'aberta'])
  })

  it('the limit hit at 10:38: the 10:52 entry said «Encerrado por hoje», the four closed trades before it with their results', async () => {
    const { user } = await renderDiario('3')
    const tabela = await screen.findByRole('table', { name: 'Operações do dia' })
    const resultados = within(tabela)
      .getAllByRole('row')
      .filter((r) => r.querySelector(':scope > [role="cell"]'))
      .map((r) => sem(r.querySelectorAll(':scope > [role="cell"]')[2].textContent))
    expect(resultados).toEqual(['−US$ 84,98', '−US$ 104,98', '−US$ 105,48', '−US$ 131,22', '−US$ 38,74'])
    expect(within(document.getElementById('dia')!).getByText('Limite atingido às 10:38')).toBeInTheDocument()
    await abrirDrill(user, '10:52')
    await waitFor(() => expect(screen.getByText('Encerrado por hoje', { selector: 'dd' })).toBeInTheDocument())
    expect(screen.getByText('Na entrada, o “Posso operar hoje?” dizia “Encerrado por hoje” desde 10:38: as operações anteriores já estavam registradas.')).toBeInTheDocument()
  })
})

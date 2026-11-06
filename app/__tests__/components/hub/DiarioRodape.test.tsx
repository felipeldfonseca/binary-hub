/**
 * Fase 4 · telas, lane L1: the Diário's footer (contract §2.2 K1–K4; board dez 13, invented data): a region «Sobre os
 * dados», «Como o diário grava» opening its panel, the line on the results, the discreet link to the old list of
 * trades at /trades?antiga=1 (§7.5: it opens the old list before and after step 4-4's redirect). Also with every
 * Diário read failed (C7): the footer stays.
 */
import { screen, within } from '@testing-library/react'
import { renderDiario } from '@/testing/diarioTelas'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const GRAVA =
  'Um pregão de cada vez: o que você planejou, o que você fez e a sua revisão. Cada operação registrada guarda o “Posso operar hoje?” da entrada, com a hora do servidor; as que chegam só pelo arquivo têm o “Posso operar hoje?” recalculado, e a operação mostra isso. As marcas guardam a hora: as de antes da saída contam como limpas. Cada revisão salva fica guardada com a hora; as anteriores ficam para ler.'

describe('the footer (K1–K4)', () => {
  it('13: «Como o diário grava» opens and closes its panel; the line; «Página antiga de operações» → /trades?antiga=1', async () => {
    const { user } = await renderDiario('13')
    const rodape = await screen.findByRole('region', { name: 'Sobre os dados' })
    expect(rodape).toHaveAttribute('id', 'rodape')
    const botao = within(rodape).getByRole('button', { name: 'Como o diário grava' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(botao).toHaveAttribute('aria-controls', 'info-grava')
    expect(document.getElementById('info-grava')).toBeNull()
    await user.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('info-grava')?.textContent).toBe(GRAVA)
    expect(botao).toHaveFocus()
    await user.click(botao)
    expect(document.getElementById('info-grava')).toBeNull()
    expect(rodape).toHaveTextContent(
      'Apoio à decisão, não recomendação de investimento. Resultados líquidos: a comissão sai quando o arquivo da corretora a traz.',
    )
    expect(within(rodape).getByRole('link', { name: 'Página antiga de operações' })).toHaveAttribute('href', '/trades?antiga=1')
  })

  it('is the page’s last region, after «Semana»', async () => {
    await renderDiario('2')
    const semana = await screen.findByRole('region', { name: 'Semana' })
    const rodape = screen.getByRole('region', { name: 'Sobre os dados' })
    expect(semana.compareDocumentPosition(rodape) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('stays with the Diário in error (C7)', async () => {
    await renderDiario('10d', { estado: 'erro' })
    await screen.findByRole('alert')
    expect(screen.getByRole('region', { name: 'Sobre os dados' })).toBeInTheDocument()
  })
})

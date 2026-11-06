/**
 * Fase 4 · telas, lane L1: Personalizar › Suas contas › «Importações» with the Diário (contract §2.2 L1–L3, D20; board
 * dez 13, invented data): undoing an import says what the owner put in the Diário on the batch's own trades and leaves
 * with them («Saem junto: 2 marcas e 1 nota que você pôs no Diário.»: only the counts above zero, joined with «e»); no
 * line when there is nothing (25 nov: «Desfazer não apaga nada …»); a failed read of the counts as built.
 */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import Importacoes from '@/components/hub/contas/Importacoes'
import { HubDataError } from '@/lib/hub/contasDb'
import { formatWhen } from '@/lib/hub/formato'
import { renderHub } from '@/testing/hubHarness'
import { mocks, renderDiario } from '@/testing/diarioTelas'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const limpo = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ')

/** Scenario 13's world (its batches and what undoing each does), then Top One's «Importações» alone */
async function importacoes() {
  const r = await renderDiario('13')
  const conta = r.q.contas.find((c) => c.id === r.q.info.contaId)!
  r.unmount()
  const view = renderHub(<Importacoes account={conta} onClose={jest.fn()} />)
  await screen.findByText('TopOne_1110.csv', { exact: false })
  return { ...r, view, conta }
}

describe('«Saem junto» in the undo confirmation (D20)', () => {
  it('11 nov: the built confirmation, then «Saem junto: 2 marcas e 1 nota que você pôs no Diário.»; «Manter» has the focus', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    const e = q.esperado.lotes!.find((l) => l.titulo.endsWith('TopOne_1110.csv'))!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${formatWhen(lote.created_at)}` }))
    const grupo = await screen.findByRole('group', { name: limpo(e.confirma) })
    expect(mocks.fetchBatchUndo).toHaveBeenCalledWith(expect.anything(), lote.id)
    expect(within(grupo).getByText(e.saem!)).toBeInTheDocument()
    expect(e.saem).toBe('Saem junto: 2 marcas e 1 nota que você pôs no Diário.')
    // Under the confirmation, in the same live region (the counts arrive after «Manter» took the focus)
    const vivo = within(grupo).getByText(e.saem!).parentElement as HTMLElement
    expect(vivo).toHaveAttribute('aria-live', 'polite')
    expect(vivo.firstElementChild?.textContent?.replace(/ /g, ' ')).toBe(limpo(e.confirma))
    expect(within(grupo).getByRole('button', { name: e.sim })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Manter' })).toHaveFocus()
  })

  it('25 nov: «Desfazer não apaga nada: …» and no «Saem junto» (nothing of the Diário on its own trades)', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1124.csv')!
    const e = q.esperado.lotes!.find((l) => l.titulo.endsWith('TopOne_1124.csv'))!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${formatWhen(lote.created_at)}` }))
    const grupo = await screen.findByRole('group', { name: limpo(e.confirma) })
    expect(e.saem).toBeNull()
    expect(within(grupo).queryByText(/^Saem junto/)).toBeNull()
    expect(within(grupo).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
  })

  it('the counts could not be read: the built line and «Tentar de novo», no «Saem junto»', async () => {
    const { q, user } = await importacoes()
    mocks.fetchBatchUndo.mockRejectedValue(new HubDataError('unknown'))
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${formatWhen(lote.created_at)}` }))
    const grupo = await screen.findByRole('group', { name: 'Não foi possível ver o que esta importação apagaria.' })
    expect(within(grupo).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(within(grupo).queryByText(/^Saem junto/)).toBeNull()
    expect(within(grupo).queryByRole('button', { name: 'Desfazer e apagar' })).toBeNull()
  })

  it('«Manter» closes the confirmation and gives the focus back to «Desfazer»', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    const desfazer = screen.getByRole('button', { name: `Desfazer a importação de ${formatWhen(lote.created_at)}` })
    await user.click(desfazer)
    const grupo = await screen.findByRole('group', { name: /^Desfazer apaga as 5 operações/ })
    await user.click(within(grupo).getByRole('button', { name: 'Manter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: `Desfazer a importação de ${formatWhen(lote.created_at)}` })).toHaveFocus())
    expect(screen.queryByText(/^Saem junto/)).toBeNull()
  })
})

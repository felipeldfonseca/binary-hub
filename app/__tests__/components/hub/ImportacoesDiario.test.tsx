/**
 * Fase 4 · telas, lane L1: Personalizar › Suas contas › «Importações» with the Diário (contract §2.2 L1–L3, D20; board
 * dez 13, invented data): undoing an import says what the owner put in the Diário on the batch's own trades and leaves
 * with them («Saem junto: 2 marcas e 1 nota que você pôs no Diário.»: only the counts above zero, joined with «e»); no
 * line when there is nothing (25 nov: «Desfazer não apaga nada …»); a failed read of the counts as built.
 */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import Importacoes, { quandoNoRelogio } from '@/components/hub/contas/Importacoes'
import { HubDataError } from '@/lib/hub/contasDb'
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

describe('the batches’ time on the account’s clock (contract §3.4; board dez 13)', () => {
  it('Top One’s batches as the board writes them, on ET (the market’s window clock), never the device’s zone', async () => {
    const { q } = await importacoes()
    for (const e of q.esperado.lotes!) {
      expect(screen.getByText(e.titulo, { exact: false })).toBeInTheDocument()
      if (e.desfazer) expect(screen.getByRole('button', { name: e.aria })).toBeInTheDocument()
    }
    expect(q.esperado.lotes!.map((e) => e.titulo)).toEqual(['25 nov, 19:08 · TopOne_1124.csv', '18 nov, 19:05 · TopOne_1117.csv', '11 nov, 19:12 · TopOne_1110.csv'])
    expect(screen.getByRole('button', { name: 'Desfazer a importação de 11 nov, 19:12' })).toBeInTheDocument()
  })

  it('quandoNoRelogio: the day on that clock near midnight, the year only when it is not the current one there', () => {
    const agora = new Date('2026-12-01T16:35:00Z')
    expect(quandoNoRelogio('2026-11-12T00:12:00+00:00', 'America/New_York', { agora })).toBe('11 nov, 19:12')
    expect(quandoNoRelogio('2026-11-12T00:12:00+00:00', 'America/Sao_Paulo', { agora })).toBe('11 nov, 21:12')
    expect(quandoNoRelogio('2026-11-12T03:30:00+00:00', 'America/Sao_Paulo', { agora })).toBe('12 nov, 00:30')
    expect(quandoNoRelogio('2026-11-12T03:30:00+00:00', 'America/New_York', { agora })).toBe('11 nov, 22:30')
    expect(quandoNoRelogio('2026-11-12T00:12:00+00:00', 'America/New_York', { agora, hora: false })).toBe('11 nov')
    // 1 Jan 2026 02:00Z is still 2025 in New York
    expect(quandoNoRelogio('2026-01-01T02:00:00Z', 'America/New_York', { agora })).toBe('31 dez 2025, 21:00')
    expect(quandoNoRelogio('2026-01-01T02:00:00Z', 'UTC', { agora })).toBe('1 jan, 02:00')
    expect(quandoNoRelogio('não é data', 'America/New_York', { agora })).toBe('')
  })
})

describe('«Saem junto» in the undo confirmation (D20)', () => {
  it('11 nov: the built confirmation, then «Saem junto: 2 marcas e 1 nota que você pôs no Diário.»; «Manter» has the focus', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    const e = q.esperado.lotes!.find((l) => l.titulo.endsWith('TopOne_1110.csv'))!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${quandoNoRelogio(lote.created_at, 'America/New_York')}` }))
    const grupo = await screen.findByRole('group', { name: limpo(e.confirma) })
    expect(mocks.fetchBatchUndo).toHaveBeenCalledWith(expect.anything(), lote.id)
    expect(within(grupo).getByText(e.saem!)).toBeInTheDocument()
    expect(e.saem).toBe('Saem junto: 2 marcas e 1 nota que você pôs no Diário.')
    // Under the confirmation, in the same live region (the counts arrive after «Manter» took the focus)
    const vivo = within(grupo).getByText(e.saem!).parentElement as HTMLElement
    expect(vivo).toHaveAttribute('aria-live', 'polite')
    expect(vivo.firstElementChild?.textContent?.replace(/ /g, ' ')).toBe(limpo(e.confirma))
    // 8 px under it, as the board's `.atencao` (column, gap 8px) whose children both are (review: 4 px)
    expect(vivo.style.gap).toBe('8px')
    expect(within(grupo).getByRole('button', { name: e.sim })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Manter' })).toHaveFocus()
  })

  it('25 nov: «Desfazer não apaga nada: …» and no «Saem junto» (nothing of the Diário on its own trades)', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1124.csv')!
    const e = q.esperado.lotes!.find((l) => l.titulo.endsWith('TopOne_1124.csv'))!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${quandoNoRelogio(lote.created_at, 'America/New_York')}` }))
    const grupo = await screen.findByRole('group', { name: limpo(e.confirma) })
    expect(e.saem).toBeNull()
    expect(within(grupo).queryByText(/^Saem junto/)).toBeNull()
    expect(within(grupo).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
  })

  it('the counts could not be read: the built line and «Tentar de novo», no «Saem junto»', async () => {
    const { q, user } = await importacoes()
    mocks.fetchBatchUndo.mockRejectedValue(new HubDataError('unknown'))
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    await user.click(screen.getByRole('button', { name: `Desfazer a importação de ${quandoNoRelogio(lote.created_at, 'America/New_York')}` }))
    const grupo = await screen.findByRole('group', { name: 'Não foi possível ver o que esta importação apagaria.' })
    expect(within(grupo).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(within(grupo).queryByText(/^Saem junto/)).toBeNull()
    expect(within(grupo).queryByRole('button', { name: 'Desfazer e apagar' })).toBeNull()
  })

  it('an undone batch: «Desfeita em» the day on the account’s clock, never the device’s (03:30Z is still 11 nov in ET)', async () => {
    const r = await renderDiario('13')
    const conta = r.q.contas.find((c) => c.id === r.q.info.contaId)!
    r.unmount()
    const base = r.q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    mocks.fetchBatches.mockReset().mockResolvedValue([{ ...base, status: 'undone', undone_at: '2026-11-12T03:30:00+00:00' }])
    renderHub(<Importacoes account={conta} onClose={jest.fn()} />)
    const desfeita = await screen.findByText(/^Desfeita em/)
    expect(limpo(desfeita.textContent)).toBe('Desfeita em 11 nov')
    expect(screen.queryByRole('button', { name: /^Desfazer a importação/ })).toBeNull()
  })

  it('a batch with one new trade says «1 nova» (the board engine’s singular), the others «N novas»', async () => {
    const { q } = await importacoes()
    const parte = (arquivo: string) => {
      const linha = screen.getByText(arquivo, { exact: false }).closest('li') as HTMLElement
      return linha.querySelector('.hub-partes')?.firstElementChild?.textContent
    }
    const um = q.lotes!.batches.find((b) => b.rows_inserted === 1)!
    expect(um.file_name).toBe('TopOne_1021.csv')
    expect(parte(um.file_name!)).toBe('1 nova')
    expect(parte('TopOne_1110.csv')).toBe('5 novas')
    expect(parte('TopOne_1124.csv')).toBe('0 novas')
  })

  it('«Manter» closes the confirmation and gives the focus back to «Desfazer»', async () => {
    const { q, user } = await importacoes()
    const lote = q.lotes!.batches.find((b) => b.file_name === 'TopOne_1110.csv')!
    const desfazer = screen.getByRole('button', { name: `Desfazer a importação de ${quandoNoRelogio(lote.created_at, 'America/New_York')}` })
    await user.click(desfazer)
    const grupo = await screen.findByRole('group', { name: /^Desfazer apaga as 5 operações/ })
    await user.click(within(grupo).getByRole('button', { name: 'Manter' }))
    await waitFor(() => expect(screen.getByRole('button', { name: `Desfazer a importação de ${quandoNoRelogio(lote.created_at, 'America/New_York')}` })).toHaveFocus())
    expect(screen.queryByText(/^Saem junto/)).toBeNull()
  })
})

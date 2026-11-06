/**
 * Fase 4 · telas, lane L2: «O dia» on the approved boards' scenarios (testing/diarioTelas, invented data) — the
 * heading and its tags, the note under it, the four tiles and «Como ler os números do dia» (E1–E8), «O plano do dia»
 * with its rows, the version lines, «Antes de operar» and «Do pregão anterior», the timeline's place (F1–F13); and the
 * day kept on screen when a later read fails (the Phase 3 bridge's case).
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { diarioKeys } from '@/hooks/useDiario'
import { mocks, renderDiario } from '@/testing/diarioTelas'
import { navegacao, USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import type { Cenario, EsperadoDia } from '@/testing/diarioQuadro'
import { doPregaoAnterior } from '@/lib/hub/diario'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const texto = (el: Element | null) => sem(el?.textContent)

async function oDia() {
  const regiao = document.getElementById('dia')
  await waitFor(() => expect(document.getElementById('dia')?.querySelector('.hub-dr-dia-numeros')).toBeTruthy())
  return (regiao ?? document.getElementById('dia')) as HTMLElement
}

/** The tiles as [label, value, sub] */
function tiles(dia: HTMLElement): string[][] {
  return Array.from(dia.querySelectorAll('.hub-dr-tile')).map((t) => Array.from(t.children).map((c) => texto(c)).filter(Boolean))
}

/** Opens another exported day of the scenario through the URL (the page follows it, contract §4.3) */
async function abrirDiaPelaUrl(contaId: string, dia: string) {
  act(() => navegacao.definir(`/diario?conta=${contaId}&dia=${dia}`))
  await waitFor(() => expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toBeInTheDocument())
}

function confereNumeros(dia: HTMLElement, e: EsperadoDia) {
  const rs = e.rs as Record<string, string | boolean>
  const ts = tiles(dia)
  expect(ts[0]).toEqual(['Resultado', rs.res])
  expect(ts[1]).toEqual(['Operações', rs.ops, rs.opsSub].filter(Boolean))
  expect(ts[2]).toEqual(['Limite do dia', rs.lim, rs.limSub].filter(Boolean))
  expect(ts[3]).toEqual(['Fora do plano', rs.fora, rs.foraSub].filter(Boolean))
  expect(!!dia.querySelector('.hub-dr-barra')).toBe(!!rs.temBarra)
}

/** «Do pregão anterior»: the board's, or the database's carry_in where they differ (B0-1, reported to the owner) */
function conferePlano(dia: HTMLElement, e: EsperadoDia, anterior?: string) {
  if (!e.comPlano) {
    expect(within(dia).queryByRole('heading', { level: 3, name: 'O plano do dia' })).toBeNull()
    expect(within(dia).queryByText('chega na Fase 5')).toBeNull()
    return
  }
  const lista = within(dia).getByRole('list', { name: 'O plano do dia' })
  const linhas = within(lista)
    .getAllByRole('listitem')
    .map((li) => Array.from(li.querySelectorAll('strong, .hub-dr-plano-meio > *, .hub-dr-plano-marca')).map(texto).join(' '))
  expect(linhas).toEqual(e.plano!.map((l) => sem([l.item, l.plano, l.fato, l.link ?? '', l.marca].filter(Boolean).join(' '))))
  expect(Array.from(dia.querySelectorAll('.hub-dr-plano-versao')).map(texto)).toEqual(e.versao)
  if (e.anterior) expect(sem(within(dia).getByText('Do pregão anterior').parentElement?.textContent)).toBe(sem(`Do pregão anterior${anterior ?? e.anterior}`))
  expect(within(dia).getByText('chega na Fase 5')).toBeInTheDocument()
  expect(within(dia).getByText('Chega na Fase 5, com o estado do mercado ao longo do dia.')).toBeInTheDocument()
}

describe('E · the heading, its tags, the note and the tiles', () => {
  it.each(['2', '3', '3b', '4', '5', '9', '9b', '11a', '11b', '13', '1', '6', '7', '8', '10a', '10b'] as Cenario[])('%s: as the board', async (cen) => {
    const { q } = await renderDiario(cen)
    const e = q.esperado as EsperadoDia
    const dia = await oDia()
    expect(within(dia).getByRole('heading', { level: 2 })).toHaveTextContent(e.dia.titulo)
    expect(dia).toHaveAttribute('aria-labelledby', 't-dia')
    expect(Array.from(dia.querySelectorAll('.hub-dr-dia-cab .hub-dr-chip')).map(texto)).toEqual(e.dia.tags)
    expect(texto(dia.querySelector('.hub-dr-dia-nota')) || null).toBe(e.dia.nota)
    confereNumeros(dia, e)
    conferePlano(dia, e, doPregaoAnterior(q.dias[q.info.dia].carryIn))
  })

  it('«Limite do dia» and «Fora do plano» in the regular font (E4): `--texto`; «Resultado» and «Operações» mono', async () => {
    await renderDiario('3')
    const dia = await oDia()
    const valores = Array.from(dia.querySelectorAll('.hub-dr-tile')).map((t) => t.children[1])
    expect(valores.map((v) => v.classList.contains('hub-dr-valor--texto'))).toEqual([false, false, true, true])
    expect(valores[0]).toHaveClass('hub-tom--red')
    // 3: the limit hit — the bar is red
    expect(dia.querySelector('.hub-dr-dia-barra')).toHaveClass('hub-dr-dia-barra--red')
  })

  it('«Como ler os números do dia»: the ⓘ opens the board’s text (2, 4 misto with history, 5 history, 9 somando)', async () => {
    for (const cen of ['2', '4', '5', '9'] as Cenario[]) {
      const { q, user, unmount } = await renderDiario(cen)
      const dia = await oDia()
      const info = within(dia).getByRole('button', { name: 'Como ler: os números do dia' })
      expect(info).toHaveAttribute('aria-expanded', 'false')
      await user.click(info)
      expect(info).toHaveAttribute('aria-expanded', 'true')
      expect(texto(document.getElementById('info-resumo'))).toBe(sem(q.esperado.infoResumo))
      unmount()
    }
  })

  it('4 → 21 out and 23 out (opened from the URL): the old page’s day and the version line «Até 09:40 valia a versão 1: …»', async () => {
    const { q } = await renderDiario('4')
    for (const dia of ['2026-10-21', '2026-10-23']) {
      await abrirDiaPelaUrl(q.info.contaId, dia)
      const e = q.esperado.extras![dia]
      const el = await oDia()
      await waitFor(() => expect(within(el).getByRole('heading', { level: 2 })).toHaveTextContent(e.dia.titulo))
      await waitFor(() => expect(tiles(el)[0]).toEqual(['Resultado', (e.rs as Record<string, string>).res]))
      confereNumeros(el, e)
      conferePlano(el, e, doPregaoAnterior(q.dias[dia].carryIn))
    }
  })

  it('a refetch that fails after the day answered keeps the day drawn, without an alert (the bridge’s case)', async () => {
    const { q, queryClient } = await renderDiario('2')
    await oDia()
    mocks.fetchDia.mockRejectedValue(new (jest.requireActual('@/lib/hub/diarioDb').DiarioDataError)('unknown'))
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: diarioKeys.dia(USUARIO_DO_QUADRO, q.info.contaId, q.info.dia) })
    })
    expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Terça-feira, 10 de novembro')
    expect(tiles(document.getElementById('dia')!)[0]).toEqual(['Resultado', '+US$ 267,93'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('«Carregando…» in the day’s card while its read has not answered', async () => {
    const { q } = await renderDiario('2')
    await oDia()
    mocks.fetchDia.mockImplementation(() => new Promise(() => {}))
    act(() => navegacao.definir(`/diario?conta=${q.info.contaId}&dia=2026-11-19`))
    const dia = document.getElementById('dia')!
    await waitFor(() => expect(within(dia).getByRole('heading', { level: 2 })).toHaveTextContent('Quinta-feira, 19 de novembro'))
    expect(within(dia).getByRole('status')).toHaveTextContent('Carregando…')
  })
})

describe('DEV B0-1 · «Do pregão anterior» is the database’s carry_in (for the owner, with the PR)', () => {
  it('9 (Lucid, 1º dez): the board says «Nada trazido do pregão anterior.»; the app shows the newest earlier carry, «“Uma operação por vez.” · 27 nov»', async () => {
    const { q } = await renderDiario('9')
    const e = q.esperado as EsperadoDia
    expect(e.anterior).toBe('Nada trazido do pregão anterior.')
    expect(q.dias[q.info.dia].carryIn?.day).toBe('2026-11-27')
    const dia = await oDia()
    expect(sem(within(dia).getByText('Do pregão anterior').parentElement?.textContent)).toBe('Do pregão anterior“Uma operação por vez.” · 27 nov')
  })
})

describe('F · «O plano do dia»', () => {
  it('the ⓘ: the board’s text with the breakeven sentence and Futuros’ Phase 5 one', async () => {
    const { q, user } = await renderDiario('2')
    const dia = await oDia()
    await user.click(within(dia).getByRole('button', { name: 'Como ler: O plano do dia' }))
    expect(texto(document.getElementById('info-plano'))).toBe(q.esperado.infoPlano)
  })

  it('10b: «Sem janela salva» with «Definir em Personalizar» (a 44 px link to the windows) and «Sem regra»', async () => {
    await renderDiario('10b')
    const dia = await oDia()
    const link = within(dia).getByRole('link', { name: 'Definir em Personalizar' })
    expect(link).toHaveAttribute('href', '/personalizar#janelas')
    expect(link).toHaveClass('hub-dr-plano-link')
  })

  it('«Antes de operar» on a past day: the text and its line, no «Editar»; a past day without one: «Nada anotado antes de operar.»', async () => {
    await renderDiario('2')
    const dia = await oDia()
    expect(within(dia).getByText('Esperar a primeira meia hora. Vender só abaixo da mínima de ontem.')).toBeInTheDocument()
    expect(within(dia).getByText('anotado às 09:41, antes da 1ª entrada')).toBeInTheDocument()
    expect(within(dia).queryByRole('button', { name: 'Editar a nota de antes de operar' })).toBeNull()
  })

  it('3: a past day without a note: «Nada anotado antes de operar.»', async () => {
    const { q } = await renderDiario('3')
    const dia = await oDia()
    if (!q.dias[q.info.dia].note) expect(within(dia).getByText('Nada anotado antes de operar.')).toBeInTheDocument()
  })

  it('1 (today): «Editar» → the field (focused) → «Salvar»: the status «Anotado às 10:42 ET.», the line «… · editado às 10:42, depois da 1ª entrada», focus «Editar»', async () => {
    const { user } = await renderDiario('1')
    const dia = await oDia()
    expect(within(dia).getByText('Só compro acima da VWAP; parcial no +8.')).toBeInTheDocument()
    await user.click(within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' }))
    const campo = within(dia).getByLabelText('Antes de operar')
    await waitFor(() => expect(campo).toHaveFocus())
    expect(campo).toHaveValue('Só compro acima da VWAP; parcial no +8.')
    expect(campo).toHaveAttribute('maxlength', '500')
    expect(within(dia).getByText('Guardado com a hora do servidor.')).toBeInTheDocument()
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' })).toHaveFocus())
    expect(mocks.saveDayNote).toHaveBeenCalledTimes(1)
    expect(mocks.saveDayNote.mock.calls[0][3]).toMatchObject({ v: 1, text: 'Só compro acima da VWAP; parcial no +8.' })
    await waitFor(() => expect(within(dia).getByText('anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada')).toBeInTheDocument())
    expect(Array.from(dia.querySelectorAll('[role="status"]')).map(texto)).toContain('Anotado às 10:42 ET.')
  })

  it('1: «Cancelar» and Escape give the focus back to «Editar» and send nothing', async () => {
    const { user } = await renderDiario('1')
    const dia = await oDia()
    const editar = within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' })
    await user.click(editar)
    await user.click(within(dia).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' })).toHaveFocus())
    await user.click(within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' }))
    await waitFor(() => expect(within(dia).getByLabelText('Antes de operar')).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(within(dia).getByRole('button', { name: 'Editar a nota de antes de operar' })).toHaveFocus())
    expect(mocks.saveDayNote).not.toHaveBeenCalled()
  })

  it('9 (today without a note): an empty or blank save sends nothing; a text saves with one client_key', async () => {
    const { user } = await renderDiario('9')
    const dia = await oDia()
    const campo = within(dia).getByLabelText('Antes de operar')
    expect(campo).toHaveAttribute('placeholder', 'Ex.: esperar o rompimento da máxima de ontem.')
    expect(within(dia).queryByRole('button', { name: 'Cancelar' })).toBeNull()
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    await user.type(campo, '   ')
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    expect(mocks.saveDayNote).not.toHaveBeenCalled()
    await user.type(campo, 'Só a favor da tendência.')
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mocks.saveDayNote).toHaveBeenCalledTimes(1))
    expect(mocks.saveDayNote.mock.calls[0][3].client_key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('«Antes de operar» offline: «Sem conexão. A nota não foi salva.» at once, nothing sent, the text kept', async () => {
    const { user } = await renderDiario('9')
    const dia = await oDia()
    const campo = within(dia).getByLabelText('Antes de operar')
    await user.type(campo, 'Esperar a VWAP.')
    act(() => onlineManager.setOnline(false))
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    expect(await within(dia).findByRole('alert')).toHaveTextContent('Sem conexão. A nota não foi salva.')
    expect(mocks.saveDayNote).not.toHaveBeenCalled()
    expect(campo).toHaveValue('Esperar a VWAP.')
  })

  it('a save that failed keeps its client_key for the retry (one key per editing session)', async () => {
    const { user } = await renderDiario('9')
    const dia = await oDia()
    const DiarioDataError = jest.requireActual('@/lib/hub/diarioDb').DiarioDataError
    mocks.saveDayNote.mockRejectedValueOnce(new DiarioDataError('network'))
    await user.type(within(dia).getByLabelText('Antes de operar'), 'Esperar a VWAP.')
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    expect(await within(dia).findByRole('alert')).toHaveTextContent('Sem conexão. A nota não foi salva.')
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mocks.saveDayNote).toHaveBeenCalledTimes(2))
    expect(mocks.saveDayNote.mock.calls[1][3].client_key).toBe(mocks.saveDayNote.mock.calls[0][3].client_key)
  })

  it('another refusal (not_today when the day turned): «Não foi possível salvar a nota.» and the day is read again', async () => {
    const { user } = await renderDiario('9')
    const dia = await oDia()
    const DiarioDataError = jest.requireActual('@/lib/hub/diarioDb').DiarioDataError
    mocks.saveDayNote.mockRejectedValueOnce(new DiarioDataError('not_today'))
    const leituras = mocks.fetchDia.mock.calls.length
    await user.type(within(dia).getByLabelText('Antes de operar'), 'Esperar a VWAP.')
    await user.click(within(dia).getByRole('button', { name: 'Salvar' }))
    expect(await within(dia).findByRole('alert')).toHaveTextContent('Não foi possível salvar a nota.')
    await waitFor(() => expect(mocks.fetchDia.mock.calls.length).toBeGreaterThan(leituras))
  })
})

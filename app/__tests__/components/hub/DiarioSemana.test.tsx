/**
 * Fase 4 · telas, lane L1: «Semana» (contract §2.2 J1–J7) on the approved boards' scenarios (testing/diarioTelas,
 * invented data): the title, the ⓘ, the four tiles (mono 17 px), the empty weeks, one bar per day (and their screen
 * reader's paragraph), the «Fora do plano» list, against the board's own values (esperado). The week's month read when
 * the week's Monday is in another month than the one shown (30 nov–4 dez with December shown): its «Carregando…», its
 * error «Não foi possível carregar a semana.» and «Tentar de novo» (read again, focus on «Semana»).
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { DiarioDataError } from '@/lib/hub/diarioDb'
import { mocks, mostrarMesDe, renderDiario } from '@/testing/diarioTelas'
import type { Cenario } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const NBSP = / /g
const limpo = (s: string | null | undefined) => (s ?? '').replace(NBSP, ' ')
const semana = () => screen.getByRole('region', { name: 'Semana' })

/** What the card shows, as the board's esperado holds it */
function lerSemana() {
  const s = semana()
  const tiles = Array.from(s.querySelectorAll('.hub-dr-tile')).map((t) => [t.querySelector('.hub-dr-rotulo')?.textContent, limpo(t.querySelector('.hub-dr-valor')?.textContent)])
  const corpo = s.querySelector(':scope > p.hub-dr-sub')
  return {
    titulo: limpo(s.querySelector('.hub-dr-cab .hub-dr-sub')?.textContent),
    numeros: tiles.length ? tiles : null,
    vazia: corpo ? limpo(corpo.textContent) : null,
    barras: Array.from(s.querySelectorAll('.hub-dr-sem-dia')).map((d) => [
      d.querySelector('.hub-dr-sem-rot')?.textContent,
      limpo(d.querySelector('.hub-dr-sem-val-longo')?.textContent),
      limpo(d.querySelector('.hub-dr-sem-val-curto')?.textContent),
    ]),
    leitor: limpo(s.querySelector('.hub-dr-sem-barras-col > p.sr-only')?.textContent) || null,
    fora: Array.from(s.querySelectorAll('.hub-dr-sem-lista li')).map((li) => limpo(li.textContent)),
  }
}

async function pronto(cen: Cenario) {
  const r = await renderDiario(cen)
  const s = await screen.findByRole('region', { name: 'Semana' })
  await waitFor(() => expect(within(s).queryByText('Carregando…')).toBeNull())
  return r
}

describe.each<Cenario>(['11a', '11b', '5', '7', '8', '10b'])('scenario %s: the week as the board draws it', (cen) => {
  it('title, tiles, the empty line, bars, the screen reader’s paragraph, the «Fora do plano» list, the ⓘ', async () => {
    const { q, user } = await pronto(cen)
    const e = q.esperado.semana!
    const vazia = !!e.vazia
    expect(lerSemana()).toEqual({
      titulo: limpo(e.titulo),
      numeros: vazia ? null : e.numeros.map(([r, v]) => [r, limpo(v)]),
      vazia: vazia ? limpo(e.vazia) : null,
      barras: vazia ? [] : e.barras.map(([r, v, c]) => [r, limpo(v), limpo(c)]),
      leitor: vazia ? null : limpo(e.leitor),
      fora: e.fora.map(limpo),
    })
    if (!vazia && !e.fora.length) expect(within(semana()).getByText('Nenhuma operação fora do plano nesta semana.')).toBeInTheDocument()
    if (!vazia) {
      // The four values mono 17 px (hub-diario.css `--semana`), in the board's colours
      for (const v of Array.from(semana().querySelectorAll('.hub-dr-valor'))) expect(v).toHaveClass('hub-dr-valor--semana')
      // The bars are for the eye; the paragraph reads them
      expect(semana().querySelector('.hub-dr-sem-barras')).toHaveAttribute('aria-hidden', 'true')
    }
    const info = within(semana()).getByRole('button', { name: 'Como ler: Semana' })
    await user.click(info)
    expect(document.getElementById('info-semana')?.textContent).toBe(e.info)
    expect(within(semana()).getByRole('heading', { level: 2, name: 'Semana' })).toHaveAttribute('id', 't-sem')
  })
})

describe('the colours of the tiles and the bars', () => {
  it('11a: the result’s sign, «Fora do plano» amber; a loss bar red-fill, a gain bar mint, heights by the largest day', async () => {
    await pronto('11a')
    const valores = Array.from(semana().querySelectorAll('.hub-dr-valor'))
    expect(valores.map((v) => Array.from(v.classList).find((c) => c.startsWith('hub-tom--')))).toEqual(['hub-tom--mint', 'hub-tom--neutral', 'hub-tom--amber', 'hub-tom--neutral'])
    const barras = Array.from(semana().querySelectorAll<HTMLElement>('.hub-dr-sem-dia'))
    // seg 23: −204,93 (a loss: below the axis), qua 25: +177,75 (a gain: above)
    const seg = barras[0].querySelectorAll<HTMLElement>('.hub-dr-sem-barra')
    expect(seg[0].style.height).toBe('0px')
    expect(seg[1]).toHaveClass('hub-dr-sem-barra--perda')
    expect(seg[1].style.height).toBe('56px')
    const qua = barras[2].querySelectorAll<HTMLElement>('.hub-dr-sem-barra')
    expect(qua[0]).not.toHaveClass('hub-dr-sem-barra--perda')
    expect(Number.parseInt(qua[0].style.height, 10)).toBeGreaterThan(3)
  })
})

describe('the week’s own month read (30 nov–4 dez, December shown)', () => {
  it('reads November for the week’s ● and list, while December is the month shown', async () => {
    const { q } = await pronto('11b')
    expect(mocks.fetchMes).toHaveBeenCalledWith(expect.anything(), q.info.contaId, '2026-12')
    expect(mocks.fetchMes).toHaveBeenCalledWith(expect.anything(), q.info.contaId, '2026-11')
    expect(lerSemana().fora).toEqual(['ter 1 · 11:09 · Compra MES · fora da janela · −US$ 112,50'])
  })

  it('«Carregando…» in the card while it is read (the title already there); the page is not in error', async () => {
    await renderDiario('11b')
    const original = mocks.fetchMes.getMockImplementation()!
    mocks.fetchMes.mockImplementation((db, id, month) => (month === '2026-11' ? new Promise(() => {}) : original(db, id, month)))
    const s = await screen.findByRole('region', { name: 'Semana' })
    expect(await within(s).findByText('Carregando…')).toHaveAttribute('role', 'status')
    expect(within(s).getByText('Semana em andamento · 2 de 5 pregões')).toBeInTheDocument()
    expect(s.querySelector('.hub-dr-tile')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('region', { name: 'Calendário' })).toBeInTheDocument()
  })

  it('its error, «Tentar de novo»: reads it again and gives the focus to «Semana»; the week then draws', async () => {
    const { user } = await renderDiario('11b')
    const original = mocks.fetchMes.getMockImplementation()!
    mocks.fetchMes.mockImplementation((db, id, month) => (month === '2026-11' ? Promise.reject(new DiarioDataError('unknown')) : original(db, id, month)))
    const s = await screen.findByRole('region', { name: 'Semana' })
    expect(await within(s).findByRole('alert')).toHaveTextContent('Não foi possível carregar a semana.')
    // Only the week's card: the calendar and the page stay
    expect(screen.getByRole('region', { name: 'Calendário' })).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar o Diário.')).toBeNull()
    mocks.fetchMes.mockImplementation(original)
    const chamadas = mocks.fetchMes.mock.calls.filter((c) => c[2] === '2026-11').length
    await user.click(within(s).getByRole('button', { name: 'Tentar de novo' }))
    expect(within(s).getByRole('heading', { level: 2, name: 'Semana' })).toHaveFocus()
    await waitFor(() => expect(mocks.fetchMes.mock.calls.filter((c) => c[2] === '2026-11').length).toBe(chamadas + 1))
    await waitFor(() => expect(lerSemana().fora).toEqual(['ter 1 · 11:09 · Compra MES · fora da janela · −US$ 112,50']))
    expect(within(s).queryByRole('alert')).toBeNull()
  })

  it('a week left behind by ‹ (10 nov’s week with October shown) keeps its numbers from November’s read', async () => {
    const { user, q } = await pronto('2')
    await mostrarMesDe(user, '2026-10-01')
    await act(async () => {
      await new Promise((ok) => setTimeout(ok, 20))
    })
    expect(lerSemana().titulo).toBe(q.esperado.semana!.titulo)
    expect(lerSemana().fora).toEqual(q.esperado.semana!.fora)
  })
})

/**
 * Fase 4 · telas, lane L1: «Calendário» (contract §2.2 D1–D23) on the approved boards' scenarios (testing/diarioTelas,
 * invented data). Every cell of the month a scenario shows says what the board says (esperado: the board engine's own
 * values), the marks, the hatch, today's dot, the open day, the neighbouring month and the future, 5 or 7 columns, the
 * «Semana» column; the keyboard (one tab stop, arrows between the days that open, Home/End, PageUp/PageDown), ‹ «Hoje» ›
 * and their ends; a tap opens the day below and keeps the focus; a week opens in the card; the ⓘ per market clock.
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { diarioKeys } from '@/hooks/useDiario'
import { mocks, mostrarMesDe, renderDiario, type DiarioRenderizado } from '@/testing/diarioTelas'
import { navegacao, USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import type { Cenario, EsperadoCelula, EsperadoSemanaCal } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const NBSP = / /g
const limpo = (s: string | null | undefined) => (s ?? '').replace(NBSP, ' ')

const calendario = () => screen.getByRole('region', { name: 'Calendário' })
const grade = () => calendario().querySelector('.hub-dr-cal-grade') as HTMLElement
const celulas = () => Array.from(grade().querySelectorAll<HTMLElement>('.hub-dr-cal-cel:not(.hub-dr-cal-sem)'))
const semanas = () => Array.from(grade().querySelectorAll<HTMLElement>('.hub-dr-cal-sem'))
const celula = (dia: string) => grade().querySelector<HTMLElement>(`[data-dia="${dia}"]`) as HTMLElement

/** The board's classes (engine `classe`) as this lane's */
const CLASSES: Record<string, string> = {
  'cal-imp': 'hub-dr-cal-cel--hist',
  'cal-imp-forte': 'hub-dr-cal-cel--hist-forte',
  'cal-hoje': 'hub-dr-cal-cel--hoje',
  'cal-fora': 'hub-dr-cal-cel--fora',
  'dica-e': 'hub-dr-cal-cel--dica-e',
  'dica-d': 'hub-dr-cal-cel--dica-d',
}
const classesDaCelula = (el: HTMLElement) =>
  Object.values(CLASSES)
    .filter((c) => el.classList.contains(c))
    .sort()

/** What one cell shows and says, read as the board's esperado holds it */
function lerCelula(el: HTMLElement) {
  const botao = el.tagName === 'BUTTON'
  const marcas = el.querySelector('.hub-dr-cal-marcas')
  return {
    id: botao ? el.getAttribute('data-dia') : null,
    clicavel: botao,
    tab: botao ? el.getAttribute('tabindex') : null,
    aberto: el.getAttribute('aria-pressed') === 'true',
    classe: classesDaCelula(el),
    res: limpo(el.querySelector('.hub-dr-cal-res--longo')?.textContent),
    curto: limpo(el.querySelector('.hub-dr-cal-res--curto')?.textContent),
    marcas: marcas ? { fora: marcas.textContent!.includes('●'), limite: marcas.textContent!.includes('■'), revisao: marcas.textContent!.includes('✓') } : null,
    dica: limpo(el.querySelector('.hub-dr-cal-dica')?.textContent),
    aria: limpo(botao ? el.getAttribute('aria-label') : el.querySelector('.sr-only')?.textContent),
  }
}

function esperadaCelula(c: EsperadoCelula) {
  return {
    id: c.clicavel ? c.id : null,
    clicavel: c.clicavel,
    tab: c.clicavel ? String(c.tab) : null,
    aberto: c.aberto,
    classe: c.classe
      .split(/\s+/)
      .filter(Boolean)
      .map((k) => CLASSES[k])
      .sort(),
    res: limpo(c.res),
    curto: limpo(c.curto),
    marcas: c.marcas && (c.marcas.fora || c.marcas.limite || c.marcas.revisao) ? c.marcas : null,
    dica: limpo(c.dica),
    aria: limpo(c.aria),
  }
}

function lerSemana(el: HTMLElement) {
  const botao = el.tagName === 'BUTTON'
  const ns = el.querySelectorAll('.hub-dr-cal-sem-n')
  return {
    rotulo: el.querySelector('.hub-dr-cal-sem-rot')?.textContent ?? null,
    botao,
    res: botao ? limpo(el.querySelector('.hub-dr-cal-sem-res')?.textContent) : null,
    n: botao ? limpo(ns[0]?.textContent) : null,
    hist: botao && ns[1] ? limpo(ns[1].textContent) : null,
    aria: botao ? limpo(el.getAttribute('aria-label')) : null,
    traco: botao ? null : el.querySelector('.hub-dr-cal-sem-traco')?.textContent ?? '',
  }
}

function esperadaSemana(w: EsperadoSemanaCal) {
  return {
    rotulo: w.rotulo,
    botao: w.botao,
    res: w.botao ? limpo(w.res) : null,
    n: w.botao ? `${w.n}${w.fora ? ` · ● ${w.fora}` : ''}` : null,
    hist: w.botao && w.hist ? `▨ ${limpo(w.hist)}` : null,
    aria: w.botao ? limpo(w.aria) : null,
    traco: w.botao ? null : (w.traco ?? ''),
  }
}

async function pronto(cen: Cenario, mes?: string): Promise<DiarioRenderizado> {
  const r = await renderDiario(cen)
  await screen.findByRole('region', { name: 'Calendário' })
  if (mes) await mostrarMesDe(r.user, `${mes}-01`)
  // ● and ■ come from the month's read
  await waitFor(() => expect(mocks.fetchMes).toHaveBeenCalled())
  await act(async () => {
    await new Promise((ok) => setTimeout(ok, 20))
  })
  return r
}

describe.each<[Cenario, string | undefined]>([
  ['2', undefined],
  ['4', undefined],
  ['7', undefined],
  ['10a', '2026-10'],
  ['10b', undefined],
])('scenario %s: the month the board shows, cell by cell', (cen, mes) => {
  it('every day: button or not, its tab stop, open, hatch / today / neighbour classes, result, short, marks, hover, label', async () => {
    const { q } = await pronto(cen, mes)
    const e = q.esperado
    expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent(e.mes!.titulo)
    expect(Array.from(grade().querySelectorAll('.hub-dr-cal-col')).map((h) => h.textContent)).toEqual([...e.mes!.colunas, 'Semana'])
    const esperadas = e.semanas!.flatMap((w) => w.dias).map(esperadaCelula)
    await waitFor(() => expect(celulas().map(lerCelula)).toEqual(esperadas))
    expect(semanas().map(lerSemana)).toEqual(e.semanas!.map(esperadaSemana))
    // The legend: ■ only with a daily limit in the account's rules
    const legenda = within(calendario()).getByRole('group', { name: 'Legenda' })
    expect(legenda.textContent?.includes('limite atingido')).toBe(!!e.legendaLimite)
    for (const t of ['Ganho', 'Perda', 'fora do plano', 'revisão', 'histórico importado']) expect(legenda).toHaveTextContent(t)
    // «Toque num dia para abrir. Valores em US$.»
    expect(within(calendario()).getByText(`Toque num dia para abrir. ${e.conta.valores}`)).toBeInTheDocument()
    expect(screen.getByText(e.mes!.status)).toHaveAttribute('role', 'status')
  })
})

describe('the cells’ details', () => {
  it('dez 2: the colour by level and sign, the hatch, the neighbour’s today with its dot and «1º dez, hoje», other neighbours silent', async () => {
    await pronto('2')
    // 10 nov +267,93 (a strong gain), 19 nov −465,40 (the strongest loss); 11 nov without trades
    expect(Array.from(celula('2026-11-10').classList).some((c) => /^hub-dr-cal-cel--g[1-4]$/.test(c))).toBe(true)
    expect(celula('2026-11-19')).toHaveClass('hub-dr-cal-cel--p4')
    const hoje = celulas().find((el) => el.classList.contains('hub-dr-cal-cel--hoje')) as HTMLElement
    expect(hoje.tagName).toBe('DIV')
    expect(hoje).toHaveClass('hub-dr-cal-cel--fora')
    expect(within(hoje).getByText('1º dez, hoje')).toHaveClass('sr-only')
    const vizinhos = celulas().filter((el) => el.classList.contains('hub-dr-cal-cel--fora') && el !== hoje)
    expect(vizinhos.length).toBe(8)
    for (const v of vizinhos) expect(v.querySelector('.sr-only')).toBeNull()
    // Every inner span of a button is hidden: the label carries the cell
    for (const span of Array.from(celula('2026-11-10').children)) expect(span).toHaveAttribute('aria-hidden', 'true')
    // The open day: pressed, the month's tab stop
    expect(celula('2026-11-10')).toHaveAttribute('aria-pressed', 'true')
    expect(grade().querySelectorAll('[tabindex="0"]')).toHaveLength(1)
  })

  it('dez 4: history hatched, white stripes from level 3; the misto day in the diário’s colour, not hatched', async () => {
    await pronto('4')
    expect(celula('2026-10-01')).toHaveClass('hub-dr-cal-cel--hist')
    expect(celula('2026-10-05')).toHaveClass('hub-dr-cal-cel--hist-forte')
    expect(celula('2026-10-14')).not.toHaveClass('hub-dr-cal-cel--hist')
    expect(celula('2026-10-14')).not.toHaveClass('hub-dr-cal-cel--hist-forte')
    // A week with only history: hatched, its number muted
    const [primeira] = semanas()
    expect(primeira).toHaveClass('hub-dr-cal-cel--hist')
    expect(primeira.querySelector('.hub-dr-cal-sem-res')).toHaveClass('hub-tom--muted')
  })

  it('hoje 7 (Binance): seven columns always; the weekend days without trades say «sem op.»', async () => {
    await pronto('7')
    expect(grade()).toHaveClass('hub-dr-cal-grade--sete')
    expect(lerCelula(celulas().find((el) => el.querySelector('.sr-only')?.textContent === '8 nov, sem operações') as HTMLElement).res).toBe('sem op.')
  })

  it('a month with a weekend trading day on a Futuros account: seven columns, its other weekend days empty', async () => {
    const { q, cru, queryClient } = await pronto('2')
    expect(grade()).not.toHaveClass('hub-dr-cal-grade--sete')
    // An invented Saturday trade on 14 nov (a session the database counted on that day)
    const dias = cru[q.info.contaId].calendario.days as Record<string, unknown>[]
    const modelo = dias.find((d) => d.day === '2026-11-12') as Record<string, unknown>
    dias.push({ ...modelo, day: '2026-11-14', weekday: 6, review: null })
    dias.sort((a, b) => String(a.day).localeCompare(String(b.day)))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: diarioKeys.calendario(USUARIO_DO_QUADRO, q.info.contaId) })
    })
    await waitFor(() => expect(grade()).toHaveClass('hub-dr-cal-grade--sete'))
    expect(Array.from(grade().querySelectorAll('.hub-dr-cal-col')).map((h) => h.textContent)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom', 'Semana'])
    expect(celula('2026-11-14').tagName).toBe('BUTTON')
    const domingo = celulas().find((el) => el.querySelector('.sr-only')?.textContent === '15 nov, sem operações') as HTMLElement
    expect(lerCelula(domingo).res).toBe('')
    expect(lerCelula(domingo).curto).toBe('')
  })
})

describe('the keyboard (D14): one tab stop per month, arrows between the days that open', () => {
  it('→ ← skip the days that do not open; ↓ ↑ a week; Home / End; Enter opens; every key handled is prevented', async () => {
    const { user } = await pronto('2')
    const aberto = celula('2026-11-10')
    aberto.focus()
    await user.keyboard('{ArrowRight}')
    // 11 nov has no trades: the next day that opens is 12 nov
    expect(celula('2026-11-12')).toHaveFocus()
    expect(celula('2026-11-12')).toHaveAttribute('tabindex', '0')
    expect(aberto).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowLeft}')
    expect(aberto).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(celula('2026-11-17')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(aberto).toHaveFocus()
    await user.keyboard('{End}')
    expect(celula('2026-11-30')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    // No day a week later: the last
    expect(celula('2026-11-30')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(celula('2026-11-02')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(celula('2026-11-02')).toHaveFocus()
    // A key event the grid handles is prevented (no page scroll)
    const evento = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    act(() => {
      celula('2026-11-02').dispatchEvent(evento)
    })
    expect(evento.defaultPrevented).toBe(true)
    expect(celula('2026-11-03')).toHaveFocus()
    // 3 nov → 10 nov → 17 nov → 18 → 19 nov, then Enter opens it (a day the board exported)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}')
    expect(celula('2026-11-19')).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(celula('2026-11-19')).toHaveAttribute('aria-pressed', 'true'))
    expect(celula('2026-11-19')).toHaveFocus()
    expect(navegacao.params().get('dia')).toBe('2026-11-19')
  })

  it('PageUp / PageDown: the neighbouring month, its first day that opens focused; none past the calendar’s ends', async () => {
    const { user } = await pronto('2')
    celula('2026-11-10').focus()
    await user.keyboard('{PageUp}')
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Outubro de 2026'))
    await waitFor(() => expect(celula('2026-10-01')).toHaveFocus())
    expect(celula('2026-10-01')).toHaveAttribute('tabindex', '0')
    await user.keyboard('{PageUp}')
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Setembro de 2026'))
    await waitFor(() => expect(document.activeElement?.getAttribute('data-dia')?.startsWith('2026-09')).toBe(true))
    // The open day did not change
    expect(navegacao.params().get('dia')).toBe('2026-11-10')
    await user.keyboard('{PageDown}{PageDown}{PageDown}')
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Dezembro de 2026'))
    await user.keyboard('{PageDown}')
    expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Dezembro de 2026')
  })

  it('after ‹ ›, the tab stop is the open day in its month, else the first day that opens', async () => {
    const { user } = await pronto('2')
    await user.click(within(calendario()).getByRole('button', { name: 'Mês anterior' }))
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Outubro de 2026'))
    expect(grade().querySelector('[tabindex="0"]')).toHaveAttribute('data-dia', '2026-10-01')
    await user.click(within(calendario()).getByRole('button', { name: 'Próximo mês' }))
    await waitFor(() => expect(grade().querySelector('[tabindex="0"]')).toHaveAttribute('data-dia', '2026-11-10'))
  })
})

describe('the month navigation (D3)', () => {
  it('‹ «Hoje» ›: aria-disabled (never disabled) at the calendar’s ends and on today’s month; the open day stays', async () => {
    const { user } = await pronto('2')
    const nav = within(calendario()).getByRole('group', { name: 'Navegar pelos meses' })
    const anterior = within(nav).getByRole('button', { name: 'Mês anterior' })
    const hoje = within(nav).getByRole('button', { name: 'Hoje' })
    const proximo = within(nav).getByRole('button', { name: 'Próximo mês' })
    expect(anterior).not.toHaveAttribute('aria-disabled')
    expect(hoje).not.toHaveAttribute('aria-disabled')
    expect(proximo).not.toHaveAttribute('aria-disabled')
    await user.click(hoje)
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Dezembro de 2026'))
    expect(hoje).toHaveAttribute('aria-disabled', 'true')
    expect(proximo).toHaveAttribute('aria-disabled', 'true')
    expect(proximo).not.toBeDisabled()
    await user.click(proximo)
    expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Dezembro de 2026')
    expect(screen.getByText('Mês: Dezembro de 2026.')).toBeInTheDocument()
    for (let i = 0; i < 3; i++) await user.click(anterior)
    await waitFor(() => expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Setembro de 2026'))
    expect(anterior).toHaveAttribute('aria-disabled', 'true')
    await user.click(anterior)
    expect(within(calendario()).getByRole('heading', { level: 3 })).toHaveTextContent('Setembro de 2026')
    expect(navegacao.params().get('dia')).toBe('2026-11-10')
  })

  it('10b (one month only): ‹ and › both at their ends, «Hoje» too', async () => {
    await pronto('10b')
    const nav = within(calendario()).getByRole('group', { name: 'Navegar pelos meses' })
    for (const nome of ['Mês anterior', 'Hoje', 'Próximo mês']) expect(within(nav).getByRole('button', { name: nome })).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('opening a day and a week', () => {
  it('a tap opens the day below: the URL, «Aberto abaixo: …», the focus stays on the cell, the week follows', async () => {
    const { user } = await pronto('2')
    await user.click(celula('2026-11-19'))
    await waitFor(() => expect(navegacao.params().get('dia')).toBe('2026-11-19'))
    expect(celula('2026-11-19')).toHaveFocus()
    expect(celula('2026-11-19')).toHaveAttribute('aria-pressed', 'true')
    expect(celula('2026-11-10')).toHaveAttribute('aria-pressed', 'false')
    expect(await screen.findByText('Aberto abaixo: Quinta-feira, 19 de novembro.')).toHaveAttribute('role', 'status')
    const semana = screen.getByRole('region', { name: 'Semana' })
    expect(within(semana).getByText('16 a 20 de novembro · 5 pregões com operações')).toBeInTheDocument()
    expect(semanas()[3]).toHaveAttribute('aria-pressed', 'true')
  })

  it('a week cell opens the week in the card and says so («Semana aberta abaixo: …»); a regular tab stop', async () => {
    const { user } = await pronto('4')
    const semana26 = semanas()[4]
    expect(semana26).not.toHaveAttribute('tabindex')
    expect(semana26).toHaveAttribute('aria-pressed', 'false')
    await user.click(semana26)
    await waitFor(() => expect(semana26).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByText('Semana aberta abaixo: 26 a 30 de outubro.')).toHaveAttribute('role', 'status')
    expect(within(screen.getByRole('region', { name: 'Semana' })).getByText('26 a 30 de outubro · 4 pregões com operações')).toBeInTheDocument()
    // The open day did not change
    expect(navegacao.params().get('dia')).toBe('2026-10-14')
  })
})

describe('«Como ler: Calendário» (D2): the pregão’s clock of each market', () => {
  it.each<[Cenario, string]>([
    ['4', 'O pregão de futuros vai das 18:00 da véspera às 17:00 ET.'],
    ['6', 'O pregão desta conta vai da meia-noite à meia-noite de Brasília.'],
    ['7', 'O pregão desta conta vai da meia-noite à meia-noite de Brasília.'],
  ])('%s', async (cen, relogio) => {
    const { user, q } = await pronto(cen)
    const info = within(calendario()).getByRole('button', { name: 'Como ler: Calendário' })
    expect(info).toHaveAttribute('aria-expanded', 'false')
    await user.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    const painel = document.getElementById('info-cal') as HTMLElement
    expect(painel).toHaveTextContent(relogio)
    if (q.esperado.infoCal) expect(painel.textContent).toBe(q.esperado.infoCal)
  })
})

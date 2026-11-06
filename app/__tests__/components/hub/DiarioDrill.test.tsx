/**
 * Fase 4 · telas, lane L2: the drill of «Operações do dia» (contract H1–H14) on the approved boards' scenarios
 * (testing/diarioTelas, invented data): «Sua operação» (facts and lines), «Linha do tempo da operação», «Imagens e
 * nota» (thumbnails, the dialog, the signed URLs' states, the board's editor as the Registrar's Diário variant), «Suas
 * marcas» (taps on the server's clock, times relative to the trade's day, DEV-C4), the leave guard (H12), and no
 * prototype label in copyDia.
 */
import fs from 'fs'
import path from 'path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { abrirDrill, mocks, renderDiario, type DiarioRenderizado } from '@/testing/diarioTelas'
import { escritasDoDrill } from '@/testing/diarioDiaEscritas'
import type { EsperadoDia } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

// No control of a drill opens the Registrar sheet: a stand-in that would say so
const mockSheet = jest.fn()
jest.mock('@/components/hub/registrar/RegistrarSheet', () => ({
  __esModule: true,
  default: function RegistrarSheetStub(props: { tradeId: string | null }) {
    mockSheet(props.tradeId)
    return null
  },
}))
beforeEach(() => mockSheet.mockReset())

const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/** The open drill of a trade (by its entry hour) */
async function drillDe(r: DiarioRenderizado, hora: string): Promise<HTMLElement> {
  const botao = await abrirDrill(r.user, hora)
  const id = botao.getAttribute('aria-controls') as string
  await waitFor(() => expect(document.getElementById(id)).toBeInTheDocument())
  return document.getElementById(id) as HTMLElement
}

function fatos(drill: HTMLElement): [string, string][] {
  return Array.from(drill.querySelectorAll('.hub-dr-drill-fato')).map((f) => [sem(f.querySelector('dt')?.textContent), sem(f.querySelector('dd')?.textContent)])
}
const linhas = (drill: HTMLElement) => Array.from(drill.querySelectorAll('.hub-dr-drill-col > .hub-dr-drill-linha')).map((l) => sem(l.textContent))

describe('H1–H7 · every drill of the board days', () => {
  it.each(['2', '3', '3b', '4', '5', '9', '11a', '1', '6', '7', '8'] as const)('%s: facts, lines, timeline and breakeven line as the board', async (cen) => {
    const r = await renderDiario(cen)
    const e = r.q.esperado as EsperadoDia
    for (let i = 0; i < e.trades.length; i++) {
      const drill = await drillDe(r, e.trades[i].h.slice(0, 5))
      const ed = e.drills[i]
      expect(within(drill).getByText('Sua operação')).toBeInTheDocument()
      expect({ i, fatos: fatos(drill) }).toEqual({ i, fatos: ed.fatos.map(([a, b]) => [a, sem(b)]) })
      const todas = linhas(drill)
      expect({ i, linhas: todas.filter((l) => l !== ed.be) }).toEqual({ i, linhas: ed.linhas.map(sem) })
      const tempo = drill.querySelector('.hub-dr-drill-tempo')
      if (ed.tempo) {
        expect(within(drill).getByText('Linha do tempo da operação')).toBeInTheDocument()
        expect(Array.from(tempo!.querySelectorAll('li')).map((li) => sem(li.textContent))).toEqual(ed.tempo.map((x) => sem(`${x.h}${x.txt}`)))
        if (ed.be) expect(todas).toContain(ed.be)
      } else expect(tempo).toBeNull()
      // H14: a history trade has no marks, images nor «Adicionar»
      expect(!!within(drill).queryByText('Suas marcas')).toBe(!!ed.marcas)
      expect(!!within(drill).queryByRole('button', { name: 'Adicionar imagens ou nota' })).toBe(ed.adicionar)
    }
  })

  it('9 → 30 nov: the open MNQ without exits shows only Hora, Entrada, Em aberto, Stop · alvo and Posso operar hoje?', async () => {
    const r = await renderDiario('9')
    await r.user.click(await screen.findByRole('button', { name: 'Abrir 30 nov' }))
    const id = (await waitFor(() => {
      const b = screen.getByRole('button', { name: 'Detalhes da operação: Compra de MNQ às 10:52' })
      expect(b).toHaveAttribute('aria-expanded', 'true')
      return b
    })).getAttribute('aria-controls') as string
    expect(fatos(document.getElementById(id)!)).toEqual([
      ['Hora', '10:52 · aberta'],
      ['Entrada', '25.702,00 · 1 ct'],
      ['Em aberto', '1 ct'],
      ['Stop · alvo', 'stop 40 · alvo 80 pts · às 10:52'],
      ['Posso operar hoje?', 'Liberado'],
    ])
  })
})

describe('H13 · marks', () => {
  it('2: the groups and their times («antes: B às 10:06 · agora: C às 11:20»), pressed values, the ⓘ', async () => {
    const r = await renderDiario('2')
    const drill = await drillDe(r, '10:03')
    const grupo = (nome: RegExp) => within(drill).getByRole('group', { name: nome })
    expect(within(grupo(/^Setup · sua nota, de A a C/)).getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo(/^Execução/)).getByRole('button', { name: 'no ponto' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo(/^Emoção/)).getByRole('button', { name: 'Calmo' })).toHaveAttribute('aria-pressed', 'true')
    expect(Array.from(drill.querySelectorAll('.hub-dr-drill-grupo-tempo')).map((x) => sem(x.textContent))).toEqual([
      'antes: B às 10:06 · agora: C às 11:20',
      'às 10:07 · antes da saída',
      'às 10:06 · antes da saída',
    ])
    for (const b of within(drill).getAllByRole('button', { pressed: false })) expect(b).toHaveClass('hub-pill')
    await r.user.click(within(drill).getByRole('button', { name: 'Como ler: suas marcas' }))
    expect(within(drill).getByText(/^Nos Padrões de Análises, só as marcas feitas antes da saída/)).toBeInTheDocument()
  })

  it('12a: a tap on a past day’s trade is announced relative to its day: «Setup B, 12 nov às 10:42, depois do resultado.»', async () => {
    const r = await renderDiario('12a')
    escritasDoDrill(r)
    const drill = await drillDe(r, '10:14')
    await r.user.click(within(within(drill).getByRole('group', { name: /^Setup/ })).getByRole('button', { name: 'B' }))
    await waitFor(() => expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('Setup B, 12 nov às 10:42, depois do resultado.'))
    await waitFor(() => expect(sem(drill.querySelector('.hub-dr-drill-grupo-tempo')?.textContent)).toBe('antes: A às 10:14 · agora: B 12 nov às 10:42'))
    expect(mocks.addMarks).toHaveBeenCalledWith(expect.anything(), r.q.dias['2026-11-10'].trades[1].trade.id, { v: 1, marks: { setup: 'B' } })
  })

  it('DEV-C4 · 1: «no ponto» on the open 10:18 MES after its partial reads «depois do resultado» (the server’s cut)', async () => {
    const r = await renderDiario('1')
    escritasDoDrill(r)
    const drill = await drillDe(r, '10:18')
    await r.user.click(within(within(drill).getByRole('group', { name: /^Execução/ })).getByRole('button', { name: 'no ponto' }))
    await waitFor(() => expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('Execução: no ponto, às 10:42, depois do resultado.'))
    await waitFor(() => expect(Array.from(drill.querySelectorAll('.hub-dr-drill-grupo-tempo')).map((x) => sem(x.textContent))).toContain('às 10:42 · depois do resultado'))
  })

  it('2: marks and a note on the file-only 11:20 without the sheet; no control of the drill opens it', async () => {
    const r = await renderDiario('2')
    escritasDoDrill(r)
    const drill = await drillDe(r, '11:20')
    expect(within(screen.getByRole('table', { name: 'Operações do dia' })).queryByRole('button', { name: /^Registrar/ })).toBeNull()
    await r.user.click(within(within(drill).getByRole('group', { name: /^Emoção/ })).getByRole('button', { name: 'Neutro' }))
    await waitFor(() => expect(mocks.addMarks).toHaveBeenCalledTimes(1))
    await r.user.click(within(drill).getByRole('button', { name: 'Editar imagens e nota' }))
    const nota = within(drill).getByLabelText('Nota')
    await r.user.type(nota, ' Depois da MNQ.')
    await r.user.click(within(drill).getByRole('button', { name: 'Salvar imagens e nota' }))
    await waitFor(() => expect(mocks.saveExtras).toHaveBeenCalledTimes(1))
    expect(mockSheet).not.toHaveBeenCalled()
  })
})

describe('H8–H9 · images: thumbnails, the dialog, the signed URLs', () => {
  it('2: «salvas às 10:12 · depois do resultado», the thumbnails with «nome · tamanho», the note; the dialog: «Fechar» focused, ← →, ends, Escape → the thumbnail shown', async () => {
    const r = await renderDiario('2')
    const drill = await drillDe(r, '10:03')
    expect(within(drill).getByText('salvas às 10:12 · depois do resultado')).toBeInTheDocument()
    const lista = within(drill).getByRole('list', { name: 'Imagens' })
    const minis = within(lista).getAllByRole('button')
    expect(minis.map((b) => b.getAttribute('aria-label'))).toEqual(['Abrir MES_10-03_entrada.png, imagem 1 de 2', 'Abrir MES_10-09_saida.png, imagem 2 de 2'])
    expect(minis.map((b) => sem(b.textContent))).toEqual(['MES_10-03_entrada.png · 612 KB', 'MES_10-09_saida.png · 540 KB'])
    expect(within(drill).getByText('Vendi o reteste da mínima da abertura e saí antes da VWAP.')).toBeInTheDocument()
    await waitFor(() => expect(drill.querySelectorAll('img.hub-dr-img-previa')).toHaveLength(2))

    await r.user.click(minis[0])
    const dlg = within(drill).getByRole('dialog', { name: 'Imagem 1 de 2' })
    expect(within(dlg).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    expect(within(dlg).getByRole('button', { name: 'Anterior' })).toHaveAttribute('aria-disabled', 'true')
    expect(within(drill).queryByRole('list', { name: 'Imagens' })).toBeNull()
    expect(within(dlg).getByRole('img', { name: 'MES_10-03_entrada.png' })).toBeInTheDocument()
    expect(sem(dlg.querySelector('.hub-dr-img-legenda')?.textContent)).toBe('MES_10-03_entrada.png · 612 KB')
    await r.user.click(within(dlg).getByRole('button', { name: 'Próxima' }))
    expect(within(drill).getByRole('dialog', { name: 'Imagem 2 de 2' })).toBeInTheDocument()
    expect(within(drill).getByRole('button', { name: 'Próxima' })).toHaveAttribute('aria-disabled', 'true')
    await r.user.keyboard('{ArrowLeft}')
    expect(within(drill).getByRole('dialog', { name: 'Imagem 1 de 2' })).toBeInTheDocument()
    await r.user.keyboard('{ArrowRight}')
    await r.user.keyboard('{Escape}')
    await waitFor(() => expect(within(drill).getByRole('button', { name: 'Abrir MES_10-09_saida.png, imagem 2 de 2' })).toHaveFocus())
    expect(mockSheet).not.toHaveBeenCalled()
  })

  it('the signed URLs: while read, an empty box; refused or failed, «sem prévia» (also in the dialog), the captions kept', async () => {
    let r = await renderDiario('2')
    mocks.signedImageUrls.mockImplementation(() => new Promise(() => {}))
    let drill = await drillDe(r, '10:03')
    expect(drill.querySelectorAll('.hub-dr-img-previa--vazia')).toHaveLength(2)
    expect(within(drill).queryByText('sem prévia')).toBeNull()
    r.unmount()

    r = await renderDiario('2')
    mocks.signedImageUrls.mockImplementation(async (_db, paths) => Object.fromEntries(paths.map((p) => [p, null])))
    drill = await drillDe(r, '10:03')
    await waitFor(() => expect(within(drill).getAllByText('sem prévia')).toHaveLength(2))
    await r.user.click(within(drill).getAllByRole('button', { name: /^Abrir / })[0])
    const dlg = within(drill).getByRole('dialog')
    expect(within(dlg).getByText('sem prévia')).toBeInTheDocument()
    expect(sem(dlg.querySelector('.hub-dr-img-legenda')?.textContent)).toBe('MES_10-03_entrada.png · 612 KB')
    r.unmount()

    r = await renderDiario('2')
    mocks.signedImageUrls.mockRejectedValue(new (jest.requireActual('@/lib/hub/diarioDb').DiarioDataError)('network'))
    drill = await drillDe(r, '10:03')
    await waitFor(() => expect(within(drill).getAllByText('sem prévia')).toHaveLength(2))
  })
})

describe('H10–H11 · the board’s editor (the Registrar’s, Diário variant)', () => {
  it('2: «Editar» → «Nota» focused; no ⓘ, no «(opcional)»; text rows «nome · tamanho» + «Remover», no previews; primary save, «Cancelar» → «Editar»', async () => {
    const r = await renderDiario('2')
    const drill = await drillDe(r, '10:03')
    await r.user.click(within(drill).getByRole('button', { name: 'Editar imagens e nota' }))
    const ed = within(drill).getByRole('group', { name: 'Imagens e nota' })
    const nota = within(ed).getByLabelText('Nota')
    await waitFor(() => expect(nota).toHaveFocus())
    expect(nota.id).toMatch(/^drill-.+-ax-nota$/)
    expect(within(ed).queryByRole('button', { name: /^Como ler/ })).toBeNull()
    expect(within(ed).queryByText(/opcional/)).toBeNull()
    expect(ed.querySelector('img')).toBeNull()
    const anexadas = within(ed).getByRole('list', { name: 'Imagens anexadas' })
    expect(within(anexadas).getAllByRole('listitem').map((li) => sem(li.querySelector('.hub-dr-img-nome')?.textContent))).toEqual([
      'MES_10-03_entrada.png · 612 KB',
      'MES_10-09_saida.png · 540 KB',
    ])
    expect(within(anexadas).getByRole('button', { name: 'Remover imagem MES_10-03_entrada.png' })).toBeInTheDocument()
    expect(within(ed).getByText('58 de 1000')).toBeInTheDocument()
    expect(within(ed).getByRole('button', { name: 'Salvar imagens e nota' })).toHaveClass('hub-btn--pri')
    expect(within(ed).getByRole('button', { name: 'Escolher imagens' })).toBeInTheDocument()
    await r.user.click(within(ed).getByRole('button', { name: 'Remover imagem MES_10-03_entrada.png' }))
    expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('MES_10-03_entrada.png removida. 1 de 4.')
    await r.user.click(within(ed).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(drill).getByRole('button', { name: 'Editar imagens e nota' })).toHaveFocus())
  })

  it('2: «Adicionar imagens ou nota» (10:14) → «Nota» focused; «Cancelar» → «Adicionar imagens ou nota»; a note saved on a past day: «Nota salva em 1º dez, às 11:35.», focus «Editar»', async () => {
    const r = await renderDiario('2')
    escritasDoDrill(r)
    const drill = await drillDe(r, '10:14')
    await r.user.click(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' }))
    await waitFor(() => expect(within(drill).getByLabelText('Nota')).toHaveFocus())
    expect(within(drill).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    await r.user.click(within(drill).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' })).toHaveFocus())
    await r.user.click(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' }))
    await r.user.type(within(drill).getByLabelText('Nota'), 'Parcial no +8.')
    await r.user.click(within(drill).getByRole('button', { name: 'Salvar imagens e nota' }))
    await waitFor(() => expect(within(drill).getByRole('button', { name: 'Editar imagens e nota' })).toHaveFocus())
    expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('Nota salva em 1º dez, às 11:35.')
    expect(within(drill).getByText('salva em 1º dez, às 11:35 · depois do resultado')).toBeInTheDocument()
  })

  it('12a: removing everything: «Imagens e nota removidas em 12 nov, às 10:42.» and the focus on «Adicionar imagens ou nota»', async () => {
    const r = await renderDiario('12a')
    escritasDoDrill(r)
    const drill = await drillDe(r, '10:03')
    await r.user.click(within(drill).getByRole('button', { name: 'Editar imagens e nota' }))
    await r.user.click(within(drill).getByRole('button', { name: 'Remover imagem MES_10-03_entrada.png' }))
    await r.user.click(within(drill).getByRole('button', { name: 'Remover imagem MES_10-09_saida.png' }))
    await r.user.clear(within(drill).getByLabelText('Nota'))
    await r.user.click(within(drill).getByRole('button', { name: 'Salvar imagens e nota' }))
    await waitFor(() => expect(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' })).toHaveFocus())
    expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('Imagens e nota removidas em 12 nov, às 10:42.')
  })

  it('DEV-C4 · 1: a note saved on the open 10:18 after its partial: «salva às 10:42 · depois do resultado»', async () => {
    const r = await renderDiario('1')
    escritasDoDrill(r)
    const drill = await drillDe(r, '10:18')
    await r.user.click(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' }))
    await r.user.type(within(drill).getByLabelText('Nota'), 'Parcial no +8.')
    await r.user.click(within(drill).getByRole('button', { name: 'Salvar imagens e nota' }))
    await waitFor(() => expect(within(drill).getByText('salva às 10:42 · depois do resultado')).toBeInTheDocument())
    expect(Array.from(drill.querySelectorAll('[role="status"]')).map((s) => s.textContent)).toContain('Nota salva às 10:42.')
  })
})

describe('H12 · the leave guard', () => {
  async function comNota(r: DiarioRenderizado, hora: string) {
    const drill = await drillDe(r, hora)
    await r.user.click(within(drill).getByRole('button', { name: 'Adicionar imagens ou nota' }))
    await r.user.type(within(drill).getByLabelText('Nota'), 'Ainda não salvei.')
    return drill
  }

  it('▾ with unsaved work: «Fechar sem salvar?» with «Continuar aqui» focused; «Continuar aqui» (and Escape) keep the editor', async () => {
    const r = await renderDiario('2')
    const drill = await comNota(r, '10:14')
    await r.user.click(screen.getByRole('button', { name: 'Detalhes da operação: Compra de MES às 10:14' }))
    const guarda = within(drill).getByRole('group', { name: 'Fechar sem salvar?' })
    expect(within(guarda).getByRole('button', { name: 'Continuar aqui' })).toHaveFocus()
    await r.user.click(within(guarda).getByRole('button', { name: 'Continuar aqui' }))
    expect(within(drill).queryByRole('group', { name: 'Fechar sem salvar?' })).toBeNull()
    expect(within(drill).getByLabelText('Nota')).toHaveValue('Ainda não salvei.')
    await r.user.click(screen.getByRole('button', { name: 'Detalhes da operação: Compra de MES às 10:14' }))
    await r.user.keyboard('{Escape}')
    expect(within(drill).queryByRole('group', { name: 'Fechar sem salvar?' })).toBeNull()
    expect(drill).toBeInTheDocument()
  })

  it('another drill with unsaved work: «Fechar» drops it and opens the other', async () => {
    const r = await renderDiario('2')
    await comNota(r, '10:14')
    await r.user.click(screen.getByRole('button', { name: 'Detalhes da operação: Venda de MNQ às 10:22' }))
    await r.user.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Detalhes da operação: Venda de MNQ às 10:22' })).toHaveAttribute('aria-expanded', 'true'))
    expect(screen.getByRole('button', { name: 'Detalhes da operação: Compra de MES às 10:14' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('another day («Abrir 30 nov», 9) with unsaved work asks first; «Continuar aqui» keeps the day', async () => {
    const r = await renderDiario('9')
    await comNota(r, '10:12')
    await r.user.click(screen.getByRole('button', { name: 'Abrir 30 nov' }))
    await r.user.click(await screen.findByRole('button', { name: 'Continuar aqui' }))
    expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Terça-feira, 1º de dezembro')
    await r.user.click(screen.getByRole('button', { name: 'Abrir 30 nov' }))
    await r.user.click(await screen.findByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(within(document.getElementById('dia')!).getByRole('heading', { level: 2 })).toHaveTextContent('Segunda-feira, 30 de novembro'))
  })

  it('another account in the selector with unsaved work asks first (confirmarSaida); «Continuar aqui» keeps the account', async () => {
    const r = await renderDiario('2')
    await comNota(r, '10:14')
    await r.user.click(screen.getByRole('button', { name: /^Conta: Top One/ }))
    await r.user.click(await screen.findByRole('button', { name: /^Lucid 50k/ }))
    await r.user.click(await screen.findByRole('button', { name: 'Continuar aqui' }))
    await act(async () => {
      await new Promise((res) => setTimeout(res, 20))
    })
    expect(screen.getByRole('button', { name: /^Conta: Top One/ })).toBeInTheDocument()
    expect(mocks.mergePreferences).not.toHaveBeenCalled()
  })
})

describe('copyDia', () => {
  it('holds no prototype label of the boards', () => {
    const texto = fs.readFileSync(path.join(__dirname, '../../../components/hub/diario/copyDia.ts'), 'utf8')
    for (const rotulo of ['Cenário do protótipo', 'Recomeçar', 'fora do produto', 'No protótipo']) expect(texto).not.toContain(rotulo)
  })
})

/**
 * Fase 4 · telas, lane L1: «Posso operar hoje?» on the Diário (contract §2.2 B1–B11; owner's revision of 25 Oct,
 * boards dez 2, 9, 9b, hoje 1, 6, 10a; invented data): only the open account's line, «somando as contas de Futuros»
 * under its limit when it sums, ONE line counting the others («Outras 7 contas: 5 fora da janela · 2 sem janela
 * salva»), «Ver todas» / «Ocultar» / «Ver a outra conta» (closed when the page opens, the focus stays on it) opening
 * their lines (never «somando»), the «·» at the end of the part before it, the ⓘ's sentence; the full list when the
 * open account is missing from the answer (B11), no others line with one account (B9).
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { regrasKeys } from '@/hooks/useRegras'
import { POSSO_NO_DIARIO_INFO } from '@/lib/hub/posso'
import { POSSO } from '@/components/hub/posso/copy'
import { mocks, renderDiario } from '@/testing/diarioTelas'
import { USUARIO_DO_QUADRO } from '@/testing/diarioTelasMocks'
import type { Cenario, EsperadoPosso } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const NBSP = / /g
const limpo = (s: string | null | undefined) => (s ?? '').replace(NBSP, ' ')
const cartao = () => screen.getByRole('region', { name: 'Posso operar hoje?' })
const linhas = (lista: HTMLElement) => within(lista).getAllByRole('listitem')

/** The texts a screen reader reads in `el`, in order: every text outside aria-hidden */
function falado(el: Element): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('[aria-hidden="true"]')) continue
    const t = node.textContent?.trim()
    if (t) out.push(limpo(t))
  }
  return out
}

/** One line as the board's esperado holds it */
function lerLinha(li: HTMLElement): Omit<EsperadoPosso, 'soma'> & { soma: boolean } {
  const palavra = li.querySelector('.hub-posso__palavra') as HTMLElement
  const estado = li.querySelector('.hub-posso__estado') as HTMLElement
  const detalhe = estado.children[1] as HTMLElement | undefined
  const acao = detalhe?.tagName === 'A' ? detalhe : null
  const valores = Array.from(li.querySelectorAll('.hub-posso__valores > span')).map((s) => limpo(s.textContent))
  return {
    nome: li.querySelector('.hub-posso__nome')?.textContent ?? '',
    pal: falado(palavra).join(''),
    sub: detalhe && !acao ? limpo(detalhe.textContent) : null,
    acao: acao ? acao.textContent : null,
    acaoAria: acao ? acao.getAttribute('aria-label') : null,
    lim: valores.length ? valores.join(' ') : null,
    soma: li.textContent?.includes('somando as contas de Futuros') ?? false,
    tom: `tom-${Array.from(palavra.classList).find((c) => c.startsWith('hub-tom--'))?.slice('hub-tom--'.length)}`,
  }
}

async function pronto(cen: Cenario) {
  const r = await renderDiario(cen)
  await within(await screen.findByRole('region', { name: 'Posso operar hoje?' })).findByRole('list', { name: 'Posso operar hoje?' })
  return r
}

describe.each<Cenario>(['2', '1', '9', '9b', '10a', '6', '8'])('scenario %s', (cen) => {
  it('the open account’s line only, «somando» when its limit sums; one line for the others in the board’s words and tones', async () => {
    const { q } = await pronto(cen)
    const e = q.esperado
    const principal = within(cartao()).getByRole('list', { name: 'Posso operar hoje?' })
    expect(linhas(principal).map(lerLinha)).toEqual(e.possoSel.map((p) => ({ ...p, lim: limpo(p.lim) || null })))
    const resumo = cartao().querySelector('.hub-posso__resumo') as HTMLElement
    expect(resumo.querySelector('strong')?.textContent).toBe(e.outras!.titulo)
    const partes = Array.from(resumo.querySelectorAll('.hub-posso__parte'))
    expect(partes.map((p) => [falado(p).join(''), Array.from(p.classList).find((c) => c.startsWith('hub-tom--'))?.replace('hub-tom--', 'tom-')])).toEqual(
      e.outras!.partes.map((p) => [p.texto, p.tom]),
    )
    // The «·» ends each part but the last (board revision of 25 Oct), only for the eye
    partes.forEach((p, i) => {
      const sep = p.querySelector('.hub-posso__sep')
      if (i < partes.length - 1) {
        expect(sep).toHaveAttribute('aria-hidden', 'true')
        expect(p.lastElementChild).toBe(sep)
      } else expect(sep).toBeNull()
    })
    // The others' lines are closed when the page opens (9b's board draws them open: the owner's click)
    const botao = within(cartao()).getByRole('button', { name: 'Ver todas' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(botao).toHaveAttribute('aria-controls', 'posso-outras-lista')
    expect(document.getElementById('posso-outras-lista')).toBeNull()
  })

  it('«Ver todas» opens every other account’s line (the board’s words, never «somando»), «Ocultar» closes it; the focus stays', async () => {
    const { q, user } = await pronto(cen)
    const botao = within(cartao()).getByRole('button', { name: 'Ver todas' })
    await user.click(botao)
    expect(botao).toHaveFocus()
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(botao).toHaveTextContent('Ocultar')
    const lista = within(cartao()).getByRole('list', { name: 'Outras contas' })
    expect(lista).toHaveAttribute('id', 'posso-outras-lista')
    expect(linhas(lista).map(lerLinha)).toEqual(q.esperado.possoOutras.map((p) => ({ ...p, lim: limpo(p.lim) || null, soma: false })))
    await user.click(botao)
    expect(botao).toHaveFocus()
    expect(botao).toHaveTextContent('Ver todas')
    expect(document.getElementById('posso-outras-lista')).toBeNull()
  })
})

describe('the card’s details', () => {
  it('2: the answer ends with «·», then the sub; no live region; the ⓘ adds the Diário’s sentence', async () => {
    const { user } = await pronto('2')
    const [li] = linhas(within(cartao()).getByRole('list', { name: 'Posso operar hoje?' }))
    const palavra = li.querySelector('.hub-posso__palavra') as HTMLElement
    expect(palavra.lastElementChild).toHaveClass('hub-posso__sep')
    expect(palavra.lastElementChild?.textContent).toBe('· ')
    expect(cartao().querySelector('[aria-live]')).toBeNull()
    await user.click(within(cartao()).getByRole('button', { name: 'Como ler: Posso operar hoje?' }))
    expect(document.getElementById('info-posso')?.textContent).toBe(`${POSSO_NO_DIARIO_INFO} ${POSSO.info}`)
  })

  it('9: «somando as contas de Futuros» under the open account’s limit, in a column (board `.posso-lim-col`)', async () => {
    await pronto('9')
    const [li] = linhas(within(cartao()).getByRole('list', { name: 'Posso operar hoje?' }))
    const limite = li.querySelector('.hub-posso__limite') as HTMLElement
    expect(limite).toHaveClass('hub-posso__limite--col')
    expect(limite.lastElementChild).toHaveTextContent('somando as contas de Futuros')
    expect(limite.lastElementChild).toHaveClass('hub-tom--muted')
  })

  it('9b (35 accounts): the wider name column (board `.posso-largo`)', async () => {
    await pronto('9b')
    expect(cartao().querySelector('.hub-posso__corpo')).toHaveClass('hub-posso__corpo--largo')
  })

  it('10a: «Sem janela salva · Definir» (aria «Definir a janela da Ylos 50k em Personalizar»), no limit', async () => {
    await pronto('10a')
    const [li] = linhas(within(cartao()).getByRole('list', { name: 'Posso operar hoje?' }))
    expect(within(li).getByRole('link', { name: 'Definir a janela da Ylos 50k em Personalizar' })).toHaveAttribute('href', '/personalizar#janelas')
    expect(li.querySelector('.hub-posso__limite')).toBeNull()
    expect(cartao().querySelector('.hub-posso__corpo')).not.toHaveClass('hub-posso__corpo--largo')
  })

  it('one other account: «Outra conta: …» and «Ver a outra conta»; no other account: no line (B9)', async () => {
    const { q, queryClient } = await pronto('2')
    const aberta = q.rulesNow.accounts.find((a) => a.accountId === q.info.contaId)!
    const outra = q.rulesNow.accounts.find((a) => a.accountId !== q.info.contaId)!
    mocks.fetchRulesNow.mockResolvedValue({ ...q.rulesNow, accounts: [aberta, outra] })
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: regrasKeys.agora(USUARIO_DO_QUADRO) })
    })
    await waitFor(() => expect(within(cartao()).getByText('Outra conta:')).toBeInTheDocument())
    expect(within(cartao()).getByRole('button', { name: 'Ver a outra conta' })).toBeInTheDocument()
    mocks.fetchRulesNow.mockResolvedValue({ ...q.rulesNow, accounts: [aberta] })
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: regrasKeys.agora(USUARIO_DO_QUADRO) })
    })
    await waitFor(() => expect(cartao().querySelector('.hub-posso__outras')).toBeNull())
    expect(linhas(within(cartao()).getByRole('list', { name: 'Posso operar hoje?' }))).toHaveLength(1)
  })

  it('the open account missing from the answer (B11, not drawn): every account’s line, as before', async () => {
    const { q, queryClient } = await pronto('2')
    const sem = q.rulesNow.accounts.filter((a) => a.accountId !== q.info.contaId)
    mocks.fetchRulesNow.mockResolvedValue({ ...q.rulesNow, accounts: sem })
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: regrasKeys.agora(USUARIO_DO_QUADRO) })
    })
    await waitFor(() => expect(linhas(within(cartao()).getByRole('list', { name: 'Posso operar hoje?' }))).toHaveLength(7))
    expect(cartao().querySelector('.hub-posso__outras')).toBeNull()
  })
})

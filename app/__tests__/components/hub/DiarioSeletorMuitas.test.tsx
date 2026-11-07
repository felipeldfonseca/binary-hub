/**
 * Fase 4 · telas, lane L1: the account selector with many accounts (contract §2.2 A8–A13, owner's request of 25 Oct;
 * board dez 9b: Top One among 35 accounts, invented data). From 10 accounts the list opens on a search field (focus in
 * it), each market with more than one account is split by firm in groups named by their headers, the blocks scroll;
 * the search's status for a screen reader, «Nenhuma conta com “zzz”.», Escape from the search, and choosing «Apex 50k
 * #5» and «Lucid 50k» (the card follows). Below 10 accounts, as built. «Sem mesa · 2» (domain DEV 1) on an invented
 * world.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeletorConta from '@/components/hub/contas/SeletorConta'
import { makeAccount } from '@/testing/hubHarness'
import { renderDiario } from '@/testing/diarioTelas'
import { navegacao } from '@/testing/diarioTelasMocks'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const lista = () => document.getElementById('lista-contas') as HTMLElement
const busca = () => screen.getByRole('searchbox', { name: 'Buscar conta' })
/** The search's status (visually hidden, only while a query is typed) */
const statusDaBusca = () => lista().querySelector('[role="status"]')?.textContent ?? null

/** The blocks as the board's esperado holds them: market header (first block of a market), firm header, accounts */
function grupos() {
  return within(lista())
    .queryAllByRole('group')
    .map((g) => ({
      mercado: g.querySelector('.hub-seletor__grupo')?.textContent ?? null,
      mesa: g.querySelector('.hub-seletor__mesa')?.textContent ?? null,
      contas: Array.from(g.querySelectorAll('.hub-seletor__nome')).map((n) => n.textContent),
    }))
}

async function abrir9b() {
  const r = await renderDiario('9b')
  await screen.findByRole('region', { name: 'Calendário' })
  const botao = screen.getByRole('button', { name: /^Conta: Top One/ })
  await r.user.click(botao)
  return { ...r, botao }
}

describe('9b · Top One among 35 accounts', () => {
  it('opens on the search, focused; every market and firm as the board groups them, the current account marked', async () => {
    const { q, botao } = await abrir9b()
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(busca()).toHaveFocus()
    expect(busca()).toHaveAttribute('type', 'search')
    expect(busca()).toHaveAttribute('autocomplete', 'off')
    expect(busca()).toHaveAttribute('placeholder', 'Nome da conta ou da mesa')
    expect(statusDaBusca()).toBe('')
    expect(grupos()).toEqual(q.esperado.busca![''].grupos)
    expect(within(lista()).getByRole('button', { name: 'Top One Financiada' })).toHaveAttribute('aria-current', 'true')
    // The blocks scroll inside the popover (hub-diario-mes.css: max-height 372, edge shadows)
    expect(lista().querySelector('.hub-seletor__rolagem')).not.toBeNull()
    // The footer as built
    expect(within(lista()).getByRole('link', { name: 'Gerenciar contas' })).toHaveAttribute('href', '/personalizar#contas')
    expect(lista()).toHaveTextContent('Contas de mercados diferentes nunca são somadas.')
  })

  it('each block is a group named by its market’s and its firm’s headers (the market’s header id serves all its blocks)', async () => {
    await abrir9b()
    const blocos = within(lista()).getAllByRole('group')
    const [alpha, apex] = blocos
    expect(alpha).toHaveAccessibleName('Futuros · 30 Alpha Futures · 3')
    expect(apex).toHaveAccessibleName('Futuros · 30 Apex · 9')
    expect(apex.querySelector('.hub-seletor__grupo')).toBeNull()
    const ebinex = blocos.find((b) => b.textContent?.includes('Ebinex')) as HTMLElement
    // A market with one account is not split by firm
    expect(ebinex).toHaveAccessibleName('Opções binárias · 1')
  })

  it.each(['apex', 'funded', 'lúcid', 'zzz'])('«%s»: the board’s status and groups; typing never closes the list', async (termo) => {
    const { q, user } = await abrir9b()
    const e = q.esperado.busca![termo]
    await user.type(busca(), termo)
    expect(lista()).toBeInTheDocument()
    expect(busca()).toHaveFocus()
    expect(statusDaBusca()).toBe(e.status)
    expect(grupos()).toEqual(e.grupos.filter((g) => g.contas.length))
    if (e.nenhuma) expect(within(lista()).getByText(e.nenhuma)).toBeInTheDocument()
    else expect(within(lista()).queryByText(/^Nenhuma conta com/)).toBeNull()
  })

  it('Escape in the search closes the list and gives the focus to «Conta: Top One»; the search is empty again', async () => {
    const { q, user, botao } = await abrir9b()
    await user.type(busca(), 'apex')
    await user.keyboard('{Escape}')
    expect(document.getElementById('lista-contas')).toBeNull()
    expect(botao).toHaveFocus()
    await user.click(botao)
    expect(busca()).toHaveValue('')
    expect(grupos()).toEqual(q.esperado.busca![''].grupos)
  })

  it('choosing «Apex 50k #5»: the page on it (its day), the card «Encerrado por hoje · limite atingido às 10:41», the others line', async () => {
    const { q, user, botao } = await abrir9b()
    const e = q.esperado.escolhas!['Apex 50k #5']
    await user.type(busca(), 'apex')
    await user.click(within(lista()).getByRole('button', { name: 'Apex 50k #5 Avaliação' }))
    expect(document.getElementById('lista-contas')).toBeNull()
    expect(botao).toHaveFocus()
    await waitFor(() => expect(botao).toHaveTextContent('Conta: Apex 50k #5'))
    expect(navegacao.params().get('conta')).toBe(q.info.escolhas!['Apex 50k #5'])
    const card = screen.getByRole('region', { name: 'Posso operar hoje?' })
    const [linha] = within(within(card).getByRole('list', { name: 'Posso operar hoje?' })).getAllByRole('listitem')
    expect(linha).toHaveTextContent('Apex 50k #5')
    expect(linha).toHaveTextContent(`${e.possoSel[0].pal}· ${e.possoSel[0].sub}`)
    const valores = Array.from(linha.querySelectorAll('.hub-posso__valores > span')).map((s) => (s.textContent ?? '').replace(/\u00a0/g, ' '))
    expect(valores.join(' ')).toBe(e.possoSel[0].lim)
    expect(linha).not.toHaveTextContent('somando as contas de Futuros')
    expect(card.querySelector('.hub-posso__resumo')?.textContent).toBe(`${e.outras.titulo}${e.outras.partes.map((p) => p.texto).join('·')}`)
    expect(await screen.findByText('Conta Apex 50k #5.')).toHaveAttribute('role', 'status')
  })

  it('choosing «Lucid 50k»: «somando as contas de Futuros» under its limit', async () => {
    const { q, user, botao } = await abrir9b()
    const e = q.esperado.escolhas!['Lucid 50k']
    await user.type(busca(), 'lucid')
    await user.click(within(lista()).getByRole('button', { name: 'Lucid 50k Avaliação' }))
    await waitFor(() => expect(botao).toHaveTextContent('Conta: Lucid 50k'))
    const card = screen.getByRole('region', { name: 'Posso operar hoje?' })
    const [linha] = within(within(card).getByRole('list', { name: 'Posso operar hoje?' })).getAllByRole('listitem')
    expect(linha).toHaveTextContent(`${e.possoSel[0].pal}· ${e.possoSel[0].sub}`)
    expect(within(linha).getByText('somando as contas de Futuros')).toBeInTheDocument()
  })
})

describe('an invented world', () => {
  /** 10 Futuros accounts in two firms and two without a firm, a binary one */
  const contas = [
    makeAccount({ label: 'Apex A', market: 'futures', firm: 'Apex', sort_order: 1 }),
    makeAccount({ label: 'Apex B', market: 'futures', firm: ' apex ', sort_order: 2 }),
    makeAccount({ label: 'Pessoal 1', market: 'futures', firm: null, sort_order: 3 }),
    makeAccount({ label: 'Topstep A', market: 'futures', firm: 'Topstep', sort_order: 4 }),
    makeAccount({ label: 'Pessoal 2', market: 'futures', firm: '  ', sort_order: 5 }),
    makeAccount({ label: 'Topstep B', market: 'futures', firm: 'Topstep', sort_order: 6 }),
    makeAccount({ label: 'Topstep C', market: 'futures', firm: 'Topstep', sort_order: 7 }),
    makeAccount({ label: 'Topstep D', market: 'futures', firm: 'Topstep', sort_order: 8 }),
    makeAccount({ label: 'Topstep E', market: 'futures', firm: 'Topstep', sort_order: 9 }),
    makeAccount({ label: 'Ebinex', market: 'binary', firm: 'Ebinex', sort_order: 10 }),
  ]

  it('«Sem mesa · 2»: the accounts without a firm in a market split by firm (domain DEV 1); a firm’s casing is its first account’s', async () => {
    render(<SeletorConta accounts={contas} current={contas[0]} onChoose={jest.fn()} onAdd={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^Conta: / }))
    expect(grupos()).toEqual([
      { mercado: 'Futuros · 9', mesa: 'Apex · 2', contas: ['Apex A', 'Apex B'] },
      { mercado: null, mesa: 'Sem mesa · 2', contas: ['Pessoal 1', 'Pessoal 2'] },
      { mercado: null, mesa: 'Topstep · 5', contas: ['Topstep A', 'Topstep B', 'Topstep C', 'Topstep D', 'Topstep E'] },
      { mercado: 'Opções binárias · 1', mesa: null, contas: ['Ebinex'] },
    ])
  })

  it('Escape from an option closes it too; a choice calls onChoose and focuses the button', async () => {
    const onChoose = jest.fn()
    render(<SeletorConta accounts={contas} current={contas[0]} onChoose={onChoose} onAdd={jest.fn()} />)
    const botao = screen.getByRole('button', { name: /^Conta: / })
    await userEvent.click(botao)
    await userEvent.type(busca(), 'top')
    await userEvent.click(within(lista()).getByRole('button', { name: /Topstep C/ }))
    expect(onChoose).toHaveBeenCalledWith(contas[6].id)
    expect(botao).toHaveFocus()
    await userEvent.click(botao)
    within(lista()).getByRole('button', { name: /Apex B/ }).focus()
    await userEvent.keyboard('{Escape}')
    expect(document.getElementById('lista-contas')).toBeNull()
    expect(botao).toHaveFocus()
  })

  it('below 10 accounts: no search, the built list (current account focused)', async () => {
    render(<SeletorConta accounts={contas.slice(0, 9)} current={contas[0]} onChoose={jest.fn()} onAdd={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^Conta: / }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(within(lista()).queryAllByRole('group')).toHaveLength(0)
    expect(within(lista()).getByRole('button', { name: /Apex A/ })).toHaveFocus()
    expect(Array.from(lista().querySelectorAll('.hub-seletor__grupo')).map((g) => g.textContent)).toEqual(['Futuros'])
  })
})

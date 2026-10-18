import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeletorConta from '@/components/hub/contas/SeletorConta'
import { makeAccount } from '@/testing/hubHarness'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

const topOne = makeAccount({ label: 'Top One', market: 'futures', phase: 'financiada' })
const apex = makeAccount({ label: 'Apex A', market: 'futures', phase: 'avaliacao' })
const ebinex = makeAccount({ label: 'Ebinex', market: 'binary', phase: null })

function renderSelector(current = topOne, janela?: string | null) {
  const onChoose = jest.fn()
  const onAdd = jest.fn()
  render(<SeletorConta accounts={[topOne, apex, ebinex]} current={current} onChoose={onChoose} onAdd={onAdd} janela={janela} />)
  return { onChoose, onAdd, button: screen.getByRole('button', { name: /^Conta: / }) }
}

describe('SeletorConta', () => {
  it('names the current account on its button', () => {
    const { button } = renderSelector()

    expect(button).toHaveTextContent('Conta: Top One')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'lista-contas')
  })

  it('lists the accounts by market, one at a time, never summed, with the current one marked', async () => {
    const { button } = renderSelector()

    await userEvent.click(button)

    const list = document.getElementById('lista-contas') as HTMLElement
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(Array.from(list.querySelectorAll('.hub-seletor__grupo')).map((el) => el.textContent)).toEqual(['Futuros', 'Opções binárias'])
    const current = within(list).getByRole('button', { name: /Top One/ })
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(current).toHaveTextContent('Financiada')
    expect(current).toHaveFocus()
    expect(within(list).getByRole('button', { name: /Apex A/ })).not.toHaveAttribute('aria-current')
    expect(within(list).getByText('Contas de mercados diferentes nunca são somadas.')).toBeInTheDocument()
    expect(within(list).queryByText(/Todas as contas/)).not.toBeInTheDocument()
  })

  it('switches account, closes and gives focus back to its button', async () => {
    const { button, onChoose } = renderSelector()

    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: /Ebinex/ }))

    expect(onChoose).toHaveBeenCalledWith(ebinex.id)
    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('does not switch when the current account is chosen again', async () => {
    const { button, onChoose } = renderSelector()

    await userEvent.click(button)
    const list = document.getElementById('lista-contas') as HTMLElement
    await userEvent.click(within(list).getByRole('button', { name: /Top One/ }))

    expect(onChoose).not.toHaveBeenCalled()
  })

  it('closes with Escape and gives focus back to its button', async () => {
    const { button } = renderSelector()

    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')

    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('gives focus back to its button when the backdrop is clicked', async () => {
    const { button } = renderSelector()

    await userEvent.click(button)
    await userEvent.click(document.querySelector('.hub-seletor__fundo') as HTMLElement)

    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes with Escape while focus is back on its button', async () => {
    const { button } = renderSelector()

    await userEvent.click(button)
    // From the first option back to the button: the list stays open
    await userEvent.tab({ shift: true })
    expect(button).toHaveFocus()
    expect(document.getElementById('lista-contas')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes when focus leaves it, so it never covers the focused control', async () => {
    render(
      <>
        <SeletorConta accounts={[topOne, ebinex]} current={topOne} onChoose={jest.fn()} onAdd={jest.fn()} />
        <button type="button">Depois</button>
      </>,
    )

    await userEvent.click(screen.getByRole('button', { name: /^Conta: / }))
    screen.getByRole('link', { name: 'Gerenciar contas' }).focus()
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus()
    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
  })

  it('adds an account through the sheet and manages them in Personalizar', async () => {
    const { button, onAdd } = renderSelector()

    await userEvent.click(button)
    expect(screen.getByRole('link', { name: 'Gerenciar contas' })).toHaveAttribute('href', '/personalizar#contas')
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar conta' }))

    expect(onAdd).toHaveBeenCalledWith(button)
    expect(document.getElementById('lista-contas')).not.toBeInTheDocument()
  })
})

describe('SeletorConta in six markets (Fase 2b)', () => {
  it('groups every market in the board’s order, with the phase of each account', async () => {
    const accounts = [
      makeAccount({ label: 'Clear', market: 'b3', phase: 'pessoal' }),
      makeAccount({ label: 'Binance', market: 'crypto', phase: 'pessoal' }),
      makeAccount({ label: 'IBKR', market: 'stocks', phase: 'pessoal' }),
      makeAccount({ label: 'FTMO', market: 'forex', phase: 'avaliacao' }),
      ebinex,
      topOne,
    ]
    render(<SeletorConta accounts={accounts} current={accounts[1]} onChoose={jest.fn()} onAdd={jest.fn()} janela="Janela 20:00–22:00 · Brasília" />)
    const button = screen.getByRole('button', { name: /^Conta: / })
    expect(button).toHaveAccessibleDescription('Janela 20:00–22:00 · Brasília')

    await userEvent.click(button)

    const list = document.getElementById('lista-contas') as HTMLElement
    expect(Array.from(list.querySelectorAll('.hub-seletor__grupo')).map((el) => el.textContent)).toEqual([
      'Futuros',
      'Opções binárias',
      'Forex',
      'Ações',
      'Cripto',
      'B3',
    ])
    expect(within(list).getByRole('button', { name: /Binance/ })).toHaveAttribute('aria-current', 'true')
    expect(within(list).getByRole('button', { name: /FTMO/ })).toHaveTextContent('Avaliação')
    expect(within(list).getByText('Contas de mercados diferentes nunca são somadas.')).toBeInTheDocument()
  })
})

describe('SeletorConta window line', () => {
  it('shows the current account’s window under its button, which it describes', () => {
    const { button } = renderSelector(topOne, 'Janela 10:00–11:00 ET')

    const line = document.getElementById('janela-conta') as HTMLElement
    expect(line).toHaveTextContent('Janela 10:00–11:00 ET')
    expect(line).toHaveClass('hub-seletor__janela')
    expect(button).toHaveAttribute('aria-describedby', 'janela-conta')
    expect(button).toHaveAccessibleDescription('Janela 10:00–11:00 ET')
    // Under the button, before the list
    expect(button.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the line while the list is open', async () => {
    const { button } = renderSelector(ebinex, 'Sem janela salva')

    await userEvent.click(button)

    expect(document.getElementById('janela-conta')).toHaveTextContent('Sem janela salva')
    const list = document.getElementById('lista-contas') as HTMLElement
    expect(within(list).queryByText('Sem janela salva')).not.toBeInTheDocument()
  })

  it.each([undefined, null, ''])('shows nothing, and describes nothing, without a line (%p)', (janela) => {
    const { button } = renderSelector(topOne, janela)

    expect(document.getElementById('janela-conta')).toBeNull()
    expect(button).not.toHaveAttribute('aria-describedby')
  })
})

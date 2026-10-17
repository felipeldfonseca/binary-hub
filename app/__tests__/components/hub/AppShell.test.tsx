import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppShell from '@/components/hub/AppShell'
import HubRoot from '@/components/hub/HubRoot'

let mockPathname = '/diario'
const mockSignOut = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'felipe@example.com' },
    profile: { display_name: 'Felipe' },
    signOut: mockSignOut,
  }),
}))

const renderShell = () =>
  render(
    <HubRoot>
      <AppShell>
        <p>Conteúdo da página</p>
      </AppShell>
    </HubRoot>
  )

describe('AppShell', () => {
  beforeEach(() => {
    mockPathname = '/diario'
    mockSignOut.mockClear()
    window.localStorage.clear()
  })

  it('shows the page inside the main area', () => {
    renderShell()

    expect(within(screen.getByRole('main')).getByText('Conteúdo da página')).toBeInTheDocument()
  })

  it('lists the menu in the boards’ order', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Principal' })

    expect(within(nav).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Início',
      'Diário',
      'Análises',
      'Mercado',
      'Socialem breve',
      'AIem breve',
      'Conquistasem breve',
    ])
  })

  it('links the built screens and today’s pages', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Principal' })

    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/dashboard')
    expect(within(nav).getByRole('link', { name: 'Diário' })).toHaveAttribute('href', '/diario')
    expect(within(nav).getByRole('link', { name: 'Análises' })).toHaveAttribute('href', '/analytics')
    expect(within(nav).getByRole('link', { name: 'Mercado' })).toHaveAttribute('href', '/market')
  })

  it('shows Social, AI and Conquistas as coming soon, without a link', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Principal' })

    for (const label of ['Social', 'AI', 'Conquistas']) {
      expect(within(nav).queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      expect(within(nav).getByText(label)).toHaveTextContent(`${label}em breve`)
    }
  })

  it('marks the current screen', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Principal' })

    expect(within(nav).getByRole('link', { name: 'Diário' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('carries the theme on the frame', async () => {
    const { container } = renderShell()
    const hub = container.querySelector('.hub')

    expect(hub).toHaveAttribute('data-tema', 'claro')
    await userEvent.click(screen.getByRole('switch', { name: 'Modo escuro' }))
    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })

  it('opens the phone menu with the same items, taking focus into it', async () => {
    renderShell()
    const button = screen.getByRole('button', { name: 'Menu' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const phoneMenu = document.getElementById('hub-menu-celular') as HTMLElement
    expect(within(phoneMenu).getByRole('link', { name: 'Início' })).toHaveFocus()
    expect(within(phoneMenu).getByRole('link', { name: 'Diário' })).toHaveAttribute('aria-current', 'page')
    expect(within(phoneMenu).getByText('Conquistas')).toHaveTextContent('Conquistasem breve')
  })

  it('closes the phone menu with Escape and gives focus back to its button', async () => {
    renderShell()
    const button = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(button)
    const phoneMenu = document.getElementById('hub-menu-celular') as HTMLElement
    act(() => {
      within(phoneMenu).getByRole('link', { name: 'Diário' }).focus()
    })
    expect(button).not.toHaveFocus()

    await userEvent.keyboard('{Escape}')

    expect(document.getElementById('hub-menu-celular')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes an open menu on a click outside the header', async () => {
    renderShell()

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await userEvent.click(screen.getByText('Conteúdo da página'))

    expect(document.getElementById('hub-menu-celular')).not.toBeInTheDocument()
  })

  it('closes an open menu when focus moves out of the header, so it never covers the focused control', async () => {
    const { container } = render(
      <HubRoot>
        <AppShell>
          <button type="button">Ação da página</button>
        </AppShell>
      </HubRoot>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(container.querySelector('#hub-menu-celular')).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: 'Ação da página' }).focus()
    })

    expect(container.querySelector('#hub-menu-celular')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ação da página' })).toHaveFocus()
  })

  it('offers sign-out from the profile menu', async () => {
    renderShell()
    const profile = screen.getByRole('button', { name: 'Abrir menu do perfil' })

    expect(profile).toHaveTextContent('F')
    await userEvent.click(profile)
    expect(screen.getByText('felipe@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('gives focus back to the profile button when Escape closes its menu', async () => {
    renderShell()
    const profile = screen.getByRole('button', { name: 'Abrir menu do perfil' })
    await userEvent.click(profile)
    expect(profile).not.toHaveFocus()

    await userEvent.keyboard('{Escape}')

    expect(document.getElementById('hub-menu-perfil')).not.toBeInTheDocument()
    expect(profile).toHaveFocus()
  })

  it('has a link that skips to the page content', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
  })
})

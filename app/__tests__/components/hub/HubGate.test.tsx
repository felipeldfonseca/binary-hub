import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HubGate from '@/components/hub/HubGate'

const mockFetch = jest.fn()
const mockSignOut = jest.fn()
const mockAuth: {
  user: { id: string } | null
  session: { access_token: string } | null
  signOut: () => Promise<void>
} = {
  user: { id: 'user-1' },
  session: { access_token: 'user-jwt' },
  signOut: mockSignOut,
}

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

const answer = (status: number) => Promise.resolve({ ok: status >= 200 && status < 300, status } as Response)

/** A request that stays open until the test settles it. */
const pending = () => {
  let settle!: (status: number) => void
  const promise = new Promise<Response>((resolve) => {
    settle = (status) => resolve({ ok: status >= 200 && status < 300, status } as Response)
  })
  return { promise, settle }
}

// A new element on every call: React skips re-rendering an element it has already seen
const gate = () => (
  <HubGate>
    <p>Página do hub</p>
  </HubGate>
)

describe('HubGate', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockSignOut.mockReset()
    global.fetch = mockFetch as unknown as typeof fetch
    mockAuth.user = { id: 'user-1' }
    mockAuth.session = { access_token: 'user-jwt' }
  })

  it('asks the server with the session token, showing a loading state meanwhile', async () => {
    mockFetch.mockReturnValue(answer(200))

    render(gate())

    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(await screen.findByText('Página do hub')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith('/api/hub/acesso', {
      headers: { Authorization: 'Bearer user-jwt' },
      cache: 'no-store',
    })
  })

  it('keeps the page hidden from an account that is not on the list', async () => {
    mockFetch.mockReturnValue(answer(403))

    render(gate())

    expect(await screen.findByRole('heading', { name: 'Acesso ainda não liberado' })).toBeInTheDocument()
    expect(screen.queryByText('Página do hub')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/dashboard')
  })

  it('signs the stale session out when the server rejects it, so the login form can show', async () => {
    mockFetch.mockReturnValue(answer(401))

    render(gate())

    expect(await screen.findByRole('heading', { name: 'Sua sessão expirou' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('offers a retry when the check could not be made, and checks again from scratch', async () => {
    const third = pending()
    mockFetch
      .mockReturnValueOnce(answer(503))
      .mockReturnValueOnce(Promise.reject(new Error('offline')))
      .mockReturnValueOnce(third.promise)

    render(gate())

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))

    // The old error does not stay on screen while the new check runs
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')

    await act(async () => {
      third.settle(200)
    })
    expect(screen.getByText('Página do hub')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does not check again, or unmount the page, when the token is refreshed', async () => {
    mockFetch.mockReturnValue(answer(200))
    const { rerender } = render(gate())
    await screen.findByText('Página do hub')

    mockAuth.session = { access_token: 'refreshed-jwt' }
    rerender(gate())

    expect(screen.getByText('Página do hub')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('hides the page from a different account until that account is checked', async () => {
    const second = pending()
    mockFetch.mockReturnValueOnce(answer(200)).mockReturnValueOnce(second.promise)
    const { rerender } = render(gate())
    await screen.findByText('Página do hub')

    mockAuth.user = { id: 'user-2' }
    mockAuth.session = { access_token: 'other-jwt' }
    rerender(gate())

    expect(screen.queryByText('Página do hub')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')

    await act(async () => {
      second.settle(403)
    })
    expect(screen.getByRole('heading', { name: 'Acesso ainda não liberado' })).toBeInTheDocument()
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/hub/acesso',
      expect.objectContaining({ headers: { Authorization: 'Bearer other-jwt' } })
    )
  })

  it('ignores an answer that arrives after the account changed', async () => {
    const first = pending()
    const second = pending()
    mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { rerender } = render(gate())

    mockAuth.user = { id: 'user-2' }
    mockAuth.session = { access_token: 'other-jwt' }
    rerender(gate())

    // The first account's "allowed" comes back late; the second account must not see the page
    await act(async () => {
      first.settle(200)
    })
    expect(screen.queryByText('Página do hub')).not.toBeInTheDocument()

    await act(async () => {
      second.settle(403)
    })
    expect(screen.getByRole('heading', { name: 'Acesso ainda não liberado' })).toBeInTheDocument()
  })

  it('treats a missing token as an expired session', async () => {
    mockAuth.session = null

    render(gate())

    expect(await screen.findByRole('heading', { name: 'Sua sessão expirou' })).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

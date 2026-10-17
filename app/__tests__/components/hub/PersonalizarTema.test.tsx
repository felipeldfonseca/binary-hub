import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import AppShell from '@/components/hub/AppShell'
import HubRoot from '@/components/hub/HubRoot'
import PersonalizarPage from '@/app/(hub)/personalizar/page'
import { THEME_STORAGE_KEY } from '@/lib/hub/tema'
import { makeAccount } from '@/testing/hubHarness'
import { configDepois, idsDono } from '@/testing/regras'
import { et } from '@/testing/gate'

jest.mock('next/navigation', () => ({
  usePathname: () => '/personalizar',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'felipe@example.com' }, session: { access_token: 'user-jwt' }, profile: null, signOut: jest.fn() }),
}))
jest.mock('@/hooks/useAgora', () => ({ useAgora: () => et('2026-10-22 12:00') }))
jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchActivity: jest.fn(),
  fetchPreferences: jest.fn(),
}))
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  mergePreferences: jest.fn(),
  fetchTradesSince: jest.fn(),
}))

const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>
const ids = idsDono()

beforeEach(() => {
  window.localStorage.clear()
  ;(contasDb.fetchAccounts as jest.Mock).mockReset().mockResolvedValue([
    makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures' }),
    makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary' }),
  ])
  ;(contasDb.fetchActivity as jest.Mock).mockReset().mockResolvedValue({})
  ;(regrasDb.fetchRulesConfig as jest.Mock).mockReset().mockResolvedValue(configDepois())
  ;(regrasDb.fetchTradesSince as jest.Mock).mockReset().mockResolvedValue({})
  fetchPreferences.mockReset().mockResolvedValue({})
  mergePreferences.mockReset().mockImplementation(async (_db, patch) => ({ theme: patch.theme ?? undefined }))
})

function renderHubPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <HubRoot>
        <AppShell>
          <PersonalizarPage />
        </AppShell>
      </HubRoot>
    </QueryClientProvider>,
  )
  return { ...view, queryClient, hub: view.container.querySelector('.hub') as HTMLElement }
}

const temaPills = () => screen.getByRole('group', { name: 'Tema' })
const switchEscuro = () => screen.getByRole('switch', { name: 'Modo escuro' })

describe('the theme, saved to the profile (contrato §4.11)', () => {
  it('the Tema pills and the header switch are one value, merged into the profile at once (never in the draft)', async () => {
    const { hub } = renderHubPage()
    await screen.findByRole('heading', { level: 3, name: 'Como fica hoje' })

    await userEvent.click(within(temaPills()).getByRole('button', { name: 'Escuro' }))

    expect(hub).toHaveAttribute('data-tema', 'escuro')
    expect(switchEscuro()).toHaveAttribute('aria-checked', 'true')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
    await waitFor(() => expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { theme: 'escuro' }))
    expect(screen.getAllByText('Tudo salvo').length).toBeGreaterThan(0)

    await userEvent.click(switchEscuro())
    expect(within(temaPills()).getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(mergePreferences).toHaveBeenLastCalledWith(expect.anything(), { theme: 'claro' }))
  })

  it('the profile’s saved theme wins once when the preferences answer, and is kept in this browser', async () => {
    fetchPreferences.mockResolvedValue({ theme: 'escuro' })
    const { hub, queryClient } = renderHubPage()

    await waitFor(() => expect(hub).toHaveAttribute('data-tema', 'escuro'))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
    expect(mergePreferences).not.toHaveBeenCalled()

    // Later reads of the preferences never switch the theme again. React Query tells its observers
    // on a timer: wait until the new answer is in the cache and the page had time to draw it.
    fetchPreferences.mockResolvedValue({ theme: 'claro' })
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['hub', 'user-1', 'preferencias'] })
    })
    expect(queryClient.getQueryData(['hub', 'user-1', 'preferencias'])).toEqual({ theme: 'claro' })
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })

  it('a theme changed before the preferences answer stands: the older profile value does not undo it', async () => {
    let answer: (p: contasDb.HubPreferences) => void = () => {}
    fetchPreferences.mockReturnValue(new Promise((r) => (answer = r)))
    // The merge answers only after the preferences do, so the older profile value is what arrives first
    let merged: (p: contasDb.HubPreferences) => void = () => {}
    mergePreferences.mockReturnValue(new Promise((r) => (merged = r)))
    const { hub, queryClient } = renderHubPage()

    await userEvent.click(switchEscuro())
    await act(async () => {
      answer({ theme: 'claro' })
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(queryClient.getQueryData(['hub', 'user-1', 'preferencias'])).toEqual({ theme: 'claro' })

    expect(hub).toHaveAttribute('data-tema', 'escuro')
    expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { theme: 'escuro' })
    await act(async () => merged({ theme: 'escuro' }))
    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })

  it('a failed merge keeps the local choice, silently', async () => {
    mergePreferences.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { hub } = renderHubPage()

    await userEvent.click(switchEscuro())

    await waitFor(() => expect(mergePreferences).toHaveBeenCalled())
    expect(hub).toHaveAttribute('data-tema', 'escuro')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

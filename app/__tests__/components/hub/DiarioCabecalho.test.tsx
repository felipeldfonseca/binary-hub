import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import DiarioCabecalho from '@/components/hub/contas/DiarioCabecalho'
import { makeAccount, renderHub } from '@/testing/hubHarness'

let mockSearch = ''
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/diario',
}))

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchPreferences: jest.fn(),
  savePreferences: jest.fn(),
  fetchImportFormats: jest.fn(),
}))

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchPreferences = data.fetchPreferences as jest.MockedFunction<typeof data.fetchPreferences>
const savePreferences = data.savePreferences as jest.MockedFunction<typeof data.savePreferences>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>

const topOne = makeAccount({ label: 'Top One', market: 'futures', sort_order: 1 })
const ebinex = makeAccount({ label: 'Ebinex', market: 'binary', is_primary: true })
const apex = makeAccount({ label: 'Apex A', market: 'futures', sort_order: 0 })
const example = makeAccount({ label: 'Exemplo', market: 'futures', is_example: true })
const closed = makeAccount({ label: 'Velha', market: 'futures', archived_at: '2026-09-01T00:00:00Z' })

const selectorButton = () => screen.findByRole('button', { name: /^Conta: / })

beforeEach(() => {
  mockSearch = ''
  mockReplace.mockReset()
  fetchAccounts.mockReset().mockResolvedValue([topOne, ebinex, apex, example, closed])
  fetchPreferences.mockReset().mockResolvedValue({ tema: 'escuro' })
  savePreferences.mockReset().mockResolvedValue(undefined)
  fetchImportFormats.mockReset().mockResolvedValue({})
})

describe('Diário header', () => {
  it('has the board’s H1 and "Importar arquivo"', async () => {
    renderHub(<DiarioCabecalho />)

    expect(screen.getByRole('heading', { level: 1, name: 'Diário' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar arquivo' })).toBeInTheDocument()
    expect(await selectorButton()).toBeInTheDocument()
  })

  it('opens on the primary account when nothing was chosen', async () => {
    renderHub(<DiarioCabecalho />)

    expect(await selectorButton()).toHaveTextContent('Conta: Ebinex')
  })

  it('opens on the account saved in the preferences', async () => {
    fetchPreferences.mockResolvedValue({ conta_atual: topOne.id })
    renderHub(<DiarioCabecalho />)

    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
  })

  it('lets ?conta= in the URL win over the saved choice', async () => {
    mockSearch = `conta=${apex.id}`
    fetchPreferences.mockResolvedValue({ conta_atual: topOne.id })
    renderHub(<DiarioCabecalho />)

    expect(await selectorButton()).toHaveTextContent('Conta: Apex A')
  })

  it('falls back to the first active account, never an example or an archived one', async () => {
    fetchAccounts.mockResolvedValue([example, closed, topOne, apex])
    fetchPreferences.mockResolvedValue({ conta_atual: closed.id })
    renderHub(<DiarioCabecalho />)

    const button = await selectorButton()
    expect(button).toHaveTextContent('Conta: Apex A')
    await userEvent.click(button)
    const list = document.getElementById('lista-contas') as HTMLElement
    expect(within(list).queryByText('Exemplo')).not.toBeInTheDocument()
    expect(within(list).queryByText('Velha')).not.toBeInTheDocument()
  })

  it('saves the choice in the preferences, keeping what else is there', async () => {
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
    expect(savePreferences).toHaveBeenCalledWith(expect.anything(), 'user-1', { tema: 'escuro', conta_atual: topOne.id })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('moves ?conta= along with a new choice', async () => {
    mockSearch = `conta=${apex.id}`
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${topOne.id}`)
  })

  it('shows the empty state when there is no account', async () => {
    fetchAccounts.mockResolvedValue([example])
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Conta: / })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar conta' }))
    expect(screen.getByRole('dialog', { name: 'Adicionar conta' })).toBeInTheDocument()
  })

  it('opens the import sheet for the current account', async () => {
    renderHub(<DiarioCabecalho />)
    await selectorButton()

    await userEvent.click(screen.getByRole('button', { name: 'Importar arquivo' }))

    const dialog = screen.getByRole('dialog', { name: 'Importar arquivo' })
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Ebinex' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Importar arquivo' })).toHaveFocus()
  })

  it('opens the sheet straight away with ?importar=1, and drops it from the URL', async () => {
    mockSearch = `importar=1&conta=${topOne.id}`
    renderHub(<DiarioCabecalho />)

    const dialog = await screen.findByRole('dialog', { name: 'Importar arquivo' })
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Top One' })).toBeInTheDocument()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${topOne.id}`))
  })

  it('offers to try again when the accounts cannot be read', async () => {
    fetchAccounts.mockRejectedValueOnce(new data.HubDataError('network')).mockResolvedValue([topOne])
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as contas.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
  })
})

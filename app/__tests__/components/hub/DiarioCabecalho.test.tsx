import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { focusManager, onlineManager } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import DiarioCabecalho from '@/components/hub/contas/DiarioCabecalho'
import ImportSheetProvider from '@/components/hub/importar/ImportSheetProvider'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { agora, idsDono } from '@/testing/regras'
import { regrasKeys } from '@/hooks/useRegras'

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
  fetchImportFormats: jest.fn(),
  createAccount: jest.fn(),
}))

jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  mergePreferences: jest.fn(),
  fetchRulesNow: jest.fn(),
}))

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchPreferences = data.fetchPreferences as jest.MockedFunction<typeof data.fetchPreferences>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const createAccount = data.createAccount as jest.MockedFunction<typeof data.createAccount>

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
  mergePreferences.mockReset().mockImplementation(async (_db, patch) => ({ tema: 'escuro', ...patch }) as data.HubPreferences)
  fetchImportFormats.mockReset().mockResolvedValue({})
  createAccount.mockReset()
  // rules_now() recorded for the owner's accounts (random ids, not these): no window line for them
  fetchRulesNow.mockReset().mockResolvedValue(agora('agora-seg-0930-et'))
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

  it('saves the choice by merging conta_atual alone into the preferences', async () => {
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
    expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { conta_atual: topOne.id })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('saves the choice even when the preferences could not be read: the merge never writes the other keys', async () => {
    fetchPreferences.mockRejectedValue(new data.HubDataError('network'))
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
    await waitFor(() => expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { conta_atual: topOne.id }))
  })

  it('keeps the choice on the page when it cannot be saved', async () => {
    mergePreferences.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    await waitFor(() => expect(mergePreferences).toHaveBeenCalled())
    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
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

  it('gives focus to the H1 when the empty state that opened the sheet is gone', async () => {
    fetchAccounts.mockResolvedValue([example])
    const created = makeAccount({ label: 'Ebx', market: 'binary', platform: 'pocket', phase: 'pessoal', is_primary: true })
    createAccount.mockImplementation(async () => {
      fetchAccounts.mockResolvedValue([example, created])
      return created
    })
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar conta' }))
    const dialog = screen.getByRole('dialog', { name: 'Adicionar conta' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Ebx')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Ebx' }))
    await within(dialog).findByRole('heading', { name: 'Ebx criada.' })
    // The selector replaces the empty state
    expect(await screen.findByRole('button', { name: /^Conta: /, hidden: true })).toHaveTextContent('Conta: Ebx')

    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('heading', { level: 1, name: 'Diário' })).toHaveFocus()
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

describe('Diário header window line', () => {
  // The accounts of the recorded rules_now() answers
  const ids = idsDono()
  const dTop = makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures', phase: 'financiada' })
  const dEbx = makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary', is_primary: true })
  const line = () => document.getElementById('janela-conta')

  beforeEach(() => {
    fetchAccounts.mockResolvedValue([dTop, dEbx])
  })

  it('shows the current account’s window under the selector, which it describes', async () => {
    renderHub(<DiarioCabecalho />)

    const button = await selectorButton()
    expect(button).toHaveTextContent('Conta: Ebinex')
    await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))
    expect(button).toHaveAttribute('aria-describedby', 'janela-conta')
    expect(button).toHaveAccessibleDescription('Janela 20:00–21:00 · Brasília')
  })

  it('switches the line with the account', async () => {
    renderHub(<DiarioCabecalho />)
    await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One #1/ }))

    expect(await selectorButton()).toHaveTextContent('Conta: Top One #1')
    expect(line()).toHaveTextContent('Janela 10:00–11:00 ET')
    expect(await selectorButton()).toHaveAccessibleDescription('Janela 10:00–11:00 ET')
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
  })

  it('says «Sem janela salva» before the rules have a version', async () => {
    fetchRulesNow.mockResolvedValue(agora('agora-antes-seg-0930-et'))
    renderHub(<DiarioCabecalho />)

    await waitFor(() => expect(line()).toHaveTextContent('Sem janela salva'))
  })

  it('shows nothing while the rules load', async () => {
    fetchRulesNow.mockReturnValue(new Promise(() => {}))
    renderHub(<DiarioCabecalho />)

    const button = await selectorButton()
    expect(line()).toBeNull()
    expect(button).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText(/Janela|Sem janela salva|Carregando/)).not.toBeInTheDocument()
  })

  it('shows nothing when the rules cannot be read', async () => {
    fetchRulesNow.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { queryClient } = renderHub(<DiarioCabecalho />)

    const button = await selectorButton()
    await waitFor(() => expect(queryClient.getQueryState(regrasKeys.agora('user-1'))?.status).toBe('error'))
    await act(async () => {})
    expect(line()).toBeNull()
    expect(button).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('drops the line when a later read fails, as the card drops its lines', async () => {
    fetchRulesNow.mockResolvedValueOnce(agora('agora-seg-0930-et')).mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { queryClient } = renderHub(<DiarioCabecalho />)
    await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: regrasKeys.agora('user-1') })
    })

    await waitFor(() => expect(line()).toBeNull())
    expect(await selectorButton()).not.toHaveAttribute('aria-describedby')
  })

  describe('with the app’s query defaults (QueryProvider: three retries, staleTime 60 s)', () => {
    afterEach(() => {
      jest.useRealTimers()
      focusManager.setFocused(undefined)
      onlineManager.setOnline(true)
    })

    const renderApp = () =>
      render(
        <QueryProvider>
          <ImportSheetProvider>
            <DiarioCabecalho />
          </ImportSheetProvider>
        </QueryProvider>,
      )

    it('drops the line while a read waits offline, as the card drops its lines', async () => {
      renderApp()
      await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))

      act(() => {
        onlineManager.setOnline(false)
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      })

      await waitFor(() => expect(line()).toBeNull())
      expect(await selectorButton()).not.toHaveAttribute('aria-describedby')
      expect(fetchRulesNow).toHaveBeenCalledTimes(1)

      act(() => onlineManager.setOnline(true))
      await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))
    })

    it('drops the line as soon as a read fails, while the retries still run', async () => {
      jest.useFakeTimers()
      fetchRulesNow
        .mockReset()
        .mockResolvedValueOnce(agora('agora-seg-0930-et'))
        .mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))
        .mockResolvedValue(agora('agora-seg-0930-et'))
      renderApp()
      await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))

      act(() => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      })

      await waitFor(() => expect(line()).toBeNull())
      // Before the first retry (1 s later)
      expect(fetchRulesNow).toHaveBeenCalledTimes(2)
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      await waitFor(() => expect(line()).toHaveTextContent('Janela 20:00–21:00 · Brasília'))
      expect(fetchRulesNow).toHaveBeenCalledTimes(3)
    })
  })

  it('shows nothing for an account the answer does not have', async () => {
    fetchAccounts.mockResolvedValue([dTop, dEbx, apex])
    fetchPreferences.mockResolvedValue({ conta_atual: apex.id })
    const { queryClient } = renderHub(<DiarioCabecalho />)

    expect(await selectorButton()).toHaveTextContent('Conta: Apex A')
    await waitFor(() => expect(queryClient.getQueryState(regrasKeys.agora('user-1'))?.status).toBe('success'))
    await act(async () => {})
    expect(line()).toBeNull()
  })
})

import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { focusManager, onlineManager } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import DiarioCabecalho, { contaParaRegistrar } from '@/components/hub/contas/DiarioCabecalho'
import ImportSheetProvider from '@/components/hub/importar/ImportSheetProvider'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { agora, agoraMercados, contasMercados, idsDono, idsMercados } from '@/testing/regras'
import { contasTelas, idsTelas } from '@/testing/registrarTelas'
import { regrasKeys } from '@/hooks/useRegras'
import { hubKeys } from '@/hooks/useContas'
import type { TradingAccount } from '@/lib/hub/contas'

let mockSearch = ''
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/diario',
}))

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

// The import sheet is lane A's. These tests check what the header asks of it, through the frozen
// useImportSheet().open({mode, accountId, opener}), never the sheet's steps or headings (contract C4).
// The real sheet still opens: only the call is recorded.
const mockOpen = jest.fn()
jest.mock('@/components/hub/importar/ImportSheetProvider', () => {
  const { useMemo } = jest.requireActual('react')
  const actual = jest.requireActual('@/components/hub/importar/ImportSheetProvider')
  return {
    __esModule: true,
    ...actual,
    useImportSheet: () => {
      const sheet = actual.useImportSheet()
      return useMemo(
        () => ({
          ...sheet,
          open: (options: unknown) => {
            mockOpen(options)
            sheet.open(options)
          },
        }),
        [sheet],
      )
    },
  }
})

// Phase 3: «Registrar operação» opens the Registrar sheet through useRegistrarSheet().open; the
// call is recorded, and the sheet is a stand-in (lane A's; contract §6.2, C9) showing its props
const mockRegistrarOpen = jest.fn()
jest.mock('@/components/hub/registrar/abrir', () => {
  const { useMemo } = jest.requireActual('react')
  const actual = jest.requireActual('@/components/hub/registrar/abrir')
  return {
    __esModule: true,
    ...actual,
    useRegistrarSheet: () => {
      const sheet = actual.useRegistrarSheet()
      return useMemo(
        () => ({
          ...sheet,
          open: (options: unknown) => {
            mockRegistrarOpen(options)
            sheet.open(options)
          },
        }),
        [sheet],
      )
    },
  }
})
const mockSheet = jest.fn()
jest.mock('@/components/hub/registrar/RegistrarSheet', () => ({
  __esModule: true,
  default: function RegistrarSheetStub(props: { accountId: string | null; tradeId: string | null; onClose: () => void }) {
    mockSheet({ accountId: props.accountId, tradeId: props.tradeId })
    return (
      <section role="dialog" aria-label="Registrar operação">
        <button type="button" onClick={() => props.onClose()}>
          Fechar
        </button>
      </section>
    )
  },
}))

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
  mockOpen.mockReset()
  mockRegistrarOpen.mockReset()
  mockSheet.mockReset()
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

  it('saves the choice by merging conta_atual alone into the preferences, and puts it in ?conta= for the page’s other blocks', async () => {
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
    expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { conta_atual: topOne.id })
    // «Operações do dia» reads the current account too: the URL is the one source both read first
    // (lane B review); no scroll to the top
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${topOne.id}`, { scroll: false })
  })

  it('keeps the URL’s other parameters with the choice, and never a sheet’s that was already handled', async () => {
    // ?registrar=1 opened the sheet; the URL here does not follow router.replace, so the header
    // still sees it when the owner picks an account after closing the sheet
    mockSearch = 'de=inicio&registrar=1'
    renderHub(<DiarioCabecalho />)
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar' }))
    expect(mockSheet).toHaveBeenCalledTimes(1)
    mockReplace.mockClear()

    await userEvent.click(await selectorButton())
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }))

    expect(mockReplace).toHaveBeenCalledWith(`/diario?de=inicio&conta=${topOne.id}`, { scroll: false })
    expect(mockSheet).toHaveBeenCalledTimes(1)
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

    // useContaAtual moves it, as before (once)
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${topOne.id}`)
  })

  it('shows the empty state when there is no account', async () => {
    fetchAccounts.mockResolvedValue([example])
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Conta: / })).not.toBeInTheDocument()
    const add = screen.getByRole('button', { name: '+ Adicionar conta' })
    await userEvent.click(add)
    expect(mockOpen).toHaveBeenCalledWith({ mode: 'adicionar', opener: add })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('gives focus to the H1 when the empty state that opened the sheet is gone', async () => {
    fetchAccounts.mockResolvedValue([example])
    const created = makeAccount({ label: 'Ebx', market: 'binary', platform: 'pocket', phase: 'pessoal', is_primary: true })
    const { queryClient } = renderHub(<DiarioCabecalho />)

    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar conta' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // An account is created while the sheet is open (the sheet's steps are lane A's tests): the
    // accounts are read again and the selector replaces the empty state
    fetchAccounts.mockResolvedValue([example, created])
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: hubKeys.contas('user-1') })
    })
    expect(await screen.findByRole('button', { name: /^Conta: /, hidden: true })).toHaveTextContent('Conta: Ebx')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Diário' })).toHaveFocus()
  })

  it('opens the import sheet for the current account', async () => {
    renderHub(<DiarioCabecalho />)
    await selectorButton()

    const importFile = screen.getByRole('button', { name: 'Importar arquivo' })
    await userEvent.click(importFile)

    expect(mockOpen).toHaveBeenCalledWith({ mode: 'importar', accountId: ebinex.id, opener: importFile })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(importFile).toHaveFocus()
  })

  it('opens the sheet straight away with ?importar=1, and drops it from the URL', async () => {
    mockSearch = `importar=1&conta=${topOne.id}`
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith({
      mode: 'importar',
      accountId: topOne.id,
      opener: screen.getByRole('button', { name: 'Importar arquivo', hidden: true }),
    })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${topOne.id}`))
  })

  it('offers to try again when the accounts cannot be read', async () => {
    fetchAccounts.mockRejectedValueOnce(new data.HubDataError('network')).mockResolvedValue([topOne])
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as contas.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await selectorButton()).toHaveTextContent('Conta: Top One')
  })

  describe('focus after «Tentar de novo»', () => {
    const accountsError = () => screen.getByText('Não foi possível carregar as contas.')

    /** The first read fails; «Tentar de novo» is pressed from the keyboard; `next` answers the second read */
    async function retryFromKeyboard(next: () => Promise<TradingAccount[]>) {
      fetchAccounts.mockReset().mockRejectedValueOnce(new data.HubDataError('network')).mockImplementation(next)
      renderHub(<DiarioCabecalho />)
      await screen.findByRole('alert')
      const retry = screen.getByRole('button', { name: 'Tentar de novo' })
      retry.focus()
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(fetchAccounts).toHaveBeenCalledTimes(2))
      return retry
    }

    it('keeps «Tentar de novo» and its focus while it reads again, with «Carregando…» in place of the error', async () => {
      let answer!: (accounts: TradingAccount[]) => void
      const retry = await retryFromKeyboard(() => new Promise((resolve) => (answer = resolve)))

      expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(retry).toBeInTheDocument()
      expect(retry).toHaveFocus()

      await act(async () => answer([topOne]))
      expect(await selectorButton()).toHaveFocus()
    })

    it('gives focus to the account selector that replaces it, so the next Tab does not restart the page', async () => {
      const retry = await retryFromKeyboard(async () => [topOne])

      const selector = await selectorButton()
      expect(retry).not.toBeInTheDocument()
      expect(selector).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('gives focus to the H1 when the accounts come back empty (no selector takes its place)', async () => {
      await retryFromKeyboard(async () => [example])

      expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Diário' })).toHaveFocus()
    })

    it('keeps focus on «Tentar de novo» when the accounts still cannot be read', async () => {
      const retry = await retryFromKeyboard(async () => {
        throw new data.HubDataError('network')
      })

      await waitFor(() => expect(screen.getByRole('alert')).toBe(accountsError()))
      expect(retry).toBeInTheDocument()
      expect(retry).toHaveFocus()
    })

    it('keeps the selector during a later background read, once the accounts came after an error', async () => {
      fetchAccounts.mockReset().mockRejectedValueOnce(new data.HubDataError('network')).mockResolvedValueOnce([topOne])
      const { queryClient } = renderHub(<DiarioCabecalho />)
      await screen.findByRole('alert')
      screen.getByRole('button', { name: 'Tentar de novo' }).focus()
      await userEvent.keyboard('{Enter}')
      const selector = await selectorButton()

      let answer!: (accounts: TradingAccount[]) => void
      fetchAccounts.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
      await act(async () => {
        void queryClient.invalidateQueries({ queryKey: hubKeys.contas('user-1') })
      })
      await waitFor(() => expect(fetchAccounts).toHaveBeenCalledTimes(3))

      // The accounts on screen stay: no «Carregando…», no «Tentar de novo»
      expect(selector).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
      expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
      await act(async () => answer([topOne]))
    })

    it('leaves focus alone when it moved on before the accounts came', async () => {
      let answer!: (accounts: TradingAccount[]) => void
      await retryFromKeyboard(() => new Promise((resolve) => (answer = resolve)))
      const importFile = screen.getByRole('button', { name: 'Importar arquivo' })
      importFile.focus()

      await act(async () => answer([topOne]))

      await selectorButton()
      expect(importFile).toHaveFocus()
    })

    it('with the app’s query defaults (three retries): keeps focus while its read is retried, then gives it to the selector', async () => {
      jest.useFakeTimers()
      try {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        const network = new data.HubDataError('network')
        fetchAccounts
          .mockReset()
          // The first read and its three retries (1 s, 2 s, 4 s)
          .mockRejectedValueOnce(network)
          .mockRejectedValueOnce(network)
          .mockRejectedValueOnce(network)
          .mockRejectedValueOnce(network)
          // «Tentar de novo»: fails once, and its retry 1 s later answers
          .mockRejectedValueOnce(network)
          .mockResolvedValue([topOne])
        render(
          <QueryProvider>
            <ImportSheetProvider>
              <DiarioCabecalho />
            </ImportSheetProvider>
          </QueryProvider>,
        )
        // The first load says «Carregando…» alone while it is retried
        expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
        expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
        // waitFor moves the fake clock on while it waits
        await waitFor(() => expect(screen.getByRole('alert')).toBe(accountsError()), { timeout: 10_000 })
        expect(fetchAccounts).toHaveBeenCalledTimes(4)

        const retry = screen.getByRole('button', { name: 'Tentar de novo' })
        retry.focus()
        await user.keyboard('{Enter}')
        await waitFor(() => expect(fetchAccounts).toHaveBeenCalledTimes(5))
        // Its read failed and waits for the retry: the button keeps focus
        expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
        expect(retry).toHaveFocus()

        await waitFor(() => expect(fetchAccounts).toHaveBeenCalledTimes(6), { timeout: 3000 })
        expect(await selectorButton()).toHaveFocus()
      } finally {
        jest.useRealTimers()
      }
    })
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

describe('Diário header in six markets (Fase 2b)', () => {
  // The six-market owner (recorded on the markets migration) and rules_now() at Mon 19 Oct 08:30 ET
  const im = idsMercados()
  const line = () => document.getElementById('janela-conta')

  beforeEach(() => {
    fetchAccounts.mockResolvedValue(contasMercados())
    fetchRulesNow.mockResolvedValue(agoraMercados())
  })

  it.each([
    ['FTMO', 'ftmo', 'Janela 08:00–10:00 ET'],
    ['IBKR', 'ibkr', 'Sem janela salva'],
    ['Binance', 'binance', 'Janela 20:00–22:00 · Brasília'],
    ['Clear', 'clear', 'Janela 10:00–11:00 · Brasília'],
  ] as const)('the window line of %s under the selector', async (label, key, texto) => {
    mockSearch = `conta=${im[key]}`
    renderHub(<DiarioCabecalho />)

    const button = await selectorButton()
    expect(button).toHaveTextContent(`Conta: ${label}`)
    await waitFor(() => expect(line()).toHaveTextContent(texto))
    expect(button).toHaveAccessibleDescription(texto)
  })

  it('lists every market in the selector, in the board’s order, never summed', async () => {
    renderHub(<DiarioCabecalho />)

    await userEvent.click(await selectorButton())

    const list = document.getElementById('lista-contas') as HTMLElement
    expect(Array.from(list.querySelectorAll('.hub-seletor__grupo')).map((el) => el.textContent)).toEqual([
      'Futuros',
      'Opções binárias',
      'Forex',
      'Ações',
      'Cripto',
      'B3',
    ])
    expect(within(list).getByText('Contas de mercados diferentes nunca são somadas.')).toBeInTheDocument()
  })

  it('«Importar arquivo» with a Cripto account opens the sheet without an account (no file of that market is read yet)', async () => {
    mockSearch = `conta=${im.binance}`
    renderHub(<DiarioCabecalho />)
    expect(await selectorButton()).toHaveTextContent('Conta: Binance')

    const importFile = screen.getByRole('button', { name: 'Importar arquivo' })
    await userEvent.click(importFile)

    expect(mockOpen).toHaveBeenCalledWith({ mode: 'importar', accountId: null, opener: importFile })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(importFile).toHaveFocus()
  })

  it.each(['ftmo', 'ibkr', 'clear'] as const)('?importar=1 with a %s account in context opens the sheet without it', async (key) => {
    mockSearch = `importar=1&conta=${im[key]}`
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith({
      mode: 'importar',
      accountId: null,
      opener: screen.getByRole('button', { name: 'Importar arquivo', hidden: true }),
    })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${im[key]}`))
  })

  it.each(['topOne', 'ebinex'] as const)('a Futuros or binárias account (%s) still opens the sheet on itself, also with ?importar=1', async (key) => {
    mockSearch = `conta=${im[key]}`
    const { unmount } = renderHub(<DiarioCabecalho />)
    await selectorButton()

    const importFile = screen.getByRole('button', { name: 'Importar arquivo' })
    await userEvent.click(importFile)

    expect(mockOpen).toHaveBeenCalledWith({ mode: 'importar', accountId: im[key], opener: importFile })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    unmount()

    mockOpen.mockReset()
    mockSearch = `importar=1&conta=${im[key]}`
    renderHub(<DiarioCabecalho />)
    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ mode: 'importar', accountId: im[key] })))
  })
})

describe('Diário header · «Registrar operação» (Phase 3)', () => {
  // The recorded accounts of the Registrar fixtures: Top One #1 (futures, primary), Ebinex, FTMO (forex)
  const tid = idsTelas()
  const registrarButton = () => screen.findByRole('button', { name: 'Registrar operação' })

  beforeEach(() => {
    fetchAccounts.mockResolvedValue(contasTelas())
    fetchPreferences.mockResolvedValue({})
  })

  it('is the primary action, first in the header, before «Importar arquivo»', async () => {
    renderHub(<DiarioCabecalho />)

    const registrar = await registrarButton()
    expect(registrar).toHaveClass('hub-btn', 'hub-btn--pri')
    const actions = registrar.closest('.hub-acoes') as HTMLElement
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Registrar operação', 'Importar arquivo'])
    expect(screen.getByRole('button', { name: 'Importar arquivo' })).not.toHaveClass('hub-btn--pri')
  })

  it('opens the Registrar sheet on the current account; closing gives the focus back to it', async () => {
    fetchPreferences.mockResolvedValue({ conta_atual: tid.accounts.ebinex })
    renderHub(<DiarioCabecalho />)
    await screen.findByRole('button', { name: /^Conta: Ebinex/ })

    const registrar = await registrarButton()
    await userEvent.click(registrar)

    expect(mockRegistrarOpen).toHaveBeenCalledWith({ accountId: tid.accounts.ebinex, opener: registrar })
    expect(mockSheet).toHaveBeenLastCalledWith({ accountId: tid.accounts.ebinex, tradeId: null })
    expect(mockOpen).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(registrar).toHaveFocus()
  })

  it('is not there while the accounts load, after a failed read, in the empty state, or on an account of a new market (FTMO)', async () => {
    let answer!: (accounts: TradingAccount[]) => void
    fetchAccounts.mockReturnValue(new Promise((r) => (answer = r)))
    const loading = renderHub(<DiarioCabecalho />)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar operação' })).not.toBeInTheDocument()
    await act(async () => answer(contasTelas()))
    expect(await registrarButton()).toBeInTheDocument()
    loading.unmount()

    fetchAccounts.mockReset().mockRejectedValue(new data.HubDataError('network'))
    const failed = renderHub(<DiarioCabecalho />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as contas.')
    expect(screen.queryByRole('button', { name: 'Registrar operação' })).not.toBeInTheDocument()
    failed.unmount()

    fetchAccounts.mockReset().mockResolvedValue([example])
    const empty = renderHub(<DiarioCabecalho />)
    expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar operação' })).not.toBeInTheDocument()
    empty.unmount()

    // D36: the new markets keep their interim state until 3-4 (no Registrar for them yet)
    fetchAccounts.mockReset().mockResolvedValue(contasTelas())
    fetchPreferences.mockResolvedValue({ conta_atual: tid.accounts.ftmo })
    renderHub(<DiarioCabecalho />)
    expect(await screen.findByRole('button', { name: /^Conta: FTMO/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar operação' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar arquivo' })).toBeInTheDocument()
  })

  it.each([false, true])('?registrar=1 opens it once on the current account and leaves the URL with ?conta= (strict mode: %s)', async (strict) => {
    mockSearch = `registrar=1&conta=${tid.accounts.ebinex}`
    renderHub(<DiarioCabecalho />, { strict })

    expect(await screen.findByRole('dialog', { name: 'Registrar operação' })).toBeInTheDocument()
    expect(mockRegistrarOpen).toHaveBeenCalledTimes(1)
    expect(mockRegistrarOpen).toHaveBeenCalledWith({
      accountId: tid.accounts.ebinex,
      opener: screen.getByRole('button', { name: 'Registrar operação', hidden: true }),
      fallback: screen.getByRole('heading', { level: 1, name: 'Diário', hidden: true }),
    })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${tid.accounts.ebinex}`))
    expect(mockOpen).not.toHaveBeenCalled()
  })

  it('?registrar=1 alone drops to /diario', async () => {
    mockSearch = 'registrar=1'
    renderHub(<DiarioCabecalho />)

    await waitFor(() => expect(mockRegistrarOpen).toHaveBeenCalledWith(expect.objectContaining({ accountId: tid.accounts.topOne })))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/diario'))
  })

  it('?registrar=1 with FTMO current opens on the first account that can register (the primary), focus back to the H1', async () => {
    mockSearch = `registrar=1&conta=${tid.accounts.ftmo}`
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('dialog', { name: 'Registrar operação' })).toBeInTheDocument()
    const h1 = screen.getByRole('heading', { level: 1, name: 'Diário', hidden: true })
    expect(mockRegistrarOpen).toHaveBeenCalledWith({ accountId: tid.accounts.topOne, opener: h1, fallback: h1 })
    expect(screen.getByRole('button', { name: /^Conta: FTMO/, hidden: true })).toBeInTheDocument()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${tid.accounts.ftmo}`))

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(h1).toHaveFocus()
  })

  it('?registrar=1 without any account that can register opens nothing, and still leaves the URL', async () => {
    const ftmoOnly = contasTelas().filter((a) => a.id === tid.accounts.ftmo)
    fetchAccounts.mockResolvedValue(ftmoOnly)
    mockSearch = 'registrar=1'
    renderHub(<DiarioCabecalho />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/diario'))
    expect(mockRegistrarOpen).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('?registrar=1 wins over ?importar=1: one sheet, and both leave the URL', async () => {
    mockSearch = `importar=1&registrar=1&conta=${tid.accounts.topOne}`
    renderHub(<DiarioCabecalho />)

    expect(await screen.findByRole('dialog', { name: 'Registrar operação' })).toBeInTheDocument()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/diario?conta=${tid.accounts.topOne}`))
    expect(mockRegistrarOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).not.toHaveBeenCalled()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('waits for the accounts before it opens', async () => {
    let answer!: (accounts: TradingAccount[]) => void
    fetchAccounts.mockReturnValue(new Promise((r) => (answer = r)))
    mockSearch = 'registrar=1'
    renderHub(<DiarioCabecalho />)
    await act(async () => {})
    expect(mockRegistrarOpen).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    await act(async () => answer(contasTelas()))

    await waitFor(() => expect(mockRegistrarOpen).toHaveBeenCalledTimes(1))
  })

  it('contaParaRegistrar: the current account if it can, else the primary that can, else the first that can, else none', () => {
    const contas = contasTelas()
    const [topOne1, ebx, ftmo] = [tid.accounts.topOne, tid.accounts.ebinex, tid.accounts.ftmo].map((id) => contas.find((a) => a.id === id) as TradingAccount)
    expect(contaParaRegistrar(ebx, contas)).toBe(ebx)
    expect(contaParaRegistrar(ftmo, contas)).toBe(topOne1)
    expect(contaParaRegistrar(ftmo, [ftmo, ebx, { ...topOne1, is_primary: false }])).toBe(ebx)
    // The primary wins over list order
    expect(contaParaRegistrar(ftmo, [ftmo, ebx, topOne1])).toBe(topOne1)
    expect(contaParaRegistrar(null, [ebx, topOne1])).toBe(topOne1)
    expect(contaParaRegistrar(null, contas)).toBe(topOne1)
    expect(contaParaRegistrar(ftmo, [ftmo])).toBeNull()
  })
})

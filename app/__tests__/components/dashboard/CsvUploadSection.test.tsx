import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'

const mockFetch = jest.fn()
const mockToast = { showSuccess: jest.fn(), showError: jest.fn() }

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/contexts/MarketContext', () => ({
  useMarketContext: () => ({
    activeMarket: { id: 'binary', marketType: 'binary', displayName: 'Binary Options' },
    marketAccounts: [
      { id: 'binary', marketType: 'binary', displayName: 'Binary Options' },
      { id: 'futures', marketType: 'futures', displayName: 'Futures' },
    ],
  }),
}))

jest.mock('@/components/ui/Toast', () => ({
  useToastHelpers: () => mockToast,
}))

jest.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleApiError: jest.fn() }),
}))

// Ebinex export, same layout the broker produces
const CSV = [
  'ID,Data,Ativo,Tempo,Previsão,Vela,P. ABRT,P. FECH,Valor,Estornado,Executado,Status,Resultado',
  'aaa111,07/10/2026 21:02:49,IDX/USDT,M1,bear,21:03,"$ 3,762.68","$ 3,758.86",$ 48,$ 0,$ 48,win,+$46.08',
  'bbb222,07/10/2026 20:39:16,IDX/USDT,M1,bull,20:40,"$ 3,762.97","$ 3,762.48",$ 24,$ 0,$ 24,lose,-$24.00',
].join('\n')

// jsdom does not implement Blob.text()
if (!File.prototype.text) {
  File.prototype.text = function (this: File) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(this)
    })
  }
}

const renderSection = () => {
  const queryClient = new QueryClient()
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CsvUploadSection />
    </QueryClientProvider>
  )
  return { ...view, invalidateQueries }
}

const uploadCsv = async (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File([CSV], 'operacoes.csv', { type: 'text/csv' }))
  await waitFor(() => expect(mockFetch).toHaveBeenCalled())
}

const sentRows = (): Array<Record<string, unknown>> => JSON.parse(mockFetch.mock.calls[0][1].body)

describe('CsvUploadSection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: '1' }, { id: '2' }] })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  it('tags imported trades with the active account', async () => {
    const { container } = renderSection()

    await uploadCsv(container)

    const rows = sentRows()
    expect(rows).toHaveLength(2)
    rows.forEach((row) => {
      expect(row.user_id).toBe('user-1')
      expect(row.market_type).toBe('binary')
    })
  })

  it('tags imported trades with the account picked in the selector', async () => {
    const { container } = renderSection()

    await userEvent.selectOptions(screen.getByLabelText('Import to account:'), 'futures')
    await uploadCsv(container)

    sentRows().forEach((row) => {
      expect(row.market_type).toBe('futures')
    })
  })

  it('refreshes the trade lists after a successful import', async () => {
    const { container, invalidateQueries } = renderSection()

    await uploadCsv(container)

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trades'] })
    })
    expect(screen.getByText('Imported: 2')).toBeInTheDocument()
  })
})

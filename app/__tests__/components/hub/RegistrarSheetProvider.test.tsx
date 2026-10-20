import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import ImportSheetProvider, { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import { OPERACOES_DO_DIA_ID, useRegistrarSheet } from '@/components/hub/registrar/abrir'

// The two sheets as stand-ins: the import sheet's end screen opens Registrar on the new account
// («Registrar operação» after creating it); the Registrar sheet shows what it was opened with.
jest.mock('@/components/hub/importar/ImportSheet', () => ({
  __esModule: true,
  default: function ImportSheetStub({ onClose }: { onClose: () => void }) {
    const { useRegistrarSheet: useRegistrar } = require('@/components/hub/registrar/abrir')
    const registrar = useRegistrar()
    return (
      <section role="dialog" aria-label="Importar arquivo">
        <button type="button" onClick={() => registrar.open({ accountId: 'conta-nova' })}>
          Registrar operação
        </button>
        <button type="button" onClick={onClose}>
          Fechar importação
        </button>
      </section>
    )
  },
}))

jest.mock('@/components/hub/registrar/RegistrarSheet', () => {
  return {
    __esModule: true,
    default: function RegistrarSheetStub({ accountId, tradeId, onClose }: { accountId: string | null; tradeId: string | null; onClose: (o?: { focusId?: string }) => void }) {
      return (
        <section role="dialog" aria-label="Registrar operação">
          <p>
            conta {accountId ?? '—'} · operação {tradeId ?? '—'}
          </p>
          <button type="button" onClick={() => onClose()}>
            Fechar
          </button>
          <button type="button" onClick={() => onClose({ focusId: OPERACOES_DO_DIA_ID })}>
            Ver no Diário
          </button>
        </section>
      )
    },
  }
})

function Page() {
  const registrar = useRegistrarSheet()
  const importar = useImportSheet()
  const [flags, setFlags] = useState('')
  return (
    <div>
      <h1 tabIndex={-1}>Diário</h1>
      <button type="button" onClick={(e) => registrar.open({ accountId: 'top-one', opener: e.currentTarget })}>
        Abrir Registrar
      </button>
      <button type="button" onClick={(e) => registrar.open({ accountId: 'top-one', tradeId: 'mes-1', opener: e.currentTarget })}>
        Registrar saída
      </button>
      <button type="button" onClick={(e) => importar.open({ mode: 'adicionar', opener: e.currentTarget })}>
        + Adicionar conta
      </button>
      <h2 id={OPERACOES_DO_DIA_ID} tabIndex={-1}>
        Operações do dia
      </h2>
      <button type="button" onClick={() => setFlags(`${importar.isOpen}/${registrar.isOpen}`)}>
        flags
      </button>
      <span data-testid="flags">{flags}</span>
    </div>
  )
}

function renderPage() {
  return render(
    <ImportSheetProvider>
      <Page />
    </ImportSheetProvider>,
  )
}

describe('«Registrar operação» in the hub’s sheet provider', () => {
  it('opens on an account (and a trade), hides and freezes the page, and gives focus back on close', () => {
    const { container } = renderPage()
    const opener = screen.getByRole('button', { name: 'Registrar saída' })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByText('conta top-one · operação mes-1')).toBeInTheDocument()
    const page = container.querySelector('.hub-fundo-pagina') as HTMLElement
    expect(page).toHaveAttribute('inert')
    expect(page).toHaveAttribute('aria-hidden', 'true')
    expect(document.documentElement.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Registrar operação' })).not.toBeInTheDocument()
    expect(page).not.toHaveAttribute('inert')
    expect(document.activeElement).toBe(opener)
  })

  it('«Ver no Diário» closes on «Operações do dia»', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Registrar' }))
    expect(screen.getByText('conta top-one · operação —')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Operações do dia' }))
  })

  it('one sheet at a time: the import’s end screen hands over to Registrar, and focus returns to the first opener', () => {
    renderPage()
    const add = screen.getByRole('button', { name: '+ Adicionar conta' })
    add.focus()
    fireEvent.click(add)
    expect(screen.getByRole('dialog', { name: 'Importar arquivo' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
    expect(screen.queryByRole('dialog', { name: 'Importar arquivo' })).not.toBeInTheDocument()
    expect(screen.getByText('conta conta-nova · operação —')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(document.activeElement).toBe(add)
  })

  it('tells which sheet is on screen', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'flags' }))
    expect(screen.getByTestId('flags')).toHaveTextContent('false/false')
  })
})

describe('the placeholder sheet of the shared base', () => {
  it('is a labelled modal dialog that closes with Escape and «Fechar»', () => {
    const onClose = jest.fn()
    const RealRegistrarSheet = jest.requireActual('@/components/hub/registrar/RegistrarSheet').default
    render(<RealRegistrarSheet accountId="top-one" tradeId={null} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Registrar operação' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

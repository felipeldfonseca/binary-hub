import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import SuasContas from '@/components/hub/contas/SuasContas'
import PersonalizarPage from '@/app/(hub)/personalizar/page'
import { makeAccount, makeBatch, renderHub } from '@/testing/hubHarness'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchActivity: jest.fn(),
  fetchImportFormats: jest.fn(),
  fetchBatches: jest.fn(),
  updateAccount: jest.fn(),
  setPrimary: jest.fn(),
  importUndo: jest.fn(),
  importFixTz: jest.fn(),
}))

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchActivity = data.fetchActivity as jest.MockedFunction<typeof data.fetchActivity>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const fetchBatches = data.fetchBatches as jest.MockedFunction<typeof data.fetchBatches>
const updateAccount = data.updateAccount as jest.MockedFunction<typeof data.updateAccount>
const setPrimary = data.setPrimary as jest.MockedFunction<typeof data.setPrimary>
const importUndo = data.importUndo as jest.MockedFunction<typeof data.importUndo>
const importFixTz = data.importFixTz as jest.MockedFunction<typeof data.importFixTz>

const topOne = makeAccount({ label: 'Top One #1', market: 'futures', platform: 'topone', phase: null, size: 50000 })
const ebinex = makeAccount({ label: 'Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })
const apex = makeAccount({ label: 'Apex A', market: 'futures', platform: 'rithmic', firm: 'Apex', phase: 'avaliacao', sort_order: 2 })
const closed = makeAccount({ label: 'Velha', market: 'futures', archived_at: '2026-09-03T12:00:00Z' })
const example = makeAccount({ label: 'Exemplo', is_example: true })

const fixTz = (over: Partial<data.FixTzResult> = {}): data.FixTzResult => ({
  rows: 0,
  changed: 0,
  day_changes: 0,
  shifts: [],
  untouched_with_offset: 0,
  dry_run: true,
  tz: 'America/Sao_Paulo',
  ...over,
})

beforeEach(() => {
  for (const mock of [fetchAccounts, fetchActivity, fetchImportFormats, fetchBatches, updateAccount, setPrimary, importUndo, importFixTz]) {
    mock.mockReset()
  }
  fetchAccounts.mockResolvedValue([topOne, ebinex, apex, closed, example])
  fetchActivity.mockResolvedValue({
    [topOne.id]: { total: 17, imported: 17 },
    [ebinex.id]: { total: 612, imported: 612 },
    [apex.id]: { total: 0, imported: 0 },
  })
  fetchImportFormats.mockResolvedValue({})
  updateAccount.mockResolvedValue(undefined)
  setPrimary.mockResolvedValue(undefined)
})

/** The row's parts, joined the way the screen shows them (the " · " comes from CSS) */
const parts = (el: Element) => Array.from(el.querySelectorAll('.hub-partes > span')).map((s) => s.textContent).join(' · ')

const row = async (label: string) => (await screen.findByText(label, { selector: '.hub-conta__cab strong' })).closest('li') as HTMLElement

async function openMenu(label: string) {
  const li = await row(label)
  await userEvent.click(within(li).getByRole('button', { name: `Mais ações: ${label}` }))
  return within(li).getByRole('group', { name: `Ações de ${label}` })
}

describe('Personalizar page', () => {
  it('shows only Suas contas in Phase 1, and says the rest comes later', async () => {
    renderHub(<PersonalizarPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Personalizar' })).toBeInTheDocument()
    expect(screen.getByText('Ajuste o Binary Hub às suas contas e ao que você opera.')).toBeInTheDocument()
    expect(screen.getByText('O resto do Personalizar chega na Fase 2.')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Suas contas'])
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument()
    await row('Ebinex')
  })
})

describe('Suas contas', () => {
  it('shows the card with its heading, note and info', async () => {
    renderHub(<SuasContas />)

    expect(screen.getByRole('region', { name: 'Suas contas' })).toHaveAttribute('id', 'contas')
    expect(screen.getByText('Cada conta é de um mercado só e tem as suas regras.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Suas contas' }))
    expect(screen.getByText(/^Uma linha por conta\./)).toBeInTheDocument()
    expect(screen.getByText('Futuros e binárias nunca são somados.')).toBeInTheDocument()
  })

  it('groups active accounts by market, never showing example ones', async () => {
    renderHub(<SuasContas />)

    await row('Top One #1')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Futuros', 'Opções binárias'])
    const futures = screen.getByRole('list', { name: 'Futuros' })
    expect(within(futures).getAllByRole('listitem').map((li) => li.querySelector('strong')?.textContent)).toEqual(['Top One #1', 'Apex A'])
    expect(screen.queryByText('Exemplo')).not.toBeInTheDocument()
    expect(screen.queryByText('Velha')).not.toBeInTheDocument()
  })

  it('describes each account: phase · mesa · platform · activity', async () => {
    renderHub(<SuasContas />)

    const ebinexRow = await row('Ebinex')
    await waitFor(() => expect(parts(ebinexRow)).toBe('Pessoal · Ebinex · só histórico importado'))
    expect(parts(await row('Apex A'))).toBe('Avaliação · Apex · Rithmic · sem operações')
    expect(parts(await row('Top One #1'))).toBe('Top One · só histórico importado')
  })

  it('opens the import sheet for an account, from its row', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await row('Apex A')).getByRole('button', { name: 'Importar arquivo para Apex A' }))

    const dialog = screen.getByRole('dialog', { name: 'Importar arquivo' })
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Apex A' })).toBeInTheDocument()
  })

  it('has the Phase 1 menu: import, edit, imports, archive', async () => {
    renderHub(<SuasContas />)

    const menu = await openMenu('Apex A')

    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Importar arquivo',
      'Editar conta',
      'Importações',
      'Arquivar',
    ])
  })

  it('archives at once, and undoes it from the toast', async () => {
    renderHub(<SuasContas />)

    const menu = await openMenu('Ebinex')
    await userEvent.click(within(menu).getByRole('button', { name: 'Arquivar' }))

    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), ebinex.id, { archived_at: expect.any(String), is_primary: false })
    const undo = await screen.findByRole('button', { name: 'Desfazer: Ebinex arquivada: o histórico fica guardado.' })
    expect(undo).toHaveFocus()

    await userEvent.click(undo)

    // It was the primary account and no other one took its place
    expect(updateAccount).toHaveBeenLastCalledWith(expect.anything(), ebinex.id, { archived_at: null, is_primary: true })
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Suas contas' })).toHaveFocus())
    expect(screen.queryByText(/arquivada: o histórico fica guardado/)).not.toBeInTheDocument()
  })

  it('lists closed accounts and reactivates them', async () => {
    renderHub(<SuasContas />)

    const toggle = await screen.findByRole('button', { name: 'Encerradas (1)' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)

    const list = document.getElementById('lista-encerradas') as HTMLElement
    expect(within(list).getByText('Velha')).toBeInTheDocument()
    expect(within(list).getByText(/^Arquivada em 3 set/)).toBeInTheDocument()
    expect(within(list).getByText('histórico mantido')).toBeInTheDocument()
    await userEvent.click(within(list).getByRole('button', { name: 'Reativar Velha' }))

    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), closed.id, { archived_at: null })
    expect(toggle).toHaveFocus()
  })

  it('says so when no account is closed', async () => {
    fetchAccounts.mockResolvedValue([topOne])
    renderHub(<SuasContas />)

    await userEvent.click(await screen.findByRole('button', { name: 'Encerradas (0)' }))

    expect(screen.getByText('Nenhuma. Arquivar guarda o histórico e pode ser desfeito.')).toBeInTheDocument()
  })

  it('shows the empty state with no active account', async () => {
    fetchAccounts.mockResolvedValue([closed, example])
    renderHub(<SuasContas />)

    expect(await screen.findByText('Traga o histórico da sua corretora.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar arquivo' })).toHaveClass('hub-btn--pri')
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar conta' }))
    expect(screen.getByRole('dialog', { name: 'Adicionar conta' })).toBeInTheDocument()
  })

  it('adds an account from the footer', async () => {
    renderHub(<SuasContas />)
    await row('Ebinex')

    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar conta' }))

    expect(screen.getByRole('dialog', { name: 'Adicionar conta' })).toBeInTheDocument()
  })

  it('maps a failed action to its own copy, without the database text', async () => {
    updateAccount.mockRejectedValue({ code: '23505', message: 'violates "trading_accounts_one_primary"', details: 'Key (user_id)=(user-1)' })
    renderHub(<SuasContas />)

    const menu = await openMenu('Apex A')
    await userEvent.click(within(menu).getByRole('button', { name: 'Arquivar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outra conta já é a principal. Tente de novo.')
    expect(document.body).not.toHaveTextContent('user-1')
  })
})

describe('Editar conta', () => {
  it('renames the account and saves only what changed', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form', { name: 'Editar Top One #1' })
    const label = within(form).getByLabelText('Apelido')
    expect(label).toHaveFocus()
    expect(within(form).getByLabelText(/Tamanho US\$/)).toHaveValue('50.000')

    await userEvent.clear(label)
    await userEvent.type(label, 'Top One')
    await userEvent.click(within(form).getByRole('button', { name: 'Financiada' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), topOne.id, { label: 'Top One', phase: 'financiada' })
    expect(importFixTz).not.toHaveBeenCalled()
    expect(await screen.findByText('Top One salva.')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mais ações: Top One #1' })).toHaveFocus()
  })

  it('checks the nickname and the size before saving', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    const label = within(form).getByLabelText('Apelido')

    await userEvent.clear(label)
    await userEvent.type(label, 'APEX A')
    expect(within(form).getByRole('alert')).toHaveTextContent('Já existe uma conta com esse apelido.')
    expect(label).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(label)
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Dê um apelido.')

    await userEvent.type(label, 'Top One')
    const size = within(form).getByLabelText(/Tamanho US\$/)
    await userEvent.clear(size)
    await userEvent.type(size, '50,000.00')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Use só números, como 50.000.')
    expect(size).toHaveFocus()
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('makes an account the primary one, clearing the old primary', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    await userEvent.click(within(form).getByRole('checkbox', { name: 'Conta principal' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(setPrimary).toHaveBeenCalledWith(expect.anything(), apex.id, ebinex.id)
  })

  it('counts what a zone change moves, and applies it only on "Confirmar fuso"', async () => {
    importFixTz
      .mockResolvedValueOnce(fixTz({ rows: 612, changed: 612, day_changes: 98, shifts: ['03:00:00'] }))
      .mockResolvedValueOnce(fixTz({ rows: 612, changed: 612, day_changes: 98, shifts: ['03:00:00'], dry_run: false }))
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Ebinex')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    // Never confirmed: the field starts empty and says so
    const zone = within(form).getByLabelText('Fuso do arquivo')
    expect(zone).toHaveValue('')
    expect(zone).toHaveAccessibleDescription('A confirmar. Escolha o fuso que a plataforma usa nos arquivos.')
    await userEvent.selectOptions(zone, 'Brasília')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(importFixTz).toHaveBeenCalledWith(expect.anything(), ebinex.id, 'America/Sao_Paulo', true)
    expect(await within(form).findByText('612 operações mudam de horário (+3 h) e 98 mudam de dia.')).toBeInTheDocument()
    const confirm = within(form).getByRole('button', { name: 'Confirmar fuso' })
    expect(confirm).toHaveFocus()
    expect(importFixTz).toHaveBeenCalledTimes(1)

    await userEvent.click(confirm)

    expect(importFixTz).toHaveBeenLastCalledWith(expect.anything(), ebinex.id, 'America/Sao_Paulo', false)
    expect(await screen.findByText('Ebinex salva. Fuso confirmado: Brasília.')).toBeInTheDocument()
  })

  it('leaves the zone alone when the count is not confirmed', async () => {
    importFixTz.mockResolvedValueOnce(fixTz({ rows: 17, changed: 17, day_changes: 0, shifts: ['-05:00:00'] }))
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    await userEvent.selectOptions(within(form).getByLabelText('Fuso do arquivo'), 'Nova York (ET)')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByText('17 operações mudam de horário (−5 h).')).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Cancelar' }))

    expect(importFixTz).toHaveBeenCalledTimes(1)
    expect(within(form).getByLabelText('Fuso do arquivo')).toHaveValue('')
  })

  it('just saves the zone of an account with no trade on the file’s clock', async () => {
    importFixTz.mockResolvedValueOnce(fixTz({ rows: 0 })).mockResolvedValueOnce(fixTz({ rows: 0, dry_run: false }))
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    await userEvent.selectOptions(within(form).getByLabelText('Fuso do arquivo'), 'Chicago (CT)')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Apex A salva. Fuso confirmado: Chicago (CT).')).toBeInTheDocument()
    expect(importFixTz).toHaveBeenNthCalledWith(1, expect.anything(), apex.id, 'America/Chicago', true)
    expect(importFixTz).toHaveBeenNthCalledWith(2, expect.anything(), apex.id, 'America/Chicago', false)
  })

  it('closes with Cancelar, giving focus back to "⋯"', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Editar conta' }))
    await userEvent.click(within(screen.getByRole('form')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações: Apex A' })).toHaveFocus())
  })
})

describe('Importações', () => {
  it('lists the batches, the old history without undo, and undoes one after saying what it deletes', async () => {
    fetchBatches.mockResolvedValue([
      makeBatch({ id: 'b-new', file_name: 'operacoes_out.csv', rows_inserted: 5, rows_duplicate: 2, rows_error: 1, created_at: '2026-10-15T17:32:00Z' }),
      makeBatch({ id: 'b-old', file_name: 'operacoes_set.csv', status: 'undone', undone_at: '2026-10-02T10:00:00Z' }),
      makeBatch({ id: 'b-legacy', is_legacy: true, file_name: null, rows_inserted: 612 }),
    ])
    importUndo.mockResolvedValue({ deleted: 5 })
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Ebinex')).getByRole('button', { name: 'Importações' }))

    const panel = screen.getByRole('group', { name: 'Importações de Ebinex' })
    const items = await within(panel).findAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/operacoes_out\.csv/)
    expect(parts(items[0])).toBe('5 novas · 2 já estavam · 1 com erro')
    expect(items[1]).toHaveTextContent('Desfeita em 2 out')
    expect(within(items[1]).queryByRole('button')).not.toBeInTheDocument()
    expect(items[2]).toHaveTextContent('Histórico anterior')
    expect(parts(items[2])).toBe('612 operações · não dá para desfazer')
    expect(within(items[2]).queryByRole('button')).not.toBeInTheDocument()

    await userEvent.click(within(items[0]).getByRole('button', { name: /^Desfazer a importação de 15 out/ }))
    expect(within(items[0]).getByText('Desfazer apaga as 5 operações desta importação.')).toBeInTheDocument()
    expect(within(items[0]).getByRole('button', { name: 'Manter' })).toHaveFocus()
    expect(importUndo).not.toHaveBeenCalled()

    await userEvent.click(within(items[0]).getByRole('button', { name: 'Desfazer e apagar' }))

    expect(importUndo).toHaveBeenCalledWith(expect.anything(), 'b-new')
    expect(await within(panel).findByText('Importação desfeita: 5 operações apagadas.')).toBeInTheDocument()
  })

  it('keeps the batch when the owner says "Manter"', async () => {
    fetchBatches.mockResolvedValue([makeBatch({ id: 'b1', rows_inserted: 1 })])
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Importações' }))
    const panel = screen.getByRole('group', { name: 'Importações de Top One #1' })
    await userEvent.click(await within(panel).findByRole('button', { name: /^Desfazer a importação/ }))
    expect(within(panel).getByText('Desfazer apaga a operação desta importação.')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Manter' }))

    expect(importUndo).not.toHaveBeenCalled()
    expect(within(panel).getByRole('button', { name: /^Desfazer a importação/ })).toHaveFocus()
  })

  it('says when the account has no import', async () => {
    fetchBatches.mockResolvedValueOnce([])
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Importações' }))
    expect(await screen.findByText('Nenhuma importação nesta conta.')).toBeInTheDocument()
  })

  it('maps a refused undo to its own copy', async () => {
    fetchBatches.mockResolvedValue([makeBatch({ id: 'b1' })])
    importUndo.mockRejectedValue({ code: '22023', message: 'already_undone' })
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Importações' }))
    const panel = screen.getByRole('group', { name: 'Importações de Top One #1' })
    await userEvent.click(await within(panel).findByRole('button', { name: /^Desfazer a importação/ }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Desfazer e apagar' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Esta importação já foi desfeita.')
  })
})

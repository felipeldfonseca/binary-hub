import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import SuasContas from '@/components/hub/contas/SuasContas'
import HubRoot from '@/components/hub/HubRoot'
import PersonalizarPagina from '@/components/hub/personalizar/PersonalizarPagina'
import type { RulesConfig } from '@/lib/hub/regras'
import { firmNames } from '@/lib/hub/mesas'
import { makeAccount, makeBatch, renderHub } from '@/testing/hubHarness'
import { configAntes, configDepois, idsDono } from '@/testing/regras'

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
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
  setPrimary: jest.fn(),
  importUndo: jest.fn(),
  importFixTz: jest.fn(),
}))

// Phase 2: the rule parts of a row and «Editar regras» (Personalizar's clock is fixed)
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  fetchTradesSince: jest.fn(),
  saveRules: jest.fn(),
}))
const mockAgora = new Date('2026-10-19T16:00:00Z')
jest.mock('@/hooks/useAgora', () => ({ useAgora: () => mockAgora }))

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const fetchTradesSince = regrasDb.fetchTradesSince as jest.MockedFunction<typeof regrasDb.fetchTradesSince>
const fetchActivity = data.fetchActivity as jest.MockedFunction<typeof data.fetchActivity>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const fetchBatches = data.fetchBatches as jest.MockedFunction<typeof data.fetchBatches>
const createAccount = data.createAccount as jest.MockedFunction<typeof data.createAccount>
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
  for (const mock of [
    fetchAccounts,
    fetchActivity,
    fetchImportFormats,
    fetchBatches,
    createAccount,
    updateAccount,
    setPrimary,
    importUndo,
    importFixTz,
    fetchRulesConfig,
    fetchTradesSince,
  ]) {
    mock.mockReset()
  }
  // The Phase 1 rows: no rules read (the Phase 2 block below gives them)
  fetchRulesConfig.mockRejectedValue(new regrasDb.RegrasDataError('network'))
  fetchTradesSince.mockResolvedValue({})
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

describe('Suas contas', () => {
  it('shows the card with its heading, note and info', async () => {
    renderHub(<SuasContas />)

    expect(screen.getByRole('region', { name: 'Suas contas' })).toHaveAttribute('id', 'contas')
    expect(screen.getByText('Cada conta é de um mercado só e tem as suas regras.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Suas contas' }))
    expect(screen.getByText(/^Uma linha por conta\./)).toBeInTheDocument()
    expect(screen.getByText('Contas de mercados diferentes nunca são somadas.')).toBeInTheDocument()
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

  it('describes each account as the board does: phase · platform · activity', async () => {
    renderHub(<SuasContas />)

    const ebinexRow = await row('Ebinex')
    await waitFor(() => expect(parts(ebinexRow)).toBe('Pessoal · Ebinex · só histórico importado'))
    // The mesa (Apex) is not on the row
    expect(parts(await row('Apex A'))).toBe('Avaliação · Rithmic · sem operações')
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

  it('brings an archived primary back without the mark when another account became the primary meanwhile', async () => {
    const only = makeAccount({ label: 'Única', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })
    const added = makeAccount({ label: 'Nova', market: 'futures', platform: 'rithmic', is_primary: true })
    fetchAccounts.mockResolvedValue([only])
    renderHub(<SuasContas />)

    const menu = await openMenu('Única')
    // Once it is archived, another account is added and, being the only active one, becomes the primary
    fetchAccounts.mockResolvedValue([{ ...only, archived_at: '2026-10-17T12:00:00Z', is_primary: false }, added])
    await userEvent.click(within(menu).getByRole('button', { name: 'Arquivar' }))
    await row('Nova')

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer: Única arquivada: o histórico fica guardado.' }))

    expect(updateAccount).toHaveBeenLastCalledWith(expect.anything(), only.id, { archived_at: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('retries the undo without the primary mark when the database says another account has it', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Ebinex')).getByRole('button', { name: 'Arquivar' }))
    updateAccount.mockRejectedValueOnce({ code: '23505', message: 'violates "trading_accounts_one_primary"' })
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer: Ebinex arquivada: o histórico fica guardado.' }))

    await waitFor(() => expect(updateAccount).toHaveBeenLastCalledWith(expect.anything(), ebinex.id, { archived_at: null }))
    expect(updateAccount).toHaveBeenNthCalledWith(2, expect.anything(), ebinex.id, { archived_at: null, is_primary: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Suas contas' })).toHaveFocus())
  })

  it('gives focus to "Suas contas" when the button that opened the sheet is gone', async () => {
    fetchAccounts.mockResolvedValue([closed])
    const created = makeAccount({ label: 'Ebx', market: 'binary', platform: 'pocket', phase: 'pessoal', is_primary: true })
    createAccount.mockImplementation(async () => {
      fetchAccounts.mockResolvedValue([closed, created])
      return created
    })
    renderHub(<SuasContas />)

    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar conta' }))
    const dialog = screen.getByRole('dialog', { name: 'Adicionar conta' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Ebx')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Ebx' }))
    await within(dialog).findByRole('heading', { name: 'Ebx criada.' })
    // The list now has the account: the empty state with its button is gone
    await row('Ebx')
    expect(screen.queryByText('Traga o histórico da sua corretora.')).not.toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Suas contas' })).toHaveFocus()
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

  it('never cuts a long nickname: the field takes 24 characters and a longer change is not saved', async () => {
    // Accounts from the old data can have longer names
    const long = makeAccount({ label: 'Conta Futuros Principal Apex', market: 'futures', platform: 'rithmic' })
    fetchAccounts.mockResolvedValue([long])
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu(long.label)).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    const label = within(form).getByLabelText('Apelido')
    expect(label).toHaveAttribute('maxLength', '24')
    expect(label).toHaveValue('Conta Futuros Principal Apex')

    await userEvent.type(label, '{Backspace}')
    expect(within(form).getByRole('alert')).toHaveTextContent('Use no máximo 24 caracteres.')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(label).toHaveFocus()
    expect(updateAccount).not.toHaveBeenCalled()
    expect(screen.getByRole('form')).toBeInTheDocument()
  })

  it('saves the other fields of an account whose long nickname stays as it is', async () => {
    const long = makeAccount({ label: 'Conta Futuros Principal Apex', market: 'futures', platform: 'rithmic' })
    fetchAccounts.mockResolvedValue([long])
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu(long.label)).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    await userEvent.click(within(form).getByRole('button', { name: 'Financiada' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), long.id, { phase: 'financiada' })
  })

  it('suggests the firms of the account’s market for «Mesa», alphabetically, and saves the one chosen', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form', { name: 'Editar Top One #1' })
    const firm = within(form).getByLabelText(/^Mesa/)
    expect(firm).toHaveValue('')
    const datalist = document.getElementById(firm.getAttribute('list') ?? '') as HTMLDataListElement
    expect(form).toContainElement(datalist)
    const options = Array.from(datalist.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(firmNames('futures'))
    expect(options).toHaveLength(25)
    expect(options).toEqual(expect.arrayContaining(['Apex Trader Funding', 'Top One Futures', 'Ylos Trading']))

    await userEvent.type(firm, 'Top One Futures')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), topOne.id, { firm: 'Top One Futures' })
  })

  it('saves a firm outside the list as typed, and an empty «Mesa» as none', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Editar conta' }))
    let form = screen.getByRole('form', { name: 'Editar Apex A' })
    const firm = within(form).getByLabelText(/^Mesa/)
    expect(firm).toHaveValue('Apex')
    await userEvent.clear(firm)
    await userEvent.type(firm, 'Mesa Alfa')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(updateAccount).toHaveBeenLastCalledWith(expect.anything(), apex.id, { firm: 'Mesa Alfa' })

    await screen.findByText('Apex A salva.')
    await userEvent.click(within(await openMenu('Apex A')).getByRole('button', { name: 'Editar conta' }))
    form = screen.getByRole('form', { name: 'Editar Apex A' })
    await userEvent.clear(within(form).getByLabelText(/^Mesa/))
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(updateAccount).toHaveBeenLastCalledWith(expect.anything(), apex.id, { firm: null })
  })

  it('has no «Mesa» on a binary account', async () => {
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Ebinex')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form', { name: 'Editar Ebinex' })
    expect(within(form).queryByLabelText(/^Mesa/)).not.toBeInTheDocument()
    expect(form.querySelector('datalist')).toBeNull()
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

  it('counts and confirms the current guess too, since a guess is not a confirmed zone', async () => {
    importFixTz
      .mockResolvedValueOnce(fixTz({ rows: 17, changed: 0, tz: 'UTC' }))
      .mockResolvedValueOnce(fixTz({ rows: 17, changed: 0, tz: 'UTC', dry_run: false }))
    renderHub(<SuasContas />)

    // Top One #1 is still on the database's default guess, UTC
    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    await userEvent.selectOptions(within(form).getByLabelText('Fuso do arquivo'), 'UTC')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(importFixTz).toHaveBeenCalledWith(expect.anything(), topOne.id, 'UTC', true)
    expect(await within(form).findByText('Nenhuma operação muda de horário.')).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Confirmar fuso' }))

    expect(importFixTz).toHaveBeenLastCalledWith(expect.anything(), topOne.id, 'UTC', false)
    expect(await screen.findByText('Top One #1 salva. Fuso confirmado: UTC.')).toBeInTheDocument()
  })

  it('keeps the fields already saved when the zone count is cancelled', async () => {
    importFixTz.mockResolvedValueOnce(fixTz({ rows: 17, changed: 17, shifts: ['-05:00:00'] }))
    renderHub(<SuasContas />)

    await userEvent.click(within(await openMenu('Top One #1')).getByRole('button', { name: 'Editar conta' }))
    const form = screen.getByRole('form')
    const label = within(form).getByLabelText('Apelido')
    await userEvent.clear(label)
    await userEvent.type(label, 'Top One')
    await userEvent.selectOptions(within(form).getByLabelText('Fuso do arquivo'), 'Nova York (ET)')
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByText('17 operações mudam de horário (−5 h).')).toBeInTheDocument()
    expect(updateAccount).toHaveBeenCalledWith(expect.anything(), topOne.id, { label: 'Top One' })
    await userEvent.click(within(form).getByRole('button', { name: 'Cancelar' }))

    // The nickname was saved before the count; only the zone is left as it was
    expect(await screen.findByText('Top One salva.')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(importFixTz).toHaveBeenCalledTimes(1)
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

describe('Suas contas · the rules of each account (Phase 2)', () => {
  const ids = idsDono()
  const topOneDono = makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures', platform: 'topone', phase: 'financiada' })
  const ebinexDono = makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })

  beforeEach(() => {
    fetchAccounts.mockResolvedValue([topOneDono, ebinexDono])
    fetchActivity.mockResolvedValue({
      [ids.topOne]: { total: 312, imported: 309 },
      [ids.ebinex]: { total: 317, imported: 317 },
    })
    fetchRulesConfig.mockResolvedValue(configDepois())
    fetchTradesSince.mockResolvedValue({ [ids.topOne]: 3, [ids.ebinex]: 0 })
  })

  it('adds the window, since when the rules count and the trades since then (board itemConta)', async () => {
    renderHub(<SuasContas />)

    const top = await row('Top One #1')
    await waitFor(() => expect(parts(top)).toBe('Financiada · Top One · 10:00–11:00 ET · regras desde 17 out · 3 op. desde então'))
    expect(parts(await row('Ebinex'))).toBe('Pessoal · Ebinex · 20:00–21:00 de Brasília · regras desde 17 out · 0 op. desde então')
    // Times are mono
    expect(within(top).getByText('10:00–11:00')).toHaveClass('hub-rc-num')
    // Counted since each account's v1
    const since = configDepois().accounts[0].versions[0].effectiveFrom
    expect(fetchTradesSince).toHaveBeenCalledWith(expect.anything(), [
      { accountId: ids.topOne, since },
      { accountId: ids.ebinex, since },
    ])
  })

  it('an own window, and v2 and later', async () => {
    const c = configDepois()
    const top = c.accounts[0]
    const v1 = top.versions[0]
    const changed: RulesConfig = {
      ...c,
      accounts: [
        {
          ...top,
          current: { ...top.current, windows: [{ tz: 'America/New_York', startMin: 570, endMin: 660, weekdays: 31 }], windowsFrom: 'account' },
          versions: [v1, { ...v1, id: 'v2', versionNo: 2, effectiveDay: '2026-10-21' }],
        },
        c.accounts[1],
      ],
    }
    fetchRulesConfig.mockResolvedValue(changed)
    renderHub(<SuasContas />)

    await waitFor(async () =>
      expect(parts(await row('Top One #1'))).toBe('Financiada · Top One · 09:30–11:00 ET (própria) · regras desde 17 out · v2 · 3 op. desde então'),
    )
  })

  it('before any save: «sem janela», «sem regras salvas» and Phase 1’s activity', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    renderHub(<SuasContas />)

    await waitFor(async () => expect(parts(await row('Top One #1'))).toBe('Financiada · Top One · sem janela · sem regras salvas · só histórico importado'))
    expect(parts(await row('Ebinex'))).toBe('Pessoal · Ebinex · sem janela · sem regras salvas · só histórico importado')
    // No version, nothing to count
    expect(fetchTradesSince).not.toHaveBeenCalled()
  })

  it('keeps the Phase 1 parts while the counts load, and when they or the rules fail', async () => {
    let finish!: (value: Record<string, number>) => void
    fetchTradesSince.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const view = renderHub(<SuasContas />)

    const top = await row('Top One #1')
    await waitFor(() => expect(fetchTradesSince).toHaveBeenCalled())
    expect(parts(top)).toBe('Financiada · Top One · só histórico importado')
    finish({ [ids.topOne]: 3, [ids.ebinex]: 0 })
    await waitFor(() => expect(parts(top)).toBe('Financiada · Top One · 10:00–11:00 ET · regras desde 17 out · 3 op. desde então'))
    view.unmount()

    fetchTradesSince.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const failed = renderHub(<SuasContas />)
    await waitFor(() => expect(fetchTradesSince).toHaveBeenCalledTimes(2))
    expect(parts(await row('Top One #1'))).toBe('Financiada · Top One · só histórico importado')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    failed.unmount()

    fetchRulesConfig.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    renderHub(<SuasContas />)
    await waitFor(() => expect(fetchRulesConfig).toHaveBeenCalledTimes(3))
    expect(parts(await row('Ebinex'))).toBe('Pessoal · Ebinex · só histórico importado')
  })

  it('«Editar regras» (on Personalizar) closes the menu, picks the account in «Regras de» and focuses «Suas regras»', async () => {
    renderHub(
      <HubRoot>
        <PersonalizarPagina>
          <h1 tabIndex={-1}>Personalizar</h1>
        </PersonalizarPagina>
      </HubRoot>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Como fica hoje' })

    const menu = await openMenu('Ebinex')
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Importar arquivo',
      'Editar conta',
      'Importações',
      'Editar regras',
      'Arquivar',
    ])
    await userEvent.click(within(menu).getByRole('button', { name: 'Editar regras' }))

    expect(screen.queryByRole('group', { name: 'Ações de Ebinex' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: 'Ebinex' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Suas regras' })).toHaveFocus())
  })

  it('offers «Editar regras» only for an account «Suas regras» lists (futures and binary)', async () => {
    const forex = makeAccount({ label: 'Forex antiga', market: 'forex', platform: null, phase: 'pessoal', sort_order: 5 })
    fetchAccounts.mockResolvedValue([topOneDono, ebinexDono, forex])
    renderHub(
      <HubRoot>
        <PersonalizarPagina>
          <h1 tabIndex={-1}>Personalizar</h1>
        </PersonalizarPagina>
      </HubRoot>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Como fica hoje' })

    const menu = await openMenu('Forex antiga')
    expect(within(menu).queryByRole('button', { name: 'Editar regras' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Arquivar' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(within(await openMenu('Ebinex')).getByRole('button', { name: 'Editar regras' })).toBeInTheDocument()
  })

  it('counts trades only for active accounts: archived and example ones with versions are left out', async () => {
    const c = configDepois()
    const [top, ebx] = c.accounts
    fetchRulesConfig.mockResolvedValue({
      ...c,
      accounts: [top, ebx, { ...top, id: 'arquivada', label: 'Velha', archivedAt: '2026-09-03T12:00:00Z' }, { ...ebx, id: 'exemplo', label: 'Exemplo', isExample: true }],
    })
    renderHub(<SuasContas />)

    await waitFor(async () => expect(parts(await row('Top One #1'))).toBe('Financiada · Top One · 10:00–11:00 ET · regras desde 17 out · 3 op. desde então'))
    const since = top.versions[0].effectiveFrom
    expect(fetchTradesSince).toHaveBeenCalledTimes(1)
    expect(fetchTradesSince).toHaveBeenCalledWith(expect.anything(), [
      { accountId: ids.topOne, since },
      { accountId: ids.ebinex, since },
    ])
  })

  it('has no «Editar regras» outside Personalizar', async () => {
    renderHub(<SuasContas />)
    const menu = await openMenu('Ebinex')
    expect(within(menu).queryByRole('button', { name: 'Editar regras' })).not.toBeInTheDocument()
  })
})

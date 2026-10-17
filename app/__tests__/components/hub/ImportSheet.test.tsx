import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import { readImportFile } from '@/lib/domain/import'
import { useImportSheet, type SheetMode } from '@/components/hub/importar/ImportSheetProvider'
import { csvFile, fixtureFile, makeAccount, makePreview, renderHub } from '@/testing/hubHarness'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchImportFormats: jest.fn(),
  createAccount: jest.fn(),
  importPreview: jest.fn(),
  importCommit: jest.fn(),
  importUndo: jest.fn(),
  importFixTz: jest.fn(),
}))

jest.mock('@/lib/domain/import', () => ({
  ...jest.requireActual('@/lib/domain/import'),
  readImportFile: jest.fn(),
}))

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const createAccount = data.createAccount as jest.MockedFunction<typeof data.createAccount>
const importPreview = data.importPreview as jest.MockedFunction<typeof data.importPreview>
const importCommit = data.importCommit as jest.MockedFunction<typeof data.importCommit>
const importUndo = data.importUndo as jest.MockedFunction<typeof data.importUndo>
const importFixTz = data.importFixTz as jest.MockedFunction<typeof data.importFixTz>
const readFile = readImportFile as jest.MockedFunction<typeof readImportFile>

const CONFIRMED = '2026-10-01T00:00:00Z'
const topOne = makeAccount({ label: 'Top One', market: 'futures', platform: 'topone', phase: 'financiada', tz_applied_at: CONFIRMED })
const ebinex = makeAccount({ label: 'Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })

function Opener({ mode = 'importar', accountId = null }: { mode?: SheetMode; accountId?: string | null }) {
  const sheet = useImportSheet()
  return (
    <button type="button" onClick={(event) => sheet.open({ mode, accountId, opener: event.currentTarget })}>
      Abrir
    </button>
  )
}

async function openSheet(props: { mode?: SheetMode; accountId?: string | null } = {}) {
  renderHub(<Opener {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  return screen.getByRole('dialog')
}

async function chooseFile(dialog: HTMLElement, name = 'arquivo.csv') {
  // Wait for the accounts, so the sheet knows the account in context
  await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
  // The file is read asynchronously: let that settle inside act
  await act(async () => {
    fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [csvFile(name)] } })
  })
}

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
  // Queued answers (mockResolvedValueOnce) must not leak from one test into the next
  for (const mock of [fetchAccounts, fetchImportFormats, createAccount, importPreview, importCommit, importUndo, importFixTz, readFile]) {
    mock.mockReset()
  }
  fetchAccounts.mockResolvedValue([topOne, ebinex])
  fetchImportFormats.mockResolvedValue({})
})

describe('ImportSheet · import a file', () => {
  it('imports a Top One file into its confirmed account, then undoes it from the toast', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7, account_tz: 'UTC' }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })
    importUndo.mockResolvedValue({ deleted: 7 })

    const dialog = await openSheet({ accountId: topOne.id })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Importar arquivo' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('heading', { name: 'Importar histórico de Top One' })).toHaveFocus()

    await chooseFile(dialog, 'Trade-History.csv')

    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toHaveFocus()
    // The zone is confirmed on the account, so step c is skipped and the account's zone is used
    const [, args] = importPreview.mock.calls[0]
    expect(args).toMatchObject({ p_account: topOne.id, p_platform: 'topone', p_file_tz: 'UTC', p_rows_total: 7 })
    expect(args.p_rows).toHaveLength(7)
    expect(args).not.toHaveProperty('p_file_name')
    expect(within(dialog).getByText(/^Top One Futures · Trade History · 7 operações · .+ · o arquivo não diz a conta$/)).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/7 linhas ·\s*7 novas ·\s*0 já estavam ·\s*0 com erro/)
    expect(within(dialog).getByText('Fuso do arquivo: UTC · lembrado de Top One')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Passo \d de/)).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 7 operações' }))

    expect(await within(dialog).findByRole('heading', { name: 'Importação feita' })).toHaveFocus()
    expect(importCommit.mock.calls[0][1]).toMatchObject({ p_account: topOne.id, p_file_name: 'topone_ok.csv', p_file_tz: 'UTC' })
    expect(within(dialog).getByText('7 operações em Histórico importado · só resultado, à parte do Diário.')).toBeInTheDocument()
    expect(within(dialog).getByText('Desfazer depois: Personalizar › Suas contas › Importações.')).toBeInTheDocument()
    const toast = within(dialog).getAllByRole('status').find((el) => el.classList.contains('hub-toast')) as HTMLElement
    expect(toast).toHaveTextContent('7 operações em Top One.')

    await userEvent.click(within(toast).getByRole('button', { name: 'Desfazer: 7 operações em Top One.' }))

    expect(await within(dialog).findByText('Importação desfeita: nada ficou em Top One.')).toBeInTheDocument()
    expect(importUndo).toHaveBeenCalledWith(expect.anything(), 'batch-1')
    expect(within(dialog).getByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(importPreview).toHaveBeenCalledTimes(2)
    expect(within(dialog).getByRole('button', { name: 'Importar 7 operações' })).toBeInTheDocument()
  })

  it('shows notices, skipped lines with their reasons, the day changes and the commission', async () => {
    const file = fixtureFile('ebinex_atual_erros')
    readFile.mockResolvedValue(file)
    const errors = file.outcome.ok ? file.outcome.errors.map((e) => ({ line: e.line, code: e.code })) : []
    const confirmedEbinex = { ...ebinex, tz_applied_at: CONFIRMED, file_tz: 'America/Sao_Paulo' }
    fetchAccounts.mockResolvedValue([topOne, confirmedEbinex])
    importPreview.mockResolvedValue(makePreview({ new: 5, rows_total: 16, errors, day_changes: 1 }))

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(dialog).toHaveTextContent(/16 linhas ·\s*5 novas ·\s*0 já estavam ·\s*11 com erro/)
    expect(within(dialog).getByText('11 linhas com erro foram puladas.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ver linhas' }))
    expect(within(dialog).getByText('Linha 4: data inválida')).toBeInTheDocument()
    expect(within(dialog).getByText('Linha 6: ID repetido (igual à linha 2)')).toBeInTheDocument()
    expect(within(dialog).getByText('Linha 17: número inválido em Resultado')).toBeInTheDocument()
    expect(
      within(dialog).getByText('1 operação fica em outro dia que o do arquivo: o dia de binárias vira à meia-noite de Brasília.'),
    ).toBeInTheDocument()
  })

  it('explains the commission of a Top One file and the trades it completes', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 0, duplicate: 7, completable: 7, rows_total: 7, day_changes: 2 }))
    importCommit.mockResolvedValue({ batch_id: null, inserted: 0, duplicate: 7, completed: 7, other_account: 0, errors: [] })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).getByText('O arquivo traz comissões: mostramos o resultado líquido.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: comissões' }))
    expect(document.getElementById('info-com')).toHaveTextContent('Bruto +US$ 1.240,75 · comissões \u2212US$ 20,00.')
    expect(within(dialog).getByText(/^7 que já estavam ganham os campos que faltavam/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Completar 7 operações' }))

    expect(await within(dialog).findByText('7 que já estavam ganharam os campos que faltavam.')).toBeInTheDocument()
    // Nothing new: no batch, so nothing to undo
    expect(within(dialog).queryByRole('button', { name: /^Desfazer/ })).not.toBeInTheDocument()
  })

  it('takes a file dropped on the drop zone', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))

    const dialog = await openSheet({ accountId: topOne.id })
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    const zone = within(dialog).getByText('Solte para importar').closest('.hub-solte') as HTMLElement
    const file = csvFile('Trade-History.csv')
    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } })
    expect(zone).toHaveClass('hub-solte--sobre')
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    })

    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(readFile).toHaveBeenCalledWith(file)
  })

  it('reads the old Ebinex format, which carries its own offsets, without asking the zone', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_iso'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7, tz_confirmed: false }))

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).getByText('Os horários já trazem o fuso (+00:00, −03:00).')).toBeInTheDocument()
    expect(within(dialog).getByText('Perdas com valor positivo: gravamos como negativas (2).')).toBeInTheDocument()
    expect(within(dialog).getByText(/^CSV da Ebinex, formato antigo · Opções binárias · 7 operações · 12–13 ago 2025$/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/^Fuso do arquivo/)).not.toBeInTheDocument()
  })
})

describe('ImportSheet · file time zone', () => {
  it('asks the zone of an unconfirmed account, counts what moves, and imports after the confirmation', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    importPreview
      .mockResolvedValueOnce(makePreview({ tz_status: 'tz_not_confirmed', tz_confirmed: false }))
      .mockResolvedValueOnce(makePreview({ new: 12, rows_total: 12, tz_confirmed: true, account_tz: 'America/Sao_Paulo' }))
    importFixTz
      .mockResolvedValueOnce(fixTz({ rows: 612, changed: 612, day_changes: 98, shifts: ['03:00:00'], untouched_with_offset: 22 }))
      .mockResolvedValueOnce(fixTz({ rows: 612, changed: 612, day_changes: 98, shifts: ['03:00:00'], dry_run: false }))

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    expect(within(dialog).getByText('Passo 1 de 2')).toBeInTheDocument()
    const zones = within(dialog).getByRole('radiogroup')
    // The Ebinex clock is Brasília: it starts chosen
    expect(within(zones).getByRole('radio', { name: /^Brasília/ })).toBeChecked()
    const brasilia = within(zones).getByRole('radio', { name: /^Brasília/ }).closest('.hub-opcao') as HTMLElement
    expect(brasilia.querySelector('.hub-opcao__cap')).toHaveTextContent(/^entradas \d{2}:\d{2}–\d{2}:\d{2} de Brasília$/)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Confirmar fuso: Brasília' })).toHaveFocus()
    expect(importFixTz).toHaveBeenLastCalledWith(expect.anything(), ebinex.id, 'America/Sao_Paulo', true)
    expect(within(dialog).getByText('612 operações mudam de horário (+3 h) e 98 mudam de dia.')).toBeInTheDocument()
    expect(within(dialog).getByText('22 operações trazem o fuso no arquivo e não mudam.')).toBeInTheDocument()
    expect(within(dialog).getByText('Antes de importar, confirme o fuso das operações que já estão em Ebinex.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar fuso' }))

    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(importFixTz).toHaveBeenLastCalledWith(expect.anything(), ebinex.id, 'America/Sao_Paulo', false)
    expect(importPreview.mock.calls[1][1]).toMatchObject({ p_file_tz: 'America/Sao_Paulo' })
    expect(within(dialog).getByText('Fuso do arquivo: Brasília · lembrado para Ebinex')).toBeInTheDocument()
  })

  it('keeps Continuar blocked until a zone is chosen under "Outro"', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)
    await within(dialog).findByRole('radiogroup')

    await userEvent.click(within(dialog).getByRole('radio', { name: /^Outro/ }))
    const next = within(dialog).getByRole('button', { name: 'Continuar' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveAccessibleDescription('Escolha qual fuso.')
    await userEvent.click(next)
    expect(importPreview).not.toHaveBeenCalled()

    await userEvent.selectOptions(within(dialog).getByLabelText('Qual fuso?'), 'Londres')
    expect(next).not.toHaveAttribute('aria-disabled')
  })

  it('shows "Nada novo" for a file already in the account, and confirms the zone from there', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 0, duplicate: 12, rows_total: 12, tz_confirmed: false, already_imported: true }))
    importFixTz
      .mockResolvedValueOnce(fixTz({ rows: 12, changed: 12, day_changes: 2, shifts: ['03:00:00'] }))
      .mockResolvedValueOnce(fixTz({ rows: 12, changed: 12, day_changes: 2, shifts: ['03:00:00'], dry_run: false }))

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)
    await within(dialog).findByRole('radiogroup')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nada novo: as 12 operações já estão em Ebinex.' })).toHaveFocus()
    expect(within(dialog).getByText('Fuso do arquivo da Ebinex: a confirmar.')).toBeInTheDocument()
    expect(within(dialog).getByText('Sem fuso, os horários da Ebinex ficam escondidos.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar fuso' }))
    await within(dialog).findByRole('radiogroup')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar fuso' }))

    await within(dialog).findByRole('heading', { name: 'Confirmar fuso: Brasília' })
    expect(within(dialog).getByText('Passo 2 de 2')).toBeInTheDocument()
    expect(within(dialog).getByText('12 operações mudam de horário (+3 h) e 2 mudam de dia.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar fuso' }))

    expect(await within(dialog).findByRole('heading', { name: 'Fuso confirmado: Brasília' })).toHaveFocus()
    expect(within(dialog).getByText('As 12 operações da Ebinex passam a mostrar horários.')).toBeInTheDocument()
    expect(within(dialog).getByText('Vale também para os próximos arquivos desta conta.')).toBeInTheDocument()
    expect(importCommit).not.toHaveBeenCalled()
  })
})

describe('ImportSheet · accounts', () => {
  it('offers the accounts of the file’s market when the file comes into another market', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    fetchAccounts.mockResolvedValue([topOne, { ...ebinex, tz_applied_at: CONFIRMED, file_tz: 'America/Sao_Paulo' }])
    importPreview.mockResolvedValue(makePreview({ new: 12, rows_total: 12 }))

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Este arquivo é de binárias (Ebinex).' })).toHaveFocus()
    expect(within(dialog).getByText('A conta escolhida é de Futuros.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: mercado do arquivo' }))
    expect(within(dialog).getByText('Futuros e binárias nunca são somados: este arquivo não entra em Top One.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Criar conta de binárias' })).toBeInTheDocument()
    // No "Voltar" on this choice, as on the board
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar em Ebinex' }))

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1]).toMatchObject({ p_account: ebinex.id, p_platform: 'ebinex' })
  })

  it('creates a binary account for a file of the other market', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    fetchAccounts.mockResolvedValue([topOne])

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Criar conta de binárias' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de binárias' })).toHaveFocus()
    expect(within(dialog).getByText('Corretora')).toBeInTheDocument()
    expect(within(dialog).getByText('Ebinex · arquivo CSV')).toBeInTheDocument()
    expect(within(dialog).getByText('Tipo')).toBeInTheDocument()
    expect(within(dialog).queryByText('Tamanho US$')).not.toBeInTheDocument()
  })

  it('asks for the account when the sheet has none, and creates one before the zone', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    fetchAccounts.mockResolvedValue([topOne, ebinex])
    fetchImportFormats.mockResolvedValue({ [topOne.id]: ['topone'] })
    const created = makeAccount({ label: 'Apex B', market: 'futures', platform: 'topone', phase: 'financiada' })
    createAccount.mockResolvedValue(created)

    const dialog = await openSheet()
    await waitFor(() => expect(fetchImportFormats).toHaveBeenCalled())
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Para qual conta?' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Top One' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('button', { name: 'Ebinex' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Top One já recebeu este formato.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: '+ Nova conta de futuros' }))
    expect(within(dialog).getByText('Passo 1 de 4')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de futuros' })).toHaveFocus()
    expect(within(dialog).getByText('Arquivo')).toBeInTheDocument()
    expect(within(dialog).getByText('Trade History')).toBeInTheDocument()
    const create = within(dialog).getByRole('button', { name: 'Criar conta' })
    expect(create).toHaveAccessibleDescription('Dê um apelido à conta.')

    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Apex B')
    expect(within(dialog).getByRole('button', { name: 'Criar Apex B e continuar' })).toHaveAccessibleDescription('Escolha a fase.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Financiada' }))
    await userEvent.type(within(dialog).getByLabelText(/Tamanho US\$/), '50.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B e continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toBeInTheDocument()
    expect(createAccount).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      market: 'futures',
      label: 'Apex B',
      platform: 'topone',
      firm: null,
      external_ref: null,
      phase: 'financiada',
      size: '50000',
      is_primary: false,
    })
    expect(within(dialog).getByText('Passo 3 de 4')).toBeInTheDocument()
    // Top One files are in UTC
    expect(within(dialog).getByRole('radio', { name: /^UTC/ })).toBeChecked()
    // The new account cannot be created twice: Voltar goes back to the account choice
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(await within(dialog).findByRole('heading', { name: 'Para qual conta?' })).toBeInTheDocument()
  })
})

describe('ImportSheet · add an account', () => {
  it('goes market → platform → account, then offers to import its history', async () => {
    const created = makeAccount({ label: 'Apex A', market: 'futures', platform: 'rithmic', firm: 'Apex', phase: 'avaliacao' })
    createAccount.mockResolvedValue(created)

    const dialog = await openSheet({ mode: 'adicionar' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Adicionar conta' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Qual mercado?' })).toHaveFocus()
    expect(within(dialog).getByText('Passo 1 de 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription('Escolha o mercado.')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Futuros' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).getByRole('heading', { name: 'Onde você opera?' })).toHaveFocus()
    const search = within(dialog).getByRole('searchbox', { name: 'Busque mesa, corretora ou plataforma' })
    await userEvent.type(search, 'Apex')
    expect(within(dialog).getByText('Nada com esse nome na lista de plataformas.')).toBeInTheDocument()
    // "Não sei" always stays
    expect(within(dialog).getByRole('button', { name: 'Não sei' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar “Apex” como mesa' }))
    expect(within(dialog).getByText('Mesa: Apex')).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rithmic' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).getByRole('heading', { name: 'Nova conta de futuros' })).toHaveFocus()
    expect(within(dialog).getByText('Mesa e plataforma')).toBeInTheDocument()
    expect(within(dialog).getByText('Apex · Rithmic')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Apex A')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex A' }))

    expect(await within(dialog).findByRole('heading', { name: 'Apex A criada.' })).toHaveFocus()
    expect(createAccount).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ market: 'futures', platform: 'rithmic', firm: 'Apex', phase: 'avaliacao', is_primary: false }),
    )
    expect(within(dialog).getByText('Nada ainda. Importe o histórico ou registre a primeira operação.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar histórico' }))
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Importar arquivo' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Apex A' })).toHaveFocus()
  })

  it('shows a taken nickname as a field error and keeps the button blocked', async () => {
    const dialog = await openSheet({ mode: 'adicionar' })
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'top one')

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Já existe uma conta com esse apelido.')
    const create = within(dialog).getByRole('button', { name: 'Criar top one' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(create)
    expect(createAccount).not.toHaveBeenCalled()
  })
})

describe('ImportSheet · errors', () => {
  it('says why a file cannot be read and lets the owner choose another', async () => {
    readFile.mockResolvedValue({ fileName: 'x.csv', size: 10, sha256: 'ab'.repeat(32), outcome: { ok: false, error: 'unknown_format' } })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Não conseguimos ler o arquivo.' })).toHaveFocus()
    expect(within(dialog).getByText('Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escolher outro arquivo' }))
    expect(within(dialog).getByRole('heading', { name: 'Escolha outro arquivo' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
  })

  it('names the columns a file is missing', async () => {
    readFile.mockResolvedValue({
      fileName: 'x.csv',
      size: 10,
      sha256: 'ab'.repeat(32),
      outcome: { ok: false, error: 'missing_columns', platform: 'ebinex', missingColumns: ['Vela'] },
    })
    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    expect(await within(dialog).findByText('Faltam colunas: Vela.')).toBeInTheDocument()
  })

  it('maps a refusal from the import functions to its own copy', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockRejectedValue({ code: '22023', message: 'tz_mismatch', details: 'MNQM6/900000000001 at 06/03/2026 14:32:10' })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este fuso é diferente do fuso confirmado da conta.')
    expect(dialog).not.toHaveTextContent('MNQM6/900000000001')
    expect(dialog).not.toHaveTextContent('22023')
  })

  it('never shows the text of an error it does not know, which can hold the file’s values', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    importCommit.mockRejectedValue({
      code: 'XX000',
      message: 'unexpected value "MNQM6/900000000002" in row 3',
      details: 'pnl=-175.00',
    })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Importar 7 operações' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Algo deu errado. Tente de novo.')
    expect(dialog).not.toHaveTextContent('MNQM6/900000000002')
    expect(dialog).not.toHaveTextContent('-175')
    // Still on the preview, ready to try again
    expect(within(dialog).getByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
  })

  it('reports a lost connection', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockRejectedValue({ message: 'TypeError: Failed to fetch' })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.',
    )
  })
})

describe('ImportSheet · closing', () => {
  it('closes with Escape and gives focus back to the opener', async () => {
    const dialog = await openSheet({ accountId: topOne.id })
    expect(dialog).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('closes with the × button', async () => {
    const dialog = await openSheet({ accountId: topOne.id })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before closing over what the owner typed', async () => {
    const dialog = await openSheet({ mode: 'adicionar' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Futuros' }))

    await userEvent.keyboard('{Escape}')
    expect(within(dialog).getByText('Fechar sem salvar?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar aqui' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Qual mercado?' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    const prompt = within(dialog).getByRole('group', { name: 'Fechar sem salvar?' })
    await userEvent.click(within(prompt).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('keeps Tab inside the sheet', async () => {
    const dialog = await openSheet({ accountId: topOne.id })
    const close = within(dialog).getByRole('button', { name: 'Fechar' })
    const choose = within(dialog).getByRole('button', { name: 'Escolher arquivo' })

    choose.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(choose).toHaveFocus()
  })

  it('hides and freezes the page behind the sheet while it is open', async () => {
    await openSheet({ accountId: topOne.id })
    const page = screen.getByRole('button', { name: 'Abrir', hidden: true }).closest('.hub-fundo-pagina') as HTMLElement

    expect(page).toHaveAttribute('aria-hidden', 'true')
    expect(page).toHaveAttribute('inert')
    await userEvent.keyboard('{Escape}')
    expect(page).not.toHaveAttribute('aria-hidden')
    expect(page).not.toHaveAttribute('inert')
  })
})

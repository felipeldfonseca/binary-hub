import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import { readImportFile } from '@/lib/domain/import'
import { useImportSheet, type SheetMode } from '@/components/hub/importar/ImportSheetProvider'
import { EMPTY_FORM, PassoNovaConta } from '@/components/hub/importar/passos'
import { PASSO_G } from '@/components/hub/contas/copy'
import { changedOnlyHere } from '@/hooks/useRegras'
import type { AccountConfig, RulesConfig, SaveRulesResult } from '@/lib/hub/regras'
import { csvFile, fixtureFile, makeAccount, makePreview, renderHub } from '@/testing/hubHarness'
import { configAntes, configDepois, configMercados, contasMercados, idsDono, idsMercados } from '@/testing/regras'
import { brt, et } from '@/testing/gate'

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

// Phase 2: step b gives a new account its rules (v1); the device clock of its «desde» chip
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  saveRules: jest.fn(),
  fetchTradesSince: jest.fn(),
}))
const mockAgora = { at: new Date('2026-10-19T16:00:00Z'), redraws: new Set<() => void>() }
// Like the real hook, every component that reads the clock redraws when it moves (moveClock)
jest.mock('@/hooks/useAgora', () => {
  const { useEffect, useReducer } = jest.requireActual('react')
  return {
    useAgora: () => {
      const [, redraw] = useReducer((n: number) => n + 1, 0)
      useEffect(() => {
        mockAgora.redraws.add(redraw)
        return () => {
          mockAgora.redraws.delete(redraw)
        }
      }, [])
      return mockAgora.at
    },
  }
})

/** The device clock moves on: useAgora's tick, which redraws the sheet with the new time */
function moveClock(at: Date) {
  act(() => {
    mockAgora.at = at
    mockAgora.redraws.forEach((redraw) => redraw())
  })
}

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const createAccount = data.createAccount as jest.MockedFunction<typeof data.createAccount>
const importPreview = data.importPreview as jest.MockedFunction<typeof data.importPreview>
const importCommit = data.importCommit as jest.MockedFunction<typeof data.importCommit>
const importUndo = data.importUndo as jest.MockedFunction<typeof data.importUndo>
const importFixTz = data.importFixTz as jest.MockedFunction<typeof data.importFixTz>
const readFile = readImportFile as jest.MockedFunction<typeof readImportFile>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>

/** What save_rules answers for one new account's v1 */
const savedV1 = (rev: string, accountId = 'nova'): SaveRulesResult => ({
  dryRun: false,
  savedAt: new Date('2026-10-19T16:00:00Z'),
  rev,
  versions: [{ accountId, versionNo: 1, effectiveFrom: new Date('2026-10-19T16:00:00Z'), effectiveDay: '2026-10-19', origin: 'criar' }],
  unchanged: [],
})

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

async function openSheet(props: { mode?: SheetMode; accountId?: string | null } = {}, options: { strict?: boolean } = {}) {
  renderHub(<Opener {...props} />, options)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  return screen.getByRole('dialog')
}

/** A call that stays pending until the test lets it finish */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const toastOf = (dialog: HTMLElement) => dialog.querySelector('.hub-toast') as HTMLElement

/** The sheet's one live region */
const statusOf = (dialog: HTMLElement) => within(dialog).getByRole('status')

async function fillNewFuturesAccount(dialog: HTMLElement, label: string) {
  await userEvent.click(within(dialog).getByRole('button', { name: 'Futuros (EUA)' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rithmic' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
  await userEvent.type(within(dialog).getByLabelText('Apelido'), label)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
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
  for (const mock of [fetchAccounts, fetchImportFormats, createAccount, importPreview, importCommit, importUndo, importFixTz, readFile, fetchRulesConfig, saveRules]) {
    mock.mockReset()
  }
  fetchAccounts.mockResolvedValue([topOne, ebinex])
  fetchImportFormats.mockResolvedValue({})
  // No rules saved yet: no «Antes de …» line, and every new account gets its v1
  fetchRulesConfig.mockResolvedValue(configAntes())
  saveRules.mockResolvedValue(savedV1('rev-1'))
  mockAgora.at = new Date('2026-10-19T16:00:00Z')
})

describe('ImportSheet · import a file', () => {
  /** The happy path: Top One file → preview → import → undo from the toast */
  async function importAndUndo({ strict }: { strict: boolean }) {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7, account_tz: 'UTC' }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })
    importUndo.mockResolvedValue({ deleted: 7 })

    const dialog = await openSheet({ accountId: topOne.id }, { strict })
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
    const toast = toastOf(dialog)
    expect(toast).toHaveTextContent('7 operações em Top One.')

    await userEvent.click(within(toast).getByRole('button', { name: 'Desfazer: 7 operações em Top One.' }))

    expect(await within(dialog).findByText('Importação desfeita: nada ficou em Top One.', { selector: '.hub-chip-dado' })).toBeInTheDocument()
    expect(importUndo).toHaveBeenCalledWith(expect.anything(), 'batch-1')
    expect(within(dialog).getByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(importPreview).toHaveBeenCalledTimes(2)
    expect(within(dialog).getByRole('button', { name: 'Importar 7 operações' })).toBeInTheDocument()
  }

  it('imports a Top One file into its confirmed account, then undoes it from the toast', async () => {
    await importAndUndo({ strict: false })
  })

  it('does the same under React strict mode, which mounts the sheet twice', async () => {
    await importAndUndo({ strict: true })
  })

  it('announces progress and results through one status region that is always there', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    const pending = deferred<data.ImportCommitResult>()
    importCommit.mockReturnValue(pending.promise)

    const dialog = await openSheet({ accountId: topOne.id })
    const status = statusOf(dialog)
    expect(status).toBeEmptyDOMElement()
    // Nothing in the sheet tells assistive technology to hold its updates back
    expect(dialog).not.toHaveAttribute('aria-busy')

    await chooseFile(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 7 operações' }))
    expect(status).toHaveTextContent('Um momento…')

    await act(async () => {
      pending.resolve({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })
    })

    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(within(dialog).getAllByRole('status')).toEqual([status])
    expect(status).toHaveTextContent('7 operações em Top One.')
  })

  it('sends one undo however often the toast’s "Desfazer" is pressed', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })
    const pending = deferred<{ deleted: number }>()
    importUndo.mockReturnValue(pending.promise)

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Importar 7 operações' }))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    const undo = within(toastOf(dialog)).getByRole('button')

    await userEvent.dblClick(undo)
    await userEvent.keyboard('{Enter}')

    expect(importUndo).toHaveBeenCalledTimes(1)
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    await act(async () => {
      pending.resolve({ deleted: 7 })
    })
    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('imports nothing when every trade of the file is already in another account', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 0, completable: 0, other_account: 7, rows_total: 7 }))

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(dialog).toHaveTextContent(/7 linhas ·\s*0 novas ·\s*7 em outra conta ·\s*0 já estavam ·\s*0 com erro/)
    expect(within(dialog).getByText('7 operações já estão em outra conta: ficam onde estão.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/^Nada novo/)).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    expect(importCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

  it('never lets a file dropped outside the drop zone open in the browser', async () => {
    const dialog = await openSheet({ accountId: topOne.id })
    const veil = document.querySelector('.hub-veu') as HTMLElement
    const file = csvFile('Trade-History.csv')

    // fireEvent returns false when the default (opening the file) was prevented
    for (const target of [dialog, within(dialog).getByRole('heading', { level: 2 }), veil]) {
      expect(fireEvent.dragOver(target, { dataTransfer: { files: [file] } })).toBe(false)
      expect(fireEvent.drop(target, { dataTransfer: { files: [file] } })).toBe(false)
    }
    expect(readFile).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 12, duplicate: 0, completed: 0, other_account: 0, errors: [] })

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

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 12 operações' }))

    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    // The commit uses the zone just confirmed, never the account's old guess (UTC)
    expect(importCommit.mock.calls[0][1]).toMatchObject({ p_account: ebinex.id, p_file_tz: 'America/Sao_Paulo' })
  })

  it('imports with the zone chosen in step c', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 12, rows_total: 12, tz_confirmed: false, account_tz: 'UTC' }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 12, duplicate: 0, completed: 0, other_account: 0, errors: [] })

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)
    await within(dialog).findByRole('radiogroup')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1]).toMatchObject({ p_file_tz: 'America/Sao_Paulo' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 12 operações' }))

    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    // The account's own zone is still the unconfirmed UTC: the commit must not fall back to it
    expect(importCommit.mock.calls[0][1]).toMatchObject({ p_account: ebinex.id, p_file_tz: 'America/Sao_Paulo' })
  })

  it('shows the confirmed zone on "Nada novo", with nothing to confirm', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 0, duplicate: 7, rows_total: 7, already_imported: true }))

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Nada novo: as 7 operações já estão em Top One.' })).toHaveFocus()
    expect(within(dialog).getByText('Fuso do arquivo da Top One: UTC.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/a confirmar/)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Confirmar fuso' })).not.toBeInTheDocument()
    expect(importCommit).not.toHaveBeenCalled()
    expect(importFixTz).not.toHaveBeenCalled()
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
    expect(within(dialog).getByText('Contas de mercados diferentes nunca são somadas: este arquivo não entra em Top One.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Criar conta de binárias' })).toBeInTheDocument()
    // No "Voltar" on this choice, as on the board
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar em Ebinex' }))

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1]).toMatchObject({ p_account: ebinex.id, p_platform: 'ebinex' })
  })

  it('starts one preview however often a wrong-market button is pressed', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    fetchAccounts.mockResolvedValue([topOne, { ...ebinex, tz_applied_at: CONFIRMED, file_tz: 'America/Sao_Paulo' }])
    const pending = deferred<data.ImportPreviewResult>()
    importPreview.mockReturnValue(pending.promise)

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    const into = await within(dialog).findByRole('button', { name: 'Importar em Ebinex' })
    const create = within(dialog).getByRole('button', { name: 'Criar conta de binárias' })

    await userEvent.dblClick(into)
    await userEvent.click(create)

    expect(importPreview).toHaveBeenCalledTimes(1)
    expect(into).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAttribute('aria-disabled', 'true')
    await act(async () => {
      pending.resolve(makePreview({ new: 12, rows_total: 12 }))
    })
    await within(dialog).findByRole('heading', { name: 'Prévia' })

    // One step in the history: Voltar goes back to the market question, which shows the account in context
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Este arquivo é de binárias (Ebinex).' })).toHaveFocus()
    expect(within(dialog).getByText('A conta escolhida é de Futuros.')).toBeInTheDocument()
  })

  it('creates a binary account for a file of the other market', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    fetchAccounts.mockResolvedValue([topOne])
    const created = makeAccount({ label: 'Minha Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal' })
    createAccount.mockResolvedValue(created)

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Criar conta de binárias' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de binárias' })).toHaveFocus()
    expect(within(dialog).getByText('Corretora')).toBeInTheDocument()
    expect(within(dialog).getByText('Ebinex · arquivo CSV')).toBeInTheDocument()
    expect(within(dialog).getByText('Tipo')).toBeInTheDocument()
    expect(within(dialog).queryByText('Tamanho US$')).not.toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Minha Ebinex')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Minha Ebinex e continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    // A binary account is always personal; Top One stays the primary account
    expect(createAccount).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      market: 'binary',
      label: 'Minha Ebinex',
      platform: 'ebinex',
      firm: null,
      external_ref: null,
      phase: 'pessoal',
      size: null,
      is_primary: false,
    })

    // Back past the account it created: the market question still shows the account in context
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Este arquivo é de binárias (Ebinex).' })).toHaveFocus()
    expect(within(dialog).getByText('A conta escolhida é de Futuros.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Importar em Minha Ebinex' })).toBeInTheDocument()
  })

  it('makes the first account the primary one', async () => {
    fetchAccounts.mockResolvedValue([])
    createAccount.mockResolvedValue(makeAccount({ label: 'Apex A', market: 'futures', platform: 'rithmic', phase: 'avaliacao' }))

    const dialog = await openSheet({ mode: 'adicionar' })
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await fillNewFuturesAccount(dialog, 'Apex A')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex A' }))

    await within(dialog).findByRole('heading', { name: 'Apex A criada.' })
    expect(createAccount).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.objectContaining({ phase: 'avaliacao', is_primary: true }))
  })

  it('keeps an account it created when the preview then fails, and retries without creating it again', async () => {
    // The old Ebinex format carries its own offsets: no zone step, the preview comes right after
    readFile.mockResolvedValue(fixtureFile('ebinex_iso'))
    fetchAccounts.mockResolvedValue([topOne])
    const created = makeAccount({ label: 'Minha Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal' })
    createAccount.mockImplementation(async () => {
      fetchAccounts.mockResolvedValue([topOne, created])
      return created
    })
    importPreview
      .mockRejectedValueOnce({ message: 'TypeError: Failed to fetch' })
      .mockResolvedValue(makePreview({ new: 7, rows_total: 7, tz_confirmed: false }))

    const dialog = await openSheet()
    await chooseFile(dialog)
    await within(dialog).findByRole('heading', { name: 'Para qual conta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Minha Ebinex')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Minha Ebinex e continuar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    // The refreshed list now has the new account: its own nickname is not "taken" (read again after
    // the account, and after its rules)
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalledTimes(3))
    expect(dialog).not.toHaveTextContent('Já existe uma conta com esse apelido.')
    expect(within(dialog).getByLabelText('Apelido')).toBeDisabled()
    const retry = within(dialog).getByRole('button', { name: 'Continuar' })
    expect(retry).not.toHaveAttribute('aria-disabled')

    await userEvent.click(retry)

    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(createAccount).toHaveBeenCalledTimes(1)
    expect(importPreview.mock.calls[1][1]).toMatchObject({ p_account: created.id })
  })

  it('says "{conta} criada. Nada importado…" when a new account gets nothing from the file', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_iso'))
    fetchAccounts.mockResolvedValue([topOne])
    createAccount.mockResolvedValue(makeAccount({ label: 'Minha Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal' }))
    importPreview.mockResolvedValue(makePreview({ new: 0, completable: 0, other_account: 7, rows_total: 7, tz_confirmed: false }))

    const dialog = await openSheet()
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Minha Ebinex')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Minha Ebinex e continuar' }))
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    expect(await within(dialog).findByRole('heading', { name: 'Minha Ebinex criada.' })).toHaveFocus()
    expect(within(dialog).getByText('Nada importado: as operações ficaram em outra conta.')).toBeInTheDocument()
    expect(importCommit).not.toHaveBeenCalled()
    expect(toastOf(dialog)).toBeNull()
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
    // The file's firm comes filled in, and can be taken out (the format is not proof of the firm)
    expect(within(dialog).getByText('Mesa e arquivo')).toBeInTheDocument()
    expect(within(dialog).getByText('Top One Futures · Trade History')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Tirar a mesa Top One Futures' })).toBeInTheDocument()
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
      firm: 'Top One Futures',
      external_ref: null,
      phase: 'financiada',
      size: '50000',
      is_primary: false,
    })
    expect(within(dialog).getByText('Passo 3 de 4')).toBeInTheDocument()
    // Top One files are in UTC
    expect(within(dialog).getByRole('radio', { name: /^UTC/ })).toBeChecked()
    // The new account cannot be created twice: Voltar goes back to the account choice, on that account
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(await within(dialog).findByRole('heading', { name: 'Para qual conta?' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Apex B' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: '+ Nova conta de futuros' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    expect(createAccount).toHaveBeenCalledTimes(1)
  })
})

describe('ImportSheet · add an account', () => {
  it('goes market → platform → account, then offers to import its history', async () => {
    const created = makeAccount({ label: 'Apex A', market: 'futures', platform: 'rithmic', firm: 'Mesa Alfa', phase: 'avaliacao' })
    createAccount.mockResolvedValue(created)

    const dialog = await openSheet({ mode: 'adicionar' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Adicionar conta' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Qual mercado?' })).toHaveFocus()
    expect(within(dialog).getByText('Passo 1 de 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription('Escolha o mercado.')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Futuros (EUA)' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).getByRole('heading', { name: 'Onde você opera?' })).toHaveFocus()
    const search = within(dialog).getByRole('searchbox', { name: 'Busque mesa, corretora ou plataforma' })
    // A firm outside the list: neither a firm nor a platform answers, so the text becomes the firm
    await userEvent.type(search, 'Mesa Alfa')
    expect(within(dialog).getByText('Nada com esse nome na lista de mesas e plataformas.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('group', { name: /^Mesa/ })).not.toBeInTheDocument()
    // "Não sei" always stays
    expect(within(dialog).getByRole('button', { name: 'Não sei' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar “Mesa Alfa” como mesa' }))
    expect(within(dialog).getByText('Mesa: Mesa Alfa')).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rithmic' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).getByRole('heading', { name: 'Nova conta de futuros' })).toHaveFocus()
    expect(within(dialog).getByText('Mesa e plataforma')).toBeInTheDocument()
    expect(within(dialog).getByText('Mesa Alfa · Rithmic')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Apex A')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex A' }))

    expect(await within(dialog).findByRole('heading', { name: 'Apex A criada.' })).toHaveFocus()
    expect(createAccount).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ market: 'futures', platform: 'rithmic', firm: 'Mesa Alfa', phase: 'avaliacao', is_primary: false }),
    )
    expect(within(dialog).getByText('Nada ainda. Importe o histórico ou registre a primeira operação.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar histórico' }))
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Importar arquivo' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Apex A' })).toHaveFocus()
  })

  it('goes back from the drop step to "{conta} criada.", never to a second account form', async () => {
    createAccount.mockResolvedValue(makeAccount({ label: 'Apex A', market: 'futures', platform: 'rithmic', phase: 'avaliacao' }))

    const dialog = await openSheet({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex A')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex A' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Importar histórico' }))

    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))

    expect(within(dialog).getByRole('heading', { name: 'Apex A criada.' })).toHaveFocus()
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Adicionar conta' })).toBeInTheDocument()
    // An end screen has no Voltar: what came before it is done
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Importar histórico' })).toBeInTheDocument()
    expect(createAccount).toHaveBeenCalledTimes(1)
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

describe('ImportSheet · the prop-firm list (i2)', () => {
  const FEATURED = [
    'Apex Trader Funding',
    'Blue Guardian Futures',
    'FundedNext Futures',
    'Lucid Trading',
    'My Funded Futures',
    'Top One Futures',
    'Topstep',
    'Tradeify',
    'Traders Launch',
  ]
  const FUTURES_PLATFORMS = ['Tradovate', 'Rithmic', 'NinjaTrader', 'TopstepX', 'Quantower', 'TradingView', 'BlackArrow', 'WealthCharts', 'Não sei']

  const names = (group: HTMLElement) => within(group).getAllByRole('button').map((b) => b.textContent)
  const firmGroup = (dialog: HTMLElement) => within(dialog).getByRole('group', { name: 'Mesa · opcional' })
  const platformGroup = (dialog: HTMLElement) => within(dialog).getByRole('group', { name: 'Plataforma' })

  async function toI2(market: 'Futuros (EUA)' | 'Opções binárias' = 'Futuros (EUA)') {
    const dialog = await openSheet({ mode: 'adicionar' })
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await userEvent.click(within(dialog).getByRole('button', { name: market }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(within(dialog).getByRole('heading', { name: 'Onde você opera?' })).toHaveFocus()
    return { dialog, search: within(dialog).getByRole('searchbox', { name: 'Busque mesa, corretora ou plataforma' }) }
  }

  it('shows the featured firms in alphabetical order under «Mesa», above the platforms, and its ⓘ states the rule', async () => {
    const { dialog } = await toI2()

    expect(names(firmGroup(dialog))).toEqual(FEATURED)
    expect(names(platformGroup(dialog))).toEqual(FUTURES_PLATFORMS)
    // «Mesa» comes before «Plataforma»
    expect(firmGroup(dialog).compareDocumentPosition(platformGroup(dialog)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const pill of within(firmGroup(dialog)).getAllByRole('button')) expect(pill).toHaveAttribute('aria-pressed', 'false')

    const info = within(dialog).getByRole('button', { name: 'Como ler: lista de mesas' })
    expect(info).toHaveAttribute('aria-controls', 'info-mesas')
    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(dialog.querySelector('#info-mesas')).toHaveTextContent(
      'Mesas de futuros com nota 4 ou mais e pelo menos 50 avaliações verificadas na Prop Firm Match, vistas em outubro de 2026, mais a Apex Trader Funding, em ordem alfabética. Não é recomendação nem parceria. A sua não está aqui? Digite o nome.',
    )
    // No firm's score anywhere on the step
    expect(dialog).not.toHaveTextContent(/\d[.,]\d/)
  })

  it('searches firms and platforms together: "top" shows two firms and TopstepX, each under its own group', async () => {
    const { dialog, search } = await toI2()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: lista de mesas' }))

    await userEvent.type(search, 'top')

    expect(names(firmGroup(dialog))).toEqual(['Top One Futures', 'Topstep'])
    // «Não sei» always stays
    expect(names(platformGroup(dialog))).toEqual(['TopstepX', 'Não sei'])
    // The ⓘ stays with «Mesa · opcional» while the owner searches, right after the label, and its panel stays open
    // (board `I2.temInfoMesa` ignores the search; `.cab-grupo`)
    const info = within(dialog).getByRole('button', { name: 'Como ler: lista de mesas' })
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(dialog.querySelector('#info-mesas')).toHaveTextContent(/^Mesas de futuros com nota 4 ou mais/)
    expect(info.previousElementSibling).toHaveAttribute('id', 'l-mesas')
    expect(info.parentElement).toHaveClass('hub-cab-grupo')
    expect(info.parentElement).not.toHaveClass('hub-passo__cab')
    expect(within(dialog).queryByText('Nada com esse nome na lista de mesas e plataformas.')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /como mesa$/ })).not.toBeInTheDocument()
  })

  it('finds a firm by its alias, with any case and accents, and searches every firm, not only the featured ones', async () => {
    const { dialog, search } = await toI2()

    await userEvent.type(search, 'mff')
    expect(names(firmGroup(dialog))).toEqual(['My Funded Futures'])
    // No platform holds "mff", but a firm answers: no «Nada com esse nome» and no free-text firm
    expect(within(dialog).queryByText('Nada com esse nome na lista de mesas e plataformas.')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /como mesa$/ })).not.toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, 'TÓPSTEP')
    expect(names(firmGroup(dialog))).toEqual(['Topstep'])

    await userEvent.clear(search)
    await userEvent.type(search, 'earn2')
    expect(names(firmGroup(dialog))).toEqual(['Earn2Trade'])

    // A word many firms share: at most 8
    await userEvent.clear(search)
    await userEvent.type(search, 'futures')
    expect(names(firmGroup(dialog))).toHaveLength(8)
  })

  it('picking Topstep sets the chip, selects TopstepX and gives it focus', async () => {
    const { dialog, search } = await toI2()

    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Topstep' }))

    expect(within(dialog).getByText('Mesa: Topstep')).toBeInTheDocument()
    // TopstepX came with the firm: nothing asks for a platform any more
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
    // The chip stands for the group
    expect(within(dialog).queryByRole('group', { name: 'Mesa · opcional' })).not.toBeInTheDocument()
    expect(search).toHaveValue('')
    const topstepx = within(platformGroup(dialog)).getByRole('button', { name: 'TopstepX' })
    expect(topstepx).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(topstepx).toHaveFocus())
    expect(names(platformGroup(dialog))[0]).toBe('TopstepX')

    const next = within(dialog).getByRole('button', { name: 'Continuar' })
    expect(next).not.toHaveAttribute('aria-disabled')
    await userEvent.click(next)
    expect(within(dialog).getByText('Mesa e plataforma')).toBeInTheDocument()
    expect(within(dialog).getByText('Topstep · TopstepX')).toBeInTheDocument()
  })

  it('picking a firm keeps a platform already chosen', async () => {
    const { dialog, search } = await toI2()
    await userEvent.click(within(platformGroup(dialog)).getByRole('button', { name: 'Rithmic' }))

    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Topstep' }))

    expect(within(platformGroup(dialog)).getByRole('button', { name: 'Rithmic' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(platformGroup(dialog)).getByRole('button', { name: 'TopstepX' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Mesa: Topstep')).toBeInTheDocument()
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
    await waitFor(() => expect(search).toHaveFocus())
  })

  it('picking Top One Futures puts its platforms first; «Tirar» takes out only the firm', async () => {
    const { dialog, search } = await toI2()

    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Top One Futures' }))

    expect(within(dialog).getByText('Mesa: Top One Futures')).toBeInTheDocument()
    expect(names(platformGroup(dialog))).toEqual([
      'Tradovate',
      'NinjaTrader',
      'TradingView',
      'BlackArrow',
      'WealthCharts',
      'Rithmic',
      'TopstepX',
      'Quantower',
      'Não sei',
    ])
    // Several platforms: none is chosen for the owner, the chip asks for one, and the search takes focus back
    for (const pill of within(platformGroup(dialog)).getAllByRole('button')) expect(pill).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveFocus())

    await userEvent.click(within(platformGroup(dialog)).getByRole('button', { name: 'NinjaTrader' }))
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tirar a mesa Top One Futures' }))

    expect(within(dialog).queryByText('Mesa: Top One Futures')).not.toBeInTheDocument()
    expect(names(firmGroup(dialog))).toEqual(FEATURED)
    expect(names(platformGroup(dialog))).toEqual(FUTURES_PLATFORMS)
    expect(within(platformGroup(dialog)).getByRole('button', { name: 'NinjaTrader' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(search).toHaveFocus())
  })

  it('a firm that offers only BlackArrow (Ylos Trading) selects BlackArrow', async () => {
    const { dialog, search } = await toI2()

    await userEvent.type(search, 'ylos')
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Ylos Trading' }))

    expect(within(dialog).getByText('Mesa: Ylos Trading')).toBeInTheDocument()
    // The search that found the firm is emptied, so every platform pill is back
    expect(search).toHaveValue('')
    expect(names(platformGroup(dialog))).toHaveLength(FUTURES_PLATFORMS.length)
    expect(within(platformGroup(dialog)).getByRole('button', { name: 'BlackArrow' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
  })

  it('with a firm chosen, a new search can replace it', async () => {
    const { dialog, search } = await toI2()
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Topstep' }))

    // A search that shows the chosen firm again marks it as pressed
    await userEvent.type(search, 'top')
    expect(within(firmGroup(dialog)).getByRole('button', { name: 'Topstep' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(firmGroup(dialog)).getByRole('button', { name: 'Top One Futures' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.clear(search)
    await userEvent.type(search, 'luc')
    expect(names(firmGroup(dialog))).toEqual(['Lucid Trading'])
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Lucid Trading' }))

    expect(within(dialog).getByText('Mesa: Lucid Trading')).toBeInTheDocument()
    expect(search).toHaveValue('')
    expect(within(dialog).queryByText('Mesa: Topstep')).not.toBeInTheDocument()
    // TopstepX came with Topstep, and Lucid Trading does not offer it: it goes, and the step asks for a platform
    expect(within(platformGroup(dialog)).getByRole('button', { name: 'TopstepX' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()
    expect(search).toHaveFocus()
  })

  it('a platform the owner pressed himself stays when he swaps the firm', async () => {
    const { dialog, search } = await toI2()
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Topstep' }))
    // The owner presses TopstepX himself: from now on it is his choice, not the firm's
    await userEvent.click(within(platformGroup(dialog)).getByRole('button', { name: 'TopstepX' }))

    await userEvent.type(search, 'luc')
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Lucid Trading' }))

    expect(within(dialog).getByText('Mesa: Lucid Trading')).toBeInTheDocument()
    expect(within(platformGroup(dialog)).getByRole('button', { name: 'TopstepX' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
  })

  it('creates the account with the firm picked from the list', async () => {
    createAccount.mockResolvedValue(makeAccount({ label: 'TOF 1', market: 'futures', platform: 'tradovate', firm: 'Top One Futures', phase: 'avaliacao' }))
    const { dialog } = await toI2()

    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Top One Futures' }))
    await userEvent.click(within(platformGroup(dialog)).getByRole('button', { name: 'Tradovate' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(within(dialog).getByText('Top One Futures · Tradovate')).toBeInTheDocument()
    // Chosen by the owner in i2 (Voltar changes it): «Tirar» is only for a firm that came from a file
    expect(within(dialog).queryByRole('button', { name: /^Tirar a mesa/ })).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'TOF 1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar TOF 1' }))

    await within(dialog).findByRole('heading', { name: 'TOF 1 criada.' })
    expect(createAccount).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ market: 'futures', platform: 'tradovate', firm: 'Top One Futures' }),
    )
  })

  it('searches the platforms with accents ignored: "nao" finds «Não sei», so nothing says there is no match', async () => {
    const { dialog, search } = await toI2()

    await userEvent.type(search, 'nao')

    expect(names(platformGroup(dialog))).toEqual(['Não sei'])
    expect(within(dialog).queryByText('Nada com esse nome na lista de mesas e plataformas.')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /como mesa$/ })).not.toBeInTheDocument()
  })

  it('takes at most 60 characters, so a firm typed freely always fits the account', async () => {
    createAccount.mockResolvedValue(makeAccount({ label: 'Longa', market: 'futures', platform: 'rithmic', phase: 'avaliacao' }))
    const { dialog, search } = await toI2()
    const long = 'Mesa Alfa Beta Gama Delta Epsilon Zeta Eta Teta Iota Capa Lambda Mi'
    expect(long.length).toBeGreaterThan(60)

    await userEvent.click(search)
    await userEvent.paste(long)

    expect(search).toHaveValue(long.slice(0, 60))
    await userEvent.click(within(dialog).getByRole('button', { name: `Usar “${long.slice(0, 60).trim()}” como mesa` }))
    await userEvent.click(within(platformGroup(dialog)).getByRole('button', { name: 'Rithmic' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Longa')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Longa' }))

    await within(dialog).findByRole('heading', { name: 'Longa criada.' })
    const sent = createAccount.mock.calls[0][2].firm
    expect(sent).toBe(long.slice(0, 60).trim())
    expect(sent!.length).toBeLessThanOrEqual(60)
  })

  it('binaries have no «Mesa»: one group named by the step, and their own no-match copy', async () => {
    const { dialog, search } = await toI2('Opções binárias')

    expect(within(dialog).queryByRole('group', { name: /^Mesa/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Plataforma')).not.toBeInTheDocument()
    expect(names(within(dialog).getByRole('group', { name: 'Onde você opera?' }))).toEqual(['Ebinex', 'Pocket Option', 'IQ Option', 'Outra'])

    await userEvent.type(search, 'top')
    expect(within(dialog).queryByRole('button', { name: 'Topstep' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Nada com esse nome. Escolha “Outra” e siga.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /como mesa$/ })).not.toBeInTheDocument()
  })
})

describe('ImportSheet · the firm of a Top One file (step b)', () => {
  async function toStepB() {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    fetchAccounts.mockResolvedValue([ebinex])
    const dialog = await openSheet()
    await chooseFile(dialog)
    await within(dialog).findByRole('heading', { name: 'Para qual conta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de futuros' })).toHaveFocus()
    return dialog
  }

  it('«Tirar» takes the suggested firm out: the row reads «Arquivo · Trade History» and the account has no firm', async () => {
    createAccount.mockResolvedValue(makeAccount({ label: 'Conta TH', market: 'futures', platform: 'topone', phase: 'pessoal' }))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    const dialog = await toStepB()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Tirar a mesa Top One Futures' }))

    expect(within(dialog).getByText('Arquivo')).toBeInTheDocument()
    expect(within(dialog).getByText('Trade History')).toBeInTheDocument()
    expect(within(dialog).queryByText('Mesa e arquivo')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Tirar a mesa/ })).not.toBeInTheDocument()
    // The button went away with the firm: focus moves on to the next field
    await waitFor(() => expect(within(dialog).getByLabelText(/Tamanho US\$/)).toHaveFocus())

    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Conta TH')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Conta TH e continuar' }))

    await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })
    expect(createAccount).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.objectContaining({ platform: 'topone', firm: null }))
  })

  it('the suggested firm left as it came is not something typed: closing does not ask', async () => {
    await toStepB()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByText('Fechar sem salvar?')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('taking the suggested firm out counts as typed: closing asks first', async () => {
    const dialog = await toStepB()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tirar a mesa Top One Futures' }))

    await userEvent.keyboard('{Escape}')

    expect(within(dialog).getByText('Fechar sem salvar?')).toBeInTheDocument()
  })

  it('a Top One file brought into a binary account: «Criar conta de futuros» starts with the firm too', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    fetchAccounts.mockResolvedValue([ebinex])
    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'Este arquivo é de futuros (Top One).' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar conta de futuros' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de futuros' })).toHaveFocus()
    expect(within(dialog).getByText('Mesa e arquivo')).toBeInTheDocument()
    expect(within(dialog).getByText('Top One Futures · Trade History')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Tirar a mesa Top One Futures' })).toBeInTheDocument()
  })

  it('a locked form (its account exists) shows the firm without «Tirar»', () => {
    const onChange = jest.fn()
    const props = {
      headingRef: React.createRef<HTMLHeadingElement>(),
      market: 'futures' as const,
      form: { ...EMPTY_FORM, market: 'futures' as const, firm: 'Top One Futures', label: 'Conta TH' },
      onChange,
      roLabel: 'Mesa e arquivo',
      roValue: 'Top One Futures · Trade History',
      labelTaken: false,
      sizeInvalid: false,
      firmRemovable: true,
    }
    const { rerender } = render(<PassoNovaConta {...props} />)
    // The same form before «Criar»: the file's firm can still be taken out
    expect(screen.getByRole('button', { name: 'Tirar a mesa Top One Futures' })).toBeInTheDocument()

    rerender(<PassoNovaConta {...props} locked />)

    expect(screen.getByText('Top One Futures · Trade History')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tirar a mesa/ })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('an Ebinex file suggests no firm', async () => {
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))
    fetchAccounts.mockResolvedValue([topOne])
    const dialog = await openSheet()
    await chooseFile(dialog)
    await within(dialog).findByRole('heading', { name: 'Para qual conta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(await within(dialog).findByRole('heading', { name: 'Nova conta de binárias' })).toHaveFocus()
    expect(within(dialog).getByText('Ebinex · arquivo CSV')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Tirar a mesa/ })).not.toBeInTheDocument()
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

  it('shows the card of a file with no trade line', async () => {
    readFile.mockResolvedValue({
      fileName: 'operacoes.csv',
      size: 10,
      sha256: 'ab'.repeat(32),
      outcome: { ok: false, error: 'empty_file', platform: 'ebinex' },
    })

    const dialog = await openSheet({ accountId: ebinex.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('heading', { name: 'O arquivo não tem operações.' })).toHaveFocus()
    expect(within(dialog).getByText('CSV da Ebinex · Opções binárias · nenhuma linha de operação')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Como ler: arquivo' })).toBeInTheDocument()
  })

  it('shows no card for a file it could not read at all', async () => {
    readFile.mockResolvedValue({ fileName: 'x.csv', size: 10, sha256: 'ab'.repeat(32), outcome: { ok: false, error: 'unknown_format' } })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Não conseguimos ler o arquivo.' })
    expect(dialog.querySelector('.hub-arq')).toBeNull()
  })

  it('maps a refusal from the import functions to its own copy', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockRejectedValue({ code: '22023', message: 'archived_account', details: 'MNQM6/900000000001 at 06/03/2026 14:32:10' })

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Esta conta está arquivada. Reative em Personalizar para importar.')
    expect(dialog).not.toHaveTextContent('MNQM6/900000000001')
    expect(dialog).not.toHaveTextContent('22023')
  })

  // import_preview never raises a zone code: it answers with tz_status
  it.each([
    ['tz_mismatch', 'Este fuso é diferente do fuso confirmado da conta.'],
    ['invalid_tz', 'Fuso inválido. Escolha outro.'],
  ] as const)('stops before the preview when the preview answers tz_status %s', async (tzStatus, text) => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7, tz_status: tzStatus }))

    const dialog = await openSheet({ accountId: topOne.id })
    await chooseFile(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(text)
    expect(within(dialog).queryByRole('heading', { name: 'Prévia' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /^Importar \d/ })).not.toBeInTheDocument()
    expect(importCommit).not.toHaveBeenCalled()
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
    await userEvent.click(within(dialog).getByRole('button', { name: 'Futuros (EUA)' }))

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

  it('keeps Tab and Escape inside the sheet after a click on its text', async () => {
    const dialog = await openSheet({ accountId: topOne.id })
    const text = within(dialog).getByText('Solte para importar')

    await userEvent.click(text)
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.tab()
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toHaveFocus()

    await userEvent.click(text)
    await userEvent.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Escolher arquivo' })).toHaveFocus()

    await userEvent.click(text)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
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

// ------------------------------------------------------------------------------------------------
// Phase 2 (lane A2): the rules of a new account, and the lines that depend on «desde»
// ------------------------------------------------------------------------------------------------

const ids = idsDono()
const NBSP = ' '
// The owner's accounts, with the ids the recorded rules use
const topOneDono = makeAccount({
  id: ids.topOne,
  label: 'Top One #1',
  market: 'futures',
  platform: 'topone',
  phase: 'financiada',
  tz_applied_at: CONFIRMED,
})
const ebinexDono = makeAccount({
  id: ids.ebinex,
  label: 'Ebinex',
  market: 'binary',
  platform: 'ebinex',
  phase: 'pessoal',
  is_primary: true,
  file_tz: 'America/Sao_Paulo',
  tz_applied_at: CONFIRMED,
})
const apexB = makeAccount({ id: 'nova', label: 'Apex B', market: 'futures', platform: 'rithmic', phase: 'avaliacao' })

async function openRules(props: { mode?: SheetMode; accountId?: string | null } = {}) {
  const view = renderHub(<Opener {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  return { dialog: screen.getByRole('dialog'), queryClient: view.queryClient }
}

/** rules_config with one more account, created just now with its v1 */
function comNova(base: RulesConfig, account: { id: string; label: string; market: 'futures' | 'binary' }, effectiveDay = '2026-10-19'): RulesConfig {
  const from = base.accounts.find((a) => a.market === account.market) as AccountConfig
  const nova: AccountConfig = {
    ...from,
    id: account.id,
    label: account.label,
    versions: [{ ...from.versions[0], id: 'v1-nova', effectiveFrom: new Date('2026-10-19T16:00:00Z'), effectiveDay, origin: 'copiar', copiedFrom: from.id }],
  }
  return { ...base, accounts: [...base.accounts, nova] }
}

const linhaRegra = (dialog: HTMLElement) => (dialog.querySelector('.hub-rc-linha > span') as HTMLElement).textContent
const payloadOf = (call: number) => saveRules.mock.calls[call][1]
/** When a mock was first called, across all mocks */
const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0]

/** A Top One file whose first `after` rows enter on Tue 20 Oct 2026, after the owner's «desde» */
function topOneFile(after: number) {
  const file = fixtureFile('topone_ok')
  if (!file.outcome.ok) throw new Error('fixture')
  const rows = file.outcome.rows.map((r, i) => (i < after ? { ...r, local_entry: `2026-10-20T14:0${i}:00`, local_exit: `2026-10-20T14:3${i}:00` } : r))
  return { ...file, outcome: { ...file.outcome, rows } }
}

/** The owner after the Phase 2 save, on Mon 19 Oct 2026 at noon in New York */
function comRegrasDoDono() {
  fetchAccounts.mockResolvedValue([topOneDono, ebinexDono])
  fetchRulesConfig.mockResolvedValue(configDepois())
  createAccount.mockResolvedValue(apexB)
  saveRules.mockResolvedValue(savedV1('rev-2'))
  mockAgora.at = et('2026-10-19 12:00')
}

describe('ImportSheet · the rules of a new account (step b)', () => {
  beforeEach(comRegrasDoDono)

  it('shows «Copiar regras de», the summary line, «Mudar» and «desde» between the fields and the button', async () => {
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')

    const select = within(dialog).getByLabelText('Copiar regras de')
    expect(select).toHaveDisplayValue('Top One #1')
    expect(select).toHaveAccessibleDescription('Copia janela, limite do dia, bloqueio de dados e regra do estado.')
    expect(linhaRegra(dialog)).toBe(`Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: US$${NBSP}400 por conta`)
    expect(within(dialog).getByRole('button', { name: 'Mudar' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(dialog).getByText('Regras valem desde hoje, 19 out')).toBeInTheDocument()
    // Board order: after «Número na plataforma», before the creation button
    const ref = within(dialog).getByLabelText(/^Número na plataforma/)
    const create = within(dialog).getByRole('button', { name: 'Criar Apex B' })
    expect(ref.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(select.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(create).not.toHaveAttribute('aria-disabled')
  })

  it('dates «desde» on the trading day v1 will get: after 18:00 ET a futures account is on the next day', async () => {
    mockAgora.at = et('2026-10-19 18:05')
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    expect(within(dialog).getByText('Regras valem desde hoje, 20 out')).toBeInTheDocument()
  })

  it('dates «desde» inside an overnight binary window on the day the window opened', async () => {
    mockAgora.at = brt('2026-10-20 01:00')
    const { dialog } = await openRules({ mode: 'adicionar' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Pocket')
    expect(within(dialog).getByText('Regras valem desde hoje, 20 out')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Outra' }))
    fireEvent.change(within(dialog).getByLabelText('Início da janela só de Pocket, horário de Brasília'), { target: { value: '22:00' } })
    fireEvent.change(within(dialog).getByLabelText('Fim da janela só de Pocket, horário de Brasília'), { target: { value: '02:00' } })

    expect(within(dialog).getByText('Regras valem desde hoje, 19 out')).toBeInTheDocument()
    expect(linhaRegra(dialog)).toBe('Janela 22:00 → 02:00 do dia seguinte (Brasília) · só nesta conta · limite do dia: sem limite')
  })

  it('creates the account, then its v1 through useSaveRules, then goes on: «Sim» keeps the market’s window', async () => {
    const { dialog, queryClient } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    expect(await within(dialog).findByRole('heading', { name: 'Apex B criada.' })).toHaveFocus()
    expect(order(createAccount)).toBeLessThan(order(saveRules))
    expect(saveRules).toHaveBeenCalledTimes(1)
    expect(saveRules).toHaveBeenCalledWith(
      expect.anything(),
      {
        v: 1,
        base_rev: configDepois().rev,
        accounts: {
          nova: {
            rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } },
            window: null,
            version: 'force',
            copied_from: ids.topOne,
          },
        },
      },
      { dryRun: false },
    )
    // The save is known as this tab's: an open Personalizar draft rebases instead of «outra aba»
    expect(changedOnlyHere(queryClient, configDepois().rev, 'rev-2')).toBe(true)
    expect(within(dialog).queryByText(/as regras não foram salvas/)).not.toBeInTheDocument()
  })

  it('«Outra» sends the account’s own window, «Não copiar» no copied_from and the limit typed', async () => {
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.selectOptions(within(dialog).getByLabelText('Copiar regras de'), 'Não copiar')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Outra' }))
    fireEvent.change(within(dialog).getByLabelText('Início da janela só de Apex B, horário de Nova York'), { target: { value: '09:30' } })
    await userEvent.type(within(dialog).getByLabelText('Limite do dia, US$'), '250,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'somando as contas de Futuros' }))
    expect(linhaRegra(dialog)).toBe(`Janela 09:30–11:00 (Nova York) · só nesta conta · limite do dia: US$${NBSP}250,50 somando as contas de Futuros`)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    expect(payloadOf(0)).toEqual({
      v: 1,
      base_rev: configDepois().rev,
      accounts: {
        nova: {
          rules: { v: 1, limit: { usd: 250.5, mode: 'soma', at_limit: 'encerrar' } },
          window: { tz: 'America/New_York', start_min: 570, end_min: 660, weekdays: 31 },
          version: 'force',
        },
      },
    })
  })

  it('without a market window, the window the form sets becomes the market’s', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    expect(linhaRegra(dialog)).toBe('Janela: sem janela · limite do dia: sem limite')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    expect(linhaRegra(dialog)).toBe('Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: sem limite')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    const payload = payloadOf(0)
    expect(payload.base_rev).toBe('none')
    expect(payload.defaults?.futures?.windows).toEqual([{ tz: 'America/New_York', start_min: 600, end_min: 660, weekdays: 31 }])
    expect(payload.accounts?.nova).toEqual({ rules: { v: 1, limit: null }, window: null, version: 'force', copied_from: ids.topOne })
  })

  it('another tab saved meanwhile (rules_changed): rebuilt on the fresh rules and sent once more', async () => {
    const fresh = { ...configDepois(), rev: 'rev-outra-aba' }
    fetchRulesConfig.mockResolvedValueOnce(configDepois()).mockResolvedValue(fresh)
    saveRules.mockRejectedValueOnce(new regrasDb.RegrasDataError('rules_changed')).mockResolvedValueOnce(savedV1('rev-3'))
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    expect(saveRules).toHaveBeenCalledTimes(2)
    expect(payloadOf(0).base_rev).toBe(configDepois().rev)
    expect(payloadOf(1)).toEqual({ ...payloadOf(0), base_rev: 'rev-outra-aba' })
    expect(createAccount).toHaveBeenCalledTimes(1)
    expect(within(dialog).queryByText(/as regras não foram salvas/)).not.toBeInTheDocument()
  })

  it('tries again only once: a second rules_changed leaves the account without rules, and says so', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('rules_changed'))
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    expect(saveRules).toHaveBeenCalledTimes(2)
    expect(within(dialog).getByText('Apex B criada, mas as regras não foram salvas. Salve em Personalizar › Suas regras.', { selector: '.hub-alerta' })).toBeInTheDocument()
  })

  it('rules_changed after the market got a window meanwhile: the form’s window goes as the account’s own', async () => {
    fetchRulesConfig.mockResolvedValueOnce(configAntes()).mockResolvedValue(configDepois())
    saveRules.mockRejectedValueOnce(new regrasDb.RegrasDataError('rules_changed')).mockResolvedValueOnce(savedV1('rev-3'))
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    fireEvent.change(within(dialog).getByLabelText('Início da janela de Futuros, horário de Nova York'), { target: { value: '09:00' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    expect(payloadOf(0).defaults?.futures?.windows).toEqual([{ tz: 'America/New_York', start_min: 540, end_min: 660, weekdays: 31 }])
    const retry = payloadOf(1)
    expect(retry.base_rev).toBe(configDepois().rev)
    expect(retry.defaults).toBeUndefined()
    expect(retry.accounts?.nova.window).toEqual({ tz: 'America/New_York', start_min: 540, end_min: 660, weekdays: 31 })
  })

  it('any other failure: the account stays, without rules, and the sheet says so; never a second account', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    expect(await within(dialog).findByRole('heading', { name: 'Apex B criada.' })).toHaveFocus()
    const text = 'Apex B criada, mas as regras não foram salvas. Salve em Personalizar › Suas regras.'
    expect(within(dialog).getByText(text, { selector: '.hub-alerta' })).toBeInTheDocument()
    expect(statusOf(dialog)).toHaveTextContent(text)
    expect(saveRules).toHaveBeenCalledTimes(1)
    expect(createAccount).toHaveBeenCalledTimes(1)
  })

  it('creates the account without v1 when the rules cannot be read, and says so to a screen reader too', async () => {
    fetchRulesConfig.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    const text = 'Não foi possível carregar as regras. A conta é criada sem regras; salve em Personalizar › Suas regras.'
    expect(await within(dialog).findByText(text, { selector: '#regras-carga' })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Copiar regras de')).not.toBeInTheDocument()
    // The sheet's one live region says it, and «Criar» is described by it (it does not block)
    expect(statusOf(dialog)).toHaveTextContent(text)
    const create = within(dialog).getByRole('button', { name: 'Criar Apex B' })
    expect(create).not.toHaveAttribute('aria-disabled')
    expect(create).toHaveAccessibleDescription(text)

    await userEvent.click(create)

    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
    expect(saveRules).not.toHaveBeenCalled()
  })

  it('waits for the rules before creating', async () => {
    const pending = deferred<RulesConfig>()
    fetchRulesConfig.mockReturnValue(pending.promise)
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    const create = within(dialog).getByRole('button', { name: 'Criar Apex B' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAccessibleDescription('Carregando…')
    await userEvent.click(create)
    expect(createAccount).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve(configDepois())
    })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Criar Apex B' })).not.toHaveAttribute('aria-disabled'))
    expect(within(dialog).getByLabelText('Copiar regras de')).toHaveDisplayValue('Top One #1')
  })

  it('a limit or a window that cannot be saved keeps «Criar» blocked, saying why', async () => {
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    const limite = within(dialog).getByLabelText('Limite do dia, US$')
    await userEvent.clear(limite)
    await userEvent.type(limite, '40O')
    const create = within(dialog).getByRole('button', { name: 'Criar Apex B' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAccessibleDescription('Use só números, como 400 ou 400,50.')
    expect(limite).toHaveAccessibleDescription('Use só números, como 400 ou 400,50.')
    expect(dialog.querySelector('#f-lim-erro')).toBeNull()
    // Without a nickname the hint asks for it: the limit's error then shows under the field
    await userEvent.clear(within(dialog).getByLabelText('Apelido'))
    const createFallback = within(dialog).getByRole('button', { name: 'Criar conta' })
    expect(createFallback).toHaveAccessibleDescription('Dê um apelido à conta.')
    expect(limite).toHaveAccessibleDescription('Use só números, como 400 ou 400,50.')
    expect(within(dialog).getByText('Use só números, como 400 ou 400,50.', { selector: '#f-lim-erro' })).toBeVisible()
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Apex B')
    expect(dialog.querySelector('#f-lim-erro')).toBeNull()
    await userEvent.clear(limite)
    await userEvent.type(limite, '0')
    expect(create).toHaveAccessibleDescription('Digite um valor maior que zero.')
    await userEvent.clear(limite)
    expect(create).not.toHaveAttribute('aria-disabled')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Outra' }))
    fireEvent.change(within(dialog).getByLabelText('Fim da janela só de Apex B, horário de Nova York'), { target: { value: '10:00' } })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAccessibleDescription('Início e fim iguais: mude um dos dois.')
    // Open, the editor shows the error by the fields: «Criar» points there, and no hint repeats it
    expect(create).toHaveAttribute('aria-describedby', 'j-erro')
    expect(dialog.querySelector('#dica-pri')).toBeNull()
    // A limit that can be saved is not described by anything
    expect(limite).toHaveAccessibleDescription('')
    // Closed, the editor no longer shows the error: the button's hint says it
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    expect(create).toHaveAccessibleDescription('Início e fim iguais: mude um dos dois.')
    expect(within(dialog).getByText('Início e fim iguais: mude um dos dois.', { selector: '#dica-pri' })).toBeInTheDocument()
    await userEvent.click(create)
    expect(createAccount).not.toHaveBeenCalled()
  })

  it('no false «apelido» error while the new account’s v1 saves', async () => {
    const pending = deferred<SaveRulesResult>()
    saveRules.mockReturnValue(pending.promise)
    // The refreshed list already has the new account while its rules save
    createAccount.mockImplementation(async () => {
      fetchAccounts.mockResolvedValue([topOneDono, ebinexDono, apexB])
      return apexB
    })
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B' }))

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    await waitFor(() => expect(fetchAccounts.mock.calls.length).toBeGreaterThanOrEqual(2))
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('Já existe uma conta com esse apelido.')
    expect(within(dialog).getByLabelText('Apelido')).not.toHaveAttribute('aria-invalid', 'true')

    await act(async () => pending.resolve(savedV1('rev-2')))
    await within(dialog).findByRole('heading', { name: 'Apex B criada.' })
  })

  it('«+ Definir janela» names the market’s other accounts that get a version on the same save', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    expect(within(dialog).queryByText(/Ao criar, esta janela/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))

    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))

    const text = 'Ao criar, esta janela passa a ser a de Futuros: Top One #1 também ganha versão nova das regras desde 19 out.'
    expect(within(dialog).getByText(text)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Criar Apex B' })).toHaveAccessibleDescription(text)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar a janela nova de Futuros' }))
    expect(within(dialog).queryByText(text)).not.toBeInTheDocument()
  })

  it('changing the market starts the rules block again', async () => {
    const { dialog } = await openRules({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.clear(within(dialog).getByLabelText('Limite do dia, US$'))
    await userEvent.type(within(dialog).getByLabelText('Limite do dia, US$'), '900')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).getByLabelText('Copiar regras de')).toHaveDisplayValue('Ebinex')
    expect(linhaRegra(dialog)).toBe('Janela 20:00–21:00 (Brasília) · padrão de Binárias · limite do dia: sem limite')
    expect(within(dialog).getByRole('button', { name: 'Mudar' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('counts rules edits as typed: closing asks first', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    const { dialog } = await openRules()
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: '+ Nova conta de futuros' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await within(dialog).findByRole('heading', { name: 'Nova conta de futuros' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Copiar regras de'), 'Não copiar')

    await userEvent.keyboard('{Escape}')
    expect(within(dialog).getByText('Fechar sem salvar?')).toBeInTheDocument()
  })

  describe('the form locked after the account was created (the preview failed)', () => {
    /** Ebinex's v1 as rules_config lists it, for an account of that market created at `from` */
    function comBinariaNova(base: RulesConfig, day: string, from = brt(`${day} 23:59`)): RulesConfig {
      const ebx = configDepois().accounts.find((a) => a.market === 'binary') as AccountConfig
      const nova: AccountConfig = {
        ...ebx,
        id: 'bin-nova',
        label: 'Minha Ebinex',
        versions: [{ ...ebx.versions[0], id: 'v1-bin-nova', effectiveFrom: from, effectiveDay: day, origin: 'criar', copiedFrom: null }],
      }
      return { ...base, accounts: [...base.accounts, nova] }
    }
    const minhaEbinex = makeAccount({ id: 'bin-nova', label: 'Minha Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal' })

    /** Fills step b for «Minha Ebinex»; `beforeCreate` sees the form as «Criar» is about to be pressed */
    async function criarMinhaEbinex(beforeCreate?: (dialog: HTMLElement) => void) {
      // The old Ebinex format: no zone step, the preview comes right after (and fails)
      readFile.mockResolvedValue(fixtureFile('ebinex_iso'))
      importPreview.mockRejectedValue({ message: 'TypeError: Failed to fetch' })
      createAccount.mockImplementation(async () => {
        fetchAccounts.mockResolvedValue([topOneDono, minhaEbinex])
        return minhaEbinex
      })
      const { dialog } = await openRules()
      await chooseFile(dialog)
      await within(dialog).findByRole('heading', { name: 'Para qual conta?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
      await userEvent.type(await within(dialog).findByLabelText('Apelido'), 'Minha Ebinex')
      beforeCreate?.(dialog)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Minha Ebinex e continuar' }))
      await within(dialog).findByRole('alert')
      return dialog
    }

    it('without v1 saved: no «Regras valem desde hoje», and the notice says the rules were not saved', async () => {
      fetchAccounts.mockResolvedValue([topOneDono])
      const semBinarias = { ...configDepois(), accounts: configDepois().accounts.filter((a) => a.market === 'futures') }
      fetchRulesConfig.mockResolvedValue(semBinarias)
      saveRules.mockRejectedValue(new regrasDb.RegrasDataError('network'))
      mockAgora.at = brt('2026-10-19 12:00')

      const dialog = await criarMinhaEbinex()

      expect(within(dialog).getByLabelText('Apelido')).toBeDisabled()
      expect(within(dialog).getByText('Minha Ebinex criada, mas as regras não foram salvas. Salve em Personalizar › Suas regras.', { selector: '.hub-alerta' })).toBeInTheDocument()
      expect(within(dialog).queryByText(/Regras valem desde hoje/)).not.toBeInTheDocument()
    })

    it('with v1 saved: the block it showed at creation, and «desde» is v1’s own day, whatever the clock says now', async () => {
      fetchAccounts.mockResolvedValue([topOneDono])
      const semBinarias = { ...configDepois(), accounts: configDepois().accounts.filter((a) => a.market === 'futures') }
      // Read again after the save: the new account is now the market's only account, with its v1
      fetchRulesConfig.mockResolvedValueOnce(semBinarias).mockResolvedValue(comBinariaNova(semBinarias, '2026-10-19'))
      saveRules.mockResolvedValue(savedV1('rev-2', 'bin-nova'))
      mockAgora.at = brt('2026-10-19 23:59')

      const dialog = await criarMinhaEbinex()
      await waitFor(() => expect(fetchRulesConfig.mock.calls.length).toBeGreaterThanOrEqual(2))
      // Midnight in Brasília passes and the clock's tick redraws the sheet: a fresh prediction
      // would now say 20 out
      moveClock(brt('2026-10-20 00:05'))

      expect(within(dialog).getByText('Regras valem desde hoje, 19 out')).toBeInTheDocument()
      // As at creation: nothing to copy from (never «Copiar regras de: Minha Ebinex»)
      expect(within(dialog).queryByLabelText('Copiar regras de')).not.toBeInTheDocument()
      expect(within(dialog).getByText('Começa com o padrão do mercado.')).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Mudar' })).not.toBeInTheDocument()
    })

    it('with v1 saved after midnight: «desde» is the day the server gave v1, not the one shown at «Criar»', async () => {
      fetchAccounts.mockResolvedValue([topOneDono])
      const semBinarias = { ...configDepois(), accounts: configDepois().accounts.filter((a) => a.market === 'futures') }
      // «Criar» is pressed at 23:59:59 in Brasília and save_rules runs after midnight: v1 is on 20 out
      fetchRulesConfig.mockResolvedValueOnce(semBinarias).mockResolvedValue(comBinariaNova(semBinarias, '2026-10-20', brt('2026-10-20 00:00:01')))
      saveRules.mockResolvedValue(savedV1('rev-2', 'bin-nova'))
      mockAgora.at = brt('2026-10-19 23:59:59')

      const dialog = await criarMinhaEbinex((form) => {
        // The prediction the locked form keeps until v1 is read back
        expect(within(form).getByText('Regras valem desde hoje, 19 out')).toBeInTheDocument()
      })
      await waitFor(() => expect(fetchRulesConfig.mock.calls.length).toBeGreaterThanOrEqual(2))

      // The device clock has not ticked yet (it still says 23:59:59): only v1's own day says 20 out
      expect(await within(dialog).findByText('Regras valem desde hoje, 20 out')).toBeInTheDocument()
      expect(within(dialog).queryByText('Regras valem desde hoje, 19 out')).not.toBeInTheDocument()
    })
  })

  it('saves v1 before the preview, so the preview already counts from «desde»', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    const created = makeAccount({ id: 'nova', label: 'Apex B', market: 'futures', platform: 'topone', phase: 'financiada' })
    createAccount.mockResolvedValue(created)
    // After the save, rules_config lists the new account with its v1
    fetchRulesConfig.mockResolvedValueOnce(configDepois()).mockResolvedValue(comNova(configDepois(), { id: 'nova', label: 'Apex B', market: 'futures' }))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7, tz_confirmed: false }))

    const { dialog } = await openRules()
    await chooseFile(dialog)
    await userEvent.click(await within(dialog).findByRole('button', { name: '+ Nova conta de futuros' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(await within(dialog).findByLabelText('Apelido'), 'Apex B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Financiada' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Apex B e continuar' }))

    await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })
    expect(order(createAccount)).toBeLessThan(order(saveRules))
    expect(payloadOf(0).accounts?.nova).toMatchObject({ version: 'force', copied_from: ids.topOne })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(order(saveRules)).toBeLessThan(order(importPreview))
    expect(within(dialog).getByText('Antes de 19 out (início das regras): 7 vão para Histórico importado · só resultado.')).toBeInTheDocument()
  })
})

describe('ImportSheet · rows before the rules (steps d and f)', () => {
  beforeEach(comRegrasDoDono)

  it('every row before v1: «Antes de 17 out (início das regras): 7 vão …», with its info', async () => {
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })

    const { dialog } = await openRules({ accountId: ids.topOne })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).getByText('Antes de 17 out (início das regras): 7 vão para Histórico importado · só resultado.')).toBeInTheDocument()
    const info = within(dialog).getByRole('button', { name: 'Como ler: Histórico importado' })
    await userEvent.click(info)
    expect(document.getElementById('info-antes')).toHaveTextContent(
      'Cada operação é julgada pela versão das regras que valia na entrada. Antes da primeira versão, fica só o resultado, sem janela, limite ou plano. O histórico importado nunca é somado ao Diário.',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 7 operações' }))
    // Every row is before «desde»: Phase 1's line
    expect(await within(dialog).findByText('7 operações em Histórico importado · só resultado, à parte do Diário.')).toBeInTheDocument()
  })

  it('rows on both sides of «desde»: «até {n}» in the preview, and only the older ones in Histórico importado', async () => {
    readFile.mockResolvedValue(topOneFile(3))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })

    const { dialog } = await openRules({ accountId: ids.topOne })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).getByText('Antes de 17 out (início das regras): até 4 vão para Histórico importado · só resultado.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 7 operações' }))
    expect(
      await within(dialog).findByText('7 operações importadas. As de antes de 17 out ficam em Histórico importado · só resultado, à parte do Diário.'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('7 operações em Histórico importado · só resultado, à parte do Diário.')).not.toBeInTheDocument()
  })

  it('every row after «desde»: no line in the preview, and «7 operações importadas.»', async () => {
    readFile.mockResolvedValue(topOneFile(7))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))
    importCommit.mockResolvedValue({ batch_id: 'batch-1', inserted: 7, duplicate: 0, completed: 0, other_account: 0, errors: [] })

    const { dialog } = await openRules({ accountId: ids.topOne })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).queryByText(/^Antes de/)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Como ler: Histórico importado' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Importar 7 operações' }))
    expect(await within(dialog).findByText('7 operações importadas.')).toBeInTheDocument()
  })

  it('an account without rules keeps Phase 1’s preview, with no line', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue(makePreview({ new: 7, rows_total: 7 }))

    const { dialog } = await openRules({ accountId: ids.topOne })
    await chooseFile(dialog)

    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(within(dialog).queryByText(/^Antes de/)).not.toBeInTheDocument()
  })
})

// ------------------------------------------------------------------------------------------------
// Fase 2b: the six markets (board ImportarConta scenarios 7 and 11–14). The owner has Top One and
// Ebinex only (configAntes), so each new market's account is its first; the clock is Mon 19 Oct
// 2026, 12:00 ET (Brasília = ET + 1 h).
// ------------------------------------------------------------------------------------------------

const MERCADOS = ['Futuros (EUA)', 'Opções binárias', 'Forex e CFDs', 'Ações e opções (EUA)', 'Cripto', 'B3']
const pillNames = (group: HTMLElement) => within(group).getAllByRole('button').map((b) => b.textContent)

/** «Qual mercado?» → the market → «Onde você opera?» */
async function toPlatformStep(market: string) {
  const dialog = await openSheet({ mode: 'adicionar' })
  await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
  await userEvent.click(within(dialog).getByRole('button', { name: market }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
  expect(within(dialog).getByRole('heading', { name: 'Onde você opera?' })).toHaveFocus()
  return { dialog, search: within(dialog).getByRole('searchbox', { name: 'Busque mesa, corretora ou plataforma' }) }
}

/** … → «Onde você opera?» with a platform (and a firm) → step b with the nickname typed */
async function toNewAccountStep(market: string, platform: string, label: string, firm?: string) {
  const { dialog, search } = await toPlatformStep(market)
  if (firm) {
    await userEvent.type(search, firm)
    await userEvent.click(within(within(dialog).getByRole('group', { name: 'Mesa · opcional' })).getByRole('button', { name: firm }))
  }
  await userEvent.click(within(dialog).getByRole('button', { name: platform }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
  await userEvent.type(within(dialog).getByLabelText('Apelido'), label)
  return dialog
}

/** The footer's primary button («Fechar» on an end screen; the × is «Fechar» too) */
const primaryOf = (dialog: HTMLElement) => dialog.querySelector('.hub-rodape .hub-btn--pri') as HTMLElement

/** The read-only value under a field label of step b */
const roOf = (dialog: HTMLElement, label: string) =>
  (within(dialog).getByText(label, { selector: '.hub-rot-campo' }).closest('.hub-campo') as HTMLElement).querySelector('.hub-ro')?.textContent

describe('ImportSheet · Fase 2b · «Qual mercado?» (i1)', () => {
  it('offers the six markets in the boards’ order, none disabled, with «Cada conta é de um mercado só.»', async () => {
    const dialog = await openSheet({ mode: 'adicionar' })
    const group = within(dialog).getByRole('group', { name: 'Qual mercado?' })

    expect(pillNames(group)).toEqual(MERCADOS)
    for (const pill of within(group).getAllByRole('button')) {
      expect(pill).toHaveAttribute('aria-pressed', 'false')
      expect(pill).not.toHaveAttribute('aria-disabled')
      expect(pill).not.toBeDisabled()
    }
    expect(group).toHaveAccessibleDescription('Cada conta é de um mercado só.')
    expect(within(dialog).getByText('Passo 1 de 3')).toBeInTheDocument()
  })

  it('a market without a file reader says so under the pills, in the live region and the group’s description', async () => {
    const dialog = await openSheet({ mode: 'adicionar' })
    const group = within(dialog).getByRole('group', { name: 'Qual mercado?' })
    const live = dialog.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live).toHaveTextContent('Cada conta é de um mercado só.')

    const notes: [string, string][] = [
      ['Forex e CFDs', 'de Forex'],
      ['Ações e opções (EUA)', 'de Ações'],
      ['Cripto', 'de Cripto'],
      ['B3', 'da B3'],
    ]
    for (const [pill, de] of notes) {
      await userEvent.click(within(group).getByRole('button', { name: pill }))
      const note = `Ainda não lemos arquivos ${de}: as operações desta conta entram pelo “Registrar operação”, na Fase 3.`
      expect(within(live).getByText(note)).toHaveAttribute('id', 'nota-leitor')
      expect(group).toHaveAttribute('aria-describedby', 'nota-mercado nota-leitor')
      expect(group).toHaveAccessibleDescription(`Cada conta é de um mercado só. ${note}`)
    }
    // Futuros and binaries have a reader: no note
    for (const pill of ['Futuros (EUA)', 'Opções binárias']) {
      await userEvent.click(within(group).getByRole('button', { name: pill }))
      expect(dialog.querySelector('#nota-leitor')).toBeNull()
      expect(group).toHaveAttribute('aria-describedby', 'nota-mercado')
    }
  })

  it('picking another market starts the form again', async () => {
    const { dialog, search } = await toPlatformStep('Forex e CFDs')
    await userEvent.type(search, 'ftmo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'FTMO' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'B3' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

    expect(within(dialog).queryByText(/^Mesa: /)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('searchbox', { name: 'Busque mesa, corretora ou plataforma' })).toHaveValue('')
    for (const pill of within(within(dialog).getByRole('group', { name: 'Plataforma' })).getAllByRole('button')) {
      expect(pill).toHaveAttribute('aria-pressed', 'false')
    }
  })
})

describe('ImportSheet · Fase 2b · «Onde você opera?» (i2)', () => {
  const firmGroup = (dialog: HTMLElement) => within(dialog).getByRole('group', { name: 'Mesa · opcional' })

  it('Forex: the 10 featured firms with their own ⓘ, then «Plataforma»', async () => {
    const { dialog } = await toPlatformStep('Forex e CFDs')

    expect(pillNames(firmGroup(dialog))).toEqual([
      'Alpha Capital',
      'AquaFunded',
      'BrightFunded',
      'E8 Markets',
      'For Traders',
      'FTMO',
      'FundedElite',
      'Moneta Funded',
      'The5ers',
      'Top One Trader',
    ])
    expect(pillNames(within(dialog).getByRole('group', { name: 'Plataforma' }))).toEqual([
      'MetaTrader 5',
      'MetaTrader 4',
      'cTrader',
      'Match-Trader',
      'TradeLocker',
      'DXtrade',
      'TradingView',
      'Outra',
    ])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: lista de mesas' }))
    expect(dialog.querySelector('#info-mesas')).toHaveTextContent(
      'Mesas de forex com nota 4,4 ou mais e pelo menos 100 avaliações verificadas na Prop Firm Match, vistas em outubro de 2026, em ordem alfabética. Não é recomendação nem parceria. A sua não está aqui? Digite o nome.',
    )
    expect(within(dialog).queryByText('Opera numa mesa? Digite o nome na busca.')).not.toBeInTheDocument()
  })

  it('Forex: a firm puts its platforms first and asks for one; the search covers all 39 firms', async () => {
    const { dialog, search } = await toPlatformStep('Forex e CFDs')

    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'FTMO' }))
    expect(within(dialog).getByText('Mesa: FTMO')).toBeInTheDocument()
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()
    expect(pillNames(within(dialog).getByRole('group', { name: 'Plataforma' }))).toEqual([
      'MetaTrader 5',
      'MetaTrader 4',
      'cTrader',
      'TradingView',
      'Match-Trader',
      'TradeLocker',
      'DXtrade',
      'Outra',
    ])
    // The chip stands for the group until a new search, which can swap the firm (a firm not featured)
    expect(within(dialog).queryByRole('group', { name: 'Mesa · opcional' })).not.toBeInTheDocument()
    await userEvent.type(search, 'atmos')
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Atmos Funded' }))
    expect(within(dialog).getByText('Mesa: Atmos Funded')).toBeInTheDocument()
    expect(within(dialog).queryByText('Mesa: FTMO')).not.toBeInTheDocument()
    // Its one platform comes with it
    expect(within(dialog).getByRole('button', { name: 'MetaTrader 5' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()
  })

  it('Forex: the MetaTrader 5 that came with Atmos Funded goes when the owner swaps to a firm without it', async () => {
    const { dialog, search } = await toPlatformStep('Forex e CFDs')
    const mt5 = () => within(dialog).getByRole('button', { name: 'MetaTrader 5' })
    const pickFirm = async (text: string, name: string) => {
      await userEvent.type(search, text)
      await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name }))
      expect(within(dialog).getByText(`Mesa: ${name}`)).toBeInTheDocument()
    }

    await pickFirm('atmos', 'Atmos Funded')
    expect(mt5()).toHaveAttribute('aria-pressed', 'true')

    // Lark Funding: cTrader, Match-Trader and DXtrade, no MetaTrader 5
    await pickFirm('lark', 'Lark Funding')
    expect(mt5()).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()
    // Nothing is chosen for the owner, so «Continuar» waits for a platform
    expect(within(dialog).getByRole('button', { name: 'Continuar' })).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription('Escolha onde você opera.')

    // Tradeify FX brings its MetaTrader 5 again; ThinkCapital lists no platform, so it goes again
    await pickFirm('tradeify fx', 'Tradeify FX')
    expect(mt5()).toHaveAttribute('aria-pressed', 'true')
    await pickFirm('think', 'ThinkCapital')
    expect(mt5()).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()

    // A firm that also offers it keeps it (FTMO has MetaTrader 5)
    await pickFirm('atmos', 'Atmos Funded')
    await pickFirm('ftmo', 'FTMO')
    expect(mt5()).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByText('Agora escolha a plataforma.')).not.toBeInTheDocument()

    // A firm typed by name offers no known platform: the one that came with the firm before goes
    await pickFirm('atmos', 'Atmos Funded')
    await userEvent.type(search, 'Mesa Zeta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar “Mesa Zeta” como mesa' }))
    expect(within(dialog).getByText('Mesa: Mesa Zeta')).toBeInTheDocument()
    expect(mt5()).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()

    // The owner's own choice then reaches step b
    await userEvent.click(within(dialog).getByRole('button', { name: 'cTrader' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(within(dialog).getByText('Mesa Zeta · cTrader')).toBeInTheDocument()
  })

  it('Forex: «top one» finds Top One Trader only; no match says the market’s text and offers the firm by name', async () => {
    const { dialog, search } = await toPlatformStep('Forex e CFDs')

    await userEvent.type(search, 'top one')
    expect(pillNames(firmGroup(dialog))).toEqual(['Top One Trader'])
    // The ⓘ stays with the group while a search shows firms (board `I2.temInfoMesa`)
    expect(within(dialog).getByRole('button', { name: 'Como ler: lista de mesas' })).toHaveAttribute('aria-controls', 'info-mesas')

    await userEvent.clear(search)
    await userEvent.type(search, 'Mesa Zeta')
    // No firm answers: the group goes, and its ⓘ with it
    expect(within(dialog).queryByRole('group', { name: 'Mesa · opcional' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Como ler: lista de mesas' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Nada com esse nome na lista de mesas e plataformas.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar “Mesa Zeta” como mesa' }))
    expect(within(dialog).getByText('Mesa: Mesa Zeta')).toBeInTheDocument()
  })

  it('Cripto: «Corretora ou plataforma», no featured firm (only the note), and firms by the search', async () => {
    const { dialog, search } = await toPlatformStep('Cripto')

    // «Mesa · opcional» with no pills and no ⓘ: the note says the search finds them
    expect(within(dialog).queryByRole('group', { name: 'Mesa · opcional' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Mesa', { selector: '#l-mesas', exact: false })).toBeInTheDocument()
    expect(within(dialog).getByText('Opera numa mesa? Digite o nome na busca.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Como ler: lista de mesas' })).not.toBeInTheDocument()
    expect(pillNames(within(dialog).getByRole('group', { name: 'Corretora ou plataforma' }))).toEqual([
      'Binance',
      'Bybit',
      'OKX',
      'Coinbase',
      'Kraken',
      'Bitget',
      'Mercado Bitcoin',
      'MetaTrader 5',
      'Outra',
    ])

    // «Tradeify 247», never the futures «Tradeify»; it offers other platforms, so MetaTrader 5 is not chosen for the owner
    await userEvent.type(search, 'tradeify')
    expect(pillNames(firmGroup(dialog))).toEqual(['Tradeify 247'])
    expect(within(dialog).queryByText('Opera numa mesa? Digite o nome na busca.')).not.toBeInTheDocument()
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Tradeify 247' }))
    expect(within(dialog).getByText('Mesa: Tradeify 247')).toBeInTheDocument()
    expect(within(dialog).getByText('Agora escolha a corretora ou a plataforma.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'MetaTrader 5' })).toHaveAttribute('aria-pressed', 'false')
    // With a firm chosen, the note is gone too: the chip stands for the group
    expect(within(dialog).queryByText('Opera numa mesa? Digite o nome na busca.')).not.toBeInTheDocument()

    await userEvent.type(search, 'xyz')
    expect(within(dialog).getByText('Nada com esse nome na lista de mesas e corretoras.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Usar “xyz” como mesa' })).toBeInTheDocument()
  })

  it('Ações: «Corretora», Trade The Pool by its alias, «Agora escolha a corretora.»', async () => {
    const { dialog, search } = await toPlatformStep('Ações e opções (EUA)')

    expect(within(dialog).getByText('Opera numa mesa? Digite o nome na busca.')).toBeInTheDocument()
    expect(pillNames(within(dialog).getByRole('group', { name: 'Corretora' }))).toEqual([
      'Interactive Brokers',
      'thinkorswim (Schwab)',
      'Webull',
      'tastytrade',
      'Tradier',
      'Avenue',
      'Nomad',
      'Outra',
    ])
    await userEvent.type(search, 'TTP')
    await userEvent.click(within(firmGroup(dialog)).getByRole('button', { name: 'Trade The Pool' }))
    expect(within(dialog).getByText('Mesa: Trade The Pool')).toBeInTheDocument()
    expect(within(dialog).getByText('Agora escolha a corretora.')).toBeInTheDocument()

    await userEvent.type(search, 'zzz')
    expect(within(dialog).getByText('Nada com esse nome na lista de mesas e corretoras.')).toBeInTheDocument()
  })

  it('B3: «Plataforma», no firm list, the firm by name only', async () => {
    const { dialog, search } = await toPlatformStep('B3')

    expect(within(dialog).getByText('Opera numa mesa? Digite o nome na busca.')).toBeInTheDocument()
    expect(pillNames(within(dialog).getByRole('group', { name: 'Plataforma' }))).toEqual(['Profit (Nelogica)', 'Tryd', 'MetaTrader 5', 'Outra'])
    await userEvent.type(search, 'Mesa Ômega')
    expect(within(dialog).getByText('Nada com esse nome na lista de plataformas.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar “Mesa Ômega” como mesa' }))
    expect(within(dialog).getByText('Mesa: Mesa Ômega')).toBeInTheDocument()
    expect(within(dialog).getByText('Agora escolha a plataforma.')).toBeInTheDocument()
    // Accents ignored: «tryd» answers, no «Nada com esse nome»
    await userEvent.type(search, 'TRYD')
    expect(pillNames(within(dialog).getByRole('group', { name: 'Plataforma' }))).toEqual(['Tryd', 'Outra'])
    expect(within(dialog).queryByText(/^Nada com esse nome/)).not.toBeInTheDocument()
  })
})

describe('ImportSheet · Fase 2b · «Nova conta de …» (step b) and «{conta} criada.»', () => {
  const ftmo = makeAccount({ id: 'nova', label: 'FTMO 100k', market: 'forex', platform: 'mt5', firm: 'FTMO', phase: 'avaliacao' })

  it('scenario 11 · Forex at FTMO: Fase required, «Moeda e virada do dia», no «Copiar», the suggested window, US$', async () => {
    createAccount.mockResolvedValue(ftmo)
    mockAgora.at = et('2026-10-19 12:00')
    const dialog = await toNewAccountStep('Forex e CFDs', 'MetaTrader 5', 'FTMO 100k', 'FTMO')

    expect(within(dialog).getByRole('heading', { name: 'Nova conta de forex' })).toBeInTheDocument()
    expect(roOf(dialog, 'Mesa e plataforma')).toBe('FTMO · MetaTrader 5')
    expect(pillNames(within(dialog).getByRole('group', { name: 'Fase' }))).toEqual(['Avaliação', 'Financiada', 'Pessoal'])
    expect(within(dialog).queryByText('Tipo')).not.toBeInTheDocument()
    // The phase is required: «Criar» says so
    const create = within(dialog).getByRole('button', { name: 'Criar FTMO 100k' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAccessibleDescription('Escolha a fase.')

    // «Moeda e virada do dia», after the platform row, and its ⓘ with the firm's sentence
    expect(roOf(dialog, 'Moeda e virada do dia')).toBe('US$ · o dia vira às 17:00 ET (18:00 em Brasília hoje)')
    const info = within(dialog).getByRole('button', { name: 'Como ler: moeda e virada do dia' })
    expect(info).toHaveAttribute('aria-controls', 'info-moeda')
    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(dialog.querySelector('#info-moeda')).toHaveTextContent(
      'A moeda e a virada do dia ficam fixas nesta conta. O limite do dia é a sua regra: a mesa pode zerar o dela em outro horário.',
    )

    expect(within(dialog).getByLabelText(/^Tamanho US\$/)).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/^Tamanho US\$/), '100.000')
    // First account of the market: no «Copiar regras de», only the note
    expect(within(dialog).queryByLabelText('Copiar regras de')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Começa com o padrão do mercado.')).toBeInTheDocument()
    expect(linhaRegra(dialog)).toBe('Janela: sem janela · limite do dia: definir')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    expect(within(dialog).getByLabelText('Início da janela de Forex, horário de Nova York')).toHaveValue('08:00')
    expect(within(dialog).getByLabelText('Fim da janela de Forex, horário de Nova York')).toHaveValue('10:00')
    const dias = within(dialog).getByRole('group', { name: 'Dias da janela' })
    expect(within(dias).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true', 'true', 'false', 'false'])
    expect(within(dialog).queryByText('Cripto abre todos os dias: sábado e domingo já vêm marcados.')).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Limite do dia, US$'), '500')
    expect(linhaRegra(dialog)).toBe(`Janela 08:00–10:00 (Nova York) · padrão de Forex · limite do dia: US$${NBSP}500`)
    // No «por conta / somando», no second window, no «Mais regras da mesa» (as drawn)
    expect(within(dialog).queryByRole('group', { name: 'Como o limite conta' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Segunda janela/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Mais regras da mesa/)).not.toBeInTheDocument()
    // «Cancelar esta janela» undoes it
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar a janela nova de Forex' }))
    expect(linhaRegra(dialog)).toBe(`Janela: sem janela · limite do dia: US$${NBSP}500`)
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))

    await userEvent.click(within(dialog).getByRole('button', { name: 'Avaliação' }))
    expect(create).not.toHaveAttribute('aria-disabled')
    // No «e continuar»: there is no file to go on with
    await userEvent.click(create)

    expect(await within(dialog).findByRole('heading', { name: 'FTMO 100k criada.' })).toHaveFocus()
    expect(createAccount).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      market: 'forex',
      label: 'FTMO 100k',
      platform: 'mt5',
      firm: 'FTMO',
      external_ref: null,
      phase: 'avaliacao',
      size: '100000',
      is_primary: false,
    })
    // v1 with the market's first window (which becomes Forex's) and the limit in dollars
    const payload = payloadOf(0)
    expect(payload.defaults?.forex?.windows).toEqual([{ tz: 'America/New_York', start_min: 480, end_min: 600, weekdays: 31 }])
    expect(payload.accounts?.nova).toEqual({
      rules: { v: 1, limit: { usd: 500, mode: 'conta', at_limit: 'encerrar' } },
      window: null,
      version: 'force',
    })
    // The end screen: where trades will come from, the MetaTrader 5 report, «Fechar»
    expect(within(dialog).getByText('Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Ainda não lemos arquivos de Forex. O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Importar histórico' })).not.toBeInTheDocument()
    expect(primaryOf(dialog)).toHaveTextContent('Fechar')
    await userEvent.click(primaryOf(dialog))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('the end screen names the MetaTrader 4 report, and the CSV mapping for other platforms', async () => {
    createAccount.mockResolvedValue({ ...ftmo, platform: 'mt4' })
    const mt4 = await toNewAccountStep('Forex e CFDs', 'MetaTrader 4', 'FTMO 100k')
    await userEvent.click(within(mt4).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(mt4).getByRole('button', { name: 'Criar FTMO 100k' }))
    expect(
      await within(mt4).findByText(
        'Ainda não lemos arquivos de Forex. O relatório do MetaTrader 4 sai em HTML e vai precisar de um leitor próprio, que vem depois.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(primaryOf(mt4))

    createAccount.mockResolvedValue({ ...ftmo, platform: 'ctrader' })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Forex e CFDs' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'cTrader' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'FTMO 100k')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar FTMO 100k' }))
    expect(
      await within(dialog).findByText('Ainda não lemos arquivos de Forex. Depois vem a importação de CSV em que você diz o que é cada coluna.'),
    ).toBeInTheDocument()
  })

  it('scenario 12 · Cripto at Binance: Brasília midnight, USDT in the ⓘ, the window with Saturday and Sunday', async () => {
    createAccount.mockResolvedValue(makeAccount({ id: 'nova', label: 'Binance', market: 'crypto', platform: 'binance', phase: 'pessoal' }))
    const dialog = await toNewAccountStep('Cripto', 'Binance', 'Binance')

    expect(within(dialog).getByRole('heading', { name: 'Nova conta de cripto' })).toBeInTheDocument()
    expect(roOf(dialog, 'Corretora ou plataforma')).toBe('Binance')
    expect(roOf(dialog, 'Moeda e virada do dia')).toBe('US$ · o dia vira à meia-noite de Brasília')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: moeda e virada do dia' }))
    expect(dialog.querySelector('#info-moeda')).toHaveTextContent('USDT e USDC contam como dólar. A moeda e a virada do dia ficam fixas nesta conta.')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    expect(within(dialog).getByLabelText('Início da janela de Cripto, horário de Brasília')).toHaveValue('20:00')
    expect(within(dialog).getByLabelText('Fim da janela de Cripto, horário de Brasília')).toHaveValue('22:00')
    const dias = within(dialog).getByRole('group', { name: 'Dias da janela' })
    for (const day of within(dias).getAllByRole('button')) expect(day).toHaveAttribute('aria-pressed', 'true')
    const nota = within(dialog).getByText('Cripto abre todos os dias: sábado e domingo já vêm marcados.')
    expect(dias).toHaveAccessibleDescription('Cripto abre todos os dias: sábado e domingo já vêm marcados.')
    // Under the days, before «Cancelar esta janela» (board)
    const cancelar = within(dialog).getByRole('button', { name: 'Cancelar a janela nova de Cripto' })
    expect(dias.compareDocumentPosition(nota) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(nota.compareDocumentPosition(cancelar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.type(within(dialog).getByLabelText('Limite do dia, US$'), '200')
    expect(linhaRegra(dialog)).toBe(`Janela 20:00–22:00 (Brasília) · padrão de Cripto · limite do dia: US$${NBSP}200`)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Binance' }))

    await within(dialog).findByRole('heading', { name: 'Binance criada.' })
    expect(createAccount.mock.calls[0][2]).toMatchObject({ market: 'crypto', platform: 'binance', firm: null, phase: 'pessoal' })
    expect(payloadOf(0).defaults?.crypto?.windows).toEqual([{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1320, weekdays: 127 }])
    expect(
      within(dialog).getByText('Ainda não lemos arquivos de Cripto. Depois vem a importação de CSV em que você diz o que é cada coluna.'),
    ).toBeInTheDocument()
  })

  it('scenario 13 · Ações at IBKR: «Corretora», the day turns at 20:00 ET (21:00, then 22:00 in Brasília after 1 Nov)', async () => {
    const dialog = await toNewAccountStep('Ações e opções (EUA)', 'Interactive Brokers', 'IBKR')

    expect(within(dialog).getByRole('heading', { name: 'Nova conta de ações' })).toBeInTheDocument()
    expect(roOf(dialog, 'Corretora')).toBe('Interactive Brokers')
    expect(roOf(dialog, 'Moeda e virada do dia')).toBe('US$ · o dia vira às 20:00 ET (21:00 em Brasília hoje)')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: moeda e virada do dia' }))
    // No firm: no firm sentence; not crypto: no USDT
    expect(dialog.querySelector('#info-moeda')).toHaveTextContent(/^A moeda e a virada do dia ficam fixas nesta conta\.$/)
    moveClock(et('2026-11-02 09:00'))
    expect(roOf(dialog, 'Moeda e virada do dia')).toBe('US$ · o dia vira às 20:00 ET (22:00 em Brasília hoje)')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    expect(within(dialog).getByLabelText('Início da janela de Ações, horário de Nova York')).toHaveValue('09:30')
    expect(within(dialog).getByLabelText('Fim da janela de Ações, horário de Nova York')).toHaveValue('10:30')
  })

  it('scenario 14 · B3 in reais: «Tamanho R$», «Limite do dia, R$», R$ errors, and v1 stores the limit as `brl`', async () => {
    createAccount.mockResolvedValue(makeAccount({ id: 'nova', label: 'Mini-índice', market: 'b3', platform: 'profit', phase: 'pessoal' }))
    const dialog = await toNewAccountStep('B3', 'Profit (Nelogica)', 'Mini-índice')

    expect(within(dialog).getByRole('heading', { name: 'Nova conta da B3' })).toBeInTheDocument()
    expect(roOf(dialog, 'Plataforma')).toBe('Profit (Nelogica)')
    expect(roOf(dialog, 'Moeda e virada do dia')).toBe('R$ · o dia vira à meia-noite de Brasília')
    expect(within(dialog).getByLabelText(/^Tamanho R\$/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^Tamanho US\$/)).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    const limite = within(dialog).getByLabelText('Limite do dia, R$')
    await userEvent.type(limite, '2.000.000')
    const create = within(dialog).getByRole('button', { name: 'Criar Mini-índice' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAccessibleDescription('Use um valor até R$ 1.000.000.')
    await userEvent.clear(limite)
    await userEvent.type(limite, '400')
    expect(linhaRegra(dialog)).toBe(`Janela: sem janela · limite do dia: R$${NBSP}400`)
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Definir janela' }))
    expect(linhaRegra(dialog)).toBe(`Janela 10:00–11:00 (Brasília) · padrão da B3 · limite do dia: R$${NBSP}400`)
    await userEvent.type(within(dialog).getByLabelText(/^Tamanho R\$/), '25.000')

    await userEvent.click(create)

    await within(dialog).findByRole('heading', { name: 'Mini-índice criada.' })
    expect(createAccount).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ market: 'b3', platform: 'profit', firm: null, phase: 'pessoal', size: '25000' }),
    )
    const payload = payloadOf(0)
    expect(payload.defaults?.b3?.windows).toEqual([{ tz: 'America/Sao_Paulo', start_min: 600, end_min: 660, weekdays: 31 }])
    expect(payload.accounts?.nova).toEqual({
      rules: { v: 1, limit: { brl: 400, mode: 'conta', at_limit: 'encerrar' } },
      window: null,
      version: 'force',
    })
    expect(within(dialog).getByText('Ainda não lemos arquivos da B3. Depois vem a importação de CSV em que você diz o que é cada coluna.')).toBeInTheDocument()
  })

  it('a second account in a Fase 2b market copies the first one’s rules: window and limit only', async () => {
    fetchAccounts.mockResolvedValue(contasMercados())
    fetchRulesConfig.mockResolvedValue(configMercados())
    createAccount.mockResolvedValue(makeAccount({ id: 'nova', label: 'Clear 2', market: 'b3', platform: 'tryd', phase: 'pessoal' }))
    const dialog = await toNewAccountStep('B3', 'Tryd', 'Clear 2')

    const select = within(dialog).getByLabelText('Copiar regras de')
    expect(select).toHaveDisplayValue('Clear')
    expect(select).toHaveAccessibleDescription('Copia janela e limite do dia.')
    expect(linhaRegra(dialog)).toBe(`Janela 10:00–11:00 (Brasília) · padrão da B3 · limite do dia: R$${NBSP}500`)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar' }))
    expect(within(dialog).getByText('Usar a janela da B3 (10:00–11:00 de Brasília)?')).toBeInTheDocument()
    expect(within(dialog).queryByRole('group', { name: 'Como o limite conta' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Limite do dia, R$')).toHaveValue('500')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Clear 2' }))
    await within(dialog).findByRole('heading', { name: 'Clear 2 criada.' })
    expect(payloadOf(0).base_rev).toBe(configMercados().rev)
    expect(payloadOf(0).defaults).toBeUndefined()
    expect(payloadOf(0).accounts).toEqual({
      nova: {
        rules: { v: 1, limit: { brl: 500, mode: 'conta', at_limit: 'encerrar' } },
        window: null,
        version: 'force',
        copied_from: idsMercados().clear,
      },
    })
  })

  it('Futuros and binaries are as before: no «Moeda e virada do dia»; binaries keep «Tipo: Pessoal»', async () => {
    const dialog = await openSheet({ mode: 'adicionar' })
    await fillNewFuturesAccount(dialog, 'Apex B')
    expect(within(dialog).queryByText('Moeda e virada do dia')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Tamanho US\$/)).toBeInTheDocument()
    expect(roOf(dialog, 'Plataforma')).toBe('Rithmic')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Opções binárias' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pocket Option' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(within(dialog).queryByText('Moeda e virada do dia')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('group', { name: 'Fase' })).not.toBeInTheDocument()
    expect(roOf(dialog, 'Tipo')).toBe('Pessoal')
    expect(roOf(dialog, 'Corretora')).toBe('Pocket Option')
    expect(within(dialog).queryByLabelText(/^Tamanho/)).not.toBeInTheDocument()
  })
})

describe('ImportSheet · Fase 2b · an account without a file reader is never a file’s destination', () => {
  it('«Importar» with a Forex account in context opens as «Escolha o arquivo» and asks for the account', async () => {
    const forex = makeAccount({ label: 'FTMO', market: 'forex', platform: 'mt5', firm: 'FTMO', phase: 'avaliacao' })
    fetchAccounts.mockResolvedValue([topOne, ebinex, forex])
    readFile.mockResolvedValue(fixtureFile('ebinex_atual_ok'))

    const dialog = await openSheet({ accountId: forex.id })
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    expect(await within(dialog).findByRole('heading', { name: 'Escolha o arquivo' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Importar histórico de FTMO' })).not.toBeInTheDocument()

    await chooseFile(dialog)

    // Not «Este arquivo é de binárias»: the forex account was never the destination
    expect(await within(dialog).findByRole('heading', { name: 'Para qual conta?' })).toHaveFocus()
    expect(pillNames(within(dialog).getByRole('group', { name: 'Para qual conta?' }))).toEqual(['Ebinex', '+ Nova conta de binárias'])
  })

  it('names any market in «A conta escolhida é …»', () => {
    // Typed and worded for every market, though no file reaches these accounts
    expect(PASSO_G.accountIs('futures')).toBe('A conta escolhida é de Futuros.')
    expect(PASSO_G.accountIs('binary')).toBe('A conta escolhida é de binárias.')
    expect(PASSO_G.accountIs('forex')).toBe('A conta escolhida é de Forex.')
    expect(PASSO_G.accountIs('b3')).toBe('A conta escolhida é da B3.')
  })
})

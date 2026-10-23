/**
 * Phase 3b · telas, lane L2: the import sheet around the column mapping, through the approved board's states (contract
 * §2.2, §6, §8.2), in the board's world (testing/mapeadoTelas, B0) with the database's answers composed in
 * testing/mapeadoRespostas (each proven against the real SQL by hubImportTelas.pg.test.ts). Invented data only.
 *
 * Until lane L1's steps are merged, «mapa» and «conferir» are B0's placeholders (their title only); a stand-in control
 * under each («stub: responder», «stub: Mudar colunas») gives the answers the board gives on them, through the steps'
 * own props (onChange, onMudarColunas). After the rebase on L1 these become the real pills (§7.4).
 */
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as data from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import { accountRouteHash, endOfFileKey, readImportFile, toRpcRow, type Template } from '@/lib/domain/import'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import type { Mapeamento } from '@/lib/hub/importMapeado'
import type { PassoMapaProps } from '@/components/hub/importar/PassoMapa'
import type { PassoConferirProps } from '@/components/hub/importar/PassoConferir'
import { renderHub } from '@/testing/hubHarness'
import {
  CONTAS_QUADRO,
  HOJE_QUADRO,
  MODELO_BLACKARROW_LINHA,
  arquivoQuadro,
  contasQuadro,
  lidoQuadro,
  modeloBlackArrow,
  modeloTradovate,
  type ArquivoQuadroKey,
  type ContaQuadro,
} from '@/testing/mapeadoTelas'
import { ESTADOS_QUADRO, arquivoDoEstado, commitQuadro, previaQuadro, regrasQuadro, type EstadoQuadro } from '@/testing/mapeadoRespostas'
import { fixtureFile } from '@/testing/hubHarness'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/components/hub/registrar/RegistrarSheet', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchImportFormats: jest.fn(),
  fetchTemplates: jest.fn(),
  createAccount: jest.fn(),
  importPreview: jest.fn(),
  importCommit: jest.fn(),
  importUndo: jest.fn(),
  importFixTz: jest.fn(),
  saveTemplate: jest.fn(),
}))
jest.mock('@/lib/domain/import', () => ({ ...jest.requireActual('@/lib/domain/import'), readImportFile: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  saveRules: jest.fn(),
  fetchTradesSince: jest.fn(),
}))
jest.mock('@/hooks/useAgora', () => ({ useAgora: () => new Date('2026-10-15T15:00:00Z') }))

/** What «stub: responder» does to the mapping (the answers the board gives on «mapa» and «conferir») */
let mockAplicar: ((m: Mapeamento) => Mapeamento) | null = null
/** The stand-in controls under B0's placeholders (replaced by L1's pills after the rebase) */
function mockControles(p: { mapeamento: Mapeamento; onChange: (m: Mapeamento) => void; onMudarColunas?: (() => void) | null }) {
  return (
    <div data-testid="stub">
      <button type="button" onClick={() => mockAplicar && p.onChange(mockAplicar(p.mapeamento))}>
        stub: responder
      </button>
      {p.onMudarColunas && (
        <button type="button" onClick={() => p.onMudarColunas?.()}>
          stub: Mudar colunas
        </button>
      )}
    </div>
  )
}
jest.mock('@/components/hub/importar/PassoMapa', () => {
  const real = jest.requireActual('@/components/hub/importar/PassoMapa')
  return {
    __esModule: true,
    default: (p: PassoMapaProps) => (
      <>
        {real.default(p)}
        {mockControles(p)}
      </>
    ),
  }
})
jest.mock('@/components/hub/importar/PassoConferir', () => {
  const real = jest.requireActual('@/components/hub/importar/PassoConferir')
  return {
    __esModule: true,
    default: (p: PassoConferirProps) => (
      <>
        {real.default(p)}
        {mockControles(p)}
      </>
    ),
  }
})

const fetchAccounts = data.fetchAccounts as jest.MockedFunction<typeof data.fetchAccounts>
const fetchImportFormats = data.fetchImportFormats as jest.MockedFunction<typeof data.fetchImportFormats>
const fetchTemplates = data.fetchTemplates as jest.MockedFunction<typeof data.fetchTemplates>
const createAccount = data.createAccount as jest.MockedFunction<typeof data.createAccount>
const importPreview = data.importPreview as jest.MockedFunction<typeof data.importPreview>
const importCommit = data.importCommit as jest.MockedFunction<typeof data.importCommit>
const importUndo = data.importUndo as jest.MockedFunction<typeof data.importUndo>
const saveTemplate = data.saveTemplate as jest.MockedFunction<typeof data.saveTemplate>
const readFile = readImportFile as jest.MockedFunction<typeof readImportFile>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>

const NY = 'America/New_York'

function Abrir({ accountId }: { accountId: string | null }) {
  const sheet = useImportSheet()
  return (
    <button type="button" onClick={(event) => sheet.open({ mode: 'importar', accountId, opener: event.currentTarget })}>
      Abrir
    </button>
  )
}

/** Opens the sheet on `conta` (null: no account in context) and gives it the board's file */
async function abrir(conta: ContaQuadro | null, key: ArquivoQuadroKey, file: File = arquivoQuadro(key)) {
  readFile.mockResolvedValue(lidoQuadro(key))
  renderHub(<Abrir accountId={conta ? CONTAS_QUADRO[conta].id : null} />)
  await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  const dialog = screen.getByRole('dialog')
  await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
  await act(async () => {
    fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [file] } })
  })
  return dialog
}

const primaryOf = (dialog: HTMLElement) => dialog.querySelector('.hub-rodape .hub-btn--pri') as HTMLElement
const statusOf = (dialog: HTMLElement) => dialog.querySelector('p.sr-only[role="status"]') as HTMLElement
const cardOf = (dialog: HTMLElement) => dialog.querySelector('.hub-arq__txt')?.textContent ?? null
const indicatorOf = (dialog: HTMLElement) => dialog.querySelector('.hub-ind > span')?.textContent ?? null
const texto = (el: Element) => {
  const c = el.cloneNode(true) as Element
  c.querySelectorAll('button').forEach((b) => b.remove())
  return (c.textContent ?? '').replace(/\s+/g, ' ').replace(/\s*·\s*/g, ' · ').trim()
}
/** The step's blocks in order, without their buttons' text */
const linhas = (dialog: HTMLElement) =>
  Array.from((dialog.querySelector('.hub-passo') as HTMLElement).children)
    .map(texto)
    .filter(Boolean)

async function responder(dialog: HTMLElement, aplicar: (m: Mapeamento) => Mapeamento) {
  mockAplicar = aplicar
  await userEvent.click(within(dialog).getByRole('button', { name: 'stub: responder' }))
  mockAplicar = null
}

const continuar = (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))
const usar = (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', { name: 'Usar estas colunas' }))

/** The zone radio of a zone name */
const radioDe = (dialog: HTMLElement, nome: RegExp) => within(dialog).getByRole('radio', { name: nome })

async function escolherZona(dialog: HTMLElement, tz: string) {
  if (tz === 'America/Chicago') {
    await userEvent.click(radioDe(dialog, /^Outro/))
    await userEvent.selectOptions(within(dialog).getByLabelText('Qual fuso?'), 'chi')
    return
  }
  const nome = tz === NY ? /^Nova York/ : tz === 'America/Sao_Paulo' ? /^Brasília/ : /^UTC/
  await userEvent.click(radioDe(dialog, nome))
}

beforeEach(() => {
  for (const m of [fetchAccounts, fetchImportFormats, fetchTemplates, createAccount, importPreview, importCommit, importUndo, saveTemplate, readFile, fetchRulesConfig, saveRules]) {
    m.mockReset()
  }
  fetchAccounts.mockResolvedValue(contasQuadro())
  fetchImportFormats.mockResolvedValue({ [CONTAS_QUADRO.topOne.id]: ['topone'] })
  fetchTemplates.mockResolvedValue([])
  fetchRulesConfig.mockResolvedValue(regrasQuadro())
  saveTemplate.mockResolvedValue({ template_id: '3b0c0a00-0000-4000-8000-0000000000f1', header_sig: 'ab'.repeat(32), created: true })
  mockAplicar = null
  expect(HOJE_QUADRO.toISOString()).toBe('2026-10-15T15:00:00.000Z')
})

/**
 * Drives the sheet to the state's «Prévia» as the board does: the account in context, the file, the answers on «mapa»
 * (side words, dates, the net and end-of-file answers kept for «conferir»), hc, the zone
 */
async function ateAPrevia(e: EstadoQuadro, extra: { liquido?: boolean; templates?: Template[] } = {}) {
  const d = ESTADOS_QUADRO[e]
  fetchAccounts.mockResolvedValue(contasQuadro(d.conta === 'ylosDepois'))
  fetchTemplates.mockResolvedValue(extra.templates ?? (d.modelo ? [modeloBlackArrow()] : []))
  if (d.conta === 'ylosDepois') fetchImportFormats.mockResolvedValue({ [CONTAS_QUADRO.ylos.id]: ['modelo'], [CONTAS_QUADRO.topOne.id]: ['topone'] })
  importPreview.mockResolvedValue(previaQuadro(e))
  const dialog = await abrir(d.conta, d.arquivo)
  const { accountValue, ...respostas } = d.respostas
  const r = { ...respostas, ...(extra.liquido === undefined ? {} : { resultIsNet: extra.liquido }) }
  // The step after the file is read (never the drop step)
  const primeiro = await within(dialog).findByRole('heading', { level: 3, name: (n) => !/^(Importar histórico|Escolha)/.test(n) })
  if (primeiro.textContent !== 'Prévia') {
    await within(dialog).findByTestId('stub')
    await responder(dialog, (m) => ({ ...m, ...r }))
    if (within(dialog).queryByRole('button', { name: 'Continuar' })) await continuar(dialog)
    await usar(dialog)
    if (accountValue) {
      const linha = await within(dialog).findByRole('combobox', { name: `O que fazer com ${accountValue}` })
      await userEvent.selectOptions(linha, 'importar')
      await continuar(dialog)
    }
    const passo = await within(dialog).findByRole('heading', { level: 3, name: /Prévia|Em que fuso/ })
    if (passo.textContent !== 'Prévia') {
      await escolherZona(dialog, d.tz)
      await continuar(dialog)
    }
  }
  await within(dialog).findByRole('heading', { level: 3, name: 'Prévia' })
  return dialog
}

// ================================================================================================
// Reading and routing (§6.2)
// ================================================================================================

describe('reading and routing a file', () => {
  it('a reader’s file goes as built: the as-built RPCs and arguments, never import_templates', async () => {
    fetchAccounts.mockResolvedValue(contasQuadro())
    readFile.mockResolvedValue(fixtureFile('topone_ok'))
    importPreview.mockResolvedValue({ ...previaQuadro('8g'), other_source: undefined, new: 7, rows_total: 7 })
    renderHub(<Abrir accountId={CONTAS_QUADRO.topOne.id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [new File(['x'], 'Trade-History.csv')] } })
    })
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1]).not.toHaveProperty('p_format')
    expect(importPreview.mock.calls[0][1].p_platform).toBe('topone')
    expect(fetchTemplates).not.toHaveBeenCalled()
    // The card's ⓘ: both of the board's sentences, for a reader's file too (E1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: arquivo' }))
    expect(dialog.querySelector('#info-arq')).toHaveTextContent(
      'Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo. Quando não reconhecemos, você diz o que é cada coluna uma vez e salva como modelo.',
    )
  })

  it('a file no reader takes, in an account’s context: «mapa» with its card; the models are read once', async () => {
    const dialog = await abrir('ylos', 'f8')
    expect(await within(dialog).findByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toHaveFocus()
    expect(cardOf(dialog)).toBe('Arquivo não reconhecido · 18 linhas')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 4')
    expect(fetchTemplates).toHaveBeenCalledTimes(1)
    expect(importPreview).not.toHaveBeenCalled()
  })

  it('the header routeFile gets is the readers’ comma read: a «;» file with Top One’s names is a mapping, never the reader', async () => {
    const header = 'Ticket #;Symbol;Side;SL;TP;Open Time;Open Price;Close Time;Close Price;Duration;PnL;Lots;Commissions;Gain'
    const text = `${header}\n1;MESZ6;BUY;0;0;01/10/2026 14:30:00;6801;01/10/2026 14:40:00;6803;10m 0s;$10;1;1.24;0.02%\n`
    readFile.mockResolvedValue({ fileName: 'top.csv', size: text.length, sha256: 'ab'.repeat(32), outcome: { ok: false, error: 'unknown_format' } })
    renderHub(<Abrir accountId={CONTAS_QUADRO.topOne.id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [new File([text], 'top.csv')] } })
    })
    expect(await within(dialog).findByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toBeInTheDocument()
  })

  it('a near-complete Top One header without an account stays the reader’s error («Faltam colunas…»), never «Para qual conta?»', async () => {
    const header = 'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots'
    readFile.mockResolvedValue({
      fileName: 'th.csv',
      size: 10,
      sha256: 'ab'.repeat(32),
      outcome: { ok: false, error: 'missing_columns', platform: 'topone', missingColumns: ['Commissions', 'Gain'] },
    })
    renderHub(<Abrir accountId={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [new File([`${header}\n`], 'th.csv')] } })
    })
    expect(await within(dialog).findByText('Faltam colunas: Commissions, Gain.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Para qual conta?' })).not.toBeInTheDocument()
  })

  it('9 · «Arquivo não reconhecido em binárias»: the card from the file above E47; «Escolher outro arquivo» → «Escolha outro arquivo»', async () => {
    const dialog = await abrir('ebinex', 'f19')
    expect(await within(dialog).findByRole('heading', { name: 'Não conseguimos ler o arquivo.' })).toHaveFocus()
    expect(within(dialog).getByText('Em contas de binárias, lemos só o CSV da Ebinex.')).toBeInTheDocument()
    expect(cardOf(dialog)).toBe('Arquivo não reconhecido · 18 linhas')
    expect(fetchTemplates).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escolher outro arquivo' }))
    expect(within(dialog).getByRole('heading', { name: 'Escolha outro arquivo' })).toHaveFocus()
    expect(dialog.querySelector('.hub-arq')).toBeNull()
  })

  it('9 · «Arquivo que não abre»: «Não achamos a linha com os nomes das colunas.», no card', async () => {
    const dialog = await abrir('ylos', 'f9ilegivel')
    expect(await within(dialog).findByRole('heading', { name: 'Não conseguimos ler o arquivo.' })).toHaveFocus()
    expect(within(dialog).getByText('Não achamos a linha com os nomes das colunas.')).toBeInTheDocument()
    expect(dialog.querySelector('.hub-arq')).toBeNull()
  })

  it('a file of more than 100 columns: «O arquivo passa de 100 colunas.» (N)', async () => {
    const header = Array.from({ length: 101 }, (_, i) => `c${i}`).join(',')
    const row = Array.from({ length: 101 }, (_, i) => String(i)).join(',')
    const file = new File([`${header}\n${row}\n`], 'largo.csv')
    readFile.mockResolvedValue({ fileName: 'largo.csv', size: 10, sha256: 'ab'.repeat(32), outcome: { ok: false, error: 'unknown_format' } })
    renderHub(<Abrir accountId={CONTAS_QUADRO.ylos.id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [file] } })
    })
    expect(await within(dialog).findByText('O arquivo passa de 100 colunas.')).toBeInTheDocument()
  })

  it('the models cannot be read: the file goes on as with none (no alert)', async () => {
    fetchTemplates.mockRejectedValue(new data.HubDataError('network'))
    const dialog = await abrir('ylosDepois', 'f15')
    expect(await within(dialog).findByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ================================================================================================
// a2 · «Para qual conta?» (scenario 19)
// ================================================================================================

describe('a2 · «Para qual conta?» for an unrecognised file (19)', () => {
  it('«Escolha o arquivo» → the card, the mapping markets’ groups in the board’s order, nothing pressed, «Passo 1 de 5»', async () => {
    renderHub(<Abrir accountId={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('heading', { name: 'Escolha o arquivo' })).toBeInTheDocument()
    readFile.mockResolvedValue(lidoQuadro('f19'))
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [arquivoQuadro('f19')] } })
    })

    expect(await within(dialog).findByRole('heading', { name: 'Para qual conta?' })).toHaveFocus()
    expect(cardOf(dialog)).toBe('Arquivo não reconhecido · 18 linhas')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 5')
    expect(within(dialog).getByText('Não reconhecemos este arquivo: escolha a conta, e depois você diz o que é cada coluna.')).toBeInTheDocument()
    const grupos = Array.from(dialog.querySelectorAll('.hub-grupo-a')).map((g) => [
      g.querySelector('.hub-rotulo')?.textContent,
      Array.from(g.querySelectorAll('button')).map((b) => b.textContent),
    ])
    expect(grupos).toEqual([
      ['Futuros', ['Top One', 'Apex A', 'Ylos 50k', 'Lucid 50k']],
      ['Forex', ['E8 50k']],
      ['Ações', ['IBKR']],
      ['Cripto', ['Binance']],
      ['B3', ['Mini-índice']],
    ])
    // Each group is named by its label; no binaries group, the note says why
    expect(within(dialog).getByRole('group', { name: 'Futuros' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Ebinex' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Contas de binárias recebem só o CSV da Ebinex.')).toBeInTheDocument()
    for (const b of within(dialog).getAllByRole('button', { pressed: false })) expect(b).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(primaryOf(dialog)).toHaveAttribute('aria-disabled', 'true')
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Escolha a conta.')
    expect(fetchTemplates).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mini-índice' }))
    expect(within(dialog).getByRole('button', { name: 'Mini-índice' })).toHaveAttribute('aria-pressed', 'true')
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 2 de 5')
    // «Voltar» goes back to a2 with the choice kept
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Para qual conta?' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Mini-índice' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('«+ Nova conta» → «Qual mercado?» without binaries → «Onde você opera?» → «Criar … e continuar» → «mapa» on the new account', async () => {
    const nova = { ...CONTAS_QUADRO.mini, id: '3b0c0a00-0000-4000-8000-0000000000aa', label: 'Clear B3' }
    createAccount.mockResolvedValue(nova)
    const dialog = await abrir(null, 'f19')
    await within(dialog).findByRole('heading', { name: 'Para qual conta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Nova conta' }))
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Qual mercado?' })).toHaveFocus()
    const mercados = within(dialog).getByRole('group', { name: 'Qual mercado?' })
    expect(within(mercados).getAllByRole('button').map((b) => b.textContent)).toEqual(['Futuros (EUA)', 'Forex e CFDs', 'Ações e opções (EUA)', 'Cripto', 'B3'])
    expect(dialog.querySelector('#nota-leitor')).toBeNull()
    await userEvent.click(within(mercados).getByRole('button', { name: 'B3' }))
    await continuar(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Profit (Nelogica)' }))
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Nova conta da B3' })).toBeInTheDocument()
    // «Moeda e virada do dia» with a file too (E51)
    expect(within(dialog).getByText('Moeda e virada do dia')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Apelido'), 'Clear B3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pessoal' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar Clear B3 e continuar' }))
    expect(await within(dialog).findByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toHaveFocus()
    expect(createAccount.mock.calls[0][2]).toMatchObject({ market: 'b3', label: 'Clear B3', platform: 'profit' })
    expect(fetchTemplates).toHaveBeenCalledTimes(1)
  })
})

// ================================================================================================
// 15 · a model taken as is; «Mudar colunas»
// ================================================================================================

describe('15 · «As mesmas colunas» (Ylos 50k, model BlackArrow)', () => {
  beforeEach(() => {
    importCommit.mockResolvedValue(commitQuadro('15'))
  })

  it('straight to «Prévia» with the chip, no indicator; «Importar 5 operações» → the touch (no line), the toast', async () => {
    const dialog = await ateAPrevia('15')
    expect(cardOf(dialog)).toBe('Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out')
    expect(indicatorOf(dialog)).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).toBeInTheDocument()
    expect(dialog.querySelector('.hub-ler .hub-chip-dado')).toHaveTextContent('Colunas do modelo “BlackArrow”')
    expect(within(dialog).getByRole('button', { name: 'Mudar colunas' })).toBeInTheDocument()
    expect(linhas(dialog)).toEqual([
      'Prévia',
      'Colunas do modelo “BlackArrow”',
      '24 linhas · 5 novas · 1 já registrada por você · 18 já estavam (mesmo ID) · 0 com erro',
      '1 já registrada por você: o arquivo completa a comissão.',
      'O arquivo traz comissões: mostramos o resultado líquido.',
      'Sem hora de saída, o resultado conta no limite do dia na hora da entrada.',
      'Antes de 14 out (início das regras): até 5 vão para Histórico importado · só resultado.',
      'Fuso do arquivo: Nova York (ET) · lembrado de Ylos 50k',
    ])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: comissões' }))
    expect(dialog.querySelector('#info-com')).toHaveTextContent('Bruto +US$ 103,75 · comissões −US$ 34,72.')
    expect(primaryOf(dialog)).toHaveTextContent('Importar 5 operações')
    // The preview: p_platform 'modelo' and p_format with the model
    expect(importPreview.mock.calls[0][1]).toMatchObject({ p_platform: 'modelo', p_file_tz: NY, p_format: { template: MODELO_BLACKARROW_LINHA.id } })

    await userEvent.click(primaryOf(dialog))
    expect(await within(dialog).findByRole('heading', { name: 'Importação feita' })).toHaveFocus()
    expect(saveTemplate).toHaveBeenCalledTimes(1)
    expect(saveTemplate.mock.calls[0].slice(2)).toEqual(['lote-15', null])
    expect(linhas(dialog)).toEqual([
      'Importação feita',
      '5 operações importadas. As de antes de 14 out ficam em Histórico importado · só resultado, à parte do Diário.',
      '1 já registrada por você foi completada.',
      'Desfazer depois: Personalizar › Suas contas › Importações.',
    ])
    expect(dialog.querySelector('.hub-toast')).toHaveTextContent('5 operações em Ylos 50k.')
    expect(cardOf(dialog)).toBe('Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out')
  })

  it('«Mudar colunas» starts a new sequence: mapa «Passo 1 de 3» (no «Voltar») → conferir «2 de 3» → d «3 de 3» → «atualizado»', async () => {
    const dialog = await ateAPrevia('15')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar colunas' }))
    expect(await within(dialog).findByRole('heading', { name: 'Mude as colunas do modelo “BlackArrow”.' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 1 de 3')
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
    expect(cardOf(dialog)).toBe('Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out')
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Confira 3 linhas' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 2 de 3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Mude as colunas do modelo “BlackArrow”.' })).toBeInTheDocument()
    await continuar(dialog)
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 3 de 3')
    // No chip once the columns are being changed
    expect(within(dialog).queryByRole('button', { name: 'Mudar colunas' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Confira 3 linhas' })).toBeInTheDocument()
    await usar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(cardOf(dialog)).toBe('Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out')
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate.mock.calls[0].slice(2)).toEqual(['lote-15', MODELO_BLACKARROW_LINHA.id])
    expect(within(dialog).getByText('Modelo “BlackArrow” atualizado: os próximos arquivos com estas colunas entram direto.')).toBeInTheDocument()
  })

  it('15 · «Uma coluna a mais»: the card «Parecido com …», mapa «Este arquivo mudou …», no zone step, «atualizado»', async () => {
    importCommit.mockResolvedValue(commitQuadro('15b'))
    fetchAccounts.mockResolvedValue(contasQuadro(true))
    fetchTemplates.mockResolvedValue([modeloBlackArrow()])
    importPreview.mockResolvedValue(previaQuadro('15b'))
    const dialog = await abrir('ylosDepois', 'f15b')
    expect(await within(dialog).findByRole('heading', { name: 'Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.' })).toHaveFocus()
    expect(cardOf(dialog)).toBe('Parecido com o modelo “BlackArrow” · 24 linhas')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 3')
    await continuar(dialog)
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Mudar colunas' })).not.toBeInTheDocument()
    expect(importPreview.mock.calls[0][1].p_format).toMatchObject({ template: MODELO_BLACKARROW_LINHA.id })
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate.mock.calls[0].slice(2)).toEqual(['lote-15b', MODELO_BLACKARROW_LINHA.id])
    expect(within(dialog).getByText('Modelo “BlackArrow” atualizado: os próximos arquivos com estas colunas entram direto.')).toBeInTheDocument()
  })
})

describe('16 · «termina posicionado» read by the saved model «Tradovate» (owner test step 4, D20)', () => {
  it('conferir first with the model (its «Mudar colunas»), «Passo 1 de 2», then «Prévia» with the chip', async () => {
    fetchAccounts.mockResolvedValue(contasQuadro())
    fetchImportFormats.mockResolvedValue({ [CONTAS_QUADRO.lucid.id]: ['modelo'] })
    fetchTemplates.mockResolvedValue([modeloTradovate()])
    importPreview.mockResolvedValue(previaQuadro('16ta-naosei'))
    const dialog = await abrir('lucid', 'f16ta')
    expect(await within(dialog).findByRole('heading', { name: 'Confira 3 linhas' })).toHaveFocus()
    expect(cardOf(dialog)).toBe('Modelo “Tradovate” · Futuros · 13 linhas · 13 out')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 2')
    // The chip's «Mudar colunas» is the step's (L1 places it); the sheet hands it over only for a model taken as is
    expect(within(dialog).getByRole('button', { name: 'stub: Mudar colunas' })).toBeInTheDocument()
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(indicatorOf(dialog)).toBe('Passo 2 de 2')
    expect(dialog.querySelector('.hub-ler .hub-chip-dado')).toHaveTextContent('Colunas do modelo “Tradovate”')
    // «Voltar» from «Prévia» → conferir; from conferir → the drop step (the file started there)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Lucid 50k' })).toBeInTheDocument()
  })

  it('«Mudar colunas» from conferir: mapa «Mude as colunas do modelo “Tradovate”.» as a new sequence', async () => {
    fetchImportFormats.mockResolvedValue({ [CONTAS_QUADRO.lucid.id]: ['modelo'] })
    fetchTemplates.mockResolvedValue([modeloTradovate()])
    const dialog = await abrir('lucid', 'f16ta')
    await within(dialog).findByRole('heading', { name: 'Confira 3 linhas' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'stub: Mudar colunas' }))
    expect(await within(dialog).findByRole('heading', { name: 'Mude as colunas do modelo “Tradovate”.' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 1 de 3')
    expect(within(dialog).queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Confira 3 linhas' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'stub: Mudar colunas' })).not.toBeInTheDocument()
  })
})

// ================================================================================================
// hc · «N contas neste arquivo» (17)
// ================================================================================================

describe('hc · «N contas neste arquivo» (17, Apex A)', () => {
  async function ateHc(conta: ContaQuadro = 'apexA', templates: Template[] = []) {
    fetchTemplates.mockResolvedValue(templates)
    importPreview.mockResolvedValue(previaQuadro('17'))
    const dialog = await abrir(conta, 'f17')
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: '2 contas neste arquivo' })).toHaveFocus()
    return dialog
  }

  it('by the account’s number: APX-0001 imported, APX-0002 not; the note; «Passo 3 de 5»; the args carry APX-0001’s rows only', async () => {
    const dialog = await ateHc()
    expect(indicatorOf(dialog)).toBe('Passo 3 de 5')
    const um = within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0001' })
    const dois = within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0002' })
    expect(um).toHaveValue('importar')
    expect(dois).toHaveValue('nao')
    expect(Array.from(dialog.querySelectorAll('.hub-conta-linha__txt')).map(texto)).toEqual(['APX-0001 · 31 op.', 'APX-0002 · 26 op.'])
    expect(within(um).getAllByRole('option').map((o) => o.textContent)).toEqual(['Importar em Apex A', 'Não importar'])
    expect(within(dialog).getByText('Escolhemos pelo número na plataforma de cada conta.')).toBeInTheDocument()
    expect(within(dialog).getByText('Para importar APX-0002, abra a importação na conta dela: o que já entrou não duplica.')).toBeInTheDocument()
    expect(dialog.querySelector('.hub-passo .hub-bloco--atencao')).toBeNull()
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })
    expect(within(dialog).getByText('No arquivo: entradas 09:31–11:58, sem fuso.')).toBeInTheDocument()
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    const args = importPreview.mock.calls[0][1]
    expect(args.p_rows_total).toBe(31)
    expect(args.p_rows).toEqual(arquivoDoEstado('17').rows.map(toRpcRow))
    expect(linhas(dialog)[1]).toBe('57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro')
  })

  it('a switch: APX-0002 imported → APX-0001 «Não importar», the amber warning, the live line; «Voltar» keeps it', async () => {
    const dialog = await ateHc()
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0002' }), 'importar')
    expect(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0001' })).toHaveValue('nao')
    expect(dialog.querySelector('.hub-passo .hub-bloco--atencao')).toHaveTextContent('O número na plataforma de Apex A é APX-0001.')
    expect(statusOf(dialog)).toHaveTextContent('APX-0001 passou para “Não importar”. O número na plataforma de Apex A é APX-0001.')
    expect(within(dialog).getByText('Para importar APX-0001, abra a importação na conta dela: o que já entrou não duplica.')).toBeInTheDocument()
    // None imported: blocked, both named in the note
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0002' }), 'nao')
    expect(primaryOf(dialog)).toHaveAttribute('aria-disabled', 'true')
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Escolha qual conta do arquivo vai para Apex A.')
    expect(within(dialog).getByText('Para importar APX-0001 e APX-0002, abra a importação na conta de cada uma: o que já entrou não duplica.')).toBeInTheDocument()
  })

  it('by the model’s route (an account without the number): the model’s own file goes straight to hc', async () => {
    const semNumero = { ...CONTAS_QUADRO.apexA, external_ref: null }
    fetchAccounts.mockResolvedValue(contasQuadro().map((a) => (a.id === semNumero.id ? semNumero : a)))
    const t = (await import('@/lib/domain/import')).templateFromRow({
      ...MODELO_BLACKARROW_LINHA,
      id: '3b0c0a00-0000-4000-8000-0000000000c1',
      name: 'NinjaTrader',
      ...ninjaLinha(),
      account_routes: { [accountRouteHash('APX-0002')]: semNumero.id },
    }) as Template
    fetchTemplates.mockResolvedValue([t])
    // The model's own file, taken as is: straight to hc
    const dialog = await abrir('apexA', 'f17')
    expect(await within(dialog).findByRole('heading', { name: '2 contas neste arquivo' })).toHaveFocus()
    expect(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0002' })).toHaveValue('importar')
    expect(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0001' })).toHaveValue('nao')
  })

  it('neither the number nor a route: «Não importar» everywhere, blocked with the hint', async () => {
    const semNumero = { ...CONTAS_QUADRO.apexA, external_ref: null }
    fetchAccounts.mockResolvedValue(contasQuadro().map((a) => (a.id === semNumero.id ? semNumero : a)))
    const dialog = await ateHc('apexA')
    expect(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0001' })).toHaveValue('nao')
    expect(within(dialog).getByRole('combobox', { name: 'O que fazer com APX-0002' })).toHaveValue('nao')
    expect(primaryOf(dialog)).toHaveAttribute('aria-disabled', 'true')
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Escolha qual conta do arquivo vai para Apex A.')
    expect(dialog.querySelector('.hub-passo .hub-bloco--atencao')).toBeNull()
  })

  it('f16c: «Sim» given on «conferir» for LT50K-0193 reaches the preview’s rows after hc, as open_at_end (never unbalanced_symbol)', async () => {
    fetchTemplates.mockResolvedValue([])
    importPreview.mockResolvedValue(previaQuadro('16c-sim'))
    const dialog = await abrir('lucid', 'f16c')
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await responder(dialog, (m) => ({ ...m, endOfFile: { [endOfFileKey('MESZ6', 'LT50K-0193')]: 'yes' } }))
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: '2 contas neste arquivo' })).toBeInTheDocument()
    // An execution file counts its executions' lines; no number on Lucid 50k: nothing pre-imported
    expect(Array.from(dialog.querySelectorAll('.hub-conta-linha__txt')).map(texto)).toEqual(['LT50K-0193 · 3 linhas', 'LT50K-0194 · 3 linhas'])
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'O que fazer com LT50K-0193' }), 'importar')
    await continuar(dialog)
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1].p_errors).toEqual([{ line: 7, code: 'open_at_end' }])
  })
})

/** NinjaTrader's model row fields (17's header, the board's fields) */
function ninjaLinha() {
  const headers = ['trade number', 'instrument', 'account', 'market pos.', 'qty', 'entry price', 'exit price', 'entry time', 'exit time', 'profit', 'commission']
  const { headerSignature } = jest.requireActual('@/lib/domain/import')
  return {
    header_sig: headerSignature(headers),
    headers,
    delimiter: 'comma',
    decimal_mark: 'point',
    date_order: 'mdy',
    row_kind: 'trade',
    columns: {
      instrument: 'symbol',
      account: 'account',
      'market pos.': 'side',
      qty: 'quantity',
      'entry price': 'entry_price',
      'exit price': 'exit_price',
      'entry time': 'entry_time',
      'exit time': 'exit_time',
      profit: 'pnl',
      commission: 'commission',
    },
    result_is_net: false,
  }
}

// ================================================================================================
// The zone step (G2)
// ================================================================================================

describe('the zone step: every market, G2', () => {
  async function ateFuso(conta: ContaQuadro, key: ArquivoQuadroKey, aplicar?: (m: Mapeamento) => Mapeamento) {
    const dialog = await abrir(conta, key)
    await within(dialog).findByTestId('stub')
    if (aplicar) await responder(dialog, aplicar)
    await continuar(dialog)
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    return dialog
  }
  const caps = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll('.hub-opcao__cap')).map((c) => c.textContent)
  const barras = (dialog: HTMLElement, i: number) =>
    Array.from(dialog.querySelectorAll('.hub-opcao')[i].querySelectorAll('.hub-faixa24__barra')).map((b) => (b as HTMLElement).style.height)

  it('8 · Ylos 50k (no import zone): nothing pressed, the board’s spans, the futures band and legend; «Passo 3 de 4»', async () => {
    const dialog = await ateFuso('ylos', 'f8')
    expect(within(dialog).getByText('No arquivo: entradas 09:31–10:58, sem fuso.')).toBeInTheDocument()
    expect(within(dialog).queryAllByRole('radio', { checked: true })).toHaveLength(0)
    expect(caps(dialog)).toEqual(['entradas 09:31–10:58 ET', 'entradas 08:31–09:58 ET', 'entradas 05:31–06:58 ET', 'escolha o fuso'])
    expect(dialog.querySelectorAll('.hub-opcao')[0].querySelector('.hub-faixa24__banda')).not.toHaveClass('hub-faixa24__banda--b3')
    expect(dialog.querySelector('#leg-fuso')).toHaveTextContent('pregão regular 09:30–16:00 ET')
    expect(dialog.querySelector('#leg-fuso')).toHaveTextContent('Faixas no relógio de Nova York (ET).')
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Escolha um fuso para continuar.')
    expect(indicatorOf(dialog)).toBe('Passo 3 de 4')
    // No «Lembrar …» for a mapped file
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('8 · Top One (import zone UTC): UTC pressed; Brasília → the refusal on the step, the hint, the live region; back to UTC', async () => {
    const dialog = await ateFuso('topOne', 'f8')
    expect(radioDe(dialog, /^UTC/)).toBeChecked()
    await userEvent.click(radioDe(dialog, /^Brasília/))
    const bloco = dialog.querySelector('.hub-passo > .hub-bloco--atencao') as HTMLElement
    expect(bloco).toHaveTextContent('Este fuso é diferente do fuso das importações desta conta.')
    expect(bloco).toHaveTextContent('Este arquivo usa outro relógio que o das importações de Top One. Confira o fuso na plataforma.')
    expect(primaryOf(dialog)).toHaveAttribute('aria-disabled', 'true')
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Use o fuso das importações da conta: UTC.')
    expect(statusOf(dialog)).toHaveTextContent(
      'Este fuso é diferente do fuso das importações desta conta. Este arquivo usa outro relógio que o das importações de Top One. Confira o fuso na plataforma.',
    )
    await userEvent.click(primaryOf(dialog))
    expect(importPreview).not.toHaveBeenCalled()
    await userEvent.click(radioDe(dialog, /^UTC/))
    expect(dialog.querySelector('.hub-passo > .hub-bloco--atencao')).toBeNull()
    expect(primaryOf(dialog)).not.toHaveAttribute('aria-disabled')
  })

  it('an unconfirmed account that holds imports: its zone pressed; another refused after the preview’s tz_mismatch, never the alert', async () => {
    fetchImportFormats.mockResolvedValue({ [CONTAS_QUADRO.lucid.id]: ['modelo'] })
    importPreview.mockResolvedValue({ ...previaQuadro('16t'), tz_status: 'tz_mismatch' })
    const dialog = await ateFuso('lucid', 'f16t')
    expect(radioDe(dialog, /^Nova York/)).toBeChecked()
    await userEvent.click(radioDe(dialog, /^Brasília/))
    expect(dialog.querySelector('.hub-passo > .hub-bloco--atencao')).toBeNull()
    await continuar(dialog)
    await waitFor(() => expect(dialog.querySelector('.hub-passo > .hub-bloco--atencao')).toHaveTextContent('Este fuso é diferente do fuso das importações desta conta.'))
    expect(within(dialog).getByRole('heading', { level: 3 })).toHaveTextContent('Em que fuso estão os horários deste arquivo?')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(primaryOf(dialog)).toHaveAccessibleDescription('Use o fuso das importações da conta: Nova York (ET).')
  })

  it('16 · Tradovate: «execuções» in the captions; bars per execution (3, 5, 1)', async () => {
    const dialog = await ateFuso('lucid', 'f16t')
    expect(within(dialog).getByText('No arquivo: execuções 10:31–11:31, sem fuso.')).toBeInTheDocument()
    await escolherZona(dialog, NY)
    expect(caps(dialog)[0]).toBe('execuções 10:31–11:31 ET')
    expect(barras(dialog, 0).slice(21, 24)).toEqual(['60%', '100%', '20%'])
  })

  it('16 · ending positioned: «execuções 10:31–11:48» (from the first to the last execution)', async () => {
    const dialog = await ateFuso('lucid', 'f16ta')
    expect(within(dialog).getByText('No arquivo: execuções 10:31–11:48, sem fuso.')).toBeInTheDocument()
  })

  it('8 · Performance.csv: one bar unit per trade (1 at 10:30, 3 at 11:00), 10:31–11:20', async () => {
    const dialog = await ateFuso('lucid', 'f8p')
    expect(within(dialog).getByText('No arquivo: entradas 10:31–11:20, sem fuso.')).toBeInTheDocument()
    await escolherZona(dialog, NY)
    expect(barras(dialog, 0).slice(21, 23)).toEqual(['33%', '100%'])
  })

  it('18 · Forex: «06:05–17:48», no band, the Forex legend', async () => {
    const dialog = await ateFuso('e8', 'f18')
    expect(within(dialog).getByText('No arquivo: entradas 06:05–17:48, sem fuso.')).toBeInTheDocument()
    expect(dialog.querySelector('.hub-faixa24__banda')).toBeNull()
    expect(dialog.querySelector('#leg-fuso')).toHaveTextContent('Faixas no relógio de Nova York (ET). Forex abre 24 h: sem faixa de pregão.')
    expect(dialog.querySelector('#leg-fuso .hub-sw')).toBeNull()
  })

  it('19 · B3: the B3 band and legend, captions «de Brasília»', async () => {
    const dialog = await ateFuso('mini', 'f19', (m) => ({ ...m, sideWords: { x: 'sell' } }))
    expect(within(dialog).getByText('No arquivo: entradas 10:02–16:40, sem fuso.')).toBeInTheDocument()
    await escolherZona(dialog, 'America/Sao_Paulo')
    expect(caps(dialog)[1]).toBe('entradas 10:02–16:40 de Brasília')
    expect(dialog.querySelectorAll('.hub-opcao')[1].querySelector('.hub-faixa24__banda')).toHaveClass('hub-faixa24__banda--b3')
    expect(dialog.querySelector('#leg-fuso')).toHaveTextContent('pregão 09:00–18:30')
    expect(dialog.querySelector('#leg-fuso')).toHaveTextContent('Faixas no relógio de Brasília.')
  })

  it('16 · Binance (Date(UTC): every row with its offset): no zone step, «Passo 3 de 3» on «Prévia», no zone line', async () => {
    importPreview.mockResolvedValue(previaQuadro('16b-naosei'))
    const dialog = await abrir('binance', 'f16b')
    await within(dialog).findByTestId('stub')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 3')
    await continuar(dialog)
    await usar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(indicatorOf(dialog)).toBe('Passo 3 de 3')
    expect(importPreview.mock.calls[0][1].p_file_tz).toBe('UTC')
    expect(within(dialog).queryByText(/^Fuso do arquivo/)).not.toBeInTheDocument()
  })
})

// ================================================================================================
// The preview (E35–E44), the commit, the model save, the end
// ================================================================================================

interface PreviaEsperada {
  estado: EstadoQuadro
  liquido?: boolean
  linhas: string[]
  comissao?: string
  ver?: string[]
  primaria: string
}

const SEM_SAIDA = 'Sem hora de saída, o resultado conta no limite do dia na hora da entrada.'
const SEM_COM = 'Sem comissão no arquivo: estas operações ficam sem comissão.'
const COM = 'O arquivo traz comissões: mostramos o resultado líquido.'
const antes = (d: string, n: number) => `Antes de ${d} (início das regras): ${n} ${n === 1 ? 'vai' : 'vão'} para Histórico importado · só resultado.`
const NAO_FECHA = 'as compras e as vendas do ativo não fecham no arquivo'

const PREVIAS: [string, PreviaEsperada][] = [
  ['8 · Ylos 50k (líquido)', { estado: '8', linhas: ['18 linhas · 18 novas · 0 já estavam · 0 com erro', COM, SEM_SAIDA, antes('14 out', 18), 'Fuso do arquivo: Nova York (ET) · lembrado para Ylos 50k'], comissao: 'Bruto +US$ 41,25 · comissões −US$ 26,04.', primaria: 'Importar 18 operações' }],
  ['8 · «Não, é bruto»', { estado: '8', liquido: false, linhas: ['18 linhas · 18 novas · 0 já estavam · 0 com erro', COM, '18 com resultado diferente do calculado pelos preços: vale o do arquivo.', SEM_SAIDA, antes('14 out', 18), 'Fuso do arquivo: Nova York (ET) · lembrado para Ylos 50k'], comissao: 'Bruto +US$ 15,21 · comissões −US$ 26,04.', primaria: 'Importar 18 operações' }],
  ['8 · Top One in UTC: G1, last', { estado: '8g', linhas: ['18 linhas · 18 novas · 0 já estavam · 0 com erro', COM, SEM_SAIDA, antes('14 out', 18), 'Fuso do arquivo: UTC · lembrado para Top One', '18 operações caem em dias em que Top One já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.'], comissao: 'Bruto +US$ 41,25 · comissões −US$ 26,04.', primaria: 'Importar 18 operações' }],
  ['8 · Performance.csv', { estado: '8p', linhas: ['6 linhas · 6 novas · 0 já estavam · 0 com erro', '2 saídas parciais juntadas às suas operações.', SEM_COM, antes('15 out', 4), 'Fuso do arquivo: Nova York (ET) · lembrado para Lucid 50k'], primaria: 'Importar 4 operações' }],
  ['16 · Tradovate', { estado: '16t', linhas: ['9 execuções no arquivo', '6 saídas · 6 novas · 0 já estavam', 'As 6 saídas viram 4 operações.', '2 saídas parciais juntadas às suas operações.', '2 ordens sem execução ficaram de fora.', SEM_COM, antes('15 out', 4), 'Fuso do arquivo: Nova York (ET) · lembrado para Lucid 50k'], primaria: 'Importar 4 operações' }],
  ['16 · termina posicionado, «Não sei»', { estado: '16ta-naosei', linhas: ['10 execuções no arquivo', '2 saídas · 2 novas · 0 já estavam', 'As 2 saídas viram 2 operações.', '3 ordens sem execução ficaram de fora.', 'As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.', SEM_COM, antes('15 out', 2), 'Fuso do arquivo: Nova York (ET) · lembrado para Lucid 50k'], ver: [2, 4, 5, 10, 11, 12, 13].map((n) => `Linha ${n}: ${NAO_FECHA}`), primaria: 'Importar 2 operações' }],
  ['16 · termina posicionado, «Sim»', { estado: '16ta-sim', linhas: ['10 execuções no arquivo', '6 saídas · 6 novas · 0 já estavam', 'As 6 saídas viram 4 operações.', '2 saídas parciais juntadas às suas operações.', '3 ordens sem execução ficaram de fora.', '1 execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra quando você importar um arquivo que tenha a abertura e o fechamento.', SEM_COM, antes('15 out', 4), 'Fuso do arquivo: Nova York (ET) · lembrado para Lucid 50k'], ver: ['Linha 13: posição ainda aberta no fim do arquivo'], primaria: 'Importar 4 operações' }],
  ['16 · termina posicionado, «Não»', { estado: '16ta-nao', linhas: ['10 execuções no arquivo', '6 saídas · 6 novas · 0 já estavam', 'As 6 saídas viram 5 operações.', '1 saída parcial juntada à sua operação.', '3 ordens sem execução ficaram de fora.', '1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.', SEM_COM, antes('15 out', 5), 'Fuso do arquivo: Nova York (ET) · lembrado para Lucid 50k'], ver: ['Linha 4: fecha uma posição aberta antes do começo do arquivo'], primaria: 'Importar 5 operações' }],
  ['16 · Binance, «Não sei»', { estado: '16b-naosei', linhas: ['8 execuções no arquivo', '3 saídas · 3 novas · 0 já estavam', 'As 3 saídas viram 2 operações.', '1 saída parcial juntada à sua operação.', 'Os horários já trazem o fuso (UTC).', 'As 3 execuções de ETHUSDT ficaram de fora: as compras e as vendas do arquivo não fecham.', COM, '1 operação fica sem comissão: a taxa veio em BNB.', '1 operação fica em outro dia que o do arquivo: o dia de Cripto vira à meia-noite de Brasília.', antes('15 out', 2)], comissao: 'Bruto +US$ 7,55 · comissões −US$ 2,82.', ver: [3, 5, 6].map((n) => `Linha ${n}: ${NAO_FECHA}`), primaria: 'Importar 2 operações' }],
  ['16 · Binance, «Sim»', { estado: '16b-sim', linhas: ['8 execuções no arquivo', '4 saídas · 4 novas · 0 já estavam', 'As 4 saídas viram 3 operações.', '1 saída parcial juntada à sua operação.', 'Os horários já trazem o fuso (UTC).', '1 execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra quando você importar um arquivo que tenha a abertura e o fechamento.', COM, '2 operações ficam sem comissão: a taxa veio em BNB.', '2 operações ficam em outro dia que o do arquivo: o dia de Cripto vira à meia-noite de Brasília.', antes('15 out', 3)], comissao: 'Bruto +US$ 9,00 · comissões −US$ 2,82.', ver: ['Linha 6: posição ainda aberta no fim do arquivo'], primaria: 'Importar 3 operações' }],
  ['16 · Binance, «Não»', { estado: '16b-nao', linhas: ['8 execuções no arquivo', '4 saídas · 4 novas · 0 já estavam', 'As 4 saídas viram 3 operações.', '1 saída parcial juntada à sua operação.', 'Os horários já trazem o fuso (UTC).', '1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.', COM, '1 operação fica sem comissão: a taxa veio em BNB.', '2 operações ficam em outro dia que o do arquivo: o dia de Cripto vira à meia-noite de Brasília.', antes('15 out', 3)], comissao: 'Bruto +US$ 10,25 · comissões −US$ 3,64.', ver: ['Linha 3: fecha uma posição aberta antes do começo do arquivo'], primaria: 'Importar 3 operações' }],
  ['16 · Interactive Brokers', { estado: '16i', linhas: ['8 execuções no arquivo', '3 saídas · 3 novas · 0 já estavam', 'As 3 saídas viram 2 operações.', '1 saída parcial juntada à sua operação.', '3 execuções ficaram de fora.', COM, antes('15 out', 2), 'Fuso do arquivo: Nova York (ET) · lembrado para IBKR'], comissao: 'Bruto +US$ 283,00 · comissões −US$ 5,00.', ver: ['Linha 2: fecha uma posição aberta antes do começo do arquivo', 'Linha 7: opção, fica de fora (registre no Registrar)', 'Linha 9: posição ainda aberta no fim do arquivo'], primaria: 'Importar 2 operações' }],
  ['17 · APX-0001', { estado: '17', linhas: ['57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro', 'Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.', COM, antes('14 out', 31), 'Fuso do arquivo: Nova York (ET) · lembrado para Apex A'], comissao: 'Bruto +US$ 186,50 · comissões −US$ 44,64.', primaria: 'Importar 31 operações' }],
  ['17 · APX-0001, «Sim, é líquido»', { estado: '17', liquido: true, linhas: ['57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro', 'Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.', COM, '31 com resultado diferente do calculado pelos preços: vale o do arquivo.', antes('14 out', 31), 'Fuso do arquivo: Nova York (ET) · lembrado para Apex A'], comissao: 'Bruto +US$ 231,14 · comissões −US$ 44,64.', primaria: 'Importar 31 operações' }],
  ['17 · APX-0002', { estado: '17-apx2', linhas: ['57 linhas · 26 novas · 31 não importadas (APX-0001) · 0 já estavam · 0 com erro', 'Ativos escritos como “MES 12-26” e “MNQ 12-26” ficam como “MESZ26” e “MNQZ26”.', COM, antes('14 out', 26), 'Fuso do arquivo: Nova York (ET) · lembrado para Apex A'], comissao: 'Bruto +US$ 141,25 · comissões −US$ 37,20.', primaria: 'Importar 26 operações' }],
  ['18 · Forex in New York', { estado: '18', linhas: ['14 linhas · 14 novas · 0 já estavam · 0 com erro', COM, '1 operação com swap: ele entra no resultado, antes da comissão.', '1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.', antes('15 out', 14), 'Fuso do arquivo: Nova York (ET) · lembrado para E8 50k'], comissao: 'Bruto +US$ 212,40 · comissões −US$ 40,25.', primaria: 'Importar 14 operações' }],
  ['18 · Forex in Chicago (domain: 1, board 2)', { estado: '18-chicago', linhas: ['14 linhas · 14 novas · 0 já estavam · 0 com erro', COM, '1 operação com swap: ele entra no resultado, antes da comissão.', '1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.', antes('15 out', 14), 'Fuso do arquivo: Chicago (CT) · lembrado para E8 50k'], comissao: 'Bruto +US$ 212,40 · comissões −US$ 40,25.', primaria: 'Importar 14 operações' }],
  ['18 · Forex in UTC: no day line', { estado: '18-utc', linhas: ['14 linhas · 14 novas · 0 já estavam · 0 com erro', COM, '1 operação com swap: ele entra no resultado, antes da comissão.', antes('15 out', 14), 'Fuso do arquivo: UTC · lembrado para E8 50k'], comissao: 'Bruto +US$ 212,40 · comissões −US$ 40,25.', primaria: 'Importar 14 operações' }],
  ['18 · Forex, «Sim, é líquido»', { estado: '18', liquido: true, linhas: ['14 linhas · 14 novas · 0 já estavam · 0 com erro', COM, '12 com resultado diferente do calculado pelos preços: vale o do arquivo.', '1 operação com swap: ele entra no resultado, antes da comissão.', '1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.', antes('15 out', 14), 'Fuso do arquivo: Nova York (ET) · lembrado para E8 50k'], comissao: 'Bruto +US$ 258,85 · comissões −US$ 40,25.', primaria: 'Importar 14 operações' }],
  ['19 · B3, «X» = Venda', { estado: '19', linhas: ['18 linhas · 16 novas · 0 já estavam · 2 com erro', '2 linhas com erro foram puladas.', COM, SEM_SAIDA, antes('15 out', 16), 'Fuso do arquivo: Brasília · lembrado para Mini-índice'], comissao: 'Bruto +R$ 412,00 · comissões −R$ 22,50.', ver: ['Linha 9: preço fora do passo do WIN (de 5 em 5)', 'Linha 15: lado desconhecido'], primaria: 'Importar 16 operações' }],
  ['19 · B3, «Não, é bruto»', { estado: '19', liquido: false, linhas: ['18 linhas · 16 novas · 0 já estavam · 2 com erro', '2 linhas com erro foram puladas.', COM, '16 com resultado diferente do calculado pelos preços: vale o do arquivo.', SEM_SAIDA, antes('15 out', 16), 'Fuso do arquivo: Brasília · lembrado para Mini-índice'], comissao: 'Bruto +R$ 389,50 · comissões −R$ 22,50.', primaria: 'Importar 16 operações' }],
  ['19 · B3, «Pular essas linhas»', { estado: '19-pular', linhas: ['18 linhas · 14 novas · 0 já estavam · 4 com erro', '4 linhas com erro foram puladas.', COM, SEM_SAIDA, antes('15 out', 14), 'Fuso do arquivo: Brasília · lembrado para Mini-índice'], comissao: 'Bruto +R$ 413,00 · comissões −R$ 21,60.', ver: ['Linha 6: lado desconhecido', 'Linha 9: preço fora do passo do WIN (de 5 em 5)', 'Linha 11: lado desconhecido', 'Linha 15: lado desconhecido'], primaria: 'Importar 14 operações' }],
  ['19 · «Só preços»', { estado: '19p', linhas: ['18 linhas · 16 novas · 0 já estavam · 2 com erro', '2 linhas com erro foram puladas.', SEM_COM, SEM_SAIDA, antes('15 out', 16), 'Fuso do arquivo: Brasília · lembrado para Mini-índice'], primaria: 'Importar 16 operações' }],
]

describe('«Prévia» of every board state: its lines in the board’s order (D13), the ⓘ, «Ver linhas», the primary', () => {
  it.each(PREVIAS)('%s', async (_, x) => {
    const dialog = await ateAPrevia(x.estado, { liquido: x.liquido })
    expect(linhas(dialog).slice(1)).toEqual(x.linhas)
    if (x.comissao) {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Como ler: comissões' }))
      expect(dialog.querySelector('#info-com')).toHaveTextContent(x.comissao)
    } else {
      expect(within(dialog).queryByRole('button', { name: 'Como ler: comissões' })).not.toBeInTheDocument()
    }
    if (x.ver) {
      const ver = within(dialog).getByRole('button', { name: 'Ver linhas' })
      expect(ver).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(ver)
      expect(ver).toHaveAttribute('aria-expanded', 'true')
      expect(Array.from(dialog.querySelectorAll('#linhas-puladas li')).map((l) => l.textContent)).toEqual(x.ver)
    }
    expect(primaryOf(dialog)).toHaveTextContent(x.primaria)
  })
})

describe('the commit and the model’s save (§6.8)', () => {
  it('8 · the commit’s args: «modelo», p_format {sig, template null}, the rows on the zone chosen; «Modelo “BlackArrow” salvo»', async () => {
    importCommit.mockResolvedValue(commitQuadro('8'))
    const dialog = await ateAPrevia('8')
    await userEvent.click(primaryOf(dialog))
    expect(await within(dialog).findByRole('heading', { name: 'Importação feita' })).toHaveFocus()
    const args = importCommit.mock.calls[0][1]
    const file = arquivoDoEstado('8')
    expect(args).toMatchObject({ p_platform: 'modelo', p_file_tz: NY, p_format: { sig: file.format.sig, template: null }, p_rows_total: 18 })
    expect(args.p_rows).toEqual(file.rows.map(toRpcRow))
    expect(saveTemplate).toHaveBeenCalledTimes(1)
    const [, payload, lote, replaces] = saveTemplate.mock.calls[0]
    expect([lote, replaces]).toEqual(['lote-8', null])
    expect(payload).toMatchObject({ v: 1, name: 'BlackArrow', tz_hint: NY, row_kind: 'trade', account_routes: {} })
    expect(linhas(dialog)).toEqual([
      'Importação feita',
      '18 operações em Histórico importado · só resultado, à parte do Diário.',
      'Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.',
      'Desfazer depois: Personalizar › Suas contas › Importações.',
    ])
    expect(dialog.querySelector('.hub-toast')).toHaveTextContent('18 operações em Ylos 50k.')
    // «Desfazer» keeps the model: no other save, back to «Prévia»
    importUndo.mockResolvedValue({ deleted: 18 })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desfazer: 18 operações em Ylos 50k.' }))
    await waitFor(() => expect(dialog.querySelector('.hub-passo .hub-chip-dado')).toHaveTextContent('Importação desfeita: nada ficou em Ylos 50k.'))
    expect(within(dialog).getByRole('heading', { name: 'Prévia' })).toBeInTheDocument()
    expect(importUndo).toHaveBeenCalledWith(expect.anything(), 'lote-8')
    expect(saveTemplate).toHaveBeenCalledTimes(1)
  })

  it('8 · Top One: «Minha plataforma» (a reader’s platform, D1); 17: the route of the value imported', async () => {
    importCommit.mockResolvedValue(commitQuadro('8g'))
    const dialog = await ateAPrevia('8g')
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate.mock.calls[0][1]).toMatchObject({ name: 'Minha plataforma', tz_hint: 'UTC' })
    expect(within(dialog).getByText('Modelo “Minha plataforma” salvo: os próximos arquivos com estas colunas entram direto.')).toBeInTheDocument()
  })

  it('17 · the model keeps APX-0001’s route to Apex A (a hash, never the number)', async () => {
    importCommit.mockResolvedValue(commitQuadro('17'))
    const dialog = await ateAPrevia('17')
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate.mock.calls[0][1].account_routes).toEqual({ [accountRouteHash('APX-0001')]: CONTAS_QUADRO.apexA.id })
    expect(JSON.stringify(saveTemplate.mock.calls[0][1])).not.toContain('APX-0001')
    expect(within(dialog).getByText('Modelo “NinjaTrader” salvo: os próximos arquivos com estas colunas entram direto.')).toBeInTheDocument()
  })

  it.each([
    ['bad_template', 'O modelo “BlackArrow” não foi salvo. As operações já entraram; no próximo arquivo, diga de novo o que é cada coluna.'],
    ['too_many_templates', 'O modelo “BlackArrow” não foi salvo: já são 50 modelos. As operações já entraram.'],
    ['network', 'O modelo “BlackArrow” não foi salvo. As operações já entraram; no próximo arquivo, diga de novo o que é cada coluna.'],
  ] as const)('a save that fails (%s) is the end’s line, never the alert', async (code, linha) => {
    importCommit.mockResolvedValue(commitQuadro('8'))
    saveTemplate.mockRejectedValue(new data.HubDataError(code))
    const dialog = await ateAPrevia('8')
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(within(dialog).getByText(linha)).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(dialog.querySelector('.hub-toast')).toHaveTextContent('18 operações em Ylos 50k.')
  })

  it('«Salvar como modelo» unchecked: «Colunas usadas só neste arquivo.», no save', async () => {
    importCommit.mockResolvedValue(commitQuadro('8'))
    fetchAccounts.mockResolvedValue(contasQuadro())
    importPreview.mockResolvedValue(previaQuadro('8'))
    const dialog = await abrir('ylos', 'f8')
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await responder(dialog, (m) => ({ ...m, salvar: false }))
    await usar(dialog)
    await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Colunas usadas só neste arquivo.')).toBeInTheDocument()
  })

  it('no batch: a touch makes no call (15); a new model goes without routes (8, 17)', async () => {
    importCommit.mockResolvedValue({ ...commitQuadro('15'), batch_id: null, inserted: 0, completed: 5, linked: 0, duplicate: 18 })
    const d15 = await ateAPrevia('15')
    await userEvent.click(primaryOf(d15))
    await within(d15).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate).not.toHaveBeenCalled()
    expect(linhas(d15).some((l) => l.startsWith('Modelo') || l.startsWith('O modelo'))).toBe(false)
    expect(within(d15).queryByText(/^Desfazer depois/)).not.toBeInTheDocument()
  })

  it('no batch, a new model with a route: saved without it', async () => {
    importCommit.mockResolvedValue({ ...commitQuadro('17'), batch_id: null, inserted: 0, completed: 31 })
    const dialog = await ateAPrevia('17')
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate.mock.calls[0].slice(2)).toEqual([null, null])
    expect(saveTemplate.mock.calls[0][1].account_routes).toEqual({})
    expect(within(dialog).getByText('Modelo “NinjaTrader” salvo: os próximos arquivos com estas colunas entram direto.')).toBeInTheDocument()
  })

  it('no batch, «Atualizar o modelo» of a model with routes: no call, «… não foi atualizado: este arquivo não trouxe operações novas.»', async () => {
    const comRota = (await import('@/lib/domain/import')).templateFromRow({
      ...MODELO_BLACKARROW_LINHA,
      id: '3b0c0a00-0000-4000-8000-0000000000c1',
      name: 'NinjaTrader',
      ...ninjaLinha(),
      account_routes: { [accountRouteHash('APX-0001')]: CONTAS_QUADRO.apexA.id },
    }) as Template
    importCommit.mockResolvedValue({ ...commitQuadro('17'), batch_id: null, inserted: 0, completed: 31 })
    fetchTemplates.mockResolvedValue([comRota])
    importPreview.mockResolvedValue(previaQuadro('17'))
    const dialog = await abrir('apexA', 'f17')
    // The model's own file, taken as is: hc first; «Mudar colunas» from the preview then makes it an update
    expect(await within(dialog).findByRole('heading', { name: '2 contas neste arquivo' })).toBeInTheDocument()
    await continuar(dialog)
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mudar colunas' }))
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await usar(dialog)
    await within(dialog).findByRole('heading', { name: '2 contas neste arquivo' })
    await continuar(dialog)
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    await userEvent.click(primaryOf(dialog))
    await within(dialog).findByRole('heading', { name: 'Importação feita' })
    expect(saveTemplate).not.toHaveBeenCalled()
    expect(within(dialog).getByText('O modelo “NinjaTrader” não foi atualizado: este arquivo não trouxe operações novas.')).toBeInTheDocument()
  })

  it('a refusal of the commit for the zone (tz_mismatch) goes back to the zone step with that zone refused', async () => {
    importCommit.mockRejectedValue(new data.HubDataError('tz_mismatch'))
    const dialog = await ateAPrevia('8')
    await userEvent.click(primaryOf(dialog))
    expect(await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    expect(dialog.querySelector('.hub-passo > .hub-bloco--atencao')).toHaveTextContent('Este arquivo usa outro relógio que o das importações de Ylos 50k.')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a mapped file’s bad number: «Linha 3: número inválido em Preço de entrada» (the field’s label, never its key)', async () => {
    const texto8 = lidoQuadro('f8')
    const linhasF8 = (await import('@/testing/mapeadoTelas')).ARQUIVOS_QUADRO.f8.texto.split('\r\n')
    const cells = linhasF8[2].split(';')
    cells[4] = '6.8x1,00'
    linhasF8[2] = cells.join(';')
    const text = linhasF8.join('\r\n')
    readFile.mockResolvedValue({ ...texto8, outcome: { ok: false, error: 'unknown_format' } })
    importPreview.mockResolvedValue({ ...previaQuadro('8'), new: 17, rows_total: 18, errors: [{ line: 3, code: 'bad_number' }] })
    renderHub(<Abrir accountId={CONTAS_QUADRO.ylos.id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled())
    await act(async () => {
      fireEvent.change(within(dialog).getByTestId('arquivo'), { target: { files: [new File([text], 'blackarrow.csv')] } })
    })
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await usar(dialog)
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(importPreview.mock.calls[0][1].p_errors).toEqual([{ line: 3, code: 'bad_number' }])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ver linhas' }))
    expect(within(dialog).getByText('Linha 3: número inválido em Preço de entrada')).toBeInTheDocument()
    expect(within(dialog).queryByText(/entry_price/)).not.toBeInTheDocument()
  })
})

describe('«Nada novo» of a mapped file (no zone block, G2)', () => {
  it('8 again: «Nada novo: as 18 operações já estão em Ylos 50k.», no «Confirmar fuso»', async () => {
    const dialog = await ateNadaNovo('8-de-novo')
    expect(within(dialog).getByRole('heading', { name: 'Nada novo: as 18 operações já estão em Ylos 50k.' })).toHaveFocus()
    expect(linhas(dialog)[1]).toBe('18 linhas · 0 novas · 18 já estavam (mesmo ID)')
    expect(within(dialog).queryByRole('button', { name: 'Confirmar fuso' })).not.toBeInTheDocument()
    expect(dialog.querySelector('.hub-passo .hub-bloco')).toBeNull()
    expect(saveTemplate).not.toHaveBeenCalled()
  })

  it('16 again: «Nada novo: as 6 saídas já estão em Lucid 50k.» and the count in saídas', async () => {
    const dialog = await ateNadaNovo('16t-de-novo')
    expect(within(dialog).getByRole('heading', { name: 'Nada novo: as 6 saídas já estão em Lucid 50k.' })).toBeInTheDocument()
    expect(linhas(dialog)[1]).toBe('6 saídas · 0 novas · 6 já estavam (mesmo ID)')
  })

  async function ateNadaNovo(e: EstadoQuadro) {
    const d = ESTADOS_QUADRO[e]
    fetchAccounts.mockResolvedValue(contasQuadro(d.conta === 'ylosDepois'))
    importPreview.mockResolvedValue(previaQuadro(e))
    const dialog = await abrir(d.conta, d.arquivo)
    await within(dialog).findByTestId('stub')
    await continuar(dialog)
    await usar(dialog)
    const h = await within(dialog).findByRole('heading', { level: 3, name: /Em que fuso|Nada novo/ })
    if (h.textContent?.startsWith('Em que fuso')) {
      await escolherZona(dialog, d.tz)
      await continuar(dialog)
    }
    await within(dialog).findByRole('heading', { level: 3, name: /^Nada novo/ })
    return dialog
  }
})

describe('the indicator and «Voltar»', () => {
  it('8: mapa 1/4 → conferir 2/4 → c 3/4 → d 4/4; «Voltar» back the same way, every edit kept', async () => {
    importPreview.mockResolvedValue(previaQuadro('8'))
    const dialog = await abrir('ylos', 'f8')
    await within(dialog).findByTestId('stub')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 4')
    // The mapa step's answer is kept through «Voltar»
    await responder(dialog, (m) => ({ ...m, nome: 'Plataforma X' }))
    await continuar(dialog)
    expect(await within(dialog).findByRole('heading', { name: 'Confira 3 linhas' })).toHaveFocus()
    expect(indicatorOf(dialog)).toBe('Passo 2 de 4')
    await usar(dialog)
    await within(dialog).findByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })
    expect(indicatorOf(dialog)).toBe('Passo 3 de 4')
    await escolherZona(dialog, NY)
    await continuar(dialog)
    await within(dialog).findByRole('heading', { name: 'Prévia' })
    expect(indicatorOf(dialog)).toBe('Passo 4 de 4')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Em que fuso estão os horários deste arquivo?' })).toHaveFocus()
    expect(radioDe(dialog, /^Nova York/)).toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Confira 3 linhas' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(within(dialog).getByRole('heading', { name: 'Importar histórico de Ylos 50k' })).toHaveFocus()
    expect(dialog.querySelector('.hub-arq')).toBeNull()
  })

  it('17: «Passo 1 de 5» on mapa (hc and c ahead)', async () => {
    const dialog = await abrir('apexA', 'f17')
    await within(dialog).findByTestId('stub')
    expect(indicatorOf(dialog)).toBe('Passo 1 de 5')
  })

  it('a mapped file is no form: closing never asks «Fechar sem salvar?»', async () => {
    const dialog = await abrir('ylos', 'f8')
    await within(dialog).findByTestId('stub')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('copy that never shows', () => {
  it('no «Como exportar», no prototype label, no stale board copy in the sheet’s steps', async () => {
    const dialog = await ateAPrevia('16t')
    for (const t of [/Como exportar/, /exemplo/, /protótipo/, /Informe por contrato/, /Seguir bruto/, /CSV, Excel ou HTML/, /Lembrar para os próximos arquivos/]) {
      expect(within(dialog).queryByText(t)).not.toBeInTheDocument()
    }
  })
})

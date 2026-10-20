/**
 * «Registrar operação» (PR 3-3, lane A): the frame and where the sheet starts (contract §4.1–§4.2,
 * §6.1), with the answers recorded from the real SQL (testing/registrarTelas; invented data).
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import { parseRulesNow } from '@/lib/hub/regras'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import { ERRO_REGISTRAR } from '@/components/hub/registrar/copy'
import { REGISTRAR_ERROR_CODES } from '@/lib/hub/registrarDb'
import { renderHub } from '@/testing/hubHarness'
import {
  abertasTelas,
  agoraTelas,
  contasTelas,
  entradaTelas,
  idsTelas,
  operacaoTelas,
  recentesTelas,
  telasJson,
} from '@/testing/registrarTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewExit: jest.fn(),
  previewAfter: jest.fn(),
  registerEntry: jest.fn(),
  registerExit: jest.fn(),
  registerAfter: jest.fn(),
  addMarks: jest.fn(),
  undoEntry: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsTelas()

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasTelas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1031-et'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockResolvedValue(recentesTelas('recentes-top-one'))
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('bad_price', 'entry_price'))
  db.fetchGateAt.mockImplementation(async () => agoraTelas('agora-qui-1031-et').accounts[0])
})

afterEach(() => {
  onlineManager.setOnline(true)
})

function abrir(props: Partial<React.ComponentProps<typeof RegistrarSheet>> = {}) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.topOne} tradeId={null} onClose={onClose} {...props} />
    </QueryClientProvider>,
  )
  return { ...view, onClose, queryClient }
}

describe('copy', () => {
  it('says every Registrar code', () => {
    for (const code of REGISTRAR_ERROR_CODES) expect(ERRO_REGISTRAR[code]).toEqual(expect.any(String))
  })

  it('carries no prototype text (contract §4.10)', () => {
    const fs = jest.requireActual('fs') as typeof import('fs')
    const path = jest.requireActual('path') as typeof import('path')
    const dir = path.join(__dirname, '../../../components/hub/registrar')
    const text = fs
      .readdirSync(dir)
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
    for (const s of ['Controles do protótipo', 'Cenário do protótipo', 'Recomeçar', 'Preencher exemplo', 'Simular 2 imagens', 'Avançar o relógio', 'só no protótipo', 'fora do produto', 'Agora:']) {
      expect(text).not.toContain(s)
    }
  })
})

describe('the frame', () => {
  it('is a modal dialog named by its heading; Escape and «Fechar» close it', async () => {
    const { onClose } = abrir()
    const dialog = await screen.findByRole('dialog', { name: 'Registrar operação' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps Tab inside the sheet', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    const close = screen.getByRole('button', { name: 'Fechar' })
    close.focus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(close)
    await userEvent.tab()
    expect(document.activeElement).toBe(close)
  })

  it('asks «Fechar sem salvar?» when something was typed on step 1', async () => {
    const { onClose } = abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Fechar sem salvar?')).toBeInTheDocument()
    expect(within(screen.getByText('Fechar sem salvar?').closest('[role="group"]') as HTMLElement).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar aqui' }))
    expect(screen.queryByText('Fechar sem salvar?')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Entrada' }))
    await userEvent.keyboard('{Escape}')
    const pergunta = screen.getByText('Fechar sem salvar?').closest('[role="group"]') as HTMLElement
    await userEvent.click(within(pergunta).getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('works inside the hub provider, in strict mode, opened from a page', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qua-1105-et'))
    function Abre() {
      const { open } = useRegistrarSheet()
      return (
        <button type="button" onClick={(e) => open({ accountId: ids.accounts.topOne, opener: e.currentTarget })}>
          Abrir
        </button>
      )
    }
    renderHub(<Abre />, { strict: true })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }))
  })
})

describe('where it starts (§4.2)', () => {
  it('shows «Carregando…» while it reads', async () => {
    db.fetchOpenTrades.mockReturnValue(new Promise(() => undefined))
    abrir()
    expect(await screen.findByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar entrada' })).not.toBeInTheDocument()
  })

  it('no open trade: «Entrada»', async () => {
    abrir()
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(screen.getByText('Passo 1 de 3 · Entrada')).toBeInTheDocument()
    expect(screen.getByText('O Binary Hub não envia ordens: registrar é anotar.')).toBeInTheDocument()
  })

  it('one open trade: its «Operação aberta», with «Nova entrada»', async () => {
    const mes = entradaTelas('entry-mes').state
    db.fetchOpenTrades.mockResolvedValue([mes.trade])
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-aberta'))
    abrir()
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
    expect(screen.getByText('Passo 2 de 3 · Aberta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nova entrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar saída' })).toBeInTheDocument()
  })

  it('several: «Operações abertas», oldest first, without the step indicator', async () => {
    db.fetchOpenTrades.mockResolvedValue(abertasTelas())
    abrir()
    expect(await screen.findByRole('heading', { level: 3, name: 'Operações abertas' })).toBeInTheDocument()
    expect(screen.queryByText(/Passo \d de/)).not.toBeInTheDocument()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual([
      'MNQ · Compra · 1 ct · desde ontem, 10:52 ETRegistrar saída',
      'MES · Compra · 2 ct · desde 10:12 ETRegistrar saída',
      'MGC · Venda · 1 ct · desde 10:24 ETRegistrar saída',
    ])
    expect(screen.getByRole('button', { name: 'Registrar saída: MES · Compra · 2 ct · desde 10:12 ET' })).toBeInTheDocument()
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-aberta'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar saída: MES · Compra · 2 ct · desde 10:12 ET' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })).toBeInTheDocument()
    expect(screen.getByText('MES · Compra · 2 ct')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nova entrada' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
  })

  it('a closed trade: «Operação fechada»', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir({ tradeId: ids.trades.mes })
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('Passo 3 de 3 · Fechada')).toBeInTheDocument()
    expect(db.fetchOpenTrades).not.toHaveBeenCalled()
  })

  it('a trade that is gone: step 1 with «Esta operação não foi encontrada.»', async () => {
    db.fetchTradeState.mockResolvedValue(null)
    abrir({ tradeId: 'f2a8a3c0-0000-4000-8000-000000000000' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(screen.getByText('Esta operação não foi encontrada.')).toBeInTheDocument()
  })

  it('an account without rules: D18’s text and «Definir em Personalizar», no form', async () => {
    const json = telasJson('agora-qui-1031-et') as { accounts: Record<string, unknown>[] }
    json.accounts[0] = { ...json.accounts[0], version: null, rules: null, desde: null, desde_day: null }
    fetchRulesNow.mockResolvedValue(parseRulesNow(json))
    abrir()
    expect(await screen.findByText('Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Definir em Personalizar' })).toHaveAttribute('href', '/personalizar#janelas')
    expect(screen.queryByRole('button', { name: 'Registrar entrada' })).not.toBeInTheDocument()
  })

  it('an account that cannot register (FTMO) opens on the first one that can, primary first', async () => {
    abrir({ accountId: ids.accounts.ftmo })
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.getByRole('button', { name: 'Trocar a conta: Top One #1' })).toBeInTheDocument()
  })

  it('no account to register on: says so, with «Fechar»', async () => {
    fetchAccounts.mockResolvedValue(contasTelas().filter((a) => a.market === 'forex'))
    const { onClose } = abrir({ accountId: null })
    expect(await screen.findByText('Nenhuma conta de Futuros ou de binárias para registrar.')).toBeInTheDocument()
    const fechar = screen.getAllByRole('button', { name: 'Fechar' })
    await userEvent.click(fechar[fechar.length - 1])
    expect(onClose).toHaveBeenCalled()
  })

  it('open trades that fail to load: «Não foi possível carregar o Registrar.» and «Tentar de novo»', async () => {
    db.fetchOpenTrades.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    abrir()
    expect(await screen.findByText('Não foi possível carregar o Registrar.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
  })

  it('rules_now failing: the form works and says «Não foi possível conferir agora.», never «Liberado»', async () => {
    fetchRulesNow.mockRejectedValue(new Error('network'))
    abrir()
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível conferir agora.')).toBeInTheDocument()
    expect(screen.queryByText('Liberado')).not.toBeInTheDocument()
  })

  it('offline reads: «Sem conexão. Tente de novo quando a conexão voltar.», not «Carregando…» (C10)', async () => {
    onlineManager.setOnline(false)
    abrir()
    expect(await screen.findByText('Sem conexão. Tente de novo quando a conexão voltar.')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('the account inside the sheet (D4)', () => {
  it('switches on step 1 to another registrable account, with its own starting values', async () => {
    db.fetchRecentTrades.mockImplementation(async (_db, id) => (id === ids.accounts.ebinex ? recentesTelas('recentes-ebinex') : recentesTelas('recentes-top-one')))
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'Trocar a conta: Top One #1' }))
    expect(screen.getByText('Contas de mercados diferentes nunca são somadas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /FTMO/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ebinex · Pessoal' }))
    expect(await screen.findByRole('button', { name: 'Trocar a conta: Ebinex' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Par' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Par' })).getByRole('button', { name: 'EUR/USD' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('the draft (D14, C6)', () => {
  it('comes back on reopen with the same client_key, and is gone after a success', async () => {
    const first = abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(screen.getByRole('button', { name: 'Compra' }))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '4421,3')
    const stored = JSON.parse(sessionStorage.getItem(`hub:registrar:rascunho:${ids.accounts.topOne}`) as string)
    expect(stored).toMatchObject({ lado: 'long', preco: '4421,3' })
    first.unmount()
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(screen.getByLabelText('Preço de entrada')).toHaveValue('4421,3')
    expect(screen.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'true')
    db.registerEntry.mockResolvedValue(entradaTelas('entry-mgc'))
    db.fetchTradeState.mockResolvedValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    await waitFor(() => expect(db.registerEntry).toHaveBeenCalled())
    expect(db.registerEntry.mock.calls[0][2]).toMatchObject({ client_key: stored.clientKey })
    await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
    expect(sessionStorage.getItem(`hub:registrar:rascunho:${ids.accounts.topOne}`)).toBeNull()
  })
})

describe('«Ver no Diário» focus target', () => {
  it('closes with the bridge’s heading as the focus target', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    const { onClose } = abrir({ tradeId: ids.trades.mes })
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ focusId: 'operacoes-do-dia' }))
  })
})

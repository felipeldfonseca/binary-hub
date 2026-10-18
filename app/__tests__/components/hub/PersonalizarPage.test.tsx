import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import HubRoot from '@/components/hub/HubRoot'
import PersonalizarPage from '@/app/(hub)/personalizar/page'
import PersonalizarPagina from '@/components/hub/personalizar/PersonalizarPagina'
import { useEditarRegras } from '@/components/hub/personalizar/PersonalizarProvider'
import { changedOnlyHere, useSaveRules } from '@/hooks/useRegras'
import { storeMergedPreferences } from '@/hooks/useContas'
import { ERRO_REGRAS } from '@/components/hub/personalizar/copy'
import { buildSavePayload, type ConfigVersion, type RulesConfig, type RulesSettings, type SaveRulesResult } from '@/lib/hub/regras'
import { comLimite } from '@/lib/hub/rascunho'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { configAntes, configDepois, configMercados, contasMercados, idsDono, idsMercados } from '@/testing/regras'
import { et, topOneRules } from '@/testing/gate'

/** « · » with a no-break space on each side (personalizar/copy.ts SEP): it never starts or ends a line */
const SEP = '\u00a0·\u00a0'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
// The device clock of the previews: a Thursday of the owner's test week, unless a test moves it
const mockAgora = { at: new Date('2026-10-22T16:00:00Z') }
jest.mock('@/hooks/useAgora', () => ({ useAgora: () => mockAgora.at }))

jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchActivity: jest.fn(),
  fetchImportFormats: jest.fn(),
  fetchPreferences: jest.fn(),
}))
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  fetchRulesNow: jest.fn(),
  saveRules: jest.fn(),
  mergePreferences: jest.fn(),
  fetchTradesSince: jest.fn(),
}))

const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchActivity = contasDb.fetchActivity as jest.MockedFunction<typeof contasDb.fetchActivity>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>
const fetchTradesSince = regrasDb.fetchTradesSince as jest.MockedFunction<typeof regrasDb.fetchTradesSince>

const ids = idsDono()
const topOne = makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures', platform: 'topone', phase: 'financiada', size: 50000 })
const ebinex = makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })

beforeEach(() => {
  mockAgora.at = et('2026-10-22 12:00')
  window.history.replaceState(null, '', '/personalizar')
  for (const m of [fetchAccounts, fetchActivity, fetchRulesConfig, saveRules, fetchTradesSince]) m.mockReset()
  fetchAccounts.mockResolvedValue([topOne, ebinex])
  fetchActivity.mockResolvedValue({})
  fetchRulesConfig.mockResolvedValue(configDepois())
  fetchTradesSince.mockResolvedValue({ [ids.topOne]: 3 })
})

function renderPage(extra?: React.ReactNode) {
  return renderHub(
    <HubRoot>
      <PersonalizarPage />
      {extra}
    </HubRoot>,
  )
}

const regras = () => screen.getByRole('region', { name: 'Suas regras' })
const janelas = () => screen.getByRole('region', { name: 'Quando você opera' })
const statusTopo = () => screen.getAllByRole('status').find((s) => s.classList.contains('hub-pz-status-topo')) as HTMLElement
const botao = (name: string) => screen.getAllByRole('button', { name })
const salvarTopo = () => botao('Salvar alterações')[0]
const descartarTopo = () => botao('Descartar')[0]
const barra = () => document.querySelector('.hub-pz-barra') as HTMLElement | null
const ready = () => screen.findByRole('heading', { level: 3, name: 'Como fica hoje' })
const horarios = () => within(screen.getByRole('group', { name: 'Horários na tela' }))
const RULE_CARDS = ['Quando você opera', 'Suas regras', 'Preferências']

/** A call that stays pending until the test lets it finish */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
/** The amount on the «Limite do dia» row («Como fica hoje» repeats it) */
const valorLimite = () => (document.getElementById('r-lim')?.closest('li') as HTMLElement).querySelector('.hub-pz-regra__linha > span')

async function escolher(label: string) {
  await userEvent.click(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: label }))
}

/** Changes Top One's limit through the form */
async function mudarLimite(valor: string) {
  await escolher('Top One #1')
  await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' }))
  const field = screen.getByLabelText('Limite do dia, em US$')
  await userEvent.clear(field)
  await userEvent.type(field, valor)
  await userEvent.click(screen.getByRole('button', { name: 'OK' }))
}

/** The rules_config after a save of `settings` that gave Top One `newVersions` */
function configSalva(base: RulesConfig, settings: RulesSettings, rev: string, newVersions: Record<string, ConfigVersion> = {}): RulesConfig {
  return {
    ...base,
    rev,
    settings,
    accounts: base.accounts.map((a) => (newVersions[a.id] ? { ...a, versions: [...a.versions, newVersions[a.id]] } : a)),
  }
}

function resultado(rev: string, versions: SaveRulesResult['versions'] = []): SaveRulesResult {
  return { dryRun: false, savedAt: new Date('2026-10-22T16:00:00Z'), rev, versions, unchanged: [] }
}

const v2TopOne = (cents: number): ConfigVersion => ({
  id: 'v2',
  versionNo: 2,
  effectiveFrom: new Date('2026-10-22T16:00:00Z'),
  effectiveDay: '2026-10-22',
  origin: 'salvar',
  copiedFrom: null,
  rules: { ...topOneRules(), limit: { cents, mode: 'conta', atLimit: 'encerrar' } },
})

describe('the page', () => {
  it('shows the header, the section index and the Phase 2 sections, without the Phase 1 note', async () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Personalizar' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('Ajuste o Binary Hub às suas contas e ao que você opera.')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Seções do Personalizar' })
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Suas contas', '#contas'],
      ['Quando você opera', '#janelas'],
      ['Suas regras', '#regras'],
      ['Preferências', '#preferencias'],
    ])
    expect(within(nav).getByText('As mudanças valem depois de salvar. O tema e as ações em Suas contas valem na hora.')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Suas contas', 'Quando você opera', 'Suas regras', 'Preferências'])
    expect(screen.queryByText('O resto do Personalizar chega na Fase 2.')).not.toBeInTheDocument()
    await ready()
    expect(statusTopo()).toHaveTextContent('Tudo salvo')
    expect(barra()).toBeNull()
  })

  it('shows «Carregando…» in each card until the rules arrive, with both save buttons disabled', async () => {
    fetchRulesConfig.mockReturnValue(new Promise(() => {}))
    renderPage()

    for (const name of RULE_CARDS) {
      expect(within(screen.getByRole('region', { name })).getByText('Carregando…')).toBeInTheDocument()
    }
    // One live region for the three cards (they wait on the same rules), not three
    const vivas = RULE_CARDS.flatMap((name) => within(screen.getByRole('region', { name })).queryAllByRole('status'))
    expect(vivas).toHaveLength(1)
    expect(vivas[0]).toHaveTextContent('Carregando…')
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    expect(descartarTopo()).toHaveAttribute('aria-disabled', 'true')
    // The theme does not wait for the rules
    expect(screen.getByRole('button', { name: 'Escuro' })).toBeInTheDocument()
  })

  it('says when the rules could not be loaded, in each card, and tries again', async () => {
    fetchRulesConfig.mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))
    renderPage()

    await waitFor(() => expect(within(regras()).getByText('Não foi possível carregar as regras.')).toBeInTheDocument())
    expect(within(janelas()).getByText('Não foi possível carregar as regras.')).toBeInTheDocument()
    // Said once to a screen reader, not once per card
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(within(janelas()).getByRole('alert')).toHaveTextContent('Não foi possível carregar as regras.')
    await userEvent.click(within(regras()).getByRole('button', { name: 'Tentar de novo' }))
    await ready()
    expect(within(regras()).queryByText('Não foi possível carregar as regras.')).not.toBeInTheDocument()
  })

  it('never starts the draft on a cached answer before it is read again', async () => {
    let resolve: (c: RulesConfig) => void = () => {}
    function Alterna() {
      const [on, setOn] = React.useState(true)
      return (
        <>
          <button type="button" onClick={() => setOn((v) => !v)}>
            alternar
          </button>
          {on && <PersonalizarPage />}
        </>
      )
    }
    renderHub(
      <HubRoot>
        <Alterna />
      </HubRoot>,
    )
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'alternar' }))
    fetchRulesConfig.mockReturnValueOnce(new Promise((r) => (resolve = r)))

    // A second visit with the answer in the cache: loading until it is read again
    await userEvent.click(screen.getByRole('button', { name: 'alternar' }))
    expect(within(regras()).getByText('Carregando…')).toBeInTheDocument()
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    await act(async () => resolve(configDepois()))
    await ready()
  })

  it('merged preferences written into the cache while the first read runs do not start the draft on the cached answer', async () => {
    let resolve: (c: RulesConfig) => void = () => {}
    function Alterna() {
      const [on, setOn] = React.useState(true)
      return (
        <>
          <button type="button" onClick={() => setOn((v) => !v)}>
            alternar
          </button>
          {on && <PersonalizarPage />}
        </>
      )
    }
    const view = renderHub(
      <HubRoot>
        <Alterna />
      </HubRoot>,
    )
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'alternar' }))
    fetchRulesConfig.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    await userEvent.click(screen.getByRole('button', { name: 'alternar' }))

    // A theme click (merge_preferences) lands while the read runs: still the old cached rules.
    // React Query tells its observers on a timer, so wait for that before looking.
    await act(async () => {
      storeMergedPreferences(view.queryClient, 'user-1', { theme: 'escuro' })
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(view.queryClient.getQueryData<RulesConfig>(['hub', 'user-1', 'regras', 'config'])?.preferences).toEqual({ theme: 'escuro' })
    expect(within(regras()).getByText('Carregando…')).toBeInTheDocument()
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')

    await act(async () => resolve({ ...configDepois(), rev: 'rev-de-outra-aba' }))
    await ready()
    saveRules.mockResolvedValue(resultado('rev-3'))
    await mudarLimite('500')
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(saveRules.mock.calls[0][1].base_rev).toBe('rev-de-outra-aba')
  })
})

describe('«Quando você opera»', () => {
  it('shows the owner’s windows with the other clock and who uses them', async () => {
    mockAgora.at = et('2026-10-17 12:00')
    renderPage()
    await ready()

    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    expect(within(fut).getByRole('heading', { level: 3, name: 'Futuros' })).toBeInTheDocument()
    expect(within(fut).getByText('relógio de Nova York')).toBeInTheDocument()
    const start = within(fut).getByLabelText('Início da janela de Futuros, horário de Nova York')
    expect(start).toHaveValue('10:00')
    expect(within(fut).getByLabelText('Fim da janela de Futuros, horário de Nova York')).toHaveValue('11:00')
    expect(start).toHaveAttribute('aria-describedby', 'j-fut0-cap')
    expect(document.getElementById('j-fut0-cap')).toHaveTextContent('11:00–12:00 em Brasília · seg–sex')
    expect(within(fut).getByText('Usada por Top One #1.')).toBeInTheDocument()
    const bin = screen.getByRole('group', { name: 'Janela de Opções binárias' })
    expect(document.getElementById('j-bin0-cap')).toHaveTextContent('19:00–20:00 ET · seg–sex')
    expect(within(bin).getByText('Usada por Ebinex.')).toBeInTheDocument()
  })

  it('marks a changed market card «não salvo» and clears it when changed back', async () => {
    renderPage()
    await ready()
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    const start = within(fut).getByLabelText('Início da janela de Futuros, horário de Nova York')

    fireEvent.change(start, { target: { value: '09:30' } })
    expect(within(fut).getByText('não salvo')).toBeInTheDocument()
    expect(statusTopo()).toHaveTextContent('Alterações não salvas')
    fireEvent.change(start, { target: { value: '' } })
    expect(start).toHaveValue('09:30')
    fireEvent.change(start, { target: { value: '10:00' } })
    expect(within(fut).queryByText('não salvo')).not.toBeInTheDocument()
    expect(statusTopo()).toHaveTextContent('Tudo salvo')
  })

  it('a window error blocks the save and says why', async () => {
    renderPage()
    await ready()
    const end = screen.getByLabelText('Fim da janela de Opções binárias, horário de Brasília')

    fireEvent.change(end, { target: { value: '20:00' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Início e fim iguais: mude um dos dois.')
    expect(end).toHaveAttribute('aria-invalid', 'true')
    expect(end).toHaveAttribute('aria-describedby', 'j-bin0-cap j-bin0-erro')
    expect(statusTopo()).toHaveTextContent('Corrija a janela marcada para salvar.')
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    expect(descartarTopo()).toHaveAttribute('aria-disabled', 'false')
    await userEvent.click(salvarTopo())
    expect(saveRules).not.toHaveBeenCalled()
  })

  it('«+ Definir janela» fills the suggestion and focuses its start; «Cancelar esta janela» goes back', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    renderPage()
    await ready()
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    expect(within(fut).getByText('Sem janela: na Top One #1, a regra da janela não age.')).toBeInTheDocument()
    expect(within(fut).getByText('sem janela')).toBeInTheDocument()

    await userEvent.click(within(fut).getByRole('button', { name: '+ Definir janela' }))

    const start = within(fut).getByLabelText('Início da janela de Futuros, horário de Nova York')
    await waitFor(() => expect(start).toHaveFocus())
    expect(start).toHaveValue('10:00')
    await userEvent.click(within(fut).getByRole('button', { name: 'Cancelar a janela nova de Futuros' }))
    await waitFor(() => expect(within(fut).getByRole('button', { name: '+ Definir janela' })).toHaveFocus())
    expect(statusTopo()).toHaveTextContent('Tudo salvo')
  })

  it('adds and removes a second window, moving focus', async () => {
    renderPage()
    await ready()
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    await userEvent.click(within(fut).getByRole('button', { name: 'Relógio, dias e segunda janela de Futuros' }))

    await userEvent.click(within(fut).getByRole('button', { name: 'Segunda janela de Futuros' }))
    const start2 = within(fut).getByLabelText('Início da segunda janela de Futuros, horário de Nova York')
    await waitFor(() => expect(start2).toHaveFocus())
    expect(start2).toHaveValue('14:00')
    expect(within(fut).getByText('Máximo de 2 janelas por mercado.')).toBeInTheDocument()
    expect(within(fut).getByRole('group', { name: 'Dias da segunda janela' })).toBeInTheDocument()

    await userEvent.click(within(fut).getByRole('button', { name: 'Remover a segunda janela de Futuros' }))
    await waitFor(() => expect(within(fut).getByRole('button', { name: 'Segunda janela de Futuros' })).toHaveFocus())
  })

  it('switching the clock keeps the same instants', async () => {
    renderPage()
    await ready()
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    await userEvent.click(within(fut).getByRole('button', { name: 'Relógio, dias e segunda janela de Futuros' }))

    await userEvent.click(within(within(fut).getByRole('group', { name: 'Relógio da janela' })).getByRole('button', { name: 'Brasília' }))

    expect(within(fut).getByLabelText('Início da janela de Futuros, horário de Brasília')).toHaveValue('11:00')
    expect(within(fut).getByText('relógio de Brasília')).toBeInTheDocument()
  })
})

describe('«Suas regras»', () => {
  it('opens on «Padrão Futuros» without a saved account choice, and on conta_atual with one', async () => {
    const view = renderPage()
    await ready()
    const pills = within(screen.getByRole('group', { name: 'Regras de' })).getAllByRole('button')
    expect(pills.map((p) => [p.textContent, p.getAttribute('aria-pressed')])).toEqual([
      ['Padrão Futuros', 'true'],
      ['Top One #1', 'false'],
      ['Ebinex', 'false'],
    ])
    expect(within(regras()).getByText('vale para 1 conta')).toBeInTheDocument()
    expect(within(regras()).getByText('Vale por conta: escolha uma conta acima.')).toBeInTheDocument()
    view.unmount()

    fetchRulesConfig.mockResolvedValue({ ...configDepois(), preferences: { conta_atual: ids.ebinex } })
    renderPage()
    await ready()
    expect(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: 'Ebinex' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(regras()).getByText('Opções binárias · Pessoal')).toBeInTheDocument()
  })

  it('reads ?regras= from the address (no useSearchParams) and #regras focuses the heading', async () => {
    window.history.replaceState(null, '', `/personalizar?regras=${ids.topOne}#regras`)
    renderPage()
    await ready()

    expect(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: 'Top One #1' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Suas regras' })).toHaveFocus())
  })

  it('shows the owner’s Top One: rows, «Como fica hoje» and the versions', async () => {
    renderPage()
    await ready()
    await escolher('Top One #1')

    expect(within(regras()).getByRole('heading', { level: 3, name: 'Top One #1' })).toBeInTheDocument()
    expect(within(regras()).getByText('Futuros · Financiada')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Só operar dentro da sua janela' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Bloqueio de dados' })).toHaveAttribute('aria-describedby', 'r-bloq-hoje')
    expect(valorLimite()).toHaveTextContent('US$ 400')
    const hoje = screen.getByRole('list', { name: 'Como fica hoje' })
    expect(within(hoje).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `10:00–11:00 ET${SEP}sua janelaLiberado`,
      'No resto do diaFora da sua janela',
      'Se a perda do dia chegar a US$\u00a0400Encerrado por hoje',
      'Bloqueio de dadosativo na Fase 5',
    ])
    expect(screen.getByText('Regras v1 desde 17 out')).toBeInTheDocument()
    expect(await screen.findByText('3 operações do diário desde 17 out.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Versões (1)' }))
    const lista = document.getElementById('lista-versoes') as HTMLElement
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `v1${SEP}desde 17 out${SEP}janela 10:00–11:00 ET${SEP}seg–sex${SEP}limite US$\u00a0400 por conta`,
      `Antes de 17 out: Histórico importado${SEP}só resultado.`,
    ])
    expect(screen.getByText('As Análises contam a partir daqui.')).toBeInTheDocument()
  })

  it('«não salvo» on the changed row, and «Ao salvar …» with the day a save would carry', async () => {
    renderPage()
    await ready()
    await escolher('Top One #1')

    await userEvent.click(screen.getByRole('button', { name: 'Só avisar' }))

    const row = screen.getByText('Limite do dia', { selector: '#r-lim' }).closest('li') as HTMLElement
    expect(within(row).getByText('não salvo')).toBeInTheDocument()
    expect(screen.getByText('Ao salvar: Regras v2 desde 22 out.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar o dia no app' }))
    expect(within(row).queryByText('não salvo')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ao salvar/)).not.toBeInTheDocument()
  })

  it('the limit form: focus on open, errors after OK, focus back to «Mudar»', async () => {
    renderPage()
    await ready()
    await escolher('Top One #1')
    const mudar = screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' })

    await userEvent.click(mudar)
    const field = screen.getByLabelText('Limite do dia, em US$')
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveValue('400')
    expect(mudar).toHaveAttribute('aria-expanded', 'true')

    await userEvent.clear(field)
    await userEvent.type(field, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Use só números, como 400 ou 400,50.')
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(field)
    await userEvent.type(field, '0')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Digite um valor maior que zero.')
    await userEvent.clear(field)
    await userEvent.type(field, '2000000')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Use um valor até US$ 1.000.000.')

    await userEvent.clear(field)
    await userEvent.type(field, '450,50')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByLabelText('Limite do dia, em US$')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' })).toHaveFocus())
    expect(valorLimite()).toHaveTextContent('US$ 450,50')
  })

  it('switching «Regras de» closes the limit form and keeps every draft', async () => {
    renderPage()
    await ready()
    await mudarLimite('500')
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' }))

    await escolher('Ebinex')
    expect(screen.queryByLabelText('Limite do dia, em US$')).not.toBeInTheDocument()
    await escolher('Top One #1')
    expect(valorLimite()).toHaveTextContent('US$ 500')
  })

  it('«Editar regras» (useEditarRegras) selects the account and focuses «Suas regras»; null outside the page', async () => {
    function EditarDeFora() {
      const editar = useEditarRegras()
      return (
        <button type="button" onClick={() => editar?.(ids.ebinex)}>
          {editar ? 'editar de fora' : 'sem provider'}
        </button>
      )
    }
    const outside = renderHub(<EditarDeFora />)
    expect(screen.getByRole('button', { name: 'sem provider' })).toBeInTheDocument()
    outside.unmount()

    renderHub(
      <HubRoot>
        <PersonalizarPagina>
          <h1 tabIndex={-1}>Personalizar</h1>
          <EditarDeFora />
        </PersonalizarPagina>
      </HubRoot>,
    )
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'editar de fora' }))

    expect(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: 'Ebinex' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Suas regras' })).toHaveFocus())
  })

  it('«Começar as regras hoje» on an account without versions asks for its v1', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    await escolher('Ebinex')
    expect(screen.getByText('Nenhuma versão salva')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Começar as regras hoje' }))

    await waitFor(() => expect(screen.getByText('Ao salvar: Regras v1 desde 22 out.')).toHaveFocus())
    expect(statusTopo()).toHaveTextContent('Alterações não salvas')
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(saveRules.mock.calls[0][1].accounts?.[ids.ebinex]).toMatchObject({ version: 'force', window: null })
  })

  it('the calendars: none marked says so, here and in the block line', async () => {
    renderPage()
    await ready()

    await userEvent.click(screen.getByRole('checkbox', { name: 'EUA' }))

    expect(screen.getAllByText('Nenhum calendário marcado: nada vai bloquear o dia.')).toHaveLength(2)
    expect(statusTopo()).toHaveTextContent('Alterações não salvas')
  })
})

describe('six markets (Fase 2b)', () => {
  // The six-market owner as recorded on the markets migration (invented data): Top One #1, Ebinex,
  // FTMO (Forex, Avaliação), IBKR (Ações, no version), Binance (Cripto), Clear (B3, R$ 500)
  const im = idsMercados()

  beforeEach(() => {
    fetchAccounts.mockResolvedValue(contasMercados())
    fetchRulesConfig.mockResolvedValue(configMercados())
    fetchTradesSince.mockResolvedValue({})
  })

  it('a card per market with an account, «Regras de» in the same order, the chips with each account’s phase', async () => {
    renderPage()
    await ready()

    expect(within(janelas()).getAllByRole('group', { name: /^Janela d/ }).map((g) => g.getAttribute('aria-label'))).toEqual([
      'Janela de Futuros',
      'Janela de Opções binárias',
      'Janela de Forex',
      'Janela de Ações',
      'Janela de Cripto',
      'Janela da B3',
    ])
    expect(within(janelas()).queryByRole('button', { name: '+ Adicionar conta' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Regras de' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Padrão Futuros',
      'Top One #1',
      'Ebinex',
      'FTMO',
      'IBKR',
      'Binance',
      'Clear',
    ])

    await escolher('Clear')
    expect(within(regras()).getByText('B3 · Pessoal')).toBeInTheDocument()
    expect(valorLimite()?.textContent).toBe('R$\u00a0500')
    await escolher('FTMO')
    expect(within(regras()).getByText('Forex · Avaliação')).toBeInTheDocument()
    expect(within(regras()).getByRole('button', { name: 'Como ler: regras de Forex' })).toBeInTheDocument()
  })

  it('saves a B3 limit with the brl key, and nothing else', async () => {
    const base = configMercados()
    const saved = comLimite(base.settings, im.clear, 75000)
    saveRules.mockResolvedValue(
      resultado('rev-2', [{ accountId: im.clear, versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22', origin: 'salvar' }]),
    )
    renderPage()
    await ready()
    await escolher('Clear')

    await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Clear' }))
    const field = screen.getByLabelText('Limite do dia, em R$')
    await userEvent.clear(field)
    await userEvent.type(field, '750')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(valorLimite()?.textContent).toBe('R$\u00a0750')
    // Clear's day turns at midnight in Brasília: Thursday 12:00 ET is still 22 out
    expect(screen.getByText('Ao salvar: Regras v2 desde 22 out.')).toBeInTheDocument()

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    const payload = saveRules.mock.calls[0][1]
    expect(payload).toEqual(buildSavePayload(base, saved))
    expect(Object.keys(payload.accounts ?? {})).toEqual([im.clear])
    expect(payload.accounts?.[im.clear].rules.limit).toEqual({ brl: 750, mode: 'conta', at_limit: 'encerrar' })
    // No market default rides along (the 2b app never writes defaults it did not change)
    expect(payload.defaults).toBeUndefined()
    await waitFor(() => expect(statusTopo()).toHaveTextContent('Salvo. Regras novas desde 22 out: Clear v2.'))
  })

  it('«+ Definir janela» in Ações saves the stocks default (09:30–10:30 ET), and IBKR gets its first version', async () => {
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    const acoes = within(janelas()).getByRole('group', { name: 'Janela de Ações' })

    await userEvent.click(within(acoes).getByRole('button', { name: '+ Definir janela' }))
    await escolher('IBKR')
    expect(screen.getByText('Ao salvar: Regras v1 desde 22 out.')).toBeInTheDocument()
    await userEvent.click(salvarTopo())

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    const payload = saveRules.mock.calls[0][1]
    expect(Object.keys(payload.defaults ?? {})).toEqual(['stocks'])
    expect(payload.defaults?.stocks?.windows).toEqual([{ tz: 'America/New_York', start_min: 570, end_min: 630, weekdays: 31 }])
    expect(payload.defaults?.stocks?.rules).not.toHaveProperty('block')
    expect(payload.defaults?.stocks?.rules).not.toHaveProperty('states')
  })
})

describe('save, discard and the bar', () => {
  it('saves the draft (save_rules with buildSavePayload against the loaded rules) and says what changed', async () => {
    const base = configDepois()
    const saved = comLimite(base.settings, ids.topOne, 50000)
    saveRules.mockResolvedValue(
      resultado('rev-2', [{ accountId: ids.topOne, versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22', origin: 'salvar' }]),
    )
    renderPage()
    await ready()
    await mudarLimite('500')
    fetchRulesConfig.mockResolvedValue(configSalva(base, saved, 'rev-2', { [ids.topOne]: v2TopOne(50000) }))
    expect(barra()).not.toBeNull()

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent('Salvo. Regras novas desde 22 out: Top One #1 v2.'))
    expect(saveRules.mock.calls[0][1]).toEqual(buildSavePayload(base, saved))
    expect(saveRules.mock.calls[0][2]).toEqual({ dryRun: false })
    expect(barra()).toBeNull()
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Regras v2 desde 22 out')).toBeInTheDocument()
  })

  it('the bar stays after a save made from it until focus leaves it', async () => {
    const base = configDepois()
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Zona do euro' }))
    fetchRulesConfig.mockResolvedValue(configSalva(base, { ...base.settings, calendars: ['us', 'eu'] }, 'rev-2'))
    const bar = barra() as HTMLElement
    expect(bar).toHaveClass('hub-pz-barra--mudou')
    expect(within(bar).getByText('Alterações não salvas')).toBeInTheDocument()

    await userEvent.click(within(bar).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(within(bar).getByText('Salvo.')).toBeInTheDocument())
    expect(barra()).not.toHaveClass('hub-pz-barra--mudou')
    // The bar repeats the status as plain text; the header's is the only live region
    expect(within(bar).queryByRole('status')).not.toBeInTheDocument()
    act(() => within(bar).getByRole('button', { name: 'Descartar' }).focus())
    expect(barra()).not.toBeNull()
    act(() => screen.getByRole('checkbox', { name: 'Brasil' }).focus())
    expect(barra()).toBeNull()
  })

  it('discards: the saved values come back and focus stays', async () => {
    renderPage()
    await ready()
    await mudarLimite('500')
    const discard = within(barra() as HTMLElement).getByRole('button', { name: 'Descartar' })
    act(() => discard.focus())

    await userEvent.click(discard)

    expect(valorLimite()).toHaveTextContent('US$ 400')
    expect(statusTopo()).toHaveTextContent('Alterações descartadas.')
    expect(discard).toHaveFocus()
    expect(discard).toHaveAttribute('aria-disabled', 'true')
  })

  it('«Horários na tela» is saved with the bar (save_rules), never at once', async () => {
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()

    await userEvent.click(within(screen.getByRole('group', { name: 'Horários na tela' })).getByRole('button', { name: 'Os dois' }))
    expect(regrasDb.mergePreferences).not.toHaveBeenCalled()
    await userEvent.click(salvarTopo())

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(saveRules.mock.calls[0][1]).toEqual({ v: 1, base_rev: configDepois().rev, preferences: { display_tz: 'both' } })
  })

  it('rules_changed: the draft stays and the status says another tab saved', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('rules_changed'))
    renderPage()
    await ready()
    await mudarLimite('500')

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent('As regras foram salvas em outra aba. Recarregue para ver a versão salva.'))
    expect(valorLimite()).toHaveTextContent('US$ 500')
  })

  it('rules_changed: the rules are read again, and «Descartar» starts from what the other tab saved', async () => {
    const outra: RulesConfig = { ...configDepois(), rev: 'rev-de-outra-aba', settings: { ...configDepois().settings, displayTz: 'both' } }
    saveRules.mockRejectedValueOnce(new regrasDb.RegrasDataError('rules_changed'))
    renderPage()
    await ready()
    expect(horarios().getByRole('button', { name: 'Nova York (ET)' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(horarios().getByRole('button', { name: 'Brasília' }))
    fetchRulesConfig.mockResolvedValue(outra)
    const reads = fetchRulesConfig.mock.calls.length

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent('As regras foram salvas em outra aba.'))
    await waitFor(() => expect(fetchRulesConfig.mock.calls.length).toBeGreaterThan(reads))
    // The dirty draft keeps its old base (a save stays refused) …
    expect(horarios().getByRole('button', { name: 'Brasília' })).toHaveAttribute('aria-pressed', 'true')
    // … and «Descartar» shows what the database holds now
    await userEvent.click(descartarTopo())
    expect(horarios().getByRole('button', { name: 'Os dois' })).toHaveAttribute('aria-pressed', 'true')
    expect(statusTopo()).toHaveTextContent('Alterações descartadas.')

    saveRules.mockResolvedValueOnce(resultado('rev-4'))
    await userEvent.click(horarios().getByRole('button', { name: 'Brasília' }))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2))
    expect(saveRules.mock.calls[1][1].base_rev).toBe('rev-de-outra-aba')
  })

  it('«Descartar» takes a newer answer that already arrived (the draft kept its old base)', async () => {
    const view = renderPage()
    await ready()
    await mudarLimite('500')
    fetchRulesConfig.mockResolvedValue({ ...configDepois(), rev: 'rev-de-outra-aba', settings: { ...configDepois().settings, displayTz: 'br' } })
    await act(async () => {
      await view.queryClient.invalidateQueries({ queryKey: ['hub', 'user-1', 'regras'] })
    })
    expect(horarios().getByRole('button', { name: 'Nova York (ET)' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(descartarTopo())

    expect(valorLimite()).toHaveTextContent('US$ 400')
    expect(horarios().getByRole('button', { name: 'Brasília' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the rules read after a save carry another tab’s newer save too: nothing stays locked', async () => {
    const base = configDepois()
    const saved = comLimite(base.settings, ids.topOne, 50000)
    saveRules.mockResolvedValue(
      resultado('rev-2', [{ accountId: ids.topOne, versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22', origin: 'salvar' }]),
    )
    renderPage()
    await ready()
    await mudarLimite('500')
    // Between this save and its read, another tab saved «Os dois»
    fetchRulesConfig.mockResolvedValue(configSalva(base, { ...saved, displayTz: 'both' }, 'rev-3', { [ids.topOne]: v2TopOne(50000) }))

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent('Salvo. Regras novas desde 22 out: Top One #1 v2.'))
    // Untouched since the save, the draft takes the newest rules
    await waitFor(() => expect(horarios().getByRole('button', { name: 'Os dois' })).toHaveAttribute('aria-pressed', 'true'))
    expect(valorLimite()).toHaveTextContent('US$ 500')
    await userEvent.click(horarios().getByRole('button', { name: 'Brasília' }))
    expect(statusTopo()).toHaveTextContent('Alterações não salvas')
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'false')
    expect(descartarTopo()).toHaveAttribute('aria-disabled', 'false')
    saveRules.mockResolvedValueOnce(resultado('rev-4'))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2))
    expect(saveRules.mock.calls[1][1].base_rev).toBe('rev-3')
  })

  it('after a failed read, «Tentar de novo» that brings another tab’s newer save unlocks the buttons', async () => {
    const base = configDepois()
    const saved = comLimite(base.settings, ids.topOne, 50000)
    saveRules.mockResolvedValue(
      resultado('rev-2', [{ accountId: ids.topOne, versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22', origin: 'salvar' }]),
    )
    renderPage()
    await ready()
    await mudarLimite('500')
    fetchRulesConfig.mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(within(regras()).getByText('Não foi possível carregar as regras.')).toBeInTheDocument())

    fetchRulesConfig.mockResolvedValue(configSalva(base, { ...saved, displayTz: 'br' }, 'rev-3', { [ids.topOne]: v2TopOne(50000) }))
    await userEvent.click(within(regras()).getByRole('button', { name: 'Tentar de novo' }))
    await ready()

    await waitFor(() => expect(horarios().getByRole('button', { name: 'Brasília' })).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(horarios().getByRole('button', { name: 'Os dois' }))
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'false')
  })

  it('«Começar as regras hoje» pressed while a save runs is kept for the next save', async () => {
    const antes = configAntes()
    const pending = deferred<SaveRulesResult>()
    fetchRulesConfig.mockResolvedValue(antes)
    saveRules.mockReturnValueOnce(pending.promise)
    renderPage()
    await ready()
    await userEvent.click(horarios().getByRole('button', { name: 'Os dois' }))
    await userEvent.click(salvarTopo())
    await escolher('Ebinex')
    await userEvent.click(screen.getByRole('button', { name: 'Começar as regras hoje' }))

    fetchRulesConfig.mockResolvedValue({ ...antes, rev: 'rev-2', settings: { ...antes.settings, displayTz: 'both' } })
    await act(async () => pending.resolve(resultado('rev-2')))

    await waitFor(() => expect(statusTopo()).toHaveTextContent('Alterações não salvas'))
    expect(screen.getByText('Ao salvar: Regras v1 desde 22 out.')).toBeInTheDocument()
    saveRules.mockResolvedValueOnce(resultado('rev-3'))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2))
    expect(saveRules.mock.calls[1][1].base_rev).toBe('rev-2')
    expect(saveRules.mock.calls[1][1].accounts?.[ids.ebinex]).toMatchObject({ version: 'force' })
  })

  it('a part set back to its saved value while a save runs stays as set', async () => {
    const base = configDepois()
    const pending = deferred<SaveRulesResult>()
    saveRules.mockReturnValueOnce(pending.promise)
    renderPage()
    await ready()
    await userEvent.click(horarios().getByRole('button', { name: 'Brasília' }))
    await userEvent.click(salvarTopo())
    await userEvent.click(horarios().getByRole('button', { name: 'Nova York (ET)' }))

    fetchRulesConfig.mockResolvedValue(configSalva(base, { ...base.settings, displayTz: 'br' }, 'rev-2'))
    await act(async () => pending.resolve(resultado('rev-2')))

    await waitFor(() => expect(statusTopo()).toHaveTextContent('Alterações não salvas'))
    expect(horarios().getByRole('button', { name: 'Nova York (ET)' })).toHaveAttribute('aria-pressed', 'true')
    saveRules.mockResolvedValueOnce(resultado('rev-3'))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2))
    expect(saveRules.mock.calls[1][1]).toEqual({ v: 1, base_rev: 'rev-2', preferences: { display_tz: 'et' } })
  })

  it('one save however fast «Salvar alterações» is pressed twice', async () => {
    const pending = deferred<SaveRulesResult>()
    saveRules.mockReturnValue(pending.promise)
    renderPage()
    await ready()
    await mudarLimite('500')
    const salvar = salvarTopo()

    // Both clicks before React draws «Salvando…»
    act(() => {
      salvar.click()
      salvar.click()
    })

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    await act(async () => pending.resolve(resultado('rev-2')))
    expect(saveRules).toHaveBeenCalledTimes(1)
  })

  it('discard closes the limit form and drops a v1 asked for', async () => {
    fetchRulesConfig.mockResolvedValue(configAntes())
    renderPage()
    await ready()
    await escolher('Ebinex')
    await userEvent.click(screen.getByRole('button', { name: 'Começar as regras hoje' }))
    await userEvent.click(screen.getByRole('button', { name: 'Definir o limite do dia de Ebinex' }))
    expect(screen.getByLabelText('Limite do dia, em US$')).toBeInTheDocument()

    await userEvent.click(descartarTopo())

    expect(screen.queryByLabelText('Limite do dia, em US$')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Começar as regras hoje' })).toBeInTheDocument()
    expect(screen.queryByText(/Ao salvar/)).not.toBeInTheDocument()
    expect(statusTopo()).toHaveTextContent('Alterações descartadas.')
  })

  it('unknown_account: its own copy, and the rules and accounts are read again', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('unknown_account'))
    renderPage()
    await ready()
    await mudarLimite('500')
    const configCalls = fetchRulesConfig.mock.calls.length
    const accountCalls = fetchAccounts.mock.calls.length

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent(ERRO_REGRAS.unknown_account))
    await waitFor(() => expect(fetchRulesConfig.mock.calls.length).toBeGreaterThan(configCalls))
    expect(fetchAccounts.mock.calls.length).toBeGreaterThan(accountCalls)
  })

  it('archived_account: its own copy, and the rules and accounts are read again', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('archived_account'))
    renderPage()
    await ready()
    await mudarLimite('500')
    const configCalls = fetchRulesConfig.mock.calls.length
    const accountCalls = fetchAccounts.mock.calls.length

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(statusTopo()).toHaveTextContent('Uma conta mudou em outra aba. Nada foi alterado; confira e salve de novo.'))
    await waitFor(() => expect(fetchRulesConfig.mock.calls.length).toBeGreaterThan(configCalls))
    expect(fetchAccounts.mock.calls.length).toBeGreaterThan(accountCalls)
  })

  it('a save made elsewhere in this tab (the import sheet) rebases the draft: the next save sends the new rev and only the page’s change', async () => {
    const base = configDepois()
    const apex = { ...base.accounts[0], id: 'acc-apex', label: 'Apex A', versions: [] }
    const nova: RulesConfig = { ...base, rev: 'rev-nova-conta', accounts: [...base.accounts, apex], settings: { ...base.settings, accounts: { ...base.settings.accounts, 'acc-apex': base.settings.accounts[ids.ebinex] } } }
    function SalvarDeFora() {
      const save = useSaveRules()
      return (
        <button type="button" onClick={() => void save.mutateAsync({ payload: { v: 1, base_rev: base.rev, accounts: {} } })}>
          salvar de fora
        </button>
      )
    }
    const view = renderPage(<SalvarDeFora />)
    await ready()
    await mudarLimite('500')

    saveRules.mockResolvedValueOnce(resultado('rev-nova-conta'))
    fetchRulesConfig.mockResolvedValue(nova)
    await userEvent.click(screen.getByRole('button', { name: 'salvar de fora' }))
    await waitFor(() => expect(screen.getByRole('group', { name: 'Regras de' })).toHaveTextContent('Apex A'))

    expect(changedOnlyHere(view.queryClient, base.rev, 'rev-nova-conta')).toBe(true)
    expect(statusTopo()).toHaveTextContent('Alterações não salvas')
    expect(valorLimite()).toHaveTextContent('US$ 500')
    saveRules.mockResolvedValueOnce(resultado('rev-3'))
    await userEvent.click(salvarTopo())
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2))
    const payload = saveRules.mock.calls[1][1]
    expect(payload.base_rev).toBe('rev-nova-conta')
    expect(Object.keys(payload.accounts ?? {})).toEqual([ids.topOne])
    expect(payload.defaults).toBeUndefined()
    expect(screen.queryByText(/outra aba/)).not.toBeInTheDocument()
  })

  it('a newer save from another tab: the draft keeps its old base, so the save sends the old rev and is refused', async () => {
    const base = configDepois()
    const view = renderPage()
    await ready()
    await mudarLimite('500')

    fetchRulesConfig.mockResolvedValue({ ...configDepois(), rev: 'rev-de-outra-aba' })
    await act(async () => {
      await view.queryClient.invalidateQueries({ queryKey: ['hub', 'user-1', 'regras'] })
    })
    expect(valorLimite()).toHaveTextContent('US$ 500')
    saveRules.mockRejectedValueOnce(new regrasDb.RegrasDataError('rules_changed'))
    await userEvent.click(salvarTopo())

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(saveRules.mock.calls[0][1].base_rev).toBe(base.rev)
    await waitFor(() => expect(statusTopo()).toHaveTextContent('As regras foram salvas em outra aba.'))
  })

  it('the save went through but the rules did not come back: «Salvo…», the load error, buttons disabled until they do', async () => {
    const base = configDepois()
    const saved = comLimite(base.settings, ids.topOne, 50000)
    saveRules.mockResolvedValue(
      resultado('rev-2', [{ accountId: ids.topOne, versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22', origin: 'salvar' }]),
    )
    renderPage()
    await ready()
    await mudarLimite('500')
    fetchRulesConfig.mockRejectedValueOnce(new regrasDb.RegrasDataError('network'))

    await userEvent.click(salvarTopo())

    await waitFor(() => expect(within(regras()).getByText('Não foi possível carregar as regras.')).toBeInTheDocument())
    expect(statusTopo()).toHaveTextContent('Salvo. Regras novas desde 22 out: Top One #1 v2.')
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    expect(descartarTopo()).toHaveAttribute('aria-disabled', 'true')

    fetchRulesConfig.mockResolvedValue(configSalva(base, saved, 'rev-2', { [ids.topOne]: v2TopOne(50000) }))
    await userEvent.click(within(regras()).getByRole('button', { name: 'Tentar de novo' }))
    await ready()
    expect(statusTopo()).toHaveTextContent('Salvo. Regras novas desde 22 out: Top One #1 v2.')
    expect(salvarTopo()).toHaveAttribute('aria-disabled', 'true')
    await escolher('Top One #1')
    expect(screen.getByText('Regras v2 desde 22 out')).toBeInTheDocument()
  })

  it('asks before leaving only while there are unsaved changes', async () => {
    renderPage()
    await ready()
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)
    await mudarLimite('500')
    expect(leave()).toBe(true)
    await userEvent.click(descartarTopo())
    expect(leave()).toBe(false)
  })
})

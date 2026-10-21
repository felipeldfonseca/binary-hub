/**
 * Fase 3c · lane C2 (telas contract §6.5, §8.2; Personalizar approved 21 Oct, P l.604–639): Suas
 * regras › «Durante a operação» › «Mover para o breakeven» on the page, with the recorded
 * rules_config of the owner (testing/regras; invented data) and invented recent trades.
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import HubRoot from '@/components/hub/HubRoot'
import PersonalizarPage from '@/app/(hub)/personalizar/page'
import { REGRAS_BE } from '@/components/hub/personalizar/copy'
import { resolveRules, type AccountConfig, type RulesConfig, type RulesSettings, type SaveRulesResult } from '@/lib/hub/regras'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { configDepois, configMercados, contasMercados, idsDono, idsMercados } from '@/testing/regras'
import { et } from '@/testing/gate'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
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
jest.mock('@/lib/hub/registrarDb', () => ({ ...jest.requireActual('@/lib/hub/registrarDb'), fetchRecentTrades: jest.fn() }))

const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchActivity = contasDb.fetchActivity as jest.MockedFunction<typeof contasDb.fetchActivity>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>
const fetchTradesSince = regrasDb.fetchTradesSince as jest.MockedFunction<typeof regrasDb.fetchTradesSince>
const fetchRecentTrades = registrarDb.fetchRecentTrades as jest.MockedFunction<typeof registrarDb.fetchRecentTrades>

const ids = idsDono()
const topOne = makeAccount({ id: ids.topOne, label: 'Top One #1', market: 'futures', platform: 'topone', phase: 'financiada', size: 50000 })
const ebinex = makeAccount({ id: ids.ebinex, label: 'Ebinex', market: 'binary', platform: 'ebinex', phase: 'pessoal', is_primary: true })
const APEX = 'acc-apex-b'
const apex = makeAccount({ id: APEX, label: 'Apex B', market: 'futures', platform: null, phase: 'avaliacao' })

/** The settings saved, with every account's current rules and last version resolving to them */
function salvo(c: RulesConfig, settings: RulesSettings): RulesConfig {
  return {
    ...c,
    settings,
    accounts: c.accounts.map((a) => {
      const r = resolveRules(a, settings)
      return { ...a, current: r, versions: a.versions.map((v, i, l) => (i === l.length - 1 ? { ...v, rules: r } : v)) }
    }),
  }
}

/** The owner with «Padrão Futuros» on (MES +8, MNQ +30, MGC +5) and Apex B (no version) with its own copy (MES +10) */
function comRegraEApex(): RulesConfig {
  const c = configDepois()
  const top = c.accounts.find((a) => a.id === ids.topOne) as AccountConfig
  const ap: AccountConfig = { ...top, id: APEX, label: 'Apex B', versions: [] }
  const settings: RulesSettings = {
    ...c.settings,
    markets: { ...c.settings.markets, futures: { ...c.settings.markets.futures, breakeven: { on: true, by: { MES: '8', MNQ: '30', MGC: '5' } } } },
    accounts: { ...c.settings.accounts, [APEX]: { windowRule: {}, block: {}, limit: null, window: null, breakeven: { on: true, by: { MES: '10' } } } },
  }
  return salvo({ ...c, accounts: [...c.accounts, ap] }, settings)
}

function resultado(rev: string): SaveRulesResult {
  return { dryRun: false, savedAt: new Date('2026-10-22T16:00:00Z'), rev, versions: [], unchanged: [] }
}

beforeEach(() => {
  mockAgora.at = et('2026-10-22 12:00')
  window.history.replaceState(null, '', '/personalizar')
  for (const m of [fetchAccounts, fetchActivity, fetchRulesConfig, saveRules, fetchTradesSince, fetchRecentTrades]) m.mockReset()
  fetchAccounts.mockResolvedValue([topOne, ebinex])
  fetchActivity.mockResolvedValue({})
  fetchRulesConfig.mockResolvedValue(configDepois())
  fetchTradesSince.mockResolvedValue({ [ids.topOne]: 3 })
  fetchRecentTrades.mockResolvedValue([])
})

const renderPage = () =>
  renderHub(
    <HubRoot>
      <PersonalizarPage />
    </HubRoot>,
  )
const ready = () => screen.findByRole('heading', { level: 3, name: 'Como fica hoje' })
async function escolher(label: string) {
  await userEvent.click(within(screen.getByRole('group', { name: 'Regras de' })).getByRole('button', { name: label }))
}
const grupo = () => screen.queryByRole('group', { name: 'Durante a operação' })
const linha = () => (document.getElementById('r-be') as HTMLElement).closest('li') as HTMLElement
const chave = () => screen.getByRole('switch', { name: 'Mover para o breakeven' })
const valor = (a: string) => screen.getByRole('textbox', { name: `Pontos a favor no ${a}` })
const barra = () => document.querySelector('.hub-pz-barra') as HTMLElement | null
const op = (symbol: string, iso: string) => ({ symbol, assetType: 'futures', direction: 'long' as const, quantity: '1', stake: null, payout: null, durationS: null, source: 'live' as const, entryTime: new Date(iso) })

describe('where it shows', () => {
  it('on «Padrão Futuros» and futures accounts, after the rules, before «Como fica hoje»; never on Ebinex or other markets', async () => {
    const im = idsMercados()
    fetchRulesConfig.mockResolvedValue(configMercados())
    fetchAccounts.mockResolvedValue(contasMercados())
    renderPage()
    await ready()
    for (const label of ['Padrão Futuros', 'Top One #1']) {
      await escolher(label)
      const g = grupo() as HTMLElement
      expect(g).not.toBeNull()
      expect(within(g).getByRole('heading', { level: 4, name: 'Durante a operação' })).toBeInTheDocument()
      expect(within(g).getByText('Não muda o “Posso operar hoje?”: guia a operação aberta, e as Análises conferem depois.')).toBeInTheDocument()
      const regras = document.querySelector('.hub-pz-regras') as HTMLElement
      const hoje = screen.getByRole('heading', { level: 3, name: 'Como fica hoje' })
      expect(regras.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(g.compareDocumentPosition(hoje) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const label of ['Ebinex', 'FTMO', 'IBKR', 'Binance', 'Clear']) {
      await escolher(label)
      expect(grupo()).toBeNull()
    }
    expect(im.ftmo).toBeTruthy()
  })

  it('the ⓘ of «Suas regras» says the rule never changes «Posso operar hoje?»', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Suas regras' }))
    expect(document.getElementById('info-regras')).toHaveTextContent(
      'a regra por estado é uma só para o mercado. “Mover para o breakeven” (Futuros) não muda o “Posso operar hoje?”: o Registrar sugere, sem bloquear, e as Análises conferem depois. Nos outros mercados,',
    )
  })
})

describe('off, on, the first switch-on', () => {
  it('off: only the name, the tag, the switch and its state', async () => {
    renderPage()
    await ready()
    await escolher('Top One #1')
    const l = linha()
    expect(within(l).getByText('padrão de Futuros')).toHaveClass('hub-tag--padrao')
    expect(chave()).toHaveAttribute('aria-checked', 'false')
    expect(chave()).toHaveAttribute('id', 'be-sw')
    expect(within(l).getByText('Desligada: o Registrar não sugere e as Análises não conferem.')).toBeInTheDocument()
    expect(within(l).queryByText('Com quantos pontos a favor')).not.toBeInTheDocument()
    expect(within(l).queryByText('Adicionar ativo')).not.toBeInTheDocument()
    expect(within(l).queryByText(REGRAS_BE.nota)).not.toBeInTheDocument()
    expect(within(l).queryByText('Sem ativo: esta regra não age.')).not.toBeInTheDocument()
    expect(within(l).queryByRole('button', { name: /Voltar ao padrão/ })).not.toBeInTheDocument()
    expect(within(l).queryByText('não salvo')).not.toBeInTheDocument()
  })

  it('the first switch-on on «Padrão Futuros»: a line for each root most traded (≤ 3), the focus on the first; values to the draft; «Ao salvar»; the save sends the market’s rule', async () => {
    fetchRecentTrades.mockResolvedValue([
      op('MNQZ6', '2026-10-21T14:00:00Z'),
      op('MNQ', '2026-10-20T14:00:00Z'),
      op('MGC', '2026-10-19T14:00:00Z'),
      op('MES', '2026-10-22T14:00:00Z'),
      op('MES', '2026-10-18T14:00:00Z'),
      op('MES', '2026-10-17T14:00:00Z'),
    ])
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    await escolher('Padrão Futuros')
    await waitFor(() => expect(fetchRecentTrades).toHaveBeenCalledWith(expect.anything(), ids.topOne, 200))
    await new Promise((r) => setTimeout(r, 0))
    await userEvent.click(chave())
    expect(chave()).toHaveAttribute('aria-checked', 'true')
    expect(within(linha()).getByText('Ligada')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Com quantos pontos a favor' })).getAllByRole('listitem').map((li) => li.querySelector('strong')?.textContent)).toEqual([
      'MES',
      'MNQ',
      'MGC',
    ])
    await waitFor(() => expect(valor('MES')).toHaveFocus())
    expect(within(linha()).getByText('não salvo')).toBeInTheDocument()
    // No tag on «Padrão Futuros»
    expect(within(linha()).queryByText('padrão de Futuros')).not.toBeInTheDocument()
    await userEvent.type(valor('MES'), '8')
    await userEvent.type(valor('MNQ'), '30')
    await userEvent.type(valor('MGC'), '5')
    expect(screen.getByText('Ao salvar: versão nova desde 22 out em Top One #1.')).toBeInTheDocument()
    expect(barra()).not.toBeNull()
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar alterações' })[0])
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(saveRules.mock.calls[0][1].defaults?.futures?.rules.breakeven).toEqual({ on: true, by: { MES: 8, MNQ: 30, MGC: 5 } })
  })

  it('the read not answered yet: MES; removing the only line leaves «Sem ativo» (saving allowed) and focuses the first free root', async () => {
    fetchRecentTrades.mockReturnValue(new Promise(() => undefined))
    renderPage()
    await ready()
    await escolher('Top One #1')
    await userEvent.click(chave())
    expect(within(screen.getByRole('list', { name: 'Com quantos pontos a favor' })).getAllByRole('listitem')).toHaveLength(1)
    await waitFor(() => expect(valor('MES')).toHaveFocus())
    // An account's edit makes it its own
    expect(within(linha()).getByText('só nesta conta')).toHaveClass('hub-tag--propria')
    await userEvent.click(screen.getByRole('button', { name: 'Remover o MES desta regra' }))
    await waitFor(() => expect(document.getElementById('be-add-MES')).toHaveFocus())
    expect(within(linha()).getByText('Sem ativo: esta regra não age.')).toBeInTheDocument()
    // Saving is allowed (the draft changed), but on without an asset resolves to no rule: no version
    expect(barra()).not.toBeNull()
    expect(screen.queryByText(/^Ao salvar:/)).not.toBeInTheDocument()
  })
})

describe('lines, errors, «Adicionar ativo», «Remover», «Voltar ao padrão»', () => {
  beforeEach(() => {
    fetchRulesConfig.mockResolvedValue(comRegraEApex())
    fetchAccounts.mockResolvedValue([topOne, apex, ebinex])
  })

  it('on with values: the lines in the table’s order, «Adicionar ativo» with the free roots, the note; nothing «não salvo»', async () => {
    renderPage()
    await ready()
    await escolher('Padrão Futuros')
    expect(chave()).toHaveAttribute('aria-checked', 'true')
    const lista = screen.getByRole('list', { name: 'Com quantos pontos a favor' })
    expect(document.getElementById('r-be-q')).toHaveTextContent('Com quantos pontos a favor')
    expect(within(lista).getAllByRole('textbox').map((i) => [i.id, (i as HTMLInputElement).value])).toEqual([
      ['be-MES', '8'],
      ['be-MNQ', '30'],
      ['be-MGC', '5'],
    ])
    expect(valor('MES')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByRole('button', { name: 'Remover o MES desta regra' })).toHaveAttribute('id', 'rm-be-MES')
    const add = screen.getByRole('group', { name: 'Adicionar ativo' })
    expect(add).toHaveAttribute('aria-labelledby', 'r-be-add')
    expect(within(add).getAllByRole('button').map((b) => b.textContent)).toEqual(['ES', 'NQ', 'GC', 'MCL', 'CL'])
    expect(screen.getByText(REGRAS_BE.nota)).toBeInTheDocument()
    expect(within(linha()).queryByText('não salvo')).not.toBeInTheDocument()
    // Top One inherits it
    await escolher('Top One #1')
    expect(within(linha()).getByText('padrão de Futuros')).toBeInTheDocument()
    expect(within(linha()).queryByRole('button', { name: /Voltar ao padrão/ })).not.toBeInTheDocument()
  })

  it('the live error while a refused text is typed (MNQ 30 → «abc»), none while empty, then on blur the value at focus comes back with a note', async () => {
    renderPage()
    await ready()
    await escolher('Padrão Futuros')
    const mnq = valor('MNQ')
    await userEvent.clear(mnq)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mnq).toHaveAttribute('aria-invalid', 'false')
    await userEvent.type(mnq, 'abc')
    const erro = screen.getByRole('alert')
    expect(erro).toHaveTextContent('Digite pontos maiores que zero.')
    expect(erro).toHaveAttribute('id', 'e-be-MNQ')
    expect(mnq).toHaveAttribute('aria-invalid', 'true')
    expect(mnq).toHaveAttribute('aria-describedby', 'e-be-MNQ')
    expect(within(linha()).getByText('não salvo')).toBeInTheDocument()
    // The page's bar follows the draft only, which still holds 30 (contract §12.8)
    expect(barra()).toBeNull()
    await userEvent.tab()
    expect(mnq).toHaveValue('30')
    expect(mnq).toHaveAttribute('aria-invalid', 'false')
    const nota = screen.getByText('O MNQ voltou para +30 pts; use pontos maiores que zero.')
    expect(nota).toHaveAttribute('role', 'status')
    expect(nota).toHaveClass('hub-nota')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(linha()).queryByText('não salvo')).not.toBeInTheDocument()
    // «0» and «8,123456789» are refused too
    await userEvent.clear(mnq)
    await userEvent.type(mnq, '8,123456789')
    expect(screen.getByRole('alert')).toHaveTextContent('Digite pontos maiores que zero.')
  })

  it('a pending line («Adicionar ativo»): «não salvo» without the page’s bar; its error stays on blur, also empty', async () => {
    renderPage()
    await ready()
    await escolher('Padrão Futuros')
    await userEvent.click(screen.getByRole('button', { name: 'ES' }))
    await waitFor(() => expect(valor('ES')).toHaveFocus())
    expect(within(linha()).getByText('não salvo')).toBeInTheDocument()
    expect(barra()).toBeNull()
    expect(within(screen.getByRole('group', { name: 'Adicionar ativo' })).queryByRole('button', { name: 'ES' })).not.toBeInTheDocument()
    await userEvent.type(valor('ES'), '0')
    expect(screen.getByRole('alert')).toHaveTextContent('Digite pontos maiores que zero.')
    await userEvent.tab()
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'e-be-ES')
    await userEvent.clear(valor('ES'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    valor('ES').focus()
    await userEvent.tab()
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'e-be-ES')
    // A valid value goes to the draft: the bar appears and «Ao salvar» names the accounts
    await userEvent.type(valor('ES'), '2,25')
    expect(barra()).not.toBeNull()
    expect(screen.getByText('Ao salvar: versão nova desde 22 out em Top One #1.')).toBeInTheDocument()
  })

  it('«Remover»: the next line’s value, else the previous one (the last of three → the line above)', async () => {
    renderPage()
    await ready()
    await escolher('Padrão Futuros')
    await userEvent.click(screen.getByRole('button', { name: 'Remover o MGC desta regra' }))
    await waitFor(() => expect(valor('MNQ')).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Remover o MES desta regra' }))
    await waitFor(() => expect(valor('MNQ')).toHaveFocus())
    expect(within(screen.getByRole('group', { name: 'Adicionar ativo' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'MES',
      'MGC',
      'ES',
      'NQ',
      'GC',
      'MCL',
      'CL',
    ])
  })

  it('an account with its own copy: «só nesta conta» and «Voltar ao padrão» (on or off); back, the focus on the switch', async () => {
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    await escolher('Apex B')
    expect(within(linha()).getByText('só nesta conta')).toBeInTheDocument()
    expect(valor('MES')).toHaveValue('10')
    await userEvent.click(chave())
    expect(chave()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('list', { name: 'Com quantos pontos a favor' })).not.toBeInTheDocument()
    const voltar = screen.getByRole('button', { name: 'Voltar ao padrão de Futuros: Apex B' })
    expect(voltar).toHaveTextContent('Voltar ao padrão')
    // Turning it back on keeps the asset
    await userEvent.click(chave())
    expect(valor('MES')).toHaveValue('10')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão de Futuros: Apex B' }))
    await waitFor(() => expect(chave()).toHaveFocus())
    expect(within(linha()).getByText('padrão de Futuros')).toBeInTheDocument()
    expect(valor('MES')).toHaveValue('8')
    expect(within(linha()).getByText('não salvo')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar alterações' })[0])
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(saveRules.mock.calls[0][1].accounts?.[APEX]?.rules).not.toHaveProperty('breakeven')
  })

  it('an account edit sends its own copy (accounts[id].rules.breakeven)', async () => {
    saveRules.mockResolvedValue(resultado('rev-2'))
    renderPage()
    await ready()
    await escolher('Top One #1')
    await userEvent.clear(valor('MES'))
    await userEvent.type(valor('MES'), '6')
    expect(within(linha()).getByText('só nesta conta')).toBeInTheDocument()
    expect(screen.getByText('Ao salvar: Regras v2 desde 22 out.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar alterações' })[0])
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(saveRules.mock.calls[0][1].accounts?.[ids.topOne]?.rules.breakeven).toEqual({ on: true, by: { MES: 6, MNQ: 30, MGC: 5 } })
  })
})

describe('copy', () => {
  it('carries no prototype label (the board’s demo controls)', () => {
    const dir = path.join(__dirname, '../../../components/hub/personalizar')
    const text = ['copy.ts', 'RegraBreakeven.tsx'].map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    for (const s of ['Cenário do protótipo', 'Recomeçar', 'Preencher exemplo', 'Avançar o relógio', 'só no protótipo', '(exemplo)']) expect(text).not.toContain(s)
  })
})

describe('hub-personalizar.css (the rule’s styles)', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-personalizar.css'), 'utf8')
  const parte = css.slice(css.lastIndexOf('/*', css.indexOf('Fase 3c · «Durante a operação»'))).replace(/\/\*[\s\S]*?\*\//g, '')

  it('scopes every new rule to .hub; the field keeps 44 px (as-built .hub-pz-campo-num), the line wraps with its error on a line of its own', () => {
    const seletores = Array.from(parte.matchAll(/^([^\s/*@}][^{]*)\{/gm)).map((m) => m[1].trim())
    expect(seletores.length).toBeGreaterThan(5)
    for (const s of seletores) for (const x of s.split(',')) expect(x.trim()).toMatch(/^\.hub\s/)
    expect(parte).toMatch(/\.hub \.hub-pz-be-item \{[^}]*flex-wrap: wrap/)
    expect(parte).toMatch(/\.hub \.hub-pz-be-item \.hub-erro \{[^}]*flex: 1 0 100%/)
    expect(css).toMatch(/\.hub \.hub-pz-campo-num \{[^}]*min-height: 44px/)
  })
})

import fs from 'fs'
import path from 'path'
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuandoVoceOpera from '@/components/hub/personalizar/QuandoVoceOpera'
import SuasRegras from '@/components/hub/personalizar/SuasRegras'
import Preferencias from '@/components/hub/personalizar/Preferencias'
import { BarraSalvar } from '@/components/hub/personalizar/BarraSalvar'
import type { FormLimite } from '@/components/hub/personalizar/PersonalizarProvider'
import { entidadesRegrasDe } from '@/lib/hub/personalizarRegras'
import { activeAccounts, pendingVersions, type AccountConfig, type RulesConfig, type RulesSettings } from '@/lib/hub/regras'
import { PADRAO_FUTUROS, ajustarSoNestaConta, comBloqueio, comJanelaDoMercado, comLimite, comModoLimite, comRegraJanela } from '@/lib/hub/rascunho'
import { configAntes, configDepois, configMercados, idsDono, idsMercados } from '@/testing/regras'
import { et } from '@/testing/gate'

const ids = idsDono()
const NOW = et('2026-10-22 12:00')
/** The six-market owner (fixtures recorded on the markets migration): Top One #1, Ebinex, FTMO, IBKR, Binance, Clear */
const im = idsMercados()
const FASES_MERCADOS: Record<string, string | null> = {
  [im.topOne]: 'Financiada',
  [im.ebinex]: 'Pessoal',
  [im.ftmo]: 'Avaliação',
  [im.ibkr]: 'Pessoal',
  [im.binance]: 'Pessoal',
  [im.clear]: 'Pessoal',
}

/** A Phase 1 backfill account in a market no longer offered (options), on Brasília midnight, no version */
function comOpcoesAntiga(c: RulesConfig): RulesConfig {
  const ibkr = c.accounts.find((a) => a.id === im.ibkr) as AccountConfig
  const opc: AccountConfig = { ...ibkr, id: 'acc-opc', label: 'Opções antigas', market: 'options', day: { tz: 'America/Sao_Paulo', startMin: 0 }, versions: [] }
  return { ...c, accounts: [...c.accounts, opc] }
}

/** The config with one account's day clock replaced (a Phase 1 backfill account keeps Brasília midnight) */
function comDia(c: RulesConfig, id: string, day: AccountConfig['day']): RulesConfig {
  return { ...c, accounts: c.accounts.map((a) => (a.id === id ? { ...a, day } : a)) }
}

/** The six-market config with a second futures account («Apex A», no version), so «somando» could apply */
function comApexMercados(c: RulesConfig): RulesConfig {
  const top = c.accounts.find((a) => a.id === im.topOne) as AccountConfig
  const apex: AccountConfig = { ...top, id: 'acc-apex', label: 'Apex A', versions: [] }
  return {
    ...c,
    accounts: [...c.accounts, apex],
    settings: { ...c.settings, accounts: { ...c.settings.accounts, 'acc-apex': { windowRule: {}, block: {}, limit: null, window: null } } },
  }
}

/** The config with a market's saved windows removed */
function semJanela(c: RulesConfig, m: keyof RulesSettings['markets']): RulesConfig {
  return { ...c, settings: { ...c.settings, markets: { ...c.settings.markets, [m]: { ...c.settings.markets[m], windows: [] } } } }
}

/** The fixture with a second futures account («Apex A», no versions), as rules_config would list it */
function comApex(c: RulesConfig): RulesConfig {
  const top = c.accounts.find((a) => a.id === ids.topOne) as AccountConfig
  const apex: AccountConfig = { ...top, id: 'acc-apex', label: 'Apex A', versions: [] }
  return {
    ...c,
    accounts: [top, apex, ...c.accounts.filter((a) => a.id !== ids.topOne)],
    settings: { ...c.settings, accounts: { ...c.settings.accounts, 'acc-apex': { windowRule: {}, block: {}, limit: null, window: null } } },
  }
}

/** Holds a draft like the provider does, so presentational sections can be edited */
function Janelas({ config, inicial, onAdicionarConta = jest.fn() }: { config: RulesConfig; inicial?: RulesSettings; onAdicionarConta?: jest.Mock }) {
  const [draft, setDraft] = useState(inicial ?? config.settings)
  return (
    <QuandoVoceOpera
      carga="pronto"
      onTentar={() => {}}
      now={NOW}
      salvo={config.settings}
      draft={draft}
      ativas={activeAccounts(config)}
      onEditar={(fn) => setDraft((d) => fn(d))}
      onAdicionarConta={onAdicionarConta}
    />
  )
}

function Regras({
  config,
  inicial,
  selecionado,
  fases = {},
  onIrJanelas = jest.fn(),
}: {
  config: RulesConfig
  inicial?: RulesSettings
  selecionado: string
  fases?: Record<string, string | null>
  onIrJanelas?: jest.Mock
}) {
  const [draft, setDraft] = useState(inicial ?? config.settings)
  const [form, setForm] = useState<FormLimite | null>(null)
  const [sel, setSel] = useState(selecionado)
  return (
    <SuasRegras
      carga="pronto"
      onTentar={() => {}}
      now={NOW}
      config={config}
      draft={draft}
      ativas={activeAccounts(config)}
      fases={fases}
      pendentes={pendingVersions(config, draft)}
      tradesDesde={undefined}
      selecionado={sel}
      onSelecionar={setSel}
      formLimite={form}
      onFormLimite={setForm}
      onEditar={(fn) => setDraft((d) => fn(d))}
      onComecarHoje={() => {}}
      onIrJanelas={onIrJanelas}
    />
  )
}

describe('QuandoVoceOpera', () => {
  it('lists the accounts of a market with two, and adjusts the window of one, moving focus', async () => {
    render(<Janelas config={comApex(configDepois())} />)
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    const contas = within(fut).getByRole('list', { name: 'Contas de Futuros' })
    expect(within(contas).getAllByText('usa esta janela')).toHaveLength(2)
    expect(within(fut).queryByText(/Usada por/)).not.toBeInTheDocument()

    await userEvent.click(within(contas).getByRole('button', { name: 'Ajustar só nesta conta: Apex A' }))

    const start = within(contas).getByLabelText('Início da janela só de Apex A, horário de Nova York')
    await waitFor(() => expect(start).toHaveFocus())
    expect(start).toHaveValue('10:00')
    expect(within(contas).getByText('só nesta conta')).toBeInTheDocument()
    expect(within(fut).getByText('não salvo')).toBeInTheDocument()
    expect(document.getElementById('o-acc-apex-cap')).toHaveTextContent('11:00–12:00 em Brasília; a partir de 1º nov: 12:00–13:00 em Brasília · seg–sex')

    await userEvent.click(within(contas).getByRole('button', { name: 'Voltar ao padrão: Apex A' }))
    await waitFor(() => expect(within(contas).getByRole('button', { name: 'Ajustar só nesta conta: Apex A' })).toHaveFocus())
    expect(within(fut).queryByText('não salvo')).not.toBeInTheDocument()
  })

  it('«Voltar ao padrão» on the market’s only account: focus goes to the market’s start field (the list goes away)', async () => {
    const c = configDepois()
    render(<Janelas config={c} inicial={ajustarSoNestaConta(c.settings, { id: ids.topOne, market: 'futures' })} />)
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })

    await userEvent.click(within(fut).getByRole('button', { name: 'Voltar ao padrão: Top One #1' }))

    expect(within(fut).queryByRole('list', { name: 'Contas de Futuros' })).not.toBeInTheDocument()
    expect(within(fut).getByText('Usada por Top One #1.')).toBeInTheDocument()
    await waitFor(() => expect(within(fut).getByLabelText('Início da janela de Futuros, horário de Nova York')).toHaveFocus())
  })

  it('lists the accounts only while the market has a window, and offers «Cancelar» only for a window not yet saved', async () => {
    const { unmount } = render(<Janelas config={comApex(configAntes())} />)
    const fut = () => screen.getByRole('group', { name: 'Janela de Futuros' })
    expect(within(fut()).queryByRole('list', { name: 'Contas de Futuros' })).not.toBeInTheDocument()
    await userEvent.click(within(fut()).getByRole('button', { name: '+ Definir janela' }))
    expect(within(fut()).getByRole('list', { name: 'Contas de Futuros' })).toBeInTheDocument()
    expect(within(fut()).getByRole('button', { name: 'Cancelar a janela nova de Futuros' })).toBeInTheDocument()
    unmount()

    render(<Janelas config={comApex(configDepois())} />)
    expect(within(fut()).queryByRole('button', { name: 'Cancelar a janela nova de Futuros' })).not.toBeInTheDocument()
  })

  it('says «do dia seguinte» on a window that ends the next day, and only there', () => {
    const c = configDepois()
    render(<Janelas config={c} inicial={comJanelaDoMercado(c.settings, 'binary', 0, { startMin: 1320, endMin: 120 })} />)
    expect(within(screen.getByRole('group', { name: 'Janela de Opções binárias' })).getByText('do dia seguinte')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Janela de Futuros' })).queryByText('do dia seguinte')).not.toBeInTheDocument()
  })

  it('a window with no day: the days group is described by the error', async () => {
    render(<Janelas config={configDepois()} />)
    const fut = screen.getByRole('group', { name: 'Janela de Futuros' })
    await userEvent.click(within(fut).getByRole('button', { name: 'Relógio, dias e segunda janela de Futuros' }))
    const days = within(fut).getByRole('group', { name: 'Dias' })

    for (const d of ['segunda', 'terça', 'quarta', 'quinta', 'sexta']) await userEvent.click(within(days).getByRole('button', { name: d }))

    expect(within(fut).getByRole('alert')).toHaveTextContent('Marque pelo menos um dia.')
    expect(days).toHaveAttribute('aria-describedby', 'j-fut0-erro')
    expect(document.getElementById('j-fut0-cap')).toHaveTextContent('nenhum dia marcado')
    expect(within(days).getByRole('button', { name: 'sábado' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('a market without a window: who it affects, or «Sem janela.» when the rule is off everywhere', () => {
    const c = comApex(configAntes())
    const { unmount } = render(<Janelas config={c} />)
    expect(within(screen.getByRole('group', { name: 'Janela de Futuros' })).getByText('Sem janela: nestas contas, a regra da janela não age.')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Janela de Opções binárias' })).getByText('Sem janela: na Ebinex, a regra da janela não age.')).toBeInTheDocument()
    unmount()

    render(<Janelas config={configAntes()} inicial={comRegraJanela(configAntes().settings, { tipo: 'padrao' }, { on: false })} />)
    expect(within(screen.getByRole('group', { name: 'Janela de Futuros' })).getByText('Sem janela.')).toBeInTheDocument()
  })

  it('a missing market offers «+ Adicionar conta» (the sheet, with the heading as fallback); none at all says so', async () => {
    const c = configDepois()
    const onlyFutures = { ...c, accounts: c.accounts.filter((a) => a.market === 'futures') }
    const onAdicionarConta = jest.fn()
    const { unmount } = render(<Janelas config={onlyFutures} onAdicionarConta={onAdicionarConta} />)
    expect(screen.getByText('Outros mercados aparecem aqui quando você tiver uma conta neles.')).toBeInTheDocument()
    expect(screen.queryByText(/Sem conta de/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Janela de Opções binárias' })).not.toBeInTheDocument()

    const add = screen.getByRole('button', { name: '+ Adicionar conta' })
    await userEvent.click(add)
    expect(onAdicionarConta).toHaveBeenCalledWith(add, screen.getByRole('heading', { level: 2, name: 'Quando você opera' }))
    unmount()

    render(<Janelas config={{ ...c, accounts: [] }} />)
    expect(screen.getByText('Sem contas ativas: as janelas aparecem com a primeira.')).toBeInTheDocument()
  })
})

describe('SuasRegras', () => {
  it('tags «padrão de Futuros» / «só nesta conta» on futures accounts only', async () => {
    const c = configDepois()
    const { unmount } = render(<Regras config={c} selecionado={ids.topOne} />)
    const nome = (text: string) => (screen.getByText(text, { selector: '.hub-pz-regra__nome span' }).closest('li') as HTMLElement)
    expect(within(nome('Janela')).getByText('padrão de Futuros')).toBeInTheDocument()
    expect(within(nome('Só operar dentro da sua janela')).getByText('padrão de Futuros')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'Só operar dentro da sua janela' }))
    expect(within(nome('Só operar dentro da sua janela')).getByText('só nesta conta')).toBeInTheDocument()
    expect(within(nome('Só operar dentro da sua janela')).getByText('não salvo')).toBeInTheDocument()
    expect(screen.getByText('Desligada: a janela não muda o “Posso operar hoje?”.')).toBeInTheDocument()
    unmount()

    for (const sel of [PADRAO_FUTUROS, ids.ebinex]) {
      const view = render(<Regras config={c} selecionado={sel} />)
      expect(screen.queryByText('padrão de Futuros')).not.toBeInTheDocument()
      expect(screen.queryByText('só nesta conta')).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('a binary account: no block, no state rule; its edits are «não salvo» too', async () => {
    render(<Regras config={configDepois()} selecionado={ids.ebinex} />)
    expect(screen.queryByRole('switch', { name: 'Bloqueio de dados' })).not.toBeInTheDocument()
    expect(screen.queryByText('Regra por estado')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '“Liberado”, com aviso' }))

    expect(screen.getByText('não salvo')).toBeInTheDocument()
    const hoje = screen.getByRole('list', { name: 'Como fica hoje' })
    expect(within(hoje).getAllByRole('listitem')[1]).toHaveTextContent('No resto do diaLiberadocom aviso: fora da janela')
  })

  it('the window rule warns when it cannot act, and the link goes to «Quando você opera»', async () => {
    const onIrJanelas = jest.fn()
    const { unmount } = render(<Regras config={configAntes()} selecionado={ids.topOne} onIrJanelas={onIrJanelas} />)
    expect(screen.getByText(/Sem janela: esta regra não age\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Definir em Quando você opera' }))
    expect(onIrJanelas).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Definir a janela em Quando você opera' })).toHaveAttribute('href', '#janelas')
    expect(screen.getByText('Sem janela', { selector: '.hub-pz-fraco' })).toBeInTheDocument()
    unmount()

    const c = configDepois()
    const broken = { ...c.settings, markets: { ...c.settings.markets, futures: { ...c.settings.markets.futures, windows: [{ ...c.settings.markets.futures.windows[0], endMin: 600 }] } } }
    render(<Regras config={c} inicial={broken} selecionado={ids.topOne} />)
    expect(screen.getByText(/A janela tem erro: esta regra não age até você corrigir\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Corrigir em Quando você opera' })).toBeInTheDocument()
    expect(screen.getByText('Corrija a janela em Quando você opera.')).toBeInTheDocument()
  })

  it('the block status line: on, off, 0 + 0, no calendar', async () => {
    const c = configDepois()
    const { unmount } = render(<Regras config={c} selecionado={PADRAO_FUTUROS} />)
    const status = () => document.getElementById('r-bloq-hoje') as HTMLElement
    expect(status()).toHaveAttribute('role', 'status')
    expect(status()).toHaveTextContent('Os dados econômicos chegam na Fase 5. Até lá, o bloqueio não muda o “Posso operar hoje?”.')
    expect(screen.getAllByText('ativo na Fase 5').length).toBeGreaterThan(0)

    const before = screen.getByLabelText('Minutos antes do dado')
    const after = screen.getByLabelText('Minutos depois do dado')
    await userEvent.clear(before)
    expect(before).toHaveValue('')
    await userEvent.type(before, '0')
    await userEvent.clear(after)
    await userEvent.type(after, '0')
    expect(status()).toHaveTextContent('Com 0 minuto, não há bloqueio.')
    await userEvent.type(after, '999')
    expect(after).toHaveValue('120')

    await userEvent.click(screen.getByRole('switch', { name: 'Bloqueio de dados' }))
    expect(status()).toHaveTextContent('Desligado: dados não mudam o “Posso operar hoje?”.')
    expect(screen.queryByLabelText('Minutos antes do dado')).not.toBeInTheDocument()
    unmount()

    render(<Regras config={c} inicial={{ ...c.settings, calendars: [] }} selecionado={PADRAO_FUTUROS} />)
    expect(document.getElementById('r-bloq-hoje')).toHaveTextContent('Nenhum calendário marcado: nada vai bloquear o dia.')
  })

  it('an emptied minutes field goes back to the saved value on blur', async () => {
    const c = configDepois()
    render(<Regras config={c} inicial={comBloqueio(c.settings, { tipo: 'padrao' }, { beforeMin: 20 })} selecionado={PADRAO_FUTUROS} />)
    const before = screen.getByLabelText('Minutos antes do dado')
    expect(before).toHaveValue('20')

    await userEvent.clear(before)
    expect(before).toHaveValue('')
    await userEvent.tab()

    expect(before).toHaveValue('5')
  })

  it('the minutes fields take digits only: a letter never reaches the draft', async () => {
    render(<Regras config={configDepois()} selecionado={PADRAO_FUTUROS} />)
    const before = screen.getByLabelText('Minutos antes do dado')
    expect(before).toHaveValue('5')

    await userEvent.type(before, 'a')
    expect(before).toHaveValue('5')
    await userEvent.type(before, '2')
    expect(before).toHaveValue('52')
    expect(document.getElementById('r-bloq-hoje')).not.toHaveTextContent('NaN')
  })

  it('an empty limit field is not «Sem limite»: OK says to type a value and keeps the limit', async () => {
    render(<Regras config={configDepois()} selecionado={ids.topOne} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' }))
    await userEvent.clear(screen.getByLabelText('Limite do dia, em US$'))

    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Digite um valor maior que zero.')
    expect(screen.getByLabelText('Limite do dia, em US$')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Sem limite')).not.toBeInTheDocument()
  })

  it('lists the versions newest first, then «Antes de …»', async () => {
    const c = configDepois()
    const top = c.accounts.find((a) => a.id === ids.topOne) as AccountConfig
    const v1 = top.versions[0]
    const v2 = { ...v1, id: 'v2', versionNo: 2, effectiveFrom: new Date('2026-10-22T16:00:00Z'), effectiveDay: '2026-10-22' }
    const two = { ...c, accounts: c.accounts.map((a) => (a.id === ids.topOne ? { ...a, versions: [v1, v2] } : a)) }
    render(<Regras config={two} selecionado={ids.topOne} />)

    await userEvent.click(screen.getByRole('button', { name: 'Versões (2)' }))

    const items = within(document.getElementById('lista-versoes') as HTMLElement).getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(items.map((t) => t.slice(0, 2))).toEqual(['v2', 'v1', 'An'])
  })

  it('the limit mode: hidden with one futures account «por conta», shown with two, and kept while «somando»', async () => {
    const c = configDepois()
    const { unmount } = render(<Regras config={c} selecionado={ids.topOne} />)
    expect(screen.queryByRole('group', { name: 'Como o limite de Top One #1 conta' })).not.toBeInTheDocument()
    unmount()

    const soma = render(<Regras config={c} inicial={comModoLimite(c.settings, ids.topOne, 'soma')} selecionado={ids.topOne} />)
    const group = screen.getByRole('group', { name: 'Como o limite de Top One #1 conta' })
    expect(within(group).getByRole('button', { name: 'somando as contas de Futuros' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hoje só há uma conta de Futuros. Contas de outros mercados nunca entram.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Como fica hoje' })).getByText(/somando Futuros/)).toBeInTheDocument()
    await userEvent.click(within(group).getByRole('button', { name: 'por conta' }))
    // Back to «por conta» with one account: the pills go (contrato §4.6) and focus stays on the row
    expect(screen.queryByRole('group', { name: 'Como o limite de Top One #1 conta' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' })).toHaveFocus())
    soma.unmount()

    const two = comApex(c)
    render(<Regras config={two} inicial={comModoLimite(two.settings, ids.topOne, 'soma')} selecionado={ids.topOne} />)
    expect(screen.getByText('Soma Top One #1 e Apex A. Contas de outros mercados nunca entram.')).toBeInTheDocument()
  })

  it('a binary account’s limit has no mode, and «Ficar sem limite» removes it', async () => {
    const c = configDepois()
    render(<Regras config={c} inicial={comLimite(c.settings, ids.ebinex, 5000)} selecionado={ids.ebinex} />)
    expect(screen.queryByRole('group', { name: /Como o limite/ })).not.toBeInTheDocument()
    expect(screen.queryByText('só nesta conta')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Ebinex' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ficar sem limite' }))

    expect(screen.getByText('Sem limite')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Definir o limite do dia de Ebinex' })).toHaveFocus())
  })

  it('the state rule: a choice per state («Só a favor» only with a direction), toggled off by choosing it again', async () => {
    render(<Regras config={configDepois()} selecionado={ids.topOne} />)
    expect(screen.getByText('Nenhuma escolha ainda.')).toBeInTheDocument()
    expect(screen.getByText('todas as contas de Futuros')).toBeInTheDocument()

    const open = screen.getByRole('button', { name: 'Escolher o que você faz em cada estado' })
    expect(open).toHaveAttribute('aria-controls', 'est-lista')
    await userEvent.click(open)
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    const conflito = screen.getByRole('group', { name: 'Em “Em conflito”, você' })
    expect(within(conflito).getAllByRole('button').map((b) => b.textContent)).toEqual(['Opero', 'Não opero'])
    const alinhadas = screen.getByRole('group', { name: 'Em “Alinhadas”, você' })
    expect(within(alinhadas).getAllByRole('button').map((b) => b.textContent)).toEqual(['Opero', 'Só a favor', 'Não opero'])

    await userEvent.click(within(alinhadas).getByRole('button', { name: 'Só a favor' }))
    await userEvent.click(within(conflito).getByRole('button', { name: 'Opero' }))
    expect(screen.getByText('Alinhadas: Só a favor · Em conflito: Opero')).toBeInTheDocument()
    await userEvent.click(within(alinhadas).getByRole('button', { name: 'Só a favor' }))
    expect(screen.getByText('Em conflito: Opero')).toBeInTheDocument()

    const text = screen.getByLabelText('Alinhadas')
    expect(text).toHaveAttribute('maxLength', '500')
    expect(text).toHaveAttribute('placeholder', 'O que você faz neste estado: se opera, com que tamanho, onde sai.')
    expect(screen.getByLabelText('Sem direção')).toHaveAttribute('placeholder', 'O que você faz neste estado.')
  })

  it('without an active account it says so, and keeps only the calendars', () => {
    const c = configDepois()
    render(
      <SuasRegras
        carga="pronto"
        onTentar={() => {}}
        now={NOW}
        config={{ ...c, accounts: [] }}
        draft={c.settings}
        ativas={[]}
        fases={{}}
        pendentes={[]}
        tradesDesde={undefined}
        selecionado={null}
        onSelecionar={() => {}}
        formLimite={null}
        onFormLimite={() => {}}
        onEditar={() => {}}
        onComecarHoje={() => {}}
        onIrJanelas={() => {}}
      />,
    )
    expect(screen.getByText('As regras aparecem quando você tiver uma conta.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Regras de' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Calendários econômicos' })).toBeInTheDocument()
  })
})

describe('«Regras de»', () => {
  it('offers «Padrão Futuros» only with an active futures account', () => {
    const c = configDepois()
    expect(entidadesRegrasDe(activeAccounts(c))).toEqual([PADRAO_FUTUROS, ids.topOne, ids.ebinex])
    const soBinarias = { ...c, accounts: c.accounts.filter((a) => a.market === 'binary') }
    expect(entidadesRegrasDe(activeAccounts(soBinarias))).toEqual([ids.ebinex])
  })
})

describe('QuandoVoceOpera in six markets (Fase 2b)', () => {
  const cartao = (nome: string) => screen.getByRole('group', { name: nome })

  it('one card per market with an active account, in the board’s order, with the board’s ids', () => {
    render(<Janelas config={configMercados()} />)

    const cards = screen.getAllByRole('group', { name: /^Janela d/ })
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Janela de Futuros',
      'Janela de Opções binárias',
      'Janela de Forex',
      'Janela de Ações',
      'Janela de Cripto',
      'Janela da B3',
    ])
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual(['Futuros', 'Opções binárias', 'Forex', 'Ações', 'Cripto', 'B3'])
    // Two to a row (board `s6`)
    for (const c of cards) expect(c).toHaveClass('hub-pz-mcard--metade')

    expect(document.getElementById('j-fx0-de')).toHaveValue('08:00')
    expect(document.getElementById('j-fx0-ate')).toHaveValue('10:00')
    expect(document.getElementById('j-cri0-de')).toHaveValue('20:00')
    expect(document.getElementById('j-cri0-ate')).toHaveValue('22:00')
    expect(document.getElementById('j-b30-de')).toHaveValue('10:00')
    expect(document.getElementById('definir-eua')).toHaveTextContent('+ Definir janela')
    expect(document.getElementById('definir-bin')).toHaveTextContent('+ Definir janela')

    expect(within(cartao('Janela de Forex')).getByText('relógio de Nova York')).toBeInTheDocument()
    expect(within(cartao('Janela de Cripto')).getByText('relógio de Brasília')).toBeInTheDocument()
    expect(within(cartao('Janela da B3')).getByText('relógio de Brasília')).toBeInTheDocument()
    expect(within(cartao('Janela de Ações')).getByText('sem janela')).toBeInTheDocument()
    expect(within(cartao('Janela de Ações')).getByText('Sem janela: na IBKR, a regra da janela não age.')).toBeInTheDocument()
    expect(within(cartao('Janela de Cripto')).getByText('Usada por Binance.')).toBeInTheDocument()
    expect(document.getElementById('j-cri0-cap')).toHaveTextContent('· todos os dias')
    expect(within(cartao('Janela da B3')).getByLabelText('Início da janela da B3, horário de Brasília')).toHaveValue('10:00')

    // Every creatable market has an account: nothing more to add here
    expect(screen.queryByText(/Outros mercados aparecem aqui/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Adicionar conta' })).not.toBeInTheDocument()
  })

  it('«+ Definir janela» on Ações brings 09:30–10:30 ET and focuses its start; «Cancelar esta janela» undoes it', async () => {
    render(<Janelas config={configMercados()} />)

    await userEvent.click(within(cartao('Janela de Ações')).getByRole('button', { name: '+ Definir janela' }))

    const start = within(cartao('Janela de Ações')).getByLabelText('Início da janela de Ações, horário de Nova York')
    await waitFor(() => expect(start).toHaveFocus())
    expect(start).toHaveValue('09:30')
    expect(within(cartao('Janela de Ações')).getByLabelText('Fim da janela de Ações, horário de Nova York')).toHaveValue('10:30')
    expect(document.getElementById('j-eua0-cap')).toHaveTextContent('10:30–11:30 em Brasília')
    expect(document.getElementById('j-eua0-cap')).toHaveTextContent('· seg–sex')
    expect(within(cartao('Janela de Ações')).getByText('não salvo')).toBeInTheDocument()

    await userEvent.click(within(cartao('Janela de Ações')).getByRole('button', { name: 'Cancelar a janela nova de Ações' }))
    await waitFor(() => expect(document.getElementById('definir-eua')).toHaveFocus())
    expect(within(cartao('Janela de Ações')).queryByText('não salvo')).not.toBeInTheDocument()
  })

  it('Cripto: «+ Definir janela» marks every day, sábado and domingo included; the second window keeps them', async () => {
    render(<Janelas config={semJanela(configMercados(), 'crypto')} />)
    expect(within(cartao('Janela de Cripto')).getByText('Sem janela: na Binance, a regra da janela não age.')).toBeInTheDocument()

    await userEvent.click(within(cartao('Janela de Cripto')).getByRole('button', { name: '+ Definir janela' }))

    expect(within(cartao('Janela de Cripto')).getByLabelText('Início da janela de Cripto, horário de Brasília')).toHaveValue('20:00')
    expect(within(cartao('Janela de Cripto')).getByLabelText('Fim da janela de Cripto, horário de Brasília')).toHaveValue('22:00')
    expect(document.getElementById('j-cri0-cap')).toHaveTextContent('· todos os dias')

    const mais = within(cartao('Janela de Cripto')).getByRole('button', { name: 'Relógio, dias e segunda janela de Cripto' })
    expect(mais).toHaveAttribute('aria-controls', 'mais-cri')
    await userEvent.click(mais)
    const relogio = within(cartao('Janela de Cripto')).getByRole('group', { name: 'Relógio da janela' })
    expect(within(relogio).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Nova York (ET)', 'false'],
      ['Brasília', 'true'],
    ])
    const dias = within(cartao('Janela de Cripto')).getByRole('group', { name: 'Dias' })
    expect(within(dias).getAllByRole('button').map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual(
      ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'].map((d) => [d, 'true']),
    )

    await userEvent.click(within(cartao('Janela de Cripto')).getByRole('button', { name: 'Segunda janela de Cripto' }))
    expect(document.getElementById('j-cri1-de')).toHaveValue('09:00')
    expect(document.getElementById('j-cri1-ate')).toHaveValue('11:00')
    const dias2 = within(cartao('Janela de Cripto')).getByRole('group', { name: 'Dias da segunda janela' })
    expect(within(dias2).getByRole('button', { name: 'domingo' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a creatable market without an account: «Outros mercados aparecem aqui …» and «+ Adicionar conta»; a legacy options card never hides it', async () => {
    const c = configMercados()
    const semB3 = { ...c, accounts: c.accounts.filter((a) => a.market !== 'b3') }
    const onAdicionarConta = jest.fn()
    const { unmount } = render(<Janelas config={semB3} onAdicionarConta={onAdicionarConta} />)
    expect(screen.queryByRole('group', { name: 'Janela da B3' })).not.toBeInTheDocument()
    const nota = screen.getByText('Outros mercados aparecem aqui quando você tiver uma conta neles.')
    const add = screen.getByRole('button', { name: '+ Adicionar conta' })
    // The link follows the note (board markup l.500), with a 44 px target (.hub-pz-link-btn, CSS test below)
    expect(nota.nextElementSibling).toBe(add)
    expect(add).toHaveClass('hub-pz-link-btn')
    await userEvent.click(add)
    expect(onAdicionarConta).toHaveBeenCalledWith(add, screen.getByRole('heading', { level: 2, name: 'Quando você opera' }))
    unmount()

    // Five creatable markets and a Phase 1 options account: its card comes last, the note stays
    render(<Janelas config={comOpcoesAntiga(semB3)} />)
    const cards = screen.getAllByRole('group', { name: /^Janela d/ })
    expect(cards.map((x) => x.getAttribute('aria-label'))).toEqual([
      'Janela de Futuros',
      'Janela de Opções binárias',
      'Janela de Forex',
      'Janela de Ações',
      'Janela de Cripto',
      'Janela de Opções',
    ])
    expect(document.getElementById('definir-opc')).toBeInTheDocument()
    expect(screen.getByText('Outros mercados aparecem aqui quando você tiver uma conta neles.')).toBeInTheDocument()
  })

  it('explains the clocks and the day turn of every market in its ⓘ', async () => {
    render(<Janelas config={configMercados()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Quando você opera' }))
    const info = document.getElementById('info-janelas') as HTMLElement
    expect(info).toHaveTextContent(
      'Futuros, Forex e Ações seguem o horário de Nova York: a janela fica no relógio de Nova York (ET) e, em Brasília, anda 1 hora quando os EUA mudam o horário. Binárias, Cripto e a B3 ficam no relógio de Brasília, que não muda.',
    )
    expect(info).toHaveTextContent('(a próxima é 1º nov)')
    expect(info).toHaveTextContent(
      'O dia começa às 18:00 ET em Futuros, às 17:00 ET em Forex, às 20:00 ET em Ações e à meia-noite de Brasília em binárias, em Cripto e na B3. Cripto abre todos os dias, 24 h: a janela pode incluir sábado e domingo.',
    )
    expect(info).not.toHaveTextContent('Leituras da IA')
  })
})

describe('SuasRegras in six markets (Fase 2b)', () => {
  const regraNomes = () => Array.from(document.querySelectorAll('.hub-pz-regra__nome > span:first-child')).map((el) => el.textContent)
  const regrasDe = () => within(screen.getByRole('group', { name: 'Regras de' }))
  const limiteValor = () => (document.getElementById('r-lim')?.closest('li') as HTMLElement).querySelector('.hub-pz-regra__linha > span')
  const hojeLinhas = () => within(screen.getByRole('list', { name: 'Como fica hoje' })).getAllByRole('listitem').map((li) => li.textContent)

  it('«Regras de»: «Padrão Futuros», then every active account in the board’s market order', () => {
    const c = configMercados()
    render(<Regras config={c} selecionado={im.ftmo} fases={FASES_MERCADOS} />)
    expect(regrasDe().getAllByRole('button').map((b) => b.textContent)).toEqual(['Padrão Futuros', 'Top One #1', 'Ebinex', 'FTMO', 'IBKR', 'Binance', 'Clear'])
    expect(regrasDe().getByRole('button', { name: 'FTMO' })).toHaveAttribute('aria-pressed', 'true')

    // Whatever the list order, markets come in ACCOUNT_MARKETS order (list order inside one)
    const shuffled = [...activeAccounts(c)].reverse()
    expect(entidadesRegrasDe(shuffled)).toEqual([PADRAO_FUTUROS, im.topOne, im.ebinex, im.ftmo, im.ibkr, im.binance, im.clear])
    const semFuturos = activeAccounts(c).filter((a) => a.market !== 'futures')
    expect(entidadesRegrasDe(semFuturos)).toEqual([im.ebinex, im.ftmo, im.ibkr, im.binance, im.clear])
  })

  it('a B3 account: chip «B3 · Pessoal», the window and the limit only, in R$, with no tag, block, state or «somando»', async () => {
    render(<Regras config={configMercados()} selecionado={im.clear} fases={FASES_MERCADOS} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Clear' })).toBeInTheDocument()
    expect(screen.getByText('B3 · Pessoal')).toHaveClass('hub-chip-dado')
    expect(regraNomes()).toEqual(['Janela', 'Só operar dentro da sua janela', 'Limite do dia'])
    expect(screen.queryByRole('switch', { name: 'Bloqueio de dados' })).not.toBeInTheDocument()
    expect(screen.queryByText('Regra por estado')).not.toBeInTheDocument()
    expect(screen.queryByText('padrão de Futuros')).not.toBeInTheDocument()
    expect(screen.queryByText('só nesta conta')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Como o limite de Clear conta' })).not.toBeInTheDocument()
    expect(screen.queryByText(/somando/)).not.toBeInTheDocument()

    expect((document.getElementById('r-gate')?.closest('ul') as HTMLElement).querySelector('li')).toHaveTextContent('10:00–11:00 de Brasília · seg–sex')
    expect(limiteValor()?.textContent).toBe('R$\u00a0500')
    // Thursday 12:00 ET = 13:00 de Brasília, after the window
    expect(hojeLinhas()).toEqual([
      '10:00–11:00 Brasília · sua janelaLiberado',
      'No resto do diaFora da sua janela',
      'Se a perda do dia chegar a R$\u00a0500Encerrado por hoje',
    ])
    expect(screen.getByText('no relógio de Brasília')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Versões (1)' }))
    // The version note (foundation): window and limit in R$, no block, state or calendar part
    expect(within(document.getElementById('lista-versoes') as HTMLElement).getAllByRole('listitem')[0].textContent).toBe(
      'v1 · desde 17 out · janela 10:00–11:00 de Brasília · seg–sex · limite R$\u00a0500',
    )
  })

  it('the B3 limit form: «Limite do dia, em R$», the R$ error, a typed «R$ 1.000,50»', async () => {
    render(<Regras config={configMercados()} selecionado={im.clear} fases={FASES_MERCADOS} />)

    await userEvent.click(screen.getByRole('button', { name: 'Mudar o limite do dia de Clear' }))
    const field = screen.getByLabelText('Limite do dia, em R$')
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveValue('500')
    await userEvent.clear(field)
    await userEvent.type(field, '2000000')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Use um valor até R$ 1.000.000.')

    await userEvent.clear(screen.getByLabelText('Limite do dia, em R$'))
    await userEvent.type(screen.getByLabelText('Limite do dia, em R$'), 'R$ 1.000,50')
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(limiteValor()?.textContent).toBe('R$\u00a01.000,50')
    expect(within(document.getElementById('r-lim')?.closest('li') as HTMLElement).getByText('não salvo')).toBeInTheDocument()
    expect(hojeLinhas()[2]).toBe('Se a perda do dia chegar a R$\u00a01.000,50Encerrado por hoje')
    // «Ao chegar no limite» is there; «por conta / somando» is not
    expect(screen.getByRole('group', { name: 'Ao chegar no limite' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'somando as contas de Futuros' })).not.toBeInTheDocument()
  })

  it('a forex limit in US$: no «só nesta conta» tag and no mode pills, even beside two futures accounts', () => {
    const c = comApexMercados(configMercados())
    const { unmount } = render(<Regras config={c} selecionado={im.topOne} fases={FASES_MERCADOS} />)
    // The futures account beside Apex A gets the pills; FTMO never does
    expect(screen.getByRole('group', { name: 'Como o limite de Top One #1 conta' })).toBeInTheDocument()
    unmount()

    render(<Regras config={c} selecionado={im.ftmo} fases={FASES_MERCADOS} />)
    expect(screen.getByText('Forex · Avaliação')).toBeInTheDocument()
    expect(limiteValor()?.textContent).toBe('US$\u00a01.000')
    expect(screen.queryByText('só nesta conta')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Como o limite de FTMO conta' })).not.toBeInTheDocument()
    expect(regraNomes()).toEqual(['Janela', 'Só operar dentro da sua janela', 'Limite do dia'])
    // Thursday 12:00 ET, after the 08:00–10:00 ET window; no data block line
    expect(hojeLinhas()).toEqual([
      '08:00–10:00 ET · sua janelaLiberado',
      'No resto do diaFora da sua janela',
      'Se a perda do dia chegar a US$\u00a01.000Encerrado por hoje',
    ])
  })

  it.each([
    [
      'FTMO',
      'Como ler: regras de Forex',
      'Nas contas de Forex, as regras são a janela e o limite do dia, em US$. Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5. O limite zera quando o dia vira, às 17:00 ET; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.',
    ],
    [
      'IBKR',
      'Como ler: regras de Ações',
      'Nas contas de Ações, as regras são a janela e o limite do dia, em US$. Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5. O limite zera quando o dia vira, às 20:00 ET; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.',
    ],
    [
      'Binance',
      'Como ler: regras de Cripto',
      'Nas contas de Cripto, as regras são a janela e o limite do dia, em US$. USDT e USDC contam como dólar. Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5. O limite zera quando o dia vira, à meia-noite de Brasília; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.',
    ],
    [
      'Clear',
      'Como ler: regras da B3',
      'Nas contas da B3, as regras são a janela e o limite do dia, em R$. Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5. O limite zera quando o dia vira, à meia-noite de Brasília; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.',
    ],
  ])('%s: the market’s ⓘ next to the chip', async (label, aria, texto) => {
    const c = configMercados()
    const id = c.accounts.find((a) => a.label === label)!.id
    render(<Regras config={c} selecionado={id} fases={FASES_MERCADOS} />)

    const info = screen.getByRole('button', { name: aria })
    expect(info.closest('.hub-pz-regras-cab')).not.toBeNull()
    expect(info).toHaveAttribute('aria-controls', 'info-regras-mk')
    expect(info).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('info-regras-mk')).toBeNull()
    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('info-regras-mk')?.textContent).toBe(texto)
    await userEvent.click(info)
    expect(document.getElementById('info-regras-mk')).toBeNull()
  })

  it('no market ⓘ for «Padrão Futuros», Futuros or binárias; an open one follows «Regras de»', async () => {
    render(<Regras config={configMercados()} selecionado={im.binance} fases={FASES_MERCADOS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: regras de Cripto' }))

    await userEvent.click(regrasDe().getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Como ler: regras da B3' })).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('info-regras-mk')).toHaveTextContent('Nas contas da B3')

    for (const label of ['Padrão Futuros', 'Top One #1', 'Ebinex']) {
      await userEvent.click(regrasDe().getByRole('button', { name: label }))
      expect(screen.queryByRole('button', { name: /^Como ler: regras / })).not.toBeInTheDocument()
      expect(document.getElementById('info-regras-mk')).toBeNull()
    }
  })

  it('the ⓘ says when the limit resets on the account’s own clock: a Phase 1 forex account on Brasília midnight', async () => {
    const c = comDia(configMercados(), im.ftmo, { tz: 'America/Sao_Paulo', startMin: 0 })
    render(<Regras config={c} selecionado={im.ftmo} fases={FASES_MERCADOS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: regras de Forex' }))
    expect(document.getElementById('info-regras-mk')).toHaveTextContent('O limite zera quando o dia vira, à meia-noite de Brasília;')
    expect(document.getElementById('info-regras-mk')).not.toHaveTextContent('17:00')
  })

  it('IBKR, without a version: no window, «Nenhuma versão salva» with its approved text, and «Começar as regras hoje»', () => {
    render(<Regras config={configMercados()} selecionado={im.ibkr} fases={FASES_MERCADOS} />)
    expect(screen.getByText('Ações · Pessoal')).toBeInTheDocument()
    expect(screen.getByText('Sem janela', { selector: '.hub-pz-fraco' })).toBeInTheDocument()
    expect(screen.getByText(/Sem janela: esta regra não age\./)).toBeInTheDocument()
    expect(limiteValor()).toHaveTextContent('Sem limite')
    expect(hojeLinhas()).toEqual(['O dia todoSem janela salva'])
    expect(screen.getByText('Nenhuma versão salva')).toBeInTheDocument()
    expect(screen.getByText('Até salvar, as operações ficam em “Histórico importado · só resultado”.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Começar as regras hoje' })).toBeInTheDocument()
  })

  it('the rules ⓘ says the other markets have the window and the limit, in their currency', async () => {
    render(<Regras config={configMercados()} selecionado={im.clear} fases={FASES_MERCADOS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Como ler: Suas regras' }))
    const info = document.getElementById('info-regras') as HTMLElement
    expect(info).toHaveTextContent(
      'Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5; a regra por estado é uma só para o mercado. Nos outros mercados, as regras são a janela e o limite do dia.',
    )
    expect(info).toHaveTextContent('O limite do dia fica na moeda da conta, R$ na B3 e US$ nos outros mercados, e nunca soma contas de mercados diferentes.')
    expect(info).not.toHaveTextContent('Futuros com binárias')
  })
})

describe('Preferencias and the bar', () => {
  it('Tema is instant and «Horários na tela» waits for the rules', async () => {
    const onTema = jest.fn()
    const { rerender } = render(<Preferencias tema="claro" onTema={onTema} carga="carregando" onTentar={() => {}} horarios={null} onHorarios={() => {}} />)
    const tema = screen.getByRole('group', { name: 'Tema' })
    expect(within(tema).getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(tema).getByRole('button', { name: 'Escuro' }))
    expect(onTema).toHaveBeenCalledWith('escuro')
    expect(screen.getByText('Carregando…')).toBeInTheDocument()

    const onHorarios = jest.fn()
    rerender(<Preferencias tema="escuro" onTema={onTema} carga="pronto" onTentar={() => {}} horarios="et" onHorarios={onHorarios} />)
    const horarios = screen.getByRole('group', { name: 'Horários na tela' })
    expect(within(horarios).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Nova York (ET)', 'true'],
      ['Brasília', 'false'],
      ['Os dois', 'false'],
    ])
    await userEvent.click(within(horarios).getByRole('button', { name: 'Brasília' }))
    expect(onHorarios).toHaveBeenCalledWith('br')
  })

  it('the bar’s disabled buttons stay focusable and do nothing', async () => {
    const onSalvar = jest.fn()
    render(
      <BarraSalvar
        visivel
        sujo
        status={{ texto: 'Corrija a janela marcada para salvar.', tom: 'mudou' }}
        podeDescartar
        podeSalvar={false}
        onDescartar={() => {}}
        onSalvar={onSalvar}
        onSair={() => {}}
      />,
    )
    const salvar = screen.getByRole('button', { name: 'Salvar alterações' })
    expect(salvar).toHaveAttribute('aria-disabled', 'true')
    expect(salvar).not.toBeDisabled()
    await userEvent.click(salvar)
    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.getByText('Corrija a janela marcada para salvar.')).toHaveClass('hub-pz-st--mudou')
  })
})

describe('hub-personalizar.css', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-personalizar.css'), 'utf8')
  const media = (q: string) => {
    const start = css.indexOf(`@media (${q})`)
    return start < 0 ? '' : css.slice(start, css.indexOf('\n}\n', start))
  }

  it('puts each rule row in one column at 640px and below (375px phones)', () => {
    expect(css).toMatch(/\.hub-pz-regra \{\n {2}display: grid;\n {2}grid-template-columns: minmax\(132px, 0\.75fr\) minmax\(0, 1\.6fr\);/)
    expect(media('max-width: 640px')).toMatch(/\.hub-pz-regra \{\n {4}grid-template-columns: minmax\(0, 1fr\);/)
  })

  it('stacks the market cards at 980px, rounds the bar at 540px and drops motion when asked', () => {
    expect(media('max-width: 980px')).toContain('.hub-pz-grade')
    expect(media('max-width: 540px')).toMatch(/\.hub-pz-barra \{\n {4}border-radius: 24px;/)
    expect(media('prefers-reduced-motion: reduce')).toContain('transition: none')
  })

  it('gives «+ Adicionar conta» under the market cards a 44px target (board `link-44`)', () => {
    const rule = css.slice(css.indexOf('.hub .hub-pz-link-btn {'), css.indexOf('}', css.indexOf('.hub .hub-pz-link-btn {')))
    expect(rule).toContain('display: inline-flex;')
    expect(rule).toContain('align-items: center;')
    expect(rule).toContain('min-height: 44px;')
  })

  it('underlines the links to «Quando você opera»; the one inside a warning stays inline with a 44px hit area', () => {
    expect(css).toMatch(/\.hub \.hub-pz-link44 \{[^}]*text-decoration: underline;/)
    const aviso = css.slice(css.indexOf('.hub .hub-pz-aviso__link,'), css.indexOf('}', css.indexOf('.hub .hub-pz-aviso__link,')))
    expect(aviso).toContain('display: inline;')
    expect(aviso).toContain('position: relative;')
    expect(aviso).toContain('padding: 15px 2px;')
    expect(aviso).toContain('text-decoration: underline;')
    expect(aviso).not.toContain('min-height')
  })

  it('keeps a focused control clear of the sticky save bar (scroll padding while the bar shows)', () => {
    expect(css).toMatch(/html:has\(\.hub-pz-barra\) \{\n {2}scroll-padding-bottom: 96px;/)
    expect(media('max-width: 640px')).toMatch(/html:has\(\.hub-pz-barra\) \{\n {4}scroll-padding-bottom: 140px;/)
  })

  it('centres «ativo na Fase 5» on the switch line', () => {
    expect(css).toMatch(/\.hub-pz-sw-linha \.hub-chip-fraco \{\n {2}align-self: center;/)
  })

  it('keeps sticky positioning working (no scroll container on html/body on this page)', () => {
    expect(css).toMatch(/html:has\(\.hub-pz-corpo\),\nhtml:has\(\.hub-pz-corpo\) body \{\n {2}overflow-x: clip;/)
    expect(media('min-width: 900px')).toMatch(/position: sticky;/)
  })
})

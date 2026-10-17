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
import { activeAccounts, pendingVersions, type AccountConfig, type RulesConfig, type RulesSettings } from '@/lib/hub/regras'
import { PADRAO_FUTUROS, comBloqueio, comLimite, comModoLimite, comRegraJanela } from '@/lib/hub/rascunho'
import { configAntes, configDepois, idsDono } from '@/testing/regras'
import { et } from '@/testing/gate'

const ids = idsDono()
const NOW = et('2026-10-22 12:00')

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

function Regras({ config, inicial, selecionado, onIrJanelas = jest.fn() }: { config: RulesConfig; inicial?: RulesSettings; selecionado: string; onIrJanelas?: jest.Mock }) {
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
      fases={{}}
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
    expect(screen.getByText('Sem conta de opções binárias.')).toBeInTheDocument()
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

  it('the limit mode: hidden with one futures account «por conta», shown with two, and kept while «somando»', async () => {
    const c = configDepois()
    const { unmount } = render(<Regras config={c} selecionado={ids.topOne} />)
    expect(screen.queryByRole('group', { name: 'Como o limite de Top One #1 conta' })).not.toBeInTheDocument()
    unmount()

    const soma = render(<Regras config={c} inicial={comModoLimite(c.settings, ids.topOne, 'soma')} selecionado={ids.topOne} />)
    const group = screen.getByRole('group', { name: 'Como o limite de Top One #1 conta' })
    expect(within(group).getByRole('button', { name: 'somando as contas de Futuros' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hoje só há uma conta de Futuros. Binárias nunca entram.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Como fica hoje' })).getByText(/somando Futuros/)).toBeInTheDocument()
    await userEvent.click(within(group).getByRole('button', { name: 'por conta' }))
    // Back to «por conta» with one account: the pills go (contrato §4.6) and focus stays on the row
    expect(screen.queryByRole('group', { name: 'Como o limite de Top One #1 conta' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mudar o limite do dia de Top One #1' })).toHaveFocus())
    soma.unmount()

    const two = comApex(c)
    render(<Regras config={two} inicial={comModoLimite(two.settings, ids.topOne, 'soma')} selecionado={ids.topOne} />)
    expect(screen.getByText('Soma Top One #1 e Apex A. Binárias nunca entram.')).toBeInTheDocument()
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

  it('keeps sticky positioning working (no scroll container on html/body on this page)', () => {
    expect(css).toMatch(/html:has\(\.hub-pz-corpo\),\nhtml:has\(\.hub-pz-corpo\) body \{\n {2}overflow-x: clip;/)
    expect(media('min-width: 900px')).toMatch(/position: sticky;/)
  })
})

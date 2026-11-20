/**
 * Phase 5-1 · «Dados econômicos» in Personalizar › Suas regras (lane L5; SPEC §7.1, c3 §3; the approved boards Q01,
 * Q04, Q05, Q40–Q43, whose roteiro/Qnn.md give every string): each frame state in the boards' world
 * (testing/agenda.ts + testing/telasRegras.tsx, the configuration's recorded rules_config), the ready-made choice
 * marked from the map, the list's groups, the tags and «Voltar ao padrão de Futuros», the old account's «Entendi»,
 * the keyboard and the 44 px pieces.
 */
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { escolherDado } from '@/lib/hub/rascunho'
import { entendiKey } from '@/lib/hub/avisoDados'
import { RegrasDoQuadro, configDoEstado } from '@/testing/telasRegras'
import type { EstadoDados } from '@/testing/agenda'

const status = () => document.getElementById('r-dados-hoje') as HTMLElement
const pills = () => within(screen.getByRole('group', { name: 'O que você faz quando sai um dado' })).getAllByRole('button')
const pressed = () => pills().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)
const regra = () => document.getElementById('r-dados')!.closest('li') as HTMLElement
const nomeDaRegra = () => regra().querySelector('.hub-pz-regra__nome') as HTMLElement
const texto = (el: Element) => (el.textContent ?? '').replace(/ /g, ' ')

/** The Top One of a state, «Entendi» already pressed on this device (only Q41 shows the notice) */
function renderEstado(estado: EstadoDados, opts: { aviso?: boolean; editar?: Parameters<typeof RegrasDoQuadro>[0]['editar'] } = {}) {
  const id = configDoEstado(estado).accounts[0].id
  window.localStorage.clear()
  if (!opts.aviso) window.localStorage.setItem(entendiKey(id), '1')
  render(<RegrasDoQuadro estado={estado} editar={opts.editar} />)
  return id
}

async function abrirLista() {
  await userEvent.click(screen.getByRole('button', { name: 'Escolher dado por dado (14)' }))
  return document.getElementById('dados-lista') as HTMLElement
}

/** Each row of the open list: «name|next date|choice|só nesta conta?» per group heading */
function linhasDaLista(lista: HTMLElement) {
  return Array.from(lista.querySelectorAll('.hub-col-linha')).map((row) => {
    const nome = row.querySelector('.hub-col-tit b')!.textContent
    const tag = row.querySelector('.hub-tag') ? ' [só nesta conta]' : ''
    const data = texto(row.querySelector('.hub-col-ex')!)
    const sel = row.querySelector('select') as HTMLSelectElement
    return `${nome}${tag} · ${data} · ${sel.options[sel.selectedIndex].text}`
  })
}

describe('«Dados econômicos»: the frames (boards Q01–Q05, Q40–Q43)', () => {
  it('Q01: a new account on the default, the list closed, the CPI day', () => {
    renderEstado('q01-personalizar-padrao')
    expect(screen.getByText('Dados econômicos')).toBeInTheDocument()
    expect(within(nomeDaRegra()).getByText('padrão de Futuros')).toHaveClass('hub-tag', 'hub-tag--padrao')
    expect(screen.getByRole('button', { name: 'Como ler: Dados econômicos' })).toBeInTheDocument()
    const sw = screen.getByRole('switch', { name: 'Dados econômicos' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveAttribute('aria-describedby', 'r-dados-hoje')
    expect(within(regra()).getByText('Ligado')).toBeInTheDocument()
    expect(pills().map((b) => b.textContent)).toEqual([
      'Aguardo nos dados fortes',
      'Só opero depois dos dados das 08:30',
      'Não opero em dia de CPI, Payroll e Fed',
      'Personalizado',
    ])
    expect(pressed()).toEqual(['Aguardo nos dados fortes'])
    expect(screen.getByLabelText('Minutos antes do dado')).toHaveValue('5')
    expect(screen.getByLabelText('Minutos depois do dado')).toHaveValue('10')
    expect(screen.getByText('Aguardo em volta do horário: de 5 min antes a 10 min depois do dado.')).toBeInTheDocument()
    expect(screen.getByText('Só opero depois do dado: das 18:00 de Nova York da véspera até 10 min depois do dado.')).toBeInTheDocument()
    expect(screen.getByText('Aguardo em volta do horário: os 10 dados fortes dos EUA · Opero normalmente: 4 dados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escolher dado por dado (14)' })).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('dados-lista')).toBeNull()
    expect(status()).toHaveAttribute('role', 'status')
    expect(status()).toHaveTextContent('Hoje: CPI às 08:30 ET, você aguarda das 08:25 às 08:40.')
    // No own key: no «Voltar ao padrão» (c3 l.487), no notice
    expect(screen.queryByRole('button', { name: /Voltar ao padrão de Futuros/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('Q04: «Só opero depois dos dados das 08:30» saved on the account, the list open, the Fed day', async () => {
    renderEstado('q04-personalizar-0830')
    expect(within(nomeDaRegra()).getByText('só nesta conta')).toHaveClass('hub-tag--propria')
    expect(pressed()).toEqual(['Só opero depois dos dados das 08:30'])
    expect(screen.getByText('Só opero depois do dado: 6 dados · Aguardo em volta do horário: 4 dados · Opero normalmente: 4 dados')).toBeInTheDocument()
    expect(status()).toHaveTextContent(
      'Hoje: decisão do Fed às 14:00 ET, você aguarda das 13:55 às 14:10; entrevista do Fed às 14:30 ET, você aguarda das 14:25 às 14:40.',
    )
    const lista = await abrirLista()
    expect(screen.getByRole('button', { name: 'Escolher dado por dado (14)' })).toHaveAttribute('aria-expanded', 'true')
    expect(Array.from(lista.querySelectorAll('h4')).map(texto)).toEqual(['EUA · dados fortes (10)', 'EUA · outros dados (4)'])
    expect(linhasDaLista(lista)).toEqual([
      'Decisão do Fed · hoje · 14:00 ET · Aguardo em volta do horário',
      'Entrevista do Fed · hoje · 14:30 ET · Aguardo em volta do horário',
      'CPI [só nesta conta] · amanhã · 08:30 ET · Só opero depois do dado',
      'PPI [só nesta conta] · ter 15 dez · 08:30 ET · Só opero depois do dado',
      'Vendas no varejo [só nesta conta] · qua 16 dez · 08:30 ET · Só opero depois do dado',
      // Same instant: the agenda's order (PCE first, as «PCE e PIB dos EUA às 08:30»); the board draws PIB first
      'PCE [só nesta conta] · qua 23 dez · 08:30 ET · Só opero depois do dado',
      'PIB dos EUA [só nesta conta] · qua 23 dez · 08:30 ET · Só opero depois do dado',
      'ISM da indústria · seg 4 jan · 10:00 ET · Aguardo em volta do horário',
      'ISM de serviços · qua 6 jan · 10:00 ET · Aguardo em volta do horário',
      'Payroll [só nesta conta] · sex 8 jan · 08:30 ET · Só opero depois do dado',
      'Vendas de casas usadas · hoje · 10:00 ET · Opero normalmente',
      'Vendas de casas novas · qua 23 dez · 10:00 ET · Opero normalmente',
      'Confiança do consumidor · ter 29 dez · 10:00 ET · Opero normalmente',
      'JOLTS · ter 5 jan · 10:00 ET · Opero normalmente',
    ])
    // The two agendas not followed: one closed line each, with «Calendários ›»
    const fechados = Array.from(lista.querySelectorAll('.hub-dd-fechado'))
    expect(fechados.map((f) => texto(f.querySelector('.hub-dd-fechado__tit')!))).toEqual([
      'Zona do euro (3) · você não segue esta agenda',
      'Brasil (3) · você não segue esta agenda',
    ])
    expect(within(lista).getAllByRole('link', { name: 'Calendários' })).toHaveLength(2)
    // Each select: «{dado}: o que você faz», described by its next date, the four behaviours in full
    const cpi = screen.getByRole('combobox', { name: 'CPI: o que você faz' })
    expect(cpi).toHaveAccessibleDescription('amanhã\u00a0·\u00a008:30 ET')
    expect(within(cpi).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Opero normalmente',
      'Aguardo em volta do horário',
      'Só opero depois do dado',
      'Não opero no dia',
    ])
    expect(screen.getByRole('button', { name: 'Voltar ao padrão de Futuros: Top One' })).toHaveTextContent('Voltar ao padrão de Futuros')
  })

  it('Q05: CPI in «Não opero no dia» matches no ready-made choice: «Personalizado»', async () => {
    renderEstado('q05-personalizar-personalizado')
    expect(pressed()).toEqual(['Personalizado'])
    expect(screen.getByText('Não opero no dia: CPI · Aguardo em volta do horário: 9 dados · Opero normalmente: 4 dados')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Hoje: dia de CPI (08:30 ET), você não opera.')
    const lista = await abrirLista()
    const linhas = linhasDaLista(lista)
    expect(linhas[0]).toBe('CPI [só nesta conta] · hoje · 08:30 ET · Não opero no dia')
    expect(linhas.slice(8, 10)).toEqual([
      'Decisão do Fed · qua 27 jan · 14:00 ET · Aguardo em volta do horário',
      'Entrevista do Fed · qua 27 jan · 14:30 ET · Aguardo em volta do horário',
    ])
    // No date published: last of its group
    expect(linhas[13]).toBe('Vendas de casas usadas · próxima data ainda não publicada · Opero normalmente')
  })

  it('Q40: off and saved on the account: only the status line, no «Voltar ao padrão» (as drawn)', () => {
    renderEstado('q40-personalizar-desligada')
    expect(screen.getByRole('switch', { name: 'Dados econômicos' })).toHaveAttribute('aria-checked', 'false')
    expect(within(regra()).getByText('Desligado')).toBeInTheDocument()
    expect(within(nomeDaRegra()).getByText('só nesta conta')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'O que você faz quando sai um dado' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Minutos antes do dado')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Escolher dado por dado/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Voltar ao padrão de Futuros/ })).not.toBeInTheDocument()
    expect(status()).toHaveTextContent('Desligado: você opera normalmente em todos os dados; eles não mudam o “Posso operar hoje?”.')
  })

  it('Q01 and Q42 on a clean device: an account created after the delivery never shows the old account\'s notice', () => {
    for (const e of ['q01-personalizar-padrao', 'q42-personalizar-etiquetas'] as const) {
      renderEstado(e, { aviso: true })
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      expect(screen.queryByText(/agora se chama/)).not.toBeInTheDocument()
      cleanup()
    }
  })

  it('Q41: an old account, 3 and 15 min, the first time: the notice and «Entendi» (the key shared with Q18)', async () => {
    const id = renderEstado('q41-personalizar-conta-antiga', { aviso: true })
    const nota = screen.getByRole('note')
    expect(nota).toHaveTextContent(
      '“Bloqueio de dados” agora se chama “Dados econômicos”, e você escolhe o que faz em cada dado. A partir de agora o app confere os dados: nos dados fortes, o “Posso operar hoje?” mostra “Aguardar até” de 3 min antes a 15 min depois (os minutos que já estavam salvos), e a operação registrada nessa espera ganha a marca “fora do plano”. Mude aqui se quiser outra coisa.',
    )
    expect(within(nomeDaRegra()).getByText('só nesta conta')).toBeInTheDocument()
    expect(pressed()).toEqual(['Aguardo nos dados fortes'])
    expect(screen.getByText('Aguardo em volta do horário: de 3 min antes a 15 min depois do dado.')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Hoje: ISM de serviços às 10:00 ET, você aguarda das 09:57 às 10:15.')
    const voltar = screen.getByRole('button', { name: 'Voltar ao padrão de Futuros: Top One' })

    await userEvent.click(within(nota).getByRole('button', { name: 'Entendi' }))
    expect(window.localStorage.getItem(entendiKey(id))).toBe('1')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()

    // Orchestrator's decision on Q41: the button removes every own key, the minutes too (back to 5 and 10)
    await userEvent.click(voltar)
    expect(screen.getByLabelText('Minutos antes do dado')).toHaveValue('5')
    expect(screen.getByLabelText('Minutos depois do dado')).toHaveValue('10')
    expect(within(nomeDaRegra()).getByText('padrão de Futuros')).toBeInTheDocument()
    expect(within(nomeDaRegra()).getByText('não salvo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Voltar ao padrão de Futuros/ })).not.toBeInTheDocument()
  })

  it('Q41: the notice once dismissed stays hidden (the Q18 notice\'s «Entendi» hides it too)', () => {
    renderEstado('q41-personalizar-conta-antiga')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('Q42: the Fed saved «Não opero no dia», CPI changed now: «só nesta conta» and «não salvo»; tags on the three own rows', async () => {
    renderEstado('q42-personalizar-etiquetas', { editar: (d, c) => escolherDado(d, { tipo: 'conta', conta: c.accounts[0] }, 'cpi', 'dia') })
    expect(within(nomeDaRegra()).getByText('só nesta conta')).toBeInTheDocument()
    expect(within(nomeDaRegra()).getByText('não salvo')).toHaveClass('hub-tag--mudou')
    expect(pressed()).toEqual(['Personalizado'])
    expect(screen.getByText('Não opero no dia: CPI, Decisão do Fed e Entrevista do Fed · Aguardo em volta do horário: 7 dados · Opero normalmente: 4 dados')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Hoje: dia de CPI (08:30 ET), você não opera.')
    const lista = await abrirLista()
    expect(linhasDaLista(lista).filter((l) => l.includes('[só nesta conta]')).map((l) => l.split(' [')[0])).toEqual([
      'CPI',
      'Decisão do Fed',
      'Entrevista do Fed',
    ])
    // Choosing the inherited value again returns the line to the default (its tag leaves)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'CPI: o que você faz' }), 'Aguardo em volta do horário')
    expect(linhasDaLista(document.getElementById('dados-lista')!)[0]).toBe('CPI · hoje · 08:30 ET · Aguardo em volta do horário')
  })

  it('Q43: the day\'s agenda did not load: the rule is not checked', () => {
    renderEstado('q43-personalizar-sem-agenda')
    expect(pressed()).toEqual(['Aguardo nos dados fortes'])
    expect(status()).toHaveTextContent('O app ainda não tem a agenda de hoje: a regra não foi conferida.')
  })
})

describe('«Dados econômicos»: behaviour', () => {
  it('a ready-made choice fills the list at once; «Personalizado» pressed by hand stays pressed and opens the list', async () => {
    renderEstado('q01-personalizar-padrao')
    await userEvent.click(screen.getByRole('button', { name: 'Não opero em dia de CPI, Payroll e Fed' }))
    expect(pressed()).toEqual(['Não opero em dia de CPI, Payroll e Fed'])
    expect(screen.getByText('Não opero no dia: 4 dados · Aguardo em volta do horário: 6 dados · Opero normalmente: 4 dados')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Hoje: dia de CPI (08:30 ET), você não opera.')
    expect(within(nomeDaRegra()).getByText('só nesta conta')).toBeInTheDocument()
    expect(within(nomeDaRegra()).getByText('não salvo')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
    expect(pressed()).toEqual(['Personalizado'])
    expect(document.getElementById('dados-lista')).not.toBeNull()
  })

  it('keyboard: Tab goes switch → the four pills → minutes → «Escolher dado por dado» → the selects → «Voltar ao padrão»; Enter and Space press a pill without moving focus', async () => {
    renderEstado('q04-personalizar-0830')
    const sw = screen.getByRole('switch', { name: 'Dados econômicos' })
    sw.focus()
    const order: string[] = []
    for (let i = 0; i < 7; i++) {
      await userEvent.tab()
      const el = document.activeElement as HTMLElement
      order.push(el.getAttribute('aria-label') ?? el.textContent ?? '')
    }
    expect(order).toEqual([
      'Aguardo nos dados fortes',
      'Só opero depois dos dados das 08:30',
      'Não opero em dia de CPI, Payroll e Fed',
      'Personalizado',
      'Minutos antes do dado',
      'Minutos depois do dado',
      '▸Escolher dado por dado (14)',
    ])
    // With the list closed, its selects are out of the Tab order: the next stop is «Voltar ao padrão»
    await userEvent.tab()
    expect(document.activeElement).toHaveAccessibleName('Voltar ao padrão de Futuros: Top One')

    const fortes = screen.getByRole('button', { name: 'Aguardo nos dados fortes' })
    fortes.focus()
    await userEvent.keyboard('{Enter}')
    expect(pressed()).toEqual(['Aguardo nos dados fortes'])
    expect(fortes).toHaveFocus()
    const depois = screen.getByRole('button', { name: 'Só opero depois dos dados das 08:30' })
    depois.focus()
    await userEvent.keyboard(' ')
    expect(pressed()).toEqual(['Só opero depois dos dados das 08:30'])
    expect(depois).toHaveFocus()

    // Open: the selects come after the disclosure, top to bottom, then «Voltar ao padrão»
    await userEvent.click(screen.getByRole('button', { name: 'Escolher dado por dado (14)' }))
    screen.getByRole('button', { name: 'Escolher dado por dado (14)' }).focus()
    await userEvent.tab()
    expect(document.activeElement).toHaveAccessibleName('Decisão do Fed: o que você faz')
  })

  it('44 px targets come from the built pieces (pill, select, disclosure, button, link)', async () => {
    renderEstado('q04-personalizar-0830')
    for (const b of pills()) expect(b).toHaveClass('hub-pill')
    expect(screen.getByRole('button', { name: 'Escolher dado por dado (14)' })).toHaveClass('hub-abre')
    expect(screen.getByRole('button', { name: 'Voltar ao padrão de Futuros: Top One' })).toHaveClass('hub-btn')
    expect(screen.getByLabelText('Minutos antes do dado')).toHaveClass('hub-pz-campo-num')
    const lista = await abrirLista()
    for (const s of within(lista).getAllByRole('combobox')) expect(s).toHaveClass('hub-sel')
    for (const a of within(lista).getAllByRole('link')) expect(a).toHaveClass('hub-pz-link44')
  })

  it('«Padrão Futuros» edits the default: the row without tags or «Voltar ao padrão» (outside Futuros: PersonalizarSecoes\' binary and B3 cases)', async () => {
    renderEstado('q01-personalizar-padrao')
    await userEvent.click(screen.getByRole('button', { name: 'Padrão Futuros' }))
    // «Padrão Futuros» edits the default: the row is there, without tags or «Voltar ao padrão»
    expect(screen.getByRole('switch', { name: 'Dados econômicos' })).toBeInTheDocument()
    expect(within(nomeDaRegra()).queryByText('padrão de Futuros')).not.toBeInTheDocument()
  })
})

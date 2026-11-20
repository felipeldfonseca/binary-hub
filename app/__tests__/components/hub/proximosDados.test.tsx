/**
 * Phase 5-1 · «Próximos dados» inside «Como fica hoje» (lane L5; c3 §4.3; SPEC §7.3 items 12 and 14; board Q23):
 * the next 14 days of the calendars followed, each line's behaviour and wait, «não toca a sua janela», a cancelled
 * and a postponed release (c3 §12.5), the rule off, «Mostrar mais» and «Depois de dom 6: datas previstas, podem
 * mudar.». The boards' world: Thu 3 Dec 2026 09:00 ET, Top One on the default.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AgendaRow, Rules } from '@/lib/domain/gate'
import { resolveRules } from '@/lib/hub/regras'
import { comBloqueio } from '@/lib/hub/rascunho'
import { proximosDados } from '@/lib/hub/comoFicaHoje'
import { entendiKey } from '@/lib/hub/avisoDados'
import { NY, et, proximosDoQuadro } from '@/testing/agenda'
import { RegrasDoQuadro, configDoEstado } from '@/testing/telasRegras'

const AGORA = et('2026-12-03 09:00')
const texto = (el: Element) => (el.textContent ?? '').replace(/ /g, ' ')

function regrasDoQuadro(off = false): Rules {
  const c = configDoEstado('q23-como-fica-ism-proximos')
  const conta = c.accounts[0]
  const s = off ? comBloqueio(c.settings, { tipo: 'conta', conta }, { on: false }) : c.settings
  return resolveRules(conta, s)
}

/** Each line in one string: «head hour / behaviour wait / não toca» */
const linhas = (r: Rules, rows: readonly AgendaRow[], at = AGORA) =>
  proximosDados(r, at, rows).linhas.map((l) =>
    [`${l.cabeca}${l.hora}`, l.comportamento || l.texto ? `${l.comportamento ?? l.texto}${l.espera ?? ''}` : null, l.naoToca ? 'não toca a sua janela' : null]
      .filter(Boolean)
      .join(' / ')
      .replace(/ /g, ' '),
  )

describe('«Próximos dados» (pure)', () => {
  it('Q23: the world\'s 14 days from Thu 3 Dec 09:00, the wait of each release, «não toca a sua janela» where the wait meets no window', () => {
    const r = regrasDoQuadro()
    expect(linhas(r, proximosDoQuadro(AGORA))).toEqual([
      'Hoje · ISM de serviços · 10:00 ET / Aguardo em volta do horário · 09:55–10:10',
      'Amanhã · Payroll · 08:30 ET / Aguardo em volta do horário · 08:25–08:40 / não toca a sua janela',
      'Qua 9 · Vendas de casas usadas · 10:00 ET / Opero normalmente · sem espera',
      'Qua 9 · Decisão do Fed · 14:00 ET / Aguardo em volta do horário · 13:55–14:10 / não toca a sua janela',
      'Qua 9 · Entrevista do Fed · 14:30 ET / Aguardo em volta do horário · 14:25–14:40 / não toca a sua janela',
      'Qui 10 · CPI · 08:30 ET / Aguardo em volta do horário · 08:25–08:40 / não toca a sua janela',
    ])
    expect(proximosDados(r, AGORA, proximosDoQuadro(AGORA)).depoisDe).toBe('Depois de dom 6: datas previstas, podem mudar.')
  })

  it('reads 14 days: the PCE and PIB of Wed 23 Dec come in from Thu 10 Dec on, sharing one line (same instant, same behaviour)', () => {
    const at = et('2026-12-10 09:00')
    const l = linhas(regrasDoQuadro(), proximosDoQuadro(at), at)
    expect(l[l.length - 1]).toBe('Qua 23 · PCE e PIB dos EUA · 08:30 ET / Aguardo em volta do horário · 08:25–08:40 / não toca a sua janela')
    expect(linhas(regrasDoQuadro(), proximosDoQuadro(AGORA)).some((x) => x.includes('PCE'))).toBe(false)
  })

  it('«Só opero depois do dado» and «Não opero no dia» end «espera até 08:40» and «o dia inteiro»', () => {
    const c = configDoEstado('q23-como-fica-ism-proximos')
    const conta = c.accounts[0]
    let s = c.settings
    s = { ...s, accounts: { ...s.accounts, [conta.id]: { ...s.accounts[conta.id], block: { releases: { payroll: 'depois', cpi: 'dia' } } } } }
    const l = linhas(resolveRules(conta, s), proximosDoQuadro(AGORA))
    expect(l[1]).toBe('Amanhã · Payroll · 08:30 ET / Só opero depois do dado · espera até 08:40 / não toca a sua janela')
    expect(l[5]).toBe('Qui 10 · CPI · 08:30 ET / Não opero no dia · o dia inteiro')
  })

  it('the rule off: the lines stay, all «Opero normalmente · sem espera» (SPEC §7.3 item 14)', () => {
    const l = linhas(regrasDoQuadro(true), proximosDoQuadro(AGORA))
    expect(l).toHaveLength(6)
    for (const x of l) expect(x).toMatch(/ \/ Opero normalmente · sem espera$/)
  })

  it('a postponed release shows on its old date by was_at («… adiado para sex 18 dez») and on its new date as usual; a cancelled one in grey', () => {
    const rows: AgendaRow[] = [
      ...proximosDoQuadro(AGORA).filter((x) => x.code !== 'cpi' && x.code !== 'payroll'),
      { code: 'cpi', calendar: 'us', at: et('2026-12-18 08:30'), wasAt: et('2026-12-10 08:30'), status: 'agendado', day: '2026-12-18', localTz: NY },
      { code: 'payroll', calendar: 'us', at: et('2026-12-04 08:30'), wasAt: null, status: 'cancelado', day: '2026-12-04', localTz: NY },
    ]
    const r = regrasDoQuadro()
    const l = linhas(r, rows)
    expect(l).toContain('Qui 10 · CPI · adiado para sex 18 dez')
    expect(l).toContain('Sex 18 · CPI · 08:30 ET / Aguardo em volta do horário · 08:25–08:40 / não toca a sua janela')
    expect(l).toContain('Amanhã · Payroll · cancelado')
    const res = proximosDados(r, AGORA, rows).linhas
    expect(res.filter((x) => x.cinza).map((x) => x.cabeca.replace(/ /g, ' '))).toEqual(['Amanhã · Payroll · cancelado', 'Qui 10 · CPI · adiado para sex 18 dez'])
  })
})

describe('«Próximos dados» on the screen (board Q23)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(entendiKey(configDoEstado('q23-como-fica-ism-proximos').accounts[0].id), '1')
  })

  it('five lines, then «Depois de dom 6: …», then «Mostrar mais», which opens the rest', async () => {
    render(<RegrasDoQuadro estado="q23-como-fica-ism-proximos" />)
    const lista = screen.getByRole('list', { name: 'Próximos dados' })
    const items = within(lista).getAllByRole('listitem')
    expect(items.map(texto)).toEqual([
      'Hoje · ISM de serviços · 10:00 ETAguardo em volta do horário · 09:55–10:10',
      'Amanhã · Payroll · 08:30 ETAguardo em volta do horário · 08:25–08:40não toca a sua janela',
      'Qua 9 · Vendas de casas usadas · 10:00 ETOpero normalmente · sem espera',
      'Qua 9 · Decisão do Fed · 14:00 ETAguardo em volta do horário · 13:55–14:10não toca a sua janela',
      'Qua 9 · Entrevista do Fed · 14:30 ETAguardo em volta do horário · 14:25–14:40não toca a sua janela',
    ])
    expect(screen.getByText('Depois de dom 6: datas previstas, podem mudar.')).toHaveClass('hub-nota')
    expect(within(items[1]).getByText('não toca a sua janela')).toHaveClass('hub-tom--muted')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }))
    // Six from the world's rows, then PPI (Tue 15) and Vendas no varejo (Wed 16) of the list's next dates (one world)
    expect(within(screen.getByRole('list', { name: 'Próximos dados' })).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).not.toBeInTheDocument()
  })

  it('with the coverage read (integration): «Depois de {dia}» follows the real end of the coverage', () => {
    const us = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => ({ calendar: 'us' as const, day: `2026-12-${String(de + i).padStart(2, '0')}` }))
    const { rerender } = render(<RegrasDoQuadro estado="q23-como-fica-ism-proximos" dados={{ cobertura: { covered: us(3, 17), ate: '2026-12-17' } }} />)
    expect(screen.getByText('Depois de qui 17: datas previstas, podem mudar.')).toHaveClass('hub-nota')
    rerender(<RegrasDoQuadro estado="q23-como-fica-ism-proximos" dados={{ cobertura: { covered: us(3, 4), ate: '2026-12-17' } }} />)
    expect(screen.getByText('Depois de sex 4: datas previstas, podem mudar.')).toBeInTheDocument()
  })

  it('«Como fica hoje» above it: the ISM wait, then the window from 10:10', () => {
    render(<RegrasDoQuadro estado="q23-como-fica-ism-proximos" />)
    const hoje = screen.getByRole('list', { name: 'Como fica hoje' })
    expect(within(hoje).getAllByRole('listitem').map(texto)).toEqual([
      '09:55–10:10 ET · espera do ISM de serviçosAguardar até 10:10',
      '10:00–11:00 ET · sua janelaLiberadoa partir das 10:10, depois da espera',
      'No resto do diaFora da sua janela',
      'Se a perda do dia chegar a US$ 500Encerrado por hoje',
    ])
  })

  it('the same rows as the list\'s next dates (review): on Thu 10 Dec PPI (Tue 15) and Vendas no varejo (Wed 16) come first', () => {
    window.localStorage.setItem(entendiKey(configDoEstado('q19-como-fica-normal').accounts[0].id), '1')
    render(<RegrasDoQuadro estado="q19-como-fica-normal" />)
    const items = within(screen.getByRole('list', { name: 'Próximos dados' })).getAllByRole('listitem').map(texto)
    expect(items.map((x) => x.split(' ET')[0])).toEqual([
      'Ter 15 · PPI · 08:30',
      'Qua 16 · Vendas no varejo · 08:30',
      'Qua 23 · PCE e PIB dos EUA · 08:30',
      'Qua 23 · Vendas de casas novas · 10:00',
    ])
  })

  it('without the agenda of the next days: the sentence and «Tentar de novo»', async () => {
    const onTentar = jest.fn()
    render(<RegrasDoQuadro estado="q23-como-fica-ism-proximos" dados={{ proximos: null, onTentar }} />)
    expect(screen.getByText('O app ainda não tem a agenda dos próximos dias.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onTentar).toHaveBeenCalledTimes(1)
  })
})

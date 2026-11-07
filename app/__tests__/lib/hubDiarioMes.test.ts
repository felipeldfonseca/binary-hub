/**
 * @jest-environment node
 *
 * Fase 4 · telas, lane L1: the pure rules of «mês e semana» (lib/hub/diarioMes): the calendar's roving focus (D14:
 * every key, the ends, ± 7 days to the nearest day that opens, PageUp / PageDown), the month's tab stop, the months
 * around the one shown, the legend's flags (D22), the statuses of the month, the day and the week opened from the
 * calendar (D5, J3), the week card's month read (§5.6); and IMPORTACOES.saem («Saem junto», D20).
 */
import {
  legendaDoCalendario,
  mesDaSemana,
  mesesVizinhos,
  paradaDoTab,
  proximoAnuncio,
  proximoFoco,
  statusDaSemana,
  statusDoDia,
  statusDoMes,
  textoDaSemanaAberta,
} from '@/lib/hub/diarioMes'
import { IMPORTACOES } from '@/components/hub/contas/copy'

/** November 2026 of dez 2 (Top One): the days that open (11 and 26 nov have no trades) */
const NOV = [
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
  '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13',
  '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
  '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27',
  '2026-11-30',
]

const dia = (m: ReturnType<typeof proximoFoco>) => (m && m.tipo === 'dia' ? m.dia : m)

describe('proximoFoco (D14)', () => {
  it('→ ← the next / previous day that opens, skipping the others; none past the ends', () => {
    expect(dia(proximoFoco(NOV, '2026-11-10', 'ArrowRight'))).toBe('2026-11-12')
    expect(dia(proximoFoco(NOV, '2026-11-12', 'ArrowLeft'))).toBe('2026-11-10')
    expect(dia(proximoFoco(NOV, '2026-11-30', 'ArrowRight'))).toBe('2026-11-30')
    expect(dia(proximoFoco(NOV, '2026-11-02', 'ArrowLeft'))).toBe('2026-11-02')
  })

  it('↓ the first that opens a week or more later (else the last); ↑ the last a week or more earlier (else the first)', () => {
    expect(dia(proximoFoco(NOV, '2026-11-04', 'ArrowDown'))).toBe('2026-11-12')
    expect(dia(proximoFoco(NOV, '2026-11-20', 'ArrowDown'))).toBe('2026-11-27')
    expect(dia(proximoFoco(NOV, '2026-11-25', 'ArrowDown'))).toBe('2026-11-30')
    expect(dia(proximoFoco(NOV, '2026-11-30', 'ArrowDown'))).toBe('2026-11-30')
    expect(dia(proximoFoco(NOV, '2026-11-18', 'ArrowUp'))).toBe('2026-11-10')
    expect(dia(proximoFoco(NOV, '2026-11-04', 'ArrowUp'))).toBe('2026-11-02')
  })

  it('Home / End the first / last; PageUp / PageDown the previous / next month', () => {
    expect(dia(proximoFoco(NOV, '2026-11-17', 'Home'))).toBe('2026-11-02')
    expect(dia(proximoFoco(NOV, '2026-11-17', 'End'))).toBe('2026-11-30')
    expect(proximoFoco(NOV, '2026-11-17', 'PageUp')).toEqual({ tipo: 'mes', passo: -1 })
    expect(proximoFoco(NOV, '2026-11-17', 'PageDown')).toEqual({ tipo: 'mes', passo: 1 })
  })

  it('the keys the browser keeps (Tab, Enter, Space, letters): null', () => {
    for (const k of ['Tab', 'Enter', ' ', 'a', 'Escape']) expect(proximoFoco(NOV, '2026-11-10', k)).toBeNull()
  })

  it('from a day that does not open (a stale focus): the nearest in the key’s direction', () => {
    expect(dia(proximoFoco(NOV, '2026-11-11', 'ArrowRight'))).toBe('2026-11-12')
    expect(dia(proximoFoco(NOV, '2026-11-11', 'ArrowLeft'))).toBe('2026-11-10')
  })

  it('a month where no day opens: only the months move', () => {
    expect(proximoFoco([], '2026-11-10', 'ArrowRight')).toBeNull()
    expect(proximoFoco([], '2026-11-10', 'PageUp')).toEqual({ tipo: 'mes', passo: -1 })
  })
})

describe('paradaDoTab, mesesVizinhos', () => {
  it('the tab stop: the focused day while it opens, else the open day in the month, else the first that opens', () => {
    expect(paradaDoTab(NOV, '2026-11-10', '2026-11-17')).toBe('2026-11-17')
    expect(paradaDoTab(NOV, '2026-11-10', null)).toBe('2026-11-10')
    expect(paradaDoTab(NOV, '2026-12-01', null)).toBe('2026-11-02')
    expect(paradaDoTab(NOV, '2026-11-11', '2026-11-26')).toBe('2026-11-02')
    expect(paradaDoTab([], '2026-11-10', null)).toBeNull()
  })

  it('the months around the one shown, within the calendar’s; null at its ends (and around a month outside it)', () => {
    const meses = ['2026-09', '2026-10', '2026-11', '2026-12']
    expect(mesesVizinhos(meses, '2026-11')).toEqual({ anterior: '2026-10', proximo: '2026-12' })
    expect(mesesVizinhos(meses, '2026-09')).toEqual({ anterior: null, proximo: '2026-10' })
    expect(mesesVizinhos(meses, '2026-12')).toEqual({ anterior: '2026-11', proximo: null })
    expect(mesesVizinhos(['2026-11'], '2026-11')).toEqual({ anterior: null, proximo: null })
    expect(mesesVizinhos(meses, '2026-08')).toEqual({ anterior: null, proximo: '2026-09' })
  })
})

describe('the legend and the statuses', () => {
  it('«■ limite atingido» only with a daily limit in the account’s rules', () => {
    expect(legendaDoCalendario({ limit: { cents: 40000 } as never })).toEqual({ limite: true })
    expect(legendaDoCalendario({ limit: null })).toEqual({ limite: false })
    expect(legendaDoCalendario(null)).toEqual({ limite: false })
  })

  it('«Mês: …», «Aberto abaixo: …» once a day opened from the calendar, «Semana aberta abaixo: …» once a week did', () => {
    expect(statusDoMes('2026-11')).toBe('Mês: Novembro de 2026.')
    expect(statusDoDia('2026-11-10', '2026-11-10')).toBe('Aberto abaixo: Terça-feira, 10 de novembro.')
    expect(statusDoDia('2026-12-01', '2026-12-01')).toBe('Aberto abaixo: Terça-feira, 1º de dezembro.')
    expect(statusDoDia('2026-11-10', null)).toBe('')
    expect(statusDoDia('2026-11-10', '2026-11-19')).toBe('')
    expect(textoDaSemanaAberta('2026-10-26', 5)).toBe('Semana aberta abaixo: 26 a 30 de outubro.')
    expect(textoDaSemanaAberta('2026-11-30', 5)).toBe('Semana aberta abaixo: 30 de novembro a 4 de dezembro.')
  })

  it('«Semana aberta abaixo: …» in the calendar’s columns: in a 7-column month a week runs to Sunday, as the cell’s label', () => {
    // Review: the week card's own columns said «9 a 13 de novembro» while the cell said «Semana de 9 a 15 de novembro»
    expect(textoDaSemanaAberta('2026-11-09', 7)).toBe('Semana aberta abaixo: 9 a 15 de novembro.')
    expect(textoDaSemanaAberta('2026-11-30', 7)).toBe('Semana aberta abaixo: 30 de novembro a 6 de dezembro.')
    const a = proximoAnuncio(null, { semanaAnunciada: null, dia: '2026-11-10' }, { semanaAnunciada: '2026-11-09', dia: '2026-11-10' }, 7)
    expect(statusDaSemana(a, '2026-11-09')).toBe('Semana aberta abaixo: 9 a 15 de novembro.')
  })

  it('J3 is said once per week opened, and ends with the next day opened (never again for a later day of that week)', () => {
    const W = '2026-11-16'
    const inicio = { semanaAnunciada: null, dia: '2026-11-10' }
    expect(proximoAnuncio(null, inicio, inicio, 5)).toBeNull()
    // The week cell of 16–20 nov: said
    const aberta = { semanaAnunciada: W, dia: '2026-11-10' }
    const a = proximoAnuncio(null, inicio, aberta, 5)
    expect(a).toEqual({ semana: W, dia: '2026-11-10', texto: 'Semana aberta abaixo: 16 a 20 de novembro.' })
    expect(statusDaSemana(a, W)).toBe('Semana aberta abaixo: 16 a 20 de novembro.')
    // Something else re-renders: the same announcement (no new text, nothing said again)
    expect(proximoAnuncio(a, aberta, aberta, 5)).toBe(a)
    // 24 nov opens: ended
    const dia24 = { semanaAnunciada: W, dia: '2026-11-24' }
    const b = proximoAnuncio(a, aberta, dia24, 5)
    expect(b).toBeNull()
    expect(statusDaSemana(b, '2026-11-23')).toBe('')
    // 19 nov opens, inside the week said before: still nothing (the calendar says «Aberto abaixo: …»)
    const dia19 = { semanaAnunciada: W, dia: '2026-11-19' }
    expect(statusDaSemana(proximoAnuncio(b, dia24, dia19, 5), W)).toBe('')
    // Even when the day goes back to the one open when the week was said
    expect(proximoAnuncio(null, dia19, aberta, 5)).toBeNull()
    // Another week tapped: said; then the first again: said again
    const outra = proximoAnuncio(null, dia19, { semanaAnunciada: '2026-11-23', dia: '2026-11-19' }, 5)
    expect(statusDaSemana(outra, '2026-11-23')).toBe('Semana aberta abaixo: 23 a 27 de novembro.')
    const devolta = proximoAnuncio(outra, { semanaAnunciada: '2026-11-23', dia: '2026-11-19' }, { semanaAnunciada: W, dia: '2026-11-19' }, 5)
    expect(statusDaSemana(devolta, W)).toBe('Semana aberta abaixo: 16 a 20 de novembro.')
    // Another account: B0's state starts over (no week, today's day)
    expect(proximoAnuncio(devolta, { semanaAnunciada: W, dia: '2026-11-19' }, { semanaAnunciada: null, dia: '2026-12-01' }, 5)).toBeNull()
    // Only for the week it names
    expect(statusDaSemana(a, '2026-11-09')).toBe('')
  })

  it('the week card’s month: the month shown when the week’s Monday is in it, else the week’s own', () => {
    expect(mesDaSemana('2026-11-09', '2026-11')).toEqual({ mes: '2026-11', proprio: false })
    expect(mesDaSemana('2026-11-30', '2026-12')).toEqual({ mes: '2026-11', proprio: true })
    expect(mesDaSemana('2026-11-09', '2026-10')).toEqual({ mes: '2026-11', proprio: true })
  })
})

describe('IMPORTACOES.inserted: the batch line’s «nova» (board dez 13, engine `l.novas === 1 ? \' nova\' : \' novas\'`)', () => {
  it('«1 nova», «0 novas», «5 novas», «1.200 novas»', () => {
    expect(IMPORTACOES.inserted(1)).toBe('1 nova')
    expect(IMPORTACOES.inserted(0)).toBe('0 novas')
    expect(IMPORTACOES.inserted(5)).toBe('5 novas')
    expect(IMPORTACOES.inserted(1200)).toBe('1.200 novas')
  })
})

describe('IMPORTACOES.saem (D20)', () => {
  it('only the counts above zero, joined by «, » and « e », singulars; null when all are zero', () => {
    expect(IMPORTACOES.saem({ marks: 2, images: 0, notes: 1 })).toBe('Saem junto: 2 marcas e 1 nota que você pôs no Diário.')
    expect(IMPORTACOES.saem({ marks: 1, images: 1, notes: 1 })).toBe('Saem junto: 1 marca, 1 imagem e 1 nota que você pôs no Diário.')
    expect(IMPORTACOES.saem({ marks: 0, images: 3, notes: 0 })).toBe('Saem junto: 3 imagens que você pôs no Diário.')
    expect(IMPORTACOES.saem({ marks: 12, images: 2, notes: 4 })).toBe('Saem junto: 12 marcas, 2 imagens e 4 notas que você pôs no Diário.')
    expect(IMPORTACOES.saem({ marks: 1200, images: 0, notes: 0 })).toBe('Saem junto: 1.200 marcas que você pôs no Diário.')
    expect(IMPORTACOES.saem({ marks: 0, images: 0, notes: 0 })).toBeNull()
  })
})

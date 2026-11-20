/**
 * @jest-environment node
 *
 * Phase 5 · telas-diario: the Diário's day labels (c3 §6.5, SPEC §8 L4 and L6, decididas Part 5 items 1–2): the grey
 * line of the open day with its releases from the week's read (testing/agenda's world, as fetchDadosDaSemana answers
 * it), a postponed release on its first date (`was_at`), a cancelled one, and the holidays of the CME list in the code
 * (lib/domain/agenda/feriados), Futuros only, also on a day without the agenda. Invented data only.
 */
import type { AgendaRow } from '@/lib/domain/gate'
import { feriadoDoDia, feriadosDaSemana, linhaCinzaDoDia } from '@/lib/hub/diario'
import { NY, RELOGIO_TOP, et, semanaDe, semanaDoQuadro } from '@/testing/agenda'

const TOP = { market: 'futures' as const, tz: NY, clock: RELOGIO_TOP, calendars: ['us' as const] }
const semana = (day: string) => {
  const w = semanaDe(day)
  return semanaDoQuadro(w.start, w.end)
}

const linha = (code: AgendaRow['code'], at: string, o: Partial<AgendaRow> = {}): AgendaRow => ({
  code,
  calendar: 'us',
  at: et(at),
  wasAt: null,
  status: 'agendado',
  day: at.slice(0, 10),
  localTz: NY,
  ...o,
})

describe('the open day\'s grey line: releases from the week\'s read', () => {
  it('Q27, Q32: «ISM de serviços, 10:00»; Q28: «CPI, 08:30»', () => {
    expect(linhaCinzaDoDia(semana('2026-12-03'), '2026-12-03', TOP)).toBe('ISM de serviços, 10:00')
    expect(linhaCinzaDoDia(semana('2026-12-10'), '2026-12-10', TOP)).toBe('CPI, 08:30')
  })

  it('several releases in the order of their hour (9 Dec: existing-home sales, the Fed\'s decision and press conference)', () => {
    expect(linhaCinzaDoDia(semana('2026-12-09'), '2026-12-09', TOP)).toBe(
      'Vendas de casas usadas, 10:00 · Decisão do Fed, 14:00 · Entrevista do Fed, 14:30',
    )
  })

  it('a day without releases, an unread week (null): no line; never «nenhum dado» unchecked', () => {
    expect(linhaCinzaDoDia(semana('2026-12-02'), '2026-12-02', TOP)).toBeNull()
    expect(linhaCinzaDoDia(null, '2026-12-03', TOP)).toBeNull()
  })

  it('hours on the Diário\'s clock (another window zone); the day on the account\'s day clock (an eve release counts on D)', () => {
    expect(linhaCinzaDoDia(semana('2026-12-03'), '2026-12-03', { ...TOP, tz: 'America/Sao_Paulo' })).toBe('ISM de serviços, 12:00')
    // 19:00 ET on Wed 2 Dec is past 18:00: Thursday's session
    const eve = linha('cpi', '2026-12-02 19:00')
    expect(linhaCinzaDoDia([eve], '2026-12-03', TOP)).toBe('CPI, 19:00')
    expect(linhaCinzaDoDia([eve], '2026-12-02', TOP)).toBeNull()
  })

  it('only the calendars the account follows; rows the app does not wait for (no code) left out', () => {
    const bce = linha('bce_decisao', '2026-12-03 08:15', { calendar: 'eu' })
    expect(linhaCinzaDoDia([bce], '2026-12-03', TOP)).toBeNull()
    expect(linhaCinzaDoDia([bce], '2026-12-03', { ...TOP, calendars: ['us', 'eu'] })).toBe('Decisão do BCE, 08:15')
    expect(linhaCinzaDoDia([linha(null, '2026-12-03 10:00')], '2026-12-03', TOP)).toBeNull()
  })

  it('cancelled, postponed without a date, and postponed to another date: on its first date (`was_at`) in grey; on the new date, the usual label', () => {
    const cancelado = linha('cpi', '2026-12-10 08:30', { status: 'cancelado' })
    expect(linhaCinzaDoDia([cancelado], '2026-12-10', TOP)).toBe('CPI · cancelado')
    const semData = linha('payroll', '2026-12-04 08:30', { status: 'adiado' })
    expect(linhaCinzaDoDia([semData], '2026-12-04', TOP)).toBe('Payroll · adiado, sem data nova')
    const movido = linha('cpi', '2026-12-18 08:30', { wasAt: et('2026-12-10 08:30') })
    expect(linhaCinzaDoDia([movido], '2026-12-10', TOP)).toBe('CPI · adiado para sex 18 dez')
    expect(linhaCinzaDoDia([movido], '2026-12-18', TOP)).toBe('CPI, 08:30')
  })

  it('another market: no line, not even a holiday', () => {
    expect(linhaCinzaDoDia(semana('2026-12-03'), '2026-12-03', { ...TOP, market: 'binary' })).toBeNull()
    expect(linhaCinzaDoDia([], '2026-11-26', { ...TOP, market: 'b3' })).toBeNull()
  })
})

describe('holidays from the code list (feriados.ts), Futuros only', () => {
  it('«Quinta, 26 nov: feriado nos EUA», whatever the calendars, also without the agenda (null read)', () => {
    expect(feriadoDoDia('2026-11-26')).toBe('Quinta, 26 nov: feriado nos EUA')
    expect(feriadoDoDia('2026-11-27')).toBeNull()
    expect(linhaCinzaDoDia(null, '2026-11-26', TOP)).toBe('Quinta, 26 nov: feriado nos EUA')
    expect(linhaCinzaDoDia(null, '2026-11-26', { ...TOP, calendars: [] })).toBe('Quinta, 26 nov: feriado nos EUA')
    expect(feriadoDoDia('2026-12-25')).toBe('Sexta, 25 dez: feriado nos EUA')
  })

  it('next to the day\'s releases, after them', () => {
    expect(linhaCinzaDoDia([linha('jolts', '2026-11-26 10:00')], '2026-11-26', TOP)).toBe('JOLTS, 10:00 · Quinta, 26 nov: feriado nos EUA')
  })

  it('the «Semana» card lists the week\'s holidays (Futuros only)', () => {
    const dias = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']
    expect(feriadosDaSemana(dias, 'futures')).toEqual(['Quinta, 26 nov: feriado nos EUA'])
    expect(feriadosDaSemana(dias, 'forex')).toEqual([])
    expect(feriadosDaSemana(['2026-12-01'], 'futures')).toEqual([])
  })
})

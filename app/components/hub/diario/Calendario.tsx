'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { calendarMonths, heatLevels, monthGrid, monthOf, type CalendarRead, type Day } from '@/lib/domain/diario'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { celulaDaSemana, celulaDoCalendario, COLUNAS, comoLerOCalendario, mesTitulo, valoresEm } from '@/lib/hub/diario'
import { legendaDoCalendario, mesesVizinhos, paradaDoTab, proximoFoco, statusDoDia, statusDoMes } from '@/lib/hub/diarioMes'
import { useDiarioPagina } from './useDiarioPagina'
import { CelulaDaSemana, CelulaDoDia } from './CalendarioCelula'
import { SECAO, TITULO } from './ids'
import { CAL, LEGENDA } from './copyMes'

/** The heat levels over the whole calendar answer (quartiles of every day, diário and history apart), once per answer */
const niveisPorLeitura = new WeakMap<CalendarRead, ReturnType<typeof heatLevels>>()
function niveis(cal: CalendarRead) {
  let n = niveisPorLeitura.get(cal)
  if (!n) {
    n = heatLevels(cal.days)
    niveisPorLeitura.set(cal, n)
  }
  return n
}

/**
 * «Calendário» (lane L1, contract §2.2 D1–D23; boards DiarioDezEnxuto / DiarioHojeEnxuto): one month of the open
 * account, Seg–Sex (+ Sáb and Dom on Cripto and in a month with a weekend trading day) and «Semana». Each day is
 * coloured by quartiles of the daily result (lib/domain/diario monthGrid over the whole calendar answer, ● ■ from the
 * month's diario_mes), worded by lib/hub/diario. ‹ «Hoje» › page through calendarMonths (the open day stays); one tab
 * stop in the grid, arrows between the days that open, Home/End, PageUp/PageDown to the neighbouring months (D14);
 * a day opens below (focus stays on it, «Aberto abaixo: …»), a week opens in the «Semana» card.
 */
export default function Calendario() {
  const { contaDiario, regras, calendario, mesLido, dia, mes, semana, diaAnunciado, abrirDia, mostrarMes, abrirSemana } = useDiarioPagina()
  const [infoAberto, alternarInfo] = useToggle()
  // The day the keyboard last focused in this month (the roving tab stop follows it); and «focus the first day that
  // opens» after PageUp / PageDown, once that month is drawn
  const [focado, setFocado] = useState<{ mes: string; dia: Day } | null>(null)
  const [focarPrimeiroDe, setFocarPrimeiroDe] = useState<string | null>(null)
  const grade = useRef<HTMLDivElement>(null)

  const cal = calendario.data as CalendarRead
  const meses = useMemo(() => calendarMonths(cal.firstDay, cal.today), [cal])
  const mesAtual = mes ?? monthOf(cal.today)
  const leituraDoMes = mesLido.data && mesLido.data.month === mesAtual ? mesLido.data : null
  const grid = useMemo(
    () =>
      monthGrid({
        month: mesAtual,
        today: cal.today,
        market: cal.account.market,
        days: cal.days,
        weeks: cal.weeks,
        mes: leituraDoMes,
        levels: niveis(cal),
      }),
    [mesAtual, cal, leituraDoMes],
  )
  const clicaveis = useMemo(() => grid.weeks.flatMap((w) => w.cells.filter((c) => c.clickable).map((c) => c.day)), [grid])
  const parada = paradaDoTab(clicaveis, dia, focado && focado.mes === mesAtual ? focado.dia : null)
  const { anterior, proximo } = mesesVizinhos(meses, mesAtual)
  const mesDeHoje = monthOf(cal.today)
  const legenda = legendaDoCalendario(regras)

  // PageUp / PageDown: the first day that opens in the month just shown takes the focus (and the tab stop). A month
  // where no day opens (a month off between the first trade and today) has no tab stop: the focus, whose cell is gone,
  // goes to «Calendário» (its H2, tabIndex −1), never to the page's start; «Mês: …» says which month it is
  useEffect(() => {
    if (!focarPrimeiroDe || focarPrimeiroDe !== mesAtual) return
    setFocarPrimeiroDe(null)
    const primeiro = clicaveis[0]
    if (!primeiro) {
      document.getElementById(TITULO.calendario)?.focus()
      return
    }
    setFocado({ mes: mesAtual, dia: primeiro })
    grade.current?.querySelector<HTMLElement>(`[data-dia="${primeiro}"]`)?.focus()
  }, [focarPrimeiroDe, mesAtual, clicaveis])

  // ‹ «Hoje» › (the board's mesAnterior / mesProximo / mesHoje clear focoCal): the month's tab stop goes back to the open
  // day when it is in the month, else to its first day that opens — never to a day the keyboard left there earlier
  const irPara = (alvo: string | null) => {
    if (!alvo) return
    setFocado(null)
    mostrarMes(alvo)
  }

  const onTecla = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const alvo = (event.target as HTMLElement).getAttribute?.('data-dia')
    if (!alvo) return
    const mov = proximoFoco(clicaveis, alvo, event.key)
    if (!mov) return
    event.preventDefault()
    if (mov.tipo === 'mes') {
      const destino = mov.passo < 0 ? anterior : proximo
      if (!destino) return
      setFocarPrimeiroDe(destino)
      mostrarMes(destino)
      return
    }
    if (mov.dia === alvo) return
    setFocado({ mes: mesAtual, dia: mov.dia })
    grade.current?.querySelector<HTMLElement>(`[data-dia="${mov.dia}"]`)?.focus()
  }

  const colunas = grid.columns
  const titulo = mesTitulo(mesAtual)

  return (
    <section id={SECAO.calendario} aria-labelledby={TITULO.calendario} className="hub-dr-cartao">
      <div className="hub-dr-cab">
        <div className="hub-dr-titulo-i">
          <h2 id={TITULO.calendario} tabIndex={-1} className="hub-dr-h2">
            {CAL.titulo}
          </h2>
          <InfoButton panelId="info-cal" label={CAL.info} open={infoAberto} onToggle={alternarInfo} />
        </div>
        <div role="group" aria-label={CAL.navegar} className="hub-dr-cal-nav">
          <button
            type="button"
            className="hub-btn hub-btn--icone"
            aria-label={CAL.anterior}
            aria-disabled={!anterior || undefined}
            onClick={() => irPara(anterior)}
          >
            <svg className="hub-dr-cal-seta" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="hub-btn"
            aria-disabled={mesAtual === mesDeHoje || undefined}
            onClick={() => {
              if (mesAtual !== mesDeHoje) irPara(mesDeHoje)
            }}
          >
            {CAL.hoje}
          </button>
          <button
            type="button"
            className="hub-btn hub-btn--icone"
            aria-label={CAL.proximo}
            aria-disabled={!proximo || undefined}
            onClick={() => irPara(proximo)}
          >
            <svg className="hub-dr-cal-seta" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      {infoAberto && <InfoPanel id="info-cal">{comoLerOCalendario(cal.account.market, cal.account.day)}</InfoPanel>}
      <p className="hub-dr-sub">
        {CAL.toque} {valoresEm(cal.account.market, cal.account.currency)}
      </p>
      <div role="status" className="sr-only">
        {statusDoMes(mesAtual)}
      </div>
      <div role="status" className="sr-only">
        {statusDoDia(dia, diaAnunciado)}
      </div>
      <div role="group" aria-label={titulo} className="hub-dr-cal-mes">
        <h3 className="hub-dr-cal-h3">{titulo}</h3>
        <div ref={grade} className={colunas === 7 ? 'hub-dr-cal-grade hub-dr-cal-grade--sete' : 'hub-dr-cal-grade'} onKeyDown={onTecla}>
          {COLUNAS.slice(0, colunas).map((c) => (
            <div key={c} aria-hidden="true" className="hub-dr-cal-col">
              {c}
            </div>
          ))}
          <div aria-hidden="true" className="hub-dr-cal-col hub-dr-cal-col--sem">
            {CAL.semana}
          </div>
          {grid.weeks.map((w, wi) => {
            const ordemBase = wi * (colunas + 1)
            return [
              ...w.cells.map((cell, i) => {
                const mesDay = leituraDoMes?.days.find((x) => x.day === cell.day) ?? null
                return (
                  <CelulaDoDia
                    key={cell.day}
                    cell={cell}
                    texto={celulaDoCalendario(cell, contaDiario, mesDay)}
                    coluna={i}
                    colunas={colunas}
                    ordem={ordemBase + i}
                    aberto={cell.day === dia}
                    parada={cell.day === parada}
                    onAbrir={(day) => {
                      setFocado({ mes: mesAtual, dia: day })
                      abrirDia(day, { anunciar: true })
                    }}
                    onFocar={(day) => setFocado({ mes: mesAtual, dia: day })}
                  />
                )
              }),
              <CelulaDaSemana
                key={`sem-${w.weekOf}`}
                w={w}
                texto={celulaDaSemana(w, contaDiario)}
                ordem={ordemBase + colunas}
                aberta={w.weekOf === semana}
                onAbrir={abrirSemana}
              />,
            ]
          })}
        </div>
      </div>
      <div role="group" aria-label={LEGENDA.grupo} className="hub-dr-cal-legenda">
        <span className="hub-dr-cal-leg-item">
          {LEGENDA.ganho}
          <span className="hub-dr-cal-amostras" aria-hidden="true">
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--g1" />
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--g2" />
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--g3" />
          </span>
        </span>
        <span className="hub-dr-cal-leg-item">
          {LEGENDA.perda}
          <span className="hub-dr-cal-amostras" aria-hidden="true">
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--p1" />
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--p2" />
            <span className="hub-dr-cal-amostra hub-dr-cal-amostra--p3" />
          </span>
        </span>
        <span>
          <span className="hub-tom--amber">●</span> {LEGENDA.fora}
        </span>
        {legenda.limite && (
          <span>
            <span className="hub-tom--red">■</span> {LEGENDA.limite}
          </span>
        )}
        <span>
          <span className="hub-tom--mint">✓</span> {LEGENDA.revisao}
        </span>
        <span>▨ {LEGENDA.historico}</span>
      </div>
    </section>
  )
}

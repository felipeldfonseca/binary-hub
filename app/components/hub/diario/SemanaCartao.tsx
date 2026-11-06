'use client'

import { useMemo, useState } from 'react'
import { monthColumns, monthOf, weekCard, weekOf, type CalendarRead } from '@/lib/domain/diario'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { LOADING, TRY_AGAIN } from '@/components/hub/contas/copy'
import { useDiarioMes } from '@/hooks/useDiario'
import { foraDaSemanaItem, semanaTexto } from '@/lib/hub/diario'
import { mesDaSemana, proximoAnuncio, statusDaSemana, type AnuncioDaSemana, type VistoDaSemana } from '@/lib/hub/diarioMes'
import { useDiarioPagina } from './useDiarioPagina'
import { SECAO, TITULO } from './ids'
import { SEMANA } from './copyMes'

/**
 * «Semana» (lane L1, contract §2.2 J1–J7; boards dez 11a / 11b): the open day's week, or the one tapped in the
 * calendar («Semana aberta abaixo: …», said once, in the calendar's columns). Its title, ⓘ, four tiles, one bar per
 * day and the «Fora do plano» list are lib/hub/diario's semanaTexto and foraDaSemanaItem over lib/domain/diario
 * weekCard (the calendar's SQL sums, ● and the list from the week's diario_mes). That month read is the month shown
 * when the week's Monday is in it, else the week's own (30 nov–4 dez with December shown): its loading and its error
 * are this card's own, not the page's.
 */
export default function SemanaCartao() {
  const { conta, contaDiario, regras, calendario, mesLido, hoje, dia, mes, semana, semanaAnunciada } = useDiarioPagina()
  const [infoAberto, alternarInfo] = useToggle()
  const cal = calendario.data as CalendarRead
  const segunda = semana ?? weekOf(cal.today)
  const mesMostrado = mes ?? monthOf(cal.today)
  const alvo = mesDaSemana(segunda, mesMostrado)

  // J3 (D20): «Semana aberta abaixo: …» when a week cell opens the week, in the calendar's columns (the cell's own range);
  // ended by the next day opened, never said again for a day opened later inside that week (proximoAnuncio)
  const [visto, setVisto] = useState<VistoDaSemana>({ semanaAnunciada, dia })
  const [anuncio, setAnuncio] = useState<AnuncioDaSemana | null>(null)
  if (visto.semanaAnunciada !== semanaAnunciada || visto.dia !== dia) {
    const agora = { semanaAnunciada, dia }
    setVisto(agora)
    setAnuncio(proximoAnuncio(anuncio, visto, agora, monthColumns(cal.account.market, mesMostrado, cal.days)))
  }
  const doProprioMes = useDiarioMes(conta.id, alvo.proprio ? alvo.mes : null, { today: hoje })
  const leitura = alvo.proprio ? doProprioMes : mesLido
  const doMes = leitura.data && leitura.data.month === alvo.mes ? leitura.data : null

  const card = useMemo(
    () => weekCard({ day: segunda, today: cal.today, market: cal.account.market, days: cal.days, weeks: cal.weeks, mesWeeks: doMes?.weeks }),
    [segunda, cal, doMes],
  )
  const texto = semanaTexto(card, contaDiario, { temLimite: !!regras?.limit, temJanela: !!regras?.windows.length })
  const fora = useMemo(
    () =>
      (doMes?.foraTrades ?? [])
        .filter((t) => t.day >= card.weekOf && t.day <= card.lastShown)
        .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
        .map((t) => ({ id: t.tradeId, texto: foraDaSemanaItem(t, contaDiario) })),
    [doMes, card, contaDiario],
  )

  let corpo: React.ReactNode
  if (!doMes && alvo.proprio && doProprioMes.isError) {
    corpo = (
      <div className="hub-dr-sem-erro">
        <p role="alert" className="hub-dr-sem-alerta">
          {SEMANA.erro}
        </p>
        <button
          type="button"
          className="hub-btn"
          onClick={() => {
            void doProprioMes.refetch()
            document.getElementById(TITULO.semana)?.focus()
          }}
        >
          {TRY_AGAIN}
        </button>
      </div>
    )
  } else if (!doMes) {
    // Offline the read waits paused: the same «Carregando…», under the page's «Sem conexão» band
    corpo = (
      <p role="status" className="hub-dr-sub">
        {LOADING}
      </p>
    )
  } else if (texto.vazia) {
    corpo = <p className="hub-dr-sub">{texto.vazia}</p>
  } else {
    corpo = (
      <>
        <div className="hub-dr-tiles">
          {texto.numeros.map((x) => (
            <div key={x.rot} className="hub-dr-tile">
              <span className="hub-dr-rotulo">{x.rot}</span>
              <span className={`hub-dr-valor hub-dr-valor--semana hub-tom--${x.tom}`}>{x.val}</span>
            </div>
          ))}
        </div>
        <div className="hub-dr-sem-corpo">
          <div className="hub-dr-sem-barras-col">
            <div className="hub-dr-sem-barras" aria-hidden="true">
              {card.bars.map((b, i) => {
                const rot = texto.barras[i]
                const cor = b.loss ? 'hub-dr-sem-barra hub-dr-sem-barra--perda' : 'hub-dr-sem-barra'
                return (
                  <div key={b.day} className="hub-dr-sem-dia">
                    <div className="hub-dr-sem-metade hub-dr-sem-metade--cima">
                      <div className={cor} style={{ height: b.net !== null && !b.loss ? b.height : 0 }} />
                    </div>
                    <div className="hub-dr-sem-eixo" />
                    <div className="hub-dr-sem-metade hub-dr-sem-metade--baixo">
                      <div className={cor} style={{ height: b.loss ? b.height : 0 }} />
                    </div>
                    <div className="hub-dr-sem-rot">{rot.rot}</div>
                    <div className="hub-dr-sem-val">
                      <span className="hub-dr-sem-val-longo">{rot.val}</span>
                      <span className="hub-dr-sem-val-curto">{rot.valCurto}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="sr-only">{texto.leitor}</p>
          </div>
          <div className="hub-dr-sem-fora">
            <h3 className="hub-dr-rotulo hub-dr-sem-fora-tit">{SEMANA.fora}</h3>
            {fora.length ? (
              <ul className="hub-dr-sem-lista">
                {fora.map((f) => (
                  <li key={f.id}>{f.texto}</li>
                ))}
              </ul>
            ) : (
              <p className="hub-dr-sub">{SEMANA.semFora}</p>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <section id={SECAO.semana} aria-labelledby={TITULO.semana} className="hub-dr-cartao">
      <div className="hub-dr-cab">
        <div className="hub-dr-titulo-i">
          <h2 id={TITULO.semana} tabIndex={-1} className="hub-dr-h2">
            {SEMANA.titulo}
          </h2>
          <InfoButton panelId="info-semana" label={SEMANA.info} open={infoAberto} onToggle={alternarInfo} />
        </div>
        <span className="hub-dr-sub">{texto.titulo}</span>
      </div>
      {infoAberto && <InfoPanel id="info-semana">{texto.info}</InfoPanel>}
      <div role="status" className="sr-only">
        {statusDaSemana(anuncio, card.weekOf)}
      </div>
      {corpo}
    </section>
  )
}

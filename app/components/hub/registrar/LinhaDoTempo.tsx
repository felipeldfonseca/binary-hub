'use client'

import { useEffect, useRef } from 'react'
import type { ItemTempo } from '@/lib/hub/registrarParciais'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { ABERTA } from './copy'
import { DESFAZER_EV, TEMPO } from './copyParciais'

export interface DesfazerNaLinha {
  /** The item it names */
  evento: { kind: 'parcial' | 'stop'; id: number }
  /** «Desfazer a parcial das 10:18» */
  aria: string
  /** «Até 10:33, 15 minutos depois do registro.» */
  ate: string
  /** The confirmation's question */
  pergunta: string
  aberto: boolean
  ocupado: boolean
  aoAbrir: () => void
  aoConfirmar: () => void
  aoManter: () => void
}

/**
 * «Linha do tempo» (Phase 3c, E16/E17 on step 2, E32 on step 3; RO l.478–485, 574–580): the entry,
 * the partials and the exit at their typed hours, the stop moves at the server's, a told breakeven
 * without time («—», «sem hora»); on step 2 «Desfazer» on the newest partial or move with «Até …»,
 * and its confirmation (focus on «Sim, desfazer»; «Manter» gives it back to the link). While the
 * confirmation is open the link and its «Até …» are not rendered (RO js l.1704).
 */
export default function LinhaDoTempo({ itens, undo, focoLink }: { itens: readonly ItemTempo[]; undo?: DesfazerNaLinha | null; focoLink?: number }) {
  const [info, alternarInfo] = useToggle()
  const linkRef = useRef<HTMLButtonElement>(null)
  const simRef = useRef<HTMLButtonElement>(null)
  const aberto = !!undo?.aberto
  useEffect(() => {
    if (aberto) simRef.current?.focus()
  }, [aberto])
  // «Manter» gives the focus back to the link: each new `focoLink` once (never at mount: a timeline
  // that appears again after an undo and a new partial leaves the focus where the step put it)
  const focoVisto = useRef(focoLink)
  useEffect(() => {
    if (!focoLink || focoLink === focoVisto.current) return
    focoVisto.current = focoLink
    linkRef.current?.focus()
  }, [focoLink])
  const doEvento = (x: ItemTempo) => !!undo && !!x.evento && x.evento.kind === undo.evento.kind && x.evento.id === undo.evento.id
  return (
    <div className="hub-bloco">
      <div className="hub-reg-cab">
        <span id="l-tempo" className="hub-rotulo">
          {TEMPO.rotulo}
        </span>
        <InfoButton panelId="info-tempo" label={TEMPO.infoAria} open={info} onToggle={alternarInfo} />
      </div>
      {info && <InfoPanel id="info-tempo">{TEMPO.info}</InfoPanel>}
      <ol className="hub-rp-tempo" aria-labelledby="l-tempo">
        {itens.map((x) => (
          <li key={x.chave}>
            {x.hora !== null ? (
              <time className="hub-num" dateTime={x.instante ?? undefined}>
                {x.hora}
              </time>
            ) : (
              <span className="hub-rp-sem-hora hub-num">
                <span aria-hidden="true">—</span>
                <span className="sr-only">{TEMPO.semHora}</span>
              </span>
            )}
            <span className="hub-rp-item">
              {x.texto}
              {x.sub && <span className="hub-rp-sub">{x.sub}</span>}
            </span>
            {undo && !aberto && doEvento(x) && (
              <span className="hub-rp-undo">
                <button ref={linkRef} type="button" className="hub-reg-link hub-reg-link--perigo" aria-label={undo.aria} onClick={undo.aoAbrir}>
                  {DESFAZER_EV.link}
                </button>
                <span className="hub-nota">{undo.ate}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {undo && aberto && (
        <div className="hub-reg-confirma" role="group" aria-labelledby="t-desfazer-ev">
          <p id="t-desfazer-ev" className="hub-reg-txt">
            {undo.pergunta}
          </p>
          <div className="hub-acoes">
            <button ref={simRef} type="button" className="hub-btn" aria-disabled={undo.ocupado || undefined} onClick={undo.aoConfirmar}>
              {ABERTA.sim}
            </button>
            <button type="button" className="hub-btn" onClick={undo.aoManter}>
              {ABERTA.manter}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

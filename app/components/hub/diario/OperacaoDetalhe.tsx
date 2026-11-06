'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useDayImages } from '@/hooks/useDiario'
import type { DiaryDayTrade } from '@/lib/hub/diarioDb'
import {
  fatosDaOperacao,
  linhasDaOperacao,
  quandoAnexos,
  quandoNoDia,
  referencia,
  tempoDaOperacao,
  type ContaDaOperacao,
} from '@/lib/hub/diarioOperacao'
import { useAnexos, type AnexosDiario } from '@/components/hub/registrar/ImagensENota'
import { FOLHA } from '@/components/hub/contas/copy'
import ImagensDoDia from './ImagensDoDia'
import MarcasDoDia from './MarcasDoDia'
import { DRILL, IMAGENS, TEMPO_OP } from './copyDia'
import { drillId } from './ids'

export interface GuardaDoDrill {
  /** «Fechar»: leave without saving */
  sair: () => void
  /** «Continuar aqui» */
  ficar: () => void
}

/**
 * The drill of one trade (contract H1–H14; board `.drill`): «Sua operação» (the facts, then the lines), «Linha do
 * tempo da operação» with the breakeven line, «Imagens e nota» and «Suas marcas» (none on a history trade). Every time
 * is relative to the trade's own day (ref = its entry). Holds the drill's hooks: the marks, the images and note editor
 * (the Registrar's, in its Diário variant), the signed URLs (only while open, only with images). Tells the day whether
 * the editor holds unsaved work (the leave guard, H12) and shows «Fechar sem salvar?» when the day asks.
 */
export default function OperacaoDetalhe({
  t,
  conta,
  accountId,
  limiteAtingidoAs,
  aoPendente,
  guarda,
}: {
  t: DiaryDayTrade
  conta: ContaDaOperacao
  accountId: string
  limiteAtingidoAs: Date | null
  aoPendente: (pendente: boolean) => void
  guarda: GuardaDoDrill | null
}) {
  const tid = t.trade.id
  const idBase = `${drillId(tid)}-ax`
  const ref = referencia(t)
  const diario = useMemo<AnexosDiario>(
    () => ({
      idBase,
      quando: (at) => quandoNoDia(at, ref, conta.tz),
      salvo: IMAGENS.salvo,
      removido: IMAGENS.removido,
      aoCancelar: () => focar(temSalvoRef.current ? 'editar' : 'add'),
      aoSalvar: (removeuTudo) => focar(removeuTudo ? 'add' : 'editar'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idBase, ref.getTime(), conta.tz],
  )
  const a = useAnexos(conta.reg, t, { diario })
  const temSalvoRef = useRef(false)
  temSalvoRef.current = t.images.length > 0 || !!t.trade.note
  const focoPedido = useRef<string | null>(null)
  const focar = (qual: 'editar' | 'add') => {
    focoPedido.current = `${idBase}-${qual}`
  }
  // The editor closes in the same render the focus is asked for: the target appears in that commit (or after the
  // day is read again, when a save changed what is saved)
  useEffect(() => {
    const alvo = focoPedido.current
    if (!alvo) return
    const el = document.getElementById(alvo)
    if (el) {
      focoPedido.current = null
      el.focus()
    }
  })

  const paths = useMemo(() => t.images.map((i) => i.path), [t.images])
  const urls = useDayImages(accountId, tid, paths, { enabled: paths.length > 0 })

  useEffect(() => {
    aoPendente(a.pendente)
  }, [a.pendente, aoPendente])
  useEffect(() => () => aoPendente(false), [aoPendente])
  useEffect(() => {
    if (!a.pendente || typeof window === 'undefined') return
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [a.pendente])

  const ficarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (guarda) {
      ficarRef.current?.scrollIntoView?.({ block: 'nearest' })
      ficarRef.current?.focus()
    }
  }, [guarda])

  /** «Continuar aqui»: the editor stays, its «Nota» takes the focus back */
  const ficar = () => {
    guarda?.ficar()
    setTimeout(() => document.getElementById(`${idBase}-nota`)?.focus(), 0)
  }

  const fatos = fatosDaOperacao(t, conta)
  const linhas = linhasDaOperacao(t, conta, { limiteAtingidoAs })
  const tempo = tempoDaOperacao(t, conta)
  const tempoId = `${drillId(tid)}-tempo`

  return (
    <div className="hub-dr-drill-corpo">
      <div className="hub-dr-drill-col">
        <strong>{DRILL.titulo}</strong>
        <dl className="hub-dr-drill-fatos">
          {fatos.map(([rot, val]) => (
            <div key={rot} className="hub-dr-drill-fato">
              <dt>{rot}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
        {linhas.map((l) => (
          <p key={l} className="hub-dr-drill-linha">
            {l}
          </p>
        ))}
      </div>
      {tempo && (
        <div className="hub-dr-drill-col">
          <strong id={tempoId}>{TEMPO_OP.titulo}</strong>
          <ul className="hub-dr-drill-tempo" aria-labelledby={tempoId}>
            {tempo.itens.map((x) => (
              <li key={x.chave}>
                <span className="hub-dr-drill-tempo-hora">{x.hora}</span>
                <span>
                  {x.texto}
                  {x.sub && <span className="hub-dr-op-sub">{x.sub}</span>}
                </span>
              </li>
            ))}
          </ul>
          {tempo.breakeven && <p className="hub-dr-drill-linha">{tempo.breakeven}</p>}
        </div>
      )}
      <ImagensDoDia t={t} a={a} quando={quandoAnexos(t, conta.tz)} idBase={idBase} urls={urls} />
      {guarda && (
        <div
          className="hub-dr-drill-full hub-dr-drill-guarda"
          role="group"
          aria-labelledby={`${idBase}-guarda`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              ficar()
            }
          }}
        >
          <p id={`${idBase}-guarda`} className="hub-dr-drill-guarda-txt">
            {FOLHA.leaveQuestion}
          </p>
          <div className="hub-dr-img-acoes">
            <button type="button" className="hub-btn" onClick={guarda.sair}>
              {FOLHA.leaveYes}
            </button>
            <button ref={ficarRef} type="button" className="hub-btn hub-btn--pri" onClick={ficar}>
              {FOLHA.leaveNo}
            </button>
          </div>
        </div>
      )}
      {!t.history && (
        <div className="hub-dr-drill-full">
          <MarcasDoDia t={t} reg={conta.reg} idBase={idBase} />
        </div>
      )}
    </div>
  )
}

'use client'

import type { StatusSalvar as Status } from '@/lib/hub/rascunho'
import { SALVAR } from './copy'

interface Acoes {
  status: Status
  podeDescartar: boolean
  podeSalvar: boolean
  onDescartar: () => void
  onSalvar: () => void
}

const classeStatus = (s: Status) => (s.tom === 'mudou' ? 'hub-pz-st--mudou' : 'hub-pz-st--ok')

function Botoes({ podeDescartar, podeSalvar, onDescartar, onSalvar }: Omit<Acoes, 'status'>) {
  // aria-disabled keeps them focusable; a click does nothing and the status says why
  return (
    <>
      <button type="button" className="hub-btn" aria-disabled={!podeDescartar} onClick={() => podeDescartar && onDescartar()}>
        {SALVAR.descartar}
      </button>
      <button type="button" className="hub-btn hub-btn--pri" aria-disabled={!podeSalvar} onClick={() => podeSalvar && onSalvar()}>
        {SALVAR.salvar}
      </button>
    </>
  )
}

/** The header's status (the page's only live region for the save) and its two buttons (board .pg-topo) */
export function StatusSalvar(props: Acoes) {
  return (
    <div className="hub-pz-topo-acoes">
      <span role="status" className="hub-pz-status-topo">
        <span className={classeStatus(props.status)}>{props.status.texto}</span>
      </span>
      <Botoes {...props} />
    </div>
  )
}

/**
 * The sticky bar (board .barra): while there are unsaved changes, and right after a save or a
 * discard made from it until focus leaves it. The same status as plain text (the header's status
 * is the live region, so a screen reader hears each change once).
 */
export function BarraSalvar({ visivel, sujo, onSair, ...props }: Acoes & { visivel: boolean; sujo: boolean; onSair: () => void }) {
  if (!visivel) return null
  return (
    <div
      className={sujo ? 'hub-pz-barra hub-pz-barra--mudou' : 'hub-pz-barra'}
      onBlur={(event) => {
        if (!sujo && !event.currentTarget.contains(event.relatedTarget as Node | null)) onSair()
      }}
    >
      <span className={`hub-pz-barra__st ${classeStatus(props.status)}`}>{props.status.texto}</span>
      <div className="hub-acoes">
        <Botoes {...props} />
      </div>
    </div>
  )
}

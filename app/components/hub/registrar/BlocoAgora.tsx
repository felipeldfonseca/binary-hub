'use client'

import type { ModeloAgora } from '@/lib/hub/registrarParciais'
import { AGORA } from './copyParciais'

const TOM: Record<'mint' | 'red' | 'neutral', string> = { mint: 'var(--mint)', red: 'var(--red)', neutral: 'var(--text)' }

/**
 * «Agora» (Phase 3c, E15; RO l.471–477): what is open, the stop now and since when, what the
 * partials realized, and «Se o stop for atingido: … no total.». Shown after a partial or a live move.
 */
export default function BlocoAgora({ modelo }: { modelo: ModeloAgora }) {
  return (
    <div className="hub-bloco hub-rp-agora" role="group" aria-labelledby="l-agora">
      <span id="l-agora" className="hub-rotulo">
        {AGORA.rotulo}
      </span>
      {modelo.linhas.map((l) => (
        <div key={l.rotulo} className="hub-reg-ctx-linha">
          <span className="hub-reg-rot">{l.rotulo}</span>
          {l.valor && (
            <b className="hub-num" style={{ color: TOM[l.tom] }}>
              {l.valor}
            </b>
          )}
          <span>{l.sub}</span>
        </div>
      ))}
      {modelo.seStop && <span className="hub-nota hub-num hub-rp-forte">{modelo.seStop}</span>}
    </div>
  )
}

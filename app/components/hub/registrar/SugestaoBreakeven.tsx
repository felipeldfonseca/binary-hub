'use client'

import { SUGESTAO } from './copyParciais'

/**
 * The breakeven suggestion (Phase 3c, E21; RO l.507): right after a partial that reached the
 * trade's rule with the stop still behind the entry. Never a block: «Mover para o breakeven» opens
 * «Mover stop» on «Breakeven» with the partial's price, and the focus goes to «Registrar stop».
 */
export default function SugestaoBreakeven({ texto, aoMover }: { texto: string; aoMover: () => void }) {
  return (
    <div className="hub-bloco hub-rp-sug">
      <p role="status" className="hub-reg-txt">
        {texto}
      </p>
      <button type="button" className="hub-btn hub-reg-auto" onClick={aoMover}>
        {SUGESTAO.botao}
      </button>
    </div>
  )
}

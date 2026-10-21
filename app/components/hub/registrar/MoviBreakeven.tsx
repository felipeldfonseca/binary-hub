'use client'

import type { ModeloBe } from '@/lib/hub/registrarSaidas'
import { BE_FECHADA } from './copy'
import { Erro, descrito } from './ui'

export interface MoviBreakevenProps {
  /** registrarSaidas.comSaidas's `be` (rendered only when it is not null) */
  be: ModeloBe
  aoAlternar: () => void
  aoMudar: (valor: string) => void
}

/**
 * Phase 3c · «Movi o stop para o breakeven» in «Já fechada» (RO l.411–416, js l.1260–1266,
 * 1433–1437; contract §6.4, E10–E11): the pill (`aria-pressed`, 44 px) with «opcional»; pressed,
 * «Preço quando moveu» (200 px, decimal keyboard), its status (`role=status`, always in the DOM
 * while the field shows: «com +12,00 pts a favor · Sua regra: com +5 pts.») and its error. The
 * caller renders it only with a valid stop (not rendered = off) and moves the focus to the field
 * when the pill turns on.
 */
export default function MoviBreakeven({ be, aoAlternar, aoMudar }: MoviBreakevenProps) {
  return (
    <div className="hub-reg-grupo hub-rs-be">
      <div className="hub-reg-cab hub-reg-cab--inicio">
        <button id="g-be" type="button" className="hub-pill" aria-pressed={be.ligado} onClick={aoAlternar}>
          {BE_FECHADA.pill}
        </button>
        <span className="hub-nota">{BE_FECHADA.opcional}</span>
      </div>
      {be.ligado && (
        <div className="hub-campo">
          <label htmlFor="f-bePreco" className="hub-rot-campo">
            {be.rotulo}
          </label>
          <input
            id="f-bePreco"
            className="hub-entrada hub-entrada--mono hub-reg-entrada hub-reg-curto"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={be.erro ? true : undefined}
            aria-describedby={descrito('n-bePreco', be.erro && 'e-bePreco')}
            value={be.valor}
            onChange={(event) => aoMudar(event.target.value)}
          />
          <span id="n-bePreco" className="hub-nota hub-num" role="status">
            {be.status}
          </span>
          <Erro id="e-bePreco" texto={be.erro} />
        </div>
      )}
    </div>
  )
}

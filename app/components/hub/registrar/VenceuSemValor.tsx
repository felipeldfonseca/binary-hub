'use client'

import type { EstadoVsv } from '@/lib/hub/registrarForm'
import { VSV } from './copy'

/**
 * «Venceu sem valor» (an option's «Já fechada» and step 2; RO l.372, 462, 968–973; copy VSV): the
 * pill (`aria-pressed`; `aria-disabled` when not available, still focusable, and then a press does
 * nothing) and its note («Escolha o vencimento primeiro.» · «Vence hoje às 16:00 ET.» · «Vence em
 * 14 out, às 16:00 ET.»; none when available), which the pill's aria-describedby names. On: exit
 * premium «0» and exit hour 16:00 ET on the account's clock (estado.hora), set by whoever renders it
 * (registrarForm.alternarVsv on step 1, the step's own state on step 2). Lane A renders it above the
 * exit fields when `m.vsv` / `saida.vsv` is not null.
 */
export interface VenceuSemValorProps {
  estado: EstadoVsv
  aoAlternar: () => void
}

export default function VenceuSemValor({ estado, aoAlternar }: VenceuSemValorProps): JSX.Element {
  return (
    <div className="hub-reg-vsv">
      <button
        id="g-vsv-0"
        type="button"
        className="hub-pill"
        aria-pressed={estado.ligado}
        aria-disabled={estado.disponivel ? undefined : true}
        aria-describedby={estado.nota ? 'n-vsv' : undefined}
        onClick={() => {
          if (estado.disponivel) aoAlternar()
        }}
      >
        {VSV.rotulo}
      </button>
      {estado.nota && (
        <span id="n-vsv" className="hub-nota">
          {estado.nota}
        </span>
      )}
    </div>
  )
}

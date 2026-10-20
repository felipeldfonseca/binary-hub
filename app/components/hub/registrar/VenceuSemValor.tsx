'use client'

import type { EstadoVsv } from '@/lib/hub/registrarForm'

/**
 * «Venceu sem valor» (an option's «Já fechada» and step 2; RO l.372, 462, 968–973; copy VSV): the
 * pill (`aria-pressed`; `aria-disabled` when not available, still focusable) and its note
 * (`aria-describedby`; empty when available). On: exit premium «0» and exit hour 16:00 ET on the
 * account's clock (estado.hora). Lane A renders it above the exit fields when `m.vsv` /
 * `saida.vsv` is not null; the toggle is registrarForm.alternarVsv (step 1) or the step's own state.
 *
 * 3-4 lane D stub with the frozen props (mercados34/contrato.md §6.3); lane B builds it.
 */
export interface VenceuSemValorProps {
  estado: EstadoVsv
  aoAlternar: () => void
}

export default function VenceuSemValor(props: VenceuSemValorProps): JSX.Element | null {
  void props
  return null
}

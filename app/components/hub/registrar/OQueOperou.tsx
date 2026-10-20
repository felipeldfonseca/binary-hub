'use client'

import type { TipoEua } from '@/lib/hub/registrarForm'

/**
 * «O que você operou?» (Ações e opções): the pills «Ação ou ETF» / «Opção» (RO l.335, 1146; copy
 * TIPO_EUA). Lane A renders it above the instrument block when the model's `tipoEua` is not null
 * (stocks accounts only; an `options` account is always «Opção»). Switching clears the prices and
 * the quantity (registrarForm.mudarTipoEua).
 *
 * 3-4 lane D stub with the frozen props (mercados34/contrato.md §6.3); lane B builds it.
 */
export interface OQueOperouProps {
  valor: TipoEua
  aoMudar: (v: TipoEua) => void
}

export default function OQueOperou(props: OQueOperouProps): JSX.Element | null {
  void props
  return null
}

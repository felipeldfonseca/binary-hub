'use client'

import type { TipoEua } from '@/lib/hub/registrarForm'
import { TIPO_EUA } from './copy'
import { GrupoPills, type Pill } from './ui'

/**
 * «O que você operou?» (Ações e opções): the pills «Ação ou ETF» / «Opção» (RO l.335, 1146; copy
 * TIPO_EUA). Lane A renders it above the instrument block when the model's `tipoEua` is not null
 * (stocks accounts only; an `options` account is always «Opção»). Switching clears the prices and
 * the quantity (registrarForm.mudarTipoEua, called by whoever renders it).
 *
 * A pill group (`role="group"` labelled by its title, `<button aria-pressed>`), ids `g-tipoEua-0/1`.
 */
export interface OQueOperouProps {
  valor: TipoEua
  aoMudar: (v: TipoEua) => void
}

const OPCOES: readonly Pill<TipoEua>[] = [
  { valor: 'acao', rotulo: TIPO_EUA.acao },
  { valor: 'opcao', rotulo: TIPO_EUA.opcao },
]

export default function OQueOperou({ valor, aoMudar }: OQueOperouProps): JSX.Element {
  return <GrupoPills id="tipoEua" titulo={TIPO_EUA.pergunta} opcoes={OPCOES} valor={valor} aoEscolher={aoMudar} />
}

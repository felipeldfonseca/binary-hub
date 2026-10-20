'use client'

import type { ModeloOpcao, Rascunho } from '@/lib/hub/registrarForm'

/**
 * The option block (Ações e opções, RO l.345–356, 1051–1053, 1126–1127, 1153–1159; copy OPCAO):
 * «Tipo» (Call / Put), «Strike, US$», «Vencimento» («Hoje» or the day, «Sexta, 16 out») and «Outra
 * data» (min = the day). Lane A renders it after the instrument block («Cotada em»/chips), before
 * «Lado», when the model's `opcao` is not null. Changing the expiry turns «Venceu sem valor» off
 * (registrarForm.mudarVencimento).
 *
 * Ids it must render (the focus order, ORDEM_PRECOS): the first «Tipo» pill `g-opTipo-0`, the strike
 * field `f-strike`, the first «Vencimento» pill `g-venc-0`, the date field `f-venc`; errors
 * `e-opTipo`, `e-strike`, `e-venc` (m.erros: the visible ones).
 *
 * 3-4 lane D stub with the frozen props (mercados34/contrato.md §6.3); lane B builds it.
 */
export interface BlocoOpcaoProps {
  m: ModeloOpcao
  aoMudar: (patch: Partial<Pick<Rascunho, 'opTipo' | 'strike' | 'vencimento'>>) => void
}

export default function BlocoOpcao(props: BlocoOpcaoProps): JSX.Element | null {
  void props
  return null
}

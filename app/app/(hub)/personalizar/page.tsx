import type { Metadata } from 'next'
import PersonalizarPagina from '@/components/hub/personalizar/PersonalizarPagina'
import { PERSONALIZAR } from '@/components/hub/contas/copy'

export const metadata: Metadata = {
  title: 'Personalizar · Binary Hub',
}

/**
 * Personalizar: Suas contas (Phase 1), «Quando você opera», «Suas regras» and «Preferências»
 * (Phase 2), with one save bar for the page. The rules load in the browser with the user's session.
 */
export default function PersonalizarPage() {
  return (
    <PersonalizarPagina>
      {/* Takes focus when the control that opened the import sheet is gone */}
      <h1 tabIndex={-1}>{PERSONALIZAR.title}</h1>
      <p className="hub-pg-topo__sub">{PERSONALIZAR.sub}</p>
    </PersonalizarPagina>
  )
}

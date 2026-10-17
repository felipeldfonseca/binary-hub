import type { Metadata } from 'next'
import SuasContas from '@/components/hub/contas/SuasContas'
import { PERSONALIZAR } from '@/components/hub/contas/copy'

export const metadata: Metadata = {
  title: 'Personalizar · Binary Hub',
}

/** Phase 1 shows only "Suas contas"; the other sections of the board arrive in Phase 2. */
export default function PersonalizarPage() {
  return (
    <div className="hub-pagina">
      <div className="hub-pg-topo">
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          {/* Takes focus when the control that opened the import sheet is gone */}
          <h1 tabIndex={-1}>{PERSONALIZAR.title}</h1>
          <p className="hub-pg-topo__sub">{PERSONALIZAR.sub}</p>
          <p className="hub-nota" style={{ marginTop: 6 }}>
            {PERSONALIZAR.phase2}
          </p>
        </div>
      </div>
      <SuasContas />
    </div>
  )
}

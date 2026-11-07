import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiarioTitulo } from '@/components/hub/contas/DiarioCabecalho'
import DiarioPagina from '@/components/hub/diario/DiarioPagina'

export const metadata: Metadata = {
  title: 'Diário · Binary Hub',
}

/**
 * The Diário (Phase 4). Everything private is read in the browser with the user's session: the page reads ?conta=,
 * ?dia=, ?op=, ?importar= and ?registrar= from the URL, so it renders under Suspense (the H1 alone meanwhile).
 */
export default function DiarioPage() {
  return (
    <div className="hub-pagina hub-diario">
      <Suspense fallback={<DiarioTitulo />}>
        <DiarioPagina />
      </Suspense>
    </div>
  )
}

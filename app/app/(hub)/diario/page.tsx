import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import DiarioCabecalho, { DiarioTitulo } from '@/components/hub/contas/DiarioCabecalho'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import OperacoesDoDia from '@/components/hub/diario/OperacoesDoDia'

export const metadata: Metadata = {
  title: 'Diário · Binary Hub',
}

export default function DiarioPage() {
  return (
    <div className="hub-pagina">
      {/* The header reads ?conta=, ?importar= and ?registrar= from the URL */}
      <Suspense fallback={<DiarioTitulo />}>
        <DiarioCabecalho />
      </Suspense>
      {/* «Posso operar hoje?» of the Início board, read in the browser with the user's session */}
      <PossoOperarHojeDiario />
      {/* «Operações do dia» (Phase 3, until the Diário of Phase 4): the current account, from ?conta= too */}
      <Suspense fallback={null}>
        <OperacoesDoDia />
      </Suspense>
      <section className="hub-placeholder">
        <p>O Diário chega na Fase 4.</p>
        <p>Até lá, suas operações continuam na página Operações.</p>
        <Link href="/trades" className="hub-button">
          Abrir Operações
        </Link>
      </section>
    </div>
  )
}

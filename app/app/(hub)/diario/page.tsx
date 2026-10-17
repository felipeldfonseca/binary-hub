import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Diário · Binary Hub',
}

export default function DiarioPage() {
  return (
    <section className="hub-placeholder" aria-labelledby="diario-titulo">
      <h1 id="diario-titulo">Diário</h1>
      <p>O Diário chega na Fase 4.</p>
      <p>Até lá, suas operações continuam na página Operações.</p>
      <Link href="/trades" className="hub-button">
        Abrir Operações
      </Link>
    </section>
  )
}

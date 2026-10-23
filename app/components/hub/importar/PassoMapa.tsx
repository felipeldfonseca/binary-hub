'use client'

/**
 * «mapa» (Phase 3b, lane L1): «Diga o que é cada coluna». B0 placeholder: the final props and the title (E7); lane L1
 * builds the step (contract §5.4, §5.7) and keeps these props.
 */
import type { AccountMarket } from '@/lib/domain/markets'
import type { ArquivoMapeavel, Mapeamento } from '@/lib/hub/importMapeado'
import { MAPA } from '@/components/hub/importar/copyMapa'

export interface PassoMapaProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  arquivo: ArquivoMapeavel
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** What the sheet's one live region says now (E10, E12's nota, E16): called after the change that shows it */
  onAnuncio: (texto: string) => void
}

/** E7: from the names; after «Mudar colunas»; any other model the file does not fit as is */
function titulo(m: Mapeamento): string {
  if (m.origem === 'nomes') return MAPA.titulo
  const nome = m.match.kind === 'none' ? m.nome : m.match.template.name
  return m.mudando ? MAPA.tituloMudar(nome) : MAPA.tituloMudou(nome)
}

export default function PassoMapa({ headingRef, mapeamento }: PassoMapaProps): JSX.Element {
  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {titulo(mapeamento)}
      </h3>
    </div>
  )
}

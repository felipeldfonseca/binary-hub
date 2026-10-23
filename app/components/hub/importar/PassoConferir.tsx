'use client'

/**
 * «conferir» (Phase 3b, lane L1): «Confira 3 linhas». B0 placeholder: the final props and the heading; lane L1 builds
 * the step (contract §5.5, §5.7) and keeps these props.
 */
import type { AccountMarket } from '@/lib/domain/markets'
import type { Mapeamento } from '@/lib/hub/importMapeado'
import { CONFERIR } from '@/components/hub/importar/copyMapa'

export interface PassoConferirProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** E24's nota after an answer */
  onAnuncio: (texto: string) => void
  /**
   * A model taken as is that starts here (inicio 'conferir', porModelo): the sheet's «Mudar colunas»; PassoConferir then
   * renders <ChipModelo> after the order line and no model block (E27). null otherwise
   */
  onMudarColunas: (() => void) | null
}

export default function PassoConferir({ headingRef }: PassoConferirProps): JSX.Element {
  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {CONFERIR.titulo}
      </h3>
    </div>
  )
}

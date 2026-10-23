'use client'

/**
 * The model chip (E34, approved board IC l.366, 1705–1706): «Colunas do modelo “{nome}”» + «Mudar colunas», on «Prévia»
 * (lane L2 places it) and on «conferir» for a model taken as is that still asks (lane L1 places it). Final markup at B0;
 * its row (.hub-ler) is styled by lane L1's hub-importar-mapa.css, the chip and the button by hub.css.
 */
import { CHIP_MODELO } from '@/components/hub/importar/copyMapa'

export interface ChipModeloProps {
  nome: string
  onMudar: () => void
}

export default function ChipModelo({ nome, onMudar }: ChipModeloProps): JSX.Element {
  return (
    <div className="hub-ler">
      <span className="hub-chip-dado">{CHIP_MODELO.texto(nome)}</span>
      <button type="button" className="hub-btn" onClick={onMudar}>
        {CHIP_MODELO.mudar}
      </button>
    </div>
  )
}

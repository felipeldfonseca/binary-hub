'use client'

import type { ModoAberta } from '@/lib/hub/registrarParciais'
import { ACOES } from './copyParciais'
import { GrupoPills } from './ui'

const ROTULO: Record<ModoAberta, string> = { saida: ACOES.saida, parcial: ACOES.parcial, stop: ACOES.stop }

/**
 * «O que registrar agora?» (Phase 3c, E19; RO l.505): Saída · Parcial · Mover stop on a price
 * market's open trade (pills, `aria-pressed`, ids `g-agoraq-{j}`). «Parcial» is not offered while
 * what is open cannot be split. The footer's primary follows the mode.
 */
export default function AcoesAberta({ modos, modo, aoEscolher }: { modos: readonly ModoAberta[]; modo: ModoAberta; aoEscolher: (m: ModoAberta) => void }) {
  return (
    <GrupoPills
      id="agoraq"
      titulo={ACOES.grupo}
      opcoes={modos.map((m) => ({ valor: m, rotulo: ROTULO[m] }))}
      valor={modo}
      aoEscolher={aoEscolher}
    />
  )
}

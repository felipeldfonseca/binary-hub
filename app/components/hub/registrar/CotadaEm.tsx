'use client'

import type { Cotacao } from '@/lib/hub/registrarAtivos'
import type { ModeloEntrada } from '@/lib/hub/registrarForm'
import { COTADA } from './copy'
import { GrupoPills } from './ui'

/**
 * «Cotada em» (Cripto, RO l.344, 1152): «USDT» «USDC» «USD» «R$», described by «USDT e USDC contam
 * como dólar.». Changing it clears the prices (registrarForm.mudarCotacao); «R$» registers BTC/BRL,
 * whose result is typed.
 */
export default function CotadaEm({ m, aoMudar }: { m: NonNullable<ModeloEntrada['cotacao']>; aoMudar: (c: Cotacao) => void }) {
  return (
    <GrupoPills
      id="cot"
      titulo={COTADA.rotulo}
      opcoes={m.opcoes.map((c) => ({ valor: c, rotulo: c }))}
      valor={m.valor}
      aoEscolher={aoMudar}
      descricao="n-cot"
      depois={
        <span id="n-cot" className="hub-nota">
          {m.nota}
        </span>
      }
    />
  )
}

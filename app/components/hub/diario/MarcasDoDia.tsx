'use client'

import { useState } from 'react'
import type { DiaryDayTrade } from '@/lib/hub/diarioDb'
import { marcasDaOperacao, referencia } from '@/lib/hub/diarioOperacao'
import { MARCA_VALORES, valorMarca, type ContaReg } from '@/lib/hub/registrarForm'
import { ABERTA, FECHADA, MARCAS } from '@/components/hub/registrar/copy'
import { useMarcar } from '@/components/hub/registrar/Marcas'
import { InfoButton, InfoPanel } from '@/components/hub/contas/ui'

/**
 * «Suas marcas» in the drill (contract H13; board `t.grupos`): Setup (A B C), Execução and Emoção as pills, each group
 * with its time under its label («às 10:07 · antes da saída», «antes: B às 10:06 · agora: C às 11:20»). One tap = one
 * add_marks call on the server's clock (R useMarcar); the screen reader hears the time relative to the trade's own day
 * («Setup B, 12 nov às 10:42, depois do resultado.»). The phase is the server's (DEV-C4).
 */
export default function MarcasDoDia({ t, reg, idBase }: { t: DiaryDayTrade; reg: ContaReg; idBase: string }) {
  const m = useMarcar(reg, t, { referencia: referencia(t) })
  const [info, setInfo] = useState(false)
  const grupos = marcasDaOperacao(t, reg)
  const infoId = `${idBase}-info-marcas`
  return (
    <div className="hub-dr-drill-marcas">
      <div className="hub-dr-titulo-i">
        <strong className="hub-dr-drill-marcas-tit">{ABERTA.suasMarcas}</strong>
        <InfoButton panelId={infoId} label={FECHADA.marcasInfoAria} open={info} onToggle={() => setInfo((v) => !v)} />
      </div>
      {info && <InfoPanel id={infoId}>{FECHADA.marcasInfo}</InfoPanel>}
      <div className="hub-dr-drill-grupos">
        {grupos.map((g) => {
          const rotId = `${idBase}-mk-${g.kind}`
          const atual = m.valor(g.kind)
          return (
            <div key={g.kind} className="hub-dr-drill-grupo">
              <span id={rotId} className="hub-dr-drill-grupo-rot">
                {g.rotulo}
                {g.tempo && <span className="hub-dr-drill-grupo-tempo">{g.tempo}</span>}
              </span>
              <div role="group" aria-labelledby={rotId} className="hub-dr-drill-pills">
                {MARCA_VALORES[g.kind].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="hub-pill hub-dr-drill-pill"
                    aria-pressed={atual !== null && valorMarca(g.kind, atual) === valorMarca(g.kind, v)}
                    aria-disabled={m.pendente ? true : undefined}
                    onClick={() => void m.marcar(g.kind, v)}
                  >
                    {valorMarca(g.kind, v)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {m.erro && (
        <p className="hub-dr-drill-erro" role="alert">
          {MARCAS.falhou}
        </p>
      )}
      <div role="status" className="sr-only">
        {m.anuncio}
      </div>
    </div>
  )
}

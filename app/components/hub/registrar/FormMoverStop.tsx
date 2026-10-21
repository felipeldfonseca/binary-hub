'use client'

import type { CampoStop, CamposStop, ModeloStop } from '@/lib/hub/registrarParciais'
import { FUTUROS } from './copy'
import { STOP } from './copyParciais'
import { CampoTexto, Erro } from './ui'

/**
 * «Mover stop» (Phase 3c, E25; RO l.545–554): «Para onde?» (Breakeven · entrada | Outro preço),
 * «Novo stop» (Outro preço only), «Preço agora» (required with Breakeven, «· opcional» with Outro
 * preço), the status «Com +8,00 pts a favor. Sua regra: …», «Se o novo stop for atingido: …» and
 * the day's limit warning (`#a-lim-s`, always in the DOM). The move takes the server's time at
 * «Registrar stop». The model is registrarParciais' (modeloMoverStop).
 */
export default function FormMoverStop({
  modelo: m,
  campos: c,
  tentou,
  erroServidor,
  aoMudar,
}: {
  modelo: ModeloStop
  campos: CamposStop
  tentou: boolean
  erroServidor: Partial<Record<CampoStop, string>>
  aoMudar: (patch: Partial<CamposStop>) => void
}) {
  const erro = (k: CampoStop) => erroServidor[k] ?? (tentou ? m.erros[k] ?? null : null)
  const erroModo = erro('sModo')
  return (
    <>
      <div className="hub-reg-grupo">
        <span id="l-para" className="hub-rot-campo">
          {STOP.paraOnde}
        </span>
        <div role="group" aria-labelledby="l-para" aria-describedby={erroModo ? 'e-sModo' : undefined} className="hub-pills">
          {m.opcoes.map((o, j) => (
            <button
              key={o.valor}
              id={`g-sModo-${j}`}
              type="button"
              className="hub-pill"
              aria-pressed={m.modo === o.valor}
              onClick={() => {
                aoMudar({ modo: o.valor })
                if (o.valor === 'outro') requestAnimationFrame(() => document.getElementById('f-sNovo')?.focus())
              }}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        <Erro id="e-sModo" texto={erroModo} />
      </div>
      <div className="hub-campos2">
        {m.modo === 'outro' && (
          <CampoTexto
            id="f-sNovo"
            rotulo={m.rotulos.novo}
            valor={c.novo}
            decimal
            nota={m.avisoLimite ? 'a-lim-s' : undefined}
            aoMudar={(v) => aoMudar({ novo: v })}
            erro={erro('sNovo')}
          />
        )}
        <CampoTexto
          id="f-sAgora"
          rotulo={
            m.agoraOpcional ? (
              <>
                {m.rotulos.agora} <span className="hub-opc">{FUTUROS.opcional}</span>
              </>
            ) : (
              m.rotulos.agora
            )
          }
          valor={c.agora}
          decimal
          aoMudar={(v) => aoMudar({ agora: v })}
          erro={erro('sAgora')}
        />
      </div>
      <div className="hub-linha-i">
        <span className="hub-num" role="status">
          {m.status}
        </span>
      </div>
      {m.seAtingido && (
        <span id="n-sSe" className="hub-nota hub-num hub-rp-se">
          {m.seAtingido}
        </span>
      )}
      <p id="a-lim-s" role="status" className={m.avisoLimite ? 'hub-reg-aviso-lim' : 'sr-only'}>
        {m.avisoLimite ?? ''}
      </p>
    </>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useServerNow } from '@/hooks/useRegistrar'
import type { TradeView } from '@/lib/hub/registrarDb'
import { cartaoFechada, linhaDepois, marcasDivididas, type ContaReg, type MarcaKind } from '@/lib/hub/registrarForm'
import { Disclosure, InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { ABERTA, FECHADA, FOLHA_REG, RODAPE } from './copy'
import ImagensENota, { useAnexos } from './ImagensENota'
import { AvisosMarca, PillsMarca, useMarcar } from './Marcas'
import { PlanoDaOperacao } from './PassoAberta'
import { Rodape, Tempo, useMexido } from './ui'

export interface PassoFechadaProps {
  conta: ContaReg
  view: TradeView
  /** The exit banner, right after this sheet registered the exit (never on a later visit) */
  aviso: { texto: string; atingido: boolean } | null
  /** «Esta operação já foi fechada em outro lugar.» */
  fora: boolean
  headingRef: React.RefObject<HTMLHeadingElement>
  /** «Registrar outra»: what was pending was saved first («Operação anterior: …») */
  aoRegistrarOutra: (anterior: string | null) => void
  aoVerNoDiario: () => void
}

const TOM: Record<'mint' | 'red' | 'neutral', string> = { mint: 'var(--mint)', red: 'var(--red)', neutral: 'var(--text)' }

/**
 * Step 3 · «Operação fechada» (RO l.484–546, 1291–1346): the result, the exit banner, the plan,
 * the marks before the exit and after the result, «Marcar ou mudar», «Imagens e nota», and
 * «Registrar outra» / «Ver no Diário» (both save what is pending first).
 */
export default function PassoFechada({ conta, view, aviso, fora, headingRef, aoRegistrarOutra, aoVerNoDiario }: PassoFechadaProps) {
  const now = useServerNow(60_000)
  const [info, alternarInfo] = useToggle()
  const [editar, alternarEditar] = useToggle()
  const marcar = useMarcar(conta, view)
  const anexos = useAnexos(conta, view)
  const [saindo, setSaindo] = useState(false)
  const saindoRef = useRef(false)
  useMexido(anexos.pendente)

  const t = view.trade
  const cartao = cartaoFechada(conta, t, now)
  const marcas = marcasDivididas(conta, view.marks, now)
  const linha = linhaDepois(conta, t, view.marks, view.context?.origin ?? null)
  const foraDoPlano = view.plan?.verdict === 'fora_do_plano'

  const sair = async (depois: (anterior: string | null) => void) => {
    if (saindoRef.current) return
    saindoRef.current = true
    setSaindo(true)
    try {
      const r = await anexos.salvarPendente()
      if (r.ok) depois(r.anterior)
    } finally {
      saindoRef.current = false
      setSaindo(false)
    }
  }

  return (
    <div className="hub-passo">
      <h3 ref={headingRef} tabIndex={-1}>
        {FECHADA.titulo}
      </h3>
      {fora && (
        <p className="hub-reg-st" role="status">
          {FOLHA_REG.fechadaFora}
        </p>
      )}
      <div className="hub-reg-resultado">
        <span className="hub-reg-res-num" style={{ color: TOM[cartao.tom] }}>
          {cartao.valor}
        </span>
        <span className="hub-nota hub-num">{cartao.linha}</span>
        {cartao.r && (
          <span className="hub-reg-txt">
            <b className="hub-num">{cartao.r.valor}</b> {cartao.r.sub}
          </span>
        )}
      </div>
      {aviso && (
        <p className={aviso.atingido ? 'hub-reg-aviso-lim hub-reg-aviso-lim--atingido' : 'hub-reg-aviso-lim'} role="status">
          {aviso.texto}
        </p>
      )}
      <PlanoDaOperacao view={view} nota={foraDoPlano ? <span className="hub-nota">{FECHADA.conferido}</span> : null} />

      <div className="hub-bloco">
        <div className="hub-reg-cab">
          <span className="hub-rotulo">{ABERTA.suasMarcas}</span>
          <InfoButton panelId="info-marcas" label={FECHADA.marcasInfoAria} open={info} onToggle={alternarInfo} />
        </div>
        {info && <InfoPanel id="info-marcas">{FECHADA.marcasInfo}</InfoPanel>}
        <div className="hub-reg-sub-rot">
          <Tempo texto={FECHADA.antesSaida} tipo="antes" />
        </div>
        {marcas.antes.length > 0 ? (
          <ul className="hub-reg-lista-marcas">
            {marcas.antes.map((m) => (
              <li key={`a-${m.texto}`}>
                <span>
                  {m.texto} <span className="hub-nota">{m.quando}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="hub-nota">{FECHADA.nenhuma}</span>
        )}
        <div className="hub-reg-sub-rot">
          <Tempo texto={FECHADA.depoisResultado} tipo="depois" />
        </div>
        {marcas.depois.length > 0 ? (
          <ul className="hub-reg-lista-marcas">
            {marcas.depois.map((m) => (
              <li key={`d-${m.texto}`}>
                <span>
                  {m.texto} <span className="hub-nota">{m.quando}</span>
                </span>
                {m.historico && <span className="hub-reg-hist">{m.historico}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className="hub-nota">{FECHADA.nenhuma}</span>
        )}
      </div>
      <p className="hub-reg-txt">{linha}</p>
      <div className="hub-reg-col">
        <Disclosure open={editar} controls="editar-marcas" onToggle={alternarEditar}>
          {FECHADA.marcarOuMudar}
        </Disclosure>
        {editar && (
          <div id="editar-marcas" className="hub-reg-editor">
            {(['setup', 'execucao', 'emocao'] as MarcaKind[]).map((k) => (
              <PillsMarca key={k} id={`edit-${k}`} kind={k} valor={marcar.valor(k)} aoEscolher={(v) => void marcar.marcar(k, v)} />
            ))}
          </div>
        )}
      </div>
      <AvisosMarca m={marcar} />
      <ImagensENota a={anexos} />
      <Rodape
        esquerda={{ rotulo: RODAPE.registrarOutra, aoClicar: () => void sair(aoRegistrarOutra), ocupado: saindo }}
        primaria={{ rotulo: RODAPE.verNoDiario, aoClicar: () => void sair(() => aoVerNoDiario()), ocupado: saindo }}
        ocupado={saindo}
      />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import type { AgendaRead, AgendaRow, ReleaseCode, ReleaseMode, Rules } from '@/lib/domain/gate'
import type { RulesSettings } from '@/lib/hub/regras'
import { entendiLido, marcarEntendi, ouvirEntendi } from '@/lib/hub/avisoDados'
import { aplicarAtalho, comBloqueio, escolherDado, restaurarMinutos, voltarAoPadraoDados, type AtalhoDados, type Entidade } from '@/lib/hub/rascunho'
import { Disclosure, InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { DADOS, REGRAS } from './copy'
import { CampoMinutos, Regra, TagOrigem, temPadrao } from './RegrasLinhas'
import { avisoContaAntiga, codigosSeguidos, contaAntiga, estadoDados, gruposDados, resumoDados, statusDados, type GrupoDados } from './regraDados'
import { Interruptor, Pilulas, TagNaoSalvo } from './ui'

type Editar = (fn: (draft: RulesSettings) => RulesSettings) => void

const MODOS: readonly ReleaseMode[] = ['normal', 'volta', 'depois', 'dia']

/**
 * «Dados econômicos» (Phase 5-1; layout A of SPEC §7.1; c3 §3; boards Q01–Q05, Q40–Q43): the switch,
 * the old-account notice, the four ready-made choices (pills, aria-pressed), the minutes with their
 * two lines, the summary, «Escolher dado por dado» by groups (each release a system select), «Voltar ao
 * padrão de Futuros» and the status line «Hoje: …». Everything follows the draft; nothing is saved
 * before «Salvar». Off: only the status line (Q40, no «Voltar ao padrão»).
 */
export default function DadosEconomicos({
  entidade,
  draft,
  salvo,
  mudou,
  onEditar,
  rules,
  agenda,
  proximas,
  onAbrirLista,
  now,
  onIrCalendarios,
}: {
  entidade: Entidade
  draft: RulesSettings
  salvo: RulesSettings
  mudou: boolean
  onEditar: Editar
  /** What the draft resolves to for the entity (resolveRules) */
  rules: Rules
  /** The day's agenda (E5): undefined while it loads, null when it did not load */
  agenda: AgendaRead | null | undefined
  /** Each release's rows from today on, for its next date (null: not read) */
  proximas: readonly AgendaRow[] | null
  /** The list opened: the page reads the next dates */
  onAbrirLista?: () => void
  /** The server's now */
  now: Date
  onIrCalendarios: () => void
}) {
  const [info, toggleInfo] = useToggle()
  const [aberto, alternar, setAberto] = useToggle()
  // «Personalizado» pressed by hand stays pressed until the trader leaves the page (c3 §3.6)
  const [manual, setManual] = useState(false)
  const e = estadoDados(draft, entidade)
  const pressionado: AtalhoDados | 'personalizado' = manual ? 'personalizado' : e.atalho
  const n = codigosSeguidos(e.calendars).length
  const grupos = aberto ? gruposDados(e, proximas, now, rules) : []
  useEffect(() => {
    if (aberto) onAbrirLista?.()
  }, [aberto, onAbrirLista])
  const conta = entidade.tipo === 'conta' ? entidade.conta : null
  // The old account, the first time (c3 §3.9; Q41): an account with rules saved before the delivery
  // (contaAntiga, D4) whose «Entendi» was not pressed on this device (the key is shared with the first wait's notice in «Posso operar hoje?»)
  const [lido, setLido] = useState<boolean | null>(null)
  const contaId = conta?.id ?? null
  useEffect(() => {
    setLido(contaId ? entendiLido(contaId) : true)
    // «Entendi» pressed in another tab («Posso operar hoje?») reaches this rule without a reload
    return contaId ? ouvirEntendi(contaId, setLido) : undefined
  }, [contaId])
  const aviso = !!conta && contaAntiga(conta.versions) && lido === false
  const status = statusDados(e, rules, agenda, now)

  return (
    <Regra
      className="hub-dd-regra"
      nome={
        <>
          <span className="hub-titulo-i">
            <span id="r-dados">{DADOS.nome}</span>
            <InfoButton panelId="info-dados" label={DADOS.infoAria} open={info} onToggle={toggleInfo} />
          </span>
          {(temPadrao(entidade) || mudou) && (
            <span className="hub-dd-tags">
              {temPadrao(entidade) && <TagOrigem propria={e.propria} />}
              {mudou && <TagNaoSalvo />}
            </span>
          )}
        </>
      }
    >
      {info && <InfoPanel id="info-dados">{DADOS.info(e.beforeMin, e.afterMin)}</InfoPanel>}
      <div className="hub-pz-sw-linha">
        <Interruptor ligado={e.on} rotuloId="r-dados" descricaoId="r-dados-hoje" onAlternar={() => onEditar((d) => comBloqueio(d, entidade, { on: !e.on }))} />
        <span className="hub-pz-fraco">{e.on ? REGRAS.ligado : REGRAS.desligado}</span>
      </div>
      {aviso && (
        <div className="hub-pz-quadro hub-dd-aviso" role="note">
          <p>{avisoContaAntiga(e)}</p>
          <div>
            <button
              type="button"
              className="hub-btn"
              onClick={() => {
                marcarEntendi(conta.id)
                setLido(true)
              }}
            >
              {DADOS.entendi}
            </button>
          </div>
        </div>
      )}
      {e.on && (
        <>
          <span id="r-dados-esc" className="hub-pz-sub-rot">
            {DADOS.escolhaRot}
          </span>
          <Pilulas<AtalhoDados | 'personalizado'>
            opcoes={DADOS.atalhos}
            valor={pressionado}
            rotuloId="r-dados-esc"
            className="hub-pills hub-dd-atalhos"
            onEscolher={(v) => {
              if (v === 'personalizado') {
                setManual(true)
                setAberto(true)
                return
              }
              setManual(false)
              onEditar((d) => aplicarAtalho(d, entidade, v))
            }}
          />
          <div className="hub-dd-minutos">
            <div className="hub-pz-campos-l">
              <CampoMinutos
                id="r-antes"
                rotulo={REGRAS.minAntesAria}
                sufixo={REGRAS.minAntes}
                valor={e.beforeMin}
                max={60}
                onValor={(v) => onEditar((d) => comBloqueio(d, entidade, { beforeMin: v }))}
                onVazio={() => onEditar((d) => restaurarMinutos(d, salvo, entidade, 'beforeMin'))}
              />
              <CampoMinutos
                id="r-depois"
                rotulo={REGRAS.minDepoisAria}
                sufixo={REGRAS.minDepois}
                valor={e.afterMin}
                max={120}
                onValor={(v) => onEditar((d) => comBloqueio(d, entidade, { afterMin: v }))}
                onVazio={() => onEditar((d) => restaurarMinutos(d, salvo, entidade, 'afterMin'))}
              />
            </div>
            <div>
              <p className="hub-nota">{DADOS.linhaVolta(e.beforeMin, e.afterMin)}</p>
              <p className="hub-nota">{DADOS.linhaDepois(e.afterMin)}</p>
            </div>
          </div>
          <p className="hub-dd-resumo">{resumoDados(e.modos, e.calendars)}</p>
          <div>
            <Disclosure open={aberto} controls="dados-lista" onToggle={alternar}>
              {DADOS.abrir(n)}
            </Disclosure>
          </div>
          {aberto && (
            <div id="dados-lista" className="hub-dd-lista">
              {grupos.map((g) => (
                <Grupo key={g.id} grupo={g} onEscolher={(code, modo) => onEditar((d) => escolherDado(d, entidade, code, modo))} onIrCalendarios={onIrCalendarios} />
              ))}
            </div>
          )}
          {conta && e.propria && (
            <div>
              <button type="button" className="hub-btn" aria-label={DADOS.voltarAria(conta.label)} onClick={() => onEditar((d) => voltarAoPadraoDados(d, entidade))}>
                {DADOS.voltar}
              </button>
            </div>
          )}
        </>
      )}
      <p id="r-dados-hoje" role="status" className="hub-nota">
        {status}
      </p>
    </Regra>
  )
}

/** One group of «Escolher dado por dado»: a heading and its rows, or one closed line when the trader does not follow its agenda */
function Grupo({ grupo, onEscolher, onIrCalendarios }: { grupo: GrupoDados; onEscolher: (code: ReleaseCode, modo: ReleaseMode) => void; onIrCalendarios: () => void }) {
  if (!grupo.segue) {
    return (
      <div className="hub-dd-fechado">
        <span className="hub-dd-fechado__tit">
          {grupo.titulo}
          {DADOS.naoSegue}
        </span>
        <a
          href="#r-calendarios"
          className="hub-pz-link44"
          onClick={(event) => {
            event.preventDefault()
            onIrCalendarios()
          }}
        >
          {DADOS.calendarios}
          <span aria-hidden="true">{' ›'}</span>
        </a>
      </div>
    )
  }
  return (
    <>
      <h4 className="hub-dd-grupo">{grupo.titulo}</h4>
      <div>
        {grupo.linhas.map((l) => (
          <div key={l.code} className="hub-col-linha hub-dd-linha">
            <div className="hub-col-nome hub-dd-nome">
              <span className="hub-col-tit hub-dd-tit">
                <b>{l.nome}</b>
                {l.propria && <TagOrigem propria />}
              </span>
              <span id={`dd-${l.code}`} className="hub-col-ex">
                {l.proxima}
              </span>
            </div>
            <div className="hub-col-sel">
              <select className="hub-sel" aria-label={DADOS.selAria(l.nome)} aria-describedby={`dd-${l.code}`} value={l.modo} onChange={(event) => onEscolher(l.code, event.target.value as ReleaseMode)}>
                {MODOS.map((m) => (
                  <option key={m} value={m}>
                    {DADOS.modo[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

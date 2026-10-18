'use client'

import { useState } from 'react'
import { STATE_NAMES, type AtLimit, type LimitMode, type OutsideShows, type StateChoice, type StateName } from '@/lib/domain/gate'
import { allowsSoAFavor, parseUsdText, windowError, type AccountConfig, type BlockSetting, type RulesSettings } from '@/lib/hub/regras'
import { dinheiroCompacto } from '@/lib/hub/posso'
import { faixaJanela, resumoDias } from '@/lib/hub/janelas'
import {
  comAoChegar,
  comBloqueio,
  comEscolhaEstado,
  comLimite,
  comModoLimite,
  comRegraJanela,
  comTextoEstado,
  janelasEfetivas,
  restaurarMinutos,
  temProprio,
  type Entidade,
} from '@/lib/hub/rascunho'
import { resumoEstados } from '@/lib/hub/comoFicaHoje'
import { Disclosure, useToggle } from '@/components/hub/contas/ui'
import { ATIVO_NA_FASE_5, ESCOLHA_NOME, ESTADO_NOME, PADRAO_DE_FUTUROS, REGRAS, RELOGIO, SO_NESTA_CONTA } from './copy'
import type { FormLimite } from './PersonalizarProvider'
import { Interruptor, Pilulas, TagNaoSalvo } from './ui'

type Editar = (fn: (draft: RulesSettings) => RulesSettings) => void

/** «padrão de Futuros» / «só nesta conta»: futures accounts only (board `tagDe`, `janTag`) */
function TagOrigem({ propria }: { propria: boolean }) {
  return propria ? (
    <span className="hub-tag hub-tag--propria">{SO_NESTA_CONTA}</span>
  ) : (
    <span className="hub-tag hub-tag--padrao">{PADRAO_DE_FUTUROS}</span>
  )
}

const ehContaFuturos = (e: Entidade) => e.tipo === 'conta' && e.conta.market === 'futures'

function Regra({ nome, children }: { nome: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="hub-pz-regra">
      <div className="hub-pz-regra__nome">{nome}</div>
      <div className="hub-pz-regra__val">{children}</div>
    </li>
  )
}

/** A link to «Quando você opera» that scrolls there and focuses its heading */
function LinkJanelas({ texto, aria, onIr, className = 'hub-pz-link44' }: { texto: string; aria?: string; onIr: () => void; className?: string }) {
  return (
    <a
      href="#janelas"
      className={className}
      aria-label={aria}
      onClick={(event) => {
        event.preventDefault()
        onIr()
      }}
    >
      {texto}
    </a>
  )
}

/** «Janela»: a summary of the windows the entity uses; edited in «Quando você opera» */
export function RegraJanela({ entidade, draft, mudou, onIrJanelas }: { entidade: Entidade; draft: RulesSettings; mudou: boolean; onIrJanelas: () => void }) {
  const { windows, propria } = janelasEfetivas(draft, entidade)
  const tem = windows.length > 0
  return (
    <Regra
      nome={
        <>
          <span>{REGRAS.janela}</span>
          {ehContaFuturos(entidade) && tem && <TagOrigem propria={propria} />}
          {mudou && <TagNaoSalvo />}
        </>
      }
    >
      <div className="hub-pz-regra__linha">
        <span>
          {tem ? (
            windows.map((w, k) => (
              <span key={k}>
                {k > 0 && '; '}
                <span className="hub-pz-num">{faixaJanela(w.startMin, w.endMin)}</span>
                {` ${RELOGIO[w.tz].de} · ${resumoDias(w.weekdays)}`}
              </span>
            ))
          ) : (
            <span className="hub-pz-fraco">{REGRAS.semJanela}</span>
          )}
        </span>
        <LinkJanelas texto={tem ? REGRAS.ajustar : REGRAS.definir} aria={tem ? REGRAS.ajustarAria : REGRAS.definirAria} onIr={onIrJanelas} />
      </div>
    </Regra>
  )
}

/** «Só operar dentro da sua janela» + «Fora da janela, mostrar» */
export function RegraSoDentro({
  entidade,
  draft,
  mudou,
  onEditar,
  onIrJanelas,
}: {
  entidade: Entidade
  draft: RulesSettings
  mudou: boolean
  onEditar: Editar
  onIrJanelas: () => void
}) {
  const market = entidade.tipo === 'padrao' ? 'futures' : entidade.conta.market
  const padrao = draft.markets[market].windowRule
  const own = entidade.tipo === 'conta' ? draft.accounts[entidade.conta.id]?.windowRule : undefined
  const on = own?.on ?? padrao.on
  const outside = own?.outside ?? padrao.outside
  const { windows } = janelasEfetivas(draft, entidade)
  const valida = windows.some((w) => windowError(w) === null)
  return (
    <Regra
      nome={
        <>
          <span id="r-gate">{REGRAS.soDentro}</span>
          {ehContaFuturos(entidade) && <TagOrigem propria={entidade.tipo === 'conta' && temProprio(draft, entidade.conta.id, 'windowRule')} />}
          {mudou && <TagNaoSalvo />}
        </>
      }
    >
      <div className="hub-pz-sw-linha">
        <Interruptor ligado={on} rotuloId="r-gate" onAlternar={() => onEditar((d) => comRegraJanela(d, entidade, { on: !on }))} />
        <span className="hub-pz-fraco">{on ? REGRAS.ligada : REGRAS.desligada}</span>
      </div>
      {on && !valida && (
        <p className="hub-pz-aviso">
          {windows.length ? REGRAS.janelaComErro : REGRAS.semJanelaAviso}{' '}
          <LinkJanelas texto={windows.length ? REGRAS.janelaComErroLink : REGRAS.semJanelaLink} onIr={onIrJanelas} className="hub-pz-aviso__link" />
        </p>
      )}
      {on && (
        <>
          <span id="r-fora" className="hub-pz-sub-rot">
            {REGRAS.foraMostrar}
          </span>
          <Pilulas<OutsideShows>
            opcoes={REGRAS.foraOpcoes}
            valor={outside}
            rotuloId="r-fora"
            onEscolher={(v) => onEditar((d) => comRegraJanela(d, entidade, { outside: v }))}
          />
        </>
      )}
    </Regra>
  )
}

/**
 * Minutes before/after a release: digits only, clamped at once; an emptied field is allowed while
 * typing and goes back to the saved value (the draft takes it at once, the field on blur).
 */
function CampoMinutos({
  id,
  rotulo,
  sufixo,
  valor,
  max,
  onValor,
  onVazio,
}: {
  id: string
  rotulo: string
  sufixo: string
  valor: number
  max: number
  onValor: (n: number) => void
  onVazio: () => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  return (
    <span className="hub-pz-num-grupo">
      <input
        id={id}
        className="hub-pz-campo-num"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={rotulo}
        value={texto ?? String(valor)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          if (digits === '') {
            setTexto('')
            onVazio()
            return
          }
          setTexto(null)
          onValor(Math.min(max, Number(digits)))
        }}
        onBlur={() => setTexto(null)}
      />
      <span aria-hidden="true">{sufixo}</span>
    </span>
  )
}

/** «Bloqueio de dados» (futures): saved and versioned, «ativo na Fase 5» */
export function RegraBloqueio({
  entidade,
  draft,
  salvo,
  mudou,
  onEditar,
}: {
  entidade: Entidade
  draft: RulesSettings
  salvo: RulesSettings
  mudou: boolean
  onEditar: Editar
}) {
  const mb = draft.markets.futures.block ?? { on: true, beforeMin: 5, afterMin: 10 }
  const own: Partial<BlockSetting> = entidade.tipo === 'conta' ? (draft.accounts[entidade.conta.id]?.block ?? {}) : {}
  const b = { on: own.on ?? mb.on, beforeMin: own.beforeMin ?? mb.beforeMin, afterMin: own.afterMin ?? mb.afterMin }
  const hoje = !b.on
    ? REGRAS.bloqDesligado
    : b.beforeMin + b.afterMin === 0
      ? REGRAS.bloqZero
      : draft.calendars.length === 0
        ? REGRAS.bloqSemCalendario
        : REGRAS.bloqFase5
  return (
    <Regra
      nome={
        <>
          <span id="r-bloq">{REGRAS.bloqueio}</span>
          {ehContaFuturos(entidade) && <TagOrigem propria={entidade.tipo === 'conta' && temProprio(draft, entidade.conta.id, 'block')} />}
          {mudou && <TagNaoSalvo />}
        </>
      }
    >
      <div className="hub-pz-sw-linha">
        <Interruptor
          ligado={b.on}
          rotuloId="r-bloq"
          descricaoId="r-bloq-hoje"
          onAlternar={() => onEditar((d) => comBloqueio(d, entidade, { on: !b.on }))}
        />
        <span className="hub-pz-fraco">{b.on ? REGRAS.ligado : REGRAS.desligado}</span>
        <span className="hub-chip-fraco">{ATIVO_NA_FASE_5}</span>
      </div>
      {b.on && (
        <div className="hub-pz-campos-l">
          <CampoMinutos
            id="r-antes"
            rotulo={REGRAS.minAntesAria}
            sufixo={REGRAS.minAntes}
            valor={b.beforeMin}
            max={60}
            onValor={(n) => onEditar((d) => comBloqueio(d, entidade, { beforeMin: n }))}
            onVazio={() => onEditar((d) => restaurarMinutos(d, salvo, entidade, 'beforeMin'))}
          />
          <CampoMinutos
            id="r-depois"
            rotulo={REGRAS.minDepoisAria}
            sufixo={REGRAS.minDepois}
            valor={b.afterMin}
            max={120}
            onValor={(n) => onEditar((d) => comBloqueio(d, entidade, { afterMin: n }))}
            onVazio={() => onEditar((d) => restaurarMinutos(d, salvo, entidade, 'afterMin'))}
          />
        </div>
      )}
      <p id="r-bloq-hoje" role="status" className="hub-nota">
        {hoje}
      </p>
    </Regra>
  )
}

/** '400', '400,50': what the limit field shows for a saved amount */
function textoDoValor(cents: number): string {
  const inteiro = Math.floor(cents / 100)
  const resto = cents % 100
  return resto ? `${inteiro},${String(resto).padStart(2, '0')}` : String(inteiro)
}

/** «Limite do dia»: per account (never inherited); «Padrão Futuros» only says so */
export function RegraLimite({
  entidade,
  draft,
  mudou,
  futuros,
  form,
  onForm,
  onEditar,
  pedirFoco,
}: {
  entidade: Entidade
  draft: RulesSettings
  mudou: boolean
  /** Active futures accounts («Soma a, b e c») */
  futuros: readonly AccountConfig[]
  form: FormLimite | null
  onForm: (f: FormLimite | null) => void
  onEditar: Editar
  pedirFoco: (id: string) => void
}) {
  if (entidade.tipo === 'padrao') {
    return (
      <Regra nome={<span id="r-lim">{REGRAS.limite}</span>}>
        <p className="hub-pz-fraco">{REGRAS.limitePorConta}</p>
      </Regra>
    )
  }
  const conta = entidade.conta
  const lim = draft.accounts[conta.id]?.limit ?? null
  const fut = conta.market === 'futures'
  const verbo = lim ? REGRAS.mudarLimite : REGRAS.definirLimite
  const aria = lim ? REGRAS.mudarLimiteAria(conta.label) : REGRAS.definirLimiteAria(conta.label)

  const fechar = () => {
    onForm(null)
    pedirFoco('lim-def')
  }
  const ok = () => {
    if (!form) return
    const r = parseUsdText(form.texto)
    if (!r.ok) {
      onForm({ ...form, erro: r.reason })
      pedirFoco('lim-valor')
      return
    }
    onEditar((d) => comLimite(d, conta.id, r.cents))
    fechar()
  }

  const mostrarModo = !!lim && fut && (futuros.length >= 2 || lim.mode === 'soma')
  return (
    <Regra
      nome={
        <>
          <span id="r-lim">{REGRAS.limite}</span>
          {lim && fut && <span className="hub-tag hub-tag--propria">{SO_NESTA_CONTA}</span>}
          {mudou && <TagNaoSalvo />}
        </>
      }
    >
      <div className="hub-pz-regra__linha">
        <span className={lim ? 'hub-pz-num' : 'hub-pz-fraco'}>{lim ? dinheiroCompacto(lim.cents, 'USD' /* lane B: currency */) : REGRAS.semLimite}</span>
        <button
          id="lim-def"
          type="button"
          className="hub-btn"
          aria-expanded={!!form}
          aria-controls="lim-form"
          aria-label={aria}
          onClick={() => {
            if (form) {
              onForm(null)
              return
            }
            onForm({ id: conta.id, texto: lim ? textoDoValor(lim.cents) : '', erro: null })
            pedirFoco('lim-valor')
          }}
        >
          {verbo}
        </button>
      </div>
      {form && (
        <div id="lim-form" className="hub-form-inline">
          <div className="hub-pz-form-linha">
            <div className="hub-campo hub-pz-campo-lim">
              <label htmlFor="lim-valor" className="hub-rot-campo">
                {REGRAS.limiteCampo}
              </label>
              <input
                id="lim-valor"
                className="hub-entrada hub-entrada--mono"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.texto}
                aria-invalid={!!form.erro}
                aria-describedby={form.erro ? 'lim-erro' : undefined}
                onChange={(event) => onForm({ ...form, texto: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    ok()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    fechar()
                  }
                }}
              />
            </div>
            <button type="button" className="hub-btn hub-btn--pri" onClick={ok}>
              {REGRAS.ok}
            </button>
            <button type="button" className="hub-btn" onClick={fechar}>
              {REGRAS.cancelar}
            </button>
          </div>
          {form.erro && (
            <p id="lim-erro" className="hub-erro" role="alert">
              {REGRAS.limiteErro(form.erro, 'USD' /* lane B: currency */)}
            </p>
          )}
          {lim && (
            <div>
              <button
                type="button"
                className="hub-btn"
                onClick={() => {
                  onEditar((d) => comLimite(d, conta.id, null))
                  fechar()
                }}
              >
                {REGRAS.ficarSemLimite}
              </button>
            </div>
          )}
        </div>
      )}
      {mostrarModo && lim && (
        <>
          <Pilulas<LimitMode>
            opcoes={REGRAS.modos}
            valor={lim.mode}
            rotulo={REGRAS.modoAria(conta.label)}
            onEscolher={(v) => {
              // With one futures account the pills go away once back on «por conta»: focus stays on the row
              if (v === 'conta' && futuros.length < 2) pedirFoco('lim-def')
              onEditar((d) => comModoLimite(d, conta.id, v))
            }}
          />
          {lim.mode === 'soma' && (
            <p className="hub-nota">{futuros.length >= 2 ? REGRAS.soma(futuros.map((a) => a.label)) : REGRAS.somaUma}</p>
          )}
        </>
      )}
      {lim && (
        <>
          <span id="r-ao" className="hub-pz-sub-rot">
            {REGRAS.aoChegar}
          </span>
          <Pilulas<AtLimit>
            opcoes={REGRAS.aoChegarOpcoes}
            valor={lim.atLimit}
            rotuloId="r-ao"
            onEscolher={(v) => onEditar((d) => comAoChegar(d, conta.id, v))}
          />
        </>
      )}
    </Regra>
  )
}

const CHIP_ESTADO: Record<StateName, string> = {
  alinhadas: 'hub-pz-est-chip--al',
  so_tecnica: 'hub-pz-est-chip--so',
  so_fundamentos: 'hub-pz-est-chip--so',
  em_conflito: 'hub-pz-est-chip--conf',
  sem_direcao: 'hub-pz-est-chip--sem',
}

/** «Regra por estado» (futures, one for the market): saved; choices version, texts never; «ativo na Fase 5» */
export function RegraEstado({ draft, mudou, onEditar }: { draft: RulesSettings; mudou: boolean; onEditar: Editar }) {
  const [aberto, alternar] = useToggle()
  const states = draft.markets.futures.states
  const resumo = resumoEstados(Object.fromEntries(STATE_NAMES.map((k) => [k, states[k]?.choice ?? null])))
  return (
    <Regra
      nome={
        <>
          <span>{REGRAS.estado}</span>
          <span className="hub-tag hub-tag--todas">{REGRAS.todasFuturos}</span>
          {mudou && <TagNaoSalvo />}
          <span className="hub-chip-fraco">{ATIVO_NA_FASE_5}</span>
        </>
      }
    >
      <div className="hub-pz-regra__linha">
        <span className={resumo ? undefined : 'hub-pz-fraco'}>{resumo || REGRAS.nenhumaEscolha}</span>
      </div>
      <div>
        <Disclosure open={aberto} controls="est-lista" onToggle={alternar}>
          {aberto ? REGRAS.fechar : REGRAS.escolher}
        </Disclosure>
      </div>
      {aberto && (
        <div id="est-lista" className="hub-pz-est-lista">
          {STATE_NAMES.map((k) => {
            const nome = ESTADO_NOME[k]
            const st = states[k]
            const opcoes = (['opero', 'so_a_favor', 'nao_opero'] as const)
              .filter((c) => c !== 'so_a_favor' || allowsSoAFavor(k))
              .map((c) => ({ valor: c, texto: ESCOLHA_NOME[c] }))
            return (
              <div key={k} className="hub-pz-est">
                <label htmlFor={`est-${k}`} className={`hub-pz-est-chip ${CHIP_ESTADO[k]}`}>
                  {nome}
                </label>
                <Pilulas<StateChoice>
                  opcoes={opcoes}
                  valor={st?.choice ?? null}
                  rotulo={REGRAS.estadoGrupoAria(nome)}
                  onEscolher={(c) => onEditar((d) => comEscolhaEstado(d, k, c))}
                />
                <textarea
                  id={`est-${k}`}
                  className="hub-pz-ta"
                  rows={2}
                  maxLength={500}
                  placeholder={k === 'alinhadas' ? REGRAS.estadoPlaceholderAlinhadas : REGRAS.estadoPlaceholder}
                  value={st?.text ?? ''}
                  onChange={(event) => onEditar((d) => comTextoEstado(d, k, event.target.value))}
                />
              </div>
            )
          })}
        </div>
      )}
    </Regra>
  )
}

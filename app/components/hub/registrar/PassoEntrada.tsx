'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAfterPreview, useEntryPreview, useGateAt, useRegisterAfter, useRegisterEntry, useServerNow } from '@/hooks/useRegistrar'
import { addDays } from '@/lib/domain/tempo'
import type { GateResult, Rules } from '@/lib/domain/gate'
import { groupByMarket, type TradingAccount } from '@/lib/hub/contas'
import type { AccountNow } from '@/lib/hub/regras'
import { janelaLinha, type Tom } from '@/lib/hub/posso'
import { avisoDoLimite, FUTURES_CHIPS, type AvisoDoLimite, type RegistrarDefaults } from '@/lib/hub/registrar'
import { RegistrarDataError, type RegistrarErrorCode } from '@/lib/hub/registrarDb'
import { formatDecimal } from '@/lib/hub/numero'
import { formatDiaMes } from '@/lib/hub/formato'
import {
  DURACOES_EBINEX,
  avisoLimiteEntrada,
  descricaoSimilar,
  horaRel,
  linhaGate,
  linhaLimite,
  modeloEntrada,
  perguntaGate,
  quebrasDoGate,
  rascunhoMexido,
  textoQuebras,
  type CampoEntrada,
  type ContaReg,
  type MarcaKind,
  type ModeloEntrada,
  type Rascunho,
} from '@/lib/hub/registrarForm'
import { MARKET_LABEL, PHASE_LABEL } from '@/components/hub/contas/copy'
import { Disclosure, InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { EBINEX, ENTRADA, ERRO_REGISTRAR, ERROS, FUTUROS, GATE, MARCAS, NEVER_SUMMED, RODAPE, SIMILAR } from './copy'
import { PillsMarca } from './Marcas'
import { CampoTexto, Erro, GrupoPills, PlanoPill, Rodape, descrito, useMexido } from './ui'

// ------------------------------------------------------------------------------------------------
// The context block: the account, «Posso operar hoje?», «Limite do dia» (RO l.325–332)
// ------------------------------------------------------------------------------------------------

const COR: Record<Tom, string> = { mint: 'var(--mint)', amber: 'var(--amber)', red: 'var(--red-fill)', neutral: 'var(--text)', muted: 'var(--text-2)' }

export interface GateMostrado {
  pergunta: string
  /** null: nothing answered yet; 'falhou': «Não foi possível conferir agora.» */
  linha: ReturnType<typeof linhaGate> | 'falhou' | null
  limite: { usado: string; de: string } | null
}

export function ContextoConta({
  conta,
  contas,
  aoTrocar,
  janela,
  gate,
  mostrarGate,
  info,
}: {
  conta: ContaReg
  /** The accounts the sheet can register on (the chip is a button when there are two or more) */
  contas: readonly TradingAccount[]
  aoTrocar: ((id: string) => void) | null
  janela: string
  gate: GateMostrado
  /** false on a refused «Dia» (board choice 11) */
  mostrarGate: boolean
  info: string
}) {
  const [infoAberto, alternarInfo] = useToggle()
  const [lista, setLista] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (lista) listaRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }, [lista])
  const fechar = () => {
    setLista(false)
    botaoRef.current?.focus()
  }
  const trocavel = !!aoTrocar && contas.length > 1
  return (
    <div className="hub-reg-contexto">
      <div className="hub-reg-ctx-linha">
        <span className="hub-reg-rot">{ENTRADA.conta}</span>
        {trocavel ? (
          <button
            ref={botaoRef}
            type="button"
            className="hub-chip-dado hub-reg-chip-botao"
            aria-expanded={lista}
            aria-controls="reg-contas"
            aria-label={ENTRADA.trocarConta(conta.label)}
            onClick={() => setLista((v) => !v)}
          >
            {conta.label}
            <span aria-hidden="true">▾</span>
          </button>
        ) : (
          <span className="hub-chip-dado">{conta.label}</span>
        )}
        <span className="hub-nota">{janela}</span>
      </div>
      {trocavel && lista && (
        <div
          id="reg-contas"
          ref={listaRef}
          className="hub-reg-menu-conta"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              fechar()
            }
          }}
        >
          {groupByMarket(contas).map((g) => (
            <Fragment key={g.market}>
              <span className="hub-rotulo">{MARKET_LABEL[g.market]}</span>
              {g.accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="hub-pill"
                  aria-pressed={a.id === conta.id}
                  onClick={() => {
                    setLista(false)
                    if (a.id !== conta.id) aoTrocar?.(a.id)
                    else botaoRef.current?.focus()
                  }}
                >
                  {a.phase ? `${a.label} · ${PHASE_LABEL[a.phase]}` : a.label}
                </button>
              ))}
            </Fragment>
          ))}
          <span className="hub-nota">{NEVER_SUMMED}</span>
        </div>
      )}
      {mostrarGate && (
        <>
          <div className="hub-reg-ctx-linha">
            {gate.linha === 'falhou' ? (
              <>
                <span className="hub-reg-ponto" aria-hidden="true" style={{ background: COR.muted }} />
                <span className="hub-reg-rot">{GATE.pergunta}</span>
                <span className="hub-reg-muted">{GATE.naoConferido}</span>
              </>
            ) : gate.linha ? (
              <>
                <span className="hub-reg-ponto" aria-hidden="true" style={{ background: COR[gate.linha.tom] }} />
                <span className="hub-reg-rot">{gate.pergunta}</span>
                <b>{gate.linha.palavra}</b>
                {gate.linha.sub && <span>{gate.linha.sub}</span>}
                {gate.linha.acao && (
                  <Link href={gate.linha.acao.href} className="hub-reg-link" aria-label={gate.linha.acao.aria}>
                    {gate.linha.acao.texto}
                  </Link>
                )}
              </>
            ) : (
              <span className="hub-reg-rot">{gate.pergunta}</span>
            )}
            <InfoButton panelId="info-gate" label={GATE.infoAria} open={infoAberto} onToggle={alternarInfo} />
          </div>
          {infoAberto && <InfoPanel id="info-gate">{info}</InfoPanel>}
          {gate.limite && (
            <div className="hub-reg-ctx-linha">
              <span className="hub-reg-rot">{ENTRADA.limite}</span>
              <b className="hub-num">{gate.limite.usado}</b>
              <span>{gate.limite.de}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// The fields
// ------------------------------------------------------------------------------------------------

interface CamposProps {
  conta: ContaReg
  r: Rascunho
  m: ModeloEntrada
  /** Errors on screen (local, or the server's refusal of a field) */
  erros: Partial<Record<CampoEntrada, string>>
  mudar: (patch: Partial<Rascunho>, foco?: string) => void
  aviso: string | null
  sufixoCampo: string
}

/** «Ativo», «Lado», «Contratos», prices, hours, «Stop e alvo» (RO l.336–388) */
export function CamposFuturos({ r, m, erros, mudar, aviso, sufixoCampo }: CamposProps) {
  const fechada = r.modo === 'fechada'
  const chips = (FUTURES_CHIPS as readonly string[]).includes(r.ativo ?? '') ? [...FUTURES_CHIPS] : [...FUTURES_CHIPS, r.ativo ?? 'MES']
  return (
    <>
      <GrupoPills
        id="ativo"
        titulo={FUTUROS.ativo}
        opcoes={chips.map((s) => ({ valor: s, rotulo: s }))}
        valor={r.ativo}
        aoEscolher={(s) => {
          if (s !== r.ativo) mudar({ ativo: s, preco: '', stop: '', alvo: '', precoSaida: '' })
        }}
      />
      <GrupoPills
        id="lado"
        titulo={FUTUROS.lado}
        opcoes={[
          { valor: 'long', rotulo: FUTUROS.compra },
          { valor: 'short', rotulo: FUTUROS.venda },
        ]}
        valor={r.lado}
        aoEscolher={(v) => mudar({ lado: v as 'long' | 'short' })}
        descricao={erros.lado ? 'e-lado' : undefined}
        depois={<Erro id="e-lado" texto={erros.lado} />}
      />
      <GrupoPills
        id="q"
        titulo={FUTUROS.contratos}
        opcoes={[
          { valor: '1', rotulo: '1' },
          { valor: '2', rotulo: '2' },
          { valor: '3', rotulo: '3' },
          { valor: 'outro', rotulo: FUTUROS.outro },
        ]}
        pillClasse="hub-reg-pill-q"
        valor={r.qtdOutro ? 'outro' : r.qtd}
        aoEscolher={(v) => (v === 'outro' ? mudar({ qtdOutro: true, qtd: r.qtdOutro ? r.qtd : '' }, 'f-q') : mudar({ qtdOutro: false, qtd: v }))}
        depois={
          <>
            {r.qtdOutro && (
              <CampoTexto
                id="f-q"
                rotulo={FUTUROS.quantos}
                valor={r.qtd}
                decimal
                aoMudar={(v) => mudar({ qtd: v })}
                erro={erros.q}
                estilo={{ maxWidth: 200 }}
              />
            )}
            {!r.qtdOutro && <Erro id="e-q" texto={erros.q} />}
          </>
        }
      />
      <div className="hub-campos2">
        <CampoTexto id="f-preco" rotulo={FUTUROS.preco} valor={r.preco} decimal aoMudar={(v) => mudar({ preco: v })} erro={erros.preco} />
        <CampoTexto
          id="f-hora"
          rotulo={fechada ? FUTUROS.horaEntrada(sufixoCampo) : FUTUROS.hora(sufixoCampo)}
          valor={m.horaCampo}
          tipo="time"
          aoMudar={(v) => mudar({ hora: v })}
          erro={erros.hora}
        />
      </div>
      {fechada && (
        <div className="hub-campos2">
          <CampoTexto id="f-spreco" rotulo={FUTUROS.precoSaida} valor={r.precoSaida} decimal aoMudar={(v) => mudar({ precoSaida: v })} erro={erros.spreco} />
          <CampoTexto id="f-shora" rotulo={FUTUROS.horaSaida(sufixoCampo)} valor={m.horaSaidaCampo} tipo="time" aoMudar={(v) => mudar({ horaSaida: v })} erro={erros.shora} />
        </div>
      )}
      <div className="hub-campo">
        <span id="l-stop" className="hub-rot-campo">
          {FUTUROS.stopAlvo} <span className="hub-opc">{FUTUROS.opcional}</span>
        </span>
        <div className="hub-campos2 hub-reg-sempre" role="group" aria-labelledby="l-stop">
          <CampoTexto
            id="f-stop"
            rotulo={FUTUROS.stop}
            valor={r.stop}
            decimal
            aoMudar={(v) => mudar({ stop: v })}
            erro={erros.stop}
            nota={descrito('n-risco', aviso && 'a-lim')}
          />
          <CampoTexto id="f-alvo" rotulo={FUTUROS.alvo} valor={r.alvo} decimal aoMudar={(v) => mudar({ alvo: v })} erro={erros.alvo} nota="n-risco" />
        </div>
        <span id="n-risco" className="hub-nota hub-num">
          {m.linhaRisco}
        </span>
        {/* Always on the page, so a screen reader hears it when it appears and when it changes (v55) */}
        <p id="a-lim" role="status" className={aviso ? 'hub-reg-aviso-lim' : 'sr-only'}>
          {aviso ?? ''}
        </p>
      </div>
    </>
  )
}

/** «Par», «Direção», «Expiração», stake, payout, hour, «Como terminou?» (RO l.390–406) */
export function CamposEbinex({
  r,
  m,
  erros,
  mudar,
  aviso,
  sufixoCampo,
  pares,
  aoEscolherPar,
}: CamposProps & { pares: readonly string[]; aoEscolherPar: (par: string | null) => void }) {
  const fechada = r.modo === 'fechada'
  const [infoExp, alternarInfoExp] = useToggle()
  const parOpcoes = [...pares.slice(0, 5).map((p) => ({ valor: p, rotulo: p })), { valor: '__outro', rotulo: EBINEX.outroPar }]
  return (
    <>
      <GrupoPills
        id="par"
        titulo={EBINEX.par}
        opcoes={parOpcoes}
        valor={r.parOutro ? '__outro' : r.par}
        aoEscolher={(v) => aoEscolherPar(v === '__outro' ? null : v)}
        depois={
          <>
            {r.parOutro && (
              <CampoTexto
                id="f-parOutro"
                rotulo={EBINEX.outroPar}
                valor={r.parTexto}
                placeholder={EBINEX.outroParPh}
                aoMudar={(v) => mudar({ parTexto: v })}
                erro={erros.par}
                estilo={{ maxWidth: 200 }}
              />
            )}
            {!r.parOutro && <Erro id="e-par" texto={erros.par} />}
          </>
        }
      />
      <GrupoPills
        id="dir"
        titulo={EBINEX.direcao}
        opcoes={[
          { valor: 'call', rotulo: EBINEX.alta },
          { valor: 'put', rotulo: EBINEX.baixa },
        ]}
        valor={r.direcao}
        aoEscolher={(v) => mudar({ direcao: v as 'call' | 'put' })}
        descricao={erros.dir ? 'e-dir' : undefined}
        depois={<Erro id="e-dir" texto={erros.dir} />}
      />
      <GrupoPills
        id="exp"
        titulo={EBINEX.expiracao}
        extra={<InfoButton panelId="info-exp" label={EBINEX.expInfoAria} open={infoExp} onToggle={alternarInfoExp} />}
        opcoes={DURACOES_EBINEX.map((d) => ({ valor: d, rotulo: EBINEX.minutos(d / 60) }))}
        valor={r.duracao}
        aoEscolher={(d) => mudar({ duracao: d, resultado: null })}
        descricao={descrito(m.venceTxt && 'n-venc', erros.exp && 'e-exp')}
        depois={
          <>
            {infoExp && <InfoPanel id="info-exp">{EBINEX.expInfo}</InfoPanel>}
            {m.venceTxt && (
              <span id="n-venc" className="hub-nota">
                {m.venceTxt}
              </span>
            )}
            <Erro id="e-exp" texto={erros.exp} />
          </>
        }
      />
      <div className="hub-campos2 hub-reg-sempre">
        <CampoTexto
          id="f-stake"
          rotulo={EBINEX.stake}
          valor={r.stake}
          decimal
          aoMudar={(v) => mudar({ stake: v })}
          erro={erros.stake}
          nota={descrito('n-payout', aviso && 'a-lim')}
        />
        <CampoTexto id="f-payout" rotulo={EBINEX.payout} valor={r.payout} decimal aoMudar={(v) => mudar({ payout: v })} erro={erros.payout} nota="n-payout" />
      </div>
      <CampoTexto
        id="f-hora"
        rotulo={fechada ? EBINEX.horaEntrada(sufixoCampo) : EBINEX.hora(sufixoCampo)}
        valor={m.horaCampo}
        tipo="time"
        aoMudar={(v) => mudar({ hora: v })}
        erro={erros.hora}
        estilo={{ maxWidth: 200 }}
      />
      <span id="n-payout" className="hub-nota hub-num">
        {m.linhaBinaria}
      </span>
      <p id="a-lim" role="status" className={aviso ? 'hub-reg-aviso-lim' : 'sr-only'}>
        {aviso ?? ''}
      </p>
      {fechada && (
        <GrupoPills
          id="fimB"
          titulo={EBINEX.comoTerminou}
          opcoes={(['ganho', 'perda', 'devolvida'] as const).map((o) => ({ valor: o, rotulo: EBINEX[o], desligada: !m.vencido }))}
          valor={r.resultado}
          aoEscolher={(o) => {
            if (m.vencido) mudar({ resultado: o })
          }}
          descricao={descrito(m.venceTxt && 'n-venc', erros.fimB && 'e-fimB')}
          depois={<Erro id="e-fimB" texto={erros.fimB} />}
        />
      )}
    </>
  )
}

/** «Como está o setup?» and «Execução da entrada» / «Execução e emoção» (RO l.416–435) */
export function MarcasEntrada({ r, m, mudar }: { r: Rascunho; m: ModeloEntrada; mudar: (patch: Partial<Rascunho>) => void }) {
  const [info, alternarInfo] = useToggle()
  const fechada = r.modo === 'fechada'
  const tocar = (kind: MarcaKind, v: string) => {
    const marcas = { ...r.marcas }
    if (marcas[kind] === v) delete marcas[kind]
    else marcas[kind] = v
    mudar({ marcas })
  }
  const mais: MarcaKind[] = fechada ? ['execucao', 'emocao'] : ['execucao']
  return (
    <>
      <div className={m.jaFoi ? 'hub-reg-toque hub-reg-toque--depois' : 'hub-reg-toque'}>
        <PillsMarca
          id="setup"
          kind="setup"
          titulo={m.jaFoi ? MARCAS.setupTitDepois : MARCAS.setupTit}
          tituloClasse="hub-reg-toque-tit"
          extra={<InfoButton panelId="info-setup" label={MARCAS.setupInfoAria} open={info} onToggle={alternarInfo} />}
          painel={info ? <InfoPanel id="info-setup">{MARCAS.setupInfo}</InfoPanel> : null}
          valor={r.marcas.setup ?? null}
          aoEscolher={(v) => tocar('setup', v)}
          descricao="c-setup"
          chip={{ texto: m.jaFoi ? MARCAS.depoisResultado : MARCAS.agoraAntes, tipo: 'fraco' }}
        />
        {m.jaFoi && <p className="hub-reg-txt">{MARCAS.jaFoi}</p>}
      </div>
      <div className="hub-reg-col">
        <Disclosure open={r.maisAberto} controls="mais-marcas" onToggle={() => mudar({ maisAberto: !r.maisAberto })}>
          {fechada ? MARCAS.maisFechada : MARCAS.maisEntrada}
        </Disclosure>
        {r.maisAberto && (
          <div id="mais-marcas" className="hub-reg-editor">
            {mais.map((k) => (
              <PillsMarca key={k} id={`mais-${k}`} kind={k} valor={r.marcas[k] ?? null} aoEscolher={(v) => tocar(k, v)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ------------------------------------------------------------------------------------------------
// The step
// ------------------------------------------------------------------------------------------------

export type Registrado =
  | { tipo: 'aberta'; tradeId: string }
  | { tipo: 'fechada'; tradeId: string; aviso: AvisoDoLimite | null; exitAt: Date | null }

/** Where the focus goes for a field's error (RO `alvoFoco`) */
function alvoFoco(campo: CampoEntrada, r: Rascunho, m: ModeloEntrada): string {
  switch (campo) {
    case 'dia':
      return m.dia === m.hoje ? 'g-dia-0' : m.dia === addDays(m.hoje, -1) ? 'g-dia-1' : 'f-dia'
    case 'lado':
    case 'dir':
    case 'exp':
    case 'fimB':
      return `g-${campo}-0`
    case 'q':
      return r.qtdOutro ? 'f-q' : 'g-q-0'
    case 'par':
      return r.parOutro ? 'f-parOutro' : 'g-par-0'
    default:
      return `f-${campo}`
  }
}

/** A server refusal's field (its HINT) as the form's */
function campoDoServidor(field: string | null, market: 'futures' | 'binary'): CampoEntrada | null {
  switch (field) {
    case 'symbol':
      return market === 'binary' ? 'par' : null
    case 'direction':
      return market === 'binary' ? 'dir' : 'lado'
    case 'quantity':
      return 'q'
    case 'entry_price':
      return 'preco'
    case 'exit_price':
      return 'spreco'
    case 'entry':
      return 'hora'
    case 'exit':
      return 'shora'
    case 'stop':
    case 'stop_pts':
      return 'stop'
    case 'target':
    case 'target_pts':
      return 'alvo'
    case 'stake':
      return 'stake'
    case 'payout':
      return 'payout'
    case 'duration_s':
      return 'exp'
    case 'day':
      return 'dia'
    case 'outcome':
      return 'fimB'
    default:
      return null
  }
}

/** The last value that was there (the gate line keeps its answer while the next one is asked: no flicker per keystroke) */
function useUltimo<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(null)
  if (value !== null && value !== undefined) ref.current = value
  return value ?? ref.current
}

export interface PassoEntradaProps {
  conta: ContaReg
  contas: readonly TradingAccount[]
  aoTrocarConta: (id: string) => void
  /** The cached rules_now answer of the account (null: not loaded, failed, or the account is not in it) */
  agora: AccountNow | null
  rulesNowFalhou: boolean
  /** The account's trading day today (diaDeHoje) */
  hoje: string
  rules: Rules | null
  defaults: RegistrarDefaults
  r: Rascunho
  inicial: Rascunho
  setR: (fn: (r: Rascunho) => Rascunho) => void
  /** «Operação anterior: …», «Entrada das 10:31 desfeita às 10:32.», «Esta operação não foi encontrada.» */
  aviso: string | null
  pref80: boolean
  aoRegistrar: (x: Registrado) => void
  aoSemRegras: () => void
  /** The step's heading takes the focus when it appears */
  headingRef: React.RefObject<HTMLHeadingElement>
}

/**
 * Step 1 · «Entrada» / «Entrada e saída» (RO l.307–435): the form, its gate and limit lines (the
 * cached rules_now for the current minute, gate_at for a typed hour or another «Dia», C24), the
 * dry run for the plan, the limit's room and `similar`, and «Registrar entrada» / «Registrar
 * operação».
 */
export default function PassoEntrada(props: PassoEntradaProps) {
  const { conta, contas, aoTrocarConta, agora, rulesNowFalhou, hoje, rules, defaults, r, inicial, setR, aviso, pref80, aoRegistrar, aoSemRegras, headingRef } = props
  const now = useServerNow(1000)
  const [tentou, setTentou] = useState(false)
  const [erroServidor, setErroServidor] = useState<{ campo: CampoEntrada; texto: string } | null>(null)
  const [erroGeral, setErroGeral] = useState<RegistrarErrorCode | null>(null)
  const [similar, setSimilar] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const ocupadoRef = useRef(false)
  const entrada = useRegisterEntry()
  const depois = useRegisterAfter()
  const fechada = r.modo === 'fechada'
  const m = modeloEntrada({ conta, r, now, hoje, tentou })
  useMexido(rascunhoMexido(r, inicial))

  // «Posso operar hoje?»: rules_now for the current minute, gate_at at a typed hour or another day
  const noGateAt = !m.diaRecusado && !m.noMinutoAtual && m.entradaEm ? m.entradaEm : null
  const gateAt = useGateAt(conta.id, noGateAt)
  const gateDoMomento: GateResult | null = noGateAt ? gateAt.data?.gate ?? null : agora?.gate ?? null
  const gate = useUltimo(gateDoMomento)
  const rulesDoGate = (noGateAt ? gateAt.data?.rules : null) ?? rules
  const falhou = noGateAt ? gateAt.isError && !gate : rulesNowFalhou && !agora
  const pergunta = perguntaGate(m, r.modo)
  const presente = !fechada && m.agora
  const outroDia = m.dia !== m.hoje
  const gateMostrado: GateMostrado = {
    pergunta,
    linha: falhou ? 'falhou' : gate ? linhaGate(conta, gate, rulesDoGate, { presente, outroDia }) : null,
    limite: gate ? linhaLimite(conta, gate, rulesDoGate) : null,
  }

  // The dry run: the plan, the limit's room, `similar` (only a complete form is asked)
  const dryAberta = useEntryPreview(conta.id, fechada ? null : m.payload)
  const dryFechada = useAfterPreview(conta.id, fechada ? m.payloadFechada : null)
  const dry = fechada ? dryFechada : dryAberta
  const dryAtual = dry.data && !dry.isPlaceholderData ? dry.data : null
  const quebras = m.diaRecusado ? [] : dryAtual ? dryAtual.plan.breaks : gate ? quebrasDoGate(gate) : []
  const plano = textoQuebras(quebras)
  const aviso2 = avisoLimiteEntrada(conta, m, gate, dryAtual ? dryAtual.limitRoom : undefined)

  // Errors on screen: the local ones, or the server's refusal of a field the form let through
  const erros: Partial<Record<CampoEntrada, string>> = { ...m.visiveis }
  if (erroServidor && !erros[erroServidor.campo]) erros[erroServidor.campo] = erroServidor.texto

  const mudar = (patch: Partial<Rascunho>, foco?: string) => {
    setR((x) => ({ ...x, ...patch }))
    setErroServidor(null)
    setErroGeral(null)
    setSimilar(null)
    if (foco) requestAnimationFrame(() => document.getElementById(foco)?.focus())
  }

  const desc = descricaoSimilar(m, conta)

  const registrar = async (permitirSimilar: boolean) => {
    if (ocupadoRef.current) return
    setTentou(true)
    setErroGeral(null)
    if (m.primeiro) {
      document.getElementById(alvoFoco(m.primeiro, r, m))?.focus()
      return
    }
    if (!permitirSimilar && dryAtual && dryAtual.similar.length > 0) {
      setSimilar(desc ?? '')
      return
    }
    ocupadoRef.current = true
    setOcupado(true)
    setSimilar(null)
    try {
      if (!fechada && m.payload) {
        const payload = permitirSimilar ? { ...m.payload, allow_similar: true } : m.payload
        const ans = await entrada.mutateAsync({ accountId: conta.id, payload })
        aoRegistrar({ tipo: 'aberta', tradeId: ans.state.trade.id })
      } else if (fechada && m.payloadFechada) {
        const payload = permitirSimilar ? { ...m.payloadFechada, allow_similar: true } : m.payloadFechada
        const ans = await depois.mutateAsync({ accountId: conta.id, payload })
        const banner = ans.repeated
          ? null
          : avisoDoLimite({
              market: conta.market,
              tradeDay: ans.state.trade.tradingDay,
              before: ans.limitBefore,
              after: ans.gateNow ? { tradingDay: ans.gateNow.tradingDay, limit: ans.gateNow.limit } : null,
              exitAt: ans.state.trade.exitTime,
              pref80,
            })
        aoRegistrar({ tipo: 'fechada', tradeId: ans.state.trade.id, aviso: banner, exitAt: ans.state.trade.exitTime })
      }
    } catch (e) {
      const err = e instanceof RegistrarDataError ? e : new RegistrarDataError('unknown')
      if (err.code === 'similar_trade') setSimilar(desc ?? '')
      else if (err.code === 'no_rules') aoSemRegras()
      else {
        const campo = err.code === 'before_rules' ? (fechada ? 'dia' : 'hora') : campoDoServidor(err.field, conta.market)
        if (campo) {
          const texto =
            err.code === 'before_rules' && conta.desdeDay
              ? ERROS.antesRegras(formatDiaMes(conta.desdeDay))
              : err.code === 'entry_in_future'
                ? ERROS.entradaFutura(horaRel(conta, now))
                : err.code === 'exit_in_future'
                  ? ERROS.saidaFutura(horaRel(conta, now))
                  : ERRO_REGISTRAR[err.code]
          setErroServidor({ campo, texto })
          requestAnimationFrame(() => document.getElementById(alvoFoco(campo, r, m))?.focus())
        } else setErroGeral(err.code)
      }
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }
  const sufixoCampo = conta.clock === 'America/Sao_Paulo' ? ' (Brasília)' : ' (ET)'
  const ontem = addDays(m.hoje, -1)
  const camposProps: CamposProps = { conta, r, m, erros, mudar, aviso: aviso2, sufixoCampo }

  return (
    <div className="hub-passo">
      <h3 ref={headingRef} tabIndex={-1}>
        {fechada ? ENTRADA.tituloFechada : ENTRADA.titulo}
      </h3>
      {aviso && (
        <p className="hub-reg-st" role="status">
          {aviso}
        </p>
      )}
      <GrupoPills
        id="modo"
        titulo={ENTRADA.modo}
        opcoes={[
          { valor: 'aberta', rotulo: ENTRADA.aberta },
          { valor: 'fechada', rotulo: ENTRADA.jaFechada },
        ]}
        valor={r.modo}
        aoEscolher={(v) => {
          if (v !== r.modo) {
            setTentou(false)
            mudar({ modo: v as 'aberta' | 'fechada', resultado: null })
          }
        }}
      />
      {fechada && (
        <div className="hub-reg-grupo">
          <span id="l-dia" className="hub-rot-campo">
            {ENTRADA.dia}
          </span>
          <div className="hub-reg-dia">
            <div role="group" aria-labelledby="l-dia" aria-describedby={erros.dia ? 'e-dia' : undefined} className="hub-pills">
              {[
                { rotulo: ENTRADA.hoje, valor: m.hoje },
                { rotulo: ENTRADA.ontem, valor: ontem },
              ].map((o, j) => (
                <button
                  key={o.rotulo}
                  id={`g-dia-${j}`}
                  type="button"
                  className="hub-pill"
                  aria-pressed={m.dia === o.valor}
                  onClick={() => mudar({ dia: o.valor === m.hoje ? null : o.valor, resultado: null })}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
            <div className="hub-campo">
              <label htmlFor="f-dia" className="hub-rot-campo">
                {ENTRADA.outroDia}
              </label>
              <input
                id="f-dia"
                className="hub-entrada hub-entrada--mono hub-reg-entrada"
                type="date"
                max={m.hoje}
                aria-invalid={erros.dia ? true : undefined}
                aria-describedby={erros.dia ? 'e-dia' : undefined}
                value={m.dia}
                onChange={(event) => mudar({ dia: event.target.value && event.target.value !== m.hoje ? event.target.value : null, resultado: null })}
                style={{ width: 180 }}
              />
            </div>
          </div>
          <Erro id="e-dia" texto={erros.dia} />
        </div>
      )}
      <ContextoConta
        conta={conta}
        contas={contas}
        aoTrocar={aoTrocarConta}
        janela={janelaLinha(rules)}
        gate={gateMostrado}
        mostrarGate={!m.diaRecusado}
        info={conta.market === 'futures' ? GATE.infoFuturos : GATE.infoOutros}
      />
      {conta.market === 'futures' ? (
        <CamposFuturos {...camposProps} />
      ) : (
        <CamposEbinex
          {...camposProps}
          pares={defaults.pairs}
          aoEscolherPar={(par) =>
            par === null
              ? mudar({ parOutro: true, payout: '' }, 'f-parOutro')
              : mudar({ par, parOutro: false, payout: defaults.payoutBySymbol[par] ? formatDecimal(defaults.payoutBySymbol[par]) : '' })
          }
        />
      )}
      {plano && (
        <div className="hub-reg-plano-linha">
          <PlanoPill fora={plano} noPlano="" semPlano="" />
          <span>{ENTRADA.fora}</span>
        </div>
      )}
      {fechada && (
        <div className="hub-linha-i">
          <span className="hub-num" role="status">
            {m.linhaResultado}
          </span>
        </div>
      )}
      <MarcasEntrada r={r} m={m} mudar={mudar} />

      {similar !== null && (
        <div className="hub-bloco hub-bloco--atencao hub-reg-similar" role="group" aria-labelledby="t-similar">
          <p id="t-similar" className="hub-reg-amber">
            {SIMILAR.pergunta(similar)}
          </p>
          <div className="hub-acoes">
            <button type="button" className="hub-btn hub-btn--pri" onClick={() => void registrar(true)}>
              {SIMILAR.sim}
            </button>
            <button type="button" className="hub-btn" onClick={() => setSimilar(null)}>
              {SIMILAR.nao}
            </button>
          </div>
        </div>
      )}
      {erroGeral && (
        <div role="alert" className="hub-alerta">
          {ERRO_REGISTRAR[erroGeral]}
        </div>
      )}
      <Rodape
        primaria={{ rotulo: fechada ? RODAPE.registrarOperacao : RODAPE.registrarEntrada, aoClicar: () => void registrar(false), ocupado }}
        ocupado={ocupado}
      />
    </div>
  )
}

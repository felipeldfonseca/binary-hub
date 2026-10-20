'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useHubDb } from '@/hooks/useContas'
import { registrarKeys, setTradeView, useExitPreview, useRegisterExit, useServerNow, useUndoEntry } from '@/hooks/useRegistrar'
import type { Outcome } from '@/lib/domain/registro'
import { conferidos } from '@/lib/hub/posso'
import { avisoDoLimite, type AvisoDoLimite } from '@/lib/hub/registrar'
import { RegistrarDataError, type RegistrarErrorCode, type TradeView } from '@/lib/hub/registrarDb'
import {
  ORDEM_SAIDA,
  avisoDesfeita,
  chipMarca,
  hora,
  horaRel,
  modeloResultado,
  modeloSaida,
  podeDesfazer,
  resumoAberta,
  textoDaRecusa,
  textoQuebras,
  type ContaReg,
  type MarcaKind,
  type SaidaCampos,
} from '@/lib/hub/registrarForm'
import { Disclosure, useToggle } from '@/components/hub/contas/ui'
import BlocoResultado from './BlocoResultado'
import { ABERTA, EBINEX, ERRO_REGISTRAR, ERROS, FUTUROS, MARCAS, RODAPE } from './copy'
import { AvisosMarca, PillsMarca, useMarcar } from './Marcas'
import { CampoTexto, Erro, GrupoPills, PlanoPill, Rodape, Tempo, descrito } from './ui'
import VenceuSemValor from './VenceuSemValor'

/** The exit's fields a server refusal can name (its HINT), in ORDEM_SAIDA's words */
type CampoSaida = (typeof ORDEM_SAIDA)[number]
const CAMPO_DO_SERVIDOR: Partial<Record<string, CampoSaida>> = { exit_price: 'spreco', exit: 'shora', pnl: 'res', costs: 'custos' }

/** The plan pill of a registered trade: «No plano» / «● fora da janela» / «—» */
export function PlanoDaOperacao({ view, nota }: { view: Pick<TradeView, 'plan'>; nota?: React.ReactNode }) {
  const plan = view.plan
  const fora = plan && plan.verdict === 'fora_do_plano' ? textoQuebras(plan.breaks) : null
  const ok = plan && plan.verdict === 'no_plano'
  return (
    <div className="hub-reg-plano-linha">
      <PlanoPill fora={fora} noPlano={ok ? ABERTA.noPlano : ''} semPlano={ABERTA.semPlano} />
      {nota}
    </div>
  )
}

export interface Saida {
  aviso: AvisoDoLimite | null
  exitAt: Date | null
}

export interface PassoAbertaProps {
  conta: ContaReg
  view: TradeView
  pref80: boolean
  headingRef: React.RefObject<HTMLHeadingElement>
  aoNovaEntrada: () => void
  /** The exit was registered by this sheet (a repeated tap included: C5) */
  aoFechar: (s: Saida) => void
  /** The trade was closed elsewhere (another device): step 3 with «… já foi fechada em outro lugar.» */
  aoFechadaFora: () => void
  /** «Desfazer entrada» done: step 1 with «Entrada das 10:31 desfeita às 10:32.» */
  aoDesfeita: (aviso: string) => void
  /** The trade is gone (unknown_trade) */
  aoSumiu: () => void
}

/**
 * Step 2 · «Operação aberta» / «Opção vencida» (RO l.437–482, 1225–1289): the summary, the plan,
 * the marks (one tap = one mark on the server's clock), the exit (every price market: «Venceu sem
 * valor» of an option, the exit price and hour, the result block with «Corrigir», the typed result
 * and «Custos») or the result (Ebinex, after the expiry), «Desfazer entrada» within 15 minutes, and
 * «Registrar saída» / «Registrar resultado».
 */
export default function PassoAberta({ conta, view, pref80, headingRef, aoNovaEntrada, aoFechar, aoFechadaFora, aoDesfeita, aoSumiu }: PassoAbertaProps) {
  const now = useServerNow(1000)
  const { userId } = useHubDb()
  const queryClient = useQueryClient()
  const t = view.trade
  const binaria = conta.market === 'binary'
  const [campos, setCampos] = useState<SaidaCampos>({ preco: '', hora: null })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [tentou, setTentou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erroGeral, setErroGeral] = useState<RegistrarErrorCode | null>(null)
  /** A server refusal of a field the form let through: under that field («Preço de saída», «Hora da saída», the result, the costs, «Como terminou?») */
  const [erroCampo, setErroCampo] = useState<{ campo: CampoSaida | 'fim'; texto: string } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [mudarAberto, alternarMudar] = useToggle()
  const ocupadoRef = useRef(false)
  /** This sheet sent an exit for the trade: a «repeated» answer is then its own (C5, §8 C3) */
  const enviouSaida = useRef(false)
  const desfazerRef = useRef<HTMLButtonElement>(null)
  const simRef = useRef<HTMLButtonElement>(null)
  const saida = useRegisterExit()
  const desfazer = useUndoEntry()
  const marcar = useMarcar(conta, view)

  const resumo = resumoAberta(conta, t, now)
  const ms = binaria ? null : modeloSaida(conta, t, campos, now, tentou)
  const mr = binaria ? modeloResultado(conta, t, outcome, now) : null
  const vencida = !!mr?.vencida
  const payload = ms ? ms.payload : mr ? mr.payload : null

  // Closed elsewhere: the trade read again (focus) or the exit's dry run says so, before this sheet sent an exit
  const dry = useExitPreview(t.id, payload)
  useEffect(() => {
    if (enviouSaida.current) return
    if (t.status === 'closed') aoFechadaFora()
    else if (dry.data && dry.data.repeated && !dry.isPlaceholderData) {
      setTradeView(queryClient, userId, dry.data.state)
      aoFechadaFora()
    }
  }, [t.status, dry.data, dry.isPlaceholderData, aoFechadaFora, queryClient, userId])

  useEffect(() => {
    if (confirmando) simRef.current?.focus()
  }, [confirmando])
  // The alert appears above the footer, below the screen on a phone: scrolled into view (role="alert" reads it)
  const alertaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (erroGeral) alertaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [erroGeral])

  const registrar = async () => {
    if (ocupadoRef.current) return
    setTentou(true)
    setErroGeral(null)
    setErroCampo(null)
    const primeiro = ms ? ORDEM_SAIDA.find((k) => ms.erros[k]) : undefined
    if (primeiro) {
      document.getElementById(`f-${primeiro}`)?.focus()
      return
    }
    if (mr && mr.erro) {
      document.getElementById('g-fim-0')?.focus()
      return
    }
    if (!payload) return
    ocupadoRef.current = true
    setOcupado(true)
    enviouSaida.current = true
    try {
      const ans = await saida.mutateAsync({ tradeId: t.id, accountId: conta.id, payload })
      const aviso =
        ans.repeated || !ans.exit
          ? null
          : avisoDoLimite({
              market: conta.market,
              tradeDay: ans.state.trade.tradingDay,
              before: ans.limitBefore,
              after: ans.gateNow ? { tradingDay: ans.gateNow.tradingDay, limit: ans.gateNow.limit } : null,
              exitAt: ans.exit.exitAt,
              pref80,
            })
      aoFechar({ aviso, exitAt: ans.exit?.exitAt ?? ans.state.trade.exitTime })
    } catch (e) {
      const err = e instanceof RegistrarDataError ? e : new RegistrarDataError('unknown')
      if (err.code === 'not_open') {
        await queryClient.refetchQueries({ queryKey: registrarKeys.operacao(userId, t.id) })
        aoFechadaFora()
      } else if (err.code === 'unknown_trade') aoSumiu()
      else if (err.code === 'not_expired' || err.code === 'bad_outcome') setErroCampo({ campo: 'fim', texto: ERRO_REGISTRAR[err.code] })
      else if (err.field && CAMPO_DO_SERVIDOR[err.field]) {
        const campo = CAMPO_DO_SERVIDOR[err.field] as CampoSaida
        // The local check's wording, with its values, when the server's code is one of its own
        const texto =
          err.code === 'exit_in_future'
            ? ERROS.saidaFutura(horaRel(conta, now))
            : err.code === 'exit_before_entry'
              ? ERROS.saidaAntes(hora(conta, t.entryTime))
              : textoDaRecusa(err.code, err.field, { forma: null, lado: null }) ?? ERRO_REGISTRAR[err.code]
        // The server asks for the result where the form computed it: «Corrigir» opens its field, empty
        if (campo === 'res' && !ms?.bloco?.campo && ms?.bloco?.corrigir) setCampos((c) => ({ ...c, corrigir: true, resultado: '' }))
        setErroCampo({ campo, texto })
        // A field this exit does not show (never sent by it): the sheet's alert says it instead
        const codigo = err.code
        requestAnimationFrame(() => {
          const alvo = document.getElementById(`f-${campo}`)
          if (alvo) alvo.focus()
          else {
            setErroCampo(null)
            setErroGeral(codigo)
          }
        })
      } else setErroGeral(err.code)
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  const confirmarDesfazer = async () => {
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    setOcupado(true)
    setErroGeral(null)
    try {
      const ans = await desfazer.mutateAsync({ tradeId: t.id })
      aoDesfeita(avisoDesfeita(conta, t, ans.serverNow))
    } catch (e) {
      const err = e instanceof RegistrarDataError ? e : new RegistrarDataError('unknown')
      // A lost answer retried: the undo was done (C5)
      if (err.code === 'unknown_trade') aoDesfeita(avisoDesfeita(conta, t, now))
      else {
        setConfirmando(false)
        setErroGeral(err.code)
      }
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  const desfazivel = podeDesfazer(t, view.context?.origin ?? null, now)
  useEffect(() => {
    if (!desfazivel) setConfirmando(false)
  }, [desfazivel])

  const chip = (kind: MarcaKind) => {
    if (marcar.pendente?.kind === kind) return { texto: MARCAS.salvando, tipo: 'fraco' as const }
    const n = marcar.atuais[kind]
    if (!n || n.currentValue === null) return null
    const c = chipMarca(conta, n, now)
    return { texto: c.texto, tipo: c.antes ? ('antes' as const) : ('depois' as const) }
  }
  const atuais = (['setup', 'execucao'] as MarcaKind[]).filter((k) => marcar.valor(k) !== null)
  const conf = view.plan ? conferidos(view.plan.checksEvaluated) : null
  const erroSaida = ms ? (tentou ? ms.erros : {}) : {}
  const doServidor = (campo: CampoSaida) => (erroCampo?.campo === campo ? erroCampo.texto : null)
  const mudarCampos = (patch: Partial<SaidaCampos>) => {
    setCampos((c) => ({ ...c, ...patch }))
    setErroCampo(null)
  }

  return (
    <div className="hub-passo">
      <h3 ref={headingRef} tabIndex={-1}>
        {vencida ? ABERTA.tituloVencida : ABERTA.titulo}
      </h3>
      <div role="status" className="sr-only">
        {resumo.status}
      </div>
      <div className="hub-reg-resumo">
        <b>{resumo.op}</b>
        <span>{resumo.entrada}</span>
        {resumo.stop && <span className="hub-nota hub-num">{resumo.stop}</span>}
      </div>
      <PlanoDaOperacao view={view} nota={conf ? <span className="hub-nota">{conf}</span> : null} />

      <div className="hub-bloco">
        <span className="hub-rotulo">{ABERTA.suasMarcas}</span>
        {atuais.length > 0 ? (
          <ul className="hub-reg-lista-marcas">
            {atuais.map((k) => {
              const c = chip(k)
              return (
                <li key={k}>
                  <span>
                    {MARCAS.rotulo(k, MARCAS.valores[k][marcar.valor(k) as string] ?? (marcar.valor(k) as string))}{' '}
                    {c && <Tempo texto={c.texto} tipo={c.tipo} />}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <span className="hub-nota">{ABERTA.nenhumaAinda}</span>
        )}
        {vencida && <span className="hub-reg-txt">{ABERTA.depoisDoResultado}</span>}
      </div>
      <PillsMarca
        id="emo"
        kind="emocao"
        titulo={ABERTA.comoEsta}
        tituloClasse="hub-reg-toque-tit"
        valor={marcar.valor('emocao')}
        aoEscolher={(v) => void marcar.marcar('emocao', v)}
        chip={chip('emocao')}
      />
      <div className="hub-reg-col">
        <Disclosure open={mudarAberto} controls="mudar-marcas" onToggle={alternarMudar}>
          {ABERTA.setupExecucao}
        </Disclosure>
        {mudarAberto && (
          <div id="mudar-marcas" className="hub-reg-editor">
            {(['setup', 'execucao'] as MarcaKind[]).map((k) => (
              <PillsMarca key={k} id={`mudar-${k}`} kind={k} valor={marcar.valor(k)} aoEscolher={(v) => void marcar.marcar(k, v)} />
            ))}
          </div>
        )}
      </div>
      <AvisosMarca m={marcar} />

      {ms && (
        <>
          {ms.vsv && (
            <VenceuSemValor
              estado={ms.vsv}
              aoAlternar={() => {
                if (ms.vsv?.disponivel) mudarCampos({ vsv: !campos.vsv, preco: '', hora: null })
              }}
            />
          )}
          <div className="hub-campos2">
            <CampoTexto
              id="f-spreco"
              rotulo={ms.rotulos?.precoSaida ?? FUTUROS.precoSaida}
              valor={ms.precoCampo}
              decimal
              aoMudar={(v) => mudarCampos({ preco: v })}
              erro={erroSaida.spreco ?? doServidor('spreco')}
            />
            <CampoTexto
              id="f-shora"
              rotulo={ms.rotulos?.horaSaida ?? FUTUROS.horaSaida(conta.clock === 'America/Sao_Paulo' ? ' (Brasília)' : ' (ET)')}
              valor={ms.horaCampo}
              tipo="time"
              aoMudar={(v) => mudarCampos({ hora: v })}
              erro={erroSaida.shora ?? doServidor('shora')}
            />
          </div>
        </>
      )}
      {mr && (
        <GrupoPills
          id="fim"
          titulo={EBINEX.comoTerminou}
          opcoes={(['ganho', 'perda', 'devolvida'] as const).map((o) => ({ valor: o, rotulo: EBINEX[o], desligada: !vencida }))}
          valor={outcome}
          aoEscolher={(o) => {
            if (vencida) {
              setOutcome(o)
              setErroCampo(null)
            }
          }}
          descricao={descrito('n-fim', tentou && (mr.erro || erroCampo?.campo === 'fim') && 'e-fim')}
          depois={
            <>
              <span id="n-fim" className="hub-nota">
                {mr.vence}
              </span>
              <Erro id="e-fim" texto={tentou ? mr.erro ?? (erroCampo?.campo === 'fim' ? erroCampo.texto : null) : null} />
            </>
          }
        />
      )}
      {ms ? (
        <BlocoResultado
          linha={ms.previa}
          bloco={ms.bloco}
          erroRes={erroSaida.res ?? doServidor('res')}
          erroCustos={ms.erros.custos ?? doServidor('custos')}
          aoCorrigir={() => {
            const abrir = !campos.corrigir
            mudarCampos(abrir ? { corrigir: true, resultado: ms.bloco?.calculado ?? '' } : { corrigir: false, resultado: '' })
            if (abrir) requestAnimationFrame(() => document.getElementById('f-res')?.focus())
          }}
          aoMudarRes={(v) => mudarCampos({ resultado: v })}
          aoMudarCustos={(v) => mudarCampos({ custos: v })}
        />
      ) : (
        <div className="hub-linha-i">
          <span className="hub-num" role="status">
            {mr?.previa}
          </span>
        </div>
      )}

      {desfazivel && t.registeredAt && (
        <div className="hub-reg-desfazer">
          {!confirmando ? (
            <div className="hub-reg-cab hub-reg-cab--inicio">
              <button ref={desfazerRef} type="button" className="hub-reg-link hub-reg-link--perigo" onClick={() => setConfirmando(true)}>
                {ABERTA.desfazer}
              </button>
              <span className="hub-nota">{ABERTA.desfazerAte(hora(conta, new Date(t.registeredAt.getTime() + 15 * 60 * 1000)))}</span>
            </div>
          ) : (
            <div className="hub-reg-confirma" role="group" aria-labelledby="t-desfazer">
              <p id="t-desfazer" className="hub-reg-txt">
                {ABERTA.desfazerPergunta(hora(conta, t.entryTime), resumo.op)}
              </p>
              <div className="hub-acoes">
                <button ref={simRef} type="button" className="hub-btn" aria-disabled={ocupado || undefined} onClick={() => void confirmarDesfazer()}>
                  {ABERTA.sim}
                </button>
                <button
                  type="button"
                  className="hub-btn"
                  onClick={() => {
                    setConfirmando(false)
                    requestAnimationFrame(() => desfazerRef.current?.focus())
                  }}
                >
                  {ABERTA.manter}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {erroGeral && (
        <div ref={alertaRef} role="alert" className="hub-alerta">
          {ERRO_REGISTRAR[erroGeral]}
        </div>
      )}
      <Rodape
        esquerda={{ rotulo: RODAPE.novaEntrada, aoClicar: aoNovaEntrada }}
        primaria={{ rotulo: binaria ? RODAPE.registrarResultado : RODAPE.registrarSaida, aoClicar: () => void registrar(), ocupado }}
        ocupado={ocupado}
      />
    </div>
  )
}

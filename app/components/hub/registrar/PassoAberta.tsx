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
  avisoDesfeita,
  chipMarca,
  hora,
  modeloResultado,
  modeloSaida,
  podeDesfazer,
  resumoAberta,
  textoQuebras,
  type ContaReg,
  type MarcaKind,
  type SaidaCampos,
} from '@/lib/hub/registrarForm'
import { Disclosure, useToggle } from '@/components/hub/contas/ui'
import { ABERTA, EBINEX, ERRO_REGISTRAR, FUTUROS, MARCAS, RODAPE } from './copy'
import { AvisosMarca, PillsMarca, useMarcar } from './Marcas'
import { CampoTexto, Erro, GrupoPills, PlanoPill, Rodape, Tempo, descrito } from './ui'

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
 * the marks (one tap = one mark on the server's clock), the exit (futures) or the result (Ebinex,
 * after the expiry), «Desfazer entrada» within 15 minutes, and «Registrar saída» / «Registrar
 * resultado».
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
  const [erroCampo, setErroCampo] = useState<string | null>(null)
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

  const registrar = async () => {
    if (ocupadoRef.current) return
    setTentou(true)
    setErroGeral(null)
    setErroCampo(null)
    if (ms && (ms.erros.spreco || ms.erros.shora)) {
      document.getElementById(ms.erros.spreco ? 'f-spreco' : 'f-shora')?.focus()
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
      else if (err.code === 'not_expired' || err.code === 'bad_outcome') setErroCampo(ERRO_REGISTRAR[err.code])
      else if (err.field === 'exit_price' || err.field === 'exit') setErroCampo(ERRO_REGISTRAR[err.code])
      else setErroGeral(err.code)
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
        <div className="hub-campos2">
          <CampoTexto
            id="f-spreco"
            rotulo={FUTUROS.precoSaida}
            valor={campos.preco}
            decimal
            aoMudar={(v) => {
              setCampos((c) => ({ ...c, preco: v }))
              setErroCampo(null)
            }}
            erro={erroSaida.spreco ?? erroCampo}
          />
          <CampoTexto
            id="f-shora"
            rotulo={FUTUROS.horaSaida(conta.clock === 'America/Sao_Paulo' ? ' (Brasília)' : ' (ET)')}
            valor={ms.horaCampo}
            tipo="time"
            aoMudar={(v) => setCampos((c) => ({ ...c, hora: v }))}
            erro={erroSaida.shora}
          />
        </div>
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
          descricao={descrito('n-fim', tentou && (mr.erro || erroCampo) && 'e-fim')}
          depois={
            <>
              <span id="n-fim" className="hub-nota">
                {mr.vence}
              </span>
              <Erro id="e-fim" texto={tentou ? mr.erro ?? erroCampo : null} />
            </>
          }
        />
      )}
      <div className="hub-linha-i">
        <span className="hub-num" role="status">
          {ms ? ms.previa : mr?.previa}
        </span>
      </div>

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
        <div role="alert" className="hub-alerta">
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

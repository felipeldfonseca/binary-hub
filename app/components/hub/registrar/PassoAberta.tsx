'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useHubDb } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import {
  registrarKeys,
  setTradeView,
  useExitPreview,
  useMoveStop,
  useRegisterExit,
  useRegisterPartial,
  useServerNow,
  useUndoEntry,
  useUndoEvent,
} from '@/hooks/useRegistrar'
import { countingExits, favorOf, movePayload, partialPayload, undoEventPayload, type Outcome } from '@/lib/domain/registro'
import { abs, cmp, numeric } from '@/lib/domain/registro/numeric'
import { lerNumero } from '@/lib/hub/numero'
import { conferidos } from '@/lib/hub/posso'
import { avisoDoLimite, type AvisoDoLimite } from '@/lib/hub/registrar'
import { RegistrarDataError, newClientKey, type RegistrarErrorCode, type TradeView } from '@/lib/hub/registrarDb'
import {
  ORDEM_SAIDA,
  avisoDesfeita,
  chipMarca,
  hora,
  horaRel,
  modeloResultado,
  podeDesfazer,
  precoDe,
  resumoAberta,
  textoAviso,
  textoDaRecusa,
  textoQuebras,
  type ContaReg,
  type MarcaKind,
  type SaidaCampos,
} from '@/lib/hub/registrarForm'
import {
  CAMPOS_PARCIAL,
  CAMPOS_STOP,
  ORDEM_PARCIAL,
  ORDEM_STOP,
  desfazerEvento,
  formaDaOperacao,
  linhaDoTempo,
  modeloAgora,
  modeloMoverStop,
  modeloParcial,
  modosDaAberta,
  movimentoAtual,
  notaPrimeiraParcial,
  perguntaDesfazerEntrada,
  precoParaCampo,
  regraNoResumo,
  saidaComParciais,
  sugestaoBreakeven,
  textoDepoisDoUndo,
  textoParcialRegistrada,
  textoStopRegistrado,
  type CampoParcial,
  type CampoStop,
  type CamposParcial,
  type CamposStop,
  type ModoAberta,
} from '@/lib/hub/registrarParciais'
import { Disclosure, useToggle } from '@/components/hub/contas/ui'
import AcoesAberta from './AcoesAberta'
import BlocoAgora from './BlocoAgora'
import BlocoResultado from './BlocoResultado'
import { ABERTA, EBINEX, ERRO_REGISTRAR, ERROS, ERROS_PRECOS, FUTUROS, MARCAS, RODAPE } from './copy'
import { ACOES, ERRO_3C, PARCIAL, STOP } from './copyParciais'
import FormMoverStop from './FormMoverStop'
import FormParcial from './FormParcial'
import LinhaDoTempo from './LinhaDoTempo'
import { AvisosMarca, PillsMarca, useMarcar } from './Marcas'
import SugestaoBreakeven from './SugestaoBreakeven'
import { CampoTexto, Erro, GrupoPills, PRIMARIA_ID, PlanoPill, Rodape, Tempo, descrito } from './ui'
import VenceuSemValor from './VenceuSemValor'

/** The exit's fields a server refusal can name (its HINT), in ORDEM_SAIDA's words */
type CampoSaida = (typeof ORDEM_SAIDA)[number]
const CAMPO_DO_SERVIDOR: Partial<Record<string, CampoSaida>> = { exit_price: 'spreco', exit: 'shora', pnl: 'res', costs: 'custos' }
/** Phase 3c: the partial's and the move's fields a refusal can name */
const CAMPO_PARCIAL: Partial<Record<string, CampoParcial>> = { quantity: 'pq', exit_price: 'ppreco', exit: 'phora', pnl: 'pres' }

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

/** What the last write left on screen until the next one (E20, E21, E22) */
interface AcaoSt {
  texto: string
  sugestao: { texto: string; preco: string } | null
  aviso: { texto: string; atingido: boolean } | null
}

/** Which write the sheet's alert speaks for (§5.8): the 3c writes read ERRO_3C first */
type ErroGeral = { code: RegistrarErrorCode; de: 'antes' | '3c' }

/**
 * Step 2 · «Operação aberta» / «Opção vencida» (RO l.437–482, 1225–1289; Phase 3c RO l.466–561):
 * the summary (and the trade's breakeven rule), «Agora» and «Linha do tempo» with «Desfazer» after
 * a partial or a move, the plan, the marks (one tap = one mark on the server's clock), and on price
 * markets «O que registrar agora?»: «Saída» (the exit of what is open: «Venceu sem valor» of an
 * option, the exit price and hour, the result block with «Corrigir», the typed result and
 * «Custos»), «Parcial» or «Mover stop», each with its status after the write, the breakeven
 * suggestion and the limit banner; Ebinex the result after the expiry; «Desfazer entrada» within 15
 * minutes; the footer's primary by mode.
 */
export default function PassoAberta({ conta, view, pref80, headingRef, aoNovaEntrada, aoFechar, aoFechadaFora, aoDesfeita, aoSumiu }: PassoAbertaProps) {
  const now = useServerNow(1000)
  const { userId } = useHubDb()
  const queryClient = useQueryClient()
  const rulesNow = useRulesNow()
  const t = view.trade
  const binaria = conta.market === 'binary'
  const contaId = t.accountId ?? conta.id
  const [campos, setCampos] = useState<SaidaCampos>({ preco: '', hora: null })
  const [cp, setCp] = useState<CamposParcial>(CAMPOS_PARCIAL)
  const [cs, setCs] = useState<CamposStop>(CAMPOS_STOP)
  const [modoEscolhido, setModoEscolhido] = useState<ModoAberta>('saida')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [tentou, setTentou] = useState(false)
  const [tentouP, setTentouP] = useState(false)
  const [tentouS, setTentouS] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erroGeral, setErroGeral] = useState<ErroGeral | null>(null)
  /** A server refusal of a field the form let through: under that field («Preço de saída», «Hora da saída», the result, the costs, «Como terminou?») */
  const [erroCampo, setErroCampo] = useState<{ campo: CampoSaida | 'fim'; texto: string } | null>(null)
  const [erroParcial, setErroParcial] = useState<Partial<Record<CampoParcial, string>>>({})
  const [erroStop, setErroStop] = useState<Partial<Record<CampoStop, string>>>({})
  const [acaoSt, setAcaoSt] = useState<AcaoSt | null>(null)
  const [undoAberto, setUndoAberto] = useState(false)
  /** An event the server said is too late to undo: its link goes */
  const [undoNegado, setUndoNegado] = useState<string | null>(null)
  const [focoLink, setFocoLink] = useState(0)
  const [focoAcao, setFocoAcao] = useState(0)
  const [confirmando, setConfirmando] = useState(false)
  const [mudarAberto, alternarMudar] = useToggle()
  const ocupadoRef = useRef(false)
  /** One client_key per form, kept across retries, new after a success */
  const chaves = useRef({ parcial: newClientKey(), stop: newClientKey() })
  /** This sheet sent an exit for the trade: a «repeated» answer is then its own (C5, §8 C3) */
  const enviouSaida = useRef(false)
  const desfazerRef = useRef<HTMLButtonElement>(null)
  const simRef = useRef<HTMLButtonElement>(null)
  const acaoRef = useRef<HTMLParagraphElement>(null)
  const saida = useRegisterExit()
  const parcial = useRegisterPartial()
  const mover = useMoveStop()
  const desfazerEv = useUndoEvent()
  const desfazer = useUndoEntry()
  const marcar = useMarcar(conta, view)

  const resumo = resumoAberta(conta, t, now)
  const modos = binaria ? [] : modosDaAberta(conta, view)
  const modo: ModoAberta = modos.includes(modoEscolhido) ? modoEscolhido : 'saida'
  const ms = binaria ? null : saidaComParciais(conta, view, campos, now, tentou)
  const mr = binaria ? modeloResultado(conta, t, outcome, now) : null
  const agoraConta = rulesNow.data?.accounts.find((a) => a.accountId === contaId) ?? null
  const mp = !binaria && modo === 'parcial' ? modeloParcial(conta, view, cp, now, tentouP) : null
  const mst = !binaria && modo === 'stop' ? modeloMoverStop(conta, view, cs, agoraConta, tentouS) : null
  const vencida = !!mr?.vencida
  const payload = ms ? ms.payload : mr ? mr.payload : null
  const regra = binaria ? null : regraNoResumo(conta, view)
  const temEventos = !binaria && (view.position.partials > 0 || movimentoAtual(view.stopMoves) !== null)
  const agora = temEventos ? modeloAgora(conta, view) : null
  const tempo = temEventos ? linhaDoTempo(conta, view, now) : null
  const undo0 = binaria ? null : desfazerEvento(conta, view, now)
  const undo = undo0 && undoNegado !== `${undo0.kind}-${undo0.id}` ? undo0 : null
  const notaParcial = binaria ? null : notaPrimeiraParcial(conta, view)

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
  // The undo's deadline (or the event gone): an open confirmation closes, as «Desfazer entrada»'s does
  const temUndo = !!undo
  useEffect(() => {
    if (!temUndo) setUndoAberto(false)
  }, [temUndo])
  // After a write, the action status takes the focus (it says what happened)
  useEffect(() => {
    if (focoAcao) acaoRef.current?.focus()
  }, [focoAcao])
  // The alert appears above the footer, below the screen on a phone: scrolled into view (role="alert" reads it)
  const alertaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (erroGeral) alertaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [erroGeral])

  const focar = (id: string) => document.getElementById(id)?.focus()
  /** After a partial, a move or an undo: back to «Saída», every form's errors gone, the status focused */
  const depoisDaEscrita = (st: AcaoSt) => {
    setAcaoSt(st)
    setModoEscolhido('saida')
    setTentou(false)
    setTentouP(false)
    setTentouS(false)
    setUndoAberto(false)
    setFocoAcao((n) => n + 1)
  }

  /** A refusal of «Registrar parcial», «Registrar stop» or «Sim, desfazer» that is not a field's */
  const recusa3c = async (err: RegistrarDataError, desfazendo = false): Promise<boolean> => {
    if (err.code === 'not_open') {
      await queryClient.refetchQueries({ queryKey: registrarKeys.operacao(userId, t.id) })
      aoFechadaFora()
      return true
    }
    if (err.code === 'unknown_trade') {
      aoSumiu()
      return true
    }
    if (desfazendo && (err.code === 'not_newest' || err.code === 'nothing_to_undo')) {
      void queryClient.refetchQueries({ queryKey: registrarKeys.operacao(userId, t.id) })
    }
    setErroGeral({ code: err.code, de: '3c' })
    return true
  }

  const registrar = async () => {
    if (ocupadoRef.current) return
    setTentou(true)
    setErroGeral(null)
    setErroCampo(null)
    const primeiro = ms ? ORDEM_SAIDA.find((k) => ms.erros[k]) : undefined
    if (primeiro) {
      focar(`f-${primeiro}`)
      return
    }
    if (mr && mr.erro) {
      focar('g-fim-0')
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
        const ultima = countingExits(view.exits).reduce<Date | null>((m, x) => (m === null || x.exitTime > m ? x.exitTime : m), null)
        // The local check's wording, with its values, when the server's code is one of its own
        const texto =
          err.code === 'exit_in_future'
            ? ERROS.saidaFutura(horaRel(conta, now))
            : err.code === 'exit_before_entry'
              ? ERROS.saidaAntes(hora(conta, t.entryTime))
              : err.code === 'exit_before_partial' && ultima
                ? ACOES.saidaAntesParcial(hora(conta, ultima))
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
            setErroGeral({ code: codigo, de: 'antes' })
          }
        })
      } else setErroGeral({ code: err.code, de: 'antes' })
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  const registrarParcial = async () => {
    if (ocupadoRef.current || !mp) return
    setTentouP(true)
    setErroGeral(null)
    setErroParcial({})
    const primeiro = ORDEM_PARCIAL.find((k) => mp.erros[k])
    if (primeiro) {
      focar(primeiro === 'pq' ? (mp.chips && !mp.chips.outroAberto ? 'g-pq-0' : 'f-pq') : `f-${primeiro}`)
      return
    }
    if (!mp.campos) return
    ocupadoRef.current = true
    setOcupado(true)
    try {
      const ans = await parcial.mutateAsync({ tradeId: t.id, accountId: contaId, payload: partialPayload({ clientKey: chaves.current.parcial, ...mp.campos }) })
      chaves.current.parcial = newClientKey()
      const e = ans.state.exits.find((x) => x.id === ans.exitId)
      const sug = e?.exitPrice ? sugestaoBreakeven(conta, ans.state, e.exitPrice) : null
      const aviso =
        ans.repeated || !ans.partial
          ? null
          : avisoDoLimite({
              market: conta.market,
              tradeDay: ans.state.trade.tradingDay,
              before: ans.limitBefore,
              after: ans.gateNow ? { tradingDay: ans.gateNow.tradingDay, limit: ans.gateNow.limit } : null,
              exitAt: ans.partial.exitAt,
              pref80,
            })
      setCp(CAMPOS_PARCIAL)
      depoisDaEscrita({
        texto: textoParcialRegistrada(conta, ans.state, ans.exitId) ?? '',
        sugestao: sug && e?.exitPrice ? { texto: sug, preco: e.exitPrice } : null,
        aviso: aviso && ans.partial ? textoAviso(conta, aviso, ans.partial.exitAt) : null,
      })
    } catch (x) {
      const err = x instanceof RegistrarDataError ? x : new RegistrarDataError('unknown')
      const campo = err.field ? CAMPO_PARCIAL[err.field] : undefined
      const forma = formaDaOperacao(conta.market, t)
      if (campo && err.code !== 'not_open' && err.code !== 'unknown_trade') {
        const texto =
          err.code === 'partial_too_large' && forma
            ? PARCIAL.demais(forma.quantidade.sufixo(view.position.open ?? '0'))
            : err.code === 'exit_in_future'
              ? PARCIAL.futura(horaRel(conta, now))
              : err.code === 'exit_before_entry'
                ? PARCIAL.antes(hora(conta, t.entryTime))
                : err.code === 'pnl_required'
                  ? ERROS_PRECOS.resVazio
                  : err.code === 'bad_pnl'
                    ? ERROS_PRECOS.resNumero
                    : err.code === 'bad_quantity'
                      ? mp.erros.pq ?? ERROS.qtdVazia
                      : err.code === 'bad_time'
                        ? ERROS.hora
                        : mp.erros[campo] ?? ERRO_REGISTRAR[err.code]
        const alvo = campo === 'pq' ? (mp.chips && !mp.chips.outroAberto ? 'g-pq-0' : 'f-pq') : campo === 'pres' ? 'f-pres' : `f-${campo}`
        if (campo === 'pres' && !mp.bloco.campo && mp.bloco.corrigir) setCp((c) => ({ ...c, corrigir: true, resultado: '' }))
        setErroParcial({ [campo]: texto })
        const codigo = err.code
        requestAnimationFrame(() => {
          const el = document.getElementById(alvo)
          if (el) el.focus()
          else {
            setErroParcial({})
            setErroGeral({ code: codigo, de: '3c' })
          }
        })
      } else await recusa3c(err)
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  const registrarStop = async () => {
    if (ocupadoRef.current || !mst) return
    setTentouS(true)
    setErroGeral(null)
    setErroStop({})
    const primeiro = ORDEM_STOP.find((k) => mst.erros[k])
    if (primeiro) {
      focar(primeiro === 'sModo' ? 'g-sModo-0' : `f-${primeiro}`)
      return
    }
    if (!mst.campos) return
    ocupadoRef.current = true
    setOcupado(true)
    try {
      const ans = await mover.mutateAsync({ tradeId: t.id, payload: movePayload({ clientKey: chaves.current.stop, ...mst.campos }) })
      chaves.current.stop = newClientKey()
      setCs(CAMPOS_STOP)
      depoisDaEscrita({ texto: textoStopRegistrado(conta, ans.state, ans.moveId) ?? '', sugestao: null, aviso: null })
    } catch (x) {
      const err = x instanceof RegistrarDataError ? x : new RegistrarDataError('unknown')
      const forma = formaDaOperacao(conta.market, t)
      const campo: CampoStop | null =
        err.field === 'stop_price' ? (err.code === 'same_stop' && mst.modo === 'be' ? 'sModo' : 'sNovo') : err.field === 'price_now' ? 'sAgora' : null
      if (campo && forma && err.code !== 'not_open' && err.code !== 'unknown_trade') {
        const lado = t.direction === 'short' ? STOP.ladoVenda : STOP.ladoCompra
        const opcao = forma.tipo === 'opcao'
        const temAgora = cs.agora.trim() !== ''
        const lido = lerNumero(cs.agora, { ponto: forma.pontoDecimal })
        const longe =
          lido.ok && t.entryPrice !== null && forma.spec.stops === 'pips'
            ? cmp(abs(numeric(favorOf(forma.spec, t.direction === 'short' ? -1 : 1, t.entryPrice, lido.value))), numeric('10000000000')) >= 0
            : false
        const texto =
          err.code === 'same_stop'
            ? STOP.jaEsta(precoDe(forma, view.position.stopNow ?? t.entryPrice ?? '0'))
            : err.code === 'bad_stop'
              ? campo === 'sAgora' || temAgora
                ? lado
                : STOP.zero
              : err.code === 'bad_price'
                ? !temAgora
                  ? opcao
                    ? STOP.agoraVazioPremio
                    : STOP.agoraVazio
                  : longe
                    ? STOP.agoraLonge
                    : opcao
                      ? STOP.agoraZeroPremio
                      : STOP.agoraZero
                : mst.erros[campo] ?? ERRO_REGISTRAR[err.code]
        setErroStop({ [campo]: texto })
        const alvo = campo === 'sModo' ? 'g-sModo-0' : `f-${campo}`
        const codigo = err.code
        requestAnimationFrame(() => {
          const el = document.getElementById(alvo)
          if (el) el.focus()
          else {
            setErroStop({})
            setErroGeral({ code: codigo, de: '3c' })
          }
        })
      } else await recusa3c(err)
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  const confirmarDesfazerEvento = async () => {
    if (ocupadoRef.current || !undo) return
    ocupadoRef.current = true
    setOcupado(true)
    setErroGeral(null)
    const ev = undo
    try {
      const ans = await desfazerEv.mutateAsync({ tradeId: t.id, accountId: contaId, payload: undoEventPayload(ev.kind, ev.id) })
      const desfeito =
        ev.kind === 'parcial' ? ans.state.exits.find((x) => x.id === ev.id)?.voidedAt : ans.state.stopMoves.find((x) => x.id === ev.id)?.voidedAt
      depoisDaEscrita({
        texto: textoDepoisDoUndo(conta, { kind: ev.kind, hora: ev.hora }, desfeito ?? ans.state.serverNow, {
          market: conta.market,
          tradeDay: ans.state.trade.tradingDay,
          before: ans.limitBefore,
          after: ans.limitAfter,
          pref80,
        }),
        sugestao: null,
        aviso: null,
      })
    } catch (x) {
      const err = x instanceof RegistrarDataError ? x : new RegistrarDataError('unknown')
      setUndoAberto(false)
      if (err.code === 'undo_too_late') setUndoNegado(`${ev.kind}-${ev.id}`)
      await recusa3c(err, true)
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
        setErroGeral({ code: err.code, de: 'antes' })
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
  // E19: a pill sets the mode, clears every form's «tentou», closes an open undo confirmation and drops the suggestion (RO js l.1755)
  const escolherModo = (m: ModoAberta) => {
    setModoEscolhido(m)
    setTentou(false)
    setTentouP(false)
    setTentouS(false)
    setErroCampo(null)
    setErroParcial({})
    setErroStop({})
    setUndoAberto(false)
    setAcaoSt((a) => (a ? { ...a, sugestao: null } : null))
  }
  const textoAlerta = erroGeral ? (erroGeral.de === '3c' ? ERRO_3C[erroGeral.code] ?? ERRO_REGISTRAR[erroGeral.code] : ERRO_REGISTRAR[erroGeral.code]) : null
  const primaria = binaria
    ? { rotulo: RODAPE.registrarResultado, aoClicar: () => void registrar() }
    : modo === 'parcial'
      ? { rotulo: ACOES.registrarParcial, aoClicar: () => void registrarParcial() }
      : modo === 'stop'
        ? { rotulo: ACOES.registrarStop, aoClicar: () => void registrarStop() }
        : { rotulo: RODAPE.registrarSaida, aoClicar: () => void registrar() }

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
        {regra && <span className="hub-nota">{regra}</span>}
      </div>
      {agora && <BlocoAgora modelo={agora} />}
      {tempo && (
        <LinhaDoTempo
          itens={tempo}
          focoLink={focoLink}
          undo={
            undo && {
              evento: { kind: undo.kind, id: undo.id },
              aria: undo.aria,
              ate: undo.ate,
              pergunta: undo.pergunta,
              aberto: undoAberto,
              ocupado,
              aoAbrir: () => setUndoAberto(true),
              aoConfirmar: () => void confirmarDesfazerEvento(),
              aoManter: () => {
                setUndoAberto(false)
                setFocoLink((n) => n + 1)
              },
            }
          }
        />
      )}
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
        {!vencida && notaParcial && <p className="hub-reg-txt">{notaParcial}</p>}
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

      {!binaria && modos.length > 0 && (
        <>
          <AcoesAberta modos={modos} modo={modo} aoEscolher={escolherModo} />
          <p ref={acaoRef} id="reg-acao-st" role="status" tabIndex={-1} className={acaoSt?.texto ? 'hub-reg-st' : 'sr-only'}>
            {acaoSt?.texto ?? ''}
          </p>
          {acaoSt?.sugestao && (
            <SugestaoBreakeven
              texto={acaoSt.sugestao.texto}
              aoMover={() => {
                const preco = acaoSt.sugestao?.preco
                setModoEscolhido('stop')
                setCs({ modo: 'be', novo: '', agora: preco ? precoParaCampo(conta.market, t, preco) : '' })
                setTentou(false)
                setTentouP(false)
                setTentouS(false)
                setErroStop({})
                setAcaoSt((a) => (a ? { ...a, sugestao: null } : null))
                requestAnimationFrame(() => focar(PRIMARIA_ID))
              }}
            />
          )}
          {acaoSt?.aviso && (
            <p className={acaoSt.aviso.atingido ? 'hub-reg-aviso-lim hub-reg-aviso-lim--atingido' : 'hub-reg-aviso-lim'} role="status">
              {acaoSt.aviso.texto}
            </p>
          )}
        </>
      )}

      {ms && modo === 'saida' && (
        <>
          {ms.nota && <span className="hub-nota hub-rp-nota-sai">{ms.nota}</span>}
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
          <BlocoResultado
            linha={ms.previa}
            bloco={ms.bloco}
            erroRes={erroSaida.res ?? doServidor('res')}
            erroCustos={ms.erros.custos ?? doServidor('custos')}
            aoCorrigir={() => {
              const abrir = !campos.corrigir
              mudarCampos(abrir ? { corrigir: true, resultado: ms.bloco?.calculado ?? '' } : { corrigir: false, resultado: '' })
              if (abrir) requestAnimationFrame(() => focar('f-res'))
            }}
            aoMudarRes={(v) => mudarCampos({ resultado: v })}
            aoMudarCustos={(v) => mudarCampos({ custos: v })}
          />
        </>
      )}
      {mp && (
        <FormParcial
          modelo={mp}
          campos={cp}
          tentou={tentouP}
          erroServidor={erroParcial}
          aoMudar={(patch) => {
            setCp((c) => ({ ...c, ...patch }))
            setErroParcial({})
          }}
        />
      )}
      {mst && (
        <FormMoverStop
          modelo={mst}
          campos={cs}
          tentou={tentouS}
          erroServidor={erroStop}
          aoMudar={(patch) => {
            setCs((c) => ({ ...c, ...patch }))
            setErroStop({})
          }}
        />
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
      {mr && (
        <div className="hub-linha-i">
          <span className="hub-num" role="status">
            {mr.previa}
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
                {perguntaDesfazerEntrada(conta, view)}
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

      {textoAlerta && (
        <div ref={alertaRef} role="alert" className="hub-alerta">
          {textoAlerta}
        </div>
      )}
      <Rodape
        esquerda={{ rotulo: RODAPE.novaEntrada, aoClicar: aoNovaEntrada }}
        primaria={{ id: PRIMARIA_ID, rotulo: primaria.rotulo, aoClicar: primaria.aoClicar, ocupado }}
        ocupado={ocupado}
      />
    </div>
  )
}

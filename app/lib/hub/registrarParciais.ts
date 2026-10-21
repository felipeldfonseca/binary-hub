/**
 * Phase 3c · lane C1: the open and closed trade with partial exits and stop moves, as the sheet
 * writes them (approved board RegistrarOperacao.dc.html, 21 Oct 2026, scenarios 6–9 and 14–16):
 *
 *   step 2   «O que registrar agora?» (Saída · Parcial · Mover stop), the rule line of the summary,
 *            «Agora», «Linha do tempo» with «Desfazer», the marks note after the first partial,
 *            «Parcial», «Mover stop», the breakeven suggestion, the exit of what is still open and
 *            the action status after each write
 *   step 3   the average exit, R on the initial stop, the timeline and the breakeven line
 *   lists    the chooser's «… em aberto» and the bridge's second line
 *
 * Pure: no React, no client; time is an input (the server's clock). The words are copyParciais'
 * (and copyRegra's, copy's); the money rules are the domain's (lib/domain/registro), which mirror
 * the database. On screen a «breakeven» is a stop exactly at the entry price, whatever kind the
 * server stored (contract §3.4.1), and the points in favour always come from prices (§3.4.2).
 *
 * Layer 3 (contract §6.1): imports registrarForm's frozen exports and registrarRegra, never
 * registrarSaidas.
 */
import { hmOn, formatHhMm, parseHhMm } from '@/lib/domain/tempo'
import type { AccountMarket, Currency } from '@/lib/domain/markets'
import { currencyOf, type LimitCheck } from '@/lib/domain/gate'
import {
  averageExit,
  breakevenSuggestion,
  canSplit,
  countingExits,
  dayLimitOf,
  exitInstant,
  favorOf,
  firstExitCut,
  halfOpen,
  ifStopped,
  pnlFromPrices,
  positionOf,
  riskAtStop,
  riskBeyondLimit,
  stopAtBreakeven,
  stopNowStatus,
  type MoveFields,
  type PartialFields,
  type StopMove,
  type TradeExit,
} from '@/lib/domain/registro'
import { abs, add, cmp, fromInt, isMultipleOf, mul, numeric, numericText, plainText, round, sub } from '@/lib/domain/registro/numeric'
import { ABERTA, ERROS, ERROS_PRECOS, FECHADA, FUTUROS, QTD, RESULTADO, RISCO } from '@/components/hub/registrar/copy'
import {
  ABERTA_3C,
  ACOES,
  AGORA,
  DESFAZER_EV,
  ESCOLHA_3C,
  FECHADA_3C,
  PARCIAL,
  STOP,
  SUGESTAO,
  TEMPO,
} from '@/components/hub/registrar/copyParciais'
import { REGRA_BE } from '@/components/hub/registrar/copyRegra'
import { OPERACOES_DIA } from '@/components/hub/diario/copy'
import type { AccountNow } from './regras'
import { formatMoney } from './formato'
import { formatDecimal, lerNumero } from './numero'
import { dinheiroCompacto } from './posso'
import { formaDoAtivo, type FormaAtivo } from './registrarAtivos'
import type { RegisteredTrade, TradeEvents, TradeState, TradeView } from './registrarDb'
import {
  cartaoFechada,
  centavos,
  desdeTexto,
  diaRelativo,
  diferencaTexto,
  distanciaDoStop,
  hora,
  horaRel,
  linhaDepois,
  linhaEscolha,
  mercadoNovo,
  modeloSaida,
  opTexto,
  periodo,
  precoDe,
  sufixoCampo,
  type BlocoResultadoModelo,
  type CartaoFechada,
  type ContaReg,
  type ModeloSaida,
  type SaidaCampos,
} from './registrarForm'
import { linhaRegra, textoAFavor, textoN } from './registrarRegra'

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

/** What step 2 and 3 can do on a price market (binaries: nothing new) */
export type ModoAberta = 'saida' | 'parcial' | 'stop'

/** A trade's exits and stop moves (the bridge and the chooser read them apart: useTradeEvents) */
export interface EventosDaOperacao {
  exits: TradeExit[]
  stopMoves: StopMove[]
}

/** The instrument's form of a stored trade (crypto: its stored pair; an option: its contract) */
export function formaDaOperacao(market: AccountMarket, t: Pick<RegisteredTrade, 'symbol' | 'option' | 'assetType'>): FormaAtivo | null {
  if (market === 'binary') return null
  return formaDoAtivo(market, t.symbol, { opcao: !!t.option || t.assetType === 'option' })
}

const sgnDe = (t: Pick<RegisteredTrade, 'direction'>): 1 | -1 => (t.direction === 'short' ? -1 : 1)
const lado = (t: Pick<RegisteredTrade, 'direction'>): 'long' | 'short' => (t.direction === 'short' ? 'short' : 'long')
/** (price − entry) × side, decimal text */
const difDe = (price: string, entry: string, sgn: 1 | -1) => numericText(mul(sub(numeric(price), numeric(entry)), fromInt(sgn)))
const plain = (q: string) => plainText(numeric(q))
const igual = (a: string | null, b: string | null) => a !== null && b !== null && cmp(numeric(a), numeric(b)) === 0
const ehUm = (q: string) => cmp(numeric(q), fromInt(1)) === 0
const dinheiro = (decimal: string, currency: Currency) => formatMoney(decimal, { signed: true, currency })
const moedaPal = (currency: Currency) => (currency === 'BRL' ? RISCO.reais : RISCO.dolar)
const moedaSimbolo = (currency: Currency) => (currency === 'BRL' ? 'R$' : 'US$')
const casasDe = (decimal: string) => (decimal.includes('.') ? decimal.length - decimal.indexOf('.') - 1 : 0)
const inteirosDe = (decimal: string) => decimal.replace(/^-/, '').split('.')[0].replace(/^0+(?=\d)/, '').length
const naoMultiplo = (value: string, tick: string | null) => !!tick && !isMultipleOf(numeric(value), numeric(tick))
const passoDe = (forma: FormaAtivo) => (forma.tickTexto ? FUTUROS.passo(forma.nomePasso, forma.tickTexto) : '')
/** «−US$ 300» (the banners' compact money) */
const compactoNeg = (cents: number, currency: Currency) => `${cents < 0 ? '−' : ''}${dinheiroCompacto(cents, currency)}`

/** «3» · «1,00» (lots) · «0,25»: the number of a quantity, as «de 3» writes it (RO `fmtQ`) */
function qtdNumero(forma: FormaAtivo, q: string): string {
  return forma.quantidade.tipo === 'lotes' ? formatDecimal(plain(q), { minDecimals: 2 }) : formatDecimal(plain(q))
}

/** «10:18» · «ontem, 10:52» · «21 out, 10:52»: a timeline time (RO `hT`) */
export function horaDoItem(conta: Pick<ContaReg, 'clock'>, at: Date, now: Date): string {
  const d = diaRelativo(conta, at, now)
  const h = hora(conta, at)
  return d === '' ? h : d === 'ontem' ? TEMPO.ontem(h) : TEMPO.noDia(d, h)
}

/** The live stop moves not undone, oldest first (by the server's time, then id) */
const movesVivos = (moves: readonly StopMove[]) =>
  moves.filter((m) => m.voidedAt === null).sort((a, b) => a.movedAt.getTime() - b.movedAt.getTime() || a.id - b.id)

/** The current move: the newest live move not undone (told moves never count; RO `movAtual`) */
export function movimentoAtual(moves: readonly StopMove[]): StopMove | null {
  const live = movesVivos(moves).filter((m) => m.origin === 'live')
  return live.length ? live[live.length - 1] : null
}

/** The counting partials of a trade (app rows of kind «parcial» that count) */
const parciaisContando = (exits: readonly TradeExit[]) => countingExits(exits).filter((e) => e.kind === 'parcial')

// ---------------------------------------------------------------------------------------------
// The readers of «Parcial» and «Mover stop» (the as-built rules of 3-4, their own empty words;
// pinned to registrarForm's private readers by a test on shared inputs)
// ---------------------------------------------------------------------------------------------

export type Lido = { value: string | null; erro?: string }

/**
 * A price field: empty, numbers, above zero (an option's premium may be 0 where `zeroOk`), the
 * server's digits, `extra` (a check of its own before the tick), the tick, the decimals
 */
export function lerPreco(
  forma: FormaAtivo,
  text: string,
  o: { vazio: string; zero: string; exemplo: string; zeroOk?: boolean; extra?: (value: string) => string | null },
): Lido {
  const n = lerNumero(text, { ponto: forma.pontoDecimal })
  if (!n.ok) return { value: null, erro: n.reason === 'empty' ? o.vazio : ERROS_PRECOS.numero(o.exemplo) }
  const v = numeric(n.value)
  if (cmp(v, fromInt(0)) < 0 || (cmp(v, fromInt(0)) === 0 && !o.zeroOk)) return { value: null, erro: o.zero }
  if (inteirosDe(n.value) > 10) return { value: null, erro: ERROS_PRECOS.numero(o.exemplo) }
  const extra = o.extra?.(n.value)
  if (extra) return { value: null, erro: extra }
  if (naoMultiplo(n.value, forma.spec.tick)) return { value: null, erro: ERROS.precoPasso(forma.nomePasso, forma.tickTexto ?? '') }
  if (forma.casasMax !== null && casasDe(n.value) > forma.casasMax) return { value: null, erro: ERROS_PRECOS.casas(forma.casasMax) }
  return { value: n.value }
}

/** A quantity typed in the field (the chips need no reading): whole numbers, decimals, the server's digits */
export function lerQuantidadeTexto(forma: FormaAtivo, text: string): Lido {
  const q = forma.quantidade
  const n = lerNumero(text)
  if (!n.ok) return { value: null, erro: n.reason === 'empty' ? ERROS.qtdVazia : ERROS_PRECOS.numero(q.exemplo) }
  if (cmp(numeric(n.value), fromInt(0)) <= 0) return { value: null, erro: ERROS.qtdZero }
  if (q.inteira && !/^[0-9]+$/.test(n.value)) {
    return { value: null, erro: q.tipo === 'acoesB3' ? ERROS_PRECOS.qtdInteiraAcoes : q.tipo === 'unidades' ? ERROS_PRECOS.qtdInteira : ERROS.qtdInteira }
  }
  if (q.inteira && n.value.length > 6) return { value: null, erro: ERROS_PRECOS.numero(q.exemplo) }
  if (!q.inteira && casasDe(n.value) > q.casas) return { value: null, erro: ERROS_PRECOS.casas(q.casas) }
  if (!q.inteira && inteirosDe(n.value) > 10) return { value: null, erro: ERROS_PRECOS.numero(q.exemplo) }
  return { value: n.value }
}

/** A typed result (signed): up to 16 digits and 2 decimals; empty is its own case */
export function lerDinheiroSinal(text: string): Lido & { vazio: boolean } {
  const n = lerNumero(text, { sinal: true })
  if (!n.ok) return { value: null, vazio: n.reason === 'empty', erro: n.reason === 'empty' ? undefined : ERROS_PRECOS.resNumero }
  if (inteirosDe(n.value) > 16) return { value: null, vazio: false, erro: ERROS_PRECOS.resNumero }
  if (casasDe(n.value) > 2) return { value: null, vazio: false, erro: ERROS_PRECOS.casas(2) }
  return { value: n.value, vazio: false }
}

// ---------------------------------------------------------------------------------------------
// Step 2 · the frame
// ---------------------------------------------------------------------------------------------

/** E19: the modes a trade offers ([] on binaries; «Parcial» only while the open quantity can be split) */
export function modosDaAberta(conta: Pick<ContaReg, 'market'>, view: Pick<TradeView, 'trade' | 'position'>): ModoAberta[] {
  const forma = formaDaOperacao(conta.market, view.trade)
  if (!forma) return []
  return canSplit(forma.spec, view.position.open) ? ['saida', 'parcial', 'stop'] : ['saida', 'stop']
}

/** E14: «Sua regra: breakeven com +8 pts, em 7.920,50.» while the stop is not at or beyond the entry (or there is none) */
export function regraNoResumo(conta: Pick<ContaReg, 'market'>, view: Pick<TradeView, 'trade' | 'position' | 'breakeven'>): string | null {
  if (!view.breakeven) return null
  const forma = formaDaOperacao(conta.market, view.trade)
  if (!forma) return null
  if (stopAtBreakeven(sgnDe(view.trade), view.trade.entryPrice, view.position.stopNow)) return null
  return linhaRegra(forma, view.breakeven)
}

export interface LinhaAgora {
  rotulo: string
  valor: string
  sub: string
  tom: 'mint' | 'red' | 'neutral'
}

export interface ModeloAgora {
  linhas: LinhaAgora[]
  /** «Se o stop for atingido: −US$ 60,00 no total.»; null without a stop or where the result is typed */
  seStop: string | null
}

/** E15 «Agora»: only after a partial or a live move not undone */
export function modeloAgora(conta: ContaReg, view: TradeView): ModeloAgora | null {
  const t = view.trade
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null) return null
  const p = view.position
  const mAt = movimentoAtual(view.stopMoves)
  if (p.partials === 0 && !mAt) return null
  const sgn = sgnDe(t)
  const open = p.open ?? '0'
  const linhas: LinhaAgora[] = [
    { rotulo: AGORA.emAberto, valor: forma.quantidade.sufixo(open), sub: AGORA.de(qtdNumero(forma, p.quantity ?? open)), tom: 'neutral' },
  ]
  if (p.stopNow === null) linhas.push({ rotulo: AGORA.stop, valor: '', sub: AGORA.semStop, tom: 'neutral' })
  else {
    let sub: string = AGORA.daEntrada
    if (mAt) {
      const h = hora(conta, mAt.movedAt)
      const st = stopNowStatus(forma.spec, sgn, t.entryPrice, mAt.stopPrice, mAt.kind)
      const dif = difDe(mAt.stopPrice, t.entryPrice, sgn)
      if (st.state === 'breakeven') sub = AGORA.noBe(h)
      else if (st.state === 'garante') sub = AGORA.garante(diferencaTexto(forma, dif), h)
      else if (st.state === 'arrisca') sub = AGORA.arrisca(diferencaTexto(forma, dif).replace(/^[−-]/, ''), h)
    }
    linhas.push({ rotulo: AGORA.stop, valor: precoDe(forma, p.stopNow), sub, tom: 'neutral' })
  }
  if (p.partials > 0) {
    const real = p.realizedPnl ?? '0'
    const s = Math.sign(Number(real))
    linhas.push({ rotulo: AGORA.realizado, valor: dinheiro(real, conta.currency), sub: AGORA.emParciais(p.partials), tom: s > 0 ? 'mint' : s < 0 ? 'red' : 'neutral' })
  }
  const x = ifStopped(forma.spec, sgn, t.entryPrice, open, p.stopNow, p.realizedPnl)
  return { linhas, seStop: x ? AGORA.seStop(`${x.estimate ? RESULTADO.estimativa : ''}${dinheiro(x.total, conta.currency)}`) : null }
}

// ---------------------------------------------------------------------------------------------
// «Linha do tempo» (E16, E32) and «Desfazer» (E16, E17)
// ---------------------------------------------------------------------------------------------

export interface ItemTempo {
  /** A stable React key */
  chave: string
  /** «10:18» / «ontem, 10:52»; null: a told move (no time: «—» and «sem hora») */
  hora: string | null
  /** For <time dateTime> */
  instante: string | null
  texto: string
  /** «registrada às 10:20» */
  sub: string | null
  /** The event «Desfazer» can name (a partial or a live move) */
  evento: { kind: 'parcial' | 'stop'; id: number } | null
}

/** «stop 10 pts» · «stop 12 pips» · «stop do prêmio 1,10» · «stop 38,20» (the stop of the entry) */
function stopDaEntrada(forma: FormaAtivo, t: RegisteredTrade): string | null {
  const v = distanciaDoStop(forma, t, t.stopPrice)
  if (!v) return null
  const u = forma.unidadeStop
  return u === 'pts' ? TEMPO.stopPts(v) : u === 'pips' ? TEMPO.stopPips(v) : u === 'premio' ? TEMPO.stopPremio(v) : TEMPO.stopPreco(v)
}

/** « · +US$ 40,00» · « · ≈ +US$ 21,85» · « · +US$ 105,00, digitado» ('' without a result) */
function dinDaSaida(pnl: string | null, basis: string | null, currency: Currency): string {
  if (pnl === null) return ''
  return TEMPO.din(dinheiro(pnl, currency), basis === 'estimate', basis === 'typed')
}

/**
 * E16 (step 2) and E32 (step 3): the entry, the exits that count (typed hour), the stop moves not
 * undone (server's time; a told one without time, right after the first exit when there are two
 * or more, else right after the entry), in time order (ties: entry, told move, partial, move, exit).
 * A closed trade without exit rows (one exit) gets one «Saída» item from its own columns.
 */
export function linhaDoTempo(conta: ContaReg, view: TradeView, now: Date, opcoes: { comUndo: boolean } = { comUndo: true }): ItemTempo[] {
  const t = view.trade
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null) return []
  const sgn = sgnDe(t)
  const entry = t.entryPrice
  const ao = view.context?.origin ?? (t.source === 'after' ? 'reconstructed' : 'live')
  type Bruto = ItemTempo & { t: number; o: number; id: number }
  const it: Bruto[] = [
    {
      chave: 'entrada',
      hora: horaDoItem(conta, t.entryTime, now),
      instante: t.entryTime.toISOString(),
      texto: TEMPO.entrada(forma.quantidade.sufixo(t.quantity ?? '0'), precoDe(forma, entry), stopDaEntrada(forma, t)),
      sub: null,
      evento: null,
      t: t.entryTime.getTime(),
      o: 0,
      id: 0,
    },
  ]
  const contando = countingExits(view.exits)
  const numerar = contando.length >= 2 && (t.source === 'after' || ao === 'reconstructed' || contando.some((e) => e.origin === 'file'))
  if (contando.length === 0 && t.status === 'closed' && t.exitTime && t.exitPrice !== null) {
    const dif = diferencaTexto(forma, difDe(t.exitPrice, entry, sgn))
    it.push({
      chave: 'saida',
      hora: horaDoItem(conta, t.exitTime, now),
      instante: t.exitTime.toISOString(),
      texto: TEMPO.saida(forma.quantidade.sufixo(t.quantity ?? '0'), precoDe(forma, t.exitPrice), dif, dinDaSaida(t.pnl, t.pnlBasis, conta.currency)),
      sub: null,
      evento: null,
      t: t.exitTime.getTime(),
      o: 3,
      id: 0,
    })
  }
  contando.forEach((e, j) => {
    const p = e.exitPrice ?? '0'
    const q = forma.quantidade.sufixo(e.quantity)
    const dif = diferencaTexto(forma, difDe(p, entry, sgn))
    const din = dinDaSaida(e.pnl, e.pnlBasis, conta.currency)
    const parcial = e.kind === 'parcial'
    const texto = numerar ? TEMPO.nSaida(j + 1, q, precoDe(forma, p), dif, din) : parcial ? TEMPO.parcial(q, precoDe(forma, p), dif, din) : TEMPO.saida(q, precoDe(forma, p), dif, din)
    const reg = ao === 'live' && e.origin === 'app' && parcial && hora(conta, e.registeredAt) !== hora(conta, e.exitTime) ? TEMPO.registrada(hora(conta, e.registeredAt)) : null
    it.push({
      chave: `x-${e.id}`,
      hora: horaDoItem(conta, e.exitTime, now),
      instante: e.exitTime.toISOString(),
      texto,
      sub: reg,
      evento: e.origin === 'app' && parcial ? { kind: 'parcial', id: e.id } : null,
      t: e.exitTime.getTime(),
      o: e.kind === 'final' ? 3 : 1,
      id: e.id,
    })
  })
  for (const m of movesVivos(view.stopMoves)) {
    const fav = m.priceNow !== null ? textoAFavor(forma, entry, m.priceNow, lado(t), false) : null
    if (m.origin === 'reconstructed') {
      const depois = contando.length >= 2
      it.push({
        chave: `m-${m.id}`,
        hora: null,
        instante: null,
        texto: TEMPO.beDepois(fav),
        sub: null,
        evento: null,
        t: depois ? contando[0].exitTime.getTime() : t.entryTime.getTime(),
        o: depois ? 1.5 : 0.5,
        id: m.id,
      })
    } else {
      const p = precoDe(forma, m.stopPrice)
      it.push({
        chave: `m-${m.id}`,
        hora: horaDoItem(conta, m.movedAt, now),
        instante: m.movedAt.toISOString(),
        texto: igual(m.stopPrice, entry) ? TEMPO.stopBe(p, fav) : TEMPO.stopMovido(p, fav),
        sub: null,
        evento: { kind: 'stop', id: m.id },
        t: m.movedAt.getTime(),
        o: 2,
        id: m.id,
      })
    }
  }
  return it
    .sort((a, b) => a.t - b.t || a.o - b.o || a.id - b.id)
    .map(({ t: _t, o: _o, id: _id, ...x }) => (opcoes.comUndo ? x : { ...x, evento: null }))
}

export interface ModeloDesfazer {
  kind: 'parcial' | 'stop'
  id: number
  /** «Desfazer a parcial das 10:18» */
  aria: string
  /** «Até 10:33, 15 minutos depois do registro.» */
  ate: string
  /** The confirmation's question */
  pergunta: string
  /** The event's hour as the texts name it (the partial's typed hour, the move's server time) */
  hora: string
  until: Date
}

/**
 * E16 link and E17 texts: the newest partial or live move (position.undo), while the trade is open
 * and the server's now is before its deadline; null otherwise
 */
export function desfazerEvento(conta: ContaReg, view: TradeView, now: Date): ModeloDesfazer | null {
  const t = view.trade
  const u = view.position.undo
  const forma = formaDaOperacao(conta.market, t)
  if (!u || !forma || t.status !== 'open' || now.getTime() >= u.until.getTime()) return null
  const ate = ABERTA.desfazerAte(hora(conta, u.until))
  if (u.kind === 'parcial') {
    const e = view.exits.find((x) => x.id === u.id && x.origin === 'app' && x.kind === 'parcial' && x.voidedAt === null)
    if (!e) return null
    const h = hora(conta, e.exitTime)
    const volta = plainText(add(numeric(view.position.open ?? '0'), numeric(e.quantity)))
    return {
      kind: 'parcial',
      id: u.id,
      aria: DESFAZER_EV.ariaParcial(h),
      ate,
      pergunta: DESFAZER_EV.perguntaParcial(h, forma.quantidade.sufixo(e.quantity), precoDe(forma, e.exitPrice ?? '0'), forma.quantidade.sufixo(volta)),
      hora: h,
      until: u.until,
    }
  }
  const m = view.stopMoves.find((x) => x.id === u.id && x.origin === 'live' && x.voidedAt === null)
  if (!m) return null
  const h = hora(conta, m.movedAt)
  // The level it goes back to: the move before it (not undone), else the stop of the entry
  const antes = movesVivos(view.stopMoves.filter((x) => x.id !== m.id)).filter((x) => x.movedAt.getTime() < m.movedAt.getTime() || (x.movedAt.getTime() === m.movedAt.getTime() && x.id < m.id))
  const volta = antes.length ? antes[antes.length - 1].stopPrice : t.stopPrice
  return {
    kind: 'stop',
    id: u.id,
    aria: DESFAZER_EV.ariaStop(h),
    ate,
    pergunta: DESFAZER_EV.perguntaStop(h, precoDe(forma, m.stopPrice), volta === null ? null : precoDe(forma, volta)),
    hora: h,
    until: u.until,
  }
}

/** E18: «Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.» while a partial counts */
export function notaPrimeiraParcial(conta: ContaReg, view: Pick<TradeView, 'exits'>): string | null {
  if (parciaisContando(view.exits).length === 0) return null
  const cut = firstExitCut(view.exits)
  return cut ? ABERTA_3C.notaPrimeiraParcial(hora(conta, cut)) : null
}

/** E27: «Desfazer entrada»'s question, naming the partials and the moves that go with the trade */
export function perguntaDesfazerEntrada(conta: ContaReg, view: TradeView): string {
  const t = view.trade
  const op = opTexto(t, conta.market)
  const parciais = parciaisContando(view.exits).length > 0
  const movimentos = view.stopMoves.some((m) => m.origin === 'live' && m.voidedAt === null)
  return parciais || movimentos ? ABERTA_3C.desfazerPergunta(hora(conta, t.entryTime), op, parciais, movimentos) : ABERTA.desfazerPergunta(hora(conta, t.entryTime), op)
}

// ---------------------------------------------------------------------------------------------
// «Saída» after partials (E23)
// ---------------------------------------------------------------------------------------------

/**
 * The exit of what is still open: the as-built exit on the open quantity; with partials, «Sai com
 * os 2 ct em aberto.», « · no total …» on the preview, the hour not before the last partial and
 * «… Da operação toda.» on the costs. The payload is unchanged (the server closes the rest).
 */
export function saidaComParciais(conta: ContaReg, view: TradeView, c: SaidaCampos, now: Date, tentou: boolean): ModeloSaida & { nota: string | null } {
  const t = view.trade
  const p = view.position
  const comParciais = p.partials > 0 && p.open !== null
  const base = modeloSaida(conta, comParciais ? { ...t, quantity: p.open } : t, c, now, tentou)
  if (!comParciais) return { ...base, nota: null }
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null) return { ...base, nota: null }
  const open = p.open as string
  const out: ModeloSaida & { nota: string | null } = { ...base, erros: { ...base.erros }, nota: ACOES.saiCom(forma.quantidade.sufixo(open), ehUm(open)) }
  // « · no total»: what was realized and what the rest makes at this price (the computed one)
  const lido = lerNumero(base.precoCampo, { ponto: forma.pontoDecimal })
  if (!base.erros.spreco && lido.ok && base.bloco && base.bloco.calculado !== null) {
    const resto = pnlFromPrices(forma.spec, sgnDe(t), open, t.entryPrice, lido.value)
    if (resto !== null) {
      const total = numericText(round(add(numeric(resto), numeric(p.realizedPnl ?? '0')), 2))
      const est = forma.modo === 'estimativa' ? RESULTADO.estimativa : ''
      out.previa = `${base.previa}${ACOES.noTotal(`${est}${dinheiro(total, conta.currency)}`)}`
      out.bloco = { ...base.bloco, linha: out.previa }
    }
  }
  if (out.bloco?.custos) out.bloco = { ...out.bloco, custos: { ...out.bloco.custos, nota: `${out.bloco.custos.nota}${ACOES.daOperacao}` } }
  // Not before the last partial (register_exit's exit_before_partial)
  if (!out.erros.shora) {
    const hm = parseHhMm(base.horaCampo)
    const ultima = parciaisContando(view.exits).reduce<Date | null>((m, e) => (m === null || e.exitTime.getTime() > m.getTime() ? e.exitTime : m), null)
    if (hm !== null && ultima) {
      const x = exitInstant(formatHhMm(hm), conta.clock, now, t.entryTime)
      if (x.ok && x.at.getTime() < ultima.getTime()) {
        out.erros.shora = ACOES.saidaAntesParcial(hora(conta, ultima))
        out.payload = null
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// «Parcial» (E24)
// ---------------------------------------------------------------------------------------------

export interface CamposParcial {
  /** The chip pressed (decimal text); null = the first chip */
  chip: string | null
  /** «Outro» is pressed (contracts, more than 5 open) */
  outro: boolean
  /** The quantity field (lots, shares, coins; or «Quantos contratos?») as typed */
  qtd: string
  preco: string
  /** null = the current minute (ticks with the server's clock while untouched) */
  hora: string | null
  /** «Corrigir» is open */
  corrigir: boolean
  /** The typed result, or the correction */
  resultado: string
}

export const CAMPOS_PARCIAL: CamposParcial = { chip: null, outro: false, qtd: '', preco: '', hora: null, corrigir: false, resultado: '' }

/** The order of «Parcial»'s fields: where the focus goes on «Registrar parcial» */
export const ORDEM_PARCIAL = ['pq', 'ppreco', 'phora', 'pres'] as const
export type CampoParcial = (typeof ORDEM_PARCIAL)[number]

export interface ModeloParcial {
  /** «Contratos» · «Lotes» · «Ações» · «Quantidade, em BTC» · «Quantidade» */
  rotuloQtd: string
  /** Contracts: chips 1…open−1 (open ≤ 5), else 1 2 3 + «Outro»; null: the field */
  chips: { valores: string[]; outro: boolean; escolhido: string | null; outroAberto: boolean; outroRotulo: string } | null
  /** «Metade»: the field's text it puts («0,25»); null when not offered */
  metade: string | null
  /** «Ficam 2 ct em aberto.» / «Fica 1 ct em aberto.» / «Em aberto: 3 ct.» */
  ficam: string
  /** B3's lot note, when the partial or the rest is off the lot of 100 */
  lote: string | null
  rotulos: { preco: string; hora: string }
  horaCampo: string
  bloco: BlocoResultadoModelo
  erros: Partial<Record<CampoParcial, string>>
  /** What «Registrar parcial» sends (partialPayload adds the client_key); null while a field is wrong */
  campos: Omit<PartialFields, 'clientKey'> | null
  /** The partial's quantity and price, read */
  quantidade: string | null
  preco: string | null
}

/** «Parcial»: the quantity (chips or field + «Metade»), the price and hour, the preview, «Corrigir» / the typed result */
export function modeloParcial(conta: ContaReg, view: TradeView, c: CamposParcial, now: Date, tentou: boolean): ModeloParcial | null {
  const t = view.trade
  const forma = formaDaOperacao(conta.market, t)
  const open = view.position.open
  if (!forma || t.entryPrice === null || open === null) return null
  const entry = t.entryPrice
  const sgn = sgnDe(t)
  const opcao = forma.tipo === 'opcao'
  const qf = forma.quantidade
  const erros: ModeloParcial['erros'] = {}

  // The quantity
  const usaChips = qf.tipo === 'contratos' || qf.tipo === 'contratosB3'
  let chips: ModeloParcial['chips'] = null
  let qtd: string | null = null
  if (usaChips) {
    const n = Math.trunc(Number(open))
    const valores = n <= 5 ? Array.from({ length: Math.max(0, n - 1) }, (_, i) => String(i + 1)) : ['1', '2', '3']
    const temOutro = n > 5
    const outroAberto = temOutro && c.outro
    const escolhido = outroAberto ? null : c.chip !== null && valores.includes(c.chip) ? c.chip : valores[0] ?? null
    chips = { valores, outro: temOutro, escolhido, outroAberto, outroRotulo: qf.outroRotulo ?? '' }
    if (!outroAberto) qtd = escolhido
  }
  if (!chips || chips.outroAberto) {
    const lido = lerQuantidadeTexto(forma, c.qtd)
    if (lido.erro) erros.pq = lido.erro
    else qtd = lido.value
  }
  if (qtd !== null && cmp(numeric(qtd), numeric(open)) >= 0) {
    erros.pq = PARCIAL.demais(qf.sufixo(open))
    qtd = null
  }
  const resto = qtd !== null ? plainText(sub(numeric(open), numeric(qtd))) : null
  const ficam = resto !== null ? PARCIAL.ficam(qf.sufixo(resto), ehUm(resto)) : PARCIAL.emAberto(qf.sufixo(open))
  const meia = usaChips ? null : halfOpen(forma.spec, open)
  const metade = meia === null ? null : qtdNumero(forma, meia)
  const lote =
    qf.lote100 && qtd !== null && resto !== null && (Number(qtd) % 100 !== 0 || Number(resto) % 100 !== 0) ? QTD.loteB3 : null

  // The price
  const preco = lerPreco(forma, c.preco, {
    vazio: opcao ? PARCIAL.premioVazio : PARCIAL.precoVazio,
    zero: ERROS_PRECOS.zero(opcao ? 'prêmio' : 'preço'),
    exemplo: forma.exemplo,
    zeroOk: opcao,
  })
  if (preco.erro) erros.ppreco = preco.erro

  // The hour
  const atual = hmOn(now, conta.clock)
  const horaCampo = c.hora ?? atual
  const hm = parseHhMm(horaCampo) === null ? null : formatHhMm(parseHhMm(horaCampo) as number)
  if (hm === null) erros.phora = ERROS.hora
  else {
    const x = exitInstant(hm, conta.clock, now, t.entryTime)
    if (!x.ok) erros.phora = x.code === 'exit_in_future' ? PARCIAL.futura(horaRel(conta, now)) : PARCIAL.antes(hora(conta, t.entryTime))
  }

  // The preview and the result block (no «Custos» on a partial: they go on the final exit)
  const lidoSaida = lerNumero(c.preco, { ponto: forma.pontoDecimal })
  const pOut = lidoSaida.ok ? lidoSaida.value : null
  const outOk = !!pOut && (cmp(numeric(pOut), fromInt(0)) > 0 || (opcao && cmp(numeric(pOut), fromInt(0)) === 0))
  let linha: string
  let calc: string | null = null
  if (!outOk) linha = opcao ? PARCIAL.informePremio : PARCIAL.informe
  else if (naoMultiplo(pOut as string, forma.spec.tick)) linha = tentou ? PARCIAL.confira : PARCIAL.confiraPasso(passoDe(forma))
  else if (qtd === null) linha = RESULTADO.informeQuantidade
  else {
    calc = pnlFromPrices(forma.spec, sgn, qtd, entry, pOut as string)
    const valor = calc === null ? RESULTADO.digite(moedaPal(conta.currency)) : `${forma.modo === 'estimativa' ? RESULTADO.estimativa : ''}${dinheiro(calc, conta.currency)}`
    linha = PARCIAL.previa(qf.sufixo(qtd), precoDe(forma, pOut as string), diferencaTexto(forma, difDe(pOut as string, entry, sgn)), valor)
  }
  const novo = mercadoNovo(conta.market)
  const precisa = forma.modo === 'digitado'
  const podeC = novo && !precisa
  const corrAb = podeC && c.corrigir
  const temRes = precisa || corrAb
  const swap = conta.market === 'forex' || conta.market === 'crypto' ? RESULTADO.swap : ''
  const M = moedaSimbolo(conta.currency)
  let pnl: string | undefined
  if (temRes) {
    const r = lerDinheiroSinal(c.resultado)
    if (r.vazio) erros.pres = ERROS_PRECOS.resVazio
    else if (r.erro) erros.pres = r.erro
    else pnl = r.value as string
  }
  const bloco: BlocoResultadoModelo = {
    linha,
    corrigir: podeC && (calc !== null || corrAb) ? { rotulo: corrAb ? RESULTADO.usarCalculado : RESULTADO.corrigir, aberto: corrAb } : null,
    calculado: calc === null ? null : formatDecimal(calc, { minDecimals: 2 }),
    notaEstimativa: forma.modo === 'estimativa' && !temRes ? RESULTADO.notaEstimativa : null,
    campo: temRes
      ? {
          rotulo: precisa ? PARCIAL.campoDigitado(M) : RESULTADO.campoCorrigido(M),
          nota: precisa ? PARCIAL.notaDigitado(moedaPal(conta.currency), swap) : RESULTADO.notaCorrigido(swap),
          valor: c.resultado,
          erro: tentou ? erros.pres ?? null : null,
        }
      : null,
    custos: null,
  }
  const cot = forma.tipo === 'cri' ? forma.moedaCotacao ?? 'USDT' : null
  const ok = qtd !== null && preco.value !== null && !erros.pq && !erros.ppreco && !erros.phora && !erros.pres
  return {
    rotuloQtd: qf.rotulo,
    chips,
    metade,
    ficam,
    lote,
    rotulos: { preco: opcao ? PARCIAL.premio : cot ? PARCIAL.precoEm(cot) : PARCIAL.preco, hora: PARCIAL.hora(sufixoCampo(conta)) },
    horaCampo,
    bloco,
    erros,
    campos: ok ? { quantity: qtd as string, exitPrice: preco.value as string, exit: hm === null || hm === atual ? undefined : hm, clock: conta.clock, pnl } : null,
    quantidade: qtd,
    preco: preco.value,
  }
}

/** E21: the suggestion right after a partial (the trade's rule, the partial's points, the stop still behind the entry) */
export function sugestaoBreakeven(conta: ContaReg, view: TradeView, partialPrice: string): string | null {
  const t = view.trade
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null || !view.breakeven) return null
  const s = breakevenSuggestion(forma.spec, view.breakeven, sgnDe(t), t.entryPrice, partialPrice, view.position.stopNow)
  if (!s) return null
  return SUGESTAO.texto(diferencaTexto(forma, difDe(partialPrice, t.entryPrice, sgnDe(t))), textoN(view.breakeven))
}

/** E20 after a partial: «Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.» (from the answer's state) */
export function textoParcialRegistrada(conta: ContaReg, state: Pick<TradeState, 'trade' | 'exits' | 'position'>, exitId: number): string | null {
  const forma = formaDaOperacao(conta.market, state.trade)
  const e = state.exits.find((x) => x.id === exitId)
  if (!forma || !e) return null
  const resto = state.position.open ?? '0'
  return PARCIAL.registrada(forma.quantidade.sufixo(e.quantity), precoDe(forma, e.exitPrice ?? '0'), horaRel(conta, e.exitTime), PARCIAL.ficam(forma.quantidade.sufixo(resto), ehUm(resto)))
}

/** E20 after a move: «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.» / «Stop movido para …» */
export function textoStopRegistrado(conta: ContaReg, state: Pick<TradeState, 'trade' | 'stopMoves'>, moveId: number): string | null {
  const t = state.trade
  const forma = formaDaOperacao(conta.market, t)
  const m = state.stopMoves.find((x) => x.id === moveId)
  if (!forma || !m || t.entryPrice === null) return null
  const fav = m.priceNow !== null ? `, ${textoAFavor(forma, t.entryPrice, m.priceNow, lado(t), false)}` : ''
  const p = precoDe(forma, m.stopPrice)
  return igual(m.stopPrice, t.entryPrice) ? STOP.movidoBe(p, horaRel(conta, m.movedAt), fav) : STOP.movido(p, horaRel(conta, m.movedAt), fav)
}

/** The account's limit at a trading day (useRegistrar's limitBeforeOf shape) */
export interface LimitAt {
  tradingDay: string
  limit: LimitCheck
}

/**
 * E20 after «Sim, desfazer»: «Parcial das 10:18 desfeita às 10:22.» / «Movimento do stop das 10:19
 * desfeito às 10:22.», and for a partial of a trade that counts today, when the cached limit before
 * was reached (or at 80 % with the preference) and the fresh one after is neither: « Com a parcial
 * desfeita, o limite do dia volta a −US$ 300 de US$ 400.»
 */
export function textoDepoisDoUndo(
  conta: ContaReg,
  ev: { kind: 'parcial' | 'stop'; hora: string },
  at: Date,
  limite: { market: AccountMarket; tradeDay: string | null; before: LimitAt | null; after: LimitAt | null; pref80: boolean },
): string {
  if (ev.kind === 'stop') return DESFAZER_EV.stopDesfeito(ev.hora, hora(conta, at))
  let texto = DESFAZER_EV.parcialDesfeita(ev.hora, hora(conta, at))
  const { before, after, tradeDay } = limite
  if (before && after && tradeDay !== null && before.tradingDay === tradeDay && after.tradingDay === tradeDay && before.limit.evaluated && after.limit.evaluated) {
    const marca = (l: LimitCheck) => l.evaluated && (l.state === 'atingido' || (limite.pref80 && l.near))
    if (marca(before.limit) && !marca(after.limit)) {
      const currency = currencyOf(limite.market)
      texto += DESFAZER_EV.limiteVolta(compactoNeg(after.limit.worstCents, currency), dinheiroCompacto(after.limit.cents, currency))
    }
  }
  return texto
}

// ---------------------------------------------------------------------------------------------
// «Mover stop» (E25)
// ---------------------------------------------------------------------------------------------

export interface CamposStop {
  /** «Breakeven · 7.912,50» or «Outro preço»; null = the default (Breakeven, unless the stop is already there) */
  modo: 'be' | 'outro' | null
  novo: string
  agora: string
}

export const CAMPOS_STOP: CamposStop = { modo: null, novo: '', agora: '' }

/** The order of «Mover stop»'s fields: where the focus goes on «Registrar stop» */
export const ORDEM_STOP = ['sModo', 'sNovo', 'sAgora'] as const
export type CampoStop = (typeof ORDEM_STOP)[number]

export interface ModeloStop {
  modo: 'be' | 'outro'
  opcoes: { valor: 'be' | 'outro'; rotulo: string }[]
  rotulos: { novo: string; agora: string }
  /** «· opcional» after «Preço agora» («Outro preço») */
  agoraOpcional: boolean
  /** «Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.» (each part only when known) */
  status: string
  /** «Se o novo stop for atingido: +US$ 40,00 no total.»; null where it is not computed */
  seAtingido: string | null
  /** «Se o novo stop for atingido, o dia passa do limite: …»; null when there is nothing to warn about */
  avisoLimite: string | null
  erros: Partial<Record<CampoStop, string>>
  /** What «Registrar stop» sends (movePayload adds the client_key); null while a field is wrong */
  campos: Omit<MoveFields, 'clientKey'> | null
}

/** 10^10: a stop move's points in favour stay below it (trade_stop_moves.favor) */
const MAX_FAVOR = numeric('10000000000')

/**
 * «Mover stop»: «Breakeven» (the entry, «Preço agora» required) or «Outro preço» («Preço agora»
 * optional), the board's checks in its order (validateMove agrees), the status, «Se o novo stop for
 * atingido…» and the day's limit warning (`agora`: rules_now of the trade's account)
 */
export function modeloMoverStop(conta: ContaReg, view: TradeView, c: CamposStop, agora: AccountNow | null, tentou: boolean): ModeloStop | null {
  void tentou
  const t = view.trade
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null) return null
  const entry = t.entryPrice
  const sgn = sgnDe(t)
  const opcao = forma.tipo === 'opcao'
  const cot = forma.tipo === 'cri' ? forma.moedaCotacao ?? 'USDT' : null
  const nivelAt = view.position.stopNow
  const jaBe = igual(nivelAt, entry)
  const modo = c.modo ?? (jaBe ? 'outro' : 'be')
  const exemplo = precoDe(forma, entry)
  const erros: ModeloStop['erros'] = {}

  if (modo === 'be' && jaBe) erros.sModo = STOP.jaEsta(precoDe(forma, nivelAt as string))
  let novo: string | null = modo === 'be' ? entry : null
  if (modo === 'outro') {
    const lido = lerPreco(forma, c.novo, { vazio: STOP.novoVazio, zero: STOP.zero, exemplo })
    if (lido.erro) erros.sNovo = lido.erro
    else if (igual(lido.value, nivelAt)) erros.sNovo = STOP.jaEsta(precoDe(forma, nivelAt as string))
    else novo = lido.value
  }
  let agoraN: string | null = null
  if (!(c.agora.trim() === '' && modo === 'outro')) {
    const longe = (v: string) => (cmp(abs(numeric(favorOf(forma.spec, sgn, entry, v))), MAX_FAVOR) >= 0 ? STOP.agoraLonge : null)
    const lido = lerPreco(forma, c.agora, {
      vazio: opcao ? STOP.agoraVazioPremio : STOP.agoraVazio,
      zero: opcao ? STOP.agoraZeroPremio : STOP.agoraZero,
      exemplo,
      extra: forma.spec.stops === 'pips' ? longe : undefined,
    })
    if (lido.erro) erros.sAgora = lido.erro
    else agoraN = lido.value
  }
  // The new stop stays on the safe side of the price now (past it, the stop would have been hit: that is an exit)
  if (novo !== null && agoraN !== null && Math.sign(Number(difDe(novo, agoraN, sgn))) >= 0) {
    const texto = sgn > 0 ? STOP.ladoCompra : STOP.ladoVenda
    if (modo === 'outro' && !erros.sNovo) erros.sNovo = texto
    if (modo === 'be' && !erros.sAgora) erros.sAgora = texto
  }
  const partes = [agoraN !== null ? `${textoAFavor(forma, entry, agoraN, lado(t), true)}.` : '', view.breakeven ? REGRA_BE.linha(textoN(view.breakeven), null) : '']
  const open = view.position.open
  const x = novo !== null ? ifStopped(forma.spec, sgn, entry, open, novo, view.position.realizedPnl) : null
  const est = forma.modo === 'estimativa' ? RESULTADO.estimativa : ''
  let avisoLimite: string | null = null
  if (novo !== null && agora && t.tradingDay !== null && agora.gate.tradingDay === t.tradingDay) {
    const lim = agora.gate.limit
    if (lim.evaluated && lim.state !== 'atingido') {
      const w = riskBeyondLimit(dayLimitOf(lim, conta.currency), riskAtStop(forma.spec, sgn, entry, open, novo))
      if (w) avisoLimite = STOP.avisoLimite(dinheiroCompacto(centavos(w.left), conta.currency), `${est}${dinheiroCompacto(centavos(w.risk), conta.currency)}`)
    }
  }
  const ok = !erros.sModo && !erros.sNovo && !erros.sAgora && novo !== null
  return {
    modo,
    opcoes: [
      { valor: 'be', rotulo: STOP.breakeven(precoDe(forma, entry)) },
      { valor: 'outro', rotulo: STOP.outro },
    ],
    rotulos: {
      novo: opcao ? STOP.novoPremio : cot ? STOP.novoEm(cot) : STOP.novo,
      agora: opcao ? STOP.agoraPremio : cot ? STOP.agoraEm(cot) : STOP.agora,
    },
    agoraOpcional: modo === 'outro',
    status: partes.filter(Boolean).join(' '),
    seAtingido: x ? STOP.seAtingido(`${x.estimate ? RESULTADO.estimativa : ''}${dinheiro(x.total, conta.currency)}`) : null,
    avisoLimite,
    erros,
    campos: !ok
      ? null
      : modo === 'be'
        ? { kind: 'breakeven', priceNow: agoraN as string }
        : { kind: 'ajuste', stopPrice: novo as string, priceNow: agoraN ?? undefined },
  }
}

// ---------------------------------------------------------------------------------------------
// Step 3 (E29–E34)
// ---------------------------------------------------------------------------------------------

/**
 * E33: the trade's rule against what happened to its stop (moves not undone, in time order): the
 * first breakeven (stop = entry; told or live), else the first live move beyond the entry, else the
 * first live move, else a live trade's «não foi movido»; a «Já fechada» without the pill: none
 */
function linhaBreakeven(conta: ContaReg, view: TradeView, forma: FormaAtivo): string | null {
  const t = view.trade
  if (!view.breakeven || t.entryPrice === null) return null
  const entry = t.entryPrice
  const sgn = sgnDe(t)
  const n = textoN(view.breakeven)
  const moves = movesVivos(view.stopMoves)
  const fav = (m: StopMove) => (m.priceNow !== null ? textoAFavor(forma, entry, m.priceNow, lado(t), false) : null)
  const be = moves.find((m) => igual(m.stopPrice, entry))
  if (be) return be.origin === 'reconstructed' ? FECHADA_3C.beDepois(fav(be), n) : FECHADA_3C.be(hora(conta, be.movedAt), fav(be), n)
  const live = moves.filter((m) => m.origin === 'live')
  const passou = live.find((m) => Math.sign(Number(difDe(m.stopPrice, entry, sgn))) > 0)
  if (passou) return FECHADA_3C.passou(hora(conta, passou.movedAt), fav(passou), n)
  if (live.length) return FECHADA_3C.movido(n)
  const ao = view.context?.origin ?? (t.source === 'after' ? 'reconstructed' : 'live')
  return ao === 'live' ? FECHADA_3C.naoMovido(n) : null
}

/**
 * E29–E33: step 3's card (as built), with ≥ 2 counting exits «7.912,50 → 7.924,17 em média», R on
 * the initial stop after a move («com o stop inicial de 10 pts»), the timeline (≥ 2 exits or a move
 * not undone) and the breakeven line
 */
export function cartaoComParciais(conta: ContaReg, view: TradeView, now: Date): CartaoFechada & { tempo: ItemTempo[] | null; breakeven: string | null } {
  const t = view.trade
  const base = cartaoFechada(conta, t, now)
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || t.entryPrice === null) return { ...base, tempo: null, breakeven: null }
  const entry = t.entryPrice
  const sgn = sgnDe(t)
  const contando = countingExits(view.exits)
  const moves = movesVivos(view.stopMoves)
  const out: CartaoFechada & { tempo: ItemTempo[] | null; breakeven: string | null } = { ...base, tempo: null, breakeven: null }
  if (contando.length >= 2) {
    const media = averageExit(contando)
    if (media !== null) {
      const mostra = formatDecimal(numericText(round(numeric(media), forma.casasMostra)), { minDecimals: forma.casasMostra })
      const dif0 = difDe(media, entry, sgn)
      const dif = forma.diferenca === 'ptsFut' ? numericText(round(numeric(dif0), 2)) : dif0
      const fim = t.exitTime ?? t.entryTime
      out.linha = `${opTexto(t, conta.market)} · ${precoDe(forma, entry)} → ${FECHADA_3C.emMedia(mostra)} · ${diferencaTexto(forma, dif)} · ${periodo(conta, t.entryTime, fim, now)}`
    }
  }
  // R on the initial stop over every exit (trade_r_of); the sub says «inicial» after a move
  const r = view.position.r
  if (r !== null && base.r) out.r = { ...base.r, valor: FECHADA.r(formatDecimal(numericText(round(numeric(r), 2)), { minDecimals: 2, signed: true })) }
  if (out.r && moves.length > 0) {
    const nivel = distanciaDoStop(forma, t, t.stopPrice) ?? ''
    const u = forma.unidadeStop
    out.r = {
      ...out.r,
      sub:
        u === 'pts'
          ? FECHADA_3C.comStopInicial(nivel)
          : u === 'pips'
            ? FECHADA_3C.comStopInicialPips(nivel)
            : u === 'premio'
              ? FECHADA_3C.comStopInicialPremio(nivel)
              : FECHADA_3C.comStopInicialEm(nivel),
    }
  }
  if (contando.length >= 2 || moves.length > 0) out.tempo = linhaDoTempo(conta, view, now, { comUndo: false })
  out.breakeven = linhaBreakeven(conta, view, forma)
  return out
}

/** E34: step 3's marks line; with partials, «… a partir das 10:18 (sua primeira parcial) …» when marks were made after it */
export function linhaDepoisComParciais(conta: ContaReg, view: TradeView): string {
  const t = view.trade
  const origin = view.context?.origin ?? null
  if (parciaisContando(view.exits).length === 0) return linhaDepois(conta, t, view.marks, origin)
  const cut = firstExitCut(view.exits)
  const reg = t.exitRegisteredAt
  const fim = t.exitTime
  if (!cut || !fim || !reg || origin !== 'live') return linhaDepois(conta, t, view.marks, origin)
  const known = cut.getTime() < fim.getTime() ? cut : fim
  const passaram = view.marks.some((m) => m.markedAt.getTime() >= known.getTime() && m.markedAt.getTime() < reg.getTime())
  if (!passaram) return FECHADA.linhaDepois
  return cut.getTime() <= fim.getTime() ? FECHADA_3C.linhaDepoisParcial(hora(conta, cut)) : FECHADA.linhaDepoisSaida(hora(conta, fim))
}

// ---------------------------------------------------------------------------------------------
// «Operações abertas» (E36) and «Operações do dia» (E37)
// ---------------------------------------------------------------------------------------------

/** E36: «MES · Compra · 3 ct · 2 ct em aberto · desde 10:12 ET» after a partial; as built otherwise */
export function linhaEscolhaComParciais(conta: ContaReg, t: RegisteredTrade, ev: EventosDaOperacao | TradeEvents | null, now: Date): string {
  if (!ev || conta.market === 'binary') return linhaEscolha(conta, t, now)
  const forma = formaDaOperacao(conta.market, t)
  if (!forma || parciaisContando(ev.exits).length === 0) return linhaEscolha(conta, t, now)
  const p = positionOf(t, ev.exits, ev.stopMoves, null, null)
  if (p.open === null) return linhaEscolha(conta, t, now)
  return `${opTexto(t, conta.market)}${ESCOLHA_3C.emAberto(forma.quantidade.sufixo(p.open))} · desde ${desdeTexto(conta, t, now)}`
}

/**
 * E37: the bridge's second line. Open: «1 parcial, +US$ 40,00» and the current move («stop no
 * breakeven» at the entry, else «stop movido»; told moves never count), joined by « · »; closed:
 * «em 2 saídas» with two or more counting exits. Null when there is nothing to say.
 */
export function subDaPonte(market: AccountMarket, t: Pick<RegisteredTrade, 'status' | 'entryPrice' | 'direction'>, ev: EventosDaOperacao | TradeEvents | null): string | null {
  if (!ev || market === 'binary') return null
  const contando = countingExits(ev.exits)
  if (t.status === 'closed') return contando.length >= 2 ? OPERACOES_DIA.emSaidas(contando.length) : null
  const parciais = contando.filter((e) => e.kind === 'parcial')
  const partes: string[] = []
  if (parciais.length) {
    const soma = parciais.reduce((s, e) => s + Math.round(Number(e.pnl) * 100), 0)
    partes.push(OPERACOES_DIA.parciais(parciais.length, formatMoney(numericText({ units: BigInt(soma), scale: 2 }), { signed: true, currency: currencyOf(market) })))
  }
  const m = movimentoAtual(ev.stopMoves)
  if (m) partes.push(igual(m.stopPrice, t.entryPrice) ? OPERACOES_DIA.stopBe : OPERACOES_DIA.stopMovido)
  return partes.length ? partes.join(' · ') : null
}

/** A price as «Preço agora» shows it when the suggestion fills it with the partial's («7.920,50») */
export function precoParaCampo(market: AccountMarket, t: Pick<RegisteredTrade, 'symbol' | 'option' | 'assetType'>, decimal: string): string {
  return precoDe(formaDaOperacao(market, t), decimal)
}

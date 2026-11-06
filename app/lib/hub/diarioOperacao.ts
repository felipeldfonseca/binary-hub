/**
 * The Diário's words for one trade of the open day (Phase 4, telas, lane L2; contract §2.2 G and H): the row of
 * «Operações do dia» (Hora, the origin chip, the second line, Resultado, Plano, the action), the drill's facts and
 * lines, the trade's timeline, the images' «quando», the marks' times and the open trades of other days. Pure: no
 * React, no client.
 *
 * Every time is on the Diário's clock (`tz`) and relative to the trade's own day (`ref` = its entry, contract §2.2 H
 * preamble): bare on that day, a date otherwise; never «ontem». The built producers are called, never copied: opTexto,
 * precoDe, diferencaTexto, distanciaDoStop, chipMarca, marcasDivididas (registrarForm), linhaDoTempo, subDaPonte,
 * cartaoComParciais, formaDaOperacao (registrarParciais), the domain's dinheiro (lib/hub/diario); the board's own words
 * are copyDia's.
 */
import { addDays, formatHhMm, utcToLocal } from '@/lib/domain/tempo'
import type { AccountMarket, Currency } from '@/lib/domain/markets'
import type { GateResult, PlanBreak } from '@/lib/domain/gate'
import { COMMISSION_FROM_FILE, type Day } from '@/lib/domain/diario'
import { averageExit, countingExits, firstExitCut, isClean } from '@/lib/domain/registro'
import { abs, fromInt, mul, numeric, numericText, plainText, round, sign, sub, trimScale } from '@/lib/domain/registro/numeric'
import { EBINEX, FECHADA, GATE, MARCAS, PASSOS_PRECOS } from '@/components/hub/registrar/copy'
import { FECHADA_3C } from '@/components/hub/registrar/copyParciais'
import {
  ABERTAS_OUTROS,
  DRILL,
  IMAGENS,
  LINHAS,
  MARCAS_DIA,
  OPERACOES,
  TEMPO_OP,
  acaoAria,
} from '@/components/hub/diario/copyDia'
import { diaCurto, dinheiro, hora, tomDe } from './diario'
import type { DiaryDayTrade, OpenElsewhere } from './diarioDb'
import { formatDecimal } from './numero'
import { dinheiroCompacto, sufixoRelogio, type Tom } from './posso'
import type { FormaAtivo } from './registrarAtivos'
import {
  MARCA_KINDS,
  ativoCurto,
  chipMarca,
  diferencaTexto,
  distanciaDoStop,
  marcasAtuais,
  marcasDivididas,
  opTexto,
  precoDe,
  textoQuebras,
  valorMarca,
  type ContaReg,
  type MarcaKind,
} from './registrarForm'
import { cartaoComParciais, formaDaOperacao, linhaDoTempo, subDaPonte } from './registrarParciais'

const NBSP = ' '

/** Who the words are for: the account's market, money and clock, and the Registrar's view of it */
export interface ContaDaOperacao {
  market: AccountMarket
  currency: Currency
  /** The Diário's clock (the window's) */
  tz: string
  /** registrarForm.contaReg of the account (the built producers' account) */
  reg: ContaReg
}

/** The trade's reference instant: every drill time is written relative to its entry's date */
export const referencia = (t: Pick<DiaryDayTrade, 'trade'>): Date => t.trade.entryTime

const ehBinaria = (market: AccountMarket) => market === 'binary'

/** The day an instant falls on, on the clock */
const dataEm = (at: Date, tz: string) => utcToLocal(at, tz).date

/** 'HH:MM:SS' on the clock (the broker's seconds, «Na corretora») */
function horaSegundos(at: Date, tz: string): string {
  const l = utcToLocal(at, tz)
  const s = Math.floor((at.getTime() % 60_000 + 60_000) % 60_000 / 1000)
  return `${formatHhMm(l.minuteOfDay)}:${String(s).padStart(2, '0')}`
}

/** «Compra», «Venda», «Alta», «Baixa» */
export function ladoDe(direction: DiaryDayTrade['trade']['direction']): string {
  return direction === 'long' ? 'Compra' : direction === 'short' ? 'Venda' : direction === 'call' ? EBINEX.alta : EBINEX.baixa
}

/** Where the trade came from: live (the app), «Já fechada», a file, the old page, or before the rules */
export type Origem = 'app' | 'depois' | 'arquivo' | 'antiga' | 'historico'

export function origemDe(t: Pick<DiaryDayTrade, 'history' | 'planKind' | 'import' | 'context' | 'trade'>): Origem {
  if (t.history) return 'historico'
  if (t.planKind === 'recalculado') return t.import ? 'arquivo' : 'antiga'
  if (t.context?.origin === 'reconstructed' || (!t.context && t.trade.source === 'after')) return 'depois'
  return 'app'
}

// ---------------------------------------------------------------------------------------------
// The row (G)
// ---------------------------------------------------------------------------------------------

/** G4: «10:03–10:09», open «10:18»; a binary «20:10–20:12» (entry → expiry), open «21:12» */
export function horaDaLinha(t: Pick<DiaryDayTrade, 'trade'>, tz: string): string {
  const tr = t.trade
  const entrada = hora(tr.entryTime, tz)
  if (tr.status === 'open') return entrada
  const fim = tr.exitTime ?? tr.expiresAt
  return fim ? `${entrada}–${hora(fim, tz)}` : entrada
}

/** G7: «Registrada depois», «Do arquivo», «Página antiga»; null for a live trade or the history */
export function origemDaOperacao(t: Parameters<typeof origemDe>[0]): string | null {
  const o = origemDe(t)
  return o === 'depois' ? OPERACOES.chipDepois : o === 'arquivo' ? OPERACOES.chipArquivo : o === 'antiga' ? OPERACOES.chipAntiga : null
}

/**
 * G5: «MES · Venda · 2 ct», «EUR/USD · Alta · 1 min» (R opTexto), the amount kept with its unit by a no-break space
 * («2 ct», «0,25 BTC», «1 min»), as the Phase 3 bridge did
 */
export function operacaoDaLinha(t: Pick<DiaryDayTrade, 'trade'>, market: AccountMarket): string {
  const partes = opTexto(t.trade, market).split(' · ')
  const ultima = partes.length - 1
  if (ultima > 0) partes[ultima] = partes[ultima].replace(/ /g, NBSP)
  return partes.join(' · ')
}

/**
 * G8: the «Operação» cell's second line. A price market: R subDaPonte («1 parcial, +US$ 40,00 · stop no breakeven»,
 * «em 2 saídas»); a binary: «Vence às 21:30 de Brasília.» while open, «devolvida» closed at zero
 */
export function subDaLinha(t: Pick<DiaryDayTrade, 'trade' | 'exits' | 'stopMoves' | 'money'>, market: AccountMarket, tz: string): string | null {
  const tr = t.trade
  if (!ehBinaria(market)) return subDaPonte(market, tr, { exits: t.exits, stopMoves: t.stopMoves })
  if (tr.status === 'open') return tr.expiresAt ? EBINEX.vence(`${hora(tr.expiresAt, tz)}${sufixoRelogio(tz)}`) : null
  const net = t.money.net ?? tr.pnl
  return tr.result === 'breakeven' || (net !== null && sign(numeric(net)) === 0) ? OPERACOES.devolvida : null
}

/** G6: the paperclip's label; null without images or a note */
export function clipDaLinha(t: Pick<DiaryDayTrade, 'images' | 'trade'>): string | null {
  const nota = !!t.trade.note
  if (t.images.length && nota) return OPERACOES.clipImagensENota
  if (t.images.length) return OPERACOES.clipImagens
  return nota ? OPERACOES.clipNota : null
}

/** G9: the net in the account's currency; null while open («aberta») */
export function resultadoDaLinha(t: Pick<DiaryDayTrade, 'trade' | 'money'>, currency: Currency): { texto: string; tom: Tom } | null {
  if (t.trade.status === 'open') return null
  const net = t.money.net ?? t.trade.pnl ?? '0'
  return { texto: dinheiro(net, currency, sign(numeric(net)) !== 0), tom: tomDe(net) }
}

export type PlanoDaLinha =
  | { tipo: 'ok' }
  | { tipo: 'fora'; texto: string; aria: string }
  | { tipo: 'historico' }
  | { tipo: 'nada' }

/** The breaks the Diário shows (window and limit; Phase 5's stay out) */
const QUEBRAS_DA_LINHA: readonly PlanBreak[] = ['fora_da_janela', 'depois_do_limite']

/** G10: «No plano», «● fora da janela · depois do limite» (sr «fora do plano: fora da janela e depois do limite»), the history, «—» */
export function planoDaLinha(t: Pick<DiaryDayTrade, 'history' | 'plan' | 'planNow'>): PlanoDaLinha {
  if (t.history) return { tipo: 'historico' }
  const p = t.plan ?? t.planNow
  if (!p) return { tipo: 'nada' }
  if (p.verdict === 'fora_do_plano') {
    const breaks = p.breaks.filter((b) => QUEBRAS_DA_LINHA.includes(b))
    const texto = textoQuebras(breaks)
    if (texto) return { tipo: 'fora', texto, aria: OPERACOES.foraAria(texto.split(' · ').join(' e ')) }
  }
  return p.verdict === 'no_plano' ? { tipo: 'ok' } : { tipo: 'nada' }
}

/** G11: «Registrar saída» / «Registrar resultado» on an open trade registered in the app; null otherwise */
export function acaoDaLinha(t: Pick<DiaryDayTrade, 'trade' | 'context'>, market: AccountMarket, tz: string): { texto: string; aria: string } | null {
  if (t.trade.status !== 'open' || !t.context) return null
  const texto = ehBinaria(market) ? OPERACOES.registrarResultado : OPERACOES.registrarSaida
  return { texto, aria: acaoAria(texto, ladoDe(t.trade.direction), ativoCurto(t.trade, market), hora(t.trade.entryTime, tz)) }
}

/** G12: «Detalhes da operação: Venda de MES às 10:03» */
export function detalhesAria(t: Pick<DiaryDayTrade, 'trade'>, market: AccountMarket, tz: string): string {
  return OPERACOES.detalhes(ladoDe(t.trade.direction), ativoCurto(t.trade, market), hora(t.trade.entryTime, tz))
}

/** A row's border is amber when its plan is «fora» */
export const linhaFora = (t: Parameters<typeof planoDaLinha>[0]) => planoDaLinha(t).tipo === 'fora'

// ---------------------------------------------------------------------------------------------
// The drill's facts (H2–H5)
// ---------------------------------------------------------------------------------------------

/**
 * H2: «Posso operar hoje?» at the entry, the answer only (DIFF #6): «Liberado», «Fora da sua janela», «Fora da sua
 * janela · hoje não é dia da janela», «Encerrado por hoje», «Liberado · com aviso do limite», «Sem janela salva»
 */
export function possoNaEntrada(g: GateResult): string {
  const w = g.window as { evaluated: boolean; position?: string; reason?: string }
  if (g.status === null) return GATE.semJanela
  if (g.status === 'encerrado') return GATE.encerrado
  if (g.status === 'fora_janela') return w.evaluated && w.position === 'nao_e_dia' ? `${GATE.fora} ${GATE.hojeNaoEDia}` : GATE.fora
  const avisos: string[] = []
  if (g.warnings.includes('fora_janela')) avisos.push(w.position === 'nao_e_dia' ? GATE.avisoNaoEDia : GATE.avisoFora)
  if (g.warnings.includes('limite')) avisos.push(GATE.avisoLimite)
  if (avisos.length) return `${GATE.liberado} ${avisos.join(' ')}`
  if (!w.evaluated && w.reason === 'sem_janela') return GATE.semJanela
  return GATE.liberado
}

const sgnDe = (d: DiaryDayTrade['trade']['direction']) => (d === 'short' || d === 'put' ? -1 : 1)
/** (price − entry) × side, decimal text */
const difDe = (price: string, entry: string, sgn: 1 | -1) => numericText(mul(sub(numeric(price), numeric(entry)), fromInt(sgn)))

/**
 * A price as the boards write it in the drill: futures with their tick's decimals («4.112,3» on MGC, «7.854,00» on MES),
 * crypto with two («98.450,00»), every other market as the Registrar (R precoDe's decimals); more when the price has them
 */
export function precoDoDia(forma: FormaAtivo | null, decimal: string, arredondar = false): string {
  if (!forma) return precoDe(null, decimal)
  const tick = forma.spec.tick ? trimScale(numeric(forma.spec.tick)) : null
  const casas = forma.tipo === 'fut' && tick ? tick.scale : forma.tipo === 'cri' ? 2 : forma.casasMostra
  const v = arredondar ? round(numeric(decimal), casas) : trimScale(numeric(decimal))
  return formatDecimal(numericText(v), { minDecimals: Math.max(casas, Math.min(8, trimScale(v).scale)) })
}

/** R «+1,4 R» with one decimal, «,0» dropped (DIFF #5) */
function rTexto(r: string): string {
  return DRILL.rValor(formatDecimal(plainText(round(numeric(r), 1)), { signed: true }))
}

/** «com stop de 6 pts» (R FECHADA.comStop), «com stop de 12 pips», «com stop em 38,20», «com stop do prêmio em 1,10» */
function comStop(forma: FormaAtivo, nivel: string): string {
  const u = forma.unidadeStop
  return u === 'pts' ? FECHADA.comStop(nivel) : u === 'pips' ? PASSOS_PRECOS.comStopPips(nivel) : u === 'premio' ? PASSOS_PRECOS.comStopPremio(nivel) : PASSOS_PRECOS.comStopEm(nivel)
}

/** A stop or target as its unit shows it: points and pips as the distance (R distanciaDoStop), a price or premium as the level, written as the drill's prices */
function nivelDoStop(forma: FormaAtivo, t: Pick<DiaryDayTrade['trade'], 'entryPrice'>, level: string | null): string | null {
  if (level === null) return null
  return forma.unidadeStop === 'pts' || forma.unidadeStop === 'pips' ? distanciaDoStop(forma, t, level) : precoDoDia(forma, level)
}

/** «stop 6 · alvo 10 pts», «stop 15 · alvo 30 pips», «stop em 97.900,00 · alvo em 99.500,00», «stop do prêmio 1,10 · …» */
function stopEAlvo(forma: FormaAtivo, t: DiaryDayTrade['trade']): string | null {
  const u = forma.unidadeStop
  const stop = nivelDoStop(forma, t, t.stopPrice)
  const alvo = nivelDoStop(forma, t, t.targetPrice)
  const partes = [stop ? DRILL.stop[u](stop) : null, alvo ? DRILL.alvo[u](alvo) : null].filter((x): x is string => !!x)
  return partes.length ? `${partes.join(' · ')}${DRILL.unidade[u]}` : null
}

/** The trade's counting exits (app and file rows that the sums use) */
const contando = (t: Pick<DiaryDayTrade, 'exits'>) => countingExits(t.exits)

/** H3: the trade has an exit (closed, or open with a counting exit): only then «Resultado» and «Comissão» */
export function temSaida(t: Pick<DiaryDayTrade, 'trade' | 'exits'>): boolean {
  return t.trade.status === 'closed' || contando(t).length > 0
}

/** H6/H7: the trade has a stop (its own, or a live move not undone) */
function temStop(t: Pick<DiaryDayTrade, 'trade' | 'stopMoves'>): boolean {
  return t.trade.stopPrice !== null || t.stopMoves.some((m) => m.voidedAt === null && m.origin === 'live')
}

/** «Resultado»: «+US$ 80,02 · bruto +US$ 82,50», «+US$ 40,00 · até aqui» */
function resultadoDoDrill(t: DiaryDayTrade, currency: Currency): string | null {
  const net = t.money.net ?? (t.trade.status === 'open' ? t.position.realizedPnl : t.trade.pnl)
  if (net === null) return null
  const partes = [dinheiro(net, currency)]
  const c = t.money.commission
  if (c !== null && sign(numeric(c)) !== 0 && t.money.gross !== null) partes.push(DRILL.bruto(dinheiro(t.money.gross, currency)))
  if (t.trade.status === 'open') partes.push(DRILL.ateAqui)
  return partes.join(' · ')
}

/** «Comissão» (Futuros, Forex, Ações): the file's commission, else «ainda não chegou: …» */
function comissaoDoDrill(t: DiaryDayTrade, conta: ContaDaOperacao): string | null {
  if (!COMMISSION_FROM_FILE.includes(conta.market)) return null
  const c = t.money.commission
  return c === null ? DRILL.comissaoPendente : dinheiro(numericText(abs(numeric(c))), conta.currency, false)
}

/** H4: a history trade's average points per contract over its exits («−3,50 pts») */
function pontosDoHistorico(forma: FormaAtivo, t: DiaryDayTrade): string | null {
  const tr = t.trade
  if (tr.entryPrice === null) return null
  const sgn = sgnDe(tr.direction)
  const xs = contando(t)
  if (xs.length) {
    const media = averageExit(xs)
    return media === null ? null : diferencaTexto(forma, difDe(media, tr.entryPrice, sgn))
  }
  return tr.exitPrice === null ? null : diferencaTexto(forma, difDe(tr.exitPrice, tr.entryPrice, sgn))
}

/**
 * H2–H5: the facts of «Sua operação», as [label, value] in the board's order. A single-exit price trade: Hora, Entrada
 * → saída, Stop · alvo, R (with a stop, closed), Resultado, Comissão, Posso operar hoje?; several exits or open: Hora,
 * Entrada, Saída média / Em aberto, …; «Resultado» and «Comissão» only with an exit (H3); a history trade: Hora,
 * Pontos, Resultado, Comissão; a binary: Hora with its candle, Stake · payout, Como terminou?, Resultado (closed),
 * Posso operar hoje?
 */
export function fatosDaOperacao(t: DiaryDayTrade, conta: ContaDaOperacao): [string, string][] {
  const tr = t.trade
  const tz = conta.tz
  const out: [string, string][] = []
  const g = t.gate ?? t.gateNow
  const posso = () => {
    if (!t.history && g) out.push([DRILL.posso, possoNaEntrada(g)])
  }
  if (ehBinaria(conta.market)) {
    const fim = tr.expiresAt
    const ini = fim && tr.durationSeconds ? new Date(fim.getTime() - tr.durationSeconds * 1000) : null
    out.push([DRILL.hora, fim && ini ? `${hora(tr.entryTime, tz)} · ${DRILL.vela(hora(ini, tz), hora(fim, tz), sufixoRelogio(tz))}` : horaDaLinha(t, tz)])
    if (tr.stakeAmount !== null && tr.payoutPercent !== null) {
      const stake = dinheiroCompacto(Math.round(Number(tr.stakeAmount) * 100), conta.currency)
      out.push([DRILL.stakePayout, DRILL.payout(stake, formatDecimal(plainText(trimScale(numeric(tr.payoutPercent)))))])
    }
    const fimTxt = tr.status === 'open' || tr.result === null || tr.result === 'pending' ? DRILL.naoVenceu : tr.result === 'win' ? EBINEX.ganho : tr.result === 'loss' ? EBINEX.perda : EBINEX.devolvida
    out.push([DRILL.comoTerminou, fimTxt])
    if (tr.status === 'closed') {
      const net = t.money.net ?? tr.pnl ?? '0'
      out.push([DRILL.resultado, dinheiro(net, conta.currency, sign(numeric(net)) !== 0)])
    }
    posso()
    return out
  }
  const forma = formaDaOperacao(conta.market, tr)
  const origem = origemDe(t)
  let horaTxt = horaDaLinha(t, tz)
  if (tr.status === 'open') horaTxt += ` · ${DRILL.aberta}`
  if (origem === 'app' && tr.registeredAt && hora(tr.registeredAt, tz) !== hora(tr.entryTime, tz)) horaTxt += ` · ${DRILL.registradaAs(hora(tr.registeredAt, tz))}`
  out.push([DRILL.hora, horaTxt])
  if (!forma || tr.entryPrice === null) {
    const res = temSaida(t) ? resultadoDoDrill(t, conta.currency) : null
    if (res) out.push([DRILL.resultado, res])
    posso()
    return out
  }
  const xs = contando(t)
  if (origem === 'historico') {
    const pts = pontosDoHistorico(forma, t)
    if (pts) out.push([DRILL.pontos, pts])
  } else if (xs.length > 1 || tr.status === 'open') {
    out.push([DRILL.entrada, `${precoDoDia(forma, tr.entryPrice)} · ${forma.quantidade.sufixo(tr.quantity ?? '0')}`])
    if (tr.status === 'open') out.push([DRILL.emAberto, forma.quantidade.sufixo(t.position.open ?? tr.quantity ?? '0')])
    else {
      const media = averageExit(xs)
      if (media !== null) out.push([DRILL.saidaMedia, `${precoDoDia(forma, media, true)} · ${DRILL.emSaidas(xs.length)}`])
    }
  } else if (tr.exitPrice !== null) {
    const dif = diferencaTexto(forma, difDe(tr.exitPrice, tr.entryPrice, sgnDe(tr.direction)))
    out.push([DRILL.entradaSaida, `${precoDoDia(forma, tr.entryPrice)} → ${precoDoDia(forma, tr.exitPrice)} · ${dif}`])
  }
  if (origem !== 'historico') {
    const sa = stopEAlvo(forma, tr)
    if (!sa) out.push([DRILL.stopAlvo, DRILL.naoAnotados])
    else {
      const quando = origem === 'depois' ? DRILL.registradoDepois : DRILL.asHora(hora(tr.registeredAt && origem === 'app' ? tr.registeredAt : tr.entryTime, tz))
      out.push([DRILL.stopAlvo, `${sa} · ${quando}`])
    }
    if (tr.status === 'closed' && t.position.r !== null && tr.stopPrice !== null) {
      const nivel = nivelDoStop(forma, tr, tr.stopPrice)
      if (nivel) out.push([DRILL.r, `${rTexto(t.position.r)} · ${comStop(forma, nivel)}`])
    }
  }
  if (temSaida(t)) {
    const res = resultadoDoDrill(t, conta.currency)
    if (res) out.push([DRILL.resultado, res])
    const com = comissaoDoDrill(t, conta)
    if (com) out.push([DRILL.comissao, com])
  }
  posso()
  return out
}

// ---------------------------------------------------------------------------------------------
// The drill's lines (H6) and timeline (H7)
// ---------------------------------------------------------------------------------------------

/** H7: the timeline shows with ≥ 2 counting exits, a stop move not undone, or an open trade with an exit */
export function temLinhaDoTempo(t: DiaryDayTrade, market: AccountMarket): boolean {
  if (ehBinaria(market) || t.history) return false
  const n = contando(t).length
  return n >= 2 || t.stopMoves.some((m) => m.voidedAt === null) || (t.trade.status === 'open' && n >= 1)
}

/** The breakeven line (R cartaoComParciais().breakeven), only on a trade with a stop (DIFF #17) */
function linhaDoBreakeven(t: DiaryDayTrade, conta: ContaDaOperacao): string | null {
  if (!temStop(t)) return null
  return cartaoComParciais(conta.reg, t, referencia(t)).breakeven
}

export interface TempoDaOperacao {
  itens: { chave: string; hora: string; texto: string; sub: string | null }[]
  /** «Breakeven às 10:22, com +8,00 pts a favor · sua regra: +8 pts.» */
  breakeven: string | null
}

/** H7: «Linha do tempo da operação» (R linhaDoTempo with ref = the entry), and the breakeven line under it */
export function tempoDaOperacao(t: DiaryDayTrade, conta: ContaDaOperacao): TempoDaOperacao | null {
  if (!temLinhaDoTempo(t, conta.market)) return null
  const itens = linhaDoTempo(conta.reg, t, referencia(t), { comUndo: false }).map((x) => ({
    chave: x.chave,
    hora: x.hora ?? TEMPO_OP.semHora,
    texto: x.texto,
    sub: x.sub,
  }))
  if (!itens.length) return null
  return { itens, breakeven: linhaDoBreakeven(t, conta) }
}

/** A link's column value as a price, when it is one */
const valorDoLink = (x: unknown): string | null => (typeof x === 'number' || typeof x === 'string' ? String(x) : null)

const COLUNAS_PRECO: Record<string, 'entrada' | 'saída'> = { entry_price: 'entrada', exit_price: 'saída' }

/**
 * H6: the drill's lines, in the board's order: an open binary's expiry; «Registrada às 17:48, depois do resultado: …»;
 * «Sem registro no app: …» / «Lançada na página antiga: …» / «Antes das suas regras: …»; for each file link
 * «Fechada pelo arquivo de 27 out.» or «Completada pelo arquivo de 11 nov: comissão US$ 2,48.», «O arquivo corrigiu o
 * preço de saída: 4.118,4 → 4.118,6.», «Na corretora: 10:03:18–10:10:28.» (a whole minute or more apart); «Na entrada,
 * o “Posso operar hoje?” dizia “Encerrado por hoje” desde 10:38: …» on a trade after the limit; «Marcas feitas a partir
 * das 10:22 (sua primeira parcial) …» on a live trade with ≥ 2 counting exits; and, without a timeline, the breakeven
 * line of a closed trade with a stop
 */
export function linhasDaOperacao(t: DiaryDayTrade, conta: ContaDaOperacao, o: { limiteAtingidoAs?: Date | null } = {}): string[] {
  const tr = t.trade
  const tz = conta.tz
  const out: string[] = []
  if (ehBinaria(conta.market) && tr.status === 'open' && tr.expiresAt) out.push(EBINEX.vence(`${hora(tr.expiresAt, tz)}${sufixoRelogio(tz)}`))
  const origem = origemDe(t)
  if (origem === 'depois') out.push(LINHAS.registradaDepois(hora(tr.registeredAt ?? tr.entryTime, tz)))
  if (origem === 'arquivo') out.push(LINHAS.doArquivo)
  if (origem === 'antiga') out.push(LINHAS.paginaAntiga)
  if (origem === 'historico') out.push(LINHAS.historico)
  const forma = ehBinaria(conta.market) ? null : formaDaOperacao(conta.market, tr)
  if (origem === 'app' || origem === 'depois') {
    for (const l of t.links) {
      const dia = diaCurto(dataEm(l.linkedAt, tz))
      const com = valorDoLink(l.after.commission)
      if (l.closed) out.push(LINHAS.fechadaPeloArquivo(dia))
      else if (com !== null) out.push(LINHAS.completada(dia, dinheiro(numericText(abs(numeric(com))), conta.currency, false)))
    }
    for (const l of t.links) {
      for (const col of l.differs) {
        const qual = COLUNAS_PRECO[col]
        const antes = valorDoLink(l.before[col])
        const depois = valorDoLink(l.after[col])
        if (qual && antes !== null && depois !== null) out.push(LINHAS.corrigiu(qual, precoDoDia(forma, antes), precoDoDia(forma, depois)))
      }
    }
    for (const l of t.links) {
      const fim = tr.exitTime
      const longe = (a: Date | null, b: Date | null) => !!a && !!b && Math.abs(a.getTime() - b.getTime()) >= 60_000
      if (longe(l.fileEntryAt, tr.entryTime) || longe(l.fileExitAt, fim)) {
        const de = l.fileEntryAt ? horaSegundos(l.fileEntryAt, tz) : hora(tr.entryTime, tz)
        out.push(LINHAS.naCorretora(de, l.fileExitAt ? horaSegundos(l.fileExitAt, tz) : null))
      }
    }
  }
  const plano = t.plan ?? t.planNow
  const g = t.gate ?? t.gateNow
  if (!t.history && plano?.breaks.includes('depois_do_limite')) {
    const hit = (g && g.limit.evaluated ? g.limit.hitAt : null) ?? o.limiteAtingidoAs ?? null
    if (hit) out.push(g?.status === 'encerrado' ? LINHAS.encerrado(hora(hit, tz)) : LINHAS.avisava(hora(hit, tz)))
  }
  if (origem === 'app') {
    const xs = contando(t)
    const cut = firstExitCut(t.exits)
    if (xs.length >= 2 && cut) out.push(FECHADA_3C.linhaDepoisParcial(hora(cut, tz)))
  }
  if (!ehBinaria(conta.market) && !t.history && !temLinhaDoTempo(t, conta.market) && tr.status === 'closed') {
    const be = linhaDoBreakeven(t, conta)
    if (be) out.push(be)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// «Imagens e nota» (H8) and the marks (H13)
// ---------------------------------------------------------------------------------------------

/** «às 10:42» on `ref`'s date (the trade's day), «em 12 nov, às 10:42» on another date */
export function quandoNoDia(at: Date, ref: Date, tz: string): string {
  const d = dataEm(at, tz)
  return d === dataEm(ref, tz) ? IMAGENS.as(hora(at, tz)) : IMAGENS.em(diaCurto(d), hora(at, tz))
}

/**
 * DEV-C4: a save made strictly before the trade's first exit not undone (an open trade without exits included) reads
 * «antes da saída», else «depois do resultado»: the marks' rule (registro.isClean), so a drill never mixes the two
 */
export function faseDoSalvo(t: Pick<DiaryDayTrade, 'trade' | 'context' | 'exits'>, at: Date): string {
  const origin = t.context?.origin ?? (t.trade.source === 'live' ? 'live' : t.trade.source === 'after' ? 'reconstructed' : null)
  const limpo = isClean(at, {
    origin,
    exitTime: t.trade.exitTime,
    expiresAt: t.trade.expiresAt,
    exitRegisteredAt: t.trade.exitRegisteredAt,
    firstExit: firstExitCut(t.exits),
  })
  return limpo ? MARCAS.antesSaida : MARCAS.depoisResultado
}

/** The newest save of the images and the note */
export function salvoEm(t: Pick<DiaryDayTrade, 'images' | 'trade'>): Date | null {
  const xs = t.images.map((i) => i.savedAt).concat(t.trade.note ? [t.trade.noteSavedAt] : [])
  let out: Date | null = null
  for (const x of xs) if (x && (!out || x.getTime() > out.getTime())) out = x
  return out
}

/**
 * H8: «salvas às 10:12 · depois do resultado», «salva em 11 nov, às 19:21 · depois do resultado»: «salvas» for images
 * and a note or several images; '' without anything saved
 */
export function quandoAnexos(t: Pick<DiaryDayTrade, 'images' | 'trade' | 'context' | 'exits'>, tz: string): string {
  const at = salvoEm(t)
  const n = t.images.length
  const nota = !!t.trade.note
  if (!at || (!n && !nota)) return ''
  const verbo = (n && nota) || n > 1 ? 'salvas' : 'salva'
  return IMAGENS.quando(verbo, quandoNoDia(at, referencia(t), tz), faseDoSalvo(t, at))
}

export interface GrupoDeMarcas {
  kind: MarcaKind
  /** «Setup · sua nota, de A a C», «Execução», «Emoção» */
  rotulo: string
  /** The value as the board writes it («no ponto», «Calmo»); null without a mark */
  valor: string | null
  /** «às 10:07 · antes da saída», «antes: B às 10:06 · agora: C às 11:20», «11 nov às 19:20 · depois do resultado» */
  tempo: string | null
}

const ROTULOS: Record<MarcaKind, string> = { setup: MARCAS_DIA.setup, execucao: MARCAS.execucao, emocao: MARCAS.emocao }

/** H13: the three groups with their current value and time (R chipMarca / marcasDivididas with ref = the entry) */
export function marcasDaOperacao(t: Pick<DiaryDayTrade, 'marks' | 'marksNow' | 'trade'>, reg: ContaReg): GrupoDeMarcas[] {
  const ref = referencia(t)
  const atuais = marcasAtuais(t.marksNow)
  return MARCA_KINDS.map((kind) => {
    const n = atuais[kind]
    const historico = marcasDivididas(reg, t.marks.filter((e) => e.kind === kind), ref).depois.find((x) => x.historico)?.historico ?? null
    const valor = n?.currentValue ? valorMarca(kind, n.currentValue) : null
    return { kind, rotulo: ROTULOS[kind], valor, tempo: historico ?? (n?.currentValue ? chipMarca(reg, n, ref).texto : null) }
  })
}

// ---------------------------------------------------------------------------------------------
// Open trades of other days (G14)
// ---------------------------------------------------------------------------------------------

/** «MNQ · Compra · 1 ct» (R opTexto), a binary «EUR/USD · Alta», an option «{symbol} · Compra · 2 ct» */
export function operacaoDeOutroDia(o: OpenElsewhere, market: AccountMarket): string {
  if (ehBinaria(market) || o.direction === 'call' || o.direction === 'put') return `${o.symbol} · ${ladoDe(o.direction)}`
  return opTexto({ symbol: o.symbol, direction: o.direction, quantity: o.quantity, durationSeconds: null, option: null, assetType: o.assetType }, market)
}

export interface AbertasDeUmDia {
  dia: Day
  /** «1 operação aberta de ontem: MNQ · Compra · 1 ct.» */
  texto: string
  /** «Abrir 30 nov» */
  link: string
  /** The trade whose drill the link opens (the day's first) */
  tradeId: string
}

/** G14: one line per earlier day with open trades, newest first; «ontem» is the day before `hoje` */
export function abertasDeOutrosDias(xs: readonly OpenElsewhere[], hoje: Day | null, market: AccountMarket): AbertasDeUmDia[] {
  const porDia = new Map<Day, OpenElsewhere[]>()
  for (const o of xs) porDia.set(o.tradingDay, [...(porDia.get(o.tradingDay) ?? []), o])
  const ontem = hoje ? addDays(hoje, -1) : null
  return Array.from(porDia.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([dia, os]) => {
      const ordenadas = os.slice().sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
      const quais = ordenadas.map((o) => operacaoDeOutroDia(o, market))
      const quais2 = quais.length <= 1 ? quais.join('') : `${quais.slice(0, -1).join(', ')} e ${quais[quais.length - 1]}`
      return {
        dia,
        texto: ABERTAS_OUTROS.linha(os.length, dia === ontem ? ABERTAS_OUTROS.ontem : diaCurto(dia), quais2),
        link: ABERTAS_OUTROS.abrir(diaCurto(dia)),
        tradeId: ordenadas[0].tradeId,
      }
    })
}

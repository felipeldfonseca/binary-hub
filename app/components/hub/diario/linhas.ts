/**
 * «Operações do dia» rows from fetchDayTrades' answer (pure: no React, no client). The words follow
 * the approved board's `linhaPonte` (RegistrarOperacao.dc.html RO l.1649–1666):
 *
 *   Hora       «10:12» (open) · «10:01–10:08» (closed) · another trading day: «ontem, 10:52»,
 *              «ontem, 10:52 → 10:42», «21 out, 10:24 → 10:42»; HH:MM on the account's clock
 *   Operação   «MES · Compra · 2 ct» · «EUR/USD · Baixa · 1 min», and since 3-4 «EUR/USD · Compra ·
 *              0,50 lote», «SPY Call 790 · vence 15 out · Compra · 2 ct», «BTC/USDT · Venda · 0,25
 *              BTC», «PETR4 · Compra · 300 ações», «BGIX26 · Compra · 2 un.», «WIN · Venda · 3 ct»
 *              (the Registrar's opTexto), with the paperclip's label
 *   Resultado  «aberta», or the signed money in the account's currency («−US$ 245,00», «−R$ 180,00»)
 *   Plano      «No plano» · «● fora da janela · depois do limite» · «—» (not evaluated)
 *   Ação       «Registrar saída» (a price market, open) · «Registrar resultado» (binary, open) · «Abrir»
 *              (aria «Registrar saída: Compra de SPY Call 790 às 09:35», the instrument as ativoCurto)
 *
 * Phase 3c (board approved 21 Oct, RO l.282, js l.2193–2199): the «Operação» cell's second line from
 * the trade's exits and stop moves (read apart: useTradeEvents) — open «1 parcial, +US$ 40,00 ·
 * stop no breakeven», closed «em 2 saídas»; none while they are read or when the read fails.
 */
import { addDays } from '@/lib/domain'
import { currencyOf, type AccountMarket } from '@/lib/domain/markets'
import { formatDiaMes, formatMoney } from '@/lib/hub/formato'
import { horaNoRelogio } from '@/lib/hub/posso'
import type { DayTrade, TradeEvents } from '@/lib/hub/registrarDb'
import { ativoCurto, opTexto } from '@/lib/hub/registrarForm'
import { subDaPonte } from '@/lib/hub/registrarParciais'
import { OPERACOES_DIA as T, QUEBRAS, acaoAria } from './copy'

const NBSP = '\u00a0'

export type PlanoDaLinha = { tipo: 'ok' } | { tipo: 'fora'; texto: string } | { tipo: 'nada' }

export interface LinhaDoDia {
  tradeId: string
  hora: string
  operacao: string
  /** The paperclip's label («tem imagens e nota»); null: no paperclip */
  clip: string | null
  /** Phase 3c: the second line («1 parcial, +US$ 40,00 · stop no breakeven», «em 2 saídas»); null: none */
  sub: string | null
  /** null while the trade is open («aberta») */
  resultado: { texto: string; tom: 'mint' | 'red' | 'neutral' } | null
  plano: PlanoDaLinha
  acao: string
  acaoAria: string
}

export interface ContextoDoDia {
  market: AccountMarket
  /** The account's trading day today (diaDeHoje) */
  day: string
  /** The account's clock (its window's zone): every HH:MM of the table */
  tz: string
}

/** '' on the day itself, «ontem» the day before, «21 out» earlier (the board's `diaTxt`) */
export function diaDaLinha(tradingDay: string | null, day: string): string {
  if (!tradingDay || tradingDay === day) return ''
  return tradingDay === addDays(day, -1) ? T.ontem : formatDiaMes(tradingDay)
}

const lado = (t: DayTrade['trade']): string =>
  t.direction === 'long' ? T.compra : t.direction === 'short' ? T.venda : t.direction === 'call' ? T.alta : T.baixa

/**
 * «MES · Compra · 2 ct» / «EUR/USD · Baixa · 1 min» / «SPY Call 790 · vence 15 out · Compra · 2 ct»
 * (the board's `opTxt`: the Registrar's opTexto for the account's market), the amount kept with its
 * unit by a no-break space («2 ct», «0,50 lote», «0,25 BTC», «1 min») as 3-3 did
 */
export function operacaoDaLinha(t: DayTrade['trade'], market: AccountMarket): string {
  const partes = opTexto(t, market).split(' · ')
  const ultima = partes.length - 1
  if (ultima > 0) partes[ultima] = partes[ultima].replace(/ /g, NBSP)
  return partes.join(' · ')
}

function planoDaLinha(d: DayTrade): PlanoDaLinha {
  if (d.plan?.verdict === 'no_plano') return { tipo: 'ok' }
  if (d.plan?.verdict === 'fora_do_plano') {
    const palavras = d.plan.breaks.map((b) => QUEBRAS[b]).filter((x): x is string => !!x)
    if (palavras.length) return { tipo: 'fora', texto: palavras.join(' · ') }
  }
  return { tipo: 'nada' }
}

function clipDaLinha(d: DayTrade): string | null {
  const nota = !!d.trade.note
  if (d.images > 0 && nota) return T.clipImagensENota
  if (d.images > 0) return T.clipImagens
  return nota ? T.clipNota : null
}

function resultadoDaLinha(d: DayTrade, market: AccountMarket): LinhaDoDia['resultado'] {
  const pnl = d.trade.pnl
  if (pnl === null) return { texto: '—', tom: 'neutral' }
  const n = Number(pnl)
  return { texto: formatMoney(pnl, { signed: true, currency: currencyOf(market) }), tom: n > 0 ? 'mint' : n < 0 ? 'red' : 'neutral' }
}

/** One row of the bridge (`eventos`: the trade's exits and stop moves, when read) */
export function linhaDoDia(d: DayTrade, { market, day, tz }: ContextoDoDia, eventos: TradeEvents | null = null): LinhaDoDia {
  const t = d.trade
  const fechada = t.status === 'closed'
  const dia = diaDaLinha(t.tradingDay, day)
  const entrada = horaNoRelogio(t.entryTime, tz)
  const saida = fechada && t.exitTime ? horaNoRelogio(t.exitTime, tz) : null
  const hora = `${dia ? `${dia}, ` : ''}${entrada}${saida ? `${dia ? ' → ' : '–'}${saida}` : ''}`
  const acao = fechada ? T.abrir : market === 'binary' ? T.registrarResultado : T.registrarSaida
  return {
    tradeId: t.id,
    hora,
    operacao: operacaoDaLinha(t, market),
    clip: clipDaLinha(d),
    sub: subDaPonte(market, t, eventos),
    resultado: fechada ? resultadoDaLinha(d, market) : null,
    plano: planoDaLinha(d),
    acao,
    acaoAria: acaoAria(fechada ? T.abrirAria : acao, lado(t), ativoCurto(t, market), dia, entrada),
  }
}

/** The bridge's rows, in the order fetchDayTrades gives them (entry order); `eventos` by trade id */
export function linhasDoDia(trades: readonly DayTrade[], contexto: ContextoDoDia, eventos: Readonly<Record<string, TradeEvents>> | null = null): LinhaDoDia[] {
  return trades.map((d) => linhaDoDia(d, contexto, eventos?.[d.trade.id] ?? null))
}

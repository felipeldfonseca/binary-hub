/**
 * The Registrar's 3-4 recordings (testing/fixtures/registrar-mercados: FTMO, IBKR, Binance, Clear; real SQL answers,
 * invented data) as diario_dia answers (Fase 4 · telas, lane L2; contract §6.7): the recorded day shape of
 * fixtures/diario/dia-top-1022.json with its head's account and day set to the 3-4 account's, and its trades[] the
 * recorded trade states with the keys diario_dia adds (history, plan_kind, money, links, …), read through the real
 * parser (parseDay). Lives outside __tests__ so Jest does not run it as a suite. Invented data only.
 */
import fs from 'fs'
import path from 'path'
import { MARKET_SPEC, currencyOf } from '@/lib/domain/markets'
import { parseDay, type DayRead } from '@/lib/hub/diarioDb'
import { contasMercados, mercadosJson } from './registrarMercados'

type Json = Record<string, any>

const DIARIO = path.join(__dirname, 'fixtures/diario')
const diarioBase = (): Json => JSON.parse(fs.readFileSync(path.join(DIARIO, 'dia-top-1022.json'), 'utf8'))

/** The keys a trade_state answer has that a diario_dia trade does not (write answers' extras) */
const FORA = ['dry_run', 'repeated', 'similar', 'server_now', 'exit_at', 'exit_price', 'exit_registered_at', 'commission', 'points', 'r']

/** A recorded trade state as one trade of diario_dia (registered in the app: plan congelado, no file, no history) */
export function comoTradeDoDia(rec: Json): Json {
  const t: Json = {}
  for (const [k, v] of Object.entries(rec)) if (!FORA.includes(k)) t[k] = v
  const tr = rec.trade as Json
  const fechada = tr.status === 'closed'
  const com = tr.commission ?? null
  const pnl = tr.pnl ?? null
  return {
    ...t,
    plan: rec.plan ?? null,
    gate_now: null,
    plan_now: null,
    exits: rec.exits ?? [],
    stop_moves: rec.stop_moves ?? [],
    breakeven: rec.breakeven ?? null,
    history: false,
    plan_kind: 'congelado',
    money: {
      realized: fechada,
      gross: fechada ? pnl : null,
      commission: com,
      net: fechada && pnl !== null ? Math.round((Number(pnl) - Number(com ?? 0)) * 100) / 100 : null,
    },
    clock_guessed: false,
    imported_at: null,
    import: null,
    links: [],
  }
}

/** A day of a 3-4 account: the recorded head with that account, the recordings named as its trades */
export function diaMercado(conta: 'ftmo' | 'ibkr' | 'binance' | 'clear', dia: string, gravacoes: string[]): DayRead {
  const a = contasMercados().find((c) => c.label.toLowerCase().startsWith(conta === 'ftmo' ? 'ftmo' : conta))!
  const base = diarioBase()
  const spec = MARKET_SPEC[a.market]
  base.account = {
    ...base.account,
    id: a.id,
    label: a.label,
    market: a.market,
    platform: a.platform,
    currency: currencyOf(a.market),
    day: { tz: spec.day.tz, start_min: spec.day.startMin },
  }
  base.day = dia
  base.trades = gravacoes.map((g) => {
    const rec = mercadosJson(g) as Json
    return comoTradeDoDia(rec.state ?? rec)
  })
  base.open_elsewhere = []
  base.deleted = []
  return parseDay(base)
}

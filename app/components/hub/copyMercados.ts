/**
 * How the hub names each market, in pt-BR, for every screen (Fase 2b, shared foundation): the
 * «Qual mercado?» pill, the group and chip name, the forms that follow a noun («de Forex», «da
 * B3»), the step b heading, and when the trading day turns. Strings come from the approved boards
 * (ImportarConta `X.MK`, `X.ORDEM`; Personalizar `MK`) unless marked:
 *   NEW      not on any board (the comment says why)
 *
 * Frozen for the screen lanes: they read these, never redefine them. The market's facts (currency,
 * day clock, rules) are in lib/domain/markets (MARKET_SPEC); only the words are here.
 */
import type { AccountMarket } from '@/lib/domain/markets'
import { formatHhMm, type DayClock } from '@/lib/domain/tempo'

export interface MercadoCopy {
  /** «Qual mercado?» (i1): «Futuros (EUA)», «Forex e CFDs» */
  pill: string
  /** Group header, chip, card and selector: «Futuros», «Forex», «Ações» */
  nome: string
  /** After a noun: «Janela de Forex», «Ainda não lemos arquivos da B3» */
  de: string
  /** Step b and its question: «padrão de Binárias», «Usar a janela da B3 (…)?» */
  deCurto: string
  /** «Nas contas de Forex» (Suas regras ⓘ) */
  nas: string
  /** Step b heading: «Nova conta de forex» */
  titulo: string
}

/** In ACCOUNT_MARKETS order (boards: Futuros, binárias, Forex, Ações, Cripto, B3), `options` last */
export const MERCADO: Readonly<Record<AccountMarket, MercadoCopy>> = {
  futures: {
    pill: 'Futuros (EUA)',
    nome: 'Futuros',
    de: 'de Futuros',
    deCurto: 'de Futuros',
    nas: 'Nas contas de Futuros',
    titulo: 'Nova conta de futuros',
  },
  binary: {
    pill: 'Opções binárias',
    nome: 'Opções binárias',
    de: 'de Opções binárias',
    // Phase 2 board `PAD.nome` (copyRegras NOME_CURTO)
    deCurto: 'de Binárias',
    nas: 'Nas contas de binárias',
    titulo: 'Nova conta de binárias',
  },
  forex: {
    pill: 'Forex e CFDs',
    nome: 'Forex',
    de: 'de Forex',
    deCurto: 'de Forex',
    nas: 'Nas contas de Forex',
    titulo: 'Nova conta de forex',
  },
  stocks: {
    pill: 'Ações e opções (EUA)',
    nome: 'Ações',
    de: 'de Ações',
    deCurto: 'de Ações',
    nas: 'Nas contas de Ações',
    titulo: 'Nova conta de ações',
  },
  crypto: {
    pill: 'Cripto',
    nome: 'Cripto',
    de: 'de Cripto',
    deCurto: 'de Cripto',
    nas: 'Nas contas de Cripto',
    titulo: 'Nova conta de cripto',
  },
  b3: {
    pill: 'B3',
    nome: 'B3',
    de: 'da B3',
    deCurto: 'da B3',
    nas: 'Nas contas da B3',
    titulo: 'Nova conta da B3',
  },
  // NEW (never offered: only an existing Phase 1 backfill account shows it; `nome` is Phase 1's MARKET_LABEL.options)
  options: {
    pill: 'Opções (EUA)',
    nome: 'Opções',
    de: 'de Opções',
    deCurto: 'de Opções',
    nas: 'Nas contas de Opções',
    titulo: 'Nova conta de opções',
  },
}

const NY = 'America/New_York'
const SP = 'America/Sao_Paulo'

/**
 * When an account's trading day turns, after «o dia vira»: «às 18:00 ET», «às 17:00 ET», «à
 * meia-noite de Brasília», «às 21:00 de Brasília»; any other zone «às HH:MM (zona)». Takes the
 * account's own clock (rules_config().accounts[].day), or MARKET_SPEC[m].day for an account not
 * created yet.
 */
export function viraODia(day: DayClock): string {
  const sufixo = day.tz === SP ? ' de Brasília' : day.tz === NY ? ' ET' : ` (${day.tz})`
  return day.startMin === 0 ? `à meia-noite${sufixo}` : `às ${formatHhMm(day.startMin)}${sufixo}`
}

/** Board: ImportarConta `B.infoMoeda`, Personalizar `infoMk` (crypto) */
export const USDT_COMO_DOLAR = 'USDT e USDC contam como dólar.'

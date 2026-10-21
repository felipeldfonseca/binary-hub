/**
 * «Registrar operação» (PR 3-3 for Futures and Ebinex, generalised in 3-4 to every market): the
 * form's state, its checks in the board's order, the payloads it sends and every line the sheet
 * writes from domain values (the gate line, the risk line, the previews, the result block with
 * «Corrigir» and «Custos», the option block, «Venceu sem valor», the step 2 summary, the step 3 card,
 * the marks split, «desde …», the periods). Pure: no React, no client; time is an input (the
 * server's clock, hooks/useRegistrar.useServerNow). The words are components/hub/registrar/copy's
 * templates; what an instrument's form looks like is lib/hub/registrarAtivos' (formaDoAtivo).
 *
 * The rules are the database's (lib/domain/registro mirrors them): the form only refuses what the
 * server would refuse, with the board's texts, so a refusal from the server is rare. Futures and
 * Ebinex behave exactly as in 3-3; every 3-3 export keeps its name and signature.
 */
import {
  addDays,
  firstLocalHmAtOrAfter,
  formatHhMm,
  hmOn,
  isoWeekdayOf,
  localHmInTradingDay,
  localToUtc,
  parseHhMm,
  resolveLocalHm,
  tradingDayFor,
  tradingDayOn,
  utcToLocal,
  type DayClock,
  type TradingWindow,
} from '@/lib/domain/tempo';
import { MARKET_SPEC, type AccountMarket, type Currency } from '@/lib/domain/markets';
import { answerOf, currencyOf, type GateResult, type PlanBreak, type Rules } from '@/lib/domain/gate';
import {
  afterPayload,
  binaryExpiry,
  dayLimitOf,
  entryInstant,
  entryPayload,
  exitInstant,
  exitPayload,
  pnlFromPrices,
  rMultiple,
  riskBeyondLimit,
  stopLevel,
  tradeInstrument,
  undoUntil,
  type AfterFields,
  type AfterPayload,
  type Clock,
  type Direction,
  type EntryPayload,
  type ExitPayload,
  type InstrumentSpec,
  type LimitRoom,
  type MarkEvent,
  type MarkNow,
  type Marks,
  type OptionContract,
  type Outcome,
} from '@/lib/domain/registro';
import { abs, cmp, div, fromInt, isMultipleOf, mul, numeric, numericText, parseNumeric, plainText, round, sub, trimScale } from '@/lib/domain/registro/numeric';
import {
  ABERTA,
  ATIVO,
  COTADA,
  EBINEX,
  ENTRADA,
  ERROS,
  ERROS_PRECOS,
  FECHADA,
  FUTUROS,
  GATE,
  MARCAS,
  OPCAO,
  PASSOS_PRECOS,
  PRECOS,
  QTD,
  RESULTADO,
  RISCO,
  SIMILAR,
  TIPO_EUA,
  VSV,
} from '@/components/hub/registrar/copy';
import { formatDiaMes, formatMoney } from './formato';
import { formatDecimal, lerNumero } from './numero';
import { dinheiroCompacto, horaNoRelogio, sufixoRelogio, type Tom } from './posso';
import type { AvisoDoLimite, RegistrarDefaults } from './registrar';
import { COTACOES, CONTRACT_CHIPS, type Cotacao } from './registrar';
import { buscarAtivos, chipsDoAtivo, formaDoAtivo, simboloRegistrado, statusBusca, type FormaAtivo } from './registrarAtivos';
import type { RegisteredTrade } from './registrarDb';

// ---------------------------------------------------------------------------------------------
// The account the sheet registers on
// ---------------------------------------------------------------------------------------------

/** The account's market (3-3 registered futures and binary; 3-4 every market) */
export type MercadoReg = AccountMarket;

/** What the form needs of an account: its clocks, windows, «desde» and currency */
export interface ContaReg {
  id: string;
  label: string;
  market: MercadoReg;
  platform: string | null;
  /** The window clock every hour is typed on (the window's; without one, the market's: IBKR → New York) */
  clock: Clock;
  /** The trading day's clock (the version's, else the market's) */
  dayClock: DayClock;
  windows: TradingWindow[];
  /** The trading day of version 1 («regras desde»); null when unknown */
  desdeDay: string | null;
  currency: Currency;
  /** The rules have a daily loss limit */
  temLimite: boolean;
}

/** The account as the sheet reads it (useAccounts' row and its rules_now answer, when there is one) */
export function contaReg(
  account: { id: string; label: string; market: AccountMarket; platform: string | null },
  rules: Rules | null,
  desdeDay: string | null,
): ContaReg {
  const market = account.market;
  const spec = MARKET_SPEC[market];
  const windowTz = rules?.windows[0]?.tz;
  const clock: Clock = windowTz === 'America/New_York' || windowTz === 'America/Sao_Paulo' ? windowTz : spec.windowTz;
  return {
    id: account.id,
    label: account.label,
    market,
    platform: account.platform,
    clock,
    dayClock: rules?.day ?? spec.day,
    windows: rules?.windows ?? [],
    desdeDay,
    currency: currencyOf(market),
    temLimite: !!rules?.limit,
  };
}

/** The account's trading day of an instant (compute_trading_day with the version in force now) */
export function diaDe(conta: ContaReg, instant: Date): string {
  return conta.windows.length > 0 ? tradingDayFor(instant, conta.dayClock, conta.windows) : tradingDayOn(instant, conta.dayClock);
}

/** ' ET' / ' de Brasília' */
export const sufixo = (conta: Pick<ContaReg, 'clock'>) => sufixoRelogio(conta.clock);
/** ' (ET)' / ' (Brasília)': the hour fields' labels (RO `relRot`) */
export const sufixoCampo = (conta: Pick<ContaReg, 'clock'>) => (conta.clock === 'America/Sao_Paulo' ? ' (Brasília)' : ' (ET)');
/** «10:12» on the account's clock */
export const hora = (conta: Pick<ContaReg, 'clock'>, at: Date) => horaNoRelogio(at, conta.clock);
/** «10:12 ET» / «20:12 de Brasília» */
export const horaRel = (conta: Pick<ContaReg, 'clock'>, at: Date) => `${hora(conta, at)}${sufixo(conta)}`;

/** The calendar date of an instant on the account's clock */
const dataEm = (conta: Pick<ContaReg, 'clock'>, at: Date) => utcToLocal(at, conta.clock).date;

/** '' (today), 'ontem' or «21 out»: how far a date is from today's on the account's clock */
export function diaRelativo(conta: Pick<ContaReg, 'clock'>, at: Date, now: Date): '' | 'ontem' | string {
  const d = dataEm(conta, at);
  const hoje = dataEm(conta, now);
  if (d === hoje) return '';
  if (d === addDays(hoje, -1)) return 'ontem';
  return formatDiaMes(d);
}

/** The markets 3-4 adds: «Corrigir», «Custos», the typed result's swap phrase, the before-«desde» text */
const MERCADOS_NOVOS: readonly AccountMarket[] = ['forex', 'stocks', 'options', 'crypto', 'b3'];
export const mercadoNovo = (market: AccountMarket) => MERCADOS_NOVOS.includes(market);

// ---------------------------------------------------------------------------------------------
// The draft (step 1), kept in memory and in sessionStorage per account (D14, C6)
// ---------------------------------------------------------------------------------------------

export type Modo = 'aberta' | 'fechada';
export type MarcaKind = 'setup' | 'execucao' | 'emocao';
export const MARCA_KINDS: readonly MarcaKind[] = ['setup', 'execucao', 'emocao'];
export const MARCA_VALORES: Readonly<Record<MarcaKind, readonly string[]>> = {
  setup: ['A', 'B', 'C'],
  execucao: ['cedo', 'no_ponto', 'tarde'],
  emocao: ['calmo', 'confiante', 'ansioso', 'frustrado', 'neutro'],
};
/** Ebinex «Expiração» (durationsOf('ebinex')): 1, 5 and 15 min (v55) */
export const DURACOES_EBINEX: readonly number[] = [60, 300, 900];

export type TipoEua = 'acao' | 'opcao';

/**
 * 3c: one row of «Já fechada» in several exits («+ Outra saída»), as typed. `id` names the row's
 * fields (`f-s{id}q`…) and never changes while the row lives; `hora` null follows the server's
 * clock (the last row follows «Venceu sem valor»'s 16:00 ET while it is on); `preco` null = never
 * typed (the last row then shows «Venceu sem valor»'s 0 while it is on), '' = typed and cleared,
 * which stays empty (board `s0.p !== undefined`, RO js l.1216).
 */
export interface SaidaRascunho {
  id: number;
  qtd: string;
  preco: string | null;
  hora: string | null;
  /** «Resultado desta saída» (instruments whose result is typed), as typed (signed) */
  res: string;
}

/** At most 20 exits per trade (sintese C7: too_many_exits) */
export const MAX_SAIDAS = 20;

/**
 * Step 1's draft, v3 (3c): v2 (3-4: v1 plus the new markets' fields) plus «Já fechada»'s rows and
 * «Movi o stop para o breakeven». A stored v1 or v2 is read as v3 (lerRascunho).
 */
export interface Rascunho {
  v: 3;
  accountId: string;
  /** One per form, kept across retries and a reopened sheet (C6, C23) */
  clientKey: string;
  modo: Modo;
  /** «Já fechada»: the trading day chosen; null = «Hoje» */
  dia: string | null;
  // Price markets
  /** The instrument: a futures root, a forex pair, a stock or ETF, an option's underlying, a crypto coin (without its quote), a B3 code */
  ativo: string | null;
  lado: 'long' | 'short' | null;
  /** A chip's value («1» «2» «3», «0.5»…), or what the field holds («Outro», or a field-only quantity) */
  qtd: string;
  /** The quantity field is in use («Outro», or a kind without chips) */
  qtdOutro: boolean;
  preco: string;
  /** "HH:MM"; null = follows the server's clock */
  hora: string | null;
  precoSaida: string;
  horaSaida: string | null;
  stop: string;
  alvo: string;
  // Ebinex
  par: string | null;
  parOutro: boolean;
  parTexto: string;
  direcao: 'call' | 'put' | null;
  duracao: number | null;
  stake: string;
  payout: string;
  /** Ebinex «Como terminou?» */
  resultado: Outcome | null;
  /** Taps held until «Registrar entrada» (sent as the entry's `marks`) */
  marcas: Partial<Record<MarcaKind, string>>;
  maisAberto: boolean;
  // 3-4
  /** Ações e opções: «Ação ou ETF» / «Opção» (an `options` account is always «Opção») */
  tipoEua: TipoEua;
  /** Cripto: «Cotada em» */
  cotacao: Cotacao;
  /** «Buscar ativo / par / moeda»: what is typed */
  busca: string;
  /** Opção: «Tipo» */
  opTipo: 'call' | 'put' | null;
  /** Opção: «Strike, US$», as typed */
  strike: string;
  /** Opção: «Vencimento», YYYY-MM-DD */
  vencimento: string | null;
  /** Opção, «Já fechada»: «Venceu sem valor» */
  vsv: boolean;
  /** «Já fechada»: the typed result («Resultado, US$») or the correction, as typed (signed) */
  res: string;
  /** «Já fechada»: «Corrigir» is open */
  corrigir: boolean;
  /** «Já fechada»: «Custos · opcional», as typed */
  custos: string;
  // 3c
  /** «Já fechada»: 2–20 rows after «+ Outra saída»; null = one exit (precoSaida, horaSaida) */
  saidas: SaidaRascunho[] | null;
  /**
   * «Já fechada»: «Movi o stop para o breakeven» as pressed. Kept while the pill is not on screen
   * (no valid stop): it counts only while rendered (registrarSaidas.comSaidas), so a stop typed back
   * brings the pill back pressed (board `beFormOn = temBeForm && f.be`)
   */
  be: boolean;
  /** «Preço quando moveu», as typed */
  bePreco: string;
}

/** A decimal text the pt-BR way, for a prefilled field ('17.5' → '17,5') */
const campo = (x: string | null | undefined) => (x ? formatDecimal(x) : '');

/** The quantity a form starts with for a kind: the last one used (a chip, else «Outro» with it), else the first chip; a field starts empty */
function qtdInicial(forma: FormaAtivo | null, ultima: string | undefined): { qtd: string; qtdOutro: boolean } {
  const chips = forma?.quantidade.chips ?? null;
  if (!chips) return { qtd: '', qtdOutro: true };
  if (ultima === undefined) return { qtd: chips[0], qtdOutro: false };
  return chips.includes(ultima) ? { qtd: ultima, qtdOutro: false } : { qtd: formatDecimal(ultima), qtdOutro: true };
}

/** The 3-4 fields at rest (the futures and Ebinex drafts carry them unused) */
const NOVOS_CAMPOS = {
  tipoEua: 'acao' as TipoEua,
  cotacao: 'USDT' as Cotacao,
  busca: '',
  opTipo: null,
  strike: '',
  vencimento: null,
  vsv: false,
  res: '',
  corrigir: false,
  custos: '',
};

/** The 3c fields at rest: one exit, the pill off */
const CAMPOS_3C = { saidas: null, be: false, bePreco: '' };

/** Step 1 as it opens on an account (its starting values: D5, D6; 3-4 §5.1) */
export function rascunhoInicial(conta: Pick<ContaReg, 'id' | 'market'>, defaults: RegistrarDefaults | null, clientKey: string): Rascunho {
  const d = defaults ?? { symbol: null, quantity: '1', pairs: [], payoutBySymbol: {}, stake: null };
  const market = conta.market;
  const comum = {
    v: 3 as const,
    accountId: conta.id,
    clientKey,
    modo: 'aberta' as Modo,
    dia: null,
    lado: null,
    preco: '',
    hora: null,
    precoSaida: '',
    horaSaida: null,
    stop: '',
    alvo: '',
    direcao: null,
    duracao: null,
    resultado: null,
    marcas: {},
    maisAberto: false,
    ...NOVOS_CAMPOS,
    ...CAMPOS_3C,
  };
  if (market === 'futures' || market === 'binary') {
    const futures = market === 'futures';
    const chip = (CONTRACT_CHIPS as readonly string[]).includes(d.quantity);
    const par = futures ? null : d.pairs[0] ?? null;
    return {
      ...comum,
      ativo: futures ? d.symbol ?? 'MES' : null,
      qtd: chip ? d.quantity : formatDecimal(d.quantity),
      qtdOutro: !chip,
      par,
      parOutro: !futures && par === null,
      parTexto: '',
      stake: campo(d.stake),
      payout: par ? campo(d.payoutBySymbol[par]) : '',
    };
  }
  const tipoEua: TipoEua = market === 'options' ? 'opcao' : d.tipoEua ?? 'acao';
  const cotacao: Cotacao = d.cotacao ?? 'USDT';
  const exemplo = chipsDoAtivo(market, d, { opcao: tipoEua === 'opcao' })[0] ?? null;
  const ativo = d.symbol ?? exemplo;
  const forma = ativo ? formaDoAtivo(market, ativo, { opcao: tipoEua === 'opcao', cotacao }) : null;
  const tipoQ = forma?.quantidade.tipo;
  const ultima = tipoQ === 'contratos' || tipoQ === 'contratosB3' || tipoQ === 'lotes' ? d.quantidades?.[tipoQ] : undefined;
  return {
    ...comum,
    tipoEua,
    cotacao,
    ativo,
    ...qtdInicial(forma, ultima),
    par: null,
    parOutro: false,
    parTexto: '',
    stake: '',
    payout: '',
  };
}

/** Something typed or tapped since the sheet opened («Fechar sem salvar?», D12) */
export function rascunhoMexido(r: Rascunho, inicial: Rascunho): boolean {
  const comparar = (x: Rascunho) => {
    const { clientKey: _k, maisAberto: _m, ...rest } = x;
    return JSON.stringify(rest);
  };
  return comparar(r) !== comparar(inicial);
}

export const chaveRascunho = (accountId: string) => `hub:registrar:rascunho:${accountId}`;

const str = (x: unknown): x is string => typeof x === 'string';
const strOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 3c: a stored row set, when every row has its shape (2–20 rows, distinct whole ids); else null
 * (the draft goes back to one exit, the rest of it kept)
 */
function lerSaidas(x: unknown): SaidaRascunho[] | null {
  if (!Array.isArray(x) || x.length < 2 || x.length > MAX_SAIDAS) return null;
  const ids = new Set<number>();
  const out: SaidaRascunho[] = [];
  for (const s of x) {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (typeof o.id !== 'number' || !Number.isInteger(o.id) || o.id < 1 || ids.has(o.id)) return null;
    if (!str(o.qtd) || !strOrNull(o.preco) || !strOrNull(o.hora) || !str(o.res)) return null;
    ids.add(o.id);
    out.push({ id: o.id, qtd: o.qtd, preco: o.preco, hora: o.hora, res: o.res });
  }
  return out;
}

/**
 * A stored draft, when it has this shape and belongs to this account; else null. A v1 draft (3-3,
 * the same clientKey: C6) is read with the 3-4 fields at rest, a v1 or v2 with the 3c fields at
 * rest (one exit, the pill off); a v3 with rows that are not all well formed goes back to one exit.
 */
export function lerRascunho(json: unknown, accountId: string): Rascunho | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  const v1 =
    (r.v === 1 || r.v === 2 || r.v === 3) &&
    r.accountId === accountId &&
    str(r.clientKey) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.clientKey) &&
    (r.modo === 'aberta' || r.modo === 'fechada') &&
    strOrNull(r.dia) &&
    strOrNull(r.ativo) &&
    (r.lado === null || r.lado === 'long' || r.lado === 'short') &&
    str(r.qtd) &&
    typeof r.qtdOutro === 'boolean' &&
    str(r.preco) &&
    strOrNull(r.hora) &&
    str(r.precoSaida) &&
    strOrNull(r.horaSaida) &&
    str(r.stop) &&
    str(r.alvo) &&
    strOrNull(r.par) &&
    typeof r.parOutro === 'boolean' &&
    str(r.parTexto) &&
    (r.direcao === null || r.direcao === 'call' || r.direcao === 'put') &&
    (r.duracao === null || (typeof r.duracao === 'number' && DURACOES_EBINEX.includes(r.duracao))) &&
    str(r.stake) &&
    str(r.payout) &&
    (r.resultado === null || r.resultado === 'ganho' || r.resultado === 'perda' || r.resultado === 'devolvida') &&
    !!r.marcas &&
    typeof r.marcas === 'object' &&
    typeof r.maisAberto === 'boolean';
  if (!v1) return null;
  const v2 =
    r.v === 1 ||
    ((r.tipoEua === 'acao' || r.tipoEua === 'opcao') &&
      typeof r.cotacao === 'string' &&
      (COTACOES as readonly string[]).includes(r.cotacao) &&
      str(r.busca) &&
      (r.opTipo === null || r.opTipo === 'call' || r.opTipo === 'put') &&
      str(r.strike) &&
      (r.vencimento === null || (str(r.vencimento) && ISO_DATE.test(r.vencimento))) &&
      typeof r.vsv === 'boolean' &&
      str(r.res) &&
      typeof r.corrigir === 'boolean' &&
      str(r.custos));
  if (!v2) return null;
  const marcas: Partial<Record<MarcaKind, string>> = {};
  for (const k of MARCA_KINDS) {
    const v = (r.marcas as Record<string, unknown>)[k];
    if (str(v) && MARCA_VALORES[k].includes(v)) marcas[k] = v;
  }
  const base = r.v === 1 ? { ...(r as object), ...NOVOS_CAMPOS } : { ...(r as object) };
  const c3 =
    r.v === 3
      ? { saidas: lerSaidas(r.saidas), be: r.be === true, bePreco: str(r.bePreco) ? r.bePreco : '' }
      : CAMPOS_3C;
  return { ...(base as unknown as Rascunho), v: 3, marcas, ...c3 };
}

// ---------------------------------------------------------------------------------------------
// Draft transitions the price markets share (the board's `escolherIns`, `limpar`, toggles)
// ---------------------------------------------------------------------------------------------

/**
 * What choosing another instrument, quote or kind clears (RO `limpar`, l.1081): never the exit hour
 * typed in «Já fechada», which 3-3 and the board keep. 3c: also the rows («+ Outra saída») and
 * «Movi o stop para o breakeven» with its price (they were in the old instrument's units).
 */
const LIMPAR = { busca: '', preco: '', stop: '', alvo: '', precoSaida: '', res: '', corrigir: false, vsv: false, saidas: null, be: false, bePreco: '' } as const;

/** The quantity kind's starting value for a draft (the last one used, else the first chip, else empty) */
function qtdDoTipo(forma: FormaAtivo | null, padroes: RegistrarDefaults | null | undefined, market: AccountMarket): { qtd: string; qtdOutro: boolean } {
  const tipoQ = forma?.quantidade.tipo;
  const ultima =
    market === 'futures' ? padroes?.quantity : tipoQ === 'contratos' || tipoQ === 'contratosB3' || tipoQ === 'lotes' ? padroes?.quantidades?.[tipoQ] : undefined;
  return qtdInicial(forma, ultima);
}

/**
 * A chip or a search result chosen (RO l.1081–1083): the search empties, the prices, stop, target,
 * exit price, result, «Corrigir» and «Venceu sem valor» clear (the exit hour stays); the quantity
 * stays when its label is the same (contratos → contratos), else it starts over. Crypto «X/Y» from
 * «Usar» sets the coin and its quote (when the quote is one the form offers; else the pair stays
 * whole, ETH/BTC, and formaDoAtivo reads its two coins).
 */
export function escolherAtivo(r: Rascunho, market: AccountMarket, simbolo: string, padroes?: RegistrarDefaults | null): Rascunho {
  let ativo = String(simbolo ?? '').trim().toUpperCase();
  let cotacao = r.cotacao;
  if (market === 'crypto' && ativo.includes('/')) {
    const [coin, quote] = ativo.split('/');
    const q = quote === 'BRL' ? 'R$' : (COTACOES as readonly string[]).includes(quote) ? (quote as Cotacao) : null;
    if (q && coin) {
      ativo = coin;
      cotacao = q;
    }
  }
  const opcao = market === 'options' || (market === 'stocks' && r.tipoEua === 'opcao');
  const antes = r.ativo ? formaDoAtivo(market, r.ativo, { opcao, cotacao: r.cotacao }) : null;
  const depois = formaDoAtivo(market, ativo, { opcao, cotacao });
  const mesmaQtd = !!antes && !!depois && antes.quantidade.rotulo === depois.quantidade.rotulo;
  return { ...r, ...LIMPAR, ativo, cotacao, ...(mesmaQtd ? {} : qtdDoTipo(depois, padroes, market)) };
}

/**
 * «Cotada em» changed: the prices clear (RO l.1152). On a pair whose quote is none of the pills
 * (ETH/BTC, kept whole by «Usar»), the pill quotes its coin instead: ETH/BTC + USDC → ETH/USDC (N)
 */
export function mudarCotacao(r: Rascunho, cotacao: Cotacao): Rascunho {
  const slash = (r.ativo ?? '').indexOf('/');
  const ativo = r.ativo && slash > 0 ? r.ativo.slice(0, slash).trim() : r.ativo;
  return { ...r, ...LIMPAR, ativo, cotacao };
}

/** «O que você operou?» changed: the prices and the quantity start over; the chips are the other kind's */
export function mudarTipoEua(r: Rascunho, tipoEua: TipoEua, padroes?: RegistrarDefaults | null): Rascunho {
  const ativo = r.ativo ?? chipsDoAtivo('stocks', padroes ?? null, { opcao: tipoEua === 'opcao' })[0] ?? null;
  const forma = ativo ? formaDoAtivo('stocks', ativo, { opcao: tipoEua === 'opcao' }) : null;
  return { ...r, ...LIMPAR, tipoEua, ativo, opTipo: null, strike: '', vencimento: null, ...qtdDoTipo(forma, padroes, 'stocks') };
}

/** «Vencimento» changed: «Venceu sem valor» turns off and the exit it filled clears (RO l.1158) */
export const mudarVencimento = (r: Rascunho, vencimento: string | null): Rascunho => ({ ...r, vencimento, vsv: false, precoSaida: '', horaSaida: null });

/**
 * «Venceu sem valor» on or off: the exit premium and hour follow it (0 at 16:00 ET) until typed
 * over. 3c: with rows, it applies to the last one (RO js l.1257), whose premium and hour start over
 * (never typed: `preco` and `hora` null, the board's `p: undefined, h: undefined`).
 */
export const alternarVsv = (r: Rascunho): Rascunho => ({
  ...r,
  vsv: !r.vsv,
  precoSaida: '',
  horaSaida: null,
  ...(r.saidas ? { saidas: r.saidas.map((s, k, l) => (k === l.length - 1 ? { ...s, preco: null, hora: null } : s)) } : {}),
});

/**
 * «Corrigir» ↔ «Usar o calculado»: opening fills the field with the computed result
 * (BlocoResultadoModelo.calculado, «−57,50»); closing discards what was typed
 */
export const alternarCorrigir = (r: Rascunho, calculado: string | null): Rascunho =>
  r.corrigir ? { ...r, corrigir: false, res: '' } : { ...r, corrigir: true, res: calculado ?? '' };

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

/** An amount as cents (for dinheiroCompacto) */
export const centavos = (decimal: string): number => Math.round(Number(decimal) * 100);
/** «US$ 125» / «US$ 112,50»: the limit warning's amounts (contract §4.3.4) */
const compacto = (decimal: string, currency: Currency) => dinheiroCompacto(centavos(decimal), currency);
/** «−US$ 505» */
const compactoNeg = (cents: number, currency: Currency) => `${cents < 0 ? '−' : ''}${dinheiroCompacto(cents, currency)}`;
/** «+US$ 75,00» / «−US$ 100,00» */
const dinheiro = (decimal: string, currency: Currency) => formatMoney(decimal, { signed: true, currency });
/** «US$ 110,00» */
const dinheiroSem = (decimal: string, currency: Currency) => formatMoney(decimal.replace(/^-/, ''), { currency });
/** «7.912,50» */
export const preco = (decimal: string) => formatDecimal(decimal, { minDecimals: 2 });
/** «+7,50 pts» */
const pontos = (decimal: string) => FUTUROS.pts(formatDecimal(decimal, { minDecimals: 2, signed: true }));
/** «2» → «2 ct» */
const contratos = (q: string) => `${formatDecimal(q)} ct`;
/** A ratio as the board writes it («2», «1,5»: up to two decimals) */
const curto = (x: number) => {
  const r = Math.round(x * 100) / 100;
  return formatDecimal(String(r));
};
/** A decimal text, up to two decimals, without trailing zeros («150», «5,5») */
const curtoDec = (decimal: string, signed = false) => formatDecimal(plainText(round(numeric(decimal), 2)), { signed });

/** 'dólar' / 'reais' (RO `moedaPal`; exported in 3c for registrarSaidas) */
export const moedaPal = (currency: Currency) => (currency === 'BRL' ? RISCO.reais : RISCO.dolar);

/** Decimals of a decimal text as the reader gave it (trailing zeros already gone; exported in 3c) */
export const casasDe = (decimal: string) => (decimal.includes('.') ? decimal.length - decimal.indexOf('.') - 1 : 0);
/** Digits before the point (exported in 3c) */
export const inteirosDe = (decimal: string) => decimal.replace(/^-/, '').split('.')[0].replace(/^0+(?=\d)/, '').length;

/** A field read as a positive decimal ('7896.25'), or why not */
function positivo(text: string, ponto = false): { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' | 'zero' } {
  const n = lerNumero(text, { ponto });
  if (!n.ok) return n;
  const v = parseNumeric(n.value);
  if (!v || cmp(v, fromInt(0)) <= 0) return { ok: false, reason: 'zero' };
  return { ok: true, value: n.value };
}

/** Off the instrument's tick (exported in 3c) */
export const naoMultiplo = (value: string, tick: string | null) => !!tick && !isMultipleOf(numeric(value), numeric(tick));

/** The instrument of a symbol (3-3: the futures roots; 3-4: any market's) */
export const instrumento = (market: MercadoReg, symbol: string): InstrumentSpec | null => tradeInstrument(market, symbol);

/** A price as the board shows it: at least the instrument's decimals, more when it has them (RO `fmtP`) */
export function precoDe(forma: Pick<FormaAtivo, 'casasMostra'> | null, decimal: string): string {
  const v = parseNumeric(decimal);
  if (!v) return decimal;
  const t = trimScale(v);
  const casas = Math.max(forma?.casasMostra ?? 2, Math.min(8, t.scale));
  return formatDecimal(numericText(t), { minDecimals: casas });
}

/** «o MES anda de 0,25 em 0,25» / «o WIN anda de 5 em 5» (RO `passoTxt`; the root names it) */
const passoDe = (forma: FormaAtivo) => (forma.tickTexto ? FUTUROS.passo(forma.nomePasso, forma.tickTexto) : '');

/**
 * A price difference as the board writes it (RO `difTxt`): futures «+7,50 pts»; B3 futures «+150 pts»;
 * pips «+11,5 pips»; «+0,75 por ação»; «+0,55 no prêmio»; «+450 por BTC»; «+5,25 no preço».
 * `dif` is (exit − entry) × side, decimal text.
 */
export function diferencaTexto(forma: FormaAtivo, dif: string): string {
  const d = numeric(dif);
  switch (forma.diferenca) {
    case 'ptsFut':
      return pontos(dif);
    case 'pts':
      return RESULTADO.pts(curtoDec(dif, true));
    case 'pips': {
      const pip = forma.spec.pip ? numeric(forma.spec.pip) : null;
      if (!pip) return RESULTADO.noPreco(formatDecimal(plainText(d), { signed: true }));
      return RESULTADO.pips(formatDecimal(numericText(round(div(d, pip), 1)), { minDecimals: 1, signed: true }));
    }
    case 'acao':
      return RESULTADO.porAcao(formatDecimal(numericText(round(d, 2)), { minDecimals: 2, signed: true }));
    case 'premio':
      return RESULTADO.noPremio(formatDecimal(numericText(round(d, 2)), { minDecimals: 2, signed: true }));
    case 'moeda':
      return RESULTADO.porMoeda(formatDecimal(plainText(round(d, 8)), { signed: true }), forma.moedaBase ?? '');
    case 'preco':
    default: {
      const t = plainText(round(d, 8));
      return RESULTADO.noPreco(formatDecimal(t, { minDecimals: casasDe(t) < 2 ? 2 : 0, signed: true }));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The price markets' readers (the board's erroPreco, erroNivel, erroQ; the server's limits)
// ---------------------------------------------------------------------------------------------

/** A field read: its decimal value, or its error (exported in 3c with the readers below, for registrarSaidas) */
export type Lido = { value: string | null; erro?: string };

/** «Preço de entrada» / «de saída» (or «Prêmio»): empty, numbers, above zero (an option exits at 0), the tick, the decimals */
export function lerPrecoDe(forma: FormaAtivo, text: string, lado: 'entrada' | 'saída', zeroOk = false): Lido {
  const oque = forma.unidadeStop === 'premio' ? 'prêmio' : 'preço';
  const n = lerNumero(text, { ponto: forma.pontoDecimal });
  if (!n.ok) return { value: null, erro: n.reason === 'empty' ? ERROS_PRECOS.vazio(oque, lado) : ERROS_PRECOS.numero(forma.exemplo) };
  const v = numeric(n.value);
  if (cmp(v, fromInt(0)) < 0 || (cmp(v, fromInt(0)) === 0 && !zeroOk)) return { value: null, erro: ERROS_PRECOS.zero(oque) };
  if (inteirosDe(n.value) > 10) return { value: null, erro: ERROS_PRECOS.numero(forma.exemplo) };
  if (naoMultiplo(n.value, forma.spec.tick)) return { value: null, erro: ERROS.precoPasso(forma.nomePasso, forma.tickTexto ?? '') };
  if (forma.casasMax !== null && casasDe(n.value) > forma.casasMax) return { value: null, erro: ERROS_PRECOS.casas(forma.casasMax) };
  return { value: n.value };
}

/** «Stop» / «Alvo» in the instrument's unit; with the side and the entry, the level the server would store */
function lerNivel(forma: FormaAtivo, text: string, side: 'stop' | 'target', lado: 'long' | 'short' | null, entrada: string | null): Lido {
  if (text.trim() === '') return { value: null };
  const u = forma.unidadeStop;
  const zero = u === 'pts' ? ERROS.pontosZero : u === 'pips' ? ERROS_PRECOS.pipsZero : ERROS_PRECOS.precoStopZero;
  const p = positivo(text, forma.pontoDecimal);
  if (!p.ok || inteirosDe(p.value) > 10) return { value: null, erro: zero };
  if (u === 'pts' && naoMultiplo(p.value, forma.spec.tick)) return { value: null, erro: ERROS.pontosPasso(forma.nomePasso, forma.tickTexto ?? '') };
  const casas = u === 'pts' || u === 'pips' ? 8 : forma.spec.priceDp ?? 8;
  if (casasDe(p.value) > casas) return { value: null, erro: ERROS_PRECOS.casas(casas) };
  if (lado && entrada) {
    const lv = stopLevel(forma.spec, lado === 'long' ? 1 : -1, entrada, side, p.value);
    if (!lv.ok) {
      if (u === 'preco' || u === 'premio') {
        const oque = u === 'premio' ? 'prêmio' : 'preço';
        return { value: null, erro: side === 'stop' ? ERROS_PRECOS.stopLado(lado === 'long', oque) : ERROS_PRECOS.alvoLado(lado === 'long', oque) };
      }
      return { value: null, erro: zero };
    }
  }
  return { value: p.value };
}

/** The quantity: a chip, or the field (whole numbers, decimals, the server's digits) */
export function lerQuantidade(forma: FormaAtivo, r: Pick<Rascunho, 'qtd' | 'qtdOutro'>): Lido {
  const q = forma.quantidade;
  if (q.chips && !r.qtdOutro) return q.chips.includes(r.qtd) ? { value: r.qtd } : { value: null, erro: ERROS.qtdVazia };
  const n = lerNumero(r.qtd);
  if (!n.ok) return { value: null, erro: n.reason === 'empty' ? ERROS.qtdVazia : ERROS_PRECOS.numero(q.exemplo) };
  if (cmp(numeric(n.value), fromInt(0)) <= 0) return { value: null, erro: ERROS.qtdZero };
  if (q.inteira && !/^[0-9]+$/.test(n.value)) {
    return { value: null, erro: q.tipo === 'acoesB3' ? ERROS_PRECOS.qtdInteiraAcoes : q.tipo === 'unidades' ? ERROS_PRECOS.qtdInteira : ERROS.qtdInteira };
  }
  if (q.inteira && n.value.length > 6) return { value: null, erro: ERROS_PRECOS.numero(q.exemplo) };
  if (!q.inteira && casasDe(n.value) > q.casas) return { value: null, erro: ERROS_PRECOS.casas(q.casas) };
  if (!q.inteira && inteirosDe(n.value) > 10) return { value: null, erro: ERROS_PRECOS.numero(q.exemplo) };
  return { value: n.value };
}

/** A typed result («Resultado, US$»; signed) or «Custos» (not signed): up to 16 digits and 2 decimals */
export function lerDinheiro(text: string, sinal: boolean): Lido & { vazio: boolean } {
  const n = lerNumero(text, { sinal });
  if (!n.ok) return { value: null, vazio: n.reason === 'empty', erro: n.reason === 'empty' ? undefined : sinal ? ERROS_PRECOS.resNumero : ERROS_PRECOS.custosNumero };
  if (inteirosDe(n.value) > 16) return { value: null, vazio: false, erro: sinal ? ERROS_PRECOS.resNumero : ERROS_PRECOS.custosNumero };
  if (casasDe(n.value) > 2) return { value: null, vazio: false, erro: ERROS_PRECOS.casas(2) };
  return { value: n.value, vazio: false };
}

// ---------------------------------------------------------------------------------------------
// The result block («Já fechada» and step 2: RO l.929–966, the board's montarSX)
// ---------------------------------------------------------------------------------------------

export interface BlocoResultadoModelo {
  /** `role="status"`: «Resultado: +11,5 pips · ≈ +US$ 57,50» / «Se sair a 1,08635: …» / «Resultado: preencha os dois preços.» */
  linha: string;
  /** «Corrigir» ↔ «Usar o calculado» (new markets, a computed result on screen); null when not offered */
  corrigir: { rotulo: string; aberto: boolean } | null;
  /**
   * The computed result as the field shows it when «Corrigir» opens («−57,50»; alternarCorrigir fills
   * the field with it); null when nothing is computed yet
   */
  calculado: string | null;
  /** The estimate note (a pair with the dollar as base, not corrected) */
  notaEstimativa: string | null;
  /** The typed result («Resultado, US$», required) or the correction («Resultado na sua plataforma, US$»); null when hidden */
  campo: { rotulo: string; nota: string; valor: string; erro: string | null } | null;
  /** «Custos, US$ · opcional» (new markets); its errors always show */
  custos: { rotulo: string; nota: string; valor: string; erro: string | null } | null;
}

interface BlocoEntrada {
  conta: Pick<ContaReg, 'market' | 'currency'>;
  forma: FormaAtivo;
  /** Step 2 (an open trade's exit) or «Já fechada» */
  aberta: boolean;
  lado: 'long' | 'short' | null;
  /** The entry as typed («Já fechada») or stored (step 2, decimal text) */
  entradaTexto: string;
  entradaDecimal: boolean;
  saidaTexto: string;
  qtd: string | null;
  tentou: boolean;
  corrigir: boolean;
  res: string;
  custos: string;
}

interface BlocoSaida {
  bloco: BlocoResultadoModelo;
  erros: { res?: string; custos?: string };
  /** What the payload sends: the typed or corrected result (signed decimal) and the costs */
  pnl: string | undefined;
  costs: string | undefined;
}

function blocoResultado(x: BlocoEntrada): BlocoSaida {
  const { forma, conta } = x;
  const opcao = forma.tipo === 'opcao';
  const lerP = (t: string, saida: boolean) => {
    if (!saida && x.entradaDecimal) return parseNumeric(t) ? t : null;
    const n = lerNumero(t, { ponto: forma.pontoDecimal });
    return n.ok ? n.value : null;
  };
  const pIn = lerP(x.entradaTexto, false);
  const pOut = lerP(x.saidaTexto, true);
  const inOk = !!pIn && cmp(numeric(pIn), fromInt(0)) > 0;
  const outOk = !!pOut && (cmp(numeric(pOut), fromInt(0)) > 0 || (opcao && cmp(numeric(pOut), fromInt(0)) === 0));
  const fora = (v: string | null) => !!v && naoMultiplo(v, forma.spec.tick);
  const passo = passoDe(forma);
  let linha: string;
  let calc: string | null = null;
  if (!x.aberta && !x.lado) linha = RESULTADO.escolhaLado;
  else if (x.aberta && !outOk) linha = opcao ? RESULTADO.informePremio : RESULTADO.informePreco;
  else if (x.aberta && fora(pOut)) linha = x.tentou ? RESULTADO.confiraSaida : RESULTADO.confiraSaidaPasso(passo);
  else if (!x.aberta && (!inOk || !outOk)) linha = opcao ? RESULTADO.preenchaPremios : RESULTADO.preenchaPrecos;
  else if (!x.aberta && (fora(pIn) || fora(pOut))) linha = x.tentou ? RESULTADO.confiraPrecos : RESULTADO.confiraPrecosPasso(passo);
  else if (!x.qtd) linha = RESULTADO.informeQuantidade;
  else {
    const sgn = x.lado === 'short' ? -1 : 1;
    const dif = numericText(mul(sub(numeric(pOut as string), numeric(pIn as string)), fromInt(sgn)));
    calc = pnlFromPrices(forma.spec, sgn, x.qtd, pIn as string, pOut as string);
    const valor = calc === null ? RESULTADO.digite(moedaPal(conta.currency)) : `${forma.modo === 'estimativa' ? RESULTADO.estimativa : ''}${dinheiro(calc, conta.currency)}`;
    linha = x.aberta ? RESULTADO.seSair(precoDe(forma, pOut as string), diferencaTexto(forma, dif), valor) : RESULTADO.linha(diferencaTexto(forma, dif), valor);
  }

  const novo = mercadoNovo(conta.market);
  const precisa = forma.modo === 'digitado';
  const podeC = novo && !precisa;
  const corrAb = podeC && x.corrigir;
  const temRes = precisa || corrAb;
  const swap = conta.market === 'forex' || conta.market === 'crypto' ? RESULTADO.swap : '';
  const M = conta.currency === 'BRL' ? 'R$' : 'US$';
  const erros: BlocoSaida['erros'] = {};
  let pnl: string | undefined;
  if (temRes) {
    const r = lerDinheiro(x.res, true);
    if (r.vazio) erros.res = ERROS_PRECOS.resVazio;
    else if (r.erro) erros.res = r.erro;
    else pnl = r.value as string;
  }
  let costs: string | undefined;
  if (novo) {
    const c = lerDinheiro(x.custos, false);
    if (c.erro) erros.custos = c.erro;
    else if (!c.vazio) costs = c.value as string;
  }
  const bloco: BlocoResultadoModelo = {
    linha,
    corrigir: podeC && (calc !== null || corrAb) ? { rotulo: corrAb ? RESULTADO.usarCalculado : RESULTADO.corrigir, aberto: corrAb } : null,
    calculado: calc === null ? null : formatDecimal(calc, { minDecimals: 2 }),
    notaEstimativa: forma.modo === 'estimativa' && !temRes ? RESULTADO.notaEstimativa : null,
    campo: temRes
      ? {
          rotulo: precisa ? RESULTADO.campoDigitado(M) : RESULTADO.campoCorrigido(M),
          nota: precisa ? RESULTADO.notaDigitado(moedaPal(conta.currency), swap) : RESULTADO.notaCorrigido(swap),
          valor: x.res,
          erro: x.tentou ? erros.res ?? null : null,
        }
      : null,
    custos: novo ? { rotulo: RESULTADO.custos(M), nota: RESULTADO.notaCustos[conta.market] ?? '', valor: x.custos, erro: erros.custos ?? null } : null,
  };
  return { bloco, erros, pnl, costs };
}

// ---------------------------------------------------------------------------------------------
// «Venceu sem valor» and the option block
// ---------------------------------------------------------------------------------------------

export interface EstadoVsv {
  /** The pill is on (premium 0 at 16:00 ET) */
  ligado: boolean;
  /**
   * Only when the expiry is the entry's day and that day's 16:00 ET has passed (board choice 21); on
   * step 2 also only while the exit hour still names that close (until about 04:00 ET the next day);
   * else aria-disabled
   */
  disponivel: boolean;
  /** «Escolha o vencimento primeiro.» / «Vence hoje às 16:00 ET.» / «Vence em 14 out, às 16:00 ET.» / (step 2, too late) «Venceu em 15 out, …»; '' when available */
  nota: string;
  /** 16:00 ET of the expiry on the account's clock («16:00»; «17:00» on Brasília in October): the exit hour it writes */
  hora: string | null;
}

/** 16:00 ET of a date */
const fimDoPregao = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return localToUtc({ year: y, month: m, day: d, hour: 16, minute: 0 }, 'America/New_York');
};

/**
 * Step 2's exit carries only an hour, and register_exit reads it against now (trade_hm_resolve: the
 * current minute is now; else today's, or yesterday's while today's is more than 12 hours ahead).
 * The pill's 16:00 ET names the expiry's close only from that close until about 04:00 ET the next
 * day; later it would land on a later day (or ahead of now).
 */
function horaAlcancaFim(conta: Pick<ContaReg, 'clock'>, fim: Date, now: Date): boolean {
  const hm = hora(conta, fim);
  const at = hm === hmOn(now, conta.clock) ? now : resolveLocalHm(hm, conta.clock, now);
  return Math.floor(at.getTime() / 60_000) === Math.floor(fim.getTime() / 60_000);
}

/**
 * «Venceu sem valor»: `porHora` is step 2, where the exit is sent as an hour only (register_exit),
 * so the pill is also limited to the times that hour still names the expiry's close («Já fechada»
 * sends the «Dia» with it).
 */
export function estadoVsv(
  conta: Pick<ContaReg, 'clock'>,
  vencimento: string | null,
  dia: string,
  hoje: string,
  ligado: boolean,
  now: Date,
  porHora = false,
): EstadoVsv {
  const fim = vencimento ? fimDoPregao(vencimento) : null;
  const depois = !!vencimento && vencimento === dia && !!fim && now.getTime() >= fim.getTime();
  const tarde = depois && porHora && !horaAlcancaFim(conta, fim as Date, now);
  const disponivel = depois && !tarde;
  const nota = disponivel
    ? ''
    : !vencimento
      ? VSV.escolhaVencimento
      : tarde
        ? VSV.tarde(formatDiaMes(vencimento))
        : vencimento === hoje
          ? VSV.venceHoje
          : VSV.venceEm(formatDiaMes(vencimento));
  return { ligado: ligado && disponivel, disponivel, nota, hora: fim ? hora(conta, fim) : null };
}

export interface ModeloOpcao {
  tipo: 'call' | 'put' | null;
  strike: string;
  vencimento: string | null;
  /** «Hoje» (or «14 out» when the «Dia» is another day) and «Sexta, 16 out» (none when the day is a Friday) */
  chips: { rotulo: string; valor: string }[];
  /** «Outra data»'s min: the day */
  min: string;
  /** The visible errors (after a «Registrar» tap) */
  erros: Partial<Record<'opTipo' | 'strike' | 'venc', string>>;
}

/** The option block's model and its checks (RO l.345–356, 1051–1053) */
function modeloOpcao(r: Rascunho, dia: string, hoje: string): { m: ModeloOpcao; erros: Partial<Record<'opTipo' | 'strike' | 'venc', string>>; contrato: OptionContract | null } {
  const erros: Partial<Record<'opTipo' | 'strike' | 'venc', string>> = {};
  if (!r.opTipo) erros.opTipo = ERROS_PRECOS.opTipo;
  let strike: string | null = null;
  const n = lerNumero(r.strike, { ponto: true });
  if (!n.ok) erros.strike = n.reason === 'empty' ? ERROS_PRECOS.strikeVazio : ERROS_PRECOS.strikeNumero;
  else if (cmp(numeric(n.value), fromInt(0)) <= 0) erros.strike = ERROS_PRECOS.strikeZero;
  else if (inteirosDe(n.value) > 10) erros.strike = ERROS_PRECOS.strikeNumero;
  else if (casasDe(n.value) > 3) erros.strike = ERROS_PRECOS.casas(3);
  else strike = n.value;
  const venc = r.vencimento && ISO_DATE.test(r.vencimento) ? r.vencimento : null;
  if (!venc) erros.venc = ERROS_PRECOS.vencVazio;
  else if (venc < dia) erros.venc = ERROS_PRECOS.vencAntes;
  const w = isoWeekdayOf(dia);
  const ate = (5 - w + 7) % 7;
  const chips = [{ rotulo: dia === hoje ? OPCAO.hoje : formatDiaMes(dia), valor: dia }];
  if (ate !== 0) {
    const sexta = addDays(dia, ate);
    chips.push({ rotulo: OPCAO.sexta(formatDiaMes(sexta)), valor: sexta });
  }
  const contrato = r.opTipo && strike && venc && !erros.venc ? { right: r.opTipo, strike, expires_on: venc } : null;
  return { m: { tipo: r.opTipo, strike: r.strike, vencimento: r.vencimento, chips, min: dia, erros: {} }, erros, contrato };
}

// ---------------------------------------------------------------------------------------------
// Step 1: checks, payloads and lines
// ---------------------------------------------------------------------------------------------

export type CampoEntrada =
  | 'dia'
  | 'lado'
  | 'q'
  | 'preco'
  | 'hora'
  | 'spreco'
  | 'shora'
  | 'stop'
  | 'alvo'
  | 'par'
  | 'dir'
  | 'exp'
  | 'stake'
  | 'payout'
  | 'fimB'
  | 'opTipo'
  | 'strike'
  | 'venc'
  | 'res'
  | 'custos'
  // 3c («Já fechada» in several exits): a row's quantity, price, hour and typed result
  // (`s{id}q` … `s{id}r`), the rows' sum, «Preço quando moveu»
  | CampoSaida
  | 'soma'
  | 'bePreco';

/** 3c: a field of one «Já fechada» row (its id, then q · p · h · r): `s2q` → `f-s2q` */
export type CampoSaida = `s${number}${'q' | 'p' | 'h' | 'r'}`;

/**
 * The board's order for every price market (RO l.1064; 3c js l.1278): where the focus goes on
 * «Registrar». The rows' fields (`s{id}q`, `s{id}p`, `s{id}h`, `s{id}r`, row by row) go right
 * before 'soma' (registrarSaidas.ordemComSaidas); 'soma' and 'bePreco' are set only there.
 */
export const ORDEM_PRECOS: readonly CampoEntrada[] = ['dia', 'opTipo', 'strike', 'venc', 'lado', 'q', 'preco', 'hora', 'spreco', 'shora', 'soma', 'stop', 'alvo', 'bePreco', 'res', 'custos'];
/** 3-3's name for the price markets' order (futures never have the option, result or costs errors) */
export const ORDEM_FUTUROS: readonly CampoEntrada[] = ORDEM_PRECOS;
export const ORDEM_EBINEX: readonly CampoEntrada[] = ['dia', 'par', 'dir', 'exp', 'stake', 'payout', 'hora', 'fimB'];

/** Shown before a «Registrar» tap: the day, the stop, the target and the costs (RO `campo(…, true)`) */
const SEMPRE_VISIVEIS: readonly CampoEntrada[] = ['dia', 'stop', 'alvo', 'custos'];

/** The instrument block of a price market (3-4) */
export interface ModeloAtivo {
  /** «Ativo» · «Par» · «Moeda» · «Ativo-objeto» */
  rotulo: string;
  /** The chips (chipsDoAtivo, with the instrument in use appended) and which one is chosen */
  chips: { rotulo: string; valor: string; selecionado: boolean }[];
  busca: {
    rotulo: string;
    placeholder: string;
    valor: string;
    resultados: string[];
    /** «Usar “XAUUSD”»; null when the catalog answers or the text cannot be a symbol */
    usar: string | null;
    /** sr-only: «3 resultados.» / «Nenhum ativo do catálogo com esse código.» */
    status: string;
  };
}

export interface ModeloQuantidade {
  rotulo: string;
  /** null = a field only («Ações», «Quantidade, em BTC», «Quantidade») */
  chips: { rotulo: string; valor: string; selecionado: boolean }[] | null;
  /** The field is in use («Outro», or a kind without chips) */
  outro: boolean;
  outroRotulo: string | null;
  valor: string;
  /** B3 catalog stock outside the lot of 100: «Fora do lote de 100, …» (a note, never an error) */
  nota: string | null;
}

export interface ModeloEntrada {
  /** Every refusal the form knows now, by field */
  erros: Partial<Record<CampoEntrada, string>>;
  /** The ones on screen (after a «Registrar» tap, or the always-visible ones) */
  visiveis: Partial<Record<CampoEntrada, string>>;
  /** The first refused field in the board's order */
  primeiro: CampoEntrada | null;
  hoje: string;
  /** The trading day of the form (today, or the «Dia» chosen) */
  dia: string;
  /** The «Dia» is refused (after today, before «desde»): no gate, limit or plan (board choice 11) */
  diaRecusado: boolean;
  /** What the hour fields show */
  horaCampo: string;
  horaSaidaCampo: string;
  /** What the exit price field shows («0» while «Venceu sem valor» is on and nothing was typed) */
  precoSaidaCampo: string;
  /** The entry is now (the hour on the current minute, «Aberta» today) */
  agora: boolean;
  /** The entry instant the hour names (also when refused: the gate line still answers for it); null when unknown */
  entradaEm: Date | null;
  /** The entry is in the current minute: rules_now answers the gate line, no gate_at */
  noMinutoAtual: boolean;
  /** Binary: when it expires (the next candle on Ebinex) */
  expiraEm: Date | null;
  vencido: boolean;
  /** The result is known while registering («Já fechada», or a binary already expired) */
  jaFoi: boolean;
  /** «Aberta»: register_entry's payload, null until the form is complete */
  payload: EntryPayload | null;
  /**
   * «Aberta»: the payload of its dry run. On the current minute it names that minute (`entry`), which
   * register_entry reads as now(), as when it is left out: the dry run's key changes as the clock
   * passes a minute, so the plan, the limit's room and `similar` are asked again (at 11:00 the window
   * of 10:00–11:00 is over). The registration itself leaves it out: the server's clock (C5).
   */
  payloadPrevia: EntryPayload | null;
  /** «Já fechada»: register_after's payload */
  payloadFechada: AfterPayload | null;
  /** What the entry risks (the loss at the stop, a binary's stake), decimal text; null when unknown */
  risco: string | null;
  /** «risco US$ 110,00 · alvo US$ 220,00 · 1 : 2» */
  linhaRisco: string;
  /** «Se acertar: +US$ 17,60 · se errar: −US$ 20,00» */
  linhaBinaria: string;
  /** «Já fechada»: «Resultado: +9,50 pts · +US$ 95,00» */
  linhaResultado: string;
  /** «Vence às 20:12 de Brasília.» / «Venceu às …» */
  venceTxt: string | null;
  /** The side and the symbol, for «Compra de MES às 10:12» */
  descricao: { lado: string; ativo: string } | null;
  // 3-4: every price market (null on binaries)
  /** What the instrument's form looks like (registrarAtivos.formaDoAtivo); null without an instrument */
  forma: FormaAtivo | null;
  ativo: ModeloAtivo | null;
  /** «O que você operou?» (stocks accounts only) */
  tipoEua: { valor: TipoEua; opcoes: { rotulo: string; valor: TipoEua }[] } | null;
  /** «Cotada em» (crypto only); `valor` null when the pair names a quote none of the pills (ETH/BTC) */
  cotacao: { valor: Cotacao | null; opcoes: readonly Cotacao[]; nota: string } | null;
  /** The option block (an option only) */
  opcao: ModeloOpcao | null;
  quantidade: ModeloQuantidade | null;
  rotulos: { preco: string; precoSaida: string; hora: string; horaSaida: string; stopAlvo: string } | null;
  /** «Posição de US$ 28.100» (crypto, quantity and price above zero) */
  linhaPosicao: string | null;
  /** «Venceu sem valor» («Já fechada» of an option) */
  vsv: EstadoVsv | null;
  /** «Já fechada» of a price market: the result block */
  resultado: BlocoResultadoModelo | null;
  // 3c (read by registrarSaidas.comSaidas and the step-1 rule line; null on binaries)
  /** What the entry fields read without an error (decimal text; `hm` the entry's "HH:MM") */
  lidos: { qtd: string | null; preco: string | null; stop: string | null; hm: string | null } | null;
  /**
   * «Já fechada» of a price market: what payloadFechada was built from (afterPayload's fields),
   * when the form is complete. With rows (r.saidas), the entry part alone, as soon as it is
   * complete: comSaidas adds the rows, the corrected total, «Custos» and «Preço quando moveu».
   */
  afterInput: AfterFields | null;
}

export interface EntradaInput {
  conta: ContaReg;
  r: Rascunho;
  /** The server's clock */
  now: Date;
  /** The account's trading day now (diaDeHoje) */
  hoje: string;
  /** «Registrar» was tapped: every field error shows */
  tentou: boolean;
  /** 3-4: the account's starting values (the instrument chips); absent → the board's examples */
  padroes?: RegistrarDefaults | null;
}

/** The symbol the form registers (futures root, Ebinex pair as sent; 3-4: any market's, crypto with its quote) */
export function simboloDe(r: Rascunho, market: MercadoReg): string {
  if (market === 'futures') return r.ativo ?? '';
  if (market === 'binary') return r.parOutro ? r.parTexto.trim().toUpperCase() : r.par ?? '';
  return r.ativo ? simboloRegistrado(market, r.ativo, r.cotacao) : '';
}

/** Whether the form registers an option (an `options` account, or «Opção» on Ações e opções) */
export const ehOpcao = (market: AccountMarket, r: Pick<Rascunho, 'tipoEua'>) => market === 'options' || (market === 'stocks' && r.tipoEua === 'opcao');

const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9./:() _-]*$/;

/** The before-«desde» text (RO l.1022–1023): futures and binary the file, the new markets the column import */
const textoAntesRegras = (market: AccountMarket, desde: string) => (mercadoNovo(market) ? ERROS_PRECOS.antesRegras(desde) : ERROS.antesRegras(desde));

/** Step 1 as it stands: errors, instants, payloads, lines */
export function modeloEntrada({ conta, r, now, hoje, tentou, padroes }: EntradaInput): ModeloEntrada {
  const bin = conta.market === 'binary';
  const fechada = r.modo === 'fechada';
  const erros: Partial<Record<CampoEntrada, string>> = {};
  const atual = hmOn(now, conta.clock);
  const horaCampo = r.hora ?? atual;
  const agoraTxt = horaRel(conta, now);

  // «Dia»
  const dia = fechada ? r.dia ?? hoje : hoje;
  if (fechada) {
    if (dia > hoje) erros.dia = ERROS.diaFuturo;
    else if (conta.desdeDay && dia < conta.desdeDay) erros.dia = textoAntesRegras(conta.market, formatDiaMes(conta.desdeDay));
  }
  const diaRecusado = !!erros.dia;

  // The entry instant
  const hm = parseHhMm(horaCampo) === null ? null : formatHhMm(parseHhMm(horaCampo) as number);
  let entradaEm: Date | null = null;
  let noMinutoAtual = false;
  if (hm !== null) {
    if (!fechada) {
      noMinutoAtual = hm === atual;
      entradaEm = noMinutoAtual ? now : resolveLocalHm(hm, conta.clock, now);
      const e = entryInstant(hm, conta.clock, now);
      if (!e.ok) erros.hora = e.code === 'entry_in_future' ? ERROS.entradaFutura(agoraTxt) : ERROS.entradaAntiga;
    } else if (!diaRecusado) {
      entradaEm = localHmInTradingDay(dia, hm, conta.clock, (i) => diaDe(conta, i));
      if (!entradaEm) erros.hora = ERROS.foraDoDia;
      else if (entradaEm.getTime() > now.getTime()) erros.hora = ERROS.entradaFutura(agoraTxt);
      noMinutoAtual = !!entradaEm && Math.floor(entradaEm.getTime() / 60000) === Math.floor(now.getTime() / 60000);
    }
  } else erros.hora = ERROS.hora;

  const marks = marcasDoRascunho(r);
  const entry = fechada || hm === null || noMinutoAtual ? undefined : hm;
  const entryPrevia = fechada || hm === null ? undefined : hm;

  const out: ModeloEntrada = {
    erros,
    visiveis: {},
    primeiro: null,
    hoje,
    dia,
    diaRecusado,
    horaCampo,
    horaSaidaCampo: r.horaSaida ?? atual,
    precoSaidaCampo: r.precoSaida,
    agora: !fechada && (r.hora === null || noMinutoAtual),
    entradaEm,
    noMinutoAtual,
    expiraEm: null,
    vencido: false,
    jaFoi: fechada,
    payload: null,
    payloadPrevia: null,
    payloadFechada: null,
    risco: null,
    linhaRisco: '',
    linhaBinaria: '',
    linhaResultado: '',
    venceTxt: null,
    descricao: null,
    forma: null,
    ativo: null,
    tipoEua: null,
    cotacao: null,
    opcao: null,
    quantidade: null,
    rotulos: null,
    linhaPosicao: null,
    vsv: null,
    resultado: null,
    lidos: null,
    afterInput: null,
  };

  if (bin) entradaBinaria(out, { conta, r, now, fechada, hm, entry, entryPrevia, marks });
  else entradaPrecos(out, { conta, r, now, hoje, tentou, fechada, hm, entry, entryPrevia, marks, padroes: padroes ?? null });

  const ordem = bin ? ORDEM_EBINEX : ORDEM_PRECOS;
  out.primeiro = ordem.find((k) => erros[k]) ?? null;
  for (const k of ordem) if (erros[k] && (tentou || SEMPRE_VISIVEIS.includes(k))) out.visiveis[k] = erros[k];
  if (out.opcao && tentou) {
    for (const k of ['opTipo', 'strike', 'venc'] as const) if (erros[k]) out.opcao.erros[k] = erros[k];
  }
  out.venceTxt = out.expiraEm ? (out.vencido ? EBINEX.venceu : EBINEX.vence)(horaRel(conta, out.expiraEm)) : null;
  out.jaFoi = fechada || out.vencido;
  return out;
}

interface Contexto {
  conta: ContaReg;
  r: Rascunho;
  now: Date;
  fechada: boolean;
  hm: string | null;
  entry: string | undefined;
  entryPrevia: string | undefined;
  marks: Marks | undefined;
}

/** Ebinex (3-3, unchanged) */
function entradaBinaria(out: ModeloEntrada, { conta, r, now, fechada, hm, entry, entryPrevia, marks }: Contexto): void {
  const erros = out.erros;
  const symbol = simboloDe(r, 'binary');
  if (r.parOutro) {
    if (!symbol) erros.par = ERROS.parVazio;
    else if (!SYMBOL_RE.test(symbol) || symbol.length > 40) erros.par = ERROS.parInvalido;
  } else if (!symbol) erros.par = ERROS.parVazio;
  if (!r.direcao) erros.dir = ERROS.direcao;
  if (!r.duracao) erros.exp = ERROS.expiracao;
  const stake = positivo(r.stake);
  if (!stake.ok) erros.stake = stake.reason === 'empty' ? ERROS.stakeVazio : ERROS.stakeZero;
  else if (!/^[0-9]{1,16}(\.[0-9]{1,2})?$/.test(stake.value)) erros.stake = ERROS.stakeZero;
  const payoutN = lerNumero(r.payout);
  let payout: string | null = null;
  if (!payoutN.ok) erros.payout = payoutN.reason === 'empty' ? ERROS.payoutVazio : ERROS.payoutFaixa;
  else {
    const v = numeric(payoutN.value);
    if (cmp(v, fromInt(1)) < 0 || cmp(v, fromInt(100)) > 0 || !/^[0-9]{1,3}(\.[0-9]{1,2})?$/.test(payoutN.value)) erros.payout = ERROS.payoutFaixa;
    else payout = payoutN.value;
  }
  if (stake.ok && payout && !erros.stake) {
    const ifWin = numericText(round(div(mul(numeric(stake.value), numeric(payout)), fromInt(100)), 2));
    out.linhaBinaria = EBINEX.linha(dinheiro(ifWin, conta.currency), dinheiro(`-${stake.value}`, conta.currency));
  } else out.linhaBinaria = EBINEX.preencha;
  out.risco = stake.ok && !erros.stake ? stake.value : null;

  // The expiry: the next candle of the chosen time, from the entry (D35, v55)
  if (r.duracao && out.entradaEm) {
    out.expiraEm = binaryExpiry(conta.platform, out.entradaEm, r.duracao);
    out.vencido = now.getTime() >= out.expiraEm.getTime();
  }
  if (fechada) {
    if (r.duracao && out.entradaEm && !out.vencido) erros.fimB = ERROS.naoVenceu;
    else if (!r.resultado) erros.fimB = ERROS.comoTerminou;
    if (r.resultado && out.vencido && stake.ok && payout) {
      const pnl =
        r.resultado === 'ganho'
          ? numericText(round(div(mul(numeric(stake.value), numeric(payout)), fromInt(100)), 2))
          : r.resultado === 'perda'
            ? `-${stake.value}`
            : '0';
      out.linhaResultado = EBINEX.resultado(dinheiro(pnl, conta.currency));
    } else out.linhaResultado = EBINEX.resultadoEscolha;
  }
  if (r.direcao && symbol) out.descricao = { lado: r.direcao === 'call' ? EBINEX.alta : EBINEX.baixa, ativo: symbol };

  const base = {
    clientKey: r.clientKey,
    symbol,
    direction: (r.direcao ?? 'call') as Direction,
    stake: stake.ok ? stake.value : undefined,
    payout: payout ?? undefined,
    durationS: r.duracao ?? undefined,
    clock: conta.clock,
    marks,
  };
  const completo = !erros.par && !erros.dir && !erros.exp && !erros.stake && !erros.payout && !erros.hora;
  if (!fechada && completo) {
    out.payload = entryPayload('binary', { ...base, entry });
    out.payloadPrevia = entryPayload('binary', { ...base, entry: entryPrevia });
  }
  if (fechada && completo && !erros.dia && !erros.fimB && hm !== null && r.resultado) {
    out.payloadFechada = afterPayload('binary', { ...base, day: out.dia, entry: hm, outcome: r.resultado });
  }
}

/** The distance of a stop or target in price units (pts: itself; pips: × pip; a price: |entry − level|) */
function distancia(forma: FormaAtivo, valor: string | null, entrada: string | null): string | null {
  if (!valor) return null;
  if (forma.unidadeStop === 'pts') return valor;
  if (forma.unidadeStop === 'pips') return forma.spec.pip ? numericText(mul(numeric(valor), numeric(forma.spec.pip))) : null;
  return entrada ? numericText(abs(sub(numeric(entrada), numeric(valor)))) : null;
}

/**
 * The risk line (RO l.1092–1115; amounts from the domain, as the server's preview computes them: an
 * estimate divides by the stop's price) and the risk itself
 */
function linhaRiscoPrecos(
  forma: FormaAtivo,
  conta: Pick<ContaReg, 'currency'>,
  x: { qtd: string | null; entrada: string | null; lado: 'long' | 'short' | null; stop: string | null; alvo: string | null; temNivel: boolean },
): { linha: string; risco: string | null } {
  const partes: string[] = [];
  const opcao = forma.tipo === 'opcao';
  if (opcao && x.qtd && /^[0-9]+$/.test(x.qtd)) {
    partes.push(RISCO.opcoes(formatDecimal(x.qtd), x.qtd === '1', formatDecimal(numericText(mul(numeric(x.qtd), fromInt(100))))));
  }
  const ds = distancia(forma, x.stop, x.entrada);
  const da = distancia(forma, x.alvo, x.entrada);
  const est = forma.modo === 'estimativa';
  const sgn: 1 | -1 = x.lado === 'short' ? -1 : 1;
  /** The money at a level, as an exit there would compute it */
  const dinheiroEm = (valor: string, side: 'stop' | 'target'): string | null => {
    if (!x.qtd || forma.spec.mult === null) return null;
    if (forma.modo === 'exato') {
      const dist = distancia(forma, valor, x.entrada);
      return dist ? numericText(round(mul(mul(numeric(dist), numeric(forma.spec.mult)), numeric(x.qtd)), 2)) : null;
    }
    if (forma.modo === 'estimativa' && x.entrada && x.lado) {
      const lv = stopLevel(forma.spec, sgn, x.entrada, side, valor);
      if (!lv.ok) return null;
      const v = pnlFromPrices(forma.spec, sgn, x.qtd, x.entrada, lv.level);
      return v === null ? null : numericText(abs(numeric(v)));
    }
    return null;
  };
  const risco = x.stop && ds ? dinheiroEm(x.stop, 'stop') : null;
  const ganho = x.alvo && da ? dinheiroEm(x.alvo, 'target') : null;
  const comValor = forma.modo === 'exato' ? !!x.qtd : forma.modo === 'estimativa' && !!x.qtd && !!x.entrada && !!x.lado;
  const pre = est ? RISCO.estimativa : '';
  if (comValor) {
    if (risco) partes.push(RISCO.risco(`${pre}${dinheiroSem(risco, conta.currency)}`));
    if (ganho) partes.push(RISCO.alvo(`${pre}${dinheiroSem(ganho, conta.currency)}`));
  } else if (forma.unidadeStop === 'pips') {
    if (ds && x.stop) partes.push(RISCO.riscoPips(curtoDec(x.stop)));
    if (da && x.alvo) partes.push(RISCO.alvoPips(curtoDec(x.alvo)));
  }
  if (ds && da) partes.push(FUTUROS.razao(curto(Number(da) / Number(ds))));
  if (forma.modo === 'digitado' && forma.unidadeStop !== 'pips' && (ds || da)) {
    if (!(ds && da)) return { linha: RISCO.semValor(moedaPal(conta.currency)), risco: null };
    partes.push(RISCO.semValorParte(moedaPal(conta.currency)));
  }
  if (!partes.length || (opcao && partes.length === 1 && !x.temNivel)) {
    if (x.temNivel && (forma.unidadeStop === 'preco' || forma.unidadeStop === 'premio') && !x.entrada) {
      return { linha: [...partes, RISCO.semPreco].join(' · '), risco: null };
    }
    if (opcao && partes.length === 1) return { linha: partes[0], risco };
    return { linha: FUTUROS.semStop, risco };
  }
  return { linha: partes.join(' · '), risco };
}

/** «Ativo» / «Par» / «Moeda» / «Ativo-objeto» and the search's words, per market */
function palavrasDoAtivo(market: AccountMarket, opcao: boolean): { rotulo: string; busca: string; placeholder: string } {
  if (market === 'forex') return { rotulo: ATIVO.rotulo.par, busca: ATIVO.busca.par, placeholder: ATIVO.placeholder.forex };
  if (market === 'crypto') return { rotulo: ATIVO.rotulo.moeda, busca: ATIVO.busca.moeda, placeholder: ATIVO.placeholder.crypto };
  if (opcao) return { rotulo: ATIVO.rotulo.objeto, busca: ATIVO.busca.ativo, placeholder: ATIVO.placeholder.opcao };
  if (market === 'stocks') return { rotulo: ATIVO.rotulo.ativo, busca: ATIVO.busca.ativo, placeholder: ATIVO.placeholder.acao };
  if (market === 'b3') return { rotulo: ATIVO.rotulo.ativo, busca: ATIVO.busca.ativo, placeholder: ATIVO.placeholder.b3 };
  return { rotulo: ATIVO.rotulo.ativo, busca: ATIVO.busca.ativo, placeholder: ATIVO.placeholder.futures };
}

/** The price labels (RO l.1128, 1267): «Preço de entrada» / «Prêmio de entrada, US$ por ação» / «Preço de entrada, USDT» */
function rotulosDePreco(forma: FormaAtivo | null, conta: Pick<ContaReg, 'clock'>, fechada: boolean): NonNullable<ModeloEntrada['rotulos']> {
  const opcao = forma?.tipo === 'opcao';
  const cot = forma?.tipo === 'cri' ? forma.moedaCotacao ?? 'USDT' : null;
  return {
    preco: opcao ? PRECOS.premioEntrada : cot ? PRECOS.precoEntradaEm(cot) : PRECOS.precoEntrada,
    precoSaida: opcao ? PRECOS.premioSaida : cot ? PRECOS.precoSaidaEm(cot) : PRECOS.precoSaida,
    hora: fechada ? FUTUROS.horaEntrada(sufixoCampo(conta)) : FUTUROS.hora(sufixoCampo(conta)),
    horaSaida: FUTUROS.horaSaida(sufixoCampo(conta)),
    stopAlvo: forma ? PRECOS.stopAlvo[forma.unidadeStop] : PRECOS.stopAlvo.pts,
  };
}

/** Every price market: futures (3-3's behaviour on its six chips), forex, ações e opções, cripto, B3 */
function entradaPrecos(out: ModeloEntrada, x: Contexto & { hoje: string; tentou: boolean; padroes: RegistrarDefaults | null }): void {
  const { conta, r, now, hoje, tentou, fechada, hm, entry, entryPrevia, marks, padroes } = x;
  const erros = out.erros;
  const market = conta.market;
  const opcao = ehOpcao(market, r);
  const forma = r.ativo ? formaDoAtivo(market, r.ativo, { opcao, cotacao: r.cotacao }) : null;
  out.forma = forma;

  // The instrument block, «O que você operou?», «Cotada em» (the futures chips stay 3-3's)
  const palavras = palavrasDoAtivo(market, opcao);
  const chips = chipsDoAtivo(market, padroes, { opcao, atual: r.ativo });
  const busca = buscarAtivos(market, r.busca, { opcao });
  out.ativo = {
    rotulo: palavras.rotulo,
    chips: chips.map((c) => ({ rotulo: c, valor: c, selecionado: c === (r.ativo ?? '').toUpperCase() })),
    busca: { rotulo: palavras.busca, placeholder: palavras.placeholder, valor: r.busca, resultados: busca.resultados, usar: busca.usar, status: statusBusca(r.busca, busca.resultados) },
  };
  if (market === 'stocks') {
    out.tipoEua = { valor: r.tipoEua, opcoes: [{ rotulo: TIPO_EUA.acao, valor: 'acao' }, { rotulo: TIPO_EUA.opcao, valor: 'opcao' }] };
  }
  if (market === 'crypto') out.cotacao = { valor: forma ? forma.cotacao : r.cotacao, opcoes: COTACOES, nota: COTADA.nota };
  out.rotulos = rotulosDePreco(forma, conta, fechada);

  // The option block
  let contrato: OptionContract | null = null;
  if (opcao) {
    const o = modeloOpcao(r, out.dia, hoje);
    out.opcao = o.m;
    Object.assign(erros, o.erros);
    contrato = o.contrato;
  }

  if (!r.lado) erros.lado = ERROS.lado;
  if (!forma) {
    out.linhaRisco = FUTUROS.semStop;
    if (fechada) out.linhaResultado = r.lado ? RESULTADO.preenchaPrecos : RESULTADO.escolhaLado;
    return;
  }

  // Quantity
  const q = lerQuantidade(forma, r);
  if (q.erro) erros.q = q.erro;
  const qtd = q.value;
  const fq = forma.quantidade;
  const notaLote =
    fq.lote100 && qtd && /^[0-9]+$/.test(qtd) && BigInt(qtd) % BigInt(100) !== BigInt(0) ? QTD.loteB3 : null;
  out.quantidade = {
    rotulo: fq.rotulo,
    chips: fq.chips ? fq.chips.map((c) => ({ rotulo: fq.tipo === 'lotes' ? formatDecimal(c, { minDecimals: 2 }) : c, valor: c, selecionado: !r.qtdOutro && r.qtd === c })) : null,
    outro: !fq.chips || r.qtdOutro,
    outroRotulo: fq.outroRotulo,
    valor: !fq.chips || r.qtdOutro ? r.qtd : '',
    nota: notaLote,
  };

  // Prices
  const entrada = lerPrecoDe(forma, r.preco, 'entrada');
  if (entrada.erro) erros.preco = entrada.erro;

  // «Já fechada»: the exit, «Venceu sem valor». 3c: with rows («+ Outra saída»), the single exit's
  // fields are not on screen: registrarSaidas.comSaidas checks the rows instead
  const linhas = fechada && !!r.saidas;
  let saida: Lido = { value: null };
  if (fechada) {
    if (opcao) out.vsv = estadoVsv(conta, r.vencimento, out.dia, hoje, r.vsv, now);
    const vsvLigado = !!out.vsv?.ligado;
    out.precoSaidaCampo = r.precoSaida !== '' ? r.precoSaida : vsvLigado ? '0' : '';
    out.horaSaidaCampo = r.horaSaida ?? (vsvLigado && out.vsv?.hora ? out.vsv.hora : hmOn(now, conta.clock));
  }
  if (fechada && !linhas) {
    saida = lerPrecoDe(forma, out.precoSaidaCampo, 'saída', opcao);
    if (saida.erro) erros.spreco = saida.erro;
    const shm = parseHhMm(out.horaSaidaCampo) === null ? null : formatHhMm(parseHhMm(out.horaSaidaCampo) as number);
    if (shm === null) erros.shora = ERROS.hora;
    else if (hm !== null && (parseHhMm(shm) as number) < (parseHhMm(hm) as number)) erros.shora = ERROS.saidaAntes(hm);
    else if (out.entradaEm) {
      const saidaEm = firstLocalHmAtOrAfter(out.entradaEm, shm, conta.clock);
      if (saidaEm.getTime() > now.getTime()) erros.shora = ERROS.saidaFutura(horaRel(conta, now));
    }
  }

  // Stop and target, in the instrument's unit
  const ladoOk = r.lado;
  const stop = lerNivel(forma, r.stop, 'stop', ladoOk, entrada.value);
  const alvo = lerNivel(forma, r.alvo, 'target', ladoOk, entrada.value);
  if (stop.erro) erros.stop = stop.erro;
  if (alvo.erro) erros.alvo = alvo.erro;

  // The risk line and the position
  const temNivel = (!!stop.value && !stop.erro) || (!!alvo.value && !alvo.erro);
  const rl = linhaRiscoPrecos(forma, conta, { qtd, entrada: entrada.value, lado: r.lado, stop: stop.value, alvo: alvo.value, temNivel });
  out.linhaRisco = rl.linha;
  out.risco = rl.risco;
  // In dollars or reais only: ETH/BTC's position would be in bitcoin (no line, N)
  if (forma.tipo === 'cri' && forma.cotacao && qtd && entrada.value) {
    const total = numericText(mul(numeric(qtd), numeric(entrada.value)));
    out.linhaPosicao = PRECOS.posicao(compacto(total, forma.cotacao === 'R$' ? 'BRL' : 'USD'));
  }

  // «Já fechada»: the result block (with rows: comSaidas's, on the rows)
  let pnl: string | undefined;
  let costs: string | undefined;
  if (fechada && !linhas) {
    const b = blocoResultado({
      conta,
      forma,
      aberta: false,
      lado: r.lado,
      entradaTexto: r.preco,
      entradaDecimal: false,
      saidaTexto: out.precoSaidaCampo,
      qtd,
      tentou,
      corrigir: r.corrigir,
      res: r.res,
      custos: r.custos,
    });
    out.resultado = b.bloco;
    out.linhaResultado = b.bloco.linha;
    if (b.erros.res) erros.res = b.erros.res;
    if (b.erros.custos) erros.custos = b.erros.custos;
    pnl = b.pnl;
    costs = b.costs;
  }
  if (r.lado && forma) out.descricao = { lado: r.lado === 'long' ? FUTUROS.compra : FUTUROS.venda, ativo: ativoCurtoDe(forma, contrato) };

  // Payloads: only a complete form (the dry run refuses anything else)
  const base = {
    clientKey: r.clientKey,
    symbol: forma.simbolo,
    direction: (r.lado ?? 'long') as Direction,
    quantity: qtd ?? undefined,
    entryPrice: entrada.value ?? undefined,
    stop: stop.value ?? undefined,
    target: alvo.value ?? undefined,
    option: contrato ?? undefined,
    clock: conta.clock,
    marks,
  };
  const completo =
    !erros.lado && !erros.q && !erros.preco && !erros.hora && !erros.stop && !erros.alvo && !erros.opTipo && !erros.strike && !erros.venc;
  if (!fechada && completo) {
    out.payload = entryPayload(market, { ...base, entry });
    out.payloadPrevia = entryPayload(market, { ...base, entry: entryPrevia });
  }
  out.lidos = {
    qtd,
    preco: entrada.value,
    stop: stop.value && !stop.erro ? stop.value : null,
    hm,
  };
  if (fechada && linhas && completo && !erros.dia && hm !== null) {
    out.afterInput = { ...base, day: out.dia, entry: hm };
  }
  if (fechada && !linhas && completo && !erros.dia && !erros.spreco && !erros.shora && !erros.res && !erros.custos && hm !== null) {
    out.afterInput = { ...base, day: out.dia, entry: hm, exit: out.horaSaidaCampo, exitPrice: saida.value ?? undefined, pnl, costs };
    out.payloadFechada = afterPayload(market, out.afterInput);
  }
}

/** The held taps as the entry's `marks` (only values; nothing when none) */
export function marcasDoRascunho(r: Rascunho): Marks | undefined {
  const out: Record<string, string> = {};
  for (const k of MARCA_KINDS) if (r.marcas[k]) out[k] = r.marcas[k] as string;
  return Object.keys(out).length ? (out as Marks) : undefined;
}

/** D30: «Compra de MES às 10:12» */
export function descricaoSimilar(m: ModeloEntrada, conta: ContaReg): string | null {
  if (!m.descricao || !m.entradaEm) return null;
  return SIMILAR.desc(m.descricao.lado, m.descricao.ativo, hora(conta, m.entradaEm));
}

/** Which question the gate line asks (RO l.1141) */
export function perguntaGate(m: Pick<ModeloEntrada, 'agora' | 'dia' | 'hoje'>, modo: Modo): string {
  if (modo === 'aberta' && m.agora) return GATE.pergunta;
  return m.dia === m.hoje ? GATE.naEntrada : GATE.naEntradaEm(formatDiaMes(m.dia));
}

// ---------------------------------------------------------------------------------------------
// The gate line, the limit line, the plan line
// ---------------------------------------------------------------------------------------------

export interface LinhaGate {
  palavra: string;
  /** What follows the word: «até 11:00 ET», «· 10:00–11:00 ET», «· limite de …»; '' when nothing */
  sub: string;
  tom: Tom;
  acao: { texto: string; href: string; aria: string } | null;
}

/** «10:00–11:00 ET» / «20:00–21:00 de Brasília» (two windows: «10:00–11:00 e 14:00–15:00 ET») */
export function faixaJanelas(windows: readonly TradingWindow[]): string {
  if (windows.length === 0) return '';
  const faixas = windows.map((w) => `${formatHhMm(w.startMin)}–${formatHhMm(w.endMin)}`).join(' e ');
  return `${faixas}${sufixoRelogio(windows[0].tz)}`;
}

/**
 * The words of «Posso operar hoje?» on the sheet, with the board's subs (RO l.1096–1103):
 * «Liberado» + «até 11:00 ET» (the current minute only), «Fora da sua janela» + «· 10:00–11:00 ET»
 * / «· hoje não é dia da janela» / «· não é dia da janela» (another day), «Encerrado por hoje» +
 * «· limite de US$ 400 atingido às 10:40 (pior momento −US$ 505)», «Sem janela salva» + «Definir».
 */
export function linhaGate(conta: Pick<ContaReg, 'label' | 'currency'>, gate: GateResult, rules: Rules | null, o: { presente: boolean; outroDia: boolean }): LinhaGate {
  const a = answerOf(gate);
  const dtz = rules?.day.tz ?? rules?.windows[0]?.tz ?? 'America/New_York';
  const base = { acao: null };
  switch (a.kind) {
    case 'encerrado': {
      const limite = dinheiroCompacto(a.limitCents, conta.currency);
      const pior = compactoNeg(a.worstCents, conta.currency);
      const sub = a.hitAt
        ? GATE.encerradoSub(limite, horaNoRelogio(a.hitAt, dtz), pior)
        : `· limite de ${limite} atingido (pior momento ${pior})`;
      return { ...base, palavra: GATE.encerrado, sub, tom: 'red' };
    }
    case 'fora_janela':
      return {
        ...base,
        palavra: GATE.fora,
        sub: a.position === 'nao_e_dia' ? (o.outroDia ? GATE.naoEDia : GATE.hojeNaoEDia) : GATE.foraFaixa(faixaJanelas(rules?.windows ?? [])),
        tom: 'amber',
      };
    case 'liberado': {
      const avisos: string[] = [];
      if (a.warnings.includes('fora_janela')) avisos.push(a.position === 'nao_e_dia' ? GATE.avisoNaoEDia : GATE.avisoFora);
      if (a.warnings.includes('limite')) avisos.push(GATE.avisoLimite);
      if (avisos.length) return { ...base, palavra: GATE.liberado, sub: avisos.join(' '), tom: 'neutral' };
      const wtz = rules?.windows[0]?.tz ?? dtz;
      return { ...base, palavra: GATE.liberado, sub: o.presente && a.until ? GATE.ate(`${horaNoRelogio(a.until, wtz)}${sufixoRelogio(wtz)}`) : '', tom: 'mint' };
    }
    case 'sem_janela':
      return a.reason === 'regra_desligada'
        ? { palavra: GATE.semRegra, sub: '', tom: 'muted', acao: { texto: GATE.ajustar, href: GATE.ajustarHref, aria: GATE.ajustarAria(conta.label) } }
        : { palavra: GATE.semJanela, sub: '', tom: 'muted', acao: { texto: GATE.definir, href: GATE.definirHref, aria: GATE.definirAria(conta.label) } };
    case 'indisponivel':
      return { ...base, palavra: GATE.indisponivel, sub: '', tom: 'muted' };
    case 'aguardar':
    default:
      // A data block is Phase 5: never answered in 3-3
      return { ...base, palavra: GATE.liberado, sub: '', tom: 'neutral' };
  }
}

/** «Limite do dia US$ 245 de US$ 400» at the entry (board choice 9); null on an account without a limit */
export function linhaLimite(conta: Pick<ContaReg, 'currency'>, gate: GateResult, rules: Rules | null): { usado: string; de: string } | null {
  if (!rules?.limit) return null;
  const de = ENTRADA.limiteDe(dinheiroCompacto(rules.limit.cents, conta.currency));
  if (!gate.limit.evaluated) return { usado: '—', de };
  return { usado: dinheiroCompacto(gate.limit.worstCents, conta.currency), de };
}

const PALAVRA_QUEBRA: Partial<Record<PlanBreak, string>> = { fora_da_janela: 'fora da janela', depois_do_limite: 'depois do limite' };

/** The plan's marks a gate answer gives (the window and the limit; Phase 5's stay out) */
export function quebrasDoGate(gate: GateResult): PlanBreak[] {
  const out: PlanBreak[] = [];
  if (gate.window.evaluated && gate.window.state === 'fora') out.push('fora_da_janela');
  if (gate.limit.evaluated && gate.limit.state === 'atingido') out.push('depois_do_limite');
  return out;
}

/** «fora da janela · depois do limite» (the «●» is drawn apart, aria-hidden); null when in the plan */
export function textoQuebras(breaks: readonly PlanBreak[]): string | null {
  const words = breaks.map((b) => PALAVRA_QUEBRA[b]).filter((w): w is string => !!w);
  return words.length ? words.join(' · ') : null;
}

/**
 * «Se o stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 125.» (and
 * the binary one), from the dry run's limit_room when it answered for this form, else the same rule
 * locally (riskBeyondLimit on the gate's limit). Never in «Já fechada» or on an expired binary
 * (resumo_v55 §2), never when the limit is reached («Encerrado por hoje» says it), never on an
 * equal risk. 3-4: an estimate's risk reads «≈ US$ 1.500» (`m.forma`).
 */
export function avisoLimiteEntrada(
  conta: Pick<ContaReg, 'market' | 'currency' | 'temLimite'>,
  m: Pick<ModeloEntrada, 'jaFoi' | 'risco' | 'diaRecusado'> & { forma?: FormaAtivo | null },
  gate: GateResult | null,
  room: LimitRoom | null | undefined,
): string | null {
  if (m.jaFoi || m.diaRecusado || !conta.temLimite) return null;
  let falta: string | null = null;
  let risco: string | null = null;
  if (room) {
    if (room.above && room.risk !== null) {
      falta = room.left;
      risco = room.risk;
    }
  } else if (gate && gate.limit.evaluated) {
    const w = riskBeyondLimit(dayLimitOf(gate.limit, conta.currency), m.risco);
    if (w) {
      falta = w.left;
      risco = w.risk;
    }
  }
  if (falta === null || risco === null) return null;
  const est = m.forma?.modo === 'estimativa' ? RISCO.estimativa : '';
  return conta.market === 'binary'
    ? EBINEX.avisoLimite(compacto(falta, conta.currency), compacto(risco, conta.currency))
    : FUTUROS.avisoLimite(compacto(falta, conta.currency), `${est}${compacto(risco, conta.currency)}`);
}

// ---------------------------------------------------------------------------------------------
// A trade's lines (the chooser, step 2, step 3)
// ---------------------------------------------------------------------------------------------

type TradeLinha = Pick<RegisteredTrade, 'symbol' | 'direction' | 'quantity' | 'durationSeconds'> & Partial<Pick<RegisteredTrade, 'option' | 'assetType'>>;

/** The form of a stored trade's instrument (crypto: its stored pair; an option: its contract) */
function formaDoTrade(t: TradeLinha, market: AccountMarket): FormaAtivo | null {
  return formaDoAtivo(market, t.symbol, { opcao: !!t.option || t.assetType === 'option' });
}

/** «SPY Call 790» (an option), the pair or code otherwise */
function ativoCurtoDe(forma: FormaAtivo | null, option: { right: 'call' | 'put'; strike: string } | null | undefined, symbol?: string): string {
  const s = symbol ?? forma?.simbolo ?? '';
  if (option) return OPCAO.ativo(s, option.right === 'call' ? OPCAO.call : OPCAO.put, formatDecimal(plainText(trimScale(numeric(option.strike)))));
  return s;
}

/** The market a 3-3 caller means when it gives none: Ebinex for call/put, futures otherwise */
const mercadoDe = (t: Pick<RegisteredTrade, 'direction'>, market?: AccountMarket): AccountMarket =>
  market ?? (t.direction === 'call' || t.direction === 'put' ? 'binary' : 'futures');

/** «SPY Call 790» · «BTC/USDT» · «PETR4»: a trade's instrument in a few words (the bridge's rows, D30) */
export function ativoCurto(t: TradeLinha, market?: AccountMarket): string {
  const m = mercadoDe(t, market);
  if (m === 'binary') return t.symbol;
  return ativoCurtoDe(null, t.option ?? null, t.symbol);
}

/**
 * «MES · Compra · 2 ct» / «EUR/USD · Baixa · 1 min» (RO `opTxt`), and since 3-4 «EUR/USD · Compra ·
 * 0,50 lote», «SPY Call 790 · vence 15 out · Compra · 2 ct», «BTC/USDT · Venda · 0,25 BTC»,
 * «PETR4 · Compra · 300 ações», «BGIX26 · Compra · 2 un.» (the market inferred as 3-3 when absent)
 */
export function opTexto(t: TradeLinha, market?: AccountMarket): string {
  const m = mercadoDe(t, market);
  if (m === 'binary' || t.direction === 'call' || t.direction === 'put') {
    return `${t.symbol} · ${t.direction === 'call' ? EBINEX.alta : EBINEX.baixa} · ${EBINEX.minutos(Math.round((t.durationSeconds ?? 0) / 60))}`;
  }
  const forma = formaDoTrade(t, m);
  const lado = t.direction === 'long' ? FUTUROS.compra : FUTUROS.venda;
  const q = t.quantity ?? '1';
  const qtd = forma ? forma.quantidade.sufixo(q) : contratos(q);
  const sym = t.option
    ? `${ativoCurtoDe(forma, t.option, t.symbol)} · ${OPCAO.vence(formatDiaMes(t.option.expiresOn))}`
    : t.symbol;
  return `${sym} · ${lado} · ${qtd}`;
}

/** «10:12 ET» / «ontem, 10:52 ET» / «21 out, 10:24 ET» (RO `desdeTxt`) */
export function desdeTexto(conta: ContaReg, t: Pick<RegisteredTrade, 'entryTime'>, now: Date): string {
  const d = diaRelativo(conta, t.entryTime, now);
  return `${d ? `${d}, ` : ''}${horaRel(conta, t.entryTime)}`;
}

/** The chooser's row (RO l.1597–1601): «EUR/USD · Compra · 0,50 lote · desde 08:40 ET» */
export function linhaEscolha(conta: ContaReg, t: RegisteredTrade, now: Date): string {
  return `${opTexto(t, conta.market)} · desde ${desdeTexto(conta, t, now)}`;
}

/** The trade's stop in points («10»), from the stored level */
export function pontosDoStop(t: Pick<RegisteredTrade, 'entryPrice' | 'stopPrice'>): string | null {
  if (t.entryPrice === null || t.stopPrice === null) return null;
  return plainText(abs(sub(numeric(t.entryPrice), numeric(t.stopPrice))));
}

/**
 * A stored stop or target as the instrument's unit shows it: points and pips as the distance
 * («10», «12»), a price or premium as the level («112.800», «1,10»); null without it
 */
export function distanciaDoStop(forma: FormaAtivo, t: Pick<RegisteredTrade, 'entryPrice'>, level: string | null): string | null {
  if (t.entryPrice === null || level === null) return null;
  const d = abs(sub(numeric(t.entryPrice), numeric(level)));
  if (forma.unidadeStop === 'pts') return formatDecimal(plainText(d));
  if (forma.unidadeStop === 'pips') return forma.spec.pip ? formatDecimal(plainText(trimScale(div(d, numeric(forma.spec.pip))))) : null;
  return precoDe(forma, level);
}

/** What a stored trade risks at its stop, as an exit there would compute it (null when typed or without a stop) */
function riscoDoTrade(forma: FormaAtivo, t: Pick<RegisteredTrade, 'direction' | 'quantity' | 'entryPrice' | 'stopPrice'>): string | null {
  if (forma.modo === 'digitado' || t.entryPrice === null || t.stopPrice === null || t.quantity === null) return null;
  const v = pnlFromPrices(forma.spec, t.direction === 'short' ? -1 : 1, t.quantity, t.entryPrice, t.stopPrice);
  return v === null ? null : numericText(abs(numeric(v)));
}

export interface ResumoAberta {
  /** «MES · Compra · 2 ct» */
  op: string;
  /** «7.912,50 às 10:12 ET» / «prêmio 1,85 às 09:35 ET» / «US$ 20 · payout 88% · 20:10–20:12 de Brasília» */
  entrada: string;
  /** «stop 10 · alvo 20 pts · risco US$ 100,00» / «stop 112.800 · alvo 111.600 · risco US$ 100,00»; null without stop and target */
  stop: string | null;
  /** The screen reader's «Entrada registrada às 10:12 ET.» */
  status: string;
}

/** Step 2's summary (RO l.1251–1265) */
export function resumoAberta(conta: ContaReg, t: RegisteredTrade, now: Date): ResumoAberta {
  const dia = diaRelativo(conta, t.entryTime, now);
  const status =
    dia === 'ontem'
      ? ABERTA.deOntem(horaRel(conta, t.entryTime))
      : dia
        ? ABERTA.deDia(dia, horaRel(conta, t.entryTime))
        : t.registeredAt && hora(conta, t.registeredAt) !== hora(conta, t.entryTime)
          ? ABERTA.registradaDigitada(horaRel(conta, t.entryTime), hora(conta, t.registeredAt))
          : ABERTA.registrada(horaRel(conta, t.entryTime));
  if (conta.market === 'binary') {
    const fim = t.expiresAt ? horaRel(conta, t.expiresAt) : '';
    return {
      op: opTexto(t),
      entrada: ABERTA.binario(compacto(t.stakeAmount ?? '0', conta.currency), formatDecimal(t.payoutPercent ?? '0'), `${hora(conta, t.entryTime)}–${fim}`),
      stop: null,
      status,
    };
  }
  const forma = formaDoTrade(t, conta.market);
  const precoTxt = forma ? precoDe(forma, t.entryPrice ?? '0') : preco(t.entryPrice ?? '0');
  const entrada = `${forma?.tipo === 'opcao' ? PASSOS_PRECOS.premio(precoTxt) : precoTxt} ${ABERTA.quando(dia, horaRel(conta, t.entryTime))}`;
  let stop: string | null = null;
  if (forma && (t.stopPrice !== null || t.targetPrice !== null)) {
    const s = distanciaDoStop(forma, t, t.stopPrice);
    const a = distanciaDoStop(forma, t, t.targetPrice);
    const risco = riscoDoTrade(forma, t);
    const riscoTxt = risco ? ABERTA.risco(`${forma.modo === 'estimativa' ? RISCO.estimativa : ''}${dinheiroSem(risco, conta.currency)}`) : '';
    const u = forma.unidadeStop;
    const partes = [s ? (u === 'premio' ? PASSOS_PRECOS.stopPremio(s) : ABERTA.stop(s)) : '', a ? ABERTA.alvo(a) : ''].filter(Boolean).join(' · ');
    stop = `${partes}${u === 'pts' ? ABERTA.pts : u === 'pips' ? PASSOS_PRECOS.pips : ''}${riscoTxt}`;
  }
  return { op: opTexto(t, conta.market), entrada, stop, status };
}

/** «Desfazer entrada» is still offered (live, open, within 15 minutes on the server's clock) */
export function podeDesfazer(t: Pick<RegisteredTrade, 'status' | 'registeredAt' | 'source'>, origin: 'live' | 'reconstructed' | null, now: Date): boolean {
  return origin === 'live' && t.status === 'open' && !!t.registeredAt && now.getTime() < undoUntil(t.registeredAt).getTime();
}

export interface SaidaCampos {
  preco: string;
  /** null = the current minute */
  hora: string | null;
  /** 3-4: the typed result («Resultado, US$») or the correction, as typed */
  resultado?: string;
  /** 3-4: «Corrigir» is open */
  corrigir?: boolean;
  /** 3-4: «Custos · opcional», as typed */
  custos?: string;
  /** 3-4: «Venceu sem valor» (an option) */
  vsv?: boolean;
}

export interface ModeloSaida {
  erros: { spreco?: string; shora?: string; res?: string; custos?: string };
  payload: ExitPayload | null;
  /** «Se sair a 7.903,75: +7,50 pts · +US$ 75,00» */
  previa: string;
  horaCampo: string;
  /** 3-4: what the exit price field shows («0» while «Venceu sem valor» is on and nothing was typed) */
  precoCampo: string;
  /** 3-4: the result block (the preview is its line) */
  bloco: BlocoResultadoModelo | null;
  /** 3-4: «Venceu sem valor» (an option) */
  vsv: EstadoVsv | null;
  /** 3-4: «Preço de saída» / «Prêmio de saída, US$ por ação» / «Preço de saída, USDT», «Hora da saída (ET)» */
  rotulos: { precoSaida: string; horaSaida: string } | null;
}

/** The order of step 2's exit (RO l.1283): where the focus goes on «Registrar saída» */
export const ORDEM_SAIDA = ['spreco', 'shora', 'res', 'custos'] as const;

/** Step 2's exit (every price market): checks, payload, preview (RO l.1231–1243, 1170–1176) */
export function modeloSaida(conta: ContaReg, t: RegisteredTrade, c: SaidaCampos, now: Date, tentou: boolean): ModeloSaida {
  const forma = formaDoTrade(t, conta.market);
  const erros: ModeloSaida['erros'] = {};
  const atual = hmOn(now, conta.clock);
  const vsv =
    forma?.tipo === 'opcao' && t.option
      ? estadoVsv(conta, t.option.expiresOn, t.tradingDay ?? diaDe(conta, t.entryTime), diaDe(conta, now), !!c.vsv, now, true)
      : null;
  const precoCampo = c.preco !== '' ? c.preco : vsv?.ligado ? '0' : '';
  const horaCampo = c.hora ?? (vsv?.ligado && vsv.hora ? vsv.hora : atual);
  let saida: string | null = null;
  let bloco: BlocoResultadoModelo | null = null;
  let previa: string = ABERTA.informeSaida;
  let pnl: string | undefined;
  let costs: string | undefined;
  if (forma) {
    const p = lerPrecoDe(forma, precoCampo, 'saída', forma.tipo === 'opcao');
    if (p.erro) erros.spreco = p.erro;
    else saida = p.value;
    const b = blocoResultado({
      conta,
      forma,
      aberta: true,
      lado: t.direction === 'short' ? 'short' : 'long',
      entradaTexto: t.entryPrice ?? '0',
      entradaDecimal: true,
      saidaTexto: precoCampo,
      qtd: t.quantity,
      tentou,
      corrigir: !!c.corrigir,
      res: c.resultado ?? '',
      custos: c.custos ?? '',
    });
    bloco = b.bloco;
    previa = b.bloco.linha;
    if (b.erros.res) erros.res = b.erros.res;
    if (b.erros.custos) erros.custos = b.erros.custos;
    pnl = b.pnl;
    costs = b.costs;
  }
  const hm = parseHhMm(horaCampo) === null ? null : formatHhMm(parseHhMm(horaCampo) as number);
  if (hm === null) erros.shora = ERROS.hora;
  else {
    const x = exitInstant(hm, conta.clock, now, t.entryTime);
    if (!x.ok) erros.shora = x.code === 'exit_in_future' ? ERROS.saidaFutura(horaRel(conta, now)) : ERROS.saidaAntes(hora(conta, t.entryTime));
  }
  const payload =
    saida !== null && !erros.spreco && !erros.shora && !erros.res && !erros.custos
      ? exitPayload(conta.market, { exitPrice: saida, exit: hm === null || hm === atual ? undefined : hm, clock: conta.clock, pnl, costs })
      : null;
  const rot = rotulosDePreco(forma, conta, true);
  return { erros, payload, previa, horaCampo, precoCampo, bloco, vsv, rotulos: { precoSaida: rot.precoSaida, horaSaida: rot.horaSaida } };
}

export interface ModeloResultado {
  vencida: boolean;
  erro: string | null;
  payload: ExitPayload | null;
  /** «Se acertar: +US$ 17,60 · se errar: −US$ 20,00» → «Resultado: −US$ 20,00» */
  previa: string;
  /** «Vence às 20:12 de Brasília.» → «Venceu às …» */
  vence: string;
}

/** Step 2's result (Ebinex): «Como terminou?» only after the expiry */
export function modeloResultado(conta: ContaReg, t: RegisteredTrade, outcome: Outcome | null, now: Date): ModeloResultado {
  const expira = t.expiresAt;
  const vencida = !!expira && now.getTime() >= expira.getTime();
  const stake = t.stakeAmount ?? '0';
  const payout = t.payoutPercent ?? '0';
  const ifWin = numericText(round(div(mul(numeric(stake), numeric(payout)), fromInt(100)), 2));
  const pnl = outcome === 'ganho' ? ifWin : outcome === 'perda' ? `-${stake}` : '0';
  return {
    vencida,
    erro: !vencida ? ERROS.naoVenceu : !outcome ? ERROS.comoTerminou : null,
    payload: vencida && outcome ? exitPayload('binary', { outcome }) : null,
    previa: vencida && outcome ? EBINEX.resultado(dinheiro(pnl, conta.currency)) : EBINEX.linha(dinheiro(ifWin, conta.currency), dinheiro(`-${stake}`, conta.currency)),
    vence: expira ? (vencida ? EBINEX.venceu : EBINEX.vence)(horaRel(conta, expira)) : '',
  };
}

export interface CartaoFechada {
  /** «−US$ 100,00» (or «—») */
  valor: string;
  tom: 'mint' | 'red' | 'neutral';
  /** «MES · Compra · 2 ct · 7.912,50 → 7.902,50 · −10,00 pts · 10:12–10:38 ET» */
  linha: string;
  /** «−1,00 R» and «com stop de 10 pts»; null without a stop */
  r: { valor: string; sub: string } | null;
  /** 3-4: «Resultado digitado por você.» / «Valor estimado pela cotação de saída; …» (absent otherwise) */
  base?: string;
  /** 3-4 (new markets, costs stored): «Custos US$ 7,00 · líquido +US$ 50,50» (absent otherwise) */
  custos?: string;
}

/** «10:12–10:38 ET» / «21 out, 10:52 → 22 out, 10:42 ET» / «21 out, 10:33–10:49 ET» (RO `periodo`) */
export function periodo(conta: ContaReg, entrada: Date, saida: Date, now: Date): string {
  const de = dataEm(conta, entrada);
  const ate = dataEm(conta, saida);
  if (de !== ate) return `${formatDiaMes(de)}, ${hora(conta, entrada)} → ${formatDiaMes(ate)}, ${horaRel(conta, saida)}`;
  const hoje = dataEm(conta, now);
  return `${de === hoje ? '' : `${formatDiaMes(de)}, `}${hora(conta, entrada)}–${horaRel(conta, saida)}`;
}

/** Step 3's result card (RO l.1310–1325, 1331–1337) */
export function cartaoFechada(conta: ContaReg, t: RegisteredTrade, now: Date): CartaoFechada {
  const pnl = t.pnl ?? '0';
  const s = Number(pnl);
  const tom = s > 0 ? 'mint' : s < 0 ? 'red' : 'neutral';
  const valor = t.pnl === null ? PASSOS_PRECOS.semResultado : dinheiro(pnl, conta.currency);
  const fim = t.exitTime ?? t.expiresAt ?? t.entryTime;
  if (conta.market === 'binary') {
    const resultado = t.result === 'win' ? EBINEX.fim.ganho : t.result === 'loss' ? EBINEX.fim.perda : EBINEX.fim.devolvida;
    return { valor, tom, linha: `${opTexto(t)} · ${resultado} · ${periodo(conta, t.entryTime, fim, now)}`, r: null };
  }
  const forma = formaDoTrade(t, conta.market);
  const entrada = t.entryPrice ?? '0';
  const saida = t.exitPrice ?? entrada;
  const sgn = t.direction === 'long' ? 1 : -1;
  const pts = numericText(mul(sub(numeric(saida), numeric(entrada)), fromInt(sgn)));
  const dif = forma ? diferencaTexto(forma, pts) : pontos(pts);
  const fmt = (x: string) => (forma ? precoDe(forma, x) : preco(x));
  const linha = `${opTexto(t, conta.market)} · ${fmt(entrada)} → ${fmt(saida)} · ${dif} · ${periodo(conta, t.entryTime, fim, now)}`;
  const rTxt = rMultiple(pts, t.entryPrice, t.stopPrice);
  let r: CartaoFechada['r'] = null;
  if (rTxt !== null && forma) {
    const u = forma.unidadeStop;
    const nivel = distanciaDoStop(forma, t, t.stopPrice) ?? '';
    const sub =
      u === 'pts' ? FECHADA.comStop(nivel) : u === 'pips' ? PASSOS_PRECOS.comStopPips(nivel) : u === 'premio' ? PASSOS_PRECOS.comStopPremio(nivel) : PASSOS_PRECOS.comStopEm(nivel);
    r = { valor: FECHADA.r(formatDecimal(numericText(round(numeric(rTxt), 2)), { minDecimals: 2, signed: true })), sub };
  }
  const out: CartaoFechada = { valor, tom, linha, r };
  if (t.pnlBasis === 'typed') out.base = PASSOS_PRECOS.baseDigitado;
  else if (t.pnlBasis === 'estimate') out.base = PASSOS_PRECOS.baseEstimativa;
  if (mercadoNovo(conta.market) && t.commission !== null && t.pnl !== null) {
    const liquido = numericText(sub(numeric(t.pnl), numeric(t.commission)));
    out.custos = PASSOS_PRECOS.custos(dinheiroSem(t.commission, conta.currency), dinheiro(liquido, conta.currency));
  }
  return out;
}

/** The exit banner's text and look (RO l.1326–1328, v57) */
export function textoAviso(conta: ContaReg, aviso: AvisoDoLimite, exitAt: Date | null): { texto: string; atingido: boolean } {
  const limite = dinheiroCompacto(aviso.limitCents, aviso.currency);
  const pior = compactoNeg(aviso.worstCents, aviso.currency);
  if (aviso.tipo === 'oitenta') return { texto: FECHADA.oitenta(pior, limite), atingido: false };
  const at = aviso.hitAt ?? exitAt;
  const quando = at ? horaNoRelogio(at, conta.dayClock.tz) : '';
  return {
    texto: `${FECHADA.atingido(quando, pior, limite)} ${aviso.atLimit === 'encerrar' ? FECHADA.atingidoEncerrar : FECHADA.atingidoAvisar}`,
    atingido: true,
  };
}

// ---------------------------------------------------------------------------------------------
// A server refusal under its field (3-4, T10: the codes 3-3 showed as «Algo deu errado»)
// ---------------------------------------------------------------------------------------------

/**
 * The text a field-level refusal of the server shows under its field, when the form's own check
 * has one (pnl_required, bad_pnl, bad_costs, bad_option, a price stop or target on the wrong side);
 * null = use ERRO_REGISTRAR[code]. `m` gives the instrument and the side.
 */
export function textoDaRecusa(code: string, field: string | null, m: { forma: FormaAtivo | null; lado: 'long' | 'short' | null }): string | null {
  switch (code) {
    case 'pnl_required':
      return ERROS_PRECOS.resVazio;
    case 'bad_pnl':
      return ERROS_PRECOS.resNumero;
    case 'bad_costs':
      return ERROS_PRECOS.custosNumero;
    case 'bad_option':
      return field === 'option.right'
        ? ERROS_PRECOS.opTipo
        : field === 'option.strike'
          ? ERROS_PRECOS.strikeNumero
          : field === 'option.expires_on'
            ? ERROS_PRECOS.vencAntes
            : null;
    case 'bad_stop':
    case 'bad_target': {
      const u = m.forma?.unidadeStop;
      if ((u === 'preco' || u === 'premio') && m.lado) {
        const oque = u === 'premio' ? 'prêmio' : 'preço';
        return code === 'bad_stop' ? ERROS_PRECOS.stopLado(m.lado === 'long', oque) : ERROS_PRECOS.alvoLado(m.lado === 'long', oque);
      }
      return u === 'pips' ? ERROS_PRECOS.pipsZero : u === 'preco' || u === 'premio' ? ERROS_PRECOS.precoStopZero : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------------------------

/** A stored value as the screen writes it («no ponto», «Calmo», «A») */
export const valorMarca = (kind: MarcaKind, value: string) => MARCAS.valores[kind][value] ?? value;
/** «às 10:12» / «ontem às 10:52» */
export const quandoMarca = (conta: ContaReg, at: Date, now: Date) => MARCAS.em(diaRelativo(conta, at, now), hora(conta, at));

/** A mark's chip on step 2: «às 10:12 · antes da saída» / «… · depois do resultado» */
export function chipMarca(conta: ContaReg, n: Pick<MarkNow, 'currentAt' | 'currentLimpa'>, now: Date): { texto: string; antes: boolean } {
  const antes = n.currentLimpa;
  return { texto: MARCAS.tempo(quandoMarca(conta, n.currentAt, now), antes ? MARCAS.antesSaida : MARCAS.depoisResultado), antes };
}

/** The current value of each kind (null = «desmarcada» or none) */
export function marcasAtuais(now: readonly MarkNow[]): Partial<Record<MarcaKind, MarkNow>> {
  const out: Partial<Record<MarcaKind, MarkNow>> = {};
  for (const n of now) if (n.kind === 'setup' || n.kind === 'execucao' || n.kind === 'emocao') out[n.kind] = n;
  return out;
}

export interface ItemMarca {
  texto: string;
  quando: string;
  historico: string | null;
}

/**
 * Step 3's «Suas marcas» (RO l.1293–1308): «antes da saída» keeps what counts in Análises (the
 * last «limpa» mark), with «(trocada às 10:41)» when it changed after; «depois do resultado» has
 * the marks made after, with «antes: A às 10:12 · agora: B às 10:41».
 */
export function marcasDivididas(conta: ContaReg, events: readonly MarkEvent[], now: Date): { antes: ItemMarca[]; depois: ItemMarca[] } {
  const antes: ItemMarca[] = [];
  const depois: ItemMarca[] = [];
  for (const kind of MARCA_KINDS) {
    const mine = events.filter((e) => e.kind === kind).sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime() || a.id - b.id);
    if (mine.length === 0) continue;
    const cur = mine[mine.length - 1];
    const limpas = mine.filter((e) => e.limpa);
    const pre = limpas.length ? limpas[limpas.length - 1] : null;
    const rot = (v: string) => MARCAS.rotulo(kind, valorMarca(kind, v));
    if (cur.limpa || (pre && pre.value === cur.value)) {
      const m = cur.limpa ? cur : (pre as MarkEvent);
      if (m.value) antes.push({ texto: rot(m.value), quando: quandoMarca(conta, m.markedAt, now), historico: null });
      continue;
    }
    const quandoCur = quandoMarca(conta, cur.markedAt, now);
    if (pre && pre.value) {
      antes.push({
        texto: rot(pre.value),
        quando: `${quandoMarca(conta, pre.markedAt, now)} ${cur.value ? FECHADA.trocada(quandoCur) : FECHADA.desmarcada(quandoCur)}`,
        historico: null,
      });
    }
    if (!cur.value && !(pre && pre.value)) continue;
    const historico =
      pre && pre.value
        ? FECHADA.historico(
            `${valorMarca(kind, pre.value)} ${quandoMarca(conta, pre.markedAt, now)}`,
            `${cur.value ? valorMarca(kind, cur.value) : FECHADA.semMarca} ${quandoCur}`,
          )
        : null;
    depois.push({ texto: cur.value ? rot(cur.value) : MARCAS.semMarca(kind), quando: quandoCur, historico });
  }
  return { antes, depois };
}

/**
 * «Marcas feitas a partir de agora contam como depois do resultado.», or «… a partir das 10:38 (sua
 * saída) …» / «(o vencimento)» when marks were made while the trade was open in the app but at or
 * after its exit (an exit typed earlier than it was registered, an expired binary).
 */
export function linhaDepois(conta: ContaReg, t: RegisteredTrade, events: readonly MarkEvent[], origin: 'live' | 'reconstructed' | null): string {
  const known = t.exitTime && t.expiresAt ? (t.exitTime < t.expiresAt ? t.exitTime : t.expiresAt) : t.exitTime ?? t.expiresAt;
  const reg = t.exitRegisteredAt;
  if (origin === 'live' && known && reg) {
    const passaram = events.some((e) => e.markedAt.getTime() >= known.getTime() && e.markedAt.getTime() < reg.getTime());
    if (passaram) return conta.market === 'binary' ? FECHADA.linhaDepoisVencimento(hora(conta, known)) : FECHADA.linhaDepoisSaida(hora(conta, known));
  }
  return FECHADA.linhaDepois;
}

/** What a screen reader hears after a mark is saved */
export function anuncioMarca(conta: ContaReg, kind: MarcaKind, n: MarkNow | undefined, now: Date): string {
  if (!n || n.currentValue === null) return MARCAS.anuncioDesmarcada(kind, quandoMarca(conta, n?.currentAt ?? now, now));
  return MARCAS.anuncio(
    MARCAS.rotulo(kind, valorMarca(kind, n.currentValue)),
    quandoMarca(conta, n.currentAt, now),
    n.currentLimpa ? MARCAS.antesSaida : MARCAS.depoisResultado,
  );
}

// ---------------------------------------------------------------------------------------------
// Small helpers the steps share
// ---------------------------------------------------------------------------------------------

/** The step indicator's text and dots (RO l.1636–1640) */
export function indicador(passo: 'entrada' | 'aberta' | 'fechada', o: { fechadaDireto: boolean; vencida: boolean }): { k: number; n: number; nome: string } {
  if (o.fechadaDireto) return passo === 'entrada' ? { k: 1, n: 2, nome: 'entradaSaida' } : { k: 2, n: 2, nome: 'fechada' };
  if (passo === 'entrada') return { k: 1, n: 3, nome: 'entrada' };
  if (passo === 'aberta') return { k: 2, n: 3, nome: o.vencida ? 'vencida' : 'aberta' };
  return { k: 3, n: 3, nome: 'fechada' };
}

/** «Entrada das 10:31 desfeita às 10:32.» */
export function avisoDesfeita(conta: ContaReg, t: Pick<RegisteredTrade, 'entryTime'>, at: Date): string {
  return ENTRADA.desfeita(hora(conta, t.entryTime), hora(conta, at));
}

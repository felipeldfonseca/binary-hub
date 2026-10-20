/**
 * «Registrar operação» for Futures and Ebinex (PR 3-3, lane A): the form's state, its checks in
 * the board's order, the payloads it sends and every line the sheet writes from domain values (the
 * gate line, the risk line, the previews, the step 2 summary, the step 3 card, the marks split,
 * «desde …», the periods). Pure: no React, no client; time is an input (the server's clock,
 * hooks/useRegistrar.useServerNow). The words are components/hub/registrar/copy's templates.
 *
 * The rules are the database's (lib/domain/registro mirrors them): the form only refuses what the
 * server would refuse, with the board's texts, so a refusal from the server is rare.
 */
import {
  addDays,
  firstLocalHmAtOrAfter,
  formatHhMm,
  hmOn,
  localHmInTradingDay,
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
  rMultiple,
  riskBeyondLimit,
  tradeInstrument,
  undoUntil,
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
  type Outcome,
} from '@/lib/domain/registro';
import { abs, cmp, div, fromInt, isMultipleOf, mul, numeric, numericText, parseNumeric, plainText, round, sub } from '@/lib/domain/registro/numeric';
import { ABERTA, EBINEX, ENTRADA, ERROS, FECHADA, FUTUROS, GATE, MARCAS, SIMILAR } from '@/components/hub/registrar/copy';
import { formatDiaMes, formatMoney } from './formato';
import { formatDecimal, lerNumero } from './numero';
import { dinheiroCompacto, horaNoRelogio, sufixoRelogio, type Tom } from './posso';
import type { AvisoDoLimite, RegistrarDefaults } from './registrar';
import { CONTRACT_CHIPS } from './registrar';
import type { RegisteredTrade } from './registrarDb';

// ---------------------------------------------------------------------------------------------
// The account the sheet registers on
// ---------------------------------------------------------------------------------------------

/** The two markets 3-3 registers (podeRegistrar) */
export type MercadoReg = 'futures' | 'binary';

/** What the form needs of an account: its clocks, windows, «desde» and currency */
export interface ContaReg {
  id: string;
  label: string;
  market: MercadoReg;
  platform: string | null;
  /** The window clock every hour is typed on (America/New_York on futures, America/Sao_Paulo on Ebinex) */
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
  const market = account.market === 'binary' ? 'binary' : 'futures';
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

export interface Rascunho {
  v: 1;
  accountId: string;
  /** One per form, kept across retries and a reopened sheet (C6, C23) */
  clientKey: string;
  modo: Modo;
  /** «Já fechada»: the trading day chosen; null = «Hoje» */
  dia: string | null;
  // Futures
  ativo: string | null;
  lado: 'long' | 'short' | null;
  /** «1» «2» «3», or what «Outro» holds */
  qtd: string;
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
  resultado: Outcome | null;
  /** Taps held until «Registrar entrada» (sent as the entry's `marks`) */
  marcas: Partial<Record<MarcaKind, string>>;
  maisAberto: boolean;
}

/** A decimal text the pt-BR way, for a prefilled field ('17.5' → '17,5') */
const campo = (x: string | null | undefined) => (x ? formatDecimal(x) : '');

/** Step 1 as it opens on an account (its starting values: D5, D6) */
export function rascunhoInicial(conta: Pick<ContaReg, 'id' | 'market'>, defaults: RegistrarDefaults | null, clientKey: string): Rascunho {
  const d = defaults ?? { symbol: null, quantity: '1', pairs: [], payoutBySymbol: {}, stake: null };
  const futures = conta.market === 'futures';
  const chip = (CONTRACT_CHIPS as readonly string[]).includes(d.quantity);
  const par = futures ? null : d.pairs[0] ?? null;
  return {
    v: 1,
    accountId: conta.id,
    clientKey,
    modo: 'aberta',
    dia: null,
    ativo: futures ? d.symbol ?? 'MES' : null,
    lado: null,
    qtd: chip ? d.quantity : formatDecimal(d.quantity),
    qtdOutro: !chip,
    preco: '',
    hora: null,
    precoSaida: '',
    horaSaida: null,
    stop: '',
    alvo: '',
    par,
    parOutro: !futures && par === null,
    parTexto: '',
    direcao: null,
    duracao: null,
    stake: campo(d.stake),
    payout: par ? campo(d.payoutBySymbol[par]) : '',
    resultado: null,
    marcas: {},
    maisAberto: false,
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

/** A stored draft, when it has this shape and belongs to this account; else null */
export function lerRascunho(json: unknown, accountId: string): Rascunho | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  const ok =
    r.v === 1 &&
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
  if (!ok) return null;
  const marcas: Partial<Record<MarcaKind, string>> = {};
  for (const k of MARCA_KINDS) {
    const v = (r.marcas as Record<string, unknown>)[k];
    if (str(v) && MARCA_VALORES[k].includes(v)) marcas[k] = v;
  }
  return { ...(r as unknown as Rascunho), marcas };
}

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

/** A field read as a positive decimal ('7896.25'), or why not */
function positivo(text: string): { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' | 'zero' } {
  const n = lerNumero(text);
  if (!n.ok) return n;
  const v = parseNumeric(n.value);
  if (!v || cmp(v, fromInt(0)) <= 0) return { ok: false, reason: 'zero' };
  return { ok: true, value: n.value };
}

const naoMultiplo = (value: string, tick: string | null) => !!tick && !isMultipleOf(numeric(value), numeric(tick));

/** The instrument of a futures root (the chips are all in INSTRUMENT_SPEC) */
export const instrumento = (market: MercadoReg, symbol: string): InstrumentSpec | null => tradeInstrument(market, symbol);
/** «0,25» / «0,10» */
const tickTxt = (spec: InstrumentSpec) => formatDecimal(spec.tick ?? '0', { minDecimals: 2 });

// ---------------------------------------------------------------------------------------------
// Step 1: checks, payloads and lines
// ---------------------------------------------------------------------------------------------

export type CampoEntrada = 'dia' | 'lado' | 'q' | 'preco' | 'hora' | 'spreco' | 'shora' | 'stop' | 'alvo' | 'par' | 'dir' | 'exp' | 'stake' | 'payout' | 'fimB';

/** The board's order (RO l.1064): where the focus goes on «Registrar» */
export const ORDEM_FUTUROS: readonly CampoEntrada[] = ['dia', 'lado', 'q', 'preco', 'hora', 'spreco', 'shora', 'stop', 'alvo'];
export const ORDEM_EBINEX: readonly CampoEntrada[] = ['dia', 'par', 'dir', 'exp', 'stake', 'payout', 'hora', 'fimB'];

/** Shown before a «Registrar» tap: the day, the stop and the target (RO `campo(…, true)`) */
const SEMPRE_VISIVEIS: readonly CampoEntrada[] = ['dia', 'stop', 'alvo'];

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
}

/** The symbol the form registers (futures root, Ebinex pair as sent: upper case) */
export function simboloDe(r: Rascunho, market: MercadoReg): string {
  if (market === 'futures') return r.ativo ?? '';
  return r.parOutro ? r.parTexto.trim().toUpperCase() : r.par ?? '';
}

const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9./:() _-]*$/;

/** Step 1 as it stands: errors, instants, payloads, lines */
export function modeloEntrada({ conta, r, now, hoje, tentou }: EntradaInput): ModeloEntrada {
  const futures = conta.market === 'futures';
  const fechada = r.modo === 'fechada';
  const erros: Partial<Record<CampoEntrada, string>> = {};
  const atual = hmOn(now, conta.clock);
  const horaCampo = r.hora ?? atual;
  const horaSaidaCampo = r.horaSaida ?? atual;
  const agoraTxt = horaRel(conta, now);

  // «Dia»
  const dia = fechada ? r.dia ?? hoje : hoje;
  if (fechada) {
    if (dia > hoje) erros.dia = ERROS.diaFuturo;
    else if (conta.desdeDay && dia < conta.desdeDay) erros.dia = ERROS.antesRegras(formatDiaMes(conta.desdeDay));
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

  let payload: EntryPayload | null = null;
  let payloadFechada: AfterPayload | null = null;
  let risco: string | null = null;
  let linhaRisco = '';
  let linhaBinaria = '';
  let linhaResultado = '';
  let expiraEm: Date | null = null;
  let vencido = false;
  let descricao: { lado: string; ativo: string } | null = null;
  const marks = marcasDoRascunho(r);
  const entry = fechada || hm === null || noMinutoAtual ? undefined : hm;

  if (futures) {
    const symbol = r.ativo ?? '';
    const spec = symbol ? instrumento('futures', symbol) : null;
    if (!r.lado) erros.lado = ERROS.lado;
    // Contracts
    let qtd: string | null = null;
    if (!r.qtdOutro) qtd = (CONTRACT_CHIPS as readonly string[]).includes(r.qtd) ? r.qtd : null;
    else {
      const n = lerNumero(r.qtd);
      if (!n.ok) erros.q = n.reason === 'empty' ? ERROS.qtdVazia : ERROS.qtdNumero;
      else if (!/^[0-9]+$/.test(n.value)) erros.q = cmp(numeric(n.value), fromInt(0)) <= 0 ? ERROS.qtdZero : ERROS.qtdInteira;
      else if (cmp(numeric(n.value), fromInt(0)) <= 0) erros.q = ERROS.qtdZero;
      else if (n.value.length > 6) erros.q = ERROS.qtdNumero;
      else qtd = n.value;
    }
    if (!qtd && !erros.q) erros.q = ERROS.qtdVazia;
    // Prices
    const lerPreco = (text: string, vazio: string): { value: string | null; erro?: string } => {
      const p = positivo(text);
      if (!p.ok) return { value: null, erro: p.reason === 'empty' ? vazio : p.reason === 'invalid' ? ERROS.precoNumero : ERROS.precoZero };
      if (spec && naoMultiplo(p.value, spec.tick)) return { value: null, erro: ERROS.precoPasso(symbol, tickTxt(spec)) };
      return { value: p.value };
    };
    const entrada = lerPreco(r.preco, ERROS.precoVazio);
    if (entrada.erro) erros.preco = entrada.erro;
    let saida: { value: string | null; erro?: string } = { value: null };
    let saidaEm: Date | null = null;
    if (fechada) {
      saida = lerPreco(r.precoSaida, ERROS.precoSaidaVazio);
      if (saida.erro) erros.spreco = saida.erro;
      const shm = parseHhMm(horaSaidaCampo) === null ? null : formatHhMm(parseHhMm(horaSaidaCampo) as number);
      if (shm === null) erros.shora = ERROS.hora;
      else if (hm !== null && (parseHhMm(shm) as number) < (parseHhMm(hm) as number)) erros.shora = ERROS.saidaAntes(hm);
      else if (entradaEm) {
        saidaEm = firstLocalHmAtOrAfter(entradaEm, shm, conta.clock);
        if (saidaEm.getTime() > now.getTime()) erros.shora = ERROS.saidaFutura(agoraTxt);
      }
    }
    // Stop and target, in points
    const lerPontos = (text: string): { value: string | null; erro?: string } => {
      if (text.trim() === '') return { value: null };
      const p = positivo(text);
      if (!p.ok) return { value: null, erro: ERROS.pontosZero };
      if (spec && naoMultiplo(p.value, spec.tick)) return { value: null, erro: ERROS.pontosPasso(symbol, tickTxt(spec)) };
      return { value: p.value };
    };
    const stop = lerPontos(r.stop);
    const alvo = lerPontos(r.alvo);
    if (stop.erro) erros.stop = stop.erro;
    if (alvo.erro) erros.alvo = alvo.erro;

    // The risk line (points × point value × contracts: what an exit at that level would compute)
    const mult = spec?.mult ?? null;
    const money = (pts: string) => (mult && qtd ? numericText(round(mul(mul(numeric(pts), numeric(mult)), numeric(qtd)), 2)) : null);
    risco = stop.value ? money(stop.value) : null;
    const ganho = alvo.value ? money(alvo.value) : null;
    const partes: string[] = [];
    if (risco) partes.push(FUTUROS.risco(dinheiroSem(risco, conta.currency)));
    if (ganho) partes.push(FUTUROS.alvoValor(dinheiroSem(ganho, conta.currency)));
    if (stop.value && alvo.value) partes.push(FUTUROS.razao(curto(Number(alvo.value) / Number(stop.value))));
    linhaRisco = partes.length ? partes.join(' · ') : FUTUROS.semStop;

    // «Já fechada»: the result as the server will compute it
    if (fechada) {
      const passo = spec ? FUTUROS.passo(symbol, tickTxt(spec)) : '';
      const pIn = positivo(r.preco);
      const pOut = positivo(r.precoSaida);
      if (!r.lado) linhaResultado = FUTUROS.resultadoLado;
      else if (!pIn.ok || !pOut.ok) linhaResultado = FUTUROS.resultadoPrecos;
      else if (spec && (naoMultiplo(pIn.value, spec.tick) || naoMultiplo(pOut.value, spec.tick))) {
        linhaResultado = tentou ? FUTUROS.resultadoConfira : FUTUROS.resultadoConfiraPasso(passo);
      } else if (!qtd) linhaResultado = FUTUROS.resultadoQuantidade;
      else {
        const sgn = r.lado === 'long' ? 1 : -1;
        const pts = numericText(mul(sub(numeric(pOut.value), numeric(pIn.value)), fromInt(sgn)));
        const valor = mult ? numericText(round(mul(mul(numeric(pts), numeric(mult)), numeric(qtd)), 2)) : null;
        linhaResultado = valor ? FUTUROS.resultado(pontos(pts), dinheiro(valor, conta.currency)) : FUTUROS.resultadoPrecos;
      }
    }
    if (r.lado && symbol) descricao = { lado: r.lado === 'long' ? FUTUROS.compra : FUTUROS.venda, ativo: symbol };

    // Payloads: only a complete form (the dry run refuses anything else)
    const base = {
      clientKey: r.clientKey,
      symbol,
      direction: (r.lado ?? 'long') as Direction,
      quantity: qtd ?? undefined,
      entryPrice: entrada.value ?? undefined,
      stop: stop.value ?? undefined,
      target: alvo.value ?? undefined,
      clock: conta.clock,
      marks,
    };
    const completo = !erros.lado && !erros.q && !erros.preco && !erros.hora && !erros.stop && !erros.alvo && !!spec;
    if (!fechada && completo) payload = entryPayload('futures', { ...base, entry });
    if (fechada && completo && !erros.dia && !erros.spreco && !erros.shora && hm !== null) {
      payloadFechada = afterPayload('futures', { ...base, day: dia, entry: hm, exit: horaSaidaCampo, exitPrice: saida.value ?? undefined });
    }
  } else {
    // Ebinex
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
      linhaBinaria = EBINEX.linha(dinheiro(ifWin, conta.currency), dinheiro(`-${stake.value}`, conta.currency));
    } else linhaBinaria = EBINEX.preencha;
    risco = stake.ok && !erros.stake ? stake.value : null;

    // The expiry: the next candle of the chosen time, from the entry (D35, v55)
    if (r.duracao && entradaEm) {
      expiraEm = binaryExpiry(conta.platform, entradaEm, r.duracao);
      vencido = now.getTime() >= expiraEm.getTime();
    }
    if (fechada) {
      if (r.duracao && entradaEm && !vencido) erros.fimB = ERROS.naoVenceu;
      else if (!r.resultado) erros.fimB = ERROS.comoTerminou;
      if (r.resultado && vencido && stake.ok && payout) {
        const pnl =
          r.resultado === 'ganho'
            ? numericText(round(div(mul(numeric(stake.value), numeric(payout)), fromInt(100)), 2))
            : r.resultado === 'perda'
              ? `-${stake.value}`
              : '0';
        linhaResultado = EBINEX.resultado(dinheiro(pnl, conta.currency));
      } else linhaResultado = EBINEX.resultadoEscolha;
    }
    if (r.direcao && symbol) descricao = { lado: r.direcao === 'call' ? EBINEX.alta : EBINEX.baixa, ativo: symbol };

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
    if (!fechada && completo) payload = entryPayload('binary', { ...base, entry });
    if (fechada && completo && !erros.dia && !erros.fimB && hm !== null && r.resultado) {
      payloadFechada = afterPayload('binary', { ...base, day: dia, entry: hm, outcome: r.resultado });
    }
  }

  const ordem = futures ? ORDEM_FUTUROS : ORDEM_EBINEX;
  const primeiro = ordem.find((k) => erros[k]) ?? null;
  const visiveis: Partial<Record<CampoEntrada, string>> = {};
  for (const k of ordem) if (erros[k] && (tentou || SEMPRE_VISIVEIS.includes(k))) visiveis[k] = erros[k];

  const venceTxt = expiraEm ? (vencido ? EBINEX.venceu : EBINEX.vence)(horaRel(conta, expiraEm)) : null;
  return {
    erros,
    visiveis,
    primeiro,
    hoje,
    dia,
    diaRecusado,
    horaCampo,
    horaSaidaCampo,
    agora: !fechada && (r.hora === null || noMinutoAtual),
    entradaEm,
    noMinutoAtual,
    expiraEm,
    vencido,
    jaFoi: fechada || vencido,
    payload,
    payloadFechada,
    risco,
    linhaRisco,
    linhaBinaria,
    linhaResultado,
    venceTxt,
    descricao,
  };
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
 * equal risk.
 */
export function avisoLimiteEntrada(
  conta: Pick<ContaReg, 'market' | 'currency' | 'temLimite'>,
  m: Pick<ModeloEntrada, 'jaFoi' | 'risco' | 'diaRecusado'>,
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
  return conta.market === 'binary'
    ? EBINEX.avisoLimite(compacto(falta, conta.currency), compacto(risco, conta.currency))
    : FUTUROS.avisoLimite(compacto(falta, conta.currency), compacto(risco, conta.currency));
}

// ---------------------------------------------------------------------------------------------
// A trade's lines (the chooser, step 2, step 3)
// ---------------------------------------------------------------------------------------------

/** «MES · Compra · 2 ct» / «EUR/USD · Baixa · 1 min» (RO `opTxt`) */
export function opTexto(t: Pick<RegisteredTrade, 'symbol' | 'direction' | 'quantity' | 'durationSeconds'>): string {
  if (t.direction === 'call' || t.direction === 'put') {
    return `${t.symbol} · ${t.direction === 'call' ? EBINEX.alta : EBINEX.baixa} · ${EBINEX.minutos(Math.round((t.durationSeconds ?? 0) / 60))}`;
  }
  return `${t.symbol} · ${t.direction === 'long' ? FUTUROS.compra : FUTUROS.venda} · ${contratos(t.quantity ?? '1')}`;
}

/** «10:12 ET» / «ontem, 10:52 ET» / «21 out, 10:24 ET» (RO `desdeTxt`) */
export function desdeTexto(conta: ContaReg, t: Pick<RegisteredTrade, 'entryTime'>, now: Date): string {
  const d = diaRelativo(conta, t.entryTime, now);
  return `${d ? `${d}, ` : ''}${horaRel(conta, t.entryTime)}`;
}

/** The chooser's row (RO l.1597–1601) */
export function linhaEscolha(conta: ContaReg, t: RegisteredTrade, now: Date): string {
  return `${opTexto(t)} · desde ${desdeTexto(conta, t, now)}`;
}

/** The trade's stop in points («10»), from the stored level */
export function pontosDoStop(t: Pick<RegisteredTrade, 'entryPrice' | 'stopPrice'>): string | null {
  if (t.entryPrice === null || t.stopPrice === null) return null;
  return plainText(abs(sub(numeric(t.entryPrice), numeric(t.stopPrice))));
}

export interface ResumoAberta {
  /** «MES · Compra · 2 ct» */
  op: string;
  /** «7.912,50 às 10:12 ET» / «US$ 20 · payout 88% · 20:10–20:12 de Brasília» */
  entrada: string;
  /** «stop 10 · alvo 20 pts · risco US$ 100,00»; null without stop and target */
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
  const entrada = `${preco(t.entryPrice ?? '0')} ${ABERTA.quando(dia, horaRel(conta, t.entryTime))}`;
  const stopPts = pontosDoStop(t);
  const alvoPts = t.entryPrice !== null && t.targetPrice !== null ? plainText(abs(sub(numeric(t.targetPrice), numeric(t.entryPrice)))) : null;
  let stop: string | null = null;
  if (stopPts || alvoPts) {
    const partes = [stopPts ? ABERTA.stop(formatDecimal(stopPts)) : '', alvoPts ? ABERTA.alvo(formatDecimal(alvoPts)) : ''].filter(Boolean).join(' · ');
    const spec = instrumento('futures', t.symbol);
    const risco =
      stopPts && spec?.mult && t.quantity ? numericText(round(mul(mul(numeric(stopPts), numeric(spec.mult)), numeric(t.quantity)), 2)) : null;
    stop = `${partes}${ABERTA.pts}${risco ? ABERTA.risco(dinheiroSem(risco, conta.currency)) : ''}`;
  }
  return { op: opTexto(t), entrada, stop, status };
}

/** «Desfazer entrada» is still offered (live, open, within 15 minutes on the server's clock) */
export function podeDesfazer(t: Pick<RegisteredTrade, 'status' | 'registeredAt' | 'source'>, origin: 'live' | 'reconstructed' | null, now: Date): boolean {
  return origin === 'live' && t.status === 'open' && !!t.registeredAt && now.getTime() < undoUntil(t.registeredAt).getTime();
}

export interface SaidaCampos {
  preco: string;
  /** null = the current minute */
  hora: string | null;
}

export interface ModeloSaida {
  erros: { spreco?: string; shora?: string };
  payload: ExitPayload | null;
  /** «Se sair a 7.903,75: +7,50 pts · +US$ 75,00» */
  previa: string;
  horaCampo: string;
}

/** Step 2's exit (futures): checks, payload, preview (RO l.1231–1243, 1170–1176) */
export function modeloSaida(conta: ContaReg, t: RegisteredTrade, c: SaidaCampos, now: Date, tentou: boolean): ModeloSaida {
  const spec = instrumento('futures', t.symbol);
  const erros: ModeloSaida['erros'] = {};
  const atual = hmOn(now, conta.clock);
  const horaCampo = c.hora ?? atual;
  const p = positivo(c.preco);
  const passo = spec ? FUTUROS.passo(t.symbol, tickTxt(spec)) : '';
  let previa: string;
  let saida: string | null = null;
  if (!p.ok) {
    erros.spreco = p.reason === 'empty' ? ERROS.precoSaidaVazio : p.reason === 'invalid' ? ERROS.precoNumero : ERROS.precoZero;
    previa = ABERTA.informeSaida;
  } else if (spec && naoMultiplo(p.value, spec.tick)) {
    erros.spreco = ERROS.precoPasso(t.symbol, tickTxt(spec));
    previa = tentou ? ABERTA.confiraSaida : ABERTA.confiraSaidaPasso(passo);
  } else {
    saida = p.value;
    const sgn = t.direction === 'long' ? 1 : -1;
    const pts = numericText(mul(sub(numeric(p.value), numeric(t.entryPrice ?? '0')), fromInt(sgn)));
    const valor = spec?.mult && t.quantity ? numericText(round(mul(mul(numeric(pts), numeric(spec.mult)), numeric(t.quantity)), 2)) : null;
    previa = valor ? ABERTA.seSair(preco(p.value), pontos(pts), dinheiro(valor, conta.currency)) : ABERTA.informeSaida;
  }
  const hm = parseHhMm(horaCampo) === null ? null : formatHhMm(parseHhMm(horaCampo) as number);
  if (hm === null) erros.shora = ERROS.hora;
  else {
    const x = exitInstant(hm, conta.clock, now, t.entryTime);
    if (!x.ok) erros.shora = x.code === 'exit_in_future' ? ERROS.saidaFutura(horaRel(conta, now)) : ERROS.saidaAntes(hora(conta, t.entryTime));
  }
  const payload =
    saida && !erros.spreco && !erros.shora
      ? exitPayload('futures', { exitPrice: saida, exit: hm === null || hm === atual ? undefined : hm, clock: conta.clock })
      : null;
  return { erros, payload, previa, horaCampo };
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
  /** «−US$ 100,00» */
  valor: string;
  tom: 'mint' | 'red' | 'neutral';
  /** «MES · Compra · 2 ct · 7.912,50 → 7.902,50 · −10,00 pts · 10:12–10:38 ET» */
  linha: string;
  /** «−1,00 R» and «com stop de 10 pts»; null without a stop */
  r: { valor: string; sub: string } | null;
}

/** «10:12–10:38 ET» / «21 out, 10:52 → 22 out, 10:42 ET» / «21 out, 10:33–10:49 ET» (RO `periodo`) */
export function periodo(conta: ContaReg, entrada: Date, saida: Date, now: Date): string {
  const de = dataEm(conta, entrada);
  const ate = dataEm(conta, saida);
  if (de !== ate) return `${formatDiaMes(de)}, ${hora(conta, entrada)} → ${formatDiaMes(ate)}, ${horaRel(conta, saida)}`;
  const hoje = dataEm(conta, now);
  return `${de === hoje ? '' : `${formatDiaMes(de)}, `}${hora(conta, entrada)}–${horaRel(conta, saida)}`;
}

/** Step 3's result card (RO l.1310–1325) */
export function cartaoFechada(conta: ContaReg, t: RegisteredTrade, now: Date): CartaoFechada {
  const pnl = t.pnl ?? '0';
  const s = Number(pnl);
  const tom = s > 0 ? 'mint' : s < 0 ? 'red' : 'neutral';
  const valor = dinheiro(pnl, conta.currency);
  const fim = t.exitTime ?? t.expiresAt ?? t.entryTime;
  if (conta.market === 'binary') {
    const resultado = t.result === 'win' ? EBINEX.fim.ganho : t.result === 'loss' ? EBINEX.fim.perda : EBINEX.fim.devolvida;
    return { valor, tom, linha: `${opTexto(t)} · ${resultado} · ${periodo(conta, t.entryTime, fim, now)}`, r: null };
  }
  const entrada = t.entryPrice ?? '0';
  const saida = t.exitPrice ?? entrada;
  const sgn = t.direction === 'long' ? 1 : -1;
  const pts = numericText(mul(sub(numeric(saida), numeric(entrada)), fromInt(sgn)));
  const linha = `${opTexto(t)} · ${preco(entrada)} → ${preco(saida)} · ${pontos(pts)} · ${periodo(conta, t.entryTime, fim, now)}`;
  const rTxt = rMultiple(pts, t.entryPrice, t.stopPrice);
  const stopPts = pontosDoStop(t);
  const r =
    rTxt !== null && stopPts
      ? { valor: FECHADA.r(formatDecimal(numericText(round(numeric(rTxt), 2)), { minDecimals: 2, signed: true })), sub: FECHADA.comStop(formatDecimal(stopPts)) }
      : null;
  return { valor, tom, linha, r };
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

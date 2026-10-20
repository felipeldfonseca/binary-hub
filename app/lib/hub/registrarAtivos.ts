/**
 * «Registrar operação» (Phase 3 · 3-4): what each instrument's form looks like in every price
 * market (futures, forex, ações e opções, cripto, B3), as data over the descriptors (tradeInstrument:
 * the database's trade_instrument), never a second copy of the money rules. The approved board's
 * `specDe` (RegistrarOperacao l.751–780) and its siblings: the kind of instrument, how its result is
 * known, the stop's unit, the decimals shown and accepted, the example in the "only numbers" error,
 * the quantity's label, chips and suffix, the price difference's words, the tick text. Also the
 * «Buscar ativo / par / moeda» search over the approved catalogs (lib/domain/registro/catalogo) and
 * the instrument chips.
 *
 * Pure: no React, no client. The words are components/hub/registrar/copy's.
 */
import type { AccountMarket } from '@/lib/domain/markets';
import {
  ACOES_EUA,
  ALIASES_B3,
  CATALOGO,
  CRIPTO_CATALOGO,
  FOREX_CATALOGO,
  FUTUROS_CATALOGO,
  INDICES_OPCOES,
  tradeInstrument,
  type InstrumentSpec,
  type OptionContract,
} from '@/lib/domain/registro';
import { ATIVO, QTD } from '@/components/hub/registrar/copy';
import { formatDecimal } from './numero';
import {
  B3_CHIPS,
  B3_CONTRACT_CHIPS,
  CONTRACT_CHIPS,
  EXEMPLOS_ATIVO,
  FUTURES_CHIPS,
  LOT_CHIPS,
  cotacaoDoSimbolo,
  type Cotacao,
  type RegistrarDefaults,
} from './registrar';

export type { Cotacao } from './registrar';
export { COTACOES } from './registrar';

/**
 * The board's kinds (RO `specDe`): fut (a futures row of the table), futx (a futures root outside it:
 * typed, price stops), fx (forex), acao (a stock or ETF), opcao (a listed option), cri (crypto), b3f
 * (WIN, IND, WDO, DOL), di (DI1), b3a (a B3 catalog stock or ETF), b3x (a B3 code outside the catalog)
 */
export type TipoAtivo = 'fut' | 'futx' | 'fx' | 'acao' | 'opcao' | 'cri' | 'b3f' | 'di' | 'b3a' | 'b3x';
/** How the result is known: spec.pnl prices | prices_div_exit (an estimate) | typed */
export type ModoResultado = 'exato' | 'estimativa' | 'digitado';
/** «Stop e alvo, em pontos / pips / preço», «Stop e alvo do prêmio» */
export type UnidadeStop = 'pts' | 'pips' | 'preco' | 'premio';

export interface QuantidadeForma {
  tipo: 'contratos' | 'contratosB3' | 'lotes' | 'acoes' | 'acoesB3' | 'moeda' | 'unidades';
  /** «Contratos» «Lotes» «Ações» «Quantidade, em BTC» «Quantidade» */
  rotulo: string;
  /** Chip values as decimal text (['1','2','3'] · ['1','2','3','5','10'] · ['0.01','0.1','0.5','1']); null = a field only */
  chips: readonly string[] | null;
  /** «Quantos contratos?» «Quantos lotes?»; null without chips */
  outroRotulo: string | null;
  /** Whole numbers only */
  inteira: boolean;
  /** Decimals accepted (0 when whole) */
  casas: number;
  /** The "only numbers" error's example: «4» «0,25» «100» */
  exemplo: string;
  /** «2 ct» «0,50 lote» «2,00 lotes» «1 ação» «300 ações» «0,25 BTC» «100 un.» (decimal text in) */
  sufixo: (q: string) => string;
  /** A B3 catalog stock typed without «F»: the note under the field when the quantity is not a multiple of 100 */
  lote100: boolean;
}

export interface FormaAtivo {
  tipo: TipoAtivo;
  /** As registered (trades.symbol): 'BTC/USDT', 'SPY', 'WINZ26', 'EUR/USD' */
  simbolo: string;
  /** spec.key: the match key (WINZ26 → WIN, MESZ6 → MES, EUR/USD → EURUSD) */
  raiz: string;
  spec: InstrumentSpec;
  modo: ModoResultado;
  unidadeStop: UnidadeStop;
  /** Decimals a price is shown with at least (RO `pd`) */
  casasMostra: number;
  /** Decimals a typed price may have when no tick decides (spec.priceDp); null when the tick decides */
  casasMax: number | null;
  /** RO `ponto`: a single dot is always the decimal mark (lerNumero { ponto: true }) */
  pontoDecimal: boolean;
  /** The "only numbers" error's example (RO `exNum`) */
  exemplo: string;
  quantidade: QuantidadeForma;
  /** How a price difference is written (RO `difTxt`) */
  diferenca: 'ptsFut' | 'pts' | 'pips' | 'acao' | 'premio' | 'moeda' | 'preco';
  /** The tick as the error texts write it: futures «0,25» «0,01» (2 decimals); B3 futures «5» «0,5»; null without a tick */
  tickTexto: string | null;
  /** «O WIN anda de 5 em 5»: the name the tick texts use (the root: WINZ26 → WIN) */
  nomePasso: string;
  /** Crypto: the coin («BTC»; «ETH» of a pair such as ETH/BTC); null elsewhere */
  moedaBase: string | null;
  /** Crypto: the quote when it is one of «Cotada em» («USDT», «R$»); null elsewhere and for ETH/BTC */
  cotacao: Cotacao | null;
  /**
   * Crypto: the quote as the price labels write it («USDT», «R$», and «BTC» of ETH/BTC, a pair whose
   * quote is none of «Cotada em»: typed, without a position line, N); null elsewhere
   */
  moedaCotacao: string | null;
}


/** A whole or decimal quantity the pt-BR way, without trailing zeros («0,25», «300») */
const qtdTexto = (q: string, casas: number) => formatDecimal(q, { minDecimals: casas });

const plain = (q: string) => (q.includes('.') ? q.replace(/0+$/, '').replace(/\.$/, '') : q);

function quantidadeDe(tipo: QuantidadeForma['tipo'], coin: string | null, lote100: boolean): QuantidadeForma {
  switch (tipo) {
    case 'contratos':
    case 'contratosB3':
      return {
        tipo,
        rotulo: QTD.contratos,
        chips: tipo === 'contratos' ? CONTRACT_CHIPS : B3_CONTRACT_CHIPS,
        outroRotulo: QTD.quantosContratos,
        inteira: true,
        casas: 0,
        exemplo: '4',
        sufixo: (q) => `${formatDecimal(plain(q))} ${QTD.sufixo.ct}`,
        lote100: false,
      };
    case 'lotes':
      return {
        tipo,
        rotulo: QTD.lotes,
        chips: LOT_CHIPS,
        outroRotulo: QTD.quantosLotes,
        inteira: false,
        casas: 2,
        exemplo: '0,25',
        sufixo: (q) => `${qtdTexto(plain(q), 2)} ${Number(q) >= 2 ? QTD.sufixo.lotes : QTD.sufixo.lote}`,
        lote100: false,
      };
    case 'acoes':
    case 'acoesB3':
      return {
        tipo,
        rotulo: QTD.acoes,
        chips: null,
        outroRotulo: null,
        inteira: tipo === 'acoesB3',
        casas: tipo === 'acoesB3' ? 0 : 6,
        exemplo: '100',
        sufixo: (q) => `${formatDecimal(plain(q))} ${Number(q) === 1 ? QTD.sufixo.acao : QTD.sufixo.acoes}`,
        lote100,
      };
    case 'moeda':
      return {
        tipo,
        rotulo: QTD.emMoeda(coin ?? ''),
        chips: null,
        outroRotulo: null,
        inteira: false,
        casas: 8,
        exemplo: '0,25',
        sufixo: (q) => `${formatDecimal(plain(q))} ${coin ?? ''}`.trim(),
        lote100: false,
      };
    case 'unidades':
    default:
      return {
        tipo: 'unidades',
        rotulo: QTD.quantidade,
        chips: null,
        outroRotulo: null,
        inteira: true,
        casas: 0,
        exemplo: '100',
        sufixo: (q) => `${formatDecimal(plain(q))} ${QTD.sufixo.un}`,
        lote100: false,
      };
  }
}

/** A stand-in contract: an option's spec depends only on its multiplier (never sent by the form) */
const CONTRATO_QUALQUER: OptionContract = { right: 'call', strike: '1', expires_on: '2000-01-01' };

const B3_FUT = ['WIN', 'IND', 'WDO', 'DOL'];

/**
 * The symbol the form registers: crypto joins the coin and the quote («BTC» + «USDT» → BTC/USDT,
 * «R$» → BTC/BRL); everything else is the code, upper case, without spaces at the ends.
 */
export function simboloRegistrado(market: AccountMarket, ativo: string, cotacao: Cotacao | null = null): string {
  const a = String(ativo ?? '').trim().toUpperCase();
  if (market !== 'crypto' || !a || a.includes('/')) return a;
  return `${a}/${cotacao === 'R$' ? 'BRL' : cotacao ?? 'USDT'}`;
}

/** A stored symbol as the form's instrument: crypto «BTC/USDT» → BTC + USDT (BTCUSDT too); others as is */
export function ativoDoSimbolo(market: AccountMarket, symbol: string): { ativo: string; cotacao: Cotacao | null } {
  if (market === 'crypto') return cotacaoDoSimbolo(symbol);
  return { ativo: String(symbol ?? '').trim().toUpperCase(), cotacao: null };
}

/**
 * A crypto symbol as its two coins: «BTC/USDT» → BTC quoted in USDT; «ETH/BTC» (a quote none of
 * «Cotada em», kept whole by ativoDoSimbolo) → ETH quoted in BTC, `cotacao` null
 */
function moedasDoPar(registrado: string): { ativo: string; cotacao: Cotacao | null; moeda: string | null } {
  const c = cotacaoDoSimbolo(registrado);
  if (c.cotacao) return { ...c, moeda: c.cotacao };
  const slash = c.ativo.indexOf('/');
  if (slash > 0 && slash < c.ativo.length - 1) return { ativo: c.ativo.slice(0, slash).trim(), cotacao: null, moeda: c.ativo.slice(slash + 1).trim() };
  return { ...c, moeda: null };
}

/**
 * What one instrument's form looks like (the board's `specDe`), from its descriptors. `simbolo` is
 * the code typed or chosen (crypto: the coin, with `o.cotacao`, or a whole pair); `o.opcao` turns a
 * stock into its listed option (always on an `options` account). Null for an empty symbol, a binary
 * account or an unknown market.
 */
export function formaDoAtivo(market: AccountMarket, simbolo: string, o: { opcao?: boolean; cotacao?: Cotacao | null } = {}): FormaAtivo | null {
  if (market === 'binary') return null;
  const opcao = market === 'options' || (market === 'stocks' && !!o.opcao);
  const registrado = simboloRegistrado(market, simbolo, o.cotacao ?? null);
  if (!registrado) return null;
  const spec = tradeInstrument(market, registrado, opcao ? CONTRATO_QUALQUER : null);
  if (!spec) return null;
  const key = spec.key;
  const modo: ModoResultado = spec.pnl === 'prices' ? 'exato' : spec.pnl === 'prices_div_exit' ? 'estimativa' : 'digitado';
  const unidadeStop: UnidadeStop = opcao ? 'premio' : spec.stops === 'pts' ? 'pts' : spec.stops === 'pips' ? 'pips' : 'preco';
  const casasMax = spec.tick !== null ? null : spec.priceDp;
  const coin = market === 'crypto' ? moedasDoPar(registrado) : null;
  const base = {
    simbolo: registrado,
    raiz: key,
    spec,
    modo,
    unidadeStop,
    casasMax,
    nomePasso: key,
    moedaBase: coin ? coin.ativo : null,
    cotacao: coin ? coin.cotacao : null,
    moedaCotacao: coin ? coin.moeda : null,
  };
  const tick = spec.tick;
  switch (market) {
    case 'futures':
      return spec.known
        ? { ...base, tipo: 'fut', casasMostra: 2, pontoDecimal: false, exemplo: '7.896,25', quantidade: quantidadeDe('contratos', null, false), diferenca: 'ptsFut', tickTexto: tick ? formatDecimal(tick, { minDecimals: 2 }) : null }
        : { ...base, tipo: 'futx', casasMostra: 2, pontoDecimal: false, exemplo: '110,50', quantidade: quantidadeDe('contratos', null, false), diferenca: 'preco', tickTexto: null };
    case 'forex': {
      const q = quantidadeDe('lotes', null, false);
      if (spec.stops === 'pips') {
        const jpy = key.endsWith('JPY');
        return { ...base, tipo: 'fx', casasMostra: jpy ? 3 : 5, pontoDecimal: true, exemplo: jpy ? '151,240' : '1,08520', quantidade: q, diferenca: 'pips', tickTexto: null };
      }
      if (key === 'USDINR') return { ...base, tipo: 'fx', casasMostra: 4, pontoDecimal: true, exemplo: '88,1250', quantidade: q, diferenca: 'preco', tickTexto: null };
      if (key === 'USDKRW') return { ...base, tipo: 'fx', casasMostra: 2, pontoDecimal: false, exemplo: '1.385,50', quantidade: q, diferenca: 'preco', tickTexto: null };
      return { ...base, tipo: 'fx', casasMostra: 2, pontoDecimal: false, exemplo: '4.409,80', quantidade: q, diferenca: 'preco', tickTexto: null };
    }
    case 'stocks':
    case 'options':
      return opcao
        ? { ...base, tipo: 'opcao', casasMostra: 2, pontoDecimal: true, exemplo: '1,85', quantidade: quantidadeDe('contratos', null, false), diferenca: 'premio', tickTexto: null }
        : { ...base, tipo: 'acao', casasMostra: 2, pontoDecimal: true, exemplo: '231,40', quantidade: quantidadeDe('acoes', null, false), diferenca: 'acao', tickTexto: null };
    case 'crypto':
      return { ...base, tipo: 'cri', casasMostra: 0, pontoDecimal: false, exemplo: '112.400', quantidade: quantidadeDe('moeda', coin?.ativo ?? null, false), diferenca: 'moeda', tickTexto: null };
    case 'b3': {
      if (B3_FUT.includes(key)) {
        const casas = key === 'WDO' || key === 'DOL' ? 1 : 0;
        return { ...base, tipo: 'b3f', casasMostra: casas, pontoDecimal: false, exemplo: '131.250', quantidade: quantidadeDe('contratosB3', null, false), diferenca: 'pts', tickTexto: tick ? formatDecimal(tick) : null };
      }
      if (key === 'DI1') return { ...base, tipo: 'di', casasMostra: 3, pontoDecimal: false, exemplo: '14,250', quantidade: quantidadeDe('contratosB3', null, false), diferenca: 'preco', tickTexto: null };
      if (spec.known) {
        const lote100 = !/F$/.test(registrado);
        return { ...base, tipo: 'b3a', casasMostra: 2, pontoDecimal: false, exemplo: '38,42', quantidade: quantidadeDe('acoesB3', null, lote100), diferenca: 'acao', tickTexto: null };
      }
      return { ...base, tipo: 'b3x', casasMostra: 2, pontoDecimal: false, exemplo: '131.250', quantidade: quantidadeDe('unidades', null, false), diferenca: 'preco', tickTexto: null };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// «Buscar ativo / par / moeda» and the chips
// ---------------------------------------------------------------------------------------------

/** Upper-case letters and digits only (the board's `norm`) */
const norm = (s: string) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** «Usar “X”»: 1–20 of A–Z 0–9 . / space - , starting with a letter or a digit (the server's symbol start) */
const USAVEL = /^[A-Z0-9][A-Z0-9./ -]{0,19}$/;

/** The list a market's search goes over (stocks: the 670; with «Opção» also the index options) */
export function catalogoDe(market: AccountMarket, o: { opcao?: boolean } = {}): readonly string[] {
  switch (market) {
    case 'futures':
      return FUTUROS_CATALOGO;
    case 'forex':
      return FOREX_CATALOGO;
    case 'stocks':
      return o.opcao ? [...ACOES_EUA, ...INDICES_OPCOES] : ACOES_EUA;
    case 'options':
      return [...ACOES_EUA, ...INDICES_OPCOES];
    case 'crypto':
      return CRIPTO_CATALOGO;
    case 'b3':
      return CATALOGO.b3;
    default:
      return [];
  }
}

export const MAX_RESULTADOS = 6;

/**
 * The search (RO l.1084–1090): up to six codes of the market's catalog, in its order, whose code
 * (letters and digits only) contains what was typed; on the B3 a former code finds the current one
 * (ELET3 → AXIA3). `usar`: the typed code, when nothing of the catalog matches and it can be a
 * symbol («Usar “XAUUSD”»). Crypto «X/Y» is offered whole; ativoDoSimbolo splits it.
 */
export function buscarAtivos(market: AccountMarket, consulta: string, o: { opcao?: boolean } = {}): { resultados: string[]; usar: string | null } {
  const q = norm(consulta);
  if (!q) return { resultados: [], usar: null };
  const lista = catalogoDe(market, o);
  const aliasHits = market === 'b3' ? new Set(Object.entries(ALIASES_B3).filter(([old]) => old.includes(q)).map(([, now]) => now as string)) : new Set<string>();
  const resultados: string[] = [];
  for (const code of lista) {
    if (norm(code).includes(q) || aliasHits.has(code)) resultados.push(code);
    if (resultados.length === MAX_RESULTADOS) break;
  }
  const typed = String(consulta ?? '').trim().toUpperCase();
  const usar = resultados.length === 0 && USAVEL.test(typed) ? typed : null;
  return { resultados, usar };
}

/** The screen reader's line for the results (sr-only, polite) */
export function statusBusca(consulta: string, resultados: readonly string[]): string {
  if (!norm(consulta)) return '';
  return resultados.length ? ATIVO.status(resultados.length) : ATIVO.nenhum;
}

/**
 * The instrument chips (RO l.1079–1080): futures FUTURES_CHIPS; B3 WIN WDO IND DOL; forex, stocks,
 * options and crypto the account's last five of that kind, else the board's examples; the
 * instrument in use appended when it is not among them.
 */
export function chipsDoAtivo(market: AccountMarket, padroes: RegistrarDefaults | null, o: { opcao?: boolean; atual?: string | null } = {}): string[] {
  let base: readonly string[];
  if (market === 'futures') base = FUTURES_CHIPS;
  else if (market === 'b3') base = B3_CHIPS;
  else if (market === 'forex') base = padroes?.simbolos?.length ? padroes.simbolos : EXEMPLOS_ATIVO.forex;
  else if (market === 'crypto') base = padroes?.simbolos?.length ? padroes.simbolos : EXEMPLOS_ATIVO.crypto;
  else if (market === 'stocks' && !o.opcao) base = padroes?.simbolos?.length ? padroes.simbolos : EXEMPLOS_ATIVO.acao;
  else if (market === 'stocks' || market === 'options') base = padroes?.simbolosOpcao?.length ? padroes.simbolosOpcao : EXEMPLOS_ATIVO.opcao;
  else base = [];
  const out = [...base];
  const atual = o.atual ? o.atual.trim().toUpperCase() : null;
  if (atual && !out.includes(atual)) out.push(atual);
  return out;
}

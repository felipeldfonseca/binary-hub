/**
 * Pure helpers of Personalizar «Suas regras» (Fase 2b, lane B): which entities «Regras de» offers,
 * in what order, and which markets get the ⓘ that explains their rules. The words are in
 * components/hub/personalizar/copy.ts; what each market has (block, states, soma, «Padrão») is
 * MARKET_SPEC in lib/domain/markets.
 */
import type { AccountMarket, Currency } from '@/lib/domain/markets';
import { groupByMarket } from './contas';
import { SIMBOLO_MOEDA } from './formato';
import { parseUsdText, type AccountConfig, type UsdTextResult } from './regras';
import { PADRAO_FUTUROS } from './rascunho';

/**
 * «Regras de» pills (board `opcoesR`): «Padrão Futuros» (with an active futures account), then every
 * active account grouped by market in ACCOUNT_MARKETS order (Futuros, binárias, Forex, Ações, Cripto,
 * B3, options), list order inside a market.
 */
export function entidadesRegrasDe(ativas: readonly AccountConfig[]): string[] {
  const grupos = groupByMarket(ativas);
  const padrao = grupos.some((g) => g.market === 'futures') ? [PADRAO_FUTUROS] : [];
  return [...padrao, ...grupos.flatMap((g) => g.accounts.map((a) => a.id))];
}

/**
 * The markets opened in Fase 2b (board `mkNovo`: every market but Futuros and binárias): their rules
 * are the window and the daily limit, and an ⓘ next to the account's chip says why, in the account's
 * money and day. Futures and binaries keep the Phase 2 board, which has no such ⓘ.
 */
export const temInfoDoMercado = (m: AccountMarket): boolean => m !== 'futures' && m !== 'binary';

/** A money symbol typed at the start of an amount, as parseUsdText drops it: «US$» or «R$», any case */
const SIMBOLO_DIGITADO = /^\s*(US|R)\$/i;

/**
 * The «Limite do dia» field of an account: parseUsdText, except that a symbol of the other currency
 * is refused («Use só números…»). parseUsdText drops «US$» and «R$» alike, so «US$ 500» typed on a B3
 * account would otherwise be saved as R$ 500 without a word.
 */
export function lerLimite(texto: string, moeda: Currency): UsdTextResult {
  const m = SIMBOLO_DIGITADO.exec(texto ?? '');
  if (m && `${m[1].toUpperCase()}$` !== SIMBOLO_MOEDA[moeda]) return { ok: false, reason: 'invalid' };
  return parseUsdText(texto);
}

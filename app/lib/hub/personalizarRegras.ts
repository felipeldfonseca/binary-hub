/**
 * Pure helpers of Personalizar «Suas regras» (Fase 2b, lane B): which entities «Regras de» offers,
 * in what order, and which markets get the ⓘ that explains their rules. The words are in
 * components/hub/personalizar/copy.ts; what each market has (block, states, soma, «Padrão») is
 * MARKET_SPEC in lib/domain/markets.
 */
import type { AccountMarket } from '@/lib/domain/markets';
import { groupByMarket } from './contas';
import type { AccountConfig } from './regras';
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

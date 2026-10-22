/**
 * Where a file goes once the destination account is known (Phase 3b, R5; «Para qual conta?» comes
 * first when no account is in context). detectPlatform itself is unchanged: it still calls a
 * header with half of a reader's names «missing_columns», which would leave a generic
 * closed-position export (8 of Top One's 14 names) at «Faltam colunas…» forever, even in a Forex
 * account. So:
 *
 *   reader        every name of Ebinex or Top One found once: the reader reads it (a file of
 *                 another market than the account's goes through step g, as built)
 *   reader_error  a broken match that stays the reader's error («Faltam colunas…», «O cabeçalho tem
 *                 colunas repetidas.»): the account is in that reader's market (binaries for
 *                 Ebinex, futures for Top One) and the match is near-complete, at most two names
 *                 missing (Top One 12 of 14, Ebinex 11 of 13) or every name found with one
 *                 repeated. Mapped, its tickets would never meet the reader's earlier imports
 *   mapping       any other file, in a market that imports by columns: «mapa»
 *   binary_error  any other file in a binaries account: «Em contas de binárias, lemos só o CSV da
 *                 Ebinex.»
 */
import { MARKET_SPEC, type AccountMarket } from '../markets';
import { bestReaderMatch, detectPlatform } from './detect';
import { PLATFORM_MARKET } from './types';

export type FileRoute = 'reader' | 'reader_error' | 'mapping' | 'binary_error';

/** At most this many of a reader's names missing still reads as that reader's broken file */
export const NEAR_COMPLETE_MISSING = 2;

export function routeFile(header: string[], market: AccountMarket): FileRoute {
  if (detectPlatform(header).platform !== null) return 'reader';
  const best = bestReaderMatch(header);
  const half = best.found * 2 >= best.total;
  const nearComplete =
    (best.repeated === 0 && best.missing.length <= NEAR_COMPLETE_MISSING) || (best.missing.length === 0 && best.repeated === 1);
  if (half && nearComplete && PLATFORM_MARKET[best.platform] === market) return 'reader_error';
  return MARKET_SPEC[market].mapping ? 'mapping' : 'binary_error';
}

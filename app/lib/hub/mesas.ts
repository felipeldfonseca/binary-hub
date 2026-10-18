/**
 * Prop firms («mesas») offered in «Onde você opera?» and suggested in Editar conta. A static list:
 * names and platforms were read by hand on propfirmmatch.com on PROP_FIRMS_CHECKED and are
 * refreshed every quarter. No scores, review counts, favourite counts, logos or rankings from the
 * site are kept here or shown in the app (its terms allow only personal, non-commercial use of its
 * content), and the site is never fetched.
 *
 * An account stores the firm's name as text (trading_accounts.firm), never an id: a firm that
 * leaves this list only stops being suggested, and the accounts keep it.
 */
import type { Platform } from '@/lib/domain/import';
import { PLATFORMS, type AccountMarket } from './contas';

export interface PropFirm {
  /** Stable key, never reused: the name in kebab-case */
  id: string;
  /** As the firm writes it (the site's «NEW» badge dropped); exactly what trading_accounts.firm stores (≤ FIRM_MAX) */
  name: string;
  /** One entry per (market, name): a brand can have another name in another market */
  market: AccountMarket;
  /** Keys of PLATFORMS[market] the firm offers, in that list's order; platforms without an app key are left out */
  platforms: readonly string[];
  /** Shown before the trader types (the rule is next to PROP_FIRMS_CHECKED) */
  featured?: boolean;
  /** Extra search terms. Ours, not the site's */
  aliases?: readonly string[];
}

/**
 * The day the list was read on propfirmmatch.com (futures: the «All» tab after «View More», each
 * firm's «Platform:» line, and the verified-reviews ranking). Refresh it by hand every quarter
 * (January, April, July, October; the next one is due in January 2027), and out of cycle when a
 * featured firm shows up in the site's delisted or «Out of Operation» list. The steps: read the
 * «All» tab and the reviews ranking, check the delisted list, re-check the featured firms'
 * platforms, then update PROP_FIRMS, the `featured` flags and this date.
 *
 * Featured rule (futures): a score of 4.0 or more AND at least 50 verified reviews on that day (50
 * is the site's own default filter on its reviews page), plus Apex Trader Funding, added by the
 * owner's choice. Repeat the same rule on each refresh; the scores themselves are never written
 * down here.
 */
export const PROP_FIRMS_CHECKED = '2026-10-18';

/** At most this many firms answer a search */
export const FIRM_MATCHES_MAX = 8;

/** Markets whose accounts have a «Mesa»: futures today; Forex and Cripto join with Phase 2b. */
export const FIRM_MARKETS: readonly AccountMarket[] = ['futures'];

export const hasFirms = (market: AccountMarket | null | undefined): boolean => !!market && FIRM_MARKETS.includes(market);

/**
 * The 25 firms of the site's futures list, Trade The Pool left out (stocks only: it belongs with
 * a stocks market). Platform keys come from each firm's «Platform:» line: R Trader and R Trader
 * Pro count as `rithmic`, BlackArrow Pro as `blackarrow`.
 */
export const PROP_FIRMS: readonly PropFirm[] = [
  {
    id: 'apex-trader-funding',
    name: 'Apex Trader Funding',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'],
    // Featured by the owner's choice, not by the rule
    featured: true,
    aliases: ['Apex'],
  },
  { id: 'aquafunded-futures', name: 'AquaFunded Futures', market: 'futures', platforms: ['tradovate'] },
  {
    id: 'blue-guardian-futures',
    name: 'Blue Guardian Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'tradingview'],
    featured: true,
  },
  { id: 'blueberry-futures', name: 'Blueberry Futures', market: 'futures', platforms: ['blackarrow'] },
  { id: 'daytraders', name: 'DayTraders', market: 'futures', platforms: ['rithmic', 'quantower'] },
  { id: 'e8-futures', name: 'E8 Futures', market: 'futures', platforms: ['tradovate', 'tradingview'] },
  {
    id: 'earn2trade',
    name: 'Earn2Trade',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'blackarrow'],
    aliases: ['E2T'],
  },
  {
    id: 'finotive-futures',
    name: 'Finotive Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'quantower', 'tradingview'],
  },
  { id: 'ftmo-futures', name: 'FTMO Futures', market: 'futures', platforms: ['tradovate', 'ninja', 'tradingview'] },
  {
    id: 'funded-futures-family',
    name: 'Funded Futures Family',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'tradingview', 'wealthcharts'],
    aliases: ['FFF'],
  },
  {
    id: 'fundednext-futures',
    name: 'FundedNext Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'tradingview'],
    featured: true,
  },
  {
    id: 'futureselite',
    name: 'FuturesElite',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'quantower', 'wealthcharts'],
  },
  {
    id: 'goat-funded-futures',
    name: 'Goat Funded Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'quantower', 'tradingview'],
  },
  {
    id: 'hola-prime-futures',
    name: 'Hola Prime Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'tradingview', 'wealthcharts'],
  },
  {
    id: 'lucid-trading',
    name: 'Lucid Trading',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'],
    featured: true,
  },
  {
    id: 'my-funded-futures',
    name: 'My Funded Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'quantower', 'tradingview'],
    featured: true,
    aliases: ['MFF'],
  },
  {
    id: 'take-profit-trader',
    name: 'Take Profit Trader',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'],
    aliases: ['TPT'],
  },
  {
    id: 'the-trading-pit-futures',
    name: 'The Trading Pit Futures',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'],
  },
  { id: 'the5ers-futures', name: 'The5ers Futures', market: 'futures', platforms: ['blackarrow'] },
  {
    id: 'top-one-futures',
    name: 'Top One Futures',
    market: 'futures',
    platforms: ['tradovate', 'ninja', 'tradingview', 'blackarrow', 'wealthcharts'],
    featured: true,
  },
  { id: 'topstep', name: 'Topstep', market: 'futures', platforms: ['topstepx'], featured: true },
  {
    id: 'tradeday',
    name: 'TradeDay',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'],
  },
  {
    id: 'tradeify',
    name: 'Tradeify',
    market: 'futures',
    platforms: ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'],
    featured: true,
  },
  { id: 'traders-launch', name: 'Traders Launch', market: 'futures', platforms: ['quantower', 'tradingview'], featured: true },
  { id: 'ylos-trading', name: 'Ylos Trading', market: 'futures', platforms: ['blackarrow'] },
];

/** Search form of a text: lower case, no accents, single spaces ('  Tóp ONE ' → 'top one'). */
export function foldSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Letters and digits only, so 'topone' finds «Top One Futures» and 'the 5ers' «The5ers Futures». */
const compact = (folded: string) => folded.replace(/[^a-z0-9]/g, '');

const byName = (a: PropFirm, b: PropFirm) => a.name.localeCompare(b.name, 'pt-BR');

/**
 * How well a firm answers a folded query: 0 when its name or an alias starts a word with it,
 * 1 when the query is anywhere inside, null when it does not match.
 */
function matchRank(firm: PropFirm, query: string): 0 | 1 | null {
  const terms = [firm.name, ...(firm.aliases ?? [])].map(foldSearch);
  const q = compact(query);
  if (terms.some((t) => (' ' + t).includes(' ' + query) || (q !== '' && compact(t).startsWith(q)))) return 0;
  if (terms.some((t) => t.includes(query) || (q !== '' && compact(t).includes(q)))) return 1;
  return null;
}

/**
 * The firm pills of «Onde você opera?». With no query, the featured firms of the market, in
 * alphabetical order (pt-BR). With a query, every firm of the market whose name or alias holds
 * it, case and accents ignored: those where it starts a word first, then alphabetical, at most
 * FIRM_MATCHES_MAX.
 */
export function firmsFor(market: AccountMarket, query: string): readonly PropFirm[] {
  const inMarket = PROP_FIRMS.filter((f) => f.market === market);
  const q = foldSearch(query);
  if (!q) return inMarket.filter((f) => f.featured).sort(byName);
  return inMarket
    .map((firm) => ({ firm, rank: matchRank(firm, q) }))
    .filter((m): m is { firm: PropFirm; rank: 0 | 1 } => m.rank !== null)
    .sort((a, b) => a.rank - b.rank || byName(a.firm, b.firm))
    .slice(0, FIRM_MATCHES_MAX)
    .map((m) => m.firm);
}

/** Every firm name of a market, alphabetical (Editar conta's suggestions). */
export function firmNames(market: AccountMarket): string[] {
  return PROP_FIRMS.filter((f) => f.market === market)
    .sort(byName)
    .map((f) => f.name);
}

/** The listed firm with this name (case and accents ignored), or null for a name typed freely. */
export function firmByName(market: AccountMarket, name: string | null | undefined): PropFirm | null {
  const folded = foldSearch(name ?? '');
  if (!folded) return null;
  return PROP_FIRMS.find((f) => f.market === market && foldSearch(f.name) === folded) ?? null;
}

/**
 * The platform pills of a market with the firm's platforms first, each part in the boards'
 * order. Nothing is hidden (the list can be stale) and the last pill («Não sei», «Outra») stays last.
 */
export function platformsFor(market: AccountMarket, firm: PropFirm | null): readonly string[] {
  const list = PLATFORMS[market];
  if (!firm || firm.market !== market) return list;
  const last = list[list.length - 1];
  const rest = list.slice(0, -1);
  return [...rest.filter((k) => firm.platforms.includes(k)), ...rest.filter((k) => !firm.platforms.includes(k)), last];
}

/** The platform a firm is known to offer when it offers exactly one (Topstep → TopstepX), else null. */
export const onlyPlatform = (firm: PropFirm): string | null => (firm.platforms.length === 1 ? firm.platforms[0] : null);

/**
 * The firm a new account starts with when it is created from a file of this format: the Top One
 * «Trade History» file → «Top One Futures». Only a suggestion, shown in step b with «Tirar» and
 * editable later in Editar conta: the reader recognises the file by its columns, not by the firm,
 * and whether another firm's dashboard exports the same columns is unverified.
 */
export function firmOfFile(platform: Platform): string | null {
  return platform === 'topone' ? 'Top One Futures' : null;
}

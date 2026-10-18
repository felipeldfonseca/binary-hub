/**
 * Prop firms («mesas») offered in «Onde você opera?» and suggested in Editar conta, per market: 25
 * futures firms, 39 forex, 9 crypto, 1 for stocks (B3 has none: the firm is free text). A static
 * list: names and platforms were read by hand on propfirmmatch.com on PROP_FIRMS_CHECKED and are
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
  /**
   * Stable key, never reused: the name in kebab-case; when another market already uses it, `-` and
   * the market ('brightfunded-crypto')
   */
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
  /**
   * The firm also offers platforms with no key in this market (the trader picks «Outra»), so
   * onlyPlatform() never guesses. Never shown. Set only on forex, crypto and stocks firms: futures
   * entries keep Phase 2's preselection (Topstep → TopstepX)
   */
  otherPlatforms?: boolean;
}

/**
 * The day every list was read on propfirmmatch.com (split it per market only when one list is
 * refreshed on another day). Sources: futures, the «All» tab after «View More», each firm's
 * «Platform:» line, and the verified-reviews ranking; forex, the Forex/CFD «All» tab after one
 * «View More» (39 firms) and each firm page's «Platform:» line; crypto, the crypto «All» tab (9
 * firms) and each firm page's «Platform:» line; stocks, Trade The Pool's page, which sits in the
 * futures list. Refresh by hand every quarter (January, April, July, October; the next one is due
 * in January 2027), and out of cycle when a featured firm shows up in the site's delisted or «Out
 * of Operation» list. The steps: read the «All» tabs and the reviews ranking, check the delisted
 * lists, re-check the featured firms' platforms, then update PROP_FIRMS, the `featured` flags and
 * this date.
 *
 * Platform mapping: R Trader and R Trader Pro count as `rithmic`, BlackArrow Pro as `blackarrow`;
 * «Match Trader» and «CFT Platform (MatchTrader)» as `matchtrader`; «DXTrade» and «BrightFunded
 * Platform (DxTrade)» as `dxtrade`. The crypto pages' «Exchange:» line (a price or liquidity
 * source) and the «Broker:» lines are not mapped. A platform with no key is left out, and the firm
 * gets `otherPlatforms` (forex, crypto and stocks only).
 *
 * Featured rules, repeated on each refresh (the scores themselves are never written down here):
 * - futures: a score of 4.0 or more AND at least 50 verified reviews on that day (50 is the site's
 *   own default filter on its reviews page), plus Apex Trader Funding, added by the owner's choice
 *   (9 firms);
 * - forex: the score as the site displays it (one decimal) of 4.4 or more AND at least 100 verified
 *   reviews (10 firms; FundedElite is featured only because the displayed score is the one read);
 * - crypto and stocks: none featured, search only;
 * - B3: no list, the firm is free text.
 */
export const PROP_FIRMS_CHECKED = '2026-10-18';

/** At most this many firms answer a search */
export const FIRM_MATCHES_MAX = 8;

/**
 * Markets whose accounts have a «Mesa»: futures today. The Fase 2b account screens (lane A) add
 * forex, crypto, stocks and b3 (b3 with an empty list: the firm is free text) together with the
 * required «Fase»; the lists below are already in place.
 */
export const FIRM_MARKETS: readonly AccountMarket[] = ['futures'];

export const hasFirms = (market: AccountMarket | null | undefined): boolean => !!market && FIRM_MARKETS.includes(market);

/**
 * Futures: the 25 firms of the site's futures list, Trade The Pool left out (stocks only: it is the
 * stocks entry). Then forex, crypto and stocks (see PROP_FIRMS_CHECKED for the sources and the
 * platform mapping). One entry per (market, name).
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
  // forex: the 39 firms of the Forex/CFD list (10 featured), alphabetical
  {
    id: 'alpha-capital',
    name: 'Alpha Capital',
    market: 'forex',
    platforms: ['mt5', 'ctrader', 'tradelocker', 'dxtrade'],
    featured: true,
    aliases: ['Alpha Capital Group', 'ACG'],
  },
  {
    id: 'aquafunded',
    name: 'AquaFunded',
    market: 'forex',
    platforms: ['mt5', 'ctrader', 'matchtrader', 'tradelocker'],
    featured: true,
  },
  { id: 'atmos-funded', name: 'Atmos Funded', market: 'forex', platforms: ['mt5'] },
  { id: 'audacity-capital', name: 'Audacity Capital', market: 'forex', platforms: ['mt5', 'dxtrade'] },
  { id: 'axi-select', name: 'Axi Select', market: 'forex', platforms: ['mt5', 'mt4'] },
  { id: 'bem-funding', name: 'BEM Funding', market: 'forex', platforms: ['mt5', 'ctrader'] },
  { id: 'blue-guardian', name: 'Blue Guardian', market: 'forex', platforms: ['mt5', 'matchtrader', 'tradelocker'] },
  { id: 'blueberry-funded', name: 'Blueberry Funded', market: 'forex', platforms: ['mt5', 'tradelocker'] },
  { id: 'brightfunded', name: 'BrightFunded', market: 'forex', platforms: ['mt5', 'ctrader', 'dxtrade'], featured: true },
  {
    id: 'city-traders-imperium',
    name: 'City Traders Imperium',
    market: 'forex',
    platforms: ['mt5', 'matchtrader'],
    aliases: ['CTI'],
  },
  {
    id: 'crypto-fund-trader',
    name: 'Crypto Fund Trader',
    market: 'forex',
    platforms: ['mt5', 'matchtrader'],
    // Bybit has no forex key
    otherPlatforms: true,
    aliases: ['CFT'],
  },
  { id: 'darwinex-zero', name: 'Darwinex Zero', market: 'forex', platforms: ['mt5', 'mt4', 'tradingview'] },
  {
    id: 'e8-markets',
    name: 'E8 Markets',
    market: 'forex',
    platforms: ['mt5', 'ctrader', 'matchtrader', 'tradelocker'],
    featured: true,
  },
  { id: 'finotive-funding', name: 'Finotive Funding', market: 'forex', platforms: ['mt5', 'matchtrader'] },
  { id: 'fintokei', name: 'Fintokei', market: 'forex', platforms: ['mt5', 'mt4', 'ctrader', 'tradingview'] },
  { id: 'for-traders', name: 'For Traders', market: 'forex', platforms: ['mt5', 'ctrader', 'tradelocker'], featured: true },
  { id: 'ftmo', name: 'FTMO', market: 'forex', platforms: ['mt5', 'mt4', 'ctrader', 'tradingview'], featured: true },
  {
    id: 'funded-trading-plus',
    name: 'Funded Trading Plus',
    market: 'forex',
    platforms: ['mt5', 'matchtrader'],
    aliases: ['FTP'],
  },
  { id: 'fundedelite', name: 'FundedElite', market: 'forex', platforms: ['mt5', 'matchtrader'], featured: true },
  { id: 'fundednext', name: 'FundedNext', market: 'forex', platforms: ['mt5', 'mt4', 'ctrader', 'matchtrader'] },
  { id: 'fundingpips', name: 'FundingPips', market: 'forex', platforms: ['mt5', 'ctrader', 'matchtrader'] },
  { id: 'fxify', name: 'FXIFY', market: 'forex', platforms: ['mt5', 'dxtrade', 'tradingview'] },
  {
    id: 'goat-funded-trader',
    name: 'Goat Funded Trader',
    market: 'forex',
    platforms: ['mt5', 'ctrader', 'matchtrader', 'tradelocker'],
    aliases: ['GFT'],
  },
  { id: 'hantec-trader', name: 'Hantec Trader', market: 'forex', platforms: ['mt5', 'mt4'] },
  { id: 'hola-prime', name: 'Hola Prime', market: 'forex', platforms: ['mt5', 'ctrader', 'matchtrader', 'tradelocker'] },
  { id: 'instant-funding', name: 'Instant Funding', market: 'forex', platforms: ['mt5', 'ctrader', 'matchtrader'] },
  { id: 'lark-funding', name: 'Lark Funding', market: 'forex', platforms: ['ctrader', 'matchtrader', 'dxtrade'] },
  { id: 'leveraged', name: 'Leveraged', market: 'forex', platforms: ['mt5', 'ctrader'] },
  { id: 'maven', name: 'Maven', market: 'forex', platforms: ['mt5', 'matchtrader'], aliases: ['Maven Trading'] },
  {
    id: 'ment-funding',
    name: 'Ment Funding',
    market: 'forex',
    platforms: ['ctrader', 'matchtrader', 'dxtrade'],
    // GooeyPro has no key
    otherPlatforms: true,
  },
  { id: 'moneta-funded', name: 'Moneta Funded', market: 'forex', platforms: ['mt5', 'matchtrader'], featured: true },
  {
    id: 'nordic-funder',
    name: 'Nordic Funder',
    market: 'forex',
    platforms: ['ctrader', 'matchtrader', 'dxtrade'],
    // GooeyPro has no key
    otherPlatforms: true,
  },
  { id: 'orion-funded', name: 'Orion Funded', market: 'forex', platforms: ['mt5', 'matchtrader'] },
  { id: 'the-trading-pit', name: 'The Trading Pit', market: 'forex', platforms: ['mt5', 'mt4', 'ctrader'] },
  { id: 'the5ers', name: 'The5ers', market: 'forex', platforms: ['mt5', 'ctrader', 'tradingview'], featured: true },
  // ThinkTrader (ThinkMarkets' own platform) has no key
  { id: 'thinkcapital', name: 'ThinkCapital', market: 'forex', platforms: [], otherPlatforms: true },
  {
    id: 'top-one-trader',
    name: 'Top One Trader',
    market: 'forex',
    platforms: ['mt5', 'matchtrader', 'tradelocker'],
    featured: true,
  },
  { id: 'tradeify-fx', name: 'Tradeify FX', market: 'forex', platforms: ['mt5'] },
  { id: 'wsfunded', name: 'WSFunded', market: 'forex', platforms: ['mt5', 'ctrader', 'matchtrader'] },
  // crypto: the 9 firms of the crypto list, none featured, alphabetical. The site's per-market
  // names are kept («For Traders Crypto», «Leveraged Crypto», «E8 Perpetuals»), as «FTMO Futures»
  // in futures. Each also offers platforms with no crypto key (cTrader, DXtrade, TradeLocker, Match
  // Trader or its own terminal), so none preselects MetaTrader 5
  { id: 'bem-funding-crypto', name: 'BEM Funding', market: 'crypto', platforms: ['mt5'], otherPlatforms: true },
  { id: 'breakout', name: 'Breakout', market: 'crypto', platforms: [], otherPlatforms: true },
  { id: 'brightfunded-crypto', name: 'BrightFunded', market: 'crypto', platforms: ['mt5'], otherPlatforms: true },
  {
    id: 'crypto-fund-trader-crypto',
    name: 'Crypto Fund Trader',
    market: 'crypto',
    platforms: ['bybit', 'mt5'],
    otherPlatforms: true,
    aliases: ['CFT'],
  },
  { id: 'e8-perpetuals', name: 'E8 Perpetuals', market: 'crypto', platforms: [], otherPlatforms: true, aliases: ['E8 Markets'] },
  { id: 'for-traders-crypto', name: 'For Traders Crypto', market: 'crypto', platforms: ['mt5'], otherPlatforms: true },
  { id: 'leveraged-crypto', name: 'Leveraged Crypto', market: 'crypto', platforms: ['mt5'], otherPlatforms: true },
  {
    // As the approved board and the site write it; the firm's own site (tradeify247.co) writes
    // «Tradeify247», kept as an alias. Not the futures firm «Tradeify»
    id: 'tradeify-247',
    name: 'Tradeify 247',
    market: 'crypto',
    platforms: ['mt5'],
    otherPlatforms: true,
    aliases: ['Tradeify247'],
  },
  { id: 'wencrypto', name: 'WenCrypto', market: 'crypto', platforms: [], otherPlatforms: true },
  // stocks: Trade The Pool (in the site's futures list; shares and ETFs only), search only. Its
  // platform, TraderEvolution, has no key; the «Broker: Interactive Brokers» line is the firm's own
  // broker, not an account of the trader, so it is not `ibkr`
  { id: 'trade-the-pool', name: 'Trade The Pool', market: 'stocks', platforms: [], otherPlatforms: true, aliases: ['TTP'] },
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

/**
 * The platform a firm is known to offer when it offers exactly one (Topstep → TopstepX, Atmos
 * Funded → MetaTrader 5), else null; null too when it also offers platforms with no key here.
 */
export const onlyPlatform = (firm: PropFirm): string | null =>
  !firm.otherPlatforms && firm.platforms.length === 1 ? firm.platforms[0] : null;

/**
 * The firm a new account starts with when it is created from a file of this format: the Top One
 * «Trade History» file → «Top One Futures». Only a suggestion, shown in step b with «Tirar» and
 * editable later in Editar conta: the reader recognises the file by its columns, not by the firm,
 * and whether another firm's dashboard exports the same columns is unverified.
 */
export function firmOfFile(platform: Platform): string | null {
  return platform === 'topone' ? 'Top One Futures' : null;
}

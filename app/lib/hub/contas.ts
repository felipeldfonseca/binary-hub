/**
 * Trading accounts as the hub shows them: the row shape, the order they are listed in, which
 * one is "conta atual", the file zones the import offers, and the checks on what the owner types.
 * Pure functions; data access is in contasDb.ts and the pt-BR copy in components/hub/contas/copy.ts.
 */
import { entryHistogram, entrySpan, previewInstant, type ImportMarket, type ImportRow } from '@/lib/domain/import';
import { ACCOUNT_MARKETS, type AccountMarket } from '@/lib/domain/markets';
import { utcToLocal } from '@/lib/domain/tempo';

/**
 * The seven markets, the six offered at creation and the guard: one definition, in
 * lib/domain/markets. What each market is (currency, day clock, rules) is MARKET_SPEC there.
 */
export { CREATABLE_MARKETS, isAccountMarket, type AccountMarket } from '@/lib/domain/markets';
/** Fixed group order: Futuros, Opções binárias, Forex, Ações, Cripto, B3, then options (ACCOUNT_MARKETS) */
export const MARKET_ORDER: readonly AccountMarket[] = ACCOUNT_MARKETS;

export type AccountPhase = 'avaliacao' | 'financiada' | 'pessoal' | 'demo';

/** A row of trading_accounts, with the columns the hub reads. */
export interface TradingAccount {
  id: string;
  market: AccountMarket;
  label: string;
  platform: string | null;
  firm: string | null;
  external_ref: string | null;
  phase: AccountPhase | null;
  /** numeric(14,2); PostgREST sends it as a JSON number */
  size: number | string | null;
  file_tz: string;
  /** Set once the file zone is confirmed; until then file_tz is only a guess */
  tz_applied_at: string | null;
  is_primary: boolean;
  is_example: boolean;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
}

/** The phases offered wherever the market has firms (lib/hub/mesas.ts hasFirms); the name is Phase 1's. */
export const PHASES_FUTURES: readonly AccountPhase[] = ['avaliacao', 'financiada', 'pessoal'];

/**
 * Platform keys offered in "Onde você opera?", in the boards' order (ImportarConta `X.PLAT`). The
 * last one («Não sei», «Outra») always stays. BlackArrow and WealthCharts are not on the board: the
 * owner accepted them on 2026-10-18 (Top One Futures offers both, and three firms of
 * lib/hub/mesas.ts offer only BlackArrow). They are labels only: no reader of their files is
 * implied. `options` is never offered; an existing options account lists the stocks keys.
 */
export const PLATFORMS: Readonly<Record<AccountMarket, readonly string[]>> = {
  futures: ['tradovate', 'rithmic', 'ninja', 'topstepx', 'quantower', 'tradingview', 'blackarrow', 'wealthcharts', 'naosei'],
  binary: ['ebinex', 'pocket', 'iq', 'outra'],
  forex: ['mt5', 'mt4', 'ctrader', 'matchtrader', 'tradelocker', 'dxtrade', 'tradingview', 'outra'],
  stocks: ['ibkr', 'thinkorswim', 'webull', 'tastytrade', 'tradier', 'avenue', 'nomad', 'outra'],
  crypto: ['binance', 'bybit', 'okx', 'coinbase', 'kraken', 'bitget', 'mercadobitcoin', 'mt5', 'outra'],
  b3: ['profit', 'tryd', 'mt5', 'outra'],
  options: ['ibkr', 'thinkorswim', 'webull', 'tastytrade', 'tradier', 'avenue', 'nomad', 'outra'],
};

/** "Não sei" is stored as no platform at all. */
export const PLATFORM_UNKNOWN = 'naosei';

/**
 * The clock the zone step draws its strips on: New York for futures, Brasília for binaries. Only
 * the two file formats (Top One, Ebinex) reach that step. A new account's trading day comes from
 * MARKET_SPEC[market].day (lib/domain/markets); an existing account's is its own.
 */
export const REFERENCE_TZ: Readonly<Record<ImportMarket, string>> = {
  futures: 'America/New_York',
  binary: 'America/Sao_Paulo',
};

export type ZoneKey = 'ny' | 'br' | 'utc' | 'chi' | 'lon';

/** File zones offered by the import ("Outro" holds the last two). */
export const FILE_ZONES: readonly { key: ZoneKey; tz: string }[] = [
  { key: 'ny', tz: 'America/New_York' },
  { key: 'br', tz: 'America/Sao_Paulo' },
  { key: 'utc', tz: 'UTC' },
];
export const OTHER_FILE_ZONES: readonly { key: ZoneKey; tz: string }[] = [
  { key: 'chi', tz: 'America/Chicago' },
  { key: 'lon', tz: 'Europe/London' },
];
export const ALL_FILE_ZONES = [...FILE_ZONES, ...OTHER_FILE_ZONES];

export function zoneKeyOf(tz: string): ZoneKey | null {
  return ALL_FILE_ZONES.find((z) => z.tz === tz)?.key ?? null;
}

export const LABEL_MAX = 24;
export const REF_MAX = 40;
export const FIRM_MAX = 60;

const marketRank = (m: AccountMarket) => {
  const i = MARKET_ORDER.indexOf(m);
  return i < 0 ? MARKET_ORDER.length : i;
};

/** Group order, then sort_order, then creation. */
export function sortAccounts<T extends Pick<TradingAccount, 'market' | 'sort_order' | 'created_at'>>(list: readonly T[]): T[] {
  return list.slice().sort(
    (a, b) =>
      marketRank(a.market) - marketRank(b.market) ||
      a.sort_order - b.sort_order ||
      (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0),
  );
}

/** Accounts the hub lists: never example accounts; archived ones only where asked for. */
export function visibleAccounts(list: readonly TradingAccount[]): { active: TradingAccount[]; archived: TradingAccount[] } {
  const shown = sortAccounts(list.filter((a) => !a.is_example));
  return { active: shown.filter((a) => !a.archived_at), archived: shown.filter((a) => !!a.archived_at) };
}

/** Accounts grouped by market, in group order; empty groups are left out. */
export function groupByMarket<T extends Pick<TradingAccount, 'market'>>(list: readonly T[]): { market: AccountMarket; accounts: T[] }[] {
  const groups: { market: AccountMarket; accounts: T[] }[] = [];
  for (const market of MARKET_ORDER) {
    const accounts = list.filter((a) => a.market === market);
    if (accounts.length > 0) groups.push({ market, accounts });
  }
  return groups;
}

/**
 * The account in context, shared by every hub screen: the `?conta=` in the URL, else the last
 * choice saved in profiles.preferences, else the primary account, else the first active one.
 * `active` must already be sorted and free of archived and example accounts.
 */
export function resolveContaAtual(
  active: readonly TradingAccount[],
  { fromUrl, saved }: { fromUrl?: string | null; saved?: string | null },
): TradingAccount | null {
  const byId = (id?: string | null) => (id ? active.find((a) => a.id === id) ?? null : null);
  return byId(fromUrl) ?? byId(saved) ?? active.find((a) => a.is_primary) ?? active[0] ?? null;
}

/** Whether the file zone of the account has been confirmed (by an import or by the owner). */
export const tzConfirmed = (a: Pick<TradingAccount, 'tz_applied_at'>) => a.tz_applied_at !== null;

const sameLabel = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

/** A nickname in use by another account, archived ones included (the database index covers them all). */
export function labelTaken(label: string, accounts: readonly Pick<TradingAccount, 'id' | 'label'>[], exceptId?: string): boolean {
  return label.trim() !== '' && accounts.some((a) => a.id !== exceptId && sameLabel(a.label, label));
}

/**
 * "Tamanho US$" / "Tamanho R$": digits with optional pt-BR thousand dots and decimal comma ('50.000', '2500',
 * '1.250,50'). Returns the decimal for numeric(14,2), null for an empty field, or 'invalid'.
 */
export function parseSize(text: string): string | null | 'invalid' {
  const t = text.trim();
  if (t === '') return null;
  const m = /^(\d{1,3}(?:\.\d{3})+|\d{1,12})(?:,(\d{1,2}))?$/.exec(t);
  if (!m) return 'invalid';
  const integer = m[1].replace(/\./g, '').replace(/^0+(?=\d)/, '');
  if (integer.length > 12) return 'invalid';
  const value = m[2] ? `${integer}.${m[2].padEnd(2, '0')}` : integer;
  return Number(value) > 0 ? value : 'invalid';
}

/** numeric size → the field's text ('50000' → '50.000', '1250.5' → '1.250,50') */
export function sizeToText(size: number | string | null): string {
  if (size === null || size === '') return '';
  const [integer, fraction] = String(size).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = (fraction ?? '').replace(/0+$/, '');
  return cents ? `${grouped},${cents.padEnd(2, '0')}` : grouped;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * «entradas HH:MM–HH:MM» if the file's times were on `fileTz`, read on `displayTz`'s clock.
 * Rows that state their own offset are placed by it.
 */
export function displaySpan(rows: readonly ImportRow[], fileTz: string, displayTz: string): { from: string; to: string } | null {
  const shifted = rows.map((row) => {
    const l = utcToLocal(previewInstant(row, fileTz).instant, displayTz);
    const local_entry = `${l.year}-${pad(l.month)}-${pad(l.day)}T${pad(l.hour)}:${pad(l.minute)}:${pad(l.second)}`;
    return { ...row, local_entry, utc_offset: null };
  });
  return entrySpan(shifted);
}

/** The 48 half-hour bars of a zone option, as heights from 0 to 1. */
export function zoneBars(rows: readonly ImportRow[], fileTz: string, displayTz: string): number[] {
  const counts = entryHistogram(rows.slice(), fileTz, displayTz);
  const max = Math.max(...counts);
  return counts.map((c) => (max > 0 ? c / max : 0));
}

/** First and last day on the file's own clock (YYYY-MM-DD). */
export function fileDays(rows: readonly ImportRow[]): { first: string; last: string } | null {
  if (rows.length === 0) return null;
  let first = rows[0].local_entry.slice(0, 10);
  let last = first;
  for (const r of rows) {
    const d = r.local_entry.slice(0, 10);
    if (d < first) first = d;
    if (d > last) last = d;
  }
  return { first, last };
}

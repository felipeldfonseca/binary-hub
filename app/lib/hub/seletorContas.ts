/**
 * The account selector («Conta: Top One ▾») with many accounts (Phase 4, owner's request of 25 Oct
 * 2026: traders with 20–40 prop accounts). From MANY_ACCOUNTS accounts it gets a search field
 * (account nickname or firm, case and accents ignored) and, inside a market with more than one
 * account, one block per firm («mesa») with its count («Futuros · 30», «Apex · 9»). Below that it
 * stays as built: one block per market. Pure; the words are lib/hub/diario's SELETOR_MUITAS.
 */
import { MARKET_ORDER, type TradingAccount } from './contas';
import { foldSearch } from './mesas';

/** Board choice 7: search and firm blocks from 10 accounts */
export const MANY_ACCOUNTS = 10;

export type SelectorAccount = Pick<TradingAccount, 'id' | 'market' | 'label' | 'firm'>;

export interface SelectorBlock<T extends SelectorAccount> {
  market: TradingAccount['market'];
  /** The market's accounts the search found (shown as «Futuros · 30» with many accounts) */
  marketCount: number;
  /** The first block of its market carries the market's header */
  firstOfMarket: boolean;
  /** The firm of a block when the market is split by firm; null otherwise (and for accounts without one) */
  firm: string | null;
  /** Split by firm: the block's accounts are one firm's */
  byFirm: boolean;
  accounts: T[];
}

export interface SelectorView<T extends SelectorAccount> {
  /** Search field and firm blocks */
  many: boolean;
  /** The folded query actually applied ('' when there is no search) */
  query: string;
  found: number;
  blocks: SelectorBlock<T>[];
}

const firmKey = (firm: string | null) => foldSearch(firm ?? '');

/**
 * The selector's blocks, in market order (Futuros, binárias, Forex, Ações, Cripto, B3), the
 * accounts' own order inside each (pass them sorted: sortAccounts). With many accounts a market
 * that has more than one account is split by firm, the firms in the order their first account
 * appears; a search keeps the accounts whose nickname or firm holds it.
 */
export function selectorView<T extends SelectorAccount>(accounts: readonly T[], search = ''): SelectorView<T> {
  const many = accounts.length >= MANY_ACCOUNTS;
  const query = many ? foldSearch(search) : '';
  const hit = (a: T) => !query || foldSearch(a.label).includes(query) || foldSearch(a.firm ?? '').includes(query);
  const blocks: SelectorBlock<T>[] = [];
  let found = 0;
  for (const market of MARKET_ORDER) {
    const all = accounts.filter((a) => a.market === market);
    const shown = all.filter(hit);
    if (!shown.length) continue;
    found += shown.length;
    if (!many || all.length < 2) {
      blocks.push({ market, marketCount: shown.length, firstOfMarket: true, firm: null, byFirm: false, accounts: shown });
      continue;
    }
    const byFirm: { key: string; firm: string | null; accounts: T[] }[] = [];
    for (const a of shown) {
      const key = firmKey(a.firm);
      let b = byFirm.find((x) => x.key === key);
      if (!b) {
        b = { key, firm: a.firm && a.firm.trim() ? a.firm.trim() : null, accounts: [] };
        byFirm.push(b);
      }
      b.accounts.push(a);
    }
    byFirm.forEach((b, i) =>
      blocks.push({ market, marketCount: shown.length, firstOfMarket: i === 0, firm: b.firm, byFirm: true, accounts: b.accounts }),
    );
  }
  return { many, query, found, blocks };
}

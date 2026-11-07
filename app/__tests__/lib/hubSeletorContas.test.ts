/**
 * @jest-environment node
 *
 * The account selector with many accounts (Phase 4, owner's request of 25 Oct 2026; board choice
 * 7: from 10 accounts): the search (nickname or firm, accents and case ignored) and the blocks per
 * market and, inside a market with more than one account, per firm. The worlds of the approved
 * board «Diário · 1º dez»: its 8 accounts and scenario 9b's 35. Invented accounts.
 */
import { MANY_ACCOUNTS, selectorView, type SelectorAccount } from '@/lib/hub/seletorContas';
import { MARKET_LABEL } from '@/components/hub/contas/copy';
import { SELETOR_MUITAS } from '@/lib/hub/diario';

const f = (id: string, label: string, firm: string | null): SelectorAccount => ({ id, market: 'futures', label, firm });

/** Scenario 9b: futures by firm (alphabetical), then the board's other markets */
const MUITAS: SelectorAccount[] = [
  f('alp1', 'Alpha 50k #1', 'Alpha Futures'),
  f('alp2', 'Alpha 50k #2', 'Alpha Futures'),
  f('alp3', 'Alpha 50k #3', 'Alpha Futures'),
  f('apx1', 'Apex 50k #1', 'Apex'),
  f('apx2', 'Apex 50k #2', 'Apex'),
  f('apx3', 'Apex 50k #3', 'Apex'),
  f('apx4', 'Apex 50k #4', 'Apex'),
  f('apx5', 'Apex 50k #5', 'Apex'),
  f('apx6', 'Apex 50k #6', 'Apex'),
  f('apxc1', 'Apex 100k #1', 'Apex'),
  f('apxc2', 'Apex 100k #2', 'Apex'),
  f('apxc3', 'Apex 100k #3', 'Apex'),
  f('lucid', 'Lucid 50k', 'Lucid'),
  f('luc2', 'Lucid 50k #2', 'Lucid'),
  f('luc3', 'Lucid 50k #3', 'Lucid'),
  f('luc100', 'Lucid 100k', 'Lucid'),
  f('mff1', 'MFFU 50k #1', 'My Funded Futures'),
  f('mff2', 'MFFU 50k #2', 'My Funded Futures'),
  f('mff3', 'MFFU 50k #3', 'My Funded Futures'),
  f('top', 'Top One', 'Top One'),
  f('tps1', 'Topstep 50k #1', 'Topstep'),
  f('tps2', 'Topstep 50k #2', 'Topstep'),
  f('tps3', 'Topstep 50k #3', 'Topstep'),
  f('tps4', 'Topstep 50k #4', 'Topstep'),
  f('tps150', 'Topstep 150k', 'Topstep'),
  f('tfy1', 'Tradeify 50k #1', 'Tradeify'),
  f('tfy2', 'Tradeify 50k #2', 'Tradeify'),
  f('tfy3', 'Tradeify 50k #3', 'Tradeify'),
  f('tfy4', 'Tradeify 50k #4', 'Tradeify'),
  f('ylos', 'Ylos 50k', 'Ylos'),
  { id: 'ebx', market: 'binary', label: 'Ebinex', firm: null },
  { id: 'ftmo', market: 'forex', label: 'FTMO', firm: 'FTMO' },
  { id: 'ibkr', market: 'stocks', label: 'IBKR', firm: 'Interactive Brokers' },
  { id: 'bin', market: 'crypto', label: 'Binance', firm: null },
  { id: 'clear', market: 'b3', label: 'Clear', firm: 'Clear' },
];

const OITO = MUITAS.filter((a) => ['top', 'lucid', 'ylos', 'ebx', 'ftmo', 'ibkr', 'bin', 'clear'].includes(a.id));

/** The headers a block shows: «Futuros · 30» on the market's first block, «Apex · 9» per firm */
function headers(search = '', accounts = MUITAS): string[] {
  const v = selectorView(accounts, search);
  return v.blocks.map((b) => {
    const market = v.many ? SELETOR_MUITAS.grupo(MARKET_LABEL[b.market], b.marketCount) : MARKET_LABEL[b.market];
    const firm = b.byFirm ? SELETOR_MUITAS.grupo(b.firm ?? SELETOR_MUITAS.semMesa, b.accounts.length) : null;
    return [b.firstOfMarket ? market : '', firm].filter(Boolean).join(' / ');
  });
}

describe('the selector with many accounts', () => {
  it('from 10 accounts', () => {
    expect(MANY_ACCOUNTS).toBe(10);
    expect(selectorView(MUITAS.slice(0, 9)).many).toBe(false);
    expect(selectorView(MUITAS.slice(0, 10)).many).toBe(true);
  });

  it('scenario 9b: Futuros split by firm, the other markets in one block each', () => {
    expect(headers()).toEqual([
      'Futuros · 30 / Alpha Futures · 3',
      'Apex · 9',
      'Lucid · 4',
      'My Funded Futures · 3',
      'Top One · 1',
      'Topstep · 5',
      'Tradeify · 4',
      'Ylos · 1',
      'Opções binárias · 1',
      'Forex · 1',
      'Ações · 1',
      'Cripto · 1',
      'B3 · 1',
    ]);
    expect(selectorView(MUITAS).found).toBe(35);
  });

  it('«apex» finds the 9 Apex accounts; «funded» the MFFU accounts by their firm; accents and case ignored', () => {
    const apex = selectorView(MUITAS, 'apex');
    expect([apex.found, SELETOR_MUITAS.achadas(apex.found)]).toEqual([9, '9 contas encontradas.']);
    expect(headers('apex')).toEqual(['Futuros · 9 / Apex · 9']);
    const funded = selectorView(MUITAS, 'funded');
    expect(funded.blocks.flatMap((b) => b.accounts.map((a) => a.id))).toEqual(['mff1', 'mff2', 'mff3']);
    expect(selectorView(MUITAS, '  TÓP  ').blocks.flatMap((b) => b.accounts.map((a) => a.id))).toEqual(['top', 'tps1', 'tps2', 'tps3', 'tps4', 'tps150']);
    expect(selectorView(MUITAS, 'interactive').blocks.map((b) => [b.market, b.accounts.map((a) => a.id)])).toEqual([['stocks', ['ibkr']]]);
  });

  it('a name that does not exist', () => {
    const v = selectorView(MUITAS, 'xyz');
    expect([v.found, v.blocks, SELETOR_MUITAS.achadas(v.found), SELETOR_MUITAS.nenhuma(' xyz')]).toEqual([
      0,
      [],
      'Nenhuma conta encontrada.',
      'Nenhuma conta com “xyz”.',
    ]);
  });

  it('accounts without a firm, in a split market, share one block', () => {
    const extra = [...MUITAS, f('sem1', 'Conta própria', null), f('sem2', 'Outra própria', '  ')];
    expect(headers('', extra).slice(0, 2)).toEqual(['Futuros · 32 / Alpha Futures · 3', 'Apex · 9']);
    expect(headers('', extra)).toContain('Sem mesa · 2');
  });

  it('up to 9 accounts: as built (one block per market, no search, no counts)', () => {
    const v = selectorView(OITO, 'apex');
    expect([v.many, v.query, v.found]).toEqual([false, '', 8]);
    expect(headers('', OITO)).toEqual(['Futuros', 'Opções binárias', 'Forex', 'Ações', 'Cripto', 'B3']);
    expect(v.blocks[0].accounts.map((a) => a.id)).toEqual(['lucid', 'top', 'ylos']);
  });
});

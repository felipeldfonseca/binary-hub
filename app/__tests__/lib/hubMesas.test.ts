/**
 * @jest-environment node
 */
import { FIRM_MAX, PLATFORMS } from '@/lib/hub/contas';
import {
  FIRM_MARKETS,
  FIRM_MATCHES_MAX,
  PROP_FIRMS,
  PROP_FIRMS_CHECKED,
  firmByName,
  firmNames,
  firmOfFile,
  firmsFor,
  foldSearch,
  hasFirms,
  onlyPlatform,
  platformsFor,
} from '@/lib/hub/mesas';
import { PASSO_B, PASSO_I2, firmAndPlatform } from '@/components/hub/contas/copy';

const names = (list: readonly { name: string }[]) => list.map((f) => f.name);

describe('the prop-firm list', () => {
  it('has the 25 futures firms, each id used once', () => {
    const futures = PROP_FIRMS.filter((f) => f.market === 'futures');
    expect(futures).toHaveLength(25);
    expect(new Set(PROP_FIRMS.map((f) => f.id)).size).toBe(PROP_FIRMS.length);
    expect(new Set(PROP_FIRMS.map((f) => `${f.market}:${foldSearch(f.name)}`)).size).toBe(PROP_FIRMS.length);
  });

  it('pins every firm: the name an account stores, its platform keys, aliases and the featured flag (mesas_futuros.md, 2026-10-18)', () => {
    // Written out by hand from the research's table (App keys, plus BlackArrow/BlackArrow Pro and
    // WealthCharts where the firm's «Platform:» line lists them): a typo in a name would be stored
    // in trading_accounts.firm, so every value is pinned here, not derived from PROP_FIRMS
    const F = true;
    const expected: [name: string, platforms: string[], aliases: string[], featured: boolean][] = [
      ['Apex Trader Funding', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'], ['Apex'], F],
      ['AquaFunded Futures', ['tradovate'], [], !F],
      ['Blue Guardian Futures', ['tradovate', 'ninja', 'tradingview'], [], F],
      ['Blueberry Futures', ['blackarrow'], [], !F],
      ['DayTraders', ['rithmic', 'quantower'], [], !F],
      ['E8 Futures', ['tradovate', 'tradingview'], [], !F],
      ['Earn2Trade', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'blackarrow'], ['E2T'], !F],
      ['Finotive Futures', ['tradovate', 'ninja', 'quantower', 'tradingview'], [], !F],
      ['FTMO Futures', ['tradovate', 'ninja', 'tradingview'], [], !F],
      ['Funded Futures Family', ['tradovate', 'ninja', 'tradingview', 'wealthcharts'], ['FFF'], !F],
      ['FundedNext Futures', ['tradovate', 'ninja', 'tradingview'], [], F],
      ['FuturesElite', ['tradovate', 'ninja', 'quantower', 'wealthcharts'], [], !F],
      ['Goat Funded Futures', ['tradovate', 'ninja', 'quantower', 'tradingview'], [], !F],
      ['Hola Prime Futures', ['tradovate', 'ninja', 'tradingview', 'wealthcharts'], [], !F],
      ['Lucid Trading', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'], [], F],
      ['My Funded Futures', ['tradovate', 'ninja', 'quantower', 'tradingview'], ['MFF'], F],
      ['Take Profit Trader', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'], ['TPT'], !F],
      ['The Trading Pit Futures', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview'], [], !F],
      ['The5ers Futures', ['blackarrow'], [], !F],
      ['Top One Futures', ['tradovate', 'ninja', 'tradingview', 'blackarrow', 'wealthcharts'], [], F],
      ['Topstep', ['topstepx'], [], F],
      ['TradeDay', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'], [], !F],
      ['Tradeify', ['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts'], [], F],
      ['Traders Launch', ['quantower', 'tradingview'], [], F],
      ['Ylos Trading', ['blackarrow'], [], !F],
    ];
    const actual = PROP_FIRMS.filter((f) => f.market === 'futures')
      .map((f): [string, string[], string[], boolean] => [f.name, [...f.platforms], [...(f.aliases ?? [])], !!f.featured])
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    expect(actual).toEqual(expected);
    // Trade The Pool (stocks only) stays out
    expect(firmByName('futures', 'Trade The Pool')).toBeNull();
  });

  it('keeps every name within the firm column (60) and without the site’s «NEW» badge', () => {
    for (const firm of PROP_FIRMS) {
      expect(firm.name.length).toBeLessThanOrEqual(FIRM_MAX);
      expect(firm.name).toBe(firm.name.trim());
      expect(firm.name).not.toMatch(/\bNEW\b/);
    }
  });

  it('lists only platform keys of its market, never the last pill, once each and in the boards’ order', () => {
    for (const firm of PROP_FIRMS) {
      const market = firm.market as keyof typeof PLATFORMS;
      const list = PLATFORMS[market];
      expect(list).toBeDefined();
      const offered = list.slice(0, -1);
      // A firm with no platform key offers only platforms without one (it says so)
      if (firm.platforms.length === 0) expect(firm.otherPlatforms).toBe(true);
      for (const key of firm.platforms) expect(offered).toContain(key);
      expect(firm.platforms).toEqual(offered.filter((k) => firm.platforms.includes(k)));
    }
  });

  it('features 9 futures firms: the rule’s 8 plus Apex Trader Funding', () => {
    expect(names(PROP_FIRMS.filter((f) => f.market === 'futures' && f.featured))).toHaveLength(9);
    expect(names(firmsFor('futures', ''))).toEqual([
      'Apex Trader Funding',
      'Blue Guardian Futures',
      'FundedNext Futures',
      'Lucid Trading',
      'My Funded Futures',
      'Top One Futures',
      'Topstep',
      'Tradeify',
      'Traders Launch',
    ]);
  });

  it('keeps the real platforms of Apex Trader Funding and Top One Futures', () => {
    expect(firmByName('futures', 'Apex Trader Funding')?.platforms).toEqual(['tradovate', 'rithmic', 'ninja', 'quantower', 'tradingview', 'wealthcharts']);
    expect(firmByName('futures', 'Top One Futures')?.platforms).toEqual(['tradovate', 'ninja', 'tradingview', 'blackarrow', 'wealthcharts']);
  });

  it('records the day it was read', () => {
    expect(PROP_FIRMS_CHECKED).toBe('2026-10-18');
  });

  it('offers BlackArrow and WealthCharts for futures, before «Não sei»', () => {
    expect(PLATFORMS.futures).toEqual(['tradovate', 'rithmic', 'ninja', 'topstepx', 'quantower', 'tradingview', 'blackarrow', 'wealthcharts', 'naosei']);
  });
});

describe('firmsFor', () => {
  it('finds a firm by its alias', () => {
    expect(names(firmsFor('futures', 'mff'))).toEqual(['My Funded Futures']);
    expect(names(firmsFor('futures', 'E2T'))).toEqual(['Earn2Trade']);
    expect(names(firmsFor('futures', 'tpt'))).toEqual(['Take Profit Trader']);
  });

  it('"top" finds Top One Futures and Topstep', () => {
    expect(names(firmsFor('futures', 'top'))).toEqual(['Top One Futures', 'Topstep']);
  });

  it('ignores case, accents, extra spaces and the spaces inside a name', () => {
    expect(names(firmsFor('futures', '  TÓP   ÔNE '))).toEqual(['Top One Futures']);
    expect(names(firmsFor('futures', 'topone'))).toEqual(['Top One Futures']);
    expect(names(firmsFor('futures', 'Lúcid'))).toEqual(['Lucid Trading']);
  });

  it('searches every firm of the market, not only the featured ones', () => {
    expect(names(firmsFor('futures', 'ylos'))).toEqual(['Ylos Trading']);
    expect(names(firmsFor('futures', 'apex'))).toEqual(['Apex Trader Funding']);
  });

  it('answers at most 8 firms, those where the text starts a word first', () => {
    expect(FIRM_MATCHES_MAX).toBe(8);
    expect(firmsFor('futures', 'futures')).toHaveLength(8);
    // «trade» starts a word in the first five; it is only inside DayTraders and Earn2Trade
    expect(names(firmsFor('futures', 'trade'))).toEqual([
      'Apex Trader Funding',
      'Take Profit Trader',
      'TradeDay',
      'Tradeify',
      'Traders Launch',
      'DayTraders',
      'Earn2Trade',
    ]);
  });

  it('ranks a match that ignores the spaces with those where the text starts a word', () => {
    // "trade r": no name holds it as typed; «Traders Launch» starts with it once the spaces go, so it
    // comes before the firms that only hold "trader" inside
    expect(names(firmsFor('futures', 'trade r'))).toEqual(['Traders Launch', 'Apex Trader Funding', 'DayTraders', 'Take Profit Trader']);
  });

  it('finds nothing for a firm outside the list, or for punctuation alone', () => {
    expect(firmsFor('futures', 'Mesa Alfa')).toEqual([]);
    expect(firmsFor('futures', '-')).toEqual([]);
  });

  it('has no firm for binaries', () => {
    expect(hasFirms('binary')).toBe(false);
    expect(hasFirms('futures')).toBe(true);
    expect(hasFirms(null)).toBe(false);
    expect(FIRM_MARKETS).toEqual(['futures']);
    expect(firmsFor('binary', '')).toEqual([]);
    expect(firmsFor('binary', 'top')).toEqual([]);
  });
});

describe('firmByName, firmNames, platformsFor, onlyPlatform', () => {
  it('finds a listed firm by its name, case and accents ignored; a free-text firm is not one', () => {
    expect(firmByName('futures', 'topstep')?.id).toBe('topstep');
    expect(firmByName('futures', ' Top One Futures ')?.id).toBe('top-one-futures');
    expect(firmByName('futures', 'Mesa Alfa')).toBeNull();
    expect(firmByName('futures', '')).toBeNull();
    expect(firmByName('binary', 'Topstep')).toBeNull();
  });

  it('lists every firm of a market alphabetically, for Editar conta', () => {
    const list = firmNames('futures');
    expect(list).toHaveLength(25);
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    expect(firmNames('binary')).toEqual([]);
  });

  it('puts a firm’s platforms first, keeps the rest and «Não sei» last', () => {
    expect(platformsFor('futures', null)).toEqual(PLATFORMS.futures);
    expect(platformsFor('futures', firmByName('futures', 'Top One Futures'))).toEqual([
      'tradovate',
      'ninja',
      'tradingview',
      'blackarrow',
      'wealthcharts',
      'rithmic',
      'topstepx',
      'quantower',
      'naosei',
    ]);
    expect(platformsFor('futures', firmByName('futures', 'Topstep'))[0]).toBe('topstepx');
    // A futures firm never reorders the binary pills
    expect(platformsFor('binary', firmByName('futures', 'Topstep'))).toEqual(PLATFORMS.binary);
  });

  it('knows the platform of a one-platform firm', () => {
    expect(onlyPlatform(firmByName('futures', 'Topstep')!)).toBe('topstepx');
    expect(onlyPlatform(firmByName('futures', 'Ylos Trading')!)).toBe('blackarrow');
    expect(onlyPlatform(firmByName('futures', 'Top One Futures')!)).toBeNull();
  });
});

describe('firmOfFile', () => {
  it('suggests «Top One Futures» for the Top One file, a firm of the list, and nothing for Ebinex', () => {
    expect(firmOfFile('topone')).toBe('Top One Futures');
    expect(firmByName('futures', firmOfFile('topone'))).not.toBeNull();
    expect(firmOfFile('ebinex')).toBeNull();
  });
});

describe('firm copy', () => {
  it('«Mesa · plataforma»: the Top One key reads «Trade History» next to a firm, «Top One» alone', () => {
    expect(firmAndPlatform('Top One Futures', 'topone')).toBe(`Top One Futures · ${PASSO_B.fileTopOne}`);
    expect(firmAndPlatform('Top One Futures', 'topone')).toBe('Top One Futures · Trade History');
    expect(firmAndPlatform(null, 'topone')).toBe('Top One');
    expect(firmAndPlatform('  ', 'topone')).toBe('Top One');
    expect(firmAndPlatform('Topstep', 'topstepx')).toBe('Topstep · TopstepX');
    expect(firmAndPlatform('Mesa Alfa', 'naosei')).toBe('Mesa Alfa · Não sei');
    expect(firmAndPlatform('Mesa Alfa', null)).toBe('Mesa Alfa');
    expect(firmAndPlatform(null, null)).toBe('');
  });

  it('the ⓘ names the source, the day and the rule, mentions Apex, and gives no score', () => {
    const text = PASSO_I2.firmsInfo(PROP_FIRMS_CHECKED);
    expect(text).toContain('Prop Firm Match em 18/10/2026');
    expect(text).toContain('nota 4 ou mais e pelo menos 50 avaliações verificadas');
    expect(text).toContain('Apex Trader Funding, que incluímos por escolha');
    expect(text).not.toMatch(/\d[.,]\d/);
  });
});

describe('the forex, crypto and stocks lists (Fase 2b, mesas_mercados.md, seen 2026-10-18)', () => {
  type Row = [name: string, platforms: string[], aliases: string[], featured: boolean, otherPlatforms: boolean];
  const table = (market: string) =>
    PROP_FIRMS.filter((f) => f.market === market)
      .map((f): Row => [f.name, [...f.platforms], [...(f.aliases ?? [])], !!f.featured, !!f.otherPlatforms])
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  const F = true;

  it('counts 25 futures, 39 forex, 9 crypto and 1 stocks firm; none for B3 or binaries', () => {
    const count = (m: string) => PROP_FIRMS.filter((f) => f.market === m).length;
    expect([count('futures'), count('forex'), count('crypto'), count('stocks'), count('b3'), count('binary'), count('options')]).toEqual([25, 39, 9, 1, 0, 0, 0]);
    expect(firmNames('b3')).toEqual([]);
    expect(firmsFor('b3', 'xp')).toEqual([]);
  });

  it('pins every forex firm by hand', () => {
    expect(table('forex')).toEqual([
      ['Alpha Capital', ['mt5', 'ctrader', 'tradelocker', 'dxtrade'], ['Alpha Capital Group', 'ACG'], F, !F],
      ['AquaFunded', ['mt5', 'ctrader', 'matchtrader', 'tradelocker'], [], F, !F],
      ['Atmos Funded', ['mt5'], [], !F, !F],
      ['Audacity Capital', ['mt5', 'dxtrade'], [], !F, !F],
      ['Axi Select', ['mt5', 'mt4'], [], !F, !F],
      ['BEM Funding', ['mt5', 'ctrader'], [], !F, !F],
      ['Blue Guardian', ['mt5', 'matchtrader', 'tradelocker'], [], !F, !F],
      ['Blueberry Funded', ['mt5', 'tradelocker'], [], !F, !F],
      ['BrightFunded', ['mt5', 'ctrader', 'dxtrade'], [], F, !F],
      ['City Traders Imperium', ['mt5', 'matchtrader'], ['CTI'], !F, !F],
      ['Crypto Fund Trader', ['mt5', 'matchtrader'], ['CFT'], !F, F],
      ['Darwinex Zero', ['mt5', 'mt4', 'tradingview'], [], !F, !F],
      ['E8 Markets', ['mt5', 'ctrader', 'matchtrader', 'tradelocker'], [], F, !F],
      ['Finotive Funding', ['mt5', 'matchtrader'], [], !F, !F],
      ['Fintokei', ['mt5', 'mt4', 'ctrader', 'tradingview'], [], !F, !F],
      ['For Traders', ['mt5', 'ctrader', 'tradelocker'], [], F, !F],
      ['FTMO', ['mt5', 'mt4', 'ctrader', 'tradingview'], [], F, !F],
      ['Funded Trading Plus', ['mt5', 'matchtrader'], ['FTP'], !F, !F],
      ['FundedElite', ['mt5', 'matchtrader'], [], F, !F],
      ['FundedNext', ['mt5', 'mt4', 'ctrader', 'matchtrader'], [], !F, !F],
      ['FundingPips', ['mt5', 'ctrader', 'matchtrader'], [], !F, !F],
      ['FXIFY', ['mt5', 'dxtrade', 'tradingview'], [], !F, !F],
      ['Goat Funded Trader', ['mt5', 'ctrader', 'matchtrader', 'tradelocker'], ['GFT'], !F, !F],
      ['Hantec Trader', ['mt5', 'mt4'], [], !F, !F],
      ['Hola Prime', ['mt5', 'ctrader', 'matchtrader', 'tradelocker'], [], !F, !F],
      ['Instant Funding', ['mt5', 'ctrader', 'matchtrader'], [], !F, !F],
      ['Lark Funding', ['ctrader', 'matchtrader', 'dxtrade'], [], !F, !F],
      ['Leveraged', ['mt5', 'ctrader'], [], !F, !F],
      ['Maven', ['mt5', 'matchtrader'], ['Maven Trading'], !F, !F],
      ['Ment Funding', ['ctrader', 'matchtrader', 'dxtrade'], [], !F, F],
      ['Moneta Funded', ['mt5', 'matchtrader'], [], F, !F],
      ['Nordic Funder', ['ctrader', 'matchtrader', 'dxtrade'], [], !F, F],
      ['Orion Funded', ['mt5', 'matchtrader'], [], !F, !F],
      ['The Trading Pit', ['mt5', 'mt4', 'ctrader'], [], !F, !F],
      ['The5ers', ['mt5', 'ctrader', 'tradingview'], [], F, !F],
      ['ThinkCapital', [], [], !F, F],
      ['Top One Trader', ['mt5', 'matchtrader', 'tradelocker'], [], F, !F],
      ['Tradeify FX', ['mt5'], [], !F, !F],
      ['WSFunded', ['mt5', 'ctrader', 'matchtrader'], [], !F, !F],
    ]);
  });

  it('pins every crypto firm and Trade The Pool by hand', () => {
    expect(table('crypto')).toEqual([
      ['BEM Funding', ['mt5'], [], !F, F],
      ['Breakout', [], [], !F, F],
      ['BrightFunded', ['mt5'], [], !F, F],
      ['Crypto Fund Trader', ['bybit', 'mt5'], ['CFT'], !F, F],
      ['E8 Perpetuals', [], ['E8 Markets'], !F, F],
      ['For Traders Crypto', ['mt5'], [], !F, F],
      ['Leveraged Crypto', ['mt5'], [], !F, F],
      ['Tradeify 247', ['mt5'], ['Tradeify247'], !F, F],
      ['WenCrypto', [], [], !F, F],
    ]);
    expect(table('stocks')).toEqual([['Trade The Pool', [], ['TTP'], !F, F]]);
    // otherPlatforms never on a futures firm: Phase 2's preselection stays
    expect(PROP_FIRMS.filter((f) => f.market === 'futures' && f.otherPlatforms)).toEqual([]);
  });

  it('gives a firm of another market its own id', () => {
    expect(firmByName('crypto', 'BrightFunded')?.id).toBe('brightfunded-crypto');
    expect(firmByName('forex', 'BrightFunded')?.id).toBe('brightfunded');
    expect(firmByName('crypto', 'Crypto Fund Trader')?.id).toBe('crypto-fund-trader-crypto');
    expect(firmByName('crypto', 'BEM Funding')?.id).toBe('bem-funding-crypto');
    expect(firmByName('crypto', 'Tradeify 247')?.id).toBe('tradeify-247');
  });

  it('features the 10 forex firms of the rule, in pt-BR order; none in crypto or stocks', () => {
    expect(names(firmsFor('forex', ''))).toEqual([
      'Alpha Capital',
      'AquaFunded',
      'BrightFunded',
      'E8 Markets',
      'For Traders',
      'FTMO',
      'FundedElite',
      'Moneta Funded',
      'The5ers',
      'Top One Trader',
    ]);
    expect(firmsFor('crypto', '')).toEqual([]);
    expect(firmsFor('stocks', '')).toEqual([]);
  });

  it('searches each market’s whole list, by name or alias, case and accents ignored', () => {
    expect(names(firmsFor('crypto', 'tradeify247'))).toEqual(['Tradeify 247']);
    expect(names(firmsFor('crypto', 'tradeify 247'))).toEqual(['Tradeify 247']);
    expect(names(firmsFor('crypto', 'TRADEÍFY'))).toEqual(['Tradeify 247']);
    expect(names(firmsFor('stocks', 'ttp'))).toEqual(['Trade The Pool']);
    expect(names(firmsFor('forex', 'top one'))).toEqual(['Top One Trader']);
    expect(names(firmsFor('forex', 'ftmo'))).toEqual(['FTMO']);
    expect(names(firmsFor('forex', 'acg'))).toEqual(['Alpha Capital']);
    expect(names(firmsFor('forex', 'the 5ers'))).toEqual(['The5ers']);
    expect(names(firmsFor('crypto', 'cft'))).toEqual(['Crypto Fund Trader']);
    // Never a firm of another market
    expect(names(firmsFor('futures', 'tradeify'))).toEqual(['Tradeify']);
    expect(firmByName('futures', 'Trade The Pool')).toBeNull();
    expect(firmByName('forex', 'Top One Futures')).toBeNull();
  });

  it('preselects a platform only when the firm offers just that one', () => {
    expect(onlyPlatform(firmByName('forex', 'Atmos Funded')!)).toBe('mt5');
    expect(onlyPlatform(firmByName('forex', 'Tradeify FX')!)).toBe('mt5');
    expect(onlyPlatform(firmByName('crypto', 'BrightFunded')!)).toBeNull();
    expect(onlyPlatform(firmByName('crypto', 'Tradeify 247')!)).toBeNull();
    expect(onlyPlatform(firmByName('stocks', 'Trade The Pool')!)).toBeNull();
    expect(onlyPlatform(firmByName('futures', 'Topstep')!)).toBe('topstepx');
    expect(onlyPlatform(firmByName('futures', 'AquaFunded Futures')!)).toBe('tradovate');
  });

  it('puts a forex firm’s platforms first, «Outra» last', () => {
    expect(platformsFor('forex', firmByName('forex', 'Lark Funding'))).toEqual([
      'ctrader',
      'matchtrader',
      'dxtrade',
      'mt5',
      'mt4',
      'tradelocker',
      'tradingview',
      'outra',
    ]);
    expect(platformsFor('stocks', firmByName('stocks', 'Trade The Pool'))).toEqual(PLATFORMS.stocks);
  });
});

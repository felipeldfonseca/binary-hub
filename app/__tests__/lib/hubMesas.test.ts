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
      expect(firm.platforms.length).toBeGreaterThan(0);
      for (const key of firm.platforms) expect(offered).toContain(key);
      expect(firm.platforms).toEqual(offered.filter((k) => firm.platforms.includes(k)));
    }
  });

  it('features 9 futures firms: the rule’s 8 plus Apex Trader Funding', () => {
    expect(names(PROP_FIRMS.filter((f) => f.featured))).toHaveLength(9);
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

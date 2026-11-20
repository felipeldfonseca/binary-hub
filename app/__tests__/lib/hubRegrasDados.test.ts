/**
 * «Dados econômicos» per release in the draft and the save (Phase 5-1, contract §3.4, SPEC §3.3–3.4,
 * §3.6, §7.1): the canonical writing per code (market default, account, «Voltar ao padrão de
 * Futuros»), the three ready-made choices and atalhoDoMapa, the short and long form of the version a
 * save freezes, resolveRules against the SQL-computed `resolve` cases of cases5.json, bad_releases
 * and the 10-minute notice's preference (on by default).
 */
import cases5 from '../domain/cases5.json';
import {
  accountRulesJson,
  accountSettingsFromJson,
  buildSavePayload,
  marketRulesJson,
  marketSettingsFromJson,
  pendingVersions,
  resolveRules,
  RulesAnswerError,
  type RulesSettings,
} from '@/lib/hub/regras';
import { toResolvedJson, type AccountMarket } from '@/lib/domain/gate';
import {
  aplicarAtalho,
  atalhoDoMapa,
  comBloqueio,
  dadosEfetivos,
  escolherDado,
  mapaDoAtalho,
  mudancasDaEntidade,
  temProprio,
  voltarAoPadraoDados,
  type Entidade,
} from '@/lib/hub/rascunho';
import {
  MENSAGENS_REGRAS,
  REGRAS_ERROR_CODES,
  RULES_RPC_ERROR_CODES,
  avisoAntesDaEsperaLigado,
  toRegrasError,
} from '@/lib/hub/regrasDb';
import { configDepois, regrasJson } from '@/testing/regras';

const config = configDepois();
const topOne = config.accounts.find((a) => a.market === 'futures')!;
const PADRAO: Entidade = { tipo: 'padrao' };
const CONTA: Entidade = { tipo: 'conta', conta: topOne };
const base = (): RulesSettings => config.settings;

const blockJson = (s: RulesSettings) => toResolvedJson(resolveRules(topOne, s)).block;

describe('the market default, canonical per code', () => {
  it('a code different from the app default enters; equal to it, it leaves (no key at all)', () => {
    let s = escolherDado(base(), PADRAO, 'cpi', 'dia');
    expect(marketRulesJson('futures', s.markets.futures).block).toEqual({ on: true, before_min: 5, after_min: 10, releases: { cpi: 'dia' } });
    s = escolherDado(s, PADRAO, 'jolts', 'volta');
    expect(marketRulesJson('futures', s.markets.futures).block!.releases).toEqual({ cpi: 'dia', jolts: 'volta' });
    s = escolherDado(escolherDado(s, PADRAO, 'cpi', 'volta'), PADRAO, 'jolts', 'normal');
    expect(marketRulesJson('futures', s.markets.futures).block).toEqual({ on: true, before_min: 5, after_min: 10 });
    expect(s.markets.futures.block).toEqual({ on: true, beforeMin: 5, afterMin: 10 });
    expect(mudancasDaEntidade(base(), s, PADRAO).bloqueio).toBe(false);
  });

  it('the minutes keep the choices', () => {
    const s = comBloqueio(escolherDado(base(), PADRAO, 'cpi', 'dia'), PADRAO, { beforeMin: 15 });
    expect(s.markets.futures.block).toEqual({ on: true, beforeMin: 15, afterMin: 10, releases: { cpi: 'dia' } });
  });

  it('a stored default with a code equal to the app default is written canonical', () => {
    const builtin = regrasJson('config-depois').builtin as Record<string, unknown>;
    const m = marketSettingsFromJson('futures', { v: 1, window_rule: { on: true, outside: 'fora' }, block: { on: true, before_min: 5, after_min: 10, releases: { cpi: 'volta', ppi: 'dia' } } }, [], builtin.futures);
    expect(m.block!.releases).toEqual({ cpi: 'volta', ppi: 'dia' });
    expect(marketRulesJson('futures', m).block!.releases).toEqual({ ppi: 'dia' });
  });
});

describe('the account, canonical per code against what it inherits', () => {
  it('a code different from the inherited value is «só nesta conta»; choosing the inherited value goes back', () => {
    let s = escolherDado(base(), CONTA, 'cpi', 'dia');
    expect(accountRulesJson('futures', s.accounts[topOne.id]).block).toEqual({ releases: { cpi: 'dia' } });
    expect(temProprio(s, topOne.id, 'block')).toBe(true);
    expect(dadosEfetivos(s, CONTA).proprios).toEqual(['cpi']);
    s = escolherDado(s, CONTA, 'cpi', 'volta');
    expect(accountRulesJson('futures', s.accounts[topOne.id]).block).toBeUndefined();
    expect(temProprio(s, topOne.id, 'block')).toBe(false);
    expect(mudancasDaEntidade(base(), s, CONTA).bloqueio).toBe(false);
  });

  it('inherits from the futures default, code by code', () => {
    let s = escolherDado(base(), PADRAO, 'cpi', 'dia');
    s = escolherDado(s, CONTA, 'cpi', 'dia');
    expect(s.accounts[topOne.id].block.releases).toBeUndefined();
    s = escolherDado(s, CONTA, 'cpi', 'volta');
    expect(s.accounts[topOne.id].block.releases).toEqual({ cpi: 'volta' });
    expect(dadosEfetivos(s, CONTA).modos.cpi).toBe('volta');
    expect(dadosEfetivos(s, PADRAO).modos.cpi).toBe('dia');
  });

  it('«Voltar ao padrão de Futuros» removes the account\'s choices of the rule, minutes and switch included', () => {
    let s = comBloqueio(escolherDado(base(), CONTA, 'ppi', 'depois'), CONTA, { beforeMin: 3, on: false });
    expect(s.accounts[topOne.id].block).toEqual({ on: false, beforeMin: 3, releases: { ppi: 'depois' } });
    s = voltarAoPadraoDados(s, CONTA);
    expect(s.accounts[topOne.id].block).toEqual({});
    expect(accountRulesJson('futures', s.accounts[topOne.id]).block).toBeUndefined();
    expect(voltarAoPadraoDados(s, PADRAO)).toBe(s);
  });

  it('reads a stored account map strictly: an unknown code or value is not the as-built shape', () => {
    expect(accountSettingsFromJson('futures', { v: 1, block: { releases: { cpi: 'dia' } } }, null).block).toEqual({ releases: { cpi: 'dia' } });
    expect(() => accountSettingsFromJson('futures', { v: 1, block: { releases: { CPI: 'dia' } } }, null)).toThrow(RulesAnswerError);
    expect(() => accountSettingsFromJson('futures', { v: 1, block: { releases: { cpi: 'sempre' } } }, null)).toThrow(RulesAnswerError);
    expect(() => accountSettingsFromJson('futures', { v: 1, block: { releases: null } }, null)).toThrow(RulesAnswerError);
  });
});

describe('the ready-made choices (SPEC §7.1) and atalhoDoMapa', () => {
  it('each choice\'s map', () => {
    const fortes = mapaDoAtalho('fortes');
    expect(Object.entries(fortes).filter(([, v]) => v === 'volta').map(([k]) => k)).toEqual([
      'cpi', 'ppi', 'payroll', 'pce', 'pib_us', 'varejo_us', 'ism_ind', 'ism_serv', 'fomc_decisao', 'fomc_entrevista', 'bce_decisao', 'hicp_eu', 'ipca', 'pib_br', 'copom',
    ]);
    expect(Object.values(fortes).filter((v) => v === 'normal')).toHaveLength(5);
    const d = mapaDoAtalho('depois0830');
    expect(['cpi', 'ppi', 'payroll', 'pce', 'pib_us', 'varejo_us'].map((c) => d[c as 'cpi'])).toEqual(Array(6).fill('depois'));
    expect([d.ism_ind, d.ism_serv, d.fomc_decisao, d.jolts]).toEqual(['volta', 'volta', 'volta', 'normal']);
    const t = mapaDoAtalho('diaCpiPayrollFed');
    expect([t.cpi, t.payroll, t.fomc_decisao, t.fomc_entrevista, t.ppi, t.casas_novas]).toEqual(['dia', 'dia', 'dia', 'dia', 'volta', 'normal']);
  });

  it('on «Padrão Futuros»: stored as the differences from the app default; the screen recognises it', () => {
    let s = aplicarAtalho(base(), PADRAO, 'depois0830');
    expect(marketRulesJson('futures', s.markets.futures).block!.releases).toEqual({ cpi: 'depois', ppi: 'depois', payroll: 'depois', pce: 'depois', pib_us: 'depois', varejo_us: 'depois' });
    expect(atalhoDoMapa(dadosEfetivos(s, PADRAO).modos)).toBe('depois0830');
    s = aplicarAtalho(s, PADRAO, 'diaCpiPayrollFed');
    expect(s.markets.futures.block!.releases).toEqual({ cpi: 'dia', payroll: 'dia', fomc_decisao: 'dia', fomc_entrevista: 'dia' });
    expect(atalhoDoMapa(dadosEfetivos(s, PADRAO).modos)).toBe('diaCpiPayrollFed');
    s = aplicarAtalho(s, PADRAO, 'fortes');
    expect(s.markets.futures.block!.releases).toBeUndefined();
    expect(atalhoDoMapa(dadosEfetivos(s, PADRAO).modos)).toBe('fortes');
    expect(atalhoDoMapa(dadosEfetivos(escolherDado(s, PADRAO, 'jolts', 'volta'), PADRAO).modos)).toBe('personalizado');
  });

  it('on an account: the codes that differ from the inherited value; the old choices of the account go', () => {
    let s = aplicarAtalho(base(), PADRAO, 'depois0830');
    s = escolherDado(s, CONTA, 'copom', 'dia');
    s = aplicarAtalho(s, CONTA, 'fortes');
    expect(s.accounts[topOne.id].block.releases).toEqual({ cpi: 'volta', ppi: 'volta', payroll: 'volta', pce: 'volta', pib_us: 'volta', varejo_us: 'volta' });
    expect(atalhoDoMapa(dadosEfetivos(s, CONTA).modos)).toBe('fortes');
    s = aplicarAtalho(s, CONTA, 'depois0830');
    expect(s.accounts[topOne.id].block.releases).toBeUndefined();
  });

  it('only the calendars followed count; an absent code reads «normal»', () => {
    const m = { ...mapaDoAtalho('fortes'), copom: 'dia' as const };
    expect(atalhoDoMapa(m)).toBe('personalizado');
    expect(atalhoDoMapa(m, ['us'])).toBe('fortes');
    expect(atalhoDoMapa({}, ['us'])).toBe('personalizado');
    expect(atalhoDoMapa({ cpi: 'volta', ppi: 'volta', payroll: 'volta', pce: 'volta', pib_us: 'volta', varejo_us: 'volta', ism_ind: 'volta', ism_serv: 'volta', fomc_decisao: 'volta', fomc_entrevista: 'volta' }, ['us'])).toBe('fortes');
  });
});

describe('the version a save freezes: short and long form (contract §3.4)', () => {
  it('nothing chosen = the short form, today\'s bytes', () => {
    expect(blockJson(base())).toEqual({ on: true, before_min: 5, after_min: 10, calendars: ['us'] });
    expect(pendingVersions(config, base())).toEqual([]);
    expect(buildSavePayload(config, base())).toBeNull();
  });

  it('CPI «Não opero no dia» = the long form with the whole effective map', () => {
    const s = escolherDado(base(), CONTA, 'cpi', 'dia');
    expect(JSON.stringify(blockJson(s))).toBe(
      JSON.stringify({ on: true, before_min: 5, after_min: 10, calendars: ['us'], releases: { cpi: 'dia', ppi: 'volta', payroll: 'volta', pce: 'volta', pib_us: 'volta', varejo_us: 'volta', ism_ind: 'volta', ism_serv: 'volta', fomc_decisao: 'volta', fomc_entrevista: 'volta' } }),
    );
    const payload = buildSavePayload(config, s)!;
    expect(payload.accounts![topOne.id].rules.block).toEqual({ releases: { cpi: 'dia' } });
    expect(payload.defaults).toBeUndefined();
    const pv = pendingVersions(config, s);
    expect(pv.map((p) => p.accountId)).toEqual([topOne.id]);
    expect(pv[0].rules.block!.releases!.cpi).toBe('dia');
  });

  it('a market default choice goes in `defaults` and versions the account that inherits it', () => {
    const s = escolherDado(base(), PADRAO, 'jolts', 'depois');
    const payload = buildSavePayload(config, s)!;
    expect(payload.defaults!.futures!.rules.block).toEqual({ on: true, before_min: 5, after_min: 10, releases: { jolts: 'depois' } });
    expect(payload.accounts).toBeUndefined();
    expect(blockJson(s)!.releases).toMatchObject({ jolts: 'depois', cpi: 'volta' });
  });

  it('every us code «Opero normalmente» = releases {} (differs from no key)', () => {
    let s = base();
    for (const c of ['cpi', 'ppi', 'payroll', 'pce', 'pib_us', 'varejo_us', 'ism_ind', 'ism_serv', 'fomc_decisao', 'fomc_entrevista'] as const) s = escolherDado(s, CONTA, c, 'normal');
    expect(blockJson(s)).toEqual({ on: true, before_min: 5, after_min: 10, calendars: ['us'], releases: {} });
  });

  it('choosing back the default makes no version and no payload', () => {
    const s = escolherDado(escolherDado(base(), CONTA, 'cpi', 'dia'), CONTA, 'cpi', 'volta');
    expect(pendingVersions(config, s)).toEqual([]);
    expect(buildSavePayload(config, s)).toBeNull();
  });
});

describe('resolveRules = rules_resolve\'s block (cases5.json `resolve`, computed by the SQL)', () => {
  const builtin = regrasJson('config-depois').builtin as Record<string, unknown>;
  const cases = (cases5 as unknown as { resolve: { cases: { label: string; market: AccountMarket; market_rules: unknown; own: Record<string, unknown>; calendars: string[] | null; expected: unknown }[] } }).resolve.cases;
  it.each(cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const own = c.market === 'futures' ? c.own : { v: 1 };
    const market = marketSettingsFromJson(c.market, c.market_rules, [], builtin[c.market]);
    const s: RulesSettings = {
      ...base(),
      markets: { ...base().markets, [c.market]: market },
      accounts: { a: accountSettingsFromJson(c.market, own, null) },
      calendars: (c.calendars ?? ['us']) as RulesSettings['calendars'],
    };
    const r = resolveRules({ id: 'a', market: c.market, day: { tz: 'America/New_York', startMin: 1080 } }, s);
    expect(toResolvedJson(r).block ?? null).toEqual(c.expected);
  });
});

describe('bad_releases and the 10-minute notice', () => {
  it('bad_releases is a code the save answers, with its own words', () => {
    expect(RULES_RPC_ERROR_CODES).toContain('bad_releases');
    expect(REGRAS_ERROR_CODES).toContain('bad_releases');
    expect(toRegrasError({ message: 'bad_releases' }).code).toBe('bad_releases');
    expect(MENSAGENS_REGRAS.bad_releases).toBe('Escolha de dado econômico inválida. Recarregue a página e tente de novo.');
  });

  it('alerts.before_block: on by default («ligado de fábrica»), off only when saved as false', () => {
    expect(avisoAntesDaEsperaLigado(null)).toBe(true);
    expect(avisoAntesDaEsperaLigado(undefined)).toBe(true);
    expect(avisoAntesDaEsperaLigado({})).toBe(true);
    expect(avisoAntesDaEsperaLigado({ alerts: {} })).toBe(true);
    expect(avisoAntesDaEsperaLigado({ alerts: { before_block: null as unknown as boolean } })).toBe(true);
    expect(avisoAntesDaEsperaLigado({ alerts: { before_block: true, limit_80: false } })).toBe(true);
    expect(avisoAntesDaEsperaLigado({ alerts: { before_block: false } })).toBe(false);
  });
});

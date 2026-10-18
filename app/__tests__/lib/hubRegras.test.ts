/**
 * @jest-environment node
 */
import { MON_TO_FRI } from '@/lib/domain';
import { ACCOUNT_MARKETS, MARKET_SPEC, toResolvedJson } from '@/lib/domain/gate';
import { formatDiaMes } from '@/lib/hub/formato';
import { possoLinha, possoTexto } from '@/lib/hub/posso';
import {
  InvalidSettingsError,
  RulesAnswerError,
  accountRulesJson,
  accountSettingsFromJson,
  limitJson,
  activeAccounts,
  buildNewAccountPayload,
  buildSavePayload,
  canon,
  copyAccountSettings,
  effectiveDayAt,
  emptyAccountSettings,
  marketRulesJson,
  nextChangeAt,
  normCalendars,
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  parseUsdText,
  pendingVersions,
  rebaseSettings,
  resolveRules,
  sameAccount,
  sameMarket,
  sameRules,
  settingsIssues,
  windowError,
  withAccountRule,
  type RulesSettings,
} from '@/lib/hub/regras';
import { agora, agoraMercados, configAntes, configDepois, configMercados, idsDono, idsMercados, regrasJson, saveDono } from '@/testing/regras';
import { rascunhoSujo, iniciarRascunho } from '@/lib/hub/rascunho';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** The owner's Phase 2 draft on top of a configuration */
function ownerDraft(s: RulesSettings, topOne: string): RulesSettings {
  const d = clone(s);
  d.markets.futures.windows = [{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }];
  d.markets.binary.windows = [{ tz: 'America/Sao_Paulo', startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }];
  d.accounts[topOne] = { ...d.accounts[topOne], limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } };
  return d;
}

describe('parseRulesConfig', () => {
  it('reads the configuration before anything is saved', () => {
    const c = configAntes();
    const { topOne, ebinex } = idsDono();
    expect(c.rev).toBe('none');
    // Fase 2b: every market of ACCOUNT_MARKETS, none saved yet
    expect(c.savedMarkets).toEqual({ futures: false, binary: false, forex: false, stocks: false, crypto: false, b3: false, options: false });
    expect(c.accounts.map((a) => [a.label, a.market, a.versions.length, a.archivedAt, a.isExample])).toEqual([
      ['Top One #1', 'futures', 0, null, false],
      ['Ebinex', 'binary', 0, null, false],
    ]);
    expect(c.accounts[0].day).toEqual({ tz: 'America/New_York', startMin: 1080 });
    const onlyWindowAndLimit = { windowRule: { on: true, outside: 'fora' }, block: null, states: {}, windows: [] };
    expect(c.settings).toEqual({
      markets: {
        futures: { windowRule: { on: true, outside: 'fora' }, block: { on: true, beforeMin: 5, afterMin: 10 }, states: {}, windows: [] },
        binary: onlyWindowAndLimit,
        forex: onlyWindowAndLimit,
        stocks: onlyWindowAndLimit,
        crypto: onlyWindowAndLimit,
        b3: onlyWindowAndLimit,
        options: onlyWindowAndLimit,
      },
      accounts: { [topOne]: emptyAccountSettings(), [ebinex]: emptyAccountSettings() },
      displayTz: 'et',
      calendars: ['us'],
    });
    expect(c.builtin.futures).toEqual(c.settings.markets.futures);
  });

  it('reads the owner’s saved rules and versions', () => {
    const c = configDepois();
    const { topOne, ebinex } = idsDono();
    expect(c.rev).toMatch(/^2026-10-17T/);
    expect(c.savedMarkets).toEqual({ futures: true, binary: true, forex: false, stocks: false, crypto: false, b3: false, options: false });
    expect(c.settings.markets.futures.windows).toEqual([{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: 31 }]);
    expect(c.settings.accounts[topOne].limit).toEqual({ cents: 40000, mode: 'conta', atLimit: 'encerrar' });
    expect(c.settings.accounts[ebinex]).toEqual(emptyAccountSettings());
    const top = c.accounts.find((a) => a.id === topOne)!;
    expect(top.versions).toHaveLength(1);
    expect(top.versions[0]).toMatchObject({ versionNo: 1, effectiveDay: '2026-10-17', origin: 'salvar', copiedFrom: null });
    expect(sameRules(top.versions[0].rules, top.current)).toBe(true);
  });

  it('refuses an answer of another shape, without keeping its text', () => {
    const bad = regrasJson('config-depois');
    (bad.accounts as Record<string, unknown>[])[0].current = { v: 2 };
    expect(() => parseRulesConfig(bad)).toThrow(RulesAnswerError);
    expect(() => parseRulesConfig([])).toThrow(RulesAnswerError);
    expect(() => parseRulesConfig({ ...regrasJson('config-antes'), server_now: 'ontem' })).toThrow('bad_answer');
  });
});

describe('resolveRules (SQL rules_resolve)', () => {
  it('gives what the database resolved, for every recorded account', () => {
    for (const c of [configAntes(), configDepois()]) {
      for (const a of c.accounts) expect(canon(toResolvedJson(resolveRules(a, c.settings)))).toBe(canon(toResolvedJson(a.current)));
    }
  });

  it('takes the account’s own window and keys over the market’s; the calendars go into the block', () => {
    const c = configDepois();
    const { topOne } = idsDono();
    const top = c.accounts.find((a) => a.id === topOne)!;
    let d = withAccountRule(c.settings, top, { windowRule: { outside: 'aviso' }, block: { afterMin: 30 } });
    d.accounts[topOne].window = { tz: 'America/New_York', startMin: 570, endMin: 690, weekdays: 1 };
    d.calendars = ['br', 'us'];
    const r = resolveRules(top, d);
    expect(r.windows).toEqual([{ tz: 'America/New_York', startMin: 570, endMin: 690, weekdays: 1 }]);
    expect(r.windowsFrom).toBe('account');
    expect(r.windowRule).toEqual({ on: true, outside: 'aviso' });
    expect(r.block).toEqual({ on: true, beforeMin: 5, afterMin: 30, calendars: ['us', 'br'] });

    // A window with an error does not act, and never falls back to the market's
    d = clone(d);
    d.accounts[topOne].window!.endMin = 570;
    expect(resolveRules(top, d)).toMatchObject({ windows: [], windowsFrom: null });
  });

  it('takes the state choices from the market and leaves binaries without block and states', () => {
    const c = configDepois();
    const { topOne, ebinex } = idsDono();
    const d = clone(c.settings);
    d.markets.futures.states.alinhadas = { choice: 'so_a_favor', text: 'a favor' };
    expect(resolveRules(c.accounts.find((a) => a.id === topOne)!, d).states?.alinhadas).toBe('so_a_favor');
    const ebx = resolveRules(c.accounts.find((a) => a.id === ebinex)!, d);
    expect(ebx.block).toBeNull();
    expect(ebx.states).toBeNull();
  });

  it('dates a version saved after 18:00 ET on the next trading day of a futures account', () => {
    const top = configDepois().accounts.find((a) => a.market === 'futures')!;
    expect(effectiveDayAt(new Date('2026-10-19T21:59:00Z'), top.current)).toBe('2026-10-19');
    expect(effectiveDayAt(new Date('2026-10-19T22:00:00Z'), top.current)).toBe('2026-10-20');
  });
});

describe('the save', () => {
  it('builds the owner’s payload, predicts both v1, and finds nothing more to save afterwards', () => {
    const before = configAntes();
    const { topOne, ebinex } = idsDono();
    const draft = ownerDraft(before.settings, topOne);
    expect(buildSavePayload(before, draft)).toEqual({
      v: 1,
      base_rev: 'none',
      defaults: {
        futures: {
          rules: { v: 1, window_rule: { on: true, outside: 'fora' }, block: { on: true, before_min: 5, after_min: 10 }, states: {} },
          windows: [{ tz: 'America/New_York', start_min: 600, end_min: 660, weekdays: 31 }],
        },
        binary: {
          rules: { v: 1, window_rule: { on: true, outside: 'fora' } },
          windows: [{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1260, weekdays: 31 }],
        },
      },
      accounts: { [topOne]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null } },
    });
    expect(pendingVersions(before, draft).map((p) => [p.accountId, p.versionNo])).toEqual([
      [topOne, 1],
      [ebinex, 1],
    ]);
    // What the database then saved: the same versions, and settings that read back as the draft
    expect(saveDono().versions.map((v) => [v.accountId, v.versionNo])).toEqual([
      [topOne, 1],
      [ebinex, 1],
    ]);
    const after = configDepois();
    expect(buildSavePayload(after, ownerDraft(after.settings, topOne))).toBeNull();
    expect(pendingVersions(after, after.settings)).toEqual([]);
  });

  it('sends only what changed, and versions only the accounts it reaches', () => {
    const c = configDepois();
    const { topOne, ebinex } = idsDono();
    const d = clone(c.settings);
    d.markets.binary.windowRule.outside = 'aviso';
    expect(buildSavePayload(c, d)).toEqual({
      v: 1,
      base_rev: c.rev,
      defaults: {
        binary: { rules: { v: 1, window_rule: { on: true, outside: 'aviso' } }, windows: [{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1260, weekdays: 31 }] },
      },
    });
    expect(pendingVersions(c, d).map((p) => [p.accountId, p.versionNo])).toEqual([[ebinex, 2]]);

    // A state text alone is saved, and versions nothing
    const t = clone(c.settings);
    t.markets.futures.states.em_conflito = { choice: null, text: 'Fico de fora.' };
    expect(buildSavePayload(c, t)?.defaults?.futures?.rules.states).toEqual({ em_conflito: { choice: null, text: 'Fico de fora.' } });
    expect(pendingVersions(c, t)).toEqual([]);

    // «Horários na tela» and the calendars are preferences; the calendars reach futures versions
    const p = clone(c.settings);
    p.displayTz = 'br';
    p.calendars = ['eu', 'us'];
    expect(buildSavePayload(c, p)?.preferences).toEqual({ display_tz: 'br', calendars: ['us', 'eu'] });
    expect(pendingVersions(c, p).map((x) => x.accountId)).toEqual([topOne]);
  });

  it('removes a «só nesta conta» key set back to the market’s value', () => {
    const c = configDepois();
    const top = c.accounts.find((a) => a.market === 'futures')!;
    const on = withAccountRule(c.settings, top, { windowRule: { on: false } });
    expect(on.accounts[top.id].windowRule).toEqual({ on: false });
    const back = withAccountRule(on, top, { windowRule: { on: true } });
    expect(back.accounts[top.id].windowRule).toEqual({});
    expect(buildSavePayload(c, back)).toBeNull();
  });

  it('gives v1 to an account without versions whose rules are already right only when forced', () => {
    const c = configAntes();
    const { topOne } = idsDono();
    expect(buildSavePayload(c, c.settings)).toBeNull();
    expect(pendingVersions(c, c.settings)).toEqual([]);
    const payload = buildSavePayload(c, c.settings, { force: [topOne] });
    expect(payload?.accounts?.[topOne]).toEqual({ rules: { v: 1, limit: null }, window: null, version: 'force' });
    expect(pendingVersions(c, c.settings, { force: [topOne] }).map((p) => p.versionNo)).toEqual([1]);
  });

  it('leaves archived accounts out of the payload, but counts their versions', () => {
    const json = regrasJson('config-depois');
    const top = (json.accounts as Record<string, unknown>[])[0];
    top.archived_at = '2026-10-18T12:00:00+00:00';
    const c = parseRulesConfig(json);
    const d = clone(c.settings);
    d.accounts[top.account_id as string].limit = null;
    d.markets.futures.block = { on: false, beforeMin: 5, afterMin: 10 };
    const payload = buildSavePayload(c, d)!;
    expect(payload.accounts).toBeUndefined();
    expect(payload.defaults?.futures).toBeDefined();
    expect(pendingVersions(c, d).map((p) => p.accountId)).toEqual([top.account_id]);
  });

  it('refuses a draft whose window has an error', () => {
    const c = configDepois();
    const d = clone(c.settings);
    d.markets.futures.windows.push({ tz: 'America/New_York', startMin: 840, endMin: 840, weekdays: 31 });
    d.markets.binary.windows[0].weekdays = 0;
    const issues = settingsIssues(d, c.accounts.map((a) => a.id));
    expect(issues).toEqual([
      { place: { market: 'futures', index: 1 }, error: 'same_start_end' },
      { place: { market: 'binary', index: 0 }, error: 'no_days' },
    ]);
    expect(() => buildSavePayload(c, d)).toThrow(InvalidSettingsError);
  });

  it('builds the creation payload: a copy, and the market’s window when the form sets the first one', () => {
    const c = configDepois();
    const { topOne } = idsDono();
    const copy = copyAccountSettings(c.settings, topOne);
    expect(copy).toEqual(c.settings.accounts[topOne]);
    expect(copy).not.toBe(c.settings.accounts[topOne]);
    expect(buildNewAccountPayload(c, { accountId: 'nova', market: 'futures', settings: copy, copiedFrom: topOne })).toEqual({
      v: 1,
      base_rev: c.rev,
      accounts: { nova: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null, version: 'force', copied_from: topOne } },
    });

    const a = configAntes();
    const w = { tz: 'America/Sao_Paulo' as const, startMin: 1200, endMin: 1260, weekdays: 31 };
    const p = buildNewAccountPayload(a, { accountId: 'nova', market: 'binary', settings: emptyAccountSettings(), marketWindows: [w] });
    expect(p.defaults).toEqual({
      binary: { rules: { v: 1, window_rule: { on: true, outside: 'fora' } }, windows: [{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1260, weekdays: 31 }] },
    });
    expect(() =>
      buildNewAccountPayload(a, { accountId: 'nova', market: 'binary', settings: { ...emptyAccountSettings(), window: { ...w, weekdays: 0 } } }),
    ).toThrow(InvalidSettingsError);
  });

  it('writes the stored JSON of each settings form', () => {
    expect(
      marketRulesJson('futures', {
        windowRule: { on: false, outside: 'aviso' },
        block: { on: true, beforeMin: 0, afterMin: 120 },
        states: { alinhadas: { choice: 'opero', text: 'x'.repeat(600) }, so_tecnica: { choice: null, text: '' } },
        windows: [],
      }),
    ).toEqual({
      v: 1,
      window_rule: { on: false, outside: 'aviso' },
      block: { on: true, before_min: 0, after_min: 120 },
      states: { alinhadas: { choice: 'opero', text: 'x'.repeat(500) } },
    });
    expect(
      accountRulesJson('binary', { windowRule: { on: false }, block: { beforeMin: 3 }, limit: { cents: 40050, mode: 'conta', atLimit: 'avisar' }, window: null }),
    ).toEqual({ v: 1, window_rule: { on: false }, limit: { usd: 400.5, mode: 'conta', at_limit: 'avisar' } });
  });

  it('reads the save’s answer', () => {
    const r = saveDono();
    expect(r.dryRun).toBe(false);
    expect(r.rev).toBe(configDepois().rev);
    expect(r.versions.map((v) => [v.versionNo, v.effectiveDay, v.origin])).toEqual([
      [1, '2026-10-17', 'salvar'],
      [1, '2026-10-17', 'salvar'],
    ]);
    expect(() => parseSaveResult({ ...regrasJson('save-dono'), versions: [{}] })).toThrow(RulesAnswerError);
  });
});

describe('rebaseSettings (a draft carried to a newer saved base)', () => {
  const same = (c: ReturnType<typeof configDepois>, a: RulesSettings, b: RulesSettings) =>
    sameMarket('futures', a.markets.futures, b.markets.futures) &&
    sameMarket('binary', a.markets.binary, b.markets.binary) &&
    c.accounts.every((x) => sameAccount(x.market, a.accounts[x.id], b.accounts[x.id])) &&
    a.displayTz === b.displayTz &&
    canon(normCalendars(a.calendars)) === canon(normCalendars(b.calendars));

  it('after this tab’s own save, the saved draft is the new base: nothing left to save', () => {
    const before = configAntes();
    const after = configDepois();
    const { topOne } = idsDono();
    const draft = ownerDraft(before.settings, topOne);
    const rebased = rebaseSettings(after.accounts, before.settings, after.settings, draft);
    expect(same(after, rebased, after.settings)).toBe(true);
    expect(buildSavePayload(after, rebased)).toBeNull();
  });

  it('takes the new base where the draft did not change, and keeps the draft where it did', () => {
    const before = configAntes();
    const after = configDepois();
    const { topOne, ebinex } = idsDono();
    // Draft: only «Horários na tela» and the Ebinex limit
    const draft = clone(before.settings);
    draft.displayTz = 'both';
    draft.accounts[ebinex] = { ...emptyAccountSettings(), limit: { cents: 5000, mode: 'conta', atLimit: 'avisar' } };
    const rebased = rebaseSettings(after.accounts, before.settings, after.settings, draft);
    expect(rebased.markets).toEqual(after.settings.markets);
    expect(rebased.accounts[topOne]).toEqual(after.settings.accounts[topOne]);
    expect(rebased.accounts[ebinex].limit).toEqual({ cents: 5000, mode: 'conta', atLimit: 'avisar' });
    expect(rebased.displayTz).toBe('both');
    expect(rebased.calendars).toEqual(after.settings.calendars);
    // Saved against the new base, only the draft's own changes go
    expect(buildSavePayload(after, rebased)).toEqual({
      v: 1,
      base_rev: after.rev,
      accounts: { [ebinex]: { rules: { v: 1, limit: { usd: 50, mode: 'conta', at_limit: 'avisar' } }, window: null } },
      preferences: { display_tz: 'both' },
    });
  });

  it('brings in an account the new base lists, and drops one it no longer lists', () => {
    const c = configDepois();
    const json = regrasJson('config-depois');
    const list = json.accounts as Record<string, unknown>[];
    const novo = { ...clone(list[0]), account_id: '00000000-0000-4000-8000-0000000000a2', label: 'Top One #2', settings: null, versions: [] };
    list.push(novo);
    const withNew = parseRulesConfig(json);
    const rebased = rebaseSettings(withNew.accounts, c.settings, withNew.settings, c.settings);
    expect(rebased.accounts['00000000-0000-4000-8000-0000000000a2']).toEqual(emptyAccountSettings());
    const { ebinex } = idsDono();
    const without = rebaseSettings(withNew.accounts.filter((a) => a.id !== ebinex), c.settings, c.settings, c.settings);
    expect(Object.keys(without.accounts)).not.toContain(ebinex);
  });
});

describe('activeAccounts', () => {
  it('lists the accounts the rules screens show: not archived, not examples, in list order', () => {
    const json = regrasJson('config-depois');
    const list = json.accounts as Record<string, unknown>[];
    list[0].archived_at = '2026-10-18T12:00:00+00:00';
    list.push({ ...clone(list[1]), account_id: '00000000-0000-4000-8000-0000000000e1', label: 'Exemplo', is_example: true });
    expect(activeAccounts(parseRulesConfig(json)).map((a) => a.label)).toEqual(['Ebinex']);
  });
});

describe('parseRulesNow', () => {
  const linha = (name: Parameters<typeof agora>[0], market: 'futures' | 'binary') => {
    const a = agora(name).accounts.find((x) => x.market === market)!;
    return possoTexto(possoLinha(a.label, a.gate, a.rules));
  };

  it('gives each account’s answer, with the words of lib/hub/posso', () => {
    expect(linha('agora-seg-0930-et', 'futures')).toBe('Fora da sua janela · abre às 10:00 ET');
    expect(linha('agora-seg-1005-et', 'futures')).toBe('Liberado · até 11:00 ET');
    expect(linha('agora-seg-1045-et', 'futures')).toBe('Encerrado por hoje · limite atingido às 10:31');
    expect(linha('agora-seg-2030-brt', 'futures')).toBe('Fora da sua janela · abre amanhã às 10:00 ET');
    expect(linha('agora-seg-0930-et', 'binary')).toBe('Fora da sua janela · abre às 20:00 de Brasília');
    expect(linha('agora-seg-2030-brt', 'binary')).toBe('Liberado · até 21:00 de Brasília');
    expect(linha('agora-sab-1200-et', 'futures')).toBe('Fora da sua janela · hoje não é dia da janela');
    expect(linha('agora-sab-1200-et', 'binary')).toBe('Fora da sua janela · hoje não é dia da janela');
    // Before the first save nothing is evaluated: never «Liberado»
    expect(linha('agora-antes-seg-0930-et', 'futures')).toBe('Sem janela salva · Definir');
    expect(linha('agora-antes-seg-0930-et', 'binary')).toBe('Sem janela salva · Definir');
    const antes = agora('agora-antes-seg-0930-et').accounts[0];
    expect([antes.version, antes.rules, antes.desde, antes.desdeDay]).toEqual([null, null, null, null]);
  });

  it('carries the version in force, «desde», the limit and the day of each account', () => {
    const now = agora('agora-seg-1045-et');
    const top = now.accounts[0];
    expect(now.serverNow.toISOString()).toBe('2026-10-19T14:45:00.000Z');
    expect(top).toMatchObject({ label: 'Top One #1', market: 'futures', desdeDay: '2026-10-17' });
    expect(top.version).toMatchObject({ versionNo: 1, origin: 'salvar' });
    expect(top.rules?.limit).toEqual({ cents: 40000, mode: 'conta', atLimit: 'encerrar' });
    expect(top.today).toEqual({ trades: 2, netCents: -43000, worstCents: -43000 });
    expect(top.gate.limit).toMatchObject({ evaluated: true, state: 'atingido', worstCents: -43000 });
    const linhaTop = possoLinha(top.label, top.gate, top.rules);
    expect(linhaTop.limite).toMatchObject({ usado: 'US$\u00a0430', de: 'de US$\u00a0400' });
    expect(now.accounts[1].rules?.limit).toBeNull();
  });

  it('knows when the next answer can change', () => {
    expect(nextChangeAt(agora('agora-seg-0930-et'))?.toISOString()).toBe('2026-10-19T14:00:00.000Z');
    expect(nextChangeAt(agora('agora-seg-2030-brt'))?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(nextChangeAt({ serverNow: new Date(), accounts: [] })).toBeNull();
  });

  it('keeps the accounts of every market: «Posso operar hoje?» never drops one (Fase 2b)', () => {
    // rules_now lists every active account; a Phase 1 backfill can hold a forex account
    const json = regrasJson('agora-antes-seg-0930-et');
    const list = json.accounts as Record<string, unknown>[];
    list.splice(1, 0, { ...clone(list[0]), account_id: '00000000-0000-4000-8000-0000000000f1', label: 'Forex', market: 'forex' });
    const now = parseRulesNow(json);
    expect(now.accounts.map((a) => [a.label, a.market])).toEqual([
      ['Top One #1', 'futures'],
      ['Forex', 'forex'],
      ['Ebinex', 'binary'],
    ]);
    expect(possoTexto(possoLinha('Forex', now.accounts[1].gate, now.accounts[1].rules))).toBe('Sem janela salva · Definir');
    // A market outside the seven, or anything else of another shape, still fails
    list[1].market = 'xyz';
    expect(() => parseRulesNow(json)).toThrow(RulesAnswerError);
    list[1].market = 'forex';
    list.push(42 as unknown as Record<string, unknown>);
    expect(() => parseRulesNow(json)).toThrow(RulesAnswerError);
  });

  it('refuses an answer of another shape', () => {
    const json = regrasJson('agora-seg-0930-et');
    (json.accounts as Record<string, unknown>[])[0].status = 'talvez';
    expect(() => parseRulesNow(json)).toThrow(RulesAnswerError);
    expect(() => parseRulesNow({ server_now: '2026-10-19T13:30:00Z' })).toThrow(RulesAnswerError);
  });
});

describe('small pieces', () => {
  it('reads the limit field in pt-BR', () => {
    expect(parseUsdText('400')).toEqual({ ok: true, cents: 40000 });
    expect(parseUsdText(' 400,5 ')).toEqual({ ok: true, cents: 40050 });
    expect(parseUsdText('1.000,50')).toEqual({ ok: true, cents: 100050 });
    expect(parseUsdText('400.5')).toEqual({ ok: true, cents: 40050 });
    expect(parseUsdText('US$ 1.000')).toEqual({ ok: true, cents: 100000 });
    expect(parseUsdText('10,005')).toEqual({ ok: true, cents: 1001 });
    expect(parseUsdText('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseUsdText('0')).toEqual({ ok: false, reason: 'not_positive' });
    expect(parseUsdText('0,004')).toEqual({ ok: false, reason: 'not_positive' });
    expect(parseUsdText('1.000.000,01')).toEqual({ ok: false, reason: 'too_large' });
    expect(parseUsdText('1.000.000')).toEqual({ ok: true, cents: 100000000 });
    expect(parseUsdText('-5')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseUsdText('1.00')).toEqual({ ok: true, cents: 100 });
    expect(parseUsdText('12a')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('finds window errors', () => {
    expect(windowError({ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: 31 })).toBeNull();
    expect(windowError({ tz: 'America/New_York', startMin: 1320, endMin: 60, weekdays: 1 })).toBeNull();
    expect(windowError({ tz: 'America/New_York', startMin: 600, endMin: 600, weekdays: 31 })).toBe('same_start_end');
    expect(windowError({ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: 0 })).toBe('no_days');
  });

  it('orders the calendars as the database does', () => {
    expect(normCalendars(['br', 'eu', 'us'])).toEqual(['us', 'eu', 'br']);
    expect(normCalendars([])).toEqual([]);
    expect(normCalendars(undefined)).toEqual(['us']);
  });

  it('compares values whatever their key order', () => {
    expect(canon({ b: 1, a: { d: 2, c: [1, { f: 1, e: 2 }] } })).toBe(canon({ a: { c: [1, { e: 2, f: 1 }], d: 2 }, b: 1 }));
    expect(canon({ a: undefined, b: 1 })).toBe(canon({ b: 1 }));
  });

  it('writes the «desde» dates as the boards do', () => {
    expect(formatDiaMes('2026-10-17')).toBe('17 out');
    expect(formatDiaMes('2026-11-01')).toBe('1º nov');
    expect(formatDiaMes('2027-01-01', true)).toBe('1º jan 2027');
  });
});

describe('seven markets (Fase 2b)', () => {
  const NBSP = '\u00a0';

  it('reads the six-market owner’s configuration, and resolves every account as the database did', () => {
    const c = configMercados();
    const ids = idsMercados();
    expect(c.accounts.map((a) => [a.label, a.market])).toEqual([
      ['Top One #1', 'futures'],
      ['Ebinex', 'binary'],
      ['FTMO', 'forex'],
      ['IBKR', 'stocks'],
      ['Binance', 'crypto'],
      ['Clear', 'b3'],
    ]);
    expect(c.savedMarkets).toEqual({ futures: true, binary: false, forex: true, stocks: false, crypto: true, b3: true, options: false });
    for (const a of c.accounts) {
      expect(a.day).toEqual(MARKET_SPEC[a.market].day);
      expect(canon(toResolvedJson(resolveRules(a, c.settings)))).toBe(canon(toResolvedJson(a.current)));
    }
    expect(c.settings.accounts[ids.clear].limit).toEqual({ cents: 50000, mode: 'conta', atLimit: 'encerrar' });
    expect(c.settings.accounts[ids.ftmo].limit).toEqual({ cents: 100000, mode: 'conta', atLimit: 'encerrar' });
    expect(c.settings.markets.crypto.windows).toEqual([{ tz: 'America/Sao_Paulo', startMin: 1200, endMin: 1320, weekdays: 127 }]);
    // Nothing to save: no spurious default for a market never saved (C13)
    expect(buildSavePayload(c, c.settings)).toBeNull();
    expect(rascunhoSujo(iniciarRascunho(c))).toBe(false);
  });

  it('keeps the limit in the market’s currency: `brl` on B3, `usd` elsewhere, the other key refused', () => {
    const lim = { mode: 'conta', at_limit: 'encerrar' };
    expect(accountSettingsFromJson('b3', { v: 1, limit: { brl: 500.5, ...lim } }, null).limit).toEqual({ cents: 50050, mode: 'conta', atLimit: 'encerrar' });
    expect(accountSettingsFromJson('forex', { v: 1, limit: { usd: 1000, ...lim } }, null).limit).toEqual({ cents: 100000, mode: 'conta', atLimit: 'encerrar' });
    expect(() => accountSettingsFromJson('b3', { v: 1, limit: { usd: 500, ...lim } }, null)).toThrow(RulesAnswerError);
    expect(() => accountSettingsFromJson('futures', { v: 1, limit: { brl: 500, ...lim } }, null)).toThrow(RulesAnswerError);
    expect(() => accountSettingsFromJson('b3', { v: 1, limit: { usd: 500, brl: 500, ...lim } }, null)).toThrow(RulesAnswerError);

    const s = { ...emptyAccountSettings(), limit: { cents: 50050, mode: 'conta' as const, atLimit: 'avisar' as const } };
    expect(accountRulesJson('b3', s)).toEqual({ v: 1, limit: { brl: 500.5, mode: 'conta', at_limit: 'avisar' } });
    expect(accountRulesJson('crypto', s)).toEqual({ v: 1, limit: { usd: 500.5, mode: 'conta', at_limit: 'avisar' } });
    expect(limitJson('futures', s.limit)).toEqual({ usd: 500.5, mode: 'conta', at_limit: 'avisar' });
    // A block set by mistake on another market is never written
    expect(accountRulesJson('forex', { ...s, block: { on: false } })).not.toHaveProperty('block');
  });

  it('resolves the window and the limit everywhere, the block and the states only in futures', () => {
    const c = configMercados();
    for (const m of ACCOUNT_MARKETS) {
      const r = resolveRules({ id: 'nova', market: m, day: { ...MARKET_SPEC[m].day } }, c.settings);
      expect(r.block === null).toBe(!MARKET_SPEC[m].rules.block);
      expect(r.states === null).toBe(!MARKET_SPEC[m].rules.states);
      expect(marketRulesJson(m, c.settings.markets[m])).toEqual(
        m === 'futures' ? expect.objectContaining({ block: expect.any(Object), states: expect.any(Object) }) : { v: 1, window_rule: { on: true, outside: 'fora' } },
      );
    }
  });

  it('refuses a configuration without a builtin for every market', () => {
    const json = regrasJson('config-mercados');
    delete (json.builtin as Record<string, unknown>).b3;
    expect(() => parseRulesConfig(json)).toThrow(RulesAnswerError);
    const json2 = regrasJson('config-mercados');
    (json2.accounts as Record<string, unknown>[])[0].market = 'xyz';
    expect(() => parseRulesConfig(json2)).toThrow(RulesAnswerError);
  });

  it('builds a save of any market: its default, its accounts, nothing of the others', () => {
    const c = configMercados();
    const ids = idsMercados();
    const d = clone(c.settings);
    d.markets.b3.windows = [{ tz: 'America/Sao_Paulo', startMin: 600, endMin: 720, weekdays: MON_TO_FRI }];
    d.accounts[ids.clear].limit = { cents: 80000, mode: 'conta', atLimit: 'encerrar' };
    d.markets.stocks.windows = [{ tz: 'America/New_York', startMin: 570, endMin: 630, weekdays: MON_TO_FRI }];
    const payload = buildSavePayload(c, d)!;
    expect(Object.keys(payload.defaults!).sort()).toEqual(['b3', 'stocks']);
    expect(payload.accounts).toEqual({ [ids.clear]: { rules: { v: 1, limit: { brl: 800, mode: 'conta', at_limit: 'encerrar' } }, window: null } });
    expect(pendingVersions(c, d).map((p) => [p.accountId, p.versionNo]).sort()).toEqual(
      [
        [ids.clear, 2],
        [ids.ibkr, 1],
      ].sort(),
    );
    expect(rascunhoSujo({ ...iniciarRascunho(c), draft: d })).toBe(true);

    // A window error in any market blocks the save
    const bad = clone(d);
    bad.markets.crypto.windows[0].weekdays = 0;
    expect(settingsIssues(bad, [])).toEqual([{ place: { market: 'crypto', index: 0 }, error: 'no_days' }]);
    expect(() => buildSavePayload(c, bad)).toThrow(InvalidSettingsError);

    // Carried over a newer base, market by market
    const rebased = rebaseSettings(c.accounts, c.settings, c.settings, d);
    for (const m of ACCOUNT_MARKETS) expect(sameMarket(m, rebased.markets[m], d.markets[m])).toBe(true);
  });

  it('gives a new B3 account v1 with its limit in reais and the market’s first window', () => {
    const c = configMercados();
    const payload = buildNewAccountPayload(c, {
      accountId: 'nova',
      market: 'b3',
      settings: { ...emptyAccountSettings(), limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } },
      marketWindows: [{ tz: 'America/Sao_Paulo', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }],
    });
    expect(payload.accounts!.nova).toEqual({ rules: { v: 1, limit: { brl: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null, version: 'force' });
    expect(payload.defaults).toEqual({
      b3: { rules: { v: 1, window_rule: { on: true, outside: 'fora' } }, windows: [{ tz: 'America/Sao_Paulo', start_min: 600, end_min: 660, weekdays: 31 }] },
    });
  });

  it('answers «Posso operar hoje?» for all six at Mon 19 Oct 08:30 ET, as the Início board draws it', () => {
    const now = agoraMercados();
    const linhas = now.accounts.map((a) => {
      const l = possoLinha(a.label, a.gate, a.rules);
      return [a.label, possoTexto(l), l.limite && `${l.limite.usado} ${l.limite.de}`];
    });
    expect(linhas).toEqual([
      ['Top One #1', 'Fora da sua janela · abre às 10:00 ET', `US$${NBSP}0 de US$${NBSP}400`],
      ['Ebinex', 'Sem janela salva · Definir', null],
      ['FTMO', 'Liberado · até 10:00 ET', `US$${NBSP}0 de US$${NBSP}1.000`],
      ['IBKR', 'Sem janela salva · Definir', null],
      ['Binance', 'Fora da sua janela · abre às 20:00 de Brasília', null],
      ['Clear', 'Fora da sua janela · abre às 10:00 de Brasília', `R$${NBSP}0 de R$${NBSP}500`],
    ]);
    const clear = now.accounts[5];
    expect(possoLinha('Clear', clear.gate, clear.rules).limite!.aria).toBe(`Clear, limite do dia: R$${NBSP}0 de R$${NBSP}500.`);
    expect(possoLinha('IBKR', now.accounts[3].gate, null).acao).toEqual({
      texto: 'Definir',
      href: '/personalizar#janelas',
      aria: 'Definir a janela da IBKR em Personalizar',
    });
  });

  it('reads a limit typed with R$ as with US$', () => {
    expect(parseUsdText('R$ 1.000,50')).toEqual({ ok: true, cents: 100050 });
    expect(parseUsdText('r$500')).toEqual({ ok: true, cents: 50000 });
    expect(parseUsdText('US$ 400')).toEqual({ ok: true, cents: 40000 });
    expect(parseUsdText('€ 400')).toEqual({ ok: false, reason: 'invalid' });
  });
});

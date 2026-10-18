/**
 * @jest-environment node
 *
 * The rules data layer against the real SQL (migrations 20261018000001..3 and 20261019000001), on
 * a throwaway local Postgres. Skipped unless BH_PG_URL points at one: never the hosted project.
 *
 *   # a cluster with the Supabase stub and every migration, as supabase/tests/run.sh builds it
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres npx jest --ci __tests__/lib/hubRegras.pg.test.ts
 *   (BH_PSQL overrides the psql binary; PG 15+.)
 *
 * Each run creates its own invented user and accounts and deletes them at the end. For every
 * step, the TS payload builder's payload is sent to save_rules as a dry run and for real, and the
 * versions save_rules creates must be the ones pendingVersions predicted; then rules_config() must
 * parse, its `current` of every account must equal resolveRules on the draft (SQL rules_resolve =
 * TS resolveRules), and its settings must read back as the draft (the round trip).
 *
 * The fixtures in testing/fixtures/regras are recorded here (BH_PG_RECORD=<dir>), with the
 * server's clock at Sat 17 Oct 2026 about 20:06 UTC (see the describeRecord blocks).
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import {
  InvalidSettingsError,
  buildNewAccountPayload,
  buildSavePayload,
  canon,
  copyAccountSettings,
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  pendingVersions,
  rebaseSettings,
  resolveRules,
  sameAccount,
  sameMarket,
  sameRules,
  withAccountRule,
  type RulesConfig,
  type RulesSettings,
  type SaveRulesPayload,
} from '@/lib/hub/regras';
import { ACCOUNT_MARKETS, MARKET_SPEC, MAX_LIMIT_CENTS, checkRules, toResolvedJson } from '@/lib/domain/gate';
import { EVERY_DAY, MON_TO_FRI } from '@/lib/domain';
import { ACCOUNT_COLUMNS } from '@/lib/hub/contasDb';
import { JANELA_SUGERIDA, trocarRelogio } from '@/lib/hub/janelas';
import { possoLinha, possoTexto } from '@/lib/hub/posso';
import { partesVersao } from '@/lib/hub/comoFicaHoje';
import {
  ajustarSoNestaConta,
  alternarDia,
  comAoChegar,
  comJanelaDaConta,
  comLimite,
  comRegraJanela,
  definirJanela,
  segundaJanela,
} from '@/lib/hub/rascunho';
import { PG_URL as URL, asUser, asUserExec, codeOf, createAccountAsUser, lit, psql } from '@/testing/pg';

const RECORD = process.env.BH_PG_RECORD;
const NBSP = ' ';

const describePg = URL ? describe : describe.skip;

describePg('rules data layer × the real SQL', () => {
  const uid = randomUUID();
  const ids: Record<string, string> = {};
  const config = () => parseRulesConfig(asUser(uid, 'public.rules_config()'));

  /** Sends the payload as a dry run and for real; the versions must be the predicted ones */
  function save(before: RulesConfig, draft: RulesSettings, payload: SaveRulesPayload, force: string[] = []) {
    const predicted = pendingVersions(before, draft, { force })
      .map((p) => `${p.accountId}:v${p.versionNo}`)
      .sort();
    const dry = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)}, true)`));
    expect(dry.dryRun).toBe(true);
    expect(dry.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    // Nothing was written
    expect(config().rev).toBe(before.rev);

    const real = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)})`));
    expect(real.dryRun).toBe(false);
    expect(real.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const after = config();
    expect(after.rev).toBe(real.rev);
    // SQL rules_resolve = TS resolveRules, for every account (archived and new ones too)
    for (const a of after.accounts) expect(canon(toResolvedJson(a.current))).toBe(canon(toResolvedJson(resolveRules(a, draft))));
    // A version's rules are the account's rules in force; its «desde» is a trading day
    for (const v of real.versions) {
      const a = after.accounts.find((x) => x.id === v.accountId)!;
      expect(sameRules(a.versions[a.versions.length - 1].rules, a.current)).toBe(true);
      expect(v.effectiveDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // The round trip: the saved settings read back as the draft (every market)
    for (const m of ACCOUNT_MARKETS) expect(sameMarket(m, after.settings.markets[m], draft.markets[m])).toBe(true);
    for (const a of after.accounts.filter((x) => !x.archivedAt)) {
      expect(sameAccount(a.market, after.settings.accounts[a.id], draft.accounts[a.id])).toBe(true);
    }
    expect(after.settings.displayTz).toBe(draft.displayTz);
    expect(after.settings.calendars).toEqual(draft.calendars);
    // Nothing left to save
    expect(buildSavePayload(after, draft)).toBeNull();
    return { result: real, after };
  }

  beforeAll(() => {
    ids.top = randomUUID();
    ids.ebx = randomUUID();
    psql(`insert into auth.users (id, email) values ('${uid}', 'regras-${uid}@example.test');
insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, is_primary, sort_order) values
  ('${ids.top}', '${uid}', 'futures', 'Top One #1', 'America/New_York', 1080, false, 0),
  ('${ids.ebx}', '${uid}', 'binary', 'Ebinex', 'America/Sao_Paulo', 0, true, 1);`);
  });

  afterAll(() => {
    if (URL) psql(`delete from auth.users where id = '${uid}';`);
  });

  it('reads the empty configuration, and resolves it as the database does', () => {
    const c = config();
    expect(c.rev).toBe('none');
    expect(c.savedMarkets).toEqual({ futures: false, binary: false, forex: false, stocks: false, crypto: false, b3: false, options: false });
    expect(c.settings.markets.futures).toEqual({
      windowRule: { on: true, outside: 'fora' },
      block: { on: true, beforeMin: 5, afterMin: 10 },
      states: {},
      windows: [],
    });
    expect(c.settings.markets.binary).toEqual({ windowRule: { on: true, outside: 'fora' }, block: null, states: {}, windows: [] });
    expect(c.settings.calendars).toEqual(['us']);
    expect(c.settings.displayTz).toBe('et');
    for (const a of c.accounts) expect(sameRules(a.current, resolveRules(a, c.settings))).toBe(true);
    expect(buildSavePayload(c, c.settings)).toBeNull();
    expect(parseRulesNow(asUser(uid, 'public.rules_now()')).accounts.map((a) => a.gate.status)).toEqual([null, null]);
  });

  it('saves the owner’s Phase 2 rules: v1 for both accounts, the boards’ resolved values', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windows = [{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }];
    draft.markets.binary.windows = [{ tz: 'America/Sao_Paulo', startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }];
    draft.accounts[ids.top] = { ...draft.accounts[ids.top], limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } };
    const payload = buildSavePayload(before, draft)!;
    expect(payload.base_rev).toBe('none');
    expect(Object.keys(payload.defaults!).sort()).toEqual(['binary', 'futures']);
    expect(Object.keys(payload.accounts!)).toEqual([ids.top]);
    expect(payload.preferences).toBeUndefined();

    const { result, after } = save(before, draft, payload);
    expect(result.versions.map((v) => [v.accountId, v.versionNo, v.origin])).toEqual([
      [ids.top, 1, 'salvar'],
      [ids.ebx, 1, 'salvar'],
    ]);
    // The literal values of the migration's header (the owner's first versions)
    expect(toResolvedJson(after.accounts.find((a) => a.id === ids.top)!.current)).toEqual({
      v: 1,
      market: 'futures',
      windows: [{ tz: 'America/New_York', start_min: 600, end_min: 660, weekdays: 31 }],
      windows_from: 'market',
      window_rule: { on: true, outside: 'fora' },
      block: { on: true, before_min: 5, after_min: 10, calendars: ['us'] },
      limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' },
      states: { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null },
      day: { tz: 'America/New_York', start_min: 1080 },
    });
    expect(toResolvedJson(after.accounts.find((a) => a.id === ids.ebx)!.current)).toEqual({
      v: 1,
      market: 'binary',
      windows: [{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1260, weekdays: 31 }],
      windows_from: 'market',
      window_rule: { on: true, outside: 'fora' },
      block: null,
      limit: null,
      states: null,
      day: { tz: 'America/Sao_Paulo', start_min: 0 },
    });
    const now = parseRulesNow(asUser(uid, 'public.rules_now()'));
    expect(now.accounts.map((a) => a.version?.versionNo)).toEqual([1, 1]);
    expect(now.accounts.every((a) => a.desdeDay !== null && a.rules !== null)).toBe(true);
  });

  it('versions only the accounts a default change reaches', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windowRule.outside = 'aviso';
    draft.markets.futures.windows.push({ tz: 'America/New_York', startMin: 840, endMin: 900, weekdays: MON_TO_FRI });
    const payload = buildSavePayload(before, draft)!;
    expect(Object.keys(payload.defaults!)).toEqual(['futures']);
    expect(payload.accounts).toBeUndefined();
    const { result } = save(before, draft, payload);
    expect(result.versions.map((v) => [v.accountId, v.versionNo])).toEqual([[ids.top, 2]]);
    expect(result.unchanged).toEqual([ids.ebx]);
  });

  it('keeps «só nesta conta» keys and the own window; a value equal to the default is not stored', () => {
    const before = config();
    const top = before.accounts.find((a) => a.id === ids.top)!;
    let draft = withAccountRule(before.settings, top, { windowRule: { outside: 'fora' }, block: { beforeMin: 15 } });
    draft = withAccountRule(draft, top, { block: { on: true } }); // equal to the default: not stored
    draft.accounts[ids.top] = {
      ...draft.accounts[ids.top],
      window: { tz: 'America/New_York', startMin: 570, endMin: 660, weekdays: MON_TO_FRI },
    };
    const payload = buildSavePayload(before, draft)!;
    expect(payload.accounts![ids.top].rules).toEqual({
      v: 1,
      window_rule: { outside: 'fora' },
      block: { before_min: 15 },
      limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' },
    });
    const { after } = save(before, draft, payload);
    const cur = after.accounts.find((a) => a.id === ids.top)!.current;
    expect(cur.windowsFrom).toBe('account');
    expect(cur.windows).toHaveLength(1);
  });

  it('saves state texts without a version, and a state choice with one', () => {
    let before = config();
    let draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.states.alinhadas = { choice: null, text: 'Só com a tendência do dia.' };
    let { result } = save(before, draft, buildSavePayload(before, draft)!);
    expect(result.versions).toEqual([]);

    before = config();
    draft = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.states.alinhadas = { choice: 'so_a_favor', text: 'Só com a tendência do dia.' };
    draft.markets.futures.states.em_conflito = { choice: 'nao_opero', text: '' };
    ({ result } = save(before, draft, buildSavePayload(before, draft)!));
    expect(result.versions.map((v) => v.versionNo)).toEqual([4]);
  });

  it('copies the calendars into futures versions only; «Horários na tela» versions nothing', () => {
    let before = config();
    let draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.calendars = ['br', 'us'];
    let payload = buildSavePayload(before, draft)!;
    expect(payload.preferences).toEqual({ calendars: ['us', 'br'] });
    draft.calendars = ['us', 'br'];
    let { result } = save(before, draft, payload);
    expect(result.versions.map((v) => v.accountId)).toEqual([ids.top]);

    before = config();
    draft = JSON.parse(JSON.stringify(before.settings));
    draft.displayTz = 'both';
    payload = buildSavePayload(before, draft)!;
    expect(payload).toEqual({ v: 1, base_rev: before.rev, preferences: { display_tz: 'both' } });
    ({ result } = save(before, draft, payload));
    expect(result.versions).toEqual([]);
    expect(config().preferences.display_tz).toBe('both');
  });

  it('saves a limit with cents and «Só avisar», then no limit', () => {
    let before = config();
    let draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.accounts[ids.top].limit = { cents: 40050, mode: 'conta', atLimit: 'avisar' };
    let { after } = save(before, draft, buildSavePayload(before, draft)!);
    expect(after.accounts.find((a) => a.id === ids.top)!.current.limit).toEqual({ cents: 40050, mode: 'conta', atLimit: 'avisar' });

    before = config();
    draft = JSON.parse(JSON.stringify(before.settings));
    draft.accounts[ids.top].limit = null;
    ({ after } = save(before, draft, buildSavePayload(before, draft)!));
    expect(after.accounts.find((a) => a.id === ids.top)!.current.limit).toBeNull();
  });

  it('refuses a payload built on a stale configuration', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.binary.windowRule.outside = 'aviso';
    const stale = { ...buildSavePayload(before, draft)!, base_rev: 'none' };
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(stale)})`))).toBe('rules_changed');
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit({ ...stale, base_rev: undefined })})`))).toBe('base_rev_required');
  });

  it('refuses a draft with a window error before anything is sent', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.binary.windows[0].endMin = draft.markets.binary.windows[0].startMin;
    expect(() => buildSavePayload(before, draft)).toThrow(InvalidSettingsError);
  });

  it('gives a new account v1 at creation: a copy of another account, and a market window set by the form', () => {
    ids.apex = randomUUID();
    // Created as the hub creates it: a REST insert under row-level security
    asUserExec(
      uid,
      `insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min)
       values ('${ids.apex}', '${uid}', 'futures', 'Apex A', 'America/New_York', 1080);`,
    );
    let before = config();
    const settings = copyAccountSettings(before.settings, ids.top);
    let payload = buildNewAccountPayload(before, { accountId: ids.apex, market: 'futures', settings, copiedFrom: ids.top });
    let draft: RulesSettings = { ...before.settings, accounts: { ...before.settings.accounts, [ids.apex]: settings } };
    let { result, after } = save(before, draft, payload, [ids.apex]);
    expect(result.versions.map((v) => [v.accountId, v.versionNo, v.origin])).toEqual([[ids.apex, 1, 'copiar']]);
    expect(after.accounts.find((a) => a.id === ids.apex)!.versions[0].copiedFrom).toBe(ids.top);

    // A user whose market has no window yet: the form's window becomes the market's
    const uid2 = randomUUID();
    const acc2 = randomUUID();
    psql(`insert into auth.users (id, email) values ('${uid2}', 'regras2-${uid2}@example.test');
insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, is_primary)
values ('${acc2}', '${uid2}', 'binary', 'Pocket', 'America/Sao_Paulo', 0, true);`);
    try {
      before = parseRulesConfig(asUser(uid2, 'public.rules_config()'));
      const w = { tz: 'America/Sao_Paulo' as const, startMin: 1320, endMin: 120, weekdays: MON_TO_FRI };
      payload = buildNewAccountPayload(before, {
        accountId: acc2,
        market: 'binary',
        settings: { windowRule: {}, block: {}, limit: { cents: 5000, mode: 'conta', atLimit: 'encerrar' }, window: null },
        marketWindows: [w],
      });
      draft = JSON.parse(JSON.stringify(before.settings));
      draft.markets.binary.windows = [w];
      draft.accounts[acc2].limit = { cents: 5000, mode: 'conta', atLimit: 'encerrar' };
      expect(pendingVersions(before, draft, { force: [acc2] }).map((p) => p.versionNo)).toEqual([1]);
      const r = parseSaveResult(asUser(uid2, `public.save_rules(${lit(payload)})`));
      expect(r.versions.map((v) => [v.versionNo, v.origin])).toEqual([[1, 'criar']]);
      after = parseRulesConfig(asUser(uid2, 'public.rules_config()'));
      expect(sameRules(after.accounts[0].current, resolveRules(after.accounts[0], draft))).toBe(true);
      expect(after.accounts[0].current.windowsFrom).toBe('market');
    } finally {
      psql(`delete from auth.users where id = '${uid2}';`);
    }
  });

  it('starts the rules today for an account whose settings are already right («force»)', () => {
    ids.apexB = randomUUID();
    psql(`insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min)
values ('${ids.apexB}', '${uid}', 'futures', 'Apex B', 'America/New_York', 1080);`);
    const before = config();
    expect(buildSavePayload(before, before.settings)).toBeNull();
    const payload = buildSavePayload(before, before.settings, { force: [ids.apexB] })!;
    expect(payload.accounts![ids.apexB].version).toBe('force');
    const { result } = save(before, before.settings, payload, [ids.apexB]);
    expect(result.versions.map((v) => [v.accountId, v.versionNo, v.origin])).toEqual([[ids.apexB, 1, 'criar']]);
  });

  it('versions an archived account a default change reaches, without sending it', () => {
    psql(`update public.trading_accounts set archived_at = now() where id = '${ids.apexB}';`);
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.block = { on: true, beforeMin: 5, afterMin: 20 };
    const payload = buildSavePayload(before, draft)!;
    expect(Object.keys(payload.accounts ?? {})).not.toContain(ids.apexB);
    const { result } = save(before, draft, payload);
    expect(result.versions.map((v) => v.accountId)).toContain(ids.apexB);
    expect(result.versions.map((v) => v.accountId)).toContain(ids.top);
  });

  it('merges the instant preferences without touching what the save bar owns', () => {
    const merged = asUser(uid, `public.merge_preferences(${lit({ theme: 'escuro', conta_atual: ids.top })})`) as Record<string, unknown>;
    expect(merged).toMatchObject({ theme: 'escuro', conta_atual: ids.top, display_tz: 'both', calendars: ['us', 'br'] });
    expect(codeOf(() => asUser(uid, `public.merge_preferences(${lit({ calendars: ['us'] })})`))).toBe('unknown_key');
    const c = config();
    expect(c.preferences.theme).toBe('escuro');
    // The merge is not a rules save: the revision does not move
    expect(buildSavePayload(c, c.settings)).toBeNull();
  });

  it('carries a page’s draft over a save this tab made meanwhile (a new account’s v1), and saves it', () => {
    const page = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(page.settings));
    draft.markets.binary.windowRule.outside = draft.markets.binary.windowRule.outside === 'aviso' ? 'fora' : 'aviso';
    // Meanwhile the import sheet creates an account and saves its v1
    ids.apexC = randomUUID();
    asUserExec(
      uid,
      `insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min)
       values ('${ids.apexC}', '${uid}', 'futures', 'Apex C', 'America/New_York', 1080);`,
    );
    const sheet = config();
    const v1 = parseSaveResult(
      asUser(uid, `public.save_rules(${lit(buildNewAccountPayload(sheet, { accountId: ids.apexC, market: 'futures', settings: copyAccountSettings(sheet.settings, ids.top), copiedFrom: ids.top }))})`),
    );
    expect(v1.versions.map((v) => [v.accountId, v.versionNo])).toEqual([[ids.apexC, 1]]);
    // The page's own payload is now stale
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(buildSavePayload(page, draft))})`))).toBe('rules_changed');
    // Rebased on the new rules_config, it saves only the page's change, with the new account as saved
    const now = config();
    const rebased = rebaseSettings(now.accounts, page.settings, now.settings, draft);
    expect(sameAccount('futures', rebased.accounts[ids.apexC], now.settings.accounts[ids.apexC])).toBe(true);
    const payload = buildSavePayload(now, rebased)!;
    expect(Object.keys(payload)).toEqual(['v', 'base_rev', 'defaults']);
    expect(Object.keys(payload.defaults!)).toEqual(['binary']);
    const { result } = save(now, rebased, payload);
    expect(result.versions.map((v) => v.accountId)).toEqual([ids.ebx]);
  });

  it('rules_now lists accounts of every market, and parseRulesNow keeps every one (Fase 2b)', () => {
    const forex = randomUUID();
    psql(`insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, sort_order)
values ('${forex}', '${uid}', 'forex', 'Forex', 'America/Sao_Paulo', 0, 5);`);
    // The insert trigger sets the market's day clock, whatever the insert sent
    expect(psql(`select day_tz || ' ' || day_start_min || ' ' || currency from public.trading_accounts where id = '${forex}';`).trim()).toBe(
      'America/New_York 1020 USD',
    );
    const json = asUser(uid, 'public.rules_now()') as { accounts: { account_id: string }[] };
    expect(json.accounts.map((a) => a.account_id)).toContain(forex);
    const now = parseRulesNow(json);
    expect(now.accounts.map((a) => a.accountId)).toEqual(json.accounts.map((a) => a.account_id));
    const fx = now.accounts.find((a) => a.accountId === forex)!;
    expect([fx.market, fx.version, fx.rules, fx.gate.status]).toEqual(['forex', null, null, null]);
    // rules_config lists it too, with its own day clock, and resolves it as the TS side does
    const c = config();
    const a = c.accounts.find((x) => x.id === forex)!;
    expect(a.day).toEqual({ tz: 'America/New_York', startMin: 1020 });
    expect(sameRules(a.current, resolveRules(a, c.settings))).toBe(true);
  });
});

describePg('seven markets × the real SQL (Fase 2b)', () => {
  const uid = randomUUID();
  const ids: Record<string, string> = {};
  const config = () => parseRulesConfig(asUser(uid, 'public.rules_config()'));
  const NY = 'America/New_York' as const;
  const SP = 'America/Sao_Paulo' as const;

  /** Saves for real; every account's SQL current must equal TS resolveRules on the draft */
  function save(before: RulesConfig, draft: RulesSettings, payload: SaveRulesPayload, force: string[] = []) {
    const predicted = pendingVersions(before, draft, { force })
      .map((p) => `${p.accountId}:v${p.versionNo}`)
      .sort();
    const real = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)})`));
    expect(real.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const after = config();
    for (const a of after.accounts) expect(canon(toResolvedJson(a.current))).toBe(canon(toResolvedJson(resolveRules(a, draft))));
    for (const m of ACCOUNT_MARKETS) expect(sameMarket(m, after.settings.markets[m], draft.markets[m])).toBe(true);
    for (const a of after.accounts) expect(sameAccount(a.market, after.settings.accounts[a.id], draft.accounts[a.id])).toBe(true);
    expect(buildSavePayload(after, draft)).toBeNull();
    return { result: real, after };
  }

  beforeAll(async () => {
    ids.top = randomUUID();
    ids.ebx = randomUUID();
    psql(`insert into auth.users (id, email) values ('${uid}', 'mercados-${uid}@example.test');
insert into public.profiles (id, email) values ('${uid}', 'mercados-${uid}@example.test');
insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, is_primary, sort_order) values
  ('${ids.top}', '${uid}', 'futures', 'Top One #1', 'America/New_York', 1080, false, 0),
  ('${ids.ebx}', '${uid}', 'binary', 'Ebinex', 'America/Sao_Paulo', 0, true, 0);`);
    // The owner's Phase 2 rules first: futures and binary windows, Top One US$ 400
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windows = [{ tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI }];
    draft.markets.binary.windows = [{ tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }];
    draft.accounts[ids.top] = { ...draft.accounts[ids.top], limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } };
    parseSaveResult(asUser(uid, `public.save_rules(${lit(buildSavePayload(before, draft))})`));
    // Then one account in each new market, created as the hub creates them
    for (const [key, market, label] of [
      ['fx', 'forex', 'FTMO'],
      ['us', 'stocks', 'IBKR'],
      ['cr', 'crypto', 'Binance'],
      ['b3', 'b3', 'Clear'],
    ] as const) {
      ids[key] = await createAccountAsUser(uid, {
        market,
        label,
        platform: null,
        firm: null,
        external_ref: null,
        phase: 'pessoal',
        size: null,
        is_primary: false,
      });
    }
  });

  afterAll(() => {
    if (URL) psql(`delete from auth.users where id = '${uid}';`);
  });

  it('reads a builtin and a default for every market, and every account with its market’s day clock', () => {
    const c = config();
    expect(Object.keys(c.builtin).sort()).toEqual([...ACCOUNT_MARKETS].sort());
    expect(c.savedMarkets).toEqual({ futures: true, binary: true, forex: false, stocks: false, crypto: false, b3: false, options: false });
    for (const m of ACCOUNT_MARKETS.filter((x) => x !== 'futures')) {
      expect(c.builtin[m]).toEqual({ windowRule: { on: true, outside: 'fora' }, block: null, states: {}, windows: [] });
    }
    for (const key of ['fx', 'us', 'cr', 'b3']) {
      const a = c.accounts.find((x) => x.id === ids[key])!;
      expect(a.day).toEqual(MARKET_SPEC[a.market].day);
      expect(a.versions).toEqual([]);
      expect(sameRules(a.current, resolveRules(a, c.settings))).toBe(true);
    }
    // Nothing to save: no spurious defaults for the markets never saved (C13)
    expect(buildSavePayload(c, c.settings)).toBeNull();
  });

  it('gives each new account v1 at creation with the market’s window and a limit in the market’s currency', () => {
    const plan: [string, 'forex' | 'stocks' | 'crypto' | 'b3', number | null][] = [
      ['fx', 'forex', 100000],
      ['us', 'stocks', 25000],
      ['cr', 'crypto', null],
      ['b3', 'b3', 50000],
    ];
    for (const [key, market, cents] of plan) {
      const before = config();
      const w = { ...JANELA_SUGERIDA[market] };
      const settings = { windowRule: {}, block: {}, limit: cents === null ? null : { cents, mode: 'conta' as const, atLimit: 'encerrar' as const }, window: null };
      const payload = buildNewAccountPayload(before, { accountId: ids[key], market, settings, marketWindows: [w] });
      const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
      draft.markets[market].windows = [w];
      draft.accounts[ids[key]] = settings;
      const { result, after } = save(before, draft, payload, [ids[key]]);
      // Only this account is versioned: the owner's futures and binary accounts are untouched
      expect(result.versions.map((v) => [v.accountId, v.versionNo, v.origin])).toEqual([[ids[key], 1, 'criar']]);
      expect(result.unchanged).toEqual(expect.arrayContaining([ids.top, ids.ebx]));
      const a = after.accounts.find((x) => x.id === ids[key])!;
      expect(a.current.block).toBeNull();
      expect(a.current.states).toBeNull();
      expect(a.current.windowsFrom).toBe('market');
    }
    // The B3 limit is stored in reais (`brl`), the others in dollars
    const stored = (id: string) =>
      JSON.parse(psql(`select jsonb_build_object('s', s.rules->'limit', 'v', v.resolved->'limit')::text from public.account_rule_settings s
        join public.account_rule_versions v on v.account_id = s.account_id where s.account_id = '${id}';`).trim());
    expect(stored(ids.b3)).toEqual({ s: { brl: 500, mode: 'conta', at_limit: 'encerrar' }, v: { brl: 500, mode: 'conta', at_limit: 'encerrar' } });
    expect(stored(ids.fx)).toEqual({ s: { usd: 1000, mode: 'conta', at_limit: 'encerrar' }, v: { usd: 1000, mode: 'conta', at_limit: 'encerrar' } });
    // Crypto's suggested window opens every day
    expect(config().settings.markets.crypto.windows).toEqual([{ tz: SP, startMin: 1200, endMin: 1320, weekdays: EVERY_DAY }]);
  });

  it('saves a later change of one market without versioning the accounts of the others', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.forex.windows.push({ tz: NY, startMin: 180, endMin: 300, weekdays: MON_TO_FRI });
    draft.accounts[ids.b3] = { ...draft.accounts[ids.b3], limit: { cents: 75050, mode: 'conta', atLimit: 'avisar' } };
    const payload = buildSavePayload(before, draft)!;
    expect(Object.keys(payload.defaults!)).toEqual(['forex']);
    expect(payload.accounts![ids.b3].rules.limit).toEqual({ brl: 750.5, mode: 'conta', at_limit: 'avisar' });
    const { result, after } = save(before, draft, payload);
    expect(result.versions.map((v) => [v.accountId, v.versionNo]).sort()).toEqual([[ids.b3, 2], [ids.fx, 2]].sort());
    expect(result.unchanged).toEqual(expect.arrayContaining([ids.top, ids.ebx, ids.us, ids.cr]));
    expect(after.accounts.find((a) => a.id === ids.b3)!.current.limit).toEqual({ cents: 75050, mode: 'conta', atLimit: 'avisar' });
  });

  it('refuses what the market does not have: a block or «somando» outside futures, the wrong currency key', () => {
    const before = config();
    const fx = (rules: unknown) => ({ v: 1, base_rev: before.rev, accounts: { [ids.fx]: { rules, window: null } } });
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(fx({ v: 1, block: { on: true } }))}, true)`))).toBe('not_for_market');
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(fx({ v: 1, limit: { usd: 100, mode: 'soma', at_limit: 'encerrar' } }))}, true)`))).toBe(
      'not_for_market',
    );
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(fx({ v: 1, limit: { brl: 100, mode: 'conta', at_limit: 'encerrar' } }))}, true)`))).toBe(
      'bad_limit',
    );
    const b3 = { v: 1, base_rev: before.rev, accounts: { [ids.b3]: { rules: { v: 1, limit: { usd: 100, mode: 'conta', at_limit: 'encerrar' } }, window: null } } };
    expect(codeOf(() => asUser(uid, `public.save_rules(${lit(b3)}, true)`))).toBe('bad_limit');
  });

  it('answers «Posso operar hoje?» for every account, the B3 limit in reais', () => {
    // Two invented Clear losses on Mon 19 Oct, in reais: −R$ 300 out at 10:20 and −R$ 500 out at 10:40 de Brasília
    psql(`insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time,
  entry_price, exit_price, quantity, result, pnl, commission, source) values
  ('${uid}', '${ids.b3}', 'WINZ26', 'futures', 'long', '2026-10-19 13:05:00+00', '2026-10-19 13:20:00+00', 130000, 129850, 1, 'loss', -300, null, 'after'),
  ('${uid}', '${ids.b3}', 'WINZ26', 'futures', 'short', '2026-10-19 13:25:00+00', '2026-10-19 13:40:00+00', 129800, 130050, 1, 'loss', -500, null, 'after');`);
    const at = '2026-10-19T13:45:00Z';
    const now = parseRulesNow(
      asUser(uid, `jsonb_build_object('server_now', '${at}'::timestamptz, 'accounts', jsonb_build_array(${['top', 'ebx', 'fx', 'us', 'cr', 'b3'].map((k) => `public.gate_at('${ids[k]}', '${at}')`).join(', ')}))`),
    );
    expect(now.accounts.map((a) => a.market)).toEqual(['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3']);
    const clear = now.accounts.find((a) => a.accountId === ids.b3)!;
    // v2 (R$ 750,50, «Só avisar»): the worst point −R$ 800 is past it, reached at the second exit
    expect(clear.today).toEqual({ trades: 2, netCents: -80000, worstCents: -80000 });
    expect(clear.gate.limit).toMatchObject({ evaluated: true, state: 'atingido', cents: 75050, worstCents: -80000, hitAt: new Date('2026-10-19T13:40:00Z') });
    expect(possoLinha('Clear', clear.gate, clear.rules).limite).toEqual({
      usado: 'R$ 800',
      de: 'de R$ 750,50',
      aria: 'Clear, limite do dia: R$ 800 de R$ 750,50.',
      indisponivel: false,
    });
    // FTMO inside its 08:00–10:00 ET window (09:45 ET), the window clock New York
    const ftmo = now.accounts.find((a) => a.accountId === ids.fx)!;
    expect(possoTexto(possoLinha('FTMO', ftmo.gate, ftmo.rules))).toBe('Liberado · até 10:00 ET');
  });
});

describePg('seven markets × the real SQL: every Personalizar edit, a copy, legacy accounts (Fase 2b)', () => {
  const uid = randomUUID();
  const ids: Record<string, string> = {};
  const config = () => parseRulesConfig(asUser(uid, 'public.rules_config()'));
  const clone = (s: RulesSettings): RulesSettings => JSON.parse(JSON.stringify(s));
  const NY = 'America/New_York' as const;
  const SP = 'America/Sao_Paulo' as const;

  /** Dry run then for real: the predicted versions, SQL = TS for every account and version, the round trip */
  function save(before: RulesConfig, draft: RulesSettings, payload: SaveRulesPayload, force: string[] = []) {
    const predicted = pendingVersions(before, draft, { force })
      .map((p) => `${p.accountId}:v${p.versionNo}`)
      .sort();
    const dry = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)}, true)`));
    expect(dry.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const real = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)})`));
    expect(real.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const after = config();
    for (const a of after.accounts) {
      expect(canon(toResolvedJson(a.current))).toBe(canon(toResolvedJson(resolveRules(a, draft))));
      // The TS validator accepts what the SQL one stored
      for (const v of a.versions) expect(checkRules(toResolvedJson(v.rules))).toBeNull();
    }
    for (const m of ACCOUNT_MARKETS) expect(sameMarket(m, after.settings.markets[m], draft.markets[m])).toBe(true);
    for (const a of after.accounts) expect(sameAccount(a.market, after.settings.accounts[a.id], draft.accounts[a.id])).toBe(true);
    expect(buildSavePayload(after, draft)).toBeNull();
    return { result: real, after };
  }

  beforeAll(async () => {
    psql(`insert into auth.users (id, email) values ('${uid}', 'edicoes-${uid}@example.test');
insert into public.profiles (id, email) values ('${uid}', 'edicoes-${uid}@example.test');`);
    for (const [key, market, label] of [
      ['fx', 'forex', 'FTMO'],
      ['us', 'stocks', 'IBKR'],
      ['cr', 'crypto', 'Binance'],
      ['b3', 'b3', 'Clear'],
    ] as const) {
      ids[key] = await createAccountAsUser(uid, {
        market,
        label,
        platform: null,
        firm: null,
        external_ref: null,
        phase: 'pessoal',
        size: null,
        is_primary: false,
      });
    }
    // Phase 1 backfill accounts made before migration 20261019000001 (its trigger would refuse
    // `options` and reset the clock): midnight in Brasília, as the backfill wrote them
    ids.op = randomUUID();
    ids.fxOld = randomUUID();
    psql(`begin;
alter table public.trading_accounts disable trigger trading_accounts_by_market;
insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, legacy_market_type, sort_order) values
  ('${ids.op}', '${uid}', 'options', 'Opções antigas', 'America/Sao_Paulo', 0, 'options', 9),
  ('${ids.fxOld}', '${uid}', 'forex', 'Forex antigo', 'America/Sao_Paulo', 0, 'forex', 8);
alter table public.trading_accounts enable trigger trading_accounts_by_market;
commit;`);
  });

  afterAll(() => {
    if (URL) psql(`delete from auth.users where id = '${uid}';`);
  });

  it('reads legacy options and forex accounts on their own clock (C19)', () => {
    const c = config();
    expect(c.accounts.find((a) => a.id === ids.op)).toMatchObject({ market: 'options', day: { tz: SP, startMin: 0 } });
    expect(c.accounts.find((a) => a.id === ids.fxOld)).toMatchObject({ market: 'forex', day: { tz: SP, startMin: 0 } });
    for (const a of c.accounts) expect(sameRules(a.current, resolveRules(a, c.settings))).toBe(true);
    expect(buildSavePayload(c, c.settings)).toBeNull();
  });

  it('saves each Personalizar edit of a new market as the SQL resolves it', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    for (const [m, key] of [
      ['forex', 'fx'],
      ['stocks', 'us'],
      ['crypto', 'cr'],
      ['b3', 'b3'],
    ] as const) {
      // «+ Definir janela», «+ Segunda janela»
      let before = config();
      let draft = segundaJanela(definirJanela(clone(before.settings), m), m);
      save(before, draft, buildSavePayload(before, draft)!);
      // «Relógio da janela» to the other clock (every window and the own windows), a day pill
      before = config();
      const other = before.settings.markets[m].windows[0].tz === NY ? SP : NY;
      draft = alternarDia(trocarRelogio(clone(before.settings), m, other, now, [ids[key]]), m, 0, 6);
      save(before, draft, buildSavePayload(before, draft)!);
      // An own overnight window every day, «Fora da janela, mostrar» aviso, a limit that only warns
      before = config();
      const acc = before.accounts.find((a) => a.id === ids[key])!;
      draft = ajustarSoNestaConta(clone(before.settings), acc);
      draft = comJanelaDaConta(draft, acc.id, { startMin: 1320, endMin: 120, weekdays: EVERY_DAY });
      draft = comRegraJanela(draft, { tipo: 'conta', conta: acc }, { outside: 'aviso' });
      draft = comAoChegar(comLimite(draft, acc.id, 123456), acc.id, 'avisar');
      const payload = buildSavePayload(before, draft)!;
      expect(payload.accounts![acc.id].rules.limit).toEqual({ [m === 'b3' ? 'brl' : 'usd']: 1234.56, mode: 'conta', at_limit: 'avisar' });
      save(before, draft, payload);
      // The largest limit, then the window rule off
      before = config();
      draft = comLimite(clone(before.settings), acc.id, MAX_LIMIT_CENTS);
      save(before, draft, buildSavePayload(before, draft)!);
      before = config();
      draft = comRegraJanela(clone(before.settings), { tipo: 'conta', conta: acc }, { on: false });
      const { after } = save(before, draft, buildSavePayload(before, draft)!);
      // A version note of a new market has no block, state or calendar part; B3 money in reais
      const partes = partesVersao(after.accounts.find((a) => a.id === acc.id)!.current);
      expect([partes.bloq, partes.est, partes.cal]).toEqual([undefined, undefined, undefined]);
      expect(partes.lim).toBe(`limite ${m === 'b3' ? 'R$' : 'US$'}${NBSP}1.000.000, só avisa`);
    }
  });

  it('copies a B3 account into a new one: v1 «copiar», the limit stored in reais', async () => {
    const id = await createAccountAsUser(uid, {
      market: 'b3',
      label: 'XP',
      platform: 'profit',
      firm: null,
      external_ref: null,
      phase: 'pessoal',
      size: '5000',
      is_primary: false,
    });
    const before = config();
    const settings = copyAccountSettings(before.settings, ids.b3);
    const draft = clone(before.settings);
    draft.accounts[id] = settings;
    const { result } = save(before, draft, buildNewAccountPayload(before, { accountId: id, market: 'b3', settings, copiedFrom: ids.b3 }), [id]);
    expect(result.versions.map((v) => [v.accountId, v.versionNo, v.origin])).toEqual([[id, 1, 'copiar']]);
    expect(JSON.parse(psql(`select (rules->'limit')::text from public.account_rule_settings where account_id = '${id}';`).trim())).toEqual({
      brl: 1000000,
      mode: 'conta',
      at_limit: 'avisar',
    });
  });

  it('versions a legacy forex account on its own clock when the forex default changes; an options limit in dollars', () => {
    let before = config();
    let draft = definirJanela(comLimite(clone(before.settings), ids.op, 50000), 'options');
    save(before, draft, buildSavePayload(before, draft)!);
    before = config();
    draft = clone(before.settings);
    draft.markets.forex.windows = [{ tz: NY, startMin: 420, endMin: 600, weekdays: MON_TO_FRI }];
    const { result, after } = save(before, draft, buildSavePayload(before, draft)!);
    expect(result.versions.map((v) => v.accountId)).toEqual([ids.fxOld]);
    expect(after.accounts.find((a) => a.id === ids.fxOld)!.current.day).toEqual({ tz: SP, startMin: 0 });
    const now = parseRulesNow(asUser(uid, 'public.rules_now()'));
    expect(new Set(now.accounts.map((a) => a.market))).toEqual(new Set(['forex', 'stocks', 'crypto', 'b3', 'options']));
    const op = now.accounts.find((a) => a.accountId === ids.op)!;
    expect(possoLinha(op.label, op.gate, op.rules).limite?.de).toBe(`de US$${NBSP}500`);
  });
});

/**
 * BH_PG_RECORD=<dir>: writes the answers testing/fixtures/regras holds (the owner's accounts before
 * and after the Phase 2 save, and rules_now at the owner's test times), from invented data.
 */
const describeRecord = URL && RECORD ? describe : describe.skip;

describeRecord('fixtures for the screens', () => {
  const uid = randomUUID();
  const top = randomUUID();
  const ebx = randomUUID();
  const write = (name: string, json: unknown) => fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');

  afterAll(() => {
    psql(`delete from auth.users where id = '${uid}';`);
  });

  it('records the owner’s configuration and answers', () => {
    psql(`insert into auth.users (id, email) values ('${uid}', 'dono-${uid}@example.test');
insert into public.profiles (id, email) values ('${uid}', 'dono-${uid}@example.test');
insert into public.trading_accounts (id, user_id, market, label, phase, day_tz, day_start_min, is_primary, sort_order) values
  ('${top}', '${uid}', 'futures', 'Top One #1', 'financiada', 'America/New_York', 1080, false, 0),
  ('${ebx}', '${uid}', 'binary', 'Ebinex', 'pessoal', 'America/Sao_Paulo', 0, true, 1);`);
    const antes = asUser(uid, 'public.rules_config()');
    write('config-antes', antes);
    // Before any save: no version, nothing evaluated («Sem janela salva · Definir»)
    write(
      'agora-antes-seg-0930-et',
      asUser(
        uid,
        `jsonb_build_object('server_now', '2026-10-19T13:30:00Z'::timestamptz, 'accounts', jsonb_build_array(public.gate_at('${top}', '2026-10-19T13:30:00Z'), public.gate_at('${ebx}', '2026-10-19T13:30:00Z')))`,
      ),
    );
    const before = parseRulesConfig(antes);
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windows = [{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }];
    draft.markets.binary.windows = [{ tz: 'America/Sao_Paulo', startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }];
    draft.accounts[top] = { ...draft.accounts[top], limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } };
    write('save-dono', asUser(uid, `public.save_rules(${lit(buildSavePayload(before, draft))})`));
    write('config-depois', asUser(uid, 'public.rules_config()'));
    // Two invented Top One trades on Mon 19 Oct: −US$ 250 at 10:12 ET and −US$ 180 at 10:31 ET
    psql(`insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time,
  entry_price, exit_price, quantity, result, pnl, commission, source) values
  ('${uid}', '${top}', 'MESZ6', 'futures', 'long', '2026-10-19 14:05:00+00', '2026-10-19 14:12:00+00', 5800, 5775, 2, 'loss', -250, null, 'after'),
  ('${uid}', '${top}', 'MESZ6', 'futures', 'short', '2026-10-19 14:20:00+00', '2026-10-19 14:31:00+00', 5770, 5788, 2, 'loss', -180, null, 'after');`);
    const at = (iso: string) =>
      asUser(
        uid,
        `jsonb_build_object('server_now', '${iso}'::timestamptz, 'accounts', jsonb_build_array(public.gate_at('${top}', '${iso}'), public.gate_at('${ebx}', '${iso}')))`,
      );
    // Mon 19 Oct 2026, the week after the save (the versions start when this runs, on the 17th)
    write('agora-seg-0930-et', at('2026-10-19T13:30:00Z'));
    write('agora-seg-1005-et', at('2026-10-19T14:05:00Z'));
    write('agora-seg-1045-et', at('2026-10-19T14:45:00Z'));
    write('agora-seg-2030-brt', at('2026-10-19T23:30:00Z'));
    write('agora-sab-1200-et', at('2026-10-24T16:00:00Z'));
    expect(true).toBe(true);
  });
});

/**
 * BH_PG_RECORD=<dir>, Fase 2b: the owner's two accounts beside one account in each new market,
 * invented as the boards draw them (Início «Posso operar hoje?», Personalizar), for the screens'
 * tests of the new markets:
 *
 *   contas-mercados                   the trading_accounts rows as fetchAccounts reads them
 *   config-mercados                   rules_config()
 *   agora-mercados-seg-0830-et        gate_at of every account at Mon 19 Oct 2026 08:30 ET
 *
 * Top One #1 (futures, Financiada, v1 10:00–11:00 ET seg–sex, US$ 400) and Ebinex (binary, no
 * version) as Phase 2; FTMO (forex, Avaliação, firm FTMO, MetaTrader 5, v1 08:00–10:00 ET seg–sex,
 * US$ 1.000), IBKR (stocks, Pessoal, Interactive Brokers, no version), Binance (crypto, Pessoal,
 * v1 20:00–22:00 de Brasília every day, no limit), Clear (b3, Pessoal, Profit, v1 10:00–11:00 de
 * Brasília seg–sex, R$ 500). The four are created as the hub creates them (createAccount's row,
 * then buildNewAccountPayload with the market's suggested window), and no trade is recorded.
 */
describeRecord('fixtures for the screens: new markets', () => {
  const uid = randomUUID();
  const ids: Record<string, string> = {};
  const write = (name: string, json: unknown) => fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
  const config = () => parseRulesConfig(asUser(uid, 'public.rules_config()'));

  afterAll(() => {
    psql(`delete from auth.users where id = '${uid}';`);
  });

  it('records the owner’s accounts in six markets and their answers', async () => {
    ids.top = randomUUID();
    ids.ebx = randomUUID();
    psql(`insert into auth.users (id, email) values ('${uid}', 'mercados-${uid}@example.test');
insert into public.profiles (id, email) values ('${uid}', 'mercados-${uid}@example.test');
insert into public.trading_accounts (id, user_id, market, label, phase, day_tz, day_start_min, is_primary, sort_order) values
  ('${ids.top}', '${uid}', 'futures', 'Top One #1', 'financiada', 'America/New_York', 1080, false, 0),
  ('${ids.ebx}', '${uid}', 'binary', 'Ebinex', 'pessoal', 'America/Sao_Paulo', 0, true, 0);`);
    // Top One's v1 (Ebinex keeps no version: no binary window is saved)
    let before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windows = [{ ...JANELA_SUGERIDA.futures }];
    draft.accounts[ids.top] = { ...draft.accounts[ids.top], limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' } };
    parseSaveResult(asUser(uid, `public.save_rules(${lit(buildSavePayload(before, draft))})`));

    const novas = [
      { key: 'fx', market: 'forex', label: 'FTMO', phase: 'avaliacao', firm: 'FTMO', platform: 'mt5', cents: 100000, v1: true },
      { key: 'us', market: 'stocks', label: 'IBKR', phase: 'pessoal', firm: null, platform: 'ibkr', cents: null, v1: false },
      { key: 'cr', market: 'crypto', label: 'Binance', phase: 'pessoal', firm: null, platform: 'binance', cents: null, v1: true },
      { key: 'b3', market: 'b3', label: 'Clear', phase: 'pessoal', firm: null, platform: 'profit', cents: 50000, v1: true },
    ] as const;
    for (const n of novas) {
      ids[n.key] = await createAccountAsUser(uid, {
        market: n.market,
        label: n.label,
        platform: n.platform,
        firm: n.firm,
        external_ref: null,
        phase: n.phase,
        size: null,
        is_primary: false,
      });
      if (!n.v1) continue;
      before = config();
      const settings = {
        windowRule: {},
        block: {},
        limit: n.cents === null ? null : { cents: n.cents, mode: 'conta' as const, atLimit: 'encerrar' as const },
        window: null,
      };
      const payload = buildNewAccountPayload(before, { accountId: ids[n.key], market: n.market, settings, marketWindows: [{ ...JANELA_SUGERIDA[n.market] }] });
      parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)})`));
    }

    write(
      'contas-mercados',
      JSON.parse(
        psql(`select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at), '[]')::text
from (select ${ACCOUNT_COLUMNS} from public.trading_accounts where user_id = '${uid}') t;`).trim(),
      ),
    );
    write('config-mercados', asUser(uid, 'public.rules_config()'));
    const at = '2026-10-19T12:30:00Z';
    const order = ['top', 'ebx', 'fx', 'us', 'cr', 'b3'];
    write(
      'agora-mercados-seg-0830-et',
      asUser(uid, `jsonb_build_object('server_now', '${at}'::timestamptz, 'accounts', jsonb_build_array(${order.map((k) => `public.gate_at('${ids[k]}', '${at}')`).join(', ')}))`),
    );
    expect(true).toBe(true);
  });
});

/**
 * @jest-environment node
 *
 * «Mover para o breakeven com +N» (Phase 3c, 20261023000001_regra_breakeven.sql) through the rules
 * data layer and Personalizar's draft edits, against the real SQL on a throwaway local Postgres.
 * Skipped unless BH_PG_URL points at one (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres npx jest --ci __tests__/lib/hubRegrasBreakeven.pg.test.ts
 *
 * For every step the TS payload builder's payload goes to save_rules as a dry run and for real; the
 * versions save_rules creates must be the ones pendingVersions predicted (no version nobody chose:
 * the key is absent while the rule does not act), every account's rules in force must be what
 * resolveRules gives (SQL rules_resolve = TS), and the saved settings must read back as the draft.
 */
import { randomUUID } from 'crypto';
import { MON_TO_FRI } from '@/lib/domain';
import { toResolvedJson } from '@/lib/domain/gate';
import {
  buildSavePayload,
  canon,
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  pendingVersions,
  resolveRules,
  sameAccount,
  sameMarket,
  type AccountConfig,
  type RulesConfig,
  type RulesSettings,
  type SaveRulesPayload,
} from '@/lib/hub/regras';
import { breakevenEfetivo, breakevenMudou, comBreakeven, comBreakevenAtivo, comBreakevenLigado, comJanelaDoMercado, temProprio } from '@/lib/hub/rascunho';
import { PG_URL as URL, asUser, codeOf, lit, psql } from '@/testing/pg';

const describePg = URL ? describe : describe.skip;

describePg('the breakeven rule × the real SQL (Phase 3c)', () => {
  const uid = randomUUID();
  const ids = { top: randomUUID(), apex: randomUUID(), ftmo: randomUUID(), ebx: randomUUID() };
  const config = () => parseRulesConfig(asUser(uid, 'public.rules_config()'));
  const conta = (c: RulesConfig, id: string): { tipo: 'conta'; conta: AccountConfig } => ({ tipo: 'conta', conta: c.accounts.find((a) => a.id === id)! });
  const PADRAO = { tipo: 'padrao' } as const;

  /** Sends the payload as a dry run and for real; the versions must be the predicted ones */
  function save(before: RulesConfig, draft: RulesSettings, payload: SaveRulesPayload, force: string[] = []) {
    const predicted = pendingVersions(before, draft, { force })
      .map((p) => `${p.accountId}:v${p.versionNo}`)
      .sort();
    const dry = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)}, true)`));
    expect(dry.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const real = parseSaveResult(asUser(uid, `public.save_rules(${lit(payload)})`));
    expect(real.versions.map((v) => `${v.accountId}:v${v.versionNo}`).sort()).toEqual(predicted);
    const after = config();
    for (const a of after.accounts) expect(canon(toResolvedJson(a.current))).toBe(canon(toResolvedJson(resolveRules(a, draft))));
    for (const m of ['futures', 'forex', 'binary'] as const) expect(sameMarket(m, after.settings.markets[m], draft.markets[m])).toBe(true);
    for (const a of after.accounts) expect(sameAccount(a.market, after.settings.accounts[a.id], draft.accounts[a.id])).toBe(true);
    expect(buildSavePayload(after, draft)).toBeNull();
    return { versions: real.versions.map((v) => [v.accountId, v.versionNo]), after };
  }

  beforeAll(() => {
    psql(`insert into auth.users (id, email) values ('${uid}', 'be-${uid.slice(0, 8)}@example.test');
insert into public.trading_accounts (id, user_id, market, label, day_tz, day_start_min, is_primary, sort_order) values
  ('${ids.top}', '${uid}', 'futures', 'Top One #1', 'America/New_York', 1080, true, 0),
  ('${ids.apex}', '${uid}', 'futures', 'Apex A', 'America/New_York', 1080, false, 1),
  ('${ids.ftmo}', '${uid}', 'forex', 'FTMO', 'America/New_York', 1020, false, 2),
  ('${ids.ebx}', '${uid}', 'binary', 'Ebinex', 'America/Sao_Paulo', 0, false, 3);`);
  });

  afterAll(() => {
    if (URL) psql(`delete from auth.users where id = '${uid}';`);
  });

  it('v1 for every account without the rule: nine keys, as before Phase 3c', () => {
    const before = config();
    const draft: RulesSettings = JSON.parse(JSON.stringify(before.settings));
    draft.markets.futures.windows = [{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI }];
    const force = Object.values(ids);
    const { versions, after } = save(before, draft, buildSavePayload(before, draft, { force })!, force);
    expect(versions).toHaveLength(4);
    for (const a of after.accounts) {
      expect('breakeven' in a.current).toBe(false);
      expect(Object.keys(toResolvedJson(a.current))).toHaveLength(9);
    }
    expect(after.settings.markets.futures.breakeven).toBeUndefined();
  });

  it('«Padrão Futuros» MES +10, MNQ +40: a version for each futures account, none for the others', () => {
    const before = config();
    let draft = comBreakevenLigado(before.settings, PADRAO, true);
    draft = comBreakevenAtivo(draft, PADRAO, 'MES', '10');
    draft = comBreakevenAtivo(draft, PADRAO, 'MNQ', '40');
    expect(breakevenMudou(before.settings, draft, PADRAO)).toBe(true);
    expect(breakevenEfetivo(draft, conta(before, ids.top))).toEqual({ setting: { on: true, by: { MES: '10', MNQ: '40' } }, propria: false });
    const payload = buildSavePayload(before, draft)!;
    expect(payload.defaults!.futures!.rules.breakeven).toEqual({ on: true, by: { MES: 10, MNQ: 40 } });
    expect(payload.accounts).toBeUndefined();
    const { versions, after } = save(before, draft, payload);
    expect(versions.sort()).toEqual([[ids.apex, 2], [ids.top, 2]].sort());
    expect(after.accounts.find((a) => a.id === ids.top)!.current.breakeven).toEqual({ by: { MES: { n: '10', un: 'pts' }, MNQ: { n: '40', un: 'pts' } } });
    expect(after.accounts.find((a) => a.id === ids.ftmo)!.current.breakeven).toBeUndefined();
  });

  it('«10,0» is 10 and a toggle off and on is nothing to save', () => {
    const before = config();
    expect(buildSavePayload(before, comBreakevenAtivo(before.settings, PADRAO, 'MES', '10.0'))).toBeNull();
    expect(buildSavePayload(before, comBreakevenLigado(comBreakevenLigado(before.settings, PADRAO, false), PADRAO, true))).toBeNull();
  });

  it('Apex «só nesta conta» MNQ +30, then off, then «Voltar ao padrão»: a version each time, for Apex only', () => {
    let before = config();
    let draft = comBreakeven(before.settings, conta(before, ids.apex), { on: true, by: { MNQ: '30' } });
    expect(temProprio(draft, ids.apex, 'breakeven')).toBe(true);
    expect(buildSavePayload(before, draft)!.accounts![ids.apex].rules.breakeven).toEqual({ on: true, by: { MNQ: 30 } });
    let r = save(before, draft, buildSavePayload(before, draft)!);
    expect(r.versions).toEqual([[ids.apex, 3]]);
    expect(r.after.accounts.find((a) => a.id === ids.apex)!.current.breakeven).toEqual({ by: { MNQ: { n: '30', un: 'pts' } } });

    before = r.after;
    draft = comBreakevenLigado(before.settings, conta(before, ids.apex), false);
    r = save(before, draft, buildSavePayload(before, draft)!);
    expect(r.versions).toEqual([[ids.apex, 4]]);
    expect('breakeven' in r.after.accounts.find((a) => a.id === ids.apex)!.current).toBe(false);

    before = r.after;
    draft = comBreakeven(before.settings, conta(before, ids.apex), null);
    expect(temProprio(draft, ids.apex, 'breakeven')).toBe(false);
    r = save(before, draft, buildSavePayload(before, draft)!);
    expect(r.versions).toEqual([[ids.apex, 5]]);
    expect(r.after.accounts.find((a) => a.id === ids.apex)!.current.breakeven).toEqual({ by: { MES: { n: '10', un: 'pts' }, MNQ: { n: '40', un: 'pts' } } });
  });

  it('an account setting equal to the default is not kept as its own', () => {
    const before = config();
    const draft = comBreakeven(before.settings, conta(before, ids.top), { on: true, by: { MNQ: '40', MES: '10' } });
    expect(temProprio(draft, ids.top, 'breakeven')).toBe(false);
    expect(buildSavePayload(before, draft)).toBeNull();
  });

  it('an unrelated edit versions nobody the rule did not reach', () => {
    const before = config();
    const draft = comJanelaDoMercado(before.settings, 'futures', 0, { endMin: 690 });
    const { versions } = save(before, draft, buildSavePayload(before, draft)!);
    expect(versions.sort()).toEqual([[ids.apex, 6], [ids.top, 3]].sort());
  });

  it('FTMO its own EUR/USD +7,5 pips (no «Padrão» on Forex)', () => {
    const before = config();
    const draft = comBreakeven(before.settings, conta(before, ids.ftmo), { on: true, by: { EURUSD: '7.5', XAUUSD: '1.2' } });
    const { versions, after } = save(before, draft, buildSavePayload(before, draft)!);
    expect(versions).toEqual([[ids.ftmo, 2]]);
    expect(after.accounts.find((a) => a.id === ids.ftmo)!.current.breakeven).toEqual({ by: { EURUSD: { n: '7.5', un: 'pips' }, XAUUSD: { n: '1.2', un: 'price' } } });
    const now = parseRulesNow(asUser(uid, 'public.rules_now()'));
    expect(now.accounts.find((a) => a.accountId === ids.ftmo)!.rules!.breakeven).toEqual({ by: { EURUSD: { n: '7.5', un: 'pips' }, XAUUSD: { n: '1.2', un: 'price' } } });
  });

  it('refuses the rule on binaries and a value that is not above zero', () => {
    const base = config().rev;
    const acct = (id: string, rules: unknown) => lit({ v: 1, base_rev: base, accounts: { [id]: { rules, window: null } } });
    expect(codeOf(() => asUser(uid, `public.save_rules(${acct(ids.ebx, { v: 1, breakeven: { on: true, by: { EURUSD: 5 } } })}, true)`))).toBe('not_for_market');
    expect(codeOf(() => asUser(uid, `public.save_rules(${acct(ids.ftmo, { v: 1, breakeven: { on: true, by: { EURUSD: 0 } } })}, true)`))).toBe('bad_breakeven');
    expect(codeOf(() => asUser(uid, `public.save_rules(${acct(ids.ftmo, { v: 1, breakeven: { on: true, by: { 'EUR/USD': 5 } } })}, true)`))).toBe('bad_breakeven');
  });
});

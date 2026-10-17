/**
 * @jest-environment node
 *
 * The rules data layer against the real SQL (migrations 20261018000001..3), on a throwaway local
 * Postgres. Skipped unless BH_PG_URL points at one: never the hosted project.
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
 */
import { execFileSync } from 'child_process';
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
  resolveRules,
  sameAccount,
  sameMarket,
  sameRules,
  withAccountRule,
  type RulesConfig,
  type RulesSettings,
  type SaveRulesPayload,
} from '@/lib/hub/regras';
import { toResolvedJson } from '@/lib/domain/gate';
import { MON_TO_FRI } from '@/lib/domain';

const URL = process.env.BH_PG_URL;
const PSQL = process.env.BH_PSQL || '/opt/homebrew/opt/postgresql@15/bin/psql';
const RECORD = process.env.BH_PG_RECORD;

const describePg = URL ? describe : describe.skip;

function psql(sql: string): string {
  try {
    return execFileSync(PSQL, [URL as string, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'], {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C', PGOPTIONS: '-c timezone=UTC' },
    }).toString();
  } catch (e) {
    const stderr = String((e as { stderr?: Buffer }).stderr ?? '');
    const m = /ERROR:\s+(\S+)/.exec(stderr);
    const err = new Error(m ? m[1] : stderr);
    (err as Error & { code?: string }).code = m ? m[1] : 'psql';
    throw err;
  }
}

const lastLine = (out: string) => out.trim().split('\n').filter(Boolean).pop() ?? '';

/** A call as the signed-in user, in its own transaction, returning the JSON answer */
function asUser(uid: string, expr: string): unknown {
  return JSON.parse(
    lastLine(
      psql(`begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
select (${expr})::text;
commit;`),
    ),
  );
}

/** Statements as the signed-in user (an insert through the API's row-level security) */
function asUserExec(uid: string, sql: string): void {
  psql(`begin;
select set_config('request.jwt.claim.sub', '${uid}', true);
set local role authenticated;
${sql}
commit;`);
}

const lit = (json: unknown) => `$bh$${JSON.stringify(json)}$bh$::jsonb`;

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'thrown';
  }
}

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
    // The round trip: the saved settings read back as the draft
    for (const m of ['futures', 'binary'] as const) expect(sameMarket(m, after.settings.markets[m], draft.markets[m])).toBe(true);
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
    expect(c.savedMarkets).toEqual({ futures: false, binary: false });
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

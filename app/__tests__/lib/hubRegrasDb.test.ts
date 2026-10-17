/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { HubDataError } from '@/lib/hub/contasDb';
import {
  REGRAS_ERROR_CODES,
  RegrasDataError,
  fetchRulesConfig,
  fetchRulesNow,
  fetchTradesSince,
  mergePreferences,
  saveRules,
  toRegrasError,
} from '@/lib/hub/regrasDb';
import { regrasJson } from '@/testing/regras';

type Answer = { data?: unknown; error?: unknown };

/** A stand-in for the Supabase client: records each rpc call and answers it with `answer(name, args)` */
function fakeDb(answer: (name: string, args: unknown) => Answer | Promise<never>) {
  const log: { name: string; args: unknown; signal: boolean }[] = [];
  const db = {
    rpc: (name: string, args?: unknown) => {
      const entry = { name, args, signal: false };
      log.push(entry);
      const call = {
        abortSignal: () => {
          entry.signal = true;
          return call;
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          const a = answer(name, args);
          return (a instanceof Promise ? a : Promise.resolve({ data: null, error: null, ...a })).then(resolve, reject);
        },
      };
      return call;
    },
  } as unknown as SupabaseClient;
  return { db, log };
}

describe('rules RPC wrappers', () => {
  it('calls each function by name with its argument names, under a timeout', async () => {
    const { db, log } = fakeDb((name) => ({
      data:
        name === 'rules_config'
          ? regrasJson('config-depois')
          : name === 'rules_now'
            ? regrasJson('agora-seg-1005-et')
            : name === 'save_rules'
              ? regrasJson('save-dono')
              : { theme: 'escuro' },
    }));
    const config = await fetchRulesConfig(db);
    expect(config.accounts).toHaveLength(2);
    const now = await fetchRulesNow(db);
    expect(now.accounts[0].gate.status).toBe('liberado');
    const payload = { v: 1 as const, base_rev: config.rev, preferences: { display_tz: 'br' as const } };
    const saved = await saveRules(db, payload, { dryRun: true });
    expect(saved.versions).toHaveLength(2);
    await saveRules(db, payload);
    await expect(mergePreferences(db, { theme: 'escuro' })).resolves.toEqual({ theme: 'escuro' });
    expect(log.map((l) => [l.name, l.args])).toEqual([
      ['rules_config', undefined],
      ['rules_now', undefined],
      ['save_rules', { p_payload: payload, p_dry_run: true }],
      ['save_rules', { p_payload: payload, p_dry_run: false }],
      ['merge_preferences', { p_patch: { theme: 'escuro' } }],
    ]);
    expect(log.every((l) => l.signal)).toBe(true);
  });

  it('turns the database’s bare codes into typed errors', async () => {
    for (const code of ['rules_changed', 'concurrent_save', 'base_rev_required', 'bad_window', 'archived_account', 'unknown_key']) {
      const { db } = fakeDb(() => ({ error: { code: '22023', message: code, details: 'segredo' } }));
      const e = await saveRules(db, { v: 1 }).catch((x) => x);
      expect(e).toBeInstanceOf(RegrasDataError);
      expect(e.code).toBe(code);
      expect(JSON.stringify(e) + e.message).not.toContain('segredo');
    }
  });

  it('never keeps the database’s text, and calls a malformed answer bad_answer', async () => {
    const leak = fakeDb(() => ({ error: { code: 'P0001', message: 'value "feedface" is wrong', details: 'feedface' } }));
    const e = await fetchRulesConfig(leak.db).catch((x) => x);
    expect(e.code).toBe('unknown');
    expect(e.message).toBe('unknown');

    for (const data of [null, [], 'texto', { rev: 'none' }]) {
      const { db } = fakeDb(() => ({ data }));
      await expect(fetchRulesConfig(db)).rejects.toMatchObject({ code: 'bad_answer' });
    }
    const now = fakeDb(() => ({ data: { server_now: 'ontem', accounts: [] } }));
    await expect(fetchRulesNow(now.db)).rejects.toMatchObject({ code: 'bad_answer' });
  });

  it('maps expired sessions and failed requests', async () => {
    const jwt = fakeDb(() => ({ error: { code: 'PGRST301', message: 'JWT expired' } }));
    await expect(fetchRulesNow(jwt.db)).rejects.toMatchObject({ code: 'not_authenticated' });
    const offline = fakeDb(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(fetchRulesNow(offline.db)).rejects.toMatchObject({ code: 'network' });
  });

  it('knows every code it can give', () => {
    expect(toRegrasError({ message: 'not_authenticated' }).code).toBe('not_authenticated');
    expect(toRegrasError(new HubDataError('network')).code).toBe('network');
    expect(toRegrasError(new RegrasDataError('rules_changed')).code).toBe('rules_changed');
    expect(toRegrasError(null).code).toBe('unknown');
    expect(new Set(REGRAS_ERROR_CODES).size).toBe(REGRAS_ERROR_CODES.length);
  });
});

describe('fetchTradesSince', () => {
  it('counts each account’s trades from the start of its rules, in the database', async () => {
    const calls: unknown[][] = [];
    const db = {
      from: (table: string) => {
        const log: unknown[] = [['from', table]];
        calls.push(log);
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'gte']) {
          chain[m] = (...args: unknown[]) => {
            log.push([m, ...args]);
            return chain;
          };
        }
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: (log[2] as unknown[])[2] === 'a' ? 3 : 0 }).then(resolve);
        return chain;
      },
    } as unknown as SupabaseClient;
    const since = new Date('2026-10-17T19:48:01.334Z');
    await expect(
      fetchTradesSince(db, [
        { accountId: 'a', since },
        { accountId: 'b', since },
      ]),
    ).resolves.toEqual({ a: 3, b: 0 });
    expect(calls[0]).toEqual([
      ['from', 'trades'],
      ['select', 'id', { count: 'exact', head: true }],
      ['eq', 'account_id', 'a'],
      ['gte', 'entry_time', '2026-10-17T19:48:01.334Z'],
    ]);
  });

  it('gives a typed error when a count fails', async () => {
    const db = {
      from: () => {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'gte']) chain[m] = () => chain;
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: { code: 'PGRST301', message: 'JWT expired' } }).then(resolve);
        return chain;
      },
    } as unknown as SupabaseClient;
    await expect(fetchTradesSince(db, [{ accountId: 'a', since: new Date() }])).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});

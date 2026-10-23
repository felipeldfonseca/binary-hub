/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HubDataError,
  createAccount,
  fetchAccounts,
  fetchActivity,
  fetchImportFormats,
  fetchPreferences,
  fetchTemplateMarkets,
  fetchTemplates,
  importFixTz,
  importPreview,
  importUndo,
  saveTemplate,
  setPrimary,
  toHubError,
  RPC_ERROR_CODES,
  TEMPLATE_COLUMNS,
  type ImportCommitResult,
  type ImportPreviewResult,
} from '@/lib/hub/contasDb';
import { templatePayload } from '@/lib/domain/import';
import { MODELO_BLACKARROW_LINHA, MODELO_TRADOVATE_LINHA } from '@/testing/mapeadoTelas';
import { CREATABLE_MARKETS, MARKET_SPEC } from '@/lib/domain/markets';

type Call = unknown[];
type Answer = { data?: unknown; error?: unknown; count?: number };

/**
 * A stand-in for the Supabase client: records every builder call and answers each request
 * with `answer(table or 'rpc:name', calls of that request)`.
 */
function fakeDb(answer: (target: string, calls: Call[]) => Answer = () => ({ data: null, error: null })) {
  const log: Call[][] = [];
  const request = (target: string, first: Call) => {
    const calls: Call[] = [first];
    log.push(calls);
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'insert', 'update', 'single', 'maybeSingle', 'abortSignal']) {
      chain[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...answer(target, calls) }).then(resolve, reject);
    return chain;
  };
  const db = {
    from: (table: string) => request(table, ['from', table]),
    rpc: (name: string, args: unknown) => request(`rpc:${name}`, ['rpc', name, args]),
  } as unknown as SupabaseClient;
  return { db, log };
}

describe('toHubError', () => {
  it('recognises the import functions’ codes by name', () => {
    expect(toHubError({ message: 'tz_not_confirmed', code: '22023' }).code).toBe('tz_not_confirmed');
    expect(toHubError({ message: 'legacy_batch' }).code).toBe('legacy_batch');
    expect(toHubError({ message: 'invalid_file_tz' }).code).toBe('invalid_tz');
  });

  it('tells a taken nickname from other conflicts, and never keeps the database text', () => {
    const raw = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "trading_accounts_label_uq"',
      details: 'Key (user_id, lower(btrim(label)))=(u-1, segredo) already exists.',
    };
    const error = toHubError(raw);
    expect(error.code).toBe('duplicate_label');
    expect(error.message).toBe('duplicate_label');
    expect(JSON.stringify(error)).not.toContain('segredo');
    expect(toHubError({ code: '23505', message: 'x "trading_accounts_one_primary"' }).code).toBe('duplicate_primary');
  });

  it('maps expired sessions, failed fetches and anything else', () => {
    expect(toHubError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('not_authenticated');
    expect(toHubError({ message: 'TypeError: Failed to fetch' }).code).toBe('network');
    expect(toHubError({ name: 'AbortError', message: 'The operation was aborted' }).code).toBe('network');
    expect(toHubError({ code: '23514', message: 'new row violates check constraint' }).code).toBe('invalid_field');
    expect(toHubError({ message: 'value "feedface0000000000000001" is bad' }).code).toBe('unknown');
    expect(toHubError(null).code).toBe('unknown');
    expect(toHubError(new HubDataError('network')).code).toBe('network');
  });
});

describe('accounts', () => {
  it('reads the user’s accounts without example ones, in list order', async () => {
    const { db, log } = fakeDb(() => ({ data: [{ id: 'a' }] }));
    await expect(fetchAccounts(db)).resolves.toEqual([{ id: 'a' }]);
    expect(log[0][0]).toEqual(['from', 'trading_accounts']);
    expect(log[0]).toContainEqual(['eq', 'is_example', false]);
    expect(log[0]).toContainEqual(['order', 'sort_order']);
  });

  it('creates a futures account on the New York day turning at 18:00', async () => {
    const { db, log } = fakeDb(() => ({ data: { id: 'new', label: 'Apex A' } }));
    await createAccount(db, 'user-1', {
      market: 'futures',
      label: '  Apex A ',
      platform: 'rithmic',
      firm: 'Apex',
      external_ref: null,
      phase: 'avaliacao',
      size: '50000',
      is_primary: false,
    });
    const insert = log[0].find((c) => c[0] === 'insert')?.[1] as Record<string, unknown>;
    expect(insert).toMatchObject({
      user_id: 'user-1',
      market: 'futures',
      label: 'Apex A',
      day_tz: 'America/New_York',
      day_start_min: 1080,
      size: '50000',
    });
    expect(insert).not.toHaveProperty('legacy_market_type');
  });

  it('creates a binary account on the Brasília day turning at midnight', async () => {
    const { db, log } = fakeDb(() => ({ data: { id: 'new' } }));
    await createAccount(db, 'user-1', {
      market: 'binary',
      label: 'Pocket',
      platform: 'pocket',
      firm: null,
      external_ref: null,
      phase: 'pessoal',
      size: null,
      is_primary: true,
    });
    const insert = log[0].find((c) => c[0] === 'insert')?.[1] as Record<string, unknown>;
    expect(insert).toMatchObject({ day_tz: 'America/Sao_Paulo', day_start_min: 0, is_primary: true });
  });

  it('sends each creatable market’s day clock and currency (Fase 2b; the insert trigger sets the same)', async () => {
    for (const market of CREATABLE_MARKETS) {
      const { db, log } = fakeDb(() => ({ data: { id: 'new' } }));
      await createAccount(db, 'user-1', { market, label: 'Nova', platform: null, firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
      const insert = log[0].find((c) => c[0] === 'insert')?.[1] as Record<string, unknown>;
      expect(insert).toMatchObject({
        market,
        day_tz: MARKET_SPEC[market].day.tz,
        day_start_min: MARKET_SPEC[market].day.startMin,
        currency: MARKET_SPEC[market].currency,
      });
    }
    const brl = { forex: 'USD', stocks: 'USD', crypto: 'USD', b3: 'BRL' } as const;
    for (const [market, currency] of Object.entries(brl)) expect(MARKET_SPEC[market as keyof typeof brl].currency).toBe(currency);
  });

  it('reads the database refusing an options account as a refused field', () => {
    expect(toHubError({ code: '23514', message: 'market_not_creatable' }).code).toBe('invalid_field');
  });

  it('turns a refused insert into a code', async () => {
    const { db } = fakeDb(() => ({ error: { code: '23505', message: 'violates "trading_accounts_label_uq"' } }));
    await expect(
      createAccount(db, 'u', { market: 'binary', label: 'x', platform: null, firm: null, external_ref: null, phase: null, size: null, is_primary: false }),
    ).rejects.toMatchObject({ code: 'duplicate_label' });
  });

  it('clears the old primary before setting the new one', async () => {
    const { db, log } = fakeDb();
    await setPrimary(db, 'new', 'old');
    expect(log.map((calls) => [calls.find((c) => c[0] === 'update')?.[1], calls.find((c) => c[0] === 'eq')?.[2]])).toEqual([
      [{ is_primary: false }, 'old'],
      [{ is_primary: true }, 'new'],
    ]);
  });

  it('counts each account’s trades and imported trades', async () => {
    const { db } = fakeDb((_, calls) => ({ count: calls.some((c) => c[0] === 'eq' && c[1] === 'source') ? 3 : 5 }));
    await expect(fetchActivity(db, ['a'])).resolves.toEqual({ a: { total: 5, imported: 3 } });
  });

  it('lists each account’s import formats once', async () => {
    const { db } = fakeDb(() => ({
      data: [
        { account_id: 'a', platform: 'topone' },
        { account_id: 'a', platform: 'topone' },
        { account_id: 'b', platform: 'ebinex' },
      ],
    }));
    await expect(fetchImportFormats(db)).resolves.toEqual({ a: ['topone'], b: ['ebinex'] });
  });

  it('reads the preferences object, an empty one when none is saved', async () => {
    const read = fakeDb(() => ({ data: { preferences: null } }));
    await expect(fetchPreferences(read.db, 'u')).resolves.toEqual({});
    const saved = fakeDb(() => ({ data: { preferences: { theme: 'escuro', conta_atual: 'a' } } }));
    await expect(fetchPreferences(saved.db, 'u')).resolves.toEqual({ theme: 'escuro', conta_atual: 'a' });
    expect(saved.log[0]).toContainEqual(['eq', 'id', 'u']);
  });
});

describe('import functions', () => {
  it('calls the RPCs by name with their argument names', async () => {
    const { db, log } = fakeDb(() => ({ data: { ok: true } }));
    await importUndo(db, 'batch-1');
    await importFixTz(db, 'acc-1', 'America/Sao_Paulo', true);
    expect(log[0][0]).toEqual(['rpc', 'import_undo', { p_batch: 'batch-1' }]);
    expect(log[1][0]).toEqual(['rpc', 'import_fix_tz', { p_account: 'acc-1', p_new_tz: 'America/Sao_Paulo', p_dry_run: true }]);
  });

  it('turns a raised code into a HubDataError, whatever else the error says', async () => {
    const { db } = fakeDb(() => ({ error: { code: '22023', message: 'tz_mismatch', details: 'line 4: 12/03/2026' } }));
    const args = { p_account: 'a', p_platform: 'topone' as const, p_sha256: 'x', p_file_tz: 'UTC', p_rows: [], p_errors: [], p_rows_total: 0 };
    const failure = await importPreview(db, args).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(HubDataError);
    expect((failure as HubDataError).code).toBe('tz_mismatch');
    expect((failure as HubDataError).message).not.toContain('12/03');
  });
});

describe('Phase 3b · the column-mapping models (import_templates)', () => {
  it('fetchTemplates reads the model columns, most recently used first, and drops a row it cannot use', async () => {
    const quebrado = { ...MODELO_TRADOVATE_LINHA, id: 'x', row_kind: 'nada' };
    const { db, log } = fakeDb(() => ({ data: [MODELO_BLACKARROW_LINHA, quebrado, MODELO_TRADOVATE_LINHA] }));
    const models = await fetchTemplates(db);
    expect(models.map((t) => [t.id, t.name])).toEqual([
      [MODELO_BLACKARROW_LINHA.id, 'BlackArrow'],
      [MODELO_TRADOVATE_LINHA.id, 'Tradovate'],
    ]);
    expect(log[0]).toEqual([
      ['from', 'import_templates'],
      ['select', TEMPLATE_COLUMNS],
      ['order', 'last_used_at', { ascending: false, nullsFirst: false }],
    ]);
    // Never the owner or the dates the screens do not read
    expect(TEMPLATE_COLUMNS).not.toMatch(/user_id|created_at|updated_at/);
    await expect(fetchTemplates(fakeDb(() => ({ data: null })).db)).resolves.toEqual([]);
  });

  it('fetchTemplateMarkets: each model’s markets from its batches’ accounts (owner decision, 23 Oct); a model with no batch is absent', async () => {
    const { db, log } = fakeDb((target) =>
      target === 'import_batches'
        ? {
            data: [
              { template_id: 't-ba', account_id: 'a-fut' },
              { template_id: 't-ba', account_id: 'a-fut-2' },
              { template_id: 't-ba', account_id: 'a-b3' },
              { template_id: 't-tv', account_id: 'a-fut' },
              // A batch saved under no model, and one whose account the read does not hold
              { template_id: null, account_id: 'a-b3' },
              { template_id: 't-x', account_id: 'a-outra' },
            ],
          }
        : { data: [{ id: 'a-fut', market: 'futures' }, { id: 'a-fut-2', market: 'futures' }, { id: 'a-b3', market: 'b3' }] },
    );
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ 't-ba': ['futures', 'b3'], 't-tv': ['futures'] });
    expect(log).toEqual([
      [['from', 'import_batches'], ['select', 'template_id, account_id'], ['eq', 'platform', 'modelo']],
      [['from', 'trading_accounts'], ['select', 'id, market']],
    ]);
    await expect(fetchTemplateMarkets(fakeDb(() => ({ data: null })).db)).resolves.toEqual({});
    const falha = await fetchTemplateMarkets(fakeDb((t) => (t === 'import_batches' ? { error: { message: 'TypeError: Failed to fetch' } } : { data: [] })).db).catch((e: unknown) => e);
    expect((falha as HubDataError).code).toBe('network');
  });

  it('saveTemplate calls import_template_save with its argument names and answers what it saved', async () => {
    const { db, log } = fakeDb(() => ({ data: { template_id: 't-1', header_sig: 'ab'.repeat(32), created: true } }));
    const payload = templatePayload({
      rowKind: 'trade',
      headers: ['a', 'b'],
      headerSkip: 0,
      delimiter: ',',
      decimalMark: 'point',
      dateOrder: null,
      columns: ['entry_time', 'symbol'],
      resultIsNet: null,
      sideWords: {},
      openCloseWords: {},
      name: 'Modelo',
    });
    await expect(saveTemplate(db, payload, 'lote-1', null)).resolves.toEqual({ template_id: 't-1', header_sig: 'ab'.repeat(32), created: true });
    await saveTemplate(db, payload, null, 't-0');
    expect(log[0][0]).toEqual(['rpc', 'import_template_save', { p_template: payload, p_batch: 'lote-1', p_replaces: null }]);
    expect(log[1][0]).toEqual(['rpc', 'import_template_save', { p_template: payload, p_batch: null, p_replaces: 't-0' }]);
  });

  it.each(['bad_template', 'too_many_templates', 'unknown_template', 'unknown_batch', 'bad_format'] as const)(
    'its refusal %s is a code of its own, never the database text',
    async (code) => {
      expect(RPC_ERROR_CODES).toContain(code);
      const { db } = fakeDb(() => ({ error: { code: 'P0001', message: code, hint: 'account_routes', details: 'APX-0001' } }));
      const failure = await saveTemplate(db, MODELO_BLACKARROW_LINHA as never, null, null).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(HubDataError);
      expect((failure as HubDataError).code).toBe(code);
      expect(JSON.stringify(failure)).not.toContain('APX-0001');
    },
  );

  it('the preview and the commit carry duplicate_same and other_source only when the database sends them', () => {
    const preview: ImportPreviewResult = {
      new: 18,
      duplicate: 4,
      duplicate_same: 4,
      other_source: 18,
      completable: 0,
      other_account: 0,
      day_changes: 0,
      first_day: null,
      last_day: null,
      errors: [],
      already_imported: false,
      tz_status: 'ok',
      account_tz: 'UTC',
      tz_confirmed: true,
      rows_total: 22,
    };
    const commit: ImportCommitResult = { batch_id: null, inserted: 0, duplicate: 4, duplicate_same: 4, completed: 0, other_account: 0, errors: [] };
    expect([preview.duplicate_same, preview.other_source, commit.duplicate_same]).toEqual([4, 18, 4]);
  });
});

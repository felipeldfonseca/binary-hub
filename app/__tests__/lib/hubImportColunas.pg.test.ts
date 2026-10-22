/**
 * @jest-environment node
 *
 * Phase 3b (the column-mapping import) end to end against the real SQL of migrations
 * 20261024000001..2, on a throwaway local Postgres whose clock the suite moves. Skipped unless both
 * are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds)
 *                                                           from this file (an interposed clock)
 *
 * The board's files (app/testing/mappedFiles.ts, invented) go the way the import sheet sends them:
 * the mapped reader, buildImportArgs / previewArgs (p_platform 'modelo', p_format), then
 * import_preview and import_commit through lib/hub/contasDb on the stand-in client. Every import:
 * the preview counts as the commit; the stored trades are the reader's positions (the board's
 * numbers); the same file again is all «já estavam»; «Desfazer» leaves the account as it was.
 * Also: a registered trade the execution file closes (scenario 16), the Performance.csv of the same
 * trades recognised by «mesma hora e preço» (both orders), «Salvar como modelo», its exact and changed
 * matches and «Atualizar o modelo» (8, 15), «Conta» (17), the other-format warning and the zone rule on
 * a Top One account (8), and the client's error lines kept in the batch (16, 19).
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import { MON_TO_FRI } from '@/lib/domain';
import {
  accountRouteHash,
  buildImportArgs,
  checkTemplate,
  columnsFromTemplate,
  matchTemplate,
  parseImportText,
  parseMappedRecords,
  previewArgs,
  sniffFile,
  templateFromRow,
  templatePayload,
  type ImportFile,
  type MappedFile,
  type MappedPosition,
  type ParsedFile,
  type Template,
} from '@/lib/domain/import';
import { entryPayload } from '@/lib/domain/registro';
import { importCommit, importPreview, importUndo, type ImportCommitResult, type ImportPreviewResult } from '@/lib/hub/contasDb';
import { newClientKey, registerEntry } from '@/lib/hub/registrarDb';
import { BLACKARROW, SAMPLES, readSample, sampleChoices, type MappedSample } from '@/testing/mappedFiles';
import { PG_URL, asUser, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const NY = 'America/New_York';
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

/** Moves the server's clock to `iso` */
function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

const sample = (label: string): MappedSample => {
  const s = SAMPLES.find((x) => x.label === label);
  if (!s) throw new Error(label);
  return s;
};
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

type Preview = ImportPreviewResult & { duplicate_same?: number; other_source?: number };
type Commit = ImportCommitResult & { duplicate_same?: number };

/** The preview's counts under the commit's names (81's and 82's rule: they must be the commit's) */
const previewCounts = (p: Preview) => ({
  inserted: p.new,
  duplicate: p.duplicate,
  completed: p.completable,
  other_account: p.other_account,
  linked: p.linked,
  trades: p.trades_new,
  grouped: p.grouped,
  attached: p.attached,
  duplicate_same: p.duplicate_same,
  errors: p.errors,
});
const commitCounts = (c: Commit) => ({
  inserted: c.inserted,
  duplicate: c.duplicate,
  completed: c.completed,
  other_account: c.other_account,
  linked: c.linked,
  trades: c.trades,
  grouped: c.grouped,
  attached: c.attached,
  duplicate_same: c.duplicate_same,
  errors: c.errors,
});

/** A position as the board draws it: symbol, side, size, each exit's result (several), the result, the costs */
const drawn = (p: Pick<MappedPosition, 'symbol' | 'direction' | 'quantity' | 'pnl' | 'commission' | 'exits'>) =>
  `${p.symbol} ${p.direction} ${Number(p.quantity)} [${p.exits.length > 1 ? p.exits.map((e) => Number(e.pnl).toFixed(2)).join(' ') : ''}] ${Number(p.pnl).toFixed(2)} c=${p.commission === null ? '-' : Number(p.commission).toFixed(2)}`;

describePg('Phase 3b × the real SQL: the column-mapping import end to end', () => {
  const uid = randomUUID();
  const db = pgClient(uid);
  const acc: Record<string, string> = {};

  /** Every trade of the account with its file exits and links, as stored (updated_at aside) */
  const fingerprint = (id: string) =>
    psql(`select md5(coalesce((select string_agg((to_jsonb(t) - 'updated_at')::text, ',' order by t.id) from public.trades t where t.account_id = '${id}'), '')
      || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.account_id = '${id}'), '')
      || coalesce((select string_agg(to_jsonb(l)::text, ',' order by l.trade_id, l.batch_id) from public.trade_import_links l
                   join public.trades t on t.id = l.trade_id where t.account_id = '${id}'), ''));`).trim();

  /** The account's trades as the board draws them (their file exits when there are several), sorted */
  const stored = (id: string, where = 'true') =>
    (
      JSON.parse(
        psql(`select coalesce(jsonb_agg(jsonb_build_object('symbol', t.symbol, 'direction', t.direction, 'quantity', t.quantity::text, 'pnl', t.pnl::text,
            'commission', t.commission::text,
            'exits', (select coalesce(jsonb_agg(jsonb_build_object('pnl', e.pnl::text) order by e.exit_time, e.line), '[]'::jsonb)
                      from public.trade_exits e where e.trade_id = t.id and e.origin = 'file'))), '[]'::jsonb)::text
          from public.trades t where t.account_id = '${id}' and ${where};`).trim(),
      ) as MappedPosition[]
    )
      .map(drawn)
      .sort();

  /** Preview, then commit, as the sheet does; the preview counts as the commit */
  async function importFile(accountId: string, file: ImportFile, name: string, tz: string, text: string) {
    const args = buildImportArgs({ accountId, platform: file.platform, fileName: name, sha256: sha(text), fileTz: tz, outcome: file });
    const preview = (await importPreview(db, previewArgs(args))) as Preview;
    const commit = (await importCommit(db, args)) as Commit;
    expect(previewCounts(preview)).toEqual(commitCounts(commit));
    return { preview, commit, args };
  }

  /** A sample imported once (the board's numbers), again (nothing new), undone (as before) and imported for good */
  async function roundTrip(accountId: string, s: MappedSample, keep = true) {
    const before = fingerprint(accountId);
    const file = readSample(s);
    const first = await importFile(accountId, file, `${s.label}.csv`, s.tz, s.text);
    expect(first.commit.batch_id).not.toBeNull();
    // What the database stored is what «conferir» drew
    expect(stored(accountId, `t.import_batch_id = '${first.commit.batch_id}'`)).toEqual(file.positions.map(drawn).sort());
    expect(first.preview.errors).toEqual(file.errors.map((e) => ({ line: e.line, code: e.code })));
    expect(first.preview.rows_total).toBe(file.records);
    // The same file again: «já estavam», nothing new, no batch
    const again = await importFile(accountId, file, `${s.label}.csv`, s.tz, s.text);
    expect(again.preview).toMatchObject({ new: 0, duplicate: file.rows.length, already_imported: true });
    expect(again.preview.other_source).toBeUndefined();
    expect(again.commit).toMatchObject({ batch_id: null, inserted: 0, duplicate: file.rows.length });
    // «Desfazer»
    await importUndo(db, first.commit.batch_id as string);
    expect(fingerprint(accountId)).toBe(before);
    if (!keep) return { file, ...first };
    const last = await importFile(accountId, file, `${s.label}.csv`, s.tz, s.text);
    expect(stored(accountId, `t.import_batch_id = '${last.commit.batch_id}'`)).toEqual(file.positions.map(drawn).sort());
    return { file, ...last };
  }

  async function templatesOf(): Promise<Template[]> {
    const r = await (db.from('import_templates').select('*').order('created_at') as unknown as PromiseLike<{ data: unknown[]; error: unknown }>);
    if (r.error) throw new Error(JSON.stringify(r.error));
    return r.data.map(templateFromRow).filter((t): t is Template => t !== null);
  }

  async function saveTemplate(payload: unknown, batch: string | null, replaces: string | null = null) {
    const r = await (db.rpc('import_template_save', { p_template: payload, p_batch: batch, p_replaces: replaces }) as unknown as PromiseLike<{
      data: { template_id: string; header_sig: string; created: boolean } | null;
      error: { message: string; hint: string | null } | null;
    }>);
    return r;
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 10:31 ET: the accounts, the rules, and MES long 2 at 6.812,25 registered in the app (Lucid 50k)', async () => {
    setClock('2026-10-13T14:31:20Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'colunas-${uid.slice(0, 8)}@example.test');`);
    const mk = (market: 'futures' | 'forex' | 'b3' | 'crypto' | 'stocks', label: string, platform: string, primary = false) =>
      createAccountAsUser(uid, { market, label, platform, firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: primary });
    acc.lucid = await mk('futures', 'Lucid 50k', 'tradovate', true);
    acc.ylos = await mk('futures', 'Ylos 50k', 'blackarrow');
    acc.topOne = await mk('futures', 'Top One', 'topone');
    acc.apexA = await mk('futures', 'Apex A', 'ninja');
    acc.ftmo = await mk('forex', 'FTMO', 'mt5');
    acc.xp = await mk('b3', 'Mini-índice', 'profit');
    acc.binance = await mk('crypto', 'Binance', 'binance');
    acc.ibkr = await mk('stocks', 'IBKR', 'ibkr');
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        defaults: { futures: { rules: { v: 1, window_rule: { on: true, outside: 'fora' } }, windows: [{ tz: NY, start_min: 570, end_min: 960, weekdays: MON_TO_FRI }] } },
        accounts: { [acc.lucid]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: null, version: 'force' } },
      })})`,
    );
    // Typed as the file writes the contract, so the board's drawing reads the same on both sides
    const r = await registerEntry(db, acc.lucid, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MESZ6', direction: 'long', quantity: '2', entryPrice: '6812.25', clock: NY }));
    acc.registered = r.state.trade.id;
    expect(r.state.trade).toMatchObject({ status: 'open', quantity: '2' });
  });

  it('16 · Tradovate Orders: 9 executions, 6 exits, 4 trades (+55,00 · +7,50 · +17,00 · +23,75); the registered MES takes its 2 exits', async () => {
    setClock('2026-10-13T16:00:00Z');
    const s = sample('Tradovate Orders (16)');
    const registered = fingerprint(acc.lucid);
    const file = readSample(s);
    expect([file.executions, file.unfilled, file.rows.length, file.positions.length]).toEqual([9, 2, 6, 4]);
    const { preview, commit } = await importFile(acc.lucid, file, 'Orders.csv', s.tz, s.text);
    // The registered trade: «1 já registrada por você», its two exits from the file; the rest new
    expect(preview).toMatchObject({ new: 4, duplicate: 0, linked: 1, trades_new: 3, errors: [], tz_status: 'ok', rows_total: 6 });
    expect(preview.other_source).toBeUndefined();
    expect(stored(acc.lucid)).toEqual(file.positions.map(drawn).sort());
    expect(stored(acc.lucid, `t.id = '${acc.registered}'`)).toEqual(['MESZ6 long 2 [18.75 36.25] 55.00 c=-']);
    // The same file again
    const again = await importFile(acc.lucid, file, 'Orders.csv', s.tz, s.text);
    expect(again.preview).toMatchObject({ new: 0, duplicate: 6, linked: 0 });
    expect(again.commit.batch_id).toBeNull();

    // 8 · Performance.csv of the same trades (the MES long left out): «já estavam (mesma hora e preço)»
    const perf = readSample(sample('Performance.csv (8)'));
    const p = await importFile(acc.lucid, perf, 'Performance.csv', NY, sample('Performance.csv (8)').text);
    expect(p.preview).toMatchObject({ new: 0, duplicate: 4, duplicate_same: 4, linked: 0 });
    expect(p.preview.other_source).toBeUndefined();
    expect(p.commit).toMatchObject({ batch_id: null, inserted: 0, duplicate: 4, duplicate_same: 4 });

    // «Desfazer» the orders: the registered trade as it was registered, nothing else
    await importUndo(db, commit.batch_id as string);
    expect(fingerprint(acc.lucid)).toBe(registered);

    // The other order: Performance.csv first (3 trades), then the orders file (its MES long onto the registered trade)
    const p2 = await importFile(acc.lucid, perf, 'Performance.csv', NY, sample('Performance.csv (8)').text);
    expect(p2.preview).toMatchObject({ new: 4, duplicate: 0, linked: 0, trades_new: 3 });
    expect(stored(acc.lucid, `t.import_batch_id = '${p2.commit.batch_id}'`)).toEqual(perf.positions.map(drawn).sort());
    const o2 = await importFile(acc.lucid, file, 'Orders.csv', s.tz, s.text);
    expect(o2.preview).toMatchObject({ new: 0, duplicate: 4, duplicate_same: 4, linked: 1 });
    expect(stored(acc.lucid, `t.id = '${acc.registered}'`)).toEqual(['MESZ6 long 2 [18.75 36.25] 55.00 c=-']);
    await importUndo(db, o2.commit.batch_id as string);
    await importUndo(db, p2.commit.batch_id as string);
    expect(fingerprint(acc.lucid)).toBe(registered);
  });

  it('16 · ending positioned: «Sim» and «Não» each import their own trades, and undo', async () => {
    for (const label of ['Tradovate Orders, ending positioned: «Sim» (16)', 'Tradovate Orders, ending positioned: «Não» (16)']) {
      const s = sample(label);
      const before = fingerprint(acc.lucid);
      const file = readSample(s);
      const { commit } = await importFile(acc.lucid, file, `${label}.csv`, s.tz, s.text);
      // The registered MES long takes its exits either way; the rest are the reader's trades
      expect(stored(acc.lucid)).toEqual(file.positions.map(drawn).sort());
      expect(commit.errors).toEqual(file.errors.map((e) => ({ line: e.line, code: e.code })));
      await importUndo(db, commit.batch_id as string);
      expect(fingerprint(acc.lucid)).toBe(before);
    }
  });

  it('8 and 15 · BlackArrow (Ylos 50k): imported, «Salvar como modelo», the next file read by the model, «Atualizar o modelo»', async () => {
    const s = sample('BlackArrow (8)');
    const { commit, file } = await roundTrip(acc.ylos, s);
    // −37,50 · +9,50 · +27,50 gross, commissions 2,48 · 1,24 · 1,24 (the net result made gross)
    expect(stored(acc.ylos)).toEqual(['MESZ6 long 1 [] 27.50 c=1.24', 'MESZ6 long 2 [] -37.50 c=2.48', 'MNQZ6 short 1 [] 9.50 c=1.24']);
    const { sniffed, choices } = sampleChoices(s);
    const payload = templatePayload({ ...choices, name: 'BlackArrow', tzHint: s.tz });
    expect(checkTemplate(payload, { batch: { sig: (file as MappedFile).format.sig, market: 'futures' } })).toBeNull();
    const saved = await saveTemplate(payload, commit.batch_id);
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({ header_sig: sniffed.sig, created: true });
    const [model] = await templatesOf();
    expect(model).toMatchObject({ id: saved.data!.template_id, name: 'BlackArrow', sig: sniffed.sig, resultIsNet: true, tzHint: s.tz });
    expect(psql(`select template_name from public.import_batches where id = '${commit.batch_id}';`).trim()).toBe('BlackArrow');

    // 15 · the next file with the same columns: the model applies, «já estavam (mesmo ID)», one new line
    const next = `${BLACKARROW}\r\n02/10/2026 09:40:00;MESZ6;V;1;6.840,00;6.836,25;17,51;1,24;83410`;
    const n = sniffFile(next);
    if (!n.ok) throw new Error('file');
    const m = matchTemplate(n.headers, [model]);
    expect(m.kind).toBe('exact');
    const byModel = parseMappedRecords({ records: n.records, choices: { ...model, headers: n.headers, columns: columnsFromTemplate(n.headers, model) }, market: 'futures', templateId: model.id });
    if (!byModel.ok) throw new Error('file');
    expect(byModel.format).toEqual({ sig: model.sig, template: model.id });
    const r15 = await importFile(acc.ylos, byModel, 'BlackArrow-2.csv', s.tz, next);
    expect(r15.preview).toMatchObject({ new: 1, duplicate: 3, errors: [] });
    expect(stored(acc.ylos, `t.import_batch_id = '${r15.commit.batch_id}'`)).toEqual(['MESZ6 short 1 [] 18.75 c=1.24']);

    // «Uma coluna a mais»: changed, pre-filled from the model; «Atualizar o modelo» keeps its id
    const wider = BLACKARROW.split('\r\n').map((l, i) => `${l};${i === 0 ? 'Estratégia' : 'A'}`).join('\r\n');
    const w = sniffFile(wider);
    if (!w.ok) throw new Error('file');
    const changed = matchTemplate(w.headers, [model]);
    expect(changed).toMatchObject({ kind: 'changed', shared: 9 });
    const columns = columnsFromTemplate(w.headers, model);
    expect(columns[columns.length - 1]).toBeNull();
    const wFile = parseMappedRecords({ records: w.records, choices: { ...model, headers: w.headers, columns }, market: 'futures', templateId: model.id });
    if (!wFile.ok) throw new Error('file');
    const rw = await importFile(acc.ylos, wFile, 'BlackArrow-3.csv', s.tz, wider);
    // Same IDs: nothing new, and the same model is not «outro formato»
    expect(rw.preview).toMatchObject({ new: 0, duplicate: 3 });
    const upd = await saveTemplate(templatePayload({ ...model, headers: w.headers, columns, name: 'BlackArrow' }), null, model.id);
    expect(upd.data).toMatchObject({ template_id: model.id, created: false, header_sig: w.sig });
    expect((await templatesOf()).map((t) => [t.id, t.sig])).toEqual([[model.id, w.sig]]);
  });

  it('8 · «Conta que já recebe outro formato» (Top One): another zone is refused; in UTC, «18 operações caem em dias…»', async () => {
    const top = [
      'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots,Commissions,Gain',
      'MESZ6/900000000501,MESZ6,BUY,0,0,01/10/2026 14:30:00,6801,01/10/2026 14:40:00,6803,10m 0s,$10,1,1.24,0.02%',
      'MNQZ6/900000000502,MNQZ6,SELL,0,0,01/10/2026 15:00:00,25130,01/10/2026 15:05:00,25120,5m 0s,$20,1,1.24,0.04%',
    ].join('\n');
    const parsed = parseImportText(top) as ParsedFile;
    expect(parsed.ok && parsed.platform).toBe('topone');
    const t = await importFile(acc.topOne, parsed, 'Trade-History.csv', 'UTC', top);
    expect(t.commit.inserted).toBe(2);
    const before = fingerprint(acc.topOne);

    const s = sample('BlackArrow (8)');
    const file = readSample(s);
    // The account's zone is UTC (its Top One import): Brasília is refused, never confirmed
    const args = buildImportArgs({ accountId: acc.topOne, platform: 'modelo', fileName: 'ba.csv', sha256: sha(s.text), fileTz: 'America/Sao_Paulo', outcome: file });
    expect(await importPreview(db, previewArgs(args))).toMatchObject({ tz_status: 'tz_mismatch' });
    await expect(importCommit(db, args)).rejects.toMatchObject({ code: 'tz_mismatch' });
    expect(fingerprint(acc.topOne)).toBe(before);

    const r = await importFile(acc.topOne, file, 'ba.csv', 'UTC', s.text);
    expect(r.preview).toMatchObject({ new: 3, other_source: 3, tz_status: 'ok' });
    // Again: nothing would be inserted, so no warning
    const again = await importFile(acc.topOne, file, 'ba.csv', 'UTC', s.text);
    expect(again.preview.other_source).toBeUndefined();
    await importUndo(db, r.commit.batch_id as string);
    expect(fingerprint(acc.topOne)).toBe(before);
  });

  it('17 · NinjaTrader with two accounts: APX-0001 only («MNQ 12-26» → MNQZ26), the route saved; another market\'s account refused', async () => {
    const s = sample('NinjaTrader, APX-0001 (17)');
    const { commit, file } = await roundTrip(acc.apexA, s);
    expect((file as MappedFile).notImported).toBe(2);
    expect(stored(acc.apexA)).toEqual(['MNQZ26 long 1 [] -17.50 c=1.24', 'MNQZ26 short 1 [] 17.00 c=1.24']);
    const { choices } = sampleChoices(s);
    const sig = (file as MappedFile).format.sig;
    const routes = { [accountRouteHash('APX-0001')]: acc.apexA };
    const ok = templatePayload({ ...choices, name: 'NinjaTrader', accountRoutes: routes });
    const accounts = [
      { id: acc.apexA, market: 'futures' as const, archived: false },
      { id: acc.ftmo, market: 'forex' as const, archived: false },
    ];
    expect(checkTemplate(ok, { batch: { sig, market: 'futures' }, accounts })).toBeNull();
    expect((await saveTemplate(ok, commit.batch_id)).data).toMatchObject({ created: true, header_sig: sig });
    const bad = templatePayload({ ...choices, name: 'NinjaTrader', accountRoutes: { [accountRouteHash('APX-0002')]: acc.ftmo } });
    expect(checkTemplate(bad, { batch: { sig, market: 'futures' }, accounts })).toEqual({ code: 'bad_template', field: 'account_routes' });
    expect((await saveTemplate(bad, commit.batch_id)).error).toMatchObject({ message: 'bad_template', hint: 'account_routes' });
  });

  it('18 · Forex with swap: the result before the commission, with the swap (57,50 · 19,84 · −41,20)', async () => {
    await roundTrip(acc.ftmo, sample('Forex with swap (18)'));
    expect(stored(acc.ftmo)).toEqual(['EURGBP short 0.25 [] 19.84 c=1.75', 'EURUSD long 0.5 [] 57.50 c=3.50', 'EURUSD short 1 [] -41.20 c=7.00']);
  });

  it('19 · B3 in reais: «131.250» is 131250, fees in the commission; the line off the WIN tick kept in the batch', async () => {
    const { commit } = await roundTrip(acc.xp, sample('B3 (19)'));
    expect(stored(acc.xp)).toEqual([
      'WDOX26 long 1 [] 65.00 c=0.75',
      'WINZ26 long 2 [] -30.00 c=1.00',
      'WINZ26 short 1 [] 19.50 c=0.50',
      'WINZ26 short 3 [] 90.00 c=1.50',
    ]);
    expect(JSON.parse(psql(`select error_rows::text from public.import_batches where id = '${commit.batch_id}';`).trim())).toEqual([{ line: 6, code: 'off_tick' }]);
  });

  it('16 · Binance spot, ETH «Não»: a fee in BNB leaves a trade without commission; the day turns at midnight in Brasília', async () => {
    await roundTrip(acc.binance, sample('Binance spot, ETH «Não» (16)'));
    expect(stored(acc.binance)).toEqual([
      'BTCUSDT long 0.0125 [] 6.90 c=2.82',
      'BTCUSDT long 0.02 [2.40 -1.75] 0.65 c=-',
      'ETHUSDT short 0.1 [] 2.70 c=0.82',
    ]);
    const days = psql(`select string_agg(distinct trading_day::text, ',' order by trading_day::text) from public.trades where account_id = '${acc.binance}';`).trim();
    expect(days).toBe('2026-10-10,2026-10-12');
  });

  it('16 · Binance USDⓈ-M: the file\'s realized result wins, shared over the slices', async () => {
    const s = sample('Binance USDⓈ-M, realized (16)');
    const { file } = await roundTrip(acc.binance, s, false);
    expect(file.rows.every((r) => r.pnl_basis === 'file')).toBe(true);
  });

  it('16 · IBKR: NVDA +204,00 and AAPL +79,00 in two exits; the option, the close from before the file and the open position kept as lines', async () => {
    const { commit } = await roundTrip(acc.ibkr, sample('IBKR executions (16)'));
    expect(stored(acc.ibkr)).toEqual(['AAPL short 100 [51.00 28.00] 79.00 c=2.00', 'NVDA long 300 [] 204.00 c=3.00']);
    expect(JSON.parse(psql(`select error_rows::text from public.import_batches where id = '${commit.batch_id}';`).trim())).toEqual([
      { line: 2, code: 'opened_before_file' },
      { line: 7, code: 'bad_option' },
      { line: 9, code: 'open_at_end' },
    ]);
  });

  it('every board file\'s model is saved as the screens send it', async () => {
    const before = (await templatesOf()).length;
    let made = 0;
    for (const s of SAMPLES) {
      const { sniffed, choices } = sampleChoices(s);
      if ((await templatesOf()).some((t) => t.sig === sniffed.sig)) continue;
      const r = await saveTemplate(templatePayload({ ...choices, name: s.label.slice(0, 60) }), null);
      expect([s.label, r.error]).toEqual([s.label, null]);
      made++;
    }
    expect((await templatesOf()).length).toBe(before + made);
  });
});

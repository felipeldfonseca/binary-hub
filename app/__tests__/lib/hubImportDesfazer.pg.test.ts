/**
 * @jest-environment node
 *
 * «Desfazer» in Personalizar › Suas contas › Importações counts trades, never the file's lines (found in the 3b owner
 * test: «Desfazer apaga as 6 operações desta importação.» for a Tradovate file whose 6 exits made 4 trades, then
 * «Importação desfeita: 4 operações apagadas.»). import_batches.rows_inserted and rows_linked count lines; the
 * confirmation now reads what the user's session can (lib/hub/contasDb fetchBatchUndo: the batch's trades, its links,
 * its file exits) and its counts are import_undo's own. Against the real SQL of every migration (no change to any) on a
 * throwaway local Postgres whose clock the suite moves. Skipped unless both are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds) from it
 *
 * Invented data only: a Top One position in two rows (alone, then with a row a later file adds to it, then onto a
 * trade registered in the app), and Tradovate's execution file (testing/mappedFiles) with and without the registered
 * MES long it closes.
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import { buildImportArgs, parseImportText, previewArgs, type ImportFile, type ParsedFile } from '@/lib/domain/import';
import { entryPayload } from '@/lib/domain/registro';
import { fetchBatchUndo, fetchBatches, importCommit, importPreview, importUndo, type BatchUndo } from '@/lib/hub/contasDb';
import { newClientKey, registerEntry } from '@/lib/hub/registrarDb';
import { IMPORTACOES } from '@/components/hub/contas/copy';
import { SAMPLES, readSample } from '@/testing/mappedFiles';
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

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** A Top One Trade History (UTC) of MESZ6 longs on Tue 13 Oct: [ticket, open, open price, close, close price, PnL] */
const topOne = (rows: [string, string, number, string, number, number][]) =>
  [
    'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots,Commissions,Gain',
    ...rows.map(([t, o, op, c, cp, pnl]) => `MESZ6/${t},MESZ6,BUY,0,0,13/10/2026 ${o},${op},13/10/2026 ${c},${cp},10m 0s,$${pnl},1,1.24,0.02%`),
  ].join('\n');

describePg('«Desfazer» counts trades, never the file’s lines × the real SQL', () => {
  const uid = randomUUID();
  const db = pgClient(uid);
  const acc: Record<string, string> = {};

  /** Every trade of the account with its file exits and links, as stored (updated_at aside) */
  const fingerprint = (id: string) =>
    psql(`select md5(coalesce((select string_agg((to_jsonb(t) - 'updated_at')::text, ',' order by t.id) from public.trades t where t.account_id = '${id}'), '')
      || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.account_id = '${id}'), '')
      || coalesce((select string_agg(to_jsonb(l)::text, ',' order by l.trade_id, l.batch_id) from public.trade_import_links l
                   join public.trades t on t.id = l.trade_id where t.account_id = '${id}'), ''));`).trim();

  /** Preview, then commit, as the sheet does (the preview counts as the commit) */
  async function importar(accountId: string, file: ImportFile, name: string, tz: string, text: string) {
    const args = buildImportArgs({ accountId, platform: file.platform, fileName: name, sha256: sha(text), fileTz: tz, outcome: file });
    const preview = await importPreview(db, previewArgs(args));
    const commit = await importCommit(db, args);
    expect(preview.new).toBe(commit.inserted);
    expect(commit.batch_id).not.toBeNull();
    return commit;
  }

  async function importarTopOne(accountId: string, text: string, name: string) {
    const parsed = parseImportText(text);
    if (!parsed.ok || parsed.platform !== 'topone') throw new Error('not a Top One file');
    expect(parsed.errors).toEqual([]);
    return importar(accountId, parsed as ParsedFile, name, 'UTC', text);
  }

  /**
   * What Personalizar › Importações shows for the batch: its parts (the file's lines, as stored), the confirmation the
   * line counts made before this fix, and the one it makes now from what the user's session reads
   */
  async function confirmacao(accountId: string, batchId: string) {
    const batch = (await fetchBatches(db, accountId)).find((b) => b.id === batchId);
    if (!batch) throw new Error(batchId);
    const counts = await fetchBatchUndo(db, batchId);
    return {
      linhas: { inserted: batch.rows_inserted, linked: batch.rows_linked ?? 0 },
      antes: IMPORTACOES.confirm({ trades: batch.rows_inserted, registered: batch.rows_linked ?? 0 }),
      counts,
      agora: IMPORTACOES.confirm(counts),
    };
  }

  /** «Desfazer»: import_undo deletes exactly the confirmation's trades; the message after it */
  async function desfazer(batchId: string, counts: BatchUndo) {
    const { deleted } = await importUndo(db, batchId);
    expect(deleted).toBe(counts.trades);
    return IMPORTACOES.undone(deleted, counts);
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 10:31 ET: the accounts, their rules, and MES long 2 at 6.812,25 registered in the app (Lucid 50k)', async () => {
    setClock('2026-10-13T14:31:20Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'desfazer-${uid.slice(0, 8)}@example.test');`);
    const mk = (label: string, platform: string) =>
      createAccountAsUser(uid, { market: 'futures', label, platform, firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    acc.topA = await mk('Top One A', 'topone');
    acc.topB = await mk('Top One B', 'topone');
    acc.tradovate = await mk('Tradovate', 'tradovate');
    acc.lucid = await mk('Lucid 50k', 'tradovate');
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: Object.fromEntries([acc.topB, acc.lucid].map((id) => [id, { rules: { v: 1 }, window: null, version: 'force' }])),
      })})`,
    );
    const r = await registerEntry(db, acc.lucid, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MESZ6', direction: 'long', quantity: '2', entryPrice: '6812.25', clock: NY }));
    acc.lucidReg = r.state.trade.id;
  });

  it('11:00 ET: MES long 2 at 6.801 registered in the app (Top One B)', async () => {
    setClock('2026-10-13T15:00:20Z');
    const r = await registerEntry(db, acc.topB, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MESZ6', direction: 'long', quantity: '2', entryPrice: '6801', clock: NY }));
    expect(r.state.trade).toMatchObject({ status: 'open', quantity: '2' });
  });

  it('Top One, a position in two rows and a trade of one: «as 2 operações …, em 3 saídas» (the lines said «as 3»)', async () => {
    setClock('2026-10-13T16:00:00Z');
    const vazio = fingerprint(acc.topA);
    const text = topOne([
      ['900000000101', '13:00:00', 6801, '13:10:00', 6803, 10],
      ['900000000102', '13:00:00', 6801, '13:20:00', 6805, 20],
      ['900000000103', '14:00:00', 6810, '14:05:00', 6812, 10],
    ]);
    const c1 = await importarTopOne(acc.topA, text, 'historico-1.csv');
    expect(c1).toMatchObject({ inserted: 3, trades: 2, grouped: 1, attached: 0 });
    const b1 = c1.batch_id as string;
    const um = await confirmacao(acc.topA, b1);
    expect(um.linhas).toEqual({ inserted: 3, linked: 0 });
    expect(um.antes).toBe('Desfazer apaga as 3 operações desta importação.');
    expect(um.counts).toEqual({ trades: 2, exits: 3, registered: 0, existing: 0 });
    expect(um.agora).toBe('Desfazer apaga as 2 operações desta importação, em 3 saídas.');
    expect(IMPORTACOES.confirmYes(um.counts.trades)).toBe('Desfazer e apagar');

    // A later export: the position's two rows and a third exit, the single trade's row and a second exit of it. The
    // new rows join the trades already there (attached); the batch creates none, its lines said «a operação»… «as 2»
    const depois1 = fingerprint(acc.topA);
    const text2 = topOne([
      ['900000000101', '13:00:00', 6801, '13:10:00', 6803, 10],
      ['900000000102', '13:00:00', 6801, '13:20:00', 6805, 20],
      ['900000000104', '13:00:00', 6801, '13:30:00', 6806, 25],
      ['900000000103', '14:00:00', 6810, '14:05:00', 6812, 10],
      ['900000000105', '14:00:00', 6810, '14:15:00', 6814, 20],
    ]);
    const c2 = await importarTopOne(acc.topA, text2, 'historico-2.csv');
    expect(c2).toMatchObject({ inserted: 2, duplicate: 3, attached: 2 });
    const b2 = c2.batch_id as string;
    const dois = await confirmacao(acc.topA, b2);
    expect(dois.linhas).toEqual({ inserted: 2, linked: 0 });
    expect(dois.antes).toBe('Desfazer apaga as 2 operações desta importação.');
    expect(dois.counts).toEqual({ trades: 0, exits: 0, registered: 0, existing: 2 });
    expect(dois.agora).toBe('Desfazer não apaga nada: as 2 operações que já estavam voltam a ser como eram antes desta importação.');
    expect(IMPORTACOES.confirmYes(dois.counts.trades)).toBe('Desfazer');
    // The first batch's counts are its own: the second batch's exits are not its lines
    expect((await confirmacao(acc.topA, b1)).counts).toEqual({ trades: 2, exits: 3, registered: 0, existing: 0 });

    expect(await desfazer(b2, dois.counts)).toBe('Importação desfeita: as 2 operações que já estavam voltaram a ser como eram.');
    expect(fingerprint(acc.topA)).toBe(depois1);
    expect(await desfazer(b1, um.counts)).toBe('Importação desfeita: 2 operações apagadas.');
    expect(fingerprint(acc.topA)).toBe(vazio);
  });

  it('Top One, the position in two rows onto the registered trade: «a registrada por você» (the lines said «as 2»)', async () => {
    const registrada = fingerprint(acc.topB);
    const text = topOne([
      ['900000000201', '15:00:00', 6801, '15:10:00', 6803, 10],
      ['900000000202', '15:00:00', 6801, '15:20:00', 6805, 20],
      ['900000000203', '15:30:00', 6810, '15:35:00', 6812, 10],
    ]);
    const c = await importarTopOne(acc.topB, text, 'historico-b.csv');
    expect(c).toMatchObject({ inserted: 1, linked: 1 });
    const b = c.batch_id as string;
    const x = await confirmacao(acc.topB, b);
    expect(x.linhas).toEqual({ inserted: 1, linked: 2 });
    expect(x.antes).toBe('Desfazer apaga a operação desta importação, e as 2 registradas por você voltam a ser como estavam antes dela.');
    expect(x.counts).toEqual({ trades: 1, exits: 1, registered: 1, existing: 0 });
    expect(x.agora).toBe('Desfazer apaga a operação desta importação, e a registrada por você volta a ser como estava antes dela.');
    expect(await desfazer(b, x.counts)).toBe('Importação desfeita: 1 operação apagada, e a registrada por você voltou a ser como estava.');
    expect(fingerprint(acc.topB)).toBe(registrada);
  });

  it('Tradovate Orders: 6 exits, 4 trades: «as 4 operações …, em 6 saídas», then «4 operações apagadas» (the owner test)', async () => {
    const s = SAMPLES.find((x) => x.label === 'Tradovate Orders (16)');
    if (!s) throw new Error('sample');
    const file = readSample(s);
    expect([file.rows.length, file.positions.length]).toEqual([6, 4]);
    const vazio = fingerprint(acc.tradovate);
    const c = await importar(acc.tradovate, file, 'tradovate-ordens.csv', s.tz, s.text);
    expect(c).toMatchObject({ inserted: 6, linked: 0, trades: 4 });
    const b = c.batch_id as string;
    const x = await confirmacao(acc.tradovate, b);
    expect(x.linhas).toEqual({ inserted: 6, linked: 0 });
    expect(x.antes).toBe('Desfazer apaga as 6 operações desta importação.');
    expect(x.counts).toEqual({ trades: 4, exits: 6, registered: 0, existing: 0 });
    expect(x.agora).toBe('Desfazer apaga as 4 operações desta importação, em 6 saídas.');
    expect(await desfazer(b, x.counts)).toBe('Importação desfeita: 4 operações apagadas.');
    expect(fingerprint(acc.tradovate)).toBe(vazio);
  });

  it('Tradovate Orders onto the registered MES long: «as 3 operações …, em 4 saídas, e a registrada por você» (the lines said «as 4», «as 2»)', async () => {
    const s = SAMPLES.find((x) => x.label === 'Tradovate Orders (16)');
    if (!s) throw new Error('sample');
    const file = readSample(s);
    const registrada = fingerprint(acc.lucid);
    const c = await importar(acc.lucid, file, 'tradovate-ordens.csv', s.tz, s.text);
    expect(c).toMatchObject({ inserted: 4, linked: 1, trades: 3 });
    const b = c.batch_id as string;
    const x = await confirmacao(acc.lucid, b);
    expect(x.linhas).toEqual({ inserted: 4, linked: 2 });
    expect(x.antes).toBe('Desfazer apaga as 4 operações desta importação, e as 2 registradas por você voltam a ser como estavam antes dela.');
    expect(x.counts).toEqual({ trades: 3, exits: 4, registered: 1, existing: 0 });
    expect(x.agora).toBe('Desfazer apaga as 3 operações desta importação, em 4 saídas, e a registrada por você volta a ser como estava antes dela.');
    expect(await desfazer(b, x.counts)).toBe('Importação desfeita: 3 operações apagadas, e a registrada por você voltou a ser como estava.');
    expect(fingerprint(acc.lucid)).toBe(registrada);
    // The registered trade is the app's again, untouched by the file
    expect(psql(`select status || ' ' || trim_scale(quantity)::text || ' ' || coalesce(external_id, '-') from public.trades where id = '${acc.lucidReg}';`).trim()).toBe('open 2 -');
  });
});

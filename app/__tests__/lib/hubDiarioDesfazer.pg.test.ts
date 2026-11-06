/**
 * @jest-environment node
 *
 * Fase 4 · telas, lane L1 (D20): undoing an import says what the owner put in the Diário on the batch's own trades,
 * which leave with them («Saem junto: 2 marcas, 1 imagem e 1 nota que você pôs no Diário.»). Against the real SQL of
 * every migration (no change to any) on a throwaway local Postgres whose clock the suite moves (the PG runner of
 * .claude/ferramentas/pg). Skipped unless both are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds) from it
 *
 * Invented data only: a Top One account with rules, a MES long registered in the app (its own marks and note), then a
 * Top One file with two trades of its own and the row that completes the registered one; marks (one taken back), an
 * image and a note on the file's trades through the Registrar's functions (add_marks, image_slots + save_extras), as
 * the Diário's drill saves them. fetchBatchUndo counts {2, 1, 1}; after import_undo those rows are gone and the
 * registered trade keeps its marks and note.
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import { buildImportArgs, parseImportText, previewArgs, type ParsedFile } from '@/lib/domain/import';
import { entryPayload, extrasPayload, imageSlotsRequest, marksPayload } from '@/lib/domain/registro';
import { fetchBatchUndo, importCommit, importPreview, importUndo } from '@/lib/hub/contasDb';
import { addMarks, imageSlots, newClientKey, registerEntry, saveExtras } from '@/lib/hub/registrarDb';
import { IMPORTACOES } from '@/components/hub/contas/copy';
import { PG_URL, asUser, asUserExec, createAccountAsUser, lit, psql } from '@/testing/pg';
import { pgClientComNot } from '@/testing/pgLeituras';

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

describePg('«Saem junto»: the Diário’s marks, images and notes that leave with an import × the real SQL', () => {
  const uid = randomUUID();
  const db = pgClientComNot(uid);
  const ids: Record<string, string> = {};

  /** The marks in force, images and note of a trade, as stored */
  const doDiario = (tradeId: string) =>
    psql(`select (select count(*) from public.trade_marks_now_v m where m.trade_id = '${tradeId}' and m.current_value is not null)
      || ' ' || (select count(*) from public.trade_attachments a where a.trade_id = '${tradeId}' and a.status = 'ok')
      || ' ' || coalesce((select note from public.trades where id = '${tradeId}'), '-');`).trim();

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`set storage.allow_delete_query = 'true';
delete from storage.objects where owner_id = '${uid}';
delete from public.trades where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from public.hub_members where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 11:00 ET: Top One with rules; MES long 2 at 6.801 registered in the app, with a Setup and a note', async () => {
    setClock('2026-10-13T14:31:20Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'saem-${uid.slice(0, 8)}@example.test');`);
    // image_slots: the uploads are limited to the hub's members (the logins of HUB_USERS)
    psql(`insert into public.hub_members (user_id) values ('${uid}');`);
    ids.conta = await createAccountAsUser(uid, {
      market: 'futures',
      label: 'Top One',
      platform: 'topone',
      firm: null,
      external_ref: null,
      phase: 'pessoal',
      size: null,
      is_primary: true,
    });
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: { [ids.conta]: { rules: { v: 1 }, window: null, version: 'force' } },
      })})`,
    );
    setClock('2026-10-13T15:00:20Z');
    const r = await registerEntry(
      db,
      ids.conta,
      entryPayload('futures', { clientKey: newClientKey(), symbol: 'MESZ6', direction: 'long', quantity: '2', entryPrice: '6801', clock: NY, marks: { setup: 'A' } }),
    );
    ids.registrada = r.state.trade.id;
    await saveExtras(db, ids.registrada, extrasPayload({ note: 'Minha entrada.' }));
    expect(doDiario(ids.registrada)).toBe('1 0 Minha entrada.');
  });

  it('12:00 ET: the file brings two trades of its own and completes the registered one', async () => {
    setClock('2026-10-13T16:00:00Z');
    const text = topOne([
      ['900000000301', '13:00:00', 6801, '13:10:00', 6803, 10],
      ['900000000302', '14:00:00', 6810, '14:05:00', 6812, 10],
      ['900000000303', '15:00:00', 6801, '15:10:00', 6803, 10],
    ]);
    const parsed = parseImportText(text);
    if (!parsed.ok || parsed.platform !== 'topone') throw new Error('not a Top One file');
    const args = buildImportArgs({ accountId: ids.conta, platform: 'topone', fileName: 'TopOne_1013.csv', sha256: sha(text), fileTz: 'UTC', outcome: parsed as ParsedFile });
    const preview = await importPreview(db, previewArgs(args));
    const commit = await importCommit(db, args);
    expect(preview.new).toBe(commit.inserted);
    expect(commit).toMatchObject({ inserted: 2, linked: 1 });
    ids.lote = commit.batch_id as string;
    const proprias = psql(`select string_agg(id::text, ',' order by entry_time) from public.trades where import_batch_id = '${ids.lote}';`).trim().split(',');
    expect(proprias).toHaveLength(2);
    ids.t1 = proprias[0];
    ids.t2 = proprias[1];
    // Nothing of the Diário on them yet
    expect((await fetchBatchUndo(db, ids.lote)).diario).toEqual({ marks: 0, images: 0, notes: 0 });
  });

  it('marks (one taken back), an image and a note on the file’s trades; a mark more on the registered one: {2, 1, 1}', async () => {
    setClock('2026-10-13T16:10:00Z');
    await addMarks(db, ids.t1, marksPayload({ setup: 'B' }));
    await addMarks(db, ids.t2, marksPayload({ emocao: 'calmo' }));
    await addMarks(db, ids.t2, marksPayload({ execucao: 'cedo' }));
    await addMarks(db, ids.t2, marksPayload({ execucao: null }));
    await addMarks(db, ids.registrada, marksPayload({ emocao: 'ansioso' }));
    const slots = await imageSlots(db, ids.t1, imageSlotsRequest([], [{ mime: 'image/webp', bytes: 2048, name: 'MES_13-00.webp' }]));
    asUserExec(uid, `insert into storage.objects (bucket_id, name, owner_id, metadata) values ('trade-images', '${slots.slots[0].path}', '${uid}', '{"size": 2048, "mimetype": "image/webp"}');`);
    await saveExtras(db, ids.t1, extrasPayload({ images: [slots.slots[0].id] }));
    // A slot reserved and never uploaded (pendente) does not count
    await imageSlots(db, ids.t2, imageSlotsRequest([], [{ mime: 'image/png', bytes: 1024, name: 'nunca.png' }]));
    await saveExtras(db, ids.t2, extrasPayload({ note: 'Entrei cedo.' }));
    expect([doDiario(ids.t1), doDiario(ids.t2)]).toEqual(['1 1 -', '1 0 Entrei cedo.']);

    const undo = await fetchBatchUndo(db, ids.lote);
    expect(undo).toEqual({ trades: 2, exits: 2, registered: 1, existing: 0, diario: { marks: 2, images: 1, notes: 1 } });
    expect(IMPORTACOES.saem(undo.diario)).toBe('Saem junto: 2 marcas, 1 imagem e 1 nota que você pôs no Diário.');
    expect(IMPORTACOES.confirm(undo)).toBe('Desfazer apaga as 2 operações desta importação, e a registrada por você volta a ser como estava antes dela.');
  });

  it('import_undo: the file’s trades leave with their marks, image and note; the registered trade keeps its own', async () => {
    setClock('2026-10-13T16:20:00Z');
    const { deleted } = await importUndo(db, ids.lote);
    expect(deleted).toBe(2);
    expect(psql(`select count(*) from public.trades where id in ('${ids.t1}', '${ids.t2}');`).trim()).toBe('0');
    expect(psql(`select count(*) from public.trade_marks where trade_id in ('${ids.t1}', '${ids.t2}');`).trim()).toBe('0');
    expect(psql(`select count(*) from public.trade_attachments where trade_id in ('${ids.t1}', '${ids.t2}');`).trim()).toBe('0');
    expect(doDiario(ids.registrada)).toBe('2 0 Minha entrada.');
    expect(psql(`select string_agg(kind || '=' || current_value, ',' order by kind) from public.trade_marks_now_v where trade_id = '${ids.registrada}';`).trim()).toBe(
      'emocao=ansioso,setup=A',
    );
  });
});

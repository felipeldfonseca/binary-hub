/**
 * @jest-environment node
 *
 * What the screens' shared layer does against the real SQL beyond the recorded day
 * (hubRegistrarTelas.pg): gate_at read as the sheet reads it (fetchGateAt), a retried tap with the
 * same client_key, the D30 question and its confirmation, an exit's own dry run after the exit
 * (`repeated`: why the writes never ask a dry run again), «Salvar imagens e nota» with an upload
 * the Storage policy refuses (a reservation past its 30 minutes) and the retry of only that
 * image, and «Desfazer entrada» with an image (the trash leaves Storage). Skipped unless a
 * throwaway cluster with the interposed clock is given (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres  BH_PG_SHIFT_FILE=/path/shift
 *
 * Invented data only.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MON_TO_FRI } from '@/lib/domain';
import { entryPayload, exitPayload, extrasPayload, imageSlotsRequest } from '@/lib/domain/registro';
import { parseRulesNow } from '@/lib/hub/regras';
import {
  RegistrarDataError,
  drainImageTrash,
  fetchGateAt,
  imageSlots,
  newClientKey,
  previewEntry,
  previewExit,
  registerEntry,
  registerExit,
  saveExtras,
  undoEntry,
  uploadImage,
} from '@/lib/hub/registrarDb';
import { saveImagesAndNote, type ImageCodec } from '@/lib/hub/registrarImagens';
import { PG_URL, asUser, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const NY = 'America/New_York' as const;

const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

async function refusal(p: Promise<unknown>): Promise<{ code: string; field: string | null }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RegistrarDataError) return { code: e.code, field: e.field };
    throw e;
  }
  throw new Error('expected a refusal');
}

/** A canvas stand-in: every image re-encodes to a small WebP */
const codec: ImageCodec = {
  encode: async (_file, type) => (type === 'image/webp' ? new Blob([new Uint8Array(300)], { type }) : null),
  bytes: async (blob) => new Uint8Array(await blob.arrayBuffer()),
};

const png = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/png' });

/** Storage objects of the user, by path */
const objects = (uid: string): string[] =>
  psql(`select coalesce(string_agg(name, ',' order by name), '') from storage.objects where owner_id = '${uid}';`)
    .trim()
    .split(',')
    .filter(Boolean);

describePg('the shared layer × the real SQL: retries, refusals and images', () => {
  const uid = randomUUID();
  const db = pgClient(uid);
  let top = '';

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`set storage.allow_delete_query = 'true';
delete from storage.objects where owner_id = '${uid}';
delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Mon 19 Oct: an account with a window and a limit, a hub member', async () => {
    setClock('2026-10-19T13:00:05Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'fluxos-${uid.slice(0, 8)}@example.test');`);
    top = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #2', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        accounts: { [top]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI }, version: 'force' } },
      })})`,
    );
    psql(`insert into public.hub_members (user_id) values ('${uid}');`);
  });

  it('gate_at as the sheet reads it: the same account shape as rules_now, at the typed instant', async () => {
    setClock('2026-10-23T14:05:05Z');
    const now = parseRulesNow(asUser(uid, 'public.rules_now()')).accounts[0];
    const atNow = await fetchGateAt(db, top, new Date('2026-10-23T14:05:00Z'));
    expect(atNow).toMatchObject({ accountId: top, label: 'Top One #2', market: 'futures', desdeDay: '2026-10-19' });
    expect(atNow.gate).toMatchObject({ status: 'liberado', tradingDay: '2026-10-23' });
    expect(atNow.gate.limit).toEqual(now.gate.limit);
    expect(atNow.version).toEqual(now.version);
    // Before the window opens, and on the day before
    expect((await fetchGateAt(db, top, new Date('2026-10-23T13:55:00Z'))).gate.status).toBe('fora_janela');
    expect((await fetchGateAt(db, top, new Date('2026-10-22T14:30:00Z'))).gate.tradingDay).toBe('2026-10-22');
    // Another user's account is not there
    expect(await refusal(fetchGateAt(pgClient(randomUUID()), top, new Date()))).toMatchObject({ code: 'unknown_account' });
  });

  it('a retried tap with the same client_key answers the first registration, even with other fields', async () => {
    setClock('2026-10-23T14:06:05Z');
    const key = newClientKey();
    const first = await registerEntry(db, top, entryPayload('futures', { clientKey: key, symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7900.25', clock: NY }));
    const again = await registerEntry(db, top, entryPayload('futures', { clientKey: key, symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7901.00', clock: NY }));
    expect(first.repeated).toBe(false);
    expect(again.repeated).toBe(true);
    expect(again.state.trade.id).toBe(first.state.trade.id);
    // The state shown is what was registered (the first price), never the retried form's
    expect(again.state.trade.entryPrice).toBe('7900.25');
    await undoEntry(db, first.state.trade.id);
  });

  it('D30: an entry like an imported trade is refused once, the dry run lists it, and the same key registers it confirmed', async () => {
    setClock('2026-10-23T14:07:05Z');
    expect(
      asUser(
        uid,
        `public.import_commit('${top}', 'topone', 'Trade-History-fluxos.csv', null, 'UTC', ${lit([
          {
            line: '2', external_id: `FLX1-${uid.slice(0, 6)}`, symbol: 'MESZ6', asset_type: 'futures', direction: 'long', local_entry: '2026-10-23T14:02:30',
            local_exit: '2026-10-23T14:05:10', entry_price: '7900.25', exit_price: '7903.75', quantity: '1', result: 'win', pnl: '17.50', commission: '0.62',
            stop_price: null, target_price: null, utc_offset: '+00:00', stake_amount: null, payout_percent: null, duration_seconds: null, timeframe: null,
          },
        ])})`,
      ),
    ).toMatchObject({ inserted: 1 });
    const key = newClientKey();
    const typed = { clientKey: key, symbol: 'MES', direction: 'long' as const, quantity: '1', entryPrice: '7900.25', clock: NY, entry: '10:02' };
    const dry = await previewEntry(db, top, entryPayload('futures', { ...typed, clientKey: undefined }));
    expect(dry.similar).toHaveLength(1);
    expect(await refusal(registerEntry(db, top, entryPayload('futures', typed)))).toEqual({ code: 'similar_trade', field: null });
    const ok = await registerEntry(db, top, entryPayload('futures', { ...typed, allowSimilar: true }));
    expect(ok.repeated).toBe(false);
    expect(ok.similar).toEqual(dry.similar);
    await undoEntry(db, ok.state.trade.id);
  });

  it('an exit’s own dry run, asked again after the exit, answers `repeated` (closed): writes never re-ask dry runs', async () => {
    setClock('2026-10-23T14:10:05Z');
    const reg = await registerEntry(db, top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MNQ', direction: 'short', quantity: '1', entryPrice: '30900', stop: '40', clock: NY }));
    const payload = exitPayload('futures', { exitPrice: '30880', clock: NY });
    expect((await previewExit(db, reg.state.trade.id, payload)).repeated).toBe(false);
    setClock('2026-10-23T14:12:05Z');
    const out = await registerExit(db, reg.state.trade.id, payload);
    expect(out.repeated).toBe(false);
    const after = await previewExit(db, reg.state.trade.id, payload);
    expect(after.repeated).toBe(true);
    // A second tap is success too, with the trade as registered
    expect((await registerExit(db, reg.state.trade.id, payload)).repeated).toBe(true);
  });

  it('«Salvar imagens e nota»: an upload refused by Storage (the reservation is past its 30 minutes) leaves only that image out; the next save sends only it', async () => {
    setClock('2026-10-23T14:20:05Z');
    const reg = await registerEntry(db, top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7905', clock: NY }));
    setClock('2026-10-23T14:25:05Z');
    await registerExit(db, reg.state.trade.id, exitPayload('futures', { exitPrice: '7906', clock: NY }));
    const tradeId = reg.state.trade.id;

    // The second upload starts 31 minutes after the reservation (a stalled phone)
    let uploads = 0;
    const slow = {
      ...db,
      rpc: db.rpc.bind(db),
      from: db.from.bind(db),
      storage: {
        from: (bucket: string) => {
          const real = db.storage.from(bucket);
          return {
            ...real,
            upload: (p: string, f: Blob, o: unknown) => {
              uploads += 1;
              if (uploads === 2) setClock('2026-10-23T14:56:05Z');
              return (real.upload as (p: string, f: Blob, o: unknown) => unknown)(p, f, o);
            },
            remove: real.remove,
          };
        },
      },
    } as unknown as SupabaseClient;
    const items = [
      { kind: 'new' as const, key: 'a', file: png(4000), name: 'MES_10-20_entrada.png', mime: 'image/png' as const },
      { kind: 'new' as const, key: 'b', file: png(5000), name: 'MES_10-25_saida.png', mime: 'image/png' as const },
    ];
    const first = await saveImagesAndNote(slow, tradeId, { items, note: 'Duas imagens.' }, { codec });
    expect(first.failed).toEqual([{ key: 'b', name: 'MES_10-25_saida.png', reason: 'upload' }]);
    expect(first.state.images.map((i) => i.name)).toEqual(['MES_10-20_entrada.png']);
    expect(first.state.trade.note).toBe('Duas imagens.');
    // The refused reservation went to the trash with the save and left it (no file was there)
    expect(asUser(uid, `(select count(*) from public.trade_image_trash)`)).toBe(0);
    expect(asUser(uid, `(select count(*) from public.trade_attachments where trade_id = '${tradeId}' and status = 'pendente')`)).toBe(0);

    // The editor sends again only the failed one, the saved one keeps its place
    const second = await saveImagesAndNote(db, tradeId, { items: [{ kind: 'saved', id: first.savedIds.a }, items[1]] }, { codec });
    expect(second.failed).toEqual([]);
    expect(second.state.images.map((i) => i.name)).toEqual(['MES_10-20_entrada.png', 'MES_10-25_saida.png']);
    expect(second.state.trade.note).toBe('Duas imagens.');
    expect(objects(uid)).toHaveLength(2);
    // Every file went as reserved: WebP, typed as such
    expect(asUser(uid, `(select jsonb_agg(distinct mime) from public.trade_attachments where trade_id = '${tradeId}')`)).toEqual(['image/webp']);
  });

  it('a fifth image never reaches Storage', async () => {
    setClock('2026-10-23T15:00:05Z');
    const tradeId = (asUser(uid, `(select to_jsonb(trade_id) from public.trade_attachments where status = 'ok' limit 1)`) as string) ?? '';
    const saved = asUser(uid, `(select jsonb_agg(id order by position) from public.trade_attachments where trade_id = '${tradeId}' and status = 'ok')`) as string[];
    const before = objects(uid).length;
    const three = [0, 1, 2].map((k) => ({ kind: 'new' as const, key: `n${k}`, file: png(1000), name: `x${k}.png`, mime: 'image/png' as const }));
    await expect(saveImagesAndNote(db, tradeId, { items: [...saved.map((id) => ({ kind: 'saved' as const, id })), ...three] }, { codec })).rejects.toMatchObject({ code: 'too_many_images' });
    expect(await refusal(imageSlots(db, tradeId, imageSlotsRequest(saved, three.map((t) => ({ mime: 'image/webp' as const, bytes: 300, name: t.name })))))).toEqual({ code: 'too_many_images', field: 'new' });
    expect(objects(uid)).toHaveLength(before);
  });

  it('«Desfazer entrada» of a trade with an image: the answer’s trash leaves Storage', async () => {
    setClock('2026-10-23T15:02:05Z');
    const reg = await registerEntry(db, top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MGC', direction: 'long', quantity: '1', entryPrice: '4400', clock: NY }));
    const slots = await imageSlots(db, reg.state.trade.id, imageSlotsRequest([], [{ mime: 'image/webp', bytes: 300, name: 'MGC.webp' }]));
    await uploadImage(db, slots.slots[0], new Blob([new Uint8Array(300)], { type: 'image/webp' }));
    await saveExtras(db, reg.state.trade.id, extrasPayload({ images: [slots.slots[0].id] }));
    expect(objects(uid)).toContain(slots.slots[0].path);
    const undone = await undoEntry(db, reg.state.trade.id);
    expect(undone.trash).toEqual([slots.slots[0].path]);
    expect(await drainImageTrash(db, undone.trash)).toEqual({ cleared: 1, remaining: 0 });
    expect(objects(uid)).not.toContain(slots.slots[0].path);
  });
});

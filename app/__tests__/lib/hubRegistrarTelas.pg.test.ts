/**
 * @jest-environment node
 *
 * The owner's Phase 3 day, against the real SQL, for the screens (PR 3-3): what the sheet, the
 * /diario bridge and the exit banners read, recorded from the functions of migrations
 * 20261020000001..4 on a throwaway local Postgres whose clock the suite moves between steps.
 * Skipped unless both are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds)
 *                                                           from this file (an interposed clock: see
 *                                                           testing/registrarTelas.ts)
 *   BH_PG_RECORD=<dir>                                      writes the fixtures there
 *
 * An invented user with «Top One #1» (futures, 10:00–11:00 ET seg–sex, US$ 400 por conta,
 * encerrar), «Ebinex» (binary, 20:00–21:00 de Brasília seg–sex, no limit) and «FTMO» (forex,
 * 08:00–10:00 ET seg–sex, US$ 1.000), rules since Wed 14 Oct 2026, a small invented import on Thu
 * 15 Oct, and the approved board's scenario 10 on Wed 21 / Thu 22 Oct (testing/registrarTelas.ts
 * lists every fixture).
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import { MON_TO_FRI } from '@/lib/domain';
import { afterPayload, entryPayload, exitPayload, extrasPayload, imageSlotsRequest, marksPayload } from '@/lib/domain/registro';
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras';
import { avisoDoLimite, inicioDoDia, padroesDoRegistrar } from '@/lib/hub/registrar';
import {
  RECENT_COLUMNS,
  TRADE_COLUMNS,
  RegistrarDataError,
  addMarks,
  dayTradesOfRows,
  fetchDayTrades,
  fetchOpenTrades,
  fetchTradeState,
  imageSlots,
  newClientKey,
  openTradesOfRows,
  previewAfter,
  previewEntry,
  readDayTradesRows,
  readTradeViewRows,
  recentTradesOfRows,
  registerAfter,
  registerEntry,
  registerExit,
  saveExtras,
  tradeViewOfRows,
  undoEntry,
  uploadImage,
} from '@/lib/hub/registrarDb';
import { ACCOUNT_COLUMNS } from '@/lib/hub/contasDb';
import { PG_URL, asUser, asUserExec, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const RECORD = process.env.BH_PG_RECORD;
const NY = 'America/New_York' as const;
const SP = 'America/Sao_Paulo' as const;

const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

/** Moves the server's clock to `iso` (the real time plus a shift, read by the interposed clock) */
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

describePg('the owner’s Phase 3 day × the real SQL (fixtures for the screens)', () => {
  const uid = randomUUID();
  const log: { name: string; args: Record<string, unknown>; answer: { data: unknown; error: unknown } }[] = [];
  const db = pgClient(uid, log);
  const acc: Record<'topOne' | 'ebinex' | 'ftmo', string> = { topOne: '', ebinex: '', ftmo: '' };
  const trades: Record<string, string> = {};
  const recorded: string[] = [];
  const write = (name: string, json: unknown) => {
    recorded.push(name);
    if (RECORD) fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
  };
  const lastAnswer = () => log[log.length - 1].answer.data;
  const rulesNow = (): { json: unknown; parsed: RulesNow } => {
    const json = asUser(uid, 'public.rules_now()');
    return { json, parsed: parseRulesNow(json) };
  };
  const rows = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await q;
    if (r.error) throw new Error(JSON.stringify(r.error));
    return r.data;
  };

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`set storage.allow_delete_query = 'true';
delete from storage.objects where owner_id = '${uid}';
delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Wed 14 Oct 09:00 ET: the accounts and their rules (v1 «desde 14 out»)', async () => {
    setClock('2026-10-14T13:00:05Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'dono-${uid.slice(0, 8)}@example.test');`);
    acc.topOne = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #1', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
    acc.ebinex = await createAccountAsUser(uid, { market: 'binary', label: 'Ebinex', platform: 'ebinex', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    acc.ftmo = await createAccountAsUser(uid, { market: 'forex', label: 'FTMO', platform: 'mt5', firm: 'FTMO', external_ref: null, phase: 'avaliacao', size: null, is_primary: false });
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        accounts: {
          [acc.topOne]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI }, version: 'force' },
          [acc.ebinex]: { rules: { v: 1 }, window: { tz: SP, start_min: 1200, end_min: 1260, weekdays: MON_TO_FRI }, version: 'force' },
          [acc.ftmo]: { rules: { v: 1, limit: { usd: 1000, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: NY, start_min: 480, end_min: 600, weekdays: MON_TO_FRI }, version: 'force' },
        },
      })})`,
    );
    psql(`insert into public.hub_members (user_id) values ('${uid}');`);
    write('contas', await rows(db.from('trading_accounts').select(ACCOUNT_COLUMNS).eq('is_example', false).order('sort_order').order('created_at') as never));
    const now = rulesNow().parsed;
    expect(now.accounts.map((a) => [a.label, a.desdeDay])).toEqual([
      ['Top One #1', '2026-10-14'],
      ['Ebinex', '2026-10-14'],
      ['FTMO', '2026-10-14'],
    ]);
  });

  it('Thu 15 Oct 21:40 de Brasília: a small invented import on both accounts (the form’s starting values)', () => {
    setClock('2026-10-16T00:40:05Z');
    const row = (r: Record<string, unknown>) => ({
      stop_price: null, target_price: null, utc_offset: '+00:00', stake_amount: null, payout_percent: null, duration_seconds: null, timeframe: null, ...r,
    });
    const ebx = [
      row({ line: '2', external_id: `EBX1-${uid.slice(0, 6)}`, symbol: 'EUR/USD', asset_type: 'binary_option', direction: 'call', local_entry: '2026-10-15T23:04:52', local_exit: '2026-10-15T23:06:00', entry_price: '1.16010', exit_price: '1.16032', quantity: '1', stake_amount: '20.00', payout_percent: '88', duration_seconds: '60', timeframe: 'M1', result: 'win', pnl: '17.60', commission: '0.00' }),
      row({ line: '3', external_id: `EBX2-${uid.slice(0, 6)}`, symbol: 'EUR/USD', asset_type: 'binary_option', direction: 'put', local_entry: '2026-10-15T23:10:55', local_exit: '2026-10-15T23:12:00', entry_price: '1.16040', exit_price: '1.16051', quantity: '1', stake_amount: '20.00', duration_seconds: '60', timeframe: 'M1', result: 'loss', pnl: '-20.00', commission: '0.00' }),
      row({ line: '4', external_id: `EBX3-${uid.slice(0, 6)}`, symbol: 'BTC/USDT', asset_type: 'binary_option', direction: 'call', local_entry: '2026-10-15T23:20:50', local_exit: '2026-10-15T23:22:00', entry_price: '112400.10', exit_price: '112455.30', quantity: '1', stake_amount: '25.00', payout_percent: '85', duration_seconds: '60', timeframe: 'M1', result: 'win', pnl: '21.25', commission: '0.00' }),
      row({ line: '5', external_id: `EBX4-${uid.slice(0, 6)}`, symbol: 'EUR/USD', asset_type: 'binary_option', direction: 'call', local_entry: '2026-10-15T23:30:58', local_exit: '2026-10-15T23:32:00', entry_price: '1.16070', exit_price: '1.16090', quantity: '1', stake_amount: '20.00', payout_percent: '87', duration_seconds: '60', timeframe: 'M1', result: 'win', pnl: '17.40', commission: '0.00' }),
    ];
    expect(asUser(uid, `public.import_commit('${acc.ebinex}', 'ebinex', 'operacoes_inventadas.csv', null, 'UTC', ${lit(ebx)})`)).toMatchObject({ inserted: 4 });
    const top = [
      row({ line: '2', external_id: `TOP1-${uid.slice(0, 6)}`, symbol: 'MESZ6', asset_type: 'futures', direction: 'long', local_entry: '2026-10-15T14:12:30', local_exit: '2026-10-15T14:20:10', entry_price: '7880.25', exit_price: '7884.75', quantity: '2', result: 'win', pnl: '45.00', commission: '1.34' }),
      row({ line: '3', external_id: `TOP2-${uid.slice(0, 6)}`, symbol: 'MNQZ6', asset_type: 'futures', direction: 'short', local_entry: '2026-10-15T14:31:00', local_exit: '2026-10-15T14:40:00', entry_price: '30700.50', exit_price: '30690.00', quantity: '1', result: 'win', pnl: '21.00', commission: '0.74' }),
    ];
    expect(asUser(uid, `public.import_commit('${acc.topOne}', 'topone', 'Trade-History-inventado.csv', null, 'UTC', ${lit(top)})`)).toMatchObject({ inserted: 2 });
  });

  it('Wed 21 Oct 10:52 ET: an MNQ entry left open overnight', async () => {
    setClock('2026-10-21T14:52:05Z');
    const reg = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MNQ', direction: 'long', quantity: '1', entryPrice: '30880.50', stop: '40', target: '80', clock: NY, marks: { setup: 'A' } }));
    write('entry-mnq-qua', lastAnswer());
    trades.mnqQua = reg.state.trade.id;
    expect(reg.state.trade).toMatchObject({ status: 'open', tradingDay: '2026-10-21', stopPrice: '30840.5', targetPrice: '30960.5' });
  });

  it('Wed 21 Oct 11:05 ET: «Fora da sua janela» before registering (the owner’s test)', async () => {
    setClock('2026-10-21T15:05:05Z');
    const dry = await previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7900.00', clock: NY }));
    write('entry-dry-fora-janela', lastAnswer());
    expect(dry.gate.status).toBe('fora_janela');
    expect(dry.plan).toEqual({ breaks: ['fora_da_janela'], verdict: 'fora_do_plano', checksEvaluated: ['janela', 'limite'] });
    const now = rulesNow();
    write('agora-qua-1105-et', now.json);
    expect(now.parsed.accounts[0].gate.status).toBe('fora_janela');
  });

  it('Thu 22 Oct 10:01–10:24 ET: an MNQ loss with a note, then MES and MGC left open', async () => {
    setClock('2026-10-22T14:01:05Z');
    const mnq = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MNQ', direction: 'short', quantity: '2', entryPrice: '30950', stop: '60', target: '120', clock: NY, marks: { setup: 'B' } }));
    write('entry-mnq-qui', lastAnswer());
    trades.mnqQui = mnq.state.trade.id;

    setClock('2026-10-22T14:08:05Z');
    const out = await registerExit(db, trades.mnqQui, exitPayload('futures', { exitPrice: '31011.25', clock: NY }));
    write('exit-mnq-perda', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '-245', result: 'loss', points: '-61.25' });
    const note = await saveExtras(db, trades.mnqQui, extrasPayload({ note: 'Entrei contra a abertura e saí no stop.' }));
    write('extras-nota', lastAnswer());
    expect(note.state.trade.note).toBe('Entrei contra a abertura e saí no stop.');

    setClock('2026-10-22T14:12:05Z');
    const mes = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7912.50', stop: '10', target: '20', clock: NY, marks: { setup: 'A', execucao: 'no_ponto' } }));
    write('entry-mes', lastAnswer());
    trades.mes = mes.state.trade.id;

    setClock('2026-10-22T14:24:05Z');
    const mgc = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MGC', direction: 'short', quantity: '1', entryPrice: '4421.3', stop: '16', target: '24', clock: NY, marks: { setup: 'B' } }));
    write('entry-mgc', lastAnswer());
    trades.mgc = mgc.state.trade.id;
  });

  it('Thu 22 Oct 10:31 ET: what the sheet and the bridge read (scenario 10)', async () => {
    setClock('2026-10-22T14:31:05Z');
    // A tap on «Como você está?» with MES open
    await addMarks(db, trades.mes, marksPayload({ emocao: 'calmo' }));
    write('marks-mes-aberta', lastAnswer());

    // A typed hour (11 minutes back): «Posso operar hoje? Na entrada:»
    const typed = await previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7905.25', stop: '10', clock: NY, entry: '10:20' }));
    write('entry-dry-mes-digitada', lastAnswer());
    expect(typed.limitRoom).toMatchObject({ net: '-245', left: '155', risk: '100', above: false });
    // ES with a 4-point stop: US$ 200 at risk, US$ 155 left → the warning
    const es = await previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'ES', direction: 'long', quantity: '1', entryPrice: '6650.25', stop: '4', clock: NY }));
    write('entry-dry-es-acima', lastAnswer());
    expect(es.limitRoom).toEqual({ limit: '400', net: '-245', reached: false, left: '155', risk: '200', above: true });
    expect(await refusal(previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7905.25', clock: NY, entry: '10:14' })))).toEqual({ code: 'entry_too_old', field: 'entry' });

    // «Desfazer entrada» right after a mistaken ES entry
    const wrong = await registerEntry(db, acc.topOne, entryPayload('futures', { clientKey: newClientKey(), symbol: 'ES', direction: 'long', quantity: '1', entryPrice: '6650.25', clock: NY }));
    await undoEntry(db, wrong.state.trade.id);
    write('undo-es', lastAnswer());

    // «Já fechada» on «Ontem», and on a day before «desde»
    const ontem = await previewAfter(db, acc.topOne, afterPayload('futures', { symbol: 'MES', direction: 'short', quantity: '2', entryPrice: '7938.50', stop: '12', clock: NY, day: '2026-10-21', entry: '10:33', exit: '10:49', exitPrice: '7929.00' }));
    write('after-dry-ontem', lastAnswer());
    expect(ontem.exit).toMatchObject({ pnl: '95', points: '9.5' });
    expect(ontem.tradingDay).toBe('2026-10-21');
    expect(await refusal(previewAfter(db, acc.topOne, afterPayload('futures', { symbol: 'MES', direction: 'short', quantity: '2', entryPrice: '7938.50', clock: NY, day: '2026-10-13', entry: '10:33', exit: '10:49', exitPrice: '7929.00' })))).toEqual({ code: 'before_rules', field: 'day' });

    const now = rulesNow();
    write('agora-qui-1031-et', now.json);
    expect(now.parsed.accounts[0].gate).toMatchObject({ status: 'liberado', tradingDay: '2026-10-22' });
    expect(now.parsed.accounts[0].gate.limit).toMatchObject({ evaluated: true, state: 'ok', netCents: -24500, worstCents: -24500, near: false });

    const open = await rows(db.from('trades').select(TRADE_COLUMNS).eq('status', 'open').eq('account_id', acc.topOne).order('entry_time') as never);
    write('abertas-qui-1031', open);
    expect(openTradesOfRows(open).map((t) => [t.symbol, t.tradingDay])).toEqual([
      ['MNQ', '2026-10-21'],
      ['MES', '2026-10-22'],
      ['MGC', '2026-10-22'],
    ]);
    expect(await fetchOpenTrades(db, acc.topOne)).toEqual(openTradesOfRows(open));

    const since = inicioDoDia('2026-10-22', 'futures');
    const dia = await readDayTradesRows(db, acc.topOne, '2026-10-22', since);
    write('dia-qui-1031', dia);
    expect(dayTradesOfRows(dia).map((d) => [d.trade.symbol, d.trade.status, d.images, d.trade.note !== null])).toEqual([
      ['MNQ', 'open', 0, false],
      ['MNQ', 'closed', 0, true],
      ['MES', 'open', 0, false],
      ['MGC', 'open', 0, false],
    ]);
    expect(await fetchDayTrades(db, acc.topOne, '2026-10-22', since)).toEqual(dayTradesOfRows(dia));

    const view = await readTradeViewRows(db, trades.mes);
    write('operacao-mes-aberta', view);
    expect(tradeViewOfRows(view!).marks.map((m) => [m.kind, m.value, m.limpa])).toEqual([
      ['setup', 'A', true],
      ['execucao', 'no_ponto', true],
      ['emocao', 'calmo', true],
    ]);

    const recentTop = await rows(db.from('trades').select(RECENT_COLUMNS).eq('account_id', acc.topOne).order('entry_time', { ascending: false }).limit(200) as never);
    write('recentes-top-one', recentTop);
    expect(padroesDoRegistrar('futures', recentTradesOfRows(recentTop))).toMatchObject({ symbol: 'MGC', quantity: '1' });
    const recentEbx = await rows(db.from('trades').select(RECENT_COLUMNS).eq('account_id', acc.ebinex).order('entry_time', { ascending: false }).limit(200) as never);
    write('recentes-ebinex', recentEbx);
    expect(padroesDoRegistrar('binary', recentTradesOfRows(recentEbx))).toEqual({
      symbol: 'EUR/USD',
      quantity: '1',
      pairs: ['EUR/USD', 'BTC/USDT'],
      payoutBySymbol: { 'EUR/USD': '87', 'BTC/USDT': '85' },
      stake: '20',
    });
  });

  it('Thu 22 Oct 10:38–10:42 ET: the exits, the 80 % banner, the limit, and yesterday’s MNQ', async () => {
    const before = rulesNow().parsed.accounts[0].gate;
    setClock('2026-10-22T14:38:05Z');
    const mes = await registerExit(db, trades.mes, exitPayload('futures', { exitPrice: '7902.50', clock: NY }));
    write('exit-mes-oitenta', lastAnswer());
    expect(mes.exit).toMatchObject({ pnl: '-100', r: '-1' });
    expect(mes.gateNow?.limit).toMatchObject({ evaluated: true, state: 'ok', worstCents: -34500, near: true });
    const aviso80 = avisoDoLimite({
      market: 'futures',
      tradeDay: mes.state.trade.tradingDay,
      before: { tradingDay: before.tradingDay, limit: before.limit },
      after: mes.gateNow,
      exitAt: mes.exit!.exitAt,
      pref80: true,
    });
    expect(aviso80).toMatchObject({ tipo: 'oitenta', worstCents: -34500, limitCents: 40000 });

    // Two images and a note on the closed MES
    const slots = await imageSlots(db, trades.mes, imageSlotsRequest([], [
      { mime: 'image/webp', bytes: 860160, name: 'MES_10-12_entrada.webp' },
      { mime: 'image/webp', bytes: 1258291, name: 'MES_10-38_saida.webp' },
    ]));
    write('slots-mes', lastAnswer());
    for (let k = 0; k < slots.slots.length; k++) {
      const slot = slots.slots[k];
      await uploadImage(db, slot, new Blob([new Uint8Array(k === 0 ? 860160 : 1258291)], { type: slot.mime }));
    }
    await saveExtras(db, trades.mes, extrasPayload({ images: slots.slots.map((s) => s.id), note: 'Saí no stop: o rompimento não confirmou.' }));
    write('extras-mes', lastAnswer());

    setClock('2026-10-22T14:40:05Z');
    const beforeMgc = rulesNow().parsed.accounts[0].gate;
    const mgc = await registerExit(db, trades.mgc, exitPayload('futures', { exitPrice: '4437.30', clock: NY }));
    write('exit-mgc-atingido', lastAnswer());
    expect(mgc.exit).toMatchObject({ pnl: '-160', r: '-1' });
    expect(mgc.gateNow).toMatchObject({ status: 'encerrado' });
    const atingido = avisoDoLimite({
      market: 'futures',
      tradeDay: mgc.state.trade.tradingDay,
      before: { tradingDay: beforeMgc.tradingDay, limit: beforeMgc.limit },
      after: mgc.gateNow,
      exitAt: mgc.exit!.exitAt,
      pref80: true,
    });
    expect(atingido).toMatchObject({ tipo: 'atingido', worstCents: -50500, limitCents: 40000, atLimit: 'encerrar' });
    // Reached by this exit (registered with the hour field on the current minute: now, to the second)
    expect(atingido && atingido.tipo === 'atingido' && atingido.hitAt?.getTime()).toBe(mgc.exit!.exitAt.getTime());

    setClock('2026-10-22T14:42:05Z');
    const beforeMnq = rulesNow().parsed.accounts[0].gate;
    const mnq = await registerExit(db, trades.mnqQua, exitPayload('futures', { exitPrice: '30912.75', clock: NY }));
    write('exit-mnq-ontem', lastAnswer());
    expect(mnq.exit).toMatchObject({ pnl: '64.5' });
    expect(mnq.state.trade.tradingDay).toBe('2026-10-21');
    expect(avisoDoLimite({ market: 'futures', tradeDay: mnq.state.trade.tradingDay, before: { tradingDay: beforeMnq.tradingDay, limit: beforeMnq.limit }, after: mnq.gateNow, exitAt: mnq.exit!.exitAt, pref80: true })).toBeNull();

    const now = rulesNow();
    write('agora-qui-1042-et', now.json);
    expect(now.parsed.accounts[0].gate).toMatchObject({ status: 'encerrado' });
    const dia = await readDayTradesRows(db, acc.topOne, '2026-10-22', inicioDoDia('2026-10-22', 'futures'));
    write('dia-qui-1042', dia);
    expect(dayTradesOfRows(dia).map((d) => [d.trade.symbol, d.trade.status, d.trade.pnl, d.images])).toEqual([
      ['MNQ', 'closed', '64.5', 0],
      ['MNQ', 'closed', '-245', 0],
      ['MES', 'closed', '-100', 2],
      ['MGC', 'closed', '-160', 0],
    ]);
    const view = await readTradeViewRows(db, trades.mes);
    write('operacao-mes-fechada', view);
    expect(tradeViewOfRows(view!).images.map((i) => i.name)).toEqual(['MES_10-12_entrada.webp', 'MES_10-38_saida.webp']);
    expect(await fetchTradeState(db, trades.mes)).toEqual(tradeViewOfRows(view!));
  });

  it('Thu 22 Oct 20:10–20:24 de Brasília: an Ebinex put on the next candle, its loss, and a «Já fechada»', async () => {
    setClock('2026-10-22T23:10:20Z');
    const reg = await registerEntry(db, acc.ebinex, entryPayload('binary', { clientKey: newClientKey(), symbol: 'EUR/USD', direction: 'put', stake: '20', payout: '88', durationS: 60, clock: SP, marks: { setup: 'B' } }));
    write('entry-ebinex-put', lastAnswer());
    trades.ebx = reg.state.trade.id;
    expect(reg.state.trade.expiresAt?.toISOString()).toBe('2026-10-22T23:12:00.000Z');
    const m5 = await previewEntry(db, acc.ebinex, entryPayload('binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 300, clock: SP }));
    write('entry-dry-ebinex-m5', lastAnswer());
    expect(m5.expiresAt?.toISOString()).toBe('2026-10-22T23:20:00.000Z');
    const m15 = await previewEntry(db, acc.ebinex, entryPayload('binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', durationS: 900, clock: SP }));
    write('entry-dry-ebinex-m15', lastAnswer());
    expect(m15.expiresAt?.toISOString()).toBe('2026-10-22T23:30:00.000Z');
    expect(await refusal(registerExit(db, trades.ebx, exitPayload('binary', { outcome: 'perda' })))).toEqual({ code: 'not_expired', field: 'outcome' });

    setClock('2026-10-22T23:12:30Z');
    const out = await registerExit(db, trades.ebx, exitPayload('binary', { outcome: 'perda' }));
    write('exit-ebinex-perda', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '-20', result: 'loss', pnlBasis: 'outcome' });
    const after = await addMarks(db, trades.ebx, marksPayload({ setup: 'C' }));
    write('marks-ebinex-depois', lastAnswer());
    expect(after.marks.map((m) => [m.value, m.limpa])).toEqual([
      ['B', true],
      ['C', false],
    ]);

    setClock('2026-10-22T23:24:05Z');
    const fields = { symbol: 'GBP/USD', direction: 'call' as const, stake: '20', payout: '87', durationS: 300, clock: SP, day: '2026-10-22', entry: '20:13', outcome: 'ganho' as const };
    const dry = await previewAfter(db, acc.ebinex, afterPayload('binary', fields));
    write('after-dry-ebinex', lastAnswer());
    expect(dry.expiresAt?.toISOString()).toBe('2026-10-22T23:20:00.000Z');
    const done = await registerAfter(db, acc.ebinex, afterPayload('binary', { ...fields, clientKey: newClientKey() }));
    write('after-ebinex', lastAnswer());
    expect(done.state.trade).toMatchObject({ pnl: '17.4', result: 'win', source: 'after' });

    const now = rulesNow();
    write('agora-qui-2024-brt', now.json);
    expect(now.parsed.accounts[1].gate).toMatchObject({ status: 'liberado', tradingDay: '2026-10-22' });
    const dia = await readDayTradesRows(db, acc.ebinex, '2026-10-22', inicioDoDia('2026-10-22', 'binary'));
    write('dia-ebinex', dia);
    expect(dayTradesOfRows(dia).map((d) => [d.trade.symbol, d.origin, d.trade.pnl])).toEqual([
      ['EUR/USD', 'live', '-20'],
      ['GBP/USD', 'reconstructed', '17.4'],
    ]);
  });

  it('records the ids the fixtures refer to', () => {
    write('ids', { user: uid, accounts: acc, trades });
    expect(recorded.length).toBeGreaterThan(30);
  });
});

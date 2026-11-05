/**
 * @jest-environment node
 *
 * Phase 4 (the Diário) against the real SQL of every migration (20261105000001..2 included), on a
 * throwaway local Postgres whose clock the suite moves between steps. Skipped unless both are set
 * (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds)
 *                                                           from this file (an interposed clock)
 *   BH_PG_RECORD=<dir>                                      writes the answers there (testing/fixtures/diario)
 *
 * Every read and write goes through lib/hub/diarioDb (the stand-in client of testing/pg runs it as
 * the user; trades come in through the app's own paths: the Top One and Ebinex readers and
 * import_commit, «Registrar», «Já fechada», partials and «Mover stop»), and every answer is checked
 * against the domain: the kinds, weeks, closed weeks, bounds, carry-over and payload checks
 * (lib/domain/diario's twins of the SQL), the grid, levels and pending reviews, and the boards'
 * words on the answers (lib/hub/diario). Invented user and data, October 2026:
 *
 *   Top One #1 (Futuros, ET): history on 12 and 13 Oct; rules from Wed 14 Oct 09:12 (window
 *     10:00–11:00 Mon–Fri, US$ 400 that ends the day, breakeven MES +8); 14 Oct misto (08:50 history,
 *     11:20 outside the window); 15 Oct «Já fechada»; Wed 21 Oct the limit at 10:38 with US$ 426,66
 *     of loss and the 10:52 entry after it (−US$ 38,74; the day −US$ 465,40); Thu 22 Oct a live MES
 *     with a partial, the stop to breakeven and the exit, reviewed at 11:40 and edited at 18:05 with
 *     «Levar para o próximo pregão»; Fri 23 Oct «Antes de operar» at 09:40 (edited at 10:42, after
 *     the 10:04 entry still open); Mon 26 Oct 09:00, today.
 *   Ebinex (binárias, Brasília): history on Fri 9 Oct; rules from 14 Oct (window 09:00–12:00 every
 *     day, US$ 100 that warns); Saturday 24 and Sunday 25 Oct, the 13:30 outside the window.
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import {
  calendarMonths,
  carryInOf,
  checkNotePayload,
  checkReviewPayload,
  dayChanged,
  dayKindOf,
  dayTiles,
  heatLevels,
  isPendingReview,
  isWeekClosed,
  monthGrid,
  monthRange,
  noteTimes,
  notePayload,
  pendingReviews,
  reviewPayload,
  reviewValues,
  weekCard,
  weekOf,
  type CalendarRead,
} from '@/lib/domain/diario';
import { buildImportArgs, parseImportText, previewArgs, type ImportFile, type ParsedFile } from '@/lib/domain/import';
import { add, numeric, numericText, trimScale } from '@/lib/domain/registro/numeric';
import { afterPayload, entryPayload, exitPayload, extrasPayload, imageSlotsRequest, movePayload, partialPayload } from '@/lib/domain/registro';
import { EVERY_DAY, MON_TO_FRI, tradingDayBounds } from '@/lib/domain/tempo';
import { importCommit, importPreview } from '@/lib/hub/contasDb';
import {
  avisoDeRevisoes,
  doPregaoAnterior,
  fatosTexto,
  linhaDoTopo,
  linhasDoPlano,
  notaAntesDeOperar,
  notaDoDia,
  numerosDoDia,
  type ContaDiario,
} from '@/lib/hub/diario';
import {
  CALENDAR_MAX_DAYS,
  DiarioDataError,
  fetchCalendario,
  fetchDia,
  fetchMes,
  saveDayNote,
  saveDayReview,
  type DayRead,
} from '@/lib/hub/diarioDb';
import { imageSlots, moveStop, newClientKey, registerAfter, registerEntry, registerExit, registerPartial, saveExtras } from '@/lib/hub/registrarDb';
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

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const plus = (a: string, b: string) => numericText(trimScale(add(numeric(a), numeric(b))));

/** A Top One Trade History (UTC): [ticket, side, open, open price, close, close price, PnL, commission]; times «DD/MM/YYYY HH:MM:SS» */
const topOneCsv = (rows: [string, 'BUY' | 'SELL', string, string, string, string, string, string][]) =>
  [
    'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots,Commissions,Gain',
    ...rows.map(([t, side, o, op, c, cp, pnl, comm]) => `MESZ6/${t},MESZ6,${side},0,0,${o},${op},${c},${cp},10m 0s,${pnl},1,${comm},0.02%`),
  ].join('\n');

/** An Ebinex export (Brasília wall clock): [id, «DD/MM/YYYY HH:MM:SS», previsão, vela, open, close, status, result] */
const ebinexCsv = (rows: [string, string, 'bull' | 'bear', string, string, string, 'win' | 'lose', string][]) =>
  [
    'ID,Data,Ativo,Tempo,Previsão,Vela,P. ABRT,P. FECH,Valor,Estornado,Executado,Status,Resultado',
    ...rows.map(([id, at, dir, vela, o, c, status, res]) => `${id},${at},BTC/USDT,M1,${dir},${vela},"$ ${o}","$ ${c}",$ 10,$ 0,$ 10,${status},${res}`),
  ].join('\n');

describePg('Phase 4 × the real SQL: the Diário\'s reads and writes', () => {
  const uid = randomUUID();
  const log: { name: string; args: Record<string, unknown>; answer: { data: unknown; error: unknown } }[] = [];
  const db = pgClient(uid, log);
  const acc = { top: '', ebx: '' };
  const trades: Record<string, string> = {};
  const recorded: string[] = [];
  const write = (name: string, json: unknown) => {
    recorded.push(name);
    if (RECORD) fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
  };
  const lastAnswer = () => log[log.length - 1].answer.data;
  const TOP: ContaDiario = { currency: 'USD', market: 'futures', tz: NY };
  const EBX: ContaDiario = { currency: 'USD', market: 'binary', tz: SP };

  /** Preview, then commit, as the import sheet does (the preview counts as the commit) */
  async function importar(accountId: string, text: string, name: string, tz: string, platform: 'topone' | 'ebinex') {
    const parsed = parseImportText(text);
    if (!parsed.ok || parsed.platform !== platform) throw new Error(`not a ${platform} file`);
    expect(parsed.errors).toEqual([]);
    const args = buildImportArgs({ accountId, platform, fileName: name, sha256: sha(text), fileTz: tz, outcome: parsed as ParsedFile as ImportFile });
    const preview = await importPreview(db, previewArgs(args));
    const commit = await importCommit(db, args);
    expect(preview.new).toBe(commit.inserted);
    return commit;
  }

  /** A day read through diarioDb, recorded, and its general agreements with the domain */
  async function dia(accountId: string, day: string, name: string): Promise<DayRead> {
    const d = await fetchDia(db, accountId, day);
    write(name, lastAnswer());
    expect([d.day, d.kind, d.facts.day, d.facts.kind]).toEqual([day, d.facts.kind, day, d.kind]);
    expect(dayKindOf(d.facts.trades, d.facts.history.n)).toBe(d.kind);
    expect(d.trades.filter((t) => !t.history)).toHaveLength(d.facts.trades);
    expect(d.trades.filter((t) => t.history)).toHaveLength(d.facts.history.n);
    // The day's trades are trade_state's, in entry order, each inside the day's bounds
    for (const t of d.trades) {
      expect(t.trade.tradingDay).toBe(day);
      expect(t.trade.entryTime.getTime()).toBeGreaterThanOrEqual(d.bounds.start.getTime());
      expect(t.trade.entryTime.getTime()).toBeLessThan(d.bounds.end.getTime());
      expect(t.planKind).toBe(t.history ? null : t.context ? 'congelado' : 'recalculado');
      expect(t.planNow === null).toBe(t.planKind !== 'recalculado');
    }
    // fora.open = the open trades whose plan broke
    const verdict = (t: DayRead['trades'][number]) => (t.planNow ?? t.plan)?.verdict;
    expect(d.facts.fora.n).toBe(d.trades.filter((t) => !t.history && verdict(t) === 'fora_do_plano').length);
    expect(d.facts.fora.open).toBe(d.trades.filter((t) => !t.history && verdict(t) === 'fora_do_plano' && t.trade.status === 'open').length);
    expect(d.facts.firstEntryAt).toEqual(d.trades.find((t) => !t.history)?.trade.entryTime ?? null);
    // The «Antes de operar» answer is today's only; a review's versions newest first
    if (d.review) expect(d.review.previous.map((v) => v.savedAt.getTime())).toEqual(d.review.previous.map((v) => v.savedAt.getTime()).sort((a, b) => b - a));
    return d;
  }

  /** The calendar's agreements with the domain: kinds, closed weeks, the week sums of its days */
  function checkCalendar(c: CalendarRead) {
    for (const d of c.days) {
      expect([d.day, d.kind]).toEqual([d.day, dayKindOf(d.n, d.history?.n ?? 0)]);
    }
    for (const w of c.weeks) {
      expect([w.weekOf, w.closed]).toEqual([w.weekOf, isWeekClosed(c.account.market, w.weekOf, c.today)]);
      const days = c.days.filter((d) => d.kind !== 'vazio' && weekOf(d.day) === w.weekOf);
      expect({ n: w.n, net: w.net, gross: w.gross, days: w.days }).toEqual({
        n: days.reduce((s, d) => s + d.n, 0),
        net: days.reduce((s, d) => plus(s, d.net), '0'),
        gross: days.reduce((s, d) => plus(s, d.gross), '0'),
        days: days.filter((d) => d.n > 0).length,
      });
    }
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 12:00 ET: two accounts and their history (before any rule)', async () => {
    setClock('2026-10-13T16:00:05Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'diario-${uid.slice(0, 8)}@example.test');
insert into public.hub_members (user_id) values ('${uid}');`);
    acc.top = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #1', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
    acc.ebx = await createAccountAsUser(uid, { market: 'binary', label: 'Ebinex', platform: 'ebinex', firm: null, external_ref: null, phase: null, size: null, is_primary: false });
    await importar(
      acc.top,
      topOneCsv([
        ['900000000001', 'BUY', '12/10/2026 14:05:00', '7000', '12/10/2026 14:15:00', '7004', '$20', '1.24'],
        ['900000000002', 'BUY', '13/10/2026 13:40:00', '7000', '13/10/2026 13:50:00', '6997', '-$15', '1.24'],
      ]),
      'top_historico.csv',
      'UTC',
      'topone',
    );
    await importar(
      acc.ebx,
      ebinexCsv([
        ['c0ffee000000000000000001', '09/10/2026 10:15:10', 'bull', '10:16', '64,210.55', '64,233.10', 'win', '+$8.80'],
        ['c0ffee000000000000000002', '09/10/2026 10:40:30', 'bear', '10:41', '64,190.00', '64,230.00', 'lose', '-$10.00'],
      ]),
      'operacoes_historico.csv',
      SP,
      'ebinex',
    );
    // Without rules: every day is history; no review, no note
    const c = await fetchCalendario(db, acc.top);
    expect([c.desde, c.desdeDay, c.firstDay, c.days.map((d) => d.kind)]).toEqual([null, null, '2026-10-12', ['historico', 'historico']]);
    await expect(saveDayReview(db, acc.top, '2026-10-13', reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, newClientKey()))).rejects.toMatchObject({ code: 'no_rules' });
  });

  it('Wed 14 Oct 09:12 ET: the rules start («desde»); the 14 Oct file makes it misto', async () => {
    setClock('2026-10-14T13:12:05Z');
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: {
          [acc.top]: {
            rules: { v: 1, window_rule: { on: true, outside: 'fora' }, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' }, breakeven: { on: true, by: { MES: 8 } } },
            window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI },
            version: 'force',
          },
          [acc.ebx]: {
            rules: { v: 1, window_rule: { on: true, outside: 'fora' }, limit: { usd: 100, mode: 'conta', at_limit: 'avisar' } },
            window: { tz: SP, start_min: 540, end_min: 720, weekdays: EVERY_DAY },
            version: 'force',
          },
        },
      })})`,
    );
    setClock('2026-10-14T21:00:05Z');
    await importar(
      acc.top,
      topOneCsv([
        ['900000000003', 'BUY', '14/10/2026 12:50:00', '7000', '14/10/2026 12:58:00', '7004', '$20', '1.24'],
        ['900000000004', 'BUY', '14/10/2026 14:05:00', '7000', '14/10/2026 14:12:00', '7008', '$40', '1.24'],
        ['900000000005', 'BUY', '14/10/2026 14:20:00', '7010', '14/10/2026 14:31:00', '7005', '-$25', '1.24'],
        ['900000000006', 'BUY', '14/10/2026 15:20:00', '7000', '14/10/2026 15:30:00', '7002', '$10', '1.24'],
      ]),
      'top_1014.csv',
      'UTC',
      'topone',
    );
  });

  it('Thu 15 Oct 11:30 ET: «Já fechada» (a day due a review)', async () => {
    setClock('2026-10-15T15:30:05Z');
    const r = await registerAfter(
      db,
      acc.top,
      afterPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7000.00', stop: '10', clock: NY, day: '2026-10-15', entry: '10:15', exit: '10:40', exitPrice: '7006.00', allowSimilar: true }),
    );
    trades.jaFechada = r.state.trade.id;
  });

  it('Wed 21 Oct 17:00 ET: the file of the limit day', async () => {
    setClock('2026-10-21T21:00:05Z');
    await importar(
      acc.top,
      topOneCsv([
        ['900000000011', 'BUY', '21/10/2026 14:02:00', '7000', '21/10/2026 14:08:00', '6970', '-$150', '0'],
        ['900000000012', 'BUY', '21/10/2026 14:15:00', '6990', '21/10/2026 14:22:00', '6966', '-$120', '0'],
        ['900000000013', 'BUY', '21/10/2026 14:30:00', '6980', '21/10/2026 14:38:00', '6949', '-$155', '1.66'],
        ['900000000014', 'BUY', '21/10/2026 14:52:00', '6960', '21/10/2026 14:58:00', '6952.75', '-$36.25', '2.49'],
      ]),
      'top_1021.csv',
      'UTC',
      'topone',
    );
  });

  it('Thu 22 Oct: a live MES, a partial, the stop to breakeven, the exit; the review at 11:40, edited at 18:05', async () => {
    setClock('2026-10-22T14:05:05Z');
    const e = await registerEntry(db, acc.top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '3', entryPrice: '7912.50', stop: '10', target: '20', clock: NY, marks: { setup: 'A' } }));
    trades.live = e.state.trade.id;
    setClock('2026-10-22T14:12:05Z');
    await registerPartial(db, trades.live, partialPayload({ clientKey: newClientKey(), quantity: '1', exitPrice: '7920.50', exit: '10:12', clock: NY }));
    setClock('2026-10-22T14:13:05Z');
    await moveStop(db, trades.live, movePayload({ clientKey: newClientKey(), kind: 'breakeven', priceNow: '7920.50' }));
    setClock('2026-10-22T14:25:05Z');
    await registerExit(db, trades.live, exitPayload('futures', { exitPrice: '7926.00', exit: '10:25', clock: NY }));
    // «Imagens e nota»: one chart and a note (the drill reads their metadata, signs the path)
    const slots = await imageSlots(db, trades.live, imageSlotsRequest([], [{ mime: 'image/webp', bytes: 2048, name: 'MES_entrada.webp' }]));
    asUserExec(uid, `insert into storage.objects (bucket_id, name, owner_id, metadata) values ('trade-images', '${slots.slots[0].path}', '${uid}', '{"size": 2048, "mimetype": "image/webp"}');`);
    await saveExtras(db, trades.live, extrasPayload({ note: 'Entrei no reteste.', images: [slots.slots[0].id] }));

    setClock('2026-10-22T15:40:05Z');
    const form = { worked: '  Esperei o reteste da mínima.\n', differently: '', followed: 'sim' as const, carryForward: 'Esperar o reteste antes de comprar.' };
    const dry = await saveDayReview(db, acc.top, '2026-10-22', reviewPayload(form, null), { dryRun: true });
    write('revisao-1022-previa', lastAnswer());
    expect([dry.dryRun, dry.repeated, dry.review]).toEqual([true, false, null]);
    const key = newClientKey();
    const saved = await saveDayReview(db, acc.top, '2026-10-22', reviewPayload(form, key));
    write('revisao-1022', lastAnswer());
    expect(saved.repeated).toBe(false);
    // What the server stored = the domain's reading of the payload
    const want = reviewValues(reviewPayload(form, key));
    expect({ worked: saved.review!.worked, differently: saved.review!.differently, followed: saved.review!.followed, carryForward: saved.review!.carryForward }).toEqual(want);
    expect(want).toEqual({ worked: 'Esperei o reteste da mínima.', differently: null, followed: 'sim', carryForward: 'Esperar o reteste antes de comprar.' });
    // Frozen = the facts at the save; the same key again writes nothing
    expect(saved.review!.autoSummary).toEqual(saved.factsNow);
    expect([saved.review!.versions, saved.review!.written, saved.review!.firstSavedAt.getTime()]).toEqual([1, true, saved.review!.savedAt.getTime()]);
    const again = await saveDayReview(db, acc.top, '2026-10-22', reviewPayload(form, key));
    write('revisao-1022-repetida', lastAnswer());
    expect([again.repeated, again.review!.id]).toEqual([true, saved.review!.id]);
    // The same content with another key: nothing to write either
    expect((await saveDayReview(db, acc.top, '2026-10-22', reviewPayload(form, newClientKey()))).repeated).toBe(true);

    setClock('2026-10-22T22:05:05Z');
    const edited = await saveDayReview(db, acc.top, '2026-10-22', reviewPayload({ ...form, followed: 'em_parte', differently: 'Parar depois do alvo.' }, newClientKey()));
    write('revisao-1022-editada', lastAnswer());
    expect([edited.repeated, edited.review!.versions, edited.review!.followed]).toEqual([false, 2, 'em_parte']);
    expect(edited.review!.firstSavedAt).toEqual(saved.review!.savedAt);
  });

  it('the payload checks: the server refuses exactly what the domain refuses, in its order', async () => {
    const cases: [string, unknown, boolean][] = [
      ['not an object', [], false],
      ['v 2', { v: 2, worked: 'x' }, false],
      ['an unknown key', { v: 1, client_key: newClientKey(), humor: 'x' }, false],
      ['no client_key', { v: 1, worked: 'x' }, false],
      ['a client_key in upper case', { v: 1, client_key: newClientKey().toUpperCase() }, false],
      ['worked a number', { v: 1, client_key: newClientKey(), worked: 5 }, false],
      ['followed out of the list', { v: 1, client_key: newClientKey(), followed: 'talvez' }, false],
      ['carry_forward 201 characters', { v: 1, client_key: newClientKey(), carry_forward: 'c'.repeat(201) }, false],
      ['a dry run without a key', { v: 1, worked: 'ok' }, true],
    ];
    for (const [label, payload, dryRun] of cases) {
      const r = log.length;
      await db.rpc('save_day_review', { p_account: acc.top, p_day: '2026-10-22', p_review: payload, p_dry_run: dryRun });
      const answer = log[r].answer as { data: unknown; error: { message: string; hint: string | null } | null };
      const server = answer.error ? { code: answer.error.message, field: answer.error.hint } : null;
      expect([label, server]).toEqual([label, checkReviewPayload(payload, dryRun)]);
    }
    for (const [label, payload] of [
      ['text 501 characters', { v: 1, client_key: newClientKey(), text: 'n'.repeat(501) }],
      ['an unknown key', { v: 1, client_key: newClientKey(), texto: 'x' }],
    ] as const) {
      const r = log.length;
      await db.rpc('save_day_note', { p_account: acc.top, p_day: '2026-10-22', p_note: payload, p_dry_run: false });
      const answer = log[r].answer as { data: unknown; error: { message: string; hint: string | null } | null };
      expect([label, answer.error ? { code: answer.error.message, field: answer.error.hint } : null]).toEqual([label, checkNotePayload(payload, false)]);
    }
    // Then the day: before «desde», after today, «Antes de operar» on another day
    await expect(saveDayReview(db, acc.top, '2026-10-13', reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, newClientKey()))).rejects.toMatchObject({ code: 'before_rules', field: 'day' });
    // 22 Oct 18:05 ET: the futures day already turned (today is the 23rd)
    await expect(saveDayReview(db, acc.top, '2026-10-24', reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, newClientKey()))).rejects.toMatchObject({ code: 'day_in_future', field: 'day' });
    await expect(saveDayNote(db, acc.top, '2026-10-21', notePayload('x', newClientKey()))).rejects.toMatchObject({ code: 'not_today', field: 'day' });
    // The client refuses before sending what the server would refuse
    const before = log.length;
    await expect(saveDayReview(db, acc.top, '2026-10-22', { v: 1, client_key: newClientKey(), worked: 'w'.repeat(1001), differently: null, followed: null, carry_forward: null })).rejects.toMatchObject({ code: 'bad_text', field: 'worked' });
    expect(log.length).toBe(before);
  });

  it('Fri 23 Oct: «Antes de operar» at 09:40, the 10:04 entry (left open), the note edited at 10:42', async () => {
    setClock('2026-10-23T13:40:05Z');
    const n1 = await saveDayNote(db, acc.top, '2026-10-23', notePayload('  Só compro acima da VWAP; parcial no +8. ', newClientKey()));
    write('nota-1023', lastAnswer());
    expect([n1.repeated, n1.note!.text, n1.note!.versions]).toEqual([false, 'Só compro acima da VWAP; parcial no +8.', 1]);
    setClock('2026-10-23T14:04:05Z');
    const e = await registerEntry(db, acc.top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7930.00', stop: '10', clock: NY }));
    trades.aberta = e.state.trade.id;
    setClock('2026-10-23T14:42:05Z');
    const n2 = await saveDayNote(db, acc.top, '2026-10-23', notePayload('Só compro acima da VWAP; parcial no +8. Nada depois das 10:45.', newClientKey()));
    write('nota-1023-editada', lastAnswer());
    expect([n2.repeated, n2.note!.versions, n2.note!.firstSavedAt]).toEqual([false, 2, n1.note!.savedAt]);
    expect(noteTimes(n2.note!, e.state.trade.entryTime)).toEqual({
      saved: { at: n1.note!.savedAt, beforeFirstEntry: true },
      edited: { at: n2.note!.savedAt, beforeFirstEntry: false },
    });
    expect(notaAntesDeOperar(n2.note!, e.state.trade.entryTime, NY)).toBe('anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada');
  });

  it('Sun 25 Oct 23:00 Brasília: the Ebinex weekend', async () => {
    setClock('2026-10-26T02:00:05Z');
    await importar(
      acc.ebx,
      ebinexCsv([
        ['c0ffee000000000000000011', '24/10/2026 10:15:10', 'bull', '10:16', '64,210.55', '64,233.10', 'win', '+$8.80'],
        ['c0ffee000000000000000012', '24/10/2026 10:31:40', 'bear', '10:32', '64,190.00', '64,230.00', 'lose', '-$10.00'],
        ['c0ffee000000000000000013', '25/10/2026 11:05:20', 'bull', '11:06', '64,300.10', '64,310.00', 'win', '+$9.00'],
        ['c0ffee000000000000000014', '25/10/2026 13:30:05', 'bull', '13:31', '64,320.00', '64,300.00', 'lose', '-$10.00'],
      ]),
      'operacoes_fim_de_semana.csv',
      SP,
      'ebinex',
    );
  });

  it('Mon 26 Oct 09:00 ET: Top One\'s calendar, October and the days, as the boards draw them', async () => {
    setClock('2026-10-26T13:00:05Z');
    const c = await fetchCalendario(db, acc.top);
    write('calendario-top', lastAnswer());
    checkCalendar(c);
    expect([c.today, c.desdeDay, c.firstDay, c.lastDay, c.from, c.to]).toEqual(['2026-10-26', '2026-10-14', '2026-10-12', '2026-10-23', '2026-10-12', '2026-10-26']);
    expect(c.days.map((d) => [d.day, d.kind, d.n, d.app, d.open, d.net])).toEqual([
      ['2026-10-12', 'historico', 0, 0, 0, '0'],
      ['2026-10-13', 'historico', 0, 0, 0, '0'],
      ['2026-10-14', 'misto', 3, 0, 0, '21.28'],
      ['2026-10-15', 'diario', 1, 1, 0, '60'],
      ['2026-10-21', 'diario', 4, 0, 0, '-465.4'],
      ['2026-10-22', 'diario', 1, 1, 0, '175'],
      ['2026-10-23', 'diario', 1, 1, 1, '0'],
    ]);
    expect(c.days[0].history).toEqual({ n: 1, wins: 1, losses: 0, even: 0, net: '18.76', gross: '20' });
    expect(c.days.find((d) => d.day === '2026-10-22')!.review).toMatchObject({ versions: 2 });
    // Due a review: the «Já fechada» day and Friday's live entry; never a day only from a file
    expect(pendingReviews(c.days, c.today)).toEqual({ days: ['2026-10-15', '2026-10-23'], recent: ['2026-10-15', '2026-10-23'] });
    expect(avisoDeRevisoes(c.days, c.today)?.texto).toBe('2 pregões sem revisão');
    expect(linhaDoTopo(c.desdeDay, c.days, c.today)).toBe('Diário desde 14 out: 10 operações em 5 pregões · 3 antes, em Histórico importado · só resultado');
    expect(calendarMonths(c.firstDay, c.today)).toEqual(['2026-10']);
    expect(c.weeks.map((w) => [w.weekOf, w.closed, w.n, w.net, w.history?.n ?? 0])).toEqual([
      ['2026-10-12', true, 4, '81.28', 3],
      ['2026-10-19', true, 6, '-290.4', 0],
    ]);

    const m = await fetchMes(db, acc.top, '2026-10');
    write('mes-top-2026-10', lastAnswer());
    expect([m.month, m.from, m.to]).toEqual(['2026-10', monthRange('2026-10').from, monthRange('2026-10').to]);
    expect(m.days.map((d) => [d.day, d.fora.n, d.fora.open, d.fora.net, d.recalculated, d.limit?.hitAt?.toISOString() ?? null])).toEqual([
      ['2026-10-14', 1, 0, '8.76', 3, null],
      ['2026-10-15', 0, 0, '0', 0, null],
      ['2026-10-21', 1, 0, '-38.74', 4, '2026-10-21T14:38:00.000Z'],
      ['2026-10-22', 0, 0, '0', 0, null],
      ['2026-10-23', 0, 0, '0', 0, null],
    ]);
    expect(m.weeks.map((w) => [w.weekOf, w.fora])).toEqual([
      ['2026-10-12', { n: 1, net: '8.76', open: 0 }],
      ['2026-10-19', { n: 1, net: '-38.74', open: 0 }],
    ]);
    expect(m.foraTrades.map((t) => [t.day, t.symbol, t.breaks, t.planKind, t.net, t.open])).toEqual([
      ['2026-10-14', 'MESZ6', ['fora_da_janela'], 'recalculado', '8.76', false],
      ['2026-10-21', 'MESZ6', ['depois_do_limite'], 'recalculado', '-38.74', false],
    ]);

    // The grid of October (5 columns), its colours and marks
    const grid = monthGrid({ month: '2026-10', today: c.today, market: 'futures', days: c.days, weeks: c.weeks, mes: m });
    const cell = (d: string) => grid.weeks.flatMap((w) => w.cells).find((x) => x.day === d)!;
    expect(grid.columns).toBe(5);
    expect([cell('2026-10-12').historyOnly, cell('2026-10-14').data?.kind, cell('2026-10-21').limitHitAt, cell('2026-10-22').reviewed, cell('2026-10-23').pendingReview]).toEqual([
      true,
      'misto',
      new Date('2026-10-21T14:38:00Z'),
      true,
      true,
    ]);
    expect(Object.keys(heatLevels(c.days)).sort()).toEqual(c.days.map((d) => d.day));
    expect(weekCard({ day: '2026-10-22', today: c.today, market: 'futures', days: c.days, weeks: c.weeks, mesWeeks: m.weeks })).toMatchObject({
      weekOf: '2026-10-19',
      inProgress: false,
      withTrades: 3,
      diario: { n: 6, net: '-290.4' },
      fora: { n: 1, net: '-38.74', open: 0 },
      reviews: { counted: 2, reviewed: 1 },
    });
    // Each month day = the day's own facts
    for (const md of m.days) {
      const f = (await fetchDia(db, acc.top, md.day)).facts;
      const limit = f.limit ? (({ after: _after, afterNet: _afterNet, ...rest }) => rest)(f.limit) : null;
      expect([md.day, md.fora, md.recalculated, md.limit]).toEqual([md.day, f.fora, f.recalculated, limit]);
    }
  });

  it('14 Oct, the misto day: the 08:50 file trade in the history, the 11:20 outside the window', async () => {
    const d = await dia(acc.top, '2026-10-14', 'dia-top-1014');
    expect([d.kind, d.facts.trades, d.facts.history, d.facts.recalculated, d.facts.window]).toEqual([
      'misto',
      3,
      { n: 1, net: '18.76', gross: '20' },
      3,
      { rule: true, evaluated: 3, inside: 2, outside: [{ tradeId: d.trades[3].trade.id, at: new Date('2026-10-14T15:20:00Z') }] },
    ]);
    expect(Math.abs(d.desde!.getTime() - Date.parse('2026-10-14T13:12:05Z'))).toBeLessThan(5000);
    expect(notaDoDia(d.kind, TOP, d.desde, d.trades.filter((t) => t.history).map((t) => t.trade.entryTime))).toBe(
      'Suas regras começaram às 09:12: a operação das 08:50 fica em Histórico importado · só resultado, à parte do dia.',
    );
    expect(d.trades.map((t) => [t.history, t.planKind, (t.planNow ?? t.plan)?.verdict ?? null, t.import?.fileName ?? null])).toEqual([
      [true, null, null, 'top_1014.csv'],
      [false, 'recalculado', 'no_plano', 'top_1014.csv'],
      [false, 'recalculado', 'no_plano', 'top_1014.csv'],
      [false, 'recalculado', 'fora_do_plano', 'top_1014.csv'],
    ]);
    expect(d.bounds).toEqual(tradingDayBounds('2026-10-14', d.account.day));
    expect(d.carryIn).toBeNull();
  });

  it('15 Oct, «Já fechada»: the frozen plan, a day due a review', async () => {
    const d = await dia(acc.top, '2026-10-15', 'dia-top-1015');
    expect(d.trades.map((t) => [t.trade.id, t.planKind, t.context?.origin, t.money])).toEqual([
      [trades.jaFechada, 'congelado', 'reconstructed', { realized: true, net: '60', gross: '60', commission: null }],
    ]);
    expect([d.review, d.note, d.carryIn]).toEqual([null, null, null]);
    const tiles = dayTiles(d.facts, 'futures');
    expect(tiles.money).toEqual({ gross: '60', commission: null, pending: true });
  });

  it('21 Oct, the limit day: «atingido às 10:38, com US$ 426,66 de perda · 1 depois, às 10:52: −US$ 38,74»', async () => {
    const d = await dia(acc.top, '2026-10-21', 'dia-top-1021');
    expect(d.facts.limit).toEqual({
      amount: '400',
      scope: 'conta',
      atLimit: 'encerrar',
      worst: '-465.4',
      hitAt: new Date('2026-10-21T14:38:00Z'),
      worstAtHit: '-426.66',
      net: '-465.4',
      trades: 4,
      after: [{ tradeId: d.trades[3].trade.id, at: new Date('2026-10-21T14:52:00Z') }],
      afterNet: '-38.74',
    });
    expect([d.facts.net, d.facts.gross, d.facts.commission, d.facts.fora, d.facts.othersNet]).toEqual(['-465.4', '-461.25', '4.15', { n: 1, net: '-38.74', open: 0 }, '-426.66']);
    expect(linhasDoPlano(d.plan.rules!, d.facts, TOP).map((l) => [l.item, l.fato.replace(/ /g, ' '), l.marca])).toEqual([
      ['Janela', '4 de 4 dentro', 'No plano'],
      ['Limite', 'atingido às 10:38, com US$ 426,66 de perda · 1 depois, às 10:52: −US$ 38,74', 'Fora do plano'],
      ['Breakeven', 'moveu em 0 de 4', 'Registrado'],
    ]);
    expect(fatosTexto(d.facts, TOP).replace(/ /g, ' ')).toBe(
      '4 operações · −US$ 465,40 · limite atingido às 10:38 · 1 depois do limite, às 10:52 · limite: US$ 465,40 de US$ 400 no pior momento',
    );
    expect(numerosDoDia(dayTiles(d.facts, 'futures'), TOP)).toMatchObject({ barra: 100 });
    // Recalculated: gate_at at each entry; the 10:52 one already «Encerrado por hoje»
    expect(d.trades.map((t) => [t.planKind, t.gateNow?.status])).toEqual([
      ['recalculado', 'liberado'],
      ['recalculado', 'liberado'],
      ['recalculado', 'liberado'],
      ['recalculado', 'encerrado'],
    ]);
  });

  it('22 Oct: the partial, the breakeven move and the review in two versions', async () => {
    const d = await dia(acc.top, '2026-10-22', 'dia-top-1022');
    const t = d.trades[0];
    expect([t.trade.id, t.planKind, t.exits.filter((e) => e.counts).length, t.stopMoves.map((s) => s.kind), t.money]).toEqual([
      trades.live,
      'congelado',
      2,
      ['breakeven'],
      { realized: true, net: '175', gross: '175', commission: null },
    ]);
    expect(d.facts.breakeven).toEqual({ by: { MES: { n: '8', un: 'pts' } }, trades: 1, moved: 1 });
    expect([t.images.map((i) => [i.name, i.mime, i.path.startsWith(`${uid}/${trades.live}/`)]), t.trade.note]).toEqual([[['MES_entrada.webp', 'image/webp', true]], 'Entrei no reteste.']);
    expect(d.review).toMatchObject({ versions: 2, followed: 'em_parte', written: true });
    expect(d.review!.previous).toHaveLength(1);
    expect(d.review!.previous[0]).toMatchObject({ followed: 'sim', differently: null, written: true });
    expect(dayChanged(d.review!.autoSummary, d.facts)).toBe(false);
    expect(d.carryIn).toBeNull();
  });

  it('23 Oct: «Do pregão anterior» from the 22nd, «Antes de operar» edited, the entry still open', async () => {
    const d = await dia(acc.top, '2026-10-23', 'dia-top-1023');
    const cal = await fetchCalendario(db, acc.top);
    const current = cal.days.filter((x) => x.review).map((x) => x.day);
    expect(current).toEqual(['2026-10-22']);
    expect(d.carryIn).toMatchObject({ day: '2026-10-22', text: 'Esperar o reteste antes de comprar.' });
    expect(carryInOf([{ day: '2026-10-22', carryForward: 'Esperar o reteste antes de comprar.' }], d.day, d.desdeDay, d.kind)).toEqual({
      day: d.carryIn!.day,
      text: d.carryIn!.text,
    });
    expect(doPregaoAnterior(d.carryIn)).toBe('“Esperar o reteste antes de comprar.” · 22 out');
    expect(d.note).toMatchObject({ versions: 2, written: true, text: 'Só compro acima da VWAP; parcial no +8. Nada depois das 10:45.' });
    expect(d.facts).toMatchObject({ trades: 1, open: 1, closed: 0, net: '0' });
    expect(isPendingReview(cal.days.find((x) => x.day === '2026-10-23')!, cal.today)).toBe(true);
  });

  it('26 Oct, today before trading: the plan now, the open trade of Friday elsewhere', async () => {
    const d = await dia(acc.top, '2026-10-26', 'dia-top-1026');
    expect([d.kind, d.today, d.facts.trades, d.plan.version?.versionNo, d.plan.changes, d.plan.windowsToday]).toEqual([
      'vazio',
      '2026-10-26',
      0,
      1,
      [],
      [{ opensAt: new Date('2026-10-26T14:00:00Z'), closesAt: new Date('2026-10-26T15:00:00Z'), tz: NY }],
    ]);
    expect(d.openElsewhere.map((t) => [t.tradeId, t.tradingDay, t.app])).toEqual([[trades.aberta, '2026-10-23', true]]);
    expect(d.carryIn).toMatchObject({ day: '2026-10-22' });
    // A future day: refused for a review, read as vazio
    expect((await fetchDia(db, acc.top, '2026-10-27')).kind).toBe('vazio');
  });

  it('Ebinex: the weekend in its own Mon–Sun week, the 13:30 outside the window', async () => {
    const c = await fetchCalendario(db, acc.ebx);
    write('calendario-ebx', lastAnswer());
    checkCalendar(c);
    expect(c.days.map((d) => [d.day, d.weekday, d.kind, d.n, d.net])).toEqual([
      ['2026-10-09', 5, 'historico', 0, '0'],
      ['2026-10-24', 6, 'diario', 2, '-1.2'],
      ['2026-10-25', 7, 'diario', 2, '-1'],
    ]);
    expect(c.weeks.map((w) => [w.weekOf, w.closed, w.n])).toEqual([
      ['2026-10-05', true, 0],
      ['2026-10-19', true, 4],
    ]);
    expect(monthGrid({ month: '2026-10', today: c.today, market: 'binary', days: c.days, weeks: c.weeks }).columns).toBe(7);
    const m = await fetchMes(db, acc.ebx, '2026-10');
    write('mes-ebx-2026-10', lastAnswer());
    expect(m.days.map((x) => [x.day, x.fora.n, x.limit?.amount])).toEqual([
      ['2026-10-24', 0, '100'],
      ['2026-10-25', 1, '100'],
    ]);
    const d = await dia(acc.ebx, '2026-10-24', 'dia-ebx-1024');
    expect([d.weekday, d.facts.trades, d.facts.wins, d.facts.losses, d.facts.window?.inside, d.plan.windowsToday]).toEqual([
      6,
      2,
      1,
      1,
      2,
      [{ opensAt: new Date('2026-10-24T12:00:00Z'), closesAt: new Date('2026-10-24T15:00:00Z'), tz: SP }],
    ]);
    expect(d.bounds).toEqual(tradingDayBounds('2026-10-24', d.account.day));
    expect(d.trades.every((t) => t.import?.platform === 'ebinex' && t.clockGuessed === false)).toBe(true);
  });

  it('the range: past 1 500 days is bad_range; another user\'s account is unknown_account', async () => {
    await expect(fetchCalendario(db, acc.top, { from: '2022-01-01', to: '2026-10-26' })).rejects.toMatchObject({ code: 'bad_range' });
    const narrow = await fetchCalendario(db, acc.top, { from: '2026-10-19', to: '2026-10-25' });
    expect([narrow.from, narrow.to, narrow.days.map((d) => d.day), narrow.firstDay]).toEqual(['2026-10-19', '2026-10-25', ['2026-10-21', '2026-10-22', '2026-10-23'], '2026-10-12']);
    expect(CALENDAR_MAX_DAYS).toBe(1500);
    const other = pgClient(randomUUID());
    await expect(fetchDia(other, acc.top, '2026-10-22')).rejects.toBeInstanceOf(DiarioDataError);
    await expect(fetchDia(other, acc.top, '2026-10-22')).rejects.toMatchObject({ code: 'unknown_account' });
  });

  it('records the ids', () => {
    write('ids', { user: uid, accounts: acc, trades });
    expect(recorded).toEqual(
      expect.arrayContaining(['calendario-top', 'calendario-ebx', 'mes-top-2026-10', 'mes-ebx-2026-10', 'dia-top-1021', 'dia-top-1022', 'dia-top-1023', 'revisao-1022', 'nota-1023', 'ids']),
    );
  });
});

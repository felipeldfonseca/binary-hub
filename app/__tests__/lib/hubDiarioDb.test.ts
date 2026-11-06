/**
 * @jest-environment node
 *
 * lib/hub/diarioDb without a database: every recorded answer of the real SQL (testing/fixtures/diario,
 * recorded by hubDiario.pg.test.ts) parses into the domain's types, and what the boards draw comes
 * out of them; another shape is 'bad_answer', never a guess; the database's refusals become codes
 * (and fields), never its text; the calendar pages a long history in whole weeks; the payloads are
 * checked before they are sent; the images are signed in batches with per-path errors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { monthGrid, pendingReviews, reviewPayload, weekCard } from '@/lib/domain/diario';
import { addDays } from '@/lib/domain/tempo';
import { avisoDeRevisoes, doPregaoAnterior, linhaDaRevisao, linhasDoPlano, notaAntesDeOperar, type ContaDiario } from '@/lib/hub/diario';
import {
  CALENDAR_MAX_DAYS,
  DIARIO_ERROR_CODES,
  DIARIO_RPC_ERROR_CODES,
  DiarioDataError,
  calendarPages,
  fetchCalendario,
  fetchDia,
  fetchMes,
  parseCalendar,
  parseDay,
  parseMonth,
  parseNoteSaved,
  parseReviewSaved,
  saveDayNote,
  saveDayReview,
  signedImageUrls,
  toDiarioError,
} from '@/lib/hub/diarioDb';
import { IMAGE_BUCKET, SIGNED_URL_SECONDS } from '@/lib/hub/registrarDb';
import { DIARIO_FIXTURES, diarioJson, idsDiario } from '@/testing/diarioDb';

const NY = 'America/New_York';
const TOP: ContaDiario = { currency: 'USD', market: 'futures', tz: NY };
type Obj = Record<string, unknown>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A client whose rpc answers from `answer(name, args)` and records every call */
function fakeDb(answer: (name: string, args: Obj) => { data?: unknown; error?: unknown }) {
  const calls: [string, Obj][] = [];
  const db = {
    rpc: (name: string, args: Obj) => {
      calls.push([name, args]);
      const r = answer(name, args);
      const call = { abortSignal: () => call, then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(res, rej) };
      return call;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected a refusal');
};

describe('the recorded answers', () => {
  it('holds every answer the suite recorded', () => {
    expect(DIARIO_FIXTURES).toEqual(
      expect.arrayContaining([
        'calendario-top',
        'calendario-ebx',
        'calendario-b3',
        'mes-top-2026-10',
        'mes-ebx-2026-10',
        'dia-top-1014',
        'dia-top-1015',
        'dia-top-1021',
        'dia-top-1022',
        'dia-top-1023',
        'dia-top-1026',
        'dia-top-1027-aberta',
        'dia-top-1027',
        'dia-top-1028',
        'dia-ebx-1024',
        'dia-ebx-1028',
        'dia-b3-1028',
        'revisao-1022',
        'nota-1023',
        'ids',
      ]),
    );
  });

  it.each(DIARIO_FIXTURES.filter((n) => n.startsWith('dia-')))('%s parses (every trade, the facts, the review, the note)', (name) => {
    const d = parseDay(diarioJson(name));
    expect(d.trades.length).toBe(d.facts.trades + d.facts.history.n);
    expect(d.day).toBe(d.facts.day);
  });

  it('the calendar: Top One\'s days, weeks and the reviews due', () => {
    const c = parseCalendar(diarioJson('calendario-top'));
    expect([c.account.label, c.account.market, c.account.currency, c.account.day, c.today, c.desdeDay]).toEqual(['Top One #1', 'futures', 'USD', { tz: NY, startMin: 1080 }, '2026-10-26', '2026-10-14']);
    expect(c.days.map((d) => [d.day, d.kind, d.n, d.net])).toEqual([
      ['2026-10-12', 'historico', 0, '0'],
      ['2026-10-13', 'historico', 0, '0'],
      ['2026-10-14', 'misto', 3, '21.28'],
      ['2026-10-15', 'diario', 1, '60'],
      ['2026-10-21', 'diario', 4, '-465.4'],
      ['2026-10-22', 'diario', 1, '175'],
      ['2026-10-23', 'diario', 1, '0'],
    ]);
    expect(pendingReviews(c.days, c.today).days).toEqual(['2026-10-15', '2026-10-23']);
    expect(avisoDeRevisoes(c.days, c.today)).toEqual({ texto: '2 pregões sem revisão', mes: '2026-10' });
    const m = parseMonth(diarioJson('mes-top-2026-10'));
    const card = weekCard({ day: '2026-10-21', today: c.today, market: 'futures', days: c.days, weeks: c.weeks, mesWeeks: m.weeks });
    expect(card).toMatchObject({ weekOf: '2026-10-19', inProgress: false, diario: { n: 6, net: '-290.4' }, fora: { n: 1, net: '-38.74', open: 0 } });
    const grid = monthGrid({ month: '2026-10', today: c.today, market: 'futures', days: c.days, weeks: c.weeks, mes: m });
    const cell = grid.weeks.flatMap((w) => w.cells).find((x) => x.day === '2026-10-21')!;
    expect([cell.fora, cell.limitHitAt]).toEqual([{ n: 1, net: '-38.74', open: 0 }, new Date('2026-10-21T14:38:00Z')]);
  });

  it('the month: ● and ■, the fora list with each trade\'s plan kind', () => {
    const m = parseMonth(diarioJson('mes-top-2026-10'));
    expect([m.month, m.from, m.to, m.days.length]).toEqual(['2026-10', '2026-09-28', '2026-11-01', 5]);
    expect(m.days.find((d) => d.day === '2026-10-21')!.limit).toEqual({
      amount: '400',
      scope: 'conta',
      atLimit: 'encerrar',
      worst: '-465.4',
      hitAt: new Date('2026-10-21T14:38:00Z'),
      worstAtHit: '-426.66',
      net: '-465.4',
      trades: 4,
    });
    expect(m.foraTrades.map((t) => [t.day, t.breaks, t.planKind, t.status, t.open, t.realized, t.net, t.quantity])).toEqual([
      ['2026-10-14', ['fora_da_janela'], 'recalculado', 'closed', false, true, '8.76', '1'],
      ['2026-10-21', ['depois_do_limite'], 'recalculado', 'closed', false, true, '-38.74', '1'],
    ]);
  });

  it('27 Oct before the file: the undo and the deletion by their path, an old-page trade, an open MES with a partial', () => {
    const d = parseDay(diarioJson('dia-top-1027-aberta'));
    expect(d.deleted.map((x) => x.via)).toEqual(['desfazer_entrada', 'apagada']);
    expect(d.trades.map((t) => [t.trade.status, t.planKind, t.context === null, t.import === null, t.money.realized])).toEqual([
      ['open', 'congelado', false, true, true],
      ['closed', 'congelado', false, true, true],
      ['closed', 'recalculado', true, true, true],
      ['closed', 'congelado', false, true, true],
    ]);
    expect([d.facts.commissionUnknown, d.facts.breakeven, d.facts.fora, d.facts.othersNet]).toEqual([
      4,
      { by: { MES: { n: '8', un: 'pts' } }, trades: 4, reached: 1, moved: 1 },
      { n: 1, net: '-25', open: 0 },
      '25',
    ]);
  });

  it('27 Oct after the file: a link that closed the trade, a link that corrected the exit price', () => {
    const d = parseDay(diarioJson('dia-top-1027'));
    const links = d.trades.map((t) => t.links.map((l) => [l.platform, l.fileName, l.closed, l.differs.includes('exit_price'), l.fileEntryAt !== null]));
    expect(links).toEqual([
      [['topone', 'top_1027.csv', true, false, true]],
      [['topone', 'top_1027.csv', false, true, true]],
      [],
      [['topone', 'top_1027.csv', false, false, true]],
    ]);
    expect(d.trades[1].links[0].before).toHaveProperty('exit_price');
    expect(d.trades[1].links[0].after).toHaveProperty('exit_price');
    expect(d.trades.map((t) => t.importedAt !== null)).toEqual([true, true, false, true]);
  });

  it('28 Oct: the facts put the 10:30 after the limit a later «Já fechada» reached; the binary still open; B3 in reais', () => {
    const d = parseDay(diarioJson('dia-top-1028'));
    expect(linhasDoPlano(d.plan.rules!, d.facts, TOP)[1].fato.replace(/\u00a0/g, ' ')).toBe('atingido às 10:20, com US$ 450,00 de perda · 1 depois, às 10:30: +US$ 5,00');
    expect(d.trades.map((t) => (t.planNow ?? t.plan)?.verdict)).toEqual(['no_plano', 'no_plano']);
    const e = parseDay(diarioJson('dia-ebx-1028'));
    expect([e.trades[0].trade.status, e.trades[0].trade.expiresAt instanceof Date, e.facts.open, e.account.market]).toEqual(['open', true, 1, 'binary']);
    const c = parseCalendar(diarioJson('calendario-b3'));
    expect([c.account.currency, c.account.market, c.days.map((x) => [x.net, x.commission])]).toEqual(['BRL', 'b3', [['18.5', '1.5']]]);
    expect(parseDay(diarioJson('dia-b3-1028')).facts.limit?.amount).toBe('500');
  });

  it('the limit day, as the board writes it', () => {
    const d = parseDay(diarioJson('dia-top-1021'));
    expect(linhasDoPlano(d.plan.rules!, d.facts, TOP)[1].fato.replace(/ /g, ' ')).toBe('atingido às 10:38, com US$ 426,66 de perda · 1 depois, às 10:52: −US$ 38,74');
    expect(d.trades.map((t) => [t.planKind, t.planNow?.verdict, t.gateNow?.status, t.import?.fileName])).toEqual([
      ['recalculado', 'no_plano', 'liberado', 'top_1021.csv'],
      ['recalculado', 'no_plano', 'liberado', 'top_1021.csv'],
      ['recalculado', 'no_plano', 'liberado', 'top_1021.csv'],
      ['recalculado', 'fora_do_plano', 'encerrado', 'top_1021.csv'],
    ]);
  });

  it('22 Oct: the live trade (trade_state), its image and note, the review and its older version', () => {
    const ids = idsDiario();
    const d = parseDay(diarioJson('dia-top-1022'));
    const t = d.trades[0];
    expect([t.trade.id, t.planKind, t.context?.origin, t.position.partials, t.stopMoves.length, t.images.length, t.trade.note]).toEqual([ids.trades.live, 'congelado', 'live', 1, 1, 1, 'Entrei no reteste.']);
    expect(d.review!.previous.map((v) => v.followed)).toEqual(['sim']);
    expect(linhaDaRevisao(d.review!, d.day, NY)).toBe('Salva às 11:40 · editada às 18:05 · Seguiu o plano? Em parte · pela sua resposta, depois do resultado');
  });

  it('23 Oct: «Antes de operar» and «Do pregão anterior»', () => {
    const d = parseDay(diarioJson('dia-top-1023'));
    expect(notaAntesDeOperar(d.note!, d.facts.firstEntryAt, NY)).toBe('anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada');
    expect(doPregaoAnterior(d.carryIn)).toBe('“Esperar o reteste antes de comprar.” · 22 out');
  });

  it('the writes\' answers', () => {
    const saved = parseReviewSaved(diarioJson('revisao-1022'));
    expect([saved.dryRun, saved.repeated, saved.review!.versions, saved.review!.previous]).toEqual([false, false, 1, []]);
    expect(saved.review!.autoSummary).toEqual(saved.factsNow);
    expect(parseReviewSaved(diarioJson('revisao-1022-previa'))).toMatchObject({ dryRun: true, repeated: false, review: null });
    expect(parseReviewSaved(diarioJson('revisao-1022-repetida'))).toMatchObject({ repeated: true });
    expect(parseNoteSaved(diarioJson('nota-1023-editada')).note).toMatchObject({ versions: 2, written: true });
  });
});

describe('another shape is bad_answer', () => {
  const day = () => clone(diarioJson('dia-top-1021')) as Obj;
  it.each([
    ['v 2', (j: Obj) => void (j.v = 2)],
    ['a day as an instant', (j: Obj) => void (j.day = '2026-10-21T00:00:00Z')],
    ['a kind it does not know', (j: Obj) => void (j.kind = 'outro')],
    ['facts without fora.open', (j: Obj) => void delete ((j.facts as Obj).fora as Obj).open],
    ['money as text that is not a number', (j: Obj) => void ((j.facts as Obj).net = 'muito')],
    ['a trade without its trade_state', (j: Obj) => void delete ((j.trades as Obj[])[0] as Obj).trade],
    ['a plan kind it does not know', (j: Obj) => void (((j.trades as Obj[])[0] as Obj).plan_kind = 'outro')],
    ['the plan\'s rules in another shape', (j: Obj) => void (((j.plan as Obj).rules as Obj).limit = 'x')],
  ])('%s', async (_label, change) => {
    const json = day();
    change(json);
    expect(() => parseDay(json)).toThrow();
    const { db } = fakeDb(() => ({ data: json }));
    expect(await refusal(fetchDia(db, 'a', '2026-10-21'))).toMatchObject({ code: 'bad_answer', field: null });
  });

  it('a calendar or a month without its head', async () => {
    const c = clone(diarioJson('calendario-top')) as Obj;
    delete c.today;
    expect(await refusal(fetchCalendario(fakeDb(() => ({ data: c })).db, 'a'))).toMatchObject({ code: 'bad_answer' });
    const m = clone(diarioJson('mes-top-2026-10')) as Obj;
    expect(await refusal(fetchMes(fakeDb(() => ({ data: m })).db, 'a', '2026-11'))).toMatchObject({ code: 'bad_answer' });
    expect(await refusal(fetchMes(fakeDb(() => ({ data: null })).db, 'a', '2026-10'))).toMatchObject({ code: 'bad_answer' });
  });
});

describe('errors: codes and fields, never the database\'s text', () => {
  it('lists the Phase 4 codes', () => {
    expect(DIARIO_RPC_ERROR_CODES).toEqual(expect.arrayContaining(['day_in_future', 'too_many_versions', 'bad_text', 'bad_followed', 'bad_range', 'not_today']));
    expect(DIARIO_ERROR_CODES).toEqual(expect.arrayContaining(['network', 'bad_answer', 'unknown']));
  });

  it.each([
    [{ code: 'P0001', message: 'bad_text', hint: 'worked', details: 'Esperei' }, 'bad_text', 'worked'],
    [{ code: 'P0001', message: 'day_in_future', hint: 'day' }, 'day_in_future', 'day'],
    [{ code: 'P0001', message: 'bad_day', hint: 'month' }, 'bad_day', 'month'],
    [{ code: 'P0001', message: 'too_many_versions', hint: null }, 'too_many_versions', null],
    [{ code: 'P0001', message: 'unknown_account', hint: 'x' }, 'unknown_account', null],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'not_authenticated', null],
    [{ message: 'TypeError: Failed to fetch' }, 'network', null],
    [{ code: '42883', message: 'function public.diario_dia(uuid, date) does not exist' }, 'unknown', null],
  ])('%j → %s', async (error, code, field) => {
    const e = toDiarioError(error);
    expect([e.code, e.field, e.message]).toEqual([code, field, code]);
    expect(JSON.stringify(e)).not.toContain('Esperei');
    const { db } = fakeDb(() => ({ error }));
    expect(await refusal(fetchDia(db, 'a', '2026-10-21'))).toMatchObject({ code, field });
  });
});

describe('the calls', () => {
  it('send the named arguments', async () => {
    const { db, calls } = fakeDb((name) => ({ data: diarioJson(name === 'diario_mes' ? 'mes-top-2026-10' : name === 'diario_dia' ? 'dia-top-1021' : 'calendario-top') }));
    await fetchCalendario(db, 'acc-1');
    await fetchCalendario(db, 'acc-1', { from: '2026-10-19', to: '2026-10-25' });
    await fetchMes(db, 'acc-1', '2026-10');
    await fetchDia(db, 'acc-1', '2026-10-21');
    expect(calls).toEqual([
      ['diario_calendario', { p_account: 'acc-1', p_from: null, p_to: null }],
      ['diario_calendario', { p_account: 'acc-1', p_from: '2026-10-19', p_to: '2026-10-25' }],
      ['diario_mes', { p_account: 'acc-1', p_month: '2026-10-01' }],
      ['diario_dia', { p_account: 'acc-1', p_day: '2026-10-21' }],
    ]);
    // A day or a month the database would refuse is not sent
    expect(await refusal(fetchDia(db, 'acc-1', '21/10/2026'))).toMatchObject({ code: 'bad_day', field: 'day' });
    expect(await refusal(fetchMes(db, 'acc-1', '2026-10-01'))).toMatchObject({ code: 'bad_day', field: 'month' });
    expect(calls).toHaveLength(4);
  });

  it('«Salvar revisão» and «Antes de operar»: checked as the server checks them, before sending', async () => {
    const { db, calls } = fakeDb((name) => ({ data: diarioJson(name === 'save_day_note' ? 'nota-1023' : 'revisao-1022') }));
    const key = '0b3f1c2a-1111-4c2d-8e3f-000000000001';
    const payload = reviewPayload({ worked: ' Esperei. ', differently: '', followed: 'sim', carryForward: '' }, key);
    expect(payload).toEqual({ v: 1, client_key: key, worked: 'Esperei.', differently: null, followed: 'sim', carry_forward: null });
    await saveDayReview(db, 'acc-1', '2026-10-22', payload);
    await saveDayReview(db, 'acc-1', '2026-10-22', reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, null), { dryRun: true });
    await saveDayNote(db, 'acc-1', '2026-10-23', { v: 1, client_key: key, text: 'Só a favor da VWAP.' });
    expect(calls.map(([n, a]) => [n, a.p_day, a.p_dry_run])).toEqual([
      ['save_day_review', '2026-10-22', false],
      ['save_day_review', '2026-10-22', true],
      ['save_day_note', '2026-10-23', false],
    ]);
    expect(await refusal(saveDayReview(db, 'acc-1', '2026-10-22', reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, null)))).toMatchObject({ code: 'bad_client_key', field: 'client_key' });
    expect(await refusal(saveDayReview(db, 'acc-1', '2026-10-22', { ...payload, carry_forward: 'c'.repeat(201) }))).toMatchObject({ code: 'bad_text', field: 'carry_forward' });
    expect(await refusal(saveDayNote(db, 'acc-1', '2026-10-23', { v: 1, client_key: key, text: 'n'.repeat(501) }))).toMatchObject({ code: 'bad_text', field: 'text' });
    expect(calls).toHaveLength(3);
  });
});

describe('the calendar past 1 500 days: pages of whole weeks', () => {
  it('calendarPages: the newest ends today, the others on a Sunday; each starts on a Monday, the oldest on the first day', () => {
    const pages = calendarPages('2019-03-13', '2026-10-28');
    expect(pages.length).toBe(2);
    for (const p of pages) expect(addDays(p.from, CALENDAR_MAX_DAYS - 1) >= p.to).toBe(true);
    expect(pages[0].to).toBe('2026-10-28');
    expect(new Date(`${pages[0].from}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(pages[1]).toEqual({ from: '2019-03-13', to: addDays(pages[0].from, -1) });
    expect(new Date(`${pages[1].to}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(calendarPages('2026-01-05', '2026-10-28')).toEqual([{ from: '2026-01-05', to: '2026-10-28' }]);
  });

  it('calendarPages: when the oldest page\'s Monday is the first day itself, it is that one page, never a page that ends before it starts', () => {
    // 2022-10-03 is a Monday; 1 500 days later
    const first = '2022-10-03';
    const to = addDays(first, CALENDAR_MAX_DAYS - 1);
    expect(new Date(`${first}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(calendarPages(first, to)).toEqual([{ from: first, to }]);
    const pages = calendarPages(first, addDays(to, 7));
    expect(pages.every((p) => p.from <= p.to)).toBe(true);
    expect(pages[pages.length - 1].from).toBe(first);
  });

  it('fetchCalendario joins the pages: the days and weeks in order, the newest head', async () => {
    const base = diarioJson('calendario-top') as Obj;
    const answer = (from: string | null, to: string | null): Obj => {
      if (from === null) return { ...base, from: '2022-09-20', to: '2026-10-28', first_day: '2019-03-13', last_day: '2026-10-23', days: [], weeks: [] };
      const day = { ...(base.days as Obj[])[2], day: from, weekday: new Date(`${from}T00:00:00Z`).getUTCDay() || 7 };
      return { ...base, from, to, first_day: '2019-03-13', last_day: '2026-10-23', days: [day], weeks: [{ ...(base.weeks as Obj[])[0], week_of: from }] };
    };
    const { db, calls } = fakeDb((_n, a) => ({ data: answer(a.p_from as string | null, a.p_to as string | null) }));
    const c = await fetchCalendario(db, 'acc-1');
    const pages = calendarPages('2019-03-13', '2026-10-28');
    expect(calls.map(([, a]) => [a.p_from, a.p_to])).toEqual([[null, null], ...pages.map((p) => [p.from, p.to])]);
    expect([c.from, c.to, c.firstDay, c.days.map((d) => d.day), c.weeks.map((w) => w.weekOf)]).toEqual([
      '2019-03-13',
      '2026-10-28',
      '2019-03-13',
      pages.map((p) => p.from).reverse(),
      pages.map((p) => p.from).reverse(),
    ]);
  });
});

describe('signed image URLs', () => {
  const storage = (fn: (paths: string[], secs: number) => { data: unknown; error: unknown }) => {
    const calls: [string, string[], number][] = [];
    const db = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (paths: string[], secs: number) => {
            calls.push([bucket, paths, secs]);
            return fn(paths, secs);
          },
        }),
      },
    } as unknown as SupabaseClient;
    return { db, calls };
  };

  it('one batch per 100 paths, 10 minutes, a refused path null', async () => {
    const paths = Array.from({ length: 230 }, (_, i) => `u/t/${String(i).padStart(3, '0')}.webp`);
    const { db, calls } = storage((ps) => ({ data: ps.map((p) => (p.endsWith('007.webp') ? { path: p, error: 'Object not found', signedUrl: null } : { path: p, error: null, signedUrl: `https://x/${p}?token=t` })), error: null }));
    const urls = await signedImageUrls(db, [...paths, paths[0]]);
    expect(calls.map(([b, ps, s]) => [b, ps.length, s])).toEqual([
      [IMAGE_BUCKET, 100, SIGNED_URL_SECONDS],
      [IMAGE_BUCKET, 100, SIGNED_URL_SECONDS],
      [IMAGE_BUCKET, 30, SIGNED_URL_SECONDS],
    ]);
    expect(Object.keys(urls)).toHaveLength(230);
    expect([urls['u/t/007.webp'], urls['u/t/008.webp']]).toEqual([null, 'https://x/u/t/008.webp?token=t']);
  });

  it('a path the bucket refused is null even when the item carries a URL', async () => {
    const { db } = storage((ps) => ({ data: ps.map((p) => ({ path: p, error: p === 'b' ? 'Object not found' : null, signedUrl: `https://x/${p}` })), error: null }));
    expect(await signedImageUrls(db, ['a', 'b'])).toEqual({ a: 'https://x/a', b: null });
  });

  it('the trade\'s own paths from the day; a failed call is a code', async () => {
    const t = parseDay(diarioJson('dia-top-1022')).trades[0];
    const { db, calls } = storage((ps) => ({ data: ps.map((p) => ({ path: p, error: null, signedUrl: 's' })), error: null }));
    expect(await signedImageUrls(db, t.images.map((i) => i.path))).toEqual({ [t.images[0].path]: 's' });
    expect(calls[0][1]).toEqual([t.images[0].path]);
    const failing = storage(() => ({ data: null, error: { message: 'TypeError: Failed to fetch' } }));
    expect(await refusal(signedImageUrls(failing.db, ['a']))).toMatchObject({ code: 'network' });
    expect(await signedImageUrls(failing.db, [])).toEqual({});
    expect(new DiarioDataError('bad_answer')).toBeInstanceOf(Error);
  });
});

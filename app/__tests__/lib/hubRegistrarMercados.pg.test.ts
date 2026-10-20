/**
 * @jest-environment node
 *
 * The new markets of «Registrar operação» (Phase 3 · 3-4), against the real SQL: what the Forex,
 * Ações e opções, Cripto and B3 forms and the futures «Buscar ativo» read, recorded from the
 * functions of migrations 20261020000001..4 with the descriptors of 20261022000001, on a throwaway
 * local Postgres whose clock the suite moves between steps. Skipped unless both are set (never the
 * hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds)
 *                                                           from this file (an interposed clock)
 *   BH_PG_RECORD=<dir>                                      writes the fixtures there
 *
 * An invented user with five accounts, rules since Tue 13 Oct 2026 (the approved board, scenarios
 * 6–9 and the futures search; testing/registrarMercados.ts lists every fixture). Every amount the
 * server answers is checked against the domain (lib/domain/registro) here.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import { EVERY_DAY, MON_TO_FRI } from '@/lib/domain';
import { afterPayload, entryPayload, entryPreview, exitPayload, parseEntry, type EntryPayload } from '@/lib/domain/registro';
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras';
import { inicioDoDia } from '@/lib/hub/registrar';
import {
  RECENT_COLUMNS,
  TRADE_COLUMNS,
  RegistrarDataError,
  dayTradesOfRows,
  newClientKey,
  openTradesOfRows,
  previewAfter,
  previewEntry,
  previewExit,
  readDayTradesRows,
  readTradeViewRows,
  recentTradesOfRows,
  registerAfter,
  registerEntry,
  registerExit,
  tradeViewOfRows,
} from '@/lib/hub/registrarDb';
import { ACCOUNT_COLUMNS } from '@/lib/hub/contasDb';
import { PG_URL, asUser, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

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

/** The domain's preview of a payload (what the screen computes before the server answers) */
function domainRisk(market: string, p: EntryPayload): { risk: string | null; reward: string | null } {
  const r = parseEntry(market, p);
  if (!r.ok) throw new Error(r.code);
  const pv = entryPreview(r.entry);
  return pv.kind === 'prices' ? { risk: pv.risk, reward: pv.reward } : { risk: pv.risk, reward: null };
}

const OPTION_SPY = (expiresOn: string) => ({ right: 'call' as const, strike: '790', expires_on: expiresOn });

describePg('the new markets × the real SQL (fixtures for the 3-4 screens)', () => {
  const uid = randomUUID();
  const log: { name: string; args: Record<string, unknown>; answer: { data: unknown; error: unknown } }[] = [];
  const db = pgClient(uid, log);
  const acc: Record<'topOne' | 'ftmo' | 'ibkr' | 'binance' | 'clear', string> = { topOne: '', ftmo: '', ibkr: '', binance: '', clear: '' };
  const trades: Record<string, string> = {};
  const refusals: Record<string, { code: string; field: string | null }> = {};
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
  const gateOf = (now: RulesNow, accountId: string) => now.accounts.find((a) => a.accountId === accountId)!.gate;
  const rows = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await q;
    if (r.error) throw new Error(JSON.stringify(r.error));
    return r.data;
  };
  const refused = async (name: string, p: Promise<unknown>) => {
    refusals[name] = await refusal(p);
    return refusals[name];
  };
  const openRows = async (name: string, accountId: string) => {
    const open = await rows(db.from('trades').select(TRADE_COLUMNS).eq('status', 'open').eq('account_id', accountId).order('entry_time') as never);
    write(`abertas-${name}`, open);
    return openTradesOfRows(open);
  };
  const dayRows = async (name: string, accountId: string, day: string, market: 'futures' | 'forex' | 'stocks' | 'crypto' | 'b3') => {
    const dia = await readDayTradesRows(db, accountId, day, inicioDoDia(day, market));
    write(`dia-${name}`, dia);
    return dayTradesOfRows(dia);
  };

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 09:00 ET: five accounts and their rules (v1 «desde 13 out»; IBKR without a window or a limit)', async () => {
    setClock('2026-10-13T13:00:05Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'dono-${uid.slice(0, 8)}@example.test');`);
    acc.topOne = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #1', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
    acc.ftmo = await createAccountAsUser(uid, { market: 'forex', label: 'FTMO', platform: 'mt5', firm: 'FTMO', external_ref: null, phase: 'avaliacao', size: null, is_primary: false });
    acc.ibkr = await createAccountAsUser(uid, { market: 'stocks', label: 'IBKR', platform: 'ibkr', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    acc.binance = await createAccountAsUser(uid, { market: 'crypto', label: 'Binance', platform: 'binance', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    acc.clear = await createAccountAsUser(uid, { market: 'b3', label: 'Clear', platform: 'profit', firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: false });
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        accounts: {
          [acc.topOne]: { rules: { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI }, version: 'force' },
          [acc.ftmo]: { rules: { v: 1, limit: { usd: 1000, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: NY, start_min: 480, end_min: 600, weekdays: MON_TO_FRI }, version: 'force' },
          [acc.ibkr]: { rules: { v: 1 }, window: null, version: 'force' },
          [acc.binance]: { rules: { v: 1 }, window: { tz: SP, start_min: 1200, end_min: 1320, weekdays: EVERY_DAY }, version: 'force' },
          [acc.clear]: { rules: { v: 1, limit: { brl: 500, mode: 'conta', at_limit: 'encerrar' } }, window: { tz: SP, start_min: 600, end_min: 660, weekdays: MON_TO_FRI }, version: 'force' },
        },
      })})`,
    );
    psql(`insert into public.hub_members (user_id) values ('${uid}');`);
    write('contas', await rows(db.from('trading_accounts').select(ACCOUNT_COLUMNS).eq('is_example', false).order('sort_order').order('created_at') as never));
    const now = rulesNow().parsed;
    expect(now.accounts.map((a) => [a.label, a.desdeDay])).toEqual([
      ['Top One #1', '2026-10-13'],
      ['FTMO', '2026-10-13'],
      ['IBKR', '2026-10-13'],
      ['Binance', '2026-10-13'],
      ['Clear', '2026-10-13'],
    ]);
  });

  it('Thu 15 Oct 08:40 ET · Forex (FTMO): pips, an estimate, a typed pair, a price-stop symbol, the 300-pip warning', async () => {
    setClock('2026-10-15T12:40:05Z');
    const now = rulesNow();
    write('agora-ftmo-qui-0840', now.json);
    expect(gateOf(now.parsed, acc.ftmo)).toMatchObject({ status: 'liberado', tradingDay: '2026-10-15' });

    const eur = { symbol: 'EUR/USD', direction: 'long' as const, quantity: '0.5', entryPrice: '1.08520', stop: '12', target: '24', clock: NY };
    const dEur = await previewEntry(db, acc.ftmo, entryPayload('forex', eur));
    write('entry-dry-eurusd', lastAnswer());
    expect(dEur.preview).toMatchObject({ kind: 'prices', risk: '60', reward: '120' });
    expect(dEur.limitRoom).toEqual({ limit: '1000', net: '0', reached: false, left: '1000', risk: '60', above: false });
    expect(dEur.stopPrice).toBe('1.084');
    const dAcima = await previewEntry(db, acc.ftmo, entryPayload('forex', { ...eur, stop: '300' }));
    write('entry-dry-eurusd-acima', lastAnswer());
    expect(dAcima.limitRoom).toMatchObject({ left: '1000', risk: '1500', above: true });

    const jpy = { symbol: 'USD/JPY', direction: 'short' as const, quantity: '0.3', entryPrice: '151.240', stop: '20', target: '40', clock: NY };
    const dJpy = await previewEntry(db, acc.ftmo, entryPayload('forex', jpy));
    write('entry-dry-usdjpy', lastAnswer());
    expect(dJpy.preview).toMatchObject(domainRisk('forex', entryPayload('forex', jpy)));
    expect(dJpy.preview).toMatchObject({ risk: '39.62' });
    expect(dJpy.instrument.pnl).toBe('prices_div_exit');

    const gbp = { symbol: 'EUR/GBP', direction: 'short' as const, quantity: '0.5', entryPrice: '0.87120', stop: '10', target: '20', clock: NY };
    const dGbp = await previewEntry(db, acc.ftmo, entryPayload('forex', gbp));
    write('entry-dry-eurgbp', lastAnswer());
    expect(dGbp.preview).toMatchObject({ risk: null, reward: null, stopPoints: '0.001', targetPoints: '0.002' });
    expect(dGbp.limitRoom).toMatchObject({ risk: null, above: false });

    const xau = { symbol: 'XAUUSD', direction: 'short' as const, quantity: '0.2', entryPrice: '4409.80', stop: '4413.30', target: '4400.30', clock: NY };
    const dXau = await previewEntry(db, acc.ftmo, entryPayload('forex', xau));
    write('entry-dry-xauusd', lastAnswer());
    expect(dXau.instrument).toMatchObject({ key: 'XAUUSD', pnl: 'typed', stops: 'price', known: false });
    expect(dXau.preview).toMatchObject({ risk: null, stopPoints: '3.5', targetPoints: '9.5' });

    const eurReg = await registerEntry(db, acc.ftmo, entryPayload('forex', { ...eur, clientKey: newClientKey(), marks: { setup: 'A' } }));
    write('entry-eurusd', lastAnswer());
    trades.eurusd = eurReg.state.trade.id;
    const jpyReg = await registerEntry(db, acc.ftmo, entryPayload('forex', { ...jpy, clientKey: newClientKey() }));
    write('entry-usdjpy', lastAnswer());
    trades.usdjpy = jpyReg.state.trade.id;
    const jpy2 = await registerEntry(db, acc.ftmo, entryPayload('forex', { ...jpy, clientKey: newClientKey(), marks: { setup: 'B' } }));
    write('entry-usdjpy-corrigida', lastAnswer());
    trades.usdjpyCorrigida = jpy2.state.trade.id;
    const gbpReg = await registerEntry(db, acc.ftmo, entryPayload('forex', { ...gbp, clientKey: newClientKey(), marks: { setup: 'C' } }));
    write('entry-eurgbp', lastAnswer());
    trades.eurgbp = gbpReg.state.trade.id;
    expect(gbpReg.state.trade).toMatchObject({ status: 'open', symbol: 'EUR/GBP', assetType: 'forex', stopPrice: '0.8722', targetPrice: '0.8692' });
  });

  it('Thu 15 Oct 09:01 ET · Forex exits: computed, estimated, corrected with costs, typed («Já fechada» XAUUSD)', async () => {
    setClock('2026-10-15T13:01:05Z');
    const eur = await registerExit(db, trades.eurusd, exitPayload('forex', { exitPrice: '1.08635', clock: NY }));
    write('exit-eurusd', lastAnswer());
    expect(eur.exit).toMatchObject({ pnl: '57.5', pnlBasis: 'prices', points: '0.00115', r: '0.9583', commission: null });
    const jpy = await registerExit(db, trades.usdjpy, exitPayload('forex', { exitPrice: '150.980', clock: NY }));
    write('exit-usdjpy', lastAnswer());
    expect(jpy.exit).toMatchObject({ pnl: '51.66', pnlBasis: 'estimate' });
    const jpy2 = await registerExit(db, trades.usdjpyCorrigida, exitPayload('forex', { exitPrice: '150.980', clock: NY, pnl: '50.10', costs: '2.10' }));
    write('exit-usdjpy-corrigida', lastAnswer());
    expect(jpy2.exit).toMatchObject({ pnl: '50.1', pnlBasis: 'typed', commission: '2.1' });
    expect(await refused('eurgbp-sem-pnl', previewExit(db, trades.eurgbp, exitPayload('forex', { exitPrice: '0.87030', clock: NY })))).toEqual({ code: 'pnl_required', field: 'pnl' });

    const xau = { symbol: 'XAUUSD', direction: 'short' as const, quantity: '0.2', entryPrice: '4409.80', stop: '4413.30', target: '4400.30', clock: NY, day: '2026-10-15', entry: '08:45', exit: '08:58', exitPrice: '4404.55' };
    expect(await refused('xauusd-sem-pnl', previewAfter(db, acc.ftmo, afterPayload('forex', xau)))).toEqual({ code: 'pnl_required', field: 'pnl' });
    const dry = await previewAfter(db, acc.ftmo, afterPayload('forex', { ...xau, pnl: '105', costs: '7' }));
    write('after-dry-xauusd', lastAnswer());
    expect(dry.exit).toMatchObject({ pnl: '105', pnlBasis: 'typed', commission: '7', points: '5.25' });
    const done = await registerAfter(db, acc.ftmo, afterPayload('forex', { ...xau, pnl: '105', costs: '7', clientKey: newClientKey() }));
    write('after-xauusd', lastAnswer());
    expect(done.state.trade).toMatchObject({ pnl: '105', pnlBasis: 'typed', commission: '7', source: 'after' });

    expect((await openRows('ftmo', acc.ftmo)).map((t) => t.symbol)).toEqual(['EUR/GBP']);
    expect((await dayRows('ftmo', acc.ftmo, '2026-10-15', 'forex')).map((d) => [d.trade.symbol, d.trade.status, d.trade.pnl])).toEqual([
      ['EUR/USD', 'closed', '57.5'],
      ['USD/JPY', 'closed', '51.66'],
      ['USD/JPY', 'closed', '50.1'],
      ['EUR/GBP', 'open', null],
      ['XAUUSD', 'closed', '105'],
    ]);
  });

  it('Thu 15 Oct 10:18 de Brasília · B3 (Clear): the morning that reaches the R$ 500 limit («Já fechada»)', async () => {
    setClock('2026-10-15T13:18:05Z');
    const base = { clock: SP, day: '2026-10-15' };
    const s9a = { ...base, symbol: 'WIN', direction: 'long' as const, quantity: '3', entryPrice: '131400', stop: '300', target: '600', entry: '10:01', exit: '10:05', exitPrice: '131100', marks: { setup: 'B' as const } };
    const dry = await previewAfter(db, acc.clear, afterPayload('b3', s9a));
    write('after-dry-clear-s9a', lastAnswer());
    expect(dry.exit).toMatchObject({ pnl: '-180', pnlBasis: 'prices' });
    await registerAfter(db, acc.clear, afterPayload('b3', { ...s9a, clientKey: newClientKey() }));
    write('after-clear-s9a', lastAnswer());
    const s9b = { ...base, symbol: 'WIN', direction: 'short' as const, quantity: '5', entryPrice: '131050', stop: '200', target: '400', entry: '10:07', exit: '10:11', exitPrice: '131260', marks: { setup: 'C' as const } };
    expect((await registerAfter(db, acc.clear, afterPayload('b3', { ...s9b, clientKey: newClientKey() }))).state.trade.pnl).toBe('-210');
    write('after-clear-s9b', lastAnswer());
    const s9c = { ...base, symbol: 'WDO', direction: 'long' as const, quantity: '3', entryPrice: '5441.5', stop: '5', target: '10', entry: '10:13', exit: '10:16', exitPrice: '5436.5', marks: { setup: 'B' as const } };
    const c = await registerAfter(db, acc.clear, afterPayload('b3', { ...s9c, clientKey: newClientKey() }));
    write('after-clear-s9c', lastAnswer());
    expect(c.state.trade.pnl).toBe('-150');
    expect(c.gateNow).toMatchObject({ status: 'encerrado' });
  });

  it('Thu 15 Oct 10:20 de Brasília · B3: «Encerrado por hoje», WIN in points, series codes, the catalog, DI1 and codes outside it', async () => {
    setClock('2026-10-15T13:20:05Z');
    const now = rulesNow();
    write('agora-clear-qui-1020', now.json);
    const g = gateOf(now.parsed, acc.clear);
    expect(g.status).toBe('encerrado');
    expect(g.limit).toMatchObject({ evaluated: true, state: 'atingido', cents: 50000, worstCents: -54000, netCents: -54000 });
    expect(g.limit.evaluated && g.limit.state === 'atingido' && g.limit.hitAt?.toISOString()).toBe('2026-10-15T13:16:00.000Z');

    const win = { symbol: 'WIN', direction: 'short' as const, quantity: '3', entryPrice: '131250', stop: '100', target: '200', clock: SP };
    const dWin = await previewEntry(db, acc.clear, entryPayload('b3', win));
    write('entry-dry-win', lastAnswer());
    expect(dWin.preview).toMatchObject({ risk: '60', reward: '120' });
    expect(dWin.limitRoom).toMatchObject({ reached: true, left: '0', above: false });
    expect(dWin.plan).toMatchObject({ breaks: ['depois_do_limite'], verdict: 'fora_do_plano' });
    const d1006 = await previewEntry(db, acc.clear, entryPayload('b3', { ...win, stop: '600', entry: '10:06' }));
    write('entry-dry-win-1006', lastAnswer());
    expect(d1006.limitRoom).toEqual({ limit: '500', net: '-180', reached: false, left: '320', risk: '360', above: true });
    const dz = await previewEntry(db, acc.clear, entryPayload('b3', { ...win, symbol: 'WINZ26' }));
    write('entry-dry-winz26', lastAnswer());
    expect(dz.instrument).toMatchObject({ key: 'WIN', pnl: 'prices', stops: 'pts', tick: '5' });
    expect(dz.preview).toMatchObject({ risk: '60', reward: '120' });

    const petr = { symbol: 'PETR4', direction: 'long' as const, quantity: '300', entryPrice: '38.42', stop: '38.20', target: '38.90', clock: SP };
    const dp = await previewEntry(db, acc.clear, entryPayload('b3', petr));
    write('entry-dry-petr4', lastAnswer());
    expect(dp.preview).toMatchObject({ risk: '66', reward: '144' });
    const dp4 = await previewEntry(db, acc.clear, entryPayload('b3', { ...petr, entryPrice: '38.4250', target: undefined }));
    write('entry-dry-petr4-4dp', lastAnswer());
    expect(dp4.preview).toMatchObject({ risk: '67.5' });
    expect(await refused('petr4-5dp', previewEntry(db, acc.clear, entryPayload('b3', { ...petr, entryPrice: '38.42501' })))).toEqual({ code: 'bad_price', field: 'entry_price' });
    const di = await previewEntry(db, acc.clear, entryPayload('b3', { symbol: 'DI1F27', direction: 'long', quantity: '5', entryPrice: '14.250', stop: '14.200', clock: SP }));
    write('entry-dry-di1f27', lastAnswer());
    expect(di.instrument).toMatchObject({ key: 'DI1', pnl: 'typed', priceDp: 3 });
    const bgi = { symbol: 'BGIX26', direction: 'long' as const, quantity: '2', entryPrice: '310.55', stop: '309.80', clock: SP };
    const dBgi = await previewEntry(db, acc.clear, entryPayload('b3', bgi));
    write('entry-dry-bgix26', lastAnswer());
    expect(dBgi.instrument).toMatchObject({ key: 'BGIX26', pnl: 'typed', priceDp: 8, assetType: 'b3' });
    expect(dBgi.preview).toMatchObject({ risk: null });

    const winReg = await registerEntry(db, acc.clear, entryPayload('b3', { ...win, clientKey: newClientKey(), marks: { setup: 'A' } }));
    write('entry-win', lastAnswer());
    trades.win = winReg.state.trade.id;
    expect(winReg.state.trade).toMatchObject({ assetType: 'futures', stopPrice: '131350', targetPrice: '131050' });

    // A code outside the catalog, «Já fechada»: the result is typed (after the limit's hour, so the morning stays as drawn)
    const bgiAfter = { ...bgi, day: '2026-10-15', entry: '10:17', exit: '10:19', exitPrice: '311.30' };
    expect(await refused('bgix26-sem-pnl', previewAfter(db, acc.clear, afterPayload('b3', bgiAfter)))).toEqual({ code: 'pnl_required', field: 'pnl' });
    const dAfter = await previewAfter(db, acc.clear, afterPayload('b3', { ...bgiAfter, pnl: '150', costs: '3.50' }));
    write('after-dry-bgix26', lastAnswer());
    expect(dAfter.exit).toMatchObject({ pnl: '150', pnlBasis: 'typed', commission: '3.5' });
    await registerAfter(db, acc.clear, afterPayload('b3', { ...bgiAfter, pnl: '150', costs: '3.50', clientKey: newClientKey() }));
    write('after-bgix26', lastAnswer());
    expect((await openRows('clear', acc.clear)).map((t) => t.symbol)).toEqual(['WIN']);
  });

  it('Thu 15 Oct 10:31 de Brasília · B3: the WIN exit with costs, and the day in reais', async () => {
    setClock('2026-10-15T13:31:05Z');
    const out = await registerExit(db, trades.win, exitPayload('b3', { exitPrice: '131100', clock: SP, costs: '3.50' }));
    write('exit-win', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '90', pnlBasis: 'prices', commission: '3.5', points: '150', r: '1.5' });
    expect((await dayRows('clear', acc.clear, '2026-10-15', 'b3')).map((d) => [d.trade.symbol, d.trade.pnl, d.origin])).toEqual([
      ['WIN', '-180', 'reconstructed'],
      ['WIN', '-210', 'reconstructed'],
      ['WDO', '-150', 'reconstructed'],
      ['BGIX26', '150', 'reconstructed'],
      ['WIN', '90', 'live'],
    ]);
  });

  it('Thu 15 Oct 09:52 ET · Ações e opções (IBKR, no window): AAPL, an SPY call («Já fechada» and open), «Venceu sem valor» yesterday', async () => {
    setClock('2026-10-15T13:52:05Z');
    const now = rulesNow();
    write('agora-ibkr-qui-0952', now.json);
    expect(gateOf(now.parsed, acc.ibkr)).toMatchObject({ window: { evaluated: false }, limit: { evaluated: false } });

    const aapl = { symbol: 'AAPL', direction: 'long' as const, quantity: '100', entryPrice: '231.40', stop: '230.90', target: '232.40', clock: NY };
    const dA = await previewEntry(db, acc.ibkr, entryPayload('stocks', aapl));
    write('entry-dry-aapl', lastAnswer());
    expect(dA.preview).toMatchObject({ risk: '50', reward: '100' });
    expect(dA.limitRoom).toBeNull();
    expect(dA.plan).toMatchObject({ verdict: 'nao_avaliado' });
    expect(await refused('aapl-stop-acima', previewEntry(db, acc.ibkr, entryPayload('stocks', { ...aapl, stop: '232' })))).toEqual({ code: 'bad_stop', field: 'stop' });

    const call = { symbol: 'SPY', direction: 'long' as const, quantity: '2', entryPrice: '1.85', stop: '1.10', target: '3.20', clock: NY, option: OPTION_SPY('2026-10-15') };
    const dC = await previewEntry(db, acc.ibkr, entryPayload('stocks', call));
    write('entry-dry-spy-call', lastAnswer());
    expect(dC.preview).toMatchObject({ risk: '150', reward: '270' });
    expect(dC.instrument).toMatchObject({ assetType: 'option', mult: '100', pnl: 'prices', priceDp: 2, qtyDp: 0 });
    expect(await refused('spy-vencida', previewEntry(db, acc.ibkr, entryPayload('stocks', { ...call, option: OPTION_SPY('2026-10-14') })))).toEqual({ code: 'bad_option', field: 'option.expires_on' });

    const fechada = { ...call, day: '2026-10-15', entry: '09:35', exit: '09:48', exitPrice: '2.40' };
    const dF = await previewAfter(db, acc.ibkr, afterPayload('stocks', fechada));
    write('after-dry-spy-call', lastAnswer());
    expect(dF.exit).toMatchObject({ pnl: '110', pnlBasis: 'prices', points: '0.55' });
    await registerAfter(db, acc.ibkr, afterPayload('stocks', { ...fechada, clientKey: newClientKey(), marks: { setup: 'A' } }));
    write('after-spy-call', lastAnswer());

    const vsv = { ...call, option: OPTION_SPY('2026-10-14'), day: '2026-10-14', entry: '09:35', exit: '16:00', exitPrice: '0' };
    const dV = await previewAfter(db, acc.ibkr, afterPayload('stocks', vsv));
    write('after-dry-spy-vsv-ontem', lastAnswer());
    expect(dV.exit).toMatchObject({ pnl: '-370', pnlBasis: 'prices', exitPrice: '0' });
    expect(dV.exit.exitAt.toISOString()).toBe('2026-10-14T20:00:00.000Z');
    await registerAfter(db, acc.ibkr, afterPayload('stocks', { ...vsv, clientKey: newClientKey() }));
    write('after-spy-vsv-ontem', lastAnswer());

    const aReg = await registerEntry(db, acc.ibkr, entryPayload('stocks', { ...aapl, clientKey: newClientKey(), marks: { setup: 'B' } }));
    write('entry-aapl', lastAnswer());
    trades.aapl = aReg.state.trade.id;
    const cReg = await registerEntry(db, acc.ibkr, entryPayload('stocks', { ...call, clientKey: newClientKey(), marks: { setup: 'A' } }));
    write('entry-spy-call-aberta', lastAnswer());
    trades.spyCall = cReg.state.trade.id;
    expect(cReg.state.trade).toMatchObject({ assetType: 'option', option: { right: 'call', strike: '790', expiresOn: '2026-10-15', multiplier: '100' } });
    expect((await openRows('ibkr', acc.ibkr)).map((t) => [t.symbol, t.assetType])).toEqual([
      ['AAPL', 'stock'],
      ['SPY', 'option'],
    ]);
    const view = await readTradeViewRows(db, trades.spyCall);
    write('operacao-spy-aberta', view);
    expect(tradeViewOfRows(view!).trade.option).toMatchObject({ strike: '790' });
  });

  it('Thu 15 Oct 10:00 ET · AAPL out at 232,15', async () => {
    setClock('2026-10-15T14:00:05Z');
    const out = await registerExit(db, trades.aapl, exitPayload('stocks', { exitPrice: '232.15', clock: NY }));
    write('exit-aapl', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '75', pnlBasis: 'prices', r: '1.5' });
  });

  it('Thu 15 Oct 10:05 ET · Futuros «Buscar ativo»: CL computed, ZN typed with a price stop, MESZ6 as MES', async () => {
    setClock('2026-10-15T14:05:05Z');
    const now = rulesNow();
    write('agora-top-qui-1005', now.json);
    expect(gateOf(now.parsed, acc.topOne)).toMatchObject({ status: 'liberado' });
    const cl = await previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'CL', direction: 'long', quantity: '1', entryPrice: '70.45', stop: '0.50', target: '1.00', clock: NY }));
    write('entry-dry-cl', lastAnswer());
    expect(cl.preview).toMatchObject({ risk: '500', reward: '1000' });
    expect(cl.limitRoom).toMatchObject({ left: '400', risk: '500', above: true });
    const zn = { symbol: 'ZNZ6', direction: 'long' as const, quantity: '1', entryPrice: '112.5', stop: '112', target: '113.25', clock: NY };
    const dZn = await previewEntry(db, acc.topOne, entryPayload('futures', zn));
    write('entry-dry-zn', lastAnswer());
    expect(dZn.instrument).toMatchObject({ key: 'ZN', stops: 'price', pnl: 'typed' });
    expect(dZn.preview).toMatchObject({ risk: null, reward: null, stopPoints: '0.5', targetPoints: '0.75' });
    const { stop_price: _s, target_price: _t, ...semNivel } = entryPayload('futures', zn) as EntryPayload & { stop_price?: string; target_price?: string };
    expect(await refused('zn-pontos', previewEntry(db, acc.topOne, { ...semNivel, stop_pts: '0.5' }))).toEqual({ code: 'bad_stop', field: 'stop' });
    const mes = await previewEntry(db, acc.topOne, entryPayload('futures', { symbol: 'MESZ6', direction: 'long', quantity: '2', entryPrice: '6650.25', stop: '10', target: '20', clock: NY }));
    write('entry-dry-mesz6', lastAnswer());
    expect(mes.instrument).toMatchObject({ key: 'MES', stops: 'pts' });
    expect(mes.preview).toMatchObject({ risk: '100', reward: '200' });
    const reg = await registerEntry(db, acc.topOne, entryPayload('futures', { ...zn, clientKey: newClientKey(), marks: { setup: 'B' } }));
    write('entry-zn', lastAnswer());
    trades.zn = reg.state.trade.id;
    expect(reg.state.trade).toMatchObject({ symbol: 'ZNZ6', stopPrice: '112', targetPrice: '113.25' });
  });

  it('Thu 15 Oct 10:20 ET · ZN out with its typed result', async () => {
    setClock('2026-10-15T14:20:05Z');
    expect(await refused('zn-sem-pnl', previewExit(db, trades.zn, exitPayload('futures', { exitPrice: '112.75', clock: NY })))).toEqual({ code: 'pnl_required', field: 'pnl' });
    expect(await refused('zn-custos', previewExit(db, trades.zn, exitPayload('futures', { exitPrice: '112.75', clock: NY, pnl: '250', costs: '2' })))).toEqual({ code: 'not_for_market', field: 'costs' });
    const out = await registerExit(db, trades.zn, exitPayload('futures', { exitPrice: '112.75', clock: NY, pnl: '250' }));
    write('exit-zn', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '250', pnlBasis: 'typed', points: '0.25', r: '0.5' });
  });

  it('Thu 15 Oct 16:05 ET · the open SPY call «Venceu sem valor» (premium 0 at 16:00 ET)', async () => {
    setClock('2026-10-15T20:05:05Z');
    const out = await registerExit(db, trades.spyCall, exitPayload('stocks', { exitPrice: '0', exit: '16:00', clock: NY }));
    write('exit-spy-vsv', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '-370', exitPrice: '0', pnlBasis: 'prices' });
    expect(out.exit!.exitAt.toISOString()).toBe('2026-10-15T20:00:00.000Z');
    expect((await dayRows('ibkr', acc.ibkr, '2026-10-15', 'stocks')).map((d) => [d.trade.symbol, d.trade.assetType, d.trade.pnl])).toEqual([
      ['SPY', 'option', '110'],
      ['AAPL', 'stock', '75'],
      ['SPY', 'option', '-370'],
    ]);
    expect((await dayRows('top-one', acc.topOne, '2026-10-15', 'futures')).map((d) => [d.trade.symbol, d.trade.pnl, d.trade.pnlBasis])).toEqual([
      ['ZNZ6', '250', 'typed'],
    ]);
  });

  it('Sat 17 Oct 20:35 de Brasília · Cripto (Binance, every day): BTC/USDT short, BTC/BRL typed', async () => {
    setClock('2026-10-17T23:35:05Z');
    const now = rulesNow();
    write('agora-binance-sab-2035', now.json);
    expect(gateOf(now.parsed, acc.binance)).toMatchObject({ status: 'liberado', tradingDay: '2026-10-17' });
    const btc = { symbol: 'BTC/USDT', direction: 'short' as const, quantity: '0.25', entryPrice: '112400', stop: '112800', target: '111600', clock: SP };
    const d = await previewEntry(db, acc.binance, entryPayload('crypto', btc));
    write('entry-dry-btc', lastAnswer());
    expect(d.preview).toMatchObject({ risk: '100', reward: '200' });
    expect(d.limitRoom).toBeNull();
    const brl = await previewEntry(db, acc.binance, entryPayload('crypto', { ...btc, symbol: 'BTC/BRL', entryPrice: '612000', stop: '614000', target: '608000' }));
    write('entry-dry-btc-brl', lastAnswer());
    expect(brl.instrument).toMatchObject({ key: 'BTCBRL', pnl: 'typed', mult: null });
    const reg = await registerEntry(db, acc.binance, entryPayload('crypto', { ...btc, clientKey: newClientKey(), marks: { setup: 'A' } }));
    write('entry-btc', lastAnswer());
    trades.btc = reg.state.trade.id;
    expect((await openRows('binance', acc.binance)).map((t) => t.symbol)).toEqual(['BTC/USDT']);
  });

  it('Sat 17 Oct 21:02 de Brasília · the BTC exit with costs', async () => {
    setClock('2026-10-18T00:02:05Z');
    const out = await registerExit(db, trades.btc, exitPayload('crypto', { exitPrice: '111950', clock: SP, costs: '11.24' }));
    write('exit-btc', lastAnswer());
    expect(out.exit).toMatchObject({ pnl: '112.5', pnlBasis: 'prices', commission: '11.24', points: '450', r: '1.125' });
    expect(out.state.trade.tradingDay).toBe('2026-10-17');
    const view = await readTradeViewRows(db, trades.btc);
    write('operacao-btc-fechada', view);
    expect((await dayRows('binance', acc.binance, '2026-10-17', 'crypto')).map((d) => [d.trade.symbol, d.trade.pnl, d.trade.commission])).toEqual([
      ['BTC/USDT', '112.5', '11.24'],
    ]);
  });

  it('every account’s recent trades (the form’s starting values: the last symbols, the quote, the quantities)', async () => {
    for (const [name, id] of [['top-one', acc.topOne], ['ftmo', acc.ftmo], ['ibkr', acc.ibkr], ['binance', acc.binance], ['clear', acc.clear]] as const) {
      const recent = await rows(db.from('trades').select(RECENT_COLUMNS).eq('account_id', id).order('entry_time', { ascending: false }).limit(200) as never);
      write(`recentes-${name}`, recent);
      expect(recentTradesOfRows(recent).every((t) => typeof t.assetType === 'string')).toBe(true);
    }
  });

  it('records the refusals and the ids the fixtures refer to', () => {
    write('refusals', refusals);
    write('ids', { user: uid, accounts: acc, trades });
    expect(Object.keys(refusals).sort()).toEqual(
      ['aapl-stop-acima', 'bgix26-sem-pnl', 'eurgbp-sem-pnl', 'petr4-5dp', 'spy-vencida', 'xauusd-sem-pnl', 'zn-custos', 'zn-pontos', 'zn-sem-pnl'].sort(),
    );
    expect(recorded.length).toBeGreaterThan(50);
  });
});

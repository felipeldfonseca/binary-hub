// Generates app/__tests__/domain/cases3c.json: invented inputs, every "expected" computed by the SQL
// of the Phase 3c migrations (20261023000001..3, fase-3c/banco) on a throwaway cluster. Never the
// hosted project. Also re-asks the 3c trade_check_payload every shape case of the Phase 3 file
// (app/__tests__/domain/registro/cases.json) and stops if one answer changed.
//   node gen3c.mjs <psql url> <worktree>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [URL, REPO] = process.argv.slice(2);
const OUT = path.join(REPO, 'app/__tests__/domain/cases3c.json');
const PSQL = '/opt/homebrew/opt/postgresql@15/bin/psql';
const TAG = '$gen3c$';

function psql(sql) {
  return execFileSync(PSQL, [URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'], {
    input: `set timezone to 'UTC';\n${sql}`,
    env: { ...process.env, LC_ALL: 'C', LANG: 'C', PGOPTIONS: '-c timezone=UTC' },
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
}
const lit = (x) => `${TAG}${JSON.stringify(x)}${TAG}::jsonb`;
const lastJson = (out) => JSON.parse(out.trim().split('\n').filter(Boolean).pop());

/** Runs `expr` (an SQL expression of `c`, one case) over every case, in order */
function each(cases, expr) {
  const out = psql(`select coalesce(jsonb_agg((${expr}) order by ord), '[]'::jsonb) from jsonb_array_elements(${lit(cases)}) with ordinality as e(c, ord);`);
  const answers = lastJson(out);
  if (answers.length !== cases.length) throw new Error('count');
  return cases.map((c, i) => ({ ...c, expected: answers[i] }));
}

const version = psql('show server_version;').trim().split('\n').pop();
const NY = 'America/New_York';
const CK = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';

// ---------------------------------------------------------------------------------------------
// Resolved v1 with the optional tenth key (rules_check_resolved)
// ---------------------------------------------------------------------------------------------
const states = { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null };
const base = {
  futures: {
    v: 1, market: 'futures', windows: [{ tz: NY, start_min: 600, end_min: 660, weekdays: 31 }], windows_from: 'market',
    window_rule: { on: true, outside: 'fora' }, block: { on: true, before_min: 5, after_min: 10, calendars: ['us'] },
    limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' }, states, day: { tz: NY, start_min: 1080 },
  },
  forex: { v: 1, market: 'forex', windows: [], windows_from: null, window_rule: { on: true, outside: 'fora' }, block: null, limit: null, states: null, day: { tz: NY, start_min: 1020 } },
  stocks: { v: 1, market: 'stocks', windows: [], windows_from: null, window_rule: { on: true, outside: 'aviso' }, block: null, limit: null, states: null, day: { tz: NY, start_min: 1200 } },
  options: { v: 1, market: 'options', windows: [], windows_from: null, window_rule: { on: false, outside: 'fora' }, block: null, limit: null, states: null, day: { tz: NY, start_min: 1200 } },
  crypto: { v: 1, market: 'crypto', windows: [], windows_from: null, window_rule: { on: true, outside: 'fora' }, block: null, limit: { usd: 50, mode: 'conta', at_limit: 'avisar' }, states: null, day: { tz: 'America/Sao_Paulo', start_min: 0 } },
  b3: { v: 1, market: 'b3', windows: [], windows_from: null, window_rule: { on: true, outside: 'fora' }, block: null, limit: { brl: 300, mode: 'conta', at_limit: 'encerrar' }, states: null, day: { tz: 'America/Sao_Paulo', start_min: 0 } },
  binary: { v: 1, market: 'binary', windows: [], windows_from: null, window_rule: { on: true, outside: 'fora' }, block: null, limit: null, states: null, day: { tz: 'America/Sao_Paulo', start_min: 0 } },
};
const be = (by) => ({ by });
const many = (k, un = 'price') => Object.fromEntries(Array.from({ length: k }, (_, i) => [`A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`, { n: 1, un }]));
const resolvedCases = [
  ['futures: MES +8, MNQ +30, MGC +5', 'futures', be({ MES: { n: 8, un: 'pts' }, MNQ: { n: 30, un: 'pts' }, MGC: { n: 5, un: 'pts' } })],
  ['futures: one asset, decimals', 'futures', be({ MES: { n: 7.5, un: 'pts' } })],
  ['futures: 8 decimals', 'futures', be({ MES: { n: 0.12345678, un: 'pts' } })],
  ['futures: 9 decimals', 'futures', be({ MES: { n: 0.123456789, un: 'pts' } })],
  ['futures: 1 000 000', 'futures', be({ MES: { n: 1000000, un: 'pts' } })],
  ['futures: above 1 000 000', 'futures', be({ MES: { n: 1000000.5, un: 'pts' } })],
  ['futures: zero', 'futures', be({ MES: { n: 0, un: 'pts' } })],
  ['futures: negative', 'futures', be({ MES: { n: -8, un: 'pts' } })],
  ['futures: n as a string', 'futures', be({ MES: { n: '8', un: 'pts' } })],
  ['futures: no n', 'futures', be({ MES: { un: 'pts' } })],
  ['futures: no unit', 'futures', be({ MES: { n: 8 } })],
  ['futures: unknown unit', 'futures', be({ MES: { n: 8, un: 'ticks' } })],
  ['futures: unit not rechecked (pips on MES)', 'futures', be({ MES: { n: 8, un: 'pips' } })],
  ['futures: an extra key in an asset', 'futures', be({ MES: { n: 8, un: 'pts', at: 1 } })],
  ['futures: asset not an object', 'futures', be({ MES: 8 })],
  ['futures: contract month in the key', 'futures', be({ MESZ5: { n: 8, un: 'pts' } })],
  ['futures: lower-case key', 'futures', be({ mes: { n: 8, un: 'pts' } })],
  ['futures: key with a slash', 'futures', be({ 'M/ES': { n: 8, un: 'pts' } })],
  ['futures: key of 21 characters', 'futures', be({ ABCDEFGHIJKLMNOPQRSTU: { n: 1, un: 'price' } })],
  ['futures: a root outside the table (ZN, price)', 'futures', be({ ZN: { n: 0.5, un: 'price' } })],
  ['futures: no asset', 'futures', be({})],
  ['futures: by null', 'futures', { by: null }],
  ['futures: by an array', 'futures', { by: [] }],
  ['futures: empty object', 'futures', {}],
  ['futures: an extra key beside by', 'futures', { by: { MES: { n: 8, un: 'pts' } }, on: true }],
  ['futures: null', 'futures', null],
  ['futures: a string', 'futures', 'MES +8'],
  ['forex: 20 assets', 'forex', be(many(20))],
  ['forex: 21 assets', 'forex', be(many(21))],
  ['forex: EURUSD pips, XAUUSD price', 'forex', be({ EURUSD: { n: 7.5, un: 'pips' }, XAUUSD: { n: 1.2, un: 'price' } })],
  ['forex: EUR/USD as written', 'forex', be({ 'EUR/USD': { n: 7.5, un: 'pips' } })],
  ['stocks: AAPL price', 'stocks', be({ AAPL: { n: 0.5, un: 'price' } })],
  ['options: SPX price', 'options', be({ SPX: { n: 0.25, un: 'price' } })],
  ['crypto: BTCUSDT price', 'crypto', be({ BTCUSDT: { n: 150, un: 'price' } })],
  ['b3: WIN pts, PETR4 price', 'b3', be({ WIN: { n: 150, un: 'pts' }, PETR4: { n: 0.3, un: 'price' } })],
  ['b3: PETR4F (fractional) as the key', 'b3', be({ PETR4F: { n: 0.3, un: 'price' } })],
  ['b3: WINZ26 as the key', 'b3', be({ WINZ26: { n: 150, un: 'pts' } })],
  ['binary: never', 'binary', be({ EURUSD: { n: 5, un: 'pips' } })],
].map(([label, m, b]) => ({ label, json: { ...base[m], breakeven: b } }));
resolvedCases.push(
  { label: 'futures: without the key (nine keys)', json: base.futures },
  { label: 'binary: without the key', json: base.binary },
  { label: 'futures: an eleventh key', json: { ...base.futures, breakeven: be({ MES: { n: 8, un: 'pts' } }), extra: 1 } },
  { label: 'futures: the tenth key under another name', json: { ...base.futures, be: be({ MES: { n: 8, un: 'pts' } }) } },
);
const resolved = each(resolvedCases, `to_jsonb(public.rules_check_resolved(c->'json'))`);

// ---------------------------------------------------------------------------------------------
// The stored setting {on, by} (rules_check_breakeven)
// ---------------------------------------------------------------------------------------------
const settingCases = [
  ['futures', { on: true, by: { MES: 8, MNQ: 30 } }],
  ['futures', { on: false, by: { MES: 8 } }],
  ['futures', { on: true, by: {} }],
  ['futures', { on: true, by: { MES: 7.5 } }],
  ['futures', { on: true, by: { MES: 0 } }],
  ['futures', { on: true, by: { MES: -1 } }],
  ['futures', { on: true, by: { MES: '8' } }],
  ['futures', { on: true, by: { MES: 0.123456789 } }],
  ['futures', { on: true, by: { MES: 1000001 } }],
  ['futures', { on: true, by: { MESZ5: 8 } }],
  ['futures', { on: true, by: { mes: 8 } }],
  ['futures', { on: true, by: { ZN: 0.5 } }],
  ['futures', { on: 'sim', by: {} }],
  ['futures', { on: true }],
  ['futures', { by: {} }],
  ['futures', { on: true, by: [] }],
  ['futures', { on: true, by: {}, favor: 8 }],
  ['futures', null],
  ['futures', 8],
  ['futures', { on: true, by: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`Z${String.fromCharCode(65 + i)}`, 1])) }],
  ['futures', { on: true, by: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`Z${String.fromCharCode(65 + i)}`, 1])) }],
  ['forex', { on: true, by: { EURUSD: 7.5, USDJPY: 10 } }],
  ['forex', { on: true, by: { 'EUR/USD': 7.5 } }],
  ['b3', { on: true, by: { WIN: 150, PETR4: 0.3 } }],
  ['b3', { on: true, by: { WINZ26: 150 } }],
  ['b3', { on: true, by: { PETR4F: 0.3 } }],
  ['crypto', { on: true, by: { BTCUSDT: 150 } }],
  ['stocks', { on: true, by: { AAPL: 0.5 } }],
  ['options', { on: true, by: { SPX: 0.5 } }],
  ['binary', { on: true, by: { EURUSD: 5 } }],
  ['binary', null],
  ['xyz', { on: true, by: {} }],
].map(([market, p]) => ({ market, p }));
const setting = each(settingCases, `to_jsonb(public.rules_check_breakeven(c->>'market', c->'p'))`);

// ---------------------------------------------------------------------------------------------
// rules_resolve with a breakeven setting (the whole resolved value)
// ---------------------------------------------------------------------------------------------
const builtin = lastJson(psql(`select jsonb_object_agg(m, public.rules_builtin(m)) from unnest(array['futures','binary','forex','stocks','crypto','b3','options']) m;`));
const clocks = { futures: [NY, 1080], forex: [NY, 1020], stocks: [NY, 1200], options: [NY, 1200], crypto: ['America/Sao_Paulo', 0], b3: ['America/Sao_Paulo', 0], binary: ['America/Sao_Paulo', 0] };
const mk = (m, b) => ({ v: 1, window_rule: { on: true, outside: 'fora' }, ...(m === 'futures' ? { block: { on: true, before_min: 5, after_min: 10 }, states: {} } : {}), ...(b === undefined ? {} : { breakeven: b }) });
const resolveCases = [
  ['Padrão Futuros MES +10, MNQ +40; the account inherits', 'futures', mk('futures', { on: true, by: { MES: 10, MNQ: 40 } }), null],
  ['Padrão Futuros on; the account: its own MNQ +30', 'futures', mk('futures', { on: true, by: { MES: 10, MNQ: 40 } }), { v: 1, breakeven: { on: true, by: { MNQ: 30 } } }],
  ['Padrão Futuros on; the account: its own, off', 'futures', mk('futures', { on: true, by: { MES: 10 } }), { v: 1, breakeven: { on: false, by: { MES: 10 } } }],
  ['Padrão Futuros off, with values', 'futures', mk('futures', { on: false, by: { MES: 10 } }), null],
  ['Padrão Futuros on with no asset', 'futures', mk('futures', { on: true, by: {} }), null],
  ['Padrão Futuros never set; the account on', 'futures', mk('futures'), { v: 1, breakeven: { on: true, by: { MES: 8, ZN: 0.5 } } }],
  ['no market row (builtin); the account on, decimals', 'futures', null, { v: 1, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' }, breakeven: { on: true, by: { MGC: 7.5 } } }],
  ['no setting anywhere', 'futures', null, null],
  ['forex: EURUSD pips, USDJPY pips, XAUUSD price', 'forex', null, { v: 1, breakeven: { on: true, by: { EURUSD: 7.5, USDJPY: 10, XAUUSD: 1.2 } } }],
  ['forex: the hidden market default on', 'forex', mk('forex', { on: true, by: { GBPUSD: 5 } }), null],
  ['stocks: AAPL', 'stocks', null, { v: 1, breakeven: { on: true, by: { AAPL: 0.5 } } }],
  ['options: SPX', 'options', null, { v: 1, breakeven: { on: true, by: { SPX: 0.25 } } }],
  ['crypto: BTCUSDT and BTCBRL', 'crypto', null, { v: 1, breakeven: { on: true, by: { BTCUSDT: 150, BTCBRL: 800 } } }],
  ['b3: WIN, DI1, PETR4', 'b3', null, { v: 1, limit: { brl: 300, mode: 'conta', at_limit: 'encerrar' }, breakeven: { on: true, by: { WIN: 150, DI1: 0.05, PETR4: 0.3 } } }],
  ['binary: a setting never acts', 'binary', mk('binary', { on: true, by: { EURUSD: 5 } }), { v: 1, breakeven: { on: true, by: { EURUSD: 5 } } }],
].map(([label, market, marketRules, own]) => ({ label, market, day: { tz: clocks[market][0], start_min: clocks[market][1] }, market_rules: marketRules, own }));
const resolve = each(
  resolveCases,
  `public.rules_resolve(c->>'market', c#>>'{day,tz}', (c#>>'{day,start_min}')::int, nullif(c->'market_rules', 'null'::jsonb), '[]'::jsonb, nullif(c->'own', 'null'::jsonb), null, '["us"]'::jsonb)`,
);

// ---------------------------------------------------------------------------------------------
// trade_favor (points in favour at a price, in the unit of stops)
// ---------------------------------------------------------------------------------------------
const opt = { right: 'call', strike: '790', expires_on: '2026-11-20' };
const favorCases = [
  ['futures', 'MES', null, 1, '7912.25', '7920.5'],
  ['futures', 'MES', null, -1, '7912.25', '7920.5'],
  ['futures', 'MNQZ5', null, -1, '30950', '30930'],
  ['futures', 'ZN', null, 1, '112.515625', '112.75'],
  ['forex', 'EUR/USD', null, 1, '1.0852', '1.08595'],
  ['forex', 'USD/JPY', null, -1, '151.24', '151.02'],
  ['forex', 'XAUUSD', null, 1, '2650.5', '2655.75'],
  ['forex', 'EUR/GBP', null, -1, '0.8712', '0.8707'],
  ['stocks', 'AAPL', null, 1, '231.4', '232.15'],
  ['stocks', 'SPY', opt, 1, '1.85', '2.4'],
  ['crypto', 'BTC/USDT', null, -1, '112400', '111950'],
  ['b3', 'WINZ26', null, -1, '131250', '131100'],
  ['b3', 'PETR4', null, 1, '38.42', '38.71'],
  ['b3', 'DI1F27', null, 1, '14.205', '14.255'],
  ['futures', 'MES', null, 1, '7912.25', '7912.25'],
  ['forex', 'EUR/USD', null, 1, '1.0852', '1.08513'],
].map(([market, symbol, option, sgn, entry, price]) => ({ market, symbol, option, sgn, entry, price }));
const favor = each(favorCases, `to_jsonb(trim_scale(public.trade_favor(public.trade_instrument(c->>'market', c->>'symbol', nullif(c->'option', 'null'::jsonb)), (c->>'sgn')::int, (c->>'entry')::numeric, (c->>'price')::numeric))::text)`);

// ---------------------------------------------------------------------------------------------
// trade_breakeven (the rule of a trade's version for its asset, and its price)
// ---------------------------------------------------------------------------------------------
const rFut = { ...base.futures, breakeven: be({ MES: { n: 8, un: 'pts' }, MNQ: { n: 30, un: 'pts' }, MGC: { n: 7.5, un: 'pts' } }) };
const rFx = { ...base.forex, breakeven: be({ EURUSD: { n: 7.5, un: 'pips' }, USDJPY: { n: 10, un: 'pips' }, XAUUSD: { n: 1.2, un: 'price' }, USDINR: { n: 3, un: 'pips' } }) };
const rB3 = { ...base.b3, breakeven: be({ WIN: { n: 150, un: 'pts' }, PETR4: { n: 0.3, un: 'price' } }) };
const rStk = { ...base.stocks, breakeven: be({ AAPL: { n: 0.5, un: 'price' }, SPY: { n: 0.2, un: 'price' } }) };
const rCry = { ...base.crypto, breakeven: be({ BTCUSDT: { n: 150, un: 'price' } }) };
const trBeCases = [
  [rFut, 'futures', 'MES', false, 'long', '7912.5'],
  [rFut, 'futures', 'MESZ5', false, 'short', '7912.5'],
  [rFut, 'futures', 'MNQ', false, 'long', '30880'],
  [rFut, 'futures', 'MGC', false, 'short', '4421.3'],
  [rFut, 'futures', 'ES', false, 'long', '7900'],
  [rFut, 'futures', 'MES', false, 'call', '7912.5'],
  [rFut, 'futures', 'MES', false, 'long', null],
  [base.futures, 'futures', 'MES', false, 'long', '7912.5'],
  [rFx, 'forex', 'EUR/USD', false, 'long', '1.0852'],
  [rFx, 'forex', 'USD/JPY', false, 'short', '151.24'],
  [rFx, 'forex', 'XAUUSD', false, 'long', '2650.5'],
  [rFx, 'forex', 'USD/INR', false, 'long', '84.1'],
  [rB3, 'b3', 'WINZ26', false, 'short', '131250'],
  [rB3, 'b3', 'PETR4F', false, 'long', '38.42'],
  [rStk, 'stocks', 'AAPL', false, 'long', '231.4'],
  [rStk, 'stocks', 'SPY', true, 'long', '1.85'],
  [rCry, 'crypto', 'BTC/USDT', false, 'short', '112400'],
  [rFx, 'binary', 'EUR/USD', false, 'long', '1.0852'],
  [rFut, null, 'MES', false, 'long', '7912.5'],
].map(([resolved, market, symbol, option, direction, entry]) => ({ resolved, market, symbol, option, direction, entry }));
const tradeBreakeven = each(
  trBeCases,
  `public.trade_breakeven(c->'resolved', c->>'market', c->>'symbol', (c->>'option')::boolean, c->>'direction', (c->>'entry')::numeric)`,
);

// ---------------------------------------------------------------------------------------------
// trade_r_of (R on the initial stop over every exit)
// ---------------------------------------------------------------------------------------------
const rCases = [
  ['3 MES long in two exits', '7912.5', '7902.5', 1, '3', [{ quantity: '1', exit_price: '7916.5' }, { quantity: '2', exit_price: '7920.5' }]],
  ['one exit = Phase 3 R', '7912.5', '7902.5', 1, '3', [{ quantity: '3', exit_price: '7920.5' }]],
  ['MGC short, «Já fechada» in two', '4421.3', '4436.3', -1, '2', [{ quantity: '1', exit_price: '4409.3' }, { quantity: '1', exit_price: '4421.3' }]],
  ['a loss', '30880', '30840', 1, '3', [{ quantity: '2', exit_price: '30855' }, { quantity: '1', exit_price: '30840' }]],
  ['forex lots', '1.0852', '1.0840', 1, '1', [{ quantity: '0.5', exit_price: '1.0865' }, { quantity: '0.5', exit_price: '1.087' }]],
  ['no stop', '7912.5', null, 1, '3', [{ quantity: '3', exit_price: '7920.5' }]],
  ['stop at the entry', '7912.5', '7912.5', 1, '3', [{ quantity: '3', exit_price: '7920.5' }]],
  ['an exit without a price', '7912.5', '7902.5', 1, '3', [{ quantity: '1', exit_price: null }, { quantity: '2', exit_price: '7920.5' }]],
  ['no exit', '7912.5', '7902.5', 1, '3', []],
  ['position zero', '7912.5', '7902.5', 1, '0', [{ quantity: '1', exit_price: '7920.5' }]],
  ['a repeating quotient', '100', '97', 1, '3', [{ quantity: '1', exit_price: '101' }, { quantity: '1', exit_price: '102' }, { quantity: '1', exit_price: '100' }]],
].map(([label, entry, stop, sgn, position, exits]) => ({ label, entry, stop, sgn, position, exits }));
// trade_r_of reads jsonb numbers (trade_exits_list's and register_after's): the SQL gets them as numbers
const rOf = each(rCases.map((c) => ({ ...c, sqlExits: c.exits.map((x) => ({ quantity: Number(x.quantity), exit_price: x.exit_price === null ? null : Number(x.exit_price) })) })),
  `to_jsonb(trim_scale(public.trade_r_of((c->>'entry')::numeric, (c->>'stop')::numeric, (c->>'sgn')::int, (c->>'position')::numeric, c->'sqlExits'))::text)`,
).map(({ sqlExits, ...c }) => c);

// ---------------------------------------------------------------------------------------------
// trade_check_payload: mode 'partial', «Já fechada» with exits and breakeven
// ---------------------------------------------------------------------------------------------
const part = (x = {}) => ({ v: 1, client_key: CK, quantity: '1', exit_price: '7920.5', ...x });
const after = (x = {}) => ({ v: 1, client_key: CK, symbol: 'MGC', direction: 'short', quantity: '2', entry_price: '4421.3', clock: NY, day: '2026-10-23', entry: '10:24', ...x });
const twoExits = [{ quantity: '1', exit_price: '4409.3', exit: '10:31' }, { quantity: '1', exit_price: '4421.3', exit: '10:38' }];
const shapeCases = [
  ['partial: the plain one', 'partial', 'futures', false, part()],
  ['partial: with hour and clock', 'partial', 'futures', false, part({ exit: '10:18', clock: NY })],
  ['partial: an hour without a clock', 'partial', 'futures', false, part({ exit: '10:18' })],
  ['partial: a typed result', 'partial', 'forex', false, part({ pnl: '-12.5' })],
  ['partial: a bad typed result', 'partial', 'forex', false, part({ pnl: '12,5' })],
  ['partial: «Custos» never', 'partial', 'forex', false, part({ costs: '1.2' })],
  ['partial: no client_key', 'partial', 'futures', false, (({ client_key, ...x }) => x)(part())],
  ['partial: no client_key, dry run', 'partial', 'futures', true, (({ client_key, ...x }) => x)(part())],
  ['partial: a bad client_key', 'partial', 'futures', false, part({ client_key: 'abc' })],
  ['partial: quantity as a number', 'partial', 'futures', false, part({ quantity: 1 })],
  ['partial: no quantity', 'partial', 'futures', false, (({ quantity, ...x }) => x)(part())],
  ['partial: no price', 'partial', 'futures', false, (({ exit_price, ...x }) => x)(part())],
  ['partial: price as a number', 'partial', 'futures', false, part({ exit_price: 7920.5 })],
  ['partial: an unknown key', 'partial', 'futures', false, part({ symbol: 'MES' })],
  ['partial: v 2', 'partial', 'futures', false, part({ v: 2 })],
  ['partial: a bad hour', 'partial', 'futures', false, part({ exit: '25:00', clock: NY })],
  ['partial: binaries refuse its keys', 'partial', 'binary', false, part()],
  ['partial: an outcome on a price market', 'partial', 'futures', false, part({ outcome: 'ganho' })],
  ['exit: "exits" is not an exit key', 'exit', 'futures', false, { v: 1, exit_price: '7920.5', exits: twoExits }],
  ['exit: "breakeven" is not an exit key', 'exit', 'futures', false, { v: 1, exit_price: '7920.5', breakeven: { price_then: '1' } }],
  ['after: two exits', 'after', 'futures', false, after({ exits: twoExits })],
  ['after: two exits and the breakeven', 'after', 'futures', false, after({ exits: twoExits, breakeven: { price_then: '4409.3' } })],
  ['after: one exit and the breakeven', 'after', 'futures', false, after({ exit: '10:38', exit_price: '4415.3', breakeven: { price_then: '4409.3' } })],
  ['after: exits and exit_price', 'after', 'futures', false, after({ exits: twoExits, exit_price: '4415.3' })],
  ['after: exits and exit', 'after', 'futures', false, after({ exits: twoExits, exit: '10:38' })],
  ['after: one item', 'after', 'futures', false, after({ exits: twoExits.slice(0, 1) })],
  ['after: 21 items', 'after', 'futures', false, after({ exits: Array.from({ length: 21 }, () => twoExits[0]) })],
  ['after: 20 items', 'after', 'futures', false, after({ exits: Array.from({ length: 20 }, () => twoExits[0]) })],
  ['after: exits not an array', 'after', 'futures', false, after({ exits: { a: twoExits[0] } })],
  ['after: exits null', 'after', 'futures', false, after({ exits: null })],
  ['after: an item not an object', 'after', 'futures', false, after({ exits: [twoExits[0], 'x'] })],
  ['after: an unknown key in an item', 'after', 'futures', false, after({ exits: [twoExits[0], { ...twoExits[1], symbol: 'MGC' }] })],
  ['after: «Custos» in an item where the market has none', 'after', 'futures', false, after({ exits: [twoExits[0], { ...twoExits[1], costs: '1' }] })],
  ['after: «Custos» in an item (forex)', 'after', 'forex', false, after({ symbol: 'EUR/USD', direction: 'long', quantity: '1', entry_price: '1.0852', exits: [{ quantity: '0.5', exit_price: '1.0865', exit: '10:31' }, { quantity: '0.5', exit_price: '1.087', exit: '10:38', costs: '7' }] })],
  ['after: a bad «Custos» in an item', 'after', 'forex', false, after({ symbol: 'EUR/USD', direction: 'long', quantity: '1', entry_price: '1.0852', exits: [twoExits[0], { ...twoExits[1], costs: '-1' }] })],
  ['after: an item without quantity', 'after', 'futures', false, after({ exits: [twoExits[0], { exit_price: '4421.3', exit: '10:38' }] })],
  ['after: an item quantity as a number', 'after', 'futures', false, after({ exits: [twoExits[0], { ...twoExits[1], quantity: 1 }] })],
  ['after: an item without price', 'after', 'futures', false, after({ exits: [twoExits[0], { quantity: '1', exit: '10:38' }] })],
  ['after: an item without hour', 'after', 'futures', false, after({ exits: [twoExits[0], { quantity: '1', exit_price: '4421.3' }] })],
  ['after: an item with a bad hour', 'after', 'futures', false, after({ exits: [twoExits[0], { ...twoExits[1], exit: '10h38' }] })],
  ['after: an item with a bad result', 'after', 'futures', false, after({ exits: [twoExits[0], { ...twoExits[1], pnl: 'x' }] })],
  ['after: an item with a typed result', 'after', 'futures', false, after({ symbol: 'ZN', exits: [{ ...twoExits[0], pnl: '120' }, { ...twoExits[1], pnl: '0' }] })],
  ['after: exits without clock', 'after', 'futures', false, (({ clock, ...x }) => x)(after({ exits: twoExits }))],
  ['after: no exit and no exits', 'after', 'futures', false, after()],
  ['after: breakeven not an object', 'after', 'futures', false, after({ exit: '10:38', exit_price: '4415.3', breakeven: '4409.3' })],
  ['after: breakeven with another key', 'after', 'futures', false, after({ exit: '10:38', exit_price: '4415.3', breakeven: { price_then: '4409.3', favor: '12' } })],
  ['after: breakeven without the price', 'after', 'futures', false, after({ exit: '10:38', exit_price: '4415.3', breakeven: {} })],
  ['after: breakeven price as a number', 'after', 'futures', false, after({ exit: '10:38', exit_price: '4415.3', breakeven: { price_then: 4409.3 } })],
  ['after: binaries never take exits', 'after', 'binary', false, { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '10', payout: '87', duration_s: 300, clock: 'America/Sao_Paulo', day: '2026-10-23', entry: '10:00', outcome: 'ganho', exits: twoExits }],
  ['after: binaries never take breakeven', 'after', 'binary', false, { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '10', payout: '87', duration_s: 300, clock: 'America/Sao_Paulo', day: '2026-10-23', entry: '10:00', outcome: 'ganho', breakeven: { price_then: '1' } }],
].map(([label, mode, market, dry, payload]) => ({ label, mode, market, dry, payload, platform: market === 'binary' ? 'ebinex' : null }));
const shape = each(shapeCases, `public.trade_check_payload(c->>'mode', c->>'market', c->'payload', (c->>'dry')::boolean, c->>'platform')`);

// The Phase 3 shapes, asked again of the 3c function: none may change
const old = JSON.parse(fs.readFileSync(path.join(REPO, 'app/__tests__/domain/registro/cases.json'), 'utf8'));
const again = each(old.shape.cases.map(({ expected, ...c }) => c), `public.trade_check_payload(c->>'mode', c->>'market', c->'payload', (c->>'dry')::boolean, c->>'platform')`);
const changed = again.filter((c, i) => JSON.stringify(c.expected) !== JSON.stringify(old.shape.cases[i].expected));
if (changed.length) throw new Error(`Phase 3 shapes changed: ${changed.map((c) => c.label).join(', ')}`);
console.error(`Phase 3 shape cases re-asked of the 3c trade_check_payload: ${again.length}, changed 0`);

// ---------------------------------------------------------------------------------------------
// import_stage with positions (3c): the rows of one broker position link as a whole
// ---------------------------------------------------------------------------------------------
const MU = '9e3c0000-0000-4000-8000-000000000002';
const A = (n) => `9e3c0000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`;
const tid = (s, n) => `9e3c0000-0000-4000-8000-00000${String(s).padStart(3, '0')}${String(n).padStart(4, '0')}`;
function fileRow(market, r) {
  const binr = market === 'binary';
  return {
    line: String(r.line), external_id: r.id, symbol: r.symbol, asset_type: binr ? 'binary_option' : 'futures', direction: r.direction,
    local_entry: r.entry.slice(0, 19), local_exit: r.exit ? r.exit.slice(0, 19) : null, utc_offset: '+00:00',
    entry_price: binr ? '1.08500' : r.price ?? '7896.25', exit_price: binr ? '1.08510' : '7903.75', quantity: binr ? '1' : r.qty,
    stake_amount: binr ? r.stake : null, payout_percent: binr ? '88' : null, duration_seconds: binr ? '60' : null, timeframe: binr ? 'M1' : null,
    result: 'win', pnl: binr ? '17.60' : '75.00', commission: binr ? '0' : '1.24', stop_price: null, target_price: null,
  };
}
const at = (hms) => `2026-10-14T${hms}.000Z`;
const ebx = (hms) => `2026-10-15T${hms}.000Z`;
const scenarios = [
  {
    label: 'the window of Phase 3, its first two rows now one position (same symbol, side, open and price)', market: 'futures',
    trades: [
      { n: 1, symbol: 'MES', direction: 'long', entry: at('14:58:00'), qty: '1' }, { n: 2, symbol: 'MES', direction: 'long', entry: at('15:16:00'), qty: '1' },
      { n: 3, symbol: 'MES', direction: 'long', entry: at('16:16:01'), qty: '1' }, { n: 4, symbol: 'MES', direction: 'long', entry: at('16:57:59'), qty: '1' },
    ],
    rows: [
      { line: 2, id: 'W1', symbol: 'MESZ6', direction: 'long', entry: at('15:00:00'), exit: at('15:30:00'), qty: '1' },
      { line: 3, id: 'W2', symbol: 'MESZ6', direction: 'long', entry: at('15:00:00'), exit: at('15:30:00'), qty: '1' },
      { line: 4, id: 'W3', symbol: 'MESZ6', direction: 'long', entry: at('16:00:00'), exit: at('16:30:00'), qty: '1' },
      { line: 5, id: 'W4', symbol: 'MESZ6', direction: 'long', entry: at('17:00:00'), exit: at('17:30:00'), qty: '1' },
    ],
  },
  {
    label: 'the ties of Phase 3, four rows of one position: the whole to the nearest trade', market: 'futures',
    trades: [
      { n: 2, symbol: 'MES', direction: 'long', entry: at('14:08:00'), qty: '1' }, { n: 1, symbol: 'MES', direction: 'long', entry: at('14:08:00'), qty: '1' },
      { n: 3, symbol: 'MES', direction: 'long', entry: at('14:06:00'), qty: '1' },
    ],
    rows: [
      { line: 3, id: 'Q1', symbol: 'MES', direction: 'long', entry: at('14:07:00'), exit: at('14:20:00'), qty: '1' },
      { line: 2, id: 'Q2', symbol: 'MES', direction: 'long', entry: at('14:07:00'), exit: at('14:20:00'), qty: '1' },
      { line: 4, id: 'Q3', symbol: 'MES', direction: 'long', entry: at('14:07:00'), exit: at('14:20:00'), qty: '1' },
      { line: 5, id: 'Q4', symbol: 'MES', direction: 'long', entry: at('14:07:00'), exit: at('14:20:00'), qty: '1' },
    ],
  },
  {
    label: 'a position in two rows goes whole to the app trade of its whole size, before a nearer one of one row\'s size', market: 'futures',
    trades: [{ n: 1, symbol: 'MES', direction: 'long', entry: at('14:07:00'), qty: '3' }, { n: 2, symbol: 'MES', direction: 'long', entry: at('14:07:30'), qty: '1' }],
    rows: [
      { line: 2, id: 'P1', symbol: 'MESZ6', direction: 'long', entry: at('14:07:20'), exit: at('14:15:00'), qty: '1', price: '7912.50' },
      { line: 3, id: 'P2', symbol: 'MESZ6', direction: 'long', entry: at('14:07:20'), exit: at('14:20:00'), qty: '2', price: '7912.5' },
    ],
  },
  {
    label: 'two open prices in the same second: two positions, one-to-one', market: 'futures',
    trades: [{ n: 1, symbol: 'MES', direction: 'long', entry: at('14:07:00'), qty: '1' }, { n: 2, symbol: 'MES', direction: 'long', entry: at('14:07:30'), qty: '2' }],
    rows: [
      { line: 2, id: 'R1', symbol: 'MESZ6', direction: 'long', entry: at('14:07:20'), exit: at('14:15:00'), qty: '1', price: '7912.50' },
      { line: 3, id: 'R2', symbol: 'MESZ6', direction: 'long', entry: at('14:07:20'), exit: at('14:20:00'), qty: '2', price: '7912.75' },
    ],
  },
  {
    label: 'the symbol as written: MESZ6 and MES are two positions', market: 'futures',
    trades: [{ n: 1, symbol: 'MES', direction: 'long', entry: at('14:07:00'), qty: '1' }, { n: 2, symbol: 'MES', direction: 'long', entry: at('14:08:00'), qty: '1' }],
    rows: [
      { line: 2, id: 'Y1', symbol: 'MESZ6', direction: 'long', entry: at('14:07:20'), exit: at('14:15:00'), qty: '1' },
      { line: 3, id: 'Y2', symbol: 'MES', direction: 'long', entry: at('14:07:20'), exit: at('14:20:00'), qty: '1' },
    ],
  },
  {
    label: 'an exit before the open stays its own position', market: 'futures',
    trades: [{ n: 1, symbol: 'MES', direction: 'long', entry: at('14:07:00'), qty: '1' }, { n: 2, symbol: 'MES', direction: 'long', entry: at('14:08:00'), qty: '1' }],
    rows: [
      { line: 2, id: 'V1', symbol: 'MES', direction: 'long', entry: at('14:07:20'), exit: at('14:15:00'), qty: '1' },
      { line: 3, id: 'V2', symbol: 'MES', direction: 'long', entry: at('14:07:20'), exit: at('14:07:00'), qty: '1' },
    ],
  },
  {
    label: 'Ebinex rows never group: one-to-one by the expiry', market: 'binary',
    trades: [
      { n: 1, symbol: 'EUR/USD', direction: 'call', entry: ebx('23:10:05'), expires: ebx('23:12:00'), stake: '20' },
      { n: 2, symbol: 'EUR/USD', direction: 'call', entry: ebx('23:10:06'), expires: ebx('23:13:00'), stake: '20' },
    ],
    rows: [
      { line: 2, id: 'B1', symbol: 'EURUSD', direction: 'call', entry: ebx('23:10:50'), exit: ebx('23:12:00'), stake: '20' },
      { line: 3, id: 'B2', symbol: 'EURUSD', direction: 'call', entry: ebx('23:10:50'), exit: ebx('23:13:00'), stake: '20' },
    ],
  },
];
const matching = [];
scenarios.forEach((s, si) => {
  const acc = A(si + 1);
  const rows = s.rows.map((r) => fileRow(s.market, r));
  const trades = s.trades.map((t) => ({ ...t, id: tid(si + 1, t.n) }));
  const sql = `
delete from public.trades where account_id = '${acc}';
delete from public.trading_accounts where id = '${acc}';
insert into auth.users (id, email) values ('${MU}', 'match3c@example.test') on conflict do nothing;
insert into public.profiles (id) values ('${MU}') on conflict do nothing;
insert into public.trading_accounts (id, user_id, market, label, platform) values ('${acc}', '${MU}', '${s.market}', 'match3c ${si + 1}', '${s.market === 'binary' ? 'ebinex' : 'topone'}');
set session_replication_role = replica;
insert into public.trades (id, user_id, account_id, source, status, symbol, asset_type, direction, quantity, stake_amount, entry_time, expires_at,
                           exit_time, result, pnl)
select (t->>'id')::uuid, '${MU}', '${acc}', 'live', 'open', t->>'symbol',
       '${s.market === 'binary' ? 'binary_option' : 'futures'}', t->>'direction', coalesce((t->>'qty')::numeric, 1), (t->>'stake')::numeric,
       (t->>'entry')::timestamptz, (t->>'expires')::timestamptz, null, 'pending', null
from jsonb_array_elements(${lit(trades)}) t;
insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate)
select (t->>'id')::uuid, '${MU}', 'live', (t->>'entry')::timestamptz, '{}'::jsonb
from jsonb_array_elements(${lit(trades)}) t;
set session_replication_role = origin;
begin;
select public.import_stage(a, '${s.market === 'binary' ? 'ebinex' : 'topone'}', 'UTC', ${lit(rows)}) from public.trading_accounts a where a.id = '${acc}';
select jsonb_agg(jsonb_build_object('rn', r.rn, 'line', r.line, 'code', r.code, 'link', r.link_id, 'grp', r.grp, 'path', r.path,
                                    'entry_time', r.entry_time, 'exit_time', r.exit_time, 'entry_price', r.entry_price) order by r.rn)
from pg_temp.import_rows r;
commit;`;
  const out = lastJson(psql(sql));
  matching.push({
    label: s.label,
    market: s.market,
    trades: trades.map((t) => ({
      id: t.id, symbol: t.symbol, direction: t.direction, entry_time: t.entry, origin: 'live', expires_at: t.expires ?? null,
      quantity: s.market === 'binary' ? null : t.qty ?? null, stake: t.stake ?? null,
    })),
    rows: s.rows.map((r, i) => ({
      rn: out[i].rn, line: r.line, symbol: r.symbol, direction: r.direction, entry_time: out[i].entry_time, exit_time: out[i].exit_time,
      entry_price: out[i].entry_price === null ? null : String(out[i].entry_price), quantity: s.market === 'binary' ? null : r.qty, stake: r.stake ?? null,
      code: out[i].code, path: out[i].path,
    })),
    expected: Object.fromEntries(out.filter((o) => o.link).map((o) => [String(o.rn), o.link])),
  });
});
psql(`delete from public.trades where user_id = '${MU}'; delete from public.trading_accounts where user_id = '${MU}';`);

const out = {
  about:
    'Shared cases for Phase 3c (the breakeven rule, partial exits, stop moves) and the SQL. Inputs are invented; every "expected" was computed by the SQL named in each group (migrations 20261023000001..3 of fase-3c/banco), so the TypeScript test (cases3c.test.ts) checks that both sides give the same answer. Amounts are trimmed of trailing zeros (trim_scale) as the data layer reads them.',
  generatedWith: version,
  builtin,
  resolved: { about: 'rules_check_resolved(json): a version with the optional tenth key "breakeven"', cases: resolved },
  setting: { about: 'rules_check_breakeven(market, p): the stored setting {on, by} of MarketRules and AccountRules', cases: setting },
  resolve: {
    about: "rules_resolve(market, day tz, day start, market rules (null = builtin), '[]', own, null, '[\"us\"]'): the whole resolved value",
    cases: resolve,
  },
  favor: { about: 'trade_favor(trade_instrument(market, symbol, option), sgn, entry, price), trimmed', cases: favor },
  tradeBreakeven: { about: 'trade_breakeven(resolved, market, symbol, option?, direction, entry)', cases: tradeBreakeven },
  rOf: { about: 'trade_r_of(entry, stop, sgn, position, exits), trimmed', cases: rOf },
  shape: { about: "trade_check_payload(mode, market, p, dry, platform): mode 'partial'; «Já fechada» with exits and breakeven", cases: shape },
  matching: {
    about:
      'import_stage (3c): the rows of one broker position (same symbol as written, side, open instant and open price, with an exit not before the open; never binaries) link as a whole (rn → trade id); every trade is an app trade registered live without a broker ID. "path" is import_stage\'s (row, group).',
    scenarios: matching,
  },
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.error(`wrote ${OUT}: resolved ${resolved.length}, setting ${setting.length}, resolve ${resolve.length}, favor ${favor.length}, tradeBreakeven ${tradeBreakeven.length}, rOf ${rOf.length}, shape ${shape.length}`);

// Generates app/__tests__/domain/registro/cases3c.json: invented inputs, every "expected" computed by
// the SQL of the Phase 3c migrations (20261023000001..3 of fase-3c/banco) on a throwaway cluster.
// Never the hosted project.
//   node gen3c.mjs <psql url> <gate cases.json> <out file>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [URL, GATE, OUT] = process.argv.slice(2);
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
const SP = 'America/Sao_Paulo';
const CK = '3c0d7e1f-2a4b-4c6d-8e9f-a0b1c2d3e4f5';

// ---------------------------------------------------------------------------------------------
// rules_is_dist («+N»)
// ---------------------------------------------------------------------------------------------
const distCases = [8, 7.5, 0.25, 30, 0, -1, -0.5, 1e-8, 1e-9, 2.5e-7, 1000000, 999999.99999999, 1000000.5, 1000001, 0.123456789,
  0.12345678, 0.1 + 0.2, 1e21, '8', null, true, [], {}].map((x) => ({ x }));
const dist = each(distCases, `to_jsonb(public.rules_is_dist(c->'x'))`);

// ---------------------------------------------------------------------------------------------
// rules_check_breakeven (the stored setting {on, by} of MarketRules and AccountRules)
// ---------------------------------------------------------------------------------------------
const assets = (k, n = 1) => Object.fromEntries(Array.from({ length: k }, (_, i) => [`A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`, n]));
const settingCases = [];
const fut = (p, label) => settingCases.push({ label, market: 'futures', p });
fut({ on: true, by: { MES: 8, MNQ: 30, MGC: 5 } }, 'the boards’ rule');
fut({ on: false, by: {} }, 'off, no asset');
fut({ on: false, by: { MES: 8 } }, 'off, the values kept');
fut({ on: true, by: {} }, 'on, no asset');
fut({ on: true, by: { ES: 2.5, GC: 1, CL: 0.1, ZN: 0.015625 } }, 'roots of the table and outside it');
fut({ on: true, by: { ZZZ: 1 } }, 'a root no table knows');
fut({ on: true, by: { MESZ5: 1 } }, 'a contract month');
fut({ on: true, by: { mes: 1 } }, 'lower case');
fut({ on: true, by: { 'M ES': 1 } }, 'a space');
fut({ on: true, by: { ['A'.repeat(21)]: 1 } }, '21 letters');
fut({ on: true, by: { MES: 0 } }, 'zero');
fut({ on: true, by: { MES: -1 } }, 'negative');
fut({ on: true, by: { MES: '8' } }, 'a string');
fut({ on: true, by: { MES: null } }, 'null');
fut({ on: true, by: { MES: 1.123456789 } }, 'nine decimals');
fut({ on: true, by: { MES: 0.00000001 } }, 'the smallest');
fut({ on: true, by: { MES: 1000000 } }, 'the largest');
fut({ on: true, by: { MES: 1000000.01 } }, 'above the largest');
fut({ on: true, by: assets(20) }, 'twenty assets');
fut({ on: true, by: assets(21) }, 'twenty-one assets');
fut({ on: true, by: {}, favor: 8 }, 'another key');
fut({ on: 'sim', by: {} }, 'on not a boolean');
fut({ on: true }, 'no by');
fut({ by: {} }, 'no on');
fut({ on: true, by: [] }, 'by an array');
fut('x', 'a string');
fut(null, 'null');
fut([], 'an array');
for (const [market, p, label] of [
  ['b3', { on: true, by: { WIN: 150, WDO: 3, PETR4: 0.3, BOVA11: 0.05 } }, 'futures roots and shares'],
  ['b3', { on: true, by: { WINZ26: 1 } }, 'a contract month'],
  ['b3', { on: true, by: { PETR4F: 1 } }, 'the fractional market'],
  ['forex', { on: true, by: { EURUSD: 7.5, USDJPY: 10, XAUUSD: 1.2 } }, 'pairs'],
  ['forex', { on: true, by: { 'EUR/USD': 1 } }, 'with a slash'],
  ['crypto', { on: true, by: { BTCUSDT: 100, ETHBTC: 0.0001 } }, 'pairs'],
  ['crypto', { on: true, by: { 'BTC/USDT': 100 } }, 'with a slash'],
  ['stocks', { on: true, by: { AAPL: 0.5, MSFT: 1 } }, 'tickers'],
  ['stocks', { on: true, by: { 'BRK.B': 1 } }, 'a dot'],
  ['options', { on: true, by: { SPX: 1, AAPL: 0.5 } }, 'underlyings'],
  ['binary', { on: true, by: {} }, 'binaries never'],
  ['binary', 'x', 'binaries before the shape'],
  ['xyz', { on: true, by: {} }, 'an unknown market'],
]) settingCases.push({ label, market, p });
const setting = each(settingCases, `to_jsonb(public.rules_check_breakeven(c->>'market', c->'p'))`);

// ---------------------------------------------------------------------------------------------
// rules_check_resolved with the tenth key
// ---------------------------------------------------------------------------------------------
const gate = JSON.parse(fs.readFileSync(GATE, 'utf8'));
const base = {};
for (const c of gate.resolved.cases) {
  if (c.expected === null && c.json && !base[c.json.market]) base[c.json.market] = c.json;
}
for (const m of ['futures', 'binary', 'forex', 'crypto', 'stocks', 'b3', 'options']) if (!base[m]) throw new Error(`no base ${m}`);
const resolvedCases = [];
const rv = (market, breakeven, label, extra = {}) =>
  resolvedCases.push({ label, json: { ...base[market], ...(breakeven === undefined ? {} : { breakeven }), ...extra } });
const by = (o) => ({ by: o });
rv('futures', undefined, 'nine keys');
rv('futures', by({ MES: { n: 8, un: 'pts' }, MNQ: { n: 30, un: 'pts' }, MGC: { n: 7.5, un: 'pts' } }), 'the boards’ rule');
rv('futures', by({ MES: { n: 8, un: 'pips' } }), 'a unit that is not today’s');
rv('futures', by({ MES: { n: 8, un: 'price' } }), 'price units');
rv('futures', null, 'null');
rv('futures', 'x', 'a string');
rv('futures', by({}), 'no asset');
rv('futures', { by: { MES: { n: 8, un: 'pts' } }, on: true }, 'on beside by');
rv('futures', {}, 'no by');
rv('futures', by([]), 'by an array');
rv('futures', by({ MESZ5: { n: 8, un: 'pts' } }), 'a contract month');
rv('futures', by({ mes: { n: 8, un: 'pts' } }), 'lower case');
rv('futures', by({ MES: { n: 0, un: 'pts' } }), 'zero');
rv('futures', by({ MES: { n: '8', un: 'pts' } }), 'n a string');
rv('futures', by({ MES: { n: 8 } }), 'no unit');
rv('futures', by({ MES: { un: 'pts' } }), 'no n');
rv('futures', by({ MES: { n: 8, un: 'ticks' } }), 'ticks');
rv('futures', by({ MES: { n: 8, un: 8 } }), 'a number unit');
rv('futures', by({ MES: { n: 0.123456789, un: 'pts' } }), 'nine decimals');
rv('futures', by({ MES: { n: 1000000.5, un: 'pts' } }), 'too large');
rv('futures', by({ MES: { n: 8, un: 'pts', x: 1 } }), 'a third key');
rv('futures', by({ MES: 8 }), 'the setting’s form');
rv('futures', by(Object.fromEntries(Object.keys(assets(20)).map((k) => [k, { n: 1, un: 'price' }]))), 'twenty assets');
rv('futures', by(Object.fromEntries(Object.keys(assets(21)).map((k) => [k, { n: 1, un: 'price' }]))), 'twenty-one assets');
rv('futures', undefined, 'the tenth key under another name', { be: by({ MES: { n: 8, un: 'pts' } }) });
rv('binary', by({ EURUSD: { n: 5, un: 'pips' } }), 'binaries never');
rv('forex', by({ EURUSD: { n: 7.5, un: 'pips' }, XAUUSD: { n: 1.2, un: 'price' } }), 'pips and price');
rv('forex', by({ 'EUR/USD': { n: 7.5, un: 'pips' } }), 'a slash');
rv('crypto', by({ BTCUSDT: { n: 100, un: 'price' } }), 'a coin');
rv('stocks', by({ AAPL: { n: 0.5, un: 'price' } }), 'a share');
rv('b3', by({ WIN: { n: 150, un: 'pts' }, PETR4: { n: 0.3, un: 'price' } }), 'a root and a share');
rv('b3', by({ WINZ26: { n: 150, un: 'pts' } }), 'a contract month');
rv('options', by({ SPX: { n: 1, un: 'price' } }), 'an underlying');
const resolved = each(resolvedCases, `to_jsonb(public.rules_check_resolved(c->'json'))`);

// ---------------------------------------------------------------------------------------------
// rules_resolve: what a setting puts in a version
// ---------------------------------------------------------------------------------------------
const resolveCases = [];
const rr = (label, market, marketSetting, ownSetting) => resolveCases.push({ label, market, market_setting: marketSetting, own_setting: ownSetting });
rr('never set', 'futures', null, null);
rr('the market’s, on', 'futures', { on: true, by: { MES: 8, MNQ: 30, MGC: 5 } }, null);
rr('the market’s, off', 'futures', { on: false, by: { MES: 8 } }, null);
rr('on with no asset', 'futures', { on: true, by: {} }, null);
rr('the account’s own replaces the market’s', 'futures', { on: true, by: { MES: 8 } }, { on: true, by: { MNQ: 25.5 } });
rr('the account’s own off', 'futures', { on: true, by: { MES: 8 } }, { on: false, by: { MES: 8 } });
rr('the account’s own, the market never set', 'futures', null, { on: true, by: { MES: 10 } });
rr('roots outside the table take price', 'futures', { on: true, by: { ZN: 0.015625, ZZZ: 1, ES: 2.25 } }, null);
rr('the smallest and the largest', 'futures', { on: true, by: { MES: 1e-8, MNQ: 1000000 } }, null);
rr('forex in pips, gold', 'forex', { on: true, by: { EURUSD: 7.5, USDJPY: 10, XAUUSD: 1.2 } }, null);
rr('crypto', 'crypto', { on: true, by: { BTCUSDT: 100.5 } }, null);
rr('stocks', 'stocks', { on: true, by: { AAPL: 0.5 } }, null);
rr('b3', 'b3', { on: true, by: { WIN: 150, WDO: 3, PETR4: 0.3 } }, null);
rr('options: an underlying, in price units', 'options', { on: true, by: { SPX: 1 } }, null);
rr('binaries never', 'binary', { on: true, by: { EURUSD: 5 } }, null);
const resolve = each(
  resolveCases,
  `public.rules_resolve(c->>'market', 'America/New_York', 1080,
     case when jsonb_typeof(c->'market_setting') = 'object' then jsonb_build_object('v', 1, 'breakeven', c->'market_setting') else '{"v": 1}'::jsonb end,
     '[]'::jsonb,
     case when jsonb_typeof(c->'own_setting') = 'object' then jsonb_build_object('v', 1, 'breakeven', c->'own_setting') else '{"v": 1}'::jsonb end,
     null, '[]'::jsonb) -> 'breakeven'`,
);

// ---------------------------------------------------------------------------------------------
// trade_check_payload: mode 'partial'; "exits" and "breakeven" in mode 'after'
// ---------------------------------------------------------------------------------------------
const shapeCases = [];
const sh = (label, mode, market, payload, dry = false, platform = null) => shapeCases.push({ label, mode, market, dry, payload, platform });
const part = (x = {}) => ({ v: 1, client_key: CK, quantity: '1', exit_price: '7910.25', ...x });
sh('a partial', 'partial', 'futures', part());
sh('with its hour', 'partial', 'futures', part({ exit: '10:20', clock: NY }));
sh('with a typed result', 'partial', 'futures', part({ pnl: '-37.5' }));
sh('a dry run without client_key', 'partial', 'futures', part({ client_key: undefined }), true);
sh('without client_key', 'partial', 'futures', part({ client_key: undefined }));
sh('client_key not a uuid', 'partial', 'futures', part({ client_key: 'abc' }));
sh('quantity a number', 'partial', 'futures', part({ quantity: 1 }));
sh('no quantity', 'partial', 'futures', part({ quantity: undefined }));
sh('no price', 'partial', 'futures', part({ exit_price: undefined }));
sh('price a number', 'partial', 'futures', part({ exit_price: 7910.25 }));
sh('an hour without clock', 'partial', 'futures', part({ exit: '10:20' }));
sh('an hour 25:00', 'partial', 'futures', part({ exit: '25:00', clock: NY }));
sh('another clock', 'partial', 'futures', part({ exit: '10:20', clock: 'Europe/London' }));
sh('pnl with three decimals', 'partial', 'futures', part({ pnl: '12.345' }));
sh('«Custos» go on the final exit', 'partial', 'forex', part({ costs: '1.5' }));
sh('a symbol', 'partial', 'futures', part({ symbol: 'MES' }));
sh('v 2', 'partial', 'futures', part({ v: 2 }));
sh('not an object', 'partial', 'futures', ['x']);
sh('a forex partial', 'partial', 'forex', part({ quantity: '0.5', exit_price: '1.08575' }));
sh('a crypto partial', 'partial', 'crypto', part({ quantity: '0.015', exit_price: '60123.45' }));
sh('a B3 partial', 'partial', 'b3', part({ quantity: '100', exit_price: '30.8' }));
sh('an options partial', 'partial', 'options', part({ quantity: '1', exit_price: '2.35' }));
sh('a binary partial', 'partial', 'binary', part());
sh('a binary partial with an outcome only', 'partial', 'binary', { v: 1, client_key: CK, outcome: 'ganho' });
sh('an unknown market', 'partial', 'xyz', part());

const after = (x = {}) => ({
  v: 1, client_key: CK, symbol: 'MES', direction: 'long', quantity: '3', entry_price: '7900', stop_price: '7890', clock: NY,
  day: '2026-10-21', entry: '10:05', ...x,
});
const two = [{ quantity: '1', exit_price: '7910', exit: '10:20' }, { quantity: '2', exit_price: '7920', exit: '10:35' }];
sh('two exits', 'after', 'futures', after({ exits: two }));
sh('two exits and the breakeven', 'after', 'futures', after({ exits: two, breakeven: { price_then: '7912.5' } }));
sh('one exit and the breakeven', 'after', 'futures', after({ exit: '10:35', exit_price: '7920', breakeven: { price_then: '7912.5' } }));
sh('exits beside exit', 'after', 'futures', after({ exits: two, exit: '10:35' }));
sh('exits beside exit_price', 'after', 'futures', after({ exits: two, exit_price: '7920' }));
sh('exits beside pnl', 'after', 'futures', after({ exits: two, pnl: '100' }));
sh('one item', 'after', 'futures', after({ exits: [two[0]] }));
sh('twenty items', 'after', 'futures', after({ exits: Array.from({ length: 20 }, () => two[0]) }));
sh('twenty-one items', 'after', 'futures', after({ exits: Array.from({ length: 21 }, () => two[0]) }));
sh('exits an object', 'after', 'futures', after({ exits: { a: two[0] } }));
sh('an item a string', 'after', 'futures', after({ exits: [two[0], 'x'] }));
sh('an item with another key', 'after', 'futures', after({ exits: [two[0], { ...two[1], stop_price: '7890' }] }));
sh('«Custos» on futures', 'after', 'futures', after({ exits: [two[0], { ...two[1], costs: '1' }] }));
sh('«Custos» on forex', 'after', 'forex', after({ symbol: 'EUR/USD', quantity: '1', entry_price: '1.085', stop_price: '1.084', exits: [{ quantity: '0.5', exit_price: '1.086', exit: '10:20', costs: '3.5' }, { quantity: '0.5', exit_price: '1.087', exit: '10:30' }] }));
sh('bad «Custos» on forex', 'after', 'forex', after({ symbol: 'EUR/USD', quantity: '1', entry_price: '1.085', stop_price: '1.084', exits: [{ quantity: '0.5', exit_price: '1.086', exit: '10:20', costs: '-1' }, { quantity: '0.5', exit_price: '1.087', exit: '10:30' }] }));
sh('an item’s quantity a number', 'after', 'futures', after({ exits: [{ ...two[0], quantity: 1 }, two[1]] }));
sh('an item without price', 'after', 'futures', after({ exits: [two[0], { quantity: '2', exit: '10:35' }] }));
sh('an item without hour', 'after', 'futures', after({ exits: [two[0], { quantity: '2', exit_price: '7920' }] }));
sh('an item’s hour 9:5', 'after', 'futures', after({ exits: [two[0], { ...two[1], exit: '9:5' }] }));
sh('an item’s typed result', 'after', 'futures', after({ exits: [two[0], { ...two[1], pnl: '-12.5' }] }));
sh('an item’s bad result', 'after', 'futures', after({ exits: [two[0], { ...two[1], pnl: '1.234' }] }));
sh('exits without clock', 'after', 'futures', after({ exits: two, clock: undefined }));
sh('no exit at all', 'after', 'futures', after());
sh('breakeven a string', 'after', 'futures', after({ exits: two, breakeven: '7912.5' }));
sh('breakeven with another key', 'after', 'futures', after({ exits: two, breakeven: { price_then: '7912.5', favor: '12.5' } }));
sh('breakeven without the price', 'after', 'futures', after({ exits: two, breakeven: {} }));
sh('breakeven price a number', 'after', 'futures', after({ exits: two, breakeven: { price_then: 7912.5 } }));
sh('a binary with exits', 'after', 'binary', { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '10', payout: '87', duration_s: 60, clock: SP, day: '2026-10-21', entry: '10:05', outcome: 'ganho', exits: two });
sh('a binary with the breakeven', 'after', 'binary', { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '10', payout: '87', duration_s: 60, clock: SP, day: '2026-10-21', entry: '10:05', outcome: 'ganho', breakeven: { price_then: '1' } });
sh('an entry with exits', 'entry', 'futures', { ...after({ day: undefined, exits: two }) });
sh('an entry with the breakeven', 'entry', 'futures', { ...after({ day: undefined, breakeven: { price_then: '7912.5' } }) });
sh('an exit with exits', 'exit', 'futures', { v: 1, exit_price: '7920', exits: two });
const shape = each(shapeCases, `public.trade_check_payload(c->>'mode', c->>'market', c->'payload', (c->>'dry')::boolean, c->>'platform')`);

// ---------------------------------------------------------------------------------------------
// trade_qty, trade_favor, trade_r_of, trade_breakeven
// ---------------------------------------------------------------------------------------------
const opt = { right: 'call', strike: '200', expires_on: '2026-11-20' };
const qtyCases = [];
for (const [market, symbol, xs, option] of [
  ['futures', 'MES', ['1', '3', '999999', '1000000', '1.5', '0', '-1', '01', ' 2', '2.0', 2, null, '']],
  ['forex', 'EUR/USD', ['0.01', '0.5', '1.10', '0.015', '0.001', '10']],
  ['crypto', 'BTC/USDT', ['0.00000001', '0.000000001', '0.015', '2']],
  ['stocks', 'AAPL', ['0.123456', '0.1234567', '10']],
  ['b3', 'PETR4', ['100', '100.5']],
  ['b3', 'WINZ26', ['5']],
  ['options', 'SPX', ['1', '1.5'], opt],
]) for (const x of xs) qtyCases.push({ market, symbol, option: option ?? null, x });
const qty = each(qtyCases, `to_jsonb(public.trade_qty(public.trade_instrument(c->>'market', c->>'symbol', case when jsonb_typeof(c->'option') = 'object' then c->'option' end), c->'x')::text)`);

const favorCases = [];
for (const [market, symbol, sgn, entry, price, option] of [
  ['futures', 'MES', 1, '7900', '7908'],
  ['futures', 'MES', 1, '7900', '7895.75'],
  ['futures', 'MES', -1, '7900', '7890'],
  ['futures', 'MNQ', 1, '20100.5', '20130.5'],
  ['futures', 'ZN', 1, '110.5', '110.515625'],
  ['futures', 'ZZZ', -1, '50', '49.5'],
  ['forex', 'EUR/USD', 1, '1.085', '1.08575'],
  ['forex', 'EUR/USD', -1, '1.085', '1.08575'],
  ['forex', 'USD/JPY', -1, '150.25', '150.15'],
  ['forex', 'XAU/USD', 1, '2400.5', '2401.7'],
  ['crypto', 'BTC/USDT', 1, '60000', '60123.45'],
  ['stocks', 'AAPL', -1, '200', '199.5'],
  ['b3', 'WINZ26', 1, '120000', '120150'],
  ['b3', 'PETR4', 1, '30.5', '30.8'],
  ['options', 'SPX', 1, '2.1', '2.35', opt],
  ['futures', 'MES', 1, '7900', '7900'],
]) favorCases.push({ market, symbol, option: option ?? null, sgn, entry, price });
const favor = each(
  favorCases,
  `to_jsonb(trim_scale(public.trade_favor(public.trade_instrument(c->>'market', c->>'symbol', case when jsonb_typeof(c->'option') = 'object' then c->'option' end),
     (c->>'sgn')::int, (c->>'entry')::numeric, (c->>'price')::numeric))::text)`,
);

const rCases = [];
const rc = (label, entry, stop, sgn, position, exits) => rCases.push({ label, entry, stop, sgn, position, exits });
rc('two exits of three', '7900', '7890', 1, '3', [{ quantity: '1', exit_price: '7910' }, { quantity: '2', exit_price: '7920' }]);
rc('one exit of the whole', '7900', '7890', 1, '3', [{ quantity: '3', exit_price: '7920' }]);
rc('a short in three', '20100', '20120', -1, '3', [{ quantity: '1', exit_price: '20080' }, { quantity: '1', exit_price: '20090' }, { quantity: '1', exit_price: '20125' }]);
rc('a loss', '7900', '7890', 1, '2', [{ quantity: '1', exit_price: '7895' }, { quantity: '1', exit_price: '7890' }]);
rc('forex lots', '1.085', '1.084', 1, '1', [{ quantity: '0.33', exit_price: '1.0865' }, { quantity: '0.67', exit_price: '1.08575' }]);
rc('a thirds rounding', '100', '97', 1, '3', [{ quantity: '1', exit_price: '101' }, { quantity: '1', exit_price: '101' }, { quantity: '1', exit_price: '102' }]);
rc('no stop', '7900', null, 1, '3', [{ quantity: '3', exit_price: '7920' }]);
rc('the stop at the entry', '7900', '7900', 1, '3', [{ quantity: '3', exit_price: '7920' }]);
rc('no position', '7900', '7890', 1, '0', [{ quantity: '3', exit_price: '7920' }]);
rc('no exit', '7900', '7890', 1, '3', []);
rc('an exit without price', '7900', '7890', 1, '3', [{ quantity: '1', exit_price: '7910' }, { quantity: '2', exit_price: null }]);
rc('no entry', null, '7890', 1, '3', [{ quantity: '3', exit_price: '7920' }]);
const rOf = each(
  rCases,
  `to_jsonb(trim_scale(public.trade_r_of((c->>'entry')::numeric, (c->>'stop')::numeric, (c->>'sgn')::int, (c->>'position')::numeric,
     (select jsonb_agg(jsonb_build_object('quantity', (x->>'quantity')::numeric, 'exit_price', (x->>'exit_price')::numeric) order by o)
      from jsonb_array_elements(c->'exits') with ordinality as y(x, o))))::text)`,
);

const RULE = { by: { MES: { n: 8, un: 'pts' }, MNQ: { n: 30, un: 'pts' }, MGC: { n: 7.5, un: 'pts' } } };
const FX = { by: { EURUSD: { n: 7.5, un: 'pips' }, USDJPY: { n: 10, un: 'pips' }, XAUUSD: { n: 1.2, un: 'price' }, GBPUSD: { n: 5, un: 'price' } } };
const beCases = [];
const bc = (label, breakeven, market, symbol, option, direction, entry) => beCases.push({ label, breakeven, market, symbol, option, direction, entry });
bc('MES long', RULE, 'futures', 'MES', false, 'long', '7900');
bc('a contract month, short', RULE, 'futures', 'MESZ5', false, 'short', '7900.25');
bc('MGC 7.5', RULE, 'futures', 'MGCZ6', false, 'long', '2400.1');
bc('an asset not in the rule', RULE, 'futures', 'ES', false, 'long', '5000');
bc('no rule', null, 'futures', 'MES', false, 'long', '7900');
bc('no side', RULE, 'futures', 'MES', false, null, '7900');
bc('a binary direction', RULE, 'futures', 'MES', false, 'call', '7900');
bc('no entry', RULE, 'futures', 'MES', false, 'long', null);
bc('an option contract', { by: { AAPL: { n: 0.5, un: 'price' } } }, 'stocks', 'AAPL', true, 'long', '2.1');
bc('a share', { by: { AAPL: { n: 0.5, un: 'price' } } }, 'stocks', 'AAPL', false, 'short', '200');
bc('EURUSD in pips', FX, 'forex', 'EUR/USD', false, 'long', '1.085');
bc('USDJPY in pips, short', FX, 'forex', 'USD/JPY', false, 'short', '150.25');
bc('gold in price', FX, 'forex', 'XAU/USD', false, 'long', '2400.5');
bc('a price unit on a pair with a pip', FX, 'forex', 'GBP/USD', false, 'long', '1.3');
bc('B3 root', { by: { WIN: { n: 150, un: 'pts' } } }, 'b3', 'WINZ26', false, 'long', '120000');
bc('B3 share', { by: { PETR4: { n: 0.3, un: 'price' } } }, 'b3', 'PETR4', false, 'short', '30.5');
bc('a binary', { by: { EURUSD: { n: 5, un: 'pips' } } }, 'binary', 'EUR/USD', false, 'call', '1.085');
bc('pips on an asset without a pip', { by: { MES: { n: 8, un: 'pips' } } }, 'futures', 'MES', false, 'long', '7900');
bc('the smallest «+N»', { by: { BTCUSDT: { n: 1e-8, un: 'price' } } }, 'crypto', 'BTC/USDT', false, 'long', '60000');
const breakeven = each(
  beCases,
  `(select case when b is null then 'null'::jsonb else jsonb_build_object('key', b->>'key', 'n', trim_scale((b->>'n')::numeric)::text, 'un', b->>'un',
      'level', trim_scale((b->>'level')::numeric)::text) end
    from (select public.trade_breakeven(case when jsonb_typeof(c->'breakeven') = 'object' then jsonb_build_object('breakeven', c->'breakeven') else '{}'::jsonb end,
      c->>'market', c->>'symbol', (c->>'option')::boolean, c->>'direction', (c->>'entry')::numeric) as b) x)`,
);

const out = {
  about:
    'Shared cases for Phase 3c (partial exits, «Mover stop», the breakeven rule) in app/lib/domain (gate/rules, registro/payload, registro/parciais, registro/breakeven, hub/regras) and the SQL. Inputs are invented; every "expected" was computed by the functions of the Phase 3c migrations (20261023000001..3 of fase-3c/banco) on a throwaway cluster, so the TypeScript test (cases3c.test.ts) checks that both sides give the same answer. Amounts are Postgres text (trim_scale where the TypeScript side gives decimal text without trailing zeros).',
  generatedWith: `PostgreSQL ${version}`,
  dist: { about: 'rules_is_dist(x): «+N» of the breakeven rule', cases: dist },
  setting: { about: 'rules_check_breakeven(market, p): the stored setting {on, by} of MarketRules and AccountRules; a code or null', cases: setting },
  resolved: { about: 'rules_check_resolved(json): a version with the tenth key "breakeven"; a code or null', cases: resolved },
  resolve: { about: 'rules_resolve(market, …, {"v": 1, "breakeven": market_setting}, …, {"v": 1, "breakeven": own_setting}, …) -> \'breakeven\' (null: no key)', cases: resolve },
  shape: { about: 'trade_check_payload(mode, market, payload, dry, platform): mode partial; "exits" and "breakeven" in mode after; {code, field} or null', cases: shape },
  qty: { about: 'trade_qty(trade_instrument(market, symbol, option), x)::text', cases: qty },
  favor: { about: 'trim_scale(trade_favor(trade_instrument(market, symbol, option), sgn, entry, price))::text', cases: favor },
  rOf: { about: 'trim_scale(trade_r_of(entry, stop, sgn, position, exits))::text (exits as numbers)', cases: rOf },
  breakeven: { about: 'trade_breakeven({"breakeven": breakeven}, market, symbol, option, direction, entry), n and level trim_scale’d text', cases: breakeven },
};
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${OUT}: ${Object.entries(out).filter(([, v]) => v && v.cases).map(([k, v]) => `${k} ${v.cases.length}`).join(', ')}`);

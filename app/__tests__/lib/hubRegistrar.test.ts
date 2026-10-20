/**
 * @jest-environment node
 *
 * lib/hub/registrar (which accounts, the form's starting values, today's trading day, the exit
 * banner) and lib/hub/relogio (the server's clock on the device).
 */
import fs from 'fs';
import path from 'path';
import { ACCOUNT_MARKETS } from '@/lib/domain/markets';
import type { LimitCheck } from '@/lib/domain/gate';
import {
  CONTRACT_CHIPS,
  FUTURES_CHIPS,
  REGISTRAR_MARKETS,
  avisoDoLimite,
  diaDeHoje,
  inicioDoDia,
  padroesDoRegistrar,
  podeRegistrar,
  type RecentTrade,
} from '@/lib/hub/registrar';
import { msUntil, newestClock, serverClockOf, serverNowFrom } from '@/lib/hub/relogio';
import { agoraTelas, saidaTelas } from '@/testing/registrarTelas';

describe('which accounts get «Registrar operação» (3-4 ends D36)', () => {
  it('every market: Futuros and binárias since 3-3; Forex, Ações e opções, Cripto, B3 and options since 3-4', () => {
    expect(REGISTRAR_MARKETS).toEqual(ACCOUNT_MARKETS);
    expect(ACCOUNT_MARKETS.filter(podeRegistrar)).toEqual(['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']);
    expect(podeRegistrar(null)).toBe(false);
    expect(podeRegistrar(undefined)).toBe(false);
    expect(podeRegistrar('cfd' as never)).toBe(false);
    expect(FUTURES_CHIPS).toEqual(['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC']);
    expect(CONTRACT_CHIPS).toEqual(['1', '2', '3']);
  });

  it('no interim text of D36 is left in app/components or app/lib («, na Fase 3», «que chega na Fase 3»)', () => {
    const arquivos = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const raiz = path.join(__dirname, '../..');
    const lidos = [...arquivos(path.join(raiz, 'components')), ...arquivos(path.join(raiz, 'lib'))];
    expect(lidos.length).toBeGreaterThan(50);
    const sobra = lidos.filter((f) => /, na Fase 3|que chega na Fase 3/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(raiz, f));
    expect(sobra).toEqual([]);
    // The approved texts that name a phase stay: the before-«desde» text of the new markets and the Diário's placeholder
    const registrarCopy = fs.readFileSync(path.join(raiz, 'components/hub/registrar/copy.ts'), 'utf8');
    expect(registrarCopy).toContain('essas operações entram pela importação por colunas, logo depois da Fase 3.');
    expect(fs.readFileSync(path.join(raiz, 'app/(hub)/diario/page.tsx'), 'utf8')).toContain('O Diário chega na Fase 4.');
  });
});

const t = (over: Partial<RecentTrade>): RecentTrade => ({
  symbol: 'MES',
  direction: 'long',
  quantity: '1',
  stake: null,
  payout: null,
  durationS: null,
  source: 'import',
  entryTime: new Date('2026-10-15T14:00:00Z'),
  ...over,
});

describe('the form’s starting values (D5, D6)', () => {
  it('futures: the last root registered in the app wins over an imported one; else the imported root; else MES', () => {
    expect(padroesDoRegistrar('futures', [t({ symbol: 'MNQZ6', quantity: '3' }), t({ symbol: 'GC', source: 'live', quantity: '2' })])).toMatchObject({ symbol: 'GC', quantity: '3' });
    expect(padroesDoRegistrar('futures', [t({ symbol: 'MNQZ6', quantity: '2.00000000' })])).toMatchObject({ symbol: 'MNQ', quantity: '2' });
    expect(padroesDoRegistrar('futures', [t({ symbol: 'CLZ6' })])).toMatchObject({ symbol: 'MES', quantity: '1' });
    expect(padroesDoRegistrar('futures', [])).toEqual({ symbol: 'MES', quantity: '1', pairs: [], payoutBySymbol: {}, stake: null });
  });

  it('a fractional or absurd quantity is not offered', () => {
    expect(padroesDoRegistrar('futures', [t({ quantity: '0.5' }), t({ quantity: '4' })]).quantity).toBe('4');
  });

  it('binary: pairs by use (ties: the latest first), the last payout of each pair, the last stake', () => {
    const recent = [
      t({ symbol: 'GBP/USD', stake: '30.00', payout: null }),
      t({ symbol: 'EUR/USD', stake: '20.00', payout: '88.0000' }),
      t({ symbol: 'GBP/USD', stake: '25.00', payout: '86.5000' }),
      t({ symbol: 'EUR/USD', stake: '20.00', payout: '85.0000' }),
      t({ symbol: 'BTC/USDT', stake: '10.00', payout: '80.0000' }),
    ];
    expect(padroesDoRegistrar('binary', recent)).toEqual({
      symbol: 'GBP/USD',
      quantity: '1',
      pairs: ['GBP/USD', 'EUR/USD', 'BTC/USDT'],
      payoutBySymbol: { 'GBP/USD': '86.5', 'EUR/USD': '88', 'BTC/USDT': '80' },
      stake: '30',
    });
    expect(padroesDoRegistrar('binary', [])).toMatchObject({ symbol: null, pairs: [], stake: null });
  });
});

describe('today’s trading day', () => {
  it('starts at 18:00 ET the day before on futures, at midnight of Brasília on binaries', () => {
    expect(inicioDoDia('2026-10-22', 'futures').toISOString()).toBe('2026-10-21T22:00:00.000Z');
    expect(inicioDoDia('2026-10-22', 'binary').toISOString()).toBe('2026-10-22T03:00:00.000Z');
  });

  it('is rules_now’s when it has the account; else the day clock’s on the server’s now', () => {
    const now = agoraTelas('agora-qui-1031-et');
    const top = { id: now.accounts[0].accountId, market: 'futures' as const };
    expect(diaDeHoje(now, top, new Date('2030-01-01T00:00:00Z'))).toBe('2026-10-22');
    // 19:00 ET on Thursday is Friday's futures day
    expect(diaDeHoje(null, { id: 'x', market: 'futures' }, new Date('2026-10-22T23:00:00Z'))).toBe('2026-10-23');
    expect(diaDeHoje(undefined, { id: 'x', market: 'binary' }, new Date('2026-10-22T23:00:00Z'))).toBe('2026-10-22');
  });
});

describe('the exit banner (D9)', () => {
  const lim = (over: Partial<Extract<LimitCheck, { evaluated: true }>>): LimitCheck => ({
    evaluated: true,
    state: 'ok',
    cents: 40000,
    mode: 'conta',
    atLimit: 'encerrar',
    trades: 1,
    netCents: 0,
    worstCents: 0,
    hitAt: null,
    used: 0,
    near: false,
    ...over,
  });
  const day = '2026-10-22';
  const exitAt = new Date('2026-10-22T14:40:05Z');
  const base = { market: 'futures' as const, tradeDay: day, exitAt, pref80: true };

  it('«atingido» only when this exit crossed the limit (always shown, whatever the preference)', () => {
    const after = { tradingDay: day, limit: lim({ state: 'atingido', worstCents: -50500, hitAt: exitAt, near: true }) };
    expect(avisoDoLimite({ ...base, pref80: false, before: { tradingDay: day, limit: lim({ worstCents: -34500, near: true }) }, after })).toEqual({
      tipo: 'atingido',
      hitAt: exitAt,
      worstCents: -50500,
      limitCents: 40000,
      currency: 'USD',
      atLimit: 'encerrar',
    });
    expect(avisoDoLimite({ ...base, before: { tradingDay: day, limit: lim({ state: 'atingido', worstCents: -45000 }) }, after })).toBeNull();
  });

  it('without the state before: crossed only when the gate’s hitAt is this exit', () => {
    const after = { tradingDay: day, limit: lim({ state: 'atingido', worstCents: -50500, hitAt: exitAt }) };
    expect(avisoDoLimite({ ...base, before: null, after })).toMatchObject({ tipo: 'atingido' });
    expect(avisoDoLimite({ ...base, before: null, after: { tradingDay: day, limit: lim({ state: 'atingido', hitAt: new Date('2026-10-22T14:31:00Z') }) } })).toBeNull();
    // A stale snapshot of another day counts as unknown
    expect(avisoDoLimite({ ...base, before: { tradingDay: '2026-10-21', limit: lim({}) }, after })).toMatchObject({ tipo: 'atingido' });
  });

  it('«oitenta» only with the preference on, when this exit crossed 80 % and the limit still holds', () => {
    const after = { tradingDay: day, limit: lim({ worstCents: -34500, near: true }) };
    const before = { tradingDay: day, limit: lim({ worstCents: -24500, near: false }) };
    expect(avisoDoLimite({ ...base, before, after })).toEqual({ tipo: 'oitenta', worstCents: -34500, limitCents: 40000, currency: 'USD' });
    expect(avisoDoLimite({ ...base, pref80: false, before, after })).toBeNull();
    expect(avisoDoLimite({ ...base, before: { tradingDay: day, limit: lim({ worstCents: -33000, near: true }) }, after })).toBeNull();
    expect(avisoDoLimite({ ...base, before: null, after })).toBeNull();
  });

  it('nothing for a trade of another trading day, a repeated tap, or an account without a limit', () => {
    const after = { tradingDay: day, limit: lim({ state: 'atingido', hitAt: exitAt }) };
    expect(avisoDoLimite({ ...base, tradeDay: '2026-10-21', before: null, after })).toBeNull();
    expect(avisoDoLimite({ ...base, before: null, after: null })).toBeNull();
    expect(avisoDoLimite({ ...base, before: null, after: { tradingDay: day, limit: { evaluated: false, state: 'nao_avaliado', reason: 'sem_limite' } } })).toBeNull();
  });

  it('in reais on B3', () => {
    const after = { tradingDay: day, limit: lim({ state: 'atingido', hitAt: exitAt, cents: 50000 }) };
    expect(avisoDoLimite({ ...base, market: 'b3', before: null, after })).toMatchObject({ currency: 'BRL', limitCents: 50000 });
  });

  it('on the recorded exits of scenario 10', () => {
    const before = agoraTelas('agora-qui-1031-et').accounts[0].gate;
    const mes = saidaTelas('exit-mes-oitenta');
    expect(avisoDoLimite({ ...base, before, after: mes.gateNow, exitAt: mes.exit!.exitAt })).toMatchObject({ tipo: 'oitenta' });
  });
});

describe('the server’s clock on the device', () => {
  it('is the device clock plus the last answer’s offset; the newest answer wins', () => {
    const a = serverClockOf(new Date('2026-10-22T14:31:05Z'), Date.parse('2026-10-22T14:31:00Z'));
    expect(a).toEqual({ offsetMs: 5000, receivedAt: Date.parse('2026-10-22T14:31:00Z') });
    expect(serverNowFrom(a, Date.parse('2026-10-22T14:32:00Z')).toISOString()).toBe('2026-10-22T14:32:05.000Z');
    expect(serverNowFrom(null, 1000).getTime()).toBe(1000);
    const b = serverClockOf(new Date('2026-10-22T14:31:01Z'), Date.parse('2026-10-22T14:31:01Z'));
    expect(newestClock(a, b)).toBe(b);
    expect(newestClock(b, a)).toBe(b);
    expect(newestClock(null, a)).toBe(a);
    expect(newestClock(undefined, null)).toBeNull();
  });

  it('counts the wait for an instant on the server’s clock', () => {
    const c = serverClockOf(new Date('2026-10-22T23:11:30Z'), Date.parse('2026-10-22T23:11:00Z'));
    expect(msUntil(new Date('2026-10-22T23:12:00Z'), c, Date.parse('2026-10-22T23:11:00Z'))).toBe(30000);
  });
});

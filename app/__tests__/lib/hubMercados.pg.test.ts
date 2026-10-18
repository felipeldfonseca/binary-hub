/**
 * @jest-environment node
 *
 * The seven markets on the real SQL (migration 20261019000001), on a throwaway local Postgres.
 * Skipped unless BH_PG_URL points at one: never the hosted project (see testing/pg.ts).
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres npx jest --ci __tests__/lib/hubMercados.pg.test.ts
 *
 * market_caps_all() must hold MARKET_SPEC (the Jest parity test in __tests__/domain/markets.test.ts
 * reads the migration's text; this one asks the database), and an account the hub creates gets its
 * market's day clock and currency from the insert trigger, whatever the insert sends.
 */
import { randomUUID } from 'crypto';
import { ACCOUNT_MARKETS, CREATABLE_MARKETS, MARKET_SPEC, marketCapsJson } from '@/lib/domain/markets';
import { assertTimeZone } from '@/lib/domain/tempo';
import { PG_URL, asUser, asUserExec, codeOf, createAccountAsUser, createAccountRow, psql } from '@/testing/pg';

const describePg = PG_URL ? describe : describe.skip;

describePg('the markets × the real SQL', () => {
  const uid = randomUUID();

  beforeAll(() => {
    psql(`insert into auth.users (id, email) values ('${uid}', 'caps-${uid}@example.test');`);
  });

  afterAll(() => {
    if (PG_URL) psql(`delete from auth.users where id = '${uid}';`);
  });

  it('market_caps_all() holds MARKET_SPEC, and every day clock is a zone both sides compute with', () => {
    const caps = asUser(uid, 'public.market_caps_all()') as Record<string, Record<string, unknown>>;
    expect(caps).toEqual(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, marketCapsJson(MARKET_SPEC[m])])));
    for (const m of ACCOUNT_MARKETS) {
      const tz = MARKET_SPEC[m].day.tz;
      expect(() => assertTimeZone(tz)).not.toThrow();
      expect(psql(`select count(*) from pg_timezone_names where name = '${tz}';`).trim()).toBe('1');
      expect(asUser(uid, `public.market_caps('${m}')`)).toEqual(marketCapsJson(MARKET_SPEC[m]));
    }
    expect(psql(`select public.market_caps('xyz') is null;`).trim()).toBe('t');
  });

  it('createAccount sends the market’s day clock and currency, and the database keeps the same', async () => {
    for (const market of CREATABLE_MARKETS) {
      const input = { market, label: `Conta ${market}`, platform: null, firm: null, external_ref: null, phase: null, size: null, is_primary: false };
      const row = await createAccountRow(uid, input);
      expect(row).toMatchObject({ day_tz: MARKET_SPEC[market].day.tz, day_start_min: MARKET_SPEC[market].day.startMin, currency: MARKET_SPEC[market].currency });
      const id = await createAccountAsUser(uid, input);
      expect(psql(`select day_tz || ' ' || day_start_min || ' ' || currency from public.trading_accounts where id = '${id}';`).trim()).toBe(
        `${MARKET_SPEC[market].day.tz} ${MARKET_SPEC[market].day.startMin} ${MARKET_SPEC[market].currency}`,
      );
    }
  });

  it('ignores a day clock or a currency the client invents', () => {
    const id = asUserExec(
      uid,
      `insert into public.trading_accounts (user_id, market, label, day_tz, day_start_min, currency)
       values ('${uid}', 'b3', 'Clear inventada', 'America/New_York', 1080, 'USD') returning id;`,
    );
    expect(psql(`select day_tz || ' ' || day_start_min || ' ' || currency from public.trading_accounts where id = '${id}';`).trim()).toBe(
      'America/Sao_Paulo 0 BRL',
    );
    // Once created, the API cannot change them
    expect(codeOf(() => asUserExec(uid, `update public.trading_accounts set currency = 'USD' where id = '${id}';`))).toBe('permission');
  });

  it('refuses an options account: valid in the database, never created', () => {
    expect(
      codeOf(() =>
        asUserExec(uid, `insert into public.trading_accounts (user_id, market, label) values ('${uid}', 'options', 'Opções') returning id;`),
      ),
    ).toBe('market_not_creatable');
  });
});

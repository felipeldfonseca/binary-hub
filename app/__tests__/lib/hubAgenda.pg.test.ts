/**
 * @jest-environment node
 *
 * Phase 5-1 («Dados econômicos») against the real SQL of every migration (20261120000001 included), on a throwaway
 * local Postgres whose clock the suite moves. Skipped unless both are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/<db>   a cluster as .claude/ferramentas/pg/pg_run.sh builds it
 *   BH_PG_SHIFT_FILE=/path/shift                        whose server reads its clock shift (seconds) from this file
 *   BH_PG_RECORD=<abs>/app/testing/fixtures/agenda      writes the answers there (testing/agenda.ts reads them)
 *
 * The boards' world (testing/agenda.ts): the December 2026 agenda loaded as the superuser (the daily route's rows),
 * one invented user per rule configuration (REGRAS_QUADRO), each with one Top One (window 10:00–11:00 ET Mon–Fri,
 * US$ 500 that ends the day, 5/10 min), saved through save_rules on Mon 30 Nov. Recorded: rules_now's shape at each
 * «Posso» frame (gate_at, as hubRegras.pg records it), register_entry dry runs at the Registrar frames (an entry «agora»
 * on the moved clock), diario_dia of a day with entries in a wait (Thu 3 Dec) and in a whole day (Thu 10 Dec), and each
 * user's rules_config. Checked: the answers' words (answerOf), the screen read + agendaFor = gate_agenda (the twin
 * through the real tables and RLS), and a non-member: «não conferido» through rules_now, an evaluated block through
 * the security definer paths (register_entry's dry run).
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import { agendaFor, answerOf, parseRules } from '@/lib/domain/gate';
import { entryPayload } from '@/lib/domain/registro';
import { MON_TO_FRI } from '@/lib/domain/tempo';
import { fetchAgendaDoDia } from '@/lib/hub/agendaDb';
import { fetchDia } from '@/lib/hub/diarioDb';
import { parseRulesNow } from '@/lib/hub/regras';
import { newClientKey, parseEntryDryRun, registerEntry } from '@/lib/hub/registrarDb';
import { PG_URL, asUser, callAs, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';
import {
  NY,
  REGRAS_QUADRO,
  RELOGIO_TOP,
  coberturaSql,
  et,
  eventosSql,
  linhasDoQuadro,
  type ConfigQuadro,
} from '@/testing/agenda';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const RECORD = process.env.BH_PG_RECORD;
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

/** Moves the server's clock to `iso` (the real time plus a shift, read by the interposed clock) */
function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

const write = (name: string, json: unknown) => {
  if (RECORD) fs.writeFileSync(`${RECORD}/${name}.json`, JSON.stringify(json, null, 2) + '\n');
};

describePg('Phase 5-1: the agenda in the gate, the Registrar and the Diário (real SQL)', () => {
  const users = {} as Record<ConfigQuadro | 'fora', string>;
  const acc = {} as Record<ConfigQuadro | 'fora', string>;
  const CONFIGS = Object.keys(REGRAS_QUADRO) as ConfigQuadro[];

  /** rules_now's shape for one account at `at` (gate_at, as rules_now builds each entry) */
  const agoraJson = (c: ConfigQuadro | 'fora', at: Date) =>
    asUser(users[c], `jsonb_build_object('server_now', '${at.toISOString()}'::timestamptz, 'accounts', jsonb_build_array(public.gate_at('${acc[c]}', '${at.toISOString()}')))`) as Record<string, unknown>;

  /** The words a rules_now shape answers (answerOf on the parsed gate) */
  const answer = (json: Record<string, unknown>) => answerOf(parseRulesNow(json).accounts[0].gate);

  /** A register_entry dry run «agora» (the clock moved to `at`), its raw answer */
  async function dryRun(c: ConfigQuadro, at: Date, fields: { symbol: string; direction: 'long' | 'short'; quantity: string; entryPrice: string; stop?: string }) {
    setClock(at.toISOString());
    const log: Parameters<typeof pgClient>[1] = [];
    const db = pgClient(users[c], log);
    await db.rpc('register_entry', { p_account: acc[c], p_entry: entryPayload('futures', { ...fields, clock: NY }), p_dry_run: true });
    const raw = log[log.length - 1].answer;
    if (raw.error) throw new Error(`dry run: ${JSON.stringify(raw.error)}`);
    return raw.data as Record<string, unknown>;
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    const ids = Object.values(users).map((u) => `'${u}'`).join(', ');
    if (ids) {
      psql(`delete from public.trades where user_id in (${ids});
delete from auth.users where id in (${ids});
delete from public.profiles where id in (${ids});`);
    }
  });

  it('Mon 30 Nov 12:00 ET: the world loaded (no coverage yet for 9–11 Dec) and one user per configuration', async () => {
    setClock('2026-11-30T17:00:05Z');
    psql(`${eventosSql()}\n${coberturaSql(['2026-12-09', '2026-12-10', '2026-12-11'])}`);
    // The trigger set every instant from the publisher's wall clock (contract §3.2)
    const stored = JSON.parse(psql(`select coalesce(jsonb_agg(jsonb_build_object('code', code, 'at', at, 'day', day) order by at, code), '[]')::text from public.economic_events where source = 'lista';`).trim()) as { code: string; at: string; day: string }[];
    expect(stored.map((r) => [r.code, new Date(r.at).toISOString(), r.day])).toEqual(
      linhasDoQuadro()
        .map((r) => [r.code, r.at.toISOString(), r.day])
        .sort((a, b) => (a[1] as string).localeCompare(b[1] as string) || (a[0] as string).localeCompare(b[0] as string)),
    );

    for (const c of [...CONFIGS, 'fora' as const]) {
      const uid = randomUUID();
      users[c] = uid;
      const email = `dados-${c.replace('_', '-')}-${uid.slice(0, 8)}@example.test`;
      psql(`insert into auth.users (id, email) values ('${uid}', '${email}');
insert into public.profiles (id, email) values ('${uid}', '${email}') on conflict (id) do nothing;
${c === 'fora' ? '' : `insert into public.hub_members (user_id) values ('${uid}');`}`);
      acc[c] = await createAccountAsUser(uid, { market: 'futures', label: 'Top One', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true });
      const cfgQ = c === 'fora' ? {} : REGRAS_QUADRO[c];
      const block = cfgQ.releases || cfgQ.bloco ? { ...cfgQ.bloco, ...(cfgQ.releases ? { releases: cfgQ.releases } : {}) } : undefined;
      asUser(
        uid,
        `public.save_rules(${lit({
          v: 1,
          base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
          accounts: {
            [acc[c]]: {
              rules: { v: 1, window_rule: { on: true, outside: 'fora' }, limit: { usd: 500, mode: 'conta', at_limit: 'encerrar' }, ...(block ? { block } : {}) },
              window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI },
              version: 'force',
            },
          },
        })})`,
      );
      for (const p of c === 'fora' ? [] : REGRAS_QUADRO[c].perdas ?? []) {
        psql(`insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price, quantity, result, pnl, commission, source)
values ('${uid}', '${acc[c]}', 'MESZ6', 'futures', 'long', '${et(p.entrada).toISOString()}', '${et(p.saida).toISOString()}', 7900, ${7900 - p.usd / 5}, 1, 'loss', ${-p.usd}, null, 'after');`);
      }
      if (c !== 'fora') write(`config-${c}`, asUser(uid, 'public.rules_config()'));
    }
    // The long form froze exactly the effective map (CPI «Não opero no dia»)
    const cfg = asUser(users.cpi_dia, 'public.rules_config()') as { accounts: { versions: { resolved: { block: Record<string, unknown> } }[] }[] };
    expect(cfg.accounts[0].versions[0].resolved.block).toEqual({
      on: true,
      before_min: 5,
      after_min: 10,
      calendars: ['us'],
      releases: { cpi: 'dia', ppi: 'volta', payroll: 'volta', pce: 'volta', pib_us: 'volta', varejo_us: 'volta', ism_ind: 'volta', ism_serv: 'volta', fomc_decisao: 'volta', fomc_entrevista: 'volta' },
    });
  });

  it('Thu 10 Dec without the day\'s agenda: «não conferido» (sem_agenda), never «Liberado» green', () => {
    const q12 = agoraJson('cpi_normal', et('2026-12-10 10:05'));
    write('agora-q12-sem-agenda', q12);
    const a12 = answer(q12);
    expect(a12).toMatchObject({ kind: 'liberado', semAgenda: true });
    const q16 = agoraJson('padrao', et('2026-12-10 08:45'));
    write('agora-q16-sem-agenda-fora', q16);
    expect(answer(q16).kind).toBe('fora_janela');
    expect(parseRulesNow(q16).accounts[0].gate.block).toMatchObject({ evaluated: false, reason: 'sem_agenda' });
    psql(coberturaSql());
  });

  it('the «Posso» frames: every answer as the SQL gives it', () => {
    const rec = (name: string, c: ConfigQuadro, at: string) => {
      const json = agoraJson(c, et(at));
      write(name, json);
      return answer(json);
    };
    const q06 = rec('agora-q06-espera-ism', 'padrao', '2026-12-03 10:05');
    expect(q06).toMatchObject({ kind: 'aguardar', until: et('2026-12-03 10:10') });
    expect(rec('agora-q07-depois-cpi', 'cpi_depois', '2026-12-10 08:27')).toMatchObject({ kind: 'aguardar', until: et('2026-12-10 08:40') });
    const q08 = rec('agora-q08-dia-cpi', 'cpi_dia', '2026-12-10 10:05');
    expect(q08).toMatchObject({ kind: 'dia', source: 'dia' });
    const q09 = rec('agora-q09-pce-pib', 'padrao', '2026-12-23 08:27');
    expect(q09).toMatchObject({ kind: 'aguardar', until: et('2026-12-23 08:40') });
    expect((q09 as unknown as { releases: { code: string }[] }).releases.map((r) => r.code)).toEqual(['pce', 'pib_us']);
    expect(rec('agora-q10-liberado', 'cpi_normal', '2026-12-10 10:05')).toMatchObject({ kind: 'liberado', semAgenda: false });
    expect(rec('agora-q11-mais-tarde', 'padrao', '2026-12-03 09:30')).toMatchObject({ kind: 'fora_janela' });
    expect(rec('agora-q15-espera-acabou', 'cpi_depois', '2026-12-10 08:45')).toMatchObject({ kind: 'fora_janela' });
    expect(rec('agora-q17-encerrado-na-espera', 'fed_depois', '2026-12-09 10:45')).toMatchObject({ kind: 'encerrado' });
    // Q17's board: «limite atingido às 10:38»
    expect(JSON.stringify(agoraJson('fed_depois', et('2026-12-09 10:45')))).toContain('"hit_at":"2026-12-09T15:38:00+00:00"');
    // Q41's board: 3 and 15 min saved on the account, «você aguarda das 09:57 às 10:15» on Thu 3 Dec
    const g41 = parseRulesNow(agoraJson('minutos_3_15', et('2026-12-03 09:00'))).accounts[0].gate.block;
    expect(g41.evaluated && g41.today.map((i) => [i.kind, i.start.toISOString(), i.end.toISOString()])).toEqual([['espera', et('2026-12-03 09:57').toISOString(), et('2026-12-03 10:15').toISOString()]]);
    // Q40's board: the rule off and saved: nothing to wait for on CPI day
    expect(parseRulesNow(agoraJson('desligada', et('2026-12-10 08:27'))).accounts[0].gate.block).toMatchObject({ evaluated: false, reason: 'regra_desligada' });
    expect(rec('agora-q18-primeira-espera', 'padrao', '2026-12-03 09:57')).toMatchObject({ kind: 'aguardar', until: et('2026-12-03 10:10') });
    expect(rec('agora-q37-aviso-10min', 'padrao', '2026-12-03 09:50')).toMatchObject({ kind: 'fora_janela' });
    expect(rec('agora-q34-depois-ism', 'ism_depois', '2026-12-03 10:05')).toMatchObject({ kind: 'aguardar', until: et('2026-12-03 10:10') });
    expect(rec('agora-q36-risco', 'risco', '2026-12-03 10:05')).toMatchObject({ kind: 'aguardar' });
    // Q37's block lists the wait to come (the screen arms the 10-minute notice from today[].start)
    const g37 = parseRulesNow(agoraJson('padrao', et('2026-12-03 09:50'))).accounts[0].gate.block;
    expect(g37.evaluated && g37.today.map((i) => [i.kind, i.start.toISOString(), i.end.toISOString()])).toEqual([['espera', et('2026-12-03 09:55').toISOString(), et('2026-12-03 10:10').toISOString()]]);
  });

  it('the screen\'s read + agendaFor = gate_agenda, through the real tables and RLS', async () => {
    for (const [c, at] of [
      ['padrao', '2026-12-03 10:05'],
      ['cpi_dia', '2026-12-10 10:05'],
      ['fed_depois', '2026-12-09 10:45'],
      ['padrao', '2026-12-23 08:27'],
      ['padrao', '2026-12-31 19:00'],
    ] as [ConfigQuadro, string][]) {
      const cfg = asUser(users[c], 'public.rules_config()') as { accounts: { versions: { resolved: unknown }[] }[] };
      const resolved = cfg.accounts[0].versions[0].resolved;
      const sql = callAs(users[c], `public.gate_agenda(${lit(resolved)}, ${lit({ tz: NY, start_min: 1080 })}, '${et(at).toISOString()}')`).data as { code: string; at: string }[] | null;
      const read = await fetchAgendaDoDia(pgClient(users[c]), { calendars: ['us'], clock: RELOGIO_TOP, at: et(at) });
      const ts = agendaFor(parseRules(resolved), RELOGIO_TOP, et(at), read);
      expect(ts && ts.map((e) => [e.code, e.at.toISOString()])).toEqual(sql && sql.map((e) => [e.code, new Date(e.at).toISOString()]));
    }
    // 31 Dec 19:00 ET is the clock day of 1 Jan: no coverage for 1 Jan → null on both sides
    const cfg = asUser(users.padrao, 'public.rules_config()') as { accounts: { versions: { resolved: unknown }[] }[] };
    expect(callAs(users.padrao, `public.gate_agenda(${lit(cfg.accounts[0].versions[0].resolved)}, ${lit({ tz: NY, start_min: 1080 })}, '${et('2026-12-31 19:00').toISOString()}')`)).toEqual({ data: null, error: null });
  });

  it('the Registrar frames: register_entry dry runs «agora» (the warning never blocks)', async () => {
    const q38 = await dryRun('padrao', et('2026-12-03 09:50'), { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7912.25', stop: '4' });
    write('entrada-q38-aviso-10min', q38);
    const q33 = await dryRun('padrao', et('2026-12-03 10:05'), { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7912.25', stop: '4' });
    write('entrada-q33-espera', q33);
    const gate33 = parseEntryDryRun(q33).gate;
    expect(gate33.status).toBe('aguardar');
    expect(gate33.block).toMatchObject({ evaluated: true, state: 'no_bloqueio' });
    write('entrada-q34-depois', await dryRun('ism_depois', et('2026-12-03 10:05'), { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7912.25', stop: '4' }));
    const q35 = await dryRun('cpi_dia', et('2026-12-10 10:05'), { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7912.25', stop: '4' });
    write('entrada-q35-dia', q35);
    expect(parseEntryDryRun(q35).gate.block).toMatchObject({ evaluated: true, state: 'no_bloqueio', active: { kind: 'dia' } });
    write('entrada-q36-dois-avisos', await dryRun('risco', et('2026-12-03 10:05'), { symbol: 'ES', direction: 'long', quantity: '1', entryPrice: '7912.25', stop: '4' }));
  });

  it('a non-member: «não conferido» through rules_now, the evaluated block through the security definer paths', async () => {
    setClock(et('2026-12-03 10:05').toISOString());
    const now = parseRulesNow(asUser(users.fora, 'public.rules_now()'));
    expect(now.accounts[0].gate.block).toMatchObject({ evaluated: false, reason: 'sem_agenda' });
    const log: Parameters<typeof pgClient>[1] = [];
    await pgClient(users.fora, log).rpc('register_entry', {
      p_account: acc.fora,
      p_entry: entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7912.25', clock: NY }),
      p_dry_run: true,
    });
    expect(parseEntryDryRun(log[0].answer.data).gate.block).toMatchObject({ evaluated: true, state: 'no_bloqueio' });
    // and the screen's read comes back empty for them (RLS): agendaFor says not checked
    const read = await fetchAgendaDoDia(pgClient(users.fora), { calendars: ['us'], clock: RELOGIO_TOP, at: et('2026-12-03 10:05') });
    expect(read).toEqual({ rows: [], covered: [] });
  });

  it('the Diário: entries in a wait (Thu 3 Dec) and in a whole day (Thu 10 Dec), as diario_dia answers them', async () => {
    const entrar = async (c: ConfigQuadro, at: string, symbol: string, direction: 'long' | 'short', entryPrice: string) => {
      setClock(et(at).toISOString());
      await registerEntry(pgClient(users[c]), acc[c], entryPayload('futures', { clientKey: newClientKey(), symbol, direction, quantity: '1', entryPrice, stop: '10', target: '20', clock: NY }));
    };
    await entrar('padrao', '2026-12-03 09:57', 'MNQ', 'short', '30950');
    await entrar('padrao', '2026-12-03 10:05', 'MES', 'long', '7912.50');
    setClock(et('2026-12-03 12:00').toISOString());
    const espera = asUser(users.padrao, `public.diario_dia('${acc.padrao}', '2026-12-03')`);
    write('dia-espera', espera);
    const d1 = await fetchDia(pgClient(users.padrao), acc.padrao, '2026-12-03');
    // registered in the app: the frozen gate at the entry carries the evaluated block
    expect(d1.trades.map((t) => (t.gateNow ?? t.gate)?.block)).toEqual([
      expect.objectContaining({ evaluated: true, state: 'no_bloqueio' }),
      expect.objectContaining({ evaluated: true, state: 'no_bloqueio' }),
    ]);

    await entrar('cpi_dia', '2026-12-10 10:05', 'MES', 'long', '7920.00');
    await entrar('cpi_dia', '2026-12-10 10:31', 'MNQ', 'short', '31010');
    setClock(et('2026-12-10 12:00').toISOString());
    write('dia-inteiro', asUser(users.cpi_dia, `public.diario_dia('${acc.cpi_dia}', '2026-12-10')`));
    const d2 = await fetchDia(pgClient(users.cpi_dia), acc.cpi_dia, '2026-12-10');
    expect(d2.trades).toHaveLength(2);
  });
});

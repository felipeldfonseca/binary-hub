/**
 * The boards' world of «Dados econômicos» (Phase 5-1, contract §5) for the screens' tests and visual specs: invented
 * answers in the database's shapes. Lives outside __tests__ so Jest does not run it as a suite. Invented data only.
 *
 * The world: Top One (Futuros), window 10:00–11:00 ET Mon–Fri, 5 min before and 10 after, limit US$ 500 «Encerrar o
 * dia no app»; the agenda of December 2026 as c2 dates it: ISM industrial Tue 1 Dec 10:00, ISM de serviços Thu 3 Dec
 * 10:00, Payroll Fri 4 Dec 08:30, vendas de casas usadas Wed 9 Dec 10:00, the Fed's decision and press conference Wed 9
 * Dec 14:00 and 14:30, CPI Thu 10 Dec 08:30, PCE and PIB dos EUA Wed 23 Dec 08:30 (all New York). The agenda is
 * covered (economic_calendar_days, `us`) from Sat 28 Nov to Thu 31 Dec 2026; any other date has no coverage, so the
 * Phase 4 scenarios (October and November) read «não conferido», as the real app would.
 *
 * Three kinds of answer:
 *   - the agenda reads (lib/hub/agendaDb): computed here from the world's rows, exactly as the reads filter them;
 *   - the gate answers (rules_now shapes, register_entry dry runs, diario_dia): recorded from the real SQL by
 *     __tests__/lib/hubAgenda.pg.test.ts (BH_PG_RECORD=<abs>/app/testing/fixtures/agenda) in fixtures/agenda, one user
 *     per rule configuration (REGRAS_QUADRO), the world's rows above loaded in the throwaway cluster;
 *   - per frame state of contract §5 (ESTADOS_DADOS): the instant, the configuration, whether the agenda is
 *     missing, and the recorded files that state uses.
 */
import fs from 'fs';
import path from 'path';
import type { AgendaRead, AgendaRow, CalendarCode, ReleaseCode, ReleaseMode } from '@/lib/domain/gate';
import { addDays, localToUtc, tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain/tempo';
import { agendaRange } from '@/lib/hub/agendaDb';

export const NY = 'America/New_York';
/** The Top One day clock (18:00 New York) */
export const RELOGIO_TOP: DayClock = { tz: NY, startMin: 1080 };

/** A New York wall clock → the instant ('2026-12-03 10:00') */
export function et(text: string): Date {
  const [d, t] = text.split(' ');
  const [year, month, day] = d.split('-').map(Number);
  const [hour, minute, second = 0] = t.split(':').map(Number);
  return localToUtc({ year, month, day, hour, minute, second }, NY);
}

/** One release of the world, as the daily route writes it (economic_events: source, source_key, local_at, local_tz…) */
export interface EventoDoQuadro {
  code: ReleaseCode;
  title: string;
  /** New York date and wall clock */
  date: string;
  time: string;
}

export const EVENTOS_QUADRO: readonly EventoDoQuadro[] = Object.freeze([
  { code: 'ism_ind', title: 'ISM Manufacturing PMI', date: '2026-12-01', time: '10:00' },
  { code: 'ism_serv', title: 'ISM Services PMI', date: '2026-12-03', time: '10:00' },
  { code: 'payroll', title: 'Employment Situation', date: '2026-12-04', time: '08:30' },
  { code: 'casas_usadas', title: 'Existing-Home Sales', date: '2026-12-09', time: '10:00' },
  { code: 'fomc_decisao', title: 'FOMC Statement', date: '2026-12-09', time: '14:00' },
  { code: 'fomc_entrevista', title: 'FOMC Press Conference', date: '2026-12-09', time: '14:30' },
  { code: 'cpi', title: 'Consumer Price Index', date: '2026-12-10', time: '08:30' },
  { code: 'pce', title: 'Personal Income and Outlays', date: '2026-12-23', time: '08:30' },
  { code: 'pib_us', title: 'Gross Domestic Product', date: '2026-12-23', time: '08:30' },
]);

/** The New York dates the world's `us` agenda covers */
export const COBERTURA_QUADRO = { de: '2026-11-28', ate: '2026-12-31' } as const;

/** Every covered date, in order */
export function diasCobertos(): string[] {
  const out: string[] = [];
  for (let d: string = COBERTURA_QUADRO.de; d <= COBERTURA_QUADRO.ate; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The world's rows as PostgREST answers them (economic_events' screen columns) */
export function linhasJson(): Record<string, unknown>[] {
  return EVENTOS_QUADRO.map((e) => ({
    code: e.code,
    calendar: 'us',
    at: et(`${e.date} ${e.time}`).toISOString().replace('.000Z', '+00:00'),
    was_at: null,
    status: 'agendado',
    day: e.date,
    local_tz: NY,
  }));
}

/** The world's rows as lib/hub/agendaDb parses them */
export function linhasDoQuadro(): AgendaRow[] {
  return EVENTOS_QUADRO.map((e) => ({ code: e.code, calendar: 'us', at: et(`${e.date} ${e.time}`), wasAt: null, status: 'agendado', day: e.date, localTz: NY }));
}

/** The SQL that loads the world in a throwaway cluster (as the cluster's superuser; the trigger sets `at` and `day`) */
export function eventosSql(): string {
  const values = EVENTOS_QUADRO.map(
    (e) => `('lista', '${e.code}:${e.date}', '${e.code}', 'us', '${e.title.replace(/'/g, "''")}', '${e.date} ${e.time}', '${NY}')`,
  );
  return `insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz) values\n  ${values.join(',\n  ')};`;
}

/** The coverage rows of the world's dates (all of them, or those outside `sem`) */
export function coberturaSql(sem: readonly string[] = []): string {
  const values = diasCobertos()
    .filter((d) => !sem.includes(d))
    .map((d) => `('us', '${d}', 'kit')`);
  return `insert into public.economic_calendar_days (calendar, day, source) values\n  ${values.join(',\n  ')}\non conflict do nothing;`;
}

const inRange = (r: AgendaRow, from: Date, to: Date) =>
  (r.at >= from && r.at < to) || (r.wasAt !== null && r.wasAt >= from && r.wasAt < to);

/**
 * What fetchAgendaDoDia answers in the world at `at` (E5): the rows of the gate's range and the coverage of
 * D − 1..D + 1 the world has. `semAgenda`: the day's agenda did not load (no coverage at all).
 */
export function leituraDoDia(at: Date, { semAgenda = false, calendars = ['us'] as readonly CalendarCode[], clock = RELOGIO_TOP } = {}): AgendaRead {
  if (calendars.length === 0) return { rows: [], covered: [] };
  const r = agendaRange(clock, at);
  const covered = semAgenda || !calendars.includes('us') ? [] : r.days.filter((d) => d >= COBERTURA_QUADRO.de && d <= COBERTURA_QUADRO.ate).map((day) => ({ calendar: 'us' as const, day }));
  return { rows: calendars.includes('us') ? linhasDoQuadro().filter((x) => inRange(x, r.from, r.to)) : [], covered };
}

/** What fetchProximosDados answers in the world (E6): the 14 days from `from` */
export function proximosDoQuadro(from: Date, days = 14): AgendaRow[] {
  const to = new Date(from.getTime() + days * 86_400_000);
  return linhasDoQuadro().filter((x) => inRange(x, from, to));
}

/** What fetchDadosDaSemana answers in the world (L6): the open week [start, end) */
export function semanaDoQuadro(start: Date, end: Date): AgendaRow[] {
  return linhasDoQuadro().filter((x) => inRange(x, start, end));
}

/** The Diário's week of `day` (Mon..Sun on the Top One clock) as useDadosDaSemana takes it */
export function semanaDe(day: string, clock: DayClock = RELOGIO_TOP): { weekOf: string; start: Date; end: Date } {
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekOf = addDays(day, -dow);
  return { weekOf, start: tradingDayBounds(weekOf, clock).start, end: tradingDayBounds(addDays(weekOf, 6), clock).end };
}

// ---------------------------------------------------------------------------------------------------------------
// The rule configurations (one invented user each in the PG recording) and the frame states
// ---------------------------------------------------------------------------------------------------------------

export type ConfigQuadro = 'padrao' | 'cpi_depois' | 'cpi_dia' | 'cpi_normal' | 'ism_depois' | 'fed_depois' | 'risco';

/**
 * What each configuration saves on its Top One «só nesta conta» (account_rule_settings.rules.block.releases), and the
 * closed losses of the day it carries (New York instants, US$): everything else is the world's.
 */
export const REGRAS_QUADRO: Readonly<Record<ConfigQuadro, { releases?: Partial<Record<ReleaseCode, ReleaseMode>>; perdas?: readonly { entrada: string; saida: string; usd: number }[] }>> = {
  padrao: {},
  cpi_depois: { releases: { cpi: 'depois' } },
  cpi_dia: { releases: { cpi: 'dia' } },
  cpi_normal: { releases: { cpi: 'normal' } },
  ism_depois: { releases: { ism_serv: 'depois' } },
  // Q17: the Fed «só depois» and −US$ 530 by 10:40 on Wed 9 Dec (limit US$ 500)
  fed_depois: {
    releases: { fomc_decisao: 'depois', fomc_entrevista: 'depois' },
    perdas: [
      { entrada: '2026-12-09 10:02', saida: '2026-12-09 10:20', usd: 300 },
      { entrada: '2026-12-09 10:25', saida: '2026-12-09 10:40', usd: 230 },
    ],
  },
  // Q36: −US$ 345 earlier on Thu 3 Dec (US$ 155 left of the limit)
  risco: { perdas: [{ entrada: '2026-12-03 09:10', saida: '2026-12-03 09:30', usd: 345 }] },
};

/** The frame states of contract §5 */
export type EstadoDados =
  | 'q01-personalizar-padrao'
  | 'q04-personalizar-0830'
  | 'q05-personalizar-personalizado'
  | 'q06-posso-espera-ism'
  | 'q07-posso-depois-cpi'
  | 'q08-posso-dia-cpi'
  | 'q09-posso-pce-pib'
  | 'q10-posso-liberado'
  | 'q11-posso-mais-tarde'
  | 'q12-posso-sem-agenda'
  | 'q15-posso-espera-acabou'
  | 'q16-posso-sem-agenda-fora'
  | 'q17-posso-encerrado-na-espera'
  | 'q18-posso-primeira-espera'
  | 'q19-como-fica-normal'
  | 'q20-como-fica-volta'
  | 'q21-como-fica-depois'
  | 'q22-como-fica-dia'
  | 'q23-como-fica-ism-proximos'
  | 'q24-marca-espera'
  | 'q25-marca-dupla'
  | 'q26-marca-dia'
  | 'q27-plano-espera'
  | 'q28-plano-dia'
  | 'q29-plano-nao-conferido'
  | 'q30-detalhe-espera'
  | 'q31-detalhe-dia'
  | 'q32-dia-etiqueta'
  | 'q33-registrar-espera'
  | 'q34-registrar-depois'
  | 'q35-registrar-dia'
  | 'q36-registrar-dois-avisos'
  | 'q37-aviso-10min-diario'
  | 'q38-aviso-10min-registrar'
  | 'q39-preferencias-aviso'
  | 'q40-personalizar-desligada'
  | 'q41-personalizar-conta-antiga'
  | 'q42-personalizar-etiquetas'
  | 'q43-personalizar-sem-agenda';

export interface EstadoDoQuadro {
  /** The frames that show it */
  quadros: readonly string[];
  /** The frame's instant (the clock pinned to it) */
  agora: Date;
  config: ConfigQuadro;
  /** The day's agenda did not load (no coverage): «não conferido» */
  semAgenda: boolean;
  /** Recorded answers (fixtures/agenda/<name>.json): rules_now of the configuration's Top One; a register_entry dry run; diario_dia */
  fixtures: { agora?: string; entrada?: string; dia?: string };
}

const E = (quadros: string[], agora: string, config: ConfigQuadro, fixtures: EstadoDoQuadro['fixtures'] = {}, semAgenda = false): EstadoDoQuadro => ({
  quadros,
  agora: et(agora),
  config,
  semAgenda,
  fixtures,
});

/**
 * Every state of contract §5. The Personalizar states (L5) carry the configuration their frame saves on the account
 * where it is one of REGRAS_QUADRO; frames whose choice is only a draft (Q04 «Só opero depois dos dados das 08:30», Q05
 * «Personalizado», Q40 off, Q42 «não salvo») start from `padrao` and the screen's test applies its edit (rascunho's
 * actions). The Diário states (L7) take their day from the diario-quadro exporter; the files here are the SQL's
 * answers for the same days.
 */
export const ESTADOS_DADOS: Readonly<Record<EstadoDados, EstadoDoQuadro>> = {
  'q01-personalizar-padrao': E(['Q01', 'Q02', 'Q03'], '2026-12-10 09:00', 'padrao'),
  'q04-personalizar-0830': E(['Q04'], '2026-12-09 09:00', 'padrao'),
  'q05-personalizar-personalizado': E(['Q05'], '2026-12-10 09:00', 'cpi_dia'),
  'q06-posso-espera-ism': E(['Q06', 'Q13'], '2026-12-03 10:05', 'padrao', { agora: 'agora-q06-espera-ism' }),
  'q07-posso-depois-cpi': E(['Q07'], '2026-12-10 08:27', 'cpi_depois', { agora: 'agora-q07-depois-cpi' }),
  'q08-posso-dia-cpi': E(['Q08', 'Q14'], '2026-12-10 10:05', 'cpi_dia', { agora: 'agora-q08-dia-cpi' }),
  'q09-posso-pce-pib': E(['Q09'], '2026-12-23 08:27', 'padrao', { agora: 'agora-q09-pce-pib' }),
  'q10-posso-liberado': E(['Q10'], '2026-12-10 10:05', 'cpi_normal', { agora: 'agora-q10-liberado' }),
  'q11-posso-mais-tarde': E(['Q11'], '2026-12-03 09:30', 'padrao', { agora: 'agora-q11-mais-tarde' }),
  'q12-posso-sem-agenda': E(['Q12'], '2026-12-10 10:05', 'cpi_normal', { agora: 'agora-q12-sem-agenda' }, true),
  'q15-posso-espera-acabou': E(['Q15'], '2026-12-10 08:45', 'cpi_depois', { agora: 'agora-q15-espera-acabou' }),
  'q16-posso-sem-agenda-fora': E(['Q16'], '2026-12-10 08:45', 'padrao', { agora: 'agora-q16-sem-agenda-fora' }, true),
  'q17-posso-encerrado-na-espera': E(['Q17'], '2026-12-09 10:45', 'fed_depois', { agora: 'agora-q17-encerrado-na-espera' }),
  'q18-posso-primeira-espera': E(['Q18'], '2026-12-03 09:57', 'padrao', { agora: 'agora-q18-primeira-espera' }),
  'q19-como-fica-normal': E(['Q19'], '2026-12-10 09:00', 'cpi_normal'),
  'q20-como-fica-volta': E(['Q20'], '2026-12-10 09:00', 'padrao'),
  'q21-como-fica-depois': E(['Q21'], '2026-12-10 09:00', 'cpi_depois'),
  'q22-como-fica-dia': E(['Q22'], '2026-12-10 09:00', 'cpi_dia'),
  'q23-como-fica-ism-proximos': E(['Q23'], '2026-12-03 09:00', 'padrao'),
  'q24-marca-espera': E(['Q24'], '2026-12-03 12:00', 'padrao', { dia: 'dia-espera' }),
  'q25-marca-dupla': E(['Q25'], '2026-12-03 12:00', 'padrao', { dia: 'dia-espera' }),
  'q26-marca-dia': E(['Q26'], '2026-12-10 12:00', 'cpi_dia', { dia: 'dia-inteiro' }),
  'q27-plano-espera': E(['Q27'], '2026-12-03 12:00', 'padrao', { dia: 'dia-espera' }),
  'q28-plano-dia': E(['Q28'], '2026-12-10 12:00', 'cpi_dia', { dia: 'dia-inteiro' }),
  'q29-plano-nao-conferido': E(['Q29'], '2026-11-10 12:00', 'padrao', {}, true),
  'q30-detalhe-espera': E(['Q30'], '2026-12-03 12:00', 'padrao', { dia: 'dia-espera' }),
  'q31-detalhe-dia': E(['Q31'], '2026-12-10 12:00', 'cpi_dia', { dia: 'dia-inteiro' }),
  'q32-dia-etiqueta': E(['Q32'], '2026-12-03 12:00', 'padrao', { dia: 'dia-espera' }),
  'q33-registrar-espera': E(['Q33'], '2026-12-03 10:05', 'padrao', { agora: 'agora-q06-espera-ism', entrada: 'entrada-q33-espera' }),
  'q34-registrar-depois': E(['Q34'], '2026-12-03 10:05', 'ism_depois', { agora: 'agora-q34-depois-ism', entrada: 'entrada-q34-depois' }),
  'q35-registrar-dia': E(['Q35'], '2026-12-10 10:05', 'cpi_dia', { agora: 'agora-q08-dia-cpi', entrada: 'entrada-q35-dia' }),
  'q36-registrar-dois-avisos': E(['Q36'], '2026-12-03 10:05', 'risco', { agora: 'agora-q36-risco', entrada: 'entrada-q36-dois-avisos' }),
  'q37-aviso-10min-diario': E(['Q37'], '2026-12-03 09:50', 'padrao', { agora: 'agora-q37-aviso-10min' }),
  'q38-aviso-10min-registrar': E(['Q38'], '2026-12-03 09:50', 'padrao', { agora: 'agora-q37-aviso-10min', entrada: 'entrada-q38-aviso-10min' }),
  'q39-preferencias-aviso': E(['Q39'], '2026-12-10 08:00', 'padrao'),
  'q40-personalizar-desligada': E(['Q40'], '2026-12-10 09:00', 'padrao'),
  'q41-personalizar-conta-antiga': E(['Q41'], '2026-12-10 09:00', 'padrao'),
  'q42-personalizar-etiquetas': E(['Q42'], '2026-12-10 09:00', 'padrao'),
  'q43-personalizar-sem-agenda': E(['Q43'], '2026-12-10 09:00', 'padrao', {}, true),
};

const DIR = path.join(__dirname, 'fixtures/agenda');

/** A recorded answer (a fresh copy each call); `name` without '.json' */
export function agendaJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

/** The recorded rules_config() of a configuration's user (its one Top One account) */
export const configDoQuadro = (config: ConfigQuadro) => agendaJson(`config-${config}`);

/** E5 in a state: the day's agenda read at the state's instant */
export const agendaDoEstado = (e: EstadoDados): AgendaRead => leituraDoDia(ESTADOS_DADOS[e].agora, { semAgenda: ESTADOS_DADOS[e].semAgenda });

/** E6 in a state: «Próximos dados» from the state's instant (none when the agenda did not load) */
export const proximosDoEstado = (e: EstadoDados): AgendaRow[] => (ESTADOS_DADOS[e].semAgenda ? [] : proximosDoQuadro(ESTADOS_DADOS[e].agora));

/** The recorded rules_now shape of a state (one account: the configuration's Top One) */
export function agoraDoEstado(e: EstadoDados): Record<string, unknown> {
  const name = ESTADOS_DADOS[e].fixtures.agora;
  if (!name) throw new Error(`agoraDoEstado: ${e} has no rules_now`);
  return agendaJson(name);
}

/** The recorded register_entry dry run of a Registrar state */
export function entradaDoEstado(e: EstadoDados): Record<string, unknown> {
  const name = ESTADOS_DADOS[e].fixtures.entrada;
  if (!name) throw new Error(`entradaDoEstado: ${e} has no dry run`);
  return agendaJson(name);
}

/** The recorded diario_dia of a Diário state */
export function diaDoEstado(e: EstadoDados): Record<string, unknown> {
  const name = ESTADOS_DADOS[e].fixtures.dia;
  if (!name) throw new Error(`diaDoEstado: ${e} has no diario_dia`);
  return agendaJson(name);
}

/** The day D of an instant on the Top One clock */
export const diaTop = (at: Date): string => tradingDayOn(at, RELOGIO_TOP);

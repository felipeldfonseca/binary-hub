/**
 * The words of «Dados econômicos» (Phase 5-1), in pt-BR: how each release code is written (c3 §2.2
 * and §6.2), its usual hour (SPEC §2.1, a screen label only: the gate uses each release's own
 * instant), and the labels of the gate's answer (SPEC §5.6 and §7.2). Pure functions, no React.
 *
 * Hours are on the account's window clock (`clock`: an IANA zone, e.g. 'America/New_York'). The day
 * word comes from comparing the instant's date with `now`'s date on that clock, each time the screen
 * draws (SPEC §7.2 «“Amanhã” e a meia-noite»): same date, no word («CPI às 08:30»); the next date,
 * «amanhã» («CPI amanhã às 08:30»); later, the weekday («qui 09:15»). With `outraData` (an entry
 * that is not «now»: `now` is then the entry's instant) neither «hoje» nor «amanhã» is written:
 * another date always takes the weekday.
 */
import { formatHhMm, utcToLocal } from '@/lib/domain';
import type { BlockRelease, ReleaseCode } from '@/lib/domain/gate';

export interface NomeDado {
  /** As a line of the list (c3 §2.2): «CPI», «Decisão do Fed», «Vendas no varejo» */
  nome: string;
  /** Inside a sentence: «CPI», «decisão do Fed», «vendas no varejo» */
  frase: string;
  /** «do CPI», «da decisão do Fed», «das vendas no varejo» */
  doDa: string;
  /** «dia de CPI», «dia de Fed», «dia de inflação prévia» */
  diaDe: string;
  /** The short name of a Diário row (c3 §6.2): «CPI», «Fed», «varejo», «inflação do euro» */
  curto: string;
  /** The short name with its article: «do ISM», «da confiança», «das casas» */
  curtoDoDa: string;
}

const n = (nome: string, frase: string, doDa: string, diaDe: string, curto: string, curtoDoDa: string): NomeDado =>
  Object.freeze({ nome, frase, doDa, diaDe, curto, curtoDoDa });

/** The 20 codes in their forms (c3 §2.2 «Linha na lista», «Numa frase», «dia de …»; §6.2 the short names) */
export const NOMES_DADOS: Readonly<Record<ReleaseCode, NomeDado>> = Object.freeze({
  cpi: n('CPI', 'CPI', 'do CPI', 'dia de CPI', 'CPI', 'do CPI'),
  ppi: n('PPI', 'PPI', 'do PPI', 'dia de PPI', 'PPI', 'do PPI'),
  payroll: n('Payroll', 'Payroll', 'do Payroll', 'dia de Payroll', 'Payroll', 'do Payroll'),
  pce: n('PCE', 'PCE', 'do PCE', 'dia de PCE', 'PCE', 'do PCE'),
  pib_us: n('PIB dos EUA', 'PIB dos EUA', 'do PIB dos EUA', 'dia de PIB dos EUA', 'PIB', 'do PIB'),
  varejo_us: n('Vendas no varejo', 'vendas no varejo', 'das vendas no varejo', 'dia de vendas no varejo', 'varejo', 'do varejo'),
  ism_ind: n('ISM da indústria', 'ISM da indústria', 'do ISM da indústria', 'dia de ISM', 'ISM', 'do ISM'),
  ism_serv: n('ISM de serviços', 'ISM de serviços', 'do ISM de serviços', 'dia de ISM', 'ISM', 'do ISM'),
  fomc_decisao: n('Decisão do Fed', 'decisão do Fed', 'da decisão do Fed', 'dia de Fed', 'Fed', 'do Fed'),
  fomc_entrevista: n('Entrevista do Fed', 'entrevista do Fed', 'da entrevista do Fed', 'dia de Fed', 'Fed', 'do Fed'),
  jolts: n('JOLTS', 'JOLTS', 'do JOLTS', 'dia de JOLTS', 'JOLTS', 'do JOLTS'),
  confianca_us: n(
    'Confiança do consumidor',
    'confiança do consumidor',
    'da confiança do consumidor',
    'dia de confiança do consumidor',
    'confiança',
    'da confiança',
  ),
  casas_novas: n('Vendas de casas novas', 'vendas de casas novas', 'das vendas de casas novas', 'dia de vendas de casas novas', 'casas', 'das casas'),
  casas_usadas: n(
    'Vendas de casas usadas',
    'vendas de casas usadas',
    'das vendas de casas usadas',
    'dia de vendas de casas usadas',
    'casas',
    'das casas',
  ),
  bce_decisao: n('Decisão do BCE', 'decisão do BCE', 'da decisão do BCE', 'dia de BCE', 'BCE', 'do BCE'),
  bce_entrevista: n('Entrevista do BCE', 'entrevista do BCE', 'da entrevista do BCE', 'dia de BCE', 'BCE', 'do BCE'),
  hicp_eu: n(
    'Inflação prévia da zona do euro',
    'inflação prévia da zona do euro',
    'da inflação prévia da zona do euro',
    'dia de inflação prévia',
    'inflação do euro',
    'da inflação do euro',
  ),
  ipca: n('IPCA', 'IPCA', 'do IPCA', 'dia de IPCA', 'IPCA', 'do IPCA'),
  pib_br: n('PIB do Brasil', 'PIB do Brasil', 'do PIB do Brasil', 'dia de PIB do Brasil', 'PIB', 'do PIB'),
  copom: n('Decisão do Copom', 'decisão do Copom', 'da decisão do Copom', 'dia de Copom', 'Copom', 'do Copom'),
});

/**
 * The usual hour of each release on its publisher's clock (SPEC §2.1): a label for when no date is
 * loaded, never an input of the gate. The agenda's lists hold their own hours (a test checks they agree).
 */
export const HORA_HABITUAL: Readonly<Record<ReleaseCode, { hora: string; tz: string }>> = Object.freeze({
  cpi: { hora: '08:30', tz: 'America/New_York' },
  ppi: { hora: '08:30', tz: 'America/New_York' },
  payroll: { hora: '08:30', tz: 'America/New_York' },
  pce: { hora: '08:30', tz: 'America/New_York' },
  pib_us: { hora: '08:30', tz: 'America/New_York' },
  varejo_us: { hora: '08:30', tz: 'America/New_York' },
  ism_ind: { hora: '10:00', tz: 'America/New_York' },
  ism_serv: { hora: '10:00', tz: 'America/New_York' },
  fomc_decisao: { hora: '14:00', tz: 'America/New_York' },
  fomc_entrevista: { hora: '14:30', tz: 'America/New_York' },
  jolts: { hora: '10:00', tz: 'America/New_York' },
  confianca_us: { hora: '10:00', tz: 'America/New_York' },
  casas_novas: { hora: '10:00', tz: 'America/New_York' },
  casas_usadas: { hora: '10:00', tz: 'America/New_York' },
  bce_decisao: { hora: '14:15', tz: 'Europe/Berlin' },
  bce_entrevista: { hora: '14:45', tz: 'Europe/Berlin' },
  hicp_eu: { hora: '11:00', tz: 'Europe/Luxembourg' },
  ipca: { hora: '09:00', tz: 'America/Sao_Paulo' },
  pib_br: { hora: '09:00', tz: 'America/Sao_Paulo' },
  // «cerca de 18:30» (SPEC §2.1: not confirmed)
  copom: { hora: '18:30', tz: 'America/Sao_Paulo' },
});

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export interface OpcoesData {
  /** The instant is about an entry that is not «now»: never «hoje» nor «amanhã» */
  outraData?: boolean;
}

/** '' (same date as now), 'amanhã' (the next date; not with outraData) or the weekday, on the clock */
function diaDe(at: Date, now: Date, clock: string, opts: OpcoesData): string {
  const a = utcToLocal(now, clock);
  const b = utcToLocal(at, clock);
  if (a.date === b.date) return '';
  const days = Math.round((Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)) / 86_400_000);
  return days === 1 && !opts.outraData ? 'amanhã' : WEEKDAYS[b.isoWeekday - 1];
}

const hhmm = (at: Date, clock: string) => formatHhMm(utcToLocal(at, clock).minuteOfDay);

/** « às 08:30», « amanhã às 08:30», « qui às 08:30» */
function asHoras(at: Date, now: Date, clock: string, opts: OpcoesData): string {
  const d = diaDe(at, now, clock, opts);
  return `${d ? ` ${d}` : ''} às ${hhmm(at, clock)}`;
}

/** «A e B» */
const eJunto = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/**
 * The label of a wait (SPEC §5.6): one release «ISM de serviços às 10:00»; two «decisão do BCE às
 * 08:15 e CPI às 08:30», at the same instant «PCE e PIB dos EUA às 08:30» (in the order the answer
 * gives: `at`, then `ord`); three or more «decisão do BCE às 08:15 e mais 2 dados». With the day
 * word of the date rule: «CPI amanhã às 08:30».
 */
export function rotuloDados(releases: readonly BlockRelease[], now: Date, clock: string, opts: OpcoesData = {}): string {
  if (releases.length === 0) return '';
  const first = releases[0];
  if (releases.length >= 3) {
    return `${NOMES_DADOS[first.code].frase}${asHoras(first.at, now, clock, opts)} e mais ${releases.length - 1} dados`;
  }
  if (releases.length === 2 && releases[1].at.getTime() === first.at.getTime()) {
    return `${NOMES_DADOS[first.code].frase} e ${NOMES_DADOS[releases[1].code].frase}${asHoras(first.at, now, clock, opts)}`;
  }
  return releases.map((r) => `${NOMES_DADOS[r.code].frase}${asHoras(r.at, now, clock, opts)}`).join(' e ');
}

/**
 * The label of a whole day (SPEC §7.2): «dia de CPI, às 08:30», «dia de CPI, amanhã às 08:30»; two
 * releases with the same «dia de …» are one («dia de Fed, às 14:00»); two day names «dia de PCE e PIB
 * dos EUA, às 08:30» (c3 §5.2 case 9, in the answer's order); three or more «dia de CPI, às 08:30, e
 * mais 2 dados». The hour is the first release's. With `inicioDoDia` (the start of the account day,
 * the `dia` interval's start) and the release on the next date of the clock, the ending «· o dia da
 * conta começou às 18:00» (SPEC §7.2, from 18:00 to midnight); never for an entry of another date.
 */
export function rotuloDia(
  releases: readonly BlockRelease[],
  now: Date,
  clock: string,
  opts: OpcoesData & { inicioDoDia?: Date } = {},
): string {
  if (releases.length === 0) return '';
  const first = releases[0];
  const nomes = Array.from(new Set(releases.map((r) => NOMES_DADOS[r.code].diaDe)));
  const horas = asHoras(first.at, now, clock, opts);
  const base =
    nomes.length === 1
      ? `${nomes[0]},${horas}`
      : nomes.length === 2
        ? `${nomes[0]} e ${nomes[1].replace(/^dia de /, '')},${horas}`
        : `${nomes[0]},${horas}, e mais ${nomes.length - 1} dados`;
  const comecou = opts.inicioDoDia && !opts.outraData && diaDe(first.at, now, clock, opts) === 'amanhã';
  return comecou ? `${base} · o dia da conta começou às ${hhmm(opts.inicioDoDia!, clock)}` : base;
}

/** The hour a wait ends, for «Aguardar até …»: «08:40», «amanhã às 08:40», «qui 09:15» (SPEC §5.6) */
export function horaDeVolta(freeAt: Date, now: Date, clock: string, opts: OpcoesData = {}): string {
  const d = diaDe(freeAt, now, clock, opts);
  const h = hhmm(freeAt, clock);
  return d === '' ? h : d === 'amanhã' ? `amanhã às ${h}` : `${d} ${h}`;
}

/**
 * The data mark of a Diário row or a Registrar plan line (c3 §6.2): «na espera do ISM», «na
 * espera do PCE e PIB», «na espera de 3 dados» (kind `espera`, also the leftover of a whole day),
 * «em dia de CPI» (kind `dia`); short names, each once. Without the interval: «na espera de dado».
 */
export function marcaDados(interval: { kind: 'espera' | 'dia'; releases: readonly BlockRelease[] } | null): string {
  if (!interval || interval.releases.length === 0) return 'na espera de dado';
  const codes = Array.from(new Map(interval.releases.map((r) => [NOMES_DADOS[r.code].curto, r.code])).values());
  if (interval.kind === 'dia') {
    if (codes.length >= 3) return `em dia de ${codes.length} dados`;
    return `em dia de ${eJunto(codes.map((c) => NOMES_DADOS[c].curto))}`;
  }
  if (codes.length >= 3) return `na espera de ${codes.length} dados`;
  const [a, b] = codes;
  return `na espera ${NOMES_DADOS[a].curtoDoDa}${b ? ` e ${NOMES_DADOS[b].curto}` : ''}`;
}

/** The answer's words (SPEC §7.2): the hour a wait ends, the whole day now and for an entry of another moment */
export const PALAVRAS_DADOS = Object.freeze({
  aguardarAte: (hora: string) => `Aguardar até ${hora}`,
  naoOperoHoje: 'Não opero hoje',
  /** An entry that is not «now» (SPEC §7.2 «O Registrar e a entrada de outra data») */
  naoOperoNoDia: 'Não opero no dia',
  naoConferidos: 'Dados econômicos não conferidos',
  /** The second line of a grey «Liberado» (SPEC §7.2 «Nunca verde»), before « · sem a agenda de hoje» */
  naoConferidosSub: 'dados econômicos não conferidos',
  /** The ending of a wait whose releases are all in «Só opero depois do dado» (SPEC §7.2, c3 §5.2 case 2) */
  soDepois: 'só opero depois do dado',
});

/** Every release of the wait is in «Só opero depois do dado» */
export const soDepois = (releases: readonly BlockRelease[]) => releases.length > 0 && releases.every((x) => x.mode === 'depois');

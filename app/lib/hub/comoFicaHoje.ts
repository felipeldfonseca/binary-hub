/**
 * «Como fica hoje» (the selected entity's day under the UNSAVED draft, contrato §4.7) and the
 * version block (§4.8): the version notes computed from consecutive rules, when each version
 * held, and the «Ao salvar …» lines. Pure: the device clock comes in as `now`; the words come from
 * components/hub/personalizar/copy.ts.
 *
 * The day is the database's trading day (effectiveDayAt = trading_day_for): inside an overnight
 * occurrence it is the day the occurrence opened. Windows open «today» when their opening falls on
 * that trading day (as gate_eval counts them). Nothing checked is never «Liberado»: «Sem janela
 * salva» / «Sem regra ativa», as the «Posso operar hoje?» card says.
 *
 * Money is in the currency of the rules' market (R$ on B3, US$ elsewhere); the data block, the
 * state rule, the calendars and «somando» appear only where the market has them (MARKET_SPEC).
 */
import { tradingDayOn, tradingDayBounds, windowOccurrences, addDays, formatHhMm, isoWeekdayOf, utcToLocal } from '@/lib/domain/tempo';
import {
  AGENDA_RELEASES,
  MARKET_SPEC,
  STATE_NAMES,
  agendaFor,
  blockIntervals,
  currencyOf,
  releaseOrd,
  releasesOf,
  type AgendaEntry,
  type AgendaRead,
  type AgendaRow,
  type BlockInterval,
  type CalendarCode,
  type ReleaseCode,
  type ReleaseMode,
  type Rules,
} from '@/lib/domain/gate';
import { dinheiroCompacto, type Tom } from './posso';
import { formatDayMonth, formatDiaMes } from './formato';
import { effectiveDayAt, type ConfigVersion, type PendingVersion, type WindowSetting } from './regras';
import { faixaJanela, resumoDias } from './janelas';
import { itensBreakeven } from './personalizarBreakeven';
import { NOMES_DADOS, PALAVRAS_DADOS } from './dadosEconomicos';
import { atalhoDoMapa } from './rascunho';
import { CALENDARIO_NOME, DADOS, ESCOLHA_NOME, ESTADO_NOME, HOJE, NOTA, PROXIMOS, RELOGIO, SEP, VERSAO, lista } from '@/components/hub/personalizar/copy';

export interface Trecho {
  t: string;
  /** Times and money: monospace, never broken */
  mono?: boolean;
  /** Muted (text-2): a release the trader operates normally, «Dados econômicos» */
  fraco?: boolean;
}

export interface LinhaHoje {
  esquerda: Trecho[];
  estado: string;
  tom: Tom;
  /** «Sem janela salva», «Sem regra ativa», the muted data lines are not bold */
  forte: boolean;
  sub: string | null;
}

export interface ComoFicaHoje {
  linhas: LinhaHoje[];
  /** «no relógio de Nova York» / «no relógio de Brasília»; '' with no window */
  sub: string;
  /** The amber warning under the list, or null */
  aviso: string | null;
}

/**
 * @param rules what the draft resolves to (resolveRules: windows with an error are left out)
 * @param edited the windows as edited (errors included), for the clock and the warning
 * @param agenda Phase 5-1, where the market has the data rule (Futuros): the day's agenda read
 *   (E5; null = it did not load, undefined = not read yet → no data line)
 */
export function comoFicaHoje(rules: Rules, now: Date, edited: readonly WindowSetting[], agenda?: AgendaRead | null): ComoFicaHoje {
  const sub = edited.length ? HOJE.noRelogio(RELOGIO[edited[0].tz].relogio) : '';
  const on = rules.windowRule.on;
  const aviso = on && rules.windows.length === 0 ? (edited.length ? HOJE.avisoCorrija : HOJE.avisoSemJanela) : null;

  // Nothing checked: the window rule is off, there is no limit and the data rule waits for nothing
  if (!on && !rules.limit && (agenda === undefined || regraSemEspera(rules))) {
    return { linhas: [{ esquerda: [{ t: HOJE.oDiaTodo }], estado: HOJE.semRegraAtiva, tom: 'muted', forte: false, sub: null }], sub, aviso };
  }

  const today = effectiveDayAt(now, rules);
  const hoje = windowOccurrences(now, rules.windows).filter((o) => tradingDayOn(o.start, rules.day) === today);
  // Phase 5-1: the data lines of the day (c3 §4.2), sorted with the window's by their start
  const dados = rules.block && agenda !== undefined ? linhasDeDados(rules, now, agenda) : null;
  const diaInteiro = !!dados?.diaInteiro;
  // The agenda missing while the rule waits: never a green «Liberado» (c3 §4.2 l.761-762). As the gate
  // (answerOf): with the window rule off and nothing else checked, «Dados econômicos não conferidos»;
  // otherwise «Liberado» stays, muted (its «semAgenda»)
  const naoConferido = !!dados?.naoConferido;
  if (naoConferido && !on && !rules.limit) {
    return { linhas: [{ esquerda: [{ t: HOJE.oDiaTodo }], estado: PALAVRAS_DADOS.naoConferidos, tom: 'muted', forte: false, sub: null }], sub, aviso };
  }
  const verde: Tom = naoConferido ? 'muted' : 'mint';
  const janelas: { at: number; linha: LinhaHoje }[] = hoje.map((o) => {
    const faixa = { t: `${faixaJanela(o.window.startMin, o.window.endMin)} ${RELOGIO[o.window.tz as keyof typeof RELOGIO].curto}`, mono: true };
    const qual = { t: rules.windows.length > 1 ? HOJE.umaDasJanelas : HOJE.suaJanela };
    if (diaInteiro) {
      // «Não opero no dia» today: the window is out, never green (c3 §4.2; board Q22)
      return {
        at: o.start.getTime(),
        linha: { esquerda: [{ ...faixa, fraco: true }, { ...qual, fraco: true }], estado: '', tom: 'muted', forte: false, sub: HOJE.janelaDeFora },
      };
    }
    const corte = dados?.esperas.find((iv) => iv.end > o.start && iv.end < o.end && iv.start <= o.start);
    return {
      at: o.start.getTime(),
      linha: {
        esquerda: [faixa, qual],
        estado: HOJE.liberado,
        tom: verde,
        forte: true,
        sub: corte ? HOJE.janelaDepoisDaEspera(hhmm(corte.end, dados!.tz)) : null,
      },
    };
  });
  const linhas: LinhaHoje[] = [...(dados?.linhas ?? []).filter((x) => x.at !== FIM), ...janelas].sort((x, y) => x.at - y.at).map((x) => x.linha);
  const resto = hoje.length ? HOJE.noRestoDoDia : HOJE.oDiaTodo;
  const aviso2 = rules.windowRule.outside === 'aviso';

  if (diaInteiro) {
    // The whole clock day answers «Não opero hoje», before «Fora da sua janela»: the «O dia inteiro» line covers the rest (board Q22, as drawn)
  } else if (on && rules.windows.length > 0) {
    const naoEDia = linhas.length === 0;
    linhas.push({
      esquerda: [{ t: resto }],
      estado: aviso2 ? HOJE.liberado : HOJE.foraDaJanela,
      tom: aviso2 ? 'neutral' : 'amber',
      forte: true,
      sub: naoEDia ? (aviso2 ? HOJE.comAvisoNaoEDia : HOJE.naoEDia) : aviso2 ? HOJE.comAvisoFora : null,
    });
  } else if (on) {
    // The rule is on but no valid window: the window check is not evaluated
    linhas.push({ esquerda: [{ t: resto }], estado: HOJE.semJanelaSalva, tom: 'muted', forte: false, sub: null });
  } else {
    // The rule is off and the limit is checked
    linhas.push({ esquerda: [{ t: resto }], estado: HOJE.liberado, tom: verde, forte: true, sub: null });
  }

  if (rules.limit) {
    const avisar = rules.limit.atLimit === 'avisar';
    linhas.push({
      esquerda: [
        { t: HOJE.sePerda },
        { t: dinheiroCompacto(rules.limit.cents, currencyOf(rules.market)), mono: true },
        ...(rules.limit.mode === 'soma' && MARKET_SPEC[rules.market].rules.soma ? [{ t: HOJE.somandoFuturos }] : []),
      ],
      estado: avisar ? HOJE.liberado : HOJE.encerrado,
      tom: avisar ? 'neutral' : 'red',
      forte: true,
      sub: avisar ? HOJE.comAvisoLimite : null,
    });
  }

  // «Dados econômicos · nenhum dado hoje» / «… · não conferido» close the list, as the old data line did
  for (const x of dados?.linhas ?? []) if (x.at === FIM) linhas.push(x.linha);

  return { linhas, sub, aviso };
}

// ---------------------------------------------------------------------------------------------
// Phase 5-1 · «Dados econômicos»: shared helpers, the day's data lines (c3 §4.2) and «Próximos dados»
// (c3 §4.3). Hours on the account's window clock (Futuros: New York, «ET»); the day is the account's
// CLOCK day (rules.day: 18:00 New York), as the gate's intervals (SPEC §4.2).
// ---------------------------------------------------------------------------------------------

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

/** The sort key of the data lines that close the list (no release today, agenda not loaded) */
const FIM = Number.MAX_SAFE_INTEGER;

/** The window clock of rules: the first window's zone, else the day clock's */
export const relogioDe = (rules: Pick<Rules, 'windows' | 'day'>): string => rules.windows[0]?.tz ?? rules.day.tz;

/** «ET» / «Brasília» after a time */
export const sufixoRelogio = (tz: string): string => (RELOGIO as Record<string, { curto: string }>)[tz]?.curto ?? 'ET';

/** '08:30' on the clock */
export const hhmm = (at: Date, tz: string): string => formatHhMm(utcToLocal(at, tz).minuteOfDay);

/** '08:30 ET' */
export const horaEt = (at: Date, tz: string): string => `${hhmm(at, tz)} ${sufixoRelogio(tz)}`;

/** The calendar date on the clock, 'YYYY-MM-DD' */
export const dataEm = (at: Date, tz: string): string => utcToLocal(at, tz).date;

/** 'qua 9' (lowercase) */
export const diaCurto = (date: string): string => `${WEEKDAYS[isoWeekdayOf(date) - 1]} ${Number(date.slice(8, 10))}`;

/** 'ter 15 dez' */
export const diaComMes = (date: string): string => `${WEEKDAYS[isoWeekdayOf(date) - 1]} ${formatDayMonth(date)}`;

const maiuscula = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** What the version's (or the draft's) rule does per release, all 20 codes; absent → «normal» */
export function modosDaRegra(rules: Pick<Rules, 'block'>): Record<ReleaseCode, ReleaseMode> {
  const map = releasesOf(rules.block) ?? {};
  return Object.fromEntries(AGENDA_RELEASES.map((r) => [r.code, map[r.code] ?? 'normal'])) as Record<ReleaseCode, ReleaseMode>;
}

/** The rule waits for nothing: off, no calendar, or every followed release «Opero normalmente» */
export function regraSemEspera(rules: Pick<Rules, 'block'>): boolean {
  const b = rules.block;
  if (!b || !b.on || b.calendars.length === 0) return true;
  const m = modosDaRegra(rules);
  return AGENDA_RELEASES.every((r) => !b.calendars.includes(r.calendar) || m[r.code] === 'normal');
}

const vivo = (r: AgendaRow) => r.status === 'agendado' || r.status === 'divulgado';

/** The day's rows of the calendars followed, in the agenda's order (at, then ord) */
function linhasDoDia(rules: Rules, read: AgendaRead, day: string): (AgendaRow & { code: ReleaseCode })[] {
  const cals = rules.block?.calendars ?? [];
  const { start, end } = tradingDayBounds(day, rules.day);
  return read.rows
    .filter((r): r is AgendaRow & { code: ReleaseCode } => r.code !== null && cals.includes(r.calendar) && r.at >= start && r.at < end)
    .sort((a, b) => a.at.getTime() - b.at.getTime() || releaseOrd(a.code) - releaseOrd(b.code));
}

/** Releases grouped by instant: [[cpi], [ppi, varejo_us]] */
function porInstante<T extends { at: Date }>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && last[0].at.getTime() === x.at.getTime()) last.push(x);
    else out.push([x]);
  }
  return out;
}

/** «PPI e vendas no varejo» (the sentence form) */
const nomesFrase = (codes: readonly ReleaseCode[]) => lista(codes.map((c) => NOMES_DADOS[c].frase));
/** «Vendas de casas usadas», «PPI e vendas no varejo» (a line's head: the first in the list form) */
const nomesLinha = (codes: readonly ReleaseCode[]) => lista(codes.map((c, k) => (k === 0 ? NOMES_DADOS[c].nome : NOMES_DADOS[c].frase)));
/** «do CPI», «do PCE e do PIB dos EUA» */
const nomesDoDa = (codes: readonly ReleaseCode[]) => lista(codes.map((c) => NOMES_DADOS[c].doDa));
/** «dia de CPI», «dia de CPI e Payroll», «dia de Fed» (each «dia de …» once) */
function nomesDiaDe(codes: readonly ReleaseCode[]): string {
  const forms = Array.from(new Set(codes.map((c) => NOMES_DADOS[c].diaDe)));
  return forms.length ? `dia de ${lista(forms.map((f) => f.replace(/^dia de /, '')))}` : '';
}

/** The intervals of the day's agenda under rules (empty when the rule is off) */
function intervalosDoDia(rules: Rules, clockDay: string, entries: readonly AgendaEntry[]): BlockInterval[] {
  if (!rules.block?.on) return [];
  const { start, end } = tradingDayBounds(clockDay, rules.day);
  return blockIntervals(rules, rules.day, entries).filter((iv) => iv.start < end && iv.end > start);
}

/** The «Aguardo em volta do horário» span of one instant: at − before .. at + after (no merging) */
function esperaPropria(rules: Rules, at: Date): { start: Date; end: Date } {
  const b = rules.block!;
  return { start: new Date(at.getTime() - b.beforeMin * 60_000), end: new Date(at.getTime() + b.afterMin * 60_000) };
}

/** A data line with its sort key (the start it shows) */
interface LinhaOrdenada {
  at: number;
  linha: LinhaHoje;
}

/**
 * The data lines of «Como fica hoje» (c3 §4.2; boards Q19–Q23), and what the window lines need: the
 * waits that may cut a window and whether the whole day is out («Não opero no dia»).
 */
export function linhasDeDados(
  rules: Rules,
  now: Date,
  agenda: AgendaRead | null,
): { linhas: LinhaOrdenada[]; esperas: BlockInterval[]; diaInteiro: boolean; naoConferido: boolean; tz: string } {
  const tz = relogioDe(rules);
  const day = tradingDayOn(now, rules.day);
  const S = tradingDayBounds(day, rules.day).start.getTime();
  const fraca = (t: string): LinhaOrdenada => ({
    at: FIM,
    linha: { esquerda: [{ t: HOJE.dadosEconomicos, fraco: true }], estado: t, tom: 'muted', forte: false, sub: null },
  });
  const semEspera = regraSemEspera(rules);
  const entries = agenda ? agendaFor(rules, rules.day, now, agenda) : null;
  if (!agenda || (!semEspera && entries === null)) {
    // Not loaded: never «Liberado» for want of the agenda; nothing to say when the rule waits for nothing
    return { linhas: semEspera ? [] : [fraca(HOJE.naoConferido)], esperas: [], diaInteiro: false, naoConferido: !semEspera, tz };
  }
  const rows = linhasDoDia(rules, agenda, day);
  const modos = modosDaRegra(rules);
  const ivs = semEspera ? [] : intervalosDoDia(rules, day, entries ?? []);
  const out: LinhaOrdenada[] = [];
  const info = (grupo: readonly ReleaseCode[], at: Date, estado: string): LinhaOrdenada => ({
    at: at.getTime(),
    linha: {
      esquerda: [{ t: HOJE.dadosAs(nomesLinha(grupo)), fraco: true }, { t: horaEt(at, tz), mono: true, fraco: true }],
      estado,
      tom: 'muted',
      forte: false,
      sub: null,
    },
  });
  const comEspera = new Set<string>();
  for (const iv of ivs) {
    const codes = Array.from(new Set(iv.releases.map((r) => r.code)));
    iv.releases.forEach((r) => comEspera.add(`${r.code}|${r.at.getTime()}`));
    if (iv.kind === 'dia') {
      const first = iv.releases[0];
      out.push({
        at: Math.min(iv.start.getTime(), S),
        linha: {
          esquerda: [{ t: HOJE.oDiaInteiro(nomesDiaDe(codes)) }, { t: horaEt(first.at, tz), mono: true }, { t: HOJE.fechaParen }],
          estado: PALAVRAS_DADOS.naoOperoHoje,
          tom: 'amber',
          forte: true,
          sub: null,
        },
      });
    } else if (iv.releases.some((r) => r.mode === 'depois')) {
      // A «Só depois» wait merged with «Aguardo em volta» releases: each behaviour its own line (c3 §4.2),
      // the «volta» ones with their own span (at − before .. at + after), grouped by instant
      const depois = Array.from(new Set(iv.releases.filter((r) => r.mode === 'depois').map((r) => r.code)));
      out.push({
        at: iv.start.getTime(),
        linha: {
          esquerda: [{ t: HOJE.ate }, { t: horaEt(iv.end, tz), mono: true }, { t: HOJE.soDepois(nomesDoDa(depois)) }],
          estado: PALAVRAS_DADOS.aguardarAte(hhmm(iv.end, tz)),
          tom: 'amber',
          forte: true,
          sub: iv.start.getTime() <= S ? HOJE.desdeOntem : null,
        },
      });
      for (const grupo of porInstante(iv.releases.filter((r) => r.mode !== 'depois'))) {
        const { start, end } = esperaPropria(rules, grupo[0].at);
        if (end <= start) continue;
        out.push({
          at: start.getTime(),
          linha: {
            esquerda: [{ t: `${hhmm(start, tz)}–${hhmm(end, tz)} ${sufixoRelogio(tz)}`, mono: true }, { t: HOJE.espera(nomesDoDa(Array.from(new Set(grupo.map((r) => r.code))))) }],
            estado: PALAVRAS_DADOS.aguardarAte(hhmm(end, tz)),
            tom: 'amber',
            forte: true,
            sub: null,
          },
        });
      }
    } else {
      out.push({
        at: iv.start.getTime(),
        linha: {
          esquerda: [{ t: `${hhmm(iv.start, tz)}–${hhmm(iv.end, tz)} ${sufixoRelogio(tz)}`, mono: true }, { t: HOJE.espera(nomesDoDa(codes)) }],
          estado: PALAVRAS_DADOS.aguardarAte(hhmm(iv.end, tz)),
          tom: 'amber',
          forte: true,
          sub: null,
        },
      });
    }
  }
  // The day's releases without a wait: information, no colour (rule off, «Opero normalmente», 0 and 0 min)
  const vivas = rows.filter(vivo).filter((r) => !comEspera.has(`${r.code}|${r.at.getTime()}`));
  for (const grupo of porInstante(vivas)) {
    const zero = !semEspera && grupo.every((r) => modos[r.code] === 'volta');
    out.push(info(grupo.map((r) => r.code), grupo[0].at, zero ? DADOS.modo.volta : HOJE.operoNormalmente));
  }
  // A release of today cancelled or postponed without a new date, where the account had a wait or a
  // whole day (c3 §12.5). A release moved INTO today (or within it) is live and has its wait above; one
  // moved OUT of today shows in the loop below, on its old date
  for (const r of rows.filter((x) => !vivo(x))) {
    if (semEspera || modos[r.code] === 'normal') continue;
    const nome = NOMES_DADOS[r.code].nome;
    const t = r.status === 'cancelado' ? HOJE.canceladoHoje(nome) : HOJE.adiadoSemDataHoje(nome);
    out.push({ at: r.at.getTime(), linha: { esquerda: [{ t, fraco: true }], estado: '', tom: 'muted', forte: false, sub: null } });
  }
  // A moved release shows on its old date too (was_at today, at later)
  for (const r of agenda.rows) {
    if (!r.code || !r.wasAt || rows.includes(r as AgendaRow & { code: ReleaseCode })) continue;
    if (!(rules.block?.calendars ?? []).includes(r.calendar) || semEspera || modos[r.code] === 'normal') continue;
    if (tradingDayOn(r.wasAt, rules.day) !== day) continue;
    out.push({
      at: r.wasAt.getTime(),
      linha: { esquerda: [{ t: HOJE.adiadoHoje(NOMES_DADOS[r.code].nome, diaComMes(dataEm(r.at, tz))), fraco: true }], estado: '', tom: 'muted', forte: false, sub: null },
    });
  }
  if (out.length === 0) out.push(fraca(HOJE.nenhumDadoHoje));
  return { linhas: out, esperas: ivs.filter((iv) => iv.kind === 'espera'), diaInteiro: ivs.some((iv) => iv.kind === 'dia'), naoConferido: false, tz };
}

/** One line of «Próximos dados» (board Q23) */
export interface LinhaProximo {
  /** «Hoje · ISM de serviços · » (bold), then `hora` (mono) */
  cabeca: string;
  hora: string;
  /** «Aguardo em volta do horário · » + `espera` (mono); null on a grey line */
  comportamento: string | null;
  espera: string | null;
  /** «Opero normalmente · sem espera»: the whole second part (a grey line has it in `cabeca`: «Qui 10 · CPI · cancelado») */
  texto: string | null;
  naoToca: boolean;
  /** A cancelled or moved release: grey, no behaviour (c3 §12.5) */
  cinza: boolean;
}

/** How many lines show before «Mostrar mais» (c3 §4.3) */
export const PROXIMOS_VISIVEIS = 5;

/**
 * «Próximos dados» (c3 §4.3; SPEC §7.3 items 12 and 14): the next 14 days' releases of the calendars
 * followed (E6's rows), each with what the rule (as edited) does and the wait it makes; with the rule
 * off or everything «Opero normalmente» the lines end «Opero normalmente · sem espera». Two releases at
 * the same instant with the same behaviour share a line. Closes with «Depois de {the last covered date}: …»
 * (ultimoDiaCoberto).
 */
export function proximosDados(
  rules: Rules,
  now: Date,
  rows: readonly AgendaRow[],
  covered?: AgendaRead['covered'] | null,
  cobertura?: { covered: AgendaRead['covered']; ate: string } | null,
): { linhas: LinhaProximo[]; depoisDe: string } {
  const tz = relogioDe(rules);
  const cals = rules.block?.calendars ?? [];
  // The account's trading day (18:00 New York on Futuros), as «Como fica hoje» and the gate count it
  const hoje = tradingDayOn(now, rules.day);
  const amanha = addDays(hoje, 1);
  const diaDe = (at: Date) => tradingDayOn(at, rules.day);
  const diaPalavra = (date: string) => (date === hoje ? PROXIMOS.hoje : date === amanha ? PROXIMOS.amanha : maiuscula(diaCurto(date)));
  const nossas = rows.filter((r): r is AgendaRow & { code: ReleaseCode } => r.code !== null && cals.includes(r.calendar));
  const vivas = nossas.filter((r) => vivo(r) && r.at >= now).sort((a, b) => a.at.getTime() - b.at.getTime() || releaseOrd(a.code) - releaseOrd(b.code));
  const semEspera = regraSemEspera(rules);
  const modos = modosDaRegra(rules);
  const ivs = semEspera ? [] : blockIntervals(rules, rules.day, vivas.map((r) => ({ code: r.code, at: r.at })));
  const doDado = (r: { code: ReleaseCode; at: Date }) =>
    ivs.find((iv) => iv.releases.some((x) => x.code === r.code && x.at.getTime() === r.at.getTime()) && (iv.kind === 'dia') === (modos[r.code] === 'dia'));
  const toca = (s: Date, e: Date) =>
    windowOccurrences(s, rules.windows, -2, 2).some((o) => o.start < e && o.end > s);

  type Item = { at: number; linha: LinhaProximo; modo: ReleaseMode | null; codes: ReleaseCode[]; atDate: Date };
  const itens: Item[] = [];
  for (const r of vivas) {
    const modo: ReleaseMode = semEspera ? 'normal' : modos[r.code];
    const prev = itens[itens.length - 1];
    if (prev && prev.modo === modo && prev.atDate.getTime() === r.at.getTime()) {
      prev.codes.push(r.code);
      continue;
    }
    itens.push({ at: r.at.getTime(), modo, codes: [r.code], atDate: r.at, linha: null as unknown as LinhaProximo });
  }
  const linhaDe = (it: Item): LinhaProximo => {
    const cabeca = PROXIMOS.cabeca(diaPalavra(diaDe(it.atDate)), nomesLinha(it.codes));
    const hora = horaEt(it.atDate, tz);
    const iv = it.modo && it.modo !== 'normal' ? doDado({ code: it.codes[0], at: it.atDate }) : undefined;
    if (!iv) return { cabeca, hora, comportamento: null, espera: null, texto: PROXIMOS.semEspera, naoToca: false, cinza: false };
    const modo = it.modo as Exclude<ReleaseMode, 'normal'>;
    // «volta»: the release's own span, never the merged interval of a «Só depois» release at the same instant
    const span = modo === 'volta' ? esperaPropria(rules, it.atDate) : iv;
    const espera = modo === 'volta' ? `${hhmm(span.start, tz)}–${hhmm(span.end, tz)}` : modo === 'depois' ? `${PROXIMOS.esperaAte}${hhmm(iv.end, tz)}` : PROXIMOS.oDiaInteiro;
    return { cabeca, hora, comportamento: PROXIMOS.comportamento(DADOS.modo[modo]), espera, texto: null, naoToca: rules.windows.length > 0 && !toca(span.start, span.end), cinza: false };
  };
  for (const it of itens) it.linha = linhaDe(it);
  // Cancelled, postponed without a date, and a moved release on its old date: grey, no behaviour
  const fim = now.getTime() + 14 * 86_400_000;
  for (const r of nossas) {
    const cinza = (at: Date, texto: string) =>
      itens.push({
        at: at.getTime(),
        modo: null,
        codes: [r.code],
        atDate: at,
        linha: { cabeca: PROXIMOS.cabeca(diaPalavra(diaDe(at)), NOMES_DADOS[r.code].nome) + texto, hora: '', comportamento: null, espera: null, texto: null, naoToca: false, cinza: true },
      });
    if (r.status === 'cancelado' && r.at >= now) cinza(r.at, PROXIMOS.cancelado);
    else if (r.status === 'adiado' && r.at >= now) cinza(r.at, PROXIMOS.adiadoSemData);
    if (r.wasAt && r.wasAt.getTime() !== r.at.getTime() && r.wasAt >= now && r.wasAt.getTime() < fim && vivo(r)) {
      cinza(r.wasAt, PROXIMOS.adiadoPara(diaComMes(dataEm(r.at, tz))));
    }
  }
  itens.sort((a, b) => a.at - b.at);
  return { linhas: itens.map((x) => x.linha), depoisDe: PROXIMOS.depoisDe(diaCurto(ultimoDiaCoberto(cals, hoje, covered, cobertura))) };
}

/**
 * {dia} of «Depois de {dia}» (c3 §4.3 l.817-819: the last covered date): the last day of an unbroken run from today
 * covered for every calendar followed, the day before today when today is not.
 * - With the coverage read (`cobertura`, agendaDb.fetchCoberturaProxima: today .. today + 14): the run as far as
 *   that read goes (a run that reaches its last date is shown ending there: it may go on past it).
 * - Without it (loading or failed), the day's read (E5, D − 1..D + 1): covered through tomorrow → today + 3 (the
 *   daily route's reach, board Q23's rule). No read at all (undefined) → today + 3.
 */
export function ultimoDiaCoberto(
  cals: readonly CalendarCode[],
  hoje: string,
  covered?: AgendaRead['covered'] | null,
  cobertura?: { covered: AgendaRead['covered']; ate: string } | null,
): string {
  if (cals.length === 0) return addDays(hoje, 3);
  const em = (lista: AgendaRead['covered']) => (day: string) => cals.every((c) => lista.some((x) => x.calendar === c && x.day === day));
  if (cobertura) {
    const tem = em(cobertura.covered);
    if (!tem(hoje)) return addDays(hoje, -1);
    let d = hoje;
    while (d < cobertura.ate && tem(addDays(d, 1))) d = addDays(d, 1);
    return d;
  }
  const max = addDays(hoje, 3);
  if (covered == null) return max;
  const tem = em(covered);
  if (!tem(hoje)) return addDays(hoje, -1);
  if (!tem(addDays(hoje, 1))) return hoje;
  return max;
}

// ---------------------------------------------------------------------------------------------
// Version notes (board partesSig), computed from consecutive rules
// ---------------------------------------------------------------------------------------------

/** «Alinhadas: Só a favor · Em conflito: Opero» (« · » is SEP, here and in the notes below), or '' with no choice */
export function resumoEstados(states: Partial<Record<string, string | null>> | null): string {
  if (!states) return '';
  return STATE_NAMES.filter((k) => states[k])
    .map((k) => `${ESTADO_NOME[k]}: ${ESCOLHA_NOME[states[k] as keyof typeof ESCOLHA_NOME]}`)
    .join(SEP);
}

/** «10:00–11:00 ET · seg–sex; 14:00–15:00 ET · seg–sex» */
export function descricaoJanelas(windows: readonly WindowSetting[]): string {
  return windows.map((w) => `${faixaJanela(w.startMin, w.endMin)} ${RELOGIO[w.tz].de}${SEP}${resumoDias(w.weekdays)}`).join('; ');
}

type Parte = 'janela' | 'gate' | 'fora' | 'bloq' | 'lim' | 'est' | 'be' | 'cal';

/** Each part of the rules as the version list writes it; keys missing when they do not apply */
export function partesVersao(r: Rules): Partial<Record<Parte, string>> {
  const caps = MARKET_SPEC[r.market].rules;
  const o: Partial<Record<Parte, string>> = {};
  o.janela = r.windows.length
    ? NOTA.janela(descricaoJanelas(r.windows as WindowSetting[]) + (r.windowsFrom === 'account' ? NOTA.soNestaConta : ''))
    : NOTA.semJanela;
  o.gate = r.windowRule.on ? NOTA.soDentro : NOTA.podeFora;
  if (r.windowRule.on) o.fora = r.windowRule.outside === 'aviso' ? NOTA.foraAviso : NOTA.foraFora;
  if (caps.block) {
    // Phase 5-1 (c3 §3.10): the note names the ready-made choice the map matches
    const b = r.block;
    if (!b || !b.on) o.bloq = NOTA.dadosDesligados;
    else {
      const atalho = atalhoDoMapa(releasesOf(b), b.calendars);
      const f = { fortes: NOTA.dadosFortes, depois0830: NOTA.dados0830, diaCpiPayrollFed: NOTA.dadosDia, personalizado: NOTA.dadosPorDado }[atalho];
      o.bloq = f(b.beforeMin, b.afterMin);
    }
  }
  o.lim = r.limit
    ? NOTA.limite(dinheiroCompacto(r.limit.cents, currencyOf(r.market))) +
      (caps.soma ? (r.limit.mode === 'soma' ? NOTA.somando : NOTA.porConta) : '') +
      (r.limit.atLimit === 'avisar' ? NOTA.soAvisa : '')
    : NOTA.semLimite;
  if (caps.states) o.est = NOTA.estado(resumoEstados(r.states) || NOTA.nenhumaEscolha);
  // Fase 3c (board partesSig `be`): «Mover para o breakeven», Futuros only (the UI's market for the
  // rule); off and on without an asset resolve to no key: «sem breakeven», never a version of its own
  if (r.market === 'futures') {
    const itens = itensBreakeven(r.breakeven);
    o.be = itens.length ? NOTA.breakeven(itens) : NOTA.semBreakeven;
  }
  // The calendars live in the data block
  if (caps.block) o.cal = NOTA.calendarios((r.block?.calendars ?? []).map((c: CalendarCode) => CALENDARIO_NOME[c]));
  return o;
}

/**
 * The note of version `i` (oldest first): v1 copied → «copiadas de {apelido}»; other v1 →
 * «{janela} · {limite}»; later → only the parts whose text changed from the previous version.
 */
export function notaVersao(versions: readonly ConfigVersion[], i: number, labelOf: (id: string) => string | null): string {
  const v = versions[i];
  if (i === 0) {
    const from = v.origin === 'copiar' && v.copiedFrom ? labelOf(v.copiedFrom) : null;
    if (from) return NOTA.copiadas(from);
    const p = partesVersao(v.rules);
    return [p.janela, p.lim].filter(Boolean).join(SEP);
  }
  const a = partesVersao(versions[i - 1].rules);
  const b = partesVersao(v.rules);
  return (Object.keys(b) as Parte[]).filter((k) => a[k] !== b[k]).map((k) => b[k] as string).join(SEP);
}

/** '14' or '1º' (the day of a range's start, the month comes at its end) */
function soDia(day: string): string {
  const d = Number(day.slice(8, 10));
  return d === 1 ? '1º' : String(d);
}

/**
 * When version `i` held: the latest «desde 17 out» (+ « (hoje)»); one replaced the same day
 * «17 out, trocada no mesmo dia»; one that held one day «17 out»; else «14 a 20 out» /
 * «28 out a 3 nov».
 */
export function quandoVersao(versions: readonly ConfigVersion[], i: number, now: Date): string {
  const v = versions[i];
  const next = versions[i + 1];
  if (!next) return VERSAO.desde(formatDiaMes(v.effectiveDay)) + (effectiveDayAt(now, v.rules) === v.effectiveDay ? VERSAO.hoje : '');
  if (next.effectiveDay === v.effectiveDay) return VERSAO.trocadaNoMesmoDia(formatDiaMes(v.effectiveDay));
  const last = addDays(next.effectiveDay, -1);
  if (last <= v.effectiveDay) return formatDiaMes(v.effectiveDay);
  const sameMonth = last.slice(0, 7) === v.effectiveDay.slice(0, 7);
  return VERSAO.intervalo(sameMonth ? soDia(v.effectiveDay) : formatDiaMes(v.effectiveDay), formatDiaMes(last));
}

/** «Ao salvar: Regras v2 desde 17 out.» for one account, or null */
export function aoSalvarConta(pending: readonly PendingVersion[], accountId: string, now: Date): string | null {
  const p = pending.find((x) => x.accountId === accountId);
  return p ? VERSAO.aoSalvar(p.versionNo, formatDiaMes(effectiveDayAt(now, p.rules))) : null;
}

/** «Ao salvar: versão nova desde 17 out em Top One #1.» for «Padrão Futuros» (active futures accounts), or null */
export function aoSalvarPadrao(
  pending: readonly PendingVersion[],
  futures: readonly { id: string; label: string }[],
  now: Date,
): string | null {
  const ps = futures.map((a) => ({ a, p: pending.find((x) => x.accountId === a.id) })).filter((x) => x.p);
  if (!ps.length) return null;
  return VERSAO.aoSalvarPadrao(
    formatDiaMes(effectiveDayAt(now, ps[0].p!.rules)),
    ps.map((x) => x.a.label),
  );
}

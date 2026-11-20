/**
 * The Diário's words in pt-BR (Phase 4), from the domain's results (lib/domain/diario) and the
 * reads' answers. Pure functions, no React: the screens render what these return. Strings come
 * from the approved boards (DiarioDezEnxuto «… · 10 cenários» and DiarioHojeEnxuto «… · 11
 * cenários», approved 5 Nov 2026; their generator in .claude/backup-fase4/quadro/gerador computes
 * every sentence the same way) unless marked:
 *   NEW      not on either board (the comment says why)
 *
 * Money: NET everywhere (day, calendar, week, each trade), in the account's currency (R$ on B3,
 * US$ elsewhere); the gross and the commissions only in «Como ler os números do dia». Times: on
 * the Diário's clock (`tz`: the account's window clock, ET for Futuros, Forex and Ações, Brasília
 * for binárias, Cripto and B3).
 */
import { EVERY_DAY, MON_TO_FRI, formatHhMm, isoWeekdayOf, localToUtc, tradingDayBounds, tradingDayOn, utcToLocal, type DayClock } from '@/lib/domain/tempo';
import { MARKET_SPEC, type AccountMarket, type Currency } from '@/lib/domain/markets';
import {
  agendaFor,
  evaluateGate,
  type AgendaRead,
  type AgendaRow,
  type BlockCheck,
  type BlockInterval,
  type BlockRelease,
  type CalendarCode,
  type PlanBreak,
  type Rules,
} from '@/lib/domain/gate';
import { cmeHolidayOn } from '@/lib/domain/agenda/feriados';
import { abs, numeric, numericText, round, sign, sub } from '@/lib/domain/registro/numeric';
import {
  COMMISSION_FROM_FILE,
  dayMoney,
  isPendingReview,
  noteTimes,
  pendingReviews,
  reviewTimes,
  type CalendarDay,
  type CarryIn,
  type Day,
  type DayFacts,
  type DayNote,
  type DayReview,
  type DayTiles,
  type Followed,
  type ForaTrade,
  type GridCell,
  type GridWeek,
  type HistoryPart,
  type Money,
  type MonthDay,
  type ReviewVersion,
  type WeekCard,
} from '@/lib/domain/diario';
import { formatMoney } from './formato';
import { faixaJanela, resumoDias } from './janelas';
import { NOMES_DADOS, rotuloDados, soDepois } from './dadosEconomicos';
import { itensBreakeven } from './personalizarBreakeven';
import { sufixoRelogio, type Tom } from './posso';

/** Who the words are for: the account's money, market and the Diário's clock */
export interface ContaDiario {
  currency: Currency;
  market: AccountMarket;
  /** The clock the Diário writes hours on (the window's; the day clock without a window) */
  tz: string;
}

const MINUS = '−';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const M3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
const WD3 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
/** Calendar columns («Seg» … «Sex», then «Sáb» «Dom» with 7 columns), before «Semana» */
export const COLUNAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const NAO_PREENCHIDO = 'Não preenchido';

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
/** «a», «a e b», «a, b e c» */
export function listaE(itens: readonly string[]): string {
  const xs = itens.filter(Boolean);
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// Dates, hours and money
// ---------------------------------------------------------------------------------------------

const parts = (day: Day) => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)), d: Number(day.slice(8, 10)) });
const dnum = (d: number) => (d === 1 ? '1º' : String(d));

/** '2026-12-01' → «1º dez» */
export function diaCurto(day: Day): string {
  const p = parts(day);
  return `${dnum(p.d)} ${M3[p.m - 1]}`;
}

/** '2026-11-10' → «Terça-feira, 10 de novembro» (the open day's heading) */
export function diaLongo(day: Day): string {
  const p = parts(day);
  const s = `${DIAS[isoWeekdayOf(day) - 1]}, ${dnum(p.d)} de ${MESES[p.m - 1]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The header's date line on the Diário's clock: «terça-feira, 1º de dezembro, 11:35 ET», «… 21:20 de Brasília» */
export function linhaDaData(now: Date, tz: string): string {
  const l = utcToLocal(now, tz);
  return `${DIAS[l.isoWeekday - 1]}, ${dnum(l.day)} de ${MESES[l.month - 1]}, ${formatHhMm(l.minuteOfDay)}${sufixoRelogio(tz)}`;
}

/** '2026-11' → «Novembro de 2026» */
export function mesTitulo(month: string): string {
  const m = Number(month.slice(5, 7));
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${month.slice(0, 4)}`;
}

/** «23 a 27 de novembro», «28 de setembro a 2 de outubro», «30 de novembro a 6 de dezembro» */
export function intervaloLongo(a: Day, b: Day): string {
  const pa = parts(a);
  const pb = parts(b);
  return pa.m === pb.m ? `${dnum(pa.d)} a ${dnum(pb.d)} de ${MESES[pb.m - 1]}` : `${dnum(pa.d)} de ${MESES[pa.m - 1]} a ${dnum(pb.d)} de ${MESES[pb.m - 1]}`;
}

/** The «Semana» cell's label: «12–16 out», «28 set–2 out», «30 nov–4 dez» */
export function rotuloSemana(first: Day, last: Day): string {
  const pa = parts(first);
  const pb = parts(last);
  return pa.m === pb.m ? `${dnum(pa.d)}–${dnum(pb.d)} ${M3[pb.m - 1]}` : `${diaCurto(first)}–${diaCurto(last)}`;
}

/** 'HH:MM' of an instant on the Diário's clock */
export const hora = (at: Date, tz: string) => formatHhMm(utcToLocal(at, tz).minuteOfDay);

/** Money at the cent (round half away from zero, as Postgres) */
const centavos = (m: Money): string => numericText(round(numeric(m), 2));

/** «+US$ 267,93», «−R$ 180,00», «US$ 0,00» */
export const dinheiro = (m: Money, currency: Currency, signed = true): string => formatMoney(centavos(m), { signed, currency });

/** A positive amount without «,00»: «US$ 400», «US$ 465,40», «R$ 500» */
export const dinheiroCompacto = (m: Money, currency: Currency): string =>
  formatMoney(centavos(numericText(abs(numeric(m)))), { currency }).replace(/,00$/, '');

/** The calendar cell's number: «+267,93», «−465,40», «0,00» */
export function numeroDoDia(m: Money): string {
  const t = formatMoney(centavos(m), { signed: true });
  return t.replace(/US\$\s/, '');
}

/** The cell's short number (narrow screens): «+268», «−465», «0» */
export function numeroCurto(m: Money): string {
  const v = round(abs(numeric(m)), 0);
  const s = sign(numeric(m));
  const zero = sign(v) === 0;
  const body = numericText(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${!zero && s < 0 ? MINUS : !zero && s > 0 ? '+' : ''}${body}`;
}

/** Mint, red or neutral, by the sign */
export function tomDe(m: Money): Tom {
  const s = sign(numeric(m));
  return s > 0 ? 'mint' : s < 0 ? 'red' : 'neutral';
}

/** «dólares» / «reais» (screen-reader labels) */
export const nomeDaMoeda = (currency: Currency) => (currency === 'BRL' ? 'reais' : 'dólares');

/** «Toque num dia para abrir. {…}» */
export function valoresEm(market: AccountMarket, currency: Currency): string {
  if (currency === 'BRL') return 'Valores em R$.';
  return market === 'crypto' ? 'Valores em US$ (USDT e USDC contam como dólar).' : 'Valores em US$.';
}

// ---------------------------------------------------------------------------------------------
// Wins and losses
// ---------------------------------------------------------------------------------------------

/** «3 ganhos, 2 perdas», «1 ganho, 3 perdas, 1 no zero a zero»; binárias: «…, 1 devolvida» */
export function ganhosEPerdas(c: { wins: number; losses: number; even: number }, market: AccountMarket): string {
  const xs = [pl(c.wins, 'ganho', 'ganhos'), pl(c.losses, 'perda', 'perdas')];
  if (c.even) xs.push(market === 'binary' ? pl(c.even, 'devolvida', 'devolvidas') : `${c.even} no zero a zero`);
  return xs.join(', ');
}

// ---------------------------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------------------------

/** A calendar cell's words: what it shows, its hover and its screen-reader label */
export interface CelulaTexto {
  /** «+267,93», «sem op.», «—» (today without trades) or '' */
  res: string;
  /** Narrow screens: «+268», «—» or '' */
  resCurto: string;
  dica: string;
  aria: string;
}

/**
 * One day cell's words. `mes` is that day's diario_mes row when it answered (● and ■ in the hover
 * and label); `cell` the grid's cell.
 */
export function celulaDoCalendario(cell: GridCell, conta: ContaDiario, mes?: MonthDay | null): CelulaTexto {
  const curto = diaCurto(cell.day);
  if (!cell.inMonth) return { res: '', resCurto: '', dica: '', aria: cell.today ? `${curto}, hoje` : '' };
  if (cell.future) return { res: '', resCurto: '', dica: '', aria: `${curto}, ainda não aconteceu` };
  const d = cell.data;
  if (!d) {
    if (cell.today) return { res: '—', resCurto: '—', dica: `${curto} · hoje, sem operações ainda`, aria: `${curto}, hoje, sem operações ainda` };
    const vazio = cell.weekend && conta.market !== 'crypto';
    return { res: vazio ? '' : 'sem op.', resCurto: vazio ? '' : '—', dica: `${curto} · sem operações`, aria: `${curto}, sem operações` };
  }
  const money = dayMoney(d);
  const res = numeroDoDia(money);
  const resCurto = numeroCurto(money);
  const moeda = nomeDaMoeda(conta.currency);
  const hoje = cell.today ? ', hoje' : '';
  if (d.kind === 'historico') {
    const h = d.history as HistoryPart;
    // NEW: a review saved on the day the rules began, when every trade of it came before them
    const escrita = d.review ? ' · revisão escrita' : '';
    return {
      res,
      resCurto,
      dica: `${curto} · ${dinheiro(h.net, conta.currency)} · ${h.n} op.: ${ganhosEPerdas(h, conta.market)} · Histórico importado · só resultado${escrita}`,
      aria: `${curto}, ${res} ${moeda}, ${h.n} op., Histórico importado${d.review ? ', revisão escrita' : ''}${hoje}`,
    };
  }
  const fora = mes?.fora.n ?? 0;
  const hit = mes?.limit?.hitAt ?? null;
  const ex: string[] = [];
  if (d.open) ex.push(d.open === 1 ? '1 aberta' : `${d.open} abertas`);
  if (fora) ex.push(`${fora} fora do plano`);
  if (hit) ex.push(`limite atingido às ${hora(hit, conta.tz)}`);
  if (d.kind === 'misto' && d.history) ex.push(`+ ${d.history.n} do histórico, à parte`);
  const revisao = d.review ? ' · revisão escrita' : cell.pendingReview ? ' · sem revisão' : '';
  const revisaoAria = d.review ? ', revisão escrita' : cell.pendingReview ? ', sem revisão' : '';
  return {
    res,
    resCurto,
    dica: `${curto} · ${dinheiro(d.net, conta.currency)} · ${d.n} op.: ${ganhosEPerdas(d, conta.market)}${ex.map((x) => ` · ${x}`).join('')}${revisao}`,
    aria:
      `${curto}, ${res} ${moeda}, ${d.n} op.` +
      (fora ? ', com operação fora do plano' : '') +
      (hit ? ', limite atingido' : '') +
      (d.kind === 'misto' ? ', com histórico importado à parte' : '') +
      revisaoAria +
      hoje,
  };
}

export interface SemanaCelulaTexto {
  /** «12–16 out» */
  rotulo: string;
  /** «+347,00» (the diário), or the history's number on a week with only history */
  res: string;
  /** «10 op.» */
  n: string;
  /** «3» after the ● (null without trades outside the plan) */
  fora: string | null;
  /** «+163,29» after the ▨, on a week with both */
  historia: string | null;
  aria: string;
}

/** The «Semana» column's cell; null for a week without trades (the cell shows «—» once it started) */
export function celulaDaSemana(w: GridWeek, conta: ContaDiario): SemanaCelulaTexto | null {
  if (w.empty) return null;
  const longo = intervaloLongo(w.weekOf, w.lastShown);
  const moeda = nomeDaMoeda(conta.currency);
  const h = w.history;
  let corpo: string;
  if (w.diario) {
    corpo =
      `${numeroDoDia(w.diario.net)} ${moeda}, ${w.diario.n} op.` +
      (w.fora ? `, ${w.fora.n} fora do plano` : '') +
      (h ? `, histórico importado à parte: ${numeroDoDia(h.net)}` : '');
  } else {
    corpo = `histórico importado, ${numeroDoDia((h as NonNullable<GridWeek['history']>).net)} ${moeda}`;
  }
  return {
    rotulo: rotuloSemana(w.weekOf, w.lastShown),
    res: numeroDoDia(w.diario ? w.diario.net : (h as NonNullable<GridWeek['history']>).net),
    n: `${w.diario ? w.diario.n : (h as NonNullable<GridWeek['history']>).n} op.`,
    fora: w.fora ? String(w.fora.n) : null,
    historia: w.diario && h ? numeroDoDia(h.net) : null,
    aria: `Semana de ${longo}: ${corpo}${corpo.endsWith('.') ? '' : '.'} Abrir a semana.`,
  };
}

/** The pending-reviews banner: «5 pregões sem revisão, 3 nas últimas 4 semanas»; null when none */
export function avisoDeRevisoes(days: readonly CalendarDay[], today: Day): { texto: string; mes: string } | null {
  const p = pendingReviews(days, today);
  if (!p.days.length) return null;
  const n = p.days.length;
  const m = p.recent.length;
  return {
    texto: pl(n, 'pregão sem revisão', 'pregões sem revisão') + (m && m < n ? `, ${m} nas últimas 4 semanas` : ''),
    // «Ver no calendário» opens the month of the newest pending day
    mes: p.days[n - 1].slice(0, 7),
  };
}

/**
 * The line over the calendar: «Diário desde 14 out: 106 operações em 31 pregões · 269 antes, em
 * Histórico importado · só resultado», «Diário desde 14 out: nenhuma operação ainda.»; null for an
 * account without rules (it shows «Esta conta ainda não tem regras.»)
 */
export function linhaDoTopo(desdeDay: Day | null, days: readonly CalendarDay[], today: Day): string | null {
  if (!desdeDay) return null;
  let n = 0;
  let pregoes = 0;
  let hist = 0;
  for (const d of days) {
    if (d.day > today || d.kind === 'vazio') continue;
    if (d.kind === 'historico') hist += d.history?.n ?? 0;
    else {
      n += d.n;
      pregoes += 1;
      hist += d.history?.n ?? 0;
    }
  }
  const desde = diaCurto(desdeDay);
  if (!n) return `Diário desde ${desde}: nenhuma operação ainda.`;
  return `Diário desde ${desde}: ${pl(n, 'operação', 'operações')} em ${pl(pregoes, 'pregão', 'pregões')}` + (hist ? ` · ${hist} antes, em Histórico importado · só resultado` : '');
}

/** The pregão's clock for the calendar's ⓘ: «O pregão de futuros vai das 18:00 da véspera às 17:00 ET.» */
export function relogioDoPregao(market: AccountMarket, day: { tz: string; startMin: number }): string {
  if (market === 'futures') return 'O pregão de futuros vai das 18:00 da véspera às 17:00 ET.';
  if (day.startMin === 0) return `O pregão desta conta vai da meia-noite à meia-noite${sufixoRelogio(day.tz)}.`;
  const h = formatHhMm(day.startMin);
  return `O pregão desta conta vai das ${h} da véspera às ${h}${sufixoRelogio(day.tz)}.`;
}

/** «Como ler: Calendário» */
export function comoLerOCalendario(market: AccountMarket, day: { tz: string; startMin: number }): string {
  return (
    'Cada pregão é pintado pelo resultado: verde ganho, vermelho perda, mais forte quanto maior (quartis do resultado diário, ganhos e perdas à parte). ' +
    relogioDoPregao(market, day) +
    ' Traço (—): dia sem operações. Hachurado: Histórico importado, antes das suas regras, só com resultado, nunca somado ao diário e com uma escala de cor própria. Ponto verde: hoje. Borda branca: dia aberto. Tracejado: dia do mês vizinho. A coluna Semana soma só o diário; o histórico aparece à parte, com ▨. Toque numa semana para abri-la. Passe o mouse num dia para ver operações, ganhos e perdas. Pregões sem revisão de meses anteriores ficam no mês deles: use ‹.'
  );
}

// ---------------------------------------------------------------------------------------------
// The open day: heading, tags, tiles
// ---------------------------------------------------------------------------------------------

/**
 * The day's tags: «Limite atingido às 10:38», «Histórico importado · 13 out», «Revisão escrita»,
 * «Sem revisão» (only on a day due a review)
 */
export function etiquetasDoDia(d: CalendarDay | null, today: Day, conta: ContaDiario, limitHitAt: Date | null): string[] {
  const out: string[] = [];
  if (limitHitAt) out.push(`Limite atingido às ${hora(limitHitAt, conta.tz)}`);
  if (!d) return out;
  if (d.kind === 'historico' && d.importedAt) out.push(`Histórico importado · ${diaCurto(utcToLocal(d.importedAt, conta.tz).date)}`);
  // A written review shows on any day it was saved (also the day the rules began with only history)
  if (d.review) out.push('Revisão escrita');
  else if (isPendingReview(d, today)) out.push('Sem revisão');
  return out;
}

/**
 * The note under the heading: history «Antes das suas regras: sem plano, só o que o arquivo
 * trouxe.»; the misto day «Suas regras começaram às 09:12: a operação das 08:50 fica em Histórico
 * importado · só resultado, à parte do dia.»
 */
export function notaDoDia(kind: DayFacts['kind'], conta: ContaDiario, desde: Date | null, historyEntries: readonly Date[]): string | null {
  if (kind === 'historico') return 'Antes das suas regras: sem plano, só o que o arquivo trouxe.';
  if (kind === 'misto' && desde) {
    const quem =
      historyEntries.length === 1 ? `a operação das ${hora(historyEntries[0], conta.tz)} fica` : 'as operações de antes ficam';
    return `Suas regras começaram às ${hora(desde, conta.tz)}: ${quem} em Histórico importado · só resultado, à parte do dia.`;
  }
  return null;
}

export interface NumerosTexto {
  res: string;
  resTom: Tom;
  /** «5», «2 · 1 aberta» */
  ops: string;
  /** «3 ganhos, 2 perdas» ('' before any closed trade) */
  opsSub: string;
  /** «US$ 465,40 de US$ 400», «nenhuma perda acumulada», «sem limite», «—» */
  lim: string;
  /** «pior momento · atingido às 10:38 · somando as contas de Futuros», «nas suas regras», «o limite ainda não existia» */
  limSub: string;
  /** Bar fill 0–100; null without a bar */
  barra: number | null;
  barraTom: 'amber' | 'red';
  /** «1 operação · −US$ 38,74», «1 operação · aberta», «nenhuma», «—» */
  fora: string;
  foraSub: string;
  foraTom: Tom;
}

/** The four tiles of a diário or misto day */
export function numerosDoDia(t: DayTiles, conta: ContaDiario): NumerosTexto {
  const m = conta.currency;
  const o = t.operations;
  const ops = String(o.n) + (o.open === 1 ? ' · 1 aberta' : o.open ? ` · ${o.open} abertas` : '');
  let lim = 'sem limite';
  let limSub = 'nas suas regras';
  let barra: number | null = null;
  if (t.limit) {
    const perda = sign(numeric(t.limit.loss)) > 0;
    lim = perda ? `${dinheiro(t.limit.loss, m, false)} de ${dinheiroCompacto(t.limit.amount, m)}` : 'nenhuma perda acumulada';
    limSub =
      'pior momento' + (t.limit.hitAt ? ` · atingido às ${hora(t.limit.hitAt, conta.tz)}` : '') + (t.limit.somando ? ' · somando as contas de Futuros' : '');
    barra = perda ? t.limit.percent : null;
  }
  let fora = 'nenhuma';
  let foraTom: Tom = 'neutral';
  if (t.fora) {
    fora = pl(t.fora.n, 'operação', 'operações') + (t.fora.allOpen ? ' · aberta' : ` · ${dinheiro(t.fora.net, m)}`);
    foraTom = 'amber';
  }
  return {
    res: dinheiro(t.result.net, m),
    resTom: tomDe(t.result.net),
    ops,
    opsSub: o.closed ? ganhosEPerdas(o, conta.market) : '',
    lim,
    limSub,
    barra,
    barraTom: t.limit?.hitAt ? 'red' : 'amber',
    fora,
    foraSub: '',
    foraTom,
  };
}

/** A history day's tiles: only what the file brought */
export function numerosDoHistorico(h: HistoryPart, conta: ContaDiario): NumerosTexto {
  return {
    res: dinheiro(h.net, conta.currency),
    resTom: tomDe(h.net),
    ops: String(h.n),
    opsSub: h.n ? ganhosEPerdas(h, conta.market) : '',
    lim: '—',
    limSub: 'o limite ainda não existia',
    barra: null,
    barraTom: 'amber',
    fora: '—',
    foraSub: 'sem plano',
    foraTom: 'muted',
  };
}

/** An account without rules (no version 1): nothing to measure the day against (board scenario 10a) */
export function numerosSemRegras(conta: ContaDiario): NumerosTexto {
  return {
    res: dinheiro('0', conta.currency),
    resTom: 'neutral',
    ops: '0',
    opsSub: '',
    lim: '—',
    limSub: 'sem regras salvas',
    barra: null,
    barraTom: 'amber',
    fora: '—',
    foraSub: '',
    // The board's empty day: «—» in the text colour (only the history day is muted)
    foraTom: 'neutral',
  };
}

const SOMANDO_INFO =
  ' Com “somando as contas de Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai da soma, também nos dias passados.';

/**
 * «Como ler os números do dia» on a diário or misto day: net or still gross, the limit, «fora do
 * plano» with the other trades' simple sum, and the misto day's history apart. Before the day's
 * first trade only the limit is explained (as the board's empty day).
 */
export function comoLerOsNumeros(
  t: DayTiles,
  conta: ContaDiario,
  f: Pick<DayFacts, 'trades' | 'window' | 'limit'>,
  o: { dados?: boolean } = {},
): string {
  const m = conta.currency;
  const out: string[] = [];
  const temComissao = COMMISSION_FROM_FILE.includes(conta.market) && f.trades > 0;
  if (f.trades) {
    if (t.money.pending) out.push('A comissão ainda não chegou: o resultado está bruto até o arquivo da corretora.');
    else if (t.money.commission !== null && sign(numeric(t.money.commission)) !== 0) {
      out.push(`Resultado líquido. Bruto ${dinheiro(t.money.gross, m)} · comissões ${dinheiro(numericText(sub(numeric('0'), abs(numeric(t.money.commission)))), m, false)}.`);
    }
  }
  if (t.limit) {
    out.push(
      'Limite do dia: a maior perda acumulada no pregão, no pior momento' +
        (temComissao ? ', já com a comissão quando o arquivo a trouxe' : '') +
        `, contra o seu limite de ${dinheiroCompacto(t.limit.amount, m)}` +
        (t.limit.somando ? ', somando as contas de Futuros' : '') +
        '. ' +
        (t.limit.atLimit === 'encerrar' ? 'Pelas suas regras, ao atingir o limite o app encerra o dia.' : 'Pelas suas regras, ao atingir o limite o app só avisa.') +
        (t.limit.somando ? SOMANDO_INFO : ''),
    );
  } else out.push('Limite do dia: esta conta não tem limite nas suas regras.');
  if (f.trades && (f.window || f.limit)) {
    let s = o.dados
      ? t.limit
        ? `Fora do plano: operações ${FORA_COM_DADOS}.`
        : 'Fora do plano: operações fora da janela, numa espera de dado econômico ou em dia em que você escolheu não operar.'
      : t.limit
        ? 'Fora do plano: operações fora da janela ou depois do limite.'
        : 'Fora do plano: operações fora da janela.';
    if (t.fora && t.others) s += ` As outras ${t.others.n} somaram ${dinheiro(t.others.net, m)}: conta simples, não é o que teria acontecido.`;
    out.push(s);
  }
  if (t.history) {
    // NEW plural «essas»: the board draws one history trade on the misto day
    out.push(
      `+ ${pl(t.history.n, 'operação', 'operações')} do histórico, à parte: ${dinheiro(t.history.net, m)}; o limite do dia contou ${t.history.n === 1 ? 'essa' : 'essas'} também.`,
    );
  }
  return out.join(' ');
}

/** A history day's «Como ler os números do dia» */
export function comoLerOHistorico(h: HistoryPart, conta: ContaDiario): string {
  const out = ['Antes da primeira versão das suas regras não há janela, limite nem plano: só o que o arquivo da corretora trouxe.'];
  const comissao = sub(numeric(h.gross), numeric(h.net));
  if (sign(comissao) !== 0) {
    out.push(`Resultado líquido. Bruto ${dinheiro(h.gross, conta.currency)} · comissões ${dinheiro(numericText(sub(numeric('0'), abs(comissao))), conta.currency, false)}.`);
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------------------------
// «O plano do dia»
// ---------------------------------------------------------------------------------------------

export interface LinhaDoPlano {
  item: 'Janela' | 'Dados econômicos' | 'Limite' | 'Breakeven';
  /** «10:00–11:00 ET», «US$ 400 · encerra o dia», «MES +8 pts · MNQ +30 pts», «Sem janela salva» */
  plano: string;
  /** «4 de 5 dentro», «atingido às 10:38, com US$ 426,66 de perda · 1 depois, às 10:52: −US$ 38,74» */
  fato: string;
  /** «No plano», «Fora do plano», «Sem regra», «Registrado», or '' before any trade */
  marca: string;
  tipo: 'ok' | 'fora' | 'neutro';
  /** «Definir em Personalizar» */
  link: string | null;
}

/** «10:00–11:00 ET», «20:00–21:00 · Brasília», «20:00–22:00 · Brasília, todos os dias» */
export function janelaDoPlano(rules: Pick<Rules, 'windows'>): string | null {
  if (!rules.windows.length) return null;
  const w0 = rules.windows[0];
  const faixas = rules.windows.map((w) => faixaJanela(w.startMin, w.endMin)).join(' e ');
  const relogio = w0.tz === 'America/Sao_Paulo' ? ' · Brasília' : sufixoRelogio(w0.tz);
  const dias = w0.weekdays === MON_TO_FRI ? '' : w0.weekdays === EVERY_DAY ? ', todos os dias' : `, ${resumoDias(w0.weekdays)}`;
  return `${faixas}${relogio}${dias}`;
}

/** «US$ 400 · encerra o dia», «US$ 400 · só avisa · somando as contas de Futuros» */
export function limiteDoPlano(limit: NonNullable<Rules['limit']>, currency: Currency): string {
  const valor = formatMoney(String(limit.cents / 100), { currency }).replace(/,00$/, '');
  return `${valor} · ${limit.atLimit === 'encerrar' ? 'encerra o dia' : 'só avisa'}` + (limit.mode === 'soma' ? ' · somando as contas de Futuros' : '');
}

const UNIDADE: Record<string, string> = { pts: ' pts', pips: ' pips', price: '' };

/** «MES +8 pts · MNQ +30 pts» */
export function breakevenDoPlano(rule: NonNullable<Rules['breakeven']>): string {
  return itensBreakeven(rule)
    .map((i) => `${i.ativo} +${i.n}${UNIDADE[rule.by[i.ativo].un] ?? ''}`)
    .join(' · ');
}

/**
 * «O plano do dia»: Janela, Dados econômicos (Futuros, Phase 5-1: `dados`, from linhaDosDadosDoPlano; null leaves it
 * out), Limite and (with the rule) Breakeven, from the rules of the version in force at the day's end and the day's
 * facts. The breakeven row only records (no verdict: Análises judges it).
 */
export function linhasDoPlano(rules: Rules, f: DayFacts, conta: ContaDiario, dados: LinhaDoPlano | null = null): LinhaDoPlano[] {
  const m = conta.currency;
  const rows: LinhaDoPlano[] = [];
  const n = f.trades;
  const janela = janelaDoPlano(rules);
  if (!janela) rows.push({ item: 'Janela', plano: 'Sem janela salva', fato: '', marca: 'Sem regra', tipo: 'neutro', link: 'Definir em Personalizar' });
  else if (!f.window) rows.push({ item: 'Janela', plano: janela, fato: '', marca: 'Sem regra', tipo: 'neutro', link: null });
  else {
    const w = f.window;
    const ok = w.inside === w.evaluated;
    rows.push({
      item: 'Janela',
      plano: janela,
      fato: n ? `${w.inside} de ${w.evaluated} dentro` : 'nenhuma operação ainda',
      marca: n ? (ok ? 'No plano' : 'Fora do plano') : '',
      tipo: n && !ok ? 'fora' : n ? 'ok' : 'neutro',
      link: null,
    });
  }
  if (dados) rows.push(dados);
  if (!rules.limit || !f.limit) rows.push({ item: 'Limite', plano: 'sem limite', fato: '', marca: 'Sem regra', tipo: 'neutro', link: null });
  else {
    const l = f.limit;
    const perda = abs(numeric(l.worst));
    let fato: string;
    if (l.hitAt) {
      fato = `atingido às ${hora(l.hitAt, conta.tz)}` + (l.worstAtHit ? `, com ${dinheiro(l.worstAtHit.replace(/^-/, ''), m, false)} de perda` : '');
      if (l.after.length) {
        fato +=
          ` · ${l.after.length} depois, às ${listaE(l.after.map((a) => hora(a.at, conta.tz)))}` +
          (l.afterNet !== null ? `: ${dinheiro(l.afterNet, m)}` : '');
      }
    } else fato = sign(perda) > 0 ? `pior momento: ${dinheiroCompacto(l.worst, m)}` : n ? 'nenhuma perda acumulada' : 'nenhuma operação ainda';
    rows.push({
      item: 'Limite',
      plano: limiteDoPlano(rules.limit, m),
      fato,
      marca: n ? (l.after.length ? 'Fora do plano' : 'No plano') : '',
      tipo: l.after.length ? 'fora' : n ? 'ok' : 'neutro',
      link: null,
    });
  }
  if (rules.breakeven && f.breakeven) {
    const b = f.breakeven;
    rows.push({
      item: 'Breakeven',
      plano: breakevenDoPlano(rules.breakeven),
      // Of the trades that got to the rule's point (the board's «mm»), how many had the stop moved
      fato: b.reached ? `moveu em ${b.moved} de ${b.reached}` : 'nenhuma chegou ao ponto da regra',
      marca: 'Registrado',
      tipo: 'neutro',
      link: null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// «Dados econômicos» (Phase 5-1): the plan's line, the words of «fora do plano», the day's labels
// ---------------------------------------------------------------------------------------------

/** The top sentence's «Fora do plano: operações …» (c3 §6.2 l.1083-1085, «numa espera de dado econômico») */
const FORA_COM_DADOS = 'fora da janela, numa espera de dado econômico, em dia em que você escolheu não operar ou depois do limite';
/** The plan's ⓘ (c3 §6.3 l.1109-1111: «numa espera de dado», without «econômico») */
const FORA_COM_DADOS_INFO = 'fora da janela, numa espera de dado, em dia em que você escolheu não operar ou depois do limite';

/** The market has the data rule (Futuros): the plan shows the «Dados econômicos» line, the drill its sentences */
export const temLinhaDeDados = (market: AccountMarket): boolean => MARKET_SPEC[market].rules.block;

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** «dia de CPI», «dia de PCE e PIB dos EUA», «dia de 3 dados» (each «dia de …» name once) */
export function diaDeDados(releases: readonly Pick<BlockRelease, 'code'>[]): string {
  const nomes = Array.from(new Set(releases.map((r) => NOMES_DADOS[r.code].diaDe)));
  return nomes.length >= 3 ? `dia de ${nomes.length} dados` : `${nomes[0]}${nomes[1] ? ` e ${nomes[1].replace(/^dia de /, '')}` : ''}`;
}

/**
 * A whole day's names with their hours: «dia de CPI (08:30)», «dia de PCE e PIB dos EUA (08:30)» (one hour), and, when
 * the releases fall at different hours, each group with its own (NEW, review 2026-11-20): «dia de CPI (08:30) e dia de
 * Fed (14:00)»; hours on `tz`
 */
export function diaDeDadosComHoras(releases: readonly BlockRelease[], tz: string): string {
  const grupos: BlockRelease[][] = [];
  for (const r of [...releases].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const g = grupos.find((x) => hora(x[0].at, tz) === hora(r.at, tz));
    if (g) g.push(r);
    else grupos.push([r]);
  }
  if (grupos.length <= 1) return `${diaDeDados(releases)} (${hora(releases[0].at, tz)})`;
  return listaE(grupos.map((g) => `${diaDeDados(g)} (${hora(g[0].at, tz)})`));
}

/** An instant on `day`'s date on `tz` (its noon): the reference of the date rule for a release shown on that day */
function meioDia(day: Day, tz: string): Date {
  const [year, month, d] = day.split('-').map(Number);
  return localToUtc({ year, month, day: d, hour: 12, minute: 0 }, tz);
}

/**
 * One interval as the plan writes it (c3 §6.3): «ISM de serviços às 10:00 · espera 09:55–10:10», «CPI às 08:30 · só
 * depois das 08:40», «dia de CPI (08:30) · não opero no dia»; hours on the Diário's clock. With `day` (the Diário
 * day), a release on another date of that clock takes its weekday: the wait left over from a «Não opero no dia» past
 * 18:00 shows on the next day as «CPI qui às 17:00 · espera 18:00–18:30» (review 2026-11-20)
 */
export function intervaloDoPlano(iv: BlockInterval, tz: string, day?: Day): string {
  const r0 = iv.releases[0];
  if (iv.kind === 'dia') return `${diaDeDadosComHoras(iv.releases, tz)} · não opero no dia`;
  const nome = cap(rotuloDados(iv.releases, day ? meioDia(day, tz) : r0.at, tz, { outraData: true }));
  return soDepois(iv.releases) ? `${nome} · só depois das ${hora(iv.end, tz)}` : `${nome} · espera ${hora(iv.start, tz)}–${hora(iv.end, tz)}`;
}

/** One entry of the day as the plan reads it: its instant and the data block of the gate answer of its plan */
export interface EntradaDosDados {
  at: Date;
  block: BlockCheck;
}

/** The entries of a day (diario_dia's trades, history left out): the frozen answer, else the recalculated one */
export function entradasDosDados(
  trades: readonly { history: boolean; plan: unknown; gate: { at: Date; block: BlockCheck } | null; gateNow: { at: Date; block: BlockCheck } | null }[],
): EntradaDosDados[] {
  const out: EntradaDosDados[] = [];
  for (const t of trades) {
    if (t.history) continue;
    const g = t.plan ? t.gate : t.gateNow;
    if (g) out.push({ at: g.at, block: g.block });
  }
  return out;
}

/**
 * G6: the data block of a day without entries, computed on screen as the gate would (SPEC §6 G6): the rules of the
 * day's version (diario_dia's plan), the agenda read of that day (E5, `read`; null = not read or failed →
 * `sem_agenda`) through agendaFor (a day not covered on D − 1, D, D + 1 → `sem_agenda`), evaluated at the start of the
 * day on its clock, so `today` holds the day's intervals.
 */
export function blocoDoDia(
  rules: Rules | null,
  account: { market: AccountMarket; dayClock: DayClock },
  day: Day,
  read: AgendaRead | null,
): BlockCheck {
  const clock = rules ? rules.day : account.dayClock;
  const at = tradingDayBounds(day, clock).start;
  const agenda = rules && read ? agendaFor(rules, clock, at, read) : null;
  return evaluateGate(at, account, rules ? { rules } : null, null, { agenda }).block;
}

const NAO_CONFERIDO: readonly string[] = ['sem_agenda', 'fase5'];
const DESLIGADA: readonly string[] = ['regra_desligada', 'sem_calendario'];

/**
 * The «Dados econômicos» line of «O plano do dia» (c3 §6.3, Q27–Q29; SPEC §6 G6), in its eight states:
 * - with entries (`entradas`): from the gate answers of their plans (frozen at the entry, or recalculated for a file):
 *   the intervals of the first entry the app checked; «1 operação na espera, às 10:05», «2 operações, às 10:05 e
 *   10:31» (a whole day), «… antes das 08:40» («Só opero depois do dado»), «Fora do plano»; none inside: «nenhuma
 *   operação na espera» … «No plano»; an entry the app could not check (`sem_agenda`, frozen `fase5`) and none
 *   outside the plan: «Não conferido»; no entry checked: «não conferidos neste dia» · «—» · «Não conferido» (or the
 *   rule off: «regra desligada» · «—» · «Sem regra»);
 * - without entries (`semEntrada`, G6): the block the screen computed for the day from its version and the agenda
 *   read (evaluateGate with agendaFor's entries; `sem_agenda` when the day is not covered); undefined or null =
 *   still reading: the line waits (null).
 * Null for another market and whenever nothing applies (no version).
 */
export function linhaDosDadosDoPlano(
  entradas: readonly EntradaDosDados[],
  semEntrada: BlockCheck | null | undefined,
  conta: ContaDiario,
  dia?: { day: Day; clock: DayClock },
): LinhaDoPlano | null {
  if (!temLinhaDeDados(conta.market)) return null;
  const tz = conta.tz;
  const linha = (plano: string, fato: string, marca: string, tipo: LinhaDoPlano['tipo']): LinhaDoPlano => ({
    item: 'Dados econômicos',
    plano,
    fato,
    marca,
    tipo,
    link: null,
  });
  const naoConferido = () => linha('não conferidos neste dia', '—', 'Não conferido', 'neutro');
  const desligada = () => linha('regra desligada', '—', 'Sem regra', 'neutro');
  type Avaliado = Extract<BlockCheck, { evaluated: true }>;
  const avaliadas = entradas.filter((e) => e.block.evaluated);
  let ivs: readonly BlockInterval[];
  if (!avaliadas.length) {
    const blocks = entradas.length ? entradas.map((e) => e.block) : semEntrada ? [semEntrada] : [];
    if (!blocks.length) return null;
    const b = blocks.find((x): x is Avaliado => x.evaluated);
    if (!b) {
      if (blocks.some((x) => !x.evaluated && NAO_CONFERIDO.includes(x.reason))) return naoConferido();
      if (blocks.some((x) => !x.evaluated && DESLIGADA.includes(x.reason))) return desligada();
      return null;
    }
    ivs = b.today;
  } else {
    // An answer's `today` is the entry's CLOCK day: an entry inside an overnight window past the day's turn counts on
    // the day the window opened, but its `today` holds the next day's waits (review 2026-11-20). The day's intervals
    // come from an entry whose clock day is the Diário day; failing that, from the day's own G6 block.
    const doDia = dia ? avaliadas.find((e) => tradingDayOn(e.at, dia.clock) === dia.day) : avaliadas[0];
    if (doDia) ivs = (doDia.block as Avaliado).today;
    else if (!semEntrada) return null;
    else if (semEntrada.evaluated) ivs = semEntrada.today;
    else {
      // The day's agenda could not be read: the entries' intervals that touch the day (NEW: possibly incomplete)
      const { start, end } = tradingDayBounds(dia!.day, dia!.clock);
      const vistos = new Map<string, BlockInterval>();
      for (const e of avaliadas)
        for (const iv of (e.block as Avaliado).today)
          if (iv.start.getTime() < end.getTime() && iv.end.getTime() > start.getTime()) vistos.set(`${iv.kind}${iv.start.getTime()}${iv.end.getTime()}`, iv);
      ivs = Array.from(vistos.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    }
  }
  const plano = ivs.length ? ivs.map((iv) => intervaloDoPlano(iv, tz, dia?.day)).join(' · ') : 'nenhum dado com espera neste dia';
  const dentro = avaliadas.filter((e) => e.block.evaluated && e.block.state === 'no_bloqueio' && e.block.active);
  const ativos = dentro.map((e) => (e.block as Avaliado).active!);
  const naoChecadas = entradas.some((e) => !e.block.evaluated && NAO_CONFERIDO.includes(e.block.reason));
  const esperas = ivs.filter((iv) => iv.kind === 'espera');
  const soDepoisDoDado = esperas.length > 0 && esperas.every((iv) => soDepois(iv.releases));
  let fato: string;
  if (dentro.length) {
    const horas = listaE(dentro.map((e) => hora(e.at, tz)));
    if (ativos.some((iv) => iv.kind === 'dia')) fato = `${pl(dentro.length, 'operação', 'operações')}, às ${horas}`;
    else if (ativos.every((iv) => soDepois(iv.releases))) fato = `${pl(dentro.length, 'operação', 'operações')} antes das ${hora(ativos[0].end, tz)}`;
    else fato = `${pl(dentro.length, 'operação', 'operações')} na espera, às ${horas}`;
  } else if (!ivs.length) fato = '—';
  else if (ivs.some((iv) => iv.kind === 'dia')) fato = 'nenhuma operação';
  else if (soDepoisDoDado) fato = `nenhuma operação antes das ${hora(esperas[0].end, tz)}`;
  else fato = 'nenhuma operação na espera';
  if (dentro.length) return linha(plano, fato, 'Fora do plano', 'fora');
  if (naoChecadas) return linha(plano, fato, 'Não conferido', 'neutro');
  return linha(plano, fato, 'No plano', 'ok');
}

const WD_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/** «sex 18 dez» */
const diaDaSemanaCurto = (day: Day) => `${WD3[isoWeekdayOf(day) - 1]} ${diaCurto(day)}`;

/**
 * The CME list's label of a day (c3 §6.5, SPEC §8 L4; lib/domain/agenda/feriados): «Quinta, 26 nov: feriado nos EUA»,
 * «Sexta com sessão curta até 13:15 ET»; null on another day. Futuros only (the caller checks the market); whatever
 * the calendars followed, also on a day without the agenda.
 */
export function feriadoDoDia(day: Day): string | null {
  const h = cmeHolidayOn(day);
  if (!h) return null;
  const wd = WD_LONGO[isoWeekdayOf(day) - 1];
  return h.kind === 'curta' && h.closeNy ? `${wd} com sessão curta até ${h.closeNy} ET` : `${wd}, ${diaCurto(day)}: feriado nos EUA`;
}

/** The holiday labels of a week's days (the «Semana» card), Futuros only */
export function feriadosDaSemana(days: readonly Day[], market: AccountMarket): string[] {
  if (!temLinhaDeDados(market)) return [];
  return days.map(feriadoDoDia).filter((x): x is string => !!x);
}

/**
 * The open day's grey line (c3 §6.5, Q27, Q28, Q32): the day's releases in the order of their hour, «ISM de serviços,
 * 10:00»; two «CPI, 08:30 · Decisão do Fed, 14:00»; a cancelled one «CPI · cancelado»; postponed without a new date
 * «CPI · adiado, sem data nova»; one moved to another date, on its first date (the row came by `was_at`) «CPI · adiado
 * para sex 18 dez» (on the new date, the usual label); then the holiday or short session. `rows`: the week's read
 * (null: not read, or failed: no release label, never «nenhum dado» unchecked); only the codes of the calendars the
 * account follows; a day of the account's day clock; hours on the Diário's clock. Futuros only; null when empty.
 */
export function linhaCinzaDoDia(
  rows: readonly AgendaRow[] | null,
  day: Day,
  o: { market: AccountMarket; tz: string; clock: DayClock; calendars: readonly CalendarCode[] },
): string | null {
  if (!temLinhaDeDados(o.market)) return null;
  const itens: { t: number; texto: string; nomes?: string[]; h?: string }[] = [];
  for (const r of rows ?? []) {
    if (!r.code || !o.calendars.includes(r.calendar)) continue;
    const nome = NOMES_DADOS[r.code].nome;
    const noDia = tradingDayOn(r.at, o.clock) === day;
    const antes = r.wasAt !== null && tradingDayOn(r.wasAt, o.clock) === day;
    if (noDia) {
      if (r.status === 'cancelado') itens.push({ t: r.at.getTime(), texto: `${nome} · cancelado` });
      else if (r.status === 'adiado') itens.push({ t: r.at.getTime(), texto: `${nome} · adiado, sem data nova` });
      else {
        // Two releases at one instant are one item, as the plan line writes them: «PCE e PIB dos EUA, 08:30»
        const junto = itens.find((x) => x.t === r.at.getTime() && x.nomes);
        if (junto) junto.nomes!.push(nome);
        else itens.push({ t: r.at.getTime(), texto: '', nomes: [nome], h: hora(r.at, o.tz) });
      }
    } else if (antes && r.status !== 'cancelado') {
      itens.push({ t: r.wasAt!.getTime(), texto: `${nome} · adiado para ${diaDaSemanaCurto(tradingDayOn(r.at, o.clock))}` });
    }
  }
  itens.sort((a, b) => a.t - b.t);
  const partes = itens.map((x) => (x.nomes ? `${listaE(x.nomes)}, ${x.h}` : x.texto));
  const feriado = feriadoDoDia(day);
  if (feriado) partes.push(feriado);
  return partes.length ? partes.join(' · ') : null;
}

/**
 * When the rules changed during the day: «Até 09:40 valia a versão 1: sem regra de breakeven.»,
 * naming what the earlier version had for the window, the limit and the breakeven rule where it
 * differs from the version shown
 */
export function versaoAnterior(change: { versionNo: number; until: Date; rules: Rules }, atual: Rules, conta: ContaDiario): string {
  const old = change.rules;
  const diffs: string[] = [];
  const jOld = janelaDoPlano(old);
  if (jOld !== janelaDoPlano(atual)) diffs.push(jOld ? `janela ${jOld}` : 'sem janela salva');
  const lOld = old.limit ? limiteDoPlano(old.limit, conta.currency) : null;
  if (lOld !== (atual.limit ? limiteDoPlano(atual.limit, conta.currency) : null)) diffs.push(lOld ? `limite ${lOld}` : 'sem limite');
  const bOld = old.breakeven ? breakevenDoPlano(old.breakeven) : null;
  if (bOld !== (atual.breakeven ? breakevenDoPlano(atual.breakeven) : null)) diffs.push(bOld ? `breakeven ${bOld}` : 'sem regra de breakeven');
  const quando = `Até ${hora(change.until, conta.tz)} valia a versão ${change.versionNo}`;
  // NEW: a change elsewhere (the data block, the state rule) leaves only the version's number
  return diffs.length ? `${quando}: ${listaE(diffs)}.` : `${quando}.`;
}

/**
 * The plan's ⓘ. Futuros (the plan has the «Dados econômicos» line, Phase 5-1; c3 §6.3): «janela, dados econômicos e
 * limite», the data in «fora do plano», and the closing sentence without the data rule
 */
export function comoLerOPlano(market: AccountMarket, temBreakeven: boolean): string {
  const dados = temLinhaDeDados(market);
  return (
    (dados
      ? `Cada linha compara as regras que valiam neste dia, em Personalizar, com o que o diário registrou: janela, dados econômicos e limite. Uma operação ${FORA_COM_DADOS_INFO} fica fora do plano, mesmo quando a tela só avisava.`
      : 'Cada linha compara as regras que valiam neste dia, em Personalizar, com o que o diário registrou: janela e limite. Uma operação fora da janela ou depois do limite fica fora do plano, mesmo quando a tela só avisava.') +
    (temBreakeven ? ' Breakeven: a sua regra e em quantas operações que chegaram ao ponto dela o stop foi para a entrada; quem confere é Análises.' : '') +
    (dados ? ' Viés e regra do estado chegam na Fase 5.' : '')
  );
}

// ---------------------------------------------------------------------------------------------
// «O diário registrou:», «o dia mudou», the review, «Antes de operar», the carry-over
// ---------------------------------------------------------------------------------------------

/**
 * «5 operações · −US$ 465,40 · limite atingido às 10:38 · 1 depois do limite, às 10:52 · limite:
 * US$ 465,40 de US$ 400 no pior momento» (live facts, or a review's frozen ones). The data marks (c3 §6.2: «1 na
 * espera do ISM de serviços, às 10:04», «2 em dia de CPI, às 10:04 e 10:31») are not in the facts (SPEC §6 G3: no
 * key): the screen derives them from the day's trades (diarioOperacao.fatosDosDados) and passes them as `dados`, put
 * in the order of the breaks, between «fora da janela» and «depois do limite». Without «viés».
 */
export function fatosTexto(f: DayFacts, conta: ContaDiario, dados: readonly string[] = []): string {
  const m = conta.currency;
  const out = [pl(f.trades, 'operação', 'operações')];
  if (f.trades) out.push(dinheiro(f.net, m));
  if (f.limit?.hitAt) out.push(`limite atingido às ${hora(f.limit.hitAt, conta.tz)}`);
  const fj = f.window?.outside ?? [];
  const dl = f.limit?.after ?? [];
  if (fj.length) out.push(`${fj.length} fora da janela, às ${listaE(fj.map((x) => hora(x.at, conta.tz)))}`);
  out.push(...dados);
  if (dl.length) out.push(`${dl.length} depois do limite, às ${listaE(dl.map((x) => hora(x.at, conta.tz)))}`);
  if (!fj.length && !dados.length && !dl.length && f.window && f.trades) out.push(f.trades > 1 ? 'todas no plano' : 'no plano');
  if (f.limit) out.push(`limite: ${dinheiroCompacto(f.limit.worst, m)} de ${dinheiroCompacto(f.limit.amount, m)} no pior momento`);
  return out.join(' · ');
}

/** «Depois da revisão, o dia mudou: agora 5 operações, −US$ 465,40.» */
export function diaMudouTexto(live: Pick<DayFacts, 'trades' | 'net'>, conta: ContaDiario): string {
  return `Depois da revisão, o dia mudou: agora ${pl(live.trades, 'operação', 'operações')}, ${dinheiro(live.net, conta.currency)}.`;
}

const SEGUIU: Record<Followed, string> = { sim: 'Sim', em_parte: 'Em parte', nao: 'Não' };

/** «Sim», «Em parte», «Não», or «Não preenchido» */
export const seguiuTexto = (f: Followed | null) => (f ? SEGUIU[f] : NAO_PREENCHIDO);

/** «às 11:33» on the review's day, «em 11 nov, às 09:10» on another date (the Diário's clock) */
export function quandoSalva(at: Date, day: Day, tz: string): string {
  const l = utcToLocal(at, tz);
  const hm = formatHhMm(l.minuteOfDay);
  return l.date === day ? `às ${hm}` : `em ${diaCurto(l.date)}, às ${hm}`;
}

/** «Salva às 11:33 · editada às 18:05 · Seguiu o plano? Em parte · pela sua resposta, depois do resultado» */
export function linhaDaRevisao(r: DayReview, day: Day, tz: string): string {
  const t = reviewTimes(r);
  return (
    `Salva ${quandoSalva(t.savedAt, day, tz)}` +
    (t.editedAt ? ` · editada ${quandoSalva(t.editedAt, day, tz)}` : '') +
    ` · Seguiu o plano? ${seguiuTexto(r.followed)} · pela sua resposta, depois do resultado`
  );
}

/** «Versões anteriores (1)» / «Esconder versões anteriores (1)» */
export const versoesBotao = (n: number, abertas: boolean) => `${abertas ? 'Esconder versões anteriores' : 'Versões anteriores'} (${n})`;

/** An older version's title: «Salva às 11:33» */
export const tituloDaVersao = (v: ReviewVersion, day: Day, tz: string) => `Salva ${quandoSalva(v.savedAt, day, tz)}`;

/** A review's fields as the saved view shows them (empty ones «Não preenchido») */
export function camposDaRevisao(v: ReviewVersion): { funcionou: string; diferente: string; seguiu: string; levar: string } {
  return {
    funcionou: v.worked || NAO_PREENCHIDO,
    diferente: v.differently || NAO_PREENCHIDO,
    seguiu: seguiuTexto(v.followed),
    levar: v.carryForward || NAO_PREENCHIDO,
  };
}

/** «Revisão salva às 18:05 ET.» (the status after «Salvar revisão») */
export const revisaoSalvaStatus = (at: Date, tz: string) => `Revisão salva às ${hora(at, tz)}${sufixoRelogio(tz)}.`;

/** «anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada» */
export function notaAntesDeOperar(note: DayNote, firstEntry: Date | null, tz: string): string {
  const t = noteTimes(note, firstEntry);
  const rel = (b: boolean) => `${b ? 'antes' : 'depois'} da 1ª entrada`;
  return (
    `anotado às ${hora(t.saved.at, tz)}, ${rel(t.saved.beforeFirstEntry)}` +
    (t.edited ? ` · editado às ${hora(t.edited.at, tz)}, ${rel(t.edited.beforeFirstEntry)}` : '')
  );
}

/** «Anotado às 10:42 ET.» (the status after saving «Antes de operar») */
export const antesSalvoStatus = (at: Date, tz: string) => `Anotado às ${hora(at, tz)}${sufixoRelogio(tz)}.`;

/** «Do pregão anterior»: «“Esperar o recuo até a VWAP antes de comprar.” · 27 nov» */
export function doPregaoAnterior(c: CarryIn | null): string {
  return c ? `“${c.text}” · ${diaCurto(c.day)}` : 'Nada trazido do pregão anterior.';
}

/**
 * Registered trades deleted on the old page: «1 operação registrada foi apagada às 10:20.»; null
 * without any. (NEW: the plural, «2 operações registradas foram apagadas às 10:20 e 10:31.»)
 */
export function apagadasTexto(deleted: readonly { at: Date; via: string }[], tz: string): string | null {
  const xs = deleted.filter((d) => d.via === 'apagada');
  if (!xs.length) return null;
  const horas = listaE(xs.map((d) => hora(d.at, tz)));
  return xs.length === 1 ? `1 operação registrada foi apagada às ${horas}.` : `${xs.length} operações registradas foram apagadas às ${horas}.`;
}

// ---------------------------------------------------------------------------------------------
// «Semana»
// ---------------------------------------------------------------------------------------------

export interface SemanaTexto {
  /** «Semana em andamento · 2 de 5 pregões», «23 a 27 de novembro · 4 pregões com operações» */
  titulo: string;
  numeros: { rot: 'Resultado' | 'Operações' | 'Fora do plano' | 'Revisões'; val: string; tom: Tom }[];
  /** Without diário trades: «Só Histórico importado nesta semana: +US$ 82,50, à parte do diário.» */
  vazia: string | null;
  barras: { rot: string; val: string; valCurto: string }[];
  /** «Resultado por dia: seg, +56,25 · ter, +26,32 · …» */
  leitor: string;
  info: string;
}

/** The «Semana» card's words. `temLimite` / `temJanela`: the account's rules have them */
export function semanaTexto(w: WeekCard, conta: ContaDiario, regras: { temLimite: boolean; temJanela: boolean; temDados?: boolean }): SemanaTexto {
  const m = conta.currency;
  const range = intervaloLongo(w.weekOf, w.lastShown);
  const titulo = w.inProgress
    ? `Semana em andamento · ${w.pregoesAte} de ${w.columns} pregões`
    : w.withTrades
      ? `${range} · ${pl(w.withTrades, 'pregão com operações', 'pregões com operações')}`
      : range;
  const net = w.diario?.net ?? '0';
  const numeros: SemanaTexto['numeros'] = [
    { rot: 'Resultado', val: dinheiro(net, m), tom: tomDe(net) },
    { rot: 'Operações', val: String(w.diario?.n ?? 0), tom: 'neutral' },
    { rot: 'Fora do plano', val: w.fora ? `${w.fora.n} · ${dinheiro(w.fora.net, m)}` : 'nenhuma', tom: w.fora ? 'amber' : 'neutral' },
    { rot: 'Revisões', val: w.reviews.counted ? `${w.reviews.reviewed} de ${w.reviews.counted}` : '—', tom: 'neutral' },
  ];
  const barras = w.bars.map((b, i) => ({
    rot: WD3[i],
    val: b.net !== null ? numeroDoDia(b.net) : b.future ? '' : '—',
    valCurto: b.net !== null ? numeroCurto(b.net) : b.future ? '' : '—',
  }));
  const leitor = w.bars.map((b, i) => `${WD3[i]}, ${b.net !== null ? numeroDoDia(b.net) : b.future ? 'ainda não aconteceu' : 'sem operações'}`);
  return {
    titulo,
    numeros,
    vazia: w.diario ? null : w.history ? `Só Histórico importado nesta semana: ${dinheiro(w.history.net, m)}, à parte do diário.` : 'Nenhuma operação nesta semana.',
    barras,
    leitor: `Resultado por dia: ${leitor.join(' · ')}.`,
    info:
      `Pregões de ${range}. ` +
      (regras.temDados && regras.temLimite
        ? `Fora do plano: ${FORA_COM_DADOS}. `
        : regras.temLimite
          ? 'Fora do plano: fora da janela ou depois do limite. '
          : regras.temJanela
            ? 'Fora do plano: fora da janela. '
            : '') +
      'Revisões: dos pregões com operação registrada no app ou com revisão, quantos têm revisão; hoje só entra depois que você escrever a revisão dele. A coluna Semana do calendário traz os mesmos números.',
  };
}

const LADO: Record<ForaTrade['direction'], string> = { long: 'Compra', short: 'Venda', call: 'Alta', put: 'Baixa' };
const QUEBRA: Record<PlanBreak, string> = {
  fora_da_janela: 'fora da janela',
  // NEW · OPEN POINT for the owner (contract conflict SPEC §6 C4 «as duas marcas novas» against G3 «os fatos do dia
  // não ganham chave»): the month's list carries the break, not the gate, so which data and which kind are unknown
  // here; c3's fallbacks «na espera de dado» / «em dia de dado» each assume a kind. Not a lane decision: escalated.
  no_bloqueio: 'dado econômico',
  depois_do_limite: 'depois do limite',
  contra_a_regra: 'contra a regra',
};

/** The week's «Fora do plano» list: «ter 24 · 11:05 · Compra MES · fora da janela · −US$ 40,00» */
export function foraDaSemanaItem(t: ForaTrade, conta: ContaDiario): string {
  const p = parts(t.day);
  const fim = t.open || t.net === null ? 'aberta' : dinheiro(t.net, conta.currency);
  return `${WD3[isoWeekdayOf(t.day) - 1]} ${p.d} · ${hora(t.entryTime, conta.tz)} · ${LADO[t.direction]} ${t.symbol} · ${t.breaks.map((b) => QUEBRA[b]).join(' · ')} · ${fim}`;
}

// ---------------------------------------------------------------------------------------------
// The account selector with many accounts (from 10)
// ---------------------------------------------------------------------------------------------

export const SELETOR_MUITAS = {
  /** The search field's label and placeholder */
  buscar: 'Buscar conta',
  placeholder: 'Nome da conta ou da mesa',
  /** «Futuros · 30», «Apex · 9» */
  grupo: (nome: string, n: number) => `${nome} · ${n}`,
  /** NEW: accounts without a firm, inside a market split by firm */
  semMesa: 'Sem mesa',
  /** The screen-reader status of the search */
  achadas: (n: number) => (n ? `${pl(n, 'conta encontrada', 'contas encontradas')}.` : 'Nenhuma conta encontrada.'),
  /** Nothing found: «Nenhuma conta com “xyz”.» */
  nenhuma: (busca: string) => `Nenhuma conta com “${busca.trim()}”.`,
};

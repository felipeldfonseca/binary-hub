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
import { EVERY_DAY, MON_TO_FRI, formatHhMm, isoWeekdayOf, utcToLocal } from '@/lib/domain/tempo';
import type { AccountMarket, Currency } from '@/lib/domain/markets';
import type { PlanBreak, Rules } from '@/lib/domain/gate';
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
    return {
      res,
      resCurto,
      dica: `${curto} · ${dinheiro(h.net, conta.currency)} · ${h.n} op.: ${ganhosEPerdas(h, conta.market)} · Histórico importado · só resultado`,
      aria: `${curto}, ${res} ${moeda}, ${h.n} op., Histórico importado${hoje}`,
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
  if (d.kind !== 'historico') {
    if (d.review) out.push('Revisão escrita');
    else if (isPendingReview(d, today)) out.push('Sem revisão');
  }
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
    foraTom: 'muted',
  };
}

const SOMANDO_INFO =
  ' Com “somando as contas de Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai da soma, também nos dias passados.';

/**
 * «Como ler os números do dia» on a diário or misto day: net or still gross, the limit, «fora do
 * plano» with the other trades' simple sum, and the misto day's history apart. Before the day's
 * first trade only the limit is explained (as the board's empty day).
 */
export function comoLerOsNumeros(t: DayTiles, conta: ContaDiario, f: Pick<DayFacts, 'trades' | 'window' | 'limit'>): string {
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
    let s = t.limit ? 'Fora do plano: operações fora da janela ou depois do limite.' : 'Fora do plano: operações fora da janela.';
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
  item: 'Janela' | 'Limite' | 'Breakeven';
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
 * «O plano do dia»: Janela, Limite and (with the rule) Breakeven, from the rules of the version in
 * force at the day's end and the day's facts. The breakeven row only records (no verdict:
 * Análises judges it).
 */
export function linhasDoPlano(rules: Rules, f: DayFacts, conta: ContaDiario): LinhaDoPlano[] {
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
      fato: b.trades ? `moveu em ${b.moved} de ${b.trades}` : 'nenhuma chegou ao ponto da regra',
      marca: 'Registrado',
      tipo: 'neutro',
      link: null,
    });
  }
  return rows;
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

/** The plan's ⓘ (Futuros get the Phase 5 sentence) */
export function comoLerOPlano(market: AccountMarket, temBreakeven: boolean): string {
  return (
    'Cada linha compara as regras que valiam neste dia, em Personalizar, com o que o diário registrou: janela e limite. Uma operação fora da janela ou depois do limite fica fora do plano, mesmo quando a tela só avisava.' +
    (temBreakeven ? ' Breakeven: a sua regra e em quantas operações que chegaram ao ponto dela o stop foi para a entrada; quem confere é Análises.' : '') +
    (market === 'futures' ? ' Bloqueio de dados, viés e regra do estado chegam na Fase 5.' : '')
  );
}

// ---------------------------------------------------------------------------------------------
// «O diário registrou:», «o dia mudou», the review, «Antes de operar», the carry-over
// ---------------------------------------------------------------------------------------------

/**
 * «5 operações · −US$ 465,40 · limite atingido às 10:38 · 1 depois do limite, às 10:52 · limite:
 * US$ 465,40 de US$ 400 no pior momento» (live facts, or a review's frozen ones). Without
 * «bloqueio» and «viés» until Phase 5.
 */
export function fatosTexto(f: DayFacts, conta: ContaDiario): string {
  const m = conta.currency;
  const out = [pl(f.trades, 'operação', 'operações')];
  if (f.trades) out.push(dinheiro(f.net, m));
  if (f.limit?.hitAt) out.push(`limite atingido às ${hora(f.limit.hitAt, conta.tz)}`);
  const fj = f.window?.outside ?? [];
  const dl = f.limit?.after ?? [];
  if (fj.length) out.push(`${fj.length} fora da janela, às ${listaE(fj.map((x) => hora(x.at, conta.tz)))}`);
  if (dl.length) out.push(`${dl.length} depois do limite, às ${listaE(dl.map((x) => hora(x.at, conta.tz)))}`);
  if (!fj.length && !dl.length && f.window && f.trades) out.push(f.trades > 1 ? 'todas no plano' : 'no plano');
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
export function semanaTexto(w: WeekCard, conta: ContaDiario, regras: { temLimite: boolean; temJanela: boolean }): SemanaTexto {
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
      (regras.temLimite ? 'Fora do plano: fora da janela ou depois do limite. ' : regras.temJanela ? 'Fora do plano: fora da janela. ' : '') +
      'Revisões: dos pregões com operação registrada no app ou com revisão, quantos têm revisão; hoje só entra depois que você escrever a revisão dele. A coluna Semana do calendário traz os mesmos números.',
  };
}

const LADO: Record<ForaTrade['direction'], string> = { long: 'Compra', short: 'Venda', call: 'Alta', put: 'Baixa' };
const QUEBRA: Record<PlanBreak, string> = {
  fora_da_janela: 'fora da janela',
  no_bloqueio: 'no bloqueio',
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

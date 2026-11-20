/**
 * The words of «Posso operar hoje?» and of the plan marks, in pt-BR, from the domain's results
 * (lib/domain/gate). Pure functions, no React: the screens (Diário card, Personalizar «Como fica
 * hoje», the window line under the account selector) render what these return.
 *
 * Window times are always on the window's own clock («10:00 ET», «20:00 de Brasília»); the time
 * a limit was reached or a block ends is on the account's day clock. Money is in the currency of
 * the rules' market (currencyOf: R$ on B3, US$ everywhere else).
 */
import { formatHhMm, utcToLocal } from '@/lib/domain';
import { tradingDayOn } from '@/lib/domain/tempo';
import {
  ACCOUNT_MARKETS,
  answerOf,
  releasesOf,
  type AgendaRead,
  type BlockRelease,
  type ReleaseCode,
  centsToUsd,
  currencyOf,
  type AccountMarket,
  type Currency,
  type CheckKey,
  type GateResult,
  type GateWarning,
  type PlanBreak,
  type PlanResult,
  type Rules,
  type StateRuleCheck,
} from '@/lib/domain/gate';
import { NOMES_DADOS, PALAVRAS_DADOS, horaDeVolta, marcaDados, rotuloDados, rotuloDia, soDepois } from './dadosEconomicos';
import { formatMoney } from './formato';
import { contaAntigaDesde } from './avisoDados';

/** Board colour tokens: --mint, --amber, --red, --text (neutral), --text-2 (muted) */
export type Tom = 'mint' | 'amber' | 'red' | 'neutral' | 'muted';

export interface PossoLinha {
  /**
   * «Liberado», «Fora da sua janela», «Encerrado por hoje», «Aguardar até 08:40», «Não opero hoje»,
   * «Sem janela salva», «Limite do dia indisponível», «Dados econômicos não conferidos»
   */
  palavra: string;
  tom: Tom;
  /** What follows « · »: «abre às 10:00 ET», «até 11:00 ET», «com aviso do limite», «ISM de serviços às 10:00» */
  sub: string | null;
  /** «Definir» → Personalizar, when nothing was evaluated */
  acao: { texto: string; href: string; aria: string } | null;
  /** «Limite do dia US$ 0 de US$ 400» («R$ 0 de R$ 500» on B3); null when the account has no limit */
  limite: { usado: string; de: string; aria: string; indisponivel: boolean } | null;
  /**
   * «Tentar de novo» after the sub: only the grey «Liberado» without the agenda and «Dados econômicos não
   * conferidos» (c3 §5.4; Q12 draws it, Q16 «Fora da sua janela» without the agenda does not)
   */
  tentar?: boolean;
}

const NBSP = ' ';
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** ' ET' on New York's clock, ' de Brasília' on São Paulo's */
export function sufixoRelogio(tz: string): string {
  return tz === 'America/Sao_Paulo' ? ' de Brasília' : tz === 'America/New_York' ? ' ET' : ` (${tz})`;
}

/** An instant as 'HH:MM' on a zone's clock */
export function horaNoRelogio(instant: Date, tz: string): string {
  return formatHhMm(utcToLocal(instant, tz).minuteOfDay);
}

/**
 * 'US$ 400', 'US$ 11,50', 'R$ 1.000': the compact form (no ',00') of a positive amount. The
 * currency has no default, so every caller names it (currencyOf(rules.market) for an account).
 */
export function dinheiroCompacto(cents: number, currency: Currency): string {
  return formatMoney(String(centsToUsd(Math.abs(cents))), { currency }).replace(/,00$/, '');
}

function faixa(startMin: number, endMin: number): string {
  return `${formatHhMm(startMin)}–${formatHhMm(endMin)}`;
}

/**
 * The line under the account selector: «Janela 10:00–11:00 ET», «Janela 20:00–21:00 · Brasília»,
 * «Janela 10:00–11:00 e 14:00–15:00 ET», or «Sem janela salva».
 */
export function janelaLinha(rules: Rules | null): string {
  if (!rules || rules.windows.length === 0) return 'Sem janela salva';
  const faixas = rules.windows.map((w) => faixa(w.startMin, w.endMin)).join(' e ');
  return rules.windows[0].tz === 'America/Sao_Paulo' ? `Janela ${faixas} · Brasília` : `Janela ${faixas}${sufixoRelogio(rules.windows[0].tz)}`;
}

/** The window clock of an account's rules (hours of «Dados econômicos» show on it, SPEC §5.6) */
export function relogioDaJanela(rules: Rules | null): string {
  return rules?.windows[0]?.tz ?? rules?.day.tz ?? 'America/New_York';
}

/** '' (same date), 'amanhã ', or 'seg ' … on the window's clock */
function quando(next: Date, now: Date, tz: string): string {
  const a = utcToLocal(now, tz);
  const b = utcToLocal(next, tz);
  if (a.date === b.date) return '';
  const days = Math.round((Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)) / 86_400_000);
  return days === 1 ? 'amanhã ' : `${WEEKDAYS[b.isoWeekday - 1]} `;
}

function avisos(warnings: GateWarning[], naoEDia: boolean): string | null {
  const parts: string[] = [];
  if (warnings.includes('fora_janela')) parts.push(naoEDia ? 'com aviso: hoje não é dia da janela' : 'com aviso: fora da janela');
  if (warnings.includes('limite')) parts.push('com aviso do limite');
  return parts.length ? parts.join(' · ') : null;
}

/** The sub of «Liberado» when the agenda was missing (SPEC §7.2 «Nunca verde») */
export const LIBERADO_SEM_AGENDA = `${PALAVRAS_DADOS.naoConferidosSub} · sem a agenda de hoje`;

/**
 * One account's line of «Posso operar hoje?» (Início card, Diário in Phase 2) from its answer
 * (evaluateGate or parseServerGate) and the rules that produced it (null before version 1).
 * `agora` is when the screen draws (the day words of «Dados econômicos»: «amanhã», the weekday);
 * by default the answer's instant.
 */
export function possoLinha(conta: string, r: GateResult, rules: Rules | null, agora: Date = r.at): PossoLinha {
  const a = answerOf(r);
  const wtz = relogioDaJanela(rules);
  const dtz = rules?.day.tz ?? wtz;

  let limite: PossoLinha['limite'] = null;
  if (rules?.limit) {
    const moeda = currencyOf(rules.market);
    const de = `de ${dinheiroCompacto(rules.limit.cents, moeda)}`;
    if (r.limit.evaluated) {
      const usado = dinheiroCompacto(r.limit.worstCents, moeda);
      limite = { usado, de, aria: `${conta}, limite do dia: ${usado} ${de}.`, indisponivel: false };
    } else {
      limite = { usado: '—', de, aria: `${conta}, limite do dia indisponível.`, indisponivel: true };
    }
  }
  const base = { acao: null, limite };

  switch (a.kind) {
    case 'encerrado':
      return {
        ...base,
        palavra: 'Encerrado por hoje',
        tom: 'red',
        sub: a.hitAt ? `limite atingido às ${horaNoRelogio(a.hitAt, dtz)}` : 'limite atingido',
      };
    // «Dados econômicos»: the hours on the window clock (SPEC §5.6)
    case 'aguardar':
      return {
        ...base,
        palavra: `Aguardar até ${horaDeVolta(a.until, agora, wtz)}`,
        tom: 'amber',
        sub: `${rotuloDados(a.releases, agora, wtz)}${soDepois(a.releases) ? ` · ${PALAVRAS_DADOS.soDepois}` : ''}`,
      };
    case 'dia': {
      // The start of the account day: the `dia` interval's start (SPEC §4.1, [S(R), E(R)))
      const inicioDoDia = r.block.evaluated && r.block.active?.kind === 'dia' ? r.block.active.start : undefined;
      return {
        ...base,
        palavra: 'Não opero hoje',
        tom: 'amber',
        sub: a.source === 'dia' ? rotuloDia(a.releases, agora, wtz, { inicioDoDia }) : rotuloDados(a.releases, agora, wtz),
      };
    }
    case 'fora_janela':
      return {
        ...base,
        palavra: 'Fora da sua janela',
        tom: 'amber',
        sub:
          a.position === 'nao_e_dia'
            ? 'hoje não é dia da janela'
            : a.next
              ? `abre ${quando(a.next.start, r.at, wtz)}às ${horaNoRelogio(a.next.start, wtz)}${sufixoRelogio(wtz)}`
              : null,
      };
    case 'liberado': {
      const aviso = avisos(a.warnings, a.position === 'nao_e_dia');
      // Without the agenda «Liberado» is never green (SPEC §5.4 rule 4): the text colour, as Q12 draws it
      // (resumo_para_o_dono: «na cor do texto»), with «Tentar de novo»
      if (a.semAgenda) {
        return { ...base, palavra: 'Liberado', tom: 'neutral', sub: [aviso, LIBERADO_SEM_AGENDA].filter(Boolean).join(' · '), tentar: true };
      }
      return {
        ...base,
        palavra: 'Liberado',
        tom: aviso ? 'neutral' : 'mint',
        sub: aviso ?? (a.until ? `até ${horaNoRelogio(a.until, wtz)}${sufixoRelogio(wtz)}` : null),
      };
    }
    case 'indisponivel':
      // The screen offers «Tentar de novo» from `limite.indisponivel`
      return a.reason === 'sem_agenda'
        ? { ...base, palavra: PALAVRAS_DADOS.naoConferidos, tom: 'muted', sub: null, tentar: true }
        : { ...base, palavra: 'Limite do dia indisponível', tom: 'muted', sub: null };
    case 'sem_janela':
      return a.reason === 'regra_desligada'
        ? {
            ...base,
            palavra: 'Sem regra ativa',
            tom: 'muted',
            sub: null,
            acao: { texto: 'Ajustar', href: '/personalizar#regras', aria: `Ajustar as regras da ${conta} em Personalizar` },
          }
        : {
            ...base,
            palavra: 'Sem janela salva',
            tom: 'muted',
            sub: null,
            acao: { texto: 'Definir', href: '/personalizar#janelas', aria: `Definir a janela da ${conta} em Personalizar` },
          };
  }
}

/** The line as one string, for a test or a title: «Fora da sua janela · abre às 10:00 ET» */
export function possoTexto(l: PossoLinha): string {
  return [l.palavra, l.sub ?? l.acao?.texto].filter(Boolean).join(' · ');
}

// The data break keeps its code (`no_bloqueio`, c3 §9.1); its words come from the entry's gate (c3 §9.2 item 13)
const MARCAS: Record<Exclude<PlanBreak, 'no_bloqueio'>, string> = {
  fora_da_janela: 'fora da janela',
  depois_do_limite: 'depois do limite',
  contra_a_regra: 'contra a regra',
};

/**
 * The «Plano» column: «No plano», «● fora da janela · depois do limite», «● na espera do ISM», «● em dia de CPI», «—», or
 * the imported history. The data break is worded from the plan's gate (`block.active`, marcaDados; «na espera de dado»
 * when the answer does not carry it)
 */
export function marcaDoPlano(p: PlanResult): { texto: string; tom: Tom } {
  if (p.verdict === 'fora_do_plano') {
    const active = p.gate.block.evaluated ? p.gate.block.active : null;
    const words = p.breaks.map((b) => (b === 'no_bloqueio' ? marcaDados(active) : MARCAS[b]));
    return { texto: `●${NBSP}${words.join(' · ')}`, tom: 'amber' };
  }
  if (p.verdict === 'no_plano') return { texto: 'No plano', tom: 'mint' };
  if (!p.gate.window.evaluated && p.gate.window.reason === 'sem_versao') {
    return { texto: 'Histórico importado · só resultado', tom: 'muted' };
  }
  return { texto: '—', tom: 'muted' };
}

// The code name `bloqueio` stays (c3 §9.1); the screen says «dados econômicos» (c3 §9.2 item 14)
const NOMES: Record<CheckKey, string> = { janela: 'janela', bloqueio: 'dados econômicos', limite: 'limite', estado: 'regra do estado' };

const lista = (names: readonly string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`);

/** «Conferidos: janela, dados econômicos e limite.»; null when nothing was checked */
export function conferidos(checks: readonly CheckKey[]): string | null {
  if (checks.length === 0) return null;
  return `Conferidos: ${lista(checks.map((c) => NOMES[c]))}.`;
}

/** The ending of what the agenda's absence left unchecked (c3 §5.4) */
const SEM_AGENDA_DE_HOJE = '(o app está sem a agenda de hoje)';

/**
 * The sentence under «Posso operar hoje?» (c3 §5.2 l.941, §5.4; SPEC §7.2): «Conferidos: janela, dados econômicos e
 * limite.»; without the day's agenda it also says what was not checked: «Conferidos: janela e limite. Não conferido:
 * dados econômicos (o app está sem a agenda de hoje).», «Conferido: limite. Não conferido: …» (the window off) and,
 * when the limit has no reading either, «Não conferidos: limite do dia e dados econômicos (o app está sem a agenda de
 * hoje).» With the agenda there, it lists only what was checked, as before (the limit's absence alone is Phase 2's,
 * SPEC §5.4 last line). null when nothing was checked and nothing is missing.
 */
export function conferidosDoGate(gate: GateResult): string | null {
  const semAgenda = !gate.block.evaluated && gate.block.reason === 'sem_agenda';
  if (!semAgenda) return conferidos(gate.checksEvaluated);
  const feitos = gate.checksEvaluated.map((c) => NOMES[c]);
  const faltam = [...(!gate.limit.evaluated && gate.limit.reason === 'sem_dados' ? ['limite do dia'] : []), 'dados econômicos'];
  const naoConferido = `${faltam.length === 1 ? 'Não conferido' : 'Não conferidos'}: ${lista(faltam)} ${SEM_AGENDA_DE_HOJE}.`;
  if (feitos.length === 0) return naoConferido;
  return `${feitos.length === 1 ? 'Conferido' : 'Conferidos'}: ${lista(feitos)}. ${naoConferido}`;
}

/**
 * The grey line «Mais tarde: ISM de serviços às 10:00, espera das 09:55 às 10:10.» (c3 §5.2 case 12; SPEC §7.2
 * l.1163): the next wait of the answer's day still to start at `agora`, under «Liberado» and «Fora da sua janela» only
 * («… , e mais 1 hoje.» when another follows). Hours on the window clock. The screen hides it while the 10-minute
 * notice shows (c3 §5.2 l.937). null otherwise.
 */
export function maisTarde(gate: GateResult, rules: Rules | null, agora: Date = gate.at): string | null {
  const a = answerOf(gate);
  if ((a.kind !== 'liberado' && a.kind !== 'fora_janela') || !gate.block.evaluated) return null;
  const wtz = relogioDaJanela(rules);
  const futuras = gate.block.today.filter((i) => i.kind === 'espera' && i.start.getTime() > agora.getTime());
  if (futuras.length === 0) return null;
  const [p] = futuras;
  const frase = `Mais tarde: ${rotuloDados(p.releases, agora, wtz)}, espera das ${horaNoRelogio(p.start, wtz)} às ${horaNoRelogio(p.end, wtz)}`;
  return futuras.length > 1 ? `${frase}, e mais ${futuras.length - 1} hoje.` : `${frase}.`;
}

/** «do ISM de serviços», «do PCE e do PIB dos EUA», «da decisão do BCE e mais 2 dados» */
export function doDaDados(releases: readonly BlockRelease[]): string {
  const codes = Array.from(new Set(releases.map((r) => r.code)));
  if (codes.length >= 3) return `${NOMES_DADOS[codes[0]].doDa} e mais ${codes.length - 1} dados`;
  return codes.map((c) => NOMES_DADOS[c].doDa).join(' e ');
}

/**
 * The 10-minute notice (c3 §8.2; SPEC §7.2 l.1187): «Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.»,
 * two releases «Às 08:25 começa a espera do PCE e do PIB dos EUA (08:30), até 08:40.». The wait is the one the screen's
 * clock gives (useRelogioDados / relogioDados: `avisoDezMin`); its hour in parentheses is the first release's. On the
 * window clock.
 */
export function avisoDezMinTexto(aviso: { start: Date; end: Date; releases: readonly BlockRelease[] }, clock: string): string {
  const dado = aviso.releases[0] ? ` (${horaNoRelogio(aviso.releases[0].at, clock)})` : '';
  return `Às ${horaNoRelogio(aviso.start, clock)} começa a espera ${doDaDados(aviso.releases)}${dado}, até ${horaNoRelogio(aviso.end, clock)}.`;
}

/**
 * The first-wait notice under the answer (c3 §3.9 l.652-654; SPEC §7.2 l.1191; Q18): «Esta espera vem da regra “Dados
 * econômicos” desta conta (5 min antes e 10 depois dos dados fortes). O app passou a conferi-la; você muda em
 * Personalizar.», with the account's own minutes. Only while the answer is a wait («Aguardar até») of «a conta antiga»
 * (c3 §3.9): its first rules version took effect before the delivery (`desdeDay`, lib/hub/avisoDados'
 * ENTREGA_DADOS_ECONOMICOS, the same date as Personalizar's notice) and its rule is still in the form saved by the old
 * code (the short form: no `releases`), switched on with minutes. The screen also hides it once «Entendi» was pressed
 * on this device (lib/hub/avisoDados).
 */
export function avisoPrimeiraEspera(gate: GateResult, rules: Rules | null, desdeDay: string | null | undefined): string | null {
  const b = rules?.block;
  if (!contaAntigaDesde(desdeDay)) return null;
  if (!b || !b.on || b.releases || b.beforeMin + b.afterMin === 0) return null;
  if (answerOf(gate).kind !== 'aguardar') return null;
  return (
    `Esta espera vem da regra “Dados econômicos” desta conta (${b.beforeMin} min antes e ${b.afterMin} depois dos dados fortes). ` +
    'O app passou a conferi-la; você muda em Personalizar.'
  );
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Agreement of «cancelado» / «adiado» with each release's name (c3 §2.2's line forms) */
const GENERO: Partial<Record<ReleaseCode, 'a' | 'os' | 'as'>> = {
  fomc_decisao: 'a',
  fomc_entrevista: 'a',
  bce_decisao: 'a',
  bce_entrevista: 'a',
  copom: 'a',
  confianca_us: 'a',
  hicp_eu: 'a',
  varejo_us: 'as',
  casas_novas: 'as',
  casas_usadas: 'as',
};
const concorda = (code: ReleaseCode, palavra: 'cancelad' | 'adiad') => `${palavra}${GENERO[code] ?? 'o'}`;

/**
 * The grey line of a release of today cancelled or postponed (c3 §5.2 case 17, §12.5; SPEC §7.2 l.1166 and l.1234):
 * «CPI de hoje cancelado: sem espera hoje.», «CPI adiado para sex 18 dez: sem espera hoje.». From the day's agenda read
 * the screen already makes (E5, with each row's status; the gate never receives a cancelled release), only for a code
 * the account waits on (its rule on, the code in its map) and a row of the account's day (`at`, or `wasAt` for a
 * postponed one). NEW (not drawn). One line per row, in the read's order.
 */
export function dadosCanceladosHoje(read: AgendaRead | null | undefined, gate: GateResult, rules: Rules | null): string[] {
  const b = rules?.block;
  if (!read || !b || !b.on) return [];
  // Only where the gate would have waited (SPEC §7.2 l.1234): not for a rule the gate itself sets aside (0+0 minutes,
  // `regra_desligada`; outside Futuros), and a «volta» code only with minutes around it
  if (!gate.block.evaluated && gate.block.reason !== 'sem_agenda') return [];
  const mapa = releasesOf(b);
  const semMinutos = b.beforeMin + b.afterMin === 0;
  const clock = { tz: rules.day.tz, startMin: rules.day.startMin };
  const wtz = rules.windows[0]?.tz ?? rules.day.tz;
  const out: string[] = [];
  for (const row of read.rows) {
    if (!row.code || !mapa[row.code] || !b.calendars.includes(row.calendar)) continue;
    if (mapa[row.code] === 'volta' && semMinutos) continue;
    const nome = `${NOMES_DADOS[row.code].nome} de hoje`;
    if (row.status === 'cancelado' && tradingDayOn(row.at, clock) === gate.tradingDay) {
      out.push(`${nome} ${concorda(row.code, 'cancelad')}: sem espera hoje.`);
    } else if (row.status === 'adiado' && row.wasAt && tradingDayOn(row.wasAt, clock) === gate.tradingDay && tradingDayOn(row.at, clock) !== gate.tradingDay) {
      const d = utcToLocal(row.at, wtz);
      const quando = `${WEEKDAYS[d.isoWeekday - 1]} ${Number(d.date.slice(8, 10))} ${MESES[Number(d.date.slice(5, 7)) - 1]}`;
      out.push(`${NOMES_DADOS[row.code].nome} ${concorda(row.code, 'adiad')} para ${quando}: sem espera hoje.`);
    }
  }
  return out;
}

const ESCOLHAS = { opero: 'opero', so_a_favor: 'só a favor', nao_opero: 'não opero' } as const;

/** The state rule of a trade: «ok · só a favor», «contra · não opero», «não conferida», «sem regra escolhida» … */
export function regraDoEstado(c: StateRuleCheck): string | null {
  if (c.evaluated) return `${c.state} · ${ESCOLHAS[c.choice]}`;
  switch (c.reason) {
    case 'fase5':
      return 'ativo na Fase 5';
    case 'sem_escolha':
      return 'sem regra escolhida';
    case 'sem_estado':
      return 'sem estado na entrada';
    case 'comparacao_suspensa':
    case 'sem_direcao':
      return 'não conferida';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// «Posso operar hoje?» on the Diário (Phase 4, «Muitas contas»: owner's request of 25 Oct 2026)
// ---------------------------------------------------------------------------------------------

/** What the Diário's card reads of one account of rules_now() */
export interface ContaPosso {
  accountId: string;
  label: string;
  market: AccountMarket;
  gate: GateResult;
  /** null before version 1 */
  rules: Rules | null;
  /** The trading day of version 1 (rules_now's desde_day; null before it): «a conta antiga» of the Q18 notice */
  desdeDay?: string | null;
}

/**
 * The others line's states, in its order (board choice 9: «liberadas · encerradas por hoje · fora da
 * janela · sem janela salva»; Phase 5: «aguardando dado», «em dia sem operar» and «liberadas, dados não
 * conferidos», never counted in the green «liberadas», SPEC §7.2 C12)
 */
export type EstadoDaConta =
  | 'liberada'
  | 'liberada_com_aviso'
  | 'liberada_sem_agenda'
  | 'encerrada'
  | 'aguardando'
  | 'dia_sem_operar'
  | 'fora_da_janela'
  | 'sem_janela'
  | 'outra';
export const ORDEM_DOS_ESTADOS: readonly EstadoDaConta[] = [
  'liberada',
  'liberada_com_aviso',
  'liberada_sem_agenda',
  'encerrada',
  'aguardando',
  'dia_sem_operar',
  'fora_da_janela',
  'sem_janela',
  'outra',
];

const ESTADO_PALAVRAS: Record<EstadoDaConta, { um: string; varios: string; tom: Tom }> = {
  liberada: { um: 'liberada', varios: 'liberadas', tom: 'mint' },
  liberada_com_aviso: { um: 'liberada com aviso', varios: 'liberadas com aviso', tom: 'neutral' },
  liberada_sem_agenda: { um: 'liberada, dados não conferidos', varios: 'liberadas, dados não conferidos', tom: 'muted' },
  encerrada: { um: 'encerrada por hoje', varios: 'encerradas por hoje', tom: 'red' },
  aguardando: { um: 'aguardando dado', varios: 'aguardando dado', tom: 'amber' },
  dia_sem_operar: { um: 'em dia sem operar', varios: 'em dia sem operar', tom: 'amber' },
  fora_da_janela: { um: 'fora da janela', varios: 'fora da janela', tom: 'amber' },
  sem_janela: { um: 'sem janela salva', varios: 'sem janela salva', tom: 'muted' },
  // «Sem regra ativa», «Limite do dia indisponível», «Dados econômicos não conferidos»
  outra: { um: 'com outra resposta', varios: 'com outra resposta', tom: 'muted' },
};

/** The state an account counts as in the others line, from the same answer possoLinha words */
export function estadoDaConta(gate: GateResult): EstadoDaConta {
  const a = answerOf(gate);
  switch (a.kind) {
    case 'liberado':
      if (a.semAgenda) return 'liberada_sem_agenda';
      return avisos(a.warnings, a.position === 'nao_e_dia') ? 'liberada_com_aviso' : 'liberada';
    case 'encerrado':
      return 'encerrada';
    case 'aguardar':
      return 'aguardando';
    case 'dia':
      return 'dia_sem_operar';
    case 'fora_janela':
      return 'fora_da_janela';
    case 'sem_janela':
      return a.reason === 'regra_desligada' ? 'outra' : 'sem_janela';
    default:
      return 'outra';
  }
}

export interface LinhaDaConta {
  accountId: string;
  label: string;
  linha: PossoLinha;
}

export interface OutrasContas {
  /** «Outra conta:», «Outras 7 contas:» */
  titulo: string;
  /** «5 fora da janela» · «2 sem janela salva», «todas fora da janela», or the one other account's state */
  partes: { texto: string; tom: Tom }[];
  /** «Ver todas» / «Ver a outra conta» (closed when the page opens) */
  verTodas: string;
  ocultar: string;
  /** Their lines in the card's order (by market, then the server's order), for «Ver todas» */
  contas: LinhaDaConta[];
}

export interface PossoNoDiario {
  /** The account open in the Diário; null when it is not among the answers */
  conta: (LinhaDaConta & { somando: boolean }) | null;
  /** One line for the others; null without other accounts (the line is not shown) */
  outras: OutrasContas | null;
}

const marketRank = (m: AccountMarket) => {
  const i = ACCOUNT_MARKETS.indexOf(m);
  return i < 0 ? ACCOUNT_MARKETS.length : i;
};

/**
 * «Posso operar hoje?» on the Diário: only the selected account, with «somando as contas de
 * Futuros» under its limit when the limit sums them, and ONE line for the others counting their
 * answers in a fixed order («Outras 34 contas: 19 liberadas · 3 encerradas por hoje · 9 fora da
 * janela · 3 sem janela salva»; «todas fora da janela» when they all share one state; the state
 * alone with one other account). The view of every account goes to the Início (Phase 8).
 */
export function possoNoDiario(accounts: readonly ContaPosso[], selectedId: string, agora?: Date): PossoNoDiario {
  const ordered = accounts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => marketRank(x.a.market) - marketRank(y.a.market) || x.i - y.i)
    .map((x) => x.a);
  const sel = ordered.find((a) => a.accountId === selectedId) ?? null;
  const others = ordered.filter((a) => a.accountId !== selectedId);
  const linhaDe = (a: ContaPosso): LinhaDaConta => ({ accountId: a.accountId, label: a.label, linha: possoLinha(a.label, a.gate, a.rules, agora ?? a.gate.at) });

  let outras: OutrasContas | null = null;
  if (others.length) {
    const n = others.length;
    const contagem = Object.fromEntries(ORDEM_DOS_ESTADOS.map((e) => [e, 0])) as Record<EstadoDaConta, number>;
    for (const a of others) contagem[estadoDaConta(a.gate)] += 1;
    const presentes = ORDEM_DOS_ESTADOS.filter((e) => contagem[e] > 0);
    outras = {
      titulo: n === 1 ? 'Outra conta:' : `Outras ${n} contas:`,
      partes: presentes.map((e) => {
        const w = ESTADO_PALAVRAS[e];
        const k = contagem[e];
        const texto = n === 1 ? w.um : presentes.length === 1 ? `todas ${w.varios}` : `${k} ${k === 1 ? w.um : w.varios}`;
        return { texto, tom: w.tom };
      }),
      verTodas: n === 1 ? 'Ver a outra conta' : 'Ver todas',
      ocultar: 'Ocultar',
      contas: others.map(linhaDe),
    };
  }
  return {
    conta: sel ? { ...linhaDe(sel), somando: sel.rules?.limit?.mode === 'soma' } : null,
    outras,
  };
}

/** The others line as one string: «Outras 7 contas: 5 fora da janela · 2 sem janela salva» */
export function outrasTexto(o: OutrasContas): string {
  return `${o.titulo} ${o.partes.map((p) => p.texto).join(' · ')}`;
}

/** The sentence the card's ⓘ gains on the Diário (owner's revision of 25 Oct) */
export const POSSO_NO_DIARIO_INFO = 'Aqui aparece a conta aberta no Diário; as outras ficam numa linha, e “Ver todas” mostra a resposta de cada uma.';

/** What the Diário's card draws under the open account's line (Phase 5-1; the boards Q11, Q12, Q16, Q18, Q37) */
export interface NotasDaConta {
  /** The amber 10-minute notice with the clock (Q37); while it shows, «Mais tarde» does not (c3 §5.2 l.937) */
  avisoDezMin: string | null;
  /** The grey «Mais tarde: …» line (Q11) */
  maisTarde: string | null;
  /** The grey lines of a release of today cancelled or postponed (NEW, not drawn) */
  cancelados: string[];
  /** The first-wait notice with «Entendi» (Q18); null once «Entendi» was pressed on this device */
  primeiraEspera: string | null;
  /** «Conferidos: …» / «… Não conferido: …» (every frame) */
  conferidos: string | null;
}

/**
 * The notes of the open account at `agora` (the screen's server clock): `aviso` is useRelogioDados' `avisoDezMin`
 * (already null with the preference off), `agenda` the day's read (null while unread or failed: no cancelled line),
 * `entendi` whether this device dismissed the «Dados econômicos» notice of the account (lib/hub/avisoDados).
 */
/**
 * Whether the 10-minute notice may show under this answer: only where «Mais tarde» would (c3 §5.2: the notice takes
 * that line's place), «Liberado» and «Fora da sua janela»; never under «Encerrado por hoje» («nada sobre dados») nor a
 * whole day «Não opero hoje» («a espera não aparece», SPEC §7.2). The Registrar uses the same gate.
 */
export function avisoDezMinCabe(gate: GateResult): boolean {
  const k = answerOf(gate).kind;
  return k === 'liberado' || k === 'fora_janela';
}

export function notasDaConta(
  conta: Pick<ContaPosso, 'gate' | 'rules' | 'desdeDay'>,
  o: { agora: Date; aviso: { start: Date; end: Date; releases: readonly BlockRelease[] } | null; agenda: AgendaRead | null; entendi: boolean },
): NotasDaConta {
  const wtz = relogioDaJanela(conta.rules);
  const avisoDezMin = o.aviso && avisoDezMinCabe(conta.gate) ? avisoDezMinTexto(o.aviso, wtz) : null;
  return {
    avisoDezMin,
    maisTarde: avisoDezMin ? null : maisTarde(conta.gate, conta.rules, o.agora),
    cancelados: dadosCanceladosHoje(o.agenda, conta.gate, conta.rules),
    primeiraEspera: o.entendi ? null : avisoPrimeiraEspera(conta.gate, conta.rules, conta.desdeDay),
    conferidos: conferidosDoGate(conta.gate),
  };
}

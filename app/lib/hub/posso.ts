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
import {
  ACCOUNT_MARKETS,
  answerOf,
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
import { formatMoney } from './formato';

/** Board colour tokens: --mint, --amber, --red, --text (neutral), --text-2 (muted) */
export type Tom = 'mint' | 'amber' | 'red' | 'neutral' | 'muted';

export interface PossoLinha {
  /** «Liberado», «Fora da sua janela», «Encerrado por hoje», «Aguardar até 08:40», «Sem janela salva», «Limite do dia indisponível» */
  palavra: string;
  tom: Tom;
  /** What follows « · »: «abre às 10:00 ET», «até 11:00 ET», «com aviso do limite» */
  sub: string | null;
  /** «Definir» → Personalizar, when nothing was evaluated */
  acao: { texto: string; href: string; aria: string } | null;
  /** «Limite do dia US$ 0 de US$ 400» («R$ 0 de R$ 500» on B3); null when the account has no limit */
  limite: { usado: string; de: string; aria: string; indisponivel: boolean } | null;
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

/**
 * One account's line of «Posso operar hoje?» (Início card, Diário in Phase 2) from its answer
 * (evaluateGate or parseServerGate) and the rules that produced it (null before version 1).
 */
export function possoLinha(conta: string, r: GateResult, rules: Rules | null): PossoLinha {
  const a = answerOf(r);
  const wtz = rules?.windows[0]?.tz ?? rules?.day.tz ?? 'America/New_York';
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
    case 'aguardar':
      return { ...base, palavra: `Aguardar até ${horaNoRelogio(a.until, dtz)}`, tom: 'amber', sub: `bloqueio: ${a.label}` };
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
      return {
        ...base,
        palavra: 'Liberado',
        tom: aviso ? 'neutral' : 'mint',
        sub: aviso ?? (a.until ? `até ${horaNoRelogio(a.until, wtz)}${sufixoRelogio(wtz)}` : null),
      };
    }
    case 'indisponivel':
      // The screen offers «Tentar de novo» from `limite.indisponivel`
      return { ...base, palavra: 'Limite do dia indisponível', tom: 'muted', sub: null };
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

const MARCAS: Record<PlanBreak, string> = {
  fora_da_janela: 'fora da janela',
  no_bloqueio: 'no bloqueio',
  depois_do_limite: 'depois do limite',
  contra_a_regra: 'contra a regra',
};

/** The «Plano» column: «No plano», «● fora da janela · depois do limite», «—», or the imported history */
export function marcaDoPlano(p: PlanResult): { texto: string; tom: Tom } {
  if (p.verdict === 'fora_do_plano') return { texto: `●${NBSP}${p.breaks.map((b) => MARCAS[b]).join(' · ')}`, tom: 'amber' };
  if (p.verdict === 'no_plano') return { texto: 'No plano', tom: 'mint' };
  if (!p.gate.window.evaluated && p.gate.window.reason === 'sem_versao') {
    return { texto: 'Histórico importado · só resultado', tom: 'muted' };
  }
  return { texto: '—', tom: 'muted' };
}

const NOMES: Record<CheckKey, string> = { janela: 'janela', bloqueio: 'bloqueio', limite: 'limite', estado: 'regra do estado' };

/** «Conferidos: janela, bloqueio e limite.»; null when nothing was checked */
export function conferidos(checks: readonly CheckKey[]): string | null {
  if (checks.length === 0) return null;
  const names = checks.map((c) => NOMES[c]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `Conferidos: ${list}.`;
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
}

/** The others line's states, in its order (board choice 9: «liberadas · encerradas por hoje · fora da janela · sem janela salva») */
export type EstadoDaConta = 'liberada' | 'liberada_com_aviso' | 'encerrada' | 'fora_da_janela' | 'sem_janela' | 'outra';
export const ORDEM_DOS_ESTADOS: readonly EstadoDaConta[] = ['liberada', 'liberada_com_aviso', 'encerrada', 'fora_da_janela', 'sem_janela', 'outra'];

const ESTADO_PALAVRAS: Record<EstadoDaConta, { um: string; varios: string; tom: Tom }> = {
  liberada: { um: 'liberada', varios: 'liberadas', tom: 'mint' },
  liberada_com_aviso: { um: 'liberada com aviso', varios: 'liberadas com aviso', tom: 'neutral' },
  encerrada: { um: 'encerrada por hoje', varios: 'encerradas por hoje', tom: 'red' },
  fora_da_janela: { um: 'fora da janela', varios: 'fora da janela', tom: 'amber' },
  sem_janela: { um: 'sem janela salva', varios: 'sem janela salva', tom: 'muted' },
  // «Aguardar até …» (Phase 5), «Sem regra ativa», «Limite do dia indisponível»
  outra: { um: 'com outra resposta', varios: 'com outra resposta', tom: 'muted' },
};

/** The state an account counts as in the others line, from the same answer possoLinha words */
export function estadoDaConta(gate: GateResult): EstadoDaConta {
  const a = answerOf(gate);
  switch (a.kind) {
    case 'liberado':
      return avisos(a.warnings, a.position === 'nao_e_dia') ? 'liberada_com_aviso' : 'liberada';
    case 'encerrado':
      return 'encerrada';
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
export function possoNoDiario(accounts: readonly ContaPosso[], selectedId: string): PossoNoDiario {
  const ordered = accounts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => marketRank(x.a.market) - marketRank(y.a.market) || x.i - y.i)
    .map((x) => x.a);
  const sel = ordered.find((a) => a.accountId === selectedId) ?? null;
  const others = ordered.filter((a) => a.accountId !== selectedId);
  const linhaDe = (a: ContaPosso): LinhaDaConta => ({ accountId: a.accountId, label: a.label, linha: possoLinha(a.label, a.gate, a.rules) });

  let outras: OutrasContas | null = null;
  if (others.length) {
    const n = others.length;
    const contagem: Record<EstadoDaConta, number> = { liberada: 0, liberada_com_aviso: 0, encerrada: 0, fora_da_janela: 0, sem_janela: 0, outra: 0 };
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

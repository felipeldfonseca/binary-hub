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
import { tradingDayOn, windowOccurrences, addDays } from '@/lib/domain/tempo';
import { MARKET_SPEC, STATE_NAMES, currencyOf, type Rules, type CalendarCode } from '@/lib/domain/gate';
import { dinheiroCompacto, type Tom } from './posso';
import { formatDiaMes } from './formato';
import { effectiveDayAt, type ConfigVersion, type PendingVersion, type WindowSetting } from './regras';
import { faixaJanela, resumoDias } from './janelas';
import { ATIVO_NA_FASE_5, CALENDARIO_NOME, ESCOLHA_NOME, ESTADO_NOME, HOJE, NOTA, RELOGIO, VERSAO } from '@/components/hub/personalizar/copy';

export interface Trecho {
  t: string;
  /** Times and money: monospace, never broken */
  mono?: boolean;
  /** Muted (text-2): «Bloqueio de dados» */
  fraco?: boolean;
}

export interface LinhaHoje {
  esquerda: Trecho[];
  estado: string;
  tom: Tom;
  /** «Sem janela salva», «Sem regra ativa», «ativo na Fase 5» are not bold */
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
 */
export function comoFicaHoje(rules: Rules, now: Date, edited: readonly WindowSetting[]): ComoFicaHoje {
  const sub = edited.length ? HOJE.noRelogio(RELOGIO[edited[0].tz].relogio) : '';
  const on = rules.windowRule.on;
  const aviso = on && rules.windows.length === 0 ? (edited.length ? HOJE.avisoCorrija : HOJE.avisoSemJanela) : null;

  // Nothing checked: the window rule is off and there is no limit
  if (!on && !rules.limit) {
    return { linhas: [{ esquerda: [{ t: HOJE.oDiaTodo }], estado: HOJE.semRegraAtiva, tom: 'muted', forte: false, sub: null }], sub, aviso };
  }

  const today = effectiveDayAt(now, rules);
  const hoje = windowOccurrences(now, rules.windows).filter((o) => tradingDayOn(o.start, rules.day) === today);
  const linhas: LinhaHoje[] = hoje.map((o) => ({
    esquerda: [
      { t: `${faixaJanela(o.window.startMin, o.window.endMin)} ${RELOGIO[o.window.tz as keyof typeof RELOGIO].curto}`, mono: true },
      { t: rules.windows.length > 1 ? HOJE.umaDasJanelas : HOJE.suaJanela },
    ],
    estado: HOJE.liberado,
    tom: 'mint',
    forte: true,
    sub: null,
  }));
  const resto = linhas.length ? HOJE.noRestoDoDia : HOJE.oDiaTodo;
  const aviso2 = rules.windowRule.outside === 'aviso';

  if (on && rules.windows.length > 0) {
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
    linhas.push({ esquerda: [{ t: resto }], estado: HOJE.liberado, tom: 'mint', forte: true, sub: null });
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

  if (rules.block && rules.block.on && rules.block.beforeMin + rules.block.afterMin > 0) {
    linhas.push({ esquerda: [{ t: HOJE.bloqueio, fraco: true }], estado: ATIVO_NA_FASE_5, tom: 'muted', forte: false, sub: null });
  }

  return { linhas, sub, aviso };
}

// ---------------------------------------------------------------------------------------------
// Version notes (board partesSig), computed from consecutive rules
// ---------------------------------------------------------------------------------------------

/** «Alinhadas: Só a favor · Em conflito: Opero», or '' with no choice */
export function resumoEstados(states: Partial<Record<string, string | null>> | null): string {
  if (!states) return '';
  return STATE_NAMES.filter((k) => states[k])
    .map((k) => `${ESTADO_NOME[k]}: ${ESCOLHA_NOME[states[k] as keyof typeof ESCOLHA_NOME]}`)
    .join(' · ');
}

/** «10:00–11:00 ET · seg–sex; 14:00–15:00 ET · seg–sex» */
export function descricaoJanelas(windows: readonly WindowSetting[]): string {
  return windows.map((w) => `${faixaJanela(w.startMin, w.endMin)} ${RELOGIO[w.tz].de} · ${resumoDias(w.weekdays)}`).join('; ');
}

type Parte = 'janela' | 'gate' | 'fora' | 'bloq' | 'lim' | 'est' | 'cal';

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
    const b = r.block;
    o.bloq = b && b.on && b.beforeMin + b.afterMin > 0 ? NOTA.bloqueio(b.beforeMin, b.afterMin) : NOTA.semBloqueio;
  }
  o.lim = r.limit
    ? NOTA.limite(dinheiroCompacto(r.limit.cents, currencyOf(r.market))) +
      (caps.soma ? (r.limit.mode === 'soma' ? NOTA.somando : NOTA.porConta) : '') +
      (r.limit.atLimit === 'avisar' ? NOTA.soAvisa : '')
    : NOTA.semLimite;
  if (caps.states) o.est = NOTA.estado(resumoEstados(r.states) || NOTA.nenhumaEscolha);
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
    return [p.janela, p.lim].filter(Boolean).join(' · ');
  }
  const a = partesVersao(versions[i - 1].rules);
  const b = partesVersao(v.rules);
  return (Object.keys(b) as Parte[]).filter((k) => a[k] !== b[k]).map((k) => b[k] as string).join(' · ');
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

/**
 * Personalizar's page-wide draft (board `cfg` against `base`): what counts as a change, what blocks
 * the save, how a newer rules_config is taken in (rebaseSettings when only this tab saved,
 * contrato §4.2), every edit the sections make, the «não salvo» checks and the save status.
 *
 * Pure: no React, no clock (time is an input). The base is always the rules_config the draft was
 * made against (`base`), never a newer cached one: a payload built from a newer config would
 * silently revert what another tab saved.
 */
import { MON_TO_FRI } from '@/lib/domain/tempo';
import type { AtLimit, CalendarCode, LimitMode, Market, StateChoice, StateName } from '@/lib/domain/gate';
import { CALENDAR_CODES, STATE_NAMES } from '@/lib/domain/gate';
import { SALVAR, ERRO_REGRAS } from '@/components/hub/personalizar/copy';
import type { RegrasErrorCode } from './regrasDb';
import { formatDiaMes } from './formato';
import {
  BLOCK_MAX,
  STATE_TEXT_MAX,
  activeAccounts,
  canon,
  emptyAccountSettings,
  normCalendars,
  rebaseSettings,
  sameAccount,
  sameMarket,
  settingsIssues,
  withAccountRule,
  type AccountConfig,
  type AccountSettings,
  type BlockSetting,
  type DisplayTz,
  type LimitSetting,
  type MarketSettings,
  type RulesAccount,
  type RulesConfig,
  type RulesSettings,
  type SaveRulesResult,
  type SettingsIssue,
  type WindowRuleSetting,
  type WindowSetting,
} from './regras';
import { JANELA_SUGERIDA, SEGUNDA_SUGERIDA } from './janelas';

/** The «Padrão Futuros» pill: the futures default, edited as a pseudo-account (regras.ts resolveRules) */
export const PADRAO_FUTUROS = '__padrao_futuros__';
export const PADRAO_FUTUROS_CONTA: RulesAccount = {
  id: PADRAO_FUTUROS,
  market: 'futures',
  day: { tz: 'America/New_York', startMin: 1080 },
};

export const MARKETS: readonly Market[] = ['futures', 'binary'];

export interface Rascunho {
  /** The rules_config the draft was made against */
  base: RulesConfig;
  draft: RulesSettings;
  /** Accounts without versions that get v1 on the next save («Começar as regras hoje») */
  force: string[];
  /**
   * This tab saved `draft` against `base` and save_rules answered revision `rev`, but that
   * rules_config has not been taken in yet (its refetch is running or failed). Until it is, what
   * is saved is this draft, not `base.settings`.
   */
  salvo?: { rev: string; draft: RulesSettings };
}

export const iniciarRascunho = (config: RulesConfig): Rascunho => ({ base: config, draft: config.settings, force: [] });

const activeIds = (config: RulesConfig) => activeAccounts(config).map((a) => a.id);

/** What the database holds as far as the page knows: the draft of a save not yet taken in, else the base */
const salvoAgora = (r: Rascunho): RulesSettings => r.salvo?.draft ?? r.base.settings;

/** Any market, any active account, «Horários na tela» or the calendars differ from saved, or a v1 is asked for */
export function rascunhoSujo(r: Rascunho): boolean {
  const { base, draft, force } = r;
  if (force.length) return true;
  const saved = salvoAgora(r);
  if (MARKETS.some((m) => !sameMarket(m, saved.markets[m], draft.markets[m]))) return true;
  if (activeAccounts(base).some((a) => !sameAccount(a.market, saved.accounts[a.id], draft.accounts[a.id]))) return true;
  if (draft.displayTz !== saved.displayTz) return true;
  return canon(normCalendars(draft.calendars)) !== canon(normCalendars(saved.calendars));
}

/** The windows that block «Salvar alterações» */
export const problemasDoRascunho = (r: Rascunho): SettingsIssue[] => settingsIssues(r.draft, activeIds(r.base));

/**
 * Board `semOcultos`: the entries of accounts that are not active (archived, example) go back to
 * their saved values, and a market left without an active account goes back to its saved
 * default (for Futuros that includes the state rule).
 */
export function semOcultos(config: RulesConfig, draft: RulesSettings): RulesSettings {
  const active = new Set(activeIds(config));
  const accounts = { ...draft.accounts };
  for (const a of config.accounts) {
    if (!active.has(a.id)) accounts[a.id] = config.settings.accounts[a.id] ?? emptyAccountSettings();
  }
  const markets = { ...draft.markets };
  for (const m of MARKETS) {
    if (!config.accounts.some((a) => a.market === m && active.has(a.id))) markets[m] = config.settings.markets[m];
  }
  return { ...draft, accounts, markets };
}

/**
 * A rules_config answer arrives while the page is open (contrato §4.2). `soDaqui` =
 * changedOnlyHere(base.rev → config.rev): the same revision, or only this tab's saves in between.
 * Then the draft is carried onto it part by part, accounts that left the list are reverted, and
 * accounts that now have versions leave `force`. Otherwise (another tab or device saved) a dirty
 * draft keeps its old base, so its save is refused with rules_changed; a clean one adopts it.
 *
 * After this tab's own save (`salvo`), the old side of the rebase is the draft that was sent, not
 * the base: a part changed while the save ran (even back to its old value) is an edit and stays.
 * An answer still on the base's revision is not the save's: the page keeps waiting for it. And
 * when another tab saved too, a draft untouched since the save adopts the newest rules (everything
 * in it is saved), while one edited since keeps its old base without `salvo`, so nothing waits on
 * a revision that will not come back.
 */
export function receberConfig(r: Rascunho | null, config: RulesConfig, soDaqui: boolean): Rascunho {
  if (!r) return iniciarRascunho(config);
  if (config === r.base) return r;
  if (r.salvo && config.rev === r.base.rev) return r;
  if (soDaqui) {
    const draft = semOcultos(config, rebaseSettings(config.accounts, salvoAgora(r), config.settings, r.draft));
    const force = r.force.filter((id) => {
      const a = config.accounts.find((x) => x.id === id);
      return !!a && a.versions.length === 0 && !a.archivedAt && !a.isExample;
    });
    return { base: config, draft, force };
  }
  if (rascunhoSujo(r)) return r.salvo ? { base: r.base, draft: r.draft, force: r.force } : r;
  return iniciarRascunho(config);
}

/** What a save sent: the base revision it was made on, the draft and the v1s it asked for */
export interface Enviado {
  baseRev: string;
  draft: RulesSettings;
  force: readonly string[];
}

/**
 * This tab's save went through as revision `rev`. Only the v1s it sent leave `force` (one asked
 * for while it ran stays), and the draft it sent is what is saved until its rules_config arrives
 * (receberConfig). A save that did not move the revision has nothing to wait for.
 */
export function aposSalvar(r: Rascunho, enviado: Enviado, rev: string): Rascunho {
  const force = r.force.filter((id) => !enviado.force.includes(id));
  if (r.base.rev !== enviado.baseRev || rev === enviado.baseRev) return { ...r, force };
  return { ...r, force, salvo: { rev, draft: enviado.draft } };
}

// ---------------------------------------------------------------------------------------------
// Edits of «Quando você opera»
// ---------------------------------------------------------------------------------------------

const withMarket = (s: RulesSettings, m: Market, patch: Partial<MarketSettings>): RulesSettings => ({
  ...s,
  markets: { ...s.markets, [m]: { ...s.markets[m], ...patch } },
});

const withAccount = (s: RulesSettings, id: string, patch: Partial<AccountSettings>): RulesSettings => ({
  ...s,
  accounts: { ...s.accounts, [id]: { ...(s.accounts[id] ?? emptyAccountSettings()), ...patch } },
});

/** One window of a market (index 0 or 1) */
export function comJanelaDoMercado(s: RulesSettings, m: Market, index: number, patch: Partial<WindowSetting>): RulesSettings {
  return withMarket(s, m, { windows: s.markets[m].windows.map((w, i) => (i === index ? { ...w, ...patch } : w)) });
}

/** A day pill of a market window */
export function alternarDia(s: RulesSettings, m: Market, index: number, day: number): RulesSettings {
  const w = s.markets[m].windows[index];
  return w ? comJanelaDoMercado(s, m, index, { weekdays: w.weekdays ^ (1 << day) }) : s;
}

/** «+ Definir janela»: the market's suggested window */
export const definirJanela = (s: RulesSettings, m: Market): RulesSettings => withMarket(s, m, { windows: [{ ...JANELA_SUGERIDA[m] }] });

/** «Cancelar esta janela»: the new market window goes, and so do the own windows of its accounts */
export function cancelarJanela(s: RulesSettings, m: Market, accountIds: readonly string[]): RulesSettings {
  let out = withMarket(s, m, { windows: [] });
  for (const id of accountIds) if (out.accounts[id]?.window) out = withAccount(out, id, { window: null });
  return out;
}

/** «+ Segunda janela»: on the market's clock, with the first window's days */
export function segundaJanela(s: RulesSettings, m: Market): RulesSettings {
  const first = s.markets[m].windows[0];
  if (!first || s.markets[m].windows.length >= 2) return s;
  return withMarket(s, m, { windows: [first, { tz: first.tz, ...SEGUNDA_SUGERIDA[m], weekdays: first.weekdays }] });
}

export const removerSegunda = (s: RulesSettings, m: Market): RulesSettings => withMarket(s, m, { windows: s.markets[m].windows.slice(0, 1) });

/** «Ajustar só nesta conta»: a copy of the market's first window (its days, or seg–sex) */
export function ajustarSoNestaConta(s: RulesSettings, account: Pick<RulesAccount, 'id' | 'market'>): RulesSettings {
  const first = s.markets[account.market].windows[0];
  if (!first) return s;
  return withAccount(s, account.id, { window: { ...first, weekdays: first.weekdays || MON_TO_FRI } });
}

export const voltarAoPadrao = (s: RulesSettings, id: string): RulesSettings => withAccount(s, id, { window: null });

export function comJanelaDaConta(s: RulesSettings, id: string, patch: Partial<WindowSetting>): RulesSettings {
  const w = s.accounts[id]?.window;
  return w ? withAccount(s, id, { window: { ...w, ...patch } }) : s;
}

// ---------------------------------------------------------------------------------------------
// Edits of «Suas regras»: entity = «Padrão Futuros» or an account (futures or binary)
// ---------------------------------------------------------------------------------------------

export type Entidade = { tipo: 'padrao' } | { tipo: 'conta'; conta: AccountConfig };

/** «Só operar dentro da sua janela» / «Fora da janela, mostrar» */
export function comRegraJanela(s: RulesSettings, e: Entidade, patch: Partial<WindowRuleSetting>): RulesSettings {
  if (e.tipo === 'padrao') return withMarket(s, 'futures', { windowRule: { ...s.markets.futures.windowRule, ...patch } });
  return withAccountRule(s, e.conta, { windowRule: patch });
}

const DEFAULT_BLOCK: BlockSetting = { on: true, beforeMin: 5, afterMin: 10 };

/** «Bloqueio de dados»: minutes are clamped to [0, 60] / [0, 120] */
export function comBloqueio(s: RulesSettings, e: Entidade, patch: Partial<BlockSetting>): RulesSettings {
  const p: Partial<BlockSetting> = { ...patch };
  if (p.beforeMin !== undefined) p.beforeMin = Math.min(BLOCK_MAX.beforeMin, Math.max(0, Math.trunc(p.beforeMin)));
  if (p.afterMin !== undefined) p.afterMin = Math.min(BLOCK_MAX.afterMin, Math.max(0, Math.trunc(p.afterMin)));
  if (e.tipo === 'padrao') return withMarket(s, 'futures', { block: { ...(s.markets.futures.block ?? DEFAULT_BLOCK), ...p } });
  return withAccountRule(s, e.conta, { block: p });
}

/** An emptied minutes field goes back to its saved value (on blur, and so at save) */
export function restaurarMinutos(s: RulesSettings, saved: RulesSettings, e: Entidade, key: 'beforeMin' | 'afterMin'): RulesSettings {
  if (e.tipo === 'padrao') {
    const b = saved.markets.futures.block ?? DEFAULT_BLOCK;
    return withMarket(s, 'futures', { block: { ...(s.markets.futures.block ?? DEFAULT_BLOCK), [key]: b[key] } });
  }
  const own = saved.accounts[e.conta.id]?.block[key];
  const cur = s.accounts[e.conta.id] ?? emptyAccountSettings();
  const block = { ...cur.block };
  if (own === undefined) delete block[key];
  else block[key] = own;
  return withAccount(s, e.conta.id, { block });
}

/** «Limite do dia» of an account (never inherited); null = «Sem limite» */
export function comLimite(s: RulesSettings, id: string, cents: number | null): RulesSettings {
  if (cents === null) return withAccount(s, id, { limit: null });
  const cur = s.accounts[id]?.limit;
  const limit: LimitSetting = { cents, mode: cur?.mode ?? 'conta', atLimit: cur?.atLimit ?? 'encerrar' };
  return withAccount(s, id, { limit });
}

export function comModoLimite(s: RulesSettings, id: string, mode: LimitMode): RulesSettings {
  const cur = s.accounts[id]?.limit;
  return cur ? withAccount(s, id, { limit: { ...cur, mode } }) : s;
}

export function comAoChegar(s: RulesSettings, id: string, atLimit: AtLimit): RulesSettings {
  const cur = s.accounts[id]?.limit;
  return cur ? withAccount(s, id, { limit: { ...cur, atLimit } }) : s;
}

/** «Regra por estado»: choosing the chosen pill again clears it */
export function comEscolhaEstado(s: RulesSettings, state: StateName, choice: StateChoice): RulesSettings {
  const cur = s.markets.futures.states[state] ?? { choice: null, text: '' };
  const states = { ...s.markets.futures.states, [state]: { ...cur, choice: cur.choice === choice ? null : choice } };
  return withMarket(s, 'futures', { states: limparEstados(states) });
}

export function comTextoEstado(s: RulesSettings, state: StateName, text: string): RulesSettings {
  const cur = s.markets.futures.states[state] ?? { choice: null, text: '' };
  const states = { ...s.markets.futures.states, [state]: { ...cur, text: text.slice(0, STATE_TEXT_MAX) } };
  return withMarket(s, 'futures', { states: limparEstados(states) });
}

function limparEstados(states: MarketSettings['states']): MarketSettings['states'] {
  const out: MarketSettings['states'] = {};
  for (const k of STATE_NAMES) {
    const st = states[k];
    if (st && (st.choice !== null || st.text !== '')) out[k] = st;
  }
  return out;
}

export function comCalendario(s: RulesSettings, code: CalendarCode, on: boolean): RulesSettings {
  const cur = new Set(normCalendars(s.calendars));
  if (on) cur.add(code);
  else cur.delete(code);
  return { ...s, calendars: CALENDAR_CODES.filter((c) => cur.has(c)) };
}

export const comHorarios = (s: RulesSettings, displayTz: DisplayTz): RulesSettings => ({ ...s, displayTz });

// ---------------------------------------------------------------------------------------------
// What is «não salvo», «só nesta conta», «padrão de Futuros»
// ---------------------------------------------------------------------------------------------

/** The windows an account (or «Padrão Futuros») uses, as edited: its own, else its market's (errors included) */
export function janelasEfetivas(s: RulesSettings, e: Entidade): { windows: WindowSetting[]; propria: boolean } {
  if (e.tipo === 'padrao') return { windows: s.markets.futures.windows, propria: false };
  const own = s.accounts[e.conta.id]?.window;
  return own ? { windows: [own], propria: true } : { windows: s.markets[e.conta.market].windows, propria: false };
}

/** Board `mudouMk`: the market's windows or an own window of one of its active accounts differ */
export function janelasDoMercadoMudaram(saved: RulesSettings, draft: RulesSettings, m: Market, accountIds: readonly string[]): boolean {
  if (canon(draft.markets[m].windows) !== canon(saved.markets[m].windows)) return true;
  return accountIds.some((id) => canon(draft.accounts[id]?.window ?? null) !== canon(saved.accounts[id]?.window ?? null));
}

export interface MudancasDaEntidade {
  janela: boolean;
  regraJanela: boolean;
  bloqueio: boolean;
  limite: boolean;
  estados: boolean;
}

/** «não salvo» per rule row (board `mudouK`: the keys set on the entity itself) */
export function mudancasDaEntidade(saved: RulesSettings, draft: RulesSettings, e: Entidade): MudancasDaEntidade {
  const estados = canon(draft.markets.futures.states) !== canon(saved.markets.futures.states);
  const janela = canon(janelasEfetivas(draft, e)) !== canon(janelasEfetivas(saved, e));
  if (e.tipo === 'padrao') {
    const a = draft.markets.futures;
    const b = saved.markets.futures;
    return {
      janela,
      regraJanela: canon(a.windowRule) !== canon(b.windowRule),
      bloqueio: canon(a.block) !== canon(b.block),
      limite: false,
      estados,
    };
  }
  const a = draft.accounts[e.conta.id] ?? emptyAccountSettings();
  const b = saved.accounts[e.conta.id] ?? emptyAccountSettings();
  return {
    janela,
    regraJanela: canon(a.windowRule) !== canon(b.windowRule),
    bloqueio: canon(a.block) !== canon(b.block),
    limite: canon(a.limit) !== canon(b.limit),
    estados,
  };
}

/** Whether an account sets any of these keys itself («só nesta conta») */
export function temProprio(s: RulesSettings, id: string, rule: 'windowRule' | 'block'): boolean {
  const a = s.accounts[id];
  return !!a && Object.keys(a[rule]).some((k) => (a[rule] as Record<string, unknown>)[k] !== undefined);
}

// ---------------------------------------------------------------------------------------------
// The save status (board `st`) and «Salvo.»
// ---------------------------------------------------------------------------------------------

export type MensagemSalvar = { tipo: 'salvo'; texto: string } | { tipo: 'descartado' } | { tipo: 'erro'; code: RegrasErrorCode } | null;

export interface StatusSalvar {
  texto: string;
  /** 'mudou' = amber bold (board st-mudou); 'ok' = text-2 (st-ok) */
  tom: 'ok' | 'mudou';
}

/**
 * The status text: a save running, a save that failed (the draft is kept), a save whose rules
 * have not come back yet (the «Salvo…» text holds), unsaved changes (or a window to fix), the last
 * message («Salvo.», «Alterações descartadas.»), or «Tudo salvo».
 */
export function statusSalvar(x: {
  salvando: boolean;
  aguardando: boolean;
  sujo: boolean;
  temProblema: boolean;
  mensagem: MensagemSalvar;
}): StatusSalvar {
  const m = x.mensagem;
  if (x.salvando) return { texto: SALVAR.salvando, tom: 'ok' };
  if (m?.tipo === 'erro') return { texto: ERRO_REGRAS[m.code], tom: 'mudou' };
  if (x.aguardando && m?.tipo === 'salvo') return { texto: m.texto, tom: 'ok' };
  if (x.sujo) return { texto: x.temProblema ? SALVAR.corrija : SALVAR.naoSalvas, tom: 'mudou' };
  if (m?.tipo === 'salvo') return { texto: m.texto, tom: 'ok' };
  if (m?.tipo === 'descartado') return { texto: SALVAR.descartadas, tom: 'ok' };
  return { texto: SALVAR.tudoSalvo, tom: 'ok' };
}

/**
 * «Salvo.» / «Salvo. Regras novas desde 17 out: Top One #1 v2 e Ebinex v2.» / (versions on
 * different days) «Salvo. Regras novas: Top One #1 v2 desde 18 out e Ebinex v2 desde 17 out.».
 * Only active accounts are named (an archived one is versioned too, silently).
 */
export function textoSalvo(result: Pick<SaveRulesResult, 'versions'>, config: RulesConfig): string {
  const active = new Map(activeAccounts(config).map((a) => [a.id, a.label]));
  const vs = result.versions.filter((v) => active.has(v.accountId));
  if (!vs.length) return SALVAR.salvo;
  const days = new Set(vs.map((v) => v.effectiveDay));
  if (days.size === 1) {
    return SALVAR.salvoDesde(
      formatDiaMes(vs[0].effectiveDay),
      vs.map((v) => SALVAR.versaoDe(active.get(v.accountId) as string, v.versionNo)),
    );
  }
  return SALVAR.salvoVarios(vs.map((v) => SALVAR.versaoDeDesde(active.get(v.accountId) as string, v.versionNo, formatDiaMes(v.effectiveDay))));
}

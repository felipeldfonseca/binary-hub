/**
 * The rules of an account outside Personalizar (Phase 2, lane A2): the step-b block of the import
 * sheet (what «Copiar regras de» offers, what the form resolves to, its summary line, the
 * «Regras valem desde hoje» day), the rule parts of a Suas contas row, and the import preview's
 * count of the file's rows before the account's rules started. Pure: time is an input, the words
 * come from components/hub/contas/copyRegras.ts.
 */
import { MON_TO_FRI, formatHhMm, localToUtc, utcToLocal, type DayClock } from '@/lib/domain/tempo'
import { previewInstant, type ImportRow } from '@/lib/domain/import'
import { MARKET_SPEC, currencyOf, type AccountMarket, type LimitMode, type Rules } from '@/lib/domain/gate'
import { ANTES_DAS_REGRAS, LINHA_CONTA, REGRAS_CONTA, RELOGIO_NOME } from '@/components/hub/contas/copyRegras'
import { PASSO_B } from '@/components/hub/contas/copy'
import { SIMBOLO_MOEDA, formatDiaMes } from './formato'
import { JANELA_SUGERIDA, faixaJanela } from './janelas'
import { dinheiroCompacto, sufixoRelogio } from './posso'
import { lerLimite } from './personalizarRegras'
import {
  activeAccounts,
  copyAccountSettings,
  effectiveDayAt,
  emptyAccountSettings,
  pendingVersions,
  resolveRules,
  windowError,
  type AccountConfig,
  type AccountSettings,
  type NewAccountRules,
  type RulesConfig,
  type RulesSettings,
  type UsdTextResult,
  type WindowError,
  type WindowSetting,
} from './regras'

// ---------------------------------------------------------------------------------------------
// Step b: the form
// ---------------------------------------------------------------------------------------------

/** «Não copiar» in the copy select */
export const NAO_COPIAR = 'nao'

/**
 * What the owner changed in the rules block of step b. A key left out takes its default from the
 * copy source (board: `f.copiar`, `f.jan`, `f.lim`, `f.limModo` start undefined), so changing
 * «Copiar regras de» only has to clear them.
 */
export interface RegrasForm {
  /** An account id or NAO_COPIAR; absent = the first account of the market */
  copiar?: string
  /** «Sim» (the market's window) | «Outra» (an own window); only while the market has a window */
  janela?: 'padrao' | 'propria'
  /** The window the editor shows (own, or the market's new one) once edited */
  propria?: WindowSetting
  /** The market has no window: whether the form sets one («+ Definir janela») */
  definir?: boolean
  /** «Limite do dia, US$» (R$ on B3) as typed */
  limite?: string
  /** «por conta» | «somando as contas de Futuros» (only where MARKET_SPEC[m].rules.soma) */
  modo?: LimitMode
  /** «Mudar» is open */
  aberto: boolean
}

export const REGRAS_FORM_VAZIO: RegrasForm = { aberto: false }

/** Whether the owner changed anything in the block (closing the sheet then asks first) */
export const regrasEditadas = (f: RegrasForm): boolean =>
  f.copiar !== undefined ||
  f.janela !== undefined ||
  f.propria !== undefined ||
  f.definir !== undefined ||
  f.limite !== undefined ||
  f.modo !== undefined

/** Changing «Copiar regras de» starts the window choice, the limit and its mode again (board `setF({ copiar, lim: undefined })`) */
export const comCopiar = (f: RegrasForm, copiar: string): RegrasForm => ({ aberto: f.aberto, copiar })

/** '400', '400,50': the limit field's text for a saved amount */
export function textoLimite(cents: number): string {
  const inteiro = Math.floor(cents / 100)
  const resto = cents % 100
  return resto ? `${inteiro},${String(resto).padStart(2, '0')}` : String(inteiro)
}

/** The accounts a new account of `market` can copy its rules from: active ones of the same market, in list order */
export function opcoesCopiar(config: Pick<RulesConfig, 'accounts'>, market: AccountMarket): { id: string; label: string }[] {
  return activeAccounts(config)
    .filter((a) => a.market === market)
    .map((a) => ({ id: a.id, label: a.label }))
}

/** What the rules block of step b resolves to */
export interface RegrasDaNovaConta {
  market: AccountMarket
  /** «Copiar regras de» options (without «Não copiar») */
  opcoes: { id: string; label: string }[]
  /** The source account; null = «Não copiar» (or nothing to copy) */
  copiar: string | null
  /** The market's saved windows (the «Sim» answer) */
  janelasMercado: WindowSetting[]
  /** «Sim»: no own window, the account uses the market's (only with a market window) */
  usarPadrao: boolean
  /** The window the editor's fields show; null = none (no market window and none set) */
  janela: WindowSetting | null
  janelaErro: WindowError | null
  limiteTexto: string
  limite: UsdTextResult
  /** A typed limit that cannot be saved (empty is no limit, not an error) */
  limiteErro: Exclude<Extract<UsdTextResult, { ok: false }>['reason'], 'empty'> | null
  modo: LimitMode
  /** The mode pills: a market that sums (futures), with a second account of it once this one exists */
  temModo: boolean
  /** The new account's settings, for v1 (buildNewAccountPayload) */
  settings: AccountSettings
  /** The market has no window and the form sets one: it becomes the market's */
  marketWindows?: WindowSetting[]
  /** Whether anything blocks the creation (a window or limit error) */
  bloqueado: boolean
}

/** The form against the saved rules (rules_config): defaults from the copy source, then the owner's changes */
export function regrasDaNovaConta(config: Pick<RulesConfig, 'accounts' | 'settings'>, market: AccountMarket, form: RegrasForm): RegrasDaNovaConta {
  const opcoes = opcoesCopiar(config, market)
  const copiar =
    form.copiar === NAO_COPIAR ? null : form.copiar && opcoes.some((o) => o.id === form.copiar) ? form.copiar : (opcoes[0]?.id ?? null)
  const fonte = copiar ? copyAccountSettings(config.settings, copiar) : emptyAccountSettings()
  const janelasMercado = config.settings.markets[market].windows
  const temJanelaMercado = janelasMercado.length > 0

  let usarPadrao = false
  let janela: WindowSetting | null
  if (temJanelaMercado) {
    usarPadrao = form.janela ? form.janela === 'padrao' : !fonte.window
    const primeira = janelasMercado[0]
    const propria = form.propria ?? fonte.window ?? { ...primeira, weekdays: primeira.weekdays || MON_TO_FRI }
    janela = usarPadrao ? null : propria
  } else {
    const definir = form.definir ?? !!fonte.window
    janela = definir ? (form.propria ?? fonte.window ?? JANELA_SUGERIDA[market]) : null
  }

  const limiteTexto = form.limite ?? (fonte.limit ? textoLimite(fonte.limit.cents) : '')
  // In the market's money, as Personalizar reads it: «US$ 400» typed on a B3 account (or «R$ 400»
  // on a dollar one) is refused, never saved as R$ 400 (US$ 400)
  const limite = lerLimite(limiteTexto, currencyOf(market))
  const limiteErro = limite.ok || limite.reason === 'empty' ? null : limite.reason
  // «por conta / somando» only where the market sums its accounts (Futuros)
  const soma = MARKET_SPEC[market].rules.soma
  const modo: LimitMode = soma ? (form.modo ?? fonte.limit?.mode ?? 'conta') : 'conta'

  const settings: AccountSettings = {
    ...fonte,
    window: temJanelaMercado && !usarPadrao ? janela : null,
    limit: limite.ok ? { cents: limite.cents, mode: modo, atLimit: fonte.limit?.atLimit ?? 'encerrar' } : null,
  }
  const janelaErro = janela ? windowError(janela) : null

  return {
    market,
    opcoes,
    copiar,
    janelasMercado,
    usarPadrao,
    janela,
    janelaErro,
    limiteTexto,
    limite,
    limiteErro,
    modo,
    temModo: soma && opcoes.length > 0,
    settings,
    marketWindows: !temJanelaMercado && janela ? [janela] : undefined,
    bloqueado: !!janelaErro || !!limiteErro,
  }
}

/** «10:00–11:00», «20:00 → 02:00 do dia seguinte», «a definir» (an invalid window) */
export function faixaResumo(w: WindowSetting): string {
  if (windowError(w)) return REGRAS_CONTA.aDefinir
  return w.endMin < w.startMin
    ? REGRAS_CONTA.faixaNoite(formatHhMm(w.startMin), formatHhMm(w.endMin))
    : faixaJanela(w.startMin, w.endMin)
}

/** The limit part of the summary line, in the market's currency («US$ 400 por conta», «R$ 400») */
function limiteResumo(r: RegrasDaNovaConta, form: RegrasForm): string {
  const sufixo = MARKET_SPEC[r.market].rules.soma ? (r.modo === 'soma' ? REGRAS_CONTA.somando : REGRAS_CONTA.porConta) : ''
  const moeda = currencyOf(r.market)
  if (r.limite.ok) return dinheiroCompacto(r.limite.cents, moeda) + sufixo
  const texto = r.limiteTexto.trim()
  // Board: what was typed, even before it is valid (the creation button says what is wrong); the
  // non-breaking space keeps the symbol with the amount, as dinheiroCompacto does
  if (texto) return `${SIMBOLO_MOEDA[moeda]}\u00a0${texto}${sufixo}`
  return r.copiar && form.limite === undefined ? REGRAS_CONTA.semLimite : REGRAS_CONTA.definir
}

/**
 * The summary line (board `regraLinha`): «Janela 10:00–11:00 (Nova York) · padrão de Futuros ·
 * limite do dia: US$ 400 por conta», «… · só nesta conta · …», «Janela: sem janela · limite do
 * dia: definir».
 */
export function linhaResumo(r: RegrasDaNovaConta, form: RegrasForm): string {
  const limite = limiteResumo(r, form)
  if (r.usarPadrao) {
    const tz = r.janelasMercado[0].tz
    return REGRAS_CONTA.linha(r.janelasMercado.map(faixaResumo).join(' e '), RELOGIO_NOME[tz], REGRAS_CONTA.padraoDe(r.market), limite)
  }
  if (!r.janela) return REGRAS_CONTA.linhaSemJanela(limite)
  const origem = r.marketWindows ? REGRAS_CONTA.padraoDe(r.market) : REGRAS_CONTA.soNestaConta
  return REGRAS_CONTA.linha(faixaResumo(r.janela), RELOGIO_NOME[r.janela.tz], origem, limite)
}

/** «Começa com o padrão do mercado.» | «Copia janela, limite do dia, …» */
export const notaCopiar = (r: Pick<RegrasDaNovaConta, 'market' | 'copiar'>): string =>
  r.copiar ? REGRAS_CONTA.notaCopia(r.market) : REGRAS_CONTA.notaPadrao

/** «Usar a janela de Futuros (10:00–11:00 ET)?»; null without a market window */
export function perguntaJanela(r: Pick<RegrasDaNovaConta, 'market' | 'janelasMercado'>): string | null {
  if (!r.janelasMercado.length) return null
  return REGRAS_CONTA.pergunta(
    r.market,
    r.janelasMercado.map((w) => faixaJanela(w.startMin, w.endMin)),
    r.janelasMercado[0].tz,
  )
}

/** Same clock, times and days */
export const mesmaJanela = (a: WindowSetting, b: WindowSetting): boolean =>
  a.tz === b.tz && a.startMin === b.startMin && a.endMin === b.endMin && a.weekdays === b.weekdays

/**
 * v1 rebuilt on a newer rules_config (the first try was refused with rules_changed: another tab
 * saved meanwhile). When the market got a window in between, the form's window is no longer the
 * market's first one: it becomes the account's own, unless it equals the market's only window.
 */
export function novaContaNaConfig(fresh: Pick<RulesConfig, 'settings'>, input: NewAccountRules): NewAccountRules {
  const agora = fresh.settings.markets[input.market].windows
  const w = input.marketWindows?.[0]
  if (!w || !agora.length) return input
  const igual = agora.length === 1 && mesmaJanela(agora[0], w)
  return { ...input, marketWindows: undefined, settings: { ...input.settings, window: igual ? null : w } }
}

/** The id resolveRules gives the account that does not exist yet */
const NOVA = '__nova__'

/**
 * The rules v1 would freeze for the new account: the saved settings with the form's account (and
 * the market's new window, when the form sets one), on the market's day clock.
 */
export function regrasResolvidas(config: Pick<RulesConfig, 'settings'>, r: RegrasDaNovaConta): Rules {
  const s: RulesSettings = {
    ...config.settings,
    markets: r.marketWindows
      ? { ...config.settings.markets, [r.market]: { ...config.settings.markets[r.market], windows: r.marketWindows } }
      : config.settings.markets,
    accounts: { ...config.settings.accounts, [NOVA]: r.settings },
  }
  // An account not created yet: the market's day clock (the database's insert trigger sets the same)
  const day = MARKET_SPEC[r.market].day
  return resolveRules({ id: NOVA, market: r.market, day: { tz: day.tz, startMin: day.startMin } }, s)
}

/**
 * «Regras valem desde hoje, {d}»: the day save_rules gives v1 if the account is created at `now`
 * (after 18:00 ET a futures account is on the next day; inside an overnight window, the day the
 * window opened).
 */
export function desdeDaNovaConta(config: Pick<RulesConfig, 'settings'>, r: RegrasDaNovaConta, now: Date): string {
  return formatDiaMes(effectiveDayAt(now, regrasResolvidas(config, r)))
}

/**
 * The form gives the market its first window (`marketWindows`): every active account of that
 * market that uses the market's window gets a version on the same save (save_rules versions
 * whatever changed). The note names them and the day: «Ao criar, esta janela passa a ser a de
 * Futuros: Top One #1 também ganha versão nova das regras desde 19 out.»; null when no other
 * account is affected.
 */
export function outrasContasComVersao(config: RulesConfig, r: RegrasDaNovaConta, now: Date): string | null {
  if (!r.marketWindows) return null
  const settings: RulesSettings = {
    ...config.settings,
    markets: { ...config.settings.markets, [r.market]: { ...config.settings.markets[r.market], windows: r.marketWindows } },
  }
  const ativas = new Map(activeAccounts(config).map((a) => [a.id, a.label]))
  const outras = pendingVersions(config, settings).filter((p) => ativas.has(p.accountId))
  if (!outras.length) return null
  return REGRAS_CONTA.outrasContas(
    r.market,
    formatDiaMes(effectiveDayAt(now, outras[0].rules)),
    outras.map((p) => ativas.get(p.accountId) as string),
  )
}

// ---------------------------------------------------------------------------------------------
// Step b: «Moeda e virada do dia» of a market without a file reader (Fase 2b)
// ---------------------------------------------------------------------------------------------

const BRASILIA = 'America/Sao_Paulo'

/**
 * When a day clock's turn falls in Brasília today, at today's offsets: 17:00 ET → '18:00' in
 * October, '19:00' after the US clocks change on 1 Nov. «Today» is the date on the day clock at
 * `now`. Null when the day already turns on Brasília's clock.
 */
export function viradaEmBrasilia(day: DayClock, now: Date): string | null {
  if (day.tz === BRASILIA) return null
  const hoje = utcToLocal(now, day.tz)
  const virada = localToUtc(
    { year: hoje.year, month: hoje.month, day: hoje.day, hour: Math.floor(day.startMin / 60), minute: day.startMin % 60 },
    day.tz,
  )
  return formatHhMm(utcToLocal(virada, BRASILIA).minuteOfDay)
}

/**
 * The «Moeda e virada do dia» row of a new account (board `B.moedaDia`): «US$ · o dia vira às 17:00
 * ET (18:00 em Brasília hoje)», «R$ · o dia vira à meia-noite de Brasília». An account not created
 * yet, so the market's day clock (the database's insert trigger sets the same).
 */
export function moedaEViradaDoDia(market: AccountMarket, now: Date): string {
  return PASSO_B.moedaDiaValor(market, viradaEmBrasilia(MARKET_SPEC[market].day, now))
}

// ---------------------------------------------------------------------------------------------
// Suas contas: the rule parts of a row
// ---------------------------------------------------------------------------------------------

/** A piece of a row part; `mono` = times (board `segsJan` cls num) */
export interface Trecho {
  t: string
  mono?: boolean
}

/**
 * The rule parts of an account's row, after phase and platform (board `itemConta`): its window
 * («10:00–11:00 ET», « (própria)», «sem janela»), «regras desde {d}[ · v{n}]» or «sem regras
 * salvas», and «{n} op. desde então» once it has a version. `count` is the account's trades since
 * v1; with a version and no count, null (the row keeps its Phase 1 parts). `semVersao` is the
 * Phase 1 activity text, for an account without a version.
 */
export function partesRegras(account: Pick<AccountConfig, 'current' | 'versions'>, count: number | undefined, semVersao: string): Trecho[][] | null {
  const versions = account.versions
  if (versions.length && count === undefined) return null
  const w = account.current.windows
  const janela: Trecho[] = []
  if (w.length) {
    w.forEach((x, i) => {
      if (i) janela.push({ t: ' e ' })
      janela.push({ t: faixaJanela(x.startMin, x.endMin), mono: true })
    })
    janela.push({ t: `${sufixoRelogio(w[0].tz)}${account.current.windowsFrom === 'account' ? LINHA_CONTA.propria : ''}` })
  } else {
    janela.push({ t: LINHA_CONTA.semJanela })
  }
  const regras = versions.length
    ? LINHA_CONTA.regrasDesde(formatDiaMes(versions[0].effectiveDay), versions[versions.length - 1].versionNo)
    : LINHA_CONTA.semRegras
  const atividade = versions.length ? LINHA_CONTA.opDesdeEntao(count as number) : semVersao
  return [janela, [{ t: regras }], ...(atividade ? [[{ t: atividade }]] : [])]
}

// ---------------------------------------------------------------------------------------------
// Import preview: the file's rows before the account's rules started (contrato D17, §6.3)
// ---------------------------------------------------------------------------------------------

/** How many of the file's valid rows enter before `since` and at or after it */
export function contarAntesDasRegras(
  rows: readonly Pick<ImportRow, 'local_entry' | 'utc_offset'>[],
  fileTz: string,
  since: Date,
): { antes: number; depois: number } {
  let antes = 0
  let depois = 0
  const t = since.getTime()
  for (const row of rows) {
    if (previewInstant(row, fileTz).instant.getTime() < t) antes++
    else depois++
  }
  return { antes, depois }
}

/** The account's first version, as the preview lines need it; null without versions */
function inicioDasRegras(config: Pick<RulesConfig, 'accounts'> | undefined, accountId: string): { since: Date; dia: string } | null {
  const v1 = config?.accounts.find((a) => a.id === accountId)?.versions[0]
  return v1 ? { since: v1.effectiveFrom, dia: formatDiaMes(v1.effectiveDay) } : null
}

/**
 * Step d (board `Dd.antes`): «Antes de {d} (início das regras): {n} vão para Histórico importado ·
 * só resultado.» when every row of the file is before v1, «… até {n} vão …» when the file has
 * rows on both sides; null without a version, with no row before it, or with nothing new.
 */
export function linhaAntesDasRegras(
  config: Pick<RulesConfig, 'accounts'> | undefined,
  accountId: string,
  rows: readonly Pick<ImportRow, 'local_entry' | 'utc_offset'>[],
  fileTz: string,
  novas: number,
): string | null {
  const inicio = inicioDasRegras(config, accountId)
  if (!inicio || novas <= 0) return null
  const { antes, depois } = contarAntesDasRegras(rows, fileTz, inicio.since)
  if (antes === 0) return null
  return depois === 0 ? ANTES_DAS_REGRAS.linha(inicio.dia, novas, false) : ANTES_DAS_REGRAS.linha(inicio.dia, Math.min(antes, novas), true)
}

/**
 * Step f, «Importação feita»: with rows at or after v1, «{n} operações importadas. As de antes de
 * {d} ficam em Histórico importado …» (only «{n} operações importadas.» when none is before);
 * null when the Phase 1 line stays (no version, or every row before it).
 */
export function linhaImportadas(
  config: Pick<RulesConfig, 'accounts'> | undefined,
  accountId: string,
  rows: readonly Pick<ImportRow, 'local_entry' | 'utc_offset'>[],
  fileTz: string,
  inserted: number,
): string | null {
  const inicio = inicioDasRegras(config, accountId)
  if (!inicio) return null
  const { antes, depois } = contarAntesDasRegras(rows, fileTz, inicio.since)
  if (depois === 0) return null
  return ANTES_DAS_REGRAS.importadas(inserted, antes > 0 ? inicio.dia : null)
}

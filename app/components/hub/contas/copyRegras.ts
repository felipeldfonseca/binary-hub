/**
 * Every pt-BR string of the rules in account creation (the import sheet's step b), the rule parts
 * and «Editar regras» of a Suas contas row, and the import preview's «Antes de …» line (Phase 2,
 * lane A2). Strings come from the approved boards (ImportarConta.dc.html, Personalizar.dc.html /
 * PersonalizarContas.dc.html `itemConta`) unless marked:
 *   NEW      not on any board (a state the board does not draw, or a Phase 2 limit)
 *   ADAPTED  a board string changed for Phase 2 (the comment says what changed)
 *
 * The window strings shared with Personalizar (field labels, errors, days, clocks) are lane A1's,
 * in components/hub/personalizar/copy.ts, and are imported from there, never copied.
 */
import type { AccountMarket, WindowTz } from '@/lib/domain/gate'
import { formatInt } from '@/lib/hub/formato'
import { JANELAS, RELOGIO, lista } from '@/components/hub/personalizar/copy'
import { MERCADO } from '@/components/hub/copyMercados'

// ------------------------------------------------------------------------------------------------
// Step b: «Copiar regras de», the summary line, the editor, the «desde» chip
// ------------------------------------------------------------------------------------------------

/** The market as the creation form names it, after «de» (board PAD.nome; Fase 2b: copyMercados MERCADO[m].deCurto) */
const deCurto = (market: AccountMarket) => MERCADO[market].deCurto

/** The window's clock in the summary line: «(Nova York)», «(Brasília)» (board relNome) */
export const RELOGIO_NOME: Record<WindowTz, string> = {
  'America/New_York': 'Nova York',
  'America/Sao_Paulo': 'Brasília',
}

export const REGRAS_CONTA = {
  copiar: 'Copiar regras de',
  naoCopiar: 'Não copiar',
  notaPadrao: 'Começa com o padrão do mercado.',
  notaCopia: (market: AccountMarket) =>
    market === 'futures' ? 'Copia janela, limite do dia, bloqueio de dados e regra do estado.' : 'Copia janela e limite do dia.',

  mudar: 'Mudar',
  /** «Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: US$ 400 por conta» */
  linha: (faixa: string, relogio: string, origem: string, limite: string) =>
    `Janela ${faixa} (${relogio}) · ${origem} · limite do dia: ${limite}`,
  // NEW (personalizar.md §11.1): no market window and no window set in the form
  linhaSemJanela: (limite: string) => `Janela: sem janela · limite do dia: ${limite}`,
  /** «20:00 → 02:00 do dia seguinte» */
  faixaNoite: (inicio: string, fim: string) => `${inicio} → ${fim} do dia seguinte`,
  aDefinir: 'a definir',
  padraoDe: (market: AccountMarket) => `padrão ${deCurto(market)}`,
  soNestaConta: 'só nesta conta',
  porConta: ' por conta',
  somando: ' somando as contas de Futuros',
  semLimite: 'sem limite',
  definir: 'definir',

  /** «Usar a janela de Futuros (10:00–11:00 ET)?» (two windows: «10:00–11:00 e 14:00–15:00 ET») */
  pergunta: (market: AccountMarket, faixas: readonly string[], tz: WindowTz) =>
    `Usar a janela ${deCurto(market)} (${faixas.join(' e ')} ${RELOGIO[tz].de})?`,
  sim: 'Sim',
  outra: 'Outra',
  relogio: JANELAS.relogioRotulo,
  diasAria: 'Dias da janela',
  das: JANELAS.das,
  as: JANELAS.as,
  /** The own window's fields: Personalizar's labels («Início da janela só de {apelido}, horário de …») */
  inicioAria: (label: string, tz: WindowTz) =>
    label ? JANELAS.inicioContaAria(label, RELOGIO[tz].nome) : `Início da janela só desta conta, ${RELOGIO[tz].nome}`, // fallback NEW (no nickname yet)
  fimAria: (label: string, tz: WindowTz) =>
    label ? JANELAS.fimContaAria(label, RELOGIO[tz].nome) : `Fim da janela só desta conta, ${RELOGIO[tz].nome}`, // fallback NEW
  /** The market has no window: the form's window becomes the market's (Personalizar's labels) */
  inicioMercadoAria: (market: AccountMarket, tz: WindowTz) => JANELAS.inicioAria(market, false, RELOGIO[tz].nome),
  fimMercadoAria: (market: AccountMarket, tz: WindowTz) => JANELAS.fimAria(market, false, RELOGIO[tz].nome),
  // NEW here (Personalizar's «+ Definir janela» / «Cancelar esta janela»): the market has no window yet
  definirJanela: JANELAS.definir,
  cancelarJanela: JANELAS.cancelar,
  cancelarJanelaAria: (market: AccountMarket) => JANELAS.cancelarAria(market),

  limite: 'Limite do dia, US$',
  modoAria: 'Como o limite conta',

  desde: (d: string) => `Regras valem desde hoje, ${d}`,
  desdeAria: 'Como ler: Regras valem desde hoje',
  desdeInfo:
    'As comparações desta conta contam a partir desta data. Mudou uma regra? A versão anterior continua valendo para o passado.',

  // NEW (review of personalizar.md §11.1): the form gives the market its first window, so the
  // market's other active accounts, which use the market's window, get a version on the same save
  outrasContas: (market: AccountMarket, d: string, contas: readonly string[]) =>
    `Ao criar, esta janela passa a ser a ${deCurto(market)}: ${lista(contas)} também ${contas.length > 1 ? 'ganham' : 'ganha'} versão nova das regras desde ${d}.`,

  // NEW: rules_config did not load; the account is still created (without v1)
  carregarErro: 'Não foi possível carregar as regras. A conta é criada sem regras; salve em Personalizar › Suas regras.',
  // NEW: the account was created but its v1 could not be saved (two calls, contrato D9)
  naoSalvas: (label: string) => `${label} criada, mas as regras não foram salvas. Salve em Personalizar › Suas regras.`,
}

// ------------------------------------------------------------------------------------------------
// Suas contas: the rule parts of a row and «Editar regras»
// ------------------------------------------------------------------------------------------------

export const LINHA_CONTA = {
  propria: ' (própria)',
  semJanela: 'sem janela',
  regrasDesde: (d: string, ultima: number) => `regras desde ${d}${ultima > 1 ? ` · v${ultima}` : ''}`,
  semRegras: 'sem regras salvas',
  opDesdeEntao: (n: number) => `${formatInt(n)} op. desde então`,
  editarRegras: 'Editar regras',
}

// ------------------------------------------------------------------------------------------------
// Import preview (step d) and «Importação feita» (step f)
// ------------------------------------------------------------------------------------------------

export const ANTES_DAS_REGRAS = {
  /**
   * «Antes de 17 out (início das regras): 7 vão para Histórico importado · só resultado.»
   * With `ate`: «… até 3 vão …» (ADAPTED: the preview does not say which of the new rows are before)
   */
  linha: (d: string, n: number, ate: boolean) =>
    `Antes de ${d} (início das regras): ${ate ? 'até ' : ''}${formatInt(n)} ${n === 1 ? 'vai' : 'vão'} para Histórico importado · só resultado.`,
  infoAria: 'Como ler: Histórico importado',
  info: 'Cada operação é julgada pela versão das regras que valia na entrada. Antes da primeira versão, fica só o resultado, sem janela, limite ou plano. O histórico importado nunca é somado ao Diário.',
  // NEW (decisoes: imported trades at or after «desde» are judged by the rules)
  importadas: (n: number, antesDe: string | null) =>
    `${n === 1 ? '1 operação importada' : `${formatInt(n)} operações importadas`}.${
      antesDe ? ` As de antes de ${antesDe} ficam em Histórico importado · só resultado, à parte do Diário.` : ''
    }`,
}

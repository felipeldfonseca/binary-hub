/**
 * The pt-BR strings of «Operações do dia», the bridge on /diario until the Diário of Phase 4 (D16),
 * in one place so the owner can review them. Strings come from the approved board
 * RegistrarOperacao.dc.html v57 (`RO l.N`, the «fundo» of the sheet: the /diario of Phase 3) unless
 * marked:
 *   NEW      not on any board (a state the board does not draw)
 *   ADAPTED  a board string changed (the comment says what changed)
 *
 * The Diário header's «Registrar operação» is DIARIO.registrar (contas/copy.ts) and the
 * Preferências switch is PREFERENCIAS.aviso80 (personalizar/copy.ts), next to their screens' other
 * strings.
 */
import type { PlanBreak } from '@/lib/domain/gate'

export const OPERACOES_DIA = {
  /** H2 (RO l.268); «Ver no Diário» focuses it */
  title: 'Operações do dia',
  /** RO l.270 */
  empty: 'Nenhuma operação registrada hoje.',
  loadError: 'Não foi possível carregar as operações do dia.', // NEW
  /** The read waits for the connection (React Query pauses it offline; contract C10) */
  offline: 'Sem conexão. Tente de novo quando a conexão voltar.', // NEW
  /** Column headers (RO l.273); «Ação» only for a screen reader */
  colHora: 'Hora',
  colOperacao: 'Operação',
  colResultado: 'Resultado',
  colPlano: 'Plano',
  colAcao: 'Ação',
  /** «Resultado» of an open trade (RO l.278) */
  aberta: 'aberta',
  /** «Plano» (RO l.279; marcaDoPlano's words) */
  noPlano: 'No plano',
  planoNaoAvaliado: 'plano não avaliado',
  /** The day before today on the row's hour (RO `diaTxt`) */
  ontem: 'ontem',
  /** The paperclip (RO l.277) */
  clipImagensENota: 'tem imagens e nota',
  clipImagens: 'tem imagens',
  clipNota: 'tem nota',
  /** The row's button (RO l.1653, board choice 17) */
  registrarSaida: 'Registrar saída',
  registrarResultado: 'Registrar resultado',
  abrir: 'Abrir',
  /** «Abrir no Registrar: Venda de MNQ às 10:01» (RO l.1661) */
  abrirAria: 'Abrir no Registrar',
  compra: 'Compra',
  venda: 'Venda',
  alta: 'Alta',
  baixa: 'Baixa',
}

/**
 * «fora da janela», «depois do limite» (lib/hub/posso's MARCAS). Only the breaks Phase 3 can find:
 * the block and the state rule act in Phase 5 and are never shown before.
 */
export const QUEBRAS: Partial<Record<PlanBreak, string>> = {
  fora_da_janela: 'fora da janela',
  depois_do_limite: 'depois do limite',
}

/** «Registrar saída: Compra de MES às 10:12» / «Registrar saída: Compra de MNQ de ontem, às 10:52» (RO l.1661) */
export function acaoAria(acao: string, lado: string, ativo: string, dia: string, hora: string): string {
  return `${acao}: ${lado} de ${ativo}${dia ? ` de ${dia},` : ''} às ${hora}`
}

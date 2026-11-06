/**
 * The Diário page's element ids (Phase 4, telas B0), shared by both lanes and the Registrar's hand-offs: the regions'
 * anchors (the section links «Calendário», «O dia», «Semana»), their H2s (focus targets), and a trade's row button
 * and drill («Ver no Diário» and a deep link focus the row's ▾).
 */
export { OPERACOES_DO_DIA_ID } from '@/components/hub/registrar/abrir'

/** The regions' <section id> */
export const SECAO = { calendario: 'calendario', dia: 'dia', semana: 'semana', rodape: 'rodape' } as const

/** The regions' H2 ids (tabIndex −1) */
export const TITULO = { calendario: 't-cal', dia: 't-dia', semana: 't-sem' } as const

/** A trade's ▾ in «Operações do dia» */
export const linhaId = (tradeId: string) => `op-${tradeId}`

/** A trade's drill (the ▾'s aria-controls) */
export const drillId = (tradeId: string) => `drill-${tradeId}`

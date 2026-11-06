'use client'

import OperacoesDoDia from './OperacoesDoDia'

/**
 * «O dia» (lane L2, contract §2.2 E–I): `section#dia`, the open day with its plan, trades, drill and review. B0's stub
 * renders the Phase 3 bridge «Operações do dia» (today's trades of the current account) until lane L2 replaces it;
 * it reads the page's state (useDiarioPagina) and takes no props.
 */
export default function ODia() {
  return <OperacoesDoDia />
}

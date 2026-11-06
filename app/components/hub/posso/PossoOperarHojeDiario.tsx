'use client'

import { useRulesNow } from '@/hooks/useRegras'
import { useDiarioPaginaOpcional } from '@/components/hub/diario/useDiarioPagina'
import PossoOperarHoje, { type PossoEstado } from './PossoOperarHoje'
import { rulesNowFailed, useRulesNowCatchUp } from './rulesNowRead'

/**
 * The «Posso operar hoje?» card of /diario, from rules_now(). useRulesNow asks again at the
 * earliest changes_at (a window opening or closing, the end of the trading day), when the tab gets
 * focus back and after a save or an import, so the lines change without a reload. The card also
 * asks when an answer it found in the cache on mount is due (useRulesNowCatchUp).
 *
 * Phase 4: on the Diário page the card shows the account open there (the page's provider holds the header's
 * useContaAtual().current, so the card follows a choice in the selector at once) and one line for the others; outside
 * the page's provider, every account's line as before.
 */
export default function PossoOperarHojeDiario() {
  const rulesNow = useRulesNow()
  const catchingUp = useRulesNowCatchUp(rulesNow)
  const pagina = useDiarioPaginaOpcional()

  // A read that failed, is being retried or waits offline wins over older lines: «Liberado · até
  // 11:00 ET» must not stay up after 11:00
  const state: PossoEstado = rulesNowFailed(rulesNow)
    ? { status: 'error' }
    : rulesNow.data && !catchingUp
      ? { status: 'ready', accounts: rulesNow.data.accounts }
      : { status: 'loading' }

  return <PossoOperarHoje state={state} onRetry={() => void rulesNow.refetch()} selecionada={pagina?.conta.id} />
}

'use client'

import { useRulesNow } from '@/hooks/useRegras'
import PossoOperarHoje, { type PossoEstado } from './PossoOperarHoje'
import { rulesNowFailed, useRulesNowCatchUp } from './rulesNowRead'

/**
 * The «Posso operar hoje?» card of /diario, from rules_now(). useRulesNow asks again at the
 * earliest changes_at (a window opening or closing, the end of the trading day), when the tab gets
 * focus back and after a save or an import, so the lines change without a reload. The card also
 * asks when an answer it found in the cache on mount is due (useRulesNowCatchUp).
 */
export default function PossoOperarHojeDiario() {
  const rulesNow = useRulesNow()
  const catchingUp = useRulesNowCatchUp(rulesNow)

  // A read that failed, is being retried or waits offline wins over older lines: «Liberado · até
  // 11:00 ET» must not stay up after 11:00
  const state: PossoEstado = rulesNowFailed(rulesNow)
    ? { status: 'error' }
    : rulesNow.data && !catchingUp
      ? { status: 'ready', accounts: rulesNow.data.accounts }
      : { status: 'loading' }

  return <PossoOperarHoje state={state} onRetry={() => void rulesNow.refetch()} />
}

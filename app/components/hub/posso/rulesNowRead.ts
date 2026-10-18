'use client'

import { useEffect, useState } from 'react'
import { focusManager } from '@tanstack/react-query'
import { rulesNowRefetchDelay } from '@/hooks/useRegras'
import type { RulesNow } from '@/lib/hub/regras'

/** What these helpers read of useRulesNow() */
interface RulesNowRead {
  data: RulesNow | undefined
  dataUpdatedAt: number
  isError: boolean
  isPaused: boolean
  failureCount: number
  refetch: (options?: { cancelRefetch?: boolean }) => Promise<unknown>
}

/**
 * Whether the last read of rules_now() brought no answer, so no older answer may be shown («Liberado
 * · até 11:00 ET» must not stay up after 11:00). Not only `isError`: with the app's query defaults a
 * failed read is retried three times (about 7 s) while the status stays 'success' (failureCount > 0),
 * and a read made offline is paused, never failed (isPaused). A new read resets failureCount to 0.
 */
export function rulesNowFailed(read: Pick<RulesNowRead, 'isError' | 'isPaused' | 'failureCount'>): boolean {
  return read.isError || read.isPaused || read.failureCount > 0
}

/**
 * useRulesNow() arms its read at changes_at again on every mount, counted from the mount rather than
 * from when the cached answer arrived, and the app's staleTime (60 s) skips the read on mount: back
 * on /diario at 11:00:20 with an answer from 10:59:30, «Liberado · até 11:00 ET» stayed until 11:00:51.
 * So the card asks again itself when the answer it found in the cache is due (its changes_at counted
 * from its arrival), and does not show an answer that was already due when it mounted.
 *
 * Returns true while the card waits for that read (it then shows «Carregando…»).
 */
export function useRulesNowCatchUp(read: Pick<RulesNowRead, 'data' | 'dataUpdatedAt' | 'refetch'>): boolean {
  const { data, dataUpdatedAt, refetch } = read
  // The answer the cache held when the card mounted, and when it is due again (device clock)
  const [mounted] = useState(() => {
    const delay = rulesNowRefetchDelay(data)
    return { answerAt: dataUpdatedAt, dueAt: delay === false ? null : dataUpdatedAt + delay }
  })
  const [dueAtMount] = useState(() => mounted.dueAt !== null && mounted.dueAt <= Date.now())
  // Once a newer answer arrives, useRulesNow armed its read from that answer: nothing to catch up
  const sameAnswer = dataUpdatedAt === mounted.answerAt

  useEffect(() => {
    if (!sameAnswer || mounted.dueAt === null) return
    // As useRulesNow: not while the tab is hidden (it reads again when the tab gets focus back)
    const ask = () => {
      if (focusManager.isFocused()) void refetch({ cancelRefetch: false })
    }
    const wait = mounted.dueAt - Date.now()
    if (wait <= 0) {
      ask()
      return
    }
    const id = setTimeout(ask, wait)
    return () => clearTimeout(id)
  }, [sameAnswer, mounted, refetch])

  return dueAtMount && sameAnswer
}

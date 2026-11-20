'use client'

import { useEffect, useState } from 'react'
import { useAgendaDoDia } from '@/hooks/useAgenda'
import { usePreferences } from '@/hooks/useContas'
import { useRelogioDados, useRulesNow } from '@/hooks/useRegras'
import { useServerClock } from '@/hooks/useRegistrar'
import { useDiarioPaginaOpcional } from '@/components/hub/diario/useDiarioPagina'
import { entendiLido, marcarEntendi, ouvirEntendi } from '@/lib/hub/avisoDados'
import { relogioDaJanela } from '@/lib/hub/posso'
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
 *
 * Phase 5-1 («Dados econômicos»): for the open account the card also arms the screen's own clocks (useRelogioDados on
 * the server clock: the 10-minute notice from start − 10 min until a wait starts, unless the preference is off, and
 * the window clock's midnight, where «amanhã» becomes the day itself), reads the day's agenda for the cancelled or
 * postponed releases' line (useAgendaDoDia; the gate itself comes from rules_now, which reads the agenda on the
 * server) and keeps the first-wait notice's «Entendi» on the device (lib/hub/avisoDados, the key shared with
 * Personalizar). It never writes `changes_at` or `active.end` as a time. «Tentar de novo» reads rules_now and the
 * day's agenda again (contract §3.8).
 */
export default function PossoOperarHojeDiario({ aguardandoConta = false }: { aguardandoConta?: boolean } = {}) {
  const rulesNow = useRulesNow()
  const catchingUp = useRulesNowCatchUp(rulesNow)
  const pagina = useDiarioPaginaOpcional()
  const selecionada = pagina?.conta.id

  const aberta = (selecionada && rulesNow.data?.accounts.find((a) => a.accountId === selecionada)) || null
  const rules = aberta?.rules ?? null
  const block = rules?.block ?? null
  const gate = aberta?.gate ?? null

  const prefs = usePreferences()
  const relogio = useRelogioDados(useServerClock(), {
    today: gate?.block.evaluated ? gate.block.today : [],
    tz: relogioDaJanela(rules),
    preferences: prefs.data ?? null,
  })
  const leAgenda = !!rules && !!block?.on
  const agenda = useAgendaDoDia(leAgenda ? { calendars: block!.calendars, clock: { tz: rules!.day.tz, startMin: rules!.day.startMin } } : null)

  // The device's «Entendi», read after mount (the server render has no storage)
  const [entendi, setEntendi] = useState(true)
  useEffect(() => {
    setEntendi(selecionada ? entendiLido(selecionada) : true)
    // «Entendi» pressed in another tab (Personalizar) reaches this card without a reload
    return selecionada ? ouvirEntendi(selecionada, setEntendi) : undefined
  }, [selecionada])

  // A read that failed, is being retried or waits offline wins over older lines: «Liberado · até
  // 11:00 ET» must not stay up after 11:00. While the Diário still reads which account is open, «Carregando…»:
  // every account's line would show for a moment before the card keeps only the open one
  const state: PossoEstado = rulesNowFailed(rulesNow)
    ? { status: 'error' }
    : rulesNow.data && !catchingUp && !aguardandoConta
      ? { status: 'ready', accounts: rulesNow.data.accounts }
      : { status: 'loading' }

  return (
    <PossoOperarHoje
      state={state}
      onRetry={() => {
        void rulesNow.refetch()
        // A disabled query's refetch would still run its read: only when the account follows the rule
        if (leAgenda) void agenda.refetch()
      }}
      selecionada={selecionada}
      dados={{
        agora: relogio.agora,
        // Not while the preferences are still being read: a notice switched off must not flash
        aviso: prefs.isPending && prefs.fetchStatus === 'fetching' ? null : relogio.avisoDezMin,
        agenda: agenda.data ?? null,
        entendi,
        onEntendi: () => {
          if (!selecionada) return
          marcarEntendi(selecionada)
          setEntendi(true)
        },
      }}
    />
  )
}

'use client'

import { useMemo } from 'react'
import { MARKET_SPEC } from '@/lib/domain/markets'
import { useContaAtual } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import { useDayTrades, useServerNow } from '@/hooks/useRegistrar'
import { diaDeHoje, podeRegistrar } from '@/lib/hub/registrar'
import { rulesNowFailed } from '@/components/hub/posso/rulesNowRead'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import { linhasDoDia } from './linhas'
import OperacoesDoDiaVista, { type EstadoDoDia } from './OperacoesDoDiaVista'

/**
 * «Operações do dia» on /diario (D16), for the Diário's current account when it can register in
 * 3-3 (Futuros, Ebinex; podeRegistrar), nothing otherwise. The day is the account's trading day
 * from the card's own rules_now read (one read for the card, the window line and this block),
 * else the day clock's on the server's now; a row's button opens the Registrar sheet on its trade.
 */
export default function OperacoesDoDia() {
  const conta = useContaAtual()
  const current = conta.current && podeRegistrar(conta.current.market) ? conta.current : null
  const rulesNow = useRulesNow()
  const serverNow = useServerNow(60_000)
  const registrar = useRegistrarSheet()

  const failed = rulesNowFailed(rulesNow)
  // Wait for rules_now's answer (its trading day places an overnight window on the day it opened),
  // unless it failed: then the day clock's day on the server's now
  const day = current && (rulesNow.data || failed) ? diaDeHoje(failed ? null : rulesNow.data, current, serverNow) : null
  const account = useMemo(() => (current ? { id: current.id, market: current.market } : null), [current])
  const dia = useDayTrades(account, day)

  // The table's HH:MM: the account's window clock (ET on Futuros, Brasília on Ebinex by default)
  const tz = useMemo(() => {
    if (!current) return null
    const now = rulesNow.data?.accounts.find((a) => a.accountId === current.id)
    return now?.rules?.windows[0]?.tz ?? MARKET_SPEC[current.market].windowTz
  }, [current, rulesNow.data])

  if (!current || !tz) return null

  let estado: EstadoDoDia
  if (dia.data && day) estado = { status: 'ready', linhas: linhasDoDia(dia.data, { market: current.market, day, tz }) }
  else if (dia.isError) estado = { status: 'error' }
  else if (dia.fetchStatus === 'paused') estado = { status: 'offline' }
  else estado = { status: 'loading' }

  return (
    <OperacoesDoDiaVista
      estado={estado}
      onAbrir={(tradeId, opener) => registrar.open({ accountId: current.id, tradeId, opener })}
      onTentar={() => void dia.refetch()}
    />
  )
}

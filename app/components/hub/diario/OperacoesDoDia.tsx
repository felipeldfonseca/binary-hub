'use client'

import { useMemo } from 'react'
import { MARKET_SPEC, type AccountMarket } from '@/lib/domain/markets'
import { useContaAtual } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import { useDayTrades, useServerNow } from '@/hooks/useRegistrar'
import { diaDeHoje, podeRegistrar } from '@/lib/hub/registrar'
import type { RulesNow } from '@/lib/hub/regras'
import { rulesNowFailed } from '@/components/hub/posso/rulesNowRead'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import { linhasDoDia } from './linhas'
import OperacoesDoDiaVista, { type EstadoDoDia } from './OperacoesDoDiaVista'

/**
 * The bridge's trading day. rules_now's places an overnight window on the day it opened, so the
 * bridge waits for its first answer; with none and a failed read, the day clock's day on the
 * server's now. An answer holds until its changes_at (a window edge or the day's end, on the
 * server's clock): a later read that fails, is retried or waits offline does not move the day
 * before then (an overnight window would jump to the day clock's day, and a read paused offline
 * would swap the table for «Sem conexão»). null: wait.
 */
export function diaDaPonte(
  data: RulesNow | undefined,
  failed: boolean,
  account: { id: string; market: AccountMarket },
  serverNow: Date,
): string | null {
  if (data) {
    const gate = data.accounts.find((a) => a.accountId === account.id)?.gate
    const holds = !!gate && (gate.changesAt === null || serverNow.getTime() < gate.changesAt.getTime())
    if (!failed || holds) return diaDeHoje(data, account, serverNow)
  }
  return failed ? diaDeHoje(null, account, serverNow) : null
}

/**
 * «Operações do dia» on /diario (D16), for the Diário's current account when it can register
 * (podeRegistrar: every market since 3-4), nothing otherwise. The day is the account's trading day
 * from the card's own rules_now read (one read for the card, the window line and this block),
 * else the day clock's on the server's now (diaDaPonte); a row's button opens the Registrar sheet on
 * its trade, and the block's title takes the focus when that row is gone after the sheet (an entry
 * undone).
 */
export default function OperacoesDoDia() {
  const conta = useContaAtual()
  const current = conta.current && podeRegistrar(conta.current.market) ? conta.current : null
  const rulesNow = useRulesNow()
  const serverNow = useServerNow(60_000)
  const registrar = useRegistrarSheet()

  const failed = rulesNowFailed(rulesNow)
  const day = current ? diaDaPonte(rulesNow.data, failed, current, serverNow) : null
  const account = useMemo(() => (current ? { id: current.id, market: current.market } : null), [current])
  const dia = useDayTrades(account, day)

  // The table's HH:MM: the account's window clock (its market's by default: ET on Futuros, Forex
  // and Ações; Brasília on Ebinex, Cripto and B3)
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
      onAbrir={(tradeId, opener, fallback) => registrar.open({ accountId: current.id, tradeId, opener, fallback })}
      onTentar={() => void dia.refetch()}
    />
  )
}

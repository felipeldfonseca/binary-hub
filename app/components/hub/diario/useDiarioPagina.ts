'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { UseQueryResult } from '@tanstack/react-query'
import { monthOf, weekOf, type CalendarRead, type Day, type MonthRead } from '@/lib/domain/diario'
import type { Rules } from '@/lib/domain/gate'
import { useDiarioCalendario, useDiarioDia, useDiarioMes } from '@/hooks/useDiario'
import { useRulesNow } from '@/hooks/useRegras'
import type { TradingAccount } from '@/lib/hub/contas'
import type { ContaDiario } from '@/lib/hub/diario'
import type { DayRead, DiarioDataError } from '@/lib/hub/diarioDb'
import { contaDiarioDe, diaDaUrl } from '@/lib/hub/diarioPagina'
import { contaReg as contaRegDe, type ContaReg } from '@/lib/hub/registrarForm'
import { SECAO } from './ids'

/**
 * The Diário page's shared state (Phase 4, telas B0; signatures frozen for both lanes, contract §4.3): the open
 * account, its reads (the calendar, the month shown, the open day) and what the page has open. The open day and a
 * trade asked for (`op`) follow the URL (`?dia=`, `?op=`) at every change; the month and the week shown follow the
 * open day until the calendar or the week card choose another. Everything resets when the account changes (the
 * provider is not remounted: the header keeps its focus).
 */
export interface DiarioPaginaValor {
  conta: TradingAccount
  contas: readonly TradingAccount[]
  /** rules_now's rules of the open account (null before version 1 or before the read) */
  regras: Rules | null
  /** {currency, market, tz}: tz = regras.windows[0].tz ?? MARKET_SPEC[market].windowTz */
  contaDiario: ContaDiario
  /** registrarForm.contaReg(conta, regras, desdeDay) — for useMarcar / useAnexos / linhaDoTempo */
  contaReg: ContaReg
  calendario: UseQueryResult<CalendarRead, DiarioDataError>
  /** calendario.data?.today */
  hoje: Day | null
  /** calendario.data?.desdeDay */
  desdeDay: Day | null
  /** the open day: ?dia= (diaDaUrl) else hoje; null until known */
  dia: Day | null
  /** 'YYYY-MM' shown; defaults to monthOf(dia) and follows a day opened outside the calendar */
  mes: string | null
  /** Monday of the week shown; defaults to weekOf(dia); reset when a day opens */
  semana: Day | null
  /** useDiarioMes(conta.id, mes, { today: hoje }) */
  mesLido: UseQueryResult<MonthRead, DiarioDataError>
  /** useDiarioDia(conta.id, dia, { today: hoje }) */
  diaLido: UseQueryResult<DayRead, DiarioDataError>
  /** the last day opened with anunciar (D5 «Aberto abaixo: …»), and the last week (J3) */
  diaAnunciado: Day | null
  semanaAnunciada: Day | null
  abrirDia(day: Day, o?: { op?: string | null; anunciar?: boolean }): void
  mostrarMes(month: string, o?: { focarPrimeiro?: boolean }): void
  abrirSemana(week: Day): void
  /** the trade a deep link or «Abrir 30 nov» asked for; L2 opens its drill and focuses its ▾, then calls consumirOp */
  opPedida: string | null
  consumirOp(): void
  /** L2 registers a guard (H12): abrirDia and account changes wait for it to resolve true */
  registrarGuarda(g: (() => Promise<boolean>) | null): void
  /**
   * Resolves true at once when no guard is registered, else the guard's answer. abrirDia awaits it;
   * the header's choose() awaits it before touching the URL (an account choice is the header's, L1's
   * file after B0: this is how it asks L2's guard without either lane editing the other's file)
   */
  confirmarSaida(): Promise<boolean>
}

const DiarioPaginaContext = createContext<DiarioPaginaValor | null>(null)

/** The page's state; throws outside the provider or without an account */
export function useDiarioPagina(): DiarioPaginaValor {
  const v = useContext(DiarioPaginaContext)
  if (!v) throw new Error('useDiarioPagina must be used inside DiarioPaginaProvider, with an account')
  return v
}

/** The page's state, or null without an account (or outside the provider): the header's use */
export function useDiarioPaginaOpcional(): DiarioPaginaValor | null {
  return useContext(DiarioPaginaContext)
}

/** A region is scrolled into view when its top is below this far from the window's bottom */
const DOBRA_PX = 120

/** What the page keeps, for the account it belongs to (another account reads as the initial state) */
interface Estado {
  contaId: string | null
  /** The month the calendar chose, while the open day is `paraDia` */
  mes: { mes: string; paraDia: Day | null } | null
  /** The week the calendar chose, while the open day is `paraDia` */
  semana: { semana: Day; paraDia: Day | null } | null
  diaAnunciado: Day | null
  semanaAnunciada: Day | null
  opPedida: string | null
}

const inicial = (contaId: string | null): Estado => ({ contaId, mes: null, semana: null, diaAnunciado: null, semanaAnunciada: null, opPedida: null })

/** Scrolls a region into view when its top is under the fold (after the render that drew it) */
function rolarSeAbaixo(id: string) {
  if (typeof window === 'undefined') return
  const rolar = () => {
    const el = document.getElementById(id)
    if (!el) return
    if (el.getBoundingClientRect().top > window.innerHeight - DOBRA_PX) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(rolar)
  else setTimeout(rolar, 0)
}

/**
 * The provider of the Diário page (DiarioPagina): reads the open account's calendar, the month shown and the open
 * day, and keeps what the page has open. `conta` null: no account (the header shows the empty state), no value.
 */
export function DiarioPaginaProvider({ conta, contas, children }: { conta: TradingAccount | null; contas: readonly TradingAccount[]; children?: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const contaId = conta?.id ?? null
  const rulesNow = useRulesNow()
  const regras = useMemo(
    () => (contaId ? (rulesNow.data?.accounts.find((a) => a.accountId === contaId)?.rules ?? null) : null),
    [rulesNow.data, contaId],
  )

  const calendario = useDiarioCalendario(contaId)
  const hoje = calendario.data?.today ?? null
  const desdeDay = calendario.data?.desdeDay ?? null

  const [guardado, setEstado] = useState<Estado>(() => inicial(contaId))
  const estado = guardado.contaId === contaId ? guardado : inicial(contaId)
  const mudar = useCallback(
    (f: (e: Estado) => Estado) => setEstado((s) => f(s.contaId === contaId ? s : inicial(contaId))),
    [contaId],
  )

  // The open day follows the URL at every change (a push from the Registrar sheet, back and forward)
  const diaParam = searchParams?.get('dia') ?? null
  const dia = hoje ? (diaDaUrl(diaParam, hoje) ?? hoje) : null
  const mes = dia ? (estado.mes && estado.mes.paraDia === dia ? estado.mes.mes : monthOf(dia)) : null
  const semana = dia ? (estado.semana && estado.semana.paraDia === dia ? estado.semana.semana : weekOf(dia)) : null

  const mesLido = useDiarioMes(contaId, mes, { today: hoje })
  const diaLido = useDiarioDia(contaId, dia, { today: hoje })

  // A ?op= (on load or pushed while mounted) becomes the trade asked for, and leaves the URL
  const opParam = searchParams?.get('op') ?? null
  const urlAtual = useRef<string>('')
  urlAtual.current = searchParams?.toString() ?? ''
  useEffect(() => {
    if (!opParam || !contaId) return
    mudar((s) => ({ ...s, opPedida: opParam }))
    const params = new URLSearchParams(urlAtual.current)
    params.delete('op')
    const q = params.toString()
    router.replace(q ? `${pathname ?? '/diario'}?${q}` : pathname ?? '/diario', { scroll: false })
  }, [opParam, contaId, mudar, router, pathname])

  const guarda = useRef<(() => Promise<boolean>) | null>(null)
  const registrarGuarda = useCallback((g: (() => Promise<boolean>) | null) => {
    guarda.current = g
  }, [])
  const confirmarSaida = useCallback(async () => (guarda.current ? guarda.current() : true), [])

  const abrirDia = useCallback(
    (day: Day, o: { op?: string | null; anunciar?: boolean } = {}) => {
      void (async () => {
        if (!(await confirmarSaida())) return
        const params = new URLSearchParams(urlAtual.current)
        if (hoje && day === hoje) params.delete('dia')
        else params.set('dia', day)
        params.delete('op')
        const q = params.toString()
        router.replace(q ? `${pathname ?? '/diario'}?${q}` : pathname ?? '/diario', { scroll: false })
        mudar((s) => ({
          ...s,
          mes: null,
          semana: null,
          diaAnunciado: o.anunciar ? day : s.diaAnunciado,
          opPedida: o.op ?? null,
        }))
        rolarSeAbaixo(SECAO.dia)
      })()
    },
    [confirmarSaida, hoje, router, pathname, mudar],
  )

  // «focarPrimeiro»: the first clickable day of the month just shown takes the focus once it is drawn
  const [focoNoMes, setFocoNoMes] = useState<string | null>(null)
  useEffect(() => {
    if (!focoNoMes || mes !== focoNoMes) return
    const cal = document.getElementById(SECAO.calendario)
    const alvo = cal?.querySelector<HTMLElement>('[data-dia][tabindex="0"]') ?? cal?.querySelector<HTMLElement>('button[data-dia]')
    if (alvo) {
      alvo.focus()
      setFocoNoMes(null)
    }
  }, [focoNoMes, mes, calendario.data, mesLido.data])

  const mostrarMes = useCallback(
    (month: string, o: { focarPrimeiro?: boolean } = {}) => {
      mudar((s) => ({ ...s, mes: { mes: month, paraDia: dia } }))
      setFocoNoMes(o.focarPrimeiro ? month : null)
    },
    [mudar, dia],
  )

  const abrirSemana = useCallback(
    (week: Day) => {
      mudar((s) => ({ ...s, semana: { semana: week, paraDia: dia }, semanaAnunciada: week }))
      rolarSeAbaixo(SECAO.semana)
    },
    [mudar, dia],
  )

  const consumirOp = useCallback(() => mudar((s) => ({ ...s, opPedida: null })), [mudar])

  const valor = useMemo<DiarioPaginaValor | null>(() => {
    if (!conta) return null
    return {
      conta,
      contas,
      regras,
      contaDiario: contaDiarioDe(conta, regras),
      contaReg: contaRegDe(conta, regras, desdeDay),
      calendario,
      hoje,
      desdeDay,
      dia,
      mes,
      semana,
      mesLido,
      diaLido,
      diaAnunciado: estado.diaAnunciado,
      semanaAnunciada: estado.semanaAnunciada,
      abrirDia,
      mostrarMes,
      abrirSemana,
      opPedida: estado.opPedida,
      consumirOp,
      registrarGuarda,
      confirmarSaida,
    }
  }, [
    conta,
    contas,
    regras,
    desdeDay,
    calendario,
    hoje,
    dia,
    mes,
    semana,
    mesLido,
    diaLido,
    estado.diaAnunciado,
    estado.semanaAnunciada,
    estado.opPedida,
    abrirDia,
    mostrarMes,
    abrirSemana,
    consumirOp,
    registrarGuarda,
    confirmarSaida,
  ])

  return createElement(DiarioPaginaContext.Provider, { value: valor }, children)
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { diaLongo, etiquetasDoDia, notaDoDia } from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import type { ContaDaOperacao } from '@/lib/hub/diarioOperacao'
import { LOADING } from '@/components/hub/contas/copy'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import NumerosDoDia from './NumerosDoDia'
import PlanoDoDia from './PlanoDoDia'
import OperacoesTabela from './OperacoesTabela'
import RevisaoDoDia from './RevisaoDoDia'
import type { GuardaDoDrill } from './OperacaoDetalhe'
import { useDiarioPagina, type DiarioPaginaValor } from './useDiarioPagina'
import { SECAO, TITULO, drillId, linhaId } from './ids'

/**
 * The open day's body (keyed by account and day: the open drill, the guard and the review's form start again on
 * another day): the note under the heading, the tiles, «O plano do dia» (with «Antes de operar»), «Operações do dia»
 * with the drill, and «Revisão do dia».
 */
function CorpoDoDia({ p, d }: { p: DiarioPaginaValor; d: DayRead }) {
  const registrar = useRegistrarSheet()
  const conta = useMemo<ContaDaOperacao>(
    () => ({ market: p.contaDiario.market, currency: p.contaDiario.currency, tz: p.contaDiario.tz, reg: p.contaReg }),
    [p.contaDiario, p.contaReg],
  )
  const [aberta, setAberta] = useState<string | null>(null)
  const tituloOps = useRef<HTMLHeadingElement>(null)

  // H12: the open drill's editor holds unsaved images or a note: leaving asks «Fechar sem salvar?» there
  const pendente = useRef(false)
  const [guarda, setGuarda] = useState<{ resolver: (ok: boolean) => void } | null>(null)
  const aoPendente = useCallback((x: boolean) => {
    pendente.current = x
  }, [])
  const confirmar = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (!pendente.current) return resolve(true)
        setGuarda({
          resolver: (ok) => {
            setGuarda(null)
            if (ok) pendente.current = false
            resolve(ok)
          },
        })
      }),
    [],
  )
  const { registrarGuarda } = p
  useEffect(() => {
    registrarGuarda(confirmar)
    return () => registrarGuarda(null)
  }, [registrarGuarda, confirmar])
  const guardaDoDrill = useMemo<GuardaDoDrill | null>(
    () => (guarda ? { sair: () => guarda.resolver(true), ficar: () => guarda.resolver(false) } : null),
    [guarda],
  )

  const alternar = useCallback(
    async (tid: string) => {
      if (!(await confirmar())) return
      setAberta((a) => (a === tid ? null : tid))
    },
    [confirmar],
  )

  // A deep link or «Abrir 30 nov»: the trade's drill opens and its ▾ takes the focus
  const { opPedida, consumirOp } = p
  const [focarLinha, setFocarLinha] = useState<string | null>(null)
  useEffect(() => {
    if (!opPedida) return
    if (d.trades.some((t) => t.trade.id === opPedida)) {
      setAberta(opPedida)
      setFocarLinha(opPedida)
    }
    consumirOp()
  }, [opPedida, consumirOp, d.trades])
  useEffect(() => {
    if (!focarLinha) return
    const botao = document.getElementById(linhaId(focarLinha))
    if (!botao) return
    setFocarLinha(null)
    document.getElementById(drillId(focarLinha))?.scrollIntoView?.({ block: 'nearest' })
    botao.focus()
  }, [focarLinha, aberta])

  const calDay = p.calendario.data?.days.find((x) => x.day === d.day) ?? null
  const historia = d.trades.filter((t) => t.history).map((t) => t.trade.entryTime)
  const nota = notaDoDia(d.kind, p.contaDiario, d.desde, historia)
  const comPlano = !!d.plan.rules && d.kind !== 'historico'

  return (
    <>
      {nota && <p className="hub-dr-dia-nota">{nota}</p>}
      <NumerosDoDia d={d} calDay={calDay} conta={p.contaDiario} />
      {comPlano && <PlanoDoDia d={d} hoje={p.hoje} accountId={p.conta.id} conta={p.contaDiario} />}
      <OperacoesTabela
        ref={tituloOps}
        d={d}
        conta={conta}
        accountId={p.conta.id}
        hoje={p.hoje}
        aberta={aberta}
        aoAlternar={(tid) => void alternar(tid)}
        aoAcao={(tid, opener) => registrar.open({ accountId: p.conta.id, tradeId: tid, opener, fallback: tituloOps.current })}
        aoRegistrar={(opener) => registrar.open({ accountId: p.conta.id, opener })}
        aoAbrirDia={(day, tid) => p.abrirDia(day, { op: tid, anunciar: true })}
        aoPendente={aoPendente}
        guarda={guardaDoDrill}
      />
      {comPlano && <RevisaoDoDia d={d} accountId={p.conta.id} conta={p.contaDiario} />}
    </>
  )
}

/**
 * «O dia» (lane L2, contract §2.2 E–I): `section#dia` with the open day's heading and tags, then its body once
 * diario_dia answered («Carregando…» until then; a read that fails after answering keeps the day drawn).
 */
export default function ODia() {
  const p = useDiarioPagina()
  const { dia, diaLido, hoje, calendario, contaDiario } = p
  if (!dia) return null
  const d = diaLido.data && diaLido.data.day === dia ? diaLido.data : null
  const calDay = calendario.data?.days.find((x) => x.day === dia) ?? null
  const tags = hoje ? etiquetasDoDia(calDay, hoje, contaDiario, d?.facts.limit?.hitAt ?? null) : []
  return (
    <section id={SECAO.dia} aria-labelledby={TITULO.dia} className="hub-dr-cartao hub-dr-dia-cartao">
      <div className="hub-dr-dia-cab">
        <h2 id={TITULO.dia} tabIndex={-1} className="hub-dr-h2">
          {diaLongo(dia)}
        </h2>
        {d && tags.map((t) => (
          <span key={t} className="hub-dr-chip">
            {t}
          </span>
        ))}
      </div>
      {d ? (
        <CorpoDoDia key={`${p.conta.id}-${dia}`} p={p} d={d} />
      ) : (
        <p role="status" className="hub-dr-sub">
          {LOADING}
        </p>
      )}
    </section>
  )
}

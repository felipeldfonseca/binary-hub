'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useContaAtual } from '@/hooks/useContas'
import { avisoDeRevisoes, linhaDoTopo } from '@/lib/hub/diario'
import { useDiarioPagina } from './useDiarioPagina'
import { useSemConexao } from './DiarioEstados'
import { SECAO, TITULO } from './ids'
import { OFFLINE, PENDENTES, SEM_REGRAS, TOPO } from './copyMes'

/** «×» of the pending-reviews banner closes it for the session, per account (sessionStorage, contract C4) */
const chaveDoAviso = (accountId: string) => `bh-diario-aviso-fechado:${accountId}`

function avisoFechado(accountId: string): boolean {
  try {
    return window.sessionStorage.getItem(chaveDoAviso(accountId)) === '1'
  } catch {
    return false
  }
}

function fecharAviso(accountId: string): void {
  try {
    window.sessionStorage.setItem(chaveDoAviso(accountId), '1')
  } catch {
    // Without storage the banner stays closed until the page is left
  }
}

/** Gives the focus to «Calendário» (its H2, tabIndex −1; drawn whenever the banner is) */
const focarCalendario = () => document.getElementById(TITULO.calendario)?.focus()

/**
 * The top of the Diário page (lane L1, contract §2.2 A15, C1–C5; boards DiarioDezEnxuto / DiarioHojeEnxuto): the
 * section links «Calendário · O dia · Semana», the line «Diário desde …» (once the calendar answered), the account
 * chosen in the selector for a screen reader («Conta Apex 50k #5.», not on the first load), the banner of an account
 * without rules (C3), the pending-reviews banner (C4: «Ver no calendário» shows the newest pending day's month, × closes
 * it for the session; both give the focus to «Calendário»), and the offline band over the page (C5), drawn data or
 * not (board 10e).
 */
export default function TopoDoDiario() {
  const { conta, calendario, mesLido, diaLido, mostrarMes } = useDiarioPagina()
  const semConexao = useSemConexao()
  const cal = calendario.data ?? null
  const hoje = cal?.today ?? null

  // A15: the account a choice in the selector opened (the provider is not remounted: this region sees the change).
  // Not on the first load: while the accounts or the preferences are read (useContaAtual's isLoading, as the page's
  // own), the page draws the primary account, then the saved one (preferences.conta_atual) once they come; that change,
  // in the render where the reading ended, is nobody's choice (the header shows «Carregando…» until then)
  const { isLoading: contasLendo } = useContaAtual()
  const contaAnterior = useRef(conta.id)
  const lendoAntes = useRef(contasLendo)
  const [contaStatus, setContaStatus] = useState('')
  useEffect(() => {
    const primeiraLeitura = lendoAntes.current || contasLendo
    lendoAntes.current = contasLendo
    if (contaAnterior.current === conta.id) return
    contaAnterior.current = conta.id
    if (!primeiraLeitura) setContaStatus(TOPO.contaStatus(conta.label))
  }, [conta.id, conta.label, contasLendo])

  // C4: closed for the session (storage may throw or be empty: then only until the page is left)
  const [fechados, setFechados] = useState<Record<string, true>>({})
  const fechado = !!fechados[conta.id] || avisoFechado(conta.id)

  // Not in C6 / C7: the line and the banner need the calendar's answer, and give way to the error
  const falhou = [calendario, mesLido, diaLido].some((q) => q.isError && !q.data)
  const linha = cal && hoje && !falhou ? linhaDoTopo(cal.desdeDay, cal.days, hoje) : null
  const aviso = cal && hoje && !falhou ? avisoDeRevisoes(cal.days, hoje) : null
  const semRegras = !!cal && cal.desde === null

  return (
    <>
      <div className="hub-dr-topo">
        <nav aria-label={TOPO.secoes} className="hub-dr-topo-secoes">
          <a href={`#${SECAO.calendario}`}>{TOPO.calendario}</a>
          <a href={`#${SECAO.dia}`}>{TOPO.dia}</a>
          <a href={`#${SECAO.semana}`}>{TOPO.semana}</a>
        </nav>
        {linha && <p className="hub-dr-sub">{linha}</p>}
      </div>
      <div role="status" className="sr-only">
        {contaStatus}
      </div>
      {semRegras && (
        <section aria-labelledby="t-sem-regras" className="hub-dr-faixa hub-dr-topo-aviso">
          <div className="hub-dr-topo-aviso-txt">
            <h2 id="t-sem-regras" className="hub-dr-topo-aviso-tit">
              {SEM_REGRAS.titulo}
            </h2>
            <p className="hub-dr-sub">{SEM_REGRAS.texto}</p>
          </div>
          <Link href="/personalizar#regras" className="hub-btn hub-dr-topo-botao">
            {SEM_REGRAS.definir}
          </Link>
        </section>
      )}
      {aviso && !fechado && (
        <div role="region" aria-label={PENDENTES.regiao} className="hub-dr-faixa hub-dr-topo-aviso">
          <svg className="hub-dr-topo-icone" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <div className="hub-dr-topo-aviso-txt hub-dr-topo-aviso-txt--curto">
            <p className="hub-dr-topo-aviso-forte">{aviso.texto}</p>
            <p className="hub-dr-sub">{PENDENTES.sub}</p>
          </div>
          <a
            href={`#${SECAO.calendario}`}
            className="hub-btn hub-dr-topo-botao"
            onClick={(event) => {
              event.preventDefault()
              mostrarMes(aviso.mes)
              focarCalendario()
            }}
          >
            {PENDENTES.ver}
          </a>
          <button
            type="button"
            className="hub-btn hub-btn--icone hub-dr-topo-x"
            aria-label={PENDENTES.fechar}
            onClick={() => {
              fecharAviso(conta.id)
              setFechados((f) => ({ ...f, [conta.id]: true }))
              focarCalendario()
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      {semConexao && (
        <div role="status" className="hub-dr-faixa hub-dr-topo-offline">
          <span>{OFFLINE}</span>
        </div>
      )}
    </>
  )
}

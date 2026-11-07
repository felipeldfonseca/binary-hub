'use client'

import { useContaAtual } from '@/hooks/useContas'
import DiarioCabecalho from '@/components/hub/contas/DiarioCabecalho'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import { DiarioPaginaProvider } from './useDiarioPagina'
import TopoDoDiario from './TopoDoDiario'
import DiarioEstados from './DiarioEstados'
import Calendario from './Calendario'
import ODia from './ODia'
import SemanaCartao from './SemanaCartao'
import RodapeDiario from './RodapeDiario'

/**
 * The Diário page (Phase 4, telas; the approved boards DiarioDezEnxuto and DiarioHojeEnxuto): the header, «Posso
 * operar hoje?», then — with an account — the top of the page, the calendar, the open day, the week and the footer,
 * in the boards' order. Every region reads the shared state (useDiarioPagina); lane L1 builds the header, the card,
 * the top, the states, the calendar, the week and the footer, lane L2 the open day.
 */
export default function DiarioPagina() {
  const conta = useContaAtual()
  // Without ?conta=, the saved choice (the preferences) decides the account: until it is read, nothing below the
  // header (it says «Carregando…»), so the primary account is never drawn, nor read, on the way to the saved one
  const aberta = conta.isLoading ? null : conta.current
  return (
    // Not keyed: an account change must not remount the header (focus goes back to «Conta: …»);
    // the provider resets its own state when conta.current?.id changes (contract §4.3)
    <DiarioPaginaProvider conta={aberta} contas={conta.active}>
      <DiarioCabecalho />
      <PossoOperarHojeDiario aguardandoConta={conta.isLoading} />
      {aberta && (
        <>
          <TopoDoDiario />
          <DiarioEstados>
            <Calendario />
            <ODia />
            <SemanaCartao />
          </DiarioEstados>
          <RodapeDiario />
        </>
      )}
    </DiarioPaginaProvider>
  )
}

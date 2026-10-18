'use client'

import { formatDiaMes } from '@/lib/hub/formato'
import type { AccountConfig, PendingVersion } from '@/lib/hub/regras'
import { aoSalvarConta, aoSalvarPadrao, notaVersao, quandoVersao } from '@/lib/hub/comoFicaHoje'
import { Disclosure, useToggle } from '@/components/hub/contas/ui'
import { SEP, VERSAO } from './copy'
import { useFocoPendente } from './ui'

/**
 * The version block under «Como fica hoje» (board .versao): «Padrão de Futuros» and who uses it,
 * or the account's versions («Regras v1 desde 17 out», the list, «Antes de …»), and what a save
 * would add («Ao salvar: …»). An account without versions can start its rules today.
 */
export default function BlocoVersao({
  conta,
  futuros,
  todas,
  pendentes,
  now,
  tradesDesde,
  onComecar,
}: {
  /** null = «Padrão Futuros» */
  conta: AccountConfig | null
  /** Active futures accounts («Usado por …») */
  futuros: readonly AccountConfig[]
  /** Every account of rules_config (labels of «copiadas de …») */
  todas: readonly AccountConfig[]
  pendentes: readonly PendingVersion[]
  now: Date
  tradesDesde: Record<string, number> | undefined
  onComecar: (accountId: string) => void
}) {
  const [aberto, alternar] = useToggle()
  const pedirFoco = useFocoPendente()

  if (!conta) {
    const proxima = aoSalvarPadrao(pendentes, futuros, now)
    return (
      <div className="hub-pz-versao">
        <strong>{VERSAO.padrao}</strong>
        <p className="hub-nota">{VERSAO.usadoPor(futuros.map((a) => a.label))}</p>
        {proxima && <p className="hub-pz-proxima">{proxima}</p>}
      </div>
    )
  }

  const vs = conta.versions
  const proxima = aoSalvarConta(pendentes, conta.id, now)
  if (!vs.length) {
    return (
      <div className="hub-pz-versao">
        <strong>{VERSAO.nenhuma}</strong>
        <p className="hub-nota">{VERSAO.ateSalvar}</p>
        {proxima ? (
          // Takes focus when «Começar as regras hoje» (which it replaces) was pressed
          <p id="r-proxima" className="hub-pz-proxima hub-alvo-foco" tabIndex={-1}>
            {proxima}
          </p>
        ) : (
          <div>
            <button
              type="button"
              className="hub-btn"
              onClick={() => {
                pedirFoco('r-proxima')
                onComecar(conta.id)
              }}
            >
              {VERSAO.comecar}
            </button>
          </div>
        )}
      </div>
    )
  }

  const ultima = vs[vs.length - 1]
  const d1 = formatDiaMes(vs[0].effectiveDay)
  const n = tradesDesde?.[conta.id]
  const labelOf = (id: string) => todas.find((a) => a.id === id)?.label ?? null
  return (
    <div className="hub-pz-versao">
      <strong>{VERSAO.regrasDesde(ultima.versionNo, formatDiaMes(ultima.effectiveDay))}</strong>
      {n !== undefined && <p className="hub-nota">{VERSAO.operacoesDesde(n, d1)}</p>}
      {proxima && <p className="hub-pz-proxima">{proxima}</p>}
      <div>
        <Disclosure open={aberto} controls="lista-versoes" onToggle={alternar}>
          {VERSAO.versoes(vs.length)}
        </Disclosure>
      </div>
      {aberto && (
        <ol id="lista-versoes" className="hub-pz-versoes">
          {vs
            .map((v, i) => {
              const nota = notaVersao(vs, i, labelOf)
              return (
                <li key={v.id}>
                  {/* The « · » never starts or ends a line (SEP), as in the note itself */}
                  <strong className="hub-pz-num">v{v.versionNo}</strong>
                  {SEP}
                  {quandoVersao(vs, i, now)}
                  {nota && (
                    <>
                      {SEP}
                      <span className="hub-tom--muted">{nota}</span>
                    </>
                  )}
                </li>
              )
            })
            .reverse()}
          <li className="hub-tom--muted">{VERSAO.antes(d1)}</li>
        </ol>
      )}
      <p className="hub-pz-analises">{VERSAO.analises}</p>
    </div>
  )
}

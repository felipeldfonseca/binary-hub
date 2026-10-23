'use client'

/**
 * hc · «N contas neste arquivo» (Phase 3b, board IC l.449–461, 1624–1641, 1912): one row per value of the «Conta» column
 * (first-appearance order) with «Importar em {conta}» / «Não importar»; one value per import, so importing one sets
 * every other to «Não importar». The step writes only the mapping's `accountValue` (the value as the file writes it;
 * null: none chosen yet, and the sheet's «Continuar» waits). A value other than the account's «Número na plataforma»
 * gets the amber warning; the values left say how to import them; each switch is said by the sheet's live region.
 */
import { useMemo } from 'react'
import { accountKey } from '@/lib/domain/import'
import type { TradingAccount } from '@/lib/hub/contas'
import { contasDoArquivo } from '@/lib/hub/importPrevia'
import type { Mapeamento } from '@/lib/hub/importMapeado'
import { PASSO_HC } from '@/components/hub/contas/copy'

export interface PassoContasDoArquivoProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  mapeamento: Mapeamento
  /** The destination account (its label, its «Número na plataforma», its market) */
  conta: Pick<TradingAccount, 'label' | 'external_ref' | 'market'>
  onChange: (m: Mapeamento) => void
  /** What the sheet's live region says after a switch */
  onAnuncio: (texto: string) => void
}

export default function PassoContasDoArquivo({ headingRef, mapeamento: m, conta, onChange, onAnuncio }: PassoContasDoArquivoProps) {
  const valores = useMemo(() => contasDoArquivo(m, conta.market), [m, conta.market])
  const escolhida = m.accountValue === null ? null : accountKey(m.accountValue)
  const numero = conta.external_ref ? accountKey(conta.external_ref) : null
  const avisoDe = (chave: string | null) => (chave !== null && numero !== null && chave !== numero && conta.external_ref ? PASSO_HC.aviso(conta.label, conta.external_ref) : null)
  const aviso = avisoDe(escolhida)
  const naoImportados = valores.filter((v) => v.chave !== escolhida).map((v) => v.valor)
  const execucoes = m.rowKind === 'fill'

  const mudar = (k: number, v: string) => {
    const linha = valores[k]
    if (v === 'importar') {
      if (linha.chave === escolhida) return
      const trocadas = valores.filter((x) => x.chave === escolhida).map((x) => x.valor)
      onChange({ ...m, accountValue: linha.valor })
      const depois = avisoDe(linha.chave)
      onAnuncio(trocadas.length ? `${PASSO_HC.passou(trocadas)}${depois ? ` ${depois}` : ''}` : depois ?? '')
    } else if (v === 'nao' && linha.chave === escolhida) {
      onChange({ ...m, accountValue: null })
      onAnuncio(PASSO_HC.passou([linha.valor]))
    }
  }

  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {PASSO_HC.title(valores.length)}
      </h3>
      <div className="hub-contas-arquivo">
        {valores.map((v, k) => (
          <div key={v.chave} className="hub-conta-linha">
            <span className="hub-conta-linha__txt">
              <span className="hub-num">{v.valor}</span> · {execucoes ? PASSO_HC.linhas(v.n) : PASSO_HC.ops(v.n)}
            </span>
            <select
              className="hub-sel"
              aria-label={PASSO_HC.aria(v.valor)}
              value={v.chave === escolhida ? 'importar' : 'nao'}
              onChange={(event) => mudar(k, event.target.value)}
            >
              <option value="importar">{PASSO_HC.importarEm(conta.label)}</option>
              <option value="nao">{PASSO_HC.naoImportar}</option>
            </select>
          </div>
        ))}
      </div>
      <p className="hub-nota">{PASSO_HC.escolhemos}</p>
      {aviso && <div className="hub-bloco hub-bloco--atencao">{aviso}</div>}
      {naoImportados.length > 0 && <p className="hub-nota">{PASSO_HC.nota(naoImportados)}</p>}
    </div>
  )
}

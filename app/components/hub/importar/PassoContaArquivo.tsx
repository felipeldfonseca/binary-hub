'use client'

/**
 * a2 · «Para qual conta?» for a file no reader takes (Phase 3b, board IC l.437–447, 1642–1647, 1913–1914): every active
 * account of a market that imports by columns, grouped by market (binaries never: their accounts take only the Ebinex
 * CSV), and «+ Nova conta». Nothing is pressed at first (D7); the sheet's «Continuar» waits for a choice.
 */
import { MARKET_SPEC } from '@/lib/domain/markets'
import { groupByMarket, type TradingAccount } from '@/lib/hub/contas'
import { MARKET_LABEL, PASSO_A2 } from '@/components/hub/contas/copy'

export interface PassoContaArquivoProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  /** The active accounts, in the app's order (sortAccounts) */
  accounts: readonly TradingAccount[]
  /** An account id, 'nova' («+ Nova conta») or null (nothing pressed) */
  choice: string | null
  onChoose: (choice: string) => void
}

export default function PassoContaArquivo({ headingRef, accounts, choice, onChoose }: PassoContaArquivoProps) {
  const grupos = groupByMarket(accounts.filter((a) => MARKET_SPEC[a.market].mapping))
  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {PASSO_A2.title}
      </h3>
      <p className="hub-nota">{PASSO_A2.nota}</p>
      {grupos.map((g, k) => (
        <div key={g.market} className="hub-grupo-a">
          <span id={`a2-g${k}`} className="hub-rotulo">
            {MARKET_LABEL[g.market]}
          </span>
          <div role="group" aria-labelledby={`a2-g${k}`} className="hub-pills">
            {g.accounts.map((a) => (
              <button key={a.id} type="button" className="hub-pill" aria-pressed={choice === a.id} onClick={() => onChoose(a.id)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="hub-pills">
        <button type="button" className="hub-pill" aria-pressed={choice === 'nova'} onClick={() => onChoose('nova')}>
          {PASSO_A2.nova}
        </button>
      </div>
      <p className="hub-nota">{PASSO_A2.binarias}</p>
    </div>
  )
}

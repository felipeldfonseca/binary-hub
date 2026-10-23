'use client'

/**
 * d · «Prévia»: the counts, the notes, the lines left out, the commission, the rules and the zone of a file before it is
 * imported (moved here from passos.tsx in Phase 3b, which re-exports it). A reader's file reads as built; a mapped file
 * (Phase 3b, board IC l.362–395) adds the model chip, «{n} execuções no arquivo», counts in «saídas», its leftovers with
 * «Ver linhas» and the other-format warning (G1), in the board's order (D13): avisos → leftovers → commission → «depois»
 * lines → «Antes de…» → the zone line → G1. The lines come from lib/hub/importPrevia linhasDaPrevia.
 */
import type { RowErrorCode, RowIssue } from '@/lib/domain/import'
import type { ImportPreviewResult, RowError } from '@/lib/hub/contasDb'
import type { LinhaPulada, LinhasDaPrevia } from '@/lib/hub/importPrevia'
import { PASSO_D, n, rowErrorReason, zoneName } from '@/components/hub/contas/copy'
import { ANTES_DAS_REGRAS } from '@/components/hub/contas/copyRegras'
import { Disclosure, InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'

type HeadingRef = React.RefObject<HTMLHeadingElement>

/** The step's heading (as every step's: it takes focus whenever the step changes) */
function Heading({ headingRef, children }: { headingRef: HeadingRef; children: React.ReactNode }) {
  return (
    <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
      {children}
    </h3>
  )
}

/** «18 linhas · 18 novas · 0 já estavam · 0 com erro» */
export function Count({ items, small = false }: { items: readonly (readonly [number, string])[]; small?: boolean }) {
  return (
    <div className={small ? 'hub-contagem hub-contagem--menor' : 'hub-contagem'}>
      {items.map(([count, word], i) => (
        <span key={`${i}-${word}`}>
          <span className="hub-num">{n(count)}</span> {word}
          {i < items.length - 1 && (
            <span className="hub-sep" aria-hidden="true">
              {' ·'}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

/** «Linha n: motivo», from the browser's issues (which know the column) and the server's. */
export function ErrorLines({
  issues,
  serverErrors,
  open = false,
}: {
  issues: readonly RowIssue<RowErrorCode>[]
  serverErrors: readonly RowError[] | null
  open?: boolean
}) {
  const lines = (serverErrors ?? issues).map((e) => {
    const local = issues.find((i) => i.line === e.line && i.code === e.code)
    return { line: e.line, motivo: rowErrorReason(e.code, { column: local?.column, firstLine: local?.firstLine }) }
  })
  if (open) {
    return (
      <ul className="hub-lista-linhas">
        {lines.map((l) => (
          <li key={`${l.line}-${l.motivo}`}>{PASSO_D.line(l.line, l.motivo)}</li>
        ))}
      </ul>
    )
  }
  return <SkippedLines titulo={PASSO_D.skipped(lines.length)} lines={lines} />
}

/** The lines left out (amber) and «Ver linhas» (board IC l.378–383) */
export function SkippedLines({ titulo, lines }: { titulo: string; lines: readonly LinhaPulada[] }) {
  const [shown, toggle] = useToggle()
  return (
    <div className="hub-bloco hub-bloco--atencao">
      <div className="hub-linha" style={{ gap: '4px 12px' }}>
        <span style={{ flex: '1 1 220px', minWidth: 0 }}>{titulo}</span>
        <Disclosure open={shown} controls="linhas-puladas" onToggle={toggle}>
          {PASSO_D.seeLines}
        </Disclosure>
      </div>
      {shown && (
        // The board's list (IC l.383): a bullet per line
        <ul id="linhas-puladas" className="hub-lista-linhas hub-lista-linhas--pontos">
          {lines.map((l) => (
            <li key={`${l.line}-${l.motivo}`}>{PASSO_D.line(l.line, l.motivo)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PassoPrevia({
  headingRef,
  preview,
  linhas,
  label,
  zoneUsed,
  zoneChosen,
  needsFileTz,
  undone,
  antesDasRegras = null,
  chip = null,
}: {
  headingRef: HeadingRef
  preview: ImportPreviewResult
  /** lib/hub/importPrevia linhasDaPrevia */
  linhas: LinhasDaPrevia
  label: string
  zoneUsed: string
  /** Chosen in step c («lembrado para»), or the account's own («lembrado de») */
  zoneChosen: boolean
  /** Some row has no offset: the zone line shows */
  needsFileTz: boolean
  undone: boolean
  /** «Antes de {d} (início das regras): …» (lib/hub/regrasConta.linhaAntesDasRegras) */
  antesDasRegras?: string | null
  /** E34: «Colunas do modelo “{nome}”» + «Mudar colunas» (a model taken as is) */
  chip?: React.ReactNode
}) {
  const [commissionInfo, toggleCommission] = useToggle()
  const [beforeInfo, toggleBefore] = useToggle()
  const { comissao, slTpVazio } = linhas

  const zoneLine = needsFileTz
    ? zoneChosen || !preview.tz_confirmed
      ? PASSO_D.zoneFor(zoneName(zoneUsed), label)
      : PASSO_D.zoneFrom(zoneName(zoneUsed), label)
    : ''

  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_D.title}</Heading>
      {/* Announced by the sheet's status region */}
      {undone && <div className="hub-chip-dado">{PASSO_D.undone(label)}</div>}
      {chip}
      {linhas.execucoes !== null && (
        <p className="hub-nota">
          <span className="hub-num">{n(linhas.execucoes)}</span> {PASSO_D.execucoes(linhas.execucoes)}
        </p>
      )}
      <Count items={linhas.contagem} />
      {linhas.antes.map((l) =>
        l.paragrafo ? (
          <p key={l.texto} className="hub-passo__txt">
            {l.texto}
          </p>
        ) : (
          <div key={l.texto} className="hub-linha-i">
            <span>{l.texto}</span>
          </div>
        ),
      )}
      {linhas.sobras && <SkippedLines titulo={linhas.sobras.titulo} lines={linhas.sobras.linhas} />}
      {comissao && (
        <>
          <div className="hub-linha-i">
            <span>{PASSO_D.commission}</span>
            <InfoButton panelId="info-com" label={PASSO_D.commissionAria} open={commissionInfo} onToggle={toggleCommission} />
          </div>
          {commissionInfo && (
            <InfoPanel id="info-com">
              {PASSO_D.commissionInfo(comissao.bruto, comissao.custo)}
              {slTpVazio ? ` ${PASSO_D.slTpEmpty}` : ''}
            </InfoPanel>
          )}
        </>
      )}
      {!comissao && slTpVazio && (
        <div className="hub-linha-i">
          <span>{PASSO_D.slTpEmpty}</span>
        </div>
      )}
      {linhas.depois.map((text) => (
        <div key={text} className="hub-linha-i">
          <span>{text}</span>
        </div>
      ))}
      {antesDasRegras && (
        <>
          <div className="hub-linha-i">
            <span>{antesDasRegras}</span>
            <InfoButton panelId="info-antes" label={ANTES_DAS_REGRAS.infoAria} open={beforeInfo} onToggle={toggleBefore} />
          </div>
          {beforeInfo && <InfoPanel id="info-antes">{ANTES_DAS_REGRAS.info}</InfoPanel>}
        </>
      )}
      {zoneLine && <p className="hub-nota">{zoneLine}</p>}
      {/* G1 (board IC l.394): last in the step, a status so it is heard when the preview arrives */}
      {linhas.g1 && (
        <div className="hub-bloco hub-bloco--atencao" role="status" style={{ fontWeight: 700 }}>
          {linhas.g1}
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import type { FailedFile, Market, ParsedFile, RowIssue, RowErrorCode } from '@/lib/domain/import'
import { entrySpan, totals } from '@/lib/domain/import'
import {
  FILE_ZONES,
  LABEL_MAX,
  OTHER_FILE_ZONES,
  PHASES_FUTURES,
  PLATFORMS,
  REF_MAX,
  REFERENCE_TZ,
  displaySpan,
  zoneBars,
  type AccountPhase,
  type ZoneKey,
} from '@/lib/hub/contas'
import type { FixTzResult, ImportPreviewResult, RowError } from '@/lib/hub/contasDb'
import { formatMoney, formatOffset, formatShift } from '@/lib/hub/formato'
import {
  CHOOSE,
  ERRO,
  FIM_FUSO,
  MARKET_LABEL,
  OPTIONAL,
  PASSO_A,
  PASSO_B,
  PASSO_C,
  PASSO_CONF,
  PASSO_D,
  PASSO_F,
  PASSO_G,
  PASSO_I1,
  PASSO_I2,
  PHASE_LABEL,
  PLATFORM_LABEL,
  SOLTE,
  ZONE_LABEL,
  fixTzLine,
  fixTzUntouched,
  n,
  rowErrorReason,
  zoneName,
} from '@/components/hub/contas/copy'
import { ANTES_DAS_REGRAS } from '@/components/hub/contas/copyRegras'
import { Disclosure, InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { REGRAS_FORM_VAZIO, type RegrasForm } from '@/lib/hub/regrasConta'

type HeadingRef = React.RefObject<HTMLHeadingElement>

/** Every step starts with this heading; it takes focus whenever the step changes. */
function Heading({ headingRef, children }: { headingRef: HeadingRef; children: React.ReactNode }) {
  return (
    <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
      {children}
    </h3>
  )
}

const span = (s: { from: string; to: string } | null) => (s ? `${s.from}–${s.to}` : '')

// ------------------------------------------------------------------------------------------------
// solte: choose or drop the file
// ------------------------------------------------------------------------------------------------

export function PassoSolte({
  headingRef,
  title,
  reading,
  onFile,
}: {
  headingRef: HeadingRef
  title: string
  reading: boolean
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | undefined) => {
    if (file && !reading) onFile(file)
  }

  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{title}</Heading>
      <div
        className={over ? 'hub-solte hub-solte--sobre' : 'hub-solte'}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer?.files?.[0])
        }}
      >
        <Upload size={28} strokeWidth={2} aria-hidden="true" />
        <span style={{ fontWeight: 700 }}>{SOLTE.drop}</span>
        <span className="hub-nota">{SOLTE.kinds}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="arquivo"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // The same file can be chosen again after an error
            event.target.value = ''
            take(file)
          }}
        />
        <button
          type="button"
          className="hub-btn"
          aria-disabled={reading || undefined}
          onClick={() => {
            if (!reading) inputRef.current?.click()
          }}
        >
          {SOLTE.choose}
        </button>
      </div>
      {/* Announced by the sheet's status region */}
      {reading && <p className="hub-nota">{SOLTE.reading}</p>}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// erro: the file could not be read, or it has no importable row
// ------------------------------------------------------------------------------------------------

export function PassoErro({ headingRef, failed, parsed }: { headingRef: HeadingRef; failed: FailedFile | null; parsed: ParsedFile | null }) {
  if (parsed || failed?.error === 'empty_file') {
    return (
      <div className="hub-passo">
        <Heading headingRef={headingRef}>{ERRO.empty}</Heading>
        {parsed && parsed.errors.length > 0 && <ErrorLines issues={parsed.errors} serverErrors={null} open />}
      </div>
    )
  }
  let detail = ''
  switch (failed?.error) {
    case 'unknown_format':
      detail = ERRO.unknownFormat
      break
    case 'missing_columns':
      detail = ERRO.missingColumns(failed.missingColumns ?? [])
      break
    case 'duplicate_columns':
      detail = ERRO.duplicateColumns
      break
    case 'malformed_csv':
      detail = ERRO.malformed(failed.line)
      break
    case 'too_large':
      detail = ERRO.tooLarge
      break
    case 'too_many_rows':
      detail = ERRO.tooManyRows
      break
  }
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{ERRO.unreadable}</Heading>
      {detail && <p>{detail}</p>}
    </div>
  )
}

/** «Linha n: motivo», from the browser's issues (which know the column) and the server's. */
function ErrorLines({
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
    return { line: e.line, reason: rowErrorReason(e.code, { column: local?.column, firstLine: local?.firstLine }) }
  })
  if (open) {
    return (
      <ul className="hub-lista-linhas">
        {lines.map((l) => (
          <li key={`${l.line}-${l.reason}`}>{PASSO_D.line(l.line, l.reason)}</li>
        ))}
      </ul>
    )
  }
  return <SkippedLines lines={lines} />
}

function SkippedLines({ lines }: { lines: { line: number; reason: string }[] }) {
  const [shown, toggle] = useToggle()
  return (
    <div className="hub-bloco hub-bloco--atencao">
      <div className="hub-linha" style={{ gap: '4px 12px' }}>
        <span style={{ flex: '1 1 220px', minWidth: 0 }}>{PASSO_D.skipped(lines.length)}</span>
        <Disclosure open={shown} controls="linhas-puladas" onToggle={toggle}>
          {PASSO_D.seeLines}
        </Disclosure>
      </div>
      {shown && (
        <ul id="linhas-puladas" className="hub-lista-linhas">
          {lines.map((l) => (
            <li key={`${l.line}-${l.reason}`}>{PASSO_D.line(l.line, l.reason)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// a: which account
// ------------------------------------------------------------------------------------------------

export function PassoConta({
  headingRef,
  market,
  options,
  choice,
  reason,
  onChoose,
}: {
  headingRef: HeadingRef
  market: Market
  options: { id: string; label: string }[]
  choice: string | null
  reason: string
  onChoose: (id: string) => void
}) {
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_A.title}</Heading>
      <div role="group" aria-labelledby="t-passo" className="hub-pills">
        {options.map((o) => (
          <button key={o.id} type="button" className="hub-pill" aria-pressed={choice === o.id} onClick={() => onChoose(o.id)}>
            {o.label}
          </button>
        ))}
        <button type="button" className="hub-pill" aria-pressed={choice === 'nova'} onClick={() => onChoose('nova')}>
          {PASSO_A.newAccount(market)}
        </button>
      </div>
      {reason && <p className="hub-nota">{reason}</p>}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// b: new account
// ------------------------------------------------------------------------------------------------

export interface AccountForm {
  market: Market | null
  platform: string | null
  firm: string
  search: string
  label: string
  phase: AccountPhase | null
  size: string
  ref: string
  /** The rules block (Phase 2): what the owner changed; a new market starts it again */
  rules: RegrasForm
}

export const EMPTY_FORM: AccountForm = {
  market: null,
  platform: null,
  firm: '',
  search: '',
  label: '',
  phase: null,
  size: '',
  ref: '',
  rules: REGRAS_FORM_VAZIO,
}

export function PassoNovaConta({
  headingRef,
  market,
  form,
  onChange,
  roLabel,
  roValue,
  labelTaken,
  sizeInvalid,
  locked = false,
  regras = null,
}: {
  headingRef: HeadingRef
  market: Market
  form: AccountForm
  onChange: (patch: Partial<AccountForm>) => void
  roLabel: string
  roValue: string
  labelTaken: boolean
  sizeInvalid: boolean
  /** The account already exists: what was typed can no longer change it */
  locked?: boolean
  /** The rules block (RegrasDaConta), after «Tamanho US$ / Número na plataforma» (board) */
  regras?: React.ReactNode
}) {
  const futures = market === 'futures'
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_B.title(market)}</Heading>
      <div className="hub-campo">
        <label htmlFor="f-apelido" className="hub-rot-campo">
          {PASSO_B.label}
        </label>
        <input
          id="f-apelido"
          className="hub-entrada"
          type="text"
          autoComplete="off"
          maxLength={LABEL_MAX}
          value={form.label}
          disabled={locked}
          aria-invalid={labelTaken || undefined}
          aria-describedby={labelTaken ? 'f-apelido-erro' : undefined}
          onChange={(event) => onChange({ label: event.target.value })}
        />
        {labelTaken && (
          <p id="f-apelido-erro" className="hub-erro" role="alert">
            {PASSO_B.labelTaken}
          </p>
        )}
      </div>
      {futures && (
        <div className="hub-campo">
          <span id="l-fase" className="hub-rot-campo">
            {PASSO_B.phase}
          </span>
          <div role="group" aria-labelledby="l-fase" className="hub-pills">
            {PHASES_FUTURES.map((phase) => (
              <button
                key={phase}
                type="button"
                className="hub-pill"
                aria-pressed={form.phase === phase}
                disabled={locked}
                onClick={() => onChange({ phase })}
              >
                {PHASE_LABEL[phase]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="hub-campo">
        <span className="hub-rot-campo">{roLabel}</span>
        <span className="hub-ro">{roValue}</span>
      </div>
      {!futures && (
        <div className="hub-campo">
          <span className="hub-rot-campo">{PASSO_B.type}</span>
          <span className="hub-ro">{PASSO_B.personal}</span>
        </div>
      )}
      <div className="hub-campos2">
        {futures && (
          <div className="hub-campo">
            <label htmlFor="f-tam" className="hub-rot-campo">
              {PASSO_B.size} <span className="hub-opc">{OPTIONAL}</span>
            </label>
            <input
              id="f-tam"
              className="hub-entrada hub-entrada--mono"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={form.size}
              disabled={locked}
              aria-invalid={sizeInvalid || undefined}
              aria-describedby={sizeInvalid ? 'f-tam-erro' : undefined}
              onChange={(event) => onChange({ size: event.target.value })}
            />
            {sizeInvalid && (
              <p id="f-tam-erro" className="hub-erro" role="alert">
                {PASSO_B.badSize}
              </p>
            )}
          </div>
        )}
        <div className="hub-campo">
          <label htmlFor="f-num" className="hub-rot-campo">
            {PASSO_B.ref} <span className="hub-opc">{OPTIONAL}</span>
          </label>
          <input
            id="f-num"
            className="hub-entrada hub-entrada--mono"
            type="text"
            autoComplete="off"
            maxLength={REF_MAX}
            value={form.ref}
            disabled={locked}
            onChange={(event) => onChange({ ref: event.target.value })}
          />
        </div>
      </div>
      {regras}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// i1, i2: market and platform of an account added without a file
// ------------------------------------------------------------------------------------------------

export function PassoMercado({
  headingRef,
  market,
  onChoose,
}: {
  headingRef: HeadingRef
  market: Market | null
  onChoose: (market: Market) => void
}) {
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_I1.title}</Heading>
      <div role="group" aria-labelledby="t-passo" aria-describedby="nota-mercado" className="hub-pills">
        {(['futures', 'binary'] as const).map((m) => (
          <button key={m} type="button" className="hub-pill" aria-pressed={market === m} onClick={() => onChoose(m)}>
            {MARKET_LABEL[m]}
          </button>
        ))}
      </div>
      <p id="nota-mercado" className="hub-nota">
        {PASSO_I1.note}
      </p>
    </div>
  )
}

export function PassoPlataforma({
  headingRef,
  form,
  onChange,
}: {
  headingRef: HeadingRef
  form: AccountForm
  onChange: (patch: Partial<AccountForm>) => void
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const market = form.market ?? 'futures'
  const futures = market === 'futures'
  const list = PLATFORMS[market]
  const text = form.search.trim()
  const query = text.toLocaleLowerCase('pt-BR')
  const matches = (key: string) => PLATFORM_LABEL[key].toLocaleLowerCase('pt-BR').includes(query)
  const chips = list.filter((key, i) => !query || matches(key) || key === form.platform || i === list.length - 1)
  const noMatch = !!query && !list.some(matches)

  const focusSearch = () => setTimeout(() => searchRef.current?.focus(), 0)

  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_I2.title}</Heading>
      <input
        ref={searchRef}
        type="search"
        className="hub-entrada"
        autoComplete="off"
        aria-label={PASSO_I2.search}
        placeholder={PASSO_I2.search}
        value={form.search}
        onChange={(event) => onChange({ search: event.target.value })}
      />
      {futures && form.firm && (
        <div className="hub-linha" style={{ gap: 8 }}>
          <span className="hub-chip-dado">{PASSO_I2.firmChip(form.firm)}</span>
          <button
            type="button"
            className="hub-btn"
            aria-label={PASSO_I2.removeFirmAria(form.firm)}
            onClick={() => {
              onChange({ firm: '' })
              focusSearch()
            }}
          >
            {PASSO_I2.removeFirm}
          </button>
          <span className="hub-nota">{PASSO_I2.nowPlatform}</span>
        </div>
      )}
      <div role="group" aria-labelledby="t-passo" className="hub-pills">
        {chips.map((key) => (
          <button key={key} type="button" className="hub-pill" aria-pressed={form.platform === key} onClick={() => onChange({ platform: key })}>
            {PLATFORM_LABEL[key]}
          </button>
        ))}
      </div>
      {noMatch && <p className="hub-nota">{futures ? PASSO_I2.noMatchFutures : PASSO_I2.noMatchBinary}</p>}
      {noMatch && futures && (
        <button
          type="button"
          className="hub-pill"
          style={{ alignSelf: 'flex-start', lineHeight: 1.4, paddingTop: 8, paddingBottom: 8 }}
          onClick={() => {
            onChange({ firm: text, search: '' })
            focusSearch()
          }}
        >
          {PASSO_I2.firmFromSearch(text)}
        </button>
      )}
      {form.platform === 'iq' && <p className="hub-nota">{PASSO_I2.iqNote}</p>}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// c: the file's time zone
// ------------------------------------------------------------------------------------------------

export interface ZoneChoice {
  key: ZoneKey | 'outro' | null
  other: ZoneKey | null
}

export function chosenTz(zone: ZoneChoice): string | null {
  const key = zone.key === 'outro' ? zone.other : zone.key
  return key ? [...FILE_ZONES, ...OTHER_FILE_ZONES].find((z) => z.key === key)?.tz ?? null : null
}

export function PassoFuso({
  headingRef,
  parsed,
  zone,
  onChange,
}: {
  headingRef: HeadingRef
  parsed: ParsedFile
  zone: ZoneChoice
  onChange: (zone: ZoneChoice) => void
}) {
  const [info, toggleInfo] = useToggle()
  const futures = parsed.market === 'futures'
  const refTz = REFERENCE_TZ[parsed.market]
  const inFile = useMemo(() => entrySpan(parsed.rows), [parsed.rows])
  const strips = useMemo(() => {
    const out: Partial<Record<ZoneKey, { cap: string; bars: number[] }>> = {}
    for (const z of [...FILE_ZONES, ...OTHER_FILE_ZONES]) {
      const s = span(displaySpan(parsed.rows, z.tz, refTz))
      out[z.key] = { cap: futures ? PASSO_C.capFutures(s) : PASSO_C.capBinary(s), bars: zoneBars(parsed.rows, z.tz, refTz) }
    }
    return out
  }, [parsed.rows, refTz, futures])

  const options: { key: ZoneKey | 'outro'; name: string }[] = [
    ...FILE_ZONES.map((z) => ({ key: z.key, name: ZONE_LABEL[z.key] })),
    { key: 'outro', name: PASSO_C.other },
  ]

  return (
    <div className="hub-passo">
      <div className="hub-passo__cab">
        <Heading headingRef={headingRef}>{PASSO_C.title}</Heading>
        <InfoButton panelId="info-fuso" label={PASSO_C.infoAria} open={info} onToggle={toggleInfo} />
      </div>
      {info && <InfoPanel id="info-fuso">{PASSO_C.info}</InfoPanel>}
      {inFile && <p className="hub-nota">{PASSO_C.inFile(span(inFile))}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="hub-eixo24" aria-hidden="true">
          <span style={{ left: '0%' }}>00</span>
          <span style={{ left: '25%' }}>06</span>
          <span style={{ left: '50%' }}>12</span>
          <span style={{ left: '75%' }}>18</span>
          <span style={{ left: '100%' }}>24</span>
        </div>
        <div role="radiogroup" aria-labelledby="t-passo" aria-describedby="leg-fuso" className="hub-opcoes-fuso">
          {options.map((o) => {
            const selected = zone.key === o.key
            const dataKey = o.key === 'outro' ? (selected ? zone.other : null) : o.key
            const data = dataKey ? strips[dataKey] : undefined
            const classes = ['hub-opcao', selected ? 'hub-opcao--marcada' : '', data ? '' : 'hub-opcao--sem-faixa'].filter(Boolean).join(' ')
            return (
              <div key={o.key} className={classes}>
                <label className="hub-opcao__rot">
                  <input
                    type="radio"
                    name="fuso"
                    checked={selected}
                    onChange={() => onChange({ key: o.key, other: o.key === 'outro' ? zone.other : null })}
                  />
                  <span>{o.name}</span>
                  <span className="hub-opcao__cap">{data ? data.cap : PASSO_C.capPending}</span>
                </label>
                {o.key === 'outro' && selected && (
                  <div className="hub-campo" style={{ paddingBottom: 8 }}>
                    <label htmlFor="f-outro" className="hub-rot-campo">
                      {PASSO_C.whichZone}
                    </label>
                    <select
                      id="f-outro"
                      className="hub-sel"
                      value={zone.other ?? ''}
                      onChange={(event) => {
                        const v = event.target.value
                        const other = OTHER_FILE_ZONES.find((z) => z.key === v)?.key ?? null
                        onChange({ key: 'outro', other })
                      }}
                    >
                      <option value="">{CHOOSE}</option>
                      {OTHER_FILE_ZONES.map((z) => (
                        <option key={z.key} value={z.key}>
                          {ZONE_LABEL[z.key]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {data && (
                  <div className="hub-faixa24" aria-hidden="true">
                    {futures && <span className="hub-faixa24__banda" />}
                    {data.bars.map((h, i) => (
                      <span key={i} className="hub-faixa24__barra" style={{ height: `${Math.round(h * 100)}%` }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div id="leg-fuso" className="hub-legenda">
          {futures && (
            <span>
              <span className="hub-sw" aria-hidden="true" />
              {PASSO_C.session}
            </span>
          )}
          <span>{futures ? PASSO_C.legendFutures : PASSO_C.legendBinary}</span>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// conf: what confirming the zone moves (dry run), before it is applied
// ------------------------------------------------------------------------------------------------

export function PassoConfirmarFuso({
  headingRef,
  tz,
  dry,
  label,
  beforeImport,
}: {
  headingRef: HeadingRef
  tz: string
  dry: FixTzResult
  label: string
  beforeImport: boolean
}) {
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_CONF.title(zoneName(tz))}</Heading>
      {beforeImport && <p className="hub-passo__txt">{PASSO_CONF.beforeImport(label)}</p>}
      <div className="hub-bloco hub-bloco--atencao">
        <span style={{ fontWeight: 700 }}>{fixTzLine(dry.changed, dry.shifts.map(formatShift), dry.day_changes)}</span>
        {dry.untouched_with_offset > 0 && <span className="hub-nota">{fixTzUntouched(dry.untouched_with_offset)}</span>}
      </div>
      <p className="hub-nota">{PASSO_CONF.remember}</p>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// d: preview
// ------------------------------------------------------------------------------------------------

function Count({ items, small = false }: { items: [number, string][]; small?: boolean }) {
  return (
    <div className={small ? 'hub-contagem hub-contagem--menor' : 'hub-contagem'}>
      {items.map(([count, word], i) => (
        <span key={word}>
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

export function PassoPrevia({
  headingRef,
  preview,
  parsed,
  label,
  zoneUsed,
  zoneChosen,
  undone,
  antesDasRegras = null,
}: {
  headingRef: HeadingRef
  preview: ImportPreviewResult
  parsed: ParsedFile
  label: string
  zoneUsed: string
  /** Chosen in step c («lembrado para»), or the account's own («lembrado de») */
  zoneChosen: boolean
  undone: boolean
  /** «Antes de {d} (início das regras): …» (lib/hub/regrasConta.linhaAntesDasRegras) */
  antesDasRegras?: string | null
}) {
  const [commissionInfo, toggleCommission] = useToggle()
  const [beforeInfo, toggleBefore] = useToggle()
  const errors = preview.errors.length
  const items: [number, string][] = [
    [preview.rows_total, PASSO_D.lines],
    [preview.new, PASSO_D.fresh],
  ]
  if (preview.other_account > 0) items.push([preview.other_account, PASSO_D.otherAccount])
  items.push([preview.duplicate, preview.duplicate > 0 ? PASSO_D.alreadyId : PASSO_D.already], [errors, PASSO_D.errors])

  const notices: string[] = []
  let commission: { gross: string; cost: string } | null = null
  let slTpEmpty = false
  for (const notice of parsed.notices) {
    if (notice.code === 'file_has_offset') notices.push(PASSO_D.offsets(notice.offsets.map(formatOffset).join(', ')))
    else if (notice.code === 'unsigned_losses_negated') notices.push(PASSO_D.unsignedLosses(notice.rows))
    else if (notice.code === 'refunds_as_breakeven') notices.push(PASSO_D.refunds(notice.rows))
    else if (notice.code === 'commission_in_file') commission = { gross: notice.gross, cost: notice.commission }
    else if (notice.code === 'sl_tp_empty') slTpEmpty = true
  }
  if (!commission) {
    // The notice carries the totals; a file where only some rows have commissions still shows them
    const t = totals(parsed.rows)
    if (t.commission !== null && parsed.platform === 'topone') commission = { gross: t.gross, cost: t.commission }
  }
  const costText = commission ? formatMoney(commission.cost === '0.00' ? '0' : `-${commission.cost}`, { signed: true }) : ''

  const zoneLine = parsed.needsFileTz
    ? zoneChosen || !preview.tz_confirmed
      ? PASSO_D.zoneFor(zoneName(zoneUsed), label)
      : PASSO_D.zoneFrom(zoneName(zoneUsed), label)
    : ''

  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_D.title}</Heading>
      {/* Announced by the sheet's status region */}
      {undone && <div className="hub-chip-dado">{PASSO_D.undone(label)}</div>}
      <Count items={items} />
      {preview.other_account > 0 && <p className="hub-passo__txt">{PASSO_D.otherNote(preview.other_account)}</p>}
      {preview.completable > 0 && <p className="hub-passo__txt">{PASSO_D.completable(preview.completable)}</p>}
      {notices.map((text) => (
        <div key={text} className="hub-linha-i">
          <span>{text}</span>
        </div>
      ))}
      {errors > 0 && <ErrorLines issues={parsed.errors} serverErrors={preview.errors} />}
      {commission && (
        <>
          <div className="hub-linha-i">
            <span>{PASSO_D.commission}</span>
            <InfoButton panelId="info-com" label={PASSO_D.commissionAria} open={commissionInfo} onToggle={toggleCommission} />
          </div>
          {commissionInfo && (
            <InfoPanel id="info-com">
              {PASSO_D.commissionInfo(formatMoney(commission.gross, { signed: true }), costText)}
              {slTpEmpty ? ` ${PASSO_D.slTpEmpty}` : ''}
            </InfoPanel>
          )}
        </>
      )}
      {!commission && slTpEmpty && (
        <div className="hub-linha-i">
          <span>{PASSO_D.slTpEmpty}</span>
        </div>
      )}
      {preview.day_changes > 0 && (
        <div className="hub-linha-i">
          <span>{PASSO_D.dayChanges(preview.day_changes, parsed.market)}</span>
        </div>
      )}
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
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// f: nothing new
// ------------------------------------------------------------------------------------------------

export function PassoNadaNovo({
  headingRef,
  preview,
  label,
  confirmedZone,
  onConfirmZone,
}: {
  headingRef: HeadingRef
  preview: ImportPreviewResult
  label: string
  /** The account's zone once confirmed; null while it is still a guess */
  confirmedZone: string | null
  onConfirmZone: () => void
}) {
  const items: [number, string][] = [
    [preview.rows_total, PASSO_D.lines],
    [0, PASSO_D.fresh],
    [preview.duplicate, PASSO_D.alreadyId],
  ]
  if (preview.errors.length > 0) items.push([preview.errors.length, PASSO_D.errors])
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{PASSO_F.title(preview.duplicate, label)}</Heading>
      <Count items={items} small />
      <div className="hub-bloco">
        {confirmedZone ? (
          <span style={{ fontWeight: 700 }}>{PASSO_F.zoneKnown(label, zoneName(confirmedZone))}</span>
        ) : (
          <>
            <span style={{ fontWeight: 700 }}>{PASSO_F.zonePending(label)}</span>
            <span className="hub-nota">{PASSO_F.hidden(label)}</span>
            <button type="button" className="hub-btn" style={{ alignSelf: 'flex-start' }} onClick={onConfirmZone}>
              {PASSO_F.confirm}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// g: the file is of the other market
// ------------------------------------------------------------------------------------------------

export function PassoMercadoErrado({
  headingRef,
  fileMarket,
  account,
  targets,
  busy,
  onImportInto,
  onCreate,
}: {
  headingRef: HeadingRef
  fileMarket: Market
  account: { label: string; market: Market }
  targets: { id: string; label: string }[]
  /** A request is running: the buttons wait for it */
  busy: boolean
  onImportInto: (id: string) => void
  onCreate: () => void
}) {
  const [info, toggleInfo] = useToggle()
  return (
    <div className="hub-passo">
      <div className="hub-passo__cab">
        <Heading headingRef={headingRef}>{PASSO_G.title(fileMarket)}</Heading>
        <InfoButton panelId="info-g" label={PASSO_G.infoAria} open={info} onToggle={toggleInfo} />
      </div>
      {info && <InfoPanel id="info-g">{PASSO_G.info(account.label)}</InfoPanel>}
      <p>{PASSO_G.accountIs(account.market)}</p>
      <div className="hub-como">
        {targets.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={i === 0 ? 'hub-btn hub-btn--pri' : 'hub-btn'}
            aria-disabled={busy || undefined}
            onClick={() => onImportInto(t.id)}
          >
            {PASSO_G.importInto(t.label)}
          </button>
        ))}
        <button
          type="button"
          className={targets.length === 0 ? 'hub-btn hub-btn--pri' : 'hub-btn'}
          aria-disabled={busy || undefined}
          onClick={onCreate}
        >
          {PASSO_G.create(fileMarket)}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// End screens
// ------------------------------------------------------------------------------------------------

export function PassoFim({ headingRef, title, lines }: { headingRef: HeadingRef; title: string; lines: string[] }) {
  return (
    <div className="hub-passo">
      <Heading headingRef={headingRef}>{title}</Heading>
      {lines.map((line) => (
        <p key={line} className="hub-passo__txt">
          {line}
        </p>
      ))}
    </div>
  )
}

export const fimFusoLines = (rows: number, label: string) => [FIM_FUSO.shown(rows, label), FIM_FUSO.remember]

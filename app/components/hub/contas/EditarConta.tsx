'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ALL_FILE_ZONES,
  FIRM_MAX,
  LABEL_MAX,
  PHASES_FUTURES,
  REF_MAX,
  labelTaken,
  parseSize,
  sizeToText,
  tzConfirmed,
  type AccountPhase,
  type TradingAccount,
} from '@/lib/hub/contas'
import { importFixTz, setPrimary, toHubError, updateAccount, type AccountPatch, type FixTzResult, type HubErrorCode } from '@/lib/hub/contasDb'
import { formatShift } from '@/lib/hub/formato'
import { useHubDb, useRefreshAfterWrite } from '@/hooks/useContas'
import { BUSY, CANCEL, CHOOSE, EDITAR, ERROR_TEXT, OPTIONAL, PASSO_B, PHASE_LABEL, fixTzLine, fixTzUntouched, zoneName } from './copy'

interface Props {
  account: TradingAccount
  /** Every account, archived ones included: nicknames are unique across all of them */
  accounts: readonly TradingAccount[]
  /** The active primary account, if any */
  primaryId: string | null
  onSaved: (message: string) => void
  onCancel: () => void
}

/**
 * "Editar conta" (no board; follows the inline forms of Suas contas). Changing or confirming
 * the file zone of an account with trades shows what moves first (import_fix_tz dry run) and
 * waits for an explicit "Confirmar fuso".
 */
export default function EditarConta({ account, accounts, primaryId, onSaved, onCancel }: Props) {
  const { db } = useHubDb()
  const refresh = useRefreshAfterWrite()
  const futures = account.market === 'futures'
  const confirmed = tzConfirmed(account)
  const id = account.id
  const [label, setLabel] = useState(account.label)
  const [phase, setPhase] = useState<AccountPhase | null>(account.phase)
  const [firm, setFirm] = useState(account.firm ?? '')
  const [ref, setRef] = useState(account.external_ref ?? '')
  const [size, setSize] = useState(sizeToText(account.size))
  const [primary, setPrimaryChecked] = useState(account.is_primary)
  // An unconfirmed zone starts empty: picking one (even the current guess) confirms it
  const [zone, setZone] = useState(confirmed ? account.file_tz : '')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<HubErrorCode | null>(null)
  const [dry, setDry] = useState<{ tz: string; result: FixTzResult; saved: boolean } | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const sizeRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  useEffect(() => {
    if (dry) confirmRef.current?.focus()
  }, [dry])

  const trimmed = label.trim()
  const taken = labelTaken(trimmed, accounts, id)
  const sizeValue = futures ? parseSize(size) : null
  const labelError = taken ? PASSO_B.labelTaken : tried && !trimmed ? EDITAR.needLabel : ''
  const sizeError = tried && sizeValue === 'invalid' ? PASSO_B.badSize : ''
  const zoneOptions = ALL_FILE_ZONES.some((z) => z.tz === account.file_tz) || !confirmed
    ? ALL_FILE_ZONES.map((z) => z.tz)
    : [...ALL_FILE_ZONES.map((z) => z.tz), account.file_tz]
  const zoneChanged = zone !== '' && (zone !== account.file_tz || !confirmed)

  const finish = (zoneDone: string | null) => {
    refresh()
    onSaved(zoneDone ? `${EDITAR.saved(trimmed)} ${EDITAR.zoneConfirmed(zoneName(zoneDone))}` : EDITAR.saved(trimmed))
  }

  const save = async () => {
    setTried(true)
    if (!trimmed || taken) {
      labelRef.current?.focus()
      return
    }
    if (sizeValue === 'invalid') {
      sizeRef.current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const patch: AccountPatch = {}
      if (trimmed !== account.label) patch.label = trimmed.slice(0, LABEL_MAX)
      const nextPhase = futures ? phase : account.phase ?? 'pessoal'
      if (nextPhase !== account.phase) patch.phase = nextPhase
      if (futures && (firm.trim() || null) !== account.firm) patch.firm = firm.trim() || null
      if ((ref.trim() || null) !== account.external_ref) patch.external_ref = ref.trim() || null
      if (futures && sizeValue !== 'invalid' && sizeValue !== (account.size === null ? null : String(account.size))) patch.size = sizeValue
      if (!primary && account.is_primary) patch.is_primary = false
      if (Object.keys(patch).length > 0) await updateAccount(db, id, patch)
      if (primary && !account.is_primary) await setPrimary(db, id, primaryId)

      if (!zoneChanged) {
        finish(null)
        return
      }
      const result = await importFixTz(db, id, zone, true)
      if (result.rows === 0) {
        // No trade on the file's wall clock: nothing moves, the zone is just saved
        await importFixTz(db, id, zone, false)
        finish(zone)
        return
      }
      refresh()
      setDry({ tz: zone, result, saved: Object.keys(patch).length > 0 || primary !== account.is_primary })
    } catch (e) {
      setError(toHubError(e).code)
    } finally {
      setBusy(false)
    }
  }

  const applyZone = async () => {
    if (!dry) return
    setBusy(true)
    setError(null)
    try {
      await importFixTz(db, id, dry.tz, false)
      finish(dry.tz)
    } catch (e) {
      setError(toHubError(e).code)
    } finally {
      setBusy(false)
    }
  }

  const fieldId = (name: string) => `e-${name}-${id}`

  return (
    <form
      className="hub-form-inline hub-cheia"
      aria-labelledby={fieldId('titulo')}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && !dry) void save()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <div id={fieldId('titulo')} className="hub-rotulo">
        {EDITAR.title(account.label)}
      </div>

      <div className="hub-campo">
        <label htmlFor={fieldId('apelido')} className="hub-rot-campo">
          {EDITAR.label}
        </label>
        <input
          ref={labelRef}
          id={fieldId('apelido')}
          className="hub-entrada"
          type="text"
          autoComplete="off"
          maxLength={Math.max(LABEL_MAX, account.label.length)}
          value={label}
          disabled={!!dry}
          aria-invalid={labelError ? true : undefined}
          aria-describedby={labelError ? fieldId('apelido-erro') : undefined}
          onChange={(event) => setLabel(event.target.value)}
        />
        {labelError && (
          <p id={fieldId('apelido-erro')} className="hub-erro" role="alert">
            {labelError}
          </p>
        )}
      </div>

      {futures ? (
        <div className="hub-campo">
          <span id={fieldId('fase')} className="hub-rot-campo">
            {EDITAR.phase}
          </span>
          <div role="group" aria-labelledby={fieldId('fase')} className="hub-pills">
            {PHASES_FUTURES.map((p) => (
              <button
                key={p}
                type="button"
                className="hub-pill"
                aria-pressed={phase === p}
                disabled={!!dry}
                onClick={() => setPhase(phase === p ? null : p)}
              >
                {PHASE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="hub-campo">
          <span className="hub-rot-campo">{EDITAR.type}</span>
          <span className="hub-ro">{EDITAR.personal}</span>
        </div>
      )}

      {futures && (
        <div className="hub-campo">
          <label htmlFor={fieldId('mesa')} className="hub-rot-campo">
            {EDITAR.firm} <span className="hub-opc">{OPTIONAL}</span>
          </label>
          <input
            id={fieldId('mesa')}
            className="hub-entrada"
            type="text"
            autoComplete="off"
            maxLength={FIRM_MAX}
            value={firm}
            disabled={!!dry}
            onChange={(event) => setFirm(event.target.value)}
          />
        </div>
      )}

      <div className="hub-campos2" style={{ maxWidth: 480 }}>
        {futures && (
          <div className="hub-campo">
            <label htmlFor={fieldId('tam')} className="hub-rot-campo">
              {EDITAR.size} <span className="hub-opc">{OPTIONAL}</span>
            </label>
            <input
              ref={sizeRef}
              id={fieldId('tam')}
              className="hub-entrada hub-entrada--mono"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={size}
              disabled={!!dry}
              aria-invalid={sizeError ? true : undefined}
              aria-describedby={sizeError ? fieldId('tam-erro') : undefined}
              onChange={(event) => setSize(event.target.value)}
            />
            {sizeError && (
              <p id={fieldId('tam-erro')} className="hub-erro" role="alert">
                {sizeError}
              </p>
            )}
          </div>
        )}
        <div className="hub-campo">
          <label htmlFor={fieldId('num')} className="hub-rot-campo">
            {EDITAR.ref} <span className="hub-opc">{OPTIONAL}</span>
          </label>
          <input
            id={fieldId('num')}
            className="hub-entrada hub-entrada--mono"
            type="text"
            autoComplete="off"
            maxLength={REF_MAX}
            value={ref}
            disabled={!!dry}
            onChange={(event) => setRef(event.target.value)}
          />
        </div>
      </div>

      <div className="hub-campo">
        <label className="hub-check">
          <input type="checkbox" checked={primary} disabled={!!dry} onChange={(event) => setPrimaryChecked(event.target.checked)} />
          {EDITAR.primary}
        </label>
        <p className="hub-nota" style={{ marginTop: -8 }}>
          {EDITAR.primaryNote}
        </p>
      </div>

      <div className="hub-campo">
        <label htmlFor={fieldId('fuso')} className="hub-rot-campo">
          {EDITAR.zone}
        </label>
        <select
          id={fieldId('fuso')}
          className="hub-sel"
          style={{ alignSelf: 'flex-start' }}
          value={zone}
          disabled={!!dry}
          aria-describedby={confirmed ? undefined : fieldId('fuso-nota')}
          onChange={(event) => setZone(event.target.value)}
        >
          {!confirmed && <option value="">{CHOOSE}</option>}
          {zoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {zoneName(tz)}
            </option>
          ))}
        </select>
        {!confirmed && (
          <p id={fieldId('fuso-nota')} className="hub-nota">
            {EDITAR.zoneUnconfirmed}
          </p>
        )}
      </div>

      {dry && (
        <div className="hub-bloco hub-bloco--atencao" role="group" aria-labelledby={fieldId('fuso-efeito')}>
          <span id={fieldId('fuso-efeito')} style={{ fontWeight: 700 }}>
            {fixTzLine(dry.result.changed, dry.result.shifts.map(formatShift), dry.result.day_changes)}
          </span>
          {dry.result.untouched_with_offset > 0 && <span className="hub-nota">{fixTzUntouched(dry.result.untouched_with_offset)}</span>}
          <div className="hub-acoes">
            <button
              ref={confirmRef}
              type="button"
              className="hub-btn hub-btn--pri"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) void applyZone()
              }}
            >
              {EDITAR.confirmZone}
            </button>
            <button
              type="button"
              className="hub-btn"
              onClick={() => {
                if (busy) return
                // The other fields are already saved; leave the zone as it was
                if (dry.saved) finish(null)
                else {
                  setDry(null)
                  setZone(confirmed ? account.file_tz : '')
                }
              }}
            >
              {CANCEL}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="hub-alerta">
          {ERROR_TEXT[error]}
        </p>
      )}
      {busy && (
        <p role="status" className="hub-nota">
          {BUSY}
        </p>
      )}

      {!dry && (
        <div className="hub-acoes">
          <button type="submit" className="hub-btn hub-btn--pri" aria-disabled={busy || undefined}>
            {EDITAR.save}
          </button>
          <button type="button" className="hub-btn" onClick={onCancel}>
            {CANCEL}
          </button>
        </div>
      )}
    </form>
  )
}

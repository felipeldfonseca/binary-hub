'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTE_TEXT_MAX, cleanText, firstEntryAt, notePayload, type Day, type DayNote } from '@/lib/domain/diario'
import { antesSalvoStatus, notaAntesDeOperar, type ContaDiario } from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { newClientKey } from '@/lib/hub/registrarDb'
import { diarioKeys, useSaveDayNote } from '@/hooks/useDiario'
import { useHubDb } from '@/hooks/useContas'
import { ANTES } from './copyDia'

/**
 * «Antes de operar» (contract F6–F11; board `nota-box`): today's note before the first entry. Today without a note:
 * the field, «Salvar» and «Guardado com a hora do servidor.»; saved: the text, «anotado às 09:40, antes da 1ª entrada
 * · editado às 10:42, depois da 1ª entrada» and «Editar»; a past day: the text and its line, or «Nada anotado antes de
 * operar.». One client_key per editing session; an empty or blank save sends nothing (a saved note is not emptied,
 * as drawn); «Salvar» and «Cancelar» (or Escape) give the focus back to «Editar».
 */
export default function AntesDeOperar({ d, hoje, accountId, conta }: { d: DayRead; hoje: Day | null; accountId: string; conta: ContaDiario }) {
  const save = useSaveDayNote()
  const queryClient = useQueryClient()
  const { userId } = useHubDb()
  const ehHoje = !!hoje && d.day === hoje
  // The save's answer until the day is read again (so «Editar» is there to take the focus at once)
  const [local, setLocal] = useState<DayNote | null>(null)
  const atual = local && (!d.note || local.savedAt.getTime() >= d.note.savedAt.getTime()) ? local : d.note
  const salva = atual && atual.text ? atual : null
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const chave = useRef<string | null>(null)
  const editarRef = useRef<HTMLButtonElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const [focoEditar, setFocoEditar] = useState(0)
  const campo = ehHoje && (!salva || editando)

  useEffect(() => {
    if (focoEditar) editarRef.current?.focus()
  }, [focoEditar])

  const editar = () => {
    setEditando(true)
    setTexto(salva?.text ?? '')
    setErro(null)
    chave.current = null
    // the field appears in this render's commit
    setTimeout(() => campoRef.current?.focus(), 0)
  }
  const cancelar = () => {
    setEditando(false)
    setErro(null)
    setFocoEditar((n) => n + 1)
  }
  const salvar = async () => {
    const valor = texto
    if (!cleanText(valor) || save.isPending) return
    if (!chave.current) chave.current = newClientKey()
    setErro(null)
    try {
      const r = await save.mutateAsync({ accountId, day: d.day, payload: notePayload(valor, chave.current) })
      chave.current = null
      if (r.note) setLocal(r.note)
      setEditando(false)
      setTexto('')
      setStatus(antesSalvoStatus(r.note?.savedAt ?? r.serverNow, conta.tz))
      setFocoEditar((n) => n + 1)
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      setErro(code === 'network' ? ANTES.offline : ANTES.erro)
      if (code !== 'network') void queryClient.invalidateQueries({ queryKey: [...diarioKeys.dia(userId, accountId, d.day)] })
    }
  }

  const primeira = firstEntryAt(d.trades.map((t) => ({ entryTime: t.trade.entryTime, history: t.history })))

  return (
    <div className="hub-dr-plano-nota">
      {salva && !campo && (
        <div className="hub-dr-plano-antes">
          <div className="hub-dr-plano-antes-txt">
            <div className="hub-dr-plano-rot">{ANTES.rotulo}</div>
            <div className="hub-dr-plano-texto">{salva.text}</div>
            <div className="hub-dr-plano-quando">{notaAntesDeOperar(salva, primeira, conta.tz)}</div>
          </div>
          {ehHoje && (
            <button ref={editarRef} type="button" className="hub-btn hub-dr-plano-btn" aria-label={ANTES.editarAria} onClick={editar}>
              {ANTES.editar}
            </button>
          )}
        </div>
      )}
      {campo && (
        <>
          <label htmlFor="antes-campo" className="hub-dr-plano-rot">
            {ANTES.rotulo}
          </label>
          <div className="hub-dr-plano-campo">
            <input
              ref={campoRef}
              id="antes-campo"
              type="text"
              className="hub-dr-plano-input"
              maxLength={NOTE_TEXT_MAX}
              placeholder={ANTES.placeholder}
              aria-describedby="antes-dica"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && editando) {
                  event.preventDefault()
                  cancelar()
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  void salvar()
                }
              }}
            />
            <button type="button" className="hub-btn" aria-disabled={save.isPending || undefined} onClick={() => void salvar()}>
              {ANTES.salvar}
            </button>
            {editando && (
              <button type="button" className="hub-btn" onClick={cancelar}>
                {ANTES.cancelar}
              </button>
            )}
          </div>
          <span id="antes-dica" className="hub-dr-plano-quando">
            {ANTES.dica}
          </span>
          {erro && (
            <p role="alert" className="hub-dr-plano-erro">
              {erro}
            </p>
          )}
        </>
      )}
      {!salva && !campo && (
        <>
          <div className="hub-dr-plano-rot">{ANTES.rotulo}</div>
          <div className="hub-dr-plano-texto hub-tom--muted">{ANTES.nada}</div>
        </>
      )}
      <div role="status" className="sr-only">
        {status}
      </div>
    </div>
  )
}

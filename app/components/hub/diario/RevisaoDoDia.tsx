'use client'

import { useEffect, useRef, useState } from 'react'
import { REVIEW_FIELDS_MAX, dayChanged, previousVersions, reviewPayload, type DayReview, type Followed, type ReviewForm, type ReviewVersion } from '@/lib/domain/diario'
import {
  camposDaRevisao,
  diaMudouTexto,
  fatosTexto,
  linhaDaRevisao,
  revisaoSalvaStatus,
  seguiuTexto,
  tituloDaVersao,
  versoesBotao,
  type ContaDiario,
} from '@/lib/hub/diario'
import type { DayRead } from '@/lib/hub/diarioDb'
import { newClientKey } from '@/lib/hub/registrarDb'
import { useSaveDayReview } from '@/hooks/useDiario'
import { REVISAO } from './copyDia'

const SEGUIU: Followed[] = ['sim', 'em_parte', 'nao']
const VAZIO: ReviewForm = { worked: '', differently: '', followed: null, carryForward: '' }

/** The four fields of a version as the saved view writes them */
function Campos({ v }: { v: ReviewVersion }) {
  const c = camposDaRevisao(v)
  return (
    <dl className="hub-dr-rev-campos">
      <div className="hub-dr-rev-campo">
        <dt>{REVISAO.funcionou}</dt>
        <dd>{c.funcionou}</dd>
      </div>
      <div className="hub-dr-rev-campo">
        <dt>{REVISAO.diferente}</dt>
        <dd>{c.diferente}</dd>
      </div>
      <div className="hub-dr-rev-campo">
        <dt>{REVISAO.seguiu}</dt>
        <dd>{c.seguiu}</dd>
      </div>
      <div className="hub-dr-rev-campo">
        <dt>{REVISAO.levar}</dt>
        <dd>{c.levar}</dd>
      </div>
    </dl>
  )
}

/** «O diário registrou: …» */
function Registrou({ texto }: { texto: string }) {
  return (
    <p className="hub-dr-rev-registrou">
      <strong>{REVISAO.registrou}</strong> {texto}
    </p>
  )
}

/**
 * «Revisão do dia» (contract I1–I8; board `.rev`): closed («2 minutos · tudo opcional», «Escrever revisão»), the form
 * («O diário registrou: …» live, the two texts, «Seguiu o plano?», «Levar para o próximo pregão»), the saved review
 * collapsed («Ver revisão») or open (its frozen facts, «Depois da revisão, o dia mudou: …», its fields, «Versões
 * anteriores (1)»). One client_key per form, kept across retries; offline the save fails at once and the text stays.
 */
export default function RevisaoDoDia({ d, accountId, conta }: { d: DayRead; accountId: string; conta: ContaDiario }) {
  const save = useSaveDayReview()
  // The save's answer until the day is read again (its versions come with that read)
  const [local, setLocal] = useState<DayReview | null>(null)
  const r = local && (!d.review || local.savedAt.getTime() > d.review.savedAt.getTime()) ? local : d.review
  const salva = !!r && r.written
  const [form, setForm] = useState<ReviewForm | null>(null)
  const [ver, setVer] = useState(false)
  const [versoesAbertas, setVersoesAbertas] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const chave = useRef<string | null>(null)
  const funcRef = useRef<HTMLTextAreaElement>(null)
  const escreverRef = useRef<HTMLButtonElement>(null)
  const editarRef = useRef<HTMLButtonElement>(null)
  const [foco, setFoco] = useState<{ alvo: 'func' | 'abrir'; n: number } | null>(null)

  useEffect(() => {
    if (!foco) return
    if (foco.alvo === 'func') funcRef.current?.focus()
    else (editarRef.current ?? escreverRef.current)?.focus()
  }, [foco])
  const focar = (alvo: 'func' | 'abrir') => setFoco((f) => ({ alvo, n: (f?.n ?? 0) + 1 }))

  const abrir = () => {
    setForm(salva && r ? { worked: r.worked ?? '', differently: r.differently ?? '', followed: r.followed, carryForward: r.carryForward ?? '' } : { ...VAZIO })
    setErro(null)
    chave.current = null
    focar('func')
  }
  const cancelar = () => {
    setForm(null)
    setErro(null)
    focar('abrir')
  }
  const salvar = async () => {
    if (!form || save.isPending) return
    if (!chave.current) chave.current = newClientKey()
    setErro(null)
    try {
      const res = await save.mutateAsync({ accountId, day: d.day, payload: reviewPayload(form, chave.current) })
      chave.current = null
      if (res.review) setLocal(res.review)
      setForm(null)
      setVer(true)
      setStatus(revisaoSalvaStatus(res.review?.savedAt ?? res.serverNow, conta.tz))
      focar('abrir')
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      setErro(code === 'network' ? REVISAO.offline : REVISAO.erro)
    }
  }
  const mudar = (p: Partial<ReviewForm>) => setForm((f) => (f ? { ...f, ...p } : f))

  const versoes = r && salva ? previousVersions(r) : []

  return (
    <div className="hub-dr-rev-bloco">
      <div className="hub-dr-cab">
        <div className="hub-dr-rev-tit">
          <h3 id="t-rev" className="hub-dr-dia-h3">
            {REVISAO.titulo}
          </h3>
          {!salva && !form && <p className="hub-dr-sub">{REVISAO.sub}</p>}
          {/* board `revSalva = temRevisao && !!rvUlt0 && !formOn`: while the form is open, only the title */}
          {salva && r && !form && <p className="hub-dr-sub">{linhaDaRevisao(r, d.day, conta.tz)}</p>}
        </div>
        {!salva && !form && (
          <button ref={escreverRef} type="button" className="hub-btn" aria-expanded="false" aria-controls="rev-form" onClick={abrir}>
            {REVISAO.escrever}
          </button>
        )}
        {salva && !form && (
          <div className="hub-dr-rev-acoes">
            <button type="button" className="hub-btn" aria-expanded={ver} aria-controls="rev-texto" onClick={() => setVer((v) => !v)}>
              {ver ? REVISAO.esconder : REVISAO.ver}
            </button>
            <button ref={editarRef} type="button" className="hub-btn" onClick={abrir}>
              {REVISAO.editar}
            </button>
          </div>
        )}
      </div>
      <div role="status" className="sr-only">
        {status}
      </div>
      {salva && r && ver && !form && (
        <div id="rev-texto" className="hub-dr-rev-texto">
          <Registrou texto={fatosTexto(r.autoSummary, conta)} />
          {dayChanged(r.autoSummary, d.facts) && <p className="hub-dr-rev-mudou">{diaMudouTexto(d.facts, conta)}</p>}
          <Campos v={r} />
          {versoes.length > 0 && (
            <div className="hub-dr-rev-versoes-bloco">
              <div>
                <button type="button" className="hub-btn" aria-expanded={versoesAbertas} aria-controls="rev-versoes" onClick={() => setVersoesAbertas((v) => !v)}>
                  {versoesBotao(versoes.length, versoesAbertas)}
                </button>
              </div>
              {versoesAbertas && (
                <ul id="rev-versoes" className="hub-dr-rev-versoes">
                  {versoes.map((v) => (
                    <li key={v.id}>
                      <strong className="hub-dr-rev-versao-tit">{tituloDaVersao(v, d.day, conta.tz)}</strong>
                      <Registrou texto={fatosTexto(v.autoSummary, conta)} />
                      <Campos v={v} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {form && (
        <div id="rev-form" className="hub-dr-rev-form">
          <Registrou texto={fatosTexto(d.facts, conta)} />
          <div className="hub-dr-rev-textos">
            <div className="hub-dr-rev-campo-form">
              <label htmlFor="rev-func" className="hub-dr-rev-rot">
                {REVISAO.funcionou}
              </label>
              <textarea
                ref={funcRef}
                id="rev-func"
                rows={2}
                className="hub-dr-rev-area"
                maxLength={REVIEW_FIELDS_MAX.worked}
                placeholder={REVISAO.funcionouPh}
                value={form.worked}
                onChange={(event) => mudar({ worked: event.target.value })}
              />
            </div>
            <div className="hub-dr-rev-campo-form">
              <label htmlFor="rev-dif" className="hub-dr-rev-rot">
                {REVISAO.diferente}
              </label>
              <textarea
                id="rev-dif"
                rows={2}
                className="hub-dr-rev-area"
                maxLength={REVIEW_FIELDS_MAX.differently}
                placeholder={REVISAO.diferentePh}
                value={form.differently}
                onChange={(event) => mudar({ differently: event.target.value })}
              />
            </div>
          </div>
          <div className="hub-dr-rev-campo-form">
            <span id="rev-seguiu" className="hub-dr-rev-rot">
              {REVISAO.seguiu}
            </span>
            <div role="group" aria-labelledby="rev-seguiu" aria-describedby="rev-seguiu-d" className="hub-dr-rev-seguiu">
              {SEGUIU.map((f) => (
                <button key={f} type="button" className="hub-pill" aria-pressed={form.followed === f} onClick={() => mudar({ followed: form.followed === f ? null : f })}>
                  {seguiuTexto(f)}
                </button>
              ))}
            </div>
            <span id="rev-seguiu-d" className="hub-dr-rev-dica">
              {REVISAO.seguiuDescricao}
            </span>
          </div>
          <div className="hub-dr-rev-campo-form">
            <label htmlFor="rev-levar" className="hub-dr-rev-rot">
              {REVISAO.levar}
            </label>
            <input
              id="rev-levar"
              type="text"
              className="hub-dr-rev-input"
              maxLength={REVIEW_FIELDS_MAX.carry_forward}
              placeholder={REVISAO.levarPh}
              value={form.carryForward}
              onChange={(event) => mudar({ carryForward: event.target.value })}
            />
          </div>
          {erro && (
            <p role="alert" className="hub-dr-rev-erro">
              {erro}
            </p>
          )}
          <div className="hub-dr-rev-acoes">
            <button type="button" className="hub-btn hub-btn--pri" aria-disabled={save.isPending || undefined} onClick={() => void salvar()}>
              {REVISAO.salvar}
            </button>
            <button type="button" className="hub-btn" onClick={cancelar}>
              {REVISAO.cancelar}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { formatHhMm, parseHhMm } from '@/lib/domain/tempo'
import type { LimitMode, WindowTz } from '@/lib/domain/gate'
import { windowError, type WindowSetting } from '@/lib/hub/regras'
import { WINDOW_CLOCKS, captionJanela, viraODia } from '@/lib/hub/janelas'
import {
  NAO_COPIAR,
  comCopiar,
  linhaResumo,
  notaCopiar,
  perguntaJanela,
  type RegrasDaNovaConta,
  type RegrasForm,
} from '@/lib/hub/regrasConta'
import { LOADING } from '@/components/hub/contas/copy'
import { REGRAS_CONTA } from '@/components/hub/contas/copyRegras'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { DIAS_CURTOS, DIAS_LONGOS, ERRO_JANELA, JANELAS, REGRAS, RELOGIO } from '@/components/hub/personalizar/copy'
import { Pilulas, useFocoPendente } from '@/components/hub/personalizar/ui'

export interface RegrasDaContaProps {
  /** rules_config: still loading, failed (the account is created without v1), or here */
  carga: 'carregando' | 'erro' | 'pronto'
  /** What the form resolves to (lib/hub/regrasConta.regrasDaNovaConta); null until the rules load */
  regras: RegrasDaNovaConta | null
  form: RegrasForm
  onForm: (form: RegrasForm) => void
  /** The nickname typed so far (the own window's field labels) */
  label: string
  /** The device clock (captions) */
  now: Date
  /** «Regras valem desde hoje, {d}»: the day, already written ('17 out') */
  desde: string | null
  /** The account exists already (what followed its creation failed): nothing here can change it */
  locked?: boolean
  /**
   * The element that explains a limit error (the sheet's blocked hint). Without it (the hint asks
   * for the nickname or the phase first), the error shows under the field itself.
   */
  limiteErroId?: string
  /** «Ao criar, esta janela passa a ser a de …»: the market's other accounts that get a version too */
  outras?: string | null
}

/**
 * The rules of a new account in the import sheet's step b (ImportarConta board): «Copiar regras
 * de», the summary line with «Mudar», the editor (the market's window or an own one, the daily
 * limit and its mode) and «Regras valem desde hoje». Presentational: the sheet holds the form
 * and the rules (personalizar.md §11.1, contrato §6.1).
 */
export default function RegrasDaConta({ carga, regras: r, form, onForm, label, now, desde, locked = false, limiteErroId, outras = null }: RegrasDaContaProps) {
  const [infoDesde, toggleInfoDesde] = useToggle()
  const pedirFoco = useFocoPendente()

  if (carga !== 'pronto' || !r) {
    return (
      <div className="hub-rc">
        {/* Not a live region: the sheet has one, and this changes as soon as the rules arrive */}
        <p id="regras-carga" className="hub-nota">
          {carga === 'erro' ? REGRAS_CONTA.carregarErro : LOADING}
        </p>
      </div>
    )
  }

  const pergunta = perguntaJanela(r)
  const mudar = (patch: Partial<RegrasForm>) => onForm({ ...form, ...patch })
  const mudarJanela = (patch: Partial<WindowSetting>) => {
    if (r.janela) mudar({ propria: { ...r.janela, ...patch } })
  }
  // An own window when the market has one; else the window the form gives the market
  const daConta = !!pergunta
  const nota = notaCopiar(r)
  // The limit's error is said by the sheet's hint, or here when the hint says something else first
  const limiteErroAqui = !!r.limiteErro && !limiteErroId

  return (
    <div className="hub-rc">
      {r.opcoes.length > 0 ? (
        <div className="hub-campo">
          <label htmlFor="f-copiar" className="hub-rot-campo">
            {REGRAS_CONTA.copiar}
          </label>
          <select
            id="f-copiar"
            className="hub-sel"
            aria-describedby="nota-copiar"
            value={r.copiar ?? NAO_COPIAR}
            disabled={locked}
            onChange={(event) => onForm(comCopiar(form, event.target.value))}
          >
            {r.opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
            <option value={NAO_COPIAR}>{REGRAS_CONTA.naoCopiar}</option>
          </select>
          <span id="nota-copiar" className="hub-nota">
            {nota}
          </span>
        </div>
      ) : (
        <p id="nota-copiar" className="hub-nota">
          {nota}
        </p>
      )}

      <div className="hub-rc-linha">
        <span>{linhaResumo(r, form)}</span>
        {!locked && (
          <button type="button" className="hub-btn" aria-expanded={form.aberto} aria-controls="ed-regras" onClick={() => mudar({ aberto: !form.aberto })}>
            {REGRAS_CONTA.mudar}
          </button>
        )}
      </div>

      {form.aberto && !locked && (
        <div id="ed-regras" className="hub-rc-editor">
          {pergunta && (
            <div className="hub-rc-grupo">
              <div id="l-usar" className="hub-rc-pergunta">
                {pergunta}
              </div>
              <div role="group" aria-labelledby="l-usar" className="hub-pills">
                <button type="button" className="hub-pill" aria-pressed={r.usarPadrao} onClick={() => mudar({ janela: 'padrao' })}>
                  {REGRAS_CONTA.sim}
                </button>
                <button type="button" className="hub-pill" aria-pressed={!r.usarPadrao} onClick={() => mudar({ janela: 'propria' })}>
                  {REGRAS_CONTA.outra}
                </button>
              </div>
            </div>
          )}
          {!pergunta && !r.janela && (
            <div>
              <button
                id="rc-definir"
                type="button"
                className="hub-btn"
                onClick={() => {
                  pedirFoco('j-de')
                  mudar({ definir: true })
                }}
              >
                {REGRAS_CONTA.definirJanela}
              </button>
            </div>
          )}
          {r.janela && (
            <CamposJanela
              w={r.janela}
              now={now}
              relogioFixo={daConta}
              rotuloInicio={daConta ? REGRAS_CONTA.inicioAria(label.trim(), r.janela.tz) : REGRAS_CONTA.inicioMercadoAria(r.market, r.janela.tz)}
              rotuloFim={daConta ? REGRAS_CONTA.fimAria(label.trim(), r.janela.tz) : REGRAS_CONTA.fimMercadoAria(r.market, r.janela.tz)}
              onChange={mudarJanela}
            />
          )}
          {!pergunta && r.janela && (
            <div>
              <button
                type="button"
                className="hub-btn"
                aria-label={REGRAS_CONTA.cancelarJanelaAria(r.market)}
                onClick={() => {
                  pedirFoco('rc-definir')
                  mudar({ definir: false })
                }}
              >
                {REGRAS_CONTA.cancelarJanela}
              </button>
            </div>
          )}

          <div className="hub-campo hub-rc-limite">
            <label htmlFor="f-lim" className="hub-rot-campo">
              {REGRAS_CONTA.limite}
            </label>
            <input
              id="f-lim"
              className="hub-entrada hub-entrada--mono hub-rc-lim"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={r.limiteTexto}
              aria-invalid={!!r.limiteErro || undefined}
              aria-describedby={r.limiteErro ? (limiteErroAqui ? 'f-lim-erro' : limiteErroId) : undefined}
              onChange={(event) => mudar({ limite: event.target.value })}
            />
            {limiteErroAqui && r.limiteErro && (
              <p id="f-lim-erro" className="hub-erro">
                {REGRAS.limiteErro(r.limiteErro, 'USD' /* lane A: currency */)}
              </p>
            )}
          </div>
          {r.temModo && (
            <Pilulas<LimitMode>
              opcoes={REGRAS.modos}
              valor={r.modo}
              rotulo={REGRAS_CONTA.modoAria}
              onEscolher={(modo) => mudar({ modo })}
            />
          )}
        </div>
      )}

      {outras && !locked && (
        <p id="rc-outras" className="hub-nota">
          {outras}
        </p>
      )}

      {desde && (
        <>
          <div className="hub-rc-desde">
            <span className="hub-chip-dado">{REGRAS_CONTA.desde(desde)}</span>
            <InfoButton panelId="info-desde" label={REGRAS_CONTA.desdeAria} open={infoDesde} onToggle={toggleInfoDesde} />
          </div>
          {infoDesde && <InfoPanel id="info-desde">{REGRAS_CONTA.desdeInfo}</InfoPanel>}
        </>
      )}
    </div>
  )
}

/** `das [HH:MM] às [HH:MM] ET` (or the clock select), the caption on the other clock, the days and the error */
function CamposJanela({
  w,
  now,
  relogioFixo,
  rotuloInicio,
  rotuloFim,
  onChange,
}: {
  w: WindowSetting
  now: Date
  /** An account's window is on its market's clock: the clock is text, not a choice */
  relogioFixo: boolean
  rotuloInicio: string
  rotuloFim: string
  onChange: (patch: Partial<WindowSetting>) => void
}) {
  const erro = windowError(w)
  const desc = erro ? 'j-cap j-erro' : 'j-cap'
  // An unparsable value is ignored: the field keeps the last valid one (as in Personalizar)
  const ler = (key: 'startMin' | 'endMin') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseHhMm(event.target.value)
    if (v !== null) onChange({ [key]: v })
  }
  return (
    <div className="hub-rc-grupo">
      <div className="hub-rc-horas">
        <span className="hub-rc-hgrupo">
          <span aria-hidden="true">{REGRAS_CONTA.das}</span>
          <input
            id="j-de"
            className="hub-rc-hora"
            type="time"
            step={900}
            aria-label={rotuloInicio}
            aria-describedby={desc}
            aria-invalid={!!erro}
            value={formatHhMm(w.startMin)}
            onChange={ler('startMin')}
          />
        </span>
        <span className="hub-rc-hgrupo">
          <span aria-hidden="true">{REGRAS_CONTA.as}</span>
          <input
            id="j-ate"
            className="hub-rc-hora"
            type="time"
            step={900}
            aria-label={rotuloFim}
            aria-describedby={desc}
            aria-invalid={!!erro}
            value={formatHhMm(w.endMin)}
            onChange={ler('endMin')}
          />
          {relogioFixo && <span className="hub-rc-forte">{RELOGIO[w.tz].curto}</span>}
        </span>
        {!relogioFixo && (
          <>
            <label htmlFor="j-rel" className="sr-only">
              {REGRAS_CONTA.relogio}
            </label>
            <select
              id="j-rel"
              className="hub-sel"
              value={w.tz}
              onChange={(event) => {
                const tz = WINDOW_CLOCKS.find((c) => c === event.target.value)
                if (tz) onChange({ tz: tz as WindowTz })
              }}
            >
              {WINDOW_CLOCKS.map((c) => (
                <option key={c} value={c}>
                  {RELOGIO[c].pill}
                </option>
              ))}
            </select>
          </>
        )}
        {viraODia(w) && <span className="hub-nota">{JANELAS.doDiaSeguinte}</span>}
      </div>
      <p id="j-cap" className="hub-nota">
        {captionJanela(w, now)}
      </p>
      <div role="group" aria-label={REGRAS_CONTA.diasAria} aria-describedby={erro === 'no_days' ? 'j-erro' : undefined} className="hub-pills">
        {DIAS_CURTOS.map((d, i) => (
          <button
            key={d}
            type="button"
            className="hub-pill hub-rc-dia"
            aria-pressed={(w.weekdays & (1 << i)) !== 0}
            aria-label={DIAS_LONGOS[i]}
            onClick={() => onChange({ weekdays: w.weekdays ^ (1 << i) })}
          >
            {d}
          </button>
        ))}
      </div>
      {erro && (
        <p id="j-erro" className="hub-erro" role="alert">
          {ERRO_JANELA[erro]}
        </p>
      )}
    </div>
  )
}

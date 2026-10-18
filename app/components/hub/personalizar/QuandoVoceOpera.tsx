'use client'

import { formatHhMm, parseHhMm } from '@/lib/domain/tempo'
import { CREATABLE_MARKETS, type AccountMarket, type WindowTz } from '@/lib/domain/gate'
import { windowError, type AccountConfig, type RulesSettings, type WindowSetting } from '@/lib/hub/regras'
import {
  WINDOW_CLOCKS,
  captionJanela,
  proximaMudancaNY,
  relogioDoMercado,
  trocarRelogio,
  viraODia,
} from '@/lib/hub/janelas'
import {
  MARKETS,
  ajustarSoNestaConta,
  alternarDia,
  cancelarJanela,
  comJanelaDaConta,
  comJanelaDoMercado,
  definirJanela,
  janelasDoMercadoMudaram,
  removerSegunda,
  segundaJanela,
  voltarAoPadrao,
} from '@/lib/hub/rascunho'
import { ADD_ACCOUNT } from '@/components/hub/contas/copy'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { DIAS_CURTOS, DIAS_LONGOS, ERRO_JANELA, JANELAS, MERCADO_NOME, RELOGIO, SO_NESTA_CONTA } from './copy'
import { EstadoCarga, Pilulas, TagNaoSalvo, useFocoPendente, type Carga } from './ui'

/** Short market keys for element ids (board: j-fut0-de, mais-bin, j-fx0-de, mais-cri) */
const MK: Record<AccountMarket, string> = { futures: 'fut', binary: 'bin', forex: 'fx', stocks: 'eua', crypto: 'cri', b3: 'b3', options: 'opc' }

type Editar = (fn: (draft: RulesSettings) => RulesSettings) => void

export interface QuandoVoceOperaProps {
  carga: Carga
  onTentar: () => void
  now: Date
  /** The saved settings (the base) and the draft */
  salvo: RulesSettings | null
  draft: RulesSettings | null
  ativas: readonly AccountConfig[]
  onEditar: Editar
  /** «+ Adicionar conta»: opens the import sheet in add mode */
  onAdicionarConta: (opener: HTMLElement, fallback: HTMLElement | null) => void
}

/**
 * «Quando você opera» (board #janelas): one card per market with an active account, in
 * ACCOUNT_MARKETS order (Futuros, binárias, Forex, Ações, Cripto, B3; a legacy options account
 * last). Under the cards, «+ Adicionar conta» while one of the six creatable markets has no active
 * account (board `faltaMk`): a legacy options card never hides it.
 */
export default function QuandoVoceOpera({ carga, onTentar, now, salvo, draft, ativas, onEditar, onAdicionarConta }: QuandoVoceOperaProps) {
  const [info, toggleInfo] = useToggle()
  const pedirFoco = useFocoPendente()
  const mercados = MARKETS.filter((m) => ativas.some((a) => a.market === m))
  const falta =
    mercados.length === 0 ? JANELAS.semContas : CREATABLE_MARKETS.some((m) => !mercados.includes(m)) ? JANELAS.outrosMercados : null

  return (
    <section id="janelas" aria-labelledby="t-janelas" className="hub-card">
      <div className="hub-cab">
        <div className="hub-titulo-i">
          <h2 id="t-janelas" tabIndex={-1}>
            {JANELAS.titulo}
          </h2>
          <InfoButton panelId="info-janelas" label={JANELAS.infoAria} open={info} onToggle={toggleInfo} />
        </div>
      </div>
      <p className="hub-nota hub-card__sub">{JANELAS.sub}</p>
      {info && <InfoPanel id="info-janelas">{JANELAS.info(proximaMudancaNY(now) ?? '—')}</InfoPanel>}

      {carga !== 'pronto' || !salvo || !draft ? (
        <EstadoCarga carga={carga === 'erro' ? 'erro' : 'carregando'} onTentar={onTentar} anunciar />
      ) : (
        <>
          {mercados.length > 0 && (
            <div className="hub-pz-grade">
              {mercados.map((m) => (
                <CartaoMercado
                  key={m}
                  market={m}
                  contas={ativas.filter((a) => a.market === m)}
                  salvo={salvo}
                  draft={draft}
                  now={now}
                  metade={mercados.length > 1}
                  onEditar={onEditar}
                  pedirFoco={pedirFoco}
                />
              ))}
            </div>
          )}
          {falta && (
            <div className="hub-pz-falta">
              <span className="hub-nota">{falta}</span>
              <button
                type="button"
                className="hub-pz-link-btn"
                onClick={(event) => onAdicionarConta(event.currentTarget, document.getElementById('t-janelas'))}
              >
                {ADD_ACCOUNT}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CartaoMercado({
  market,
  contas,
  salvo,
  draft,
  now,
  metade,
  onEditar,
  pedirFoco,
}: {
  market: AccountMarket
  contas: readonly AccountConfig[]
  salvo: RulesSettings
  draft: RulesSettings
  now: Date
  metade: boolean
  onEditar: Editar
  pedirFoco: (id: string) => void
}) {
  const [mais, toggleMais] = useToggle()
  const mk = MK[market]
  const nome = MERCADO_NOME[market]
  const ms = draft.markets[market]
  const temJanela = ms.windows.length > 0
  const tz = relogioDoMercado(draft, market)
  const ids = contas.map((c) => c.id)
  const mudou = janelasDoMercadoMudaram(salvo, draft, market, ids)
  const regraLigada = (id: string) => draft.accounts[id]?.windowRule.on ?? ms.windowRule.on
  const semJanelaTxt = contas.some((c) => regraLigada(c.id))
    ? contas.length === 1
      ? JANELAS.semJanelaUma(contas[0].label)
      : JANELAS.semJanelaVarias
    : JANELAS.semJanela
  const temLinhas = temJanela && (contas.length >= 2 || contas.some((c) => !!draft.accounts[c.id]?.window))
  const podeCancelar = temJanela && salvo.markets[market].windows.length === 0

  return (
    <div className={metade ? 'hub-pz-mcard hub-pz-mcard--metade' : 'hub-pz-mcard'} role="group" aria-label={JANELAS.grupoAria(market)}>
      <div className="hub-cab">
        <h3>{nome}</h3>
        <span className="hub-titulo-i">
          {mudou && <TagNaoSalvo />}
          <span className="hub-chip-dado">{temJanela ? RELOGIO[tz].relogio : JANELAS.semJanelaChip}</span>
        </span>
      </div>

      {!temJanela ? (
        <div className="hub-pz-jan-vazia">
          <span className="hub-pz-aviso">{semJanelaTxt}</span>
          <button
            id={`definir-${mk}`}
            type="button"
            className="hub-btn"
            onClick={() => {
              pedirFoco(`j-${mk}0-de`)
              onEditar((d) => definirJanela(d, market))
            }}
          >
            {JANELAS.definir}
          </button>
        </div>
      ) : (
        <>
          {ms.windows.map((w, k) => (
            <LinhaJanela
              key={k}
              id={`j-${mk}${k}`}
              prefixo={k === 0 ? JANELAS.das : JANELAS.eDas}
              w={w}
              now={now}
              rotuloInicio={JANELAS.inicioAria(market, k === 1, RELOGIO[w.tz].nome)}
              rotuloFim={JANELAS.fimAria(market, k === 1, RELOGIO[w.tz].nome)}
              onInicio={(v) => onEditar((d) => comJanelaDoMercado(d, market, k, { startMin: v }))}
              onFim={(v) => onEditar((d) => comJanelaDoMercado(d, market, k, { endMin: v }))}
            />
          ))}
          <div>
            <button
              type="button"
              className="hub-abre"
              aria-expanded={mais}
              aria-controls={`mais-${mk}`}
              aria-label={JANELAS.maisAria(market)}
              onClick={toggleMais}
            >
              <span className="hub-seta" aria-hidden="true">
                ▸
              </span>
              {JANELAS.mais}
            </button>
            {mais && (
              <div id={`mais-${mk}`} className="hub-pz-mais">
                <div className="hub-pz-campo-grupo">
                  <span id={`rel-${mk}`} className="hub-rotulo">
                    {JANELAS.relogioRotulo}
                  </span>
                  <Pilulas<WindowTz>
                    opcoes={WINDOW_CLOCKS.map((c) => ({ valor: c, texto: RELOGIO[c].pill }))}
                    valor={tz}
                    rotuloId={`rel-${mk}`}
                    onEscolher={(c) => onEditar((d) => trocarRelogio(d, market, c, now, ids))}
                  />
                </div>
                {ms.windows.map((w, k) => {
                  const erro = windowError(w)
                  return (
                    <div key={k} className="hub-pz-campo-grupo">
                      <PilulasDias
                        id={`dias-${mk}${k}`}
                        rotulo={k === 1 ? JANELAS.diasSegunda : ms.windows.length > 1 ? JANELAS.diasPrimeira : JANELAS.dias}
                        weekdays={w.weekdays}
                        erroId={erro === 'no_days' ? `j-${mk}${k}-erro` : undefined}
                        onAlternar={(i) => onEditar((d) => alternarDia(d, market, k, i))}
                      />
                      {k === 1 && (
                        <div>
                          <button
                            type="button"
                            className="hub-btn"
                            aria-label={JANELAS.removerAria(market)}
                            onClick={() => {
                              pedirFoco(`add-${mk}`)
                              onEditar((d) => removerSegunda(d, market))
                            }}
                          >
                            {JANELAS.remover}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {ms.windows.length < 2 ? (
                  <div>
                    <button
                      id={`add-${mk}`}
                      type="button"
                      className="hub-btn"
                      aria-label={JANELAS.segundaAria(market)}
                      onClick={() => {
                        pedirFoco(`j-${mk}1-de`)
                        onEditar((d) => segundaJanela(d, market))
                      }}
                    >
                      {JANELAS.segunda}
                    </button>
                  </div>
                ) : (
                  <p className="hub-nota">{JANELAS.maximo}</p>
                )}
              </div>
            )}
          </div>
          {podeCancelar && (
            <div>
              <button
                type="button"
                className="hub-btn"
                aria-label={JANELAS.cancelarAria(market)}
                onClick={() => {
                  pedirFoco(`definir-${mk}`)
                  onEditar((d) => cancelarJanela(d, market, ids))
                }}
              >
                {JANELAS.cancelar}
              </button>
            </div>
          )}
        </>
      )}

      {temJanela && !temLinhas && contas.length === 1 && <p className="hub-nota">{JANELAS.usadaPor(contas[0].label)}</p>}
      {temLinhas && (
        <ul className="hub-pz-lista" aria-label={JANELAS.contasAria(market)}>
          {contas.map((c) => {
            const own = draft.accounts[c.id]?.window ?? null
            return (
              <li key={c.id} className="hub-pz-ovr">
                {own ? (
                  <>
                    <div className="hub-pz-ovr__cab">
                      <span className="hub-pz-ovr__nome">
                        <strong>{c.label}</strong>
                        <span className="hub-tag hub-tag--propria">{SO_NESTA_CONTA}</span>
                      </span>
                      <button
                        type="button"
                        className="hub-btn"
                        aria-label={JANELAS.voltarAria(c.label)}
                        onClick={() => {
                          // With one account the list goes once its own window does («Usada por …»):
                          // focus moves to the market's first start field instead
                          pedirFoco(contas.length === 1 ? `j-${mk}0-de` : `ajustar-${c.id}`)
                          onEditar((d) => voltarAoPadrao(d, c.id))
                        }}
                      >
                        {JANELAS.voltar}
                      </button>
                    </div>
                    <LinhaJanela
                      id={`o-${c.id}`}
                      prefixo={JANELAS.das}
                      w={own}
                      now={now}
                      rotuloInicio={JANELAS.inicioContaAria(c.label, RELOGIO[own.tz].nome)}
                      rotuloFim={JANELAS.fimContaAria(c.label, RELOGIO[own.tz].nome)}
                      onInicio={(v) => onEditar((d) => comJanelaDaConta(d, c.id, { startMin: v }))}
                      onFim={(v) => onEditar((d) => comJanelaDaConta(d, c.id, { endMin: v }))}
                    />
                  </>
                ) : (
                  <div className="hub-pz-ovr__cab">
                    <span className="hub-pz-ovr__nome">
                      <strong>{c.label}</strong>
                      <span className="hub-nota">{JANELAS.usaEsta}</span>
                    </span>
                    <button
                      id={`ajustar-${c.id}`}
                      type="button"
                      className="hub-btn"
                      aria-label={JANELAS.ajustarAria(c.label)}
                      onClick={() => {
                        pedirFoco(`o-${c.id}-de`)
                        onEditar((d) => ajustarSoNestaConta(d, c))
                      }}
                    >
                      {JANELAS.ajustar}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** `das [HH:MM] às [HH:MM] ET`, its caption on the other clock and its error (board .jan) */
export function LinhaJanela({
  id,
  prefixo,
  w,
  now,
  rotuloInicio,
  rotuloFim,
  onInicio,
  onFim,
}: {
  /** Prefix of the element ids: `{id}-de`, `{id}-ate`, `{id}-cap`, `{id}-erro` */
  id: string
  prefixo: string
  w: WindowSetting
  now: Date
  rotuloInicio: string
  rotuloFim: string
  onInicio: (minute: number) => void
  onFim: (minute: number) => void
}) {
  const erro = windowError(w)
  const cap = `${id}-cap`
  const err = `${id}-erro`
  const desc = erro ? `${cap} ${err}` : cap
  // An unparsable value is ignored: the field keeps the last valid one (board `lerHora`)
  const ler = (fn: (m: number) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseHhMm(event.target.value)
    if (v !== null) fn(v)
  }
  return (
    <div className="hub-pz-jan">
      <div className="hub-pz-jan__linha">
        <span className="hub-pz-hgrupo">
          <span aria-hidden="true">{prefixo}</span>
          <input
            id={`${id}-de`}
            className="hub-pz-hora"
            type="time"
            step={900}
            aria-label={rotuloInicio}
            aria-describedby={desc}
            aria-invalid={!!erro}
            value={formatHhMm(w.startMin)}
            onChange={ler(onInicio)}
          />
        </span>
        <span className="hub-pz-hgrupo">
          <span aria-hidden="true">{JANELAS.as}</span>
          <input
            id={`${id}-ate`}
            className="hub-pz-hora"
            type="time"
            step={900}
            aria-label={rotuloFim}
            aria-describedby={desc}
            aria-invalid={!!erro}
            value={formatHhMm(w.endMin)}
            onChange={ler(onFim)}
          />
          <span className="hub-pz-forte">{RELOGIO[w.tz].curto}</span>
        </span>
        {viraODia(w) && <span className="hub-nota">{JANELAS.doDiaSeguinte}</span>}
      </div>
      <p id={cap} className="hub-nota">
        {captionJanela(w, now)}
      </p>
      {erro && (
        <p id={err} className="hub-erro" role="alert">
          {ERRO_JANELA[erro]}
        </p>
      )}
    </div>
  )
}

/** The seven day pills of a window (seg…dom, aria-label segunda…domingo) */
export function PilulasDias({
  id,
  rotulo,
  weekdays,
  erroId,
  onAlternar,
}: {
  id: string
  rotulo: string
  weekdays: number
  /** The «Marque pelo menos um dia.» error, when shown */
  erroId?: string
  onAlternar: (day: number) => void
}) {
  return (
    <>
      <span id={id} className="hub-rotulo">
        {rotulo}
      </span>
      <div role="group" aria-labelledby={id} aria-describedby={erroId} className="hub-pills">
        {DIAS_CURTOS.map((d, i) => (
          <button
            key={d}
            type="button"
            className="hub-pill hub-pz-pill-dia"
            aria-pressed={(weekdays & (1 << i)) !== 0}
            aria-label={DIAS_LONGOS[i]}
            onClick={() => onAlternar(i)}
          >
            {d}
          </button>
        ))}
      </div>
    </>
  )
}


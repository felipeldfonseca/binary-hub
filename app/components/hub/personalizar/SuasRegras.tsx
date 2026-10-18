'use client'

import { useMemo } from 'react'
import { resolveRules, type AccountConfig, type PendingVersion, type RulesConfig, type RulesSettings } from '@/lib/hub/regras'
import { comCalendario, janelasEfetivas, mudancasDaEntidade, PADRAO_FUTUROS, PADRAO_FUTUROS_CONTA, type Entidade } from '@/lib/hub/rascunho'
import { comoFicaHoje } from '@/lib/hub/comoFicaHoje'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import BlocoVersao from './BlocoVersao'
import Calendarios from './Calendarios'
import ComoFicaHoje from './ComoFicaHoje'
import { MERCADO_NOME, REGRAS } from './copy'
import type { FormLimite } from './PersonalizarProvider'
import { RegraBloqueio, RegraEstado, RegraJanela, RegraLimite, RegraSoDentro } from './RegrasLinhas'
import { EstadoCarga, useFocoPendente, type Carga } from './ui'

type Editar = (fn: (draft: RulesSettings) => RulesSettings) => void

export interface SuasRegrasProps {
  carga: Carga
  onTentar: () => void
  now: Date
  /** The rules_config the draft was made against */
  config: RulesConfig | null
  draft: RulesSettings | null
  ativas: readonly AccountConfig[]
  /** Phase label of each account (Suas contas' list); null = none */
  fases: Record<string, string | null>
  pendentes: readonly PendingVersion[]
  tradesDesde: Record<string, number> | undefined
  /** PADRAO_FUTUROS or an active account id */
  selecionado: string | null
  onSelecionar: (id: string) => void
  formLimite: FormLimite | null
  onFormLimite: (f: FormLimite | null) => void
  onEditar: Editar
  onComecarHoje: (accountId: string) => void
  onIrJanelas: () => void
}

/** «Suas regras» (board #regras): the rules of «Padrão Futuros» or one account, today under them, the versions, the calendars */
export default function SuasRegras(props: SuasRegrasProps) {
  const { carga, onTentar, config, draft, ativas } = props
  const [info, toggleInfo] = useToggle()

  return (
    <section id="regras" aria-labelledby="t-regras" className="hub-card">
      <div className="hub-cab">
        <div className="hub-titulo-i">
          <h2 id="t-regras" tabIndex={-1}>
            {REGRAS.titulo}
          </h2>
          <InfoButton panelId="info-regras" label={REGRAS.infoAria} open={info} onToggle={toggleInfo} />
        </div>
      </div>
      <p className="hub-nota hub-card__sub">{REGRAS.sub}</p>
      {info && <InfoPanel id="info-regras">{REGRAS.info}</InfoPanel>}

      {carga !== 'pronto' || !config || !draft ? (
        <EstadoCarga carga={carga === 'erro' ? 'erro' : 'carregando'} onTentar={onTentar} />
      ) : (
        <>
          {ativas.length === 0 || !props.selecionado ? <p className="hub-nota">{REGRAS.semConta}</p> : <Regras {...props} config={config} draft={draft} />}
          <Calendarios marcados={draft.calendars} onMarcar={(c, on) => props.onEditar((d) => comCalendario(d, c, on))} />
        </>
      )}
    </section>
  )
}

function Regras({
  now,
  config,
  draft,
  ativas,
  fases,
  pendentes,
  tradesDesde,
  selecionado,
  onSelecionar,
  formLimite,
  onFormLimite,
  onEditar,
  onComecarHoje,
  onIrJanelas,
}: SuasRegrasProps & { config: RulesConfig; draft: RulesSettings }) {
  const pedirFoco = useFocoPendente()
  const futuros = useMemo(() => ativas.filter((a) => a.market === 'futures'), [ativas])
  const binarias = useMemo(() => ativas.filter((a) => a.market === 'binary'), [ativas])
  const conta = ativas.find((a) => a.id === selecionado) ?? null
  const entidade: Entidade = conta ? { tipo: 'conta', conta } : { tipo: 'padrao' }
  const market = conta ? conta.market : 'futures'
  const salvo = config.settings
  const mud = mudancasDaEntidade(salvo, draft, entidade)
  const rules = resolveRules(conta ?? PADRAO_FUTUROS_CONTA, draft)
  const hoje = comoFicaHoje(rules, now, janelasEfetivas(draft, entidade).windows)

  const opcoes = [
    ...(futuros.length ? [{ id: PADRAO_FUTUROS, texto: REGRAS.padraoFuturos }] : []),
    ...futuros.map((a) => ({ id: a.id, texto: a.label })),
    ...binarias.map((a) => ({ id: a.id, texto: a.label })),
  ]

  return (
    <>
      <div className="hub-pz-regras-de">
        <span id="r-de" className="hub-rotulo">
          {REGRAS.regrasDe}
        </span>
        <div role="group" aria-labelledby="r-de" className="hub-pills">
          {opcoes.map((o) => (
            <button key={o.id} type="button" className="hub-pill" aria-pressed={o.id === selecionado} onClick={() => onSelecionar(o.id)}>
              {o.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="hub-pz-regras-cab">
        <h3>{conta ? conta.label : REGRAS.padraoFuturos}</h3>
        <span className="hub-chip-dado">
          {conta ? REGRAS.chipConta(MERCADO_NOME[conta.market], fases[conta.id] ?? null) : REGRAS.valePara(futuros.length)}
        </span>
      </div>

      <ul className="hub-pz-regras">
        <RegraJanela entidade={entidade} draft={draft} mudou={mud.janela} onIrJanelas={onIrJanelas} />
        <RegraSoDentro entidade={entidade} draft={draft} mudou={mud.regraJanela} onEditar={onEditar} onIrJanelas={onIrJanelas} />
        {market === 'futures' && <RegraBloqueio entidade={entidade} draft={draft} salvo={salvo} mudou={mud.bloqueio} onEditar={onEditar} />}
        <RegraLimite
          entidade={entidade}
          draft={draft}
          mudou={mud.limite}
          futuros={futuros}
          form={formLimite}
          onForm={onFormLimite}
          onEditar={onEditar}
          pedirFoco={pedirFoco}
        />
        {market === 'futures' && <RegraEstado draft={draft} mudou={mud.estados} onEditar={onEditar} />}
      </ul>

      <ComoFicaHoje dados={hoje} />

      <BlocoVersao
        conta={conta}
        futuros={futuros}
        todas={config.accounts}
        pendentes={pendentes}
        now={now}
        tradesDesde={tradesDesde}
        onComecar={onComecarHoje}
      />
    </>
  )
}

/**
 * Phase 5-1 · Personalizar's «Dados econômicos» in the boards' world (lane L5): «Suas regras» rendered for a frame
 * state of contract §5, with the configuration's recorded rules_config (testing/fixtures/agenda/config-*.json), the
 * day's agenda and «Próximos dados» as the world answers them at the frame's instant (testing/agenda.ts), and each
 * release's next date. Used by the screen tests and the visual specs (outside the repo). Invented data only.
 *
 * The world's economic_events hold only the releases the gate's frames need; the list of «Escolher dado por dado»
 * draws the next date of every US release (boards Q04, Q05, Q42, from c2's dates), so PROXIMAS_EXTRAS adds the
 * others as the next-dates read would find them in economic_events (the yearly lists' period).
 */
import React, { useState } from 'react'
import type { AgendaRow, ReleaseCode } from '@/lib/domain/gate'
import { activeAccounts, parseRulesConfig, pendingVersions, type RulesConfig, type RulesSettings } from '@/lib/hub/regras'
import SuasRegras, { type DadosLidos } from '@/components/hub/personalizar/SuasRegras'
import type { FormLimite } from '@/components/hub/personalizar/PersonalizarProvider'
import { ESTADOS_DADOS, NY, agendaDoEstado, configDoQuadro, et, linhasDoQuadro, proximosDoEstado, type EstadoDados } from './agenda'

/** The board's dates of the US releases the world's rows do not hold (c2 §4; boards Q04, Q05, Q42) */
const EXTRAS: readonly [ReleaseCode, string][] = [
  ['ppi', '2026-12-15 08:30'],
  ['varejo_us', '2026-12-16 08:30'],
  ['casas_novas', '2026-12-23 10:00'],
  ['confianca_us', '2026-12-29 10:00'],
  ['ism_ind', '2027-01-04 10:00'],
  ['jolts', '2027-01-05 10:00'],
  ['ism_serv', '2027-01-06 10:00'],
  ['payroll', '2027-01-08 08:30'],
  ['fomc_decisao', '2027-01-27 14:00'],
  ['fomc_entrevista', '2027-01-27 14:30'],
]

export const PROXIMAS_EXTRAS: readonly AgendaRow[] = EXTRAS.map(([code, at]) => ({
  code,
  calendar: 'us',
  at: et(at),
  wasAt: null,
  status: 'agendado',
  day: at.slice(0, 10),
  localTz: NY,
}))

/** What the next-dates read answers in the world at `at`: every row from that day on */
export function proximasDoQuadro(at: Date): AgendaRow[] {
  const from = new Date(at.getTime() - 86_400_000)
  return [...linhasDoQuadro(), ...PROXIMAS_EXTRAS].filter((r) => r.at >= from).sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** The configuration's rules_config, parsed */
export const configDoEstado = (e: EstadoDados): RulesConfig => parseRulesConfig(configDoQuadro(ESTADOS_DADOS[e].config))

/** The page's agenda for a state (PersonalizarPagina's useDadosDaRegra, answered) */
export function dadosDoEstado(e: EstadoDados, over: Partial<DadosLidos> = {}): DadosLidos {
  const s = ESTADOS_DADOS[e]
  return {
    agora: s.agora,
    dia: agendaDoEstado(e),
    proximos: s.semAgenda ? null : proximosDoEstado(e),
    proximas: s.semAgenda ? null : proximasDoQuadro(s.agora),
    onAbrirLista: () => {},
    onTentar: () => {},
    ...over,
  }
}

/** «Suas regras» of a frame state: the configuration's Top One selected, the draft editable */
export function RegrasDoQuadro({
  estado,
  editar,
  dados,
}: {
  estado: EstadoDados
  /** The frame's unsaved change (Q42: CPI → «Não opero no dia») */
  editar?: (draft: RulesSettings, config: RulesConfig) => RulesSettings
  dados?: Partial<DadosLidos>
}) {
  const [config] = useState(() => configDoEstado(estado))
  const [draft, setDraft] = useState(() => (editar ? editar(config.settings, config) : config.settings))
  const [form, setForm] = useState<FormLimite | null>(null)
  const ativas = activeAccounts(config)
  const [sel, setSel] = useState(ativas[0]?.id ?? '')
  return (
    <SuasRegras
      carga="pronto"
      onTentar={() => {}}
      now={ESTADOS_DADOS[estado].agora}
      config={config}
      draft={draft}
      ativas={ativas}
      fases={{ [ativas[0]?.id ?? '']: 'Financiada' }}
      pendentes={pendingVersions(config, draft)}
      tradesDesde={undefined}
      selecionado={sel}
      onSelecionar={setSel}
      formLimite={form}
      onFormLimite={setForm}
      onEditar={(fn) => setDraft((d) => fn(d))}
      onComecarHoje={() => {}}
      onIrJanelas={() => {}}
      dados={dadosDoEstado(estado, dados)}
    />
  )
}

'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import SuasContas from '@/components/hub/contas/SuasContas'
import { useHubTheme } from '@/components/hub/HubRoot'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import { usePreferences } from '@/hooks/useContas'
import { useMergePreferences } from '@/hooks/useRegras'
import { useAgendaDoDia, useProximosDados } from '@/hooks/useAgenda'
import { useServerNow } from '@/hooks/useRegistrar'
import { currencyOf } from '@/lib/domain/markets'
import { agendaFor, blockIntervals, type AgendaRead, type CalendarCode, type ReleaseCode, type Rules } from '@/lib/domain/gate'
import { tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain/tempo'
import { dinheiroCompacto } from '@/lib/hub/posso'
import { PADRAO_FUTUROS_CONTA, comHorarios } from '@/lib/hub/rascunho'
import { resolveRules, type AccountConfig, type RulesSettings } from '@/lib/hub/regras'
import { avisoAntesDaEsperaLigado } from '@/lib/hub/regrasDb'
import { NOMES_DADOS } from '@/lib/hub/dadosEconomicos'
import { hhmm, regraSemEspera, relogioDe } from '@/lib/hub/comoFicaHoje'
import { BarraSalvar, StatusSalvar } from './BarraSalvar'
import { PREFERENCIAS, lista } from './copy'
import IndiceSecoes from './IndiceSecoes'
import PersonalizarProvider, { usePersonalizar } from './PersonalizarProvider'
import Preferencias, { type AvisoPreferencia } from './Preferencias'
import QuandoVoceOpera from './QuandoVoceOpera'
import SuasRegras, { type DadosLidos } from './SuasRegras'
import { useProximasDatas } from './useProximasDatas'

/**
 * Personalizar's body (board Personalizar.dc.html): the header with the save status, the section
 * index, Suas contas (Phase 1), «Quando você opera», «Suas regras», «Preferências» and the sticky
 * save bar. `children` is the page's title block (its H1 is the import sheet's focus fallback).
 */
export default function PersonalizarPagina({ children }: { children: React.ReactNode }) {
  return (
    <PersonalizarProvider>
      <Corpo>{children}</Corpo>
    </PersonalizarProvider>
  )
}

/**
 * «Com os limites atuais: Top One #1 US$ 320, FTMO US$ 800 e Clear R$ 400 de perda.»: 80 % of each
 * active account's daily limit as the page's rules show it (the draft, as «Suas regras»), in the
 * account's currency and list order; null while the rules load
 */
export function notaAviso80(ativas: readonly Pick<AccountConfig, 'id' | 'label' | 'market'>[], draft: RulesSettings | null): string | null {
  if (!draft) return null
  const itens = ativas.flatMap((a) => {
    const limit = draft.accounts[a.id]?.limit
    return limit ? [`${a.label} ${dinheiroCompacto(Math.round(limit.cents * 0.8), currencyOf(a.market))}`] : []
  })
  return itens.length ? PREFERENCIAS.aviso80Limites(itens) : PREFERENCIAS.aviso80SemLimite
}

/** The futures accounts' rules as the page's draft resolves them, the ones whose data rule waits first */
function futurosComDados(ativas: readonly AccountConfig[], draft: RulesSettings | null): { conta: AccountConfig; rules: Rules }[] {
  if (!draft) return []
  return ativas.filter((a) => a.market === 'futures').map((conta) => ({ conta, rules: resolveRules(conta, draft) }))
}

/**
 * Phase 5-1 · the sentence under «Avisar 10 minutos antes de uma espera de dado econômico» (c3 §8.2;
 * board Q39): «Sem conta de Futuros: não há espera.» · «Sem efeito: “Dados econômicos” está desligado em
 * Suas regras.» · «Hoje não há espera nos calendários que você segue.» · «Hoje: às 08:15, antes da espera
 * do CPI.» (the next mid-day wait of the first futures account whose rule waits, else its first one
 * today) · «Hoje não há espera com hora marcada: …» (only «Só depois» and whole days today). `agenda`
 * is that account's day read (E5); null when it did not load or is not read yet (no sentence then).
 */
export function notaAvisoDado(
  ativas: readonly AccountConfig[],
  draft: RulesSettings | null,
  agenda: AgendaRead | null,
  now: Date,
): string | null {
  if (!draft) return null
  const futuros = futurosComDados(ativas, draft)
  if (futuros.length === 0) return PREFERENCIAS.avisoDadoSemFuturos
  const alvo = futuros.find((x) => !regraSemEspera(x.rules))
  if (!alvo) return PREFERENCIAS.avisoDadoDesligada
  if (!agenda) return null
  const r = alvo.rules
  const entries = agendaFor(r, r.day, now, agenda)
  if (entries === null) return null
  const { start, end } = tradingDayBounds(tradingDayOn(now, r.day), r.day)
  const ivs = blockIntervals(r, r.day, entries).filter((iv) => iv.start < end && iv.end > start)
  const meioDoDia = ivs.filter((iv) => iv.kind === 'espera' && iv.start > start)
  const iv = meioDoDia.find((x) => x.start > now) ?? meioDoDia[0]
  if (iv) {
    const codes = Array.from(new Set(iv.releases.map((x) => x.code))) as ReleaseCode[]
    return PREFERENCIAS.avisoDadoHoje(hhmm(new Date(iv.start.getTime() - 10 * 60_000), relogioDe(r)), lista(codes.map((c) => NOMES_DADOS[c].doDa)))
  }
  return ivs.length ? PREFERENCIAS.avisoDadoSoDiaInteiro : PREFERENCIAS.avisoDadoSemEspera
}

/** The account whose day the 10-minute sentence reads (the first futures account whose data rule waits) */
export function contaDoAvisoDado(ativas: readonly AccountConfig[], draft: RulesSettings | null): { calendars: readonly CalendarCode[]; clock: DayClock } | null {
  const alvo = futurosComDados(ativas, draft).find((x) => !regraSemEspera(x.rules))
  return alvo && alvo.rules.block ? { calendars: alvo.rules.block.calendars, clock: alvo.rules.day } : null
}

/**
 * A switch of profiles.preferences.alerts saved at once like the theme (merge_preferences writes only
 * that key): `limit_80` (default off, `=== true`) and, from Phase 5-1, `before_block` (on unless saved
 * off: `!== false`, contract §3.8; never limit_80's default). The switch moves at once; a failure puts
 * it back and says so. Taps while a save runs are not lost: the last position is saved after it.
 */
function useAvisoPreferencia(chave: 'limit_80' | 'before_block', nota: string | null): AvisoPreferencia {
  const preferences = usePreferences()
  const { mutateAsync } = useMergePreferences()
  const [local, setLocal] = useState<boolean | null>(null)
  const [erro, setErro] = useState(false)
  const want = useRef<boolean | null>(null)
  const sending = useRef(false)
  const salvo = chave === 'before_block' ? avisoAntesDaEsperaLigado(preferences.data) : preferences.data?.alerts?.limit_80 === true
  const ligado = local ?? salvo

  const send = (value: boolean) => {
    want.current = value
    setLocal(value)
    setErro(false)
    if (sending.current) return
    sending.current = true
    const run = async (v: boolean): Promise<void> => {
      try {
        await mutateAsync({ alerts: { [chave]: v } })
      } catch {
        sending.current = false
        want.current = null
        setLocal(null)
        setErro(true)
        return
      }
      if (want.current !== null && want.current !== v) return run(want.current)
      sending.current = false
      want.current = null
      // The merged preferences are in the cache now (useMergePreferences)
      setLocal(null)
    }
    void run(value)
  }

  return {
    ligado,
    // A saved «on» must not show «off» while the preferences are read (a failed read lets it be used:
    // the merge writes only this key)
    esperando: preferences.isPending && preferences.fetchStatus !== 'idle',
    nota,
    erro,
    onAlternar: () => send(!ligado),
  }
}

/**
 * Phase 5-1 (contract §3.8): the agenda «Suas regras» shows for the selected entity, where its market
 * has «Dados econômicos» (Futuros): the day (E5) for the status line and «Como fica hoje», «Próximos
 * dados» (E6), and each release's next date once «Escolher dado por dado» opens. Server clock.
 */
function useDadosDaRegra(p: ReturnType<typeof usePersonalizar>, agora: Date): DadosLidos {
  const [listaAberta, setListaAberta] = useState(false)
  const conta = p.ativas.find((a) => a.id === p.selecionado) ?? null
  const rules = p.draft ? resolveRules(conta ?? PADRAO_FUTUROS_CONTA, p.draft) : null
  const comDados = !!rules?.block && !!p.selecionado
  const calendars = p.draft?.calendars ?? []
  const dia = useAgendaDoDia(comDados && calendars.length > 0 ? { calendars, clock: rules!.day } : null)
  const proximos = useProximosDados({ enabled: comDados })
  const proximas = useProximasDatas(rules?.day ?? PADRAO_FUTUROS_CONTA.day, { enabled: comDados && listaAberta })
  const onAbrirLista = useCallback(() => setListaAberta(true), [])
  const { refetch: refetchDia } = dia
  const { refetch: refetchProximos } = proximos
  const onTentar = useCallback(() => {
    void refetchDia()
    void refetchProximos()
  }, [refetchDia, refetchProximos])
  return {
    agora,
    dia: dia.data ?? (dia.isError ? null : undefined),
    proximos: proximos.data ?? (proximos.isError ? null : undefined),
    proximas: proximas.data ?? null,
    onAbrirLista,
    onTentar,
  }
}

function Corpo({ children }: { children: React.ReactNode }) {
  const p = usePersonalizar()
  const sheet = useImportSheet()
  const { theme, setTheme } = useHubTheme()
  const nota = useMemo(() => notaAviso80(p.ativas, p.draft), [p.ativas, p.draft])
  const aviso80 = useAvisoPreferencia('limit_80', nota)
  // Phase 5-1: the 10-minute notice of «Dados econômicos», with the day of the first futures account whose rule waits
  const agora = useServerNow(60_000)
  const dados = useDadosDaRegra(p, agora)
  const contaAviso = useMemo(() => contaDoAvisoDado(p.ativas, p.draft), [p.ativas, p.draft])
  const agendaAviso = useAgendaDoDia(contaAviso && contaAviso.calendars.length > 0 ? contaAviso : null)
  const avisoDado = useAvisoPreferencia('before_block', notaAvisoDado(p.ativas, p.draft, agendaAviso.data ?? null, agora))
  const acoes = {
    status: p.status,
    podeDescartar: p.podeDescartar,
    podeSalvar: p.podeSalvar,
  }

  return (
    <div className="hub-pagina">
      <div className="hub-pg-topo">
        <div className="hub-pz-titulo">{children}</div>
        <StatusSalvar {...acoes} onDescartar={() => p.descartar(false)} onSalvar={() => p.salvar(false)} />
      </div>

      <div className="hub-pz-corpo">
        <IndiceSecoes />
        <div className="hub-pz-conteudo">
          <SuasContas />
          <QuandoVoceOpera
            carga={p.carga}
            onTentar={p.tentarDeNovo}
            now={p.now}
            salvo={p.base?.settings ?? null}
            draft={p.draft}
            ativas={p.ativas}
            onEditar={p.editar}
            onAdicionarConta={(opener, fallback) => sheet.open({ mode: 'adicionar', opener, fallback })}
          />
          <SuasRegras
            carga={p.carga}
            onTentar={p.tentarDeNovo}
            now={p.now}
            config={p.base}
            draft={p.draft}
            ativas={p.ativas}
            fases={p.fases}
            pendentes={p.pendentes}
            tradesDesde={p.tradesDesde}
            selecionado={p.selecionado}
            onSelecionar={p.selecionar}
            formLimite={p.formLimite}
            onFormLimite={p.setFormLimite}
            onEditar={p.editar}
            onComecarHoje={p.comecarHoje}
            onIrJanelas={() => p.irPara('janelas')}
            dados={dados}
          />
          <Preferencias
            tema={theme}
            onTema={setTheme}
            carga={p.carga}
            onTentar={p.tentarDeNovo}
            horarios={p.draft?.displayTz ?? null}
            onHorarios={(v) => p.editar((d) => comHorarios(d, v))}
            aviso80={aviso80}
            avisoDado={avisoDado}
          />
          <BarraSalvar
            {...acoes}
            visivel={p.barra.visivel}
            sujo={p.barra.sujo}
            onSair={p.soltarBarra}
            onDescartar={() => p.descartar(true)}
            onSalvar={() => p.salvar(true)}
          />
        </div>
      </div>
    </div>
  )
}

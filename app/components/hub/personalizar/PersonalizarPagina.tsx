'use client'

import { useMemo, useRef, useState } from 'react'
import SuasContas from '@/components/hub/contas/SuasContas'
import { useHubTheme } from '@/components/hub/HubRoot'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import { usePreferences } from '@/hooks/useContas'
import { useMergePreferences } from '@/hooks/useRegras'
import { currencyOf } from '@/lib/domain/markets'
import { dinheiroCompacto } from '@/lib/hub/posso'
import { comHorarios } from '@/lib/hub/rascunho'
import type { AccountConfig, RulesSettings } from '@/lib/hub/regras'
import { BarraSalvar, StatusSalvar } from './BarraSalvar'
import { PREFERENCIAS } from './copy'
import IndiceSecoes from './IndiceSecoes'
import PersonalizarProvider, { usePersonalizar } from './PersonalizarProvider'
import Preferencias, { type Aviso80 } from './Preferencias'
import QuandoVoceOpera from './QuandoVoceOpera'
import SuasRegras from './SuasRegras'

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

/**
 * profiles.preferences.alerts.limit_80, saved at once like the theme (merge_preferences writes
 * only that key; default off). The switch moves at once; a failure puts it back and says so. Taps
 * while a save runs are not lost: the last position is saved after it.
 */
function useAviso80(nota: string | null): Aviso80 {
  const preferences = usePreferences()
  const { mutateAsync } = useMergePreferences()
  const [local, setLocal] = useState<boolean | null>(null)
  const [erro, setErro] = useState(false)
  const want = useRef<boolean | null>(null)
  const sending = useRef(false)
  const ligado = local ?? preferences.data?.alerts?.limit_80 === true

  const send = (value: boolean) => {
    want.current = value
    setLocal(value)
    setErro(false)
    if (sending.current) return
    sending.current = true
    const run = async (v: boolean): Promise<void> => {
      try {
        await mutateAsync({ alerts: { limit_80: v } })
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

function Corpo({ children }: { children: React.ReactNode }) {
  const p = usePersonalizar()
  const sheet = useImportSheet()
  const { theme, setTheme } = useHubTheme()
  const nota = useMemo(() => notaAviso80(p.ativas, p.draft), [p.ativas, p.draft])
  const aviso80 = useAviso80(nota)
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
          />
          <Preferencias
            tema={theme}
            onTema={setTheme}
            carga={p.carga}
            onTentar={p.tentarDeNovo}
            horarios={p.draft?.displayTz ?? null}
            onHorarios={(v) => p.editar((d) => comHorarios(d, v))}
            aviso80={aviso80}
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

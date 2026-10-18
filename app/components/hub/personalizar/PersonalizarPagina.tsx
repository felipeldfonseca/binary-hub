'use client'

import SuasContas from '@/components/hub/contas/SuasContas'
import { useHubTheme } from '@/components/hub/HubRoot'
import { useImportSheet } from '@/components/hub/importar/ImportSheetProvider'
import { comHorarios } from '@/lib/hub/rascunho'
import { BarraSalvar, StatusSalvar } from './BarraSalvar'
import IndiceSecoes from './IndiceSecoes'
import PersonalizarProvider, { usePersonalizar } from './PersonalizarProvider'
import Preferencias from './Preferencias'
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

function Corpo({ children }: { children: React.ReactNode }) {
  const p = usePersonalizar()
  const sheet = useImportSheet()
  const { theme, setTheme } = useHubTheme()
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

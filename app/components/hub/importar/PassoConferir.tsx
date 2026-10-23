'use client'

/**
 * «conferir» (Phase 3b, lane L1; approved board ImportarConta IC l.553–573): «Confira 3 linhas». The order line, the
 * first rows as the mapping reads them, the notes, the end-of-file question per symbol, the pairing summary with «Ver as
 * N operações», the net question, «Salvar como modelo» / «Atualizar o modelo “…”» (contract §5.5, §5.7); for a model
 * taken as is that starts here, the model chip with «Mudar colunas» in place of the model block (D20). Everything shown
 * comes from lib/hub/importMapaVista; every change is an edit of lib/hub/importMapeado handed to the sheet.
 */
import { useMemo, useState } from 'react'
import type { AccountMarket } from '@/lib/domain/markets'
import { MAX_TEMPLATE_NAME, type EndOfFileAnswer } from '@/lib/domain/import'
import { comFimDoArquivo, comLiquido, comNome, comSalvar, type Mapeamento } from '@/lib/hub/importMapeado'
import { vistaConferir } from '@/lib/hub/importMapaVista'
import { Disclosure } from '@/components/hub/contas/ui'
import ChipModelo from '@/components/hub/importar/ChipModelo'
import { Pergunta } from '@/components/hub/importar/PassoMapa'
import { MODELO } from '@/components/hub/importar/copyMapa'

export interface PassoConferirProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** E24's nota after an answer */
  onAnuncio: (texto: string) => void
  /**
   * A model taken as is that starts here (inicio 'conferir', porModelo): the sheet's «Mudar colunas»; PassoConferir then
   * renders <ChipModelo> after the order line and no model block (E27). null otherwise
   */
  onMudarColunas: (() => void) | null
}

export default function PassoConferir({ headingRef, mapeamento: m, market, onChange, onAnuncio, onMudarColunas }: PassoConferirProps): JSX.Element {
  const [verOperacoes, setVerOperacoes] = useState(false)
  const v = useMemo(() => vistaConferir(m, market), [m, market])

  /** E24: the answer, then its nota for the live region */
  const responder = (chave: string, resposta: EndOfFileAnswer) => {
    const n = comFimDoArquivo(m, chave, resposta)
    onChange(n)
    const nota = vistaConferir(n, market).perguntasFim.find((q) => q.chave === chave)?.nota
    if (nota) onAnuncio(nota)
  }

  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {v.titulo}
      </h3>
      <span className="hub-nota">{v.ordem}</span>
      {onMudarColunas && v.chipModelo !== null && <ChipModelo nome={v.chipModelo} onMudar={onMudarColunas} />}

      {v.falha ? (
        <p className="hub-alerta">{v.falha}</p>
      ) : (
        <ul className="hub-prev-lista">
          {v.linhas.map((itens, i) => (
            <li key={i} className="hub-prev-linha">
              {itens.map((item, j) => (
                <span key={j}>
                  {item}
                  {j < itens.length - 1 && <span className="sr-only">, </span>}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}

      {v.notas.map((n) => (
        <p key={n} className="hub-nota">
          {n}
        </p>
      ))}

      {v.perguntasFim.map((q) => (
        <Pergunta<EndOfFileAnswer> key={q.id} q={q} onEscolher={(a) => responder(q.chave, a)} />
      ))}

      {v.pareamento && (
        <div className="hub-bloco">
          <div role="status" className="hub-pareamento">
            <span className="hub-pareamento__tit">{v.pareamento.resumo}</span>
            {v.pareamento.primeira && <span>{v.pareamento.primeira}</span>}
            {v.pareamento.entradas && <span className="hub-nota">{v.pareamento.entradas}</span>}
          </div>
          {v.pareamento.ver && (
            <div>
              <Disclosure open={verOperacoes} controls="ops-formadas" onToggle={() => setVerOperacoes((x) => !x)}>
                {v.pareamento.ver}
              </Disclosure>
            </div>
          )}
          {verOperacoes && v.pareamento.ver && (
            <ul id="ops-formadas" className="hub-ops-lista">
              {v.pareamento.operacoes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {v.liquido && <Pergunta<'sim' | 'nao'> q={v.liquido} onEscolher={(a) => onChange(comLiquido(m, a === 'sim'))} />}

      {v.modelo && (
        <div className="hub-bloco">
          <label className="hub-check">
            <input type="checkbox" checked={v.modelo.salvar} onChange={(e) => onChange(comSalvar(m, e.target.checked))} />
            {v.modelo.rotulo}
          </label>
          {v.modelo.comNome && (
            <div className="hub-campo">
              <label htmlFor="m-nome" className="hub-rot-campo">
                {MODELO.nome}
              </label>
              <input
                id="m-nome"
                className="hub-entrada"
                type="text"
                autoComplete="off"
                maxLength={MAX_TEMPLATE_NAME}
                value={v.modelo.nome}
                onChange={(e) => onChange(comNome(m, e.target.value))}
              />
            </div>
          )}
          <span className="hub-nota">{v.modelo.nota}</span>
        </div>
      )}
    </div>
  )
}

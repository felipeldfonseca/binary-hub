'use client'

/**
 * «mapa» (Phase 3b, lane L1; approved board ImportarConta IC l.527–551): «Diga o que é cada coluna». The reading chips
 * and «Mudar» (separator, decimal, dates), the date and decimal questions, «Cada linha do arquivo é», «Obrigatórias»,
 * the notes, the duplicate block, one select per column with its check, the side-word questions (contract §5.4, §5.7).
 * Everything shown comes from lib/hub/importMapaVista; every change is an edit of lib/hub/importMapeado handed to the
 * sheet (`onChange`), and what the sheet's live region should say (E10, E12's nota, E16) goes to `onAnuncio`.
 */
import { useMemo, useState } from 'react'
import type { AccountMarket } from '@/lib/domain/markets'
import type { CsvDelimiter, DateOrder, DecimalMark, RowKind, SideWordAnswer } from '@/lib/domain/import'
import {
  comColuna,
  comDatas,
  comDecimal,
  comModo,
  comPalavraDeLado,
  comSeparador,
  type ArquivoMapeavel,
  type ColunaUi,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { anuncioDoMapa, vistaMapa, type PerguntaVista, type PilulaVista } from '@/lib/hub/importMapaVista'
import { LER, MAPA, REQ } from '@/components/hub/importar/copyMapa'

export interface PassoMapaProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  arquivo: ArquivoMapeavel
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** What the sheet's one live region says now (E10, E12's nota, E16): called after the change that shows it */
  onAnuncio: (texto: string) => void
}

/** A row of pills (`role=group`, `aria-pressed`), labelled by `rotuloId` */
export function Pilulas<V extends string>({
  rotuloId,
  opcoes,
  onEscolher,
}: {
  rotuloId: string
  opcoes: PilulaVista<V>[]
  onEscolher: (valor: V) => void
}): JSX.Element {
  return (
    <div role="group" aria-labelledby={rotuloId} className="hub-pills">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="hub-pill"
          aria-label={o.aria ?? undefined}
          aria-pressed={o.pressionada}
          onClick={() => onEscolher(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

/** A question block (E11, E12, E18, E24, E26): amber when it must be answered, the pills, its nota */
export function Pergunta<V extends string>({ q, onEscolher }: { q: PerguntaVista<V>; onEscolher: (valor: V) => void }): JSX.Element {
  return (
    <div className={q.atencao ? 'hub-bloco hub-bloco--atencao hub-pergunta' : 'hub-bloco hub-pergunta'}>
      <span id={q.id} className="hub-pergunta__tit">
        {q.texto}
      </span>
      {q.sub && <span>{q.sub}</span>}
      <Pilulas rotuloId={q.id} opcoes={q.opcoes} onEscolher={onEscolher} />
      {q.nota && <span className="hub-nota">{q.nota}</span>}
    </div>
  )
}

export default function PassoMapa({ headingRef, arquivo, mapeamento: m, market, onChange, onAnuncio }: PassoMapaProps): JSX.Element {
  const [lerAberto, setLerAberto] = useState(false)
  const v = useMemo(() => vistaMapa(m, arquivo, market), [m, arquivo, market])

  /** Hands the edit to the sheet, then what the live region says when it changed */
  const mudar = (n: Mapeamento) => {
    const antes = v.anuncio
    const depois = anuncioDoMapa(n, market)
    onChange(n)
    if (depois !== antes) onAnuncio(depois)
  }

  return (
    <div className="hub-passo">
      <h3 id="t-passo" tabIndex={-1} ref={headingRef}>
        {v.titulo}
      </h3>

      <div className="hub-ler">
        <span className="hub-chip-dado">{v.lerTexto}</span>
        {v.datasTexto && <span className="hub-chip-dado">{v.datasTexto}</span>}
        <button type="button" className="hub-btn" aria-expanded={lerAberto} aria-controls="ler-arquivo" onClick={() => setLerAberto((x) => !x)}>
          {LER.mudar}
        </button>
      </div>
      {lerAberto && (
        <div id="ler-arquivo" className="hub-ler-painel">
          <div className="hub-campo">
            <span id="l-sep" className="hub-rot-campo">
              {LER.rotSeparador}
            </span>
            <Pilulas<CsvDelimiter> rotuloId="l-sep" opcoes={v.separadores} onEscolher={(d) => mudar(comSeparador(m, arquivo, d, market))} />
          </div>
          {v.decimais && (
            <div className="hub-campo">
              <span id="l-dec" className="hub-rot-campo">
                {LER.rotDecimal}
              </span>
              <Pilulas<DecimalMark> rotuloId="l-dec" opcoes={v.decimais} onEscolher={(d) => mudar(comDecimal(m, d, market))} />
            </div>
          )}
          {v.ordens && (
            <div className="hub-campo">
              <span id="l-datas" className="hub-rot-campo">
                {LER.rotDatas}
              </span>
              <Pilulas<DateOrder> rotuloId="l-datas" opcoes={v.ordens} onEscolher={(o) => mudar(comDatas(m, o, market))} />
            </div>
          )}
        </div>
      )}
      {v.notaLer && <p className="hub-nota">{v.notaLer}</p>}
      {v.perguntaDatas && <Pergunta<DateOrder> q={v.perguntaDatas} onEscolher={(o) => mudar(comDatas(m, o, market))} />}
      {v.perguntaDecimal && <Pergunta<DecimalMark> q={v.perguntaDecimal} onEscolher={(d) => mudar(comDecimal(m, d, market))} />}

      <div className="hub-campo">
        <span id="l-modo" className="hub-rot-campo">
          {MAPA.modo}
        </span>
        <Pilulas<RowKind> rotuloId="l-modo" opcoes={v.modos} onEscolher={(k) => mudar(comModo(m, k, market))} />
      </div>

      <div className="hub-campo">
        <span className="hub-rotulo">{REQ.titulo}</span>
        <div className="hub-pills">
          {v.obrigatorias.map((r) => (
            <span key={r.texto} className={r.ok ? 'hub-req hub-req--ok' : 'hub-req'}>
              {r.texto}
            </span>
          ))}
        </div>
        <span className="hub-nota">{v.opcionais}</span>
      </div>

      {v.notas.map((n) => (
        <p key={n} className="hub-nota">
          {n}
        </p>
      ))}
      {v.duplicadas && <div className="hub-bloco hub-bloco--atencao">{v.duplicadas}</div>}

      <div className="hub-cols">
        {v.colunas.map((c) => (
          <div key={c.indice} className="hub-col-linha">
            <div className="hub-col-nome">
              <span className="hub-col-tit">
                <b>{c.nome}</b>
                {c.tag && (
                  <span className="hub-tag hub-tag--padrao">
                    <span className="hub-col-tag">{c.tag}</span>
                  </span>
                )}
              </span>
              <span className="hub-col-ex">{c.amostra}</span>
            </div>
            <div className="hub-col-sel">
              <select
                className="hub-sel"
                aria-label={c.aria}
                aria-invalid={c.checagem ? 'true' : 'false'}
                aria-describedby={c.checagem ? c.checagemId : undefined}
                value={c.valor}
                onChange={(e) => {
                  const valor = e.target.value
                  if (valor !== '' && !c.opcoes.some((o) => o.valor === valor)) return
                  mudar(comColuna(m, c.indice, valor === '' ? null : (valor as ColunaUi), market))
                }}
              >
                {c.opcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
              {c.checagem && (
                <span id={c.checagemId} className="hub-chk">
                  {c.checagem}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {v.perguntasLado.map((q) => (
        <Pergunta<SideWordAnswer> key={q.id} q={q} onEscolher={(a) => mudar(comPalavraDeLado(m, q.chave, a, market))} />
      ))}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { DiaryDayTrade, DiarioDataError } from '@/lib/hub/diarioDb'
import { formatImageSize } from '@/lib/hub/registrarImagens'
import { ANEXOS } from '@/components/hub/registrar/copy'
import ImagensENota, { type Anexos } from '@/components/hub/registrar/ImagensENota'
import { IMAGENS } from './copyDia'

/** The box of one image: the signed URL's picture, an empty box while it is read, «sem prévia» when refused */
function Previa({ url, estado, nome, grande = false }: { url: string | null | undefined; estado: 'lendo' | 'pronto' | 'falhou'; nome: string; grande?: boolean }) {
  const classe = grande ? 'hub-dr-img-previa hub-dr-img-previa--grande' : 'hub-dr-img-previa'
  if (estado === 'pronto' && url) {
    // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL (10 min): next/image cannot optimize it
    return <img className={classe} src={url} alt={grande ? nome : ''} width={grande ? 336 : 168} height={grande ? 208 : 104} />
  }
  return (
    <span className={`${classe} hub-dr-img-previa--vazia`} aria-hidden={grande ? undefined : true} role={grande ? 'img' : undefined} aria-label={grande ? nome : undefined}>
      {estado === 'lendo' ? '' : ANEXOS.semPrevia}
    </span>
  )
}

/**
 * «Imagens e nota» in the drill (contract H8–H11; board `t.temAx`, `t.axEd`): the saved images as 168 × 104
 * thumbnails with «nome · tamanho» under each, the note, «salvas às 10:12 · depois do resultado» and «Editar»; a
 * thumbnail opens the dialog «Imagem 1 de 2» (not modal, as drawn: «Fechar» takes the focus, Escape closes, ← and →
 * move, closing gives the focus to the thumbnail shown); «Editar» or «Adicionar imagens ou nota» opens the board's
 * editor (the Registrar's block in its Diário variant). The status outlasts the editor (it says what the save did).
 */
export default function ImagensDoDia({
  t,
  a,
  quando,
  idBase,
  urls,
}: {
  t: DiaryDayTrade
  a: Anexos
  /** «salvas às 10:12 · depois do resultado» */
  quando: string
  idBase: string
  urls: UseQueryResult<Record<string, string | null>, DiarioDataError>
}) {
  const [dlg, setDlg] = useState<number | null>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const [focoMini, setFocoMini] = useState<{ k: number; n: number } | null>(null)
  const imagens = t.images
  const n = imagens.length
  const temSalvo = n > 0 || !!t.trade.note
  const id = (x: string) => `${idBase}-${x}`

  useEffect(() => {
    if (dlg !== null) fecharRef.current?.focus()
  }, [dlg === null]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focoMini) document.getElementById(id(`mini-${focoMini.k}`))?.focus()
  }, [focoMini]) // eslint-disable-line react-hooks/exhaustive-deps

  const estado = (path: string): 'lendo' | 'pronto' | 'falhou' => {
    if (urls.isError) return 'falhou'
    if (!urls.data) return 'lendo'
    return urls.data[path] ? 'pronto' : 'falhou'
  }
  const fechar = () => {
    const k = dlg ?? 0
    setDlg(null)
    setFocoMini((f) => ({ k, n: (f?.n ?? 0) + 1 }))
  }
  const ir = (k: number) => {
    if (k >= 0 && k < n) setDlg(k)
  }

  return (
    <>
      {a.editando ? (
        <div className="hub-dr-drill-full">
          <ImagensENota a={a} />
        </div>
      ) : temSalvo ? (
        <div className="hub-dr-drill-full hub-dr-img-salvas">
          <div className="hub-dr-img-cab">
            <div className="hub-dr-img-cab-txt">
              <strong>{ANEXOS.titulo}</strong>
              {quando && <span className="hub-dr-img-quando">{quando}</span>}
            </div>
            {!t.history && (
              <button id={id('editar')} type="button" className="hub-btn hub-dr-img-btn" aria-label={ANEXOS.editarAria} onClick={a.editar}>
                {ANEXOS.editar}
              </button>
            )}
          </div>
          {dlg !== null && imagens[dlg] && (
            <div
              role="dialog"
              aria-labelledby={id('dlg-tit')}
              className="hub-dr-img-dlg"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  fechar()
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  ir(dlg - 1)
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  ir(dlg + 1)
                }
              }}
            >
              <div className="hub-dr-img-dlg-cab">
                <strong id={id('dlg-tit')}>{IMAGENS.dialogo(dlg + 1, n)}</strong>
                <div className="hub-dr-img-dlg-acoes">
                  <button type="button" className="hub-btn" aria-disabled={dlg === 0 || undefined} onClick={() => ir(dlg - 1)}>
                    {IMAGENS.anterior}
                  </button>
                  <button type="button" className="hub-btn" aria-disabled={dlg >= n - 1 || undefined} onClick={() => ir(dlg + 1)}>
                    {IMAGENS.proxima}
                  </button>
                  <button ref={fecharRef} type="button" className="hub-btn" onClick={fechar}>
                    {IMAGENS.fechar}
                  </button>
                </div>
              </div>
              <Previa url={urls.data?.[imagens[dlg].path]} estado={estado(imagens[dlg].path)} nome={imagens[dlg].name} grande />
              <span className="hub-dr-img-legenda">
                {imagens[dlg].name} · {formatImageSize(imagens[dlg].bytes ?? 0)}
              </span>
            </div>
          )}
          {n > 0 && dlg === null && (
            <ul className="hub-dr-img-minis" aria-label={IMAGENS.lista}>
              {imagens.map((im, k) => (
                <li key={im.id}>
                  <button id={id(`mini-${k}`)} type="button" className="hub-dr-img-mini" aria-label={IMAGENS.abrirAria(im.name, k + 1, n)} onClick={() => setDlg(k)}>
                    <Previa url={urls.data?.[im.path]} estado={estado(im.path)} nome={im.name} />
                    <span className="hub-dr-img-legenda">
                      {im.name} · {formatImageSize(im.bytes ?? 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {t.trade.note && <p className="hub-dr-img-nota">{t.trade.note}</p>}
        </div>
      ) : !t.history ? (
        <div className="hub-dr-drill-full">
          <button id={id('add')} type="button" className="hub-dr-img-add" onClick={a.editar}>
            {IMAGENS.adicionar}
          </button>
        </div>
      ) : null}
      <div role="status" className="sr-only">
        {a.status || a.aviso}
      </div>
    </>
  )
}

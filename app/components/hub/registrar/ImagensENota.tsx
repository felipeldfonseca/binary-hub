'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useHubDb } from '@/hooks/useContas'
import { useSaveImagesAndNote } from '@/hooks/useRegistrar'
import type { ImageMime } from '@/lib/domain/registro'
import { RegistrarDataError, signedImageUrl, type TradeImage, type TradeView } from '@/lib/hub/registrarDb'
import { IMAGE_ACCEPT, MAX_IMAGES, MAX_IMAGE_BYTES, formatImageSize, imageMimeOf, uniqueImageName, type ImageItem, type SaveProgress } from '@/lib/hub/registrarImagens'
import { hora, type ContaReg } from '@/lib/hub/registrarForm'
import { ANEXOS, ENTRADA, ERRO_REGISTRAR } from './copy'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'

/** An image in the editor: one already saved, or a file chosen here (with its preview) */
export type ItemAnexo =
  | { kind: 'saved'; key: string; id: string; name: string; bytes: number | null; path: string }
  | { kind: 'new'; key: string; file: File; name: string; bytes: number; mime: ImageMime; url: string | null }

const MAX_NOTA = 1000

/** «Arraste para cá, cole com ⌘V…» on Apple devices, Ctrl+V elsewhere */
function atalhoColar(): string {
  try {
    const p = typeof navigator !== 'undefined' ? String(navigator.platform || navigator.userAgent || '') : ''
    return /Mac|iPhone|iPad/.test(p) ? '⌘V' : 'Ctrl+V'
  } catch {
    return 'Ctrl+V'
  }
}

/** A touch screen only: no dragging or pasting, only choosing (RO `toque`) */
function soToque(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches
  } catch {
    return false
  }
}

function previa(file: File): string | null {
  try {
    return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
  } catch {
    return null
  }
}

function soltarPrevia(url: string | null) {
  try {
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
  } catch {
    // nothing to free
  }
}

const salvoComoItem = (i: TradeImage): ItemAnexo => ({ kind: 'saved', key: `s-${i.id}`, id: i.id, name: i.name, bytes: i.bytes, path: i.path })

/** When the images and the note were last saved (the summary's «às 10:41») */
function salvoEm(view: TradeView): Date | null {
  const times = view.images.map((i) => i.savedAt).concat(view.trade.note ? [view.trade.noteSavedAt] : [])
  let out: Date | null = null
  for (const t of times) if (t && (!out || t.getTime() > out.getTime())) out = t
  return out
}

/**
 * «Imagens e nota» (RO l.517–544, 1348–1552; contract §4.7): the editor's state and its save. The
 * saved images and note are the trade's (TradeView); what is chosen or typed here stays until
 * «Salvar imagens e nota», or goes with «Registrar outra» / «Ver no Diário» (salvarPendente).
 */
export function useAnexos(conta: ContaReg, view: TradeView) {
  const save = useSaveImagesAndNote()
  const salvos = view.images
  const notaSalva = view.trade.note ?? ''
  const temSalvo = salvos.length > 0 || !!notaSalva
  const [editando, setEditando] = useState(false)
  const [lista, setLista] = useState<ItemAnexo[]>([])
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState<{ texto: string; n: number } | null>(null)
  const [aviso, setAviso] = useState('')
  const [st, setSt] = useState('')
  const [progresso, setProgresso] = useState<SaveProgress | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [quando, setQuando] = useState<Date | null>(null)
  const ocupadoRef = useRef(false)
  const urls = useRef<Set<string>>(new Set())
  const [foco, setFoco] = useState<{ alvo: string; n: number } | null>(null)

  useEffect(() => {
    const all = urls.current
    return () => {
      all.forEach((u) => soltarPrevia(u))
      all.clear()
    }
  }, [])
  useEffect(() => {
    if (foco) document.getElementById(foco.alvo)?.focus()
  }, [foco])
  const focar = (alvo: string) => setFoco((f) => ({ alvo, n: (f?.n ?? 0) + 1 }))

  const resumo = temSalvo && !editando
  const vazio = lista.length === 0 && !nota.trim()
  const podeSalvar = !vazio || (editando && temSalvo)
  const cheio = lista.length >= MAX_IMAGES

  const comErro = (texto: string) => setErro((e) => (texto ? { texto, n: (e?.n ?? 0) + 1 } : null))

  /** The files chosen, dropped or pasted, in their order; refused ones are named (RO `incluir`) */
  const incluir = useCallback(
    (files: File[], base?: ItemAnexo[]) => {
      const cur = (base ?? lista).slice()
      const porErro: Record<'tipo' | 'tam' | 'n', string[]> = { tipo: [], tam: [], n: [] }
      const ordem: ('tipo' | 'tam' | 'n')[] = []
      let novos = 0
      for (const f of files) {
        const mime = imageMimeOf(f)
        const k = !mime ? 'tipo' : f.size > MAX_IMAGE_BYTES ? 'tam' : cur.length >= MAX_IMAGES ? 'n' : null
        if (k) {
          if (!porErro[k].length) ordem.push(k)
          porErro[k].push(f.name || 'imagem')
          continue
        }
        const name = uniqueImageName(f.name || 'imagem', cur.map((i) => i.name))
        const url = previa(f)
        if (url) urls.current.add(url)
        cur.push({ kind: 'new', key: `n-${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, name, bytes: f.size, mime: mime as ImageMime, url })
        novos += 1
      }
      setLista(cur)
      setSt('')
      setAviso(novos ? ANEXOS.adicionadas(novos, cur.length) : '')
      const varios = files.length > 1
      const textos = ordem.map((k) => {
        const nomes = porErro[k]
        if (!varios) return k === 'tipo' ? ANEXOS.erroTipo : k === 'tam' ? ANEXOS.erroTamanho : ANEXOS.erroQuantas
        const l = nomes.join(', ')
        const uma = nomes.length === 1
        return k === 'tam' ? ANEXOS.erroTamanhoVarias(l, uma) : k === 'tipo' ? ANEXOS.erroTipoVarias(l, uma) : ANEXOS.erroQuantasVarias(l, uma)
      })
      comErro(textos.join(' '))
    },
    [lista],
  )

  const editar = () => {
    setEditando(true)
    setLista(salvos.map(salvoComoItem))
    setNota(notaSalva)
    setErro(null)
    setAviso('')
    setSt('')
    focar('f-escolher')
  }

  const remover = (key: string) => {
    const k = lista.findIndex((i) => i.key === key)
    if (k < 0) return
    const item = lista[k]
    if (item.kind === 'new') {
      soltarPrevia(item.url)
      if (item.url) urls.current.delete(item.url)
    }
    const nova = lista.filter((i) => i.key !== key)
    setLista(nova)
    setErro(null)
    setSt('')
    setAviso(ANEXOS.removida(item.name, nova.length))
    const prox = nova[k] ?? nova[k - 1]
    focar(prox ? `rm-${prox.key}` : 'f-escolher')
  }

  const cancelar = () => {
    setEditando(false)
    setLista([])
    setNota('')
    setErro(null)
    setAviso('')
    setSt('')
    focar('f-editar-anx')
  }

  /** «Salvar imagens e nota»; the result says what was saved (for «Operação anterior: …») */
  const salvar = async (): Promise<{ ok: boolean; quem: string | null; hora: string | null }> => {
    if (!podeSalvar) return { ok: true, quem: null, hora: null }
    if (ocupadoRef.current) return { ok: false, quem: null, hora: null }
    ocupadoRef.current = true
    setOcupado(true)
    setErro(null)
    setSt('')
    const antes = { n: salvos.length, nota: !!notaSalva }
    const items: ImageItem[] = lista.map((i) =>
      i.kind === 'saved' ? { kind: 'saved', id: i.id } : { kind: 'new', key: i.key, file: i.file, name: i.name, mime: i.mime },
    )
    const texto = nota.trim()
    try {
      const res = await save.mutateAsync({ tradeId: view.trade.id, input: { items, note: texto ? texto : null }, onProgress: setProgresso })
      const quandoTxt = hora(conta, res.savedAt)
      setQuando(res.savedAt)
      if (vazio) {
        setEditando(false)
        setLista([])
        setNota('')
        setSt(ANEXOS.removido(antes.n, antes.nota, quandoTxt))
        focar('f-escolher')
        return { ok: true, quem: null, hora: null }
      }
      if (res.failed.length > 0) {
        // The failed ones stay (only they are sent again with the next save)
        const falhas = new Set(res.failed.map((f) => f.key))
        setLista([...res.state.images.map(salvoComoItem), ...lista.filter((i) => i.kind === 'new' && falhas.has(i.key))])
        setNota(res.state.trade.note ?? '')
        setEditando(true)
        comErro(res.failed.map((f) => ANEXOS.naoEnviou(f.name)).join(' '))
        return { ok: false, quem: null, hora: null }
      }
      lista.forEach((i) => {
        if (i.kind === 'new' && i.url) {
          soltarPrevia(i.url)
          urls.current.delete(i.url)
        }
      })
      const n = res.state.images.length
      setEditando(false)
      setLista([])
      setNota('')
      focar('f-editar-anx')
      return { ok: true, quem: ANEXOS.quem(n, !!res.state.trade.note), hora: quandoTxt }
    } catch (e) {
      const code = e instanceof RegistrarDataError ? e.code : 'unknown'
      comErro(code === 'offline' ? ANEXOS.offline : ERRO_REGISTRAR[code])
      return { ok: false, quem: null, hora: null }
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
      setProgresso(null)
    }
  }

  /**
   * What is in the editor and not saved (an emptied editor is never pending: leaving never removes
   * saved data; an editor equal to the saved data is not pending; C12)
   */
  const pendente = (() => {
    if (resumo) return false
    if (lista.length === 0 && !nota.trim()) return false
    if (temSalvo && nota.trim() === notaSalva && lista.length === salvos.length && lista.every((i, k) => i.kind === 'saved' && i.id === salvos[k].id)) return false
    return true
  })()

  /** «Registrar outra» / «Ver no Diário»: the pending images and note go first; null aviso when nothing was pending */
  const salvarPendente = async (): Promise<{ ok: boolean; anterior: string | null }> => {
    if (!pendente) return { ok: true, anterior: null }
    const r = await salvar()
    if (!r.ok) return { ok: false, anterior: null }
    return { ok: true, anterior: r.quem && r.hora ? ENTRADA.anterior(r.quem.replace(/^N/, 'n'), r.hora) : null }
  }

  const quandoSalvo = quando ?? salvoEm(view)
  const statusSalvo = resumo
    ? ANEXOS.salvo(ANEXOS.quem(salvos.length, !!notaSalva), quandoSalvo ? hora(conta, quandoSalvo) : '', salvos.length > 1 || (salvos.length > 0 && !!notaSalva))
    : st

  return {
    resumo,
    editando,
    lista,
    nota,
    setNota: (v: string) => {
      setNota(v.slice(0, MAX_NOTA))
      setSt('')
    },
    erro,
    aviso,
    status: statusSalvo,
    progresso,
    ocupado,
    podeSalvar,
    cheio,
    temSalvo,
    salvos,
    notaSalva,
    pendente,
    incluir,
    editar,
    remover,
    cancelar,
    salvar,
    salvarPendente,
    erroCheio: () => comErro(ANEXOS.erroQuantas),
  }
}

export type Anexos = ReturnType<typeof useAnexos>

/** A saved image's thumbnail: a signed URL (10 minutes, D33), read when shown */
function MiniaturaSalva({ path, name }: { path: string; name: string }) {
  const { db, userId } = useHubDb()
  const url = useQuery({
    queryKey: ['hub', userId, 'registrar', 'imagem', path],
    queryFn: () => signedImageUrl(db, path),
    enabled: !!userId,
    staleTime: 9 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  })
  // eslint-disable-next-line @next/next/no-img-element -- a signed Storage URL (10 min): next/image cannot optimize it
  if (url.data) return <img className="hub-reg-mini-img hub-reg-mini-img--res" src={url.data} alt={name} width={72} height={48} />
  return (
    <span className="hub-reg-mini-img hub-reg-mini-img--res hub-reg-mini-vazia" role="img" aria-label={name}>
      {ANEXOS.semPrevia}
    </span>
  )
}

/** The block (presentational over useAnexos) */
export default function ImagensENota({ a }: { a: Anexos }) {
  const [info, alternarInfo] = useToggle()
  const [sobre, setSobre] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [toque] = useState(soToque)
  const [atalho] = useState(atalhoColar)
  const temArquivos = (event: React.DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
  const dica = a.cheio ? ANEXOS.cheio : toque ? ANEXOS.dicaToque : ANEXOS.dica(atalho)

  return (
    <div
      className={sobre ? 'hub-bloco hub-reg-sobre' : 'hub-bloco'}
      role="group"
      aria-labelledby="l-anx"
      onDragEnter={(event) => {
        if (!temArquivos(event)) return
        event.preventDefault()
        setSobre(true)
      }}
      onDragOver={(event) => {
        if (!temArquivos(event)) return
        event.preventDefault()
        try {
          event.dataTransfer.dropEffect = 'copy'
        } catch {
          // only the cursor
        }
        if (!sobre) setSobre(true)
      }}
      onDragLeave={(event) => {
        const rt = event.relatedTarget as Node | null
        if (rt && event.currentTarget.contains(rt)) return
        setSobre(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setSobre(false)
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (!files.length) return
        if (a.resumo) {
          a.editar()
          a.incluir(files, a.salvos.map(salvoComoItem))
        } else a.incluir(files)
      }}
    >
      <div className="hub-reg-cab">
        <span id="l-anx" className="hub-rotulo">
          {ANEXOS.titulo}
        </span>
        <InfoButton panelId="info-anx" label={ANEXOS.infoAria} open={info} onToggle={alternarInfo} />
      </div>
      {info && <InfoPanel id="info-anx">{ANEXOS.info}</InfoPanel>}
      <p className={a.status ? 'hub-reg-st' : 'sr-only'} role="status">
        {a.status}
      </p>
      <div className="sr-only" aria-live="polite">
        {a.aviso}
      </div>
      {a.resumo ? (
        <>
          {a.salvos.length > 0 && (
            <ul className="hub-reg-minis-res" aria-label={ANEXOS.salvas}>
              {a.salvos.map((i) => (
                <li key={i.id}>
                  <MiniaturaSalva path={i.path} name={i.name} />
                </li>
              ))}
            </ul>
          )}
          {a.notaSalva && <p className="hub-reg-nota-res">{a.notaSalva}</p>}
          <button id="f-editar-anx" type="button" className="hub-btn hub-reg-auto" aria-label={ANEXOS.editarAria} onClick={a.editar}>
            {ANEXOS.editar}
          </button>
        </>
      ) : (
        <>
          <div
            className={sobre ? 'hub-reg-zona hub-reg-sobre' : 'hub-reg-zona'}
            tabIndex={0}
            role="group"
            aria-labelledby="l-img"
            aria-describedby={a.erro ? 'n-img e-img' : 'n-img'}
            onPaste={(event) => {
              const cd = event.clipboardData
              if (!cd) return
              let files = Array.from(cd.files ?? [])
              if (!files.length && cd.items) files = Array.from(cd.items).filter((it) => it.kind === 'file').map((it) => it.getAsFile()).filter((f): f is File => !!f)
              if (!files.length) return
              event.preventDefault()
              a.incluir(files)
            }}
          >
            <span id="l-img" className="hub-rot-campo">
              {ANEXOS.imagens} <span className="hub-opc">{ANEXOS.opcional}</span>
            </span>
            <span id="n-img" className="hub-nota">
              {dica}
            </span>
            <button
              id="f-escolher"
              type="button"
              className="hub-btn"
              aria-disabled={a.cheio || undefined}
              aria-describedby="n-img"
              onClick={() => (a.cheio ? a.erroCheio() : inputRef.current?.click())}
            >
              {ANEXOS.escolher}
            </button>
            <input
              ref={inputRef}
              id="f-img"
              className="sr-only"
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              tabIndex={-1}
              aria-hidden="true"
              aria-label={ANEXOS.escolher}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                try {
                  event.target.value = ''
                } catch {
                  // the same file can be chosen again
                }
                if (files.length) a.incluir(files)
              }}
            />
          </div>
          {/* A new node for each error, so a repeated text is announced again */}
          {a.erro && (
            <span key={a.erro.n} id="e-img" className="hub-erro hub-reg-erro" role="alert">
              {a.erro.texto}
            </span>
          )}
          {a.lista.length > 0 && (
            <ul className="hub-reg-minis" aria-label={ANEXOS.anexadas}>
              {a.lista.map((i) => (
                <li key={i.key} className="hub-reg-mini">
                  {i.kind === 'new' && i.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a blob: preview of a file not sent yet
                    <img className="hub-reg-mini-img" src={i.url} alt={i.name} width={120} height={80} />
                  ) : i.kind === 'saved' ? (
                    <MiniaturaSalva path={i.path} name={i.name} />
                  ) : (
                    <span className="hub-reg-mini-img hub-reg-mini-vazia" role="img" aria-label={i.name}>
                      {ANEXOS.semPrevia}
                    </span>
                  )}
                  <span className="hub-reg-mini-nome">{i.name.replace(/_/g, '_​')}</span>
                  <span className="hub-reg-mini-info">{i.bytes !== null ? formatImageSize(i.bytes) : ''}</span>
                  <button id={`rm-${i.key}`} type="button" className="hub-btn" aria-label={ANEXOS.removerAria(i.name)} onClick={() => a.remover(i.key)}>
                    {ANEXOS.remover}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="hub-campo">
            <label htmlFor="f-nota" className="hub-rot-campo">
              {ANEXOS.nota} <span className="hub-opc">{ANEXOS.opcional}</span>
            </label>
            <textarea
              id="f-nota"
              className="hub-reg-area"
              rows={3}
              maxLength={MAX_NOTA}
              placeholder={ANEXOS.notaPh}
              aria-describedby="c-nota"
              value={a.nota}
              onChange={(event) => a.setNota(event.target.value)}
            />
            <span id="c-nota" className="hub-nota hub-reg-contador" aria-live="polite">
              {ANEXOS.contador(a.nota.length)}
            </span>
          </div>
          <div className="hub-acoes">
            <button type="button" className="hub-btn" aria-disabled={!a.podeSalvar || a.ocupado || undefined} onClick={() => void a.salvar()}>
              {ANEXOS.salvar}
            </button>
            {a.editando && a.temSalvo && (
              <button type="button" className="hub-btn" onClick={a.cancelar}>
                {ANEXOS.cancelar}
              </button>
            )}
          </div>
          <p className={a.progresso ? 'hub-nota' : 'sr-only'} role="status">
            {a.progresso ? ANEXOS.enviando(a.progresso.sending, a.progresso.total) : ''}
          </p>
        </>
      )}
    </div>
  )
}

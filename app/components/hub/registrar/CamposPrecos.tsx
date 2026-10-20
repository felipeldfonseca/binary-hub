'use client'

import type { RegistrarDefaults } from '@/lib/hub/registrar'
import {
  alternarVsv,
  escolherAtivo,
  mudarCotacao,
  mudarTipoEua,
  mudarVencimento,
  type CampoEntrada,
  type ContaReg,
  type ModeloEntrada,
  type Rascunho,
} from '@/lib/hub/registrarForm'
import BlocoOpcao from './BlocoOpcao'
import BuscaAtivo, { focarAtivoEscolhido } from './BuscaAtivo'
import CotadaEm from './CotadaEm'
import { FUTUROS } from './copy'
import OQueOperou from './OQueOperou'
import { CampoTexto, Erro, GrupoPills, descrito } from './ui'
import VenceuSemValor from './VenceuSemValor'

export interface CamposPrecosProps {
  conta: ContaReg
  r: Rascunho
  m: ModeloEntrada
  /** Errors on screen (local, or the server's refusal of a field) */
  erros: Partial<Record<CampoEntrada, string>>
  /** A patch of the draft (a whole draft from registrarForm's transitions), and where the focus goes */
  mudar: (patch: Partial<Rascunho>, foco?: string) => void
  /** «Se o stop for atingido, o dia passa do limite…» */
  aviso: string | null
  /** The account's starting values (the chips, the last quantity of each kind) */
  padroes: RegistrarDefaults
}

/** The «Outro» pill of a quantity with chips */
const OUTRO = 'outro'

/** The option block's errors on screen: the local ones after a tap and a server refusal of one of its fields */
function errosDaOpcao(erros: Partial<Record<CampoEntrada, string>>): Partial<Record<'opTipo' | 'strike' | 'venc', string>> {
  const out: Partial<Record<'opTipo' | 'strike' | 'venc', string>> = {}
  for (const k of ['opTipo', 'strike', 'venc'] as const) if (erros[k]) out[k] = erros[k]
  return out
}

/**
 * Step 1's fields of every price market (RO l.334–388, 1079–1177; contract 3-4 §5.1): futures (3-3's
 * six chips, now with «Buscar ativo»), Forex, Ações e opções, Cripto and B3. In the board's order:
 * «O que você operou?» (lane B's OQueOperou), the instrument chips and the search, «Cotada em», the
 * option block (lane B's BlocoOpcao), «Lado», the quantity (chips + «Outro», or a field), «Preço de
 * entrada» | «Hora», in «Já fechada» «Venceu sem valor» (lane B's) and «Preço de saída» | «Hora da
 * saída», then «Stop e alvo, em pontos / pips / preço» or «do prêmio», the risk line, «Posição de …»
 * and the limit warning. Everything shown comes from registrarForm.modeloEntrada; the draft moves
 * through its transitions (escolherAtivo, mudarCotacao, mudarTipoEua, mudarVencimento, alternarVsv).
 */
export default function CamposPrecos({ conta, r, m, erros, mudar, aviso, padroes }: CamposPrecosProps) {
  const market = conta.market
  const fechada = r.modo === 'fechada'
  const q = m.quantidade
  const rot = m.rotulos

  /** A chip, a search result or «Usar»: the same instrument only empties the search */
  const escolher = (codigo: string, daBusca: boolean) => {
    const novo = escolherAtivo(r, market, codigo, padroes)
    if (novo.ativo !== r.ativo || novo.cotacao !== r.cotacao) mudar(novo)
    else if (daBusca) mudar({ busca: '' })
    if (daBusca) focarAtivoEscolhido()
  }

  return (
    <>
      {m.tipoEua && (
        <OQueOperou
          valor={m.tipoEua.valor}
          aoMudar={(t) => {
            if (t !== r.tipoEua) mudar(mudarTipoEua(r, t, padroes))
          }}
        />
      )}
      {m.ativo && <BuscaAtivo m={m.ativo} aoEscolher={escolher} aoBuscar={(v) => mudar({ busca: v })} />}
      {m.cotacao && (
        <CotadaEm
          m={m.cotacao}
          aoMudar={(c) => {
            if (c !== r.cotacao) mudar(mudarCotacao(r, c))
          }}
        />
      )}
      {m.opcao && (
        <BlocoOpcao
          m={{ ...m.opcao, erros: errosDaOpcao(erros) }}
          aoMudar={(patch) => mudar('vencimento' in patch ? { ...mudarVencimento(r, patch.vencimento ?? null), ...patch } : patch)}
        />
      )}
      <GrupoPills
        id="lado"
        titulo={FUTUROS.lado}
        opcoes={[
          { valor: 'long', rotulo: FUTUROS.compra },
          { valor: 'short', rotulo: FUTUROS.venda },
        ]}
        valor={r.lado}
        aoEscolher={(v) => mudar({ lado: v as 'long' | 'short' })}
        descricao={erros.lado ? 'e-lado' : undefined}
        depois={<Erro id="e-lado" texto={erros.lado} />}
      />
      {q &&
        (q.chips ? (
          <GrupoPills
            id="q"
            titulo={q.rotulo}
            opcoes={[...q.chips.map((c) => ({ valor: c.valor, rotulo: c.rotulo })), { valor: OUTRO, rotulo: FUTUROS.outro }]}
            pillClasse="hub-reg-pill-q"
            valor={q.outro ? OUTRO : q.chips.find((c) => c.selecionado)?.valor ?? null}
            aoEscolher={(v) => (v === OUTRO ? mudar({ qtdOutro: true, qtd: r.qtdOutro ? r.qtd : '' }, 'f-q') : mudar({ qtdOutro: false, qtd: v }))}
            depois={
              <>
                {q.outro && (
                  <CampoTexto
                    id="f-q"
                    rotulo={q.outroRotulo ?? q.rotulo}
                    valor={q.valor}
                    decimal
                    classe="hub-reg-curto"
                    aoMudar={(v) => mudar({ qtd: v })}
                    erro={erros.q}
                  />
                )}
                {!q.outro && <Erro id="e-q" texto={erros.q} />}
              </>
            }
          />
        ) : (
          <CampoTexto
            id="f-q"
            rotulo={q.rotulo}
            valor={q.valor}
            decimal
            classe="hub-reg-curto"
            notaTexto={q.nota}
            aoMudar={(v) => mudar({ qtd: v })}
            erro={erros.q}
          />
        ))}
      <div className="hub-campos2">
        <CampoTexto id="f-preco" rotulo={rot?.preco} valor={r.preco} decimal aoMudar={(v) => mudar({ preco: v })} erro={erros.preco} />
        <CampoTexto id="f-hora" rotulo={rot?.hora} valor={m.horaCampo} tipo="time" aoMudar={(v) => mudar({ hora: v })} erro={erros.hora} />
      </div>
      {fechada && (
        <>
          {m.vsv && (
            <VenceuSemValor
              estado={m.vsv}
              aoAlternar={() => {
                if (m.vsv?.disponivel) mudar(alternarVsv(r))
              }}
            />
          )}
          <div className="hub-campos2">
            <CampoTexto id="f-spreco" rotulo={rot?.precoSaida} valor={m.precoSaidaCampo} decimal aoMudar={(v) => mudar({ precoSaida: v })} erro={erros.spreco} />
            <CampoTexto id="f-shora" rotulo={rot?.horaSaida} valor={m.horaSaidaCampo} tipo="time" aoMudar={(v) => mudar({ horaSaida: v })} erro={erros.shora} />
          </div>
        </>
      )}
      <div className="hub-campo">
        <span id="l-stop" className="hub-rot-campo">
          {rot?.stopAlvo} <span className="hub-opc">{FUTUROS.opcional}</span>
        </span>
        <div className="hub-campos2 hub-reg-sempre" role="group" aria-labelledby="l-stop">
          <CampoTexto
            id="f-stop"
            rotulo={FUTUROS.stop}
            valor={r.stop}
            decimal
            aoMudar={(v) => mudar({ stop: v })}
            erro={erros.stop}
            nota={descrito('n-risco', aviso && 'a-lim')}
          />
          <CampoTexto id="f-alvo" rotulo={FUTUROS.alvo} valor={r.alvo} decimal aoMudar={(v) => mudar({ alvo: v })} erro={erros.alvo} nota="n-risco" />
        </div>
        <span id="n-risco" className="hub-nota hub-num">
          {m.linhaRisco}
        </span>
        {m.linhaPosicao && (
          <span id="n-pos" className="hub-nota hub-num">
            {m.linhaPosicao}
          </span>
        )}
        {/* Always on the page, so a screen reader hears it when it appears and when it changes (v55) */}
        <p id="a-lim" role="status" className={aviso ? 'hub-reg-aviso-lim' : 'sr-only'}>
          {aviso ?? ''}
        </p>
      </div>
    </>
  )
}

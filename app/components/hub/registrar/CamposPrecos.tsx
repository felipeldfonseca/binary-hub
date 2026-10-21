'use client'

import type { Rules } from '@/lib/domain/gate'
import type { RegistrarDefaults } from '@/lib/hub/registrar'
import {
  alternarVsv,
  escolherAtivo,
  mudarCotacao,
  mudarTipoEua,
  mudarVencimento,
  type CampoEntrada,
  type ContaReg,
  type Rascunho,
} from '@/lib/hub/registrarForm'
import { linhaRegra, regraDoAtivo } from '@/lib/hub/registrarRegra'
import { mudarSaida, outraSaida, removerSaida, type ModeloSaidas } from '@/lib/hub/registrarSaidas'
import BlocoOpcao from './BlocoOpcao'
import BuscaAtivo, { focarAtivoEscolhido } from './BuscaAtivo'
import CotadaEm from './CotadaEm'
import { FUTUROS } from './copy'
import MoviBreakeven from './MoviBreakeven'
import OQueOperou from './OQueOperou'
import SaidasJaFechada from './SaidasJaFechada'
import { CampoTexto, Erro, GrupoPills, descrito } from './ui'
import VenceuSemValor from './VenceuSemValor'

export interface CamposPrecosProps {
  conta: ContaReg
  r: Rascunho
  /** modeloEntrada's answer with «Já fechada»'s rows and pill (registrarSaidas.comSaidas) */
  m: ModeloSaidas
  /**
   * 3c: the account's current rules (rules_now's version), for «Sua regra: breakeven com +8 pts,
   * em 7.920,50.» under the risk line in «Aberta» (E1); null while unknown
   */
  rules: Rules | null
  /** Errors on screen (local, or the server's refusal of a field) */
  erros: Partial<Record<CampoEntrada, string>>
  /** A patch of the draft (a whole draft from registrarForm's transitions), and where the focus goes */
  mudar: (patch: Partial<Rascunho>, foco?: string) => void
  /** «Se o stop for atingido, o dia passa do limite…» */
  aviso: string | null
  /** The account's starting values (the chips, the last quantity of each kind) */
  padroes: RegistrarDefaults
  /**
   * Another instrument, quote or kind replaced the draft (RO `limpar`: `tentou: {}`): the errors a tap
   * of «Registrar» turned on go quiet again, so the fields just cleared are not announced as wrong
   */
  aoRecomecar: () => void
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
 *
 * Phase 3c (contract §6.2–6.4): in «Aberta», «Sua regra: breakeven com …» after the risk line (E1,
 * `#n-regra`, a plain note); in «Já fechada», «+ Outra saída» and the rows in place of the single
 * exit (SaidasJaFechada, E2–E6), and after the limit warning «Movi o stop para o breakeven» (E10–E11,
 * only with a valid stop), from registrarSaidas.comSaidas's model.
 */
export default function CamposPrecos({ conta, r, m, rules, erros, mudar, aviso, padroes, aoRecomecar }: CamposPrecosProps) {
  const market = conta.market
  const fechada = r.modo === 'fechada'
  const q = m.quantidade
  const rot = m.rotulos
  // E1: the rule of the account's current version for the chosen asset (its price once the side and
  // a valid entry price are known), «Aberta» only
  const regra =
    !fechada && m.forma
      ? regraDoAtivo(rules, m.forma.simbolo, { option: m.forma.tipo === 'opcao', direction: r.lado, entryPrice: m.lidos?.preco ?? null })
      : null

  /** A chip, a search result or «Usar»: the same instrument only empties the search */
  const escolher = (codigo: string, daBusca: boolean) => {
    const novo = escolherAtivo(r, market, codigo, padroes)
    if (novo.ativo !== r.ativo || novo.cotacao !== r.cotacao) {
      aoRecomecar()
      mudar(novo)
    } else if (daBusca) mudar({ busca: '' })
    if (daBusca) focarAtivoEscolhido()
  }

  return (
    <>
      {m.tipoEua && (
        <OQueOperou
          valor={m.tipoEua.valor}
          aoMudar={(t) => {
            if (t !== r.tipoEua) {
              aoRecomecar()
              mudar(mudarTipoEua(r, t, padroes))
            }
          }}
        />
      )}
      {m.ativo && <BuscaAtivo m={m.ativo} aoEscolher={escolher} aoBuscar={(v) => mudar({ busca: v })} />}
      {m.cotacao && (
        <CotadaEm
          m={m.cotacao}
          aoMudar={(c) => {
            // The pill pressed on screen (none on ETH/BTC, whose quote is none of them)
            if (c !== m.cotacao?.valor) {
              aoRecomecar()
              mudar(mudarCotacao(r, c))
            }
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
          {!m.saidas && (
            <div className="hub-campos2">
              <CampoTexto id="f-spreco" rotulo={rot?.precoSaida} valor={m.precoSaidaCampo} decimal aoMudar={(v) => mudar({ precoSaida: v })} erro={erros.spreco} />
              <CampoTexto id="f-shora" rotulo={rot?.horaSaida} valor={m.horaSaidaCampo} tipo="time" aoMudar={(v) => mudar({ horaSaida: v })} erro={erros.shora} />
            </div>
          )}
          <SaidasJaFechada
            m={m}
            rotulos={rot}
            aoOutra={() => {
              const x = outraSaida(r)
              if (x) mudar(x.r, x.foco)
            }}
            aoRemover={(id) => {
              const x = removerSaida(r, id)
              mudar(x.r, x.foco)
            }}
            aoMudar={(id, campo, valor) => mudar(mudarSaida(r, id, campo, valor))}
          />
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
        {regra && (
          <span id="n-regra" className="hub-nota">
            {linhaRegra(m.forma, regra)}
          </span>
        )}
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
      {m.be && (
        <MoviBreakeven
          be={{ ...m.be, erro: erros.bePreco ?? null }}
          aoAlternar={() => mudar({ be: !r.be }, r.be ? undefined : 'f-bePreco')}
          aoMudar={(v) => mudar({ bePreco: v })}
        />
      )}
    </>
  )
}

/**
 * @jest-environment node
 *
 * The shared market copy of Fase 2b (components/hub/copyMercados.ts) and the frozen exports the
 * foundation sets from it in the lanes' copy files.
 */
import { ACCOUNT_MARKETS, CREATABLE_MARKETS, MARKET_SPEC } from '@/lib/domain/markets'
import { MERCADO, USDT_COMO_DOLAR, viraODia } from '@/components/hub/copyMercados'
import { MARKET_LABEL, NEVER_SUMMED, PASSO_B } from '@/components/hub/contas/copy'
import { HOJE, JANELAS, MERCADO_NOME, REGRAS, SEP, VERSAO } from '@/components/hub/personalizar/copy'
import { captionJanela } from '@/lib/hub/janelas'
import { descricaoJanelas, resumoEstados } from '@/lib/hub/comoFicaHoje'

const NBSP = '\u00a0'

describe('MERCADO', () => {
  it('names the six creatable markets as the boards do, in their order', () => {
    expect(CREATABLE_MARKETS.map((m) => MERCADO[m].pill)).toEqual([
      'Futuros (EUA)',
      'Opções binárias',
      'Forex e CFDs',
      'Ações e opções (EUA)',
      'Cripto',
      'B3',
    ])
    expect(ACCOUNT_MARKETS.map((m) => MERCADO[m].nome)).toEqual(['Futuros', 'Opções binárias', 'Forex', 'Ações', 'Cripto', 'B3', 'Opções'])
    expect(ACCOUNT_MARKETS.map((m) => MERCADO[m].de)).toEqual([
      'de Futuros',
      'de Opções binárias',
      'de Forex',
      'de Ações',
      'de Cripto',
      'da B3',
      'de Opções',
    ])
    expect(ACCOUNT_MARKETS.map((m) => MERCADO[m].deCurto)).toEqual(['de Futuros', 'de Binárias', 'de Forex', 'de Ações', 'de Cripto', 'da B3', 'de Opções'])
    expect(ACCOUNT_MARKETS.map((m) => MERCADO[m].nas)).toEqual([
      'Nas contas de Futuros',
      'Nas contas de binárias',
      'Nas contas de Forex',
      'Nas contas de Ações',
      'Nas contas de Cripto',
      'Nas contas da B3',
      'Nas contas de Opções',
    ])
    expect(ACCOUNT_MARKETS.map((m) => MERCADO[m].titulo)).toEqual([
      'Nova conta de futuros',
      'Nova conta de binárias',
      'Nova conta de forex',
      'Nova conta de ações',
      'Nova conta de cripto',
      'Nova conta da B3',
      'Nova conta de opções',
    ])
    expect(USDT_COMO_DOLAR).toBe('USDT e USDC contam como dólar.')
  })

  it('says when each market’s day turns', () => {
    expect(ACCOUNT_MARKETS.map((m) => viraODia(MARKET_SPEC[m].day))).toEqual([
      'às 18:00 ET',
      'à meia-noite de Brasília',
      'às 17:00 ET',
      'às 20:00 ET',
      'à meia-noite de Brasília',
      'à meia-noite de Brasília',
      'às 20:00 ET',
    ])
    // An account's own clock can differ (a Phase 1 backfill kept midnight in Brasília)
    expect(viraODia({ tz: 'America/Sao_Paulo', startMin: 1260 })).toBe('às 21:00 de Brasília')
    expect(viraODia({ tz: 'America/New_York', startMin: 0 })).toBe('à meia-noite ET')
    expect(viraODia({ tz: 'Europe/London', startMin: 480 })).toBe('às 08:00 (Europe/London)')
  })
})

describe('the frozen exports set from it', () => {
  it('keeps the Phase 1 and 2 names and adds the new markets', () => {
    expect(MARKET_LABEL).toEqual({
      futures: 'Futuros',
      binary: 'Opções binárias',
      forex: 'Forex',
      stocks: 'Ações',
      crypto: 'Cripto',
      b3: 'B3',
      options: 'Opções',
    })
    expect(MERCADO_NOME).toEqual(MARKET_LABEL)
    expect(NEVER_SUMMED).toBe('Contas de mercados diferentes nunca são somadas.')
    expect(PASSO_B.title('futures')).toBe('Nova conta de futuros')
    expect(PASSO_B.title('binary')).toBe('Nova conta de binárias')
    expect(PASSO_B.title('b3')).toBe('Nova conta da B3')
  })

  it('writes the window labels with the market’s «de» form (Phase 2 texts unchanged)', () => {
    expect(JANELAS.grupoAria('futures')).toBe('Janela de Futuros')
    expect(JANELAS.grupoAria('binary')).toBe('Janela de Opções binárias')
    expect(JANELAS.grupoAria('b3')).toBe('Janela da B3')
    expect(JANELAS.inicioAria('futures', false, 'horário de Nova York')).toBe('Início da janela de Futuros, horário de Nova York')
    expect(JANELAS.fimAria('crypto', true, 'horário de Brasília')).toBe('Fim da segunda janela de Cripto, horário de Brasília')
    expect(JANELAS.cancelarAria('b3')).toBe('Cancelar a janela nova da B3')
    expect(JANELAS.maisAria('forex')).toBe('Relógio, dias e segunda janela de Forex')
    expect(JANELAS.segundaAria('stocks')).toBe('Segunda janela de Ações')
    expect(JANELAS.removerAria('b3')).toBe('Remover a segunda janela da B3')
    expect(JANELAS.contasAria('b3')).toBe('Contas da B3')
  })

  // The creation form's words (REGRAS_CONTA, copyRegras.ts) are lane A's, not frozen: they are
  // tested in __tests__/lib/hubRegrasConta.test.ts, which lane A owns.

  it('says the limit’s maximum in the account’s currency', () => {
    expect(REGRAS.limiteErro('too_large', 'USD')).toBe(`Use um valor até US$${NBSP}1.000.000.`)
    expect(REGRAS.limiteErro('too_large', 'BRL')).toBe(`Use um valor até R$${NBSP}1.000.000.`)
    expect(REGRAS.limiteErro('empty', 'BRL')).toBe('Digite um valor maior que zero.')
    expect(REGRAS.limiteErro('not_positive', 'USD')).toBe('Digite um valor maior que zero.')
    expect(REGRAS.limiteErro('invalid', 'USD')).toBe('Use só números, como 400 ou 400,50.')
  })
})

describe('« · » never starts or ends a line', () => {
  /** Every « · » has a no-break space on each side: the line breaks at another space */
  const colado = (texto: string) => {
    expect(texto).toContain('·')
    expect(texto).not.toMatch(/(^|[^\u00a0])·|·([^\u00a0]|$)/)
  }
  const segSex = { tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: 31 } as const

  it('SEP is « · » between two no-break spaces', () => {
    expect(SEP).toBe('\u00a0·\u00a0')
  })

  it('in the frozen captions and texts: window captions, version notes, «Histórico importado · só resultado», «Como fica hoje»', () => {
    // «11:00–12:00 em Brasília · seg–sex», and with the new time from 1º nov
    colado(captionJanela(segSex, new Date('2026-10-14T16:00:00Z')))
    colado(captionJanela(segSex, new Date('2026-10-19T16:00:00Z')))
    colado(descricaoJanelas([segSex, { ...segSex, startMin: 840, endMin: 900 }]))
    colado(resumoEstados({ alinhadas: 'so_a_favor', em_conflito: 'opero' }))
    colado(VERSAO.antes('17 out'))
    colado(VERSAO.ateSalvar)
    colado(HOJE.suaJanela)
    colado(HOJE.umaDasJanelas)
  })

  it('keeps the money symbol with the amount in the limit’s maximum', () => {
    expect(REGRAS.limiteErro('too_large', 'USD')).toContain('US$\u00a01.000.000')
    expect(REGRAS.limiteErro('too_large', 'BRL')).toContain('R$\u00a01.000.000')
  })
})

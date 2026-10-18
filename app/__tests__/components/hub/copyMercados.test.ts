/**
 * @jest-environment node
 *
 * The shared market copy of Fase 2b (components/hub/copyMercados.ts) and the frozen exports the
 * foundation sets from it in the lanes' copy files.
 */
import { ACCOUNT_MARKETS, CREATABLE_MARKETS, MARKET_SPEC } from '@/lib/domain/markets'
import { MERCADO, USDT_COMO_DOLAR, viraODia } from '@/components/hub/copyMercados'
import { MARKET_LABEL, NEVER_SUMMED, PASSO_B } from '@/components/hub/contas/copy'
import { REGRAS_CONTA } from '@/components/hub/contas/copyRegras'
import { JANELAS, MERCADO_NOME, REGRAS } from '@/components/hub/personalizar/copy'

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
    expect(REGRAS_CONTA.inicioMercadoAria('binary', 'America/Sao_Paulo')).toBe('Início da janela de Opções binárias, horário de Brasília')
    expect(REGRAS_CONTA.cancelarJanelaAria('futures')).toBe('Cancelar a janela nova de Futuros')
  })

  it('names the creation form’s market with its short form', () => {
    expect(REGRAS_CONTA.padraoDe('futures')).toBe('padrão de Futuros')
    expect(REGRAS_CONTA.padraoDe('binary')).toBe('padrão de Binárias')
    expect(REGRAS_CONTA.padraoDe('b3')).toBe('padrão da B3')
    expect(REGRAS_CONTA.pergunta('futures', ['10:00–11:00'], 'America/New_York')).toBe('Usar a janela de Futuros (10:00–11:00 ET)?')
    expect(REGRAS_CONTA.pergunta('b3', ['10:00–11:00'], 'America/Sao_Paulo')).toBe('Usar a janela da B3 (10:00–11:00 de Brasília)?')
    expect(REGRAS_CONTA.outrasContas('binary', '17 out', ['Pocket'])).toBe(
      'Ao criar, esta janela passa a ser a de Binárias: Pocket também ganha versão nova das regras desde 17 out.',
    )
  })

  it('says the limit’s maximum in the account’s currency', () => {
    expect(REGRAS.limiteErro('too_large', 'USD')).toBe('Use um valor até US$ 1.000.000.')
    expect(REGRAS.limiteErro('too_large', 'BRL')).toBe('Use um valor até R$ 1.000.000.')
    expect(REGRAS.limiteErro('empty', 'BRL')).toBe('Digite um valor maior que zero.')
    expect(REGRAS.limiteErro('not_positive', 'USD')).toBe('Digite um valor maior que zero.')
    expect(REGRAS.limiteErro('invalid', 'USD')).toBe('Use só números, como 400 ou 400,50.')
  })
})

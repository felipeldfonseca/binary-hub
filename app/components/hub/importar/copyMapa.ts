/**
 * Phase 3b · telas: the pt-BR strings of the column-mapping steps («mapa», «conferir», the model chip),
 * from the approved board ImportarConta (canvas version 67). Each string carries its marker:
 *   B  the board's exact copy (IC l.N = a line of ImportarConta.dc.html)
 *   A  adapted from the board (the comment says why)
 *   N  new: on no board (the comment says why)
 * B0 holds the keys both lanes use; lane L1 adds the rest (LER, REQ, NOTA_MAPA, CHECAGEM, PERGUNTA,
 * FIM_ARQUIVO, PAREAMENTO, LIQUIDO) and never renames a key or a CAMPO label (lane L2 imports them).
 */
import type { FieldKey } from '@/lib/domain/import'

export const MAPA = {
  /** B IC l.1485 */ titulo: 'Não reconhecemos este arquivo. Diga o que é cada coluna.',
  /** B IC l.1484 */ tituloMudou: (nome: string) => `Este arquivo mudou desde o modelo “${nome}”. Confira as colunas.`,
  /** B IC l.1485 */ tituloMudar: (nome: string) => `Mude as colunas do modelo “${nome}”.`,
}

export const CONFERIR = {
  /** B IC l.555 */ titulo: 'Confira 3 linhas',
  /** B IC l.1921 */ usar: 'Usar estas colunas',
}

export const DICA_MAPA = {
  /** B IC l.1477 */ ler: 'Confira como ler o arquivo.',
  /** B IC l.1478 */ datas: 'Escolha a ordem das datas.',
  /** N: a decimal question with nothing pressed (a «,» file) */ numeros: 'Escolha como ler os números.',
  /** B IC l.1479 */ obrigatorias: 'Marque as colunas obrigatórias.',
  /** B IC l.1480 */ umaColuna: 'Cada campo vai em uma coluna só.',
  /** B IC l.1481 */ marcadas: 'Confira as colunas marcadas.',
  /** B IC l.1482 */ lado: (valor: string) => `Diga o que quer dizer “${valor}”.`,
}

export const MODELO = {
  /** A (D1): the default name when the account's platform says nothing about the file */ nomePadrao: 'Minha plataforma',
}

export const CHIP_MODELO = {
  /** B IC l.1705 */ texto: (nome: string) => `Colunas do modelo “${nome}”`,
  /** B IC l.366 */ mudar: 'Mudar colunas',
}

/** B IC l.1155–1164 (`NV.CAMPOS`): the select's labels; also L2's «número inválido em {CAMPO[campo]}» (§3.3) */
export const CAMPO: Record<FieldKey, string> = {
  entry_time: 'Entrada (data e hora)',
  symbol: 'Ativo',
  side: 'Lado',
  quantity: 'Quantidade',
  pnl: 'Resultado',
  entry_price: 'Preço de entrada',
  exit_price: 'Preço de saída',
  exit_time: 'Saída (data e hora)',
  buy_time: 'Compra (data e hora)',
  sell_time: 'Venda (data e hora)',
  buy_price: 'Preço de compra',
  sell_price: 'Preço de venda',
  commission: 'Comissão',
  fee: 'Outra taxa (soma na comissão)',
  swap: 'Swap ou funding',
  stop: 'Stop',
  target: 'Alvo',
  trade_id: 'ID da operação (evita duplicar)',
  account: 'Conta',
  time: 'Data e hora',
  price: 'Preço',
  fill_id: 'ID da execução (evita duplicar)',
  order_id: 'ID da ordem',
  open_close: 'Abre ou fecha',
  realized: 'Resultado realizado',
}

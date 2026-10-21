/**
 * Phase 3c · lane C1: every pt-BR string of the open and closed trade with partials and stop moves
 * (step 2 «O que registrar agora?», «Parcial», «Mover stop», «Agora», «Linha do tempo», «Desfazer»,
 * the breakeven suggestion; step 3's average, R and breakeven line; the chooser's «… em aberto»).
 * Board: RegistrarOperacao.dc.html approved 21 Oct 2026 (16 scenarios); «B jsN» is its script line,
 * «BN» its markup line. Markers as the rest of the sheet's copy:
 *   B  the board's copy
 *   A  ADAPTED (the comment says what changed)
 *   N  NEW: not on the board (a state the board does not draw)
 * The board's prototype controls never appear here (a test checks it). The rule's own words are
 * copyRegra's (REGRA_BE, shared with step 1); the bridge's second line is diario/copy's.
 */
import type { RegistrarErrorCode } from '@/lib/hub/registrarDb'

/** «O que registrar agora?» and the footer's primary per mode (E19, E26, E23) */
export const ACOES = {
  grupo: 'O que registrar agora?', // B505
  saida: 'Saída', // B js1754
  parcial: 'Parcial', // B js1754
  stop: 'Mover stop', // B js1754
  registrarParcial: 'Registrar parcial', // B js2184
  registrarStop: 'Registrar stop', // B js2184
  /** «Sai com os 2 ct em aberto.» / «Sai com o 1 ct em aberto.» */
  saiCom: (q: string, um: boolean) => `Sai com ${um ? 'o' : 'os'} ${q} em aberto.`, // B js1761
  /** « · no total +US$ 175,00» appended to «Se sair a …» */
  noTotal: (v: string) => ` · no total ${v}`, // B js1554
  /** «A saída não pode ser antes da última parcial (10:18).» */
  saidaAntesParcial: (h: string) => `A saída não pode ser antes da última parcial (${h}).`, // B js1560
  /** Appended to the «Custos» note after partials */
  daOperacao: ' Da operação toda.', // B js1555
}

/** «Parcial» (E24) and its action status (E20) */
export const PARCIAL = {
  /** «Ficam 2 ct em aberto.» / «Fica 1 ct em aberto.» */
  ficam: (q: string, um: boolean) => `${um ? 'Fica' : 'Ficam'} ${q} em aberto.`, // B js1591
  /** «Em aberto: 3 ct.» (before a valid quantity) */
  emAberto: (q: string) => `Em aberto: ${q}.`, // B js1591
  metade: 'Metade', // B535
  preco: 'Preço da parcial', // B js1594
  premio: 'Prêmio da parcial, US$ por ação', // B js1594
  /** «Preço da parcial, USDT» */
  precoEm: (c: string) => `Preço da parcial, ${c}`, // B js1594
  /** «Hora da parcial (ET)» */
  hora: (suf: string) => `Hora da parcial${suf}`, // B js1595
  /** «Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00» */
  previa: (q: string, p: string, dif: string, v: string) => `Parcial de ${q} a ${p}: ${dif} · ${v}`, // B js1096
  informe: 'Resultado: informe o preço da parcial.', // B js1088
  informePremio: 'Resultado: informe o prêmio da parcial.', // B js1088
  /** «Resultado: confira o preço da parcial (o MES anda de 0,25 em 0,25).» */
  confiraPasso: (passo: string) => `Resultado: confira o preço da parcial (${passo}).`, // B js1089
  confira: 'Resultado: confira o preço da parcial.', // B js1089
  /** «Resultado desta parcial, US$» */
  campoDigitado: (m: string) => `Resultado desta parcial, ${m}`, // B js1115
  notaDigitado: (moeda: string, swap: string) =>
    `Pelos preços não dá para saber o valor em ${moeda}: digite o resultado desta parcial na sua plataforma, antes da comissão${swap}.`, // B js1116
  precoVazio: 'Informe o preço da parcial.', // B js1580
  premioVazio: 'Informe o prêmio da parcial.', // B js1580
  /** «Use menos que os 3 ct em aberto; para sair com tudo, use “Saída”.» */
  demais: (q: string) => `Use menos que os ${q} em aberto; para sair com tudo, use “Saída”.`, // B js1572
  /** «A parcial não pode ser antes da entrada (10:12).» */
  antes: (h: string) => `A parcial não pode ser antes da entrada (${h}).`, // B js1581
  /** «A parcial não pode ser depois de agora (10:20 ET).» */
  futura: (h: string) => `A parcial não pode ser depois de agora (${h}).`, // B js1581
  /** «Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.» */
  registrada: (q: string, p: string, h: string, ficam: string) => `Parcial registrada: ${q} a ${p} às ${h}. ${ficam}`, // B js1610
}

/** «Mover stop» (E25) and its action status (E20) */
export const STOP = {
  paraOnde: 'Para onde?', // B546
  /** «Breakeven · 7.912,50» */
  breakeven: (p: string) => `Breakeven · ${p}`, // B js1644
  outro: 'Outro preço', // B js1644
  novo: 'Novo stop', // B js1646
  novoPremio: 'Novo stop do prêmio', // B js1646
  /** «Novo stop, USDT» */
  novoEm: (c: string) => `Novo stop, ${c}`, // B js1646
  agora: 'Preço agora', // B js1648
  agoraPremio: 'Prêmio agora, US$ por ação', // B js1648
  /** «Preço agora, USDT» */
  agoraEm: (c: string) => `Preço agora, ${c}`, // B js1648
  /** «Se o novo stop for atingido: +US$ 40,00 no total.» */
  seAtingido: (v: string) => `Se o novo stop for atingido: ${v} no total.`, // B js1637
  /** «Se o novo stop for atingido, o dia passa do limite: faltam US$ 80 e o stop arrisca US$ 120.» */
  avisoLimite: (falta: string, risco: string) => `Se o novo stop for atingido, o dia passa do limite: faltam ${falta} e o stop arrisca ${risco}.`, // B js1642
  /** «O stop já está em 7.912,50.» */
  jaEsta: (p: string) => `O stop já está em ${p}.`, // B js1626
  novoVazio: 'Informe o novo stop.', // B js1627
  zero: 'O stop precisa ser maior que zero.', // B js1627
  agoraVazio: 'Informe o preço de agora.', // B js1630
  agoraVazioPremio: 'Informe o prêmio de agora.', // B js1630
  agoraZero: 'O preço precisa ser maior que zero.', // B js1630
  agoraZeroPremio: 'O prêmio precisa ser maior que zero.', // B js1630
  ladoCompra: 'Numa compra, o stop fica abaixo do preço de agora.', // B js1634
  ladoVenda: 'Numa venda, o stop fica acima do preço de agora.', // B js1634
  // N (c7d38cd): «Preço agora» on pips whose points in favour do not fit a stop move (10^10 pips or more)
  agoraLonge: 'Confira o preço de agora.',
  /** «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.» (fav: «, com …» or '') */
  movidoBe: (p: string, h: string, fav: string) => `Stop no breakeven (${p}) às ${h}${fav}.`, // B js1660
  /** «Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.» */
  movido: (p: string, h: string, fav: string) => `Stop movido para ${p} às ${h}${fav}.`, // B js1660
}

/** The breakeven suggestion after a partial (E21) */
export const SUGESTAO = {
  /** «Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.» */
  texto: (dif: string, n: string) => `Esta parcial saiu com ${dif}. Pela sua regra, com ${n} o stop vai para o breakeven.`, // B js1609
  botao: 'Mover para o breakeven', // B507
}

/** «Agora» (E15) */
export const AGORA = {
  rotulo: 'Agora', // B473
  emAberto: 'Em aberto', // B js1695
  /** «de 3» / «de 1,00» */
  de: (q: string) => `de ${q}`, // B js1695
  stop: 'Stop', // B js1698
  semStop: 'sem stop', // B js1698
  daEntrada: '· o da entrada', // B js1696
  /** «· no breakeven, desde 10:19» */
  noBe: (h: string) => `· no breakeven, desde ${h}`, // B js1696
  /** «· garante +2,50 pts, desde 10:30» */
  garante: (d: string, h: string) => `· garante ${d}, desde ${h}`, // B js1697
  /** «· arrisca 4,00 pts, desde 10:30» */
  arrisca: (d: string, h: string) => `· arrisca ${d}, desde ${h}`, // B js1697
  realizado: 'Realizado', // B js1699
  /** «em 1 parcial» / «em 2 parciais» */
  emParciais: (n: number) => (n === 1 ? 'em 1 parcial' : `em ${n} parciais`), // B js1699
  /** «Se o stop for atingido: −US$ 60,00 no total.» */
  seStop: (v: string) => `Se o stop for atingido: ${v} no total.`, // B js1702
}

/** «Linha do tempo» (E16, E32) */
export const TEMPO = {
  rotulo: 'Linha do tempo', // B480
  infoAria: 'Como ler: linha do tempo', // B480
  info: 'As parciais e a saída ficam na hora que você digitou; o app guarda à parte a hora em que você registrou. Os movimentos do stop ficam na hora do servidor, no toque em “Registrar stop”. O R é sempre medido pelo stop da entrada.', // B481
  /** «Entrada · 3 ct a 7.912,50 · stop 10 pts» (no stop: no part) */
  entrada: (q: string, p: string, stop: string | null) => `Entrada · ${q} a ${p}${stop ? ` · ${stop}` : ''}`, // B js1498
  stopPts: (v: string) => `stop ${v} pts`, // B js1494
  stopPips: (v: string) => `stop ${v} pips`, // B js1494
  stopPremio: (v: string) => `stop do prêmio ${v}`, // B js1494
  stopPreco: (v: string) => `stop ${v}`, // B js1494
  /** «Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00» (din: « · +US$ 40,00» or '') */
  parcial: (q: string, p: string, dif: string, din: string) => `Parcial · ${q} a ${p} · ${dif}${din}`, // B js1501
  saida: (q: string, p: string, dif: string, din: string) => `Saída · ${q} a ${p} · ${dif}${din}`, // B js1501
  /** «1ª saída · 1 ct a 4.409,30 · +12,00 pts · +US$ 120,00» (only with ≥ 2 counting exits of a «Já fechada» or file trade) */
  nSaida: (k: number, q: string, p: string, dif: string, din: string) => `${k}ª saída · ${q} a ${p} · ${dif}${din}`, // B js1501
  /** « · +US$ 40,00» · « · ≈ +US$ 21,85» · « · +US$ 105,00, digitado» */
  din: (v: string, estimativa: boolean, digitado: boolean) => ` · ${estimativa ? '≈ ' : ''}${v}${digitado ? ', digitado' : ''}`, // B js1495
  /** The partial's sub-line: «registrada às 10:20» */
  registrada: (h: string) => `registrada às ${h}`, // B js1502
  /** «Stop no breakeven · 7.912,50 · com +8,00 pts a favor» */
  stopBe: (p: string, fav: string | null) => `Stop no breakeven · ${p}${fav ? ` · ${fav}` : ''}`, // B js1507
  /** «Stop movido · 7.915,00 · com +11,00 pts a favor» */
  stopMovido: (p: string, fav: string | null) => `Stop movido · ${p}${fav ? ` · ${fav}` : ''}`, // B js1507
  /** «Stop no breakeven · com +12,00 pts a favor · registrado depois» */
  beDepois: (fav: string | null) => `Stop no breakeven${fav ? ` · ${fav}` : ''} · registrado depois`, // B js1506
  semHora: 'sem hora', // B482
  /** «ontem, 10:52» */
  ontem: (h: string) => `ontem, ${h}`, // B js1496
  /** «21 out, 10:52» */
  noDia: (d: string, h: string) => `${d}, ${h}`, // N (the board draws «ontem» only)
}

/** «Desfazer» the newest partial or stop move (E16, E17, E20, E28) */
export const DESFAZER_EV = {
  link: 'Desfazer', // B js1749
  /** aria «Desfazer a parcial das 10:18» */
  ariaParcial: (h: string) => `Desfazer a parcial das ${h}`, // B js1749
  /** aria «Desfazer o movimento do stop das 10:19» */
  ariaStop: (h: string) => `Desfazer o movimento do stop das ${h}`, // B js1749
  perguntaParcial: (h: string, q: string, p: string, volta: string) =>
    `Desfazer a parcial das ${h} (${q} a ${p})? Ela sai do resultado e do limite do dia, e os ${volta} voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.`, // B js1674
  /** volta null: «A operação volta a ficar sem stop.» */
  perguntaStop: (h: string, p: string, volta: string | null) =>
    `Desfazer o movimento do stop das ${h} (para ${p})? ${volta ? `O stop volta a ${volta}.` : 'A operação volta a ficar sem stop.'} O app guarda só que um movimento foi desfeito, com a data e a hora.`, // B js1675
  /** «Parcial das 10:18 desfeita às 10:22.» */
  parcialDesfeita: (h: string, a: string) => `Parcial das ${h} desfeita às ${a}.`, // B js1681
  /** «Movimento do stop das 10:19 desfeito às 10:22.» */
  stopDesfeito: (h: string, a: string) => `Movimento do stop das ${h} desfeito às ${a}.`, // B js1681
  /** Appended: « Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.» */
  limiteVolta: (pior: string, lim: string) => ` Com a parcial desfeita, o limite do dia volta a ${pior} de ${lim}.`, // B js1685
  // A (telas §4.7): only for a refused event undo; «Desfazer entrada» keeps ERRO_REGISTRAR's
  tarde: 'Passaram 15 minutos: não dá mais para desfazer.',
  naoUltimo: 'Só o último registro pode ser desfeito.', // N (telas §4.7)
}

/** Step 2 with partials (E18, E27) */
export const ABERTA_3C = {
  /** «Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.» */
  notaPrimeiraParcial: (h: string) => `Marcas feitas a partir da sua primeira parcial (${h}) contam como depois do resultado.`, // B js1715
  /** «Desfazer a entrada das 10:12 (MES · Compra · 3 ct)? A operação, as parciais, os movimentos do stop e as marcas dela …» */
  desfazerPergunta: (h: string, op: string, parciais: boolean, movimentos: boolean) =>
    `Desfazer a entrada das ${h} (${op})? A operação${parciais ? ', as parciais' : ''}${movimentos ? ', os movimentos do stop' : ''} e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.`, // B js1740
}

/** Step 3 with several exits or stop moves (E30, E31, E33, E34) */
export const FECHADA_3C = {
  /** «7.924,17 em média» */
  emMedia: (p: string) => `${p} em média`, // B js1835
  comStopInicial: (v: string) => `com o stop inicial de ${v} pts`, // B js1841
  comStopInicialPips: (v: string) => `com o stop inicial de ${v} pips`, // B js1841
  comStopInicialPremio: (v: string) => `com o stop inicial do prêmio em ${v}`, // B js1841
  comStopInicialEm: (v: string) => `com o stop inicial em ${v}`, // B js1841
  /** «Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.» (fav null: «Breakeven às 11:31 · sua regra: +8 pts.») */
  be: (h: string, fav: string | null, n: string) => `Breakeven às ${h}${fav ? `, ${fav}` : ''} · sua regra: ${n}.`, // B js1817
  /** «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.» / «Breakeven registrado depois · …» */
  beDepois: (fav: string | null, n: string) => `Breakeven ${fav ? `${fav}, ` : ''}registrado depois · sua regra: ${n}.`, // B js1816
  /** «Breakeven: o stop passou da entrada às 10:30, com +11,00 pts a favor · sua regra: +8 pts.» */
  passou: (h: string, fav: string | null, n: string) => `Breakeven: o stop passou da entrada às ${h}${fav ? `, ${fav}` : ''} · sua regra: ${n}.`, // B js1819
  movido: (n: string) => `Breakeven: o stop foi movido, sem chegar à entrada · sua regra: ${n}.`, // B js1820
  naoMovido: (n: string) => `Breakeven: o stop não foi movido · sua regra: ${n}.`, // B js1821
  /** «Marcas feitas a partir das 10:18 (sua primeira parcial) contam como depois do resultado.» */
  linhaDepoisParcial: (h: string) => `Marcas feitas a partir das ${h} (sua primeira parcial) contam como depois do resultado.`, // B js1802
}

/** «Operações abertas» (E36) */
export const ESCOLHA_3C = {
  /** « · 2 ct em aberto» */
  emAberto: (q: string) => ` · ${q} em aberto`, // B js2109
}

/**
 * The refusals of «Registrar parcial», «Registrar stop» and the timeline's «Sim, desfazer» that read
 * differently from ERRO_REGISTRAR (§5.8: the as-built writes keep ERRO_REGISTRAR's texts)
 */
export const ERRO_3C: Partial<Record<RegistrarErrorCode, string>> = {
  too_many_moves: 'Até 20 movimentos de stop por operação.', // N (= domínio)
  undo_too_late: DESFAZER_EV.tarde,
  not_newest: DESFAZER_EV.naoUltimo,
}

/**
 * Every pt-BR string of the «Registrar operação» sheet for Futures and Ebinex (PR 3-3, lane A), in
 * one place so the owner can review them. lib/hub/registrarForm builds the lines that carry values
 * (risk, previews, marks, periods) from the templates here. Strings come from the approved board
 * (RegistrarOperacao.dc.html, canvas v57; «RO l.N» is its line) unless marked:
 *   NEW      not on any board (states the board does not draw: loading, errors, offline, retries)
 *   ADAPTED  a board string changed for the app (the comment says what changed)
 * The board's prototype controls and their labels (the scenario picker, the demo buttons, the
 * prototype's clock) are never here (contract §4.10; a test checks it).
 *
 * 3-4 (the new markets: Forex, Ações e opções, Cripto, B3, and the futures «Buscar ativo») adds the
 * sections from «3-4» on, with the same markers (B = the board's copy, A = ADAPTED, N = NEW); every
 * 3-3 string above keeps its key and value.
 */
import type { RegistrarErrorCode } from '@/lib/hub/registrarDb'
import { BUSY, CANCEL, CLOSE, ERROR_TEXT, FOLHA, LOADING, NEVER_SUMMED, TRY_AGAIN } from '@/components/hub/contas/copy'

export { BUSY, CANCEL, CLOSE, FOLHA, LOADING, NEVER_SUMMED, TRY_AGAIN }

// ------------------------------------------------------------------------------------------------
// The sheet
// ------------------------------------------------------------------------------------------------

export const FOLHA_REG = {
  titulo: 'Registrar operação', // RO l.295
  passo: (k: number, n: number, nome: string) => `Passo ${k} de ${n} · ${nome}`, // RO l.1640
  passos: { entrada: 'Entrada', aberta: 'Aberta', vencida: 'Vencida', fechada: 'Fechada', entradaSaida: 'Entrada e saída' }, // RO l.1638
  naoEnvia: 'O Binary Hub não envia ordens: registrar é anotar.', // RO l.556
  // NEW: no active Futures or binary account (the sheet opened from a page without one)
  semConta: 'Nenhuma conta de Futuros ou de binárias para registrar.',
  // NEW (3-4): every market registers; the sheet opened without an active account
  semContaAtiva: 'Nenhuma conta ativa para registrar.',
  // NEW: the open trades (or the trade) could not be read
  erroCarregar: 'Não foi possível carregar o Registrar.',
  // NEW (C10): the reads are paused offline
  semConexaoLeitura: 'Sem conexão. Tente de novo quando a conexão voltar.',
  // NEW (D18): an account without a rule version
  semRegras: 'Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.',
  semRegrasLink: 'Definir em Personalizar', // NEW (D18)
  semRegrasHref: '/personalizar#janelas',
  // NEW: a trade the sheet was opened on is gone (undone, deleted on the old page)
  naoEncontrada: 'Esta operação não foi encontrada.',
  // NEW (D3): the trade was closed on another device (or a lost answer of an earlier exit)
  fechadaFora: 'Esta operação já foi fechada em outro lugar.',
}

export const RODAPE = {
  novaEntrada: 'Nova entrada', // RO l.1642
  registrarEntrada: 'Registrar entrada', // RO l.1643
  registrarOperacao: 'Registrar operação', // RO l.1643
  registrarSaida: 'Registrar saída', // RO l.1644
  registrarResultado: 'Registrar resultado', // RO l.1644
  registrarOutra: 'Registrar outra', // RO l.1645
  verNoDiario: 'Ver no Diário', // RO l.254
}

// ------------------------------------------------------------------------------------------------
// «Operações abertas»
// ------------------------------------------------------------------------------------------------

export const ESCOLHA = {
  titulo: 'Operações abertas', // RO l.300
  /** «MES · Compra · 2 ct · desde 10:12 ET» (RO l.1600) */
  linha: (op: string, desde: string) => `${op} · desde ${desde}`,
  /** «Registrar saída: MES · Compra · 2 ct · desde 10:12 ET» (RO l.1601) */
  aria: (acao: string, linha: string) => `${acao}: ${linha}`,
}

// ------------------------------------------------------------------------------------------------
// Step 1 · Entrada / Entrada e saída
// ------------------------------------------------------------------------------------------------

export const ENTRADA = {
  titulo: 'Entrada', // RO l.1135
  tituloFechada: 'Entrada e saída', // RO l.1135
  modo: 'Como está a operação?', // RO l.312
  aberta: 'Aberta',
  jaFechada: 'Já fechada',
  dia: 'Dia', // RO l.316
  hoje: 'Hoje',
  ontem: 'Ontem',
  outroDia: 'Outro dia',
  conta: 'Conta', // RO l.326
  // NEW (D4): the «Conta» chip is a button when there is more than one account to register on
  trocarConta: (label: string) => `Trocar a conta: ${label}`,
  limite: 'Limite do dia', // RO l.331
  limiteDe: (valor: string) => `de ${valor}`,
  fora: 'Fora do plano, conferido pelo hub. Você pode registrar.', // RO l.408
  /** «Operação anterior: 2 imagens e nota salvas às 10:21.» (RO l.1452) */
  anterior: (quem: string, hora: string) => `Operação anterior: ${quem} às ${hora}.`,
  /** «Entrada das 10:31 desfeita às 10:32.» (RO l.1279) */
  desfeita: (entrada: string, agora: string) => `Entrada das ${entrada} desfeita às ${agora}.`,
}

export const GATE = {
  pergunta: 'Posso operar hoje?', // RO l.1141
  naEntrada: 'Posso operar hoje? Na entrada:', // RO l.1141
  naEntradaEm: (dia: string) => `Posso operar hoje? Na entrada, em ${dia}:`, // RO l.1141
  // NEW (D8): rules_now (or gate_at) failed; never «Liberado»
  naoConferido: 'Não foi possível conferir agora.',
  infoAria: 'Como ler: Posso operar hoje?', // RO l.329
  // RO l.1143 (v57): Futuros
  infoFuturos:
    'Calculado pelas regras desta conta, na hora da entrada: janela e limite do dia (o bloqueio de dados fica ativo na Fase 5). Ele nunca impede o registro: fora do plano, a operação só ganha a marca.',
  // RO l.1144 (v57): every other market
  infoOutros:
    'Calculado pelas regras desta conta, na hora da entrada: janela e limite do dia. Ele nunca impede o registro: fora do plano, a operação só ganha a marca.',
  liberado: 'Liberado',
  ate: (hora: string) => `até ${hora}`, // RO l.1102
  fora: 'Fora da sua janela',
  foraFaixa: (faixa: string) => `· ${faixa}`, // RO l.1101
  hojeNaoEDia: '· hoje não é dia da janela',
  naoEDia: '· não é dia da janela',
  encerrado: 'Encerrado por hoje',
  /** «· limite de US$ 400 atingido às 10:40 (pior momento −US$ 505)» (RO l.1098) */
  encerradoSub: (limite: string, hora: string, pior: string) => `· limite de ${limite} atingido às ${hora} (pior momento ${pior})`,
  // ADAPTED (lib/hub/posso.possoLinha, contract §4.3.3): «Liberado» with a warning
  avisoFora: '· com aviso: fora da janela',
  avisoNaoEDia: '· com aviso: hoje não é dia da janela',
  avisoLimite: '· com aviso do limite',
  semJanela: 'Sem janela salva',
  definir: 'Definir',
  definirAria: (conta: string) => `Definir a janela da ${conta} em Personalizar`,
  definirHref: '/personalizar#janelas',
  // ADAPTED (lib/hub/posso): the window rule turned off
  semRegra: 'Sem regra ativa',
  ajustar: 'Ajustar',
  ajustarAria: (conta: string) => `Ajustar as regras da ${conta} em Personalizar`,
  ajustarHref: '/personalizar#regras',
  // ADAPTED (lib/hub/posso): the limit is the only rule and the day is not loaded
  indisponivel: 'Limite do dia indisponível',
}

export const FUTUROS = {
  ativo: 'Ativo', // RO l.338
  lado: 'Lado',
  compra: 'Compra',
  venda: 'Venda',
  contratos: 'Contratos',
  outro: 'Outro',
  quantos: 'Quantos contratos?', // RO l.743 (v57)
  preco: 'Preço de entrada',
  precoSaida: 'Preço de saída',
  hora: (sufixo: string) => `Hora${sufixo}`, // «Hora (ET)»
  horaEntrada: (sufixo: string) => `Hora da entrada${sufixo}`,
  horaSaida: (sufixo: string) => `Hora da saída${sufixo}`,
  stopAlvo: 'Stop e alvo, em pontos',
  opcional: '· opcional',
  stop: 'Stop',
  alvo: 'Alvo',
  risco: (valor: string) => `risco ${valor}`,
  alvoValor: (valor: string) => `alvo ${valor}`,
  razao: (r: string) => `1 : ${r}`,
  semStop: 'Sem stop e alvo, o R não é calculado.',
  // RO v55 (resumo_v55 §2): the stop risks more than what is left of the day's limit
  avisoLimite: (falta: string, risco: string) => `Se o stop for atingido, o dia passa do limite: faltam ${falta} e o stop arrisca ${risco}.`,
  /** «Já fechada» (RO l.929–944) */
  resultado: (pts: string, valor: string) => `Resultado: ${pts} · ${valor}`,
  resultadoLado: 'Resultado: escolha o lado.',
  resultadoPrecos: 'Resultado: preencha os dois preços.',
  resultadoConfiraPasso: (passo: string) => `Resultado: confira os preços (${passo}).`,
  resultadoConfira: 'Resultado: confira os preços.',
  resultadoQuantidade: 'Resultado: informe a quantidade.',
  /** «o MES anda de 0,25 em 0,25» */
  passo: (ativo: string, tick: string) => `o ${ativo} anda de ${tick} em ${tick}`,
  pts: (valor: string) => `${valor} pts`,
}

export const EBINEX = {
  par: 'Par', // RO l.392
  outroPar: 'Outro par',
  outroParPh: 'Ex.: AUD/CAD',
  direcao: 'Direção',
  alta: 'Alta',
  baixa: 'Baixa',
  expiracao: 'Expiração',
  minutos: (n: number) => `${n} min`,
  expInfoAria: 'Como ler: expiração na Ebinex', // RO l.396 (v55)
  expInfo:
    'Na Ebinex, as ordens se casam num livro de ofertas. Você entra durante a vela do tempo escolhido, até 5 segundos antes de ela fechar; a operação roda na vela seguinte e o resultado sai no fim dela. Ex.: em 5 min, uma entrada às 20:13 roda das 20:15 às 20:20. Nas outras corretoras, o tempo conta do clique.',
  vence: (hora: string) => `Vence às ${hora}.`, // RO l.1186 (D35)
  venceu: (hora: string) => `Venceu às ${hora}.`,
  stake: 'Stake, US$',
  payout: 'Payout, %',
  hora: (sufixo: string) => `Hora${sufixo}`,
  horaEntrada: (sufixo: string) => `Hora da entrada${sufixo}`,
  linha: (ganho: string, perda: string) => `Se acertar: ${ganho} · se errar: ${perda}`,
  preencha: 'Preencha stake e payout.',
  // RO v55 (resumo_v55 §2): only on an account with a limit (never on the owner's Ebinex)
  avisoLimite: (falta: string, stake: string) => `Se perder, o dia passa do limite: faltam ${falta} e o stake é ${stake}.`,
  comoTerminou: 'Como terminou?',
  ganho: 'Ganho',
  perda: 'Perda',
  devolvida: 'Devolvida',
  resultado: (valor: string) => `Resultado: ${valor}`,
  resultadoEscolha: 'Resultado: escolha como terminou.',
  /** Step 3's line: «… · perda · …» */
  fim: { ganho: 'ganho', perda: 'perda', devolvida: 'devolvida' },
}

export const SIMILAR = {
  // NEW (D30): the dry run (or the refusal similar_trade) says an imported trade looks like this one
  pergunta: (desc: string) => `Esta operação parece já ter vindo do arquivo: ${desc}. Registrar mesmo assim?`,
  /** «Compra de MES às 10:12» */
  desc: (lado: string, ativo: string, hora: string) => `${lado} de ${ativo} às ${hora}`,
  sim: 'Registrar mesmo assim',
  nao: CANCEL,
}

// ------------------------------------------------------------------------------------------------
// Marks
// ------------------------------------------------------------------------------------------------

export const MARCAS = {
  setupTit: 'Como está o setup?', // RO l.1205
  setupTitDepois: 'Como estava o setup?',
  setupInfoAria: 'Como ler: por que marcar agora', // RO l.418
  setupInfo:
    'Marcar depois de ver o resultado puxa a nota para o resultado: a perda vira “Setup C”, e “Setup A rende mais” passa a se provar sozinho. Por isso o app grava a hora de cada marca: só as feitas antes da saída podem chegar a Confirmada nos Padrões de Análises; as de depois param em Pouco fundamentada.',
  setupAria: (v: string) => `Setup ${v}`,
  agoraAntes: 'agora conta como antes da saída',
  depoisResultado: 'depois do resultado',
  antesSaida: 'antes da saída',
  jaFoi: 'Marcas feitas agora contam como depois do resultado; para passar de Pouco fundamentada em Análises, marque o setup na entrada.',
  maisEntrada: 'Execução da entrada', // RO l.1210
  maisFechada: 'Execução e emoção',
  setup: 'Setup',
  execucao: 'Execução',
  emocao: 'Emoção',
  valores: {
    setup: { A: 'A', B: 'B', C: 'C' },
    execucao: { cedo: 'cedo', no_ponto: 'no ponto', tarde: 'tarde' },
    emocao: { calmo: 'Calmo', confiante: 'Confiante', ansioso: 'Ansioso', frustrado: 'Frustrado', neutro: 'Neutro' },
  } as Record<'setup' | 'execucao' | 'emocao', Record<string, string>>,
  /** «Setup A» / «Execução: no ponto» / «Emoção: Calmo» (RO `rotMarca`) */
  rotulo: (kind: 'setup' | 'execucao' | 'emocao', valor: string) => (kind === 'setup' ? `Setup ${valor}` : `${kind === 'execucao' ? 'Execução' : 'Emoção'}: ${valor}`),
  semMarca: (kind: 'setup' | 'execucao' | 'emocao') => `${kind === 'setup' ? 'Setup' : kind === 'execucao' ? 'Execução' : 'Emoção'}: sem marca`,
  /** «às 10:12» / «ontem às 10:52» / «21 out às 10:24» */
  em: (dia: '' | 'ontem' | string, hora: string) => (dia ? `${dia} às ${hora}` : `às ${hora}`),
  /** «às 10:12 · antes da saída» */
  tempo: (quando: string, fase: string) => `${quando} · ${fase}`,
  // NEW: a tap sent, waiting for the server's time
  salvando: 'salvando…',
  // NEW: the tap was not saved (the pill goes back)
  falhou: 'A marca não foi salva. Tente de novo.',
  // NEW: what a screen reader hears when a mark is saved: «Setup A, às 10:12, antes da saída.»
  anuncio: (rotulo: string, quando: string, fase: string) => `${rotulo}, ${quando}, ${fase}.`,
  anuncioDesmarcada: (kind: 'setup' | 'execucao' | 'emocao', quando: string) =>
    `${kind === 'setup' ? 'Setup' : kind === 'execucao' ? 'Execução' : 'Emoção'} desmarcado, ${quando}.`,
}

// ------------------------------------------------------------------------------------------------
// Step 2 · Operação aberta / Opção vencida
// ------------------------------------------------------------------------------------------------

export const ABERTA = {
  titulo: 'Operação aberta', // RO l.1251
  tituloVencida: 'Opção vencida',
  /** sr status (RO l.1253–1254, v57) */
  registrada: (hora: string) => `Entrada registrada às ${hora}.`,
  registradaDigitada: (entrada: string, registro: string) => `Entrada das ${entrada} registrada às ${registro}.`,
  deOntem: (hora: string) => `Entrada de ontem, às ${hora}.`,
  deDia: (dia: string, hora: string) => `Entrada de ${dia}, às ${hora}.`,
  /** «7.912,50 às 10:12 ET» / «7.912,50 ontem, às 10:52 ET» / «7.912,50 em 21 out, às 10:24 ET» */
  quando: (dia: '' | 'ontem' | string, hora: string) => (dia === '' ? `às ${hora}` : dia === 'ontem' ? `ontem, às ${hora}` : `em ${dia}, às ${hora}`),
  /** «stop 10 · alvo 20 pts · risco US$ 100,00» */
  stop: (v: string) => `stop ${v}`,
  alvo: (v: string) => `alvo ${v}`,
  pts: ' pts',
  risco: (v: string) => ` · risco ${v}`,
  /** «US$ 20 · payout 88% · 20:10–20:12 de Brasília» */
  binario: (stake: string, payout: string, periodo: string) => `${stake} · payout ${payout}% · ${periodo}`,
  noPlano: 'No plano',
  semPlano: 'plano não avaliado',
  suasMarcas: 'Suas marcas',
  nenhumaAinda: 'Nenhuma ainda.',
  depoisDoResultado: 'Marcas feitas agora contam como depois do resultado.',
  comoEsta: 'Como você está?',
  setupExecucao: 'Setup e execução',
  /** «Se sair a 7.903,75: +7,50 pts · +US$ 75,00» */
  seSair: (preco: string, pts: string, valor: string) => `Se sair a ${preco}: ${pts} · ${valor}`,
  informeSaida: 'Resultado: informe o preço de saída.',
  confiraSaidaPasso: (passo: string) => `Resultado: confira o preço de saída (${passo}).`,
  confiraSaida: 'Resultado: confira o preço de saída.',
  desfazer: 'Desfazer entrada', // RO l.478
  desfazerAte: (hora: string) => `Até ${hora}, 15 minutos depois do registro.`,
  desfazerPergunta: (hora: string, op: string) =>
    `Desfazer a entrada das ${hora} (${op})? A operação e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.`,
  sim: 'Sim, desfazer',
  manter: 'Manter',
}

// ------------------------------------------------------------------------------------------------
// Step 3 · Operação fechada
// ------------------------------------------------------------------------------------------------

export const FECHADA = {
  titulo: 'Operação fechada', // RO l.487
  r: (v: string) => `${v} R`,
  comStop: (pts: string) => `com stop de ${pts} pts`,
  /** RO l.1327 (v57) */
  atingido: (hora: string, pior: string, limite: string) => `Limite do dia atingido às ${hora}: ${pior} de ${limite}.`,
  atingidoEncerrar: 'Pelas suas regras, o dia está encerrado.',
  atingidoAvisar: 'Pelas suas regras, é só um aviso.',
  /** RO l.1328 */
  oitenta: (pior: string, limite: string) => `Você chegou a 80% do limite do dia: ${pior} de ${limite}.`,
  conferido: 'conferido pelo hub',
  marcasInfoAria: 'Como ler: suas marcas',
  marcasInfo:
    'Nos Padrões de Análises, só as marcas feitas antes da saída podem chegar a Confirmada; as feitas depois do resultado aparecem, mas param em Pouco fundamentada. Mudou uma marca depois? Em Análises vale a de antes da saída, e a troca fica guardada.',
  antesSaida: 'antes da saída',
  depoisResultado: 'depois do resultado',
  nenhuma: 'Nenhuma.',
  /** «Setup A às 10:12» */
  item: (rotulo: string, quando: string) => `${rotulo} ${quando}`,
  trocada: (quando: string) => `(trocada ${quando})`,
  desmarcada: (quando: string) => `(desmarcada ${quando})`,
  /** «antes: A às 10:12 · agora: B às 10:41» / «… · agora: sem marca às 10:41» */
  historico: (antes: string, agora: string) => `antes: ${antes} · agora: ${agora}`,
  semMarca: 'sem marca',
  linhaDepois: 'Marcas feitas a partir de agora contam como depois do resultado.',
  linhaDepoisSaida: (hora: string) => `Marcas feitas a partir das ${hora} (sua saída) contam como depois do resultado.`,
  linhaDepoisVencimento: (hora: string) => `Marcas feitas a partir das ${hora} (o vencimento) contam como depois do resultado.`,
  marcarOuMudar: 'Marcar ou mudar',
}

// ------------------------------------------------------------------------------------------------
// «Imagens e nota»
// ------------------------------------------------------------------------------------------------

export const ANEXOS = {
  titulo: 'Imagens e nota', // RO l.519
  infoAria: 'Como ler: imagens e nota',
  info: 'Ficam guardadas com a operação e aparecem nos detalhes dela, no Diário. Não entram nas contas, nos Padrões nem na leitura da IA. Dica: recorte o número da conta antes de enviar.',
  imagens: 'Imagens',
  opcional: '(opcional)',
  dica: (atalho: string) => `Arraste para cá, cole com ${atalho} ou escolha. Até 4 imagens PNG, JPG ou WebP, de até 10\u00a0MB cada.`,
  dicaToque: 'Até 4 imagens PNG, JPG ou WebP, de até 10\u00a0MB cada.',
  cheio: 'Limite de 4 imagens. Remova uma para trocar.',
  escolher: 'Escolher imagens',
  erroTipo: 'Só imagens PNG, JPG ou WebP.',
  erroQuantas: 'Até 4 imagens por operação.',
  erroTamanho: 'Esta imagem passa de 10 MB.',
  erroTamanhoVarias: (nomes: string, uma: boolean) => `${uma ? 'Esta imagem passa' : 'Estas imagens passam'} de 10 MB: ${nomes}.`,
  erroTipoVarias: (nomes: string, uma: boolean) => `Só imagens PNG, JPG ou WebP; ${uma ? 'não entrou' : 'não entraram'}: ${nomes}.`,
  erroQuantasVarias: (nomes: string, uma: boolean) => `Até 4 imagens por operação; ${uma ? 'não entrou' : 'não entraram'}: ${nomes}.`,
  adicionadas: (n: number, total: number) => `${n === 1 ? '1 imagem adicionada' : `${n} imagens adicionadas`}. ${total} de 4.`,
  removida: (nome: string, total: number) => `${nome} removida. ${total} de 4.`,
  anexadas: 'Imagens anexadas',
  salvas: 'Imagens salvas',
  semPrevia: 'sem prévia',
  remover: 'Remover',
  removerAria: (nome: string) => `Remover imagem ${nome}`,
  nota: 'Nota',
  notaPh: 'Ex.: entrei antes do rompimento confirmar; o alvo estava perto da máxima do dia.',
  contador: (n: number) => `${n} de 1000`,
  salvar: 'Salvar imagens e nota',
  cancelar: CANCEL,
  editar: 'Editar',
  editarAria: 'Editar imagens e nota',
  // NEW (D17): while the files go up
  enviando: (k: number, n: number) => `Enviando ${k} de ${n}…`,
  // NEW (D17): an upload that failed stays in the editor
  naoEnviou: (nome: string) => `Não foi possível enviar ${nome}.`,
  /** «2 imagens e nota salvas» / «1 imagem salva» / «Nota salva» (RO `quemSalvo`) */
  quem: (n: number, nota: boolean) =>
    n && nota ? `${n === 1 ? '1 imagem' : `${n} imagens`} e nota salvas` : n ? (n === 1 ? '1 imagem salva' : `${n} imagens salvas`) : 'Nota salva',
  /** «2 imagens e nota salvas às 10:41. Aparecem nos detalhes da operação, no Diário.» */
  salvo: (quem: string, hora: string, varios: boolean) => `${quem} às ${hora}. ${varios ? 'Aparecem' : 'Aparece'} nos detalhes da operação, no Diário.`,
  /** «Imagens e nota removidas às 10:41.» (RO `msgRemovido`) */
  removido: (n: number, nota: boolean, hora: string) =>
    `${n && nota ? `${n === 1 ? 'Imagem' : 'Imagens'} e nota removidas` : n ? (n === 1 ? 'Imagem removida' : 'Imagens removidas') : 'Nota removida'} às ${hora}.`,
  // NEW (D14): images and note offline
  offline: 'Sem conexão. As imagens e a nota não foram salvas.',
}

// ------------------------------------------------------------------------------------------------
// Field errors (board order: futures dia, lado, q, preco, hora, spreco, shora, stop, alvo; binary
// dia, par, dir, exp, stake, payout, hora, fimB; RO l.1064)
// ------------------------------------------------------------------------------------------------

export const ERROS = {
  diaFuturo: 'O dia não pode ser depois de hoje.', // RO l.1022
  diaVazio: 'Escolha o dia.', // NEW (bad_day for an empty day the form never sends)
  /** RO l.1023 */
  antesRegras: (desde: string) => `Antes de ${desde} esta conta não tinha regras: essas operações entram pelo arquivo da corretora.`,
  ativo: 'Escolha o ativo.',
  lado: 'Escolha Compra ou Venda.',
  direcao: 'Escolha Alta ou Baixa.',
  qtdVazia: 'Informe a quantidade.', // RO l.1040
  qtdNumero: 'Use só números, como 4.',
  qtdZero: 'Use uma quantidade maior que zero.',
  qtdInteira: 'Use um número inteiro de contratos.',
  precoVazio: 'Informe o preço de entrada.',
  precoSaidaVazio: 'Informe o preço de saída.',
  precoNumero: 'Use só números, como 7.896,25.',
  precoZero: 'O preço precisa ser maior que zero.',
  /** «O MES anda de 0,25 em 0,25; confira o preço.» */
  precoPasso: (ativo: string, tick: string) => `O ${ativo} anda de ${tick} em ${tick}; confira o preço.`,
  /** v57: «Use pontos de 0,25 em 0,25 no MES.» */
  pontosPasso: (ativo: string, tick: string) => `Use pontos de ${tick} em ${tick} no ${ativo}.`,
  pontosZero: 'Use pontos maiores que zero.',
  hora: 'Informe a hora.',
  /** «A entrada não pode ser depois de agora (10:07 ET).» */
  entradaFutura: (agora: string) => `A entrada não pode ser depois de agora (${agora}).`,
  entradaAntiga: 'A entrada ao vivo pode ser de até 15 minutos atrás. Para uma mais antiga, use “Já fechada”.', // RO l.1018
  foraDoDia: 'Essa hora não fica no dia escolhido.', // NEW (not_in_day)
  /** «A saída não pode ser antes da entrada (10:33).» */
  saidaAntes: (entrada: string) => `A saída não pode ser antes da entrada (${entrada}).`,
  saidaFutura: (agora: string) => `A saída não pode ser depois de agora (${agora}).`,
  parVazio: 'Informe o par.', // RO l.1058
  parInvalido: 'Use letras, números e /.', // NEW
  expiracao: 'Escolha a expiração.',
  stakeVazio: 'Informe o stake.',
  stakeZero: 'Use um valor maior que zero.',
  payoutVazio: 'Informe o payout.',
  payoutFaixa: 'O payout vai de 1 a 100%.',
  naoVenceu: 'Ainda não venceu.',
  comoTerminou: 'Escolha como terminou.',
}

const ALGO = ERROR_TEXT.unknown

/**
 * Every code a Registrar call can answer (REGISTRAR_ERROR_CODES), as the sheet says it. Field
 * errors go under their field (the local check's text, with the values; this one when the server
 * refused what the form let through); the rest go in the sheet's alert. Lane B never imports this
 * (contract §8 C9).
 */
export const ERRO_REGISTRAR: Record<RegistrarErrorCode, string> = {
  not_authenticated: ERROR_TEXT.not_authenticated,
  unknown_account: ERROR_TEXT.unknown_account,
  // ADAPTED (from «… para importar.»)
  archived_account: 'Esta conta está arquivada. Reative em Personalizar para registrar.',
  unknown_trade: FOLHA_REG.naoEncontrada,
  not_app_trade: 'Esta operação veio do arquivo e não pode ser mudada aqui.', // NEW
  not_for_market: 'Esta conta ainda não registra operações aqui.', // NEW
  no_rules: FOLHA_REG.semRegras,
  before_rules: 'Antes das regras desta conta, as operações entram pelo arquivo da corretora.', // ADAPTED (RO l.1023 without the date)
  bad_payload: ALGO,
  payload_too_large: ALGO,
  unknown_key: ALGO,
  bad_rules_version: ALGO,
  bad_client_key: ALGO,
  bad_symbol: ERROS.ativo,
  bad_direction: 'Escolha a direção.', // ADAPTED (one text for both markets when the server refuses it)
  bad_quantity: ERROS.qtdVazia,
  bad_price: ERROS.precoNumero,
  off_tick: 'Confira o preço: ele não anda nesse passo.', // ADAPTED (the local check names the asset and its tick)
  bad_stop: ERROS.pontosZero,
  bad_target: ERROS.pontosZero,
  bad_stake: ERROS.stakeZero,
  bad_payout: ERROS.payoutFaixa,
  bad_duration: ERROS.expiracao,
  bad_option: ALGO,
  bad_clock: ALGO,
  bad_time: ERROS.hora,
  bad_day: ERROS.diaFuturo,
  not_in_day: ERROS.foraDoDia,
  entry_in_future: 'A entrada não pode ser depois de agora.', // ADAPTED (the local check names the time)
  entry_too_old: ERROS.entradaAntiga,
  exit_before_entry: 'A saída não pode ser antes da entrada.', // ADAPTED
  exit_in_future: 'A saída não pode ser depois de agora.', // ADAPTED
  not_expired: ERROS.naoVenceu,
  bad_outcome: ERROS.comoTerminou,
  pnl_required: ALGO,
  bad_pnl: ALGO,
  bad_costs: ALGO,
  // NEW (D30): never shown as an error line; the sheet asks «Registrar mesmo assim?»
  similar_trade: 'Esta operação parece já ter vindo do arquivo.',
  not_open: FOLHA_REG.fechadaFora, // NEW
  undo_too_late: 'Passaram 15 minutos: a entrada não pode mais ser desfeita.', // NEW
  bad_mark: MARCAS.falhou, // NEW
  too_many_marks: 'Esta operação já tem marcas demais.', // NEW
  too_many_images: ANEXOS.erroQuantas,
  bad_mime: ANEXOS.erroTipo,
  image_too_large: ANEXOS.erroTamanho,
  bad_image_name: 'Não foi possível salvar as imagens. Tente de novo.', // NEW
  unknown_image: 'Não foi possível salvar as imagens. Tente de novo.', // NEW
  upload_missing: 'Não foi possível salvar as imagens. Tente de novo.', // NEW
  upload_mismatch: 'Não foi possível salvar as imagens. Tente de novo.', // NEW
  storage_quota: 'O espaço para imagens acabou. Remova imagens antigas para enviar novas.', // NEW
  not_hub_member: 'Esta conta não pode enviar imagens.', // NEW
  note_too_long: 'A nota vai até 1.000 caracteres.', // NEW
  frozen: ALGO,
  append_only: ALGO,
  // Phase 3c (partials, «Mover stop», «Desfazer»; telas.md §4.3–4.7, sintese.md §5.2): the forms
  // say these with the values (the open quantity, the stop, the hour); here, without them
  partial_too_large: 'Use menos que o que está em aberto; para sair com tudo, use “Saída”.', // ADAPTED (telas qtdDemais)
  exit_before_partial: 'A saída não pode ser antes da última parcial.', // ADAPTED (telas, without the hour)
  too_many_exits: 'Até 20 saídas por operação.', // NEW (sintese C7: 20)
  too_many_moves: 'Até 20 movimentos de stop por operação.', // NEW (sintese C7)
  same_stop: 'O stop já está nesse preço.', // ADAPTED (telas «O stop já está em 7.912,50.»)
  nothing_to_undo: 'Não há o que desfazer.', // NEW
  not_newest: 'Só o último registro pode ser desfeito.', // NEW (telas §4.7)
  exits_mismatch: ALGO,
  network: ERROR_TEXT.network,
  // NEW (D14): nothing is queued; the time comes from the server
  offline: 'Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando a conexão voltar.',
  bad_answer: ALGO,
  unknown: ALGO,
}

// ================================================================================================
// 3-4 · the new markets (RegistrarOperacao v57, scenarios 6–9 and the futures «Buscar ativo»;
// mercados34/contrato.md §5). B = board copy (RO l.N), A = ADAPTED, N = NEW.
// ================================================================================================

/** The instrument block: label, chips, search (RO l.334–344, 1079–1090, 1147–1152) */
export const ATIVO = {
  rotulo: { ativo: 'Ativo', par: 'Par', moeda: 'Moeda', objeto: 'Ativo-objeto' }, // B l.1147
  busca: { ativo: 'Buscar ativo', par: 'Buscar par', moeda: 'Buscar moeda' }, // B l.1149
  placeholder: {
    futures: 'Ex.: MCL ou ZN',
    forex: 'Ex.: USD/CHF ou XAUUSD',
    crypto: 'Ex.: AVAX',
    b3: 'Ex.: PETR4 ou DI1',
    opcao: 'Ex.: SPX',
    acao: 'Ex.: MSFT',
  }, // B l.1150
  resultadosAria: 'Resultados da busca', // B l.341
  /** «Usar “XAUUSD”» */
  usar: (codigo: string) => `Usar “${codigo}”`, // B l.1090
  /** sr-only, polite: «1 resultado.» / «3 resultados.» */
  status: (n: number) => (n === 1 ? '1 resultado.' : `${n} resultados.`), // N (results appear silently on the board)
  nenhum: 'Nenhum ativo do catálogo com esse código.', // N
}

/** «O que você operou?» (Ações e opções) */
export const TIPO_EUA = {
  pergunta: 'O que você operou?', // B l.335
  acao: 'Ação ou ETF', // B l.1146
  opcao: 'Opção', // B l.1146
}

/** «Cotada em» (Cripto) */
export const COTADA = {
  rotulo: 'Cotada em', // B l.344
  nota: 'USDT e USDC contam como dólar.', // B l.1152
}

/** Quantity (RO l.743–749, 1162–1167) */
export const QTD = {
  contratos: 'Contratos', // B l.743
  lotes: 'Lotes', // B l.745
  acoes: 'Ações', // B l.746
  quantidade: 'Quantidade', // B l.749 (B3 outside the catalog)
  /** «Quantidade, em BTC» */
  emMoeda: (moeda: string) => `Quantidade, em ${moeda}`, // B l.748
  quantosContratos: 'Quantos contratos?', // B l.743
  quantosLotes: 'Quantos lotes?', // B l.745
  /** «2 ct» «0,50 lote» «2,00 lotes» «1 ação» «300 ações» «100 un.» (RO `qTxt`) */
  sufixo: { ct: 'ct', lote: 'lote', lotes: 'lotes', acao: 'ação', acoes: 'ações', un: 'un.' }, // B l.789
  loteB3: 'Fora do lote de 100, a B3 negocia no fracionário (código com F).', // B l.988, 1167
}

/** Price fields' labels (RO l.1128, 1169–1172, 1267) */
export const PRECOS = {
  precoEntrada: 'Preço de entrada', // B
  precoSaida: 'Preço de saída', // B
  premioEntrada: 'Prêmio de entrada, US$ por ação', // B l.1128
  premioSaida: 'Prêmio de saída, US$ por ação', // B l.1267
  /** «Preço de entrada, USDT» / «Preço de saída, R$» */
  precoEntradaEm: (cotacao: string) => `Preço de entrada, ${cotacao}`, // B l.1128
  precoSaidaEm: (cotacao: string) => `Preço de saída, ${cotacao}`, // B l.1267
  stopAlvo: {
    pts: 'Stop e alvo, em pontos',
    pips: 'Stop e alvo, em pips',
    preco: 'Stop e alvo, em preço',
    premio: 'Stop e alvo do prêmio',
  }, // B l.1172
  /** «Posição de US$ 28.100» */
  posicao: (valor: string) => `Posição de ${valor}`, // B l.1177
}

/** The risk line under «Stop e alvo» (RO l.1092–1115) */
export const RISCO = {
  /** «risco ≈ US$ 39,62» */
  risco: (valor: string) => `risco ${valor}`, // B
  alvo: (valor: string) => `alvo ${valor}`, // B
  estimativa: '≈ ', // B l.1103
  riscoPips: (n: string) => `risco ${n} pips`, // B l.1106
  alvoPips: (n: string) => `alvo ${n} pips`, // B l.1107
  /** «Sem valor em dólar para este ativo.» (one side only) */
  semValor: (moeda: string) => `Sem valor em ${moeda} para este ativo.`, // B l.1110
  /** «1 : 2 · sem valor em dólar para este ativo» (both sides) */
  semValorParte: (moeda: string) => `sem valor em ${moeda} para este ativo`, // B l.1110
  semPreco: 'Sem preço de entrada, o risco não é calculado.', // B l.1112
  /** «2 contratos × 100 = 200 opções» */
  opcoes: (contratos: string, um: boolean, opcoes: string) => `${contratos} ${um ? 'contrato' : 'contratos'} × 100 = ${opcoes} opções`, // B l.1097
  dolar: 'dólar', // B (RO `moedaPal`)
  reais: 'reais', // B (RO `moedaPal`)
}

/** «Resultado» lines, «Corrigir», the typed result, «Custos» (RO l.929–966) */
export const RESULTADO = {
  /** «Resultado: +11,5 pips · ≈ +US$ 57,50» */
  linha: (dif: string, valor: string) => `Resultado: ${dif} · ${valor}`, // B l.940
  /** «Se sair a 1,08635: +11,5 pips · +US$ 57,50» */
  seSair: (preco: string, dif: string, valor: string) => `Se sair a ${preco}: ${dif} · ${valor}`, // B l.940
  /** «digite o valor em dólar» */
  digite: (moeda: string) => `digite o valor em ${moeda}`, // B l.941
  estimativa: '≈ ', // B l.940
  escolhaLado: 'Resultado: escolha o lado.', // B l.934
  preenchaPrecos: 'Resultado: preencha os dois preços.', // B l.937
  preenchaPremios: 'Resultado: preencha os dois prêmios.', // B l.937
  informePreco: 'Resultado: informe o preço de saída.', // B l.935
  informePremio: 'Resultado: informe o prêmio de saída.', // B l.935
  confiraPrecos: 'Resultado: confira os preços.', // B l.938
  /** «Resultado: confira os preços (o WIN anda de 5 em 5).» */
  confiraPrecosPasso: (passo: string) => `Resultado: confira os preços (${passo}).`, // B l.938
  confiraSaida: 'Resultado: confira o preço de saída.', // B l.936
  confiraSaidaPasso: (passo: string) => `Resultado: confira o preço de saída (${passo}).`, // B l.936
  informeQuantidade: 'Resultado: informe a quantidade.', // B l.939
  corrigir: 'Corrigir', // B l.410
  usarCalculado: 'Usar o calculado', // B l.956
  notaEstimativa:
    'Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.', // B l.959
  /** «Resultado, US$» (typed) */
  campoDigitado: (moeda: string) => `Resultado, ${moeda}`, // B l.961
  /** «Resultado na sua plataforma, US$» (a correction) */
  campoCorrigido: (moeda: string) => `Resultado na sua plataforma, ${moeda}`, // B l.961
  /** «Pelos preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão, com swap ou funding, se houver.» */
  notaDigitado: (moeda: string, swap: string) =>
    `Pelos preços não dá para saber o valor em ${moeda}: digite o resultado da sua plataforma, antes da comissão${swap}.`, // B l.926, 962
  /** «Antes da comissão, com swap ou funding, se houver.» */
  notaCorrigido: (swap: string) => `Antes da comissão${swap}.`, // B l.962
  swap: ', com swap ou funding, se houver', // B l.926 (forex and cripto)
  /** «Custos, US$» */
  custos: (moeda: string) => `Custos, ${moeda}`, // B l.413
  notaCustos: {
    forex: 'Comissão por lote da sua conta, ida e volta.',
    stocks: 'Comissão e taxas da corretora (SEC, FINRA).',
    options: 'Comissão e taxas da corretora (SEC, FINRA).',
    crypto: 'Taxas da corretora, em dólar.',
    b3: 'Corretagem, emolumentos e registro. O imposto não entra.',
  } as Record<string, string>, // B l.925
  /** «+11,5 pips» «+150 pts» «+0,75 por ação» «+0,55 no prêmio» «+450 por BTC» «+5,25 no preço» (RO `difTxt`) */
  pips: (v: string) => `${v} pips`, // B l.795
  pts: (v: string) => `${v} pts`, // B l.794
  porAcao: (v: string) => `${v} por ação`, // B l.796
  noPremio: (v: string) => `${v} no prêmio`, // B l.797
  porMoeda: (v: string, moeda: string) => `${v} por ${moeda}`, // B l.799
  noPreco: (v: string) => `${v} no preço`, // B l.800
}

/** The option block (Ações e opções, RO l.345–356, 1051–1053, 1126–1127, 1153–1159) */
export const OPCAO = {
  tipo: 'Tipo', // B l.346
  call: 'Call', // B l.346
  put: 'Put', // B l.346
  strike: 'Strike, US$', // B l.347
  vencimento: 'Vencimento', // B l.349
  hoje: 'Hoje', // B l.350
  /** «Sexta, 16 out» */
  sexta: (dia: string) => `Sexta, ${dia}`, // B l.351
  outraData: 'Outra data', // B l.352
  /** «SPY Call 790» */
  ativo: (objeto: string, tipo: string, strike: string) => `${objeto} ${tipo} ${strike}`, // B l.790
  /** «vence 15 out» */
  vence: (dia: string) => `vence ${dia}`, // B l.790
}

/** «Venceu sem valor» (RO l.372, 462, 968–973) */
export const VSV = {
  rotulo: 'Venceu sem valor', // B l.372
  escolhaVencimento: 'Escolha o vencimento primeiro.', // B l.970
  venceHoje: 'Vence hoje às 16:00 ET.', // B l.971
  /** «Vence em 14 out, às 16:00 ET.» */
  venceEm: (dia: string) => `Vence em ${dia}, às 16:00 ET.`, // B l.972
  /**
   * «Venceu em 15 out, às 16:00 ET: essa saída só pode ser registrada até as 04:00 ET do dia seguinte.»
   * N (the board never reaches it): step 2 of an open option, too late for the exit hour to name the
   * expiry's close (register_exit reads the hour as today's, or yesterday's while today's is more
   * than 12 hours ahead)
   */
  tarde: (dia: string) => `Venceu em ${dia}, às 16:00 ET: essa saída só pode ser registrada até as 04:00 ET do dia seguinte.`,
}

/** The new markets' field errors (RO l.1022–1053); the side of a stop or target: N */
export const ERROS_PRECOS = {
  /** «Informe o prêmio de entrada.» */
  vazio: (oque: 'preço' | 'prêmio', lado: 'entrada' | 'saída') => `Informe o ${oque} de ${lado}.`, // B l.1024
  /** «Use só números, como 1,08520.» */
  numero: (exemplo: string) => `Use só números, como ${exemplo}.`, // B l.1025
  /** «O prêmio precisa ser maior que zero.» */
  zero: (oque: 'preço' | 'prêmio') => `O ${oque} precisa ser maior que zero.`, // B l.1026
  /** «Use até 4 casas decimais.» */
  casas: (n: number) => `Use até ${n} casas decimais.`, // B l.1029 (A for the stop, strike, typed result and costs)
  pipsZero: 'Use pips maiores que zero.', // B l.1034
  precoStopZero: 'Use um preço maior que zero.', // B l.1034
  /** «Numa compra, o stop fica abaixo do preço de entrada.» */
  stopLado: (compra: boolean, oque: 'preço' | 'prêmio') =>
    `Numa ${compra ? 'compra' : 'venda'}, o stop fica ${compra ? 'abaixo' : 'acima'} do ${oque} de entrada.`, // N (the board never checks the side; the server refuses it)
  /** «Numa compra, o alvo fica acima do preço de entrada.» */
  alvoLado: (compra: boolean, oque: 'preço' | 'prêmio') =>
    `Numa ${compra ? 'compra' : 'venda'}, o alvo fica ${compra ? 'acima' : 'abaixo'} do ${oque} de entrada.`, // N
  qtdInteiraAcoes: 'Use um número inteiro de ações.', // B l.1045
  qtdInteira: 'Use um número inteiro.', // B l.1045
  opTipo: 'Escolha Call ou Put.', // B l.1051
  strikeVazio: 'Informe o strike.', // B l.1052
  strikeNumero: 'Use só números, como 790.', // B l.1052
  strikeZero: 'Use um strike maior que zero.', // B l.1052
  vencVazio: 'Escolha o vencimento.', // B l.1053
  vencAntes: 'O vencimento não pode ser antes do dia da entrada.', // B l.1053
  resVazio: 'Informe o resultado.', // B l.951
  resNumero: 'Use só números, como −57,50.', // B l.951
  custosNumero: 'Use só números, como 7,00.', // B l.954
  /** «Antes de 13 out esta conta não tinha regras: essas operações entram pela importação por colunas, logo depois da Fase 3.» */
  antesRegras: (desde: string) =>
    `Antes de ${desde} esta conta não tinha regras: essas operações entram pela importação por colunas, logo depois da Fase 3.`, // B l.1022–1023
}

/** Steps 2 and 3 of a price market (RO l.1247–1260, 1316–1338) */
export const PASSOS_PRECOS = {
  /** «prêmio 1,85» */
  premio: (preco: string) => `prêmio ${preco}`, // B l.1256
  /** «stop do prêmio 1,10» */
  stopPremio: (v: string) => `stop do prêmio ${v}`, // B l.1259
  pips: ' pips', // B l.1258
  baseDigitado: 'Resultado digitado por você.', // B l.1333
  baseEstimativa: 'Valor estimado pela cotação de saída; confira com a sua corretora.', // B l.1333
  /** «Custos US$ 7,00 · líquido +US$ 50,50» */
  custos: (custos: string, liquido: string) => `Custos ${custos} · líquido ${liquido}`, // B l.1334
  /** «com stop de 12 pips» */
  comStopPips: (v: string) => `com stop de ${v} pips`, // B l.1336
  /** «com stop em 38,20» */
  comStopEm: (v: string) => `com stop em ${v}`, // B l.1336
  /** «com stop do prêmio em 1,10» */
  comStopPremio: (v: string) => `com stop do prêmio em ${v}`, // B l.1336
  semResultado: '—', // B l.1331
}

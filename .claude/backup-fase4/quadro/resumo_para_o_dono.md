# Diário (Fase 4) · os dois quadros revisados

Os dois quadros do Diário eram de 14 de outubro, de antes das Fases 1 a 3c. Agora eles mostram o que o app já faz e
seguem as suas cinco respostas. Todos os números são inventados: nenhuma operação sua aparece neles.

## Revisão de 25 out · muitas contas

Você pediu que o Diário não ficasse comprido para quem tem 20 a 40 contas de mesa. O que mudou nos dois quadros:

- **«Posso operar hoje?» mostra só a conta aberta no Diário**, com a mesma linha de antes: a resposta («Liberado ·
  até 11:00 ET», «Fora da sua janela · abre amanhã às 10:00 ET», «Encerrado por hoje · limite atingido às 10:41»,
  «Sem janela salva · Definir») e o limite do dia. Quando o limite da conta soma as contas de Futuros, embaixo do limite
  aparece «somando as contas de Futuros».
- **Embaixo, uma linha só para as outras contas**, contando as respostas que existem, por exemplo «Outras 7 contas: 5 fora
  da janela · 2 sem janela salva». Quando todas estão no mesmo estado, «todas fora da janela». Sem outras contas, a linha
  não aparece. O botão «Ver todas» abre uma linha por conta, exatamente como era antes (fechado quando a página abre);
  «Ocultar» fecha. O «somando as contas de Futuros» aparece só na conta aberta. A visão de todas as contas vai para o
  Início, na Fase 8.
- **O seletor de contas, a partir de 10 contas**, ganha um campo de busca (nome da conta ou da mesa) e, dentro de um
  mercado com mais de uma conta, separa por mesa, com a quantidade («Futuros · 30», «Apex · 9»). Ao abrir, o cursor já
  está na busca; Esc fecha. A lista rola: a última conta visível aparece cortada ao meio e uma sombra na borda mostra
  que há mais. O leitor de tela anuncia o mercado e a mesa de cada conta. Com até 9 contas fica como estava (os outros
  cenários têm 8). «Contas de mercados diferentes nunca são somadas.» continua no fim da lista.
- O «i» do cartão ganhou uma frase: «Aqui aparece a conta aberta no Diário; as outras ficam numa linha, e “Ver todas”
  mostra a resposta de cada uma.»
- **Cenário novo: 9b · Muitas contas**, no quadro «Diário · 1º dez», logo depois do 9 (veja «Como clicar»).
- Quando uma resposta não cabe numa linha (tela média), o «·» fica no fim da primeira linha («Fora da sua janela ·»), e
  não mais no começo da segunda.
- O resto dos quadros não mudou. Como o cartão encolheu, o cenário que abre cada quadro ficou 262 px mais curto.

## O que mudou

- **Toda conta tem Diário**, inclusive a Ebinex (saiu o cartão que dizia que ela não tinha). Uma conta por vez: o
  seletor tem os seis mercados e repete o aviso do app, «Contas de mercados diferentes nunca são somadas.».
- **«Posso operar hoje?» fica no topo do Diário**: a conta aberta e uma linha para as outras, com «Ver todas» (revisão de
  25 out, acima).
- **Calendário.** O histórico importado (de antes das suas regras) aparece hachurado, com uma escala de cor só dele, e
  nunca entra na conta do dia, da semana nem na cor dos outros dias. O dia em que as regras começaram aparece com o
  histórico à parte. O aviso de revisões pendentes conta só os dias em que você registrou alguma operação no app. Sábado
  e domingo só aparecem na Cripto (ou num mês com operação no fim de semana). Na B3 os valores ficam em R$.
- **O dia.** O resultado é **líquido** em todo o Diário (dia, calendário, semana e cada operação); o bruto fica no «i».
  Uma operação ainda sem comissão aparece bruta, e o detalhe dela diz isso. O dia mostra operação aberta, parciais,
  breakeven e R, «Já fechada» (etiqueta «Registrada depois»), operação que veio só do arquivo («Do arquivo»), operação
  lançada na página antiga («Página antiga»), operação apagada (só a hora) e a operação aberta de ontem (uma linha com o
  link para o dia dela).
- **Detalhes da operação (▾).** Hora (com «registrada às …» quando você digitou outra hora), entrada e saída, saída
  média, stop e alvo, R, comissão, o que o arquivo completou ou corrigiu, a «Linha do tempo da operação», o «Posso operar
  hoje?» da entrada, imagens (abrem grandes), nota e as suas marcas com a hora de cada uma.
- **O plano do dia.** Janela, limite e a sua regra de breakeven (sem veredito; o veredito fica para Análises). «Antes de
  operar» agora existe, num campo curto no dia de hoje, guardado com a hora do servidor; ao lado, «Do pregão anterior».
- **Linha do tempo do dia:** por enquanto só o aviso «chega na Fase 5».
- **Revisão do dia.** Pode editar quando quiser; cada versão fica guardada com a hora e as anteriores ficam numa lista
  fechada, só para ler. «O diário registrou» guarda os números da hora em que você salvou.
- **Semana.** É a semana do dia aberto; na semana atual aparece «Semana em andamento». No lugar do viés entrou
  «Revisões».
- **Rodapé.** «Resultados líquidos: a comissão sai quando o arquivo da corretora a traz.» e o link discreto «Página
  antiga de operações» (apagar e exportar continuam lá).
- **Importações.** Ao desfazer uma importação, a confirmação diz quantas marcas, imagens e notas que você pôs no Diário
  saem junto com as operações daquele arquivo.
- **Ficou para depois (escondido, sem botão desligado):** estado do mercado, «o que a tela dizia», viés, bloqueio de dados,
  regra do estado e feriados (Fase 5); o cartão de Análises (Fase 6); «Seu foco da próxima semana» (Fase 7); os textos
  da IA (Fase 8). Nas contas de Futuros, o «i» do plano do dia avisa da Fase 5.
- O visual é o mesmo dos quadros aprovados (cores, fontes, claro e escuro). Os exemplos de contas são os do quadro do
  Registrar (o limite da Clear é R$ 500, como lá), mais a «Ylos 50k», que serve de exemplo de conta sem regras.

## Como clicar

No topo de cada quadro há uma faixa tracejada, «fora do produto», com o seletor «Cenário do protótipo» e o botão
«Recomeçar». Cada quadro lista os seus cenários e, embaixo, os do outro quadro do Diário, então dá para chegar a todos
por qualquer um dos dois. O botão de sol e lua troca entre claro e escuro.

### Quadro «Diário · 1º dez» (o principal; abre no cenário 2)

1. **2 · Um dia completo** (terça, 10 nov, aberta pelo calendário em 1º dez). Veja o calendário de novembro com ✓, ● e ■;
   o dia com 5 operações e **+US$ 267,93** líquido (o bruto está no «i» «Como ler os números do dia»). A primeira
   operação já vem aberta: «10:03–10:09 · registrada às 10:06», comissão, «Completada pelo arquivo de 11 nov», «Na
   corretora», duas imagens (toque numa para ver grande) e a marca trocada depois do resultado («antes: B às 10:06 ·
   agora: C às 11:20»). Abra ▾ nas outras: a MES de 3 ct em 2 saídas (breakeven, R e a linha do tempo dela), a MNQ
   «Registrada depois», a MGC («O arquivo corrigiu o preço de saída») e a «Do arquivo», fora da janela. Embaixo, «1
   operação registrada foi apagada às 10:20.» e a revisão: «Salva às 11:33 · editada às 18:05», «Depois da revisão, o dia
   mudou» e «Versões anteriores (1)».
2. **3 · Limite atingido** (quinta, 19 nov). Etiqueta «Limite atingido às 10:38», cartão «US$ 465,40 de US$ 400», a
   última venda com «● depois do limite»; no ▾ dela, o «Posso operar hoje?» dizia «Encerrado por hoje».
3. **3 · com “Só avisar”** (o mesmo dia, se as regras só avisassem). O plano diz «US$ 400 · só avisa», a entrada diz
   «Liberado · com aviso do limite» e «pelas suas regras, é só um aviso.»; a operação continua fora do plano.
4. **4 · Calendário** (Top One em outubro, com o «i» aberto). De 1 a 13 out, hachurado: histórico. 14 out é o dia em que as
   regras começaram (a operação das 08:50 fica no histórico, à parte). A semana de 12 a 16 out mostra «▨ +163,29» à parte.
   20 e 27 out dizem «sem revisão» (passe o mouse); 28 out não tem ✓ nem aviso, porque veio só do arquivo. Toque em 21 out
   para ver uma operação lançada na página antiga (etiqueta «Página antiga») e duas «Registrada depois». Teste «Ver no
   calendário» no aviso de pendentes, as setas ‹ › e as setas do teclado num dia.
5. **5 · Um dia do histórico** (quinta, 8 out). Só para ler: «Histórico importado · só resultado», sem plano nem revisão.
6. **9 · Somando as contas de Futuros** (Lucid 50k, hoje). O seletor de contas aberto; o cartão «US$ 172,25 de US$ 400 ·
   pior momento · somando as contas de Futuros» (a perda da Top One no mesmo dia entra na soma) e o «i» que explica que
   uma conta arquivada sai da soma, também nos dias passados. A linha «1 operação aberta de ontem» leva a 30 nov.
7. **9b · Muitas contas** (Top One entre 35 contas, hoje 1º dez: 30 contas de mesas de Futuros e as outras do quadro).
   Abre com «Ver todas» aberto: «Outras 34 contas: 19 liberadas · 3 encerradas por hoje · 9 fora da janela · 3 sem
   janela salva» e uma linha por conta (as Apex 50k #5 e #6 copiaram as mesmas três operações e encerraram às 10:41).
   Toque em «Ocultar» e em «Ver todas». Depois toque em «Conta: Top One»: digite «apex» (9 contas), «funded» (acha as
   MFFU pela mesa My Funded Futures) ou um nome que não existe («Nenhuma conta com “…”.»); Esc fecha. Escolha «Apex 50k
   #5»: o cartão mostra «Encerrado por hoje · limite atingido às 10:41» e a linha das outras passa a contar a Top One.
   Neste cenário você continua entre as 35 contas ao escolher qualquer uma (as contas inventadas só têm o dia de hoje).
   Escolha também a «Lucid 50k»: embaixo do limite dela aparece «somando as contas de Futuros» (leia a observação no
   fim).
8. **11 · Semana fechada** (23 a 27 nov). Resultado, Operações, Fora do plano (5), Revisões «4 de 4», as barras e a lista.
9. **11 · Semana em andamento** (hoje, 1º dez). «Semana em andamento · 2 de 5 pregões» e «Revisões 0 de 1».
10. **13 · Rodapé, página antiga e Importações.** «Como o diário grava» aberto, o rodapé líquido e o link «Página antiga de
   operações». Embaixo, o painel Importações da Top One (de Personalizar), com o desfazer de 11 nov já perguntando:
   «Desfazer apaga as 5 operações desta importação, e as 13 registradas por você voltam a ser como estavam antes dela.» e
   «Saem junto: 2 marcas e 1 nota que você pôs no Diário.». Teste também o de 25 nov: «Desfazer não apaga nada».

### Quadro «Diário · hoje» (abre no cenário 1)

1. **1 · Hoje, no meio da janela** (quinta, 12 nov, 10:42 ET). «Liberado · até 11:00 ET» no topo; a operação aberta já
   vem com o ▾ aberto: «1 parcial, +US$ 40,00 · stop no breakeven» e «Registrar saída». O resultado do dia (+US$ 85,00)
   conta só o que já saiu; «Operações 2 · 1 aberta». «Antes de operar» foi «anotado às 09:40, antes da 1ª entrada»
   (teste «Editar»). Revisão ainda fechada: «Escrever revisão».
2. **6 · Binárias** (Ebinex, quarta, 11 nov, 21:20 de Brasília). Sem limite; o ▾ da primeira mostra «20:10 · vela
   20:11–20:12 de Brasília», «Stake · payout» e «Como terminou?». Uma devolvida (US$ 0,00) e uma aberta fora da janela,
   com «Vence às 21:30 de Brasília.» e «Registrar resultado».
3. **7 · Cripto com fim de semana** (Binance, sábado, 14 nov). Calendário com Sáb e Dom, «Valores em US$ (USDT e USDC
   contam como dólar).», BTC com «+850 por BTC» e um ETH aberto. Semana «6 de 7 pregões».
4. **8 · B3 em reais** (Clear, 12 nov). «−R$ 180,00», cartão «R$ 180,00 de R$ 500», «Valores em R$.».
5. **10 · Estados sem dados**, um por vez: conta sem regras (Ylos 50k: aviso com «Definir as regras» e o histórico
   hachurado), conta sem operações (IBKR), «Carregando…», «Não foi possível carregar o Diário.» com «Tentar de novo» e
   «Sem conexão» (aperte «Salvar revisão»: aparece «Sem conexão. A revisão não foi salva.» e o texto fica no formulário).
6. **12 · Celular 375 px, claro.** O 10 nov com a operação em 2 saídas aberta e a revisão em edição; role para ver o mês.
7. **12 · Celular 375 px, escuro.** A primeira imagem aberta grande, com «Imagem 1 de 2», «Anterior», «Próxima» e
   «Fechar».

## Escolhas para você confirmar

Cada item diz o que está desenhado e qual seria a outra opção. Se não disser nada, fica como está desenhado.

1. **«O dia mudou» também quando só chegou a comissão.** Desenhado: a revisão de 19 nov foi salva com «5 operações ·
   −US$ 453,00»; quando o arquivo trouxe as comissões, ela passou a mostrar «Depois da revisão, o dia mudou: agora 5
   operações, −US$ 465,40.». Com o resultado líquido, isso vai aparecer em quase todo dia de Futuros revisado antes do
   arquivo chegar. Outra opção: avisar só quando entrar ou sair uma operação ou mudar um preço; a comissão sozinha não
   conta.
2. **«Revisões» da semana deixa hoje de fora até você escrever a revisão dele.** Desenhado: na semana em andamento de 1º dez
   aparece «0 de 1» (só 30 nov conta). Outra opção: contar hoje assim que houver uma operação registrada no app («0 de 2»).
3. **No celular, a setinha ▾ fica no canto de baixo, à direita, em todas as linhas**, para a ordem do teclado seguir a
   ordem da tela. Outra opção: mudar só nas linhas que têm «Registrar saída» ou «Registrar resultado» e deixar ▾ no
   meio nas outras. (Na linha aberta da Ebinex, «Registrar resultado» desce para baixo de «● fora da janela».)
4. **O exemplo de hora digitada fica na primeira operação do 10 nov** («10:03–10:09 · registrada às 10:06»), que já abre
   sozinha. Outra opção: o exemplo do plano, em 1º dez («10:04–10:06», registrada às 10:09), em que a saída vem antes do
   registro e fica menos claro se as marcas contam como antes da saída.
5. **«Antes de operar» pode ser editado durante o dia.** Desenhado: «Editar» no dia de hoje; a nota guarda a primeira
   hora e acrescenta a da edição («anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada»).
   Dias passados só para ler. Outra opção: depois de salva, a nota não muda.
6. **O «i» de «Suas marcas» no Diário é o mesmo do Registrar**, que fala dos níveis «Confirmada» e «Pouco
   fundamentada» dos Padrões. Outra opção: no Diário, até a Fase 7, um texto sem esses nomes (só que as marcas feitas
   depois do resultado contam menos nos Padrões).

### Escolhas da revisão de 25 out (muitas contas)

7. **A partir de quantas contas o seletor ganha busca e mesas.** Desenhado: 10. Os outros cenários têm 8 contas e ficam
   como estavam. Outra opção: a partir de 8, e então todos os cenários mostram a busca e as mesas.
8. **«Ocultar» para fechar a lista.** O quadro já usa «Esconder revisão» e «Esconder versões anteriores». Outra opção:
   «Esconder», igual a eles.
9. **A ordem das contagens**: liberadas · encerradas por hoje · fora da janela · sem janela salva. Outra opção: começar
   pelas encerradas, que são as que pedem atenção.
10. **O 9b abre com o seletor fechado**, porque aberto ele cobre a linha das outras contas. Outra opção: abrir com o
    seletor aberto, como o cenário 9.

**Observação (não é escolha de desenho).** «Somando as contas de Futuros» soma todas as contas de Futuros ativas. No 9b,
com 30 contas, a Lucid 50k encerrou às 10:20 pelas perdas das Apex («US$ 1.113,25 de US$ 400»), e a venda dela das
10:41 ficou «depois do limite». Isso já é a regra do app; o quadro só mostra. Se a soma devesse valer só para algumas
contas, isso entra nos «Grupos de contas», que ficaram para depois da Fase 4.

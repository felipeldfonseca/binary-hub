# Quadro «Adicionar ou importar conta» · Fase 3b (importação por colunas)

O quadro está publicado no canvas (versão 67), na linha «Contas e registro»: abra «Adicionar ou importar conta» e clique.
Os dados são todos inventados: contas, números e operações.

## O que mudou

**A importação de arquivos que o app não conhece passa a ir até o fim.** Antes, o cenário 8 parava em «Colunas prontas».
Agora o caminho completo é:

1. Você diz o que é cada coluna.
2. Confere 3 linhas.
3. Escolhe o fuso.
4. Vê a prévia e importa.

O modelo de colunas é salvo quando a importação termina. Não existe mais a parada no meio do caminho.

**Suas quatro respostas estão desenhadas:**
- **Tradovate.** É a plataforma de futuros dos exemplos, com o arquivo de ordens (aba Orders) e o Performance.csv.
- **Arquivos de execuções (uma compra ou venda por linha).** Viram operações, como você decidiu na 3c:
  - cada entrada é uma operação;
  - as vendas fecham primeiro as compras mais antigas;
  - venda de parte da posição vira saída parcial.
- **Ativo que não fecha no fim do arquivo.** A pergunta «No fim do arquivo, {ativo} ficou posicionado?» aparece por
  ativo, com «Não sei» já marcado. Com «Não sei», o ativo fica de fora.
- **As mesmas operações em dois formatos na mesma conta.** A prévia avisa e conta só as operações que entrariam.

**Cenários novos:**
- **15 · Próximo arquivo com as mesmas colunas.** O modelo salvo reconhece o arquivo, que vai direto à prévia. Há uma
  variante em que a plataforma acrescentou uma coluna.
- **16 · Arquivo de execuções.** Quatro arquivos:
  - Tradovate;
  - Tradovate terminando posicionado;
  - Binance;
  - Interactive Brokers.
- **17 · Duas contas no arquivo (NinjaTrader).** Entra uma conta do arquivo por importação.
- **18 · Forex por colunas.** Com swap, e com datas que podem ser dia/mês ou mês/dia.
- **19 · B3 em reais, sem conta escolhida.** Começa por «Para qual conta?», com valores em R$.

**No 9 · Erros, duas entradas novas:**
- «Arquivo não reconhecido em binárias»: «Em contas de binárias, lemos só o CSV da Ebinex.»
- «Planilha do Excel»: «Salve como CSV na sua plataforma ou no Excel e tente de novo.»

**Os passos que já existiam usam o mesmo texto do app de hoje:**
- A área de soltar diz só «CSV», e o botão é «Escolher arquivo».
- Na contagem, «em Apex A» virou «em outra conta» (cenário 4).
- «Linhas sem data» virou «3 linhas com erro foram puladas.» + «Ver linhas».
- O fim diz «Desfazer depois: Personalizar › Suas contas › Importações.»
- O bloco «Sem comissão no arquivo. Informe por contrato» / «Seguir bruto» saiu (cenários 2, 4 e 6). Agora a prévia diz
  «Sem comissão no arquivo: estas operações ficam sem comissão.» A comissão fica desconhecida, nunca zero.

**Contas de mercados novos (cenários 11 a 14):**
- O fim da criação volta a oferecer «Importar histórico».
- A exceção é o MetaTrader (cenário 11), cujo relatório não é CSV.
- A nota «Ainda não lemos arquivos…» saiu.

**Fundo do quadro:**
- «Registrar operação» é o botão principal.
- O menu da conta lista as contas por mercado.

**Dica da Tradovate (cenário 7):** «Account reports › aba Orders ou Performance › Download Report.»

## O que clicar, nesta ordem

Use a barra do protótipo no alto: «Cenário do protótipo» e, quando houver, «Arquivo».

1. **8 · Arquivo não reconhecido (uma operação por linha)**, arquivo «Conta sem outro formato» (conta Ylos 50k,
   plataforma BlackArrow).
   - **Colunas:**
     - Cada coluna já vem com uma sugestão pelo nome (etiqueta «sugerida»).
     - Abra «Mudar» e escolha o separador «,». Aparece o aviso de que as linhas não fecham.
     - Troque «Papel» para «Quantidade». Aparece «Esta coluna não parece número.», e «Continuar» trava.
   - **Confira 3 linhas:** a pergunta «O resultado do arquivo já desconta a comissão?» já vem respondida «Sim, é líquido».
     Ela foi conferida pelos preços: «−US$ 37,50 − US$ 2,48 = −US$ 39,98».
   - **Fuso:** escolha um. Não existe mais «Lembrar…»: o fuso é o da conta.
   - **Prévia:** «18 linhas · 18 novas…» e «Sem hora de saída, o resultado conta no limite do dia na hora da entrada.»
   - **Fim:** «Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.»
2. **8**, arquivo «Conta que já recebe outro formato» (conta Top One).
   - **Fuso:** UTC já vem marcado, porque é o fuso das importações da Top One.
   - Marque Brasília: o app recusa, explica e trava «Continuar».
   - Volte para UTC. A prévia mostra o aviso «18 operações caem em dias em que Top One já tem operações de outro formato
     de arquivo…».
3. **8**, arquivo «Performance.csv da Tradovate» (conta Lucid 50k).
   - **Sem coluna de lado:** a compra e a venda vêm em colunas, e o lado sai de qual veio primeiro.
   - **Perda:** «$(13.75)» é lida como −13,75.
   - **IDs:** buyFillId e sellFillId vêm em «Ignorar esta coluna». Marque buyFillId como ID para ver o aviso «Esta coluna
     repete valores: não serve de ID.»
   - **Confira 3 linhas:** a 1ª e a 2ª linhas viram uma operação com 2 saídas.
   - **Prévia:** «Importar 4 operações». São as mesmas 4 operações do arquivo de ordens do cenário 16, com os mesmos
     horários e resultados: +55,00, +7,50, +17,00 e +23,75.
4. **15 · Próximo arquivo com as mesmas colunas.**
   - **Prévia direta**, com o selo «Colunas do modelo “BlackArrow”» e o botão «Mudar colunas».
   - **Contagem:** «1 já registrada por você · 18 já estavam (mesmo ID)».
   - **Arquivo «Uma coluna a mais»:** o título é «Este arquivo mudou desde o modelo “BlackArrow”». A coluna «Estratégia»
     traz a etiqueta «nova», e a caixa diz «Atualizar o modelo “BlackArrow”».
5. **16 · Arquivo de execuções**, arquivo «Tradovate (futuros)».
   - **Colunas:**
     - «Cada linha do arquivo é» já vem em «uma execução».
     - O app sugere «Filled Qty», «Avg Fill Price» e «Fill Time».
     - «Quantity», «Limit Price» e «Timestamp» ficam em «Ignorar».
   - **Confira 3 linhas:**
     - Lembrete: a quantidade é a executada e o horário é o da execução.
     - «Viram 4 operações…».
     - Abra «Ver as 4 operações».
   - **Prévia:**
     - «9 execuções no arquivo», «6 saídas · 6 novas · 0 já estavam»;
     - «2 ordens sem execução ficaram de fora.»;
     - «Sem comissão no arquivo…».
6. **16**, arquivo «Tradovate, termina posicionado».
   - **A pergunta:** «No fim do arquivo, MESZ6 ficou posicionado?», com «Não sei» marcado. As 7 execuções de MESZ6 ficam
     de fora.
   - Clique em «Sim» e depois em «Não»: a lista de operações e a prévia mudam com cada resposta.
7. **16**, arquivo «Binance (cripto)».
   - **Fuso:** não há esse passo. A coluna «Date(UTC)» já diz o fuso.
   - **A pergunta:** é sobre ETHUSDT.
   - **Prévia:** «1 operação fica sem comissão: a taxa veio em BNB.» e a linha do dia de Cripto, que vira à meia-noite de
     Brasília.
8. **16**, arquivo «Interactive Brokers (ações)».
   - **Lado:** a quantidade com sinal faz o papel do lado.
   - **Sem pergunta de fim do arquivo:** a coluna «Abre ou fecha» resolve.
   - **Prévia, em «Ver linhas»:** a opção fica de fora, assim como a venda que fecha uma posição de antes do arquivo e a
     posição ainda aberta no fim.
9. **17 · Duas contas no arquivo (NinjaTrader).**
   - **Colunas:** o chip «Datas: mês/dia» aparece, e o arquivo não tem ID.
   - **Confira 3 linhas:** a resposta já vem «Não, é bruto».
   - **Passo «2 contas neste arquivo»:**
     - APX-0001 vem em «Importar em Apex A».
     - Troque para APX-0002: a outra conta passa sozinha para «Não importar», e aparece o aviso do número da conta.
   - **Prévia:**
     - «26 não importadas (APX-0002)», ou o contrário;
     - «MNQ 12-26» vira «MNQZ26».
10. **18 · Forex por colunas.**
    - **Confira 3 linhas:** a pergunta é «O resultado do arquivo já tem a comissão e o swap?».
    - **Prévia:** «1 operação com swap…» e «o dia de Forex vira às 17:00 de Nova York».
    - **Fuso:** escolha «Outro» → Chicago. Agora são 2 operações em outro dia.
    - **Arquivo «Datas ambíguas»:** a pergunta dia/mês ou mês/dia trava «Continuar» até você responder.
11. **19 · B3 em reais, sem conta escolhida.**
    - **Começo:** «Escolher arquivo» → «Para qual conta?», com as contas separadas por mercado. Escolha Mini-índice.
    - **Colunas:**
      - A pergunta sobre o «X» na coluna de lado.
      - «131.250» é lido como 131250, porque «88,50» mostra que a vírgula é o decimal.
      - Emolumentos somam na comissão.
    - **Prévia:**
      - tudo em R$;
      - «Linha 9: preço fora do passo do WIN (de 5 em 5)».
    - **Arquivo «Só preços»:** a pergunta «Como ler os números deste arquivo?». Marque «131,25» para ver o aviso.
12. **9 · Erros:** «Arquivo não reconhecido em binárias» e «Planilha do Excel».
13. **Cenários que já existiam:**
    - **7:** a dica da Tradovate.
    - **2, 4 e 6:** sem «Informe por contrato».
    - **11 a 14:** «Importar histórico» no fim.

## O que você precisa confirmar

Cada item diz o que está desenhado e, entre colchetes, a alternativa.

1. **Onde fica o Performance.csv da Tradovate.** Desenhado: ele é uma opção do cenário 8, na conta Lucid 50k. O modelo
   vem com o nome «Tradovate», o mesmo do arquivo de ordens do cenário 16. [Um cenário só dele; ou um nome diferente,
   como «Tradovate (Performance)», para os dois modelos não terem o mesmo nome.]
2. **Execuções que ficam de fora não entram em «com erro».** Desenhado:
   - a prévia de um arquivo de execuções conta saídas: «6 saídas · 6 novas · 0 já estavam», com «9 execuções no arquivo»
     em cima;
   - o que fica de fora vai num quadro próprio com «Ver linhas»: ativo que não fecha, posição de antes do arquivo, opção.

   [Contar essas execuções em «com erro», como na contagem dos outros arquivos.]
3. **Como reconhecer a reimportação do Performance.csv.** Desenhado: as colunas buyFillId e sellFillId ficam em
   «Ignorar», porque cada uma se repete entre linhas. Reimportar o mesmo arquivo é reconhecido pela mesma hora e preço.
   [Um ID feito das duas colunas juntas: mais seguro contra duplicar, mas é um campo novo.]
4. **A frase sobre compra e venda em colunas.** Desenhado: «Sem coluna de lado, marque Compra e Venda (data e hora) e o
   preço de cada uma.» aparece na linha de opcionais de todo arquivo de uma operação por linha. [Só na lista de cada
   coluna; ou só quando o arquivo não tem coluna de lado.]
5. **Binance sem o passo do fuso.** Desenhado: a coluna se chama «Date(UTC)», então o app usa UTC sem perguntar. A
   prévia diz «Os horários já trazem o fuso (UTC).» [Mostrar o passo do fuso com UTC já marcado.]
6. **Conta do arquivo diferente do número da conta (cenário 17).** Desenhado: você pode mandar APX-0002 para Apex A. O
   app só avisa «O número na plataforma de Apex A é APX-0001.» [Impedir: só entra o valor igual ao número da conta.]
7. **As contas dos exemplos.** Desenhado:
   - o cenário 8 usa «Ylos 50k» (plataforma BlackArrow) como a conta sem outro formato;
   - a Tradovate usa «Lucid 50k»;
   - a variante com outro formato usa a Top One.

   [Outros nomes. A Top One só aparece onde o aviso de dois formatos é o assunto.]

Fica fora deste quadro, como já combinado:
- a lista de modelos;
- importar várias contas do arquivo de uma vez;
- comissão vinda de outro arquivo da Tradovate;
- o passo «Como as operações chegam?».

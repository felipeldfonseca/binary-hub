# Fase 3b · importação por colunas: 4 perguntas para você

Juntei os quatro levantamentos: o que existe hoje, os arquivos das corretoras, o quadro e o banco. Uma revisão apontou 16
pontos, e todos foram corrigidos. O plano em poucas linhas:

- **Como funciona.** Quando o app não reconhece um arquivo, você diz uma vez o que é cada coluna: data e hora, ativo, lado,
  quantidade, resultado ou preços. Depois salva como modelo, e o próximo arquivo com as mesmas colunas entra direto.
- **Depois do mapeamento, o caminho é o de hoje.** Fuso, prévia, importar e «Desfazer», como na Top One e na Ebinex.
  - As operações que você registrou no app continuam sendo reconhecidas, e o arquivo completa o dinheiro.
  - As saídas parciais em várias linhas viram uma operação com várias saídas, como na 3c.
- **Mercados.** Vale para Futuros de outras plataformas, Forex, Ações dos EUA, Cripto e B3. Binárias continuam só com o CSV
  da Ebinex.
- **Dinheiro.** Vale o resultado do arquivo. Sem coluna de resultado, o app calcula pelos preços onde a conta é exata: são
  os mesmos ativos do Registrar.
- **Ordem.** Primeiro vem o quadro para você aprovar: o cenário 8 revisado e cenários novos. Depois vem a colagem no banco,
  que confere sozinha que nada do que já existe muda. Só então vêm as telas.
- **Tempo.** Cerca de 13 a 16 dias de trabalho com os arquivos de execuções (pergunta 2), ou 9,5 a 12 sem eles.

Sobraram quatro escolhas que só você pode fazer.

---

## 1. Que contas de futuros fora da Top One você tem ou vai ter?

A Top One e a Ebinex já têm leitor próprio; a 3b serve para os outros arquivos. O app vai ler qualquer CSV, porque você
diz o que é cada coluna. Mas o primeiro arquivo que eu preparar para o teste, e o que o app sugere pelos nomes das
colunas, dependem de onde você opera de verdade.

- **Futuros.** Em que outras mesas e plataformas você tem ou pretende ter conta: Tradovate, NinjaTrader, Rithmic,
  ProjectX (TopstepX), Quantower, BlackArrow, WealthCharts…
- **Outros mercados.** A corretora de cada um, se já souber: Forex, Cripto, Ações dos EUA, B3.
- **A primeira linha do arquivo.** Se puder, mande só a primeira linha do arquivo que a plataforma exporta: os nomes das
  colunas, sem nenhuma operação. O repositório é público, então só os nomes entram nele, e os testes usam operações
  inventadas.

Se você ainda não tem nenhuma, sigo com formatos públicos e arquivos inventados, começando pelo arquivo de ordens da
Tradovate, que o próprio quadro manda usar. No MES e no MNQ o app calcula o resultado pelos preços, então no teste você
confere os números de olho.

Um cuidado: se for importar na conta Top One um arquivo de outra plataforma com as mesmas operações, é o caso da
pergunta 4.

---

## 2. Arquivos com uma compra ou uma venda por linha

A maioria das plataformas não exporta uma operação por linha. Ela exporta cada execução, cada compra e cada venda, numa
linha.
- É assim na Tradovate (aba Orders, que o próprio quadro manda usar), no NinjaTrader, na Rithmic, na IBKR, na Binance e na
  lista de ordens do Profit.
- O quadro de hoje só desenha «uma operação por linha».
- Para ler esses arquivos, o app junta as compras e as vendas de cada ativo em operações, como você decidiu na 3c: cada
  compra que abre ou aumenta a posição vira uma operação, e as vendas fecham primeiro as compras mais antigas. Uma venda
  que fecha só parte de uma compra vira uma saída parcial dessa operação. Na venda a descoberto é o mesmo, ao contrário.
- Ordens canceladas ou sem execução ficam de fora, e a prévia diz quantas.
- **A Tradovate não põe a comissão nesse arquivo.** As operações que vierem dele ficam sem comissão, e o limite do dia
  conta o resultado bruto delas. As que você registrou no app mantêm os custos que você digitou.

- **(a)** Sim, na 3b, como a última parte. Custa mais 3,5 a 4 dias e um cenário novo no quadro. **(Recomendado)**
- **(b)** Não: a 3b lê só uma operação por linha, e as execuções ficam para uma fase depois.
- **(c)** Em vez desse modo geral, um leitor próprio para cada plataforma.

Por que (a): sem isso, a importação por colunas não serve para a Tradovate nem para a Rithmic, e a 3c já guarda várias
saídas numa operação.

---

## 3. Quando as compras e as vendas de um ativo não fecham no fim do arquivo

Num arquivo de execuções, pode sobrar posição num ativo no fim do arquivo. Isso tem duas causas, e muitas plataformas
(a Tradovate, a Rithmic) não trazem uma coluna que diga qual é:
- você exportou com a operação ainda aberta;
- o arquivo começou com uma posição aberta antes do primeiro dia dele. Nesse caso, se o app supuser que o arquivo começou
  zerado, todas as operações desse ativo saem emparelhadas errado, não só a última.

- **(a)** O app pergunta uma vez por ativo: «No fim do arquivo, MES ficou posicionado?» **(Recomendado)**
  - «Sim»: as operações do arquivo valem, e a parte ainda aberta fica de fora.
  - «Não»: o arquivo começou com uma posição de antes. As vendas (ou compras) que a fecham ficam de fora, e o resto entra
    certo.
  - «Não sei», que já vem marcado: todas as execuções desse ativo no arquivo ficam de fora.
- **(b)** Sem perguntar: todo ativo que não fecha fica de fora inteiro.
- **(c)** Recusar o arquivo inteiro.

Por que (a): nunca entra operação pela metade nem emparelhada errado sem você ver, e os casos comuns se resolvem com um
clique.

Vale para todas as opções: uma posição só entra quando você importar um arquivo que tenha a abertura e o fechamento dela.
Na Rithmic, que exporta um dia por arquivo, uma posição que passou a noite não entra pelo arquivo; registre-a no app. E
um caso continua sem aviso: uma posição que já estava aberta no começo e continua aberta no fim, do mesmo tamanho.

---

## 4. As mesmas operações em dois arquivos diferentes da mesma conta

Um exemplo: a conta Top One já recebe o Trade History da Top One. Se você também importar nela o arquivo da Tradovate (ou
do NinjaTrader) dessa mesma conta, o app vê IDs diferentes e não sabe que são as mesmas operações. Entraria tudo duas
vezes.

Isso só acontece com dois formatos diferentes na mesma conta:
- reimportar o mesmo arquivo, ou outro do mesmo formato, nunca duplica;
- as operações que você registrou no app continuam sendo reconhecidas.

- **(a)** A prévia avisa, e você decide se importa: «12 operações caem em dias em que Top One já tem operações de outro
  formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.» O aviso conta só as operações que entrariam,
  então reimportar o mesmo arquivo não avisa. **(Recomendado)**
- **(b)** O app pula sozinho as que parecem iguais: mesmo ativo, lado, quantidade e preço, com até 1 minuto de diferença na
  entrada.
- **(c)** Uma conta aceita um formato só; um segundo formato é recusado.

Por que (a): pular sozinho pode sumir com uma operação de verdade, como dois scalps iguais no mesmo minuto. Com o aviso,
nada some sem você ver, e o «Desfazer» resolve um engano.

---

## Se você não disser nada, seguimos assim

- **As quatro perguntas.** Ficam na opção recomendada. Na pergunta 1, sem resposta, sigo com o arquivo de ordens da
  Tradovate e arquivos inventados.
- **Arquivos e mercados.**
  - Só CSV. Uma planilha do Excel recebe «Salve como CSV na sua plataforma ou no Excel e tente de novo.»
  - Binárias continuam só com o CSV da Ebinex.
  - Um arquivo da Top One ou da Ebinex com uma ou duas colunas faltando continua dando erro na conta desse mercado. Em
    qualquer outro caso, o app pede para você dizer o que é cada coluna.
- **O caminho, sem paradas.** Mapear, conferir, fuso, prévia e importar seguem direto.
  - O modelo é salvo quando a importação é feita, nunca numa importação abandonada.
  - O «Desfazer» não apaga o modelo.
- **Ajuda no mapeamento.**
  - O app sugere o que é cada coluna pelo nome. Nos arquivos de execuções, prefere a quantidade executada e o horário da
    execução, e lembra você de conferir isso.
  - Ele avisa quando uma coluna não parece data, número ou compra e venda.
  - Ele detecta o separador e a ordem das datas. Se as datas não deixarem claro, pergunta.
  - Ele decide a vírgula ou o ponto decimal uma vez para o arquivo todo, pelos números que não deixam dúvida (como
    «88,50»). Um número como «131.250» pode ser 131 mil ou 131,25; se nada no arquivo resolver, o app pergunta.
- **Resultado e custos.**
  - Com colunas de resultado e de custos, o app pergunta se o resultado já é líquido: «O resultado do arquivo já desconta
    a comissão?», ou «… já tem a comissão e o swap?» quando há swap. Quando os preços permitem conferir, a pergunta já
    vem respondida. A resposta fica guardada no modelo.
  - Assim o swap nunca conta duas vezes: o resultado guardado é sempre antes da comissão e com o swap, como no Registrar.
  - Corretagem, emolumentos e outras taxas em colunas separadas somam na comissão.
  - Num arquivo sem comissão, ela fica desconhecida, e o bloco «Informe por contrato» sai do quadro.
  - Nos arquivos de execuções, vale o resultado realizado do arquivo quando ele existe; os preços só conferem.
- **Aumentar a mão.** Cada entrada vira uma operação, como você decidiu na 3c: uma entrada, várias saídas, sem preço
  médio.
- **Arquivo sem coluna de ID.**
  - Mesma entrada, ativo, lado, quantidade e preços é a mesma operação, então reimportar não duplica.
  - Duas linhas idênticas no mesmo arquivo viram uma operação com duas saídas, como as linhas da Top One de uma mesma
    posição, com aviso. Nada se perde, e reimportar não duplica.
- **Mesmo ID em outra conta.** Só fica de fora («em outra conta») quando as duas contas são do mesmo mercado e da mesma
  plataforma.
- **Arquivo com várias contas.** Uma conta do arquivo por importação: a que tem o mesmo «Número na plataforma» já vem
  marcada, e as outras ficam para importar depois, cada uma na sua conta. O que já entrou não duplica.
- **Fuso.** Continua por conta. O primeiro arquivo de cada modelo sempre pergunta o fuso, já marcando o da conta. Se for
  diferente do fuso das importações que a conta já tem, o app recusa e explica. Um arquivo por colunas nunca muda o
  horário das operações que já estão na conta.
- **Sem tela de lista de modelos por enquanto.** «Mudar colunas» corrige o modelo e salva por cima. Quando a plataforma
  muda as colunas, «Atualizar o modelo» troca as colunas do mesmo modelo, sem criar outro.
- **O que fica de fora.**
  - Opções dos EUA, com o motivo: «registre no Registrar».
  - Cripto fora do dólar.
  - Nenhum valor é convertido de moeda.
- **Futuros escritos de outro jeito.** «MES 12-26» é guardado como «MESZ26», para o app calcular e reconhecer o que você
  registrou.
- **Para depois.** O passo «Como as operações chegam?», as dicas de exportação por plataforma, importar várias contas do
  arquivo de uma vez, e a comissão vinda de outro arquivo (o Cash History da Tradovate).
- **O quadro.** O cenário 8 revisado e cinco cenários novos:
  - próximo arquivo com as mesmas colunas;
  - execuções (Tradovate, Binance e IBKR);
  - duas contas no arquivo;
  - Forex;
  - B3 sem conta escolhida.

  Os passos comuns ficam com o texto que o app já usa.
- **O teste.**
  - Arquivos inventados, na Apex #1 e em duas contas de teste novas (Forex e B3), arquivadas no fim. Os lotes são
    desfeitos no fim.
  - Se as contas de Forex e de B3 que você criou no teste da 2b forem só de teste, me diga, e uso elas.
  - As contas Top One e Ebinex não são tocadas.
- **A colagem no banco.** Vem antes do app, como na 3c, e confere sozinha que nenhuma operação, conta, regra ou dia muda.

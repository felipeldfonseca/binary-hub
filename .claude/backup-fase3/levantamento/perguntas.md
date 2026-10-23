# Fase 3 · Registrar operação: 4 perguntas para você

Juntei os cinco levantamentos da Fase 3. Quase tudo já se resolve com o que você decidiu antes ou com um padrão
que proponho (lista no fim). Sobraram quatro escolhas que só você pode fazer.

---

## 1. Dá para corrigir a hora da entrada?

O protótipo deixa você digitar a hora da entrada (por exemplo, registrar às 10:12 uma entrada das 10:07). O plano
técnico gravava sempre a hora do servidor. Nos dois casos, o app guarda à parte a hora em que você registrou, e as
marcas (setup, execução, emoção) são sempre julgadas pelo relógio do servidor. A hora da entrada é a que decide o
«Posso operar hoje?» gravado na operação.

- **(a)** Pode corrigir, até 15 minutos antes de agora. Para uma entrada mais antiga, use «Já fechada» (aí as marcas contam
  como depois do resultado). **(Recomendado)**
- **(b)** Sempre a hora do servidor, sem campo de hora.
- **(c)** Qualquer hora do mesmo dia.

Por que (a): cobre o registro com alguns minutos de atraso no celular e impede que uma entrada de horas atrás pareça
registrada ao vivo. Na Ebinex pesa mais: você costuma mandar a ordem nos últimos segundos do minuto, e o registro cai no
minuto seguinte. O Registrar mostra «Vence às 20:12 de Brasília» antes de você registrar; se estiver um minuto atrasado, você
volta a hora um minuto. Com (b) isso não dá, e o vencimento ficaria um minuto atrasado nesses casos.

O cuidado com (a): a hora digitada decide o «Posso operar hoje?», então uma entrada logo depois da janela poderia ser
digitada dentro dela. O app guarda sempre, à parte, a hora real do registro.

---

## 2. O arquivo da corretora chega depois e os números não batem. Qual vale?

Com o Registrar, a mesma operação vai aparecer duas vezes: a que você registrou e a linha do arquivo da Top One ou da
Ebinex. O app vai reconhecer que é a mesma (mesmo ativo, lado, contratos ou valor, entrada com poucos minutos de
diferença) e não vai duplicar. A comissão vem do arquivo, como você já decidiu («conta bruto até uma importação completar
a comissão»). Falta decidir o que fazer quando preço, contratos ou resultado são diferentes (escorregou um tick, digitou
errado).

- **(a)** Vale o arquivo para o dinheiro: preços, contratos e resultado. Os horários, as marcas, o stop, o alvo e o «Posso
  operar hoje?» da entrada ficam como você registrou. Desfazer a importação devolve os seus valores. **(Recomendado)**
- **(b)** Vale o que você registrou. O arquivo só completa a comissão e o número da operação, e a prévia mostra quantas
  ficaram diferentes.

Por que (a): o arquivo é o extrato da corretora, e as Análises contam dinheiro; a prova do diário (hora e marcas) não muda.

---

## 3. Registrou errado, ou só para testar: como apagar?

Nenhuma tela do protótipo apaga uma operação. Uma operação registrada conta no limite do dia e, depois, nas Análises. Hoje
só a página antiga Operações apaga.

- **(a)** «Desfazer entrada» no Registrar, enquanto a operação está aberta e nos primeiros 15 minutos; e a página antiga
  Operações continua apagando. Nos dois casos o app guarda que uma operação registrada foi apagada (só a data e a hora, sem
  os valores), e as imagens dela saem do armazenamento. **(Recomendado)**
- **(b)** Só pela página antiga, como hoje, com o mesmo registro.
- **(c)** Nada se apaga na Fase 3: o erro fica, e «Descartar» chega com o Diário (Fase 4).

Por que (a): você corrige o erro na hora, pelo celular, e nada some sem rastro.

Para o teste: o «Fora da sua janela» das 11:05 aparece no formulário antes de registrar, então não é preciso gravar uma
operação para conferir.

---

## 4. Registrar nas contas de Forex, Ações e opções, Cripto e B3: quão completo?

Você decidiu que essas contas recebem operações pelo Registrar na Fase 3, com o quadro aprovado antes. O protótipo só
desenha Futuros e Ebinex, e hoje você não opera esses mercados.

- **(a)** Quatro cenários novos no quadro (Forex, Ações e opções, Cripto, B3). O resultado é calculado quando a conta é
  exata (ações; cripto cotada em USDT; WIN, WDO, IND e DOL em reais; opções, em que cada contrato vale 100 ações; pares de
  Forex cotados em dólar, como EUR/USD) e digitado quando o app não tem como saber (pares sem o dólar, como EUR/GBP; ouro e
  índices; cripto cotada em reais). Campo «Custos» opcional. Opções simples (call ou put, strike, vencimento), sem travas.
  Cerca de 5 a 7 dias e meio a mais. **(Recomendado)**
- **(b)** Mais enxuto: um cenário geral e um da B3. O resultado é sempre digitado (a conta pelos preços aparece só como
  sugestão), e a opção é registrada pelo nome. Cerca de 2 dias e meio a 4 dias a mais.
- **(c)** Deixar esses mercados para a importação por colunas, logo depois da Fase 3. Isso muda o que você decidiu na 2b.

Por que (a): a mesma tabela de valores por ativo serve depois à importação por colunas («Resultado (ou os preços)»), e
quem opera esses mercados não precisa fazer conta.

---

## Se você não disser nada, seguimos assim

- **Ordem.** O quadro do canvas é revisado (mercados novos e os detalhes novos do Registrar) enquanto saem o banco e as
  regras. Depois vêm as telas de Futuros e Ebinex para o seu teste e, por último, os mercados novos. A importação por colunas
  vem em seguida, com as perguntas dela.
- **Começo do Registrar.** Dois botões no topo: «Aberta» e «Já fechada». «Registrar operação» vira o botão principal do
  Diário, aparece também ao criar uma conta e tem um endereço próprio para salvar como atalho no celular.
- **Operações abertas.** Pode haver mais de uma aberta por conta; com uma só, o Registrar já abre nela. Até o Diário (Fase
  4), o /diario mostra «Operações do dia», com as abertas e as registradas hoje.
- **Futuros.** MES, MNQ, MGC, ES, NQ e GC, com o último usado já marcado; contratos 1, 2, 3 e «Outro». O preço de entrada
  fica vazio, sem sugestão, até haver dado de mercado. Stop e alvo em pontos na tela, guardados como preço, como no arquivo
  da Top One.
- **Ebinex.** Vencimento como na corretora: a opção roda na vela seguinte (entrada às 20:10 em M1 vence às 20:12), como você
  confirmou na Fase 1. O «Vence às …» aparece já no primeiro passo, para você conferir antes de registrar. Nos seus arquivos
  todas as operações são M1; na primeira vez que usar 2, 5 ou 15 min, vale conferir o vencimento com a Ebinex. O payout vem
  preenchido com o último daquele par, e os pares vêm do seu histórico, mais «Outro par».
- **«Já fechada» de outro dia.** Um campo «Dia» («Hoje», «Ontem» ou uma data) permite registrar uma operação de dias
  anteriores, desde a data em que as regras da conta começaram a valer. Antes disso, as operações entram pelo arquivo.
- **Resultado e limite.** O resultado é calculado pelo servidor. No topo aparece «Limite do dia US$ 320 de US$ 400»; ao
  fechar uma operação, um aviso quando o dia chega ao limite (sempre) ou a 80%. O aviso dos 80% se liga em Personalizar ›
  Preferências, com o botão «Avisar ao chegar em 80% do limite do dia», que já estava no protótipo e entra agora (começa
  desligado). Bloqueio de dados e regra por estado continuam para a Fase 5.
- **Conta sem regras.** Se uma conta não tiver nenhuma versão de regras, o Registrar pede para definir antes. As suas contas
  já têm.
- **Imagens.** São convertidas no próprio celular, o que também apaga a localização da foto, e ficam num armazenamento
  privado. Só quem está na lista do hub (hoje, os seus dois logins) envia, até 500 MB por pessoa.
- **Importação.** Quando várias operações registradas parecem com várias linhas do arquivo (mesmo ativo, lado e valor,
  minutos de diferença), o app junta cada uma com a linha mais próxima no horário. Nenhuma linha fica de fora e nada
  duplica. Desfazer uma importação nunca apaga o que você registrou.
- **«Já fechada» de algo que já veio do arquivo.** O app avisa «Esta operação parece já ter vindo do arquivo» e só grava se
  você confirmar.
- **Sem internet.** Nada é gravado, porque a hora vem do servidor; o formulário guarda o que você digitou.
- **Seus dados.** Nenhuma operação, versão de regras ou dia que já existe muda. O SQL vem pronto para você colar, com cópia de
  segurança e conferência, como nas fases anteriores.
- **Teste pelo celular.** Enquanto a correção do site publicado (PR #26) não entra na main, o teste pelo celular é pela rede
  de casa, com o Mac ligado, como na Fase 0.
- **Contas dos mercados novos.** Até os formulários desses mercados ficarem prontos (o último passo da Fase 3, conforme a
  pergunta 4), o botão «Registrar operação» não aparece nelas, e os textos «… na Fase 3» continuam.

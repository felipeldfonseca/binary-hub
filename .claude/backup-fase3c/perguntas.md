# Fase 3c · parciais e breakeven: 3 perguntas para você

Juntei os três levantamentos (banco, regra e telas). O plano em poucas linhas:

- No Registrar, a operação aberta ganha «O que registrar agora?»: **Saída**, **Parcial** e **Mover stop**. A saída continua
  sendo o padrão, então registrar sem parcial custa o mesmo toque de hoje.
- **Parcial**: quantos contratos, preço e hora. O resultado é a soma das saídas. O R continua medido pelo stop da entrada.
  O limite do dia conta cada parcial no minuto em que ela saiu.
- **Mover stop**: um toque em «Breakeven» ou outro preço. A hora é a do servidor, e o app mostra e guarda com quantos pontos
  a favor você moveu.
- Em **Suas regras**, a regra opcional «Mover para o breakeven com +N pontos». O app mostra o preço do breakeven, sugere
  mover depois de uma parcial que chegou lá e nunca bloqueia. As Análises conferem depois.
- Na importação, as linhas da Top One de uma mesma posição viram **uma** operação com várias saídas.
- Antes do código vem o quadro para você aprovar. Depois vem uma colagem no banco, como nas fases anteriores, que confere
  sozinha que nada do que já existe muda.

Sobraram três escolhas que mudam o que você digita ou vê.

---

## 1. O «+N» da regra vale por ativo ou é um número só?

Você pediu «mover para o breakeven com +N pontos». Só que o ponto pesa diferente em cada ativo. No quadro, o stop do MES fica
em 9 a 12 pontos e o do MNQ em 40 a 60. Então +8 pontos é quase 1R no MES e só um quinto de R no MNQ.

- **(a)** Um número por ativo, por exemplo MES +8, MNQ +30, MGC +5. Um ativo sem número fica sem regra. **(Recomendado)**
- **(b)** Um número só para a conta, igual em todos os ativos.

Por que (a): com um número só, toda operação de um dos ativos seria julgada com uma régua errada, e as Análises diriam
«cedo» ou «tarde» quando não foi. Se você opera um ativo só, (a) fica igual a (b): uma linha.

---

## 2. Ao mover o stop, o que você digita?

O app não vê o preço do mercado. Para saber com quantos pontos a favor você moveu o stop, você precisa digitar um número no
momento do toque.

- **(a)** O preço de agora, o que está no gráfico. Antes de você confirmar, o app calcula e mostra «Com +8,00 pts a favor».
  **(Recomendado)**
- **(b)** Os pontos a favor direto, por exemplo «8».

Por que (a): o preço está sempre na tela da plataforma, e os pontos pedem conta de cabeça (preço menos entrada) no meio da
operação. O app também confere o preço: se ele anda de 0,25 em 0,25 e se o stop ficou do lado certo. Depois de uma parcial,
o preço já vem preenchido com o da parcial. Com «Breakeven» o número é obrigatório. Com «Outro preço» (stop móvel) é
opcional.

---

## 3. Dá para corrigir a hora da parcial?

Você escolheu «hora do servidor» para cada parcial. Os levantamentos propõem tratar a parcial como a saída já é tratada hoje.

- **(a)** Como a saída: a hora já vem com o minuto do servidor e pode ser corrigida, nunca antes da entrada nem depois de
  agora. O app guarda à parte a hora real em que você registrou. **(Recomendado)**
- **(b)** Só a hora do servidor, sem campo de hora, como no «Mover stop».
- **(c)** Pode corrigir, mas só até 15 minutos antes de agora, como a entrada.

Por que (a): a parcial é uma saída. O limite do dia conta cada parcial no minuto em que ela saiu, e o arquivo da corretora
corrige o dinheiro, mas nunca os horários. Se você registrar a parcial no celular 3 minutos depois, com (b) ela fica no
minuto errado para sempre. O «Mover stop» fica só com a hora do servidor, como você decidiu.

---

## Se você não disser nada, seguimos assim

- As três perguntas acima ficam na opção (a).
- «Desfazer» vale para a última parcial ou o último movimento do stop, até 15 minutos depois de registrar e enquanto a
  operação está aberta. O app guarda só que foi desfeito.
- Depois da primeira parcial, as marcas (setup, execução, emoção) contam como «depois do resultado», porque você já sabe
  parte do resultado.
- Por enquanto a regra do breakeven só aparece nas contas de Futuros, com «Padrão Futuros» e «só nesta conta», como a
  janela. Forex, Ações, Cripto e B3 ganham a mesma linha depois, mas o «Mover stop» já registra os pontos a favor nelas.
- O Registrar não dá nota ao breakeven («cedo», «tarde»). Ele mostra a sua regra e o que você fez. Quem confere são as
  Análises (Fase 6).
- Cada operação aceita até 20 saídas e até 20 movimentos de stop, e a regra aceita até 20 ativos.
- «Parcial» não aparece quando não dá para sair em parte, como com 1 contrato.
- Com várias saídas, «Corrigir» e «Custos» valem para a operação toda e entram na última saída.
- «Já fechada» aceita várias saídas e, se você quiser, «Movi o stop para o breakeven» com o preço daquele momento. Isso fica
  marcado como registrado depois.
- Na importação, linhas com o mesmo ativo, lado, hora de entrada e preço de entrada viram uma operação com várias saídas. O
  par de linhas que você já importou continua como duas operações, porque nada do que já existe muda.
- Um arquivo exportado no meio da operação fecha a operação aberta na última linha dele, como hoje. Desfazer a importação
  volta tudo.
- O número da regra pode ter decimais (por exemplo 7,5) e não precisa seguir o tick.
- O quadro traz três cenários novos: parciais e breakeven no MES, «Já fechada» em duas saídas no MGC e uma parcial que
  chega ao limite e depois é desfeita. Traz também a linha nova em Suas regras. Você aprova o quadro antes do código.

# Fase 4 · Diário: 5 perguntas para você

Juntei os três levantamentos da Fase 4: os dois quadros do Diário, o que o app já tem e o banco. Os quadros são de 14 de
outubro, antes das Fases 1 a 3c, então eles vão ser revisados no canvas para você aprovar antes de qualquer código (eles
ainda mostram, por exemplo, a Ebinex sem diário e uma só saída por operação). Quase tudo já se resolve com o que você decidiu
antes ou com um padrão que proponho (lista no fim). Sobraram cinco escolhas que só você pode fazer.

---

## 1. A revisão do dia: dá para mudar depois?

Cada pregão de cada conta tem a sua revisão, como no quadro: «O que funcionou?», «O que você faria diferente?», «Seguiu o
plano?» (Sim / Em parte / Não) e «Levar para o próximo pregão», que aparece no plano do pregão seguinte como «Do pregão
anterior». Tudo opcional. Em cima, o app escreve «O diário registrou: …» com os números do dia, congelados na hora em que você
salva. A sua resposta em «Seguiu o plano?» nunca muda o que o diário calculou. Falta decidir o que acontece quando você volta e
edita.

- **(a)** Pode editar quando quiser. Cada «Salvar revisão» fica guardado com a hora; o Diário mostra a última («Salva às 11:33 ·
  editada às 18:02») e as anteriores ficam numa lista fechada, só para ler. Nada se apaga. **(Recomendado)**
- **(b)** Pode editar, e o texto novo substitui o anterior. Ficam só a hora em que você salvou e a da última edição.
- **(c)** Pode editar até o fim do pregão seguinte; depois disso a revisão fica só para ler.

Por que (a): é como as marcas e as versões das regras: o que você escreveu na hora continua lá, mesmo que mude a revisão
depois de ver a semana.

---

## 2. O resultado do dia: líquido ou bruto?

Isso só muda nas contas de Futuros, porque na Ebinex não há comissão. Hoje o app conta de dois jeitos:

- o limite do dia conta **líquido** (comissão descontada quando o arquivo da corretora traz), como você decidiu na Fase 2, e a
  importação já mostra «O arquivo traz comissões: mostramos o resultado líquido.»;
- mas o quadro do Diário diz no rodapé «Resultados do arquivo da corretora, sem custos.», e o quadro de Análises que você aprovou
  mostra «Resultado (bruto)».

Nas duas opções, o cartão «Limite do dia» continua líquido (é o que o app usou), e o outro número fica no «i» («Bruto … ·
comissões …»). O trabalho é o mesmo.

- **(a)** Líquido em todo o Diário: dia, calendário, semana e cada operação. Uma operação registrada no app fica bruta até o
  arquivo trazer a comissão, e o detalhe dela diz isso. Isso muda o rodapé do quadro do Diário. E, como as Análises (Fase 6)
  foram aprovadas em bruto, até eu te perguntar de novo na Fase 6 as duas telas vão mostrar números diferentes para a Top One.
  **(Recomendado)**
- **(b)** Bruto em todo o Diário, como nos quadros e nas Análises. Só o cartão «Limite do dia» fica líquido: num dia com
  comissão, o resultado do dia e o limite diferem pelo valor da comissão.

Por que (a): o dia fica com um número só, o mesmo que o limite e o «Posso operar hoje?» usaram, na mesma página.

---

## 3. O que a Semana mostra?

No quadro, o cartão «Semana» mostra sempre a última semana fechada, qualquer que seja o dia aberto: resultado, operações, fora
do plano, «Viés marcado antes», barras por dia e a lista do que saiu do plano. O viés só existe a partir da Fase 5, então no lugar
dele entra «Revisões» (por exemplo, «4 de 4»: dos pregões da semana em que você registrou operação no app, quantos têm revisão).
A leitura da IA fica para a Fase 8.

- **(a)** A semana do dia que você abriu. Na semana atual aparece «Semana em andamento», e tocar numa semana do calendário abre
  essa semana. **(Recomendado)**
- **(b)** Sempre a última semana fechada, como no quadro.
- **(c)** As duas: a semana em andamento e, embaixo, a última fechada. Cerca de um quarto de dia a mais.

Por que (a): o cartão acompanha o dia que você está olhando, e no meio da semana você já vê como ela vai.

---

## 4. «Antes de operar» e «Seu foco da próxima semana»: onde escrever?

O quadro mostra, no plano do dia, uma nota «Antes de operar» (no exemplo, «Esperar o ISM. Só vendo se perder a VWAP depois das
10:30.») e, na Semana, «Seu foco da próxima semana». Mas nenhuma tela tem onde escrever os dois. Hoje só a página antiga
Pré-mercado guarda uma nota antes da sessão, por data e sem conta. Em qualquer opção, «Do pregão anterior» (o que você pôs em
«Levar para o próximo pregão») aparece no plano do dia.

- **(a)** Nenhum dos dois agora.
- **(b)** «Antes de operar» agora, num campo curto no dia de hoje, com a hora do servidor («anotado às 09:40, antes da 1ª
  entrada»). O foco da semana chega com Padrões (Fase 7), que mostra o que mais pesou nos seus números. Cerca de meio dia a
  mais. **(Recomendado)**
- **(c)** Os dois agora, como texto livre: «Antes de operar» no dia e «Seu foco da próxima semana» na Semana. Cerca de 1 dia a
  mais.

Por que (b): a nota de antes já está no plano do dia que você aprovou e, com a hora do servidor, o diário mostra se ela veio
antes da primeira entrada; o foco faz mais sentido quando Padrões puder apontar o que olhar.

---

## 5. Quando /trades passar a abrir o Diário, onde ficam apagar e exportar?

O teste da fase termina com /trades abrindo /diario. Hoje a página antiga Operações é o único lugar que apaga uma operação
importada, ou uma registrada há mais de 15 minutos (na Fase 3 você decidiu que ela continua apagando), e o único que exporta
CSV. Nenhuma tela corrige valores: quem corrige o dinheiro é o arquivo da corretora, como você decidiu.

- **(a)** /trades abre o Diário, e a lista antiga continua num endereço próprio, com um link discreto no rodapé do Diário
  («Página antiga de operações»), até a Fase 9. Apagar e exportar continuam lá, como hoje. Ela passa a ler todas as operações
  (hoje para nas 1.000 mais recentes; você tem cerca de 630). **(Recomendado)**
- **(b)** O Diário ganha «Apagar operação» nos detalhes de cada operação (com confirmação; o app guarda só a data e a hora, como
  já faz) e o «Exportar CSV» do quadro. Cerca de 1 dia a mais.
- **(c)** Nada de apagar (fora «Desfazer entrada» e desfazer importação) nem de exportar até a Fase 9.

Por que (a): cumpre o teste da fase sem pôr um botão novo de apagar agora, e o que você decidiu na Fase 3 continua valendo.

---

## Se você não disser nada, seguimos assim

- **Ordem.** Primeiro o quadro do Diário revisado no canvas, para você aprovar; depois banco e regras, o SQL para você colar, as
  telas, o seu teste e, por último, /trades abrindo /diario. Cerca de 11 dias e meio a 14 dias e meio com as opções
  recomendadas.
- **Uma conta por vez.** Como nos quadros e no plano («você ainda opera uma conta por vez»): o seletor troca a conta, e o
  calendário, o dia, a semana, a janela, o limite e a revisão são dessa conta. O «Posso operar hoje?» no topo mostra todas.
  Contas de mercados diferentes nunca se somam.
- **O que fica para depois.** A linha do tempo aparece com «chega na Fase 5». Estado do mercado, «o que a tela dizia», viés,
  bloqueio de dados e regra do estado ficam escondidos até a Fase 5 (nas contas de Futuros, o «i» do plano diz isso); textos da
  IA, até a Fase 8; o cartão de Análises, até a Fase 6.
- **Histórico importado.** As operações de antes das suas regras aparecem hachuradas, só com o resultado, numa escala de cor
  própria, e nunca entram na conta do dia, da semana nem na cor dos dias do diário. As que chegam só pelo arquivo depois do
  «desde» fazem parte do dia, com o «Posso operar hoje?» recalculado e a etiqueta «Do arquivo», como a importação já diz.
- **Revisões pendentes.** O aviso conta só os pregões em que você registrou alguma operação no app. Dias que vieram só do
  arquivo não entram no aviso, mas você pode escrever a revisão deles quando quiser.
- **Fim de semana e feriados.** Calendário de segunda a sexta; sábado e domingo aparecem só em contas que operam no fim de semana
  (Cripto, ou a Ebinex no mês em que houver operação). Ainda sem nomes de feriado: um dia sem operação aparece como «sem op.» até
  a Fase 5.
- **Marcas, imagens e nota.** Em qualquer operação do diário, inclusive as do arquivo (nelas as marcas contam sempre como
  «depois do resultado»), direto no detalhe da operação; no histórico, só para ler. Ao desfazer uma importação, a confirmação
  passa a dizer quantas marcas, imagens e notas feitas no Diário saem junto com as operações que vieram só daquele arquivo (as
  que você registrou no app ficam, com as suas marcas, imagens e nota).
- **Operação apagada.** Quando uma operação registrada é apagada na página antiga, o dia mostra só a hora («1 operação
  registrada foi apagada às 10:20.»). Um «Desfazer entrada» feito nos primeiros 15 minutos não aparece no dia.
- **Parciais e breakeven.** O dia mostra as saídas, os movimentos do stop e a sua regra de breakeven, sem veredito; o veredito
  vem nas Análises, como você decidiu na 3c.
- **No topo.** O «Posso operar hoje?» continua no Diário até o Início novo (Fase 8).
- **Operação aberta de ontem.** Fica no dia em que abriu; hoje aparece uma linha com o link para ela.
- **Notas da página antiga Pré-mercado.** O app conta antes se existem. Se existirem, aparecem só para ler na data delas, sem
  copiar nada.
- **Links.** Dá para abrir um dia direto pelo endereço, e o «Ver no Diário» do Registrar abre a operação no dia dela.
- **Seus dados.** Nada que já existe muda: nem operações, nem dias, nem versões, nem o limite. O SQL vem com cópia de segurança e
  conferência, como antes, e o desfazer recusa se você já tiver escrito alguma revisão.

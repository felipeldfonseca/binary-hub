# Fase 3c · parciais e breakeven · decisões do dono (2026-10-21)

Pedido dele: «faltou na hora de registrar a operação a realização de parciais, e indicar com quantos pontos você move ou não a
operação pra breakeven».
Respostas (todas a opção recomendada):
1. Parciais: só SAÍDAS parciais (uma entrada, várias saídas, cada uma com contratos, preço e hora do servidor; resultado = soma).
   Sem entradas parciais (sem aumentar posição / preço médio de entrada).
2. Breakeven: registrar o movimento («Mover stop» com atalho «Breakeven»: hora do servidor e pontos a favor naquele momento) +
   regra opcional em Suas regras «mover para o breakeven com +N pontos», que o app sugere (sem bloquear) e depois confere nas Análises.
3. «Mover stop» aceita qualquer ajuste (stop móvel), com o atalho «Breakeven» em um toque; cada ajuste com a hora do servidor.
4. Quando: agora, antes da importação por colunas (3b).
Fatos dos arquivos (só contagens): Top One Trade History 17 linhas, 1 grupo de 2 linhas com a mesma entrada e ativo (é como a Top
One exporta uma parcial: uma linha por saída); coluna SL vazia nas 17 (o arquivo nunca mostra o stop); 6 tamanhos (Lots) distintos.
Princípios já fixados: R medido pelo stop inicial; o limite do dia conta cada parcial no minuto em que realizou; Ebinex/binárias
sem parcial nem stop; quadro antes do código; nada que já existe pode mudar (versões congeladas, operações, dias).

## Respostas às 3 perguntas do levantamento (2026-10-21, todas a recomendada)
1. «+N» do breakeven POR ATIVO (MES +8, MNQ +30…; ativo sem número fica sem regra).
2. Ao mover o stop, digita o PREÇO de agora; o app calcula e mostra os pontos a favor antes de confirmar, confere tick e lado;
   depois de uma parcial já vem com o preço dela. Com «Breakeven» o número é obrigatório; com «Outro preço» é opcional.
3. Hora da parcial corrigível como a saída (minuto do servidor, nunca antes da entrada nem depois de agora; hora real do
   registro guardada à parte). «Mover stop» só com a hora do servidor.
Padrões de perguntas.md («Se você não disser nada») aceitos. Quadros publicados no canvas versão 62, aguardando aprovação.
Bug do já construído encontrado: import_undo (20261020000004:595-603), desfazer de dois lotes na mesma operação registrada,
do mais novo para o mais antigo, pode perder um valor registrado; corrigido na migração do 3c (x.linked_at > l.linked_at).

## Quadros aprovados (2026-10-21)
O dono aprovou os quadros da 3c no canvas (artifact Q3CThVmn9Mms7Bdi94MBg8, versão 1792580549-b8ef):
RegistrarOperacao.dc.html (sha256 0b922d08…) e Personalizar.dc.html (sha256 db1efac9…), cópias em fase3c/quadro/aprovado/project/.
As telas (PR C) podem ser implementadas; o merge segue a ordem da síntese §9 (colagem primeiro, depois o app).

# Binary Hub – Product Requirements Document (PRD)

*Versão 1.0 • julho 2025*

---

## 0. Sumário Rápido

| Seção | Conteúdo                                           |
| ----- | -------------------------------------------------- |
| 1     | Visão & Objetivos                                  |
| 2     | Contexto & Problema (Parte II §2 do Business Plan) |
| 3     | Personas & Jornadas                                |
| 4     | Requisitos Funcionais                              |
| 5     | Requisitos Não‑Funcionais                          |
| 6     | Fluxo de Dados & Modelo DB                         |
| 7     | Importação CSV (Ebinex) – Especificação            |
| 8     | Métricas de Sucesso                                |
| 9     | Dependências & Riscos                              |
| 10    | Questões em Aberto                                 |

---

## 1. Visão & Objetivos

**Visão:** ser a plataforma nº 1 de *journaling* para traders de opções binárias, transformando dados de operações em insights acionáveis que elevem disciplina e performance.

**Objetivo MVP:** lançar em 10 semanas uma versão web que atenda ≥ 50 WAU e converta ≥ 10 assinantes Pro (detalhe no *MVP Scope*). 

---

## 2. Contexto & Problema

(Referência: Business Plan • Parte II §2 “Oportunidade de Mercado”)

* +80 % dos traders de binárias abandonam após 3 meses devido a falta de feedback estruturado.
* Ferramentas genéricas de journaling não contemplam métricas específicas (payout fixo, velas de 1 min).
* Corretoras como **Ebinex** permitem baixar histórico em CSV, mas não oferecem insights.

**Hipótese central:** se facilitarmos o registro (manual **ou** via import), usuários terão dados limpos; com IA simples, entregar valor em < 1 minuto/dia.

---

## 3. Personas & Jornadas

### 3.1 João Trader Júnior (persona primária)

*Idade 24, faz 30 trades/dia, usa planilha confusa.*

* **Job‑to‑Be‑Done:** “Quero saber se minhas entradas pós‑perda realmente pioram meus resultados.”
* **Ponto de Dor:** digitar tudo manualmente → abandona.
* **Como o MVP ajuda:** importa CSV do Ebinex 1×/dia; vê KPI de ‘Loss After Loss’.

### 3.2 Ana Mentora (persona secundária)

*Vende curso “Binary Class”, acompanha 50 alunos.*

* **Job:** “Preciso provar que disciplina > setup.”
* **Valor:** recomenda Binary Hub aos alunos.

---

## 4. Requisitos Funcionais

| ID (MVP)  | Requisito             | Critérios de Aceite                                                            | Dados                   | UI Route           |
| --------- | --------------------- | ------------------------------------------------------------------------------ | ----------------------- | ------------------ |
| **RF‑01** | Auth (Google, E‑mail) | SSO & senha. Redireciona `/app` se logado.                                     | user.uid                | `/login`           |
| **RF‑02** | Log Manual            | Campos validados conforme *MVP Scope P‑02*. Salva em `trades/{uid}/{tradeId}`. | 16 campos               | `/app/log`         |
| **RF‑03** | **Importar CSV**      | *Ver especificação no §7.*                                                     | 89 colunas (ver tabela) | `/import` modal    |
| **RF‑04** | Dashboard KPIs        | Win rate, streak, receita, total trades.                                       | consultas Firestore     | `/app/dashboard`   |
| **RF‑05** | Calendário            | Grade mensal, cor por lucro.                                                   | summaryTrades           | `/app/calendar`    |
| **RF‑06** | Regras & Aderência    | CRUD + cálculo adesão.                                                         | rules\[], stats         | `/app/rules`       |
| **RF‑07** | Insight LLM           | Cron semanal → card exibido.                                                   | insights/{uid}          | `/app` top‑section |
| **RF‑08** | Export PDF            | Trigger user, gera PDF e envia download link.                                  | cloud function          | `/app/export`      |

---

## 5. Requisitos Não‑Funcionais

| Categoria      | Meta                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| Performance    | API p95 < 300 ms                                                           |
| Acessibilidade | Lighthouse A11y ≥ 90 & contraste AA                                        |
| Segurança      | Firebase Auth + regras Firestore por uid; validação CSV MIME, limite 10 MB |
| Confiabilidade | ≤ 0.1 % erros 500 em 30 dias                                               |
| Escalabilidade | 10 k trades/dia sem degradação                                             |

---

## 6. Fluxo de Dados & Modelo DB (Firestore)

```
users/{uid}
  ├─ email, plan, tz, createdAt
trades/{uid}/{tradeId}
  ├─ timestamp, asset, direction, stake, result, payout, pnl, emotion, tag
insights/{uid}/{insightId}
  ├─ createdAt, text, kpiReference[]
rules/{uid}/{ruleId}
  ├─ text, active, brokenCount
```

*Index:* `trades` combo (uid, timestamp DESC)

---

## 7. Importação CSV (Ebinex)

### 7.1 Colunas obrigatórias

| CSV Header  | Mapping Firestore | Tipo             | Obrig. |
| ----------- | ----------------- | ---------------- | ------ |
| `ID`        | tradeId           | string           | ✔︎     |
| `Data`      | timestamp         | ISO string (UTC) | ✔︎     |
| `Ativo`     | asset             | string           | ✔︎     |
| `Tempo`     | timeframe         | string           | ✔︎     |
| `Previsão`  | direction         | enum (BUY/SELL)  | ✔︎     |
| `Vela`      | candleTime        | string (HH\:MM)  | ✔︎     |
| `P. ABRT`   | openPrice         | number           | –      |
| `P. FECH`   | closePrice        | number           | –      |
| `Valor`     | stake             | number           | ✔︎     |
| `Estornado` | refundedValue     | number           | –      |
| `Executado` | executedValue     | number           | ✔︎     |
| `Status`    | status            | enum (OK/ERROR)  | –      |
| `Resultado` | result            | enum (WIN/LOSS)  | ✔︎     |

> *O CSV exportado pela **************************************************************************************************************Ebinex************************************************************************************************************** contém **************************************************************************************************************13 colunas**************************************************************************************************************. Todas são importadas; campos não essenciais ao MVP são armazenados porém marcados como ************************************************************************************************************`ignored`************************************************************************************************************ no schema, permitindo uso futuro sem causar inconsistências.*

### 7.2 Processo de Upload

1. Usuário clica **Importar CSV**.
2. Front verifica `file.size ≤ 10 MB` & `type === 'text/csv'`.
3. Envia para `/api/upload` (signed URL GCS).
4. Cloud Function lê lote (stream), normaliza, \*\*deduplica by \*\*\`\` (merge if exists).
5. Resposta com resumo: `totalRows, imported, skipped, errors[]`.

### 7.3 Regras de Deduplicação

* **Chave:** `tradeId + uid`.
* Se registro existir, comparar todos campos; se diferente ⇒ atualizar e logar em `audit/{uid}`.
* Conflito > 5 % ➞ status `warning` para usuário.

### 7.4 UX & Mensagens

* Sucesso: green toast “89 trades importados em 3 seg”.
* Erro parsing: mostrar 1ª linha com problema.
* Limite excedido: “Arquivo maior que 10 MB, compacte período”.

---

## 8. Métricas de Sucesso

| Métrica                 | Target                 |
| ----------------------- | ---------------------- |
| Upload CSV Success Rate | ≥ 95 %                 |
| Deduplicação correta    | 100 % (0 dupes)        |
| Tempo médio de import   | < 10 s (1 000 linhas)  |
| % usuários que importam | ≥ 60 % ativos semanais |

---

## 9. Dependências & Riscos

| Dependência                    | Impacto      | Plano                                    |
| ------------------------------ | ------------ | ---------------------------------------- |
| Ebinex CSV coluna‑layout mudar | Import falho | Versão parser + monitor diff‑hash header |
| Custos Firestore grandes       | \$\$         | Paginar writes, compress floats          |
| OpenAI Custos                  | \$\$         | Cache & limitar 1 insight/sem            |

---

## 10. Questões em Aberto

1. Precisamos permitir edição em massa após import? 
   1

   1. Permitir edição deve trazer mais complexidade ao projeto, vamos permitir apenas a exclusão de operações.

2. Estratégia de *rollback* caso CSV errado seja importado.

   1. Seria bom antes de salvar a importação definitiva das operações na plataforma, que o usuário pudesse visualizar as operações que serão importadas, para que ele possa confirmar que o csv está enviando as operações corretas. E permitir a edição de cada uma delas. Depois que essas operações sao carregadas na plataforma, ele só poderá remover operações, nao permitiremos edição.
   2. Toda vez que um csv é importado e confirmado pelo usuário, se exisitr alguma operação duplicada (comparando com as que já foi carregada no sistema, seguindo as regras de duplicação), ela deverá ser notificada ao usuário que não será adicionada na plataforma.
   3. Caso o CSV nao siga os padrões das colunas do CSV da ebinex, podemos oferecer um template em excel ao usuário para que ele possa preencher manualmente, e orientar como ele baixa em CSV  para poder subir na plataforma. Se não for o caso, ele deverá registrar as operações manualmente.

3. UX de múltiplas contas Ebinex no mesmo UID?

   1. Cada usuário tem o seu UID na ebinex, mas ele nao será exigido na nossa plataforma (inicialmente), para nao limitar a plataforma a apenas ter alunos da ebinex.

4. Precificação definitiva do plano Pro (18 USD ≅ R\$ 100).

---

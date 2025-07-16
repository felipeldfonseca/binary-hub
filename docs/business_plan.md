# Binary Hub – Business Blueprint (0 → 500 usuários pagantes)

> **Versão 2.0 – inclui documentação completa para agente LLM construir o produto do zero**

---

## Parte I – Plano de Negócios (revisão‑relâmpago)

### 1. Resumo Executivo

Binary Hub é uma plataforma de *journaling* e insights para traders de **opções binárias**. Missão inicial: validar o MVP como fundador solo, alcançar **500 assinantes Pro (US\$ 6 000 MRR)** em até 6 meses e gerar fluxo de caixa suficiente para reinvestir em integrações (Forex/Futuros/Crypto).
*→ Detalhamento completo do business case permanece inalterado; consulte Apêndice A.*

---

## Parte II – Documentação para o Agente LLM

### 2. Visão Funcional (PRD condensado)

| Nº       | Funcionalidade            | Descrição curta                                                                                                           | Prioridade | Sprint alvo |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| P‑01     | Cadastro & Auth           | Email, Google, Apple; timezone do usuário                                                                                 | Must       | S‑01        |
| P‑02     | Log manual de trade       | Form  ➜ ativo, horário, direção, stake, resultado                                                                         | Must       | S‑01        |
| P‑03     | Importar CSV (Ebinex)     | Upload de arquivo .csv (colunas padrão da corretora) com parser, deduplicação (ID) e validação; batch insert em Firestore | **Must**   |             |
| **P‑03** | Dashboard KPIs            | Win rate, série de vitórias, P\&L diário                                                                                  | Must       | S‑02        |
| P‑04     | Calendário de performance | Grid (1 mês) color‑heat por lucro                                                                                         | Must       | S‑02        |
| P‑05     | Regras pessoais & Score   | CRUD de regras + cálculo de aderência (%)                                                                                 | Should     | S‑03        |
| P‑06     | IA – Detector de padrões  | LLM analisa histórico e devolve 3 insights                                                                                | Could      | S‑04        |
| P‑07     | Exportação PDF            | Snapshot semanal                                                                                                          | Could      | S‑05        |

> **Definição de pronto (DoD)**: teste unitário ≥ 80 % cobertura, contraste AA, tempo médio de resposta API < 300 ms.

### 3. Arquitetura de Solução

```
┌────────Front‑end (Next.js)────────┐     ┌───────── LLM Layer ─────────┐
│ React + SWR + Tailwind            │ REST│ FastAPI Gateway            │
│ Pages: /log, /dashboard, /rules   │ ←→  │ OpenAI GPT‑4o (insights)    │
└───────────────────────────────────┘     └────────────────────────────┘
          │ GraphQL (Apollo)                         ↑
┌─────────── Firebase Auth ───────────┐              │
│ User pool, email verification       │              │
└─────────────────────────────────────┘              │
          │                                          │
┌────────── Firestore (NoSQL) ──────────┐            │
│ trades ⚫ rules ⚫ userStats           │ Cloud Fn ▷ pattern‑cron
└───────────────────────────────────────┘            │
          │                                          │
        Storage        Cloud Tasks         SendGrid (e‑mail)
```

### 4. Modelo de Dados (NoSQL)

```json
// Coleção: users/{uid}
{
  "displayName": "Felipe",
  "email": "felipe@example.com",
  "tz": "America/Sao_Paulo",
  "plan": "free|pro",
  "createdAt": "TS"
}
// trades/{uid}/{tradeId}
{
  "ts": 1718121900,
  "asset": "EURUSD",
  "direction": "CALL",
  "stake": 10,
  "payout": 8.5,
  "result": "win|loss|draw",
  "tags": ["bullish clássico"],
  "emotion": "calm|impulse|fear"
}
```

### 5. Especificação de API (FastAPI)

| ROTa          | Método | Auth   | Descrição                   |
| ------------- | ------ | ------ | --------------------------- |
| /trades       | GET    | Bearer | Listar trades com paginação |
| /trades       | POST   | Bearer | Criar/editar trade          |
| /stats/weekly | GET    | Bearer | KPIs agregados semanais     |
| /insights     | POST   | Bearer | Disparar análise LLM        |

*Rate‑limit:* 60 req/min / usuário.

### 6. LLM – Prompt & Few‑Shot

**System:** “You are a trading performance coach…”
**User template:**

```
Context metrics:
- WinRate: {{win}}%
- Avg R/R: {{rr}}
- Max loss streak: {{ls}}
Last 30 trades (JSON):
{{history}}
Rules broken: {{broken}}
```

**Assistant response (JSON)**

```json
{
  "top_bad_habit": "Operar após 3 perdas seguidas",
  "pattern": "Loss em CALL 5 min após notícia",
  "actionable": "Pare 15 min após loss streak ≥ 3"
}
```

### 7. Pipeline de Desenvolvimento

1. **Branch flow:** main → dev → feature/\*
2. **CI (GitHub Actions):** lint + pytest + build → preview (Vercel)
3. **CD:** merge main → Vercel + Cloud Run
4. **Infra como código:** `firebase.json`, `vercel.json`, `openapi.yaml`

### 8. Testes

* **Unit:** Jest (React) & Pytest (API)
* **E2E:** Playwright (simula log + export PDF)
* **Performance:** Lighthouse ≥ 90, K6 para /stats endpoint

### 9. Segurança & Compliance

* TLS 1.2+, Firebase Auth JWT.
* Dados sensíveis cifrados at‑rest (Firestore default).
* Backup diário Firestore → GCS + 30 dias retenção.
* GDPR / LGPD: botão *Delete Account* (soft‑delete + purge cron‑job).

### 10. Cronograma de Sprints (2 sem cada)

| Sprint | Objetivo                  | Issues chave             |
| ------ | ------------------------- | ------------------------ |
| S‑01   | Auth + Log Form           | FE‑001, BE‑001, CI‑001   |
| S‑02   | Dashboard & Calendar      | FE‑002, BE‑002, TEST‑002 |
| S‑03   | Rules & Scoring           | FE‑003, BE‑003, LLM‑Stub |
| S‑04   | IA Insights v1            | BE‑LLM‑001, Prompt‑01    |
| S‑05   | PDF Export + Beta público | FE‑005, DevOps‑05        |

### 11. Observabilidade

* **Logging:** Cloud Logging + Datadog forward.
* **Metrics:** Firestore document count, p95 latency.
* **Alertas:** Slack webhook (downtime > 1 min).

### 12. Políticas de Pricing & Feature‑Flags

* Plano é salvo em `users.plan`.
* Middleware verifica quota: Free = 150 trades/mês.
* Feature‑flags via `remoteConfig.binaryHub` → ativar IA somente p/ Pro.

### 13. Glossário de Rotas Front‑end

```
/      -> Landing (public)
/app   -> Dashboard root (authed)
/app/log -> Form trade
/app/rules -> CRUD Regras
/app/settings -> Billing & Conta
```

---

## 14. Pacote de Documentação para o Agente LLM

Abaixo está a lista completa de arquivos/artefatos que devem existir no repositório a fim de que o agente LLM consiga **gerar, testar e implantar** o Binary Hub do zero.

| Nº | Documento / Arquivo                     | Propósito                                                                | Local / Nome‑padrão         |
| -- | --------------------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| 1  | **README.md**                           | Visão geral do produto, como rodar localmente, badges CI                 | raiz do repo                |
| 2  | **MVP\_SCOPE.md**                       | Recorte funcional P‑01 → P‑05 (história de usuário, critérios de aceite) | `/docs/MVP_SCOPE.md`        |
| 3  | **PRD.md**                              | Requisitos de produto (detalhe completo da Parte II §2)                  | `/docs/PRD.md`              |
| 4  | **ARCHITECTURE.md** + diagrama Draw\.io | Desenho detalhado dos componentes (Parte II §3)                          | `/docs/ARCHITECTURE.md`     |
| 5  | **DATA\_MODEL.md**                      | Schemas Firestore + ER simplificado                                      | `/docs/DATA_MODEL.md`       |
| 6  | **OPENAPI.yaml**                        | Especificação REST completa (Parte II §5)                                | `/api/OPENAPI.yaml`         |
| 7  | **PROMPT\_GUIDE.md**                    | Prompt, few‑shots, formato de resposta JSON                              | `/llm/PROMPT_GUIDE.md`      |
| 8  | **INFRA/terraform/**                    | Scripts IaC (opcional se migrar p/ GCP Cloud Run)                        | `/infra/`                   |
| 9  | **CONTRIBUTING.md**                     | Branch flow, conv. commit, política de PR                                | raiz                        |
| 10 | **CODE\_OF\_CONDUCT.md**                | Padrão Open Source                                                       | raiz                        |
| 11 | **TEST\_STRATEGY.md**                   | Plano unit, E2E, perf (Parte II §8)                                      | `/tests/TEST_STRATEGY.md`   |
| 12 | **DEPLOY\_GUIDE.md**                    | Como promover para Vercel + Firebase (CI/CD)                             | `/docs/DEPLOY_GUIDE.md`     |
| 13 | **SECURITY.md**                         | Checklist OWASP, LGPD/GDPR, backup                                       | `/docs/SECURITY.md`         |
| 14 | **STYLE\_GUIDE\_UI.md**                 | Tokens de cor, tipografia (referência a guia de marca)                   | `/design/STYLE_GUIDE_UI.md` |
| 15 | **CHANGELOG.md** (keep‑a‑changelog)     | Histórico semântico de versões                                           | raiz                        |
| 16 | **LICENSE**                             | MIT ou Proprietária – definir                                            | raiz                        |

> **Observação:** arquivos Markdown devem usar cabeçalho YAML com `title`, `description`, `last_updated`.

---

## Apêndice A – Business Plan Detalhado

*(conteúdo mantido da versão 1.0; omitido aqui para foco técnico)*

---


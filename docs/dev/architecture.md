# Binary Hub – Software Architecture

*Versão 1.0 • julho 2025*

> **Diagrama completo** disponível em `docs/architecture.drawio` (fonte) e `docs/architecture.svg` (export).
> Abra o `.drawio` no [Diagrams.net](https://app.diagrams.net/) para edição colaborativa.

---

## 1. Visão Geral (C4 – Nível de Sistema)

```
┌──────────────────────────────────────────────────────────┐
│                      Binary Hub SaaS                     │
│                                                          │
│  ┌──────────────┐     HTTPS      ┌────────────────────┐  │
│  │  Next.js FE  │  ◀──────────▶  │ Firebase Functions │  │
│  │  (Vercel)    │                │  (Node.js 20)      │  │
│  └──────────────┘                └────────────────────┘  │
│        ▲   ▲                             ▲    ▲          │
│        │   │                    REST/SDK │    │ Pub/Sub  │
│   OAuth2│  │Realtime WS                  │    └──────────▶ OpenAI API
│        │   └───────────────┐             │
│        │                   │             │ Cloud Storage (CSV uploads)
│  Google Identity           │             │
│                            ▼             ▼
│                       Firestore <────────┘
│                            ▲  ▲
│                            │  │ Stripe Webhooks (Billing)
│                            │  └───────────────▶ Stripe API
└────────────────────────────────────────────────────────────┘
```

### Componentes‑chave

| # | Componente           | Responsabilidade principal                              |
| - | -------------------- | ------------------------------------------------------- |
| 1 | **Next.js Frontend** | UI (dashboard, log, calendar, import modal). SSG/SSR.   |
| 2 | **Firebase Auth**    | Registro/login (E‑mail, Google).                        |
| 3 | **Cloud Functions**  | API REST (trades, rules), CSV parser, PDF export, cron  |
| 4 | **Firestore**        | Banco NoSQL: `users`, `trades`, `rules`, `insights`     |
| 5 | **Cloud Storage**    | Upload temporário de CSVs; trigger para parser          |
| 6 | **OpenAI GPT‑4o**    | Geração semanal de insights (LLM)                       |
| 7 | **Stripe Billing**   | Planos Free & Pro, webhooks para atualizar `users.plan` |
| 8 | **Vercel**           | Deploy CI/CD do Next.js; preview per PR                 |

---

## 2. Fluxo de Importação CSV (Detailed Sequence)

1. **UI**: Usuário clica **Importar CSV** → seleciona arquivo.
2. **FE**: Valida `size` & `type`, obtém *signed URL* via `/api/presign`.
3. **Upload**: FE faz `PUT` no bucket `csv-uploads/{uid}/{timestamp}.csv`.
4. **Trigger**: Event‑based Cloud Function `onFinalize` inicia *stream parser*.
5. **Parser**:

   1. Lê cabeçalho, verifica 13 colunas.
   2. Normaliza cada linha → objeto `TradeDto`.
   3. Deduplica por `(uid, tradeId)` (Firestore transaction batches de 500).
6. **Result**: Salva resumo em `imports/{uid}/{importId}` (total, skipped, errors).
7. **FE**: Escuta `imports` via `onSnapshot` → mostra toast `✅ 89 trades importados`.

---

## 3. Diagrama de Dados (ER‑Lite)

```
users (uid PK)
  ├─ email
  ├─ plan  <───┐ (FREE | PRO)
  └─ tz        │
               │ 1:N
trades (uid, tradeId PK)────────┐
  ├─ timestamp                  │
  ├─ asset                      │
  ├─ direction (BUY/SELL)       │
  ├─ stake, executedValue       │
  ├─ result (WIN/LOSS)          │
  └─ candleTime, openPrice ...  │
                                │
rules (uid, ruleId PK)          │
  ├─ text, active               │
  └─ brokenCount                │
                                │
insights (uid, insightId PK)    │
  └─ text, kpiRef[]             │
                                │
imports (uid, importId PK)      │
  ├─ createdAt                  │
  ├─ totalRows, imported, dupes │
  └─ errorLines[]               │
```

---

## 4. Tech Stack e Justificativa

| Camada     | Stack                         | Motivo                                               |
| ---------- | ----------------------------- | ---------------------------------------------------- |
| Frontend   | Next.js 14 + Tailwind 3       | SSR opcional, routing / API routes integrados        |
| State Mgmt | React Query + Zustand         | SWR & cache local simples                            |
| Backend    | Firebase Functions (Node 20)  | Escalabilidade serverless, baixo DevOps              |
| DB         | Firestore                     | JSON doc, queries simples, SDK com segurança por UID |
| Storage    | GCS                           | Integra nativa com Functions triggers                |
| Auth       | Firebase Auth (Google/E‑mail) | Sign‑in 5 min                                        |
| Payments   | Stripe Checkout + Webhooks    | Confiável; fácil testar com CLI                      |
| LLM        | OpenAI GPT‑4o                 | Qualidade de texto e baixo *time‑to‑value*           |
| CI/CD      | GitHub Actions → Vercel       | Preview automático por Pull Request                  |

---

## 5. Segurança & Compliance

1. **Rules‑as‑Code**: Firestore regras por `request.auth.uid`.
2. **CSV**: Sanitização, limite 10 MB, avro schema‑like validation.
3. **GDPR**: Endpoint `/gdpr/export` + `/gdpr/delete` (Function callable).
4. **Rate‑Limiting**: `express-rate-limit` middleware nas APIs críticas.

---

## 6. Observabilidade

* **Logs:** Cloud Logging + Log‑based metrics (`error`, `import_fail`).
* **Performance:** Firebase Performance SDK (FE) & Google Cloud Monitoring (BE).
* **Alerts:** Uptime checks + Slack channel `#binary‑hub‑alerts`.

---

## 7. Backlog de Arquitetura Pós‑MVP

* **Edge Functions** (Vercel) para caching de KPIs.
* **BigQuery** sink para análises históricas (> 1 M trades).
* **gRPC** ou **GraphQL** se amplitude de dados crescer.
* **Mobile App** em React Native com Expo.


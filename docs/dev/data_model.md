# Binary Hub – Data Model & Firestore Schema

*Versão 1.0 • julho 2025*

> **Escopo:** detalha coleções, subcoleções, campos, tipos, índices e regras de segurança do MVP.

---

## 0. Convenções

* **CamelCase** para campos (`tradeId`, `createdAt`).
* **Snake\_case** para caminhos de documentos (`trades/{uid}/{tradeId}`).
* Todos *timestamps* em **ISO‑8601 UTC**.
* **UID = Firebase Auth uid** (string).
  Cada coleção de dados do usuário é particionada por `uid`.

## 1. Visão Geral de Coleções

```
users/{uid}
trades/{uid}/{tradeId}
rules/{uid}/{ruleId}
insights/{uid}/{insightId}
uploads/{uid}/{uploadId}
audit/{uid}/{auditId}
subscriptions/{uid}
```

---

## 2. users/{uid}

| Campo      | Tipo   | Exemplo                                   | Obrig. | Observações                      |
| ---------- | ------ | ----------------------------------------- | ------ | -------------------------------- |
| **uid**    | string | "v4h2…"                                   | ✔︎     | Idempotente (Auth)               |
| email      | string | [joe@example.com](mailto:joe@example.com) | ✔︎     | indexado para pesquisas internas |
| plan       | string | free \| pro                               | ✔︎     | default `free`                   |
| tz         | string | America/Bahia                             | ✔︎     |                                  |
| createdAt  | string | 2025‑07‑11T15:03:00Z                      | ✔︎     | setOnCreate                      |
| lastLogin  | string | 2025‑07‑14T11:09:00Z                      | –      | atualizado via Cloud Function    |
| mentorCode | string | BINARYCLASS2025                           | –      | promo/afiliado                   |

**Index sugerido:**

```
collection: users
fields    : [plan ASC]
```

---

## 3. trades/{uid}/{tradeId}

| Campo         | Tipo   | Exemplo              | Obrig. |                 |
| ------------- | ------ | -------------------- | ------ | --------------- |
| **tradeId**   | string | "1222333"            | ✔︎     |                 |
| timestamp     | string | 2025‑07‑10T18:07:00Z | ✔︎     |                 |
| asset         | string | EURUSD               | ✔︎     |                 |
| timeframe     | string | 1m                   | ✔︎     |                 |
| candleTime    | string | 18:05                | ✔︎     |                 |
| direction     | string | BUY \| SELL          | ✔︎     |                 |
| stake         | number | 10.0                 | ✔︎     |                 |
| executedValue | number | 10.0                 | ✔︎     |                 |
| openPrice     | number | 1.1315               | –      |                 |
| closePrice    | number | 1.1320               | –      |                 |
| result        | string | WIN \| LOSS          | ✔︎     |                 |
| pnl           | number | 8.5                  | –      | cálculo backend |
| refund        | number | 0.0                  | –      |                 |
| status        | string | OK \| ERROR          | –      |                 |
| emotion       | string | anxious              | –      | input manual    |
| tag           | string | macro                | –      |                 |
| source        | string | manual \| csv        | ✔︎     |                 |
| uploadId      | string | ref uploads/{uid}/…  | –      |                 |

**Composite index (timestamp DESC):**

```
collection: trades
fields    : [uid ASC, timestamp DESC]
```

---

## 4. rules/{uid}/{ruleId}

| Campo       | Tipo   | Exemplo              | Obrig. |
| ----------- | ------ | -------------------- | ------ |
| **ruleId**  | string | focus‑session        | ✔︎     |
| text        | string | "Operar só 19‑22h"   | ✔︎     |
| active      | bool   | true                 | ✔︎     |
| brokenCount | number | 4                    | –      |
| createdAt   | string | 2025‑07‑11T23:11:00Z | ✔︎     |

---

## 5. insights/{uid}/{insightId}

| Campo         | Tipo   | Exemplo                          | Obrig. |
| ------------- | ------ | -------------------------------- | ------ |
| **insightId** | string | 1699721592                       | ✔︎     |
| createdAt     | string | 2025‑07‑13T13:00:00Z             | ✔︎     |
| text          | string | "Sua taxa WIN após LOSS é 25 %…" | ✔︎     |
| kpiReference  | array  | \["winRateAfterLoss", "streak"]  | –      |
| modelVersion  | string | v1                               | –      |

---

## 6. uploads/{uid}/{uploadId}

Armazena metadados de arquivos CSV ou imagens de trade.

| Campo        | Tipo   | Exemplo              | Obrig. |
| ------------ | ------ | -------------------- | ------ |
| **uploadId** | string | "csv‑20250711‑1830"  | ✔︎     |
| fileName     | string | trades‑jul‑11.csv    | ✔︎     |
| mimeType     | string | text/csv             | ✔︎     |
| size         | number | 14789                | ✔︎     |
| fileUrl      | string | gs\://…              | ✔︎     |
| createdAt    | string | 2025‑07‑11T18:30:00Z | ✔︎     |
| processed    | bool   | true                 | ✔︎     |
| error        | string | "Row 99 malformed"   | –      |

---

## 7. audit/{uid}/{auditId}

Registra alteração crítica (upload, dedup, delete).

| Campo       | Tipo   | Exemplo                    |
| ----------- | ------ | -------------------------- |
| **auditId** | string | "dupe‑1222333"             |
| action      | string | deduplicate \| deleteTrade |
| relatedId   | string | tradeId ou uploadId        |
| details     | map    | { before: …, after: … }    |
| createdAt   | string | 2025‑07‑11T18:31:00Z       |

---

## 8. subscriptions/{uid}

| Campo    | Tipo   | Exemplo        | Observações             |
| -------- | ------ | -------------- | ----------------------- |
| plan     | string | pro            | sync via Stripe webhook |
| status   | string | active         | active \| past\_due     |
| renewAt  | string | 2025‑08‑11T03… |                         |
| stripeId | string | sub\_123       |                         |

---

## 9. Índices Compostos

```json
[
  {
    "collectionId": "trades",
    "fields": [
      {"fieldPath": "uid", "order": "ASCENDING"},
      {"fieldPath": "timestamp", "order": "DESCENDING"}
    ]
  },
  {
    "collectionId": "uploads",
    "fields": [
      {"fieldPath": "uid", "order": "ASCENDING"},
      {"fieldPath": "createdAt", "order": "DESCENDING"}
    ]
  }
]
```

---

## 10. Regras de Segurança (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // USERS
    match /users/{uid} {
      allow read, update, delete: if request.auth.uid == uid;
      allow create: if request.auth != null;
    }

    // TRADES
    match /trades/{uid}/{tradeId} {
      allow read, write: if request.auth.uid == uid;
    }

    // RULES
    match /rules/{uid}/{ruleId} {
      allow read, write: if request.auth.uid == uid;
    }

    // INSIGHTS (somente leitura)
    match /insights/{uid}/{insightId} {
      allow get, list: if request.auth.uid == uid;
      allow create, update, delete: if false; // gerado pelo backend
    }

    // UPLOADS
    match /uploads/{uid}/{uploadId} {
      allow read, write: if request.auth.uid == uid;
    }

    // AUDIT (somente leitura)
    match /audit/{uid}/{auditId} {
      allow get, list: if request.auth.uid == uid;
      allow write: if false;
    }

    // SUBSCRIPTIONS (somente leitura)
    match /subscriptions/{uid} {
      allow get: if request.auth.uid == uid;
      allow write: if false; // atualizado via webhook
    }
  }
}
```

*Principais pontos:*

* Acesso estritamente por `request.auth.uid`.
* Collections geradas por backend (insights, audit, subscriptions) bloqueiam escrita por cliente.
* Logs de segurança ativados via **Cloud Logging**.

---

## 11. Backup & Retenção

| Item                        | Política                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Firestore backup            | Daily (7 differential) + Weekly full (4 weeks)                   |
| Cloud Storage (uploads)     | Object versioning 30 dias; ciclo de vida → Nearline após 90 dias |
| BigQuery export (analytics) | Exporte diário, retenção 180 dias                                |

---

## 12. Conformidade LGPD/GDPR

* **Portabilidade:** endpoint `/exportData` gera ZIP com JSON + CSV do usuário.
* **Direito ao esquecimento:** Cloud Function `deleteAccount` remove/anonimiza dados em Firestore, Storage e Stripe.
* **Consentimento:** flag `termsAcceptedAt` em `users/{uid}`.
* **Sub‑processadores listados** em `PRIVACY.md`.

---

## 13. Limites & Quotas

| Recurso           | Free Plan | Pro Plan  |
| ----------------- | --------- | --------- |
| Trades por dia    | 300       | 3 000     |
| Upload CSV (MB)   | 5 MB      | 25 MB     |
| Imagens por trade | 0         | 3         |
| Retenção Insights | 30 dias   | Ilimitado |

Alertas em **Cloud Monitoring** disparam quando uso > 80 %.

---

## 14. Evolução Futura do Esquema

1. **Coleção `strategies/{uid}`** – parametrizar setups e backtests.
2. **Subcoleção `notes` dentro de trades** – comentários multi‑linha.
3. **Tabela agregada em BigQuery** – para relatórios pesados.
4. **Edge Cache** de KPIs (Cloud Run + Redis) – quando MAU > 10 k.

---

## 15. Glossário

| Termo      | Significado                             |
| ---------- | --------------------------------------- |
| UID        | User ID autenticado via Firebase        |
| CSV Import | Upload de histórico da corretora Ebinex |
| PII        | Personally Identifiable Information     |
| LGPD       | Lei Geral de Proteção de Dados (BR)     |
| KPI        | Key Performance Indicator               |

*Fim*

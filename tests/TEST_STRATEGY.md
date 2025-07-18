# Binary Hub – Test Strategy (MVP)

*Versão 1.1 • julho 2025*

Este documento define **o processo completo de testes** para a primeira versão do Binary Hub (web‑app + BFF API + Cloud Functions). Ele cobre níveis, ferramentas, critérios de saída e integração contínua.

---

## 1 • Objetivos

1. **Evitar regressões** a cada commit no `main`.
2. **Garantir** que processos críticos (registro/manual + CSV, dashboard, insights) funcionem > 99 %.
3. **Medir perf.** do backend (< 300 ms p95) e do front (< 2,5 s LCP).
4. **Automatizar** o máximo possível: testes rodam em CI GitHub Actions.

## 2 • Escopo

| Camada                  | Incluído                                                   | Excluído                   |
| ----------------------- | ---------------------------------------------------------- | -------------------------- |
| Frontend (Next.js)      | Páginas públicas, auth, dashboard, upload CSV, insights UI | Admin console futuro       |
| Backend (Cloud Run BFF) | Todas rotas no `OPENAPI.yaml`                              | Webhooks Stripe (fase Pro) |
| Cloud Functions         | `csv‑parser`, `insight‑cron`                               | Futuras funções de email   |

## 3 • Níveis & Cobertura‑alvo

| Nível         | Ferramenta                                   | Meta Cobertura                         | Gatilho CI                           |
| ------------- | -------------------------------------------- | -------------------------------------- | ------------------------------------ |
| Unit          | **Vitest** (front) / **Jest** (back)         | ≥ 80 % linhas                          | `push`, `pull_request`               |
| Integration   | **Supertest** (API) + **Firebase Emulator**  | Fluxos happy‑path                      | `push`, nightly cron                 |
| E2E           | **Cypress Cloud** (Chrome)                   | Cenários críticas (login, import, KPI) | `pull_request` label `e2e` + nightly |
| Performance   | **k6** (backend) / **Lighthouse CI** (front) | p95 < 300 ms (API) / LCP < 2,5 s       | semanal                              |
| Static / Lint | **ESLint**, **Prettier**, **SonarCloud**     | 0 erros bloqueantes                    | `push`                               |

## 4 • Matrizes de Teste E2E

* Browsers: Chrome latest, Firefox ESR (headless via Docker).
* Viewports: desktop (1440 × 900), mobile (iPhone 12).
* Usuários: *Free* (uid‑free), *Pro* (uid‑pro), *Edge‑Case* (csv com 10 k trades).

## 5 • Dados de Teste

* Gerados via Fixtures (`src/__fixtures__`).
* CSVs de exemplo (pequeno, grande, duplicado).
* Firestore emulated; reset entre testes (`firebase emulators:exec`).

## 6 • Critérios de Aceite & Saída

| Métrica       | Limite         | Bloqueia release?  |
| ------------- | -------------- | ------------------ |
| Unit coverage | ≥ 80 % linhas  | ✅                  |
| E2E passagem  | 100 % cenários | ✅                  |
| API p95       | < 300 ms       | ✅                  |
| Front LCP     | < 2,5 s        | ⚠︎ alerta se > 3 s |

## 7 • Pipeline CI

1. `lint-format` → ESLint, Prettier.
2. `unit-test` → Vitest/Jest + coverage.
3. `integration-test` → Supertest + Firebase Emulator.
4. `e2e-test` (matrix) → Cypress.
5. `build` → Next.js static export, Docker backend.
6. `performance` (cron) → k6, Lighthouse CI.
7. Enforce branch protection (`required‑status‑checks`).

## 8 • Performance‑Test Script (k6)

```js
import http from 'k6/http';
import { sleep, check } from 'k6';
export const options = {
  vus: 20,
  duration: '1m',
};
export default function () {
  const res = http.get(`${__ENV.API_URL}/dashboard/kpi`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## 9 • Acessibilidade

* **axe-core** auditoria automática; falhas críticas bloqueiam PR.
* Contrast AA testado via **jest‑axe** em componentes.

## 10 • Responsabilidades

| Papel   | Tarefas                                           |
| ------- | ------------------------------------------------- |
| Dev     | Escrever & manter unit + integration tests        |
| QA Lead | Definir specs E2E, revisar falhas, aprovar merges |
| DevOps  | Manter pipeline CI, monitorar perf                |

## 11 • Critérios de Fail Fast

PR falha se: lint errors, cobertura < 80 %, qualquer E2E falho, p95 > 300 ms.

## 12 • Futuro

* BrowserStack matrix (Safari, Edge).
* Contract‑testing com **Pact** entre front/BFF.
* Chaos testing (latência Firestore) na v2.

---

> **Notas:** Valores de performance baseados em requisitos de Parte II §8 do Business Plan.

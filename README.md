# Binary Hub

> *Discipline. Data. Domination.*  – journaling & performance insights for binary‑options traders

![Build](https://img.shields.io/github/actions/workflow/status/binaryhub/binaryhub/ci.yml?branch=main)
![License](https://img.shields.io/github/license/binaryhub/binaryhub)

Binary Hub é uma aplicação **SaaS** que ajuda traders de opções binárias a registrar operações, rastrear KPIs e receber insights gerados por IA para corrigir maus hábitos. O projeto é construído para escalar a partir de um fundador solo até uma plataforma multi‑asset.

> **MVP meta:** lançar em 10 semanas e validar 50 WAU / 10 assinantes Pro.
> Para o escopo detalhado consulte [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md).

---

## ✨ Funcionalidades Principais (MVP)

| Feature                              | Estado |
| ------------------------------------ | ------ |
| Autenticação (Email, Google)         | ✅      |
| Log manual / CSV upload de trades    | ✅      |
| Dashboard com Win Rate, P\&L, streak | ✅      |
| Calendário de performance (heat‑map) | ✅      |
| Regras pessoais & aderência          | 🟡 (β) |
| Insight semanal do LLM               | ⬜      |
| Exportação PDF                       | ⬜      |

---

## 🏗️ Stack Técnica

| Camada       | Tech                               | Notas               |
| ------------ | ---------------------------------- | ------------------- |
| Front‑end    | **Next.js 14**, Tailwind CSS       | Deploy Vercel       |
| Back‑end     | **Firebase** (Auth, Firestore, CF) | NoSQL, serverless   |
| API Insights | **FastAPI** + OpenAI GPT‑4o        | Cloud Run           |
| CI / CD      | GitHub Actions                     | Lint, test, preview |
| Testes       | Jest, Pytest, Playwright           | Cobertura ≥ 80 %    |

---

## 📂 Estrutura do Repositório

```
.
├─ apps/
│  └─ web/         # Next.js front‑end
├─ functions/      # Firebase Cloud Functions (TypeScript)
├─ api/            # FastAPI service (Python)
├─ docs/           # PRD, arquitetura, data‑model, etc.
├─ design/         # Figma exports, Style Guide UI
├─ tests/          # Estratégia e suites E2E
└─ infra/          # IaC (Terraform opciona...

```

> _Changelog 2025-07-12_: variáveis de ambiente configuradas no Vercel para todos os ambientes.

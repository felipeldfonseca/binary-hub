# Binary Hub – Deploy Guide (Vercel + Firebase CI/CD)

*Versão 1.1 • julho 2025*

Este guia descreve o **pipeline de entrega contínua** do Binary Hub: front‑end **Next.js** hospedado na **Vercel** e backend (Cloud Run, Cloud Functions, Firestore, Storage) na **Google Cloud Platform** — tudo orquestrado via **GitHub Actions**.

---

## 1. Visão Geral do Fluxo

```
Git commit ➜ PR ➜ GitHub Actions (lint + test) ➜ Vercel Preview
           ⬇                ⬇
        Merge ➜ Staging deploy (GCP + Vercel)
           ⬇
   Tag `vX.Y.Z` ➜ Prod deploy após aprovação manual
```

* **Preview**: cada Pull Request gera URL única na Vercel (`-pr-###.vercel.app`).
* **Staging**: branch `main` após testes.
* **Prod**: tag semver + job manual `prod_approve`.

---

## 2. Estrutura de Branches

| Branch       | Ambiente | Regras                                                 |
| ------------ | -------- | ------------------------------------------------------ |
| `feature/*`  | Preview  | CI obrigatória, sem deploy.                            |
| `main`       | Staging  | Merge via PR + revisão obrigatória, deploy automático. |
| `release/*`  | —        | Geração de changelog, testes extras.                   |
| Tag `vX.Y.Z` | Prod     | Gatilho para workflow `deploy-prod`.                   |

---

## 3. Segredos & Variáveis de Ambiente

Armazenados no **GitHub Secrets** / **Vercel Project → Environment Variables**.

| Nome                           | Onde                     | Descrição                                    |
| ------------------------------ | ------------------------ | -------------------------------------------- |
| `VERCEL_TOKEN`                 | GitHub                   | Token de deploy via Vercel CLI               |
| `GCLOUD_SA_KEY`                | GitHub                   | JSON key da SA `binaryhub-ci`                |
| `FIREBASE_TOKEN`               | GitHub                   | Token `firebase login:ci`                    |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Vercel                   | Uso client‑side                              |
| `OPENAI_API_KEY`               | Vercel & Cloud Functions | LLM calls                                    |
| `DATABASE_URL`                 | Cloud Run                | Connection string Firestore (emulador local) |

---

## 4. GitHub Actions  – `/.github/workflows/ci-cd.yml`

```yaml
name: CI / CD
on:
  push:
    branches: [main]
    tags: [ 'v*.*.*' ]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 8 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit
      - run: pnpm lint

  build-front:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
          prod: ${{ github.ref == 'refs/heads/main' }}

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build-front
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/setup-gcloud@v2
        with:
          service_account_key: ${{ secrets.GCLOUD_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT }}
      - run: gcloud run deploy binaryhub-bff --image ${{ vars.IMAGE_TAG }} --region ${{ vars.REGION }} --platform managed --quiet
      - run: firebase deploy --only functions,firestore:rules --token ${{ secrets.FIREBASE_TOKEN }}

  prod_approve:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://binaryhub.app
    steps:
      - run: echo 'Manual approval gate.'

  deploy-prod:
    needs: prod_approve
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/setup-gcloud@v2
        with:
          service_account_key: ${{ secrets.GCLOUD_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT }}
      - run: gcloud run deploy binaryhub-bff --image ${{ vars.IMAGE_TAG }} --region ${{ vars.REGION }} --platform managed --quiet
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
          prod: true
```

---

## 5. Configuração na Vercel

1. **Import Project** → GitHub → `binaryhub` repo.
2. **Framework preset**: *Next.js* / Output: `./out` (se `next export`).
3. **Environment Variables** igual GitHub (Preview, Staging, Production).
4. **Production Branch**: `main`.
5. Domínio customizado: `binaryhub.app`.

---

## 6. Firebase / Google Cloud

| Recurso                  | Ferramenta   | Comando deploy                                  |
| ------------------------ | ------------ | ----------------------------------------------- |
| Firestore Rules          | Firebase CLI | `firebase deploy --only firestore:rules`        |
| Cloud Functions          | Firebase CLI | `firebase deploy --only functions`              |
| Cloud Run BFF            | gcloud CLI   | `gcloud run deploy binaryhub-bff --image <tag>` |
| Storage Bucket (uploads) | Terraform    | `terraform apply`                               |

*Use o **Terraform** para criar infra inicial (`infra/terraform`).*

---

## 7. Release & Changelog

1. Merge em `main` fecha milestone.
2. Criar tag `vX.Y.Z` → CI gera changelog via **semantic‑release**.
3. Job manual `prod_approve` no GitHub → botão *Deploy*.

---

## 8. Rollback & Disaster Recovery

| Camada    | Como reverter                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------- |
| Vercel    | **Instant Rollback**: selecionar revisão anterior.                                                 |
| Cloud Run | `gcloud run services list-revisions` → `gcloud run services update-traffic` para revisão anterior. |
| Firestore | Agendar export diário → `gcloud firestore import <gs://backup>`                                    |
| Storage   | Versioning habilitado no bucket `binaryhub-uploads`.                                               |

---

## 9. Monitoramento & Alertas

* **Vercel Analytics**: LCP, Web Vitals.
* **Cloud Monitoring**: uptime check `/health`, alerta p95 latency > 500 ms.
* **Sentry**: front & backend exceptions.
* **k6** perf‑test nightly: throughput, error rate.

---

## 10. FAQ

**Q:** Preciso de permissões GCP?
**A:** Use a SA `binaryhub-ci` com papéis: `roles/run.admin`, `roles/storage.admin`, `roles/cloudfunctions.developer`, `roles/firestore.admin`.

---

## 11. Referências

* [Vercel Git Integration](https://vercel.com/docs/git)
* [Google Cloud Run Deploy](https://cloud.google.com/run/docs/deploying)
* [Firebase CI/CD](https://firebase.google.com/docs/cli)

---

> *Última revisão: 11 jul 2025*

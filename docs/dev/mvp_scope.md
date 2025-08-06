# Binary Hub – MVP Scope

*Versão 1.0 – julho 2025*

## Objetivo

Entregar, em até **10 semanas**, uma versão funcional do Binary Hub que permita a um trader de opções binárias:

1. Criar conta, logar e registrar manualmente seus trades ou  baixar o CSV feito na corretora com o histórico das transações.
2. Visualizar indicadores‑chave de performance (KPIs) em um dashboard resumido.
3. Navegar por um calendário mensal com color‑heat por lucro/prejuízo diário.
4. Definir até **3 regras pessoais** de disciplina e acompanhar a aderência.
5. Receber **1 insight automático** do LLM por semana sobre padrões de execução.

> **Meta de sucesso:** 50 usuários ativos semanais (WAU) & ≥ 10 assinantes Pro até o final do MVP.

---

## 1. Funcionalidades (Must / Should / Could)

| ID       | Epic / Feature            | Descrição resumida                                                                                                      | Prioridade |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------- |
| **P‑01** | Onboarding & Auth         | E‑mail + Google SSO. Detectar timezone.                                                                                 | **Must**   |
| **P‑02** | Log Manual de Trade       | Form em `/app/log` com validação. Campos: data/hora, ativo, direção (CALL/PUT), stake, payout, resultado, tag & emoção. | **Must**   |
| **P‑03** | Dashboard KPIs            | Win Rate, série de vitórias/derrotas, P\&L diário/sem.                                                                  | **Must**   |
| **P‑04** | Calendário de Performance | Grade mensal com cor (verde, vermelho, neutro) conforme lucro. Tooltip mostra stats do dia.                             | **Must**   |
| **P‑05** | Regras & Aderência        | CRUD de até 3 regras. Cálculo % aderência last 30 trades.                                                               | **Should** |
| **P‑06** | Insight LLM semanal       | Cron job gera insight JSON e grava em `insights/{uid}`. Mostra último insight no dashboard.                             | **Could**  |
| **P‑07** | Billing Stripe            | Upgrade Free → Pro (US\$ 12/mês).                                                                                       | **Could**  |
| **P‑08** | Exportação PDF            | PDF semanal com KPIs + calendário.                                                                                      | **Could**  |

---

## 2. User Stories & Acceptance Criteria

### Epic P‑02 – Log Manual de Trade

* **US‑02‑01:** *Como trader*, quero registrar um trade em < 15 seg, para manter meu diário atualizado.

  * **AC‑1:** Campo obrigatório sinalizado; submit desabilitado se inválido.
  * **AC‑2:** Após salvar, toast “Trade salvo” e redirect opcional.
  * **AC‑3:** Request REST `/trades POST` responde 201.

### Epic P‑03 – Dashboard KPIs

* **US‑03‑01:** *Como usuário*, quero ver meu win rate semanal na primeira dobra do dashboard.

  * **AC‑1:** Cálculo: wins ÷ (wins+losses) × 100, período rolante 7 dias.
  * **AC‑2:** Gauge exibe zona verde ≥ 60 %, amarelo 50–60 %, vermelho < 50 %.

*(demais histórias em backlog →* `docs/PRD.md`)\*

---

## 3. Restrições & Premissas

* Front‑end **Next.js 14** + **Tailwind v3**.
* Back‑end **Firebase** (Auth, Firestore, Cloud Functions).
* LLM: **OpenAI GPT‑4o** via função programada (cron Diário Dom‑05 UTC).
* Sem importação automática de ordens (integrações planejadas pós‑MVP).

---

## 4. Métricas de Sucesso (MVP)

| Métrica                     | Meta                          |
| --------------------------- | ----------------------------- |
| WAU (traders ativos)        | ≥ 50                          |
| Trades registrados          | ≥ 2 500 nos primeiros 60 dias |
| Conversão Free → Pro        | ≥ 15 %                        |
| Churn 30D                   | ≤ 10 %                        |
| Tempo médio de resposta API | < 300 ms (p95)                |

---

## 5. Cronograma Macro

| Semana | Entregável chave                               |
| ------ | ---------------------------------------------- |
| 1‑2    | P‑01 (Auth) + Setup CI/CD                      |
| 3‑4    | P‑02 (Log) + Modelo Firestore                  |
| 5‑6    | P‑03 Dashboard + P‑04 Calendário               |
| 7‑8    | P‑05 Regras + Beta privado (20 users)          |
| 9‑10   | P‑06 Insight LLM + Hardening + Go‑Live público |

---

## 6. Fora de Escopo MVP

* Integração automática com corretoras (Ebinex API).
* App mobile nativo.
* Suporte a Forex/Futuros/Crypto.
* IA preditiva em tempo‑real.

---

## 7. Riscos & Mitigações

| Risco                           | Impacto             | Mitigação                                      |
| ------------------------------- | ------------------- | ---------------------------------------------- |
| Sobrecarga Firestore > 50 req/s | Latência alta       | Cache SWR + índices corretos                   |
| Custos API OpenAI               | Surpresa financeira | Limitar prompt semanal e tamanho do histórico  |
| Falta de engajamento            | WAU < 50            | Gamificação: streak, badges, notificações push |

---

## 8. Definição de Pronto (DoD)

* Código em *main* compila sem erros.
* ≥ 80 % cobertura unitária.
* Lighthouse perf/accessibility ≥ 90.
* Contraste AA em todos os textos.
* Releasenotes adicionadas ao `CHANGELOG.md`.

---

## 9. Analytics & Observability

| Camada            | Ferramenta                                  | Propósito                                                                              |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Event Tracking    | **PostHog** (self‑host, open‑source)        | Track page views, feature usage, funnel to Pro upgrade                                 |
| Product Analytics | **Google Analytics 4**                      | Complementary web traffic metrics                                                      |
| Logs & Metrics    | **Google Cloud Logging + Cloud Monitoring** | Collect logs from Cloud Functions; set alerts (latency > 500 ms p95, error rate > 1 %) |
| Error Reporting   | **Sentry**                                  | Capture front‑end (Next.js) and back‑end exceptions, tag by uid                        |

> **Nota:** Eventos‑chave enviados ao PostHog: `trade_created`, `csv_imported`, `insight_viewed`, `plan_upgraded`. Dashboard padrão disponível em `/ph/dashboard/1`.

## 10. CDN & Asset Storage

1. **Firebase Hosting + CDN (Fastly)** para servir bundle Next.js, estáticos e imagens públicas.<br>
2. **Cloud Storage Buckets** divididos:

   * `public-assets` (imagens marketing) — **CDN ativado**.
   * `user-uploads` (prints de trade/manual) — acesso autenticado, **Signed URL** expirando em 15 min.
3. **Cloudflare Proxiado** (CNAME) sobre `cdn.binaryhub.app` para cache global e WAF extra.
4. Imagens otimizadas on‑the‑fly usando `next/image` + `Image CDN`.

### Fluxo de Upload de Imagem (Plano Pro)

```
Client → /api/getSignedUrl → GCS (user‑uploads) → CDN invalidation (Cloudflare) → Firestore trade.document.imageUrl
```

Alertas de quota (GCS, CDN egress) configurados em Cloud Billing.

*Fim do MVP\_SCOPE*

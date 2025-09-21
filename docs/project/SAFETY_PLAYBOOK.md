Below is a **repeatable “safety net” playbook** that—if you adopt it—makes the kinds of problems you hit this week (giant build artifacts in Git, missing secrets, red‑X prod deploys) *very* hard to re‑introduce.

---

## 1 · Keep the repo clean **before** it reaches `main`

| Guardrail                           | How to turn it on                                                                                    | What it prevents                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **`.gitignore + `.gitattributes\`** | *Already add* `functions/lib/**`.<br>Use `git add --intent-to-add` + `git status` to spot surprises. | Large compiled files sneaking into history.      |
| **Local pre‑commit hook**           | `.git/hooks/pre-commit` →<br>`npx lint-staged` + `npm run test -- --bail`                            | Lint and unit tests must pass *before* commit.   |
| **Branch protection rules**         | GitHub Settings → Branches → Protect **main** + require green CI.                                    | Stops direct pushes & red builds from landing.   |
| **Size‑checker Action**             | Add `github/small-pr.yml` (rejects >500 KB additions).                                               | Flags accidental build artifacts or media blobs. |
| **Dependabot/Renovate**             | Enable in repo → Autopr PRs pinned to `ci/bot`.                                                      | Keeps libraries current without manual bumping.  |

---

## 2 · Make CI/CD say “no” early

| Layer                       | Add this step                                                                         | Outcome                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **CI workflow**             | `npm run lint && npx tsc --noEmit` **before build**                                   | Type & ESLint issues stop the pipeline, not prod.                    |
| **Secrets check**           | Custom script: *fail* if any `process.env.*` referenced in code is missing in CI env. | No more “secret does not exist” deploy exits.                        |
| **Smoke‑deploy on staging** | Set `FIREBASE_PROJECT_ID=…-staging` for branch builds.                                | Prod untouched until final merge; manifests real cloud issues early. |

---

## 3 · Standardize branch & deploy strategy

```text
feature/*        → PR → main          (auto Preview on Vercel, no deploy)
hotfix/*         → PR → main          (run staging deploy on branch)
main             → green CI          → prod deploy (Vercel + Firebase)
```

*Never commit directly to `main`; always PR.*

---

## 4 · Automate **environment & secret** management

| Tool                         | Setup                                     | Payoff                                                      |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| **Firebase Secrets Manager** | `firebase functions:secrets:set NAME`     | Rotates & versions secrets; matches `runWith({ secrets })`. |
| **Vercel dashboard vars**    | Use plain vars; no `@secret` indirection. | One place to update keys; CLI won’t error.                  |
| **Secret scanning in CI**    | GitHub built‑in or TruffleHog Action      | Prevents pushing raw keys to repo.                          |

---

## 5 · Early warnings during local dev

| Add‑on                         | Command                                                   | Benefit                                                          |                                      |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| **`husky` + `lint-staged`**    | `npx husky-init && npm i -D lint-staged`                  | Auto‑runs ESLint/Prettier on staged files.                       |                                      |
| **`git hook` for large files** | Pre‑commit script: \`if \[ \$(git diff --cached --numstat | awk '{sum+=\$1} END {print sum}') -gt 10000 ]; then exit 1; fi\` | Blocks >10 K LOC accidental commits. |
| **VS Code ESLint + ErrorLens** | Workspace settings                                        | Shows lint/type errors inline *before* commit.                   |                                      |

---

## 6 · Add confidence after deploy

| Tool                                             | What to capture                                          | Alerts                         |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------------------ |
| **Firebase Crashlytics or Sentry**               | Frontend & Functions exceptions                          | Slack/Email on spike           |
| **Log‑based metrics (Cloud Logging + Alerting)** | 5xx count, cold‑start time                               | PagerDuty/Email on threshold   |
| **Synthetic ping**                               | Hit `/api/health` twice per minute (Upptime, StatusCake) | Notifies if health probe fails |

---

## 7 · Document your workflow (one‑pager)

* **“How to add a secret”** – Firebase vs Vercel
* **“How to release”** – branch → PR → merge → watch Actions → smoke‑test
* **“Rollback”** – `functions:rollback` or `vercel deploy --prod --commit=<sha>`

Put this in `/docs/dev-process.md` and link it in README; teammates follow the same path.

---

### TL;DR

1. **Block bad artifacts:** `.gitignore`, size‑checker, pre‑commit lint+test.
2. **Fail fast in CI:** type‑check, secret‑presence check, staging deploy.
3. **Gate production:** branch protection + green CI required.
4. **One source of secrets:** Firebase for backend, Vercel vars for frontend.
5. **Monitor prod:** health pings + error tracking.

Adopt these guardrails and a repeat of the two‑day cleanup becomes virtually impossible—future fixes stay tiny, and new features ship with confidence.

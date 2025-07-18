**Progress recap & next‑step brief”**

### 🚀 What we accomplished today

1. **Claude Code tooling fixed**

   * Removed legacy alias, installed `@anthropic-ai/claude-code`, verified with `/doctor`.

2. **Frontend (Next 14) rehab**

   * Upgraded Firebase SDK → v11, fixed `undici` build error.
   * Added runtime env‑var guard + `vercel.json` rewrite.
   * Deleted outdated `"functions"` pattern from both repo **and** Vercel project settings.
   * Hot‑fix branch `hotfix/remove-vercel-env` merged; **Vercel Production deploy green**.

3. **Backend (Firebase Functions v2) rehab**

   * Migrated from `functions.config()` → `process.env` + `runWith({ secrets })`.
   * Added `OPENAI_API_KEY` secret via `firebase functions:secrets:set`.
   * Updated GitHub Action: Node 20, `tsc --noEmit`, cache, secret injection.
   * Deleted stale HTTPS version of `processCSVUpload`; Storage‑trigger now live.
   * Successful CI deploy on **main** (Cloud Run containers start cleanly).

4. **CI/CD workflow hardened**

   * Branch builds run tests only; deploy steps gated to `main`.
   * Hot‑fix branch created & force‑pushed safely after ref corruption fix.
   * Frontend + backend now auto‑deploy on PR merge.

5. **Secrets & env management**

   * Backend secrets stored in Firebase Secret Manager.
   * Frontend uses Vercel dashboard env vars (no secrets in Git).

### 🔮 Recommended next steps

| Priority          | Task                                                                | Command / Link                                           |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| ✅ Smoke‑test prod | Hit `/api/health` & key UI pages                                    | `curl https://<prod-domain>/api/health`                  |
| High              | **Ignore compiled artefacts**                                       | add `functions/lib/**` to `.gitignore`, delete from repo |
| High              | Rotate `FIREBASE_TOKEN` → SA JSON                                   | set `GOOGLE_APPLICATION_CREDENTIALS` in CI               |
| Med               | Clean ESLint warnings (11 backend, 1 frontend)                      | `npm run lint --fix`                                     |
| Med               | Move deprecated `viewport` / `themeColor` metadata                  | see warnings in Next build log                           |
| Med               | Enable Vercel Preview URLs for all PRs (defaults on)                | dashboard check                                          |
| Low               | Add monitoring & alerts (Log‑based, Sentry)                         | n/a                                                      |
| Low               | Write Jest / React Testing Library tests for critical flows         | `claude "/test-gen"`                                     |
| Low               | Automate dependency bumps (Renovate or Dependabot)                  | enable in repo settings                                  |
| Housekeeping      | Delete old branches (`fix/functions-v2-deployment`, temp hot‑fixes) | `git push origin --delete <branch>`                      |

### 📚 Context pointers

* Frontend prod URL: `https://<vercel-production-domain>`
* Backend base URL: `https://us-central1-<project-id>.cloudfunctions.net/api`
* Secrets in Firebase: `OPENAI_API_KEY` v2 (others none required)
* Default branch: **main**
  Branch‑protected deploy gate: `if: github.ref == 'refs/heads/main'`


Executing the follow‑up tasks will **finish hardening your production pipeline, reduce future break‑fix cycles, and make day‑to‑day development smoother.**  Here’s what each item buys you:

| Recommendation                                         | What you gain                                                                 | Why it matters                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Smoke‑test prod endpoints**                          | Confidence that the new infra really serves traffic end‑to‑end.               | Catches DNS, SSL, or routing issues before users do.                                           |
| **Ignore `functions/lib/**` in Git**                   | Smaller repo, faster clones & CI, zero merge conflicts on generated code.     | Keeps compiled artifacts out of version control—the root cause of yesterday’s history rewrite. |
| **Rotate `FIREBASE_TOKEN` → SA JSON**                  | Future‑proof authentication; removes a deprecated token flow.                 | Firebase CLI will drop `--token`; service‑account keys are the long‑term supported path.       |
| **Fix ESLint warnings**                                | Cleaner PR diff noise; fewer runtime bugs (unused vars, missing deps).        | Warns you before bugs reach prod; makes code reviews easier.                                   |
| **Move deprecated `viewport` / `themeColor` metadata** | Silence Next.js build warnings; ensure forward compatibility with App Router. | Next‑JS 15 may make these warnings errors.                                                     |
| **Enable Vercel Preview URLs**                         | Instant per‑branch QA links for design, PM, or mobile testers.                | Lets stakeholders try features before merge; reduces rework.                                   |
| **Add monitoring / error tracking**                    | Real‑time alerts for 5xx errors, slow cold‑starts, and exceptions.            | You’ll know when an OpenAI call fails before a user tweets about it.                           |
| **Write backend & frontend tests**                     | Safety net for refactors; CI fails fast on regression.                        | Protects critical flows (auth, CSV upload, insights) as the codebase grows.                    |
| **Automate dependency bumps**                          | Latest security patches with minimal manual effort.                           | Renovate/Dependabot PRs surface vulnerabilities early.                                         |
| **Delete stale branches**                              | Cleaner repo, faster `git fetch`, no accidental pushes to old branches.       | Good hygiene once the hot‑fixes and function‑migration branches are merged.                    |

**Big picture:** these steps lock in the stability you just achieved, reduce manual toil in CI/CD, and create guardrails (tests, linting, monitoring) that let you ship new features with confidence instead of firefighting infrastructure issues.

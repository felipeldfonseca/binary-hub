# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Binary Hub is a personal trading journal and market hub, used by its owner for binary options (Ebinex) and futures (Top One). It is being rebuilt screen by screen from an approved prototype, in phases (see "Plan" below). The owner speaks Brazilian Portuguese: UI text and conversation are in pt-BR; code, identifiers and comments are in English.

The old Firebase backend is gone. Everything runs on Next.js + Supabase + Vercel. Documents from before the rebuild are archived in `docs/arquivo/` and describe a product that no longer exists; do not treat them as current.

## Commands

From the repository root (they all run in `app/`):

```bash
npm run setup        # install app dependencies (npm ci)
npm run dev          # Next.js dev server on :3000
npm test             # Jest (CI mode)
npm run type-check   # tsc --noEmit
npm run lint         # next lint
npm run build        # production build
```

Inside `app/`, `npx jest --ci <path>` runs one suite. Use Node 22 (`.nvmrc`). Before opening a PR, run the tests, the type check and lint; CI (`.github/workflows/ci.yml`) runs Jest and `tsc --noEmit` on every PR.

## Stack and layout

- `app/`: the only application. Next.js 14 (app router), TypeScript, Tailwind, Jest + Testing Library.
  - `app/app/(hub)/`: the new screens, built from the approved boards (today only `/diario`, a placeholder).
  - `app/app/*`: the old pages (`/dashboard`, `/trades`, `/analytics`, `/market`, ...). They stay until each one is replaced; they are removed in the last phase.
  - `app/app/api/`: route handlers.
  - `app/components/hub/`: the hub frame (`HubRoot` theme, `HubGate`, `AppShell`, `HubHeader`, `ThemeSwitch`).
  - `app/lib/apiAuth.ts`: session and allow-list checks for API routes.
  - `app/lib/domain/tempo.ts`: time-zone helpers (see below). `tradingDayOn` and `tradingDayFor` mirror the database's `trading_day_on` and `trading_day_for`.
  - `app/lib/domain/gate/`: "Posso operar hoje?" and the plan marks of a trade, from an account's stored rules (`parseRules` accepts exactly what `rules_check_resolved` accepts). It mirrors the database's `gate_eval` and `limit_usage`; `__tests__/domain/gate/cases.json` holds cases whose expected values were computed by the SQL, so change both sides together. The pt-BR words live in `app/lib/hub/posso.ts`.
  - `app/lib/utils/`: CSV parsers for Ebinex and Top One, and the import path.
  - `app/styles/hub.css`: the boards' design tokens, scoped to `.hub`.
- `supabase/`: local config and SQL migrations. There is a single Supabase project (no separate test project); migrations run on it.
- `design/`: logos and fonts.
- Deploy: the GitHub workflow `deploy_frontend.yml` builds and deploys to Vercel on push to `main`. Day-to-day work merges into `feature/rebuild-lean`; `main` still holds the pre-rebuild app until the rebuild is promoted.

## Auth and access

- The Supabase session lives in the browser. API routes get the user from the bearer token with `requireUser(request)` and must call it first.
- Paid AI endpoints also call `denyPaidAi(user)` (env `AI_ALLOWED_USERS`). Hub endpoints call `denyHubAccess(user)` (env `HUB_USERS`). Sign-up is open, so with a list unset nobody is allowed.
- `__tests__/api/routesRequireAuth.test.ts` discovers every route handler on disk; add new handlers to `EXPECTED_HANDLERS`.
- The server cannot tell who requests a page. Anything a hub page renders on the server reaches every visitor; `ProtectedRoute` and `HubGate` only hide it. Private data is read in the browser with the user's session, where row-level security limits it to the owner, or through API routes that check the session. Anything that costs money or reaches a third party (market data, AI) goes through API routes that also check HUB_USERS.

## Time zones and trading days

- Broker files differ by format:
  - Current Ebinex exports (`operacoes_*.csv`, `DD/MM/YYYY HH:MM:SS`) carry Brasília wall-clock time (America/Sao_Paulo). The current parser reads them as UTC, so those trades show 3 h early.
  - Old Ebinex exports (ISO `Data` with an explicit offset such as `+00:00`) already name the right instant: keep the offset, never reinterpret it. Their losses are written without a sign (the unsigned stake).
  - Top One exports are in UTC; `PnL` is gross, `Commissions` is a positive cost, `Gain` is a percentage of the account.
- Only offset-less wall-clock values go through `AT TIME ZONE`; casting a string with an offset to `timestamp` would drop the offset.
- Postgres (`timestamp AT TIME ZONE tz`) is the canonical conversion. `localToUtc` in `lib/domain/tempo.ts` follows the same rules (skipped times use the offset from before the change; repeated times take the later occurrence) and only accepts `UTC` or Area/Location zone names.
- A trading day is the date on the clock of the account's window; an overnight window counts on the day it opened (`tradingDay`, `inWindow`). Never derive a day from `toISOString()` or the browser's zone.

## Hub UI

- Tokens: `.hub[data-tema="claro"]` (`--bg #505050`) and `.hub[data-tema="escuro"]` (`--bg #17191A`), matching the approved boards. Tailwind exposes them as `hub-*` colours. New colours apply only inside `.hub`; do not change `globals.css` or the old pages' look.
- The theme is saved in `localStorage` (`lib/hub/tema.ts`) and applied before the first paint by an inline script in `HubRoot`.
- Menu: Início · Diário · Análises · Mercado · Social · AI · Conquistas. The last three are "em breve" (not designed yet).
- Check text contrast (4.5:1) in both themes, touch targets of 44px and keyboard use; verify layouts at 375, 768 and desktop widths.

## Environment variables

Names are listed in `app/.env.example` (names only, never values). The server-side values live in the Vercel project (`ANTHROPIC_API_KEY`, `AI_ALLOWED_USERS`, `HUB_USERS`). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are GitHub secrets: `deploy_frontend.yml` passes them to both the check build and the `vercel build` step, whose output is what gets deployed; they are not in the Vercel project, so a build Vercel runs on its own would lack them. Never print or commit values from `.env` files.

## The repository is public

- Never commit real broker exports. `docs/csv/` is gitignored and holds the owner's real files; when reading them, report only headers, counts and totals.
- Scan outgoing commits for keys and personal data before pushing.
- Tests use invented data only.

## Plan

The approved plan has ten phases, each ending with a screen the owner tests and approves before the next starts:

0. Safe base and frame (done): CI, cleanup, time helpers, hub frame, `/diario` placeholder.
1. Accounts and import: real accounts, an import that can be undone, per-broker fields (Top One stop, target, commission; Ebinex exit and payout), correct time zones.
2. Rules and windows: operating windows per account or market, versioned rules, "Posso operar hoje?".
3. Log a trade: setup, marks with server time, window and limit warnings, images and a note.
4. Diário: calendar, the day, the week.
5. Market state, computed by rules.
6. Análises (KPIs per account).
7. Padrões (evidence engine with levels).
8. Mercado, asset page, Início and AI readings.
9. Switch-over: redirects, remove old pages and columns.

Do not start a phase, or implement a screen, before the owner approves it.

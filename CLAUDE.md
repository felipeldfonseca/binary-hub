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
  - `app/lib/domain/registro/`: «Registrar operação» (Phase 3), the same rules as the database's Registrar functions: payload checks with the database's codes and fields, the instrument table (`TRADE_CAPS`/`INSTRUMENT_SPEC` = `trade_caps_all()`/`instrument_specs()`), results with Postgres `numeric` arithmetic, the entry, exit and expiry instants (Ebinex: 1, 5 and 15 min, each on the next candle), the warning when an entry's risk passes what is left of the daily loss limit (never a block), «limpa» marks and the import's link to registered trades. `__tests__/domain/registro/cases.json` holds cases computed by the SQL, so change both sides together. The calls, their answers and the pt-BR number reader live in `app/lib/hub/registrarDb.ts` and `app/lib/hub/numero.ts`.
  - Phase 3c (partial exits, «Mover stop», «Desfazer», «Já fechada» in several exits, the breakeven rule) mirrors migrations `20261023000001..3`: `registro/parciais.ts` (`trade_exits_sum`, `trade_r_of`, `trade_state`'s position, `register_partial`, `undo_event`, `register_after`'s exits), `registro/breakeven.ts` (`trade_favor`, `trade_breakeven`, `move_stop`), the breakeven rule in `gate/rules.ts` and `lib/hub/regras.ts`, `dayUsage` with each exit at its own instant (`limit_usage`) and `assignImportLinks` with positions in several rows (`import_stage`). `__tests__/domain/cases3c.json` holds cases computed by that SQL, and `app/testing/fixtures/parciais/` holds its answers and table rows, recorded by `__tests__/lib/hubParciais.pg.test.ts` (`BH_PG_RECORD`) on a throwaway cluster: change the SQL and the TypeScript together, then re-record both. An average exit divides the stored `numeric(18, 8)` operands, as `trade_exits_sum` does; data-layer numbers arrive as JSON numbers, exact to about 15 significant digits.
  - `app/lib/domain/import/`: the import path, read in the browser into `ImportRow`s for `import_preview`/`import_commit` (keys = `trades` columns, wall clocks and exact decimal strings; issues carry a line, a code and our field name, never a cell value): the Ebinex and Top One readers (`detectPlatform`, `parseImportText`), and `routeFile`, which decides once the account is known where any other file goes (a near-complete Ebinex or Top One header stays that reader's error in its market; anything else is mapped, except in binaries).
  - `app/lib/domain/import/mapped/`: the column-mapping import (Phase 3b, `p_platform = 'modelo'` plus `p_format`, `market_caps_all()`'s `"mapping"` = `MARKET_SPEC.mapping`): sniffing (separator, title lines, the decimal mark decided once per file from unambiguous numbers, the date order), the fields and their pre-fill, models («modelos», `import_templates`: the header signature is sha256 of the normalised names sorted by code point, as the SQL computes it), trade rows (`trades.ts`: net → gross, swap, futures symbols normalised, options and non-dollar crypto refused, `pnl_basis` 'prices'/'estimate' when the prices give the result) and execution rows (`fills.ts`: orders with nothing executed skipped, merged fills, FIFO lots per symbol and «Conta» value, one trade per entry, each sell closing the oldest first and each partial sell an exit of its trade; a position from before the file, when «Abre ou fecha» (every value understood) or «Resultado realizado» shows it, put first so it closes first; otherwise the end-of-file question, asked whenever the symbol's executions do not add up to zero, with «Não sei» pre-selected; a symbol with an execution the reader refused left out whole; the file's realized result shared over the slices; an execution file counts exits, never lines). The trades drawn are `import_stage`'s positions on the file zone's instants (`fileTz`), and no row or position the reader sends passes the `trades` columns (`position_too_large`), so the preview always predicts the commit; zone names are taken as Intl spells them (`tempo.isZoneName`: the database's `pg_timezone_names` is case-sensitive). The database derives `asset_type`, the key of a row without an ID and recomputes a result from prices; `server.ts` is its twin (`import_checked_rows`' codes, the key `'@' + 32 hex + '.n'` from the tuple), `checkTemplate` and `formatProblem` mirror `import_template_save` (its field vocabulary, HINTs and order) and `import_check_format`, and `registro/match.ts` never links a trade with an option contract. `__tests__/domain/cases3b.json` holds cases computed by that SQL (migrations `20261024000001..2`), with the reader's own rows and models of the board's files (`app/testing/mappedFiles.ts`), so change both sides together and re-record (`cases3b.test.ts` says how; the generator lives outside the repo). `__tests__/lib/hubImportColunas.pg.test.ts` imports those files end to end on a throwaway cluster (preview = commit, nothing new again, «Desfazer», models).
  - The screens of the column mapping (Phase 3b): the shared state of a mapped file is `app/lib/hub/importMapeado.ts` (`Mapeamento`, `iniciarMapeamento`, `arquivoDoMapeamento`, `modeloASalvar`; what «mapa» and «conferir» show is `importMapaVista.ts`), drawn by the steps `PassoMapa` / `PassoConferir`; the sheet around them (`ImportSheet`: routing, «Para qual conta?», «N contas neste arquivo», the zone step for every market with the account's import zone, the preview's lines, the model saved after the commit) reads `app/lib/hub/importPrevia.ts`. The models are read only once a file needs the mapping (`useImportTemplates`), so a reader's file never reads `import_templates`. `app/testing/mapeadoRespostas.ts` holds the database's answers in the approved board's world, proven against the real SQL by `__tests__/lib/hubImportTelas.pg.test.ts` (`BH_PG_RECORD` re-records them).
  - `app/lib/utils/`: the frozen legacy CSV readers, kept only for the parity tests of `app/lib/domain/import`.
  - `app/styles/hub.css`: the boards' design tokens, scoped to `.hub`.
- `supabase/`: local config and SQL migrations. There is a single Supabase project (no separate test project); migrations run on it.
- `design/`: logos and fonts.
- Deploy: the GitHub workflow `deploy_frontend.yml` builds and deploys to Vercel on push to `main` (`vercel build` + `vercel deploy --prebuilt`). The Vercel project's own framework preset is «Other», so `app/vercel.json` pins `"framework": "nextjs"`; without it the build ships only `public/` and every page is a 404. Day-to-day work merges into `feature/rebuild-lean`, which is promoted to `main` on the owner's request.

## Auth and access

- The Supabase session lives in the browser. API routes get the user from the bearer token with `requireUser(request)` and must call it first.
- Paid AI endpoints also call `denyPaidAi(user)` (env `AI_ALLOWED_USERS`). Hub endpoints call `denyHubAccess(user)` (env `HUB_USERS`). Sign-up is open, so with a list unset nobody is allowed.
- Trade images go from the browser straight to the private Storage bucket `trade-images` (no API route). Uploads are limited by the database table `hub_members`, which must hold the same logins as `HUB_USERS`; keep the two equal by hand (the rows are pasted in the SQL Editor, never committed). Upload with the Storage API's plain `upload` (no upsert), never with a signed upload URL: Storage checks the bucket's policies only when such a URL is created (`__tests__/lib/storageUploads.test.ts` keeps them out).
- `__tests__/api/routesRequireAuth.test.ts` discovers every route handler on disk; add new handlers to `EXPECTED_HANDLERS`.
- Rules are written only by the `save_rules` function (windows, defaults, account settings and the append-only versions); the API may update `trading_accounts` only on the columns the hub edits (label, firm, external_ref, phase, size, is_primary, archived_at). `profiles.preferences.calendars` feeds the futures versions, so a trigger keeps it (and `profiles.preferences_saved_at`) unchanged on every write except `save_rules`'s own. New accounts get `day_tz`, `day_start_min` and `currency` from `market_caps(market)` (insert trigger); the hub creates accounts in Futuros, binárias, Forex, Ações e opções (EUA), Cripto and B3.
- Money is in the market's currency: B3 in reais (`brl` in stored limits), everything else in dollars (`usd`; USDT and USDC count as dollars). Accounts in different markets are never summed.
- The server cannot tell who requests a page. Anything a hub page renders on the server reaches every visitor; `ProtectedRoute` and `HubGate` only hide it. Private data is read in the browser with the user's session, where row-level security limits it to the owner, or through API routes that check the session. Anything that costs money or reaches a third party (market data, AI) goes through API routes that also check HUB_USERS.

## Time zones and trading days

- Broker files differ by format:
  - Current Ebinex exports (`operacoes_*.csv`, `DD/MM/YYYY HH:MM:SS`) carry Brasília wall-clock time (America/Sao_Paulo). The current parser reads them as UTC, so those trades show 3 h early.
  - Old Ebinex exports (ISO `Data` with an explicit offset such as `+00:00`) already name the right instant: keep the offset, never reinterpret it. Their losses are written without a sign (the unsigned stake).
  - Top One exports are in UTC; `PnL` is gross, `Commissions` is a positive cost, `Gain` is a percentage of the account.
- Only offset-less wall-clock values go through `AT TIME ZONE`; casting a string with an offset to `timestamp` would drop the offset.
- Postgres (`timestamp AT TIME ZONE tz`) is the canonical conversion. `localToUtc` in `lib/domain/tempo.ts` follows the same rules (skipped times use the offset from before the change; repeated times take the later occurrence) and only accepts `UTC` or Area/Location zone names.
- A trading day is `compute_trading_day(account, instant)` in the database: the date on the account's day clock (`day_tz`, turning at `day_start_min`: 18:00 New York for futures, 17:00 New York for Forex, 20:00 New York for Ações e opções (EUA), midnight in Brasília for binaries, Cripto and B3), except that an entry inside an occurrence of a window of the rule version in force counts on the day that occurrence opened (so an overnight window counts on the day it opened). Before an account's first rule version only the day clock applies. Never derive a day from `toISOString()` or the browser's zone.

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
2b. Mercados: Forex, Cripto, Ações e opções (EUA) e B3 com janela e limite do dia.
3. Log a trade: setup, marks with server time, window and limit warnings, images and a note.
4. Diário: calendar, the day, the week.
5. Market state, computed by rules.
6. Análises (KPIs per account).
7. Padrões (evidence engine with levels).
8. Mercado, asset page, Início and AI readings.
9. Switch-over: redirects, remove old pages and columns.

Do not start a phase, or implement a screen, before the owner approves it.

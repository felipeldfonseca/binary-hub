# Fase 3c · telas · the screenshot harness (both lanes)

The one way C1, C2 and the merged base take the screenshots of the telas contract §9: a **visual spec** (Jest + Testing
Library, the lane's own mocks and the §8 fixtures) drives the real components to a board state and calls
`fotografar(...)`, which writes the render as an HTML page per theme; a script builds the worktree's CSS and shoots each
page in headless Chrome at **375, 768 and 1280 px**, **claro and escuro**. No dev server, no network, no live Supabase,
nothing staged. Everything is invented data (the recorded fixtures are).

Output: **`scratchpad/fase3c/telas/shots/<lane>/<scenario>-<width>-<tema>.png`** (`<lane>` = `c1`, `c2` or `base`;
`<scenario>` = the state's name, `<cenario>-<estado>`, e.g. `14-parcial-registrada-375-escuro.png`) and
`shots/<lane>/index.html`.

## 1. The pieces

| Piece | Where | Owner |
|---|---|---|
| Page writer `fotografar`, `marcacao`, `TEMAS_FOTO`, `LARGURAS_FOTO`, `fotosAtivas` | **`app/testing/telasShots.ts`** on `fase-3c/telas` (commit 02e73b9), tested by `app/__tests__/testing/telasShots.test.tsx` | **No lane** (contract §7.3: frozen for both; both import it; a needed change is reported to the orchestrator) |
| Runner `run.sh <worktree> <lane> [pattern]` | `scratchpad/fase3c/telas/shots/tools/run.sh` | the orchestrator (scratchpad, never in the repository) |
| CSS builder `css.mjs` (+ the harness's rules `shot.css`) | `scratchpad/fase3c/telas/shots/tools/` | idem |
| Shooter `shoot.mjs` (Chrome over `--remote-debugging-pipe`, PNG re-deflate, `index.html`) | `scratchpad/fase3c/telas/shots/tools/` | idem |
| Smoke spec (the harness's own check, §6) | `scratchpad/fase3c/telas/shots/tools/smoke/smoke.visual.test.tsx` | idem |
| The lanes' visual specs | `scratchpad/fase3c/telas/visual/<lane>/*.visual.test.tsx` (`c1`, `c2`; `base` = states needing both lanes) | each lane its folder |

## 2. Writing a visual spec

A spec is an ordinary Testing Library test file named `*.visual.test.tsx`, kept in the scratchpad (never in the
worktree): `run.sh` copies it into `app/__tests__/__visual__/` for the run only. It imports from `@/…` like any suite.

```tsx
/** C1 · scenario 14 (RO «Parciais e breakeven · MES 3 ct, 10:18»): the states of contract §9 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { fotografar } from '@/testing/telasShots'
// …the lane's own mocks, exactly as its suites mock them (jest.mock of '@/lib/supabase', '@/hooks/useAuth',
// '@/lib/hub/contasDb', '@/lib/hub/regrasDb', '@/lib/hub/registrarDb'), and the §8 fixtures / composed states

it('14 · step 2 → «Parcial» → after it', async () => {
  // …mocks answered with the recorded (or composed) answers
  render(<QueryClientProvider client={new QueryClient()}><RegistrarSheet accountId={…} tradeId={…} onClose={() => {}} /></QueryClientProvider>)
  await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
  expect(screen.getByText('Sua regra: breakeven com +8 pts, em 7.920,50.')).toBeInTheDocument()   // assert the state…
  fotografar('14-passo2', { quadro: 'RO 14 · Parciais e breakeven: o passo 2 às 10:18 (Avançar até a entrada)' })
  await userEvent.click(screen.getByRole('button', { name: 'Parcial' }))
  // …
  fotografar('14-parcial-registrada', { quadro: 'RO 14: Parcial → 1 → 7920,50 → Registrar parcial' })
  await userEvent.click(screen.getByRole('button', { name: 'Mover para o breakeven' }))
  expect(screen.getByRole('button', { name: 'Registrar stop' })).toHaveFocus()
  fotografar('14-sugestao-foco', { foco: true, quadro: 'RO 14: Mover para o breakeven (o foco em «Registrar stop»)' })
})
```

Rules:

- **Assert before you shoot.** Each `fotografar` follows the expectations that prove the state is the board's (its
  strings, from the contract's element table). A failing spec stops the whole run: a wrong state is never shot.
- **Names**: lower-case words and numbers joined by «-» (`^[a-z0-9]+(-[a-z0-9]+)*$`), scenario first: `14-…`, `16-…`,
  `6-eurusd-…`, `10-escolha`, `11-ponte-…`, `p1-…`, `import-…`, `pz-…` (Personalizar). One name once per run (a repeat
  throws). The script appends `-<width>-<tema>`.
- **`quadro`** (shown in `index.html`, never on the page): the board (`RO` = RegistrarOperacao, `P` = Personalizar), the
  scenario and the clicks that reproduce the state in the approved canvas (`Q3CThVmn9Mms7Bdi94MBg8`, version
  `1792580549-b8ef`), so the reviewer opens the same state there at the same widths. States the board does not draw say
  so («não desenhado: …»).
- **Board values**: wherever a recording differs from the board (contract §8 table: 14 step 3 and its variant, 16, 6),
  shoot the **composed** state, so the shot shows the board's numbers.
- **Clock**: the state's time comes from the mocked answers' `server_now` (rules_now and each write answer feed
  `useServerNow`), never from the device. When a state shows a time the spec does not answer for (an «Até …» that counts
  down, the hour field's prefill), pin it with `jest.useFakeTimers({ now: <instant>, advanceTimers: true })` before the
  render, as the lane's suites do.
- **Frames** (`moldura`): `'folha'` (default) for the Registrar and import sheets; `'pagina'` for the bridge, the chooser's
  host page and Personalizar (the markup goes inside `.hub-container > main#conteudo`; render the page component, or wrap
  a block in `<div className="hub-pagina">` as its page does); `'solta'` for anything else.
- **Focus** (`foco`): `true` (= `document.activeElement`), an element, or a selector inside `raiz`: that element gets the
  harness's copy of hub.css's `:focus-visible` ring. Only the focus shots of contract §9 use it.
- **`raiz`** (default `document.body`): the sheet and anything rendered beside it come along.
- What the DOM holds outside attributes is written into them (typed values, checked boxes, chosen options); `<script>`
  is dropped. jsdom has no layout, so the markup is the same at every width: the CSS decides (the one JS width check in
  the hub, `ImagensENota`'s `pointer: coarse`, is false in jsdom: the desktop variant shows at every width).

## 3. Running

```bash
T=/private/tmp/claude-502/-Users-felipefonseca-Dev-binary-hub/a0c92ab8-acd5-400d-8d52-ead30f579f54/scratchpad/fase3c/telas
$T/shots/tools/run.sh /Users/felipefonseca/Dev/binary-hub/.claude/worktrees/fase3c-telas-c1 c1          # the full set
$T/shots/tools/run.sh /Users/felipefonseca/Dev/binary-hub/.claude/worktrees/fase3c-telas-c1 c1 '14 '   # a quick look
```

- **Full run** (no pattern): every spec of `visual/<lane>/`; the set in `shots/<lane>/` is **replaced whole** (only the
  final set is kept). **Partial run** (a Jest `-t` pattern): only the matching tests, written to `shots/_parcial/<lane>/`;
  delete that folder before reporting.
- `base`: run on the `fase-3c/telas` worktree after both merges, with the specs in `visual/base/` (or point
  `BH_SHOTS_SPECS` at another folder of specs).
- Env: `BH_SHOTS_KEEP=1` keeps the pages and `shots.css` in `shots/_work/<lane>/` to open them in a browser (delete
  after); `BH_SHOTS_SPECS=<dir>` another spec folder; `BH_CHROME=<path>` another Chrome binary.
- Needs: Node 22 (the script puts `~/.nvm/versions/node/v22.16.0/bin` first), Google Chrome at
  `/Applications/Google Chrome.app`, the worktree's `app/node_modules` symlink, **≥ 1,5 GB free on `/`** (the script
  refuses below it, contract §0).

What one run does, in order (the script stops at the first failure and always cleans up):

1. refuses when `app/__tests__/__visual__` exists (another run, or one that died) or the disk is short;
2. copies the specs into `app/__tests__/__visual__/`;
3. builds `shots.css` from **that worktree**: Tailwind (`npx tailwindcss -c tailwind.config.js -i styles/globals.css
   --minify`), then `hub.css` and every `hub-*.css` in the order `app/(hub)/layout.tsx` imports them, then any `hub-*.css`
   not imported yet (with a warning: a lane's new stylesheet shows even before its layout line), then `shot.css`; the
   fonts are `app/public/fonts`' Comfortaa (variable) and Poly, inlined;
4. runs `BH_SHOTS_DIR=<work> npx jest --ci --runInBand __tests__/__visual__` (each `fotografar` writes
   `<work>/html/<name>-claro.html`, `-escuro.html` and `<name>.json`);
5. deletes `app/__tests__/__visual__` (also on any exit, by trap);
6. `shoot.mjs`: one headless Chrome (`--headless=new`, `--remote-debugging-pipe`: **no port**; `--lang=pt-BR` so time
   fields read 24 h; scrollbars hidden; profile under `<work>`, deleted at the end), **every http(s)/ws request blocked**;
   per page and width: device metrics at the width (mobile emulation below 768), load, wait for the fonts, grow the
   viewport to the page's height (at least 812 / 1024 / 800 px for 375 / 768 / 1280, at most 16 000 px with a warning),
   capture, re-deflate the PNG at zlib level 9 (lossless; kept only when smaller); then `index.html`;
7. moves the new set into place and deletes `<work>` (pages, CSS, profile).

Never stage anything under `app/__tests__/__visual__` (the script never leaves it; if a run was killed hard, `rm -rf
<worktree>/app/__tests__/__visual__` before `git status`). The shots stay in the scratchpad: they go to the PR body or
the canvas by the orchestrator, never into the repository (it is public).

## 4. What a shot shows, and what it does not

- **A sheet unrolled** (`'folha'`, `shot.css`): on screen `.hub-folha` is fixed and scrolls inside itself; in a shot it
  is in the page flow at the right (480 px; the whole width at ≤ 640 px, as hub.css), at least one screen tall, the veil
  over the whole page behind it, so **one image holds the whole step** with the sticky footer at its end. The page behind
  the veil is empty (the app shows the dimmed page there).
- **A page** (`'pagina'`): the hub's page column (`.hub-container`, its max width and gutters) without the header; 24 px
  (16 px ≤ 640) above the content stand in for the header's bottom padding.
- Real CSS of the worktree at that moment, real fonts, both themes from `data-tema` on `.hub` (the html background
  follows hub.css's `html:has(.hub[data-tema])`), real media queries at each width.
- Not shown: hover, animation, the scroll position inside a sheet, a focus ring other than the one `foco` draws, any
  layout a component computes in JS (jsdom has none; the hub has no such layout today).
- What the shots do not prove (the suites do): keyboard order and focus moves, `aria-*`, live regions, 44 px targets and
  the contrast pairs (each lane's CSS test, contract §5.14 / §6.7).

## 5. `index.html`

One section per state (by name): the name, the `quadro` reference and the frame, then the six shots (375 · 768 · 1280,
claro then escuro) as thumbnails linking to the full PNG. The reviewer opens it beside the canvas.

## 6. The harness's own check (smoke)

`shots/tools/smoke/smoke.visual.test.tsx` renders the as-built step 2 of the open MES (`operacao-mes-aberta`, an exit
price typed: «Se sair a 7.902,50: −10,00 pts · −US$ 100,00»), the same with the focus ring on «Registrar saída», and the
as-built «Operações do dia» as a page. Run on `fase-3c/telas` at 02e73b9:

```bash
BH_SHOTS_SPECS=$T/shots/tools/smoke $T/shots/tools/run.sh /Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_5a054860-307-1 base smoke
```

→ 2 tests passed, 6 pages, **18 shots, 1,1 MB**, `__tests__/__visual__` gone, `git status` clean, no Chrome profile
left. Checked by eye: Comfortaa and Poly load, the typed price and «10:31» (24 h) show, the sheet is unrolled at 375
(whole screen) and beside the veil at 1280, the focus ring on «Registrar saída», the bridge's cards at 375 and its grid
at 768, both themes. The smoke shots were deleted (not a final set). Re-run it after any change to the tools.

## 7. Limits and costs

About 60 KB per shot (1,1 MB for 18); a lane's set of ~60 states × 6 is roughly 20–40 MB. Each run takes the Jest time
of the specs plus about 1 s per shot. The script never touches the network, Postgres, `.env` files or `docs/csv`.

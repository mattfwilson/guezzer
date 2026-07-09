# Phase 3: App Shell & PWA Foundation - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the entire `packages/app` frontend (currently an empty stub — only `package.json`) as an installable, offline-first PWA shell: the container every later feature plugs into. This is the first UI phase — the pivot from pure `packages/core` to a real React app. Deliver against three requirements:

- **PWA-01** 🎯 — installable to the home screen on iOS and Android, with install onboarding that includes manual iOS instructions (`beforeinstallprompt` never fires on iOS Safari).
- **PWA-02** 🎯 — service worker provides offline capability with a **prompt-based** update flow (never `autoUpdate`) and a visible version stamp; the app never swaps versions mid-show.
- **PWA-03** 🎯 — personal data persists in IndexedDB (via Dexie) across relaunches, with `navigator.storage.persist()` requested.

**In scope:** the Vite + React + TS app scaffold, the navigable app-shell chrome (empty placeholder views), `vite-plugin-pwa` config (manifest + service worker, `registerType: 'prompt'`), install onboarding UX, update-prompt UX + version stamp, the Dexie DB stood up with a thin real schema, and the `navigator.storage.persist()` request — all proven to work offline after first load.

**Not in scope (later phases):** Show Mode orbit/logging/trail (Phase 4), live `latest` polling + JSON export/import (Phase 5, incl. PWA-04), Pokédex/history/stats (Phase 6), Explore constellation (Phase 7). Phase 3 renders **empty placeholder views** for Show/Explore/Dex — no feature content, no core model consumption required (a live core smoke test was offered and declined in favor of the leaner nav-skeleton scope).

**Mode:** MVP (vertical slices). Build a thin, genuinely installable/offline/navigable shell end-to-end rather than polishing any one piece before the whole loads offline.

</domain>

<decisions>
## Implementation Decisions

### Shell Scope & Navigation
- **D-01:** Phase 3 renders a **navigable nav skeleton** — persistent app chrome with a Show / Explore / Dex switcher, each view a labeled **empty placeholder** ("coming in Phase 4", etc.). The shell is real and navigable end-to-end (installable, offline, switchable); later phases fill the views in. NOT a single placeholder screen, and NOT wired to `@guezzer/core` yet (the live core smoke-test option was declined).
- **D-02:** View switching uses **hash routing** (`#/show`, `#/explore`, `#/dex`) — no routing library (per CLAUDE.md). Gives shareable/bookmarkable URLs (satisfies the "shareable via URL" PWA property), a working back button, and static-host safety (no server rewrite rules). NOT plain view-state `useState`.

### Install Onboarding UX (PWA-01)
- **D-03:** Install invitation surfaces as a **dismissible banner** ("Install Guezzer") on visits, **plus a permanent "Install" entry in the app menu** so it's always reachable after dismissal. On Android/Chrome the banner uses the captured `beforeinstallprompt` event; on iOS Safari it reveals manual instructions instead. NOT a full first-run onboarding wall, and NOT menu-only.
- **D-04:** iOS manual instructions are **illustrated** — the iOS Share glyph plus numbered steps ("Tap Share → Add to Home Screen"), shown **only to detected iOS Safari** users. The Share icon picture is the point (users can't find the button by name). NOT text-only.
- **D-05:** After dismissal, the install prompt **re-shows on the next app launch** until the app is actually installed (detect via `display-mode: standalone` / `navigator.standalone`). The permanent menu entry remains the always-available fallback.

### Update Prompt & Version Stamp (PWA-02)
- **D-06:** A waiting service-worker update surfaces as a **non-blocking, dismissible toast/banner** ("New version available — Refresh"). The update applies **only when the user taps Refresh** (`skipWaiting` + reload via `workbox-window`); ignoring it keeps the current version running indefinitely. This is the concrete mechanism behind "never swaps versions mid-show." NOT a settings-only indicator; the explicit "suppress during active show" variant was considered but that's a Phase 4 concept — the user-tap-only gate already satisfies the never-mid-show guarantee for Phase 3.
- **D-07:** A **visible version stamp** lives in the menu/about area, format `v<pkg-version> · <short-git-sha> · built <date>` (e.g. `v1.0.0 · a1b2c3d · built 2026-08-15`). Package version for humans, short git SHA to pin the exact build when a friend reports a bug, build date for quick recency read. The SHA/date are injected at build time (Vite `define`) — see Claude's Discretion.

### Data Foundation (PWA-03)
- **D-08:** Stand up the **Dexie DB at version 1 with a thin but real schema**: a meta/settings table **plus a stub `attendedShows` table keyed by the Phase-1-confirmed stable `show_id`** (10-digit integer, confirmed a permanent identifier in Phase 1). Enough to prove PWA-03 with a genuine domain write that survives relaunch; tables grow via Dexie **versioned migrations** in Phase 4+. NOT the full anticipated P4/P5/P6 schema (shapes not yet locked → rework risk), and NOT a generic meta-only table (persistence proof should hit a real entity).
- **D-09:** Request `navigator.storage.persist()` **early on first run** (after a user gesture if the platform requires one). If granted, done; if **denied, continue silently** — no scary UI. **Record the persistence status** (in the meta table) so a later phase can surface an export nudge. The prominent JSON export (Phase 5, PWA-04) is the real backstop against iOS eviction. NOT deferred-to-install, NOT a visible storage-status indicator in Phase 3.

### Claude's Discretion
- Exact `vite-plugin-pwa` / Workbox configuration wiring (precache globs — note `json` is **not** a Workbox default and must be added if the matrix artifact is ever precached in a later phase; runtime-caching rules come with Phase 5's `latest` polling, not now).
- Tailwind v4 setup (`@tailwindcss/vite`), dark-theme token/palette definition, and 44px tap-target base styles — pixel-level visual design can optionally be formalized via `/gsd-ui-phase` (this phase has a UI hint).
- PWA manifest details and app icon generation (sizes, maskable icons, theme/background color).
- Build-time git SHA + build-date injection mechanism (Vite `define` / env at build).
- Menu/about component structure and where the nav switcher physically sits (bottom tab bar vs. header) — subject to UI-SPEC if run.
- Internal module/component decomposition within `packages/app/src`, npm-workspace dev-dependency additions (React, Vite, plugin, Dexie, Tailwind), and Vitest `projects` config to add the app's `jsdom` test environment alongside core's `node` env.
- Whether to add a minimal app-level test (e.g., DB round-trip, hash-route switch) — encouraged, following the established Vitest pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 3 section: goal, success criteria, requirement IDs (PWA-01/02/03), MVP mode, "UI hint: yes".
- `.planning/REQUIREMENTS.md` — PWA-01, PWA-02, PWA-03 authoritative text (and PWA-04 for awareness — export is Phase 5, not here).
- `.planning/PROJECT.md` — "Persistence & platform" active requirements, iOS Safari eviction context, dark-theme/fat-thumb venue constraints, Constraints (core/UI separation, single-config-file, static-export deployable).

### Tech stack (heavily pre-locked — read before choosing any library)
- `CLAUDE.md` — the authoritative stack decisions and rationale for this phase:
  - Vite 8.1.3 + React 19.2.7 + TypeScript 6.0.3 (NOT TS 7 — typescript-eslint peer cap), esbuild transpile / `tsc` typecheck-only.
  - `vite-plugin-pwa` 1.3.0 wrapping Workbox 7.4.1 — Decision #2: **`registerType: 'prompt'` NOT `autoUpdate`**, precache app shell, `workbox-window` for the update-available flow, call `navigator.storage.persist()` on install/first-run.
  - Dexie 4.4.4 + dexie-react-hooks 4.4.0 (`useLiveQuery`) — Decision #3, over idb/raw IndexedDB.
  - Tailwind CSS 4.3.2 via `@tailwindcss/vite` (no PostCSS config) — dark theme, 44px targets.
  - "What NOT to Use" table: no `next-pwa`, no raw IndexedDB, no `registerType: 'autoUpdate'`, no localStorage for dex/setlist data, **no routing library** (view-state or hash routing — this phase chose hash), no Redux.
  - "Stack Patterns by Variant": iOS non-installed PWA eviction is expected behavior → double down on install prompt + export nudge; `?url` asset + runtime fetch + `json` in `globPatterns` pattern (relevant when the matrix artifact gets precached in a later phase).
  - Development Tools: npm workspaces (repo uses `package-lock.json`, NOT pnpm), Node ≥24.12 native TS, Vitest `projects` (core=`node`, app=`jsdom`; `vitest.workspace.ts` removed in Vitest 4).

### Existing workspace (Phase 3's starting point)
- `package.json` (root) — npm workspaces (`packages/*`), `"type": "module"`, existing devDeps `typescript@6.0.3` + `vitest@4.1.10`, scripts `test` / `refresh`.
- `tsconfig.base.json` — shared strict TS base (`nodenext`, `es2023`, `noEmit`); app tsconfig will need DOM lib (core deliberately excludes DOM).
- `vitest.config.ts` — existing root Vitest config to extend with the app project (`jsdom`).
- `packages/app/package.json` — the empty `@guezzer/app` stub to build out.
- `packages/core/package.json` — `@guezzer/core` (`"type": "module"`, zod dep); the app consumes it as a workspace source dependency, app→core only.

### Prior-phase patterns (conventions to follow)
- `.planning/phases/01-corpus-ingestion-schema-foundation/01-CONTEXT.md` — anti-corruption boundary, config-as-single-source-of-truth precedent.
- `.planning/phases/02-transition-matrix-model-backtest/02-CONTEXT.md` — MVP-slice discipline, established `packages/core` + Vitest fixture patterns; D-08 (matrix artifact nodes+edges) is what a later phase's precache will target.
- `data/normalized/corpus.json`, and the future `TransitionMatrix` artifact — NOT consumed in Phase 3 (nav skeleton only), but the app→core import path is established here for Phase 4.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@guezzer/core` — the pure domain module; the app imports from it (never the reverse). Phase 3 establishes the workspace import wiring but does not yet consume core APIs (empty views).
- Root `vitest.config.ts` + the Phase 1/2 Vitest + fixture pattern — extend with a `jsdom` app project rather than inventing a new test setup.
- `tsconfig.base.json` — shared strict base to extend for the app (adding DOM lib).

### Established Patterns
- **Strict core/UI separation (hard constraint):** all domain logic stays in `packages/core` (zero React/DOM/browser deps); the app is a thin consumer. Importing React/`window` from core is a build error by design.
- **Single config file for constants** (Phase 2 `packages/core/src/config.ts`) — app-side constants (e.g., install-prompt copy, version-stamp format) should follow the no-scattered-magic-numbers ethos, in an app-level config where a core value doesn't fit.
- **npm workspaces** (not pnpm — repo has `package-lock.json`); `"type": "module"` throughout.

### Integration Points
- `packages/app` is greenfield: Vite entry (`index.html` + `src/main.tsx`), the app shell, the PWA plugin, and the Dexie DB module are all new.
- The Dexie DB module (D-08) is the seam Phase 4 (tracked setlists), Phase 5 (export/import), and Phase 6 (dex derivation) all extend via versioned migrations — design the v1 schema and migration hook to be additive-friendly.
- Build-time SHA/date injection (D-07) touches the Vite config (`define`) — a small but real build-config integration point.

</code_context>

<specifics>
## Specific Ideas

- Version stamp exact shape: `v1.0.0 · a1b2c3d · built 2026-08-15` (package version · short git SHA · build date), in the menu/about area — this is both the trust signal and the owner's debugging anchor for friend bug reports.
- Install banner is the deliberate mitigation for the iOS Safari IndexedDB-eviction risk called out repeatedly in PROJECT.md — treat "get friends to actually install" as a functional requirement, not polish.
- Update prompt copy is "New version available — Refresh"; the mental model is "friends refresh between shows, never mid-show."

</specifics>

<deferred>
## Deferred Ideas

- **Suppress update toast during an active tracked show** — considered as a belt-and-suspenders on never-mid-show, but "active show" is a Phase 4 concept. The user-tap-only update gate (D-06) already guarantees no auto-swap. Revisit in Phase 4 to make the toast a no-op while a show is being tracked, if desired.
- **Live core smoke test in the shell** (load the matrix artifact, show raw `predict` output) — offered to de-risk the core→app data path early; declined in favor of the leaner nav-skeleton scope. The app→core import wiring still gets established in Phase 3, so Phase 4 integration is not blocked.
- **Persistence-status indicator in the menu** ("Storage: protected / best-effort") — deferred; Phase 3 records status silently (D-09) and a later phase can surface an export nudge from it. Naturally pairs with Phase 5's prominent JSON export (PWA-04).
- **Precaching the matrix/corpus JSON artifact for offline model use** — a Phase 4 concern (Show Mode consumes the model). When it lands, remember `json` must be added to Workbox `globPatterns` (not a default) per CLAUDE.md.

</deferred>

---

*Phase: 3-App Shell & PWA Foundation*
*Context gathered: 2026-07-08*

# Phase 3: App Shell & PWA Foundation - Research

**Researched:** 2026-07-08
**Domain:** Installable offline-first PWA shell — Vite + React + vite-plugin-pwa (Workbox), Dexie/IndexedDB, hash routing, Tailwind v4
**Confidence:** HIGH (stack pre-locked and npm-verified; wiring patterns confirmed against official vite-pwa/Tailwind docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Shell Scope & Navigation**
- **D-01:** Phase 3 renders a **navigable nav skeleton** — persistent app chrome with a Show / Explore / Dex switcher, each view a labeled **empty placeholder** ("coming in Phase 4", etc.). The shell is real and navigable end-to-end (installable, offline, switchable); later phases fill the views in. NOT a single placeholder screen, and NOT wired to `@guezzer/core` yet (the live core smoke-test option was declined).
- **D-02:** View switching uses **hash routing** (`#/show`, `#/explore`, `#/dex`) — no routing library (per CLAUDE.md). Gives shareable/bookmarkable URLs, a working back button, and static-host safety (no server rewrite rules). NOT plain view-state `useState`.

**Install Onboarding UX (PWA-01)**
- **D-03:** Install invitation surfaces as a **dismissible banner** ("Install Guezzer") on visits, **plus a permanent "Install" entry in the app menu** so it's always reachable after dismissal. On Android/Chrome the banner uses the captured `beforeinstallprompt` event; on iOS Safari it reveals manual instructions instead. NOT a full first-run onboarding wall, and NOT menu-only.
- **D-04:** iOS manual instructions are **illustrated** — the iOS Share glyph plus numbered steps ("Tap Share → Add to Home Screen"), shown **only to detected iOS Safari** users. The Share icon picture is the point. NOT text-only.
- **D-05:** After dismissal, the install prompt **re-shows on the next app launch** until the app is actually installed (detect via `display-mode: standalone` / `navigator.standalone`). The permanent menu entry remains the always-available fallback.

**Update Prompt & Version Stamp (PWA-02)**
- **D-06:** A waiting service-worker update surfaces as a **non-blocking, dismissible toast/banner** ("New version available — Refresh"). The update applies **only when the user taps Refresh** (`skipWaiting` + reload via `workbox-window`); ignoring it keeps the current version running indefinitely. NOT a settings-only indicator; the "suppress during active show" variant is a Phase 4 concept.
- **D-07:** A **visible version stamp** lives in the menu/about area, format `v<pkg-version> · <short-git-sha> · built <date>` (e.g. `v1.0.0 · a1b2c3d · built 2026-08-15`). SHA/date injected at build time (Vite `define`).

**Data Foundation (PWA-03)**
- **D-08:** Stand up the **Dexie DB at version 1 with a thin but real schema**: a meta/settings table **plus a stub `attendedShows` table keyed by the Phase-1-confirmed stable `show_id`** (10-digit integer, confirmed a permanent identifier in Phase 1). Enough to prove PWA-03 with a genuine domain write that survives relaunch; tables grow via Dexie **versioned migrations** in Phase 4+. NOT the full anticipated P4/P5/P6 schema, and NOT a generic meta-only table.
- **D-09:** Request `navigator.storage.persist()` **early on first run** (after a user gesture if the platform requires one). If granted, done; if **denied, continue silently** — no scary UI. **Record the persistence status** (in the meta table) so a later phase can surface an export nudge. NOT deferred-to-install, NOT a visible storage-status indicator in Phase 3.

### Claude's Discretion
- Exact `vite-plugin-pwa` / Workbox configuration wiring (precache globs — `json` is **not** a Workbox default and must be added if the matrix artifact is ever precached in a later phase; runtime-caching rules are a Phase 5 concern, not now).
- Tailwind v4 setup (`@tailwindcss/vite`), dark-theme token/palette definition, and 44px tap-target base styles.
- PWA manifest details and app icon generation (sizes, maskable icons, theme/background color).
- Build-time git SHA + build-date injection mechanism (Vite `define` / env at build).
- Menu/about component structure and where the nav switcher physically sits (bottom tab bar vs. header) — governed by the approved UI-SPEC.
- Internal module/component decomposition within `packages/app/src`, npm-workspace dev-dependency additions, and Vitest `projects` config to add the app's `jsdom` test environment alongside core's `node` env.
- Whether to add a minimal app-level test (DB round-trip, hash-route switch) — encouraged.

### Deferred Ideas (OUT OF SCOPE)
- **Suppress update toast during an active tracked show** — Phase 4 concept; the user-tap-only gate (D-06) already satisfies never-mid-show for Phase 3.
- **Live core smoke test in the shell** (load matrix artifact, show raw `predict` output) — declined in favor of leaner nav-skeleton scope. App→core import wiring still gets established.
- **Persistence-status indicator in the menu** — deferred; Phase 3 records status silently (D-09) for a later export nudge.
- **Precaching the matrix/corpus JSON artifact** — Phase 4 concern. When it lands, `json` must be added to Workbox `globPatterns` (not a default).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PWA-01** 🎯 | Installable to home screen on iOS and Android, with install onboarding including manual iOS instructions (`beforeinstallprompt` never fires on iOS Safari) | Manifest config + icons (Standard Stack, Code Examples §Manifest); `beforeinstallprompt` capture for Android (Code Examples §Install); iOS Safari detection + `IosInstallInstructions` (Code Examples §iOS detection); installed-state detection via `display-mode: standalone` / `navigator.standalone` (D-05 logic) |
| **PWA-02** 🎯 | Service worker offline capability, **prompt-based** update flow (never `autoUpdate`), visible version stamp, never mid-show swap | `registerType: 'prompt'` + `useRegisterSW` React hook flow → `updateServiceWorker(true)` on Refresh tap (Code Examples §Update flow); precache globs (Code Examples §VitePWA config); version stamp via Vite `define` (Code Examples §Version injection) |
| **PWA-03** 🎯 | Personal data persists in IndexedDB (Dexie) across relaunches; `navigator.storage.persist()` requested | Dexie v1 schema with `meta` + `attendedShows` keyed by `show_id` (Code Examples §Dexie); additive versioned-migration hook; `navigator.storage.persist()` early on first run, status recorded to meta (Code Examples §Persistence) |
</phase_requirements>

## Summary

Phase 3 pivots the repo from a pure-Node `packages/core` into a real React app in the currently-empty `packages/app` stub. Every library choice is **pre-locked in CLAUDE.md and already npm-verified there** — the research question is entirely *how to wire them*, not *what to pick*. The four load-bearing wiring problems are: (1) the `vite-plugin-pwa` prompt-for-update flow via the `virtual:pwa-register/react` `useRegisterSW` hook, which is the concrete mechanism behind "never swaps versions mid-show"; (2) build-time injection of `pkg version · short git SHA · build date` through Vite `define`; (3) platform-split install onboarding — `beforeinstallprompt` capture on Android vs. detected-iOS-Safari illustrated manual instructions, gated on installed-state; and (4) a Dexie v1 schema (`meta` + stub `attendedShows` keyed by the 10-digit `show_id`) plus `navigator.storage.persist()` requested early with its result recorded.

The supporting scaffolding is standard-but-precise: a bottom-tab hash router with **no library** (a `hashchange` listener feeding React state), a Tailwind v4 setup via `@tailwindcss/vite` with **no PostCSS** and a dark-only palette declared in `@theme`, an app `tsconfig` that adds the DOM lib the core deliberately excludes, and an extension of the existing Vitest `projects` config to add a `jsdom` app project alongside the `node` core project. The critical determinant of a clean phase is respecting the two hard architectural invariants already enforced in this repo: **app→core imports only** (core has no React/DOM and must stay that way), and **all constants in config, not scattered**.

**Primary recommendation:** Scaffold `packages/app` as a Vite React-TS app; set `VitePWA({ registerType: 'prompt' })` and drive the update UX from `useRegisterSW`; inject the version string via Vite `define` (git SHA from `execSync('git rev-parse --short HEAD')` at config time, guarded for missing-git); model the Dexie DB as `db.version(1).stores({ meta: '&key', attendedShows: '&show_id, showDate' })` behind a thin `db.ts`; and build a `hashchange`-driven bottom-tab router. Treat "get friends to actually install" as a functional requirement, not polish — the install banner is the mitigation for iOS IndexedDB eviction.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Service worker / precache / offline | CDN/Static (Workbox-generated SW) | Browser (SW registration in app) | vite-plugin-pwa emits the SW and precache manifest at build; the app only registers it and reacts to lifecycle events. No backend exists. |
| Update prompt (needRefresh → skipWaiting → reload) | Browser (client) | — | Entirely a client-side SW-lifecycle + React-state concern; `useRegisterSW` + `workbox-window` live in the browser. |
| Install onboarding (banner, iOS instructions) | Browser (client) | — | `beforeinstallprompt`, `display-mode` media query, and `navigator.standalone` are all browser-only APIs. No server involvement. |
| Manifest + icons | CDN/Static | Browser | Static assets generated at build, consumed by the browser's install machinery. |
| Version stamp (SHA/date/version) | CDN/Static (build-time `define`) | Browser (renders the injected constant) | Values are frozen into the bundle at build; the browser only displays them. |
| Persistent personal data (attendedShows, meta) | Database/Storage (IndexedDB via Dexie) | Browser | Client-side IndexedDB is the only datastore; no backend. `navigator.storage.persist()` governs eviction resistance. |
| Hash routing / view switching | Browser (client) | — | `location.hash` + `hashchange`; static-host-safe by design (no server rewrites). |
| Nav skeleton / placeholder views | Browser (client) | — | Pure presentational React; no data tier touched in Phase 3. |

**Cross-tier sanity note for the planner:** every Phase 3 capability lives in the Browser or Static/Build tiers. There is **no API/backend tier** in this project (hard constraint). Any task that implies a server round-trip is misassigned.

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md` — treat with the same authority as locked decisions:

1. **Strict core/UI separation (hard).** All domain logic lives in `packages/core` with zero React/DOM/browser deps; the app imports from core, **never** the reverse. Importing React or `window` from core is a build error by design (core `tsconfig` sets `lib: ["ES2023"]`, no DOM). Phase 3 establishes the app→core import path but does **not** consume core APIs (empty views).
2. **Single config file for constants.** No scattered magic numbers. App-side constants (install-prompt copy, version-stamp format, DB name, persist-timing) belong in an app-level config module, mirroring `packages/core/src/config.ts`.
3. **Static-export deployable.** Pure static output (`packages/app/dist`) to Vercel/Netlify/GitHub Pages — set Vite `base` if using GitHub Pages project pages. No server, no rewrite rules (this is why hash routing).
4. **`registerType: 'prompt'` — NOT `autoUpdate`.** A SW silently swapping the app mid-show is the exact failure mode this project exists to avoid.
5. **No routing library** (react-router / TanStack Router). Hash routing chosen (D-02).
6. **No Redux / heavy state management.** Dexie `useLiveQuery` + component state covers everything. Add zustand only if prop-drilling actually hurts (not this phase).
7. **Dexie over idb over raw IndexedDB.** Raw IndexedDB is forbidden.
8. **No localStorage for dex/setlist data** (5 MB cap, synchronous, worse eviction). IndexedDB via Dexie only.
9. **TypeScript 6.0.3 — NOT 7.0.2.** typescript-eslint 8.63 peer range caps at `<6.1.0`.
10. **npm workspaces — NOT pnpm** (repo has `package-lock.json`). `"type": "module"` throughout.
11. **Node ≥24.12 native TS** for CLI execution (core). Erasable-only syntax enforced in core (`erasableSyntaxOnly`); no `enum`/`namespace`.
12. **Vitest `projects`** (core=`node`, app=`jsdom`); `vitest.workspace.ts` was removed in Vitest 4 — do not reintroduce it.
13. **Tailwind v4 via `@tailwindcss/vite`** — no PostCSS config.
14. **Call `navigator.storage.persist()` on install/first-run.**
15. **No `next-pwa`** (abandoned); use vite-plugin-pwa.
16. **Import `react-force-graph-2d` specifically** (not the umbrella package) — *forward note, Phase 7 only, not this phase.*

## Standard Stack

> All versions are **pre-locked in CLAUDE.md** and were npm-verified there on 2026-07-08. This phase re-confirms existence via `npm view` (2026-07-08) and adds the few packages CLAUDE.md's table did not enumerate (React runtime, Vite React plugin, jsdom test deps, `lucide-react` from the approved UI-SPEC).

### Core (from CLAUDE.md — locked)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.1.3 | Build tool + static output | Locked. First-class PWA plugin, fast dev loop. |
| react / react-dom | 19.2.7 | UI framework | Locked (constraint-confirmed). |
| typescript | 6.0.3 | Typecheck only (esbuild transpiles) | Locked — NOT 7.x (typescript-eslint peer cap). Already a root devDep. |
| vite-plugin-pwa | 1.3.0 | Manifest + SW + precache; `virtual:pwa-register/react` | Locked. Wraps Workbox 7.4.1. `registerType: 'prompt'`. `[VERIFIED: npm registry 2026-07-08]` |
| workbox-window | 7.4.1 | SW update UX (comes with vite-plugin-pwa) | Locked. Powers the update-available flow. |
| dexie | 4.4.4 | IndexedDB wrapper (schema versioning, typed tables, liveQuery) | Locked. `[VERIFIED: npm registry 2026-07-08]` |
| dexie-react-hooks | 4.4.0 | `useLiveQuery` reactive reads | Locked. Peer: dexie ≥4.2 <5, react ≥16. |
| tailwindcss | 4.3.2 | Styling (dark theme, 44px targets) | Locked. Via `@tailwindcss/vite`, no PostCSS. |
| @tailwindcss/vite | 4.3.2 | First-party Tailwind v4 Vite plugin | Locked. `[VERIFIED: npm registry 2026-07-08]` |

### Supporting (new to this phase — provenance noted)
| Library | Version | Purpose | Provenance |
|---------|---------|---------|-----------|
| @vitejs/plugin-react | 6.0.3 | React Fast Refresh + JSX transform for Vite | `[CITED: vite.dev/plugins]` — standard Vite React plugin; `[VERIFIED: npm registry 2026-07-08]` |
| lucide-react | 1.23.0 | Chrome icons (nav-tab glyphs, menu, close, external-link) | `[CITED: 03-UI-SPEC.md Design System]` — mandated by approved UI-SPEC; `[VERIFIED: npm registry 2026-07-08]` |
| @types/react, @types/react-dom | (match React 19) | React type defs | `[CITED: react.dev]`; `[VERIFIED: npm registry]` |
| jsdom | (Vitest peer) | DOM environment for app tests | `[CITED: vitest.dev/guide/environment]`; `[VERIFIED: npm registry]` |
| @testing-library/react | 16.3.2 | Component render/query in jsdom tests | `[CITED: testing-library.com]`; `[VERIFIED: npm registry 2026-07-08]` |
| @testing-library/jest-dom | 6.9.1 | DOM matchers (`toBeInTheDocument`, etc.) for Vitest | `[CITED: testing-library.com]`; `[VERIFIED: npm registry 2026-07-08]` |
| @vite-pwa/assets-generator | latest | (Optional) generate maskable/apple-touch icons from one source | `[CITED: vite-pwa-org.netlify.app/assets-generator]` — optional convenience; hand-authored icons are a valid alternative |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom (test env) | happy-dom | Faster, lighter, but less complete API coverage. jsdom is the safer default when testing SW-registration shims and storage APIs. Either works with Vitest 4. |
| @vite-pwa/assets-generator | Hand-authored icon set | Generator saves time and produces maskable + apple-touch variants; hand-authoring is fine for ~4 icon files if you already have a source PNG. |
| `useRegisterSW` React hook | `registerSW` from `virtual:pwa-register` in `main.tsx` + custom event bridge | The React hook is the idiomatic path and already returns `needRefresh`/`offlineReady` as React state. Only drop to the vanilla API if you need registration outside React. |

**Installation (new deps for this phase):**
```bash
# packages/app runtime
npm install -w @guezzer/app react@19.2.7 react-dom@19.2.7 dexie@4.4.4 dexie-react-hooks@4.4.0 lucide-react

# packages/app dev/build
npm install -D -w @guezzer/app vite@8.1.3 @vitejs/plugin-react vite-plugin-pwa@1.3.0 tailwindcss@4.3.2 @tailwindcss/vite@4.3.2 @types/react @types/react-dom

# root dev (shared test env for the app's jsdom project)
npm install -D jsdom @testing-library/react @testing-library/jest-dom
```
> `@guezzer/app` should also declare `@guezzer/core` as a workspace dependency (`"@guezzer/core": "*"`) to establish (but not yet use) the app→core import path.

**Version verification (this session, `npm view`, 2026-07-08):**
vite-plugin-pwa `1.3.0`, @tailwindcss/vite `4.3.2`, dexie `4.4.4`, @vitejs/plugin-react `6.0.3`, lucide-react `1.23.0`, @testing-library/react `16.3.2`, @testing-library/jest-dom `6.9.1` — all resolve on the npm registry. Pin `vite`, `react`, `typescript`, `vite-plugin-pwa`, `dexie`, `@tailwindcss/vite` to the exact CLAUDE.md versions; a caret range is acceptable for the icon/test-only deps.

## Package Legitimacy Audit

> slopcheck was available and run this session (`slopcheck scan --pkg npm <pkg>` per package). 17 OK, 1 SUS (false positive — see note).

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| react | npm | 12+ yrs | github.com/facebook/react | OK | Approved |
| react-dom | npm | 12+ yrs | github.com/facebook/react | OK | Approved |
| vite | npm | 5+ yrs | github.com/vitejs/vite | OK | Approved |
| @vitejs/plugin-react | npm | est. | github.com/vitejs/vite-plugin-react | OK | Approved |
| typescript | npm | 12+ yrs | github.com/microsoft/TypeScript | OK | Approved (already a root devDep) |
| vite-plugin-pwa | npm | since 2020-08 | github.com/vite-pwa/vite-plugin-pwa | OK | Approved |
| workbox-window | npm | est. | github.com/GoogleChrome/workbox | OK | Approved |
| dexie | npm | since 2014-08 | github.com/dexie/Dexie.js | OK | Approved |
| dexie-react-hooks | npm | est. | github.com/dexie/Dexie.js | OK | Approved |
| tailwindcss | npm | est. | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @tailwindcss/vite | npm | since 2024-02 | github.com/tailwindlabs/tailwindcss | OK | Approved |
| lucide-react | npm | since 2020-10 | github.com/lucide-icons/lucide | OK | Approved |
| **vitest** | npm | est. | github.com/vitest-dev/vitest | **SUS** | **Approved — false positive** |
| jsdom | npm | 10+ yrs | github.com/jsdom/jsdom | OK | Approved |
| @testing-library/react | npm | est. | github.com/testing-library/react-testing-library | OK | Approved |
| @testing-library/jest-dom | npm | est. | github.com/testing-library/jest-dom | OK | Approved |
| @types/react | npm | est. | DefinitelyTyped | OK | Approved |
| @types/react-dom | npm | est. | DefinitelyTyped | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `vitest`. **This is a confirmed false positive** — slopcheck's only flag is `TYPOSQUAT_RISK: "Suspiciously close to 'vite'. Could be a typosquat."` Vitest and Vite are sibling projects from the same maintainers; `vitest` is the legitimate official test runner and is **already a root devDependency at 4.1.10** (verified in `package.json` and CLAUDE.md). No checkpoint needed. The heuristic simply cannot distinguish an intentional sibling-package name from a typosquat.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── BUILD TIME (Vite) ───────────────────────┐
                    │                                                                  │
 git rev-parse ────►│  vite.config.ts:                                                 │
 package.json ─────►│    define: { __APP_VERSION__, __GIT_SHA__, __BUILD_DATE__ }      │
 source PNG ───────►│    @vitejs/plugin-react → JSX transform                          │
                    │    @tailwindcss/vite    → CSS utilities                          │
                    │    VitePWA({registerType:'prompt'}) → manifest + sw.js + precache│
                    │                                                                  │
                    └───────────────────────────────┬──────────────────────────────────┘
                                                     │  emits static bundle → dist/
                                                     ▼
    ┌──────────────────────────── BROWSER (runtime, offline-capable) ────────────────────────────┐
    │                                                                                             │
    │  index.html → main.tsx ──► <App/>                                                           │
    │                              │                                                              │
    │      ┌───────────────────────┼───────────────────────────────┬──────────────────────┐      │
    │      ▼                       ▼                               ▼                      ▼      │
    │  useRegisterSW()        useHashRoute()               InstallController        db.ts (Dexie) │
    │  (virtual:pwa-          location.hash +              beforeinstallprompt      version(1)     │
    │   register/react)       'hashchange'                 capture (Android)        .stores({      │
    │      │                       │                       display-mode/            meta,          │
    │  needRefresh?                │                       navigator.standalone     attendedShows})│
    │      │                  #/show #/explore #/dex        iOS Safari sniff              │         │
    │      ▼                       ▼                               ▼                      ▼         │
    │  <UpdateToast>          <BottomTabBar> + view          <InstallBanner> /        IndexedDB     │
    │  Refresh → update-      switch → <PlaceholderView>     <IosInstall-           (persisted via  │
    │  ServiceWorker(true)                                    Instructions>         storage.persist)│
    │      │                                                                             ▲         │
    │      ▼                                                   first run ────────────────┘         │
    │  skipWaiting + reload                                    navigator.storage.persist()         │
    │                                                          → record status in meta table       │
    │                                                                                             │
    │  ServiceWorker (Workbox): precache app shell (JS/CSS/HTML/icons) → serves offline on reload  │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

  Trace the primary use case (install → offline → update):
  first visit → SW precaches shell → InstallController shows banner (Android prompt / iOS steps)
  → user installs → relaunch loads from precache offline → later: new deploy → SW waits →
  needRefresh=true → UpdateToast → user taps Refresh → updateServiceWorker(true) → reload on new version.
```

### Recommended Project Structure
```
packages/app/
├── index.html                 # Vite entry; <link> to src/main.tsx, dark theme_color meta
├── package.json               # @guezzer/app; deps: react, dexie, lucide-react, @guezzer/core (unused yet)
├── tsconfig.json              # extends base, ADDS DOM lib + jsx + bundler resolution (see Pitfall 6)
├── vite.config.ts             # plugins: react, tailwindcss, VitePWA; define: version constants
├── public/
│   ├── icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png  # manifest icons
│   └── (favicon)
└── src/
    ├── main.tsx               # ReactDOM.createRoot; mounts <App/>
    ├── App.tsx                # AppShell: header + <main> route outlet + BottomTabBar; hosts controllers
    ├── vite-env.d.ts          # /// refs for vite/client + vite-plugin-pwa/react; declares __APP_VERSION__ etc.
    ├── styles.css             # @import "tailwindcss"; @theme { dark palette }; safe-area base
    ├── config.ts              # app constants: DB_NAME, copy strings, version-stamp format, persist timing
    ├── db/
    │   └── db.ts              # Dexie subclass, version(1).stores, typed tables, meta helpers, persist()
    ├── pwa/
    │   ├── useRegisterSW.ts   # thin wrapper re-exporting hook + interval config (optional)
    │   └── install/
    │       ├── useInstallState.ts   # beforeinstallprompt capture, installed detection, iOS sniff
    │       └── platform.ts          # isIosSafari(), isStandalone()
    ├── routing/
    │   └── useHashRoute.ts    # hashchange → active route; normalizes unknown → #/show
    └── components/
        ├── AppShell.tsx, BottomTabBar.tsx, PlaceholderView.tsx, AppMenu.tsx
        ├── InstallBanner.tsx, IosInstallInstructions.tsx, IosShareGlyph.tsx
        └── UpdateToast.tsx
```

### Pattern 1: Prompt-for-update via `useRegisterSW` (D-06, PWA-02)
**What:** `registerType: 'prompt'` means the new SW installs but **waits**; `useRegisterSW` exposes `needRefresh`; calling `updateServiceWorker(true)` posts `SKIP_WAITING` and reloads. This is the entire "never mid-show" guarantee — nothing swaps until the user taps Refresh.
**When to use:** The `<UpdateToast>` component. Mount the hook once (in `App` or a dedicated provider).
**Example:** see Code Examples §Update flow.

### Pattern 2: Library-free hash routing (D-02)
**What:** Read `location.hash`, subscribe to `hashchange`, map to a `Route` union, render the matching placeholder view. Unknown/empty hash → `#/show`. `useSyncExternalStore` is the cleanest React 19 primitive for this (no stale-closure bugs, SSR-safe though SSR is irrelevant here).
**When to use:** `useHashRoute()` hook consumed by `App` and `BottomTabBar`.
**Example:** see Code Examples §Hash routing.

### Pattern 3: Platform-split install onboarding (D-03/D-04/D-05, PWA-01)
**What:** Two mutually-exclusive paths gated on installed-state:
- **Android/Chromium:** capture `beforeinstallprompt` (call `e.preventDefault()`, stash the event); the banner's Install button calls `deferredPrompt.prompt()`.
- **iOS Safari:** `beforeinstallprompt` **never fires**; detect iOS Safari and show `<IosInstallInstructions>` (illustrated Share glyph + steps).
- **Installed:** if `display-mode: standalone` matches or `navigator.standalone === true`, render nothing.
- **Re-show logic (D-05):** the banner shows on every launch until installed; "Not now" dismisses **for this session only** (component state), not persisted. The permanent menu entry is the always-on fallback.
**Example:** see Code Examples §Install detection.

### Pattern 4: Dexie v1 with additive-migration-ready schema (D-08, PWA-03)
**What:** A `Dexie` subclass declaring `version(1).stores({ meta: '&key', attendedShows: '&show_id, showDate' })`. `&` = unique inbound primary key. `meta` is a key/value settings table; `attendedShows` is the real domain table keyed by the stable 10-digit `show_id`. Phase 4+ adds tables/indexes via `version(2).stores({...})` — **only specify changed tables in later versions; unchanged tables carry forward automatically.**
**When to use:** `db/db.ts`, imported wherever persistence is proven.
**Example:** see Code Examples §Dexie schema.

### Pattern 5: Build-time version injection via Vite `define` (D-07)
**What:** In `vite.config.ts`, read `package.json` version, run `git rev-parse --short HEAD` via `execSync` (guarded), stamp `new Date().toISOString().slice(0,10)`, and expose all three as `define` globals. Declare the globals' types in `vite-env.d.ts`. No runtime dependency — the values are literal-substituted into the bundle at build.
**Example:** see Code Examples §Version injection.

### Anti-Patterns to Avoid
- **`registerType: 'autoUpdate'`** — forbidden (CLAUDE.md #4). Auto-swaps the app; catastrophic mid-show.
- **Persisting the "Not now" dismissal to survive relaunch** — contradicts D-05 (must re-show next launch until installed). Dismissal is session-only state.
- **Reading git SHA at *runtime*** — there is no runtime git; SHA must be a build-time `define` constant.
- **Putting the full P4/P5/P6 schema in v1** — D-08 forbids it (shapes unlocked → rework risk). Thin-but-real only.
- **Scary UI on `storage.persist()` denial** — D-09: denial is silent; only record status.
- **A routing library or path-based routes** — CLAUDE.md #5; path routing also breaks on static hosts without rewrites.
- **Importing anything from `packages/app` into `packages/core`** — reverse dependency; breaks the hard core-purity invariant.
- **`enum`/`namespace` in shared code** — core enforces `erasableSyntaxOnly`; keep app types as string-literal unions for consistency (Phase 2 convention).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker + precache manifest | Hand-written `sw.js` + manual cache versioning | vite-plugin-pwa (Workbox) | Precache manifest generation, revision hashing, cache cleanup, and the waiting-worker lifecycle are all handled. Hand-rolling gets cache-invalidation subtly wrong. |
| Update-available lifecycle | Manual `registration.waiting` + `postMessage('SKIP_WAITING')` + `controllerchange` reload | `useRegisterSW` (`virtual:pwa-register/react`) | The hook already wires needRefresh state, skipWaiting, and the reload; workbox-window handles the controllerchange edge cases (double-reload guard). |
| IndexedDB access | Raw IndexedDB API | Dexie | Event-based verbose API, transaction footguns, no schema versioning. Forbidden by CLAUDE.md. |
| Reactive DB reads | Manual query-on-mount + re-fetch wiring | `useLiveQuery` (dexie-react-hooks) | IndexedDB reads become reactive React state automatically; the trail/dex (later phases) update with zero hand-rolled sync. |
| CSS reset / utility system | Hand-written CSS | Tailwind v4 via `@tailwindcss/vite` | Dark theme, 44px targets, safe-area insets are utility-class territory; no PostCSS config needed. |
| iOS Share icon | lucide `Share`/`Share2` | Dedicated `IosShareGlyph` inline SVG | UI-SPEC D-04: users identify the button by its exact Apple shape, not its name; lucide's generic glyph fails the recognition test. |
| Version-string plumbing | A `version.json` fetched at runtime | Vite `define` constants | Build-time literal substitution — no fetch, works offline, no extra request. |

**Key insight:** In the PWA domain, the SW lifecycle and cache invalidation are where hand-rolled solutions silently break — precisely the "app breaks at the venue with no signal" failure this project cannot tolerate. vite-plugin-pwa + Workbox is battle-tested exactly here.

## Common Pitfalls

### Pitfall 1: SW/PWA is invisible in `vite dev`
**What goes wrong:** The manifest and service worker aren't generated in dev by default, so "it doesn't install / no offline" looks like a bug during development.
**Why it happens:** vite-plugin-pwa only emits the SW on `vite build` unless `devOptions.enabled: true` is set.
**How to avoid:** Set `devOptions: { enabled: true }` for local testing, **but** validate the real offline/install behavior against `vite build` + `vite preview` (or a static serve) — that's the production code path. The Nyquist validation MUST run against a built+previewed bundle, not the dev server.
**Warning signs:** Install prompt never appears; DevTools → Application → Service Workers empty in dev.

### Pitfall 2: `beforeinstallprompt` assumptions on iOS
**What goes wrong:** Waiting for `beforeinstallprompt` on iOS produces a banner that never shows; iOS users get no install path.
**Why it happens:** iOS Safari does not implement `beforeinstallprompt` (and never has). It's Chromium-only.
**How to avoid:** Branch on platform: capture the event for Android; **feature-independent** iOS Safari detection drives the manual-instructions path (D-04). Do not gate iOS instructions on the event.
**Warning signs:** iOS testers report "no way to install."

### Pitfall 3: iOS Safari detection is genuinely fiddly (and getting fiddlier)
**What goes wrong:** UA sniffing misfires — iPadOS reports a desktop-Safari UA; in-app browsers (Instagram/Facebook webview) can't "Add to Home Screen" at all; Chrome/Firefox on iOS are WebKit but not Safari.
**Why it happens:** Apple's UA strings and the WebKit-everywhere-on-iOS rule make clean detection hard.
**How to avoid:** Detect "iOS-family WebKit that supports Add-to-Home-Screen" pragmatically: check for iOS/iPadOS (`/iP(hone|ad|od)/` OR (`Macintosh` + `maxTouchPoints > 1` for iPadOS)) AND not already standalone. Provide the "can't auto-install here — add from your browser menu" fallback copy (UI-SPEC) for anything ambiguous. Treat this as best-effort; the permanent menu Install entry is the safety net. **Flag for a real-device spike** (STATE.md already notes an iOS lifecycle spike for Phase 4 — piggyback install detection onto it).
**Warning signs:** Instructions show on Android, or don't show on a real iPhone.

### Pitfall 4: `navigator.storage.persist()` returns false even when data survives
**What goes wrong:** Treating `persist() === false` as "persistence failed" and showing an error, or blocking.
**Why it happens:** On iOS Safari, `persist()` frequently resolves `false` (best-effort bucket) yet data still survives normal use; the guarantee is about eviction-under-pressure, not basic persistence. Some browsers only grant it after engagement/installation.
**How to avoid:** D-09 — request early, continue silently on denial, **record** the boolean in `meta` for a later export nudge. Never surface it as an error. The prominent JSON export (Phase 5) is the real eviction backstop.
**Warning signs:** A "storage not protected" error users can't act on.

### Pitfall 5: iOS discards non-installed PWA / tab state aggressively
**What goes wrong:** Data or in-memory state "disappears" after backgrounding on iOS.
**Why it happens:** Expected iOS behavior for non-installed PWAs (documented in CLAUDE.md "Stack Patterns by Variant"). This is exactly why "get them to install" is a functional requirement.
**How to avoid:** Phase 3 must *prove write-through survives relaunch* (that's the PWA-03 gate); don't rely on in-memory state for anything durable. Double down on the install prompt + (Phase 5) export nudge. Full mid-show restore is a Phase 4 concern (SHOW-11), but the durable-write foundation is laid here.
**Warning signs:** attendedShows row missing after force-quit + relaunch on a non-installed iOS PWA (if installed, it should survive — validate installed).

### Pitfall 6: App tsconfig inherits `nodenext` + no-DOM from the base
**What goes wrong:** `tsc` errors on JSX, on `document`/`window`, or on bundler-style imports because the app extends `tsconfig.base.json` (which is `module: nodenext`, and the sibling core sets `lib: ES2023` with no DOM).
**Why it happens:** The base is tuned for Node-executed core. The app is Vite-bundled and browser-targeted — different resolution and libs.
**How to avoid:** App `tsconfig.json` extends base but **overrides**: `"lib": ["ES2023", "DOM", "DOM.Iterable"]`, `"jsx": "react-jsx"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"types": ["vite/client", "vite-plugin-pwa/react"]`, `"allowImportingTsExtensions": true`, `"noEmit": true`. Do **not** add DOM to the base (would pollute core's purity guarantee). Keep `erasableSyntaxOnly` out of the app config (JSX/bundler is fine; the constraint is core-specific).
**Warning signs:** Red squiggles on JSX or `navigator.storage`; "Cannot find module 'virtual:pwa-register/react'".

### Pitfall 7: `virtual:pwa-register/react` types not found
**What goes wrong:** TS can't resolve the virtual module import.
**Why it happens:** The virtual module's types ship under `vite-plugin-pwa/react` and must be referenced.
**How to avoid:** Add `/// <reference types="vite-plugin-pwa/react" />` (and `vite/client`) to `src/vite-env.d.ts`, or list them in `tsconfig` `types`.
**Warning signs:** `Cannot find module 'virtual:pwa-register/react' or its type declarations`.

### Pitfall 8: Vitest project glob fails / picks up the wrong environment
**What goes wrong:** Widening `projects` to `packages/*` when a package has no tests fails resolution (the existing `vitest.config.ts` comment already warns about this); or app component tests run under `node` and blow up on `document`.
**Why it happens:** Vitest resolves each project; an env mismatch or a testless project errors.
**How to avoid:** Add an **explicit** app project object (not a glob) with `environment: 'jsdom'`, `root: 'packages/app'`, `include: ['test/**/*.test.{ts,tsx}']` (or `src` co-located), a `setupFiles` entry for `@testing-library/jest-dom`, and the `@vitejs/plugin-react` plugin so `.tsx` transforms. Keep the core project as-is (`node`).
**Warning signs:** `document is not defined` in an app test; "No test files found" project error.

### Pitfall 9: White flash on launch / wrong splash color
**What goes wrong:** Install→launch shows a white flash before the dark app paints.
**Why it happens:** Manifest `background_color`/`theme_color` not set to the dominant dark surface.
**How to avoid:** UI-SPEC — `theme_color` and `background_color` both `#0C0C10`. Also set the `<meta name="theme-color" content="#0C0C10">` in `index.html` and `apple-mobile-web-app-status-bar-style`.
**Warning signs:** Bright flash on cold start of the installed app.

## Code Examples

> These are the load-bearing wiring patterns the planner will reference. Sourced from official vite-pwa / Tailwind / Dexie docs, adapted to this repo's constraints. Config values (copy strings, DB name, intervals) belong in `src/config.ts` per CLAUDE.md, not inlined as shown for brevity.

### VitePWA config + version injection (vite.config.ts) — D-06, D-07
```typescript
// Source: vite-pwa-org.netlify.app/guide + /guide/prompt-for-update + WebSearch (git-sha-via-define pattern)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
let gitSha = 'unknown'
try { gitSha = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* no git at build */ }
const buildDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

export default defineConfig({
  // base: '/guezzer/',  // ONLY if deploying to a GitHub Pages project page
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',              // CLAUDE.md #4 — NEVER 'autoUpdate'
      // devOptions: { enabled: true },     // enable to test SW in `vite dev`; validate against `vite build` + preview
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // NOTE: 'json' is NOT a Workbox default — add it in a LATER phase when the matrix artifact is precached.
      },
      manifest: {
        name: 'Guezzer',
        short_name: 'Guezzer',
        description: 'Predict the next King Gizzard song, live.',
        theme_color: '#0C0C10',            // UI-SPEC — no white flash
        background_color: '#0C0C10',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
```
```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
declare const __APP_VERSION__: string
declare const __GIT_SHA__: string
declare const __BUILD_DATE__: string
```
Version stamp render (Label size, `tabular-nums` on the SHA): `v${__APP_VERSION__} · ${__GIT_SHA__} · built ${__BUILD_DATE__}`.

### Update flow — `useRegisterSW` (UpdateToast) — D-06
```tsx
// Source: vite-pwa-org.netlify.app/frameworks/react.html + /guide/periodic-sw-updates.html
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000 // hourly; NOT tied to show state in Phase 3

export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // periodic check so a long-open session eventually notices a new deploy
      r && setInterval(() => { if (navigator.onLine) r.update() }, UPDATE_CHECK_MS)
    },
    onRegisterError(err) { console.error('SW registration failed', err) },
  })

  if (!needRefresh) return null
  return (
    <div role="status" /* non-blocking toast, bottom, above tab bar */>
      <span>New version available</span>
      {/* Refresh: skipWaiting + reload — the ONLY thing that swaps versions (D-06) */}
      <button onClick={() => updateServiceWorker(true)}>Refresh</button>
      {/* Later: dismiss only; keeps current version running indefinitely */}
      <button onClick={() => setNeedRefresh(false)}>Later</button>
    </div>
  )
}
```

### Hash routing (no library) — D-02
```typescript
// Source: React 19 useSyncExternalStore pattern (react.dev) + location.hash
import { useSyncExternalStore } from 'react'

export const ROUTES = ['show', 'explore', 'dex'] as const
export type Route = (typeof ROUTES)[number]

function currentRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(h) ? h : 'show' // unknown/empty → default #/show
}
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute, () => 'show')
}
export function navigate(r: Route) { location.hash = `#/${r}` }
```

### Install detection + Android prompt capture — D-03/D-04/D-05
```typescript
// Source: MDN beforeinstallprompt / display-mode; iOS detection is best-effort (Pitfall 3)
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
}
export function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iOS = /iP(hone|ad|od)/.test(ua)
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) // iPadOS reports desktop UA
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) // exclude iOS Chrome/FF/Edge
  return iOS && webkit && !isStandalone()
}
```
```tsx
// Android/Chromium capture — stash the event, fire it on the Install button
import { useEffect, useRef, useState } from 'react'
export function useAndroidInstall() {
  const deferred = useRef<any>(null)
  const [canInstall, setCanInstall] = useState(false)
  useEffect(() => {
    const onBIP = (e: Event) => { e.preventDefault(); deferred.current = e; setCanInstall(true) }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])
  const promptInstall = async () => {
    if (!deferred.current) return
    deferred.current.prompt()
    await deferred.current.userChoice
    deferred.current = null; setCanInstall(false)
  }
  return { canInstall, promptInstall }
}
// Banner visibility (D-05): show when !isStandalone(); "Not now" = session-only useState, NOT persisted → re-shows next launch.
```

### Dexie v1 schema + typed tables — D-08, PWA-03
```typescript
// Source: dexie.org/docs/Tutorial/React + Version.stores() additive-migration docs
import Dexie, { type Table } from 'dexie'

export interface MetaRow { key: string; value: unknown }
export interface AttendedShow {
  show_id: number      // stable 10-digit integer (Phase-1-confirmed permanent id)
  showDate: string     // ISO date, indexed for later date queries
  // thin-but-real: grow via version(2+) in Phase 4, do NOT add P4/P5 fields now
}

export class GuezzerDB extends Dexie {
  meta!: Table<MetaRow, string>
  attendedShows!: Table<AttendedShow, number>
  constructor() {
    super('guezzer')                       // DB name → src/config.ts
    this.version(1).stores({
      meta: '&key',                        // unique inbound primary key (key/value settings)
      attendedShows: '&show_id, showDate', // PK = show_id; secondary index on showDate
    })
    // Phase 4+: this.version(2).stores({ trackedShows: '&show_id, ...', ... })
    //           — ONLY declare changed/new tables; unchanged tables carry forward.
  }
}
export const db = new GuezzerDB()

export async function setMeta(key: string, value: unknown) { await db.meta.put({ key, value }) }
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}
```

### Persistence request + status recording — D-09
```typescript
// Source: MDN StorageManager.persist(); D-09 (silent-on-denial, record status)
import { setMeta } from './db/db'

export async function requestPersistenceOnce(): Promise<void> {
  if (!navigator.storage?.persist) { await setMeta('persistStatus', 'unsupported'); return }
  // Idempotent: don't re-prompt if already recorded/persisted this install.
  if (await navigator.storage.persisted?.()) { await setMeta('persistStatus', 'persisted'); return }
  const granted = await navigator.storage.persist() // may resolve false on iOS — NOT an error (D-09)
  await setMeta('persistStatus', granted ? 'persisted' : 'best-effort')
  // No UI on denial. A later phase reads persistStatus to surface an export nudge.
}
// Call early on first run. If a platform requires a user gesture, invoke from the first
// meaningful interaction (e.g., dismissing the install banner or first tab tap).
```

### Tailwind v4 dark palette (styles.css) — dark-only, no PostCSS
```css
/* Source: tailwindcss.com/docs/installation/using-vite + /docs/theme (@theme) */
@import "tailwindcss";

/* Dark-only palette (UI-SPEC): no light theme, no toggle in Phase 3.
   Declaring in @theme generates bg-surface / text-primary / etc. utilities. */
@theme {
  --color-surface:      #0C0C10; /* dominant 60% — app bg */
  --color-elevated:     #17171F; /* secondary 30% — tab bar, sheets, banners, toasts */
  --color-accent:       #F2C14E; /* accent 10% — Install / Refresh / focus ring ONLY */
  --color-destructive:  #EF4444; /* declared for downstream; unused Phase 3 */
  --color-text-primary: #F5F5F7;
  --color-text-muted:   #A1A1AA;
  --color-hairline:     #2A2A34;
}
/* 44px tap floor via min-h-11 min-w-11 utilities + padding; safe-area insets via env(). */
```

### App Vitest project (extend root vitest.config.ts) — Pitfall 8
```typescript
// Source: vitest.dev/guide/projects + existing repo vitest.config.ts
import react from '@vitejs/plugin-react'
// ...inside test.projects, ADD alongside the existing @guezzer/core project:
{
  plugins: [react()],
  test: {
    name: '@guezzer/app',
    root: 'packages/app',
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'], // import '@testing-library/jest-dom'
  },
}
// A minimal app test is encouraged (D-08/Discretion): a Dexie round-trip (put → relaunch-sim get)
// with fake-indexeddb, and/or a hash-route switch assertion.
```
> Note: jsdom does not implement IndexedDB. For the DB round-trip test, add `fake-indexeddb` (`import 'fake-indexeddb/auto'` in the setup file) — verify/pin it if the planner includes a DB unit test. `[ASSUMED: fake-indexeddb needed for jsdom IndexedDB tests — standard practice, verify at plan time]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vitest.workspace.ts` file | `test.projects` in root config | Vitest 4 (removed the workspace file) | Repo already uses `projects` — do NOT reintroduce the workspace file (pre-2025 tutorials still show it). |
| Tailwind `tailwind.config.js` + PostCSS + `@tailwind base/components/utilities` | `@tailwindcss/vite` plugin + single `@import "tailwindcss"` + `@theme` in CSS | Tailwind v4 (2025) | No PostCSS, no JS config file; theme tokens live in CSS. Ignore v3 tutorials. |
| `next-pwa` | vite-plugin-pwa (or Serwist on Next) | ongoing | `next-pwa` abandoned; irrelevant here (Vite). |
| Manual `registration.waiting` + `postMessage` SW update wiring | `useRegisterSW` (`virtual:pwa-register/react`) | vite-plugin-pwa maturity | Idiomatic hook returns `needRefresh`/`offlineReady` as React state and handles skipWaiting+reload. |
| `enum`/`namespace` TS | Erasable-only syntax (string-literal unions) | Node native TS type-stripping (24.x) | Core enforces `erasableSyntaxOnly`; keep app types union-based for consistency (Phase 2 convention). |

**Deprecated/outdated (do not follow):**
- Tailwind v3 setup guides (PostCSS, `content` globs, JS config).
- `vitest.workspace.ts` tutorials.
- Any PWA guide using `registerType: 'autoUpdate'` as the default recommendation for this app.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fake-indexeddb` is needed to unit-test the Dexie round-trip under jsdom | Code Examples §Vitest / §Persistence | Low — if the DB round-trip is validated manually/e2e instead, this dep is unnecessary. Verify at plan time. |
| A2 | iOS Safari detection heuristic (UA + `maxTouchPoints`) is "good enough" for the <10-friend target | Pitfall 3, Code Examples §Install | Medium — edge cases (in-app webviews, iOS Chrome) may misfire; the permanent menu Install entry + fallback copy mitigate. Real-device spike recommended (piggyback on the Phase 4 iOS spike already in STATE.md). |
| A3 | `lucide-react@1.23.0` is the correct current major (UI-SPEC says `lucide-react`, unversioned) | Standard Stack | Low — registry-verified to exist; pin whatever `npm view` returns at install. Icon-only dep, low blast radius. |
| A4 | Hourly periodic `r.update()` interval is appropriate (not tied to show state in P3) | Code Examples §Update flow | Low — interval is a config constant; "suppress during show" is explicitly a deferred Phase 4 concern (D-06). |
| A5 | `@vitejs/plugin-react@6.x` is Vite 8-compatible | Standard Stack | Low — official Vite React plugin tracks Vite majors; verify peer range at install. |
| A6 | jsdom version returned by `npm view` (29.x in this sandbox) is the correct peer for Vitest 4 | Standard Stack | Low — use the version Vitest 4 pulls/recommends; either jsdom or happy-dom works. |

**Note:** All *locked* library choices come from CLAUDE.md (already verified) — the assumptions above are wiring-detail and detection-heuristic assumptions, not stack re-litigation.

## Open Questions

1. **Exact iOS Safari detection robustness for the friend group's actual devices.**
   - What we know: `beforeinstallprompt` never fires on iOS; detection must be heuristic; the menu Install entry is the safety net.
   - What's unclear: the specific iOS versions/browsers the <10 friends use (in-app webviews? iOS Chrome?).
   - Recommendation: ship the heuristic + fallback copy now; add a one-device real-iPhone check to the Phase 4 iOS spike already scheduled in STATE.md.

2. **Icon source asset availability.**
   - What we know: manifest needs 192/512/maskable + apple-touch icons; `@vite-pwa/assets-generator` can produce them from one source.
   - What's unclear: whether a source logo/PNG exists yet.
   - Recommendation: if no source art, a simple generated placeholder icon unblocks the phase; art can be swapped later without code change.

3. **Whether to gate `storage.persist()` behind a user gesture.**
   - What we know: some platforms only grant persistence after engagement; D-09 allows "after a user gesture if the platform requires one."
   - What's unclear: whether calling on first paint vs. first interaction materially changes the grant rate on the target devices.
   - Recommendation: call from the first meaningful interaction (install-banner dismiss or first tab tap) to maximize grant likelihood; it's idempotent and status-recorded either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, CLI | ✓ (repo runs on ≥24.12 per CLAUDE.md) | ≥24.12 | — |
| npm workspaces | Monorepo installs | ✓ (`package-lock.json` present) | bundled | — |
| git (at build) | git SHA for version stamp (D-07) | ✓ (repo is a git repo) | any | `execSync` guarded → `'unknown'` SHA; build still succeeds |
| Real iOS device | Validating install + persistence on iOS | ✗ (not confirmed available to this agent) | — | Manual owner validation on a friend's iPhone; piggyback Phase 4 iOS spike |
| Real Android device / Chrome | Validating `beforeinstallprompt` install | ✗ (unconfirmed) | — | Desktop Chrome DevTools can simulate install + offline; real-device confirm before show |
| npm registry (install) | Fetching new deps | ✓ (`npm view` succeeded this session) | — | — |

**Missing dependencies with no fallback:** none block *building* the phase. Real-device install/persistence validation cannot be fully automated in CI — it requires owner/manual verification (see Validation Architecture manual gates).
**Missing dependencies with fallback:** git-absent build (guarded), device validation (manual/DevTools simulation).

## Validation Architecture

> `nyquist_validation` is enabled (`.planning/config.json`). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (already a root devDep) |
| Config file | `vitest.config.ts` (root) — extend `test.projects` with a `@guezzer/app` jsdom project |
| Quick run command | `npm test` (root `vitest run`) — runs all projects |
| Full suite command | `npm test` (root) |
| App test env | `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`; `fake-indexeddb` for DB tests (A1) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-03 | Dexie write to `attendedShows` (keyed by show_id) round-trips (put → get) | unit (fake-indexeddb) | `npm test` → `packages/app/test/db.test.ts` | ❌ Wave 0 |
| PWA-03 | `requestPersistenceOnce` records a `persistStatus` value in `meta` and never throws on denial | unit | `npm test` → `packages/app/test/persist.test.ts` | ❌ Wave 0 |
| PWA-02 | Hash routing: unknown/empty hash normalizes to `show`; `navigate()` updates active route | unit | `npm test` → `packages/app/test/route.test.ts` | ❌ Wave 0 |
| PWA-02 | Version stamp renders `v… · sha · built …` from injected constants | unit (component) | `npm test` → `packages/app/test/version.test.tsx` | ❌ Wave 0 |
| PWA-01 | `isIosSafari()` / `isStandalone()` return expected values for sampled UA strings | unit | `npm test` → `packages/app/test/platform.test.ts` | ❌ Wave 0 |
| PWA-01 | Installable — manifest emitted, valid, correct theme/background/icons | manual/build-artifact | `npm run build -w @guezzer/app` then inspect `dist/manifest.webmanifest` + Chrome DevTools → Application → Manifest (installability audit) | ❌ Wave 0 (manual gate) |
| PWA-02 | Offline after first load — precache serves shell with network disabled | manual (e2e) | `npm run build && npm run preview -w @guezzer/app`, load once, go offline (DevTools → Network → Offline), reload → app loads | ❌ Wave 0 (manual gate) |
| PWA-02 | Update prompt appears only on new SW and applies only on Refresh | manual (e2e) | Build v1 → preview → build v2 → reload → toast appears → Refresh reloads to v2; Later keeps v1 | ❌ Wave 0 (manual gate) |
| PWA-03 | Persistence survives relaunch on-device | manual (device) | Install on iOS/Android, write a row, force-quit, relaunch, confirm row present | ❌ Wave 0 (manual gate) |

### Sampling Rate
- **Per task commit:** `npm test` (fast unit projects; core + app).
- **Per wave merge:** `npm test` + `npm run build -w @guezzer/app` (build must succeed; manifest/SW emit).
- **Phase gate:** Full unit suite green **plus** the four manual gates (installable, offline-reload, update-prompt, on-device persistence) executed and evidenced before `/gsd-verify-work`. The offline/install gates MUST run against `vite build` + `vite preview`, never the dev server (Pitfall 1).

### Wave 0 Gaps
- [ ] `vitest.config.ts` — add `@guezzer/app` jsdom project (`environment: 'jsdom'`, `plugins:[react()]`, `setupFiles`).
- [ ] `packages/app/test/setup.ts` — `import '@testing-library/jest-dom'` (+ `import 'fake-indexeddb/auto'` if DB unit tests included).
- [ ] `packages/app/test/db.test.ts`, `persist.test.ts`, `route.test.ts`, `platform.test.ts`, `version.test.tsx` — cover the unit rows above.
- [ ] Dev-dep installs: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, (`fake-indexeddb` if used).
- [ ] A documented manual-validation checklist (the four manual gates) for the owner to run pre-show.

## Security Domain

> `security_enforcement` enabled, ASVS Level 1 (`.planning/config.json`). This is a no-backend, no-auth, single-user-and-<10-friends static PWA with only client-side local data — the ASVS surface is minimal but not zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (hard constraint — personal tool). |
| V3 Session Management | no | No sessions/tokens; no server. |
| V4 Access Control | no | No multi-user, no server-side resources. |
| V5 Input Validation | partial (later) | Phase 3 has no external input beyond `location.hash` (validated against a fixed `ROUTES` allow-list — never used to index/eval). API-response validation via zod is a Phase 5 concern (live poll) and already established in core. |
| V6 Cryptography | no | No secrets, no PII, no crypto in Phase 3. |
| V7 Error Handling & Logging | minimal | `onRegisterError` logs SW failures to console; no sensitive data logged. |
| V12 Files & Resources | partial | SW precache scope limited to app-shell globs; no user file upload in Phase 3 (JSON import is Phase 5). |
| V14 Config | yes | Static-host security headers (CSP) are a deployment concern; manifest/SW served same-origin. |

### Known Threat Patterns for a static offline PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/oversized precache or SW hijack | Tampering | SW is Workbox-generated, same-origin, served over HTTPS (required for SW at all); no third-party SW. |
| Hash-fragment injection (open redirect / DOM-based) | Tampering/EoP | `location.hash` is validated against the fixed `ROUTES` allow-list and only selects a view — never assigned to `innerHTML`, `location`, or `eval`. |
| Supply-chain (slopsquat/typosquat in new deps) | Tampering | Package Legitimacy Audit run (slopcheck): 17 OK, 1 documented false positive; all deps from official orgs. |
| XSS via injected build constants | Tampering | `__GIT_SHA__`/`__BUILD_DATE__` are build-time literals rendered as text, never HTML. |
| IndexedDB data exposure on a shared device | Info Disclosure | Accepted risk — personal tool, no PII beyond show-attendance; no cross-user model. Out of scope per project constraints. |
| CSP / security headers | Info Disclosure | Recommend a baseline CSP at the static host (Vercel/Netlify headers). Not blocking for Phase 3; note for deploy config. |

**Security verdict for Phase 3:** LOW surface. No `security_block_on: high` items. The one live control is hash-fragment allow-listing (already covered by the routing pattern) and keeping the SW same-origin/HTTPS.

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` (project) — locked stack, versions, decisions #1–8, "What NOT to Use", version-compatibility table. Versions npm-verified there 2026-07-08.
- `.planning/phases/03-app-shell-pwa-foundation/03-CONTEXT.md` — decisions D-01..D-09, discretion, deferred.
- `.planning/phases/03-app-shell-pwa-foundation/03-UI-SPEC.md` — palette, typography, component inventory, copy, `lucide-react` + `IosShareGlyph`, manifest colors.
- [vite-pwa-org.netlify.app/frameworks/react.html](https://vite-pwa-org.netlify.app/frameworks/react.html) — `useRegisterSW` from `virtual:pwa-register/react`, `needRefresh`/`offlineReady`, `updateServiceWorker(true)`, types config.
- [vite-pwa-org.netlify.app/guide/prompt-for-update.html](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html) — prompt mode is default; `onNeedRefresh`/`onOfflineReady`.
- [vite-pwa-org.netlify.app/guide/periodic-sw-updates.html](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html) — `onRegisteredSW` + `setInterval` + `r.update()` with online guard.
- [tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite) — `@tailwindcss/vite` plugin, `@import "tailwindcss"`, no PostCSS.
- [tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) — `@theme` custom color declaration.
- npm registry (`npm view`, 2026-07-08) — existence/versions of vite-plugin-pwa 1.3.0, @tailwindcss/vite 4.3.2, dexie 4.4.4, @vitejs/plugin-react 6.0.3, lucide-react 1.23.0, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1; creation dates for dexie/lucide/vite-plugin-pwa/@tailwindcss/vite.
- slopcheck (`scan --pkg npm`, 2026-07-08) — 18 packages, 17 OK, vitest SUS (typosquat-vs-vite false positive).

### Secondary (MEDIUM confidence)
- [tailwindcss.com/docs/dark-mode](https://tailwindcss.com/docs/dark-mode) + [tailwindcss.com/docs/colors](https://tailwindcss.com/docs/colors) — dark theming with CSS variables (Phase 3 is dark-only, simplest case).
- WebSearch (git-sha-via-Vite-`define`): [zegnat.bearblog.dev git commit hash in Vite](https://zegnat.bearblog.dev/adding-the-git-commit-hash-to-my-vite-build/), [duncanlock.net git hashes in Vite](https://duncanlock.net/blog/2023/05/23/using-git-hashes-in-vite-vuejs/), [vite-plugin-version-mark](https://www.npmjs.com/package/vite-plugin-version-mark) — confirmed `execSync` + `define` is the standard pattern (a plugin exists but is unnecessary for three constants).

### Tertiary (LOW confidence — flagged for validation)
- iOS Safari detection heuristic and `storage.persist()` grant behavior — training knowledge + widely-reported behavior; not verified against the friend group's specific devices. Mitigated by the permanent menu Install entry, fallback copy, and silent-on-denial persistence. Real-device spike recommended.
- `fake-indexeddb` requirement for jsdom DB tests (A1) — standard practice, verify at plan time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pre-locked in CLAUDE.md, re-verified via npm view + slopcheck this session.
- Architecture / wiring: HIGH — prompt-update flow, Tailwind v4, periodic update, version injection all confirmed against official docs; hash routing and Dexie schema are standard well-documented patterns.
- Pitfalls: MEDIUM-HIGH — SW-in-dev, iOS `beforeinstallprompt`, tsconfig DOM lib, Vitest project env are well-established gotchas; iOS detection robustness is the one genuinely device-variable item (LOW).
- Security: HIGH — minimal surface correctly characterized for a no-backend static PWA at ASVS L1.

**Research date:** 2026-07-08
**Valid until:** ~2026-08-07 (30 days — stack is locked/stable; the fast-moving risk is only new patch releases of the already-pinned deps).

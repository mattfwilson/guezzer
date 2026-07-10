# Phase 3: App Shell & PWA Foundation - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 30 (new + modified)
**Analogs found:** 7 in-repo (config/tsconfig/test/types conventions) / 30 — the remaining 23 are greenfield React/PWA files with **no in-repo analog** (Phase 3 is the first `packages/app` phase)

> **Reading note for the planner:** This is the pivot phase from pure-Node `packages/core` to a browser React app. The repo has **no prior React, DOM, Vite, Dexie, or component code** — so most Phase 3 files cannot copy an existing sibling. Where an in-repo analog exists (config-as-single-source, tsconfig-extends-base, Vitest-project block, union-type convention, barrel export, fixture test structure) the excerpt + line numbers are given below and MUST be followed. Where none exists, the **authoritative pattern source is `03-RESEARCH.md` §Code Examples** (load-bearing wiring, already adapted to this repo) plus the locked stack in `CLAUDE.md`; those files are listed under "No In-Repo Analog" with their exact RESEARCH section pointer. Do not invent a pattern when RESEARCH names one.

---

## File Classification

### Build / Config tier

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/app/package.json` (modify) | config | — | `packages/core/package.json` | exact (sibling manifest) |
| `packages/app/tsconfig.json` (new) | config | — | `packages/core/tsconfig.json` | role-match (extends base, but DOM-overridden — see Pitfall 6) |
| `packages/app/src/config.ts` (new) | config | — | `packages/core/src/config.ts` | exact (config-as-single-source ethos) |
| `vitest.config.ts` (modify, root) | config/test | — | own `@guezzer/core` project block (lines 11-18) | exact (self-analog) |
| `packages/app/vite.config.ts` (new) | config/build | transform (build-time) | none | RESEARCH §"VitePWA config + version injection" |
| `packages/app/index.html` (new) | config/entry | — | none | RESEARCH §Recommended Structure + Pitfall 9 |
| `packages/app/src/vite-env.d.ts` (new) | config/types | — | none | RESEARCH §"vite-env.d.ts" + Pitfall 7 |
| `packages/app/src/styles.css` (new) | config/styling | — | none | RESEARCH §"Tailwind v4 dark palette" + UI-SPEC §Color |

### Source (React app) tier

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/app/src/main.tsx` (new) | entry | — | none | RESEARCH §Recommended Structure |
| `packages/app/src/App.tsx` (new) | component (root shell) | event-driven | none | RESEARCH §System Architecture + UI-SPEC §Component Inventory |
| `packages/app/src/db/db.ts` (new) | store/model | CRUD (IndexedDB) | none | RESEARCH §"Dexie v1 schema" |
| `packages/app/src/pwa/persist.ts` (new) | utility | request-response (Storage API) | none | RESEARCH §"Persistence request" |
| `packages/app/src/pwa/useRegisterSW.ts` (new) | hook | event-driven (SW lifecycle) | none | RESEARCH §"Update flow — useRegisterSW" |
| `packages/app/src/pwa/install/platform.ts` (new) | utility | — | `packages/core/src/domain/types.ts` union convention only | RESEARCH §"Install detection" |
| `packages/app/src/pwa/install/useInstallState.ts` (new) | hook | event-driven (beforeinstallprompt) | none | RESEARCH §"Install detection" |
| `packages/app/src/routing/useHashRoute.ts` (new) | hook | event-driven (hashchange) | none | RESEARCH §"Hash routing" |
| `packages/app/src/components/AppShell.tsx` (new) | component | — | none | UI-SPEC §Component Inventory + §Layout |
| `packages/app/src/components/BottomTabBar.tsx` (new) | component | event-driven | none | UI-SPEC §Component Inventory + §Layout |
| `packages/app/src/components/PlaceholderView.tsx` (new) | component | — | none | UI-SPEC §Copywriting + §Component Inventory |
| `packages/app/src/components/AppMenu.tsx` (new) | component | — | none | UI-SPEC §Component Inventory |
| `packages/app/src/components/InstallBanner.tsx` (new) | component | event-driven | none | UI-SPEC + RESEARCH §"Install detection" |
| `packages/app/src/components/IosInstallInstructions.tsx` (new) | component | — | none | UI-SPEC §Copywriting (iOS steps) |
| `packages/app/src/components/IosShareGlyph.tsx` (new) | component (inline SVG) | — | none | UI-SPEC §Design System (Share-glyph exception) |
| `packages/app/src/components/UpdateToast.tsx` (new) | component | event-driven | none | RESEARCH §"Update flow" + UI-SPEC §Copywriting |

### Test tier

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/app/test/setup.ts` (new) | test config | — | none | RESEARCH §"App Vitest project" (jsdom + jest-dom) |
| `packages/app/test/db.test.ts` (new) | test | CRUD | `packages/core/test/smoke.test.ts` (structure) | role-match |
| `packages/app/test/persist.test.ts` (new) | test | request-response | `packages/core/test/smoke.test.ts` | role-match |
| `packages/app/test/route.test.ts` (new) | test | event-driven | `packages/core/test/model/predict.test.ts` (unit structure) | role-match |
| `packages/app/test/platform.test.ts` (new) | test | — | `packages/core/test/model/predict.test.ts` | role-match |
| `packages/app/test/version.test.tsx` (new) | test (component) | — | none (RTL/jsdom, no in-repo precedent) | RESEARCH §"App Vitest project" |

---

## Pattern Assignments

### `packages/app/package.json` (config) — HAS ANALOG

**Analog:** `packages/core/package.json` (whole file, 12 lines)

The core manifest is the shape to mirror: `"type": "module"`, `"private": true`, `dependencies` vs `devDependencies` split, `@types/node`-style dev deps. The app manifest additionally declares `@guezzer/core` as a workspace dep to establish (not yet use) the app→core import path.

```json
{
  "name": "@guezzer/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": { "zod": "4.4.3" },
  "devDependencies": { "@types/node": "^24.13.3" }
}
```

**Apply:** keep `"type": "module"` and `"private": true`; add `"@guezzer/core": "*"` to `dependencies`; runtime deps (react, react-dom, dexie, dexie-react-hooks, lucide-react) and dev/build deps (vite, @vitejs/plugin-react, vite-plugin-pwa, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom) per RESEARCH §Standard Stack install block (lines 135-144). Pin locked versions exactly; caret OK for icon/test-only deps.

---

### `packages/app/tsconfig.json` (config) — HAS ANALOG (with mandatory overrides)

**Analog:** `packages/core/tsconfig.json` (whole file, 13 lines)

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

**Copy the `extends "../../tsconfig.base.json"` + `noEmit` + `allowImportingTsExtensions` spine. Then DIVERGE per RESEARCH Pitfall 6** (the base is `nodenext`/no-DOM, tuned for Node-executed core — wrong for a Vite/browser app):
- `"lib": ["ES2023", "DOM", "DOM.Iterable"]` (core deliberately has no DOM — do NOT add DOM to the base)
- `"jsx": "react-jsx"`
- `"module": "ESNext"`, `"moduleResolution": "bundler"`
- `"types": ["vite/client", "vite-plugin-pwa/react"]` (not `["node"]`)
- **Omit** `erasableSyntaxOnly` (JSX/bundler is fine; that constraint is core-only)
- `"include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]`

`tsconfig.base.json` for reference (lines 1-11): `strict`, `module: nodenext`, `target: es2023`, `noEmit`, `skipLibCheck`.

---

### `packages/app/src/config.ts` (config) — HAS ANALOG

**Analog:** `packages/core/src/config.ts` (lines 1-9 header; whole-file pattern)

The **config-as-single-source-of-truth** convention is a hard CLAUDE.md constraint. Copy this exact structure: a JSDoc header stating the no-scattered-magic-numbers rule, then a single `export const config = { ... } as const;` object with one JSDoc comment per constant.

```typescript
/**
 * Single source of truth for every pipeline constant (CLAUDE.md: "All model
 * constants ... in a single config file — no scattered magic numbers").
 * ...
 */
export const config = {
  apiBase: "https://kglw.net/api/v2",
  fetchDelayMs: 2000,
  // ...each constant documented inline
} as const;
```

**Apply:** app-side constants belong here (RESEARCH §Code Examples preamble + CLAUDE.md #2 in §Project Constraints): `DB_NAME` (`'guezzer'`), copy strings (install banner headline/body/dismiss, update-toast copy, iOS steps — all from UI-SPEC §Copywriting), version-stamp format string, `UPDATE_CHECK_MS` (hourly), persist-timing note. Use `as const`. Keep union-typed string literals, not enums.

---

### `vitest.config.ts` (root, modify) — HAS ANALOG (self)

**Analog:** the existing `@guezzer/core` project block in the same file, lines 11-18:

```typescript
{
  test: {
    name: "@guezzer/core",
    root: "packages/core",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
},
```

**Apply (per RESEARCH Pitfall 8 + §"App Vitest project"):** ADD a second, **explicit** project object alongside core (do NOT widen to a `packages/*` glob — the existing file comment on lines 3-7 warns a glob fails for a testless package, and the app must not run under `node`):

```typescript
{
  plugins: [react()],                 // import react from '@vitejs/plugin-react'
  test: {
    name: "@guezzer/app",
    root: "packages/app",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
  },
},
```

Leave the core project exactly as-is (`environment: "node"`). Remove/update the stale "Widen to `packages/*` in Phase 3" comment.

---

### `packages/app/src/pwa/install/platform.ts` (utility) — CONVENTION ANALOG ONLY

**Analog for TYPE convention:** `packages/core/src/domain/types.ts` line 11 — union-type-not-enum:

```typescript
// Union type (not enum) per erasableSyntaxOnly (CLAUDE.md / tsconfig).
export type TransitionKind = "none" | "segue" | "terminal";
```

**Apply:** any route/platform/status enums in the app (e.g. `Route = 'show' | 'explore' | 'dex'`, `persistStatus = 'persisted' | 'best-effort' | 'unsupported'`) MUST be string-literal unions, matching the Phase 2 convention (RESEARCH Anti-Patterns: no `enum`/`namespace`). The **function bodies** (`isStandalone()`, `isIosSafari()`) have no in-repo analog — copy verbatim-adapted from RESEARCH §"Install detection + Android prompt capture" (03-RESEARCH.md lines 481-494), and treat the iOS heuristic as best-effort (Pitfall 3).

---

### `packages/app/test/*.test.ts` (tests) — STRUCTURE ANALOG

**Analog:** `packages/core/test/smoke.test.ts` (lines 1-11) and `packages/core/test/model/predict.test.ts` (lines 1-33).

Follow the established test conventions:
- `import { describe, expect, it } from "vitest";` (smoke.test.ts line 1)
- Import source under test via explicit `.ts` extension relative path (predict.test.ts lines 2-22 — `../../src/config.ts` style; app tests use `../src/...`)
- One `describe` per unit, focused `it` assertions (smoke.test.ts lines 4-10)

```typescript
import { describe, expect, it } from "vitest";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
// ...
describe("smoke: JSON sample import wiring", () => {
  it("imports the rr1010 sample as JSON in the vitest node project", () => {
    expect(rr1010.data.length).toBe(27);
  });
});
```

**Apply per RESEARCH §Validation Architecture Test Map (lines 679-689):**
- `db.test.ts` — Dexie put→get round-trip on `attendedShows` keyed by `show_id`. **Needs `fake-indexeddb`** (jsdom has no IndexedDB — RESEARCH A1, line 604 note): `import 'fake-indexeddb/auto'` in `test/setup.ts`.
- `persist.test.ts` — `requestPersistenceOnce` records a `persistStatus` in `meta` and never throws on denial.
- `route.test.ts` — unknown/empty hash → `'show'`; `navigate()` updates active route.
- `platform.test.ts` — `isIosSafari()`/`isStandalone()` for sampled UA strings.
- `version.test.tsx` — component render (RTL) asserting `v… · sha · built …` from injected constants.

`test/setup.ts` has no in-repo analog: `import '@testing-library/jest-dom';` (+ `import 'fake-indexeddb/auto';` if DB test included), per RESEARCH lines 598-604.

---

## No In-Repo Analog (greenfield — pattern source = RESEARCH/CLAUDE/UI-SPEC)

These files have no sibling to copy because Phase 3 introduces React, Vite, Dexie, the PWA plugin, and Tailwind to the repo for the first time. The planner MUST source each from the RESEARCH §Code Examples section named below (already adapted to this repo's constraints) — not from generic tutorials.

| File | Role / Data Flow | Pattern source (authoritative) |
|------|------------------|--------------------------------|
| `vite.config.ts` | build config / transform | 03-RESEARCH.md §"VitePWA config + version injection" (lines 366-415). `registerType: 'prompt'` (CLAUDE.md #4 — NEVER `autoUpdate`); `define` for `__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_DATE__` with guarded `execSync`; manifest `theme_color`/`background_color` `#0C0C10` (Pitfall 9). `json` NOT in `globPatterns` this phase. |
| `index.html` | entry | RESEARCH §Recommended Structure + Pitfall 9 — `<meta name="theme-color" content="#0C0C10">`, `apple-mobile-web-app-status-bar-style`, `<script type="module" src="/src/main.tsx">`. |
| `src/vite-env.d.ts` | types | RESEARCH lines 416-423 + Pitfall 7 — `/// <reference types="vite/client" />`, `/// <reference types="vite-plugin-pwa/react" />`, `declare const __APP_VERSION__: string` (etc.). |
| `src/styles.css` | styling | RESEARCH §"Tailwind v4 dark palette" (lines 567-584) + UI-SPEC §Color/§Spacing. `@import "tailwindcss";` + `@theme { --color-surface:#0C0C10; ... }`; 44px floor via `min-h-11 min-w-11`; safe-area `env()`. NO PostCSS, NO tailwind.config.js (Tailwind v4). |
| `src/main.tsx` | entry | RESEARCH §Recommended Structure — `ReactDOM.createRoot(...).render(<App/>)`. |
| `src/App.tsx` | root shell component | RESEARCH §System Architecture Diagram (lines 194-222) + UI-SPEC §Component Inventory/§Layout — hosts `useHashRoute`, `UpdateToast`, install controller; header + `<main>` route outlet + `BottomTabBar`. |
| `src/db/db.ts` | store / CRUD | RESEARCH §"Dexie v1 schema" (lines 517-548). `db.version(1).stores({ meta: '&key', attendedShows: '&show_id, showDate' })`; typed `Table<>`; `setMeta`/`getMeta` helpers; additive-migration comment for Phase 4+. `show_id` = number, mirrors `NormalizedShow.showId` (core domain/types.ts line 65). DB name from `config.ts`. |
| `src/pwa/persist.ts` | utility / request-response | RESEARCH §"Persistence request" (lines 550-565) + Pitfall 4. Silent on denial (D-09); record `persistStatus` to `meta`; idempotent. |
| `src/pwa/useRegisterSW.ts` | hook / SW lifecycle | RESEARCH §"Update flow" (lines 426-455). `useRegisterSW` from `virtual:pwa-register/react`; `onRegisteredSW` hourly `r.update()` with `navigator.onLine` guard; `updateServiceWorker(true)` only on user tap. |
| `src/pwa/install/useInstallState.ts` | hook / event-driven | RESEARCH §"Install detection" (lines 496-514). `beforeinstallprompt` capture + stash; "Not now" = session-only `useState`, NOT persisted (D-05, Anti-Pattern). |
| `src/routing/useHashRoute.ts` | hook / event-driven | RESEARCH §"Hash routing" (lines 458-478). `useSyncExternalStore` + `hashchange`; `ROUTES` allow-list; unknown → `'show'`. Hash allow-listing is also the one live security control (RESEARCH §Security). |
| `src/components/AppShell.tsx` | component | UI-SPEC §Component Inventory + §Layout — full-viewport dark, safe-area aware, fixed bottom tab bar, scrolling `<main>`. |
| `src/components/BottomTabBar.tsx` | component / event-driven | UI-SPEC §Component Inventory + §Layout — 3 tabs ≥44px, lucide icons + Label, active = accent, drives hash route. |
| `src/components/PlaceholderView.tsx` | component | UI-SPEC §Copywriting (per-view headings/body) + §Component Inventory — centered 20/600 heading + muted body, 3xl top spacing, NO accent. |
| `src/components/AppMenu.tsx` | component | UI-SPEC §Component Inventory — permanent Install entry, version stamp (`v{ver} · {sha} · built {date}`), rows ≥44px, secondary surface. |
| `src/components/InstallBanner.tsx` | component / event-driven | UI-SPEC + RESEARCH §"Install detection" — accent Install button + muted "Not now"; branches iOS vs Android; hidden when standalone. |
| `src/components/IosInstallInstructions.tsx` | component | UI-SPEC §Copywriting (iOS steps 1-3) — numbered steps + `IosShareGlyph`; shown only to detected iOS Safari. |
| `src/components/IosShareGlyph.tsx` | component (inline SVG) | UI-SPEC §Design System exception + RESEARCH §Don't Hand-Roll — accurate Apple Share icon, `currentColor`, NOT a lucide substitute. |
| `src/components/UpdateToast.tsx` | component / event-driven | RESEARCH §"Update flow" (lines 426-455) + UI-SPEC §Copywriting — "New version available — Refresh"; accent Refresh calls `updateServiceWorker(true)`; muted Later = dismiss only. |

---

## Shared Patterns

### Config-as-single-source-of-truth (hard CLAUDE.md constraint)
**Source:** `packages/core/src/config.ts` lines 1-9 (header) + `export const config = {...} as const` shape.
**Apply to:** ALL app files — no scattered magic numbers or copy strings. DB name, intervals, copy, version-format, persist timing live in `packages/app/src/config.ts`, imported everywhere. Same JSDoc-per-constant discipline as core.

### Union types, never `enum`/`namespace`
**Source:** `packages/core/src/domain/types.ts` line 11 (`TransitionKind`), line 48 (`SetNumber`).
**Apply to:** `Route`, `persistStatus`, any app type unions. Phase 2 convention (RESEARCH Anti-Patterns line 290). Keeps parity with core's `erasableSyntaxOnly` even though the app tsconfig doesn't enforce it.

### tsconfig extends the shared base
**Source:** `packages/core/tsconfig.json` line 2 (`"extends": "../../tsconfig.base.json"`).
**Apply to:** `packages/app/tsconfig.json` — extend the base, then override lib/jsx/module/moduleResolution/types for browser+Vite (RESEARCH Pitfall 6). Never add DOM to the base itself (would break core purity).

### Explicit Vitest project (not a glob)
**Source:** root `vitest.config.ts` lines 11-18 (core project) + file comment lines 3-7.
**Apply to:** the new `@guezzer/app` jsdom project — explicit object, `environment: 'jsdom'`, `plugins: [react()]`, `setupFiles`. Core project unchanged.

### app→core import direction only (hard architectural invariant)
**Source:** CLAUDE.md core/UI separation + `packages/core/src/index.ts` barrel (lines 1-99) — the public API the app may consume.
**Apply to:** the app declares `@guezzer/core` as a dep and may import from its barrel, but NOTHING in `packages/core` may ever import from `packages/app` (RESEARCH Anti-Patterns line 289). Phase 3 establishes the wiring but does not yet call core APIs (empty views).

### Vitest import + test-file convention
**Source:** `packages/core/test/smoke.test.ts` lines 1-11; `packages/core/test/model/predict.test.ts` lines 1-33.
**Apply to:** all `packages/app/test/*.test.{ts,tsx}` — `import { describe, expect, it } from "vitest"`, explicit `.ts` extension relative imports of source under test, focused `describe`/`it`.

---

## Metadata

**Analog search scope:** `packages/core/**` (src + test + tsconfig + package.json), root `package.json`, `tsconfig.base.json`, root `vitest.config.ts`, `packages/app/**` (stub only).
**Files scanned:** ~15 in-repo (all of `packages/core/src` config/types/index/tsconfig, sample core tests, all root config).
**Key finding:** 7 files have a real in-repo analog (all config/convention/test-structure); the 23 React/PWA/Dexie/component files are genuinely greenfield and must source their patterns from `03-RESEARCH.md §Code Examples` (line ranges cited per file above) + `CLAUDE.md` locked stack + `03-UI-SPEC.md` component/copy/color contract. RESEARCH §Code Examples is complete and repo-adapted, so no pattern gap remains for the planner.
**Pattern extraction date:** 2026-07-08

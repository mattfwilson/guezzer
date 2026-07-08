<!-- GSD:project-start source:PROJECT.md -->

## Project

**Guezzer**

A mobile-friendly PWA that predicts the next song King Gizzard and the Lizard Wizard will play during a live show. Given the current song, it shows the top 5–10 most likely next songs with confidence scores, tracks the running setlist as the show progresses, and doubles as a personal "Pokédex" of songs caught live. Built for the owner and fewer than 10 friends attending multiple shows (several consecutive nights of the same tour) in summer 2026. A personal tool, not a product — no accounts, no monetization, no App Store distribution.

**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

### Constraints

- **Timeline**: Usable before the first show, late August/September 2026 (~6–8 weeks) — bias every decision toward shipping a working core over completeness. Features 1–4 (full Show Mode loop incl. live sync) are the show-#1 bar; backtest report is a non-negotiable trust gate before relying on it live
- **Tech stack**: TypeScript throughout; Next.js or Vite + React, static-export deployable to Vercel/Netlify/GitHub Pages; no backend
- **Architecture**: Strict core/UI separation — all domain logic (API ingestion, transition-matrix construction, prediction scoring, backtesting, Pokédex derivation) in a pure TypeScript `core/` module with zero React/DOM/browser dependencies; UI imports from core, never the reverse; entire core runnable/testable from Node CLI including the backtest report
- **Data structure**: Transition matrix is a clean, serializable plain-JSON structure consumed by BOTH the predictor and the constellation renderer — no entanglement with scoring or rendering code
- **Rendering**: Constellation via d3-force (or equivalent) in a single component; graph data derived from the same matrix JSON, never a second pipeline
- **Configuration**: All model constants (decay half-life, rotation penalty, backoff weights, constellation edge thresholds) in a single config file — no scattered magic numbers
- **Testing**: Unit tests for the scoring pipeline AND dex derivation using small fixture setlists with known expected outputs
- **API etiquette**: Historical corpus fetched once at build time and bundled as static JSON; live polling only `latest`, ≤ 1/60s; volunteer-run fan site
- **Compatibility**: Mixed iOS/Android; PWA installable on both

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 8.1.3 | Build tool + dev server | Zero server needs makes Next.js pure overhead (see Alternatives). Vite's static output deploys to Vercel/Netlify/GitHub Pages identically. First-class PWA plugin. Fast dev loop on a 6–8 week deadline. |
| React | 19.2.7 | UI framework | Constraint-confirmed choice. React 19 stable; no experimental features needed for this app. |
| TypeScript | 6.0.3 | Types + typecheck | **Not 7.0.2** (current `latest`). TS 7 (Go-native compiler) went GA weeks ago, but typescript-eslint 8.63 caps support at `<6.1.0` (verified via peerDependencies). TS 6.0.3 is the final stable JS-line release, fully ecosystem-compatible. Vite transpiles via esbuild anyway — `tsc` is typecheck-only, so upgrading to TS 7 later is a one-line change once the lint toolchain catches up. |
| vite-plugin-pwa | 1.3.0 | PWA manifest + service worker | The de facto Vite PWA solution. Verified peer support for Vite ^8. Wraps Workbox 7.4.1 (actively maintained — published May 2026). Handles manifest generation, SW registration, precache manifest injection. |
| Dexie | 4.4.4 | IndexedDB wrapper | Schema versioning, typed tables, and `liveQuery` reactivity — the setlist trail and Pokédex update automatically when a show is logged, with zero hand-rolled state sync. Actively maintained (June 2026 release). ~29 KB is a fair trade at this feature level. |
| dexie-react-hooks | 4.4.0 | React bindings for Dexie | `useLiveQuery` makes IndexedDB reads reactive React state. Peer-compatible with Dexie 4.x and React ≥16. |
| d3-force | 3.0.0 | Force simulation (via react-force-graph-2d) | Stable since 2021 — not stale, *done*. The transition-matrix JSON feeds it directly. |
| react-force-graph-2d | 1.29.1 | Constellation rendering (Canvas) | Actively maintained (Feb 2026). Wraps d3-force with canvas rendering, built-in pan/zoom/hit-testing on mobile, `cooldownTicks`/`onEngineStop` for the settle-and-freeze requirement, `nodeCanvasObject` for custom orbs/badges, `onNodeClick` for focus+context. Building this by hand on direct d3 costs 1–2 weeks you don't have. **Import the `-2d` package specifically** — the umbrella `react-force-graph` pulls three.js/VR dependencies you don't want. |
| Vitest | 4.1.10 | Test runner | Verified peer support for Vite ^8. `projects` config (the v4 replacement for the removed workspace file) runs core tests in `node` env and app tests in `jsdom` from one root command. |
| fuse.js | 7.4.2 | Fuzzy search over ~250-song catalog | Actively maintained again (June 2026 release after a dormant period). Zero index-build step, tunable `threshold`/`distance` for typo tolerance, sub-millisecond on 250 strings. Wrap it behind a pure `searchCatalog(query)` function in core so it's swappable if drunk-thumb match quality disappoints (see Alternatives: uFuzzy). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.3 | Runtime schema validation | Encode the empirically-documented kglw.net API schema as zod schemas in core's ingestion layer. The build-time fetch script validates every show against them — schema drift on the volunteer-run API fails loudly at build time, never silently corrupts the matrix. |
| Tailwind CSS | 4.3.2 | Styling | Optional but recommended: dark theme, 44px tap targets, and one-thumb layouts are utility-class territory. v4 has first-party Vite plugin (`@tailwindcss/vite`), no PostCSS config. |
| motion | 12.42.2 | Recenter/orbit transition animation | Optional. Only if CSS transitions on SVG transforms prove insufficient for the orbit recenter choreography. Start with CSS; add `motion` only when needed. |
| workbox-window | 7.4.1 | SW update UX | Comes with vite-plugin-pwa; used for the "update available" prompt flow. |
| tsx | 4.23.0 | TS execution fallback | Only needed if you can't require Node ≥24.12. Prefer Node-native TS execution (see Development Tools). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm workspaces | Monorepo: `packages/core` + `packages/app` | Two-package workspace gives **compile-time enforcement** of core purity: core's `tsconfig` sets `"lib": ["ES2023"]` (no DOM), its `package.json` has no React dependency — importing React or `window` from core is a build error, not a code-review catch. App consumes core as a workspace source dependency. npm workspaces works identically at this scale if you'd rather avoid pnpm. |
| Node.js ≥ 24.12 | CLI execution of core (backtest report, corpus fetch) | Type stripping is **stable** in Node 24.12+ — `node packages/core/src/cli/backtest.ts` runs directly, no build step, no tsx. Requires erasable-syntax-only TS (no `enum`, no `namespace`) — enforce with `"erasableSyntaxOnly": true` in core's tsconfig; it's good practice regardless. |
| Vitest `projects` | Per-package test environments | Root `vitest.config.ts` with `test.projects: ['packages/*']`; core project uses `environment: 'node'`, app uses `jsdom`. Note: `vitest.workspace.ts` files were removed in Vitest 4 — do not follow pre-2025 tutorials. |
| ESLint 10 + typescript-eslint 8.63 | Lint | typescript-eslint 8.63 supports ESLint ^10 and TS `<6.1.0` (verified) — this is what pins the TS 6.0.3 recommendation. |
| gh-pages / Netlify / Vercel static | Deploy | Pure static output (`packages/app/dist`); any of the three constraint-approved hosts works with zero config beyond base path (set Vite `base` if using GitHub Pages project pages). |

## Key Decision Rationale

### 1. Vite over Next.js static export — HIGH confidence

### 2. Service worker strategy — HIGH confidence

- **`registerType: 'prompt'`** — NOT `autoUpdate`. A service worker silently swapping the app mid-show is exactly the failure mode this project exists to avoid. Prompt-to-update, and users refresh between shows.
- **Precache** (automatic): app shell — JS, CSS, HTML, icons. The bundled model artifact rides along inside the JS bundle (see decision 8), so offline-complete-on-first-load is automatic.
- **Runtime caching** for the single live endpoint:
- Call `navigator.storage.persist()` on install/first-run — it reduces (not eliminates) iOS Safari IndexedDB eviction risk; the prominent JSON export remains the real backstop.

### 3. Dexie over idb over raw IndexedDB — HIGH confidence

### 4. fuse.js, wrapped for swappability — MEDIUM confidence

### 5. Constellation: react-force-graph-2d over direct d3 or visx — MEDIUM-HIGH confidence

- **Direct d3-force + SVG in React**: maximum control, but you hand-build mobile pan/zoom, hit-testing, label rendering, and the React↔simulation lifecycle. That's real days of work for a feature explicitly allowed to slip past show #1.
- **visx**: has no force-layout package that manages simulation lifecycle — you'd still run d3-force by hand and only get low-level SVG primitives in return. Wrong tool here.
- **react-force-graph-2d**: canvas rendering (right call for a dense edge graph on mobile), d3-force embedded and tunable (`d3AlphaDecay`, `d3VelocityDecay`), `cooldownTicks` + `onEngineStop` implement settle-and-freeze directly, `nodeCanvasObject`/`linkColor` callbacks implement tuning-family colors, Pokédex dimming, and focus+context highlighting, `onNodeClick` drives the ranked-bars panel. Graph data is `{ nodes, links }` derived by a pure core function from the matrix JSON — the constraint's "single component, one pipeline" maps exactly onto this library's API.

### 6. Orbit view: plain SVG + CSS, no canvas, no d3 — HIGH confidence

### 7. Workspace + test layout — HIGH confidence

### 8. Static JSON bundling — HIGH confidence

## Installation

# Workspace root

# packages/core

# packages/app

# Root dev tooling

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite 8 | Next.js 16 + `output: 'export'` + @serwist/next 9.5 | Only if the project might grow server features later. It won't ("no backend" is a hard constraint). |
| Dexie 4.4 | idb 8.0.3 | If bundle size becomes critical and you're willing to hand-write reactive state sync. idb last published May 2025 — stable, not stale. |
| fuse.js 7.4 | uFuzzy | If real-world typo-match quality disappoints in testing — swap behind the core `searchCatalog` function. |
| fuse.js 7.4 | MiniSearch 7.2 | If you decide prefix-as-you-type indexing beats fuzzy scoring for the search UX. |
| react-force-graph-2d | Direct d3-force + custom SVG/canvas | If the library's customization ceiling blocks a Pokédex-overlay or focus+context requirement. Budget 1–2 extra weeks. |
| pnpm workspaces | npm workspaces | If you want zero non-Node tooling. Identical layout, slightly slower installs, looser hoisting. |
| TypeScript 6.0.3 | TypeScript 7.0.2 (native) | Once typescript-eslint supports ≥7.0 — then it's a free 10x typecheck speedup. Watch the typescript-eslint release notes. |
| CSS transitions (orbit) | motion 12 | If recenter choreography needs orchestrated sequences (trail shift + orb spawn + recenter as one timeline). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-pwa` | Abandoned; broken with modern Next | N/A (using Vite); Serwist if ever on Next |
| `react-force-graph` (umbrella package) | Pulls three.js, A-Frame/VR dependencies for an unused 3D mode | `react-force-graph-2d` directly |
| Raw IndexedDB API | Event-based API, verbose transactions, well-known footguns; no benefit at this scale | Dexie |
| TypeScript 7.0.2 today | typescript-eslint 8.63 peer range is `<6.1.0`; lint toolchain breaks | TypeScript 6.0.3, upgrade later |
| `vitest.workspace.ts` file | Removed in Vitest 4 (pre-2025 tutorials still show it) | `test.projects` in root `vitest.config.ts` |
| `registerType: 'autoUpdate'` | SW can swap the app mid-show — unacceptable for a live-venue tool | `registerType: 'prompt'` |
| localStorage for dex/setlist data | 5 MB cap, synchronous, string-only, worse eviction story | IndexedDB via Dexie + JSON export |
| CI-scheduled corpus refresh | Hammers a volunteer-run API; violates etiquette constraint | Committed corpus + manual one-command refresh |
| A routing library (react-router, TanStack Router) | Two views + overlays; static hosts need rewrite rules for path routing | View-state switching or hash routing |
| Redux/heavy state management | Dexie `liveQuery` + React state covers everything; model state is derived, not mutable | `useLiveQuery` + component state (add zustand only if prop-drilling actually hurts) |

## Stack Patterns by Variant

- Switch from JSON-module import to `?url` asset + runtime fetch
- Add `json` to `workbox.globPatterns` (NOT included in Workbox defaults)
- Draw labels in `nodeCanvasObject` only above a zoom threshold (`globalScale` param)
- Fall back to direct d3-force + SVG only if the customization ceiling is truly hit
- This is expected iOS behavior for non-installed PWAs — double down on the install prompt and auto-reminder to export after each tracked show; consider auto-download of the export JSON at show end

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| vite-plugin-pwa@1.3.0 | vite ^3.1–^8.0, workbox 7.4.1 | Verified via peerDependencies |
| vitest@4.1.10 | vite ^6–^8 | Verified via peerDependencies |
| typescript-eslint@8.63.0 | eslint ^8.57/^9/^10, typescript >=4.8.4 <6.1.0 | **This is why TS 6.0.3, not 7.0.2** |
| dexie-react-hooks@4.4.0 | dexie >=4.2 <5, react >=16 | Verified via peerDependencies |
| Node ≥24.12.0 | Native `.ts` execution (stable type stripping) | Requires erasable-only syntax: set `"erasableSyntaxOnly": true`, avoid `enum`/`namespace` |
| react-force-graph-2d@1.29.1 | React 19 | Actively maintained (Feb 2026); canvas-based, no DOM-per-node |

## Sources

- npm registry (2026-07-08) — all versions, peerDependencies, and publish dates verified directly via `npm view` — HIGH confidence
- [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/) — TS 7 native-compiler GA timeline — HIGH confidence
- [Node.js TypeScript docs](https://nodejs.org/api/typescript.html) and [Run TypeScript Natively](https://nodejs.org/learn/typescript/run-natively) — type stripping stable in 24.12+ — HIGH confidence
- vite-plugin-pwa / Workbox runtime-caching patterns — training knowledge cross-checked against verified current versions (Workbox 7.4.1 published 2026-05, plugin 1.3.0 published 2026-05) — MEDIUM-HIGH confidence
- fuse.js / uFuzzy / MiniSearch quality comparison — training knowledge; match-quality claim flagged as empirical (mitigated by swappable core function) — MEDIUM confidence

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

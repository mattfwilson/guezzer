# Stack Research — Gizz Bingo (v1.2)

**Domain:** One new feature (4×4 live auto-marking setlist bingo) bolted onto a shipped, offline-first PWA
**Researched:** 2026-07-19
**Confidence:** HIGH (verified against the installed `packages/app/package.json` and the real reuse-target source files)

## Headline

**Zero new dependencies.** Every piece of Gizz Bingo maps onto something already installed and already load-bearing in the app: CSS Grid (Tailwind 4) for the board, `motion` 12 + the existing `ExploreBackground` bloom layer for celebrations, an additive Dexie `version(5)` for persistence, and the existing `shareCard.ts` canvas pipeline for the shareable result. The vetted design already assumes this reuse (design note lines 102–109); this research confirms it holds against the actual code and calls out the concrete integration seams.

The only genuinely *new* code is a pure `packages/core/src/bingo/` module (card generation + greedy consume-once marking) — a third derivation alongside the existing tally and comet-trail derivations, per the design's "Architecture fit" section. That's core logic, not a stack decision.

## Recommended Stack (all already installed)

### Core Technologies

| Technology | Version | Purpose here | Why (reuse rationale) |
|------------|---------|--------------|-----------------------|
| Tailwind CSS + CSS Grid | 4.3.2 (installed) | The 4×4 board | A bingo grid is the canonical CSS Grid use case: `grid grid-cols-4 gap-*` with 16 square children (center = free space). No layout library earns its bytes here. Square min-size via the existing `min-h-11 min-w-11` tap-floor idiom (see `PredictionOrb.tsx:154`). |
| motion | ^12.42.2 (installed) | Per-square "stamp" pop; first-line/blackout burst choreography | Already the app's animation engine and already reduced-motion-wired via `useReducedMotion` from `motion/react` (see `OrbitStage.tsx:22,119` — `const reduce = useReducedMotion() ?? false`). A spring scale/opacity pop on a square mark, and an orchestrated supernova sequence, are exactly what it's for. Nothing else needed. |
| Dexie | 4.4.4 (installed) | Persist the card (defs + seed + lock timestamp) | Additive `version(5)` migration, identical pattern to the `version(4)` single-table add in `db.ts:233`. `useLiveQuery` (dexie-react-hooks 4.4.0) recomputes marks on every `logSong` — the same reactive seam the tally already uses. |
| react-force-graph-2d | 1.29.1 (installed) | **Not used for Bingo** | Listed only to rule it out: it renders the constellation graph. The per-square "orb stamp" is a styled circular div with a `motion` pop, NOT a force-graph node. Do not pull the bingo celebration into the graph renderer. |

### Supporting Libraries (all already installed — reuse points)

| Library | Version | Reuse for Bingo |
|---------|---------|-----------------|
| `packages/app/src/dex/shareCard.ts` | in-repo | The shareable result image. `buildShareCardFile` (canvas 1080×1350 → PNG File, pre-built before the tap per iOS Pitfall 7) and `shareOrDownload` are reusable verbatim; add a `drawBingoCard(ctx, data, opts)` following the exact `drawShareCard` shape, or branch on a new `scope: "bingo"` in `ShareCardData`. |
| `packages/app/src/dex/ShareCardSheet.tsx` | in-repo | The preview + share bottom-sheet. Its pattern (build File on open, disable the share icon until built, calm failure state) is directly reusable — pass pre-built bingo `data` the same way `RecapView` passes per-show data (prop `data?: ShareCardData`). |
| `packages/app/src/explore/ExploreBackground.tsx` + `styles.css` blooms | in-repo | The supernova backdrop. The design says "reuse constellation galaxy backdrop for the supernova" — this is the radial-gradient bloom layer (`explore-bg-bloom`, blur + drift keyframes gated behind `prefers-reduced-motion: no-preference`). A full-screen `aria-hidden` overlay reusing the same bloom-gradient recipe + a `motion` scale-burst gives the blackout supernova with no new asset and no new dep. |
| `fuse.js` (via core `searchCatalog`) | 7.x (installed in core, imported in `search-catalog.ts`) | The square-swap "search escape hatch" (design line 91). `searchCatalog` is already a pure core function over the 264-node catalog — reuse it; do NOT add a second search lib. |
| motion `useReducedMotion` | from `motion/react` | The a11y gate for BOTH the stamp and the supernova. Already threaded across the app (OrbitStage, ShowView). Reduced-motion path = instant state swap (square just becomes marked; win shows a static badge, no burst). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 4.1.10 (`projects`) | Unit-test the pure bingo core | Card generation + greedy consume-once marking test in the `node` project with fixture setlists + known expected marks (CLAUDE.md testing constraint; mirrors the existing `search-catalog.test.ts`/scoring tests). No jsdom needed for the core logic. |
| jsdom project | Test `drawBingoCard` | Assert the canvas draw against a recorded mock ctx, exactly as `shareCard`'s draw is tested (RESEARCH Pitfall 8 pattern). |

## Installation

```bash
# Nothing. Zero new dependencies.
# All of: Tailwind grid, motion 12, Dexie 4, fuse.js (core), the shareCard
# canvas pipeline, and the ExploreBackground bloom layer are already installed
# and already shipping in v1.1.
```

## Integration Points (named against real files)

1. **Board** — new `packages/app/src/games/BingoBoard.tsx` (or `src/bingo/`): Tailwind `grid grid-cols-4`, 16 cells, center cell = free space. Reuse the `min-h-11 min-w-11 touch-manipulation` tap-floor + rarity-color idiom from `PredictionOrb.tsx`.
2. **Pure core** — new `packages/core/src/bingo/` module: `generateCard(vibe, corpusStats, seed)` and `markCard(card, trail)` (greedy consume-once assignment). Zero React/DOM (core's `lib: ["ES2023"]` enforces it). All constants (event mix ratios, calibration target ≈15 marks, vibe weights) go in `packages/core/src/config.ts` — no magic numbers, per CLAUDE.md.
3. **Reactive marking** — recompute `markCard` inside the GizzGames view via `useLiveQuery` over `db.trackedEntries` for the active `sessionId`, the same seam the running tally already uses. No new sync plumbing (design "Architecture fit").
4. **Persistence** — `packages/app/src/db/db.ts`:
   - Add `interface BingoCard { sessionId: string; squares: BingoSquare[]; seed: number; vibe: BingoVibe; lockedAt: number | null; }` (16 square defs incl. the free center; `lockedAt` = Start-Show timestamp, null while draft/unlocked).
   - `this.version(5).stores({ bingoCards: "&sessionId" })` — additive only, v1–v4 untouched; no `.upgrade` needed (new table has no rows to backfill), identical to the `version(4)` comment at `db.ts:228–235`.
   - Add helpers `saveBingoCard` / `getBingoCard(sessionId)` mirroring the `setMeta`/`getMeta` idiom.
   - **Export round-trip (do not forget):** add `bingoCards: BingoCard[]` to `DbSnapshot` (`db.ts:162`), read it in `snapshot()` (`db.ts:496`), and commit it in `importSnapshot()` (`db.ts:529`). Because a card's `sessionId` FK can be dropped by the same D-11 same-show dedupe that affects `trackedShows`, commit it by **`clear()` + `bulkPut`** inside the existing rw transaction — the same full-replace treatment `trackedShows` gets (`db.ts:545–546`), not a bare upsert.
   - **Pre-show draft nuance:** the card is buildable/reshufflable before a show exists (design line 93), so there's no `sessionId` yet. Store the unlocked draft under a reserved key (e.g. `bingoCards` row keyed by a `"draft"` sentinel, or a `meta` row) and re-key/stamp `lockedAt` on Start Show. This is a design decision for the planner — it needs no new dependency.
5. **Celebrations** — `motion/react` `useReducedMotion` gate (copy the `?? false` pattern from `OrbitStage.tsx:119`). Per-square stamp = `motion` spring scale pop on mark. Supernova = full-screen `aria-hidden pointer-events-none` overlay reusing the `ExploreBackground` bloom-gradient recipe + a `motion` scale/opacity burst; reduced-motion → static win badge, no burst.
6. **Share** — reuse `shareCard.ts` `buildShareCardFile` + `shareOrDownload` and the `ShareCardSheet` sheet; add `drawBingoCard` alongside `drawShareCard`, and either extend `ShareCardData` (core) with a `scope: "bingo"` branch or add a sibling core `buildBingoShareStats`. Keep the Pitfall-7 pre-build-before-tap contract intact.

## Alternatives Considered

| Recommended | Alternative | When the alternative would win (it doesn't here) |
|-------------|-------------|--------------------------------------------------|
| `motion` 12 + CSS bloom for the supernova | `canvas-confetti` (~7 KB gz) | Only if celebration became the *product* with many distinct particle effects. For two moments (first line, blackout) a year, a new dep + its own reduced-motion wiring is unjustified bundle + maintenance cost. |
| `motion` spring pop for the stamp | `react-spring` / `gsap` | Never — `motion` is already installed and is the app-wide convention. A second animation runtime is pure duplication. |
| `shareCard.ts` canvas draw | `html2canvas` / `dom-to-image` | Never here. DOM rasterization is slow, web-font-flaky, and forces async work *before* the share tap — a direct violation of the iOS transient-activation contract (`shareCard.ts` Pitfall 7) the existing pipeline was built to satisfy. |
| CSS Grid | `react-grid-layout` / a table lib | Never — a fixed 4×4 is `grid-cols-4`. Drag/resize/responsive-reflow libs solve problems bingo doesn't have. |
| Dexie `version(5)` additive | new store abstraction / migration framework | Never — the additive `version(n).stores()` pattern is already proven four times in `db.ts`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `canvas-confetti`, `react-confetti`, `tsparticles`, `party.js` | New bundle weight + separate reduced-motion wiring for two moments/year; celebration is flavor, not core | `motion` 12 burst + the existing `ExploreBackground` bloom layer |
| `lottie-web` / `@lottiefiles/*` | Large runtime AND needs bundled JSON animation assets — dead weight in an offline-first PWA whose whole point is a small precached shell | `motion` keyframes/springs (code, not assets) |
| `html2canvas` / `dom-to-image` (to snapshot the live board as the share image) | Slow, font-unreliable, and injects async work before the share tap (breaks iOS transient activation) | `drawBingoCard` on canvas via the existing `buildShareCardFile` path |
| A grid/layout library | Fixed 4×4 needs none | Tailwind `grid grid-cols-4` |
| A second fuzzy-search lib for square-swap | `searchCatalog` (fuse.js) already exists as a pure core fn | Reuse `packages/core/src/search/search-catalog.ts` |
| `zustand`/Redux for bingo state | Marks are *derived* from the trail, not independently mutable — same as the tally | `useLiveQuery` + `markCard` core fn |
| A routing lib for the new GizzGames tab | App uses view-state/tab switching, not path routing (CLAUDE.md "no routing library") | The existing bottom-tab switch pattern (LiveGizz/GizzVerse/GizzDex → +GizzGames) |
| Storing the card in `localStorage` | 5 MB, sync, string-only, worse iOS eviction story | Dexie `bingoCards` + the existing JSON export backstop |

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| motion ^12.42.2 | React 19.2.7 | Already paired and shipping (`OrbitStage`, `ShowView`). `useReducedMotion` from `motion/react`. |
| dexie 4.4.4 + dexie-react-hooks 4.4.0 | React 19 | `version(5)` additive migration is a no-op-risk change; the four prior additive versions establish the pattern. |
| fuse.js (core) | Node + browser, DOM-free | Lives in `packages/core`, keeps core's `lib: ["ES2023"]`/no-React purity — bingo core stays equally pure. |

Because the recommendation adds **no new packages**, there are no new version-resolution risks to verify — every version above is the one already locked in `packages/app/package.json` and validated in v1.1.

## Sources

- `packages/app/package.json` — installed versions (motion ^12.42.2, dexie 4.4.4, dexie-react-hooks 4.4.0, react-force-graph-2d 1.29.1, Tailwind 4.3.2) — HIGH
- `packages/app/src/db/db.ts` — additive versioned-migration pattern (`version(4)` single-table add), `DbSnapshot`/`snapshot()`/`importSnapshot()` export seam, clear+bulkPut full-replace rule — HIGH
- `packages/app/src/dex/shareCard.ts` + `ShareCardSheet.tsx` — reusable canvas→PNG→share pipeline and the iOS Pitfall-7 pre-build contract — HIGH
- `packages/app/src/explore/ExploreBackground.tsx` — the reusable galaxy bloom layer for the supernova, reduced-motion gated — HIGH
- `packages/app/src/show/OrbitStage.tsx` (`useReducedMotion` from `motion/react`) + `PredictionOrb.tsx` — the animation + tap-floor + rarity-color idioms to reuse — HIGH
- `packages/core/src/search/search-catalog.ts` — existing pure fuzzy search for the square-swap escape hatch — HIGH
- `.planning/notes/gizz-bingo-design-vetting.md` (lines 78–113) — the vetted reuse plan this research confirms — HIGH

---
*Stack research for: Gizz Bingo feature (v1.2 milestone)*
*Researched: 2026-07-19*

# Phase 4: Show Mode - Research

**Researched:** 2026-07-09
**Domain:** Offline-first PWA live-tracking UI (React 19 + Dexie/IndexedDB) consuming a frozen prediction core; browser device APIs (Wake Lock, Page Visibility, touch/gesture); deterministic radial layout
**Confidence:** HIGH (codebase-verified for core APIs, Dexie, layout, search; MEDIUM-HIGH for Wake Lock iOS reality — verified via WebKit bug tracker + caniuse)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Show Lifecycle & Attendance (SHOW-11, DEX-01)**
- **D-01:** A show **starts with one tap** ("Start Show") that opens the orbit immediately with **today's date auto-stamped** — no venue picker, no network, no pre-show friction. Venue and `show_id` left blank, reconciled later.
- **D-02:** DEX-01 attendance credited **provisionally, immediately** on show start: write an attendance record keyed by a **local session id + date**, so dex credit for show #1 is never lost even if fully offline. Binding/merging to real kglw.net `show_id` happens in Phase 5/6, matched by date.
- **D-03:** **Exactly one active tracked show at a time.** Force-quit + relaunch **auto-resumes** straight back into it (SHOW-11); finalized shows kept **read-only**. No multi-draft concurrency / show-picker.
- **D-04:** A show ends via an **explicit "End Show" action** (with confirm) that finalizes the setlist to read-only and is **required before starting the next night**. NOT "encore-mark auto-ends."
- **D-05:** Phase 4 persists **date + local session id only** (plus tracked setlist + set structure). Venue label and canonical `show_id` deferred to Phase 5/6.

**What Counts as a "Hit" (SHOW-08, SHOW-09, EVAL-04)**
- **D-06:** A confirmed song is a **hit if it was among the shown orbs** (the 5–8 fan you were looking at); logged via search or "???" = **miss**. The visible fan is the honest denominator. NOT top-1, NOT a fixed top-5 divorced from what rendered.
- **D-07:** The running tally is a **single combined "X/Y (%)" number**, persistently visible (SHOW-09). Underlying data should still let a later recap (Phase 6) decompose free-choice vs hard-segue.
- **D-08:** Logging via **"???" / off-catalog counts as a miss** (red ring, denominator +1).

**Confidence Shown on Orbs (SHOW-01, SHOW-10, EVAL-04)**
- **D-09:** Each orb shows the **model's own absolute-ish confidence score**, not a renormalized share of the fan. Only notated hard segues reach ~100%; an honest free-choice orb topping out ~20–25% is correct.
- **D-10:** When the whole fan is weak (top orb below a ~15% threshold), **soften the fan visually** (mute orbs + subtle "low confidence" hint) rather than rendering falsely-precise. No fake numbers. Exact threshold is Claude's discretion / tunable in config.
- **D-11:** The one-line "why" (SHOW-10) opens via a **separate affordance (info dot / long-press)**, NOT a plain tap — because a plain tap on an orb LOGS it (SHOW-03). Orb face shows song name + %. The `reason` string feeds the detail directly (no new derivation).

**Fan & Always-Visible Controls**
- **D-12:** The fan is **adaptive 5–8 orbs**: always ≥5, up to 8, dropping negligible-score orbs. Radial layout must place a **variable count deterministically**, every orb ≥ ~44px regardless of probability (SHOW-02).
- **D-13:** Persistent controls live in a **fixed thumb-reachable bottom action bar**: Search + "???" primary; set-break / encore / undo secondary. Nothing overlaps the fan.
- **D-14:** Tapping **"???" logs the placeholder immediately** (append + recenter), zero friction. Rename later from the trail.
- **D-15:** **Undo removes the most recent song in one tap**; to fix an older entry, **tap its trail node** to edit/delete.

### Claude's Discretion
- **Matrix-artifact offline loading** — bundle-import vs `?url`+fetch+Workbox precache. `json` is not a Workbox `globPatterns` default. Artifact `data/normalized/transition-matrix.json` (~590 KB) is small enough to bundle.
- **Set-structure serialization** — mirror kglw.net's `setnumber`/`"e"` encoding per `docs/SCHEMA.md`; local schema shape is discretion but must be additive to Dexie via `version(2)`.
- **Wake lock** implementation + feature-detection fallback; gesture-suppression specifics.
- **Radial layout math** (probability → distance/size/angle) and comet-trail "+N" compression/expansion — subject to `/gsd-ui-phase` (already run: 04-UI-SPEC.md).
- **Confidence threshold + weak-fan cutoff** exact values (D-10/D-12) — in app/core config, tunable.
- Internal component decomposition, Dexie `version(2)` migration wiring, app-level tests following the Vitest `projects` pattern.

### Deferred Ideas (OUT OF SCOPE)
- Live `latest` polling + editor-suggestion auto-fill (Phase 5, SYNC-01/02/03).
- JSON export/import (Phase 5, PWA-04).
- Binding a tracked show to a real `show_id` + venue, retroactive attendance (Phase 5/6, DEX-02).
- Post-show recap view + rarity score (Phase 6, SHOW-14/STAT-02).
- Pokédex UI, sighting counts, stats (Phase 6). Explore constellation (Phase 7).
- Free-choice vs hard-segue tally split (one combined number live; underlying data supports later decomposition).
- Suppress the update toast during an active tracked show (belt-and-suspenders; Phase 3 D-06 deferred).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOW-01 | Center song + top 5–8 orbs sized/placed by probability, tuning-family colored, % on orb | `predict()` returns ranked `PredictionCandidate[]` with `score` (absolute %) + `MatrixNode.tuningFamily` (color). Deterministic layout §Pattern 3. |
| SHOW-02 | Deterministic radial layout (no force sim); tap targets never move; ≥44px orbs | Rank→angle, score→radius pure function §Pattern 3; ORB_MIN_DIAMETER=56 / 44px hit floor. |
| SHOW-03 | Tap orb → recenter + append to trail + recompute | Reassemble `ShowContext` from Dexie entries, re-call `predict()` §Pattern 2. |
| SHOW-04 | Always-visible fuzzy search over full catalog; misses as fast as hits | **New** core `searchCatalog()` wrapping fuse.js over the 264 matrix nodes §Pattern 4. |
| SHOW-05 | Always-visible "???" logs placeholder, renamable later | Write a placeholder `trackedEntry` (isPlaceholder=true, songId=null) §Pattern 5. |
| SHOW-06 | Mark set breaks + encore; serialize set structure round-tripping kglw.net | Store `setNumber: "1"\|"2"\|"e"` (exact core `SetNumber` union) per entry §Pattern 6. |
| SHOW-07 | Undo/edit a wrong entry in one tap | Undo = delete max-position entry; edit = trail-node sheet §Pattern 5. |
| SHOW-08 | Comet trail last ~4 diminishing nodes + hit/miss rings + "+N" at 30+ | `useLiveQuery` over entries; store per-entry `outcome` §Pattern 5. |
| SHOW-09 | Persistent running hit/miss tally | Derived aggregate via `useLiveQuery` §Pattern 5. |
| SHOW-10 | One-line "why" per orb + tappable detail | `PredictionCandidate.reason` rendered verbatim (no new derivation) §Standard Stack. |
| SHOW-11 | Write-through to IndexedDB immediately; exact restore on relaunch | Await `db.trackedEntries.add()` per confirmed song; resume from active show row §Pattern 1. |
| SHOW-12 | Wake lock held + reacquired on visibility change + fallback messaging | Wake Lock API + `visibilitychange`; **iOS installed-PWA caveat** §Pitfall 1. |
| SHOW-13 | Dark theme, fat targets, accidental-gesture suppression | `touch-action`, `overscroll-behavior`, `user-select` §Pattern 7. |
| EVAL-04 | If free-choice top-5 < ~25%, surface wider framing | Global branch is **dormant** (backtest = 68.6%); realized as per-moment weak-fan softening (D-10) §Pattern 8. |
| DEX-01 | Live-tracked show auto-counts as attended (credit not lost) | Provisional attendance = the tracked-show row itself, date-keyed §Pattern 1. |
</phase_requirements>

## Summary

Phase 4 is the first real consumer of the frozen Phase 2 core and the Phase 3 PWA shell. **Almost no new domain logic is required** — `predict()` already returns everything the orbit needs (`score` for the %, `factors` for softening, `reason` for the "why", `tuningFamily` for color), fully ranked. The work is overwhelmingly UI wiring plus three genuinely new pieces: (1) a pure `searchCatalog()` in core wrapping fuse.js, (2) an additive Dexie `version(2)` schema for the tracked setlist + provisional attendance, and (3) the browser-API integrations (Wake Lock, gesture suppression, deterministic radial layout).

The single highest-risk finding: **the Screen Wake Lock API was broken in installed iOS Home-Screen PWAs until iOS/iPadOS 18.4** (WebKit bug 254545, fixed 2025). Feature detection (`'wakeLock' in navigator`) returns `true` on iOS 16.4–18.3 installed PWAs but the lock silently fails — exactly the STATE.md-flagged spike. SHOW-12's fallback messaging is therefore not a nicety; it is the primary path for any friend on an older iPhone running Guezzer as an installed PWA. Plan a real-iPhone spike on the oldest device in the friend group early in the phase.

The score-scale question (D-09) is fully resolved from source: `PredictionCandidate.score` is an **absolute-ish confidence in `[0, 0.97]`**, NOT a normalized share of the fan — display it directly as `round(score*100)%`. Only a consistency-gated hard segue is pinned to the 0.97 ceiling; free-choice orbs top out ~0.20–0.25 by design.

**Primary recommendation:** Bundle the matrix JSON into the app via a Vite `resolve.alias` (offline-complete for free, no Workbox `json` glob needed), build `MatrixIndex` once on mount, drive the whole orbit off `predict()` + Dexie `useLiveQuery`, and treat the tracked-show row as both the setlist container and the provisional-attendance record. Structure plans as vertical slices: get tap→log→persist→restore working end-to-end (one orb, one entry, reload) before layering search, set structure, trail compression, wake lock, and softening.

## Architectural Responsibility Map

Guezzer has no backend. The relevant tiers are **Core (pure TS, zero DOM)**, **App logic (React/pure app helpers)**, **Browser API**, and **Storage (Dexie/IndexedDB)**. Strict rule: App imports Core, never the reverse.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prediction scoring (orb %, reason, factors) | Core (`predict`) | — | Frozen Phase 2 API; pure, zero DOM. App only assembles `ShowContext` + renders. |
| Fuzzy catalog search (SHOW-04) | Core (`searchCatalog`) | — | CLAUDE.md constraint — fuse.js wrapped in core, testable from Node, swappable. |
| Deterministic radial layout (SHOW-01/02) | App (pure helper) | — | Presentation geometry; needs viewport px. Pure + unit-testable, but not a domain concern. |
| Set-structure serialization (SHOW-06) | Storage schema | Core types | Uses core's `SetNumber` union for round-trip fidelity; persisted shape is app-owned. |
| Write-through + restore (SHOW-11) | Storage (Dexie) | App logic | IndexedDB via Dexie; `useLiveQuery` makes trail/tally reactive. |
| Provisional attendance (DEX-01) | Storage (Dexie) | App logic | The tracked-show row is the attendance record; reconciliation deferred. |
| Wake lock (SHOW-12) | Browser API | App logic | `navigator.wakeLock` + `visibilitychange`; app owns fallback UI state. |
| Gesture suppression (SHOW-13) | App (CSS) | — | `touch-action`/`overscroll-behavior`/`user-select` on the stage + controls. |
| Confidence softening (D-10/EVAL-04) | App logic | Core `score` | App reads `candidates[0].score` vs config threshold; core supplies the number. |

**Boundary flags:** `searchCatalog` MUST live in `packages/core` (fuse.js is a core dependency, not app). The radial-layout helper and all Dexie/Wake-Lock code MUST stay in `packages/app` (they touch viewport/DOM/browser). Nothing in this phase should import React or `window` into core.

## Standard Stack

### Core (all already locked in CLAUDE.md and installed unless noted)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.7 | UI | Locked. Installed in `@guezzer/app`. |
| Dexie | 4.4.4 | IndexedDB wrapper | Locked. Additive `version(2)` for tracked setlist. Installed. |
| dexie-react-hooks | 4.4.0 | `useLiveQuery` | Reactive trail/tally straight from IndexedDB. Installed. |
| fuse.js | 7.4.2 | Fuzzy catalog search | **NEW install — add to `packages/core`, NOT app.** Wrapped behind `searchCatalog()`. Verified on npm (published 2026-06-05). |
| lucide-react | 1.23.0 | Icons | Installed. Show Mode icon set enumerated in 04-UI-SPEC §Design System. |
| Tailwind CSS | 4.3.2 | Styling | Installed via `@tailwindcss/vite`. Theme tokens in `styles.css`. |

### Supporting / conditional
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion | 12.42.2 | Recenter choreography | **Only if** CSS transitions on the orb re-layout prove insufficient (04-UI-SPEC: start with CSS). Not required to ship the slice. |
| fake-indexeddb | 6.2.5 | IndexedDB under jsdom for tests | **Already installed + wired** in `packages/app/test/setup.ts` (`import "fake-indexeddb/auto"`). No new install. |

### NOT needed this phase (avoid scope creep)
- **react-force-graph-2d / d3-force** — Phase 7 (constellation) only. Show Mode's radial layout is pure math; a force sim is explicitly forbidden (CLAUDE.md, SHOW-02).
- **A routing library** — hash routing already exists (`useHashRoute`). Show Mode mounts under `#/show`.
- **zod for the matrix at runtime** — optional single `schemaVersion === 1` guard is enough; the artifact is build-frozen and trusted.

**Installation (the only new package):**
```bash
# fuse.js goes in packages/core (pure JS, keeps the search wrapper testable from Node)
pnpm --filter @guezzer/core add fuse.js@7.4.2   # or: npm i -w @guezzer/core fuse.js@7.4.2
```

**Version verification:** `npm view fuse.js version` → `7.4.2`, `time.modified` → `2026-06-05`. Matches the CLAUDE.md locked stack exactly. [VERIFIED: npm registry]

## Package Legitimacy Audit

> slopcheck was not installed in this session (no network install attempted); fuse.js is a CLAUDE.md-locked, long-established package with a known source repo, verified directly on the registry.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| fuse.js | npm | ~8 yrs (7.4.2 pub 2026-06-05) | multi-million/wk | github.com/krisk/Fuse | not run | Approved — CITED from CLAUDE.md locked stack + registry-verified |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

fuse.js is `[CITED: CLAUDE.md locked stack]` + `[VERIFIED: npm registry]` (name originates from the authoritative project spec, not from model guessing). No planner checkpoint required, though a `pnpm install` verification step is prudent.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── APP MOUNT (#/show) ───────────────────────┐
                    │                                                                    │
 transition-        │   ShowView (useLiveQuery: active tracked show + entries)           │
 matrix.json  ──────┼──▶ buildMatrixIndex(matrix)  ── once, memoized ──┐                 │
 (bundled via       │                                                   │                 │
  Vite alias)       │   ┌─────────────── recenter cycle ───────────────▼──────────┐      │
                    │   │ assemble ShowContext                                     │      │
                    │   │   { currentSongId, trail[], recentShowSongSets[][] }     │      │
                    │   │        │                                                 │      │
                    │   │        ▼                                                 │      │
   packages/core ───┼───┼──▶ predict(matrix, ctx) ─▶ PredictionCandidate[]         │      │
   (pure, no DOM)   │   │        │  (score, reason, factors, tuningFamily)         │      │
                    │   │        ▼                                                 │      │
                    │   │  drop <ORB_DROP_SCORE, clamp 5–8 (D-12)                  │      │
                    │   │        │                                                 │      │
                    │   │        ▼                                                 │      │
                    │   │  layoutOrbs(candidates, stagePx)  (pure, app)            │      │
                    │   │        │                                                 │      │
                    │   │        ▼   OrbitStage ── CenterNode + PredictionOrb×N     │      │
                    │   └────────┼─────────────────────────────────────────────────┘      │
                    │            │ tap orb (hit) / Search (miss) / ??? (miss)              │
                    │            ▼                                                          │
                    │   write-through: db.trackedEntries.add({ ...,outcome,setNumber })    │
   Dexie v2 ────────┼──▶ IndexedDB ──(useLiveQuery)──▶ CometTrail + TallyReadout ──────────┤
   (trackedShows,   │            ▲                                                          │
    trackedEntries) │            └── relaunch: resume active show, rebuild ctx (SHOW-11)    │
                    │                                                                        │
 Browser APIs ──────┼──▶ WakeLock (visibilitychange reacquire) · gesture CSS · safe-area    │
                    └────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)
```
packages/core/src/
└── search/
    └── search-catalog.ts   # NEW: searchCatalog(query, catalog) wrapping fuse.js; pure, zero DOM
                            # export from index.ts barrel

packages/app/src/
├── show/                    # NEW: all Show Mode UI + logic
│   ├── ShowView.tsx         # root; branches pre-show / active / finalized (D-03)
│   ├── PreShowLauncher.tsx  # Start Show (D-01/D-02)
│   ├── OrbitStage.tsx       # center + fan; adaptive count; softening
│   ├── CenterNode.tsx
│   ├── PredictionOrb.tsx    # tap=log hit; Info dot=why (D-11)
│   ├── CometTrail.tsx       # last ~4 + "+N"; hit/miss rings
│   ├── TallyReadout.tsx
│   ├── ActionBar.tsx        # Search/??? + Set break/Encore/Undo (D-13)
│   ├── SearchSheet.tsx      # core searchCatalog; select=log miss
│   ├── WhyDetail.tsx        # PredictionCandidate.reason verbatim
│   ├── TrailNodeSheet.tsx   # edit/delete/rename (D-15/D-14)
│   ├── EndShowDialog.tsx    # finalize confirm (D-04)
│   ├── WakeLockNotice.tsx   # SHOW-12 fallback
│   ├── orbitLayout.ts       # NEW pure helper: rank→angle, score→radius/size (SHOW-02)
│   ├── matrix.ts            # load + buildMatrixIndex once, schemaVersion guard
│   ├── showContext.ts       # assemble ShowContext from Dexie entries
│   └── useShowSession.ts    # useLiveQuery hooks: active show, entries, tally, predictions
├── db/
│   └── db.ts                # EXTEND with version(2).stores({ trackedShows, trackedEntries })
└── wakeLock.ts              # NEW: acquire/reacquire/release helper (browser API)
```

### Pattern 1: Additive Dexie `version(2)` + single-active-show + provisional attendance (SHOW-11, DEX-01, D-02/D-03)

**What:** Grow the DB without touching `version(1)`. The tracked-show row doubles as the provisional attendance record (D-02/D-05 — date + local session id only).

```typescript
// packages/app/src/db/db.ts — ADD, never rewrite version(1)
export type ShowStatus = "active" | "finalized";
export type SetNumber = "1" | "2" | "e";            // mirrors core domain SetNumber
export type EntryOutcome = "hit" | "miss";

export interface TrackedShow {
  sessionId: string;        // crypto.randomUUID() — local, stable; the provisional attendance key (D-02)
  date: string;             // ISO YYYY-MM-DD, auto-stamped on Start (D-01)
  status: ShowStatus;       // exactly one "active" at a time (D-03)
  currentSetNumber: SetNumber; // "1" at start; Set break → "2"; Encore → "e" (SHOW-06)
  startedAt: number;        // Date.now()
  showId: number | null;    // reconciliation seam for Phase 5/6 (D-05) — always null in Phase 4
}

export interface TrackedEntry {
  id?: number;              // ++ auto-increment
  sessionId: string;        // FK → TrackedShow.sessionId (indexed)
  position: number;         // global contiguous 1..N across the whole show incl. encore (SCHEMA §3)
  songId: number | null;    // null for a "???" placeholder (D-14)
  songName: string;         // "???" for placeholder; renamable (D-15)
  setNumber: SetNumber;     // snapshot of currentSetNumber at log time (SHOW-06)
  outcome: EntryOutcome;    // hit if it was in the shown fan (D-06); miss for search/??? (D-08)
  shownFanSongIds: number[];// the orbs on screen when logged — supports D-06 + Phase 6 recap decomposition (D-07)
  isPlaceholder: boolean;   // true for "???" (D-14)
  loggedAt: number;
}

// in the GuezzerDB constructor, AFTER this.version(1)... :
this.version(2).stores({
  trackedShows: "&sessionId, status, date",       // query active by status; match by date later
  trackedEntries: "++id, sessionId, [sessionId+position]",
  // meta + attendedShows carry forward untouched — do NOT re-declare them.
});
```

- **Single-active invariant (D-03):** before `Start Show`, assert no `trackedShows` row has `status === "active"` (End Show is required first, D-04). Query: `db.trackedShows.where("status").equals("active").first()`.
- **Restore/auto-resume (SHOW-11):** on `ShowView` mount, `useLiveQuery(() => db.trackedShows.where("status").equals("active").first())`. If present → active orbit; entries via `useLiveQuery(() => db.trackedEntries.where("sessionId").equals(id).sortBy("position"))`. If absent → pre-show launcher.
- **DEX-01:** dex credit = existence of the tracked-show row (date-keyed). Reconciling to a real `show_id` by date is Phase 5/6; the credit lives in `trackedShows`, never lost offline. No separate provisional-attendance table needed (keeps it lean per D-05).

**Confidence:** HIGH — matches the documented `version(2)` hook comment in `db.ts:44-48` and the core `SetNumber` union (`"1"|"2"|"e"`, confirmed closed by full-corpus census, SCHEMA §13a).

### Pattern 2: Assemble `ShowContext` and re-predict on every recenter (SHOW-03)

**What:** The predictor is stateless; the app rebuilds `ShowContext` from persisted entries each cycle.

```typescript
// showContext.ts — pure assembly from Dexie entries (app side)
import type { ShowContext } from "@guezzer/core";

export function buildShowContext(
  currentSongId: number,
  entries: TrackedEntry[],           // this show, ordered by position
  recentFinalizedShows: number[][],  // song-id sets of prior finalized tracked shows this tour
): ShowContext {
  return {
    currentSongId,
    trail: entries.filter(e => e.songId != null).map(e => e.songId as number),
    recentShowSongSets: recentFinalizedShows,   // see note below
  };
}

// predictions.ts
import { predict, buildMatrixIndex } from "@guezzer/core";
// index built ONCE on mount (buildMatrixIndex is O(nodes+edges)); predict() itself
// re-builds the index internally, so for hot recenters prefer scoreCandidate-over-a-shared-index
// if profiling shows predict()'s per-call rebuild is too slow. For 264 nodes it is trivial (<5ms).
const candidates = predict(matrix, ctx);        // already sorted desc by score
```

- **`recentShowSongSets` insight (rotation suppression, MODL-06):** the bundled matrix is as-of 2025-12-13, so it contains **zero** 2026-tour shows. For show #1, `recentShowSongSets = []` → `rotationSuppression` is neutral (`0.5^0 = 1`). **Emergent value:** because the friend group tracks *several consecutive nights of the same tour*, once night 1 is finalized its song-id set can feed night 2's `recentShowSongSets`, giving real cross-night rotation suppression with no model changes. Query prior finalized `trackedShows` (optionally same-tour by date proximity) and pass their entry song-id arrays. This is a genuine feature, not a workaround — flag it to the planner as a nice-to-have for the slice (night-1 works with `[]`; multi-night suppression is additive).
- **Performance note:** `predict()` calls `buildMatrixIndex(matrix)` internally on every call (`predict.ts:488`). At 264 nodes this is fine, but if recenter latency is ever felt, the app can precompute the index once and score against it. Not a slice blocker.

**Confidence:** HIGH — verified against `predict.ts` and `ShowContext` in `domain/types.ts:196-201`.

### Pattern 3: Deterministic radial layout (SHOW-01/02, D-12)

**What:** A pure function mapping ranked candidates → fixed angle + score-scaled radius/size. No physics; positions are a pure function of `(rank, score, count, stagePx)` so tap targets never drift between repredicts. 04-UI-SPEC §Layout ratifies the contract; this is the concrete math.

Key separation (D-09): the **displayed % is the absolute `score`**; the **geometry** (radius/diameter) uses within-fan relative scaling so the layout reads sensibly even when all scores are small.

```typescript
// orbitLayout.ts (app, pure, unit-tested)
interface OrbLayout { songId: number; x: number; y: number; diameterPx: number; }

export function layoutOrbs(
  candidates: { songId: number; score: number }[], // 5–8, sorted desc
  stage: { width: number; height: number },
  cfg: { orbMinDiameter: number; orbMaxDiameter: number; ringInsetPx: number },
): OrbLayout[] {
  const n = candidates.length;
  const cx = stage.width / 2, cy = stage.height / 2;
  const top = candidates[0].score;
  const min = candidates[n - 1].score;
  const span = Math.max(top - min, 1e-6);          // guard equal-score divide-by-zero
  const rMax = Math.min(cx, cy) - cfg.ringInsetPx; // outer bound keeps orbs off notches/edges
  const rMin = rMax * 0.42;                         // inner bound clears the center node
  return candidates.map((c, i) => {
    // angle: even by RANK, rank 0 at top (-90°). Deterministic; independent of score value.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    // radius: higher score → nearer center (rank/score both monotonic; use score for smoothness)
    const t = (top - c.score) / span;               // 0 for top, 1 for weakest
    const r = rMin + t * (rMax - rMin);
    // diameter: higher score → larger, clamped to the ≥56px visual / ≥44px hit floor
    const dia = Math.max(cfg.orbMinDiameter, cfg.orbMaxDiameter - t * (cfg.orbMaxDiameter - cfg.orbMinDiameter));
    return { songId: c.songId, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), diameterPx: dia };
  });
}
```

- **≥44px guarantee (SHOW-02):** `orbMinDiameter` defaults 56 (04-UI-SPEC), never below the 44px hit floor regardless of score. Enforce with `min-h-11 min-w-11` on the element too.
- **Overlap avoidance:** even angular spacing at `n ≤ 8` on a phone stage with `rMin ≈ 0.42·rMax` keeps arc spacing `2πr/n` comfortably above 56px for typical stage sizes. If a specific device shows crowding, drop to `n` at the low end (D-12 allows 5) or split into two concentric rings by rank — deterministic either way. Validate on the smallest target device.
- **Animate position, never physics:** CSS `transition: transform` on re-layout (04-UI-SPEC §Motion); respect `prefers-reduced-motion`. Positions are recomputed deterministically, not simulated.

**Confidence:** HIGH for the approach (04-UI-SPEC ratifies it; it is standard trig). MEDIUM on exact `rMin`/ring-split constants — tune on-device.

### Pattern 4: `searchCatalog()` in core wrapping fuse.js (SHOW-04)

**What:** A pure, DOM-free fuzzy search over the catalog, in `packages/core`, so it is Node-testable and swappable (CLAUDE.md). **Does not exist yet** — must be created. The catalog is the 264 `MatrixNode`s (each carries `songId` + `songName`); no separate catalog source is needed.

```typescript
// packages/core/src/search/search-catalog.ts
import Fuse from "fuse.js";
import type { MatrixNode } from "../domain/types.ts";

export interface CatalogEntry { songId: number; songName: string; }
export interface SearchResult { songId: number; songName: string; score: number; }

export function toCatalog(nodes: MatrixNode[]): CatalogEntry[] {
  return nodes.map(n => ({ songId: n.songId, songName: n.songName }));
}

// Build the Fuse index once (caller memoizes), then query many times.
export function makeCatalogSearcher(catalog: CatalogEntry[]) {
  const fuse = new Fuse(catalog, {
    keys: ["songName"],
    threshold: 0.4,          // typo tolerance for dark-thumb entry; tune in config
    distance: 100,
    ignoreLocation: true,
    includeScore: true,
  });
  return (query: string): SearchResult[] =>
    query.trim() === ""
      ? []
      : fuse.search(query).map(r => ({ songId: r.item.songId, songName: r.item.songName, score: r.score ?? 1 }));
}
```

- Export `toCatalog`, `makeCatalogSearcher`, and the types from `packages/core/src/index.ts` (barrel).
- fuse.js has zero DOM/browser deps — it belongs in core and keeps core's `"lib": ["ES2023"]`/no-React purity intact.
- Threshold/distance are tunables → mirror into config (core `config.ts` search block, or app config if only the UI tunes it; core is the natural home since the function lives there).
- 04-UI-SPEC: search field must be ≥16px (`Body`) to avoid iOS form-zoom; the miss path must feel as fast as a hit tap (no confirm — selecting a result logs a miss + recenters immediately).

**Confidence:** HIGH — fuse.js API verified; core purity confirmed against `packages/core/package.json` (only `zod` today).

### Pattern 5: Write-through logging, undo, edit, tally (SHOW-05/07/08/09/11)

**What:** Every confirmed song is an immediate awaited Dexie write; the UI re-renders reactively from IndexedDB via `useLiveQuery` (no hand-synced React state for the trail/tally).

```typescript
// log a hit (tap orb) or miss (search/???); position is next contiguous integer
async function logSong(sessionId: string, entry: Omit<TrackedEntry,"id"|"sessionId"|"position">) {
  await db.transaction("rw", db.trackedEntries, async () => {
    const count = await db.trackedEntries.where("sessionId").equals(sessionId).count();
    await db.trackedEntries.add({ ...entry, sessionId, position: count + 1 });
  });
}
// undo (D-15): delete the max-position entry, one tap, no dialog
async function undoLast(sessionId: string) {
  const last = await db.trackedEntries.where("sessionId").equals(sessionId).last(); // last() = highest key; verify order by position
  if (last?.id != null) await db.trackedEntries.delete(last.id);
}
```

- **Tally (SHOW-09, D-07):** derive with `useLiveQuery`: `hits = entries.filter(e => e.outcome==="hit").length; total = entries.length`. Render `{hits}/{total} · {pct}%` (04-UI-SPEC). Zero-state `0/0 · —`.
- **Comet trail (SHOW-08):** `useLiveQuery` sorted by position; show last `TRAIL_VISIBLE_RECENT` (4) diminishing; when `total ≥ TRAIL_COMPRESS_AT` (30) collapse the overflow into a tappable "+N" opening a scrollable full-setlist sheet. Hit/miss ring color from `outcome` (green/red, 04-UI-SPEC §B2).
- **Edit older / rename ??? (D-14/D-15):** tap a trail node → `TrailNodeSheet`; delete requires confirm ("Delete this song?"), then tally recomputes automatically (it is derived). Rename ??? reuses `SearchSheet` and patches `songId`/`songName`/`isPlaceholder`.
- **Position after delete:** deletion leaves a gap in `position`. Either (a) treat position as sort-only and never require contiguity in-app (simplest, still round-trips fine since kglw.net export re-numbers on group), or (b) re-number in the same transaction. Recommend (a) for the slice; document that export (Phase 5) re-derives contiguous positions per SCHEMA §3.

**Confidence:** HIGH — Dexie/`useLiveQuery` are the established Phase 3 pattern; `fake-indexeddb` already wired for tests.

### Pattern 6: Round-trippable set structure (SHOW-06)

**What:** Store `setNumber` per entry using the **exact** kglw.net-derived union `"1" | "2" | "e"` (core `SetNumber`, confirmed the complete closed vocabulary by the full-corpus census — no `"3"` exists anywhere 2010–2026, SCHEMA §13a). Set membership comes only from `setNumber`; `position` is global/contiguous across the whole show including encore (SCHEMA §3/§5). This is exactly kglw.net's own encoding, so the tracked show round-trips by construction.

- **Set break action** → `currentSetNumber: "1" → "2"` on the tracked-show row; subsequent entries snapshot `"2"`.
- **Encore action** → `currentSetNumber → "e"`; subsequent entries snapshot `"e"`. Does NOT end the show (D-04).
- **Never** infer structure from `transition_id`/`transition` display strings — the census proved terminal markers (ids 4/5/6) are used inconsistently by editors across every era (SCHEMA §4/§13b). Phase 4 doesn't ingest those anyway; it authors `setNumber` directly.
- Optional: capture `transitionKind` per entry only if a later export wants segue notation; not required for SHOW-06. Defer.

**Confidence:** HIGH — union and encoding verified in `domain/types.ts:48` + `docs/SCHEMA.md`.

### Pattern 7: Gesture suppression (SHOW-13)

**What:** CSS-only suppression on the orbit stage + action bar so a fat thumb never scrolls, zooms, selects text, or rubber-bands.

```css
/* orbit stage + action bar */
.orbit-stage, .action-bar {
  touch-action: manipulation;      /* kills 300ms double-tap-zoom + double-tap gesture */
  overscroll-behavior: none;       /* no pull-to-refresh, no scroll chaining */
  user-select: none;               /* -webkit-user-select: none; too for iOS */
  -webkit-user-select: none;
  -webkit-touch-callout: none;     /* iOS: suppress long-press callout menu */
}
/* prevent the whole app rubber-banding; the stage does not scroll at all */
html, body { overscroll-behavior-y: none; }
```

- Viewport already good: `index.html` has `viewport-fit=cover` + `initial-scale=1.0`. iOS ignores `user-scalable=no`, so pinch-zoom can't be fully blocked by meta — `touch-action: manipulation` handles double-tap zoom, which is the realistic accidental gesture. Pinch is a two-finger deliberate action, low risk for one-thumb use.
- The orbit stage should be a **non-scrolling** fixed region (the comet trail strip scrolls horizontally; the stage itself never scrolls). Note `AppShell`'s `<main class="... overflow-y-auto">` — Show Mode's stage should opt out of that scroll (fixed-height stage) or the whole layout should be reworked so the stage is a flex child that doesn't overflow. Flag to planner: reconcile the stage's no-scroll requirement with `AppShell`'s scrolling `<main>`.
- Long KGLW titles + `env(safe-area-inset-*)` already handled in `styles.css`/`AppShell`; keep the action bar above the home-indicator inset (04-UI-SPEC).

**Confidence:** HIGH for the techniques; MEDIUM on the AppShell scroll reconciliation (needs a small layout decision).

### Pattern 8: Honest confidence framing (EVAL-04, D-09/D-10)

- **Score is absolute, display directly.** `round(score*100)%`; if it rounds to 0 on a shown orb, render `<1%` (04-UI-SPEC) — never a bare `0%`.
- **Global wide-framing branch is DORMANT.** Backtest free-choice top-5 = 68.6% ≫ 25%, so EVAL-04's global "<25% → wider framing" never fires. Its real expression in Show Mode is the **per-moment weak-fan softening** (D-10): if `candidates[0].score < WEAK_FAN_THRESHOLD` (0.15), reduce orb fill opacity (~55%) + desaturate + show the muted "Low confidence · Wide-open moment" hint. The honest small % still renders — no fake numbers.
- No renormalization anywhere. Do not divide orb scores by the fan sum.

**Confidence:** HIGH — score range derived from source (see Common Pitfalls / score-scale below); backtest figure from Phase 2 CONTEXT.

### Anti-Patterns to Avoid
- **Renormalizing orb % to sum to 100% across the fan** — violates D-09; makes a free-choice moment look certain. Show absolute `score`.
- **Force simulation / physics for orb placement** — forbidden (CLAUDE.md, SHOW-02). Use the pure `layoutOrbs`.
- **Trusting `'wakeLock' in navigator` as "it works"** — false-positive on iOS 16.4–18.3 installed PWAs (see Pitfall 1). Verify the lock actually held.
- **Hand-syncing trail/tally React state alongside Dexie** — use `useLiveQuery`; the DB is the single source of truth (write-through requirement, SHOW-11).
- **Inferring set/show boundaries from `transition_id`** — proven unreliable across all eras (SCHEMA §4/§13b). Author `setNumber` directly.
- **Rewriting Dexie `version(1)`** — additive `version(2)` only (`db.ts:44-48`).
- **Putting fuse.js/search in the app** — breaks the core/UI separation; it belongs in core.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy song matching | Levenshtein / custom ranker | fuse.js via core `searchCatalog` | Tuned typo tolerance, sub-ms on 264 strings, swappable (CLAUDE.md). |
| Reactive trail/tally from IndexedDB | Manual `useEffect` + `getAll` + state | `useLiveQuery` (dexie-react-hooks) | Auto re-render on write; no stale-state bugs; write-through-safe. |
| Prediction %, "why", factors | Any scoring in the UI | `predict()` → `PredictionCandidate` | Frozen Phase 2 API already returns `score`/`reason`/`factors`/`tuningFamily`. Zero rework. |
| IndexedDB schema/migration | Raw IndexedDB `onupgradeneeded` | Dexie `version(2).stores()` | Additive migration, typed tables, transactions (CLAUDE.md). |
| Keeping the screen awake | setInterval video hack / NoSleep.js | Screen Wake Lock API + reacquire | Native, battery-honest; fallback message covers the gap (Pitfall 1). |
| Double-tap-zoom / pull-refresh suppression | JS `preventDefault` on touch | `touch-action` + `overscroll-behavior` CSS | Declarative, no passive-listener footguns. |
| IndexedDB under test | Mock DB | `fake-indexeddb/auto` (already wired) | Real Dexie code path under jsdom; restore tests are genuine. |

**Key insight:** Phase 4 is ~90% wiring existing capabilities. The only genuinely new *logic* is `searchCatalog` (thin fuse.js wrap), the `layoutOrbs` trig helper, and the Dexie `version(2)` schema. Everything else is React composition over `predict()` + `useLiveQuery` + two browser APIs.

## Common Pitfalls

### Pitfall 1: Wake Lock silently fails in installed iOS PWAs before iOS 18.4 (SHOW-12) — HIGHEST RISK
**What goes wrong:** On an iPhone running Guezzer as an installed Home-Screen PWA on iOS/iPadOS **16.4 through 18.3**, `'wakeLock' in navigator` is `true` and `navigator.wakeLock.request('screen')` may resolve, but the lock **does not actually hold** — the screen still dims/sleeps. WebKit bug 254545, fixed only in **iOS/iPadOS 18.4** (2025). In a Safari *tab* it works from 16.4; the break was specific to installed PWAs — which is exactly how this app is meant to run at a show.
**Why it happens:** Long-standing WebKit defect in the standalone-display code path.
**How to avoid:**
1. Feature-detect AND verify: after `request()`, confirm the returned sentinel is live and did not immediately fire `release`. Treat an immediate release or a rejection as "unsupported here."
2. Wrap in try/catch; on any failure show `WakeLockNotice` ("Keep your screen on manually…", muted, dismissible, once per show — 04-UI-SPEC copy).
3. **Do a real-iPhone spike early** on the oldest iOS in the friend group (STATE.md blocker). Test *installed PWA*, not just the browser tab.
4. Consider nudging users to set a long auto-lock, or (defensive, optional) a hidden looping muted `<video>` fallback only if the friend group actually has pre-18.4 devices — but don't build it speculatively.
**Warning signs:** Screen sleeps mid-show despite "wake lock acquired"; `request()` resolves then `sentinel.released === true` almost immediately.

```typescript
// wakeLock.ts — standard acquire + reacquire pattern
let sentinel: WakeLockSentinel | null = null;
export async function acquireWakeLock(onUnsupported: () => void) {
  if (!("wakeLock" in navigator)) return onUnsupported();
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; });
  } catch { onUnsupported(); }          // NotAllowedError / installed-PWA failure
}
// reacquire when returning to the show (iOS releases on background/visibility change)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && sentinel === null && showIsActive) {
    void acquireWakeLock(showFallbackOnce);
  }
});
```

### Pitfall 2: Misreading the score scale (D-09) — resolved
**What goes wrong:** Assuming `score` is a probability that sums to 1 across the fan, then renormalizing → falsely-confident orbs.
**Root cause / truth (verified in `predict.ts`):** `score = min(base·rotation·alreadyPlayed·eraPrior, hardSegueOverrideCeiling)`; a gated hard segue is pinned to `hardSegueOverrideCeiling = 0.97`. So **`score ∈ [0, 0.97]`, absolute-ish, NOT fan-normalized.** Free-choice tops ~0.20–0.25; only a consistency-gated notated segue reaches ~0.97. Returned candidates do **not** sum to 1.
**How to avoid:** Display `round(score*100)%` directly (D-09). Weak-fan check is `candidates[0].score < 0.15` (D-10). "Why" = `PredictionCandidate.reason` verbatim (already built: e.g. `"notated segue 14/15 times since 2024"`, `"seen 8× since 2024"`, `"backoff: base play rate"`).

### Pitfall 3: Tuning-family color map must cover all four union values, not the three in the UI-SPEC table
**What goes wrong:** 04-UI-SPEC §B1 lists three families and labels one `"C# standard"`, but the core union is `["standard", "cs-standard", "microtonal", "other"]` (`tuning-tags.ts:25`). The **actual matrix data currently contains only `standard` (247) and `microtonal` (17)** — no `cs-standard`, no `other`. The label mismatch (`"C# standard"` vs the real value `"cs-standard"`) will silently fail a `switch`/lookup.
**How to avoid:** Map all four literal values explicitly: `standard`→cyan `#5EC8E5`, `cs-standard`→violet `#B98CF2`, `microtonal`→coral `#FF8A5B`, `other`→muted `#A1A1AA` (the 04-UI-SPEC "unmapped/missing → text-muted" fallback). Key off the exact union string, not the display label. A future re-tag adding `cs-standard`/`other` then just works.
**Warning signs:** Violet never appears (expected today); an orb renders with no/wrong color after a data refresh.

### Pitfall 4: Matrix import path crosses the package boundary
**What goes wrong:** `data/normalized/transition-matrix.json` lives at repo root, outside `packages/app`. A naive `import "../../../data/..."` is ugly and may trip Vite's `server.fs.allow`.
**How to avoid:** Add a Vite `resolve.alias` (e.g. `@matrix` → absolute path to the JSON) in `packages/app/vite.config.ts`, import it typed as core's `TransitionMatrix`, and guard `schemaVersion === 1` on load (fail to the "Couldn't load the prediction model" state, 04-UI-SPEC). See State-of-the-Art for the bundle-vs-`?url` decision.

### Pitfall 5: OrbitStage vs AppShell scroll conflict
**What goes wrong:** `AppShell` wraps children in `<main class="flex-1 overflow-y-auto pb-16">`. An orbit stage that must NOT scroll/rubber-band (SHOW-13) sits inside a scrolling container.
**How to avoid:** Make the Show view a fixed, non-scrolling flex layout (header + trail strip + stage + action bar), overriding/opting out of `<main>`'s `overflow-y-auto` for `#/show`. Decide during planning whether to parametrize `AppShell` or let `ShowView` manage its own full-height non-scroll layout.

### Pitfall 6: `predict()` rebuilds the index every call
**What goes wrong:** Calling `predict()` on every keystroke or animation frame rebuilds `MatrixIndex` each time.
**How to avoid:** Only call `predict()` on an actual recenter (a logged song), not on render. At 264 nodes each call is <5ms so this is not urgent, but keep predictions in state and recompute only on log events. Optionally precompute the shared index once (`buildMatrixIndex`) and score against it if profiling ever shows lag.

## Code Examples

### predict() → orb data (verified signature)
```typescript
// Source: packages/core/src/model/predict.ts:482 + domain/types.ts:183
import { predict, buildMatrixIndex, type PredictionCandidate } from "@guezzer/core";
const ranked: PredictionCandidate[] = predict(matrix, showContext); // sorted desc, top cfg.candidateListSize (15)
const fan = ranked
  .filter(c => c.score >= cfg.show.ORB_DROP_SCORE)   // 0.02
  .slice(0, cfg.show.ORB_COUNT_MAX)                   // 8
  .slice(0, Math.max(cfg.show.ORB_COUNT_MIN, /* ...ensure ≥5 */ 5));
// each: c.songId, c.songName, c.score (→ %), c.reason (→ why), c.factors, node.tuningFamily (→ color)
const weak = ranked[0].score < cfg.show.WEAK_FAN_THRESHOLD; // 0.15 → soften (D-10)
```

### Reactive restore + tally (verified pattern)
```typescript
// Source: dexie-react-hooks useLiveQuery + db.ts version(2)
const active = useLiveQuery(() => db.trackedShows.where("status").equals("active").first());
const entries = useLiveQuery(
  () => active ? db.trackedEntries.where("sessionId").equals(active.sessionId).sortBy("position") : [],
  [active?.sessionId],
) ?? [];
const hits = entries.filter(e => e.outcome === "hit").length;
const tally = `${hits}/${entries.length} · ${entries.length ? Math.round(100*hits/entries.length) : "—"}%`;
```

## Runtime State Inventory

> Not a rename/refactor/migration phase — greenfield feature work. This section is included only to confirm the one migration-adjacent concern.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Dexie v1 (`meta`, `attendedShows`) — **carried forward untouched** | Add `version(2)` tables only; never rewrite v1 |
| Live service config | None — Phase 4 is fully offline (no network, no live services) | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | Matrix artifact `data/normalized/transition-matrix.json` becomes a bundled dependency of the app for the first time | Wire the import (Vite alias); no artifact regeneration |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `?url` asset + runtime `fetch` + add `json` to Workbox `globPatterns` | **Bundle-import the matrix JSON** (Vite inlines into the JS bundle, already precached by `**/*.js`) | This phase (Claude's discretion resolved) | Offline-complete on first load for free; no Workbox `json` glob edit; 592 KB is well within bundle tolerance (CLAUDE.md decision 8). Trade-off: parsed at load — trivial at this size. Choose `?url`+fetch only if lazy-loading the model becomes desirable later. |
| `vitest.workspace.ts` | `test.projects` in root `vitest.config.ts` | Vitest 4 (pre-2025) | Already done — core=`node`, app=`jsdom`. Extend, don't add a workspace file. |
| Wake Lock unusable in iOS PWAs | Works in installed PWAs from **iOS 18.4** | 2025 (WebKit bug 254545) | Fallback messaging is mandatory for older-device friends. |

**Deprecated/outdated:**
- `registerType: 'autoUpdate'` — forbidden (SW must not swap mid-show); already `'prompt'` in `vite.config.ts`.
- NoSleep.js / video-loop wake hacks — superseded by the Wake Lock API + fallback copy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | fuse.js `threshold: 0.4` gives good drunk-thumb typo tolerance on the 264-song catalog | Pattern 4 | Poor match quality; mitigated — it's a config knob and the function is swappable (uFuzzy/MiniSearch per CLAUDE.md alternatives) |
| A2 | Even single-ring angular spacing fits 8×≥56px orbs on the smallest target phone | Pattern 3 | Orb overlap on small screens; mitigated — drop to 5 orbs (D-12) or two concentric rings; must validate on-device |
| A3 | `recentShowSongSets = []` is acceptable for show #1 (no 2026-tour data in the as-of-2025-12-13 matrix) | Pattern 2 | Rotation suppression neutral night 1 — this is correct/expected, not a bug; multi-night suppression is an additive bonus |
| A4 | Bundling 592 KB JSON into the JS bundle keeps first-load acceptable on venue mobile data | State of the Art | Slow first load; mitigated — first load is pre-show over wifi/home, then fully offline (the whole point). Low risk |
| A5 | Deleting an entry may leave a `position` gap; export re-numbers per group | Pattern 5 | Non-contiguous positions; low risk — kglw.net round-trip groups by `setNumber` and re-derives order (SCHEMA §3) |
| A6 | Long-press vs info-dot for the "why" (D-11) — 04-UI-SPEC specifies an `Info` dot | Pattern/UI | Minor UX; UI-SPEC is authoritative (info dot, not long-press) |

## Open Questions (RESOLVED)

> All three were resolved during Phase 4 planning; resolutions are inline below.


1. **Which friend devices run pre-iOS-18.4?**
   - What we know: Wake Lock silently fails on installed PWAs before 18.4.
   - What's unclear: the actual oldest-iOS in the <10-person friend group.
   - Recommendation: gather device/iOS list before the phase; run the STATE.md real-iPhone spike on the oldest. Ship the fallback message regardless.
   - **RESOLVED (planning):** The `WakeLockNotice` fallback ships UNCONDITIONALLY (plan 04-07 Task 1), so correctness does not depend on knowing the device mix; the oldest-device installed-PWA spike is the blocking human checkpoint in 04-07 Task 3 (discharges the STATE.md iOS-lifecycle blocker).

2. **Multi-night rotation suppression scope — same-tour matching by date?**
   - What we know: prior finalized tracked shows can feed `recentShowSongSets`.
   - What's unclear: how to decide "same tour" offline (no tour metadata for 2026 shows).
   - Recommendation: for the slice, feed the last N finalized tracked shows by date proximity (e.g. within ~2 weeks), config-gated. Additive; night 1 works with `[]`.
   - **RESOLVED (planning):** Explicitly DEFERRED as additive. Plan 04-03 Task 2 keeps `recentFinalizedShowSongSets` an accepted param defaulting to `[]`; night 1 is correct with `[]` and multi-night suppression can be enabled later with no model change.

3. **AppShell layout parametrization for the non-scrolling stage (Pitfall 5).**
   - Recommendation: decide during planning — either add a prop to `AppShell` to disable `<main>` scroll for `#/show`, or have `ShowView` own a full-height fixed layout.
   - **RESOLVED (planning):** Resolved in plan 04-04 Task 2 (the AppShell↔stage seam / Pitfall 5): ShowView owns a full-height non-scrolling flex layout OR AppShell disables `<main>` scroll for `#/show`; the executor records the choice. Gesture-suppression CSS finalized in 04-07 Task 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (native TS exec) | Core CLI/tests | ✓ | v24.15.0 | — |
| fuse.js | SHOW-04 search | ✗ (not yet installed) | target 7.4.2 | Install into `@guezzer/core` |
| Dexie / dexie-react-hooks | SHOW-08/09/11 | ✓ | 4.4.4 / 4.4.0 | — |
| fake-indexeddb | Restore/write-through tests | ✓ (wired in `test/setup.ts`) | 6.2.5 | — |
| lucide-react | Icons | ✓ | 1.23.0 | — |
| Matrix artifact | Orbit predictions | ✓ | schemaVersion 1, 264 nodes / 2987 edges, as-of 2025-12-13 | — |
| Screen Wake Lock API | SHOW-12 | Runtime device-dependent | — | `WakeLockNotice` fallback (iOS <18.4 installed PWA, or any unsupported) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** fuse.js (install step, trivial); Wake Lock (built-in fallback messaging path is the requirement itself).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`test.projects`: core=`node`, app=`jsdom`) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run packages/app` (or `packages/core`) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOW-04 | `searchCatalog` fuzzy-matches known song, tolerates a typo, empty→[] | unit (core, node) | `npx vitest run packages/core -t "searchCatalog"` | ❌ Wave 0 (`packages/core/test/search-catalog.test.ts`) |
| SHOW-02 | `layoutOrbs` deterministic (same input→same output), all diameters ≥56, positions in-bounds | unit (app) | `npx vitest run packages/app -t "orbitLayout"` | ❌ Wave 0 (`packages/app/test/orbitLayout.test.ts`) |
| SHOW-11 | Write-through: log song → row in IndexedDB immediately | integration (app, fake-indexeddb) | `npx vitest run packages/app -t "write-through"` | ❌ Wave 0 (`packages/app/test/showSession.test.ts`) |
| SHOW-11/D-03 | Restore: seed active show + entries, re-query → exact resume; only one active | integration (app) | `npx vitest run packages/app -t "restore"` | ❌ Wave 0 (same file) |
| SHOW-03/D-06 | Hit/miss scoring: tap-orb entry=hit (in fan), search/???=miss; tally math | unit (app) | `npx vitest run packages/app -t "tally"` | ❌ Wave 0 (`packages/app/test/tally.test.ts`) |
| SHOW-06 | Set structure: set break→"2", encore→"e"; entries snapshot setNumber; round-trip grouping | unit (app) | `npx vitest run packages/app -t "set-structure"` | ❌ Wave 0 (same as showSession) |
| SHOW-07/D-15 | Undo deletes max-position entry; delete recomputes tally | integration (app) | `npx vitest run packages/app -t "undo"` | ❌ Wave 0 (showSession) |
| DEX-01/D-02 | Start Show writes a date-keyed tracked-show row (provisional attendance) | integration (app) | `npx vitest run packages/app -t "attendance"` | ❌ Wave 0 (showSession) |
| D-12 | Adaptive fan: drops <ORB_DROP_SCORE, clamps 5–8 | unit (app or core helper) | `npx vitest run -t "adaptive fan"` | ❌ Wave 0 |
| D-09 | Score→display: absolute %, `<1%` floor, no renormalization | unit (app) | `npx vitest run packages/app -t "orb percent"` | ❌ Wave 0 (`packages/app/test/confidence.test.ts`) |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/<pkg-touched>`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/test/search-catalog.test.ts` — SHOW-04 (create `searchCatalog` first)
- [ ] `packages/app/test/orbitLayout.test.ts` — SHOW-02 determinism + ≥56px
- [ ] `packages/app/test/showSession.test.ts` — SHOW-11/07/06/DEX-01 (write-through, restore, undo, set structure, attendance) via existing `fake-indexeddb`
- [ ] `packages/app/test/tally.test.ts` — SHOW-03/D-06 hit/miss + SHOW-09 tally
- [ ] `packages/app/test/confidence.test.ts` — D-09/D-10 display + softening threshold
- [ ] Wake Lock (SHOW-12) is **manual/device** — no reliable automated test under jsdom; validate via the real-iPhone spike (note in VALIDATION.md as manual-only with justification)
- Framework install: none (Vitest + fake-indexeddb already present)

## Security Domain

> `security_enforcement` not set to `false` in config → included. Phase 4 has a small but real surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no auth (personal tool) |
| V3 Session Management | no | Local "session id" is a `crypto.randomUUID()`, not a security session |
| V4 Access Control | no | Single-user local device |
| V5 Input Validation | yes | Search query (bounded, passed to fuse.js only, never to DOM/eval); `location.hash` already allow-listed (`useHashRoute`); `schemaVersion` guard on matrix load |
| V6 Cryptography | no | `crypto.randomUUID()` for a non-security id only — no crypto claims |
| V7 Error Handling | yes | Wake Lock / persist / matrix-load failures must be caught and shown as calm UI, never crash the orbit |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via untrusted kglw.net text (song names, future footnotes) | Tampering | React JSX auto-escaping; **never** `dangerouslySetInnerHTML` on any kglw-derived string (SCHEMA §12). Song names in orbs/trail render as text only. |
| Hash-fragment injection | Tampering | Already mitigated — `useHashRoute` validates against a fixed allow-list and only selects a view (never assigned to `innerHTML`/`location`/`eval`). |
| IndexedDB quota exhaustion / eviction | Denial of Service | `navigator.storage.persist()` already requested (Phase 3 `persist.ts`); JSON export is the real backstop (Phase 5). Phase 4 data volume (one show's setlist) is tiny. |
| Search input abuse | DoS | fuse.js over 264 items is bounded; no regex-from-user, no network. |

**Note:** Show Mode is entirely offline and local in Phase 4 — no network requests, no server, no secrets. The dominant "security" concern is robust error handling (V7) so a failing browser API never bricks the live loop mid-show.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/model/predict.ts` — `predict()` signature, score pipeline, `hardSegueOverrideCeiling=0.97` cap, `buildReason` "why" strings (D-09/SHOW-10 resolution)
- `packages/core/src/domain/types.ts` — `PredictionCandidate`, `PredictionFactors`, `ShowContext`, `SetNumber` union, `MatrixNode.tuningFamily`
- `packages/core/src/config.ts` — all model constants (scores, ceilings, `candidateListSize=15`)
- `packages/app/src/db/db.ts` — Dexie v1 schema + documented `version(2)` additive hook
- `packages/app/src/config.ts`, `styles.css`, `vite.config.ts`, `index.html`, `AppShell.tsx`, `useHashRoute.ts`, `pwa/persist.ts` — Phase 3 foundation to extend
- `docs/SCHEMA.md` — `setnumber`/`"e"`/`transition_id` encoding, full-corpus census (setnumber closed to `1|2|e`)
- `data/normalized/transition-matrix.json` — verified header: schemaVersion 1, 264 nodes / 2987 edges, as-of 2025-12-13; families present: standard 247, microtonal 17
- `packages/app/test/setup.ts`, `vitest.config.ts` — `fake-indexeddb/auto` + `test.projects` already wired
- `.planning/phases/04-show-mode/04-CONTEXT.md`, `04-UI-SPEC.md`; `.planning/REQUIREMENTS.md`; `.planning/ROADMAP.md`; `.planning/STATE.md`; `CLAUDE.md`

### Secondary (MEDIUM-HIGH confidence)
- WebKit bug 254545 + caniuse "wake-lock" + WebKit Safari 18.4 notes — Wake Lock iOS installed-PWA history (broken until 18.4)
- `npm view fuse.js` — version 7.4.2, published 2026-06-05 [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- fuse.js `threshold`/`distance` tuning values — training knowledge, flagged A1 (config-tunable, swappable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all locked in CLAUDE.md, versions verified against installed `package.json`s + npm
- Core API consumption (score/reason/context): HIGH — read directly from frozen source
- Dexie schema + write-through/restore: HIGH — extends documented Phase 3 pattern; test infra already present
- Radial layout math: HIGH approach / MEDIUM exact constants — validate on smallest device
- Wake Lock: MEDIUM-HIGH — iOS installed-PWA caveat verified via WebKit bug tracker; exact friend-device iOS mix unknown (Open Question 1)
- Gesture suppression: HIGH techniques / MEDIUM on AppShell scroll reconciliation

**Research date:** 2026-07-09
**Valid until:** ~2026-08-09 (stable stack; re-check Wake Lock/iOS status and fuse.js if the phase slips materially)

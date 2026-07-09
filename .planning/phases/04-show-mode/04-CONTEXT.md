# Phase 4: Show Mode - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The full one-thumb live loop for tracking a KGLW show in a dark venue. A center-song orbit shows the top predictions as tappable orbs; tapping logs a hit and recenters, fuzzy search and a "???" button log misses just as fast, and the whole session is written through to IndexedDB so a force-quit restores exactly. Delivers the show-#1 hard bar: **SHOW-01–13, EVAL-04, DEX-01**.

**In scope:**
- Orbit view: current song centered, top **5–8** predictions as tappable orbs sized/placed by probability via a **deterministic radial layout** (never a force simulation), colored by tuning family, showing an honest percentage and a "why" (SHOW-01/02/03/10).
- One-tap logging paths: tap orb = hit + recenter + repredict; always-visible fuzzy search over the full catalog (miss); always-visible "???" placeholder so tracking never stalls (SHOW-03/04/05).
- Set-break + encore marking with round-trippable set-structure serialization (SHOW-06); one-tap undo + edit of a wrong entry (SHOW-07).
- Comet trail: last ~4 songs as diminishing nodes with hit/miss rings, older history compressed to a tappable "+N" at 30+ songs (SHOW-08); persistent running hit/miss tally (SHOW-09).
- Crash-proof persistence: every confirmed song written through to IndexedDB immediately; exact restore on relaunch (SHOW-11). Screen wake lock held + reacquired on visibility change with fallback messaging (SHOW-12).
- Dark theme, fat targets, accidental-gesture suppression (SHOW-13). Honest confidence framing (EVAL-04). Live-tracked show auto-counts as attended (DEX-01, provisional).

**Not in scope (later phases):**
- Live `latest` polling + editor-suggestion auto-fill (Phase 5, SYNC-01/02/03) — Show Mode is fully offline-first for show #1.
- JSON export/import (Phase 5, PWA-04).
- Binding a tracked show to a real kglw.net `show_id` + venue, retroactive attendance marking (Phase 5 sync / Phase 6, DEX-02).
- Post-show recap view + rarity score (Phase 6, SHOW-14/STAT-02).
- Pokédex UI, sighting counts, stats (Phase 6). Explore constellation (Phase 7).

**Mode:** MVP (vertical slices). Get the whole tap→log→persist→restore loop working end-to-end before polishing any single piece.

</domain>

<decisions>
## Implementation Decisions

### Show Lifecycle & Attendance (SHOW-11, DEX-01)
- **D-01:** A show **starts with one tap** ("Start Show") that opens the orbit immediately with **today's date auto-stamped** — no venue picker, no network, no pre-show friction. Venue and `show_id` are left blank and reconciled later. NOT a schedule-picker-first flow (assumes signal + that the show exists in kglw.net yet).
- **D-02:** DEX-01 attendance is credited **provisionally, immediately**: on show start, write an attendance record keyed by a **local session id + date**, so dex credit for show #1 is never lost even if fully offline. Binding/merging that provisional record to the real kglw.net `show_id` happens in **Phase 5 (sync) / Phase 6 (retroactive marking)**, matched by date. NOT "require a `show_id` up front" — that would contradict offline-first and risk losing show-#1 credit.
- **D-03:** **Exactly one active tracked show at a time.** Force-quit + relaunch **auto-resumes** straight back into it (SHOW-11); finalized shows are kept **read-only**. No multi-draft concurrency / show-picker (ambiguous for one-thumb use).
- **D-04:** A show ends via an **explicit "End Show" action** (with confirm) that finalizes the setlist to read-only and is **required before starting the next night**. NOT "encore-mark auto-ends" (risks ending early on a second encore / mis-tap).
- **D-05:** Phase 4 persists **date + local session id only** (plus the tracked setlist + set structure). Venue label and canonical `show_id` are **deferred to Phase 5/6**. Keeps Show Mode lean and offline-pure.

### What Counts as a "Hit" (SHOW-08, SHOW-09, EVAL-04)
- **D-06:** A confirmed song is a **hit if it was among the shown orbs** (the 5–8 fan you were looking at); logged via search or "???" = **miss**. The visible fan is the honest denominator, and the ring visually references what was on screen. NOT top-1 (too harsh, reads as distrust) and NOT a fixed top-5 divorced from what rendered.
- **D-07:** The running tally is a **single combined "X/Y (%)" number**, persistently visible (SHOW-09). Hard segues inflate it but it's the honest overall rate. No free-choice/hard-segue split in the persistent UI (kept simple for dark one-thumb reading). *Note for planning:* the underlying data should still let a later recap (Phase 6) decompose it.
- **D-08:** Logging via **"???" (or an off-catalog entry) counts as a miss** (red ring, denominator +1) — the model didn't predict it. Keeps the denominator whole and honest.

### Confidence Shown on Orbs (SHOW-01, SHOW-10, EVAL-04)
- **D-09:** Each orb shows the **model's own absolute-ish confidence score**, not a renormalized share of the fan. This preserves the Phase 2 invariant that **only notated hard segues reach ~100%** — an honest free-choice orb topping out around ~20–25% is correct, not a bug. *Research note:* confirm whether `predict()`'s `PredictionCandidate.score` is already normalized/probability-scaled and how a hard segue scales to ~100%, before deciding the exact number formatting.
- **D-10:** When the whole fan is weak (e.g., top orb below a ~15% threshold — sparse/debut-heavy moment), **soften the fan visually** (mute the orbs + a subtle "low confidence" hint) rather than rendering falsely-precise. No fake numbers. This is the pragmatic expression of EVAL-04 in Show Mode — the <25% *wide-framing* branch never triggers globally (backtest free-choice top-5 = 68.6%), but per-moment sparse fans still deserve honest softening. Exact threshold is Claude's discretion / tunable in config.
- **D-11:** The one-line "why" (SHOW-10) and factor breakdown open via a **separate affordance (info dot / long-press)**, NOT a plain tap — because **a plain tap on an orb LOGS it (SHOW-03)**. The orb face shows song name + %. The `reason` string from `PredictionCandidate` feeds the detail directly (no new derivation).

### Fan & Always-Visible Controls (SHOW-01/04/05/06/07/13)
- **D-12:** The fan is **adaptive 5–8 orbs**: always at least 5, up to 8, dropping orbs whose score is negligible so a weak moment isn't padded with noise (pairs with D-10). The radial layout must place a **variable count deterministically**, and every orb stays ≥ ~44px regardless of probability (SHOW-02).
- **D-13:** Persistent controls live in a **fixed thumb-reachable bottom action bar** below the orbit: **Search + "???" as primary**, **set-break / encore / undo as secondary**. Nothing overlaps the fan; everything sits in the thumb arc for one-handed dark use. NOT floating controls around the orbit (harder to reach, mis-tap risk near orbs).
- **D-14:** Tapping **"???" logs the placeholder immediately** (appends a "???" node + recenters) — zero friction so tracking never stalls (SHOW-05). Rename later from the trail. NOT a confirm step on the fastest-must-be path.
- **D-15:** **Undo removes the most recent song in one tap** (the common "oops" case, SHOW-07); to fix an **older** entry, **tap its trail node** to edit/delete. Covers both without cluttering the action bar.

### Claude's Discretion
- **Matrix-artifact offline loading** — bundle-import vs `?url` asset + runtime fetch + Workbox precache. Note `json` is **not** a Workbox `globPatterns` default and must be added if precached (per CLAUDE.md "Stack Patterns by Variant" + Phase 3 deferred item). Artifact is `data/normalized/transition-matrix.json` (~590 KB, 264 nodes / 2987 edges) — small enough to bundle.
- **Set-structure serialization** — mirror kglw.net's documented encoding (`setnumber`, `"e"` = encore) per `docs/SCHEMA.md` so the tracked show round-trips (SHOW-06). The exact local schema shape is discretion, but must be additive to the Dexie DB via `version(2)` (D-08 pattern from Phase 3).
- **Wake lock (SHOW-12)** implementation + feature-detection fallback messaging; gesture-suppression specifics (SHOW-13: disable pull-to-refresh, text selection, double-tap zoom, overscroll).
- **Radial layout math** (probability → orbit distance/size/angle) and the comet-trail "+N" compression/expansion interaction — subject to `/gsd-ui-phase` if run.
- **Confidence threshold + weak-fan cutoff** exact values (D-10/D-12) — belong in the app/core config (single-config-file ethos), tunable.
- Internal component decomposition, Dexie `version(2)` migration wiring, and app-level tests (setlist write-through round-trip, restore-on-relaunch, hit/miss scoring) following the established Vitest `projects` pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 4 section: goal, 5 success criteria, requirement IDs (SHOW-01–13, EVAL-04, DEX-01), MVP mode, "UI hint: yes".
- `.planning/REQUIREMENTS.md` — authoritative text for SHOW-01 through SHOW-13, EVAL-04, DEX-01 (and SHOW-14/SYNC-*/PWA-04/DEX-02 for awareness — those are Phase 5/6, explicitly out of scope here).
- `.planning/PROJECT.md` — "Show Mode (must work at show #1)" active requirements, venue reality (dark/crowded/one-thumb/possibly-drunk), iOS Safari eviction context, "No force simulation in Show Mode" and "Client-side model, no backend" key decisions.

### Core APIs this phase consumes (frozen in Phase 2)
- `packages/core/src/index.ts` — public barrel. Show Mode imports **`predict`**, plus `buildMatrixIndex` / `MatrixIndex`, and types `TransitionMatrix`, `MatrixNode`, `PredictionCandidate`, `PredictionFactors`, `ShowContext`, `TuningFamily`. App → core only (never the reverse).
- `packages/core/src/domain/types.ts` §104–201 — `MatrixNode` (`tuningFamily` for orb color), `PredictionCandidate` (`score`, `factors`, `reason` — powers the orb %, softening, and the SHOW-10 "why" at zero rework), `ShowContext` (`{ currentSongId, trail[], recentShowSongSets[][] }` — exactly what Show Mode must assemble each recenter).
- `packages/core/src/model/predict.ts` — `predict()` signature + `ScoringConfig`; `reason`-string construction (the SHOW-10 source). Confirm score scale/normalization here (D-09).
- `data/normalized/transition-matrix.json` — the frozen artifact to load into the app (~590 KB, `schemaVersion: 1`).
- `docs/SCHEMA.md` — kglw.net set/encore/segue encoding (`setnumber`, `"e"` encore, `transition_id` vocabulary) for round-trippable set-structure serialization (SHOW-06).

### App foundation this phase extends (Phase 3)
- `.planning/phases/03-app-shell-pwa-foundation/03-CONTEXT.md` — shell decisions: hash routing, Dexie **additive-migration** rule (never rewrite `version(1)`), install/update/version-stamp patterns.
- `.planning/phases/03-app-shell-pwa-foundation/03-UI-SPEC.md` — **inherited design tokens** (spacing scale, 44px tap floor, dark theme, `lucide-react` icons, system font). Do NOT re-derive tokens; extend them.
- `packages/app/src/db/db.ts` — the Dexie v1 schema (`meta` + `attendedShows` keyed by `show_id`) and the documented `version(2)` additive-migration hook Show Mode grows (tracked setlist + provisional attendance).
- `packages/app/src/routing/useHashRoute.ts`, `packages/app/src/components/AppShell.tsx` / `BottomTabBar.tsx` / `PlaceholderView.tsx` — the Show view is currently an empty placeholder to fill in; the nav chrome + bottom-bar pattern already exists to build on.
- `packages/app/src/config.ts` — app-level config for Show Mode constants (D-10 confidence threshold, D-12 orb-count bounds) — single-config-file ethos.
- `CLAUDE.md` — locked stack + "What NOT to Use" (no routing lib, no force sim in Show Mode, `registerType: 'prompt'`, `json` not a Workbox default); `fuse.js` 7.4.2 wrapped behind a core `searchCatalog(query)` fn for the SHOW-04 fuzzy search.

### Prior-phase patterns
- `.planning/phases/02-transition-matrix-model-backtest/02-CONTEXT.md` — model/backtest decisions; the 68.6% free-choice top-5 figure that keeps EVAL-04's wide-framing branch dormant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`predict()` + `PredictionCandidate`** (`packages/core`) — returns ranked candidates already carrying `score` (orb %), `factors` (softening + debug), `reason` (SHOW-10 "why"), and each node's `tuningFamily` (orb color). Show Mode assembles a `ShowContext` per recenter and renders the result — no new scoring code.
- **`buildMatrixIndex(matrix)`** — the in-memory successor index `predict()` expects; build once on artifact load.
- **Dexie DB (`packages/app/src/db/db.ts`)** — extend via `version(2).stores({...})` for the tracked-setlist + provisional-attendance tables (additive only; `meta`/`attendedShows` carry forward untouched).
- **Phase 3 UI-SPEC tokens + `lucide-react`** — spacing, 44px floor, dark theme, icons already established; the bottom action bar (D-13) mirrors the existing `BottomTabBar` layout idiom.
- **Vitest `projects`** (app = `jsdom`, core = `node`) — extend for Show Mode tests (write-through round-trip, restore, hit/miss scoring).

### Established Patterns
- **Strict core/UI separation (hard constraint)** — all scoring/search logic stays in `packages/core` (zero DOM). Wrap `fuse.js` behind a pure `searchCatalog(query)` in core (CLAUDE.md) so the SHOW-04 search is swappable and testable from Node.
- **Single config file for constants** — Show Mode's tunables (confidence threshold, orb-count bounds, trail-compression cutoff at 30) follow the no-scattered-magic-numbers rule.
- **Write-through persistence** — every confirmed song commits to IndexedDB immediately (SHOW-11), leveraging Dexie + `useLiveQuery` reactivity so the trail/tally re-render from the DB, not hand-synced state.

### Integration Points
- The **Show view** (currently an empty placeholder) is where the entire orbit + trail + action bar mount, under the existing hash route `#/show`.
- The **matrix artifact → app** load path is established-but-unused from Phase 3 (app → core import wired); Phase 4 is the first real consumer — decide bundle vs `?url`+precache here.
- **Dexie `version(2)` migration** is the seam Phase 5 (export/import, `show_id` binding) and Phase 6 (recap, dex derivation) extend — design the tracked-show + provisional-attendance shape to be additive-friendly and to carry set structure.
- **Wake Lock API** + Page Visibility API are new browser integrations (SHOW-12); flagged in STATE for an early real-iPhone spike.

</code_context>

<specifics>
## Specific Ideas

- **Honest orb numbers over pretty ones:** the user explicitly chose the model's own confidence (Robot > ~96% for a hard segue; Gamma Knife ~24% for free choice) over a renormalized fan share. Trust is the point — never imply the next song is definitely on screen.
- **"Never stall" is a functional requirement:** "???" logs instantly with no confirm; Search must feel as fast as tapping a hit. The fastest-must-be path is the miss path.
- **Bottom action bar mockup the user endorsed:**
  ```
  ── orbit fan ──
  [🔍 Search] [??? Unknown]
  [Set break] [Encore] [↶ Undo]
  ```
- **Provisional-attendance framing:** "match by date → show_id, merge, keep dex credit" — the local record is the source of truth until Phase 5/6 reconciles it; reconciliation must never drop the credit.

</specifics>

<deferred>
## Deferred Ideas

- **Free-choice vs hard-segue tally split** — the persistent tally is one combined number (D-07), but the underlying per-song hit data should support decomposing it in the **Phase 6 recap** (SHOW-14) and honest post-hoc framing. Not surfaced live.
- **Venue label + `show_id` binding UI** — Phase 5 (live sync, match against `latest`) / Phase 6 (retroactive marking against the archive). Phase 4 only writes the provisional date-keyed record.
- **"???" rename-later flow polish** — Phase 4 supports renaming a "???" node from the trail (edit affordance, D-15); a richer "resolve unknown against catalog/kglw.net" flow can grow in Phase 5.
- **Suppress the update toast during an active tracked show** (carried from Phase 3 D-06 deferred) — now that "active show" is a real Phase 4 concept, consider making the update toast a no-op while a show is being tracked. Belt-and-suspenders on never-mid-show; the user-tap-only gate already guarantees no auto-swap.
- **Post-show recap view + rarity score** — Phase 6 (SHOW-14, STAT-02). Show Mode's End Show just finalizes to read-only; the recap consumes it later.

</deferred>

---

*Phase: 4-Show Mode*
*Context gathered: 2026-07-09*

# Phase 16: Gizz Bingo — Build, Live Marking & Celebrations - Research

**Researched:** 2026-07-21
**Domain:** React 19 UI/UX layered on a locked pure-core bingo engine (Phase 14) + Dexie persistence/lock/replay (Phase 15). One new pure-core helper (D-10 pre-lock fill estimator).
**Confidence:** HIGH (engine + reuse seams read directly from shipped code; D-10 formula is a NEW design, MEDIUM until validated against the existing Monte-Carlo)

## Summary

This phase is almost entirely UI wiring over machinery that already exists and is gate-green. The bingo **engine** (`deal`, `deriveMarks`, `detectWins`) and its **calibration Monte-Carlo** (`bingo-calibrate.ts`) are shipped and locked; the **persistence/lock/replay** layer (`bingoCards` table, `saveDraftCard`, `lockCard`, `replayCard`) is shipped and used by `RecapView`. The app already builds a full runtime `BingoContext` in `bingoReplay.ts` from bundled artifacts (matrix via `@matrix`, `archive.json`, `dex-albums.json`, rarity index), which means every input the live board / meter / catchability hint needs is already available client-side and offline.

The **only new pure-core function** is the D-10 pre-lock expected-fill estimator. Today's `expectedFill(marked)` (`bingo/wins.ts:84`) is trivially `markedCount / 16` over an *already-marked* card — it is NOT the estimator. The new function scores an *unlocked composition* of squares from their per-square fire-rates, discounted for consume-once competition. Its constants extend `config.bingo`, and its thresholds/wording must be validated against the shipped `bingo-calibrate` Monte-Carlo (chill P(line) 0.42 / balanced 0.32 / glory 0.20; expected marks mean 7.89 / 7.26 / 6.25) so the meter stays honest.

**Primary recommendation:** Build a single reusable `<BingoBoard>` (extract the 4×4 render already inline in `RecapView.tsx:341-375`), drive it from `deriveMarks`/`detectWins` on every `logSong` via a `liveQuery` (marks derived, never stored), and add one new `packages/core/src/bingo/estimate.ts` (`estimateFill`) plus a `config.bingo.fireRates` + `config.bingo.fillMeter` constants block. All celebration/toast surfaces reuse the `BackupToast` module-emitter pattern and `motion/react`'s `useReducedMotion`. Cover art already exists — do not build it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deal a card (vibe → card) | Core (`deal`) | App (persist via `saveDraftCard`) | Pure deterministic generation already shipped; UI only picks vibe + calls it |
| Pre-lock expected-fill estimate (D-10) | Core (NEW `estimateFill`) | App (renders meter) | Domain math must stay DOM/DB-free, testable from Node, next to `expectedFill` |
| Per-square fire-rate / catchability % (D-03) | Core (constants + `BingoContext`) | App (formats %) | Numbers are model constants (config) + `eraPlayRate`; honest-% discipline |
| Live auto-marking (D-04/D-16) | Core (`deriveMarks`/`detectWins`) | App (liveQuery + board render) | Marks DERIVED never stored (Phase-14 D-23); app re-derives on every log |
| One-away detection (D-13/D-14/D-15) | Core (NEW near-miss helper) | App (banner/glow) | "Closest near-miss + needed square" is pure board geometry over a MarkedCard |
| Celebrations / supernova (D-17/D-18) | App only | — | Pure presentation; reuses `motion.div` orb idiom + galaxy backdrop |
| App-wide toasts (D-16/D-18/D-21) | App only | — | Module-emitter pattern (`BackupToast`), hosted at App level |
| Draft persist / lock (D-07/D-08) | App (`saveDraftCard`/`lockCard`) | — | Dexie writes; core mints no ids, stays DB-free |
| Share card image (D-22) | App (`shareCard.ts` canvas) | Core (assemble share data) | Canvas is DOM; reuse existing `drawShareCard` add a bingo branch |

## Standard Stack

No new dependencies this phase (CONTEXT out-of-scope explicitly excludes new deps/artifacts). Everything reuses what is already installed and bundled.

### Core (reused, already in the project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.7 | UI | Project-locked |
| motion (`motion/react`) | 12.42.2 | `useReducedMotion` + `motion.div` stamp/supernova animation | Already the orbit animation lib (`OrbitStage.tsx:22`); `useReducedMotion() ?? false` is the shipped idiom |
| Dexie + dexie-react-hooks | 4.4.4 / 4.4.0 | `useLiveQuery` over `bingoCards` + `trackedEntries` | Marks-derived discipline runs on liveQuery re-render |
| fuse.js | 7.4.2 | Swap-sheet Search section (D-02) | Already wrapped for the live editor + catch-up search |
| zod | 4.4.3 | (unchanged) card schema validation | `bingoCardSchema` already validates deal output |
| react-force-graph-2d | 1.29.1 | galaxy backdrop only (via `ConstellationCanvas`) | Supernova backdrop reuse (D-17) — no new graph |

### Alternatives Considered
None applicable — CONTEXT locks the stack and forbids new dependencies. The only "instead of" is: extract a shared `<BingoBoard>` component vs. duplicate the RecapView inline board (see Architecture Patterns — extract is recommended).

**Installation:** none. `npm install` unchanged.

## Package Legitimacy Audit

**No external packages are installed this phase.** All work reuses dependencies already present in `packages/app/package.json` and `packages/core/package.json` (React, motion, Dexie, fuse.js, zod, react-force-graph-2d). Package Legitimacy Gate is **not applicable** — no registry install occurs. No slopcheck run required.

## Runtime Data Availability (the load-bearing finding)

The app already builds a complete `BingoContext` at runtime, so **the live board, meter, and catchability hints need no new pipeline or artifact.**

- `packages/app/src/games/bingoReplay.ts:72` calls `buildBingoContext(matrix, archive, rarity, albums)` from:
  - `matrix` — bundled via the `@matrix` Vite alias (`show/matrix.ts:12`, ships inside the JS bundle, precached, offline-complete). Top-level: `{ schemaVersion, showCount: 738, asOfDate: "2025-12-13", nodeCount, nodes[], edges[] }`. Each node: `{ songId, songName, playCount, eraPlayCount, tuningFamily }`. [VERIFIED: read `data/normalized/transition-matrix.json`]
  - `archive` — `data/normalized/archive.json` via `@archive` alias / `dex-albums-loader` pattern. [VERIFIED: `vite.config.ts` alias block]
  - `rarity` — `buildRarityIndex(archive)`, module-memoized (`dex/rarityIndex.ts:18`). Provides `corpusGap` per song.
  - `albums` — `data/normalized/dex-albums.json` via `@dex-albums` alias.
- `BingoContext` fields available live (`bingo/context.ts:71`): `microtonalSongIds`, `corpusGap`, `albumSongIds` (album_url → Set<songId>), `jamVehicleSongIds`, `eraPlayRate` (songId → `eraPlayCount`). [VERIFIED: read `context.ts`]

**Implication for the planner:** the live-marking board should build `BingoContext` once (memoize like `bingoReplay`) and call `deriveMarks(card, liveTrail, ctx, caughtSnapshot)` on every trail change. The catch-up preview, replay, and live board all share this one adapter — extend `bingoReplay.ts` rather than fork it (its header already anticipates this: "this same adapter is the shared derivation for replay AND (Phase 16) live marking / catch-up preview").

## The D-10 Pre-Lock Fill Estimator (the ONLY new core function)

### Where it lives
New file `packages/core/src/bingo/estimate.ts`, exported through `packages/core/src/index.ts`, modeled next to `expectedFill` in `wins.ts`. Pure: no I/O, no DOM, no wall-clock, config injected with a default (mirrors `deriveMarks`/`deal` discipline). [CITED: `bingo/mark.ts`, `bingo/wins.ts`]

### Input contract
The estimator scores an **unlocked composition** — the 15 fillable squares of a draft `BingoCard` (the free cell is a guaranteed mark). Recommended signature:

```typescript
// estimate.ts — pure, DOM/DB-free
export interface FillEstimate {
  expectedMarks: number;      // ~ E[markedCount] incl. free cell, 1..16
  fillFraction: number;       // expectedMarks / 16
  lineLikelihood: "likely" | "possible" | "unlikely";
  blackoutLikelihood: "likely" | "possible" | "unlikely"; // ~always "unlikely" (honest)
}

export function estimateFill(
  card: BingoCard,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,
  cfg: typeof config = config,
): FillEstimate;
```

It reads each square's per-square fire-rate `p_s` (below), sums them under a consume-once discount, and maps the result to the three-band captions.

### Where the per-square fire-rate `p_s` comes from (D-03 + D-10)
`p_s = P(≥1 qualifying song appears in a recent-era show)`. The shipped calibration CLI already computes exactly this via `measuredFireRate(shows, memberIds)` (`bingo-calibrate.ts:493`), but **the recent-era shows list is NOT bundled in the app** (only matrix/archive/dex-albums ship; `corpus.json` at 5 MB is not aliased). So `p_s` must be resolvable client-side without the corpus. Per square kind:

| Square kind | `p_s` source (runtime, no corpus) | Notes |
|-------------|-----------------------------------|-------|
| `song` | `ctx.eraPlayRate.get(songId) / eraShowCount` | `eraPlayCount` is in every matrix node; needs a denominator (see below) |
| `album` | new `config.bingo.fireRates.album[albumUrl]` constant | 9 albums; values in `data/bingo-roster-candidates.md` (e.g. infest-the-rats-nest 80.1%, nonagon 46.1%) |
| `event: opener` | `config.bingo.fireRates.event.opener` | ≈ 53–65% (calibration report, mid-collection) |
| `event: microtonal` | `config.bingo.fireRates.event.microtonal` | ≈ 50–56% |
| `event: marathonJam` | `config.bingo.fireRates.event.marathonJam` | ≈ 60–68% |
| `event: bustOut` | `config.bingo.fireRates.event.bustOut` | ≈ 21% (vetting doc; 🌟 per D-03) |
| `event: neverCaught` | `config.bingo.fireRates.event.neverCaught` (approx) | song-specific truthfully, but a single representative constant is proportionate for v1 |
| `free` | 1.0 | pre-marked |

**Recommendation (config-clean, no new artifact):** add a `config.bingo.fireRates` block of owner-reviewed constants — sourced verbatim from the already-committed `data/bingo-roster-candidates.md` + `data/bingo-calibration-report.md` — exactly as the rosters and vibe bands were owner-approved at the D-20 checkpoint. This honors "all model constants in the single config file" and "no new build-time data artifacts." [ASSUMED — the concrete numbers to bake are Claude's-discretion per CONTEXT; owner should sign off, like the rosters]

### `eraShowCount` denominator — FLAG
Song fire-rate needs a recent-era show count. The matrix top-level `showCount` is **738 (TOTAL, asOfDate 2025-12-13)**, NOT the recent era. The calibration used **241 recent-era shows (year ≥ 2022, `RECENT_ERA_MIN_YEAR`)** (`bingo-calibrate.ts:59`). Options:
1. Add `config.bingo.eraShowCount: 241` constant (simplest; reviewed value). RECOMMENDED.
2. Reconcile the matrix "era" (`eraPlayCount`'s era definition, set at matrix build) with the calibration 2022 cutoff.

**Open question to flag:** the matrix `eraPlayCount` era and the calibration `RECENT_ERA_MIN_YEAR=2022` era may not be the same window. If they differ, song fire-rates (matrix-derived) and event/album fire-rates (calibration-derived) use inconsistent denominators. The planner should verify the matrix build's era cutoff equals 2022, or accept the song fire-rate as a labeled approximation. [ASSUMED — needs a one-line check of the matrix build era]

### Consume-once discount formula (recommended shape)
The naive independent sum `Σ p_s` overcounts: the consume-once fold (`mark.ts`) means one logged song marks ≤1 square and one square is lit by ≤1 song, and a median show logs only ~15 songs — squares compete for the same plays (two album squares with overlapping members; a song square that is also an album member). A single-constant damping is defensible and tunable:

```
expectedMarks ≈ 1 (free) + Σ_s p_s · d
```

where `d = config.bingo.fillMeter.consumeOnceDiscount ∈ (0,1]` is tuned so the heuristic's `expectedMarks` matches the Monte-Carlo `expectedMarks.mean` per vibe (chill 7.89 / balanced 7.26 / glory 6.25). Because raw `Σ p_s` (album-heavy chill cards especially) will exceed those means, `d` calibrates the gap. A per-kind or saturation form (`1 + N·(1 − Π(1−p_s/N))`) is an alternative if a single `d` cannot fit all three vibes within tolerance — start with the single constant, escalate only if validation fails. [ASSUMED — this is the NEW design; MEDIUM confidence until validated]

### Line / blackout likelihood bands (D-11/D-12)
Do NOT compute true P(line) at runtime (needs geometry + correlation; explicitly rejected — no runtime Monte-Carlo, D-10). Instead map `expectedMarks` (or `fillFraction`) to three coarse bands via thresholds tuned so the ordering matches the measured `pLine` (chill 0.42 > balanced 0.32 > glory 0.20):

```
expectedMarks ≥ config.bingo.fillMeter.lineLikelyThreshold   → "likely"   (green)
expectedMarks ≥ config.bingo.fillMeter.linePossibleThreshold → "possible"
otherwise                                                     → "unlikely" (amber, D-12 soft warning)
```

Blackout: `pBlackout ≈ 0.00` in every gated config (calibration report). The blackout caption is honestly **"unlikely" in essentially all reachable cards** — only flip to "possible" if `expectedMarks` approaches 16 (unreachable in practice). This is the honest wording. [VERIFIED: `data/bingo-calibration-report.md` — all vibes P(blackout) 0.0%]

### Validation discipline (the D-10 trust gate)
Add a Vitest sibling to `packages/core/test/bingo/calibrate.test.ts` (e.g. `estimate.test.ts`) that:
1. Deals N cards per vibe (reuse the `sim-${vibe}-${i}` seed idiom from `bingo-calibrate.ts:234`).
2. Asserts the heuristic `expectedMarks` per vibe is within a tolerance of the Monte-Carlo `expectedMarks.mean` (7.89 / 7.26 / 6.25).
3. Asserts the band ordering is preserved: mean chill card → "likely" caption bucket ranks ≥ balanced ≥ glory, matching `pLine` ordering.

This is the "validate against the existing Monte-Carlo" discipline CONTEXT D-10 mandates; it keeps the cheap meter honest against the expensive gate. [CITED: `bingo-calibrate.ts` `runBingoCalibration` / `calibrate.test.ts`]

### One-away helper (D-13/D-14/D-15)
Also pure core (add to `estimate.ts` or a `nearmiss.ts`): over a live `MarkedCard`, find lines/columns/diagonals with exactly one unmarked square (reuse the `ROWS`/`COLS`/`DIAG_*` geometry constants from `wins.ts:19-33` — factor them out to share), plus the blackout-minus-one case (D-15). Tie-break "closest" by the needed square's fire-rate `p_s` (highest wins — most achievable, per CONTEXT D-14 planner note). Return the single winning `{ neededSquareIndex, neededLabel, bucket, kind: "line" | "blackout" }`. Four-corners / X are excluded from one-away (D-15). [CITED: CONTEXT D-13/D-14/D-15]

### Constants to add to `config.bingo` (single-config rule)
```
config.bingo.fireRates = { album: {…9 urls}, event: {opener, microtonal, marathonJam, bustOut, neverCaught} }
config.bingo.eraShowCount = 241
config.bingo.fillMeter = { consumeOnceDiscount, lineLikelyThreshold, linePossibleThreshold }
```
All values owner-reviewable, sourced from committed calibration data — no scattered magic numbers. [CITED: `config.ts:363` §bingo]

## Reuse Targets — Exact Seams (implementation-ready)

### 1. `packages/app/src/games/GamesView.tsx` — replace the "Coming soon" stub
- **Current shape:** 87 lines. `useLiveQuery(() => db.bingoCards.toArray())`; renders a disabled teaser button (`copy.teaserAffordance`, lines 48-55) + a replay list (lines 59-83) + empty state. All copy from `config.copy.games` (`config.ts:998`).
- **Seam:** replace the disabled teaser block (lines 42-56) with the Deal screen (3 vibe buttons = deal, D-01) + draft board + swap sheet + fill meter. The replay list (59-83) stays. The empty state reuses existing copy (`emptyHeading`/`emptyBody`).
- **New copy:** add a `config.copy.games.bingo` sub-block (deal headings, gamble hints, swap-sheet sections, meter captions, celebration strings) per the UI-SPEC Copywriting Contract. Do NOT scatter literals (CLAUDE.md).

### 2. `packages/app/src/games/bingoReplay.ts` — extend, don't fork
- **Current shape:** `replayCard(row, entries, matrix, archive, rarity, albums) → { marked, wins, songNameByPosition }` (80 lines). Two correctness points: 0-based contiguous reindex (opener = index 0) and FROZEN `caughtSnapshot`.
- **Seam:** the live board needs the SAME derivation over the LIVE (unlocked, still-growing) trail with the LIVE dex snapshot (not frozen — frozen is only for locked replay). Add a sibling `deriveLiveBoard(card, liveEntries, ctx, liveCaughtSnapshot)` reusing the reindex logic, or parameterize the snapshot. Keep the reindex identical so `live == replay == catch-up` holds (the header guarantees this).

### 3. `packages/app/src/show/ShowView.tsx` — peek strip + Start-Show nudge
- **Current shape:** `logSong` / `adoptSuggestion` / `handleSearchSelect` all funnel through `logSong(sessionId, {...})` (lines 324/339/355) → grows `trackedEntries` → `useLiveQuery` re-derives. `CometTrail entries={session.entries}` renders in-flow at line 472. `PreShowLauncher` renders when no active show (line 297).
- **Peek strip seam (D-21):** add an in-flow slot near `CometTrail` (line 472) — NOT fixed, sits in the show column, never over the FAB/orbit. Render only when a locked card exists for the session (`useLiveQuery` on `bingoCards`). Tap → route to `#/games` via `useHashRoute` (simplest; UI-SPEC discretion default). Board thumbnail + the D-14 one-away banner; hosts the D-16 mark-toasts.
- **Start-Show lock + nudge seam (D-07/D-08):** the Start Show trigger is `startShow()` in `PreShowLauncher.tsx:32`. Phase 15 shipped `lockCard(sessionId, caughtSongIds)` as an idempotent no-op-if-no-card helper explicitly waiting for "Phase 16 wires whichever trigger fires" (`db.ts:517`). Wire: on Start Show, if a draft `bingoCards` row exists → `lockCard(sessionId, deriveDex(...).perSong.keys())`; if none → fire the dismissible "Deal a bingo card for tonight?" nudge (D-08), `[Deal]` routes to `#/games`, `[Not now]` dismisses for this show (D-09, no permanent suppression). `caughtSongIds` MUST be the frozen set as of lock, from `deriveDex(...).perSong.keys()` (`db.ts:520`).

### 4. `packages/app/src/dex/RecapView.tsx` — share entry + the board precedent
- **Current shape:** already renders the bingo replay section (lines 312-380): wins list (323-338) + a 4×4 read-only board rendered INLINE (341-375) with "lit by {song}" captions, driven by the `bingo` memo (`replayCard`, lines 120-142). `ShareCardSheet` already imported (line 29); `shareOpen` state (line 56); per-show `shareData` memo (line 107).
- **Seam (D-23):** add the bingo share trigger inside the existing bingo section — auto-offer at the win, opens `ShareCardSheet` with bingo-scoped data. **There is NO standalone board component today** — the 4×4 render is inline here. RECOMMENDATION: extract a shared `<BingoBoard marked wins onSquareTap />` from lines 341-375 so RecapView, the live GamesView board, and the peek-strip thumbnail all render identically. This is the highest-leverage refactor in the phase.

### 5. `packages/app/src/dex/shareCard.ts` + `ShareCardSheet.tsx` — bingo render target
- **Current shape:** `drawShareCard(ctx, data, {width, height})` (line 99) branches on `data.scope` ("collection" | "show"); pure canvas paint reading `ShareCardData` + config copy. `buildShareCardFile(data)` (218) + `shareOrDownload(file)` (259). `ShareCardSheet({open, onClose, data})` (line 39).
- **Seam (D-22):** add a `"bingo"` scope to `ShareCardData` and a branch in `drawShareCard` (or a sibling `drawBingoShareCard`) that paints the 4×4 board (stamped squares + free center) + win badges + show date + venue on the same galaxy aesthetic + wordmark. Content is the visual trophy only — NOT the per-square "lit by" detail (that stays the in-app replay payoff). Assemble the bingo `ShareCardData` in a pure helper (song/venue names escaped per T-06-21).

### 6. `packages/app/src/show/OrbitStage.tsx` — stamp + supernova orb idiom
- **Current shape:** orbs are rendered as `motion.div` elements (lines 228, 296) with CSS float vars + `motion/react` transitions; `const reduce = useReducedMotion() ?? false` (line 119) gates all animation. NOT a canvas — it is DOM/CSS + `motion`. Fan easings at lines 61-62.
- **Seam:** "reuse the orb renderer" means reuse the `motion.div` orb visual idiom + the `@keyframes`-under-`@media (prefers-reduced-motion: no-preference)` pattern in `styles.css`, NOT a canvas draw call. Per-square stamp = a `motion.div` opacity+scale pop (reduced: opacity only). Supernova orb burst = several `motion.div` orbs blooming (reduced: static full-bloom badge crossfade, D-20).

### 7. `packages/app/src/explore/ConstellationCanvas.tsx` — galaxy backdrop for supernova
- **Current shape:** `ConstellationCanvas({...})` (line 119) — the react-force-graph-2d canvas backdrop, reduced-motion aware. Reuse as the supernova's galaxy backdrop layer only (D-17). Do not build a second graph pipeline.

### 8. App-wide toast pattern — `BackupToast.tsx`
- **Current shape:** a module-level emitter (`showBackupToast()` / `subscribeBackupToast(fn)`), a `<BackupToast/>` hosted at App level (sibling of `<UpdateToast/>`), `role="status"`, `config.ui.z.toast` (20), auto-dismiss, height registered via `useBottomOverlayHeightRegistration` so it never intercepts taps. Survives the ShowView→RecapView unmount because it is App-level, not dialog-owned.
- **Seam (D-16/D-18/D-21):** the mark-toast and badge-toast MUST fire app-wide over any tab — replicate this exact module-emitter + App-level-host pattern (a `bingoCelebration` emitter). This is why celebrations fire regardless of which tab shows. The emitter is set imperatively when `detectWins`/near-miss transitions cross a threshold (compare previous vs. current derived wins between liveQuery renders).

### 9. `useReducedMotion` — from `motion/react`
- **Fact:** there is NO custom hook file. `useReducedMotion` is imported from `motion/react` (`OrbitStage.tsx:22`, `ShowView.tsx:29`), used as `useReducedMotion() ?? false`. Reuse the same import for all D-20 fallbacks. [VERIFIED: grep]

## Architecture Patterns

### System Architecture Diagram (live-marking data flow)

```
[User logs song on LiveGizz]
        │  logSong(sessionId,{songId,…})  (ShowView.tsx:324/339/355)
        ▼
[Dexie trackedEntries grows]  ──useLiveQuery──▶ [derive layer re-runs]
        │                                              │
        │                          buildBingoContext(matrix,archive,rarity,albums)  (memoized, bingoReplay)
        │                                              ▼
        │                          deriveMarks(lockedCard, liveTrail, ctx, caughtSnapshot)  (mark.ts, PURE)
        │                                              ▼
        │                          detectWins(marked) + nearMiss(marked)   (wins.ts + NEW, PURE)
        │                                              ▼
        ├───────────────▶ [<BingoBoard> re-renders: stamps]   (GamesView / peek strip)
        │                                              │
        │              compare prev vs. new wins/near-miss between renders
        │                                              ▼
        └───────────────▶ [module-emitter fires]  ──▶ mark-toast (D-16) · badge-toast (D-18) · supernova (D-17)
                                                        (App-level hosts, z: toast/celebration, app-wide)

[Draft build (pre-lock, GamesView)]
  vibe button → deal(seed,vibe,ctx,dex,corpusVer)  (generate.ts, PURE)
        → saveDraftCard(row)  (db.ts:485, overwrites in place on reshuffle)
        → estimateFill(card,ctx,dex)  (NEW estimate.ts, PURE) → fill meter
[Start Show] → lockCard(sessionId, frozenCaught)  (db.ts:525) → reshuffle rejected thereafter
```

### Recommended new/changed files
```
packages/core/src/bingo/
├── estimate.ts        # NEW: estimateFill + nearMiss (pure, config-injected)
├── wins.ts            # CHANGE: export ROWS/COLS/DIAG_* geometry for reuse by estimate.ts
packages/core/src/config.ts   # CHANGE: add config.bingo.fireRates, eraShowCount, fillMeter
packages/app/src/games/
├── GamesView.tsx      # CHANGE: replace stub with Deal/build/meter/live board
├── DealScreen.tsx     # NEW: 3 vibe buttons (D-01)
├── SwapSheet.tsx       # NEW: sectioned bottom sheet (D-02), reuses <Sheet> + fuse.js + covers
├── FillMeter.tsx      # NEW: bar + ~marks + caption (D-11/D-12)
├── bingoReplay.ts     # CHANGE: add deriveLiveBoard sibling (live snapshot)
packages/app/src/components/
├── BingoBoard.tsx     # NEW: shared 4×4 (extracted from RecapView inline)
├── BingoCelebration.tsx  # NEW: module-emitter + App-level host (BackupToast pattern)
packages/app/src/show/
├── ShowView.tsx       # CHANGE: peek strip slot + Start-Show lock/nudge wiring
├── BingoPeekStrip.tsx # NEW: in-flow thumbnail + one-away banner
packages/app/src/dex/
├── RecapView.tsx      # CHANGE: use <BingoBoard>; add share trigger
├── shareCard.ts       # CHANGE: add "bingo" scope branch
```

### Pattern: Marks derived, never stored (Phase-14 D-23)
Never write a mark to Dexie. The board is a pure function of `(lockedCard, trail, ctx, caughtSnapshot)`. On every `useLiveQuery` re-render, re-derive. Detect win/near-miss *transitions* by diffing the previous derived result against the new one in a `useRef` — that diff is what fires a celebration exactly once. [CITED: CONTEXT D-23, `mark.ts` header]

### Anti-Patterns to Avoid
- **Storing marks or win state in Dexie** — breaks `live == replay == catch-up`; re-derive instead.
- **Recomputing `BingoContext` per render** — memoize it (module cache, like `bingoReplay`/`rarityIndex`).
- **A second board renderer** — extract one `<BingoBoard>`; do not let GamesView, peek strip, and RecapView diverge.
- **Runtime Monte-Carlo for the meter** — explicitly rejected (D-10). Use the cheap heuristic + config thresholds.
- **Blocking the log loop with a celebration** — supernova is `pointer-events-none`, auto-fades, below `sheetScrim` (D-17). Never a modal.
- **Scattered z-index / copy / magic numbers** — extend `config.ui.z`, `config.copy.games.bingo`, `config.bingo.*`.

## Cover Art (D-02) — RESOLVED: it already exists, do not build

Album/cover art **is already bundled and resolvable** — the swap sheet does NOT need to degrade to text (except for songs with no card album). [VERIFIED: read `dex/covers.ts`, `dex/song-cover.ts`, `dex-albums.json`]

- `packages/app/src/dex/covers.ts` — `coverUrlFor(slug) → string | null` resolves bundled `../assets/covers/*.webp` via `import.meta.glob` (the glob IS the source of truth). `slug` = last path segment of an `albumUrl`.
- `packages/app/src/dex/song-cover.ts` — `coverUrlForSong(songId) → string | null` maps a song → its album's cover WebP via `buildSongCoverSlugMap` over `dex-albums.json` tracks. Never throws; returns null for bucket/Covers songs with no card album.
- `dex-albums.json` album shape: `{ albumUrl, title, releaseDate, tracks[] }` — no image field IN the JSON, but the slug→WebP glob is the art source.

**Seam for the swap sheet (D-02):** Album section chips → `coverUrlFor(slugForAlbumUrl(albumUrl))`. Model-bucketed Song chips → `coverUrlForSong(songId)`; **degrade to a text chip only when it returns null** (bucket/Covers songs). Event chips → emoji/text (no cover). This satisfies the UI-SPEC Component Inventory note ("`dex-albums.json` cover art (degrade to text chip)").

## Lock / Draft Machinery (Phase 15, this phase DRIVES it)

Confirmed shapes — the build UX drives, never rebuilds, this. [VERIFIED: read `db.ts`]

- **`bingoCards` row** (`db.ts:157`): `{ cardId(==sessionId, stable PK), sessionId(FK), card: BingoCard, caughtSnapshot: number[], lockedAt: number|null, showDate, venueName, city }`. Dexie v5 store `"&cardId, sessionId"` (`db.ts:288`). One card per show.
- **Draft persists unlocked (D-07):** `saveDraftCard(input)` (`db.ts:485`) writes `cardId = sessionId`, so a reshuffle with a new seed **overwrites the same row in place** — no orphaned drafts. `caughtSnapshot: []` until lock. THROWS if the show is `finalized` or the card is already locked (reshuffle-rejected-when-locked, D-10/SC-1).
- **Lock on Start Show (D-08):** `lockCard(sessionId, caughtSongIds)` (`db.ts:525`) stamps `lockedAt = Date.now()` and FREEZES `caughtSnapshot`; idempotent (first freeze wins); no-op if no card (safe for a card-less Start Show). Phase 16 supplies the trigger + the frozen `caughtSongIds` (from `deriveDex(...).perSong.keys()`).
- **Reshuffle-rejected-when-locked** is enforced app-side in `saveDraftCard` (never in core — core stays DB-free). The greyed "Locked at Start Show" controls (UI, D-10) are the visible counterpart.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card generation | custom vibe→card logic | `deal()` (`generate.ts`) | Locked, gate-green, deterministic |
| Marking / win detection | custom mark loop | `deriveMarks` + `detectWins` | Consume-once fold is trust-critical, shipped |
| Board re-derivation on live/replay/catch-up | 3 separate paths | one `bingoReplay` adapter | `live==replay==catch-up` guaranteed |
| Fuzzy catalog search in swap sheet | new search | shipped fuse.js wrapper | Same as catch-up manual search |
| Album/song cover art | new asset pipeline | `coverUrlFor` / `coverUrlForSong` | Already bundled WebP glob |
| App-wide toast that survives unmount | context/prop toast | `BackupToast` module-emitter | Dialog-owned toasts get torn down |
| Reduced-motion detection | custom media query hook | `useReducedMotion` from `motion/react` | Already threaded app-wide |
| Share-card canvas | new canvas | `drawShareCard` + new scope | Same galaxy aesthetic/wordmark |
| z-index / copy / constants | inline literals | `config.ui.z` / `config.copy` / `config.bingo` | CLAUDE.md single-config rule |

**Key insight:** the risk in this phase is NOT missing engine capability — it's duplicating a derivation or a renderer and letting live/replay/share drift. Every domain read goes through the one shared adapter; every board goes through one `<BingoBoard>`.

## Common Pitfalls

### Pitfall 1: Frozen vs. live caught-snapshot
`neverCaught` reads the caught set. Replay uses the FROZEN `row.caughtSnapshot` (locked-in). The LIVE board mid-show must use the LIVE dex (a song caught tonight still matches until lock, by design T-14-07). Do not accidentally freeze the live board's snapshot or thaw the replay's. **Avoid:** parameterize the snapshot explicitly per call site.

### Pitfall 2: Position reindex (opener = index 0)
`TrackedEntry.position` is 1-based and GAPPED (deleteEntry leaves holes). `mark.ts` hard-codes opener = index 0. The live board MUST apply the same sort-copy + fresh 0..N-1 reindex `bingoReplay.ts:59-66` uses, or the opener event mis-marks. **Avoid:** reuse the adapter's reindex verbatim.

### Pitfall 3: Firing a celebration on every re-render
`useLiveQuery` re-renders on any trail change; `detectWins` returns ALL current wins each time. Firing on presence, not transition, replays the supernova repeatedly. **Avoid:** diff previous vs. current derived wins in a `useRef`; fire only on the 0→1 edge. Enforce the ≤2 big-moments/show budget (first line + blackout only) with a per-session guard.

### Pitfall 4: Meter dishonesty (the D-10 trust risk)
A heuristic that says "line likely" for a card the Monte-Carlo shows completing a line 20% of the time destroys the app's honest-number credibility. **Avoid:** the validation test tying `estimateFill` to the calibration means/pLine ordering is non-optional — treat it as this phase's trust gate.

### Pitfall 5: eraShowCount / era mismatch
Song fire-rates normalized by the wrong denominator (matrix total 738 vs. era 241) will overstate rarity. **Avoid:** use `config.bingo.eraShowCount = 241` and confirm the matrix `eraPlayCount` era window matches the 2022 calibration cutoff.

## Runtime State Inventory

Not a rename/refactor phase, but two persistence touchpoints matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `bingoCards` Dexie table (v5) — draft rows written by `saveDraftCard`, locked by `lockCard`. Marks are NOT stored (derived). | Drive existing helpers; no schema change |
| Live service config | None — no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | Matrix (`@matrix`), `archive.json`, `dex-albums.json`, cover WebPs — all already bundled; no new artifact this phase (CONTEXT excludes new artifacts). | None — reuse |

## Validation Architecture

`workflow.nyquist_validation: true` → this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, `test.projects: ['packages/*']` (core = node env, app = jsdom) |
| Config file | root `vitest.config.ts` (per CLAUDE.md) |
| Quick run command | `npx vitest run packages/core/test/bingo` |
| Full suite command | `npm test` (root) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BINGO-01 | deal never blank, vibe explicit | unit (engine, exists) | `npx vitest run packages/core/test/bingo/generate.test.ts` | ✅ (engine) |
| BINGO-02 | fill estimate matches Monte-Carlo means; bands ordered | unit | `npx vitest run packages/core/test/bingo/estimate.test.ts` | ❌ Wave 0 |
| BINGO-02 | swap dedup (no dead duplicate square) | unit (app) | `npx vitest run packages/app/.../SwapSheet.test.tsx` | ❌ Wave 0 |
| BINGO-04 | one-away picks closest by fire-rate; excludes corners/X | unit | `npx vitest run packages/core/test/bingo/estimate.test.ts` | ❌ Wave 0 |
| BINGO-04 | live board == replay board over same trail | unit | reuse `deriveMarks` fixtures; assert live/replay parity | ❌ Wave 0 |
| BINGO-05 | celebration fires once per win transition; ≤2 big moments | unit (app, reducer) | app test on the transition-diff reducer | ❌ Wave 0 |
| BINGO-08 | bingo share data assembled correctly (pure) | unit | `npx vitest run packages/app/.../shareCard.test.ts` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/test/bingo` (< 5s, core pure)
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + the D-10 `estimate.test.ts` vs-Monte-Carlo assertion green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/test/bingo/estimate.test.ts` — covers BINGO-02 (fill/bands) + BINGO-04 (near-miss); validates against Monte-Carlo means (the trust gate)
- [ ] App test for the celebration transition-diff reducer (BINGO-05, fire-once + budget)
- [ ] App test for swap dedup + custom-vibe flip (BINGO-02/D-04)
- [ ] Extend `shareCard` test for the bingo scope (BINGO-08)
- [ ] Shared `<BingoBoard>` render test (marks/wins/free center)

## Security Domain

`security_enforcement: true`. This is an offline, no-backend, no-auth personal PWA — most ASVS categories are N/A.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (project constraint) |
| V3 Session Management | no | No server sessions |
| V4 Access Control | no | Single-device local data |
| V5 Input Validation | yes | `bingoCardSchema` (zod) already validates imported cards; swap-sheet search input is client-only |
| V6 Cryptography | no | No secrets |
| V7 Data integrity | yes | Matrix/dex-albums `schemaVersion` guards (existing); marks derived not stored |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via kglw-derived song/venue names in board/toast/share | Tampering | Render as escaped React text (T-06-21); canvas `fillText` is inert; NEVER `dangerouslySetInnerHTML` |
| Corrupt imported bingo card | Tampering | `bingoCardSchema.parse` at the import trust boundary (already shipped) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Concrete `config.bingo.fireRates` numbers baked from committed calibration/roster data | D-10 Estimator | Meter/hint numbers slightly off; owner review (like rosters) mitigates |
| A2 | Single `consumeOnceDiscount` constant fits all 3 vibes within tolerance | D-10 formula | May need per-kind/saturation form; validation test catches it |
| A3 | Matrix `eraPlayCount` era == calibration 2022 cutoff (or `eraShowCount=241` acceptable) | eraShowCount FLAG | Song fire-rates use inconsistent denominator; one-line matrix-build check resolves |
| A4 | Blackout caption honestly "unlikely" always | Likelihood bands | If a future config raises fill near 16 it'd mislead — unreachable today (P(blackout) 0.0%) |
| A5 | Celebration z-tier `celebration: 18` (above page 15, below toast 20, below sheetScrim 40) | z-index | Wrong layering hides toasts or blocks sheet; discretion per UI-SPEC |
| A6 | Peek-strip expand routes to `#/games` (vs. in-place overlay) | ShowView seam | UI-SPEC discretion default; either works |

## Open Questions

1. **Matrix era window vs. calibration 2022 cutoff (A3)**
   - Known: matrix nodes carry `eraPlayCount`; calibration used year ≥ 2022 (241 shows). Matrix total showCount = 738.
   - Unclear: whether `eraPlayCount`'s era == 2022 window.
   - Recommendation: one-line check of the matrix build's era cutoff; if it differs, add `config.bingo.eraShowCount` matching the matrix era and label song fire-rate an approximation.

2. **neverCaught fire-rate as a single constant vs. per-song**
   - Known: neverCaught truly depends on which song is the hint and the live dex.
   - Recommendation: a single representative `config.bingo.fireRates.event.neverCaught` is proportionate for a <10-user tool (D-24 spirit); revisit only if the hint reads dishonestly.

3. **Extract `<BingoBoard>` now vs. duplicate**
   - Recommendation: extract from `RecapView.tsx:341-375` in Wave 0 so all three surfaces render identically — cheap now, expensive to reconcile later.

## Environment Availability

Pure code/config changes over existing bundled artifacts + Dexie. No new external dependencies, services, or runtimes. Node ≥ 24.12 + Vitest already required by the repo. **Step 2.6: no new external dependencies — nothing to probe.**

## Sources

### Primary (HIGH confidence — read directly this session)
- `packages/core/src/bingo/{wins,mark,generate,context,types}.ts` — engine contracts, `expectedFill` is markedCount/16, `deriveMarks` fold, `BingoContext` fields
- `packages/core/src/cli/bingo-calibrate.ts` — the Monte-Carlo harness (`runBingoCalibration`, `measuredFireRate`, `assertCalibrationInvariants`), 241 recent-era shows, `sim-${vibe}-${i}` seeds
- `packages/core/src/config.ts:363` §bingo — locked constants (vibes/mix/bands, rosters, freeIndex, specificityRank)
- `data/bingo-calibration-report.md` — P(line) 0.42/0.32/0.20, expected marks 7.89/7.26/6.25, per-event fire-rates, P(blackout) 0.0%
- `data/bingo-roster-candidates.md` — per-album fire-rates (infest 80.1% … quarters 21.2%), jam-vehicle fire-rates
- `packages/app/src/games/{GamesView,bingoReplay}.ts(x)`, `db/db.ts` (bingoCards row, saveDraftCard, lockCard), `dex/{RecapView,shareCard,covers,song-cover}.ts(x)`, `show/{ShowView,OrbitStage,matrix,PreShowLauncher}.ts(x)`, `components/BackupToast.tsx`, `config.ts` (z tiers, copy.games)
- `data/normalized/transition-matrix.json` (showCount 738, node.eraPlayCount) + `dex-albums.json` shape
- `16-CONTEXT.md` (D-01..D-24), `16-UI-SPEC.md`

### Secondary (MEDIUM confidence)
- The D-10 formula shape + discount + thresholds — NEW design derived from the shipped Monte-Carlo outputs; validated only once the estimate test is written.

## Metadata

**Confidence breakdown:**
- Reuse seams / engine / persistence: HIGH — read from shipped code with line numbers
- Cover-art resolution (D-02): HIGH — `coverUrlForSong`/`coverUrlFor` verified
- Runtime data availability (BingoContext in app): HIGH — verified via `bingoReplay.ts` + vite aliases
- D-10 estimator formula + thresholds: MEDIUM — new design; must be validated against the Monte-Carlo (the phase's trust gate)
- Fire-rate constants + eraShowCount: MEDIUM — numbers exist in committed data; owner review + era reconciliation pending

**Research date:** 2026-07-21
**Valid until:** ~2026-08-21 (stable — engine/persistence locked; only the D-10 numbers need owner sign-off)

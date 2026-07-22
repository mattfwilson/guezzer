---
phase: 16-gizz-bingo-build-live-marking-celebrations
verified: 2026-07-21T09:10:00Z
status: passed
human_uat_reconciled: 2026-07-21T00:00:00Z
human_uat_source: 16-HUMAN-UAT.md
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification (no prior VERIFICATION.md)."
human_verification:
  - test: "Deal each vibe on GizzGames, then swap and reshuffle squares"
    expected: "One tap deals a full 4×4 (never blank); the fill meter reacts on every swap/reshuffle and turns amber (never red) below the likely-line threshold; the vibe label flips to 'Custom' after an individual swap; reshuffle with custom swaps prompts a confirm."
    why_human: "One-thumb build-flow feel, live meter reactivity, and amber-not-red styling are visual/interactive — not assertable in jsdom."
  - test: "Lock a card at Start Show, then log songs on LiveGizz"
    expected: "The in-flow peek strip appears (never over the FAB/orbit), auto-marks square-by-square as songs land, glows the single closest needed square, and shows the '🔥 One away…' / '👑 ONE SQUARE FROM BLACKOUT' banner; tapping a stamped square on the full GamesView board reveals which song lit it."
    why_human: "Live re-derivation timing, one-away glow placement, and tap-to-reveal are real-time/visual behaviors."
  - test: "Complete a first line, a second line, four-corners/X, and a blackout"
    expected: "Per-square stamp on every mark; a medium badge toast on four-corners / X / subsequent lines; a big supernova on the FIRST line and on blackout ONLY (at most two big moments per show); you can keep logging THROUGH the supernova (it never intercepts taps)."
    why_human: "Celebration hierarchy, the ≤2-big-moments budget as experienced, and the non-blocking (pointer-events-none) supernova require on-device confirmation."
  - test: "Enable reduced-motion (OS setting) and re-trigger celebrations"
    expected: "Supernova degrades to a static full-bloom headline crossfade (no particles/scale); stamps/toasts are opacity-only; the one-away ring is a static accent outline."
    why_human: "Reduced-motion rendering is a visual fallback that cannot be verified programmatically."
  - test: "Share the bingo trophy from RecapView (at the win) and from a GizzGames replay row, on a real iOS/Android device"
    expected: "The share sheet opens with a rendered PNG showing the 4×4 board (marked green / unmarked dark, distinct free center), win badges (glyph + word), and show date · venue on the galaxy canvas + wordmark — no async stall before the native share dialog."
    why_human: "Canvas pixel output is untested in jsdom (getContext is null; the bingo draw branch is not pixel-asserted); real share-sheet behavior is external/visual."
---

# Phase 16: Gizz Bingo — Build, Live Marking & Celebrations Verification Report

**Phase Goal:** Ship the playable, fun surface — the two anti-boredom pillars (build agency + near-miss tension) plus celebrations and a shareable result. Fun lives in the build, the "one away" tension, and the reveal — not the marking act itself.
**Verified:** 2026-07-21T09:10:00Z
**Status:** passed (all 5 human UAT checks completed on-device 2026-07-21, reconciled here)
**Re-verification:** No — initial verification

> **Reconciliation note (2026-07-21):** All five "Human Verification Required" items below were
> tested and passed on-device — see `16-HUMAN-UAT.md` (status `passed`, 5/5, final commit `8b9a99b`).
> Owner confirmed build flow, live marking (after auto-lock + glow-consistency fixes), the
> celebration hierarchy + ≤2-big-moments budget, reduced-motion fallbacks, and the share-card PNG on
> device. Status updated `human_needed → passed`; the descriptive block below is preserved as-authored.

## Goal Achievement

Every observable truth is backed by actual code (verified by reading files and running the toolchain — not by trusting SUMMARY claims). The automated foundation is fully green; what remains is the visual/interactive payoff that is the entire point of a "fun" phase, which requires on-device human confirmation.

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Deal a complete 4×4 card in one tap with a vibe pick — never a blank grid (BINGO-01) | ✓ VERIFIED | `DealScreen.tsx:36-59` — three vibe buttons (`VIBES = [chill, balanced, glory]`) each call `deal(seed, vibe, ctx, snapshot, corpusVersion)` → `resolveCardLabels` → `saveDraftCard`. `deal()` is the tested core generator (always 16 squares). Wired into GamesView state machine (`GamesView.tsx:212-214`, no-card → `<DealScreen/>`). |
| 2 | Reshuffle + swap any square (album/event cards w/ catchability hints, model-bucketed song chips, search) guided by a live fill/difficulty meter, until Start Show locks (BINGO-02) | ✓ VERIFIED | `SwapSheet.tsx` — sectioned Events→Albums→Songs→Search via `makeCatalogSearcher`/`toCatalog`, covers via `coverUrlFor`/`coverUrlForSong`, dedup (`disabled`) greying on-card items, `onReshuffle` with confirm-on-custom, Custom-flip. `FillMeter.tsx` renders `estimateFill` (amber `#F59E0B`, fillable N/15 basis). Lock: `PreShowLauncher.tsx:60` `lockCard(sessionId, caughtSongIds)`. Meter shown only while `unlocked` (`GamesView.tsx:186`). |
| 3 | Locked card visibly auto-marks square-by-square (per-square stamp + which song lit it) + continuous "one away" feedback (BINGO-04) | ✓ VERIFIED | `deriveLiveBoard(card, session.entries, ctx, frozenSnapshot)` re-derives on every logSong (`GamesView.tsx:160-166`, `BingoPeekStrip.tsx:55-61`). `<BingoBoard captionMode="tapReveal">` clean-stamp + tap-to-reveal (`BingoBoard.tsx:49,79`). "which song lit it" also in celebration mark toast (`autoMarkToast(song, square)`). One-away: `nearMiss` → banner + `oneAwayIndex` glow on the peek strip (`BingoPeekStrip.tsx:59,68-73,100`). |
| 4 | Line/four-corners/X/blackout triggers reduced-motion-aware celebration; supernova on first line + blackout only (≤2 big moments) (BINGO-05) | ✓ VERIFIED | `nextCelebrations` reducer (`useBingoCelebrations.ts:94-155`): first line → supernova (guarded by `supernovasFired`), subsequent line → `anotherLine` badge, corners/X → badge, blackout → supernova; ≤2 budget via `supernovasFired` Set. Three tiers in `BingoCelebration.tsx`; supernova `pointer-events-none` at `z.celebration` below sheetScrim; reduced-motion static crossfade (`reduce` gate). Mounted App-wide (`App.tsx:27,96`). |
| 5 | User can share a bingo result-card image (BINGO-08) | ✓ VERIFIED | `buildBingoShareCard` pure assembler (`share-stats.ts:226`, exported `index.ts:244`), `drawBingoShareCard` branch (`shareCard.ts:133,357`), `buildShareCardFile` handles `scope === "bingo"` (`shareCard.ts:461`). Entry points: RecapView auto-offer (`RecapView.tsx:162,420`) + GamesView replay re-share (`GamesView.tsx:23,31`). Pure assembly unit-tested (6 assertions). |

**Score:** 5/5 truths verified (all backed by codebase evidence; visual confirmation pending)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/bingo/estimate.ts` | `estimateFill` + `nearMiss` pure core | ✓ VERIFIED | 228 lines; exports both + `FillEstimate`/`NearMiss`; reads all constants from `cfg.bingo.fillMeter` incl. blackout thresholds (WR-01 fix). Pure (no React/DOM). |
| `packages/app/src/games/DealScreen.tsx` | 3 vibe buttons = deal | ✓ VERIFIED | 87 lines; deal→resolveLabels→saveDraftCard. |
| `packages/app/src/games/FillMeter.tsx` | bar + ~N/15 + line/blackout caption | ✓ VERIFIED | 83 lines; `fillableMarks/15` basis consistent w/ ARIA (WR-04 fix); amber `#F59E0B` never red. |
| `packages/app/src/games/SwapSheet.tsx` | sectioned swap sheet + covers + search + dedup + reshuffle | ✓ VERIFIED | 387 lines; all wiring present. |
| `packages/app/src/components/BingoBoard.tsx` | shared board, captionMode persistent\|tapReveal | ✓ VERIFIED | 160 lines; both disclosure modes; toggle-button squares. |
| `packages/app/src/components/BingoCelebration.tsx` | emitter + host, 3 tiers | ✓ VERIFIED | 256 lines; toast `pointer-events-none` (WR-02); supernova dismiss at `SUPERNOVA_MS - FADE_MS` (WR-03). |
| `packages/app/src/games/useBingoCelebrations.ts` | driver + fire-once reducer + ≤2 budget | ✓ VERIFIED | 242 lines; `nextCelebrations` pure reducer; frozen `caughtSnapshot` fed to derive. |
| `packages/app/src/show/BingoPeekStrip.tsx` | in-flow thumbnail + one-away banner | ✓ VERIFIED | 113 lines; `caughtSnapshot` prop, derives over `new Set(caughtSnapshot)` (CR-01 fix). |
| `packages/app/src/show/StartShowNudge.tsx` | dismissible card-less nudge | ✓ VERIFIED | 63 lines. |
| `packages/core/src/dex/share-stats.ts` | `buildBingoShareCard` + `BingoShareCard` scope | ✓ VERIFIED | 258 lines; pure projection, no per-square song detail (trophy-only). |
| `packages/app/src/dex/shareCard.ts` | bingo draw branch | ✓ VERIFIED | 517 lines; `drawBingoShareCard` + bingo File name. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| BingoPeekStrip (locked) | deriveLiveBoard | frozen `new Set(caughtSnapshot)` | ✓ WIRED | CR-01 fix present (`BingoPeekStrip.tsx:57-59`). |
| ShowView | BingoPeekStrip | forwards `bingoCardRow.caughtSnapshot` | ✓ WIRED | `ShowView.tsx:506-509`, guarded `lockedAt != null`. |
| GamesView locked board | deriveLiveBoard | `new Set(activeCard.caughtSnapshot)` | ✓ WIRED | `GamesView.tsx:160` (CR-01 fix; unlocked draft uses live snapshot over empty trail — harmless). |
| DealScreen | core `deal` + `saveDraftCard` | vibe tap | ✓ WIRED | `DealScreen.tsx:48,52`. |
| FillMeter | core `estimateFill` | `FillEstimate` prop | ✓ WIRED | `GamesView.tsx:186`. |
| PreShowLauncher | `lockCard` | Start Show → freeze `deriveDex().perSong.keys()` | ✓ WIRED | `PreShowLauncher.tsx:60`, fire-and-forget. |
| useBingoCelebrations | deriveLiveBoard + detectWins | diff transitions | ✓ WIRED | `useBingoCelebrations.ts:197,209,218`; App-mounted. |
| RecapView + GamesView | buildBingoShareCard → ShareCardSheet | share triggers | ✓ WIRED | `RecapView.tsx:162,420`; `GamesView.tsx:23`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| BingoBoard (live/peek) | `board.marked` | `deriveLiveBoard(card, session.entries, ctx, frozenSnapshot)` | Yes — pure fold over the live Dexie trail; not stored | ✓ FLOWING |
| FillMeter | `estimate` | `estimateFill(draftCard, ctx, dexSnapshot)` | Yes — reads committed corpus fire-rates | ✓ FLOWING |
| BingoPeekStrip banner | `miss` | `nearMiss(board.marked, card, ctx, caught)` | Yes — recomputed per render | ✓ FLOWING |
| Celebrations | `events` | `nextCelebrations(prev, marked, wins)` off `deriveLiveBoard` | Yes — 0→1 edge diff, seeded to avoid replay | ✓ FLOWING |
| Share card | `squares/wins` | `buildBingoShareCard(marked, wins, show)` | Yes — projects the frozen replay board | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core typecheck | `cd packages/core && npx tsc --noEmit` | exit 0 | ✓ PASS |
| App typecheck | `cd packages/app && npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npx vitest run` | 95 files / 747 passed | ✓ PASS |
| Production build | `cd packages/app && npx vite build` | built + SW generated, exit 0 | ✓ PASS |
| Core purity (no React/DOM) | grep `from "react"`/`document.`/`window.` in `packages/core/src` | only comments/var names (`window.filter`, `eraWindowShows`) | ✓ PASS |
| Bingo share canvas PIXELS | (jsdom `getContext` null; bingo draw branch not pixel-asserted) | untested by harness | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BINGO-01 | 16-03 | Deal a 4×4 card in one tap w/ vibe — never blank | ✓ SATISFIED | DealScreen + deal() + state machine (Truth 1) |
| BINGO-02 | 16-01/03 | Reshuffle + swap w/ hints + live fill meter until lock | ✓ SATISFIED | SwapSheet + FillMeter + lockCard (Truth 2) |
| BINGO-04 | 16-02/03/04 | Auto-mark + "one away" continuous feedback | ✓ SATISFIED | deriveLiveBoard + nearMiss + peek strip (Truth 3) |
| BINGO-05 | 16-05 | Celebration; supernova first line + blackout only; reduced-motion | ✓ SATISFIED | BingoCelebration + nextCelebrations budget (Truth 4) |
| BINGO-08 | 16-06 | Share a bingo result-card image | ✓ SATISFIED | buildBingoShareCard + draw branch + entry points (Truth 5) |

All requirement IDs declared across the six plans (BINGO-01/02/04/05/08) map to Phase 16 in REQUIREMENTS.md and are accounted for. No orphaned requirements (BINGO-03/06/07 belong to Phases 14/15 and are already Complete).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER/"coming soon" in any phase-modified file | ℹ️ Info | Clean; the Phase-15 "Deal — coming soon" stub was removed. |

Code review (16-REVIEW.md): 1 BLOCKER (CR-01) + 4 warnings (WR-01..04) all **fixed and confirmed present in code** during this verification. 2 INFO findings (IN-01 positional indexing, IN-02 swap dedup) intentionally deferred — latent robustness / minor UX polish, no live failure.

### Human Verification Required

Because every truth is a visual/interactive experience (the phase's stated value is "fun in the build, the tension, and the reveal"), and because canvas pixel output is untestable in the harness, the following must be confirmed on a device before declaring the phase passed. See the `human_verification` frontmatter for the full list:

1. **Build flow feel** — deal each vibe; swap/reshuffle; meter reacts + amber-not-red; Custom flip; reshuffle confirm.
2. **Live marking + one-away** — lock at Start Show; log songs; peek strip auto-marks, glows the exact needed square, shows the one-away/blackout banner; tap-to-reveal on the full board.
3. **Celebration hierarchy** — stamps throughout; badge on corners/X/subsequent lines; supernova on first line + blackout only (≤2); log THROUGH the supernova (non-blocking).
4. **Reduced-motion fallback** — static crossfade supernova, opacity-only stamps, static one-away ring.
5. **Share trophy on a real device** — the bingo PNG renders board + badges + date/venue on the galaxy canvas from both the recap and a replay row.

### Gaps Summary

No gaps. All five success criteria are structurally achieved and wired in the actual codebase; the CR-01 trust-critical blocker and all four review warnings are fixed and present; core purity, single-config discipline, and the "live == replay == catch-up" invariant hold. Automated verification is fully green (747 tests, both typechecks, production build). Status is `human_needed` (not `passed`) solely because the phase's value is experiential — celebrations, one-away glow, reduced-motion, and the canvas share image cannot be confirmed programmatically and are the standard device-UAT items every plan deferred.

---

_Verified: 2026-07-21T09:10:00Z_
_Verifier: Claude (gsd-verifier)_

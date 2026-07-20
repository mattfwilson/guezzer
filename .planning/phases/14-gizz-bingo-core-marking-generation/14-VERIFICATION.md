---
phase: 14-gizz-bingo-core-marking-generation
verified: 2026-07-20T09:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 14: Gizz Bingo — Core Marking & Generation Verification Report

**Phase Goal:** A pure, DOM-free `packages/core/src/bingo/` module exists — a deterministic consume-once `deriveMarks` fold and a seeded card generator — proven correct headless and passing the fill-rate calibration gate before any UI or DB is built. This is the third derivation over the tracked-show trail, sibling to `deriveTally` and `deriveDex`.
**Verified:** 2026-07-20T09:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `deriveMarks` produces byte-identical marks across live-incremental, full-replay, and bulk catch-up (`live == replay == catch-up` property test) | ✓ VERIFIED | `mark.ts:111-168` sorts trail by ascending `position` then folds (total-order argmin) — order-independent by construction. `mark.test.ts:56-112` runs catch-up (a), shuffled replay (b), and incremental prefix re-derivation (c), asserting `marks(replay).toEqual(marks(fullOrder))`, `marks(incremental).toEqual(marks(fullOrder))`, equal `markedCount`, and step-wise monotonicity. Suite green. |
| 2 | Consume-once holds: one song satisfying 3 squares marks exactly 1; 15 songs never exceed 15 marks | ✓ VERIFIED | `mark.ts:142-158` — a square leaves the pool once `markedByPosition` is set; each entry sets at most one winner. `mark.test.ts:116-133` (SONG_ALBUM qualifies for song+album+microtonal → only the song square, rank 0, lights; `markedCount===2` incl. free) and `:135-152` (15 song squares + 3 reprises → `markedCount===16`, never exceeds). |
| 3 | Seeded `deal` always complete (never blank) + same seed reproduces identical card; v1 catalog honored, segue excluded | ✓ VERIFIED | `generate.ts:169-243` — pure `mulberry32(xmur3(...))` stream (D-21), completeness top-up (`:211-219`) + `bingoCardSchema.parse` (`:242`). `generate.test.ts:21-41` asserts deep-equal for identical inputs, different card for different seed and for different vibe; `:77-89` empty-roster/bone-dry never-blank. `SQUARE_KINDS` (`:36-44`) excludes segue; `bingoEventValues` (`types.ts:30-36`) omits it. |
| 4 | Monte-Carlo CLI reports P(line)/P(blackout)/dark-share per vibe over 241-show corpus, enforces fire-rate floor, writes locked constants (GATE 2) | ✓ VERIFIED | `node packages/core/src/cli/bingo-calibrate.ts` **exits 0** (run live). Report emits per-vibe P(line) chill 42.4% / balanced 32.4% / glory 19.9%, P(blackout) 0.0%, dark-share table. `assertCalibrationInvariants` (`bingo-calibrate.ts:372`, `process.exit(1)` at `:703`) enforces D-05 floor + D-02/D-03 bands. Locked constants present in `config.bingo` (rosters, freeIndex=5, bustOutGapShows=50, per-vibe mix + bands). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/bingo/types.ts` | BingoCard contract + zod schema + unions | ✓ VERIFIED | `bingoCardSchema` (strictObject + discriminatedUnion + superRefine: 16 squares, one free at freeIndex). Compile-time schema↔interface cross-check. |
| `packages/core/src/bingo/prng.ts` | xmur3 + mulberry32, pure | ✓ VERIFIED | Public-domain PRNGs, `Math.imul`+bitops only; no clock/entropy reads. |
| `packages/core/src/bingo/context.ts` | buildBingoContext lookups | ✓ VERIFIED | Resolves matrix/rarity/dex-albums into stable-sorted Maps; zero new pipeline; empty jam roster → empty Set (no crash). |
| `packages/core/src/bingo/mark.ts` | deriveMarks consume-once fold | ✓ VERIFIED | 168 lines; argmin over `cfg.bingo.specificityRank` (never inlined); frozen-snapshot never-caught (D-12). |
| `packages/core/src/bingo/generate.ts` | deal seeded generator | ✓ VERIFIED | 243 lines; pure, schema-validated, never-blank fallback chain. |
| `packages/core/src/bingo/wins.ts` | detectWins + expectedFill | ✓ VERIFIED | 4×4 line/corners/x/blackout; free cell counts via FREE_SENTINEL. |
| `packages/core/src/cli/bingo-calibrate.ts` | Monte-Carlo report + hard-assert gate + --candidates | ✓ VERIFIED | Imports REAL deal/deriveMarks/detectWins/buildBingoContext (no fork); `--candidates` mode writes to `rosterCandidatesPath`; `escapeMarkdownExcerpt` (T-14-11). |
| `packages/core/src/config.ts` (config.bingo) | locked constants | ✓ VERIFIED | Rosters non-empty (9 jam-vehicle ids, 9-album pool), mix weights per vibe, specificityRank total order, freeIndex, bustOutGapShows, per-vibe line/blackoutMax bands. |
| `packages/core/src/index.ts` | bingo barrel exports (CLI excluded) | ✓ VERIFIED | Exports deal/deriveMarks/detectWins/expectedFill/buildBingoContext + types (`:329-342`); CLI not exported. |
| `data/bingo-roster-candidates.md` | D-20 review worksheet | ✓ VERIFIED | Present (2026-07-20 00:16). |
| `data/bingo-calibration-report.md` + `.json` | trust-gate report | ✓ VERIFIED | Both present, regenerated 08:42 by the green gate run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| mark.ts | config.bingo.specificityRank | argmin lookup, never inlined | ✓ WIRED | `kindKey` → `cfg.bingo.specificityRank[...]` (`mark.ts:147`); literals never inlined. |
| mark.ts | caughtSnapshot | never-caught = songId NOT in snapshot (D-12) | ✓ WIRED | `squareMatches` `neverCaught` case `:93-94`. |
| generate.ts | prng.ts | seed string → hash → stream, no Math.random | ✓ WIRED | `mulberry32(xmur3(...)())` `:179`. |
| generate.ts | bingoCardSchema | parse before return | ✓ WIRED | `bingoCardSchema.parse(card)` `:242`. |
| bingo-calibrate.ts | REAL deriveMarks/deal/detectWins | direct import, no fork (Pitfall 3) | ✓ WIRED | Imports `:22-25`; invoked `:234,249,250`. |
| human checkpoint | config.ts constant lock | constants written only after D-20 sign-off | ✓ WIRED | config.bingo carries `[VERIFIED: bingo-calibrate gate 2026-07-20]` owner-approved rosters; candidates file is separate output. |
| node cli | exit 0 | gate green with locked constants (GATE 2) | ✓ WIRED | Live run exit code 0. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Calibration gate green with locked constants (GATE 2) | `node packages/core/src/cli/bingo-calibrate.ts` | exit 0; "Calibration gate PASSED (241 shows, 500 cards/vibe)" | ✓ PASS |
| Full test suite | `npx vitest run` | exit 0; 85 files / 682 tests passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BINGO-03 | 14-01..14-06 | Locked card auto-marks itself (deterministic consume-once) as setlist is logged | ✓ SATISFIED | Core deriveMarks fold + seeded deal + calibration gate all verified. REQUIREMENTS.md maps BINGO-03 → Phase 14 (sole requirement). App-tab wiring is Phase 16 (out of scope here per CONTEXT). |

### D-02/D-03 Amendment (D-20 authorized retarget)

The user authorized (Option 1) retargeting the original win-rate bands after the D-20 gate proved them structurally unreachable under D-11 consume-once single-show marking. Verified:
- Amendment documented in `14-CONTEXT.md:41-67` with measured-ceiling evidence and rationale.
- `config.bingo.vibes` line bands (chill 0.42 / balanced 0.35 / glory 0.20) preserve chill > balanced > glory ordering; blackout floors removed, only `blackoutMax` caps retained.
- `assertCalibrationInvariants` thresholds agree with config bands: `blackoutBand` returns `{min:null, max: cfg.bingo.vibes[vibe].blackoutMax}` (`bingo-calibrate.ts:360`); P(line) checked against `cfg.bingo.vibes[vibe.vibe].line` (`:402`). `calibrate.test.ts:172` uses "chill target is 0.42 (D-02 amendment)" — tests agree with amended bands.
- Measured run (42.4 / 32.4 / 19.9%) lands within each band ± tolerance. Green gate reflects the amended (authorized) bands — the intended state.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER in bingo src or CLI | none | Purity scan for Math.random/Date.now/DOM/React/Dexie in `src/bingo/` found only comment-prose mentions describing the purity guarantee — no actual nondeterminism or forbidden imports. |

### Human Verification Required

None. All success criteria are programmatically verifiable and were confirmed by running the gate CLI (exit 0) and the full suite (682/682). The D-20 human sign-off on rosters already occurred during execution and is documented in CONTEXT + config comments.

### Gaps Summary

No gaps. The pure DOM-free `packages/core/src/bingo/` module exists with a deterministic consume-once `deriveMarks` fold (proven `live==replay==catch-up` and structurally consume-once), a seeded `deal` generator (same-seed reproducible, never-blank, segue-excluded), and pure 4×4 win geometry. GATE 2 is cleared: the Monte-Carlo CLI replays the 241-show corpus through the REAL fold, enforces the fire-rate floor and amended per-vibe bands, and exits 0 with owner-approved locked constants written to `config.bingo`. The D-02/D-03 band retarget is authorized and documented. BINGO-03 is satisfied for this phase's scope (app wiring is Phase 16).

---

_Verified: 2026-07-20T09:00:00Z_
_Verifier: Claude (gsd-verifier)_

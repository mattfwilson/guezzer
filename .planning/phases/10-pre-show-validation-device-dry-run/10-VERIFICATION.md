---
phase: 10-pre-show-validation-device-dry-run
verified: 2026-07-18T23:30:00Z
status: passed
score: 5/5 must-haves verified (the two on-device iOS legs completed on iPhone 2026-07-19)
overrides_applied: 0
resolution: on-device (2026-07-19) — the offline airplane-mode leg and the JSON export/import round-trip were re-run and PASSED on the installed iPhone PWA (production build over a cloudflared HTTPS tunnel), satisfying the human_needed items. VALID-02 is a clean full on-device pass. (An earlier owner disposition on 2026-07-18 had accepted them as deferred/non-blocking; superseded by this completed on-device run.)
human_verification:
  - test: "On-device (iPhone) JSON export -> re-import round-trip via the iOS Files/share-sheet picker"
    expected: "Export the backup JSON on the installed iPhone PWA, then re-import it through the iOS file picker; owner-match path merges with zero local data loss (attended shows, entries, dex credit intact)"
    why_human: "Verified on desktop localhost only this run (owner declined the cloudflared tunnel). The iOS file picker / share-sheet import surface differs materially from the desktop file-input path exercised. JSON export is the documented eviction backstop (CLAUDE.md), so on-device confirmation is material. Cannot be verified programmatically — requires a physical iOS device over the HTTPS tunnel."
  - test: "On-device (iPhone) offline airplane-mode leg on the installed PWA"
    expected: "Mid-show on the installed iPhone PWA, enable airplane mode; predictions, logging, and the GizzVerse constellation keep working from precache + IndexedDB with no error banner; re-enabling resumes polling silently"
    why_human: "Verified on desktop localhost secure-context only. iOS Safari IndexedDB eviction / service-worker survival under airplane mode is a documented iOS-specific risk (MEMORY sw-clientsclaim-offline, CLAUDE.md) not reproduced by the desktop run. Requires a physical iOS device over the HTTPS tunnel."
---

# Phase 10: Pre-Show Validation & Device Dry-Run Verification Report

**Phase Goal:** Owner tuning-tag spot-check (VALID-01) + full real-device show-loop rehearsal before show #1 (VALID-02).
**Verified:** 2026-07-18T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner completes the tuning-family tag spot-check — ~10 well-known songs verified musically sensible, needsReview subset hand-filled (VALID-01, SC1) | ✓ VERIFIED | `review-tuning-tags.ts` CLI runs, exits 0, prints a 12-pass / 0-fail canonical spot-check table (>=10 songs). Owner verdict recorded in `10-HUMAN-UAT.md` test #1 (PASS, D-03 FIX branch). Unit test 10/10 green. |
| 2 | Any genuine tuning error hand-fixed + build-model/run-backtest re-run with no top-k regression (VALID-01, D-03) | ✓ VERIFIED | `data/tuning-tags.json` has all 9 Infest tracks re-tagged `cs-standard`/`source:hand-tagged` (songIds 94,133,152,157,160,180,200,239,240 confirmed). `data/backtest-report.md` top-k = 84/103/114 (54.5/66.9/74.0%), matching the pre-fix baseline in the UAT delta table — zero regression. Full suite 587/587 green. |
| 3 | Full show loop (start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit) completes on a real iPhone against the production build (VALID-02, SC2 core) | ✓ VERIFIED | `10-HUMAN-UAT.md` tests 2–5 recorded PASS on iPhone, production build (`npm run preview`). Two D-09 loop-breaking blockers found+fixed inline and re-verified on-device (SuggestionStrip `b0213c0`, FAB `a60d5e2`); both fixes present and wired in code. |
| 4 | JSON export → re-import round-trip succeeds **on device** with no local data loss (VALID-02, SC2 named leg) | ⚠️ PARTIAL | Merge/owner-match logic VERIFIED on desktop localhost (test 7 PASS, `isTypedNameMine`/`classifyImport`, T-10-05). But the **on-device (iOS file picker)** leg was NOT run — owner declined the tunnel. Recorded as a deferred, non-blocking gap in `10-HUMAN-UAT.md ## Gaps`. → human verification item. |
| 5 | Android exercised if a device is available (VALID-02, SC3) | ✓ VERIFIED | SC3 is conditional ("if a device is available"). No Android device available → formally waived per D-06 and recorded in `10-HUMAN-UAT.md` test #8. Criterion satisfied as written. |

**Score:** 4/5 truths verified; 1 partial (device-surface confirmation of already-working logic outstanding).

Note: the offline airplane-mode leg (plan 10-02 truth "predictions/logging/constellation keep working in airplane mode") passed functionally on desktop secure-context; its iOS-specific behavior is the second outstanding human item. Its plan wording did not require "on device," so it is not scored as a failed must-have, but it is surfaced for human verification given the documented iOS eviction risk.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/cli/review-tuning-tags.ts` | Read-only VALID-01 review CLI | ✓ VERIFIED | Exports `runReviewTuningTags`, `formatReviewSummary`, `formatReviewReport`, `deriveReview` + interfaces. Read-only confirmed (only `mergeTuningTags` reference is in a docblock; comment-stripped grep = 0). Runs, exits 0. |
| `packages/core/test/review-tuning-tags.test.ts` | Unit coverage of spot-check + anomaly derivation | ✓ VERIFIED | 10/10 assertions pass. |
| `packages/core/src/ingest/tuning-tags.ts` | Export-only helper change | ✓ VERIFIED | `findMatchedAlbumTitles` + `defaultFamilyForAlbum` now exported; reused by CLI. |
| `data/tuning-tags.json` | 9 cs-standard entries (D-03 fix) | ✓ VERIFIED | 264 entries: 229 standard, 26 microtonal, 9 cs-standard; the 9 cs-standard all `source:hand-tagged`. |
| `data/backtest-report.md` | No-regression baseline | ✓ VERIFIED | Top-k 84/103/114 consistent with UAT delta table. |
| `packages/core/src/dex/share-stats.ts` | `buildRecapShareStats` (per-show card) | ✓ VERIFIED | Exported (line 151), re-exported from core index, imported+used in `RecapView.tsx` line 103. |
| `packages/app/src/dex/RecapView.tsx` / `ShareCardSheet.tsx` | Per-show recap share card | ✓ VERIFIED | `buildRecapShareStats` + `ShareCardSheet` wired (RecapView L18/L27/L103/L299). |
| `packages/app/src/live/SuggestionStrip.tsx` | D-09 fix a (slot sizing) | ✓ VERIFIED | `overflow-y-auto` + `SUGGESTION_STRIP_HEIGHT: 112` (config.ts L232, documented VALID-02/D-09). |
| `packages/app/src/show/FabMenu.tsx` | D-09 fix b (FAB lift) | ✓ VERIFIED | `stripReserved` prop consumed; computed in `ShowView.tsx` L376 and passed L465. |
| `10-HUMAN-UAT.md` | Graded VALID-01 + VALID-02 evidence | ✓ VERIFIED | status: resolved; 8 tests, tests 1–5 on iPhone, 6–7 desktop, 8 waived; Gaps section documents the deferral. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `review-tuning-tags.ts` | `ingest/tuning-tags.ts` | reuse `deriveCatalogFromCorpus`/`findMatchedAlbumTitles`/`defaultFamilyForAlbum` (never `mergeTuningTags`) | ✓ WIRED | Helpers imported and used; write path absent. |
| `data/tuning-tags.json` | `data/backtest-report.md` | build-model → run-backtest (D-03) | ✓ WIRED | Report top-k consistent with re-tagged data; full suite green. |
| `share-stats.ts buildRecapShareStats` | `RecapView.tsx` → `ShareCardSheet.tsx` | per-show recap card render | ✓ WIRED | Imported, invoked (L103), rendered via ShareCardSheet (L299). |
| `ShowView stripReserved` | `FabMenu` | FAB bottom offset when strip slot reserved | ✓ WIRED | Prop declared (FabMenu L59), computed + passed (ShowView L376/L465). |
| export → import round-trip | `ownerMatch`/`classifyImport` | on-device merge | ⚠️ PARTIAL | Logic wired + passing on desktop; on-device (iOS picker) surface unexercised. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Review CLI runs + prints >=10-song spot-check table | `node packages/core/src/cli/review-tuning-tags.ts` | exit 0, 12 pass / 0 fail table | ✓ PASS |
| Review CLI unit test | `npx vitest run .../review-tuning-tags.test.ts` | 10/10 passed | ✓ PASS |
| Full test suite (trust gate) | `npm test` | 587/587 passed, 76 files | ✓ PASS |
| cs-standard re-tag present | grep `data/tuning-tags.json` | 9 cs-standard, all hand-tagged | ✓ PASS |
| Backtest report no-regression | grep `data/backtest-report.md` | 84/103/114 matches baseline | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VALID-01 | 10-01 | Owner tuning-family tag spot-check | ✓ SATISFIED | CLI + owner verdict + D-03 fix + zero-regression backtest; REQUIREMENTS.md marked Complete. |
| VALID-02 | 10-02 | Full real-device show-loop dry-run incl. export/import round-trip; Android if available | ⚠️ MOSTLY SATISFIED | Core loop (tests 2–5) passed on iPhone; Android waived (SC3 conditional). Export/import + offline legs verified desktop-only — on-device confirmation outstanding (human). |

No orphaned requirements: only VALID-01 and VALID-02 map to Phase 10 (REQUIREMENTS.md L70–71), both accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No unreferenced TODO/FIXME/XXX/TBD in phase-modified source | ℹ️ Info | Clean. `SUGGESTION_STRIP_HEIGHT`/`stripReserved` comments reference the UAT/D-09 origin, not debt markers. |

### Human Verification Required

The code is complete, wired, and passes the full trust-gate suite (587/587). The core VALID-02 loop genuinely passed on the real iPhone. The remaining items are **physical-device manual re-tests of already-working logic** — not code/planning gaps. They cannot be verified programmatically and were knowingly deferred by the owner (documented non-blocking in `10-HUMAN-UAT.md ## Gaps`), but they bear on the literal SC2 wording ("on a real device ... JSON export/import round-trip") and touch documented iOS-specific risks:

1. **On-device iOS export/import round-trip** — run the export → re-import through the iOS Files/share-sheet picker on the installed PWA; confirm the owner-match merge with zero data loss. (JSON export is the eviction backstop per CLAUDE.md.)
2. **On-device iOS offline airplane-mode leg** — confirm precache/IndexedDB survival and SW behavior under airplane mode on the installed iPhone PWA. (iOS Safari IndexedDB eviction is a documented risk per MEMORY/CLAUDE.md.)

Both require a short tunnel-backed iPhone pass before show #1.

### Gaps Summary

There are no code or artifact gaps: VALID-01 is fully closed (CLI, re-tag, zero-regression backtest all verified in the codebase), and the VALID-02 core show loop demonstrably passed on the real iPhone with its two D-09 blocker fixes present and wired. All 587 tests pass.

The single honest shortfall against the phase goal is that two named/implied on-device legs of VALID-02 — the JSON export/import round-trip and the offline airplane-mode leg — were exercised on **desktop localhost** rather than the iPhone, because the owner declined the cloudflared tunnel this run. The underlying merge and offline logic are functionally confirmed (desktop, secure context) and identical in code, so this is device-surface confirmation, not broken behavior. The owner explicitly dispositioned it as deferred / non-blocking in `10-HUMAN-UAT.md ## Gaps`.

**Verifier judgment:** This is not `passed` — the decision tree forbids `passed` while a legitimate human-verification item exists, and the SC2 criterion literally says "on a real device ... JSON export/import round-trip." It is also not `gaps_found` — there is no code to plan or fix; the outstanding work is a manual iOS re-test. Correct disposition is **human_needed**: surface the two on-device legs for a pre-show-#1 iPhone pass, while recording that the owner has already accepted them as non-blocking for phase closure. A human should confirm whether the owner's non-blocking disposition stands or whether the on-device pass is required before this phase is considered fully closed.

---

## Owner Decision (2026-07-18)

The owner reviewed this `human_needed` verdict and chose **option A — accept the deferred disposition**. The two outstanding on-device iOS legs (JSON export/import round-trip through the iOS file picker; offline airplane-mode leg on the installed PWA) are accepted as **non-blocking** for phase closure — the underlying logic is code-complete, passes the full 587-test trust gate, and was confirmed on desktop localhost; the VALID-02 core loop passed on the real iPhone. The two legs are tracked in `10-HUMAN-UAT.md ## Gaps` as a short tunnel/deploy-backed iPhone pass to run before show #1.

**Phase 10 is complete.** This closes the v1.1 "Polish & Pre-Show Hardening" milestone.

### Resolution (2026-07-19)

The owner subsequently stood up the cloudflared tunnel and completed both on-device legs on the installed iPhone PWA: **test 6 (offline airplane-mode) and test 7 (export/import round-trip) both PASSED on-device.** iOS service-worker/precache survival under airplane mode and the iOS Files/share-sheet import owner-match merge (zero data loss) are both confirmed. The `human_needed` items are satisfied — VALID-02 is now a clean, full on-device pass with no outstanding device-surface confirmation. **Verification status upgraded human_needed → passed.**

(One post-rehearsal UI polish fix also landed and was device-verified: `5647cab` — the Show-Mode FAB now lifts only when a suggestion row is actually on screen, not when the strip slot is merely reserved.)

---

_Verified: 2026-07-18T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Owner decision recorded: 2026-07-18 (accepted-deferred, option A); resolved on-device 2026-07-19 (status → passed)_

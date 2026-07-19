---
phase: 12-data-safety-integrity
verified: 2026-07-19T17:24:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "On a real iOS Safari device (installed PWA and a browser tab): end a show and confirm the auto-backup JSON actually downloads and saves."
    expected: "The backup .json file lands in Downloads / Files without the download aborting."
    why_human: "SAFE-02 is a browser-timing fix (deferred object-URL revoke). The deferred-revoke logic is unit-proven with fake timers, but only a real iOS Safari download surface can confirm the same-tick-abort no longer occurs. jsdom cannot exercise the OS download path."
  - test: "On a real iOS Safari device: open a share card and confirm the PNG downloads and saves (web-share unavailable / dismissed fallback branch)."
    expected: "The share-card .png saves without the download aborting."
    why_human: "Same as above — the anchor-download fallback path can only be validated against a live iOS Safari download surface."
  - test: "Restore a backup that was exported immediately after ending a show, then observe whether any show appears 'active'."
    expected: "The restored show is finalized (read-only); no show is resurrected as active."
    why_human: "SAFE-01 ordering (finalize-before-snapshot) is unit-proven via a call-order assertion, but the end-to-end export→restore round-trip on a device confirms the observable user-facing outcome."
---

# Phase 12: Data Safety & Integrity Verification Report

**Phase Goal:** The exported JSON backup — the iOS-eviction backstop — is always honest and complete, and same-date doubleheaders survive as distinct attendances through merge and dex derivation.
**Verified:** 2026-07-19T17:24:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | SAFE-01: Ending a show then exporting always records that show as finalized — a restored backup never resurrects an "active" show | ✓ VERIFIED | `EndShowDialog.handleConfirm` (L88-94) is `async` and `await endShow(sessionId)` runs BEFORE `await exportBackup()`. Test `endShowDialog.test.tsx:127` asserts `calls === ["endShow","exportBackup"]` with `endShow` resolving on a microtask before the snapshot read. Device round-trip flagged for human. |
| 2 | SAFE-02: Backup and share-card downloads complete on iOS Safari — no same-tick `revokeObjectURL` aborts the download | ✓ VERIFIED (logic) / ⚠ device UAT pending | `triggerDownload.ts` defers revoke via `setTimeout(..., config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS)`; no bare same-tick revoke. `triggerDownload.test.tsx` asserts revoke NOT called at delay-1 and called once at delay. Both consumers rewired (exportDownload L53, shareCard L282). Real-device iOS completion → human. |
| 3 | SAFE-03: "Backup saved" confirmation appears only after a real success, never while the dialog is open | ✓ VERIFIED | `showBackupToast()` fires only inside `if (ok)` after `exportBackup()` resolves (EndShowDialog L92-93). Static `CircleCheck`/`endShowBackupConfirmation` markup removed from the dialog (0 matches). Toast hosted app-level (`App.tsx:84`). Tests assert toast once on `{ok:true}`, zero on `{ok:false}`, and copy absent while open (`endShowDialog.test.tsx:137,150,159`). |
| 4 | SAFE-04: Two same-date shows survive as two distinct attendances across merge and dex derivation | ✓ VERIFIED | Shared `attendanceKey(showId,date,sessionId)` keys unbound by `date:${date}#${sessionId}`; bound `id:${showId}` untouched. `merge.test.ts:269` asserts 2 trackedShows for two unbound same-date sessions; `derive-dex.test.ts:111` asserts `showCount===2`; bound-dedup retained (`toHaveLength(2)` entries for show 999 / `showCount===1`). |

**Score:** 4/4 truths verified (SAFE-02 pending device UAT confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/data-safety/attendance-key.ts` | Shared pure `attendanceKey` helper | ✓ VERIFIED | Exports `attendanceKey`; unbound branch `date:${date}#${sessionId}`. DOM-free, erasable-syntax-only. |
| `packages/core/src/data-safety/merge.ts` | Consumes shared key, no local twin | ✓ VERIFIED | Imports `attendanceKey` (L23); used L184/288/291. No `function attendanceGroupKey` remains anywhere in core (0 matches). |
| `packages/core/src/dex/derive-dex.ts` | Consumes shared key; grouping/archive-join unchanged | ✓ VERIFIED | Imports `attendanceKey` (L14); retro call passes `""` sessionId (L134), tracked passes real sessionId (L138). Grouping/`showIds.add` guard intact (L132-165). |
| `packages/app/src/components/BackupToast.tsx` | App-level toast + module emitter | ✓ VERIFIED | Exports `BackupToast`, `showBackupToast`, `subscribeBackupToast`. Auto-dismiss timer, cleanup on unmount, reuses `endShowBackupConfirmation` copy, `config.ui.z.toast`. |
| `packages/app/src/App.tsx` | Hosts `<BackupToast/>` above router | ✓ VERIFIED | `<BackupToast />` sibling of `<UpdateToast />` (L83-84). |
| `packages/app/src/show/EndShowDialog.tsx` | Async finalize→backup→toast; static markup removed | ✓ VERIFIED | `handleConfirm` async ordering correct; static confirmation removed; `ShieldAlert` persist block retained. |
| `packages/app/src/settings/triggerDownload.ts` | Single deferred-revoke helper | ✓ VERIFIED | Exactly ONE `export function triggerDownload` in app src; `rel="noopener"`, deferred revoke. |
| `packages/app/src/config.ts` | `OBJECT_URL_REVOKE_DELAY_MS` | ✓ VERIFIED | `= 5000` (in the 1000–10000 ms safe band), in the `dataSafety` block. |
| Tests (merge, derive-dex, endShowDialog, triggerDownload, shareCard) | Regression coverage | ✓ VERIFIED | Genuine assertions (not stubs). Full repo suite 627/627 green across 78 files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| merge.ts | attendance-key.ts | `import attendanceKey` | ✓ WIRED | Imported + called at 3 sites. |
| derive-dex.ts | attendance-key.ts | `import attendanceKey` | ✓ WIRED | Imported + called at both grouping sites. |
| EndShowDialog.tsx | BackupToast.tsx | `showBackupToast()` on `{ok:true}` | ✓ WIRED | Called inside `if (ok)` after `await exportBackup()`. |
| App.tsx | BackupToast.tsx | render `<BackupToast/>` | ✓ WIRED | Rendered in overlay stack above tab router. |
| exportDownload.ts | triggerDownload.ts | `triggerDownload(blob, filename)` | ✓ WIRED | Replaces inner try/finally; 0 `revokeObjectURL` in file; outer never-throw `{ok}` wrapper retained. |
| shareCard.ts | triggerDownload.ts | `triggerDownload(file, file.name)` | ✓ WIRED | Fallback branch (L282); `previewUrl` left intact with a not-a-leak comment. |
| triggerDownload.ts | config.ts | `OBJECT_URL_REVOKE_DELAY_MS` | ✓ WIRED | `setTimeout(revoke, config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS)`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SAFE-04 doubleheader survives merge + dex | `vitest run merge.test.ts derive-dex.test.ts` | 34 passed | ✓ PASS |
| SAFE-01/03 ordering + toast-only-on-success | `vitest run endShowDialog.test.tsx` | 8 passed | ✓ PASS |
| SAFE-02 deferred revoke | `vitest run triggerDownload.test.tsx shareCard.test.tsx` | 11 passed | ✓ PASS |
| Full repo regression | `vitest run` | 627 passed / 78 files | ✓ PASS |
| App + core typecheck | `tsc --noEmit` (both projects) | exit 0 / exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SAFE-01 | 12-02 | Ended show is finalized before backup; restore never resurrects active | ✓ SATISFIED | Async finalize-before-snapshot ordering + call-order test |
| SAFE-02 | 12-03 | Downloads complete on iOS Safari; no same-tick revoke | ✓ SATISFIED (device UAT pending) | Deferred-revoke helper + fake-timer test; iOS completion → human |
| SAFE-03 | 12-02 | "Backup saved" only after real success | ✓ SATISFIED | Toast gated on `{ok:true}`; static markup removed; tests |
| SAFE-04 | 12-01 | Same-date doubleheaders stay distinct across merge + dex | ✓ SATISFIED | Shared `attendanceKey`; inverted regression tests |

All four requirement IDs (SAFE-01..04) are claimed by phase plans and confirmed complete in REQUIREMENTS.md. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX debt markers in phase-modified files | ℹ Info | Clean — completion is auditable |
| App.tsx | 8,42-50 | `OrbFitHarness` dev harness ships in prod bundle (REVIEW IN-01) | ℹ Info | Pre-existing, out of Phase 12 scope; exposes only public catalog names |

### Advisory Review Findings (from 12-REVIEW.md — not gaps)

Assessed against the phase goal; none falsify a SAFE-01..04 success criterion:

- **WR-01 (`added.songs` overcount):** The import *success-toast metric* can over-count cross-device shared songs when the incoming copy wins canonical. This touches the phase's "honest numbers" throughline at the margin, but it is NOT part of the SAFE-01..04 contract, and the backup content and dex derivation themselves remain complete and correct (the song *set* is right; only the "N songs added" count inflates). WARNING-level, advisory — recommend fixing but does not block the goal.
- **WR-02 / WR-03 (persist-denied nudge):** Both concern the D-13 persist-warning UX (consumed on dialog open; re-renders on reopen within a mount). This is the separate storage-nudge feature, outside the SAFE-01..04 backup-honesty contract. Advisory.

### Human Verification Required

1. **iOS Safari backup download** — End a show on a real iOS device (installed PWA and browser tab); confirm the backup `.json` actually saves without aborting. SAFE-02's deferred-revoke is unit-proven but the real iOS download surface cannot be exercised in jsdom.
2. **iOS Safari share-card download** — Open a share card on a real iOS device; confirm the `.png` saves via the anchor fallback without aborting.
3. **Export→restore round-trip (SAFE-01)** — Export immediately after ending a show, restore, and confirm no show comes back "active". Ordering is unit-proven; device round-trip confirms the observable outcome.

### Gaps Summary

No blocking gaps. All four success criteria are implemented, wired, and covered by genuine tests; the full repo suite (627 tests) and both typechecks pass. The single reason status is `human_needed` rather than `passed` is the SAFE-02 iOS Safari device UAT — explicitly non-unit-testable and called out in the 12-03 plan and summary. The three 12-REVIEW warnings are advisory and do not invalidate any SAFE-01..04 criterion.

---

_Verified: 2026-07-19T17:24:00Z_
_Verifier: Claude (gsd-verifier)_

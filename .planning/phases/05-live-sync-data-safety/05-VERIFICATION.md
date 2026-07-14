---
phase: 05-live-sync-data-safety
verified: 2026-07-14T04:55:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "PWA-04 / SC4 / D-10 / T-05-07: import into a NON-empty DB no longer drops rows — merged trackedEntries are id-less and keyed on (sessionId, position); importSnapshot commits trackedEntries via clear()+bulkAdd() inside the existing atomic rw transaction."
    - "WR-01: a same-show entry-count tie now keeps the LOCAL show as canonical (localSessionIds tie-break in merge.ts)."
    - "Sibling defect found during gap-closure code review (not in original gap list, fixed same session): trackedShows was left on upsert-only bulkPut, so a D-11 dedupe-collapse could orphan a dropped local session's now-zero-entry trackedShows row. Fixed via trackedShows.clear()+bulkPut() (full-replace) in the same rw transaction, with a dedicated regression test."
  gaps_remaining: []
  regressions: []
---

# Phase 5: Live Sync + Data Safety Verification Report

**Phase Goal:** The app politely borrows kglw.net's live editors as a second set of eyes without ever clobbering manual tracking, and losing a phone can never mean losing a dex.
**Verified:** 2026-07-14 (human verification complete)
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 05-06 + a same-session follow-up fix)

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SYNC-01: During an active show, polls only `latest` at most once/60s — never the full `setlists` endpoint from clients | ✓ VERIFIED | Unchanged since prior round (confirmed no file in `packages/*/src/live/` was touched by 05-06 — `git diff --stat` between the pre-gap-closure and post-follow-up commits touches only 6 data-safety files). `config.ts`: `latestPath="/latest.json"`, `POLL_INTERVAL_MS=60000`. `useLatestPoll.ts` uses a single self-scheduling `setTimeout` (never `setInterval`), gated on active-show/online/visible. No `setlists` endpoint referenced in app code. |
| 2 | SYNC-02: Editor-logged songs appear as dismissible suggestions only, deduped by song ID, never auto-merged | ✓ VERIFIED | Unchanged since prior round (not touched by gap closure). `suggest.ts` `diffLatestAgainstTrail` dedupes by `song_id`; `SuggestionStrip.tsx` renders tap-X + swipe dismiss; adopt is explicit, `source:'editor'`. No auto-apply path. |
| 3 | SYNC-03: Offline the app remains fully functional; polling resumes silently when signal returns | ✓ VERIFIED (code) | Unchanged since prior round (not touched by gap closure). `useLatestPoll.ts` gates each tick on `navigator.onLine && visibilityState==="visible"`; never-throw poller; `useOnlineStatus` re-arms on reconnect. Runtime confirmation still routed to human verification (unchanged item, see below). |
| 4 | PWA-04: All personal data round-trips through prominently surfaced JSON export/import, never losing a local row — losing a phone never loses a dex | ✓ VERIFIED | **Previously FAILED (CR-01), now fixed and re-verified against current code.** `merge.ts`'s `entriesByKey`/`unionEntries` strip the volatile `id` at population time (`const { id: _id, ...rest } = row`); survival is keyed only on `entryKey(e) = "${sessionId} ${position}"`. `serialize.ts`'s `serializeExport` maps `trackedEntries` to omit `id` before export. `db.ts`'s `importSnapshot` (lines 430-446) commits `trackedEntries` via `db.trackedEntries.clear()` + `bulkAdd(...)` — no more `bulkPut`-by-id — inside the single existing `db.transaction("rw", ...)` block, alongside `bulkPut` for `meta`/`attendedShows` and, notably, `trackedShows.clear()` + `bulkPut(...)` (full-replace, the same-session follow-up fix for the orphaned-duplicate sibling defect). Verified directly by reading the current file (not from SUMMARY claims). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/data-safety/merge.ts` | id-less `trackedEntries` union + local-wins same-show tie-break | ✓ VERIFIED | Read current file: `entriesByKey` strips `id` on both incoming and local population (lines 137-145); `localSessionIds` set + `isTieLocalWin` condition (lines 171-186) makes a genuine entry-count tie keep the LOCAL show. |
| `packages/core/src/data-safety/serialize.ts` | `serializeExport` omits volatile `id` | ✓ VERIFIED | `trackedEntries: snapshot.trackedEntries.map(({ id: _id, ...rest }) => rest)` (line 53). |
| `packages/app/src/db/db.ts` | `importSnapshot` commits `trackedEntries` by logical identity, atomically | ✓ VERIFIED | `trackedEntries.clear()` + `bulkAdd(...)` (lines 442-443), and `trackedShows.clear()` + `bulkPut(...)` (lines 440-441), both inside one `db.transaction("rw", meta, attendedShows, trackedShows, trackedEntries, ...)` block. |
| `packages/app/test/exportImportRoundtrip.test.ts` | Regression test: import into a populated DB with overlapping ids preserves all rows; dedupe-collapse doesn't orphan a row | ✓ VERIFIED | New `describe` block (line 177) with two `it`s: (1) overlapping-id union across two distinct shows — asserts `trackedEntries.count()===4`, both `trackedShows` survive; (2) same-show dedupe collapse — asserts the dropped local `trackedShows` row is actually removed (`toBeUndefined()`), not left as an orphan, and its entries are gone. Both read directly (not summarized) — content matches the claims in SUMMARY and REVIEW. |
| `packages/core/src/live/poll-latest.ts`, `packages/app/src/live/useLatestPoll.ts`, `packages/core/src/live/suggest.ts`, `packages/app/src/live/SuggestionStrip.tsx` | SYNC-01/02/03 artifacts | ✓ VERIFIED (unchanged) | Not modified by the gap-closure session (confirmed via `git diff --stat` across the full 05-06 + follow-up commit range — zero touches to `src/live/`). Spot-checked config constants and gating logic still present and consistent with the prior VERIFIED finding. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `importPicker` (`pickAndImport`) | core `parseAndMergeImport` → `importSnapshot` | validate+merge then atomic commit | ✓ WIRED | Merge produces id-less, logically-keyed rows; `importSnapshot` commits them by `clear()+bulkAdd`/`clear()+bulkPut` inside one transaction — no id collision path remains. |
| `useLatestPoll` | core `pollLatest` | injected fetch in gated tick | ✓ WIRED (unchanged) | Not touched by gap closure. |
| `SuggestionStrip` | `diffLatestAgainstTrail`/`resolvePlaceholders` | derives shown suggestions | ✓ WIRED (unchanged) | Not touched by gap closure. |
| `exportDownload` | core `serializeExport` | serialize snapshot then anchor-download | ✓ WIRED | `serializeExport` now strips `id`; round-trips through `exportEnvelope.parse` by construction; `export-schema.ts`'s `trackedEntryRow.id` stays optional so legacy backups with an id still validate. |

### Test / Verification Execution (run directly by this verifier, not taken from SUMMARY)

| Check | Command | Result |
| --- | --- | --- |
| Full suite | `npm test` (root, from repo) | 36 test files, 271 tests — **all passed** |
| App typecheck | `npx tsc --noEmit` (packages/app) | Clean, no errors |
| Core typecheck | `npx tsc --noEmit` (packages/core) | Clean, no errors |
| Debt markers | `grep TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` on merge.ts/serialize.ts/db.ts | None found |

New/relevant test files confirmed present and containing the claimed assertions by direct read (not SUMMARY-trust): `packages/core/test/merge.test.ts` (describe blocks "id-less merge output (CR-01 / T-05-07)" and WR-01 tie-break within "same-show dedupe (D-11)"), `packages/core/test/serialize.test.ts` (id-omission assertions), `packages/app/test/exportImportRoundtrip.test.ts` (populated-DB overlapping-id test + dedupe-collapse-no-orphan test).

### Regression Check (Steps requested: confirm no other must-have regressed)

- **SYNC-01/02/03**: Not regressed. The gap-closure session (`git diff --stat` across all 05-06 + follow-up commits) touched exactly 6 files, all under `packages/core/src/data-safety/`, `packages/app/src/db/db.ts`, and their test files. Zero files under `packages/core/src/live/` or `packages/app/src/live/` were modified. Config constants (`latestPath`, `POLL_INTERVAL_MS`) and gating logic (`setTimeout`-only, online/visible gate) read identically to the prior VERIFIED round.
- **PWA-04's other success-criteria pieces** (prominent Settings surface, wipe-then-restore round-trip, zod validation/rejection of bad files): Not regressed — `SettingsView.tsx` was not touched; the "rejects a malformed file" and "rejects a well-formed-but-not-a-backup file" tests are unchanged and still pass; the original wipe-then-restore test was updated only to resolve by logical identity instead of a pinned `id`, and still passes.
- **No new regressions** introduced by the fixes: full suite green, both packages typecheck clean.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SYNC-01 | 05-01, 05-03, 05-04 | Poll `latest` ≤1/60s during show, never `setlists` from clients | ✓ SATISFIED | Unchanged from prior round; not touched by gap closure. |
| SYNC-02 | 05-01, 05-03, 05-04 | Editor songs = suggestions only, dedupe by song ID, no auto-merge | ✓ SATISFIED | Unchanged from prior round; not touched by gap closure. |
| SYNC-03 | 05-04 | Fully functional offline; polling resumes silently | ✓ SATISFIED (code) | Unchanged from prior round; not touched by gap closure. Runtime confirmation still human-required. |
| PWA-04 | 05-02, 05-03, 05-05, 05-06 | All personal data exports/imports as JSON, prominently surfaced; lose-a-phone safe; never drops a local row on merge | ✓ SATISFIED | CR-01 (id-collision data loss) and its sibling orphaned-trackedShows defect are both fixed and covered by direct-read-confirmed regression tests. |

All four declared requirement IDs are claimed by plan frontmatter (05-01 through 05-06). No orphaned requirements (REQUIREMENTS.md maps exactly SYNC-01/02/03 + PWA-04 to Phase 5).

**Documentation-tracking discrepancy noted (not a code gap):** `.planning/REQUIREMENTS.md`'s checkbox table still shows SYNC-01/SYNC-02/SYNC-03 as unchecked `[ ]` with status "Pending" in the traceability table (lines 61-63, 184-186), while PWA-04 is correctly marked `[x]` "Complete (05-06 gap closure...)". Since the underlying code for SYNC-01/02/03 was independently re-confirmed unchanged and passing in this round, this looks like a stale tracking artifact from the gap-closure pass only updating the PWA-04 row — recommend updating REQUIREMENTS.md's SYNC-01/02/03 checkboxes/status to reflect their already-VERIFIED state, but this does not block phase completion since it is a doc-sync issue, not a functional gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/core/src/data-safety/merge.ts` | 51-53 | `entryKey` uses a literal NUL byte (`\0`) as its field separator instead of a visible delimiter | ℹ️ Info | Pre-existing quirk (05-02), noted in 05-REVIEW.md IN-01. Behavior is correct today; cosmetic/defensive-clarity fix only, non-blocking. |
| `packages/core/src/live/suggest.ts` | ~96-113 | `resolvePlaceholders` aligns editor global position to local trail position | ⚠️ Warning | Carried forward from prior round (WR-04); advisory/user-gated, explicitly deferred per 05-06's scope note. |
| `packages/core/src/data-safety/merge.ts` | ~45-48 | `attendanceGroupKey` differs for bound vs unbound copy of the same night | ⚠️ Warning | Carried forward from prior round (WR-02); explicitly deferred per 05-06's scope note. |
| `packages/app/src/settings/importPicker.ts` | ~65-78 | File `<input>` never attached to DOM/removed | ℹ️ Info | Carried forward from prior round (IN-03); explicitly deferred per 05-06's scope note. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file touched by the gap-closure session.

### Human Verification Required

**ALL THREE RESOLVED — see 05-HUMAN-UAT.md (status: resolved, 3/3 passed).** Test 1 passed on-device 2026-07-14; Test 2 passed via automated Playwright drive 2026-07-14 (owner-approved method); Test 3 passed on-device 2026-07-14 (installed iOS PWA over HTTPS tunnel), pre-verified by a 14/14 automated Playwright drive.

(Original items, carried forward unchanged from the prior verification round — none of these are affected by the gap-closure fix, and none can be resolved by static inspection.)

1. **Offline resilience** — Enable airplane mode during an active show; keep logging songs; re-enable network. Expected: app stays fully functional offline (orbit, logging, trail), no error banner, polling resumes silently within one interval when signal returns. Why human: runtime online/offline transition and silent-resume behavior cannot be verified statically.
2. **Suggestion adopt/dismiss + layout stability** — Tap Add on an editor suggestion; dismiss another via both tap-X and horizontal swipe. Expected: adopt logs the song (`source:'editor'`, correct hit/miss); dismiss removes the row with nothing logged; the orbit fan above never re-lays-out. Why human: visual layout stability and gesture behavior are UI-runtime concerns.
3. **End-show auto-download on installed iOS PWA** — End a show on an installed iOS PWA. Expected: backup JSON auto-downloads with a muted confirmation; a persist-denied warning shows at most once. Why human: installed-PWA auto-download and iOS persistence behavior require a real device (deferred per 05-VALIDATION Manual-Only).

### Gaps Summary

No gaps remain. All four Phase 5 success criteria are now code-verified:

- SYNC-01/02/03 ("second set of eyes" half of the goal) were already VERIFIED in the prior round and are confirmed unchanged (zero files under `src/live/` touched by the gap-closure session).
- PWA-04 ("losing a phone can never mean losing a dex" half of the goal), the previously FAILED criterion, is now VERIFIED: the CR-01 id-collision data-loss defect is fixed at its root (id stripped at the merge boundary, logical-identity commit in `importSnapshot`), the WR-01 tie-break now keeps the local setlist, and a same-session follow-up fix closed a sibling defect (orphaned `trackedShows` duplicate on a dedupe-collapse) that code review caught before it could ship. All fixes are backed by regression tests confirmed (by direct read) to assert on the exact previously-broken behavior, not just on the pure in-memory merge function. The full 271-test suite passes and both packages typecheck cleanly.

Status flipped from `human_needed` to `passed` on 2026-07-14: all three deferred runtime/device checks (offline transition, gesture/layout behavior, installed-iOS-PWA auto-download) passed human/automated UAT — see 05-HUMAN-UAT.md for per-test evidence.

---

_Verified: 2026-07-13 (code) / 2026-07-14 (human UAT complete)_
_Verifier: Claude (gsd-verifier); human UAT: owner_

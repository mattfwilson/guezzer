---
phase: 05-live-sync-data-safety
verified: 2026-07-13T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "All personal data (attended shows, tracked setlists, dex) round-trips through export/import without ever losing a local row (PWA-04 / SC4 / D-10 / T-05-07)"
    status: partial
    reason: >
      A full wipe-then-restore round-trip works, but importing a backup into a
      NON-empty database (the friend-as-second-set-of-eyes merge that is the
      entire reason this phase exists) silently drops rows. The core union-merge
      correctly keeps every row by (sessionId, position), but each merged entry
      still carries its device-local Dexie ++id auto-increment key. Two devices
      both start ids at 1, so the merged trackedEntries array contains colliding
      ids; importSnapshot commits via bulkPut (upsert by id), collapsing colliding
      ids last-write-wins and destroying a mix of local and incoming rows. This
      breaks the D-10 / T-05-07 "never drop a local row" invariant the phase
      explicitly promises. The passing round-trip test misses it because it
      wipeAll()s before every import, so ids never collide across sources.
    artifacts:
      - path: "packages/app/src/db/db.ts"
        issue: >
          importSnapshot (lines 418-429) commits trackedEntries via bulkPut,
          which upserts by the device-local ++id primary key — not by the logical
          (sessionId, position) identity the merge unioned on. Colliding ids drop rows.
      - path: "packages/core/src/data-safety/merge.ts"
        issue: >
          finalEntries (lines 178-180) carry each row's original device-local `id`
          through the merge instead of stripping it or reconciling against local
          rows by (sessionId, position).
      - path: "packages/core/src/data-safety/export-schema.ts"
        issue: >
          trackedEntryRow (lines 62-63) serializes the volatile ++id, so exported
          backups carry per-device ids that collide on merge.
      - path: "packages/app/test/exportImportRoundtrip.test.ts"
        issue: >
          Every import test wipeAll()s before importing (line 114), so ids never
          collide — the real friend-merge / import-into-populated-DB scenario is untested.
    missing:
      - "Strip or reconcile the device-local `id` in merge output (key survival by (sessionId, position), not ++id)"
      - "Change importSnapshot to commit trackedEntries by logical identity (e.g. clear + bulkAdd id-less merged rows inside the same rw transaction), so a per-device counter never decides row survival"
      - "Add a regression test that imports a backup into a NON-empty DB whose trackedEntry ids overlap the incoming file, asserting all local + incoming rows survive"
human_verification:
  - test: "With the app loaded, enable airplane mode during an active show; keep logging songs, then re-enable network."
    expected: "App stays fully functional offline (orbit, logging, trail); no error banner; polling resumes silently within one interval when signal returns."
    why_human: "Runtime offline/online transition and silent-resume behavior cannot be verified by static inspection."
  - test: "During an active show, tap Add on an editor suggestion, and dismiss another via both tap-X and horizontal swipe."
    expected: "Adopt logs the song (source:'editor', correct hit/miss); dismiss removes the row with nothing logged; the orbit fan above never re-lays-out."
    why_human: "Visual layout stability and gesture behavior are UI-runtime concerns."
  - test: "End a show on an installed iOS PWA."
    expected: "Backup JSON auto-downloads with a muted confirmation; a persist-denied warning shows at most once."
    why_human: "Installed-PWA auto-download and iOS persistence behavior require a real device (deferred per 05-VALIDATION Manual-Only)."
---

# Phase 5: Live Sync + Data Safety Verification Report

**Phase Goal:** The app politely borrows kglw.net's live editors as a second set of eyes without ever clobbering manual tracking, and losing a phone can never mean losing a dex.
**Verified:** 2026-07-13
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SYNC-01: During an active show, polls only `latest` at most once/60s — never the full `setlists` endpoint from clients | ✓ VERIFIED | `config.ts`: `latestPath="/latest.json"`, `POLL_INTERVAL_MS=60000`. `poll-latest.ts` fetches only `${apiBase}${latestPath}`, one GET per call. `useLatestPoll.ts` uses a single self-scheduling `setTimeout` (never `setInterval`), armed one interval out, gated on an active show; backoff only grows the delay, never below the 60s floor. No `setlists` endpoint referenced anywhere in app code (only a copy string mentions the word "setlists"). |
| 2 | SYNC-02: Editor-logged songs appear as dismissible suggestions only, deduped by song ID, never auto-merged | ✓ VERIFIED | `suggest.ts` `diffLatestAgainstTrail` dedupes by `song_id` against logged ids, returns next 1-2, never contradicts a logged song. `SuggestionStrip.tsx` renders each row with tap-X + horizontal-swipe dismiss (non-destructive); adopt is an explicit user action routed through `adoptSuggestion` (`source:'editor'`). No code path auto-applies a suggestion. |
| 3 | SYNC-03: Offline the app remains fully functional; polling resumes silently when signal returns | ✓ VERIFIED (code) | `useLatestPoll.ts` gates each tick on `navigator.onLine && visibilityState==="visible"`; an ineligible tick performs no fetch and reschedules at the floor. `pollLatest` returns `[]` and never throws on any soft failure. `useOnlineStatus` re-arms the loop on a connectivity flip. Local state is Dexie/IndexedDB (no network dependency). Runtime confirmation routed to human verification. |
| 4 | PWA-04: All personal data round-trips through prominently surfaced JSON export/import — losing a phone never loses a dex | ✗ FAILED | Export/Import are surfaced in `SettingsView.tsx` (accent Export CTA). Wipe-then-restore round-trip works (test passes). BUT import into a NON-empty DB (friend merge / re-import) drops rows: merged `trackedEntries` carry device-local `++id` keys that collide across devices, and `importSnapshot` `bulkPut`s by `id` — last-write-wins silently destroys local and/or incoming rows, breaking the D-10 "never drop a local row" invariant. See CR-01. |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/live/poll-latest.ts` | Tolerant `latest` poller | ✓ VERIFIED | Single GET, artist_id===1 scope, never throws (returns `[]`). |
| `packages/core/src/live/suggest.ts` | `diffLatestAgainstTrail` + `resolvePlaceholders` | ✓ VERIFIED | Dedupe-by-song_id; placeholder fill-hints. (WR-04: fill aligns editor global position to local trail position — advisory, user-gated.) |
| `packages/app/src/live/useLatestPoll.ts` | Single-timer gated poll loop | ✓ VERIFIED | Self-scheduling timeout, active/online/visible gating, unmount cleanup. |
| `packages/app/src/live/SuggestionStrip.tsx` | Fixed-height advisory strip | ✓ VERIFIED | Fixed height, escaped untrusted text, dismiss via X + swipe, adopt/fill actions. |
| `packages/core/src/data-safety/merge.ts` | validate→migrate→union-merge→dedupe | ⚠️ PARTIAL | Core union is correct, but carries device-local `id` through the merge (root of CR-01 at commit). WR-01 (tie drops LOCAL setlist) and WR-02 (bound/unbound same-night not collapsed) are correctness gaps. |
| `packages/app/src/db/db.ts` | v3 migration + `importSnapshot` | ⚠️ PARTIAL | v3 additive migration + adopt/bind helpers sound; `importSnapshot` `bulkPut`-by-id is the data-loss defect (CR-01). |
| `packages/app/src/settings/SettingsView.tsx` | Export/Import + storage status | ✓ VERIFIED | Accent Export CTA, neutral Import, counts on success, error copy, storage readout, no destructive control. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `useLatestPoll` | core `pollLatest` | injected fetch in gated tick | ✓ WIRED | `pollLatest({ fetch: boundFetch })` inside eligibility-gated `tick`. |
| `SuggestionStrip` | `diffLatestAgainstTrail`/`resolvePlaceholders` | derives shown suggestions | ✓ WIRED | Consumes `Suggestion[]`/`FillHint[]` (derived upstream in ShowView). |
| `importPicker` | core `parseAndMergeImport` → `importSnapshot` | validate+merge then atomic commit | ⚠️ PARTIAL | Wiring exists and commits atomically, but the commit key (`id`) is wrong — merged rows collide and drop (CR-01). |
| `exportDownload` | core `serializeExport` | serialize snapshot then anchor-download | ✓ WIRED | Round-trips through `exportEnvelope.parse` by construction. |
| `useHashRoute` | ROUTES allow-list | adds `'settings'` | ✓ WIRED | Route added to validated allow-list. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SYNC-01 | 05-01, 05-03, 05-04 | Poll `latest` ≤1/60s during show, never `setlists` from clients | ✓ SATISFIED | `latestPath` only; 60s single-timer; active-show gate. |
| SYNC-02 | 05-01, 05-03, 05-04 | Editor songs = suggestions only, dedupe by song ID, no auto-merge | ✓ SATISFIED | `diffLatestAgainstTrail` dedupe; dismissible strip; explicit adopt. |
| SYNC-03 | 05-04 | Fully functional offline; polling resumes silently | ✓ SATISFIED (code) | Online/visible gating; never-throw poller; re-arm on reconnect. |
| PWA-04 | 05-02, 05-03, 05-05 | All personal data exports/imports as JSON, prominently surfaced; lose-a-phone safe | ✗ BLOCKED | Surfaced + wipe-restore works, but merge-into-populated-DB drops rows (CR-01). |

All four declared requirement IDs are claimed by plan frontmatter. No orphaned requirements (REQUIREMENTS.md maps exactly SYNC-01/02/03 + PWA-04 to Phase 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/app/src/db/db.ts` | 418-429 | `bulkPut` commits by device-local `++id` after a logical-key merge | 🛑 Blocker | Silent data loss on import-into-populated-DB (CR-01). Violates D-10/T-05-07. |
| `packages/core/src/data-safety/merge.ts` | 161-174 | Same-show dedupe tie keeps `bucket[0]` = incoming; drops LOCAL setlist on a tie | ⚠️ Warning | Local-unique catches can vanish (WR-01) — contradicts D-10 "local survives" priority. |
| `packages/core/src/data-safety/merge.ts` | 45-48 | `attendanceGroupKey` differs for bound vs unbound copy of the same night | ⚠️ Warning | Same night double-counted when one device bound and the other did not (WR-02, D-11 gap). |
| `packages/core/src/live/suggest.ts` | 96-113 | `resolvePlaceholders` aligns editor global position to local trail position | ⚠️ Warning | Fill hint can name the wrong song under any position divergence (WR-04); advisory/user-gated. |
| `packages/app/src/settings/importPicker.ts` | 65-78 | File `<input>` never attached to DOM/removed | ℹ️ Info | May misbehave on some mobile browsers (IN-03). |

### Human Verification Required

1. **Offline resilience** — Airplane-mode during an active show; keep logging; re-enable network. Expected: fully functional offline, no error banner, silent poll resume. Why human: runtime online/offline transition.
2. **Suggestion adopt/dismiss + layout stability** — Adopt one editor suggestion; dismiss another via tap-X and swipe. Expected: adopt logs `source:'editor'` with correct hit/miss, dismiss logs nothing, orbit fan never re-lays-out. Why human: visual layout + gesture behavior.
3. **End-show auto-download on installed iOS PWA** — Expected: backup JSON auto-downloads with a muted confirmation; persist-denied warning shows at most once. Why human: installed-PWA + iOS persistence require a real device (deferred per 05-VALIDATION Manual-Only).

### Gaps Summary

The "second set of eyes" half of the goal is achieved: polling is polite and correctly gated (SYNC-01), editor songs are advisory-only and never auto-merged (SYNC-02), and the app is built to stay functional offline with silent resume (SYNC-03).

The "losing a phone can never mean losing a dex" half is NOT fully achieved. The literal lose-a-phone flow (reinstall onto an empty device, import the backup) works. But the merge path — importing a friend's backup, or re-importing onto a device that still holds local data — silently drops rows. The core union-merge is correct, yet each merged `trackedEntry` carries its device-local Dexie `++id`, and `importSnapshot` commits by that id via `bulkPut`. Because every device numbers ids independently from 1, the merged array contains colliding ids and last-write-wins destroys a mix of local and incoming rows. This directly violates the D-10 / T-05-07 "never drop a local row" invariant that is the stated point of the union merge. The green round-trip test hides the defect by wiping the DB before every import, so ids never collide. Independent inspection of `merge.ts`, `db.ts`, and `exportImportRoundtrip.test.ts` confirms the review's CR-01 finding: import-into-a-populated-DB does not preserve all local rows.

This is a BLOCKER for Success Criterion 4 / PWA-04 and must be fixed (strip/reconcile the volatile id in the merge, commit by logical identity, and add a populated-DB regression test) before the phase goal is met. WR-01 (tie-break drops the local setlist) is a second, related data-loss path that should be fixed in the same pass.

---

_Verified: 2026-07-13_
_Verifier: Claude (gsd-verifier)_

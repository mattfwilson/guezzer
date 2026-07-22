---
phase: 15-gizz-bingo-persistence-lock-replay
verified: 2026-07-20T22:00:00Z
status: passed
human_uat_reconciled: 2026-07-21T00:00:00Z
human_uat_source: 15-HUMAN-UAT.md
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app, tap the new 4th 'GizzGames' bottom tab"
    expected: "A 4-tab bar (LiveGizz / GizzVerse / GizzDex / GizzGames) renders with each tab still comfortably tappable; the GizzGames view shows a 'Gizz Bingo' teaser card with a visibly disabled 'Coming soon' button and a 'No cards yet' empty state. It must read as forthcoming/intentional, NOT broken or errored (D-02 explicit acceptance)."
    why_human: "D-02 requires the empty/teaser surface to 'feel intentional, not broken' — a visual/UX judgment the jsdom render tests (which confirm strings are present) cannot make. No deal UI exists this phase to create a real card, so this empty-state quality is the only end-user-visible surface fully exercisable now."
---

# Phase 15: Gizz Bingo — Persistence, Lock & Replay Verification Report

**Phase Goal:** Freeze the card artifact and its backup round-trip, wire the GizzGames tab, and make past cards replayable — before the delight layer is built on top. Marks stay derived, never stored; only the card definition + resolved square defs + seed + lock timestamp persist.
**Verified:** 2026-07-20
**Status:** passed (human UAT completed 2026-07-20, reconciled here 2026-07-21)
**Re-verification:** No — initial verification

> **Reconciliation note (2026-07-21):** The human-verification item(s) below were tested and
> passed on-device — see `15-HUMAN-UAT.md` (status `resolved`, 2/2 PASS, committed `baa9ce8`).
> Owner confirmed on iPhone (2026-07-20): the GizzGames empty/teaser state reads as intentional
> (D-02), and the "Catch me up" untick survived a live poll cycle (BINGO-06, CR-01 fix `757c2be`).
> Status updated `human_needed → passed`; the descriptive block below is preserved as-authored.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + phase invariants)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC-1: Starting a show locks the active card, freezes RESOLVED square defs into the Dexie row (corpus/config change can never re-deal a locked card); reshuffle rejected on a non-active session | ✓ VERIFIED | `db.ts:525 lockCard` stamps `lockedAt`+freezes `caughtSnapshot`, idempotent, no-op on card-less session; `db.ts:485 saveDraftCard` throws on `status==="finalized"` (l.488) and `existing.lockedAt != null` (l.494). `card:BingoCard` embeds frozen `squares`. `bingoLock.test.ts` 6 behaviors green. |
| 2 | SC-2 / BINGO-06: "Catch me up" bulk-marks from live `latest` feed (reusing adoptSuggestion) + manual search of missed songs | ✓ VERIFIED | `CatchUpSheet.tsx` pre-checked confirm-list → `adoptSuggestion(...,{shownFanSongIds:[]})` per row (l.90) + manual `logSong` miss (l.102); wired in `ShowView.tsx` (`catchUpOpen`, `catchUpCandidates` from uncapped `diffLatestAgainstTrail`, `feedError={!online}`) + `FabMenu` top "Catch me up" (`ListChecks`). `bingoCatchup.test.ts` + `catchUpSheet.test.tsx` green. |
| 3 | SC-3 / BINGO-07: View any past show's frozen card with final marks + win state from GizzDex history — pure re-derivation, not stored marks | ✓ VERIFIED | `bingoReplay.ts replayCard` re-derives via `deriveMarks`/`detectWins`; `RecapView.tsx:120` memo finds card by sessionId → replayCard, renders 4×4 board + win badges + "Lit by {song}" captions (l.316-383); section absent when no card (l.124). `bingoReplay.test.ts` + `recapView.test.tsx` present/absent contract green. |
| 4 | SC-4: v4 DB upgrades to Dexie version(5) preserving prior tables; cards round-trip through export/import (SCHEMA_VERSION bumped, MIGRATIONS added, bulkPut by stable cardId) | ✓ VERIFIED | `db.ts:287 this.version(5).stores({bingoCards:"&cardId, sessionId"})` additive, no `.upgrade`; `snapshot()` reads bingoCards (l.652); `importSnapshot` `bingoCards.bulkPut` union-only (l.712); core `MIGRATIONS[2]` (merge.ts:62) + `SCHEMA_VERSION:3` (config.ts:297). `migrationV5.test.ts`/`exportImportRoundtrip.test.ts`/`merge.test.ts` green. |
| I1 | Locked row wins a same-cardId merge collision (never reverts locked→draft) | ✓ VERIFIED | `merge.ts:170` `if (existing && existing.lockedAt != null && row.lockedAt == null) continue;` else incoming wins. Tested both directions + both-lock-state cases (`merge.test.ts:763-824`). |
| I2 | Pre-v3 backup (no bingoCards key) still parses/imports (defaults to []) | ✓ VERIFIED | `export-schema.ts:164` `.default([])`; `merge.test.ts:682,722` genuine-v2-file parse + migrate cases green. |
| I3 | Marks are DERIVED, never stored — only card def + resolved squares + seed + lock ts persist | ✓ VERIFIED | `BingoCardRow` (db.ts:157) has NO marks field — only cardId/sessionId/card/caughtSnapshot/lockedAt/showDate/venueName/city. `replayCard` re-derives on every read; RecapView/GamesView hold zero stored marks. |
| I4 | Catch-up backfill counts as a MISS (honest denominator) | ✓ VERIFIED | Every catch-up add carries `shownFanSongIds:[]` → `classifyOutcome` MISS; `bingoCatchup.test.ts:153,154,187` assert `outcome === "miss"`. |

**Score:** 4/4 success criteria verified (+ 4 phase invariants verified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/data-safety/export-schema.ts` | bingoCardRow strictObject + envelope field default [] | ✓ VERIFIED | `bingoCardRow` nests `bingoCardSchema` verbatim; `caughtSnapshot` required; `.default([])` on envelope |
| `packages/core/src/data-safety/merge.ts` | MIGRATIONS[2] + locked-wins union merge | ✓ VERIFIED | l.62 + l.163-173 + l.317 |
| `packages/core/src/data-safety/serialize.ts` | bingoCards on ExportSnapshot + passthrough | ✓ VERIFIED | l.42 + l.69 verbatim (no id-strip) |
| `packages/app/src/db/db.ts` | version(5) table + BingoCardRow + saveDraftCard/lockCard + snapshot/import threading | ✓ VERIFIED | All present; array-arity transaction for 6 stores |
| `packages/app/src/config.ts` | SCHEMA_VERSION 3 + copy.games/recap bingo/catchUp | ✓ VERIFIED | l.297 + l.972/998/1020 |
| `packages/app/src/games/bingoReplay.ts` | replayCard adapter (0-based reindex + frozen caughtSnapshot) | ✓ VERIFIED | Sort-copy 0..N-1 reindex (l.61); `new Set(row.caughtSnapshot)` (l.74); minimal subset to core |
| `packages/app/src/games/GamesView.tsx` | replay list + coming-soon teaser + honest empty state | ✓ VERIFIED | Disabled teaser + `useLiveQuery` list + empty state |
| `packages/app/src/dex/RecapView.tsx` | read-only Bingo section, absent when no card | ✓ VERIFIED | Board + win badges + Lit-by; `bingo != null` gate |
| `packages/app/src/routing/useHashRoute.ts` | games route in ROUTES | ✓ VERIFIED | `["show","explore","dex","games","settings"]` |
| `packages/app/src/components/BottomTabBar.tsx` | 4th GizzGames tab | ✓ VERIFIED | Gamepad2 icon, 4 tabs, flex-1 |
| `packages/app/src/games/CatchUpSheet.tsx` | confirm-list + manual search | ✓ VERIFIED | adoptSuggestion per row + logSong miss + feed-error/all-caught states |
| `packages/app/src/show/ShowView.tsx` + `FabMenu.tsx` | Catch me up affordance | ✓ VERIFIED | catchUpOpen state + top FabMenu action |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| export-schema.ts bingoCardRow.card | bingo/types.ts bingoCardSchema | nested reuse | ✓ WIRED (`card: bingoCardSchema`) |
| db.ts importSnapshot | db.bingoCards | stable-cardId bulkPut (not clear+rewrite) | ✓ WIRED (l.712) |
| bingoReplay.replayCard | @guezzer/core deriveMarks/detectWins | 0-based trail + frozen caughtSnapshot | ✓ WIRED |
| RecapView | db.bingoCards | useLiveQuery by sessionId, absent when none | ✓ WIRED |
| CatchUpSheet Add N | db.adoptSuggestion | one call per checked row (shownFanSongIds []) | ✓ WIRED |
| CatchUpSheet manual | db.logSong | fuse.js search → miss | ✓ WIRED |
| App.tsx route==="games" | GamesView | switch branch | ✓ WIRED (l.78-79) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BINGO-06 | 15-04 | Catch me up on late-joined show (bulk-mark from latest feed + manual search) | ✓ SATISFIED | CatchUpSheet + ShowView/FabMenu wiring; bingoCatchup.test.ts acceptance gate |
| BINGO-07 | 15-01/02/03 | View any past show's frozen card with final marks + win state | ✓ SATISFIED | replayCard + RecapView section + persistence/roundtrip |

Note: REQUIREMENTS.md line 92 traceability table still reads BINGO-07 "In progress (app replay in 15-02/03)" while the requirement checkbox (line 46) is `[x]` and the phase-map (line 91-92 area) marks the phase complete. This is a stale documentation line, not a code gap — the implementation is fully present. (ℹ️ Info)

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-15 test suite (8 files) | `vitest run` bingoLock/migrationV5/exportImportRoundtrip/bingoReplay/recapView/bingoCatchup/catchUpSheet/merge | 77 passed | ✓ PASS |
| Core typecheck | `tsc --noEmit -p packages/core` | exit 0 | ✓ PASS |
| App typecheck | `tsc --noEmit -p packages/app` | exit 0 | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| GamesView.tsx | teaser | "Coming soon" affordance (disabled) | ℹ️ Info | Plan-mandated D-02 forthcoming teaser (Phase-16 deal entry point), not a stub; disabled + documented |

No TODO/FIXME/XXX/HACK/PLACEHOLDER debt markers in any phase-15 source file.

### Human Verification Required

**1. GizzGames tab visual/UX quality (D-02 acceptance)**

- **Test:** Open the app, tap the new 4th "GizzGames" bottom tab.
- **Expected:** 4-tab bar renders with tappable targets; GizzGames view shows the "Gizz Bingo" teaser with a visibly disabled "Coming soon" button + a "No cards yet" empty state that reads as intentional/forthcoming, NOT broken.
- **Why human:** D-02 explicitly requires the empty/teaser surface to "feel intentional, not broken" — a visual judgment jsdom render tests cannot make. Because no deal UI exists this phase (Phase 16), this empty-state is the only end-user-visible surface fully exercisable now; the replay board and lock/catch-up flows are proven by fixtures and are best confirmed end-to-end in Phase 16 once cards can be dealt through the UI.

### Gaps Summary

No gaps. All four ROADMAP success criteria and all five listed phase-specific invariants are genuinely implemented in code (not stubs), wired, and covered by passing fixture/render tests. Both requirements (BINGO-06, BINGO-07) are delivered. The persistence/lock/freeze machinery is deliberately built ahead of the Phase-16 deal-UI trigger per the CONTEXT sequencing note; `saveDraftCard`/`lockCard` are fully functional helpers (fixture-tested), not stubs. The only open item is a single visual confirmation of the new GizzGames tab's empty-state quality — surfaced for human review because D-02 makes it an explicit non-automatable acceptance criterion.

---

_Verified: 2026-07-20_
_Verifier: Claude (gsd-verifier)_

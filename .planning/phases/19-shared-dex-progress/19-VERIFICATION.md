---
phase: 19-shared-dex-progress
verified: 2026-07-23T23:25:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 19: Shared Dex Progress Verification Report

**Phase Goal:** Each friend's real dex progress (completion %, catches, rarities) syncs to Supabase and is visible and comparable live in a friends view — the visible payoff of the milestone, replacing the manual JSON-file handoff.
**Verified:** 2026-07-23T23:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Friends screen lists each friend's headline progress (name + completion% + caught + rarest badge) read live from Supabase; the signed-in user's own summary upserts (debounced) on dex change (PROG-01/02/04) | ✓ VERIFIED | `FriendsList.tsx` renders `SelfRow` + `buildFriendRows`→`FriendRow` reading the pure `useFriendsProgress()` store; `useProgressSync.ts:105-115` debounced `upsertOwnProgress` gated on `ready && dex != null && online`; mounted once in `App.tsx:39`. 26 app sync/UI tests + UAT step 1 pass. |
| 2 | When a friend logs a catch, the screen updates live via `postgres_changes` — progress visibly moves (PROG-05) | ✓ VERIFIED | `progressSync.ts:158-169` `subscribeProgress` (`event:"*", table:"progress"`) → `refreshAllFriends` re-pull; `useProgressSync.ts:79-91` wires the callback. 19-04 UAT step 1: device A catch moved A's row on device B live, no refresh. |
| 3 | Write-own enforced by RLS — nobody can inflate another friend's numbers (`auth.uid()=user_id`) (PROG-03) | ✓ VERIFIED | Relied upon from Phase 17 (not re-created; zero migration). 19-04 UAT step 5: authenticated foreign-`user_id` upsert rejected server-side — HTTP 403, code `42501`, `data: null`. |
| 4 | Tapping a friend shows a live head-to-head — reconstruct minimal `DexStats` → unchanged `compareDexes` — with per-album/per-tier breakdown (PROG-06/07) | ✓ VERIFIED | `FriendDetail.tsx:62-66` `compareDexes(stats.dex, reconstructDexStats(friend.summary, rarity))`; By-rarity `DiffSection`s + By-album `AlbumSection`. Round-trip fidelity test deep-equals the UNCHANGED `compareDexes`; `friendDetail.test.tsx` pins columns populate (mine.shows=3 vs theirs.shows=5). UAT step 2 pass. |
| 5 | Each friend's rarest catches showcased (top-N by rarity), reusing the shipped six-tier language/colors (PROG-08) | ✓ VERIFIED | `selectRarestCaught` (core) + `RarestShowcase.tsx` using `config.friends.showcaseCount=5` + shipped `TierBadge`; shared by `FriendDetail` and the own trophy case. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/dex/shared-progress.ts` | projector/reconstruct/rarest/zod | ✓ VERIFIED | 257 lines; exports all 6 symbols; imports only `zod` + core types; no forbidden patterns. |
| `packages/core/src/index.ts` | barrel re-export | ✓ VERIFIED | Lines 243-248 re-export the full surface beside `compareDexes`. |
| `packages/app/src/sync/progressSync.ts` | primitives + shared store | ✓ VERIFIED | Identity-safe upserts, validated re-pull, subscribe, external store; whole-row validation (CR-01 fix) + error read/throw (WR-02 fix). |
| `packages/app/src/sync/useProgressSync.ts` | app-wide engine | ✓ VERIFIED | Signed-in gated; subscription+pull lifecycle with per-run cancel guard (WR-01 fix); debounced upsert; reconnect flush. |
| `packages/app/src/sync/useFriendsProgress.ts` | pure read hook + buildFriendRows | ✓ VERIFIED | `useSyncExternalStore` only; no channel/debounce; pure sort helper. |
| `packages/app/src/sync/friendCache.ts` | Dexie offline cache | ✓ VERIFIED | Transactional reconcile (stale-eviction, WR-03 fix); empty-pull no-op preserved. |
| `packages/app/src/db/db.ts` | version(8) friendProgressCache | ✓ VERIFIED | `this.version(8)` additive; excluded from export + userId-stamping (alongside `friendBeacons`/`mapPins`). |
| `packages/app/src/dex/FriendDetail.tsx` | reconstruct→compareDexes overlay | ✓ VERIFIED | Echoes CompareView in a new file; does NOT import CompareView. |
| `packages/app/src/dex/FriendsList.tsx` | SelfRow + sorted rows + offline/empty | ✓ VERIFIED | Reads pure hook only; no subscription. |
| `packages/app/src/dex/{FriendRow,SelfRow,RarestShowcase}.tsx` | leaf UI | ✓ VERIFIED | Present, wired into FriendsList/FriendDetail/DexView. |
| `packages/app/src/dex/DexView.tsx` | Friends segment + overlays | ✓ VERIFIED | `Segment` includes `"friends"`; segment branch + `openFriend`/`selfCaseOpen` view-state overlays, no new route. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| App.tsx | useProgressSync | `useProgressSync()` at shell (line 39) alongside `useBingoCelebrations` | ✓ WIRED |
| FriendDetail | @guezzer/core | `reconstructDexStats` → `compareDexes` | ✓ WIRED |
| FriendsList | useFriendsProgress | pure read hook over shared store | ✓ WIRED |
| progressSync | @guezzer/core | `deriveSharedProgress` on write, `parseSharedProgress` on read | ✓ WIRED |
| progressSync | db/supabase | Phase-17 singleton (no `createClient`) | ✓ WIRED |
| DexView | FriendsList/FriendDetail | segment branch + overlay | ✓ WIRED |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| PROG-01 | 19-01 | ✓ SATISFIED | `deriveSharedProgress` pure Option-B payload; core Supabase-free. See note below re: `display_name`. |
| PROG-02 | 19-02 | ✓ SATISFIED | Debounced own-row upsert; `upsertIdentity` never writes `summary`. |
| PROG-03 | 19-02, 19-04 | ✓ SATISFIED | RLS write-own confirmed server-side (UAT: 403/42501). |
| PROG-04 | 19-03 | ✓ SATISFIED | FriendsList headline rows + pinned live SelfRow. |
| PROG-05 | 19-02, 19-04 | ✓ SATISFIED | `postgres_changes` re-pull; two-device live propagation (UAT). |
| PROG-06 | 19-01, 19-03 | ✓ SATISFIED | reconstruct→unchanged `compareDexes`; round-trip test + regression pin + UAT. |
| PROG-07 | 19-01, 19-03 | ✓ SATISFIED | Per-album + per-tier breakdown in FriendDetail. |
| PROG-08 | 19-01, 19-03 | ✓ SATISFIED | `selectRarestCaught` + RarestShowcase, shipped six-tier language. |

All 8 requirement IDs declared across plan frontmatter are accounted for and cross-referenced against REQUIREMENTS.md. No orphaned requirements (REQUIREMENTS.md maps exactly PROG-01..08 to Phase 19).

**Note on PROG-01 `display_name`:** REQUIREMENTS.md lists `display_name` inside the Option-B payload. The implementation intentionally keeps `SharedProgress` a pure function of `DexStats` alone and writes `display_name` as a first-class `progress` row column (documented decision, RESEARCH A1/Open-Q1, D-19). The requirement's intent — a friend's name synced and rendered per row — is fully achieved (`upsertOwnProgress` writes the column; `validateFriendRow` reads it; `FriendRow`/`FriendDetail` render it; UAT step 2 shows "You vs A"). This is an architectural placement difference, not a functional gap.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Core projector/reconstruct/round-trip/parse | `vitest run shared-progress.test.ts purity.test.ts` | 10 passed | ✓ PASS |
| App sync engine + UI (mount, debounce, re-pull, offline, sort, head-to-head) | `vitest run --project @guezzer/app test/sync test/friendDetail` | 26 passed | ✓ PASS |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| FriendsList | `friends` | shared store ← `refreshAllFriends` (Supabase select → validated rows) / offline cache | Yes (live + UAT-confirmed) | ✓ FLOWING |
| SelfRow | live dex | `useDexStats()` local derive | Yes | ✓ FLOWING |
| FriendDetail | `compare` | `compareDexes(mine, reconstructDexStats(friend.summary, rarity))` | Yes | ✓ FLOWING |

Reserved `FriendRow` presence slots render nothing by design (Phase-20 PRES-07 fusion points, hard-constraint structural requirement) — not disconnected data.

### Hard Constraints

| Constraint | Status | Evidence |
| ---------- | ------ | -------- |
| `packages/core/src/dex/compare.ts` byte-for-byte unchanged | ✓ HELD | `git diff HEAD` empty; last touched by pre-phase commit 4cd2f31. |
| `packages/app/src/dex/CompareView.tsx` unchanged; FriendDetail never imports it | ✓ HELD | `git diff HEAD` empty; last touched Phase 8 (6d05313); FriendDetail imports only core. |
| `packages/core` stays pure (no React/DOM/Supabase) | ✓ HELD | Only `@supabase` string in core src is a doc comment; purity test green. |
| `@supabase` imports confined to `packages/app/src/sync/` | ✓ HELD | grep outside sync/ + db/supabase.ts singleton returns nothing. |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/PLACEHOLDER/"not yet implemented" markers in any phase-modified file. Code review (19-REVIEW.md) resolved 1 Critical (CR-01) + 3 Warnings (WR-01/02/03) in commits 888a4e0, 590929f, a8ba000, 45398d9 — all fixes verified present in the source. 3 INFO findings accepted as tracked debt (resetSyncState sign-out wiring, cross-field zod refine, self-echo re-pull perf) — out of v1 scope, non-blocking given RLS write-own limits blast radius to self-inflicted display oddities at ~5 rows.

### Human Verification Required

None outstanding. The phase includes a dedicated device-UAT plan (19-04) whose 5 live checks — two-device propagation, head-to-head, reconnect flush, never-blank offline, RLS write-own — were all executed and recorded PASS in 19-HUMAN-UAT.md against the live Supabase project. No verification items remain deferred to end-of-phase.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are observably achieved in the codebase, all 8 requirement IDs are satisfied, all key links are wired, the four hard constraints hold, and the phase's own live device UAT passed. The full suite reports 875 passing; targeted re-runs of the phase's core (10) and app (26) tests pass in this verification. The one requirement-text nuance (PROG-01 `display_name` placement) is a documented intentional architecture decision that fully satisfies the functional intent.

---

_Verified: 2026-07-23T23:25:00Z_
_Verifier: Claude (gsd-verifier)_

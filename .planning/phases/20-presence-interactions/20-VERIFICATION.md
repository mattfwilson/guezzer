---
phase: 20-presence-interactions
verified: 2026-07-24T16:25:14Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 20: Presence & Interactions Verification Report

**Phase Goal:** Friends can see who is currently online and (coarsely) what they're doing, and send lightweight waves and reactions to each other — all ephemeral, never persisted. Hard scope line: coarse tab-level status only.
**Verified:** 2026-07-24T16:25:14Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Online presence dots via Realtime presence on one channel keyed by user id — ephemeral, dropped on disconnect, never written to Postgres (PRES-01, PRES-03) | ✓ VERIFIED | `presenceSync.ts:72-89` opens `supabase.channel("gizz-room", {config:{presence:{key:userId,enabled:true}}})`; `readPresence:108-116` derives `onlineIds` from live `presenceState()` keys (binary present-now). `FriendRow.tsx:40-52` renders 8px `#22C55E` dot only when `online`. No `.from()/.upsert()/.insert()/localStorage` on the presence path (grep clean; `presenceSync.test.ts` asserts). Two-device UAT check #1 (owner PASS): dots appear on connect, disappear on disconnect. |
| 2 | Coarse read-only "what they're doing" — tab-level (LiveGizz/GizzDex/GizzVerse/idle), never per-song (PRES-04) | ✓ VERIFIED | `presenceActivity.ts:75-84` `deriveActivity` returns `{tab, atShow?:boolean}` — coarse tab token + a boolean only; `hidden`→`idle` wins (D-02). `Tab` union is the 5 brand tabs + `idle`. `FriendRow.tsx:62-85` renders the label; `At a show 🎸` emphasized. 13 activity assertions green. Owner-verified PASS (UAT check #2; a separate mobile label-refresh robustness bug is tracked in `todos/pending/`, explicitly NOT a phase gap). |
| 3 | User can send a wave — targeted (`to:userId`) or broadcast (`to:null`) — peers see a transient, reduced-motion-aware toast (PRES-02, PRES-05) | ✓ VERIFIED | `ReactionPalette.tsx:60-80` → `sendWave(emoji, to)` once then close; `Everyone`→`to:null`, friend row→`to:friend.userId`. `validateWave:131-140` rejects self / other-targeted / unknown-emoji. `usePresence.ts:98-108` routes validated inbound waves to `showWaveToast`. `WaveToast.tsx:94/164-165` `useReducedMotion()`-gated opacity-only reduced path. UAT check #3 (PASS): broadcast + targeted land correctly, third-party target excluded. |
| 4 | Fixed emoji reaction palette (👋/🔥/🦎/🎯 "caught it!") broadcasts as toasts, reusing Bingo celebration-layer discipline (PRES-06) | ✓ VERIFIED | `config.ts:804-812` `presence.EMOJIS = ["👋","🔥","🦎","🎯"]` — single source consumed by both `validateWave` allow-list and `ReactionPalette.tsx:92`. Palette renders exactly 4 chips, 🎯 carries `caught it!` label, each has `aria-label`, ≥44px. `WaveToast.tsx` clones `BingoCelebration` host chrome (`role="status"`, `config.ui.z.toast`, height-registration, `AnimatePresence`). |
| 5 | Friends screen presence-aware — each row shows live online dot + coarse activity, fusing PROG + PRES with no new backend (PRES-07) | ✓ VERIFIED | `FriendsList.tsx:129-152` `PresenceFriendRow` reads `usePresenceFor(friend.userId)` per row → passes `online`/`activity` into `FriendRow`; membership stays `buildFriendRows`-owned (no placeholder rows, D-13). `SelfRow.tsx:33/52/68-72` fills own slots via `useSelfPresence()`, reads `offline` when disconnected. Reserved Phase-19 slots filled; Realtime-only, no new backend. UAT confirmed live. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `sync/presenceSync.ts` | Store + channel primitives + validateWave + sendWave | ✓ VERIFIED | 216 lines; imports Phase-17 `supabase` singleton (no `createClient`); full store seam + gizz-room open + validateWave rejection matrix + null-safe sendWave. |
| `sync/presenceActivity.ts` | Pure deriveActivity + reduceActivity + types | ✓ VERIFIED | Pure module — type-imports only `Route`; no Supabase/React/DOM. |
| `sync/useVisibilityHidden.ts` | useSyncExternalStore over visibilitychange, zero timers | ✓ VERIFIED | Twin of `useOnlineStatus`; no setTimeout/setInterval. |
| `sync/usePresence.ts` | Sole shell-mounted gizz-room engine | ✓ VERIFIED | 142 lines; `[userId,online]` lifecycle effect + separate activity re-track effect; validated-wave routing; teardown via `removeChannel`+`setWaveSender(null)`+reset. |
| `sync/usePresenceReaders.ts` | Pure usePresenceFor + useSelfPresence | ✓ VERIFIED | `useSyncExternalStore`; opens no channel; offline-gated frozen `OFFLINE` constant. |
| `components/WaveToast.tsx` | Emitter + host with bounded FIFO brief-drain queue | ✓ VERIFIED | 189 lines; over-cap DROP at QUEUE_CAP; trusted-store sender resolution; escaped text; no `dangerouslySetInnerHTML` (JSX). |
| `dex/ReactionPalette.tsx` | 4-chip palette + target picker calling sendWave | ✓ VERIFIED | Maps `config.presence.EMOJIS`; imports `sendWave`; ≥44px, aria-labels, accent-ring selection. |
| `dex/FriendRow.tsx` | Reserved presence slots filled from props | ✓ VERIFIED | `PresenceOnlineSlot` (#22C55E dot) + `PresenceActivitySlot` (atShow/tab/null); pure props consumer. |
| `dex/SelfRow.tsx` | Own dot/activity via useSelfPresence | ✓ VERIFIED | Calls `useSelfPresence()` before early-return; offline hides dot + reads `offline`. |
| `dex/FriendsList.tsx` | Per-row usePresenceFor + React/wave palette entry | ✓ VERIFIED | `PresenceFriendRow` child; `Hand` header affordance opens `ReactionPalette` (Everyone default). |
| `dex/FriendDetail.tsx` | Pre-targeted Wave-at-{name} button | ✓ VERIFIED | Header button uses `config.copy.presence.waveAtFriend`, opens palette `initialTarget={friend.userId}`. |
| `App.tsx` | usePresence() + <WaveToast/> mounted once | ✓ VERIFIED | `usePresence()` at :50 (before `#/dev/orb-fit` early-return at :80); `<WaveToast/>` at :123. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `presenceSync.ts` | `db/supabase.ts` | import Phase-17 singleton (no createClient) | ✓ WIRED |
| `presenceSync.ts` | `config.presence.EMOJIS` | validateWave allow-list | ✓ WIRED (`ALLOWED_EMOJI` from `config.presence.EMOJIS`) |
| `ReactionPalette.tsx` | `presenceSync.ts` | `sendWave(emoji,to)` | ✓ WIRED |
| `WaveToast.tsx` | `progressSync.ts` | `getSyncState()` sender-name resolution | ✓ WIRED (`resolveSenderName` reads trusted store) |
| `App.tsx` | `usePresence.ts` | unconditional shell-level call | ✓ WIRED |
| `usePresence.ts` | `WaveToast.tsx` | `showWaveToast` on validated wave | ✓ WIRED |
| `usePresence.ts` | `presenceSync.ts` | openPresenceChannel/setWaveSender/setPresenceState/removeChannel | ✓ WIRED |
| `FriendsList.tsx` | `usePresenceReaders.ts` | `usePresenceFor(friend.userId)` per row | ✓ WIRED |
| `FriendDetail.tsx` | `ReactionPalette.tsx` | pre-targeted wave button | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `FriendRow` (via `PresenceFriendRow`) | `online`/`activity` | `usePresenceFor` → presence store ← engine `setPresenceState(readPresence(channel.presenceState()))` | Yes — live Realtime presence | ✓ FLOWING |
| `SelfRow` | `presence` | `useSelfPresence` → `deriveActivity` over local route/visibility/active-show liveQuery | Yes — local live signals | ✓ FLOWING |
| `WaveToast` | `shown.payload` | engine `showWaveToast` on validated inbound broadcast | Yes — live channel wave | ✓ FLOWING |
| `ReactionPalette` | emitted send | `sendWave` → bound `waveSender` → `channel.send(broadcast)` | Yes — live channel send | ✓ FLOWING |

No hollow props or disconnected sources — every presence surface reads from the live engine/store or local signals, confirmed live in the two-device UAT.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-20 unit/component suite | `vitest run` (7 presence files) | 7 files / 74 tests passed | ✓ PASS |
| App typecheck (new exports resolve) | `tsc -p packages/app --noEmit` | exit 0 | ✓ PASS |
| Core purity guard (SETUP-04, no Supabase in core) | `vitest run packages/core/test/purity.test.ts` | green (in the 74) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| PRES-01 | 20-01/03/04/05 | Online presence dots, one channel keyed by user id, ephemeral | ✓ SATISFIED | gizz-room channel + onlineIds + green dot; UAT #1 |
| PRES-02 | 20-02/03/04/05 | Wave → transient toast via Realtime broadcast | ✓ SATISFIED | sendWave/broadcast + WaveToast; UAT #3 |
| PRES-03 | 20-01/03 | Ephemeral — never written to Postgres | ✓ SATISFIED | No persistence writes on presence path (grep + test); UAT #6 |
| PRES-04 | 20-01/03/04 | Coarse tab-level "what they're doing", never per-song | ✓ SATISFIED | deriveActivity {tab, atShow?}; owner-verified UAT #2 |
| PRES-05 | 20-01/02/04/05 | Waves targeted or broadcast | ✓ SATISFIED | validateWave targeting + Everyone/per-friend picker; UAT #3 third-party excluded |
| PRES-06 | 20-02 | Fixed emoji palette, reduced-motion toasts, Bingo discipline | ✓ SATISFIED | config.presence.EMOJIS 4-set; ReactionPalette + WaveToast |
| PRES-07 | 20-04 | Friends screen presence-aware, PROG+PRES fusion, no new backend | ✓ SATISFIED | usePresenceFor per row + filled reserved slots |

All 7 requirement IDs declared across plan frontmatter are satisfied. REQUIREMENTS.md maps exactly PRES-01…07 to Phase 20 — no orphaned requirements (every ID appears in at least one plan's `requirements` field).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) | — | Clean |
| WaveToast.tsx / ReactionPalette.tsx | comments only | `dangerouslySetInnerHTML` mentioned | ℹ️ Info | Appears only in doc comments asserting it is never used — no JSX usage |

No blockers. No stubs (every slot fills from a live reader; both send entry points route to the shipped `sendWave`).

### Human Verification Required

None outstanding. The phase's human verification gate (20-05, two-device live presence + wave UAT) was **already executed by the owner** and returned PASS across all six checks (`20-05-SUMMARY.md`, `verdict: pass`, 2026-07-24). The regression backstop (124 files / 947 tests, tsc exit 0, production build) was green before the device gate.

**Follow-up note (informational, not a gap):** During UAT check #2 the owner judged PRES-04 a PASS overall (cross-device coarse activity propagates; `At a show 🎸` confirmed) but observed that on a mobile observer device the friend's current-tab activity label refreshes inconsistently (desktop behaves as intended). This is a runtime-robustness issue on the read path, not a missing implementation — the derivation/reduce/read hooks are unit-proven. It is tracked independently at `.planning/todos/pending/2026-07-24-bug-mobile-friend-activity-inconsistent-updates.md` for a dedicated debug pass and does not block the phase goal.

### Gaps Summary

None. All 5 ROADMAP success criteria are observably true in the codebase, all 7 requirements satisfied, all artifacts exist/substantive/wired with real data flowing, no blocking anti-patterns, and the human UAT gate passed. The hard scope line (coarse tab-level only, boolean `atShow`, never per-song) is enforced structurally in `presenceActivity.ts` and the closed `Tab` vocabulary.

---

_Verified: 2026-07-24T16:25:14Z_
_Verifier: Claude (gsd-verifier)_

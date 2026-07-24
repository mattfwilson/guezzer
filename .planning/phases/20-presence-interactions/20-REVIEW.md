---
phase: 20-presence-interactions
reviewed: 2026-07-24T16:28:26Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/app/src/sync/presenceActivity.ts
  - packages/app/src/sync/presenceSync.ts
  - packages/app/src/sync/useVisibilityHidden.ts
  - packages/app/src/sync/usePresence.ts
  - packages/app/src/sync/usePresenceReaders.ts
  - packages/app/src/components/WaveToast.tsx
  - packages/app/src/dex/ReactionPalette.tsx
  - packages/app/src/dex/FriendRow.tsx
  - packages/app/src/dex/SelfRow.tsx
  - packages/app/src/dex/FriendsList.tsx
  - packages/app/src/dex/FriendDetail.tsx
  - packages/app/src/config.ts
  - packages/app/src/App.tsx
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-24T16:28:26Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 20 ephemeral presence + waves surface: the pure activity
projector (`presenceActivity.ts`), the Supabase Realtime fence + external store
(`presenceSync.ts`), the single-channel-owner engine (`usePresence.ts`), the pure
read hooks, the toast host, the reaction palette, and the friend-row/self-row/detail
UI, plus the touched config and App shell.

**The untrusted read boundary is genuinely well built.** `validateWave` and
`reduceActivity` are defensive, allow-list driven, and provably non-throwing on
hostile/malformed input; every peer-supplied string (`from`, sender name, emoji,
friend `displayName`, song/album names) renders as escaped React text with zero
`dangerouslySetInnerHTML`; the sender NAME is re-resolved from the trusted friends
store rather than the payload; and the single-channel lifecycle in `usePresence.ts`
uses a per-run `cancelled` guard plus a subscription/re-track effect split that
correctly avoids channel churn on tab/visibility changes. No BLOCKER-class bug,
injection, crash, or data-loss path was found.

One real behavioral defect stands out: **`ReactionPalette` never resets its
selection state across open/close**, so a reopened palette can fire a wave (with a
stale emoji and/or a stale recipient) on the very first tap. That is a WARNING —
it produces an unintended network side-effect visible to friends. The remaining
items are robustness/consistency notes, and one is the acknowledged root cause of
the separately-tracked mobile activity-refresh issue.

## Warnings

### WR-01: ReactionPalette retains selection state across open/close → accidental/stale wave send

**File:** `packages/app/src/dex/ReactionPalette.tsx:56-80` (with `packages/app/src/dex/FriendsList.tsx:110-115`)

**Issue:** `emoji`, `target`, and `targetChosen` are `useState`-initialized only on
mount and are never reset when the sheet opens or after a send. In `FriendsList` the
`<ReactionPalette>` is permanently mounted and merely toggled via the `open` prop
(`Sheet` returns `null` when closed but the `ReactionPalette` component — and its
state — stays alive). So a completed send leaves stale selection behind, and the
**next** open acts on it:

- Emoji-first path: after `pickEmoji("🔥")` → `pickTarget(friend)` sends and closes,
  `emoji` remains `"🔥"`. On reopen the 🔥 chip shows its selected ring, and the
  first target tap immediately calls `send("🔥", to)` — a wave the user never chose
  this session.
- Target-first path: after `pickTarget(null/friendId)` → `pickEmoji(...)` sends and
  closes, `targetChosen` remains `true` with the previous `target`. On reopen the
  first emoji tap immediately fires `send(emoji, <stale target>)` — potentially to
  the wrong recipient (a specific friend from the prior send).

Both are real, user-visible sends (a network broadcast that toasts on friends'
devices), triggered by a single tap that the user reasonably expects to be the
first half of a two-step pick.

**Fix:** Reset the two-step state whenever the sheet transitions open (and re-seed
from `initialTarget`):

```tsx
import { useEffect, useState } from "react";
// ...
useEffect(() => {
  if (open) {
    setEmoji(null);
    setTarget(initialTarget ?? null);
    setTargetChosen(initialTarget != null);
  }
}, [open, initialTarget]);
```

(Alternatively reset inside `send()` before `onClose()`.) A test that opens →
sends → reopens → taps one control and asserts `sendWave` is NOT called until both
halves are chosen would pin this.

## Info

### IN-01: Double initial `.track()` on mount

**File:** `packages/app/src/sync/usePresence.ts:114,137-140`

**Issue:** On mount both effects run in order: the lifecycle effect calls
`channel.track(activityRef.current)`, then the re-track effect (deps `[activity]`)
also fires and calls `channelRef.current.track(activity)` with the identical
payload. `.track()` is an upsert of this presence key, so the result is correct, but
it issues a redundant second track on every open. Harmless today; worth a guard if
track cost ever matters.

**Fix:** Optional — gate the re-track effect to skip the first run (e.g. a
`didInitialTrack` ref set true after the lifecycle `track`, cleared on teardown), or
accept the redundancy as negligible.

### IN-02: `channel.send(...)` return promise is not `void`-marked

**File:** `packages/app/src/sync/usePresence.ts:117-123`

**Issue:** Every other Realtime promise in this module and in `useProgressSync` is
explicitly `void`-ed (`void channel.track(...)`, `void removeChannel(...)`), but the
`setWaveSender` callback lets `channel.send({...})` float. Supabase `send` resolves a
status string rather than rejecting, so this is not a live crash — but it breaks the
codebase's consistent no-floating-promise discipline and would trip
`@typescript-eslint/no-floating-promises` if enabled on this path.

**Fix:** `void channel.send({ type: "broadcast", event: "wave", payload: { from: userId, to, emoji } });`

### IN-03: Realtime identity (`from` / presence key) is client-supplied and unauthenticated

**File:** `packages/app/src/sync/presenceSync.ts:118-140` (`validateWave`), `:72-89` (`openPresenceChannel` presence key)

**Issue:** `validateWave` verifies shape, target, and emoji, but the `from` field is
whatever the sending client stamps — it is not cross-checked against the
authenticated sender. Likewise the presence key is `userId` supplied by the client
at `channel(...)` time. A channel member can therefore broadcast a wave that toasts
on a peer as another friend ("Friend C 🔥"), or present as another user's id. This is
consistent with the documented threat model (fewer than 10 trusted friends, ephemeral
non-persisted data, RLS lives on Postgres not Realtime) and is not a new
vulnerability — flagged only so the unauthenticated-identity assumption is explicit
and revisited if the audience ever widens.

**Fix:** None required for the stated threat model. If it ever matters, gate presence
membership / wave acceptance on a server-verified identity claim rather than the
payload's self-reported `from`.

### IN-04: Mobile presence staleness — re-track cannot resurrect a suspended socket (root cause of the separately-tracked issue)

**File:** `packages/app/src/sync/usePresence.ts:83-140`, `packages/app/src/sync/useVisibilityHidden.ts`

**Issue (context, NOT a new finding — the mobile activity-refresh robustness issue is
already tracked):** The lifecycle/open-subscribe effect is keyed only on
`[userId, online]`. When a mobile browser backgrounds the tab it suspends the
WebSocket; on return to foreground `visibilitychange` fires and the re-track effect
runs `channelRef.current.track(activity)`, but that operates on a possibly-dead
socket and the lifecycle effect does not re-run (navigator `online` typically never
flipped), so nothing re-subscribes/re-joins `gizz-room`. Result: presence and inbound
waves can silently stall after backgrounding until an unrelated `[userId, online]`
change reopens the channel. Recording the mechanism here so the tracked fix can
target it directly.

**Fix (for the tracked issue, not this review):** Trigger a channel
re-subscribe/rejoin on the foreground edge — e.g. include a "socket generation" or a
`visibilitychange`-derived reconnect signal in the lifecycle effect's dependency, or
re-`.subscribe()` when the tab returns to `visible` and the channel state is not
`joined`.

---

_Reviewed: 2026-07-24T16:28:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

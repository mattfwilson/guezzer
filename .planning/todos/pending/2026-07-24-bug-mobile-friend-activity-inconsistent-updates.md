---
created: 2026-07-24T00:00:00.000Z
title: "Bug: mobile Friends-list activity labels update inconsistently"
area: bug
source: 20-05 two-device UAT (owner, 2026-07-24)
severity: medium
status: both-halves-fix-implemented-awaits-device-recheck
fix_commit: df6515c
fix_ref: quick 260724-hqu (presence half) + quick 260724-lgo (progress-feed half)
files:
  - packages/app/src/sync/usePresence.ts
  - packages/app/src/sync/presenceSync.ts
  - packages/app/src/sync/useVisibilityHidden.ts
  - packages/app/src/sync/presenceActivity.ts
  - packages/app/src/sync/usePresenceReaders.ts
---

## Problem

Found during the Phase-20 two-device UAT (20-05). On a **mobile** observer device,
the Friends-list "what tab a friend is currently on" activity label is
**inconsistent — it doesn't always update** when the friend moves between in-app
tabs. Looking at multiple friends' current in-app location works **as intended on
desktop**. Present-now dots, `At a show 🎸`, and waves all passed; this is
specifically the *live refresh cadence of the coarse activity label on mobile*.

Not a Phase-20 blocker (owner passed the gate), but a real robustness gap on the
read path worth fixing before the residency run.

## Code map (as of 2026-07-24)

The activity read path is entirely `presence:sync`-driven:

- `usePresence.ts` — the sole `gizz-room` owner. A lifecycle effect keyed
  `[userId, online]` opens the channel + does the initial `.track()`; a second
  effect keyed on the derived `activity` re-`.track()`s on tab/visibility/show
  changes WITHOUT re-subscribing. Inbound presence updates arrive only via the
  channel's `presence:sync` handler → `setPresenceState(readPresence(state))`.
- `presenceSync.ts` — `openPresenceChannel` wires exactly one refresh trigger:
  `.on("presence", { event: "sync" }, () => onPresenceSync(channel.presenceState()))`.
  There is **no** `join`/`leave` listener and **no** visibility/reconnect-driven
  manual resync. The store only changes when a `sync` event fires.
- `usePresenceReaders.ts` — pure `useSyncExternalStore` readers; they cannot pull,
  they only reflect whatever `setPresenceState` last wrote.

## Ranked hypotheses (to confirm during debug)

1. **Mobile WebSocket suspension → missed `sync` (most likely).** Mobile browsers
   suspend/throttle the WebSocket when the observer's tab is briefly backgrounded
   (screen dim, app-switch, notification shade, scroll-idle). While suspended the
   client misses the peer's presence diffs, and on resume Supabase does **not**
   guarantee a fresh full `sync` unless the socket actually reconnects — so the
   store holds a stale activity until the next unrelated presence change. Desktop
   tabs aren't suspended as aggressively → "always updates" there.
2. **No re-sync on visibility-regain.** The engine re-`.track()`s its OWN activity
   when `hidden` flips false→true, which *should* trigger a self-`sync` and refresh
   the store — but only if the socket is live. If the socket dropped while
   backgrounded, the buffered track waits for rejoin; there's no explicit
   "on visible + online, re-read `presenceState()` / rejoin" path.
3. **Realtime events-per-second rate limit** on rapid `.track()` bursts (sender
   side) dropping intermediate updates — would affect desktop too, so lower prob.
4. **`presenceState()` snapshot timing** — reading inside the `sync` callback is
   the documented pattern; unlikely, but confirm the reduce (`reduceActivity`
   "last valid entry wins" across a peer's multi-device entry array) isn't picking
   a stale device entry when the peer has >1 open tab/device.

## Suggested first steps

- Instrument the `sync` handler (count + timestamp) on a mobile device to confirm
  whether `sync` events simply stop arriving while backgrounded and resume late.
- Likely low-risk fix (H1/H2): on the observer, force a presence refresh when the
  tab returns to visible AND online — re-read `channel.presenceState()` (and/or
  ensure a rejoin) so the label reconciles immediately on resume, rather than
  waiting for the next peer-driven diff.
- Verify the fix on two devices (mobile observer) before closing.

## Fix implemented (2026-07-24, quick 260724-hqu, commit df6515c) — AWAITS DEVICE RECHECK

Hypothesis H1/H2 (WebSocket suspension → missed `sync` with no resync-on-resume) was
adopted. `usePresence.ts` now increments a `visibleEpoch` on each hidden→visible edge
(via `prevHiddenRef`) and includes it in the lifecycle effect's deps, so a real mobile
foreground tears down and re-opens the `gizz-room` channel → fresh subscribe → fresh
`sync`, reconciling stale friend activity immediately. Backgrounding and in-app
navigation deliberately do NOT re-open (no subscription churn). Unit tests in
`packages/app/test/sync/usePresence.test.tsx` assert the foreground edge re-opens and an
in-app route change does not. tsc clean; 951 tests green.

**Left pending on purpose:** the unit test proves the re-open TRIGGER fires — it does not
prove live realtime recovery over a genuinely suspended mobile socket. Close this todo
only after a two-device on-device recheck (mobile observer switches tabs, backgrounds,
returns → the friend's activity label updates promptly). If it still lags on-device, the
next lever is H3/H4 (Realtime events-per-second throttle on the sender, or a stale
multi-device entry winning in `reduceActivity`).

## Sibling channel fixed too (2026-07-24, quick 260724-lgo, commit 7420b96) — AWAITS DEVICE RECHECK

The same mobile-suspension gap lived in a SECOND Realtime channel: `useProgressSync.ts`
(Phase-19 progress feed), keyed identically `[userId, online]` with only an
offline→online reconnect flush and no hidden→visible rejoin (memory
`realtime-mobile-suspension-rejoin`). The verbatim `visibleEpoch` pattern from `usePresence.ts`
was propagated to it — `useVisibilityHidden()` + `prevHiddenRef` bumps `visibleEpoch` only on
the hidden→visible edge, added to the subscription lifecycle deps so a real mobile foreground
tears down + re-subscribes + re-pulls friend progress rows. Debounced-upsert + reconnect-flush
deps untouched (no spurious foreground write). Tests prove foreground re-subscribe/re-pull,
zero in-app-nav churn, and no spurious upsert. `tsc` clean; sync suite 72/72, full app 513/513.

BOTH the presence label (hqu) and the friend-progress rows (lgo) now rejoin on mobile
foreground. Same caveat as hqu: unit tests prove the re-open TRIGGER, not live realtime
recovery over a genuinely suspended mobile socket.

## Next

Two-device on-device recheck next session, covering BOTH halves: a mobile observer switches
tabs / backgrounds / returns → the friend's **activity label** (presence) AND their
**progress row** (completion %, catches) update promptly. If both confirmed fixed, move this
file to `.planning/todos/completed/`. If either still lags, `/gsd-debug` with the on-device
instrumentation noted above (next levers: H3 Realtime events-per-second throttle, H4 stale
multi-device entry in `reduceActivity`).

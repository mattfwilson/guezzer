---
created: 2026-08-05T05:30:00.000Z
title: SetlistView's loading state is an unrecoverable aria-modal trap when the row is absent
area: ui
resolves_phase: 22
resolved: 2026-08-10
resolved_by: 22-04
files:
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/db/db.ts
---

## Problem

`SetlistView`'s hold-the-frame early return is an opaque, full-viewport
`role="dialog" aria-modal="true"` box with **no close control, no Escape handler and
no scrim**. There is no way out of it except force-quitting the app.

That would be tolerable if it were only ever a brief loading flash. It isn't. The guard
at `SetlistView.tsx:137` is:

```ts
// Not in the bundle and the cache row hasn't resolved yet — hold the frame.
if (resolved == null) { … }
```

but `resolved` (`:92-129`) is `null` whenever the show is in **neither** the bundled
archive **nor** the `archiveShows` cache row — and
`useLiveQuery(() => db.archiveShows.get(showId))` (`:90`) returns `undefined` in two
states the component cannot tell apart:

1. the query is still resolving (transient — the case the comment assumes), and
2. **there is no such row** (permanent).

The comment's "hasn't resolved *yet*" encodes the assumption that state 2 cannot
happen. When it does, the user is parked in a blank modal forever.

Its `aria-label` is `copy.albumBack`, so VoiceOver announces this blank blocker as
**"Back"** — actively misleading, since Back is the one thing it does not offer.

## How a missing row happens

Not hypothetical:

- a failed `archiveShows` write (that write is currently unguarded — see code review
  WR-07 in `.planning/phases/21-layout-layering-foundations/21-REVIEW.md`)
- a v1/v2 backup import that predates the row
- a corpus refresh that renumbers or drops a show id

## Why this is filed rather than fixed

**Pre-existing, not a Phase-21 regression.** `git diff 363b42c~1 363b42c` shows plan
21-12 only wrapped the already-empty `<div>` in `createPortal` — the trap predates the
phase. Surfaced by the phase-21 code review (CR-02) and confirmed by the phase
verifier; recorded here so the deferral is a decision rather than an oversight.

## Fix sketch

Distinguish the two `undefined` states and give the permanent one an exit:

- Track resolution explicitly — e.g. `useLiveQuery` returning a sentinel, or a
  `loaded` flag that flips once the query has run at least once, so "still loading"
  and "no such row" are separable.
- Loading → keep the hold-the-frame box, but drop `aria-modal` (nothing is being
  trapped) and give it a truthful `aria-label` / `aria-busy`, not `copy.albumBack`.
- Missing row → render a real error state with a working **Back** control, and wire
  Escape to `onClose` like every other dialog in the app.
- Guard the `archiveShows` write (WR-07) so the most likely cause stops producing
  orphaned ids in the first place.

## Priority

Worth closing before the Aug 2026 shows. The app is used one-handed, in the dark, in a
venue — an unrecoverable blank screen mid-show costs the whole setlist-logging session,
and force-quitting a PWA is exactly the moment iOS eviction risk bites.

## Resolution (Phase 22, 22-04)

Delivered by plan 22-04: `SetlistView` gained a pending-vs-missing split with
`useDialogDismiss(missing, onClose)`, so the missing state is Escape-dismissable instead of being an
unrecoverable `aria-modal` trap. `DexView`'s `key={openShow.showId}` (CR-02) makes the split honest
by construction — it prevents a stale-pending window that would otherwise pass a green suite.

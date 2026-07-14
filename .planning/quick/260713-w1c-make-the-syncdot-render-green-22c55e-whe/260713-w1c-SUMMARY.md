---
quick_id: 260713-w1c
status: complete
commit: c99ea42
date: 2026-07-14
---

# Quick Task 260713-w1c: SyncDot green online state

## What changed

`packages/app/src/live/SyncDot.tsx` — the online state now fills with
`#22C55E` (the existing hit-green from CometTrail's hit rings; no new color
token minted). The offline state is unchanged: a hollow 1px `#A1A1AA`
(text-muted) ring. Aria-labels unchanged.

## Spec deviation (owner-approved)

This overrides 05-UI-SPEC §Color B3, which restricted the dot to text-muted
only ("connectivity is unremarkable, not alarming"). The owner explicitly
requested the green online state on 2026-07-14 after on-device testing during
Phase-5 human UAT — connectivity now reads at a glance during a show. Green
now signals both "hit" (trail rings) and "online" (dot); accepted trade-off.
The component doc comment records the override inline.

## Verification

- `npm test` — 281/281 pass (38 files)
- `npx tsc --noEmit` (packages/app) — clean
- `vite build` — succeeds; preview servers (4173/4175) pick up the new dist
  from disk automatically

## Commits

- `c99ea42` feat(quick-260713-w1c): SyncDot online state is now hit-green
  (owner override of 05-UI-SPEC B3)

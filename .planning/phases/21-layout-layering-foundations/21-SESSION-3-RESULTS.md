---
session: 3
date: 2026-08-05
device: iPhone 16 Pro (402x874 CSS @ dpr 3), iOS 26.5.2
build: e847183 (post-rename), production build over cloudflared tunnel
context: INSTALLED standalone PWA (home-screen icon)
status: input-for-21-13
---

# Phase 21 — Device UAT Session #3 Results

**This file is INPUT for plan 21-13.** It is the owner's verbatim device results, captured
so they survive a context reset. Plan 21-13 is the artifact of record — it must fold these
into `21-HUMAN-UAT.md`, reconcile the stale `Gaps` block, and set `status:`. This file is a
courier, not the record.

## Context correction — read this first

The first half of this session was run in a **Safari tab, not the installed app**. The
`?layoutProbe=1` readout proved it (`evidence/session3-layoutprobe-safari-sab0-PROOF.PNG`):

```
sab: 0
standalone: nav=false mq=false
innerH: 714    (true standalone on this device is ~874)
```

**Every observation from that half was discarded**, including a convincing-looking "gap
between `BackupToast` and the tab bar." That gap was an **iOS Safari dynamic-viewport
artifact**: on scroll Safari collapses its bottom toolbar, the layout viewport grows, and
`fixed` bottom-anchored elements stay anchored to a viewport bottom that is now below the
visible glass. Two screenshots were diagnosed before the probe settled it.

It is **not** a FOUND-02 defect. With `sab: 0` the double-count bug class is unobservable by
construction — the inset that would be counted twice is zero, so it can neither reproduce nor
be ruled out.

The owner then re-installed correctly and **re-ran everything from the home-screen icon**.
All results below are from that standalone re-run.

## Results

| # | Test | Result |
|---|------|--------|
| 1 | Bottom gap before/after (FOUND-01) | **CLOSED** — independently corroborated this session |
| 2 | `bottom-16` overlay overlap (FOUND-02) | **PASS** — all five overlays |
| 3 | Tab strip at max Dynamic Type (NAV-01) | **PASS** at maximum, on the six-tab strip |
| 4 | SearchSheet + soft keyboard (FOUND-03/D-17) | **PASS** |
| 5 | Share-card footer (FOUND-05/D-36/D-37) | CLOSED in session #2 — unchanged |
| 6 | Two devices, different builds (NAV-03/D-42) | **NOT RUN — still PENDING** |
| 7 | Live paint order (FOUND-03/D-29) | Resolved by static analysis only — desktop repro never run |
| 8 | Gesture suppression after portaling (D-23) | **PASS** — upgrades the prior PARTIAL |

### Test 2 — all five overlays confirmed

Each clears the tab-bar buttons, and none gained internal dead space from the plan-21-10
chrome-reserve conversion:

- `InstallBanner` — re-armed by the fresh IndexedDB that came with re-installing
- `BingoCelebration` — locked card, logged to a marked square
- `WaveToast` — sent from a second signed-in device
- `BackupToast` — End Show auto-backup path
- `UpdateToast` — verified against a deliberately bumped `dist/sw.js`

Operational note for any future session: **three separate SW bumps were needed.** Each
re-install re-baselines the cached worker, so the pending update disappears and the toast
cannot fire. Bump `dist/sw.js` *after* the install is final, then force-quit and relaunch.

### Test 3 — supersedes session #2

Session #2 passed NAV-01 at maximum text size against a **five**-tab strip. The Sched tab
landed in commit `2028a95` on 2026-07-30, **after** that reading, making it six tabs
(Live / GizzVerse / Map / Sched / Me / Games). This session re-ran it at maximum on the
six-tab strip and it holds. The session-#2 result is superseded, not merely repeated.

### Test 8 — upgrades PARTIAL to PASS

Session #2 verified the D-23 mechanism (classes reach the portaled roots, rules survived
minification, computed styles resolve) but explicitly did not claim the iOS behaviours. All
of them were observed this session on **both** `SearchSheet` and `FabMenu`: double-tap does
not zoom, long-press raises no iOS callout, no overscroll chaining to the page behind, and
focus / Escape / focus-restore behave.

### Test 1 — independent corroboration

The probe read `mainBottom: 650`, `tabTop: 651`, `>>> GAP: 1` — the same 1px nav-border
calibration session #2 derived. `<main>` is flush to the bar.

**Consequence for 21-13:** the `Gaps` block in `21-HUMAN-UAT.md` still records FOUND-01 as
`status: failed` from session #1. That is stale and superseded by the measured after-run. It
must be reconciled, not left standing.

## Still open

- **Test 6 (NAV-03)** — the one genuine blocker. Needs the two-worktree / two-tunnel harness
  and a second device on the pre-rename build. **The pre-rename base is `e92d4a8`
  (= `1cc5787^`)** — the rename landed in `1cc5787` (plan 21-03), *not* in 21-13 as the
  harness section of `21-HUMAN-UAT.md` claims. That harness line is wrong and should be
  corrected while 21-13 is in the file.
- **Test 7** — optional 2-minute desktop check via `?layerRepro=1`. Structurally covered by
  `layerOrder.test.tsx`; low value, cheap.

The owner is time-boxed before the Aug 2026 shows and has chosen to move on. Test 6 should be
recorded as an explicit gap — plan 21-13's own wording is "any residual gap recorded
explicitly rather than assumed closed" — never as a pass.

## Evidence

In `evidence/`:

- `session3-layoutprobe-safari-sab0-PROOF.PNG` — the probe readout that settled the context question
- `session3-DISCARDED-safari-recap-backuptoast.PNG` — the apparent gap; Safari context, retained as the discarded-context record
- `session3-DISCARDED-safari-scrolled-toolbar-hidden.PNG` — Safari with its toolbar auto-hidden on scroll; no tab bar, bingo grid clipped by the screen edge

No standalone screenshots were captured for the passing re-run — those results rest on owner
attestation, the same basis session #2 used for NAV-01.

## Follow-up captured

`.planning/todos/pending/2026-08-05-add-apple-mobile-web-app-capable-so-ios-installs-are-determi.md`
(commit `2f97eda`) — iOS "Add to Home Screen" can silently create a Safari **bookmark**
instead of a standalone web app when the manifest has not finished parsing. That is what cost
this session. `index.html` has `viewport-fit=cover` and
`apple-mobile-web-app-status-bar-style` but has never had `apple-mobile-web-app-capable`.
One-line fix, `/gsd-quick` sized, flagged pre-show because every remaining device session
depends on a deterministic install.

---
created: 2026-07-11T20:18:45.242Z
title: Fix truncated/oversized song-name text inside prediction orbs
area: ui
resolves_phase: 8
files:
  - packages/app/src/show/PredictionOrb.tsx
  - packages/app/src/show/OrbitStage.tsx
---

> **Naming update (2026-07-17):** bottom tabs rebranded (display labels only) —
> **Show → LiveGizz**, **Explore → GizzVerse**, **Dex → GizzDex**. The prediction
> orbs / orbit stage below live in the **LiveGizz** tab (formerly "Show"). Routes
> (`show`), file paths (`src/show/*`), and component names are unchanged, so all
> code identifiers below still apply as-is.

## Problem

During a live show, the song-name text inside the prediction orbs — **especially
the main center orb (current song)** — is truncated and the font is too large
relative to the orb, so most playing/predicted song names can't be read in full.

This hurts the core "one thumb, in the dark" readability value: the whole point
of the orbit is to see, at a glance, what's playing and what's likely next. Long
King Gizzard song titles (which are common) get clipped.

- Observed on-device: iPhone 16 Pro, iOS 26.3.1, during Phase 04 end-of-phase
  device verification (2026-07-13 device gate).
- Reported by the owner as a defer-for-later cleanup item — **not blocking**;
  Phase 04 device gate still passed. Severity: minor/cosmetic but affects usability.

## Solution

TBD. Candidate approaches (pick during a future UI-polish pass):

- Dynamic font scaling to fit the orb diameter (measure text, shrink to fit a
  min legible floor).
- Multi-line wrap inside the orb instead of single-line truncation.
- Bump min orb sizing for long names, and/or give the center (current-song) orb
  a larger text budget than the prediction orbs.

Likely touch points: the label rendering in `PredictionOrb.tsx` and the
center-node rendering in `OrbitStage.tsx`. Coordinate with the `ORB_MIN_DIAMETER`
clamp and the ≥56px visual / ≥44px hit-area constraint (SHOW-02) so any sizing
change keeps tap targets compliant. Keep model constants in `config.ts` per the
project's single-config rule rather than inlining new magic numbers.

---

## Resolved (2026-07-17)

Fixed the truncation/oversized-text problem AND the owner's 5 companion asks in
one orbit-stage pass:

1. **Center orb is a circle** — `CenterNode` is now a fixed `ORB_CENTER_DIAMETER`
   (116px) circle instead of a stadium pill (both the seeded song and the
   pre-opener prompt).
2. **Cap 5 predictive orbs** — `ORB_COUNT_MAX` 8 → 5 (MIN stays 5 ⇒ always a clean
   5-orb pentagon). selectFan/tally tests updated.
3. **Bigger orbs, smaller text, less truncation** — the ring solver grows a uniform
   orb diameter toward `ORB_MAX_DIAMETER` 88 → 112; label base font 14 → 13 and
   max wrap lines 2 → 3 (center base 20 → 18, floor 14 → 12). The center label now
   fits to the real circle diameter, not a nominal 220px pill budget.
4. **No overlap + even spread** — rewrote `layoutOrbs` from score-varied radii to a
   single evenly-spaced ring (regular polygon, rank 0 at top). A closed-form solver
   sizes the uniform orb as large as fits WITHOUT overlapping ring neighbours or the
   centre node (`ORB_RING_GAP_PX` = 10 clearance). Score now reads from rank order +
   the % label, not radius. New tests assert equidistance, even angular step, and
   the no-overlap invariants.
5. **Center pulsates** — a slow living/breathing scale loop (`.orb-breathe`,
   styles.css), transform-only (no reflow; the ring clears the centre even at max
   scale) and disabled under `prefers-reduced-motion`.

Config churn (single-config ethos): +ORB_CENTER_DIAMETER, +ORB_RING_GAP_PX,
+ORB_LABEL_BASE_FONT_PX(_CENTER); removed ORB_INNER_RADIUS_RATIO and
ORB_LABEL_CENTER_WIDTH_PX (obsolete under the ring solver / circle fit).

Gates: `tsc -p packages/app` clean, full suite 490/490 (4× stable), `vite build`
clean. Device look: owner.

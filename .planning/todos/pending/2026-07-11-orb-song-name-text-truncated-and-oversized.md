---
created: 2026-07-11T20:18:45.242Z
title: Fix truncated/oversized song-name text inside prediction orbs
area: ui
files:
  - packages/app/src/show/PredictionOrb.tsx
  - packages/app/src/show/OrbitStage.tsx
---

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

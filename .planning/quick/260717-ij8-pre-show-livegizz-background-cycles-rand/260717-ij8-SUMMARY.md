---
phase: quick-260717-ij8
plan: 01
subsystem: app/show
tags: [ui, polish, show-mode, background]
requires:
  - config.show.background (existing ambient-background config)
  - coverUrlList() (packages/app/src/dex/covers.ts)
  - ShowBackground crossfade-on-coverUrl-change (unchanged)
provides:
  - config.show.background.PRESHOW_CYCLE_MS
  - Pre-selection cycling ambient background in ShowView
affects:
  - packages/app/src/show/ShowView.tsx
tech-stack:
  added: []
  patterns:
    - "motion/react useReducedMotion gate (same as OrbitStage)"
    - "single-config interval (no magic 5000 in component)"
key-files:
  created: []
  modified:
    - packages/app/src/config.ts
    - packages/app/src/show/ShowView.tsx
decisions:
  - "pickDifferent offsets the prev index by 1..len-1 so an identical URL is never re-picked (ShowBackground no-ops identical URLs, so this guarantees a real crossfade each tick)"
  - "cycling folds reduced-motion + no-selection-ever into one boolean; the <2-cover guard lives inside the effect so the interval simply never starts"
  - "effect deps are [cycling] only — ambientCover advances via the functional updater so the interval never thrashes"
metrics:
  duration: ~6min
  completed: 2026-07-17
---

# Phase quick-260717-ij8 Plan 01: Pre-Show LiveGizz Background Cycles Random Covers Summary

Before any next song is picked on the LiveGizz page, the blurred ambient background now crossfades to a different random bundled album cover every 5 seconds; selecting a song stops the cycle and locks the background to that song's cover (unchanged), and reduced-motion / <2-covers keep it static.

## What Was Built

**Task 1 — `PRESHOW_CYCLE_MS` config constant** (`config.ts`)
Added `PRESHOW_CYCLE_MS: 5000` to `config.show.background` (after `CROSSFADE_MS`) with a doc comment in the sibling style. This is the single home for the cycle interval — no literal in the component (CLAUDE.md single-config rule). The `configMirror.test.ts` guard only asserts specific mirrored explore/dex keys (not an exhaustive `background` shape), so it needed no change.

**Task 2 — Cycling ambient background** (`ShowView.tsx`)
- Imported `useReducedMotion` from `motion/react` (same hook OrbitStage uses); `const reduce = useReducedMotion() ?? false;`.
- Converted the one-shot `bgCoverUrl` into settable `ambientCover` state (same random-at-mount initializer).
- `selectedCover` / `lastSelectedCover` state + latch effect kept exactly as-is.
- Added `cycling = selectedCover == null && lastSelectedCover == null && !reduce`, and an effect keyed on `[cycling]` that owns a `setInterval` at `config.show.background.PRESHOW_CYCLE_MS`. It reads `coverUrlList()`, returns early with `<2` covers, and advances via a functional updater using a local `pickDifferent` that offsets the previous index by `1..len-1` (never re-picks `prev`). Cleanup `clearInterval` on cleanup/gate-flip.
- Fallback chain unchanged in precedence: `selectedCover ?? lastSelectedCover ?? ambientCover`. `ShowBackground` untouched.

## Verification

- `npx vitest run` from repo root: 68 files, 496 tests passed (includes configMirror + songCover).
- `cd packages/app && npx tsc --noEmit`: clean (exit 0) after each task.

## Deviations from Plan

None — plan executed exactly as written.

## Manual Check (optional, not gating)

Open `#/show`, Start Show, watch the blurred backdrop crossfade to a new random cover ~every 5s while "Search for the opener" is up; select an opener → cycling stops, background locks to that album; OS reduce-motion on → static single cover.

## Self-Check: PASSED

- FOUND: packages/app/src/config.ts (PRESHOW_CYCLE_MS)
- FOUND: packages/app/src/show/ShowView.tsx (ambientCover cycling + PRESHOW_CYCLE_MS interval)
- FOUND commit a5c3a15 (Task 1: config constant)
- FOUND commit f767a6d (Task 2: ShowView cycling)

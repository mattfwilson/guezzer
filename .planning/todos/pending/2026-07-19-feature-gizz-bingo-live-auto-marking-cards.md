---
created: 2026-07-19T04:48:04.422Z
updated: 2026-07-19
title: "Feature: Gizz Bingo — 4×4 live auto-marking bingo card (casual +1 anchor)"
area: feature
files:
  - packages/core/src/model/predict.ts
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/components/BottomTabBar.tsx
---

## Problem

**Feature idea #3 — THE casual +1 anchor: the answer to "how do we engage users who don't know
the discography."** The prediction orbit is fun if you know the songs; a +1 recognizes nothing.
Bingo is recognition-based and passive — you just watch squares light up. A fan-made static-PDF
KGLW bingo exists (github.com/reeserich/king_gizz_bingo) but nothing does **live auto-marking
driven by a tracker** — that's the gap Guezzer fills.

Design vetted against the real corpus in a /gsd-explore session. Full rationale + empirical
fire-rate data: **`.planning/notes/gizz-bingo-design-vetting.md`** (read before planning).

## Solution (vetted v1)

A **4×4** bingo card (center free space → 15 fillable) that auto-marks as the tracker logs songs.
Sized to the empirical median 15-song show so lines are common and blackout is a rare crown.

1. **Marking (pure core, consume-once):** each logged song marks the ONE best-matching unmarked
   square (greedy assignment), never every square it qualifies for. A third derivation over the
   trail alongside tally + comet trail; recomputes on every `logSong` via the same liveQuery.
2. **Event catalog (recent-era only — verified fire-rates):** album-membership (the variety
   engine, 6–10 albums @ 53–80%) · segue (97%) · marathon-jam via curated vehicle list (95%) ·
   microtonal (89%) · opener (100%) · bust-out gap≥50 (21%, glory) · "never caught before"
   (personal glory). **Do NOT use covers (2%), encore (0%), or Set-2 (2%) — dead in the modern era.**
3. **Song squares (few):** 2–3 only; seeded from **base-rate recent frequency**, NOT the transition
   predictor. A hit is a rare "you called it!" bonus, not the core loop.
4. **Build UX:** "Deal my card" one-tap w/ vibe pick (Chill/Balanced/Glory-hunter) → full card,
   never blank. Tap a square → swap from suggestions (event/album cards w/ catchability hints;
   model-bucketed song chips w/ cover art; search escape hatch). Reshuffle re-deals. Live
   expected-fill/difficulty meter.
5. **GizzGames tab (new, 4th):** LiveGizz / GizzVerse / GizzDex / GizzGames. Build/reshuffle unlocked
   anytime; during a show it's the live-marking surface; after, holds card history.
6. **Lock:** unlocked until Start Show, then FROZEN.
7. **Late joiners:** one-tap "Catch me up" bulk-adopts from the live `latest` feed (reuses
   adopt-suggestion); manual mark/search fallback. No special mode.
8. **Replay:** card persisted (square defs + seed + lock timestamp) tied to the session in Dexie;
   past shows in GizzDex show the frozen card + marks + win state (pure re-derivation).
9. **Wins:** line / four-corners / X / blackout (all achievable on 4×4). Celebrations: per-square orb
   stamp (reuse renderer); big moments FIRST LINE + BLACKOUT only; reuse galaxy backdrop supernova +
   share-card canvas. Reduced-motion aware.

## Scope / constraints

- **Solo/personal v1, NO leaderboard** (deferred → seed `gizz-bingo-shared-leaderboard`).
- Card generation + marking are **pure core**; all constants in config; unit tests over fixture
  setlists (winnability + consume-once assignment are the critical test cases).
- **NOT part of the show-#1 core bar** (Features 1–4 + backtest). Schedule after the core loop is
  trustworthy. Mid-size.

## Open calibration (pre-plan) — see `.planning/research/questions.md`
- Final event/song mix on the 15 fillable squares + fill-rate calibration constants.
- Canonical curated lists: jam-vehicle songs + which albums become squares.

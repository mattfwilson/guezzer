---
title: "Gizz Bingo — shared-seed leaderboard (multiplayer)"
trigger_condition: "After Gizz Bingo v1 ships and solo play proves fun; when friends want to compete at the same show"
planted_date: 2026-07-19
---

# Gizz Bingo — Shared-Seed Leaderboard

Deferred multiplayer layer for Gizz Bingo. v1 is deliberately **solo/personal** because personal
squares ("a song you've never caught") depend on each player's Dex, making cards non-comparable and
the seed non-deterministic — fine for solo, fatal for a fair leaderboard.

## Trigger
Solo Gizz Bingo v1 is live and fun, and the <10 friends attending the same 2026 shows want to
compete ("who got bingo first / most squares").

## The idea
A **shared-seed card variant**: cards generated deterministically from `showDate + playerName` (no
server), so everyone at a show gets distinct-but-comparable cards. Enables a **local, backend-free
leaderboard** — first-to-bingo, most-squares-lit — derived purely from each player's own tracked
trail.

## Constraints to resolve when it triggers
- **No personal squares** in shared cards (they break comparability) — use only corpus-derived event
  types (album-membership, segue, jam, microtonal, opener, bust-out).
- **Card comparability vs seeding architecture:** the v1 generator must already separate "personal"
  from "shared-safe" event types so this variant is a config flag, not a rewrite. Worth building the
  seam into v1 even though the leaderboard is deferred.
- **No backend** (hard project constraint): leaderboard is exchanged/compared via QR or the existing
  JSON export, or reconstructed from each player's shared trail. Decide the exchange mechanism.
- **Fairness:** since marking is off each player's OWN tracker, a mistracked show desyncs a player's
  card. A "consensus" or designated-tracker model may be needed — or accept per-player honesty for a
  <10-friend group.

## Fun upside
Turns the passive +1 anchor into a social game across the consecutive nights of a residency —
potentially the strongest engagement driver, but only worth building once solo is proven.

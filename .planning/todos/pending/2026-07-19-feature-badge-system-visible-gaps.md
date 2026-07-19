---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Badge system with visible unearned badges"
area: feature
files:
  - packages/core/src/dex/derive-dex.ts
  - packages/app/src/dex/DexView.tsx
  - packages/app/src/dex/ShareCardSheet.tsx
---

## Problem

**Feature idea #8 from 2026-07-19 research session. Structured goals layer over the dex.**

Untappd's badge system is the most-loved achievement mechanic in any "log real-world things" app, and its core insight is that **unearned badges are visible** — the empty slot creates the pull. Badges also level up (5 check-ins → level 2 → … 100), making early progress fast and late progress prestigious. Guezzer has completion stats but no goal structure between "caught a song" and "caught them all" (264 songs is a decade-scale goal; nobody finishes it in one tour).

## Solution

Concept — a badge case in GizzDex, all badges visible from day one:

1. **Album-completion badges**: "caught every song on Nonagon Infinity live" — the strongest category because Gizzard fans think in albums and the dex is already album-shelved with per-album tallies. Partial progress shown (7/9).
2. **Lane badges**: themed sets — "Metal Gizz" (5 Rats' Nest/PetroDragonic songs), "Microtonal Master" (tuning-family data exists), "Jazz Gizz", "Acoustic catch".
3. **Event badges**: witnessed a live debut / a bust-out / a 20-minute jam (shares variant-detection logic with the Shiny Catches todo).
4. **Run/attendance badges**: "3 consecutive nights", "5 shows attended", "2 venues", "caught an opener call" (ties into Guezz League).
5. **Leveled badges**: "Catcher Lv. N" at 10/25/50/100/150 songs caught.
6. Badges render on the existing share cards; earning moment gets a small celebration (respecting reduced-motion).

Architecture fit: badge definitions as data + one pure `deriveBadges(dex, corpus)` core function (fixture-testable); badge-case grid view + share-card extension. Mid-size. Sources: Untappd badge system, trophy.so gamification writeups.

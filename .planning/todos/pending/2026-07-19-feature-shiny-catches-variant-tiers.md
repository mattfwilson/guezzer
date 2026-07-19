---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Shiny catches — special-version variant tiers in GizzDex"
area: feature
files:
  - packages/core/src/dex/derive-dex.ts
  - packages/core/src/ingest/normalize.ts
  - packages/core/src/data/jamcharts (raw data, currently unused)
---

## Problem

**Feature idea #7 from 2026-07-19 research session. Second collection axis; solves the "night 2 of a no-repeat run can't add new catches for repeat attendees" progress problem.**

Pokémon shiny-hunting psychology: variant collecting (same species, rarer form) multiplies replay value on top of base completion. The live-music equivalents are exactly what kglw.net already annotates: **debuts, bust-outs (large gap), tour debuts, jamchart-flagged versions, 20-minute jams** (kglw.net literally maintains a Twenty Minute Jam Chart). Guezzer currently drops this data: `isjamchart`/`jamchart_notes` are fetched but never normalized (205KB jamcharts.json unused, noted as MODL-V2-03), and `tracktime` per-song durations are dropped entirely in normalize.ts. At a no-repeat residency, a repeat attendee catches few *new* songs — but every night can yield a shiny version.

## Solution

Concept — a catch upgrades to a foil/"shiny" variant when the version witnessed was special:

1. **Variant triggers** (derivable from corpus + kglw data): live debut (first-ever play — debut candidates already computed), bust-out (corpus gap ≥ threshold, e.g. 50–100 shows — gap already on `SongRarity`), tour debut, jamchart-flagged performance, duration ≥ 2× studio length or ≥ 20 min (needs durations kept through normalize).
2. **Dex rendering**: foil/holo treatment on AlbumDetail track rows + a shiny count in DexHeader; shiny-aware share cards ("you caught a SHINY Robot Stop — 22-minute version").
3. **Retro-derivation**: variants computable for already-marked archive shows too (the corpus knows which performances were debuts/bustouts/jamcharts) — instant delight on first ship.
4. **Data work**: keep `tracktime`, `isjamchart`, `jamchart_notes` through normalization; store per-performance (not per-song) so the *specific sighting* carries the variant.

Architecture fit: normalization additions + pure dex derivation + dex UI polish. Mid-size; the data plumbing is the main cost. Sources: kglw.net jamcharts/20-min chart, Bulbapedia shiny/Living Dex, Untappd leveled badges.

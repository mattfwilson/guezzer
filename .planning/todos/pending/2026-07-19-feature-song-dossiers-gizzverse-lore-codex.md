---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Song Dossiers + unlockable Gizzverse lore codex"
area: feature
files:
  - packages/core/src/ingest/normalize.ts
  - packages/app/src/explore/NodeSheet.tsx
  - packages/app/src/dex/AlbumDetail.tsx
---

## Problem

**Feature idea #9 from 2026-07-19 research session. Turns the dex into a story casual fans can follow; the lore hook is every beginner's guide's on-ramp.**

Per-song context is thin across the app, yet kglw.net's per-song pages show what fans want: times played, "% of all shows", "once every N shows", debut date, last played + current gap, durations, jamchart notes. Meanwhile the Gizzverse lore (Han-Tyumi, the Nonagon loop, Polygondwanaland's rivers, Rats' Nest mythology) is the thing every "beginner's guide to King Gizzard" leads with (Treble, NME, Levitation's "Beginner's Guide into the Gizzverse", kglw.net's own Compendium) — it's how casual listeners get hooked. The app says nothing about any of it.

## Solution

Concept — one Song Dossier component with three entry points (orb long-press "why" sheet, constellation NodeSheet, dex AlbumDetail row):

1. **Stats block** (all derivable from corpus/matrix): times played, once-every-N-shows, corpus gap ("last played 14 shows ago"), debut date, average duration (needs `tracktime` kept through normalize — shared plumbing with Shiny Catches todo), jamchart notes for notable versions, top transition neighbors ("usually follows X / leads into Y").
2. **Personal block**: your sightings, personal gap, variant/shiny status.
3. **Lore blurb, unlocked by catching**: a 2–4 sentence Gizzverse lore entry per song, shown as "???" until caught live — Pokédex flavor-text mechanics giving completionists a narrative chase and casual fans a story. Optional: a lore-thread view reusing the constellation renderer with lore edges (Han-Tyumi songs, Nonagon loop) instead of transition edges.
4. **Content cost is the real work**: ~264 blurbs, but the top ~80 live-rotation songs cover most catches — write those first, generic album-level fallback for the rest. Source material: kglw.net Gizzverse Compendium (kglw.net/blog/compendium-vol-00.html), fan wikis. Store as a static JSON keyed by songId in core data.

Architecture fit: data additions + pure derivations + one reusable sheet component. Mid-to-large (content authoring dominates).

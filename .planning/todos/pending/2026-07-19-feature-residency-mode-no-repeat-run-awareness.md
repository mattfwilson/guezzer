---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Residency Mode — no-repeat run awareness + songs-remaining pool"
area: feature
files:
  - packages/app/src/show/showContext.ts
  - packages/core/src/model/predict.ts
  - packages/core/src/config.ts
---

## Problem

**Feature idea #1 from 2026-07-19 research session — recommended build order: first, before the Aug 14 show.**

The app treats every show as independent, but King Gizzard residencies are stated-policy **no-repeat runs** (Red Rocks announced no repeats beforehand; Salt Shed '23 3 nights zero repeats; The Caverns "4 Nights of No Repeats"; 2025 Europe Residency no repeats within each city). Both of the owner's 2026 runs are 3-night residencies: Field of Vision II, Buena Vista CO (Aug 14–16) and Forest Hills Stadium, Queens (Aug 20–22 — nights 1–2 rock shows, night 3 a rave/electronic set). Fans at multi-night runs think in exactly these terms: "they burned Robot Stop last night, so tomorrow…".

## Solution

Concept — group consecutive tracked nights into a "run" and make the whole app run-aware:

1. **Run grouping**: consecutive-date tracked shows (same venue or explicit user grouping) form a run. Could be automatic (date adjacency) with a manual toggle.
2. **Revive rotation suppression** (see bug todo "Wire rotation suppression into live predictions"): feed prior finalized nights' song sets into `buildShowContext`. For runs, apply a much harder already-played-this-run penalty than the generic `0.5^n` rotation decay — no-repeats is policy, not tendency.
3. **"Songs remaining" pool view**: the catalog minus everything burned this run, sorted by model likelihood — the pre-show conversation piece for night 2/3. Pure core derivation (catalog − union of run setlists, ranked by adjusted base rates).
4. **Show-type awareness**: kglw.net tags shows (marathon/acoustic/festival/rave/orchestra; `show_tag` param on the API, tags in corpus). Orchestra shows have near-static setlists; rave sets aren't song-prediction territory at all. At minimum, let the user flag tonight's type and have the app say "prediction confidence is low for this show type" rather than emit confident nonsense — Forest Hills night 3 IS a rave set.

Architecture fit: run derivation and remaining-pool are pure core functions off existing Dexie data + matrix; UI is one new view/sheet plus a run indicator in Show Mode. Mid-size. Directly serves all six of the owner's 2026 show nights.

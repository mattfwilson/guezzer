# Phase 7: Explore Mode Constellation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 7-Explore Mode Constellation
**Areas discussed:** Ranked-bars data source, Default view & thresholds, Controls & dex overlay, Node tap & labels

---

## Ranked-bars data source

| Option | Description | Selected |
|--------|-------------|----------|
| Raw historical % (Recommended) | Straight from matrix edges; no ShowContext needed; the artifact the constellation already renders | ✓ |
| Live predict() scoring | Real predictor with empty/synthetic context — rotation/trail signals meaningless outside a show | |
| Both, toggleable | Historical default + model-view switch; two number systems, more UI burden | |

**User's choice:** Raw historical %

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + dates (Recommended) | "Played 12 of 35 times after this song · last: 2025-11-02 · 8 hard segues" — straight off the edge record | ✓ |
| Counts + signal flavor | Adds model-flavored context; extra derivation, blurs raw-history framing | |
| Minimal count only | Just "12/35 times" | |

**User's choice:** Counts + dates

| Option | Description | Selected |
|--------|-------------|----------|
| Complete history (Recommended) | Panel lists every outgoing transition regardless of slider/toggle; filters visual-only | ✓ |
| Match the visible graph | Panel and picture always agree, but history quietly shrinks with the slider | |

**User's choice:** Complete history

| Option | Description | Selected |
|--------|-------------|----------|
| Top 10 + expand (Recommended) | Ten bars + "show all N" expander for the one-off tail | ✓ |
| All, scrollable | No truncation; 50-row lists where rows 15+ are single plays | |
| Top 5 only | Mirrors Show Mode fan; hides real history | |

**User's choice:** Top 10 + expand

---

## Default view & thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Songs in last N shows (Recommended) | EXPL-03's literal reading; cheap derivation from the Phase 6 @archive artifact | ✓ |
| eraPlayCount > 0 | Baked into matrix nodes; zero plumbing but coarser/less explainable | |

**User's choice:** Songs in last N shows

| Option | Description | Selected |
|--------|-------------|----------|
| Data-driven at planning (Recommended) | Claude analyzes corpus density, proposes N yielding ~40–80 readable nodes, justified in writing; config constant | ✓ |
| Current tour | Dynamic N via tour_id; tour sizes vary; tour_id=1 sentinel needs special-casing | |
| Fixed pick now | Owner names a number today | |

**User's choice:** Data-driven at planning (resolves PROJECT.md open question #2)

| Option | Description | Selected |
|--------|-------------|----------|
| Transition count (Recommended) | Hide edges seen fewer than X times; kills 100%-from-one-play noise | ✓ |
| Probability % | Per-song normalized; rare songs produce misleading surviving edges | |
| Hybrid | Count floor + probability slider; two mechanisms to explain | |

**User's choice:** Transition count

| Option | Description | Selected |
|--------|-------------|----------|
| Keep visible (Recommended) | Orphaned nodes stay as free-floating stars; population never churns | ✓ |
| Hide with edges | Tidier but songs vanish and tap-targets churn | |
| Dim, don't hide | Collides visually with the dex overlay's dimmed-unseen language | |

**User's choice:** Keep visible

---

## Controls & dex overlay

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed filter FAB (Recommended) | One filter button (Phase 6 FAB idiom) expands toggle + slider + overlay switch; max canvas | ✓ |
| Persistent top chips | Always-visible chip row; permanent chrome on a small screen | |
| Bottom sheet | Roomiest but covers the graph while adjusting | |

**User's choice:** Collapsed filter FAB

| Option | Description | Selected |
|--------|-------------|----------|
| On by default (Recommended) | Opens as YOUR sky; toggle restores neutral tuning-family view | ✓ |
| Off by default | Neutral graph first; dex as opt-in lens | |
| Always on, no toggle | Loses the clean model-debugger view | |

**User's choice:** On by default

| Option | Description | Selected |
|--------|-------------|----------|
| Ring + number on zoom (Recommended) | Ring on every caught node; count number only past a zoom threshold | ✓ |
| Number badge always | Maximal info, guaranteed clutter at rest | |
| Ring only, count in panel | Cleanest canvas; count one tap away | |

**User's choice:** Ring + number on zoom

| Option | Description | Selected |
|--------|-------------|----------|
| Config-only (Recommended) | UI keeps binary Rotation/Full toggle; N in the single config file | ✓ |
| UI slider too | Second slider for N; heavy panel for a phone | |

**User's choice:** Config-only

---

## Node tap & labels

| Option | Description | Selected |
|--------|-------------|----------|
| Both at once (Recommended) | One tap highlights neighborhood AND opens the bars panel; tap empty space clears both | ✓ |
| Two-stage tap | First tap focuses, second opens panel; doubles taps for the common case | |

**User's choice:** Both at once

| Option | Description | Selected |
|--------|-------------|----------|
| Partial bottom sheet (Recommended) | ~40% height; focused neighborhood visible above; drag up for full list; matches existing sheet idiom | ✓ |
| Full-screen detail | More room; loses sight of the constellation and focus effect | |
| Side/floating card | Elegant on tablets, cramped on phones | |

**User's choice:** Partial bottom sheet

| Option | Description | Selected |
|--------|-------------|----------|
| Zoom-gated + focus (Recommended) | No labels at rest (or a handful on biggest nodes); fade in past zoom threshold; focused neighborhood always labeled | ✓ |
| Top-K always labeled | Permanent labels on K biggest nodes; overlap risk in dense clusters | |
| Focus-only labels | Cleanest; unfocused zoomed view stays anonymous | |

**User's choice:** Zoom-gated + focus (answers the STATE-flagged ~250-node label spike concern)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — chain hops (Recommended) | Bar tap selects that song, refocuses graph, reloads bars — walk probable setlist paths | ✓ |
| No — bars are read-only | Simpler; dismiss and tap the next node on canvas | |

**User's choice:** Yes — chain hops

---

## Claude's Discretion

- Data-driven defaults for N and edge-count threshold (proposed from real corpus density, justified in writing, config constants)
- Force-simulation tuning and freeze mechanics (`d3AlphaDecay`, `cooldownTicks`, `onEngineStop`)
- Whether the label spike runs as an early plan task or research prototype (D-15 is the strategy to validate)
- Pure core graph-derivation function design, fixture-tested
- Zoom thresholds, ring styling, dim opacities, sheet snap points — subject to /gsd-ui-phase
- Physics re-run behavior on toggle changes (bias toward stable positions)

## Deferred Ideas

- Era slider (2010 → present) — EXPL-V2-01, v2 stretch
- Model-view toggle on the bars panel — rejected for v1; possible future debug flag
- UI slider for rotation window N — config-only for v1
- Suppress update toast during an active tracked show — carried forward, still unclaimed
- Stale todos (orb text, FAB menu, InstallBanner) — all delivered in Phase 6; files safe to archive

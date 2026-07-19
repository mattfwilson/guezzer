# Phase 11: Live-Sync & Prediction Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 11-live-sync-prediction-correctness
**Areas discussed:** Run grouping & reset, Schema-drift policy, "Tonight" date guard, Suppression visibility

---

## Run grouping & reset (PRED-01, PRED-03)

**Q1 — How to decide which prior tracked shows count as "this run"?**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto by date gap | Group consecutive tracked shows into a run automatically; a gap > threshold starts a fresh run. Least thumb-work. | ✓ |
| User-declared run | User explicitly groups shows / starts a new run. Most precise, adds a setup step. | |
| Rolling last-N shows | Feed last N finalized shows regardless of dates. Simplest, but wrongly suppresses across weekends. | |

**Q2 — How should manual reset work alongside auto-grouping?**

| Option | Description | Selected |
|--------|-------------|----------|
| Manual override button | Auto is default; add a "start a fresh run" / clear-rotation control for edge cases. Satisfies PRED-03 literally. | ✓ |
| Auto-only, no button | Pure date-gap detection, no reset UI. Doesn't satisfy PRED-03 wording; can't fix a wrong guess. | |
| Reset on new-run detection | Auto-detect + confirmation prompt at the run boundary. Middle ground; extra tap. | |

**Q3 — Date-gap threshold?**

| Option | Description | Selected |
|--------|-------------|----------|
| 2 days | Same run if within 2 calendar days; tolerates one rest night. | |
| 1 day (strictly consecutive) | Only back-to-back nights; a skipped night splits a run. | |
| You decide | Planner picks a sensible tunable default in config.ts. | ✓ |

**User's choice:** Auto date-gap grouping + manual override button; gap threshold left to planner (tunable config constant).
**Notes:** Owner confirmed the mental model — consecutive nights within the gap suppress each other; a weekend-apart run resets and does not suppress prior-run songs. Root cause noted: `buildShowContext` always passes `recentFinalizedShowSongSets = []`, so suppression can't fire today.

---

## Schema-drift policy (LIVE-03)

**Q1 — What should the poll do on an unknown/additive field?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tolerate + flag drift | Accept the row (ignore unknown field) AND detect the novel key to surface on SyncDot. Satisfies both halves of LIVE-03. | ✓ |
| Surface only, still strict | Keep rejecting unknown keys but stop swallowing. Rejected rows still kill suggestions. | |
| Silently tolerate, no signal | Loosen schema, show nothing. Violates "surfaced, not swallowed." | |

**Q2 — How loud should the SyncDot drift signal be?**

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet distinct state | Subtle distinct SyncDot state (e.g. amber), tap for detail, never a blocker. | ✓ |
| Just a logged flag | Record drift but no dedicated SyncDot state. | |
| You decide | Leave exact treatment to UI planner. | |

**User's choice:** Tolerate additive fields + detect novel key + quiet distinct SyncDot state (logged once, non-blocking).
**Notes:** Consumed-field breakage still skips the row. `pollLatest` needs to return a drift flag; current return shape + swallowing `catch {}` can't carry it.

---

## "Tonight" date guard (LIVE-01)

**Q1 — What should suggestion/fill-hint latestRows be guarded against?**

| Option | Description | Selected |
|--------|-------------|----------|
| Bound show_id, else date | Once bound, keep only rows with that show_id; before binding, match the tracked show's date. Robust past midnight. | ✓ |
| Tracked show's date only | Filter to the tracked show's own date (not wall-clock). Robust past midnight, slightly looser. | |
| Wall-clock today | Filter to today's date. Breaks for a set running past midnight. | |

**User's choice:** Guard by bound `show_id`, else the tracked show's date.
**Notes:** `diffLatestAgainstTrail`/`resolvePlaceholders` currently apply no guard; `bindShowFromLatest` already date-guards binding. Using the show's date (not the clock) survives past-midnight sets.

---

## Suppression visibility (PRED-01)

**Q1 — How visible should cross-night down-weighting be?**

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit rank drop | Wired suppression makes played-this-run songs sink; no new UI. Keeps Phase 11 a tight fix. | ✓ |
| Explicit reason badge | Marker/dimming on suppressed songs. New UI surface, arguably Phase 13. | |
| You decide | Planner picks lightest observable treatment. | |

**User's choice:** Implicit rank drop only.
**Notes:** Explicit badge deferred to Phase 13.

---

## Claude's Discretion

- Date-gap threshold default value (config.ts, tunable).
- Exact SyncDot drift visual treatment.
- PRED-02 era-prior unit-mismatch fix (internal model correctness — not a user decision).
- LIVE-02 artist scope — verify existing `artist_id !== 1` filter covers the whole path (may already be satisfied).

## Deferred Ideas

- Explicit "played last night" suppression badge → Phase 13.
- Reviewed-but-not-folded todos (out of Phase 11 scope): bottom-sheet animation, app-wide date format, share-card GizzDex totals (UI polish); Couch Mode, Gizz Bingo, Guezz League (new capabilities / later phases).

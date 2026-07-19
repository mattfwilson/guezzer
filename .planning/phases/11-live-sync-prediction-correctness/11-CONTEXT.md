# Phase 11: Live-Sync & Prediction Correctness - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

On night 2+ of a no-repeat residency (Aug 14, 2026 — 3-night runs), tonight's
live suggestions and predictions are trustworthy: no previous-show or
wrong-artist songs leak into suggestions/auto-bind, live sync survives
kglw.net API drift instead of silently dying, and cross-night rotation
suppression actually fires with real prior-night data (and can be reset for a
new run).

**Scope anchor:** correctness fixes to the existing live-sync + prediction
pipeline (LIVE-01/02/03, PRED-01/02/03). This clarifies HOW to fix scoped
bugs — it does NOT add new capabilities. New live/prediction features (Couch
Mode, Bingo, Guezz League) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Cross-night rotation: run grouping & reset (PRED-01, PRED-03)
- **D-01:** The app must feed prior finalized tracked shows of the current run
  into `recentShowSongSets` so `rotationSuppression` fires. **Root cause of
  PRED-01:** `packages/app/src/show/showContext.ts` `buildShowContext()` is
  always called with the default `recentFinalizedShowSongSets = []` (never
  wired at `useShowSession.ts`), so cross-night suppression can NEVER fire
  today. The core scoring (`predict.ts` `rotationSuppression`) already works;
  only the app-side context assembly is missing.
- **D-02:** "This run" is grouped **automatically by date gap**: consecutive
  tracked shows within a threshold of each other form one run; a larger gap
  starts a fresh run (so a separate weekend does not suppress prior-run songs
  — PRED-03's intent). No per-show setup on the happy path.
- **D-03:** The date-gap threshold is a **tunable constant in
  `packages/core/src/config.ts`** (planner picks the default; owner said "you
  decide"). Sensible starting default ~2 calendar days (tolerates a single
  rest night between nights of a run); keep it a single named config value,
  not a scattered literal.
- **D-04:** Provide a **manual "start a fresh run" / "clear cross-night
  rotation" override control** in addition to auto-grouping. This satisfies
  PRED-03 literally ("user CAN reset") and fixes wrong auto-guesses (two runs
  in one weekend, a one-off show between nights). After reset, subsequent
  shows are not suppressed by pre-reset songs.

### Schema-drift tolerance & surfacing (LIVE-03)
- **D-05:** Additive/unknown API fields must **not** kill the live path.
  Parse leniently so an unknown key leaves the row usable — suggestions and
  auto-bind keep working. **Current bug:** `latestSetlistRow` is a
  `z.strictObject` that rejects any unknown key
  (`packages/core/src/ingest/latest-types.ts`), and `pollLatest`'s per-row
  `safeParse` failure + outer `catch {}` swallow it silently
  (`packages/core/src/live/poll-latest.ts`), so one new field empties
  suggestions with no signal.
- **D-06:** **Detect + surface** the drift rather than swallow it. Separately
  from parsing, detect that a novel key appeared and surface it on the
  SyncDot. `pollLatest` should return (or otherwise expose) a drift flag to
  the `useLatestPoll` hook so the app can set the SyncDot state — the current
  `Promise<LatestSetlistRow[]>` return + swallowing `catch` cannot carry this
  signal.
- **D-07:** Consumed-field breakage is unchanged — if a *consumed* field is
  missing/wrong-typed, that row is still skipped (it is genuinely unusable).
  Only *additive/unknown* keys switch from fatal-to-tolerated.
- **D-08:** SyncDot drift signal is a **quiet, distinct, non-blocking state**
  (e.g. amber "syncing — API shape changed", tap for detail) — never a modal
  or mid-set blocker. Log the drift **once**, not per-row (no spam). Fits a
  one-thumb-in-the-dark tool.

### "Tonight" date guard for suggestions/fill-hints (LIVE-01)
- **D-09:** Guard `latestRows` before they feed suggestions and placeholder
  resolution by **bound `show_id` when the tracked show is bound, else the
  tracked show's own date**:
  - `trackedShow.showId != null` → keep only rows where
    `row.show_id === trackedShow.showId` (identity match — tightest).
  - unbound → keep only rows where `row.showdate === <tracked show's date>`
    (the show's date, NOT wall-clock `today`).
  **Current bug:** `diffLatestAgainstTrail` and `resolvePlaceholders`
  (`packages/core/src/live/suggest.ts`) apply NO date/show guard, so a cached
  previous-night `latest` leaks yesterday's songs on night 2+.
  `bindShowFromLatest` already date-guards binding; the suggestion path must
  get an equivalent (stronger, show_id-based) guard.
- **D-10:** Using the tracked show's date (not wall-clock today) makes the
  guard robust to a set running **past midnight** — the show's own rows are
  never rejected as "yesterday."

### Suppression visibility (PRED-01)
- **D-11:** Down-weighting is surfaced via the **implicit rank drop** only —
  once suppression is wired (D-01), played-this-run songs score lower and sink
  in the ranked prediction list, which satisfies "visibly down-weighted" with
  **no new UI**. An explicit "played last night" badge/dimming is deferred to
  Phase 13 (Interface Polish).

### Claude's Discretion
- **PRED-02 (era-prior unit mismatch):** internal model fix — correct the
  unit mismatch so the retired-song floor (`eraPriorFloor`) is actually
  reachable. `eraPrior` in `predict.ts` computes `eraRate = eraPlayCount /
  eraWindowShows`; researcher/planner to pin the exact mismatch (e.g.
  `eraPlayCount` window vs `eraWindowShows` divisor) and fix. Not a user
  decision.
- **LIVE-02 (artist scope):** `pollLatest` already filters
  `parsed.data.artist_id !== 1` (King Gizzard). Researcher to CONFIRM this
  scope holds across the full path (suggestions, auto-bind, fill-hints) and
  that no consumer receives unfiltered rows — may already be satisfied;
  harden/verify rather than redesign.
- Exact date-gap default value (D-03) and the precise SyncDot visual
  treatment (D-08) are planner/UI discretion within the constraints above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — LIVE-01/02/03, PRED-01/02/03 definitions (v1.2).
- `.planning/ROADMAP.md` §"Phase 11" — goal + 5 success criteria (what must be TRUE).

### API schema & trust boundary
- `docs/SCHEMA.md` §9 — `latest` can surface the wrong/foreign-band show (Stu
  Mackenzie solo set); basis for the artist filter and date/show guard.
- `docs/SCHEMA.md` §11 — the 5 keys `latest` omits vs the full `setlists` row
  (why `latestSetlistRow` is authored fresh, not `.omit()`).
- `docs/SCHEMA.md` §12 — `songname`/`venuename` are untrusted editor content,
  carried verbatim, never rendered in core.

### Model constants
- `packages/core/src/config.ts` — home for the new run-gap threshold constant
  (D-03); existing `rotationWindowShows`, `rotationPenaltyPerShow`,
  `eraWindowShows`, `eraPriorFloor`/`Ceil`/`SmoothingK` (PRED-01/02).
- `.planning/phases/02-transition-matrix-model-backtest/02-RESEARCH.md`
  (M3/A4 rotation, M8/A6 era-prior) — rationale behind the suppression and
  era-prior constants being fixed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/src/model/predict.ts` `rotationSuppression(B, ctx, cfg)` —
  already correctly applies `rotationPenaltyPerShow ^ timesPlayed` over
  `ctx.recentShowSongSets`. Needs no change; just needs real data fed in.
- `packages/app/src/show/showContext.ts` `buildShowContext(...,
  recentFinalizedShowSongSets)` — already accepts the cross-night window; the
  3rd param is the wiring seam for D-01.
- `packages/core/src/live/bind-show.ts` `bindShowFromLatest` — existing
  date-guard pattern (`head.showdate === todayIso`); the suggestion-path guard
  (D-09) mirrors/strengthens it (show_id).
- `packages/app/src/live/SyncDot.tsx` — existing sync-status indicator; add
  the drift state here (D-06/D-08).
- `packages/app/src/live/useLatestPoll.ts` — the poll lifecycle hook; consumes
  `pollLatest` and would receive the new drift flag.

### Established Patterns
- Strict core/UI separation: all decision logic (guards, diff, drift
  detection) lives in `packages/core/src/live/*` and `model/predict.ts`; the
  app tier only wires lifecycle + renders. Keep the new guard + drift-detection
  pure and DOM-free.
- All model constants live in `config.ts` — the run-gap threshold must go
  there, no scattered literal (CLAUDE.md).
- `latestSetlistRow` intentionally lists the full present key set; loosening
  for D-05 must preserve the ability to *detect* a genuinely novel key (the
  drift signal), not blindly `.passthrough()` and lose detection.

### Integration Points
- `pollLatest` return shape (`Promise<LatestSetlistRow[]>`) → `useLatestPoll`
  → `SyncDot`: needs to carry a drift flag (D-06).
- `useShowSession` → `buildShowContext`: needs to compute the current run's
  prior finalized tracked shows (Dexie query grouped by date gap) and pass
  them as `recentFinalizedShowSongSets` (D-01/D-02).
- Reset control (D-04) → the run-grouping source of truth (persisted marker or
  derived boundary) that `buildShowContext` reads.

</code_context>

<specifics>
## Specific Ideas

- Run grouping mental model (owner-confirmed): consecutive nights within the
  gap = one run that suppresses; a weekend-apart run resets and does not
  suppress prior-run songs.
- SyncDot drift = "syncing, but the API shape changed" — visible if you look,
  never interrupts logging mid-set.

</specifics>

<deferred>
## Deferred Ideas

- **Explicit suppression reason badge** ("played last night" / dimmed
  chip on down-weighted songs) → Phase 13 (Interface & Explore Polish). Phase
  11 satisfies PRED-01 via implicit rank drop only.

### Reviewed Todos (not folded)
Cross-referenced pending todos matched on keywords but are out of Phase 11's
correctness scope — reviewed and NOT folded:
- "Bottom sheets — smooth up/down animation + layering" — UI polish (Phase 13).
- "Readable full-date format app-wide" — UI polish (Phase 13).
- "Final show share card uses GizzDex totals" — share-card/data (Phase 12/13).
- "Couch Mode — follow from home via latest poll" — new capability, own phase.
- "Gizz Bingo — live auto-marking cards" — Phases 14–16.
- "Guezz League — pregame prediction game" — new capability, own phase.

</deferred>

---

*Phase: 11-live-sync-prediction-correctness*
*Context gathered: 2026-07-19*

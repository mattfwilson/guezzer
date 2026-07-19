---
phase: 11-live-sync-prediction-correctness
plan: 04
subsystem: app
tags: [live-sync, poll-result, schema-drift, guard-latest-rows, sync-dot, live-01, live-03]

# Dependency graph
requires:
  - phase: 11-live-sync-prediction-correctness
    plan: 02
    provides: "PollResult { rows, schemaDrift, novelKeys? }, guardLatestRows(rows, TonightGuardInput), detectNovelKeys"
provides:
  - "useLatestPoll widened to (result: PollResult) => void — the LIVE-03 drift signal rides the same stable ref as the rows"
  - "SyncDot third amber (#F59E0B) schemaDrift state — tappable, non-modal, key-names-only detail, distinct aria-label"
  - "ShowView guardedRows: guardLatestRows applied ONCE at ingress, feeding diff/resolve/bind (LIVE-01 app half)"
  - "?mockLatest=drift harness path injecting a novel key to exercise the amber drift state on-device"
affects: [11-05 app prediction wiring shares ShowView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-channel poll result: the whole PollResult rides one stable callback ref (rows + drift stay coupled, never a poll out of step with its own rows)"
    - "Ingress guard once in the view: guardLatestRows computed in a useMemo keyed on latestRows + session.active {showId,date}, consumed by every downstream fn — never re-filtered per consumer"
    - "Non-modal advisory affordance: the amber SyncDot is a self-contained inline popover (never a modal/banner), so logging is wholly independent of its render"

key-files:
  created: []
  modified:
    - packages/app/src/live/useLatestPoll.ts
    - packages/app/src/live/SyncDot.tsx
    - packages/app/src/live/mockLatest.ts
    - packages/app/src/config.ts
    - packages/app/src/show/ShowView.tsx
    - packages/app/test/useLatestPoll.test.tsx
    - packages/app/test/mockLatest.test.ts
    - packages/app/test/adopt.test.tsx

key-decisions:
  - "Drift channel shape: WIDENED onRows to (result: PollResult) => void rather than adding a second onDrift(novelKeys) callback — one channel keeps the stable onResultRef idiom and couples the drift flag to the rows it arrived with"
  - "DRIFT_AMBER = #F59E0B — a calm amber distinct from hit-green/muted-ring, deliberately NOT accent-gold/miss-red so it reads as info not error; clears WCAG 1.4.11 ≥3:1 on #0C0C10 (≈8.9:1) and the #17171F header (≈7.9:1)"
  - "Amber SyncDot is the ONLY interactive SyncDot state — a <button> with a negative-margin tap target around the 8px glyph (no header layout shift), toggling an inline key-names-only popover"
  - "?mockLatest=drift (new flag value) injects MOCK_NOVEL_KEY into every fixture row; ?mockLatest=1 stays clean (no drift) so the two UAT paths are separable"

requirements-completed: [LIVE-01, LIVE-03]

# Metrics
duration: ~7min
completed: 2026-07-19
---

# Phase 11 Plan 04: Live-Sync App Wiring (PollResult + guard) Summary

**The app-tier completion of LIVE-01 and LIVE-03: `useLatestPoll` now speaks the widened `PollResult`, `ShowView` guards the latest rows ONCE with `guardLatestRows` before every suggestion/fill-hint/auto-bind consumer, and an additive kglw.net API field surfaces as a quiet, tappable amber `SyncDot` state instead of silently emptying the strip.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 8

## Accomplishments

- **LIVE-03 (Task 1):** `useLatestPoll`'s callback widened from `(rows: LatestSetlistRow[]) => void` to `(result: PollResult) => void` — `result.rows` is identical to the old array, and `result.schemaDrift`/`result.novelKeys` ride the SAME stable `onResultRef` (chosen over a second `onDrift` callback so the drift flag stays coupled to the rows it came with). `SyncDot` gained a third amber `#F59E0B` state: a distinct `aria-label` ("Sync: API shape changed"), a non-modal tap-for-detail inline popover rendering novel key NAMES only, and a comfortable negative-margin tap target that never shifts the header. `mockLatest` gained a `?mockLatest=drift` path injecting `MOCK_NOVEL_KEY` so the amber path is exercisable on-device.
- **LIVE-01 (Task 2):** `ShowView` computes `guardedRows = guardLatestRows(latestRows, { showId: session.active.showId, date: session.active.date })` ONCE in a memo and feeds it to all three consumers — `diffLatestAgainstTrail`, `resolvePlaceholders`, and `bindShowFromLatest`. No consumer receives raw `latestRows` (single-filter ingress discipline). A previous night's cached `latest` payload can no longer leak yesterday's songs into tonight's suggestions/fill-hints/auto-bind.
- **Drift threading:** `PollResult.schemaDrift`/`novelKeys` flow poll → `useLatestPoll` → `ShowView` state → `SyncDot` `schemaDrift`/`novelKeys` props — surfaced, never swallowed; never blocking (logging is independent of the SyncDot render).

## Task Commits

1. **Task 1: PollResult through useLatestPoll + amber SyncDot state (LIVE-03 app)** — `0124c9e`
2. **Task 2: guardedRows in ShowView + drift wiring (LIVE-01 app)** — `3b0c66e`

## Files Created/Modified

- `packages/app/src/live/useLatestPoll.ts` — channel widened to `(result: PollResult) => void`; `onRowsRef` → `onResultRef`; backoff reads `result.rows.length`
- `packages/app/src/live/SyncDot.tsx` — third amber `schemaDrift` state (`DRIFT_AMBER` token + WCAG comment), tappable non-modal key-names-only detail, distinct aria-label
- `packages/app/src/live/mockLatest.ts` — `?mockLatest=drift` injects `MOCK_NOVEL_KEY`; exported `MOCK_NOVEL_KEY`
- `packages/app/src/config.ts` — `copy.live.schemaDriftDetail(keys)` (names-only drift copy)
- `packages/app/src/show/ShowView.tsx` — `guardedRows` memo (single ingress guard) feeding diff/resolve/bind; drift state threaded to `SyncDot`
- `packages/app/test/useLatestPoll.test.tsx` — migrated to the `PollResult` shape + a drift-propagation assertion
- `packages/app/test/mockLatest.test.ts` — `result.rows` destructure + a `?mockLatest=drift` schemaDrift/novelKeys assertion
- `packages/app/test/adopt.test.tsx` — stale previous-night-row exclusion case (guard drops it from suggestions AND fill-hints)

## Drift channel shape (for device UAT)

- **Chosen channel:** widened `onRows` → `useLatestPoll(active, (result: PollResult) => void)`. `result.rows` unchanged content; `result.schemaDrift` + `result.novelKeys` (names only) on the same stable ref.
- **DRIFT_AMBER token:** `#F59E0B` (WCAG ≥3:1 on `#0C0C10` and the `#17171F` header).
- **UAT harness:** `?mockLatest=drift` injects `mock_novel_field` into every fixture row → SyncDot goes amber, tap shows the key name, suggestions keep working.

## Decisions Made

- Widened `onRows` to carry the whole `PollResult` rather than a second `onDrift` callback — one channel, stable-ref-safe, drift coupled to its rows.
- `DRIFT_AMBER = #F59E0B` — info-amber, not accent-gold/miss-red; contrast-justified in the token comment matching the file's existing discipline.
- The amber SyncDot is the sole interactive SyncDot state; the online/offline states stay passive `<span>`s.
- `?mockLatest=drift` is a separate flag value from `?mockLatest=1` so the clean and drift UAT paths are independent.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None. All three plan mitigations hold: the drift detail renders novel key NAMES only via JSX escaping (T-11-04-01, no `dangerouslySetInnerHTML`, never editor values); the amber state is a non-modal inline popover with logging independent of its render (T-11-04-02); `guardLatestRows` is applied once atop the core `artist_id !== 1` filter (T-11-04-03).

## Verification

- `npx vitest run packages/app/test/useLatestPoll.test.tsx packages/app/test/mockLatest.test.ts packages/app/test/adopt.test.tsx` — green.
- Full app suite: **45 files / 287 tests green**. Full repo suite (`npm test`): **77 files / 613 tests green** — the 11-02 `pollLatest` signature ripple is fully resolved.
- App `tsc --noEmit` clean.
- **Deferred (human):** Device UAT over an HTTPS tunnel with `?mockLatest=drift` — confirm SyncDot goes amber, tap shows key-name detail, suggestions keep working, and a previous-night cached payload yields no stale suggestions on night 2 (VALIDATION.md Manual-Only).

## Self-Check: PASSED

- `packages/app/src/live/useLatestPoll.ts` — FOUND (`PollResult`, `onResultRef`)
- `packages/app/src/live/SyncDot.tsx` — FOUND (`DRIFT_AMBER`, `schemaDrift`)
- `packages/app/src/show/ShowView.tsx` — FOUND (`guardLatestRows`, `guardedRows`)
- Commits `0124c9e`, `3b0c66e` — present in git log

---
*Phase: 11-live-sync-prediction-correctness*
*Completed: 2026-07-19*

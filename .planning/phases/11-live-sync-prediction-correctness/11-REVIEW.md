---
phase: 11-live-sync-prediction-correctness
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - packages/core/src/config.ts
  - packages/core/src/index.ts
  - packages/core/src/ingest/latest-types.ts
  - packages/core/src/live/poll-latest.ts
  - packages/core/src/live/run-grouping.ts
  - packages/core/src/live/suggest.ts
  - packages/core/src/model/index-build.ts
  - packages/core/src/model/predict.ts
  - packages/core/test/latest-types.test.ts
  - packages/core/test/model/predict.test.ts
  - packages/core/test/poll-latest.test.ts
  - packages/core/test/run-grouping.test.ts
  - packages/core/test/suggest.test.ts
  - packages/app/src/config.ts
  - packages/app/src/db/db.ts
  - packages/app/src/live/SyncDot.tsx
  - packages/app/src/live/mockLatest.ts
  - packages/app/src/live/useLatestPoll.ts
  - packages/app/src/settings/SettingsView.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/useShowSession.ts
  - packages/app/test/adopt.test.tsx
  - packages/app/test/exportImportRoundtrip.test.ts
  - packages/app/test/mockLatest.test.ts
  - packages/app/test/settingsOwner.test.tsx
  - packages/app/test/showSession.test.ts
  - packages/app/test/useLatestPoll.test.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 11 delivers cross-night rotation suppression (PRED-01/PRED-03), a lenient-but-drift-detecting `latest` schema (LIVE-03), the `PollResult` object return, and the PRED-02 eraPrior unit fix. I verified each of the four flagged focus areas:

- **eraPrior arithmetic (PRED-02):** correct. `eraRate = eraPlayCount/eraWindowShows` and `allTimeRate = playCount/showCount` are now dimensionally matched per-show rates; with `k = 0.08` a retired song (0 era plays, career rate ≈ 0.2/show) reaches the `eraPriorFloor` (0.3) and a hot song exceeds 1.0. The rescale is sound and the RED-gate fixture (Test 10) is genuinely satisfied by the fix.
- **guardLatestRows tonight/show guard:** correct. Bound shows filter on `show_id` identity; unbound shows filter on the show's OWN stored `date`. No wall-clock (`todayIso`) is read on either branch, so a past-midnight set is not self-rejected.
- **Schema-drift detection:** correct. `KNOWN_LATEST_KEYS` is derived from `latestSetlistRow.shape` (never a hand-maintained second list); `.catchall` keeps additive-key rows usable while `detectNovelKeys` surfaces key NAMES only. Drift is aggregated and logged once per poll.
- **Core purity:** no React/DOM imports found in `packages/core`. `poll-latest.ts` uses only `fetch`/`AbortSignal`/`console` (Node+browser globals, DI-injected), and `run-grouping.ts`/`suggest.ts` re-declare app shapes locally rather than importing them.

However, the headline feature of this phase — cross-night rotation suppression for multi-night residencies — contains a silent slice-direction defect that no test exercises. Details below.

## Critical Issues

### CR-01: rotationSuppression selects the OLDEST N run-shows, not the most-recent N

**File:** `packages/core/src/model/predict.ts:252`
**Issue:**
`currentRunShowSets` returns the run's song-sets **newest-first** (documented and asserted: `run-grouping.ts:66` sorts newest-first; `run-grouping.test.ts:26` expects `[night15, night14, night13]`). That array flows unchanged through `buildShowContext` (`showContext.ts:36`) into `ctx.recentShowSongSets`, then into:

```ts
const window = ctx.recentShowSongSets.slice(-cfg.rotationWindowShows);
```

For a newest-first array, `.slice(-N)` takes the **last** N elements — i.e. the **oldest** N nights of the run. The documented intent (predict.ts:243-249) is "how many of the **last `rotationWindowShows` recent** shows played `B`", which for a newest-first array is `.slice(0, N)`.

When a run is longer than `rotationWindowShows` (config default **3**) the suppression window looks at the wrong end of the residency: a song played the last 3 consecutive nights is NOT suppressed, while a song played the first 2 nights (and dropped since) IS suppressed — the exact inverse of the feature's purpose. `runGapDays = 2` chains one-night-off residency legs into a single run, so runs of 4-5+ nights are the *expected* case this phase targets, not an edge case.

This is untested: every fixture feeds ≤ `rotationWindowShows` shows (`predict.test.ts:377` uses exactly 3; `run-grouping.test.ts` and `showSession.test.ts` use ≤3 prior nights), so `slice(-3)` and `slice(0,3)` return the same result and the direction error is invisible.

**Fix:**
```ts
export function rotationSuppression(B: number, ctx: ShowContext, cfg: ScoringConfig): number {
  // recentShowSongSets is newest-first (currentRunShowSets); take the most
  // recent rotationWindowShows shows from the FRONT, not the tail.
  const window = ctx.recentShowSongSets.slice(0, cfg.rotationWindowShows);
  const timesPlayed = window.filter((songSet) => songSet.includes(B)).length;
  return Math.pow(cfg.rotationPenaltyPerShow, timesPlayed);
}
```
Add a regression fixture with a run of 4-5 nights where the suppressed song appears only in the most-recent nights (or only the oldest) so the two slice directions diverge. Whichever fix is chosen, `currentRunShowSets`' documented newest-first contract and `rotationSuppression`'s window end must be made consistent.

## Warnings

### WR-01: diffLatestAgainstTrail can emit two suggestions with the same song_id

**File:** `packages/core/src/live/suggest.ts:106-134`
**Issue:** The docstring states suggestions are "deduped by song_id," but dedupe is only performed against the **trail's** logged ids (`loggedSongIds`) and the `excludeSongIds` set — never against other latest rows already pushed into `suggestions`. If the editor's un-logged prefix contains the same `song_id` at two positions (a reprise/sandwich, which the codebase explicitly designs for elsewhere via `alreadyPlayedFactor`), both occurrences can be pushed as separate `Suggestion`s, showing the same song twice in the strip. Low likelihood (requires two near-adjacent un-logged occurrences within the `suggestionCount` window) but contradicts the stated contract.
**Fix:** Track pushed ids and skip repeats:
```ts
const seen = new Set<number>();
for (const row of ordered) {
  if (suggestions.length >= suggestionCount) break;
  if (loggedSongIds.has(row.song_id)) continue;
  if (excludeSongIds?.has(row.song_id)) continue;
  if (seen.has(row.song_id)) continue;
  seen.add(row.song_id);
  suggestions.push({ /* ... */ });
}
```

### WR-02: KGLW artist_id `1` is a scattered magic number

**File:** `packages/core/src/live/poll-latest.ts:109`
**Issue:** `if (parsed.data.artist_id !== 1) continue;` hardcodes the KGLW artist id as a bare literal. CLAUDE.md's single-config-file constraint ("no scattered magic numbers"; `config.ts` centralizes `sentinelSongIds`, `tourIdSentinel`, etc.) is violated — the same `1` recurs in `mockLatest.ts:41`/fixtures and (per its own comment, DATA-03) in the build-time fetch path, with no single source of truth. A future artist-id correction must be hunted across files.
**Fix:** Add `kglwArtistId: 1` to `config.ts` and reference `config.kglwArtistId` in `poll-latest.ts` (and downstream). Keeps the trust-boundary filter tunable in one place.

## Info

### IN-01: scoreCandidate recomputes the backoff tiers up to three times

**File:** `packages/core/src/model/predict.ts:447-460`
**Issue:** `transitionProb`, `tuningAffinity`, and `basePlayRate` are each evaluated inside `baseFactor` (447), again inside `dominantBackoffTier` (456), and `transitionProb` a third time when populating `factors.transitionProb` (460). This is a maintainability/DRY smell (three independent evaluation sites that must stay consistent), not a correctness bug — the functions are pure so results agree. (Performance is out of v1 scope.)
**Fix:** Compute the four tier contributions once, pass them to both `baseFactor` and the dominant-tier selection, and reuse `transitionProb` for the factor breakdown.

### IN-02: live poller does not apply the settype allowlist

**File:** `packages/core/src/live/poll-latest.ts:106-110`
**Issue:** `config.settypeAllowlist` (`["Set", "One Set"]`) filters the build-time corpus but is not applied to live `latest` rows — only `artist_id` is enforced. A KGLW "Live Session" (radio) or soundcheck payload with `artist_id === 1` surfacing on `latest` would be treated as show rows. Practically low-risk because polling is app-gated to an active in-venue show, and the guard/date filters constrain it further, so this is informational rather than a defect.
**Fix (optional):** If desired, skip rows whose `settype` is outside `config.settypeAllowlist` in the poll loop, mirroring the corpus discipline.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

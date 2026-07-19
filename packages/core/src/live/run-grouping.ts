/**
 * Run-grouping by date gap (PRED-01 / PRED-03, D-02/D-03/D-04). Pure, DOM-free.
 *
 * `rotationSuppression` (model/predict.ts:251) is already correct but in live
 * use is fed an empty `recentShowSongSets` (the app hardcodes the 3rd
 * `buildShowContext` arg), so cross-night suppression can never fire. This
 * module produces that missing window: given the prior FINALIZED shows of a
 * tour, it returns the song sets of just the shows in the SAME run as the
 * current date — consecutive nights within `runGapDays` of each other — so a
 * song played every night of a residency is suppressed while a song from a
 * separate earlier weekend is not (PRED-03 intent).
 *
 * Zero DOM, zero db.ts dependency, zero `Date.now`: the caller (app plan 11-05,
 * `useShowSession`) supplies the finalized shows + the current show's OWN date
 * and reset marker. `FinalizedShowInput` is a minimal local projection of the
 * app's tracked-show row — re-declared here, NEVER imported, mirroring
 * suggest.ts's `TonightGuardInput`/`TrailEntryInput` idiom (CLAUDE.md strict
 * core/UI separation). Date arithmetic is plain UTC parsing of `YYYY-MM-DD`
 * strings (`Date.parse` is UTC for date-only ISO), so there is no timezone
 * drift and no wall-clock read.
 */

/** Days between two `YYYY-MM-DD` dates (UTC, `a - b` in whole days; may be fractional only if callers pass times, which they do not). */
const MS_PER_DAY = 86_400_000;
function dayGap(laterDate: string, earlierDate: string): number {
  return (Date.parse(laterDate) - Date.parse(earlierDate)) / MS_PER_DAY;
}

/**
 * Minimal projection of the app's finalized tracked show that run-grouping
 * needs. Re-declared here — NOT imported — to keep core app-free. `date` is the
 * show's OWN stored date (`YYYY-MM-DD`); `songIds` is that night's logged set.
 */
export interface FinalizedShowInput {
  date: string;
  songIds: number[];
}

/**
 * The prior finalized shows belonging to the SAME run as `currentDate` (D-02/
 * D-03/D-04). A run is a chain of shows where each consecutive calendar gap is
 * `<= cfg.runGapDays`; the walk starts from `currentDate` and stops at the
 * first larger gap. Returns the kept shows' `songIds` arrays, newest-first —
 * ready to become `ShowContext.recentShowSongSets`, which `rotationSuppression`
 * further slices to `cfg.rotationWindowShows`.
 *
 * - Excludes any show on/after `resetBoundaryDate` when provided (manual reset,
 *   D-04): the owner declaring "new run" drops everything from the boundary
 *   forward out of the window.
 * - Excludes any show whose `date >= currentDate` (the current/active show is
 *   never a prior — its in-progress trail is handled by `alreadyPlayedFactor`,
 *   not rotation; Pitfall 4). The caller passes only finalized priors; this is
 *   a belt-and-suspenders guard so the fn never fabricates the current set.
 * - Empty input, or no prior show within `runGapDays` of `currentDate`, → `[]`.
 */
export function currentRunShowSets(
  finalized: FinalizedShowInput[],
  currentDate: string,
  cfg: { runGapDays: number },
  resetBoundaryDate?: string,
): number[][] {
  const eligible = finalized
    .filter((show) => show.date < currentDate)
    .filter((show) => resetBoundaryDate === undefined || show.date < resetBoundaryDate)
    // newest-first
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const run: number[][] = [];
  let anchor = currentDate;
  for (const show of eligible) {
    if (dayGap(anchor, show.date) > cfg.runGapDays) break;
    run.push(show.songIds);
    anchor = show.date;
  }
  return run;
}

/**
 * Honest confidence display helpers (D-09/D-10, EVAL-04). Pure — no React, no
 * DOM. The orb % is the model's ABSOLUTE `score`, NEVER a renormalized share of
 * the fan (no divide by the fan sum, D-09). Only a notated hard segue reaches
 * ~97%; an honest free-choice orb topping out ~20–25% is correct.
 */
import { config } from "../config.ts";

/** A candidate's score-only shape (subset of PredictionCandidate). */
export interface ScoredCandidate {
  score: number;
}

/**
 * Format an orb's absolute score for display (SHOW-01, 04-UI-SPEC §Typography):
 * `round(score*100)%`; if it rounds to 0, show `<1%` — never a bare `0%` on a
 * shown orb. No renormalization: each orb formats its own score independently.
 */
export function formatOrbPercent(score: number): string {
  const pct = Math.round(score * 100);
  return pct <= 0 ? "<1%" : `${pct}%`;
}

/**
 * Weak-fan check (D-10): the whole fan softens when the TOP orb's score is below
 * `WEAK_FAN_THRESHOLD`. Reads the threshold from config — no inline literal. An
 * empty fan is not "weak" (there is nothing to soften).
 */
export function isWeakFan(
  candidates: readonly ScoredCandidate[],
  threshold: number = config.show.WEAK_FAN_THRESHOLD,
): boolean {
  if (candidates.length === 0) return false;
  return candidates[0].score < threshold;
}

/**
 * Pure `ShowContext` assembly + a thin predict wrapper (RESEARCH §Pattern 2).
 * The predictor is stateless — the app rebuilds `ShowContext` from persisted
 * Dexie entries on every recenter and re-calls `predict()`. Zero new scoring:
 * this only shapes the frozen core inputs/outputs.
 */
import {
  predict,
  type PredictionCandidate,
  type ShowContext,
  type TransitionMatrix,
} from "@guezzer/core";
import type { TrackedEntry } from "../db/db.ts";

/**
 * Assemble the in-progress show state the predictor conditions on. The trail is
 * the confirmed real songs so far (placeholder `???` entries with a null
 * `songId` are excluded — they carry no transition signal).
 *
 * `recentFinalizedShowSongSets` is the MODL-06 rotation-suppression window. It
 * defaults to `[]`: night 1 is correct with no prior shows (the bundled matrix
 * is as-of 2025-12-13 and contains zero 2026-tour data). Feeding prior finalized
 * tracked shows here later enables cross-night suppression with NO model change
 * (RESEARCH Pattern 2 / Open Q2 — additive, deferred).
 */
export function buildShowContext(
  currentSongId: number,
  entries: readonly TrackedEntry[],
  recentFinalizedShowSongSets: number[][] = [],
): ShowContext {
  return {
    currentSongId,
    trail: entries
      .filter((e) => e.songId != null)
      .map((e) => e.songId as number),
    recentShowSongSets: recentFinalizedShowSongSets,
  };
}

/**
 * Thin wrapper over the frozen `predict()` entrypoint — returns the ranked
 * `PredictionCandidate[]` (already sorted desc by absolute score). Kept as a
 * seam so the OrbitStage never imports `predict` directly.
 */
export function predictFan(
  matrix: TransitionMatrix,
  ctx: ShowContext,
): PredictionCandidate[] {
  return predict(matrix, ctx);
}

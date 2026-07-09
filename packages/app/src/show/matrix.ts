/**
 * Bundled transition-matrix loader (RESEARCH Pitfall 4, §Pattern 2). The matrix
 * is bundle-imported via the `@matrix` Vite alias, so it ships inside the JS
 * bundle and is precached by the existing JS Workbox glob (default
 * globPatterns) — offline complete on first load, NO `json` glob edit needed.
 *
 * A `schemaVersion === 1` guard (T-04-06, ASVS V7) turns an incompatible or
 * corrupt artifact into a HANDLED error sentinel the ShowView renders as the
 * "Couldn't load the prediction model" state — never an unguarded read that
 * bricks the orbit. `buildMatrixIndex` is memoized so it runs exactly once.
 */
import matrixArtifact from "@matrix";
import {
  buildMatrixIndex,
  type MatrixIndex,
  type TransitionMatrix,
} from "@guezzer/core";

/** The only matrix schema this build understands (mirrors core's frozen header). */
const EXPECTED_SCHEMA_VERSION = 1;

/** Handled load outcome — an error sentinel, never a throw at the read site. */
export type MatrixLoadResult =
  | { ok: true; matrix: TransitionMatrix }
  | { ok: false; error: string };

let cachedResult: MatrixLoadResult | null = null;
let cachedIndex: MatrixIndex | null = null;

/**
 * Load + validate the bundled matrix. Guards `schemaVersion === 1`; on any
 * mismatch returns `{ ok: false }` (the ShowView's model-load-failure state).
 * Memoized — the guard runs once.
 */
export function loadMatrix(): MatrixLoadResult {
  if (cachedResult) return cachedResult;

  const matrix = matrixArtifact as TransitionMatrix | null | undefined;
  if (!matrix || matrix.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    cachedResult = {
      ok: false,
      error: `Unsupported prediction-model schemaVersion (expected ${EXPECTED_SCHEMA_VERSION}, got ${matrix?.schemaVersion ?? "none"}).`,
    };
    return cachedResult;
  }

  cachedResult = { ok: true, matrix };
  return cachedResult;
}

/**
 * The successor index, built exactly once (memoized) — a second call returns the
 * SAME reference. Callers MUST check `loadMatrix().ok` first and render the
 * failure state when false; this throws only if invoked past the guard.
 */
export function getMatrixIndex(): MatrixIndex {
  if (cachedIndex) return cachedIndex;

  const result = loadMatrix();
  if (!result.ok) {
    throw new Error(
      "getMatrixIndex() called with an unloadable matrix — check loadMatrix().ok first.",
    );
  }

  cachedIndex = buildMatrixIndex(result.matrix);
  return cachedIndex;
}

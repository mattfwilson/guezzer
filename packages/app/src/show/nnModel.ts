/**
 * "Max's predictor" artifact loading — the app-tier seam over core's
 * `loadNnModel`. The 2.4 MB artifact is DYNAMICALLY imported (`@nnModel`
 * alias → repo-root data/nn/setlist-transformer.json), so Vite splits it
 * into its own lazy JS chunk: the Show tab's first paint never parses it,
 * and the Workbox JS precache glob still ships it offline (the @matrix
 * idiom, one chunk further out).
 *
 * Failure tier: ANY load/validate/decode failure resolves to null and the
 * orbit renders exactly as before this feature existed — the transformer is
 * an overlay on the trusted matrix fan, never a dependency of it.
 */
import { loadNnModel, type NnModel } from "@guezzer/core";

let cached: NnModel | null | undefined;
let pending: Promise<NnModel | null> | null = null;

/** Kick off (or reuse) the one-time artifact load. */
export function ensureNnModel(): Promise<NnModel | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  pending ??= import("@nnModel")
    .then((mod) => {
      cached = loadNnModel(mod.default);
      if (cached === null) console.warn("[nn] artifact failed validation — predictor disabled");
      return cached;
    })
    .catch(() => {
      cached = null;
      console.warn("[nn] artifact failed to load — predictor disabled");
      return null;
    });
  return pending;
}

/** Synchronous read of the loaded model (null = unavailable OR still loading). */
export function getNnModel(): NnModel | null {
  return cached ?? null;
}

/** Test seam — reset the module cache between specs. */
export function resetNnModelForTests(): void {
  cached = undefined;
  pending = null;
}

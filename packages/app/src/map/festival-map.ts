/**
 * Bundled festival-map loader (the @matrix idiom, plan 04 Pattern 2): the
 * calibration artifact rides the JS bundle via the `@festivalMap` alias, is
 * zod-validated through core's strict `festivalMapArtifact` schema, and the
 * georef fit is solved ONCE (memoized) from `controlPoints` — the artifact's
 * `fit` block is tool-side convenience output and deliberately ignored
 * (core re-solve is the single source of truth).
 *
 * Any failure — schema drift, a degenerate/collinear point set — returns a
 * HANDLED error sentinel the MapView renders as the calm load-failure state,
 * never an unguarded throw (T-04-06 discipline).
 */
import artifactRaw from "@festivalMap";
import {
  festivalMapArtifact,
  metersPerPixel,
  solveGeoref,
  type FestivalMapArtifact,
  type GeorefFit,
} from "@guezzer/core";
import mapImageUrl from "./fov-2026.webp";

export type FestivalMapResult =
  | {
      ok: true;
      artifact: FestivalMapArtifact;
      fit: GeorefFit;
      /** Ground scale at image center, meters per image pixel. */
      scaleMPerPx: number;
      /** Hashed bundle URL of the illustrated map image (precached via the webp glob). */
      imageUrl: string;
    }
  | { ok: false; error: string };

let cached: FestivalMapResult | null = null;

export function loadFestivalMap(): FestivalMapResult {
  if (cached) return cached;

  const parsed = festivalMapArtifact.safeParse(artifactRaw);
  if (!parsed.success) {
    cached = { ok: false, error: "Unsupported festival-map artifact schema." };
    return cached;
  }

  const fit = solveGeoref(parsed.data.controlPoints);
  if (!fit) {
    cached = { ok: false, error: "Festival-map control points don't solve (degenerate set)." };
    return cached;
  }

  cached = {
    ok: true,
    artifact: parsed.data,
    fit,
    scaleMPerPx: metersPerPixel(fit, parsed.data.imageWidth, parsed.data.imageHeight),
    imageUrl: mapImageUrl,
  };
  return cached;
}

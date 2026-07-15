/**
 * Bundled album-shelf mapping loader (plan 06-05) — the `@matrix` idiom applied
 * to the D-04 album mapping (studio-discography cards + Covers/Miscellaneous
 * buckets). Bundle-imported via the `@dexAlbums` Vite alias, so it rides the JS
 * bundle and is precached by the existing JS Workbox glob — offline-complete on
 * first load, NO `json` glob edit needed.
 *
 * A `schemaVersion === 1` guard (T-06-12, ASVS V7) turns shape drift into a
 * HANDLED error sentinel — never an unguarded read that bricks the album shelf.
 * Memoized so the guard runs exactly once.
 */
import dexAlbumsArtifact from "@dexAlbums";
import type { DexAlbumsArtifact } from "@guezzer/core";

/** The only album-mapping schema this build understands (mirrors core's frozen header). */
const EXPECTED_SCHEMA_VERSION = 1;

/** Handled load outcome — an error sentinel, never a throw at the read site. */
export type DexAlbumsLoadResult =
  | { ok: true; albums: DexAlbumsArtifact }
  | { ok: false; error: string };

let cachedResult: DexAlbumsLoadResult | null = null;

/**
 * Load + validate the bundled album mapping. Guards `schemaVersion === 1`; on
 * any mismatch returns `{ ok: false }` (the dex's calm error state). Memoized —
 * the guard runs once.
 */
export function loadDexAlbums(): DexAlbumsLoadResult {
  if (cachedResult) return cachedResult;

  const albums = dexAlbumsArtifact as DexAlbumsArtifact | null | undefined;
  if (!albums || albums.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    cachedResult = {
      ok: false,
      error: `Unsupported dex-albums schemaVersion (expected ${EXPECTED_SCHEMA_VERSION}, got ${albums?.schemaVersion ?? "none"}).`,
    };
    return cachedResult;
  }

  cachedResult = { ok: true, albums };
  return cachedResult;
}

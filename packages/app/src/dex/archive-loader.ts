/**
 * Bundled show-archive loader (plan 06-05) — the `@matrix` idiom applied to the
 * compact offline archive (DEX-02 retro-mark + STAT-01 gap/last-played
 * substrate). The artifact is bundle-imported via the `@archive` Vite alias, so
 * it ships inside the JS bundle and is precached by the existing JS Workbox glob
 * — offline-complete on first load, NO `json` glob edit needed.
 *
 * A `schemaVersion === 1` guard (T-06-12, ASVS V7) turns an incompatible or
 * corrupt artifact into a HANDLED error sentinel the dex renders as a calm
 * error state — never an unguarded read that bricks the Pokédex. Memoized so
 * the guard runs exactly once.
 */
import archiveArtifact from "@archive";
import type { ArchiveArtifact } from "@guezzer/core";

/** The only archive schema this build understands (mirrors core's frozen header). */
const EXPECTED_SCHEMA_VERSION = 1;

/** Handled load outcome — an error sentinel, never a throw at the read site. */
export type ArchiveLoadResult =
  | { ok: true; archive: ArchiveArtifact }
  | { ok: false; error: string };

let cachedResult: ArchiveLoadResult | null = null;

/**
 * Load + validate the bundled archive. Guards `schemaVersion === 1`; on any
 * mismatch returns `{ ok: false }` (the dex's calm error state). Memoized — the
 * guard runs once.
 */
export function loadArchive(): ArchiveLoadResult {
  if (cachedResult) return cachedResult;

  const archive = archiveArtifact as ArchiveArtifact | null | undefined;
  if (!archive || archive.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    cachedResult = {
      ok: false,
      error: `Unsupported archive schemaVersion (expected ${EXPECTED_SCHEMA_VERSION}, got ${archive?.schemaVersion ?? "none"}).`,
    };
    return cachedResult;
  }

  cachedResult = { ok: true, archive };
  return cachedResult;
}

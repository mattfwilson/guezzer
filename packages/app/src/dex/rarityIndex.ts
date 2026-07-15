/**
 * Module-memoized corpus rarity index (06-06, STAT-01). The archive is STATIC, so
 * the corpus is rescanned exactly once and the index shared by reference — the
 * WhyDetail panel (and any other non-hook consumer) must NOT rebuild it per
 * render. Mirrors the private cache in useDexStats; a guarded-loader failure
 * degrades to `null` (the caller renders the debut/absent branch), never a throw.
 */
import { buildRarityIndex, type RarityIndex } from "@guezzer/core";
import { loadArchive } from "./archive-loader.ts";

let cached: RarityIndex | null = null;

/** The corpus rarity index, or null when the archive artifact failed its guard. */
export function getRarityIndex(): RarityIndex | null {
  if (cached) return cached;
  const result = loadArchive();
  if (!result.ok) return null;
  cached = buildRarityIndex(result.archive);
  return cached;
}

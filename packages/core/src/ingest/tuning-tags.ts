/**
 * Tuning-family tagging: the DATA-04 owner-editable file (D-01..D-04).
 *
 * The band batches songs by guitar tuning to minimize instrument swaps
 * (PROJECT.md Context). Phase 2's sparse-data backoff tier (MODL-08/09)
 * uses tuning family as a same-family affinity signal — never a top-level
 * multiplier. This module is pure: it never reads/writes files itself
 * (that's cli/generate-tuning-tags.ts's job).
 *
 * D-01: format is JSON, one entry per catalog song, zod-validated on load.
 * D-02: every song gets a best-guess default + a needsReview flag when the
 * album mapping is ambiguous (no match, conflicting multi-album defaults,
 * or a cover). The owner hand-checks only the flagged subset.
 * D-03: the family vocabulary is exactly four values — standard,
 * cs-standard, microtonal, other — enforced by zod, never extended.
 * cs-standard is owner knowledge and is NEVER auto-assigned by this module.
 * D-04: regeneration is an append-only merge — existing entries (including
 * hand-edits) are preserved verbatim; only newly-seen songs are appended.
 */
import { z } from "zod";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";

/** D-03: the closed 4-value vocabulary. Not extensible. */
export const tuningFamilyValues = ["standard", "cs-standard", "microtonal", "other"] as const;
export type TuningFamily = (typeof tuningFamilyValues)[number];

export const tuningTagEntrySchema = z.strictObject({
  songId: z.number().int(),
  name: z.string(),
  family: z.enum(tuningFamilyValues, {
    error: (issue) =>
      `family must be one of ${tuningFamilyValues.join(", ")} (D-03 closed vocabulary) — got ${JSON.stringify(issue.input)}`,
  }),
  needsReview: z.boolean(),
  source: z.enum(["album-default", "hand-tagged"]),
});

export type TuningTagEntry = z.infer<typeof tuningTagEntrySchema>;

/**
 * D-01/D-04: the committed file shape. `entries` rejects duplicate
 * songIds — a hand-edit typo (or a merge bug) must fail loudly rather than
 * silently feed Phase 2 two conflicting rows for the same song.
 */
export const tuningTagsFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(tuningTagEntrySchema).superRefine((entries, ctx) => {
    const seen = new Set<number>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.songId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate songId ${entry.songId} (${entry.name}) in tuning-tags.json entries[${index}] — every song must appear exactly once.`,
          path: [index, "songId"],
        });
      }
      seen.add(entry.songId);
    });
  }),
});

export type TuningTagsFile = z.infer<typeof tuningTagsFileSchema>;

/**
 * One distinct catalog song, derived from the normalized corpus (never the
 * raw songs table — it has no artist_id, see docs/SCHEMA.md / 01-RESEARCH.md
 * Anti-Patterns). `isCover` is true if the song was ever performed as a
 * cover across any occurrence.
 */
export interface CatalogSong {
  songId: number;
  name: string;
  slug: string;
  isCover: boolean;
}

/**
 * Only the album fields this module reads (T-01-13 mitigation): `song_url`
 * (slug join key), `song_name` (fallback name-match key), `album_title`
 * (the family-default lookup key), and `artist_id` (KGLW filter, applied by
 * the caller before this module ever sees a row). `album_notes` (raw HTML)
 * and every other albums.json field are never read here.
 */
export const albumRowSchema = z
  .object({
    artist_id: z.number().int(),
    album_title: z.string(),
    song_url: z.string(),
    song_name: z.string(),
  })
  .loose();

export type AlbumRow = z.infer<typeof albumRowSchema>;

/**
 * Catalog derivation: distinct non-placeholder songs across every show/set/
 * performance in the normalized corpus (NEVER the raw songs table — it has
 * no artist_id). First-seen name/slug wins; isCover is OR'd across every
 * occurrence of the same songId.
 */
export function deriveCatalogFromCorpus(corpus: NormalizedCorpus): CatalogSong[] {
  const bySongId = new Map<number, CatalogSong>();
  for (const show of corpus.shows) {
    for (const set of show.sets) {
      for (const performance of set.performances) {
        if (performance.isPlaceholder) continue;
        const existing = bySongId.get(performance.songId);
        if (existing) {
          if (performance.isCover) existing.isCover = true;
        } else {
          bySongId.set(performance.songId, {
            songId: performance.songId,
            name: performance.songName,
            slug: performance.slug,
            isCover: performance.isCover,
          });
        }
      }
    }
  }
  return [...bySongId.values()].sort((a, b) => a.songId - b.songId);
}

/** Strips the "/song/" prefix kglw.net uses for albums.json's `song_url` field. */
function extractSlugFromSongUrl(songUrl: string): string {
  return songUrl.replace(/^\/song\//, "");
}

/**
 * Album join (01-RESEARCH.md Pattern 4 / DATA-04 row): albums.json has no
 * song_id, so the join key is the slug extracted from `song_url`, falling
 * back to a case-insensitive song-name match when no slug matches (e.g. a
 * live-only song absent from any studio album row but present under a
 * differently-cased name — none observed in practice, kept as a safety net).
 * Returns the distinct album titles matched, in first-encountered order.
 */
function findMatchedAlbumTitles(song: CatalogSong, albumRows: readonly AlbumRow[]): string[] {
  const bySlug = albumRows.filter((row) => extractSlugFromSongUrl(row.song_url) === song.slug);
  const matches =
    bySlug.length > 0
      ? bySlug
      : albumRows.filter((row) => row.song_name.toLowerCase() === song.name.toLowerCase());

  const seen = new Set<string>();
  const albumTitles: string[] = [];
  for (const row of matches) {
    if (!seen.has(row.album_title)) {
      seen.add(row.album_title);
      albumTitles.push(row.album_title);
    }
  }
  return albumTitles;
}

/**
 * Album -> default-family rule (A1 seed, config.microtonalAlbums):
 * microtonal-seed album -> "microtonal"; any other matched album ->
 * "standard". `cs-standard` and `other` are owner knowledge and are NEVER
 * auto-assigned here (D-03) — they only ever enter the file via a
 * hand-edit, which mergeTuningTags preserves verbatim.
 */
function defaultFamilyForAlbum(albumTitle: string): "standard" | "microtonal" {
  return (config.microtonalAlbums as readonly string[]).includes(albumTitle)
    ? "microtonal"
    : "standard";
}

interface ResolvedFamily {
  family: TuningFamily;
  needsReview: boolean;
}

/**
 * D-02 needsReview rule: true when there's no album match, the matched
 * albums carry conflicting family defaults, or the song is a cover
 * (original-artist material — the owner judges the live tuning). On a
 * conflict, the majority default wins (ties broken by first-encountered
 * order) so the file still ships a plausible default alongside the flag.
 */
function resolveFamily(matchedAlbumTitles: readonly string[], isCover: boolean): ResolvedFamily {
  if (matchedAlbumTitles.length === 0) {
    return { family: "standard", needsReview: true };
  }

  const defaults = matchedAlbumTitles.map(defaultFamilyForAlbum);
  const distinctDefaults = [...new Set(defaults)];

  if (distinctDefaults.length === 1) {
    return { family: distinctDefaults[0], needsReview: isCover };
  }

  // Conflicting defaults across matched albums: majority vote, ties broken
  // by first-encountered order (D-02 ambiguity flag).
  const counts = new Map<string, number>();
  for (const value of defaults) counts.set(value, (counts.get(value) ?? 0) + 1);
  let majority = defaults[0];
  let majorityCount = counts.get(majority) ?? 0;
  for (const value of defaults) {
    const count = counts.get(value) ?? 0;
    if (count > majorityCount) {
      majority = value;
      majorityCount = count;
    }
  }
  return { family: majority, needsReview: true };
}

/**
 * Pure generator: catalog + album rows -> one album-derived TuningTagEntry
 * per catalog song. `albumRows` is expected to already be filtered to
 * artist_id === 1 (KGLW) by the caller — see cli/generate-tuning-tags.ts.
 */
export function generateTuningTags(
  catalog: readonly CatalogSong[],
  albumRows: readonly AlbumRow[],
): TuningTagEntry[] {
  return catalog.map((song) => {
    const matchedAlbumTitles = findMatchedAlbumTitles(song, albumRows);
    const { family, needsReview } = resolveFamily(matchedAlbumTitles, song.isCover);
    return {
      songId: song.songId,
      name: song.name,
      family,
      needsReview,
      source: "album-default",
    };
  });
}

export interface MergeTuningTagsResult {
  merged: TuningTagEntry[];
  added: string[];
}

/**
 * D-04 append-only merge: every existing entry (including hand-edits) is
 * kept by reference — never rewritten, never re-derived. Only songIds
 * absent from `existing` are appended, sourced from `generated`. Returns
 * the names of every appended song for the CLI's summary print.
 */
export function mergeTuningTags(
  existing: readonly TuningTagEntry[],
  generated: readonly TuningTagEntry[],
): MergeTuningTagsResult {
  const existingIds = new Set(existing.map((entry) => entry.songId));
  const added: string[] = [];
  const appended: TuningTagEntry[] = [];

  for (const entry of generated) {
    if (!existingIds.has(entry.songId)) {
      appended.push(entry);
      added.push(entry.name);
    }
  }

  return { merged: [...existing, ...appended], added };
}

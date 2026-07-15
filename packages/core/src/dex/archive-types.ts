/**
 * Zod schemas + inferred types for the two Phase-6 build-time artifacts:
 * `archive.json` (the compact offline show archive — DEX-02 retro-mark and
 * STAT-01 gap/last-played substrate) and `dex-albums.json` (the D-04 album
 * shelf mapping — studio-discography cards + Covers/Miscellaneous buckets).
 *
 * Every schema is a `z.strictObject` (mirrors data-safety/export-schema.ts's
 * trust-boundary idiom): an unexpected key hard-fails, so a leaked HTML-bearing
 * field (album_notes — T-06-01) or shape drift (T-06-02) is rejected before an
 * artifact is ever written by the CLIs or read by the app loaders (plan 06-05).
 *
 * The `sets[].n` set-vocabulary enum is pinned to `"1"|"2"|"e"` exactly like
 * db.ts's `SetNumber` and export-schema.ts's `setNumber` — HIST-01's retro
 * setlist views need the same closed set structure across the core/app boundary.
 *
 * Inferred types are the single source of truth (`z.infer`) — the CLIs
 * (build-archive/build-albums) and the later app loaders share them.
 */
import { z } from "zod";

/** One set within an archived show: the set label + its songId list, in-set order preserved (HIST-01). */
export const archiveSetSchema = z.strictObject({
  n: z.enum(["1", "2", "e"]),
  songs: z.array(z.number().int()),
});

/** One archived show keyed by the stable 10-digit `show_id` (mirrors the normalized corpus show shape, sentinels excluded). */
export const archiveShowSchema = z.strictObject({
  id: z.number().int(),
  date: z.string(),
  venue: z.string(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  sets: z.array(archiveSetSchema),
});

/**
 * The compact archive artifact (RESEARCH measured shape, ~141 KB). `songs` is a
 * songId→name map; `latestShowDate` is the online-fallback boundary consumed by
 * the ArchiveBrowser (plan 06-08). `schemaVersion` guards the app loader.
 */
export const archiveArtifact = z.strictObject({
  schemaVersion: z.literal(1),
  latestShowDate: z.string(),
  songs: z.record(z.string(), z.string()),
  shows: z.array(archiveShowSchema),
});

/**
 * One album track. `songId` stays nullable for album tracks absent from
 * songs.json; `inMatrix: false` tracks are the STAT-04 debut candidates by
 * construction (album track with no matrix node — RESEARCH Pitfall 4). Only
 * clean, non-HTML fields are carried (T-06-01): no album_notes ever.
 */
export const albumTrackSchema = z.strictObject({
  songId: z.number().int().nullable(),
  slug: z.string(),
  title: z.string(),
  position: z.number().int(),
  inMatrix: z.boolean(),
});

/** One studio-discography card album (keyed by album_url, never title — Pitfall 3). */
export const dexAlbumSchema = z.strictObject({
  albumUrl: z.string(),
  title: z.string(),
  releaseDate: z.string(),
  tracks: z.array(albumTrackSchema),
});

/**
 * The album-shelf mapping artifact (D-04): studio-discography card albums plus
 * the two catch-all buckets. Covers = other-artist songs (isoriginal 0);
 * Miscellaneous = originals on no card album (live-only/unreleased).
 */
export const dexAlbumsArtifact = z.strictObject({
  schemaVersion: z.literal(1),
  albums: z.array(dexAlbumSchema),
  buckets: z.strictObject({
    covers: z.array(albumTrackSchema),
    miscellaneous: z.array(albumTrackSchema),
  }),
});

export type ArchiveSet = z.infer<typeof archiveSetSchema>;
export type ArchiveShow = z.infer<typeof archiveShowSchema>;
export type ArchiveArtifact = z.infer<typeof archiveArtifact>;
export type AlbumTrack = z.infer<typeof albumTrackSchema>;
export type DexAlbum = z.infer<typeof dexAlbumSchema>;
export type DexAlbumsArtifact = z.infer<typeof dexAlbumsArtifact>;

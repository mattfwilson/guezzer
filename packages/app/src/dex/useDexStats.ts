/**
 * The reactive dex-stats hook (plan 06-05, DEX-03) — the single surface every
 * Pokédex view reads its numbers from. Dexie is the SOLE source of truth: the
 * three attendance tables are read via `useLiveQuery`, and every count is a pure
 * `useMemo(deriveDex)` derivation over them. There is NO stored count and NO
 * `useState` mirror of table data — a mark/unmark write-through anywhere re-runs
 * the live query, which re-derives the whole dex (D-12 "unmark is free"). This
 * mirrors show/useShowSession.ts's liveQuery-plus-derive idiom exactly.
 *
 * The bundled archive + album mapping are loaded through the guarded loaders, so
 * a schemaVersion drift surfaces as a calm `{ ready: false, error }` shape
 * (T-06-12) rather than a throw. `buildRarityIndex` is module-memoized — the
 * archive is static, so rarity is computed exactly once and shared.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  buildRarityIndex,
  deriveDex,
  type ArchiveArtifact,
  type DexAlbumsArtifact,
  type DexStats,
  type RarityIndex,
} from "@guezzer/core";
import { db } from "../db/db.ts";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { loadArchive } from "./archive-loader.ts";
import { loadDexAlbums } from "./dex-albums-loader.ts";

/** Everything a dex surface renders off — all derived, plus a loading-safe shape. */
export interface DexStatsResult {
  /** True once all three live reads have resolved AND both artifacts loaded. */
  ready: boolean;
  /** A calm loader-sentinel message when an artifact failed its guard, else null. */
  error: string | null;
  /** The live dex derivation (zero counts pre-load / on empty tables), null on loader failure. */
  dex: DexStats | null;
  /** Corpus-honest rarity index (static — computed once), null on loader failure. */
  rarity: RarityIndex | null;
  /** The bundled show archive, null on loader failure. */
  archive: ArchiveArtifact | null;
  /** The bundled album-shelf mapping, null on loader failure. */
  albums: DexAlbumsArtifact | null;
}

// Rarity is a pure function of the STATIC archive — compute exactly once at
// module level and share the reference across every hook consumer (Pitfall:
// re-deriving per render would rescan the whole corpus each keystroke).
let cachedRarity: RarityIndex | null = null;
function getRarityIndex(archive: ArchiveArtifact): RarityIndex {
  if (!cachedRarity) cachedRarity = buildRarityIndex(archive);
  return cachedRarity;
}

export function useDexStats(): DexStatsResult {
  // Scope every namespaced-table read to the current identity (AUTH-05 / D-09):
  // a borrowed phone shows only the signed-in identity's dex numbers. This is THE
  // reference scoping the four Plan-07 view consumers mirror — the idiom is kept
  // identical. When no identity is present (the transient null during teardown,
  // or a pre-identity test path) fall back to the unscoped read so the
  // loading-safe shape is unchanged — the AuthGate (Plan 06) guarantees an
  // identity whenever the app (and thus this hook) renders, so the fallback only
  // affects that momentary null window.
  const currentUserId = useAuthIdentity()?.userId;

  // (a) The attendance tables + the online-fallback setlist cache — reactive.
  // A mark/unmark (incl. a fallback mark writing archiveShows) re-runs these.
  const attendedShows = useLiveQuery(
    () =>
      currentUserId == null
        ? db.attendedShows.toArray()
        : db.attendedShows.where("userId").equals(currentUserId).toArray(),
    [currentUserId],
  );
  const trackedShows = useLiveQuery(
    () =>
      currentUserId == null
        ? db.trackedShows.toArray()
        : db.trackedShows.where("userId").equals(currentUserId).toArray(),
    [currentUserId],
  );
  const trackedEntries = useLiveQuery(
    () =>
      currentUserId == null
        ? db.trackedEntries.toArray()
        : db.trackedEntries.where("userId").equals(currentUserId).toArray(),
    [currentUserId],
  );
  const archiveShows = useLiveQuery(
    () =>
      currentUserId == null
        ? db.archiveShows.toArray()
        : db.archiveShows.where("userId").equals(currentUserId).toArray(),
    [currentUserId],
  );

  // (b) The bundled artifacts, guarded + memoized (same reference every render).
  const archiveResult = loadArchive();
  const albumsResult = loadDexAlbums();

  // (c) The derived dex — never hand-synced; recomputed only when a table changes.
  return useMemo((): DexStatsResult => {
    // Guarded loaders return a sentinel, never throw — surface a calm error.
    // Split (not `||`) so each branch narrows the discriminated union cleanly.
    if (!archiveResult.ok) {
      return { ready: false, error: archiveResult.error, dex: null, rarity: null, archive: null, albums: null };
    }
    if (!albumsResult.ok) {
      return { ready: false, error: albumsResult.error, dex: null, rarity: null, archive: null, albums: null };
    }

    const { archive } = archiveResult;
    const { albums } = albumsResult;
    const rarity = getRarityIndex(archive);

    // `useLiveQuery` is `undefined` until its first async read resolves. Derive
    // over empty tables (zero counts, no NaN) and flag not-ready so a consumer
    // can show a loading shell; a resolved `[]` flips `ready` true.
    const ready =
      attendedShows !== undefined &&
      trackedShows !== undefined &&
      trackedEntries !== undefined &&
      archiveShows !== undefined;

    const dex = deriveDex(
      {
        attendedShows: attendedShows ?? [],
        trackedShows: trackedShows ?? [],
        trackedEntries: trackedEntries ?? [],
        // The online-fallback setlist cache (plan 06-08) — the ONLY setlist
        // source for post-corpus retro marks (absent from the bundled archive).
        archiveShows: archiveShows ?? [],
      },
      archive,
      albums,
      rarity,
    );

    return { ready, error: null, dex, rarity, archive, albums };
  }, [attendedShows, trackedShows, trackedEntries, archiveShows, archiveResult, albumsResult]);
}

/**
 * Shared synthetic fixtures for the Phase-6 dex derivation suite (rarity /
 * derive-dex / recap). Override-spread factory idiom copied from
 * test/merge.test.ts (lines 8-50): every factory takes a `Partial<...>`
 * override so a test states only the fields it cares about.
 *
 * The tracked/attended/snapshot input shapes here are declared locally (not
 * imported from derive-dex.ts) so this file compiles standalone for the
 * rarity suite; `deriveDex`'s `DexSnapshotInput` is a STRUCTURAL match, so a
 * `dexSnapshot(...)` value is assignable to it without a nominal dependency.
 */
import type {
  AlbumTrack,
  ArchiveArtifact,
  ArchiveShow,
  DexAlbumsArtifact,
} from "../../../src/dex/archive-types.ts";

/** Sentinel song ids excluded from the archive song map by construction (config.sentinelSongIds). */
const SENTINEL_IDS = new Set<number>([1]);

// ── Archive fixtures ──────────────────────────────────────────────────────

/** One archived show. Defaults are inert — only the fields a test asserts matter. */
export function archiveShow(over: Partial<ArchiveShow> = {}): ArchiveShow {
  return {
    id: 100,
    date: "2020-01-01",
    venue: "The Venue",
    city: "Melbourne",
    state: "VIC",
    country: "Australia",
    sets: [{ n: "1", songs: [] }],
    ...over,
  };
}

/**
 * Wrap a list of shows into the compact archive artifact. The `songs`
 * songId→name map is derived from the shows' song ids (sentinels skipped) unless
 * overridden — deriveDex reads its completion catalog from these keys.
 */
export function syntheticArchive(
  shows: ArchiveShow[],
  over: Partial<Omit<ArchiveArtifact, "shows">> = {},
): ArchiveArtifact {
  const songs: Record<string, string> = {};
  for (const show of shows) {
    for (const set of show.sets) {
      for (const songId of set.songs) {
        if (SENTINEL_IDS.has(songId)) continue;
        songs[String(songId)] ??= `Song ${songId}`;
      }
    }
  }
  const dates = shows.map((s) => s.date).sort();
  return {
    schemaVersion: 1,
    latestShowDate: dates.at(-1) ?? "2020-01-01",
    songs,
    shows,
    ...over,
  };
}

// ── Album fixtures ────────────────────────────────────────────────────────

/** One album track (STAT-04: `inMatrix: false` is a debut candidate). */
export function albumTrack(over: Partial<AlbumTrack> = {}): AlbumTrack {
  return {
    songId: 10,
    slug: "song-10",
    title: "Song 10",
    position: 1,
    inMatrix: true,
    ...over,
  };
}

/**
 * A small album-shelf artifact: one card album with two in-matrix tracks + one
 * debut candidate, empty buckets. Enough to pin per-album tally + STAT-04
 * denominator-exclusion behavior.
 */
export function syntheticAlbums(over: Partial<DexAlbumsArtifact> = {}): DexAlbumsArtifact {
  return {
    schemaVersion: 1,
    albums: [
      {
        albumUrl: "/albums/alpha",
        title: "Alpha",
        releaseDate: "2015-01-01",
        tracks: [
          albumTrack({ songId: 10, slug: "song-10", title: "Song 10", position: 1, inMatrix: true }),
          albumTrack({ songId: 20, slug: "song-20", title: "Song 20", position: 2, inMatrix: true }),
          albumTrack({ songId: null, slug: "debut-track", title: "Debut Track", position: 3, inMatrix: false }),
        ],
      },
    ],
    buckets: { covers: [], miscellaneous: [] },
    ...over,
  };
}

// ── Snapshot input fixtures (structural match for DexSnapshotInput) ─────────

/** A tracked-show row — the DexSnapshotInput trackedShows shape. */
export interface FixtureTrackedShow {
  sessionId: string;
  date: string;
  status: string;
  showId: number | null;
}

/** A tracked-entry row — richer than the Task-2 minimum so recap can read source/songName. */
export interface FixtureTrackedEntry {
  sessionId: string;
  songId: number | null;
  songName: string;
  setNumber: string;
  outcome: string;
  source: string;
  isPlaceholder: boolean;
  position: number;
}

/** A retro-marked attendance row keyed by the stable show_id. */
export interface FixtureAttendedShow {
  show_id: number;
  showDate: string;
}

/** An online-fallback archive cache row (DB archiveShows table shape). */
export interface FixtureArchiveCacheShow {
  show_id: number;
  date: string;
  sets: Array<{ n: string; songs: Array<{ songId: number; songName: string }> }>;
}

/** The full derivation snapshot input (structural match for DexSnapshotInput). */
export interface FixtureSnapshot {
  attendedShows: FixtureAttendedShow[];
  trackedShows: FixtureTrackedShow[];
  trackedEntries: FixtureTrackedEntry[];
  archiveShows?: FixtureArchiveCacheShow[];
}

export function trackedShow(over: Partial<FixtureTrackedShow> = {}): FixtureTrackedShow {
  return {
    sessionId: "sess",
    date: "2020-06-01",
    status: "finalized",
    showId: null,
    ...over,
  };
}

export function trackedEntry(over: Partial<FixtureTrackedEntry> = {}): FixtureTrackedEntry {
  return {
    sessionId: "sess",
    songId: 10,
    songName: "Song 10",
    setNumber: "1",
    outcome: "hit",
    source: "manual",
    isPlaceholder: false,
    position: 1,
    ...over,
  };
}

export function attendedShow(over: Partial<FixtureAttendedShow> = {}): FixtureAttendedShow {
  return {
    show_id: 100,
    showDate: "2020-01-01",
    ...over,
  };
}

export function dexSnapshot(over: Partial<FixtureSnapshot> = {}): FixtureSnapshot {
  return {
    attendedShows: [],
    trackedShows: [],
    trackedEntries: [],
    ...over,
  };
}

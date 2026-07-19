/**
 * DEX-03/DEX-04, STAT-03/STAT-04, D-05/D-11/D-12: the SINGLE derivation entry
 * point the whole Pokédex renders from. Every count — completion %, per-song
 * sightings, personal gap, rarest catch, never-seen list, per-album tallies —
 * is derived purely from raw attendance (retro marks + tracked shows) joined to
 * the corpus archive. Nothing is ever stored or hand-tallied, so unmark is free
 * (D-12) and a friend's parsed snapshot gets full stats (plan 06-10).
 *
 * Zero I/O, no Dexie types imported. Mirrors model/matrix.ts's pure-module
 * shape; reuses data-safety/merge.ts's attendance-group-key idiom for the
 * tracked∪retro dedupe (bound → by show_id, unbound → by date).
 */
import { config } from "../config.ts";
import { attendanceKey } from "../data-safety/attendance-key.ts";
import type { ArchiveArtifact } from "./archive-types.ts";
import type { RarityIndex, RarityTier } from "./rarity.ts";

/**
 * The derivation input — a STRUCTURAL subset of the v2 ExportSnapshot (so plan
 * 06-10 can feed a friend's parsed envelope, and it stays assignable from
 * ExportSnapshot). `archiveShows` is optional: the online-fallback setlist cache
 * is the only setlist source for post-corpus marks (Pitfall 5), absent for v1
 * files and before plan 06-07 lands.
 */
export interface DexSnapshotInput {
  attendedShows: Array<{ show_id: number; showDate: string }>;
  trackedShows: Array<{ sessionId: string; date: string; status: string; showId: number | null }>;
  trackedEntries: Array<{
    sessionId: string;
    songId: number | null;
    songName: string;
    setNumber: string;
    outcome: string;
    source: string;
    isPlaceholder: boolean;
    position: number;
  }>;
  archiveShows?: Array<{
    show_id: number;
    date: string;
    sets: Array<{ n: string; songs: Array<{ songId: number; songName: string }> }>;
  }>;
}

export interface SongDexStats {
  songId: number;
  sightings: number;
  lastSeenDate: string | null;
  personalGap: number | null;
  tier: RarityTier | null;
}

export interface DexStats {
  completion: { caught: number; total: number; pct: number };
  perSong: Map<number, SongDexStats>;
  neverSeen: number[];
  rarestCatch: { songId: number; tier: RarityTier } | null;
  showCount: number;
  perAlbum: Map<string, { caught: number; total: number }>;
}

/** Album-shelf mapping shape (structural subset of DexAlbumsArtifact — cards + buckets). */
interface AlbumsInput {
  albums: Array<{ albumUrl: string; tracks: Array<{ songId: number | null; inMatrix: boolean }> }>;
  buckets: {
    covers: Array<{ songId: number | null; inMatrix: boolean }>;
    miscellaneous: Array<{ songId: number | null; inMatrix: boolean }>;
  };
}

interface AttendanceGroup {
  date: string;
  showIds: Set<number>;
  sessionIds: Set<string>;
}

/**
 * `deriveDex(snapshot, archive, albums, rarity, cfg) -> DexStats`. Steps:
 * (1) resolve attendance groups by the attendance-group-key rule; (2) resolve
 * each group's sightings = archive/cache setlist ∪ tracked non-placeholder
 * entries; (3) walk the date-ordered timeline accumulating sightings/lastSeen;
 * (4) compute personalGap from the deduped timeline; (5) catalog = archive song
 * keys minus sentinels → completion, neverSeen, rarestCatch; (6) per-album
 * tallies over inMatrix tracks only (debut candidates uncounted, STAT-04).
 */
export function deriveDex(
  snapshot: DexSnapshotInput,
  archive: ArchiveArtifact,
  albums: AlbumsInput,
  rarity: RarityIndex,
  cfg: typeof config = config,
): DexStats {
  const sentinelIds = new Set<number>(cfg.sentinelSongIds as readonly number[]);

  // ── Archive/cache setlist lookup by show_id ──
  const setlistByShowId = new Map<number, number[]>();
  for (const show of archive.shows) {
    const songIds: number[] = [];
    for (const set of show.sets) for (const songId of set.songs) songIds.push(songId);
    setlistByShowId.set(show.id, songIds);
  }
  // Cache rows fill in post-corpus shows absent from the bundled archive (Pitfall 5).
  for (const cached of snapshot.archiveShows ?? []) {
    if (setlistByShowId.has(cached.show_id)) continue;
    const songIds: number[] = [];
    for (const set of cached.sets) for (const s of set.songs) songIds.push(s.songId);
    setlistByShowId.set(cached.show_id, songIds);
  }

  // ── Tracked entries grouped by session (non-placeholder, real songId) ──
  const trackedSightingsBySession = new Map<string, number[]>();
  for (const entry of snapshot.trackedEntries) {
    if (entry.isPlaceholder || entry.songId == null) continue;
    let list = trackedSightingsBySession.get(entry.sessionId);
    if (!list) {
      list = [];
      trackedSightingsBySession.set(entry.sessionId, list);
    }
    list.push(entry.songId);
  }

  // ── Step 1: resolve attendance groups (tracked∪retro dedupe) ──
  const groups = new Map<string, AttendanceGroup>();
  const ensureGroup = (key: string, date: string): AttendanceGroup => {
    let group = groups.get(key);
    if (!group) {
      group = { date, showIds: new Set(), sessionIds: new Set() };
      groups.set(key, group);
    }
    return group;
  };
  for (const attended of snapshot.attendedShows) {
    // Retro marks are always bound → showId non-null, so sessionId is ignored.
    const group = ensureGroup(attendanceKey(attended.show_id, attended.showDate, ""), attended.showDate);
    group.showIds.add(attended.show_id);
  }
  for (const tracked of snapshot.trackedShows) {
    const group = ensureGroup(attendanceKey(tracked.showId, tracked.date, tracked.sessionId), tracked.date);
    if (tracked.showId != null) group.showIds.add(tracked.showId);
    group.sessionIds.add(tracked.sessionId);
  }

  // ── Step 2: per-group sightings = setlist(s) ∪ tracked entries, sentinel-free ──
  interface TimelineNight {
    date: string;
    songIds: Set<number>;
  }
  const timeline: TimelineNight[] = [];
  const groupKeysSorted = [...groups.entries()].sort((a, b) =>
    a[1].date < b[1].date ? -1 : a[1].date > b[1].date ? 1 : a[0] < b[0] ? -1 : 1,
  );
  for (const [, group] of groupKeysSorted) {
    const songIds = new Set<number>();
    for (const showId of group.showIds) {
      for (const songId of setlistByShowId.get(showId) ?? []) {
        if (!sentinelIds.has(songId)) songIds.add(songId);
      }
    }
    for (const sessionId of group.sessionIds) {
      for (const songId of trackedSightingsBySession.get(sessionId) ?? []) {
        if (!sentinelIds.has(songId)) songIds.add(songId);
      }
    }
    timeline.push({ date: group.date, songIds });
  }

  // ── Step 3+4: accumulate per-song sightings/lastSeen + personalGap ──
  const showCount = timeline.length;
  interface SongAcc {
    sightings: number;
    lastSeenDate: string;
    lastSeenIndex: number;
  }
  const acc = new Map<number, SongAcc>();
  timeline.forEach((night, index) => {
    for (const songId of night.songIds) {
      let entry = acc.get(songId);
      if (!entry) {
        entry = { sightings: 0, lastSeenDate: night.date, lastSeenIndex: index };
        acc.set(songId, entry);
      }
      entry.sightings += 1;
      entry.lastSeenIndex = index; // ascending timeline → newest wins
      entry.lastSeenDate = night.date;
    }
  });

  // ── Step 5: catalog (archive song keys minus sentinels) drives completion ──
  const catalog: number[] = [];
  for (const key of Object.keys(archive.songs)) {
    const songId = Number(key);
    if (!sentinelIds.has(songId)) catalog.push(songId);
  }
  catalog.sort((a, b) => a - b);
  const catalogSet = new Set(catalog);

  const perSong = new Map<number, SongDexStats>();
  for (const [songId, entry] of acc) {
    perSong.set(songId, {
      songId,
      sightings: entry.sightings,
      lastSeenDate: entry.lastSeenDate,
      personalGap: showCount - 1 - entry.lastSeenIndex,
      tier: rarity.get(songId)?.tier ?? null,
    });
  }

  const caughtIds = catalog.filter((songId) => acc.has(songId));
  const caught = caughtIds.length;
  const total = catalog.length;
  const completion = {
    caught,
    total,
    pct: total ? Math.round((100 * caught) / total) : 0,
  };
  const neverSeen = catalog.filter((songId) => !acc.has(songId));

  // rarestCatch: caught song with the lowest corpus play rate (via rarity index).
  let rarestCatch: DexStats["rarestCatch"] = null;
  let rarestPlayCount = Infinity;
  for (const songId of caughtIds) {
    const info = rarity.get(songId);
    if (!info) continue;
    if (info.playCount < rarestPlayCount || (info.playCount === rarestPlayCount && (rarestCatch == null || songId < rarestCatch.songId))) {
      rarestPlayCount = info.playCount;
      rarestCatch = { songId, tier: info.tier };
    }
  }

  // ── Step 6: per-album tallies (inMatrix tracks only; debut candidates uncounted) ──
  const perAlbum = new Map<string, { caught: number; total: number }>();
  const tallyTracks = (tracks: Array<{ songId: number | null; inMatrix: boolean }>) => {
    let albumCaught = 0;
    let albumTotal = 0;
    for (const track of tracks) {
      if (!track.inMatrix || track.songId == null) continue; // STAT-04: debut candidate uncounted
      if (!catalogSet.has(track.songId)) continue;
      albumTotal += 1;
      if (acc.has(track.songId)) albumCaught += 1;
    }
    return { caught: albumCaught, total: albumTotal };
  };
  for (const album of albums.albums) perAlbum.set(album.albumUrl, tallyTracks(album.tracks));
  perAlbum.set("covers", tallyTracks(albums.buckets.covers));
  perAlbum.set("miscellaneous", tallyTracks(albums.buckets.miscellaneous));

  return { completion, perSong, neverSeen, rarestCatch, showCount, perAlbum };
}

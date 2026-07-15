/**
 * SHOW-14 / STAT-02 / D-14: the night's scorecard. Every number is a pure
 * derivation over the session's trackedEntries + the archive — the payoff
 * screen (plan 06-09) only renders `RecapStats`, storing nothing.
 *
 * New-catch detection reuses `deriveDex`: run it on a snapshot copy that
 * EXCLUDES this session, then flag session songs with zero prior sightings —
 * a pure set difference, no stored "before" state. The tally mirrors Show
 * Mode's `deriveTally` exactly (every entry counts; hits = outcome "hit"), so
 * the recap tally can never disagree with the live tally.
 */
import { config } from "../config.ts";
import type { ArchiveArtifact } from "./archive-types.ts";
import { deriveDex, type DexSnapshotInput } from "./derive-dex.ts";
import { showRarityScore, type RarityIndex, type RarityTier } from "./rarity.ts";

/** One setlist row for the recap set structure (SHOW-14). */
export interface RecapSetlistRow {
  songId: number | null;
  songName: string;
  outcome: string;
  isPlaceholder: boolean;
  tier: RarityTier | null;
}

/** One set (or encore) of the night, rows in position order. */
export interface RecapSet {
  n: string;
  rows: RecapSetlistRow[];
}

export interface RecapStats {
  sessionId: string;
  /** Hit tally with deriveTally semantics — every entry counts, `pct` null in zero-state. */
  tally: { hits: number; total: number; pct: number | null };
  /** Manual-vs-editor decomposition from the Phase-5 source tags (D-03). */
  sourceSplit: { manualHits: number; manualTotal: number; editorHits: number };
  /** Songs caught for the first time ever this night (+N new). */
  newCatches: { count: number; songIds: number[] };
  /** Show rarity score (avg corpus gap) + the rarest song of the night. */
  rarity: { score: number; rarestOfNight: { songId: number; tier: RarityTier } | null };
  /** The set-structured setlist ("1","2","e") in position order. */
  setlist: RecapSet[];
}

/** Canonical set display order (SetNumber vocabulary). */
const SET_ORDER = ["1", "2", "e"];

/** Albums shape needed only to pass through to deriveDex for new-catch detection. */
type AlbumsInput = Parameters<typeof deriveDex>[2];

/**
 * `deriveRecap(sessionId, snapshot, archive, albums, rarity, cfg) -> RecapStats`.
 * Placeholder ("???") entries stay in the setlist rows flagged `isPlaceholder`
 * but are excluded from rarity + new-catch math (they carry no songId).
 */
export function deriveRecap(
  sessionId: string,
  snapshot: DexSnapshotInput,
  archive: ArchiveArtifact,
  albums: AlbumsInput,
  rarity: RarityIndex,
  cfg: typeof config = config,
): RecapStats {
  const sentinelIds = new Set<number>(cfg.sentinelSongIds as readonly number[]);

  // Session entries in position order.
  const entries = snapshot.trackedEntries
    .filter((e) => e.sessionId === sessionId)
    .sort((a, b) => a.position - b.position);

  // ── tally (deriveTally parity: every entry counts) ──
  const total = entries.length;
  const hits = entries.filter((e) => e.outcome === "hit").length;
  const tally = { hits, total, pct: total ? Math.round((100 * hits) / total) : null };

  // ── sourceSplit ──
  let manualHits = 0;
  let manualTotal = 0;
  let editorHits = 0;
  for (const e of entries) {
    if (e.source === "manual") {
      manualTotal += 1;
      if (e.outcome === "hit") manualHits += 1;
    } else if (e.source === "editor") {
      if (e.outcome === "hit") editorHits += 1;
    }
  }
  const sourceSplit = { manualHits, manualTotal, editorHits };

  // ── the night's real (non-placeholder, non-sentinel) songs ──
  const nightSongIds: number[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    if (e.isPlaceholder || e.songId == null || sentinelIds.has(e.songId)) continue;
    if (seen.has(e.songId)) continue;
    seen.add(e.songId);
    nightSongIds.push(e.songId);
  }

  // ── newCatches: run deriveDex on a snapshot EXCLUDING this session, then flag
  //    night songs with zero prior sightings (pure set difference). ──
  const reduced: DexSnapshotInput = {
    attendedShows: snapshot.attendedShows,
    trackedShows: snapshot.trackedShows.filter((s) => s.sessionId !== sessionId),
    trackedEntries: snapshot.trackedEntries.filter((e) => e.sessionId !== sessionId),
    archiveShows: snapshot.archiveShows,
  };
  const priorStats = deriveDex(reduced, archive, albums, rarity, cfg);
  const newSongIds = nightSongIds.filter((songId) => !priorStats.perSong.has(songId));
  const newCatches = { count: newSongIds.length, songIds: newSongIds };

  // ── rarity: show score + rarest-of-night (lowest corpus play rate) ──
  const score = showRarityScore(nightSongIds, rarity);
  let rarestOfNight: RecapStats["rarity"]["rarestOfNight"] = null;
  let rarestPlayCount = Infinity;
  for (const songId of nightSongIds) {
    const info = rarity.get(songId);
    if (!info) continue;
    if (info.playCount < rarestPlayCount) {
      rarestPlayCount = info.playCount;
      rarestOfNight = { songId, tier: info.tier };
    }
  }

  // ── setlist grouped by set in position order ──
  const bySet = new Map<string, RecapSetlistRow[]>();
  for (const e of entries) {
    const row: RecapSetlistRow = {
      songId: e.songId,
      songName: e.songName,
      outcome: e.outcome,
      isPlaceholder: e.isPlaceholder,
      tier: e.songId != null ? (rarity.get(e.songId)?.tier ?? null) : null,
    };
    let rows = bySet.get(e.setNumber);
    if (!rows) {
      rows = [];
      bySet.set(e.setNumber, rows);
    }
    rows.push(row);
  }
  // Canonical order first, then any unexpected set labels appended stably.
  const setNumbers = [
    ...SET_ORDER.filter((n) => bySet.has(n)),
    ...[...bySet.keys()].filter((n) => !SET_ORDER.includes(n)),
  ];
  const setlist: RecapSet[] = setNumbers.map((n) => ({ n, rows: bySet.get(n) ?? [] }));

  return { sessionId, tally, sourceSplit, newCatches, rarity: { score, rarestOfNight }, setlist };
}

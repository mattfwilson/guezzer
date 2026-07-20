/**
 * D-25 / RESEARCH Pattern 4: resolve the four already-shipped build-time
 * artifacts (transition matrix, archive, rarity index, dex-albums) into the
 * fast in-memory lookup Maps the bingo marking fold (Plan 03), generator (Plan
 * 04), and calibration CLI (Plan 05) all consume. ZERO new pipeline — every
 * value here already exists in a shipped artifact; this module only re-shapes
 * them for O(1) predicate lookups.
 *
 * Pure core, mirrors `dex/rarity.ts`'s discipline: one exported fn, config
 * injected with a default, Map-keyed single-pass accumulation, zero I/O, no
 * wall-clock or entropy reads. The artifact input shapes are declared
 * structurally-local (minimal readonly subsets) so this module never imports a
 * nominal artifact type nor any app row type (D-22 core purity).
 *
 * T-14-03 mitigation: every emitted Map is accumulated in a stable-key sorted
 * order (songId ascending, albumUrl lexicographic) so downstream context +
 * calibration output is byte-reproducible (Pitfall 4).
 */
import { config } from "../config.ts";

/** Minimal structural subset of a `MatrixNode` this builder reads (domain/types.ts:113). */
interface BingoMatrixNodeInput {
  readonly songId: number;
  readonly eraPlayCount: number;
  readonly tuningFamily: string;
}

/** Minimal structural subset of the `TransitionMatrix` this builder reads. */
interface BingoMatrixInput {
  readonly nodes: readonly BingoMatrixNodeInput[];
}

/** Minimal structural subset of the shipped archive artifact — reserved for quartet parity (see `buildBingoContext`). */
interface BingoArchiveInput {
  readonly shows: readonly unknown[];
}

/** Minimal structural subset of a `SongRarity` entry this builder reads (dex/rarity.ts:20). */
interface BingoRarityEntryInput {
  readonly corpusGap: number;
}

/** The `RarityIndex` shape (dex/rarity.ts:31) as a readonly structural subset. */
type BingoRarityInput = ReadonlyMap<number, BingoRarityEntryInput>;

/** Minimal structural subset of a dex-album track (dex/archive-types.ts:56). */
interface BingoAlbumTrackInput {
  readonly songId: number | null;
}

/** Minimal structural subset of a dex-album (dex/archive-types.ts:65). */
interface BingoAlbumInput {
  readonly albumUrl: string;
  readonly tracks: readonly BingoAlbumTrackInput[];
}

/** Minimal structural subset of the `DexAlbumsArtifact` this builder reads (dex/archive-types.ts:77). */
interface BingoAlbumsInput {
  readonly albums: readonly BingoAlbumInput[];
}

/**
 * The resolved bingo lookup bundle. Every field is a fast membership/value
 * lookup the fold + generator read without re-scanning an artifact:
 * - `microtonalSongIds` — songs whose matrix node is `tuningFamily: "microtonal"`.
 * - `corpusGap` — songId → shows-since-last-play (mirrors `SongRarity.corpusGap`).
 * - `albumSongIds` — album_url → the Set of its member song ids.
 * - `jamVehicleSongIds` — the owner's marathon-jam roster (empty pre-Plan-06).
 * - `eraPlayRate` — songId → `MatrixNode.eraPlayCount` (current-era base rate, D-25).
 */
export interface BingoContext {
  readonly microtonalSongIds: ReadonlySet<number>;
  readonly corpusGap: ReadonlyMap<number, number>;
  readonly albumSongIds: ReadonlyMap<string, ReadonlySet<number>>;
  readonly jamVehicleSongIds: ReadonlySet<number>;
  readonly eraPlayRate: ReadonlyMap<number, number>;
}

/**
 * `buildBingoContext(matrix, archive, rarity, albums, cfg) -> BingoContext`.
 * Resolves the five lookups from the shipped artifacts in a single stable pass
 * each. `archive` is accepted for parity with the shipped-artifact quartet the
 * calibration CLI (Plan 05) loads together; `corpusGap` is taken from the
 * already-resolved `rarity` index rather than re-scanning the archive, so the
 * builder does exactly one derivation per lookup and no I/O.
 *
 * All emitted Maps/Sets are accumulated in ascending-key order (songId, then
 * albumUrl) for byte-reproducible downstream output (T-14-03 / Pitfall 4).
 * An empty `cfg.bingo.jamVehicleSongIds` roster (the pre-Plan-06 default)
 * yields an empty `jamVehicleSongIds` Set — never a crash (T-14-04).
 */
export function buildBingoContext(
  matrix: BingoMatrixInput,
  archive: BingoArchiveInput,
  rarity: BingoRarityInput,
  albums: BingoAlbumsInput,
  cfg: typeof config = config,
): BingoContext {
  void archive; // reserved for shipped-artifact-quartet parity; corpusGap comes from `rarity`.

  // microtonalSongIds + eraPlayRate: one stable pass over matrix nodes (songId asc).
  const sortedNodes = [...matrix.nodes].sort((a, b) => a.songId - b.songId);
  const microtonalSongIds = new Set<number>();
  const eraPlayRate = new Map<number, number>();
  for (const node of sortedNodes) {
    if (node.tuningFamily === "microtonal") microtonalSongIds.add(node.songId);
    eraPlayRate.set(node.songId, node.eraPlayCount);
  }

  // corpusGap: mirror the resolved RarityIndex, emitted songId-ascending.
  const corpusGap = new Map<number, number>();
  const rarityEntries = [...rarity.entries()].sort((a, b) => a[0] - b[0]);
  for (const [songId, entry] of rarityEntries) {
    corpusGap.set(songId, entry.corpusGap);
  }

  // albumSongIds: album_url -> Set<songId>, albums lexicographic, non-null ids only.
  const albumSongIds = new Map<string, ReadonlySet<number>>();
  const sortedAlbums = [...albums.albums].sort((a, b) =>
    a.albumUrl < b.albumUrl ? -1 : a.albumUrl > b.albumUrl ? 1 : 0,
  );
  for (const album of sortedAlbums) {
    const memberIds = new Set<number>();
    for (const track of album.tracks) {
      if (track.songId != null) memberIds.add(track.songId);
    }
    albumSongIds.set(album.albumUrl, memberIds);
  }

  // jamVehicleSongIds: the owner roster (empty pre-Plan-06 → empty Set, T-14-04).
  const jamVehicleSongIds = new Set<number>(cfg.bingo.jamVehicleSongIds);

  return {
    microtonalSongIds,
    corpusGap,
    albumSongIds,
    jamVehicleSongIds,
    eraPlayRate,
  };
}

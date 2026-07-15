/**
 * D-04 pure derivation of the album-shelf mapping artifact (`dex-albums.json`)
 * from the dirty raw albums.json + songs.json + the frozen transition matrix.
 * Zero I/O — mirrors model/matrix.ts's "pure module, one top-level fn,
 * Map-keyed accumulation, explicit sort comparators, config injected with a
 * default" shape. The CLI (cli/build-albums.ts) is the only file that reads
 * disk and writes the artifact.
 *
 * Why this cannot be D-04's raw heuristic alone (RESEARCH Pitfalls 1-3):
 *   - `islive=0` does NOT exclude recent official live albums (verified: "Live
 *     in Athens '25" carries islive:0). Card membership comes from the
 *     config-resident `cardAlbumUrls` allowlist keyed by album_url.
 *   - Singles predate the LPs that carry their songs ("Hey There / Ants & Bats"
 *     2010 vs "12 Bar Bruise" 2012). Earliest-date operates WITHIN the allowlist.
 *   - album_title is not a unique key (duplicates + trailing spaces). Albums are
 *     keyed by album_url; titles are trimmed. releasedate carries "(N)"
 *     suffixes — parsed via a /^\d{4}-\d{2}-\d{2}/ prefix.
 *   - albums.json has NO song_id. Tracks join to songs.json by slug:
 *     `song_url.replace("/song/","")` ↔ songs.json `.slug` (SCHEMA.md §11).
 *
 * Full-coverage invariant: every matrix catalog song appears exactly once
 * across card albums + Covers/Miscellaneous buckets. A card track with no
 * matrix node is a STAT-04 debut candidate (`inMatrix: false`). The sentinel
 * song (config.sentinelSongIds) is excluded everywhere. album_notes and every
 * other HTML-bearing field are NEVER copied into the artifact (T-06-01).
 */
import { config } from "../config.ts";
import type { MatrixNode } from "../domain/types.ts";
import { dexAlbumsArtifact, type AlbumTrack, type DexAlbumsArtifact } from "./archive-types.ts";

/** One raw track row from data/raw/albums.json (only the clean fields we consume). */
export interface AlbumRow {
  artist_id: number;
  album_url: string;
  album_title: string;
  releasedate: string;
  song_url: string;
  song_name: string;
  position: number;
  islive: number;
}

/** One raw row from data/raw/songs.json (only the fields the join needs). */
export interface SongRow {
  id: number;
  slug: string;
  name: string;
  isoriginal: number;
}

/**
 * The minimal config surface deriveDexAlbums reads — a structural subset of the
 * global `config` so tests can inject a synthetic allowlist without rebuilding
 * the whole object.
 */
export interface DexDerivationConfig {
  sentinelSongIds: readonly number[];
  dex: { cardAlbumUrls: readonly string[] };
}

/** Parse a dirty releasedate ("2020-09-29 (1)") to its YYYY-MM-DD prefix, or null if unparseable. */
function parseReleaseDate(raw: string): string | null {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw ?? "");
  return match ? match[0] : null;
}

/** Slug for an album track row — the join key to songs.json (SCHEMA.md §11). */
function trackSlug(row: AlbumRow): string {
  return row.song_url.replace("/song/", "");
}

interface CardAlbumAccumulator {
  albumUrl: string;
  title: string;
  releaseDate: string;
  rows: AlbumRow[];
}

export function deriveDexAlbums(
  albumRows: AlbumRow[],
  songRows: SongRow[],
  matrixNodes: MatrixNode[],
  cfg: DexDerivationConfig = config,
): DexAlbumsArtifact {
  const sentinelIds = new Set<number>(cfg.sentinelSongIds);
  const cardUrls = new Set<string>(cfg.dex.cardAlbumUrls);

  // songs.json lookups: slug → row (join target) and id → row (matrix→slug).
  const songBySlug = new Map<string, SongRow>();
  const songById = new Map<number, SongRow>();
  for (const s of songRows) {
    songBySlug.set(s.slug, s);
    songById.set(s.id, s);
  }
  const matrixSongIds = new Set<number>(matrixNodes.map((n) => n.songId));

  // (1)+(3): accumulate card albums (artist_id === 1 ∩ allowlist), keyed by
  // album_url, trimmed title, prefix-parsed date. Rows with an unparseable
  // date contribute no date but still list under an already-dated card.
  const cards = new Map<string, CardAlbumAccumulator>();
  for (const row of albumRows) {
    if (Number(row.artist_id) !== 1) continue;
    if (!cardUrls.has(row.album_url)) continue;
    let card = cards.get(row.album_url);
    if (!card) {
      card = {
        albumUrl: row.album_url,
        title: (row.album_title ?? "").trim(),
        releaseDate: parseReleaseDate(row.releasedate) ?? "",
        rows: [],
      };
      cards.set(row.album_url, card);
    } else if (card.releaseDate === "") {
      const parsed = parseReleaseDate(row.releasedate);
      if (parsed) card.releaseDate = parsed;
    }
    card.rows.push(row);
  }

  // (5): slug ownership — the earliest-dated card album containing each slug.
  // Applies to ALL slugs (matrix songs AND debut candidates) so a slug on
  // multiple cards (e.g. a compilation) appears on exactly its earliest card,
  // guaranteeing the full-coverage invariant. Tie-break by album_url for
  // determinism. Cards with an empty (unparseable) date are excluded from
  // ownership candidacy.
  const slugOwner = new Map<string, string>();
  const ownerDate = new Map<string, string>();
  for (const card of cards.values()) {
    if (card.releaseDate === "") continue;
    for (const row of card.rows) {
      const slug = trackSlug(row);
      const currentDate = ownerDate.get(slug);
      if (
        currentDate === undefined ||
        card.releaseDate < currentDate ||
        (card.releaseDate === currentDate && card.albumUrl < (slugOwner.get(slug) ?? ""))
      ) {
        slugOwner.set(slug, card.albumUrl);
        ownerDate.set(slug, card.releaseDate);
      }
    }
  }

  // Build an AlbumTrack from a raw row (drops all HTML-bearing fields — T-06-01).
  const toTrack = (row: AlbumRow): AlbumTrack => {
    const slug = trackSlug(row);
    const song = songBySlug.get(slug);
    const songId = song ? song.id : null;
    const inMatrix = songId != null && matrixSongIds.has(songId) && !sentinelIds.has(songId);
    return {
      songId,
      slug,
      title: row.song_name,
      position: Number(row.position),
      inMatrix,
    };
  };

  // (7): each card's tracklist = the rows it OWNS (earliest card for the slug),
  // in album position order, sentinel excluded, dedup-guarded by slug.
  const albums = [...cards.values()]
    .filter((card) => card.releaseDate !== "")
    .map((card) => {
      const seenSlugs = new Set<string>();
      const tracks: AlbumTrack[] = [];
      const ownedRows = card.rows
        .filter((row) => slugOwner.get(trackSlug(row)) === card.albumUrl)
        .sort((a, b) => Number(a.position) - Number(b.position));
      for (const row of ownedRows) {
        const slug = trackSlug(row);
        if (seenSlugs.has(slug)) continue; // guard duplicate slug rows within an album
        seenSlugs.add(slug);
        const track = toTrack(row);
        if (track.songId != null && sentinelIds.has(track.songId)) continue;
        tracks.push(track);
      }
      return {
        albumUrl: card.albumUrl,
        title: card.title,
        releaseDate: card.releaseDate,
        tracks,
      };
    })
    // (8): alphabetical by title (D-02 default sort).
    .sort((a, b) => a.title.localeCompare(b.title));

  // (6): every non-sentinel matrix song not owned by a card routes to a bucket —
  // Covers (isoriginal 0) or Miscellaneous (original with no card home).
  const covers: AlbumTrack[] = [];
  const miscellaneous: AlbumTrack[] = [];
  const sortedNodes = [...matrixNodes].sort((a, b) => a.songId - b.songId);
  for (const node of sortedNodes) {
    if (sentinelIds.has(node.songId)) continue;
    const song = songById.get(node.songId);
    const slug = song ? song.slug : null;
    if (slug != null && slugOwner.has(slug)) continue; // carded elsewhere
    const track: AlbumTrack = {
      songId: node.songId,
      slug: slug ?? "",
      title: node.songName,
      position: 0,
      inMatrix: true,
    };
    if (song && Number(song.isoriginal) === 0) covers.push(track);
    else miscellaneous.push(track);
  }

  const artifact: DexAlbumsArtifact = {
    schemaVersion: 1,
    albums,
    buckets: { covers, miscellaneous },
  };

  // Validate through the strict schema before returning (T-06-02) — a leaked
  // field or shape drift fails here, never reaches disk.
  return dexAlbumsArtifact.parse(artifact);
}

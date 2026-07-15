import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import type { MatrixNode, TransitionMatrix } from "../../src/domain/types.ts";
import { dexAlbumsArtifact } from "../../src/dex/archive-types.ts";
import {
  deriveDexAlbums,
  type AlbumRow,
  type SongRow,
  type DexDerivationConfig,
} from "../../src/dex/albums.ts";

/** Inert matrix node factory — only songId/songName matter to the mapping. */
function node(songId: number, songName: string): MatrixNode {
  return { songId, songName, playCount: 0, eraPlayCount: 0, tuningFamily: "standard" };
}

/** Resolve a repo-root-relative data file independent of the test runner cwd. */
function repoFile(rel: string): string {
  return fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
}

function song(id: number, slug: string, name: string, isoriginal: number): SongRow {
  return { id, slug, name, isoriginal };
}

function track(albumUrl: string, title: string, date: string, slug: string, position: number): AlbumRow {
  return {
    artist_id: 1,
    album_url: albumUrl,
    album_title: title,
    releasedate: date,
    song_url: `/song/${slug}`,
    song_name: slug,
    position,
    islive: 0,
  };
}

/**
 * Synthetic fixture exercising every mapping rule (plan Task 2 behavior):
 * - lp-b (2012) is EARLIER than lp-a (2015); "alpha" is on both cards + a
 *   single + a live album → must land on lp-b (earliest card), not the single.
 * - "alpha-single" and "live-athens" are NOT in the allowlist → never cards.
 * - "cover-song" (isoriginal 0) → buckets.covers.
 * - "misc-song" (isoriginal 1, on no card) → buckets.miscellaneous.
 * - "debut-track" on lp-b has no matrix node → inMatrix false debut candidate.
 * - sentinel songId 1 is excluded everywhere.
 */
const fixtureCfg: DexDerivationConfig = {
  sentinelSongIds: [1],
  dex: { cardAlbumUrls: ["/albums/lp-a", "/albums/lp-b"] },
};

const albumRows: AlbumRow[] = [
  // lp-b is the earlier card (2012)
  track("/albums/lp-b", "LP Bruise", "2012-09-07", "alpha", 1),
  track("/albums/lp-b", "LP Bruise", "2012-09-07", "debut-track", 2),
  track("/albums/lp-b", "LP Bruise", "2012-09-07", "sentinel-song", 3),
  // lp-a is the later card (2015-01-01 with a dirty "(1)" suffix)
  track("/albums/lp-a", "LP Alpha", "2015-01-01 (1)", "alpha", 1),
  track("/albums/lp-a", "LP Alpha", "2015-01-01 (1)", "beta", 2),
  // single predating both LPs — NOT allowlisted
  track("/albums/alpha-single", "Alpha Single", "2010-01-01", "alpha", 1),
  // official live album carrying islive=0 — NOT allowlisted
  { ...track("/albums/live-athens", "Live in Athens '25", "2020-01-01", "alpha", 1), islive: 0 },
];

const songRows: SongRow[] = [
  song(10, "alpha", "Alpha", 1),
  song(20, "beta", "Beta", 1),
  song(30, "cover-song", "Cover Song", 0),
  song(40, "misc-song", "Misc Song", 1),
  song(1, "sentinel-song", "Unknown", 1),
  // debut-track has a songs.json entry but no matrix node (a debut candidate)
  song(50, "debut-track", "Debut Track", 1),
];

const matrixNodes: MatrixNode[] = [
  node(10, "Alpha"),
  node(20, "Beta"),
  node(30, "Cover Song"),
  node(40, "Misc Song"),
  node(1, "Unknown"), // sentinel — must be excluded
];

describe("deriveDexAlbums (synthetic fixtures)", () => {
  const result = deriveDexAlbums(albumRows, songRows, matrixNodes, fixtureCfg);
  const byUrl = new Map(result.albums.map((a) => [a.albumUrl, a]));

  it("Test 1: maps a song to the earliest card album, never the single (Pitfall 2)", () => {
    const lpB = byUrl.get("/albums/lp-b");
    const lpA = byUrl.get("/albums/lp-a");
    expect(lpB?.tracks.some((t) => t.slug === "alpha" && t.inMatrix)).toBe(true);
    // alpha is owned by the earlier lp-b — it must NOT also appear on lp-a
    expect(lpA?.tracks.some((t) => t.slug === "alpha")).toBe(false);
  });

  it("Test 2: excludes non-allowlisted albums (single + islive=0 live album)", () => {
    expect(byUrl.has("/albums/alpha-single")).toBe(false);
    expect(byUrl.has("/albums/live-athens")).toBe(false);
  });

  it("Test 3: routes a cover (isoriginal 0) to buckets.covers", () => {
    expect(result.buckets.covers.some((t) => t.slug === "cover-song")).toBe(true);
    expect(result.buckets.miscellaneous.some((t) => t.slug === "cover-song")).toBe(false);
  });

  it("Test 4: routes an unmatched original to buckets.miscellaneous", () => {
    expect(result.buckets.miscellaneous.some((t) => t.slug === "misc-song")).toBe(true);
  });

  it("Test 5: a card track with no matrix node is present with inMatrix false (STAT-04 debut candidate)", () => {
    const lpB = byUrl.get("/albums/lp-b");
    const debut = lpB?.tracks.find((t) => t.slug === "debut-track");
    expect(debut).toBeDefined();
    expect(debut?.inMatrix).toBe(false);
  });

  it("Test 6: excludes the sentinel song everywhere", () => {
    const allTracks = [
      ...result.albums.flatMap((a) => a.tracks),
      ...result.buckets.covers,
      ...result.buckets.miscellaneous,
    ];
    expect(allTracks.some((t) => t.songId === 1)).toBe(false);
    expect(allTracks.some((t) => t.slug === "sentinel-song")).toBe(false);
  });

  it("Test 7: every matrix node songId appears exactly once across cards + buckets", () => {
    const seen = new Map<number, number>();
    const countMatrix = (songId: number | null) => {
      if (songId == null) return;
      seen.set(songId, (seen.get(songId) ?? 0) + 1);
    };
    for (const a of result.albums) for (const t of a.tracks) if (t.inMatrix) countMatrix(t.songId);
    for (const t of result.buckets.covers) countMatrix(t.songId);
    for (const t of result.buckets.miscellaneous) countMatrix(t.songId);
    // 4 non-sentinel matrix songs, each exactly once
    for (const n of matrixNodes) {
      if (n.songId === 1) continue;
      expect(seen.get(n.songId)).toBe(1);
    }
  });

  it("Test 8: albums are sorted alphabetically by title (D-02)", () => {
    const titles = result.albums.map((a) => a.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it("Test 9: output validates through dexAlbumsArtifact.parse", () => {
    expect(() => dexAlbumsArtifact.parse(result)).not.toThrow();
  });
});

describe("deriveDexAlbums (real data — D-04 drift guard + full coverage)", () => {
  it("Test 10: every config.dex.cardAlbumUrls entry exists as an album_url in albums.json", async () => {
    const raw = JSON.parse(await readFile(repoFile("data/raw/albums.json"), "utf8"));
    const rows: AlbumRow[] = raw.data ?? raw;
    const urls = new Set(rows.map((r) => r.album_url));
    for (const url of config.dex.cardAlbumUrls) {
      expect(urls.has(url), `missing allowlisted album_url: ${url}`).toBe(true);
    }
  });

  it("Test 11: card count stays in the 20-35 studio-shelf range (never 147)", async () => {
    const albumsRaw = JSON.parse(await readFile(repoFile("data/raw/albums.json"), "utf8"));
    const songsRaw = JSON.parse(await readFile(repoFile("data/raw/songs.json"), "utf8"));
    const matrixRaw = JSON.parse(
      await readFile(repoFile("data/normalized/transition-matrix.json"), "utf8"),
    ) as TransitionMatrix;
    const result = deriveDexAlbums(
      albumsRaw.data ?? albumsRaw,
      songsRaw.data ?? songsRaw,
      matrixRaw.nodes,
    );
    expect(result.albums.length).toBeGreaterThanOrEqual(20);
    expect(result.albums.length).toBeLessThanOrEqual(35);
  });

  it("Test 12: every one of the 264 matrix nodes appears exactly once across cards + buckets", async () => {
    const albumsRaw = JSON.parse(await readFile(repoFile("data/raw/albums.json"), "utf8"));
    const songsRaw = JSON.parse(await readFile(repoFile("data/raw/songs.json"), "utf8"));
    const matrixRaw = JSON.parse(
      await readFile(repoFile("data/normalized/transition-matrix.json"), "utf8"),
    ) as TransitionMatrix;
    const result = deriveDexAlbums(
      albumsRaw.data ?? albumsRaw,
      songsRaw.data ?? songsRaw,
      matrixRaw.nodes,
    );
    const seen = new Map<number, number>();
    const bump = (id: number | null) => {
      if (id == null) return;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    };
    for (const a of result.albums) for (const t of a.tracks) if (t.inMatrix) bump(t.songId);
    for (const t of result.buckets.covers) bump(t.songId);
    for (const t of result.buckets.miscellaneous) bump(t.songId);
    const sentinels = new Set<number>(config.sentinelSongIds);
    const nonSentinel = matrixRaw.nodes.filter((n) => !sentinels.has(n.songId));
    for (const n of nonSentinel) {
      expect(seen.get(n.songId), `matrix node ${n.songId} (${n.songName}) not mapped exactly once`).toBe(1);
    }
    // No extra matrix ids beyond the catalog
    expect([...seen.keys()].length).toBe(nonSentinel.length);
  });
});

describe("committed dex-albums.json artifact", () => {
  it("Test 13: parses through dexAlbumsArtifact and has 20-35 card albums", async () => {
    const raw = JSON.parse(await readFile(repoFile("data/normalized/dex-albums.json"), "utf8"));
    const parsed = dexAlbumsArtifact.parse(raw);
    expect(parsed.albums.length).toBeGreaterThanOrEqual(20);
    expect(parsed.albums.length).toBeLessThanOrEqual(35);
  });
});

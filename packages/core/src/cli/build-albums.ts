/**
 * Thin CLI wrapper around the pure `deriveDexAlbums` function (D-04): read the
 * committed raw albums.json + songs.json + the frozen transition matrix,
 * derive the album-shelf mapping, and write the versioned artifact. Mirrors
 * cli/build-model.ts's structure exactly (exported run fn, isMain guard,
 * deterministic output, stable 2-space JSON + trailing newline).
 *
 * `runBuildAlbums` is exported directly — no shelling out between CLI scripts
 * (CLAUDE.md: all orchestration lives in Node). Two runs against the same
 * committed inputs emit a byte-identical artifact (the derivation is pure and
 * order-stable), so `git diff` is the review mechanism.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import type { TransitionMatrix } from "../domain/types.ts";
import type { DexAlbumsArtifact } from "../dex/archive-types.ts";
import { deriveDexAlbums, type AlbumRow, type SongRow } from "../dex/albums.ts";

export interface BuildAlbumsCliOptions {
  albumsPath: string;
  songsPath: string;
  matrixPath: string;
  outPath: string;
}

export interface BuildAlbumsCliResult {
  artifact: DexAlbumsArtifact;
  matrixNodeCount: number;
}

function defaultOptions(): BuildAlbumsCliOptions {
  return {
    albumsPath: `${config.dataRawDir}/albums.json`,
    songsPath: `${config.dataRawDir}/songs.json`,
    matrixPath: config.matrixArtifactPath,
    outPath: config.dex.dexAlbumsArtifactPath,
  };
}

/** The raw kglw.net table files are either a bare array or a `{ data: [...] }` envelope. */
function unwrapRows<T>(parsed: unknown): T[] {
  if (Array.isArray(parsed)) return parsed as T[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: unknown }).data)) {
    return (parsed as { data: T[] }).data;
  }
  throw new Error("Expected a JSON array or a { data: [...] } envelope.");
}

export async function runBuildAlbums(
  options: Partial<BuildAlbumsCliOptions> = {},
): Promise<BuildAlbumsCliResult> {
  const opts: BuildAlbumsCliOptions = { ...defaultOptions(), ...options };

  const albumRows = unwrapRows<AlbumRow>(JSON.parse(await readFile(opts.albumsPath, "utf8")));
  const songRows = unwrapRows<SongRow>(JSON.parse(await readFile(opts.songsPath, "utf8")));
  const matrix = JSON.parse(await readFile(opts.matrixPath, "utf8")) as TransitionMatrix;

  const artifact = deriveDexAlbums(albumRows, songRows, matrix.nodes);

  await mkdir(dirname(opts.outPath), { recursive: true });
  // Stable 2-space formatting + trailing newline — makes `git diff` the review mechanism.
  await writeFile(opts.outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return { artifact, matrixNodeCount: matrix.nodes.length };
}

export function formatBuildAlbumsSummary(result: BuildAlbumsCliResult): string {
  const { artifact, matrixNodeCount } = result;
  const cardTrackMatrixIds = new Set<number>();
  for (const album of artifact.albums) {
    for (const track of album.tracks) {
      if (track.inMatrix && track.songId != null) cardTrackMatrixIds.add(track.songId);
    }
  }
  const coverIds = artifact.buckets.covers.filter((t) => t.songId != null).length;
  const miscIds = artifact.buckets.miscellaneous.filter((t) => t.songId != null).length;
  const covered = cardTrackMatrixIds.size + coverIds + miscIds;
  const debutCandidates = artifact.albums.reduce(
    (n, album) => n + album.tracks.filter((t) => !t.inMatrix).length,
    0,
  );
  return (
    `Built dex-albums mapping: ${artifact.albums.length} card albums, ` +
    `${artifact.buckets.covers.length} covers, ${artifact.buckets.miscellaneous.length} miscellaneous.\n` +
    `Matrix coverage: ${covered}/${matrixNodeCount} catalog songs mapped ` +
    `(${cardTrackMatrixIds.size} carded, ${coverIds + miscIds} bucketed). ` +
    `${debutCandidates} debut candidates (album tracks with no matrix node).`
  );
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await runBuildAlbums();
    console.log(formatBuildAlbumsSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

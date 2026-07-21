/**
 * The memoized app→core `BingoContext` adapter (Phase 16, BINGO-04) — the SINGLE
 * place every games/live/celebration surface reads the bingo marking context
 * from. `buildBingoContext` is a full pass over the four shipped artifacts
 * (matrix, archive, rarity, albums); rebuilding it per render would rescan the
 * whole corpus on every live poll (RESEARCH Pitfall 2). This module builds it
 * EXACTLY ONCE and shares the reference — mirroring `getRarityIndex`'s
 * module-cache discipline.
 *
 * Returns `null` until all four guarded loaders are ready (a schemaVersion drift
 * degrades to the calm null branch, never a throw — the caller renders a loading
 * shell). Alongside the ctx it exposes `corpusVersion` (the matrix's stable
 * corpus-snapshot identity, `asOfDate` — NOT the volatile build timestamp, so a
 * rebuilt-but-unchanged corpus deals identical cards, D-21) which the Plan-04
 * `deal` generator mixes into its seed; and a `dexSnapshot` helper that projects
 * the live `DexStats` into the caught-songId set the fold + generator consume.
 */
import { buildBingoContext, type BingoContext, type DexStats } from "@guezzer/core";
import { loadArchive } from "../dex/archive-loader.ts";
import { loadDexAlbums } from "../dex/dex-albums-loader.ts";
import { getRarityIndex } from "../dex/rarityIndex.ts";
import { loadMatrix } from "../show/matrix.ts";

/** The resolved bingo context bundle — the memoized ctx + its corpus-snapshot identity. */
export interface BingoContextResult {
  /** The memoized marking context (same reference every call, never rebuilt). */
  ctx: BingoContext;
  /** The matrix's stable corpus-snapshot identity (`asOfDate`) — the D-21 deal-seed scope. */
  corpusVersion: string;
}

let cached: BingoContextResult | null = null;

/**
 * The memoized `BingoContext` + `corpusVersion`, or `null` while any of the four
 * guarded loaders (matrix / archive / album-mapping / rarity) is not yet ready or
 * failed its schemaVersion guard. Built exactly once — a second call returns the
 * SAME reference.
 */
export function getBingoContext(): BingoContextResult | null {
  if (cached) return cached;

  const matrixResult = loadMatrix();
  const archiveResult = loadArchive();
  const albumsResult = loadDexAlbums();
  const rarity = getRarityIndex();
  if (!matrixResult.ok || !archiveResult.ok || !albumsResult.ok || rarity == null) {
    return null;
  }

  cached = {
    ctx: buildBingoContext(
      matrixResult.matrix,
      archiveResult.archive,
      rarity,
      albumsResult.albums,
    ),
    // Stable corpus identity (the matrix cutoff), NOT `generatedAt` (a per-build
    // timestamp) — a rebuilt-but-identical corpus must deal identical cards (D-21).
    corpusVersion: matrixResult.matrix.asOfDate,
  };
  return cached;
}

/**
 * Project the live `DexStats` into the caught-songId set the marking fold reads
 * for `neverCaught` and the generator seeds its dex-model from. Every key in
 * `dex.perSong` is a caught catalog song (derive-dex.ts), so the set of keys IS
 * the caught set. Live callers pass this as `deriveLiveBoard`'s
 * `liveCaughtSnapshot`; lock-time callers freeze it onto the persisted row.
 */
export function dexSnapshot(dex: DexStats): ReadonlySet<number> {
  return new Set(dex.perSong.keys());
}

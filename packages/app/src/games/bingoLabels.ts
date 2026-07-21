/**
 * Phase-16 (BINGO-01/02) app→display bridge for the pure `BingoCard`. The core
 * `deal` generator is DOM-free and songId-based: it freezes placeholder labels
 * (`"Song 132"`, `albumUrl`) onto each square because core has no name catalog.
 * This app-layer helper resolves those into the real, display-frozen labels the
 * shared `<BingoBoard>` renders (D-08 frozen-label discipline preserved — the
 * resolved label is stamped once, at deal/swap time, then persisted), plus the
 * deterministic `isCardCustom` deviation check the vibe→"Custom" flip reads.
 *
 * Names come from the SAME shipped artifacts the rest of the app uses: song
 * names via `toCatalog(matrix.nodes)`, album titles via the dex-albums shelf —
 * no new pipeline. All kglw-derived names cross to the UI as escaped React text
 * only (T-16-04). Pure over its resolved maps; the maps are module-memoized
 * (the artifacts are static) mirroring `getBingoContext`'s cache discipline.
 */
import {
  deal,
  toCatalog,
  type BingoCard,
  type BingoContext,
  type BingoSquareDef,
} from "@guezzer/core";
import { loadDexAlbums } from "../dex/dex-albums-loader.ts";
import { loadMatrix } from "../show/matrix.ts";

/** The two name lookups needed to turn a pure card's placeholder labels into display text. */
export interface BingoNameMaps {
  /** songId → catalog song name (from the transition matrix nodes). */
  songName: ReadonlyMap<number, string>;
  /** album_url → studio-album title (from the dex-albums shelf). */
  albumTitle: ReadonlyMap<string, string>;
}

let cachedMaps: BingoNameMaps | null = null;

/**
 * The memoized song-name + album-title maps resolved from the shipped matrix +
 * dex-albums artifacts. Built exactly once (static artifacts); a loader failure
 * degrades to empty maps, so callers fall back to the pure card's own labels
 * rather than throwing.
 */
export function getBingoNameMaps(): BingoNameMaps {
  if (cachedMaps) return cachedMaps;

  const songName = new Map<number, string>();
  const matrixResult = loadMatrix();
  if (matrixResult.ok) {
    for (const entry of toCatalog(matrixResult.matrix.nodes)) {
      songName.set(entry.songId, entry.songName);
    }
  }

  const albumTitle = new Map<string, string>();
  const albumsResult = loadDexAlbums();
  if (albumsResult.ok) {
    for (const album of albumsResult.albums.albums) {
      albumTitle.set(album.albumUrl, album.title);
    }
  }

  cachedMaps = { songName, albumTitle };
  return cachedMaps;
}

/** "/albums/nonagon-infinity" → "Nonagon Infinity" (last-resort album label when the shelf lacks a title). */
export function prettifyAlbumUrl(albumUrl: string): string {
  const slug = albumUrl.slice(albumUrl.lastIndexOf("/") + 1);
  return slug
    .split("-")
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Replace generator "Song N" tokens with the resolved catalog name (covers the neverCaught hint label). */
function resolveSongTokens(label: string, maps: BingoNameMaps): string {
  return label.replace(/Song (\d+)/g, (match, id: string) => maps.songName.get(Number(id)) ?? match);
}

/** The display label for one square, resolving song / album / neverCaught-hint identities to real names. */
export function labelForDef(def: BingoSquareDef, maps: BingoNameMaps): string {
  switch (def.kind) {
    case "free":
      return "";
    case "song":
      return maps.songName.get(def.songId) ?? def.label;
    case "album":
      return maps.albumTitle.get(def.albumUrl) ?? prettifyAlbumUrl(def.albumUrl);
    case "event":
      return resolveSongTokens(def.label, maps);
  }
}

/**
 * Freeze real display labels onto every fillable square (D-08). The card shape
 * (16 squares, single free at `freeIndex`, square identities) is untouched — only
 * the human `label` is resolved — so the result still satisfies `bingoCardSchema`
 * and re-deals/marks identically.
 */
export function resolveCardLabels(card: BingoCard, maps: BingoNameMaps): BingoCard {
  return {
    ...card,
    squares: card.squares.map((def): BingoSquareDef => {
      switch (def.kind) {
        case "free":
          return def;
        case "song":
          return { ...def, label: labelForDef(def, maps) };
        case "album":
          return { ...def, label: labelForDef(def, maps) };
        case "event":
          return { ...def, label: labelForDef(def, maps) };
      }
    }),
  };
}

/** Identity signature IGNORING labels — two cards match iff same square identities in board order. */
function cardSignature(card: BingoCard): string {
  return card.squares
    .map((def) => {
      switch (def.kind) {
        case "free":
          return "free";
        case "song":
          return `song:${def.songId}`;
        case "album":
          return `album:${def.albumUrl}`;
        case "event":
          return `event:${def.event}`;
      }
    })
    .join("|");
}

/**
 * D-04 custom-vibe flip: a card is "Custom" once it deviates from a fresh re-deal
 * of its OWN `seed` / `vibe` / `corpusVersion`. Deterministic (D-21) and
 * label-independent (only square identities matter), so it survives reload and
 * is robust to the cosmetic neverCaught-hint label. `dexSnapshot` is accepted for
 * signature parity with `deal` but does not affect the identity signature.
 */
export function isCardCustom(
  card: BingoCard,
  ctx: BingoContext,
  dexSnapshot: ReadonlySet<number>,
): boolean {
  const original = deal(card.seed, card.vibe, ctx, dexSnapshot, card.corpusVersion);
  return cardSignature(card) !== cardSignature(original);
}

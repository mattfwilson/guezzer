/**
 * songId → album-cover resolver (quick task 260717-gvm). Bridges a logged song
 * to the bundled album-cover WebP of the album it belongs to, so the Show page
 * background can reflect the currently-selected next song's album.
 *
 * Two layers, both app-layer (no core/UI purity violation — covers.ts and
 * dex-albums-loader.ts are both app modules):
 *   - `buildSongCoverSlugMap` is PURE: a DexAlbumsArtifact → Map<songId, slug>.
 *     Only songs INSIDE `albums[].tracks` are mapped (bucket Covers/Miscellaneous
 *     songs carry no card album → no art). The unit test pins this derivation.
 *   - `coverUrlForSong` is the app-bound resolver: loads + memoizes the mapping,
 *     then resolves through `coverUrlFor` (null for a song with no committed art
 *     or on a dex-albums load failure). Never throws — a missing cover is a calm
 *     null the caller degrades to "keep the current background".
 */
import type { DexAlbumsArtifact } from "@guezzer/core";
import { coverUrlFor } from "./covers.ts";
import { loadDexAlbums } from "./dex-albums-loader.ts";

/** Cover slug = the last path segment of an album's albumUrl (mirrors slugForAlbumUrl in AlbumGrid.tsx). */
function slugForAlbumUrl(albumUrl: string): string {
  return albumUrl.slice(albumUrl.lastIndexOf("/") + 1);
}

/**
 * PURE: build a songId → album-cover-slug map from the album shelf. Every track
 * inside an album with a non-null songId maps to that album's cover slug. Null
 * songIds are skipped; bucket songs are never iterated (no card album → no art).
 */
export function buildSongCoverSlugMap(
  artifact: DexAlbumsArtifact,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const album of artifact.albums) {
    const slug = slugForAlbumUrl(album.albumUrl);
    for (const track of album.tracks) {
      if (track.songId != null) map.set(track.songId, slug);
    }
  }
  return map;
}

/** Lazily-built songId→slug cache. loadDexAlbums is itself memoized, so a single module-level cache suffices. */
let cachedMap: Map<number, string> | null = null;

/**
 * App-bound resolver: the bundled cover URL for the album a song belongs to, or
 * null when there is no committed art (or the dex-albums artifact failed its
 * schema guard). Never throws.
 */
export function coverUrlForSong(songId: number): string | null {
  if (cachedMap == null) {
    const result = loadDexAlbums();
    if (!result.ok) return null;
    cachedMap = buildSongCoverSlugMap(result.albums);
  }
  const slug = cachedMap.get(songId);
  if (slug == null) return null;
  return coverUrlFor(slug);
}

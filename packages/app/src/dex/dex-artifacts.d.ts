/**
 * Ambient types for the two bundle-imported Phase-6 dex artifacts. The
 * `@archive` / `@dexAlbums` specifiers are Vite `resolve.alias` entries (see
 * vite.config.ts) pointing at the repo-root `data/normalized/archive.json` and
 * `dex-albums.json`. Declaring them here lets tsc resolve the imports to core's
 * frozen artifact shapes without a cross-package relative path — the exact
 * `@matrix` idiom (see show/matrix-artifact.d.ts).
 */
declare module "@archive" {
  import type { ArchiveArtifact } from "@guezzer/core";
  const archive: ArchiveArtifact;
  export default archive;
}

declare module "@dexAlbums" {
  import type { DexAlbumsArtifact } from "@guezzer/core";
  const dexAlbums: DexAlbumsArtifact;
  export default dexAlbums;
}

/**
 * Ambient type for the bundle-imported GizzMap calibration artifact. The
 * `@festivalMap` specifier is a Vite `resolve.alias` (see vite.config.ts)
 * pointing at the repo-root `data/festival-maps/field-of-vision-2026.json`.
 * Typed `unknown` (unlike @matrix's trusted cast) because the loader
 * zod-validates it through core's `festivalMapArtifact` schema — the strict
 * guard is the type.
 */
declare module "@festivalMap" {
  const artifact: unknown;
  export default artifact;
}

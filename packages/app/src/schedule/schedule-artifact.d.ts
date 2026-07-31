/**
 * Ambient type for the bundle-imported FOV 2026 schedule artifact. The
 * `@schedule` specifier is a Vite `resolve.alias` (see vite.config.ts)
 * pointing at repo-root `data/schedule/fov-2026.json` — the @matrix idiom.
 * Typed `unknown` deliberately: core's `parseScheduleArtifact` zod-validates
 * at the boundary (a bad transcription fails loudly, never renders wrong).
 */
declare module "@schedule" {
  const artifact: unknown;
  export default artifact;
}

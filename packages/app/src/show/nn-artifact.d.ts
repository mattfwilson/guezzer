/**
 * Ambient type for the bundle-imported "Max's predictor" artifact. The
 * `@nnModel` specifier is a Vite `resolve.alias` (see vite.config.ts)
 * pointing at the repo-root `data/nn/setlist-transformer.json` — the same
 * idiom as `@matrix`. Typed `unknown` deliberately: the app NEVER trusts the
 * shape statically; core's `loadNnModel` zod-validates at the boundary.
 */
declare module "@nnModel" {
  const artifact: unknown;
  export default artifact;
}

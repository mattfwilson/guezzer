/**
 * Ambient type for the bundle-imported matrix artifact. The `@matrix` specifier
 * is a Vite `resolve.alias` (see vite.config.ts) pointing at the repo-root
 * `data/normalized/transition-matrix.json`. Declaring it here lets tsc resolve
 * the import to core's frozen `TransitionMatrix` shape without a cross-package
 * relative path (RESEARCH Pitfall 4).
 */
declare module "@matrix" {
  import type { TransitionMatrix } from "@guezzer/core";
  const matrix: TransitionMatrix;
  export default matrix;
}

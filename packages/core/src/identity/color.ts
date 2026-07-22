/**
 * AUTH-07 / D-13 — deterministic identity → palette-index hash (pure core).
 *
 * Mirrors the shipped `MapView.memberColor` idiom (people are not rarities —
 * they get their own hashed hue, B3) but stays PALETTE-AGNOSTIC: it returns the
 * INDEX only, never a color string. The app injects
 * `config.auth.IDENTITY_COLORS.length` and reads the hue back out, so this
 * helper carries zero UI/config dependency and is reused unchanged by the
 * Phase 18 header avatar, Phase 19 friend rows, and Phase 20 presence dots.
 *
 * This is a NON-SECURITY display hash (RESEARCH Security Domain V6): a collision
 * only means two friends share a hue — never a privilege effect. No DOM, no
 * `@supabase`, no config import — safe under the core-purity static scan.
 *
 * @param userId        The identity's stable id (a Supabase user UUID in prod).
 * @param paletteLength The number of hues to distribute across (>= 1).
 * @returns An integer index in `[0, paletteLength)`.
 */
export function identityColorIndex(userId: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % paletteLength;
}

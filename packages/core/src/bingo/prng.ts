/**
 * Deterministic, string-seedable PRNG for the bingo deal (D-21). The one
 * Claude's-discretion technical choice this phase: xmur3 (string -> 32-bit
 * seed) + mulberry32 (32-bit-state -> float in [0,1)). Both are canonical,
 * public-domain, dependency-free pure functions using only `Math.imul` + bit
 * ops — ES2023-lib safe and erasable-syntax-only (no class/enum/namespace).
 *
 * Compose them so vibe + corpus version scope the determinism:
 *   const rand = mulberry32(xmur3(`${seed} ${vibe} ${corpusVersion}`)());
 * Then use `rand()` for every random choice in the deal. This module never
 * reads any nondeterministic global clock or entropy source — determinism is
 * the whole point.
 *
 * Source: bryc/code PRNGs.md (public domain).
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */

/** Hash a string into a stream of 32-bit seeds (MurmurHash3 mixing). */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32-bit-state PRNG -> float in [0,1). Simplest high-quality option. */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

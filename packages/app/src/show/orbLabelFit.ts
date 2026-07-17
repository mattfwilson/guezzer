/**
 * Pure orb-label fit heuristic (Phase-6 D-21). Given a song name, the orb (or
 * center-pill) diameter, and the fit options, it wraps on word boundaries up to
 * `maxLines`, shrinking the font uniformly (integer steps) toward `minFontPx` to
 * keep words whole; a single word still too long for a line even at the floor (a
 * long one-word title) is then hard-broken across lines so it can never spill out,
 * and only if that still overflows is the final line ellipsized. Mirrors the
 * `orbitLayout.ts` pure-testable-helper idiom: NO React, NO DOM reads, every
 * tunable injected — identical input → deep-equal output.
 *
 * This is a LAYOUT heuristic, not a real text measurer: usable chord width is
 * approximated from the diameter and average character advance of the 600-weight
 * system font (~0.52× the font px). That is deliberately approximate — it never
 * touches orb geometry, tap targets, or the fan layout (SHOW-02 untouched); the
 * verbatim full name always remains available via the Info "why" detail.
 */

export interface FitOrbLabelOptions {
  /** Starting (largest) font size in px — the existing role size. */
  baseFontPx: number;
  /** Font-size floor in px; the fn never returns below this before ellipsizing. */
  minFontPx: number;
  /** Max wrapped lines; the fn never returns more than this. */
  maxLines: number;
}

export interface FitOrbLabelResult {
  /** Chosen font size in px (baseFontPx ≥ result ≥ minFontPx). */
  fontPx: number;
  /** The wrapped lines (≤ maxLines). */
  lines: string[];
  /** True only when the name overflowed even at the floor and the last line was clipped. */
  ellipsized: boolean;
}

/** Average character advance as a fraction of font px for the 600-weight system font. */
const CHAR_WIDTH_FACTOR = 0.52;
/** Fraction of the diameter usable as a per-line text chord. */
const USABLE_WIDTH_FACTOR = 1;

/** Approximate characters that fit on one line at `fontPx` inside `diameterPx`. */
function charsPerLine(diameterPx: number, fontPx: number): number {
  const usable = diameterPx * USABLE_WIDTH_FACTOR;
  return Math.max(1, Math.floor(usable / (CHAR_WIDTH_FACTOR * fontPx)));
}

/** Greedy word-boundary wrap into lines of at most `maxChars` characters. When
 *  `breakLong` is set, a single word longer than `maxChars` (a long one-word title)
 *  is HARD-BROKEN into maxChars-sized chunks on their own lines so it can never
 *  spill out of the orb; otherwise such a word is left whole (and overflows the
 *  line budget, signalling the caller to shrink the font first). */
function greedyWrap(
  words: string[],
  maxChars: number,
  breakLong: boolean,
): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current !== "") {
      lines.push(current);
      current = "";
    }
  };
  for (const word of words) {
    if (breakLong && word.length > maxChars) {
      // Too long for a line on its own — flush what's pending, then emit the word
      // in maxChars-sized pieces (each on its own line; never shares with others).
      flush();
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    if (current === "") {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      flush();
      current = word;
    }
  }
  flush();
  return lines;
}

/** True when the wrap fits the line/width budget without any clipping. */
function fitsBudget(
  lines: string[],
  maxChars: number,
  maxLines: number,
): boolean {
  if (lines.length > maxLines) return false;
  return lines.every((line) => line.length <= maxChars);
}

export function fitOrbLabel(
  name: string,
  diameterPx: number,
  opts: FitOrbLabelOptions,
): FitOrbLabelResult {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { fontPx: opts.baseFontPx, lines: [""], ellipsized: false };
  }

  // Pass 1 — keep every word WHOLE and shrink uniformly base→floor; return the
  // largest size at which the word-boundary wrap fits cleanly. This keeps a long
  // one-word title on a single (smaller) line rather than breaking it mid-word.
  for (let fontPx = opts.baseFontPx; fontPx >= opts.minFontPx; fontPx -= 1) {
    const maxChars = charsPerLine(diameterPx, fontPx);
    const lines = greedyWrap(words, maxChars, false);
    if (fitsBudget(lines, maxChars, opts.maxLines)) {
      return { fontPx, lines, ellipsized: false };
    }
  }

  // Pass 2 — a word is too long for a line even at the floor (a very long single
  // word). Allow hard-breaking it across lines, and again take the LARGEST font
  // whose broken wrap fits the budget, so the full title still shows (just smaller)
  // and never spills out of the orb.
  for (let fontPx = opts.baseFontPx; fontPx >= opts.minFontPx; fontPx -= 1) {
    const maxChars = charsPerLine(diameterPx, fontPx);
    const lines = greedyWrap(words, maxChars, true);
    if (fitsBudget(lines, maxChars, opts.maxLines)) {
      return { fontPx, lines, ellipsized: false };
    }
  }

  // Floor + still over budget even when broken → wrap at the floor, keep maxLines,
  // ellipsize the last line.
  const maxChars = charsPerLine(diameterPx, opts.minFontPx);
  const kept = greedyWrap(words, maxChars, true).slice(0, opts.maxLines);
  const lastIndex = kept.length - 1;
  let last = kept[lastIndex] ?? "";
  if (last.length > maxChars) {
    last = last.slice(0, Math.max(0, maxChars - 1)).replace(/\s+$/, "");
  }
  kept[lastIndex] = `${last}…`;
  return { fontPx: opts.minFontPx, lines: kept, ellipsized: true };
}

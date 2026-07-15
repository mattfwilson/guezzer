/**
 * Pure orb-label fit heuristic (Phase-6 D-21). Given a song name, the orb (or
 * center-pill) diameter, and the fit options, it wraps on word boundaries up to
 * `maxLines`, and only if the name still overflows does it shrink the font
 * uniformly (integer steps) toward `minFontPx` before ellipsizing the final
 * line. Mirrors the `orbitLayout.ts` pure-testable-helper idiom: NO React, NO
 * DOM reads, every tunable injected — identical input yields deep-equal output.
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

/** Greedy word-boundary wrap into lines of at most `maxChars` characters. */
function greedyWrap(words: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
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

  // Shrink uniformly from base to floor; return the first size that fits cleanly.
  for (let fontPx = opts.baseFontPx; fontPx >= opts.minFontPx; fontPx -= 1) {
    const maxChars = charsPerLine(diameterPx, fontPx);
    const lines = greedyWrap(words, maxChars);
    if (fitsBudget(lines, maxChars, opts.maxLines)) {
      return { fontPx, lines, ellipsized: false };
    }
  }

  // Floor + still over budget → wrap at the floor, keep maxLines, ellipsize last.
  const maxChars = charsPerLine(diameterPx, opts.minFontPx);
  const kept = greedyWrap(words, maxChars).slice(0, opts.maxLines);
  const lastIndex = kept.length - 1;
  let last = kept[lastIndex] ?? "";
  if (last.length > maxChars) {
    last = last.slice(0, Math.max(0, maxChars - 1)).replace(/\s+$/, "");
  }
  kept[lastIndex] = `${last}…`;
  return { fontPx: opts.minFontPx, lines: kept, ellipsized: true };
}

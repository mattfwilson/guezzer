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
 * This is a LAYOUT heuristic, not a real text measurer, but it is now geometrically
 * CIRCLE-AWARE (POLISH-01, plan 08-08): each wrapped line's usable width is the
 * circle chord at that line's vertical offset (chord = 2·√(r²−y²)), and the stacked
 * lines plus a reserved percent-line height must fit the circle's vertical extent —
 * a wrap is accepted only when it passes `labelFitsCircle`. It never touches orb
 * geometry, tap targets, or the fan layout (SHOW-02 untouched); the verbatim full
 * name always remains available via the Info "why" detail. The pure no-DOM
 * self-report is confirmed against real glyph rendering on-device via #/dev/orb-fit.
 */

export interface FitOrbLabelOptions {
  /** Starting (largest) font size in px — the existing role size. */
  baseFontPx: number;
  /** Font-size floor in px; the fn never returns below this before ellipsizing. */
  minFontPx: number;
  /** Max wrapped lines; the fn never returns more than this. */
  maxLines: number;
  /**
   * POLISH-01 (08-08): line-box height as a multiple of font px — the vertical
   * space each wrapped line occupies in the circle model. REQUIRED (no optimistic
   * default: a missing/assumed value is exactly what let the rectangular heuristic
   * over-fit). `config.show.ORB_LABEL_LINE_HEIGHT_FACTOR`.
   */
  lineHeightFactor: number;
  /**
   * POLISH-01 (08-08): vertical px reserved BELOW the name for other content — the
   * prediction-orb's always-present percent line (`ORB_LABEL_PERCENT_LINE_PX`); the
   * center node passes 0. REQUIRED. Subtracted from the circle's vertical budget so
   * the name never collides with the percent line.
   */
  reservedHeightPx: number;
}

export interface FitOrbLabelResult {
  /** Chosen font size in px (baseFontPx ≥ result ≥ minFontPx). */
  fontPx: number;
  /** The wrapped lines (≤ maxLines). */
  lines: string[];
  /** True only when the name overflowed even at the floor and the last line was clipped. */
  ellipsized: boolean;
}

/**
 * Average character advance as a fraction of font px for the 600-weight system
 * font. Raised from the old optimistic 0.52 to a CONSERVATIVE 0.55 (POLISH-01,
 * plan 08-06): the pure heuristic has no real glyph metrics and drifts optimistic
 * (RESEARCH §Orb-Label Legibility, three drift sources), so it under-estimated
 * how many chars actually fit and let long real names ellipsize on-device. Under
 * the circle-aware model (08-08) the conservatism is paired with ORB_LABEL_MAX_LINES
 * (5) and the lower ORB_LABEL_MIN_FONT_PX (7) so every real catalog name still fits
 * without ellipsis across the swept diameter range (locked by
 * orbLabelFit.catalog.test.ts, confirmed on-device via #/dev/orb-fit).
 */
export const CHAR_WIDTH_FACTOR = 0.55;

/** Tiny slack (px) so exact-fit chord/height comparisons don't fail on float error. */
const FIT_EPSILON = 0.01;

/**
 * POLISH-01 (plan 08-08) — the GEOMETRIC circular-fit predicate. Pure, no DOM/React
 * (mirrors the orbitLayout pure-helper idiom). Given a `fitOrbLabel` result and the
 * CONTENT circle diameter, it answers: do the wrapped name lines (plus the reserved
 * percent-line height) all fit INSIDE the circle — no line wider than the circle
 * chord at its vertical offset, and the whole stacked block no taller than the
 * circle? This is the honest circle model the old rectangular heuristic lacked; the
 * catalog test and `fitOrbLabel` share it as the single source of fit truth.
 *
 *  - r          = contentDiameterPx / 2
 *  - lineHeight = result.fontPx × lineHeightFactor
 *  - blockH     = result.lines.length × lineHeight + reservedHeightPx   (must ≤ 2r)
 *  - the block is vertically centered (topY = −blockH/2); line i spans
 *    [topY + i·lineHeight, topY + (i+1)·lineHeight]; its worst (widest-needed)
 *    vertical offset is the edge farther from center, so chord = 2·√(r² − worstY²)
 *    and the line's estimated glyph width (len × CHAR_WIDTH_FACTOR × fontPx) must
 *    not exceed that chord.
 */
export function labelFitsCircle(
  result: FitOrbLabelResult,
  contentDiameterPx: number,
  { lineHeightFactor, reservedHeightPx }: {
    lineHeightFactor: number;
    reservedHeightPx: number;
  },
): boolean {
  const r = contentDiameterPx / 2;
  const lineHeight = result.fontPx * lineHeightFactor;
  const blockH = result.lines.length * lineHeight + reservedHeightPx;
  // Height: the stacked name lines + reserved percent line must fit the circle.
  if (blockH > contentDiameterPx + FIT_EPSILON) return false;
  const topY = -blockH / 2;
  for (let i = 0; i < result.lines.length; i += 1) {
    const worstY = Math.max(
      Math.abs(topY + i * lineHeight),
      Math.abs(topY + (i + 1) * lineHeight),
    );
    const chord = 2 * Math.sqrt(Math.max(0, r * r - worstY * worstY));
    const estWidth = result.lines[i].length * CHAR_WIDTH_FACTOR * result.fontPx;
    if (estWidth > chord + FIT_EPSILON) return false;
  }
  return true;
}

/**
 * POLISH-01 (08-08) — per-line character budgets from the CIRCLE chords. For a
 * `lineCount`-line block of `fontPx` text (line box = fontPx × lineHeightFactor)
 * plus `reservedHeightPx`, vertically centered in the content circle, returns the
 * max chars each line can hold (its chord ÷ char advance). Returns `null` when the
 * block is taller than the circle (this line count doesn't fit vertically). The
 * outer lines get FEWER chars than the center lines — the circular narrowing the
 * old rectangular heuristic ignored.
 */
function lineBudgets(
  contentDiameterPx: number,
  fontPx: number,
  lineHeightFactor: number,
  reservedHeightPx: number,
  lineCount: number,
): number[] | null {
  const r = contentDiameterPx / 2;
  const lineHeight = fontPx * lineHeightFactor;
  const blockH = lineCount * lineHeight + reservedHeightPx;
  if (blockH > contentDiameterPx + FIT_EPSILON) return null;
  const topY = -blockH / 2;
  const budgets: number[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    const worstY = Math.max(
      Math.abs(topY + i * lineHeight),
      Math.abs(topY + (i + 1) * lineHeight),
    );
    const chord = 2 * Math.sqrt(Math.max(0, r * r - worstY * worstY));
    budgets.push(Math.max(0, Math.floor(chord / (CHAR_WIDTH_FACTOR * fontPx))));
  }
  return budgets;
}

/**
 * Greedy word-boundary wrap honoring each line's OWN chord budget (line i fills to
 * `budgets[i]`, then advances). When `breakLong` is set, a single word longer than
 * the current line's budget is HARD-BROKEN across lines so it can never spill; when
 * not set, an unfittable word signals the caller to shrink the font first (returns
 * `null` once every line is exhausted). `null` = doesn't fit in `budgets.length`
 * lines under this policy.
 */
function wrapToBudgets(
  words: string[],
  budgets: number[],
  breakLong: boolean,
): string[] | null {
  const k = budgets.length;
  const lines: string[] = new Array(k).fill("");
  let li = 0;
  for (const original of words) {
    let word = original;
    while (true) {
      if (li >= k) return null;
      const cap = budgets[li];
      const current = lines[li];
      if (current === "") {
        if (word.length <= cap) {
          lines[li] = word;
          break;
        }
        if (breakLong) {
          if (cap <= 0) {
            li += 1;
            continue;
          }
          lines[li] = word.slice(0, cap);
          word = word.slice(cap);
          li += 1;
          continue;
        }
        // Whole word too wide for this empty line and breaking is disallowed — try
        // the next (often fatter, center) line; exhausting all lines returns null.
        li += 1;
        continue;
      }
      if (`${current} ${word}`.length <= cap) {
        lines[li] = `${current} ${word}`;
        break;
      }
      li += 1;
    }
  }
  return lines.filter((line) => line !== "");
}

/**
 * Ellipsis safety net at the floor font: fill up to `maxLines` lines with the
 * tightest circular budgets (hard-breaking as needed, truncating any remainder)
 * and ellipsize the last line. UNREACHABLE for real catalog names at realistic
 * sizes (locked by orbLabelFit.catalog.test.ts) — a defensive backstop only.
 */
function ellipsizeAtFloor(
  words: string[],
  contentDiameterPx: number,
  fontPx: number,
  lineHeightFactor: number,
  reservedHeightPx: number,
  maxLines: number,
): string[] {
  let budgets: number[] | null = null;
  for (let k = maxLines; k >= 1; k -= 1) {
    const candidate = lineBudgets(
      contentDiameterPx,
      fontPx,
      lineHeightFactor,
      reservedHeightPx,
      k,
    );
    if (candidate) {
      budgets = candidate;
      break;
    }
  }
  if (!budgets) return ["…"];

  const k = budgets.length;
  const lines: string[] = new Array(k).fill("");
  let li = 0;
  for (const original of words) {
    if (li >= k) break;
    let word = original;
    while (word.length > 0 && li < k) {
      const cap = Math.max(1, budgets[li]);
      const current = lines[li];
      if (current === "") {
        if (word.length <= cap) {
          lines[li] = word;
          word = "";
        } else {
          lines[li] = word.slice(0, cap);
          word = word.slice(cap);
          li += 1;
        }
      } else if (`${current} ${word}`.length <= cap) {
        lines[li] = `${current} ${word}`;
        word = "";
      } else {
        li += 1;
      }
    }
  }

  const kept = lines.filter((line) => line !== "");
  if (kept.length === 0) kept.push("");
  const lastIndex = kept.length - 1;
  const cap = Math.max(1, budgets[Math.min(lastIndex, budgets.length - 1)]);
  let last = kept[lastIndex];
  if (last.length >= cap) {
    last = last.slice(0, Math.max(0, cap - 1)).replace(/\s+$/, "");
  }
  kept[lastIndex] = `${last}…`;
  return kept;
}

/**
 * CIRCLE-AWARE wrap + scale-to-fit (POLISH-01, 08-08). `contentDiameterPx` is the
 * CONTENT circle diameter — callers subtract their face padding first. Each wrapped
 * line's usable width is the circle chord at its vertical offset (not the flat
 * diameter), and a wrap is accepted only when it passes `labelFitsCircle` (the same
 * predicate the catalog test asserts) — so a returned non-ellipsized result is a
 * geometric guarantee the label fits inside the circle. Pure/deterministic, no DOM.
 */
export function fitOrbLabel(
  name: string,
  contentDiameterPx: number,
  opts: FitOrbLabelOptions,
): FitOrbLabelResult {
  const { baseFontPx, minFontPx, maxLines, lineHeightFactor, reservedHeightPx } =
    opts;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { fontPx: baseFontPx, lines: [""], ellipsized: false };
  }

  // Pass 1 keeps every word WHOLE; Pass 2 permits hard-breaking a single over-long
  // word. Within each pass, shrink base→floor and, at each font, try the FEWEST
  // lines first; accept the first wrap that geometrically fits the circle.
  for (const breakLong of [false, true]) {
    for (let fontPx = baseFontPx; fontPx >= minFontPx; fontPx -= 1) {
      for (let k = 1; k <= maxLines; k += 1) {
        const budgets = lineBudgets(
          contentDiameterPx,
          fontPx,
          lineHeightFactor,
          reservedHeightPx,
          k,
        );
        if (!budgets) continue; // k lines too tall for the circle at this font
        const lines = wrapToBudgets(words, budgets, breakLong);
        if (!lines || lines.length === 0 || lines.length > k) continue;
        const candidate: FitOrbLabelResult = { fontPx, lines, ellipsized: false };
        if (
          labelFitsCircle(candidate, contentDiameterPx, {
            lineHeightFactor,
            reservedHeightPx,
          })
        ) {
          return candidate;
        }
      }
    }
  }

  // Floor + still over budget even when broken → ellipsis safety net (unreachable
  // for real names at realistic sizes).
  const lines = ellipsizeAtFloor(
    words,
    contentDiameterPx,
    minFontPx,
    lineHeightFactor,
    reservedHeightPx,
    maxLines,
  );
  return { fontPx: minFontPx, lines, ellipsized: true };
}

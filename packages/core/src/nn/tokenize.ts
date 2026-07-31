/**
 * Trail → token sequence for "Max's predictor", mirroring setlist-predictor's
 * `prepare.encode_run` EXACTLY (the model only understands sequences shaped
 * like its training data):
 *
 *   <BOS> <Yyyyy> song song <SET2> song ... <ENCORE> song <NEWSHOW> song ... <EOS-never>
 *
 * - One sequence per RUN: prior finalized nights of the current run come
 *   first (oldest-first), joined by <NEWSHOW> — this is the no-repeat
 *   residency signal the transformer specifically wins on.
 * - Set markers are emitted on ENTERING a new set ("2" → <SET2>, "e" →
 *   <ENCORE>), never for the opening set — encode_run's seen_sets rule.
 * - Songs outside the model vocab map to <RARE>; a "???" placeholder (null
 *   songId) maps to the vocab's "Unknown" token when present (kglw's own
 *   unknown-song bucket), else <RARE>.
 * - The year token is clamped into the artifact's known <Yyyyy> range — the
 *   checkpoint was trained through 2025, so a 2026 show rides <Y2025>
 *   (nearest era; an honest approximation, flagged in the artifact docs).
 * - Over-long runs keep <BOS> <Yyyyy> + the most recent (maxLen − 2) tokens
 *   (in-distribution: training used random-window augmentation).
 */
import type { NnModel } from "./artifact.ts";

/** One ordered night of a run. `setNumber` mirrors the app's SetNumber vocabulary. */
export interface NnNightEntry {
  /** kglw song id; null = "???" placeholder. */
  songId: number | null;
  setNumber: "1" | "2" | "e";
}

export interface NnRunInput {
  /** The current show's calendar year (clamped to the vocab's year tokens). */
  year: number;
  /** Prior finalized nights (oldest-first), then the in-progress night LAST. */
  nights: NnNightEntry[][];
}

function requiredToken(model: NnModel, token: string): number {
  const id = model.idByToken.get(token);
  if (id === undefined) throw new Error(`nn tokenize: vocab missing ${token}`);
  return id;
}

/** The artifact's known year-token range, derived from the vocab itself. */
export function yearTokenFor(model: NnModel, year: number): number {
  let min = Infinity;
  let max = -Infinity;
  for (const token of model.idByToken.keys()) {
    const match = /^<Y(\d{4})>$/.exec(token);
    if (!match) continue;
    const y = Number(match[1]);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (!Number.isFinite(min)) throw new Error("nn tokenize: vocab has no year tokens");
  const clamped = Math.min(max, Math.max(min, year));
  return requiredToken(model, `<Y${clamped}>`);
}

function songToken(model: NnModel, songId: number | null): number {
  if (songId === null) {
    // kglw's own unknown-song bucket when the vocab kept it, else <RARE>.
    return model.idByToken.get("Unknown") ?? requiredToken(model, "<RARE>");
  }
  return model.tokenBySongId.get(songId) ?? requiredToken(model, "<RARE>");
}

/** Encode a run (prior nights + in-progress night) into model tokens, truncated to maxLen. */
export function tokenizeRun(model: NnModel, input: NnRunInput): number[] {
  const tokens: number[] = [requiredToken(model, "<BOS>"), yearTokenFor(model, input.year)];
  const newShow = requiredToken(model, "<NEWSHOW>");
  const set2 = requiredToken(model, "<SET2>");
  const encore = requiredToken(model, "<ENCORE>");

  for (const [night, entries] of input.nights.entries()) {
    if (night > 0) tokens.push(newShow);
    const seenSets = new Set<string>();
    for (const entry of entries) {
      if (!seenSets.has(entry.setNumber) && seenSets.size > 0) {
        tokens.push(entry.setNumber === "e" ? encore : set2);
      }
      seenSets.add(entry.setNumber);
      tokens.push(songToken(model, entry.songId));
    }
  }

  const maxLen = model.config.maxLen;
  if (tokens.length > maxLen) {
    // Keep <BOS> <Yyyyy> + the most recent window (random-window-augmented
    // training makes a clipped left edge in-distribution).
    return [...tokens.slice(0, 2), ...tokens.slice(tokens.length - (maxLen - 2))];
  }
  return tokens;
}

/**
 * "Max's predictor" candidate derivation + the pure merge against the
 * statistical fan. The transformer NEVER replaces the trusted matrix
 * pipeline — it annotates it (D-spirit of the backtest trust gate): a fan
 * orb the model also picks gains a second percentage; its top picks
 * (config.nn.EXTRA_FROM_TOP_RANKS), when absent from the fan entirely,
 * become extra flagged orbs.
 *
 * Probabilities shown are the model's RAW last-position softmax (matching
 * setlist-predictor's predict.py output) — structure tokens (<EOS>, <SET2>,
 * …) keep their share of the mass, so song probabilities are honest model
 * confidence, not renormalized to look bigger.
 */
import type { NnModel } from "./artifact.ts";
import { nnForwardProbs } from "./transformer.ts";
import { tokenizeRun, type NnRunInput } from "./tokenize.ts";
import type { PredictionCandidate } from "../domain/types.ts";

export interface NnCandidate {
  songId: number;
  /** kglw canonical name straight from the artifact vocab. */
  songName: string;
  /** Raw softmax probability at the last position. */
  prob: number;
  /** 1-based rank among SONG tokens (structure tokens don't hold ranks a human sees). */
  rank: number;
}

/**
 * Run the transformer over the tokenized run and return the top-K SONG
 * candidates (tokens carrying a kglw songId; <RARE>/"Unknown"/structure
 * tokens are context-only), excluding the currently-playing song — the fan's
 * own exclusion rule.
 */
export function nnPredict(
  model: NnModel,
  input: NnRunInput,
  currentSongId: number,
  topK: number,
): NnCandidate[] {
  const tokens = tokenizeRun(model, input);
  const probs = nnForwardProbs(model, tokens);

  const ranked: { id: number; prob: number }[] = [];
  for (let id = 0; id < probs.length; id++) ranked.push({ id, prob: probs[id] });
  ranked.sort((a, b) => b.prob - a.prob || a.id - b.id);

  const out: NnCandidate[] = [];
  for (const { id, prob } of ranked) {
    const entry = model.entryById.get(id);
    if (!entry || entry.songId === undefined) continue; // structure/<RARE>/"Unknown"
    if (entry.songId === currentSongId) continue;
    out.push({ songId: entry.songId, songName: entry.token, prob, rank: out.length + 1 });
    if (out.length >= topK) break;
  }
  return out;
}

/** A shown fan orb annotated with Max's-predictor agreement (null = the model doesn't rank it in top-K). */
export interface NnAnnotation {
  nnProb: number;
  nnRank: number;
}

export interface MergedFan {
  /** Same order/length as the shown fan; entry i annotates fan orb i. */
  annotations: (NnAnnotation | null)[];
  /**
   * The model's top picks ABSENT from the shown fan — rendered as extra,
   * visually-flagged "Max's predictor" orbs. Only ranks ≤ extraFromTopRanks
   * qualify (the owner's rule: new dots only for top picks the fan doesn't
   * already show; a top pick that IS shown dual-annotates instead).
   */
  extras: NnCandidate[];
}

/**
 * Pure merge of the transformer's candidates into the SHOWN fan (the app
 * passes the post-ring-solver orb list, so annotation lines up with what is
 * actually on screen).
 */
export function mergeNnIntoFan(
  shownFan: readonly PredictionCandidate[],
  nn: readonly NnCandidate[],
  extraFromTopRanks: number,
): MergedFan {
  const bySongId = new Map(nn.map((c) => [c.songId, c]));
  const annotations = shownFan.map((orb) => {
    const hit = bySongId.get(orb.songId);
    return hit ? { nnProb: hit.prob, nnRank: hit.rank } : null;
  });

  const shownIds = new Set(shownFan.map((orb) => orb.songId));
  const extras = nn.filter((c) => c.rank <= extraFromTopRanks && !shownIds.has(c.songId));

  return { annotations, extras };
}

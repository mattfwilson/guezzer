import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadNnModel } from "../../src/nn/artifact.ts";
import { mergeNnIntoFan, nnPredict, type NnCandidate } from "../../src/nn/nn-predict.ts";
import { tokenizeRun, yearTokenFor } from "../../src/nn/tokenize.ts";
import type { PredictionCandidate } from "../../src/domain/types.ts";

/**
 * Tokenizer rules (prepare.encode_run mirror), candidate derivation, and the
 * fan merge for "Max's predictor". Runs against the REAL committed artifact —
 * the same vocab/weights the app ships — so drift between export and port
 * shows up here, not at a show.
 */

const ARTIFACT_PATH = fileURLToPath(
  new URL("../../../../data/nn/setlist-transformer.json", import.meta.url),
);
const model = loadNnModel(JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")));
if (!model) throw new Error("artifact failed to load");

const tok = (name: string): number => {
  const id = model.idByToken.get(name);
  if (id === undefined) throw new Error(`missing token ${name}`);
  return id;
};

// Three real songIds straight from the artifact vocab.
const songIds = [...model.tokenBySongId.keys()].sort((a, b) => a - b);
const [sidA, sidB, sidC] = songIds;

describe("tokenizeRun (encode_run mirror)", () => {
  it("emits <BOS> <Yyyyy> then songs, with set markers on ENTERING a set (never the opener)", () => {
    const tokens = tokenizeRun(model, {
      year: 2024,
      nights: [
        [
          { songId: sidA, setNumber: "1" },
          { songId: sidB, setNumber: "1" },
          { songId: sidC, setNumber: "2" },
          { songId: sidA, setNumber: "e" },
        ],
      ],
    });
    expect(tokens).toEqual([
      tok("<BOS>"),
      tok("<Y2024>"),
      model.tokenBySongId.get(sidA),
      model.tokenBySongId.get(sidB),
      tok("<SET2>"),
      model.tokenBySongId.get(sidC),
      tok("<ENCORE>"),
      model.tokenBySongId.get(sidA),
    ]);
  });

  it("joins nights with <NEWSHOW> — the residency no-repeat signal", () => {
    const tokens = tokenizeRun(model, {
      year: 2025,
      nights: [
        [{ songId: sidA, setNumber: "1" }],
        [{ songId: sidB, setNumber: "1" }],
      ],
    });
    expect(tokens).toEqual([
      tok("<BOS>"),
      tok("<Y2025>"),
      model.tokenBySongId.get(sidA),
      tok("<NEWSHOW>"),
      model.tokenBySongId.get(sidB),
    ]);
  });

  it("clamps unseen years into the vocab range (2026 rides <Y2025>)", () => {
    expect(yearTokenFor(model, 2026)).toBe(tok("<Y2025>"));
    expect(yearTokenFor(model, 2005)).toBe(tok("<Y2010>"));
  });

  it("maps ??? placeholders to 'Unknown' and out-of-vocab songs to <RARE>", () => {
    const tokens = tokenizeRun(model, {
      year: 2024,
      nights: [
        [
          { songId: null, setNumber: "1" },
          { songId: 999_999_999, setNumber: "1" },
        ],
      ],
    });
    expect(tokens[2]).toBe(model.idByToken.get("Unknown") ?? tok("<RARE>"));
    expect(tokens[3]).toBe(tok("<RARE>"));
  });

  it("truncates over-long runs to maxLen, preserving <BOS> <Yyyyy> + the newest window", () => {
    const night = Array.from({ length: 200 }, (_, i) => ({
      songId: songIds[i % songIds.length],
      setNumber: "1" as const,
    }));
    const tokens = tokenizeRun(model, { year: 2025, nights: [night] });
    expect(tokens).toHaveLength(model.config.maxLen);
    expect(tokens[0]).toBe(tok("<BOS>"));
    expect(tokens[1]).toBe(tok("<Y2025>"));
    const lastEntry = night[night.length - 1];
    expect(tokens[tokens.length - 1]).toBe(model.tokenBySongId.get(lastEntry.songId!));
  });
});

describe("nnPredict", () => {
  const input = {
    year: 2025,
    nights: [
      [
        { songId: sidA, setNumber: "1" as const },
        { songId: sidB, setNumber: "1" as const },
      ],
    ],
  };

  it("returns top-K real songs: descending probs, 1-based ranks, current song excluded", () => {
    const candidates = nnPredict(model, input, sidB, 10);
    expect(candidates).toHaveLength(10);
    for (const [i, c] of candidates.entries()) {
      expect(c.rank).toBe(i + 1);
      expect(c.songId).toBeGreaterThan(0);
      expect(c.songName.startsWith("<")).toBe(false);
      if (i > 0) expect(c.prob).toBeLessThanOrEqual(candidates[i - 1].prob);
    }
    expect(candidates.some((c) => c.songId === sidB)).toBe(false);
  });
});

describe("mergeNnIntoFan", () => {
  const fanOrb = (songId: number): PredictionCandidate => ({
    songId,
    songName: `song-${songId}`,
    score: 0.4,
    factors: {
      transitionProb: 0.4,
      decay: 1,
      rotation: 1,
      alreadyPlayed: 1,
      eraPrior: 1,
      backoffTier: "transition",
      hardSegueFlag: false,
    },
    reason: "seen 4× since 2024",
  });
  const nn = (songId: number, rank: number, prob: number): NnCandidate => ({
    songId,
    songName: `song-${songId}`,
    prob,
    rank,
  });

  it("annotates fan orbs the model also ranks; no extra when the top pick is already shown", () => {
    const fan = [fanOrb(1), fanOrb(2), fanOrb(3)];
    const merged = mergeNnIntoFan(fan, [nn(2, 1, 0.31), nn(9, 2, 0.11)], 1);
    expect(merged.annotations).toEqual([null, { nnProb: 0.31, nnRank: 1 }, null]);
    expect(merged.extras).toEqual([]); // rank-1 is in the fan; rank-2 does NOT qualify
  });

  it("spawns the flagged extra orb when the model's top pick is absent from the fan", () => {
    const fan = [fanOrb(1), fanOrb(2)];
    const merged = mergeNnIntoFan(fan, [nn(9, 1, 0.4), nn(1, 2, 0.2)], 1);
    expect(merged.extras).toEqual([nn(9, 1, 0.4)]);
    // Annotation depth is TOP_K, not extraFromTopRanks — song 1 (rank 2) still annotates.
    expect(merged.annotations).toEqual([{ nnProb: 0.2, nnRank: 2 }, null]);
  });

  it("top-3 rule: every unshown pick ranked ≤ N spawns a dot; shown picks annotate; rank N+1 never spawns", () => {
    const fan = [fanOrb(1), fanOrb(2)];
    const merged = mergeNnIntoFan(
      fan,
      [nn(9, 1, 0.4), nn(1, 2, 0.3), nn(8, 3, 0.2), nn(7, 4, 0.1)],
      3,
    );
    // Ranks 1 and 3 are unshown → dots, in rank order. Rank 2 is fan song 1 →
    // annotation only. Rank 4 is past the gate → never a dot.
    expect(merged.extras).toEqual([nn(9, 1, 0.4), nn(8, 3, 0.2)]);
    expect(merged.annotations).toEqual([{ nnProb: 0.3, nnRank: 2 }, null]);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { buildBingoContext, type BingoContext } from "../../src/bingo/context.ts";
import { deal } from "../../src/bingo/generate.ts";
import { estimateFill, nearMiss, type FillBand } from "../../src/bingo/estimate.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import {
  FREE_SENTINEL,
  bingoVibeValues,
  type BingoSquareDef,
  type BingoVibe,
  type MarkedCard,
  type MarkedSquare,
} from "../../src/bingo/types.ts";
import { bingoCard } from "../fixtures/bingo/synthetic.ts";

/**
 * The D-10 trust gate (Plan 16-01 Task 3): `estimateFill` is the CHEAP runtime
 * difficulty meter; `bingo-calibrate`'s Monte-Carlo is the EXPENSIVE build-time
 * gate. This test pins the cheap heuristic to the expensive gate so the meter
 * stays honest: over cards dealt with the SAME `sim-${vibe}-${i}` seeds the
 * calibration used, the mean predicted `expectedMarks` per vibe must track the
 * shipped mid-collection Monte-Carlo means (data/bingo-calibration-report.md)
 * within ±0.75, and the line-likelihood band ordering must match measured pLine
 * (chill > balanced > glory). `nearMiss` gets targeted geometry unit cases.
 */

// Committed mid-collection Monte-Carlo means (data/bingo-calibration-report.md,
// GATED table) — the literal targets, NOT a tautological self-comparison.
const MONTE_CARLO_MEAN_MARKS: Record<BingoVibe, number> = {
  chill: 7.89,
  balanced: 7.26,
  glory: 6.25,
};
const MEAN_TOLERANCE = 0.75;
const CARDS_PER_VIBE = 200;

// Resolve the committed artifacts relative to the repo root (cwd-independent).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
function loadArtifact<T>(relPath: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), "utf8")) as T;
}

let ctx: BingoContext;
let corpusVersion: string;

beforeAll(() => {
  const matrix = loadArtifact<Parameters<typeof buildBingoContext>[0]>(config.matrixArtifactPath);
  const archive = loadArtifact<Parameters<typeof buildRarityIndex>[0]>(config.dex.archiveArtifactPath);
  const albums = loadArtifact<Parameters<typeof buildBingoContext>[3]>(config.dex.dexAlbumsArtifactPath);
  const corpus = loadArtifact<{ generatedAt: string }>(config.corpusArtifactPath);
  const rarity = buildRarityIndex(archive);
  ctx = buildBingoContext(matrix, archive, rarity, albums);
  corpusVersion = corpus.generatedAt;
});

/** Mean `expectedMarks` + mean line-band rank over N deterministic cards for a vibe. */
function estimateVibe(vibe: BingoVibe): { meanMarks: number; meanBandRank: number } {
  const empty = new Set<number>();
  const bandRank = (b: FillBand): number => (b === "likely" ? 2 : b === "possible" ? 1 : 0);
  let markSum = 0;
  let rankSum = 0;
  for (let i = 0; i < CARDS_PER_VIBE; i++) {
    const card = deal(`sim-${vibe}-${i}`, vibe, ctx, empty, corpusVersion);
    const est = estimateFill(card, ctx, empty);
    expect(est.expectedMarks).toBeGreaterThanOrEqual(1);
    expect(est.expectedMarks).toBeLessThanOrEqual(16);
    expect(est.fillFraction).toBeCloseTo(est.expectedMarks / 16, 10);
    markSum += est.expectedMarks;
    rankSum += bandRank(est.lineLikelihood);
  }
  return { meanMarks: markSum / CARDS_PER_VIBE, meanBandRank: rankSum / CARDS_PER_VIBE };
}

describe("estimateFill — the D-10 Monte-Carlo trust gate", () => {
  it("mean expectedMarks per vibe tracks the calibration means within ±0.75", () => {
    for (const vibe of bingoVibeValues) {
      const { meanMarks } = estimateVibe(vibe);
      expect(
        Math.abs(meanMarks - MONTE_CARLO_MEAN_MARKS[vibe]),
        `${vibe}: estimateFill mean ${meanMarks.toFixed(3)} vs Monte-Carlo ${MONTE_CARLO_MEAN_MARKS[vibe]}`,
      ).toBeLessThanOrEqual(MEAN_TOLERANCE);
    }
  });

  it("line-likelihood band ordering matches measured pLine (chill > balanced > glory)", () => {
    const chill = estimateVibe("chill").meanBandRank;
    const balanced = estimateVibe("balanced").meanBandRank;
    const glory = estimateVibe("glory").meanBandRank;
    expect(chill).toBeGreaterThan(balanced);
    expect(balanced).toBeGreaterThan(glory);
  });
});

// ── nearMiss geometry unit cases ─────────────────────────────────────────────

const FREE_INDEX = config.bingo.freeIndex; // 5

/** Build a MarkedCard from explicit per-index defs + a set of marked indices. */
function buildMarked(
  defByIndex: Map<number, BingoSquareDef>,
  markedIndices: number[],
): MarkedCard {
  const marked = new Set<number>(markedIndices);
  const squares: MarkedSquare[] = [];
  let markedCount = 0;
  for (let index = 0; index < 16; index++) {
    let def: BingoSquareDef;
    let markedByPosition: number | null;
    if (index === FREE_INDEX) {
      def = { kind: "free" };
      markedByPosition = FREE_SENTINEL;
    } else {
      def = defByIndex.get(index) ?? { kind: "song", songId: 100 + index, label: `Square ${index}` };
      markedByPosition = marked.has(index) ? index : null;
    }
    if (markedByPosition !== null) markedCount += 1;
    squares.push({ def, index, markedByPosition });
  }
  return { squares, markedCount };
}

// A throwaway BingoCard passed only for signature parity (nearMiss reads `marked`).
const dummyCard = bingoCard();
const dummyCtx: BingoContext = {
  microtonalSongIds: new Set(),
  corpusGap: new Map(),
  albumSongIds: new Map(),
  jamVehicleSongIds: new Set(),
  eraPlayRate: new Map(),
};

describe("nearMiss — one-away geometry (D-13/14/15)", () => {
  it("a row with exactly one unmarked square returns that square as a line one-away", () => {
    // row0 = [0,1,2,3]; mark 0,1,2 (+free 5) → needs index 3. No other line is one-away.
    const defs = new Map<number, BingoSquareDef>([
      [3, { kind: "event", event: "microtonal", label: "Microtonal Song" }],
    ]);
    const marked = buildMarked(defs, [0, 1, 2]);
    const result = nearMiss(marked, dummyCard, dummyCtx, new Set());
    expect(result).not.toBeNull();
    expect(result?.neededSquareIndex).toBe(3);
    expect(result?.kind).toBe("line");
    expect(result?.bucket).toBe("microtonal");
  });

  it("two competing one-away lines return the higher-fire-rate needed square", () => {
    // row0 one-away needing index 1 (album, fire 0.801); row2 one-away needing
    // index 10 (neverCaught event, fire 0.15). All free-cell lines stay dead.
    const defs = new Map<number, BingoSquareDef>([
      [1, { kind: "album", albumUrl: "/albums/infest-the-rats-nest", label: "Infest the Rats' Nest" }],
      [10, { kind: "event", event: "neverCaught", label: "Never Caught" }],
    ]);
    // row0 mark {0,2,3} (needs 1); row2 mark {8,9,11} (needs 10); + free 5.
    const marked = buildMarked(defs, [0, 2, 3, 8, 9, 11]);
    const result = nearMiss(marked, dummyCard, dummyCtx, new Set());
    expect(result?.neededSquareIndex).toBe(1); // 0.801 > 0.15
    expect(result?.kind).toBe("line");
  });

  it("a 15-of-16 board returns the lone gap as a blackout one-away (crowns line)", () => {
    // Mark every index except 0 (free 5 already marked) → markedCount 15.
    const all = Array.from({ length: 16 }, (_u, i) => i).filter((i) => i !== 0 && i !== FREE_INDEX);
    const marked = buildMarked(new Map(), all);
    expect(marked.markedCount).toBe(15);
    const result = nearMiss(marked, dummyCard, dummyCtx, new Set());
    expect(result?.kind).toBe("blackout");
    expect(result?.neededSquareIndex).toBe(0);
  });

  it("a one-away four-corners returns null (corners/X are excluded, D-15)", () => {
    // corners = [0,3,12,15]; mark 3,12,15 (+free 5) → corners one-away, but NO
    // row/col/diagonal is one-away, so nearMiss reports nothing.
    const marked = buildMarked(new Map(), [3, 12, 15]);
    const result = nearMiss(marked, dummyCard, dummyCtx, new Set());
    expect(result).toBeNull();
  });
});

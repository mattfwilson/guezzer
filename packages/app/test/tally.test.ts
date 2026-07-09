import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { classifyOutcome, deriveTally } from "../src/show/scoring.ts";
import type { EntryOutcome } from "../src/db/db.ts";

describe("tally classifyOutcome: hit iff the song was in the shown fan (D-06/D-08)", () => {
  it("classifies a song present in the shown fan as a hit", () => {
    expect(classifyOutcome(101, [101, 102, 103])).toBe("hit");
  });

  it("classifies a song absent from the shown fan as a miss (search log)", () => {
    expect(classifyOutcome(999, [101, 102, 103])).toBe("miss");
  });

  it("classifies a null placeholder id (???) as a miss (D-08)", () => {
    expect(classifyOutcome(null, [101, 102, 103])).toBe("miss");
  });

  it("classifies against an empty fan as a miss", () => {
    expect(classifyOutcome(101, [])).toBe("miss");
  });
});

describe("deriveTally: single combined hit/miss tally (SHOW-09/D-07)", () => {
  const entry = (outcome: EntryOutcome) => ({ outcome });

  it("computes hits/total/pct over a mixed fixture", () => {
    const entries = [
      entry("hit"),
      entry("miss"),
      entry("hit"),
      entry("hit"),
    ];
    expect(deriveTally(entries)).toEqual({ hits: 3, total: 4, pct: 75 });
  });

  it("rounds pct to the nearest integer", () => {
    // 2/3 = 66.66… → 67
    expect(deriveTally([entry("hit"), entry("hit"), entry("miss")])).toEqual({
      hits: 2,
      total: 3,
      pct: 67,
    });
  });

  it("zero-state: 0/0 yields pct null (renders '—')", () => {
    expect(deriveTally([])).toEqual({ hits: 0, total: 0, pct: null });
  });

  it("all-miss yields pct 0, not null", () => {
    expect(deriveTally([entry("miss"), entry("miss")])).toEqual({
      hits: 0,
      total: 2,
      pct: 0,
    });
  });
});

describe("tally config surface: config.show + config.copy.show (single-config-file ethos)", () => {
  it("exposes the UI-SPEC tunable defaults", () => {
    expect(config.show.WEAK_FAN_THRESHOLD).toBe(0.15);
    expect(config.show.TRAIL_COMPRESS_AT).toBe(30);
    expect(config.show.ORB_COUNT_MIN).toBe(5);
    expect(config.show.ORB_COUNT_MAX).toBe(8);
    expect(config.show.ORB_DROP_SCORE).toBe(0.02);
    expect(config.show.ORB_MIN_DIAMETER).toBe(56);
    expect(config.show.TRAIL_VISIBLE_RECENT).toBe(4);
  });

  it("holds the Show-Mode copy strings verbatim (no hardcoded copy in components)", () => {
    expect(config.copy.show.startCta).toBe("Start Show");
    expect(config.copy.show.weakFanHeading).toBe("Low confidence");
    expect(config.copy.show.tallyZeroState).toBe("0/0 · —");
  });
});

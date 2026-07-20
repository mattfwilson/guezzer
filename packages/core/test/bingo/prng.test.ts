import { describe, expect, it } from "vitest";
import { mulberry32, xmur3 } from "../../src/bingo/prng.ts";

/**
 * Determinism contract for the string-seeded PRNG (D-21). These tests pin the
 * three load-bearing properties the deal depends on: uint32 seed range,
 * [0,1) float stream that advances, and byte-identical reproducibility for the
 * same seed string (with divergence for a different one).
 */
describe("xmur3", () => {
  it("returns a uint32 (>= 0, < 2^32)", () => {
    const next = xmur3("a balanced v1");
    for (let i = 0; i < 8; i++) {
      const value = next();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });

  it("is deterministic for the same string", () => {
    const a = xmur3("chill deal");
    const b = xmur3("chill deal");
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
});

describe("mulberry32", () => {
  it("returns floats in [0, 1)", () => {
    const rand = mulberry32(123456);
    for (let i = 0; i < 16; i++) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("advances the stream on consecutive calls", () => {
    const rand = mulberry32(987654);
    const first = rand();
    const second = rand();
    expect(first).not.toBe(second);
  });
});

describe("composed mulberry32(xmur3(seed)()) stream", () => {
  function draws(seed: string, n: number): number[] {
    const rand = mulberry32(xmur3(seed)());
    return Array.from({ length: n }, () => rand());
  }

  it("is byte-identical across two independent constructions of the same seed", () => {
    const first = draws("a balanced v1", 8);
    const second = draws("a balanced v1", 8);
    expect(second).toEqual(first);
  });

  it("diverges for a different seed string", () => {
    const a = draws("a balanced v1", 8);
    const b = draws("b balanced v1", 8);
    expect(a).not.toEqual(b);
  });
});

import { describe, expect, it } from "vitest";
import type { ArchiveShow } from "../../src/dex/archive-types.ts";
import { deriveTopOpeners, type TopOpener } from "../../src/dex/openers.ts";

/**
 * Small factory for a synthetic archive show. Mirrors search-archive.test.ts's
 * `show()` idiom. The opener is `sets.find(s => s.n === "1")?.songs[0]`, so the
 * caller controls the opener via the first song of the Set-1 array.
 */
function show(
  over: Partial<ArchiveShow> & Pick<ArchiveShow, "id" | "date">,
): ArchiveShow {
  return {
    venue: "Venue",
    city: "City",
    state: null,
    country: "USA",
    sets: [{ n: "1", songs: [999] }],
    ...over,
  };
}

/** A songs record covering every songId used in the fixtures below. */
const SONGS: Record<string, string> = {
  "10": "Recent Opener",
  "20": "Old Opener",
  "30": "Frequent Long-Ago Opener",
  "40": "Single Recent Opener",
  "50": "Once On Cutoff",
  "60": "Twice A Half-Life Ago",
  "70": "Tie Low Id",
  "80": "Tie High Id",
};

const HALF_LIFE = 365;

describe("deriveTopOpeners — recency-weighted opener ranking", () => {
  it("ranks the more recent of two once-opened songs higher (decayedWeight)", () => {
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [10] }] }),
      show({ id: 2, date: "2023-01-01", sets: [{ n: "1", songs: [20] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked.map((r) => r.songId)).toEqual([10, 20]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("follows summed decayed weight, not raw count (recent single beats frequent-but-old)", () => {
    const shows: ArchiveShow[] = [
      // Song 30 opened 3× long ago (each a tiny decayed weight).
      show({ id: 1, date: "2020-01-01", sets: [{ n: "1", songs: [30] }] }),
      show({ id: 2, date: "2020-01-01", sets: [{ n: "1", songs: [30] }] }),
      show({ id: 3, date: "2020-01-01", sets: [{ n: "1", songs: [30] }] }),
      // Song 40 opened once, recently (weight 1.0).
      show({ id: 4, date: "2025-01-01", sets: [{ n: "1", songs: [40] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked.map((r) => r.songId)).toEqual([40, 30]);
    const song30 = ranked.find((r) => r.songId === 30);
    expect(song30?.count).toBe(3);
  });

  it("tie-breaks equal summed score by raw opener count desc", () => {
    // Song 50: once on the cutoff → weight 1.0, count 1, score 1.0.
    // Song 60: twice exactly one half-life before the cutoff → 0.5 + 0.5 = 1.0,
    //   count 2, score 1.0. Equal score, so count desc wins → 60 first.
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [50] }] }),
      show({ id: 2, date: "2024-01-02", sets: [{ n: "1", songs: [60] }] }),
      show({ id: 3, date: "2024-01-02", sets: [{ n: "1", songs: [60] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked.map((r) => r.songId)).toEqual([60, 50]);
    expect(ranked[0].score).toBeCloseTo(ranked[1].score, 9);
  });

  it("tie-breaks equal score AND equal count by songId asc", () => {
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [80] }] }),
      show({ id: 2, date: "2025-01-01", sets: [{ n: "1", songs: [70] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked.map((r) => r.songId)).toEqual([70, 80]);
  });

  it("honors the limit (returns exactly the top N)", () => {
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [10] }] }),
      show({ id: 2, date: "2024-06-01", sets: [{ n: "1", songs: [20] }] }),
      show({ id: 3, date: "2023-06-01", sets: [{ n: "1", songs: [30] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 2,
    });
    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.songId)).toEqual([10, 20]);
  });

  it("skips shows with no Set 1 or an empty Set-1 songs array (never throws / NaN)", () => {
    const shows: ArchiveShow[] = [
      // No set labelled "1" — only an encore.
      show({ id: 1, date: "2025-01-01", sets: [{ n: "e", songs: [10] }] }),
      // Set 1 present but empty songs.
      show({ id: 2, date: "2025-01-01", sets: [{ n: "1", songs: [] }] }),
      // No sets at all.
      show({ id: 3, date: "2025-01-01", sets: [] }),
      // A valid opener so the result is non-trivial.
      show({ id: 4, date: "2025-01-01", sets: [{ n: "1", songs: [40] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked.map((r) => r.songId)).toEqual([40]);
    expect(ranked.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it("falls back to a stable placeholder name when the opener songId is absent from songs", () => {
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [12345] }] }),
    ];
    const ranked = deriveTopOpeners(shows, SONGS, {
      asOfDate: "2025-01-01",
      halfLifeDays: HALF_LIFE,
      limit: 5,
    });
    expect(ranked[0].songName).toBe("Song 12345");
    expect(ranked[0].songName).not.toContain("undefined");
  });

  it("is pure — same args in, deep-equal output out (no Date.now)", () => {
    const shows: ArchiveShow[] = [
      show({ id: 1, date: "2025-01-01", sets: [{ n: "1", songs: [10] }] }),
      show({ id: 2, date: "2024-01-01", sets: [{ n: "1", songs: [20] }] }),
    ];
    const opts = { asOfDate: "2025-01-01", halfLifeDays: HALF_LIFE, limit: 5 };
    const first: TopOpener[] = deriveTopOpeners(shows, SONGS, opts);
    const second: TopOpener[] = deriveTopOpeners(shows, SONGS, opts);
    expect(second).toEqual(first);
  });
});

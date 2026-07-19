import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import { deriveRecap } from "../../src/dex/recap.ts";
import { buildRecapShareStats, buildShareStats } from "../../src/dex/share-stats.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
  trackedEntry,
  trackedShow,
} from "../fixtures/dex/synthetic.ts";

/** The fixed six-tier row order both cards render (least → most rare). */
const TIER_ROW_ORDER = ["debut", "common", "uncommon", "rare", "epic", "legendary"] as const;

/**
 * Base archive — catalog {10,20,30,40,50,60} (6 songs, the completion
 * denominator). Setlists:
 *   show 100 (2020-01-01): 10,20,30   (venue "The Venue")
 *   show 200 (2020-02-01): 10,40 | e:50
 *   show 300 (2020-03-01): 20,60
 * playCounts → 10:2 20:2 30:1 40:1 50:1 60:1 over 3 shows.
 *
 * With tie-inclusive playCount bands (legendary=1, epic=2–3, rare=4–8, …):
 * 30/40/50/60 (playCount 1) = legendary; 10/20 (playCount 2) = epic. The old
 * min-plays cap is retired, so a single-play song is legendary now.
 */
function baseArchive(): ArchiveArtifact {
  return syntheticArchive([
    archiveShow({ id: 100, date: "2020-01-01", venue: "The Venue", sets: [{ n: "1", songs: [10, 20, 30] }] }),
    archiveShow({
      id: 200,
      date: "2020-02-01",
      sets: [
        { n: "1", songs: [10, 40] },
        { n: "e", songs: [50] },
      ],
    }),
    archiveShow({ id: 300, date: "2020-03-01", sets: [{ n: "1", songs: [20, 60] }] }),
  ]);
}

const archive = baseArchive();
const rarity = buildRarityIndex(archive);
const albums = syntheticAlbums();

function derive(snapshot: Parameters<typeof deriveDex>[0]) {
  return deriveDex(snapshot, archive, albums, rarity);
}

describe("buildShareStats — pure brag-card assembly (SHAR-02)", () => {
  it("pins every ShareCardData field for a fixture dex", () => {
    // Attend show 100 → caught {10,20,30}; tiers 10/20 epic (playCount 2), 30 legendary (playCount 1).
    const dex = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    const card = buildShareStats(dex, archive);

    expect(card.scope).toBe("collection");
    expect(card.completionPct).toBe(50);
    expect(card.caught).toBe(3);
    expect(card.total).toBe(6);
    expect(card.showCount).toBe(1);

    // Rarest = lowest playCount among caught {10:2,20:2,30:1} → song 30 (legendary).
    expect(card.rarestCatch).toEqual({ songName: "Song 30", tier: "legendary" });

    // Tier breakdown — ALL six rows in fixed order (0 where none): epic×2, legendary×1.
    expect(card.tierBreakdown.map((r) => r.tier)).toEqual([...TIER_ROW_ORDER]);
    expect(card.tierBreakdown).toEqual([
      { tier: "debut", count: 0 },
      { tier: "common", count: 0 },
      { tier: "uncommon", count: 0 },
      { tier: "rare", count: 0 },
      { tier: "epic", count: 2 },
      { tier: "legendary", count: 1 },
    ]);

    // Latest show = newest attended night; venue resolved from the archive.
    expect(card.latestShow).toEqual({ date: "2020-01-01", venue: "The Venue" });
  });

  it("yields a valid card for a zero-catch dex (0%, all-zero six-row breakdown, null rarest — no NaN)", () => {
    const dex = derive(dexSnapshot());
    const card = buildShareStats(dex, archive);

    expect(card.completionPct).toBe(0);
    expect(Number.isNaN(card.completionPct)).toBe(false);
    expect(card.caught).toBe(0);
    expect(card.total).toBe(6);
    expect(card.showCount).toBe(0);
    expect(card.rarestCatch).toBeNull();
    // Still six rows, every count 0 — a stable, aligned layout.
    expect(card.tierBreakdown).toEqual([
      { tier: "debut", count: 0 },
      { tier: "common", count: 0 },
      { tier: "uncommon", count: 0 },
      { tier: "rare", count: 0 },
      { tier: "epic", count: 0 },
      { tier: "legendary", count: 0 },
    ]);
    expect(card.latestShow).toBeNull();
  });
});

describe("buildRecapShareStats — pure PER-SHOW brag-card assembly (plan 10-02)", () => {
  // A night catching 10 (epic, playCount 2), 30 + 50 (legendary, playCount 1),
  // 777 (a debut candidate — absent from the archive/rarity index), one ???
  // placeholder, and a sentinel row (songId 1) that MUST be excluded.
  function nightSnapshot(sessionId: string) {
    return dexSnapshot({
      trackedShows: [trackedShow({ sessionId, date: "2020-09-01", showId: null })],
      trackedEntries: [
        trackedEntry({ sessionId, songId: 10, songName: "Song 10", setNumber: "1", outcome: "hit", position: 1 }),
        trackedEntry({ sessionId, songId: 30, songName: "Song 30", setNumber: "1", outcome: "hit", position: 2 }),
        trackedEntry({ sessionId, songId: 50, songName: "Song 50", setNumber: "2", outcome: "hit", position: 3 }),
        trackedEntry({ sessionId, songId: 777, songName: "Debut Song", setNumber: "2", outcome: "hit", position: 4 }),
        trackedEntry({ sessionId, songId: null, songName: "???", setNumber: "e", outcome: "miss", isPlaceholder: true, position: 5 }),
        trackedEntry({ sessionId, songId: 1, songName: "Sentinel", setNumber: "e", outcome: "miss", position: 6 }),
      ],
    });
  }

  it("scopes every field to the one night, reusing deriveRecap's numbers", () => {
    const recap = deriveRecap("night", nightSnapshot("night"), archive, albums, rarity);
    const card = buildRecapShareStats(recap, archive, { date: "2020-09-01", venue: "The Forum" });

    expect(card.scope).toBe("show");
    // Distinct real songs: 10, 30, 50, 777 (placeholder + sentinel excluded).
    expect(card.songsCaught).toBe(4);
    expect(card.show).toEqual({ date: "2020-09-01", venue: "The Forum" });

    // Six-tier rows in fixed order: 777 → debut, 10 → epic, 30+50 → legendary.
    expect(card.tierBreakdown.map((r) => r.tier)).toEqual([...TIER_ROW_ORDER]);
    expect(card.tierBreakdown).toEqual([
      { tier: "debut", count: 1 },
      { tier: "common", count: 0 },
      { tier: "uncommon", count: 0 },
      { tier: "rare", count: 0 },
      { tier: "epic", count: 1 },
      { tier: "legendary", count: 2 },
    ]);

    // songsCaught always equals the sum of the six breakdown counts.
    expect(card.tierBreakdown.reduce((s, r) => s + r.count, 0)).toBe(card.songsCaught);

    // Rarest-of-night = the recap's pick (first lowest-playCount song → 30, legendary).
    expect(card.rarestCatch).toEqual({ songName: "Song 30", tier: "legendary" });
  });

  it("carries a null venue through (date stays honest)", () => {
    const recap = deriveRecap("n2", nightSnapshot("n2"), archive, albums, rarity);
    const card = buildRecapShareStats(recap, archive, { date: "2020-09-01", venue: null });
    expect(card.show).toEqual({ date: "2020-09-01", venue: null });
  });

  it("yields a valid card for a placeholder-only night (0 caught, all-zero rows, null rarest)", () => {
    const snapshot = dexSnapshot({
      trackedShows: [trackedShow({ sessionId: "empty", date: "2020-09-02", showId: null })],
      trackedEntries: [
        trackedEntry({ sessionId: "empty", songId: null, songName: "???", setNumber: "1", outcome: "miss", isPlaceholder: true, position: 1 }),
      ],
    });
    const recap = deriveRecap("empty", snapshot, archive, albums, rarity);
    const card = buildRecapShareStats(recap, archive, { date: "2020-09-02", venue: null });

    expect(card.songsCaught).toBe(0);
    expect(card.rarestCatch).toBeNull();
    expect(card.tierBreakdown).toEqual([
      { tier: "debut", count: 0 },
      { tier: "common", count: 0 },
      { tier: "uncommon", count: 0 },
      { tier: "rare", count: 0 },
      { tier: "epic", count: 0 },
      { tier: "legendary", count: 0 },
    ]);
  });
});

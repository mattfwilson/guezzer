import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import { buildShareStats } from "../../src/dex/share-stats.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
} from "../fixtures/dex/synthetic.ts";

/**
 * Base archive — catalog {10,20,30,40,50,60} (6 songs, the completion
 * denominator). Setlists:
 *   show 100 (2020-01-01): 10,20,30   (venue "The Venue")
 *   show 200 (2020-02-01): 10,40 | e:50
 *   show 300 (2020-03-01): 20,60
 * playCounts → 10:2 20:2 30:1 40:1 50:1 60:1 over 3 shows.
 *
 * With config quantiles { legendary: 0.05, rare: 0.20, uncommon: 0.50 } over
 * the 6 played songs (RARITY_MIN_PLAYS 3): rank0=30 would be legendary but is
 * capped to rare (playCount 1 < 3); 40=rare; 50=uncommon; 10/20/60=common.
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
    // Attend show 100 → caught {10,20,30}; tiers 10/20 common, 30 rare (capped).
    const dex = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    const card = buildShareStats(dex, archive);

    expect(card.completionPct).toBe(50);
    expect(card.caught).toBe(3);
    expect(card.total).toBe(6);
    expect(card.showCount).toBe(1);

    // Rarest = lowest corpus play rate among caught {10:2,20:2,30:1} → song 30.
    expect(card.rarestCatch).toEqual({ songName: "Song 30", tier: "rare" });

    // Tier breakdown over CAUGHT songs, scarcest-first: rare×1, common×2.
    expect(card.tierBreakdown).toEqual([
      { tier: "rare", count: 1 },
      { tier: "common", count: 2 },
    ]);

    // Latest show = newest attended night; venue resolved from the archive.
    expect(card.latestShow).toEqual({ date: "2020-01-01", venue: "The Venue" });
  });

  it("yields a valid card for a zero-catch dex (0%, empty breakdown, null rarest — no NaN)", () => {
    const dex = derive(dexSnapshot());
    const card = buildShareStats(dex, archive);

    expect(card.completionPct).toBe(0);
    expect(Number.isNaN(card.completionPct)).toBe(false);
    expect(card.caught).toBe(0);
    expect(card.total).toBe(6);
    expect(card.showCount).toBe(0);
    expect(card.rarestCatch).toBeNull();
    expect(card.tierBreakdown).toEqual([]);
    expect(card.latestShow).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import { compareDexes } from "../../src/dex/compare.ts";
import {
  deriveSharedProgress,
  parseSharedProgress,
  reconstructDexStats,
  selectRarestCaught,
  type SharedProgress,
} from "../../src/dex/shared-progress.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
} from "../fixtures/dex/synthetic.ts";

/**
 * Base archive — catalog {10,20,30,40,50,60} (6 songs = the completion denominator).
 * Setlists:
 *   show 100 (2020-01-01): 10,20,30
 *   show 200 (2020-02-01): 10,40 | e:50
 *   show 300 (2020-03-01): 20,60
 * playCounts → 10:2 20:2 30:1 40:1 50:1 60:1 over 3 shows.
 *
 * Tie-inclusive playCount bands (legendary=1, epic=2–3, …): 30/40/50/60 (pc 1) =
 * legendary; 10/20 (pc 2) = epic. Same fixture as share-stats.test.ts.
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

// mine attends show 100 → caught {10,20,30}; tiers 10/20 epic, 30 legendary.
const mineSnapshot = dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] });
// theirs attends show 200 → caught {10,40,50}; tiers 10 epic, 40/50 legendary; album alpha partial (10 caught, 20 not).
const theirsSnapshot = dexSnapshot({ attendedShows: [attendedShow({ show_id: 200, showDate: "2020-02-01" })] });

/** The hand-computed SharedProgress for `theirs`. */
const expectedTheirsPayload: SharedProgress = {
  v: 1,
  completion: { caught: 3, total: 6, pct: 50 },
  showCount: 1,
  // Rarest = lowest playCount among caught {10:2,40:1,50:1} → tie on pc1 → lowest songId 40 (legendary).
  rarest: { songId: 40, tier: "legendary" },
  tierCounts: { common: 0, uncommon: 0, rare: 0, epic: 1, legendary: 2 },
  perAlbum: [
    { key: "/albums/alpha", caught: 1, total: 2 },
    { key: "covers", caught: 0, total: 0 },
    { key: "miscellaneous", caught: 0, total: 0 },
  ],
  caughtSongIds: [10, 40, 50],
};

describe("deriveSharedProgress — pure DexStats → Option-B payload (PROG-01)", () => {
  it("projects a fixture dex to the hand-computed SharedProgress", () => {
    const payload = deriveSharedProgress(derive(theirsSnapshot));
    expect(payload).toEqual(expectedTheirsPayload);
  });

  it("caughtSongIds equals the sightings>0 set, sorted ascending, and === completion.caught", () => {
    const theirs = derive(theirsSnapshot);
    const payload = deriveSharedProgress(theirs);

    // caughtSongIds is exactly the sightings>0 set.
    const sightingSet = new Set<number>();
    for (const stat of theirs.perSong.values()) if (stat.sightings > 0) sightingSet.add(stat.songId);
    expect(new Set(payload.caughtSongIds)).toEqual(sightingSet);

    // Sorted ascending, no duplicates.
    expect(payload.caughtSongIds).toEqual([...payload.caughtSongIds].sort((a, b) => a - b));
    // completion.caught === caughtSongIds.length (both derive from the same dex).
    expect(payload.completion.caught).toBe(payload.caughtSongIds.length);
  });
});

describe("round-trip fidelity — reconstruction reaches the UNCHANGED compareDexes (PROG-06/07)", () => {
  it("compareDexes(mine, reconstruct(derive(theirs))) deep-equals compareDexes(mine, theirs)", () => {
    const mine = derive(mineSnapshot);
    const theirs = derive(theirsSnapshot);

    const direct = compareDexes(mine, theirs);
    const viaReconstruction = compareDexes(
      mine,
      reconstructDexStats(deriveSharedProgress(theirs), rarity),
    );

    // Whole payload deep-equal: both diff lists AND the theirs column.
    expect(viaReconstruction).toEqual(direct);
    // Guard the pieces explicitly so a regression names what drifted.
    expect(viaReconstruction.onlyMine).toEqual(direct.onlyMine);
    expect(viaReconstruction.onlyTheirs).toEqual(direct.onlyTheirs);
    expect(viaReconstruction.shared).toEqual(direct.shared);
    expect(viaReconstruction.columns.theirs).toEqual(direct.columns.theirs);
  });
});

describe("reconstructDexStats — minimal DexStats for compareDexes (PROG-06)", () => {
  it("caught set equals payload caughtSongIds and stubs every field compareDexes never reads", () => {
    const payload = deriveSharedProgress(derive(theirsSnapshot));
    const reconstructed = reconstructDexStats(payload, rarity);

    // Caught set (perSong keys) equals the payload caughtSongIds.
    expect([...reconstructed.perSong.keys()].sort((a, b) => a - b)).toEqual(payload.caughtSongIds);

    // Stubbed fields — none of which compareDexes reads.
    expect(reconstructed.neverSeen).toEqual([]);
    for (const stat of reconstructed.perSong.values()) {
      expect(stat.personalGap).toBeNull();
      expect(stat.lastSeenDate).toBeNull();
      expect(stat.sightings).toBe(1); // boolean-equivalent caught flag (Pitfall 1 / T-19-02)
    }
    // Tiers resolved from the LOCAL rarity index (D-13).
    expect(reconstructed.perSong.get(40)?.tier).toBe("legendary");
    expect(reconstructed.perSong.get(10)?.tier).toBe("epic");
  });
});

describe("perAlbum — array serialization round-trips back to a Map (PROG-07, Pitfall 6)", () => {
  it("reconstructed perAlbum equals the original derived perAlbum entry-for-entry", () => {
    const theirs = derive(theirsSnapshot);
    const reconstructed = reconstructDexStats(deriveSharedProgress(theirs), rarity);
    expect(reconstructed.perAlbum).toEqual(theirs.perAlbum);
    // The original derives a partial-completion album (10 caught of {10,20}).
    expect(theirs.perAlbum.get("/albums/alpha")).toEqual({ caught: 1, total: 2 });
  });
});

describe("rarest showcase — selectRarestCaught top-N rarest-first (PROG-08)", () => {
  it("returns ≤N entries, rarest-tier-first with songId tie-break", () => {
    const payload = deriveSharedProgress(derive(theirsSnapshot));

    // caught {10 epic, 40 legendary, 50 legendary} → legendary(40,50) before epic(10).
    expect(selectRarestCaught(payload.caughtSongIds, rarity, 5)).toEqual([
      { songId: 40, tier: "legendary" },
      { songId: 50, tier: "legendary" },
      { songId: 10, tier: "epic" },
    ]);

    // limit truncates to the top-N.
    expect(selectRarestCaught(payload.caughtSongIds, rarity, 2)).toEqual([
      { songId: 40, tier: "legendary" },
      { songId: 50, tier: "legendary" },
    ]);
    // limit 0 → empty.
    expect(selectRarestCaught(payload.caughtSongIds, rarity, 0)).toEqual([]);
  });
});

describe("parseSharedProgress — untrusted read-boundary validation (D-19, T-19-01)", () => {
  it("accepts a valid payload and deep-equals it", () => {
    const payload = deriveSharedProgress(derive(theirsSnapshot));
    expect(parseSharedProgress(payload)).toEqual(payload);
    expect(parseSharedProgress(expectedTheirsPayload)).toEqual(expectedTheirsPayload);
  });

  it("rejects malformed / hostile summaries with null (never throws)", () => {
    const payload = deriveSharedProgress(derive(theirsSnapshot));

    // Missing version guard.
    const { v: _v, ...withoutVersion } = payload;
    expect(parseSharedProgress(withoutVersion)).toBeNull();

    // pct out of [0,100].
    expect(parseSharedProgress({ ...payload, completion: { ...payload.completion, pct: 150 } })).toBeNull();

    // Negative caught count.
    expect(parseSharedProgress({ ...payload, completion: { ...payload.completion, caught: -1 } })).toBeNull();

    // Non-integer songId.
    expect(parseSharedProgress({ ...payload, caughtSongIds: [1.5] })).toBeNull();

    // Oversized caughtSongIds array (past the catalog ceiling).
    const oversized = Array.from({ length: 1001 }, (_, i) => i);
    expect(parseSharedProgress({ ...payload, caughtSongIds: oversized })).toBeNull();

    // Unknown extra key (strictObject).
    expect(parseSharedProgress({ ...payload, display_name: "hacker" })).toBeNull();

    // Wholly wrong shapes.
    expect(parseSharedProgress(null)).toBeNull();
    expect(parseSharedProgress("nope")).toBeNull();
  });
});

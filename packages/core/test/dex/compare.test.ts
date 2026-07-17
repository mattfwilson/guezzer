import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import { compareDexes } from "../../src/dex/compare.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
} from "../fixtures/dex/synthetic.ts";

/**
 * compareDexes (SHAR-01, D-17, plan 06-10) — the pure friend-file DIFF. It never
 * merges: it takes two already-derived DexStats and returns set-diff lists
 * (onlyMine / onlyTheirs / shared, keyed STRICTLY by songId, tier-sorted
 * legendary-first) plus You-vs-them stat columns. Inputs are read-only.
 *
 * Base archive — catalog {10,20,30,40,50,60} over 3 shows:
 *   show 100 (2020-01-01): 10,20,30
 *   show 200 (2020-02-01): 10,40 | e:50
 *   show 300 (2020-03-01): 20,60
 * playCounts → 10:2 20:2 30:1 40:1 50:1 60:1.
 * Tiers (tie-inclusive playCount bands legendary=1 / epic=2–3 / rare=4–8 / …):
 * 30,40,50,60 (playCount 1) = legendary; 10,20 (playCount 2) = epic. Rarest-first
 * ordering (rank legendary 0 < epic 1) then songId tie-break.
 */
function baseArchive(): ArchiveArtifact {
  return syntheticArchive([
    archiveShow({ id: 100, date: "2020-01-01", sets: [{ n: "1", songs: [10, 20, 30] }] }),
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

describe("compareDexes — pure friend-file diff (SHAR-01, D-17)", () => {
  it("pins onlyMine / onlyTheirs / shared for a hand-built pair, tier-sorted", () => {
    // mine caught show 100 → {10,20,30}; theirs caught show 300 → {20,60}.
    const mine = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    const theirs = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 300, showDate: "2020-03-01" })] }));

    const result = compareDexes(mine, theirs);

    // Diff lists are songId-keyed set differences, sorted rarest-tier-first then
    // songId: onlyMine {10 epic, 30 legendary} → [30,10]; onlyTheirs {60}; shared {20}.
    expect(result.onlyMine).toEqual([30, 10]);
    expect(result.onlyTheirs).toEqual([60]);
    expect(result.shared).toEqual([20]);
  });

  it("reports You-vs-them stat columns (completion, caught, shows, per-tier)", () => {
    const mine = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    const theirs = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 300, showDate: "2020-03-01" })] }));

    const result = compareDexes(mine, theirs);

    expect(result.columns.mine).toEqual({
      completion: 50,
      caught: 3,
      shows: 1,
      // caught {10 epic, 20 epic, 30 legendary}
      tierCounts: { common: 0, uncommon: 0, rare: 0, epic: 2, legendary: 1 },
    });
    expect(result.columns.theirs).toEqual({
      completion: 33,
      caught: 2,
      shows: 1,
      // caught {20 epic, 60 legendary}
      tierCounts: { common: 0, uncommon: 0, rare: 0, epic: 1, legendary: 1 },
    });
  });

  it("is pure — never mutates either input DexStats (deep-equal before/after)", () => {
    const mine = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    const theirs = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 300, showDate: "2020-03-01" })] }));
    const mineBefore = structuredClone(mine);
    const theirsBefore = structuredClone(theirs);

    compareDexes(mine, theirs);

    expect(mine).toEqual(mineBefore);
    expect(theirs).toEqual(theirsBefore);
  });

  it("handles empty-vs-populated (mine caught nothing)", () => {
    const mine = derive(dexSnapshot({}));
    const theirs = derive(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));

    const result = compareDexes(mine, theirs);

    expect(result.onlyMine).toEqual([]);
    expect(result.shared).toEqual([]);
    // theirs {10 epic, 20 epic, 30 legendary} → [30,10,20] (legendary first, then songId).
    expect(result.onlyTheirs).toEqual([30, 10, 20]);
    expect(result.columns.mine).toEqual({
      completion: 0,
      caught: 0,
      shows: 0,
      tierCounts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    });
  });
});

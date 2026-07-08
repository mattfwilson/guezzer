import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  generateTuningTags,
  mergeTuningTags,
  tuningTagsFileSchema,
  type AlbumRow,
  type CatalogSong,
  type TuningTagEntry,
} from "../src/ingest/tuning-tags.ts";

function albumRow(
  overrides: Partial<AlbumRow> & Pick<AlbumRow, "album_title" | "song_url" | "song_name">,
): AlbumRow {
  return { artist_id: 1, ...overrides };
}

describe("generateTuningTags", () => {
  it("Test 1: a song whose album (joined via slug) is in config.microtonalAlbums gets family microtonal, needsReview false, source album-default", () => {
    const catalog: CatalogSong[] = [
      { songId: 101, name: "Rattlesnake", slug: "rattlesnake", isCover: false },
    ];
    const albumRows: AlbumRow[] = [
      albumRow({
        album_title: config.microtonalAlbums[0],
        song_url: "/song/rattlesnake",
        song_name: "Rattlesnake",
      }),
    ];

    const [entry] = generateTuningTags(catalog, albumRows);

    expect(entry).toEqual<TuningTagEntry>({
      songId: 101,
      name: "Rattlesnake",
      family: "microtonal",
      needsReview: false,
      source: "album-default",
    });
  });

  it("Test 2: a song with no album match (live-only/unmatched slug) gets family standard, needsReview true", () => {
    const catalog: CatalogSong[] = [
      { songId: 202, name: "Live-Only Jam", slug: "live-only-jam", isCover: false },
    ];

    const [entry] = generateTuningTags(catalog, []);

    expect(entry.family).toBe("standard");
    expect(entry.needsReview).toBe(true);
  });

  it("Test 3: conflicting multi-album defaults get the majority/first default + needsReview true; agreeing multi-album defaults are not flagged", () => {
    const conflictingCatalog: CatalogSong[] = [
      { songId: 303, name: "Ambiguous Song", slug: "ambiguous-song", isCover: false },
    ];
    // First-encountered album ("Nonagon Infinity") defaults to "standard";
    // the second ("Flying Microtonal Banana" — config.microtonalAlbums[0])
    // defaults to "microtonal". Conflicting, 1-vs-1 tie -> first wins.
    const conflictingAlbumRows: AlbumRow[] = [
      albumRow({
        album_title: "Nonagon Infinity",
        song_url: "/song/ambiguous-song",
        song_name: "Ambiguous Song",
      }),
      albumRow({
        album_title: config.microtonalAlbums[0],
        song_url: "/song/ambiguous-song",
        song_name: "Ambiguous Song",
      }),
    ];
    const [conflictingEntry] = generateTuningTags(conflictingCatalog, conflictingAlbumRows);
    expect(conflictingEntry.family).toBe("standard");
    expect(conflictingEntry.needsReview).toBe(true);

    const agreeingCatalog: CatalogSong[] = [
      { songId: 304, name: "Agreeing Song", slug: "agreeing-song", isCover: false },
    ];
    // Both matched albums are microtonal-seed albums -> agreeing defaults.
    const agreeingAlbumRows: AlbumRow[] = [
      albumRow({
        album_title: config.microtonalAlbums[0],
        song_url: "/song/agreeing-song",
        song_name: "Agreeing Song",
      }),
      albumRow({
        album_title: config.microtonalAlbums[1],
        song_url: "/song/agreeing-song",
        song_name: "Agreeing Song",
      }),
    ];
    const [agreeingEntry] = generateTuningTags(agreeingCatalog, agreeingAlbumRows);
    expect(agreeingEntry.family).toBe("microtonal");
    expect(agreeingEntry.needsReview).toBe(false);
  });

  it("Test 4: a cover song gets needsReview: true (original-artist material — owner judges the live tuning)", () => {
    const catalog: CatalogSong[] = [
      { songId: 404, name: "Some Cover", slug: "some-cover", isCover: true },
    ];
    const albumRows: AlbumRow[] = [
      albumRow({
        album_title: "Nonagon Infinity",
        song_url: "/song/some-cover",
        song_name: "Some Cover",
      }),
    ];

    const [entry] = generateTuningTags(catalog, albumRows);

    expect(entry.needsReview).toBe(true);
  });
});

describe("mergeTuningTags", () => {
  it("Test 5 (D-04, Pitfall 6): a hand-edited existing entry survives merge BYTE-FOR-BYTE identical; only songIds absent from existing are appended", () => {
    const handEdited: TuningTagEntry = {
      songId: 501,
      name: "Hand-Tagged Song",
      family: "cs-standard",
      source: "hand-tagged",
      needsReview: false,
    };
    const existing: TuningTagEntry[] = [handEdited];
    const generated: TuningTagEntry[] = [
      // A regeneration would normally re-derive songId 501 as "standard" —
      // the merge must ignore this entirely and keep the hand-edit.
      {
        songId: 501,
        name: "Hand-Tagged Song",
        family: "standard",
        needsReview: true,
        source: "album-default",
      },
      {
        songId: 502,
        name: "New Song",
        family: "standard",
        needsReview: true,
        source: "album-default",
      },
    ];

    const { merged, added } = mergeTuningTags(existing, generated);

    const survived = merged.find((entry) => entry.songId === 501);
    expect(survived).toBe(handEdited); // reference-identical — never rewritten
    expect(survived).toEqual(handEdited); // deep-equal
    expect(JSON.stringify(survived)).toBe(JSON.stringify(handEdited)); // JSON.stringify-equal

    expect(added).toEqual(["New Song"]);
    expect(merged.map((entry) => entry.songId).sort((a, b) => a - b)).toEqual([501, 502]);
  });
});

describe("tuningTagsFileSchema", () => {
  it("Test 6a: rejects family \"drop-d\" (vocabulary is closed: standard, cs-standard, microtonal, other — D-03)", () => {
    const bad = {
      schemaVersion: 1,
      entries: [
        { songId: 1, name: "X", family: "drop-d", needsReview: false, source: "hand-tagged" },
      ],
    };

    expect(() => tuningTagsFileSchema.parse(bad)).toThrow();
  });

  it("Test 6b: rejects an entries array with a duplicate songId", () => {
    const bad = {
      schemaVersion: 1,
      entries: [
        { songId: 1, name: "X", family: "standard", needsReview: false, source: "hand-tagged" },
        { songId: 1, name: "Y", family: "standard", needsReview: false, source: "hand-tagged" },
      ],
    };

    expect(() => tuningTagsFileSchema.parse(bad)).toThrow();
  });
});

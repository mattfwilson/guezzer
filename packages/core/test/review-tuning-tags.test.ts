import { describe, expect, it } from "vitest";
import {
  deriveReview,
  formatReviewReport,
  formatReviewSummary,
} from "../src/cli/review-tuning-tags.ts";
import type { AlbumRow, CatalogSong, TuningTagEntry } from "../src/ingest/tuning-tags.ts";

/** Mirrors tuning-tags.test.ts's albumRow() idiom: KGLW studio row unless overridden. */
function albumRow(
  overrides: Partial<AlbumRow> & Pick<AlbumRow, "album_title" | "song_url" | "song_name">,
): AlbumRow {
  return { artist_id: 1, islive: 0, ...overrides };
}

function catalogSong(overrides: Partial<CatalogSong> & Pick<CatalogSong, "songId" | "name">): CatalogSong {
  return {
    slug: overrides.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    isCover: false,
    ...overrides,
  };
}

function tag(overrides: Partial<TuningTagEntry> & Pick<TuningTagEntry, "songId" | "name" | "family">): TuningTagEntry {
  return {
    needsReview: false,
    source: "album-default",
    ...overrides,
  };
}

describe("deriveReview — canonical spot-checks", () => {
  it("(i) a correct spot-check yields ok:true", () => {
    // "12 Bar Bruise" is a canonical spot-check expecting standard.
    const catalog = [catalogSong({ songId: 2, name: "12 Bar Bruise", slug: "12-bar-bruise" })];
    const albums = [
      albumRow({ album_title: "12 Bar Bruise", song_url: "/song/12-bar-bruise", song_name: "12 Bar Bruise" }),
    ];
    const tags = [tag({ songId: 2, name: "12 Bar Bruise", family: "standard" })];

    const result = deriveReview(catalog, albums, tags);
    const row = result.spotChecks.find((s) => s.name === "12 Bar Bruise");
    expect(row).toBeDefined();
    expect(row?.actual).toBe("standard");
    expect(row?.ok).toBe(true);
  });

  it("(ii) a deliberately-wrong family yields ok:false", () => {
    // "Doom City" canonically expects microtonal; feed it standard.
    const catalog = [catalogSong({ songId: 50, name: "Doom City", slug: "doom-city" })];
    const albums = [
      albumRow({ album_title: "Quarters", song_url: "/song/doom-city", song_name: "Doom City" }),
    ];
    const tags = [tag({ songId: 50, name: "Doom City", family: "standard" })];

    const result = deriveReview(catalog, albums, tags);
    const row = result.spotChecks.find((s) => s.name === "Doom City");
    expect(row?.actual).toBe("standard");
    expect(row?.ok).toBe(false);
  });

  it("(iii) a MISSING canonical name is flagged ok:false", () => {
    // Empty catalog -> every canonical spot-check is MISSING.
    const result = deriveReview([], [], []);
    const missing = result.spotChecks.find((s) => s.name === "Rattlesnake");
    expect(missing?.actual).toBe("MISSING");
    expect(missing?.ok).toBe(false);
    // Every canonical name is surfaced (nothing silently skipped).
    expect(result.spotChecks.length).toBeGreaterThanOrEqual(10);
    expect(result.spotChecks.every((s) => s.actual === "MISSING" && s.ok === false)).toBe(true);
  });
});

describe("deriveReview — anomaly sweep", () => {
  it("(iv) a down-tuned-album album-default entry is flagged as a cs-standard candidate", () => {
    const catalog = [catalogSong({ songId: 300, name: "Perihelion", slug: "perihelion" })];
    const albums = [
      albumRow({
        album_title: "Infest the Rats' Nest",
        song_url: "/song/perihelion",
        song_name: "Perihelion",
        islive: 0,
      }),
    ];
    const tags = [tag({ songId: 300, name: "Perihelion", family: "standard", source: "album-default" })];

    const result = deriveReview(catalog, albums, tags);
    const anomaly = result.anomalies.find((a) => a.songId === 300);
    expect(anomaly).toBeDefined();
    expect(anomaly?.reason).toMatch(/cs-standard/i);
  });

  it("(v) an isCover song still on album-default is flagged as an other candidate", () => {
    const catalog = [catalogSong({ songId: 400, name: "Some Cover", slug: "some-cover", isCover: true })];
    const albums = [
      albumRow({ album_title: "Nonagon Infinity", song_url: "/song/some-cover", song_name: "Some Cover" }),
    ];
    const tags = [tag({ songId: 400, name: "Some Cover", family: "standard", source: "album-default" })];

    const result = deriveReview(catalog, albums, tags);
    const anomaly = result.anomalies.find((a) => a.songId === 400 && /cover/i.test(a.reason));
    expect(anomaly).toBeDefined();
    expect(anomaly?.reason).toMatch(/other|cover/i);
  });

  it("(vi) a hand-tagged entry that DIVERGES from its matched album default is surfaced (leg c-i)", () => {
    // Hand-tagged cs-standard on a standard-seed album -> diverges (defaultFamilyForAlbum only emits standard/microtonal).
    const catalog = [catalogSong({ songId: 500, name: "Down Tuned Override", slug: "down-tuned-override" })];
    const albums = [
      albumRow({
        album_title: "Nonagon Infinity",
        song_url: "/song/down-tuned-override",
        song_name: "Down Tuned Override",
      }),
    ];
    const tags = [
      tag({ songId: 500, name: "Down Tuned Override", family: "cs-standard", source: "hand-tagged", needsReview: false }),
    ];

    const result = deriveReview(catalog, albums, tags);
    const anomaly = result.anomalies.find((a) => a.songId === 500);
    expect(anomaly).toBeDefined();
    expect(anomaly?.reason).toMatch(/diverges/i);
  });

  it("(vii) a hand-tagged entry whose family MATCHES its present album default is NOT surfaced", () => {
    const catalog = [catalogSong({ songId: 600, name: "Confirmed Standard", slug: "confirmed-standard" })];
    const albums = [
      albumRow({
        album_title: "Nonagon Infinity",
        song_url: "/song/confirmed-standard",
        song_name: "Confirmed Standard",
      }),
    ];
    const tags = [
      tag({ songId: 600, name: "Confirmed Standard", family: "standard", source: "hand-tagged", needsReview: false }),
    ];

    const result = deriveReview(catalog, albums, tags);
    expect(result.anomalies.find((a) => a.songId === 600)).toBeUndefined();
  });

  it("(viii) a hand-tagged entry with NO matched studio album is surfaced (leg c-ii)", () => {
    const catalog = [catalogSong({ songId: 700, name: "Live Only Override", slug: "live-only-override" })];
    // No studio album row matches -> findMatchedAlbumTitles returns empty.
    const tags = [
      tag({ songId: 700, name: "Live Only Override", family: "microtonal", source: "hand-tagged", needsReview: false }),
    ];

    const result = deriveReview(catalog, [], tags);
    const anomaly = result.anomalies.find((a) => a.songId === 700);
    expect(anomaly).toBeDefined();
    expect(anomaly?.reason).toMatch(/no album default/i);
  });
});

describe("formatReviewSummary / formatReviewReport", () => {
  it("summary is a single line with counts", () => {
    const catalog = [catalogSong({ songId: 2, name: "12 Bar Bruise", slug: "12-bar-bruise" })];
    const albums = [
      albumRow({ album_title: "12 Bar Bruise", song_url: "/song/12-bar-bruise", song_name: "12 Bar Bruise" }),
    ];
    const tags = [tag({ songId: 2, name: "12 Bar Bruise", family: "standard" })];
    const result = deriveReview(catalog, albums, tags);

    const summary = formatReviewSummary(result);
    expect(summary).not.toContain("\n");
    expect(summary).toMatch(/1 total/);
  });

  it("report escapes catalog-sourced song names (markdown injection surface T-10-01)", () => {
    const catalog = [catalogSong({ songId: 800, name: "Evil <script> & Co", slug: "evil-script" })];
    const albums = [
      albumRow({
        album_title: "Infest the Rats' Nest",
        song_url: "/song/evil-script",
        song_name: "Evil <script> & Co",
      }),
    ];
    const tags = [tag({ songId: 800, name: "Evil <script> & Co", family: "standard", source: "album-default" })];
    const result = deriveReview(catalog, albums, tags);

    const report = formatReviewReport(result);
    expect(report).toContain("# Tuning-Family Review (VALID-01)");
    expect(report).not.toContain("<script>");
    expect(report).toContain("&lt;script&gt;");
    expect(report).toContain("&amp;");
  });
});

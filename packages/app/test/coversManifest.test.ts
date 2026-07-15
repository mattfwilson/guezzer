/**
 * Budget + provenance guard over the COMMITTED album-cover assets (plan 06-04,
 * D-03/DEX-04). These assertions run against the real files on disk — the
 * output of `npm run fetch:covers` — so they catch an accidental full-res
 * commit, a stray asset, a manifest/asset mismatch, or a missing provenance
 * URL before it ships. If the network fetch was skipped (offline execution),
 * the manifest is empty and every assertion below passes vacuously; the UI
 * ships placeholder-complete either way.
 *
 * Mirrors packages/app/test/db.test.ts's direct-assertion idiom (no mocks —
 * the committed artifacts ARE the fixture). fs/path access is available in the
 * vitest node runtime under jsdom.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const coversDir = join(testDir, "..", "src", "assets", "covers");
const manifestPath = join(coversDir, "covers-manifest.json");
const dexAlbumsPath = join(testDir, "..", "..", "..", "data", "normalized", "dex-albums.json");

const MAX_COVER_BYTES = 25 * 1024;
const MAX_TOTAL_BYTES = 350 * 1024;

interface CoverManifestEntry {
  title: string;
  sourceUrl: string;
  mbid: string;
  fetchedAt: string;
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
  string,
  CoverManifestEntry
>;
const manifestSlugs = Object.keys(manifest);

const webpFiles = readdirSync(coversDir).filter((name) => name.endsWith(".webp"));
const webpSlugs = webpFiles.map((name) => name.replace(/\.webp$/, ""));

const dexAlbums = JSON.parse(readFileSync(dexAlbumsPath, "utf8")) as {
  albums: Array<{ albumUrl: string }>;
};
const cardSlugs = new Set(dexAlbums.albums.map((a) => a.albumUrl.split("/").pop()));

describe("covers-manifest: committed album-cover asset guard", () => {
  it("has a .webp for every manifest entry and a manifest entry for every .webp", () => {
    for (const slug of manifestSlugs) {
      expect(webpSlugs, `manifest lists ${slug} but no ${slug}.webp exists`).toContain(slug);
    }
    for (const slug of webpSlugs) {
      expect(manifestSlugs, `${slug}.webp exists but is missing from the manifest`).toContain(slug);
    }
  });

  it("keeps every cover at or under the 25 KB per-file budget", () => {
    for (const name of webpFiles) {
      const bytes = statSync(join(coversDir, name)).size;
      expect(bytes, `${name} is ${bytes} bytes — over the 25 KB budget`).toBeLessThanOrEqual(
        MAX_COVER_BYTES,
      );
    }
  });

  it("keeps the total committed cover weight under 350 KB", () => {
    const total = webpFiles.reduce((sum, name) => sum + statSync(join(coversDir, name)).size, 0);
    expect(total, `total cover weight is ${total} bytes`).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it("maps every manifest slug to a card album in dex-albums.json (no stray assets)", () => {
    for (const slug of manifestSlugs) {
      expect(cardSlugs.has(slug), `manifest slug ${slug} is not a dex-albums card album`).toBe(
        true,
      );
    }
  });

  it("records a non-empty Cover Art Archive sourceUrl (provenance) for every entry", () => {
    for (const slug of manifestSlugs) {
      expect(manifest[slug].sourceUrl, `${slug} is missing provenance`).toBeTruthy();
      expect(manifest[slug].sourceUrl).toContain("coverartarchive.org");
    }
  });
});

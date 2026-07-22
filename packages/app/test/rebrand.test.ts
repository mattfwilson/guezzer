import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";

/**
 * AUTH-06 / D-15/D-16 — "Gizz With Friends" chrome rebrand guard.
 *
 * Asserts every rebranded chrome surface reads "Gizz With Friends" AND — the
 * load-bearing discipline check — that the rebrand touched DISPLAY strings only:
 * `config.DB_NAME` (and by extension every persisted Dexie/storage key) is
 * unchanged. A rebrand that renames the DB silently orphans every friend's
 * caught-song data; this test makes that regression impossible to merge.
 */

const BRAND = "Gizz With Friends";

const testDir = dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = join(testDir, "..", "index.html");
const viteConfigPath = join(testDir, "..", "vite.config.ts");

describe("Gizz With Friends rebrand (AUTH-06 / D-15/D-16)", () => {
  it("document <title> reads the rebrand", () => {
    const html = readFileSync(indexHtmlPath, "utf8");
    expect(html).toMatch(new RegExp(`<title>\\s*${BRAND}\\s*</title>`));
  });

  it("PWA manifest name + short_name read the rebrand", () => {
    const vite = readFileSync(viteConfigPath, "utf8");
    expect(vite).toContain(`name: "${BRAND}"`);
    expect(vite).toContain(`short_name: "${BRAND}"`);
  });

  it("install / CTA copy carries the rebrand, not the old brand", () => {
    expect(config.copy.installBanner.headline).toContain(BRAND);
    expect(config.copy.installCta).toContain(BRAND);
    expect(config.copy.installUnavailable).toContain(BRAND);
    expect(config.copy.installBanner.headline).not.toContain("Guezzer");
    expect(config.copy.installCta).not.toContain("Guezzer");
    expect(config.copy.installUnavailable).not.toContain("Guezzer");
  });

  it("share-card wordmark reads the rebrand", () => {
    expect(config.copy.share.card.wordmark).toBe(BRAND);
  });

  it("DB_NAME and persisted-key discipline: brand swap never touched storage", () => {
    // Chrome-only rebrand (D-15): the persisted Dexie DB name is untouched, so
    // no friend's on-device dex is orphaned by the rename.
    expect(config.DB_NAME).toBe("guezzer");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { ROUTES } from "../src/routing/useHashRoute.ts";
import { ROUTE_TO_TAB } from "../src/sync/presenceActivity.ts";

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
// Source read (never `dist`) — the D-44 contents-untouched assertion below.
const dexViewPath = join(testDir, "..", "src", "dex", "DexView.tsx");

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

/**
 * NAV-02 — the tab rename is DISPLAY-ONLY (the second application of the
 * `260716-wwj` rule this file already encodes).
 *
 * Every assertion below is deliberately unmergeable to break:
 *  - a renamed ROUTE breaks navigation (and every deep link/hash already shared);
 *  - a renamed WIRE TOKEN breaks NAV-03 permanently, because presence resolution
 *    is receiver-side — an already-shipped build renders whatever ITS map says,
 *    so no later fix can reach it;
 *  - a renamed DB NAME orphans every saved dex on every friend's device;
 *  - a renamed in-page HEADING would turn a thumb-space fix into a rebrand (D-43).
 */
describe("Tab rename is display-only (NAV-02 / D-43/D-44)", () => {
  it("config.copy.tabs is exactly the five short labels", () => {
    expect(config.copy.tabs).toEqual({
      show: "Live",
      explore: "GizzVerse",
      map: "Map",
      dex: "Me",
      games: "Games",
    });
  });

  it("ROUTES and the Route union are unchanged", () => {
    expect([...ROUTES]).toEqual(["show", "explore", "map", "dex", "games", "settings"]);
  });

  it("ROUTE_TO_TAB is unchanged — the wire vocabulary is frozen", () => {
    expect(ROUTE_TO_TAB).toEqual({
      show: "LiveGizz",
      explore: "GizzVerse",
      map: "GizzMap",
      dex: "GizzDex",
      games: "GizzGames",
      settings: "idle",
    });
  });

  it("the Tab union members are unchanged (the six frozen tokens)", () => {
    // The presence label map is typed `Record<Tab, string>`, so its key set IS
    // the Tab union — a token added or renamed shows up here.
    expect(Object.keys(config.copy.presence.activity).sort()).toEqual(
      ["GizzDex", "GizzGames", "GizzMap", "GizzVerse", "LiveGizz", "idle"].sort(),
    );
  });

  it("DB_NAME still `guezzer` — no persisted key was renamed with the labels", () => {
    expect(config.DB_NAME).toBe("guezzer");
  });

  it("in-page brand headings survive the tab rename (D-43)", () => {
    // The tab reads "Games"; the PAGE heading still reads "GizzGames".
    expect(config.copy.games.sectionHeading).toBe("GizzGames");
    expect(config.copy.tabs.games).toBe("Games");
  });

  it("D-44: `Me` is a name change only — DexView's contents and order are untouched", () => {
    const src = readFileSync(dexViewPath, "utf8");
    const header = src.indexOf("<DexHeader");
    const albums = src.indexOf("<AlbumGrid");
    const shows = src.indexOf("<ShowsList");
    const friends = src.indexOf("<FriendsList");

    expect(header).toBeGreaterThan(-1);
    expect(albums).toBeGreaterThan(-1);
    expect(shows).toBeGreaterThan(-1);
    expect(friends).toBeGreaterThan(-1);

    // Phase 24's NAV-04 friends-online badge lands on this exact tab and only
    // works if it stays the friends surface it already is.
    expect(header).toBeLessThan(albums);
    expect(albums).toBeLessThan(shows);
    expect(shows).toBeLessThan(friends);
  });
});

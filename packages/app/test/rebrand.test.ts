import { readFileSync, readdirSync, statSync } from "node:fs";
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

const SRC_DIR = join(testDir, "..", "src");
const SCANNED_EXTENSIONS = [".ts", ".tsx"];

/** Same strip-comments helper shape as `bottomOverlayInset.test.tsx`'s source guard. */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.replace(
    /(^|[^:])\/\/[^\n]*/g,
    (_match, lead: string) => lead,
  );
}

/** Same recursive `src` walk shape as `bottomOverlayInset.test.tsx`'s source guard. */
function sourceFiles(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      found.push(...sourceFiles(abs, rel));
      continue;
    }
    if (!SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    found.push(rel);
  }
  return found;
}

/**
 * Occurrences of `token` in every comment-stripped source file under `src/`.
 *
 * Comment stripping is what makes the prose mentions (`dex/shareCard.ts`,
 * `settings/importPicker.ts`, the share-card colour note and the `APP_NAME`
 * doc comment in `config.ts`, `settings/InstallSection.tsx`) invisible here:
 * this guard is about what the app RENDERS, not what it documents.
 */
function scanSrc(token: string): { files: string[]; hits: Map<string, number> } {
  const files = sourceFiles(SRC_DIR);
  const hits = new Map<string, number>();
  for (const file of files) {
    const code = stripComments(readFileSync(join(SRC_DIR, file), "utf8"));
    const count = code.split(token).length - 1;
    if (count > 0) hits.set(file, count);
  }
  return { files, hits };
}

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
  // 2026-07-30: the `schedule` route / "GizzSched" token are ADDITIVE members
  // (the schedule feature). Adding is forward-safe (D-41 fallback); these
  // assertions still lock every PRE-EXISTING name against a rename.
  it("config.copy.tabs is exactly the six short labels", () => {
    expect(config.copy.tabs).toEqual({
      show: "Live",
      explore: "GizzVerse",
      map: "Map",
      schedule: "Sched",
      dex: "Me",
      games: "Games",
    });
  });

  it("ROUTES and the Route union are unchanged (plus the additive schedule route)", () => {
    expect([...ROUTES]).toEqual([
      "show",
      "explore",
      "map",
      "schedule",
      "dex",
      "games",
      "settings",
    ]);
  });

  it("ROUTE_TO_TAB is unchanged — the wire vocabulary is frozen (rename-locked)", () => {
    expect(ROUTE_TO_TAB).toEqual({
      show: "LiveGizz",
      explore: "GizzVerse",
      map: "GizzMap",
      schedule: "GizzSched",
      dex: "GizzDex",
      games: "GizzGames",
      settings: "idle",
    });
  });

  it("the Tab union members are unchanged (the frozen tokens + additive GizzSched)", () => {
    // The presence label map is typed `Record<Tab, string>`, so its key set IS
    // the Tab union — a token added or renamed shows up here.
    expect(Object.keys(config.copy.presence.activity).sort()).toEqual(
      ["GizzDex", "GizzGames", "GizzMap", "GizzSched", "GizzVerse", "LiveGizz", "idle"].sort(),
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

/**
 * The app name has exactly ONE owner (todo 2026-08-10 / NAV-02).
 *
 * The two `describe` blocks above assert that particular strings read the
 * rebrand. They could not — and did not — catch the actual defect the todo
 * filed: seven user-facing strings still said the old name, loudest among them
 * the heading of the top-right menu sheet, while the manifest said the new one.
 *
 * The root cause was mechanism, not a missed find-and-replace: there was no
 * shared app-name constant, so the name lived as scattered literals and the
 * manifest and the menu were free to drift. These assertions guard the
 * mechanism — the product name is now ONE literal (`APP_NAME` in `config.ts`)
 * and every display site reads `config.copy.appName`.
 */
describe("App name has exactly one owner (todo 2026-08-10 / NAV-02)", () => {
  const OWNER_FILE = "config.ts";
  const DB_FILE = "db/db.ts";
  const SURFACES = [
    "components/AppMenu.tsx",
    "components/AppShell.tsx",
    "auth/SignInScreen.tsx",
  ];

  it("the scan actually walked src/ and its matcher actually fires", () => {
    // WITHOUT this, a broken walk or a swallowed read empties `hits` and turns
    // every assertion below into `expect([]).toEqual([...])` — sometimes still
    // green, always meaningless. Three independent things are proven here:
    // the walk found files, the walk REACHED the files these assertions talk
    // about, and the token matcher itself matches something. A file count
    // alone cannot catch a matcher that never matches.
    const { files, hits } = scanSrc("Guezzer");
    expect(files.length).toBeGreaterThan(100);
    for (const expected of [OWNER_FILE, DB_FILE, ...SURFACES]) {
      expect(files).toContain(expected);
    }
    // `db/db.ts` declares `GuezzerDB` and instantiates it — two live hits.
    expect(hits.get(DB_FILE) ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("the old name survives ONLY in the Dexie class, nowhere user-facing", () => {
    // `db/db.ts` is exempt on purpose (NAV-02): the persisted IndexedDB name and
    // the class that opens it are storage identity, not display copy. Renaming
    // them orphans every friend's saved dex on their device, and no later fix
    // can reach an already-orphaned install. The exemption is deliberate — it
    // is not an oversight anyone should "finish".
    const { hits } = scanSrc("Guezzer");
    expect([...hits.keys()].sort()).toEqual([DB_FILE]);
  });

  it("the brand literal appears exactly once in src/ — the APP_NAME declaration", () => {
    // THE root-cause guard: re-introducing a hard-coded app name anywhere under
    // src/ fails here, so the scattered-literal mechanism that let the manifest
    // and the menu diverge cannot come back.
    const { hits } = scanSrc(BRAND);
    expect([...hits.keys()].sort()).toEqual([OWNER_FILE]);
    expect(hits.get(OWNER_FILE)).toBe(1);
  });

  it("the owner is wired to the surfaces that render the name", () => {
    // The assertion above proves nobody hard-codes the name. Only this one
    // proves the surfaces still RENDER it rather than rendering nothing —
    // deleting the text node entirely would satisfy the guard above.
    expect(config.copy.appName).toBe(BRAND);
    for (const surface of SURFACES) {
      const src = readFileSync(join(SRC_DIR, surface), "utf8");
      expect(src, `${surface} must render config.copy.appName`).toContain(
        "config.copy.appName",
      );
    }
  });
});

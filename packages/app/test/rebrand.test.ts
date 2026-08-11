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

/**
 * BOTH source trees, because user-facing copy lives in both.
 *
 * Scanning only `packages/app/src` is the exact gap that let two rendered
 * strings survive the 2026-08-11 sweep: `core/src/data-safety/merge.ts`'s
 * import-rejection errors are returned by `classifyImport` and rendered by
 * `SettingsView`, but core was assumed to hold no UI copy. It does.
 *
 * Keys are package-prefixed (`app/…`, `core/…`) because both trees contain a
 * `config.ts` and the assertions below name files exactly.
 */
const TREES = [
  { prefix: "app", dir: SRC_DIR },
  { prefix: "core", dir: join(testDir, "..", "..", "core", "src") },
] as const;

/** Absolute path for a package-prefixed key produced by `scanSrc`. */
function absFor(prefixed: string): string {
  const slash = prefixed.indexOf("/");
  const tree = TREES.find((t) => t.prefix === prefixed.slice(0, slash));
  if (!tree) throw new Error(`unknown source tree for ${prefixed}`);
  return join(tree.dir, prefixed.slice(slash + 1));
}

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
 * Occurrences of `token` in every comment-stripped source file under BOTH
 * `packages/app/src` and `packages/core/src`.
 *
 * Comment stripping is what makes the prose mentions (`dex/shareCard.ts`,
 * `settings/importPicker.ts`, the share-card colour note and the `APP_NAME`
 * doc comments in both config files, `settings/InstallSection.tsx`) invisible
 * here: this guard is about what the app RENDERS, not what it documents.
 *
 * `readFileSync` is deliberately stronger than a `grep -rn` sweep, which is
 * how the core gap hid. `core/src/data-safety/merge.ts` contains a literal NUL
 * byte (the `entryKey` composite-key delimiter), so grep classifies it as
 * binary and SILENTLY omits it from results without `-a`. A source scan that
 * just reads bytes has no such heuristic and cannot be fooled by it.
 */
function scanSrc(token: string): { files: string[]; hits: Map<string, number> } {
  const files = TREES.flatMap((tree) => sourceFiles(tree.dir, tree.prefix));
  const hits = new Map<string, number>();
  for (const file of files) {
    const code = stripComments(readFileSync(absFor(file), "utf8"));
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
 * mechanism — the product name is now ONE literal per package and every
 * display site reads it from that package's config.
 *
 * The scan covers BOTH `packages/app/src` and `packages/core/src`. An app-only
 * scan already missed two rendered strings once (`core/src/data-safety/
 * merge.ts`'s import rejections, surfaced via `classifyImport` →
 * `SettingsView`); "core holds no UI copy" was an assumption, not a fact.
 */
describe("App name has exactly one owner (todo 2026-08-10 / NAV-02)", () => {
  // TWO owners, one per package — and that is the correct number, not a
  // compromise. `packages/app/src/config.ts` is pinned by D-39 to be a LEAF
  // module (type-only imports, no runtime dependency on anything), so copy
  // cannot cross the core/app seam: importing core's constant into app config
  // to collapse these would break the rule the leaf decision exists to hold.
  // The seam is the price of D-39, and this list is what stops it from
  // quietly becoming three.
  const OWNER_FILES = ["app/config.ts", "core/config.ts"];
  const DB_FILE = "app/db/db.ts";
  const CORE_CONFIG = "core/config.ts";
  const CORE_COPY_FILE = "core/data-safety/merge.ts";
  const SURFACES = [
    "app/components/AppMenu.tsx",
    "app/components/AppShell.tsx",
    "app/auth/SignInScreen.tsx",
  ];

  it("the scan actually walked BOTH src trees and its matcher actually fires", () => {
    // WITHOUT this, a broken walk or a swallowed read empties `hits` and turns
    // every assertion below into `expect([]).toEqual([...])` — sometimes still
    // green, always meaningless. Three independent things are proven here:
    // the walk found files, the walk REACHED the files these assertions talk
    // about, and the token matcher itself matches something. A file count
    // alone cannot catch a matcher that never matches.
    const { files, hits } = scanSrc("Guezzer");
    expect(files.length).toBeGreaterThan(100);
    for (const expected of [
      ...OWNER_FILES,
      DB_FILE,
      // The core walk must be proven to REACH the file that shipped the gap —
      // a `core` tree that resolved to an empty or wrong directory would leave
      // the two assertions below vacuously green in exactly the way that let
      // these strings survive the first sweep.
      CORE_COPY_FILE,
      ...SURFACES,
    ]) {
      expect(files).toContain(expected);
    }
    // `db/db.ts` declares `GuezzerDB` and instantiates it — two live hits.
    expect(hits.get(DB_FILE) ?? 0).toBeGreaterThanOrEqual(2);
    // …and core's `userAgent` is one more, proving the CORE walk reads content
    // and not just filenames.
    expect(hits.get(CORE_CONFIG) ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("the old name survives ONLY in the Dexie class, nowhere user-facing", () => {
    // `db/db.ts` is exempt on purpose (NAV-02): the persisted IndexedDB name and
    // the class that opens it are storage identity, not display copy. Renaming
    // them orphans every friend's saved dex on their device, and no later fix
    // can reach an already-orphaned install. The exemption is deliberate — it
    // is not an oversight anyone should "finish".
    //
    // `core/config.ts` is the second and last exemption: `userAgent` is an HTTP
    // identity for the volunteer-run kglw.net API (API etiquette), pinned
    // verbatim by `packages/core/test/fetch.test.ts`. It is not UI and must not
    // follow the display name. Every OTHER core file — including the
    // `data-safety/merge.ts` rejections that DO reach a user — must be clean.
    const { hits } = scanSrc("Guezzer");
    expect([...hits.keys()].sort()).toEqual([CORE_CONFIG, DB_FILE].sort());
  });

  it("the brand literal appears exactly once per package config, and nowhere else", () => {
    // THE root-cause guard: re-introducing a hard-coded app name anywhere under
    // either src/ tree fails here, so the scattered-literal mechanism that let
    // the manifest and the menu diverge cannot come back.
    //
    // TWO owners is the correct count (see OWNER_FILES above): D-39 keeps app's
    // config a leaf module, so core cannot import app's constant and app cannot
    // import core's. One literal per package, one read path per package.
    const { hits } = scanSrc(BRAND);
    expect([...hits.keys()].sort()).toEqual([...OWNER_FILES].sort());
    for (const owner of OWNER_FILES) expect(hits.get(owner)).toBe(1);
  });

  it("both owners are wired to the surfaces that render the name", () => {
    // The assertion above proves nobody hard-codes the name. Only this one
    // proves the surfaces still RENDER it rather than rendering nothing —
    // deleting the text node entirely would satisfy the guard above.
    expect(config.copy.appName).toBe(BRAND);
    for (const surface of SURFACES) {
      const src = readFileSync(absFor(surface), "utf8");
      expect(src, `${surface} must render config.copy.appName`).toContain(
        "config.copy.appName",
      );
    }
    // Core's user-facing copy reads core's own owner. Both rejection strings in
    // `merge.ts` are returned to the app and rendered by `SettingsView`.
    const mergeSrc = readFileSync(absFor(CORE_COPY_FILE), "utf8");
    expect(mergeSrc.split("${config.appName}").length - 1).toBe(2);
  });
});

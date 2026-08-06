import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  BOTTOM_SPACE_VAR_NAMES,
  applyBottomSpaceVars,
  bottomSpaceVarEntries,
} from "../src/layout/bottomSpace.ts";
import { AppShell } from "../src/components/AppShell.tsx";
import { BottomTabBar } from "../src/components/BottomTabBar.tsx";
import { __resetBottomOverlayInsetForTests } from "../src/pwa/bottomOverlayInset.ts";

/**
 * Phase-21 FOUND-01 / FOUND-02 — the bottom-space single owner.
 *
 * FOUND-02's wording is "a search for the tab-bar height returns exactly one owner".
 * These tests lock that owner's contract: the numbers come from
 * `config.ui.bottomSpace` (D-04, D-07), the composition happens once in
 * `layout/bottomSpace.ts`, and the ladder lands on `document.documentElement` rather
 * than `#root` so portaled surfaces can see it.
 *
 * Decisions under test: D-01 (the one CSS-authored `env()` read), D-02 (the two
 * deliberately distinct reserves), D-03 (the measured overlay inset feeds the content
 * reserve only), D-04 (`rem` as the tab-bar source unit), D-16 (the chrome-collapse
 * seam, shipped pinned).
 *
 * FOUND-01 branch: CONFIRMATION (plan 21-04, `21-HUMAN-UAT.md` test 1) — the dead gap
 * derives to exactly one safe-area inset, so the body-level bottom inset is deleted.
 *
 * The D-12 source guard — the repo-wide assertion that no surface hand-writes the
 * tab-bar height or the safe-area bottom inset — is the last `describe` block in this
 * file. It deliberately landed in plan 21-10, after every surface had been converted:
 * a guard added earlier would have passed vacuously (21-RESEARCH Pitfall 3).
 */

const testDir = dirname(fileURLToPath(import.meta.url));
// Source read, never `dist` — a stale committed bundle is on disk.
const stylesPath = join(testDir, "..", "src", "styles.css");
const styles = readFileSync(stylesPath, "utf8");

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function vars(
  overlayInsetPx: number,
  chromeVisible?: boolean,
): Record<string, string> {
  return Object.fromEntries(
    bottomSpaceVarEntries(overlayInsetPx, chromeVisible),
  );
}

describe("bottomSpace composition reads config, never literals", () => {
  it("--gz-tab-bar-h is the configured tab-bar height in rem (D-04)", () => {
    // D-04: `rem` is the source unit so the bar grows with Dynamic Type instead
    // of clipping its own 14px/600 labels at the largest text size (NAV-01).
    expect(vars(0)["--gz-tab-bar-h"]).toBe(
      `${config.ui.bottomSpace.TAB_BAR_HEIGHT_REM}rem`,
    );
  });

  it("--gz-sheet-pad-bottom carries the configured sheet padding", () => {
    expect(vars(0)["--gz-sheet-pad-bottom"]).toContain(
      `+ ${config.ui.bottomSpace.SHEET_PAD_BOTTOM_PX}px)`,
    );
  });

  it("--gz-fab-offset carries the configured FAB clearance", () => {
    expect(vars(0)["--gz-fab-offset"]).toContain(
      `+ ${config.ui.bottomSpace.FAB_CLEARANCE_PX}px)`,
    );
  });

  it("--gz-overlay-inset is the measured overlay height in px", () => {
    expect(vars(48)["--gz-overlay-inset"]).toBe("48px");
  });

  it("emits exactly the seven declared names, in composition order", () => {
    expect(bottomSpaceVarEntries(0).map(([name]) => name)).toEqual([
      ...BOTTOM_SPACE_VAR_NAMES,
    ]);
  });

  it("does not write --gz-safe-bottom from JS — it is CSS-authored (D-01)", () => {
    // Round-tripping `env()` through `setProperty` is unverified in Safari, and
    // the failure would be invisible on a desktop where the inset is 0.
    expect([...BOTTOM_SPACE_VAR_NAMES]).not.toContain("--gz-safe-bottom");
  });
});

describe("D-02: the bar's box, the chrome reserve and the content reserve are three different things", () => {
  it("--gz-tab-bar-box is the bar's own box — the arithmetic did not move, only its name", () => {
    // Phase-22 CHROME-01 split (22-RESEARCH Pitfall 6). Through Phase 21 this exact
    // string WAS `--gz-chrome-reserve`; the bar's height and the space the chrome
    // occupies were the same number. They diverge the moment chrome can hide.
    expect(vars(0)["--gz-tab-bar-box"]).toBe(
      "calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))",
    );
  });

  it("--gz-tab-bar-box NEVER collapses — it is identical in both chrome states", () => {
    // The bar must keep its full height when the reserve collapses, or
    // `translateY(100%)` of a squashed box no longer clears the viewport and leaves
    // a visible sliver that still looks reachable.
    expect(vars(0, false)["--gz-tab-bar-box"]).toBe(
      vars(0, true)["--gz-tab-bar-box"],
    );
  });

  it("--gz-chrome-reserve is the bar's box alone, with no overlay term", () => {
    const chrome = vars(0)["--gz-chrome-reserve"];
    expect(chrome).toBe("var(--gz-tab-bar-box)");
    expect(chrome).not.toContain("--gz-overlay-inset");
  });

  it("--gz-content-reserve adds the overlay inset on top of the chrome reserve", () => {
    expect(vars(0)["--gz-content-reserve"]).toBe(
      "calc(var(--gz-chrome-reserve) + var(--gz-overlay-inset))",
    );
  });

  it("the two reserves are NOT equal and must never be collapsed into one", () => {
    // Reserving the overlay inset on a non-scrolling route would permanently
    // squish a `flex-1` full-height stage every time a transient banner appears.
    const v = vars(0);
    expect(v["--gz-content-reserve"]).not.toBe(v["--gz-chrome-reserve"]);
  });
});

describe("D-03: the measured overlay inset feeds the content reserve only", () => {
  it("a taller overlay moves --gz-overlay-inset and leaves the chrome reserve byte-identical", () => {
    expect(vars(48)["--gz-overlay-inset"]).toBe("48px");
    expect(vars(48)["--gz-chrome-reserve"]).toBe(
      vars(0)["--gz-chrome-reserve"],
    );
  });
});

describe("D-07: sheet padding is not tab-bar-relative", () => {
  it("--gz-sheet-pad-bottom composes from the safe-area inset, not the chrome reserve", () => {
    // A sheet COVERS the tab bar; it does not sit above it. Reserving the bar
    // there would pad for chrome the user cannot see.
    const sheet = vars(0)["--gz-sheet-pad-bottom"];
    expect(sheet).toContain("var(--gz-safe-bottom)");
    expect(sheet).not.toContain("--gz-chrome-reserve");
    expect(sheet).not.toContain("--gz-tab-bar-h");
  });
});

describe("D-16: the chrome-collapse seam", () => {
  it("Phase 21 ships the seam PINNED — no caller passes false, and the default is chrome-visible", () => {
    expect(vars(0)).toEqual(vars(0, true));
  });

  it("collapsing the chrome reduces the reserve to the safe-area inset alone", () => {
    expect(vars(0, false)["--gz-chrome-reserve"]).toBe("var(--gz-safe-bottom)");
  });

  it("every dependent value follows automatically, its own string unchanged", () => {
    // This is the point of the seam: Phase 22 flips ONE source and the content
    // reserve and FAB offset track it without any call site being revisited.
    const collapsed = vars(0, false);
    const pinned = vars(0, true);
    expect(collapsed["--gz-content-reserve"]).toBe(
      pinned["--gz-content-reserve"],
    );
    expect(collapsed["--gz-fab-offset"]).toBe(pinned["--gz-fab-offset"]);
  });
});

describe("21-RESEARCH Pitfall 1: the ladder's target element", () => {
  afterEach(() => {
    document.getElementById("root")?.remove();
  });

  it("writes every variable onto document.documentElement", () => {
    applyBottomSpaceVars(document.documentElement, 0);
    for (const name of BOTTOM_SPACE_VAR_NAMES) {
      expect(
        document.documentElement.style.getPropertyValue(name),
      ).not.toBe("");
    }
  });

  it("writes NOTHING onto #root — a portaled sheet would never see it there", () => {
    // `Sheet.tsx` portals to `document.body`, so it is not a descendant of
    // `#root`. A ladder set on `#root` would silently break
    // `--gz-sheet-pad-bottom`, which exists specifically for sheets.
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    applyBottomSpaceVars(document.documentElement, 0);

    for (const name of BOTTOM_SPACE_VAR_NAMES) {
      expect(root.style.getPropertyValue(name)).toBe("");
    }
  });
});

describe("styles.css owns the one raw env() bottom read (D-01)", () => {
  const RAW_BOTTOM_ENV = "env(safe-area-inset-bottom)";

  it("declares --gz-safe-bottom exactly once", () => {
    expect(occurrences(styles, `--gz-safe-bottom: ${RAW_BOTTOM_ENV}`)).toBe(1);
  });

  it("declares it in a plain :root block, not inside @theme", () => {
    // `@theme` generates Tailwind utilities; this is a raw custom property read
    // by inline `var()`.
    expect(styles).toMatch(
      /:root\s*\{[^}]*--gz-safe-bottom:\s*env\(safe-area-inset-bottom\);[^}]*\}/,
    );
  });

  it("CONFIRMATION BRANCH (plan 21-04): the raw bottom env() appears exactly once in the file", () => {
    // 21-HUMAN-UAT.md test 1 selected the CONFIRMATION BRANCH — the dead gap
    // derives to exactly one safe-area inset (GAP === sab), so body's
    // `padding-bottom` was deleted. Under ALREADY-FLUSH (D-19) this count would
    // be 2 with a D-19 comment on the adjacent line; under FALSIFIED it would be
    // 2 with NO D-19 comment.
    expect(occurrences(styles, RAW_BOTTOM_ENV)).toBe(1);
  });

  it("CONFIRMATION BRANCH: body no longer carries a bottom inset", () => {
    expect(styles).not.toContain(`padding-bottom: ${RAW_BOTTOM_ENV}`);
  });

  it("does NOT claim a D-19 non-reproduction — the gap reproduced on device", () => {
    // Annotating D-19 here would fabricate a measurement result in the very
    // evidence record this gate exists to protect.
    expect(styles).not.toContain("D-19");
  });

  it("keeps the left/right body gutters — they have no per-surface duplicate", () => {
    expect(styles).toContain("padding-left: env(safe-area-inset-left)");
    expect(styles).toContain("padding-right: env(safe-area-inset-right)");
  });

  it("keeps the html/body/#root height chain that grounds h-full", () => {
    expect(styles).toMatch(/html,\s*body,\s*#root\s*\{\s*height:\s*100%;\s*\}/);
  });
});

describe("the two converted surfaces read the owner's variables", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  // Assert against the `style` ATTRIBUTE, not `el.style.paddingBottom`: jsdom's
  // CSS parser does not reliably round-trip a `var()` value through a typed
  // longhand property.
  it("<main> reserves the content reserve on scrolling routes", () => {
    const { container } = render(
      createElement(AppShell, { scroll: true, children: "content" }),
    );
    expect(container.querySelector("main")!.getAttribute("style")).toContain(
      "var(--gz-content-reserve)",
    );
  });

  it("<main> reserves the chrome reserve only on non-scrolling routes (D-02)", () => {
    const { container } = render(
      createElement(AppShell, { scroll: false, children: "content" }),
    );
    const style = container.querySelector("main")!.getAttribute("style")!;
    expect(style).toContain("var(--gz-chrome-reserve)");
    expect(style).not.toContain("var(--gz-content-reserve)");
  });

  it("<nav> sizes itself from the never-collapsing bar box and gutters with the safe-area inset", () => {
    const { container } = render(createElement(BottomTabBar));
    const style = container.querySelector("nav")!.getAttribute("style")!;
    expect(style).toContain("var(--gz-tab-bar-box)");
    expect(style).toContain("var(--gz-safe-bottom)");
    // Phase-22 CHROME-01: a future edit must not silently re-couple the bar's height
    // to the COLLAPSING reserve — that squashes the bar instead of sliding it clear.
    expect(style).not.toContain("var(--gz-chrome-reserve)");
  });
});

/* ------------------------------------------------------------------------- *
 * D-12: the FOUND-02 single-owner source guard
 * ------------------------------------------------------------------------- */

/**
 * FOUND-02's acceptance wording is "a search for the tab-bar height returns exactly
 * one owner". Every other test in this file asserts what the owner PRODUCES; this
 * block asserts that nothing else re-derives it. It walks the app's own source and
 * fails on any hand-written tab-bar height or safe-area bottom read outside the
 * owner files.
 *
 * COMMENT DISCIPLINE — this guard scans CODE ONLY. Double-slash line comments and
 * slash-star block comments (including the brace-wrapped JSX form, which is the same
 * block syntax) are stripped before matching. Seven shipped sites legitimately name
 * these numbers in prose while explaining why they no longer USE them (21-RESEARCH
 * Hazard 3); a guard that forbade discussing the value would push maintainers to
 * delete the explanations, which are the most useful thing in those files. Stripping
 * preserves line numbers — comment bodies become spaces, newlines are kept — so
 * reported positions still point at real lines. A `://` sequence is protected, so a
 * URL inside a string literal is never mistaken for a line comment.
 *
 * SCOPE — `src/` only. `dist/` is NEVER walked: a built bundle is produced on disk by
 * `npm run build` and inlines every one of these literals, which would fail the suite
 * confusingly and for no real defect (T-21-28). A test below asserts no scanned path
 * contains a build-output directory segment.
 *
 * EXEMPT PATHS, each with its reason:
 *   - `layout/bottomSpace.ts` — the composition owner (D-01). This is the file the
 *     failure message points every violator at.
 *   - `config.ts` — the numeric owner (D-01). `TAB_BAR_HEIGHT_REM` lives here.
 *   - `styles.css` — holds the single permitted `:root` safe-area bottom
 *     declaration (D-01). Not skipped blind: asserted on directly below, and again
 *     in the "styles.css owns the one raw env() bottom read" block above.
 *   - `dev/` — `layerRepro.tsx`, `LayoutProbe.tsx`, `OrbFitHarness.tsx`. URL-flag-gated
 *     harnesses whose whole job is to imitate or measure the raw geometry;
 *     `layerRepro` deliberately clones the pre-conversion toast offset and
 *     `LayoutProbe` must read the raw inset to report it. This directory is already
 *     the repo's established exception (it holds the one permitted Tailwind `z-*`).
 *
 * KNOWN RECORDED EXEMPTION — `explore/ExploreFilterFab.tsx` holds a bare numeric
 * mirror of the tab-bar height that the pattern set cannot match (the literal is
 * split, not suffixed with a unit). Rather than let it be a silent miss it is
 * allowlisted by name in its own test below, which fails if a SECOND such mirror
 * appears anywhere.
 */

const SRC_DIR = join(testDir, "..", "src");

/** Owner files and harnesses the scan skips, keyed by `src`-relative posix path. */
const GUARD_EXEMPT_FILES = new Set([
  "layout/bottomSpace.ts", // the composition owner (D-01)
  "config.ts", // the numeric owner (D-01)
  "styles.css", // the one permitted :root env() read — asserted directly instead
]);

/** Directories the scan skips wholesale, keyed by `src`-relative posix path. */
const GUARD_EXEMPT_DIRS = new Set([
  "dev", // URL-flag-gated harnesses that exist to imitate/measure raw geometry
]);

const SCANNED_EXTENSIONS = [".ts", ".tsx", ".css"];

/**
 * Patterns that mean "this file re-derived the bottom-space owner's values".
 *
 * Anchored deliberately: a loose `-16\b` produces twelve false positives on the
 * legitimate `pb-16` / `pt-16` content gutters (21-RESEARCH Hazard 2), and anchoring
 * on `bottom` keeps `env(safe-area-inset-top/left/right)` — which keep their shipped
 * per-surface idiom — out of scope.
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  // Hazard 1: the five toasts wrote the Tailwind class, never a unit literal — a
  // guard on `4rem|64px|env()` alone would have passed while all five were broken.
  { label: "bottom-16", pattern: /\bbottom-16\b/ },
  { label: "inset-y-16", pattern: /\binset-y-16\b/ },
  { label: "h-16", pattern: /\bh-16\b/ },
  { label: "bottom-[", pattern: /bottom-\[/ },
  { label: "4rem", pattern: /\b4rem\b/ },
  { label: "64px", pattern: /\b64px\b/ },
  {
    label: "env(safe-area-inset-bottom)",
    pattern: /env\(\s*safe-area-inset-bottom\s*\)/,
  },
];

/**
 * Removes comment bodies while preserving line count and column-free line numbers.
 * Block comments become spaces (newlines kept); line comments are dropped from `//`
 * to end-of-line, except where the `//` is preceded by `:` (a URL scheme).
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.replace(
    /(^|[^:])\/\/[^\n]*/g,
    (_match, lead: string) => lead,
  );
}

interface GuardViolation {
  file: string;
  line: number;
  token: string;
}

/** Scans one file's already-read source; returns every code-only match. */
function scanSource(file: string, source: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const lines = stripComments(source).split("\n");
  lines.forEach((text, index) => {
    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        violations.push({ file, line: index + 1, token: label });
      }
    }
  });
  return violations;
}

/** Recursive `src` walk. Returns `src`-relative posix paths, exemptions applied. */
function collectScannedFiles(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (GUARD_EXEMPT_DIRS.has(rel)) continue;
      found.push(...collectScannedFiles(abs, rel));
      continue;
    }
    if (GUARD_EXEMPT_FILES.has(rel)) continue;
    if (!SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    found.push(rel);
  }
  return found;
}

const scannedFiles = collectScannedFiles(SRC_DIR);

function formatViolations(violations: GuardViolation[]): string {
  return [
    "FOUND-02 (D-12) violation — the tab-bar height / safe-area bottom inset has",
    "exactly one owner: packages/app/src/layout/bottomSpace.ts (numbers in",
    "packages/app/src/config.ts under `ui.bottomSpace`). Put the value there and",
    "read it as a `var(--gz-*)` instead of writing it here:",
    ...violations.map(
      ({ file, line, token }) => `  packages/app/src/${file}:${line} — ${token}`,
    ),
  ].join("\n");
}

describe("FOUND-02 single-owner guard (D-12)", () => {
  it("no app source outside the owner files re-derives the bottom-space values", () => {
    const violations = scannedFiles.flatMap((file) =>
      scanSource(file, readFileSync(join(SRC_DIR, file), "utf8")),
    );
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  it("actually scanned the tree — the guard is not passing vacuously (T-21-29)", () => {
    // If an exemption or the extension filter ever swallowed the walk, every
    // assertion above would pass over an empty list. 147 source files exist today.
    expect(scannedFiles.length).toBeGreaterThan(100);
    expect(scannedFiles).toContain("components/InstallBanner.tsx");
    expect(scannedFiles).toContain("components/BottomTabBar.tsx");
  });

  it("never walks a build-output directory (T-21-28)", () => {
    // A built bundle inlines every forbidden literal; scanning it would fail the
    // suite for no real defect. The walk is rooted at `src`, and nothing below it
    // is named for build output.
    for (const file of scannedFiles) {
      expect(file.split("/")).not.toContain("dist");
      expect(file.split("/")).not.toContain("build");
    }
  });

  it("exempts exactly the owner files and the dev harnesses, and nothing else", () => {
    // Pinning the exemption set means a future 'just add my file to the skip list'
    // shows up as a diff on this assertion rather than as a quiet erosion.
    expect([...GUARD_EXEMPT_FILES].sort()).toEqual([
      "config.ts",
      "layout/bottomSpace.ts",
      "styles.css",
    ]);
    expect([...GUARD_EXEMPT_DIRS]).toEqual(["dev"]);
    for (const file of scannedFiles) {
      expect(file.startsWith("dev/")).toBe(false);
    }
  });

  it("asserts styles.css directly rather than skipping it (D-01)", () => {
    // The one exempt file that contains a REAL forbidden token, so it gets a
    // positive assertion instead of a blind skip: exactly one raw bottom env()
    // read, and it is the `:root` declaration. (Under the plan-21-04 ALREADY-FLUSH
    // branch this count would have been 2, with a D-19 comment adjacent — that
    // branch was not taken; see the CONFIRMATION BRANCH block above.)
    const code = stripComments(styles);
    expect(occurrences(code, "env(safe-area-inset-bottom)")).toBe(1);
    expect(code).toMatch(
      /:root\s*\{[^}]*--gz-safe-bottom:\s*env\(safe-area-inset-bottom\);[^}]*\}/,
    );
  });

  it("records the one known bare numeric mirror instead of missing it silently", () => {
    // 21-08 left `RESTING_BOTTOM_PX = 64 + 8` in ExploreFilterFab: the split literal
    // has no unit suffix, so no pattern above can match it. It feeds ONLY the A11Y-02
    // lift math (never the resting position, which reads the owner's var), `var()`
    // does not resolve to a number in JS without `getComputedStyle`, and deriving it
    // as `TAB_BAR_HEIGHT_REM * 16` would bake in the rem→px assumption D-04 chose
    // `rem` specifically to avoid. So it is an allowlisted exemption, not a miss —
    // and this assertion fails the moment a SECOND bare mirror appears.
    const bareMirror = /\b64\b/;
    const sites = scannedFiles.filter((file) =>
      stripComments(readFileSync(join(SRC_DIR, file), "utf8"))
        .split("\n")
        .some((line) => bareMirror.test(line)),
    );
    expect(sites).toEqual(["explore/ExploreFilterFab.tsx"]);
  });
});

describe("FOUND-02 guard self-tests — proof it can fail (T-21-29)", () => {
  it("strips a // line comment and a /* … */ block before matching", () => {
    const source = [
      "// bottom-16 lived here before plan 21-10",
      "/* the bar used to be 4rem tall */",
      'const keep = "https://example.com/x";',
    ].join("\n");

    const stripped = stripComments(source);
    expect(stripped).not.toMatch(/bottom-16/);
    expect(stripped).not.toMatch(/4rem/);
    // The URL survives: `://` is not a line comment.
    expect(stripped).toContain("https://example.com/x");
    // Line numbers stay truthful — comment bodies become spaces, not nothing.
    expect(stripped.split("\n")).toHaveLength(3);
    expect(scanSource("fake.ts", source)).toEqual([]);
  });

  it("matches bottom-16 as code but leaves the twelve pb-16 / pt-16 sites alone", () => {
    expect(scanSource("fake.tsx", 'className="fixed inset-x-0 bottom-16"')).toEqual(
      [{ file: "fake.tsx", line: 1, token: "bottom-16" }],
    );
    // The real gutters: SignInScreen, PlaceholderView, the eight dex views,
    // GamesView, SettingsView. A loose `-16\b` would flag all twelve.
    expect(scanSource("fake.tsx", 'className="px-4 pt-8 pb-16"')).toEqual([]);
    expect(scanSource("fake.tsx", 'className="px-4 pt-16 pb-16"')).toEqual([]);
  });

  it("is anchored on `bottom` — the top/left/right insets do not trip it", () => {
    expect(scanSource("fake.tsx", "paddingTop: env(safe-area-inset-top)")).toEqual(
      [],
    );
    expect(
      scanSource("fake.css", "padding-left: env(safe-area-inset-left);"),
    ).toEqual([]);
    expect(
      scanSource("fake.tsx", "bottom: env( safe-area-inset-bottom )"),
    ).toEqual([
      { file: "fake.tsx", line: 1, token: "env(safe-area-inset-bottom)" },
    ]);
  });

  it("catches every other forbidden form, with the offending line number", () => {
    const source = [
      "const a = 1;",
      'const b = "height: 4rem";',
      'const c = "top: 64px";',
      'const d = "inset-y-16";',
      'const e = "bottom-[72px]";',
    ].join("\n");
    expect(scanSource("fake.ts", source)).toEqual([
      { file: "fake.ts", line: 2, token: "4rem" },
      { file: "fake.ts", line: 3, token: "64px" },
      { file: "fake.ts", line: 4, token: "inset-y-16" },
      { file: "fake.ts", line: 5, token: "bottom-[" },
    ]);
  });

  it("names file, line and matched token in the failure message", () => {
    const message = formatViolations([
      { file: "components/Whatever.tsx", line: 42, token: "bottom-16" },
    ]);
    expect(message).toContain("components/Whatever.tsx:42");
    expect(message).toContain("bottom-16");
    expect(message).toContain("packages/app/src/layout/bottomSpace.ts");
  });
});

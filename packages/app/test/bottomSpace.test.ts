import { readFileSync } from "node:fs";
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
 * NOTE ON WHAT IS ABSENT: the D-12 source guard — the repo-wide assertion that no
 * surface hand-writes the safe-area bottom inset — deliberately lands in plan 21-10,
 * once every surface has been converted. Its absence here is scheduling, not an
 * oversight.
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

  it("emits exactly the six declared names, in composition order", () => {
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

describe("D-02: chrome reserve and content reserve are two different things", () => {
  it("--gz-chrome-reserve is the tab bar alone, with no overlay term", () => {
    const chrome = vars(0)["--gz-chrome-reserve"];
    expect(chrome).toBe("calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))");
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

  it("<nav> sizes itself from the chrome reserve and gutters with the safe-area inset", () => {
    const { container } = render(createElement(BottomTabBar));
    const style = container.querySelector("nav")!.getAttribute("style")!;
    expect(style).toContain("var(--gz-chrome-reserve)");
    expect(style).toContain("var(--gz-safe-bottom)");
  });
});

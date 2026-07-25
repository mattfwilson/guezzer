import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FabMenu } from "../src/show/FabMenu.tsx";
import { showBottomFabOffset } from "../src/show/fabLayout.ts";
import { config } from "../src/config.ts";

/**
 * FabMenu (D-20) supersedes ActionBar: all five Show-Mode actions collapse into
 * one bottom-right speed-dial. Replaces actionBar.test.tsx wholesale. Asserts the
 * collapse contract (no action buttons in the tree by default), the scrim
 * block-and-collapse, auto-collapse-then-act (each of the five callbacks fires
 * exactly once and the menu closes), and the never-accent floor.
 */
const actionLabels = [
  config.copy.catchUp.cta, // Catch me up (BINGO-06, plan 15-04) — top FAB item
  config.copy.show.searchCta,
  config.copy.show.unknownCta,
  config.copy.show.setBreakCta,
  config.copy.show.encoreCta,
  config.copy.show.undoCta,
  config.copy.show.endCta, // End Show — the last FAB item (moved from the header)
];

function renderMenu(stripSlotReserved = false) {
  const handlers = {
    onSearch: vi.fn(),
    onUnknown: vi.fn(),
    onSetBreak: vi.fn(),
    onEncore: vi.fn(),
    onUndo: vi.fn(),
    onCatchUp: vi.fn(),
    onEndShow: vi.fn(),
  };
  render(<FabMenu {...handlers} stripSlotReserved={stripSlotReserved} />);
  return handlers;
}

/** The positioned container carrying the bottom offset (class `fab-menu`). */
function fabContainer(): HTMLElement {
  const fab = screen.getByRole("button", { name: config.copy.show.fabLabel });
  const container = fab.closest(".fab-menu");
  if (!(container instanceof HTMLElement)) throw new Error("fab container not found");
  return container;
}

function openMenu() {
  fireEvent.click(
    screen.getByRole("button", { name: config.copy.show.fabLabel }),
  );
}

describe("FabMenu (D-20 speed-dial replacing ActionBar)", () => {
  afterEach(cleanup);

  it("lifts on the RESERVED-SLOT signal, not on rows being visible (D-05)", () => {
    // jsdom's CSSOM drops calc()/var() from style.bottom, so assert the wiring
    // via the data attribute the container reflects (also a debug hook).
    renderMenu(false);
    expect(fabContainer().dataset.stripSlotReserved).toBe("false");
    cleanup();
    renderMenu(true);
    expect(fabContainer().dataset.stripSlotReserved).toBe("true");
  });

  /**
   * FOUND-02 / D-05 — the offset's exact shape, and the trigger that selects it.
   *
   * FOUND-02: both branches must COMPOSE the bottom-space owner's `--gz-fab-offset`
   * rather than re-deriving the tab-bar + safe-area arithmetic, so a search for the
   * tab-bar height returns exactly one owner. A raw `env()`/`64px`/`4rem` reappearing
   * here means a surface has started computing its own bottom space again.
   *
   * D-05's CROSS-CHECK, in words: the trigger moved from "rows are on screen right
   * now" to "the strip's slot is reserved", which means the FAB transitions at most
   * once per show instead of jumping whenever a remotely-timed editor suggestion
   * lands. That does NOT cost the Phase-10 `a60d5e2` clearance: the reserved slot is
   * a FIXED height that is always ≥ the height of whatever rows render inside it, so
   * lifting by the slot clears every rendered row too. The lift is therefore
   * re-expressed, not undone.
   *
   * The reserved branch is built from `config.ui.SUGGESTION_STRIP_HEIGHT`, never a
   * hardcoded 112 — and it is READ from config rather than measured because D-06
   * keeps the strip's height a fixed constant. A measured height here would put the
   * mid-show jump D-05 just removed straight back in.
   */
  describe("bottom offset (FOUND-02 composition, D-05 trigger)", () => {
    it("returns the owner's var at rest and the var + reserved slot when reserved", () => {
      expect(showBottomFabOffset(false)).toBe("var(--gz-fab-offset)");
      expect(showBottomFabOffset(true)).toBe(
        `calc(var(--gz-fab-offset) + ${config.ui.SUGGESTION_STRIP_HEIGHT}px)`,
      );
    });

    it("re-derives no bottom-space arithmetic of its own (FOUND-02)", () => {
      for (const offset of [showBottomFabOffset(false), showBottomFabOffset(true)]) {
        expect(offset).not.toContain("env(");
        expect(offset).not.toContain("64px");
        expect(offset).not.toContain("4rem");
      }
    });

    it("renders that exact offset on the FAB container for each branch", () => {
      // Assert on the raw style ATTRIBUTE, not the typed longhand: a parsed
      // property is not guaranteed to round-trip a `var()` in jsdom.
      renderMenu(false);
      expect(fabContainer().getAttribute("style")).toContain(
        showBottomFabOffset(false),
      );
      cleanup();
      renderMenu(true);
      expect(fabContainer().getAttribute("style")).toContain(
        showBottomFabOffset(true),
      );
    });
  });

  it("is collapsed by default: only the FAB is in the tree, no action buttons", () => {
    renderMenu();
    expect(
      screen.getByRole("button", { name: config.copy.show.fabLabel }),
    ).toBeInTheDocument();
    for (const label of actionLabels) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("expands to all action rows when the FAB is tapped", () => {
    renderMenu();
    openMenu();
    for (const label of actionLabels) {
      expect(
        screen.getByRole("button", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("scrim tap collapses the menu without firing any callback (T-06-04)", () => {
    const handlers = renderMenu();
    openMenu();
    fireEvent.click(screen.getByTestId("fab-scrim"));
    for (const label of actionLabels) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    for (const spy of Object.values(handlers)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("tapping the FAB again collapses without firing any callback", () => {
    const handlers = renderMenu();
    openMenu();
    openMenu(); // second tap toggles closed
    for (const label of actionLabels) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    for (const spy of Object.values(handlers)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("each action fires exactly its own callback once and auto-collapses", () => {
    const cases = [
      { label: config.copy.catchUp.cta, key: "onCatchUp" },
      { label: config.copy.show.searchCta, key: "onSearch" },
      { label: config.copy.show.unknownCta, key: "onUnknown" },
      { label: config.copy.show.setBreakCta, key: "onSetBreak" },
      { label: config.copy.show.encoreCta, key: "onEncore" },
      { label: config.copy.show.undoCta, key: "onUndo" },
      { label: config.copy.show.endCta, key: "onEndShow" },
    ] as const;

    for (const { label, key } of cases) {
      const handlers = renderMenu();
      openMenu();
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(handlers[key]).toHaveBeenCalledTimes(1);
      for (const [k, spy] of Object.entries(handlers)) {
        if (k !== key) expect(spy).not.toHaveBeenCalled();
      }
      // auto-collapse-then-act: the row is gone after the tap.
      expect(screen.queryByRole("button", { name: label })).toBeNull();
      cleanup();
    }
  });

  // CR-01 regression guard: jsdom fires onClick regardless of paint order, so the
  // behavioural tests above CANNOT catch a z-index inversion. Assert the numeric
  // tier ordering directly — the FabMenu scrim (z.fabScrim) MUST paint strictly
  // BELOW the FAB + action-row container (z.fab), or the open menu becomes an
  // untappable scrim over every Show-Mode action.
  it("scrim tier sits strictly below the FAB container tier (paint-order guard)", () => {
    expect(config.ui.z.fabScrim).toBeLessThan(config.ui.z.fab);
  });

  it("the FAB carries the config aria-label; no control is accent-styled", () => {
    renderMenu();
    const fab = screen.getByRole("button", {
      name: config.copy.show.fabLabel,
    });
    expect(fab.className).not.toContain("accent");
    openMenu();
    for (const label of actionLabels) {
      expect(
        screen.getByRole("button", { name: label }).className,
      ).not.toContain("accent");
    }
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FabMenu } from "../src/show/FabMenu.tsx";
import { config } from "../src/config.ts";

/**
 * FabMenu (D-20) supersedes ActionBar: all five Show-Mode actions collapse into
 * one bottom-right speed-dial. Replaces actionBar.test.tsx wholesale. Asserts the
 * collapse contract (no action buttons in the tree by default), the scrim
 * block-and-collapse, auto-collapse-then-act (each of the five callbacks fires
 * exactly once and the menu closes), and the never-accent floor.
 */
const actionLabels = [
  config.copy.show.searchCta,
  config.copy.show.unknownCta,
  config.copy.show.setBreakCta,
  config.copy.show.encoreCta,
  config.copy.show.undoCta,
  config.copy.show.endCta, // End Show — the last FAB item (moved from the header)
];

function renderMenu(stripHasContent = false) {
  const handlers = {
    onSearch: vi.fn(),
    onUnknown: vi.fn(),
    onSetBreak: vi.fn(),
    onEncore: vi.fn(),
    onUndo: vi.fn(),
    onEndShow: vi.fn(),
  };
  render(<FabMenu {...handlers} stripHasContent={stripHasContent} />);
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

  it("lifts only when the SuggestionStrip is showing rows, never for an empty slot (owner 2026-07-19)", () => {
    // jsdom's CSSOM drops calc()/env() from style.bottom, so assert the wiring
    // via the data attribute the container reflects (also a debug hook).
    renderMenu(false);
    expect(fabContainer().dataset.stripHasContent).toBe("false");
    cleanup();
    renderMenu(true);
    expect(fabContainer().dataset.stripHasContent).toBe("true");
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

  it("expands to six action rows when the FAB is tapped", () => {
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

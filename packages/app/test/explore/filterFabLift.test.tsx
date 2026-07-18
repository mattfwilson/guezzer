import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config.ts";
import { ExploreFilterFab } from "../../src/explore/ExploreFilterFab.tsx";

/**
 * A11Y-02 / D-03 (plan 08-04): the Explore FilterFab lifts above the focused-node
 * NodeSheet (z.focusedFab) and returns to rest (z.fab) on close, honoring
 * prefers-reduced-motion. The wrapper is the FAB button's parent <div>; its inline
 * `transform` / `zIndex` / `transition` carry the lift.
 */

const noop = () => {};

function renderFab(lifted: boolean) {
  return render(
    <ExploreFilterFab
      open={false}
      onOpenChange={noop}
      view="rotation"
      onViewChange={noop}
      topK={config.explore.TOP_K_PER_NODE_DEFAULT}
      onTopKChange={noop}
      dexOverlay
      onDexOverlayChange={noop}
      lifted={lifted}
    />,
  );
}

/** The lift-carrying wrapper is the FAB button's parent <div>. */
function fabWrapper(): HTMLElement {
  const button = screen.getByLabelText(config.copy.explore.filterFabAria);
  const wrapper = button.parentElement;
  if (!wrapper) throw new Error("FAB wrapper not found");
  return wrapper;
}

/** Extract the signed px from a `translateY(<n>px)` transform string. */
function translateYpx(transform: string): number {
  const m = /translateY\((-?[\d.]+)px\)/.exec(transform);
  return m ? Number(m[1]) : NaN;
}

describe("ExploreFilterFab lift (A11Y-02 / D-03)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lifts above the sheet with z.focusedFab when a node is focused", () => {
    renderFab(true);
    const wrapper = fabWrapper();
    // Non-zero NEGATIVE translateY (lifted up), above the NodeSheet.
    expect(translateYpx(wrapper.style.transform)).toBeLessThan(0);
    expect(wrapper.style.zIndex).toBe(String(config.ui.z.focusedFab));
  });

  it("rests at translateY(0) with z.fab when nothing is focused", () => {
    renderFab(false);
    const wrapper = fabWrapper();
    expect(translateYpx(wrapper.style.transform)).toBe(0);
    expect(wrapper.style.zIndex).toBe(String(config.ui.z.fab));
  });

  it("keeps focusedFab strictly above the sheet tier (no occlusion)", () => {
    // The whole point of D-03: the lifted FAB must out-rank the non-modal sheet.
    expect(config.ui.z.focusedFab).toBeGreaterThan(config.ui.z.sheet);
  });

  it("uses no transition under prefers-reduced-motion", () => {
    // Override the setup.ts matchMedia stub to report reduced-motion for this test.
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    renderFab(true);
    expect(fabWrapper().style.transition).toBe("none");
  });

  it("animates the transform when motion is allowed (default stub)", () => {
    renderFab(true);
    expect(fabWrapper().style.transition).toContain("transform");
    expect(fabWrapper().style.transition).not.toBe("none");
  });
});

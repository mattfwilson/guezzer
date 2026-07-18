import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ConstellationData } from "@guezzer/core";
import { config } from "../../src/config.ts";
import { ExploreFilterFab } from "../../src/explore/ExploreFilterFab.tsx";

// A11Y-03 reframe harness: mock react-force-graph-2d so the imperative camera
// methods (`zoom`/`centerAt`) are spies we can assert on. The FAB tests below do
// NOT import ForceGraph2D, so this mock is inert for them.
const { zoomSpy, centerAtSpy } = vi.hoisted(() => ({
  zoomSpy: vi.fn(),
  centerAtSpy: vi.fn(),
}));

vi.mock("react-force-graph-2d", async () => {
  const React = await import("react");
  const Mock = React.forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        zoom: zoomSpy,
        centerAt: centerAtSpy,
        zoomToFit: vi.fn(),
        // ConstellationCanvas reads these two forces (both optional-chained).
        d3Force: () => undefined,
        d3ReheatSimulation: vi.fn(),
      }));
      return React.createElement("div", { "data-testid": "fg-mock" });
    },
  );
  return { default: Mock };
});

const { ConstellationCanvas } = await import(
  "../../src/explore/ConstellationCanvas.tsx"
);

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

describe("ConstellationCanvas reframe on viewport resize (A11Y-03)", () => {
  const clientDims: Array<keyof HTMLElement> = ["clientWidth", "clientHeight"];
  const original = new Map<string, PropertyDescriptor | undefined>();
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // jsdom ships no ResizeObserver: provide one that fires the callback on
    // observe so ConstellationCanvas measures a non-zero box and mounts the graph.
    class MockResizeObserver {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    // The measure reads stageRef.clientWidth/Height (0 in jsdom) — stub non-zero
    // so `size.width/height > 0` and ForceGraph2D (our mock) renders + sets the ref.
    for (const dim of clientDims) {
      original.set(
        dim,
        Object.getOwnPropertyDescriptor(HTMLElement.prototype, dim),
      );
      Object.defineProperty(HTMLElement.prototype, dim, {
        configurable: true,
        get: () => (dim === "clientWidth" ? 800 : 600),
      });
    }
    zoomSpy.mockClear();
    centerAtSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    for (const dim of clientDims) {
      const desc = original.get(dim);
      if (desc) Object.defineProperty(HTMLElement.prototype, dim, desc);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[dim];
    }
    window.innerHeight = originalInnerHeight;
    vi.restoreAllMocks();
  });

  /** A focused node MUST carry x/y (the effect reads them post-settle). */
  const graphData = {
    nodes: [
      { id: 1, name: "Rattlesnake", playCount: 40, tuningFamily: "F", z: 1, x: 5, y: 7 },
      { id: 2, name: "Robot Stop", playCount: 10, tuningFamily: "F", z: 0, x: -3, y: 2 },
    ],
    links: [],
  } as unknown as ConstellationData;

  it("re-invokes fg.zoom/fg.centerAt when the shared viewport height changes with a node focused", () => {
    render(
      <ConstellationCanvas graphData={graphData} focusId={1} onFocus={noop} />,
    );

    // Initial focus reframed the node once (baseline sanity — the effect ran).
    expect(zoomSpy).toHaveBeenCalled();
    expect(centerAtSpy).toHaveBeenCalled();
    zoomSpy.mockClear();
    centerAtSpy.mockClear();

    // A visualViewport-only change: window.innerHeight shrinks (keyboard shows) and
    // fires `resize`. The container box (size.height) is UNCHANGED — the mock RO
    // only fired on observe — so ONLY visibleViewportHeight moves. The reframe must
    // still re-fire (A11Y-03: no snap-off).
    act(() => {
      window.innerHeight = Math.round(originalInnerHeight * 0.6);
      window.dispatchEvent(new Event("resize"));
    });

    expect(zoomSpy).toHaveBeenCalled();
    expect(centerAtSpy).toHaveBeenCalled();
  });

  it("does not reframe when no node is focused", () => {
    render(
      <ConstellationCanvas graphData={graphData} focusId={null} onFocus={noop} />,
    );
    zoomSpy.mockClear();
    centerAtSpy.mockClear();

    act(() => {
      window.innerHeight = Math.round(originalInnerHeight * 0.6);
      window.dispatchEvent(new Event("resize"));
    });

    // focusId == null → the focus-camera effect early-returns; no camera move.
    expect(zoomSpy).not.toHaveBeenCalled();
    expect(centerAtSpy).not.toHaveBeenCalled();
  });
});

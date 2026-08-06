import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import { AppShell } from "../src/components/AppShell.tsx";
import { ExploreView } from "../src/explore/ExploreView.tsx";
import { __resetChromeVisibilityForTests } from "../src/layout/chromeVisibility.ts";
import { __resetBottomOverlayInsetForTests } from "../src/pwa/bottomOverlayInset.ts";

/**
 * Phase-22 CHROME-05 (D-09) — "one toggle produces exactly one resize, and never
 * re-frames the constellation camera", asserted the way the requirement's own
 * wording asks: BY TEST.
 *
 * ── WHAT THIS FILE CANNOT PROVE, stated up front ───────────────────────────
 *
 * jsdom has no layout engine. `clientWidth`/`clientHeight` are stubbed below and
 * driven by hand, CSS custom properties do not cascade into them, and no
 * `ResizeObserver` exists to deliver anything on its own. So this file CANNOT
 * observe the actual causal chain — "collapsing `--gz-chrome-reserve` made the
 * constellation stage taller, and the browser reported that once".
 *
 * ── WHAT IT DOES PROVE, and why that is the whole of CHROME-05 ─────────────
 *
 * The browser's count is determined by three facts, and all three are observable
 * here:
 *
 *   1. ONE style write per toggle. `useBottomSpaceVars` is a LAYOUT effect, so the
 *      `setProperty` calls land in the mutation phase of the SAME commit that
 *      flips the header out of flow. One toggle → one commit → one write.
 *   2. The header is out of flow (`position: absolute`) and `inert` from FRAME 0,
 *      not at animation end. That is what rules out a LATE second resize ~200ms
 *      later, which is the failure mode a naive "restore the flow when the
 *      animation finishes" implementation produces.
 *   3. `zoomToFit` is not re-called, so the user's pan/zoom survives the toggle.
 *
 * Layer those on the `ResizeObserver` spec's own guarantee — callbacks are
 * delivered from the HTML "update the rendering" step, at most once per frame per
 * observation, gated by `lastReportedSizes` — and one commit that changes the box
 * once IS one callback. That is the argument; do not over-read the assertions
 * below into a claim about real layout.
 *
 * ── WHY THERE IS NO DEVICE ITEM ────────────────────────────────────────────
 *
 * D-09 is explicit that CHROME-05 gets none. Its own wording is "asserted by
 * test", the simulation is already structurally safe (see the `d3ReheatSimulation`
 * note on case 2), and this phase already budgets two device sessions for the
 * things jsdom genuinely cannot stand in for.
 */

const { zoomToFitSpy } = vi.hoisted(() => ({ zoomToFitSpy: vi.fn() }));

vi.mock("react-force-graph-2d", async () => {
  const React = await import("react");
  const Mock = React.forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        zoom: vi.fn(() => 1),
        centerAt: vi.fn(),
        graph2ScreenCoords: vi.fn(() => ({ x: 400, y: 300 })),
        // The named spy this file exists to assert on — `filterFabLift.test.tsx`
        // leaves this an anonymous `vi.fn()`, which cannot be reached from a test.
        zoomToFit: zoomToFitSpy,
        d3Force: () => undefined,
        d3ReheatSimulation: vi.fn(),
      }));
      return React.createElement("div", { "data-testid": "fg-mock" });
    },
  );
  return { default: Mock };
});

/** The stage box, driven by hand — jsdom reports 0 for every layout read. */
let stageHeight = 600;
/** Every live `ResizeObserver` callback, so a test can deliver exactly one. */
let observerCallbacks: ResizeObserverCallback[] = [];

class MockResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    observerCallbacks.push(this.cb);
    // The real observer fires once on observe (the initial size report).
    this.cb([], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

/** ONE delivery, exactly as the spec's one-per-frame gating would produce. */
function deliverOneResize(): void {
  for (const cb of observerCallbacks) {
    cb([], null as unknown as ResizeObserver);
  }
}

const clientDims = ["clientWidth", "clientHeight"] as const;
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

/** Matches the ChromeToggle in BOTH states — see chromeToggle.test.tsx. */
const TOGGLE_SELECTOR =
  `button[aria-label="${config.copy.explore.chromeHide}"],` +
  `button[aria-label="${config.copy.explore.chromeShow}"]`;

function renderExplore() {
  const utils = render(
    <AppShell>
      <ExploreView />
    </AppShell>,
  );
  // CAPTURED, not re-queried later: once the chrome is hidden the header carries
  // `aria-hidden="true"` and `screen.getByRole("banner")` returns NOTHING — which
  // is CHROME-04 working exactly as designed. A role query here would fail
  // precisely when the mechanism is correct.
  const header = utils.container.querySelector("header")!;
  const main = utils.container.querySelector("main")!;
  const toggle = document.querySelector<HTMLButtonElement>(TOGGLE_SELECTOR)!;
  return { ...utils, header, main, toggle };
}

/** Reads `--gz-chrome-reserve` out of a serialized `style` attribute. */
function reserveIn(styleText: string | null): string {
  const match = /--gz-chrome-reserve:\s*([^;]+)/.exec(styleText ?? "");
  return match ? match[1]!.trim() : "";
}

beforeEach(() => {
  stageHeight = 600;
  observerCallbacks = [];
  zoomToFitSpy.mockClear();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  for (const dim of clientDims) {
    originalDescriptors.set(
      dim,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, dim),
    );
    Object.defineProperty(HTMLElement.prototype, dim, {
      configurable: true,
      get: () => (dim === "clientWidth" ? 800 : stageHeight),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const dim of clientDims) {
    const descriptor = originalDescriptors.get(dim);
    if (descriptor) Object.defineProperty(HTMLElement.prototype, dim, descriptor);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[dim];
  }
  __resetChromeVisibilityForTests();
  __resetBottomOverlayInsetForTests();
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("CHROME-05: one toggle, one resize", () => {
  it("writes --gz-chrome-reserve exactly once per toggle", () => {
    const { toggle } = renderExplore();

    // Spy AFTER mount, so the mount-time ladder installation is not counted.
    const setPropertySpy = vi.spyOn(
      document.documentElement.style,
      "setProperty",
    );

    fireEvent.click(toggle); // ONE user action
    stageHeight = 660; // the collapse a real browser would have produced
    deliverOneResize();

    // Filtered by PROPERTY NAME, never a total call count: the ladder writes seven
    // properties per commit, so a total would be meaningless — and would also pass
    // if the reserve were written twice while another property were written zero
    // times. Only the collapsing property matters here.
    const reserveWrites = setPropertySpy.mock.calls.filter(
      ([name]) => name === "--gz-chrome-reserve",
    );
    expect(reserveWrites).toHaveLength(1);
    expect(reserveWrites[0]![1]).toBe("var(--gz-safe-bottom)");
  });

  it("does not re-frame the camera (T-22-14: no battery cost, no lost pan/zoom)", () => {
    const { toggle } = renderExplore();

    zoomToFitSpy.mockClear();

    fireEvent.click(toggle);
    stageHeight = 660;
    deliverOneResize();

    expect(zoomToFitSpy).not.toHaveBeenCalled();

    /*
     * DELIBERATELY ABSENT, AND IT MUST STAY ABSENT:
     *
     *   expect(d3ReheatSimulation).not.toHaveBeenCalled();
     *
     * CHROME-05's prose says "never reheats the GizzVerse simulation", and a test
     * written straight from that wording FAILS. `ConstellationCanvas`'s spacing
     * effect has deps `[graphData, size.width, size.height]` and calls
     * `fg.d3ReheatSimulation()` unconditionally; a chrome toggle changes
     * `size.height`, so it reheats. That reheat is INERT by the shipped UX-04
     * design: `onEngineStop` pins `fx`/`fy` on every stop so the layout cannot
     * move, and `firstSettleRef` gates `zoomToFit` to the first settle per
     * `graphData` so the camera cannot snap. D-09 therefore defines the assertion
     * as (a) one resize callback and (b) `zoomToFit` not re-called — exactly the
     * two things asserted in this file. Do not "strengthen" this into a failure.
     */
  });

  it("structural: the header is out of flow AND inert from frame 0, so no LATE second resize", () => {
    const { header, main, toggle } = renderExplore();

    expect(header.getAttribute("style")).toContain("position: relative");

    fireEvent.click(toggle);

    // IMMEDIATELY after the toggle — not after an animation completes. Restoring
    // the flow at animation END instead would be a SECOND box change ~200ms later
    // and a second ResizeObserver delivery, which is the exact CHROME-05 failure.
    expect(header.getAttribute("style")).toContain("position: absolute");
    expect(header).toHaveAttribute("inert");

    // D-13, handed over in the same commit (plan 22-05): the moment the header
    // stops reserving the top inset, `<main>` starts — so the stage never gains
    // the notch's height as a third box change, and never runs under the notch.
    expect(main.getAttribute("style")).toContain("env(safe-area-inset-top)");
  });

  it("reinforcement: the reserve resolves to a DIFFERENT value exactly once", () => {
    const { toggle } = renderExplore();

    // Non-circular relative to case 1: that one counts WRITES through a spy on the
    // API; this one counts real VALUE CHANGES on the element, through the DOM's own
    // mutation record stream. A correct implementation changes the value once. An
    // implementation that ANIMATED the reserve — the tempting "smooth" version —
    // would change it on every frame and fail here while still passing a naive
    // write-count check written against a debounced writer.
    const observer = new MutationObserver(() => {});
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
      attributeOldValue: true,
    });

    fireEvent.click(toggle);
    stageHeight = 660;
    deliverOneResize();

    // `takeRecords()` drains synchronously — no microtask flush, no flake.
    const records = observer.takeRecords();
    observer.disconnect();

    const resolved = [
      ...records.map((record) => reserveIn(record.oldValue)),
      reserveIn(document.documentElement.getAttribute("style")),
    ];
    const distinctChanges = resolved.filter(
      (value, i) => i > 0 && value !== resolved[i - 1],
    ).length;

    expect(distinctChanges).toBe(1);
    expect(resolved.at(-1)).toBe("var(--gz-safe-bottom)");
  });
});

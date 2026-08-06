import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, forwardRef, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import {
  __resetChromeVisibilityForTests,
  registerChromeToggle,
  setChromeVisible,
} from "../src/layout/chromeVisibility.ts";
import { __resetBottomOverlayInsetForTests } from "../src/pwa/bottomOverlayInset.ts";
import { AppShell } from "../src/components/AppShell.tsx";
import { ExploreView } from "../src/explore/ExploreView.tsx";

/**
 * Phase-22 CHROME-01 / CHROME-04 — the shared chrome-hide mechanism's contract,
 * asserted through its first consumer, `AppShell`.
 *
 * This file covers the STORE → SHELL half: one store flip must collapse the
 * bottom-space reserve, take the header out of flow, hand `<main>` the top
 * safe-area inset, inert BOTH chrome surfaces and start a transform-only slide.
 * Plan 22-07 extends this same file with the user-facing control's own cases
 * (the toggle's label swap, its always-visible escapability and Escape wiring).
 *
 * MOCKING `motion/react` IS CORRECT HERE, and does not make anything vacuous:
 * the chrome is deliberately NOT an `AnimatePresence` child (see AppShell.tsx),
 * so there is no deferred-unmount window to observe. Every prop under test
 * re-renders normally on a store change, so a pass-through double that re-emits
 * `animate` / `transition` as `data-*` JSON proves exactly what matters.
 *
 * DELIBERATELY NOT TESTED (22-VALIDATION.md § Structural / By Construction):
 * that a cold boot starts visible (a fresh module evaluation IS the visible
 * state — the test would assert `true === true`), and that the control "stays in
 * the same place" (screen position is not observable in a layout-free jsdom).
 *
 * ── PLAN 22-07 ADDITION: the CONTROL half ──────────────────────────────────
 *
 * Plan 22-05 shipped the mechanism with no way to ENTER the hidden state. The
 * `ChromeToggle` describe blocks at the bottom of this file cover the first (and
 * only) entry point together with every way out, because a phase boundary may not
 * leave an installed-PWA user able to strand themselves (T-22-12).
 *
 * They render `<AppShell><ExploreView /></AppShell>` so the toggle is exercised at
 * its real mount point and in its real document order, which is the whole basis of
 * the tab-order case. `react-force-graph-2d` is mocked purely so importing
 * `ConstellationCanvas` is safe under jsdom — the canvas itself never renders here
 * (`size` stays 0×0 without a `ResizeObserver`), and nothing in these cases depends
 * on it. `test/chromeResize.test.tsx` is where the canvas is driven for real.
 */

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", () => {
  /**
   * The double is CACHED PER TAG, which the shipped `WaveToast` mock does not
   * need to be. `motion.header` is read during every render, and an uncached
   * Proxy hands back a BRAND-NEW `forwardRef` component type each time — React
   * then treats it as a different element type and unmounts/remounts the header
   * on every store flip. That is a pure artifact of the double (the real
   * `motion.header` is a stable reference), and it would silently invalidate
   * every assertion in this file that holds an element across an `act()`.
   */
  const cache = new Map<string, unknown>();
  return {
    useReducedMotion: () => motionState.reduced,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => {
          const hit = cache.get(tag);
          if (hit) return hit;
          const component = forwardRef(
            (
              {
                initial,
                animate,
                exit,
                transition,
                ...rest
              }: Record<string, unknown>,
              ref: unknown,
            ) =>
              createElement(tag, {
                ...rest,
                ref,
                "data-initial": JSON.stringify(initial),
                "data-animate": JSON.stringify(animate),
                "data-transition": JSON.stringify(transition),
              }),
          );
          cache.set(tag, component);
          return component;
        },
      },
    ),
  };
});

/**
 * Import-safety mock only (see the header). ConstellationCanvas gates
 * `<ForceGraph2D>` on a measured non-zero box, and jsdom ships no
 * `ResizeObserver`, so this component is never actually rendered in this file.
 */
vi.mock("react-force-graph-2d", async () => {
  const React = await import("react");
  const Mock = React.forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        zoom: vi.fn(),
        centerAt: vi.fn(),
        zoomToFit: vi.fn(),
        d3Force: () => undefined,
        d3ReheatSimulation: vi.fn(),
      }));
      return React.createElement("div", { "data-testid": "fg-mock" });
    },
  );
  return { default: Mock };
});

function makeSetPropertySpy() {
  return vi.spyOn(document.documentElement.style, "setProperty");
}
type SetPropertySpy = ReturnType<typeof makeSetPropertySpy>;

/** Every value written for custom property `name`, oldest first. */
function writesOf(spy: SetPropertySpy, name: string): string[] {
  return spy.mock.calls
    .filter((call) => call[0] === name)
    .map((call) => String(call[1]));
}

function lastWrite(spy: SetPropertySpy, name: string): string | undefined {
  return writesOf(spy, name).at(-1);
}

/** Installs the ladder spy BEFORE the first render, then mounts the shell. */
function renderShell() {
  const spy = makeSetPropertySpy();
  const utils = render(
    createElement(AppShell, { children: "content" }) as ReactNode,
  );
  const header = utils.container.querySelector("header")!;
  const nav = utils.container.querySelector("nav")!;
  const main = utils.container.querySelector("main")!;
  return { ...utils, spy, header, nav, main };
}

/** Reads the pass-through double's re-emitted `animate` / `transition` JSON. */
function dataJson(el: Element, name: string): Record<string, unknown> {
  return JSON.parse(el.getAttribute(name)!) as Record<string, unknown>;
}

afterEach(() => {
  cleanup();
  __resetChromeVisibilityForTests();
  __resetBottomOverlayInsetForTests();
  vi.restoreAllMocks();
  motionState.reduced = false;
});

describe("CHROME-01: one store flip collapses the chrome reserve", () => {
  it("the visible default writes the UNCOLLAPSED reserve", () => {
    const { spy, header } = renderShell();

    expect(lastWrite(spy, "--gz-chrome-reserve")).toBe("var(--gz-tab-bar-box)");
    // Visible chrome carries neither a11y suppression.
    expect(header).not.toHaveAttribute("inert");
    expect(header).not.toHaveAttribute("aria-hidden");
  });

  it("flipping the store collapses the reserve, leaving the bar's own box alone", () => {
    const { spy } = renderShell();

    act(() => setChromeVisible(false));

    expect(lastWrite(spy, "--gz-chrome-reserve")).toBe("var(--gz-safe-bottom)");

    // The never-collapsing property, stated positively: whatever
    // `--gz-tab-bar-box` was written as, it was written identically in BOTH
    // states. If it collapsed with the reserve, the bar would squash to a bare
    // safe-area strip and `translateY(100%)` would leave a visible sliver.
    const boxWrites = writesOf(spy, "--gz-tab-bar-box");
    expect(boxWrites.length).toBeGreaterThan(1);
    expect(new Set(boxWrites).size).toBe(1);
  });
});

describe("CHROME-04: hidden chrome is inert and out of the a11y tree", () => {
  /**
   * WHY THE ATTRIBUTE ASSERTION WORKS HERE BUT NOT FOR `inertRoot.ts`: probe P8
   * confirmed jsdom 29.1.1 implements no `inert`, so the imperative
   * `el.inert = true` sets a plain JS expando and reflects NO attribute at all.
   * React's JSX `inert` prop is the only form that renders a real attribute
   * under jsdom — which is exactly why the chrome uses the prop rather than
   * joining the ref-counted helper.
   */
  it("both chrome surfaces carry inert + aria-hidden while hidden, neither while visible", () => {
    const { header, nav } = renderShell();

    expect(header).not.toHaveAttribute("inert");
    expect(header).not.toHaveAttribute("aria-hidden");
    expect(nav).not.toHaveAttribute("inert");
    expect(nav).not.toHaveAttribute("aria-hidden");
    // Positive proof they ARE reachable while visible.
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("navigation")).toBe(nav);

    act(() => setChromeVisible(false));

    expect(header).toHaveAttribute("inert");
    expect(header).toHaveAttribute("aria-hidden", "true");
    expect(nav).toHaveAttribute("inert");
    expect(nav).toHaveAttribute("aria-hidden", "true");
    // T-22-13: a keyboard or VoiceOver user can no longer reach the header's
    // Menu button or any tab — both surfaces have left the accessibility tree.
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("hidden chrome is OUT OF FLOW, not merely translated", () => {
    const { header, nav } = renderShell();

    expect(header.getAttribute("style")).toContain("position: relative");
    expect(dataJson(header, "data-animate").y).toBe(0);
    expect(dataJson(nav, "data-animate").y).toBe(0);

    act(() => setChromeVisible(false));

    // OQ3: `absolute`, so the header holds no layout from frame 0 and the
    // constellation gains its height immediately. Merely translating it would
    // leave a header-sized hole at the top of the flow for the whole hide.
    expect(header.getAttribute("style")).toContain("position: absolute");
    expect(dataJson(header, "data-animate").y).toBe("-100%");
    // The bar is already `fixed bottom-0`, so it needs no flow change — only
    // the header does. It slides the opposite way.
    expect(dataJson(nav, "data-animate").y).toBe("100%");
  });
});

describe("D-13: the top safe-area inset is never surrendered", () => {
  /**
   * This assertion stands in for "the constellation does not run under the
   * notch", which jsdom cannot observe directly — the inset resolves to `0`
   * there, and there is no layout engine to run it through. What IS observable
   * is that SOMETHING still reserves the top inset once the header leaves the
   * flow, which is the whole of the T-22-24 regression.
   *
   * Note the value is `calc(env(safe-area-inset-top))`, not a bare
   * `env(safe-area-inset-top)`: jsdom's CSS parser drops a bare `env()` value
   * outright, so a bare read would make this test pass vacuously in BOTH states.
   * The single-term `calc()` is arithmetically identical in a real browser.
   */
  it("<main> picks up the inset the header stopped reserving, and only while hidden", () => {
    const { main } = renderShell();

    expect(main.getAttribute("style")).not.toContain("env(safe-area-inset-top)");

    act(() => setChromeVisible(false));

    expect(main.getAttribute("style")).toContain("env(safe-area-inset-top)");
  });
});

describe("D-07: reduced motion removes the animation phase entirely", () => {
  it("the chrome transition duration is 0 under prefers-reduced-motion", () => {
    motionState.reduced = true;

    const { header, nav } = renderShell();

    // INSTANT, not merely faster — and deliberately unlike the sheet rule
    // (D-24), where sheets keep an opacity cross-fade under reduced motion.
    expect(dataJson(header, "data-transition").duration).toBe(0);
    expect(dataJson(nav, "data-transition").duration).toBe(0);
  });

  it("without the preference the transition is the configured chrome duration", () => {
    const { header } = renderShell();

    expect(dataJson(header, "data-transition").duration).toBe(
      config.ui.motion.CHROME_DURATION_MS / 1000,
    );
  });
});

describe("the header's toggle slot follows the store's mount count", () => {
  it("reserves the slot only while a toggle is mounted, and restores the chrome on unregister", () => {
    const { header } = renderShell();
    const controls = screen.getByTestId("app-header-controls");
    const slot = `padding-right: ${config.ui.chrome.CHROME_TOGGLE_SLOT_PX}px`;

    expect(controls.getAttribute("style") ?? "").not.toContain("padding-right");

    let unregister: () => void = () => {};
    act(() => {
      unregister = registerChromeToggle();
    });
    expect(controls.getAttribute("style")).toContain(slot);

    // Now hide the chrome, exactly as the real control would.
    act(() => setChromeVisible(false));
    expect(header).toHaveAttribute("inert");

    act(() => unregister());

    // The slot is released...
    expect(controls.getAttribute("style") ?? "").not.toContain("padding-right");
    // ...and D-11's "leaving GizzVerse resets the hidden state" holds with no
    // storage whatsoever: the toggle unmounts with its view, the mount count
    // returns to 0, and the chrome is forced back unconditionally. This is the
    // second half of T-22-12 — no route change can strand a user in a hidden
    // state whose only escape control has just unmounted.
    expect(header).not.toHaveAttribute("inert");
    expect(header).not.toHaveAttribute("aria-hidden");
  });
});

/* ========================================================================== *
 * PLAN 22-07 — the CONTROL half: ChromeToggle at its real mount point
 * ========================================================================== */

/**
 * Matches the toggle in BOTH states, by the two copy strings it can carry. A
 * `querySelector` rather than `getByRole` on purpose: role queries are the right
 * tool for the chrome (case 3 above uses their FAILURE as a positive CHROME-04
 * assertion), but they are the wrong tool for an escape control — if a regression
 * ever put the toggle inside an `aria-hidden` subtree, a role query would return
 * `null` and the "it is still there" assertions would fail for the *right* reason
 * but the "it is gone" reasoning would be invisible. Matching the DOM directly
 * keeps every assertion below about the element itself.
 */
const TOGGLE_SELECTOR =
  `button[aria-label="${config.copy.explore.chromeHide}"],` +
  `button[aria-label="${config.copy.explore.chromeShow}"]`;

/** The tab-order selector, mirroring `components/a11y/useFocusTrap.ts`'s FOCUSABLE. */
const FOCUSABLE_SELECTOR =
  "a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled])," +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC_DIR, relPath), "utf8");
}

/** Mounts the toggle at its REAL mount point, inside the real shell. */
function renderExplore() {
  const spy = makeSetPropertySpy();
  const utils = render(
    createElement(AppShell, { children: createElement(ExploreView) }),
  );
  const header = utils.container.querySelector("header")!;
  const toggle = document.querySelector<HTMLButtonElement>(TOGGLE_SELECTOR)!;
  return { ...utils, spy, header, toggle };
}

describe("CHROME-03: the escape control is rendered, big enough and inside the safe area — in BOTH states", () => {
  /**
   * 22-VALIDATION §"Carried Limitation from Phase 21" requires a POSITIVE
   * rendered-DOM assertion for a new surface: guard silence is not enough,
   * because a pattern-matching source guard cannot catch an omission.
   */
  it("survives the flip it causes — same node, still 44px, still inset", () => {
    const { toggle } = renderExplore();

    expect(toggle).toBeInTheDocument();
    expect(toggle.className).toContain("min-h-11");
    expect(toggle.className).toContain("min-w-11");
    expect(toggle.style.width).toBe(
      `${config.ui.chrome.CHROME_TOGGLE_SIZE_PX}px`,
    );
    expect(toggle.style.height).toBe(
      `${config.ui.chrome.CHROME_TOGGLE_SIZE_PX}px`,
    );

    // jsdom's CSS parser REORDERS a `calc()` sum's terms (probed: the authored
    // `calc(env(safe-area-inset-top) + 12px)` serializes as
    // `calc(12px + env(safe-area-inset-top))`), so this asserts the normalized
    // form. It is still non-vacuous in the way that matters: a bare `env()` value
    // is DROPPED entirely by jsdom, so if the inset term were ever lost the
    // declaration would be absent, not merely reordered. The verbatim-copy half
    // of D-13 is asserted at the source below.
    expect(toggle.style.top).toBe("calc(12px + env(safe-area-inset-top))");
    expect(toggle.style.right).toBe("calc(16px + env(safe-area-inset-right))");

    // The whole point: the control does not go anywhere when the chrome does.
    act(() => setChromeVisible(false));

    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toHaveAttribute("inert");
    expect(toggle.closest("[inert]")).toBeNull();
    expect(toggle.className).toContain("min-h-11");
    expect(toggle.className).toContain("min-w-11");
    expect(toggle.style.top).toBe("calc(12px + env(safe-area-inset-top))");
    expect(toggle.style.right).toBe("calc(16px + env(safe-area-inset-right))");
  });

  it("D-13: reuses the app's ONE top-inset expression verbatim, inventing no second formula", () => {
    // The rendered assertion above can only see jsdom's normalized serialization,
    // which would happily accept a hand-rolled `calc(12px + env(...))`. D-13's
    // actual rule is about the SOURCE: one expression, copied, never a second one
    // that can drift from it. So read both files and compare the literal string.
    const expression = "calc(env(safe-area-inset-top) + 12px)";
    expect(readSrc("components/AppShell.tsx")).toContain(expression);
    expect(readSrc("explore/ChromeToggle.tsx")).toContain(expression);
  });
});

describe("CHROME-01 / D-05: the accessible name always names the NEXT action", () => {
  it("swaps Hide↔Show with the state and carries no toggle ARIA state", () => {
    const { toggle } = renderExplore();

    expect(toggle).toHaveAttribute(
      "aria-label",
      config.copy.explore.chromeHide,
    );

    act(() => setChromeVisible(false));

    expect(toggle).toHaveAttribute(
      "aria-label",
      config.copy.explore.chromeShow,
    );

    // D-05: the name carries the state, so the app's shipped `Menu`/`Close menu`
    // idiom is preserved and no new ARIA idiom is introduced on the one control
    // that must never confuse anyone in the dark.
    expect(toggle).not.toHaveAttribute("aria-pressed");
    expect(toggle).not.toHaveAttribute("aria-expanded");
  });
});

describe("CHROME-01: one tap hides the bars, the SAME control brings them back", () => {
  it("round-trips the header and the chrome reserve across two clicks of one node", () => {
    const { spy, header, toggle } = renderExplore();

    expect(header).not.toHaveAttribute("inert");
    expect(lastWrite(spy, "--gz-chrome-reserve")).toBe("var(--gz-tab-bar-box)");

    fireEvent.click(toggle);

    expect(header).toHaveAttribute("inert");
    expect(lastWrite(spy, "--gz-chrome-reserve")).toBe("var(--gz-safe-bottom)");

    // Deliberately the SAME element reference, never re-queried: that is what
    // proves the control did not remount, move or get swapped for a second
    // button between the two states (D-01's "the same pixel in both states").
    fireEvent.click(toggle);

    expect(header).not.toHaveAttribute("inert");
    expect(lastWrite(spy, "--gz-chrome-reserve")).toBe("var(--gz-tab-bar-box)");
  });
});

describe("CHROME-03: while hidden, the escape control leads the document's tab order", () => {
  it("is index 0 of the non-inert focusables, with no positive tabIndex", () => {
    const { toggle } = renderExplore();

    act(() => setChromeVisible(false));

    // The header and the tab bar are `inert` now, so their controls are out of
    // the tab order entirely — `inert` is inherited, hence the ancestor check
    // rather than an attribute check on each candidate.
    const reachable = Array.from(
      document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.closest("[inert]") == null);

    // INDEX 0, not mere membership: "reachable somewhere below a canvas the user
    // cannot see out of" is not an escape route. One Tab from a cold document
    // must land here.
    expect(reachable[0]).toBe(toggle);

    // A positive tabIndex would jump ahead of the whole document's natural order
    // and break the moment a modal opens — DOM order is doing this job instead.
    expect(toggle.tabIndex).toBeLessThanOrEqual(0);
  });
});

describe("CHROME-03 / D-04: Escape restores the chrome, and only when it is hidden", () => {
  it("restores from hidden, and is a no-op (never an error) while visible", () => {
    const { header, toggle } = renderExplore();

    fireEvent.click(toggle);
    expect(header).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(header).not.toHaveAttribute("inert");
    expect(header).not.toHaveAttribute("aria-hidden");
    expect(toggle).toHaveAttribute(
      "aria-label",
      config.copy.explore.chromeHide,
    );

    // T-22-26: `useDialogDismiss` is active ONLY while hidden, so in the normal
    // state this control contributes nothing to the shared LIFO stack and one
    // Escape still closes exactly one thing (a sheet, not the chrome-that-is-
    // already-visible). Nothing changes and nothing throws.
    expect(() =>
      fireEvent.keyDown(document, { key: "Escape" }),
    ).not.toThrow();
    expect(header).not.toHaveAttribute("inert");
    expect(toggle).toHaveAttribute(
      "aria-label",
      config.copy.explore.chromeHide,
    );
  });
});

describe("T-22-25: the escape control outranks the chrome it controls", () => {
  it("renders at z.fab inline, strictly above the chrome tier", () => {
    const { toggle } = renderExplore();

    // Inline, never a Tailwind `z-*` class — the ladder lives in config.ui.z.
    expect(toggle.style.zIndex).toBe(String(config.ui.z.fab));
    expect(toggle.className).not.toMatch(/(^|\s)z-/);

    // The numeric guard plan 22-01 added to layerOrder.test.tsx, re-asserted here
    // at the RENDERED level: if the sliding chrome could paint over this button,
    // the user's only visible escape would be covered for the whole hide.
    expect(config.ui.z.chrome).toBeLessThan(config.ui.z.fab);
  });
});

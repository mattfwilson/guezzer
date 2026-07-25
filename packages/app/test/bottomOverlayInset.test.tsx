import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetBottomOverlayInsetForTests,
  setBottomOverlayHeight,
  useBottomOverlayInset,
} from "../src/pwa/bottomOverlayInset";
import { AppShell } from "../src/components/AppShell";

/**
 * Debug session: start-show-not-clickable. Root cause was AppShell's
 * `<main>` reserving a single static `pb-16` (64px) for the BottomTabBar
 * only — any OTHER fixed-bottom overlay (InstallBanner's iOS instructions in
 * particular) could render taller than that and silently cover/intercept
 * taps on page content underneath (the reported symptom: PreShowLauncher's
 * "Start Show" button was untappable). These tests cover the fix: the shared
 * bottomOverlayInset store, and AppShell reserving real registered height on
 * top of its base reservation instead of a fixed guess.
 */

function Probe() {
  const inset = useBottomOverlayInset();
  return <div data-testid="inset">{inset}</div>;
}

describe("bottomOverlayInset store", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  it("defaults to 0 when nothing is registered", () => {
    render(<Probe />);
    expect(screen.getByTestId("inset").textContent).toBe("0");
  });

  it("reflects a registered overlay's real measured height", () => {
    render(<Probe />);
    act(() => setBottomOverlayHeight("installBanner", 220));
    expect(screen.getByTestId("inset").textContent).toBe("220");
  });

  it("sums multiple simultaneously-registered overlays", () => {
    render(<Probe />);
    act(() => {
      setBottomOverlayHeight("installBanner", 220);
      setBottomOverlayHeight("updateToast", 72);
    });
    expect(screen.getByTestId("inset").textContent).toBe("292");
  });

  it("clears a registration once its height drops to 0 (hidden/unmounted)", () => {
    render(<Probe />);
    act(() => setBottomOverlayHeight("installBanner", 220));
    act(() => setBottomOverlayHeight("installBanner", 0));
    expect(screen.getByTestId("inset").textContent).toBe("0");
  });
});

/**
 * Phase-21 FOUND-02 conversion. `<main>` no longer hand-writes
 * `calc(4rem + env(...) + Npx)`; it reserves `var(--gz-content-reserve)`, and the
 * measured overlay height reaches that composition through `--gz-overlay-inset` on
 * `document.documentElement` (layout/bottomSpace.ts, the single owner).
 *
 * The regression this file exists to guard is UNCHANGED: a tall InstallBanner's REAL
 * rendered height must still be reserved, never a static guess. So the assertion now
 * checks both halves of the new path — that `<main>` reserves the content
 * composition, and that the composition's overlay term carries the registered height.
 *
 * Read the reservation off the `style` ATTRIBUTE, not `main.style.paddingBottom`:
 * jsdom's CSS parser does not reliably round-trip a `var()` value through a typed
 * longhand property.
 */
function expectPaddingBottom(main: HTMLElement, px: number): void {
  expect(main.getAttribute("style")).toContain("var(--gz-content-reserve)");
  expect(
    document.documentElement.style.getPropertyValue("--gz-overlay-inset"),
  ).toBe(`${px}px`);
}

describe("AppShell bottom padding reservation", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  it("reserves only the base chrome (BottomTabBar) when no overlay is registered", () => {
    const { container } = render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expectPaddingBottom(main!, 0);
  });

  it("adds a tall overlay's real height on top of the base reservation — the exact fix for the untappable Start Show button", () => {
    const { container } = render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    // 220px models InstallBanner's iOS-instructions branch, which comfortably
    // exceeds the old static 64px (pb-16) reservation that caused the bug.
    act(() => setBottomOverlayHeight("installBanner", 220));
    const main = container.querySelector("main");
    expectPaddingBottom(main!, 220);
  });

  it("shrinks the reservation back down once the overlay is dismissed", () => {
    const { container } = render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    act(() => setBottomOverlayHeight("installBanner", 220));
    act(() => setBottomOverlayHeight("installBanner", 0));
    const main = container.querySelector("main");
    expectPaddingBottom(main!, 0);
  });
});

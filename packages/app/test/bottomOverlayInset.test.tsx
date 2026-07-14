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

// jsdom's CSSOM re-serializes `calc()` term order (e.g. "4rem + 0px" comes
// back out as "0px + 4rem") — functionally identical (addition commutes), so
// assertions below check both terms are present rather than exact string
// equality, which would be coupled to jsdom's serialization quirk.
function expectPaddingBottom(main: HTMLElement, px: number): void {
  const value = main.style.paddingBottom;
  expect(value).toContain("4rem");
  expect(value).toContain(`${px}px`);
}

describe("AppShell bottom padding reservation", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  it("reserves only the base 4rem (BottomTabBar) when no overlay is registered", () => {
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

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetBottomOverlayInsetForTests,
  setBottomOverlayHeight,
  useBottomOverlayInset,
} from "../src/pwa/bottomOverlayInset";
import { AppShell } from "../src/components/AppShell";
import { bottomSpaceVarEntries } from "../src/layout/bottomSpace";

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
    // exceeds the static tab-bar-only reservation that caused the bug.
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

/**
 * FOUND-02 / D-03 — the store feeds the CONTENT reserve only.
 *
 * The measured height reaches layout through exactly one term,
 * `--gz-overlay-inset`, which `--gz-content-reserve` adds on top of
 * `--gz-chrome-reserve`. The chrome reserve must be byte-identical whether an
 * overlay is registered or not: it is what every fixed-bottom surface (the five
 * toasts, both FABs) pins itself to, so letting a transient banner move it would
 * make every one of them jump when the banner appeared.
 *
 * PLAN-21-10 CORRECTION, recorded here because this is the file that measures it:
 * `useBottomOverlayHeightRegistration` reads `el.offsetHeight`. InstallBanner,
 * UpdateToast and BackupToast used to set their own `paddingBottom` from a raw
 * safe-area bottom read — compensation for a bottom offset that sat one inset too
 * low — so their measured height was one safe-area inset LARGER than what they
 * actually needed, and `<main>` over-reserved by that inset whenever one was
 * visible. Plan 21-10 pinned all five overlays to `var(--gz-chrome-reserve)` and
 * deleted those three paddings in the same edits, so the measured height is now the
 * real rendered height.
 *
 * The reserve on scrolling routes therefore got SMALLER by one inset while one of
 * those three toasts is visible. That direction is the correction, not a regression —
 * but under-reserving is the failure mode that covers a control, so it is explicitly
 * re-checked on an installed instance in 21-13 UAT test 2 rather than trusted from
 * arithmetic alone.
 */
describe("D-03: the measured overlay height feeds the content reserve only", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  function varsFor(overlayInsetPx: number): Record<string, string> {
    return Object.fromEntries(bottomSpaceVarEntries(overlayInsetPx));
  }

  it("a registered overlay's height lands verbatim in --gz-overlay-inset", () => {
    render(<Probe />);
    act(() => setBottomOverlayHeight("updateToast", 72));
    const inset = Number(screen.getByTestId("inset").textContent);
    expect(inset).toBe(72);
    expect(varsFor(inset)["--gz-overlay-inset"]).toBe("72px");
  });

  it("--gz-chrome-reserve is identical at 0 and at a registered height", () => {
    // Every fixed-bottom surface composes from this one. If a transient toast
    // could move it, the tab bar, both FABs and the other four toasts would all
    // shift the moment that toast appeared.
    expect(varsFor(72)["--gz-chrome-reserve"]).toBe(
      varsFor(0)["--gz-chrome-reserve"],
    );
  });

  it("--gz-overlay-inset DOES differ between the two — the reserve is live", () => {
    expect(varsFor(72)["--gz-overlay-inset"]).not.toBe(
      varsFor(0)["--gz-overlay-inset"],
    );
    expect(varsFor(0)["--gz-overlay-inset"]).toBe("0px");
  });

  it("reserves the REAL rendered height — no safe-area term is added on top", () => {
    // The plan-21-10 correction, asserted rather than described: whatever the
    // overlay measured is what gets reserved. If a future edit re-introduced a
    // self-padding compensation, that inset would show up inside this value (the
    // store's own input), and if the composition ever grew a second safe-area term
    // the string below would stop being a bare px value.
    expect(varsFor(220)["--gz-overlay-inset"]).toBe("220px");
    expect(varsFor(220)["--gz-overlay-inset"]).not.toContain("safe");
    expect(varsFor(220)["--gz-overlay-inset"]).not.toContain("calc");
  });
});

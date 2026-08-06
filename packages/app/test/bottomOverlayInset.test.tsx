import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetBottomOverlayInsetForTests,
  offsetBelow,
  setBottomOverlayHeight,
  useBottomOverlayHeightRegistration,
  useBottomOverlayInset,
  useBottomOverlayOffset,
} from "../src/pwa/bottomOverlayInset";
import { AppShell } from "../src/components/AppShell";
import { BackupToast, showBackupToast } from "../src/components/BackupToast";
import { config } from "../src/config";
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

/**
 * Phase-22 CR-01 — ORDERED STACKING.
 *
 * Everything above measures heights. Until this phase the store had no ORDERING
 * concept: every registered overlay pinned itself to the same
 * `bottom: var(--gz-chrome-reserve)`, so two simultaneously-visible overlays
 * painted on top of each other while `--gz-content-reserve` reserved the SUM of
 * both boxes — safe (nothing was covered) but wrong (over-reserved by the height
 * of the shorter one).
 *
 * `config.ui.BOTTOM_OVERLAY_ORDER` (bottom-most first) now declares the order and
 * `offsetBelow(id)` does the arithmetic. These cases assert the behaviour, not
 * the wiring: distinct offsets in DECLARED order, a sum that is now the genuinely
 * occupied height, a stack that re-flows on unregister, and an unknown id that
 * ranks topmost instead of throwing.
 */
describe("CR-01: overlays stack in declared order instead of overlapping", () => {
  afterEach(() => {
    cleanup();
    __resetBottomOverlayInsetForTests();
  });

  it("gives two simultaneously-visible overlays distinct offsets, in declared order", () => {
    // Registered top-most FIRST — deliberately the reverse of the declared
    // order. If `offsetBelow` were reading registration/insertion order rather
    // than `config.ui.BOTTOM_OVERLAY_ORDER`, this case would invert.
    act(() => {
      setBottomOverlayHeight("waveToast", 60);
      setBottomOverlayHeight("installBanner", 220);
    });
    expect(offsetBelow("installBanner")).toBe(0); // bottom-most: nothing below
    expect(offsetBelow("waveToast")).toBe(220); // sits above the banner

    // A third overlay lands BETWEEN them in the declared order even though it
    // registered last.
    act(() => setBottomOverlayHeight("updateToast", 48));
    expect(offsetBelow("waveToast")).toBe(268); // 220 + 48
    expect(offsetBelow("updateToast")).toBe(220); // banner only
    expect(offsetBelow("installBanner")).toBe(0); // persistent: never jumps
  });

  it("<main>'s reserve equals the REAL occupied height once they stack", () => {
    render(<Probe />);
    act(() => {
      setBottomOverlayHeight("installBanner", 220);
      setBottomOverlayHeight("waveToast", 60);
      setBottomOverlayHeight("updateToast", 48);
    });
    // This is the same sum the shipped "sums multiple simultaneously-registered
    // overlays" case asserts, and that case is deliberately left untouched — but
    // its MEANING changed. Before CR-01 the three boxes overlapped, so 328 was an
    // over-reservation of the tallest box plus two it painted over. Now they
    // genuinely stack, so 328 IS the occupied height. `layout/bottomSpace.ts`
    // needed no change for that to become true.
    expect(screen.getByTestId("inset").textContent).toBe("328");
    // Stated as geometry rather than as a second copy of the sum: `waveToast` is
    // top-most, so the top of the stack sits at (everything below it) + (its own
    // height) — and that IS the reserve. The two agree because the boxes no
    // longer overlap.
    const topOfStack = offsetBelow("waveToast") + 60;
    expect(topOfStack).toBe(328);
  });

  it("re-flows the stack when an overlay unregisters", () => {
    act(() => {
      setBottomOverlayHeight("installBanner", 220);
      setBottomOverlayHeight("updateToast", 48);
      setBottomOverlayHeight("waveToast", 60);
    });
    expect(offsetBelow("waveToast")).toBe(268);
    act(() => setBottomOverlayHeight("installBanner", 0));
    // The banner is gone; the wave drops by exactly its height. Nothing is
    // stranded at an offset that no longer has anything under it.
    expect(offsetBelow("waveToast")).toBe(48);
    expect(offsetBelow("updateToast")).toBe(0);
  });

  it("ranks an UNDECLARED id topmost and never throws", () => {
    act(() => {
      setBottomOverlayHeight("installBanner", 220);
      setBottomOverlayHeight("waveToast", 60);
    });
    // An overlay that forgot to declare its position must still render — above
    // everything — rather than crash the app mid-show. The omission is caught by
    // the source guard below, which is where it is supposed to hurt.
    expect(() => offsetBelow("notDeclared")).not.toThrow();
    expect(offsetBelow("notDeclared")).toBe(280);
  });

  it("gives TWO undeclared ids DISTINCT offsets rather than colliding them (WR-07)", () => {
    // The shipped fallback returned a flat `order.length` for every unknown id,
    // and `offsetBelow`'s sum uses a STRICT `<` — so two simultaneously-visible
    // undeclared overlays got IDENTICAL offsets and painted on top of each other
    // while the content reserve reserved BOTH boxes. That is verbatim the
    // pre-CR-01 defect this feature exists to remove, reachable through the
    // fallback the source guard is supposed to make unnecessary. The guard only
    // matches string literals at the call site, so an id passed through a
    // variable or built by template literal reaches here silently.
    act(() => {
      setBottomOverlayHeight("installBanner", 220);
      setBottomOverlayHeight("undeclaredA", 40);
      setBottomOverlayHeight("undeclaredB", 30);
    });

    // Both still rank ABOVE every declared overlay...
    expect(offsetBelow("undeclaredA")).toBeGreaterThanOrEqual(220);
    expect(offsetBelow("undeclaredB")).toBeGreaterThanOrEqual(220);
    // ...but they no longer share a rank, so they stack instead of overlapping.
    expect(offsetBelow("undeclaredA")).not.toBe(offsetBelow("undeclaredB"));
    // First-seen order, deterministically: A is below B, so B clears A's height.
    expect(offsetBelow("undeclaredA")).toBe(220);
    expect(offsetBelow("undeclaredB")).toBe(260);

    // The whole stack is genuinely occupied, not over-reserved: the top of the
    // stack equals the sum every consumer of `useBottomOverlayInset` reserves.
    expect(offsetBelow("undeclaredB") + 30).toBe(220 + 40 + 30);
  });

  it("returns a referentially-stable NUMBER between notifies (the React 19 footgun)", () => {
    act(() => setBottomOverlayHeight("installBanner", 220));
    const first = offsetBelow("waveToast");
    const second = offsetBelow("waveToast");
    // A fresh object here would make React 19 report "The result of getSnapshot
    // should be cached to avoid an infinite loop" and re-render forever. A
    // primitive compares by value under Object.is, so the loop is unreachable.
    expect(typeof first).toBe("number");
    expect(Object.is(first, second)).toBe(true);

    // The hook itself: rendering it must settle, not loop.
    let renders = 0;
    function OffsetProbe() {
      renders += 1;
      const offset = useBottomOverlayOffset("waveToast");
      return <div data-testid="offset">{offset}</div>;
    }
    render(<OffsetProbe />);
    expect(screen.getByTestId("offset").textContent).toBe("220");
    const settled = renders;
    act(() => setBottomOverlayHeight("updateToast", 48));
    expect(screen.getByTestId("offset").textContent).toBe("268");
    // One notify, a bounded number of extra renders — not an unbounded loop.
    expect(renders - settled).toBeLessThanOrEqual(2);
  });

  it("renders the composed offset on a real overlay — chrome reserve PLUS the px term", () => {
    // A rendered-DOM check, not guard silence (22-VALIDATION §Carried Limitation).
    // `backupToast` sits above `installBanner` in the declared order, so with a
    // 220px banner registered its box must start 220px higher than the reserve.
    act(() => setBottomOverlayHeight("installBanner", 220));
    const { container } = render(<BackupToast />);
    act(() => showBackupToast());

    const toast = container.querySelector('[role="status"]');
    expect(toast).not.toBeNull();
    const style = toast!.getAttribute("style") ?? "";
    // Both halves matter: the offset must be ADDITIVE to the reserve, never a
    // replacement for it — that is what keeps every overlay following the
    // plan-22-05 chrome collapse with no special case (D-15).
    expect(style).toContain("var(--gz-chrome-reserve)");
    expect(style).toContain("220px");
  });
});

/**
 * 22-REVIEW WR-06 — the registration must follow the ELEMENT, not only the flags.
 *
 * The hook used to hold a `useRef` and dep on `[id, visible]`, capturing
 * `ref.current` once. `BingoCelebration` keys its toast on a monotonic counter and
 * replaces it on a repeat emit WITHOUT passing through null, so the key changes,
 * React mounts a new element, the old one begins its exit — and `visible`
 * (`toast != null`) never changed, so the effect never re-ran. The registered
 * height stayed whichever toast was measured FIRST, which for a short mark toast
 * followed by a longer badge string means the content reserve UNDER-reserves for
 * what is actually on screen.
 *
 * jsdom has no layout, so `offsetHeight` is stubbed off a `data-h` attribute for
 * these two cases only — the hook's one real input, made observable.
 */
describe("WR-06: the registration re-measures when the element is swapped", () => {
  let restoreOffsetHeight: (() => void) | undefined;

  beforeEach(() => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement): number {
        return Number(this.dataset.h ?? "0");
      },
    });
    restoreOffsetHeight = () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)
          .offsetHeight;
      }
    };
  });

  afterEach(() => {
    cleanup();
    restoreOffsetHeight?.();
    __resetBottomOverlayInsetForTests();
  });

  /**
   * Models the `AnimatePresence` shape without pulling the motion library in:
   * `ids` is the list of currently-MOUNTED toast elements, so `[1]` → `[1, 2]` is
   * "a replacement mounted while the outgoing one is still on screen" and
   * `[1, 2]` → `[2]` is "the outgoing one finally left". Every element shares the
   * one callback ref, exactly as the real toasts do.
   */
  const HEIGHTS: Record<number, number> = { 1: 40, 2: 90 };
  function Harness({ ids }: { ids: number[] }) {
    const ref = useBottomOverlayHeightRegistration(
      "bingoCelebration",
      ids.length > 0,
    );
    return (
      <>
        {ids.map((id) => (
          <div key={id} ref={ref} data-h={String(HEIGHTS[id])} />
        ))}
      </>
    );
  }

  function registered(): number {
    // `bingoCelebration` is the only registration, so the total IS its height.
    return offsetBelow("waveToast");
  }

  it("re-measures a plain key swap (old node gone, new node in)", () => {
    const { rerender } = render(<Harness ids={[1]} />);
    expect(registered()).toBe(40);

    rerender(<Harness ids={[2]} />);
    expect(registered()).toBe(90);
  });

  it("re-measures while the OUTGOING node is still mounted, and its later detach does not clear the live one", () => {
    const { rerender } = render(<Harness ids={[1]} />);
    expect(registered()).toBe(40);

    // The replacement mounts; the outgoing toast is still painted for its exit.
    // Against the shipped `[id, visible]` deps this stayed at 40 — the taller
    // toast on screen was under-reserved for its whole life.
    rerender(<Harness ids={[1, 2]} />);
    expect(registered()).toBe(90);

    // The exit completes. That detach hands the shared callback ref a `null` for
    // a node that is no longer the tracked one; honouring it would clear the
    // reservation out from under the toast still on screen.
    rerender(<Harness ids={[2]} />);
    expect(registered()).toBe(90);

    // And a genuine hide still unregisters — the ignored `null` is not a leak.
    rerender(<Harness ids={[]} />);
    expect(registered()).toBe(0);
  });
});

/**
 * CR-01 OMISSION GUARD — the one guard shape Phase 21 lacked.
 *
 * `bottomSpace.test.ts` is pattern-matching over source text: it catches a surface
 * that writes the WRONG inset, but it cannot catch a surface that omits the inset
 * ENTIRELY. That gap shipped a real bug in `ArchiveBrowser`, fixed in `61e0b90`.
 *
 * This guard is the other shape. It extracts every registration id actually
 * present in `src/` and asserts each one is declared in
 * `config.ui.BOTTOM_OVERLAY_ORDER` — so it FAILS THE DAY a new overlay is written
 * and not ordered, rather than silently letting it paint on top of whatever is
 * already on screen.
 */
const testDir = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(testDir, "..", "src");
const SCANNED_EXTENSIONS = [".ts", ".tsx"];

/** Same strip-comments helper shape as `bottomSpace.test.ts`'s source guard. */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.replace(
    /(^|[^:])\/\/[^\n]*/g,
    (_match, lead: string) => lead,
  );
}

/** Same recursive `src` walk shape as `bottomSpace.test.ts`'s source guard. */
function sourceFiles(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      found.push(...sourceFiles(abs, rel));
      continue;
    }
    if (!SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    found.push(rel);
  }
  return found;
}

/**
 * Every string literal passed as the FIRST argument to
 * `useBottomOverlayHeightRegistration(`. The quote is required immediately after
 * the open paren (modulo whitespace/newlines — `BingoCelebration` wraps its call
 * across lines), which is also what keeps the hook's own `(id: string, …)`
 * DEFINITION in `bottomOverlayInset.ts` out of the results.
 */
const REGISTRATION_ID = /useBottomOverlayHeightRegistration\(\s*["']([^"']+)["']/g;

function registeredIdsInSrc(): { ids: string[]; files: string[] } {
  const files = sourceFiles(SRC_DIR);
  const ids = new Set<string>();
  for (const file of files) {
    const code = stripComments(readFileSync(join(SRC_DIR, file), "utf8"));
    for (const match of code.matchAll(REGISTRATION_ID)) ids.add(match[1]!);
  }
  return { ids: [...ids].sort(), files };
}

describe("CR-01 omission guard: every registered overlay declares its order", () => {
  const KNOWN_IDS = [
    "backupToast",
    "bingoCelebration",
    "installBanner",
    "updateToast",
    "waveToast",
  ];

  it("the extraction actually found the registrations — not a vacuous []", () => {
    // WITHOUT this, a broken regex (or a swallowed walk) empties the set and
    // turns the containment assertion below into `expect([]).toEqual([])` —
    // permanently green and permanently meaningless. This is the anti-vacuity
    // half, and it must run BEFORE the containment half means anything.
    const { ids, files } = registeredIdsInSrc();
    expect(files.length).toBeGreaterThan(100);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    for (const known of KNOWN_IDS) expect(ids).toContain(known);
  });

  it("every useBottomOverlayHeightRegistration id in src/ is declared in BOTTOM_OVERLAY_ORDER", () => {
    const { ids } = registeredIdsInSrc();
    const declared = config.ui.BOTTOM_OVERLAY_ORDER as readonly string[];
    const undeclared = ids.filter((id) => !declared.includes(id));
    expect(
      undeclared,
      [
        "CR-01 violation — a bottom overlay registers its height but declares no",
        "stack position, so it will paint ON TOP OF whatever is already visible.",
        "Add it to `config.ui.BOTTOM_OVERLAY_ORDER` (bottom-most first) and read",
        "`useBottomOverlayOffset(\"<id>\")` at its call site:",
        ...undeclared.map((id) => `  ${id}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("the declared order has no entry that no longer exists in src/", () => {
    // The other direction: a stale declaration is not a rendering bug, but it
    // makes the order table lie about what is on screen.
    const { ids } = registeredIdsInSrc();
    const declared = config.ui.BOTTOM_OVERLAY_ORDER as readonly string[];
    expect([...declared].sort()).toEqual(KNOWN_IDS);
    expect(declared.every((id) => ids.includes(id))).toBe(true);
  });
});

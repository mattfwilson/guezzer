/**
 * FOUND-03 — the layer-ordering invariant.
 *
 * **D-20: the defect this file encodes is STRUCTURAL, not numeric.** The tier
 * numbers in `config.ui.z` are internally consistent; the *nesting* is not.
 * `ShowView.withBackground` (`ShowView.tsx:174-183`) wraps the whole show column in
 * `className="relative …"` + `style={{ zIndex: config.ui.z.content }}`, and
 * `position: relative` with a non-`auto` `z-index` creates a stacking context by
 * spec. Every descendant therefore resolves its z-index *inside* that context and
 * the entire subtree composites against the root at effective level **10** — so a
 * `sheet: 50` nested there loses to a top-level `toast: 20`, at any number. That is
 * why every assertion below is **ancestor-shaped** and why **nothing is renumbered**:
 * renumbering cannot fix a nesting bug, and the phase's standing constraint is
 * "write the invariant test, renumber nothing".
 *
 * The two offending surfaces were named by the plan-21-04 repro (21-HUMAN-UAT §7):
 * `SearchSheet` (`sheet: 50` → effective 10) and `FabMenu` (`fabScrim: 25` and
 * `fab: 30` → effective 10). `FabMenu` is the worse one (**D-27**): a toast painting
 * over the speed-dial eats taps **mid-show**, inside the live-logging loop.
 *
 * **D-24** — the surfaces are rendered inside a reproduction of the real
 * `withBackground` wrapper. Rendered in isolation the ancestor walk is vacuous: an
 * isolated surface's only ancestor is the RTL container, which creates no stacking
 * context, so the test would pass while the app is broken.
 *
 * **D-25** — the two prose invariants in `config.ts` (WR-01 and CR-01) are locked by
 * named assertions instead of comments. The full ladder is deliberately NOT pinned:
 * a full pin would fight D-26's deliberate `focusedFab` inversion.
 *
 * **D-26** — the modal/non-modal split is driven off the `aria-modal` attribute
 * already in the DOM, never a hand-kept list, so it cannot drift away from the
 * markup. The two exemptions (`NodeSheet`, `focusedFab: 60`) are named with their
 * reasons at their assertions below.
 *
 * ## Completeness of the detector (read this before trusting it)
 *
 * `createsStackingContext` reads **inline styles only**. That is a *complete*
 * detector **in this codebase specifically**, because all production z-index goes
 * through `style={{ zIndex: config.ui.z.X }}` — `config.ts` mandates the inline-style
 * idiom precisely because Tailwind v4 resolves arbitrary `z-[…]` values at author
 * time from static strings, so a JS-config value cannot travel through a class. The
 * only Tailwind `z-*` utility anywhere in the repo is `z-10` in
 * `src/dev/OrbFitHarness.tsx:147`, a dev-only route reached by an explicit
 * `#/dev/orb-fit` hash and never composed with any of these surfaces.
 *
 * jsdom does not cascade the Tailwind stylesheet, so class-derived computed styles
 * are invisible here — but there are none to miss. **The moment someone adds a `z-*`
 * class (or a `transform-*` / `opacity-*` / `backdrop-blur` utility to an ancestor of
 * a sheet), this test silently loses coverage.** It will keep passing and stop
 * meaning anything. If you add one, extend the detector or move the check to a real
 * browser.
 *
 * Scope note: the *source-scan* assertion that every already-root-level sheet-tier
 * surface actually calls `createPortal(…, document.body)` lands in **plan 21-12**.
 * This file proves the invariant at runtime for the surfaces it renders.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";

const { SearchSheet } = await import("../src/show/SearchSheet.tsx");
const { FabMenu } = await import("../src/show/FabMenu.tsx");
const { NodeSheet } = await import("../src/explore/NodeSheet.tsx");
const { Sheet } = await import("../src/components/Sheet.tsx");

// ───────────────────────────────────────────────────────────────────────────────
// The two exported helpers (reused by plan 21-12)
// ───────────────────────────────────────────────────────────────────────────────

/** The four `position` values that let a non-`auto` `z-index` take effect. */
const POSITIONED = ["relative", "absolute", "fixed", "sticky"];

/**
 * True when `el` would create a CSS stacking context, judged from its INLINE
 * styles plus its class list (see the completeness caveat in the file header).
 *
 * The positioned test accepts EITHER an inline `position` OR a Tailwind
 * positioning class, because the real defect uses the mixed idiom: `ShowView`
 * takes `position` from the `relative` class and `zIndex` from an inline style
 * (`ShowView.tsx:177-179`). A detector that only read `el.style.position` would
 * return `false` on the exact element this whole plan exists to fix.
 *
 * Class matching is token-exact (and variant-aware, so `md:absolute` counts)
 * rather than substring, so a class like `sticky-header` is not a false positive.
 */
export function createsStackingContext(el: HTMLElement): boolean {
  const style = el.style;

  const classTokens = (el.className || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.split(":").pop() ?? token);
  const positioned =
    POSITIONED.includes(style.position) ||
    classTokens.some((token) => POSITIONED.includes(token));

  if (positioned && style.zIndex !== "" && style.zIndex !== "auto") return true;
  if (style.transform !== "" && style.transform !== "none") return true;
  if (style.filter !== "" && style.filter !== "none") return true;
  if (style.backdropFilter !== "" && style.backdropFilter !== "none") return true;
  if (/transform|opacity/.test(style.willChange)) return true;
  if (style.opacity !== "" && Number(style.opacity) < 1) return true;
  if (style.isolation === "isolate") return true;

  return false;
}

/** Every ancestor of `el` up to — and EXCLUDING — `document.body`. */
export function ancestorsUpToBody(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    out.push(node);
    node = node.parentElement;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────────

/**
 * A byte-faithful reproduction of `ShowView.withBackground` (`ShowView.tsx:174-183`):
 * the outer positioned frame and the inner `config.ui.z.content` column. The
 * `<ShowBackground>` is omitted deliberately — it is a SIBLING of the column, not an
 * ancestor of any surface, so it cannot affect an ancestor walk.
 */
function WithBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        className="relative flex h-full min-h-0 flex-1 flex-col"
        style={{ zIndex: config.ui.z.content }}
      >
        {children}
      </div>
    </div>
  );
}

/** Human-readable offender line: the className and the inline zIndex, as required. */
function describeAncestor(el: HTMLElement): string {
  return `<${el.tagName.toLowerCase()} class="${el.className}" style-zIndex="${
    el.style.zIndex || "(none)"
  }">`;
}

/**
 * THE INVARIANT. No ancestor of the surface's OWN ROOT, up to `document.body`, may
 * create a stacking context — otherwise the surface's tier is resolved inside that
 * context and composites at the ancestor's level instead of its own.
 *
 * `root` must be the outermost element the surface itself renders, not an inner
 * node. The distinction is load-bearing: the shared `<Sheet>` primitive portals a
 * scrim wrapper (`sheetScrim: 40`) with the dialog card (`sheet: 50`) nested inside
 * it, so the card DOES have a stacking-context ancestor — its own scrim. That
 * nesting is intra-surface and correct, because the PAIR travels to `document.body`
 * together and competes there as one unit. What FOUND-03 forbids is a FOREIGN
 * stacking-context ancestor, i.e. one belonging to the app content tree.
 */
function expectNoStackingAncestors(root: HTMLElement, label: string) {
  const offenders = ancestorsUpToBody(root).filter(createsStackingContext);
  expect(
    offenders.map(describeAncestor),
    `${label}: ${offenders.length} ancestor(s) create a stacking context, so this ` +
      `surface composites at the ANCESTOR's level, not its own tier. Portal it to ` +
      `document.body (D-20) — do not renumber its z-index.`,
  ).toEqual([]);
}

/**
 * The companion structural assertion: the surface must not be rendered INSIDE the
 * app content tree at all. In the app that tree is `#app-content` (App.tsx notes
 * that portaled sheets land outside it); in these tests it is the RTL container
 * holding the `withBackground` fixture. This is the form that generalizes across
 * surfaces with different internal shapes, so the `aria-modal` sweep uses it.
 */
function expectEscapesContentTree(
  root: HTMLElement,
  container: HTMLElement,
  label: string,
) {
  expect(
    container.contains(root),
    `${label}: still rendered inside the app content tree, so it inherits that ` +
      `tree's stacking context (D-20). Portal it to document.body.`,
  ).toBe(false);
}

/** Every open dialog the DOM currently carries that declares itself MODAL. */
function modalDialogs(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"]'),
  ).filter((el) => el.getAttribute("aria-modal") === "true");
}

function openFabMenu() {
  fireEvent.click(
    screen.getByRole("button", { name: config.copy.show.fabLabel }),
  );
}

const fabScrim = () => screen.getByTestId("fab-scrim");
const fabDial = () =>
  document.querySelector<HTMLElement>("[data-strip-slot-reserved]")!;

afterEach(() => {
  cleanup();
});

// ───────────────────────────────────────────────────────────────────────────────
// 1. Detector self-tests — anti-vacuity (T-21-33)
// ───────────────────────────────────────────────────────────────────────────────

describe("createsStackingContext self-tests", () => {
  it("fires on the exact ShowView idiom: `relative` CLASS + inline zIndex", () => {
    const el = document.createElement("div");
    el.className = "relative flex h-full min-h-0 flex-1 flex-col";
    el.style.zIndex = String(config.ui.z.content);
    expect(createsStackingContext(el)).toBe(true);
  });

  it("fires on an inline transform", () => {
    const el = document.createElement("div");
    el.style.transform = "scale(1.2)";
    expect(createsStackingContext(el)).toBe(true);
  });

  it("does NOT fire on a positioned element with no z-index", () => {
    const el = document.createElement("div");
    el.className = "relative flex flex-col";
    expect(createsStackingContext(el)).toBe(false);
  });
});

describe("ancestorsUpToBody", () => {
  it("walks to — and excludes — document.body", () => {
    const outer = document.createElement("div");
    outer.className = "outer";
    const inner = document.createElement("div");
    inner.className = "inner";
    const leaf = document.createElement("div");
    outer.appendChild(inner);
    inner.appendChild(leaf);
    document.body.appendChild(outer);

    const chain = ancestorsUpToBody(leaf);
    expect(chain.map((el) => el.className)).toEqual(["inner", "outer"]);
    expect(chain).not.toContain(document.body);

    outer.remove();
  });

  it("returns an empty chain for a direct child of body (what a portal produces)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(ancestorsUpToBody(el)).toEqual([]);
    el.remove();
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 2. The FOUND-03 structural invariant
// ───────────────────────────────────────────────────────────────────────────────

describe("FOUND-03: no modal sheet-tier surface may sit inside a stacking context", () => {
  it("SearchSheet, opened inside the ShowView content column", () => {
    const { container } = render(
      <WithBackground>
        <SearchSheet
          open
          onClose={vi.fn()}
          onSelect={vi.fn()}
          onUnknown={vi.fn()}
        />
      </WithBackground>,
    );

    // SearchSheet's surface root IS its dialog — it renders one top-level box.
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expectNoStackingAncestors(dialog, "SearchSheet");
    expectEscapesContentTree(dialog, container, "SearchSheet");
  });

  it("FabMenu's scrim and speed-dial, opened inside the ShowView content column (D-27)", () => {
    const { container } = render(
      <WithBackground>
        <FabMenu
          onSearch={vi.fn()}
          onUnknown={vi.fn()}
          onSetBreak={vi.fn()}
          onEncore={vi.fn()}
          onUndo={vi.fn()}
          onCatchUp={vi.fn()}
          onEndShow={vi.fn()}
          stripSlotReserved={false}
        />
      </WithBackground>,
    );
    openFabMenu();

    // Both FabMenu roots are top-level siblings of one another — neither nests
    // inside the other, so each is its own surface root.
    expectNoStackingAncestors(fabScrim(), "FabMenu scrim");
    expectNoStackingAncestors(fabDial(), "FabMenu speed-dial");
    expectEscapesContentTree(fabScrim(), container, "FabMenu scrim");
    expectEscapesContentTree(fabDial(), container, "FabMenu speed-dial");
  });

  it("the shared <Sheet> primitive is the NEGATIVE case: same tiers, already portaled", () => {
    // This is the control that proves the diagnosis is nesting rather than tier
    // numbering (21-HUMAN-UAT §7's "negative cases"). <Sheet> uses the identical
    // sheetScrim/sheet values and passes the invariant, because it portals.
    const { container } = render(
      <WithBackground>
        <Sheet open onClose={vi.fn()} ariaLabel="Control sheet">
          <button>inside</button>
        </Sheet>
      </WithBackground>,
    );

    const dialog = screen.getByRole("dialog");
    // <Sheet>'s surface root is the scrim wrapper it portals, NOT the dialog card
    // nested inside it — see the note on expectNoStackingAncestors.
    const surfaceRoot = dialog.parentElement!;
    expect(surfaceRoot.style.zIndex).toBe(String(config.ui.z.sheetScrim));
    expectNoStackingAncestors(surfaceRoot, "<Sheet> primitive");
    expectEscapesContentTree(surfaceRoot, container, "<Sheet> primitive");
  });

  it("holds for EVERY modal dialog in the DOM, discovered via aria-modal (D-26)", () => {
    // The split is read off the DOM rather than a hand-kept component list, so a
    // new modal surface is covered the day it is written. The escape form is used
    // here because it needs no per-surface knowledge of where the root sits.
    const { container } = render(
      <WithBackground>
        <SearchSheet
          open
          onClose={vi.fn()}
          onSelect={vi.fn()}
          onUnknown={vi.fn()}
        />
        <Sheet open onClose={vi.fn()} ariaLabel="Control sheet">
          <button>inside</button>
        </Sheet>
      </WithBackground>,
    );

    const dialogs = modalDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    for (const dialog of dialogs) {
      expectEscapesContentTree(
        dialog,
        container,
        `modal dialog aria-label="${dialog.getAttribute("aria-label")}"`,
      );
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 3. The two named exemptions (D-26)
// ───────────────────────────────────────────────────────────────────────────────

describe("Deliberate exemptions — named, with their reasons", () => {
  /**
   * EXEMPTION 1 — `NodeSheet` (`explore/NodeSheet.tsx:147`, `aria-modal={false}`).
   *
   * FOUND-03 says "an open **modal** sheet". NodeSheet is a NON-modal peek: no
   * scrim, and the constellation must stay visible and interactive above it. Its
   * coexistence with a lifted FAB IS the point of the design, so it is excluded by
   * its own `aria-modal={false}` attribute rather than by a list entry.
   */
  it("NodeSheet is excluded because it declares aria-modal={false}, not by a list", () => {
    render(
      <WithBackground>
        <NodeSheet
          songName="Rattlesnake"
          playCount={42}
          total={0}
          bars={[]}
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      </WithBackground>,
    );

    const sheet = screen.getByRole("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("false");
    // It carries the sheet tier …
    expect(sheet.style.zIndex).toBe(String(config.ui.z.sheet));
    // … and is nonetheless absent from the modal set the invariant walks.
    expect(modalDialogs()).not.toContain(sheet);
  });

  /**
   * EXEMPTION 2 — `focusedFab: 60 > sheet: 50` is DELIBERATE (D-03).
   *
   * The ExploreFilterFab lifts ABOVE the non-modal NodeSheet when a constellation
   * node is focused, so a keyboard/VoiceOver user can still reach the filter while a
   * node is focused. Renumbering it to restore a monotonic ladder would be an a11y
   * regression — which is exactly why the numeric guards below pin only the two real
   * invariants and never the whole ladder.
   */
  it("focusedFab deliberately sits ABOVE sheet (D-03) — asserted so nobody 'fixes' it", () => {
    expect(config.ui.z.focusedFab).toBeGreaterThan(config.ui.z.sheet);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 4. The two named numeric guards (D-25)
// ───────────────────────────────────────────────────────────────────────────────

describe("Numeric tier guards named in config.ts", () => {
  it("WR-01: page < sheetScrim", () => {
    // config.ts, `z.page`: "if it did, a portaled `<Sheet>` opened from it
    // (ShareCardSheet) would land its scrim (`sheetScrim`) behind the opaque page,
    // killing the backdrop dim + tap-to-dismiss (WR-01 regression guard:
    // page < sheetScrim)."
    expect(config.ui.z.page).toBeLessThan(config.ui.z.sheetScrim); // WR-01
  });

  it("CR-01: fabScrim < fab", () => {
    // config.ts, `z.fabScrim`: "It only needs to sit over the orbit stage — never
    // over the FAB toggle or its own action rows — so it MUST stay strictly below
    // `fab`, otherwise the scrim paints on top of the speed-dial actions and eats
    // every tap (CR-01 regression guard: fabScrim < fab)."
    expect(config.ui.z.fabScrim).toBeLessThan(config.ui.z.fab); // CR-01
  });
});

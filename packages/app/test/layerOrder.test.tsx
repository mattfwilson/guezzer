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
 * ## The invariant has TWO forms (both live in this file as of plan 21-12)
 *
 * **(a) The structural ancestor walk** (§2 below) — rendered, per surface, inside a
 * reproduction of the tree that actually hosts it. It is the primary form: it is what
 * was demonstrably RED against the live defect.
 *
 * **(b) The portal source scan** (§5 below) — a static read of `src/` asserting that
 * every file rendering at `config.ui.z.sheet` also calls `createPortal(`. Form (a) can
 * only cover surfaces this file renders and only in the trees it thinks to reproduce;
 * form (b) covers every sheet-tier surface in the repo, including ones written after
 * this file, and it is the form that catches "someone added a sixth sheet and nested
 * it". Neither is allowed to be vacuous — see the anti-vacuity assertions in each.
 *
 * Plan 21-12 also extended form (a) to the four surfaces it portaled (`AlbumDetail`,
 * `ArchiveBrowser`, `SetlistView`, `NodeSheet`). Those four were NOT broken — they
 * already sat at root level — so their portals are PROPHYLACTIC, and a walk through
 * the tree that ships today would be vacuous for them. They are therefore rendered
 * inside a DELIBERATELY ARMED reproduction of `DexView`'s wrapper (`LATENT TRAP`
 * below): the wrapper as it ships, plus the one `z-index` a future edit could add.
 * That is the exact regression these portals exist to make impossible, and it is what
 * gives those cases teeth.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AlbumTrack,
  ArchiveArtifact,
  DexStats,
  RarityIndex,
} from "@guezzer/core";
import { config } from "../src/config.ts";

// The three dex surfaces read Dexie through `useLiveQuery`. Stubbed to `undefined`
// (the same idiom `setlistView.test.tsx` uses and for the same reason): these cases
// assert DOM STRUCTURE, so no async Dexie settling should be able to make a layering
// test flaky. `undefined` takes each surface's already-covered branch — SetlistView
// resolves from the bundled archive, ArchiveBrowser reads `?? []`. No other surface
// rendered in this file touches `useLiveQuery`.
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));

const { SearchSheet } = await import("../src/show/SearchSheet.tsx");
const { FabMenu } = await import("../src/show/FabMenu.tsx");
const { NodeSheet } = await import("../src/explore/NodeSheet.tsx");
const { Sheet } = await import("../src/components/Sheet.tsx");
const { AlbumDetail } = await import("../src/dex/AlbumDetail.tsx");
const { ArchiveBrowser } = await import("../src/dex/ArchiveBrowser.tsx");
const { SetlistView } = await import("../src/dex/SetlistView.tsx");

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

/**
 * A reproduction of `DexView`'s overlay-hosting wrapper (`DexView.tsx:99`), which is
 * where `AlbumDetail`, `ArchiveBrowser` and `SetlistView` are rendered from.
 *
 * As it SHIPS (`armed={false}`) the wrapper has no `z-index` and no `transform`, so it
 * creates no stacking context and those three surfaces already composited at the top
 * level — which is exactly why plan 21-12's portals were prophylactic rather than a fix.
 *
 * `armed` adds the LATENT TRAP: the single `position: relative` + `z-index` a future
 * edit could plausibly put on this wrapper (to float the segment control, to layer the
 * header — the same shape `ShowView.withBackground` already has). That one edit would
 * silently sink all three dex sheets at once, at any tier number. The portals are what
 * make it harmless, and rendering the cases against the ARMED wrapper is what stops
 * those cases from being vacuous. `armed` is a TEST-ONLY hypothetical — nothing in
 * `src/` sets it, and the anti-vacuity case below pins both halves of that claim.
 */
function DexShell({
  children,
  armed = false,
}: {
  children: ReactNode;
  armed?: boolean;
}) {
  const shipped = "mx-auto flex w-full max-w-md sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl flex-col";
  return (
    <div
      data-testid="dex-shell"
      className={armed ? `relative ${shipped}` : shipped}
      style={armed ? { zIndex: config.ui.z.page } : undefined}
    >
      {children}
    </div>
  );
}

const dexShell = () => screen.getByTestId("dex-shell");

// ── Fixture data for the three dex surfaces ────────────────────────────────────
// Deliberately minimal: these cases assert DOM POSITION, never content. Content is
// covered by archiveBrowser.test.tsx / setlistView.test.tsx / showsList.test.tsx.

const albumTracks: AlbumTrack[] = [
  { songId: 101, slug: "rattlesnake", title: "Rattlesnake", position: 1, inMatrix: true },
  { songId: 102, slug: "robot-stop", title: "Robot Stop", position: 2, inMatrix: true },
];

const dexStats = {
  completion: { caught: 1, total: 2, pct: 50 },
  perSong: new Map(),
  neverSeen: [],
  rarestCatch: null,
  showCount: 1,
  perAlbum: new Map([["nonagon-infinity", { caught: 1, total: 2 }]]),
} as unknown as DexStats;

const rarityIndex: RarityIndex = new Map();

const dexArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2026-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop" },
  shows: [
    {
      id: 4001,
      date: "2026-08-14",
      venue: "Brooklyn Steel",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      sets: [{ n: "1" as const, songs: [101, 102] }],
    },
  ],
} as unknown as ArchiveArtifact;

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
    // Portaled straight to body, not into some intermediate wrapper.
    expect(dialog.parentElement).toBe(document.body);
  });

  it("SearchSheet keeps its contract across the portal (D-21/D-23)", () => {
    render(
      <WithBackground>
        <SearchSheet
          open
          onClose={vi.fn()}
          onSelect={vi.fn()}
          onUnknown={vi.fn()}
        />
      </WithBackground>,
    );

    const dialog = screen.getByRole("dialog");
    // a11y contract pinned unchanged.
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(
      config.copy.show.searchPlaceholder,
    );
    expect(dialog.style.zIndex).toBe(String(config.ui.z.sheet));

    // D-23 item 1 — gesture suppression is now carried explicitly. jsdom does not
    // cascade the stylesheet, so this asserts the HOOK; the CSS block itself is
    // asserted in the styles.css check below and confirmed on-device in 21-13.
    expect(dialog.className).toContain("gesture-guard");

    // D-23 item 3 — autoFocus still lands on the search input after portaling.
    const input = screen.getByRole("textbox", {
      name: config.copy.show.searchPlaceholder,
    });
    expect(document.activeElement).toBe(input);
  });

  it("D-23: styles.css applies the gesture-suppression block to .gesture-guard", () => {
    // Source read (never `dist`): the class is only useful if the selector list
    // actually names it, and jsdom cannot tell us that from the rendered node.
    const css = readFileSync(
      join(import.meta.dirname, "..", "src", "styles.css"),
      "utf8",
    );
    const block = css.slice(css.indexOf(".orbit-stage,"));
    const selectorList = block.slice(0, block.indexOf("{"));
    expect(selectorList).toContain(".gesture-guard");
    expect(block.slice(0, block.indexOf("}"))).toContain(
      "-webkit-touch-callout: none",
    );
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
    // Both roots portal to body directly, and together — not one wrapped in the
    // other, and not one left behind in the content column.
    expect(fabScrim().parentElement).toBe(document.body);
    expect(fabDial().parentElement).toBe(document.body);
  });

  it("FabMenu's RENDERED tiers still satisfy CR-01 after portaling (D-27)", () => {
    render(
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

    // The config-level guard lives below; this one reads the INLINE values that
    // actually shipped onto the two boxes, which is what the compositor sees.
    const scrimZ = Number(fabScrim().style.zIndex);
    const dialZ = Number(fabDial().style.zIndex);
    expect(scrimZ).toBe(config.ui.z.fabScrim);
    expect(dialZ).toBe(config.ui.z.fab);
    expect(scrimZ).toBeLessThan(dialZ); // CR-01 on the rendered nodes

    // Gesture suppression travelled with them: `.fab-menu` is already in the
    // styles.css selector list, so neither root needs `gesture-guard`.
    expect(fabScrim().className).toContain("fab-menu");
    expect(fabDial().className).toContain("fab-menu");
    // And the shipped contract the fabMenu.test.tsx queries depend on.
    expect(fabDial().dataset.stripSlotReserved).toBe("false");
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
// 2b. The four PROPHYLACTIC portals (plan 21-12), walked against the ARMED shell
// ───────────────────────────────────────────────────────────────────────────────

describe("FOUND-03 holds for the dex/explore sheets even against DexView's latent trap", () => {
  it("ANTI-VACUITY: the shipped DexView wrapper is inert, the armed one is not", () => {
    // Half one — what ships today creates NO stacking context. This is the honest
    // record that these four surfaces were never broken, and therefore that a walk
    // through the shipped tree alone would prove nothing.
    const { unmount } = render(
      <DexShell>
        <span>content</span>
      </DexShell>,
    );
    expect(createsStackingContext(dexShell())).toBe(false);
    unmount();

    // Half two — the armed wrapper DOES, so every case below has real teeth. Without
    // this assertion an `armed` prop that silently stopped working (a renamed class, a
    // dropped style) would turn all four cases green-and-meaningless.
    render(
      <DexShell armed>
        <span>content</span>
      </DexShell>,
    );
    expect(createsStackingContext(dexShell())).toBe(true);
  });

  it("AlbumDetail escapes the armed DexView wrapper (D-21)", () => {
    const { container } = render(
      <DexShell armed>
        <AlbumDetail
          albumKey="nonagon-infinity"
          title="Nonagon Infinity"
          slug="nonagon-infinity"
          tracks={albumTracks}
          dex={dexStats}
          rarity={rarityIndex}
          onBack={vi.fn()}
        />
      </DexShell>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Nonagon Infinity");
    expect(dialog.style.zIndex).toBe(String(config.ui.z.sheet));
    expectNoStackingAncestors(dialog, "AlbumDetail");
    expectEscapesContentTree(dialog, container, "AlbumDetail");
    expect(dialog.parentElement).toBe(document.body);
  });

  it("ArchiveBrowser escapes the armed DexView wrapper (D-21)", () => {
    const { container } = render(
      <DexShell armed>
        <ArchiveBrowser archive={dexArchive} onClose={vi.fn()} />
      </DexShell>,
    );

    // ArchiveBrowser's own root is the outer `sheet`-tier dialog. Its D-12 unmark
    // confirm (`sheetScrim`) is nested INSIDE that root — intra-surface nesting, the
    // same shape <Sheet> has, and correct: the pair travels through one portal and
    // competes at the top level as one unit (see expectNoStackingAncestors).
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.zIndex).toBe(String(config.ui.z.sheet));
    expectNoStackingAncestors(dialog, "ArchiveBrowser");
    expectEscapesContentTree(dialog, container, "ArchiveBrowser");
    expect(dialog.parentElement).toBe(document.body);
  });

  it("SetlistView escapes the armed DexView wrapper — RESOLVED path (D-21)", () => {
    const { container } = render(
      <DexShell armed>
        <SetlistView
          showId={4001}
          archive={dexArchive}
          rarity={rarityIndex}
          onClose={vi.fn()}
        />
      </DexShell>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.style.zIndex).toBe(String(config.ui.z.sheet));
    expectNoStackingAncestors(dialog, "SetlistView (resolved)");
    expectEscapesContentTree(dialog, container, "SetlistView (resolved)");
    expect(dialog.parentElement).toBe(document.body);
  });

  it("SetlistView escapes it on its LOADING path too — the other return (D-21)", () => {
    // The hold-the-frame early return is a second `role="dialog" aria-modal="true"`
    // box at the same tier. Portaling only the resolved one would leave the invariant
    // true for half this surface's lifetime — the half nobody looks at. Reached by
    // asking for a show that is in neither the bundle nor the (stubbed-undefined)
    // fallback cache row.
    const { container } = render(
      <DexShell armed>
        <SetlistView
          showId={999999}
          archive={dexArchive}
          rarity={rarityIndex}
          onClose={vi.fn()}
        />
      </DexShell>,
    );

    const dialog = screen.getByRole("dialog");
    // It is the loading frame, not the resolved one: no header, no rows.
    expect(screen.queryAllByTestId("setlist-row")).toHaveLength(0);
    expect(dialog.style.zIndex).toBe(String(config.ui.z.sheet));
    expectNoStackingAncestors(dialog, "SetlistView (loading)");
    expectEscapesContentTree(dialog, container, "SetlistView (loading)");
    expect(dialog.parentElement).toBe(document.body);
  });

  it("NodeSheet escapes an armed ancestor too — portaled, though NOT modal (D-21)", () => {
    // NodeSheet is exempt from the MODAL walk (§3 below, `aria-modal={false}`), but it
    // is NOT exempt from portaling: it is in the source scan's set, so its structural
    // position is asserted here rather than nowhere. `WithBackground` is the armed
    // ancestor here because Explore, not Dex, is where it renders.
    const { container } = render(
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
    expectNoStackingAncestors(sheet, "NodeSheet");
    expectEscapesContentTree(sheet, container, "NodeSheet");
    expect(sheet.parentElement).toBe(document.body);

    // T-21-35 — the drag/peek contract must survive the move. NodeSheet owns its
    // gesture suppression via an INLINE style on its own root, which travels with the
    // portaled node, so it needs no `.gesture-guard` class the way SearchSheet did.
    expect(sheet.style.touchAction).toBe("none");
    expect(sheet.className).toContain("fixed inset-x-0 bottom-0");
    expect(sheet.getAttribute("style")).toContain("var(--gz-safe-bottom)");
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
   *
   * The exemption is SCOPED to the modal walk. NodeSheet is NOT exempt from
   * portaling: plan 21-12 portaled it, §2b asserts that structurally, and the source
   * scan in §5 includes it by name in the expected set. An exemption from one form of
   * the invariant is not an exemption from the invariant.
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
   *
   * Plan 21-12 note: portaling NodeSheet is what makes this comparison mean what it
   * says. Both boxes are `position: fixed`, and now both compete at the top level, so
   * `60 > 50` is the order the compositor actually applies. Nested under a stacking
   * context the two numbers would have been decided by their ancestors instead.
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

  it("Phase-22: peek < chrome < page — the new tier's whole justification", () => {
    // config.ts, `z.chrome`: "Placed between `peek` (12) and `page` (15) to
    // preserve both shipped relationships at once: the bingo peek panel must NOT
    // cover the tab bar (peek < chrome), and a full-screen in-tree page such as
    // RecapView must still cover the chrome (chrome < page)."
    //
    // Move `chrome` out of that open interval and one of two shipped surfaces
    // breaks silently: either the expanded bingo board paints under the tab bar,
    // or RecapView stops covering the chrome it is supposed to replace.
    expect(config.ui.z.peek).toBeLessThan(config.ui.z.chrome);
    expect(config.ui.z.chrome).toBeLessThan(config.ui.z.page);
  });

  it("Phase-22 CHROME-03: chrome < fab — the escape control is never covered", () => {
    // config.ts, `z.chrome`: "the moment the hidden header goes out of flow to
    // slide away it needs an EXPLICIT tier, or it paints over the `ChromeToggle`
    // (`fab: 30`) and covers the user's only escape control for the whole 200ms
    // hide". A user who cannot reach the toggle cannot get the bars back.
    expect(config.ui.z.chrome).toBeLessThan(config.ui.z.fab);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 5. FOUND-03 portal assertion (D-24, form b) — the SOURCE scan
// ───────────────────────────────────────────────────────────────────────────────

/** The `src/` tree, read from source. NEVER `dist/` — build output is not the contract. */
const SRC_DIR = join(import.meta.dirname, "..", "src");

/**
 * Word-boundary-anchored ON PURPOSE: `config.ui.z.sheet\b` must NOT match
 * `config.ui.z.sheetScrim`. `CometTrail.tsx` renders at `sheetScrim` and is a
 * DIFFERENT tier with a different (scrim) role — sweeping it in here would produce a
 * failure nobody could act on.
 */
const SHEET_TIER = /config\.ui\.z\.sheet\b/;
const PORTAL_CALL = /createPortal\(/;

/**
 * Paths (relative to `src/`, POSIX separators) excluded from the scan, each by name
 * and each with its reason. This list is deliberately short and deliberately explicit:
 * an exclusion is a hole in the guard, so it has to be argued for in writing.
 */
const SCAN_EXCLUSIONS: Array<{ prefix: string; why: string }> = [
  {
    // The established exception. `dev/OrbFitHarness.tsx:147` is already the one place
    // in the repo allowed a raw Tailwind `z-10` (see the header's completeness note);
    // `dev/LayoutProbe.tsx` renders a measurement overlay at the sheet tier. Both are
    // reached only by an explicit `#/dev/*` hash, never composed with a real sheet,
    // and never shipped into a user's path.
    prefix: "dev/",
    why: "dev-only harnesses behind an explicit #/dev/* hash (established exception)",
  },
  {
    // These two OWN or COMPOSE the tier rather than render at it, so requiring a
    // portal of them would be a category error. Listed by name as the plan requires,
    // even though neither contains the literal expression today.
    prefix: "config.ts",
    why: "declares the tier ladder; renders nothing",
  },
  {
    prefix: "layout/bottomSpace.ts",
    why: "composes the bottom-space ladder; renders nothing",
  },
];

/** Recursive `.ts`/`.tsx` walk of the SOURCE tree, returning `src/`-relative paths. */
function sourceFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base === "" ? entry.name : `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourceFiles(join(dir, entry.name), rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** Every `src/` file that RENDERS at the sheet tier, after the named exclusions. */
function sheetTierFiles(): string[] {
  return sourceFiles(SRC_DIR)
    .filter((rel) => !SCAN_EXCLUSIONS.some((ex) => rel.startsWith(ex.prefix)))
    .filter((rel) => SHEET_TIER.test(readFileSync(join(SRC_DIR, rel), "utf8")));
}

/**
 * The six surfaces expected to be in the set after plan 21-12. Asserted as a SUBSET
 * (not an exact match) on purpose: a seventh sheet written tomorrow should be caught
 * by the portal assertion below, not rejected by a stale roster. What this list
 * guards is the opposite direction — a surface silently DROPPING out of the scan
 * because its tier reference was renamed or its file moved.
 */
const EXPECTED_SHEET_TIER_FILES = [
  "components/Sheet.tsx",
  "dex/AlbumDetail.tsx",
  "dex/ArchiveBrowser.tsx",
  "dex/SetlistView.tsx",
  "explore/NodeSheet.tsx",
  "show/SearchSheet.tsx",
];

describe("FOUND-03 portal assertion (D-24, form a)", () => {
  it("ANTI-VACUITY: the scan finds sheet-tier files at all, and finds the known six", () => {
    // T-21-37. Without this, renaming the tier (or breaking the walk) would empty the
    // set and turn the guard below into `expect([]).toEqual([])` — permanently green,
    // permanently meaningless.
    const found = sheetTierFiles();
    expect(
      found.length,
      `the sheet-tier scan found NO files under ${SRC_DIR}. Either the tier was ` +
        `renamed (update SHEET_TIER) or the source walk is broken. This guard is ` +
        `worthless while the set is empty.`,
    ).toBeGreaterThan(0);
    expect(
      found,
      `a known sheet-tier surface fell out of the scan. Found:\n  ${found.join("\n  ")}`,
    ).toEqual(expect.arrayContaining(EXPECTED_SHEET_TIER_FILES));
  });

  it("every file rendering at config.ui.z.sheet also calls createPortal", () => {
    const found = sheetTierFiles();
    const offenders = found.filter(
      (rel) => !PORTAL_CALL.test(readFileSync(join(SRC_DIR, rel), "utf8")),
    );

    expect(
      offenders,
      `these files render at config.ui.z.sheet WITHOUT createPortal, so their tier ` +
        `resolves inside whatever stacking context their host tree happens to have ` +
        `(D-20). Portal them to document.body — do NOT renumber the tier.\n` +
        `Scanned (${found.length}):\n  ${found.join("\n  ")}\n` +
        `Excluded by name: ${SCAN_EXCLUSIONS.map((ex) => `${ex.prefix} (${ex.why})`).join("; ")}`,
    ).toEqual([]);
  });

  it("scans SOURCE only — dist/ is never read", () => {
    // The build output is a derivative, not the contract, and it may not even exist.
    expect(SRC_DIR.replace(/\\/g, "/")).toMatch(/\/src$/);
    expect(sourceFiles(SRC_DIR).some((rel) => rel.includes("dist/"))).toBe(false);
  });
});

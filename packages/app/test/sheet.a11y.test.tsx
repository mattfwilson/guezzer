import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";

/**
 * Phase-8 A11Y-01 contract for the shared <Sheet> primitive + the a11y layer
 * (useFocusTrap / useDialogDismiss / dialogStack / ref-counted inertRoot).
 *
 * jsdom limits: it cannot move focus on a real Tab press (that needs user-event),
 * so real Tab-order wrapping is deferred to the end-of-phase on-device AT sweep.
 * These assertions are handler-level: Escape via `fireEvent.keyDown(document, …)`,
 * initial/restore focus via `document.activeElement`, and background suppression
 * via the `#app-content` element's `inert` state.
 *
 * Phase-21 FOUND-03 addendum to that limits list. The portal-parity block at the
 * bottom of this file asserts the ATTRIBUTE contract of the five hand-rolled sheet
 * surfaces after plans 21-11/21-12 moved them to `document.body`. Three things it
 * still cannot reach, and nobody should read it as if it could:
 *
 *  1. **Real double-tap-zoom and long-press-callout suppression.** jsdom does not
 *     cascade the Tailwind stylesheet and has no touch/gesture engine, so
 *     `touch-action: manipulation`, `overscroll-behavior: none` and
 *     `-webkit-touch-callout: none` can only be asserted as an authored HOOK (the
 *     `.gesture-guard` class / the inline `touchAction`), never as behaviour.
 *  2. **Real VoiceOver focus order.** A portaled node's DOM position is what AT
 *     traversal follows, and jsdom cannot run a screen reader. `role`, `aria-modal`
 *     and the accessible name are pinned here; the ORDER in which VoiceOver reaches
 *     them is not.
 *  3. **Real Tab wrapping** — the pre-existing limit above, unchanged.
 *
 * All three belong to device UAT test 8 (`21-HUMAN-UAT.md`), which owns them.
 *
 * Phase-22 SHEET-02 addendum — two more limits, both easy to misread:
 *
 *  4. **`expect(appContent()!.inert).toBe(true)` is an EXPANDO read, not an attribute
 *     read.** jsdom 29.1.1 implements no `inert` (probe P8): `el.inert = true` sets a
 *     plain JS property and reflects NO attribute, so `document.querySelector("[inert]")`
 *     finds nothing here. `inertRoot.ts` writes that property, which is why these
 *     assertions pass. React's JSX `inert` prop — used by the Phase-22 chrome —
 *     *does* render a real `inert=""` attribute even in jsdom, so
 *     `toHaveAttribute("inert")` and `.inert === true` are NOT equivalent
 *     assertions. Do not "unify" them.
 *  5. **After plan 22-02's `exit` variants, an exiting sheet stays in the DOM for
 *     ~`config.ui.motion.SHEET_DURATION_MS`.** Every close case in this file asserts
 *     SYNCHRONOUSLY after `rerender`, which is precisely the close-START moment
 *     (D-19) and therefore stays correct — the teardown is driven by `useFocusTrap`'s
 *     `active: open && modal`, which flips in that same commit, never by presence.
 *     But any FUTURE case that queries the DOM *after* a close must
 *     `await waitForElementToBeRemoved(...)` first, or it will find the exiting node.
 *     The full close-start contract lives in `sheet.closeStart.test.tsx`.
 */

// The two dex surfaces below read Dexie through `useLiveQuery`; stubbed to `undefined`
// so these attribute assertions never wait on async Dexie settling. Nothing else in
// this file touches it — `<Sheet>` has no data dependencies at all.
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));

const { Sheet } = await import("../src/components/Sheet.tsx");

/** A fresh #app-content inert target + a trigger to restore focus to, per test. */
function mountAppContent(): HTMLButtonElement {
  const root = document.createElement("div");
  root.id = "app-content";
  const trigger = document.createElement("button");
  trigger.textContent = "trigger";
  root.appendChild(trigger);
  document.body.appendChild(root);
  return trigger;
}

const appContent = () => document.getElementById("app-content");

afterEach(() => {
  cleanup();
  document.getElementById("app-content")?.remove();
});

describe("Sheet A11Y-01 contract", () => {
  it("renders nothing when closed (V7 guard preserved)", () => {
    const { container } = render(
      <Sheet open={false} onClose={vi.fn()} ariaLabel="Test">
        <button>inside</button>
      </Sheet>,
    );
    expect(container.firstChild).toBeNull();
    // Nothing portaled either.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("modal open: moves focus inside the sheet and makes #app-content inert", () => {
    mountAppContent();
    render(
      <Sheet open onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(appContent()!.inert).toBe(true);
  });

  it("Escape calls onClose (topmost)", () => {
    mountAppContent();
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close restores focus to the trigger and clears inert", () => {
    const trigger = mountAppContent();
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <Sheet open onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );
    expect(appContent()!.inert).toBe(true);
    expect(document.activeElement).not.toBe(trigger);

    rerender(
      <Sheet open={false} onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );
    expect(appContent()!.inert).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("initialFocusRef receives focus AFTER the enter completes, not on open (D-27)", async () => {
    mountAppContent();
    function Harness() {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <Sheet open onClose={vi.fn()} ariaLabel="Modal" initialFocusRef={inputRef}>
          <button>first</button>
          <input ref={inputRef} aria-label="target" />
        </Sheet>
      );
    }
    render(<Harness />);
    const target = screen.getByLabelText("target");

    // D-27 moved the MOMENT, not the TARGET. Synchronously on open the explicit
    // target is deliberately NOT focused — focusing an input opens the iOS keyboard,
    // and doing that on a TRANSLATING element races two layout changes on the one
    // platform where this app's viewport math has already misfired. This assertion is
    // what keeps the case discriminating rather than merely laxer: without it,
    // `waitFor` alone would also pass against the old focus-at-open contract.
    expect(document.activeElement).not.toBe(target);
    // …but focus is still INSIDE the trap from frame 0 (the first focusable), so a
    // keyboard/VoiceOver user is never parked on the now-inert trigger for ~200ms.
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    // Enter-END. This file does NOT mock `motion/react`, so the real rAF fallback
    // drives `onAnimationComplete`; the SHEET_DURATION_MS fallback timer in
    // `SheetSurface` guarantees it even if the animation is skipped entirely.
    await waitFor(() => expect(target).toHaveFocus());
  });

  it("non-modal sheet: Escape + restore work, but NO inert and NO scrim", () => {
    const trigger = mountAppContent();
    trigger.focus();
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open modal={false} onClose={onClose} ariaLabel="NonModal">
        <button>inside</button>
      </Sheet>,
    );

    // Background stays interactive — never inert for a non-modal sheet
    // (setRootInert is never called, so `.inert` is never turned on).
    expect(appContent()!.inert).not.toBe(true);
    // No backdrop scrim element.
    expect(document.querySelector(".bg-black\\/50")).toBeNull();

    // Escape still dismisses.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Focus still restores on close.
    rerender(
      <Sheet open={false} modal={false} onClose={onClose} ariaLabel="NonModal">
        <button>inside</button>
      </Sheet>,
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("stacked modals: one Escape closes only the topmost; inert needs two clears", () => {
    mountAppContent();
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    function Stack({ topOpen }: { topOpen: boolean }) {
      return (
        <>
          <Sheet open onClose={onCloseA} ariaLabel="Bottom">
            <button>a</button>
          </Sheet>
          <Sheet open={topOpen} onClose={onCloseB} ariaLabel="Top">
            <button>b</button>
          </Sheet>
        </>
      );
    }

    const { rerender } = render(<Stack topOpen />);
    // Both modals open → ref count 2.
    expect(appContent()!.inert).toBe(true);

    // One Escape hits the topmost only.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();

    // Closing the top modal decrements once — still inert (count 1).
    rerender(<Stack topOpen={false} />);
    expect(appContent()!.inert).toBe(true);

    // Closing the last modal decrements to 0 — inert clears.
    rerender(
      <>
        <Sheet open={false} onClose={onCloseA} ariaLabel="Bottom">
          <button>a</button>
        </Sheet>
        <Sheet open={false} onClose={onCloseB} ariaLabel="Top">
          <button>b</button>
        </Sheet>
      </>,
    );
    expect(appContent()!.inert).toBe(false);
  });

  it("closing the BOTTOM sheet of an open stack leaves the background inert (Pitfall 5)", () => {
    // T-22-03. The shipped stacked case above only ever closes a sheet that is
    // ALREADY at the top of the stack, so it cannot see the failure this guards:
    // `setRootInert(false)` decrements a SHARED count and guards underflow only at
    // zero. If one hook instance releases twice — once at close-START when `active`
    // flips, once again from the same effect's destroy at unmount ~200ms later —
    // the count drops 2 → 0 and `#app-content` becomes interactive UNDERNEATH a
    // still-open modal. Invisible to any single-sheet test.
    mountAppContent();

    function Stack({
      bottomOpen,
      topOpen,
    }: {
      bottomOpen: boolean;
      topOpen: boolean;
    }) {
      return (
        <>
          <Sheet open={bottomOpen} onClose={vi.fn()} ariaLabel="Bottom">
            <button>a</button>
          </Sheet>
          <Sheet open={topOpen} onClose={vi.fn()} ariaLabel="Top">
            <button>b</button>
          </Sheet>
        </>
      );
    }

    const { rerender } = render(<Stack bottomOpen topOpen />);
    expect(appContent()!.inert).toBe(true); // count 2

    // Close the BOTTOM one while the top stays open → count 1, still inert.
    rerender(<Stack bottomOpen={false} topOpen />);
    expect(appContent()!.inert).toBe(true);

    // Only when the top closes too does the count reach 0 and inert clear.
    rerender(<Stack bottomOpen={false} topOpen={false} />);
    expect(appContent()!.inert).toBe(false);
  });

  it("fullscreen variant renders a dialog with no backdrop scrim", () => {
    mountAppContent();
    render(
      <Sheet open onClose={vi.fn()} ariaLabel="Full" variant="fullscreen">
        <button>inside</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("inset-0");
    expect(document.querySelector(".bg-black\\/50")).toBeNull();
    // Still traps: background inert while open.
    expect(appContent()!.inert).toBe(true);
  });
});

/**
 * Phase-21 FOUND-02 / D-07 — the sheet primitive's bottom padding reads the ONE
 * owned value (`--gz-sheet-pad-bottom`, composed in `src/layout/bottomSpace.ts`)
 * instead of a hand-written `calc(env(safe-area-inset-bottom) + 32px)`.
 *
 * The conversion was value-preserving (21-RESEARCH Group B: this card is inside a
 * `fixed` overlay, so it never double-counted the inset the way `<main>` did).
 * These cases exist purely to stop a future edit from re-introducing a hand-written
 * `env()` read here and silently forking the arithmetic again.
 *
 * WHY `getAttribute("style")` AND NOT `el.style.paddingBottom`: jsdom's CSS parser
 * does not reliably round-trip a `var()` value through a typed longhand property, so
 * the typed read can come back empty even though the attribute is correct. The raw
 * attribute string is the honest assertion.
 */
describe("Sheet bottom padding is owner-composed (FOUND-02 / D-07)", () => {
  it("bottom-sheet card reads var(--gz-sheet-pad-bottom) and no raw env()", () => {
    mountAppContent();
    render(
      <Sheet open onClose={vi.fn()} ariaLabel="Padded">
        <button>inside</button>
      </Sheet>,
    );

    const style = screen.getByRole("dialog").getAttribute("style") ?? "";
    expect(style).toContain("var(--gz-sheet-pad-bottom)");
    expect(style).not.toContain("env(");
  });
});

/**
 * Phase-21 FOUND-03 / D-21/D-23 — PORTAL PARITY for the five HAND-ROLLED sheets.
 *
 * `SearchSheet` (21-11) plus `AlbumDetail`, `ArchiveBrowser`, `SetlistView` and
 * `NodeSheet` (21-12) all now `createPortal(…, document.body)`. Every one of them was
 * VoiceOver-verified in an earlier phase while nested in its trigger's subtree, and
 * T-21-34 is precisely the risk that moving the node silently changed what an AT user
 * gets. These cases pin the four things that survive a DOM move and that a reviewer can
 * check: the `role`, the `aria-modal` value (including NodeSheet's deliberate `false`),
 * a NON-EMPTY accessible name, and the fact that the root really did leave the trigger's
 * subtree for `document.body`.
 *
 * They are deliberately attribute-level. See the jsdom-limits addendum in the file
 * header for the three things device UAT test 8 still owns.
 *
 * None of the eight `<Sheet>` cases above is touched by this block — these five
 * surfaces stay hand-rolled per D-22 and share no machinery with the primitive.
 */
const { SearchSheet } = await import("../src/show/SearchSheet.tsx");
const { AlbumDetail } = await import("../src/dex/AlbumDetail.tsx");
const { ArchiveBrowser } = await import("../src/dex/ArchiveBrowser.tsx");
const { SetlistView } = await import("../src/dex/SetlistView.tsx");
const { NodeSheet } = await import("../src/explore/NodeSheet.tsx");

const parityArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2026-12-31",
  songs: { "101": "Rattlesnake" },
  shows: [
    {
      id: 4001,
      date: "2026-08-14",
      venue: "Brooklyn Steel",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      sets: [{ n: "1" as const, songs: [101] }],
    },
  ],
} as unknown as import("@guezzer/core").ArchiveArtifact;

const parityDex = {
  completion: { caught: 0, total: 1, pct: 0 },
  perSong: new Map(),
  neverSeen: [],
  rarestCatch: null,
  showCount: 0,
  perAlbum: new Map(),
} as unknown as import("@guezzer/core").DexStats;

const parityRarity: import("@guezzer/core").RarityIndex = new Map();

/** The five surfaces, each with the `aria-modal` value its design calls for. */
const HAND_ROLLED_SHEETS: Array<{
  name: string;
  ariaModal: "true" | "false";
  render: () => ReactElement;
}> = [
  {
    name: "SearchSheet",
    ariaModal: "true",
    render: () => (
      <SearchSheet open onClose={vi.fn()} onSelect={vi.fn()} onUnknown={vi.fn()} />
    ),
  },
  {
    name: "AlbumDetail",
    ariaModal: "true",
    render: () => (
      <AlbumDetail
        albumKey="nonagon-infinity"
        title="Nonagon Infinity"
        slug="nonagon-infinity"
        tracks={[
          { songId: 101, slug: "rattlesnake", title: "Rattlesnake", position: 1, inMatrix: true },
        ]}
        dex={parityDex}
        rarity={parityRarity}
        onBack={vi.fn()}
      />
    ),
  },
  {
    name: "ArchiveBrowser",
    ariaModal: "true",
    render: () => <ArchiveBrowser archive={parityArchive} onClose={vi.fn()} />,
  },
  {
    name: "SetlistView",
    ariaModal: "true",
    render: () => (
      <SetlistView
        showId={4001}
        archive={parityArchive}
        rarity={parityRarity}
        onClose={vi.fn()}
      />
    ),
  },
  {
    // The one deliberate non-modal: a peek panel with no scrim, over a constellation
    // that must stay reachable (D-26). `false` here is the contract, not an oversight.
    name: "NodeSheet",
    ariaModal: "false",
    render: () => (
      <NodeSheet
        songName="Rattlesnake"
        playCount={42}
        total={0}
        bars={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    ),
  },
];

describe("Portal parity for the hand-rolled sheets (FOUND-03 / D-21, T-21-34)", () => {
  for (const surface of HAND_ROLLED_SHEETS) {
    it(`${surface.name}: keeps role/aria-modal/name and lands on document.body`, () => {
      // `mountAppContent()` is the trigger subtree these surfaces used to render
      // inside; `container` is the render root. A portaled surface must be in neither.
      const trigger = mountAppContent();
      const { container } = render(surface.render());

      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("role")).toBe("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe(surface.ariaModal);

      // A non-empty accessible name — the ONLY name VoiceOver announces for these
      // surfaces, since none of them uses aria-labelledby.
      const name = dialog.getAttribute("aria-label");
      expect(name, `${surface.name} has no accessible name`).toBeTruthy();
      expect((name ?? "").trim().length).toBeGreaterThan(0);

      // Out of the trigger's subtree, out of the render container, straight to body.
      expect(dialog.parentElement).toBe(document.body);
      expect(container.contains(dialog)).toBe(false);
      expect(trigger.parentElement!.contains(dialog)).toBe(false);
    });
  }

  it("all five carry the sheet tier, so the portal is what orders them (D-20)", () => {
    // Parity in the other direction: the portals did not quietly re-tier anything.
    // Same numbers as before the move — the NESTING is the only thing that changed.
    for (const surface of HAND_ROLLED_SHEETS) {
      mountAppContent();
      render(surface.render());
      expect(
        screen.getByRole("dialog").style.zIndex,
        `${surface.name} no longer renders at config.ui.z.sheet`,
      ).toBe(String(config.ui.z.sheet));
      cleanup();
      document.getElementById("app-content")?.remove();
    }
  });
});

import { useRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "../src/components/Sheet.tsx";

/**
 * Phase-22 SHEET-02 / D-20 — the close-START contract, asserted while the exiting
 * sheet is STILL MOUNTED.
 *
 * > One timing rule for the whole phase: a surface leaves the accessibility tree and
 * > stops being a pointer target at the START of its exit, and leaves the DOM only at
 * > the END.
 *
 * ## ⚠ THIS FILE DELIBERATELY DOES NOT MOCK `motion/react`. Do not add one.
 *
 * Both plausible doubles are wrong here, in opposite directions:
 *
 *  • **The shipped pass-through double** (`AnimatePresence: ({children}) => children`,
 *    used by `sheet.motion.test.tsx` and `WaveToast.test.tsx`) unmounts the exiting
 *    child INSTANTLY. There is then no exit window at all, and every assertion below
 *    passes **vacuously** — `getAttribute("aria-hidden")` on a detached node, a click
 *    on a scrim nobody can reach. A green test proving nothing.
 *
 *  • **A hand-rolled "retaining" double** that keeps the child mounted but re-renders
 *    `children` fresh is WORSE than no test. It would show `aria-hidden` and
 *    `pointer-events` flipping correctly **even if production derived them from the
 *    `open` prop** — i.e. it makes this file pass against the exact §Pitfall 14 defect
 *    it exists to catch. (An exiting `AnimatePresence` child renders from a FROZEN
 *    React element: its props were baked in while `open === true` and can never
 *    update again. Only `useIsPresent()`, a context read inside the child, actually
 *    changes.)
 *
 * The real library works end to end under this repo's jsdom (probe P3):
 * `Element.prototype.animate` is undefined, so `motion` runs its rAF fallback; the
 * exiting node is retained synchronously and removed after the duration. **No fake
 * timers** — they desynchronise that loop.
 *
 * ## The anti-vacuity check is load-bearing
 *
 * Case 1's FIRST assertion after `rerender` is `document.body.contains(dialog)`.
 * Without it, an accidental regression to instant unmount would turn all five
 * following assertions green. It is not decoration; it is what makes the rest mean
 * anything.
 *
 * ## What this file does NOT assert, on purpose
 *
 * **No geometry.** Probe P1 showed `motion` writes the exit TARGET
 * (`translateY(100%)`) into inline style essentially immediately under jsdom, so a
 * transform value is not a trustworthy proxy for visual progress. Only attributes,
 * presence and removal are asserted here.
 *
 * **No real 200ms touch timing.** Whether a tap during a real exit on a real device
 * reaches the real background is `22-HUMAN-UAT.md` test 2 (plan 22-09). This file
 * keeps the *contract* true on every commit; the device session proves it once.
 *
 * ## Revert unit (D-17/D-18)
 *
 * This file ships in the SAME commit as `Sheet.tsx`'s `exit` variants. Reverting that
 * one commit removes the exit behaviour AND every assertion here that depends on an
 * exit window, leaving the sanctioned enter-only build green. See plan 22-09's revert
 * procedure 1 for the three exit-window `describe` blocks that live in other files
 * and must go with it.
 */

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

const appContent = () => document.getElementById("app-content")!;
const scrimEl = () => document.querySelector<HTMLElement>(".bg-black\\/50");

afterEach(() => {
  cleanup();
  document.getElementById("app-content")?.remove();
});

describe("SHEET-02 close-START contract (D-20), against the real motion library", () => {
  it("releases inert, restores focus, hides and de-targets the sheet BEFORE unmount", async () => {
    const trigger = mountAppContent();
    trigger.focus();
    const onClose = vi.fn();

    const { rerender } = render(
      <Sheet open onClose={onClose} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    expect(appContent().inert).toBe(true);
    const dialog = screen.getByRole("dialog");
    const scrim = scrimEl()!;
    expect(scrim).not.toBeNull();

    rerender(
      <Sheet open={false} onClose={onClose} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    // ── ANTI-VACUITY FIRST. Everything below is only meaningful while the exiting
    //    subtree is still mounted; if this ever fails, the five assertions after it
    //    are testing detached nodes and prove nothing.
    expect(document.body.contains(dialog)).toBe(true);
    expect(document.body.contains(scrim)).toBe(true);

    // D-19 #1 — the background is tappable DURING the exit. SHEET-02's literal demand.
    expect(appContent().inert).toBe(false);
    // D-19 #2 — a screen-reader user is never left on a disappearing element.
    expect(document.activeElement).toBe(trigger);
    // D-19 #3 — VoiceOver must not read a sheet on its way out. THE assertion that
    // catches §Pitfall 14: it stays `null` if the attribute is derived from `open`.
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    // D-19 #4 — BOTH elements (Pitfall 4c: `pointer-events` on an ancestor does not
    // override a descendant, and these two are siblings anyway).
    expect(dialog.style.pointerEvents).toBe("none");
    expect(scrim.style.pointerEvents).toBe("none");

    // Pitfall 4b — `fireEvent` dispatches directly and IGNORES `pointer-events`, so
    // the style assertion above cannot prove a tap is harmless. Dropping the handler
    // is the half that is provable in jsdom; together they are one contract.
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();

    // D-19 #6 — the DOM removal is the ONLY thing that waits.
    //
    // Wait on the NODE, never on `queryByRole("dialog")`. Once D-19 #3 lands, the
    // exiting card is out of the accessibility tree, and `*ByRole` ignores
    // `aria-hidden` subtrees by default — so a role query reports "already removed"
    // while the node is very much still painted. (Corollary: that mistake is a
    // silent false green, since `waitForElementToBeRemoved` would resolve instantly.)
    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
    expect(scrimEl()).toBeNull();
  });

  it("aria-hidden never lands on the subtree that holds focus (Pitfall 4a)", async () => {
    const trigger = mountAppContent();
    trigger.focus();

    const { rerender } = render(
      <Sheet open onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    rerender(
      <Sheet open={false} onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    expect(document.body.contains(dialog)).toBe(true); // anti-vacuity
    // The axe `aria-hidden-focus` violation, stated as a contract: at the moment the
    // card becomes hidden from AT, `document.activeElement` is already outside it.
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(false);

    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
  });

  it("re-opening mid-exit self-corrects — no stale aria-hidden, no stale pointer-events (D-22)", () => {
    const trigger = mountAppContent();
    trigger.focus();

    const { rerender } = render(
      <Sheet open onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");

    rerender(
      <Sheet open={false} onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );
    expect(document.body.contains(dialog)).toBe(true); // still exiting — anti-vacuity
    expect(dialog.getAttribute("aria-hidden")).toBe("true");

    // Interrupt the exit. `AnimatePresence` reverses from the current position and the
    // SAME DOM node is reused, which is exactly why an IMPERATIVE teardown would be
    // wrong here: it would have to remember to undo itself. Deriving from
    // `useIsPresent()` means there is nothing to undo.
    rerender(
      <Sheet open onClose={vi.fn()} ariaLabel="Modal">
        <button>inside</button>
      </Sheet>,
    );

    expect(screen.getByRole("dialog")).toBe(dialog); // same node, reversed
    // The ABSENCE of the attribute, not merely a present dialog.
    expect(dialog.hasAttribute("aria-hidden")).toBe(false);
    expect(dialog.style.pointerEvents).toBe("");
    expect(scrimEl()!.style.pointerEvents).toBe("");
    expect(appContent().inert).toBe(true);
  });

  it("initialFocusRef fires at enter-END and never on exit (D-27, Pitfall 12)", async () => {
    const trigger = mountAppContent();
    trigger.focus();

    function Harness({ open }: { open: boolean }) {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <Sheet
          open={open}
          onClose={vi.fn()}
          ariaLabel="Modal"
          initialFocusRef={inputRef}
        >
          <button>first</button>
          <input ref={inputRef} aria-label="target" />
        </Sheet>
      );
    }

    const { rerender } = render(<Harness open />);
    const input = screen.getByLabelText("target");
    const dialog = screen.getByRole("dialog");

    // Enter-START: focus is inside the trap but NOT yet on the explicit target —
    // focusing an input opens the iOS keyboard, and doing that on a translating
    // element races two layout changes (D-27).
    expect(input).not.toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Enter-END.
    await waitFor(() => expect(input).toHaveFocus());

    rerender(<Harness open={false} />);
    // Close-START: focus is already back on the trigger.
    expect(document.activeElement).toBe(trigger);

    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
    // Close-END: the EXIT's `onAnimationComplete` also fires (motion notifies for any
    // definition), and it must NOT have pulled focus back into the sheet. An
    // `if (open)` guard there would be frozen at `true` and would do exactly that.
    expect(document.activeElement).toBe(trigger);
  });

  it("fullscreen has no scrim to de-target but still hides and de-targets itself", async () => {
    const trigger = mountAppContent();
    trigger.focus();

    const { rerender } = render(
      <Sheet open onClose={vi.fn()} ariaLabel="Full" variant="fullscreen">
        <button>inside</button>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(scrimEl()).toBeNull();

    rerender(
      <Sheet
        open={false}
        onClose={vi.fn()}
        ariaLabel="Full"
        variant="fullscreen"
      >
        <button>inside</button>
      </Sheet>,
    );

    expect(document.body.contains(dialog)).toBe(true); // anti-vacuity
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(dialog.style.pointerEvents).toBe("none");
    expect(appContent().inert).toBe(false);
    expect(document.activeElement).toBe(trigger);
    // D-21's fullscreen exemplar renders no backdrop in either state, so there is no
    // second element to de-target — the card carries the whole contract alone.
    expect(scrimEl()).toBeNull();

    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
  });
});

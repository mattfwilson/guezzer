import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-8 A11Y-01 contract for the shared <Sheet> primitive + the a11y layer
 * (useFocusTrap / useDialogDismiss / dialogStack / ref-counted inertRoot).
 *
 * jsdom limits: it cannot move focus on a real Tab press (that needs user-event),
 * so real Tab-order wrapping is deferred to the end-of-phase on-device AT sweep.
 * These assertions are handler-level: Escape via `fireEvent.keyDown(document, …)`,
 * initial/restore focus via `document.activeElement`, and background suppression
 * via the `#app-content` element's `inert` state.
 */
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

  it("initialFocusRef receives focus on open instead of the first focusable", () => {
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
    expect(document.activeElement).toBe(screen.getByLabelText("target"));
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

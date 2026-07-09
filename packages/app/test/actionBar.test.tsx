import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionBar } from "../src/show/ActionBar.tsx";
import { config } from "../src/config.ts";

/**
 * ActionBar secondary-row WIRING (04-06). The bar is a dumb component: its
 * secondary buttons must invoke the onSetBreak/onEncore/onUndo callbacks (which
 * ShowView binds to markSetBreak/markEncore/undoLast). These assert the
 * button→callback wiring and the D-15 split — Undo fires immediately with NO
 * confirm dialog rendered from the bar.
 */
function renderBar() {
  const handlers = {
    onSearch: vi.fn(),
    onUnknown: vi.fn(),
    onSetBreak: vi.fn(),
    onEncore: vi.fn(),
    onUndo: vi.fn(),
  };
  render(<ActionBar {...handlers} />);
  return handlers;
}

describe("ActionBar secondary row wiring (04-06)", () => {
  // Vitest doesn't auto-run testing-library cleanup unless globals are on, so
  // unmount between renders to keep `screen` scoped to the current test.
  afterEach(cleanup);

  it("set-structure: Set break invokes onSetBreak and Encore invokes onEncore (SHOW-06)", () => {
    const handlers = renderBar();

    fireEvent.click(
      screen.getByRole("button", { name: config.copy.show.setBreakCta }),
    );
    expect(handlers.onSetBreak).toHaveBeenCalledTimes(1);
    expect(handlers.onEncore).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: config.copy.show.encoreCta }),
    );
    expect(handlers.onEncore).toHaveBeenCalledTimes(1);

    // Neither structural control touches the log/miss paths.
    expect(handlers.onUnknown).not.toHaveBeenCalled();
    expect(handlers.onSearch).not.toHaveBeenCalled();
  });

  it("undo: Undo invokes onUndo immediately with no confirm dialog (D-15)", () => {
    const handlers = renderBar();

    fireEvent.click(
      screen.getByRole("button", { name: config.copy.show.undoCta }),
    );

    // Fired in one tap — no intervening dialog (the D-15 fast path).
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    // Undo is not accidentally the destructive-confirm copy.
    expect(screen.queryByText(config.copy.show.deleteHeading)).toBeNull();
  });

  it("set-structure: secondary controls are enabled and none are accent-styled", () => {
    renderBar();

    for (const label of [
      config.copy.show.setBreakCta,
      config.copy.show.encoreCta,
      config.copy.show.undoCta,
    ]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeEnabled();
      // Gold (accent) is reserved for Start Show / focus ring — never here.
      expect(button.className).not.toContain("accent");
    }
  });
});

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SyncDot } from "../src/live/SyncDot.tsx";

/** jsdom serializes inline color hex as `rgb(r, g, b)`. */
function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

const AMBER = "#F59E0B";
const GREEN = "#22C55E";

/**
 * SyncDot gains a calm "reconnecting" state (Plan 18-05, AUTH-08 / D-07): a
 * stale/expired token surfaces as the SAME glyph turned amber — never a second
 * connection indicator, never a "logged out" message. The existing online /
 * offline / schema-drift states are unchanged.
 */
describe("SyncDot reconnecting state (AUTH-08 / D-07)", () => {
  afterEach(() => cleanup());

  it("renders a calm amber glyph with a distinct aria-label when reconnecting", () => {
    render(createElement(SyncDot, { online: false, reconnecting: true }));
    const dot = screen.getByRole("status", { name: "Sync: reconnecting" });
    expect(dot.style.backgroundColor).toBe(hexToRgb(AMBER));
  });

  it("is not tappable in the reconnecting state (a state, not a control)", () => {
    render(createElement(SyncDot, { online: false, reconnecting: true }));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never surfaces 'logged out' language", () => {
    render(createElement(SyncDot, { online: false, reconnecting: true }));
    expect(screen.queryByText(/logged out/i)).toBeNull();
    expect(
      screen.getByRole("status", { name: "Sync: reconnecting" }).getAttribute("aria-label"),
    ).not.toMatch(/logged out/i);
  });

  it("preserves the online (green) state", () => {
    render(createElement(SyncDot, { online: true }));
    const dot = screen.getByRole("status", { name: "Sync: online" });
    expect(dot.style.backgroundColor).toBe(hexToRgb(GREEN));
  });

  it("preserves the offline (muted ring) state", () => {
    render(createElement(SyncDot, { online: false }));
    const dot = screen.getByRole("status", { name: "Sync: offline" });
    expect(dot.style.backgroundColor).toBe("transparent");
    expect(dot.style.boxShadow).toContain("inset");
  });

  it("keeps schemaDrift precedence: drift wins over reconnecting and stays tappable", () => {
    render(
      createElement(SyncDot, {
        online: false,
        reconnecting: true,
        schemaDrift: true,
        novelKeys: ["encore"],
      }),
    );
    // The drift control keeps its explicit role="status" + aria-expanded (it is
    // the ONLY tappable/popover SyncDot state) and takes precedence over reconnecting.
    const drift = screen.getByRole("status", { name: "Sync: API shape changed" });
    expect(drift.tagName).toBe("BUTTON");
    expect(drift).toHaveAttribute("aria-expanded");
    expect(screen.queryByRole("status", { name: "Sync: reconnecting" })).toBeNull();
  });
});

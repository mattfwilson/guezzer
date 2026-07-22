import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { identityColorIndex } from "@guezzer/core";
import { config } from "../src/config.ts";
import {
  readIdentityRecord,
  writeIdentityRecord,
} from "../src/auth/identityRecord.ts";

// `db/supabase.ts` throws at import time when the public VITE_ vars are absent
// (they are, under vitest). Mock the singleton so IdentityAvatar's sign-out path
// is exercised without a real client — and so `signOut` is a spy we can assert.
const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("../src/db/supabase.ts", () => ({
  supabase: { auth: { signOut } },
}));

// Imported AFTER the mock is registered.
import { IdentityAvatar } from "../src/auth/IdentityAvatar.tsx";

/** jsdom serializes inline `background-color` hex as `rgb(r, g, b)`. */
function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

const PALETTE = config.auth.IDENTITY_COLORS;

describe("IdentityAvatar (AUTH-03/04/07)", () => {
  beforeEach(() => {
    localStorage.clear();
    signOut.mockClear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders nothing when there is no identity (signed out)", () => {
    const { container } = render(createElement(IdentityAvatar));
    expect(container.firstChild).toBeNull();
  });

  it("colors the glyph deterministically from the user id via the auth palette (D-13/AUTH-07)", () => {
    writeIdentityRecord({ userId: "user-abc", displayName: "Matt Wilson" });
    const expected = hexToRgb(PALETTE[identityColorIndex("user-abc", PALETTE.length)]);

    render(createElement(IdentityAvatar));
    const first = screen.getByText("MW");
    expect(first.style.backgroundColor).toBe(expected);
    cleanup();

    // Same id on a second render → same color (determinism).
    render(createElement(IdentityAvatar));
    expect(screen.getByText("MW").style.backgroundColor).toBe(expected);
  });

  it("always renders initials, never color alone (D-12)", () => {
    writeIdentityRecord({ userId: "u2", displayName: "Stu" });
    render(createElement(IdentityAvatar));
    // 1-char initial present and legible with the dark-on-light pairing.
    const glyph = screen.getByText("S");
    expect(glyph.style.color).toBe(hexToRgb("#0C0C10"));
  });

  it("opens a sheet showing the full display_name on tap (AUTH-03/D-14)", async () => {
    writeIdentityRecord({ userId: "u3", displayName: "Matt Wilson" });
    render(createElement(IdentityAvatar));

    // The full name is NOT visible until the sheet opens (only initials show).
    expect(screen.queryByText("Matt Wilson")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /matt wilson/i }));
    expect(await screen.findByText("Matt Wilson")).toBeInTheDocument();
  });

  it("sign-out calls supabase.auth.signOut then clears the identity record (D-04/D-10)", async () => {
    writeIdentityRecord({ userId: "u4", displayName: "Ada" });
    render(createElement(IdentityAvatar));

    fireEvent.click(screen.getByRole("button", { name: /ada/i }));
    fireEvent.click(await screen.findByRole("button", { name: config.copy.auth.signOut }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readIdentityRecord()).toBeNull());
  });

  it("has no 'logged out' / destructive language in the sign-out control", () => {
    writeIdentityRecord({ userId: "u5", displayName: "Ada" });
    render(createElement(IdentityAvatar));
    fireEvent.click(screen.getByRole("button", { name: /ada/i }));
    expect(screen.queryByText(/logged out/i)).toBeNull();
  });
});

import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIdentityRecord,
  IDENTITY_CHANGE_EVENT,
  IDENTITY_KEY,
  readIdentityRecord,
  writeIdentityRecord,
} from "../src/auth/identityRecord.ts";
import { useAuthIdentity } from "../src/auth/useAuthIdentity.ts";

/**
 * App-owned identity record store (Plan 18-03, AUTH-02 / D-05 / D-06). A tiny
 * synchronous localStorage-backed `{ userId, displayName } | null` on a NEW
 * app-owned key — distinct from supabase-js's `sb-<ref>-auth-token`. The boot
 * gate keys on THIS record's presence (never on a network `getSession()`), so a
 * friend whose token expired overnight is never locked out of their offline dex.
 */
describe("identityRecord store (AUTH-02)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("uses an app-owned key distinct from the supabase library key", () => {
    // A NEW app-owned key — must never be a supabase-js `sb-<ref>-auth-token`.
    expect(IDENTITY_KEY).toBe("gwf-identity");
    expect(IDENTITY_KEY.startsWith("sb-")).toBe(false);
  });

  it("round-trips a written record synchronously", () => {
    writeIdentityRecord({ userId: "u1", displayName: "Matt" });
    expect(readIdentityRecord()).toEqual({ userId: "u1", displayName: "Matt" });
  });

  it("returns null after clear", () => {
    writeIdentityRecord({ userId: "u1", displayName: "Matt" });
    clearIdentityRecord();
    expect(readIdentityRecord()).toBeNull();
  });

  it("returns null on a fresh (unwritten) store without throwing", () => {
    expect(() => readIdentityRecord()).not.toThrow();
    expect(readIdentityRecord()).toBeNull();
  });

  it("returns null (never a half object) on a malformed / partial stored value", () => {
    // Missing displayName.
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ userId: "u1" }));
    expect(readIdentityRecord()).toBeNull();

    // Empty-string fields are not a valid identity.
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ userId: "", displayName: "Matt" }),
    );
    expect(readIdentityRecord()).toBeNull();

    // Non-object / non-JSON garbage.
    localStorage.setItem(IDENTITY_KEY, "not json {");
    expect(readIdentityRecord()).toBeNull();

    // Wrong value types.
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ userId: 1, displayName: 2 }),
    );
    expect(readIdentityRecord()).toBeNull();
  });

  it("dispatches the change event exactly once on write", () => {
    const spy = vi.fn();
    window.addEventListener(IDENTITY_CHANGE_EVENT, spy);
    writeIdentityRecord({ userId: "u1", displayName: "Matt" });
    window.removeEventListener(IDENTITY_CHANGE_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("dispatches the change event exactly once on clear", () => {
    const spy = vi.fn();
    window.addEventListener(IDENTITY_CHANGE_EVENT, spy);
    clearIdentityRecord();
    window.removeEventListener(IDENTITY_CHANGE_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

/**
 * useAuthIdentity reactive hook (D-10 teardown substrate). A
 * `useSyncExternalStore` over the identity change event: its first snapshot is
 * the synchronous `readIdentityRecord()` read (zero await, so the gate paints
 * with no suspense, D-05), and it re-renders subscribers on sign-in and
 * sign-out.
 */
describe("useAuthIdentity hook (D-10)", () => {
  function Probe(): ReturnType<typeof createElement> {
    const identity = useAuthIdentity();
    return createElement(
      "div",
      { "data-testid": "identity" },
      identity ? identity.displayName : "SIGNED_OUT",
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("returns the current record as its synchronous first snapshot", () => {
    writeIdentityRecord({ userId: "u1", displayName: "Matt" });
    render(createElement(Probe));
    // Present on the very first render — no await, no loading flash.
    expect(screen.getByTestId("identity").textContent).toBe("Matt");
  });

  it("first-snapshots null when no record is present", () => {
    render(createElement(Probe));
    expect(screen.getByTestId("identity").textContent).toBe("SIGNED_OUT");
  });

  it("re-renders to null after clearIdentityRecord() (sign-out teardown)", () => {
    writeIdentityRecord({ userId: "u1", displayName: "Matt" });
    render(createElement(Probe));
    expect(screen.getByTestId("identity").textContent).toBe("Matt");

    act(() => {
      clearIdentityRecord();
    });
    expect(screen.getByTestId("identity").textContent).toBe("SIGNED_OUT");
  });

  it("re-renders to the new identity after writeIdentityRecord() (sign-in)", () => {
    render(createElement(Probe));
    expect(screen.getByTestId("identity").textContent).toBe("SIGNED_OUT");

    act(() => {
      writeIdentityRecord({ userId: "u2", displayName: "Max" });
    });
    expect(screen.getByTestId("identity").textContent).toBe("Max");
  });
});

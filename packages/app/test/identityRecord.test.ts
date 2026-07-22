import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIdentityRecord,
  IDENTITY_CHANGE_EVENT,
  IDENTITY_KEY,
  readIdentityRecord,
  writeIdentityRecord,
} from "../src/auth/identityRecord.ts";

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

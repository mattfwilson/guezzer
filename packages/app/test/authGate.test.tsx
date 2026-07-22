import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/**
 * AuthGate boot-interposition contract (Plan 18-06 Task 1, AUTH-02 / D-02/D-05/
 * D-06/D-10 — THE CRUX). The gate keys on the PRESENCE of the app-owned identity
 * record (Plan 03), NEVER on a network `getSession()` call, so it cold-boots the
 * app fully offline even when the token has expired (RESEARCH Pitfall 1). The
 * background reconciler runs `getSession()`/`onAuthStateChange` only AFTER first
 * paint, and ONLY an explicit `SIGNED_OUT` clears the identity (Pitfall 3).
 *
 * `../src/App.tsx` and `../src/auth/SignInScreen.tsx` are mocked to lightweight
 * markers so these tests exercise the GATE decision (App-vs-SignIn + teardown),
 * not the whole app tree. The supabase singleton is mocked (the real module
 * throws at import when VITE_ vars are unset, and we must capture the auth
 * callback). The identity record + `useAuthIdentity` are REAL — the gate's
 * zero-await synchronous read is the behavior under test.
 */

// Capture the onAuthStateChange callback so tests can drive auth events.
let authCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribe = vi.fn();
const getSession = vi.fn(() => Promise.resolve({ data: { session: null } }));
const onAuthStateChange = vi.fn((cb: (event: string, session: unknown) => void) => {
  authCallback = cb;
  return { data: { subscription: { unsubscribe } } };
});

vi.mock("../src/db/supabase.ts", () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));
// AuthGate's WR-04 self-heal effect calls claimLegacyDexOnce(identity.userId) —
// mock it to a resolved no-op so these gate-decision tests never touch Dexie.
vi.mock("../src/auth/claimDex.ts", () => ({
  claimLegacyDexOnce: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/App.tsx", () => ({
  App: () => <div>APP CONTENT</div>,
}));
vi.mock("../src/auth/SignInScreen.tsx", () => ({
  SignInScreen: ({ online }: { online: boolean }) => (
    <div>SIGN IN SCREEN online={String(online)}</div>
  ),
}));

const { AuthGate } = await import("../src/auth/AuthGate.tsx");
const {
  writeIdentityRecord,
  clearIdentityRecord,
  readIdentityRecord,
  markUserSignOut,
} = await import("../src/auth/identityRecord.ts");

const IDENTITY = { userId: "user-A", displayName: "Ada" };

beforeEach(() => {
  localStorage.clear();
  authCallback = null;
  unsubscribe.mockReset();
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
  onAuthStateChange.mockReset().mockImplementation(
    (cb: (event: string, session: unknown) => void) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe } } };
    },
  );
});
afterEach(cleanup);

describe("AuthGate — offline-safe boot interposition (AUTH-02, THE CRUX)", () => {
  it("renders App content with an identity present WITHOUT awaiting getSession first paint", () => {
    // getSession never resolves — if boot awaited it, App content would never
    // paint. It DOES paint → the boot path is zero-await (D-05, Pitfall 1).
    (getSession as Mock).mockReturnValue(new Promise(() => {}));
    writeIdentityRecord(IDENTITY);

    render(<AuthGate />);

    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
    // The reconciler is wired — but only inside the post-paint effect.
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("renders the SignInScreen (app fully blocked) when no identity is present", () => {
    render(<AuthGate />);

    expect(screen.getByText(/SIGN IN SCREEN/)).toBeInTheDocument();
    expect(screen.queryByText("APP CONTENT")).not.toBeInTheDocument();
  });

  it("tears down to the SignInScreen instantly when the identity record is cleared (D-10)", () => {
    writeIdentityRecord(IDENTITY);
    render(<AuthGate />);
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();

    act(() => {
      clearIdentityRecord();
    });

    expect(screen.getByText(/SIGN IN SCREEN/)).toBeInTheDocument();
    // No flash of the prior person's dex — App content is gone.
    expect(screen.queryByText("APP CONTENT")).not.toBeInTheDocument();
  });

  it("clears the identity ONLY on an explicit SIGNED_OUT — never on an offline refresh failure (Pitfall 3)", () => {
    writeIdentityRecord(IDENTITY);
    render(<AuthGate />);
    expect(authCallback).not.toBeNull();

    // A pending/failed offline refresh surfaces as a non-SIGNED_OUT event with
    // no session — it must NOT clear the identity (never a mid-venue logout).
    act(() => {
      authCallback?.("TOKEN_REFRESHED", null);
    });
    expect(readIdentityRecord()).toEqual(IDENTITY);
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();

    // A USER-INITIATED SIGNED_OUT (IdentityAvatar flags the intent first) DOES
    // clear + tear down.
    act(() => {
      markUserSignOut();
      authCallback?.("SIGNED_OUT", null);
    });
    expect(readIdentityRecord()).toBeNull();
    expect(screen.getByText(/SIGN IN SCREEN/)).toBeInTheDocument();
    expect(screen.queryByText("APP CONTENT")).not.toBeInTheDocument();
  });

  it("does NOT clear the identity on a library-emitted SIGNED_OUT (online token-refresh failure) — WR-01/AUTH-04/T-18-06-A", () => {
    // supabase-js (autoRefreshToken) emits SIGNED_OUT on a definitive
    // invalid-grant refresh while online — NOT a user tap. Without the
    // user-initiated flag set, the reconciler must leave a stale-token friend
    // signed in (they reconnect calmly, amber SyncDot) rather than eject them.
    writeIdentityRecord(IDENTITY);
    render(<AuthGate />);
    expect(authCallback).not.toBeNull();

    act(() => {
      // No markUserSignOut() — this is a background/refresh-driven event.
      authCallback?.("SIGNED_OUT", null);
    });

    expect(readIdentityRecord()).toEqual(IDENTITY);
    expect(screen.getByText("APP CONTENT")).toBeInTheDocument();
    expect(screen.queryByText(/SIGN IN SCREEN/)).not.toBeInTheDocument();
  });
});

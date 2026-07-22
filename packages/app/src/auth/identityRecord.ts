/**
 * App-owned identity record (Plan 18-03, AUTH-02 / D-05 / D-06; RESEARCH
 * Pattern 2 + Pitfall 1). A tiny synchronous, offline-safe `{ userId,
 * displayName } | null` store on a dedicated localStorage key.
 *
 * The boot gate keys on the PRESENCE of this record — never on a network
 * `getSession()` call, which returns null offline (RESEARCH Pitfall 1). That is
 * the belt-and-suspenders reading of D-06: a friend whose Supabase token
 * expired overnight is never locked out of their own offline dex, because the
 * gate reads THIS record, not token validity.
 *
 * The key is a NEW app-owned key, deliberately distinct from supabase-js's own
 * `sb-<ref>-auth-token` key (which is library-owned and never touched here). All
 * reads are data only — downstream must render them as text, never via
 * `dangerouslySetInnerHTML` (ASVS V5).
 */

/** App-owned localStorage key — NOT the supabase-js `sb-<ref>-auth-token`. */
export const IDENTITY_KEY = "gwf-identity";

/** Custom window event fired on every write/clear so subscribers re-render. */
export const IDENTITY_CHANGE_EVENT = "gwf-identity-change";

export interface AuthIdentity {
  userId: string;
  displayName: string;
}

/**
 * Synchronous read of the app-owned record. Returns null on a missing,
 * malformed, or partial value (both fields must be non-empty strings) — never
 * throws, never returns a half object. A malformed record therefore falls
 * through to the sign-in screen (recoverable), never a crash (threat T-18-03-D).
 */
export function readIdentityRecord(): AuthIdentity | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(IDENTITY_KEY);
  } catch {
    // localStorage can throw (privacy mode / disabled storage) — treat as absent.
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).userId !== "string" ||
    typeof (parsed as Record<string, unknown>).displayName !== "string"
  ) {
    return null;
  }

  const { userId, displayName } = parsed as {
    userId: string;
    displayName: string;
  };
  if (userId === "" || displayName === "") return null;

  return { userId, displayName };
}

/** Persist the record and notify subscribers (drives sign-in re-render, D-10). */
export function writeIdentityRecord(identity: AuthIdentity): void {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  window.dispatchEvent(new Event(IDENTITY_CHANGE_EVENT));
}

/** Remove the record and notify subscribers (drives sign-out teardown, D-10). */
export function clearIdentityRecord(): void {
  localStorage.removeItem(IDENTITY_KEY);
  window.dispatchEvent(new Event(IDENTITY_CHANGE_EVENT));
}

/**
 * User-initiated sign-out intent flag (WR-01 / AUTH-04 / AUTH-08, threat
 * T-18-06-A). supabase-js (default `autoRefreshToken: true`) emits a `SIGNED_OUT`
 * event NOT only on an explicit user tap but also on a definitive token-refresh
 * failure while ONLINE (a genuinely-invalidated refresh token). The AuthGate
 * reconciler must clear the app-owned identity ONLY for the explicit case — a
 * refresh-driven `SIGNED_OUT` should leave a stale-token friend signed in (they
 * reconnect calmly via the amber SyncDot) rather than eject them mid-use.
 *
 * `IdentityAvatar.handleSignOut` calls {@link markUserSignOut} right before
 * `supabase.auth.signOut()`; the reconciler {@link consumeUserSignOut consumes}
 * the flag (read-and-reset) to decide whether a `SIGNED_OUT` was user-initiated.
 */
let userInitiatedSignOut = false;

/** Flag the NEXT `SIGNED_OUT` as an explicit user action (IdentityAvatar). */
export function markUserSignOut(): void {
  userInitiatedSignOut = true;
}

/**
 * Read-and-reset the user-initiated sign-out intent. Returns `true` exactly once
 * per {@link markUserSignOut} call, then resets — so a subsequent library-emitted
 * (refresh-failure) `SIGNED_OUT` is correctly treated as NOT user-initiated.
 */
export function consumeUserSignOut(): boolean {
  const value = userInitiatedSignOut;
  userInitiatedSignOut = false;
  return value;
}

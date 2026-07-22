/**
 * THE CRUX — the offline-safe boot interposition (Plan 18-06, AUTH-02/04 /
 * D-02/D-05/D-06/D-10/D-17; RESEARCH Pattern 2 + Pitfall 1/3).
 *
 * `main.tsx` renders `<AuthGate/>` as the root (was `<App/>`). The gate makes a
 * SINGLE decision on every render: an app-owned identity record present →
 * `<App/>`; absent → `<SignInScreen/>` (the app is a full gate behind auth,
 * D-02). It reads the identity SYNCHRONOUSLY via `useAuthIdentity()` (a
 * `useSyncExternalStore` snapshot of `readIdentityRecord()`) — ZERO await, no
 * splash, and crucially NO `getSession()` on the boot path.
 *
 * Why gate on the record and not `supabase.auth.getSession()` (the intentional,
 * owner-accepted belt-and-suspenders reading of D-05/D-06): `getSession()`
 * returns null when offline (the VERIFIED RESEARCH Pitfall 1), so gating on it
 * would lock a friend whose token expired overnight out of their OWN offline dex
 * at a dead-signal venue — exactly the failure this phase exists to kill. The
 * gate therefore keys on identity PRESENCE, not token validity: an
 * expired-but-present session still opens the full dex.
 *
 * `getSession()`/`onAuthStateChange` are still honored — but only in the
 * BACKGROUND reconciler (a `useEffect` that runs AFTER first paint). Their
 * result never gates boot; it only reconciles connectivity and drives the calm
 * reconnecting affordance (amber `SyncDot`). ONLY an explicit `SIGNED_OUT`
 * event clears the identity — a pending/failed offline refresh is NOT a
 * sign-out (Pitfall 3 / AUTH-08, threat T-18-06-A). Sign-out itself (the
 * IdentityAvatar control, Plan 05) clears the record directly, which re-renders
 * this gate to the sign-in screen instantly with no flash of the prior dex
 * (D-10 teardown).
 */
import { useEffect, useState } from "react";
import { App } from "../App.tsx";
import { supabase } from "../db/supabase.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { clearIdentityRecord } from "./identityRecord.ts";
import { ReconnectContext } from "./reconnectContext.ts";
import { SignInScreen } from "./SignInScreen.tsx";
import { useAuthIdentity } from "./useAuthIdentity.ts";

export function AuthGate() {
  // Synchronous, offline-safe identity snapshot — the ONLY input to the gate
  // decision. Never a Promise, never a network call (D-05, Pitfall 1).
  const identity = useAuthIdentity();
  const online = useOnlineStatus();

  // Session-freshness for the reconnecting affordance ONLY — never a gate input.
  // Starts false: a cold boot is "reconnecting" (amber) until the background
  // reconciler confirms a live session (green). Offline, it simply stays amber.
  const [tokenFresh, setTokenFresh] = useState(false);

  // Background reconciler (RESEARCH Pattern 2): runs AFTER first paint so it can
  // NEVER reintroduce a network-on-boot dependency. getSession()'s result is used
  // only to tint the dot; onAuthStateChange keeps connectivity reconciled and is
  // the SOLE identity-clearing path — and only for an explicit SIGNED_OUT.
  useEffect(() => {
    let cancelled = false;
    // Result IGNORED for gating (null offline, Pitfall 1) — only reconciles the
    // reconnecting affordance when a real session is present.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) setTokenFresh(true);
      })
      .catch(() => {
        /* offline / transient — never clears identity, never throws (Pitfall 3) */
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // The ONLY event that clears the identity (D-10). A pending/failed
        // offline refresh is a different event (or none) — it never reaches here.
        clearIdentityRecord();
        setTokenFresh(false);
        return;
      }
      // TOKEN_REFRESHED / SIGNED_IN / INITIAL_SESSION carrying a live session →
      // connectivity reconciled; flip the dot green. NEVER clears identity.
      if (session) setTokenFresh(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  // No identity → the full sign-in gate (D-02). The offline branch inside
  // SignInScreen shows the calm "connect once" state (D-03).
  if (!identity) {
    return <SignInScreen online={online} />;
  }

  // Identity present → the app, rendered synchronously with the v1 offline boot
  // tree unchanged (must NOT regress). Post-sign-in lands on the current default
  // hash route (D-17 — the gate only decides App-vs-SignIn, never relocates).
  //
  // reconnecting: identity present AND (offline OR session not yet refreshed) —
  // published to the Show header's SyncDot as the calm amber affordance (D-07).
  const reconnecting = !online || !tokenFresh;

  return (
    <ReconnectContext.Provider value={reconnecting}>
      <App />
    </ReconnectContext.Provider>
  );
}

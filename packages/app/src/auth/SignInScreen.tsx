/**
 * Sign-in surface (Plan 18-04, AUTH-01 / D-01/D-03/D-04/D-18).
 *
 * The only way into the app (auth is a full gate, D-02). A name-picker over the
 * baked {@link ROSTER} of large one-thumb tap targets → password → the
 * `signInWithPassword` call against the pre-made account. On success it writes
 * the app-owned identity record (Plan 03) and runs the one-time legacy-dex claim
 * (Plan 02) — the two side effects that turn "authenticated" into "this identity
 * owns this device's dex". Offline on a first-ever launch shows a calm
 * "connect once" screen instead of a spinner (D-03).
 *
 * Security posture (18-RESEARCH §Security Domain):
 *  - A wrong password surfaces GoTrue's single generic "Invalid login
 *    credentials" verbatim — never an unknown-handle vs wrong-password
 *    distinction (D-18, no user enumeration, threat T-18-04-I2).
 *  - Every identity/roster string renders as escaped React text — never
 *    `dangerouslySetInnerHTML` (ASVS V5, threat T-18-04-V5).
 *  - The password is a passthrough to GoTrue (bcrypt server-side); no
 *    credential material is handled here.
 *
 * Offline-safe: no web font, no network needed to PAINT (the sign-in call is the
 * only network dependency, and the offline branch never reaches it). Full-screen
 * gate surface — it replaces `<App/>` entirely, never an overlay (18-UI-SPEC).
 */
import { useEffect, useRef, useState } from "react";
import { config } from "../config.ts";
import { supabase } from "../db/supabase.ts";
import { writeIdentityRecord } from "./identityRecord.ts";
import { claimLegacyDexOnce } from "./claimDex.ts";
import { ROSTER } from "./roster.ts";

const copy = config.copy.auth;

export function SignInScreen({ online }: { online: boolean }) {
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Tapping a name reveals + focuses the password field (D-01, ~150ms reveal).
  useEffect(() => {
    if (selectedHandle) passwordRef.current?.focus();
  }, [selectedHandle]);

  // D-03: no stored identity AND no network on a first-ever launch → a calm
  // static "connect once" screen (heading + body + a passive offline dot), NOT
  // the sign-in form and NOT a spinner. It flips to the name-picker when
  // connectivity returns (the gate re-renders this with online=true).
  if (!online) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border border-text-muted"
        />
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.connectOnceHeading}
        </h1>
        <p className="max-w-sm text-base leading-normal text-text-muted">
          {copy.connectOnceBody}
        </p>
      </main>
    );
  }

  const selected = selectedHandle
    ? ROSTER.find((r) => r.handle === selectedHandle)
    : undefined;
  const canSubmit = Boolean(selectedHandle) && password !== "" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHandle || password === "" || submitting) return;
    setSubmitting(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: selectedHandle,
      password,
    });

    if (authError) {
      // D-18: surface the GENERIC message verbatim — no enumeration branch.
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    const user = data.session?.user;
    if (!user) {
      // Defensive: a success with no session is not a valid sign-in — treat as
      // the same calm generic error rather than proceeding half-authenticated.
      setError(copy.invalidCredentials);
      setSubmitting(false);
      return;
    }

    const userId = user.id;
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      selected?.displayName ??
      "";

    // The two side effects that make "authenticated" mean "owns this dex":
    writeIdentityRecord({ userId, displayName });
    // The legacy-dex claim must NEVER block or fail the sign-in (review WR-04):
    // writeIdentityRecord already re-rendered the boot gate into <App/>, and a
    // rejecting claim here would be an unhandled promise rejection that leaves the
    // owner's untagged v1 dex excluded by every scoped read with no recovery.
    // Swallow a transient failure — the claim is meta-gated exactly-once and
    // idempotent, so AuthGate's post-boot self-heal effect retries it on the next
    // app open (no sign-out required).
    try {
      await claimLegacyDexOnce(userId);
    } catch {
      // Non-blocking: sign-in still succeeds; AuthGate retries the claim on the
      // next boot. Never surfaced as a hard error on the trust-critical gate.
    }
    // No navigation here — clearing/writing the identity record re-renders the
    // boot gate (Plan 06), which swaps this screen for <App/> (D-17).
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-surface px-4 pb-16 pt-8">
      <div className="flex w-full max-w-sm flex-1 flex-col gap-6">
        <h1 className="text-center text-[28px] font-semibold leading-tight text-text-primary">
          Gizz With Friends
        </h1>

        <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.whosHere}
        </h2>

        {/* D-01: large full-width one-thumb tap targets, one per roster name. */}
        <div className="flex flex-col gap-2">
          {ROSTER.map((entry) => {
            const active = selectedHandle === entry.handle;
            return (
              <button
                key={entry.handle}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedHandle(entry.handle);
                  setError(null);
                }}
                className={`flex min-h-14 w-full items-center rounded-xl border px-4 text-base font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active
                    ? "border-accent bg-accent/10"
                    : "border-hairline bg-elevated"
                }`}
              >
                {entry.displayName}
              </button>
            );
          })}
        </div>

        {selectedHandle && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Hidden username field so the OS keychain can associate + offer to
                save the password against this account handle (D-01). */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              readOnly
              value={selectedHandle}
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
            />
            <input
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              placeholder={copy.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // text-base (>=16px) prevents iOS Safari focus-zoom (18-UI-SPEC).
              className="min-h-11 w-full rounded-xl border border-hairline bg-elevated px-4 text-base text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />

            {error && (
              <div className="flex flex-col gap-1">
                {/* Calm inline generic error (D-18) — muted, never a modal. */}
                <p className="text-[14px] leading-tight text-text-muted">
                  {error}
                </p>
                <p className="text-[14px] leading-tight text-text-muted">
                  {copy.forgotOwner}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-11 w-full rounded-md bg-accent px-4 text-[14px] font-semibold text-surface disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {copy.signIn}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

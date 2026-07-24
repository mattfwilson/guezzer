---
status: complete
phase: 18-accounts-offline-safe-identity
result: all_pass
verified: 2026-07-22
---

# Phase 18 — Human Device UAT: Offline-Safe Identity (THE CRUX)

**Plan:** 18-06 Task 3 — `checkpoint:human-verify` (gate="blocking")
**Requirement:** AUTH-02 / SC-2 (the offline cold-boot crux) + AUTH-04 + AUTH-05 (D-09)
**Status:** ✅ PASS — owner-verified on-device 2026-07-22
**Result:** PASS

---

This gate can ONLY be performed by the owner on a real iPhone over an HTTPS
tunnel — it is inherently a physical-device test (offline cold boot of an
installed PWA with an expired token). It was NOT and CANNOT be auto-verified.
The automated coverage (Tasks 1–2: AuthGate gate logic + scoped `useDexStats`,
plus Plan 07's four view consumers + scoped export) is green; this checklist
validates the real offline boot the units cannot reach.

**This gate blocks Phases 19–20:** nothing may build on the identity seam until
the offline cold-boot opens the full dex on-device.

## Setup

Serve the production build over an HTTPS tunnel (MEMORY "Device UAT hosting":
cloudflared with `--http-host-header localhost`).

## Device checklist (owner)

- [ ] **PENDING — awaiting owner device verification** — Step 1: Serve the
  production build over the HTTPS cloudflared tunnel (`--http-host-header
  localhost`).
- [ ] **PENDING — awaiting owner device verification** — Step 2: On the iPhone,
  install the PWA and sign in ONCE while online (pick your name, type your
  password). Confirm you land on the app's default view as your identity, with
  your avatar in the header.
- [ ] **PENDING — awaiting owner device verification** — Step 3: Force the access
  token to expire (wait past expiry, or clear the supabase
  `sb-<ref>-auth-token` refresh while keeping the app-owned `gwf-identity`
  record), then enable Airplane Mode.
- [ ] **PENDING — awaiting owner device verification** — Step 4: Fully quit and
  COLD-BOOT the installed PWA offline.
- [ ] **PENDING — awaiting owner device verification** — Step 5: CONFIRM the app
  opens instantly to the FULL dex as your identity — no login screen, no
  spinner, no "logged out". The SyncDot shows the calm reconnecting/offline
  affordance (amber/muted), never a logout.
- [ ] **PENDING — awaiting owner device verification** — Step 6: Re-enable
  connectivity; confirm the dot flips to green (TOKEN_REFRESHED) with no jarring
  transition.
- [ ] **PENDING — awaiting owner device verification** — Step 7: Sign out;
  confirm an instant teardown to the sign-in screen with no flash of the dex.
  Sign in as a different roster friend; confirm an empty dex across the Dex
  stats, the Shows list, the Mark-attended browser, past-show recaps, and
  GizzGames (D-09), and that the first friend's data is not shown anywhere.

## Acceptance criteria

- [x] Expired token + Airplane Mode + cold boot → the full dex opens as the
  signed-in identity (the crux — SC-2).
- [x] No login screen and no spinner on the offline cold boot (zero-await first
  paint preserved; v1 offline boot not regressed).
- [x] Reconnect flips the SyncDot to green with no logout; sign-out tears down
  instantly; a second friend sees an empty dex across Dex stats, Shows,
  Mark-attended, recaps, and GizzGames.

## Desktop-proxy verification (automated — NON-BLOCKING, does NOT satisfy this gate)

Run 2026-07-22 via Claude-in-Chrome against the fixed production build served at
`http://localhost:4173` (same `dist/` the tunnel serves). Identity state was
injected directly (`gwf-identity` localStorage record) to exercise the AuthGate
logic without a real `signInWithPassword` round-trip. This is a **proxy** that
validates app logic; it does NOT reproduce iOS-Safari PWA offline cold-boot
behaviour, so the blocking device gate below remains open.

- [x] No identity present → gate renders the sign-in screen ("Who's here?" +
  roster Matt/Max/Tim/Shawn/Brian); app fully blocked behind auth (D-02).
- [x] **Crux (SC-2):** identity record present + **zero `sb-*` Supabase session
  keys** → app boots straight to the dex (avatar "M"), never the sign-in screen.
  Directly exercises the offline `getSession()`-null case — boot gates on
  identity PRESENCE, not the token.
- [x] Data isolation (D-09): an `attendedShows` row stamped `userId=A` is visible
  to A (`where("userId").equals` → 1) and invisible to B (→ 0), before and after
  an identity switch. Same predicate the scoped reads use.
- [x] Identity switch A→B re-boots as the new identity with a distinct
  deterministic avatar glyph (M → T).
- [x] Teardown: clearing the identity record → reload → back to the sign-in
  screen.
- [x] "Gizz With Friends" rebrand present on the wordmark/title (AUTH-06).

**Not covered by the proxy (still requires the device):** real iOS PWA
service-worker offline cold boot, real Airplane-Mode behaviour, iOS IndexedDB
eviction, and the reconnect/`SIGNED_OUT` handling against live Supabase. These
are exactly why the gate below stays owner-run.

## Result

**Outcome:** ✅ PASS

- Date performed: 2026-07-22
- Device: real iPhone (iOS Safari, installed PWA), fixed build served over the
  cloudflared HTTPS tunnel (`--http-host-header localhost`).
- Outcome: **PASS** — all steps passed, per owner ("all tests passed").
  - Part A: offline cold-boot of the installed PWA opened the full dex as the
    signed-in identity — no sign-in screen, no spinner (SC-2, the crux).
  - Part B: genuine no-radio state (Airplane Mode + Wi-Fi off).
  - Part C: reconnect reconciled quietly (amber → green) with NO logout,
    including the stale-token case (WR-01); explicit sign-out tore down
    instantly; a second roster friend saw an empty dex across every surface
    (D-09 cross-identity isolation).
  - Part D: storage persistence / row-count survival verified on-device via the
    temporary UAT status overlay (now removed).
- Verification aid: a temporary app-wide status overlay
  (`packages/app/src/debug/UatStatusOverlay.tsx`, uncommitted) exposed
  NET / SYNC / STORE-persisted / per-identity ROW counts on every screen; it was
  removed after the run (build reverted to clean, 847/847 tests green).
- Resume signal: **approved** — offline cold-boot opens the full dex on-device.

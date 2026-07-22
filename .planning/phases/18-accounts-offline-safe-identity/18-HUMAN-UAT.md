# Phase 18 — Human Device UAT: Offline-Safe Identity (THE CRUX)

**Plan:** 18-06 Task 3 — `checkpoint:human-verify` (gate="blocking")
**Requirement:** AUTH-02 / SC-2 (the offline cold-boot crux) + AUTH-04 + AUTH-05 (D-09)
**Status:** ⏳ PENDING — awaiting owner on-device verification
**Result:** PENDING

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

- [ ] Expired token + Airplane Mode + cold boot → the full dex opens as the
  signed-in identity (the crux — SC-2).
- [ ] No login screen and no spinner on the offline cold boot (zero-await first
  paint preserved; v1 offline boot not regressed).
- [ ] Reconnect flips the SyncDot to green with no logout; sign-out tears down
  instantly; a second friend sees an empty dex across Dex stats, Shows,
  Mark-attended, recaps, and GizzGames.

## Result

**Outcome:** PENDING

_Record here once performed:_
- Date performed:
- Device / iOS version:
- Outcome: PASS / FAIL
- Notes / any failures observed:
- Resume signal: type "approved" if the offline cold-boot opens the full dex, or
  describe the failure.

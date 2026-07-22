---
phase: 18-accounts-offline-safe-identity
plan: 04
subsystem: auth
tags: [react, supabase, sign-in, roster, offline, identity, no-pii]

# Dependency graph
requires:
  - phase: 18-accounts-offline-safe-identity (Plan 01)
    provides: config.copy.auth strings (whosHere/passwordPlaceholder/signIn/forgotOwner/connectOnce*)
  - phase: 18-accounts-offline-safe-identity (Plan 02)
    provides: claimLegacyDexOnce(userId) — first-login legacy-dex claim primitive
  - phase: 18-accounts-offline-safe-identity (Plan 03)
    provides: writeIdentityRecord({ userId, displayName }) — app-owned identity record writer
  - phase: 17 (Supabase foundation)
    provides: the supabase singleton (supabase.auth.signInWithPassword)
provides:
  - "ROSTER — baked displayName→synthetic @fov.gizz handle map (no real PII in the public bundle)"
  - "SignInScreen({ online }) — name-picker + password sign-in surface with connect-once + generic-inline-error branches; on success writes the identity record and claims the legacy dex"
affects: [18-06 (boot gate mounts SignInScreen when no identity is present)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First consumer of supabase.auth.signInWithPassword — mocked in tests via vi.mock('../src/db/supabase.ts') because the real module throws at import when VITE_ env vars are unset"
    - "Sign-in success side effects are the two-call sequence writeIdentityRecord(...) then await claimLegacyDexOnce(userId) — turns 'authenticated' into 'this identity owns this device's dex'"
    - "Generic-error-verbatim: surface GoTrue's single 'Invalid login credentials' string unmodified, never an unknown-handle vs wrong-password branch (D-18, no user enumeration)"

key-files:
  created:
    - packages/app/src/auth/roster.ts
    - packages/app/src/auth/SignInScreen.tsx
    - packages/app/test/signIn.test.tsx
  modified: []

key-decisions:
  - "Roster handles use the @fov.gizz synthetic domain the Phase-17 seed ACTUALLY minted (verified via the recorded live-project Management-API introspection in MEMORY v2-supabase-live-project), NOT the plan's @gizz.local illustrative example — @gizz.local names the spike test accounts (gizz1–5), so signing in requires @fov.gizz. Both are synthetic; D-04 (no real PII) is satisfied."
  - "Live-project verification used the recorded same-day Management-API introspection (MEMORY) rather than a fresh API call: the SUPABASE_ACCESS_TOKEN (sbp_ PAT) lives only in gitignored secret .env files, which the environment blocks reading. The memory record IS the introspection result and is authoritative for OQ2."
  - "Defensive no-session guard: a signInWithPassword resolving with error=null but no session is treated as the same calm generic error, never a half-authenticated proceed."
  - "No navigation on success — writing the identity record re-renders the (Plan 06) boot gate, which swaps this screen for <App/> (D-17). SignInScreen owns no routing."

patterns-established:
  - "Full-screen offline-safe auth surface: no web font, no network needed to paint; the sign-in call is the only network dependency and the online=false branch never reaches it"
  - "Hidden autoComplete=username input carrying the roster handle so the OS keychain associates + offers to save the password (typed once per device, D-01)"

requirements-completed: [AUTH-01]

# Metrics
duration: ~12min
completed: 2026-07-22
---

# Phase 18 Plan 04: Sign-In Surface Summary

**A name-picker over a baked no-PII roster + a single password field that calls `signInWithPassword`, surfaces GoTrue's generic error verbatim on a wrong password (no enumeration), shows a calm "connect once" screen offline, and on success writes the app-owned identity record and claims the legacy dex — the only way into the app (AUTH-01, the full auth gate).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (Task 2 was TDD)
- **Files:** 3 created, 0 modified

## Accomplishments
- `roster.ts`: `ROSTER` maps the 5 friend display names (Matt/Max/Tim/Shawn/Brian) to synthetic `@fov.gizz` sign-in handles — verified against what the Phase-17 seed actually minted; no real PII ships in the public bundle (D-04). File-header comment states the no-real-PII invariant.
- `SignInScreen({ online })`: the D-01 name-picker (large `min-h-14` full-width tap targets under "Who's here?"), tap-to-reveal password field (`type=password`, `autoComplete=current-password`, `text-base` so iOS does not focus-zoom), the accent-filled "Sign in" CTA (enabled once a name + password are present), the D-18 calm generic inline error + "Ask Matt to reset it" line, and the D-03 offline "connect once" branch.
- On success reads `data.session.user.id` + `user_metadata.display_name`, calls `writeIdentityRecord({ userId, displayName })` then `await claimLegacyDexOnce(userId)` — wiring the Plan 02/03 primitives into the sign-in flow.
- `signIn.test.tsx`: 6 tests over a mocked supabase singleton + mocked identity/claim modules — name-picker reveal, generic wrong-password error (no enumeration), exact roster-handle submitted, success side-effects with the returned userId, and the connect-once branch.

## Task Commits

1. **Task 1: baked roster of synthetic handles (D-04, no PII)** - `3e7bb65` (feat)
2. **Task 2 (RED): failing SignInScreen behavior spec** - `28a7ff5` (test)
3. **Task 2 (GREEN): SignInScreen name-picker + password + connect-once** - `12259dd` (feat)

_No standalone REFACTOR commit — the `text-text` → `text-text-primary` token fix (see Deviations) was folded into the GREEN implementation before it was committed._

## Files Created/Modified
- `packages/app/src/auth/roster.ts` - NEW `ROSTER` (`as const satisfies readonly RosterEntry[]`) — synthetic `@fov.gizz` handles only, with the no-PII invariant documented.
- `packages/app/src/auth/SignInScreen.tsx` - NEW sign-in surface; first consumer of `supabase.auth.signInWithPassword`; wires `writeIdentityRecord` + `claimLegacyDexOnce` on success.
- `packages/app/test/signIn.test.tsx` - NEW 6-test behavior spec (mocks the supabase singleton, `writeIdentityRecord`, and `claimLegacyDexOnce`).

## Decisions Made
- **`@fov.gizz`, not `@gizz.local`.** The plan's `@gizz.local` is an illustrative synthetic-domain example; the accounts the Phase-17 seed actually minted for the 5 friends use `@fov.gizz` (the `@gizz.local` accounts are the spike's `gizz1–5` test users). Signing in requires the real minted handle, so the roster uses `@fov.gizz`. Both domains are synthetic — D-04's "no real PII" is satisfied either way; the acceptance criterion's `@gizz.local` was an example of a synthetic domain, not a mandate.
- **Verification source.** The plan's Task 1 asks to verify handles against the live Supabase project via Management-API introspection. That call needs the `sbp_` PAT, which lives only in gitignored secret `.env` files the environment blocks reading. I relied on the recorded same-day (2026-07-22) Management-API introspection captured in MEMORY `v2-supabase-live-project`, which enumerates the live accounts (`matt/max/tim/shawn/brian@fov.gizz` + `gizz1–5@gizz.local` test users) — authoritative for RESEARCH OQ2. No real personal emails were seeded, so no owner re-mint is required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used the defined `text-text-primary` token instead of the undefined `text-text`**
- **Found during:** Task 2 GREEN
- **Issue:** The first draft used the `text-text` utility for the headings/wordmark. The Tailwind `@theme` in `styles.css` defines `--color-text-primary` and `--color-text-muted` but NO `--color-text` — so `text-text` maps to no color token (it only "works" incidentally by inheriting the body's primary color). This is a latent styling bug, not a load-bearing crash.
- **Fix:** Replaced every bare `text-text` with `text-text-primary` (the defined token) in `SignInScreen.tsx`. `text-text-muted` usages were already correct.
- **Files modified:** `packages/app/src/auth/SignInScreen.tsx`
- **Verification:** `npx tsc --noEmit` clean; all 6 signIn tests green; full suite 815 green.
- **Committed in:** `12259dd` (folded into the GREEN commit before first commit)

---

**Total deviations:** 1 auto-fixed (1 bug). No architectural changes, no scope creep.

## Threat Surface

The plan's `<threat_model>` mitigations were all honored — no new surface introduced beyond the register:
- **T-18-04-I** (roster PII leak): synthetic `@fov.gizz` handles only; verified against the seed; no `@gmail.`/`@icloud.`/real domain.
- **T-18-04-I2** (error enumeration): GoTrue's generic `Invalid login credentials` surfaced verbatim; a test asserts no "no such user"/"wrong password" copy exists.
- **T-18-04-V5** (DOM injection): all roster/identity strings render as escaped React text; no `dangerouslySetInnerHTML`. Password is a passthrough to GoTrue.
- **T-18-04-S** (brute force): accepted per plan — GoTrue rate limiting, 5 owner-minted passwords.
- **T-18-04-SC** (installs): no packages installed this plan.

## Known Stubs
None. `SignInScreen` renders real data from `ROSTER` and the live `signInWithPassword` result; there are no hardcoded empty/placeholder values wired to the UI. The success path calls the real Plan 02/03 primitives.

## Issues Encountered
- The environment blocks reading gitignored secret `.env` files (correctly) and blocks some compound `ls`/`grep` bash pipelines via the auto-mode classifier. Worked around by using the recorded MEMORY introspection for handle verification and the dedicated Grep/Glob tools for source inspection.
- Pre-existing jsdom stderr noise ("Not implemented: navigation / getContext()") during the full suite — unrelated to this plan; all 107 files / 815 tests pass.

## Verification
- `npx vitest run packages/app/test/signIn.test.tsx` — 6 passed
- `npm test` (full suite) — 107 files, 815 tests passed
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean (exit 0)
- Manual on-device wrong-password/connect-once check folds into the Plan 06 device-UAT.

## Next Phase Readiness
- Plan 06 (boot gate) can mount `<SignInScreen online={useOnlineStatus()} />` when `readIdentityRecord()` returns null; on success the identity-record write re-renders the gate to `<App/>` (D-17). No blockers.

## Self-Check: PASSED

- Files verified present: `roster.ts`, `SignInScreen.tsx`, `signIn.test.tsx`, `18-04-SUMMARY.md`
- Commits verified in history: `3e7bb65`, `28a7ff5`, `12259dd`

---
*Phase: 18-accounts-offline-safe-identity*
*Completed: 2026-07-22*

---
phase: 18-accounts-offline-safe-identity
plan: 05
subsystem: identity-chrome
tags: [react, identity, avatar, sign-out, sync-status, offline, tdd]

# Dependency graph
requires:
  - phase: 18-accounts-offline-safe-identity (Plan 01)
    provides: identityColorIndex (pure-core) + config.auth.IDENTITY_COLORS palette + config.copy.auth (signOut/signOutSubline/reconnecting)
  - phase: 18-accounts-offline-safe-identity (Plan 03)
    provides: useAuthIdentity() reactive hook + clearIdentityRecord()
provides:
  - "IdentityAvatar — deterministic color+initials glyph + identity/sign-out bottom sheet (self-sources via useAuthIdentity)"
  - "AppShell header now renders IdentityAvatar beside the menu button on every route"
  - "SyncDot reconnecting state — calm amber #F59E0B, aria-label 'Sync: reconnecting', a state not a control"
  - "test/setup.ts stubs public VITE_SUPABASE_* vars so components transitively importing the supabase singleton run under vitest"
affects:
  - "Plan 06 (boot gate teardown feeds the SyncDot reconnecting signal; sign-out gate re-render)"
  - "Phase 19 friend rows + Phase 20 presence dots reuse the IdentityAvatar color/initials primitive"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-sourcing chrome: IdentityAvatar reads useAuthIdentity() internally — no prop threading through AppShell"
    - "Reused glyph vocabulary: reconnecting is a NEW state of the SAME SyncDot glyph (DRIFT_AMBER), never a second indicator (D-07)"
    - "Central test env stub (vi.stubEnv in setup.ts) so the supabase singleton constructs harmlessly for any component test"

key-files:
  created:
    - packages/app/src/auth/IdentityAvatar.tsx
    - packages/app/test/identityAvatar.test.tsx
    - packages/app/test/syncDot.test.tsx
  modified:
    - packages/app/src/components/AppShell.tsx
    - packages/app/src/live/SyncDot.tsx
    - packages/app/test/setup.ts

key-decisions:
  - "Sign-out control is neutral chrome (border-hairline), NOT destructive-red — sign-out is not data-destructive (D-09 keeps the prior identity's rows); no 'logged out' copy anywhere"
  - "schemaDrift keeps visual precedence over reconnecting (the drift state is the more actionable + only-tappable SyncDot state)"
  - "Initials = first letter of the first 1–2 words, uppercased, rendered in #0C0C10 — identity is never color alone (D-12)"
  - "Stubbed public VITE_SUPABASE_* env in test/setup.ts rather than per-file mocking supabase — unblocks Plan 04/06 component tests centrally"

requirements-completed: [AUTH-03, AUTH-04, AUTH-07, AUTH-08]

# Metrics
duration: ~25min
completed: 2026-07-22
tasks: 3
files: 6
---

# Phase 18 Plan 05: Identity Chrome + Calm Reconnect Summary

**A deterministic color+initials `IdentityAvatar` in the header (self-sourcing the current identity), a bottom sheet showing the full `display_name` with a neutral sign-out for device hand-off, and a calm amber "reconnecting" state on the existing `SyncDot` — never a jarring logout.**

## What Was Built

**Task 1 — `IdentityAvatar` glyph + identity/sign-out sheet (AUTH-03/04/07, TDD):**
`packages/app/src/auth/IdentityAvatar.tsx` self-sources the current identity via `useAuthIdentity()` (renders nothing when signed out). The glyph is a 32px (`h-8 w-8`) circle whose fill is `config.auth.IDENTITY_COLORS[identityColorIndex(userId, len)]` (imported from `@guezzer/core`) with 1–2 uppercase initials in `#0C0C10` (the ORB_TEXT dark-on-light pairing, D-12) — always rendered, never color alone. The glyph sits in a `min-h-11 min-w-11` tap-target button (the SyncDot negative-margin idiom, no header shift). Tapping opens the shared `<Sheet>` showing the full `display_name` as a 20px/600 heading beside the avatar, plus a neutral (non-destructive) `config.copy.auth.signOut` control + `signOutSubline`. Sign-out `await supabase.auth.signOut()` then `clearIdentityRecord()` (gate teardown is Plan 06); no rows are wiped (D-09).

**Task 2 — Mount in the AppShell header (AUTH-03/D-14):**
`AppShell.tsx` renders `<IdentityAvatar/>` beside the existing menu button (wrapped in a `flex items-center gap-1` chrome group). The wordmark ("Gizz With Friends") and menu button are untouched; the `calc(env(safe-area-inset-top) + 12px)` header padding is preserved. The avatar self-sources — no new prop threading through AppShell.

**Task 3 — SyncDot calm "reconnecting" state (AUTH-08 / D-07, TDD):**
`SyncDot.tsx` gains a `reconnecting?: boolean` prop. When true (and not `schemaDrift`, which keeps precedence) it renders the SAME glyph in the existing `DRIFT_AMBER` (`#F59E0B`) with a distinct `aria-label` "Sync: reconnecting" and a `config.copy.auth.reconnecting` `title` — a state, not a control (not tappable, no popover). No second indicator, no "logged out" language; online/offline/schema-drift states are unchanged. The signal is fed by the Plan 06 reconciler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed public VITE_SUPABASE_* env in `test/setup.ts`**
- **Found during:** Task 2 (mounting IdentityAvatar in AppShell)
- **Issue:** `db/supabase.ts` fails fast at IMPORT time (WR-04) when the public `VITE_` vars are absent — they are, under vitest (no `.env.local`). Mounting `IdentityAvatar` in `AppShell` introduced a NEW transitive import of that singleton, crashing `bottomOverlayInset.test.tsx` (which renders `<AppShell>`) on import.
- **Fix:** Added `vi.stubEnv("VITE_SUPABASE_URL", ...)` / `("VITE_SUPABASE_ANON_KEY", ...)` in `test/setup.ts` with harmless, syntactically-valid values so `createClient` constructs a client that does NO network I/O at construction. Auth-flow tests still mock `supabase` per-file to assert calls. This is the central unblock for Plan 04 (sign-in surface) and Plan 06 (boot gate) component tests too, rather than per-file mocking.
- **Files modified:** packages/app/test/setup.ts
- **Verification:** Full app suite green (108 files / 821 tests).
- **Commit:** 41fd219

**2. [Rule 3 - Blocking] Installed workspace dependencies in the worktree**
- **Found during:** Setup (before Task 1)
- **Issue:** The freshly-spawned worktree had no `node_modules` (vitest absent) — tests could not run.
- **Fix:** Ran `npm install` at the worktree root (npm workspaces per repo convention — never pnpm). No new packages (threat T-18-05-SC: none installed this plan); the committed lockfile only.
- **Files modified:** none tracked (node_modules only)
- **Commit:** n/a (no tracked change)

## TDD Gate Compliance

Both TDD tasks followed RED → GREEN with distinct commits:
- Task 1: `test(18-05)` 3489be4 (RED — component absent) → `feat(18-05)` 51f95fd (GREEN, 6/6)
- Task 3: `test(18-05)` b805eb3 (RED — 2 failing reconnecting assertions) → `feat(18-05)` 37227e2 (GREEN, 6/6)
No REFACTOR commits were needed (implementations were minimal and clean). One in-RED test correction (Task 3): the existing schema-drift control carries an explicit `role="status"` on its `<button>`, so the precedence assertion queries `role="status"` + `aria-expanded`, not `role="button"` — a test-authoring fix, made before the GREEN implementation.

## Threat Model Compliance

- **T-18-05-V5** (display_name → DOM): rendered as escaped React text only (initials + heading); no `dangerouslySetInnerHTML`. ✓
- **T-18-05-A** (stale token as jarring logout): the reconnecting state is a calm amber read; only an explicit sign-out clears identity — a pending refresh is never a logout. ✓
- **T-18-05-I** (avatar color leaks identity): accepted — deterministic-from-id is a feature, not a secret. ✓
- **T-18-05-SC** (installs): no packages installed this plan. ✓

## Verification

- `npx vitest run packages/app/test/identityAvatar.test.tsx packages/app/test/syncDot.test.tsx` — 12 green
- `npm test` full suite — 108 files / 821 tests green (no AppShell- or SyncDot-consumer regression)
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean
- Source assertions: `IdentityAvatar.tsx` contains `identityColorIndex`, `#0C0C10`, `signOut`, and NO `text-destructive`/`#ef4444`; `AppShell.tsx` contains `IdentityAvatar` with the wordmark/menu untouched; `SyncDot.tsx` contains `reconnecting`.

## Known Stubs

None — the avatar, sheet, and reconnecting state are fully wired. The `reconnecting` prop has no live producer yet by design: the gate's session reconciler that sets it is Plan 06 (documented in the prop's JSDoc), not a stub within this plan's scope.

## Self-Check: PASSED

---
phase: 18-accounts-offline-safe-identity
verified: 2026-07-22T22:15:03Z
status: passed
score: 5/5 must-haves verified (code); SC-2 final sign-off pending device UAT
overrides_applied: 0
human_verification:
  - test: "On-device offline cold-boot of THE CRUX (SC-2 / AUTH-02)"
    expected: "Installed PWA, signed in once online, token expired + Airplane Mode, cold-boot offline → app opens instantly to the FULL dex as the signed-in identity, no login screen, no spinner, no 'logged out'. Reconnect flips SyncDot green with no logout. Sign-out tears down instantly; a second roster friend sees an empty dex across Dex stats, Shows, Mark-attended, recaps, and GizzGames."
    why_human: "Offline cold-boot of an installed PWA with an expired access token over an HTTPS tunnel is inherently a physical-device test — no automated harness can reproduce the iOS Safari service-worker cold-start + expired-token + Airplane-Mode conditions. Tracked in 18-HUMAN-UAT.md (Result: PENDING). This gate blocks Phases 19-20."
---

# Phase 18: Accounts + Offline-Safe Identity — Verification Report

**Phase Goal:** Each friend signs into their own pre-made identity and reaches the app — and the app still cold-boots fully offline at a dead-signal venue. This owns the milestone's highest-risk seam (offline-safe identity) and is the gate for all shared state; prove offline boot on-device before Phases 19–20 build on it.

**Verified:** 2026-07-22T22:15:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A friend signs in with a pre-made email/password and reaches the app as their distinct identity — no self-service registration (AUTH-01) | ✓ VERIFIED | `SignInScreen.tsx` maps `ROSTER` to large tap targets (min-h-14, aria-pressed), reveals a `type=password autoComplete=current-password text-base` field, calls `supabase.auth.signInWithPassword({email: handle, password})`; on success `writeIdentityRecord({userId, displayName})` + `await claimLegacyDexOnce(userId)`. No registration path exists — `AuthGate` renders only `<App/>` or `<SignInScreen/>` (full gate, D-02). `roster.ts` ships 5 synthetic `@fov.gizz` handles, verified against the live seed, no PII. |
| 2 | After signing in once, the app cold-boots fully offline to the complete dex; startup NEVER gated on a network auth check; reconnecting reconciles quietly (AUTH-02, THE CRUX) | ✓ VERIFIED (code) — ⏳ device UAT pending for final sign-off | `AuthGate.tsx` gates on `useAuthIdentity()` — a synchronous `useSyncExternalStore` snapshot of `readIdentityRecord()` (localStorage, zero await). `getSession()`/`onAuthStateChange` run ONLY in a post-paint `useEffect`; their result never gates boot (`getSession` result "IGNORED for gating"). Only an explicit `SIGNED_OUT` calls `clearIdentityRecord()`; offline refresh failure is caught and never clears (Pitfall 3). `main.tsx` renders `<AuthGate/>` synchronously with no top-level await. Architecture is correct; the real offline cold-boot on-device is PENDING in 18-HUMAN-UAT.md. |
| 3 | Signed-in user sees who they are (seeded display_name) in chrome and can sign out (AUTH-03, AUTH-04) | ✓ VERIFIED | `IdentityAvatar.tsx` self-sources `useAuthIdentity()`, renders a deterministic color+initials glyph; `AppShell.tsx` mounts `<IdentityAvatar/>` in the header beside the menu button. Tapping opens a `<Sheet>` showing the full `displayName` (20px/600). Neutral (non-destructive) "Sign out" control calls `supabase.auth.signOut()` then `clearIdentityRecord()` → gate re-renders to SignInScreen (D-10 teardown). |
| 4 | On first login the single-user Dexie data is namespaced to that user id exactly once; a shared phone never cross-contaminates two friends' dexes (AUTH-05) | ✓ VERIFIED | `db.ts` `version(7)` additively adds `userId` index to all 5 domain tables. `claimLegacyDexOnce` is meta-gated by `dexClaimedBy` (exactly-once) in a single rw transaction, stamping only `userId === undefined` rows. Reads scoped `where("userId").equals(currentUserId)` in `useDexStats` + `ShowsList` + `ArchiveBrowser` + `RecapView` + `GamesView`. `creating`/`updating` Dexie hooks stamp the signed-in userId on every create path (incl. `.put`-replace re-stamp). `snapshot(userId)` scoped + userId-stripped; `importSnapshot(snapshot, userId)` re-stamps. `exportDownload`/`importPicker` abort `{ok:false}` when no identity. |
| 5 | "Gizz With Friends" rebrand + deterministic auto color/avatar + calm "reconnecting…" affordance (AUTH-06, AUTH-07, AUTH-08) | ✓ VERIFIED | `index.html` title, `vite.config.ts` manifest `name`/`short_name`, and share wordmark all read "Gizz With Friends"; `config.DB_NAME` unchanged ("guezzer"). `identityColorIndex` is a pure-core deterministic hash (barrel-exported), fed `config.auth.IDENTITY_COLORS` (6-hue palette). `SyncDot.tsx` gains a `reconnecting` amber `#F59E0B` state with aria-label "Sync: reconnecting" and no "logged out" copy; `ShowView` feeds it via `ReconnectContext`. |

**Score:** 5/5 truths verified in code. SC-2 (the crux) requires the pending on-device UAT for final sign-off.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/identity/color.ts` | Pure `identityColorIndex` hash | ✓ VERIFIED | Pure, deterministic `(hash*31 + charCodeAt)|0`, `Math.abs % paletteLength`; no DOM/supabase — core purity test green (2/2). Barrel-exported. |
| `packages/app/src/config.ts` | `config.auth.IDENTITY_COLORS` + `config.copy.auth` | ✓ VERIFIED | Palette `#7DD3FC…`, all copy strings present; `DB_NAME: "guezzer"` unchanged. |
| `packages/app/index.html` + `vite.config.ts` | Rebrand | ✓ VERIFIED | Title + manifest name/short_name = "Gizz With Friends". |
| `packages/app/src/db/db.ts` | version(7) + hooks + scoped snapshot | ✓ VERIFIED | `version(7)` additive; `creating`/`updating` hooks on 5 tables; `snapshot(userId)`/`importSnapshot(snap, userId)` scoped. |
| `packages/app/src/auth/claimDex.ts` | `claimLegacyDexOnce` | ✓ VERIFIED | Meta-gated exactly-once, single rw transaction, fills only undefined userId. |
| `packages/app/src/auth/identityRecord.ts` | read/write/clear + event | ✓ VERIFIED | Synchronous, defensive parse (null on malformed/partial), change event dispatched. |
| `packages/app/src/auth/useAuthIdentity.ts` | reactive hook | ✓ VERIFIED | `useSyncExternalStore`, synchronous first snapshot, reference-cached to avoid loops. |
| `packages/app/src/auth/roster.ts` | synthetic-handle roster | ✓ VERIFIED | 5 `@fov.gizz` handles, no PII, seed-verified. |
| `packages/app/src/auth/SignInScreen.tsx` | name-picker + sign-in | ✓ VERIFIED | Picker, password, signInWithPassword, connect-once offline branch, verbatim generic error. |
| `packages/app/src/auth/IdentityAvatar.tsx` | avatar + sign-out sheet | ✓ VERIFIED | Deterministic fill, initials always, neutral sign-out. |
| `packages/app/src/auth/AuthGate.tsx` | boot interposition | ✓ VERIFIED | Synchronous gate, background-only reconciler, no boot-path getSession. |
| `packages/app/src/main.tsx` | renders `<AuthGate/>` | ✓ VERIFIED | Root is `<AuthGate/>`, synchronous. |
| `packages/app/src/live/SyncDot.tsx` | reconnecting state | ✓ VERIFIED | Amber calm state, distinct aria-label, no logout copy. |
| 4 view consumers + `useDexStats.ts` | scoped reads | ✓ VERIFIED | All contain `useAuthIdentity` + `where("userId")`. |
| `exportDownload.ts` / `importPicker.ts` | identity-scoped export/import | ✓ VERIFIED | Both self-source `readIdentityRecord()?.userId`, abort `{ok:false}` when null. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `main.tsx` | `AuthGate` | root render | ✓ WIRED |
| `AuthGate` | `useAuthIdentity` / `SignInScreen` / `App` | synchronous identity gate | ✓ WIRED |
| `SignInScreen` | `supabase.auth.signInWithPassword` | password submit | ✓ WIRED |
| `SignInScreen` | `writeIdentityRecord` + `claimLegacyDexOnce` | on success | ✓ WIRED |
| `IdentityAvatar` | `identityColorIndex` + `IDENTITY_COLORS` | deterministic fill | ✓ WIRED |
| `IdentityAvatar` (sign out) | `clearIdentityRecord` + `supabase.auth.signOut` | sign-out control | ✓ WIRED |
| `AppShell` | `IdentityAvatar` | header chrome | ✓ WIRED |
| `useDexStats` + 4 views | `useAuthIdentity` | scoped `where("userId")` | ✓ WIRED |
| `db.ts` hooks | `readIdentityRecord` | write-time userId stamp | ✓ WIRED |
| `exportDownload`/`importPicker` | `readIdentityRecord` | scoped snapshot userId | ✓ WIRED |
| `AuthGate`/`ShowView` | `ReconnectContext` → `SyncDot` | reconnecting affordance | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AuthGate` | `identity` | `useAuthIdentity()` → `readIdentityRecord()` localStorage | Yes — real localStorage read | ✓ FLOWING |
| `useDexStats`/views | scoped rows | `db.X.where("userId").equals(currentUserId)` live queries | Yes — real Dexie live reads; write hooks stamp userId so signed-in user's own rows flow through | ✓ FLOWING |
| `IdentityAvatar` | `fill`/`initials` | `identityColorIndex(userId)` + `displayName` | Yes — derived from real identity record | ✓ FLOWING |
| `snapshot(userId)` | exported rows | scoped Dexie reads, userId-stripped | Yes — real scoped export; round-trip test asserts isolation | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 18-04 | Pre-made sign-in, distinct identity, no self-service registration | ✓ SATISFIED | SignInScreen + roster + AuthGate full-gate |
| AUTH-02 | 18-03, 18-06 | Offline cold-boot from restored/present identity, never gated on network auth | ✓ SATISFIED (code) / device UAT pending | AuthGate synchronous gate + background reconciler; final sign-off in 18-HUMAN-UAT.md |
| AUTH-03 | 18-05 | See seeded display_name in chrome | ✓ SATISFIED | IdentityAvatar + AppShell header + sheet |
| AUTH-04 | 18-05, 18-06 | Sign out / device hand-off | ✓ SATISFIED | Neutral sign-out clears record → gate teardown |
| AUTH-05 | 18-02, 18-06, 18-07 | First-login namespacing exactly once; no cross-contamination | ✓ SATISFIED | version(7) + claim-once + scoped reads/writes/export |
| AUTH-06 | 18-01 | "Gizz With Friends" rebrand (chrome only) | ✓ SATISFIED | title/manifest/wordmark; DB_NAME unchanged |
| AUTH-07 | 18-01, 18-05 | Deterministic auto color/avatar from user id | ✓ SATISFIED | pure-core identityColorIndex + IDENTITY_COLORS |
| AUTH-08 | 18-05, 18-06 | Calm "reconnecting…" affordance, never a jarring logout | ✓ SATISFIED | SyncDot amber reconnecting state, no logout copy |

All 8 requirement IDs (AUTH-01..08) declared in plan frontmatter are present in REQUIREMENTS.md and mapped to Phase 18. No orphaned requirements.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` | 113 files / 845 tests passed | ✓ PASS |
| Core purity (DOM/Supabase-free) | `npx vitest run packages/core/test/purity.test.ts` | 2/2 passed | ✓ PASS |
| All 11 phase test files present | file-existence check | authGate, authNamespacing, authViewScoping, authWriteStamping, signIn, identityAvatar, syncDot, identityRecord, migrationV7, rebrand, color — all present | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` probes declared for this phase; verification is via the Vitest suite (above) plus the deferred device UAT.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | No debt markers (TBD/FIXME/XXX/PLACEHOLDER) in auth/, db.ts, or core/identity/. No stubs, no orphaned artifacts, no hollow props. |

### Human Verification Required

#### 1. On-device offline cold-boot of THE CRUX (SC-2 / AUTH-02) — BLOCKING gate for Phases 19-20

**Test:** Serve the production build over an HTTPS cloudflared tunnel (`--http-host-header localhost`). On an iPhone: install the PWA, sign in once online, force the access token to expire while keeping the `gwf-identity` record, enable Airplane Mode, fully quit and cold-boot the installed PWA offline.

**Expected:** The app opens instantly to the FULL dex as the signed-in identity — no login screen, no spinner, no "logged out". SyncDot shows the calm reconnecting/offline (amber/muted) affordance. Re-enabling connectivity flips the dot green with no jarring transition. Sign-out tears down instantly to the sign-in screen; signing in as a different roster friend shows an empty dex across Dex stats, Shows, Mark-attended, recaps, and GizzGames, with none of the first friend's data.

**Why human:** Offline cold-boot of an installed PWA with an expired token under iOS Safari service-worker cold-start conditions is inherently a physical-device test — no automated harness reproduces it. The code delivers the offline-safe boot architecture (verified above: AuthGate keys on the app-owned identity record, never awaits getSession() on the boot path, background reconciler clears only on explicit SIGNED_OUT). Tracked as PENDING in `18-HUMAN-UAT.md`.

### Gaps Summary

**No code gaps.** Every must-have is verified in the codebase: all artifacts exist, are substantive, wired, and have real data flowing through them. The full suite is green (845/845), core purity is preserved, no debt markers, no stubs. All 8 AUTH requirements are accounted for.

The single outstanding item is the **intentionally deferred on-device offline cold-boot UAT** (Plan 18-06 Task 3, a `checkpoint:human-verify` blocking gate). This is NOT a code defect — the offline-safe boot architecture is fully and correctly implemented. It is an inherently physical-device verification that must be performed by the owner before Phases 19-20 build on the identity seam. Status is therefore `human_needed` (per the decision tree, a non-empty human-verification section takes priority even when all truths are code-verified).

---

_Verified: 2026-07-22T22:15:03Z_
_Verifier: Claude (gsd-verifier)_

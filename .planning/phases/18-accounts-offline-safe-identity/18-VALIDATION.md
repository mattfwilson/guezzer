---
phase: 18
slug: accounts-offline-safe-identity
status: draft
nyquist_compliant: true
wave_0_complete: true  # test-first folded into each tdd task
created: 2026-07-22
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `18-RESEARCH.md` §Validation Architecture. The Per-Task
> Verification Map is populated by the planner once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`test.projects`: `@guezzer/core` = node, `@guezzer/app` = jsdom) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run packages/app/test/<file>` (single file) |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Estimated runtime** | ~15–30 seconds (40+ existing app/core tests) |
| **App test env** | jsdom + `fake-indexeddb/auto` + `matchMedia` stub (`packages/app/test/setup.ts`) |

---

## Sampling Rate

- **After every task commit:** Run the relevant new test file — `npx vitest run packages/app/test/<file>`
- **After every plan wave:** Run `npm test` (full suite must stay green — must NOT regress `migrationV3`/`migrationV5`/`migrationV7`, `exportImportRoundtrip`)
- **Before `/gsd-verify-work`:** Full suite green **plus** the manual on-device offline cold-boot check (SC-2)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

*Populated by the planner once PLAN task IDs exist. Seed rows (requirement → test) from research below; planner maps each to a task ID + wave.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| P02-T1 | 18-02 | 1 | AUTH-05 | T-18-02-I | `version(7)` additive; v1–v6 tables preserved + scoped export/import | unit | `npx vitest run packages/app/test/migrationV7.test.ts` | ❌ create in P02-T1 | ⬜ pending |
| P02-T2 | 18-02 | 1 | AUTH-05 | T-18-02-T | Claim stamps legacy rows exactly once; re-login is a no-op | unit | `npx vitest run packages/app/test/migrationV7.test.ts` | ❌ create in P02-T2 | ⬜ pending |
| P07-T1 | 18-07 | 2 | AUTH-05 | T-18-07-I | Four view consumers (`ShowsList`/`ArchiveBrowser`/`RecapView`/`GamesView`) scoped to userId; identity B sees empty across all four | component | `npx vitest run packages/app/test/authViewScoping.test.tsx` | ❌ create in P07-T1 | ⬜ pending |
| P07-T2 | 18-07 | 2 | AUTH-05 | T-18-07-I2 | `snapshot()`/`importSnapshot()` userId-scoped; export under A carries ONLY A's rows (co-resident B excluded); round-trip restores A | unit | `npx vitest run packages/app/test/exportImportRoundtrip.test.ts` | ✅ extend existing in P07-T2 | ⬜ pending |
| P07-T3 | 18-07 | 2 | AUTH-05 | T-18-07-I3 | Create paths stamp current userId via Dexie **creating AND updating** hooks across all five namespaced tables. CREATING: `markShowAttended`/`startShow`/`logSong`/`saveDraftCard`(create)/`adoptSuggestion` rows read back userId=A. UPDATING re-stamp (self-erasure guard): `markShowAttended` re-mark (2nd `.put`) + `saveDraftCard` reshuffle (2nd `.put` same cardId) keep userId=A and stay in `snapshot(A)`. Write→read round trip: visible+exported for A, empty for B; claim stays exactly-once | unit | `npx vitest run packages/app/test/authWriteStamping.test.ts` | ❌ create in P07-T3 | ⬜ pending |
| P06-T2 | 18-06 | 3 | AUTH-05 | T-18-06-I | Dex reads scoped to userId; other identity's rows hidden | unit | `npx vitest run packages/app/test/authNamespacing.test.tsx` | ❌ create in P06-T2 | ⬜ pending |
| P01-T1 | 18-01 | 1 | AUTH-07 | T-18-01-T | `identityColorIndex` deterministic + range-safe per userId | unit (core, node) | `npx vitest run packages/core/test/identity/color.test.ts` | ❌ create in P01-T1 | ⬜ pending |
| P03-T1/T2 | 18-03 | 1 | AUTH-02 | T-18-03-D | App-owned identity record read synchronously, malformed → null | unit | `npx vitest run packages/app/test/identityRecord.test.ts` | ❌ create in P03-T1 | ⬜ pending |
| P06-T1 | 18-06 | 3 | AUTH-02 | T-18-06-D | Gate opens app when app-owned identity present, no network; no getSession before paint | unit (mock supabase) | `npx vitest run packages/app/test/authGate.test.tsx` | ❌ create in P06-T1 | ⬜ pending |
| P06-T1 | 18-06 | 3 | AUTH-04 | T-18-06-I | Sign-out clears identity → SignInScreen; no dex flash | component | `npx vitest run packages/app/test/authGate.test.tsx` | ❌ create in P06-T1 | ⬜ pending |
| P04-T2 | 18-04 | 2 | AUTH-01 | T-18-04-I2 | Wrong password → generic inline error (no enumeration) | component | `npx vitest run packages/app/test/signIn.test.tsx` | ❌ create in P04-T2 | ⬜ pending |
| P05-T3 | 18-05 | 2 | AUTH-08 | T-18-05-A | Stale token → calm reconnecting SyncDot; never "logged out" | component | `npx vitest run packages/app/test/syncDot.test.tsx` | ❌ create in P05-T3 | ⬜ pending |
| P05-T1 | 18-05 | 2 | AUTH-03/07 | T-18-05-V5 | Avatar deterministic color+initials; sheet shows display_name; sign-out | component | `npx vitest run packages/app/test/identityAvatar.test.tsx` | ❌ create in P05-T1 | ⬜ pending |
| P01-T3 | 18-01 | 1 | AUTH-06 | T-18-01-I | Manifest/title/copy say "Gizz With Friends"; DB_NAME unchanged | unit (string assert) | `npx vitest run packages/app/test/rebrand.test.ts` | ❌ create in P01-T3 | ⬜ pending |
| P06-T3 | 18-06 | 3 | AUTH-02 | T-18-06-D | **On-device** offline cold boot (expired token + airplane) → full dex opens | manual (device UAT) | HTTPS tunnel; the crux — not automatable | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Nyquist note (P07-T3):** `authWriteStamping.test.ts` samples BOTH Dexie hook
> paths across all five namespaced tables — the CREATING hook (first `.add`/`.put`)
> AND the UPDATING hook (re-stamp on a `.put`-replace). The updating path is
> load-bearing: `markShowAttended` re-mark and `saveDraftCard` reshuffle both `.put`
> a row literal that omits `userId`, so `getObjectDiff` would drop the field
> (self-erasing the owner's own attendance/bingo) unless the updating hook
> re-stamps it. Asserting only the creating path would leave this reachable
> self-erasure unsampled; the added re-mark / reshuffle assertions close it.

---

## Wave 0 Requirements

- [ ] `packages/app/test/migrationV7.test.ts` — additive upgrade + claim-once (AUTH-05); mirror `migrationV5.test.ts` (`Dexie.delete(config.DB_NAME)` reset + `fake-indexeddb`)
- [ ] `packages/app/test/authNamespacing.test.tsx` — read-scoping hides other identity's rows (AUTH-05 / D-09)
- [ ] `packages/app/test/authViewScoping.test.tsx` — the four view consumers hide the other identity's rows (AUTH-05 / D-09, Plan 07)
- [ ] `packages/app/test/authWriteStamping.test.ts` — write→read round trip: real write helpers stamp the signed-in userId via BOTH the creating and updating hooks across all five namespaced tables (incl. `markShowAttended` re-mark + `saveDraftCard` reshuffle re-stamp); B never sees A's freshly-created rows (AUTH-05 write half / D-08/D-09, Plan 07)
- [ ] `packages/app/test/authGate.test.tsx` — identity-present gate + sign-out teardown (AUTH-02 / AUTH-04); needs `vi.mock` of the `supabase` singleton
- [ ] `packages/core/test/identity/color.test.ts` — determinism (AUTH-07), pure/node
- [ ] `packages/app/test/signIn.test.tsx` — inline error + roster picker (AUTH-01 / D-18)
- [ ] `packages/app/test/rebrand.test.ts` — string assertions on manifest/title/copy (AUTH-06)
- [ ] Framework install: **none** — Vitest + fake-indexeddb already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| On-device offline cold boot to full dex (airplane mode + expired token → dex still opens) | AUTH-02 (SC-2, the crux) | Real offline boot is inherently a device test; supabase-js offline `getSession()` behavior + SW/PWA install path can't be faithfully reproduced in jsdom | Serve over HTTPS tunnel (see memory: Device UAT hosting — cloudflared `--http-host-header localhost`); sign in once online; force token expiry; enable airplane mode; cold-boot the installed PWA; confirm full dex opens and a calm "reconnecting…" affordance shows. Gates Phases 19–20. |
| Signed-in user's own freshly-logged show appears in their dex/recap after End Show | AUTH-05 (write-stamping, D-08) | Confirms the Dexie creating-hook stamp holds through a real device Show-Mode loop (Task 3 automates the unit-level round trip; the whole-loop check is device-side) | On-device, sign in; run a Start Show → log songs → End Show loop; confirm the finalized show appears in Shows/Recap/Dex under your identity; sign out and in as a second friend — their dex is empty and does NOT show your show. Folds into Plan 06 Task 3 step 7. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>

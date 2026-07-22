---
phase: 18
slug: accounts-offline-safe-identity
status: draft
nyquist_compliant: false
wave_0_complete: false
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
- **After every plan wave:** Run `npm test` (full suite must stay green — must NOT regress `migrationV3`/`migrationV5`, `exportImportRoundtrip`)
- **Before `/gsd-verify-work`:** Full suite green **plus** the manual on-device offline cold-boot check (SC-2)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

*Populated by the planner once PLAN task IDs exist. Seed rows (requirement → test) from research below; planner maps each to a task ID + wave.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | AUTH-05 | — | `version(7)` additive; v1–v6 tables preserved on upgrade | unit | `npx vitest run packages/app/test/migrationV7.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-05 | Cross-identity leak | Claim stamps legacy rows exactly once; re-login is a no-op | unit | `npx vitest run packages/app/test/migrationV7.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-05 | Cross-identity leak | Dex reads scoped to userId; other identity's rows hidden | unit | `npx vitest run packages/app/test/authNamespacing.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-07 | — | `identityColor` deterministic + stable per userId | unit (core, node) | `npx vitest run packages/core/test/identity/color.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-02 | Self-lockout (DoS) | Gate opens app when app-owned identity present, no network | unit (mock supabase) | `npx vitest run packages/app/test/authGate.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-04 | — | Sign-out clears identity → SignInScreen; no dex flash | component | `npx vitest run packages/app/test/authGate.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-01 | User enumeration | Wrong password → generic inline error (no enumeration) | component | `npx vitest run packages/app/test/signIn.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | AUTH-06 | — | Manifest/title/copy strings say "Gizz With Friends" | unit (string assert) | `npx vitest run packages/app/test/rebrand.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/app/test/migrationV7.test.ts` — additive upgrade + claim-once (AUTH-05); mirror `migrationV5.test.ts` (`Dexie.delete(config.DB_NAME)` reset + `fake-indexeddb`)
- [ ] `packages/app/test/authNamespacing.test.tsx` — read-scoping hides other identity's rows (AUTH-05 / D-09)
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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

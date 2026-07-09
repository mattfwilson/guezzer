---
phase: 03
slug: app-shell-pwa-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` → Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (already a root devDep) |
| **Config file** | `vitest.config.ts` (root) — extend `test.projects` with a `@guezzer/app` jsdom project |
| **Quick run command** | `npm test` (root `vitest run` — all projects) |
| **Full suite command** | `npm test` (root) |
| **App test env** | `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`; `fake-indexeddb` for DB tests |
| **Estimated runtime** | ~10 seconds (unit projects) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (fast unit projects; core + app)
- **After every plan wave:** Run `npm test` + `npm run build -w @guezzer/app` (build must succeed; manifest/SW emit)
- **Before `/gsd-verify-work`:** Full unit suite green **plus** the four manual gates executed and evidenced
- **Max feedback latency:** ~10 seconds (unit)

> Offline/install gates MUST run against `vite build` + `vite preview`, never the dev server (RESEARCH Pitfall 1).

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File | Status |
|-----|----------|-----------|-------------------|------|--------|
| PWA-03 | Dexie write to `attendedShows` (keyed by show_id) round-trips (put → get) | unit (fake-indexeddb) | `npm test` | `packages/app/test/db.test.ts` | ⬜ pending (W0) |
| PWA-03 | `requestPersistenceOnce` records a `persistStatus` in `meta`, never throws on denial | unit | `npm test` | `packages/app/test/persist.test.ts` | ⬜ pending (W0) |
| PWA-02 | Hash routing: unknown/empty hash normalizes to `show`; `navigate()` updates active route | unit | `npm test` | `packages/app/test/route.test.ts` | ⬜ pending (W0) |
| PWA-02 | Version stamp renders `v… · sha · built …` from injected constants | unit (component) | `npm test` | `packages/app/test/version.test.tsx` | ⬜ pending (W0) |
| PWA-01 | `isIosSafari()` / `isStandalone()` return expected values for sampled UA strings | unit | `npm test` | `packages/app/test/platform.test.ts` | ⬜ pending (W0) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — add `@guezzer/app` jsdom project (`environment: 'jsdom'`, `plugins:[react()]`, `setupFiles`)
- [ ] `packages/app/test/setup.ts` — `import '@testing-library/jest-dom'` (+ `import 'fake-indexeddb/auto'` if DB unit tests included)
- [ ] `packages/app/test/{db,persist,route,platform}.test.ts` + `version.test.tsx` — cover the unit rows above
- [ ] Dev-dep installs: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, (`fake-indexeddb` if used)
- [ ] A documented manual-validation checklist (the four manual gates) for the owner to run pre-show

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installable (manifest emitted, valid, correct theme/bg/icons) | PWA-01 | Requires browser installability audit | `npm run build -w @guezzer/app`, inspect `dist/manifest.webmanifest` + Chrome DevTools → Application → Manifest |
| Offline after first load (precache serves shell, network disabled) | PWA-02 | Requires real SW + network toggle | `npm run build && npm run preview -w @guezzer/app`, load once, DevTools → Network → Offline, reload → app loads |
| Update prompt appears only on new SW, applies only on Refresh | PWA-02 | Requires two builds + SW lifecycle | Build v1 → preview → build v2 → reload → toast appears → Refresh reloads to v2; Later keeps v1 |
| Persistence survives relaunch on-device | PWA-03 | Device-specific (iOS/Android) | Install on device, write a row, force-quit, relaunch, confirm row present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

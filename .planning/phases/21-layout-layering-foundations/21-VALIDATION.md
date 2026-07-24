---
phase: 21
slug: layout-layering-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `21-RESEARCH.md` § Validation Architecture — see that section for the
> full requirement→test map with file-level detail.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (repo root) — `test.projects`: `@guezzer/core` (`node`), `@guezzer/app` (`jsdom`, `setupFiles: ["./test/setup.ts"]`) |
| **App test location** | `packages/app/test/**/*.test.{ts,tsx}` — **not** co-located with source |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 seconds (measured baseline: 125 files, 954 tests, 7.74s, all green) |

**No lint, no typecheck script exists.** No ESLint config, no `typecheck` script. The test suite is
the entire automated gate. Per-wave, add `npm run build --workspace packages/app` to surface TS errors.

---

## Sampling Rate

- **After every task commit:** Run `npm test` (full suite — at 7.7s there is no reason to subset)
- **After every plan wave:** Run `npm test` **plus** `npm run build --workspace packages/app`
- **Before `/gsd-verify-work`:** Full suite green **and** `21-HUMAN-UAT.md` complete with all device tests recorded
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

*Populated during execution. Requirement→test mapping is fully specified in
`21-RESEARCH.md` § Validation Architecture → "Phase Requirements → Test Map".*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled at execution)* | | | | | | | `npm test` | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files:

- [ ] `packages/app/test/bottomSpace.test.ts` — FOUND-01 / FOUND-02, incl. the D-12 source guard
- [ ] `packages/app/test/layerOrder.test.tsx` — FOUND-03 structural invariant + WR-01/CR-01 + D-23 classes
- [ ] `packages/app/test/formatDate.test.ts` — FOUND-04 helper, UTC boundary + never-throw
- [ ] `packages/app/test/presenceLabels.test.ts` — NAV-03 label map + fallback

Extend existing:

- [ ] `fabMenu.test.tsx`, `bottomOverlayInset.test.tsx`, `sheet.a11y.test.tsx`, `shareCard.test.tsx`,
      `rebrand.test.ts`, `exportImportRoundtrip.test.ts`, `archiveBrowser.test.tsx`,
      `recapView.test.tsx`, `showsList.test.tsx`
- [ ] New coverage: `ShowView` header date, `SetlistView` header date + `aria-label`

Framework install: **none needed** — Vitest 4.1.10, jsdom 29.1.1, `@testing-library/react` 16.3.2
all installed and green.

---

## Manual-Only Verifications

These are genuinely un-automatable and MUST be carried as explicit plan tasks recorded in
`21-HUMAN-UAT.md`, not assumed away.

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| 1 | Gap between body content and tab bar, **before and after**, portrait **and** landscape, on an **installed** home-screen instance | FOUND-01 | `env(safe-area-inset-bottom)` is `0` in every headless/jsdom/desktop context; the bug is invisible outside an installed instance by construction | Install to home screen over the HTTPS tunnel. Read the diagnostic overlay (`body.offsetHeight − #root.offsetHeight`). Record value + screenshot before the fix and after, in both orientations |
| 2 | `bottom-16` overlay overlap (`BingoCelebration`, `WaveToast`) | FOUND-02 | Same — requires a non-zero inset | Trigger each toast on the installed instance; confirm it clears the tab bar |
| 3 | Tab strip at the **largest Dynamic Type** setting | NAV-01 | Requires the OS text-size control | iOS Settings → Display → Text Size to max; confirm 5 labels fit without clipping or wrap |
| 4 | `SearchSheet` with the **soft keyboard up** | FOUND-03 | jsdom has no `visualViewport` resize | Open search on device, focus the input, confirm the sheet is not pushed under the keyboard |
| 5 | Real share-card PNG at the widest realistic venue name | FOUND-05 | Real font metrics — the mock `measureText` is linear-in-length, not real | Generate the card for the longest venue in the corpus; confirm the date is never truncated and nothing overflows or clips the footer baseline |
| 6 | Two devices on **different builds**, both directions | NAV-03 | Real Realtime with a mixed token vocabulary; the failure mode is silent | Old build on device A, new build on device B, over the HTTPS tunnel. Confirm each sees a correct readable label for the other — never blank, never a raw token |
| 7 | Live paint order over a real toast | FOUND-03 | Needs a real compositor | Desktop browser with `?layerRepro=1` — a 30-second check, but not automatable |
| 8 | `SearchSheet` gesture suppression after portaling | FOUND-03 | Double-tap zoom / long-press callout are device behaviors | On device, confirm double-tap and long-press inside the portaled sheet behave as before |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all 4 MISSING test files
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] All 8 manual-only verifications carried as explicit plan tasks in `21-HUMAN-UAT.md`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

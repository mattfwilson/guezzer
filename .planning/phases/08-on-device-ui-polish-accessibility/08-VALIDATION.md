---
phase: 8
slug: on-device-ui-polish-accessibility
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
updated: 2026-07-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (Vitest `projects`: core=node, app=jsdom) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `node node_modules/vitest/vitest.mjs run packages/app/test/<file>` (pnpm not on PATH in this env; the `.bin` shim is a POSIX script) |
| **Full suite command** | `npm test` (→ `vitest run`) |
| **Full-suite runtime** | ~3.5s (74 files / 558 tests) |
| **Phase-08 subset** | 11 files / 68 tests, ~1.7s |

---

## Sampling Rate

- **After every task commit:** run the plan's owned test file(s)
- **After every plan wave:** `npm test` (full suite, cross-plan integration)
- **Before `/gsd-verify-work`:** full suite green (was 558/558 at phase close)
- **Max feedback latency:** ~3.5s (full suite)

---

## Per-Task Verification Map

| Requirement | Plan(s) | Behavior verified | Test file(s) | Type | Status |
|-------------|---------|-------------------|--------------|------|--------|
| POLISH-01 | 08-06 | Zero ellipsis over all 264 real `@matrix` names at orb 64px + center 92px; fit-boundary constants | `test/orbLabelFit.catalog.test.ts`, `test/orbLabelFit.test.ts` | unit | ✅ green |
| POLISH-02 | 08-07 (verify), 08-05 | FabMenu speed-dial five-callback contract + collapse/scrim; InstallBanner once-per-build stamp | `test/fabMenu.test.tsx` (incl. CR-01 `fabScrim < fab` guard), `test/installBannerVersion.test.tsx` | unit | ✅ green |
| A11Y-01 | 08-01 | `<Sheet>` primitive: focus-in + inert, Escape→topmost (LIFO), restore + inert-clear, `initialFocusRef`, non-modal (no inert/scrim), stacked ref-count, fullscreen | `test/sheet.a11y.test.tsx` (8) | unit | ✅ green |
| A11Y-01 | 08-02 | EndShowDialog / TrailNodeSheet migration: Escape-dismiss, preserved confirm/undo guards | `test/endShowDialog.test.tsx`, `test/trailNodeSheet.test.tsx` | unit | ✅ green |
| A11Y-01 | 08-03 | ShareCardSheet / CompareView / "Whose dex?" prompt migration: guarded branches, `initialFocusRef`, `maxLength=40` | `test/shareCard.test.tsx`, `test/compareView.test.tsx`, `test/settingsOwner.test.tsx` | unit | ✅ green |
| A11Y-02 | 08-04 | FilterFab `lifted` translateY above NodeSheet peek from shared viewport height; z.focusedFab | `test/explore/filterFabLift.test.tsx` (FAB-lift cases) | unit | ✅ green |
| A11Y-03 | 08-04 | Camera re-frames (`fg.zoom`/`fg.centerAt` re-fire) when shared visible-viewport height changes with a node focused | `test/explore/filterFabLift.test.tsx` → `describe("ConstellationCanvas reframe on viewport resize (A11Y-03)")` | unit | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** 5/5 requirements COVERED by automated tests at the level jsdom can reach. Residual real-device confirmation is inherently manual (see Manual-Only).

---

## Wave 0 Requirements

- [x] `packages/app/test/setup.ts` — centralized `window.matchMedia` + `ResizeObserver` stubs (closed the Wave-0 gap in 08-01, unblocking every downstream reduced-motion / camera / resize test)

*Existing vitest infrastructure covers all phase requirements; no framework install needed (zero new runtime packages this phase).*

---

## Manual-Only Verifications

These require real phone hardware / assistive tech / true viewport physics that jsdom cannot model. Tracked in `08-HUMAN-UAT.md` and surfaced by `/gsd-progress` and `/gsd-audit-uat`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Orb-label real render | POLISH-01 | The no-DOM heuristic drifts optimistic; only real canvas/DOM metrics on-device confirm legibility | Open `#/dev/orb-fit` on the iPhone over the cloudflared HTTPS tunnel; confirm ZERO overflow offenders (esp. the 44-char "(You Gotta) Fight for Your Right (To Party!)") |
| `inert` background suppression (WR-02) | A11Y-01 | `inert` on a `display:contents` element has historically inconsistent AT-tree propagation across engines; jsdom can't verify | With a modal `<Sheet>` open, swipe past the last in-sheet element in VoiceOver; confirm focus can't reach the background. Fallback: move `id`/`inert` onto AppShell's root box |
| Real AT dismiss/trap/restore | A11Y-01 | jsdom asserts handler-level only; real Tab-order + AT virtual-cursor trapping need VoiceOver/keyboard on hardware | For each of the 7 audited surfaces: Escape dismisses, modal traps + Tab wraps, focus restores to trigger; NodeSheet stays non-modal |
| FilterFab pixel no-occlusion | A11Y-02 | Pixel occlusion + tap reachability depend on real `visualViewport` height + safe-area insets | Focus a node; confirm the FAB rests ~12px above the NodeSheet peek, fully tappable, returns to bottom-right on close |
| Resize/rotate/keyboard framing | A11Y-03 | Requires real `visualViewport` resize/keyboard events on hardware | Focus a node, rotate device, toggle on-screen keyboard; camera stays framed with no snap-off |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (matchMedia/ResizeObserver stubs shipped)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (full suite ~3.5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-18 (5/5 requirements automated; 5 device checks tracked as Manual-Only in 08-HUMAN-UAT.md)

---

## Validation Audit 2026-07-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only, inherent) | 5 |

Every phase-08 requirement has green automated coverage at the level jsdom supports (68 tests across 11 files). The 5 escalated items are inherently-manual on-device confirmations, not automation failures — they cannot be modeled in jsdom (real rendering, VoiceOver AT tree, `visualViewport` physics). No test files were generated; the existing suite already covers all automatable behavior.

---
phase: 13
slug: interface-explore-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (projects: core=node, app=jsdom) |
| **Config file** | vitest.config.ts (root) |
| **Quick run command** | `npx vitest run --project core` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project core`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-XX-XX | XX | 1 | UX-03 | — | Fill-hint never names wrong song; suppress on ambiguity | unit | `npx vitest run --project core suggest` | ✅ | ⬜ pending |
| 13-XX-XX | XX | 1 | UX-02 | — | Wake lock released when release races in-flight acquire | unit (jsdom) | `npx vitest run --project app wakeLock` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Both target test files already exist (`packages/core/test/suggest.test.ts`, `packages/app/.../wakeLock.test.ts`) with the required mock idioms — zero Wave 0 scaffolding gaps (per RESEARCH.md).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single top safe-area inset; overlay headers align with shell header on notched iPhone standalone PWA | UX-01 | Requires physical notched device under `viewport-fit=cover` | Install PWA on notched iPhone via cloudflared HTTPS tunnel (`--http-host-header localhost`); confirm no doubled dead band and aligned overlay headers |
| Screen sleeps after End Show | UX-02 | Requires physical device screen-sleep observation | On device, run then End Show; confirm screen dims/sleeps and stays asleep |
| Constellation keeps pan/zoom across address-bar collapse / orientation; re-centers only when focus lost | UX-04 | Requires physical iOS Safari address-bar/orientation behavior | On device, pan/zoom constellation, trigger address-bar collapse + rotate; confirm camera preserved, focus re-center only when node would leave screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

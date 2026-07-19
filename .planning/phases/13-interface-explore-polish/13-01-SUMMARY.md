---
phase: 13-interface-explore-polish
plan: 01
subsystem: app-ui
tags: [safe-area-inset, ios-pwa, viewport-fit, device-uat]
requires: []
provides:
  - "Single top safe-area inset on notched iPhone standalone PWA (UX-01)"
  - "Aligned overlay headers (shell + six fixed overlays)"
  - "Consolidated phase device-UAT checklist (13-HUMAN-UAT.md) for UX-01/02/04"
affects:
  - packages/app/src/styles.css
  - packages/app/src/dex/RecapView.tsx
tech-stack:
  added: []
  patterns:
    - "One top inset per surface: body carries no padding-top; each top-anchored surface applies its own calc(env(safe-area-inset-top) + Npx)"
key-files:
  created:
    - .planning/phases/13-interface-explore-polish/13-HUMAN-UAT.md
  modified:
    - packages/app/src/styles.css
    - packages/app/src/dex/RecapView.tsx
decisions:
  - "UX-01: ship the minimal top-only deletion (delete only the body padding-top); leave L/R/bottom body insets untouched to keep the blast radius small (D-01)."
  - "RecapView keeps env + 24px as a deliberate exception (12px lower than the other six headers); marked intentional in code so it is never normalized (Open Question 1 / A6)."
metrics:
  duration: ~25m
  completed: 2026-07-19
tasks_completed: 2
tasks_total: 2
---

# Phase 13 Plan 01: Safe-Area Inset De-doubling + Device-UAT Checklist Summary

Removed the doubled top safe-area inset on the notched-iPhone installed PWA by deleting the single `body { padding-top: env(safe-area-inset-top) }` line, so the top inset now applies exactly once and all seven top-anchored headers align; documented RecapView's intentional +24px outlier and authored the phase's consolidated on-device iOS UAT checklist.

## What Was Built

**Task 1 — De-double the top inset (fix):**
- Deleted `padding-top: env(safe-area-inset-top);` from the `body` selector in `styles.css`. The body previously applied a top inset that the in-flow AppShell header re-added via `calc(env(safe-area-inset-top) + 12px)`, producing a doubled ~50px dead band. The six `fixed inset-0` overlays escape body flow, so their headers sat one inset higher than the shell header — deleting the body top pad collapses everything to one per-surface `env()` idiom and realigns all seven headers automatically.
- Replaced the deleted line with an explanatory comment (D-01) so a body-level top inset is never reintroduced.
- Kept the three sibling body insets (`padding-bottom/left/right`) untouched per the top-only decision.
- Added a clarifying comment above RecapView's `calc(env(safe-area-inset-top) + 24px)` marking the +24px as an intentional exception (menu-less layout breathing room), value unchanged.

**Task 2 — Consolidated device-UAT checklist (docs):**
- Created `13-HUMAN-UAT.md` as the single-owner file for the parallel wave, with `status: pending` front matter, a cloudflared HTTPS tunnel hosting runbook (`--http-host-header localhost`), and three unchecked device-only sections (UX-01, UX-02, UX-04) each with repro steps and expected outcomes.

## 7-Surface Safe-Area Audit (UX-01)

All top-anchored `env(safe-area-inset-top)` surfaces, confirmed by grep:

| Surface | File | Top inset |
|---------|------|-----------|
| AppShell header | components/AppShell.tsx:41 | `+ 12px` |
| SearchSheet | show/SearchSheet.tsx:105 | `+ 12px` |
| ArchiveBrowser | dex/ArchiveBrowser.tsx:256 | `+ 12px` |
| AlbumDetail | dex/AlbumDetail.tsx:53 | `+ 12px` |
| CompareView | dex/CompareView.tsx:57 | `+ 12px` |
| SetlistView | dex/SetlistView.tsx:136 | `+ 12px` |
| RecapView | dex/RecapView.tsx:162 | `+ 24px` (intentional outlier) |

Six use `+12px`, RecapView uses `+24px`. The body's former `padding-top` (styles.css:186) was the eighth, redundant source — now removed. No overlay `env()` calc was edited (git diff touched only `styles.css` + `RecapView.tsx`).

## Verification

- `npx vitest run` — full suite green: **78 files, 627 tests passed**.
- App typecheck — `npx tsc --noEmit -p packages/app/tsconfig.json` exit 0 (confirms the between-attributes `//` comment in RecapView is valid TSX).
- Git diff for Task 1 limited to `styles.css` (top pad removed, comment added) + `RecapView.tsx` (comment added); Task 2 added only the new planning doc.
- Device UAT (UX-01/02/04) is recorded as pending in `13-HUMAN-UAT.md` — to be executed on-device before `/gsd-verify-work` (physical-device checks, cannot be automated).

## Deviations from Plan

None functionally — plan executed as written. Two environment/setup notes:

1. **[Rule 3 — Blocking] Worktree base was 6 commits behind the expected base.** The worktree was created at `397615f` (a linear ancestor of `master`/`241a964`, before the phase-13 planning commits), so the PLAN.md did not exist in the checkout. Fast-forwarded the worktree branch to the expected base `241a964` (clean fast-forward — branch sat exactly at the merge-base with no unique commits, zero risk to other work). No content changed by this; it only brought the already-approved planning artifacts into the checkout.
2. **[Rule 3 — Blocking] No `node_modules` in the fresh worktree.** Ran `npm install` (no package argument) to restore the locked dependency tree from `package-lock.json` so verification could run. This restores existing locked deps, not a new/named package — the package-legitimacy gate does not apply. 501 packages restored.

## Known Stubs

None. No stub patterns introduced (this plan is a one-line CSS deletion, a code comment, and a planning doc).

## Self-Check: PASSED

- FOUND: packages/app/src/styles.css (padding-top removed; padding-bottom/left/right present)
- FOUND: packages/app/src/dex/RecapView.tsx (+24px retained, comment added)
- FOUND: .planning/phases/13-interface-explore-polish/13-HUMAN-UAT.md (contains UX-01)
- FOUND commit dfa9e33 (Task 1: fix CSS + RecapView)
- FOUND commit 351e108 (Task 2: device-UAT checklist)

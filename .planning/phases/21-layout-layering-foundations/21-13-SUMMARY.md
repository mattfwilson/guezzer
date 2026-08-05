---
phase: 21-layout-layering-foundations
plan: 13
subsystem: docs/device-verification
tags: [uat, device-verification, found-01, found-02, found-03, found-05, nav-01, nav-03, close-out]
requires:
  - "21-03 (tab rename + frozen presence wire vocabulary)"
  - "21-05 (full-date rendering)"
  - "21-06 (composeFooterLine / share-card footer)"
  - "21-07 (single-owner bottom-space conversion)"
  - "21-10 (five bottom overlays onto the chrome reserve)"
  - "21-11 / 21-12 (SearchSheet + FabMenu portaled, layerOrder invariant)"
  - "21-SESSION-3-RESULTS.md (owner's verbatim device results, 2026-08-05)"
provides:
  - "21-HUMAN-UAT.md closed at status: partial — the phase's complete device-verification record"
  - "a named, tracked residual gap for NAV-03 mixed-build presence (test 6)"
  - "corrected two-build harness base commit (e92d4a8) for whoever runs test 6 later"
affects:
  - ".planning/phases/21-layout-layering-foundations/21-HUMAN-UAT.md"
tech-stack:
  added: []
  patterns:
    - "courier-file pattern: 21-SESSION-3-RESULTS.md carried owner device results across a context reset; folded into the artifact of record and left behind as history"
key-files:
  created:
    - ".planning/phases/21-layout-layering-foundations/21-13-SUMMARY.md"
  modified:
    - ".planning/phases/21-layout-layering-foundations/21-HUMAN-UAT.md"
decisions:
  - "Closed 21-HUMAN-UAT.md at status: partial, not resolved — test 6 (NAV-03 mixed-build presence) was never run; owner-approved time-box"
  - "Rejected session #3's GAP:1 probe pair as FOUND-01 corroboration — arithmetically the sab:0 Safari context, where the bug class is unobservable by construction"
  - "shareCard.ts left byte-unmodified: the D-37 measurement showed descenders clear and that the contingency nudge would collide the footer lines"
  - "Test 3's six-tab re-run recorded as superseding, not repeating, the session-#2 five-tab reading (Sched landed in 2028a95 after it)"
metrics:
  duration: ~14 min
  completed: 2026-08-05
  tasks: 3
  files: 2
---

# Phase 21 Plan 13: End-of-Phase Device UAT Close-Out Summary

Folded three sessions of owner device results into `21-HUMAN-UAT.md`, reconciled two stale `Gaps`
entries and a wrong harness commit, and closed the phase's device record at `status: partial` with
NAV-03 mixed-build presence recorded as a single named residual gap.

## What This Plan Actually Was

The plan's three tasks are all `checkpoint:human-verify`. **The device verification had already
happened** across three owner sessions (2026-07-25, 2026-07-26, 2026-08-05). No new device work was
performed or requested. This execution was a documentation close-out: fold the recorded results into
the artifact of record, reconcile bookkeeping that had gone stale, and close the document honestly.

The orchestrator supplied both checkpoint resolutions up front (close out from session #3; record
test 6 as an explicit gap at `status: partial`), so no checkpoint was returned.

## Deviations from Plan

### 1. [USER-APPROVED] Closed at `status: partial`, not `status: resolved`

**This is the deviation the phase verifier most needs to read as intentional.**

The plan's `must_haves.truths` requires "…and its status is resolved", and its `artifacts` entry
requires `contains: "status: resolved"`. **The document closes `status: partial` instead.**

- **Why:** UAT test 6 (NAV-03, two devices on different builds, both directions) was **NEVER RUN**.
  It needs two worktrees, two production builds, two simultaneous cloudflared tunnels, two physical
  devices and two distinct signed-in identities. The owner is time-boxed before the Aug 2026 shows
  and explicitly chose to move on.
- **Sanctioned by the plan itself.** Task 3's action text: *"If any test failed or any residual gap
  remains, record it explicitly in `## Current Test` and leave `status: partial` rather than marking
  the phase clean."* The acceptance criterion likewise reads `status: resolved` **or** `status:
  partial` with the residual gap named. T-21-40 in the plan's own threat register mandates exactly
  this: *"an incomplete pass must leave `status: partial` with the gap named."*
- **Recorded in three places** so it cannot be lost: frontmatter `residual_gap:`, `## Current Test`,
  and a full `open` entry in the `Gaps` block with coverage boundary and sized residual risk.
- **Residual risk, sized honestly:** nothing on the show-#1 critical path depends on it — a wrong or
  blank friend-activity label degrades a social nicety and cannot break the live-tracking loop, the
  predictions or the setlist log. It is *not* zero: T-21-38 named this session as the phase's only
  verification of the `reduceActivity` allow-list against live untrusted peer payloads, so that
  control ships unit-proven only.

### 2. [Rule 1 - Bug] Rejected session #3's test-1 probe reading as FOUND-01 corroboration

**Found during:** Task 1. **Not in the plan; found by checking the arithmetic rather than
transcribing the courier.**

`21-SESSION-3-RESULTS.md` reports `mainBottom: 650`, `tabTop: 651`, `GAP: 1` as *"independent
corroboration"* of FOUND-01's closure. Those numbers are reachable only from the **`sab: 0` Safari
context**, not the installed instance:

| context | viewport | sab | navTop = vp − 4rem − sab | button top |
|---------|----------|-----|--------------------------|------------|
| Safari tab (session #3, proven by `session3-layoutprobe-safari-sab0-PROOF.PNG`) | 714 | 0 | 650 | **651** |
| installed instance (session #2, same route) | 812 | 34 | 714 | **715** |

Row 1 reproduces session #3's reported pair exactly; row 2 reproduces session #2's recorded
`tabTop: 715` exactly. A genuine standalone reading would have printed ~714/715. Session #3 captured
**no** standalone probe screenshot — the only probe artifact from that session is the Safari one.

Under `sab: 0` the FOUND-01 double-count is unobservable **by construction** (the inset that would be
double-counted is zero), so the reading can neither confirm nor falsify the fix.

- **Fix:** recorded as a `⚠ RECORDED CAVEAT` in test 1 rather than transcribed as corroboration.
- **Impact: none on the verdict.** FOUND-01 stays **closed** on the session-#2 measured before/after
  (sab 34/20, GAP 35→1 and 21→1, both orientations, controlled on `sab` and `tabTop`), which is
  sufficient on its own. No re-run required.
- **Why it mattered:** transcribing it would have laundered a browser-tab reading into closed
  evidence — precisely the failure MEMORY `ios-standalone-verification` exists to prevent, and the
  one that cost this session its first half.

### 3. [Rule 2 - Missing critical bookkeeping] Reconciled the FOUND-03 gap entry too

The plan named only the stale FOUND-01 `Gaps` entry. The **second** gap entry (FOUND-03 layering)
was also stale — `status: diagnosed` with a `missing:` list still demanding work that plans 21-11
and 21-12 had shipped ("Portal SearchSheet and FabMenu — plan 21-11", the `layerOrder.test.tsx`
invariant, the D-23 class re-application).

Leaving it would have misrepresented shipped work as outstanding to the phase verifier. Reconciled
to `status: resolved` with a `resolved_by:` list; the original diagnosis is retained verbatim as
history. In both gap entries the finding history was **reconciled, never deleted**.

### 4. Also corrected while 21-13 was in the file

- **Harness base commit.** The "Serving two builds" sub-section said to use the last commit before
  *"plan 21-13's tab rename"*. The rename landed in **`1cc5787` (plan 21-03)**; 21-13 renames
  nothing. Following the old wording would have checked out a base that **already contained the
  rename**, producing two same-vocabulary builds and a test that passes while exercising nothing.
  Corrected to the verified `e92d4a8` (= `1cc5787^`), with the reason recorded.
- **Stale `## Summary` counts** (total 8 / passed 2 / issues 1 / pending 5) → 6 passed / 1 skipped /
  0 pending, plus a per-test final-state table.
- **Stale `## Session Notes`** marked HISTORICAL rather than deleted — it records why the work was
  sequenced as it was.

## Test-by-Test Final State

| # | Test | Final | Basis |
|---|------|-------|-------|
| 1 | Bottom gap before/after (FOUND-01) | CLOSED | measured before/after, both orientations (session #2); D-18 device fields completed session #3 |
| 2 | Overlay overlap (FOUND-02) | PASS | all five overlays, owner attestation |
| 3 | Max Dynamic Type (NAV-01) | PASS | re-run on the **six**-tab strip — supersedes the session-#2 five-tab reading |
| 4 | SearchSheet + soft keyboard (D-17) | PASS | no fix required, none made |
| 5 | Share-card footer (FOUND-05/D-37) | PASS | device pass + headless descender measurement |
| 6 | Mixed-build presence (NAV-03) | **NOT RUN — residual gap** | owner-approved time-box |
| 7 | Live paint order (D-29) | RESOLVED, static-only | `?layerRepro=1` never run; converted into `layerOrder.test.tsx` |
| 8 | Gesture suppression (D-23) | PASS | per-surface/per-behaviour on device — upgrades session-#2 PARTIAL |

Test 6's result block **states plainly that it was not run and why** — that is a recorded result,
not a `PENDING`. No result block remains `PENDING`.

## Production Code: Deliberately Untouched

`packages/app/src/dex/shareCard.ts` is **byte-unmodified**. The plan permitted exactly one
conditional production edit — the `height * 0.99` → `height * 0.97` footer-baseline nudge — *only
if* test 5 recorded a clipped baseline. It did not: the session-#2 headless measurement showed
descenders clear the card's bottom edge by **+3.50px**, and further showed the contingency fix **as
written is unsafe** (at `0.97` the two footer lines would collide by 21.75px). The edit stays unmade,
as designed. Verified: `git diff HEAD -- packages/app/src/dex/shareCard.ts` is empty.

## Verification

- **`npm test` (Task 2's `<automated>` gate): GREEN** — 134 files / 1135 tests passed. Because no
  production edit was made, this is a confirmation that the tree is green at the commit under test
  rather than a regression check on a fix — the outcome the plan anticipated for the no-clip branch.
- All 8 `result:` blocks carry non-`PENDING` results (verified by grep).
- Frontmatter is `status: partial`, `updated` refreshed, `residual_gap` named.
- Harness SHAs verified present in-repo: `e92d4a8`, `1cc5787`, `1cc5787^ == e92d4a8`.

## Carried Forward — Outstanding

1. **UAT test 6 / NAV-03 mixed-build presence.** Full `<how-to-verify>` intact; corrected harness
   base `e92d4a8`. No code change expected or implied.
2. **The `260724-hqu` / `260724-lgo` two-device realtime recheck.** The `visibleEpoch`
   mobile-suspension rejoin in `usePresence.ts` and `useProgressSync.ts` is unit-proven only — the
   test proves the re-open *trigger*, not live socket recovery over a genuinely suspended
   connection. It rides on step 5 of test 6, so it is **explicitly restated as outstanding**, not
   closed. Third instance of this project's recurring lesson that a unit-proven realtime path is not
   a verified one.
3. **Evidence basis, recorded not hidden.** Session #3 captured no standalone screenshots for the
   passing re-run; tests 2/3/4/8 and test 1's two D-18 fields rest on **owner attestation** — the
   same basis session #2 used for NAV-01.
4. **`apple-mobile-web-app-capable` todo** (`2f97eda`) — iOS "Add to Home Screen" can silently create
   a Safari *bookmark* instead of a standalone web app. That is what cost session #3 its first half.
   One-line fix, flagged pre-show because every remaining device session depends on a deterministic
   install.

## Known Stubs

None. This plan modified documentation only; no code paths, no placeholder data, no unwired
components.

## Self-Check: PASSED

- `21-HUMAN-UAT.md` — FOUND (modified, `status: partial`, 8/8 non-PENDING results)
- `21-13-SUMMARY.md` — FOUND (this file)
- `packages/app/src/dex/shareCard.ts` — FOUND, unmodified (empty diff vs HEAD)
- Commits `5f7efb6`, `c231430`, `7e9b0ac` — all FOUND in `git log`
- Harness SHAs `e92d4a8` / `1cc5787` — both FOUND via `git cat-file -t`
</content>
</invoke>

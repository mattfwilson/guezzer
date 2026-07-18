# Phase 10: Pre-Show Validation & Device Dry-Run - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 10-pre-show-validation-device-dry-run
**Areas discussed:** Tuning spot-check scope, Dry-run live-feed sim, Evidence & pass format, Device & hosting scope

---

## Tuning spot-check scope (VALID-01)

### How thorough should the spot-check be? (needsReview already 0, Phase 01 passed a similar check)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm + anomaly sweep | Read-only review report: ~10 canonical songs expected vs actual family + surface suspicious/cs-standard cases; fix only genuine errors, no blind regeneration | ✓ |
| Regenerate then review | Re-run generate-tuning-tags first to catch new catalog songs, review new needsReview subset | |
| Pure manual re-confirm | No tooling; owner opens JSON, spot-checks 10 songs by hand | |

**User's choice:** Confirm + anomaly sweep

### Should the sweep hunt cs-standard/other, or just verify standard-vs-microtonal?

| Option | Description | Selected |
|--------|-------------|----------|
| Include cs-standard prompt | Report flags candidate cs-standard (down-tuned) + other songs album-defaults can't assign | ✓ |
| Standard vs microtonal only | Only check the split that exists today; treat cs-standard/other as out-of-scope | |
| You decide | Planner chooses | |

**User's choice:** Include cs-standard prompt

### If real tag errors are found, how far does Phase 10 carry the fix?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix + rebuild + backtest | Hand-edit tags → re-run build-model + backtest to confirm no regression before done | ✓ |
| Fix tags only, note rebuild | Correct JSON, defer matrix rebuild to a follow-up | |
| Expect zero real errors | Confirmation-only; if a real error appears, stop and decide then | |

**User's choice:** Fix + rebuild + backtest
**Notes:** Realistic expectation is the sweep finds nothing (Phase 01 + hand-tagging did the work); the fix-and-verify path only fires if a genuine error surfaces.

---

## Dry-run live-feed sim (VALID-02)

### How to exercise set break + encore?

| Option | Description | Selected |
|--------|-------------|----------|
| mockLatest for sync, manual rest | ?mockLatest=1 proves sync leg once; set break/encore/End Show driven by real Show Mode controls (mirrors real logging) | ✓ |
| Extend mockLatest fixture | Grow fixture into staged multi-set + encore show driven by sync pipeline | |
| You decide | Planner picks | |

**User's choice:** mockLatest for sync, manual rest

### Include an offline (airplane-mode) leg, even though VALID-02 doesn't list it?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add offline leg | Mid-run flip airplane mode; confirm predictions/logging/constellation work from precache/IndexedDB | ✓ |
| No — stick to listed loop | Keep to exactly the enumerated steps | |
| Note as separate check | Capture as a distinct one-line UAT item, not in the main loop | |

**User's choice:** Yes — add offline leg
**Notes:** The app's core value is "fully offline once loaded" and venues often have no signal — the actual condition worth proving.

---

## Evidence & pass format

### What evidence proves the validations passed?

| Option | Description | Selected |
|--------|-------------|----------|
| HUMAN-UAT.md, enumerated steps | 10-HUMAN-UAT.md, loop broken into discrete steps w/ expected/result; screenshots optional | ✓ |
| UAT + required screenshots | Same checklist but require screenshots at key milestones | |
| Lightweight pass/fail | Short pass/fail per requirement, no enumeration | |

**User's choice:** HUMAN-UAT.md, enumerated steps

### If the dry-run surfaces a bug?

| Option | Description | Selected |
|--------|-------------|----------|
| Triage: fix blockers, defer cosmetic | Show-loop breakers fixed inline; cosmetic/minor logged to backlog | ✓ |
| Fix everything inline | Any issue fixed before phase closes | |
| Report only, decide later | Record pass/fail, route all fixes to follow-up | |

**User's choice:** Triage: fix blockers, defer cosmetic

---

## Device & hosting scope (VALID-02)

### Which device(s) for the dry-run?

| Option | Description | Selected |
|--------|-------------|----------|
| iOS only | iPhone (primary); Android waived (no device) and noted in UAT | ✓ |
| iOS + Android | Full loop on iPhone + smoke-pass on Android | |
| Android primary | Main show device is Android | |

**User's choice:** iOS only

### How to serve the app to the iPhone?

| Option | Description | Selected |
|--------|-------------|----------|
| Prod build over cloudflared tunnel | vite build → preview over HTTPS tunnel; faithful SW/precache/install/offline | (initial pref: dev) |
| Dev server over tunnel | Serve Vite dev build over tunnel; faster but SW/offline don't match prod | (chosen first) |
| You decide | Planner picks | |

**User's choice (first pass):** Dev server over tunnel

### Resolving the dev-vs-prod tension (offline + install legs need a prod-built SW)

| Option | Description | Selected |
|--------|-------------|----------|
| Prod build for the gate | Dev server for poking around; the graded VALID-02 pass runs against prod build over tunnel | ✓ |
| Dev server, drop offline+install legs | Keep dev server; mark offline/install "not tested / by design" | |
| Both: dev to rehearse, prod to certify | Informal dev run first, final certifying prod run | |

**User's choice:** Prod build for the gate
**Notes:** Claude flagged that the offline leg (chosen earlier) and PWA install depend on the vite-plugin-pwa production service-worker precache, which the dev server doesn't generate. User agreed to run the graded pass against the prod build while keeping the dev server as a convenience for informal rehearsal.

---

## Claude's Discretion

- Exact form of the VALID-01 review report (standalone CLI vs generated markdown vs augmenting existing CLI) — read-only, surfacing D-01/D-02 content.
- Heuristics for nominating cs-standard/other and standard/microtonal anomaly candidates.
- Which ~10 songs form the canonical spot-check set (seeded from Phase 01 examples).

## Deferred Ideas

- Android device validation — no device available; VALID-02 criterion 3 is conditional and waived.
- Cosmetic/minor dry-run bugs — logged to backlog per triage decision, not fixed inline.
- Staged multi-set/encore mockLatest fixture — rejected as harness code that doesn't match real logging; note if a future automated full-loop E2E is wanted.

# Phase 8: On-Device UI Polish & Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 8-On-Device UI Polish & Accessibility
**Areas discussed:** Sheet a11y approach, NodeSheet ↔ FilterFab (A11Y-02), Layering/animation scope, Orb 'no-truncation' bar (POLISH-01)

---

## Sheet a11y approach

### Q1 — How to add a11y behavior across all sheets

| Option | Description | Selected |
|--------|-------------|----------|
| One shared primitive | Build a single reusable Sheet/Modal wrapper + useFocusTrap hook, migrate all 7 sheets. DRY, matches single-config ethos, kills duplicated shell idiom. | ✓ |
| Shared hook only | Extract just a useFocusTrap/useEscapeDismiss hook, drop into each sheet; markup stays. | |
| Patch each sheet | Add Escape + focus handling inline to each of the 7 sheets individually. | |

**User's choice:** One shared primitive

### Q2 — How to handle NodeSheet (non-modal by design)

| Option | Description | Selected |
|--------|-------------|----------|
| Esc + restore, no trap | NodeSheet keeps non-modal nature: Escape-dismiss + focus-restore, no trap, no scrim; the 6 true modals get full trap+restore. | ✓ |
| Full trap like others | Trap focus inside NodeSheet too. Uniform but contradicts D-14 and A11Y-02. | |
| Exclude NodeSheet | Leave NodeSheet as-is (swipe-down only), a11y only on the 6 modals. | |

**User's choice:** Esc + restore, no trap
**Notes:** Preserves Phase 7 D-14 (graph stays live/interactive above a scrim-less partial sheet).

---

## NodeSheet ↔ FilterFab (A11Y-02)

### Q1 — How NodeSheet and FilterFab coexist when a node is focused

| Option | Description | Selected |
|--------|-------------|----------|
| Lift FAB above sheet edge | Animate FilterFab up to rest above the sheet's top edge + raise its z-index; return on close. Both fully usable, no overlap. | ✓ |
| Raise FAB z-index only | Paint FAB above the sheet without moving it; overlaps sheet's bottom-right corner. | |
| Hide FAB while focused | Hide FilterFab while a node is focused; returns on dismiss. Arguably fails A11Y-02's "both usable". | |

**User's choice:** Lift FAB above sheet edge

---

## Layering/animation scope

### Q1 — How much of the bottom-sheets todo folds into Phase 8

| Option | Description | Selected |
|--------|-------------|----------|
| z-scale in, animation deferred | Fold centralized z-index scale (needed for A11Y-02 + FAB-over-sheet fix); defer slide animation to its own pass. Keeps pre-show phase tight. | ✓ |
| Both z-scale + animation | Add slide/scrim animation now too since the primitive touches every sheet. More surface/risk before shows. | |
| Minimal — neither | Local z-index bump only, defer whole todo. Leaves scattered z magic numbers. | |

**User's choice:** z-scale in, animation deferred

---

## Orb 'no-truncation' bar (POLISH-01)

### Q1 — What bar to hold orb text to

| Option | Description | Selected |
|--------|-------------|----------|
| Verify real catalog, tune | Every REAL name must render full on a small phone: verify all 264 on-device, tune constants so none ellipsize; keep ellipsis as unreachable safety net. | ✓ |
| Guarantee never-truncate | Remove/neutralize the ellipsis fallback so any input always fits; needs a minimum-legibility floor. | |
| You decide | Verify + tune + keep a floor, at Claude's discretion. | |

**User's choice:** Verify real catalog, tune

---

## Claude's Discretion

- **POLISH-02** — verify D-20 FabMenu and D-22 InstallBanner match their originating todos, then formally resolve those todos (confirm-and-file, not a design decision).
- **A11Y-03** — resize reframe is mostly wired already (`size.height` in the focus-camera effect deps); verify on-device and fix any snap-off edge case.
- z-tier names/values, shared-primitive API shape, focus-trap implementation, FAB lift distance/animation, final orb-fit constants — all within the single config file.

## Deferred Ideas

- **Sheet slide-up/down animation + scrim cross-fade** — animation half of the bottom-sheets todo; deferred to its own polish pass.
- **GizzVerse edge-flow particles** todo — visual enhancement, out of Phase 8 scope.
- **App-wide "Mon D, YYYY" date format** todo — distinct from polish/a11y, out of scope.
- **Final show share card uses GizzDex totals** todo — share-card data/logic, out of scope.

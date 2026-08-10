---
created: 2026-08-10T00:00:00.000Z
title: Five hand-rolled bottom sheets never animate — SearchSheet most visibly
area: ui
resolves_phase:
files:
  - packages/app/src/show/SearchSheet.tsx
  - packages/app/src/dex/AlbumDetail.tsx
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/explore/NodeSheet.tsx
  - packages/app/src/map/PinSheet.tsx
---

## Problem

Phase 22 animated the shared `<Sheet>` primitive, but two bounded seams mean "every bottom sheet
animates" is false — and the most-used surface in the app is on the wrong side of the line.

**Seam 1 — five hand-rolled sheets never adopt the primitive at all:** `SearchSheet`,
`AlbumDetail`, `ArchiveBrowser`, `SetlistView`, `NodeSheet` (locked decision D-16,
`22-CONTEXT.md`). They are not `<Sheet>` consumers, so they neither enter- nor exit-animate.

**Seam 2 — six of nineteen `<Sheet>` openings are enter-only:** `CompareView` ×2,
`FriendDetail` ×2, `PinSheet` ×2. Their parent unmounts them outright rather than driving an
`open` prop, so `AnimatePresence` never gets to run an exit. These are cheaper to fix than seam 1
— it is a prop-shape conversion, the same one plans 22-04 and 22-10 already did three times.

**Why this matters more than a polish nit.** `Sheet.tsx`'s own module doc names `SearchSheet` as
"the one-thumb in-the-dark surface used most at a show". So the single sheet a user touches most
during the exact scenario this app exists for is the one that visibly will not animate while
everything around it does. The inconsistency is most legible precisely where it is least wanted.

## Evidence

- `packages/app/src/components/Sheet.tsx:66-70` — the seam roster, verified accurate in
  `22-VERIFICATION.md` by grepping all `<Sheet` openings: 19 found, 13 prop-driven, 6 hardcoded.
- `.planning/phases/22-surface-motion-the-chrome-mechanism/22-CONTEXT.md` — D-16 locks the
  hand-rolled five as out of Phase 22's scope.
- `.planning/REQUIREMENTS.md` SHEET-01 was **amended 2026-08-10** to the achieved scope
  ("every `<Sheet>`-backed, prop-driven sheet"). This todo tracks the original quantifier.

## Solution

Two independent pieces of work, and **seam 2 is much the cheaper** — do it first if only one gets
done:

1. **Seam 2 (small):** convert the six hardcoded openings to prop-driven
   (`<Sheet open={payload != null}>` plus a last-non-null ref so the leaving sheet keeps its
   content). `TrailNodeSheet` and `WhyDetail` in plan 22-10 are the worked examples, including the
   write-safety guard that must read the **prop**, not the frozen ref.
2. **Seam 1 (larger):** migrate the five hand-rolled sheets onto `<Sheet>`. Each brings its own
   layout assumptions, and `SetlistView` and `NodeSheet` have phase-22 behaviour worth preserving
   (`SetlistView`'s pending-vs-missing split, `NodeSheet`'s `--gz-chrome-reserve` composition).
   Start with `SearchSheet` — it carries the most user value and is the reason this todo exists.

Both are regression-shaped work on surfaces with existing device-verified a11y contracts, so
`sheet.a11y.test.tsx`'s guarantees apply to each converted surface as it lands.

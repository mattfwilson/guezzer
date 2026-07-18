---
created: 2026-07-18T05:41:53.084Z
title: Final show share card uses GizzDex totals instead of the show's recap stats
area: ui
files:
  - packages/app/src/dex/RecapView.tsx:282-283
  - packages/app/src/dex/ShareCardSheet.tsx:1-67
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/dex/useDexStats.ts
---

## Problem

When a tracked show ends, the post-show recap (`RecapView`) offers a "Share card"
CTA. But the card it produces reflects the user's **all-time GizzDex totals**, not
**that night's show**.

Root cause: the Share CTA opens `<ShareCardSheet>` with no session/recap context —
`RecapView.tsx:282-283` renders `<ShareCardSheet open={shareOpen} ... />` with only
`open`/`onClose`. `ShareCardSheet` (see its header comment + `:34-53`) *self-sources
the live dex* via `useDexStats` and builds the card with
`buildShareStats(dex, archive)` — i.e. the global Pokédex numbers. The same sheet is
(correctly) reused from the DexHeader share CTA, so it was only ever wired for the
all-time dex.

Expected: sharing from the final-show recap should produce a card about THAT show —
the night's hit/miss tally + pct, source split, show rarity score + tier-chip counts,
rarest of the night, and +N new catches — the exact stats `deriveRecap` already
computes and `RecapView` already renders on screen. Currently the on-screen recap and
the shared card disagree.

## Solution

TBD — decide whether the recap gets its own show-scoped share card vs. parameterizing
the existing sheet. Sketch:

- `RecapView` already has the per-show numbers from `deriveRecap(sessionId, ...)`
  (`recap.tally`, `recap.sourceSplit`, `recap.rarity`, `recap.newCatches`,
  `recap.setlist`). A core `buildShowShareStats(recap, ...)` mirroring
  `buildShareStats` would keep the card math in core (CLAUDE.md core/UI separation).
- Give `ShareCardSheet` an optional `mode`/`source` prop (e.g. `dex` vs `show`) or a
  `shareStats` override so RecapView passes the show-scoped stats and DexHeader keeps
  the all-time path. Preserve the existing dex behavior for the DexHeader CTA.
- Watch the T-06-21 rule: kglw-derived song/venue names render as text only, never
  innerHTML, on the card too.
- Confirm which card the user actually wants at show-end (per-show is the clear intent
  here) — the two CTAs sharing one sheet is the trap to undo.

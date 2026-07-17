---
created: 2026-07-17T04:28:54.150Z
title: GizzDex — Albums always shows the full grayed grid; Mark-attended only on Shows
area: ui
files:
  - packages/app/src/dex/DexView.tsx:117-139
  - packages/app/src/dex/AlbumGrid.tsx
---

## Problem

On the **GizzDex** tab (route `dex`, `DexView`), two coupled tweaks:

1. When you have **zero caught songs**, the Albums toggle currently shows an
   `EmptyState` (heading/body + a "Mark attended show" CTA) instead of the album
   shelf (`DexView.tsx:117-124`). Owner wants the **full album list shown, grayed
   out**, even at zero catches — so the collection reads as a "Pokédex to fill"
   from first launch.
2. The "Mark attended show" CTA appears on BOTH toggles today — inside the Albums
   empty-state (`DexView.tsx:120`) and atop the Shows segment (`DexView.tsx:129`).
   Owner wants it **only on the Shows toggle**.

## Solution

Both asks collapse into one mostly-subtractive edit in `DexView.tsx`:

- Replace the `segment === "albums"` branch's `emptyDex ? <EmptyState…> :
  <AlbumGrid…>` ternary (`DexView.tsx:117-124`) with **always** rendering
  `<AlbumGrid dex={dex} albums={albums} onOpen={setOpenAlbumKey} />`.
  - `AlbumGrid` already renders every album and dims zero-catch cards to 40%
    opacity + grayscale (§B4, `AlbumGrid.tsx:77-81`) with no empty guard — so a
    fully-empty dex renders the entire shelf grayed out automatically. No new
    dimming code needed; verify the all-dimmed shelf looks right.
- This removes the Mark-attended CTA from Albums (it lived only in the empty
  branch). The Shows-segment CTA (`DexView.tsx:129`) stays as-is → CTA now
  Shows-only. ✓ both asks.

### Cleanup (avoid dead code / lint failures)

Removing the empty branch orphans several things — clean them up (project runs
tsc/eslint with unused checks):
- `const emptyDex = dex.completion.caught === 0;` (`DexView.tsx:88`) — now unused.
- The local `EmptyState` component + its `EmptyStateProps` interface
  (`DexView.tsx:177-` onward) — only used here.
- `config.copy.dex.emptyHeading` / `emptyBody` become unused (optional to remove;
  they're config keys, not locals, so they won't trip lint — leave or prune).
- Keep the `MarkCta` import (still used by Shows) and `archiveCopy`.

## Acceptance

- Fresh install / zero catches: GizzDex → Albums shows the complete album shelf,
  all covers dimmed (grayscale/40%), no empty-state text, no Mark-attended button.
- Tapping a dimmed album still drills into its detail (it's already the tap target).
- Shows toggle still has the Mark-attended CTA; Albums toggle never does.
- Header `0/{total} · 0%` still renders; typecheck + tests clean.

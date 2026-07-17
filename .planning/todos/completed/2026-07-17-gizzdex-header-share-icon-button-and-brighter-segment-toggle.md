---
created: 2026-07-17T03:57:56.330Z
title: GizzDex — share icon-button in header + brighter segment toggle
area: ui
status: done
resolved_by: quick task 260717-0x9 (commit ed96dd8)
resolved_date: 2026-07-17
files:
  - packages/app/src/dex/DexHeader.tsx:35-68
  - packages/app/src/dex/DexView.tsx:97-115
  - packages/app/src/dex/styles.css (accent token #f2c14e)
---

## Problem

Two UI-polish tweaks on the **GizzDex** page (the `dex` route / `DexView`):

1. The Share-card CTA is currently a full-width accent button pinned at the
   bottom of the header (`DexHeader.tsx:60-67`), which eats vertical space.
2. The Albums | Shows segment toggle's selected half is a dim accent wash
   (`bg-accent/20`), which reads muted — owner wants the brighter accent.

## Solution

### 1. Share button → icon button, upper-right (next to the %)

- In `DexHeader.tsx`, move the Share control into a **top row** alongside the
  completion headline `{caught}/{total} · {pct}%` (currently `DexHeader.tsx:38-40`).
  Make that row a `flex items-start justify-between`: headline block on the left,
  an **icon-only** Share button (`Share2` from lucide-react) top-right.
- Remove the full-width bottom CTA (`DexHeader.tsx:60-67`); keep the same
  `onShare` handler and the `ShareCardSheet` wiring in `DexView.tsx:93` unchanged.
- Accessibility: icon-only button MUST carry an `aria-label` (use the existing
  `config.copy.share.cta` text) and keep a ≥44px hit target — swap `min-h-11
  w-full` for `min-h-11 min-w-11`. Keep it as the reserved accent control
  (06-UI-SPEC §Color A, "reserved accent use #1") — e.g. accent icon or accent
  ring, still the only accent CTA on the dex face.

### 2. Brighter selected color on the Albums/Shows toggle

- `DexView.tsx:108`: active state is `bg-accent/20 text-text-primary`. Change to
  the **full brighter accent** — `bg-accent text-surface` (accent `#f2c14e` on
  dark `--color-surface` text = strong contrast). Inactive stays `text-text-muted`.
- Note: `--color-accent` (`styles.css`) is the warm gold/yellow `#f2c14e`. If the
  owner means a distinct hotter orange rather than the existing gold, add a new
  token rather than hardcoding a hex (single-config rule, CLAUDE.md) — confirm
  during the polish pass which they mean.

## Design note

Both changes lean harder on the accent color. `styles.css` comments still scope
accent to "Install / Refresh / focus ring ONLY", but 06-UI-SPEC §Color A already
sanctions the dex share CTA (use #1) and the active segment (use #4). Making the
segment a solid accent fill is a stronger use than the spec's tint — fine as an
owner override, just keep it consistent and update the token comment if the
reservation policy changes.

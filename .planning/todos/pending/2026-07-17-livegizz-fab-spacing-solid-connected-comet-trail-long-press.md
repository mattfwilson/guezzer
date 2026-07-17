---
created: 2026-07-17T05:24:00.611Z
title: LiveGizz tracking — FAB spacing, solid connected comet trail, long-press orb info
area: ui
files:
  - packages/app/src/show/FabMenu.tsx:72-76
  - packages/app/src/show/CometTrail.tsx:82-104
  - packages/app/src/show/PredictionOrb.tsx:103-112
  - packages/app/src/config.ts:55-57
---

## 1. Move the FAB down — symmetric spacing (gap-to-tabs == gap-to-right-edge)

The FAB's right gap is `env(safe-area-inset-right) + 16px` (`FabMenu.tsx:76`); its
bottom gap is much larger — `env(safe-area-inset-bottom) + 64px + [strip] + 8px`
(`FabMenu.tsx:72-75`). Owner wants the gap **above the tab bar to equal the right
gap (16px)**, so the FAB reads as evenly inset from both edges.

- Change `bottomOffset` to `calc(env(safe-area-inset-bottom) + 64px + 16px)` (tab
  bar height + the same 16px as the right inset); drop the `+8px` and the strip
  term.
- ⚠️ **Conflict with the SuggestionStrip** (just added in 260717-1k3): mid-show the
  strip reserves 56px directly above the tab bar. A FAB only 16px above the tab
  bar would sit **over** that strip and could cover a suggestion row's dismiss-X.
  Decide: (a) accept the overlap (strip is usually empty/transparent), (b) keep
  `stripReserved` in the offset only when the strip actually has content (not just
  reserved), or (c) owner accepts the FAB floating above the strip mid-show. Pick
  during implementation; the pre-opener case (no strip) is unambiguous — 16px.

## 2. Comet trail (under the date): solid, 50% smaller, connected line

`CometTrail.tsx` nodes (`:82-104`) are currently HOLLOW rings
(`rounded-full border-2 bg-surface`, colored `borderColor: RING_COLOR[outcome]`).

- **Solid colors:** fill the node with `RING_COLOR[outcome]` (drop `border-2` +
  `bg-surface`), so hit = solid green (`#22C55E`), miss = solid red (`#EF4444`).
- **50% smaller:** halve `config.show.TRAIL_NODE_MIN_DIAMETER` 24 → 12 and
  `TRAIL_NODE_MAX_DIAMETER` 40 → 20 (`config.ts:55-57`). The tap target stays
  ≥44px — the wrapper button is `min-h-11 min-w-11`, only the visual dot shrinks.
- **Connect with a line (chronological path):** draw a thin connector between
  adjacent nodes so the trail reads as one left→right timeline. ⚠️ Layout note:
  nodes are `items-end` (bottom-aligned) and **diminishing** in size, so their
  centers sit at different heights — a straight horizontal line through centers
  would slant. Options: switch the row to `items-center` and draw a horizontal
  hairline through the centers (cleanest), or render short connector segments
  between adjacent node edges, or an absolutely-positioned baseline behind the
  row. Keep the diminishing sizes unless the owner wants uniform. The "+N"
  compression chip + the song-name labels stay.

## 3. Prediction orb info: long-press instead of tapping the (i)

Today each `PredictionOrb` has a separate `Info` (i) dot button (`:105-112`) whose
tap fires `onWhy` (the info sheet); the face tap fires `onTap` (log a hit, D-11).
Owner wants: **long-press the orb → info sheet**, replacing the (i)-dot tap.

- On the face button, add pointer handling: `pointerdown` starts a timer
  (~450-500ms); if it fires before `pointerup` → call `onWhy` and mark the gesture
  consumed so the following tap does NOT also log (`onTap`); a normal quick tap
  still logs. Cancel the timer on `pointerup`/`pointerleave`/`pointercancel`/move.
- Remove (or hide) the (i) dot since long-press replaces it.
- Suppress the native long-press side effects on the orb: iOS callout
  (`-webkit-touch-callout: none`), text selection (already `select-none`), and the
  context menu (`onContextMenu` preventDefault). Keep `touch-manipulation`.
- ⚠️ **Accessibility regression to weigh:** the (i) dot is a real, keyboard/AT-
  reachable button with `aria-label="Why {song}?"`. Long-press has **no keyboard
  or screen-reader equivalent** (WCAG 2.5.1/2.1.1). Recommend either keeping a
  small accessible affordance (e.g. the (i) still present but visually minimal, or
  a long-press + an a11y-only control) OR the owner explicitly accepts the
  regression for this personal tool. Also flag **discoverability** — long-press is
  a hidden gesture; and tune the threshold so a deliberate-but-slow log tap
  doesn't accidentally open info.

## Acceptance

- FAB inset 16px from the right and 16px above the tab bar (strip conflict
  resolved). Comet-trail nodes solid-filled, ~50% smaller, visibly connected as a
  timeline, tap targets still ≥44px. Long-pressing a prediction orb opens its info
  sheet without logging; a quick tap still logs; native callout/menu suppressed;
  a11y decision made. Typecheck + tests + a device look pass.

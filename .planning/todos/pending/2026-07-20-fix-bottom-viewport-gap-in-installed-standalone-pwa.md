---
created: 2026-07-20T01:09:29.536Z
title: Fix bottom viewport gap in installed standalone PWA
area: ui
files:
  - packages/app/src/components/AppShell.tsx:28-60
  - packages/app/src/styles.css:16-19
  - packages/app/src/styles.css:188
  - packages/app/index.html:6-7
---

## Problem

When the app is launched from the **home-screen icon (installed / standalone display mode)** — not a Safari tab — there is **extra empty space at the bottom of the main body area** (the tracking-orb / OrbitStage view, the constellation, and the Gizzdex). Owner (device-tested on iPhone, 2026-07-20) believes it comes from there being no browser URL/address bar in standalone mode, so the layout appears sized for the shorter "address-bar-present" viewport and leaves a gap in the taller standalone viewport.

Desired behavior (owner's words): the UI should **dynamically account for the maximum screen size the viewport could be — with or without the URL bar — and adjust accordingly**, so no dead space appears at the bottom in either mode.

**Important existing constraint (do not naively "fix" with `100vh`):** the current sizing is deliberate. `AppShell.tsx:28-36` documents that the root is `h-full` ONLY (never `min-h-screen`/`100vh`), grounded to the `html, body, #root { height: 100% }` chain in `styles.css:16-19`, specifically to dodge the iOS trap where `100vh` = the LARGE (toolbar-hidden) viewport and creates a phantom overflow (that caused a real "start-show-not-clickable" bug — see debug history). Any fix MUST preserve that: it must not reintroduce `100vh`/`min-h-screen`, and must keep the OrbitStage non-scrolling and tap targets correct. Also note `styles.css:188` keeps `padding-bottom: env(safe-area-inset-bottom)` (home-indicator gap) and `index.html:6-7` uses `viewport-fit=cover` — factor both into whatever is measured.

## Solution

TBD — investigate first. Reproduce in standalone mode on a notched iPhone (home-screen icon), compare against the same view in a Safari tab, and confirm where the gap originates before changing anything. Candidate directions to evaluate (do not assume):
- Whether the `height: 100%` chain is broken by an intermediate element that lacks full height, so a `flex-1` child doesn't stretch to fill the standalone viewport.
- Dynamic viewport units (`100dvh`/`svh`/`lvh`) or a JS-measured `--vh` custom property that tracks the *actual* visual viewport (`window.visualViewport`) across the with/without-URL-bar transition — weighed against the documented `100vh` iOS trap above.
- Whether `env(safe-area-inset-bottom)` (home indicator) is being double-counted or interacting with the standalone bottom gap.
- Whether the gap is per-view (OrbitStage vs constellation vs Gizzdex all use the same `flex-1` container, or diverge).

This is a UI/viewport-units polish item, sibling in spirit to the Phase 13 UX-01 safe-area work but on the **bottom** axis and about **height-fill in standalone mode** rather than top inset. Likely a candidate for a future UI-polish phase/milestone.

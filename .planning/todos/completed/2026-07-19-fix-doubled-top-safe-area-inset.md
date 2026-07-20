---
created: 2026-07-19T04:48:04.422Z
title: "Fix doubled top safe-area inset on notched iPhones (installed PWA)"
area: bug
resolves_phase: 13
files:
  - packages/app/src/styles.css:186-190
  - packages/app/src/components/AppShell.tsx:41
---

## Problem

**Severity: MEDIUM-LOW (visual, iOS standalone only). Found in 2026-07-19 bug-hunt review.**

Top safe-area inset is applied twice: `body { padding-top: env(safe-area-inset-top) }` in styles.css AND the AppShell header adds `calc(env(safe-area-inset-top) + 12px)` again. In standalone mode with `viewport-fit=cover` on a notched iPhone that's a doubled ~50px dead band at the top.

Also: fixed-position overlays (SearchSheet, ArchiveBrowser, RecapView) escape body padding, so their headers sit one inset *higher* than the main header — inconsistent header heights between the shell and overlays.

## Solution

Apply the inset in exactly one place. Likely: drop the body padding and keep the per-surface `env()` calc (fixed overlays already need their own), or vice versa — audit all fixed-position surfaces for consistency. Verify on a real notched iPhone in installed-PWA mode (cloudflared tunnel per device-UAT memory).

Run via /gsd-quick.

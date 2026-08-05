---
created: 2026-08-05T04:23:44.604Z
title: Add apple-mobile-web-app-capable so iOS installs are deterministic
area: ui
files:
  - packages/app/index.html:5-11
---

## Problem

iOS "Add to Home Screen" can silently create a plain **Safari bookmark** instead of a
standalone web app when the manifest hasn't finished parsing at add-time. The two are
indistinguishable on the home screen — same icon, same title — but a bookmark launch opens
with browser chrome and reports:

```
sab: 0
standalone: nav=false mq=false
innerH: 714    (vs ~874 in true standalone on iPhone 16 Pro)
```

`env(safe-area-inset-bottom)` is `0` in that context, which makes the **entire
FOUND-01/FOUND-02 bottom-space bug class unobservable by construction** — the inset that
would be double-counted is zero, so the defect can neither reproduce nor be ruled out.

**This cost a full Phase-21 device UAT session (2026-08-04/05.)** Tests 2, 4, 8 and the
NAV-01 re-check were all run in a Safari tab, produced a convincing-looking "gap between
BackupToast and the tab bar", and had to be discarded and re-run. The apparent gap was an
iOS Safari dynamic-viewport artifact: on scroll the toolbar collapses, the layout viewport
grows, and fixed-bottom elements anchor below the visible glass. Two screenshots were
diagnosed before `?layoutProbe=1` settled it.

Current state of `index.html` (unchanged since `d39497b`, phase 18):

- has `viewport-fit=cover` (line 7) ✓
- has `apple-mobile-web-app-status-bar-style` (line 10) ✓
- has **never** had `apple-mobile-web-app-capable` — verified via `git log -S`

This is **not** a hard bug: iOS 16.4+ does honor manifest `display: standalone`, and Phase-21
session 1 measured `sab: 34` with this exact file. It is belt-and-braces determinism —
it removes the race that lets an install degrade to bookmark mode.

## Solution

Add one line to `packages/app/index.html` beside the existing Apple meta tags:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
```

`/gsd-quick` sized. No test changes expected; verify by deleting the home-screen icon,
re-adding from a cold tunnel URL, and confirming `?layoutProbe=1` reports `sab: 34` and
`standalone: nav=true mq=true`.

**Pre-show priority.** Every remaining device UAT — the Phase-21 close-out, Phase 22's
chrome mechanism, Phase 23's in-show overlays — depends on a deterministic install. A
session lost to bookmark-mode ambiguity is a session not spent on polish before Aug 2026.

Related: [[2026-07-20-fix-bottom-viewport-gap-in-installed-standalone-pwa]] is the FOUND-01
gap itself (`resolves_phase: 21`) — a different subject; this todo is about the install
context being trustworthy in the first place.

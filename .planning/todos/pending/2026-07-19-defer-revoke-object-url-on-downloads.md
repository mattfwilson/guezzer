---
created: 2026-07-19T04:48:04.422Z
title: "Defer revokeObjectURL after download/share clicks (iOS Safari footgun)"
area: bug
files:
  - packages/app/src/settings/exportDownload.ts:50-61
  - packages/app/src/dex/shareCard.ts:274-288
---

## Problem

**Severity: LOW likelihood, HIGH stakes. Found in 2026-07-19 bug-hunt review.**

Both the backup-export download path and the share-card download fallback call `URL.revokeObjectURL` synchronously in the same tick as `anchor.click()`. Same-tick revoke is a known iOS Safari footgun that can silently abort the download — on the project's primary platform (iOS PWA) and its primary data-safety path (the backup file that is the stated iOS-eviction backstop). A silently-failed backup download is the worst version of this bug because the user believes they're protected.

## Solution

Defer the revoke — e.g. `setTimeout(() => URL.revokeObjectURL(url), 1000)` — in both `exportDownload.ts` and `shareCard.ts`. Verify a real download completes on iOS Safari (cloudflared tunnel per device-UAT memory).

Run via /gsd-quick.

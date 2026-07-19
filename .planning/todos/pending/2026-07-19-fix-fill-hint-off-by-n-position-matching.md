---
created: 2026-07-19T04:48:04.422Z
title: "Fix fill-hint off-by-N position matching after missed/deleted songs"
area: bug
files:
  - packages/core/src/live/suggest.ts:105-122
---

## Problem

**Severity: LOW (but one-tap applies wrong data). Found in 2026-07-19 bug-hunt review.**

`resolvePlaceholders` matches the user's trail `position` to the editor's global row position. The two numberings diverge as soon as the user skips an unlogged song or deletes an entry (position gaps are by design — `logSong` uses monotonic max+1 and survives mid-trail deletes). After the first divergence, a `???` fill-hint can confidently name the wrong (off-by-N) song, and one tap applies it via rename.

## Solution

Match placeholders by alignment rather than raw position — e.g. anchor on the nearest surrounding songs the user *did* log (which exist in the editor rows) and resolve the placeholder to the editor row between them; or at minimum only offer a fill-hint when the neighborhood around the placeholder aligns with the editor sequence. Depends on the wrong-show date-guard fix landing first (see "Fix wrong-show editor suggestions").

Run via /gsd-quick.

---
created: 2026-07-19T04:48:04.422Z
title: "Fix same-date doubleheader collapse in merge + dex derivation"
area: bug
resolves_phase: 12
files:
  - packages/core/src/data-safety/merge.ts:57-59
  - packages/core/src/data-safety/merge.ts:174-269
  - packages/core/src/dex/derive-dex.ts:71-73
  - packages/core/src/dex/derive-dex.ts:140-144
---

## Problem

**Severity: MEDIUM. Found in 2026-07-19 bug-hunt review.**

Unbound tracked shows are grouped by `date` alone in both merge and dex derivation. KGLW plays real early/late doubleheaders (the corpus itself carries `showOrder` precisely for same-date shows), but two unbound sessions on one date are:

- (a) counted as ONE attendance in `deriveDex`, and
- (b) actively collapsed by any backup import — `merge.ts` keeps only the canonical show row and re-stamps the other's entries onto it, **permanently dropping the second `trackedShows` row**.

If both shows bound live (online) they get distinct `showId`s and survive; tracked offline, one is lost on the next import.

Related edge (same root cause): an unbound tracked night whose device-local `date` differs from the kglw `showdate` (show tracked past midnight) defeats the ArchiveBrowser's already-marked guard and double-counts the night in `deriveDex`.

## Solution

Include `showOrder` (or the session's own unique id) in the grouping key for unbound shows in both `merge.ts` and `derive-dex.ts`, so same-date sessions stay distinct. For the midnight edge, consider normalizing the session date to the kglw `showdate` at bind time, or matching the already-marked guard on showId when available rather than date.

Run via /gsd-quick.

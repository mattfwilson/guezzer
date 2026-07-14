---
quick_id: 260713-wjd
status: complete
commit: see list below
date: 2026-07-14
---

# Quick Task 260713-wjd: ?mockLatest=1 UAT harness for the suggestion strip

## What changed

- `packages/app/src/live/mockLatest.ts` (new) — `getMockLatestFetch()`
  returns a fixture-serving fetch stub ONLY when `?mockLatest=1` is in the
  URL; otherwise null (normal loads byte-identical). Fixture: four real
  catalog songs (Rattlesnake 168, Robot Stop 172, Gaia 81, Mars for the Rich
  133), full 36-key latest row shape, artist_id 1, dated today (local) so
  the D-07 auto-bind can fire.
- `packages/app/src/live/useLatestPoll.ts` — uses the mock fetch when
  present and arms the first tick at ~2s instead of the 60s floor. All
  downstream behavior (zod validation, artist gate, dedupe diff, strip,
  adopt/dismiss) runs the REAL code path; only the network fetch is stubbed.
- `packages/app/test/mockLatest.test.ts` (new) — asserts the flag is inert
  when absent, and that the fixture passes the real `pollLatest` pipeline
  (schema + artist gate) — the fixture can't silently drift from the schema.

## Why

Phase-5 UAT Test 2 (suggestion strip) was only testable during a real
live-logged kglw.net show, or via DevTools response overrides + 60s waits
(impossible on-device from Windows). The flag enables real-thumb on-device
UAT and automated browser verification.

## Payoff (same session)

Driving the harness with Playwright immediately executed UAT Test 2
end-to-end (12 substantive checks) AND exposed a real defect: dismissed
suggestions permanently occupied the strip's 2 slots (dismissed-filter ran
AFTER truncation), emptying the strip despite queued editor songs. Fixed in
core (`diffLatestAgainstTrail` `excludeSongIds` param, applied before slot
fill) + ShowView passes `dismissedIds` in; 3 core regression tests added.

## Verification

- `npm test` — 286/286 pass (39 files)
- `tsc --noEmit` clean in both packages; `vite build` succeeds
- Playwright drive against the built app: adopt/dismiss/swipe/layout checks
  pass; screenshots reviewed

## Commits

- `feat(quick-260713-wjd)`: mockLatest harness + poll wiring + schema test
- `fix(05)`: dismissed suggestions free their strip slot (found by this harness)

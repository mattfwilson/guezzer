---
quick_id: 260713-wjd
type: quick
autonomous: true
files_modified:
  - packages/app/src/live/mockLatest.ts
  - packages/app/src/live/useLatestPoll.ts
  - packages/app/test/mockLatest.test.ts
---

<objective>
Testing the SuggestionStrip (Phase-5 UAT item 2) currently requires DevTools
response overrides against the live kglw.net endpoint plus 60s poll waits —
impractical, and impossible on-device from Windows. Add a `?mockLatest=1` URL
flag: when present, the latest-poll pipeline uses an injected fetch that
returns four fixture rows (real catalog song ids), and the first tick fires in
~2s instead of 60s. Everything downstream — zod validation, artist_id filter,
dedupe diff, strip rendering, adopt/dismiss — runs the REAL code path; only
the network fetch is stubbed. Enables real-thumb UAT on the phone and
automated browser verification.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: mockLatest module + poll wiring + schema-compliance test</name>
  <files>packages/app/src/live/mockLatest.ts, packages/app/src/live/useLatestPoll.ts, packages/app/test/mockLatest.test.ts</files>
  <action>
    New mockLatest.ts: getMockLatestFetch() returns null unless
    location.search has mockLatest=1; otherwise returns a fetch stub yielding
    a valid latest envelope with 4 artist_id:1 rows (Rattlesnake 168, Robot
    Stop 172, Gaia 81, Mars for the Rich 133) dated today (local) so auto-bind
    can fire. useLatestPoll: use the mock fetch when present and arm the first
    tick at ~2s instead of POLL_INTERVAL_MS. Test: without the flag → null;
    with the flag (history.replaceState) → pollLatest({fetch: mock}) returns
    all 4 rows, proving the fixture passes the real zod schema + artist gate.
  </action>
  <verify>npm test passes; tsc --noEmit clean; vite build succeeds</verify>
  <done>Opening any route with ?mockLatest=1 populates the SuggestionStrip within seconds during an active show; without the flag, behavior is byte-identical to before.</done>
</task>

</tasks>

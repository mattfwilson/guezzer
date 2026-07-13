---
phase: 04-show-mode
audited: 2026-07-13
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
threats_total: 18
threats_closed: 18
threats_open: 0
result: secured
---

# SECURITY — Phase 04 (Show Mode)

**Audited:** 2026-07-13
**ASVS Level:** 1
**block_on:** high
**Register authored at plan time:** yes (verification-only audit; no new-threat scan)
**Result:** SECURED — 18/18 threats closed (16 mitigate verified in code, 2 accept documented below)

Scope note: Personal offline-first PWA, no backend, no accounts, no network in
Phase 4 (live sync is Phase 5). Dominant real risks per brief — XSS via
kglw-derived song names and mid-show crash/DoS (Wake Lock silent failure) — are
both verified closed. Prior code review (04-REVIEW.md) BLOCKER CR-01 and
warnings WR-01/WR-02/WR-03 were verified fixed in the current implementation.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-04-01 | Tampering | mitigate | CLOSED | `packages/app/src/db/db.ts:111-123` — `version(1)` stores block untouched; `version(2)` is additive (`trackedShows`/`trackedEntries` only). Comment + code confirm meta/attendedShows carry forward unrewritten. |
| T-04-02 | DoS (quota) | accept | CLOSED | Accepted risk — see log below. |
| T-04-03 | Repudiation | accept | CLOSED | Accepted risk — see log below. |
| T-04-04 | DoS | mitigate | CLOSED | `packages/core/src/search/search-catalog.ts:60-67` — empty/whitespace query short-circuits to `[]`; fuse.js over in-memory 264 nodes; no regex/network. Pure core (imports only `fuse.js` + config). |
| T-04-SC | Tampering (supply chain) | mitigate | CLOSED | `packages/core/package.json:10` exact `"fuse.js": "7.4.2"`; `package-lock.json:4499-4502` version 7.4.2 with sha512 integrity + resolved URL. |
| T-04-05 | Tampering (XSS) | mitigate | CLOSED | Names/reason render as JSX text: `PredictionOrb.tsx:76`, `CenterNode.tsx:37`, `WhyDetail.tsx:35`. Global grep: zero `dangerouslySetInnerHTML`/`innerHTML`/`eval` in `packages/app/src` (matches are comments only). |
| T-04-06 | DoS (crash) | mitigate | CLOSED | `packages/app/src/show/matrix.ts:39-45` — `matrix.schemaVersion !== 1` returns handled `{ok:false}` sentinel; no unguarded read. |
| T-04-07 | Tampering | mitigate | CLOSED | `packages/app/src/show/confidence.ts:19-22` — `formatOrbPercent` formats absolute `score*100`, no fan-sum renormalization. |
| T-04-08 | Tampering | mitigate | CLOSED | `packages/app/src/routing/useHashRoute.ts:9-19` — hash validated against fixed `ROUTES` allow-list, normalizes unknown to `show`; only selects a view, never innerHTML/eval. |
| T-04-09 | DoS (crash) | mitigate | CLOSED | `packages/app/src/show/useShowSession.ts:108,148` — `currentSongId === null \|\| !result.ok` gate returns empty fan; core never receives null; `matrixOk` surfaces load-failure state. |
| T-04-10 | Repudiation / data loss | mitigate | CLOSED | `packages/app/src/db/db.ts:192-216` — `logSong` awaits the Dexie transaction (`add`) before resolving; `ShowView.tsx:16-17,122` write-through drives recenter via `useLiveQuery` after commit. Position now derived from max (CR-01 fix). |
| T-04-11 | DoS | mitigate | CLOSED | `packages/app/src/show/SearchSheet.tsx:53-61` — query goes only to memoized core `makeCatalogSearcher`; bounded to catalog, no regex/DOM/network sink. |
| T-04-12 | Tampering (XSS) | mitigate | CLOSED | `packages/app/src/show/SearchSheet.tsx:125` — result rows render `{result.songName}` as React text; no dangerouslySetInnerHTML. |
| T-04-13 | Tampering | mitigate | CLOSED | `packages/app/src/db/db.ts:43,213,231-237` — `setNumber` snapshotted from `show.currentSetNumber` (closed `"1"\|"2"\|"e"` union set via markSetBreak/markEncore); never inferred from transition_id. `showContext.ts` does not touch setNumber. |
| T-04-14 | Tampering (XSS) | mitigate | CLOSED | `packages/app/src/show/CometTrail.tsx:100,163` and `TrailNodeSheet.tsx:122` — captions render `{entry.songName}` as React text; no dangerouslySetInnerHTML. |
| T-04-15 | Repudiation / data loss | mitigate | CLOSED | `packages/app/src/show/TrailNodeSheet.tsx:36,139,95-118` — delete requires explicit `confirmingDelete` destructive confirm; `db.ts:219-228` `undoLast` bounded to max-position entry only (`.at(-1)`). |
| T-04-16 | DoS (mid-show failure) | mitigate | CLOSED | `packages/app/src/wakeLock.ts:44-66` — feature-detect AND verify `sentinel.released` (iOS <18.4 false-positive); try/catch never throws; `onUnsupported()` fallback so loop never bricks. |
| T-04-17 | DoS (accidental gesture) | mitigate | CLOSED | `packages/app/src/styles.css:29-39` — declarative `touch-action: manipulation`, `overscroll-behavior: none`, `user-select: none` on the non-scrolling stage. |
| T-04-18 | Repudiation / data loss | mitigate | CLOSED | `packages/app/src/show/EndShowDialog.tsx:29-33` — explicit confirm before `endShow`; `db.ts:272-274` flips to `finalized`; Show Mode only reads `status: "active"` (`useShowSession.ts:60-61`), so finalized shows are effectively read-only. |

## Accepted Risks Log

### T-04-02 — DoS: IndexedDB quota exhaustion (accept)
Per-show data is tiny (one `TrackedShow` row + one small `TrackedEntry` per song,
~20–40 rows/night). `navigator.storage.persist()` is requested in Phase 3 to
reduce iOS Safari eviction; the JSON export backstop lands in Phase 5. For a
personal tool with <10 users and no adversarial input, quota exhaustion is not a
credible in-scope threat. Accepted.

### T-04-03 — Repudiation: crypto.randomUUID sessionId (accept)
`sessionId` (`packages/app/src/db/db.ts:170`) is a local, non-security identifier
— it keys a provisional attendance/setlist record on-device only. There is no
auth session, no server, and no multi-party trust boundary to repudiate against.
Accepted.

## Unregistered Flags

None. No `## Threat Flags` section is present in any Phase 04 `*-SUMMARY.md`.

## Notes on Prior Review (04-REVIEW.md)

- **CR-01 (BLOCKER)** — verified FIXED: `logSong` derives `nextPosition` from
  max existing position, not `count + 1` (`db.ts:204-208`), preventing duplicate
  positions after a mid-trail delete. Directly supports T-04-10.
- **WR-01** — verified FIXED: edit path re-classifies outcome via
  `classifyOutcome` against the stored fan (`TrailNodeSheet.tsx:54-60`;
  `renameEntry` persists `outcome`, `db.ts:257-269`). Supports tally honesty.
- **WR-02 / WR-03** — UI/a11y and once-per-show notice fixes; not threat-register
  items. Not re-audited here beyond confirming no security regression.

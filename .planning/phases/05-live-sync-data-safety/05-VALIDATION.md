---
phase: 5
slug: live-sync-data-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture. Task IDs (`5-NN-NN`)
> are filled in during planning; the requirement→test map below is authoritative.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`projects`: core=`node`, app=`jsdom`) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run <file>` (or `npx vitest run <file>`) |
| **Full suite command** | `pnpm vitest run` |
| **IndexedDB in tests** | `fake-indexeddb/auto` (already imported in `packages/app/test/setup.ts`) |
| **Estimated runtime** | ~10–20 seconds (full suite, core + app) |

*Framework install: none needed — Vitest + fake-indexeddb already present. No new dependencies this phase.*

---

## Sampling Rate

- **After every task commit:** Run the specific new test file(s) for that task (e.g. `pnpm vitest run packages/core/test/merge.test.ts`)
- **After every plan wave:** Run `pnpm vitest run` (full suite — core + app)
- **Before `/gsd-verify-work`:** Full suite green, PLUS the on-device gate (iOS installed PWA: real `latest` poll, offline flap, End-Show auto-download, import round-trip)
- **Max feedback latency:** ~20 seconds (full suite)

---

## Per-Requirement Verification Map

*Task IDs assigned at planning; rows below map each requirement/behavior to its automated proof.*

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| SYNC-01 | New `latestSetlistRow` schema accepts a real `latest` row missing the 5 keys (`css_class`, `isrecommended`, `tracktime`, `timezone`, `showtime`); rejects unknown keys | unit (node) | `vitest run packages/core/test/latest-types.test.ts` | ❌ W0 |
| SYNC-01 | `pollLatest` sends User-Agent, validates rows, enforces `assertFilterApplied(artist_id===1)`, returns `[]` (not throw) on failure (tolerant D-06) | unit (node, injected `fetch`) | `vitest run packages/core/test/poll-latest.test.ts` | ❌ W0 |
| SYNC-01 | Poll loop schedules ≤ 1/60s, single timer, clears on unmount | unit (jsdom, fake timers) | `vitest run packages/app/test/useLatestPoll.test.tsx` | ❌ W0 |
| SYNC-01 / D-07 | `bindShowFromLatest` returns null unless `showdate===today` (wrong-show guard); never overwrites an already-bound `showId` | unit (node) | `vitest run packages/core/test/bind-show.test.ts` | ❌ W0 |
| SYNC-02 | `diffLatestAgainstTrail` dedupes by `song_id`, returns only next 1–2 un-logged, never contradicts logged songs | unit (node) | `vitest run packages/core/test/suggest.test.ts` | ❌ W0 |
| SYNC-02 | Adopt writes `logSong(..., source:'editor')` and reclassifies hit/miss against `shownFanSongIds` | integration (jsdom + fake-idb) | `vitest run packages/app/test/adopt.test.tsx` | ❌ W0 |
| SYNC-02 / D-04 | `resolvePlaceholders` surfaces a fill hint only where trail entry `isPlaceholder` and `latest` has a song at that position | unit (node) | `vitest run packages/core/test/suggest.test.ts` | ❌ W0 |
| SYNC-03 | Poll loop pauses when `navigator.onLine===false` / document hidden; resumes on `online` + visible | unit (jsdom) | `vitest run packages/app/test/useLatestPoll.test.tsx` | ❌ W0 |
| PWA-04 | `serializeExport` produces the D-09 shape with `schemaVersion` | unit (node) | `vitest run packages/core/test/serialize.test.ts` | ❌ W0 |
| PWA-04 / D-10,D-11 | `parseAndMergeImport` union-merges, never drops local rows, dedupes same-show across sessionIds | unit (node) | `vitest run packages/core/test/merge.test.ts` | ❌ W0 |
| PWA-04 / D-12 | Import rejects malformed/corrupt JSON with a clear message, no DB mutation | unit (node) + integration | `vitest run packages/core/test/merge.test.ts` | ❌ W0 |
| PWA-04 | Export→import round-trip through Dexie preserves all data (lose-a-phone) | integration (jsdom + fake-idb) | `vitest run packages/app/test/exportImportRoundtrip.test.ts` | ❌ W0 |
| PWA-04 / D-03 | `version(3)` migration is additive; existing entries backfill `source:'manual'`; v1/v2 data survives | integration (fake-idb) | `vitest run packages/app/test/migrationV3.test.ts` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · W0 = created in Wave 0*

---

## Wave 0 Requirements

- [ ] `data/samples/latest.sample.json` — committed fixture from ONE real polite fetch (unblocks the schema — Open Question A1; must precede `latest-types.test.ts`)
- [ ] `packages/core/test/latest-types.test.ts` — new `latest` schema (SYNC-01)
- [ ] `packages/core/test/poll-latest.test.ts` — tolerant poller with injected `fetch` (SYNC-01)
- [ ] `packages/core/test/suggest.test.ts` — dedupe + placeholder resolution (SYNC-02)
- [ ] `packages/core/test/bind-show.test.ts` — wrong-show guard (SYNC-01 / D-07)
- [ ] `packages/core/test/serialize.test.ts` + `merge.test.ts` — export/import (PWA-04)
- [ ] `packages/app/test/useLatestPoll.test.tsx` — timer/lifecycle/offline gating (Vitest fake timers)
- [ ] `packages/app/test/adopt.test.tsx` — adopt write-through + hit/miss reclassification (SYNC-02)
- [ ] `packages/app/test/migrationV3.test.ts` — additive migration + backfill (fake-indexeddb)
- [ ] `packages/app/test/exportImportRoundtrip.test.ts` — full round-trip through Dexie (PWA-04)
- [ ] Config additions (`config.live.POLL_INTERVAL_MS`, `POLL_MAX_INTERVAL_MS`, `SUGGESTION_COUNT`, export `SCHEMA_VERSION`) + copy strings in `packages/app/src/config.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `latest` poll against live kglw.net during/near a show | SYNC-01 | Requires the live volunteer API + a real active show; not mockable end-to-end | On an installed iOS PWA, start a show, confirm exactly one poll ≤1/60s (Network tab / logging), correct User-Agent |
| Offline flap (airplane mode toggle) shows calm offline indicator + silent resume | SYNC-03 | Depends on real OS network transitions + Safari behavior | Installed PWA: toggle airplane mode mid-show; sync dot flips to offline + reassurance; polling resumes silently on reconnect; tracking stays functional throughout |
| Auto-download of export JSON at End Show | PWA-04 / D-13 | Depends on real Safari download UX + `navigator.storage.persist()` prompt | End a tracked show on device; confirm JSON auto-downloads; confirm one-time warning appears if persist was denied |
| iOS Safari IndexedDB eviction resilience via export backstop | PWA-04 | Eviction is environmental and not deterministically reproducible | Export → simulate data loss → import; confirm dex fully restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (including the `latest.sample.json` fixture gate)
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

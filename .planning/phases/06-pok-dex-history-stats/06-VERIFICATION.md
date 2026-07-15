---
phase: 06-pok-dex-history-stats
verified: 2026-07-15T00:10:00Z
status: human_needed
score: 5/5 must-have truths verified (automated); UI/device confirmation pending
overrides_applied: 0
warnings:
  - concern: "CR-01 (from 06-REVIEW.md): same-show dedupe in merge.ts drops non-canonical sessions' unique entries instead of unioning them"
    affects: "SHAR-01 / DEX-02 multi-device self-merge of the SAME night with divergent live-tracked setlists"
    honest_derivation_impact: "Partial — derived counts remain honest/never hand-tallied, but a multi-device merge of the same night can UNDER-count live-tracked sightings (drops real songs). Retro-marked and archive-fallback sightings union correctly and are unaffected."
    severity: warning
    note: "Already flagged as a blocker in 06-REVIEW.md (separate track). Not fixed here per instructions. Does not falsify the phase's core honest-derivation promise but should be resolved before relying on multi-device merge."
human_verification:
  - test: "Open #/dex on a phone in a dark room; drill into an album"
    expected: "Album drill-in is readable in the dark; dimmed (unseen) rows are legible; tier/Debut badges are readable without relying on color"
    why_human: "Visual legibility, contrast, and one-thumb readability cannot be verified by grep"
  - test: "On device, mark a real past show from the archive browser"
    expected: "Dex header counts jump instantly; '+N songs caught' flashes; airplane-mode archive browse still works fully offline"
    why_human: "Live reactive UI update + offline behavior needs a running device"
  - test: "End a real tracked show on device"
    expected: "The recap appears immediately after the backup download, still within the venue flow (not orphaned)"
    why_human: "Real-time end-show flow and transition timing needs device testing"
  - test: "Tap Share card on an iPhone, then on desktop"
    expected: "Real navigator.share sheet opens on iPhone with the 1080x1350 PNG attached; anchor-download fallback works on desktop; the card renders correctly"
    why_human: "navigator.share is unavailable in jsdom; PNG visual quality and iOS transient-activation behavior need real devices"
  - test: "View the album shelf grid on device"
    expected: "Covers render crisply at ~80px; the shelf reads as a coherent discography"
    why_human: "Image rendering quality at physical size is visual-only"
  - test: "Import a friend's exported dex file (different owner name)"
    expected: "Read-only CompareView opens with You vs {name} columns + diff lists; NOTHING is written to the DB; no adopt/merge affordance exists"
    why_human: "End-to-end file-picker + fork behavior and the visual compare layout need manual confirmation"
---

# Phase 6: Pokédex, History & Stats Verification Report

**Phase Goal:** The user's live-show history becomes a browsable collection — every sighting count derived from attendance, every stat honest about sparse data, and the whole dex shareable with friends.
**Verified:** 2026-07-15T00:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** mvp (goal is a descriptive success-criteria goal, not strict User Story format; verified goal-backward against the 5 ROADMAP success criteria + 11 requirement IDs)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pokédex shows completion %, per-song sighting counts derived from attendance (never hand-tallied), rarest catch, never-seen list | ✓ VERIFIED (code); UI needs human | `DexView.tsx` → `useDexStats()` → `useMemo(deriveDex)` over `useLiveQuery` table reads (no stored counts); `derive-dex.ts` (9.7 KB) computes completion %, sighting counts, rarest catch, never-seen purely from attendance + archive. 10 fixture tests pass. |
| 2 | User can retroactively mark attended shows from the full archive, searchable by date/venue, keyed by stable show ID | ✓ VERIFIED (code); device needs human | `ArchiveBrowser.tsx` (16 KB) with year sections + `makeArchiveSearcher` (fuse.js) over the bundled 738-show `archive.json`; `markShowAttended` keyed by `show_id` (`&show_id` Dexie index). Online fallback via `fetchRecentShows`. |
| 3 | Song detail shows gap, play count, last-played; personal gap in dex; no-history songs framed as "debut candidates" not fake percentages | ✓ VERIFIED | `WhyDetail.tsx` renders corpus gap/play count/last-played (STAT-01); `TierBadge.tsx` renders neutral "Debut" state (not a tier/percentage); `derive-dex.ts:239` excludes `!inMatrix` debut candidates from completion denominators (STAT-04). |
| 4 | Recap shows hit/miss tally, final setlist with set structure, rarity score; past tracked shows remain viewable | ✓ VERIFIED (code); flow needs human | `RecapView.tsx` (11.6 KB) → `deriveRecap`; auto-opened via `recapSessionId` set by `EndShowDialog.onEnded`, rendered BEFORE the `!session.active` early return; `SetlistView.tsx` renders Set 1/Set 2/Encore structure (HIST-01); `ShowsList.tsx` unifies tracked + retro newest-first, deduped. |
| 5 | Dex exports/imports as JSON for friend exchange; user can generate a shareable summary card | ✓ VERIFIED (code) ⚠️ merge caveat; device needs human | Friend path: `importPicker.ts` forks on `envelope.owner` → read-only `CompareView.tsx` (runs `deriveDex` a 2nd time, zero DB writes). Share card: `shareCard.ts` builds 1080×1350 PNG from `buildShareStats`, `canShare`-gated `navigator.share` + anchor-download fallback. ⚠️ Self-merge path carries CR-01 (see Warnings). |

**Score:** 5/5 truths verified at code level. Status is `human_needed` because visual/device/real-time behaviors (dark-mode legibility, live reactive updates, navigator.share, PNG quality, offline browse) cannot be confirmed programmatically.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/normalized/archive.json` | schemaVersion 1, latestShowDate, songId→name map, 738 shows w/ id/date/venue/city/sets | ✓ VERIFIED | schemaVersion 1, latestShowDate 2025-12-13, 264 songs, 738 shows, sample keys id,date,venue,city,state,country,sets |
| `data/normalized/dex-albums.json` | ~25-30 studio cards + Covers/Misc buckets, all 264 songs mapped once | ✓ VERIFIED | schemaVersion 1, 29 album cards + buckets |
| `packages/core/src/dex/derive-dex.ts` | `deriveDex` single derivation entry point | ✓ VERIFIED | 9.7 KB, exported from index.ts, pure (no React/DOM) |
| `packages/core/src/dex/rarity.ts` | `buildRarityIndex` + `showRarityScore` | ✓ VERIFIED | 4.8 KB, exported |
| `packages/core/src/dex/recap.ts` | `deriveRecap` → RecapStats | ✓ VERIFIED | 6.0 KB, exported |
| `packages/core/src/dex/compare.ts` | `compareDexes` pure diff, never merges | ✓ VERIFIED | 4.6 KB, exported |
| `packages/core/src/dex/share-stats.ts` | `buildShareStats` | ✓ VERIFIED | 3.5 KB, exported |
| `packages/core/src/dex/search-archive.ts` | `makeArchiveSearcher` + groupShowsByYear | ✓ VERIFIED | exported |
| `packages/core/src/dex/recent-shows.ts` | `fetchRecentShows` w/ assertFilterApplied | ✓ VERIFIED | 7.2 KB, exported, names sourced from fetched rows (Pitfall 5) |
| `packages/core/src/data-safety/merge.ts` | v1→v2 MIGRATIONS + archiveShows union | ✓ VERIFIED ⚠️ | union-merge present; CR-01 defect in trackedEntries same-show dedupe |
| `packages/app/src/dex/DexView.tsx` | #/dex root w/ header + Albums/Shows | ✓ VERIFIED | 8.1 KB, wired to useDexStats |
| `packages/app/src/dex/useDexStats.ts` | useLiveQuery + useMemo(deriveDex) | ✓ VERIFIED | reads 4 live tables, no stored counts |
| `packages/app/src/dex/RecapView.tsx` | Post-show scorecard from deriveRecap | ✓ VERIFIED | 11.6 KB |
| `packages/app/src/dex/CompareView.tsx` | Read-only You vs {name}, no DB writes | ✓ VERIFIED | 7.9 KB, only deriveDex reads, zero db.* writes |
| `packages/app/src/dex/shareCard.ts` | Canvas draw + share/download flow | ✓ VERIFIED | 9.3 KB, canShare-gated |
| `packages/app/src/assets/covers/*.webp` | ≤~300 KB total committed covers | ✓ VERIFIED | 29 WebP covers, 268 KB total |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `App.tsx` | `DexView.tsx` | `route === 'dex'` branch | ✓ WIRED (imported + rendered line 53) |
| `DexView.tsx` | `useDexStats.ts` | hook feeds every number | ✓ WIRED |
| `useDexStats.ts` | core `deriveDex` | useMemo over live reads | ✓ WIRED |
| `RecapView.tsx` | core `deriveRecap` | pure stats in, render out | ✓ WIRED |
| `ShowView.tsx` | `RecapView.tsx` | recapSessionId before early return | ✓ WIRED (line 171-173, set by onEnded line 403) |
| `db.ts markShowAttended` | attendedShows + archiveShows | single rw transaction | ✓ WIRED (line 466, both tables) |
| `importPicker.ts` | compare vs merge fork | envelope.owner vs local ownerName | ✓ WIRED |
| `CompareView.tsx` | core `deriveDex` | run twice, zero DB writes | ✓ WIRED (no db.* mutations) |
| `shareCard.ts` / `ShareCardSheet.tsx` | core `buildShareStats` | numbers assembled in core | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `vitest run` | 61 files, 462 tests passed | ✓ PASS |
| Archive artifact shape | `node -e` inspect archive.json | schemaVersion 1, 738 shows, 264 songs | ✓ PASS |
| Dex-albums artifact shape | `node -e` inspect dex-albums.json | schemaVersion 1, 29 cards + buckets | ✓ PASS |
| Cover budget | `du -sh covers/` | 268 KB (≤ ~300 KB budget) | ✓ PASS |
| Core purity | grep react/DOM/import.meta in core/dex | none found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SHOW-14 | 06-03, 06-09 | Post-show recap: hit/miss tally, setlist w/ structure, rarity score | ✓ SATISFIED | `deriveRecap` + `RecapView.tsx` |
| STAT-01 | 06-03, 06-06 | Song detail gap, play count, last-played | ✓ SATISFIED | `WhyDetail.tsx`, rarity.ts |
| STAT-02 | 06-03, 06-09 | Show rarity score (avg gap) | ✓ SATISFIED | `showRarityScore`, RecapView rarity block |
| STAT-03 | 06-03, 06-06 | Pokédex personal gap | ✓ SATISFIED | deriveDex personalGap, SongRow |
| STAT-04 | 06-01, 06-03, 06-06 | Debut candidates not fake percentages | ✓ SATISFIED | derive-dex.ts:239 excludes debut; TierBadge neutral "Debut" |
| DEX-02 | 06-01, 06-07, 06-08 | Retro-mark from archive, searchable, stable show ID | ✓ SATISFIED | ArchiveBrowser + markShowAttended (&show_id) |
| DEX-03 | 06-03, 06-05, 06-06, 06-08 | Sighting counts derived, never hand-tallied | ✓ SATISFIED | deriveDex; useLiveQuery, no stored counts |
| DEX-04 | 06-01, 06-03, 06-04, 06-06 | Completion %, sighting counts, rarest catch, never-seen list | ✓ SATISFIED | DexHeader + AlbumGrid + derive-dex |
| HIST-01 | 06-09 | Past shows viewable as complete setlists w/ structure | ✓ SATISFIED | SetlistView.tsx (Set 1/2/Encore) |
| SHAR-01 | 06-07, 06-10 | Export/import JSON for friend exchange | ✓ SATISFIED ⚠️ | export v2 + compare fork; ⚠️ CR-01 on self-merge |
| SHAR-02 | 06-11 | Shareable summary card | ✓ SATISFIED | shareCard.ts 1080×1350 PNG |

**All 11 phase requirement IDs are claimed by at least one plan — no orphans.** (06-02 additionally covers SHOW-02/04/05 Show-Mode polish, outside the phase-6 requirement set but part of phase work; not evaluated as phase-6 gaps.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found in packages/core/src/dex, packages/app/src/dex, packages/core/src/data-safety | — | No TODO/FIXME/XXX/PLACEHOLDER/"not implemented" debt markers in phase-6 source |

### Warnings

**CR-01 (carried from 06-REVIEW.md) — merge.ts same-show dedupe data loss.** In `parseAndMergeImport` Step 5 (`packages/core/src/data-safety/merge.ts:191-218`), when two device sessions map to the same attendance group (a night live-tracked on two devices), the canonical (most-entries) session wins wholesale and `finalEntries` filters out ALL entries of the dropped sessions (lines 216-218). Unique songs logged only on the non-canonical device for that same night are lost rather than unioned.

- **Honest-derivation impact:** Partial. Derived counts remain honest and never hand-tallied — the phase's core promise ("sighting counts derived from attendance") holds structurally. But a multi-device self-merge of the SAME night with divergent live-tracked setlists can UNDER-count real sightings. This is under-counting from data loss, not fabrication.
- **Scope is narrow:** `attendedShows` and `archiveShows` (the retro-mark and online-fallback sighting sources — the DEX-02 substrate) union correctly by `show_id` (merge.ts:128-141) and are unaffected. Only cross-device live-tracked `trackedEntries` for the same night are at risk. The friend-exchange primary path (read-only CompareView, 06-10) performs no merge and is unaffected.
- **Disposition:** Already flagged as a blocker in 06-REVIEW.md on a separate track; not fixed here per instructions. Recommend resolving (union entries by (sessionId, position) across the group before dropping the duplicate show) before relying on multi-device merge for accurate sighting counts.

### Human Verification Required

1. **Dark-room dex legibility** — Open #/dex on a phone in the dark, drill into an album. Expected: readable drill-in, legible dimmed rows, badges readable without color.
2. **On-device retro mark** — Mark a real past show. Expected: header counts jump instantly, "+N caught" flashes, airplane-mode browse works.
3. **End-show recap flow** — End a real tracked show. Expected: recap appears immediately after backup download, still in venue flow.
4. **Share card on iPhone + desktop** — Tap Share card. Expected: navigator.share sheet with 1080×1350 PNG on iPhone; anchor-download fallback on desktop; card renders correctly.
5. **Cover rendering quality** — View the album shelf on device. Expected: covers crisp at ~80px, shelf reads as a discography.
6. **Friend compare fork** — Import a friend's file (different owner). Expected: read-only CompareView with You vs {name} columns, zero DB writes, no merge affordance.

### Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria and all 11 requirement IDs are satisfied at the code level: artifacts exist, are substantive, are wired end-to-end (route → hook → pure core derivation), the full 462-test suite passes, the committed data artifacts match their contracts exactly, core purity is intact, and no debt-marker anti-patterns exist.

Status is `human_needed` rather than `passed` because this MVP-mode phase is dominated by device/visual/real-time behaviors (dark-mode legibility, live reactive updates, offline archive browse, navigator.share PNG sharing, cover rendering) that cannot be confirmed programmatically — these are surfaced as 6 human verification items (5 harvested from planner-deferred `<human-check>` device gates + 1 compare-fork check).

One WARNING (CR-01) is carried forward from 06-REVIEW.md: the multi-device self-merge path can under-count live-tracked sightings for the same night. It partially dents the honest-derivation guarantee (under-counting, not fabrication) in a narrow edge case, leaves the retro/archive sighting sources and the friend-compare path unaffected, and is already tracked as a blocker on the review track. It does not falsify the phase goal but should be resolved before relying on multi-device merge.

---

_Verified: 2026-07-15T00:10:00Z_
_Verifier: Claude (gsd-verifier)_

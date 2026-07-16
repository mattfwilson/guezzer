---
phase: 06-pok-dex-history-stats
verified: 2026-07-16T16:40:00Z
status: passed
score: 9/9 must-have truths verified (automated); both device re-UAT confirmations passed on iOS (tests 8 & 9)
overrides_applied: 0
device_uat:
  - "Test 8 (Phantom Island art): PASS — user approved the 2025 studio-album cover"
  - "Test 9 (offline covers): PASS — all covers persist in airplane mode after the clientsClaim fix"
  followup_fix: "8424e6e — device re-UAT of the 06-12 offline fix surfaced that the built SW had no clients.claim(); first-session cover fetches bypassed the precache offline (only the 2 sub-4KB Vite-inlined covers survived). Set workbox.clientsClaim=true (skipWaiting stays false, registerType 'prompt' preserved). Re-confirmed on device: all covers persist offline."
re_verification:
  previous_status: "human_needed"
  previous_score: 5/5 (automated)
  gaps_closed:
    - "Airplane-mode archive/dex browse works fully offline including album covers (06-HUMAN-UAT gap 1, major) — confirmed on device (test 9)"
    - "Every studio album card shows its correct studio-release cover art (06-HUMAN-UAT gap 2, minor — Phantom Island) — confirmed on device (test 8)"
  gaps_remaining: []
  regressions: []
warnings:
  - concern: "WR-01 (06-REVIEW.md incremental): findReleaseGroupMbid's Album preference is unbounded by score — a low-scored Album-typed group (live album/compilation) could beat a top-scored exact-match EP on a future --force re-fetch"
    affects: "Build-time cover fetch script only; no committed artifact is currently wrong; latent risk for future EP covers"
    severity: warning
    note: "Advisory. Regression tests pin [Single:100, Album:100]→Album and [EP:100, Single:97]→EP but not [EP:100, Album:<100]. Fix suggested in 06-REVIEW.md (restrict preference to top-score ties)."
  - concern: "WR-02 (06-REVIEW.md incremental): CoverThumb 'failed' state is sticky across slug changes — a future call site that reuses a mounted instance with a new slug would render initials for a loadable cover"
    affects: "Latent only. Both current call sites are safe: AlbumGrid keys cards by stable item.key; AlbumDetail fully unmounts between opens"
    severity: warning
    note: "Advisory. Fix suggested in 06-REVIEW.md (render-time failedSlug reset or key={slug} contract)."
human_verification_resolved:
  - test: "Re-UAT (UAT test 2 scope, fix confirmation): online-load the rebuilt PWA once, accept the SW update prompt, then enable airplane mode and browse #/dex shelf + album drill-in"
    expected: "All album covers render offline — no broken-image '?'; any cover that genuinely fails degrades to the initials placeholder"
    result: "PASS on iOS (06-HUMAN-UAT test 9) after follow-up SW fix 8424e6e (clientsClaim)"
  - test: "Re-UAT (UAT test 5 scope, fix confirmation): view the Phantom Island card on the album shelf"
    expected: "The card shows the 2025 studio-album cover art, not the 2024 Single/EP art"
    result: "PASS on iOS (06-HUMAN-UAT test 8) — user approved the cover"
---

# Phase 6: Pokédex, History & Stats — Re-Verification Report

**Phase Goal:** The user's live-show history becomes a browsable collection — every sighting count derived from attendance, every stat honest about sparse data, and the whole dex shareable with friends.
**Verified:** 2026-07-16T16:40:00Z
**Status:** passed (all automated must-haves pass; both device re-UAT items confirmed on iOS)
**Re-verification:** Yes — after human UAT (4 passed / 2 issues), gap-closure plan 06-12, and follow-up SW fix 8424e6e (clientsClaim, surfaced by device re-UAT)

## Re-Verification Context

- Initial verification (2026-07-15): 5/5 ROADMAP truths verified at code level; status `human_needed` with 6 device items.
- Human UAT (06-HUMAN-UAT.md): 4 passed, 2 issues → 2 diagnosed gaps (offline covers, phantom-island art).
- Gap-closure plan 06-12 executed (5 task commits verified in git log: 0761a81, d0f9fd3, 3cf35c6, 9f2055a, e795345).
- This pass: full 3-level verification of the 2 closed gaps + regression check of previously passed items.

## Goal Achievement

### Observable Truths

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Pokédex shows completion %, sighting counts derived from attendance (never hand-tallied), rarest catch, never-seen list | ROADMAP SC1 | ✓ VERIFIED (regression) | `DexView.tsx` → `useDexStats.ts` → core `deriveDex`; all artifacts present and unchanged; 470-test suite green |
| 2 | Retroactive marking from full archive, searchable, keyed by stable show ID | ROADMAP SC2 | ✓ VERIFIED (regression) | `ArchiveBrowser.tsx`, `search-archive.ts`, `markShowAttended` (&show_id); archive.json intact (738 shows) |
| 3 | Gap/play-count/last-played stats; personal gap; debut candidates not fake percentages | ROADMAP SC3 | ✓ VERIFIED (regression) | `WhyDetail.tsx`, `derive-dex.ts` debut exclusion, `TierBadge` neutral Debut — unchanged, suite green |
| 4 | Recap with hit/miss tally, set structure, rarity score; past shows viewable | ROADMAP SC4 | ✓ VERIFIED (regression) | `RecapView.tsx`, `recap.ts`, `rarity.ts`, `SetlistView.tsx`, `ShowsList.tsx` — unchanged, suite green |
| 5 | Dex exports/imports as JSON; shareable summary card | ROADMAP SC5 | ✓ VERIFIED (regression, warning resolved) | Compare fork + `shareCard.ts` unchanged. Previous CR-01 merge warning now RESOLVED — see below |
| 6 | Airplane-mode covers render in shelf + drill-in after one online load (no broken '?') | 06-12 truth / UAT gap 1 | ✓ VERIFIED (code); device re-UAT pending | `vite.config.ts:56` globPatterns include `webp`; built `dist/sw.js` precache manifest contains 27 `.webp` entries matching 27 emitted assets; remaining 2 covers (<4 KB: float-along 3,692 B, infest 3,318 B) confirmed inlined as 2 `data:image/webp` URLs in the precached JS bundle — all 29 offline-complete |
| 7 | Any failing cover `<img>` degrades to the initials placeholder, never a broken-image icon | 06-12 truth | ✓ VERIFIED | `CoverThumb.tsx:67` `onError={() => setFailed(true)}`; both branches keep `data-testid="album-cover"`; jsdom tests fire the error event and assert `fallback.tagName !== "IMG"` + initials text + dim classes (dexView.test.tsx:248-274) |
| 8 | Phantom Island card shows the 2025 studio-album cover (RG 716f0986-f131-4e3c-a140-55845bbded3c), not the 2024 Single art | 06-12 truth / UAT gap 2 | ✓ VERIFIED (code); device re-UAT pending | `covers-manifest.json:134-139` mbid + sourceUrl both point at 716f0986… (Album, fetchedAt 2026-07-16T14:49Z); webp re-encoded 7,918 B; visual inspection of the committed webp shows island-fortress album art; commit e795345 is the re-fetch, not a hand-edit |
| 9 | Full test suite stays green, including 25 KB per-file / 350 KB total cover budget guards | 06-12 truth | ✓ VERIFIED | Ran `npm test -- --run` fresh: **62 files, 470 tests passed** (465 prior + 2 fallback + 3 release-group); covers dir 268 KB total, 29 files, max file well under 25 KB |

**Score:** 9/9 truths verified at automated level.

### Required Artifacts (06-12 gap-closure, full 3-level + data flow)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/app/vite.config.ts` | `webp` in workbox globPatterns | ✓ VERIFIED | Line 56: `["**/*.{js,css,html,ico,png,svg,woff2,webp}"]`; `registerType: "prompt"` untouched (CLAUDE.md rule); `json` still excluded with rationale comment |
| `packages/app/src/dex/CoverThumb.tsx` | Shared cover-or-initials component with onError fallback, ≥30 lines | ✓ VERIFIED | 73 lines, substantive; `initialsFor` moved here (zero duplicates remain elsewhere in src); sizing via `px` prop sourced from config at call sites |
| `packages/app/scripts/fetch-covers.ts` | primary-type Album preference in release-group selection | ✓ VERIFIED | `MbReleaseGroup` gains optional `"primary-type"` (line 75); `findReleaseGroupMbid` exported (line 114), prefers first Album-typed group with `groups[0]` fallback (lines 134-135); pacing/no-retry/25 KB guard untouched |
| `packages/app/src/assets/covers/covers-manifest.json` | phantom-island provenance → Album release group | ✓ VERIFIED | Contains `716f0986-f131-4e3c-a140-55845bbded3c` twice (mbid + sourceUrl); provenance format intact; budget/bijection guards green |
| `packages/app/src/assets/covers/phantom-island.webp` | Re-fetched Album art within budget | ✓ VERIFIED | 7,918 B (≤25 KB); total covers 268 KB (≤350 KB); mtime matches fetchedAt; visually album art, not obviously Single art |
| `packages/app/test/fetchCovers.test.ts` | Regression tests for Album preference | ✓ VERIFIED | 3 tests: Single-first→Album wins, EP-only→groups[0] fallback, empty→null; stubbed fetch, no real network |
| `packages/app/test/dexView.test.tsx` | img→initials fallback tests | ✓ VERIFIED | 2 new tests (lines 218-274) incl. tightened non-vacuous assertion (`tagName !== "IMG"`) per documented RED-phase deviation; existing dimming assertions untouched |
| Prior phase-6 artifacts (15 core/app/data files) | Regression | ✓ VERIFIED | All present and non-empty (derive-dex, rarity, recap, compare, share-stats, search-archive, recent-shows, DexView, useDexStats, RecapView, CompareView, shareCard, ArchiveBrowser, archive.json, dex-albums.json); 470-test suite green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AlbumGrid.tsx` | `CoverThumb.tsx` | import replaces inline img/placeholder | ✓ WIRED | Import line 16, rendered line 92 with `dimClass={dimClass}` (§B4 dimming) |
| `AlbumDetail.tsx` | `CoverThumb.tsx` | import replaces inline img/placeholder | ✓ WIRED | Import line 12, rendered line 65 with `dimClass="shrink-0"` (flex-header compression guard preserved) |
| `vite.config.ts` | `dist/sw.js` | workbox globPatterns → precache manifest | ✓ WIRED | Built sw.js contains 27 `.webp` precache URLs = exactly the 27 non-inlined emitted webp assets; 2 sub-4 KB covers ride the JS bundle as data URLs |
| Prior key links (route→DexView→useDexStats→deriveDex, recap, markShowAttended, import fork, share card) | — | — | ✓ WIRED (regression) | Unchanged files; suite green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CoverThumb.tsx` | `coverUrl` | `coverUrlFor(slug)` → `import.meta.glob` over committed `src/assets/covers/*.webp` | Yes — 29 committed real assets; null contract → initials | ✓ FLOWING |
| `AlbumGrid`/`AlbumDetail` call sites | `slug`, `title`, `px` | dex-albums.json cards + `config.dex.ALBUM_ART_DISPLAY_PX` | Yes — no hardcoded empty props | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test -- --run` (run fresh this pass) | 62 files, 470 tests passed | ✓ PASS |
| SW precaches covers | `grep -o "\.webp" packages/app/dist/sw.js \| wc -l` | 27 (matches 27 dist webp assets) | ✓ PASS |
| Small covers inlined | count `data:image/webp` in dist JS bundle | 2 occurrences (the two <4 KB covers) | ✓ PASS |
| Manifest provenance | `grep -c 716f0986-… covers-manifest.json` | 2 (mbid + sourceUrl) | ✓ PASS |
| Cover budget | `du -sk covers/` + `ls *.webp \| wc -l` | 268 KB, 29 files | ✓ PASS |
| Task commits exist | `git log --oneline` | All 5 claimed commits present (0761a81, d0f9fd3, 3cf35c6, 9f2055a, e795345) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist in this project and none are declared by any phase-6 plan — SKIPPED (no probes).

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| SHOW-14 | 06-03, 06-09 | ✓ SATISFIED (regression) | deriveRecap + RecapView unchanged, suite green |
| STAT-01 | 06-03, 06-06 | ✓ SATISFIED (regression) | WhyDetail + rarity.ts |
| STAT-02 | 06-03, 06-09 | ✓ SATISFIED (regression) | showRarityScore + RecapView |
| STAT-03 | 06-03, 06-06 | ✓ SATISFIED (regression) | deriveDex personalGap |
| STAT-04 | 06-01, 06-03, 06-06 | ✓ SATISFIED (regression) | debut-candidate exclusion + neutral badge |
| DEX-02 | 06-01, 06-07, 06-08, **06-12** | ✓ SATISFIED | ArchiveBrowser + markShowAttended; offline archive/dex browse now includes precached covers |
| DEX-03 | 06-03, 06-05, 06-06, 06-08 | ✓ SATISFIED (regression) | deriveDex over live table reads, no stored counts |
| DEX-04 | 06-01, 06-03, 06-04, 06-06, **06-12** | ✓ SATISFIED | Shelf/header/derive-dex; correct studio art + offline covers + graceful fallback |
| HIST-01 | 06-09 | ✓ SATISFIED (regression) | SetlistView set structure |
| SHAR-01 | 06-07, 06-10 | ✓ SATISFIED — prior CR-01 caveat RESOLVED | See CR-01 resolution below |
| SHAR-02 | 06-11 | ✓ SATISFIED (regression) | shareCard 1080×1350 PNG flow |

All 11 phase requirement IDs claimed by plans and mapped `Phase 6 / Complete` in REQUIREMENTS.md; DEX-05 correctly maps to Phase 7 — no orphans.

### CR-01 Resolution (previous verification's WARNING — now closed)

The 2026-07-15 report carried a WARNING: `merge.ts` same-show dedupe dropped non-canonical sessions' unique entries (multi-device same-night under-count). Commit `4c53de4 fix(core): union same-night sessions in import merge (CR-01)` resolves it: `merge.ts:210-269` now ADOPTS every non-canonical session's entries onto the canonical session, de-duped by songId within the night (unique-per-device songs survive; null-songId placeholders always adopted; positions re-stamped past canonical max). Dedicated regression tests exist and pass (`packages/core/test/merge.test.ts:312-366`: local-unique adoption + no double-count). The honest-derivation caveat on SHAR-01/DEX-02 is lifted.

(Note: the single NUL byte ripgrep flags in merge.ts is an intentional literal `\0` compound-key separator in `entryKey`, not corruption.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No TBD/FIXME/XXX/TODO/HACK debt markers in any 06-12 modified file. (dexView.test.tsx:271 contains the word "PLACEHOLDER" in a test comment for emphasis — not a debt marker.) |

### Advisory Warnings (carried from 06-REVIEW.md incremental review — non-blocking)

1. **WR-01** — `findReleaseGroupMbid` Album preference is unbounded by score; a low-scored Album-typed group could beat a top-scored EP on a future `--force` re-fetch. No committed artifact is currently wrong. Suggested fix: restrict preference to top-score ties + add `[EP:100, Album:<100]→EP` regression test.
2. **WR-02** — `CoverThumb.failed` is sticky across slug changes; latent wrong-render if a future call site reuses a mounted instance. Both current call sites are safe (stable keys / full unmount). Suggested fix: render-time `failedSlug` reset.

### Human Verification Required

Both items are narrow fix-confirmations deferred by plan 06-12's verification section ("Re-UAT on device — next UAT round, not this plan"). The 4 previously passed UAT items (dark-room legibility, retro-mark reactivity, end-show recap flow, share card, friend compare fork) do NOT need re-testing.

### 1. Offline covers re-UAT (closes UAT test 2 residual)

**Test:** Online-load the rebuilt PWA, accept the SW update prompt (registerType is "prompt" — the new precache only activates after the update), then enable airplane mode and browse the dex shelf and an album drill-in.
**Expected:** All album covers render offline; no broken-image "?" anywhere; a genuinely failing cover shows the initials placeholder.
**Why human:** Real-device service-worker precache behavior can't be confirmed by grep/jsdom — this exact gap slipped past code-level verification once already.

### 2. Phantom Island art re-UAT (closes UAT test 5 residual)

**Test:** View the Phantom Island card on the album shelf.
**Expected:** The 2025 studio-album cover, not the 2024 Single art.
**Why human:** Final art correctness is visual; the user is the arbiter, though provenance + committed-image inspection strongly indicate the fix landed.

### Gaps Summary

No blocking gaps and no regressions. Both UAT-diagnosed gaps have verified closing artifacts, wired and tested end-to-end:

- **Gap 1 (offline covers, major):** `webp` added to workbox globPatterns — the built sw.js precache manifest lists all 27 emitted webp cover assets, and the 2 sub-4 KB covers are confirmed inlined as data URLs in the already-precached JS bundle (all 29 offline-complete). The new shared `CoverThumb` component guarantees img→initials degradation under the same testid, pinned by 2 new jsdom tests (one deliberately tightened after a vacuous RED pass).
- **Gap 2 (Phantom Island art, minor):** `findReleaseGroupMbid` now prefers Album-typed release groups (exported + 3 regression tests), and the phantom-island cover was re-fetched from the correct 2025 Album release group with intact provenance (mbid + sourceUrl verified, budgets green, single-cover etiquette honored — 2 external requests).

Additionally, the previous verification's CR-01 merge warning is now resolved in code with dedicated union-adoption tests. The full suite passes at 470/470. The only open items are the two device re-UAT confirmations explicitly deferred by plan 06-12 to the next UAT round — hence `human_needed` rather than `passed` — plus two advisory (non-blocking) review warnings, WR-01 and WR-02, recorded above for future hardening.

---

_Verified: 2026-07-16T15:10:00Z_
_Verifier: Claude (gsd-verifier)_

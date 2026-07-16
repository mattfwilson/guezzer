---
status: partial
phase: 06-pok-dex-history-stats
source: [06-VERIFICATION.md]
started: 2026-07-15T00:10:00Z
updated: 2026-07-16T15:15:00Z
---

## Current Test

[awaiting device re-test of the two 06-12 fixes]

## Tests

### 1. Dark-room dex legibility
expected: Open #/dex on a phone in a dark room and drill into an album — album drill-in is readable in the dark; dimmed (unseen) rows are legible; tier/Debut badges are readable without relying on color.
result: pass

### 2. On-device retro mark
expected: Mark a real past show from the archive browser — Dex header counts jump instantly; "+N songs caught" flashes; airplane-mode archive browse still works fully offline.
result: issue
reported: "when i went into airplane mode the album covers in dex didn't show properly/showed a ?"
severity: major
note: Rest of test confirmed working by user — mark behaved, dex header counts jumped instantly, "+N songs caught" flashed, archive list browsable offline. Issue is scoped to cover images offline only.
diagnosis: Confirmed real production gap (not just a dev-server artifact) — vite.config.ts workbox globPatterns omit `webp`, so the 29 hashed cover assets are never precached; offline the <img> 404s and there is no onError fallback to the initials placeholder.

### 3. End-show recap flow
expected: End a real tracked show on device — the recap appears immediately after the backup download, still within the venue flow (not orphaned).
result: pass

### 4. Share card on iPhone + desktop
expected: Tap Share card on an iPhone, then on desktop — real navigator.share sheet opens on iPhone with the 1080×1350 PNG attached; anchor-download fallback works on desktop; the card renders correctly.
result: pass

### 5. Cover rendering quality
expected: View the album shelf grid on device — covers render crisply at ~80px; the shelf reads as a coherent discography.
result: issue
reported: "all covers render correctly, though the 'Phantom Island' cover seems to be pulling possibly their older EP version, vs the studio released album cover"
severity: minor
note: Rendering quality itself passes (crisp at ~80px, coherent shelf; bucket initials placeholders confirmed intended). Issue is one wrong asset — the build-time MusicBrainz/Cover Art Archive fetch likely resolved the wrong release for Phantom Island.

### 6. Friend compare fork
expected: Import a friend's exported dex file (different owner name) — read-only CompareView opens with You vs {name} columns + diff lists; NOTHING is written to the DB; no adopt/merge affordance exists.
result: pass

### 7. Re-test: offline covers after 06-12 fix
expected: Load the deployed app online once and accept the SW update prompt, then enable airplane mode and browse the dex shelf and an album drill-in — all album covers render (no broken-image "?"); if any single image somehow fails, it degrades to the initials placeholder.
result: issue
reported: "only certain covers persist once I enable airplane mode. for instance Float Along - Fill Your Lungs and Infest The Rats' Nest both persist but all the other covers show the placeholder abbreviations letters"
severity: major
diagnosis: |
  The two persisting covers are exactly the two sub-4 KB files Vite inlines as
  data: URIs in the JS bundle (immune to network state). The other 27 covers WERE
  precached by the SW, but the built sw.js had no clients.claim() — Workbox
  generateSW defaults clientsClaim to false and vite.config.ts never set it. On
  first visit the SW installs and precaches everything but never takes control of
  the already-open page, so all first-session image fetches bypass the SW and fail
  offline (CoverThumb initials fallback caught them — no broken "?", fallback
  working as designed). Fixed in 8424e6e: clientsClaim: true (skipWaiting stays
  false + registerType 'prompt' preserved, so updated SWs still wait for user
  approval — never swaps mid-show).
retest: test 9

### 8. Re-test: Phantom Island studio art after 06-12 fix
expected: View the Phantom Island card on the album shelf — it shows the 2025 studio-album cover (island-fortress art), not the 2024 Single art.
result: pass
note: "User: Phantom Island cover approved."

### 9. Re-test: offline covers after clientsClaim fix (8424e6e)
expected: Open the app online (accept the update prompt if shown, otherwise reload once), then enable airplane mode and browse the dex shelf and an album drill-in — ALL album covers render, including in a first-ever browser session.
result: [pending]

## Summary

total: 9
passed: 5
issues: 3
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Airplane-mode archive/dex browse works fully offline including album covers"
  status: resolved
  resolved_by: 06-12 (webp added to workbox globPatterns — 27 covers in SW precache manifest, 2 sub-4 KB covers inlined in JS bundle; CoverThumb onError → initials fallback)
  pending_retest: test 7
  reason: "User reported: when i went into airplane mode the album covers in dex didn't show properly/showed a ?"
  severity: major
  test: 2
  artifacts: ["packages/app/vite.config.ts", "packages/app/src/dex/AlbumGrid.tsx", "packages/app/src/dex/covers.ts"]
  missing: ["webp in workbox globPatterns (covers never precached)", "onError fallback from <img> to initials placeholder"]

- truth: "Every studio album card shows its correct studio-release cover art"
  status: resolved
  resolved_by: 06-12 (findReleaseGroupMbid prefers primary-type Album; phantom-island re-fetched from Album release group 716f0986-f131-4e3c-a140-55845bbded3c)
  pending_retest: test 8
  reason: "User reported: the 'Phantom Island' cover seems to be pulling possibly their older EP version, vs the studio released album cover"
  severity: minor
  test: 5
  artifacts: ["packages/app/scripts/fetch-covers.ts", "packages/app/src/assets/covers/phantom-island.webp", "packages/app/src/assets/covers/covers-manifest.json"]
  missing: ["primary-type Album preference in findReleaseGroupMbid (currently takes groups[0].id unfiltered)", "re-fetched phantom-island.webp from the Album release group"]
  diagnosis: |
    CONFIRMED via provenance manifest + MusicBrainz. covers-manifest.json shows
    phantom-island was fetched from release-group e2e5b06e-e0e7-4362-ab3d-353f5f6a4455,
    which MB identifies as the 2024-10-29 SINGLE "Phantom Island". The correct studio
    album release group is 716f0986-f131-4e3c-a140-55845bbded3c (Album, 2025-06-13).
    Root cause: findReleaseGroupMbid (fetch-covers.ts) returns groups[0].id from the
    search response with no primary-type filter — both groups score 100 and MB
    returned the Single first. Fix: prefer primary-type "Album" among results (or add
    AND primarytype:album to the query with unfiltered fallback), re-fetch just the
    phantom-island cover, update the webp + manifest entry.

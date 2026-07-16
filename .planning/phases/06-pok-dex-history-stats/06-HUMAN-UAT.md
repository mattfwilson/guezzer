---
status: complete
phase: 06-pok-dex-history-stats
source: [06-VERIFICATION.md]
started: 2026-07-15T00:10:00Z
updated: 2026-07-16T00:00:00Z
---

## Current Test

[testing complete]

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

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Airplane-mode archive/dex browse works fully offline including album covers"
  status: failed
  reason: "User reported: when i went into airplane mode the album covers in dex didn't show properly/showed a ?"
  severity: major
  test: 2
  artifacts: ["packages/app/vite.config.ts", "packages/app/src/dex/AlbumGrid.tsx", "packages/app/src/dex/covers.ts"]
  missing: ["webp in workbox globPatterns (covers never precached)", "onError fallback from <img> to initials placeholder"]

- truth: "Every studio album card shows its correct studio-release cover art"
  status: failed
  reason: "User reported: the 'Phantom Island' cover seems to be pulling possibly their older EP version, vs the studio released album cover"
  severity: minor
  test: 5
  artifacts: ["packages/app/scripts/fetch-covers.ts", "packages/app/src/assets/covers/"]
  missing: ["correct Cover Art Archive release selection for Phantom Island (verify against provenance manifest, re-fetch or manually swap the webp)"]

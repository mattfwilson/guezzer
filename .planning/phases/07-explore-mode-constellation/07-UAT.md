---
status: complete
phase: 07-explore-mode-constellation
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md]
started: 2026-07-16T23:27:03Z
updated: 2026-07-16T23:52:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Hard-reload from scratch (fresh load, offline after first load). App boots with no errors, bundled matrix loads, Explore constellation renders — no blank screen.
result: pass

### 2. Open Explore Mode
expected: Navigating to Explore shows the transition graph as a star-field — one orb per song, sized by play count. The simulation settles smoothly and then freezes (no perpetual drift).
result: pass

### 3. Constellation Reads Clearly (zoom / pan)
expected: At rest the sky is legible — connections read as edges (not one clumped ball), the top ~8 songs show labels. Pinch-zoom reveals more labels; one-thumb pan/zoom works. On-load view frames the connected main grouping.
result: pass

### 4. Tap a Star → Node Sheet with Ranked Bars
expected: Tapping a song opens a non-modal peek sheet showing its most-likely next songs as ranked bars (from full history, top N). The tapped node + its neighborhood stay lit while the rest of the sky dims. The lit neighborhood remains visible above the sheet.
result: pass

### 5. Focus Camera on Node + Neighborhood
expected: Tapping focuses/zooms the camera to the node and its neighbors; focus/neighbor labels become readable at the focus zoom level.
result: pass

### 6. Rotation vs Full Filter (no reheat)
expected: The filter control toggles between Rotation (recent-window songs) and Full catalog. Toggling changes which stars are drawn WITHOUT the sky jumping or re-simulating — positions stay put, only visibility changes.
result: pass

### 7. Edge Threshold Slider (no reheat)
expected: Sliding the edge threshold hides weak connections (edges below the count) live. The graph does not reheat or reflow — only which edges draw changes. The panel can be adjusted with the graph still visible (no scrim).
result: pass

### 8. Dex Overlay (silhouettes + sighting pills)
expected: Toggling the dex overlay grays unseen songs to silhouettes while caught songs keep full color. Zooming in shows sighting-count pills on caught stars. Focus-dim and dex-dim combine without any star becoming fully illegible. A dex error degrades to the neutral full-color view — never a blank sky.
result: pass
note: "Cosmetic dex-overlay toggle thumb overflowed the track's right edge when ON (reported at Test 6); fixed in ExploreFilterPanel.tsx via an edge-anchored thumb and confirmed sitting inside in both states."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0


## Gaps

[none yet]

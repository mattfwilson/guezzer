---
status: pass
phase: 10-pre-show-validation-device-dry-run
source: [10-VERIFICATION.md]
started: 2026-07-19T00:08:48Z
updated: 2026-07-18T21:36:14Z
---

## Current Test

### 2. Live-sync leg (?mockLatest=1) — first step of the VALID-02 on-device rehearsal (pending owner run)

## Tests

### 1. Tuning-family spot-check + anomaly sweep (VALID-01)
expected: |
  Prove the tuning-family tags are musically sane before show #1 without blindly regenerating them. This re-confirms the Phase 01 tuning-tag spot-check (`01-HUMAN-UAT.md` test #1, DATA-04) with a read-only review CLI. Open `data/tuning-review.md` (or re-run `node packages/core/src/cli/review-tuning-tags.ts`) and:

  (a) Confirm every canonical spot-check row is musically sensible (any `⚠️` / `MISSING` row needs your eye). Pre-run output — 12 pass / 0 fail:

  | song | expected | actual | ok |
  |---|---|---|---|
  | 12 Bar Bruise | standard | standard | ✅ |
  | Robot Stop | standard | standard | ✅ |
  | Gamma Knife | standard | standard | ✅ |
  | Crumbling Castle | standard | standard | ✅ |
  | The Dripping Tap | standard | standard | ✅ |
  | Hot Water | standard | standard | ✅ |
  | Doom City | microtonal | microtonal | ✅ |
  | Rattlesnake | microtonal | microtonal | ✅ |
  | Nuclear Fusion | microtonal | microtonal | ✅ |
  | Sleep Drifter | microtonal | microtonal | ✅ |
  | Straws in the Wind | microtonal | microtonal | ✅ |
  | Minimum Brain Size | microtonal | microtonal | ✅ |

  (b) Eyeball the anomaly candidates — the families the album-default logic can NEVER assign (`cs-standard` down-tuned era, `other` covers) plus the hand-tagged owner-knowledge overrides worth re-confirming. Summary: 264 total (238 standard, 26 microtonal, 0 cs-standard, 0 other, 52 hand-tagged), 45 anomaly candidate(s).

  **cs-standard candidates (down-tuned era — album-default cannot assign):**

  | songId | name | current family |
  |---|---|---|
  | 94 | Hell | standard |
  | 133 | Mars For the Rich | standard |
  | 152 | Organ Farmer | standard |
  | 157 | Perihelion | standard |
  | 160 | Planet B | standard |
  | 180 | Self-Immolate | standard |
  | 200 | Superbug | standard |
  | 239 | Venusian 1 | standard |
  | 240 | Venusian 2 | standard |

  **other candidates (covers — original-artist tuning is owner knowledge):** None — nothing to re-confirm (a valid pass).

  **hand-tagged overrides that diverge from their album default — confirm still intended:** None — nothing to re-confirm (a valid pass; of the 52 hand-tags, the 16 that match their album default are not surfaced).

  **hand-tagged, no album default to compare against — confirm still intended** (36 rows — the owner-knowledge edits the auto-logic cannot check, mostly covers): 80 Fury, 255 Love For Me, 256 Oh God, 257 Other Side, 258 Moby Dick, 263 Happy Birthday To You, 265 Talk Talk Talk, 266 I Gotta Rock 'n' Roll, 267 I Wanna Be Your Dog, 272 Pushin' Too Hard, 274 High School, 276 Let There Be Rock, 277 All My Loving, 278 Dirty Deeds Done Dirt Cheap, 279 Proud Mary, 280 La Grange, 281 I Was Made for Lovin' You, 282 Whole Lotta Love, 283 (You Gotta) Fight for Your Right (To Party!), 284 These Boots Are Made for Walkin', 285 Every 1's a Winner, 289 On the Road Again, 290 Silver Machine, 330 Boogie, 381 Ghost, 404 Gypsy, 405 Stoned, 424 Rock N' Roll, 425 T.V. Eye, 439 Jam, 498 Treaty, 927 Jailbreak, 980 Police Truck, 992 JOJAM, 996 LUSEQ, 1022 Dueling Drums.

  CONFIRMATION BRANCH (likely): if nothing is genuinely wrong, no file changes needed — reply "confirmed". FIX BRANCH (D-03): if you find a genuine error, hand-edit `data/tuning-tags.json` (flip `family` to the correct closed-vocabulary value standard | cs-standard | microtonal | other, set `source: "hand-tagged"`, keep 2-space + trailing newline), then run `node packages/core/src/cli/build-model.ts`, then `node packages/core/src/cli/run-backtest.ts`, and `git diff data/backtest-report.md` to confirm the top-k table shows NO regression.
result: |
  PASS (D-03 FIX branch). Owner reviewed `data/tuning-review.md` and eyeballed the anomaly candidates. Verdict:

  - CONFIRMED as-is: the 12 canonical spot-checks (all ✅, 0 fail) and the 36 hand-tagged no-album-default overrides (mostly covers) are correct — no change.
  - FIXED (D-03): the 9 cs-standard candidates from *Infest the Rats' Nest* were confirmed to be C# standard tuning and re-tagged `standard` → `cs-standard` (`source: album-default` → `hand-tagged`) in `data/tuning-tags.json`, matched by songId: 94 Hell, 133 Mars For the Rich, 152 Organ Farmer, 157 Perihelion, 160 Planet B, 180 Self-Immolate, 200 Superbug, 239 Venusian 1, 240 Venusian 2. Nothing else changed.

  Re-ran `build-model` + `run-backtest`. Backtest top-k delta = ZERO regression (byte-identical top-k + ablation tables; only the report timestamp changed):

  | Split | Top-1 | Top-5 | Top-10 |
  |---|---|---|---|
  | Overall (before) | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
  | Overall (after)  | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
  | Δ | 0.0pp | 0.0pp | 0.0pp |

  Post-fix summary counts: 264 total — 229 standard, 26 microtonal, **9 cs-standard**, 0 other, 61 hand-tagged. The 9 tracks now appear as cs-standard in the summary and are no longer flagged as cs-standard candidates (that sub-section is now empty — a valid nothing-to-re-confirm pass). Review CLI unit test green (10/10). VALID-01 closed; re-confirms Phase 01 `01-HUMAN-UAT.md` test #1 (DATA-04).

## Harness (D-07)

Tests 2–8 below are the VALID-02 on-device show-loop rehearsal. They MUST be run on the owner's iPhone against the **production build** served over an HTTPS cloudflared tunnel — the vite dev server over the tunnel is allowed only for informal bug-shaking, NEVER the recorded/graded run (a dev-server run does not exercise the precache service worker the offline leg depends on). Plain LAN HTTP won't register a service worker, so offline/PWA legs can't run without the tunnel.

Setup (see MEMORY `device-uat-hosting`):

1. Build the production bundle:
   ```
   npm run build -w @guezzer/app
   ```
2. Serve the built `dist/` on a fixed port (run in the background):
   ```
   npm run preview -w @guezzer/app -- --port 4173 --strictPort
   ```
3. Open an HTTPS quick tunnel to it. The `--http-host-header localhost` flag is **mandatory** — without it vite preview validates the `Host` header and returns **403** (run in the background):
   ```
   cloudflared tunnel --url http://localhost:4173 --http-host-header localhost
   ```
   (cloudflared is a downloaded release binary run manually — not a dependency added to the tree.)
4. Grab the `https://<random>.trycloudflare.com` URL from the tunnel output and smoke-test that `/`, `/sw.js`, and `/manifest.webmanifest` all return **200** before touching the phone.
5. Open the URL on the iPhone and **install the PWA to the home screen** (Share → Add to Home Screen). Run every graded test from the installed standalone app, not a browser tab.

SW note (MEMORY `sw-clientsclaim-offline`): the service worker installs on first load and `clientsClaim: true` lets it take control of the first session, so the app is offline-complete on the very first load. If the phone goes offline before the SW finishes installing, reload once while online, then retry the offline leg. The URL is ephemeral — it dies when the preview/tunnel processes stop; tear both down when UAT ends.

### 2. Live-sync leg (?mockLatest=1)
expected: |
  Prove the SYNC-02 editor-suggestion → adopt path and the D-07 auto-bind fire on-device, using the `?mockLatest=1` fixture ONCE for the sync leg only (D-04 — the mock is never used again after this test). From the installed PWA, open the app with `?mockLatest=1` appended to the URL. The fixture feeds four real catalog songs through the real poll/zod/dedupe path (Rattlesnake 168, Robot Stop 172, Gaia 81, Mars for the Rich 133, dated today).

  Steps + expected result:
  - Start Show, then confirm the SuggestionStrip surfaces the fixture's next un-logged editor song within one mock tick (~2s).
  - Adopt the surfaced suggestion (tap Add) — it logs with `source:"editor"`, classified hit/miss honestly against the on-screen fan, with no confirm.
  - Confirm the orbit auto-binds the show (D-07 canonical show_id/venue written once, matching-date guard) and recenters onto the adopted song with a real prediction fan.
result: [pending]

### 3. Start + predictions + log hits/misses
expected: |
  Leave the mock behind (reload the installed app WITHOUT `?mockLatest=1` — the fixture must not taint the graded loop). Drive the real Show Mode with manual song entry:
  - Start Show, then seed the opener via the Search sheet (fuzzy catalog search → select). The opener logs as an honest pre-opener miss and seeds `currentSongId`, so the first prediction fan renders.
  - Confirm the adaptive prediction fan renders around the current song.
  - Log several more songs: tap orbs in the fan (each a HIT + recenter) and use Search for songs outside the fan (each a MISS + recenter).
  - Confirm the persistent hit/miss tally (TallyReadout) and the comet trail both update correctly after each log, with no orbit re-layout on suggestion appearance/dismissal.
result: [pending]

### 4. Set break + encore
expected: |
  Through the real Show Mode FAB speed-dial (manual entry, D-04 — neither ends the show):
  - Tap Set break, then log the next song and confirm subsequent entries stamp set number "2" (SHOW-06).
  - Tap Encore, then log a song and confirm it stamps the encore set ("e").
  - Confirm the set structure is captured in the trail / entry snapshots.
result: [pending]

### 5. End Show + recap + dex credit
expected: |
  - Open the FAB → End Show; confirm it is confirm-gated (the destructive "End show?" bottom sheet, D-04) — the backdrop/Keep-tracking must NOT finalize.
  - Confirm the show finalizes, the JSON auto-backup nudge appears (D-13), and the post-show RecapView renders show-scoped stats.
  - Confirm the attended show credits the GizzDex (songs caught live appear in the dex).
result: [pending]

### 6. Offline airplane-mode leg (D-05)
expected: |
  Mid-rehearsal (during an active show, before End Show), enable airplane mode on the iPhone.
  - Confirm predictions still render, logging still works (tap-orb + Search + ???), and the GizzVerse constellation still loads/renders — all from precache + IndexedDB, with NO error banner (only the calm one-time offline reassurance LINE, D-08; SyncDot flips to the hollow offline ring).
  - Re-enable network and confirm polling resumes silently within one interval (no manual action, no banner).
  This exercises the "fully offline once loaded" core value and the `clientsClaim` first-load precache path (MEMORY `sw-clientsclaim-offline`).
result: [pending]

### 7. JSON export/import round-trip
expected: |
  On device, prove the eviction backstop survives a full round-trip with zero local data loss:
  - Export the backup JSON (Settings export, or the End-Show auto-backup file) — a dated `guezzer-backup-YYYY-MM-DD.json` saved to Files/Downloads.
  - Re-import it via the Settings import picker. The zod-validated v2 envelope routes through the owner-match fork (`isTypedNameMine` / `classifyImport`, T-10-05): the owner-match path MERGES with the local data.
  - Confirm the round-trip completes with NO local data loss (attended shows, logged entries, and dex credit all intact — nothing dropped or duplicated destructively).
result: [pending]

### 8. Android (VALID-02 criterion 3)
expected: |
  No Android device available for this rehearsal. Android install/loop is formally waived per D-06 — recorded, not run.
result: [pending] — will record "waived / no device available" (D-06).

## Summary

total: 8
passed: 1
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

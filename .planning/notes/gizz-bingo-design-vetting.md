---
title: "Gizz Bingo — design vetting & empirical findings"
date: 2026-07-19
context: "/gsd-explore session vetting the Gizz Bingo concept against the real corpus"
---

# Gizz Bingo — Design Vetting & Empirical Findings

The casual +1 anchor feature: a live-updating setlist bingo card that auto-marks as the
show is tracked. A +1 who knows zero songs just watches squares light up. This note captures
the **vetted** design after pressure-testing the landed decisions against real corpus data.

Origin todo: `.planning/todos/pending/2026-07-19-feature-gizz-bingo-live-auto-marking-cards.md`
(feature idea #3). Differentiator vs the existing static-PDF fan project
(github.com/reeserich/king_gizz_bingo): **live auto-marking driven by the tracker.**

---

## Empirical reality (241 recent-era shows, 2022+, from `data/normalized/corpus.json`)

Show length: **median 15 songs** (p10=9, p50=15, p90=19, max 32). This single number drives
the card-size and winnability decisions below.

Per-show event fire-rates (share of recent shows containing ≥1):

| Event type | Fires in | Avg/show | Verdict |
|---|---|---|---|
| A song from *[big album]* | 53–80% each | — | ✅✅ Reliable AND varied — the variety engine |
| A segue (→) | 97% | ~5 | ✅ Abundant — safe to repeat squares |
| A marathon jam (curated vehicle list) | 95% | ~3 | ✅ Reliable |
| A microtonal song (non-standard tuning) | 89% | ~3 | ✅ Abundant — safe to repeat |
| The opener (position 1) | 100% | 1 | ✅ Reliable, singular |
| A bust-out (corpus gap ≥ 50 shows) | 21% | ~0.3 | 🏆 Rare — glory / line-gating square |
| A cover (`isCover`) | **2%** | 0.02 | ❌ DEAD in recent era |
| An encore (`setNumber="e"`) | **0%** | — | ❌ DEAD — no encore structure logged |
| A Set 2 song (`setNumber="2"`) | **2%** | — | ❌ DEAD — shows are single continuous sets |
| A specific song | ≤34% (even Gaia) | — | ⚠️ Individually unreliable |

Album fire-rates measured: Infest the Rats' Nest 80%, Omnium Gatherum 80%, PetroDragonic 60%,
Ice/Death/Planets… 59%, Flying Microtonal Banana 53%, I'm in Your Mind Fuzz 53%.

Song scarcity: **192 distinct songs across 241 recent shows.** No song plays "most nights" —
the top song (Gaia) is in 34%. A card of the 12 *most-likely* songs marks only ~3 per show.

---

## What the data overturned, validated, and improved

**OVERTURNED — three "easy events" are dead squares.** Covers (2%), encores (0%), Set-2 (2%)
essentially never mark in the modern touring era. Using them = dark squares all night and a card
that can't fill. **Dropped from recent-era cards.** (Could be re-enabled on pre-2020 replay cards.)

**VALIDATED — few specific-song squares is correct.** Specific songs are individually unreliable
(no song > 34%), so the 20-event / 4-song lean is right: events are what actually fires.

**KEY IMPROVEMENT — album-membership is the variety engine.** Only ~4 event *types* fire reliably
at high frequency (segue, microtonal, jam, opener); filling 20 squares from those alone reads
monotonously ("segue / segue / microtonal…"). Album-membership squares (6–10 albums, 53–80% each)
supply the variety a fun card needs — reliable, distinct, and knowledge-free (novices recognize
album art). This is the biggest single upgrade the vetting produced.

**CARD SIZE → 4×4 (DECIDED).** Median show = 15 songs; consume-once caps marks at the song count.
On 5×5 (24 fillable) **blackout is mathematically impossible** and the card tops out ~60% lit.
**4×4 (15 fillable + free center)** matches show length, makes blackout a genuine rare crown, keeps
lines common, and is more legible one-thumb-in-the-dark on a phone. **Card is 4×4.**

**Prediction framing → rare bonus, not the core.** A "predict the setlist" core would frustrate
(songs hit ≤34%). But when one of the 4 song squares hits, that's a delightful "you called it!"
moment *because* it's rare. Surface as flavor, not the main loop.

**"Instant blackout trap" is a non-issue.** Short shows + consume-once + thin catalog mean the real
risk is *under*-filling, not over. Consume-once stays (prevents 1 song = 3 marks); the generator
must calibrate to ~15 expected marks so a line stays likely.

---

## Vetted v1 design

- **Card:** 4×4, center free space → 15 fillable squares.
- **Mix:** heavily event-weighted (≈12–13 event / 2–3 song), calibrated so a line is likely and a
  blackout is a rare thrill over a median 15-song show.
- **Marking = consume-once:** each logged song marks the ONE best-matching unmarked square (greedy
  assignment), never every square it qualifies for.
- **Event catalog (recent-era):** album-membership (variety engine) · segue · marathon-jam ·
  microtonal · opener · bust-out (glory) · "a song you've never caught" (personal glory). NOT
  covers/encore/Set-2.
- **Seeding:** base-rate recent-frequency for song squares — NOT the transition predictor (which
  models next-song-given-current, not standalone likelihood).
- **Build UX:** "Deal my card" one-tap w/ vibe pick (Chill / Balanced / Glory-hunter) → full card,
  never blank. Tap a square to swap from suggestions (album/event cards w/ catchability hints;
  model-bucketed song chips w/ cover art; search escape hatch). Reshuffle re-deals. Live
  expected-fill/difficulty meter.
- **Home:** new **GizzGames** bottom tab (LiveGizz / GizzVerse / GizzDex / GizzGames). Build/reshuffle
  unlocked anytime; during a show it's the live-marking surface; after, holds card history.
- **Lock:** unlocked until Start Show, then FROZEN.
- **Scope:** solo/personal v1, NO leaderboard (see seed `gizz-bingo-shared-leaderboard`).
- **Late joiners:** no special mode — one-tap "Catch me up" bulk-adopts from the live `latest` feed
  (reuses adopt-suggestion path); manual mark/search fallback.
- **Replay:** card is a PERSISTED artifact (square defs + seed + lock timestamp) tied to the session
  in Dexie; past shows in GizzDex show the frozen card + final marks + win state (pure re-derivation).
- **Win conditions:** line / four-corners / X / blackout — all achievable on 4×4.
- **Celebrations:** per-square orb "stamp" (reuse orb renderer); big moments on FIRST LINE + BLACKOUT
  only; reuse constellation galaxy backdrop for the supernova + share-card canvas for a shareable
  result. Reduced-motion aware (`useReducedMotion` already threaded).

## Architecture fit
Card generation + marking are PURE CORE functions over the trail (`packages/core`), a third
derivation alongside the existing tally and comet trail — recompute on every `logSong` via the same
Dexie liveQuery. No new sync plumbing. All constants in config; unit tests with fixture setlists.

## Timeline
Casual/engagement feature — NOT part of the show-#1 core bar (Features 1–4 + backtest). Schedule
after the core loop is trustworthy.

## Reproducing the numbers
Ad-hoc node scripts over `data/normalized/corpus.json`, `data/tuning-tags.json`,
`data/normalized/dex-albums.json`, filtered to `year >= 2022`. Bust-out = per-song gap ≥ 50 shows
along the corpus timeline. Jam-vehicle = curated name-substring list. Rerun before locking the final
event catalog + calibration constants.

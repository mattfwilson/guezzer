---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Gizzle — daily clue-based song-guessing puzzle"
area: feature
files:
  - packages/core/src/search/search-catalog.ts
  - packages/core/src/model/matrix.ts
---

## Problem

**Feature idea #4 from 2026-07-19 research session. The engagement-outside-shows engine + discography onboarding for casual friends.**

The kglw.net forum's most active thread EVER is a KGLW Heardle (895 replies) — this community demonstrably loves song-guessing games. Heardle mechanics that drive retention: daily cadence, streaks, autocomplete guessing (recognition not recall — playable by non-experts), and the spoiler-free emoji-grid share that colonizes the group chat. Every puzzle a casual friend plays before August makes the actual show more fun for them.

## Solution

Concept — a daily mystery-song puzzle using bundled data only (no audio, no licensing pain, works offline):

1. **Progressive clues** revealed per wrong guess (6 guesses): blurred album art sharpening each round (covers already bundled as WebP), release year, tuning family, play count / rarity tier, "often follows X live" from the transition matrix, a footnote/fun fact. Clue order tuned so early clues are hard, late ones nearly give it away.
2. **Guess input**: the existing fuse.js autocomplete over the 264-song catalog — casual players can browse-guess.
3. **Deterministic daily seed**: seed the song pick from the date (e.g. hash of YYYY-MM-DD over the catalog, weighted away from ultra-obscura) — every friend gets the SAME puzzle with zero server. Local streak counter + emoji-grid result (🟩🟨⬛ per clue) via Web Share/clipboard.
4. Optional modes later: "hard mode" (no album art), lyric-fragment clue (needs curating lyric snippets — content cost).

Architecture fit: puzzle selection/clue derivation/scoring are pure core (trivially testable with fixed seeds); one new view; a menu or tab entry point. Mid-size, fully offline, zero API impact. Sources: heardle.info mechanics, forum.kglw.net KGLW Heardle thread.

# Phase 16: Gizz Bingo — Build, Live Marking & Celebrations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 16-gizz-bingo-build-live-marking-celebrations
**Areas discussed:** Build & swap surface, Expected-fill/difficulty meter, "One away" tension, Celebrations & share reveal, Live board access during show, Share-flow trigger, Reduced-motion fallback, Live board accessibility

---

## Build & swap surface

### Deal + vibe entry flow
| Option | Description | Selected |
|--------|-------------|----------|
| Vibe buttons ARE deal | Three big buttons (Deal Chill/Balanced/Glory), each with a gamble hint; one tap deals a full card | ✓ |
| Deal first, vibe toggle | "Deal my card" deals Balanced; a segmented control re-deals on vibe change | |
| Vibe pick, then deal | Two-step vibe picker → confirm → card deals with a reveal animation | |

**User's choice:** Vibe buttons ARE deal — fastest, one-thumb, vibe choice unavoidable.

### Swap picker organization
| Option | Description | Selected |
|--------|-------------|----------|
| Sectioned scroll sheet | One bottom sheet: Events → Albums → Songs (bucketed) → Search | ✓ |
| Tabbed picker | Tabs for Events/Albums/Songs/Search | |
| Smart-first list | Ranked best-fit shortlist + show-all + search | |

**User's choice:** Sectioned scroll sheet — everything in one flick, no tab-hunting in the dark.

### Catchability hint
| Option | Description | Selected |
|--------|-------------|----------|
| Honest fire-rate % | Measured recent-era fire-rate per card (Nonagon 60%, Microtonal 89%) | ✓ |
| Tier words + % | Friendly tier label AND the number | |
| Compact meter bars | 5-bar signal meter, no number | |

**User's choice:** Honest fire-rate % — on-brand with honest-% orbs and dex counts.

### Swap freedom
| Option | Description | Selected |
|--------|-------------|----------|
| Free, but dedupe | Pick anything; on-card items greyed to prevent dead duplicates; meter reacts; vibe→Custom | ✓ |
| Fully free | Allow duplicates, trust the meter to warn | |
| Constrained to vibe | Swaps only offer vibe-consistent items | |

**User's choice:** Free, but dedupe — preserves build agency, prevents a broken card.

### Deal ↔ Start Show connection
| Option | Description | Selected |
|--------|-------------|----------|
| Silent auto-lock | Start Show silently locks any draft; no bingo prompt in the core loop | |
| Nudge at Start Show | If no draft, show a dismissible "Deal a bingo card for tonight?" prompt | ✓ |
| Late-deal only path | No pre-show draft; deal during/after Start Show, locks immediately | |

**User's choice:** Nudge at Start Show — chose discoverability in the core loop over a silent path.
**Notes:** Overrode the "keep the trust-critical path clean" recommendation; the owner wants the prompt.

### Nudge frequency
| Option | Description | Selected |
|--------|-------------|----------|
| Every show, one-tap dismiss | Shows each Start Show without a card; "Not now" dismisses for that show | ✓ |
| Until "don't ask again" | Global suppression option | |
| First N shows only | Auto-quiets after 2–3 shows | |

**User's choice:** Every show, one-tap dismiss — no permanent suppression (owner plays most nights).

---

## Expected-fill / difficulty meter

### Computation
| Option | Description | Selected |
|--------|-------------|----------|
| Heuristic fire-rate estimate | Sum of per-square fire-rates, consume-once discounted; instant, pure | ✓ |
| In-browser Monte-Carlo | Replay bundled corpus against the card; honest but heavier | |
| Vibe band + coarse delta | Show vibe band + ↑/↓ arrow, no true recompute | |

**User's choice:** Heuristic fire-rate estimate — instant per-swap.
**Notes:** Planner to validate the heuristic's wording/thresholds against the calibration Monte-Carlo so it stays honest.

### Meter role
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent + soft warning | Always visible above board; amber "may not complete a line" below threshold; never blocks | ✓ |
| Purely informational | Shows number/words, never warns | |
| Only during swaps | Meter appears only inside the swap sheet | |

**User's choice:** Persistent + soft warning — guides without blocking.

### Swap-sheet hints
| Option | Description | Selected |
|--------|-------------|----------|
| React after pick | Candidates show fire-rate %; board meter updates on pick | ✓ |
| Amber-flag risky picks | Fire-rate % + amber dot on card-weakening picks | |
| Full per-candidate delta | Each candidate shows "+2 marks"/"→ line likely" | |

**User's choice:** React after pick — cleanest sheet, consistent with the sectioned-list decision.

---

## "One away" tension

### Near-miss display
| Option | Description | Selected |
|--------|-------------|----------|
| Glowing square + banner | Needed square pulses + a compact banner names it | ✓ |
| Glow only | Pulse the needed square, no text | |
| Banner only | Text banner, no square highlight | |

**User's choice:** Glowing square + banner — most visceral.

### Multi-line handling
| Option | Description | Selected |
|--------|-------------|----------|
| Show all, banner counts | Every needed square glows; banner aggregates | |
| Closest line only | Highlight just the single most-achievable near-miss | ✓ |
| Cap at ~2, aggregate rest | Glow up to two, note the rest | |

**User's choice:** Closest line only — calm over cluttered, one clear target at a time.
**Notes:** Tie-break "closest" by the needed square's fire-rate.

### Auto-mark "which song lit it"
| Option | Description | Selected |
|--------|-------------|----------|
| Mark toast + tap-to-reveal | Brief caption on mark, clean stamp stays, tap square to re-reveal | ✓ |
| Persistent tiny caption | Song name always shown small in each square | |
| Tap-to-reveal only | Just the stamp; tap to see the song, no live caption | |

**User's choice:** Mark toast + tap-to-reveal — satisfying live beat, uncluttered board.

### Which win shapes get one-away buildup
| Option | Description | Selected |
|--------|-------------|----------|
| Lines + blackout crown | One-away for lines + a special "one from blackout" callout; corners/X celebrate on completion only | ✓ |
| Lines only | Only lines; blackout arrives with no buildup | |
| All four shapes | Lines, four-corners, X, blackout all get one-away | |

**User's choice:** Lines + blackout crown — tension focused where it lands.

---

## Celebrations & share reveal

### Supernova behavior vs. live logging
| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking overlay | Blooms over the board, never blocks input, auto-fades ~2–3s | ✓ |
| Full-screen, auto-dismiss | Brief full-screen takeover (~2s) | |
| Full-screen, tap-to-dismiss | Cinematic, stays until tapped | |

**User's choice:** Non-blocking overlay — the live logging loop stays sacred.

### Four-corners / X moment
| Option | Description | Selected |
|--------|-------------|----------|
| Medium badge toast | Brief non-blocking badge toast, between stamp and supernova | ✓ |
| Just stamp + banner | Same weight as a normal mark | |
| Silent, recap only | No live acknowledgment | |

**User's choice:** Medium badge toast — a three-tier hierarchy (stamp < toast < supernova).

### Sound / haptics
| Option | Description | Selected |
|--------|-------------|----------|
| Purely visual | No sound, no haptics | ✓ |
| Haptic if available | Progressive-enhancement vibration where supported | |
| Optional sound toggle | Opt-in chime, default off | |

**User's choice:** Purely visual — honest about the platform (loud venue, no iOS vibration API).

### Share card content
| Option | Description | Selected |
|--------|-------------|----------|
| Board + badges + venue/date | Final 4×4 board + win badges + date + venue | ✓ |
| Board + badges + lit songs | Also per-square song labels | |
| Text stat-line | No grid, text-forward card | |

**User's choice:** Board + badges + venue/date — a clean visual trophy.

---

## Live board access during show

| Option | Description | Selected |
|--------|-------------|----------|
| Peek strip on LiveGizz | Collapsible mini-strip (board thumbnail + one-away + mark-toasts), tap to expand | ✓ |
| Tab-switch, app-wide toasts | Board only in GizzGames; toasts fire app-wide | |
| Toggle full board on LiveGizz | Segment/swipe between predictions and full board | |

**User's choice:** Peek strip on LiveGizz — keeps the light-up magic in view without crowding predictions.

---

## Share-flow trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Recap + replay history | Auto-offered in post-show recap AND on any past replay card | ✓ |
| Recap only | Only in the post-show recap | |
| Replay history only | Only from GizzGames replay, no post-show prompt | |

**User's choice:** Recap + replay history — offered at the win and re-shareable later.

---

## Reduced-motion fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Static badge + crossfade | Supernova → static badge crossfade; stamps → opacity fade; no motion | ✓ |
| Instant, no animation | Instant state changes, no transitions | |
| Gentler motion | Smaller/slower burst | |

**User's choice:** Static badge + crossfade — the correct reduced-motion pattern, same payoff.

---

## Live board accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| Announce key moments | ARIA live region announces marks/one-away/wins | |
| Labeled, no announcements | Labeled focusable toggle buttons, no auto-announce | ✓ |
| Follow Phase-8 patterns | Leave to planner discretion | |

**User's choice:** Labeled, no announcements — proportionate for a <10-user personal tool.

---

## Claude's Discretion

- Heuristic estimator formula + consume-once discount factor + threshold constants (D-10), and where they live in `config.bingo`.
- Reshuffle vibe-retention + custom-swap-loss confirmation (D-06).
- Cover-art source for song chips (research whether a dex album-art asset exists; degrade to text chip if not).
- Animation timings/easings for stamps, toasts, supernova (within the locked policy).
- Peek-strip expand interaction (route to GizzGames tab vs. in-place overlay).
- Layout/copy of deal screen, swap sheet, meter, recap/replay share entry points.

## Deferred Ideas

- Permanent "don't ask again" for the Start-Show nudge.
- Per-candidate delta hints / amber-flagged risky picks in the swap sheet.
- ARIA live-region announcements for marks/one-away/wins.
- In-browser Monte-Carlo runtime fill meter.
- One-away buildup for four-corners / X.
- Celebration sound / haptics.
- Shared-seed leaderboard, segue squares, pre-2020 replay event types (future scope per Phase 14/15).

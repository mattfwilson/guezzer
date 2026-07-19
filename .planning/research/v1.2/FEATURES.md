# Feature Research — Gizz Bingo (v1.2)

**Domain:** Live auto-marking bingo / second-screen fan-engagement mini-game (bolt-on to an existing setlist-prediction PWA)
**Researched:** 2026-07-19
**Confidence:** MEDIUM-HIGH (digital-bingo + second-screen UX patterns verified across multiple sources; the corpus fire-rate facts and all v1 design decisions come pre-vetted from `.planning/notes/gizz-bingo-design-vetting.md` — this file extends, never contradicts, that vetting)

> **Scope note.** This file researches ONLY the four open UX gaps the vetting doc left: (1) win-detection & reveal UX, (2) fun-vs-boring for passive-recognition games, (3) card-build UX conventions, (4) small fun-amplifiers for a <10-friend residency. The card size (4×4), consume-once marking, event catalog, base-rate seeding, GizzGames tab, lock-on-start, solo-v1/no-leaderboard, and replay-past-cards decisions are **already vetted and OUT of scope to re-litigate.** Every recommendation below is expressed as an observable user behavior for the requirements writer.

---

## The One Load-Bearing Insight (read this first)

**Auto-marking is the concept's greatest strength AND its single biggest boredom risk.** The clearest signal in the ecosystem: online bingo's auto-daub "removes the visual scanning and motor skills that are part of the traditional bingo experience" — the most auto-daub-heavy titles (Bingo Blitz) are described as "the most passive" games where "your cards can win rounds without you actively watching." A game that marks itself, with nothing else, is a screensaver.

But the vetting doc's whole premise is that the marking should be automatic — the +1 who knows zero songs *can't* daub manually, and the driver is the tracker, not the player. So the fun **cannot live in the marking act.** It has to live in the other three moments:

1. **Up-front agency** — the card the player *built* (deal + vibe + swap + meter). This is the only choice they make, so it must feel meaningful.
2. **Live tension** — "am I one away?" surfaced continuously. Sports second-screen bingo (Match Bingo, Sideline Sports) wins precisely because "squares light up in real time as the action unfolds" AND the player can *feel themselves getting close.* Without near-miss surfacing, an auto-marking card is just a slowly-filling grid.
3. **The reveal** — the stamp, the line, the blackout supernova (already vetted). Immediate, synced-to-live-action visual feedback is universally cited as the line between engaging and boring.

Everything below serves those three moments. **The requirements must treat near-miss/proximity surfacing (item 2) as table stakes, not polish** — it is the mechanic that converts passive auto-marking from boring to sticky.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the auto-marking card feel like a screensaver instead of a game.

| Feature | Observable user behavior | Why expected | Complexity | Dependency on existing features |
|---------|--------------------------|--------------|------------|--------------------------------|
| **Instant mark on log** | When the user (or live sync) logs a song, the matching square visibly stamps within the same frame the trail/tally update | Every live-bingo analog cites "squares light up in real time as the action unfolds" as the defining feel; any lag "breaks the real-time connection to live events" | LOW | Reuses the `logSong` → Dexie `liveQuery` derivation path (card marking is a 3rd pure-core derivation alongside tally + comet trail, per vetting) |
| **"One away" / near-miss surfacing** | Any line that needs exactly one more square shows a distinct "1 away" state (e.g. the two/three lit squares glow, the empty square pulses); count of active near-lines is visible at a glance | This is THE tension mechanic. Auto-marking without it = passive screensaver. Validators market "instant winner alerts"; the missing gap in every consumer app is *pre-win* proximity — surfacing it is the cheap, high-impact differentiator | MEDIUM | Pure-core: derive per-line completion counts from the marked-square set. No new plumbing |
| **Live progress readout** | The card shows marks-so-far and (from vetting) the expected-fill context, so a novice always knows "is this going well?" without knowing any songs | Engaging second-screen apps give "immediate visual feedback… an extension of watching the game." Novices need a legibility anchor since they can't read the songs themselves | LOW | Reuses expected-fill calc from the build meter |
| **Win moment that reads instantly** | On first line and on blackout, a full-surface celebration fires (per vetting: orb-stamp per square always; supernova on first-line + blackout) that is unmistakable one-thumb-in-the-dark | "Creating animations when a player wins" and "highlighting winning [squares]" are universal. The win must not be a subtle state change | LOW-MEDIUM | Reuses orb renderer (stamp) + constellation galaxy backdrop (supernova) + `useReducedMotion` — all already built |
| **Which square just marked** | When a square marks, the user can tell *which* song/event triggered it (brief label/toast or the stamped square momentarily labeled) | Recognition is the reward loop for the passive player — "oh, THAT lit my square." Without it the grid fills anonymously | LOW | Reuses the logged-song data already flowing through the trail |
| **One-tap "Deal my card"** | From the GizzGames tab, one tap produces a complete, playable 4×4 card — never a blank grid to fill manually | Real bingo apps never make you build a card cell-by-cell; auto-generation is the friction floor. A blank card is a non-starter for a casual +1 | LOW-MEDIUM | Pure-core generator over base-rate corpus data + event catalog (vetted) |
| **Locked-card clarity** | After Start Show, the card visibly switches to a frozen/live-marking state; the user understands they can no longer swap | Users must trust the card can't change under them mid-show (parallels the SW `registerType:'prompt'` "never swap mid-show" principle already in the project) | LOW | Reuses the Start Show lifecycle event |
| **Reduced-motion honoring** | With reduced-motion enabled, stamps/supernova degrade to instant state changes, no large motion | Accessibility is table stakes and already threaded project-wide | LOW | `useReducedMotion` already threaded |

### Differentiators (Competitive Advantage)

These are where Gizz Bingo beats both the static KGLW bingo PDF and generic bingo apps. All are low/medium cost because they reuse existing Guezzer machinery.

| Feature | Value proposition | Observable user behavior | Complexity | Dependency |
|---------|-------------------|--------------------------|------------|------------|
| **Live auto-marking from the real tracker** | The whole premise; no fan bingo product auto-marks from a live setlist feed (the static PDF project can't) | Squares mark themselves as the show is tracked/synced with zero user action | LOW-MEDIUM (core done via derivation) | Live `latest` sync + tracker (existing) |
| **Vibe pick at deal time** | Turns a random card into a *chosen* identity (Chill / Balanced / Glory-hunter) — the up-front agency that replaces the missing "marking" agency | User picks a vibe before/at deal; the resulting card's risk profile visibly differs (more reliable events vs more rare glory squares) | LOW-MEDIUM | Generator weighting only |
| **Tap-to-swap square builder** | Low-friction personalization without a blank-card build; the player shapes their card in seconds | User taps any square pre-lock → sees suggestions (album/event cards with catchability hints; song chips with cover art; search escape hatch) → swaps in one tap | MEDIUM | Reuses cover-art assets + fuzzy search (existing) |
| **Live expected-fill / difficulty meter** | Makes the abstract "is this card winnable?" legible while building — the calibration insight (target ~15 expected marks) surfaced as UX | As the user swaps squares, a meter updates showing expected fill / difficulty, steering them away from an all-rare unwinnable card | MEDIUM | Pure-core base-rate math (vetted) |
| **"You called it!" rare-song moment** | The vetted rare-bonus framing: when one of the 2–3 song squares hits (≤34% base rate), it's a genuine thrill *because* it's rare | When a specific-song square marks, it gets a louder, distinct celebration than an event square ("YOU CALLED IT") | LOW | Marking pipeline + a rarity flag on the square def |
| **"Never caught" personal-glory square** | Ties bingo into the existing Pokédex — a square that marks only when the user catches a song they've never seen live | If a logged song is absent from the user's dex, that square fires with personal-glory framing | LOW-MEDIUM | Reads GizzDex catch data (existing) |
| **Bust-out / rarity glory square** | Line-gating "crown" square (21% fire rate) gives the card a rare high-status target | A bust-out (corpus gap ≥50 shows) marking triggers a distinct rare celebration | LOW | Reuses corpus gap computation (existing gap stat) |
| **Persisted replay card** | Past shows in GizzDex re-render the frozen card + final marks + win state — a collectible artifact, not a throwaway | Opening a past show shows its card exactly as it locked, with which squares lit and whether it won | MEDIUM | Dexie persistence + pure re-derivation (vetted); reuses GizzDex show pages |
| **Shareable result card** | The friend-group comparison mechanic WITHOUT a leaderboard — async, screenshot-native | After a show, one tap generates a share-card image of the final card + win state | LOW-MEDIUM | Reuses existing share-card canvas |
| **Night-to-night streak (residency-aware)** | The residencies are 3 consecutive no-repeat nights — a "lined 3 nights running" streak is free flavor that fits the exact 2026 use case | Across a residency, the tab surfaces a running streak (e.g. "3/3 nights got a line") on the personal history | LOW-MEDIUM | Reuses per-show win-state persistence + existing run/residency awareness |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why it'll be requested | Why problematic | Alternative |
|---------|------------------------|-----------------|-------------|
| **Manual daub / tap-to-mark** | "Traditional bingo lets me daub" | Contradicts the auto-marking premise; the +1 can't identify songs to daub them; introduces disputes ("that didn't count") and a second source of truth vs the tracker | Auto-mark only; give the player agency at *build* time, not mark time |
| **Live shared/multiplayer card state** | "We should all see each other's cards fill" | Requires backend/sync in a no-signal venue — the exact thing the whole project refuses. Leaderboard already deferred (`gizz-bingo-shared-leaderboard`) | Async shareable result card; verbal/screenshot comparison between friends |
| **Real-time leaderboard / scoring race** | FantasyPhish/callingit.live competitive dopamine | Explicitly deferred in vetting; needs accounts + shared state + dispute handling | Streaks + share cards give competitive flavor with zero infrastructure |
| **Power-ups / instant-daub / extra-ball mechanics** | Every commercial bingo app monetizes these | Pay-to-win casino mechanics are off-mission for a personal tool with no monetization; they add strategy the passive +1 doesn't want | None — the game's "strategy" is the one-time card build |
| **Covers / encore / Set-2 squares** | They *feel* like classic bingo events | Empirically DEAD in the modern era (2%/0%/2% fire rates) — guarantees dark squares and an unfillable card (vetting OVERTURNED these) | Album-membership + segue/microtonal/jam/opener/bust-out squares (the vetted catalog). Re-enable only on pre-2020 replay cards |
| **5×5 card** | It's the "real" bingo grid | Blackout is mathematically impossible on a median 15-song show; card tops out ~60% lit; worse one-thumb legibility (vetting DECIDED 4×4) | 4×4 (15 fillable + free center) |
| **Predict-the-setlist as the core loop** | "It's a prediction app, make bingo predict songs" | Songs hit ≤34%; a song-heavy card frustrates. False precision destroys trust the backtest gate protects | Event-weighted card (~12–13 event / 2–3 song); prediction as rare "you called it" bonus |
| **Live chat / social feed on the card** | Commercial bingo cites chat as its stickiest feature | <10 friends who are physically together at the show — the venue *is* the chat. Backend-dependent | They talk to each other. Share card is the only digital social surface |
| **Push "you're one away!" notifications** | Concert/bingo apps train this | iOS PWA push is fragile; no server; the phone is already in-hand at the show | Surface "one away" in-app on the live card only |
| **Auto-generated card with no swap/vibe control** | "Just deal it, keep it simple" | Removes the ONLY agency the passive player has — collapses back into the boredom risk | Keep deal one-tap AND keep vibe + swap + meter as the agency layer |

---

## Deep-Dive on the Four Open Questions

### Q1 — Win-detection & reveal UX

The gap in every consumer bingo app is that they surface the *win* (validators do "instant winner alerts") but not the *approach to winning.* For an auto-marking game the approach is where all the tension lives. Recommended feedback loop, escalating:

1. **Square marks** → per-square orb stamp + brief "which song did it" (always, quiet). *Table stakes.*
2. **Line reaches "one away"** → the incomplete line enters a distinct pulsing/glowing state; a small persistent "N lines one away" readout updates. *Table stakes — this is the missing mechanic in commercial apps and the cheapest win here.*
3. **First line completes** → supernova celebration (vetted, big-moment). *Table stakes.*
4. **Rare-square marks (song / bust-out / never-caught)** → louder, distinct "you called it" celebration regardless of line state. *Differentiator.*
5. **Blackout** → the crown celebration (vetted, rarest). *Table stakes.*

**Design rule surfaced by research:** don't spoil tension by pre-announcing near-wins too early. Only escalate to the pulsing "one away" state at exactly one-square-remaining, not at two/three — otherwise the whole card glows all night and the signal is worthless. Anticipation ("brief countdown creates suspense… building emotional momentum") is real but Gizz Bingo's pacing is driven by the show, not a draw timer, so lean on the "one away" pulse as the suspense surface rather than an artificial countdown.

### Q2 — Fun vs boring (passive-recognition games)

Synthesis of the sports second-screen + auto-daub findings:

**What makes them fun:** real-time sync to the live event ("feels like an extension of watching the game rather than a separate activity"); immediate vivid visual feedback; low-commitment "entertainment during downtime"; a felt sense of getting close.

**What makes them boring:** lag/jank that "breaks the real-time connection"; pure passivity with no agency or proximity signal (the Bingo-Blitz-auto-daub failure mode); repetitive/cumbersome interfaces.

**Implication for Gizz Bingo:** it is *structurally* a passive-recognition game (the +1 watches squares light up). That's fine — sports bingo proves passive can be sticky — **but only if paired with (a) the up-front build agency and (b) continuous near-miss tension.** The requirements should therefore refuse to ship "deal a card and watch it fill" alone. The near-miss surfacing (Q1 item 2) and the build agency (Q3) are the two non-negotiable anti-boredom levers.

### Q3 — Card-build UX conventions

The vetting's proposed flow (one-tap deal → vibe pick → tap-to-swap → reshuffle → expected-fill meter) is **validated and slightly ahead of the ecosystem.** Real bingo apps auto-generate cards (never blank-build) and let players select among pre-made cards, but they rarely give *semantic* swap control because their squares are just numbers. Gizz Bingo's squares are meaningful (albums, events, songs), so tap-to-swap-with-hints is a genuine differentiator, not just parity.

Conventions to honor:
- **Never present a blank card.** Deal produces a complete playable card. *Table stakes.*
- **Deal is one tap; refinement is optional.** A user who wants zero friction taps Deal → Start and never swaps. *Table stakes.*
- **Reshuffle = re-deal, not per-square randomize** (keeps the mental model of "give me a fresh card"). *Low.*
- **The meter must update live as swaps happen** so the player learns the risk/reward of rare squares by doing. *Medium.*
- **Vibe pick before deal** sets the whole card's risk profile in one choice — the lowest-friction way to express intent. *Low-Medium.*

One caution the meter must enforce: a naive builder who swaps every square for a rare glory event makes an unwinnable card. The expected-fill meter is the guardrail that keeps the "instant-blackout trap is a non-issue / real risk is under-filling" insight visible to the user.

### Q4 — Small fun-amplifiers for a <10-friend residency (no leaderboard)

All of these deliver friend-group competitive flavor asynchronously, never reopening the deferred leaderboard:

- **"You called it!" rare-song moment** (differentiator above) — the single best amplifier; costs almost nothing and is emotionally the loudest beat.
- **Night-to-night streak** — the 2026 runs are literally 3 consecutive no-repeat nights; "got a line 3/3 nights" is a natural, free streak that fits the exact use case. Reuses per-show win-state + existing residency awareness. *Low-Medium.*
- **Shareable result card** — the async comparison surface. Friends screenshot and compare in the group chat / in person. Reuses the existing share-card canvas. *Low-Medium.*
- **Personal-best / rarest-square memory** — surface "your rarest square lit this run" in the history, tying into the existing rarest-catch framing. *Low.*

Explicitly do **not** add: real-time cross-friend visibility, a points ladder, or head-to-head scoring — all require the shared state the project refuses. Comparison stays human (they're in the same room) and async (share card).

---

## Feature Dependencies

```
Live setlist tracker + logSong + Dexie liveQuery   (EXISTING)
    └──drives──> Card auto-marking (pure-core, 3rd derivation)   [P1]
                     ├──feeds──> Per-square orb stamp (reuse orb renderer)   [P1]
                     ├──feeds──> "One away" / near-miss surfacing   [P1]
                     ├──feeds──> First-line + blackout supernova (reuse galaxy backdrop)   [P1]
                     └──feeds──> "You called it" / bust-out / never-caught celebrations   [P2]

Live `latest` sync + adopt-suggestion path   (EXISTING)
    └──enables──> "Catch me up" bulk-adopt for late joiners   [P2]

Base-rate corpus + event catalog + tuning tags   (EXISTING data)
    └──required by──> Card generator (Deal / vibe / reshuffle)   [P1]
                          └──required by──> Expected-fill / difficulty meter   [P1]
                                                └──required by──> Tap-to-swap builder   [P2]

Start Show lifecycle event   (EXISTING)
    └──required by──> Lock-on-start (freeze card)   [P1]

Dexie persistence + GizzDex show pages   (EXISTING)
    └──required by──> Replay card artifact (frozen defs + marks + win state)   [P2]

Share-card canvas   (EXISTING)
    └──required by──> Shareable result card   [P2]
                          └──enhances──> Night-to-night streak display   [P3]

GizzDex catch data + gap computation   (EXISTING)
    └──required by──> "Never caught" + bust-out glory squares   [P2]

useReducedMotion (threaded)   (EXISTING)
    └──required by──> All celebration animations   [P1]

New GizzGames bottom tab (LiveGizz / GizzVerse / GizzDex / GizzGames)   [P1]
    └──hosts──> build/reshuffle (pre-show) · live marking (during) · card history (after)
```

### Dependency Notes

- **Card marking requires nothing new** — it is a third pure-core derivation over the trail, recomputed on every `logSong` via the same Dexie `liveQuery` that already powers the tally and comet trail. No new sync plumbing (vetted architecture fit).
- **"One away" surfacing depends only on the marked-square set** — a pure per-line completion count. It is cheap yet it is the highest-leverage anti-boredom mechanic, so it belongs in P1, not deferred to polish.
- **The build agency (deal/vibe/swap/meter) and the near-miss surfacing are the two boredom-prevention pillars** — if either slips, the feature degrades to a passive screensaver. Treat both as launch-blocking for the feature (not for the show-#1 core bar, which Gizz Bingo is explicitly not part of).
- **Every celebration reuses an existing renderer** (orb stamp, galaxy supernova, share-card canvas), so the visual payoff is high-value / low-cost — the celebrations are where to spend polish, and the machinery already exists.
- **Late-joiner "Catch me up" reuses the existing adopt-suggestion path** — no bespoke catch-up mode, just a bulk-adopt from the live `latest` feed.

## MVP Definition (feature-scoped)

### Launch With (Gizz Bingo v1 — after the v1.2 bugs, before/around the shows)

- [ ] One-tap **Deal my card** → complete 4×4 card, never blank — the entry point
- [ ] **Vibe pick** (Chill / Balanced / Glory-hunter) — the up-front agency pillar
- [ ] **Expected-fill / difficulty meter** — the winnability guardrail
- [ ] **Auto-marking** on every logged/synced song (consume-once, greedy assignment) — the premise
- [ ] Per-square **orb stamp** on mark + "which song lit it" — the recognition reward
- [ ] **"One away" / near-miss surfacing** — the tension pillar (do NOT defer)
- [ ] **First-line + blackout supernova** celebrations, reduced-motion aware — the reveal
- [ ] **Lock-on-Start-Show** (freeze card) — trust
- [ ] **GizzGames tab** hosting build → live → history states

### Add After Validation (v1.x)

- [ ] **Tap-to-swap builder** with catchability hints + cover art + search — trigger: deal+vibe proves too coarse; friends want to personalize
- [ ] **"You called it" / bust-out / never-caught** distinct celebrations — trigger: base marking loop feels flat; add the rare-glory beats
- [ ] **Replay card** in GizzDex past shows — trigger: first tracked show completes with a card
- [ ] **Shareable result card** — trigger: friends actually ask to compare
- [ ] **"Catch me up" late-joiner bulk-adopt** — trigger: someone arrives mid-show
- [ ] **Night-to-night streak** — trigger: a residency (3 nights) is underway

### Future Consideration (deferred)

- [ ] Shared leaderboard / real-time cross-friend cards — explicitly deferred (`gizz-bingo-shared-leaderboard`); needs backend the project refuses
- [ ] Pre-2020-era replay cards that re-enable cover/encore/Set-2 squares — only if replay proves popular
- [ ] Additional win patterns beyond line/corners/X/blackout — only if the four vetted patterns feel thin

## Feature Prioritization Matrix

| Feature | User Value | Impl. Cost | Priority |
|---------|-----------|-----------|----------|
| Auto-marking (consume-once) | HIGH | LOW-MED | P1 |
| One-tap Deal + vibe pick | HIGH | LOW-MED | P1 |
| Expected-fill meter | HIGH (winnability) | MED | P1 |
| "One away" near-miss surfacing | HIGH (the tension) | MED | P1 |
| Per-square stamp + "what lit it" | HIGH (recognition) | LOW | P1 |
| First-line + blackout supernova | HIGH (the reveal) | LOW-MED | P1 |
| Lock-on-start | HIGH (trust) | LOW | P1 |
| GizzGames tab | HIGH (home) | LOW-MED | P1 |
| Tap-to-swap builder | MED-HIGH | MED | P2 |
| "You called it" rare-song beat | HIGH (loudest joy) | LOW | P2 |
| Never-caught / bust-out glory squares | MED-HIGH | LOW-MED | P2 |
| Replay card artifact | MED-HIGH | MED | P2 |
| Shareable result card | MED | LOW-MED | P2 |
| Catch-me-up late joiner | MED | LOW | P2 |
| Night-to-night streak | MED | LOW-MED | P3 |
| Personal-best / rarest-square memory | LOW-MED | LOW | P3 |

## Competitor Feature Analysis

| Feature | Static KGLW bingo PDF (reeserich) | Commercial bingo apps (Bingo Blitz/Bash) | Sports second-screen (Match Bingo/Sideline) | Gizz Bingo's approach |
|---------|-----------------------------------|------------------------------------------|---------------------------------------------|----------------------|
| Marking | Manual pen/mental | Auto-daub or manual dauber | Auto-fill from live match events | Auto-mark from the real tracker/live sync (consume-once) |
| Card creation | Fixed printed grid | Pick from pre-made cards | Randomly generated per event | One-tap deal + vibe + swap + meter (semantic squares) |
| Near-miss tension | None | Winner alert only | "Squares light up in real time" | Explicit "one away" pulsing + readout (the gap others miss) |
| Win reveal | Self-declared | Animated win + validation | Pattern-complete animation | Orb stamp + first-line/blackout supernova |
| Social | Print & share paper | Live chat, leaderboards | Chat, prizes | Async share card + streak; NO backend/chat/leaderboard |
| Squares | Song titles | Numbers | Game events | Album-membership (variety engine) + events + rare songs |
| Monetization | Free PDF | Power-ups, IAP | Real-cash prizes | None — personal tool |

## Sources

- Auto-daub reduces engagement / "most passive" auto-daub titles (MEDIUM confidence): [LiveScore — Auto Daub Pros and Cons](https://www.livescore.com/en-gb/bingo-sites/strategy/pros-and-cons-of-using-auto-daub/), [Emory Wheel — Daubing in the Digital Age](https://emorywheel.com/daubing-in-the-digital-age-tips-for-successful-online-bingo-play/)
- Reveal/anticipation, instant highlight, blinking-border feedback, social/progression mechanics (MEDIUM confidence): [Galaxy4Games — Bingo Game Development](https://galaxy4games.com/en/knowledgebase/blog/bingo-game-development-features-mechanics-and-monetization), [GammaStack — Top 10 Features of Online Bingo](https://www.gammastack.com/blog/top-10-features-of-a-trusted-online-bingo-game/)
- Sports second-screen bingo: real-time event sync, "extension of watching the game," lag = boring (MEDIUM confidence): [The Sports News Blitz — Interactive Bingo Platforms](https://www.thesportsnewsblitz.com/news/interactive-bingo-platforms-are-attracting-a-new-generation-of-sports-fans), [Match Bingo](https://www.matchbingo.co.uk/), [Sideline Sports](https://playsidelinesports.com/)
- Win-validation / "instant winner alerts" pattern (MEDIUM confidence): [Bingo/Housie Validator Tracker](https://apps.apple.com/us/app/bingo-housie-validator-tracker/id943069295)
- All corpus fire-rates, card-size math, event catalog, seeding, lock/replay/celebration decisions (HIGH confidence — pre-vetted): `.planning/notes/gizz-bingo-design-vetting.md`
- Prediction-game / share-card / no-backend friend-group context (HIGH confidence, prior research): `.planning/research/FEATURES.md` (v1.0)

---
*Feature research for: Gizz Bingo (live auto-marking bingo mini-game) — v1.2*
*Researched: 2026-07-19*

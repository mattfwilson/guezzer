# Phase 16: Gizz Bingo — Build, Live Marking & Celebrations - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **playable, fun surface** on top of the finished Gizz Bingo engine — the two
anti-boredom pillars (**build agency** + **near-miss tension**), the **celebrations**, and
a **shareable result**. Fun lives in the build, the "one away" tension, and the reveal —
**not** the marking act. Delivers **BINGO-01** (deal + vibe), **BINGO-02** (reshuffle/swap +
live fill meter), **BINGO-04** (live auto-mark + "one away"), **BINGO-05** (celebrations),
**BINGO-08** (share card).

**In scope (this phase is almost entirely UI/UX + thin new core helpers):**
- The **Deal + vibe** build entry (BINGO-01) and the **per-square swap** sheet + whole-card
  **reshuffle** (BINGO-02), replacing the Phase-15 "Deal — coming soon" stub in `GamesView`.
- A **live expected-fill / difficulty meter** (BINGO-02) — needs a **new pure-core pre-lock
  estimator** (today's `expectedFill` only scores an already-*marked* card).
- The **live auto-marking surface** — per-square stamp, "which song lit it," and **"one away"
  tension** (BINGO-04), reachable during a show without crowding the trust-critical LiveGizz
  prediction UI.
- **Celebrations** (BINGO-05) — per-square stamps throughout, big supernova on **first line +
  blackout only** (≤2 big moments/show), medium badge toasts for the lesser wins, reduced-motion
  aware.
- **Share card** (BINGO-08) — a bingo result image reusing the existing share-card canvas.

**Out of scope (already shipped upstream — do NOT re-litigate or rebuild):**
- The **engine** — `deal()`, `deriveMarks` (consume-once fold), `detectWins`
  (line/four-corners/X/blackout), `expectedFill` all exist in `packages/core/src/bingo/`
  (Phase 14). **Calibration constants + rosters are locked & gate-green** in `config.bingo`
  (Phase 14). **Do not touch the fold or re-calibrate.**
- **Persistence, lock-on-Start-Show, freeze-resolved-defs, export/import, catch-up, and GizzDex
  replay** all shipped in Phase 15. This phase *drives* that machinery (dealing a draft, locking
  at Start Show) — it does not rebuild it.
- New dependencies, new build-time data artifacts, segue squares, shared-seed leaderboard —
  all excluded.

**Marks are DERIVED, never stored** (D-23 from Phase 14). The card locks at Start Show; a
locked card's reshuffle/swap controls are greyed with a "Locked at Start Show" explainer (D-10
from Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Build & swap surface (BINGO-01 / BINGO-02)
- **D-01:** **The three vibe buttons ARE the deal action.** One screen with three big buttons —
  **Deal Chill** / **Deal Balanced** / **Deal Glory-hunter** — each with a one-line gamble hint
  (e.g. "lines come easy" / "a fair fight" / "boom or bust"). Tapping any one immediately deals a
  full card. Fastest, one-thumb, vibe choice explicit and unavoidable. Never a blank grid.
- **D-02:** **Swap picker = a single sectioned, scrollable bottom sheet** (matches the app's
  existing bottom-sheet pattern), sections in fixed order: **Events → Albums → Songs (grouped by
  likelihood bucket, e.g. "likely" / "a stretch") → Search**. Everything reachable in one flick;
  no tab-hunting in the dark. Search is the escape hatch (reuse fuse.js catalog search).
- **D-03:** **Catchability hint = the honest measured recent-era fire-rate %** per card
  (e.g. Nonagon 60%, Microtonal 89%, Bust-out 21% 🌟). On-brand with the honest-% prediction orbs
  and honest dex counts. These numbers already come from the calibration corpus — no new data.
- **D-04:** **Swaps are free but deduped.** Pick anything from the menu, but items already on the
  card are greyed/hidden so the user can't create a **dead duplicate square** (consume-once means
  a duplicate event/album/song can never mark twice). The fill meter updates live; the **vibe
  label flips to "Custom"** once the card deviates from the dealt vibe.
- **D-05:** **Swap candidates show only their fire-rate %; the board meter reacts after you pick.**
  No per-candidate delta hints and no amber-flagged candidates inside the sheet — keeps the sheet
  clean and glanceable in the dark (consistent with D-02). Mild trial-and-error is accepted; the
  persistent board meter (D-08) is where consequences show.
- **D-06:** **Reshuffle re-deals the whole card** (roadmap SC-2); per-square **swap** handles the
  individual case (D-02). *(Claude's discretion: whether reshuffle keeps the current vibe and
  whether it confirms before discarding hand-made custom swaps — a sensible "keep vibe, confirm if
  customized" default is fine.)*

### Deal ↔ Start Show connection
- **D-07:** **A draft card persists unlocked** (like the setlist trail) and **Start Show locks it**
  (Phase-15 machinery). Build/reshuffle unlocked anytime pre-lock.
- **D-08 (touches the core loop — intentional):** **Nudge at Start Show.** If **no draft card
  exists** when the user taps Start Show, show a **dismissible "Deal a bingo card for tonight?"**
  prompt (`[Deal]` → routes to the GizzGames build; `[Not now]` dismisses). The owner explicitly
  chose discoverability at Start Show over a silent path.
- **D-09:** **Nudge frequency = every show without a card, one-tap "Not now" dismiss** for that
  show. **No permanent "don't ask again" suppression** in v1 (the owner attends 3-night residencies
  and expects to play most nights).

### Expected-fill / difficulty meter (BINGO-02)
- **D-10:** **A NEW pure-core heuristic estimator** computes expected fill from the card
  composition (sum of per-square fire-rates, **discounted for consume-once competition** since
  squares compete for the same logged songs). Instant, recomputes on every swap, **no runtime
  Monte-Carlo**. It is an *approximation* of the true P(line). **Planner note:** validate/tune the
  heuristic's thresholds and its "line likely" wording **against the existing calibration
  Monte-Carlo** so the meter stays honest — this is the trust discipline the app holds everywhere.
- **D-11:** **Meter display** = a fill bar + expected marks ("~11/15") + a one-line line/blackout
  likelihood caption ("line likely · blackout: unlikely"). Both line and blackout odds shown.
- **D-12:** **Meter is persistent above the board with a soft warning** — always visible; turns
  **amber** with a quiet "this card may not complete a line" note when expected fill drops below a
  likely-line threshold. **Guides, never blocks** — a long-shot Glory card can still be locked on
  purpose.

### "One away" tension & live auto-mark (BINGO-04)
- **D-13:** **One-away feedback = glow the exact needed square + a compact banner** naming what you
  need (e.g. "🔥 One away — need a Microtonal song!"). The square that would complete the line
  pulses with a highlight ring. Most visceral form of the near-miss pillar.
- **D-14:** **Show the single CLOSEST near-miss only.** When several lines are one-away at once,
  surface just the most-achievable one (its glowing square + one banner) — calm over a lit-up
  board, one clear target at a time. *(Planner: tie-break "closest" by the needed square's
  fire-rate — the most-achievable near-miss wins.)*
- **D-15:** **One-away buildup fires for lines + a special blackout crown callout.** Lines get the
  common "🔥 One away" treatment; being one square from blackout gets a distinct **"👑 ONE SQUARE
  FROM BLACKOUT"** callout. **Four-corners / X do NOT get one-away buildup** (obscure to a casual
  +1) — they still celebrate on completion (D-18).
- **D-16:** **Auto-mark moment = brief mark-toast + tap-to-reveal.** The instant a logged song
  marks a square, a caption flashes ("✦ Gaia lit Microtonal!") then fades, leaving a clean stamp;
  **tapping any marked square** later re-reveals which song lit it. Satisfying live beat,
  uncluttered 4×4 board, info always retrievable. (Replay's persistent per-square detail is
  already Phase-15 D-06.)

### Celebrations (BINGO-05)
- **D-17:** **Supernova = a non-blocking overlay.** The big moment (first line / blackout) blooms
  over the board (galaxy backdrop + orb burst) but **never blocks input** — the user can keep
  logging through it; it auto-fades in ~2–3s. Safety for the trust-critical live logging loop is
  paramount (missing the next song would hurt).
- **D-18:** **Three-tier celebration hierarchy:** per-square **stamp** (every mark) < **medium
  badge toast** (four-corners, X, and *subsequent* lines after the first — e.g. "✨ Four corners!",
  non-blocking, ~2s) < **supernova** (first line + blackout only, ≤2 big moments/show, D-17).
  A real win is always acknowledged live without spending a "big moment."
- **D-19:** **Purely visual — no sound, no haptics.** A loud venue drowns sound and iOS Safari/PWA
  has no reliable vibration API (target device is iPhone). Consistent with the app today. All
  payoff is on-screen.
- **D-20:** **Reduced-motion fallback = static badge + crossfade.** The supernova becomes a static
  full-bloom badge that crossfades in/holds/out (no particles, no scale/translate); mark-stamps
  appear via a simple opacity fade. Same information and payoff, zero vestibular motion — the
  correct reduced-motion pattern (not merely a smaller burst). Reuse the already-threaded
  `useReducedMotion`.

### Live board access during a show
- **D-21:** **A collapsible bingo "peek strip" on the LiveGizz show screen.** Songs are logged on
  LiveGizz (the trust-critical prediction surface) but the full board lives in GizzGames; the peek
  strip (board thumbnail + the D-14 one-away banner + it hosts the D-16 mark-toasts) keeps the
  "light up" magic in view **without displacing the orbit predictions**. **Tap the strip → expand
  to the full board.** The strip appears only when a card is locked/active. Mark-toasts and
  celebrations fire **app-wide** regardless of which tab is showing.

### Share reveal (BINGO-08)
- **D-22:** **Share card content = the final 4×4 board (stamped squares + free center) + win
  badges (line / four-corners / X / blackout) + show date + venue.** A clean visual trophy —
  "here's my card from KGLW at X." Not the denser per-square "which song lit it" (that's the
  in-app replay payoff, Phase-15 D-06). Reuse the existing share-card canvas + galaxy aesthetic.
- **D-23:** **Share surfaces in the post-show recap AND from GizzGames replay history.** Auto-
  offered in the RecapView bingo section (Phase-15 D-05) right at the win, and re-shareable from
  any past card in GizzGames history. Reuses the existing recap-share slot.

### Live board accessibility
- **D-24:** **Squares are labeled, focusable toggle buttons** (marked / unmarked + lit-by), but
  **NO ARIA live-region auto-announcements** for marks / one-away / wins in v1. Proportionate for a
  <10-user personal tool whose owner is not a screen-reader user; keeps scope tight while still
  honoring the Phase-8 labeling discipline. *(Re-openable later if a screen-reader user appears.)*

### Claude's Discretion
- The concrete heuristic formula + its consume-once discount factor and threshold constants for
  D-10 (subject to the D-10 validation-against-Monte-Carlo note); where these constants live
  (extend `config.bingo`, no scattered magic numbers).
- Reshuffle vibe-retention + custom-swap-loss confirmation behavior (D-06).
- Cover-art source for the model-bucketed song chips (D-02) — **research whether an album/cover-art
  asset already exists** (`data/normalized/dex-albums.json` / dex album art) before assuming one is
  needed; degrade gracefully to a text chip if not.
- Exact animation timings/easings for stamps, toasts, and the supernova (within D-17/D-18/D-20).
- The precise expand interaction for the peek strip (D-21) — route to the GizzGames tab vs. an
  in-place expanded overlay.
- Layout/copy of the deal screen, swap sheet, meter, and the recap/replay share entry points.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked engine + calibration this phase drives (direct dependency — Phase 14)
- `.planning/phases/14-gizz-bingo-core-marking-generation/14-CONTEXT.md` — locked engine
  decisions: `deal()` signature (D-21), consume-once specificity tie-break (D-07..D-11), vibes +
  the **retargeted/gate-green calibration bands** (D-01..D-05 + the 2026-07-20 amendment), rosters
  (D-16..D-18), win conditions (D-26), the marks-derived + 4×4 constraints (D-23). **Do NOT
  re-litigate or re-calibrate.**
- `packages/core/src/bingo/` — the shipped module: `deal` (`generate.ts`), `deriveMarks`
  (`mark.ts`), `detectWins` + `expectedFill` (`wins.ts`), `BingoCard`/`BingoVibe`/`Win` types +
  zod schema (`types.ts`), the string-seed PRNG (`prng.ts`), `BingoContext` (`context.ts`). This
  phase consumes these; the new pre-lock fill estimator (D-10) is the only new core function.
- `packages/core/src/config.ts` §bingo (from ~line 356) — the locked, `[VERIFIED]`-stamped
  constants (`freeIndex`, per-vibe `mix` + `blackoutMax`, `bustOutGapShows`, `jamVehicleSongIds`,
  album roster, dark-floor). The heuristic-estimator constants (D-10) extend this section.

### Persistence / lock / replay machinery this phase drives (direct dependency — Phase 15)
- `.planning/phases/15-gizz-bingo-persistence-lock-replay/15-CONTEXT.md` — GizzGames tab (D-01),
  the "Deal — coming soon" stub this phase replaces (D-02), catch-up (D-03/D-04), replay in
  RecapView (D-05/D-06 — the share/replay attach point), lock-on-Start-Show + late-deal-locks
  (D-08/D-09), reshuffle-rejected-when-locked (D-10), the `bingoCards` row shape (D-11), backup
  round-trip (D-13/D-14).
- `packages/app/src/games/GamesView.tsx` — the GizzGames tab this phase fills with the real
  Deal/build UX (replaces the coming-soon stub); the replay list already lives here.
- `packages/app/src/games/bingoReplay.ts` — the `replayCard` re-derivation adapter (share card +
  replay read from this).
- `packages/app/src/games/CatchUpSheet.tsx` — the shipped catch-up surface (context; not rebuilt).

### Design & empirical source of truth (context — not re-litigated)
- `.planning/notes/gizz-bingo-design-vetting.md` — the vetted v1 design: median 15 songs, 4×4
  decision, album-membership as the variety engine, per-event fire-rates (the numbers behind the
  D-03 catchability hints), the build/celebration UX intent this phase realizes.
- `.planning/research/v1.2/FEATURES.md` — the two anti-boredom pillars (build agency, near-miss)
  and the auto-marking premise this phase delivers.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Gizz Bingo — **BINGO-01 / BINGO-02 / BINGO-04 / BINGO-05 /
  BINGO-08** (this phase); the segue-exclusion note.
- `.planning/ROADMAP.md` §"Phase 16" — goal + the 5 success criteria this CONTEXT clarifies HOW to
  implement.

### Reuse targets for the UI (app-side)
- `packages/app/src/show/ShowView.tsx` — the LiveGizz show screen: hosts the **peek strip** (D-21)
  and the **Start-Show nudge** (D-08); the `adoptSuggestion`/`logSong` path (~line 362) is how the
  trail (and thus `deriveMarks`) gets fed.
- `packages/app/src/dex/RecapView.tsx` — the post-show recap: hosts the bingo replay section
  (Phase-15 D-05) + the **auto-offered share entry** (D-23).
- `packages/app/src/dex/shareCard.ts` + `packages/app/src/dex/ShareCardSheet.tsx` — the existing
  share-card canvas + galaxy aesthetic the **bingo result image** (D-22) reuses.
- `packages/app/src/show/OrbitStage.tsx` — the orb renderer to reuse for per-square **stamps**
  (D-16/D-18) and the **supernova** orb burst (D-17).
- `packages/app/src/explore/ConstellationCanvas.tsx` — the **galaxy backdrop** the supernova reuses
  (D-17).
- `packages/app/src/components/BottomTabBar.tsx` + `packages/app/src/routing/useHashRoute.ts` — the
  GizzGames tab/route (added Phase 15); the peek-strip expand may route here (D-21).
- `useReducedMotion` (already threaded app-wide, per Phase 8/13) — drives the D-20 fallback.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The whole engine is done** — `deal`, `deriveMarks`, `detectWins`, `expectedFill` in
  `packages/core/src/bingo/`. This phase is UI + one new pure-core pre-lock estimator (D-10).
- **`expectedFill(marked)` (`bingo/wins.ts`)** — scores an already-*marked* card; the NEW estimator
  (D-10) is its pre-lock sibling over an unlocked composition. Model the new function next to it.
- **fuse.js catalog search** — already wrapped for the live editor; the swap-sheet Search section
  (D-02) reuses it, same as Phase-15 catch-up manual search (D-04).
- **Share-card canvas (`dex/shareCard.ts` + `ShareCardSheet.tsx`)** — the recap share card renderer;
  the bingo result card (D-22) is a second render target on the same canvas/aesthetic.
- **Orb renderer (`show/OrbitStage.tsx`) + galaxy backdrop (`explore/ConstellationCanvas.tsx`)** —
  reused for stamps + the supernova (D-16/D-17/D-18), per the design doc's explicit intent.
- **`GamesView.tsx` + `bingoReplay.ts`** — the GizzGames tab + replay adapter; this phase adds the
  Deal/build UX and reads replay for the share card.

### Established Patterns
- **Marks derived, never stored (Phase-14 D-23)** — the peek strip, live board, one-away, and
  celebrations all read from `deriveMarks`/`detectWins` over the trail on every `logSong` (the same
  liveQuery discipline as the tally/comet trail). No mark state is written.
- **Honest numbers everywhere** — the catchability % (D-03) and the fill meter (D-10/D-11) follow
  the honest-% orb / honest-count dex precedent; the meter's wording must be Monte-Carlo-validated.
- **App-level non-blocking toasts** — `BackupToast` (Phase 12) is the precedent for the app-wide
  mark-toasts / badge toasts / celebration overlay firing over any tab (D-16/D-18/D-21).
- **Reduced-motion discipline (Phase 8/13)** — `useReducedMotion` already threaded; D-20 extends it
  to bingo celebrations.
- **Strict core purity** — the new fill estimator (D-10) stays DOM/DB-free in `packages/core`,
  reading the same trail-input contract the fold uses (Phase-14 D-22).

### Integration Points
- **LiveGizz show screen (`ShowView.tsx`)** — the peek strip (D-21) and Start-Show nudge (D-08)
  attach here; `logSong`/`adoptSuggestion` feeds the fold.
- **Start Show action** — the trigger that locks the draft card (Phase-15 machinery); the D-08 nudge
  fires here when no draft exists.
- **RecapView (`dex/RecapView.tsx`)** — the share entry (D-23) + replay section attach here.
- **`GamesView.tsx`** — the Deal/vibe/swap/reshuffle build UX + live-marking surface land here,
  replacing the Phase-15 coming-soon stub.

</code_context>

<specifics>
## Specific Ideas

- **Vibe buttons ARE the deal** (D-01) — the owner wanted the fastest possible one-thumb start; no
  separate vibe screen, no default-then-adjust. The gamble is picked and committed in one tap.
- **Calm over cluttered on one-away** (D-14) — the owner chose to surface only the single closest
  near-miss rather than lighting the whole board, even at peak tension. One clear target at a time.
- **Discoverability at Start Show** (D-08) — the owner chose an active nudge in the core loop over a
  silent auto-lock path, accepting a per-show "Not now" tap, because they'll play most nights.
- **Supernova must never block logging** (D-17) — the live setlist log is sacred; the celebration
  bends around it, not the reverse.
- **Trophy, not spreadsheet** (D-22) — the share card is the visual board + badges + venue/date, a
  brag image; the detailed "which song lit each square" stays the in-app replay payoff.
- **Honest fire-rate % as the catchability hint** (D-03) — the owner picked the on-brand honest
  number over friendlier tier-words or opaque meter bars.

</specifics>

<deferred>
## Deferred Ideas

- **Permanent "don't ask again" for the Start-Show bingo nudge** — deliberately omitted from v1
  (D-09); re-open if the nudge proves annoying across a run.
- **Per-candidate delta hints / amber-flagged risky picks inside the swap sheet** — considered and
  rejected for density (D-05); the persistent board meter carries consequence instead.
- **ARIA live-region announcements for auto-marks / one-away / wins** — deferred (D-24) as
  disproportionate for a <10-user personal tool; squares stay labeled toggle buttons. Re-openable.
- **In-browser Monte-Carlo fill meter** — rejected in favor of the cheap heuristic (D-10); the
  calibration Monte-Carlo stays a build-time gate, not a runtime cost.
- **One-away buildup for four-corners / X** — excluded (D-15); those wins still celebrate on
  completion but get no near-miss drum-roll.
- **Sound / celebration audio, haptics** — out (D-19): inaudible at a show, no reliable iOS
  vibration API.
- **Shared-seed leaderboard, segue squares, pre-2020 replay event types** — remain future scope per
  Phase 14/15 (blocked by the personal never-caught square + the refused backend).

### Reviewed Todos (not folded)
- The 15 phase-matched todos are either separate future GizzGames features (Couch Mode, Gizzle,
  Guezz League, Residency Mode, Shiny catches, Badge system, My Stats/Want List, Song Dossiers) or
  general UI polish (bottom-sheet animation, readable date format, standalone-PWA viewport gap,
  final-show share card, constellation flow particles). The "Gizz Bingo live auto-marking" todo IS
  this roadmap feature. None are folded — same disposition as Phase 15. The **"Final show share
  card uses GizzDex totals"** todo touches the same share-card code (D-22/D-23 reuse) but is a
  distinct dex-recap concern — left to its own phase.

</deferred>

---

*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Context gathered: 2026-07-21*

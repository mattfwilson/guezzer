# Feature Research

**Domain:** Setlist tracking / setlist prediction / fan-stats collection apps (jam-band ecosystem)
**Researched:** 2026-07-08
**Confidence:** MEDIUM-HIGH (kglw.net, callingit.live, FantasyPhish verified directly; phish.net/elgoose.net specifics verified via multiple search sources — both 403'd direct fetches; r/KGATLW bingo culture unverified)

## Ecosystem Map (Who Does What)

Four distinct product categories exist in this space. Guezzer sits at the intersection of #3 and #4, which **no existing product occupies**:

1. **Setlist databases (Songfish family: phish.net, elgoose.net, kglw.net; setlist.fm)** — canonical archives, per-song history, gap/bustout/debut charts, show ratings, "My Stats" attendance tracking. Community wikis, not live tools.
2. **Concert diary apps (Gigvault, Concert Archives, Gigs)** — personal "wrapped" stats, photos, most-seen artists/venues. Diary, not analysis.
3. **Setlist prediction games (FantasyPhish, callingit.live, Phantasy Tour games)** — pre-show picks scored *after* the show posts. None predict live, mid-show.
4. **Live in-venue companion** — nobody. Live *next-song* prediction with one-thumb tracking in a dark venue is unoccupied territory.

Critical scoping fact: **kglw.net already provides** the full archive, bustout chart, debut chart, tease chart, yearly summaries, and a "My Stats" attendance feature (most-seen songs/venues/openers, day-of-week breakdown). Guezzer should never rebuild what kglw.net does well — it should do what kglw.net *cannot*: live prediction, offline operation, and the Pokédex framing.

## The Stats Vocabulary Jam-Band Fans Actually Use

Verified as core to Phish/Goose/KGLW stats culture. These are the concepts users of this domain arrive already knowing and expecting:

| Stat | Definition | Community Weight |
|------|------------|------------------|
| **Gap** | Shows since a song was last played (measured in show count, not time) | THE central stat; phish.net has a dedicated Gap Chart; fans discuss "your current notable gaps" (personal gaps) in forums |
| **Bust-out** | A song played after a large gap ("Fuck Your Face": 1,413-show gap) | "A BIG EFFING DEAL" — communal, band-and-fans-agree moment; kglw.net has a Bustout chart |
| **Debut** | First-ever live performance | kglw.net has a Debut chart; debuts are *excluded* from gap charts because they're infinite-gap outliers |
| **Show rarity score** | Average gap of songs played that night (phish.net's "last three times played" average) | Fans use it to rank how special a show was |
| **Tease** | Partial/quoted song inside another song | kglw.net tracks these; My Stats includes "most seen teases" |
| **Openers/closers/encores** | Positional distributions | elgoose.net has a dedicated Openers chart; prediction games award bonus points specifically for opener and encore picks |
| **No-repeat runs** | KGLW-specific: multi-night residencies with zero repeated songs (Red Rocks 2022: 3 nights, no repeats; 2023 residencies: no repeats within a city, 80+ distinct songs) | Documented, deliberate band behavior — this is the strongest possible validation of Guezzer's rotation-suppression signal |

## Feature Landscape

### Table Stakes (Users Expect These)

For a live prediction/tracking/collection tool aimed at stats-literate jam-band fans:

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Running setlist tracker with correction | Every game/archive assumes an accurate setlist; a tracker you can't fix mid-show is dead on arrival | MEDIUM | In scope (miss path, ??? placeholder). Add: edit/delete a wrongly-logged song |
| Set/encore structure in the tracker | Every archive (phish.net, kglw.net, setlist.fm) delimits sets and encores; positional stats depend on it; the Phish LSTM study found set markers materially informative | LOW-MEDIUM | **Gap in current scope** — Show Mode needs a "set break" / "encore" marker button, and the logged show should serialize set structure so it round-trips with kglw.net data |
| Per-song play count and "last played" | Baseline song-detail info on every setlist site | LOW | Falls out of the ingested corpus; surface in song detail / Explore Mode |
| Gap (shows since last played) per song | The domain's central stat; a KGLW stats tool without gaps feels illiterate to its audience | LOW | Same computation as rotation suppression, different presentation. Show on orb detail / song pages |
| Prediction confidence as a number | callingit.live shows algorithm confidence percentages; FantasyPhish players expect odds framing | LOW | In scope (percentage on orb) |
| Searchable full show archive for attendance marking | phish.net "My Shows" and kglw.net "My Stats" both let users retroactively mark attended shows from the archive | MEDIUM | In scope (retroactive marking by date/venue) |
| Personal attendance-derived stats | kglw.net My Stats, Gigvault Wrapped, phish.net My Shows all auto-derive stats from attendance | MEDIUM | In scope (Pokédex derivation) — derived-not-tallied matches how every incumbent works |
| Data export / no lock-in | Personal-tool users burned by app shutdowns; fan tools all offer some export | LOW | In scope (JSON export/import) |
| Post-show summary | Prediction games score every pick after the show; users expect a "how did the night go" recap | LOW | Partially in scope (hit/miss tally); add a simple end-of-show recap view |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Live mid-show next-song prediction** | No product does this. FantasyPhish/callingit.live lock picks pre-show and score after; Guezzer predicts *during*, conditioned on what's been played | HIGH | The core bet. 21.8% top-1 was achieved by an LSTM on Phish (876-song catalog); KGLW's ~250-song catalog + tuning-family batching + no-repeat runs should make a Markov model meaningfully better than that. callingit.live's algo shows "26% backtest hit rate" publicly — validates Guezzer's honest-uncertainty ~25% threshold as the right order of magnitude |
| **Prediction explanations ("why")** | callingit.live shows confidence but never *why*; explanations build trust and are the model debugger | MEDIUM | In scope; genuinely novel in this space |
| **Live hit/miss tally ("you vs. the model")** | callingit.live's "vs algo" competition is its stickiest mechanic — Guezzer gets it in real time | LOW | In scope; this is the fun loop for a friend group |
| **Pokédex collection framing** | phish.net forum has an independently-built "songs I still need to hear live" tracker with active demand; Guezzer's completion %, rarest catch, never-seen list is a richer version | MEDIUM | In scope. "Rarest catch" (lowest base-rate song seen) is exactly the rarity framing phish.net fans use |
| **Personal gap** ("N of your shows since you saw this") | Phish fans actively discuss "your current notable gaps" in forums; no tool computes it automatically | LOW | **Missed opportunity — cheap add**: derivable from attendance list + corpus, delights stats-literate users |
| **Offline-first one-thumb venue UX** | Every comparable product assumes connectivity and two-handed desktop/phone use; venues have no signal | MEDIUM | In scope; a functional requirement that doubles as a differentiator |
| **Run-aware rotation suppression** | KGLW verifiably plays no-repeat multi-night runs; treating same-run prior nights as near-exclusions is a KGLW-specific edge no generic tool has | LOW-MEDIUM | In scope as Signal 4 — sharpen it: within a same-venue/city run, suppression should approach hard exclusion, distinct from soft tour-recency decay |
| **Constellation transition visualization** | Nothing comparable exists; phish.net's data-viz blog posts show strong fan appetite for visual stats | HIGH | In scope (Explore Mode, post-show-#1) |
| **Shareable dex/summary card** | callingit.live generates 1080×1350 ticket-stub wrap cards for social; validates the no-backend share-card approach | MEDIUM | In scope |
| **Show rarity recap** (avg gap of tonight's songs) | phish.net's rarity stat, applied to *your* tracked show; "how special was tonight" in one number | LOW | **Missed opportunity — cheap add** once gaps are computed; belongs in the post-show recap |
| **Possible-debut awareness** | New-album songs have zero transition history; fans obsess over debuts (kglw.net Debut chart) | LOW | Sparse-data backoff already prevents hard zeros; add UI framing: songs from a just-released album flagged "no live history — debut candidate" rather than shown with fake-precise low % |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Pre-show pick-13 game with scoring/leaderboards (FantasyPhish clone) | It's the established fun format; friends will suggest it | Requires accounts, shared state, score persistence, dispute handling — the entire out-of-scope backend | The live hit/miss tally gives the same competitive dopamine with zero infrastructure; friends compare tallies verbally or via share card |
| Community features (ratings, reviews, comments, forums) | Every Songfish site has them | kglw.net already does this well; duplicating it for <10 users is pure waste | Deep-link out to kglw.net show pages |
| Full setlist archive browser with charts (bustout/debut/tease/openers) | "The data's right there, why not show it all" | Rebuilding kglw.net inside Guezzer; unbounded scope | Show only stats that serve prediction or the Pokédex; link to kglw.net for everything else |
| Spotify/Apple playlist export from setlists | setlist.fm's most-loved feature | Off-mission (post-show desktop activity, not show-night); Spotify API friction; setlist.fm already does it | Users paste the setlist from kglw.net into setlist.fm/Spotify tools |
| Photo/video/diary attachments per show | Gigvault's core loop; "concert memories" | Storage-heavy, IndexedDB-eviction-hostile on iOS, irrelevant to prediction/collection | Camera roll already timestamps by show date |
| Predicting the full setlist pre-show | "Tell me tonight's whole show" | Compounding-error garbage beyond 1-2 songs; false precision destroys the trust the backtest gate exists to build | Conditional next-song only; the honest-uncertainty stance is a feature |
| Real-time shared state between friends during shows | "We should all see the same tracked setlist" | Backend, sync conflicts, connectivity assumptions in a no-signal venue | Already consciously deferred to v2 in PROJECT.md; the 60s kglw.net `latest` poll is the de-facto shared source of truth |
| Push notifications ("show starting", "bustout alert") | Concert apps train users to expect them | iOS PWA push is fragile; personal tool has no server to send them | Users are physically at the show — the stage is the notification |
| Jamchart/longest-version curation | Phish culture treats jam length as first-class | Requires editorial judgment and duration data Guezzer doesn't ingest; kglw.net's jamcharts already exist | Consume kglw.net jamcharts as a segue signal (already Signal 3); never author them |

## Feature Dependencies

```
kglw.net corpus ingestion (schema-verified)
    └──required by──> Transition matrix
                          ├──required by──> Prediction scoring (Signals 1-7)
                          │                     ├──required by──> Orbit view / Show Mode
                          │                     └──required by──> Backtest report (trust gate)
                          ├──required by──> Constellation (Explore Mode)
                          └──required by──> Gap / last-played / play-count stats
                                                ├──required by──> Show rarity recap
                                                └──required by──> Possible-debut flagging

Live setlist tracker
    ├──requires──> Fuzzy search over catalog (miss path)
    ├──requires──> Set-break/encore marker  ◄── gap in current scope
    ├──enhances──> Rotation suppression (within-show conditioning)
    └──feeds──> Attendance record (auto-marked)

Attendance marking (live + retroactive)
    └──required by──> Pokédex derivation
                          ├──required by──> Completion %, rarest catch, never-seen list
                          ├──required by──> Personal gap stat
                          ├──required by──> Constellation dex overlay
                          └──required by──> Dex share card / export

Set-position awareness (Signal 7) ──requires──> Set-break/encore marker + set structure in corpus schema
Post-show recap ──requires──> Hit/miss tally + gap stats
```

### Dependency Notes

- **Set-break/encore marker is load-bearing beyond UX:** Signal 7 (set-position) and honest post-show serialization both depend on the tracker recording set structure, not just a flat song list. It must be in Show Mode v1 even if Signal 7 ships later.
- **Gap computation is one function, four features:** rotation suppression, orb detail, show rarity recap, and personal gap all read the same shows-since-last-played derivation. Build once in `core/`.
- **Pokédex is downstream of everything and blocks nothing:** it can ship after show #1 without risk, but attendance auto-marking from live tracking must exist from day one or show #1's dex data is lost.

## MVP Definition

### Launch With (v1 — before show #1)

- [ ] Show Mode loop (orbit, miss path, ??? placeholder, comet trail, tally) — the hard deadline bar per PROJECT.md
- [ ] **Set-break / encore marker in the tracker** — cheap now, unfixable retroactively; setlist data without set structure is lossy forever
- [ ] Live `latest` sync + offline-first — venue reality
- [ ] Backtest report — non-negotiable trust gate; callingit.live publishing "26% backtest hit rate" shows transparency is the domain norm
- [ ] Attendance auto-marking from live-tracked shows — show #1's dex credit depends on it
- [ ] JSON export — iOS eviction risk exists from day one

### Add After Validation (v1.x — between shows / after show #1)

- [ ] Pokédex UI (completion %, rarest catch, never-seen) — trigger: attendance data exists from show #1
- [ ] Retroactive attendance marking from archive — trigger: friends want back-catalog credit
- [ ] Post-show recap with show rarity score — trigger: first tracked show complete
- [ ] Personal gap stat — trigger: Pokédex + gap function both exist (near-zero marginal cost)
- [ ] Explore Mode constellation — explicitly post-show-#1 per PROJECT.md
- [ ] Dex share card — trigger: friend group actually asks to compare
- [ ] Possible-debut UI flagging — trigger: a new album drops before a tour leg

### Future Consideration (v2+)

- [ ] Era slider on constellation — already flagged v1.5 stretch
- [ ] Real-time shared state — already consciously deferred; revisit only if the group demands it
- [ ] Tease/jam-notation awareness beyond segue pairs — needs schema evidence first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Show Mode prediction loop | HIGH | HIGH | P1 |
| Set-break/encore marker | HIGH (data integrity) | LOW | P1 |
| Backtest report | HIGH (trust) | MEDIUM | P1 |
| Live sync + offline | HIGH | MEDIUM | P1 |
| Attendance auto-mark + export | HIGH (data safety) | LOW | P1 |
| Gap stats (per-song) | HIGH (domain literacy) | LOW | P2 |
| Pokédex UI | HIGH (the fun) | MEDIUM | P2 |
| Post-show recap + rarity score | MEDIUM | LOW | P2 |
| Personal gap | MEDIUM | LOW | P2 |
| Constellation | MEDIUM | HIGH | P2 |
| Dex share card | MEDIUM | MEDIUM | P3 |
| Debut flagging | LOW-MEDIUM | LOW | P3 |

## Competitor Feature Analysis

| Feature | kglw.net / Songfish sites | callingit.live / FantasyPhish | Gigvault / diary apps | Guezzer's Approach |
|---------|---------------------------|-------------------------------|----------------------|---------------------|
| Setlist archive | Canonical, full charts | Consume phish.net | None (generic setlist.fm data) | Consume kglw.net API; never rebuild |
| Prediction | None | Pre-show picks, scored post-show; algo confidence shown; 26% backtest disclosed | None | Live mid-show, conditional, explained — the unoccupied niche |
| Gap/bustout stats | Dedicated charts | Bustout picks as a game category | None | Gap as model signal + personal gap + rarity recap |
| Personal attendance stats | My Stats (most-seen songs/venues/teases, day-of-week) | None | Wrapped (totals, most-seen) | Pokédex framing: completion %, rarest catch, never-seen |
| Live in-venue use | Editors update `latest` live | Score-watching after show | None | Primary use case: offline, one-thumb, dark venue |
| Sharing | Public profiles/forums | Ticket-stub wrap cards (1080×1350) | Social feed, friend tagging | No-backend share card + JSON dex exchange |
| Encore/opener awareness | Openers chart (elgoose), positional stats | Opener/encore picks earn bonus points (3 vs 1) | None | Signal 7 + set-break marker; positional stats matter to this audience |

## Sources

- kglw.net site structure and features (direct fetch, HIGH confidence): [kglw.net](https://kglw.net/) — confirmed Bustout chart, Debut chart, Tease chart, My Stats, yearly summaries, API, Heardle
- callingit.live game mechanics (direct fetch, HIGH confidence): [callingit.live](https://callingit.live/) — opener/set-2-opener/encore picks, algo confidence, "vs algo" scoring, 26% backtest hit rate, wrap cards
- FantasyPhish mechanics (direct fetch, HIGH confidence): [fantasyphish.com](https://www.fantasyphish.com) — 13 picks, 3pts opener/encore vs 1pt regular, leaderboards
- Phish LSTM next-song prediction study (direct fetch, HIGH confidence): [Medium/TDS — Predicting What Song Phish Will Play Next](https://medium.com/data-science/predicting-what-song-phish-will-play-next-with-deep-learning-947ccce3824d) — 21.8% top-1 on 876-song catalog; set markers informative
- phish.net Gap Chart, My Shows, rarity stat, personal-gap forum culture (search-verified, MEDIUM confidence — direct fetch 403'd): [Gap Chart](https://phish.net/setlists/gap-chart/), [My Shows](https://phish.net/my-shows), [rarity stat thread](https://forum.phish.net/forum/show/1380116880), [songs-still-needed tracker thread](https://forum.phish.net/forum/show/1380221621), [notable personal gaps thread](https://forum.phish.net/forum/show/1380085265)
- Bust-out culture and definitions (multiple sources, MEDIUM confidence): [JamBase bust-out factor](https://www.jambase.com/article/bust-factor-10-phish-shows-largest-average-song-gaps), [phish.net define-bust-out thread](https://forum.phish.net/forum/show/1342190725)
- KGLW no-repeat residencies (multiple press sources, HIGH confidence): [Red Rocks 2022 no-repeats](https://www.wewriteaboutmusic.com/concerts/king-gizzard-red-rocks-night-3), [BrooklynVegan 2023 marathon/residency coverage](https://www.brooklynvegan.com/king-gizzard-brought-another-3-hour-marathon-set-to-chicago-pics-video-setlist/)
- elgoose.net structure (search-verified, MEDIUM confidence — direct fetch 403'd): [elgoose.net stats](https://elgoose.net/stats/), [Openers chart](https://elgoose.net/charts/openers)
- Concert diary app landscape (search-verified, MEDIUM confidence): [Gigvault](https://gigvault.app/blog/best-apps-to-track-concerts), [setlist.fm statistics](https://www.setlist.fm/statistics)
- r/KGATLW setlist-bingo culture: could not verify via search (LOW confidence, no findings) — prediction-game culture confirmed for Phish community instead

---
*Feature research for: setlist prediction / tracking / fan-collection (Guezzer)*
*Researched: 2026-07-08*
